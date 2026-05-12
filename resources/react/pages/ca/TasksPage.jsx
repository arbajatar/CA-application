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

    const [reassignOpen, setReassignOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
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
            toast.success('Task deleted successfully')
            setDeleteOpen(false)
            fetchTasks()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete task')
        } finally { setSaving(false) }
    }

    const openEdit = (task) => {
        navigate(`/ca/tasks/${task.id}`);
    }

    const openReassign = (task) => {
        setSelected(task)
        setForm({ allocated_to: task.allocated_to.id })
        setReassignOpen(true)
    }

    const openView = (task) => {
        navigate(`/ca/tasks/${task.id}`);
    }

    const renderField = (label, error, children) => (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    )

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Task Management</h1>
                    <p className="text-sm text-gray-400 mt-1">Monitor, assign, and manage all office work entries.</p>
                </div>
                <button onClick={() => navigate('/ca/tasks/builder')}
                    className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                    <Plus size={16} /> Create New Task
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Filters */}
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
                    <div className="relative w-full lg:flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search tasks..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full transition" />
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar w-full lg:w-auto">
                        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                            className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px]">
                            {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <select value={clientId} onChange={e => { setClientId(e.target.value); setPage(1) }}
                            className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px] lg:max-w-[150px]">
                            <option value="">All Clients</option>
                            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select value={staffId} onChange={e => { setStaffId(e.target.value); setPage(1) }}
                            className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px] lg:max-w-[150px]">
                            <option value="">All Staff</option>
                            {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select value={workTypeId} onChange={e => { setWorkTypeId(e.target.value); setPage(1) }}
                            className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[140px] lg:max-w-[150px]">
                            <option value="">All Work Types</option>
                            {workTypes?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
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
                                                <button onClick={() => openView(t)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition disabled:opacity-50">
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
        </div>
    )
}