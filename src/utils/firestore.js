// Firestore database utility for pothole reports
import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    GeoPoint
} from 'firebase/firestore'
import { db } from './firebase'

const REPORTS_COLLECTION = 'pothole_reports'

/**
 * Save a new pothole report to Firestore
 */
export async function saveReportToFirestore(report) {
    try {
        const docRef = await addDoc(collection(db, REPORTS_COLLECTION), {
            ...report,
            location: report.location?.lat ? new GeoPoint(report.location.lat, report.location.lng) : null,
            locationAddress: report.location?.address || '',
            reportCount: 1,
            status: 'pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        })

        return { id: docRef.id, ...report }
    } catch (error) {
        console.error('Error saving report:', error)
        throw error
    }
}

/**
 * Get all reports from Firestore
 */
export async function getReportsFromFirestore() {
    try {
        const q = query(
            collection(db, REPORTS_COLLECTION),
            orderBy('createdAt', 'desc')
        )

        const snapshot = await getDocs(q)

        return snapshot.docs.map(doc => {
            const data = doc.data()
            return {
                id: doc.id,
                ...data,
                location: data.location ? {
                    lat: data.location.latitude,
                    lng: data.location.longitude,
                    address: data.locationAddress
                } : null,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
            }
        })
    } catch (error) {
        console.error('Error getting reports:', error)
        throw error
    }
}

/**
 * Update report status in Firestore
 */
export async function updateReportStatusFirestore(reportId, status) {
    try {
        const docRef = doc(db, REPORTS_COLLECTION, reportId)
        await updateDoc(docRef, {
            status,
            updatedAt: serverTimestamp()
        })
    } catch (error) {
        console.error('Error updating report:', error)
        throw error
    }
}

/**
 * Increment report count (when same location reported again)
 */
export async function incrementReportCount(reportId, newImageUrl) {
    try {
        const docRef = doc(db, REPORTS_COLLECTION, reportId)
        const currentDoc = await getDocs(query(collection(db, REPORTS_COLLECTION), where('__name__', '==', reportId)))

        if (!currentDoc.empty) {
            const data = currentDoc.docs[0].data()
            await updateDoc(docRef, {
                reportCount: (data.reportCount || 1) + 1,
                images: [...(data.images || []), newImageUrl],
                updatedAt: serverTimestamp()
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
export async function deleteReportFromFirestore(reportId) {
    try {
        await deleteDoc(doc(db, REPORTS_COLLECTION, reportId))
    } catch (error) {
        console.error('Error deleting report:', error)
        throw error
    }
}
