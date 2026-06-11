import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
    const { login } = useAuth()
    const navigate = useNavigate()

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
            navigate(user.role === 'ca' ? '/ca/dashboard' : '/staff/dashboard')
        } catch (err) {
            setError(err.response?.data?.message ?? 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0f1c2e] via-[#1a304e] to-[#0f1c2e] flex flex-col items-center justify-center px-4 relative overflow-hidden">
            {/* Blue glowing ambient circles */}
            <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-tr from-blue-600/20 via-indigo-600/10 to-transparent blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-br from-sky-500/20 via-blue-500/10 to-transparent blur-[120px] pointer-events-none"></div>

            <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-8 relative z-10">
                {/* Logo & Title */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-24 h-24 flex items-center justify-center mb-4 overflow-hidden bg-white rounded-2xl p-2 shadow-md hover:scale-105 transition duration-300">
                        <img src="/CA_LOGO-png.png" alt="CA Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight">CA Office Portal</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Unified Work Suite</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Username */}
                    <div className="relative">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-sm text-gray-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0f1c2e]/20 focus:border-[#0f1c2e] transition-all font-semibold"
                        />
                    </div>

                    {/* Password */}
                    <div className="relative">
                        <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full pl-11 pr-12 py-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-2xl text-sm text-gray-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0f1c2e]/20 focus:border-[#0f1c2e] transition-all font-semibold"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition p-1 z-10 cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-rose-50/80 border border-rose-200/50 text-rose-600 text-xs font-bold rounded-2xl px-4 py-3 animate-pulse">
                            {error}
                        </div>
                    )}

                    {/* Submit - Dark Blue Premium Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#0f1c2e] hover:bg-[#1a304e] hover:shadow-lg active:scale-98 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition duration-200 disabled:opacity-60 cursor-pointer shadow-md"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Authenticating credentials...</span>
                            </>
                        ) : (
                            <>
                                <span>Authorize Access</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>
            </div>
            
            <div className="mt-8 flex items-center justify-center gap-2 select-none opacity-80 z-10">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by</span>
                <div className="w-[1px] h-3 bg-slate-700"></div>
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider">Tipic</span>
            </div>
        </div>
    )
}