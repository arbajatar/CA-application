import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const roles = [
    { value: 'ca', label: 'CA / Administrator' },
    { value: 'staff', label: 'Staff Member' },
]

export default function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()

    const [role, setRole] = useState('ca')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const user = await login(username, password)
            if (user.role !== role) {
                setError(`This account is not a ${role === 'ca' ? 'CA / Administrator' : 'Staff Member'}.`)
                return
            }
            navigate(user.role === 'ca' ? '/ca/dashboard' : '/staff/tasks')
        } catch (err) {
            setError(err.response?.data?.message ?? 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

                {/* Icon */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 flex items-center justify-center mb-4 overflow-hidden">
                        <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">CA Management</h1>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Executive Work Suite</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Role selector */}
                    <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/30 focus:border-[#1F5C99] transition"
                        >
                            {roles.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Username */}
                    <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/30 focus:border-[#1F5C99] transition"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/30 focus:border-[#1F5C99] transition"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
                    >
                        {loading ? 'Authorizing...' : 'Authorize Access'}
                        {!loading && <ArrowRight size={16} />}
                    </button>

                    {/* Hint */}
                    <p className="text-center text-xs text-gray-400">
                        CA: ca_admin / admin@123 &nbsp;|&nbsp; Staff: sarthak / staff@123
                    </p>
                </form>
            </div>
            <p className="mt-6 text-xs text-gray-400 uppercase tracking-widest">© 2026 CA Office Suite</p>
        </div>
    )
}