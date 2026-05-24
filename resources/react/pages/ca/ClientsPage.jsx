import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldAlert, Key, Globe, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = {
    name: '',
    name_as_per_pan: '',
    pan_no: '',
    type: '',
    group: '',
    contact: '',
    alternative_contact: '',
    email: '',
    reference_no: '',
    dob: '',
    city: '',
    pin_code: '',
    state: '',
    gst_number: '',
    status: 'active',
    credentials: {
        efiling_password: '',
        ais_tis_password: ''
    }
}

export default function ClientsPage() {
    const [clients, setClients] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [filterType, setFilterType] = useState('')
    const [filterGroup, setFilterGroup] = useState('')
    const [page, setPage] = useState(1)

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    // Dynamic select lookup options
    const [types, setTypes] = useState([])
    const [groups, setGroups] = useState([])

    // Sub-modal states for adding custom type/group dynamically
    const [addTypeOpen, setAddTypeOpen] = useState(false)
    const [newTypeName, setNewTypeName] = useState('')
    const [newTypePanChar, setNewTypePanChar] = useState('')

    const [addGroupOpen, setAddGroupOpen] = useState(false)
    const [newGroupName, setNewGroupName] = useState('')

    // Password visibility toggle
    const [showPasswords, setShowPasswords] = useState(false)

    // Fetch lists
    const fetchLookups = async () => {
        try {
            const [typesRes, groupsRes] = await Promise.all([
                api.get('/ca/client-types'),
                api.get('/ca/client-groups')
            ])
            setTypes(typesRes.data.data || [])
            setGroups(groupsRes.data.data || [])
        } catch (e) {
            console.error('Failed to load lookup options', e)
        }
    }

    const fetchClients = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/clients', { 
                params: { 
                    search, 
                    status, 
                    page, 
                    per_page: 15 
                } 
            })
            setClients(res.data.data)
            setMeta(res.data.meta)
        } finally { 
            setLoading(false) 
        }
    }, [search, status, page])

    useEffect(() => { 
        fetchLookups()
    }, [])

    useEffect(() => { 
        fetchClients() 
    }, [fetchClients])

    // Generate AIS & TIS password dynamically in real-time
    useEffect(() => {
        if (form.pan_no && form.dob) {
            const panLower = form.pan_no.toLowerCase()
            const dobParts = form.dob.split('-') // YYYY-MM-DD
            if (dobParts.length === 3) {
                const year = dobParts[0]
                const month = dobParts[1]
                const day = dobParts[2]
                const dobDigits = `${day}${month}${year}`
                setForm(prev => ({
                    ...prev,
                    credentials: {
                        ...prev.credentials,
                        ais_tis_password: `${panLower}${dobDigits}`
                    }
                }))
            }
        }
    }, [form.pan_no, form.dob])

    // Validate PAN locally in real-time
    const getPanValidation = () => {
        const pan = form.pan_no.toUpperCase()
        if (!pan) return null
        
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
        if (!panRegex.test(pan)) {
            return { valid: false, msg: 'Invalid general PAN format (e.g. ABCDE1234F).' }
        }

        const typeOption = types.find(t => t.name === form.type)
        if (typeOption && typeOption.pan_char) {
            const expectedChar = typeOption.pan_char.toUpperCase()
            const fourthChar = pan.charAt(3)
            if (fourthChar !== expectedChar) {
                return { 
                    valid: false, 
                    msg: `4th character of PAN must be "${expectedChar}" for type "${form.type}".` 
                }
            }
        }

        return { valid: true, msg: 'PAN format is fully valid and verified!' }
    }

    const panStatus = getPanValidation()

    const handleSave = async () => {
        // Run pre-submit PAN validation check
        if (panStatus && !panStatus.valid) {
            toast.error(panStatus.msg)
            return
        }

        setSaving(true)
        setErrors({})
        try {
            const payload = {
                ...form,
                pan_no: form.pan_no.toUpperCase() // Save always capitalized
            }
            if (editOpen) {
                await api.put(`/ca/clients/${selected.id}`, payload)
                toast.success('Client updated successfully')
            } else {
                await api.post('/ca/clients', payload)
                toast.success('Client registered successfully')
            }
            setAddOpen(false)
            setEditOpen(false)
            fetchClients()
        } catch (e) { 
            setErrors(e.response?.data?.errors ?? {})
            toast.error('Please fix validation errors')
        } finally { 
            setSaving(false) 
        }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/clients/${selected.id}`)
            toast.success('Client archived successfully')
            setDeleteOpen(false)
            fetchClients()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to archive client')
        } finally {
            setSaving(false)
        }
    }

    const openEdit = (c) => {
        setSelected(c)
        setForm({ 
            name: c.name, 
            name_as_per_pan: c.name_as_per_pan ?? '',
            pan_no: c.pan_no ?? '',
            type: c.type ?? '',
            group: c.group ?? '',
            contact: c.contact ?? '', 
            alternative_contact: c.alternative_contact ?? '',
            email: c.email ?? '',
            reference_no: c.reference_no ?? '',
            dob: c.dob ?? '',
            city: c.city ?? '',
            pin_code: c.pin_code ?? '',
            state: c.state ?? '',
            gst_number: c.gst_number ?? '', 
            status: c.status,
            credentials: c.credentials || { efiling_password: '', ais_tis_password: '' }
        })
        setErrors({})
        setEditOpen(true)
    }

    const handleCreateType = async () => {
        if (!newTypeName) return
        try {
            const res = await api.post('/ca/client-types', {
                name: newTypeName,
                pan_char: newTypePanChar
            })
            setTypes(prev => [...prev, res.data.data])
            setForm(prev => ({ ...prev, type: res.data.data.name }))
            setNewTypeName('')
            setNewTypePanChar('')
            setAddTypeOpen(false)
            toast.success('Custom client type added successfully')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create client type')
        }
    }

    const handleCreateGroup = async () => {
        if (!newGroupName) return
        try {
            const res = await api.post('/ca/client-groups', {
                name: newGroupName
            })
            setGroups(prev => [...prev, res.data.data])
            setForm(prev => ({ ...prev, group: res.data.data.name }))
            setNewGroupName('')
            setAddGroupOpen(false)
            toast.success('Custom client group added successfully')
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to create client group')
        }
    }

    // Client-side search and dropdown list filtering
    const filteredClients = clients.filter(c => {
        const matchesGroup = !filterGroup || c.group === filterGroup
        const matchesType = !filterType || c.type === filterType
        return matchesGroup && matchesType
    })

    const inputCls = "w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-slate-700 placeholder-slate-400"
    const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1"

    const renderClientForm = () => (
        <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
            {/* Main Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Client Name */}
                <div>
                    <label className={labelCls}>Client Name *</label>
                    <input 
                        type="text" 
                        value={form.name} 
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                        placeholder="Enter Client Name" 
                        className={inputCls} 
                    />
                    {errors.name && <p className="text-[10px] text-red-500 mt-1">{errors.name[0]}</p>}
                </div>

                {/* Client Type */}
                <div>
                    <label className={labelCls}>Type *</label>
                    <select 
                        value={form.type} 
                        onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                                setAddTypeOpen(true)
                            } else {
                                setForm(f => ({ ...f, type: e.target.value }))
                            }
                        }} 
                        className={inputCls}
                    >
                        <option value="">Select Type...</option>
                        {types.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                        <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
                    </select>
                    {errors.type && <p className="text-[10px] text-red-500 mt-1">{errors.type[0]}</p>}
                </div>

                {/* Client Name As per PAN */}
                <div>
                    <label className={labelCls}>Client Name As Per PAN</label>
                    <input 
                        type="text" 
                        value={form.name_as_per_pan} 
                        onChange={e => setForm(f => ({ ...f, name_as_per_pan: e.target.value }))} 
                        placeholder="Enter Name exactly as printed on PAN" 
                        className={inputCls} 
                    />
                    {errors.name_as_per_pan && <p className="text-[10px] text-red-500 mt-1">{errors.name_as_per_pan[0]}</p>}
                </div>

                {/* PAN Number with Validation Indicator */}
                <div>
                    <label className={labelCls}>PAN No *</label>
                    <div className="relative">
                        <input 
                            type="text" 
                            maxLength={10}
                            value={form.pan_no} 
                            onChange={e => setForm(f => ({ ...f, pan_no: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} 
                            placeholder="Enter 10-Digit PAN (e.g. BIBPB1899L)" 
                            className={`${inputCls} uppercase pr-8`} 
                        />
                        {panStatus && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                {panStatus.valid ? (
                                    <ShieldCheck className="text-emerald-500 w-4 h-4" />
                                ) : (
                                    <ShieldAlert className="text-rose-500 w-4 h-4" />
                                )}
                            </div>
                        )}
                    </div>
                    {panStatus && (
                        <p className={`text-[9px] font-bold mt-1 ${panStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {panStatus.msg}
                        </p>
                    )}
                    {errors.pan_no && <p className="text-[10px] text-red-500 mt-1">{errors.pan_no[0]}</p>}
                </div>

                {/* Group */}
                <div>
                    <label className={labelCls}>Group *</label>
                    <select 
                        value={form.group} 
                        onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                                setAddGroupOpen(true)
                            } else {
                                setForm(f => ({ ...f, group: e.target.value }))
                            }
                        }} 
                        className={inputCls}
                    >
                        <option value="">Select Group...</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                        <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
                    </select>
                    {errors.group && <p className="text-[10px] text-red-500 mt-1">{errors.group[0]}</p>}
                </div>

                {/* Contact No */}
                <div>
                    <label className={labelCls}>Contact No</label>
                    <input 
                        type="text" 
                        maxLength={10}
                        value={form.contact} 
                        onChange={e => setForm(f => ({ ...f, contact: e.target.value.replace(/\D/g, '') }))} 
                        placeholder="10-digit mobile number" 
                        className={inputCls} 
                    />
                    {errors.contact && <p className="text-[10px] text-red-500 mt-1">{errors.contact[0]}</p>}
                </div>

                {/* Alternative Contact No */}
                <div>
                    <label className={labelCls}>Alternative Contact No</label>
                    <input 
                        type="text" 
                        maxLength={10}
                        value={form.alternative_contact} 
                        onChange={e => setForm(f => ({ ...f, alternative_contact: e.target.value.replace(/\D/g, '') }))} 
                        placeholder="Alternative 10-digit number" 
                        className={inputCls} 
                    />
                    {errors.alternative_contact && <p className="text-[10px] text-red-500 mt-1">{errors.alternative_contact[0]}</p>}
                </div>

                {/* Email Address */}
                <div>
                    <label className={labelCls}>Email ID</label>
                    <input 
                        type="email" 
                        value={form.email} 
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} 
                        placeholder="client@example.com" 
                        className={inputCls} 
                    />
                    {errors.email && <p className="text-[10px] text-red-500 mt-1">{errors.email[0]}</p>}
                </div>

                {/* Reference No */}
                <div>
                    <label className={labelCls}>Reference No</label>
                    <input 
                        type="text" 
                        value={form.reference_no} 
                        onChange={e => setForm(f => ({ ...f, reference_no: e.target.value }))} 
                        placeholder="Enter reference details" 
                        className={inputCls} 
                    />
                    {errors.reference_no && <p className="text-[10px] text-red-500 mt-1">{errors.reference_no[0]}</p>}
                </div>

                {/* City */}
                <div>
                    <label className={labelCls}>City</label>
                    <input 
                        type="text" 
                        value={form.city} 
                        onChange={e => setForm(f => ({ ...f, city: e.target.value }))} 
                        placeholder="Enter City" 
                        className={inputCls} 
                    />
                    {errors.city && <p className="text-[10px] text-red-500 mt-1">{errors.city[0]}</p>}
                </div>

                {/* Pin Code */}
                <div>
                    <label className={labelCls}>Pin Code</label>
                    <input 
                        type="text" 
                        maxLength={6}
                        value={form.pin_code} 
                        onChange={e => setForm(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))} 
                        placeholder="6-digit postal code" 
                        className={inputCls} 
                    />
                    {errors.pin_code && <p className="text-[10px] text-red-500 mt-1">{errors.pin_code[0]}</p>}
                </div>

                {/* State */}
                <div>
                    <label className={labelCls}>State</label>
                    <input 
                        type="text" 
                        value={form.state} 
                        onChange={e => setForm(f => ({ ...f, state: e.target.value }))} 
                        placeholder="Enter State" 
                        className={inputCls} 
                    />
                    {errors.state && <p className="text-[10px] text-red-500 mt-1">{errors.state[0]}</p>}
                </div>

                {/* Date of Birth */}
                <div>
                    <label className={labelCls}>Date Of Birth *</label>
                    <input 
                        type="date" 
                        value={form.dob} 
                        onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} 
                        className={inputCls} 
                    />
                    {errors.dob && <p className="text-[10px] text-red-500 mt-1">{errors.dob[0]}</p>}
                </div>

                {/* GST Number */}
                <div>
                    <label className={labelCls}>GST No</label>
                    <input 
                        type="text" 
                        value={form.gst_number} 
                        onChange={e => setForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} 
                        placeholder="GST Identification Number" 
                        className={inputCls} 
                    />
                    {errors.gst_number && <p className="text-[10px] text-red-500 mt-1">{errors.gst_number[0]}</p>}
                </div>
            </div>

            {/* Status (Edit only) */}
            {editOpen && (
                <div>
                    <label className={labelCls}>Status</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            )}

            {/* Portal Credentials Section */}
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Key className="text-indigo-500 w-4 h-4" />
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Portal Credentials (Passwords)</h4>
                    </div>
                    <button 
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="text-xs text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                    >
                        {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showPasswords ? 'Hide Credentials' : 'Reveal Credentials'}</span>
                    </button>
                </div>

                <div className="overflow-hidden border border-slate-200/60 rounded-2xl bg-white shadow-sm">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                <th className="px-4 py-3">Portal URL</th>
                                <th className="px-4 py-3">Auth Type</th>
                                <th className="px-4 py-3">User ID</th>
                                <th className="px-4 py-3">Password</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {/* EFILING row (Manual) */}
                            <tr>
                                <td className="px-4 py-3 font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Globe size={13} className="text-slate-400" />
                                    <span>WWW.EFILING INCOME TAX</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-100">
                                        EFILING
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    {form.pan_no ? form.pan_no : 'LINKED TO PAN'}
                                </td>
                                <td className="px-4 py-3">
                                    <input 
                                        type={showPasswords ? "text" : "password"} 
                                        value={form.credentials.efiling_password}
                                        onChange={e => setForm(f => ({
                                            ...f,
                                            credentials: {
                                                ...f.credentials,
                                                efiling_password: e.target.value
                                            }
                                        }))}
                                        placeholder="Type manual password..."
                                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-xs font-semibold text-slate-700"
                                    />
                                </td>
                            </tr>

                            {/* AIS & TIS row (Auto generated) */}
                            <tr>
                                <td className="px-4 py-3 font-semibold text-slate-600 flex items-center gap-1.5">
                                    <Globe size={13} className="text-slate-400" />
                                    <span>WWW.EFILING INCOME TAX</span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100">
                                        AIS & TIS
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-mono font-bold text-slate-600">
                                    {form.pan_no ? form.pan_no : 'LINKED TO PAN'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <input 
                                            type={showPasswords ? "text" : "password"} 
                                            value={form.credentials.ais_tis_password}
                                            disabled
                                            className="w-full px-2 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed"
                                        />
                                        <span className="text-[9px] font-bold text-slate-400 mt-1">
                                            Auto Generated: lower(PAN) + DOB
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form Footer Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button 
                    onClick={() => { setAddOpen(false); setEditOpen(false) }} 
                    className="px-5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="px-6 py-2.5 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-60 transition"
                >
                    {saving ? 'Saving...' : (editOpen ? 'Update Client' : 'Register Client')}
                </button>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Client Registry</h1>
                    <p className="text-sm font-semibold text-slate-400 mt-1">Comprehensive register of business clients with secure validation checks.</p>
                </div>
                <button 
                    onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                    className="flex items-center justify-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-100 transition duration-200 active:scale-95 w-full sm:w-auto"
                >
                    <Plus size={16} /> Register New Client
                </button>
            </div>

            {/* List panel */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Advanced Search & Filtering toolbar */}
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-slate-50/80 bg-slate-50/50">
                    <div className="relative flex-1 sm:flex-none">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search client name, contact, PAN..." 
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full sm:w-64 transition font-semibold text-slate-700" 
                        />
                    </div>

                    {/* Group Filter */}
                    <select 
                        value={filterGroup} 
                        onChange={e => { setFilterGroup(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Groups</option>
                        {groups.map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                    </select>

                    {/* Type Filter */}
                    <select 
                        value={filterType} 
                        onChange={e => { setFilterType(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Types</option>
                        {types.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                        ))}
                    </select>

                    {/* Status Filter */}
                    <select 
                        value={status} 
                        onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition font-semibold text-slate-600"
                    >
                        <option value="">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 bg-slate-50/20">
                                    <th className="px-6 py-4 text-left">Client Name</th>
                                    <th className="px-6 py-4 text-left">PAN No</th>
                                    <th className="px-6 py-4 text-left">Type & Group</th>
                                    <th className="px-6 py-4 text-left">Contact Info</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {filteredClients.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-slate-400 font-bold">
                                            No clients registered matching search criteria.
                                        </td>
                                    </tr>
                                ) : filteredClients.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/30 transition">
                                        {/* Client Name & City */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600">
                                                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800 leading-tight">{c.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{c.city ? `${c.city}, ` : ''}{c.state || 'India'}</p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* PAN No */}
                                        <td className="px-6 py-4 font-mono font-bold text-xs text-slate-600">
                                            {c.pan_no || '—'}
                                        </td>

                                        {/* Type & Group */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-semibold text-slate-700 text-xs">{c.type || '—'}</span>
                                                <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">{c.group || '—'}</span>
                                            </div>
                                        </td>

                                        {/* Contact */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-600 text-xs">{c.contact || '—'}</span>
                                                <span className="text-[10px] text-slate-400 font-semibold">{c.email || ''}</span>
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-6 py-4 text-center">
                                            <StatusBadge status={c.status} />
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => openEdit(c)} 
                                                    className="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-[#1F5C99] transition border border-transparent hover:border-slate-100"
                                                    title="Edit client details"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => { setSelected(c); setDeleteOpen(true) }} 
                                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition border border-transparent hover:border-red-100"
                                                    title="Archive client"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-50 bg-slate-50/30">
                        <p className="text-xs font-semibold text-slate-400">Showing {meta.from}–{meta.to} of {meta.total} registered clients</p>
                        <div className="flex gap-2">
                            <button 
                                disabled={page === 1} 
                                onClick={() => setPage(p => p - 1)} 
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                            >
                                Previous
                            </button>
                            <button 
                                disabled={page === meta.last_page} 
                                onClick={() => setPage(p => p + 1)} 
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Registration/Edit Form Modal */}
            <Modal 
                open={addOpen || editOpen} 
                onClose={() => { setAddOpen(false); setEditOpen(false) }} 
                title={editOpen ? 'Update Registered Client Details' : 'Register New CA Business Client'}
                width="max-w-4xl" // Large layout for form elements
            >
                {renderClientForm()}
            </Modal>

            {/* Archive Confirm Dialog */}
            <ConfirmDialog 
                open={deleteOpen} 
                onClose={() => setDeleteOpen(false)} 
                onConfirm={handleDelete} 
                danger 
                loading={saving}
                title="Archive Registered Client" 
                message={`Are you sure you want to archive "${selected?.name}"? All future sheet logs will reference archived state.`} 
                confirmLabel="Archive Client" 
            />

            {/* Dropdown Lookups: ADD NEW TYPE Sub-modal */}
            <Modal open={addTypeOpen} onClose={() => setAddTypeOpen(false)} title="Create Custom Client Type">
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
                        <p className="text-[9px] font-bold text-slate-400 mt-1">
                            Used to auto-validate client PAN cards. Example: P for Individual, C for Company, F for Firm.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setAddTypeOpen(false)} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleCreateType} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675]">Add Type</button>
                    </div>
                </div>
            </Modal>

            {/* Dropdown Lookups: ADD NEW GROUP Sub-modal */}
            <Modal open={addGroupOpen} onClose={() => setAddGroupOpen(false)} title="Create Custom Client Group">
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
                        <button onClick={() => setAddGroupOpen(false)} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50">Cancel</button>
                        <button onClick={handleCreateGroup} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675]">Add Group</button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}