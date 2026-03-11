import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getReportsFromDatabase } from '../utils/realtimeDb'
import {
    calculateDistance,
    getNearbyPotholes,
    speakAlert,
    formatDistance,
    getSeverityColor
} from '../utils/locationUtils'
import './DriveSafe.css'

// Custom marker icons
const createPotholeIcon = (severity) => {
    const color = getSeverityColor(severity)
    return L.divIcon({
        className: 'pothole-marker',
        html: `<div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    })
}

const userIcon = L.divIcon({
    className: 'user-marker',
    html: `<div class="user-marker-pulse"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
})

// Component to follow user on map
function FollowUser({ position }) {
    const map = useMap()
    useEffect(() => {
        if (position) {
            map.setView(position, map.getZoom())
        }
    }, [position, map])
    return null
}

function DriveSafe() {
    const [isTracking, setIsTracking] = useState(false)
    const [userPosition, setUserPosition] = useState(null)
    const [potholes, setPotholes] = useState([])
    const [nearbyPotholes, setNearbyPotholes] = useState([])
    const [alertHistory, setAlertHistory] = useState([])
    const [error, setError] = useState(null)

    const watchIdRef = useRef(null)
    const alertedIdsRef = useRef(new Set())

    const ALERT_RADIUS = 200 // meters - trigger voice alert
    const SCAN_RADIUS = 500 // meters - show on map

    // Load potholes on mount
    useEffect(() => {
        loadPotholes()
    }, [])

    const loadPotholes = async () => {
        try {
            const reports = await getReportsFromDatabase()
            console.log('🚗 DriveSafe: Loaded reports', reports.length)
            // Only include unresolved potholes
            const active = reports.filter(r => r.status !== 'resolved')
            console.log('🚗 DriveSafe: Active potholes', active.length, active.map(p => ({
                id: p.id,
                lat: p.location?.lat,
                lng: p.location?.lng,
                severity: p.severity
            })))
            setPotholes(active)
        } catch (err) {
            console.error('Failed to load potholes:', err)
        }
    }

    // Process nearby potholes when position changes
    useEffect(() => {
        if (!userPosition || !isTracking) return

        const nearby = getNearbyPotholes(
            userPosition[0],
            userPosition[1],
            SCAN_RADIUS,
            potholes
        )
        setNearbyPotholes(nearby)

        // Check for potholes within alert radius
        nearby.forEach(pothole => {
            if (pothole.distance <= ALERT_RADIUS && !alertedIdsRef.current.has(pothole.id)) {
                // Mark as alerted
                alertedIdsRef.current.add(pothole.id)

                // Create alert message
                const severity = pothole.severity || 'unknown'
                const distance = Math.round(pothole.distance)
                const message = `Caution! ${severity} pothole ahead, ${distance} meters`

                // Speak alert
                speakAlert(message)

                // Add to history
                setAlertHistory(prev => [{
                    id: pothole.id,
                    message,
                    time: new Date().toLocaleTimeString(),
                    severity
                }, ...prev.slice(0, 9)])
            }
        })
    }, [userPosition, potholes, isTracking])

    const startTracking = useCallback(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser')
            return
        }

        setIsTracking(true)
        setError(null)
        alertedIdsRef.current.clear()

        speakAlert('Drive Safe mode activated. I will alert you about nearby potholes.')

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude } = position.coords
                setUserPosition([latitude, longitude])
            },
            (err) => {
                setError(`Location error: ${err.message}`)
                setIsTracking(false)
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0, // Force a fresh GPS lock, no cached positions
                timeout: 20000 // Wait up to 20 seconds for a fix
            }
        )
    }, [])

    const stopTracking = useCallback(() => {
        if (watchIdRef.current) {
            navigator.geolocation.clearWatch(watchIdRef.current)
            watchIdRef.current = null
        }
        setIsTracking(false)
        speakAlert('Drive Safe mode deactivated. Drive carefully!')
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current)
            }
        }
    }, [])

    return (
        <div className="drivesafe-page">
            {/* Map */}
            <div className="drivesafe-map">
                <MapContainer
                    center={userPosition || [12.9716, 77.5946]}
                    zoom={16}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; OpenStreetMap'
                    />

                    {/* User position */}
                    {userPosition && (
                        <>
                            <Marker position={userPosition} icon={userIcon}>
                                <Popup>You are here</Popup>
                            </Marker>
                            <Circle
                                center={userPosition}
                                radius={ALERT_RADIUS}
                                pathOptions={{
                                    color: '#ef4444',
                                    fillColor: '#ef4444',
                                    fillOpacity: 0.1,
                                    weight: 2,
                                    dashArray: '5, 5'
                                }}
                            />
                            <Circle
                                center={userPosition}
                                radius={SCAN_RADIUS}
                                pathOptions={{
                                    color: '#3b82f6',
                                    fillColor: '#3b82f6',
                                    fillOpacity: 0.05,
                                    weight: 1
                                }}
                            />
                            <FollowUser position={userPosition} />
                        </>
                    )}

                    {/* Pothole markers */}
                    {nearbyPotholes.map(pothole => (
                        <Marker
                            key={pothole.id}
                            position={[pothole.location.lat, pothole.location.lng]}
                            icon={createPotholeIcon(pothole.severity)}
                        >
                            <Popup>
                                <strong>{pothole.severity?.toUpperCase()} Pothole</strong>
                                <br />
                                {formatDistance(pothole.distance)} away
                                <br />
                                <small>{pothole.location?.address}</small>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>
            </div>

            {/* Control Panel */}
            <div className="drivesafe-controls">
                <div className="controls-header">
                    <h2>🚗 Drive Safe Mode</h2>
                    <p className="status-text">
                        {isTracking ? (
                            <span className="status-active">● Monitoring {nearbyPotholes.length} hazards</span>
                        ) : (
                            <span className="status-inactive">● Inactive</span>
                        )}
                    </p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button
                    className={`btn-drivesafe ${isTracking ? 'stop' : 'start'}`}
                    onClick={isTracking ? stopTracking : startTracking}
                >
                    {isTracking ? '⏹ Stop Tracking' : '▶ Start Drive Safe'}
                </button>

                {/* Alert History */}
                {alertHistory.length > 0 && (
                    <div className="alert-history">
                        <h4>Recent Alerts</h4>
                        <ul>
                            {alertHistory.map((alert, idx) => (
                                <li key={idx} className={`alert-item ${alert.severity}`}>
                                    <span className="alert-time">{alert.time}</span>
                                    <span className="alert-msg">{alert.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="legend">
                    <h4>Legend</h4>
                    <div className="legend-items">
                        <span><span className="dot critical"></span> Critical</span>
                        <span><span className="dot large"></span> Large</span>
                        <span><span className="dot medium"></span> Medium</span>
                        <span><span className="dot small"></span> Small</span>
                    </div>
                    <p className="legend-desc">
                        🔴 Alert Zone (200m) &nbsp; 🔵 Scan Zone (500m)
                    </p>
                </div>
            </div>
        </div>
    )
}

export default DriveSafe
