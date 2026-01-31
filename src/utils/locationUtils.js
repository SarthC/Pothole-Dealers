/**
 * Location utilities for Drive Safe Mode
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
}

/**
 * Get potholes within a certain radius of user's position
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @param radiusMeters Radius to search (default 500m)
 * @param potholes Array of pothole reports
 * @returns Array of nearby potholes with distance
 */
export function getNearbyPotholes(userLat, userLng, radiusMeters, potholes) {
    return potholes
        .map(pothole => {
            const lat = pothole.location?.lat
            const lng = pothole.location?.lng
            if (!lat || !lng) return null

            const distance = calculateDistance(userLat, userLng, lat, lng)
            return { ...pothole, distance }
        })
        .filter(p => p && p.distance <= radiusMeters)
        .sort((a, b) => a.distance - b.distance)
}

/**
 * Speak an alert message using Web Speech API
 */
export function speakAlert(message) {
    if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported')
        return
    }

    // Do not cancel ongoing speech - allow queuing
    // window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(message)
    utterance.rate = 1.1
    utterance.pitch = 1
    utterance.volume = 1

    window.speechSynthesis.speak(utterance)
}

/**
 * Format distance for display
 */
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)}m`
    }
    return `${(meters / 1000).toFixed(1)}km`
}

/**
 * Get severity color for map markers
 */
export function getSeverityColor(severity) {
    const colors = {
        critical: '#ef4444',
        large: '#f97316',
        medium: '#eab308',
        small: '#22c55e'
    }
    return colors[severity] || '#6b7280'
}
