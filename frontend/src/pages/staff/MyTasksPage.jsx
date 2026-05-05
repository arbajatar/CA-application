import { useState, useEffect, useCallback } from 'react'
import { Search, History, MessageSquare, CheckCircle2 } from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

export default function MyTasksPage() {
    const [tasks, setTasks] = useState([])
    const [meta, setMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)

    const [statusModal, setStatusModal] = useState(false)
    const [selected, setSelected] = useState(null)
    const [newStatus, setNewStatus] = useState('')
    const [remarks, setRemarks] = useState('')
    const [saving, setSaving] = useState(false)
    const [transitions, setTransitions] = useState({})

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/staff/tasks', { params: { search, status, page, per_page: 15 } })
            setTasks(res.data.data)
            setMeta(res.data.meta)
        } catch (error) {
            console.error('Failed to fetch tasks', error)
        } finally {
            setLoading(false)
        }
    }, [search, status, page])

    const fetchTransitions = async () => {
        try {
            const res = await api.get('/task-status-transitions')
            setTransitions(res.data.data)
        } catch (_) { }
    }

    useEffect(() => { fetchTasks() }, [fetchTasks])
    useEffect(() => { fetchTransitions() }, [])

    const handleUpdateStatus = async () => {
        if (!newStatus) return
        setSaving(true)
        try {
            await api.patch(`/staff/tasks/${selected.id}/status`, { status: newStatus, remarks })
            setStatusModal(false)
            setNewStatus('')
            setRemarks('')
            fetchTasks()
        } catch (error) {
            console.error('Status update failed', error)
        } finally {
            setSaving(false)
        }
    }

    const openStatusModal = (task) => {
        setSelected(task)
        setNewStatus('')
        setRemarks('')
        setStatusModal(true)
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">My Assigned Tasks</h1>
                <p className="text-sm text-gray-400 mt-1">Manage and update the progress of your assigned work.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="Search tasks..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-64 transition" />
                    </div>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition">
                        <option value="">All Status</option>
                        <option value="assigned">Assigned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="awaiting_information">Awaiting Info</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['#', 'Client Name', 'Nature of Work', 'Inward Date', 'Allocated Date', 'Status', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tasks.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">No tasks assigned to you.</td></tr>
                                ) : tasks.map((t, i) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-800">{t.client.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{t.work_type.name}</td>
                                        <td className="px-6 py-4 text-gray-500">{t.date_inward}</td>
                                        <td className="px-6 py-4 text-gray-500">{t.date_allocated}</td>
                                        <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                        <td className="px-6 py-4">
                                            <button onClick={() => openStatusModal(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f1c2e] text-white text-xs font-semibold hover:bg-[#1a2f4a] transition">
                                                Update Status
                                            </button>
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

            {/* Status Update Modal */}
            <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Update Task Status" width="max-w-md">
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Current Task</p>
                        <p className="text-sm font-bold text-gray-800">{selected?.client?.name}</p>
                        <p className="text-xs text-gray-500">{selected?.work_type?.name}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Status</label>
                        <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition">
                            <option value="">Select status</option>
                            {(transitions[selected?.status] || []).map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Remarks / Progress Note</label>
                        <textarea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3}
                            placeholder="Briefly describe the progress or information missing..."
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition" />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setStatusModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleUpdateStatus} disabled={saving || !newStatus}
                            className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition flex items-center gap-2">
                            {saving ? 'Updating...' : <><CheckCircle2 size={16} /> Save Status</>}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}