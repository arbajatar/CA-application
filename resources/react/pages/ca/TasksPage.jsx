import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserRoundCog, PlusCircle, Eye } from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = {
    client_id: '', work_type_id: '', date_inward: '',
    allocated_to: '', date_allocated: new Date().toISOString().split('T')[0], remarks: ''
}

const statuses = [
    { value: '', label: 'All Status' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_information', label: 'Awaiting Information' },
    { value: 'completed', label: 'Completed' },
]

export default function TasksPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [meta, setMeta] = useState(null)
    const [clients, setClients] = useState([])
    const [workTypes, setWorkTypes] = useState([])
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [staffId, setStaffId] = useState('')
    const [clientId, setClientId] = useState('')
    const [workTypeId, setWorkTypeId] = useState('')
    const [page, setPage] = useState(1)

    const [addOpen, setAddOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [reassignOpen, setReassignOpen] = useState(false)
    const [viewOpen, setViewOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [viewLoading, setViewLoading] = useState(false)
    const [errors, setErrors] = useState({})

    const fetchDropdowns = async () => {
        try {
            const [c, w, s] = await Promise.all([
                api.get('/ca/clients', { params: { per_page: 100 } }),
                api.get('/ca/work-types'),
                api.get('/ca/staff', { params: { per_page: 100 } }),
            ])
            setClients(c.data.data)
            setWorkTypes(w.data.data)
            setStaff(s.data.data)
        } catch (e) {
            toast.error('Failed to load dropdown data')
        }
    }

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/tasks', {
                params: { search, status, staff_id: staffId, client_id: clientId, work_type_id: workTypeId, page, per_page: 15 }
            })
            setTasks(res.data.data || [])
            setMeta(res.data.meta)
        } catch (e) {
            toast.error('Failed to fetch tasks')
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [search, status, staffId, clientId, workTypeId, page])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const sId = params.get('staff_id')
        if (sId) setStaffId(sId)
        fetchDropdowns()
    }, [location.search])

    useEffect(() => { fetchTasks() }, [fetchTasks])

    const handleAdd = async () => {
        setSaving(true); setErrors({})
        try {
            await api.post('/ca/tasks', form)
            setAddOpen(false); setForm(EMPTY_FORM); fetchTasks()
        } catch (e) {
            setErrors(e.response?.data?.errors ?? {})
        } finally { setSaving(false) }
    }

    const handleEdit = async () => {
        setSaving(true); setErrors({})
        try {
            await api.put(`/ca/tasks/${selected.id}`, form)
            setEditOpen(false); fetchTasks()
        } catch (e) {
            setErrors(e.response?.data?.errors ?? {})
        } finally { setSaving(false) }
    }

    const handleReassign = async () => {
        setSaving(true); setErrors({})
        try {
            await api.patch(`/ca/tasks/${selected.id}/reassign`, { allocated_to: form.allocated_to })
            setReassignOpen(false); fetchTasks()
        } catch (e) {
            setErrors(e.response?.data?.errors ?? { message: 'Reassignment failed' })
        } finally { setSaving(false) }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/tasks/${selected.id}`)
            setDeleteOpen(false); fetchTasks()
        } catch (e) {
            console.error('Delete failed', e)
        } finally { setSaving(false) }
    }

    const openEdit = (task) => {
        setSelected(task)
        setForm({
            client_id: task.client.id,
            work_type_id: task.work_type.id,
            date_inward: task.date_inward,
            allocated_to: task.allocated_to.id,
            date_allocated: task.date_allocated,
            remarks: task.remarks ?? '',
        })
        setErrors({})
        setEditOpen(true)
    }

    const openReassign = (task) => {
        setSelected(task)
        setForm({ allocated_to: task.allocated_to.id })
        setReassignOpen(true)
    }

    const openView = async (task) => {
        setViewLoading(true)
        try {
            const res = await api.get(`/ca/tasks/${task.id}`)
            setSelected(res.data.data)
            setViewOpen(true)
        } catch (e) {
            toast.error('Failed to fetch task details')
            console.error(e)
        } finally {
            setViewLoading(false)
        }
    }

    const Field = ({ label, error, children }) => (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    )

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    const TaskForm = ({ onSubmit }) => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Field label="Client" error={errors.client_id?.[0]}>
                    <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls}>
                        <option value="">Select client</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </Field>
                <Field label="Nature of Work" error={errors.work_type_id?.[0]}>
                    <select value={form.work_type_id} onChange={e => setForm(f => ({ ...f, work_type_id: e.target.value }))} className={inputCls}>
                        <option value="">Select work type</option>
                        {workTypes?.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </Field>
                <Field label="Date of Inward" error={errors.date_inward?.[0]}>
                    <input type="date" value={form.date_inward} onChange={e => setForm(f => ({ ...f, date_inward: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Allocated To" error={errors.allocated_to?.[0]}>
                    <select value={form.allocated_to} onChange={e => setForm(f => ({ ...f, allocated_to: e.target.value }))} className={inputCls}>
                        <option value="">Select staff</option>
                        {staff?.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </Field>
                <Field label="Date of Allocation" error={errors.date_allocated?.[0]}>
                    <input type="date" value={form.date_allocated} onChange={e => setForm(f => ({ ...f, date_allocated: e.target.value }))} className={inputCls} />
                </Field>
            </div>
            <Field label="Remarks">
                <textarea value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes..." className={inputCls} />
            </Field>
            <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setAddOpen(false); setEditOpen(false) }} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                <button type="button" onClick={onSubmit} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Save Task'}</button>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
                    <p className="text-sm text-gray-400 mt-1">Monitor, assign, and manage all office work entries.</p>
                </div>
                <button onClick={() => navigate('/ca/tasks/builder')}
                    className="flex items-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
                    <Plus size={16} /> Create New Task
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Filters */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <div className="relative flex-shrink-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search tasks..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-48 transition" />
                    </div>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition flex-shrink-0">
                        {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={clientId} onChange={e => { setClientId(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition flex-shrink-0 max-w-[150px]">
                        <option value="">All Clients</option>
                        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={staffId} onChange={e => { setStaffId(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition flex-shrink-0 max-w-[150px]">
                        <option value="">All Staff</option>
                        {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={workTypeId} onChange={e => { setWorkTypeId(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition flex-shrink-0 max-w-[150px]">
                        <option value="">All Work Types</option>
                        {workTypes?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['#', 'Client', 'Work Type', 'Allocated To', 'Allocated Date', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tasks?.length === 0 ? (
                                    <tr><td colSpan={10} className="text-center py-12 text-gray-400">No tasks found</td></tr>
                                ) : tasks?.map((t, i) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-800">{t.client.name}</td>
                                        <td className="px-4 py-3 text-gray-600">{t.work_type.name}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                    {t.allocated_to.name[0]}
                                                </div>
                                                <span className="text-gray-700">{t.allocated_to.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.date_allocated}</td>
                                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => openView(t)} disabled={viewLoading} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition disabled:opacity-50">
                                                    <Eye size={15} />
                                                </button>
                                                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                <button onClick={() => openReassign(t)} className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition"><UserRoundCog size={15} /></button>
                                                <button onClick={() => { setSelected(t); setDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {meta && meta.last_page > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">Showing {meta.from}–{meta.to} of {meta.total}</p>
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                            <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Task" width="max-w-2xl">
                <TaskForm onSubmit={handleEdit} />
            </Modal>

            {/* Reassign Modal */}
            <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Task" width="max-w-sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Reassign <span className="font-semibold text-gray-700">{selected?.client?.name}</span> — {selected?.work_type?.name}</p>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign To</label>
                        <select value={form.allocated_to} onChange={e => setForm(f => ({ ...f, allocated_to: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition">
                            <option value="">Select staff</option>
                            {(staff || [])
                                .filter(s => s.is_active)
                                .map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setReassignOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleReassign} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Reassign'}</button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog
                open={deleteOpen} onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete} danger
                loading={saving}
                title="Delete Task"
                message={`Are you sure you want to delete this task for "${selected?.client?.name}"? This action cannot be undone.`}
                confirmLabel="Delete Task"
            />
            {/* View Modal */}
            <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Task Details" width="max-w-3xl">
                {selected && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Client</h4>
                                <p className="text-sm font-bold text-gray-900">{selected.client.name}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Type</h4>
                                <p className="text-sm font-bold text-gray-900">{selected.work_type.name}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</h4>
                                <StatusBadge status={selected.status} />
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Allocated To</h4>
                                <p className="text-sm font-bold text-gray-900">{selected.allocated_to.name}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Inward Date</h4>
                                <p className="text-sm font-bold text-gray-900">{selected.date_inward}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Allocation Date</h4>
                                <p className="text-sm font-bold text-gray-900">{selected.date_allocated}</p>
                            </div>
                        </div>

                        {selected.remarks && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Remarks</h4>
                                <p className="text-sm text-gray-600 leading-relaxed">{selected.remarks}</p>
                            </div>
                        )}

                        {selected.dynamic_fields && Object.keys(selected.dynamic_fields).length > 0 && (
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">Custom Fields Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(selected.dynamic_fields).map(([key, val]) => (
                                        <div key={key} className="p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{key}</h5>
                                            <p className="text-sm font-semibold text-indigo-600">
                                                {Array.isArray(val) ? val.join(', ') : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val))}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <button onClick={() => setViewOpen(false)} className="px-6 py-2 bg-[#0f1c2e] text-white text-sm font-bold rounded-xl hover:bg-[#1a2f4a] transition shadow-lg shadow-indigo-100">
                                Close Details
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}