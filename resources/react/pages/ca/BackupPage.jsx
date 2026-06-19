import { useState, useEffect } from 'react';
import { Database, Download, Upload, AlertTriangle, CheckCircle, RefreshCw, Clock, User, FileText, Eye, Search, Settings as SettingsIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function BackupPage() {
    const [restoring, setRestoring] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);

    // Auto Backup Settings state
    const [settings, setSettings] = useState({
        auto_backup_enabled: false,
        frequency: 'daily',
        time: '02:00',
        keep_backups_days: 7,
        day_of_week: 0,
        day_of_month: 1,
        month_of_year: 1
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);

    // Selected Saved Backup log for restore state
    const [selectedSavedLog, setSelectedSavedLog] = useState(null);

    // Preview SQL Backup state
    const [previewing, setPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Backup Name Input state
    const [showBackupNameModal, setShowBackupNameModal] = useState(false);
    const [backupByName, setBackupByName] = useState('');
    const [restoreByName, setRestoreByName] = useState('');

    const fetchBackupSettings = async () => {
        setLoadingSettings(true);
        try {
            const response = await api.get('/ca/backup/settings');
            if (response.data.data) {
                setSettings({
                    auto_backup_enabled: !!response.data.data.auto_backup_enabled,
                    frequency: response.data.data.frequency || 'daily',
                    time: response.data.data.time || '02:00',
                    keep_backups_days: response.data.data.keep_backups_days || 7,
                    day_of_week: response.data.data.day_of_week || 0,
                    day_of_month: response.data.data.day_of_month || 1,
                    month_of_year: response.data.data.month_of_year || 1
                });
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load backup settings.');
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        const loadingToast = toast.loading('Saving backup settings...');
        try {
            await api.post('/ca/backup/settings', settings);
            toast.success('Backup settings updated successfully!', { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error('Failed to update backup settings.', { id: loadingToast });
        } finally {
            setSavingSettings(false);
        }
    };

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

    const handlePreviewSaved = async (log) => {
        if (previewing) return;
        setPreviewing(true);
        setSelectedSavedLog(log);
        setSelectedFile(null);
        setSearchTerm('');
        const loadingToast = toast.loading('Analyzing saved backup file...');
        try {
            const response = await api.get(`/ca/backup/preview-saved/${log.id}`);
            setPreviewData(response.data.data || []);
            setShowPreviewModal(true);
            toast.success('Backup file analyzed successfully!', { id: loadingToast });
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to read saved backup file.';
            toast.error(msg, { id: loadingToast });
        } finally {
            setPreviewing(false);
        }
    };

    useEffect(() => {
        fetchBackupLogs();
        fetchBackupSettings();
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
            setSelectedSavedLog(null); // Clear selected saved log if a physical file is chosen
        }
    };

    const handleDownloadSaved = (log) => {
        const token = localStorage.getItem('token');
        window.location.href = `/api/ca/backup/download/${log.id}?token=${token}`;
    };

    const handleRestoreSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!selectedFile && !selectedSavedLog) return;
        if (!restoreByName.trim()) {
            toast.error('Please enter your name to proceed with restore.');
            return;
        }
        setRestoring(true);
        setShowConfirmModal(false);
        const loadingToast = toast.loading('Restoring database... Please do not close this window.');
        
        try {
            if (selectedFile) {
                const formData = new FormData();
                formData.append('sql_file', selectedFile);
                formData.append('restore_by', restoreByName.trim());

                await api.post('/ca/backup/restore', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else if (selectedSavedLog) {
                await api.post(`/ca/backup/restore-saved/${selectedSavedLog.id}`, {
                    restore_by: restoreByName.trim()
                });
            }
            
            toast.success('Database successfully restored!', { id: loadingToast, duration: 6000 });
            setSelectedFile(null);
            setSelectedSavedLog(null);
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
            const utcString = dateStr.includes('T') || dateStr.includes('Z') || dateStr.includes('+')
                ? dateStr
                : dateStr.replace(' ', 'T') + 'Z';
            const d = new Date(utcString);
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

    const getScheduleDescription = () => {
        const { frequency, time, day_of_week, day_of_month, month_of_year } = settings;
        const timeStr = time || '02:00';
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const getOrdinal = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        switch (frequency) {
            case 'minutely':
                return 'Backup runs automatically every single minute.';
            case 'hourly': {
                const min = timeStr.split(':')[1] || '00';
                return `Backup runs at minute ${min} of every hour.`;
            }
            case 'daily':
                return `Backup runs every day at ${timeStr} (IST).`;
            case 'weekly': {
                const dayName = dayNames[day_of_week] || 'Sunday';
                return `Backup runs every ${dayName} at ${timeStr} (IST).`;
            }
            case 'monthly': {
                const ordinalDay = getOrdinal(day_of_month || 1);
                return `Backup runs on the ${ordinalDay} of every month at ${timeStr} (IST).`;
            }
            case 'quarterly': {
                const startMonth = month_of_year || 1;
                const ordinalDay = getOrdinal(day_of_month || 1);
                const months = [
                    monthNames[startMonth - 1],
                    monthNames[(startMonth - 1 + 3) % 12],
                    monthNames[(startMonth - 1 + 6) % 12],
                    monthNames[(startMonth - 1 + 9) % 12]
                ];
                return `Backup runs on the ${ordinalDay} of: ${months.join(', ')} at ${timeStr} (IST).`;
            }
            case 'half_yearly': {
                const startMonth = month_of_year || 1;
                const ordinalDay = getOrdinal(day_of_month || 1);
                const months = [
                    monthNames[startMonth - 1],
                    monthNames[(startMonth - 1 + 6) % 12]
                ];
                return `Backup runs on the ${ordinalDay} of: ${months.join(', ')} at ${timeStr} (IST).`;
            }
            case 'yearly': {
                const ordinalDay = getOrdinal(day_of_month || 1);
                const monthName = monthNames[month_of_year - 1] || 'January';
                return `Backup runs on the ${ordinalDay} of ${monthName} every year at ${timeStr} (IST).`;
            }
            default:
                return '';
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full animate-fade-in">
                {/* Backup Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] h-auto">
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
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] h-auto">
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

                {/* Auto Backup Settings Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[300px] h-auto">
                    <div>
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-4">
                            <SettingsIcon size={22} />
                        </div>
                        <h2 className="text-base font-bold text-slate-800">Auto Backup Settings</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed">
                            Configure automatic scheduled backups. Database is backed up automatically and stored on the server.
                        </p>

                        {loadingSettings ? (
                            <div className="flex items-center justify-center py-6">
                                <RefreshCw className="animate-spin text-amber-600 w-5 h-5" />
                            </div>
                        ) : (
                            <form onSubmit={handleSaveSettings} className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-655">Enable Auto Backup</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={settings.auto_backup_enabled}
                                            onChange={(e) => setSettings({...settings, auto_backup_enabled: e.target.checked})}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1F5C99]"></div>
                                    </label>
                                </div>

                                 {settings.auto_backup_enabled && (
                                     <div className="space-y-3 mt-4 border-t border-slate-100 pt-3">
                                         <div className="space-y-0.5">
                                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Frequency</label>
                                             <select
                                                 value={settings.frequency}
                                                 onChange={(e) => setSettings({...settings, frequency: e.target.value})}
                                                 className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                             >
                                                 <option value="minutely">Every Minute</option>
                                                 <option value="hourly">Hourly</option>
                                                 <option value="daily">Daily</option>
                                                 <option value="weekly">Weekly</option>
                                                 <option value="monthly">Monthly</option>
                                                 <option value="quarterly">Quarterly</option>
                                                 <option value="half_yearly">Half Yearly</option>
                                                 <option value="yearly">Yearly</option>
                                             </select>
                                         </div>

                                         {settings.frequency !== 'minutely' && (
                                             <div className="grid grid-cols-2 gap-2">
                                                 {/* Day of Week for Weekly */}
                                                 {settings.frequency === 'weekly' && (
                                                     <div className="space-y-0.5">
                                                         <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Day of Week</label>
                                                         <select
                                                             value={settings.day_of_week}
                                                             onChange={(e) => setSettings({...settings, day_of_week: parseInt(e.target.value)})}
                                                             className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                         >
                                                             <option value={0}>Sunday</option>
                                                             <option value={1}>Monday</option>
                                                             <option value={2}>Tuesday</option>
                                                             <option value={3}>Wednesday</option>
                                                             <option value={4}>Thursday</option>
                                                             <option value={5}>Friday</option>
                                                             <option value={6}>Saturday</option>
                                                         </select>
                                                     </div>
                                                 )}

                                                 {/* Day of Month for Monthly / Quarterly / Half-Yearly / Yearly */}
                                                 {['monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.frequency) && (
                                                     <div className="space-y-0.5">
                                                         <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Day of Month</label>
                                                         <input
                                                             type="number"
                                                             min="1"
                                                             max="31"
                                                             value={settings.day_of_month}
                                                             onChange={(e) => {
                                                                 const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                                                                 setSettings({...settings, day_of_month: val});
                                                             }}
                                                             className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                         />
                                                     </div>
                                                 )}

                                                 {/* Month Choice for Quarterly / Half-Yearly / Yearly */}
                                                 {['quarterly', 'half_yearly', 'yearly'].includes(settings.frequency) && (
                                                     <div className="space-y-0.5">
                                                         <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                             {settings.frequency === 'yearly' ? 'Month of Year' : 'Start Month'}
                                                         </label>
                                                         <select
                                                             value={settings.month_of_year}
                                                             onChange={(e) => setSettings({...settings, month_of_year: parseInt(e.target.value)})}
                                                             className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                         >
                                                             <option value={1}>January</option>
                                                             <option value={2}>February</option>
                                                             <option value={3}>March</option>
                                                             {settings.frequency !== 'quarterly' && (
                                                                 <>
                                                                     <option value={4}>April</option>
                                                                     <option value={5}>May</option>
                                                                     <option value={6}>June</option>
                                                                 </>
                                                             )}
                                                             {settings.frequency === 'yearly' && (
                                                                 <>
                                                                     <option value={7}>July</option>
                                                                     <option value={8}>August</option>
                                                                     <option value={9}>September</option>
                                                                     <option value={10}>October</option>
                                                                     <option value={11}>November</option>
                                                                     <option value={12}>December</option>
                                                                 </>
                                                             )}
                                                         </select>
                                                     </div>
                                                 )}

                                                 {/* Minute Input for Hourly */}
                                                 {settings.frequency === 'hourly' && (
                                                     <div className="col-span-2 space-y-0.5">
                                                         <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Backup Minute (0-59)</label>
                                                         <input
                                                             type="number"
                                                             min="0"
                                                             max="59"
                                                             value={parseInt(settings.time.split(':')[1]) || 0}
                                                             onChange={(e) => {
                                                                 const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                                                 const formattedMinute = String(val).padStart(2, '0');
                                                                 setSettings({...settings, time: `00:${formattedMinute}`});
                                                             }}
                                                             className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                         />
                                                     </div>
                                                 )}

                                                 {/* Time Input for Daily / Weekly / Monthly / Quarterly / Half-Yearly / Yearly */}
                                                 {settings.frequency !== 'hourly' && (
                                                     <div className={['daily', 'quarterly', 'half_yearly', 'yearly'].includes(settings.frequency) ? "col-span-2 space-y-0.5" : "space-y-0.5"}>
                                                         <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Backup Time</label>
                                                         <input
                                                             type="time"
                                                             value={settings.time}
                                                             onChange={(e) => setSettings({...settings, time: e.target.value})}
                                                             className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                         />
                                                     </div>
                                                 )}
                                             </div>
                                         )}
                                        {getScheduleDescription() && (
                                            <p className="text-[9px] text-[#1F5C99] font-bold mt-1">
                                                * {getScheduleDescription()}
                                            </p>
                                        )}

                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                                                {['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.frequency)
                                                    ? 'Retention (Backups to Keep)'
                                                    : 'Retention Period (Days)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={settings.keep_backups_days}
                                                onChange={(e) => setSettings({...settings, keep_backups_days: parseInt(e.target.value) || 7})}
                                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-gray-800 focus:outline-none"
                                                placeholder={['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.frequency)
                                                     ? 'e.g. 3 backups'
                                                     : 'e.g. 7 days'}
                                            />
                                        </div>
                                     </div>
                                 )}
                            </form>
                        )}
                    </div>

                    <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings || loadingSettings}
                        className="mt-6 flex items-center justify-center gap-2 w-full bg-amber-600 hover:bg-amber-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs py-3 px-4 rounded-xl transition duration-150 active:scale-98 shadow-sm cursor-pointer"
                    >
                        {savingSettings ? (
                            <>
                                <RefreshCw className="animate-spin w-4 h-4" />
                                <span>Saving Settings...</span>
                            </>
                        ) : (
                            <>
                                <SettingsIcon size={14} />
                                <span>Save Settings</span>
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
                        <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-150">
                                        <th className="px-6 py-3 w-[160px]">Timestamp</th>
                                        <th className="px-6 py-3 w-[100px]">Action</th>
                                        <th className="px-6 py-3">Filename</th>
                                        <th className="px-6 py-3 w-[100px]">Size</th>
                                        <th className="px-6 py-3 w-[180px]">Performed By</th>
                                        <th className="px-6 py-3 w-[180px] text-right">Actions</th>
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
                                            <td className="px-6 py-3.5 text-right whitespace-nowrap">
                                                {log.filename.startsWith('backups/') && (
                                                    log.file_exists ? (
                                                        <div className="inline-flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => handleDownloadSaved(log)}
                                                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 w-[88px] bg-[#1F5C99]/10 hover:bg-[#1F5C99]/20 text-[#1F5C99] font-extrabold text-[11px] rounded-lg transition cursor-pointer"
                                                                title="Download backup file from server"
                                                            >
                                                                <Download size={12} />
                                                                <span>Download</span>
                                                            </button>
                                                            {log.action === 'backup' && (
                                                                <button
                                                                    onClick={() => handlePreviewSaved(log)}
                                                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 w-[88px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-[11px] rounded-lg transition cursor-pointer"
                                                                    title="Restore database using this backup file"
                                                                >
                                                                    <RefreshCw size={12} />
                                                                    <span>Restore</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-400 italic bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                            Cleaned Up
                                                        </span>
                                                    )
                                                )}
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
                            Are you absolutely sure you want to restore <span className="font-mono text-slate-800 font-extrabold bg-slate-100 px-1 py-0.5 rounded">{selectedFile ? selectedFile.name : (selectedSavedLog ? selectedSavedLog.filename.replace('backups/', '') : '')}</span>? This will permanently delete and overwrite all current database tables and their entries.
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
