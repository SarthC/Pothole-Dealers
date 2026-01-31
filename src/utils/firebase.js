// Firebase Configuration for Pofix
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getDatabase } from 'firebase/database'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: "AIzaSyBPHwa5SUM9wv1V4GMDFLK-aZ0y2a75Es4",
    authDomain: "pofix-platform.firebaseapp.com",
    projectId: "pofix-platform",
    storageBucket: "pofix-platform.firebasestorage.app",
    messagingSenderId: "853198621871",
    appId: "1:853198621871:web:99b58b9b8a879e6ac6185a",
    measurementId: "G-8YQ9W65LNZ",
    databaseURL: "https://pofix-platform-default-rtdb.asia-southeast1.firebasedatabase.app"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Auth
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// Storage (for images)
export const storage = getStorage(app)

// Realtime Database (for reports)
// Realtime Database (for reports)
export const database = getDatabase(app)

// Firestore (for new features)
export const db = getFirestore(app)

export default app
