import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Login.css'

function Login() {
    const { loginWithGoogle, isAuthenticated, user } = useAuth()
    const navigate = useNavigate()

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle()
            navigate('/report')
        } catch (error) {
            console.error('Login failed:', error)
        }
    }

    if (isAuthenticated) {
        return (
            <div className="login-page">
                <div className="login-container">
                    <div className="login-card">
                        <div className="user-profile">
                            <img
                                src={user?.photoURL || '/default-avatar.png'}
                                alt={user?.displayName || 'User'}
                                className="profile-avatar"
                            />
                            <h2>Welcome, {user?.displayName?.split(' ')[0]}!</h2>
                            <p className="profile-email">{user?.email}</p>
                        </div>

                        <div className="login-actions">
                            <button
                                onClick={() => navigate('/report')}
                                className="btn btn-primary w-full"
                            >
                                Report a Pothole
                            </button>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="btn btn-secondary w-full"
                            >
                                View Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <span className="login-logo">POFIX</span>
                        <h1>Sign In</h1>
                        <p>Join the community fixing roads</p>
                    </div>

                    <div className="login-methods">
                        <button
                            onClick={handleGoogleLogin}
                            className="btn-google"
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continue with Google
                        </button>
                    </div>

                    <div className="login-divider">
                        <span>or continue as guest</span>
                    </div>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn btn-secondary w-full"
                    >
                        Browse Dashboard
                    </button>

                    <p className="login-note">
                        Sign in to report potholes and track your contributions.
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Login
