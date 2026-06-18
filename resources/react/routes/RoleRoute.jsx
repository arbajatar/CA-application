import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function RoleRoute({ role, children }) {
    const { user } = useAuth()
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== role) {
        const dest = user.role === 'super_admin' ? '/backup' : (user.role === 'ca' ? '/ca/dashboard' : '/staff/tasks');
        return <Navigate to={dest} replace />
    }
    return children
}