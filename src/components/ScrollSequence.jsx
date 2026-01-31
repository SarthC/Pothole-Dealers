import { useEffect, useRef, useState } from 'react'
import './ScrollSequence.css'

// Total number of frames
const FRAME_COUNT = 40

// Preload all images
function preloadImages(callback) {
    const images = []
    let loadedCount = 0

    for (let i = 1; i <= FRAME_COUNT; i++) {
        const img = new Image()
        img.src = `/ezgif-frame-${String(i).padStart(3, '0')}.jpg`
        img.onload = () => {
            loadedCount++
            if (loadedCount === FRAME_COUNT && callback) {
                callback(images)
            }
        }
        images.push(img)
    }

    return images
}

function ScrollSequence() {
    const canvasRef = useRef(null)
    const containerRef = useRef(null)
    const [images, setImages] = useState([])
    const [currentText, setCurrentText] = useState(0)
    const [prevText, setPrevText] = useState(-1)
    const [loading, setLoading] = useState(true)
    const [progress, setProgress] = useState(0)

    const textSequence = [
        { text: 'See a pothole?', subtext: 'Roads shouldn\'t fight back' },
        { text: 'Snap', subtext: 'Capture the problem' },
        { text: 'Send', subtext: 'Report instantly' },
        { text: 'Solved', subtext: 'Together we fix roads' }
    ]

    useEffect(() => {
        preloadImages((loadedImages) => {
            setImages(loadedImages)
            setLoading(false)
        })
    }, [])

    useEffect(() => {
        if (!images.length || !canvasRef.current) return

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')

        const handleScroll = () => {
            const container = containerRef.current
            if (!container) return

            const rect = container.getBoundingClientRect()
            const containerTop = -rect.top
            const containerHeight = container.offsetHeight - window.innerHeight

            // Calculate scroll progress (0 to 1)
            const scrollProgress = Math.max(0, Math.min(1, containerTop / containerHeight))
            setProgress(scrollProgress)

            // Calculate which frame to show
            const frameIndex = Math.min(
                FRAME_COUNT - 1,
                Math.floor(scrollProgress * FRAME_COUNT)
            )

            // Calculate which text to show (4 phases)
            const textIndex = Math.min(3, Math.floor(scrollProgress * 4))

            // Track previous text for exit animation
            if (textIndex !== currentText) {
                setPrevText(currentText)
                setCurrentText(textIndex)
            }

            // Draw the frame
            if (images[frameIndex]) {
                // Set canvas size to match image
                canvas.width = images[frameIndex].width
                canvas.height = images[frameIndex].height
                ctx.drawImage(images[frameIndex], 0, 0)
            }
        }

        // Initial draw
        if (images[0]) {
            canvas.width = images[0].width
            canvas.height = images[0].height
            ctx.drawImage(images[0], 0, 0)
        }

        window.addEventListener('scroll', handleScroll)
        handleScroll() // Initial call

        return () => window.removeEventListener('scroll', handleScroll)
    }, [images, currentText])

    if (loading) {
        return (
            <div className="scroll-sequence-loader">
                <div className="loader-content">
                    <span className="loader-logo">POFIX</span>
                    <div className="loader-bar">
                        <div className="loader-progress"></div>
                    </div>
                    <span className="loader-text">Loading experience...</span>
                </div>
            </div>
        )
    }

    return (
        <section className="scroll-sequence" ref={containerRef}>
            <div className="scroll-sequence-sticky">
                <canvas ref={canvasRef} className="scroll-canvas" />

                <div className="scroll-overlay">
                    <div className="text-container">
                        {textSequence.map((item, index) => (
                            <div
                                key={index}
                                className={`text-item ${currentText === index
                                        ? 'active entering'
                                        : prevText === index
                                            ? 'exiting'
                                            : ''
                                    }`}
                            >
                                <h1 className="hero-text">{item.text}</h1>
                                <p className="hero-subtext">{item.subtext}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="scroll-progress">
                    <div
                        className="scroll-progress-bar"
                        style={{ width: `${progress * 100}%` }}
                    />
                </div>

                <div className="scroll-indicator">
                    <span>Scroll to explore</span>
                    <div className="scroll-arrow">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default ScrollSequence
