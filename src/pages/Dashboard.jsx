import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReportsFromDatabase, updateReportStatusDatabase, subscribeToReports } from '../utils/realtimeDb'
import { useAuth } from '../context/AuthContext'
import { getAllContractorsWithStats } from '../utils/contractorService'
import PotholeCard from '../components/PotholeCard'
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import './Dashboard.css'

// Custom Heatmap Layer component for react-leaflet
function HeatmapLayer({ points }) {
    const map = useMap()
    const heatLayerRef = useRef(null)

    useEffect(() => {
        if (!map || !points.length) return

        // Remove existing layer
        if (heatLayerRef.current) {
            map.removeLayer(heatLayerRef.current)
        }

        // Create heatmap layer
        heatLayerRef.current = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            max: 1.0,
            gradient: {
                0.2: '#2ecc71',  // Green (low)
                0.4: '#f1c40f',  // Yellow
                0.6: '#e67e22',  // Orange
                0.8: '#e74c3c',  // Red (high)
                1.0: '#9b59b6'   // Purple (critical)
            }
        }).addTo(map)

        return () => {
            if (heatLayerRef.current) {
                map.removeLayer(heatLayerRef.current)
            }
        }
    }, [map, points])

    return null
}

// Component to fly to a location when triggered via custom event
function FlyToLocation() {
    const map = useMap()

    useEffect(() => {
        const handleFly = (e) => {
            const { lat, lng } = e.detail
            if (lat && lng) {
                map.flyTo([lat, lng], 15, { duration: 1.5 })
            }
        }

        window.addEventListener('flyToLocation', handleFly)
        return () => window.removeEventListener('flyToLocation', handleFly)
    }, [map])

    return null
}

