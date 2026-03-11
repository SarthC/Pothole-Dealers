import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveReportToDatabase } from '../utils/realtimeDb'
import { uploadPotholeImage, compressImage } from '../utils/imageUpload'
import { verifyImageWithAI, extractExifData, preloadModel } from '../utils/imageVerification'
import MapPicker from '../components/MapPicker'
import Stepper, { Step } from '../components/Stepper'
import './Report.css'

// Compress image to base64 (max 200KB)
async function compressImageToBase64(file, maxWidth = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > maxWidth) {
                    height = (height * maxWidth) / width
                    width = maxWidth
                }

                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0, width, height)

                const base64 = canvas.toDataURL('image/jpeg', quality)
                resolve(base64)
            }
            img.onerror = reject
            img.src = event.target.result
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

function Report() {
    const { user, isAuthenticated } = useAuth()
    const navigate = useNavigate()
    const fileInputRef = useRef(null)
    const previewImgRef = useRef(null)

    const [formData, setFormData] = useState({
        imageUrl: '',
        imageFile: null,
        location: { lat: null, lng: null, address: '' },
        severity: 'medium',
        roadType: 'city',
        description: '',
        reporterName: ''
    })

    const [preview, setPreview] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showMap, setShowMap] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [gpsLoading, setGpsLoading] = useState(false) // For manual GPS button

    // Stepper State
    const [currentStep, setCurrentStep] = useState(1)

    // Verification state
    const [verifying, setVerifying] = useState(false)
    const [verificationResult, setVerificationResult] = useState(null)
    const [locationFromPhoto, setLocationFromPhoto] = useState(false)
    const [gpsError, setGpsError] = useState(null) // GPS error message
    const [statusMessage, setStatusMessage] = useState('')

    // Webcam State & Refs
    const [showCamera, setShowCamera] = useState(false)
    const videoRef = useRef(null)
    const streamRef = useRef(null)

    const startCamera = async () => {
        try {
            setShowCamera(true)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            })
            // Small delay to ensure modal is rendered and ref is attached
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    streamRef.current = stream
                }
            }, 100)
        } catch (err) {
            console.error("Camera error:", err)
            alert("Could not access camera. Please check permissions or use Upload instead.")
            setShowCamera(false)
        }
    }

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
        }
        setShowCamera(false)
    }

    const capturePhoto = () => {
        if (!videoRef.current) return

        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(videoRef.current, 0, 0)

        canvas.toBlob(blob => {
            const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" })
            processImageFile(file, true) // Treat as camera source
            stopCamera()
        }, 'image/jpeg')
    }

    // Pre-load MobileNet model when page loads (eliminates wait on image upload)
    useEffect(() => {
        preloadModel()
    }, [])

    // Helper: Get device GPS location
    const getDeviceLocation = () => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                setGpsError('❌ Browser does not support geolocation.')
                setVerificationResult(prev => ({
                    ...prev,
                    valid: false,
                    errors: [...(prev?.errors || []), '❌ Geolocation not supported.']
                }))
                setVerifying(false)
                resolve(false)
                return
            }

            setGpsLoading(true)
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords
                    console.log('📍 Device GPS acquired:', latitude, longitude)
                    setStatusMessage('Location found! Fetching address...')

                    // Reverse Geocode
                    let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                    try {
                        // Nominatim requires a user-agent or email to prevent 429 blocks. Added email parameter.
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&email=pofix.app.contact@gmail.com`
                        )
                        const data = await response.json()
                        if (data.display_name) address = data.display_name
                    } catch (e) {
                        console.warn('Reverse geocoding failed (Rate limit or CORS)', e)
                    }

                    setFormData(prev => ({
                        ...prev,
                        location: { lat: latitude, lng: longitude, address }
                    }))
                    setVerificationResult(prev => ({
                        ...(prev || {}),
                        valid: true
                    }))
                    setLocationFromPhoto(true)
                    setGpsLoading(false)
                    setVerifying(false)
                    setTimeout(() => setCurrentStep(2), 800)
                    resolve(true)
                },
                (error) => {
                    console.error('Using Current device location as Problem in fetching location from image', error)
                    setGpsLoading(false)
                    setGpsError('❌ Location access denied. Please enable location permissions.')
                    setVerificationResult(prev => ({
                        ...prev,
                        valid: false,
                        errors: [...(prev?.errors || []), '❌ Location access denied.']
                    }))
                    setVerifying(false)
                    resolve(false)
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            )
        })
    }

    // Helper: Use EXIF GPS coordinates
    const useExifGps = async (gps) => {
        const { lat, lng } = gps
        console.log('📍 Using EXIF GPS:', lat, lng)
        setStatusMessage('Location found! Fetching address...')

        let address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        try {
            // Nominatim requires a user-agent or email to prevent 429 blocks. Added email parameter.
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&email=pofix.app.contact@gmail.com`
            )
            const data = await response.json()
            if (data.display_name) address = data.display_name
        } catch (e) {
            console.warn('Reverse geocoding failed (Rate limit or CORS)', e)
        }

        setFormData(prev => ({
            ...prev,
            location: { lat, lng, address }
        }))
        setLocationFromPhoto(true)
        setVerifying(false)
        setTimeout(() => setCurrentStep(2), 800)
    }

    // Unified image processing function (works for both file input and webcam)
    const processImageFile = async (file, isFromCamera) => {
        // Reset states
        setVerifying(true)
        setVerificationResult(null)
        setLocationFromPhoto(false)
        setGpsError(null)
        setStatusMessage('Platform is verifying your image...')

        // 🧠 GPS PRE-WARMING TRICK:
        // Turn on the GPS hardware in the background immediately while AI runs.
        // This gives the device an extra 2-3 seconds to lock onto satellites, 
        // leading to a significantly more accurate location when getDeviceLocation() is called later.
        if (navigator.geolocation && (isFromCamera || !file.name.includes('exif'))) {
            navigator.geolocation.getCurrentPosition(
                () => console.log('📍 GPS hardware pre-warmed'),
                () => { },
                { enableHighAccuracy: true, maximumAge: 0 }
            )
        }

        // Read file as base64
        const reader = new FileReader()
        reader.onloadend = async () => {
            const base64Data = reader.result
            setPreview(base64Data)
            setFormData(prev => ({
                ...prev,
                imageUrl: base64Data,
                imageFile: file
            }))

            try {
                // Step 1: AI Verification
                // Small delay for UX so user sees the message
                await new Promise(r => setTimeout(r, 600))

                const aiResult = await verifyImageWithAI(base64Data)
                if (!aiResult.valid) {
                    setVerificationResult({
                        valid: false,
                        errors: [aiResult.message],
                        aiResult
                    })
                    setVerifying(false)
                    return
                }

                // Step 2: Get Location
                setStatusMessage('Platform is detecting location...')
                await new Promise(r => setTimeout(r, 1500)) // Give the pre-warmed GPS extra time to lock

                if (isFromCamera) {
                    // CAMERA: Always use device GPS
                    console.log('📍 Camera/Webcam photo - using Device GPS directly')
                    await getDeviceLocation()
                } else {
                    // GALLERY: Try EXIF GPS first, fallback to device GPS
                    console.log('📍 Gallery photo - trying EXIF GPS first')
                    const exifData = await extractExifData(file)

                    // Check Photo Age (48h limit) - use EXIF date or file lastModified as fallback
                    const imageDate = exifData.date || (file.lastModified ? new Date(file.lastModified) : null)
                    if (imageDate) {
                        const now = new Date()
                        const hoursDiff = (now - imageDate) / (1000 * 60 * 60)
                        if (hoursDiff > 48) {
                            setVerificationResult({
                                valid: false,
                                errors: [`Photo is ${Math.round(hoursDiff)} hours old. Only photos taken within the last 48 hours are accepted.`]
                            })
                            setVerifying(false)
                            return
                        }
                    }

                    const result = {
                        valid: true,
                        exifData,
                        aiResult
                    }
                    setVerificationResult(result)

                    if (exifData?.gps && !isNaN(exifData.gps.lat) && !isNaN(exifData.gps.lng)) {
                        // EXIF GPS found - use it
                        await useExifGps(exifData.gps)
                    } else {
                        // No EXIF GPS - fallback to device GPS
                        console.log('📷 No GPS in EXIF. Fallback to Device GPS...')
                        setStatusMessage('No GPS in photo. Using device location...')
                        await getDeviceLocation()
                    }
                }
            } catch (error) {
                console.error('Verification error:', error)
                setVerificationResult({
                    valid: false,
                    errors: ['Could not verify image. Please try again.']
                })
                setVerifying(false)
            }
        }
        reader.readAsDataURL(file)
    }

    // Unified handler for file inputs (camera/gallery)
    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Check if this came from camera input (has capture attribute) or gallery
        const isFromCamera = e.target.hasAttribute('capture')
        console.log('📸 Upload source:', isFromCamera ? 'Camera' : 'Gallery')

        await processImageFile(file, isFromCamera)
    }



    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser')
            return
        }

        setGpsLoading(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&email=pofix.app.contact@gmail.com`,
                        { headers: { 'Accept-Language': 'en' } }
                    )
                    const data = await response.json()

                    setFormData(prev => ({
                        ...prev,
                        location: {
                            lat: latitude,
                            lng: longitude,
                            address: data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                        }
                    }))
                } catch (e) {
                    console.warn('Reverse geocoding failed (Rate limit or CORS)', e)
                    setFormData(prev => ({
                        ...prev,
                        location: {
                            lat: latitude,
                            lng: longitude,
                            address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                        }
                    }))
                }
                setGpsLoading(false)
            },
            (error) => {
                console.error('GPS Error:', error)
                alert('Unable to retrieve your location')
                setGpsLoading(false)
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        )
    }

    const handleMapSelect = (location) => {
        setFormData(prev => ({ ...prev, location }))
        setShowMap(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.imageFile) {
            alert('Please upload an image of the pothole')
            return
        }

        // Block if verification failed
        if (verificationResult && !verificationResult.valid) {
            const errorDetails = verificationResult.errors?.join('\n') || 'Please upload a valid, recent photo of a pothole.'
            alert(`Image verification failed:\n\n${errorDetails}`)
            return
        }

        if (!formData.location.lat && !formData.location.address) {
            alert('Please provide a location')
            return
        }

        setIsSubmitting(true)

        try {
            // Compress image aggressively before storing as base64 in RTDB
            // (avoids Firebase Storage CORS issues on localhost)
            const compressedBase64 = await compressImageToBase64(formData.imageFile, 500, 0.5)
            console.log('✅ Image compressed to base64')

            const report = {
                imageUrl: compressedBase64,
                location: formData.location,
                severity: formData.severity,
                roadType: formData.roadType,
                description: formData.description,
                reporterName: formData.reporterName || user?.displayName || 'Anonymous',
                reporterEmail: user?.email || 'anonymous@pofix.app',
                reporterPhoto: user?.photoURL || null
            }

            // Save to Firebase Realtime Database
            await saveReportToDatabase(report)
            console.log('✅ Report saved to Firebase!')

            setSubmitted(true)
        } catch (error) {
            console.error('Submit error:', error)
            alert('Failed to submit report: ' + error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="report-page">
                <div className="container">
                    <div className="auth-prompt">
                        <h2>Sign in to Report</h2>
                        <p>You need to be signed in to submit pothole reports.</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn btn-primary btn-lg"
                        >
                            Sign In
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="report-page">
                <div className="container">
                    <div className="success-message">
                        <div className="success-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        <h2>Report Submitted!</h2>
                        <p>Thank you for helping make roads safer. Your report has been saved.</p>
                        <div className="success-actions">
                            <button
                                onClick={() => {
                                    setSubmitted(false)
                                    setFormData({
                                        imageUrl: '',
                                        imageFile: null,
                                        location: { lat: null, lng: null, address: '' },
                                        severity: 'medium',
                                        roadType: 'city',
                                        description: '',
                                        reporterName: ''
                                    })
                                    setPreview(null)
                                    setVerificationResult(null)
                                    setGpsError(null)
                                    setLocationFromPhoto(false)
                                }}
                                className="btn btn-primary"
                            >
                                Report Another
                            </button>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="btn btn-secondary"
                            >
                                View Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="report-page">
            <div className="container">
                <div className="report-header">
                    <h1>Report a Pothole</h1>
                    <p>Help fix roads by reporting potholes in your area</p>
                </div>

                <form onSubmit={handleSubmit} className="report-form">
                    <Stepper
                        activeStep={currentStep}
                        initialStep={1}
                        layout="split"
                        footerClassName="hidden" // We use custom buttons in steps
                        stepCircleContainerClassName="shadow-lg border-none bg-zinc-900"
                        contentClassName="min-h-[300px]"
                    >
                        {/* STEP 1: Image Verification */}
                        <Step>
                            <div className="form-section pt-0 border-none">
                                <h3 className="text-center mb-6">1. Image & Pothole Verification</h3>

                                {/* Image Preview Area */}
                                {preview && (
                                    <div className="image-upload has-image">
                                        <img ref={previewImgRef} src={preview} alt="Pothole preview" className="image-preview" crossOrigin="anonymous" />
                                    </div>
                                )}

                                {/* Camera and Gallery Buttons */}
                                {!preview && (
                                    <div className="upload-buttons">
                                        <button
                                            type="button"
                                            className="btn btn-primary upload-btn"
                                            onClick={startCamera}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                            </svg>
                                            Take Photo
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-secondary upload-btn"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <path d="M21 15l-5-5L5 21" />
                                            </svg>
                                            Upload from Gallery
                                        </button>
                                    </div>
                                )}

                                {preview && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary center-btn"
                                        onClick={() => {
                                            setPreview(null)
                                            setVerificationResult(null)
                                            setGpsError(null)
                                            setLocationFromPhoto(false)
                                            setFormData(prev => ({ ...prev, imageUrl: '', imageFile: null, location: { lat: null, lng: null, address: '' } }))
                                        }}
                                        style={{ marginTop: '1rem', width: '100%' }}
                                    >
                                        Change Photo
                                    </button>
                                )}

                                {/* Verification Status - Show while verifying */}
                                {verifying && (
                                    <div className="verification-status verifying" style={{ marginTop: '1rem' }}>
                                        <span className="spinner"></span> {statusMessage || 'Verifying image...'}
                                    </div>
                                )}

                                <p className="upload-hint" style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    📷 Must contain GPS data. AI will verify pothole.
                                </p>

                                {/* Hidden file inputs */}
                                <input
                                    type="file"
                                    id="camera-input"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handleImageUpload}
                                    style={{ display: 'none' }}
                                />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />

                                {/* Verification Feedback (Errors/Success) */}
                                {verificationResult && !verifying && (
                                    <div className={`verification-status ${verificationResult.valid ? 'valid' : 'invalid'}`}>
                                        {verificationResult.errors?.map((err, i) => (
                                            <div key={i} className="verification-error">❌ {err}</div>
                                        ))}
                                        {verificationResult.valid && (
                                            <div className="verification-success">✅ AI Verified: Valid Pothole</div>
                                        )}
                                    </div>
                                )}

                                {locationFromPhoto && (
                                    <div className="verification-status valid">
                                        📍 GPS Data Found (Proceeding...)
                                    </div>
                                )}
                            </div>
                        </Step>

                        {/* STEP 2: Location Verification */}
                        <Step>
                            <div className="form-section pt-0 border-none">
                                <h3 className="text-center mb-6">2. EXIF & Location Verification</h3>

                                <div className="verification-status valid">
                                    ✅ EXIF Data Verified <br />
                                    ✅ GPS Coordinates Extracted
                                </div>

                                {formData.location.lat ? (
                                    <>
                                        <div className="coordinates" style={{ display: 'block', textAlign: 'center', marginTop: '1rem' }}>
                                            <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📍 Location Detected</div>
                                            <span>{formData.location.lat.toFixed(6)}, {formData.location.lng.toFixed(6)}</span>
                                        </div>

                                        <div className="input-group" style={{ marginTop: '1.5rem' }}>
                                            <label className="input-label">Address / Landmark</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="Enter address or landmark..."
                                                value={formData.location.address}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    location: { ...prev.location, address: e.target.value }
                                                }))}
                                            />
                                        </div>

                                        <div className="location-correction">
                                            <p className="correction-hint" style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                                Wrong location? Search your address or correct on map:
                                            </p>
                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    placeholder="Search address (e.g. MG Road, Pune)"
                                                    id="manual-address-search"
                                                    style={{ flex: 1 }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            document.getElementById('search-address-btn').click()
                                                        }
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    id="search-address-btn"
                                                    className="btn btn-primary btn-sm"
                                                    style={{ whiteSpace: 'nowrap' }}
                                                    onClick={async () => {
                                                        const query = document.getElementById('manual-address-search').value.trim()
                                                        if (!query) return
                                                        try {
                                                            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1&email=pofix.app.contact@gmail.com`)
                                                            const data = await res.json()
                                                            if (data && data.length > 0) {
                                                                const { lat, lon, display_name } = data[0]
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    location: {
                                                                        lat: parseFloat(lat),
                                                                        lng: parseFloat(lon),
                                                                        address: display_name
                                                                    }
                                                                }))
                                                            } else {
                                                                alert('Address not found. Please try a different search.')
                                                            }
                                                        } catch {
                                                            alert('Search failed. Please try again.')
                                                        }
                                                    }}
                                                >
                                                    🔍 Search
                                                </button>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowMap(true)}
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    📌 Pick on Map
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={async () => {
                                                        setStatusMessage('Re-detecting location...')
                                                        await getDeviceLocation()
                                                    }}
                                                >
                                                    📍 Re-detect GPS
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn btn-primary w-full"
                                            style={{ marginTop: '2rem' }}
                                            onClick={() => setCurrentStep(3)}
                                        >
                                            Confirm Location & Continue
                                        </button>
                                    </>
                                ) : (
                                    <div className="verification-status invalid">
                                        ❌ Error: No Location Data. Please go back and retry.
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-ghost w-full"
                                    style={{ marginTop: '0.5rem' }}
                                    onClick={() => setCurrentStep(1)}
                                >
                                    Back to Photo
                                </button>
                            </div>
                        </Step>

                        {/* STEP 3: Reporter Info */}
                        <Step>
                            <div className="form-section pt-0 border-none">
                                <h3 className="text-center mb-6">3. Reporter Details</h3>

                                <div className="input-group">
                                    <label className="input-label">Your Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="Enter your name..."
                                        value={formData.reporterName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reporterName: e.target.value }))}
                                        required
                                    />
                                </div>

                                <div className="form-row" style={{ marginTop: '1rem' }}>
                                    <div className="input-group">
                                        <label className="input-label">Severity</label>
                                        <select
                                            className="input-field"
                                            value={formData.severity}
                                            onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                                        >
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Road Type</label>
                                        <select
                                            className="input-field"
                                            value={formData.roadType}
                                            onChange={(e) => setFormData(prev => ({ ...prev, roadType: e.target.value }))}
                                        >
                                            <option value="city">City Road</option>
                                            <option value="residential">Residential</option>
                                            <option value="highway">Highway</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="input-group" style={{ marginTop: '1rem' }}>
                                    <label className="input-label">Description (Optional)</label>
                                    <textarea
                                        className="input-field"
                                        placeholder="Details..."
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                        rows={2}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    style={{ marginTop: '2rem' }}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Report'}
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-ghost w-full"
                                    style={{ marginTop: '0.5rem' }}
                                    onClick={() => setCurrentStep(2)}
                                    disabled={isSubmitting}
                                >
                                    Back
                                </button>
                            </div>
                        </Step>
                    </Stepper>



                    {/* Camera Modal Overlay */}
                    {showCamera && (
                        <div className="camera-modal" style={{
                            position: 'fixed',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: '#000',
                            zIndex: 9999,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            ></video>

                            <div className="camera-controls" style={{
                                position: 'absolute',
                                bottom: '2rem',
                                left: 0,
                                right: 0,
                                display: 'flex',
                                justifyContent: 'space-around',
                                alignItems: 'center',
                                padding: '0 2rem'
                            }}>
                                <button
                                    type="button"
                                    onClick={stopCamera}
                                    style={{
                                        background: 'rgba(255,255,255,0.2)',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '1rem',
                                        borderRadius: '50%',
                                        width: '60px',
                                        height: '60px',
                                        fontSize: '1.5rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                >
                                    ✕
                                </button>

                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    style={{
                                        background: '#fff',
                                        border: '4px solid #ddd',
                                        borderRadius: '50%',
                                        width: '80px',
                                        height: '80px'
                                    }}
                                ></button>

                                <div style={{ width: '60px' }}></div> {/* Spacer for alignment */}
                            </div>
                        </div>
                    )}

                </form>
            </div >

            {showMap && (
                <MapPicker
                    onSelect={handleMapSelect}
                    onClose={() => setShowMap(false)}
                    initialLocation={formData.location}
                />
            )
            }
        </div >
    )
}

export default Report
