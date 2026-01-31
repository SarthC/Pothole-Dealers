// Priority calculation algorithm
// Higher score = Higher priority

const SEVERITY_WEIGHTS = {
    small: 1,
    medium: 2,
    large: 3,
    critical: 4
}

const ROAD_TYPE_WEIGHTS = {
    residential: 1,
    city: 2,
    highway: 3
}

export function calculatePriority(report) {
    const reportCount = report.reportCount || 1
    const severity = SEVERITY_WEIGHTS[report.severity] || 1
    const roadType = ROAD_TYPE_WEIGHTS[report.roadType] || 1

    // Days since first report
    const createdDate = new Date(report.createdAt)
    const now = new Date()
    const daysSinceReport = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24))

    // Priority formula:
    // - Report count contributes 25% (more reports = higher priority)
    // - Severity contributes 30% (critical > large > medium > small)
    // - Time factor contributes 25% (older reports get priority)
    // - Road type contributes 20% (highway > city > residential)

    const score =
        (reportCount * 25) +           // Max ~250 for 10 reports
        (severity * 30) +               // Max 120 for critical
        (Math.min(daysSinceReport, 30) * 2.5) + // Max 75 for 30+ days
        (roadType * 20)                 // Max 60 for highway

    return Math.round(score)
}

export function getPriorityLevel(score) {
    if (score >= 200) return 'critical'
    if (score >= 150) return 'high'
    if (score >= 100) return 'medium'
    return 'low'
}

export function getPriorityLabel(level) {
    const labels = {
        critical: 'Critical Priority',
        high: 'High Priority',
        medium: 'Medium Priority',
        low: 'Low Priority'
    }
    return labels[level] || 'Unknown'
}

export function sortByPriority(reports, order = 'desc') {
    return [...reports].sort((a, b) => {
        const priorityA = calculatePriority(a)
        const priorityB = calculatePriority(b)
        return order === 'desc' ? priorityB - priorityA : priorityA - priorityB
    })
}
