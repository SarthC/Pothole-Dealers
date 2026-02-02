// Image verification utilities for POFIX
// Checks: AI content verification using TensorFlow.js MobileNet, GPS extraction

import piexif from 'piexifjs'
import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'

// Cache the model after first load
let cachedModel = null

// Keywords that indicate road/pothole related content (ImageNet classes MobileNet recognizes)
const ROAD_KEYWORDS = [
    // Roads and surfaces
    'road', 'street', 'pavement', 'asphalt', 'concrete', 'gravel', 'stone',
    'highway', 'lane', 'path', 'sidewalk', 'curb', 'manhole', 'gutter',
    'ground', 'floor', 'surface', 'crack', 'hole', 'dirt', 'mud', 'sand',
    // Vehicles (common in road photos)
    'car', 'vehicle', 'wheel', 'tire', 'traffic', 'cab', 'taxi', 'jeep',
    'minivan', 'ambulance', 'bus', 'truck', 'trailer', 'van', 'pickup',
    'motor', 'bicycle', 'bike', 'scooter', 'moped', 'motorcycle',
    // Road infrastructure
    'crosswalk', 'zebra', 'barrier', 'guardrail', 'cone', 'sign', 'pole',
    'light', 'lamp', 'signal', 'parking', 'meter', 'hydrant', 'mailbox',
    // Outdoor general
    'outdoor', 'outside', 'urban', 'city', 'town', 'building', 'bridge',
    'tunnel', 'overpass', 'underpass', 'intersection', 'corner',
    // Common objects near roads
    'bench', 'trash', 'bin', 'fence', 'wall', 'gate', 'shop', 'store'
]

// Keywords that indicate NOT a road photo (should reject these)
const REJECT_KEYWORDS = [
    // People
    'person', 'face', 'people', 'selfie', 'portrait', 'man', 'woman', 'boy', 'girl',
    // Food
    'food', 'meal', 'dish', 'plate', 'pizza', 'burger', 'fruit', 'vegetable', 'cake',
    // Indoor
    'indoor', 'room', 'bedroom', 'kitchen', 'bathroom', 'living', 'office', 'desk',
    // Furniture
    'chair', 'table', 'sofa', 'couch', 'bed', 'cabinet', 'shelf', 'drawer',
    // Animals
    'animal', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'sheep', 'pet',
    // Electronics
    'screen', 'monitor', 'laptop', 'computer', 'phone', 'television', 'tv',
    // Documents, diagrams, screenshots
    'text', 'document', 'paper', 'book', 'magazine', 'newspaper',
    'diagram', 'flowchart', 'chart', 'graph', 'menu', 'web', 'website', 'comic',
    'envelope', 'packet', 'notebook', 'binder', 'folder', 'letter',
    // Nature (not road)
    'flower', 'tree', 'plant', 'forest', 'ocean', 'beach', 'mountain', 'sky', 'cloud',
    // Fictional / Art / Costumes (Fix for Superman/Spiderman)
    'mask', 'costume', 'cape', 'suit', 'helmet', 'uniform', 'jersey',
    'toy', 'doll', 'action figure', 'robot', 'figurine', 'lego',
    'art', 'painting', 'drawing', 'sketch', 'illustration', 'cartoon', 'anime', 'animation',
    'comic', 'poster', 'flyer', 'banner', 'graffiti',
    'space', 'astronaut', 'planet', 'galaxy', 'star', 'rocket',
    'spider', 'web', 'wing', 'monster', 'alien'
]

/**
 * Load MobileNet model (cached)
 */
async function loadModel() {
    if (cachedModel) return cachedModel
    console.log('🤖 Loading MobileNet model...')
    cachedModel = await mobilenet.load()
    console.log('✅ MobileNet model loaded')
    return cachedModel
}

/**
 * Pre-load the MobileNet model in the background
 * Call this when the Report page mounts to eliminate wait time on image upload
 */
export async function preloadModel() {
    try {
        await loadModel()
        console.log('🚀 MobileNet model pre-loaded and ready!')
    } catch (error) {
        console.warn('⚠️ Failed to pre-load model:', error)
    }
}

