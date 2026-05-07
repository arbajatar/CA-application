import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Activity, Info, CheckCircle, Search } from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'

const statusFilters = [
    { value: '', label: 'All Status' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_information', label: 'Awaiting Information' },
    { value: 'completed', label: 'Completed' },
]

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, sub }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon size={22} className={iconColor} />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-4xl font-bold text-gray-800">{String(value).padStart(2, '0')}</p>
            <p className="text-xs text-gray-400">{sub}</p>
        </div>
    )
}

export default function MyTasksPage() {
    const [summary, setSummary] = useState(null)
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [transitions, setTransitions] = useState({})

    const [updateOpen, setUpdateOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [newStatus, setNewStatus] = useState('')
    const [remark, setRemark] = useState('')
    const [saving, setSaving] = useState(false)
    const [updateError, setUpdateError] = useState('')

    const fetchSummary = async () => {
        const res = await api.get('/staff/dashboard')
        setSummary(res.data)
    }

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/staff/tasks', {
                params: { search, status: statusFilter, per_page: 50 }
            })
            setTasks(res.data.data || [])
        } catch (error) {
            console.error('Failed to fetch tasks', error)
            setTasks([])
        } finally { setLoading(false) }
    }, [search, statusFilter])

    const fetchTransitions = async () => {
        const res = await api.get('/task-status-transitions')
        setTransitions(res.data.data)
    }

    useEffect(() => {
        Promise.all([fetchSummary(), fetchTransitions()])
    }, [])

    useEffect(() => { fetchTasks() }, [fetchTasks])

    const openUpdate = (task) => {
        setSelected(task)
        setNewStatus('')
        setRemark('')
        setUpdateError('')
        setUpdateOpen(true)
    }

    const handleUpdateStatus = async () => {
        if (!newStatus) { setUpdateError('Please select a status.'); return }
        setSaving(true); setUpdateError('')
        try {
            await api.patch(`/staff/tasks/${selected.id}/status`, {
                status: newStatus,
                remarks: remark || undefined,
            })
            setUpdateOpen(false)
            await Promise.all([fetchSummary(), fetchTasks()])
        } catch (e) {
            setUpdateError(e.response?.data?.message ?? 'Failed to update status.')
        } finally { setSaving(false) }
    }

    const allowedTransitions = selected
        ? (transitions[selected.status] ?? [])
        : []

    const cards = summary ? [
        { icon: ClipboardList, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', label: 'Total Tasks', value: summary.total_tasks, sub: 'All tasks assigned' },
        { icon: Activity, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: 'New Assigned', value: summary.assigned, sub: 'Waiting to start' },
        { icon: Info, iconBg: 'bg-orange-50', iconColor: 'text-orange-500', label: 'In Progress', value: summary.in_progress, sub: 'Currently active' },
        { icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-500', label: 'Completed', value: summary.completed, sub: 'Finalized tasks' },
    ] : []

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>

            {/* Summary Cards */}
            {summary ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
                </div>
            ) : <Spinner />}

            {/* Task List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-48 transition"
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
                    >
                        {statusFilters.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['#', 'Client', 'Nature', 'Inward', 'Status', 'Remarks', 'Actions'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tasks?.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-gray-400">
                                            No tasks found
                                        </td>
                                    </tr>
                                ) : tasks?.map((t, i) => {
                                    const canUpdate = (transitions[t.status] ?? []).length > 0
                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4 text-gray-400">{i + 1}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-800 whitespace-nowrap">{t.client.name}</td>
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{t.work_type.name}</td>
                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{t.date_inward}</td>
                                            <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                            <td className="px-6 py-4 text-gray-400 max-w-[160px] truncate">
                                                {t.remarks ?? '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {t.status === 'completed' ? (
                                                    <span className="text-xs text-gray-400">{t.date_completed}</span>
                                                ) : canUpdate ? (
                                                    <button
                                                        onClick={() => openUpdate(t)}
                                                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition"
                                                    >
                                                        Update
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Update Status Modal */}
            <Modal
                open={updateOpen}
                onClose={() => setUpdateOpen(false)}
                title="Update Task Status"
                width="max-w-md"
            >
                {selected && (
                    <div className="space-y-4">

                        {/* Task info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                            <p className="text-sm font-semibold text-gray-800">{selected.client.name}</p>
                            <p className="text-xs text-gray-500">{selected.work_type.name}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400">Current:</span>
                                <StatusBadge status={selected.status} />
                            </div>
                        </div>

                        {/* New status */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                New Status
                            </label>
                            {allowedTransitions.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No transitions available.</p>
                            ) : (
                                <div className="space-y-2">
                                    {allowedTransitions.map(t => (
                                        <label
                                            key={t.value}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${newStatus === t.value
                                                ? 'border-[#1F5C99] bg-[#EEF4FB]'
                                                : 'border-gray-100 hover:border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="status"
                                                value={t.value}
                                                checked={newStatus === t.value}
                                                onChange={() => setNewStatus(t.value)}
                                                className="accent-[#1F5C99]"
                                            />
                                            <StatusBadge status={t.value} />
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Auto-complete note */}
                        {newStatus === 'completed' && (
                            <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                                <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-green-700">
                                    Date of Completion will be automatically recorded as today.
                                </p>
                            </div>
                        )}

                        {/* Remarks */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Remarks <span className="text-gray-300 font-normal">(Optional)</span>
                            </label>
                            <textarea
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                rows={2}
                                placeholder="e.g. Awaiting PAN card copy..."
                                className={inputCls}
                            />
                        </div>

                        {updateError && (
                            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                {updateError}
                            </p>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => setUpdateOpen(false)}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateStatus}
                                disabled={saving || !newStatus}
                                className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition"
                            >
                                {saving ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    )
}