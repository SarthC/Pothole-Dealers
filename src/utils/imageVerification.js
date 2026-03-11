// Image verification utilities for POFIX
// Checks: AI content verification using TensorFlow.js MobileNet, GPS extraction

// Import ExifReader
import ExifReader from 'exifreader'

/**
 * Extract EXIF data from image file using ExifReader
 * @param {File} file - Image file
 * @returns {Promise<{date: Date|null, gps: {lat: number, lng: number}|null}>}
 */
export async function extractExifData(file) {
    try {
        // ExifReader.load returns a Promise in newer versions or can be awaited
        const tags = await ExifReader.load(file)
        console.log('📷 ExifReader Tags:', tags)

        if (!tags) return { date: null, gps: null }

        // Extract Date
        let date = null
        // DateTimeOriginal is preferred
        const dateTag = tags['DateTimeOriginal'] || tags['DateTimeDigitized'] || tags['DateTime']
        if (dateTag && dateTag.description) {
            // Format: "YYYY:MM:DD HH:MM:SS"
            const dateStr = dateTag.description
            console.log('📅 Found date string:', dateStr)
            const [datePart, timePart] = dateStr.split(' ')
            if (datePart && timePart) {
                const [year, month, day] = datePart.split(':')
                const [hour, min, sec] = timePart.split(':')
                date = new Date(year, month - 1, day, hour, min, sec)
            }
        }

        // Extract GPS
        let gps = null
        if (tags['GPSLatitude'] && tags['GPSLongitude']) {
            try {
                let lat = null
                let lng = null

                // Method 1: Use ExifReader's 'description' field (already decimal degrees)
                const latDesc = tags['GPSLatitude'].description
                const lngDesc = tags['GPSLongitude'].description
                const latRef = tags['GPSLatitudeRef'] ? (tags['GPSLatitudeRef'].value || tags['GPSLatitudeRef'].description || '') : ''
                const lngRef = tags['GPSLongitudeRef'] ? (tags['GPSLongitudeRef'].value || tags['GPSLongitudeRef'].description || '') : ''

                // Get the reference direction (N/S/E/W)
                const latDirection = (typeof latRef === 'string' ? latRef : (Array.isArray(latRef) ? latRef[0] : '')).toString().toUpperCase()
                const lngDirection = (typeof lngRef === 'string' ? lngRef : (Array.isArray(lngRef) ? lngRef[0] : '')).toString().toUpperCase()

                if (latDesc !== undefined && lngDesc !== undefined) {
                    lat = parseFloat(latDesc)
                    lng = parseFloat(lngDesc)
                    console.log('📍 Using description values:', { lat, lng, latDirection, lngDirection })
                }

                // Method 2: Manual DMS conversion from 'value' array
                if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
                    const latRaw = tags['GPSLatitude'].value
                    const lngRaw = tags['GPSLongitude'].value

                    const getFloat = (val) => {
                        if (typeof val === 'number') return val
                        if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'number' && typeof val[1] === 'number' && val[1] !== 0) {
                            return val[0] / val[1]
                        }
                        if (Array.isArray(val) && val.length === 1) return getFloat(val[0])
                        if (typeof val === 'object' && val !== null && 'value' in val) return val.value
                        return parseFloat(val) || 0
                    }

                    const convertToDd = (coords) => {
                        if (!Array.isArray(coords) || coords.length < 3) return null
                        const d = getFloat(coords[0])
                        const m = getFloat(coords[1])
                        const s = getFloat(coords[2])
                        return d + m / 60 + s / 3600
                    }

                    lat = convertToDd(latRaw)
                    lng = convertToDd(lngRaw)
                    console.log('📍 Using DMS conversion:', { lat, lng })
                }

                // Apply direction reference
                if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
                    if (latDirection === 'S') lat = Math.abs(lat) * -1
                    if (lngDirection === 'W') lng = Math.abs(lng) * -1

                    // Sanity check: valid coordinate ranges
                    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && (lat !== 0 || lng !== 0)) {
                        gps = { lat, lng }
                        console.log('📍 Final GPS coordinates:', gps)
                    } else {
                        console.warn('📍 GPS coordinates out of valid range:', { lat, lng })
                    }
                }
            } catch (err) {
                console.warn('GPS Calculation Error:', err)
            }
        }

        return { date, gps }

    } catch (error) {
        console.warn('ExifReader parsing error:', error)
        return { date: null, gps: null }
    }
}

// Helper removed as logic is inline
// function convertDMSToDD... removed
import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'

// Cache the model after first load
let cachedModel = null

