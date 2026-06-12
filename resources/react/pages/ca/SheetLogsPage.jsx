import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Search, User, ClipboardList, Info, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/ui/Spinner';

export default function SheetLogsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const taskParam = searchParams.get('task_id') || '';

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    const [sheets, setSheets] = useState([]);
    const [selectedTaskId, setSelectedTaskId] = useState(taskParam);

    const fetchLogs = useCallback(async (page = 1, taskId = selectedTaskId) => {
        setLoading(true);
        try {
            const res = await api.get('/ca/tasks/sheet-logs', {
                params: { 
                    page,
                    task_id: taskId || undefined
                }
            });
            const data = res.data;
            setLogs(data.data || []);
            setCurrentPage(data.current_page || 1);
            setTotalPages(data.last_page || 1);
            setTotalLogs(data.total || 0);
        } catch (e) {
            toast.error('Failed to load sheet audit logs');
        } finally {
            setLoading(false);
        }
    }, [selectedTaskId]);

    useEffect(() => {
        const fetchSheets = async () => {
            try {
                const res = await api.get('/ca/tasks', { params: { per_page: 'all' } });
                setSheets(res.data.data || res.data || []);
            } catch (e) {
                console.error("Failed to fetch sheets list", e);
            }
        };
        fetchSheets();
    }, []);

    useEffect(() => {
        setSelectedTaskId(taskParam);
        setCurrentPage(1);
    }, [taskParam]);

    useEffect(() => {
        fetchLogs(currentPage, selectedTaskId);
    }, [currentPage, selectedTaskId, fetchLogs]);

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        try {
            const d = new Date(dateStr);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (e) {
            return dateStr;
        }
    };

    const getActionBadge = (action) => {
        let bg = 'bg-slate-50 border-slate-200 text-slate-700';
        let label = action || 'change';
        if (action === 'row_added') {
            bg = 'bg-emerald-50 border-emerald-200 text-emerald-700';
            label = 'Row Added';
        } else if (action === 'row_deleted') {
            bg = 'bg-rose-50 border-rose-200 text-rose-700';
            label = 'Row Deleted';
        } else if (action === 'row_updated') {
            bg = 'bg-blue-50 border-blue-200 text-blue-700';
            label = 'Row Updated';
        } else if (action === 'bulk_update') {
            bg = 'bg-amber-50 border-amber-200 text-amber-700';
            label = 'Bulk Changes';
        }
        return (
            <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${bg}`}>
                {label}
            </span>
        );
    };

    // Client-side search filters
    const filteredLogs = logs.filter(log => {
        const query = searchQuery.toLowerCase();
        const sheet = (log.sheet_name || '').toLowerCase();
        const user = (log.user_name || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        
        let detailsStr = '';
        if (Array.isArray(log.details)) {
            detailsStr = log.details.map(d => d.message).join(' ').toLowerCase();
        } else if (typeof log.details === 'string') {
            detailsStr = log.details.toLowerCase();
        } else if (log.details) {
            detailsStr = JSON.stringify(log.details).toLowerCase();
        }

        return sheet.includes(query) || user.includes(query) || action.includes(query) || detailsStr.includes(query);
    });

    return (
        <div className="space-y-6 max-w-[100vw] pb-12 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Clock className="text-[#1F5C99] w-6 h-6" />
                    <span>Sheet Change Audit Logs</span>
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                    Track all row insertions, deletions, reallocations, and inline cell changes on task sheets.
                </p>
            </div>

            {/* Actions Grid */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm justify-between">
                <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
                    <div className="relative flex-1 w-full max-w-lg">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search logs by sheet name, user, field changes..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-semibold text-slate-700 placeholder-slate-400"
                        />
                    </div>
                    
                    <div className="w-full sm:w-64 shrink-0">
                        <select
                            value={selectedTaskId}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedTaskId(val);
                                setSearchParams(val ? { task_id: val } : {});
                                setCurrentPage(1);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 transition cursor-pointer"
                        >
                            <option value="">— Filter by Sheet —</option>
                            {sheets.map(sheet => (
                                <option key={sheet.id} value={sheet.id}>
                                    {sheet.form_name || `Sheet #${sheet.id}`} {sheet.client?.name ? `(${sheet.client.name})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedTaskId && (
                        <button
                            onClick={() => {
                                setSelectedTaskId('');
                                setSearchParams({});
                                setCurrentPage(1);
                            }}
                            className="text-xs font-black text-rose-600 hover:text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 transition shrink-0 cursor-pointer"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
                <div className="text-xs text-slate-450 font-bold shrink-0">
                    Total: {totalLogs} logs logged
                </div>
            </div>

            {/* List Table Content */}
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden min-h-[400px] flex flex-col justify-between">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20">
                        <Spinner size="lg" />
                        <span className="text-xs font-semibold text-slate-400 mt-3">Loading audit logs...</span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4 border border-slate-100">
                            <ClipboardList size={28} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">No Change Logs Found</h3>
                        <p className="text-xs text-slate-400 max-w-sm mt-1">
                            {searchQuery ? 'No audit logs match your search filter.' : 'No sheet row modifications have been logged yet.'}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150">
                                    <th className="px-6 py-4 w-[160px]">Timestamp</th>
                                    <th className="px-6 py-4 w-[200px]">Sheet Name</th>
                                    <th className="px-6 py-4 w-[140px]">Action</th>
                                    <th className="px-6 py-4 w-[150px]">Changed By</th>
                                    <th className="px-6 py-4">Changes Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50/50 transition align-top">
                                        <td className="px-6 py-4 text-slate-450 font-mono text-[11px] whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                <FileText className="w-3.5 h-3.5 text-[#1F5C99]" />
                                                <span>{log.sheet_name || `Task #${log.task_id}`}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <User className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="font-bold text-slate-700">{log.user_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                {Array.isArray(log.details) ? (
                                                    log.details.map((detail, idx) => (
                                                        <div key={idx} className="flex items-start gap-1 text-[11px] font-bold text-slate-655 bg-slate-50/60 px-2.5 py-1 rounded-lg border border-slate-100/80">
                                                            <Info size={12} className="text-[#1F5C99] shrink-0 mt-0.5" />
                                                            <span>{detail.message}</span>
                                                        </div>
                                                    ))
                                                ) : typeof log.details === 'string' ? (
                                                    <div className="text-[11px] font-bold text-slate-655">{log.details}</div>
                                                ) : (
                                                    <div className="text-[11px] text-slate-400 italic">No detailed changes recorded.</div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && !loading && (
                    <div className="flex items-center justify-between border-t border-slate-150 px-6 py-4 bg-slate-50">
                        <div className="text-xs font-semibold text-slate-500">
                            Page <span className="font-bold text-slate-800">{currentPage}</span> of <span className="font-bold text-slate-800">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                            >
                                <ChevronLeft size={14} /> Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
