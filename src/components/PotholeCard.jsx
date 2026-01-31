import { calculatePriority, getPriorityLevel } from '../utils/priority'
import { getContractorByAddress } from '../utils/contractorService'
import './PotholeCard.css'

function PotholeCard({ report, onStatusChange }) {
    const priority = calculatePriority(report)
    const priorityLevel = getPriorityLevel(priority)

    // Find responsible contractor based on location
    const contractor = getContractorByAddress(report.location?.address)

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    }

    const getSeverityLabel = (severity) => {
        const labels = {
            small: 'Small',
            medium: 'Medium',
            large: 'Large',
            critical: 'Critical'
        }
        return labels[severity] || severity
    }

    const getRoadTypeLabel = (roadType) => {
        const labels = {
            residential: 'Residential',
            city: 'City Road',
            highway: 'Highway'
        }
        return labels[roadType] || roadType
    }

    const handleStatusChangeWithPrompt = (reportId, newStatus) => {
        let name = ''
        if (newStatus === 'progress') {
            name = prompt('Enter your name (who is starting the repair):')
        } else if (newStatus === 'resolved') {
            name = prompt('Enter your name (who resolved this issue):')
        }
        if (name !== null) { // User didn't cancel
            onStatusChange(reportId, newStatus, { name: name || 'Unknown', id: null })
        }
    }

    return (
        <div className={`pothole-card priority-${priorityLevel}`}>
            <div className="card-image">
                <img
                    src={report.imageUrl || report.images?.[0] || '/ezgif-frame-001.jpg'}
                    alt="Pothole"
                />
                <div className="priority-badge-wrapper">
                    <span className={`priority-badge priority-${priorityLevel}`}>
                        {priority} pts
                    </span>
                </div>
                {report.reportCount > 1 && (
                    <div className="report-count">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                        </svg>
                        {report.reportCount} reports
                    </div>
                )}
            </div>

            <div className="card-content">
                <div className="card-location">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                        <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{report.location?.address || 'Unknown location'}</span>
                </div>

                <div className="card-meta">
                    <span className={`severity-tag ${report.severity}`}>
                        {getSeverityLabel(report.severity)}
                    </span>
                    <span className="road-type">
                        {getRoadTypeLabel(report.roadType)}
                    </span>
                    <span className="date">
                        {formatDate(report.createdAt)}
                    </span>
                </div>

                {/* Contractor Badge */}
                <div className={`contractor-badge ${priority >= 80 ? 'critical-contractor' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18M5 21V7l8-4 8 4v14M8 21v-4h8v4" />
                    </svg>
                    <span>{contractor.name}</span>
                </div>

                {report.description && (
                    <p className="card-description">{report.description}</p>
                )}

                {/* Reporters section - show all people who reported this pothole */}
                {report.reporters && report.reporters.length > 0 && (
                    <div className="reporters-section">
                        <div className="reporters-header">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                                <path d="M16 3.13a4 4 0 010 7.75" />
                            </svg>
                            <span>Reported by {report.reporters.length} {report.reporters.length === 1 ? 'person' : 'people'}</span>
                        </div>
                        <div className="reporters-list">
                            {report.reporters.slice(0, 5).map((reporter, index) => (
                                <div key={index} className="reporter-item">
                                    <img
                                        src={reporter.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${reporter.name}`}
                                        alt={reporter.name}
                                        className="reporter-avatar"
                                    />
                                    <span className="reporter-name">{reporter.name}</span>
                                </div>
                            ))}
                            {report.reporters.length > 5 && (
                                <span className="more-reporters">+{report.reporters.length - 5} more</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Assignee/Resolver tracking info */}
                {report.assignedTo && (
                    <div className="tracking-info assigned">
                        🔧 <strong>Repair started by:</strong> {report.assignedTo.name}
                        <span className="tracking-date"> ({formatDate(report.assignedTo.timestamp)})</span>
                    </div>
                )}
                {report.resolvedBy && (
                    <div className="tracking-info resolved">
                        ✅ <strong>Resolved by:</strong> {report.resolvedBy.name}
                        <span className="tracking-date"> ({formatDate(report.resolvedBy.timestamp)})</span>
                    </div>
                )}

                <div className="card-footer">
                    <div className={`status-indicator ${report.status}`}>
                        {report.status === 'pending' && 'Pending'}
                        {report.status === 'progress' && 'In Progress'}
                        {report.status === 'resolved' && 'Resolved'}
                    </div>

                    <div className="status-actions">
                        {report.status !== 'progress' && report.status !== 'resolved' && (
                            <button
                                onClick={() => handleStatusChangeWithPrompt(report.id, 'progress')}
                                className="btn btn-sm btn-ghost"
                            >
                                Start Work
                            </button>
                        )}
                        {report.status !== 'resolved' && (
                            <button
                                onClick={() => handleStatusChangeWithPrompt(report.id, 'resolved')}
                                className="btn btn-sm btn-primary"
                            >
                                Mark Fixed
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PotholeCard
