import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Activity, Info, CheckCircle, Search, Eye } from 'lucide-react'
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
    const [subTasks, setSubTasks] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [activeTab, setActiveTab] = useState('tasks') // 'tasks' or 'subtasks'
    const [transitions, setTransitions] = useState({})

    const [updateOpen, setUpdateOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [newStatus, setNewStatus] = useState('')
    const [remark, setRemark] = useState('')
    const [saving, setSaving] = useState(false)
    const [screenshot, setScreenshot] = useState(null)
    const [updateError, setUpdateError] = useState('')
    const [viewOpen, setViewOpen] = useState(false)
    const [viewLoading, setViewLoading] = useState(false)

    const fetchSummary = async () => {
        const res = await api.get('/staff/dashboard')
        setSummary(res.data)
    }

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const [tasksRes, subTasksRes] = await Promise.all([
                api.get('/staff/tasks', { params: { search, status: statusFilter, per_page: 50 } }),
                api.get('/staff/sub-tasks', { params: { search, status: statusFilter } })
            ])
            setTasks(tasksRes.data.data || [])
            setSubTasks(subTasksRes.data.data || [])
        } catch (error) {
            console.error('Failed to fetch tasks', error)
            setTasks([])
            setSubTasks([])
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
        setScreenshot(null)
        setUpdateError('')
        setUpdateOpen(true)
    }

    const openView = async (item) => {
        const taskId = item.task_id || item.id;
        setSelected(item)
        setViewOpen(true)
        setViewLoading(true)
        try {
            const res = await api.get(`/staff/tasks/${taskId}`)
            setSelected(res.data.data)
        } catch (error) {
            console.error("Failed to fetch task details", error)
        } finally {
            setViewLoading(false)
        }
    }

    const handleUpdateStatus = async () => {
        if (!newStatus) { setUpdateError('Please select a status.'); return }
        setSaving(true); setUpdateError('')
        try {
            const formData = new FormData()
            formData.append('status', newStatus)
            if (remark) formData.append('remarks', remark)
            if (screenshot) formData.append('screenshot', screenshot)
            formData.append('_method', 'PATCH')

            if (selected.task_id) {
                // It's a subtask (it has task_id)
                await api.post(`/staff/sub-tasks/${selected.id}/status`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            } else {
                // It's a main task
                await api.post(`/staff/tasks/${selected.id}/status`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            }
            setUpdateOpen(false)
            await Promise.all([fetchSummary(), fetchTasks()])
        } catch (e) {
            setUpdateError(e.response?.data?.errors?.screenshot?.[0] || e.response?.data?.message || 'Failed to update status.')
        } finally { setSaving(false) }
    }

    const allowedTransitions = selected
        ? (transitions[selected.status] ?? [])
        : []

    const cards = summary ? [
        { icon: ClipboardList, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', label: 'Total Sheets', value: summary.total_tasks, sub: 'All sheets assigned' },
        { icon: Activity, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', label: 'New Assigned', value: summary.assigned, sub: 'Waiting to start' },
        { icon: Info, iconBg: 'bg-orange-50', iconColor: 'text-orange-500', label: 'In Progress', value: summary.in_progress, sub: 'Currently active' },
        { icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-500', label: 'Completed', value: summary.completed, sub: 'Finalized tasks' },
    ] : []

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">My Sheets</h1>

            {/* Summary Cards */}
            {summary ? (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
                    <SummaryCard
                        icon={ClipboardList}
                        iconBg="bg-indigo-50"
                        iconColor="text-indigo-500"
                        label="My Subtasks"
                        value={subTasks.length}
                        sub="Assigned subtasks"
                    />
                </div>
            ) : <Spinner />}

            {/* Task List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button
                        onClick={() => setActiveTab('tasks')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-[#1F5C99] text-[#1F5C99]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Main Sheets ({tasks.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('subtasks')}
                        className={`px-6 py-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'subtasks' ? 'border-[#1F5C99] text-[#1F5C99]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Subtasks ({subTasks.length})
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
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
                                    {activeTab === 'tasks' ? (
                                        ['#', 'Client', 'Nature', 'Inward', 'Status', 'Remarks', 'Actions'].map(h => (
                                            <th key={h} className="px-6 py-3 text-left whitespace-nowrap">{h}</th>
                                        ))
                                    ) : (
                                        ['#', 'Subtask Title', 'Parent Task', 'Client', 'Priority', 'Status', 'Actions'].map(h => (
                                            <th key={h} className="px-6 py-3 text-left whitespace-nowrap">{h}</th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {activeTab === 'tasks' ? (
                                    tasks?.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sheets found</td></tr>
                                    ) : tasks?.map((t, i) => (
                                        <tr key={t.id} className="hover:bg-gray-100 transition">
                                            <td className="px-6 py-4 text-gray-400">{i + 1}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-800 whitespace-nowrap">{t.client?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{t.work_type?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{t.date_inward}</td>
                                            <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                            <td className="px-6 py-4 text-gray-400 max-w-[160px] truncate">{t.remarks ?? '—'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => openView(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"><Eye size={15} /></button>
                                                    {t.status !== 'completed' && (transitions[t.status] ?? []).length > 0 && (
                                                        <button onClick={() => openUpdate(t)} className="px-3 py-1.5 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition">Update</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    subTasks?.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No subtasks found</td></tr>
                                    ) : subTasks?.map((st, i) => (
                                        <tr key={st.id} className="hover:bg-gray-100 transition">
                                            <td className="px-6 py-4 text-gray-400">{i + 1}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-800">{st.title}</td>
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{st.task?.work_type || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{st.task?.client || 'N/A'}</td>
                                            <td className="px-6 py-4 capitalize font-medium">{st.priority}</td>
                                            <td className="px-6 py-4"><StatusBadge status={st.status} /></td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => openView(st)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"><Eye size={15} /></button>
                                                    <button
                                                        onClick={() => openUpdate(st)}
                                                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition"
                                                    >
                                                        Update
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Update Status Modal */}
            <Modal
                open={updateOpen}
                onClose={() => setUpdateOpen(false)}
                title="Update Sheet Status"
                width="max-w-md"
            >
                {selected && (
                    <div className="space-y-4">

                        {/* Task info */}
                        <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                            <p className="text-sm font-semibold text-gray-800">
                                {selected.task_id ? selected.title : (selected.client?.name || 'N/A')}
                            </p>
                            <p className="text-xs text-gray-500">
                                {selected.task_id ? `Part of: ${selected.task?.work_type || 'N/A'}` : (selected.work_type?.name || 'N/A')}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-400">Current Status:</span>
                                <StatusBadge status={selected.status} />
                            </div>
                        </div>

                        {/* New status */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                New Status
                            </label>
                            {selected.task_id ? (
                                <div className="space-y-2">
                                    {['assigned', 'in_progress', 'awaiting_information', 'completed'].map(s => (
                                        <label
                                            key={s}
                                            className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${newStatus === s
                                                ? 'border-[#1F5C99] bg-[#EEF4FB]'
                                                : 'border-gray-100 hover:border-gray-200'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="status"
                                                value={s}
                                                checked={newStatus === s}
                                                onChange={() => setNewStatus(s)}
                                                className="accent-[#1F5C99]"
                                            />
                                            <StatusBadge status={s} />
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                allowedTransitions.length === 0 ? (
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
                                )
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

                        {/* Screenshot */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Attach Screenshot <span className="text-gray-300 font-normal">(Optional)</span>
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => setScreenshot(e.target.files[0])}
                                className={inputCls + " file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0f1c2e] file:text-white hover:file:bg-[#1a2f4a] cursor-pointer"}
                            />
                            <p className="text-[10px] text-gray-400">Max size: 2MB (JPG, PNG)</p>
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

            {/* View Modal */}
            <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Sheet Details" width="max-w-3xl">
                {selected && (
                    viewLoading ? <Spinner /> : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Client</h4>
                                    <p className="text-sm font-bold text-gray-900">{selected.client?.name || selected.task?.client || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Work Type</h4>
                                    <p className="text-sm font-bold text-gray-900">{selected.work_type?.name || selected.task?.work_type || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</h4>
                                    <StatusBadge status={selected.status} />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Inward Date</h4>
                                    <p className="text-sm font-bold text-gray-900">{selected.date_inward || selected.task?.date_inward || '—'}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Allocation / Due Date</h4>
                                    <p className="text-sm font-bold text-gray-900">{selected.date_allocated || selected.due_date || '—'}</p>
                                </div>
                                {(selected.date_completed || selected.completed_at || selected.task?.date_completed) && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Completion Date</h4>
                                        <p className="text-sm font-bold text-gray-900">{selected.date_completed || selected.completed_at || selected.task?.date_completed}</p>
                                    </div>
                                )}
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
                                            <div key={key} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{key}</h5>
                                                <p className="text-sm font-semibold text-gray-800">
                                                    {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (val || '—')}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Task Logs */}
                            {selected.logs && selected.logs.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">Status History</h4>
                                    <div className="space-y-3">
                                        {selected.logs.map((log) => (
                                            <div key={log.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <StatusBadge status={log.old_status} />
                                                        <span className="text-gray-400 text-xs">→</span>
                                                        <StatusBadge status={log.new_status} />
                                                    </div>
                                                    <span className="text-[10px] text-gray-400 font-medium">{log.changed_at}</span>
                                                </div>
                                                {log.remarks && <p className="text-xs text-gray-600 mb-2 italic">"{log.remarks}"</p>}
                                                {log.screenshot_url && (
                                                    <div className="mt-2">
                                                        <a href={log.screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:underline">
                                                            <Eye size={12} /> View Screenshot
                                                        </a>
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-gray-400 mt-2">— {log.changed_by}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Subtask specific screenshot */}
                            {selected.task_id && selected.screenshot_url && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">Attachment</h4>
                                    <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 font-medium hover:bg-blue-100 transition">
                                        <Eye size={16} /> View Attached Screenshot
                                    </a>
                                </div>
                            )}
                        </div>
                    )
                )}
            </Modal>
        </div>
    )
}