function Dashboard() {
    const navigate = useNavigate()
    const { user, isAuthenticated } = useAuth()
    const [reports, setReports] = useState([])
    const [contractors, setContractors] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, pending, progress, resolved
    const [sortBy, setSortBy] = useState('newest') // newest, severe, topReporter, mostReported
    const [showMyReports, setShowMyReports] = useState(false)

    // Get user's reports from the last 6 months
    const myReports = useMemo(() => {
        if (!user?.email) return []
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

        return reports.filter(r => {
            // Match by email in reporters array or top-level reporterEmail
            const reporterMatch = r.reporterEmail === user.email ||
                (r.reporters && r.reporters.some(rep => rep.email === user.email))
            if (!reporterMatch) return false

            // Check if within last 6 months
            const reportDate = new Date(r.createdAt)
            return reportDate >= sixMonthsAgo
        }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }, [reports, user])

    useEffect(() => {
        setLoading(true)
        // Real-time listener — updates dashboard instantly when Firebase changes
        const unsubscribe = subscribeToReports((data) => {
            setReports(data)
            setLoading(false)
        })
        loadContractors()
        return () => unsubscribe() // Cleanup listener on unmount
    }, [])

    const loadContractors = async () => {
        // Calculate real-time stats from reports
        // We'll calculate:
        // 1. Active potholes per zone (pending/progress)
        // 2. Fixed potholes per zone (resolved)

        // Wait for reports to be loaded first if checking dependency, 
        // but typically we can get fresh data or derived from state if effect allows
        const allReports = await getReportsFromDatabase()

        // Get base contractor list
        const baseContractors = getAllContractorsWithStats()

        // Calculate real stats
        const realStats = baseContractors.map(contractor => {
            const zones = contractor.zones.map(z => z.toLowerCase())

            const activeCount = allReports.filter(r => {
                const address = (r.location?.address || '').toLowerCase()
                const isActive = r.status === 'pending' || r.status === 'progress'
                return isActive && zones.some(zone => address.includes(zone))
            }).length

            const fixedCount = allReports.filter(r => {
                const address = (r.location?.address || '').toLowerCase()
                return r.status === 'resolved' && zones.some(zone => address.includes(zone))
            }).length

            return {
                ...contractor,
                stats: {
                    ...contractor.stats, // Keep simulated avgResponseTime
                    activePotholes: activeCount,
                    fixedLastMonth: fixedCount
                }
            }
        })

        // Sort by active potholes (descending)
        setContractors(realStats.sort((a, b) => b.stats.activePotholes - a.stats.activePotholes))
    }

    const handleStatusChange = async (reportId, newStatus, assignedToUser) => {
        try {
            // Optimistic update
            setReports(prev => prev.map(report => {
                if (report.id === reportId) {
                    const updated = { ...report, status: newStatus }
                    if (newStatus === 'progress' && assignedToUser) {
                        updated.assignedTo = {
                            name: assignedToUser.name,
                            timestamp: new Date().toISOString()
                        }
                    }
                    if (newStatus === 'resolved' && assignedToUser) {
                        updated.resolvedBy = {
                            name: assignedToUser.name,
                            timestamp: new Date().toISOString()
                        }
                    }
                    return updated
                }
                return report
            }))

            await updateReportStatusDatabase(reportId, newStatus)
        } catch (error) {
            console.error('Failed to update status:', error)
            alert('Failed to update status. Please try again.')
            loadReports() // Revert on error
        }
    }

    const getFilteredReports = () => {
        let filtered = reports

        if (filter !== 'all') {
            filtered = filtered.filter(r => r.status === filter)
        }

        // For topReporter sort, count reports per user
        if (sortBy === 'topReporter') {
            const reportCountByUser = {}
            filtered.forEach(report => {
                const userName = report.reporterName || report.reporterEmail || 'Anonymous'
                reportCountByUser[userName] = (reportCountByUser[userName] || 0) + 1
            })
            return filtered.sort((a, b) => {
                const userA = a.reporterName || a.reporterEmail || 'Anonymous'
                const userB = b.reporterName || b.reporterEmail || 'Anonymous'
                const countDiff = reportCountByUser[userB] - reportCountByUser[userA]
                if (countDiff !== 0) return countDiff
                return new Date(b.createdAt) - new Date(a.createdAt)
            })
        }

        // NEW: Sort by Most Reported (Cluster duplicate reports by location proximity)
        // We'll naively group by very close lat/lng or identical address
        if (sortBy === 'mostReported') {
            // Count duplicates for each report
            const getDuplicateCount = (targetReport) => {
                return filtered.filter(r => {
                    // Check if location is very close (within ~20 meters roughly)
                    // 0.0002 deg is roughly 22 meters
                    const latDiff = Math.abs(r.location.lat - targetReport.location.lat)
                    const lngDiff = Math.abs(r.location.lng - targetReport.location.lng)
                    return latDiff < 0.0002 && lngDiff < 0.0002
                }).length
            }

            return filtered.sort((a, b) => {
                const countA = getDuplicateCount(a)
                const countB = getDuplicateCount(b)
                // Sort by count descending, then by severity
                if (countB !== countA) return countB - countA

                // Then by severity
                const severityWeight = { critical: 4, large: 3, medium: 2, small: 1 }
                return severityWeight[b.severity] - severityWeight[a.severity]
            })
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.createdAt) - new Date(a.createdAt)
            } else if (sortBy === 'severe') {
                // Modified: Put Critical FIRST
                const severityWeight = { critical: 4, large: 3, medium: 2, small: 1 }
                return severityWeight[b.severity] - severityWeight[a.severity]
            }
            return 0
        })
    }

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="container">
                    <div className="loading-state">
                        <span className="spinner"></span> Loading reports...
                    </div>
                </div>
            </div>
        )
    }

    const filteredReports = getFilteredReports()

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header">
                    <h1>Community Dashboard</h1>
                    <p>Track reported potholes and ongoing repairs in your area</p>
                </div>

                <div className="dashboard-layout">
                    {/* Main Content: Reports List */}
                    <div className="dashboard-main">
                        <div className="dashboard-controls">
                            <div className="control-group">
                                <label>Filter Status:</label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="select-input"
                                >
                                    <option value="all">All Reports</option>
                                    <option value="pending">Pending</option>
                                    <option value="progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                </select>
                            </div>

                            <div className="control-group">
                                <label>Sort By:</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="select-input"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="severe">Severity (High to Low)</option>
                                    <option value="mostReported">Most Reported (Duplicates)</option>
                                    <option value="topReporter">Top Reporters</option>
                                </select>
                            </div>
                        </div>

                        <div className="stats-bar">
                            <div className="stat-item">
                                <span className="stat-value">{reports.length}</span>
                                <span className="stat-label">Total Reports</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value warning">
                                    {reports.filter(r => r.status === 'pending').length}
                                </span>
                                <span className="stat-label">Pending</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value success">
                                    {reports.filter(r => r.status === 'resolved').length}
                                </span>
                                <span className="stat-label">Fixed</span>
                            </div>
                        </div>

                        {/* My Reports Section - Only for logged-in users */}
                        {isAuthenticated && (
                            <div className="my-reports-section">
                                <button
                                    className="my-reports-toggle"
                                    onClick={() => setShowMyReports(!showMyReports)}
                                >
                                    <span className="my-reports-toggle-left">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                            <circle cx="8.5" cy="7" r="4" />
                                        </svg>
                                        My Reports ({myReports.length})
                                    </span>
                                    <svg
                                        width="20" height="20" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2"
                                        style={{ transform: showMyReports ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }}
                                    >
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>

                                {showMyReports && (
                                    <div className="my-reports-list">
                                        {myReports.length === 0 ? (
                                            <div className="my-reports-empty">
                                                <p>You haven't reported any potholes in the last 6 months.</p>
                                                <button onClick={() => navigate('/report')} className="btn btn-primary btn-sm">Report Now</button>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="my-reports-subtitle">Your reports from the last 6 months</p>
                                                <div className="my-reports-table-wrap">
                                                    <table className="my-reports-table">
                                                        <thead>
                                                            <tr>
                                                                <th>Date</th>
                                                                <th>Location</th>
                                                                <th>Severity</th>
                                                                <th>Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {myReports.map(report => {
                                                                const date = new Date(report.createdAt)
                                                                const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                                                return (
                                                                    <tr key={report.id}>
                                                                        <td>{dateStr}</td>
                                                                        <td className="location-cell">{report.location?.address || `${report.location?.lat?.toFixed(4)}, ${report.location?.lng?.toFixed(4)}`}</td>
                                                                        <td>
                                                                            <span className={`severity-pill ${report.severity}`}>
                                                                                {report.severity}
                                                                            </span>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`status-pill ${report.status}`}>
                                                                                {report.status === 'pending' && '🟡 Pending'}
                                                                                {report.status === 'progress' && '🔵 In Progress'}
                                                                                {report.status === 'resolved' && '🟢 Resolved'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Heatmap Section */}
                        {(() => {
                            // All reports with valid coordinates
                            const allReportsWithCoords = reports.filter(r => r.location?.lat && r.location?.lng)
                            const activeReports = allReportsWithCoords.filter(r => r.status !== 'resolved')
                            const resolvedReports = allReportsWithCoords.filter(r => r.status === 'resolved')

                            console.log('📊 Heatmap Data:', { total: reports.length, withCoords: allReportsWithCoords.length, active: activeReports.length, resolved: resolvedReports.length })

                            // Heatmap points from active potholes
                            const heatmapPoints = activeReports.map(r => {
                                const severityIntensity = { critical: 1.0, large: 0.8, medium: 0.5, small: 0.3 }
                                return [r.location.lat, r.location.lng, severityIntensity[r.severity] || 0.5]
                            })

                            // Map center (first pothole or India center)
                            const defaultCenter = [20.5937, 78.9629]
                            const mapCenter = allReportsWithCoords.length > 0
                                ? [allReportsWithCoords[0].location.lat, allReportsWithCoords[0].location.lng]
                                : defaultCenter

                            return (
                                <div className="heatmap-section">
                                    <h3>🔥 Pothole Hotspots</h3>
                                    <p className="heatmap-subtitle">
                                        {activeReports.length} active • {resolvedReports.length} fixed
                                    </p>

                                    {/* Map Controls */}
                                    <div className="heatmap-controls">
                                        <input
                                            type="text"
                                            placeholder="🔍 Search location..."
                                            className="heatmap-search"
                                            onKeyDown={async (e) => {
                                                if (e.key === 'Enter' && e.target.value.trim()) {
                                                    try {
                                                        const query = encodeURIComponent(e.target.value)
                                                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`)
                                                        const data = await res.json()
                                                        if (data[0]) {
                                                            const { lat, lon } = data[0]
                                                            // Dispatch custom event for map fly
                                                            window.dispatchEvent(new CustomEvent('flyToLocation', { detail: { lat: parseFloat(lat), lng: parseFloat(lon) } }))
                                                        } else {
                                                            alert('Location not found')
                                                        }
                                                    } catch (err) {
                                                        console.error('Search error:', err)
                                                    }
                                                }
                                            }}
                                        />
                                        <button
                                            className="btn-my-location"
                                            onClick={() => {
                                                if (navigator.geolocation) {
                                                    navigator.geolocation.getCurrentPosition(
                                                        (pos) => {
                                                            window.dispatchEvent(new CustomEvent('flyToLocation', {
                                                                detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                                                            }))
                                                        },
                                                        (err) => alert('Could not get location: ' + err.message),
                                                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                                                    )
                                                } else {
                                                    alert('Geolocation not supported')
                                                }
                                            }}
                                            title="Go to my location"
                                        >
                                            📍 My Location
                                        </button>
                                    </div>

                                    <div className="heatmap-container">
                                        <MapContainer
                                            center={mapCenter}
                                            zoom={12}
                                            style={{ height: '400px', width: '100%', borderRadius: '12px' }}
                                            scrollWheelZoom={true}
                                        >
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution='&copy; OpenStreetMap'
                                            />
                                            {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}

                                            {/* Resolved pothole markers (green) */}
                                            {resolvedReports.map(r => (
                                                <Marker
                                                    key={r.id}
                                                    position={[r.location.lat, r.location.lng]}
                                                    icon={L.divIcon({
                                                        className: 'resolved-marker',
                                                        html: `<div style="width:14px;height:14px;background:#22c55e;border:2px solid white;border-radius:50%;opacity:0.7;"></div>`,
                                                        iconSize: [14, 14],
                                                        iconAnchor: [7, 7]
                                                    })}
                                                >
                                                    <Popup>✅ Fixed: {r.location?.address || 'Location'}</Popup>
                                                </Marker>
                                            ))}

                                            {/* Active pothole markers */}
                                            {activeReports.map(r => (
                                                <Marker
                                                    key={r.id}
                                                    position={[r.location.lat, r.location.lng]}
                                                    icon={L.divIcon({
                                                        className: 'active-marker',
                                                        html: `<div style="width:16px;height:16px;background:${r.severity === 'critical' ? '#ef4444' :
                                                            r.severity === 'large' ? '#f97316' :
                                                                r.severity === 'medium' ? '#eab308' : '#6b7280'
                                                            };border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>`,
                                                        iconSize: [16, 16],
                                                        iconAnchor: [8, 8]
                                                    })}
                                                >
                                                    <Popup>
                                                        <strong>{r.severity?.toUpperCase()}</strong><br />
                                                        {r.location?.address || 'Reported pothole'}
                                                    </Popup>
                                                </Marker>
                                            ))}

                                            {/* FlyTo component */}
                                            <FlyToLocation />
                                        </MapContainer>
                                    </div>
                                    <div className="heatmap-legend">
                                        <span className="legend-item"><span className="dot red"></span> Critical</span>
                                        <span className="legend-item"><span className="dot orange"></span> Large</span>
                                        <span className="legend-item"><span className="dot yellow"></span> Medium</span>
                                        <span className="legend-item"><span className="dot green"></span> Fixed</span>
                                    </div>
                                </div>
                            )
                        })()}

                        {filteredReports.length === 0 ? (
                            <div className="empty-state">
                                <p>No reports found matching your filters.</p>
                                <button
                                    onClick={() => navigate('/report')}
                                    className="btn btn-primary"
                                >
                                    Report First Pothole
                                </button>
                            </div>
                        ) : (
                            <div className="reports-grid">
                                {filteredReports.map(report => (
                                    <PotholeCard
                                        key={report.id}
                                        report={report}
                                        onStatusChange={handleStatusChange}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Contractor Watchlist */}
                    <aside className="dashboard-sidebar">
                        <div className="sidebar-card">
                            <h3>🚧 Contractor Watchlist</h3>
                            <p className="sidebar-subtitle">Top agencies by active pothole count</p>

                            <div className="contractor-list">
                                {contractors.slice(0, 5).map((contractor, index) => (
                                    <div key={contractor.id} className="contractor-item">
                                        <div className="contractor-rank">#{index + 1}</div>
                                        <div className="contractor-info">
                                            <h4>{contractor.name}</h4>
                                            <div className="contractor-stats">
                                                <span className="stat-badge warning">
                                                    {contractor.stats.activePotholes} Active
                                                </span>
                                                <span className="stat-badge success">
                                                    {contractor.stats.fixedLastMonth} Fixed
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="sidebar-footer">
                                <small>Real-time data based on reports</small>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
