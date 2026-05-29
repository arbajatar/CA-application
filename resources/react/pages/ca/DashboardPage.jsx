import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    FileText, Activity, CheckCircle, AlertTriangle,
    Briefcase, Users, Search, Download, SlidersHorizontal,
    LayoutGrid, ExternalLink, Folder, CalendarDays, LayoutDashboard,
    ChevronLeft, ChevronRight, CheckCircle2, Clock, CircleDashed, ChevronDown, ChevronUp,
    Circle, Trash2, Eye
} from 'lucide-react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import SubStatusPicker from '../../components/ui/SubStatusPicker'
import CustomSelect from '../../components/ui/CustomSelect'
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

const statuses = [
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
            <div className="flex items-center justify-between gap-2">
                <div className={`p-2 rounded-xl transition-colors ${iconBg}`}>
                    <Icon size={18} className={iconColor} />
                </div>
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{String(value || 0).padStart(2, '0')}</span>
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider truncate text-slate-900" title={label}>{label}</p>
                {sub && <p className={`text-[10px] font-medium mt-0.5 truncate ${subColor ?? 'text-slate-600'}`} title={sub}>{sub}</p>}
            </div>
        </div>
    )
}

function Avatar({ name }) {
    return (
        <div className="w-9 h-9 rounded-xl bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600">
            {name?.[0]?.toUpperCase()}
        </div>
    )
}

