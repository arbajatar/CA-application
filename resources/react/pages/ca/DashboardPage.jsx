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
import TaskDetailPage from './TaskDetailPage'


const DEFAULT_SUB_STATUSES = [
    'Documentation pending',
    'Awaiting approval',
    'Completed'
];

const getSubStatusOptions = (task) => {
    if (!task || !task.dynamic_fields) return DEFAULT_SUB_STATUSES;
    let fields = task.dynamic_fields;
    if (typeof fields === 'string') {
        try { fields = JSON.parse(fields); } catch (e) { }
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
    const { user } = useAuth()
    const isStaff = user?.role === 'staff'
    const navigate = useNavigate()
    const [allSheets, setAllSheets] = useState([])
    const [selectedSheetId, setSelectedSheetId] = useState('')
    const [sheets, setSheets] = useState([])
    const [globalSummary, setGlobalSummary] = useState(null)
    const [loading, setLoading] = useState(false)
    const [editingSubTaskId, setEditingSubTaskId] = useState(null)

    // Filters and states
    const [globalFilter, setGlobalFilter] = useState('') // '' | 'completed' | 'in_progress' | 'remaining'
    const [expandedTaskId, setExpandedTaskId] = useState(null)
    const [expandedFilter, setExpandedFilter] = useState('') // 'all' | 'completed' | 'in_progress' | 'remaining'

    useEffect(() => {
        const fetchAllSheetsList = async () => {
            try {
                const url = isStaff ? '/staff/tasks' : '/ca/tasks'
                const res = await api.get(url, { params: { per_page: 'all' } })
                setAllSheets(res.data.data || [])
            } catch (e) {
                console.error('Failed to fetch all sheets', e)
            }
        }
        fetchAllSheetsList()
    }, [isStaff])

    const fetchSingleSheetDetails = useCallback(async (sheetId) => {
        if (!sheetId) {
            setSheets([])
            setGlobalSummary(null)
            setExpandedTaskId(null)
            setExpandedFilter('')
            return
        }
        setLoading(true)
        try {
            const url = isStaff ? `/staff/tasks/${sheetId}` : `/ca/tasks/${sheetId}`
            const res = await api.get(url)
            const task = res.data.data
            setSheets([task])
            
            // Auto expand the loaded sheet
            setExpandedTaskId(task.id)
            setExpandedFilter('all')

            // Calculate global task summary from tasks (subtasks)
            const subTasks = task.sub_tasks || []
            setGlobalSummary({
                total: subTasks.length,
                pending: subTasks.filter(st => st.status === 'pending').length,
                work_in_progress: subTasks.filter(st => st.status === 'work_in_progress').length,
                complete: subTasks.filter(st => st.status === 'complete').length,
                not_to_be_done: subTasks.filter(st => st.status === 'not_to_be_done').length,
                other: subTasks.filter(st => st.status === 'other').length,
            })
        } catch (e) {
            toast.error('Failed to fetch sheet details')
        } finally {
            setLoading(false)
        }
    }, [isStaff])

    const exportSummarySheet = async () => {
        try {
            const ExcelJS = await import('exceljs')
            if (sheets.length === 0) {
                toast.error('No sheet details to export')
                return
            }
            const sheet = sheets[0]

            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Sheet Tasks')

            worksheet.mergeCells('A1:F1')
            const titleCell = worksheet.getCell('A1')
            titleCell.value = `Sheet Tasks Report: ${sheet.client?.name || '—'} - ${sheet.form_name || '—'}`
            titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.mergeCells('A2:F2')
            const dateCell = worksheet.getCell('A2')
            dateCell.value = `Generated at: ${new Date().toLocaleString()}`
            dateCell.font = { italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            worksheet.addRow([])
            worksheet.addRow(['Client Name:', sheet.client?.name || '—', 'Form Name:', sheet.form_name || '—'])
            worksheet.addRow(['Allocated To:', sheet.allocated_to?.name || 'Unassigned', 'Due Date:', formatDate(sheet.due_date)])
            
            const styleMetaCell = (cell) => {
                cell.font = { bold: true, size: 10, color: { argb: 'FF333333' } }
            }
            styleMetaCell(worksheet.getCell('A4'))
            styleMetaCell(worksheet.getCell('C4'))
            styleMetaCell(worksheet.getCell('A5'))
            styleMetaCell(worksheet.getCell('C5'))

            worksheet.addRow([])

            const headers = ['Task Title', 'Assigned To', 'Priority', 'Due Date', 'Status', 'Sub Status']
            worksheet.getRow(7).values = headers
            const headerRow = worksheet.getRow(7)
            headerRow.height = 25
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })

            const subTasks = sheet.sub_tasks || []
            subTasks.forEach((st) => {
                worksheet.addRow([
                    st.title,
                    st.assigned_to?.name || 'Unassigned',
                    st.priority_label || st.priority,
                    formatDate(st.due_date),
                    st.status,
                    st.sub_status || '—'
                ])
            })

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 7) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                        cell.alignment = { vertical: 'middle' }
                    })
                }
            })

            worksheet.columns.forEach(column => {
                let maxLength = 0
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10
                    if (columnLength > maxLength) {
                        maxLength = columnLength
                    }
                })
                column.width = maxLength < 12 ? 12 : maxLength + 2
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `sheet_${sheet.id}_tasks_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Sheet details exported successfully')
        } catch (err) {
            console.error('Export Error:', err)
            toast.error('Failed to export sheet details')
        }
    }

    const handleGlobalFilterClick = (filterType) => {
        setGlobalFilter(prev => prev === filterType ? '' : filterType)
        setExpandedTaskId(sheets[0]?.id || null)
        setExpandedFilter(sheets[0]?.id ? (filterType === '' ? 'all' : filterType) : '')
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
            const url = isStaff ? `/staff/sub-tasks/${subTaskId}/status` : `/ca/tasks/${taskId}/sub-tasks/${subTaskId}`
            const res = await api.patch(url, updatedData)
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

            toast.success('Task updated successfully')
        } catch (e) {
            toast.error('Failed to update task')
        }
    }

    // Filter sheets below based on the selected top global card filter
    const displayedSheets = sheets.filter(sheet => {
        if (!globalFilter) return true
        const subtasks = sheet.sub_tasks || []
        return subtasks.some(st => st.status === globalFilter)
    })

    return (
        <div className="space-y-6">
            {/* Title / Sheet Dropdown */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0f1c2e] flex items-center justify-center text-white shadow-lg">
                    <Activity size={20} />
                </div>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Sheet-wise Task Summary</h2>
                        <p className="text-sm text-gray-400">View tasks and click on task counts to view detailed task sheets</p>
                    </div>
                    <CustomSelect
                        value={selectedSheetId}
                        onChange={e => {
                            const val = e.target.value
                            setSelectedSheetId(val)
                            fetchSingleSheetDetails(val)
                        }}
                        options={[
                            { value: '', label: 'Select Sheet' },
                            ...allSheets.map(sheet => ({
                                value: sheet.id,
                                label: sheet.form_name || `Sheet #${sheet.id}`
                            }))
                        ]}
                        widthClass="w-full sm:w-80"
                        className="animate-fade-in"
                    />
                </div>
            </div>

            {/* Placeholder if no sheet selected */}
            {!selectedSheetId && (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm animate-fade-in">
                    <p className="text-gray-400 font-medium">Please select a sheet from the dropdown to view its task summary.</p>
                </div>
            )}

            {selectedSheetId && (
                <div className="animate-fade-in">
                    <TaskDetailPage id={selectedSheetId} hideBackHeader={false} />
                </div>
            )}
        </div>
    )
}

