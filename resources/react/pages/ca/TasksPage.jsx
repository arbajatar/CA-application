import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserRoundCog, PlusCircle, Eye, Download, Copy, Folder as FolderIcon, ChevronLeft } from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const EMPTY_FORM = {
    client_id: '', work_type_id: '', date_inward: '',
    allocated_to: '', date_allocated: new Date().toISOString().split('T')[0], remarks: ''
}

const statuses = [
    { value: '', label: 'All Status' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_information', label: 'Awaiting Information' },
    { value: 'completed', label: 'Completed' },
]

export default function TasksPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [meta, setMeta] = useState(null)
    const [clients, setClients] = useState([])
    const [workTypes, setWorkTypes] = useState([])
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [staffId, setStaffId] = useState('')
    const [clientId, setClientId] = useState('')
    const [workTypeId, setWorkTypeId] = useState(() => new URLSearchParams(location.search).get('work_type_id') || '')
    const [page, setPage] = useState(1)

    const [reassignOpen, setReassignOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})
    const [duplicateOpen, setDuplicateOpen] = useState(false)
    const [currentFolder, setCurrentFolder] = useState(() => new URLSearchParams(location.search).get('work_type_id') || null)
    const fileInputRef = useRef(null)

    const fetchDropdowns = async () => {
        try {
            const [c, w, s] = await Promise.all([
                api.get('/ca/clients', { params: { per_page: 100 } }),
                api.get('/ca/work-types'),
                api.get('/ca/staff', { params: { per_page: 100 } }),
            ])
            setClients(c.data.data)
            setWorkTypes(w.data.data)
            setStaff(s.data.data)
        } catch (e) {
            toast.error('Failed to load dropdown data')
        }
    }

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        try {
            const res = await api.get('/ca/tasks', {
                params: { search, status, staff_id: staffId, client_id: clientId, work_type_id: workTypeId, page, per_page: 15 }
            })
            setTasks(res.data.data || [])
            setMeta(res.data.meta)
        } catch (e) {
            toast.error('Failed to fetch tasks')
            setTasks([])
        } finally {
            setLoading(false)
        }
    }, [search, status, staffId, clientId, workTypeId, page])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const sId = params.get('staff_id')
        const wId = params.get('work_type_id')
        
        if (sId) setStaffId(sId)
        
        // Sync states if URL changes (e.g. clicking different quick links)
        setWorkTypeId(wId || '')
        setCurrentFolder(wId || null)
        
        fetchDropdowns()
    }, [location.search])

    useEffect(() => { fetchTasks() }, [fetchTasks])


    const handleReassign = async () => {
        setSaving(true); setErrors({})
        try {
            await api.patch(`/ca/tasks/${selected.id}/reassign`, { allocated_to: form.allocated_to })
            setReassignOpen(false); fetchTasks()
        } catch (e) {
            setErrors(e.response?.data?.errors ?? { message: 'Reassignment failed' })
        } finally { setSaving(false) }
    }

    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/tasks/${selected.id}`)
            toast.success('Task deleted successfully')
            setDeleteOpen(false)
            fetchTasks()
        } catch (e) {
            toast.error(e.response?.data?.message || 'Failed to delete task')
        } finally { setSaving(false) }
    }

    const handleImport = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const XLSX = await import('xlsx');
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rawData = XLSX.utils.sheet_to_json(ws);

                if (rawData.length === 0) {
                    toast.error('Excel file is empty');
                    return;
                }

                const taskGroups = {};

                // Helper to find value by multiple possible header names
                const getVal = (row, options) => {
                    const key = Object.keys(row).find(k => options.some(opt => k.toLowerCase().trim() === opt.toLowerCase().trim()));
                    return key ? row[key]?.toString().trim() : null;
                };

                rawData.forEach(row => {
                    const clientName = getVal(row, ['Client Name', 'NAME OF CLIENT', 'Client', 'CLIENT NAME']);
                    const workTypeName = getVal(row, ['Work Type', 'MAIN TASK', 'RELATED MATTER', 'Task Type']);
                    const formName = getVal(row, ['Form Name', 'RELATED MATTER DETAILED']);
                    const dateAllocated = getVal(row, ['Date Allocated', 'DATE', 'DATE OF CREATION OF TASK', 'Date']);
                    const globalRemarks = getVal(row, ['Global Remark', 'Global Remarks', 'FINAL REMARK', 'Remarks', 'TASK/ FOLLOW UP REMARKS']);

                    if (!clientName || !workTypeName) return;

                    const key = `${clientName}|${workTypeName}|${dateAllocated || ''}|${formName || ''}`;

                    if (!taskGroups[key]) {
                        taskGroups[key] = {
                            clientName,
                            workTypeName,
                            formName,
                            dateAllocated,
                            remarks: globalRemarks || '',
                            subtasks: []
                        };
                    }

                    const subtaskName = getVal(row, ['Subtask Name', 'SUB TASK', 'WHAT TO DO', 'Title', 'SUB TASK DESCRIPTION']);
                    const assigneeName = getVal(row, ['Assignee', 'TEAM MEMBER NAME', 'TASK ALLOCATION TO', 'Assignee Name']);

                    if (subtaskName || assigneeName) {
                        taskGroups[key].subtasks.push({
                            title: subtaskName || workTypeName, // Default to work type if subtask name missing
                            assigneeName: assigneeName,
                            priority: getVal(row, ['Priority', 'Importance']) || 'medium',
                            status: getVal(row, ['Subtask Status', 'TASK STATUS', 'TASK/ FOLLOW UP STATUS', 'Status']) || 'assigned',
                            due_date: getVal(row, ['Due Date', 'TASK/ FOLLOW UP DATE', 'Target Date']),
                            remarks: getVal(row, ['Subtask Remarks', 'CA REMARK', 'Remark']) || ''
                        });
                    }
                });

                const failedMatches = [];
                const importedTasks = Object.values(taskGroups).map(group => {
                    const client = clients.find(c => c.name.toLowerCase().trim() === group.clientName.toLowerCase().trim());
                    const workType = workTypes.find(w => w.name.toLowerCase().trim() === group.workTypeName.toLowerCase().trim());

                    if (!client || !workType) {
                        if (!client) failedMatches.push(`Client: "${group.clientName}"`);
                        if (!workType) failedMatches.push(`Work Type: "${group.workTypeName}"`);
                        return null;
                    }

                    const processedSubtasks = group.subtasks.map(st => {
                        const staffMember = staff.find(s => s.name.toLowerCase().trim() === st.assigneeName?.toLowerCase().trim());
                        return {
                            ...st,
                            assigned_to: staffMember?.id || staff[0]?.id
                        };
                    });

                    const formatDate = (d) => {
                        if (!d) return null;
                        if (d instanceof Date) return d.toISOString().split('T')[0];
                        if (typeof d === 'number') {
                            const date = new Date((d - 25569) * 86400 * 1000);
                            return date.toISOString().split('T')[0];
                        }
                        return d.toString().split(' ')[0];
                    };

                    const mainAssigneeId = processedSubtasks.find(s => s.assigned_to)?.assigned_to || staff[0]?.id;

                    return {
                        client_id: client.id,
                        work_type_id: workType.id,
                        form_name: group.formName,
                        allocated_to: mainAssigneeId,
                        date_allocated: formatDate(group.dateAllocated) || new Date().toISOString().split('T')[0],
                        remarks: group.remarks,
                        subtasks: processedSubtasks
                    };
                }).filter(Boolean);

                if (importedTasks.length === 0) {
                    const uniqueFailures = [...new Set(failedMatches)].slice(0, 3).join(', ');
                    toast.error(`No matches found for: ${uniqueFailures}${failedMatches.length > 3 ? '...' : ''}. Please check names in database.`);
                    return;
                }

                setSaving(true);
                const res = await api.post('/ca/tasks/import', { tasks: importedTasks });
                toast.success(res.data.message);
                fetchTasks();
            } catch (err) {
                console.error('Import Error:', err);
                toast.error('Error processing Excel file. Check console for details.');
            } finally {
                setSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExport = async () => {
        setSaving(true);
        try {
            const ExcelJS = await import('exceljs');
            const res = await api.get('/ca/tasks', {
                params: {
                    search,
                    status,
                    staff_id: staffId,
                    client_id: clientId,
                    work_type_id: workTypeId,
                    per_page: 'all',
                    with_subtasks: 1
                }
            });
            const allTasks = res.data.data;

            if (!allTasks || allTasks.length === 0) {
                toast.error('No tasks found to export');
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Tasks Export');

            // 1. Identify dynamic headers
            const allDynamicHeadersSet = new Set();
            allTasks.forEach(t => {
                Object.keys(t.dynamic_fields || {}).forEach(k => {
                    if (!['schema', 'multi_rows', 'field_names', 'field_types'].includes(k)) {
                        allDynamicHeadersSet.add(k);
                    }
                });
            });
            const dynamicHeaders = Array.from(allDynamicHeadersSet);

            // 2. Define columns
            const columns = [
                { header: 'SR NO', key: 'sr_no' },
                { header: 'Client Name', key: 'client_name' },
                { header: 'Mobile No', key: 'mobile' },
                { header: 'Work Type', key: 'work_type' },
                { header: 'Form Name', key: 'form_name' },
                { header: 'Date Allocated', key: 'date_allocated' },
                { header: 'Global Status', key: 'status' },
                { header: 'Global Remarks', key: 'remarks' },
                ...dynamicHeaders.map(h => ({ header: h, key: `dyn_${h}` })),
                { header: 'Subtask Name', key: 'st_name' },
                { header: 'Assignee', key: 'st_assignee' },
                { header: 'Priority', key: 'st_priority' },
                { header: 'Subtask Status', key: 'st_status' },
                { header: 'Due Date', key: 'st_due_date' },
                { header: 'Subtask Remarks', key: 'st_remarks' },
            ];

            worksheet.columns = columns;

            // 3. Format header row
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0F1C2E' } // Matches theme color #0f1c2e
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            headerRow.height = 25;

            // 4. Add data rows
            const formatVal = (val) => {
                if (Array.isArray(val)) return val.join(', ');
                if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                return val || '';
            };

            let srNo = 1;
            allTasks.forEach(task => {
                const baseData = {
                    client_name: task.client?.name || '',
                    mobile: task.client?.contact || '',
                    work_type: task.work_type?.name || '',
                    form_name: task.form_name || '',
                    date_allocated: task.date_allocated || '',
                    status: task.status_label || task.status,
                    remarks: task.remarks || '',
                };

                dynamicHeaders.forEach(h => {
                    baseData[`dyn_${h}`] = formatVal(task.dynamic_fields?.[h]);
                });

                if (task.sub_tasks && task.sub_tasks.length > 0) {
                    task.sub_tasks.forEach(st => {
                        worksheet.addRow({
                            sr_no: srNo++,
                            ...baseData,
                            st_name: st.title,
                            st_assignee: st.assigned_to?.name || 'Unassigned',
                            st_priority: st.priority_label || st.priority,
                            st_status: st.status_label || st.status,
                            st_due_date: st.due_date || '',
                            st_remarks: st.remarks || ''
                        });
                    });
                } else {
                    worksheet.addRow({
                        sr_no: srNo++,
                        ...baseData,
                        st_name: 'No Subtasks',
                        st_assignee: 'N/A',
                        st_priority: 'N/A',
                        st_status: 'N/A',
                        st_due_date: 'N/A',
                        st_remarks: 'N/A'
                    });
                }
            });

            // 5. Style data rows and Auto-size columns
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    row.eachCell((cell) => {
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                        cell.alignment = { vertical: 'middle', wrapText: true };
                    });
                }
            });

            // Automatic column resizing
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                });
                column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
            });

            // 6. Generate and Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tasks_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);

            toast.success('Tasks exported successfully');
        } catch (err) {
            console.error('Export Error:', err);
            toast.error('Failed to export tasks');
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicate = async (withData) => {
        setSaving(true);
        try {
            // Fetch FULL task details to get dynamic fields and subtasks
            const res = await api.get(`/ca/tasks/${selected.id}`);
            const fullTask = res.data.data;

            // Prepare pre-filled data for TaskBuilder
            const duplicateData = {
                form_name: withData ? fullTask.form_name : '',
                client_id: withData ? fullTask.client.id : '',
                work_type_id: withData ? fullTask.work_type.id : '',
                remarks: withData ? fullTask.remarks : '',
                // If without data, we still keep the custom field structure but clear their values
                dynamic_fields: withData ? fullTask.dynamic_fields : Object.fromEntries(
                    Object.keys(fullTask.dynamic_fields || {}).map(k => [k, ''])
                ),
                subtasks: (fullTask.sub_tasks || []).map(st => ({
                    title: st.title,
                    assigned_to: withData ? st.assigned_to?.id : null,
                    priority: withData ? st.priority : 'medium',
                    status: 'assigned', // Always reset status for new task
                    due_date: withData ? st.due_date : null,
                    remarks: withData ? st.remarks : ''
                }))
            };

            setDuplicateOpen(false);
            navigate('/ca/tasks/builder', { state: { duplicateData } });
        } catch (err) {
            console.error('Duplication Error:', err);
            toast.error('Failed to load task details for duplication');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (task) => {
        navigate(`/ca/tasks/${task.id}`);
    }

    const openReassign = (task) => {
        setSelected(task)
        setForm({ allocated_to: task.allocated_to?.id ?? '' })
        setReassignOpen(true)
    }

    const openView = (task) => {
        navigate(`/ca/tasks/${task.id}`);
    }

    const renderField = (label, error, children) => (
        <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
            {children}
            {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
    )

    const inputCls = "w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"

    const FolderCard = ({ name, iconBg, iconColor, onClick }) => (
        <div
            onClick={onClick}
            className="group cursor-pointer p-5 bg-white rounded-2xl border border-gray-100 hover:border-[#1F5C99] hover:shadow-xl transition-all duration-300 flex flex-col items-center gap-4 text-center select-none"
        >
            <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                <FolderIcon size={32} className={iconColor} fill="currentColor" fillOpacity={0.2} />
            </div>
            <div>
                <h3 className="font-bold text-gray-800 text-sm leading-tight group-hover:text-[#1F5C99] transition-colors">{name}</h3>
            </div>
        </div>
    );


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-3xl font-bold text-gray-900">Sheets Management</h1>
                        {currentFolder && (
                            <div className="flex items-center text-gray-400 text-lg font-medium">
                                <span className="mx-1">/</span>
                                <span className="text-[#1F5C99]">{currentFolder === 'all' ? 'All Sheets' : workTypes.find(w => w.id == currentFolder)?.name}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-gray-400">Monitor, assign, and manage all office work entries.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
                    >
                        Import Data
                    </button>
                    <button onClick={() => navigate('/ca/tasks/builder', { state: { workTypeId: currentFolder && currentFolder !== 'all' ? currentFolder : '' } })}
                        className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition w-full sm:w-auto">
                        <Plus size={16} /> Create New Sheet
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[400px]">
                {!currentFolder ? (
                    <div className="p-8">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <FolderIcon size={20} className="text-[#1F5C99]" />
                            All Folders
                        </h2>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            <FolderCard
                                name="All Sheets"
                                iconBg="bg-slate-50"
                                iconColor="text-slate-500"
                                onClick={() => {
                                    setWorkTypeId('');
                                    setPage(1);
                                    setCurrentFolder('all');
                                }}
                            />
                            {workTypes.map(wt => (
                                <FolderCard
                                    key={wt.id}
                                    name={wt.name}
                                    iconBg="bg-blue-50"
                                    iconColor="text-blue-500"
                                    onClick={() => {
                                        setWorkTypeId(wt.id);
                                        setPage(1);
                                        setCurrentFolder(wt.id);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Filters */}
                        <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
                            <button
                                onClick={() => {
                                    setCurrentFolder(null);
                                    setWorkTypeId('');
                                    setPage(1);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 text-gray-500 hover:text-[#1F5C99] font-bold text-sm transition group"
                            >
                                <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                                Back to Folders
                            </button>
                            <div className="h-6 w-[1px] bg-gray-200 mx-2 hidden lg:block" />
                            <div className="relative w-full lg:flex-1">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input type="text" placeholder="Search in this folder..." value={search}
                                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                                    className="pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] w-full transition" />
                            </div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar w-full lg:w-auto">
                                <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                                    className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px]">
                                    {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <select value={clientId} onChange={e => { setClientId(e.target.value); setPage(1) }}
                                    className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px] lg:max-w-[150px]">
                                    <option value="">All Clients</option>
                                    {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select value={staffId} onChange={e => { setStaffId(e.target.value); setPage(1) }}
                                    className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[120px] lg:max-w-[150px]">
                                    <option value="">All Staff</option>
                                    {staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                {currentFolder === 'all' && (
                                    <select value={workTypeId} onChange={e => { setWorkTypeId(e.target.value); setPage(1) }}
                                        className="whitespace-nowrap py-2 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition min-w-[140px] lg:max-w-[150px]">
                                        <option value="">All Work Types</option>
                                        {workTypes?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                )}
                                <button
                                    onClick={handleExport}
                                    disabled={saving}
                                    className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-4 py-2 text-sm font-semibold transition rounded-xl shadow-sm disabled:opacity-50 h-[38px] whitespace-nowrap"
                                >
                                    <Download size={16} /> Export
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            {loading ? <Spinner /> : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            {['#', 'Sheet Name', 'Work Type', 'Create Date', 'Sheet Status', 'Remarks', 'Actions'].map(h => (
                                                <th key={h} className="px-4 py-3 text-left whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {tasks?.length === 0 ? (
                                            <tr><td colSpan={7} className="text-center py-12 text-gray-400">No sheets found in this folder</td></tr>
                                        ) : tasks?.map((t, i) => (
                                            <tr key={t.id} className="hover:bg-gray-100 transition">
                                                <td className="px-4 py-3 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                                <td className="px-4 py-3 font-semibold text-gray-800">{t.form_name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-600">{t.work_type?.name || '—'}</td>
                                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.date_inward || '—'}</td>
                                                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                                                <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={t.remarks}>{t.remarks || '—'}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => openView(t)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition disabled:opacity-50">
                                                            <Eye size={15} />
                                                        </button>
                                                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                        <button onClick={() => { setSelected(t); setDuplicateOpen(true) }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition" title="Duplicate Task">
                                                            <Copy size={15} />
                                                        </button>
                                                        <button onClick={() => openReassign(t)} className="p-1.5 rounded-lg hover:bg-orange-50 text-gray-400 hover:text-orange-500 transition"><UserRoundCog size={15} /></button>
                                                        <button onClick={() => { setSelected(t); setDeleteOpen(true) }} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={15} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Pagination */}
                        {meta && meta.last_page > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
                                <p className="text-xs text-gray-400">Showing {meta.from}–{meta.to} of {meta.total}</p>
                                <div className="flex gap-2">
                                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                                    <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Reassign Modal */}
            <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Task" width="max-w-sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">Reassign <span className="font-semibold text-gray-700">{selected?.client?.name}</span> — {selected?.work_type?.name}</p>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign To</label>
                        <select value={form.allocated_to} onChange={e => setForm(f => ({ ...f, allocated_to: e.target.value }))}
                            className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition">
                            <option value="">Select staff</option>
                            {(staff || [])
                                .filter(s => s.is_active)
                                .map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setReassignOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
                        <button onClick={handleReassign} disabled={saving} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{saving ? 'Saving...' : 'Reassign'}</button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirm */}
            <ConfirmDialog
                open={deleteOpen} onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete} danger
                loading={saving}
                title="Delete Task"
                message={`Are you sure you want to delete this task for "${selected?.client?.name}"? This action cannot be undone.`}
                confirmLabel="Delete Task"
            />

            {/* Duplicate Modal */}
            <Modal open={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Duplicate Task" width="max-w-sm">
                <div className="space-y-6 py-2">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <p className="text-sm text-emerald-800 leading-relaxed font-medium">
                            Duplicate task for <span className="font-bold underline">{selected?.client?.name}</span>
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => handleDuplicate(true)}
                            disabled={saving}
                            className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/30 transition group text-left w-full"
                        >
                            <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">Duplicate with Data</span>
                            <span className="text-[11px] text-gray-400 mt-1">Copies all dynamic fields and subtasks</span>
                        </button>

                        <button
                            onClick={() => handleDuplicate(false)}
                            disabled={saving}
                            className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50/30 transition group text-left w-full"
                        >
                            <span className="text-sm font-bold text-gray-900 group-hover:text-blue-700">Duplicate without Data</span>
                            <span className="text-[11px] text-gray-400 mt-1">Only copies core structure (Client, Work Type)</span>
                        </button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button onClick={() => setDuplicateOpen(false)} className="px-5 py-2 text-sm text-gray-500 hover:text-gray-800 font-semibold transition">
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}