import { useState, useEffect } from 'react'
import { Lock, ShieldCheck, Save, Eye, EyeOff, User as UserIcon, Camera, Mail, Phone, MapPin, BadgeInfo } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'

export default function ProfilePage() {
    const { user, updateUser } = useAuth()

    // Passwords state
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

    // Info state
    const [infoForm, setInfoForm] = useState({
        email: user?.email || '',
        mobile: user?.mobile || '',
        address: user?.address || '',
    })
    const [savingInfo, setSavingInfo] = useState(false)
    const [infoError, setInfoError] = useState('')
    const [infoSuccess, setInfoSuccess] = useState('')

    useEffect(() => {
        if (user) {
            setInfoForm({
                email: user.email || '',
                mobile: user.mobile || '',
                address: user.address || '',
            })
        }
    }, [user])

    const handlePasswordSubmit = async (e) => {
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

    const handleInfoSubmit = async (e) => {
        e.preventDefault()
        setSavingInfo(true); setInfoError(''); setInfoSuccess('')
        try {
            const res = await api.post('/staff/profile', infoForm)
            updateUser(res.data.data)
            setInfoSuccess('Account information updated successfully.')
        } catch (err) {
            setInfoError(err.response?.data?.message ?? 'Something went wrong.')
        } finally { setSavingInfo(false) }
    }

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Profile photo must be less than 2MB.')
            return
        }

        const toastId = toast.loading('Uploading profile photo...')
        try {
            const formData = new FormData()
            formData.append('profile_photo', file)
            formData.append('email', infoForm.email)
            formData.append('mobile', infoForm.mobile)
            formData.append('address', infoForm.address)

            const res = await api.post('/staff/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            updateUser(res.data.data)
            toast.success('Profile photo updated successfully!', { id: toastId })
        } catch (err) {
            toast.error(err.response?.data?.message ?? 'Failed to upload photo.', { id: toastId })
        }
    }

    const inputCls = "w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition duration-200"
    const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5"

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Profile</h1>
                <p className="text-sm text-gray-400 mt-1">
                    Manage your personal details, profile picture, and security.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

                {/* Left Column: Profile Card + Change Password */}
                <div className="flex flex-col gap-6">
                    
                    {/* Profile Card & Photo */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col items-center justify-center text-center gap-4 flex-grow">
                        <div className="relative group">
                            {user?.profile_photo_url ? (
                                <img
                                    src={user.profile_photo_url}
                                    alt={user.name}
                                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md group-hover:brightness-90 transition duration-200"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 border border-blue-100 flex items-center justify-center text-3xl font-extrabold text-blue-600 shadow-inner">
                                    {user?.name?.[0]?.toUpperCase()}
                                </div>
                            )}
                            <label className="absolute -bottom-2 -right-2 w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all duration-200">
                                <Camera size={16} />
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handlePhotoChange}
                                />
                            </label>
                        </div>

                        <div className="space-y-1">
                            <p className="text-lg font-extrabold text-gray-900 leading-tight">{user?.name}</p>
                            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                                {user?.role_label ?? user?.role}
                            </p>
                        </div>

                        <div className="w-full pt-3 border-t border-gray-100 flex flex-col items-center justify-center text-center">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
                                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    ACTIVE
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Change Password */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                                    <Lock size={16} />
                                </div>
                                <h2 className="text-sm font-bold text-gray-800">Security & Password</h2>
                            </div>
                            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                                <div className="space-y-1">
                                    <label className={labelCls}>Current Password</label>
                                    <div className="relative">
                                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showCurrentPassword ? 'text' : 'password'}
                                            value={form.current_password}
                                            onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
                                            placeholder="••••••••"
                                            className={`${inputCls} pl-10 pr-10`}
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
                                    <label className={labelCls}>New Password</label>
                                    <div className="relative">
                                        <ShieldCheck size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type={showNewPassword ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                            placeholder="••••••••"
                                            className={`${inputCls} pl-10 pr-10`}
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

                                <div className="space-y-1">
                                    <label className={labelCls}>Confirm Password</label>
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

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-60 hover:shadow-lg active:scale-95 duration-150"
                                >
                                    <Save size={14} />
                                    {saving ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    </div>

                </div>

                {/* Right Column: Account Information */}
                <div className="lg:col-span-2 flex flex-col h-full">

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col flex-grow justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                                    <UserIcon size={16} />
                                </div>
                                <h2 className="text-lg font-bold text-gray-800">Account Information</h2>
                            </div>
                            <form onSubmit={handleInfoSubmit} className="space-y-4 flex-grow flex flex-col justify-between">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Employee Code</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user?.employee_code || 'Not Assigned'}
                                        className="w-full px-4 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed font-medium"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Access Role</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user?.role_label || 'Staff'}
                                        className="w-full px-4 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed font-medium"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Username</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={user?.username || ''}
                                        className="w-full px-4 py-2.5 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed font-medium"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Mobile Number</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={infoForm.mobile}
                                            onChange={e => setInfoForm({ ...infoForm, mobile: e.target.value })}
                                            className={`${inputCls} pl-10`}
                                            placeholder="Enter mobile number"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Email Address</label>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="email"
                                        value={infoForm.email}
                                        onChange={e => setInfoForm({ ...infoForm, email: e.target.value })}
                                        className={`${inputCls} pl-10`}
                                        placeholder="Enter email address"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Address</label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3.5 top-4 text-gray-400" />
                                    <textarea
                                        value={infoForm.address}
                                        onChange={e => setInfoForm({ ...infoForm, address: e.target.value })}
                                        className={`${inputCls} pl-10 h-24 resize-none`}
                                        placeholder="Enter your address"
                                    />
                                </div>
                            </div>

                            {infoError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{infoError}</p>}
                            {infoSuccess && <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-xl px-3 py-2">{infoSuccess}</p>}

                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingInfo}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60 hover:shadow-lg hover:shadow-blue-500/20 active:scale-95 duration-150"
                                >
                                    <Save size={15} />
                                    {savingInfo ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

            </div>
        </div>
    </div>
)
}