function CalendarView({ staffData = [] }) {
    const { user } = useAuth()
    const isStaff = user?.role === 'staff'
    const navigate = useNavigate()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [tasks, setTasks] = useState([])
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(false)
    const [rangeStart, setRangeStart] = useState(null)
    const [rangeEnd, setRangeEnd] = useState(null)
    const [quickFilter, setQuickFilter] = useState('')

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const prefix = user?.role === 'staff' ? '/daily-reports' : '/ca'
                const res = await api.get(`${prefix}/clients`, { params: { per_page: 10000 } })
                setClients(res.data.data || [])
            } catch (e) {
                console.error(e)
            }
        }
        fetchClients()
    }, [user])

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
    }, [fetchTasks])

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }
    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

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
        setQuickFilter('')

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

    const parseToComparisonDateStr = (dateStr) => {
        if (!dateStr) return null;
        // support DD-MM-YYYY or YYYY-MM-DD
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                // DD-MM-YYYY -> YYYY-MM-DD
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return dateStr;
    }

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null
        const normalized = parseToComparisonDateStr(dateStr);
        if (!normalized) return null;
        const [year, month, day] = normalized.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    const getTasksForDate = (date) => {
        if (!date) return []
        const dateStr = getLocalDateString(date)
        return tasks.filter(t =>
            (parseToComparisonDateStr(t.due_date) === dateStr && t.status !== 'complete') ||
            t.sub_tasks?.some(st => parseToComparisonDateStr(st.due_date) === dateStr && st.status !== 'complete') ||
            (t.dynamic_fields?.multi_rows && Array.isArray(t.dynamic_fields.multi_rows) &&
             t.dynamic_fields.multi_rows.some(row => {
                 if (!row || row.status === 'complete') return false;
                 const dVal = row.due_date || row.dynamic_data?.['Due Date'] || row.dynamic_data?.due_date;
                 return parseToComparisonDateStr(dVal) === dateStr;
             }))
        )
    }

    const getTasksForDateRange = (start, end) => {
        if (!start) return []

        if (!end) {
            const startStr = getLocalDateString(start)
            return tasks.filter(t =>
                (parseToComparisonDateStr(t.due_date) === startStr && t.status !== 'complete') ||
                t.sub_tasks?.some(st => parseToComparisonDateStr(st.due_date) === startStr && st.status !== 'complete') ||
                (t.dynamic_fields?.multi_rows && Array.isArray(t.dynamic_fields.multi_rows) &&
                 t.dynamic_fields.multi_rows.some(row => {
                     if (!row || row.status === 'complete') return false;
                     const dVal = row.due_date || row.dynamic_data?.['Due Date'] || row.dynamic_data?.due_date;
                     return parseToComparisonDateStr(dVal) === startStr;
                 }))
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
            const hasDueDynamicRowInRange = t.dynamic_fields?.multi_rows && Array.isArray(t.dynamic_fields.multi_rows) &&
                t.dynamic_fields.multi_rows.some(row => {
                    if (!row || row.status === 'complete') return false
                    const dVal = row.due_date || row.dynamic_data?.['Due Date'] || row.dynamic_data?.due_date;
                    if (!dVal) return false
                    const rowDate = parseLocalDate(dVal)
                    const rowTime = rowDate ? rowDate.getTime() : null
                    return rowTime && rowTime >= startTime && rowTime <= endTime
                })

            return hasDueSheetInRange || hasDueSubTaskInRange || hasDueDynamicRowInRange
        })
    }

    const selectedTasks = rangeStart ? getTasksForDateRange(rangeStart, rangeEnd) : []

    const getFlatDueRows = () => {
        const flat = []
        selectedTasks.forEach(t => {
            // Check if the parent task/sheet itself is due
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

            if (sheetDue) {
                flat.push({
                    type: 'task',
                    id: t.id,
                    clientName: t.client?.name || '—',
                    formName: t.form_name || '—',
                    workTypeName: t.work_type?.name || '—',
                    allocatedToName: t.allocated_to?.name ?? 'Unassigned',
                    dueDate: t.due_date,
                    status: t.status_label || t.status,
                    task: t
                })
            }

            // Check if any dynamic rows are due
            const dueDynamicRows = t.dynamic_fields?.multi_rows?.filter(row => {
                if (!row || row.status === 'complete') return false
                const dVal = row.due_date || row.dynamic_data?.['Due Date'] || row.dynamic_data?.due_date;
                if (!dVal) return false
                const rowDate = parseLocalDate(dVal)
                const rowTime = rowDate ? rowDate.getTime() : null
                if (!rangeEnd) {
                    return rowTime === new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                }
                const startTime = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate()).getTime()
                const endTime = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate()).getTime()
                return rowTime >= startTime && rowTime <= endTime
            }) || []

            dueDynamicRows.forEach(row => {
                const dVal = row.due_date || row.dynamic_data?.['Due Date'] || row.dynamic_data?.due_date;
                const clientName = clients.find(c => String(c.id) === String(row.client_id))?.name || t.client?.name || '—';
                const assigneeName = (() => {
                    const type = row.allocated_type || 'user'
                    const to = row.allocated_to
                    if (type === 'user' && to) {
                        const found = staffData.find(s => String(s.id) === String(to))
                        return found ? found.name : 'Staff #' + to
                    }
                    if (type === 'users' && Array.isArray(to)) {
                        return to.map(uid => {
                            const found = staffData.find(s => String(s.id) === String(uid))
                            return found ? found.name : 'Staff #' + uid
                        }).join(', ')
                    }
                    return 'Unassigned'
                })()

                flat.push({
                    type: 'dynamic_row',
                    id: t.id,
                    clientName: clientName,
                    formName: row.form_name || t.form_name || '—',
                    workTypeName: t.work_type?.name || '—',
                    allocatedToName: assigneeName,
                    dueDate: dVal,
                    status: row.status,
                    task: t,
                    row: row
                })
            })
        })
        return flat
    }

    const flatDueRows = getFlatDueRows()

    const exportCalendarTasks = async () => {
        try {
            const ExcelJS = await import('exceljs')
            if (flatDueRows.length === 0) {
                toast.error('No tasks found to export')
                return
            }

            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Calendar Tasks')

            worksheet.mergeCells('A1:F1')
            const titleCell = worksheet.getCell('A1')
            titleCell.value = rangeEnd 
                ? `Due Tasks (${formatDate(rangeStart)} to ${formatDate(rangeEnd)})`
                : `Due Tasks (${formatDate(rangeStart)})`
            titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.mergeCells('A2:F2')
            const dateCell = worksheet.getCell('A2')
            dateCell.value = `Generated at: ${new Date().toLocaleString()}`
            dateCell.font = { italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            const headers = ['Client', 'Sheet/Task Form', 'Work Type', 'Allocated To', 'Due Date', 'Status']
            worksheet.getRow(4).values = headers
            const headerRow = worksheet.getRow(4)
            headerRow.height = 25
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })

            flatDueRows.forEach((item) => {
                worksheet.addRow([
                    item.clientName,
                    item.formName,
                    item.workTypeName,
                    item.allocatedToName,
                    formatDate(item.dueDate),
                    item.status
                ])
            })

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 4) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                        cell.alignment = { vertical: 'middle', wrapText: true }
                    })
                }
            })

            worksheet.columns.forEach(column => {
                let maxLength = 0
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10
                    if (columnLength > maxLength) {
                        maxLength = columnLength
                    }
                })
                column.width = maxLength < 10 ? 10 : (maxLength > 60 ? 60 : maxLength + 2)
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `calendar_tasks_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Calendar tasks exported successfully')
        } catch (err) {
            console.error('Export Error:', err)
            toast.error('Failed to export tasks')
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-150 p-6 animate-fade-in">
                {/* Header section with Month navigation */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-gradient-to-r from-slate-55 via-slate-50/60 to-indigo-50/20 p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                    <div className="flex items-center gap-3.5">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#1F5C99] to-[#154673] text-white shadow-md shadow-blue-500/20 border border-[#154673]">
                            <CalendarDays size={22} />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                            <p className="text-xs text-slate-500 font-bold mt-0.5">Select a date range to filter and manage due tasks</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-end">
                        <select
                            value={quickFilter}
                            onChange={(e) => {
                                const val = e.target.value;
                                setQuickFilter(val);
                                if (!val) {
                                    setRangeStart(null);
                                    setRangeEnd(null);
                                    return;
                                }
                                const today = new Date();
                                let start = new Date();
                                if (val === '7') {
                                    start.setDate(today.getDate() - 6);
                                    setRangeStart(start);
                                    setRangeEnd(today);
                                    setCurrentDate(today);
                                } else if (val === '15') {
                                    start.setDate(today.getDate() - 14);
                                    setRangeStart(start);
                                    setRangeEnd(today);
                                    setCurrentDate(today);
                                } else if (val === 'month') {
                                    start.setMonth(today.getMonth() - 1);
                                    setRangeStart(start);
                                    setRangeEnd(today);
                                    setCurrentDate(today);
                                }
                            }}
                            className="px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition cursor-pointer shadow-sm"
                        >
                            <option value="">Quick Range...</option>
                            <option value="7">Last 7 Days</option>
                            <option value="15">Last 15 Days</option>
                            <option value="month">Last 1 Month</option>
                        </select>
                        <button
                            onClick={() => {
                                setRangeStart(null)
                                setRangeEnd(null)
                                setQuickFilter('')
                                setCurrentDate(new Date())
                            }}
                            className="px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-[#1F5C99] to-[#154673] hover:from-[#246bb2] hover:to-[#1a558c] active:scale-95 rounded-xl transition-all duration-200 shadow-sm shadow-blue-900/10 cursor-pointer"
                        >
                            Today
                        </button>
                        <div className="flex gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer">
                                <ChevronLeft size={16} />
                            </button>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-50 active:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? <Spinner /> : (
                    <div className="grid grid-cols-7 gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-[#1F5C99] to-[#154673] border border-[#154673] rounded-lg shadow-sm">
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

                            // Compute visual borders and colors for a professional planner look
                            let cellBgClass = 'bg-white border-slate-200 hover:border-slate-350 hover:shadow-sm hover:-translate-y-0.5'
                            let stripeClass = 'border-t-2 border-t-slate-200'
                            const isSelected = isStart || isEnd || isInRange

                            if (!date) {
                                cellBgClass = 'bg-transparent border-transparent opacity-10 cursor-default pointer-events-none'
                                stripeClass = 'border-t-0'
                            } else if (isStart || isEnd) {
                                cellBgClass = 'bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white border-[#1d4ed8] shadow-md shadow-blue-900/10 z-10'
                                stripeClass = 'border-t-2 border-t-[#93c5fd]'
                            } else if (isInRange) {
                                cellBgClass = 'bg-gradient-to-br from-[#eff6ff] to-[#dbeafe] text-[#1d4ed8] border-[#bfdbfe] shadow-sm'
                                stripeClass = 'border-t-2 border-t-[#60a5fa]/80'
                            } else if (isToday) {
                                cellBgClass = 'bg-emerald-50/50 border-2 border-emerald-400 text-emerald-800 shadow-sm shadow-emerald-100'
                                stripeClass = 'border-t-2 border-t-emerald-500'
                            } else if (dateTasks.length > 0) {
                                cellBgClass = 'bg-white border-slate-200 hover:border-slate-350 hover:shadow-sm hover:-translate-y-0.5 shadow-sm'
                                stripeClass = 'border-t-2 border-t-rose-450'
                            }

                            return (
                                <div
                                    key={i}
                                    onClick={() => date && handleDateClick(date)}
                                    className={`min-h-[72px] p-2 transition-all duration-200 relative cursor-pointer rounded-xl flex flex-col justify-between border select-none
                                        ${cellBgClass} ${stripeClass}
                                    `}
                                >
                                    {date && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-200
                                                    ${isStart || isEnd ? 'bg-white text-[#1d4ed8] border-2 border-[#1d4ed8] shadow shadow-blue-950/20' :
                                                        isToday ? 'bg-emerald-600 text-white border-2 border-emerald-500 shadow shadow-emerald-200' :
                                                            isInRange ? 'bg-white text-[#1d4ed8] border-2 border-[#bfdbfe] font-bold shadow-sm' : 'text-slate-750 bg-slate-50 border-2 border-slate-200/90'}
                                                `}>
                                                    {date.getDate()}
                                                </span>
                                                {isToday && (
                                                    <span className="text-[8px] font-extrabold text-emerald-700 uppercase tracking-wider bg-emerald-100 px-1 py-0.5 rounded border border-emerald-300/40">
                                                        Today
                                                    </span>
                                                )}
                                            </div>
                                            {dateTasks.length > 0 ? (
                                                <div className="mt-1 pt-1 flex items-center justify-between">
                                                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border shadow-sm font-extrabold
                                                        ${isSelected
                                                            ? (isStart || isEnd ? 'bg-white border-white text-[#1d4ed8]' : 'bg-[#1d4ed8] border-[#1d4ed8] text-white')
                                                            : 'bg-rose-50 border-rose-200 text-rose-700'}`}
                                                    >
                                                        <span className={`w-1 h-1 rounded-full animate-pulse ${isSelected && !(isStart || isEnd) ? 'bg-white' : 'bg-rose-500'}`}></span>
                                                        <span className="text-[9px] tracking-tight">
                                                            {dateTasks.length} {dateTasks.length === 1 ? 'Task' : 'Tasks'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mt-1 pt-1 flex items-center">
                                                    <span className={`text-[8px] font-bold uppercase tracking-wider
                                                        ${isSelected ? (isStart || isEnd ? 'text-[#dbeafe]' : 'text-[#1d4ed8]') : 'text-slate-350'}`}
                                                    >
                                                        No Tasks
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
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-medium bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                                {flatDueRows.length} Tasks
                            </span>
                            <button
                                onClick={exportCalendarTasks}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1F5C99] to-[#154673] hover:from-[#246bb2] hover:to-[#1a558c] rounded-xl shadow-sm shadow-blue-900/15 border border-[#154673]/40 transition-all duration-200 hover:-translate-y-px hover:shadow-md active:scale-95 cursor-pointer"
                            >
                                <Download size={15} /> Export
                            </button>
                        </div>
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
                                {flatDueRows.length === 0 ? (
                                    <tr><td colSpan={6} className="text-center py-8 text-gray-400">No tasks due within selected range.</td></tr>
                                ) : flatDueRows.map((item, idx) => {
                                    return (
                                        <tr 
                                            key={idx} 
                                            className="hover:bg-gray-100 transition cursor-pointer" 
                                            onClick={() => navigate(isStaff ? `/staff/tasks/${item.id}` : `/ca/tasks/${item.id}`)}
                                        >
                                            <td className="px-6 py-4 font-semibold text-gray-800">{item.clientName}</td>
                                            <td className="px-6 py-4 text-gray-700 font-medium">{item.formName}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.workTypeName}</td>
                                            <td className="px-6 py-4 text-gray-600">{item.allocatedToName}</td>
                                            <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(item.dueDate)}</td>
                                            <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                                        </tr>
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
    const [filterWorkTypeId, setFilterWorkTypeId] = useState('')
    const [filterAllocatedTo, setFilterAllocatedTo] = useState('')
    const [page, setPage] = useState(1)

    const fetchSummary = async () => {
        if (isStaff) {
            const [s, st] = await Promise.all([
                api.get('/staff/dashboard/summary'),
                api.get('/staff/dashboard/staff-summary'),
            ])
            setSummary(s.data)
            setStaffData(st.data.data)
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
                params: {
                    search,
                    status,
                    work_type_id: filterWorkTypeId,
                    allocated_to: filterAllocatedTo,
                    page,
                    per_page: 10
                }
            })
            setTasks(res.data.data)
            setTasksMeta(res.data.meta)
        } finally {
            setTaskLoading(false)
        }
    }, [search, status, filterWorkTypeId, filterAllocatedTo, page, isStaff])

    const exportAllTasks = async () => {
        try {
            const ExcelJS = await import('exceljs')
            const prefix = isStaff ? '/staff' : '/ca'
            const res = await api.get(`${prefix}/dashboard/tasks`, {
                params: {
                    search,
                    status,
                    work_type_id: filterWorkTypeId,
                    allocated_to: filterAllocatedTo,
                    per_page: 10000
                }
            })
            const allTasks = res.data.data || []
            if (allTasks.length === 0) {
                toast.error('No tasks found to export')
                return
            }

            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('All Tasks')

            worksheet.mergeCells('A1:H1')
            const titleCell = worksheet.getCell('A1')
            titleCell.value = 'All Tasks Report'
            titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.mergeCells('A2:H2')
            const dateCell = worksheet.getCell('A2')
            dateCell.value = `Generated at: ${new Date().toLocaleString()}`
            dateCell.font = { italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            const headers = ['SR NO', 'Client', 'Work Type', 'Allocated To', 'Inward Date', 'Allocated Date', 'Completed Date', 'Status']
            worksheet.getRow(4).values = headers
            const headerRow = worksheet.getRow(4)
            headerRow.height = 25
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })

            allTasks.forEach((t, i) => {
                const rowData = [
                    String(i + 1).padStart(2, '0'),
                    t.client?.name || '—',
                    t.work_type?.name || '—',
                    t.allocated_to?.name ?? 'Unassigned',
                    formatDate(t.date_inward),
                    formatDate(t.date_allocated),
                    formatDate(t.date_completed),
                    t.status_label || t.status
                ]
                worksheet.addRow(rowData)
            })

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 4) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                        cell.alignment = { vertical: 'middle', wrapText: true }
                    })
                }
            })

            worksheet.columns.forEach(column => {
                let maxLength = 0
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10
                    if (columnLength > maxLength) {
                        maxLength = columnLength
                    }
                })
                column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2)
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `all_tasks_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Tasks exported successfully')
        } catch (err) {
            console.error('Export Error:', err)
            toast.close()
            toast.error('Failed to export tasks')
        }
    }

    const exportStaffSummary = async () => {
        try {
            const ExcelJS = await import('exceljs')
            if (staffData.length === 0) {
                toast.error('No staff summary to export')
                return
            }

            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Staff Summary')

            worksheet.mergeCells('A1:G1')
            const titleCell = worksheet.getCell('A1')
            titleCell.value = 'Staff-wise Task Summary'
            titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.mergeCells('A2:G2')
            const dateCell = worksheet.getCell('A2')
            dateCell.value = `Generated at: ${new Date().toLocaleString()}`
            dateCell.font = { italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            const headers = ['Staff Name', 'Pending', 'Work In Progress', 'Complete', 'Not To Be Done', 'Other', 'Total']
            worksheet.getRow(4).values = headers
            const headerRow = worksheet.getRow(4)
            headerRow.height = 25
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' }
                }
                cell.alignment = { vertical: 'middle', horizontal: 'center' }
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                }
            })

            staffData.forEach((s) => {
                worksheet.addRow([
                    s.name,
                    s.pending || 0,
                    s.work_in_progress || 0,
                    s.complete || 0,
                    s.not_to_be_done || 0,
                    s.other || 0,
                    s.total || 0
                ])
            })

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 4) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        }
                        cell.alignment = { vertical: 'middle' }
                    })
                }
            })

            worksheet.columns.forEach(column => {
                let maxLength = 0
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10
                    if (columnLength > maxLength) {
                        maxLength = columnLength
                    }
                })
                column.width = maxLength < 12 ? 12 : maxLength + 2
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `staff_summary_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Staff summary exported successfully')
        } catch (err) {
            console.error('Export Error:', err)
            toast.error('Failed to export staff summary')
        }
    }

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
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'overview'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                            }`}
                    >
                        <LayoutDashboard size={15} /> Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'calendar'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                            }`}
                    >
                        <CalendarDays size={15} /> Calendar View
                    </button>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === 'summary'
                            ? 'bg-[#1F5C99] text-white shadow-sm'
                            : 'text-slate-650 hover:text-[#1F5C99] hover:bg-slate-100/85'
                            }`}
                    >
                        <Activity size={15} /> Summary
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
                    </div>

                    {/* View Task Summary Banner */}
                    <button
                        onClick={() => setActiveTab('summary')}
                        className="group w-full flex items-center gap-4 cursor-pointer select-none"
                    >
                        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#1F5C99]/20 to-[#1F5C99]/40 group-hover:via-[#1F5C99]/35 group-hover:to-[#1F5C99]/60 transition-all duration-300" />
                        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1F5C99]/25 bg-gradient-to-r from-[#EEF5FF] to-[#E8F1FC] group-hover:from-[#dceeff] group-hover:to-[#d0e6ff] group-hover:border-[#1F5C99]/50 group-hover:shadow-sm group-hover:shadow-blue-100 transition-all duration-200 shrink-0">
                            <Activity size={12} className="text-[#1F5C99]" />
                            <span className="text-xs font-bold text-[#1F5C99] tracking-wide whitespace-nowrap">View Task Summary</span>
                            <span className="text-[#1F5C99]/60 text-sm font-bold leading-none group-hover:translate-x-0.5 transition-transform duration-200">→</span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-l from-transparent via-[#1F5C99]/20 to-[#1F5C99]/40 group-hover:via-[#1F5C99]/35 group-hover:to-[#1F5C99]/60 transition-all duration-300" />
                    </button>

                    {/* All Tasks */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">All Tasks</h2>
                            </div>
                            <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                                {/* Search */}
                                <div className="relative flex-1 sm:flex-none">
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search tasks..."
                                        value={search}
                                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                                        className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full sm:w-44 transition"
                                    />
                                </div>
                                {/* Work Type Filter */}
                                <CustomSelect
                                    value={filterWorkTypeId}
                                    onChange={e => { setFilterWorkTypeId(e.target.value); setPage(1) }}
                                    options={[
                                        { value: '', label: 'All Work Types' },
                                        ...workTypes.map(wt => ({ value: wt.id, label: wt.name }))
                                    ]}
                                    widthClass="w-full sm:w-44"
                                    className="flex-1 sm:flex-none"
                                />
                                {/* Staff Filter (Allocated To) */}
                                {!isStaff && (
                                    <CustomSelect
                                        value={filterAllocatedTo}
                                        onChange={e => { setFilterAllocatedTo(e.target.value); setPage(1) }}
                                        options={[
                                            { value: '', label: 'All Staff' },
                                            ...staffData.map(s => ({ value: s.id, label: s.name }))
                                        ]}
                                        widthClass="w-full sm:w-36"
                                        className="flex-1 sm:flex-none"
                                    />
                                )}
                                {/* Status filter */}
                                <CustomSelect
                                    value={status}
                                    onChange={e => { setStatus(e.target.value); setPage(1) }}
                                    options={statuses}
                                    widthClass="w-full sm:w-32"
                                    className="flex-1 sm:flex-none"
                                />
                                {/* Export Button */}
                                <button
                                    onClick={exportAllTasks}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1F5C99] to-[#154673] hover:from-[#246bb2] hover:to-[#1a558c] rounded-xl shadow-sm shadow-blue-900/15 border border-[#154673]/40 transition-all duration-200 hover:-translate-y-px hover:shadow-md active:scale-95 cursor-pointer shrink-0"
                                >
                                    <Download size={15} /> Export
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            {taskLoading ? <Spinner /> : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                            {['#', 'Client', 'Work Type', 'Sheet Name', 'Allocated To', 'Due Date', 'Status'].map(h => (
                                                <th key={h} className="px-6 py-3.5 text-left">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {tasks?.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-12 text-gray-400">No tasks found</td></tr>
                                        ) : tasks?.map((t, i) => (
                                            <tr key={t.unique_id || t.id} className="hover:bg-gray-100 transition" onClick={() => navigate(isStaff ? `/staff/tasks/${t.id}` : `/ca/tasks/${t.id}`)} style={{ cursor: 'pointer' }}>
                                                <td className="px-6 py-4 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                                <td className="px-6 py-4 font-semibold text-gray-800">{t.client?.name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-600">{t.work_type?.name || '—'}</td>
                                                <td className="px-6 py-4 font-medium text-gray-700">{t.form_name || '—'}</td>
                                                <td className="px-6 py-4 text-gray-600">{t.allocated_to?.name ?? 'Unassigned'}</td>
                                                <td className="px-6 py-4 text-gray-500">{formatDate(t.due_date)}</td>
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
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-800">Staff-wise Summary</h2>
                            <div className="flex items-center gap-3">
                                {!isStaff && (
                                    <button
                                        onClick={exportStaffSummary}
                                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-[#1F5C99] to-[#154673] hover:from-[#246bb2] hover:to-[#1a558c] rounded-xl shadow-sm shadow-blue-900/15 border border-[#154673]/40 transition-all duration-200 hover:-translate-y-px hover:shadow-md active:scale-95 cursor-pointer"
                                    >
                                        <Download size={15} /> Export
                                    </button>
                                )}
                            </div>
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
                                                            <p className="text-xs text-slate-500 font-semibold">{s.role_label || 'Staff Member'}</p>
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
                </>
            ) : activeTab === 'calendar' ? (
                <CalendarView staffData={staffData} />
            ) : (
                <WorkTypeSubtaskSummary workTypes={workTypes} staff={staffData} />
            )}
        </div>
    )
}