// Image verification utilities for POFIX
// Checks: AI content verification using TensorFlow.js MobileNet, GPS extraction

import EXIF from 'exif-js'
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
    'flower', 'tree', 'plant', 'forest', 'ocean', 'beach', 'mountain', 'sky', 'cloud'
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

    // Step 1: Extract EXIF data
    console.log('🔍 Extracting EXIF data...')
    const exifData = await extractExifData(file)
    result.exifData = exifData
    console.log('📋 EXIF data:', exifData)

    // STRICT CHECK REMOVED: Allow images without EXIF to proceed (fallback to device GPS)
    // if (!exifData.date && !exifData.gps) { ... }

    // Step 2: AI-based content verification
    console.log('🤖 Running AI verification...')
    const base64 = await fileToBase64(file)
    const aiResult = await verifyImageWithAI(base64)
    result.aiResult = aiResult
    console.log('📋 AI result:', aiResult)

    if (!aiResult.valid) {
        result.valid = false
        result.errors.push(aiResult.message)
    } else if (aiResult.confidence < 0.5) {
        // Just a warning if low confidence but matched
        // result.warnings.push(aiResult.message)
    }

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
