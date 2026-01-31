import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ScrollSequence from '../components/ScrollSequence'
import { getReportsFromDatabase } from '../utils/realtimeDb'
import { calculatePriority, getPriorityLevel } from '../utils/priority'
import './Home.css'

function Home() {
    const [stats, setStats] = useState({
        total: 0,
        fixed: 0,
        inProgress: 0,
        resolutionRate: 0
    })
    const [priorityCounts, setPriorityCounts] = useState({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    })

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        try {
            const reports = await getReportsFromDatabase()

            const total = reports.length
            const fixed = reports.filter(r => r.status === 'resolved').length
            const inProgress = reports.filter(r => r.status === 'progress').length
            const resolutionRate = total > 0 ? Math.round((fixed / total) * 100) : 0

            setStats({ total, fixed, inProgress, resolutionRate })

            // Count by priority level
            const counts = { critical: 0, high: 0, medium: 0, low: 0 }
            reports.forEach(report => {
                const priority = calculatePriority(report)
                const level = getPriorityLevel(priority)
                if (counts[level] !== undefined) {
                    counts[level]++
                }
            })
            setPriorityCounts(counts)
        } catch (error) {
            console.error('Error loading stats:', error)
        }
    }

    return (
        <div className="home-page">
            <ScrollSequence />

            <section className="cta-section">
                <div className="container">
                    <div className="cta-content">
                        <h2 className="cta-title">Ready to make a difference?</h2>
                        <p className="cta-text">
                            Join thousands of citizens reporting potholes and helping fix roads in their community.
                        </p>

                        <div className="cta-buttons">
                            <Link to="/report" className="btn btn-primary btn-lg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <path d="M21 15l-5-5L5 21" />
                                </svg>
                                Report a Pothole
                            </Link>

                            <Link to="/dashboard" className="btn btn-secondary btn-lg">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="7" height="9" />
                                    <rect x="14" y="3" width="7" height="5" />
                                    <rect x="14" y="12" width="7" height="9" />
                                    <rect x="3" y="16" width="7" height="5" />
                                </svg>
                                View Dashboard
                            </Link>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <span className="stat-number">{stats.total.toLocaleString()}</span>
                            <span className="stat-label">Potholes Reported</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.fixed.toLocaleString()}</span>
                            <span className="stat-label">Potholes Fixed</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.inProgress}</span>
                            <span className="stat-label">In Progress</span>
                        </div>
                        <div className="stat-card">
                            <span className="stat-number">{stats.resolutionRate}%</span>
                            <span className="stat-label">Resolution Rate</span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="how-it-works">
                <div className="container">
                    <h2 className="section-title">How It Works</h2>

                    <div className="steps-grid">
                        <div className="step-card">
                            <div className="step-number">01</div>
                            <h3>Spot</h3>
                            <p>Find a pothole that needs attention on your daily commute or in your neighborhood.</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">02</div>
                            <h3>Snap</h3>
                            <p>Take a clear photo of the pothole. Our system analyzes the severity automatically.</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">03</div>
                            <h3>Send</h3>
                            <p>Submit your report with location details. It's added to our priority database instantly.</p>
                        </div>
                        <div className="step-card">
                            <div className="step-number">04</div>
                            <h3>Solved</h3>
                            <p>Government and NGOs access the dashboard and fix high-priority potholes first.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="for-authorities">
                <div className="container">
                    <div className="authorities-content">
                        <div className="authorities-text">
                            <span className="tag">For Authorities & NGOs</span>
                            <h2>Smart Priority System</h2>
                            <p>
                                Our intelligent algorithm prioritizes potholes based on multiple factors:
                            </p>
                            <ul className="feature-list">
                                <li>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    Number of citizen reports at each location
                                </li>
                                <li>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    Severity assessment (small to critical)
                                </li>
                                <li>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    Time since first report (urgency factor)
                                </li>
                                <li>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                    Road type (highways get higher priority)
                                </li>
                            </ul>
                            <Link to="/dashboard" className="btn btn-primary">
                                Access Dashboard
                            </Link>
                        </div>
                        <div className="authorities-visual">
                            <div className="priority-demo">
                                <div className="priority-item critical">
                                    <span className="priority-score">{priorityCounts.critical}</span>
                                    <span className="priority-label">Critical</span>
                                </div>
                                <div className="priority-item high">
                                    <span className="priority-score">{priorityCounts.high}</span>
                                    <span className="priority-label">High</span>
                                </div>
                                <div className="priority-item medium">
                                    <span className="priority-score">{priorityCounts.medium}</span>
                                    <span className="priority-label">Medium</span>
                                </div>
                                <div className="priority-item low">
                                    <span className="priority-score">{priorityCounts.low}</span>
                                    <span className="priority-label">Low</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="footer">
                <div className="container">
                    <div className="footer-content">
                        <div className="footer-brand">
                            <span className="footer-logo">POFIX</span>
                            <p>Making roads safer, one pothole at a time.</p>
                        </div>
                        <div className="footer-links">
                            <Link to="/report">Report</Link>
                            <Link to="/dashboard">Dashboard</Link>
                            <Link to="/login">Sign In</Link>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>&copy; 2026 Pofix. Built for better roads.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}

export default Home
