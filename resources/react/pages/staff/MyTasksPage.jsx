import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Activity, Info, CheckCircle, Search, Eye, ChevronDown, Lock, Unlock, Plus, Trash2, Folder as FolderIcon, ChevronLeft, Sliders, X, FileText, CircleDashed, Clock, CheckCircle2, Circle, Copy } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import SubStatusPicker from '../../components/ui/SubStatusPicker'
import CustomSelect from '../../components/ui/CustomSelect'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'
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

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, sub, subColor, onClick, active }) {
    let inactiveBgClass = '';
    let activeClass = '';

    if (iconColor.includes('blue')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0F7FF] border-blue-100 text-slate-750 hover:border-blue-300';
        activeClass = 'active-card-blue ring-4 ring-blue-500/5 shadow-lg shadow-blue-500/5 scale-[1.02]';
    } else if (iconColor.includes('amber') || iconColor.includes('yellow')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFFBEB] border-amber-100 text-slate-750 hover:border-amber-300';
        activeClass = 'active-card-amber ring-4 ring-amber-500/5 shadow-lg shadow-amber-500/5 scale-[1.02]';
    } else if (iconColor.includes('green') || iconColor.includes('emerald')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0FDF4] border-emerald-100 text-slate-750 hover:border-emerald-300';
        activeClass = 'active-card-emerald ring-4 ring-emerald-500/5 shadow-lg shadow-emerald-500/5 scale-[1.02]';
    } else if (iconColor.includes('red') || iconColor.includes('rose')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFF5F5] border-red-100 text-slate-750 hover:border-red-300';
        activeClass = 'active-card-rose ring-4 ring-red-500/5 shadow-lg shadow-red-500/5 scale-[1.02]';
    } else {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F8FAFC] border-slate-200 text-slate-750 hover:border-slate-400';
        activeClass = 'active-card-slate ring-4 ring-slate-500/5 shadow-lg shadow-slate-500/5 scale-[1.02]';
    }

    return (
        <div 
            onClick={onClick}
            className={`rounded-2xl p-4.5 transition-all duration-300 flex flex-col gap-3.5 cursor-pointer select-none border
                ${active 
                    ? `${activeClass} -translate-y-0.5` 
                    : `${inactiveBgClass} shadow-sm hover:-translate-y-0.5 hover:shadow-md`}`}
        >
            <div className="flex items-center justify-between">
                <div className={`p-2 rounded-xl transition-colors ${iconBg}`}>
                    <Icon size={18} className={iconColor} />
                </div>
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-900">{label}</p>
                <p className={`text-[10px] font-medium mt-0.5 ${subColor || 'text-slate-600'}`}>{sub}</p>
            </div>
        </div>
    );
}

