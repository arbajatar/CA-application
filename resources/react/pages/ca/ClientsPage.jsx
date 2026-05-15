import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = { name: '', contact: '', email: '', dob: '', city: '', gst_number: '', status: 'active' }

export default function ClientsPage() {
    const [clients, setClients] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})

    const fetchClients = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/clients', { params: { search, status, page, per_page: 15 } })
            setClients(res.data.data)
            setMeta(res.data.meta)
        } finally { setLoading(false) }
    }, [search, status, page])

    useEffect(() => { fetchClients() }, [fetchClients])

    const handleSave = async () => {
        setSaving(true); setErrors({})
        try {
            if (editOpen) await api.put(`/ca/clients/${selected.id}`, form)
            else await api.post('/ca/clients', form)
            setAddOpen(false); setEditOpen(false); fetchClients()
        } catch (e) { setErrors(e.response?.data?.errors ?? {}) }
        finally { setSaving(false) }
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
            contact: c.contact ?? '', 
            email: c.email ?? '',
            dob: c.dob ?? '',
            city: c.city ?? '',
            gst_number: c.gst_number ?? '', 
            status: c.status 
        })
        setErrors({})
        setEditOpen(true)
    }

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    const renderField = (label, error, children) => (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    )

    const renderClientForm = () => (
        <div className="space-y-4">
            {renderField("Client Name *", errors.name?.[0], (
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter client name" className={inputCls} />
            ))}
            {renderField("Contact Number", errors.contact?.[0], (
                <input type="text" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="e.g. 9876543210" className={inputCls} />
            ))}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Email Address", errors.email?.[0], (
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@example.com" className={inputCls} />
                ))}
                {renderField("City", errors.city?.[0], (
                    <input type="text" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Enter city" className={inputCls} />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Date of Birth", errors.dob?.[0], (
                    <input type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} className={inputCls} />
                ))}
                {renderField("GST Number", errors.gst_number?.[0], (
                    <input type="text" value={form.gst_number} onChange={e => setForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="Optional" className={inputCls} />
                ))}
            </div>
            {renderField("Status", null, (
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            ))}
            <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setAddOpen(false); setEditOpen(false) }} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Save Client'}</button>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Client Directory</h1>
                    <p className="text-sm text-gray-400 mt-1">Manage and monitor all registered business clients.</p>
                </div>
                <button onClick={() => { setForm(EMPTY_FORM); setErrors({}); setAddOpen(true) }}
                    className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                    <Plus size={16} /> Add New Client
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="relative flex-1 sm:flex-none">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search clients..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full sm:w-56 transition" />
                    </div>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['Client Name', 'Contact & Email', 'GST Number', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {clients?.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">No clients found</td></tr>
                                ) : clients?.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">{c.name}</p>
                                                    <p className="text-xs text-gray-400">{c.city ? `${c.city} • ` : ''}Business Client</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-gray-700">{c.contact ?? '—'}</span>
                                                <span className="text-xs text-gray-400">{c.email ?? ''}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{c.gst_number ?? 'Not Provided'}</td>
                                        <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                <button onClick={() => { setSelected(c); setDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
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

            <Modal open={addOpen || editOpen} onClose={() => { setAddOpen(false); setEditOpen(false) }} title={editOpen ? 'Edit Client' : 'Add New Client'}>
                {renderClientForm()}
            </Modal>
            <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete} danger loading={saving}
                title="Archive Client" message={`Archive "${selected?.name}"? They will be removed from active client list.`} confirmLabel="Archive" />
        </div>
    )
}