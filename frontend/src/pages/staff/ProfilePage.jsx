import { useState, useEffect } from 'react'
import { User, Shield, Key, Save, CheckCircle2 } from 'lucide-react'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'

export default function ProfilePage() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [passForm, setPassForm] = useState({ current_password: '', password: '', password_confirmation: '' })
    const [passSaving, setPassSaving] = useState(false)
    const [errors, setErrors] = useState({})
    const [success, setSuccess] = useState('')

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get('/staff/profile')
                setProfile(res.data.data)
            } catch (err) {
                console.error('Failed to load profile', err)
            } finally {
                setLoading(false)
            }
        }
        fetchProfile()
    }, [])

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        setPassSaving(true); setErrors({}); setSuccess('')
        try {
            await api.patch('/staff/profile/change-password', passForm)
            setSuccess('Password updated successfully.')
            setPassForm({ current_password: '', password: '', password_confirmation: '' })
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors || { message: err.response.data.message })
            }
        } finally {
            setPassSaving(false)
        }
    }

    if (loading) return <Spinner fullScreen />

    const inputCls = "w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-400 mt-1">Manage your account information and security settings.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Info Card */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                        <div className="w-20 h-20 bg-[#0f1c2e] rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-bold mb-4">
                            {profile?.name?.[0]?.toUpperCase()}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{profile?.name}</h2>
                        <p className="text-sm text-gray-400 uppercase tracking-widest font-semibold mt-1">{profile?.role}</p>
                        <div className="mt-6 pt-6 border-t border-gray-50 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <User size={16} />
                                <span>{profile?.username}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                <Shield size={16} />
                                <span>Active Account</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Forms Area */}
                <div className="md:col-span-2 space-y-6">
                    {/* Security Form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                                <Key size={20} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-800">Security Credentials</h3>
                        </div>

                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Password</label>
                                <input type="password" value={passForm.current_password}
                                    onChange={e => setPassForm(f => ({ ...f, current_password: e.target.value }))}
                                    className={inputCls} placeholder="Verify your identity" />
                                {errors.current_password && <p className="text-xs text-red-500">{errors.current_password}</p>}
                                {errors.message && !errors.current_password && <p className="text-xs text-red-500">{errors.message}</p>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">New Password</label>
                                    <input type="password" value={passForm.password}
                                        onChange={e => setPassForm(f => ({ ...f, password: e.target.value }))}
                                        className={inputCls} placeholder="Min 6 characters" />
                                    {errors.password && <p className="text-xs text-red-500">{errors.password[0]}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm Password</label>
                                    <input type="password" value={passForm.password_confirmation}
                                        onChange={e => setPassForm(f => ({ ...f, password_confirmation: e.target.value }))}
                                        className={inputCls} placeholder="Repeat new password" />
                                </div>
                            </div>

                            {success && (
                                <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-center gap-3 text-sm font-medium">
                                    <CheckCircle2 size={18} /> {success}
                                </div>
                            )}

                            <div className="pt-4">
                                <button type="submit" disabled={passSaving}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-8 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50">
                                    <Save size={18} />
                                    {passSaving ? 'Updating...' : 'Save New Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}