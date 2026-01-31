# POFIX - AI-Powered Pothole Reporting & Navigation Platform

POFIX is a modern web application designed to help communities and authorities track, report, and navigate around road hazards. It combines **client-side AI** for instant report verification with **real-time voice navigation** to keep drivers safe.

## 🚀 Key Features

### 📷 Smart Reporting with AI Verification
- **Instant AI Check**: Uses **TensorFlow.js (MobileNet)** running entirely in the browser to verify if an uploaded photo contains road/pothole content.
- **Permissive Logic**: Accepts real-world road photos while strictly rejecting invalid content like selfies, food, or documents.
- **EXIF GPS**: Automatically extracts location data from photos for pinpoint accuracy.

### 🚗 Drive Safe Mode
- **Real-Time Voice Alerts**: "Caution! Critical pothole ahead, 50 meters."
- **Sequential Alerts**: Smart queuing system ensures you hear about the **nearest** hazard first.
- **Proximity Radar**: Scans a 500m radius and alerts you within 200m.
- **Background Tracking**: Optimized geolocation keeps tracking active even with intermittent GPS signals.

### 📊 Live Dashboard
- **Heatmap View**: Visualizes pothole density and severity across the city.
- **Leaderboard**: Gamified "Top Reporters" tracking to encourage community participation.
- **Real-Time Sync**: Powered by Firebase to show reports instantly as they happen.

## 🛠️ Technology Stack

- **Frontend**: React.js + Vite (Glassmorphism Design)
- **AI/ML**: TensorFlow.js, MobileNet (Client-side Image Classification)
- **Maps**: Leaflet.js, React-Leaflet, OpenStreetMap
- **Backend**: Firebase Realtime Database & Auth
- **Utilities**: Web Speech API (Voice), EXIF.js, Geolocation API

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SarthC/Pothole-Dealers.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

## 📱 How to Use

1. **Report a Pothole**: Click "Report Pothole", take a photo, and let our AI verify it. The location is auto-detected or you can manually enter location through fetching through gps or map pin.
2. **Drive Safe**: Before driving, toggle "Drive Safe Mode". The app will speak to you when hazards are near.
3. **View Dashboard**: Check the map to see fixed vs. active potholes in your area.

## 🤖 AI Implementation Details
We use a **permissive verification strategy** to handle real-world lighting and textures:
- **Strict Rejection**: Immediately blocks faces, indoor scenes, screenshots, and documents.
- **Road Detection**: Looks for asphalt, vehicles, and street patterns.
- **Ambiguity Handler**: If an image is ambiguous (e.g., close-up dirt) but not explicitly rejected, it is allowed to prevent false negatives.

## 👥 Team
Team Name: Pothole Dealers
Participated as a Solo team 
Team member: Sarthak Laxman Choudhari

## 📄 License
MIT License - see LICENSE file for details.
