import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Report from './pages/Report'
import Dashboard from './pages/Dashboard'
import DriveSafe from './pages/DriveSafe'
import Login from './pages/Login'
import { AuthProvider } from './context/AuthContext'

function App() {
    return (
        <AuthProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <div className="app">
                    <Navbar />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/report" element={<Report />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/drive" element={<DriveSafe />} />
                            <Route path="/login" element={<Login />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </AuthProvider>
    )
}

export default App
