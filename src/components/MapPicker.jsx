import { useEffect, useRef, useState } from 'react'
import './MapPicker.css'

// Dynamically load Leaflet CSS
const loadLeafletCSS = () => {
    if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
    }
}

function MapPicker({ onSelect, onClose, initialLocation }) {
    const mapContainerRef = useRef(null)
    const mapRef = useRef(null)
    const markerRef = useRef(null)
    const [selectedLocation, setSelectedLocation] = useState(initialLocation)
    const [address, setAddress] = useState(initialLocation?.address || '')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadLeafletCSS()

        // Dynamic import of Leaflet
        import('leaflet').then((L) => {
            if (mapRef.current || !mapContainerRef.current) return

            // Default to India center if no initial location
            const defaultLat = initialLocation?.lat || 28.6139
            const defaultLng = initialLocation?.lng || 77.2090

            // Create map
            mapRef.current = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 13)

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapRef.current)

            // Create draggable marker
            markerRef.current = L.marker([defaultLat, defaultLng], {
                draggable: true
            }).addTo(mapRef.current)

            // Handle marker drag
            markerRef.current.on('dragend', async (e) => {
                const { lat, lng } = e.target.getLatLng()
                await reverseGeocode(lat, lng)
            })

            // Handle map click
            mapRef.current.on('click', async (e) => {
                const { lat, lng } = e.latlng
                markerRef.current.setLatLng([lat, lng])
                await reverseGeocode(lat, lng)
            })

            // If initial location, reverse geocode
            if (initialLocation?.lat) {
                reverseGeocode(initialLocation.lat, initialLocation.lng)
            }
        })

        return () => {
            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [])

    const reverseGeocode = async (lat, lng) => {
        setLoading(true)
        setSelectedLocation({ lat, lng, address: '' })

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
            )
            const data = await response.json()
            const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`

            setSelectedLocation({ lat, lng, address: addr })
            setAddress(addr)
        } catch {
            const addr = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
            setSelectedLocation({ lat, lng, address: addr })
            setAddress(addr)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = () => {
        if (selectedLocation?.lat) {
            onSelect(selectedLocation)
        }
    }

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!address.trim()) return

        setLoading(true)
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
            )
            const data = await response.json()

            if (data.length > 0) {
                const { lat, lon, display_name } = data[0]
                const latNum = parseFloat(lat)
                const lngNum = parseFloat(lon)

                mapRef.current?.setView([latNum, lngNum], 15)
                markerRef.current?.setLatLng([latNum, lngNum])

                setSelectedLocation({ lat: latNum, lng: lngNum, address: display_name })
                setAddress(display_name)
            }
        } catch (error) {
            console.error('Search error:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="map-picker-overlay">
            <div className="map-picker-modal">
                <div className="map-picker-header">
                    <h3>Select Location</h3>
                    <button onClick={onClose} className="close-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSearch} className="map-search">
                    <input
                        type="text"
                        placeholder="Search location..."
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="input-field"
                    />
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        Search
                    </button>
                </form>

                <div ref={mapContainerRef} className="map-container" />

                <div className="map-picker-footer">
                    {loading && <span className="loading-text">Loading...</span>}
                    {selectedLocation?.lat && (
                        <span className="selected-coords">
                            📍 {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                        </span>
                    )}
                    <div className="map-actions">
                        <button onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="btn btn-primary"
                            disabled={!selectedLocation?.lat}
                        >
                            Confirm Location
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MapPicker
