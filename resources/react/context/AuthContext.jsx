import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (token) {
            api.get('/me')
                .then(res => setUser(res.data.user))
                .catch(err => {
                    console.error("Session verification failed:", err)
                    // Only clear authentication if it is explicitly a 401 Unauthorized response from the server.
                    // This prevents transient network failures or temporary server reboots from logging out the user.
                    if (err.response && err.response.status === 401) {
                        clearAuth()
                    }
                })
                .finally(() => setLoading(false))
        } else {
            setLoading(false)
        }
    }, [])

    const login = async (username, password) => {
        const res = await api.post('/login', { username, password })
        localStorage.setItem('token', res.data.token)
        setToken(res.data.token)
        setUser(res.data.user)
        return res.data.user
    }

    const logout = async () => {
        try { await api.post('/logout') } catch (_) { }
        clearAuth()
    }

    const clearAuth = () => {
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)