import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveReportToDatabase } from '../utils/realtimeDb'
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

    // Pre-load MobileNet model when page loads (eliminates wait on image upload)
    useEffect(() => {
        preloadModel()
    }, [])


    // Unified handler for camera - extracts GPS and verifies image content
    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Reset states
        setVerifying(true)
        setVerificationResult(null)
        setLocationFromPhoto(false)
        setGpsError(null)
        setStatusMessage('Platform is verifying your image...')

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

                // Step 2: Extract GPS
                setStatusMessage('Platform is detecting location...')
                await new Promise(r => setTimeout(r, 600)) // UX delay

                const exifData = await extractExifData(file)

                // Check Photo Age (48h limit)
                if (exifData.date) {
                    const now = new Date()
                    const hoursDiff = (now - exifData.date) / (1000 * 60 * 60)
                    if (hoursDiff > 48) {
                        setVerificationResult({
                            valid: false,
                            errors: [`❌ Photo is ${Math.round(hoursDiff)} hours old. Only photos taken within the last 48 hours are accepted.`]
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

                // Check GPS
                if (exifData?.gps) {
                    const { lat, lng } = exifData.gps
                    console.log('📍 GPS extracted from image EXIF:', lat, lng)
                    setStatusMessage('Location found! Fetching address...')

                    // Reverse geocode
                    try {
                        const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
                        )
                        const data = await response.json()
                        setFormData(prev => ({
                            ...prev,
                            location: {
                                lat,
                                lng,
                                address: data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                            }
                        }))
                        setLocationFromPhoto(true)
                        setTimeout(() => setCurrentStep(2), 1000)
                    } catch {
                        setFormData(prev => ({
                            ...prev,
                            location: {
                                lat: lat,
                                lng: lng,
                                address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                            }
                        }))
                        setLocationFromPhoto(true)
                        setTimeout(() => setCurrentStep(2), 1000)
                    }
                } else {
                    // NO GPS
                    console.log('📷 No GPS found in image EXIF.')
                    setGpsError('❌ No GPS location found in image. Please ensure location services are enabled when taking the photo.')
                    setVerificationResult(prev => ({
                        ...prev,
                        valid: false,
                        errors: [...(prev?.errors || []), '❌ No GPS location found in image. Enable location on your camera and try again.']
                    }))
                }
            } catch (error) {
                console.error('Verification error:', error)
                setVerificationResult({
                    valid: false,
                    errors: ['Could not verify image. Please ensure this is a valid pothole photo with GPS data.']
                })
            } finally {
                setVerifying(false)
                setStatusMessage('')
            }
        }
        reader.readAsDataURL(file)
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
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
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
                } catch {
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
            { enableHighAccuracy: true, timeout: 10000 }
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
            // Compress image to base64 (avoiding Firebase Storage CORS issues)
            const compressedBase64 = await compressImageToBase64(formData.imageFile, 800, 0.6)
            console.log('✅ Image compressed to base64')

            const report = {
                imageUrl: compressedBase64, // Base64 stored directly
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

                                {/* Camera Button Only */}
                                {!preview && (
                                    <div className="upload-buttons" style={{ justifyContent: 'center' }}>
                                        <button
                                            type="button"
                                            className="btn btn-primary upload-btn"
                                            onClick={() => document.getElementById('camera-input').click()}
                                            style={{ minWidth: '200px' }}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                                <circle cx="12" cy="13" r="4" />
                                            </svg>
                                            Take Photo (Camera Only)
                                        </button>
                                        {/* Gallery Upload Removed as per request */}
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

                                <p className="upload-hint" style={{ textAlign: 'center', marginTop: '1rem' }}>
                                    📷 Must contain GPS data. AI will verify text/pothole.
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

                                {/* Verification Feedback */}
                                {verifying && (
                                    <div className="verification-status verifying">
                                        <span className="spinner"></span> {statusMessage || 'Verifying...'}
                                    </div>
                                )}
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

                                        <div className="location-correction text-center">
                                            <button
                                                type="button"
                                                onClick={() => setShowMap(true)}
                                                className="btn btn-secondary btn-sm"
                                                style={{ margin: '0 auto' }}
                                            >
                                                Wrong location? Correct on Map
                                            </button>
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