export default function MyTasksPage() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [currentFolder, setCurrentFolder] = useState(null)
    const [duplicateOpen, setDuplicateOpen] = useState(false)
    const [duplicateSheetName, setDuplicateSheetName] = useState('')

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
                api.get('/staff/tasks', { 
                    params: { 
                        search, 
                        status: statusFilter, 
                        per_page: 50 
                    } 
                }),
                api.get('/staff/sub-tasks', { params: { search, status: statusFilter } })
            ])
            setTasks(tasksRes.data.data || [])
            setSubTasks(subTasksRes.data.data || [])
        } catch (error) {
            console.error('Failed to fetch tasks', error)
            setTasks([])
            setSubTasks([])
        } finally { setLoading(false) }
    }, [search, statusFilter, activeTab])

    const fetchTransitions = async () => {
        const res = await api.get('/task-status-transitions')
        setTransitions(res.data.data)
    }

    useEffect(() => {
        Promise.all([fetchSummary(), fetchTransitions(), fetchMetadataForCreation()])
    }, [])

    useEffect(() => { fetchTasks() }, [fetchTasks])

    const openDuplicateModal = (task) => {
        setSelected(task);
        setDuplicateSheetName(`${task.form_name} (Copy)`);
        setDuplicateOpen(true);
    };

    const handleDuplicate = async (withData) => {
        setDuplicateOpen(false);
        setSaving(true);
        try {
            const res = await api.get(`/staff/tasks/${selected.id}`);
            const fullTask = res.data.data;

            const newName = duplicateSheetName;
            const trimmedName = (newName || '').trim();
            if (!trimmedName) {
                toast.error("Sheet Name cannot be empty.");
                setSaving(false);
                return;
            }

            const payload = {
                form_name: trimmedName,
                client_id: withData ? (fullTask.client?.id || null) : null,
                work_type_id: fullTask.work_type?.id || null,
                date_inward: new Date().toISOString().split('T')[0],
                allocated_to: withData ? (fullTask.allocated_to?.id || null) : null,
                date_allocated: withData ? (fullTask.date_allocated || null) : null,
                due_date: withData ? (fullTask.due_date || null) : null,
                status: 'pending',
                remarks: withData ? (fullTask.remarks || '') : '',
                task_particular: withData ? (fullTask.task_particular || '') : '',
                sub_status: withData ? (fullTask.sub_status || '') : '',
                feedback: withData ? (fullTask.feedback || '') : '',
                entry_date: withData ? (fullTask.entry_date || null) : null,
                allow_attachments: !!fullTask.allow_attachments,
                allow_checklist: !!fullTask.allow_checklist,
                allow_notes: !!fullTask.allow_notes,
                permissions: (fullTask.permissions || []).map(p => ({
                    role_id: Number(p.role_id),
                    can_read: !!p.can_read,
                    can_write: !!p.can_write,
                    can_delete: !!p.can_delete
                })),
                dynamic_fields: withData ? fullTask.dynamic_fields : {
                    ...(fullTask.dynamic_fields || {}),
                    multi_rows: [],
                    ...Object.fromEntries(
                        Object.keys(fullTask.dynamic_fields || {})
                            .filter(k => !['schema', 'multi_rows', 'field_names', 'field_types', 'CA Feedback', 'CA Rating'].includes(k))
                            .map(k => [k, ''])
                    )
                },
                subtasks: (fullTask.sub_tasks || []).map(st => ({
                    title: st.title,
                    assigned_to: withData ? st.assigned_to?.id : null,
                    priority: withData ? st.priority : 'medium',
                    status: 'pending',
                    due_date: withData ? st.due_date : null,
                    remarks: withData ? st.remarks : ''
                }))
            };

            await api.post('/staff/tasks', payload);
            toast.success('Sheet duplicated successfully!');
            await Promise.all([fetchSummary(), fetchTasks()]);
        } catch (err) {
            console.error('Duplication Error:', err);
            toast.error('Failed to duplicate sheet');
        } finally {
            setSaving(false);
        }
    };

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
        navigate(`/staff/tasks/${taskId}`, { state: { filterStaffName: user?.name } });
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
                await api.post(`/staff/sub-tasks/${selected.id}/status`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            } else {
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
            icon: FileText, iconBg: 'bg-slate-50',  iconColor: 'text-slate-500',  label: 'Total Sheets',     value: summary.total_sheets ?? 0,      sub: 'All sheets assigned',
            active: activeTab === 'tasks' && statusFilter === '',
            onClick: () => { setActiveTab('tasks'); setStatusFilter(''); }
        },
        { 
            icon: CircleDashed, iconBg: 'bg-amber-55', iconColor: 'text-amber-500', label: 'Pending',          value: summary.pending_sheets ?? 0,          sub: 'Waiting to start',
            subColor: 'text-amber-500 font-medium',
            active: activeTab === 'tasks' && statusFilter === 'pending',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('pending'); }
        },
        { 
            icon: Clock, iconBg: 'bg-blue-55',   iconColor: 'text-blue-500',   label: 'Work In Progress', value: summary.work_in_progress_sheets ?? 0,  sub: 'Currently active',
            subColor: 'text-blue-500 font-medium',
            active: activeTab === 'tasks' && statusFilter === 'work_in_progress',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('work_in_progress'); }
        },
        { 
            icon: CheckCircle2, iconBg: 'bg-green-55',  iconColor: 'text-green-500',  label: 'Complete',         value: summary.complete_sheets ?? 0,         sub: 'Finalized tasks',
            subColor: 'text-green-500 font-medium',
            active: activeTab === 'tasks' && statusFilter === 'complete',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('complete'); }
        },
        { 
            icon: Circle, iconBg: 'bg-red-55',    iconColor: 'text-red-500',    label: 'Not To Be Done',   value: summary.not_to_be_done_sheets ?? 0,   sub: 'Excluded tasks',
            subColor: 'text-red-500 font-medium',
            active: activeTab === 'tasks' && statusFilter === 'not_to_be_done',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('not_to_be_done'); }
        },
        { 
            icon: Sliders, iconBg: 'bg-slate-50',   iconColor: 'text-slate-500',   label: 'Other',            value: summary.other_sheets ?? 0,            sub: 'Other tasks',
            active: activeTab === 'tasks' && statusFilter === 'other',
            onClick: () => { setActiveTab('tasks'); setStatusFilter('other'); }
        },
    ] : []

    const FolderCard = ({ name, iconBg, iconColor, onClick }) => {
        const borderClasses = {
            'text-slate-500': 'border-slate-200 hover:border-slate-500',
            'text-blue-500': 'border-blue-200 hover:border-blue-500',
            'text-orange-500': 'border-orange-200 hover:border-orange-500',
            'text-emerald-500': 'border-emerald-200 hover:border-emerald-500',
            'text-sky-500': 'border-sky-200 hover:border-sky-500',
            'text-teal-500': 'border-teal-200 hover:border-teal-500',
            'text-red-500': 'border-red-200 hover:border-red-500',
            'text-indigo-500': 'border-indigo-200 hover:border-indigo-500',
            'text-purple-500': 'border-purple-200 hover:border-purple-500',
            'text-pink-500': 'border-pink-200 hover:border-pink-500',
        };
        const colorClasses = borderClasses[iconColor] || 'border-slate-200 hover:border-[#1F5C99]';

        return (
            <div
                onClick={onClick}
                className={`group cursor-pointer p-5 bg-white rounded-2xl border ${colorClasses} shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-center gap-4 text-center select-none`}
            >
                <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                    <FolderIcon size={32} className={iconColor} fill="currentColor" fillOpacity={0.2} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight group-hover:text-[#1F5C99] transition-colors">{name}</h3>
                </div>
            </div>
        );
    };

    const SheetSmallCard = ({ task }) => (
        <Tooltip content={`${task.form_name || 'Unnamed Sheet'} — ${task.client?.name || 'No Client'}`}>
            <div 
                onClick={() => navigate(`/staff/tasks/${task.id}`, { state: { filterStaffName: user?.name } })}
                className="group cursor-pointer bg-white rounded-xl p-3 border border-slate-200 hover:border-[#1F5C99] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3 select-none w-full"
            >
                <div className="p-2 rounded-lg bg-[#E8F1FC] text-[#1F5C99] group-hover:scale-105 transition-transform duration-200">
                    <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-800 text-xs truncate group-hover:text-[#1F5C99] transition-colors">
                        {task.form_name || 'Unnamed Sheet'}
                    </h4>
                </div>
            </div>
        </Tooltip>
    );

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">My Sheets</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Monitor, assign, and manage all your office work entries.</p>
                </div>
                <div className="flex items-center gap-3">
                    {user?.special_permissions?.create_sheet && (
                        <button 
                            onClick={() => navigate('/staff/tasks/builder')}
                            className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 w-full sm:w-auto cursor-pointer"
                        >
                            <Plus size={15} /> Create Sheet
                        </button>
                    )}
                </div>
            </div>



            {/* Sheets Quick Overview */}
            {activeTab === 'tasks' && tasks && tasks.length > 0 && (
                <div className="my-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-wide mb-3 flex items-center gap-2">
                        <FileText size={16} className="text-[#1F5C99]" />
                        Sheets Quick Overview
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {tasks.map(t => (
                            <SheetSmallCard key={t.id} task={t} />
                        ))}
                    </div>
                </div>
            )}

            {/* Main content box */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
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

                <>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
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
                        <div className="overflow-x-auto relative">
                            {loading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-50">
                                    <Spinner />
                                </div>
                            )}
                            <table className={`w-full text-sm ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                                <thead>
                                    <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                        {activeTab === 'tasks' ? (
                                            ['#', 'Sheet Name', 'Work Type', 'Remark', 'Actions'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left whitespace-nowrap text-white font-bold">{h}</th>
                                            ))
                                        ) : (
                                            ['#', 'Task Title', 'Parent Sheet', 'Priority', 'Status', 'Sub Status', 'Actions'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left whitespace-nowrap text-white font-bold">{h}</th>
                                            ))
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {activeTab === 'tasks' ? (
                                        tasks?.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center py-12 text-gray-400">No sheets found</td></tr>
                                        ) : tasks?.map((t, i) => (
                                            <tr 
                                                key={t.id} 
                                                className="hover:bg-slate-50 transition duration-150 border-b border-gray-100 cursor-pointer"
                                                onClick={() => openView(t)}
                                            >
                                                <td className="px-4 py-3 text-gray-400 font-semibold text-xs">{i + 1}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{t.form_name || 'N/A'}</td>
                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{t.work_type?.name || 'N/A'}</td>
                                                <td className="px-4 py-3 text-gray-650 max-w-[300px] truncate">{t.remarks ?? '—'}</td>
                                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1.5">
                                                        <Tooltip content="View Sheet Details">
                                                            <button onClick={(e) => { e.stopPropagation(); openView(t); }} className="p-1.5 rounded-lg hover:bg-gray-150 text-gray-500 hover:text-gray-900 transition cursor-pointer"><Eye size={15} /></button>
                                                        </Tooltip>
                                                        
                                                        {user?.special_permissions?.create_sheet && (
                                                            <Tooltip content="Duplicate Sheet">
                                                                <button onClick={(e) => { e.stopPropagation(); openDuplicateModal(t); }} className="p-1.5 rounded-lg hover:bg-gray-150 text-gray-500 hover:text-[#1F5C99] transition cursor-pointer"><Copy size={15} /></button>
                                                            </Tooltip>
                                                        )}

                                                        {user?.special_permissions?.delete_sheet && (
                                                            <Tooltip content="Delete Sheet">
                                                                <button 
                                                                    onClick={(e) => { 
                                                                        e.stopPropagation(); 
                                                                        setConfirmState({
                                                                            open: true,
                                                                            title: 'Delete Sheet',
                                                                            message: `Are you sure you want to delete the sheet "${t.form_name}"? This action cannot be undone.`,
                                                                            confirmLabel: 'Delete',
                                                                            danger: true,
                                                                            onConfirm: async () => {
                                                                                setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                try {
                                                                                    await api.delete(`/staff/tasks/${t.id}`);
                                                                                    toast.success("Sheet deleted successfully!");
                                                                                    await Promise.all([fetchSummary(), fetchTasks()]);
                                                                                } catch (err) {
                                                                                    toast.error(err.response?.data?.message || "Failed to delete sheet");
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
                                                                    className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-600 hover:bg-rose-100 hover:text-rose-800 transition cursor-pointer"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </Tooltip>
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
                                                className="hover:bg-slate-50 transition duration-150 border-b border-gray-100 cursor-pointer"
                                                onClick={() => openView(st)}
                                            >
                                                <td className="px-4 py-3 text-gray-400 font-semibold text-xs">{i + 1}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800">{st.title}</td>
                                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{st.task?.work_type || 'N/A'}</td>
                                                <td className="px-4 py-3 capitalize font-bold text-gray-650">{st.priority}</td>
                                                <td className="px-4 py-3"><StatusBadge status={st.status} /></td>
                                                <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-700">
                                                    {st.sub_status || <span className="text-gray-300 italic font-normal">—</span>}
                                                </td>
                                                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <Tooltip content="View Task Details">
                                                            <button onClick={(e) => { e.stopPropagation(); openView(st); }} className="p-1.5 rounded-lg hover:bg-gray-150 text-gray-500 hover:text-gray-900 transition cursor-pointer"><Eye size={15} /></button>
                                                        </Tooltip>
                                                        {st.user_permissions?.can_write !== false && (
                                                            <div className="flex items-center gap-1.5">
                                                                {st.is_verified ? (
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold select-none shrink-0" title="Verified and Locked">
                                                                        <Lock size={12} className="text-rose-600 animate-pulse" />
                                                                        Verified
                                                                    </span>
                                                                ) : (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); openUpdate(st); }}
                                                                            className="px-3 py-1 text-xs font-semibold bg-[#0f1c2e] text-white rounded-lg hover:bg-[#1a2f4a] transition shrink-0 cursor-pointer"
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
                                                                                className="px-2.5 py-1 text-xs font-bold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition flex items-center gap-1 shrink-0 cursor-pointer"
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
                        </div>
                    </>
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

                        {newStatus === 'complete' && (
                            <div className="flex items-start gap-2 bg-green-50 border border-green-100 rounded-xl p-3">
                                <CheckCircle size={15} className="text-green-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-green-700">
                                    Date of Completion will be automatically recorded as today.
                                </p>
                            </div>
                        )}

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
                                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateStatus}
                                disabled={saving || !newStatus}
                                className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition cursor-pointer"
                            >
                                {saving ? 'Updating...' : 'Update Status'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Duplicate Modal */}
            <Modal open={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Duplicate Sheet" width="max-w-sm">
                <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-emerald-900 mb-1">
                                    Duplicate sheet: <span className="font-bold underline">{selected?.form_name}</span>
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Sheet Name</label>
                        <input
                            type="text"
                            value={duplicateSheetName}
                            onChange={e => setDuplicateSheetName(e.target.value)}
                            placeholder="Enter new sheet name..."
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-semibold"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => handleDuplicate(true)}
                            disabled={saving}
                            className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/30 transition group text-left w-full cursor-pointer"
                        >
                            <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">Duplicate with Data</span>
                            <span className="text-[11px] text-gray-400 mt-1">Copies all dynamic fields and tasks</span>
                        </button>

                        <button
                            onClick={() => handleDuplicate(false)}
                            disabled={saving}
                            className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition group text-left w-full cursor-pointer"
                        >
                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">Duplicate without Data</span>
                            <span className="text-[11px] text-gray-400 mt-1">Only copies core structure (Client, Work Type)</span>
                        </button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button onClick={() => setDuplicateOpen(false)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-800 font-semibold transition cursor-pointer">
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Create Sheet Modal */}
            <Modal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                title="Create Sheet"
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
    );
}