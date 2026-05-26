import { useState } from 'react'
import { Lock, ShieldCheck, Save, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'

export default function ProfilePage() {
    const { user } = useAuth()

    const [form, setForm] = useState({
        current_password: '',
        password: '',
        password_confirmation: '',
    })
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true); setError(''); setSuccess('')
        try {
            await api.patch('/staff/profile/change-password', form)
            setSuccess('Password changed successfully.')
            setForm({ current_password: '', password: '', password_confirmation: '' })
        } catch (err) {
            setError(err.response?.data?.message ?? 'Something went wrong.')
        } finally { setSaving(false) }
    }

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
                <p className="text-sm text-gray-400 mt-1">
                    Manage your personal information and account security.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center text-center gap-4">
                    <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-500">
                        {user?.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <p className="text-lg font-bold text-gray-900">{user?.name}</p>
                        <p className="text-xs font-semibold text-[#1F5C99] uppercase tracking-wider mt-1">
                            {user?.role_label ?? user?.role}
                        </p>
                    </div>
                    <div className="w-full pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ACTIVE
                        </span>
                    </div>
                </div>

                {/* Info + Password */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Account Info */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">Account Information</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Username</p>
                                <p className="text-sm font-semibold text-gray-800">{user?.username}</p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Office Role</p>
                                <p className="text-sm font-semibold text-gray-800">{user?.role_label ?? 'Staff'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-base font-semibold text-gray-800 mb-4">Security & Password</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Current Password
                                    </label>
                                    <div className="relative">
                                        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={form.current_password}
                                            onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
                                            placeholder="••••••••"
                                            className="w-full pl-9 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition z-10 cursor-pointer"
                                        >
                                            {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        New Secure Password
                                    </label>
                                    <div className="relative">
                                        <ShieldCheck size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            placeholder="••••••••"
                                            className="w-full pl-9 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition z-10 cursor-pointer"
                                        >
                                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={form.password_confirmation}
                                        onChange={e => setForm(f => ({ ...f, password_confirmation: e.target.value }))}
                                        placeholder="••••••••"
                                        className={`${inputCls} pr-10`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition z-10 cursor-pointer"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
                            {success && <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">{success}</p>}

                            <div className="flex justify-center">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60"
                                >
                                    <Save size={15} />
                                    {saving ? 'Updating...' : 'Update Credentials'}
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            </div>
        </div>
    )
}