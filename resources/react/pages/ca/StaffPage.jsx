import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, KeyRound, UserMinus, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = { name: '', username: '', password: '' }

export default function StaffPage() {
    const [staff, setStaff] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [resetOpen, setResetOpen] = useState(false)
    const [deactivateOpen, setDeactivateOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [resetPass, setResetPass] = useState({ password: '', password_confirmation: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [showResetPassword, setShowResetPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    const fetchStaff = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/staff', { params: { search, page, per_page: 15 } })
            setStaff(res.data.data)
            setMeta(res.data.meta)
        } finally { setLoading(false) }
    }, [search, page])

    useEffect(() => { fetchStaff() }, [fetchStaff])

    const handleAdd = async () => {
        setSaving(true); setErrors({})
        try {
            await api.post('/ca/staff', form)
            setAddOpen(false); setForm(EMPTY_FORM); fetchStaff()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleEdit = async () => {
        setSaving(true); setErrors({})
        try {
            await api.put(`/ca/staff/${selected.id}`, { name: form.name, username: form.username })
            setEditOpen(false); fetchStaff()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleReset = async () => {
        setSaving(true); setErrors({})
        try {
            await api.patch(`/ca/staff/${selected.id}/reset-password`, resetPass)
            setResetOpen(false); setResetPass({ password: '', password_confirmation: '' })
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleDeactivate = async () => {
        setSaving(true)
        try {
            await api.patch(`/ca/staff/${selected.id}/deactivate`)
            toast.success('Staff member deactivated successfully')
            setDeactivateOpen(false)
            fetchStaff()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to deactivate staff')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    const renderField = (label, error, children) => (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
                    <p className="text-sm text-gray-400 mt-1">Manage your office staff, roles, and access credentials.</p>
                </div>
                <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                    className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                    <Plus size={16} /> Add New Member
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-4">
                    <h2 className="text-base font-semibold text-gray-700 whitespace-nowrap">Staff Directory</h2>
                    <div className="relative w-full sm:w-52">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search staff..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full transition" />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['Staff Member', 'Username', 'Role', 'Account Status', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {staff?.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">No staff found</td></tr>
                                ) : staff?.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
                                                    {s.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{s.name}</p>
                                                    <p className="text-xs text-gray-400">CA Office Employee</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{s.username}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                {s.role.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={s.is_active ? 'active' : 'inactive'} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { setSelected(s); setForm({ name: s.name, username: s.username, password: '' }); setErrors({}); setEditOpen(true) }}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                <button onClick={() => { setSelected(s); setResetPass({ password: '', password_confirmation: '' }); setErrors({}); setResetOpen(true) }}
                                                    className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition"><KeyRound size={15} /></button>
                                                {s.is_active && (
                                                    <button onClick={() => { setSelected(s); setDeactivateOpen(true) }}
                                                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><UserMinus size={15} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">Showing {meta.from}–{meta.to} of {meta.total}</p>
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                            <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Modal */}
            <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Staff Member">
                <div className="space-y-4">
                    {renderField("Full Name *", errors.name?.[0], <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter full name" className={inputCls} />)}
                    {renderField("Username *", errors.username?.[0], <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Enter username" className={inputCls} />)}
                    {renderField("Password *", errors.password?.[0], (
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="Min 6 characters"
                                className={`${inputCls} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    ))}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleAdd} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Add Member'}</button>
                    </div>
                </div>
            </Modal>

            {/* Edit Modal */}
            <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Staff Member">
                <div className="space-y-4">
                    {renderField("Full Name *", errors.name?.[0], <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />)}
                    {renderField("Username *", errors.username?.[0], <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputCls} />)}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleEdit} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                </div>
            </Modal>

            {/* Reset Password Modal */}
            <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={`Reset Password — ${selected?.name}`}>
                <div className="space-y-4">
                    {renderField("New Password *", errors.password?.[0], (
                        <div className="relative">
                            <input
                                type={showResetPassword ? 'text' : 'password'}
                                value={resetPass.password}
                                onChange={e => setResetPass(r => ({ ...r, password: e.target.value }))}
                                placeholder="Min 6 characters"
                                className={`${inputCls} pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowResetPassword(!showResetPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                            >
                                {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    ))}
                    {renderField("Confirm Password *", errors.password_confirmation?.[0], (
                        <div className="relative">
                            <input
                                type={showResetPassword ? 'text' : 'password'}
                                value={resetPass.password_confirmation}
                                onChange={e => setResetPass(r => ({ ...r, password_confirmation: e.target.value }))}
                                placeholder="Repeat password"
                                className={`${inputCls} pr-10`}
                            />

                        </div>
                    ))}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setResetOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleReset} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Resetting...' : 'Reset Password'}</button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={deactivateOpen} onClose={() => setDeactivateOpen(false)} onConfirm={handleDeactivate} danger loading={saving}
                title="Deactivate Staff Member" message={`Deactivate "${selected?.name}"? They will lose access immediately.`} confirmLabel="Deactivate" />
        </div>
    )
}