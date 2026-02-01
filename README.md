# POFIX - AI-Powered Pothole Reporting & Navigation Platform

**A community-driven solution to fix roads faster and keep drivers safe.**

## 🎥 Product Demo
**Live App:** [https://po-ejhp2dpkw-sarthaks-projects-10914350.vercel.app/](https://po-ejhp2dpkw-sarthaks-projects-10914350.vercel.app/)
**Demo Video:** [Watch on Google Drive](https://drive.google.com/file/d/1QwxkwEn8Jgvm3OSWP2NLU5ZDERltcOK4/view?usp=drive_link)

---

## 🛑 Problem Statement
Potholes are a major cause of vehicle damage and fatal accidents globally, yet reporting them is often a slow, manual process. Authorities lack real-time data to prioritize repairs, leading to inefficient resource allocation and prolonged road hazards.

## 👥 Users & Context
*   **Daily Commuters:** Drivers and cyclists who are at risk of accidents and need real-time warnings.
*   **Municipal Corporations:** Government bodies needing verified, prioritized data to schedule repairs efficiently.
*   **NGOs & Volunteers:** Community groups looking for data-driven ways to improve local infrastructure.
*   **Context:** Used primarily on mobile devices while on the road (Drive Safe Mode) or when spotting a hazard (Reporting Mode).

---

## 💡 Solution Overview
POFIX bridges the gap between citizens and authorities through a three-pillared approach:
1.  **AI-Verified Reporting:** Citizens report potholes using camera-only photos, verified instantly by Edge AI to prevent spam.
2.  **Prioritized Dashboard:** Authorities see a live heatmap of hazards, automatically ranked by severity and report frequency.
3.  **Drive Safe Mode:** Drivers receive real-time audio alerts when approaching verified potholes, preventing accidents before repairs occur.

---

## 🛠️ Technology Stack
*   **Frontend:** React.js + Vite (Glassmorphism UI)
*   **AI Model:** TensorFlow.js + MobileNet (Client-side inference)
*   **Database & Auth:** Firebase Realtime Database, Storage, and Authentication
*   **Mapping:** Leaflet.js / OpenStreetMap
*   **APIs:** Web Speech API (Voice Alerts), Geolocation API, EXIF.js

---

## 🏃‍♂️ Setup & Run

### Prerequisites
*   Node.js (v16+)
*   npm

### Steps
1.  **Clone the Repository**
    ```bash
    git clone https://github.com/SarthC/Pothole-Dealers.git
    cd Pothole-Dealers
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Run Development Server**
    ```bash
    npm run dev
    ```

4.  **Open App**
    Visit `http://localhost:5173` in your browser.

---

## 🤖 Models & Data
*   **Model Used:** **MobileNet (TensorFlow.js)**.
*   **Justification:** Chosen for its ability to run strictly client-side (Edge AI), ensuring low latency and user privacy.
*   **Data Provenance:** The model is pre-trained on the **ImageNet** dataset (Open Source / BSD-3 License).
*   **Data Privacy:** No user photos are used for model training. User uploads are processed ephemerally for verification and stored securely in Firebase only after valid submission.

## 🛡️ Evaluation & Guardrails
To prevent misinformation and abuse:
1.  **Strict "Reject" Keywords:** The AI immediately blocks images containing faces, indoor settings, food, or screens/documents.
2.  **Confidence Thresholds:** Reports require >50% confidence in road-related classes (e.g., "asphalt", "street", "pavement").
3.  **GPS Enforcement:** Reports must have valid GPS coordinates (extracted from EXIF or device location) to prevent fake locations.
4.  **48-Hour Hard Limit:** Only metadata-verified photos taken within the last 48 hours are accepted to ensure current road conditions.

## ⚠️ Known Limitations & Risks
*   **Night/Low Light:** AI accuracy drops significantly in poor lighting conditions.
*   **Blurry Images:** Motion blur from moving vehicles can cause false rejections.
*   **Network Dependence:** While AI is offline-capable, submitting reports requires an active internet connection.

---

## 👥 Team
**Team Name:** Pothole Dealers

*   **Sarthak Laxman Choudhari** - *Lead Developer & Solo Contributor*
    *   Role: Full Stack Development, AI Integration, UI/UX Design

---

## 📄 License
This project is licensed under the **MIT License**.
