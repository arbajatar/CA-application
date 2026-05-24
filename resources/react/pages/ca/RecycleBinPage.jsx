import { useState, useEffect, useCallback } from 'react'
import { Trash2, RotateCcw, Search, Users, ClipboardList, AlertTriangle, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../api/axios'
import Spinner from '../../components/ui/Spinner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

export default function RecycleBinPage() {
    const [activeTab, setActiveTab] = useState('clients') // 'clients' | 'tasks'
    const [clients, setClients] = useState([])
    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Confirmation states
    const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false)
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)
    const [actionLoading, setActionLoading] = useState(false)

    const fetchDeletedClients = useCallback(async () => {
        try {
            const res = await api.get('/ca/recycle-bin/clients')
            setClients(res.data.data || [])
        } catch (e) {
            toast.error('Failed to load deleted clients')
        }
    }, [])

    const fetchDeletedTasks = useCallback(async () => {
        try {
            const res = await api.get('/ca/recycle-bin/tasks')
            setTasks(res.data.data || [])
        } catch (e) {
            toast.error('Failed to load deleted sheets/tasks')
        }
    }, [])

    const loadData = useCallback(async () => {
        setLoading(true)
        if (activeTab === 'clients') {
            await fetchDeletedClients()
        } else {
            await fetchDeletedTasks()
        }
        setLoading(false)
    }, [activeTab, fetchDeletedClients, fetchDeletedTasks])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleOpenRestore = (item) => {
        setSelectedItem(item)
        setConfirmRestoreOpen(true)
    }

    const handleOpenDelete = (item) => {
        setSelectedItem(item)
        setConfirmDeleteOpen(true)
    }

    const handleRestore = async () => {
        if (!selectedItem) return
        setActionLoading(true)
        try {
            const endpoint = activeTab === 'clients' 
                ? `/ca/recycle-bin/clients/${selectedItem.id}/restore`
                : `/ca/recycle-bin/tasks/${selectedItem.id}/restore`
            
            const res = await api.post(endpoint)
            toast.success(res.data.message || 'Restored successfully')
            setConfirmRestoreOpen(false)
            setSelectedItem(null)
            loadData()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to restore item')
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeletePermanently = async () => {
        if (!selectedItem) return
        setActionLoading(true)
        try {
            const endpoint = activeTab === 'clients' 
                ? `/ca/recycle-bin/clients/${selectedItem.id}/force-delete`
                : `/ca/recycle-bin/tasks/${selectedItem.id}/force-delete`
            
            const res = await api.delete(endpoint)
            toast.success(res.data.message || 'Deleted permanently')
            setConfirmDeleteOpen(false)
            setSelectedItem(null)
            loadData()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to permanently delete item')
        } finally {
            setActionLoading(false)
        }
    }

    // Filter items based on search query
    const filteredClients = clients.filter(c => 
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.pan_no?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.group?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredTasks = tasks.filter(t => 
        t.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.work_type_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.form_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.task_particular?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.allocated_to_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A'
        try {
            const d = new Date(dateStr)
            const day = String(d.getDate()).padStart(2, '0')
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const year = d.getFullYear()
            const hours = String(d.getHours()).padStart(2, '0')
            const minutes = String(d.getMinutes()).padStart(2, '0')
            return `${day}/${month}/${year} ${hours}:${minutes}`
        } catch (e) {
            return dateStr
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Trash2 className="text-[#1F5C99] w-6 h-6" />
                        <span>Recycle Bin</span>
                    </h1>
                    <p className="text-xs font-semibold text-slate-400 mt-1">
                        View, recover, or permanently purge soft-deleted clients and sheets/tasks.
                    </p>
                </div>
            </div>

            {/* Navigation & Search Actions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm">
                {/* Tabs */}
                <div className="lg:col-span-6 flex gap-2">
                    <button
                        onClick={() => { setActiveTab('clients'); setSearchQuery(''); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                            activeTab === 'clients'
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <Users size={16} />
                        <span>Clients Bin</span>
                        <span className="bg-slate-200/60 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                            {clients.length}
                        </span>
                    </button>
                    <button
                        onClick={() => { setActiveTab('tasks'); setSearchQuery(''); }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                            activeTab === 'tasks'
                                ? 'bg-[#EEF4FB] text-[#1F5C99]'
                                : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        <ClipboardList size={16} />
                        <span>Sheets Bin</span>
                        <span className="bg-slate-200/60 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-black">
                            {tasks.length}
                        </span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="lg:col-span-6 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={activeTab === 'clients' ? "Search by client name, PAN, type or group..." : "Search by client, work type, form name..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-slate-700 placeholder-slate-400"
                    />
                </div>
            </div>

            {/* List Table Content */}
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col justify-between">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <Spinner size="lg" />
                        <span className="text-xs font-semibold text-slate-400 mt-3">Fetching deleted items...</span>
                    </div>
                ) : activeTab === 'clients' ? (
                    filteredClients.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                <Users size={28} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">No Deleted Clients</h3>
                            <p className="text-xs text-slate-400 max-w-sm mt-1">
                                {searchQuery ? 'No deleted clients match your search filter.' : 'Your deleted clients register is currently empty.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150">
                                        <th className="px-6 py-4">Client Name</th>
                                        <th className="px-6 py-4">PAN Number</th>
                                        <th className="px-6 py-4">Type / Group</th>
                                        <th className="px-6 py-4">Contact & Email</th>
                                        <th className="px-6 py-4">Deleted At</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                                    {filteredClients.map((client) => (
                                        <tr key={client.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{client.name}</div>
                                                {client.name_as_per_pan && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">As per PAN: {client.name_as_per_pan}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-mono font-bold uppercase tracking-wider text-slate-700">
                                                {client.pan_no || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {client.type && (
                                                        <span className="bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            {client.type}
                                                        </span>
                                                    )}
                                                    {client.group && (
                                                        <span className="bg-purple-50 text-purple-700 border border-purple-100 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                            {client.group}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>{client.contact || 'N/A'}</div>
                                                <div className="text-[10px] text-slate-400 font-medium lowercase">{client.email || ''}</div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-medium">
                                                {formatDate(client.deleted_at)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenRestore(client)}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                        title="Restore Client & Sheets"
                                                    >
                                                        <RotateCcw size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDelete(client)}
                                                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                        title="Permanently Delete Client"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    filteredTasks.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                                <ClipboardList size={28} />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">No Deleted Sheets</h3>
                            <p className="text-xs text-slate-400 max-w-sm mt-1">
                                {searchQuery ? 'No deleted tasks match your search filter.' : 'Your deleted tasks register is currently empty.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150">
                                        <th className="px-6 py-4">Client Name</th>
                                        <th className="px-6 py-4">Work Type / Form</th>
                                        <th className="px-6 py-4">Particulars</th>
                                        <th className="px-6 py-4">Assigned To</th>
                                        <th className="px-6 py-4">Deleted At</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                                    {filteredTasks.map((task) => (
                                        <tr key={task.id} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800">{task.client_name}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-700">{task.work_type_name}</div>
                                                {task.form_name && (
                                                    <div className="text-[10px] text-slate-400 mt-0.5">Form: {task.form_name}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={task.task_particular}>
                                                {task.task_particular || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-50 text-slate-700 px-2.5 py-1 border border-slate-100 rounded-lg text-[10px] font-bold">
                                                    {task.allocated_to_name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 font-medium">
                                                {formatDate(task.deleted_at)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenRestore(task)}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                        title="Restore Sheet & Subtasks"
                                                    >
                                                        <RotateCcw size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenDelete(task)}
                                                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                        title="Permanently Delete Sheet"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Confirm Dialogs */}
            <ConfirmDialog
                open={confirmRestoreOpen}
                onClose={() => !actionLoading && setConfirmRestoreOpen(false)}
                onConfirm={handleRestore}
                title={`Restore Soft-Deleted ${activeTab === 'clients' ? 'Client' : 'Sheet/Task'}`}
                message={
                    activeTab === 'clients'
                        ? `Are you sure you want to restore "${selectedItem?.name}"? Doing so will recover the client record and any associated soft-deleted sheets.`
                        : `Are you sure you want to restore this sheet/task? It will recover the sheet and all its related subtasks.`
                }
                confirmLabel={actionLoading ? "Restoring..." : "Restore Data"}
                disabled={actionLoading}
            />

            <ConfirmDialog
                open={confirmDeleteOpen}
                onClose={() => !actionLoading && setConfirmDeleteOpen(false)}
                onConfirm={handleDeletePermanently}
                title={`PERMANENTLY DELETE ${activeTab === 'clients' ? 'Client' : 'Sheet/Task'}`}
                message={`CRITICAL WARNING: This action CANNOT BE UNDONE. This will permanently purge "${selectedItem?.name || selectedItem?.client_name}" and all associated data, logs, and subtasks from the database forever.`}
                confirmLabel={actionLoading ? "Purging..." : "Delete Permanently"}
                danger
                disabled={actionLoading}
            />
        </div>
    )
}
