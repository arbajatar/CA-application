import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, KeyRound, UserMinus, UserCheck, Eye, EyeOff, Shield, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'
import CustomSelect from '../../components/ui/CustomSelect'

const EMPTY_FORM = { name: '', username: '', password: '', role_ids: [], employee_code: '', address: '', email: '', mobile: '' }

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
            await api.post('/ca/staff', { ...form, role_ids: form.role_ids || [] })
            toast.success('Staff member added successfully')
            setAddOpen(false); setForm(EMPTY_FORM); fetchStaff()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
    }

    const handleEdit = async () => {
        setSaving(true); setErrors({})
        try {
            await api.put(`/ca/staff/${selected.id}`, { 
                name: form.name, 
                username: form.username, 
                role_ids: form.role_ids || [],
                employee_code: form.employee_code,
                address: form.address,
                email: form.email,
                mobile: form.mobile,
            })
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
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Members</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Manage your office staff, roles, and access credentials.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={() => { setRoleNameInput(''); setEditingRole(null); setRoleErrors({}); setRoleManagementOpen(true) }}
                        className="flex items-center justify-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition active:scale-95 w-full sm:w-auto">
                        <Shield size={16} /> Role Management
                    </button>
                    <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                        className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition active:scale-95 w-full sm:w-auto">
                        <Plus size={16} /> Add New Member
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-4">
                    <h2 className="text-base font-semibold text-gray-700 whitespace-nowrap">Staff Directory</h2>
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        {/* Role Filter */}
                        <CustomSelect
                            value={filterRoleId}
                            onChange={e => { setFilterRoleId(e.target.value); setPage(1) }}
                            options={[
                                { value: '', label: 'All Roles' },
                                ...roles.map(r => ({ value: r.id, label: r.name }))
                            ]}
                            widthClass="w-full sm:w-auto min-w-[125px]"
                        />

                        {/* Status Filter */}
                        <CustomSelect
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
                            options={[
                                { value: '', label: 'All Statuses' },
                                { value: 'active', label: 'Active Only' },
                                { value: 'inactive', label: 'Inactive Only' }
                            ]}
                            widthClass="w-full sm:w-auto min-w-[125px]"
                        />

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
                                            <div className="flex flex-wrap gap-1">
                                                {s.custom_roles && s.custom_roles.length > 0 ? (
                                                    s.custom_roles.map(r => (
                                                        <span key={r.id} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 uppercase">
                                                            {r.name}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 uppercase">
                                                        {s.role_label}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={s.is_active ? 'active' : 'inactive'} />
                                        </td>
                                        <td className="px-6 py-4">
                                             <div className="flex items-center gap-2">
                                                 <Tooltip content="Edit Member">
                                                     <button onClick={() => { setSelected(s); setForm({ name: s.name, username: s.username, role_ids: s.role_ids || [], password: '', employee_code: s.employee_code || '', address: s.address || '', email: s.email || '', mobile: s.mobile || '' }); setErrors({}); setEditOpen(true) }}
                                                         className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-805 hover:scale-110 active:scale-95 transition-all"><Pencil size={15} /></button>
                                                 </Tooltip>
                                                 <Tooltip content="Reset Password">
                                                     <button onClick={() => { setSelected(s); setResetPass({ password: '', password_confirmation: '' }); setErrors({}); setResetOpen(true) }}
                                                         className="p-1.5 rounded-lg bg-amber-50/70 border border-amber-100/40 text-amber-600 hover:bg-amber-100 hover:text-amber-800 hover:scale-110 active:scale-95 transition-all"><KeyRound size={15} /></button>
                                                 </Tooltip>
                                                 {s.is_active ? (
                                                     <Tooltip content="Deactivate Member">
                                                         <button onClick={() => { setSelected(s); setDeactivateOpen(true) }}
                                                             className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all"><UserMinus size={15} /></button>
                                                     </Tooltip>
                                                 ) : (
                                                     <Tooltip content="Activate Member">
                                                         <button onClick={() => { setSelected(s); setActivateOpen(true) }}
                                                             className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100/40 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 hover:scale-110 active:scale-95 transition-all"><UserCheck size={15} /></button>
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
                        {renderField("Employee Code", errors.employee_code?.[0], <input type="text" value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="Enter employee code" className={inputCls} />)}
                        {renderField("Email Address", errors.email?.[0], <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter email address" className={inputCls} />)}
                        {renderField("Mobile Number", errors.mobile?.[0], <input type="text" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="Enter mobile number" className={inputCls} />)}
                        {renderField("Address", errors.address?.[0], <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Enter address" className={`${inputCls} h-20 resize-none`} />)}
                        {renderField("Assign Roles", errors.role_ids?.[0], (
                            <div>
                                <div className="grid grid-cols-2 gap-2 border border-gray-150 rounded-xl p-3 bg-gray-50/50 max-h-36 overflow-y-auto">
                                    {roles.map(r => {
                                        const isChecked = form.role_ids?.includes(r.id);
                                        return (
                                            <label key={r.id} className="flex items-center gap-2 text-xs text-gray-700 font-semibold cursor-pointer select-none py-1 px-1.5 hover:bg-slate-100 rounded-md transition">
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setForm(f => {
                                                            const current = f.role_ids || [];
                                                            const updated = checked 
                                                                ? [...current, r.id] 
                                                                : current.filter(id => id !== r.id);
                                                            return { ...f, role_ids: updated };
                                                        });
                                                    }}
                                                    className="rounded border-gray-305 text-[#1F5C99] focus:ring-[#1F5C99]/20"
                                                />
                                                {r.name}
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex items-start gap-2 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-300 font-medium shadow-sm">
                                    <span className="text-amber-400 font-bold shrink-0">💡 Note:</span>
                                    <span>If multiple roles are assigned, the <strong className="text-amber-300">highest role's permissions</strong> will be applicable.</span>
                                </div>
                            </div>
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
                        {renderField("Employee Code", errors.employee_code?.[0], <input type="text" value={form.employee_code} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))} placeholder="Enter employee code" className={inputCls} />)}
                        {renderField("Email Address", errors.email?.[0], <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Enter email address" className={inputCls} />)}
                        {renderField("Mobile Number", errors.mobile?.[0], <input type="text" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="Enter mobile number" className={inputCls} />)}
                        {renderField("Address", errors.address?.[0], <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Enter address" className={`${inputCls} h-20 resize-none`} />)}
                        {renderField("Assign Roles", errors.role_ids?.[0], (
                            <div>
                                <div className="grid grid-cols-2 gap-2 border border-gray-150 rounded-xl p-3 bg-gray-50/50 max-h-36 overflow-y-auto">
                                    {roles.map(r => {
                                        const isChecked = form.role_ids?.includes(r.id);
                                        return (
                                            <label key={r.id} className="flex items-center gap-2 text-xs text-gray-700 font-semibold cursor-pointer select-none py-1 px-1.5 hover:bg-slate-100 rounded-md transition">
                                                <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        const checked = e.target.checked;
                                                        setForm(f => {
                                                            const current = f.role_ids || [];
                                                            const updated = checked 
                                                                ? [...current, r.id] 
                                                                : current.filter(id => id !== r.id);
                                                            return { ...f, role_ids: updated };
                                                        });
                                                    }}
                                                    className="rounded border-gray-305 text-[#1F5C99] focus:ring-[#1F5C99]/20"
                                                />
                                                {r.name}
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex items-start gap-2 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-300 font-medium shadow-sm">
                                    <span className="text-amber-400 font-bold shrink-0">💡 Note:</span>
                                    <span>If multiple roles are assigned, the <strong className="text-amber-300">highest role's permissions</strong> will be applicable.</span>
                                </div>
                            </div>
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
                                                        className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Delete Role" position="left">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleDeleteRoleClick(r)}
                                                        className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all"
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