import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, FileDown, Calendar, User, Users, CheckCircle, Clock, RotateCcw, BarChart3, HelpCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import StatusBadge from '../../components/ui/StatusBadge'

export default function ReportsPage() {
    const { type } = useParams()
    const [activeTab, setActiveTab] = useState('sheets') // 'sheets' or 'subtasks'
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState({ sheets: [], subtasks: [] })

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
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Meta / Options lists
    const [clients, setClients] = useState([])
    const [staff, setStaff] = useState([])

    const fetchDropdowns = async () => {
        try {
            const [clientsRes, staffRes] = await Promise.all([
                api.get('/ca/clients?per_page=-1'),
                api.get('/ca/staff?per_page=-1')
            ])
            setClients(clientsRes.data.data || [])
            setStaff(staffRes.data.data || [])
        } catch (e) {
            console.error('Failed to load filter options', e)
        }
    }

    const fetchTimesheet = useCallback(async () => {
        setLoading(true)
        try {
            const params = {
                client_id: selectedClient,
                staff_id: selectedStaff,
                status: selectedStatus,
                start_date: startDate,
                end_date: endDate
            }
            const res = await api.get('/ca/reports/timesheet', { params })
            setData(res.data.data)
        } catch (e) {
            toast.error('Failed to load timesheet report')
        } finally {
            setLoading(false)
        }
    }, [selectedClient, selectedStaff, selectedStatus, startDate, endDate])

    useEffect(() => {
        fetchDropdowns()
    }, [])

    useEffect(() => {
        fetchTimesheet()
    }, [fetchTimesheet])

    const handleReset = () => {
        setSearch('')
        setSelectedClient('')
        setSelectedStaff('')
        setSelectedStatus('')
        setStartDate('')
        setEndDate('')
        toast.success('Filters reset successfully')
    }

    // Client-side search filter
    const activeList = activeTab === 'sheets' ? data.sheets : data.subtasks
    const filteredItems = activeList.filter(item => {
        const query = search.toLowerCase()
        return (
            item.name?.toLowerCase().includes(query) ||
            item.client_name?.toLowerCase().includes(query) ||
            item.assigned_to?.toLowerCase().includes(query) ||
            (item.parent_sheet && item.parent_sheet.toLowerCase().includes(query))
        )
    })

    // Calculations for metrics
    const totalItems = filteredItems.length
    const completedItems = filteredItems.filter(item => item.is_completed).length
    const totalHours = filteredItems.filter(item => item.is_completed).reduce((acc, item) => acc + (item.hours_taken || 0), 0)
    const avgHours = completedItems > 0 ? (totalHours / completedItems).toFixed(1) : '0'

    if (type && type !== 'timesheet') {
        const reportNames = {
            financial: 'Financial Reports',
            sales: 'Daily Sales Report',
            ledger: 'Ledger Report',
            'customer-history': 'Customer History Report',
            credit: 'Credit Report',
            'credit-notes': 'Credit Notes',
            expense: 'Expense Report',
            seed: 'Seed Report'
        }
        const title = reportNames[type] || 'Report Suite'

        return (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <BarChart3 className="text-indigo-600 w-8 h-8" /> {title}
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 mt-1">
                        Detailed reporting module for CA Office Operations.
                    </p>
                </div>
                <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-6 bg-indigo-50 rounded-full border-4 border-white shadow-sm text-indigo-500">
                        <Clock className="w-12 h-12 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">{title} Coming Soon</h2>
                    <p className="text-sm font-semibold text-slate-400 max-w-md">
                        We are currently preparing and calculating key variables for the {title}. This module will be live shortly.
                    </p>
                </div>
            </div>
        )
    }

    // Export to Excel function using client-side 'xlsx'
    const handleExportExcel = async () => {
        if (filteredItems.length === 0) {
            toast.error('No data available to export')
            return
        }

        try {
            const XLSX = await import('xlsx')
            
            // Format sheet data for excel rows
            const excelRows = filteredItems.map((item, idx) => {
                const row = {
                    'SR NO': idx + 1,
                    'Name / Title': item.name,
                    'Client Name': item.client_name,
                    'Work Type': item.work_type,
                    'Assigned Staff': item.assigned_to,
                    'Start Time / Allocation Date': formatDateTime(item.start_time),
                    'Completion Time': item.end_time ? formatDateTime(item.end_time) : 'In Progress',
                    'Hours Spent': item.hours_taken ? `${item.hours_taken} hrs` : 'N/A',
                    'Status': item.status_label
                }

                if (activeTab === 'subtasks') {
                    row['Parent Sheet'] = item.parent_sheet
                }

                return row
            })

            const worksheet = XLSX.utils.json_to_sheet(excelRows)
            const workbook = XLSX.utils.book_new()
            
            // Auto fit column widths
            const maxLen = excelRows.reduce((w, r) => {
                Object.keys(r).forEach((k, idx) => {
                    const l = Math.max(r[k] ? r[k].toString().length : 0, k.length)
                    w[idx] = Math.max(w[idx] || 0, l)
                })
                return w
            }, [])
            worksheet['!cols'] = maxLen.map(l => ({ wch: l + 3 }))

            XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'sheets' ? 'Sheets Timesheet' : 'Subtasks Timesheet')
            
            const fileName = `${activeTab === 'sheets' ? 'Sheets' : 'Subtasks'}_Timesheet_Report_${new Date().toISOString().split('T')[0]}.xlsx`
            XLSX.writeFile(workbook, fileName)
            
            toast.success('Timesheet exported successfully!')
        } catch (e) {
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
                        <BarChart3 className="text-indigo-600 w-8 h-8" /> Office Reports
                    </h1>
                    <p className="text-sm font-semibold text-slate-400 mt-1">
                        Track timesheets, completion rates, and operations speed for sheets and subtasks.
                    </p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl text-sm font-bold shadow-xl shadow-emerald-100 transition duration-200 active:scale-95 whitespace-nowrap self-start md:self-auto"
                >
                    <FileDown size={16} />
                    <span>Export Excel Report</span>
                </button>
            </div>

            {/* Sub Nav Tab Bar */}
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

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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

                    {/* Status */}
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
                </div>
            </div>

            {/* List Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? <Spinner /> : (
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
