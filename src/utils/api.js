// API utility for connecting to backend
const API_BASE_URL = 'http://localhost:3001/api';

/**
 * Make API request
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get all reports from backend
 */
export async function getReportsFromAPI() {
    const response = await apiRequest('/reports');
    return response.data;
}

/**
 * Create new report via backend
 */
export async function createReportAPI(report) {
    const response = await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify(report)
    });
    return response.data;
}

/**
 * Upload image to backend
 */
export async function uploadImageAPI(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
    }

    return `http://localhost:3001${data.data.imageUrl}`;
}

/**
 * Update report status
 */
export async function updateReportStatusAPI(reportId, status) {
    const response = await apiRequest(`/reports/${reportId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
    });
    return response.data;
}

/**
 * Delete report
 */
export async function deleteReportAPI(reportId) {
    await apiRequest(`/reports/${reportId}`, {
        method: 'DELETE'
    });
}

/**
 * Get statistics
 */
export async function getStatsAPI() {
    const response = await apiRequest('/stats');
    return response.data;
}
