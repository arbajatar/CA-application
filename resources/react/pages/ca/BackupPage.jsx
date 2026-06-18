import { useState, useEffect } from 'react';
import { Database, Download, Upload, AlertTriangle, CheckCircle, RefreshCw, Clock, User, FileText, Eye, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function BackupPage() {
    const [restoring, setRestoring] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Preview SQL Backup state
    const [previewing, setPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Backup Name Input state
    const [showBackupNameModal, setShowBackupNameModal] = useState(false);
    const [backupByName, setBackupByName] = useState('');
    const [restoreByName, setRestoreByName] = useState('');

    const fetchBackupLogs = async () => {
        setLoadingLogs(true);
        try {
            const response = await api.get('/ca/backup/logs');
            setLogs(response.data.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load backup logs.');
        } finally {
            setLoadingLogs(false);
        }
    };

    const handlePreview = () => {
        if (!selectedFile) return;
        setPreviewing(true);
        setSearchTerm('');
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split('\n');
                const tableMap = {};

                const createTableRegex = /CREATE\s+TABLE\s+`([^`]+)`/i;
                const insertIntoRegex = /INSERT\s+INTO\s+`([^`]+)`/i;

                for (let line of lines) {
                    line = line.trim();
                    if (!line) continue;

                    const createMatch = line.match(createTableRegex);
                    if (createMatch) {
                        const tableName = createMatch[1];
                        if (!tableMap[tableName]) {
                            tableMap[tableName] = { hasCreate: true, rowCount: 0 };
                        } else {
                            tableMap[tableName].hasCreate = true;
                        }
                        continue;
                    }

                    const insertMatch = line.match(insertIntoRegex);
                    if (insertMatch) {
                        const tableName = insertMatch[1];
                        if (!tableMap[tableName]) {
                            tableMap[tableName] = { hasCreate: false, rowCount: 1 };
                        } else {
                            tableMap[tableName].rowCount += 1;
                        }
                    }
                }

                const data = Object.keys(tableMap).map(tableName => ({
                    table: tableName,
                    rows: tableMap[tableName].rowCount
                })).sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));

                setPreviewData(data);
                setShowPreviewModal(true);
            } catch (err) {
                console.error(err);
                toast.error('Error parsing SQL backup file contents.');
            } finally {
                setPreviewing(false);
            }
        };
        reader.onerror = () => {
            toast.error('Failed to read SQL backup file.');
            setPreviewing(false);
        };
        reader.readAsText(selectedFile);
    };

    useEffect(() => {
        fetchBackupLogs();
    }, []);

    const triggerBackupRequest = () => {
        setBackupByName('');
        setShowBackupNameModal(true);
    };

    const handleBackupSubmit = async (e) => {
        e.preventDefault();
        if (!backupByName.trim()) {
            toast.error('Please enter the name of the person performing the backup.');
            return;
        }
        setShowBackupNameModal(false);
        setBackingUp(true);
        const loadingToast = toast.loading('Initiating database backup download...');
        try {
            const token = localStorage.getItem('token');
            const backupByEscaped = encodeURIComponent(backupByName.trim());
            const downloadUrl = `/api/ca/backup/export?backup_by=${backupByEscaped}&token=${token}`;
            
            // Trigger native browser download directly
            window.location.href = downloadUrl;
            
            toast.success('Database backup download initiated!', { id: loadingToast });
            
            // Re-fetch logs after a short delay to allow the server to write the log entry
            setTimeout(() => {
                fetchBackupLogs();
            }, 3000);
        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate database backup.', { id: loadingToast });
        } finally {
            setBackingUp(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.name.endsWith('.sql')) {
                toast.error('Please select a valid .sql backup file.');
                return;
            }
            setSelectedFile(file);
        }
    };

    const handleRestoreSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!selectedFile) return;
        if (!restoreByName.trim()) {
            toast.error('Please enter your name to proceed with restore.');
            return;
        }
        setRestoring(true);
        setShowConfirmModal(false);
        const loadingToast = toast.loading('Restoring database... Please do not close this window.');
        
        const formData = new FormData();
        formData.append('sql_file', selectedFile);
        formData.append('restore_by', restoreByName.trim());

        try {
            await api.post('/ca/backup/restore', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success('Database successfully restored!', { id: loadingToast, duration: 6000 });
            setSelectedFile(null);
            setRestoreByName('');
            // Re-fetch logs to reflect the updated database state
            fetchBackupLogs();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to restore database backup.';
            toast.error(msg, { id: loadingToast, duration: 6000 });
        } finally {
            setRestoring(false);
        }
    };

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

    return (
        <div className="space-y-6 w-full pb-12 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Database className="text-[#1F5C99] w-6 h-6" />
                    <span>Database Backup & Restore</span>
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                    Manage system backups. Export all tables to a SQL file or restore database to a previous state.
                </p>
            </div>

            {/* Warning Info */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3.5 items-start shadow-sm w-full">
                <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-xs font-black uppercase text-amber-800 tracking-wider">Security & Operations Notice</h3>
                    <p className="text-xs text-amber-700 font-semibold mt-1 leading-relaxed">
                        This utility is restricted for administration purposes only. Performing a restore will completely overwrite all existing database entries, tables, tasks, audit logs, and settings. Ensure you have downloaded a fresh backup before performing any restore actions.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Backup Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[280px] h-auto">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#1F5C99] mb-4">
                            <Download size={22} />
                        </div>
                        <h2 className="text-base font-bold text-slate-800">Export SQL Backup</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed">
                            Generate and download a complete dump of the database. This includes tables structure and all table entries. Safely store this file as a restore point.
                        </p>
                    </div>
                    
                    <button
                        onClick={triggerBackupRequest}
                        disabled={backingUp}
                        className="mt-6 flex items-center justify-center gap-2 w-full bg-[#1F5C99] hover:bg-[#154673] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-3 px-4 rounded-xl transition duration-150 active:scale-98 shadow-sm cursor-pointer"
                    >
                        {backingUp ? (
                            <>
                                <RefreshCw className="animate-spin w-4 h-4" />
                                <span>Generating Backup...</span>
                            </>
                        ) : (
                            <>
                                <Download size={14} />
                                <span>Download SQL Backup</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Restore Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[280px] h-auto">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4">
                            <Upload size={22} />
                        </div>
                        <h2 className="text-base font-bold text-slate-800">Restore SQL Backup</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed">
                            Upload a previously generated <span className="font-extrabold text-slate-500">.sql</span> backup file to restore the entire database.
                        </p>

                        <div className="mt-4">
                            <label className="flex items-center justify-center border border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-3 cursor-pointer transition text-xs font-semibold text-slate-600 gap-2">
                                <Upload size={14} className="text-slate-400" />
                                <span>{selectedFile ? selectedFile.name : 'Select .sql File'}</span>
                                <input
                                    type="file"
                                    accept=".sql"
                                    onChange={handleFileChange}
                                    className="hidden"
                                    disabled={restoring}
                                />
                            </label>
                        </div>

                        {selectedFile && (
                            <button
                                onClick={handlePreview}
                                disabled={previewing || restoring}
                                className="mt-4 flex items-center justify-center gap-2 w-full bg-[#1F5C99]/10 hover:bg-[#1F5C99]/20 text-[#1F5C99] font-bold text-xs py-3 px-4 rounded-xl transition duration-150 active:scale-98 cursor-pointer"
                            >
                                {previewing ? (
                                    <>
                                        <RefreshCw className="animate-spin w-4 h-4" />
                                        <span>Reading File...</span>
                                    </>
                                ) : (
                                    <>
                                        <Eye size={14} />
                                        <span>Preview Backup Contents</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => selectedFile && setShowConfirmModal(true)}
                        disabled={!selectedFile || restoring}
                        className="mt-6 flex items-center justify-center gap-2 w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs py-3 px-4 rounded-xl transition duration-150 active:scale-98 shadow-sm cursor-pointer"
                    >
                        {restoring ? (
                            <>
                                <RefreshCw className="animate-spin w-4 h-4" />
                                <span>Restoring Database...</span>
                            </>
                        ) : (
                            <>
                                <Database size={14} />
                                <span>Restore Database</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Backup Logs / History Section */}
            <div className="w-full space-y-4">
                <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <Clock className="text-[#1F5C99] w-5 h-5" />
                    <span>Backup Download History</span>
                </h2>
                
                <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden w-full">
                    {loadingLogs ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <RefreshCw className="animate-spin text-[#1F5C99] w-6 h-6" />
                            <span className="text-xs font-semibold text-slate-400 mt-2">Loading history...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-350 mb-2 border border-slate-100">
                                <Database size={20} />
                            </div>
                            <h3 className="text-xs font-bold text-slate-700">No Backup Records</h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Database backups have not been logged yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150">
                                        <th className="px-6 py-3 w-[160px]">Timestamp</th>
                                        <th className="px-6 py-3 w-[100px]">Action</th>
                                        <th className="px-6 py-3">Filename</th>
                                        <th className="px-6 py-3 w-[100px]">Size</th>
                                        <th className="px-6 py-3 w-[180px]">Performed By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-655">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/40 transition">
                                            <td className="px-6 py-3.5 text-slate-450 font-mono text-[11px]">
                                                {formatDate(log.created_at)}
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${log.action === 'restore' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                                                    {log.action || 'backup'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-[#1F5C99]" />
                                                    <span>{log.filename}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px]">
                                                {log.file_size || '—'}
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    <span className="font-bold text-slate-700">{log.backup_by || log.user_name || 'System / Seed'}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4">
                    <form onSubmit={handleRestoreSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
                        <div className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle size={24} className="shrink-0" />
                            <h3 className="text-base font-bold">Confirm Database Overwrite</h3>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                            Are you absolutely sure you want to restore <span className="font-mono text-slate-800 font-extrabold bg-slate-100 px-1 py-0.5 rounded">{selectedFile?.name}</span>? This will permanently delete and overwrite all current database tables and their entries.
                        </p>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Your Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={restoreByName}
                                onChange={e => setRestoreByName(e.target.value)}
                                placeholder="e.g. Shreyas Gijare"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-gray-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition-all"
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setRestoreByName('');
                                }}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Confirm Restore
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-scale-up max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-[#1F5C99]">
                                <Database size={22} className="shrink-0" />
                                <div>
                                    <h3 className="text-base font-bold text-slate-800">Backup File Analysis</h3>
                                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">{selectedFile?.name}</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowPreviewModal(false)}
                                className="text-slate-400 hover:text-slate-655 font-bold text-lg p-1 hover:bg-slate-100 rounded-lg w-8 h-8 flex items-center justify-center transition"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Tables</span>
                                <span className="text-2xl font-black text-slate-800 mt-1">{previewData.length}</span>
                            </div>
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col">
                                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Total Rows to Restore</span>
                                <span className="text-2xl font-black text-[#1F5C99] mt-1">
                                    {previewData.reduce((sum, item) => sum + item.rows, 0).toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search tables..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-gray-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition-all"
                            />
                        </div>

                        {/* Tables List */}
                        <div className="flex-1 overflow-y-auto border border-slate-150 rounded-2xl">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150 sticky top-0">
                                        <th className="px-5 py-2.5">Table Name</th>
                                        <th className="px-5 py-2.5 w-[150px] text-right">Rows to Restore</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                                    {previewData.filter(item => item.table.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                                        <tr>
                                            <td colSpan={2} className="px-5 py-6 text-center text-slate-400 font-medium">
                                                No tables match your search.
                                            </td>
                                        </tr>
                                    ) : (
                                        previewData
                                            .filter(item => item.table.toLowerCase().includes(searchTerm.toLowerCase()))
                                            .map((item) => (
                                                <tr key={item.table} className="hover:bg-slate-50/40 transition">
                                                    <td className="px-5 py-3 font-mono text-slate-800">
                                                        {item.table}
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${item.rows > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                            {item.rows.toLocaleString()} rows
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Close Preview
                            </button>
                            <button
                                onClick={() => {
                                    setShowPreviewModal(false);
                                    setShowConfirmModal(true);
                                }}
                                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                            >
                                <Database size={13} />
                                <span>Proceed to Restore</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Backup Creator Name Modal (Mandatory) */}
            {showBackupNameModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999999] p-4">
                    <form onSubmit={handleBackupSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
                        <div className="flex items-center gap-2 text-[#1F5C99]">
                            <Download size={22} className="shrink-0" />
                            <h3 className="text-base font-bold text-slate-800">Database Export Authorization</h3>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                            Please enter your name to authorize and log this database export. This is required for security and audit history.
                        </p>
                        
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Your Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                required
                                value={backupByName}
                                onChange={e => setBackupByName(e.target.value)}
                                placeholder="e.g. Shreyas Gijare"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-gray-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition-all"
                            />
                        </div>

                        <div className="flex gap-3 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowBackupNameModal(false)}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-655 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2.5 bg-[#1F5C99] hover:bg-[#154673] text-white rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Generate & Download
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
