import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, KeyRound, UserMinus, UserCheck, Eye, EyeOff, Shield, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'

const EMPTY_FORM = { name: '', username: '', password: '', role_id: '' }

export default function StaffPage() {
    const [staff, setStaff] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [filterRoleId, setFilterRoleId] = useState('')
    const [filterStatus, setFilterStatus] = useState('')

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [resetOpen, setResetOpen] = useState(false)
    const [deactivateOpen, setDeactivateOpen] = useState(false)
    const [activateOpen, setActivateOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [resetPass, setResetPass] = useState({ password: '', password_confirmation: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [showResetPassword, setShowResetPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    // Role Management States
    const [roles, setRoles] = useState([])
    const [rolesLoading, setRolesLoading] = useState(false)
    const [roleManagementOpen, setRoleManagementOpen] = useState(false)
    const [editingRole, setEditingRole] = useState(null)
    const [roleNameInput, setRoleNameInput] = useState('')
    const [roleSaving, setRoleSaving] = useState(false)
    const [roleErrors, setRoleErrors] = useState({})
    const [deleteRoleOpen, setDeleteRoleOpen] = useState(false)
    const [roleToDelete, setRoleToDelete] = useState(null)
    const [deletingRole, setDeletingRole] = useState(false)

    const fetchRoles = useCallback(async () => {
        setRolesLoading(true)
        try {
            const res = await api.get('/ca/roles')
            setRoles(res.data.data || [])
        } catch (e) {
            toast.error('Failed to load roles')
        } finally {
            setRolesLoading(false)
        }
    }, [])

    const handleSaveRole = async (e) => {
        e.preventDefault()
        if (!roleNameInput.trim()) return
        setRoleSaving(true)
        setRoleErrors({})
        try {
            if (editingRole) {
                await api.put(`/ca/roles/${editingRole.id}`, { name: roleNameInput })
                toast.success('Role updated successfully')
            } else {
                await api.post('/ca/roles', { name: roleNameInput })
                toast.success('Role created successfully')
            }
            setRoleNameInput('')
            setEditingRole(null)
            fetchRoles()
            fetchStaff()
        } catch (err) {
            setRoleErrors(err.response?.data?.errors ?? {})
            toast.error(err.response?.data?.message || 'Failed to save role')
        } finally {
            setRoleSaving(false)
        }
    }

    const handleDeleteRoleClick = (role) => {
        setRoleToDelete(role)
        setDeleteRoleOpen(true)
    }

    const confirmDeleteRole = async () => {
        if (!roleToDelete) return
        setDeletingRole(true)
        try {
            await api.delete(`/ca/roles/${roleToDelete.id}`)
            toast.success('Role deleted successfully')
            setDeleteRoleOpen(false)
            setRoleToDelete(null)
            fetchRoles()
            fetchStaff()
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete role')
        } finally {
            setDeletingRole(false)
        }
    }

    const fetchStaff = useCallback(async () => {
        setLoading(true)
        try {
            const params = { search, page, per_page: 15 }
            if (filterRoleId) params.role_id = filterRoleId
            if (filterStatus) params.is_active = filterStatus === 'active' ? 'true' : 'false'

            const res = await api.get('/ca/staff', { params })
            setStaff(res.data.data)
            setMeta(res.data.meta)
        } finally { setLoading(false) }
    }, [search, page, filterRoleId, filterStatus])

    useEffect(() => { fetchStaff(); fetchRoles() }, [fetchStaff, fetchRoles])

    const handleAdd = async () => {
        setSaving(true); setErrors({})
        try {
            await api.post('/ca/staff', { ...form, role_id: form.role_id || null })
            toast.success('Staff member added successfully')
            setAddOpen(false); setForm(EMPTY_FORM); fetchStaff()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleEdit = async () => {
        setSaving(true); setErrors({})
        try {
            await api.put(`/ca/staff/${selected.id}`, { name: form.name, username: form.username, role_id: form.role_id || null })
            toast.success('Staff member updated successfully')
            setEditOpen(false); fetchStaff()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleReset = async () => {
        setSaving(true); setErrors({})
        try {
            await api.patch(`/ca/staff/${selected.id}/reset-password`, resetPass)
            toast.success('Password reset successfully')
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

    const handleActivate = async () => {
        setSaving(true)
        try {
            await api.patch(`/ca/staff/${selected.id}/activate`)
            toast.success('Staff member activated successfully')
            setActivateOpen(false)
            fetchStaff()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to activate staff')
        } finally {
            setSaving(false)
        }
    }

    const handleCloseAdd = () => {
        setAddOpen(false)
        setForm(EMPTY_FORM)
        setErrors({})
    }

    const handleCloseEdit = () => {
        setEditOpen(false)
        setSelected(null)
        setForm(EMPTY_FORM)
        setErrors({})
    }

    const handleCloseReset = () => {
        setResetOpen(false)
        setSelected(null)
        setResetPass({ password: '', password_confirmation: '' })
        setErrors({})
    }

    const handleCloseDeactivate = () => {
        setDeactivateOpen(false)
        setSelected(null)
    }

    const handleCloseActivate = () => {
        setActivateOpen(false)
        setSelected(null)
    }

    const handleCloseDeleteRole = () => {
        setDeleteRoleOpen(false)
        setRoleToDelete(null)
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
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={() => { setRoleNameInput(''); setEditingRole(null); setRoleErrors({}); setRoleManagementOpen(true) }}
                        className="flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                        <Shield size={16} /> Role Management
                    </button>
                    <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                        className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                        <Plus size={16} /> Add New Member
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-4">
                    <h2 className="text-base font-semibold text-gray-700 whitespace-nowrap">Staff Directory</h2>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* Role Filter */}
                        <select 
                            value={filterRoleId} 
                            onChange={e => { setFilterRoleId(e.target.value); setPage(1) }}
                            className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-gray-600"
                        >
                            <option value="">All Roles</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>

                        {/* Status Filter */}
                        <select 
                            value={filterStatus} 
                            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                            className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-gray-600"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active Only</option>
                            <option value="inactive">Inactive Only</option>
                        </select>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-48">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" placeholder="Search staff..." value={search}
                                autoComplete="off"
                                name="staff_search_query"
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                className="pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full transition" />
                        </div>
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
                                                {s.role_label.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={s.is_active ? 'active' : 'inactive'} />
                                        </td>
                                        <td className="px-6 py-4">
                                             <div className="flex items-center gap-2">
                                                 <Tooltip content="Edit Member">
                                                     <button onClick={() => { setSelected(s); setForm({ name: s.name, username: s.username, role_id: s.role_id || '', password: '' }); setErrors({}); setEditOpen(true) }}
                                                         className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                 </Tooltip>
                                                 <Tooltip content="Reset Password">
                                                     <button onClick={() => { setSelected(s); setResetPass({ password: '', password_confirmation: '' }); setErrors({}); setResetOpen(true) }}
                                                         className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition"><KeyRound size={15} /></button>
                                                 </Tooltip>
                                                 {s.is_active ? (
                                                     <Tooltip content="Deactivate Member">
                                                         <button onClick={() => { setSelected(s); setDeactivateOpen(true) }}
                                                             className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><UserMinus size={15} /></button>
                                                     </Tooltip>
                                                 ) : (
                                                     <Tooltip content="Activate Member">
                                                         <button onClick={() => { setSelected(s); setActivateOpen(true) }}
                                                             className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-500 transition"><UserCheck size={15} /></button>
                                                     </Tooltip>
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
            {addOpen && (
                <Modal open={addOpen} onClose={handleCloseAdd} title="Add New Staff Member">
                    <div className="space-y-4">
                        {renderField("Full Name *", errors.name?.[0], <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter full name" className={inputCls} />)}
                        {renderField("Username *", errors.username?.[0], <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Enter username" className={inputCls} />)}
                        {renderField("Assign Role", errors.role_id?.[0], (
                            <select 
                                value={form.role_id || ''} 
                                onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} 
                                className={inputCls}
                            >
                                <option value="">Select Role</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        ))}
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
                            <button type="button" onClick={handleCloseAdd} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={handleAdd} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Add Member'}</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Modal */}
            {editOpen && selected && (
                <Modal open={editOpen} onClose={handleCloseEdit} title="Edit Staff Member">
                    <div className="space-y-4">
                        {renderField("Full Name *", errors.name?.[0], <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />)}
                        {renderField("Username *", errors.username?.[0], <input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} className={inputCls} />)}
                        {renderField("Assign Role", errors.role_id?.[0], (
                            <select 
                                value={form.role_id || ''} 
                                onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))} 
                                className={inputCls}
                            >
                                <option value="">Select Role</option>
                                {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        ))}
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={handleCloseEdit} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={handleEdit} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Role Management Modal */}
            {roleManagementOpen && (
                <Modal open={roleManagementOpen} onClose={() => setRoleManagementOpen(false)} title="Role Management">
                    <div className="space-y-6">
                        <form onSubmit={handleSaveRole} className="space-y-3">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {editingRole ? 'Edit Role Name' : 'Create New Role'}
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={roleNameInput} 
                                    onChange={e => setRoleNameInput(e.target.value)} 
                                    placeholder="e.g. Senior Accountant" 
                                    className={inputCls} 
                                    required
                                />
                                <button 
                                    type="submit" 
                                    disabled={roleSaving}
                                    className="px-5 py-2.5 bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition text-sm font-semibold whitespace-nowrap"
                                >
                                    {roleSaving ? 'Saving...' : (editingRole ? 'Update' : 'Create')}
                                </button>
                                {editingRole && (
                                    <button 
                                        type="button" 
                                        onClick={() => { setEditingRole(null); setRoleNameInput('') }}
                                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition text-sm font-semibold"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                            {roleErrors.name && <p className="text-xs text-red-500">{roleErrors.name[0]}</p>}
                        </form>

                        <div className="border-t border-gray-100 pt-4">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Existing Roles</h3>
                            {rolesLoading ? <Spinner /> : roles.length === 0 ? (
                                <p className="text-sm text-gray-400 py-2">No roles created yet.</p>
                            ) : (
                                <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
                                    {roles.map(r => (
                                        <div key={r.id} className="flex items-center justify-between py-2.5">
                                            <span className="text-sm font-medium text-gray-800">{r.name}</span>
                                            <div className="flex gap-2">
                                                <Tooltip content="Edit Role" position="left">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => { setEditingRole(r); setRoleNameInput(r.name); setRoleErrors({}) }}
                                                        className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Delete Role" position="left">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleDeleteRoleClick(r)}
                                                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Reset Password Modal */}
            {resetOpen && selected && (
                <Modal open={resetOpen} onClose={handleCloseReset} title={`Reset Password — ${selected.name}`}>
                    <form onSubmit={e => { e.preventDefault(); handleReset(); }} autoComplete="off" className="space-y-4">
                        {/* Dummy inputs to intercept browser autofill */}
                        <input type="text" name="prevent_autofill_username" style={{ display: 'none' }} autoComplete="off" />
                        <input type="password" name="prevent_autofill_password" style={{ display: 'none' }} autoComplete="off" />

                        {renderField("New Password *", errors.password?.[0], (
                            <div className="relative">
                                <input
                                    type={showResetPassword ? 'text' : 'password'}
                                    value={resetPass.password}
                                    onChange={e => setResetPass(r => ({ ...r, password: e.target.value }))}
                                    placeholder="Min 6 characters"
                                    autoComplete="new-password"
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
                                    autoComplete="new-password"
                                    className={`${inputCls} pr-10`}
                                />
                            </div>
                        ))}
                        <div className="flex justify-end gap-3 pt-2">
                            <button type="button" onClick={handleCloseReset} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                            <button type="button" onClick={handleReset} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Resetting...' : 'Reset Password'}</button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmDialog open={deactivateOpen} onClose={() => setDeactivateOpen(false)} onConfirm={handleDeactivate} danger loading={saving}
                title="Deactivate Staff Member" message={`Deactivate "${selected?.name}"? They will lose access immediately.`} confirmLabel="Deactivate" />

            <ConfirmDialog open={activateOpen} onClose={() => setActivateOpen(false)} onConfirm={handleActivate} loading={saving}
                title="Activate Staff Member" message={`Activate "${selected?.name}"? They will regain access immediately.`} confirmLabel="Activate" />

            <ConfirmDialog open={deleteRoleOpen} onClose={() => { setDeleteRoleOpen(false); setRoleToDelete(null); }} onConfirm={confirmDeleteRole} danger loading={deletingRole}
                title="Delete Role" message={`Are you sure you want to delete the role "${roleToDelete?.name}"? Users assigned to this role will have their role cleared.`} confirmLabel="Delete" />
        </div>
    )
}