/**
 * Verify image content using TensorFlow.js MobileNet
 * @param {HTMLImageElement|string} imageSource - Image element or base64 string
 * @returns {Promise<{valid: boolean, confidence: number, message: string, predictions: Array}>}
 */
export async function verifyImageWithAI(imageSource) {
    try {
        // Load model
        const model = await loadModel()

        // Create image element if base64 string provided
        let imgElement = imageSource
        if (typeof imageSource === 'string') {
            imgElement = await createImageElement(imageSource)
        }

        // Run classification
        console.log('🔍 Analyzing image content...')
        const predictions = await model.classify(imgElement)
        console.log('📋 AI Predictions:', predictions)

        // Check predictions against keywords
        let isRoadRelated = false
        let isRejected = false
        let matchedKeyword = ''
        let rejectedKeyword = ''
        let confidence = 0

        for (const prediction of predictions) {
            const label = prediction.className.toLowerCase()

            // Check for rejection keywords first
            for (const keyword of REJECT_KEYWORDS) {
                if (label.includes(keyword) && prediction.probability > 0.05) { // Strict rejection
                    isRejected = true
                    rejectedKeyword = keyword
                    break
                }
            }

            // Check for road-related keywords
            for (const keyword of ROAD_KEYWORDS) {
                if (label.includes(keyword)) {
                    isRoadRelated = true
                    matchedKeyword = keyword
                    confidence = prediction.probability
                    break
                }
            }

            if (isRejected) {
                return {
                    valid: false,
                    confidence: 0,
                    message: `❌ Image rejected: Detected ${rejectedKeyword}. Please upload a clear photo of road damage.`,
                    predictions
                }
            }

            // Check for road-related keywords
            for (const keyword of ROAD_KEYWORDS) {
                if (label.includes(keyword)) {
                    isRoadRelated = true
                    matchedKeyword = keyword
                    confidence = prediction.probability
                    break
                }
            }
        }

        // Determine result

        // Case 1: POSITIVE MATCH - It's definitely a road/pothole
        if (isRoadRelated) {
            return {
                valid: true,
                confidence,
                message: '✅ Image verified',
                predictions
            }
        }

        // Case 2: NO MATCH but NOT REJECTED - Ambiguous (Innocent until proven guilty)
        // MobileNet isn't perfect, so we allow "unknown" images as long as they aren't clearly invalid (like faces/food)
        return {
            valid: true,
            confidence: 0.1,
            message: '✅ Image verified (General Outdoor)',
            predictions
        }

    } catch (error) {
        console.error('AI verification error:', error)
        return {
            valid: false, // Reject on error
            confidence: 0,
            message: '❌ AI verification unavailable. Please use a valid image format.',
            predictions: []
        }
    }
}

/**
 * Create image element from base64 string
 */
function createImageElement(base64) {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = base64
    })
}

/**
 * Extract EXIF data from image file
 * @param {File} file - Image file
 * @returns {Promise<{date: Date|null, gps: {lat: number, lng: number}|null}>}
 */
