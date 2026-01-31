import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

function Navbar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const { user, logout, isAuthenticated } = useAuth()
    const location = useLocation()

    const handleLogout = async () => {
        try {
            await logout()
            setIsMenuOpen(false)
        } catch (error) {
            console.error('Logout failed:', error)
        }
    }

    const isActive = (path) => location.pathname === path

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-logo">
                    <span className="logo-text">POFIX</span>
                </Link>

                <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
                    <Link
                        to="/"
                        className={`navbar-link ${isActive('/') ? 'active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Home
                    </Link>
                    <Link
                        to="/report"
                        className={`navbar-link ${isActive('/report') ? 'active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Report
                    </Link>
                    <Link
                        to="/dashboard"
                        className={`navbar-link ${isActive('/dashboard') ? 'active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Dashboard
                    </Link>
                    <Link
                        to="/drive"
                        className={`navbar-link drive-link ${isActive('/drive') ? 'active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        🚗 Drive Safe
                    </Link>

                    <div className="navbar-auth">
                        {isAuthenticated ? (
                            <div className="user-menu">
                                <img
                                    src={user?.photoURL || '/default-avatar.png'}
                                    alt={user?.displayName || 'User'}
                                    className="user-avatar"
                                />
                                <span className="user-name hidden-mobile">{user?.displayName?.split(' ')[0]}</span>
                                <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                                    Logout
                                </button>
                            </div>
                        ) : (
                            <Link
                                to="/login"
                                className="btn btn-primary btn-sm"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                </div>

                <button
                    className="navbar-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <span className={`hamburger ${isMenuOpen ? 'active' : ''}`}></span>
                </button>
            </div>
        </nav>
    )
}

export default Navbar
