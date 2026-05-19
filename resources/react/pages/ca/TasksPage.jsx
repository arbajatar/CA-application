import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserRoundCog, PlusCircle, Eye, Download, Copy, Folder as FolderIcon, ChevronLeft, Sliders, X, GripVertical } from 'lucide-react'
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
    const [dynamicFilters, setDynamicFilters] = useState({})
    const [showColumnFilters, setShowColumnFilters] = useState(true)
    const [customColumnOrder, setCustomColumnOrder] = useState(null)
    const [draggedColumnIndex, setDraggedColumnIndex] = useState(null)
    const [dragOverColumnIndex, setDragOverColumnIndex] = useState(null)
    const [ignoreIdsForCloning, setIgnoreIdsForCloning] = useState(false)
    const fileInputRef = useRef(null)

    // Import Mapping Modal States
    const [importModalOpen, setImportModalOpen] = useState(false)
    const [importRawData, setImportRawData] = useState([])
    const [importHeaders, setImportHeaders] = useState([])
    const [columnMapping, setColumnMapping] = useState({})
    const [fallbackClient, setFallbackClient] = useState('')
    const [fallbackWorkType, setFallbackWorkType] = useState('')

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
        setDynamicFilters({})
        
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
                const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

                if (rawData.length === 0) {
                    toast.error('Excel file is empty');
                    return;
                }

                // Extract headers
                const headers = Object.keys(rawData[0]);
                setImportHeaders(headers);
                setImportRawData(rawData);
                
                // Try to auto-map some obvious ones
                const initialMapping = {};
                headers.forEach(h => {
                    const lh = h.toLowerCase().trim();
                    if (['sheet id', 'task id', 'id', 'sheet_id'].includes(lh)) initialMapping[h] = 'sheet_id';
                    else if (['subtask id', 'subtask_id'].includes(lh)) initialMapping[h] = 'subtask_id';
                    else if (['client name', 'name of client', 'client', 'client_name'].includes(lh)) initialMapping[h] = 'client_id';
                    else if (['mobile no', 'client mobile', 'mobile', 'client_mobile'].includes(lh)) initialMapping[h] = 'client_mobile';
                    else if (['work type', 'main task', 'related matter', 'task type', 'work_type_id'].includes(lh)) initialMapping[h] = 'work_type_id';
                    else if (['form name', 'related matter detailed', 'sheet name', 'task name'].includes(lh)) initialMapping[h] = 'form_name';
                    else if (['date allocated', 'date', 'date of creation of task', 'date inward'].includes(lh)) initialMapping[h] = 'date_allocated';
                    else if (['assignee', 'team member name', 'task allocation to'].includes(lh)) initialMapping[h] = 'allocated_to';
                    else if (['status', 'sheet status', 'global status'].includes(lh)) initialMapping[h] = 'status';
                    else if (['remarks', 'global remarks', 'final remark'].includes(lh)) initialMapping[h] = 'remarks';
                    else if (['subtask name', 'st_name'].includes(lh)) initialMapping[h] = 'st_name';
                    else if (['subtask assignee', 'st_assignee', 'assignee'].includes(lh) && !initialMapping[h]) initialMapping[h] = 'st_assignee';
                    else if (['subtask priority', 'priority', 'st_priority'].includes(lh)) initialMapping[h] = 'st_priority';
                    else if (['subtask status', 'st_status'].includes(lh)) initialMapping[h] = 'st_status';
                    else if (['subtask due date', 'due date', 'st_due_date'].includes(lh) && !initialMapping[h]) initialMapping[h] = 'st_due_date';
                    else if (['subtask remarks', 'st_remarks'].includes(lh)) initialMapping[h] = 'st_remarks';
                    else if (lh !== 'sr no' && lh !== 'sr_no') initialMapping[h] = 'dynamic_' + h; // default to dynamic field
                });
                
                setColumnMapping(initialMapping);
                setFallbackClient('');
                setFallbackWorkType(currentFolder && currentFolder !== 'all' ? currentFolder : '');
                setImportModalOpen(true);
            } catch (err) {
                console.error('Import Error:', err);
                toast.error('Error processing Excel file. Check console for details.');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const submitImportMapping = async () => {
        setSaving(true);
        try {
            const taskGroups = new Map();

            importRawData.forEach(row => {
                let sheetId = null;
                let subtaskId = null;
                let rowClientName = null;
                let rowClientMobile = null;
                let rowWorkTypeName = null;
                let rowAssigneeName = null;
                
                const taskProps = { dynamic_fields: {}, subtasks: [] };
                const subtaskProps = {};

                // Map columns
                Object.keys(row).forEach(col => {
                    const mapTo = columnMapping[col];
                    if (!mapTo || mapTo === 'ignore') return;
                    
                    const val = row[col];
                    
                    if (mapTo === 'sheet_id') sheetId = val;
                    else if (mapTo === 'subtask_id') subtaskId = val;
                    else if (mapTo === 'client_id') rowClientName = val;
                    else if (mapTo === 'client_mobile') rowClientMobile = val;
                    else if (mapTo === 'work_type_id') rowWorkTypeName = val;
                    else if (mapTo === 'allocated_to') rowAssigneeName = val;
                    else if (mapTo.startsWith('dynamic_')) {
                        const dynamicKey = mapTo.replace('dynamic_', '');
                        taskProps.dynamic_fields[dynamicKey] = val;
                    }
                    else if (mapTo.startsWith('st_')) {
                        const stKey = mapTo.replace('st_', '');
                        if (stKey === 'name') subtaskProps.title = val;
                        else subtaskProps[stKey] = val;
                    }
                    else {
                        // date_allocated, form_name, status, remarks
                        taskProps[mapTo] = val;
                    }
                });

                // Resolve Client (Frontend lookup, or pass strings to backend)
                let finalClientId = null;
                if (rowClientName || rowClientMobile) {
                    const client = clients.find(c => {
                        const matchName = Boolean(rowClientName && c.name && c.name.toString().toLowerCase().trim() === rowClientName?.toString().toLowerCase().trim());
                        const matchMobile = Boolean(rowClientMobile && c.contact && c.contact.toString().replace(/\D/g,'') === rowClientMobile?.toString().replace(/\D/g,''));
                        return matchName || matchMobile;
                    });
                    if (client) finalClientId = client.id;
                }
                if (!finalClientId && fallbackClient) finalClientId = fallbackClient;

                // Resolve Work Type
                let finalWorkTypeId = null;
                if (rowWorkTypeName) {
                    const workType = workTypes.find(w => w.name && w.name.toString().toLowerCase().trim() === rowWorkTypeName?.toString().toLowerCase().trim());
                    if (workType) finalWorkTypeId = workType.id;
                }
                if (!finalWorkTypeId && fallbackWorkType) finalWorkTypeId = fallbackWorkType;

                // Resolve Assignee
                let finalAssigneeId = null;
                if (rowAssigneeName) {
                    const staffMember = staff.find(s => s.name && s.name.toString().toLowerCase().trim() === rowAssigneeName?.toString().toLowerCase().trim());
                    if (staffMember) finalAssigneeId = staffMember.id;
                }
                if (!finalAssigneeId) finalAssigneeId = staff[0]?.id; // Default to first staff

                // Resolve Subtask Assignee if provided as string
                if (subtaskProps.assignee && typeof subtaskProps.assignee === 'string') {
                     const stStaff = staff.find(s => s.name && s.name.toString().toLowerCase().trim() === subtaskProps.assignee.toString().toLowerCase().trim());
                     if (stStaff) subtaskProps.assigned_to = stStaff.id;
                     delete subtaskProps.assignee;
                }

                // Formatting Date
                if (taskProps.date_allocated) {
                    let d = taskProps.date_allocated;
                    if (typeof d === 'number') {
                        const date = new Date((d - 25569) * 86400 * 1000);
                        taskProps.date_allocated = date.toISOString().split('T')[0];
                    } else if (d instanceof Date) {
                        taskProps.date_allocated = d.toISOString().split('T')[0];
                    }
                }

                // Attach IDs and raw names for backend creation
                if (ignoreIdsForCloning) {
                    taskProps.id = null;
                    subtaskProps.id = null;
                } else {
                    taskProps.id = sheetId;
                    if (subtaskId) subtaskProps.id = subtaskId;
                }
                
                taskProps.client_id = finalClientId;
                taskProps.client_name = rowClientName;
                taskProps.client_mobile = rowClientMobile;
                taskProps.work_type_id = finalWorkTypeId;
                taskProps.work_type_name = rowWorkTypeName;
                taskProps.allocated_to = finalAssigneeId;

                // Grouping Logic
                const groupKey = (sheetId && !ignoreIdsForCloning) ? `sheet_${sheetId}` : `new_${rowClientName}_${rowWorkTypeName}_${taskProps.form_name || ''}`;
                
                if (!taskGroups.has(groupKey)) {
                    taskGroups.set(groupKey, taskProps);
                }
                
                const existingGroup = taskGroups.get(groupKey);
                
                // Merge dynamic fields for the same group just in case
                existingGroup.dynamic_fields = { ...existingGroup.dynamic_fields, ...taskProps.dynamic_fields };

                if (subtaskProps.title && subtaskProps.title !== 'No Subtasks') {
                    existingGroup.subtasks.push(subtaskProps);
                }
            });

            const importedTasks = Array.from(taskGroups.values());

            if (importedTasks.length === 0) {
                toast.error(`No valid rows mapped.`);
                setSaving(false);
                return;
            }

            const res = await api.post('/ca/tasks/import', { tasks: importedTasks });
            toast.success(res.data.message);
            setImportModalOpen(false);
            fetchTasks();
        } catch (err) {
            console.error('Import Mapping Error:', err);
            toast.error('Error importing tasks.');
        } finally {
            setSaving(false);
        }
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

            const allFields = [
                { key: 'form_name', label: 'Sheet Name', isStatic: true },
                { key: 'client_name', label: 'Client Name', isStatic: true },
                { key: 'client_contact', label: 'Mobile', isStatic: true },
                { key: 'assigned_to', label: 'Assigned To', isStatic: true },
                { key: 'date_inward', label: 'Create Date', isStatic: true },
                { key: 'status', label: 'Sheet Status', isStatic: true },
                { key: 'task_particular', label: 'Task / Particular', isStatic: true },
                ...dynamicHeaders.map(h => ({ key: h, label: h, isStatic: false })),
                { key: 'remarks', label: 'Remarks', isStatic: true }
            ];

            const filteredExportTasks = allTasks.filter(t => {
                return allFields.every(field => {
                    const query = dynamicFilters[field.key];
                    if (!query) return true;

                    let value = '';
                    if (field.isStatic) {
                        if (field.key === 'form_name') value = t.form_name;
                        else if (field.key === 'client_name') value = t.client?.name;
                        else if (field.key === 'client_contact') value = t.client?.contact;
                        else if (field.key === 'assigned_to') value = t.allocated_to?.name;
                        else if (field.key === 'date_inward') value = t.date_inward;
                        else if (field.key === 'status') value = t.status;
                        else if (field.key === 'task_particular') value = t.task_particular;
                        else if (field.key === 'remarks') value = t.remarks;
                    } else {
                        value = t.dynamic_fields?.[field.key];
                    }

                    return (value || '').toString().toLowerCase().includes(query.toLowerCase());
                });
            });

            if (!filteredExportTasks || filteredExportTasks.length === 0) {
                toast.error('No tasks found to export matching the current filters');
                setSaving(false);
                return;
            }

            // 2. Define columns dynamically using activeColumns
            const baseColumns = [
                { id: 'form_name', label: 'Sheet Name' },
                { id: 'client', label: 'Client' },
                { id: 'mobile', label: 'Mobile' },
                { id: 'work_type', label: 'Work Type' },
                { id: 'assigned_to', label: 'Assigned To' },
                { id: 'date_inward', label: 'Create Date' },
                { id: 'status', label: 'Sheet Status' },
                { id: 'task_particular', label: 'Task / Particular' },
                ...dynamicHeaders.map(h => ({ id: `dynamic_${h}`, label: h, isDynamic: true, fieldName: h })),
                { id: 'remarks', label: 'Remarks' }
            ];

            let activeColumns = [];
            if (customColumnOrder) {
                const baseIds = baseColumns.map(c => c.id);
                const ordered = customColumnOrder.filter(id => baseIds.includes(id));
                const missing = baseIds.filter(id => !ordered.includes(id));
                const finalIds = [...ordered, ...missing];
                activeColumns = finalIds.map(id => baseColumns.find(c => c.id === id)).filter(Boolean);
            } else {
                activeColumns = baseColumns;
            }

            const exportedColumns = [
                { header: 'SR NO', key: 'sr_no' },
                { header: 'Sheet ID', key: 'sheet_id' },
                ...activeColumns.map(col => {
                    if (col.id === 'form_name') return { header: 'Sheet Name', key: 'form_name' };
                    if (col.id === 'client') return { header: 'Client Name', key: 'client_name' };
                    if (col.id === 'mobile') return { header: 'Mobile No', key: 'mobile' };
                    if (col.id === 'work_type') return { header: 'Work Type', key: 'work_type' };
                    if (col.id === 'assigned_to') return { header: 'Assigned To', key: 'assigned_to' };
                    if (col.id === 'date_inward') return { header: 'Create Date', key: 'date_allocated' };
                    if (col.id === 'status') return { header: 'Sheet Status', key: 'status' };
                    if (col.id === 'task_particular') return { header: 'Task / Particular', key: 'task_particular' };
                    if (col.id === 'remarks') return { header: 'Remarks', key: 'remarks' };
                    if (col.isDynamic) return { header: col.label, key: `dyn_${col.fieldName}` };
                    return null;
                }).filter(Boolean),
                { header: 'Subtask ID', key: 'subtask_id' },
                { header: 'Subtask Name', key: 'st_name' },
                { header: 'Assignee', key: 'st_assignee' },
                { header: 'Priority', key: 'st_priority' },
                { header: 'Subtask Status', key: 'st_status' },
                { header: 'Due Date', key: 'st_due_date' },
                { header: 'Subtask Remarks', key: 'st_remarks' },
            ];

            worksheet.columns = exportedColumns;

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
            filteredExportTasks.forEach(task => {
                const baseData = {
                    sheet_id: task.id || '',
                    client_name: task.client?.name || '',
                    mobile: task.client?.contact || '',
                    work_type: task.work_type?.name || '',
                    form_name: task.form_name || '',
                    date_allocated: task.date_allocated || '',
                    assigned_to: task.allocated_to?.name || '',
                    status: task.status_label || task.status,
                    task_particular: task.task_particular || '',
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
                            subtask_id: st.id || '',
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
                        subtask_id: '',
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

            toast.success('Sheet exported successfully');
        } catch (err) {
            console.error('Export Error:', err);
            toast.error('Failed to export sheet');
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
            toast.error('Failed to load sheet details for duplication');
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
                                return (
                                    <FolderCard
                                        key={wt.id}
                                        name={wt.name}
                                        iconBg={color.bg}
                                        iconColor={color.text}
                                        onClick={() => {
                                            setWorkTypeId(wt.id);
                                            setPage(1);
                                            setCurrentFolder(wt.id);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ) : (() => {
                    const dynamicHeadersSet = new Set();
                    tasks?.forEach(t => {
                        Object.keys(t.dynamic_fields || {}).forEach(k => {
                            if (!['schema', 'multi_rows', 'field_names', 'field_types'].includes(k)) {
                                dynamicHeadersSet.add(k);
                            }
                        });
                    });
                    const dynamicHeaders = Array.from(dynamicHeadersSet);

                    const baseColumns = [
                        { id: 'form_name', label: 'Sheet Name' },
                        { id: 'client', label: 'Client' },
                        { id: 'mobile', label: 'Mobile' },
                        { id: 'work_type', label: 'Work Type' },
                        { id: 'assigned_to', label: 'Assigned To' },
                        { id: 'date_inward', label: 'Create Date' },
                        { id: 'status', label: 'Sheet Status' },
                        { id: 'task_particular', label: 'Task / Particular' },
                        ...dynamicHeaders.map(h => ({ id: `dynamic_${h}`, label: h, isDynamic: true, fieldName: h })),
                        { id: 'remarks', label: 'Remarks' }
                    ];

                    let activeColumns = [];
                    if (customColumnOrder) {
                        const baseIds = baseColumns.map(c => c.id);
                        const ordered = customColumnOrder.filter(id => baseIds.includes(id));
                        const missing = baseIds.filter(id => !ordered.includes(id));
                        const finalIds = [...ordered, ...missing];
                        activeColumns = finalIds.map(id => baseColumns.find(c => c.id === id)).filter(Boolean);
                    } else {
                        activeColumns = baseColumns;
                    }

                    const allFields = [
                        { key: 'form_name', label: 'Sheet Name', isStatic: true },
                        { key: 'client_name', label: 'Client Name', isStatic: true },
                        { key: 'client_contact', label: 'Mobile', isStatic: true },
                        { key: 'assigned_to', label: 'Assigned To', isStatic: true },
                        { key: 'date_inward', label: 'Create Date', isStatic: true },
                        { key: 'status', label: 'Sheet Status', isStatic: true },
                        { key: 'task_particular', label: 'Task / Particular', isStatic: true },
                        ...dynamicHeaders.map(h => ({ key: h, label: h, isStatic: false })),
                        { key: 'remarks', label: 'Remarks', isStatic: true }
                    ];

                    const filteredTasks = tasks?.filter(t => {
                        return allFields.every(field => {
                            const query = dynamicFilters[field.key];
                            if (!query) return true;

                            let value = '';
                            if (field.isStatic) {
                                if (field.key === 'form_name') value = t.form_name;
                                else if (field.key === 'client_name') value = t.client?.name;
                                else if (field.key === 'client_contact') value = t.client?.contact;
                                else if (field.key === 'assigned_to') value = t.allocated_to?.name;
                                else if (field.key === 'date_inward') value = t.date_inward;
                                else if (field.key === 'status') value = t.status;
                                else if (field.key === 'task_particular') value = t.task_particular;
                                else if (field.key === 'remarks') value = t.remarks;
                            } else {
                                value = t.dynamic_fields?.[field.key];
                            }

                            return (value || '').toString().toLowerCase().includes(query.toLowerCase());
                        });
                    });

                    return (
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
                                    {allFields.length > 0 && (
                                        <button
                                            onClick={() => setShowColumnFilters(!showColumnFilters)}
                                            className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold transition rounded-xl shadow-sm h-[38px] whitespace-nowrap border ${showColumnFilters ? 'bg-[#1F5C99] text-white border-[#1F5C99]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                        >
                                            <Sliders size={16} /> Column Filters {Object.values(dynamicFilters).filter(Boolean).length > 0 && `(${Object.values(dynamicFilters).filter(Boolean).length})`}
                                        </button>
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

                            {/* Dynamic Column Filters Panel */}
                            {showColumnFilters && allFields.length > 0 && (
                                <div className="bg-slate-50 border-b border-gray-100 px-4 sm:px-6 py-4 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Sliders size={13} className="text-[#1F5C99]" />
                                            Scrollable Column Filters ({currentFolder === 'all' ? 'All Folders' : workTypes.find(wt => wt.id === currentFolder)?.name})
                                        </h4>
                                        {Object.values(dynamicFilters).filter(Boolean).length > 0 && (
                                            <button
                                                onClick={() => setDynamicFilters({})}
                                                className="text-xs font-bold text-red-500 hover:text-red-700 transition"
                                            >
                                                Clear All Filters
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1 no-scrollbar scroll-smooth">
                                        {allFields.map(field => (
                                            <div key={field.key} className="relative min-w-[200px] shrink-0 bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:border-[#1F5C99]/30 transition">
                                                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 truncate" title={field.label}>
                                                    {field.label}
                                                    {field.isStatic && <span className="ml-1.5 text-[9px] font-semibold text-[#1F5C99] bg-[#1F5C99]/5 px-1 py-0.5 rounded">System</span>}
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder={`Search ${field.label}...`}
                                                        value={dynamicFilters[field.key] || ''}
                                                        onChange={e => setDynamicFilters(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                        className="w-full pl-3 pr-8 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition"
                                                    />
                                                    {dynamicFilters[field.key] && (
                                                        <button
                                                            onClick={() => setDynamicFilters(prev => {
                                                                const copy = { ...prev };
                                                                delete copy[field.key];
                                                                return copy;
                                                            })}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Table */}
                            <div className="overflow-x-auto">
                                {loading ? <Spinner /> : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                <th className="px-4 py-3 text-left whitespace-nowrap">#</th>
                                                {activeColumns.map((col, index) => {
                                                    const handleColumnDrop = (targetIndex) => {
                                                        if (draggedColumnIndex === null || draggedColumnIndex === targetIndex) return;
                                                        const copy = [...activeColumns.map(c => c.id)];
                                                        const draggedItem = copy[draggedColumnIndex];
                                                        copy.splice(draggedColumnIndex, 1);
                                                        copy.splice(targetIndex, 0, draggedItem);
                                                        setCustomColumnOrder(copy);
                                                        setDraggedColumnIndex(null);
                                                        setDragOverColumnIndex(null);
                                                        toast.success(`Positioned "${col.label}" column!`);
                                                    };
                                                    
                                                    const isDragging = draggedColumnIndex === index;
                                                    const isDragOver = dragOverColumnIndex === index;
                                                    
                                                    return (
                                                        <th
                                                            key={col.id}
                                                            draggable
                                                            onDragStart={() => setDraggedColumnIndex(index)}
                                                            onDragOver={(e) => {
                                                                e.preventDefault();
                                                                setDragOverColumnIndex(index);
                                                            }}
                                                            onDragEnd={() => {
                                                                setDraggedColumnIndex(null);
                                                                setDragOverColumnIndex(null);
                                                            }}
                                                            onDrop={() => handleColumnDrop(index)}
                                                            className={`px-4 py-3 text-left whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-all duration-150 group/th border-b border-gray-100 ${
                                                                isDragging ? 'opacity-40 bg-slate-100 scale-95 border-dashed border-2 border-slate-300' : ''
                                                            } ${
                                                                isDragOver && !isDragging ? 'bg-indigo-50 border-l-2 border-indigo-500 scale-102 shadow-sm' : ''
                                                            }`}
                                                            title="Drag to rearrange column order"
                                                        >
                                                            <div className="flex items-center gap-1.5 justify-between">
                                                                <div className="flex items-center gap-1 min-w-0">
                                                                    <GripVertical size={13} className="text-gray-300 shrink-0 cursor-grab group-hover/th:text-indigo-400 transition" />
                                                                    <span className="font-semibold text-gray-700 truncate">{col.label}</span>
                                                                </div>
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                                <th className="px-4 py-3 text-left whitespace-nowrap">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {filteredTasks?.length === 0 ? (
                                                <tr><td colSpan={2 + activeColumns.length} className="text-center py-12 text-gray-400">No sheets found matching filters</td></tr>
                                            ) : filteredTasks?.map((t, i) => (
                                                <tr key={t.id} className="hover:bg-gray-100 transition">
                                                    <td className="px-4 py-3 text-gray-400">{String(i + 1).padStart(2, '0')}</td>
                                                    {activeColumns.map(col => {
                                                        if (col.id === 'form_name') {
                                                            return <td key={col.id} className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{t.form_name || '—'}</td>;
                                                        }
                                                        if (col.id === 'client') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.client?.name || '—'}</td>;
                                                        }
                                                        if (col.id === 'mobile') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.client?.contact || '—'}</td>;
                                                        }
                                                        if (col.id === 'work_type') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.work_type?.name || '—'}</td>;
                                                        }
                                                        if (col.id === 'assigned_to') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap">{t.allocated_to?.name || '—'}</td>;
                                                        }
                                                        if (col.id === 'date_inward') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.date_inward || '—'}</td>;
                                                        }
                                                        if (col.id === 'status') {
                                                            return <td key={col.id} className="px-4 py-3 whitespace-nowrap"><StatusBadge status={t.status} /></td>;
                                                        }
                                                        if (col.id === 'task_particular') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[200px] truncate" title={t.task_particular}>{t.task_particular || '—'}</td>;
                                                        }
                                                        if (col.id === 'remarks') {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={t.remarks}>{t.remarks || '—'}</td>;
                                                        }
                                                        if (col.isDynamic) {
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={t.dynamic_fields?.[col.fieldName]}>{t.dynamic_fields?.[col.fieldName] || '—'}</td>;
                                                        }
                                                        return null;
                                                    })}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => openView(t)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition disabled:opacity-50">
                                                                <Eye size={15} />
                                                            </button>
                                                            <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Pencil size={15} /></button>
                                                            <button onClick={() => { setSelected(t); setDuplicateOpen(true) }} className="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition" title="Duplicate Sheet">
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
                    );
                })()}
            </div>

            {/* Reassign Modal */}
            <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign Sheet" width="max-w-sm">
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
                title="Delete Sheet"
                message={`Are you sure you want to delete this sheet for "${selected?.client?.name}"? This action cannot be undone.`}
                confirmLabel="Delete Sheet"
            />

            {/* Duplicate Modal */}
            <Modal open={duplicateOpen} onClose={() => setDuplicateOpen(false)} title="Duplicate Sheet" width="max-w-sm">
                <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-emerald-900 mb-1">
                                    Duplicate sheet for <span className="font-bold underline">{selected?.client?.name}</span>
                                </h3>
                            </div>
                        </div>
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

            {/* Import Mapping Modal */}
            <Modal open={importModalOpen} onClose={() => setImportModalOpen(false)} title="Map Excel Data" width="max-w-7xl">
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 items-end">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fallback Client (If missing in row)</label>
                            <select value={fallbackClient} onChange={e => setFallbackClient(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 transition">
                                <option value="">Do not use fallback</option>
                                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fallback Work Type (If missing in row)</label>
                            <select value={fallbackWorkType} onChange={e => setFallbackWorkType(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 transition">
                                <option value="">Do not use fallback</option>
                                {workTypes?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center h-[38px] pl-2 pb-1">
                            <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={ignoreIdsForCloning}
                                    onChange={e => setIgnoreIdsForCloning(e.target.checked)}
                                    className="w-4 h-4 rounded text-[#1F5C99] focus:ring-[#1F5C99] border-gray-300 transition"
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-800">Treat as New Sheets (Clone)</span>
                                    <span className="text-[9px] text-gray-400">Creates new sheets instead of updating historical ones</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col">
                        <div className="overflow-x-auto max-w-full">
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-sm min-w-max border-collapse">
                                    <thead className="sticky top-0 z-10 shadow-sm">
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            {importHeaders.map((header, idx) => (
                                                <th key={idx} className="p-2 border-r border-gray-200 last:border-r-0 min-w-[180px] bg-gray-100">
                                                    <div className="flex flex-col gap-2">
                                                        <span className="font-bold text-gray-700 truncate block text-left" title={header}>{header}</span>
                                                        <select
                                                            value={columnMapping[header] || 'ignore'}
                                                            onChange={(e) => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                                                            className="w-full px-2 py-1.5 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-[#1F5C99] transition font-medium text-gray-700"
                                                        >
                                                            <option value="ignore">-- Ignore Column --</option>
                                                            <option disabled>──────────</option>
                                                            <option value="client_id">Client Name</option>
                                                            <option value="client_mobile">Client Mobile Number</option>
                                                            <option value="work_type_id">Work Type</option>
                                                            <option value="form_name">Sheet / Form Name</option>
                                                            <option value="allocated_to">Assigned Staff</option>
                                                            <option value="date_allocated">Date Allocated</option>
                                                            <option value="status">Status</option>
                                                            <option value="remarks">Remarks</option>
                                                            <option disabled>──────────</option>
                                                            <option value={`dynamic_${header}`}>Dynamic Field (Custom)</option>
                                                        </select>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {importRawData.slice(0, 15).map((row, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-gray-50">
                                                {importHeaders.map((header, colIdx) => (
                                                    <td key={colIdx} className="p-3 border-r border-gray-100 last:border-r-0 text-gray-600 truncate max-w-[250px]" title={row[header]?.toString() || ''}>
                                                        {row[header]?.toString() || <span className="text-gray-300 italic">Empty</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        {importRawData.length > 15 && (
                            <div className="bg-gray-50 p-2 text-center text-xs text-gray-500 border-t border-gray-200">
                                Showing preview of first 15 rows. Total {importRawData.length} rows will be imported.
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <button onClick={() => setImportModalOpen(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition">
                            Cancel
                        </button>
                        <button onClick={submitImportMapping} disabled={saving} className="px-6 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition font-bold shadow-sm">
                            {saving ? 'Importing...' : `Import ${importRawData.length} Rows`}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}