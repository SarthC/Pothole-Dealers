import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { saveReportToDatabase } from '../utils/realtimeDb'
import { verifyImage } from '../utils/imageVerification'
import MapPicker from '../components/MapPicker'
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
    const [gpsLoading, setGpsLoading] = useState(false)

    // Verification state
    const [verifying, setVerifying] = useState(false)
    const [verificationResult, setVerificationResult] = useState(null)
    const [locationFromPhoto, setLocationFromPhoto] = useState(false)


    const handleImageUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Reset verification state
        setVerifying(true)
        setVerificationResult(null)
        setLocationFromPhoto(false)

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

            // Verify image (EXIF check only)
            try {
                const result = await verifyImage(file)
                setVerificationResult(result)

                // Auto-fill GPS from photo if available
                if (result.exifData?.gps) {
                    const { lat, lng } = result.exifData.gps
                    // Reverse geocode the GPS coordinates
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
                    } catch {
                        setFormData(prev => ({
                            ...prev,
                            location: {
                                lat,
                                lng,
                                address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
                            }
                        }))
                        setLocationFromPhoto(true)
                    }
                }
            } catch (error) {
                console.error('Verification error:', error)
                setVerificationResult({
                    valid: true,
                    warnings: ['Could not verify image. Please ensure this is a recent pothole photo.'],
                    errors: []
                })
            } finally {
                setVerifying(false)
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
                                        description: ''
                                    })
                                    setPreview(null)
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
                    <div className="form-section">
                        <h3>1. Upload Photo</h3>
                        <div
                            className={`image-upload ${preview ? 'has-image' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {preview ? (
                                <img ref={previewImgRef} src={preview} alt="Pothole preview" className="image-preview" crossOrigin="anonymous" />
                            ) : (
                                <div className="upload-placeholder">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <circle cx="8.5" cy="8.5" r="1.5" />
                                        <path d="M21 15l-5-5L5 21" />
                                    </svg>
                                    <span>Click to upload image</span>
                                    <span className="upload-hint">JPG, PNG up to 10MB (taken within last 48 hours)</span>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>

                        {/* Verification Feedback */}
                        {verifying && (
                            <div className="verification-status verifying">
                                <span className="spinner"></span> Analyzing image with AI...
                            </div>
                        )}
                        {verificationResult && !verifying && (
                            <div className={`verification-status ${verificationResult.valid ? 'valid' : 'invalid'}`}>
                                {verificationResult.errors?.map((err, i) => (
                                    <div key={i} className="verification-error">❌ {err}</div>
                                ))}
                                {verificationResult.warnings?.map((warn, i) => (
                                    <div key={i} className="verification-warning">⚠️ {warn}</div>
                                ))}
                                {verificationResult.valid && verificationResult.errors?.length === 0 && verificationResult.warnings?.length === 0 && (
                                    <div className="verification-success">✅ Image verified</div>
                                )}
                            </div>
                        )}
                        {locationFromPhoto && (
                            <div className="verification-status valid">
                                📍 Location extracted from photo
                            </div>
                        )}
                    </div>

                    <div className="form-section">
                        <h3>2. Location</h3>
                        <div className="location-options">
                            <button
                                type="button"
                                onClick={handleGetLocation}
                                className="btn btn-secondary"
                                disabled={gpsLoading}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                                </svg>
                                {gpsLoading ? 'Detecting...' : 'Use GPS'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowMap(true)}
                                className="btn btn-secondary"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                Pick on Map
                            </button>
                        </div>

                        <div className="input-group">
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

                        {formData.location.lat && (
                            <div className="coordinates">
                                <span>📍 {formData.location.lat.toFixed(4)}, {formData.location.lng.toFixed(4)}</span>
                            </div>
                        )}
                    </div>

                    <div className="form-section">
                        <h3>3. Reporter Information</h3>

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

                        <div className="form-row">
                            <div className="input-group">
                                <label className="input-label">Severity</label>
                                <select
                                    className="input-field"
                                    value={formData.severity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                                >
                                    <option value="small">Small - Minor crack or dip</option>
                                    <option value="medium">Medium - Notable hole</option>
                                    <option value="large">Large - Deep or wide hole</option>
                                    <option value="critical">Critical - Dangerous hazard</option>
                                </select>
                            </div>

                            <div className="input-group">
                                <label className="input-label">Road Type</label>
                                <select
                                    className="input-field"
                                    value={formData.roadType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, roadType: e.target.value }))}
                                >
                                    <option value="residential">Residential</option>
                                    <option value="city">City Road</option>
                                    <option value="highway">Highway</option>
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Additional Notes (Optional)</label>
                            <textarea
                                className="input-field"
                                placeholder="Any additional details about the pothole..."
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Report'}
                    </button>
                </form>
            </div>

            {showMap && (
                <MapPicker
                    onSelect={handleMapSelect}
                    onClose={() => setShowMap(false)}
                    initialLocation={formData.location}
                />
            )}
        </div>
    )
}

export default Report
