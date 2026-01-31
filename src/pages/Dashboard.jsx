import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getReportsFromDatabase, updateReportStatusDatabase } from '../utils/realtimeDb'
import { getAllContractorsWithStats } from '../utils/contractorService'
import PotholeCard from '../components/PotholeCard'
import './Dashboard.css'

function Dashboard() {
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [contractors, setContractors] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all, pending, progress, resolved
    const [sortBy, setSortBy] = useState('newest') // newest, severe, topReporter

    useEffect(() => {
        loadReports()
        loadContractors()
    }, [])

    const loadReports = async () => {
        try {
            const data = await getReportsFromDatabase()
            setReports(data)
        } catch (error) {
            console.error('Failed to load reports:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadContractors = () => {
        const data = getAllContractorsWithStats()
        // Sort by active potholes (descending)
        setContractors(data.sort((a, b) => b.stats.activePotholes - a.stats.activePotholes))
    }

    const handleStatusChange = async (reportId, newStatus, assignedToUser) => {
        try {
            // Optimistic update
            setReports(prev => prev.map(report => {
                if (report.id === reportId) {
                    const updated = { ...report, status: newStatus }
                    if (newStatus === 'progress' && assignedToUser) {
                        updated.assignedTo = {
                            name: assignedToUser.name,
                            timestamp: new Date().toISOString()
                        }
                    }
                    if (newStatus === 'resolved' && assignedToUser) {
                        updated.resolvedBy = {
                            name: assignedToUser.name,
                            timestamp: new Date().toISOString()
                        }
                    }
                    return updated
                }
                return report
            }))

            await updateReportStatusDatabase(reportId, newStatus)
        } catch (error) {
            console.error('Failed to update status:', error)
            alert('Failed to update status. Please try again.')
            loadReports() // Revert on error
        }
    }

    const getFilteredReports = () => {
        let filtered = reports

        if (filter !== 'all') {
            filtered = filtered.filter(r => r.status === filter)
        }

        // For topReporter sort, count reports per user
        if (sortBy === 'topReporter') {
            // Count reports per user (using reporterName field)
            const reportCountByUser = {}
            filtered.forEach(report => {
                const userName = report.reporterName || report.reporterEmail || 'Anonymous'
                reportCountByUser[userName] = (reportCountByUser[userName] || 0) + 1
            })
            // Sort by user's report count (descending), then by date
            return filtered.sort((a, b) => {
                const userA = a.reporterName || a.reporterEmail || 'Anonymous'
                const userB = b.reporterName || b.reporterEmail || 'Anonymous'
                const countDiff = reportCountByUser[userB] - reportCountByUser[userA]
                if (countDiff !== 0) return countDiff
                return new Date(b.createdAt) - new Date(a.createdAt)
            })
        }

        return filtered.sort((a, b) => {
            if (sortBy === 'newest') {
                return new Date(b.createdAt) - new Date(a.createdAt)
            } else if (sortBy === 'severe') {
                const severityWeight = { critical: 4, large: 3, medium: 2, small: 1 }
                return severityWeight[b.severity] - severityWeight[a.severity]
            }
            return 0
        })
    }

    if (loading) {
        return (
            <div className="dashboard-page">
                <div className="container">
                    <div className="loading-state">
                        <span className="spinner"></span> Loading reports...
                    </div>
                </div>
            </div>
        )
    }

    const filteredReports = getFilteredReports()

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header">
                    <h1>Community Dashboard</h1>
                    <p>Track reported potholes and ongoing repairs in your area</p>
                </div>

                <div className="dashboard-layout">
                    {/* Main Content: Reports List */}
                    <div className="dashboard-main">
                        <div className="dashboard-controls">
                            <div className="control-group">
                                <label>Filter Status:</label>
                                <select
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="select-input"
                                >
                                    <option value="all">All Reports</option>
                                    <option value="pending">Pending</option>
                                    <option value="progress">In Progress</option>
                                    <option value="resolved">Resolved</option>
                                </select>
                            </div>

                            <div className="control-group">
                                <label>Sort By:</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="select-input"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="severe">Severity (High to Low)</option>
                                    <option value="topReporter">Top Reporters</option>
                                </select>
                            </div>
                        </div>

                        <div className="stats-bar">
                            <div className="stat-item">
                                <span className="stat-value">{reports.length}</span>
                                <span className="stat-label">Total Reports</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value warning">
                                    {reports.filter(r => r.status === 'pending').length}
                                </span>
                                <span className="stat-label">Pending</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value success">
                                    {reports.filter(r => r.status === 'resolved').length}
                                </span>
                                <span className="stat-label">Fixed</span>
                            </div>
                        </div>

                        {filteredReports.length === 0 ? (
                            <div className="empty-state">
                                <p>No reports found matching your filters.</p>
                                <button
                                    onClick={() => navigate('/report')}
                                    className="btn btn-primary"
                                >
                                    Report First Pothole
                                </button>
                            </div>
                        ) : (
                            <div className="reports-grid">
                                {filteredReports.map(report => (
                                    <PotholeCard
                                        key={report.id}
                                        report={report}
                                        onStatusChange={handleStatusChange}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar: Contractor Watchlist */}
                    <aside className="dashboard-sidebar">
                        <div className="sidebar-card">
                            <h3>🚧 Contractor Watchlist</h3>
                            <p className="sidebar-subtitle">Top agencies by active pothole count</p>

                            <div className="contractor-list">
                                {contractors.slice(0, 5).map((contractor, index) => (
                                    <div key={contractor.id} className="contractor-item">
                                        <div className="contractor-rank">#{index + 1}</div>
                                        <div className="contractor-info">
                                            <h4>{contractor.name}</h4>
                                            <div className="contractor-stats">
                                                <span className="stat-badge warning">
                                                    {contractor.stats.activePotholes} Active
                                                </span>
                                                <span className="stat-badge success">
                                                    {contractor.stats.fixedLastMonth} Fixed
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="sidebar-footer">
                                <small>Data based on reported location zones</small>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default Dashboard
