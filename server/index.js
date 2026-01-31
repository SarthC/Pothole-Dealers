// Pofix Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'reports.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Initialize data file
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ reports: [] }));
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `pothole_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Helper functions
function readData() {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { reports: [] };
    }
}

function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Priority calculation
function calculatePriority(report) {
    const severityScores = { small: 10, medium: 25, large: 50, critical: 100 };
    const roadTypeScores = { residential: 1, city: 1.5, highway: 2 };

    const severityScore = severityScores[report.severity] || 25;
    const roadMultiplier = roadTypeScores[report.roadType] || 1;
    const reportCount = report.reportCount || 1;

    const daysSinceReport = Math.floor((Date.now() - new Date(report.createdAt).getTime()) / (1000 * 60 * 60 * 24));
    const ageBonus = Math.min(daysSinceReport * 2, 50);

    return Math.round((severityScore * roadMultiplier * reportCount) + ageBonus);
}

// ============ API ROUTES ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get all reports
app.get('/api/reports', (req, res) => {
    try {
        const { reports } = readData();

        // Add priority scores
        const reportsWithPriority = reports.map(report => ({
            ...report,
            priorityScore: calculatePriority(report)
        }));

        // Sort by priority (highest first)
        reportsWithPriority.sort((a, b) => b.priorityScore - a.priorityScore);

        res.json({ success: true, data: reportsWithPriority });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single report
app.get('/api/reports/:id', (req, res) => {
    try {
        const { reports } = readData();
        const report = reports.find(r => r.id === req.params.id);

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        res.json({ success: true, data: { ...report, priorityScore: calculatePriority(report) } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new report
app.post('/api/reports', (req, res) => {
    try {
        const data = readData();

        const newReport = {
            id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...req.body,
            reportCount: 1,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        data.reports.push(newReport);
        writeData(data);

        res.status(201).json({ success: true, data: newReport });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload image
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, data: { imageUrl, filename: req.file.filename } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Hugging Face Image Verification
// Uses a vision model to classify if image looks like a road/pothole
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/google/vit-base-patch16-224';
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || ''; // Optional: Set your token for higher rate limits

// Road-related keywords to check in predictions
const ROAD_KEYWORDS = [
    'street', 'road', 'highway', 'pavement', 'asphalt', 'concrete',
    'sidewalk', 'curb', 'manhole', 'traffic', 'car', 'vehicle',
    'wheel', 'tire', 'gravel', 'dirt', 'path', 'lane', 'parking',
    'crosswalk', 'intersection', 'bridge', 'tunnel', 'barrier'
];

app.post('/api/verify-image', async (req, res) => {
    try {
        const { imageBase64 } = req.body;

        if (!imageBase64) {
            return res.status(400).json({
                success: false,
                error: 'No image provided',
                valid: false
            });
        }

        // Extract base64 data (remove data URL prefix if present)
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Call Hugging Face API with 5-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const headers = { 'Content-Type': 'application/json' };
            if (HUGGINGFACE_TOKEN) {
                headers['Authorization'] = `Bearer ${HUGGINGFACE_TOKEN}`;
            }

            const response = await fetch(HUGGINGFACE_API_URL, {
                method: 'POST',
                headers,
                body: imageBuffer,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                // Model might be loading (cold start)
                if (response.status === 503) {
                    return res.json({
                        success: true,
                        valid: true,
                        warning: true,
                        message: 'AI verification unavailable (model loading). Please proceed with caution.',
                        predictions: []
                    });
                }
                throw new Error(`Hugging Face API error: ${response.status}`);
            }

            const predictions = await response.json();

            // Check if any prediction matches road-related keywords
            const topLabels = predictions.slice(0, 5).map(p => p.label.toLowerCase());
            const allLabelsText = topLabels.join(' ');

            const isRoadRelated = ROAD_KEYWORDS.some(keyword =>
                allLabelsText.includes(keyword)
            );

            if (isRoadRelated) {
                return res.json({
                    success: true,
                    valid: true,
                    warning: false,
                    message: 'Image appears to be road-related.',
                    predictions: predictions.slice(0, 3)
                });
            } else {
                return res.json({
                    success: true,
                    valid: false,
                    warning: false,  // This is an error, not a warning - block submission
                    message: `This image is not a pothole. Detected: "${predictions[0]?.label || 'unknown'}". Please upload a photo of a road defect.`,
                    predictions: predictions.slice(0, 3)
                });
            }

        } catch (fetchError) {
            clearTimeout(timeoutId);

            // Timeout or network error - allow with warning
            if (fetchError.name === 'AbortError') {
                return res.json({
                    success: true,
                    valid: true,
                    warning: true,
                    message: 'AI verification timed out. Please ensure this is a pothole photo.',
                    predictions: []
                });
            }

            throw fetchError;
        }

    } catch (error) {
        console.error('Verify image error:', error);
        // On error, allow with warning (don't block user)
        res.json({
            success: true,
            valid: true,
            warning: true,
            message: 'Could not verify image. Please ensure this is a pothole photo.',
            predictions: []
        });
    }
});

// Update report status
app.patch('/api/reports/:id/status', (req, res) => {
    try {
        const { status } = req.body;
        const data = readData();

        const reportIndex = data.reports.findIndex(r => r.id === req.params.id);

        if (reportIndex === -1) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        data.reports[reportIndex].status = status;
        data.reports[reportIndex].updatedAt = new Date().toISOString();

        writeData(data);

        res.json({ success: true, data: data.reports[reportIndex] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Increment report count (for duplicate reports at same location)
app.post('/api/reports/:id/increment', (req, res) => {
    try {
        const data = readData();
        const reportIndex = data.reports.findIndex(r => r.id === req.params.id);

        if (reportIndex === -1) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        data.reports[reportIndex].reportCount = (data.reports[reportIndex].reportCount || 1) + 1;
        data.reports[reportIndex].updatedAt = new Date().toISOString();

        writeData(data);

        res.json({ success: true, data: data.reports[reportIndex] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete report
app.delete('/api/reports/:id', (req, res) => {
    try {
        const data = readData();
        const reportIndex = data.reports.findIndex(r => r.id === req.params.id);

        if (reportIndex === -1) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        data.reports.splice(reportIndex, 1);
        writeData(data);

        res.json({ success: true, message: 'Report deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get statistics
app.get('/api/stats', (req, res) => {
    try {
        const { reports } = readData();

        const stats = {
            total: reports.length,
            pending: reports.filter(r => r.status === 'pending').length,
            inProgress: reports.filter(r => r.status === 'progress').length,
            resolved: reports.filter(r => r.status === 'resolved').length,
            critical: reports.filter(r => r.severity === 'critical').length,
            bySeverity: {
                small: reports.filter(r => r.severity === 'small').length,
                medium: reports.filter(r => r.severity === 'medium').length,
                large: reports.filter(r => r.severity === 'large').length,
                critical: reports.filter(r => r.severity === 'critical').length
            }
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
  🚀 Pofix Backend Server Running!
  
  API Endpoints:
  - GET    /api/health          - Health check
  - GET    /api/reports         - Get all reports
  - GET    /api/reports/:id     - Get single report
  - POST   /api/reports         - Create new report
  - POST   /api/upload          - Upload image
  - PATCH  /api/reports/:id/status - Update status
  - DELETE /api/reports/:id     - Delete report
  - GET    /api/stats           - Get statistics
  
  Server: http://localhost:${PORT}
  `);
});
