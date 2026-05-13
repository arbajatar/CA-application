import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    FileText, Activity, CheckCircle, AlertTriangle,
    Briefcase, Users, Search, Download, SlidersHorizontal
} from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'

const statuses = [
    { value: '', label: 'All Status' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_information', label: 'Awaiting Information' },
    { value: 'completed', label: 'Completed' },
]

function SummaryCard({ icon: Icon, iconBg, iconColor, label, value, sub, subColor }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
                <Icon size={22} className={iconColor} />
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-4xl font-bold text-gray-800">{String(value).padStart(2, '0')}</p>
            {sub && <p className={`text-xs font-medium ${subColor ?? 'text-gray-400'}`}>{sub}</p>}
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

export default function DashboardPage() {
    const navigate = useNavigate()

    const [summary, setSummary] = useState(null)
    const [staffData, setStaffData] = useState([])
    const [tasks, setTasks] = useState([])
    const [tasksMeta, setTasksMeta] = useState(null)
    const [loading, setLoading] = useState(true)
    const [taskLoading, setTaskLoading] = useState(false)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [page, setPage] = useState(1)

    const fetchSummary = async () => {
        const [s, st] = await Promise.all([
            api.get('/ca/dashboard/summary'),
            api.get('/ca/dashboard/staff-summary'),
        ])
        setSummary(s.data)
        setStaffData(st.data.data)
    }

    const fetchTasks = useCallback(async () => {
        setTaskLoading(true)
        try {
            const res = await api.get('/ca/dashboard/tasks', {
                params: { search, status, page, per_page: 10 }
            })
            setTasks(res.data.data)
            setTasksMeta(res.data.meta)
        } finally {
            setTaskLoading(false)
        }
    }, [search, status, page])

    useEffect(() => {
        fetchSummary().finally(() => setLoading(false))
    }, [])

    useEffect(() => { fetchTasks() }, [fetchTasks])

    const handleExport = async () => {
        const res = await api.get('/ca/tasks/export', { responseType: 'blob' })
        const url = window.URL.createObjectURL(new Blob([res.data]))
        const a = document.createElement('a'); a.href = url
        a.download = 'tasks.xlsx'; a.click()
        window.URL.revokeObjectURL(url)
    }

    if (loading) return <Spinner />

    const cards = [
        { icon: FileText, iconBg: 'bg-blue-50', iconColor: 'text-blue-400', label: 'Total Tasks', value: summary?.total_tasks ?? 0, sub: 'All time records' },
        { icon: Activity, iconBg: 'bg-sky-50', iconColor: 'text-sky-400', label: 'Active Tasks', value: summary?.active_tasks ?? 0, sub: 'In current workflow' },
        { icon: CheckCircle, iconBg: 'bg-green-50', iconColor: 'text-green-400', label: 'Completed', value: summary?.completed_this_month ?? 0, sub: 'This month' },
        { icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-400', label: 'Overdue', value: 0, sub: 'Immediate action req.', subColor: 'text-red-500' },
        { icon: Briefcase, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-400', label: 'Total Clients', value: summary?.total_clients ?? 0, sub: 'Enterprise level' },
        { icon: Users, iconBg: 'bg-teal-50', iconColor: 'text-teal-400', label: 'Total Staff', value: summary?.total_staff ?? 0, sub: 'Full-time active' },
    ]

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {cards.map((c, i) => <SummaryCard key={i} {...c} />)}
            </div>

            {/* Staff-wise Summary */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">Staff-wise Summary</h2>
                    <SlidersHorizontal size={18} className="text-gray-400" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                {['Staff Name', 'Assigned', 'In Progress', 'Awaiting', 'Completed', 'Total'].map(h => (
                                    <th key={h} className="px-6 py-3 text-left">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {staffData.map(s => (
                                <tr
                                    key={s.id}
                                    onClick={() => navigate(`/ca/tasks?staff_id=${s.id}`)}
                                    className="hover:bg-gray-50 cursor-pointer transition"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={s.name} />
                                            <div>
                                                <p className="font-semibold text-gray-800">{s.name}</p>
                                                <p className="text-xs text-gray-400">Staff Member</p>
                                            </div>
                                        </div>
                                    </td>
                                    {[s.assigned, s.in_progress, s.awaiting_information, s.completed].map((v, i) => (
                                        <td key={i} className="px-6 py-4 text-gray-600 font-medium">
                                            {String(v).padStart(2, '0')}
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
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value); setPage(1) }}
                            className="py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition flex-1 sm:flex-none"
                        >
                            {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {taskLoading ? <Spinner /> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                    {['#', 'Client', 'Nature', 'Allocated To', 'Inward', 'Allocated', 'Completed', 'Status'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {tasks?.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center py-12 text-gray-400">No tasks found</td></tr>
                                ) : tasks?.map((t, i) => (
                                    <tr key={t.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-800">{t.client.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{t.work_type.name}</td>
                                        <td className="px-6 py-4 text-gray-600">{t.allocated_to?.name ?? 'Unassigned'}</td>
                                        <td className="px-6 py-4 text-gray-500">{t.date_inward}</td>
                                        <td className="px-6 py-4 text-gray-500">{t.date_allocated}</td>
                                        <td className="px-6 py-4 text-gray-500">{t.date_completed ?? '—'}</td>
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
                        <p className="text-xs text-gray-400">
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
        </div>
    )
}