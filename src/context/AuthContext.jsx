import { createContext, useContext, useState, useEffect } from 'react'
import { auth, googleProvider } from '../utils/firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

const AuthContext = createContext()

export function useAuth() {
    return useContext(AuthContext)
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user)
            setLoading(false)
        })

        return unsubscribe
    }, [])

    const loginWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider)
            return result.user
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    }

    const logout = async () => {
        try {
            await signOut(auth)
        } catch (error) {
            console.error('Logout error:', error)
            throw error
        }
    }

    const value = {
        user,
        loading,
        loginWithGoogle,
        logout,
        isAuthenticated: !!user
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
