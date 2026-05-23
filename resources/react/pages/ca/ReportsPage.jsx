import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, FileDown, Calendar, User, Users, CheckCircle, Clock, RotateCcw, BarChart3, HelpCircle, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import StatusBadge from '../../components/ui/StatusBadge'

export default function ReportsPage() {
    const { type } = useParams()
    const isTaskReport = type === 'tasks'

    // Tab for timesheet
    const [activeTab, setActiveTab] = useState('sheets') // 'sheets' or 'subtasks'
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState({ sheets: [], subtasks: [] }) // For Timesheet
    const [tasksReportData, setTasksReportData] = useState([]) // For Task Report

    // Expanded task row IDs (Task Report)
    const [expandedRows, setExpandedRows] = useState({})

    const formatDateTime = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split(' ');
        const datePart = parts[0];
        const timePart = parts[1] || '00:00:00';
        
        const datePieces = datePart.split('-');
        if (datePieces.length !== 3) return dateStr;
        const year = datePieces[0];
        const month = datePieces[1];
        const day = datePieces[2];
        
        const timePieces = timePart.split(':');
        const hr = timePieces[0] || '00';
        const min = timePieces[1] || '00';
        
        return `${day}/${month}/${year} ${hr}:${min}`;
    };
    
    // Filters
    const [search, setSearch] = useState('')
    const [selectedClient, setSelectedClient] = useState('')
    const [selectedStaff, setSelectedStaff] = useState('')
    const [selectedStatus, setSelectedStatus] = useState('')
    const [selectedWorkType, setSelectedWorkType] = useState('')
    const [subStatusFilter, setSubStatusFilter] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Meta dropdown lists
    const [clients, setClients] = useState([])
    const [staff, setStaff] = useState([])
    const [workTypes, setWorkTypes] = useState([])

    const fetchDropdowns = async () => {
        try {
            const [clientsRes, staffRes, workTypesRes] = await Promise.all([
                api.get('/ca/clients?per_page=-1'),
                api.get('/ca/staff?per_page=-1'),
                api.get('/ca/work-types?per_page=-1')
            ])
            setClients(clientsRes.data.data || [])
            setStaff(staffRes.data.data || [])
            setWorkTypes(workTypesRes.data.data || [])
        } catch (e) {
            console.error('Failed to load filter options', e)
        }
    }

    const fetchReportData = useCallback(async () => {
        setLoading(true)
        try {
            if (isTaskReport) {
                const params = {
                    client_id: selectedClient,
                    staff_id: selectedStaff,
                    status: selectedStatus,
                    work_type_id: selectedWorkType,
                    start_date: startDate,
                    end_date: endDate
                }
                const res = await api.get('/ca/reports/tasks', { params })
                setTasksReportData(res.data.data || [])
            } else {
                const params = {
                    client_id: selectedClient,
                    staff_id: selectedStaff,
                    status: selectedStatus,
                    start_date: startDate,
                    end_date: endDate
                }
                const res = await api.get('/ca/reports/timesheet', { params })
                setData(res.data.data)
            }
        } catch (e) {
            toast.error('Failed to load report data')
        } finally {
            setLoading(false)
        }
    }, [isTaskReport, selectedClient, selectedStaff, selectedStatus, selectedWorkType, startDate, endDate])

    useEffect(() => {
        fetchDropdowns()
    }, [])

    useEffect(() => {
        fetchReportData()
    }, [fetchReportData])

    const handleReset = () => {
        setSearch('')
        setSelectedClient('')
        setSelectedStaff('')
        setSelectedStatus('')
        setSelectedWorkType('')
        setSubStatusFilter('')
        setStartDate('')
        setEndDate('')
        toast.success('Filters reset successfully')
    }

    // Client-side search and substatus filtering
    const getFilteredItems = () => {
        if (isTaskReport) {
            return tasksReportData.filter(item => {
                const query = search.toLowerCase()
                const matchesSearch = (
                    item.name?.toLowerCase().includes(query) ||
                    item.client_name?.toLowerCase().includes(query) ||
                    item.assigned_to?.toLowerCase().includes(query) ||
                    item.work_type?.toLowerCase().includes(query)
                )

                const matchesSubStatus = !subStatusFilter || item.subtasks?.some(st => 
                    st.sub_status?.toLowerCase().includes(subStatusFilter.toLowerCase())
                )

                return matchesSearch && matchesSubStatus
            })
        } else {
            const activeList = activeTab === 'sheets' ? data.sheets : data.subtasks
            return activeList.filter(item => {
                const query = search.toLowerCase()
                return (
                    item.name?.toLowerCase().includes(query) ||
                    item.client_name?.toLowerCase().includes(query) ||
                    item.assigned_to?.toLowerCase().includes(query) ||
                    item.work_type?.toLowerCase().includes(query) ||
                    (item.parent_sheet && item.parent_sheet.toLowerCase().includes(query))
                )
            })
        }
    }

    const filteredItems = getFilteredItems()

    // Calculations for metrics
    const totalItems = filteredItems.length
    const completedItems = isTaskReport 
        ? filteredItems.filter(item => item.status === 'complete').length
        : filteredItems.filter(item => item.is_completed).length
    const totalHours = isTaskReport ? 0 : filteredItems.filter(item => item.is_completed).reduce((acc, item) => acc + (item.hours_taken || 0), 0)
    const avgHours = completedItems > 0 ? (totalHours / completedItems).toFixed(1) : '0'

    // Expand/collapse single row
    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    // ExcelJS premium exporter (Header styling, borders, auto width dynamic padding)
    const handleExportExcel = async () => {
        if (filteredItems.length === 0) {
            toast.error('No data available to export')
            return
        }

        try {
            const ExcelJS = await import('exceljs')
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet(
                isTaskReport ? 'Task Report' : (activeTab === 'sheets' ? 'Sheets Timesheet' : 'Subtasks Timesheet')
            )

            // 1. Define Headers
            let headers = []
            if (isTaskReport) {
                headers = [
                    { name: 'SR NO', key: 'sr_no' },
                    { name: 'Title / Name', key: 'name' },
                    { name: 'Client Name', key: 'client_name' },
                    { name: 'Work Type', key: 'work_type' },
                    { name: 'Assigned Staff', key: 'assigned_to' },
                    { name: 'Status', key: 'status_label' },
                    { name: 'Creation Date', key: 'created_at' },
                    { name: 'Completion Date', key: 'date_completed' },
                    { name: 'Substatus / Remarks', key: 'sub_status' }
                ]
            } else {
                headers = [
                    { name: 'SR NO', key: 'sr_no' },
                    { name: 'Name / Title', key: 'name' },
                    { name: 'Client Name', key: 'client_name' },
                    { name: 'Work Type', key: 'work_type' },
                    { name: 'Assigned Staff', key: 'assigned_to' },
                    { name: 'Start Time', key: 'start_time' },
                    { name: 'Completion Time', key: 'end_time' },
                    { name: 'Hours Spent', key: 'hours_taken' },
                    { name: 'Status', key: 'status_label' }
                ]
                if (activeTab === 'subtasks') {
                    headers.splice(2, 0, { name: 'Parent Sheet', key: 'parent_sheet' })
                }
            }

            // Write headers row
            const headerRowValues = headers.map(h => h.name)
            const headerRow = worksheet.addRow(headerRowValues)
            headerRow.height = 28

            // Style headers with Navy Blue background & White bold text
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1F5C99' } // Navy Blue
                }
                cell.font = {
                    name: 'Segoe UI',
                    size: 11,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                }
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                }
            })

            // 2. Write Data Rows
            let srNo = 1
            filteredItems.forEach(item => {
                if (isTaskReport) {
                    // Write main task row
                    const taskRowValues = [
                        srNo++,
                        item.name,
                        item.client_name,
                        item.work_type,
                        item.assigned_to,
                        item.status_label,
                        formatDateTime(item.created_at),
                        item.date_completed ? formatDateTime(item.date_completed) : 'In Progress',
                        'N/A'
                    ]
                    const row = worksheet.addRow(taskRowValues)
                    row.height = 22
                    row.eachCell(cell => {
                        cell.font = { name: 'Segoe UI', size: 10, bold: true }
                        cell.alignment = { vertical: 'middle', horizontal: 'left' }
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        }
                    })

                    // Write subtasks underneath
                    if (item.subtasks && item.subtasks.length > 0) {
                        item.subtasks.forEach(st => {
                            const subtaskRowValues = [
                                '',
                                `   ↳ ${st.name}`, // indent visually
                                '',
                                '',
                                st.assigned_to,
                                st.status_label,
                                formatDateTime(st.created_at),
                                st.completed_at ? formatDateTime(st.completed_at) : 'In Progress',
                                st.sub_status || 'N/A'
                            ]
                            const stRow = worksheet.addRow(subtaskRowValues)
                            stRow.height = 20
                            stRow.eachCell((cell, colIdx) => {
                                cell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF4B5563' } }
                                cell.fill = {
                                    type: 'pattern',
                                    pattern: 'solid',
                                    fgColor: { argb: 'FFF9FAFB' } // Light gray fill for subtasks
                                }
                                cell.alignment = { vertical: 'middle', horizontal: 'left' }
                                cell.border = {
                                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                                }
                            })
                        })
                    }
                } else {
                    // Timesheet Report Row
                    const rowValues = [
                        srNo++,
                        item.name,
                        ...(activeTab === 'subtasks' ? [item.parent_sheet] : []),
                        item.client_name,
                        item.work_type,
                        item.assigned_to,
                        formatDateTime(item.start_time),
                        item.end_time ? formatDateTime(item.end_time) : 'In Progress',
                        item.hours_taken ? `${item.hours_taken} hrs` : 'N/A',
                        item.status_label
                    ]
                    const row = worksheet.addRow(rowValues)
                    row.height = 22
                    row.eachCell(cell => {
                        cell.font = { name: 'Segoe UI', size: 10 }
                        cell.alignment = { vertical: 'middle', horizontal: 'left' }
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        }
                    })
                }
            })

            // 3. Perfect Auto-fit Columns Spacing (Never double-tap!)
            worksheet.columns.forEach(column => {
                let maxLen = 0
                column.eachCell({ includeEmpty: true }, cell => {
                    const val = cell.value ? cell.value.toString() : ''
                    if (val.length > maxLen) {
                        maxLen = val.length
                    }
                })
                // Extra padding of 5 characters for standard padding
                column.width = Math.max(maxLen + 5, 12)
            })

            // 4. Save and trigger immediate download
            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const reportPrefix = isTaskReport ? 'Task_Report' : `${activeTab === 'sheets' ? 'Sheets' : 'Subtasks'}_Timesheet`
            a.download = `${reportPrefix}_${new Date().toISOString().split('T')[0]}.xlsx`
            a.click()
            window.URL.revokeObjectURL(url)
            toast.success('Excel report exported successfully with professional styling!')
        } catch (e) {
            console.error(e)
            toast.error('Failed to export Excel report')
        }
    }

    const inputCls = "px-3 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition w-full font-semibold text-slate-700"

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <BarChart3 className="text-indigo-600 w-8 h-8" /> 
                        {isTaskReport ? 'Task Report' : 'TimeSheet Report'}
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 mt-1">
                        {isTaskReport 
                            ? 'Complete register of all work tasks, work types, subtasks status, and staff allocation.'
                            : 'Track timesheets, completion rates, and operations speed for sheets and subtasks.'}
                    </p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-2 bg-[#1F5C99] hover:bg-[#154675] text-white px-6 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-indigo-100 transition duration-200 active:scale-95 whitespace-nowrap self-start md:self-auto"
                >
                    <FileDown size={16} />
                    <span>Export Excel Report</span>
                </button>
            </div>

            {/* Sub Nav Tab Bar (Only render when in timesheet report) */}
            {!isTaskReport && (
                <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm max-w-md flex gap-2">
                    <button
                        onClick={() => setActiveTab('sheets')}
                        className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition duration-200 ${
                            activeTab === 'sheets'
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Sheets Timesheet
                    </button>
                    <button
                        onClick={() => setActiveTab('subtasks')}
                        className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider rounded-xl transition duration-200 ${
                            activeTab === 'subtasks'
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Subtasks Timesheet
                    </button>
                </div>
            )}

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {isTaskReport ? (
                    // Task Report Metrics
                    <>
                        {[
                            { label: 'Total Sheets/Tasks', val: totalItems, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Clock },
                            { label: 'Completed Tasks', val: completedItems, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
                            { label: 'Active Tasks', val: totalItems - completedItems, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                            { label: 'Average Completion Rate', val: `${totalItems > 0 ? ((completedItems / totalItems) * 100).toFixed(0) : 0}%`, color: 'text-rose-600', bg: 'bg-rose-50', icon: HelpCircle }
                        ].map((m, i) => (
                            <div key={i} className={`${m.bg} rounded-[2rem] p-6 border border-white shadow-sm flex items-center justify-between`}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{m.label}</p>
                                    <p className={`text-2xl font-black ${m.color}`}>{m.val}</p>
                                </div>
                                <div className="p-3 bg-white/60 rounded-2xl border border-white">
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    // Timesheet Report Metrics
                    <>
                        {[
                            { label: 'Total Tracked', val: totalItems, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Clock },
                            { label: 'Total Hours Spent', val: `${totalHours.toFixed(1)} hrs`, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
                            { label: 'Completed items', val: completedItems, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle },
                            { label: 'Avg Hrs per Item', val: `${avgHours} hrs`, color: 'text-rose-600', bg: 'bg-rose-50', icon: HelpCircle }
                        ].map((m, i) => (
                            <div key={i} className={`${m.bg} rounded-[2rem] p-6 border border-white shadow-sm flex items-center justify-between`}>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{m.label}</p>
                                    <p className={`text-2xl font-black ${m.color}`}>{m.val}</p>
                                </div>
                                <div className="p-3 bg-white/60 rounded-2xl border border-white">
                                    <m.icon className={`w-5 h-5 ${m.color}`} />
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>

            {/* Filters panel */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Report Filters</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {/* Search */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Search Keyword</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={inputCls + " pl-9"}
                            />
                        </div>
                    </div>

                    {/* Client */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Client Filter</label>
                        <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)} className={inputCls}>
                            <option value="">All Clients</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Staff */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Staff Filter</label>
                        <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} className={inputCls}>
                            <option value="">All Staff</option>
                            {staff.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Work Type (Only for Task Report) */}
                    {isTaskReport ? (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Work Type</label>
                            <select value={selectedWorkType} onChange={e => setSelectedWorkType(e.target.value)} className={inputCls}>
                                <option value="">All Work Types</option>
                                {workTypes.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</label>
                            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className={inputCls}>
                                <option value="">All Statuses</option>
                                <option value="complete">Complete</option>
                                <option value="work_in_progress">Work In Progress</option>
                                <option value="pending">Pending</option>
                                <option value="not_to_be_done">Not To Be Done</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    )}

                    {/* Substatus Filter (Only for Task Report) or Status filter for Task Report */}
                    {isTaskReport ? (
                        <>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</label>
                                <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className={inputCls}>
                                    <option value="">All Statuses</option>
                                    <option value="complete">Complete</option>
                                    <option value="work_in_progress">Work In Progress</option>
                                    <option value="pending">Pending</option>
                                    <option value="not_to_be_done">Not To Be Done</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Substatus Filter</label>
                                <input
                                    type="text"
                                    placeholder="Substatus keyword..."
                                    value={subStatusFilter}
                                    onChange={e => setSubStatusFilter(e.target.value)}
                                    className={inputCls}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Start Date */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className={inputCls}
                                />
                            </div>

                            {/* End Date */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">End Date</label>
                                <div className="flex gap-2">
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={e => setEndDate(e.target.value)}
                                        className={inputCls}
                                    />
                                    <button
                                        onClick={handleReset}
                                        className="p-2 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition"
                                        title="Reset filters"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {isTaskReport && (
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 border border-slate-200 text-slate-500 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold transition"
                        >
                            <RotateCcw size={14} /> Reset Filters
                        </button>
                    </div>
                )}
            </div>

            {/* List Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : isTaskReport ? (
                        // Task Report Table with expandable Subtasks
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="w-12 px-6 py-4"></th>
                                    <th className="px-6 py-4">Task Name / Sheet</th>
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Work Type</th>
                                    <th className="px-6 py-4">Assigned To</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4">Creation Date</th>
                                    <th className="px-6 py-4">Completion Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                                            No tasks found matching current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(task => {
                                        const isExpanded = !!expandedRows[task.id]
                                        return (
                                            <>
                                                <tr key={task.id} className="hover:bg-slate-50/30 transition">
                                                    <td className="px-6 py-4 text-center">
                                                        {task.subtasks?.length > 0 ? (
                                                            <button
                                                                onClick={() => toggleRow(task.id)}
                                                                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                                                            >
                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </button>
                                                        ) : (
                                                            <span className="text-[10px] font-semibold text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-800">
                                                        {task.name}
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-slate-600">
                                                        {task.client_name}
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-slate-600">
                                                        {task.work_type}
                                                    </td>
                                                    <td className="px-6 py-4 font-semibold text-slate-600">
                                                        {task.assigned_to}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <StatusBadge status={task.status} />
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-medium">
                                                        {formatDateTime(task.created_at)}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 font-medium">
                                                        {task.date_completed ? formatDateTime(task.date_completed) : (
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">In Progress</span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {isExpanded && task.subtasks?.length > 0 && (
                                                    <tr className="bg-slate-50/40">
                                                        <td colSpan={8} className="px-12 py-4 border-l-4 border-indigo-400">
                                                            <div className="space-y-3">
                                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Subtasks</h4>
                                                                <table className="w-full text-xs text-left border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                                                                    <thead>
                                                                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                            <th className="px-4 py-2.5">Subtask Name</th>
                                                                            <th className="px-4 py-2.5">Assigned Employee</th>
                                                                            <th className="px-4 py-2.5 text-center">Status</th>
                                                                            <th className="px-4 py-2.5">Sub-status</th>
                                                                            <th className="px-4 py-2.5">Completion Date</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-50">
                                                                        {task.subtasks.map(st => (
                                                                            <tr key={st.id} className="hover:bg-slate-50/20">
                                                                                <td className="px-4 py-2 font-bold text-slate-700">{st.name}</td>
                                                                                <td className="px-4 py-2 font-semibold text-slate-500">{st.assigned_to}</td>
                                                                                <td className="px-4 py-2 text-center">
                                                                                    <StatusBadge status={st.status} />
                                                                                </td>
                                                                                <td className="px-4 py-2 font-semibold text-slate-500">{st.sub_status || 'N/A'}</td>
                                                                                <td className="px-4 py-2 text-slate-400 font-medium">
                                                                                    {st.completed_at ? formatDateTime(st.completed_at) : 'In Progress'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    ) : (
                        // Timesheet Report Table
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="px-6 py-4">Title / Name</th>
                                    {activeTab === 'subtasks' && <th className="px-6 py-4">Parent Sheet</th>}
                                    <th className="px-6 py-4">Client</th>
                                    <th className="px-6 py-4">Assigned To</th>
                                    <th className="px-6 py-4">Start Time</th>
                                    <th className="px-6 py-4">End Time</th>
                                    <th className="px-6 py-4 text-center">Duration</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-slate-700">
                                {filteredItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={activeTab === 'subtasks' ? 8 : 7} className="text-center py-12 text-slate-400 font-semibold">
                                            No timesheet records found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/30 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{item.name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{item.work_type}</div>
                                            </td>
                                            {activeTab === 'subtasks' && (
                                                <td className="px-6 py-4">
                                                    <span className="font-semibold text-slate-600">{item.parent_sheet}</span>
                                                </td>
                                            )}
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-slate-600">{item.client_name}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-semibold text-slate-600">{item.assigned_to}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                    <Calendar size={13} className="text-indigo-400" />
                                                    <span>{formatDateTime(item.start_time)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.end_time ? (
                                                    <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                                        <Calendar size={13} className="text-emerald-400" />
                                                        <span>{formatDateTime(item.end_time)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-100">
                                                        Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-800">
                                                {item.hours_taken ? `${item.hours_taken} hrs` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <StatusBadge status={item.status} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
