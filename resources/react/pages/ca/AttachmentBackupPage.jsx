import { useState, useEffect } from 'react';
import { Download, AlertTriangle, RefreshCw, Clock, User, FileText, Trash2, Settings, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function AttachmentBackupPage() {
    const [backingUp, setBackingUp] = useState(false);
    const [logs, setLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(true);
    const [showBackupNameModal, setShowBackupNameModal] = useState(false);
    const [backupByName, setBackupByName] = useState('');

    // Auto Backup Settings state
    const [settings, setSettings] = useState({
        att_auto_backup_enabled: false,
        att_frequency: 'daily',
        att_time: '02:00',
        att_keep_backups_days: 7,
        att_day_of_week: 0,
        att_day_of_month: 1,
        att_month_of_year: 1,
        att_s3_backup_enabled: false,
        att_s3_frequency: 'daily',
        att_s3_time: '02:00',
        att_s3_keep_backups_days: 7,
        att_s3_day_of_week: 0,
        att_s3_day_of_month: 1,
        att_s3_month_of_year: 1
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [activeTab, setActiveTab] = useState('local'); // 'local' or 's3'

    const fetchBackupSettings = async () => {
        setLoadingSettings(true);
        try {
            const response = await api.get('/ca/attachment-backup/settings');
            if (response.data.data) {
                setSettings(response.data.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load attachment backup settings.');
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        const loadingToast = toast.loading('Saving attachment backup settings...');
        const payload = {
            ...settings,
            att_day_of_month: settings.att_frequency === 'minutely' && (settings.att_day_of_month === '' || !settings.att_day_of_month)
                ? 1
                : settings.att_day_of_month,
            att_s3_day_of_month: settings.att_s3_frequency === 'minutely' && (settings.att_s3_day_of_month === '' || !settings.att_s3_day_of_month)
                ? 1
                : settings.att_s3_day_of_month
        };
        try {
            await api.post('/ca/attachment-backup/settings', payload);
            toast.success('Backup settings updated successfully!', { id: loadingToast });
            // Sync frontend state if it was defaulted to 1
            if (settings.att_frequency === 'minutely' && (settings.att_day_of_month === '' || !settings.att_day_of_month)) {
                setSettings(prev => ({ ...prev, att_day_of_month: 1 }));
            }
            if (settings.att_s3_frequency === 'minutely' && (settings.att_s3_day_of_month === '' || !settings.att_s3_day_of_month)) {
                setSettings(prev => ({ ...prev, att_s3_day_of_month: 1 }));
            }
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
            const response = await api.get('/ca/attachment-backup/logs');
            setLogs(response.data.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load attachment backup logs.');
        } finally {
            setLoadingLogs(false);
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
        const loadingToast = toast.loading('Initiating attachment zip backup...');
        try {
            const token = localStorage.getItem('token');
            const backupByEscaped = encodeURIComponent(backupByName.trim());
            const downloadUrl = `/api/ca/attachment-backup/export?backup_by=${backupByEscaped}&token=${token}`;
            
            // Trigger native browser download directly
            window.location.href = downloadUrl;
            
            toast.success('Attachment backup download initiated!', { id: loadingToast });
            
            // Re-fetch logs after a short delay to allow the server to complete zipping and write the log
            setTimeout(() => {
                fetchBackupLogs();
            }, 5000);
        } catch (error) {
            console.error(error);
            toast.error('Failed to initiate attachment backup.', { id: loadingToast });
        } finally {
            setBackingUp(false);
        }
    };

    const handleDownloadSaved = async (log) => {
        const loadingToast = toast.loading('Initiating download of saved backup...');
        try {
            const token = localStorage.getItem('token');
            const downloadUrl = `/api/ca/attachment-backup/download/${log.id}?token=${token}`;
            
            // Trigger native browser download directly
            window.location.href = downloadUrl;
            
            toast.success('Download started!', { id: loadingToast });
        } catch (error) {
            console.error(error);
            toast.error('Failed to download backup.', { id: loadingToast });
        }
    };

    const handleDeleteSaved = async (log) => {
        if (!window.confirm('Are you sure you want to delete this attachment backup file? This action is permanent.')) {
            return;
        }
        const loadingToast = toast.loading('Deleting saved backup...');
        try {
            await api.delete(`/ca/attachment-backup/${log.id}`);
            toast.success('Backup deleted successfully!', { id: loadingToast });
            fetchBackupLogs();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Failed to delete backup.';
            toast.error(msg, { id: loadingToast });
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

    const getScheduleDescription = (type = 'local') => {
        const isS3 = type === 's3';
        const freq = isS3 ? settings.att_s3_frequency : settings.att_frequency;
        const tm = isS3 ? (settings.att_s3_time || '02:00') : (settings.att_time || '02:00');
        const dow = isS3 ? settings.att_s3_day_of_week : settings.att_day_of_week;
        const dom = isS3 ? settings.att_s3_day_of_month : settings.att_day_of_month;
        const moy = isS3 ? settings.att_s3_month_of_year : settings.att_month_of_year;

        const timeStr = tm || '02:00';
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

        switch (freq) {
            case 'minutely': {
                const interval = dom || 1;
                return interval > 1
                    ? `Backup runs automatically every ${interval} minutes.`
                    : 'Backup runs automatically every single minute.';
            }
            case 'hourly': {
                const min = timeStr.split(':')[1] || '00';
                return `Backup runs at minute ${min} of every hour.`;
            }
            case 'daily':
                return `Backup runs every day at ${timeStr} (IST).`;
            case 'weekly': {
                const dayName = dayNames[dow] || 'Sunday';
                return `Backup runs every ${dayName} at ${timeStr} (IST).`;
            }
            case 'monthly': {
                const ordinalDay = getOrdinal(dom || 1);
                return `Backup runs on the ${ordinalDay} of every month at ${timeStr} (IST).`;
            }
            case 'quarterly': {
                const startMonth = moy || 1;
                const ordinalDay = getOrdinal(dom || 1);
                const months = [
                    monthNames[startMonth - 1],
                    monthNames[(startMonth - 1 + 3) % 12],
                    monthNames[(startMonth - 1 + 6) % 12],
                    monthNames[(startMonth - 1 + 9) % 12]
                ];
                return `Backup runs on the ${ordinalDay} of: ${months.join(', ')} at ${timeStr} (IST).`;
            }
            case 'half_yearly': {
                const startMonth = moy || 1;
                const ordinalDay = getOrdinal(dom || 1);
                const months = [
                    monthNames[startMonth - 1],
                    monthNames[(startMonth - 1 + 6) % 12]
                ];
                return `Backup runs on the ${ordinalDay} of: ${months.join(', ')} at ${timeStr} (IST).`;
            }
            case 'yearly': {
                const ordinalDay = getOrdinal(dom || 1);
                const monthName = monthNames[moy - 1] || 'January';
                return `Backup runs on the ${ordinalDay} of ${monthName} every year at ${timeStr} (IST).`;
            }
            default:
                return '';
        }
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                    <FileText className="text-[#1F5C99]" size={28} />
                    Attachment Backup Suite
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1">
                    Export all uploaded system attachments into a consolidated ZIP file and manage automated backup schedules.
                </p>
            </div>

            {/* Main Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Export Card */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between min-h-[220px] transition hover:shadow-md">
                    <div className="space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-[#1F5C99]">
                            <Download size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Export Attachments</h2>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Compresses all client files, sheet attachments, and library uploads into a single, downloadable ZIP archive. A copy is stored securely in the backup storage.
                        </p>
                    </div>
                    <button
                        onClick={triggerBackupRequest}
                        disabled={backingUp}
                        className="mt-4 flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 disabled:opacity-50"
                    >
                        {backingUp ? (
                            <>
                                <RefreshCw className="animate-spin" size={16} />
                                Zipping Attachments...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Generate & Download ZIP
                            </>
                        )}
                    </button>
                </div>

                {/* Info Card */}
                <div className="bg-[#FAFBFD] rounded-2xl p-6 border border-blue-100 shadow-sm flex flex-col justify-between min-h-[220px]">
                    <div className="space-y-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Important System Advisory</h2>
                        <ul className="text-xs text-gray-600 space-y-2 list-disc list-inside leading-relaxed">
                            <li>Attachment zipping can take several seconds depending on total file volume.</li>
                            <li>Ensure your network connection is stable during the download.</li>
                            <li>Zips are mirrored to your configured S3 backup storage bucket for redundancy.</li>
                            <li>These backups do not contain database rows, only raw uploaded files. Use the Database Backup panel to backup database tables.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Settings & Auto Backup Scheduling Section */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Settings size={18} className="text-gray-500" />
                        Automated Attachment Backup Settings
                    </h3>
                </div>

                {loadingSettings ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-[#1F5C99]" size={24} />
                        <span className="text-xs font-semibold">Loading scheduler settings...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100">
                            <button
                                type="button"
                                onClick={() => setActiveTab('local')}
                                className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                                    activeTab === 'local'
                                        ? 'border-[#1F5C99] text-[#1F5C99]'
                                        : 'border-transparent text-gray-500 hover:text-gray-750'
                                }`}
                            >
                                Local Server Storage
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('s3')}
                                className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-colors ${
                                    activeTab === 's3'
                                        ? 'border-[#1F5C99] text-[#1F5C99]'
                                        : 'border-transparent text-gray-500 hover:text-gray-750'
                                }`}
                            >
                                S3 Cloud Storage
                            </button>
                        </div>

                        {activeTab === 'local' ? (
                            <div className="space-y-4 max-w-2xl">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800">Automated Local Backups</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Periodically compress and store attachments on the server local storage.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.att_auto_backup_enabled}
                                            onChange={(e) => setSettings(prev => ({ ...prev, att_auto_backup_enabled: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1F5C99]"></div>
                                    </label>
                                </div>

                                {settings.att_auto_backup_enabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-100 rounded-xl bg-[#FAFBFD] animate-fade-in">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Backup Frequency</label>
                                            <select
                                                value={settings.att_frequency}
                                                onChange={(e) => setSettings(prev => ({ ...prev, att_frequency: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                            >
                                                <option value="minutely">Every Minute (Testing)</option>
                                                <option value="hourly">Hourly</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                                <option value="half_yearly">Half Yearly</option>
                                                <option value="yearly">Annually</option>
                                            </select>
                                        </div>

                                        {settings.att_frequency === 'minutely' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Minute Interval (1-59)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="59"
                                                    value={settings.att_day_of_month ?? ''}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        if (raw === '') {
                                                            setSettings(prev => ({ ...prev, att_day_of_month: '' }));
                                                        } else {
                                                            const parsed = parseInt(raw);
                                                            if (!isNaN(parsed)) {
                                                                const val = Math.max(1, Math.min(59, parsed));
                                                                setSettings(prev => ({ ...prev, att_day_of_month: val }));
                                                            }
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                    placeholder="e.g. 5 minutes"
                                                />
                                            </div>
                                        )}

                                        {settings.att_frequency === 'weekly' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Day of Week</label>
                                                <select
                                                    value={settings.att_day_of_week}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_day_of_week: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
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

                                        {['monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.att_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Day of Month</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={settings.att_day_of_month}
                                                    onChange={(e) => {
                                                        const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                                                        setSettings(prev => ({ ...prev, att_day_of_month: val }));
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {['quarterly', 'half_yearly', 'yearly'].includes(settings.att_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                    {settings.att_frequency === 'yearly' ? 'Month of Year' : 'Start Month'}
                                                </label>
                                                <select
                                                    value={settings.att_month_of_year}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_month_of_year: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                >
                                                    <option value={1}>January</option>
                                                    <option value={2}>February</option>
                                                    <option value={3}>March</option>
                                                    {settings.att_frequency !== 'quarterly' && (
                                                        <>
                                                            <option value={4}>April</option>
                                                            <option value={5}>May</option>
                                                            <option value={6}>June</option>
                                                        </>
                                                    )}
                                                    {settings.att_frequency === 'yearly' && (
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

                                        {settings.att_frequency === 'hourly' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Backup Minute (0-59)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={parseInt(settings.att_time.split(':')[1]) || 0}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                                        const formattedMinute = String(val).padStart(2, '0');
                                                        setSettings(prev => ({ ...prev, att_time: `00:${formattedMinute}` }));
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {!['minutely', 'hourly'].includes(settings.att_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Backup Execution Time</label>
                                                <input
                                                    type="time"
                                                    value={settings.att_time}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_time: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {getScheduleDescription('local') && (
                                            <p className="text-[11px] text-[#1F5C99] font-bold sm:col-span-2">
                                                * {getScheduleDescription('local')}
                                            </p>
                                        )}

                                        <div className="space-y-1.5 sm:col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                {['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.att_frequency)
                                                    ? 'Retention (Backups to Keep)'
                                                    : 'Retention Period (Days)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={settings.att_keep_backups_days}
                                                onChange={(e) => setSettings(prev => ({ ...prev, att_keep_backups_days: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Older archives exceeding this limit will be automatically purged from local disk storage.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 max-w-2xl">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800">Automated S3 Cloud Backups</h4>
                                        <p className="text-xs text-gray-500 mt-0.5">Upload and store attachment zip archives automatically to your S3 / DigitalOcean Spaces bucket.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.att_s3_backup_enabled}
                                            onChange={(e) => setSettings(prev => ({ ...prev, att_s3_backup_enabled: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1F5C99]"></div>
                                    </label>
                                </div>

                                {settings.att_s3_backup_enabled && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-gray-100 rounded-xl bg-[#FAFBFD] animate-fade-in">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">S3 Backup Frequency</label>
                                            <select
                                                value={settings.att_s3_frequency}
                                                onChange={(e) => setSettings(prev => ({ ...prev, att_s3_frequency: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                            >
                                                <option value="minutely">Every Minute (Testing)</option>
                                                <option value="hourly">Hourly</option>
                                                <option value="daily">Daily</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="monthly">Monthly</option>
                                                <option value="quarterly">Quarterly</option>
                                                <option value="half_yearly">Half Yearly</option>
                                                <option value="yearly">Annually</option>
                                            </select>
                                        </div>

                                        {settings.att_s3_frequency === 'minutely' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Minute Interval (1-59)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="59"
                                                    value={settings.att_s3_day_of_month ?? ''}
                                                    onChange={(e) => {
                                                        const raw = e.target.value;
                                                        if (raw === '') {
                                                            setSettings(prev => ({ ...prev, att_s3_day_of_month: '' }));
                                                        } else {
                                                            const parsed = parseInt(raw);
                                                            if (!isNaN(parsed)) {
                                                                const val = Math.max(1, Math.min(59, parsed));
                                                                setSettings(prev => ({ ...prev, att_s3_day_of_month: val }));
                                                            }
                                                        }
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                    placeholder="e.g. 5 minutes"
                                                />
                                            </div>
                                        )}

                                        {settings.att_s3_frequency === 'weekly' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Day of Week</label>
                                                <select
                                                    value={settings.att_s3_day_of_week}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_s3_day_of_week: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
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

                                        {['monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.att_s3_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Day of Month</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="31"
                                                    value={settings.att_s3_day_of_month}
                                                    onChange={(e) => {
                                                        const val = Math.max(1, Math.min(31, parseInt(e.target.value) || 1));
                                                        setSettings(prev => ({ ...prev, att_s3_day_of_month: val }));
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {['quarterly', 'half_yearly', 'yearly'].includes(settings.att_s3_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                    {settings.att_s3_frequency === 'yearly' ? 'Month of Year' : 'Start Month'}
                                                </label>
                                                <select
                                                    value={settings.att_s3_month_of_year}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_s3_month_of_year: parseInt(e.target.value) }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                >
                                                    <option value={1}>January</option>
                                                    <option value={2}>February</option>
                                                    <option value={3}>March</option>
                                                    {settings.att_s3_frequency !== 'quarterly' && (
                                                        <>
                                                            <option value={4}>April</option>
                                                            <option value={5}>May</option>
                                                            <option value={6}>June</option>
                                                        </>
                                                    )}
                                                    {settings.att_s3_frequency === 'yearly' && (
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

                                        {settings.att_s3_frequency === 'hourly' && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Backup Minute (0-59)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="59"
                                                    value={parseInt(settings.att_s3_time.split(':')[1]) || 0}
                                                    onChange={(e) => {
                                                        const val = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                                                        const formattedMinute = String(val).padStart(2, '0');
                                                        setSettings(prev => ({ ...prev, att_s3_time: `00:${formattedMinute}` }));
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {!['minutely', 'hourly'].includes(settings.att_s3_frequency) && (
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Backup Execution Time</label>
                                                <input
                                                    type="time"
                                                    value={settings.att_s3_time}
                                                    onChange={(e) => setSettings(prev => ({ ...prev, att_s3_time: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                                />
                                            </div>
                                        )}

                                        {getScheduleDescription('s3') && (
                                            <p className="text-[11px] text-[#1F5C99] font-bold sm:col-span-2">
                                                * {getScheduleDescription('s3')}
                                            </p>
                                        )}

                                        <div className="space-y-1.5 sm:col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                                {['minutely', 'hourly', 'monthly', 'quarterly', 'half_yearly', 'yearly'].includes(settings.att_s3_frequency)
                                                    ? 'Retention (Backups to Keep)'
                                                    : 'Retention Period (Days)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={settings.att_s3_keep_backups_days}
                                                onChange={(e) => setSettings(prev => ({ ...prev, att_s3_keep_backups_days: parseInt(e.target.value) || 1 }))}
                                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#1F5C99]/20 font-medium text-gray-800"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">Older archives exceeding this limit will be automatically purged from S3 storage.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                            <button
                                type="submit"
                                disabled={savingSettings}
                                className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 disabled:opacity-50"
                            >
                                {savingSettings ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </form>
                )}
            </div>

            {/* Backup Logs Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Clock size={18} className="text-gray-500" />
                        Attachment Backup Log History
                    </h3>
                    <button
                        onClick={fetchBackupLogs}
                        className="p-2 text-gray-400 hover:text-[#1F5C99] hover:bg-gray-50 rounded-lg transition"
                        title="Refresh Logs"
                    >
                        <RefreshCw size={16} className={loadingLogs ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
                    {loadingLogs ? (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="animate-spin text-[#1F5C99]" size={24} />
                            <span className="text-xs font-semibold">Loading backup history...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-2">
                            <FileText size={32} className="text-gray-300" />
                            <span className="text-sm font-bold">No attachment backups recorded yet.</span>
                            <span className="text-xs text-gray-400">Generate your first ZIP backup using the panel above.</span>
                        </div>
                    ) : (
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
                                                <span className="font-bold text-slate-700">{log.backup_by || log.user_name || 'System'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center justify-end gap-2">
                                                {log.file_exists ? (
                                                    <button
                                                        onClick={() => handleDownloadSaved(log)}
                                                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 w-[88px] bg-[#1F5C99]/10 hover:bg-[#1F5C99]/20 text-[#1F5C99] font-extrabold text-[11px] rounded-lg transition cursor-pointer"
                                                        title="Download Backup ZIP"
                                                    >
                                                        <Download size={12} />
                                                        <span>Download</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400 italic bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                                        Cleaned Up
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteSaved(log)}
                                                    className="inline-flex items-center justify-center gap-1 px-3 py-1.5 w-[88px] bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-[11px] rounded-lg transition cursor-pointer"
                                                    title="Delete Backup"
                                                >
                                                    <Trash2 size={12} />
                                                    <span>Delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Backup Name Confirmation Modal */}
            {showBackupNameModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-gray-100 space-y-4 animate-scale-up">
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-800">Identify Backup Initiator</h3>
                            <p className="text-xs text-gray-500">
                                Please enter your name or credentials to log this attachment backup event in the system audit records.
                            </p>
                        </div>
                        <form onSubmit={handleBackupSubmit} className="space-y-4">
                            <input
                                type="text"
                                placeholder="e.g. Shreyas Gijare"
                                value={backupByName}
                                onChange={(e) => setBackupByName(e.target.value)}
                                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-medium"
                                required
                                autoFocus
                            />
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBackupNameModal(false)}
                                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white rounded-xl text-sm font-bold transition"
                                >
                                    Proceed to Zip
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper to extract basename of filenames
function basename(path) {
    if (!path) return '';
    return path.split(/[\\/]/).pop();
}
