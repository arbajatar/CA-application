import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserRoundCog, PlusCircle, Eye, Download, Copy, Folder as FolderIcon, ChevronLeft, Sliders, X, GripVertical, ArrowUpDown, ArrowUp, ArrowDown, FileText, CircleDashed, Clock, CheckCircle2, Circle, ChevronDown } from 'lucide-react'
import api from '../../api/axios'
import StatusBadge from '../../components/ui/StatusBadge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Tooltip from '../../components/ui/Tooltip'
import CustomSelect from '../../components/ui/CustomSelect'
import { formatDate } from '../../utils/dateHelper'
import { exportToExcel } from '../../utils/excelExport'


const EMPTY_FORM = {
    client_id: '', work_type_id: '', date_inward: '',
    allocated_to: '', date_allocated: new Date().toISOString().split('T')[0], remarks: ''
}

const statuses = [
    { value: '', label: 'All Status' },
    { value: 'complete', label: 'Complete' },
    { value: 'work_in_progress', label: 'Work In Progress' },
    { value: 'pending', label: 'Pending' },
    { value: 'not_to_be_done', label: 'Not To Be Done' },
    { value: 'other', label: 'Other' },
]

export default function TasksPage() {
    const location = useLocation()
    const navigate = useNavigate()
    const [tasks, setTasks] = useState([])
    const [meta, setMeta] = useState(null)
    const [summary, setSummary] = useState(null)
    const [summaryLoading, setSummaryLoading] = useState(false)
    const [clients, setClients] = useState([])
    const [workTypes, setWorkTypes] = useState([])
    const [staff, setStaff] = useState([])
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('')
    const [staffId, setStaffId] = useState(() => new URLSearchParams(location.search).get('staff_id') || '')
    const [clientId, setClientId] = useState('')
    const [workTypeId, setWorkTypeId] = useState(() => {
        const wId = new URLSearchParams(location.search).get('work_type_id');
        return wId === 'all' ? '' : (wId || '');
    })
    const [page, setPage] = useState(1)
    const [perPage, setPerPage] = useState(50)
    const [selectedSheetIds, setSelectedSheetIds] = useState([])

    const [reassignOpen, setReassignOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState({})
    const [duplicateOpen, setDuplicateOpen] = useState(false)
    const [duplicateSheetName, setDuplicateSheetName] = useState('')
    const [currentFolder, setCurrentFolder] = useState(() => {
        const params = new URLSearchParams(location.search);
        return params.get('work_type_id') || (params.get('staff_id') ? 'all' : null);
    })
    const [dynamicFilters, setDynamicFilters] = useState({})
    const [showColumnFilters, setShowColumnFilters] = useState(true)
    const [customColumnOrder, setCustomColumnOrder] = useState(null)
    const [draggedColumnIndex, setDraggedColumnIndex] = useState(null)
    const [dragOverColumnIndex, setDragOverColumnIndex] = useState(null)
    const [ignoreIdsForCloning, setIgnoreIdsForCloning] = useState(false)
    const fileInputRef = useRef(null)

    // Bulk Editing States
    const [pendingUpdates, setPendingUpdates] = useState({});

    // Advanced Bulk Update States
    const [bulkEditOpen, setBulkEditOpen] = useState(false)
    const [bulkEditTab, setBulkEditTab] = useState('fields') // 'fields' | 'dynamic' | 'subtasks'
    const [bulkMainFields, setBulkMainFields] = useState({
        client_id: '',
        work_type_id: '',
        allocated_to: '',
        form_name: '',
        status: 'pending',
        date_inward: '',
        date_allocated: new Date().toISOString().split('T')[0],
        remarks: '',
        allow_attachments: false
    })
    const [bulkUpdateTargets, setBulkUpdateTargets] = useState({
        client_id: false,
        work_type_id: false,
        allocated_to: false,
        form_name: false,
        status: false,
        date_inward: false,
        date_allocated: false,
        remarks: false,
        allow_attachments: false
    })
    const [bulkDynamicField, setBulkDynamicField] = useState('')
    const [bulkDynamicValue, setBulkDynamicValue] = useState('')
    const [bulkSubtaskMode, setBulkSubtaskMode] = useState('add') // 'add' | 'update' | 'delete'
    const [bulkSubtaskTitle, setBulkSubtaskTitle] = useState('')
    const [bulkSubtaskForm, setBulkSubtaskForm] = useState({
        assigned_to: '',
        priority: 'medium',
        status: 'pending',
        due_date: '',
        remarks: ''
    })

    const handleBulkFieldChange = (taskId, fieldKey, newValue) => {
        setPendingUpdates(prev => {
            const taskUpdates = prev[taskId] || {};
            return {
                ...prev,
                [taskId]: {
                    ...taskUpdates,
                    [fieldKey]: newValue
                }
            };
        });
    };

    const handleBulkDynamicFieldChange = (taskId, fieldName, newValue, currentTaskDynamicFields) => {
        setPendingUpdates(prev => {
            const taskUpdates = prev[taskId] || {};
            const draftDyn = taskUpdates.dynamic_fields 
                ? { ...taskUpdates.dynamic_fields } 
                : { ...(currentTaskDynamicFields || {}) };
            draftDyn[fieldName] = newValue;
            return {
                ...prev,
                [taskId]: {
                    ...taskUpdates,
                    dynamic_fields: draftDyn
                }
            };
        });
    };

    const handleSaveAllBulkUpdates = async () => {
        const taskIds = Object.keys(pendingUpdates);
        if (taskIds.length === 0) return;
        
        setSaving(true);
        try {
            await Promise.all(
                taskIds.map(taskId => {
                    const updates = pendingUpdates[taskId];
                    return api.patch(`/ca/tasks/${taskId}`, updates);
                })
            );
            toast.success(`Successfully saved updates for ${taskIds.length} sheets!`);
            setPendingUpdates({});
            fetchTasks();
        } catch (e) {
            toast.error('Failed to save bulk updates. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const openBulkEditModal = () => {
        setBulkEditOpen(true);
        setBulkEditTab('fields');
        setBulkDynamicField('');
        setBulkDynamicValue('');
        setBulkSubtaskTitle('');
        setBulkSubtaskMode('add');
        setBulkSubtaskForm({
            assigned_to: '',
            priority: 'medium',
            status: 'pending',
            due_date: '',
            remarks: ''
        });
        setBulkUpdateTargets({
            client_id: false,
            work_type_id: false,
            allocated_to: false,
            form_name: false,
            status: false,
            date_inward: false,
            date_allocated: false,
            remarks: false,
            allow_attachments: false
        });
    };

    const handleApplyBulkUpdates = async () => {
        if (selectedSheetIds.length === 0) return;
        
        setSaving(true);
        const toastId = toast.loading(`Applying changes to ${selectedSheetIds.length} sheets...`);
        try {
            await Promise.all(
                selectedSheetIds.map(async (taskId) => {
                    const task = tasks.find(t => t.id === taskId);
                    if (!task) return;

                    if (bulkEditTab === 'fields') {
                        const updates = {};
                        Object.keys(bulkUpdateTargets).forEach(key => {
                            if (bulkUpdateTargets[key]) {
                                if (key === 'allow_attachments') {
                                    updates[key] = !!bulkMainFields[key];
                                } else {
                                    updates[key] = bulkMainFields[key] || null;
                                }
                            }
                        });
                        if (Object.keys(updates).length > 0) {
                            await api.patch(`/ca/tasks/${taskId}`, updates);
                        }
                    } else if (bulkEditTab === 'dynamic') {
                        if (!bulkDynamicField) return;
                        const mergedDyn = { ...(task.dynamic_fields || {}), [bulkDynamicField]: bulkDynamicValue };
                        await api.patch(`/ca/tasks/${taskId}`, { dynamic_fields: mergedDyn });
                    } else if (bulkEditTab === 'subtasks') {
                        if (!bulkSubtaskTitle.trim()) return;

                        if (bulkSubtaskMode === 'add') {
                            await api.post(`/ca/tasks/${taskId}/sub-tasks`, {
                                title: bulkSubtaskTitle,
                                assigned_to: bulkSubtaskForm.assigned_to || null,
                                priority: bulkSubtaskForm.priority,
                                status: bulkSubtaskForm.status,
                                due_date: bulkSubtaskForm.due_date || null,
                                remarks: bulkSubtaskForm.remarks || null
                            });
                        } else {
                            // Find matching subtask by title
                            const matchingSt = (task.sub_tasks || []).find(st => 
                                st.title?.toLowerCase().trim() === bulkSubtaskTitle.toLowerCase().trim()
                            );
                            if (matchingSt) {
                                if (bulkSubtaskMode === 'update') {
                                    await api.patch(`/ca/tasks/${taskId}/sub-tasks/${matchingSt.id}`, {
                                        assigned_to: bulkSubtaskForm.assigned_to || null,
                                        priority: bulkSubtaskForm.priority,
                                        status: bulkSubtaskForm.status,
                                        due_date: bulkSubtaskForm.due_date || null,
                                        remarks: bulkSubtaskForm.remarks || null
                                    });
                                } else if (bulkSubtaskMode === 'delete') {
                                    await api.delete(`/ca/tasks/${taskId}/sub-tasks/${matchingSt.id}`);
                                }
                            }
                        }
                    }
                })
            );

            toast.success(`Successfully updated ${selectedSheetIds.length} sheets!`, { id: toastId });
            setBulkEditOpen(false);
            setSelectedSheetIds([]);
            fetchTasks();
            fetchSummary();
        } catch (e) {
            console.error('Bulk update failed', e);
            toast.error('Failed to complete some bulk updates. Please check connection and try again.', { id: toastId });
        } finally {
            setSaving(false);
        }
    };

    // Column Sorting States
    const [sortField, setSortField] = useState(null)
    const [sortDirection, setSortDirection] = useState('default') // 'default' | 'asc' | 'desc'

    const handleSort = (fieldId) => {
        if (sortField !== fieldId) {
            setSortField(fieldId)
            setSortDirection('asc')
        } else {
            if (sortDirection === 'default') {
                setSortDirection('asc')
            } else if (sortDirection === 'asc') {
                setSortDirection('desc')
            } else {
                setSortField(null)
                setSortDirection('default')
            }
        }
    }

    // Import Mapping Modal States
    const [importModalOpen, setImportModalOpen] = useState(false)
    const [importRawData, setImportRawData] = useState([])
    const [importHeaders, setImportHeaders] = useState([])
    const [columnMapping, setColumnMapping] = useState({})
    const [fallbackClient, setFallbackClient] = useState('')
    const [fallbackWorkType, setFallbackWorkType] = useState('')
    const [selectedImportIndexes, setSelectedImportIndexes] = useState([])

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

    const fetchTasks = useCallback(async (silent = false) => {
        if (!currentFolder) {
            setTasks([])
            setMeta(null)
            setLoading(false)
            return
        }
        if (!silent) setLoading(true)
        setSelectedSheetIds([]) // reset selection on new fetch
        try {
            const res = await api.get('/ca/tasks', {
                params: { search, status, staff_id: staffId, client_id: clientId, work_type_id: workTypeId, page, per_page: perPage, with_subtasks: 1 }
            })
            setTasks(res.data.data || [])
            setMeta(res.data.meta)
        } catch (e) {
            toast.error('Failed to fetch tasks')
            setTasks([])
        } finally {
            if (!silent) setLoading(false)
        }
    }, [currentFolder, search, status, staffId, clientId, workTypeId, page, perPage])

    const fetchSummary = useCallback(async () => {
        setSummaryLoading(true)
        try {
            const res = await api.get('/ca/dashboard/summary', {
                params: { work_type_id: workTypeId, allocated_to: staffId }
            })
            setSummary(res.data)
        } catch (e) {
            console.error('Failed to fetch summary counts')
        } finally {
            setSummaryLoading(false)
        }
    }, [workTypeId, staffId])

    // Listen for real-time changes
    useEffect(() => {
        const handleTasksChanged = () => {
            fetchTasks(true)
            fetchSummary()
            fetchDropdowns()
        }
        const handleClientsOrStaffChanged = () => {
            fetchDropdowns()
        }
        window.addEventListener('tasks_changed', handleTasksChanged)
        window.addEventListener('clients_changed', handleClientsOrStaffChanged)
        window.addEventListener('staff_changed', handleClientsOrStaffChanged)
        return () => {
            window.removeEventListener('tasks_changed', handleTasksChanged)
            window.removeEventListener('clients_changed', handleClientsOrStaffChanged)
            window.removeEventListener('staff_changed', handleClientsOrStaffChanged)
        }
    }, [fetchTasks, fetchSummary])

    useEffect(() => {
        if (currentFolder) {
            fetchSummary()
        }
    }, [currentFolder, workTypeId, staffId, fetchSummary])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const sId = params.get('staff_id')
        const wId = params.get('work_type_id')
        
        setStaffId(sId || '')
        
        // Sync states if URL changes (e.g. clicking different quick links)
        setWorkTypeId(wId === 'all' ? '' : (wId || ''))
        setCurrentFolder(wId || (sId ? 'all' : null))
        setDynamicFilters({})
        
        // Reset sorting states to return to current view's default unsorted order
        setSortField(null)
        setSortDirection('default')
        
        fetchDropdowns()
    }, [location.search])

    useEffect(() => { fetchTasks() }, [fetchTasks])



    const handleDelete = async () => {
        setSaving(true)
        try {
            await api.delete(`/ca/tasks/${selected.id}`)
            toast.success('Task deleted successfully')
            setDeleteOpen(false); fetchTasks(); if (currentFolder) fetchSummary();
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
                
                // Parse 2D row array representation to dynamically handle headers
                const rawSheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                if (rawSheetRows.length === 0) {
                    toast.error('Excel file is empty');
                    return;
                }

                // 1. Dynamically detect header row index (scanning up to first 15 rows)
                let headerRowIndex = 0;
                for (let i = 0; i < Math.min(rawSheetRows.length, 15); i++) {
                    const row = rawSheetRows[i];
                    if (!row || row.length === 0) continue;
                    
                    const hasSrNo = row.some(cell => {
                        const s = String(cell).toLowerCase().trim();
                        return s === 'sr no' || s === 'sr. no' || s === 'sr_no' || s === 'serial no';
                    });
                    const hasClient = row.some(cell => {
                        const s = String(cell).toLowerCase().trim();
                        return s.includes('client') || s.includes('cleint') || s.includes('customer');
                    });
                    const hasPan = row.some(cell => {
                        const s = String(cell).toLowerCase().trim();
                        return s.includes('pan no') || s.includes('pan card') || s.includes('pan_no');
                    });
                    
                    if (hasSrNo || (hasClient && hasPan)) {
                        headerRowIndex = i;
                        break;
                    }
                }

                // 2. Extract and sanitize column headers from headerRowIndex
                const originalHeaderRow = rawSheetRows[headerRowIndex] || [];
                const headers = originalHeaderRow.map((h, colIdx) => {
                    const cleaned = String(h || '').trim();
                    return cleaned || `Column ${colIdx + 1}`;
                });

                let rawData = [];
                // Parse data rows starting *after* headerRowIndex
                for (let i = headerRowIndex + 1; i < rawSheetRows.length; i++) {
                    const row = rawSheetRows[i];
                    if (!row || row.length === 0) continue;
                    
                    // Skip instruction rows or guide rows
                    const isGuideOrEmpty = row.every(cell => !cell) || row.some(cell => {
                        const s = String(cell).toLowerCase().trim();
                        return s === 'text' || s === 'drop down' || s === 'dropdown' || s.startsWith('calender') || s.includes('should be displayed');
                    });
                    if (isGuideOrEmpty) continue;
                    
                    const rowObj = {};
                    let hasValue = false;
                    
                    originalHeaderRow.forEach((headerName, colIdx) => {
                        const keyName = String(headerName || '').trim() || `Column ${colIdx + 1}`;
                        const val = row[colIdx] !== undefined ? row[colIdx] : '';
                        rowObj[keyName] = val;
                        if (val !== '') hasValue = true;
                    });
                    
                    if (hasValue && rowObj[headers[0]] !== '') {
                        rawData.push(rowObj);
                    }
                }

                if (rawData.length === 0) {
                    toast.error('No valid rows found to import after parsing.');
                    return;
                }

                setImportHeaders(headers);
                setImportRawData(rawData);
                setSelectedImportIndexes(rawData.map((_, idx) => idx));
                
                // Try to auto-map some obvious ones
                const initialMapping = {};
                headers.forEach(h => {
                    const lh = h.toLowerCase().trim();
                    if (['sheet id', 'task id', 'id', 'sheet_id'].includes(lh)) initialMapping[h] = 'sheet_id';
                    else if (['subtask id', 'task id (checklist)', 'task id (for updates)', 'task_id', 'subtask_id'].includes(lh)) initialMapping[h] = 'subtask_id';
                    else if (['client name', 'name of client', 'client', 'client_name', 'name of cleint'].includes(lh)) initialMapping[h] = 'client_id';
                    else if (['mobile no', 'client mobile', 'mobile', 'client_mobile'].includes(lh)) initialMapping[h] = 'client_mobile';
                    else if (['work type', 'main task', 'related matter', 'task type', 'work_type_id'].includes(lh)) initialMapping[h] = 'work_type_id';
                    else if (['form name', 'related matter detailed', 'sheet name'].includes(lh)) initialMapping[h] = 'form_name';
                    else if (['date allocated', 'date', 'date of creation of task', 'date inward', 'date of receipt of documents'].includes(lh)) initialMapping[h] = 'date_allocated';
                    else if (['assignee', 'team member name', 'task allocation to', 'team member'].includes(lh)) initialMapping[h] = 'allocated_to';
                    else if (['status', 'sheet status', 'global status'].includes(lh)) initialMapping[h] = 'status';
                    else if (['remarks', 'global remarks', 'final remark', 'team remark'].includes(lh)) initialMapping[h] = 'remarks';
                    else if (['subtask name', 'task name', 'st_name'].includes(lh)) initialMapping[h] = 'st_name';
                    else if (['subtask assignee', 'task assignee', 'st_assignee', 'assignee'].includes(lh) && !initialMapping[h]) initialMapping[h] = 'st_assignee';
                    else if (['subtask priority', 'task priority', 'priority', 'st_priority'].includes(lh)) initialMapping[h] = 'st_priority';
                    else if (['subtask status', 'task status', 'st_status'].includes(lh)) initialMapping[h] = 'st_status';
                    else if (['subtask due date', 'task due date', 'due date', 'st_due_date'].includes(lh) && !initialMapping[h]) initialMapping[h] = 'st_due_date';
                    else if (['subtask remarks', 'task remarks', 'st_remarks'].includes(lh)) initialMapping[h] = 'st_remarks';
                    else if (lh !== 'sr no' && lh !== 'sr_no') initialMapping[h] = 'dynamic_' + h; // default to dynamic field
                });
                
                setColumnMapping(initialMapping);
                setFallbackClient('');
                
                // Intelligently auto-match Work Type from file name or sheet name keywords
                let matchedWorkTypeId = '';
                const fileNameLower = file.name.toLowerCase();
                const sheetNameLower = wb.SheetNames[0].toLowerCase();
                const matchedWorkType = workTypes.find(wt => {
                    const nameLower = wt.name.toLowerCase();
                    return fileNameLower.includes(nameLower) || sheetNameLower.includes(nameLower);
                });
                if (matchedWorkType) {
                    matchedWorkTypeId = matchedWorkType.id;
                    toast.success(`Auto-matched folder: "${matchedWorkType.name}" based on spreadsheet content!`, { duration: 4000 });
                } else if (currentFolder && currentFolder !== 'all') {
                    matchedWorkTypeId = currentFolder;
                } else if (workTypes.length > 0) {
                    matchedWorkTypeId = workTypes[0].id;
                }
                setFallbackWorkType(matchedWorkTypeId);
                
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

    const handleCellChange = (rowIdx, header, newValue) => {
        setImportRawData(prev => {
            const copy = [...prev];
            copy[rowIdx] = { ...copy[rowIdx], [header]: newValue };
            return copy;
        });
    };

    const submitImportMapping = async () => {
        setSaving(true);
        try {
            const selectedRows = importRawData.filter((_, idx) => selectedImportIndexes.includes(idx));
            if (selectedRows.length === 0) {
                toast.error('No rows selected for import.');
                setSaving(false);
                return;
            }
            const taskGroups = new Map();

            selectedRows.forEach(row => {
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
                const groupKey = sheetId ? `sheet_${sheetId}` : `new_${rowClientName}_${rowWorkTypeName}_${taskProps.form_name || ''}`;
                
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

            const headers = ['SR NO', 'Sheet Name', 'Work Type', 'Remark'];
            const rows = filteredExportTasks.map((task, idx) => [
                String(idx + 1).padStart(2, '0'),
                task.form_name || '',
                task.work_type?.name || '',
                task.remarks || ''
            ]);

            const folderName = currentFolder === 'all'
                ? 'All_Sheets'
                : (workTypes.find(w => w.id == currentFolder)?.name || 'Sheets');

            await exportToExcel({
                filename: `${folderName.replace(/\s+/g, '_')}_export_${new Date().toISOString().split('T')[0]}.xlsx`,
                sheets: [
                    {
                        sheetName: 'Sheet Export',
                        title: `${folderName} Register`,
                        subtitle: `Generated at: ${new Date().toLocaleString()}`,
                        headers,
                        rows
                    }
                ]
            });
        } catch (err) {
            console.error('Export Error:', err);
            toast.error('Failed to export sheet');
        } finally {
            setSaving(false);
        }
    };

    const openDuplicateModal = (task) => {
        setSelected(task);
        setDuplicateSheetName(`${task.form_name} (Copy)`);
        setDuplicateOpen(true);
    };

    const handleDuplicate = async (withData) => {
        setDuplicateOpen(false);
        setSaving(true);
        try {
            // Fetch FULL task details to get dynamic fields and subtasks
            const res = await api.get(`/ca/tasks/${selected.id}`);
            const fullTask = res.data.data;

            const newName = duplicateSheetName;
            const trimmedName = (newName || '').trim();
            if (!trimmedName) {
                toast.error("Sheet Name cannot be empty.");
                setSaving(false);
                return;
            }

            const payload = {
                form_name: trimmedName,
                client_id: withData ? (fullTask.client?.id || null) : null,
                work_type_id: fullTask.work_type?.id || null,
                date_inward: new Date().toISOString().split('T')[0],
                allocated_to: withData ? (fullTask.allocated_to?.id || null) : null,
                date_allocated: withData ? (fullTask.date_allocated || null) : null,
                due_date: withData ? (fullTask.due_date || null) : null,
                status: 'pending', // Always start new sheet as pending
                remarks: withData ? (fullTask.remarks || '') : '',
                task_particular: withData ? (fullTask.task_particular || '') : '',
                sub_status: withData ? (fullTask.sub_status || '') : '',
                feedback: withData ? (fullTask.feedback || '') : '',
                entry_date: withData ? (fullTask.entry_date || null) : null,
                allow_attachments: !!fullTask.allow_attachments,
                allow_checklist: !!fullTask.allow_checklist,
                allow_notes: !!fullTask.allow_notes,
                permissions: (fullTask.permissions || []).map(p => ({
                    role_id: Number(p.role_id),
                    can_read: !!p.can_read,
                    can_write: !!p.can_write,
                    can_delete: !!p.can_delete
                })),
                dynamic_fields: withData ? fullTask.dynamic_fields : {
                    ...(fullTask.dynamic_fields || {}),
                    multi_rows: [],
                    ...Object.fromEntries(
                        Object.keys(fullTask.dynamic_fields || {})
                            .filter(k => !['schema', 'multi_rows', 'field_names', 'field_types', 'CA Feedback', 'CA Rating'].includes(k))
                            .map(k => [k, ''])
                    )
                },
                subtasks: (fullTask.sub_tasks || []).map(st => ({
                    title: st.title,
                    assigned_to: withData ? st.assigned_to?.id : null,
                    priority: withData ? st.priority : 'medium',
                    status: 'pending', // Reset status for new task
                    due_date: withData ? st.due_date : null,
                    remarks: withData ? st.remarks : ''
                }))
            };

            await api.post('/ca/tasks', payload);
            toast.success('Sheet duplicated successfully!');
            fetchTasks();
        } catch (err) {
            console.error('Duplication Error:', err);
            toast.error('Failed to duplicate sheet');
        } finally {
            setSaving(false);
        }
    };

    const openEdit = async (task) => {
        const toastId = toast.loading('Loading sheet layout for editing...');
        try {
            // Fetch FULL task details to get dynamic fields and subtasks
            const res = await api.get(`/ca/tasks/${task.id}`);
            const fullTask = res.data.data;

            // Prepare pre-filled data for TaskBuilder in Edit Mode
            const duplicateData = {
                form_name: fullTask.form_name,
                client_id: fullTask.client?.id,
                work_type_id: fullTask.work_type?.id,
                remarks: fullTask.remarks,
                dynamic_fields: fullTask.dynamic_fields,
                created_at: fullTask.created_at,
                status: fullTask.status,
                allow_attachments: fullTask.allow_attachments,
                subtasks: (fullTask.sub_tasks || []).map(st => ({
                    title: st.title,
                    assigned_to: st.assigned_to?.id,
                    priority: st.priority,
                    status: st.status,
                    due_date: st.due_date,
                    remarks: st.remarks
                }))
            };

            toast.dismiss(toastId);
            navigate('/ca/tasks/builder', { state: { duplicateData, isEditing: true, taskId: fullTask.id } });
        } catch (err) {
            console.error('Edit Error:', err);
            toast.error('Failed to load sheet details for editing', { id: toastId });
        }
    };

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

    const FolderCard = ({ name, iconBg, iconColor, onClick }) => {
        const borderClasses = {
            'text-slate-500': 'border-slate-200 hover:border-slate-500',
            'text-blue-500': 'border-blue-200 hover:border-blue-500',
            'text-orange-500': 'border-orange-200 hover:border-orange-500',
            'text-emerald-500': 'border-emerald-200 hover:border-emerald-500',
            'text-sky-500': 'border-sky-200 hover:border-sky-500',
            'text-teal-500': 'border-teal-200 hover:border-teal-500',
            'text-red-500': 'border-red-200 hover:border-red-500',
            'text-indigo-500': 'border-indigo-200 hover:border-indigo-500',
            'text-purple-500': 'border-purple-200 hover:border-purple-500',
            'text-pink-500': 'border-pink-200 hover:border-pink-500',
        };
        const colorClasses = borderClasses[iconColor] || 'border-slate-200 hover:border-[#1F5C99]';

        return (
            <div
                onClick={onClick}
                className={`group cursor-pointer p-5 bg-white rounded-2xl border ${colorClasses} shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col items-center gap-4 text-center select-none`}
            >
                <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                    <FolderIcon size={32} className={iconColor} fill="currentColor" fillOpacity={0.2} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight group-hover:text-[#1F5C99] transition-colors">{name}</h3>
                </div>
            </div>
        );
    };

    const SummaryCard = ({ icon: Icon, iconBg, iconColor, label, value, sub, subColor, onClick, active }) => {
        let inactiveBgClass = '';
        let activeClass = '';

        if (iconColor.includes('blue')) {
            inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0F7FF] border-blue-100 text-slate-750 hover:border-blue-300';
            activeClass = 'active-card-blue ring-4 ring-blue-500/5 shadow-lg shadow-blue-500/5 scale-[1.02]';
        } else if (iconColor.includes('amber') || iconColor.includes('yellow')) {
            inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFFBEB] border-amber-100 text-slate-750 hover:border-amber-300';
            activeClass = 'active-card-amber ring-4 ring-amber-500/5 shadow-lg shadow-amber-500/5 scale-[1.02]';
        } else if (iconColor.includes('green') || iconColor.includes('emerald')) {
            inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0FDF4] border-emerald-100 text-slate-750 hover:border-emerald-300';
            activeClass = 'active-card-emerald ring-4 ring-emerald-500/5 shadow-lg shadow-emerald-500/5 scale-[1.02]';
        } else if (iconColor.includes('red') || iconColor.includes('rose')) {
            inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFF5F5] border-red-100 text-slate-750 hover:border-red-300';
            activeClass = 'active-card-rose ring-4 ring-red-500/5 shadow-lg shadow-red-500/5 scale-[1.02]';
        } else {
            inactiveBgClass = 'bg-gradient-to-br from-white to-[#F8FAFC] border-slate-200 text-slate-750 hover:border-slate-400';
            activeClass = 'active-card-slate ring-4 ring-slate-500/5 shadow-lg shadow-slate-500/5 scale-[1.02]';
        }

        return (
            <div 
                onClick={onClick}
                className={`rounded-2xl p-4.5 transition-all duration-300 flex flex-col gap-3.5 cursor-pointer select-none border
                    ${active 
                        ? `${activeClass} -translate-y-0.5` 
                        : `${inactiveBgClass} shadow-sm hover:-translate-y-0.5 hover:shadow-md`}`}
            >
                <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl transition-colors ${iconBg}`}>
                        <Icon size={18} className={iconColor} />
                    </div>
                    <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
                </div>
                <div>
                    <p className="text-xs font-semibold text-slate-900">{label}</p>
                    <p className={`text-[10px] font-medium mt-0.5 ${subColor || 'text-slate-600'}`}>{sub}</p>
                </div>
            </div>
        );
    };

    const SheetSmallCard = ({ task }) => (
        <Tooltip content={`${task.form_name || 'Unnamed Sheet'} — ${task.client?.name || 'No Client'}`}>
            <div 
                onClick={() => navigate(`/ca/tasks/${task.id}`)}
                className="group cursor-pointer bg-white rounded-xl p-3 border border-slate-200 hover:border-[#1F5C99] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3 select-none w-full"
            >
                <div className="p-2 rounded-lg bg-[#E8F1FC] text-[#1F5C99] group-hover:scale-105 transition-transform duration-200">
                    <FileText size={18} />
                </div>
                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-gray-800 text-xs truncate group-hover:text-[#1F5C99] transition-colors">
                        {task.form_name || 'Unnamed Sheet'}
                    </h4>
                </div>
            </div>
        </Tooltip>
    );

    const summaryCards = [
        {
            label: 'Total Tasks', value: summary?.total_tasks ?? 0,
            icon: FileText, iconBg: 'bg-slate-50', iconColor: 'text-slate-500',
            sub: 'All sheets in this folder',
            active: status === '',
            onClick: () => { setStatus(''); setPage(1); }
        },
        {
            label: 'Pending', value: summary?.pending_tasks ?? 0,
            icon: CircleDashed, iconBg: 'bg-amber-50', iconColor: 'text-amber-500',
            sub: 'Waiting to start',
            subColor: 'text-amber-500 font-medium',
            active: status === 'pending',
            onClick: () => { setStatus('pending'); setPage(1); }
        },
        {
            label: 'Work In Progress', value: summary?.work_in_progress_tasks ?? 0,
            icon: Clock, iconBg: 'bg-blue-50', iconColor: 'text-blue-500',
            sub: 'Currently active',
            subColor: 'text-blue-500 font-medium',
            active: status === 'work_in_progress',
            onClick: () => { setStatus('work_in_progress'); setPage(1); }
        },
        {
            label: 'Complete', value: summary?.completed_tasks ?? 0,
            icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-500',
            sub: 'Completed successfully',
            subColor: 'text-green-500 font-medium',
            active: status === 'complete',
            onClick: () => { setStatus('complete'); setPage(1); }
        },
        {
            label: 'Not To Be Done', value: summary?.not_to_be_done_tasks ?? 0,
            icon: Circle, iconBg: 'bg-red-50', iconColor: 'text-red-500',
            sub: 'Cancelled / Skipped',
            subColor: 'text-red-500 font-medium',
            active: status === 'not_to_be_done',
            onClick: () => { setStatus('not_to_be_done'); setPage(1); }
        },
        {
            label: 'Other', value: summary?.other_tasks ?? 0,
            icon: Sliders, iconBg: 'bg-slate-50', iconColor: 'text-slate-500',
            sub: 'Other status',
            active: status === 'other',
            onClick: () => { setStatus('other'); setPage(1); }
        },
    ];


    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        {currentFolder && (
                            <button
                                onClick={() => {
                                    setWorkTypeId('');
                                    setPage(1);
                                    setCurrentFolder(null);
                                    navigate('/ca/tasks');
                                }}
                                className="flex items-center gap-1 text-[#1F5C99] hover:text-[#154673] transition text-sm font-semibold mr-1"
                            >
                                <ChevronLeft size={16} /> Folders
                            </button>
                        )}
                        {currentFolder && <span className="text-gray-300 text-sm font-medium mr-2">/</span>}
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sheets Management</h1>
                        {currentFolder && (
                            <div className="flex items-center text-gray-405 text-lg font-medium">
                                <span className="mx-1">/</span>
                                <span className="text-[#1F5C99]">{currentFolder === 'all' ? 'All Sheets' : workTypes.find(w => w.id == currentFolder)?.name}</span>
                            </div>
                        )}
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-1">Monitor, assign, and manage all office work entries.</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImport}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 disabled:opacity-50"
                    >
                        Import Data
                    </button> */}
                    <button onClick={() => navigate('/ca/tasks/builder', { state: { workTypeId: currentFolder && currentFolder !== 'all' ? currentFolder : '' } })}
                        className="flex items-center justify-center gap-2 bg-[#0f1c2e] hover:bg-[#1a2f4a] text-white px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition duration-200 active:scale-95 w-full sm:w-auto">
                        <Plus size={15} /> Create New Sheet
                    </button>
                </div>
            </div>

            {currentFolder && (
                <>


                    {/* Small Sheet Cards Grid */}
                    {tasks && tasks.length > 0 && (
                        <div className="my-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm animate-fade-in">
                            <h3 className="text-sm font-extrabold text-slate-800 tracking-wide mb-3 flex items-center gap-2">
                                <FileText size={16} className="text-[#1F5C99]" />
                                Sheets Quick Overview
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {tasks.map(t => (
                                    <SheetSmallCard key={t.id} task={t} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

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
                                    setPage(1);
                                    navigate('/ca/tasks?work_type_id=all');
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
                                            setPage(1);
                                            navigate(`/ca/tasks?work_type_id=${wt.id}`);
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ) : (() => {
                    // Fixed columns — show only the specified sheet management fields
                    const baseColumns = [
                        { id: 'form_name', label: 'Sheet Name' },
                        { id: 'remarks', label: 'Remark' },
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

                    const allFields = activeColumns.map(col => {
                        if (col.id === 'form_name') return { key: 'form_name', label: 'Sheet Name', isStatic: true };
                        if (col.id === 'client') return { key: 'client_name', label: 'Client Name', isStatic: true };
                        if (col.id === 'mobile') return { key: 'client_contact', label: 'Phone Number', isStatic: true };
                        if (col.id === 'work_type') return { key: 'work_type', label: 'Work Type', isStatic: true };
                        if (col.id === 'assigned_to') return { key: 'assigned_to', label: 'Assigned To', isStatic: true };
                        if (col.id === 'date_inward') return { key: 'date_inward', label: 'Create Date', isStatic: true };
                        if (col.id === 'status') return { key: 'status', label: 'Sheet Status', isStatic: true };
                        if (col.id === 'remarks') return { key: 'remarks', label: 'Remark', isStatic: true };
                        if (col.id === 'ca_feedback') return { key: 'CA Feedback', label: 'CA Feedback', isStatic: false };
                        if (col.id === 'ca_rating') return { key: 'CA Rating', label: 'CA Rating', isStatic: false };
                        return null;
                    }).filter(Boolean);

                    const filteredTasks = tasks?.filter(t => {
                        return allFields.every(field => {
                            const query = dynamicFilters[field.key];
                            if (!query) return true;

                            let value = '';
                            if (field.isStatic) {
                                if (field.key === 'form_name') value = t.form_name;
                                else if (field.key === 'client_name') value = t.client?.name;
                                else if (field.key === 'client_contact') value = t.client?.contact;
                                else if (field.key === 'work_type') value = t.work_type?.name;
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

                    const sortedTasks = sortField && sortDirection !== 'default'
                        ? [...filteredTasks].sort((a, b) => {
                            let valA = '';
                            let valB = '';

                            if (sortField === 'form_name') {
                                valA = a.form_name || '';
                                valB = b.form_name || '';
                            } else if (sortField === 'client') {
                                valA = a.client?.name || '';
                                valB = b.client?.name || '';
                            } else if (sortField === 'mobile') {
                                valA = a.client?.contact || '';
                                valB = b.client?.contact || '';
                            } else if (sortField === 'work_type') {
                                valA = a.work_type?.name || '';
                                valB = b.work_type?.name || '';
                            } else if (sortField === 'assigned_to') {
                                valA = a.allocated_to?.name || '';
                                valB = b.allocated_to?.name || '';
                            } else if (sortField === 'date_inward') {
                                valA = a.date_inward || '';
                                valB = b.date_inward || '';
                            } else if (sortField === 'status') {
                                valA = a.status || '';
                                valB = b.status || '';
                            } else if (sortField === 'task_particular') {
                                valA = a.task_particular || '';
                                valB = b.task_particular || '';
                            } else if (sortField === 'remarks') {
                                valA = a.remarks || '';
                                valB = b.remarks || '';
                            } else if (sortField.startsWith('dynamic_')) {
                                const fieldName = sortField.replace('dynamic_', '');
                                valA = a.dynamic_fields?.[fieldName] || '';
                                valB = b.dynamic_fields?.[fieldName] || '';
                            }

                            const strA = (valA ?? '').toString().toLowerCase();
                            const strB = (valB ?? '').toString().toLowerCase();

                            if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
                            if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
                            return 0;
                        })
                        : filteredTasks;

                    return (
                        <>
                            {/* Filters */}
                            <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100">
                                <button
                                    onClick={() => {
                                        setPage(1);
                                        navigate('/ca/tasks');
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
                                <div className="flex flex-wrap items-center gap-2 pb-1 lg:pb-0 w-full lg:w-auto">
                                    <CustomSelect
                                        value={status}
                                        onChange={e => { setStatus(e.target.value); setPage(1) }}
                                        options={statuses}
                                        widthClass="min-w-[125px] shrink-0"
                                    />
                                    {currentFolder === 'all' && (
                                        <CustomSelect
                                            value={workTypeId}
                                            onChange={e => { setWorkTypeId(e.target.value); setPage(1) }}
                                            options={[
                                                { value: '', label: 'All Work Types' },
                                                ...(workTypes || []).map(w => ({ value: w.id, label: w.name }))
                                            ]}
                                            widthClass="min-w-[145px] lg:max-w-[150px] shrink-0"
                                        />
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
                            <div className="overflow-x-auto relative min-h-[200px]">
                                {loading && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-50">
                                        <Spinner />
                                    </div>
                                )}
                                <table className={`w-full text-sm ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
                                    <thead>
                                        <tr className="text-xs font-bold text-white uppercase tracking-wider border-b border-[#154673] bg-[#1F5C99]">
                                            <th className="px-4 py-3.5 text-left whitespace-nowrap w-[60px]">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox"
                                                        checked={tasks.length > 0 && selectedSheetIds.length === tasks.length}
                                                        onChange={() => {
                                                            if (selectedSheetIds.length === tasks.length) {
                                                                setSelectedSheetIds([]);
                                                            } else {
                                                                setSelectedSheetIds(tasks.map(t => t.id));
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer"
                                                    />
                                                    <span>#</span>
                                                </div>
                                            </th>
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
                                                        className={`px-4 py-3 text-left whitespace-nowrap select-none cursor-grab active:cursor-grabbing transition-all duration-150 group/th border-b border-[#154673] text-white font-bold ${
                                                            isDragging ? 'opacity-40 bg-slate-100/20 scale-95 border-dashed border-2 border-slate-300' : ''
                                                        } ${
                                                            isDragOver && !isDragging ? 'bg-[#154673] border-l-2 border-blue-400 scale-102 shadow-sm' : ''
                                                        }`}
                                                        title="Drag to rearrange column order"
                                                    >
                                                        <div className="flex items-center gap-1.5 justify-between">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <GripVertical size={13} className="text-blue-200 shrink-0 cursor-grab group-hover/th:text-white transition" />
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSort(col.id);
                                                                    }}
                                                                    className="flex items-center gap-1 cursor-pointer hover:text-white transition min-w-0 select-none"
                                                                    title="Click to sort (Default ⇄ Ascending ⇄ Descending)"
                                                                >
                                                                    <span className={`font-bold transition truncate ${sortField === col.id ? 'text-white font-extrabold underline decoration-blue-200 decoration-2' : 'text-blue-50'}`}>{col.label}</span>
                                                                    {sortField === col.id ? (
                                                                        sortDirection === 'asc' ? (
                                                                            <ArrowUp size={13} className="text-white shrink-0" />
                                                                        ) : (
                                                                            <ArrowDown size={13} className="text-white shrink-0" />
                                                                        )
                                                                    ) : (
                                                                        <ArrowUpDown size={13} className="text-blue-200 group-hover/th:text-white shrink-0 opacity-0 group-hover/th:opacity-100 transition" />
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                            <th className="px-4 py-3.5 text-left whitespace-nowrap sticky right-0 bg-[#1F5C99] z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] border-b border-[#154673] text-white font-bold">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {sortedTasks?.length === 0 ? (
                                            <tr><td colSpan={2 + activeColumns.length} className="text-center py-12 text-gray-400">No sheets found matching filters</td></tr>
                                        ) : sortedTasks?.map((t, i) => (
                                                <tr 
                                                    key={t.id} 
                                                    className={`transition duration-150 border-b border-gray-100 ${
                                                        (pendingUpdates[t.id] && Object.keys(pendingUpdates[t.id]).length > 0) ? 'bg-amber-50/70 hover:bg-amber-100/80 border-l-4 border-amber-500 shadow-[inset_0_1px_0_rgba(251,191,36,0.1),_inset_0_-1px_0_rgba(251,191,36,0.1)]' 
                                                            : 'hover:bg-slate-50/80 bg-white'
                                                    }`}
                                                >
                                                    <td className="px-4 py-3 text-gray-400 font-semibold text-xs w-[60px]">
                                                        <div className="flex items-center gap-2">
                                                            <input 
                                                                type="checkbox"
                                                                checked={selectedSheetIds.includes(t.id)}
                                                                onChange={() => {
                                                                    setSelectedSheetIds(prev => 
                                                                        prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id]
                                                                    );
                                                                }}
                                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer"
                                                            />
                                                            <span>{String(i + 1).padStart(2, '0')}</span>
                                                        </div>
                                                    </td>
                                                    {activeColumns.map(col => {
                                                        if (col.id === 'form_name') {
                                                            const draftVal = pendingUpdates[t.id]?.form_name !== undefined ? pendingUpdates[t.id].form_name : (t.form_name || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[150px]">
                                                                    <input 
                                                                        type="text" 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'form_name', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-800 w-full outline-none transition"
                                                                    />
                                                                </td>
                                                             );
                                                        }
                                                        if (col.id === 'client') {
                                                            const draftVal = pendingUpdates[t.id]?.client_id !== undefined ? pendingUpdates[t.id].client_id : (t.client?.id || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[180px]">
                                                                    <select 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'client_id', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition"
                                                                    >
                                                                        <option value="">— Select Client —</option>
                                                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                    </select>
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'mobile') {
                                                            const currentClientId = pendingUpdates[t.id]?.client_id !== undefined ? pendingUpdates[t.id].client_id : (t.client?.id || '');
                                                            const selectedClientObj = clients.find(c => String(c.id) === String(currentClientId));
                                                            const mobileDisplay = selectedClientObj ? selectedClientObj.contact : (t.client?.contact || '—');
                                                            return <td key={col.id} className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs font-semibold">{mobileDisplay}</td>;
                                                        }
                                                        if (col.id === 'work_type') {
                                                            const draftVal = pendingUpdates[t.id]?.work_type_id !== undefined ? pendingUpdates[t.id].work_type_id : (t.work_type?.id || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[180px]">
                                                                    <select 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'work_type_id', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition"
                                                                    >
                                                                        <option value="">— Select Work Type —</option>
                                                                        {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                                                    </select>
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'assigned_to') {
                                                            const draftVal = pendingUpdates[t.id]?.allocated_to !== undefined ? pendingUpdates[t.id].allocated_to : (t.allocated_to?.id || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[180px]">
                                                                    <select 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'allocated_to', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition"
                                                                    >
                                                                        <option value="">— Select Assigned To —</option>
                                                                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                    </select>
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'date_inward') {
                                                            const draftVal = pendingUpdates[t.id]?.date_inward !== undefined ? pendingUpdates[t.id].date_inward : (t.date_inward || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[140px]">
                                                                    <input 
                                                                        type="date" 
                                                                        value={draftVal ? draftVal.substring(0, 10) : ''}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'date_inward', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition"
                                                                    />
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'status') {
                                                            const draftVal = pendingUpdates[t.id]?.status !== undefined ? pendingUpdates[t.id].status : (t.status || 'assigned');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[150px]">
                                                                    <select 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'status', e.target.value)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-bold text-gray-700 w-full outline-none transition capitalize"
                                                                    >
                                                                        <option value="complete">Complete</option>
                                                                        <option value="work_in_progress">Work In Progress</option>
                                                                        <option value="pending">Pending</option>
                                                                        <option value="not_to_be_done">Not To Be Done</option>
                                                                        <option value="other">Other</option>
                                                                    </select>
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'task_particular') {
                                                            const draftVal = pendingUpdates[t.id]?.task_particular !== undefined ? pendingUpdates[t.id].task_particular : (t.task_particular || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 min-w-[220px]">
                                                                    <textarea 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'task_particular', e.target.value)}
                                                                        rows={2}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition resize-y min-h-[40px] leading-relaxed"
                                                                    />
                                                                </td>
                                                            );
                                                        }
                                                        if (col.id === 'remarks') {
                                                            const draftVal = pendingUpdates[t.id]?.remarks !== undefined ? pendingUpdates[t.id].remarks : (t.remarks || '');
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 min-w-[220px]">
                                                                    <textarea 
                                                                        value={draftVal}
                                                                        onChange={e => handleBulkFieldChange(t.id, 'remarks', e.target.value)}
                                                                        rows={2}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition resize-y min-h-[40px] leading-relaxed"
                                                                    />
                                                                </td>
                                                            );
                                                        }
                                                        if (col.isDynamic) {
                                                            const val = pendingUpdates[t.id]?.dynamic_fields?.[col.fieldName] !== undefined 
                                                                ? pendingUpdates[t.id].dynamic_fields[col.fieldName] 
                                                                : (t.dynamic_fields?.[col.fieldName] || '');
                                                            
                                                            if (col.fieldName === 'CA Rating') {
                                                                const ratingNum = parseInt(val || '0');
                                                                return (
                                                                    <td key={col.id} className="px-4 py-3 whitespace-nowrap min-w-[120px]">
                                                                        <div className="flex items-center gap-0.5 text-amber-500 text-sm leading-none">
                                                                            {Array.from({ length: 5 }).map((_, starI) => {
                                                                                const starVal = starI + 1;
                                                                                const isSelected = starVal <= ratingNum;
                                                                                return (
                                                                                    <button
                                                                                        key={starI}
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const nextVal = ratingNum === starVal ? '0' : String(starVal);
                                                                                            handleBulkDynamicFieldChange(t.id, 'CA Rating', nextVal, t.dynamic_fields);
                                                                                        }}
                                                                                        className={`transition-all hover:scale-125 text-sm ${isSelected ? 'text-amber-500 font-bold' : 'text-slate-200 hover:text-amber-400'}`}
                                                                                    >
                                                                                        ★
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            }
                                                            
                                                            const displayVal = Array.isArray(val) ? val.join(', ') : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (val || ''));
                                                            if (col.fieldName === 'CA Feedback') {
                                                                return (
                                                                    <td key={col.id} className="px-3 py-1.5 min-w-[220px]">
                                                                        <textarea 
                                                                            value={displayVal}
                                                                            onChange={e => handleBulkDynamicFieldChange(t.id, col.fieldName, e.target.value, t.dynamic_fields)}
                                                                            rows={2}
                                                                            className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition resize-y min-h-[40px] leading-relaxed"
                                                                        />
                                                                    </td>
                                                                );
                                                            }
                                                            if (col.fieldName === 'CA Remark') {
                                                                return (
                                                                    <td key={col.id} className="px-3 py-1.5 min-w-[220px]">
                                                                        <textarea 
                                                                            value={displayVal}
                                                                            onChange={e => handleBulkDynamicFieldChange(t.id, col.fieldName, e.target.value, t.dynamic_fields)}
                                                                            rows={2}
                                                                            className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition resize-y min-h-[40px] leading-relaxed"
                                                                        />
                                                                    </td>
                                                                );
                                                            }
                                                            return (
                                                                <td key={col.id} className="px-3 py-1.5 whitespace-nowrap min-w-[160px]">
                                                                    <input 
                                                                        type="text" 
                                                                        value={displayVal}
                                                                        onChange={e => handleBulkDynamicFieldChange(t.id, col.fieldName, e.target.value, t.dynamic_fields)}
                                                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-xs font-semibold text-gray-700 w-full outline-none transition"
                                                                    />
                                                                </td>
                                                            );
                                                        }
                                                    })}
                                                    <td className="px-4 py-3 whitespace-nowrap sticky right-0 bg-white group-hover/row:bg-gray-100 transition shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] z-10">
                                                        <div className="flex items-center gap-2">
                                                            <Tooltip content="View Sheet">
                                                                <button onClick={() => openView(t)} className="p-1.5 rounded-lg bg-indigo-50/70 border border-indigo-100/40 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 hover:scale-110 active:scale-95 transition-all disabled:opacity-50">
                                                                    <Eye size={15} />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip content="Edit Sheet">
                                                                <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg bg-blue-50/70 border border-blue-100/40 text-blue-600 hover:bg-blue-100 hover:text-blue-800 hover:scale-110 active:scale-95 transition-all"><Pencil size={15} /></button>
                                                            </Tooltip>
                                                            <Tooltip content="Duplicate Sheet">
                                                                <button onClick={() => openDuplicateModal(t)} className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100/40 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 hover:scale-110 active:scale-95 transition-all">
                                                                    <Copy size={15} />
                                                                </button>
                                                            </Tooltip>
                                                            <Tooltip content="Delete Sheet" position="left">
                                                                <button onClick={() => { setSelected(t); setDeleteOpen(true) }} className="p-1.5 rounded-lg bg-rose-50/70 border border-rose-100/40 text-rose-650 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 transition-all"><Trash2 size={15} /></button>
                                                            </Tooltip>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {meta && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/20">
                                    <div className="flex items-center gap-4">
                                        <p className="text-xs text-gray-500 font-semibold">Showing {meta.from || 0}–{meta.to || 0} of {meta.total || 0}</p>
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                                            <span>Show:</span>
                                            <select 
                                                value={perPage} 
                                                onChange={e => {
                                                    setPerPage(Number(e.target.value));
                                                    setPage(1); // reset to page 1
                                                }}
                                                className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5C99] bg-white font-bold"
                                            >
                                                <option value={50}>50</option>
                                                <option value={100}>100</option>
                                                <option value={150}>150</option>
                                            </select>
                                        </div>
                                    </div>
                                    {meta.last_page > 1 && (
                                        <div className="flex gap-2">
                                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition font-black">Previous</button>
                                            <button disabled={page === meta.last_page} onClick={() => setPage(p => p + 1)}
                                                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition font-black">Next</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    );
                })()}
            </div>




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
                                    Duplicate sheet: <span className="font-bold underline">{selected?.form_name}</span>
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Sheet Name</label>
                        <input
                            type="text"
                            value={duplicateSheetName}
                            onChange={e => setDuplicateSheetName(e.target.value)}
                            placeholder="Enter new sheet name..."
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-semibold"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <button
                            onClick={() => handleDuplicate(true)}
                            disabled={saving}
                            className="flex flex-col items-start p-4 bg-white border border-gray-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/30 transition group text-left w-full"
                        >
                            <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-700">Duplicate with Data</span>
                            <span className="text-[11px] text-gray-400 mt-1">Copies all dynamic fields and tasks</span>
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
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 transition font-medium text-gray-700">
                                <option value="">Do not use fallback</option>
                                {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fallback Work Type (If missing in row)</label>
                            <select value={fallbackWorkType} onChange={e => setFallbackWorkType(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 transition font-medium text-gray-700">
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

                    {fallbackWorkType ? (
                        <div className="flex items-center gap-3 p-3.5 bg-blue-50/50 border border-blue-100/80 rounded-xl text-blue-900 text-xs">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                            <span>
                                <strong>Import Destination Folder:</strong> Rows without an explicit "Work Type" column mapped will be automatically added to the <strong>"{workTypes.find(w => w.id.toString() === fallbackWorkType.toString())?.name}"</strong> folder.
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-medium animate-pulse">
                            <span>⚠️ <strong>No Destination Folder Selected:</strong> Please choose a "Fallback Work Type" above or map a "Work Type" column to avoid empty import errors.</span>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col shadow-sm">
                        <div className="overflow-x-auto max-w-full">
                            <div className="max-h-[60vh] overflow-y-auto">
                                <table className="w-full text-sm min-w-max border-collapse">
                                    <thead className="sticky top-0 z-20 shadow-sm">
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <th className="p-2 border-r border-gray-200 bg-gray-100 w-[50px] text-center sticky left-0 z-30">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedImportIndexes.length === importRawData.length && importRawData.length > 0}
                                                    onChange={() => {
                                                        if (selectedImportIndexes.length === importRawData.length) {
                                                            setSelectedImportIndexes([]);
                                                        } else {
                                                            setSelectedImportIndexes(importRawData.map((_, idx) => idx));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded text-[#1F5C99] focus:ring-[#1F5C99] border-gray-300 transition cursor-pointer"
                                                />
                                            </th>
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
                                                            <option value="sheet_id">Sheet ID (For updates)</option>
                                                            <option value="client_id">Client Name</option>
                                                            <option value="client_mobile">Client Mobile Number</option>
                                                            <option value="work_type_id">Work Type</option>
                                                            <option value="form_name">Sheet / Form Name</option>
                                                            <option value="allocated_to">Assigned Staff</option>
                                                            <option value="date_allocated">Date Allocated</option>
                                                            <option value="status">Status</option>
                                                            <option value="remarks">Remarks</option>
                                                            <option disabled>── Task Checklist Columns ──</option>
                                                            <option value="subtask_id">Task ID (For updates)</option>
                                                            <option value="st_name">Task Name</option>
                                                            <option value="st_assignee">Task Assignee</option>
                                                            <option value="st_priority">Task Priority</option>
                                                            <option value="st_status">Task Status</option>
                                                            <option value="st_due_date">Task Due Date</option>
                                                            <option value="st_remarks">Task Remarks</option>
                                                            <option disabled>──────────</option>
                                                            <option value={`dynamic_${header}`}>Dynamic Field (Custom)</option>
                                                        </select>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {importRawData.map((row, rowIdx) => (
                                            <tr key={rowIdx} className={`hover:bg-gray-50/70 transition ${selectedImportIndexes.includes(rowIdx) ? 'bg-blue-50/20' : 'opacity-65 bg-gray-50/40'}`}>
                                                <td className="p-2 border-r border-gray-100 text-center sticky left-0 bg-white z-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedImportIndexes.includes(rowIdx)}
                                                        onChange={() => {
                                                            setSelectedImportIndexes(prev => 
                                                                prev.includes(rowIdx) ? prev.filter(i => i !== rowIdx) : [...prev, rowIdx]
                                                            );
                                                        }}
                                                        className="w-4 h-4 rounded text-[#1F5C99] focus:ring-[#1F5C99] border-gray-300 transition cursor-pointer"
                                                    />
                                                </td>
                                                {importHeaders.map((header, colIdx) => (
                                                    <td key={colIdx} className="p-1 border-r border-gray-100 last:border-r-0 min-w-[180px]">
                                                        <input
                                                            type="text"
                                                            value={row[header] !== undefined ? row[header] : ''}
                                                            onChange={(e) => handleCellChange(rowIdx, header, e.target.value)}
                                                            className="w-full px-2 py-1 text-xs bg-transparent border-0 hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-[#1F5C99]/30 focus:border-[#1F5C99] rounded transition text-gray-700 font-medium"
                                                        />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-2.5 text-center text-xs text-slate-500 border-t border-gray-200 font-semibold flex items-center justify-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Successfully loaded {importRawData.length} records. double-click/type in cells to edit, or use checkboxes to select rows.
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                        <button onClick={() => setImportModalOpen(false)} className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition">
                            Cancel
                        </button>
                        <button onClick={submitImportMapping} disabled={saving} className="px-6 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition font-bold shadow-sm">
                            {saving ? 'Importing...' : `Import ${selectedImportIndexes.length} Selected Rows`}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Helper functions for Bulk Edit Modal dynamic key lookups */}
            {(() => {
                const getUniqueDynamicFieldKeys = () => {
                    const keysSet = new Set();
                    tasks.forEach(t => {
                        if (t.dynamic_fields) {
                            Object.keys(t.dynamic_fields).forEach(k => {
                                if (!['schema', 'multi_rows', 'field_names', 'field_types'].includes(k)) {
                                    keysSet.add(k);
                                }
                            });
                        }
                    });
                    return Array.from(keysSet).sort();
                };

                const getUniqueSubtaskTitlesOfSelected = () => {
                    const titles = new Set();
                    selectedSheetIds.forEach(id => {
                        const task = tasks.find(t => t.id === id);
                        if (task && task.sub_tasks) {
                            task.sub_tasks.forEach(st => {
                                if (st.title) titles.add(st.title.trim());
                            });
                        }
                    });
                    return Array.from(titles).sort();
                };

                return (
                    <>
                        {/* Advanced Bulk Edit Modal */}
                        <Modal open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} title={`Bulk Edit Selected Sheets (${selectedSheetIds.length} sheets)`} width="max-w-xl">
                            <div className="space-y-6">
                                {/* Tab Navigation */}
                                <div className="flex border-b border-gray-200">
                                    {[
                                        { id: 'fields', label: 'Main Fields' },
                                        { id: 'dynamic', label: 'Custom Dynamic Fields' },
                                        { id: 'subtasks', label: 'Checklist / Tasks' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setBulkEditTab(tab.id)}
                                            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 transition duration-200 -mb-px ${
                                                bulkEditTab === tab.id
                                                    ? 'border-blue-600 text-blue-600'
                                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Tab 1: Main Fields */}
                                {bulkEditTab === 'fields' && (
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        <p className="text-xs text-gray-500 italic">Select which fields you want to update across all selected sheets. Fields left unchecked will remain unmodified.</p>
                                        
                                        {/* status */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.status}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, status: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Sheet Status</label>
                                                <select
                                                    disabled={!bulkUpdateTargets.status}
                                                    value={bulkMainFields.status}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, status: e.target.value }))}
                                                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                >
                                                    <option value="complete">Complete</option>
                                                    <option value="work_in_progress">Work In Progress</option>
                                                    <option value="pending">Pending</option>
                                                    <option value="not_to_be_done">Not To Be Done</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* allocated_to */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.allocated_to}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, allocated_to: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Assigned Staff</label>
                                                <select
                                                    disabled={!bulkUpdateTargets.allocated_to}
                                                    value={bulkMainFields.allocated_to}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, allocated_to: e.target.value }))}
                                                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                >
                                                    <option value="">— Unassigned —</option>
                                                    {staff.filter(s => s.is_active).map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* remarks */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.remarks}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, remarks: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-650 uppercase tracking-wider">Remarks</label>
                                                <textarea
                                                    disabled={!bulkUpdateTargets.remarks}
                                                    value={bulkMainFields.remarks}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, remarks: e.target.value }))}
                                                    placeholder="Enter bulk remarks..."
                                                    rows={2}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 resize-none font-semibold text-gray-700"
                                                />
                                            </div>
                                        </div>

                                        {/* client_id */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.client_id}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, client_id: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Client Name</label>
                                                <select
                                                    disabled={!bulkUpdateTargets.client_id}
                                                    value={bulkMainFields.client_id}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, client_id: e.target.value }))}
                                                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                >
                                                    <option value="">Select client</option>
                                                    {clients.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* work_type_id */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.work_type_id}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, work_type_id: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Work Type</label>
                                                <select
                                                    disabled={!bulkUpdateTargets.work_type_id}
                                                    value={bulkMainFields.work_type_id}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, work_type_id: e.target.value }))}
                                                    className="w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                >
                                                    <option value="">Select work type</option>
                                                    {workTypes.map(w => (
                                                        <option key={w.id} value={w.id}>{w.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* form_name */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.form_name}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, form_name: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Sheet / Form Name</label>
                                                <input
                                                    type="text"
                                                    disabled={!bulkUpdateTargets.form_name}
                                                    value={bulkMainFields.form_name}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, form_name: e.target.value }))}
                                                    placeholder="Enter sheet name..."
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* date_inward */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.date_inward}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, date_inward: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Create Date</label>
                                                <input
                                                    type="date"
                                                    disabled={!bulkUpdateTargets.date_inward}
                                                    value={bulkMainFields.date_inward}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, date_inward: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* date_allocated */}
                                        <div className="flex items-start gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.date_allocated}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, date_allocated: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition mt-1 cursor-pointer"
                                            />
                                            <div className="flex-1 space-y-1.5">
                                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider">Date Allocated</label>
                                                <input
                                                    type="date"
                                                    disabled={!bulkUpdateTargets.date_allocated}
                                                    value={bulkMainFields.date_allocated}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, date_allocated: e.target.value }))}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50"
                                                />
                                            </div>
                                        </div>

                                        {/* allow_attachments */}
                                        <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={bulkUpdateTargets.allow_attachments}
                                                onChange={e => setBulkUpdateTargets(prev => ({ ...prev, allow_attachments: e.target.checked }))}
                                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer"
                                            />
                                            <div className="flex-1 flex items-center justify-between">
                                                <label className="text-xs font-bold text-gray-650 uppercase tracking-wider">Allow Attachments</label>
                                                <input
                                                    type="checkbox"
                                                    disabled={!bulkUpdateTargets.allow_attachments}
                                                    checked={bulkMainFields.allow_attachments}
                                                    onChange={e => setBulkMainFields(prev => ({ ...prev, allow_attachments: e.target.checked }))}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer disabled:opacity-50 font-semibold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Tab 2: Custom Dynamic Fields */}
                                {bulkEditTab === 'dynamic' && (
                                    <div className="space-y-4">
                                        <p className="text-xs text-gray-500 italic">Enter a value for any dynamic custom field across all selected sheets. Only the chosen dynamic field will be updated.</p>
                                        
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dynamic Field Name</label>
                                            <select
                                                value={bulkDynamicField}
                                                onChange={e => setBulkDynamicField(e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-semibold text-gray-700"
                                            >
                                                <option value="">— Select dynamic field —</option>
                                                {getUniqueDynamicFieldKeys().map(k => (
                                                    <option key={k} value={k}>{k}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bulk Value</label>
                                            <input
                                                type="text"
                                                disabled={!bulkDynamicField}
                                                value={bulkDynamicValue}
                                                onChange={e => setBulkDynamicValue(e.target.value)}
                                                placeholder="Enter bulk value..."
                                                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 text-gray-700 font-semibold"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Tab 3: Checklist / Tasks */}
                                {bulkEditTab === 'subtasks' && (
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                        <div className="flex border border-gray-200 rounded-xl overflow-hidden shadow-sm max-w-sm">
                                            {[
                                                { id: 'add', label: 'Add Task' },
                                                { id: 'update', label: 'Update Task' },
                                                { id: 'delete', label: 'Delete Task' }
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setBulkSubtaskMode(mode.id);
                                                        setBulkSubtaskTitle('');
                                                    }}
                                                    className={`flex-1 text-center py-2 text-xs font-bold transition duration-200 ${
                                                        bulkSubtaskMode === mode.id
                                                            ? 'bg-[#EEF4FB] text-blue-600'
                                                            : 'bg-white text-gray-400 hover:text-gray-600'
                                                    }`}
                                                >
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Task Selector/Input */}
                                        {bulkSubtaskMode === 'add' ? (
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">New Task Name *</label>
                                                <input
                                                    type="text"
                                                    value={bulkSubtaskTitle}
                                                    onChange={e => setBulkSubtaskTitle(e.target.value)}
                                                    placeholder="e.g. Income Tax Filing"
                                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-semibold"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Task *</label>
                                                <select
                                                    value={bulkSubtaskTitle}
                                                    onChange={e => setBulkSubtaskTitle(e.target.value)}
                                                    className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition font-semibold text-gray-700"
                                                >
                                                    <option value="">— Select existing task —</option>
                                                    {getUniqueSubtaskTitlesOfSelected().map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Form fields (only render for Add & Update modes) */}
                                        {bulkSubtaskMode !== 'delete' && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned To</label>
                                                    <select
                                                        disabled={!bulkSubtaskTitle}
                                                        value={bulkSubtaskForm.assigned_to}
                                                        onChange={e => setBulkSubtaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 font-semibold"
                                                    >
                                                        <option value="">— Unassigned —</option>
                                                        {staff.filter(s => s.is_active).map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Priority</label>
                                                    <select
                                                        disabled={!bulkSubtaskTitle}
                                                        value={bulkSubtaskForm.priority}
                                                        onChange={e => setBulkSubtaskForm(prev => ({ ...prev, priority: e.target.value }))}
                                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 font-semibold"
                                                    >
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                                                    <select
                                                        disabled={!bulkSubtaskTitle}
                                                        value={bulkSubtaskForm.status}
                                                        onChange={e => setBulkSubtaskForm(prev => ({ ...prev, status: e.target.value }))}
                                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 font-semibold"
                                                    >
                                                        <option value="complete">Complete</option>
                                                        <option value="work_in_progress">Work In Progress</option>
                                                        <option value="pending">Pending</option>
                                                        <option value="not_to_be_done">Not To Be Done</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </div>

                                                <div className="space-y-1">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Due Date</label>
                                                    <input
                                                        type="date"
                                                        disabled={!bulkSubtaskTitle}
                                                        value={bulkSubtaskForm.due_date}
                                                        onChange={e => setBulkSubtaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 font-semibold"
                                                    />
                                                </div>

                                                <div className="space-y-1 sm:col-span-2">
                                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Task Remarks</label>
                                                    <textarea
                                                        disabled={!bulkSubtaskTitle}
                                                        value={bulkSubtaskForm.remarks}
                                                        onChange={e => setBulkSubtaskForm(prev => ({ ...prev, remarks: e.target.value }))}
                                                        placeholder="Enter task remarks..."
                                                        rows={2}
                                                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition disabled:opacity-50 resize-none font-semibold text-gray-700"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer Actions */}
                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setBulkEditOpen(false)}
                                        className="px-5 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleApplyBulkUpdates}
                                        disabled={
                                            saving ||
                                            (bulkEditTab === 'fields' && !Object.values(bulkUpdateTargets).some(Boolean)) ||
                                            (bulkEditTab === 'dynamic' && !bulkDynamicField) ||
                                            (bulkEditTab === 'subtasks' && !bulkSubtaskTitle.trim())
                                        }
                                        className="px-6 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-60 transition font-bold shadow-md shadow-blue-600/10"
                                    >
                                        {saving ? 'Applying...' : 'Apply Bulk Updates'}
                                    </button>
                                </div>
                            </div>
                        </Modal>

                        {/* Floating Selection Bar */}
                        {selectedSheetIds.length > 0 && Object.keys(pendingUpdates).length === 0 && (
                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl shadow-2xl py-3 px-6 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                                    <p className="text-xs font-semibold text-slate-200">
                                        <span className="font-extrabold text-blue-400">{selectedSheetIds.length}</span> sheets selected
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedSheetIds([])}
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                                    >
                                        Clear Selection
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openBulkEditModal}
                                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                                    >
                                        Bulk Edit
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Unsaved changes bulk update bar */}
                        {Object.keys(pendingUpdates).length > 0 && (
                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl shadow-2xl py-3 px-6 flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                    <p className="text-xs font-semibold text-slate-200">
                                        You have unsaved changes in <span className="font-extrabold text-amber-400">{Object.keys(pendingUpdates).length}</span> rows
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setPendingUpdates({})}
                                        disabled={saving}
                                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition disabled:opacity-50"
                                    >
                                        Discard
                                    </button>
                                    <button
                                        onClick={handleSaveAllBulkUpdates}
                                        disabled={saving}
                                        className="flex items-center gap-2 bg-[#1F5C99] hover:bg-[#154673] text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-[#1F5C99]/20 disabled:opacity-50"
                                    >
                                        {saving ? 'Saving...' : 'Save All Bulk Updates'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                );
            })()}
        </div>
    )
}