// Keywords that indicate road/pothole related content (ground-level, close-up)
const ROAD_KEYWORDS = [
    // Roads and surfaces - close-up / ground level
    'road', 'street', 'pavement', 'asphalt', 'concrete', 'gravel', 'stone',
    'lane', 'path', 'sidewalk', 'curb', 'manhole', 'gutter',
    'ground', 'floor', 'surface', 'crack', 'hole', 'dirt', 'mud', 'sand',
    // Vehicles (common in road photos)
    'car', 'vehicle', 'wheel', 'tire', 'traffic', 'cab', 'taxi', 'jeep',
    'minivan', 'ambulance', 'bus', 'truck', 'trailer', 'van', 'pickup',
    'motor', 'bicycle', 'bike', 'scooter', 'moped', 'motorcycle',
    // Road infrastructure close-up
    'crosswalk', 'zebra', 'barrier', 'guardrail', 'cone', 'sign',
    'parking', 'meter', 'hydrant', 'mailbox',
    // Common objects near roads
    'bench', 'trash', 'bin', 'fence', 'wall', 'gate'
]

// Keywords that indicate a WIDE/SCENIC road view (not a pothole close-up)
const SCENIC_KEYWORDS = [
    'highway', 'freeway', 'expressway', 'overpass', 'viaduct',
    'bridge', 'tunnel', 'underpass', 'intersection',
    'lakeside', 'valley', 'seashore', 'promontory', 'alp',
    'pier', 'breakwater', 'dam', 'castle', 'palace', 'church',
    'monastery', 'mosque', 'stupa', 'fountain', 'boathouse',
    'dome', 'barn', 'greenhouse', 'beacon', 'lighthouse'
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
    'diagram', 'flowchart', 'chart', 'graph', 'menu', 'website', 'comic',
    'envelope', 'packet', 'notebook', 'binder', 'folder', 'letter',
    // Nature (not road)
    'flower', 'plant', 'forest', 'ocean', 'beach', 'mountain',
    // Fictional / Art / Costumes
    'mask', 'costume', 'cape', 'helmet', 'uniform', 'jersey',
    'toy', 'doll', 'action figure', 'robot', 'figurine', 'lego',
    'art', 'painting', 'drawing', 'sketch', 'illustration', 'cartoon', 'anime', 'animation',
    'comic', 'poster', 'flyer', 'banner', 'graffiti',
    'space', 'astronaut', 'planet', 'galaxy', 'star', 'rocket',
    'spider', 'wing', 'monster', 'alien'
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

        // Analyze predictions against keyword lists
        let isRoadRelated = false
        let isScenicRoad = false
        let isRejected = false
        let matchedKeyword = ''
        let confidence = 0

        for (const prediction of predictions) {
            const label = prediction.className.toLowerCase()

            // Check for rejection keywords (strict)
            for (const keyword of REJECT_KEYWORDS) {
                if (label.includes(keyword) && prediction.probability > 0.05) {
                    isRejected = true
                    break
                }
            }
            if (isRejected) break

            // Check for scenic/wide road keywords
            for (const keyword of SCENIC_KEYWORDS) {
                if (label.includes(keyword) && prediction.probability > 0.1) {
                    isScenicRoad = true
                    break
                }
            }

            // Check for road-related keywords (ground-level)
            for (const keyword of ROAD_KEYWORDS) {
                if (label.includes(keyword)) {
                    isRoadRelated = true
                    matchedKeyword = keyword
                    confidence = prediction.probability
                    break
                }
            }
        }

        // Decision logic:

        // Case 1: Clearly NOT a road image
        if (isRejected) {
            return {
                valid: false,
                confidence: 0,
                message: 'Uploaded image is not a pothole. Please upload a valid pothole image.',
                predictions
            }
        }

        // Case 2: Scenic/wide road view (no visible pothole)
        if (isScenicRoad) {
            return {
                valid: false,
                confidence: 0,
                message: 'Image appears to be a wide road view. Please take a closer photo of the actual pothole.',
                predictions
            }
        }

        // Case 3: Road-related close-up (likely pothole)
        if (isRoadRelated) {
            return {
                valid: true,
                confidence,
                message: '✅ Image verified',
                predictions
            }
        }

        // Case 4: Ambiguous - not clearly road or rejected
        // MobileNet can't classify close-up ground textures well, so accept ambiguous images
        return {
            valid: true,
            confidence: 0.1,
            message: '✅ Image verified',
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

    // Step 1b: Check 48-hour freshness limit
    // Use EXIF date if available, otherwise fall back to file's lastModified timestamp
    const imageDate = exifData.date || (file.lastModified ? new Date(file.lastModified) : null)

    if (imageDate) {
        const now = new Date()
        const hoursDiff = (now - imageDate) / (1000 * 60 * 60)
        console.log(`📅 Image age: ${hoursDiff.toFixed(1)} hours (source: ${exifData.date ? 'EXIF' : 'file lastModified'})`)

        if (hoursDiff > 48) {
            result.valid = false
            result.errors.push(`Photo is ${Math.round(hoursDiff)} hours old. Only photos taken within the last 48 hours are accepted.`)
            return result
        }
    } else {
        // No date info at all — warn but allow
        result.warnings.push('Could not determine image date. Please use a recent photo.')
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
