// LocalStorage helpers for pothole reports (frontend demo)

const STORAGE_KEY = 'pofix_reports'

export function getReports() {
    try {
        const data = localStorage.getItem(STORAGE_KEY)
        return data ? JSON.parse(data) : []
    } catch {
        return []
    }
}

export function saveReport(report) {
    const reports = getReports()
    const newReport = {
        ...report,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: 'pending',
        reportCount: 1
    }

    // Check if similar location exists (within ~100m)
    const existingIndex = reports.findIndex(r =>
        isNearbyLocation(r.location, newReport.location)
    )

    if (existingIndex !== -1) {
        // Increment report count for existing location
        reports[existingIndex].reportCount += 1
        reports[existingIndex].images = [
            ...(reports[existingIndex].images || []),
            newReport.imageUrl
        ]
        reports[existingIndex].updatedAt = new Date().toISOString()
    } else {
        reports.push({
            ...newReport,
            images: [newReport.imageUrl]
        })
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
    return existingIndex !== -1 ? reports[existingIndex] : newReport
}

export function updateReportStatus(id, status, userInfo = null) {
    const reports = getReports()
    const index = reports.findIndex(r => r.id === id)

    if (index !== -1) {
        reports[index].status = status
        reports[index].updatedAt = new Date().toISOString()

        // Track who is working on / resolved the pothole
        if (status === 'progress' && userInfo) {
            reports[index].assignedTo = {
                name: userInfo.name || 'Unknown',
                id: userInfo.id || null,
                timestamp: new Date().toISOString()
            }
        }
        if (status === 'resolved' && userInfo) {
            reports[index].resolvedBy = {
                name: userInfo.name || 'Unknown',
                id: userInfo.id || null,
                timestamp: new Date().toISOString()
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
    }

    return reports[index]
}

export function deleteReport(id) {
    const reports = getReports().filter(r => r.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

// Check if two locations are within ~10 meters (high precision for distinguishing nearby potholes)
function isNearbyLocation(loc1, loc2) {
    if (!loc1?.lat || !loc1?.lng || !loc2?.lat || !loc2?.lng) {
        return false
    }

    const R = 6371000 // Earth's radius in meters
    const dLat = toRad(loc2.lat - loc1.lat)
    const dLng = toRad(loc2.lng - loc1.lng)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(loc1.lat)) * Math.cos(toRad(loc2.lat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = R * c

    return distance < 10 // 10 meters threshold (high precision)
}

function toRad(deg) {
    return deg * (Math.PI / 180)
}

// Demo data for initial state
export function seedDemoData() {
    const existing = getReports()
    if (existing.length > 0) return

    const demoReports = [
        {
            id: 'demo-1',
            location: { lat: 28.6139, lng: 77.2090, address: 'Connaught Place, New Delhi' },
            severity: 'critical',
            roadType: 'city',
            imageUrl: '/ezgif-frame-001.jpg',
            images: ['/ezgif-frame-001.jpg', '/ezgif-frame-002.jpg'],
            reportCount: 15,
            status: 'pending',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            reporterName: 'Demo User',
            reporterEmail: 'demo@example.com'
        },
        {
            id: 'demo-2',
            location: { lat: 28.5355, lng: 77.3910, address: 'Sector 18, Noida' },
            severity: 'large',
            roadType: 'highway',
            imageUrl: '/ezgif-frame-005.jpg',
            images: ['/ezgif-frame-005.jpg'],
            reportCount: 8,
            status: 'progress',
            createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            reporterName: 'Demo User',
            reporterEmail: 'demo@example.com'
        },
        {
            id: 'demo-3',
            location: { lat: 28.4595, lng: 77.0266, address: 'MG Road, Gurgaon' },
            severity: 'medium',
            roadType: 'city',
            imageUrl: '/ezgif-frame-010.jpg',
            images: ['/ezgif-frame-010.jpg'],
            reportCount: 3,
            status: 'pending',
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            reporterName: 'Demo User',
            reporterEmail: 'demo@example.com'
        },
        {
            id: 'demo-4',
            location: { lat: 28.6304, lng: 77.2177, address: 'Kashmere Gate, Delhi' },
            severity: 'small',
            roadType: 'residential',
            imageUrl: '/ezgif-frame-015.jpg',
            images: ['/ezgif-frame-015.jpg'],
            reportCount: 1,
            status: 'resolved',
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
            reporterName: 'Demo User',
            reporterEmail: 'demo@example.com'
        }
    ]

    localStorage.setItem(STORAGE_KEY, JSON.stringify(demoReports))
}
