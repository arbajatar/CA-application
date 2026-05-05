import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()
    if (loading) return <Spinner fullScreen />
    if (!user) return <Navigate to="/login" replace />
    return children
}
