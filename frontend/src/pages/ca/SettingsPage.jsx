import { useState, useEffect } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, Save } from 'lucide-react'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

export default function SettingsPage() {
    const [workTypes, setWorkTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [wtModal, setWtModal] = useState(false)
    const [editWt, setEditWt] = useState(null)
    const [wtName, setWtName] = useState('')
    const [wtError, setWtError] = useState('')
    const [saving, setSaving] = useState(false)

    const [passForm, setPassForm] = useState({ current_password: '', password: '', password_confirmation: '' })
    const [passError, setPassError] = useState('')
    const [passSuccess, setPassSuccess] = useState('')
    const [passSaving, setPassSaving] = useState(false)

    const fetchWorkTypes = async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/work-types')
            setWorkTypes(res.data.data)
        } finally { setLoading(false) }
    }

    useEffect(() => { fetchWorkTypes() }, [])

    const handleSaveWt = async () => {
        setSaving(true); setWtError('')
        try {
            if (editWt) await api.put(`/ca/work-types/${editWt.id}`, { name: wtName })
            else await api.post('/ca/work-types', { name: wtName })
            setWtModal(false); setWtName(''); setEditWt(null); fetchWorkTypes()
        } catch (e) { setWtError(e.response?.data?.errors?.name?.[0] ?? 'Error saving work type') }
        finally { setSaving(false) }
    }

    const handleToggle = async (wt) => {
        setSaving(true)
        try {
            await api.patch(`/ca/work-types/${wt.id}/toggle`)
            fetchWorkTypes()
        } catch (err) {
            console.error('Toggle failed', err)
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassSaving(true); setPassError(''); setPassSuccess('')
        try {
            await api.patch('/ca/settings/change-password', passForm)
            setPassSuccess('Password changed successfully.')
            setPassForm({ current_password: '', password: '', password_confirmation: '' })
        } catch (err) {
            setPassError(err.response?.data?.message ?? 'Something went wrong.')
        } finally { setPassSaving(false) }
    }

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
                <p className="text-sm text-gray-400 mt-1">Configure office preferences and manage your administrative account.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Work Type Management */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-base font-semibold text-gray-800">Work Type Management</h2>
                        <button onClick={() => { setEditWt(null); setWtName(''); setWtError(''); setWtModal(true) }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[#1F5C99] hover:text-[#1a4f85] transition">
                            <Plus size={14} /> ADD NEW TYPE
                        </button>
                    </div>
                    {loading ? <Spinner /> : (
                        <div className="space-y-2">
                            {workTypes?.map(wt => (
                                <div key={wt.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                                    <span className={`text-sm font-medium ${wt.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                                        {wt.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => { setEditWt(wt); setWtName(wt.name); setWtError(''); setWtModal(true) }}
                                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={() => handleToggle(wt)} className="text-gray-400 hover:text-gray-600 transition">
                                            {wt.is_active
                                                ? <ToggleRight size={22} className="text-green-500" />
                                                : <ToggleLeft size={22} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Security */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-base font-semibold text-gray-800 mb-5">Security & Credentials</h2>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Password</label>
                            <input type="password" value={passForm.current_password}
                                onChange={e => setPassForm(f => ({ ...f, current_password: e.target.value }))}
                                placeholder="Enter current password" className={inputCls} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Secure Password</label>
                            <input type="password" value={passForm.password}
                                onChange={e => setPassForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="Enter new password" className={inputCls} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
                            <input type="password" value={passForm.password_confirmation}
                                onChange={e => setPassForm(f => ({ ...f, password_confirmation: e.target.value }))}
                                placeholder="Repeat new password" className={inputCls} />
                        </div>
                        {passError && <p className="text-xs text-red-500">{passError}</p>}
                        {passSuccess && <p className="text-xs text-green-600">{passSuccess}</p>}
                        <button type="submit" disabled={passSaving}
                            className="w-full flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:opacity-60">
                            <Save size={15} />
                            {passSaving ? 'Updating...' : 'Update Security Credentials'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Work Type Modal */}
            <Modal open={wtModal} onClose={() => setWtModal(false)} title={editWt ? 'Edit Work Type' : 'Add Work Type'} width="max-w-sm">
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Type Name *</label>
                        <input type="text" value={wtName} onChange={e => setWtName(e.target.value)}
                            placeholder="e.g. Income Tax Return" className={inputCls} />
                        {wtError && <p className="text-xs text-red-500">{wtError}</p>}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setWtModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleSaveWt} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}