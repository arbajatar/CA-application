import { useState, useEffect } from 'react'
import { Plus, Pencil, ToggleLeft, ToggleRight, Save, Eye, EyeOff, Folder, Layers, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import Tooltip from '../../components/ui/Tooltip'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('work-types')

    // Work Types state
    const [workTypes, setWorkTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [wtModal, setWtModal] = useState(false)
    const [editWt, setEditWt] = useState(null)
    const [wtName, setWtName] = useState('')
    const [wtError, setWtError] = useState('')
    const [saving, setSaving] = useState(false)

    // Password state
    const [passForm, setPassForm] = useState({ current_password: '', password: '', password_confirmation: '' })
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [passError, setPassError] = useState('')
    const [passSuccess, setPassSuccess] = useState('')
    const [passSaving, setPassSaving] = useState(false)

    // Groups & Types state
    const [types, setTypes] = useState([])
    const [groups, setGroups] = useState([])
    const [lookupsLoading, setLookupsLoading] = useState(false)
    
    // Add/Edit Type modal states
    const [addTypeOpen, setAddTypeOpen] = useState(false)
    const [editingType, setEditingType] = useState(null)
    const [newTypeName, setNewTypeName] = useState('')
    const [newTypePanChar, setNewTypePanChar] = useState('')
    
    // Add/Edit Group modal states
    const [addGroupOpen, setAddGroupOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [newGroupName, setNewGroupName] = useState('')

    // Delete confirmation dialog states
    const [deleteTypeOpen, setDeleteTypeOpen] = useState(false)
    const [typeToDelete, setTypeToDelete] = useState(null)
    const [deleteGroupOpen, setDeleteGroupOpen] = useState(false)
    const [groupToDelete, setGroupToDelete] = useState(null)
    const [deleteWtOpen, setDeleteWtOpen] = useState(false)
    const [wtToDelete, setWtToDelete] = useState(null)

    const fetchWorkTypes = async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/work-types')
            setWorkTypes(res.data.data)
        } finally { setLoading(false) }
    }

    const fetchLookups = async () => {
        setLookupsLoading(true)
        try {
            const [typesRes, groupsRes] = await Promise.all([
                api.get('/ca/client-types'),
                api.get('/ca/client-groups')
            ])
            setTypes(typesRes.data.data || [])
            setGroups(groupsRes.data.data || [])
        } catch (e) {
            toast.error('Failed to load client types and groups')
        } finally {
            setLookupsLoading(false)
        }
    }

    useEffect(() => { 
        fetchWorkTypes() 
        fetchLookups()
    }, [])

    const handleSaveWt = async () => {
        setSaving(true); setWtError('')
        try {
            if (editWt) await api.put(`/ca/work-types/${editWt.id}`, { name: wtName })
            else await api.post('/ca/work-types', { name: wtName })

            toast.success(`Work type ${editWt ? 'updated' : 'added'} successfully`)
            setWtModal(false); setWtName(''); setEditWt(null); fetchWorkTypes()
        } catch (e) {
            const msg = e.response?.data?.errors?.name?.[0] ?? 'Error saving work type'
            setWtError(msg)
            toast.error(msg)
        }
        finally { setSaving(false) }
    }

    const handleOpenDeleteWt = (wt) => {
        setWtToDelete(wt)
        setDeleteWtOpen(true)
    }

    const confirmDeleteWt = async () => {
        if (!wtToDelete) return
        setSaving(true)
        try {
            await api.delete(`/ca/work-types/${wtToDelete.id}`)
            toast.success('Work type and all its contents moved to Recycle Bin successfully')
            setDeleteWtOpen(false)
            setWtToDelete(null)
            fetchWorkTypes()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete work type')
        } finally {
            setSaving(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        setPassSaving(true); setPassError(''); setPassSuccess('')
        try {
            await api.patch('/ca/settings/change-password', passForm)
            toast.success('Security credentials updated successfully')
            setPassSuccess('Password changed successfully.')
            setPassForm({ current_password: '', password: '', password_confirmation: '' })
        } catch (err) {
            const msg = err.response?.data?.message ?? 'Something went wrong.'
            setPassError(msg)
            toast.error(msg)
        } finally { setPassSaving(false) }
    }

    const handleCreateType = async () => {
        if (!newTypeName.trim()) {
            toast.error('Type name is required')
            return
        }
        setSaving(true)
        try {
            if (editingType) {
                const res = await api.put(`/ca/client-types/${editingType.id}`, {
                    name: newTypeName.trim(),
                    pan_char: newTypePanChar.trim().toUpperCase()
                })
                setTypes(prev => prev.map(t => t.id === editingType.id ? res.data.data : t))
                toast.success('Client type updated successfully')
            } else {
                const res = await api.post('/ca/client-types', {
                    name: newTypeName.trim(),
                    pan_char: newTypePanChar.trim().toUpperCase()
                })
                setTypes(prev => [...prev, res.data.data])
                toast.success('Client type added successfully')
            }
            setNewTypeName('')
            setNewTypePanChar('')
            setEditingType(null)
            setAddTypeOpen(false)
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save client type')
        } finally {
            setSaving(false)
        }
    }

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            toast.error('Group name is required')
            return
        }
        setSaving(true)
        try {
            if (editingGroup) {
                const res = await api.put(`/ca/client-groups/${editingGroup.id}`, {
                    name: newGroupName.trim()
                })
                setGroups(prev => prev.map(g => g.id === editingGroup.id ? res.data.data : g))
                toast.success('Client group updated successfully')
            } else {
                const res = await api.post('/ca/client-groups', {
                    name: newGroupName.trim()
                })
                setGroups(prev => [...prev, res.data.data])
                toast.success('Client group added successfully')
            }
            setNewGroupName('')
            setEditingGroup(null)
            setAddGroupOpen(false)
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to save client group')
        } finally {
            setSaving(false)
        }
    }

    const confirmDeleteType = async () => {
        if (!typeToDelete) return
        setSaving(true)
        try {
            await api.delete(`/ca/client-types/${typeToDelete.id}`)
            setTypes(prev => prev.filter(t => t.id !== typeToDelete.id))
            toast.success('Client type deleted successfully')
            setDeleteTypeOpen(false)
            setTypeToDelete(null)
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete client type')
        } finally {
            setSaving(false)
        }
    }

    const confirmDeleteGroup = async () => {
        if (!groupToDelete) return
        setSaving(true)
        try {
            await api.delete(`/ca/client-groups/${groupToDelete.id}`)
            setGroups(prev => prev.filter(g => g.id !== groupToDelete.id))
            toast.success('Client group deleted successfully')
            setDeleteGroupOpen(false)
            setGroupToDelete(null)
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete client group')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
    const labelCls = "text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1"

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
                <p className="text-sm font-medium text-slate-500 mt-1">Configure office preferences and manage your administrative account.</p>
            </div>

            {/* Pill Navigation Tabs */}
            <div className="flex flex-wrap gap-2 pb-2">
                <button
                    onClick={() => setActiveTab('work-types')}
                    className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
                        activeTab === 'work-types'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-250/70'
                    }`}
                >
                    Work Type Management
                </button>
                <button
                    onClick={() => setActiveTab('password')}
                    className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
                        activeTab === 'password'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-250/70'
                    }`}
                >
                    Change Password
                </button>
                <button
                    onClick={() => setActiveTab('groups-types')}
                    className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full transition-all ${
                        activeTab === 'groups-types'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-250/70'
                    }`}
                >
                    Add Group / Type
                </button>
            </div>

            {/* Tab Contents */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 min-h-[400px]">
                {activeTab === 'work-types' && (
                    <div className="space-y-5">
                        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                            <div>
                                <h2 className="text-base font-bold text-gray-800">Work Type Management</h2>
                                <p className="text-xs font-medium text-gray-400 mt-0.5">Define category and classifications of jobs in the firm.</p>
                            </div>
                            <button onClick={() => { setEditWt(null); setWtName(''); setWtError(''); setWtModal(true) }}
                                className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1c324e] text-white px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition active:scale-95">
                                <Plus size={15} /> Add New Type
                            </button>
                        </div>
                        {loading ? <Spinner /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {workTypes?.map(wt => (
                                    <div key={wt.id} className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-2xl transition">
                                        <span className="text-sm font-semibold text-gray-800">
                                            {wt.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Tooltip content="Edit Work Type">
                                                <button onClick={() => { setEditWt(wt); setWtName(wt.name); setWtError(''); setWtModal(true) }}
                                                    className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all">
                                                    <Pencil size={14} />
                                                </button>
                                            </Tooltip>
                                            <Tooltip content="Delete Work Type" position="left">
                                                <button onClick={() => handleOpenDeleteWt(wt)} 
                                                    className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all">
                                                    <Trash2 size={13} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'password' && (
                    <div className="max-w-md space-y-5">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Security & Credentials</h2>
                            <p className="text-xs font-medium text-gray-400 mt-0.5">Keep your account secure by updating your administrator password.</p>
                        </div>
                        <form onSubmit={handleChangePassword} className="space-y-4 pt-2">
                            <div className="space-y-1">
                                <label className={labelCls}>Current Password</label>
                                <div className="relative">
                                    <input type={showCurrentPassword ? 'text' : 'password'} value={passForm.current_password}
                                        onChange={e => setPassForm(f => ({ ...f, current_password: e.target.value }))}
                                        placeholder="Enter current password" className={`${inputCls} pr-10`} required />
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
                                <label className={labelCls}>New Secure Password</label>
                                <div className="relative">
                                    <input type={showNewPassword ? 'text' : 'password'} value={passForm.password}
                                        onChange={e => setPassForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Enter new password" className={`${inputCls} pr-10`} required />
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
                                <label className={labelCls}>Confirm New Password</label>
                                <div className="relative">
                                    <input type={showConfirmPassword ? 'text' : 'password'} value={passForm.password_confirmation}
                                        onChange={e => setPassForm(f => ({ ...f, password_confirmation: e.target.value }))}
                                        placeholder="Repeat new password" className={`${inputCls} pr-10`} required />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition z-10 cursor-pointer"
                                    >
                                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
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
                )}

                {activeTab === 'groups-types' && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Add Group / Type</h2>
                            <p className="text-xs font-medium text-gray-400 mt-0.5">Manage custom groups and client registration types.</p>
                        </div>
                        {lookupsLoading ? <Spinner /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Client Types Column */}
                                <div className="space-y-4 bg-gray-50/50 border border-gray-100 p-5 rounded-2xl">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <Layers size={16} className="text-[#1F5C99]" />
                                            Client Types ({types.length})
                                        </h3>
                                        <button onClick={() => { setEditingType(null); setNewTypeName(''); setNewTypePanChar(''); setAddTypeOpen(true) }}
                                            className="text-xs font-bold text-[#1F5C99] hover:underline flex items-center gap-1">
                                            <Plus size={13} /> Add Type
                                        </button>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100/50 pr-1">
                                        {types.length === 0 ? (
                                            <p className="text-xs text-gray-400 py-2">No client types found</p>
                                        ) : types.map(t => (
                                            <div key={t.id} className="py-2.5 flex items-center justify-between group">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-gray-700">{t.name}</span>
                                                    {t.pan_char && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                                                            PAN: {t.pan_char}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => {
                                                        setEditingType(t)
                                                        setNewTypeName(t.name)
                                                        setNewTypePanChar(t.pan_char || '')
                                                        setAddTypeOpen(true)
                                                    }} className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all" title="Edit Client Type">
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button onClick={() => {
                                                        setTypeToDelete(t)
                                                        setDeleteTypeOpen(true)
                                                    }} className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all" title="Delete Client Type">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Client Groups Column */}
                                <div className="space-y-4 bg-gray-50/50 border border-gray-100 p-5 rounded-2xl">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <Folder size={16} className="text-[#1F5C99]" />
                                            Client Groups ({groups.length})
                                        </h3>
                                        <button onClick={() => { setEditingGroup(null); setNewGroupName(''); setAddGroupOpen(true) }}
                                            className="text-xs font-bold text-[#1F5C99] hover:underline flex items-center gap-1">
                                            <Plus size={13} /> Add Group
                                        </button>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100/50 pr-1">
                                        {groups.length === 0 ? (
                                            <p className="text-xs text-gray-400 py-2">No client groups found</p>
                                        ) : groups.map(g => (
                                            <div key={g.id} className="py-2.5 flex items-center justify-between group">
                                                <span className="text-sm font-medium text-gray-700">{g.name}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <button onClick={() => {
                                                        setEditingGroup(g)
                                                        setNewGroupName(g.name)
                                                        setAddGroupOpen(true)
                                                    }} className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all" title="Edit Client Group">
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button onClick={() => {
                                                        setGroupToDelete(g)
                                                        setDeleteGroupOpen(true)
                                                    }} className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all" title="Delete Client Group">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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

            {/* Create/Edit Custom Client Type Modal */}
            <Modal open={addTypeOpen} onClose={() => { setAddTypeOpen(false); setEditingType(null); setNewTypeName(''); setNewTypePanChar('') }} title={editingType ? "Edit Custom Client Type" : "Create Custom Client Type"}>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Type Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Sole Proprietorship"
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Indian PAN 4th Character (Optional)</label>
                        <input
                            type="text"
                            maxLength={1}
                            placeholder="e.g. F"
                            value={newTypePanChar}
                            onChange={e => setNewTypePanChar(e.target.value.toUpperCase())}
                            className={inputCls + " uppercase"}
                        />
                        <p className="text-[10px] font-semibold text-slate-400 mt-1">
                            Used to auto-validate client PAN cards. Example: P for Individual, C for Company, F for Firm.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => { setAddTypeOpen(false); setEditingType(null); setNewTypeName(''); setNewTypePanChar('') }} disabled={saving} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition">Cancel</button>
                        <button onClick={handleCreateType} disabled={saving} className="px-5 py-2 text-sm bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50 transition">
                            {saving ? 'Saving...' : (editingType ? 'Save Changes' : 'Add Type')}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Custom Client Group Modal */}
            <Modal open={addGroupOpen} onClose={() => { setAddGroupOpen(false); setEditingGroup(null); setNewGroupName('') }} title={editingGroup ? "Edit Custom Client Group" : "Create Custom Client Group"}>
                <div className="space-y-4">
                    <div>
                        <label className={labelCls}>Group Name *</label>
                        <input
                            type="text"
                            placeholder="e.g. Salary-2027"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            className={inputCls}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => { setAddGroupOpen(false); setEditingGroup(null); setNewGroupName('') }} disabled={saving} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition">Cancel</button>
                        <button onClick={handleCreateGroup} disabled={saving} className="px-5 py-2 text-sm bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50 transition">
                            {saving ? 'Saving...' : (editingGroup ? 'Save Changes' : 'Add Group')}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Type Confirmation */}
            <ConfirmDialog 
                open={deleteTypeOpen} 
                onClose={() => { setDeleteTypeOpen(false); setTypeToDelete(null); }} 
                onConfirm={confirmDeleteType} 
                danger 
                loading={saving}
                title="Delete Client Type" 
                message={`Are you sure you want to delete the client type "${typeToDelete?.name}"?`} 
                confirmLabel="Delete" 
            />

            {/* Delete Group Confirmation */}
            <ConfirmDialog 
                open={deleteGroupOpen} 
                onClose={() => { setDeleteGroupOpen(false); setGroupToDelete(null); }} 
                onConfirm={confirmDeleteGroup} 
                danger 
                loading={saving}
                title="Delete Client Group" 
                message={`Are you sure you want to delete the client group "${groupToDelete?.name}"?`} 
                confirmLabel="Delete" 
            />

            {/* Delete Work Type Confirmation */}
            <ConfirmDialog 
                open={deleteWtOpen} 
                onClose={() => { setDeleteWtOpen(false); setWtToDelete(null); }} 
                onConfirm={confirmDeleteWt} 
                danger 
                loading={saving}
                title="Delete Work Type (Folder)" 
                message={`Are you sure you want to delete the folder "${wtToDelete?.name}"? Doing so will move this folder and all its associated sheets and tasks into the Recycle Bin.`} 
                confirmLabel="Delete to Recycle Bin" 
            />
        </div>
    )
}