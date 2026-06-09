import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Activity, Info, CheckCircle, Search, Eye, ChevronDown, Lock, Unlock, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import SubStatusPicker from '../../components/ui/SubStatusPicker'
import CustomSelect from '../../components/ui/CustomSelect'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { formatDate } from '../../utils/dateHelper'

const DEFAULT_SUB_STATUSES = [
    'Documentation pending',
    'Awaiting approval',
    'Completed'
];

const getSubStatusOptions = (task) => {
    if (!task || !task.dynamic_fields) return DEFAULT_SUB_STATUSES;
    let fields = task.dynamic_fields;
    if (typeof fields === 'string') {
        try { fields = JSON.parse(fields); } catch(e) {}
    }
    const schema = fields?.schema;
    if (Array.isArray(schema)) {
        const subStatusField = schema.find(f => f.id === 'static_sub_status');
        if (subStatusField && Array.isArray(subStatusField.options) && subStatusField.options.length > 0) {
            return subStatusField.options;
        }
    }
    return DEFAULT_SUB_STATUSES;
};

const statusFilters = [
    { value: '', label: 'All Status' },
    { value: 'complete', label: 'Complete' },
    { value: 'work_in_progress', label: 'Work In Progress' },
    { value: 'pending', label: 'Pending' },
    { value: 'not_to_be_done', label: 'Not To Be Done' },
    { value: 'other', label: 'Other' },
]

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, sub, active, onClick }) {
    return (
        <div 
            onClick={onClick}
            className={`rounded-2xl p-6 transition-all duration-200 flex flex-col gap-3 group relative overflow-hidden border
                ${active 
                    ? 'bg-[#1F5C99]/5 border-[#1F5C99] shadow-md ring-4 ring-[#1F5C99]/10 -translate-y-1' 
                    : 'bg-white border-slate-200/80 shadow-sm hover:border-[#1F5C99]/40 hover:-translate-y-0.5 hover:shadow-md'}`}
        >
            <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${iconBg}`}>
                    <Icon size={22} className={iconColor} />
                </div>
                <div className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-[#1F5C99] transition-all duration-300 absolute top-4 right-4 animate-in fade-in duration-200">
                    <Eye size={16} />
                </div>
            </div>
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">{label}</p>
            <p className="text-4xl font-extrabold text-slate-900">{String(value).padStart(2, '0')}</p>
            <p className="text-xs text-slate-600">{sub}</p>
        </div>
    )
}

export default function MyTasksPage() {
    const { user } = useAuth()
    const navigate = useNavigate()

    // Inline Add Subtask State
    const [isAddingSubTask, setIsAddingSubTask] = useState(false)
    const [newSubTaskTitle, setNewSubTaskTitle] = useState('')
    const [newSubTaskAssignee, setNewSubTaskAssignee] = useState('')
    const [submittingSubTask, setSubmittingSubTask] = useState(false)

    // Create task (sheet) modal state
    const [createOpen, setCreateOpen] = useState(false)
    const [clients, setClients] = useState([])
    const [workTypes, setWorkTypes] = useState([])
    const [createClientId, setCreateClientId] = useState('')
    const [createWorkTypeId, setCreateWorkTypeId] = useState('')
    const [createFormName, setCreateFormName] = useState('')
    const [createDateInward, setCreateDateInward] = useState(new Date().toISOString().split('T')[0])
    const [createDateAllocated, setCreateDateAllocated] = useState(new Date().toISOString().split('T')[0])
    const [createRemarks, setCreateRemarks] = useState('')
    const [createTaskParticular, setCreateTaskParticular] = useState('')
    const [creatingSheet, setCreatingSheet] = useState(false)
    const [createError, setCreateError] = useState('')

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
    const [subStatus, setSubStatus] = useState('')
    const [viewOpen, setViewOpen] = useState(false)
    const [viewLoading, setViewLoading] = useState(false)

    // Custom Confirm Dialog State
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: '',
        message: '',
        confirmLabel: '',
        onConfirm: null,
        danger: false,
        loading: false
    });

    const fetchMetadataForCreation = async () => {
        try {
            const [cRes, wRes] = await Promise.all([
                api.get('/daily-reports/clients'),
                api.get('/daily-reports/work-types')
            ])
            setClients(cRes.data.data || cRes.data || [])
            setWorkTypes(wRes.data.data || wRes.data || [])
        } catch (e) {
            console.error("Failed to fetch clients/worktypes for creation", e)
        }
    }

    const openCreate = () => {
        setCreateClientId('')
        setCreateWorkTypeId('')
        setCreateFormName('')
        setCreateDateInward(new Date().toISOString().split('T')[0])
        setCreateDateAllocated(new Date().toISOString().split('T')[0])
        setCreateRemarks('')
        setCreateTaskParticular('')
        setCreateError('')
        setCreateOpen(true)
        fetchMetadataForCreation()
    }

    const handleCreateSheet = async () => {
        if (!createWorkTypeId || !createFormName.trim()) {
            setCreateError('Nature of Work and Sheet Name are required.')
            return
        }
        setCreatingSheet(true)
        setCreateError('')
        try {
            await api.post('/staff/tasks', {
                client_id: createClientId || null,
                work_type_id: createWorkTypeId,
                form_name: createFormName,
                date_inward: createDateInward,
                date_allocated: createDateAllocated,
                remarks: createRemarks,
                task_particular: createTaskParticular,
            })
            toast.success('Main sheet created successfully!')
            setCreateOpen(false)
            await fetchTasks()
        } catch (e) {
            setCreateError(e.response?.data?.message || 'Failed to create sheet.')
        } finally {
            setCreatingSheet(false)
        }
    }

    const handleAddSubTask = async () => {
        if (!newSubTaskTitle.trim()) return
        setSubmittingSubTask(true)
        try {
            await api.post(`/staff/tasks/${selected.id}/sub-tasks`, {
                title: newSubTaskTitle,
                assigned_to: newSubTaskAssignee || null,
                priority: 'medium',
                status: 'pending',
            })
            toast.success('Task item added successfully!')
            setIsAddingSubTask(false)
            setNewSubTaskTitle('')
            setNewSubTaskAssignee('')
            
            // Refresh modal details
            await openView(selected)
            // Refresh task lists
            await fetchTasks()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to add task item.')
        } finally {
            setSubmittingSubTask(false)
        }
    }

    const fetchSummary = async () => {
        const res = await api.get('/staff/dashboard/summary')
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
        setSubStatus(task.sub_status || '')
        setUpdateOpen(true)
    }

    const openView = (item) => {
        const taskId = item.task_id || item.id;
        navigate(`/staff/tasks/${taskId}`);
    };

    const handleUpdateStatus = async () => {
        if (!newStatus) { setUpdateError('Please select a status.'); return }
        setSaving(true); setUpdateError('')
        try {
            const formData = new FormData()
            formData.append('status', newStatus)
            if (remark) formData.append('remarks', remark)
            if (screenshot) formData.append('screenshot', screenshot)
            if (selected.task_id && subStatus) formData.append('sub_status', subStatus)
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

    const attachmentsAllowed = selected
        ? (selected.task_id ? !!selected.task?.allow_attachments : !!selected.allow_attachments)
        : false;

    const cards = summary ? [
        { 
            icon: ClipboardList, iconBg: 'bg-slate-50',  iconColor: 'text-slate-500',  label: 'Total Sheets',     value: summary.total_sheets ?? 0,      sub: 'All sheets assigned',
            active: activeTab === 'tasks' && statusFilter === '',
            onClick: () => { setActiveTab('tasks'); setStatusFilter(''); }
        },
        { 
            icon: Activity,     iconBg: 'bg-yellow-50', iconColor: 'text-yellow-500', label: 'Pending',          value: summary.pending_sheets ?? 0,          sub: 'Waiting to start',
            active: activeTab === 'tasks' && statusFilter === 'pending',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('pending'); }
        },
        { 
            icon: Info,         iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',   label: 'Work In Progress', value: summary.work_in_progress_sheets ?? 0,  sub: 'Currently active',
            active: activeTab === 'tasks' && statusFilter === 'work_in_progress',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('work_in_progress'); }
        },
        { 
            icon: CheckCircle,  iconBg: 'bg-green-50',  iconColor: 'text-green-500',  label: 'Complete',         value: summary.complete_sheets ?? 0,         sub: 'Finalized tasks',
            active: activeTab === 'tasks' && statusFilter === 'complete',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('complete'); }
        },
        { 
            icon: ClipboardList,iconBg: 'bg-red-50',    iconColor: 'text-red-500',    label: 'Not To Be Done',   value: summary.not_to_be_done_sheets ?? 0,   sub: 'Excluded tasks',
            active: activeTab === 'tasks' && statusFilter === 'not_to_be_done',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('not_to_be_done'); }
        },
        { 
            icon: ClipboardList,iconBg: 'bg-gray-50',   iconColor: 'text-gray-500',   label: 'Other',            value: summary.other_sheets ?? 0,            sub: 'Other tasks',
            active: activeTab === 'tasks' && statusFilter === 'other',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('other'); }
        },
    ] : []

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">My Sheets</h1>
            </div>

            {/* Summary Cards */}
            {summary ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 animate-fade-in">
                    {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
                    <SummaryCard
                        icon={ClipboardList}
                        iconBg="bg-indigo-50"
                        iconColor="text-indigo-500"
                        label="My Tasks"
                        value={subTasks.length}
                        sub="Assigned tasks"
                        active={activeTab === 'subtasks'}
                        onClick={() => { setActiveTab('subtasks'); setStatusFilter(''); }}
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
                        Tasks ({subTasks.length})
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
                    <CustomSelect
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        options={statusFilters}
                        widthClass="w-full sm:w-auto min-w-[125px]"
                        className="flex-1 sm:flex-none"
                    />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {activeTab === 'tasks' ? (
                                        ['#', 'Sheet Name', 'Work Type', 'Inward', 'Status', 'Remarks', 'Actions'].map(h => (
                                            <th key={h} className="px-6 py-3 text-left whitespace-nowrap">{h}</th>
                                        ))
                                    ) : (
                                        ['#', 'Task Title', 'Parent Sheet', 'Priority', 'Status', 'Sub Status', 'Actions'].map(h => (
                                            <th key={h} className="px-6 py-3 text-left whitespace-nowrap">{h}</th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black">
                                {activeTab === 'tasks' ? (
                                    tasks?.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sheets found</td></tr>
                                    ) : tasks?.map((t, i) => (
                                        <tr 
                                            key={t.id} 
                                            className="hover:bg-slate-50 transition-all cursor-pointer"
                                            onClick={() => openView(t)}
                                        >
                                            <td className="px-6 py-4 text-gray-400">{i + 1}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-800 whitespace-nowrap">{t.form_name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{t.work_type?.name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.date_inward)}</td>
                                            <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                            <td className="px-6 py-4 text-gray-400 max-w-[160px] truncate">{t.remarks ?? '—'}</td>
                                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={(e) => { e.stopPropagation(); openView(t); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"><Eye size={15} /></button>
                                                    {t.status !== 'completed' && (transitions[t.status] ?? []).length > 0 && t.user_permissions?.can_write !== false && (
                                                        <button onClick={(e) => { e.stopPropagation(); openUpdate(t); }} className="px-3 py-1.5 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition">Update</button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    subTasks?.length === 0 ? (
                                        <tr><td colSpan={7} className="text-center py-12 text-gray-400">No tasks found</td></tr>
                                    ) : subTasks?.map((st, i) => (
                                        <tr 
                                            key={st.id} 
                                            className="hover:bg-slate-50 transition-all cursor-pointer"
                                            onClick={() => openView(st)}
                                        >
                                            <td className="px-6 py-4 text-gray-400">{i + 1}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-800">{st.title}</td>
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{st.task?.work_type || 'N/A'}</td>
                                            <td className="px-6 py-4 capitalize font-medium">{st.priority}</td>
                                            <td className="px-6 py-4"><StatusBadge status={st.status} /></td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-700">
                                                {st.sub_status || <span className="text-gray-300 italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <button onClick={(e) => { e.stopPropagation(); openView(st); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition"><Eye size={15} /></button>
                                                    {st.user_permissions?.can_write !== false && (
                                                        <div className="flex items-center gap-2">
                                                            {st.is_verified ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold select-none shrink-0" title="Verified and Locked">
                                                                    <Lock size={12} className="text-rose-600 animate-pulse animate-duration-1000" />
                                                                    Verified
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); openUpdate(st); }}
                                                                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition shrink-0 cursor-pointer"
                                                                        style={{ cursor: 'pointer' }}
                                                                    >
                                                                        Update
                                                                    </button>
                                                                    {st.status === 'complete' ? (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setConfirmState({
                                                                                    open: true,
                                                                                    title: 'Verify & Lock Task',
                                                                                    message: 'Are you sure you want to verify and lock this task? Once verified, you cannot modify its status or details again.',
                                                                                    confirmLabel: 'Verify & Lock',
                                                                                    danger: false,
                                                                                    onConfirm: async () => {
                                                                                        setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                        try {
                                                                                            await api.patch(`/staff/sub-tasks/${st.id}/status`, { 
                                                                                                status: st.status,
                                                                                                is_verified: true 
                                                                                            });
                                                                                            toast.success("Task verified and locked successfully!");
                                                                                            await Promise.all([fetchSummary(), fetchTasks()]);
                                                                                        } catch (err) {
                                                                                            toast.error(err.response?.data?.message || "Failed to verify task");
                                                                                        } finally {
                                                                                            setConfirmState({
                                                                                                open: false,
                                                                                                title: '',
                                                                                                message: '',
                                                                                                confirmLabel: '',
                                                                                                onConfirm: null,
                                                                                                danger: false,
                                                                                                loading: false
                                                                                            });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }}
                                                                            className="px-2.5 py-1.5 text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition flex items-center gap-1 shrink-0 cursor-pointer"
                                                                            style={{ cursor: 'pointer' }}
                                                                        >
                                                                            <Unlock size={12} className="text-green-600" />
                                                                            Verify
                                                                        </button>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold select-none shrink-0" title="Unlocked">
                                                                            <Unlock size={12} className="text-green-600" />
                                                                            Unlocked
                                                                        </span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
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
                                    {['complete', 'work_in_progress', 'pending', 'not_to_be_done', 'other'].map(s => (
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

                        {/* Sub Status (only for subtasks) */}
                        {selected.task_id && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                    Sub Status
                                </label>
                                <SubStatusPicker
                                    value={subStatus}
                                    onChange={(val) => setSubStatus(val)}
                                    options={selected.task ? getSubStatusOptions(selected.task) : []}
                                />
                            </div>
                        )}

                        {/* Auto-complete note */}
                        {newStatus === 'complete' && (
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
                        {attachmentsAllowed && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    Attach File / Screenshot <span className="text-gray-300 font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="file"
                                    onChange={e => setScreenshot(e.target.files[0])}
                                    className={inputCls + " file:mr-4 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#0f1c2e] file:text-white hover:file:bg-[#1a2f4a] cursor-pointer"}
                                />
                                <p className="text-[10px] text-gray-400">Max size: 5MB (Any file type)</p>
                            </div>
                        )}

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
                                    <p className="text-sm font-bold text-gray-900">{formatDate(selected.date_inward || selected.task?.date_inward)}</p>
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Allocation / Due Date</h4>
                                    <p className="text-sm font-bold text-gray-900">{formatDate(selected.date_allocated || selected.due_date)}</p>
                                </div>
                                {(selected.date_completed || selected.completed_at || selected.task?.date_completed) && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Completion Date</h4>
                                        <p className="text-sm font-bold text-gray-900">{formatDate(selected.date_completed || selected.completed_at || selected.task?.date_completed)}</p>
                                    </div>
                                )}
                                {selected.task_id && selected.sub_status && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Sub Status</h4>
                                        <p className="text-sm font-bold text-gray-900">{selected.sub_status}</p>
                                    </div>
                                )}
                            </div>

                            {selected.remarks && (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Remarks</h4>
                                    <p className="text-sm text-gray-600 leading-relaxed">{selected.remarks}</p>
                                </div>
                            )}

                            {selected.dynamic_fields && Object.keys(selected.dynamic_fields).filter(key => !['schema', 'multi_rows', 'field_names', 'field_types'].includes(key)).length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">Custom Fields Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {Object.entries(selected.dynamic_fields)
                                            .filter(([key]) => !['schema', 'multi_rows', 'field_names', 'field_types'].includes(key))
                                            .map(([key, val]) => (
                                                <div key={key} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{key}</h5>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {typeof val === 'boolean' 
                                                            ? (val ? 'Yes' : 'No') 
                                                            : Array.isArray(val)
                                                                ? val.join(', ')
                                                                : typeof val === 'object' && val !== null
                                                                    ? JSON.stringify(val)
                                                                    : (val || '—')
                                                        }
                                                    </p>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}

                            {/* Checklist / Subtasks Section for Main Sheet */}
                            {!selected.task_id && (
                                <div className="space-y-4 pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                        <h4 className="text-xs font-bold text-gray-900">Checklist / Tasks</h4>
                                        {selected.allocated_to?.id === user?.id && (
                                            <button
                                                onClick={() => setIsAddingSubTask(true)}
                                                className="flex items-center gap-1 text-[11px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-100 rounded-lg px-2.5 py-1 transition cursor-pointer select-none"
                                            >
                                                <Plus size={12} /> Add Task Item
                                            </button>
                                        )}
                                    </div>

                                    {/* Add Subtask Form inline */}
                                    {isAddingSubTask && (
                                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100 space-y-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Task Title *</label>
                                                    <input
                                                        type="text"
                                                        value={newSubTaskTitle}
                                                        onChange={e => setNewSubTaskTitle(e.target.value)}
                                                        placeholder="e.g. Verification of GST Portal..."
                                                        className="w-full px-3 py-1.8 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Assignee</label>
                                                    <select
                                                        value={newSubTaskAssignee}
                                                        onChange={e => setNewSubTaskAssignee(e.target.value)}
                                                        className="w-full px-3 py-1.8 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700 cursor-pointer"
                                                    >
                                                        <option value="">Unassigned</option>
                                                        <option value={user?.id}>{user?.name} (Myself)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setIsAddingSubTask(false);
                                                        setNewSubTaskTitle('');
                                                        setNewSubTaskAssignee('');
                                                    }}
                                                    className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleAddSubTask}
                                                    disabled={submittingSubTask || !newSubTaskTitle.trim()}
                                                    className="px-4 py-1.5 text-[11px] font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] disabled:opacity-60 transition cursor-pointer"
                                                >
                                                    {submittingSubTask ? 'Adding...' : 'Add Item'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Subtask list */}
                                    {selected.sub_tasks?.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic py-4 text-center bg-gray-50/30 rounded-xl border border-gray-100">No subtasks defined for this sheet.</p>
                                    ) : (
                                        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-gray-50 border-b border-gray-100 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                                                        <th className="px-4 py-2 text-left">Task</th>
                                                        <th className="px-4 py-2 text-left">Assignee</th>
                                                        <th className="px-4 py-2 text-left">Priority</th>
                                                        <th className="px-4 py-2 text-left">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-black bg-white">
                                                    {selected.sub_tasks?.map(st => (
                                                        <tr key={st.id} className="hover:bg-slate-50/30 transition">
                                                            <td className="px-4 py-2.5 font-semibold text-gray-700">{st.title}</td>
                                                            <td className="px-4 py-2.5 text-gray-650 font-medium">{st.assigned_to?.name || 'Unassigned'}</td>
                                                            <td className="px-4 py-2.5 capitalize font-bold text-gray-650">{st.priority}</td>
                                                            <td className="px-4 py-2.5"><StatusBadge status={st.status} /></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
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
                        </div>
                    )
                )}
            </Modal>

            {/* Create Sheet Modal */}
            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Create New Sheet"
                width="max-w-2xl"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Client (Optional)
                            </label>
                            <select
                                value={createClientId}
                                onChange={e => setCreateClientId(e.target.value)}
                                className={inputCls + " cursor-pointer font-semibold text-gray-700"}
                            >
                                <option value="">— Select Client —</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Nature of Work *
                            </label>
                            <select
                                value={createWorkTypeId}
                                onChange={e => setCreateWorkTypeId(e.target.value)}
                                className={inputCls + " cursor-pointer font-semibold text-gray-700"}
                            >
                                <option value="">— Select Nature —</option>
                                {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Sheet / Form Name *
                            </label>
                            <input
                                type="text"
                                value={createFormName}
                                onChange={e => setCreateFormName(e.target.value)}
                                placeholder="e.g. GST GSTR-3B filing..."
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Task Particulars
                            </label>
                            <input
                                type="text"
                                value={createTaskParticular}
                                onChange={e => setCreateTaskParticular(e.target.value)}
                                placeholder="e.g. FY 2025-26 April..."
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Inward Date
                            </label>
                            <input
                                type="date"
                                value={createDateInward}
                                onChange={e => setCreateDateInward(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                                Allocated Date
                            </label>
                            <input
                                type="date"
                                value={createDateAllocated}
                                onChange={e => setCreateDateAllocated(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
                            Remarks
                        </label>
                        <textarea
                            value={createRemarks}
                            onChange={e => setCreateRemarks(e.target.value)}
                            rows={3}
                            placeholder="Add any internal instructions or remarks..."
                            className={inputCls}
                        />
                    </div>

                    {createError && (
                        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                            {createError}
                        </p>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setCreateOpen(false)}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateSheet}
                            disabled={creatingSheet || !createWorkTypeId || !createFormName.trim()}
                            className="px-5 py-2 text-sm bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white rounded-xl disabled:opacity-60 transition cursor-pointer"
                        >
                            {creatingSheet ? 'Creating...' : 'Create Sheet'}
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog
                open={confirmState.open}
                onClose={() => setConfirmState(prev => ({ ...prev, open: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel={confirmState.confirmLabel}
                loading={confirmState.loading}
                danger={confirmState.danger}
            />
        </div>
    )
}