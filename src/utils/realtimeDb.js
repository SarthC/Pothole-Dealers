// Realtime Database utility for pothole reports
import {
    ref,
    push,
    get,
    update,
    remove,
    query,
    orderByChild,
    serverTimestamp
} from 'firebase/database'
import { database } from './firebase'

const REPORTS_PATH = 'pothole_reports'

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

/**
 * Find existing report within specified radius (in meters)
 */
async function findNearbyReport(lat, lng, radiusMeters = 100) {
    try {
        const reportsRef = ref(database, REPORTS_PATH)
        const snapshot = await get(reportsRef)

        if (!snapshot.exists()) return null

        let nearestReport = null
        let minDistance = radiusMeters

        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val()
            if (data.locationLat && data.locationLng && data.status !== 'resolved') {
                const distance = getDistanceMeters(lat, lng, data.locationLat, data.locationLng)
                if (distance < minDistance) {
                    minDistance = distance
                    nearestReport = { id: childSnapshot.key, ...data }
                }
            }
        })

        return nearestReport
    } catch (error) {
        console.error('Error finding nearby report:', error)
        return null
    }
}

/**
 * Save a new pothole report to Realtime Database
 * Merges with existing report if within 100m radius
 */
export async function saveReportToDatabase(report) {
    try {
        const lat = report.location?.lat
        const lng = report.location?.lng

        // Check for existing nearby report
        if (lat && lng) {
            const existingReport = await findNearbyReport(lat, lng, 100)

            if (existingReport) {
                // Merge with existing report
                console.log('📍 Found nearby pothole, merging reports...')
                const reportRef = ref(database, `${REPORTS_PATH}/${existingReport.id}`)

                // Build list of all reporters
                const currentReporters = existingReport.reporters || [{
                    name: existingReport.reporterName || 'Anonymous',
                    email: existingReport.reporterEmail || '',
                    photo: existingReport.reporterPhoto || null,
                    reportedAt: existingReport.createdAt
                }]

                // Add new reporter
                currentReporters.push({
                    name: report.reporterName || 'Anonymous',
                    email: report.reporterEmail || '',
                    photo: report.reporterPhoto || null,
                    reportedAt: Date.now()
                })

                // Build list of all images
                const currentImages = existingReport.images || [existingReport.imageUrl]
                if (report.imageUrl && !currentImages.includes(report.imageUrl)) {
                    currentImages.push(report.imageUrl)
                }

                // Update severity if new report is more severe
                const severityOrder = { small: 1, medium: 2, large: 3, critical: 4 }
                const newSeverity = severityOrder[report.severity] > severityOrder[existingReport.severity]
                    ? report.severity
                    : existingReport.severity

                await update(reportRef, {
                    reportCount: (existingReport.reportCount || 1) + 1,
                    reporters: currentReporters,
                    images: currentImages,
                    severity: newSeverity,
                    updatedAt: Date.now()
                })

                return {
                    id: existingReport.id,
                    merged: true,
                    reportCount: (existingReport.reportCount || 1) + 1
                }
            }
        }

        // No nearby report found, create new one
        const reportsRef = ref(database, REPORTS_PATH)
        const newReportRef = push(reportsRef)

        const reportData = {
            ...report,
            locationLat: lat || null,
            locationLng: lng || null,
            locationAddress: report.location?.address || '',
            reportCount: 1,
            reporters: [{
                name: report.reporterName || 'Anonymous',
                email: report.reporterEmail || '',
                photo: report.reporterPhoto || null,
                reportedAt: Date.now()
            }],
            images: [report.imageUrl],
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }

        await update(newReportRef, reportData)

        return { id: newReportRef.key, ...reportData }
    } catch (error) {
        console.error('Error saving report:', error)
        throw error
    }
}

/**
 * Get all reports from Realtime Database
 */
export async function getReportsFromDatabase() {
    try {
        const reportsRef = ref(database, REPORTS_PATH)
        const snapshot = await get(reportsRef)

        if (!snapshot.exists()) {
            return []
        }

        const reports = []
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val()
            reports.push({
                id: childSnapshot.key,
                ...data,
                location: {
                    lat: data.locationLat,
                    lng: data.locationLng,
                    address: data.locationAddress
                },
                createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
            })
        })

        // Sort by createdAt descending (newest first)
        return reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    } catch (error) {
        console.error('Error getting reports:', error)
        throw error
    }
}

/**
 * Update report status in Realtime Database
 */
export async function updateReportStatusDatabase(reportId, status, userInfo = null) {
    try {
        const reportRef = ref(database, `${REPORTS_PATH}/${reportId}`)
        const updateData = {
            status,
            updatedAt: Date.now()
        }

        // Track who is working on / resolved the pothole
        if (status === 'progress' && userInfo) {
            updateData.assignedTo = {
                name: userInfo.name || 'Unknown',
                id: userInfo.id || null,
                timestamp: Date.now()
            }
        }
        if (status === 'resolved' && userInfo) {
            updateData.resolvedBy = {
                name: userInfo.name || 'Unknown',
                id: userInfo.id || null,
                timestamp: Date.now()
            }
        }

        await update(reportRef, updateData)
    } catch (error) {
        console.error('Error updating report:', error)
        throw error
    }
}

/**
 * Increment report count (when same location reported again)
 */
export async function incrementReportCountDatabase(reportId, newImageUrl) {
    try {
        const reportRef = ref(database, `${REPORTS_PATH}/${reportId}`)
        const snapshot = await get(reportRef)

        if (snapshot.exists()) {
            const data = snapshot.val()
            await update(reportRef, {
                reportCount: (data.reportCount || 1) + 1,
                images: [...(data.images || []), newImageUrl],
                updatedAt: Date.now()
            })
        }
    } catch (error) {
        console.error('Error incrementing report count:', error)
        throw error
    }
}

/**
 * Delete a report
 */
export async function deleteReportFromDatabase(reportId) {
    try {
        const reportRef = ref(database, `${REPORTS_PATH}/${reportId}`)
        await remove(reportRef)
    } catch (error) {
        console.error('Error deleting report:', error)
        throw error
    }
}
