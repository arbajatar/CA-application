import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, User, Lock, ArrowRight, Eye, EyeOff, ChevronDown } from 'lucide-react'
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
            navigate(user.role === 'ca' ? '/ca/dashboard' : '/staff/dashboard')
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
                            className="w-full pl-10 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/30 focus:border-[#1F5C99] transition cursor-pointer"
                        >
                            {roles.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition p-1 z-10 cursor-pointer"
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
                        className="w-full bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60 cursor-pointer"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Authorizing...</span>
                            </>
                        ) : (
                            <>
                                <span>Authorize Access</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>

                    {/* Hint */}
                    <div className="pt-2 text-center border-t border-gray-100 mt-4">
                        <p className="text-xs text-gray-400 font-medium mb-2">Demo Access Credentials:</p>
                        <button
                            type="button"
                            onClick={() => {
                                if (role === 'ca') {
                                    setUsername('ca_admin')
                                    setPassword('admin@123')
                                } else {
                                    setUsername('sarthak')
                                    setPassword('staff@123')
                                }
                            }}
                            className="inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                            {role === 'ca' ? (
                                <>
                                    <ShieldCheck size={14} />
                                    <span>CA: <strong>ca_admin</strong> / <strong>admin@123</strong> (Click to auto-fill)</span>
                                </>
                            ) : (
                                <>
                                    <User size={14} />
                                    <span>Staff: <strong>sarthak</strong> / <strong>staff@123</strong> (Click to auto-fill)</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <p className="mt-6 text-xs text-gray-400 uppercase tracking-widest">© 2026 CA Office Suite</p>
        </div>
    )
}