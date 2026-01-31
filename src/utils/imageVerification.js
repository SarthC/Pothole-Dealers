// Image verification utilities for POFIX
// Checks: Photo age (max 48 hours), GPS extraction, content validation via backend API

import EXIF from 'exif-js'

// Backend API URL
const API_BASE = 'http://localhost:3001'

/**
 * Extract EXIF data from image file
 * @param {File} file - Image file
 * @returns {Promise<{date: Date|null, gps: {lat: number, lng: number}|null}>}
 */
export function extractExifData(file) {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const img = new Image()
            img.onload = () => {
                try {
                    EXIF.getData(img, function () {
                        try {
                            // Extract date
                            const dateStr = EXIF.getTag(this, 'DateTimeOriginal')
                            let date = null
                            if (dateStr) {
                                // Format: "2024:01:30 14:30:00"
                                const [datePart, timePart] = dateStr.split(' ')
                                const [year, month, day] = datePart.split(':')
                                const [hour, min, sec] = timePart.split(':')
                                date = new Date(year, month - 1, day, hour, min, sec)
                            }

                            // Extract GPS
                            let gps = null
                            const latDeg = EXIF.getTag(this, 'GPSLatitude')
                            const latRef = EXIF.getTag(this, 'GPSLatitudeRef')
                            const lngDeg = EXIF.getTag(this, 'GPSLongitude')
                            const lngRef = EXIF.getTag(this, 'GPSLongitudeRef')

                            if (latDeg && lngDeg) {
                                const lat = convertDMSToDD(latDeg[0], latDeg[1], latDeg[2], latRef)
                                const lng = convertDMSToDD(lngDeg[0], lngDeg[1], lngDeg[2], lngRef)
                                gps = { lat, lng }
                            }

                            resolve({ date, gps })
                        } catch (innerError) {
                            console.warn('EXIF parsing error:', innerError)
                            resolve({ date: null, gps: null })
                        }
                    })
                } catch (error) {
                    console.warn('EXIF getData error:', error)
                    resolve({ date: null, gps: null })
                }
            }
            img.onerror = () => {
                resolve({ date: null, gps: null })
            }
            img.src = e.target.result
        }
        reader.onerror = () => {
            resolve({ date: null, gps: null })
        }
        reader.readAsDataURL(file)
    })
}

/**
 * Convert DMS (degrees, minutes, seconds) to Decimal Degrees
 */
function convertDMSToDD(degrees, minutes, seconds, direction) {
    let dd = degrees + minutes / 60 + seconds / 3600
    if (direction === 'S' || direction === 'W') {
        dd = dd * -1
    }
    return dd
}

/**
 * Verify image age is within limit
 * @param {Date} photoDate - Date photo was taken
 * @param {number} maxHours - Maximum allowed age in hours (default 48)
 * @returns {{valid: boolean, warning: boolean, message: string}}
 */
export function verifyImageAge(photoDate, maxHours = 48) {
    if (!photoDate) {
        // Missing EXIF is common when sharing via Gmail/WhatsApp - allow with warning
        return {
            valid: true,  // Changed from false - allow upload
            warning: true,
            message: 'Photo date could not be verified. This may happen if shared via email/messaging apps. Please ensure this is a recent photo.'
        }
    }

    const now = new Date()
    const ageMs = now - photoDate
    const ageHours = ageMs / (1000 * 60 * 60)

    if (ageHours > maxHours) {
        const ageDays = Math.floor(ageHours / 24)
        return {
            valid: false,
            warning: false,
            message: `This photo is ${ageDays} day(s) old. Please upload a photo taken within the last 48 hours.`
        }
    }

    return {
        valid: true,
        warning: false,
        message: 'Photo date verified.'
    }
}

/**
 * Verify image content via backend API (Hugging Face)
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<{valid: boolean, warning: boolean, message: string}>}
 */
export async function verifyImageContent(imageBase64) {
    try {
        const response = await fetch(`${API_BASE}/api/verify-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64 })
        })

        if (!response.ok) {
            throw new Error('API request failed')
        }

        const result = await response.json()
        return {
            valid: result.valid,
            warning: result.warning || false,
            message: result.message || 'Verification complete.'
        }
    } catch (error) {
        console.error('Content verification error:', error)
        return {
            valid: true,
            warning: true,
            message: 'Could not verify image content. Please ensure this shows a pothole.'
        }
    }
}

/**
 * Full image verification pipeline (EXIF only)
 * @param {File} file - Image file
 * @returns {Promise<{valid: boolean, warnings: string[], errors: string[], exifData: Object}>}
 */
export async function verifyImage(file) {
    const result = {
        valid: true,
        warnings: [],
        errors: [],
        exifData: { date: null, gps: null }
    }

    // Step 1: Extract EXIF data
    console.log('🔍 Extracting EXIF data...')
    const exifData = await extractExifData(file)
    result.exifData = exifData
    console.log('📋 EXIF data:', exifData)

    // Step 2: Verify age (requires EXIF date)
    console.log('🔍 Checking photo age...')
    const ageResult = verifyImageAge(exifData.date)
    console.log('📋 Age check result:', ageResult)

    if (!ageResult.valid) {
        result.valid = false
        result.errors.push(ageResult.message)
    } else if (ageResult.warning) {
        result.warnings.push(ageResult.message)
    }

    console.log('📋 Final result:', result)
    return result
}