function SheetSubtaskPills({ subTasks = [], expandedFilter, onPillClick }) {
    const total = subTasks.length
    const pending = subTasks.filter(st => st.status === 'pending').length
    const inProgress = subTasks.filter(st => st.status === 'work_in_progress').length
    const complete = subTasks.filter(st => st.status === 'complete').length
    const notToBeDone = subTasks.filter(st => st.status === 'not_to_be_done').length
    const other = subTasks.filter(st => st.status === 'other').length

    const pillStyle = (type, active) => {
        const base = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border select-none "
        if (type === 'total') return base + (active ? 'bg-gray-100 border-gray-300 text-gray-800 ring-2 ring-gray-200' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100')
        if (type === 'pending') return base + (active ? 'bg-yellow-100 border-yellow-300 text-yellow-800 ring-2 ring-yellow-200' : 'bg-yellow-50 border-yellow-100 text-yellow-600 hover:bg-yellow-100')
        if (type === 'work_in_progress') return base + (active ? 'bg-blue-100 border-blue-300 text-blue-800 ring-2 ring-blue-200' : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100')
        if (type === 'complete') return base + (active ? 'bg-green-100 border-green-300 text-green-800 ring-2 ring-green-200' : 'bg-green-50 border-green-100 text-green-600 hover:bg-green-100')
        if (type === 'not_to_be_done') return base + (active ? 'bg-red-100 border-red-300 text-red-800 ring-2 ring-red-200' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100')
        if (type === 'other') return base + (active ? 'bg-slate-100 border-slate-300 text-slate-800 ring-2 ring-slate-200' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100')
    }

    return (
        <div className="flex flex-col gap-2 w-full max-w-[340px]">
            {/* First Row */}
            <div className="flex gap-2">
                <button onClick={() => onPillClick('all')} className={pillStyle('total', expandedFilter === 'all') + " flex-1 justify-center"}>
                    <span className="truncate">All: {total}</span>
                </button>
                <button onClick={() => onPillClick('pending')} className={pillStyle('pending', expandedFilter === 'pending') + " flex-1 justify-center"}>
                    <CircleDashed size={12} className="shrink-0" />
                    <span className="truncate">Pend: {pending}</span>
                </button>
                <button onClick={() => onPillClick('work_in_progress')} className={pillStyle('work_in_progress', expandedFilter === 'work_in_progress') + " flex-1 justify-center"}>
                    <Clock size={12} className="shrink-0" />
                    <span className="truncate">Prog: {inProgress}</span>
                </button>
            </div>
            {/* Second Row */}
            <div className="flex gap-2">
                <button onClick={() => onPillClick('complete')} className={pillStyle('complete', expandedFilter === 'complete') + " flex-1 justify-center"}>
                    <CheckCircle2 size={12} className="shrink-0" />
                    <span className="truncate">Comp: {complete}</span>
                </button>
                <button onClick={() => onPillClick('not_to_be_done')} className={pillStyle('not_to_be_done', expandedFilter === 'not_to_be_done') + " flex-1 justify-center"}>
                    <Circle size={12} className="shrink-0" />
                    <span className="truncate">Not Done: {notToBeDone}</span>
                </button>
                <button onClick={() => onPillClick('other')} className={pillStyle('other', expandedFilter === 'other') + " flex-1 justify-center"}>
                    <SlidersHorizontal size={12} className="shrink-0" />
                    <span className="truncate">Other: {other}</span>
                </button>
            </div>
        </div>
    )
}

function WorkTypeSubtaskSummary({ workTypes, staff = [] }) {
    const navigate = useNavigate()
    const [selectedWorkType, setSelectedWorkType] = useState('')
    const [sheets, setSheets] = useState([])
    const [sheetsMeta, setSheetsMeta] = useState(null)
    const [globalSummary, setGlobalSummary] = useState(null)
    const [loading, setLoading] = useState(false)
    const [page, setPage] = useState(1)
    const [editingSubTaskId, setEditingSubTaskId] = useState(null)

    // Filters and states
    const [globalFilter, setGlobalFilter] = useState('') // '' | 'completed' | 'in_progress' | 'remaining'
    const [expandedTaskId, setExpandedTaskId] = useState(null)
    const [expandedFilter, setExpandedFilter] = useState('') // 'all' | 'completed' | 'in_progress' | 'remaining'

    const fetchSheets = useCallback(async () => {
        if (!selectedWorkType) return
        setLoading(true)
        try {
            const res = await api.get('/ca/dashboard/work-type-subtasks', {
                params: { work_type_id: selectedWorkType, page, per_page: 10 }
            })
            setSheets(res.data.data || [])
            setSheetsMeta(res.data.meta || null)
            if (res.data.summary) {
                setGlobalSummary(res.data.summary)
            }
        } finally {
            setLoading(false)
        }
    }, [selectedWorkType, page])

    useEffect(() => {
        setPage(1)
        setExpandedTaskId(null)
        setExpandedFilter('')
        setGlobalFilter('')
        setGlobalSummary(null)
    }, [selectedWorkType])

    useEffect(() => {
        fetchSheets()
    }, [fetchSheets])

    const handleGlobalFilterClick = (filterType) => {
        setGlobalFilter(prev => prev === filterType ? '' : filterType)
        setExpandedTaskId(null)
        setExpandedFilter('')
    }

    const handlePillClick = (taskId, filterType) => {
        if (expandedTaskId === taskId && expandedFilter === filterType) {
            setExpandedTaskId(null)
            setExpandedFilter('')
        } else {
            setExpandedTaskId(taskId)
            setExpandedFilter(filterType)
        }
    }

    const handleUpdateSubTask = async (taskId, subTaskId, updatedData) => {
        try {
            const res = await api.patch(`/ca/tasks/${taskId}/sub-tasks/${subTaskId}`, updatedData)
            const updatedSubTask = res.data.data
            
            // Find old subtask for count adjustment before state change
            const targetSheet = sheets.find(s => s.id === taskId)
            const oldSubTask = targetSheet?.sub_tasks?.find(st => st.id === subTaskId)

            // 1. Update subtasks locally in state
            setSheets(prevSheets => prevSheets.map(sheet => {
                if (sheet.id !== taskId) return sheet
                
                const updatedSubTasks = sheet.sub_tasks?.map(st => {
                    if (st.id !== subTaskId) return st
                    return { ...st, ...updatedSubTask }
                }) || []
                
                return {
                    ...sheet,
                    sub_tasks: updatedSubTasks
                }
            }))

            // 2. Adjust globalSummary counts locally in state
            if (globalSummary && oldSubTask && updatedData.status && oldSubTask.status !== updatedData.status) {
                const oldStatus = oldSubTask.status
                const newStatus = updatedData.status
                
                setGlobalSummary(prev => {
                    if (!prev) return prev
                    const next = { ...prev }
                    
                    // Decrement old status count
                    if (oldStatus in next) {
                        next[oldStatus] = Math.max(0, next[oldStatus] - 1)
                    }
                    
                    // Increment new status count
                    if (newStatus in next) {
                        next[newStatus] = (next[newStatus] || 0) + 1
                    }
                    
                    return next
                })
            }

            toast.success('Subtask updated successfully')
        } catch (e) {
            toast.error('Failed to update subtask')
        }
    }

    if (!workTypes.length) return null

    // Filter sheets below based on the selected top global card filter
    const displayedSheets = sheets.filter(sheet => {
        if (!globalFilter) return true
        const subtasks = sheet.sub_tasks || []
        return subtasks.some(st => st.status === globalFilter)
    })

    return (
        <div className="space-y-6">
            {/* Title / Work Type Dropdown */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white shadow-lg">
                    <Activity size={20} />
                </div>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Sheet-wise Subtask Summary</h2>
                        <p className="text-sm text-gray-400">View tasks and click on subtask counts to view detailed subtask sheets</p>
                    </div>
                    <CustomSelect
                        value={selectedWorkType}
                        onChange={e => { setSelectedWorkType(e.target.value); setSheets([]); }}
                        options={[
                            { value: '', label: 'Select Work Type' },
                            ...workTypes.map(wt => ({ value: wt.id, label: wt.name }))
                        ]}
                        widthClass="w-full sm:w-64"
                        className="animate-fade-in"
                    />
                </div>
            </div>

            {/* Global Summary Cards (Previous Feature - Now acts as filter) */}
            {selectedWorkType && globalSummary && (
                <div className="grid grid-cols-6 gap-4 mb-8 animate-fade-in">
                    <SummaryCard 
                        icon={FileText} iconBg="bg-gray-50" iconColor="text-gray-500" 
                        label="Global Subtasks" value={globalSummary.total} 
                        sub="All subtasks of this type"
                        active={globalFilter === ''} onClick={() => handleGlobalFilterClick('')} 
                    />
                    <SummaryCard 
                        icon={CircleDashed} iconBg="bg-yellow-50" iconColor="text-yellow-500" 
                        label="Pending" value={globalSummary.pending} 
                        sub="Waiting to start"
                        active={globalFilter === 'pending'} onClick={() => handleGlobalFilterClick('pending')} 
                    />
                    <SummaryCard 
                        icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-500" 
                        label="In Progress" value={globalSummary.work_in_progress} 
                        sub="Currently active"
                        active={globalFilter === 'work_in_progress'} onClick={() => handleGlobalFilterClick('work_in_progress')} 
                    />
                    <SummaryCard 
                        icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-500" 
                        label="Complete" value={globalSummary.complete} 
                        sub="Finalized tasks"
                        active={globalFilter === 'complete'} onClick={() => handleGlobalFilterClick('complete')} 
                    />
                    <SummaryCard 
                        icon={Circle} iconBg="bg-red-50" iconColor="text-red-500" 
                        label="Not To Be Done" value={globalSummary.not_to_be_done} 
                        sub="Excluded tasks"
                        active={globalFilter === 'not_to_be_done'} onClick={() => handleGlobalFilterClick('not_to_be_done')} 
                    />
                    <SummaryCard 
                        icon={SlidersHorizontal} iconBg="bg-slate-50" iconColor="text-slate-500" 
                        label="Other" value={globalSummary.other} 
                        sub="Other status"
                        active={globalFilter === 'other'} onClick={() => handleGlobalFilterClick('other')} 
                    />
                </div>
            )}

            {/* Sheet-wise detailed list (Current Feature - combined) */}
            {selectedWorkType && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        {loading ? <Spinner /> : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                        <th className="px-6 py-3.5 text-left w-12"></th>
                                        <th className="px-6 py-3.5 text-left">Client</th>
                                        <th className="px-6 py-3.5 text-left">Sheet/Task Form</th>
                                        <th className="px-6 py-3.5 text-left">Allocated To</th>
                                        <th className="px-6 py-3.5 text-left">Due Date</th>
                                        <th className="px-6 py-3.5 text-left">Subtasks Summary (Click to expand)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {displayedSheets.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-12 text-gray-400">No sheets found matching the active filter.</td></tr>
                                    ) : displayedSheets.map(sheet => {
                                        const isExpanded = expandedTaskId === sheet.id
                                        const sheetSubtasks = sheet.sub_tasks || []
                                        const filteredSubtasks = sheetSubtasks.filter(st => {
                                            if (expandedFilter === 'all') return true
                                            if (expandedFilter === 'pending') return st.status === 'pending'
                                            if (expandedFilter === 'work_in_progress') return st.status === 'work_in_progress'
                                            if (expandedFilter === 'complete') return st.status === 'complete'
                                            if (expandedFilter === 'not_to_be_done') return st.status === 'not_to_be_done'
                                            if (expandedFilter === 'other') return st.status === 'other'
                                            return false
                                        })
 
                                        return (
                                            <>
                                                <tr key={sheet.id} className={`hover:bg-gray-50/80 transition ${isExpanded ? 'bg-blue-50/10' : ''}`}>
                                                    <td className="px-6 py-4 text-center">
                                                        <button 
                                                            onClick={() => handlePillClick(sheet.id, isExpanded ? expandedFilter : 'all')} 
                                                            className="text-gray-400 hover:text-blue-500 transition"
                                                        >
                                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-gray-800">{sheet.client?.name || '—'}</td>
                                                    <td className="px-6 py-4 text-gray-700 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <span>{sheet.form_name || '—'}</span>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    navigate(`/ca/tasks/${sheet.id}`)
                                                                }}
                                                                className="text-gray-450 hover:text-blue-600 transition p-1 hover:bg-blue-50 rounded"
                                                                title="View Details"
                                                                >
                                                                <Eye size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-600">{sheet.allocated_to?.name ?? 'Unassigned'}</td>
                                                     <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(sheet.due_date)}</td>
                                                    <td className="px-6 py-4">
                                                        <SheetSubtaskPills 
                                                            subTasks={sheetSubtasks} 
                                                            expandedFilter={isExpanded ? expandedFilter : null}
                                                            onPillClick={(filter) => handlePillClick(sheet.id, filter)}
                                                        />
                                                    </td>
                                                </tr>
 
                                                {/* Expanded Subtask Details */}
                                                {isExpanded && (
                                                    <tr className="bg-gray-50/50">
                                                        <td colSpan={6} className="p-0 border-t border-b border-gray-150">
                                                            <div className="px-8 py-5 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                                        Detailed Subtasks ({expandedFilter} status):
                                                                    </h4>
                                                                    <span className="text-xs font-semibold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md">
                                                                        {filteredSubtasks.length} subtasks
                                                                    </span>
                                                                </div>
 
                                                                {filteredSubtasks.length === 0 ? (
                                                                    <div className="text-xs text-gray-400 py-3 text-center bg-white rounded-xl border border-gray-100">
                                                                        No subtasks match this status filter.
                                                                    </div>
                                                                ) : (
                                                                    <div className="overflow-hidden bg-white border border-gray-100 rounded-xl shadow-sm">
                                                                        <table className="w-full text-xs">
                                                                            <thead>
                                                                                <tr className="bg-[#1F5C99] text-white font-bold uppercase text-[10px] tracking-wider border-b border-[#154673]">
                                                                                    <th className="px-4 py-2.5 text-left min-w-[200px]">Subtask Title</th>
                                                                                    <th className="px-4 py-2.5 text-left">Assigned To</th>
                                                                                    <th className="px-4 py-2.5 text-left">Priority</th>
                                                                                    <th className="px-4 py-2.5 text-left">Due Date</th>
                                                                                    <th className="px-4 py-2.5 text-left">Status</th>
                                                                                    <th className="px-4 py-2.5 text-left">Sub Status</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-gray-50 bg-white">
                                                                                {filteredSubtasks.map(st => (
                                                                                    <tr key={st.id} className="hover:bg-gray-50/50 transition">
                                                                                        {/* Read-only Subtask Title */}
                                                                                        <td className="px-4 py-3 font-semibold text-gray-700">{st.title}</td>
                                                                                        {/* Read-only Assignee */}
                                                                                        <td className="px-4 py-3 text-gray-600">{st.assigned_to?.name || 'Unassigned'}</td>
                                                                                        {/* Read-only Priority Badge */}
                                                                                        <td className="px-4 py-3">
                                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border
                                                                                                ${st.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' : 
                                                                                                  st.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                                                                                  'bg-green-50 text-green-700 border-green-100'}
                                                                                            `}>
                                                                                                {st.priority_label}
                                                                                            </span>
                                                                                        </td>
                                                                                        {/* Read-only Due Date */}
                                                                                        <td className="px-4 py-3 text-gray-500">{formatDate(st.due_date)}</td>
                                                                                        {/* Interactive Status Edit on Click */}
                                                                                        <td className="px-4 py-3">
                                                                                            {editingSubTaskId === st.id ? (
                                                                                                <select
                                                                                                    value={st.status}
                                                                                                    autoFocus
                                                                                                    onBlur={() => setEditingSubTaskId(null)}
                                                                                                    onChange={async (e) => {
                                                                                                        const newStatus = e.target.value
                                                                                                        await handleUpdateSubTask(sheet.id, st.id, { status: newStatus })
                                                                                                        setEditingSubTaskId(null)
                                                                                                    }}
                                                                                                    className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700"
                                                                                                >
                                                                                                    <option value="complete">Complete</option>
                                                                                                    <option value="work_in_progress">Work In Progress</option>
                                                                                                    <option value="pending">Pending</option>
                                                                                                    <option value="not_to_be_done">Not To Be Done</option>
                                                                                                    <option value="other">Other</option>
                                                                                                </select>
                                                                                            ) : (
                                                                                                <div 
                                                                                                    onClick={() => setEditingSubTaskId(st.id)}
                                                                                                    className="cursor-pointer hover:opacity-80 transition inline-block animate-fade-in"
                                                                                                >
                                                                                                    <StatusBadge status={st.status} />
                                                                                                </div>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-4 py-3">
                                                                                            <SubStatusPicker
                                                                                                value={st.sub_status}
                                                                                                onChange={(newVal) => handleUpdateSubTask(sheet.id, st.id, { sub_status: newVal })}
                                                                                                options={getSubStatusOptions(sheet)}
                                                                                            />
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    {sheetsMeta && sheetsMeta.last_page > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
                            <p className="text-xs text-gray-400">
                                Showing {sheetsMeta.from}–{sheetsMeta.to} of {sheetsMeta.total} sheets
                            </p>
                            <div className="flex gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                                >Previous</button>
                                <button
                                    disabled={page === sheetsMeta.last_page}
                                    onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                                >Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function CalendarView() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(false)
    const [rangeStart, setRangeStart] = useState(null)
    const [rangeEnd, setRangeEnd] = useState(null)

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const month = currentDate.getMonth() + 1
            const year = currentDate.getFullYear()
            const prefix = user?.role === 'staff' ? '/staff' : '/ca'
            const res = await api.get(`${prefix}/dashboard/calendar-tasks`, {
                params: { month, year }
            })
            setTasks(res.data.data || [])
        } finally {
            setLoading(false)
        }
    }, [currentDate, user])

    useEffect(() => {
        fetchTasks()
        setRangeStart(null)
        setRangeEnd(null)
    }, [fetchTasks])

    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

    const days = []
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i))
    }

    const getLocalDateString = (d) => {
        if (!d) return ''
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    const handleUpdateSubTask = async (taskId, subTaskId, updatedData) => {
        try {
            const isStaff = user?.role === 'staff'
            const url = isStaff ? `/staff/sub-tasks/${subTaskId}/status` : `/ca/tasks/${taskId}/sub-tasks/${subTaskId}`
            const res = await api.patch(url, updatedData)
            const updatedSubTask = res.data.data
            
            // Update the subtask locally inside calendar tasks state
            setTasks(prevTasks => prevTasks.map(t => {
                if (t.id !== taskId) return t
                
                const updatedSubTasks = t.sub_tasks?.map(st => {
                    if (st.id !== subTaskId) return st
                    return { ...st, ...updatedSubTask }
                }) || []
                
                return {
                    ...t,
                    sub_tasks: updatedSubTasks
                }
            }))
            
            toast.success('Subtask updated successfully')
        } catch (e) {
            toast.error('Failed to update subtask')
        }
    }

    const handleDateClick = (date) => {
        if (!date) return
        
        if (!rangeStart || (rangeStart && rangeEnd)) {
            setRangeStart(date)
            setRangeEnd(null)
        } else {
            const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
            const clickedTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
            
            if (clickedTime < startTime) {
                setRangeStart(date)
                setRangeEnd(null)
            } else {
                setRangeEnd(date)
            }
        }
    }

    const getTasksForDate = (date) => {
        if (!date) return []
        const dateStr = getLocalDateString(date)
        return tasks.filter(t => 
            (t.due_date === dateStr && t.status !== 'complete') || 
            t.sub_tasks?.some(st => st.due_date === dateStr && st.status !== 'complete')
        )
    }

    const getTasksForDateRange = (start, end) => {
        if (!start) return []
        
        if (!end) {
            const startStr = getLocalDateString(start)
            return tasks.filter(t => 
                (t.due_date === startStr && t.status !== 'complete') || 
                t.sub_tasks?.some(st => st.due_date === startStr && st.status !== 'complete')
            )
        }

        const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
        const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()

        return tasks.filter(t => {
            const tDate = parseLocalDate(t.due_date)
            const tTime = tDate ? tDate.getTime() : null
            
            const hasDueSheetInRange = tTime && tTime >= startTime && tTime <= endTime && t.status !== 'complete'
            const hasDueSubTaskInRange = t.sub_tasks?.some(st => {
                const stDate = parseLocalDate(st.due_date)
                const stTime = stDate ? stDate.getTime() : null
                return stTime && stTime >= startTime && stTime <= endTime && st.status !== 'complete'
            })

            return hasDueSheetInRange || hasDueSubTaskInRange
        })
    }

    const selectedTasks = rangeStart ? getTasksForDateRange(rangeStart, rangeEnd) : []

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-fade-in">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-800">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition">
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition">
                            <ChevronRight size={20} className="text-gray-600" />
                        </button>
                    </div>
                </div>

                {loading ? <Spinner /> : (
                    <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="bg-gray-50 py-2 text-center text-xs font-semibold text-gray-500">
                                {day}
                            </div>
                        ))}
                        {days.map((date, i) => {
                            const dateTasks = getTasksForDate(date)
                            const isToday = date && date.toDateString() === new Date().toDateString()
                            
                            let isStart = false
                            let isEnd = false
                            let isInRange = false
                            
                            if (date && rangeStart) {
                                const dateTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
                                const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                                
                                if (rangeEnd) {
                                    const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime()
                                    isStart = dateTime === startTime
                                    isEnd = dateTime === endTime
                                    isInRange = dateTime > startTime && dateTime < endTime
                                } else {
                                    isStart = dateTime === startTime
                                }
                            }

                            return (
                                <div 
                                    key={i} 
                                    onClick={() => date && handleDateClick(date)}
                                    className={`min-h-[100px] p-2 transition-all relative cursor-pointer border-b border-r border-gray-100
                                        ${!date ? 'bg-gray-50/30 opacity-40' : 
                                          isStart || isEnd ? 'bg-blue-50 ring-2 ring-blue-500 z-10 font-bold' : 
                                          isInRange ? 'bg-blue-50/60 hover:bg-blue-100/50' : 'bg-white hover:bg-blue-50/40'}
                                    `}
                                >
                                    {date && (
                                        <>
                                            <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-all
                                                ${isStart || isEnd ? 'bg-blue-600 text-white shadow' : 
                                                  isToday ? 'bg-gray-200 text-gray-800' : 'text-gray-700'}
                                            `}>
                                                {date.getDate()}
                                            </span>
                                            {dateTasks.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 rounded-md">
                                                        {dateTasks.length} Due
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {rangeStart && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-800">
                                {rangeEnd ? (
                                    `Tasks Due from ${formatDate(rangeStart)} to ${formatDate(rangeEnd)}`
                                ) : (
                                    `Tasks Due on ${formatDate(rangeStart)}`
                                )}
                            </h3>
                            {(rangeStart || rangeEnd) && (
                                <button
                                    onClick={() => {
                                        setRangeStart(null)
                                        setRangeEnd(null)
                                    }}
                                    className="text-xs text-red-500 hover:text-red-750 font-semibold hover:underline transition"
                                >
                                    Clear Selection
                                </button>
                            )}
                        </div>
                        <span className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                            {selectedTasks.length} Tasks
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                    <th className="px-6 py-3.5 text-left">Client</th>
                                    <th className="px-6 py-3.5 text-left">Sheet/Task Form</th>
                                    <th className="px-6 py-3.5 text-left">Work Type</th>
                                    <th className="px-6 py-3.5 text-left">Allocated To</th>
                                    <th className="px-6 py-3.5 text-left">Due Date</th>
                                    <th className="px-6 py-3.5 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 bg-white">
                                {selectedTasks.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No tasks due within selected range.</td></tr>
                                ) : selectedTasks.map(t => {
                                    const sheetDue = (() => {
                                        if (!t.due_date || t.status === 'complete') return false
                                        const tDate = parseLocalDate(t.due_date)
                                        const tTime = tDate ? tDate.getTime() : null
                                        if (!rangeEnd) {
                                            return tTime === new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                                        }
                                        const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                                        const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime()
                                        return tTime >= startTime && tTime <= endTime
                                    })()

                                    const dueSubTasks = t.sub_tasks?.filter(st => {
                                        if (!st.due_date || st.status === 'complete') return false
                                        const stDate = parseLocalDate(st.due_date)
                                        const stTime = stDate ? stDate.getTime() : null
                                        if (!rangeEnd) {
                                            return stTime === new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                                        }
                                        const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                                        const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime()
                                        return stTime >= startTime && stTime <= endTime
                                    }) || []

                                    return (
                                        <>
                                            <tr key={t.id} className="hover:bg-gray-50/50 transition">
                                                <td className="px-6 py-4 font-semibold text-gray-800">{t.client?.name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-700">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{t.form_name || '—'}</span>
                                                        <button 
                                                            onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    navigate(`/ca/tasks/${t.id}`)
                                                            }}
                                                            className="text-gray-450 hover:text-blue-600 transition p-1 hover:bg-blue-50 rounded"
                                                            title="View Details"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        {sheetDue && (
                                                            <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-100 uppercase tracking-wider shrink-0">
                                                                Sheet Due
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">{t.work_type?.name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-600">{t.allocated_to?.name ?? 'Unassigned'}</td>
                                                 <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(t.due_date)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <StatusBadge status={t.status} />
                                                        {dueSubTasks.length > 0 && (
                                                            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-bold border border-green-100 uppercase tracking-wider">
                                                                {dueSubTasks.length} Subtasks Due
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Specific Subtasks Due on this selected date */}
                                            {dueSubTasks.length > 0 && (
                                                <tr className="bg-gray-50/50">
                                                    <td colSpan={6} className="px-10 py-3 border-t border-b border-gray-100">
                                                        <div className="space-y-2">
                                                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                Due Subtasks:
                                                            </h4>
                                                            <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
                                                                <table className="w-full text-xs">
                                                                    <thead>
                                                                        <tr className="text-[10px] font-bold text-white uppercase tracking-wider bg-[#1F5C99] border-b border-[#154673]">
                                                                            <th className="px-4 py-2.5 text-left">Subtask</th>
                                                                            <th className="px-4 py-2.5 text-left">Assignee</th>
                                                                            <th className="px-4 py-2.5 text-left">Priority</th>
                                                                            <th className="px-4 py-2.5 text-left">Due Date</th>
                                                                            <th className="px-4 py-2.5 text-left">Status (Click to update)</th>
                                                                            <th className="px-4 py-2.5 text-left">Sub Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-50 bg-white">
                                                                        {dueSubTasks.map(st => (
                                                                            <tr key={st.id} className="hover:bg-gray-50/50 transition">
                                                                                <td className="px-4 py-2 text-gray-700 font-medium">{st.title}</td>
                                                                                <td className="px-4 py-2 text-gray-600">{st.assigned_to?.name || 'Unassigned'}</td>
                                                                                <td className="px-4 py-2">
                                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border
                                                                                        ${st.priority === 'high' ? 'bg-red-50 text-red-700 border-red-100' : 
                                                                                          st.priority === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 
                                                                                          'bg-green-50 text-green-700 border-green-100'}
                                                                                    `}>
                                                                                        {st.priority_label}
                                                                                    </span>
                                                                                </td>
                                                                                <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatDate(st.due_date)}</td>
                                                                                <td className="px-4 py-2">
                                                                                    <select
                                                                                        value={st.status}
                                                                                        onChange={e => handleUpdateSubTask(t.id, st.id, { status: e.target.value })}
                                                                                        className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-700 cursor-pointer"
                                                                                    >
                                                                                        <option value="complete">Complete</option>
                                                                                        <option value="work_in_progress">Work In Progress</option>
                                                                                        <option value="pending">Pending</option>
                                                                                        <option value="not_to_be_done">Not To Be Done</option>
                                                                                        <option value="other">Other</option>
                                                                                    </select>
                                                                                </td>
                                                                                <td className="px-4 py-2">
                                                                                    <SubStatusPicker
                                                                                        value={st.sub_status}
                                                                                        onChange={(newVal) => handleUpdateSubTask(t.id, st.id, { sub_status: newVal })}
                                                                                        options={getSubStatusOptions(t)}
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function DashboardPage() {
    const { user } = useAuth()
    const isStaff = user?.role === 'staff'
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'calendar'

    const [summary, setSummary] = useState(null)
    const [staffData, setStaffData] = useState([])
    const [tasks, setTasks] = useState([])
    const [tasksMeta, setTasksMeta] = useState(null)
    const [workTypes, setWorkTypes] = useState([])
    const [loading, setLoading] = useState(true)
    const [taskLoading, setTaskLoading] = useState(false)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)

    const fetchSummary = async () => {
        if (isStaff) {
            const s = await api.get('/staff/dashboard/summary')
            setSummary(s.data)
            setStaffData([])
            setWorkTypes(s.data.work_types || [])
        } else {
            const [s, st, wt] = await Promise.all([
                api.get('/ca/dashboard/summary'),
                api.get('/ca/dashboard/staff-summary'),
                api.get('/ca/work-types'),
            ])
            setSummary(s.data)
            setStaffData(st.data.data)
            setWorkTypes(wt.data.data || [])
        }
    }

    const fetchTasks = useCallback(async () => {
        setTaskLoading(true)
        const prefix = isStaff ? '/staff' : '/ca'
        try {
            const res = await api.get(`${prefix}/dashboard/tasks`, {
                params: { search, status, page, per_page: 10 }
            })
            setTasks(res.data.data)
            setTasksMeta(res.data.meta)
        } finally {
            setTaskLoading(false)
        }
    }, [search, status, page, isStaff])

    useEffect(() => {
        fetchSummary().finally(() => setLoading(false))
    }, [])

    useEffect(() => { 
        if (activeTab === 'overview') {
            fetchTasks() 
        }
    }, [fetchTasks, activeTab])

    if (loading) return <Spinner />

    const cards = [
        { 
            icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', 
            label: 'Total Tasks', value: summary?.total_tasks ?? 0, 
            sub: 'All time records',
            active: status === '',
            onClick: () => { setStatus(''); setPage(1); }
        },
        { 
            icon: CircleDashed, iconBg: 'bg-yellow-50', iconColor: 'text-yellow-500', 
            label: 'Pending', value: summary?.pending_tasks ?? 0, 
            sub: 'Waiting to start',
            active: status === 'pending',
            onClick: () => { setStatus('pending'); setPage(1); }
        },
        { 
            icon: Clock, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', 
            label: 'Work In Progress', value: summary?.work_in_progress_tasks ?? 0, 
            sub: 'Currently active',
            active: status === 'work_in_progress',
            onClick: () => { setStatus('work_in_progress'); setPage(1); }
        },
        { 
            icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-500', 
            label: 'Completed', value: summary?.completed_tasks ?? 0, 
            sub: 'Finalized tasks',
            active: status === 'complete',
            onClick: () => { setStatus('complete'); setPage(1); }
        },
        { 
            icon: Circle, iconBg: 'bg-red-50', iconColor: 'text-red-500', 
            label: 'Not To Be Done', value: summary?.not_to_be_done_tasks ?? 0, 
            sub: 'Excluded tasks',
            active: status === 'not_to_be_done',
            onClick: () => { setStatus('not_to_be_done'); setPage(1); }
        },
        { 
            icon: SlidersHorizontal, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', 
            label: 'Other', value: summary?.other_tasks ?? 0, 
            sub: 'Other status',
            active: status === 'other',
            onClick: () => { setStatus('other'); setPage(1); }
        },
    ]

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight animate-fade-in">Dashboard</h1>
                
                {/* Tabs */}
                <div className="flex p-1.5 bg-slate-50 border border-[#1F5C99]/30 rounded-2xl w-full md:w-auto shadow-sm shadow-[#1F5C99]/5 gap-1 animate-fade-in">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'overview' 
                            ? 'bg-[#1F5C99] text-white shadow-sm' 
                            : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                        }`}
                    >
                        <LayoutDashboard size={15} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                            activeTab === 'calendar' 
                            ? 'bg-[#1F5C99] text-white shadow-sm' 
                            : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                        }`}
                    >
                        <CalendarDays size={15} /> Calendar View
                    </button>
                    {!isStaff && (
                        <button
                            onClick={() => setActiveTab('summary')}
                            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                activeTab === 'summary' 
                                ? 'bg-[#1F5C99] text-white shadow-sm' 
                                : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                            }`}
                        >
                            <Activity size={15} /> Summary
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'overview' ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
                    </div>

                    {/* All Tasks */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">All Tasks</h2>
                            <div className="flex flex-wrap items-center gap-3">
                                {/* Search */}
                                <div className="relative flex-1 sm:flex-none">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search tasks..."
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                                        className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full sm:w-56 transition"
                                    />
                                </div>
                                {/* Status filter */}
                                <CustomSelect
                                    value={status}
                                    onChange={e => { setStatus(e.target.value); setPage(1) }}
                                    options={statuses}
                                    widthClass="w-full sm:w-auto min-w-[125px]"
                                    className="flex-1 sm:flex-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {taskLoading ? <Spinner /> : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                            {['#', 'Client', 'Nature', 'Allocated To', 'Inward', 'Allocated', 'Completed', 'Status'].map(h => (
                                                <th key={h} className="px-6 py-3.5 text-left">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {tasks?.length === 0 ? (
                                            <tr><td colSpan={8} className="text-center py-12 text-gray-400">No tasks found</td></tr>
                                        ) : tasks?.map((t, i) => (
                                            <tr key={t.id} className="hover:bg-gray-100 transition" onClick={() => navigate(isStaff ? `/staff/tasks` : `/ca/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>
                                                <td className="px-6 py-4 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                                <td className="px-6 py-4 font-semibold text-gray-800">{t.client?.name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-600">{t.work_type?.name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-600">{t.allocated_to?.name ?? 'Unassigned'}</td>
                                                <td className="px-6 py-4 text-gray-500">{formatDate(t.date_inward)}</td>
                                                <td className="px-6 py-4 text-gray-500">{formatDate(t.date_allocated)}</td>
                                                <td className="px-6 py-4 text-gray-500">{formatDate(t.date_completed)}</td>
                                                <td className="px-6 py-4"><StatusBadge status={t.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {tasksMeta && tasksMeta.last_page > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                                <p className="text-xs text-slate-500 font-semibold">
                                    Showing {tasksMeta.from}–{tasksMeta.to} of {tasksMeta.total} tasks
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                                    >Previous</button>
                                    <button
                                        disabled={page === tasksMeta.last_page}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
                                    >Next</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white shadow-lg">
                                <LayoutGrid size={20} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Quick Links</h2>
                                <p className="text-sm text-slate-500 font-semibold">Access all services at your fingertips</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                            {workTypes.map((wt, i) => {
                                const colors = [
                                    { bg: 'bg-blue-50', text: 'text-blue-500' },
                                    { bg: 'bg-orange-50', text: 'text-orange-500' },
                                    { bg: 'bg-emerald-50', text: 'text-emerald-500' },
                                    { bg: 'bg-sky-50', text: 'text-sky-500' },
                                    { bg: 'bg-teal-50', text: 'text-teal-500' },
                                    { bg: 'bg-red-50', text: 'text-red-500' },
                                    { bg: 'bg-indigo-50', text: 'text-indigo-500' },
                                    { bg: 'bg-purple-50', text: 'text-purple-500' },
                                    { bg: 'bg-pink-50', text: 'text-pink-500' },
                                ];
                                const color = colors[i % colors.length];

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
                                const colorClasses = borderClasses[color.text] || 'border-slate-200 hover:border-[#1F5C99]';

                                return (
                                    <div
                                        key={wt.id}
                                        onClick={() => navigate(isStaff ? `/staff/tasks?work_type_id=${wt.id}` : `/ca/tasks?work_type_id=${wt.id}`)}
                                        className={`group cursor-pointer p-5 bg-white rounded-2xl border ${colorClasses} shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-center gap-4 text-center select-none`}
                                    >
                                        <div className={`w-16 h-16 rounded-2xl ${color.bg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                                            <Folder size={32} className={color.text} fill="currentColor" fillOpacity={0.2} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm leading-tight group-hover:text-[#1F5C99] transition-colors">
                                                {wt.name}
                                            </h3>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Staff-wise Summary */}
                    {!isStaff && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <h2 className="text-lg font-semibold text-gray-800">Staff-wise Summary</h2>
                                <SlidersHorizontal size={18} className="text-gray-400" />
                            </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                            {['Staff Name', 'Pending', 'Work In Progress', 'Complete', 'Not To Be Done', 'Other', 'Total'].map(h => (
                                                <th key={h} className="px-6 py-3.5 text-left">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {staffData.map(s => (
                                            <tr
                                                key={s.id}
                                                onClick={() => navigate(`/ca/tasks?staff_id=${s.id}`)}
                                                className="hover:bg-gray-100 cursor-pointer transition"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar name={s.name} />
                                                        <div>
                                                            <p className="font-semibold text-gray-800">{s.name}</p>
                                                            <p className="text-xs text-slate-500 font-semibold">Staff Member</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                {[s.pending, s.work_in_progress, s.complete, s.not_to_be_done, s.other].map((v, i) => (
                                                    <td key={i} className="px-6 py-4 text-gray-600 font-medium">
                                                        {String(v ?? 0).padStart(2, '0')}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 font-bold text-gray-800">
                                                    {String(s.total).padStart(2, '0')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : activeTab === 'calendar' ? (
                <CalendarView />
            ) : (
                <WorkTypeSubtaskSummary workTypes={workTypes} staff={staffData} />
            )}
        </div>
    )
}