export function extractExifData(file) {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = function (e) {
            try {
                const dataUrl = e.target.result
                const exifObj = piexif.load(dataUrl)
                console.log('📷 Raw EXIF data:', exifObj)

                if (!exifObj || Object.keys(exifObj).length === 0) {
                    console.log('📷 No EXIF data found in image')
                    resolve({ date: null, gps: null })
                    return
                }

                // Extract date from EXIF
                let date = null
                const exifData = exifObj['Exif'] || {}
                const dateTag = exifData[piexif.ExifIFD.DateTimeOriginal] || exifData[piexif.ExifIFD.DateTimeDigitized]
                if (dateTag) {
                    console.log('📅 Found date string:', dateTag)
                    const [datePart, timePart] = dateTag.split(' ')
                    const [year, month, day] = datePart.split(':')
                    const [hour, min, sec] = timePart ? timePart.split(':') : [0, 0, 0]
                    date = new Date(year, month - 1, day, hour, min, sec)
                }

                // Extract GPS
                let gps = null
                const gpsData = exifObj['GPS'] || {}
                console.log('📍 GPS Data object:', gpsData)

                const latDeg = gpsData[piexif.GPSIFD.GPSLatitude]
                const latRef = gpsData[piexif.GPSIFD.GPSLatitudeRef]
                const lngDeg = gpsData[piexif.GPSIFD.GPSLongitude]
                const lngRef = gpsData[piexif.GPSIFD.GPSLongitudeRef]

                console.log('📍 Raw GPS values:', { latDeg, latRef, lngDeg, lngRef })

                if (latDeg && lngDeg) {
                    try {
                        // piexif returns GPS as [[num, denom], [num, denom], [num, denom]]
                        let lat, lng

                        // Check if it's in rational format [num, denom] or just numbers
                        if (Array.isArray(latDeg[0])) {
                            // Rational format: [[deg_num, deg_denom], [min_num, min_denom], [sec_num, sec_denom]]
                            lat = convertDMSToDD(
                                latDeg[0][0] / latDeg[0][1],
                                latDeg[1][0] / latDeg[1][1],
                                latDeg[2][0] / latDeg[2][1],
                                latRef
                            )
                            lng = convertDMSToDD(
                                lngDeg[0][0] / lngDeg[0][1],
                                lngDeg[1][0] / lngDeg[1][1],
                                lngDeg[2][0] / lngDeg[2][1],
                                lngRef
                            )
                        } else {
                            // Simple array format: [deg, min, sec]
                            lat = convertDMSToDD(latDeg[0], latDeg[1], latDeg[2], latRef)
                            lng = convertDMSToDD(lngDeg[0], lngDeg[1], lngDeg[2], lngRef)
                        }

                        console.log('📍 Calculated coordinates:', { lat, lng })
                        if (!isNaN(lat) && !isNaN(lng)) {
                            gps = { lat, lng }
                        }
                    } catch (gpsError) {
                        console.warn('GPS parsing error:', gpsError)
                    }
                }

                console.log('📋 Extracted EXIF:', { date, gps })
                resolve({ date, gps })
            } catch (error) {
                console.warn('EXIF parsing error:', error)
                resolve({ date: null, gps: null })
            }
        }
        reader.onerror = () => {
            console.warn('FileReader error')
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
 * Full image verification pipeline
 * Uses AI to verify image content, and EXIF for GPS extraction
 * @param {File} file - Image file
 * @returns {Promise<{valid: boolean, warnings: string[], errors: string[], exifData: Object, aiResult: Object}>}
 */
export async function verifyImage(file) {
    const result = {
        valid: true,
        warnings: [],
        errors: [],
        exifData: { date: null, gps: null },
        aiResult: null
    }

    // Step 1: Extract EXIF data (optional - will fallback to device GPS if not available)
    console.log('🔍 Extracting EXIF data...')
    const exifData = await extractExifData(file)
    result.exifData = exifData
    console.log('📋 EXIF data:', exifData)

    // Flag to indicate if we need device GPS
    result.requireDeviceGps = !exifData.gps

    // Optional: Check 48-hour limit if EXIF date is available
    if (exifData.date) {
        const now = new Date()
        const hoursDiff = (now - exifData.date) / (1000 * 60 * 60)
        console.log(`📅 Image age: ${hoursDiff.toFixed(1)} hours`)

        if (hoursDiff > 48) {
            result.valid = false
            result.errors.push(`❌ Photo is ${Math.round(hoursDiff)} hours old. Only photos taken within the last 48 hours are accepted.`)
            return result
        }
    }

    // Step 2: AI-based content verification (Is it a pothole/road image?) - REQUIRED
    console.log('🤖 Running AI verification...')
    const base64 = await fileToBase64(file)
    const aiResult = await verifyImageWithAI(base64)
    result.aiResult = aiResult
    console.log('📋 AI result:', aiResult)

    if (!aiResult.valid) {
        result.valid = false
        result.errors.push(aiResult.message)
        return result
    }

    console.log('✅ AI verification passed!')
    console.log('📋 Final verification result:', result)
    return result
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}
