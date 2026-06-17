import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ChevronLeft, Save, Edit2, X, CheckCircle, Plus, Trash2, Layout, Search,
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, AlertCircle, GripVertical, Settings,
    Flag, UserPlus, CheckCircle2, Circle, MoreHorizontal, FileDown, FileUp, Eye, Copy, ChevronRight, Globe,
    PlusCircle, Check, CircleDashed, FileText, SlidersHorizontal, Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown,
    Key, EyeOff, ShieldCheck, ShieldAlert, ExternalLink, AlertTriangle
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import SubStatusPicker from '../../components/ui/SubStatusPicker';
import Tooltip from '../../components/ui/Tooltip';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { FIELD_TYPES } from '../../constants/fieldTypes';
import { formatDate, convertTo12Hour, convertTo24Hour } from '../../utils/dateHelper';
import TimePicker12Hour from '../../components/ui/TimePicker12Hour';
import { formatIndianCurrency, formatIndianCurrencyWithDecimals } from '../../utils/currencyHelper';
import AddTaskModal from '../../components/ca/AddTaskModal';
import BulkEditTaskModal from '../../components/ca/BulkEditTaskModal';
import SearchableSelect from '../../components/ui/SearchableSelect';
import { exportToExcel } from '../../utils/excelExport';
import Modal from '../../components/ui/Modal';



const DEFAULT_SUB_STATUSES = [
    'Documentation pending',
    'Awaiting approval',
    'Completed'
];

const getFileType = (url) => {
    if (!url) return 'unknown';
    const cleanUrl = url.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    return ext;
};

const getFileName = (url) => {
    if (!url) return 'attachment';
    const cleanUrl = url.split('?')[0].split('#')[0];
    return cleanUrl.split('/').pop() || 'attachment';
};

const getSubStatusOptions = (task, schemaList) => {
    // 1. Try local schema state if available
    if (Array.isArray(schemaList)) {
        const subStatusField = schemaList.find(f => f.id === 'static_sub_status');
        if (subStatusField && Array.isArray(subStatusField.options) && subStatusField.options.length > 0) {
            return subStatusField.options;
        }
    }
    // 2. Fallback to task dynamic fields
    if (task && task.dynamic_fields) {
        let fields = task.dynamic_fields;
        if (typeof fields === 'string') {
            try { fields = JSON.parse(fields); } catch(e) {}
        }
        const schema = fields?.schema;
        if (Array.isArray(schema)) {
            const subStatusField = schema.find(f => f.id === 'static_sub_status');
            if (subStatusField && Array.isArray(subStatusField.options) && subStatusField.options.length > 0) {
                return subStatusField.options;
            }
        }
    }
    return DEFAULT_SUB_STATUSES;
};

const SummaryCard = ({ icon: Icon, iconBg, iconColor, label, value, sub, subColor, onClick, active }) => {
    let inactiveBgClass = '';
    let activeClass = '';

    if (iconColor.includes('blue') || iconColor.includes('indigo')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0F7FF] border-blue-100 text-slate-750 hover:border-blue-300';
        activeClass = 'active-card-blue ring-2 ring-blue-500/10 shadow shadow-blue-500/5 scale-[1.01]';
    } else if (iconColor.includes('amber') || iconColor.includes('yellow')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFFBEB] border-amber-100 text-slate-750 hover:border-amber-300';
        activeClass = 'active-card-amber ring-2 ring-amber-500/10 shadow shadow-amber-500/5 scale-[1.01]';
    } else if (iconColor.includes('green') || iconColor.includes('emerald')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0FDF4] border-emerald-100 text-slate-750 hover:border-emerald-300';
        activeClass = 'active-card-emerald ring-2 ring-emerald-500/10 shadow shadow-emerald-500/5 scale-[1.01]';
    } else if (iconColor.includes('red') || iconColor.includes('rose')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFF5F5] border-red-100 text-slate-750 hover:border-red-300';
        activeClass = 'active-card-rose ring-2 ring-red-500/10 shadow shadow-rose-500/5 scale-[1.01]';
    } else {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F8FAFC] border-slate-200 text-slate-750 hover:border-slate-400';
        activeClass = 'active-card-slate ring-2 ring-slate-500/10 shadow shadow-slate-500/5 scale-[1.01]';
    }

    const dotColor = iconColor.replace('text-', 'bg-');

    return (
        <div 
            onClick={onClick}
            className={`rounded-2xl px-4 py-2.5 transition-all duration-300 flex items-center justify-between gap-4 cursor-pointer select-none border text-[11px] font-black uppercase tracking-wider
                ${active 
                    ? `${activeClass} -translate-y-0.5` 
                    : `${inactiveBgClass} shadow-sm hover:-translate-y-0.5 hover:shadow`}`}
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                <span className="text-slate-800 tracking-wide font-black truncate" title={label}>{label}</span>
            </div>
            <span className={`text-xs font-black shrink-0 ${iconColor}`}>{value || 0}</span>
        </div>
    );
};

const IconMap = {
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, Globe
};

const BufferedTextarea = ({ value, onChange, placeholder, className, style, disabled, rows = 1, ...props }) => {
    const [localVal, setLocalVal] = useState(value || '');
    const textareaRef = useRef(null);

    useEffect(() => {
        setLocalVal(value || '');
    }, [value]);

    const adjustHeight = (el) => {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    };

    useEffect(() => {
        if (textareaRef.current) {
            adjustHeight(textareaRef.current);
        }
    }, [localVal]);

    const handleBlur = (e) => {
        if (e.target.value !== (value || '')) {
            onChange(e.target.value);
        }
    };

    return (
        <textarea
            {...props}
            ref={textareaRef}
            rows={rows}
            value={localVal}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
            style={style}
            onChange={(e) => {
                setLocalVal(e.target.value);
            }}
            onBlur={handleBlur}
        />
    );
};

const BufferedCurrencyInput = ({ value, onChange, placeholder, className, style, disabled, isReadOnly, originalIndex, field, rows, setRows, ...props }) => {
    const [localVal, setLocalVal] = useState(value || '');

    useEffect(() => {
        setLocalVal(value || '');
    }, [value]);

    const handleBlur = (e) => {
        if (isReadOnly) return;
        const formattedBlur = formatIndianCurrencyWithDecimals(e.target.value);
        setLocalVal(formattedBlur);
        
        const newRows = [...rows];
        if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
        newRows[originalIndex].dynamic_data[field.label] = formattedBlur;

        const parseAmt = (val) => parseFloat(String(val || '0').replace(/,/g, '')) || 0;
        const total = parseAmt(newRows[originalIndex].dynamic_data?.['TOTAL INVOICE AMOUNT']);
        const p1 = parseAmt(newRows[originalIndex].dynamic_data?.['PAYMENT-1']);
        const p2 = parseAmt(newRows[originalIndex].dynamic_data?.['PAYMENT-2']);
        const p3 = parseAmt(newRows[originalIndex].dynamic_data?.['PAYMENT-3']);
        const balance = total - (p1 + p2 + p3);
        newRows[originalIndex].dynamic_data['BALANCE AMOUNT'] = formatIndianCurrencyWithDecimals(balance.toString());
        
        setRows(newRows);
    };

    return (
        <input
            {...props}
            type="text"
            value={localVal}
            disabled={disabled}
            placeholder={placeholder}
            className={className}
            style={style}
            onChange={(e) => {
                if (isReadOnly) return;
                const formatted = formatIndianCurrency(e.target.value);
                setLocalVal(formatted);
            }}
            onBlur={handleBlur}
        />
    );
};



const doesStaffMatchRow = (row, currentUser) => {
    if (!currentUser) return false;
    const type = row.allocated_type || 'user';
    const val = row.allocated_to;

    if (type === 'user') {
        return String(val) === String(currentUser.id);
    }
    if (type === 'users') {
        return Array.isArray(val) && val.map(String).includes(String(currentUser.id));
    }
    if (type === 'role') {
        const userRoleIds = Array.isArray(currentUser.role_ids) ? currentUser.role_ids.map(String) : [];
        return userRoleIds.includes(String(val));
    }
    return false;
};

export default function TaskDetailPage({ id: propId, hideBackHeader = false }) {
    const { user } = useAuth();
    const fetchCounterRef = useRef(0);
    const isAdmin = user?.role === 'ca';
    const isStaff = user?.role === 'staff';
    const { id: paramId } = useParams();
    const id = propId || paramId;
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    
    // Computed write access based on backend-supplied permissions
    const canWrite = isAdmin || !!task?.user_permissions?.can_write;
    const canDelete = isAdmin || !!task?.user_permissions?.can_delete;
    const [loading, setLoading] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [attachmentsModal, setAttachmentsModal] = useState({ open: false, title: '', files: [], type: 'subtask', id: null, originalIndex: null });
    const [incomingPreviewFile, setIncomingPreviewFile] = useState(null);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
    const [selectedSubStatusFilter, setSelectedSubStatusFilter] = useState(null);
    const [sheetSearch, setSheetSearch] = useState('');
    const [sheetStatusFilter, setSheetStatusFilter] = useState('');
    const [sheetWorkTypeFilter, setSheetWorkTypeFilter] = useState('');
    const [showMainStatusFilters, setShowMainStatusFilters] = useState(false);
    const [showSubStatusFilters, setShowSubStatusFilters] = useState(false);
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);
    const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
    const [previewRows, setPreviewRows] = useState([]);
    const [notesList, setNotesList] = useState([]);
    const notesKey = `task_notes_sheet_${id}`;

    useEffect(() => {
        const saved = localStorage.getItem(notesKey);
        try {
            const parsed = saved ? JSON.parse(saved) : [];
            setNotesList(parsed.length > 0 ? parsed : [{ id: 'init', text: '', timestamp: new Date().toLocaleString() }]);
        } catch {
            setNotesList([{ id: 'init', text: '', timestamp: new Date().toLocaleString() }]);
        }
    }, [notesKey]);

    const handleCopy = (text) => {
        if (!text) {
            toast.error('Nothing to copy!');
            return;
        }
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    // Sidebar state
    const [sidebarMode, setSidebarMode] = useState('fields'); // 'fields' or 'settings'
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFieldId, setActiveFieldId] = useState(null);
    const [draftField, setDraftField] = useState(null);
    const [globalStatus, setGlobalStatus] = useState('');
    const [globalRemarks, setGlobalRemarks] = useState('');
    const [caFeedback, setCaFeedback] = useState('');
    const [caRating, setCaRating] = useState('');
    const [isEditingFeedbackInline, setIsEditingFeedbackInline] = useState(false);
    const [editingFeedbackIndex, setEditingFeedbackIndex] = useState(null);
    const [editingCheckboxes, setEditingCheckboxes] = useState({});

    // Row Assignment Modal States
    const [assigningRowIndex, setAssigningRowIndex] = useState(null);
    const [assigningType, setAssigningType] = useState('user');
    const [assigningTo, setAssigningTo] = useState('');

    const [inlineFeedbackValue, setInlineFeedbackValue] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [focusedValue, setFocusedValue] = useState('');
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const [bulkEditOpen, setBulkEditOpen] = useState(false);
    const [bulkUpdateTargets, setBulkUpdateTargets] = useState({ client_id: false, allocated_to: false, status: false, sub_status: false, date_allocated: false, remarks: false });
    const [bulkMainFields, setBulkMainFields] = useState({ client_id: '', allocated_to: '', status: 'assigned', sub_status: '', date_allocated: '', remarks: '' });

    // Custom Confirm Dialog State
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: '',
        message: '',
        confirmLabel: '',
        onConfirm: null,
        danger: true,
        loading: false
    });

    // Roles & Permissions state
    const [availableRoles, setAvailableRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [sheetPermissions, setSheetPermissions] = useState([]);
    const [allowAttachments, setAllowAttachments] = useState(false);
    const [allowChecklist, setAllowChecklist] = useState(true);
    const [allowNotes, setAllowNotes] = useState(true);
    const [isBillableEnabled, setIsBillableEnabled] = useState(false);
    const [isAfterSalesEnabled, setIsAfterSalesEnabled] = useState(false);
    const [allowDuplicateClients, setAllowDuplicateClients] = useState(false);

    const handleAddRolePermission = () => {
        if (!selectedRoleId) {
            toast.error('Please select a role.');
            return;
        }
        const roleIdNum = Number(selectedRoleId);
        if (sheetPermissions.some(p => Number(p.role_id) === roleIdNum)) {
            toast.error('This role is already added.');
            return;
        }
        const roleObj = availableRoles.find(r => r.id === roleIdNum);
        setSheetPermissions(prev => [
            ...prev,
            {
                role_id: roleIdNum,
                role_name: roleObj?.name || `Role #${roleIdNum}`,
                can_read: true,
                can_write: true,
                can_delete: false,
            }
        ]);
        setSelectedRoleId('');
    };

    const handleRemoveRolePermission = (roleId) => {
        setSheetPermissions(prev => prev.filter(p => p.role_id !== roleId));
    };

    const handleTogglePermission = (index, key, val) => {
        setSheetPermissions(prev => prev.map((p, idx) => {
            if (idx === index) {
                return { ...p, [key]: val };
            }
            return p;
        }));
    };

    const EMPTY_CLIENT_FORM = {
        name: '',
        name_as_per_pan: '',
        pan_no: '',
        type: '',
        group: '',
        contact: '',
        alternative_contact: '',
        email: '',
        reference_no: '',
        dob: '',
        city: '',
        pin_code: '',
        state: '',
        gst_number: '',
        status: 'active',
        credentials: {
            efiling_password: '',
            ais_tis_password: ''
        }
    };

    // Dropdown Data
    const [clients, setClients] = useState([]);
    const [staff, setStaff] = useState([]);
    const [workTypes, setWorkTypes] = useState([]);
    const [clientTypes, setClientTypes] = useState([]);
    const [clientGroups, setClientGroups] = useState([]);
    const [isQuickAddClientOpen, setIsQuickAddClientOpen] = useState(false);
    const [quickAddClientForm, setQuickAddClientForm] = useState(EMPTY_CLIENT_FORM);
    const [quickAddClientErrors, setQuickAddClientErrors] = useState({});
    const [savingQuickClient, setSavingQuickClient] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    const getQuickClientPanValidation = () => {
        const pan = (quickAddClientForm?.pan_no || '').toUpperCase();
        if (!pan) return null;
        
        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
        if (!panRegex.test(pan)) {
            return { valid: false, msg: 'Invalid general PAN format (e.g. ABCDE1234F).' };
        }

        const typeOption = clientTypes.find(t => t.name === quickAddClientForm.type);
        if (typeOption && typeOption.pan_char) {
            const expectedChar = typeOption.pan_char.toUpperCase();
            const fourthChar = pan.charAt(3);
            if (fourthChar !== expectedChar) {
                return { valid: false, msg: `The 4th letter of PAN number must be '${expectedChar}' for Client Type '${quickAddClientForm.type}'.` };
            }
        }
        return { valid: true, msg: 'Valid PAN format.' };
    };

    const getQuickClientGstValidation = () => {
        const gst = (quickAddClientForm?.gst_number || '').toUpperCase();
        if (!gst) return null;

        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
        if (!gstRegex.test(gst)) {
            return { valid: false, msg: 'Invalid general GST format (e.g. 27AADCB1234F1Z1).' };
        }
        return { valid: true, msg: 'Valid GST format.' };
    };

    // Multi-row state
    const [formName, setFormName] = useState('');
    const [rows, setRows] = useState([]);
    const clientOptions = useMemo(() => {
        return (clients || []).map(c => ({
            value: c.id,
            label: c.name
        }));
    }, [clients]);

    const workTypeOptions = useMemo(() => {
        return (workTypes || []).map(w => ({
            value: w.id,
            label: w.name
        }));
    }, [workTypes]);

    const duplicateClientIds = useMemo(() => {
        if (allowDuplicateClients) return [];
        // Find duplicate client IDs
        const clientIds = (rows || []).map(r => r.client_id).filter(id => id !== null && id !== undefined && id !== '');
        const dupIds = clientIds.filter((id, index) => clientIds.indexOf(id) !== index);

        // Find duplicate PAN numbers
        const pans = (rows || []).map(r => {
            const cObj = clients.find(c => String(c.id) === String(r.client_id));
            return cObj?.pan_no ? cObj.pan_no.trim().toUpperCase() : '';
        }).filter(pan => pan !== '');
        const dupPans = pans.filter((pan, index) => pans.indexOf(pan) !== index);

        // Return client IDs that are duplicates by ID OR by PAN
        return (rows || []).filter(r => {
            if (!r.client_id) return false;
            const cObj = clients.find(c => String(c.id) === String(r.client_id));
            const hasDupId = dupIds.includes(r.client_id);
            const hasDupPan = cObj?.pan_no && dupPans.includes(cObj.pan_no.trim().toUpperCase());
            return hasDupId || hasDupPan;
        }).map(r => r.client_id);
    }, [rows, clients, allowDuplicateClients]);
    const [schema, setSchema] = useState([]); // Array of field objects
    const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);
    const [newTaskData, setNewTaskData] = useState({});
    const [editingRows, setEditingRows] = useState({});
    const [viewingRowIndex, setViewingRowIndex] = useState(null);
    const [modalEditable, setModalEditable] = useState(false);

    // Column Drag & Drop and Sorting/Filtering States
    const [customColumnOrder, setCustomColumnOrder] = useState(null);
    const [draggedColumnIndex, setDraggedColumnIndex] = useState(null);
    const [dragOverColumnIndex, setDragOverColumnIndex] = useState(null);
        const [sortField, setSortField] = useState(null);
    const [sortDirection, setSortDirection] = useState('default'); // 'default' | 'asc' | 'desc'
    const [dynamicFilters, setDynamicFilters] = useState({});
    const [showColumnFilters, setShowColumnFilters] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [totalRows, setTotalRows] = useState(0);
    const [statusCounts, setStatusCounts] = useState(null);
    const [subStatusCounts, setSubStatusCounts] = useState(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [debouncedFilters, setDebouncedFilters] = useState({});
    const [staticDataLoaded, setStaticDataLoaded] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(sheetSearch);
        }, 400);
        return () => clearTimeout(handler);
    }, [sheetSearch]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedFilters(dynamicFilters);
        }, 400);
        return () => clearTimeout(handler);
    }, [dynamicFilters]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedStatusFilter, selectedSubStatusFilter, debouncedSearch, sheetStatusFilter, sheetWorkTypeFilter, debouncedFilters]);

    const handleSort = (fieldId) => {
        if (sortField !== fieldId) {
            setSortField(fieldId);
            setSortDirection('asc');
        } else {
            if (sortDirection === 'default') {
                setSortDirection('asc');
            } else if (sortDirection === 'asc') {
                setSortDirection('desc');
            } else {
                setSortField(null);
                setSortDirection('default');
            }
        }
    };

    const fetchTaskData = async (isInitial = false, overridePage = null) => {
        if (isInitial) setLoading(true);
        else setIsSearching(true);
        const currentFetchId = ++fetchCounterRef.current;
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            
            const params = {
                page: overridePage !== null ? overridePage : currentPage,
                per_page: rowsPerPage,
                search: debouncedSearch || undefined,
                status: selectedStatusFilter || sheetStatusFilter || undefined,
                sub_status: selectedSubStatusFilter || undefined,
                work_type_id: sheetWorkTypeFilter || undefined,
                sort_field: sortField || undefined,
                sort_direction: sortDirection || undefined,
                column_filters: Object.keys(debouncedFilters).length > 0 ? JSON.stringify(debouncedFilters) : undefined
            };
 
            const taskRes = await api.get(`${apiPrefix}/tasks/${id}`, { params });
            if (currentFetchId !== fetchCounterRef.current) {
                return;
            }
            const data = taskRes.data.data;
            setTask(data);
            setTotalRows(taskRes.data.meta?.total || 0);
            setStatusCounts(taskRes.data.meta?.status_counts || null);
            setSubStatusCounts(taskRes.data.meta?.sub_status_counts || null);

            setGlobalStatus(data.status || 'assigned');
            setGlobalRemarks(data.remarks || '');
            setCaFeedback(data.dynamic_fields?.['CA Feedback'] || '');
            setCaRating(data.dynamic_fields?.['CA Rating'] || '');
            setInlineFeedbackValue(data.dynamic_fields?.['CA Feedback'] || '');
            setFormName(data.form_name || 'Untitled Form');
            setSheetPermissions(data.permissions || []);
            setAllowAttachments(!!data.allow_attachments);
            setAllowChecklist(!!data.allow_checklist);
            setAllowNotes(!!data.allow_notes);

            const parseBoolSetting = (val) => val === true || val === 1 || String(val).toLowerCase() === 'true' || String(val) === '1';
            setIsBillableEnabled(parseBoolSetting(data.is_billable ?? data.dynamic_fields?.is_billable));
            setIsAfterSalesEnabled(parseBoolSetting(data.is_after_sales ?? data.dynamic_fields?.is_after_sales));
            setAllowDuplicateClients(parseBoolSetting(data.allow_duplicate_clients ?? data.dynamic_fields?.allow_duplicate_clients));

            const getTopLevelData = (df) => {
                const topLevel = {};
                if (df) {
                    Object.keys(df).forEach(k => {
                        if (!['schema', 'multi_rows', 'field_names', 'field_types'].includes(k)) {
                            const trimmedK = k.trim();
                            const val = df[k];
                            if (val !== null && val !== undefined && val !== '') {
                                topLevel[trimmedK] = val;
                            } else if (topLevel[trimmedK] === undefined) {
                                topLevel[trimmedK] = val;
                            }
                        }
                    });
                }
                return topLevel;
            };

            const mergeDynamicData = (rowDynamicData, topLevel) => {
                let parsedRow = rowDynamicData;
                if (typeof parsedRow === 'string') {
                    try { parsedRow = JSON.parse(parsedRow); } catch(e) {}
                }
                const merged = {};
                if (parsedRow) {
                    Object.keys(parsedRow).forEach(k => {
                        const trimmedK = k.trim();
                        const val = parsedRow[k];
                        if (val !== null && val !== undefined && val !== '') {
                            merged[trimmedK] = val;
                        } else if (merged[trimmedK] === undefined) {
                            merged[trimmedK] = val;
                        }
                    });
                }
                Object.keys(topLevel || {}).forEach(k => {
                    const trimmedK = k.trim();
                    const topVal = topLevel[k];
                    if (topVal !== null && topVal !== undefined && topVal !== '') {
                        const rowVal = merged[trimmedK];
                        if (rowVal === null || rowVal === undefined || rowVal === '') {
                            merged[trimmedK] = topVal;
                        }
                    }
                });
                return merged;
            };

            const topLevelData = getTopLevelData(data.dynamic_fields);

            if (data.dynamic_fields?.schema) {
                setSchema(data.dynamic_fields.schema);
                let loadedRows = data.dynamic_fields.multi_rows || [];
                let needsSave = false;
                loadedRows = loadedRows.map((r, idx) => {
                    if (!r.row_id && !r.id) needsSave = true;
                    return {
                        ...r,
                        row_id: r.row_id || r.id || `row_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`
                    };
                });
                const isSheetEmpty = (taskRes.data.meta?.status_counts?.total ?? 0) === 0;
                if (loadedRows.length === 0 && isSheetEmpty) {
                    const initialRow = {
                        row_id: `row_${Date.now()}_0_${Math.random().toString(36).substr(2, 5)}`,
                        form_name: data.form_name || '',
                        client_id: data.client?.id || '',
                        work_type_id: data.work_type?.id || '',
                        allocated_to: data.allocated_to?.id || '',
                        date_allocated: data.date_allocated || '',
                        status: data.status || 'assigned',
                        dynamic_data: data.dynamic_fields?.schema
                            ? data.dynamic_fields.schema.reduce((acc, f) => {
                                  let defaultVal = '';
                                  if (f.value !== undefined && f.value !== null) {
                                      defaultVal = f.value;
                                  } else if (f.type === 'checkbox' || f.type === 'labels') {
                                      defaultVal = [];
                                  }
                                  return { ...acc, [f.label]: defaultVal };
                              }, {})
                            : topLevelData
                    };
                    loadedRows = [initialRow];
                    // Do not auto-save a blank initial row to the database
                    needsSave = false;
                }
                setRows(loadedRows);
                if (needsSave) {
                    const firstRow = loadedRows[0] || {};
                    const firstRowData = {};
                    if (firstRow.dynamic_data) {
                        Object.keys(firstRow.dynamic_data).forEach(k => {
                            firstRowData[k.trim()] = firstRow.dynamic_data[k];
                        });
                    }
                    const cleanDynamicFields = {};
                    ['schema', 'field_names', 'field_types'].forEach(k => {
                        if (data.dynamic_fields?.[k] !== undefined) {
                            cleanDynamicFields[k] = data.dynamic_fields[k];
                        }
                    });
                    const nextDynamicFields = {
                        ...cleanDynamicFields,
                        ...firstRowData,
                        multi_rows: loadedRows
                    };
                    const payload = {
                        client_id: (data.client && typeof data.client === 'object') ? data.client.id : (data.client_id ? Number(data.client_id) : null),
                        work_type_id: (data.work_type && typeof data.work_type === 'object') ? data.work_type.id : (data.work_type_id ? Number(data.work_type_id) : null),
                        allocated_to: (data.allocated_to && typeof data.allocated_to === 'object') ? data.allocated_to.id : (data.allocated_to ? Number(data.allocated_to) : null),
                        date_allocated: firstRow.date_allocated || data.date_allocated || null,
                        form_name: firstRow.form_name || data.form_name || '',
                        status: data.status,
                        dynamic_fields: nextDynamicFields
                    };
                    api.patch(`${apiPrefix}/tasks/${id}`, payload).catch(err => console.error("Quiet save failed", err));
                }
            } else {
                // Migration logic for old structure
                const fieldNames = data.dynamic_fields?.field_names || Object.keys(data.dynamic_fields || {}).filter(k => !['multi_rows', 'field_names', 'field_types'].includes(k));
                const fieldTypes = data.dynamic_fields?.field_types || {};

                const initialSchema = fieldNames.map(name => ({
                    id: Math.random().toString(36).substr(2, 9),
                    type: fieldTypes[name] || 'text',
                    label: name,
                    placeholder: `Enter ${name}...`,
                    required: false,
                    options: []
                }));
                setSchema(initialSchema);

                let loadedRows = data.dynamic_fields?.multi_rows || [];
                let needsSave = false;
                loadedRows = loadedRows.map((r, idx) => {
                    if (!r.row_id && !r.id) needsSave = true;
                    return {
                        ...r,
                        row_id: r.row_id || r.id || `row_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
                        dynamic_data: mergeDynamicData(r.dynamic_data, topLevelData)
                    };
                });
                const isSheetEmpty = (taskRes.data.meta?.status_counts?.total ?? 0) === 0;
                if (loadedRows.length === 0 && isSheetEmpty) {
                    const initialRow = {
                        row_id: `row_${Date.now()}_0_${Math.random().toString(36).substr(2, 5)}`,
                        client_id: data.client?.id || '',
                        work_type_id: data.work_type?.id || '',
                        allocated_to: data.allocated_to?.id || '',
                        date_allocated: data.date_allocated || '',
                        status: data.status || 'assigned',
                        dynamic_data: topLevelData
                    };
                    loadedRows = [initialRow];
                    // Do not auto-save a blank initial row to the database
                    needsSave = false;
                }
                setRows(loadedRows);
                if (needsSave) {
                    const firstRow = loadedRows[0] || {};
                    const firstRowData = {};
                    if (firstRow.dynamic_data) {
                        Object.keys(firstRow.dynamic_data).forEach(k => {
                            firstRowData[k.trim()] = firstRow.dynamic_data[k];
                        });
                    }
                    const cleanDynamicFields = {
                        schema: initialSchema
                    };
                    const nextDynamicFields = {
                        ...cleanDynamicFields,
                        ...firstRowData,
                        multi_rows: loadedRows
                    };
                    const payload = {
                        client_id: (data.client && typeof data.client === 'object') ? data.client.id : (data.client_id ? Number(data.client_id) : null),
                        work_type_id: (data.work_type && typeof data.work_type === 'object') ? data.work_type.id : (data.work_type_id ? Number(data.work_type_id) : null),
                        allocated_to: (data.allocated_to && typeof data.allocated_to === 'object') ? data.allocated_to.id : (data.allocated_to ? Number(data.allocated_to) : null),
                        date_allocated: firstRow.date_allocated || data.date_allocated || null,
                        form_name: firstRow.form_name || data.form_name || '',
                        status: data.status,
                        dynamic_fields: nextDynamicFields
                    };
                    api.patch(`${apiPrefix}/tasks/${id}`, payload).catch(err => console.error("Quiet save migration failed", err));
                }
            }
        } catch (e) {
            console.error(e);
            toast.error('Error loading task details');
        } finally {
            if (isInitial) setLoading(false);
            if (currentFetchId === fetchCounterRef.current) {
                setIsSearching(false);
            }
        }
    };

    useEffect(() => {
        // Reset pagination, search, and filter states when switching to a different sheet
        setCurrentPage(1);
        setSheetSearch('');
        setDebouncedSearch('');
        setSelectedStatusFilter(null);
        setSelectedSubStatusFilter(null);
        setSheetStatusFilter('');
        setSheetWorkTypeFilter('');
        setSortField(null);
        setSortDirection('default');
        setSelectedRowIds([]);

        const fetchInitialAllData = async () => {
            setLoading(true);
            try {
                const apiPrefix = isStaff ? '/staff' : '/ca';
                
                let clientsData = [];
                let staffData = null;
                let workTypesData = null;
                let clientTypesData = null;
                let clientGroupsData = null;
                let rolesData = null;

                // 1. Fetch clients fresh from API to ensure newly added clients from the registry are always searchable
                try {
                    const clientsRes = await api.get(isStaff ? '/daily-reports/clients' : '/ca/clients', { params: { simple: 1 } });
                    clientsData = clientsRes.data.data || clientsRes.data || [];
                    try {
                        sessionStorage.setItem('cached_clients', JSON.stringify(clientsData));
                    } catch (cacheErr) {
                        console.error("Failed to write clients to session storage", cacheErr);
                    }
                } catch (clientsErr) {
                    console.error("Failed to fetch clients fresh, falling back to cache", clientsErr);
                    try {
                        clientsData = JSON.parse(sessionStorage.getItem('cached_clients')) || [];
                    } catch (_) {
                        clientsData = [];
                    }
                }

                // 2. Load other static resources (using cache where available)
                try {
                    staffData = JSON.parse(sessionStorage.getItem('cached_staff'));
                    workTypesData = JSON.parse(sessionStorage.getItem('cached_work_types'));
                    clientTypesData = JSON.parse(sessionStorage.getItem('cached_client_types'));
                    clientGroupsData = JSON.parse(sessionStorage.getItem('cached_client_groups'));
                    rolesData = JSON.parse(sessionStorage.getItem('cached_roles'));
                } catch (e) {
                    console.error("Session storage parse failed", e);
                }

                if (staffData && workTypesData && clientTypesData && clientGroupsData && rolesData) {
                    setClients(clientsData);
                    setStaff(staffData);
                    setWorkTypes(workTypesData);
                    setClientTypes(clientTypesData);
                    setClientGroups(clientGroupsData);
                    setAvailableRoles(rolesData);
                } else {
                    const [staffRes, workTypesRes, typesRes, groupsRes] = await Promise.all([
                        api.get(isStaff ? '/staff/staff-members' : '/ca/staff', { params: { simple: 1 } }),
                        api.get(isStaff ? '/daily-reports/work-types' : '/ca/work-types', { params: { simple: 1 } }),
                        api.get('/ca/client-types'),
                        api.get('/ca/client-groups')
                    ]);

                    staffData = staffRes.data.data || staffRes.data || [];
                    workTypesData = workTypesRes.data.data || workTypesRes.data || [];
                    clientTypesData = typesRes.data.data || [];
                    clientGroupsData = groupsRes.data.data || [];

                    try {
                        const rolesRes = await api.get(isStaff ? '/staff/roles' : '/ca/roles');
                        rolesData = rolesRes.data.data || [];
                    } catch (roleErr) {
                        console.error("Failed to load roles", roleErr);
                        rolesData = [];
                    }

                    try {
                        sessionStorage.setItem('cached_staff', JSON.stringify(staffData));
                        sessionStorage.setItem('cached_work_types', JSON.stringify(workTypesData));
                        sessionStorage.setItem('cached_client_types', JSON.stringify(clientTypesData));
                        sessionStorage.setItem('cached_client_groups', JSON.stringify(clientGroupsData));
                        sessionStorage.setItem('cached_roles', JSON.stringify(rolesData));
                    } catch (e) {
                        console.error("Session storage set failed", e);
                    }

                    setClients(clientsData);
                    setStaff(staffData);
                    setWorkTypes(workTypesData);
                    setClientTypes(clientTypesData);
                    setClientGroups(clientGroupsData);
                    setAvailableRoles(rolesData);
                }
                
                await fetchTaskData(false);
                setStaticDataLoaded(true);
            } catch (err) {
                console.error("Failed to load initial data", err);
                toast.error("Failed to load initial page data");
                navigate(isStaff ? '/staff/tasks' : '/ca/tasks');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialAllData();
    }, [id]);

    useEffect(() => {
        if (staticDataLoaded) {
            fetchTaskData(false);
        }
    }, [
        currentPage,
        rowsPerPage,
        debouncedSearch,
        sheetStatusFilter,
        sheetWorkTypeFilter,
        selectedStatusFilter,
        selectedSubStatusFilter,
        sortField,
        sortDirection,
        debouncedFilters,
        staticDataLoaded
    ]);

    const renderCurrencyCell = (row, originalIndex, field, isRowEditable) => {
        let finalVal = row.dynamic_data?.[field.label] ?? '';
        const isReadOnly = field.readOnly;
        if (isReadOnly && field.label === 'BALANCE AMOUNT') {
            const parseAmt = (val) => parseFloat(String(val || '0').replace(/,/g, '')) || 0;
            const total = parseAmt(row.dynamic_data?.['TOTAL INVOICE AMOUNT']);
            const p1 = parseAmt(row.dynamic_data?.['PAYMENT-1']);
            const p2 = parseAmt(row.dynamic_data?.['PAYMENT-2']);
            const p3 = parseAmt(row.dynamic_data?.['PAYMENT-3']);
            const balance = total - (p1 + p2 + p3);
            finalVal = formatIndianCurrencyWithDecimals(balance.toString());
        }

        if (isRowEditable && !isReadOnly) {
            return (
                <BufferedCurrencyInput
                    value={finalVal}
                    disabled={!isRowEditable || isReadOnly}
                    isReadOnly={isReadOnly}
                    originalIndex={originalIndex}
                    field={field}
                    rows={rows}
                    setRows={setRows}
                    placeholder={field.placeholder || "0.00"}
                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
            );
        } else {
            return (
                <div className={`flex items-center min-h-[38px] px-2.5 py-1.5 text-xs font-semibold leading-tight ${isReadOnly ? 'text-indigo-700 font-extrabold' : 'text-slate-900 font-semibold'}`}>
                    {finalVal || '—'}
                </div>
            );
        }
    };

    const startAddingField = (fieldType) => {
        const baseName = `New ${fieldType.name}`;
        let label = baseName;
        let counter = 1;
        while (schema.find(f => f.label === label)) {
            label = `${baseName} ${counter++}`;
        }

        const newField = {
            id: 'draft',
            type: fieldType.id,
            label: label,
            placeholder: `Enter ${label}...`,
            required: false,
            options: (fieldType.id === 'dropdown' || fieldType.id === 'checkbox') ? ['Option 1', 'Option 2'] : [],
            checkType: fieldType.id === 'checkbox' ? 'multicheck' : undefined
        };

        setDraftField(newField);
        setSidebarMode('settings');
        setIsSidebarOpen(true);
    };

    const confirmAddField = () => {
        if (!draftField) return;

        const newField = { ...draftField, id: Math.random().toString(36).substr(2, 9) };
        setSchema([...schema, newField]);
        setRows(rows.map(r => ({
            ...r,
            dynamic_data: { ...r.dynamic_data, [newField.label]: '' }
        })));

        setDraftField(null);
        setActiveFieldId(null);
        setSidebarMode('fields');
        setIsSidebarOpen(false);
        toast.success(`Column "${newField.label}" added`);
    };

    const updateField = (id, key, value) => {
        if (id === 'draft') {
            setDraftField({ ...draftField, [key]: value });
            return;
        }
        setSchema(prev => prev.map(f => {
            if (f.id === id) {
                // If label changes, we must sync the dynamic_data keys in all rows
                if (key === 'label' && f.label !== value) {
                    const oldLabel = f.label;
                    setRows(rows.map(r => {
                        const newData = { ...r.dynamic_data };
                        newData[value] = newData[oldLabel];
                        delete newData[oldLabel];
                        return { ...r, dynamic_data: newData };
                    }));
                }
                return { ...f, [key]: value };
            }
            return f;
        }));
    };

    const removeField = (id) => {
        const fieldToRemove = schema.find(f => f.id === id);
        if (!fieldToRemove) return;

        setSchema(schema.filter(f => f.id !== id));
        setRows(rows.map(r => {
            const newData = { ...r.dynamic_data };
            delete newData[fieldToRemove.label];
            return { ...r, dynamic_data: newData };
        }));
        if (activeFieldId === id) {
            setIsSidebarOpen(false);
            setActiveFieldId(null);
        }
    };    const handleSaveRows = async (updatedRows, successMessage = 'Rows saved successfully', deletedRowIds = [], overridePage = null) => {
        // Validate for duplicate clients within the same sheet
        if (!allowDuplicateClients) {
            // Check if this is a deletion (no new client added/modified)
            if (updatedRows.length >= rows.length) {
                // Find indices of rows that are new or had their client_id modified
                const modifiedIndices = [];
                updatedRows.forEach((r, idx) => {
                    const oldRow = rows[idx];
                    if (!oldRow || String(r.client_id) !== String(oldRow?.client_id)) {
                        modifiedIndices.push(idx);
                    }
                });
 
                for (const mIdx of modifiedIndices) {
                    const mRow = updatedRows[mIdx];
                    const cid = mRow.client_id;
                    if (cid && cid !== 'null' && cid !== 'undefined' && cid !== '0' && cid !== 0) {
                        // Check if this client_id is used in any OTHER row in updatedRows
                        const otherRows = updatedRows.filter((r, rIdx) => rIdx !== mIdx);
                        const isDuplicateId = otherRows.some(r => {
                            const rCid = r.client_id;
                            return rCid && String(rCid) === String(cid);
                        });
                        if (isDuplicateId) {
                            const clientName = clients.find(c => String(c.id) === String(cid))?.name || 'Selected client';
                            toast.error(`Client "${clientName}" is already assigned to another row in this sheet.`);
                            return;
                        }
 
                        // Check if this client's PAN is used in any OTHER row in updatedRows
                        const mClient = clients.find(c => String(c.id) === String(cid));
                        const mPan = mClient?.pan_no ? mClient.pan_no.trim().toUpperCase() : '';
                        if (mPan) {
                            const hasDuplicatePan = otherRows.some(r => {
                                if (!r.client_id || r.client_id === 'null' || r.client_id === 'undefined' || r.client_id === '0' || r.client_id === 0) return false;
                                const cObj = clients.find(c => String(c.id) === String(r.client_id));
                                const rPan = cObj?.pan_no ? cObj.pan_no.trim().toUpperCase() : '';
                                return rPan === mPan;
                            });
                            if (hasDuplicatePan) {
                                toast.error(`A client with PAN "${mPan}" is already assigned to another row in this sheet.`);
                                return;
                            }
                        }
                    }
                }
            }
        }
 
        const loadingToast = toast.loading('Saving changes... Please wait.');
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const firstRow = updatedRows[0] || {};
            
            const firstRowData = {};
            if (firstRow.dynamic_data) {
                Object.keys(firstRow.dynamic_data).forEach(k => {
                    firstRowData[k.trim()] = firstRow.dynamic_data[k];
                });
            }
            delete firstRowData.schema;
            delete firstRowData.multi_rows;
            delete firstRowData.field_names;
            delete firstRowData.field_types;
 
            // Preserve special keys from current task.dynamic_fields
            const cleanDynamicFields = {};
            ['schema', 'field_names', 'field_types'].forEach(k => {
                if (task.dynamic_fields?.[k] !== undefined) {
                    cleanDynamicFields[k] = task.dynamic_fields[k];
                }
            });
 
            const nextDynamicFields = {
                ...cleanDynamicFields,
                ...firstRowData,
                multi_rows: updatedRows
            };
 
            const payload = {
                client_id: (task.client && typeof task.client === 'object') ? task.client.id : (task.client_id ? Number(task.client_id) : null),
                work_type_id: (task.work_type && typeof task.work_type === 'object') ? task.work_type.id : (task.work_type_id ? Number(task.work_type_id) : null),
                allocated_to: (task.allocated_to && typeof task.allocated_to === 'object') ? task.allocated_to.id : (task.allocated_to ? Number(task.allocated_to) : null),
                date_allocated: firstRow.date_allocated || task.date_allocated || null,
                form_name: firstRow.form_name || task.form_name || '',
                status: task.status,
                dynamic_fields: nextDynamicFields,
                deleted_row_ids: deletedRowIds,
                last_updated_at: task.updated_at
            };
 
            await api.patch(`${apiPrefix}/tasks/${id}`, payload);
            
            if (overridePage !== null) {
                if (currentPage === overridePage) {
                    await fetchTaskData(false);
                } else {
                    setCurrentPage(overridePage);
                }
            } else {
                await fetchTaskData(false);
            }
            toast.success(successMessage, { id: loadingToast });
        } catch (e) {
            console.error(e);
            let msg = e.response?.data?.message || 'Failed to save row changes';
            if (e.response?.status === 409) {
                toast.error(msg, { id: loadingToast, duration: 8000 });
                return;
            }
            if (msg.includes('SQLSTATE') || msg.includes('Integrity constraint violation')) {
                msg = 'A database error occurred. Please ensure all required fields are filled correctly.';
            }
            toast.error(msg, { id: loadingToast });
            throw e; // Rethrow to let the caller modal handle it if needed
        }
    };

    const addRow = () => {
        const newRow = {
            form_name: task.form_name || '',
            client_id: '',
            work_type_id: task.work_type?.id || '',
            allocated_type: 'user',
            allocated_to: isStaff ? (user?.id || '') : '',
            date_allocated: isStaff ? new Date().toISOString().split('T')[0] : '',
            status: 'assigned',
            dynamic_data: schema.reduce((acc, f) => {
                let defaultVal = '';
                if (f.value !== undefined && f.value !== null) {
                    defaultVal = f.value;
                } else if (f.type === 'checkbox' || f.type === 'labels') {
                    defaultVal = [];
                }
                return { ...acc, [f.label]: defaultVal };
            }, {})
        };
        const nextTotalRows = totalRows + 1;
        const nextTotalPages = Math.ceil(nextTotalRows / (rowsPerPage === 'All' ? nextTotalRows || 1 : rowsPerPage));
        
        const updatedRows = [...rows, newRow];
        setRows(updatedRows);
        handleSaveRows(updatedRows, 'Row added successfully', [], nextTotalPages);
    };

    const removeRow = (index) => {
        setConfirmState({
            open: true,
            title: 'Delete Row',
            message: 'Are you sure you want to delete this sheet row? All dynamic data entered for this row will be permanently removed.',
            confirmLabel: 'Delete Row',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    const updatedRows = [...rows];
                    const deletedRow = updatedRows.splice(index, 1)[0];
                    const deletedId = deletedRow?.row_id || deletedRow?.id;
                    setRows(updatedRows);
                    await handleSaveRows(updatedRows, 'Row deleted successfully', deletedId ? [deletedId] : []);
                } catch (err) {
                    toast.error("Failed to delete row");
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const duplicateRow = (index) => {
        const rowToDuplicate = rows[index];
        const duplicatedRow = {
            ...rowToDuplicate,
            is_verified: false,
            client_id: '',
            allocated_to: '',
            allocated_type: 'user',
            date_allocated: null,
            attachments: rowToDuplicate.attachments ? [...rowToDuplicate.attachments] : [],
            dynamic_data: { ...(rowToDuplicate.dynamic_data || {}) }
        };
        const updatedRows = [...rows];
        updatedRows.splice(index + 1, 0, duplicatedRow);
        setRows(updatedRows);
        handleSaveRows(updatedRows, 'Row duplicated successfully');
    };

    const handleUpdateGlobal = async () => {
        setSaving(true);
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const updatedDynamicFields = {
                ...(task.dynamic_fields || {}),
                'CA Feedback': caFeedback,
                'CA Rating': caRating
            };
            delete updatedDynamicFields.is_billable;
            delete updatedDynamicFields.is_after_sales;
            delete updatedDynamicFields.allow_duplicate_clients;

            await api.patch(`${apiPrefix}/tasks/${id}`, {
                status: globalStatus,
                remarks: globalRemarks,
                dynamic_fields: updatedDynamicFields,
                permissions: sheetPermissions,
                allow_attachments: allowAttachments,
                allow_checklist: allowChecklist,
                allow_notes: allowNotes,
                is_billable: isBillableEnabled,
                is_after_sales: isAfterSalesEnabled,
                allow_duplicate_clients: allowDuplicateClients
            });

            setTask(prev => ({
                ...prev,
                status: globalStatus,
                remarks: globalRemarks,
                dynamic_fields: updatedDynamicFields,
                permissions: sheetPermissions,
                allow_attachments: allowAttachments,
                allow_checklist: allowChecklist,
                allow_notes: allowNotes,
                is_billable: isBillableEnabled,
                is_after_sales: isAfterSalesEnabled,
                allow_duplicate_clients: allowDuplicateClients
            }));
            toast.success('Global controls updated successfully');
            setIsGlobalModalOpen(false);
        } catch (e) {
            toast.error('Failed to update sheet controls');
        } finally {
            setSaving(false);
        }
    };
    const handleBulkDelete = () => {
        if (selectedRowIds.length === 0) return;
        setConfirmState({
            open: true,
            title: 'Delete Selected Rows',
            message: `Are you sure you want to delete the ${selectedRowIds.length} selected rows? This action cannot be undone.`,
            confirmLabel: 'Delete Rows',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    const updatedRows = rows.filter(r => !selectedRowIds.includes(r.row_id || r.id));
                    const idsToDelete = selectedRowIds;
                    setRows(updatedRows);
                    setSelectedRowIds([]);
                    await handleSaveRows(updatedRows, 'Selected rows deleted successfully', idsToDelete);
                } catch (err) {
                    toast.error("Failed to delete rows");
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleApplyBulkUpdates = async () => {
        if (selectedRowIds.length === 0) return;
        
        const nextRows = rows.map(r => {
            const rid = r.row_id || r.id;
            if (selectedRowIds.includes(rid)) {
                const updatedRow = { ...r };
                if (bulkUpdateTargets.client_id) {
                    updatedRow.client_id = bulkMainFields.client_id ? Number(bulkMainFields.client_id) : null;
                }
                if (bulkUpdateTargets.allocated_to) {
                    updatedRow.allocated_to = bulkMainFields.allocated_to ? Number(bulkMainFields.allocated_to) : null;
                    updatedRow.allocated_type = 'user';
                }
                if (bulkUpdateTargets.status) {
                    updatedRow.status = bulkMainFields.status || 'assigned';
                }
                if (bulkUpdateTargets.sub_status) {
                    updatedRow.sub_status = bulkMainFields.sub_status || null;
                }
                if (bulkUpdateTargets.date_allocated) {
                    updatedRow.date_allocated = bulkMainFields.date_allocated || null;
                }
                if (bulkUpdateTargets.remarks) {
                    updatedRow.remarks = bulkMainFields.remarks || '';
                }
                return updatedRow;
            }
            return r;
        });
        
        setRows(nextRows);
        setBulkEditOpen(false);
        setSelectedRowIds([]);
        await handleSaveRows(nextRows, `Bulk updated ${selectedRowIds.length} rows successfully`);
    };

    const handleUpdateSingleDynamicField = async (key, val) => {
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const updatedDynamicFields = {
                ...(task.dynamic_fields || {}),
                [key]: val
            };

            await api.patch(`${apiPrefix}/tasks/${id}`, {
                dynamic_fields: updatedDynamicFields
            });

            setTask(prev => ({
                ...prev,
                dynamic_fields: updatedDynamicFields
            }));

            if (key === 'CA Rating') setCaRating(val);
            if (key === 'CA Feedback') {
                setCaFeedback(val);
                setInlineFeedbackValue(val);
            }

            toast.success(`${key} updated successfully`);
        } catch (e) {
            toast.error(`Failed to update ${key}`);
        }
    };
    const handleUpdateTaskFields = async (updates) => {
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const payload = {
                client_id: updates.client_id !== undefined ? updates.client_id : (task.client?.id || null),
                work_type_id: updates.work_type_id !== undefined ? updates.work_type_id : (task.work_type?.id || null),
                allocated_to: updates.allocated_to !== undefined ? updates.allocated_to : ((task.allocated_to && typeof task.allocated_to === 'object') ? task.allocated_to.id : (task.allocated_to || null)),
                date_allocated: updates.date_allocated !== undefined ? updates.date_allocated : task.date_allocated,
                form_name: updates.form_name !== undefined ? updates.form_name : task.form_name,
                status: updates.status !== undefined ? updates.status : task.status,
                dynamic_fields: updates.dynamic_fields !== undefined ? updates.dynamic_fields : task.dynamic_fields
            };

            const res = await api.patch(`${apiPrefix}/tasks/${id}`, payload);
            const nextData = res.data.data;
            setTask(prev => ({
                ...nextData,
                sub_tasks: nextData.sub_tasks !== undefined ? nextData.sub_tasks : (prev?.sub_tasks || [])
            }));
            setFormName(nextData.form_name || 'Untitled Form');
            setGlobalStatus(nextData.status || 'assigned');
            setGlobalRemarks(nextData.remarks || '');
            if (nextData.dynamic_fields?.['CA Rating']) setCaRating(nextData.dynamic_fields['CA Rating']);
            if (nextData.dynamic_fields?.['CA Feedback']) {
                setCaFeedback(nextData.dynamic_fields['CA Feedback']);
                setInlineFeedbackValue(nextData.dynamic_fields['CA Feedback']);
            }
            toast.success('Submission details saved successfully');
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || 'Failed to save changes');
        }
    };

    const handleSaveNotesList = (newList) => {
        setNotesList(newList);
        localStorage.setItem(notesKey, JSON.stringify(newList));
    };

    const handleUpdateNoteText = (noteId, text) => {
        const updated = notesList.map(n => n.id === noteId ? { ...n, text } : n);
        handleSaveNotesList(updated);
    };

    const handleAddNoteAfter = (noteId) => {
        const idx = notesList.findIndex(n => n.id === noteId);
        const newNote = {
            id: `note-${Date.now()}`,
            text: '',
            timestamp: new Date().toLocaleString()
        };
        const updated = [...notesList];
        if (noteId === 'init' || notesList.length === 0) {
            handleSaveNotesList([newNote]);
        } else {
            updated.splice(idx + 1, 0, newNote);
            handleSaveNotesList(updated);
        }
    };

    const handleDeleteNote = (noteId) => {
        let updated = notesList.filter(n => n.id !== noteId);
        if (updated.length === 0) {
            updated = [{ id: `note-${Date.now()}`, text: '', timestamp: new Date().toLocaleString() }];
        }
        handleSaveNotesList(updated);
    };

    const handleAddSubTask = async () => {
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const res = await api.post(`${apiPrefix}/tasks/${id}/sub-tasks`, { title: 'New Subtask' });
            setTask(prev => ({
                ...prev,
                sub_tasks: [...(prev.sub_tasks || []), res.data.data]
            }));
            toast.success('Task added');
        } catch (e) {
            toast.error('Failed to add task');
        }
    };

    const handleUpdateSubTask = async (subTaskId, data) => {
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const res = await api.patch(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`, data);
            setTask(prev => ({
                ...prev,
                sub_tasks: prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st)
            }));
        } catch (e) {
            toast.error('Failed to update task');
        }
    };

    const handleDeleteSubTask = (subTaskId) => {
        setConfirmState({
            open: true,
            title: 'Delete Task',
            message: 'Are you sure you want to delete this task? This action cannot be undone.',
            confirmLabel: 'Delete Task',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    const apiPrefix = isStaff ? '/staff' : '/ca';
                    await api.delete(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`);
                    setTask(prev => ({
                        ...prev,
                        sub_tasks: prev.sub_tasks.filter(st => st.id !== subTaskId)
                    }));
                    setSelectedTaskIds(prev => prev.filter(tid => tid !== subTaskId));
                    toast.success('Deleted successfully');
                } catch (e) {
                    toast.error('Failed to delete task');
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleDeleteMultipleSubTasks = () => {
        setConfirmState({
            open: true,
            title: 'Delete Selected Tasks',
            message: `Are you sure you want to delete the ${selectedTaskIds.length} selected tasks? This action cannot be undone.`,
            confirmLabel: 'Delete Selected',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    const apiPrefix = isStaff ? '/staff' : '/ca';
                    await Promise.all(selectedTaskIds.map(subTaskId => api.delete(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`)));
                    setTask(prev => ({
                        ...prev,
                        sub_tasks: prev.sub_tasks.filter(st => !selectedTaskIds.includes(st.id))
                    }));
                    setSelectedTaskIds([]);
                    toast.success('Selected tasks deleted successfully');
                } catch (e) {
                    console.error(e);
                    toast.error('Failed to delete some selected tasks');
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleUploadSubTaskAttachment = async (subTaskId, file) => {
        if (!file) return;

        // Max size 5MB (5 * 1024 * 1024 bytes)
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB.");
            return;
        }

        const loadingToast = toast.loading("Uploading attachment...");
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const formData = new FormData();
            formData.append('screenshot', file);
            formData.append('_method', 'PATCH');

            const res = await api.post(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setTask(prev => {
                const updated = prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st);
                const updatedSubTask = updated.find(st => st.id === subTaskId);
                if (updatedSubTask) {
                    setAttachmentsModal(modalPrev => {
                        if (modalPrev.open && modalPrev.type === 'subtask' && modalPrev.id === subTaskId) {
                            return { ...modalPrev, files: updatedSubTask.attachments || [] };
                        }
                        return modalPrev;
                    });
                }
                return { ...prev, sub_tasks: updated };
            });
            toast.success("Attachment uploaded successfully!", { id: loadingToast });
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || "Failed to upload attachment", { id: loadingToast });
        }
    };

    const handleUploadMultipleSubTaskAttachments = async (subTaskId, fileList) => {
        const files = Array.from(fileList || []);
        for (const file of files) {
            await handleUploadSubTaskAttachment(subTaskId, file);
        }
    };

    const handleDeleteSubTaskAttachment = (subTaskId) => {
        setConfirmState({
            open: true,
            title: 'Delete Attachment',
            message: 'Are you sure you want to delete this attachment? This action cannot be undone.',
            confirmLabel: 'Delete Attachment',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                const loadingToast = toast.loading("Deleting attachment...");
                try {
                    const apiPrefix = isStaff ? '/staff' : '/ca';
                    const res = await api.patch(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`, { screenshot: null });
                    setTask(prev => ({
                        ...prev,
                        sub_tasks: prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st)
                    }));
                    setAttachmentsModal(modalPrev => {
                        if (modalPrev.open && modalPrev.type === 'subtask' && modalPrev.id === subTaskId) {
                            return { ...modalPrev, files: [] };
                        }
                        return modalPrev;
                    });
                    toast.success("Attachment deleted successfully!", { id: loadingToast });
                } catch (e) {
                    console.error(e);
                    toast.error("Failed to delete attachment", { id: loadingToast });
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleDeleteSubTaskFileAttachment = async (subTaskId, filePath) => {
        const subTask = task.sub_tasks?.find(st => st.id === subTaskId);
        if (!subTask) return;

        setConfirmState({
            open: true,
            title: 'Delete Attachment',
            message: 'Are you sure you want to delete this attachment? This action cannot be undone.',
            confirmLabel: 'Delete Attachment',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                const loadingToast = toast.loading("Deleting attachment...");
                try {
                    const apiPrefix = isStaff ? '/staff' : '/ca';
                    const currentPaths = subTask.attachments?.map(att => att.path) || [];
                    const updatedPaths = currentPaths.filter(p => p !== filePath);
                    
                    const res = await api.patch(`${apiPrefix}/tasks/${id}/sub-tasks/${subTaskId}`, {
                        screenshot: updatedPaths.length > 0 ? JSON.stringify(updatedPaths) : null
                    });

                    setTask(prev => {
                        const updated = prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st);
                        const updatedSubTask = updated.find(st => st.id === subTaskId);
                        if (updatedSubTask) {
                            setAttachmentsModal(modalPrev => {
                                if (modalPrev.open && modalPrev.type === 'subtask' && modalPrev.id === subTaskId) {
                                    return { ...modalPrev, files: updatedSubTask.attachments || [] };
                                }
                                return modalPrev;
                            });
                        }
                        return { ...prev, sub_tasks: updated };
                    });

                    toast.success("Attachment deleted successfully!", { id: loadingToast });
                } catch (e) {
                    console.error(e);
                    toast.error("Failed to delete attachment", { id: loadingToast });
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleUploadRowAttachment = async (rowIndex, file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File size must be under 5MB.");
            return;
        }

        const loadingToast = toast.loading("Uploading attachment...");
        try {
            const apiPrefix = isStaff ? '/staff' : '/ca';
            const formData = new FormData();
            formData.append('file', file);

            const res = await api.post(`${apiPrefix}/tasks/upload-file`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const newRows = [...rows];
            if (!newRows[rowIndex].attachments) {
                newRows[rowIndex].attachments = [];
            }
            newRows[rowIndex].attachments.push({
                name: res.data.name,
                url: res.data.url,
                path: res.data.path
            });
            setRows(newRows);
            if (viewingRowIndex === rowIndex) {
                setNewTaskData(prev => ({
                    ...prev,
                    attachments: newRows[rowIndex].attachments
                }));
            }
            await handleSaveRows(newRows);

            setAttachmentsModal(prev => {
                if (prev.open && prev.type === 'row' && prev.originalIndex === rowIndex) {
                    return { ...prev, files: newRows[rowIndex].attachments };
                }
                return prev;
            });

            toast.success("Attachment uploaded successfully!", { id: loadingToast });
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || "Failed to upload attachment", { id: loadingToast });
        }
    };

    const handleUploadMultipleRowAttachments = async (rowIndex, fileList) => {
        const files = Array.from(fileList || []);
        for (const file of files) {
            await handleUploadRowAttachment(rowIndex, file);
        }
    };

    const handleDeleteRowAttachment = async (rowIndex, filePath) => {
        setConfirmState({
            open: true,
            title: 'Delete Attachment',
            message: 'Are you sure you want to delete this attachment? This action cannot be undone.',
            confirmLabel: 'Delete Attachment',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                const loadingToast = toast.loading("Deleting attachment...");
                try {
                    const newRows = [...rows];
                    if (newRows[rowIndex].attachments) {
                        newRows[rowIndex].attachments = newRows[rowIndex].attachments.filter(att => att.path !== filePath);
                    }
                    setRows(newRows);
                    if (viewingRowIndex === rowIndex) {
                        setNewTaskData(prev => ({
                            ...prev,
                            attachments: newRows[rowIndex].attachments || []
                        }));
                    }
                    await handleSaveRows(newRows);

                    setAttachmentsModal(prev => {
                        if (prev.open && prev.type === 'row' && prev.originalIndex === rowIndex) {
                            return { ...prev, files: newRows[rowIndex].attachments || [] };
                        }
                        return prev;
                    });

                    toast.success("Attachment deleted successfully!", { id: loadingToast });
                } catch (err) {
                    console.error(err);
                    toast.error("Failed to delete attachment", { id: loadingToast });
                } finally {
                    setConfirmState({ open: false });
                }
            }
        });
    };

    const handleExport = async () => {
        if (isStaff && !user?.special_permissions?.import_export_sheet) {
            toast.error("Access Denied: Export is not allowed.");
            return;
        }
        try {
            const formatVal = (val, fieldType) => {
                if (Array.isArray(val)) return val.join(', ');
                if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                if (fieldType === 'currency') {
                    return formatIndianCurrencyWithDecimals(val);
                }
                if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val.trim())) {
                    return formatDate(val);
                }
                return val || '';
            };

            const dynamicFields = [
                ...filteredSchema.filter(f => !f.id.startsWith('static_')).map(f => ({ label: f.label, type: f.type })),
                ...(isBillableEnabled && !filteredSchema.some(f => Number(f.section) === 3 || f.label === 'TASK IS BILLABLE OR NOT') ? [
                    { label: 'TASK IS BILLABLE OR NOT', type: 'dropdown' },
                    { label: 'BILL NO', type: 'text' },
                    { label: 'BILL AMOUNT', type: 'currency' },
                    { label: 'INVOICE SENT TO CLIENT', type: 'dropdown' },
                    { label: 'DATE OF SENDING TO CLIENT', type: 'date' },
                    { label: 'STATUS', type: 'dropdown' },
                    { label: 'INVOICE IS CREATED', type: 'dropdown' },
                    { label: 'CREATED BY', type: 'text' },
                    { label: 'VERIFY BY', type: 'checkbox' },
                    { label: 'TOTAL INVOICE AMOUNT', type: 'currency' },
                    { label: 'DATE OF INVOICE', type: 'date' },
                    { label: 'INVOICE SENT MODE / FROM', type: 'dropdown' },
                    { label: 'DATE OF SENT', type: 'date' },
                    { label: 'PAYMENT-1', type: 'currency' },
                    { label: 'DATE-1', type: 'date' },
                    { label: 'PAYMENT-2', type: 'currency' },
                    { label: 'DATE-2', type: 'date' },
                    { label: 'PAYMENT-3', type: 'currency' },
                    { label: 'DATE-3', type: 'date' },
                    { label: 'BALANCE AMOUNT', type: 'currency' },
                    { label: 'BILLING FOLLOW UP', type: 'text' },
                    { label: 'PR ACTIVE UPDATION', type: 'text' },
                    { label: 'FINAL REMARK', type: 'text' }
                ] : []),
                ...(isAfterSalesEnabled && !filteredSchema.some(f => Number(f.section) === 4 || f.label === 'CUSTOMER SERVICE CALL') ? [
                    { label: 'CUSTOMER SERVICE CALL', type: 'text' },
                    { label: 'DATE OF CALLING', type: 'date' },
                    { label: 'CALL BY WHOM', type: 'dropdown' },
                    { label: 'CLIENT FEED BACK', type: 'longtext' },
                    { label: 'GOOGLE REVIEW', type: 'dropdown' },
                    { label: 'DATE OF GOOGLE REVIEW', type: 'date' },
                    { label: 'APP DOWN LOADED', type: 'dropdown' },
                    { label: 'MAHESH SIR MOBILE SAVED', type: 'dropdown' },
                    { label: 'SOCIAL MEDIA CONNECTION', type: 'dropdown' },
                    { label: 'OTHER REMARK', type: 'longtext' }
                ] : [])
            ];

            const sheetInfoHeaders = [
                'SR NO',
                'Row ID',
                'Sheet Name',
                'Client',
                'PAN No',
                'Work Type',
                'Assigned To',
                'Create Date',
                'Sheet Status',
                'Sub Status',
                ...dynamicFields.map(f => f.label),
                'Remarks'
            ];

            const sheetInfoRows = rows.map((r, index) => {
                const clientObj = clients.find(c => c.id === r.client_id || c.id === task.client?.id);
                const clientName = clientObj?.name || 'N/A';
                const clientPan = clientObj?.pan_no || 'N/A';
                const workTypeName = workTypes.find(w => w.id === r.work_type_id || w.id === task.work_type?.id)?.name || 'N/A';
                const allocType = r.allocated_type || 'user';
                let assignedToName = 'Unassigned';
                if (allocType === 'user' && r.allocated_to) {
                    const idToFind = typeof r.allocated_to === 'object' ? r.allocated_to.id : r.allocated_to;
                    const sMember = staff.find(s => String(s.id) === String(idToFind));
                    assignedToName = sMember ? sMember.name : 'Unassigned';
                } else if (allocType === 'users' && Array.isArray(r.allocated_to)) {
                    const names = r.allocated_to
                        .map(id => {
                            const idToFind = typeof id === 'object' ? id.id : id;
                            return staff.find(s => String(s.id) === String(idToFind))?.name;
                        })
                        .filter(Boolean);
                    assignedToName = names.length > 0 ? names.join(', ') : 'Unassigned';
                } else if (allocType === 'role' && r.allocated_to) {
                    const idToFind = typeof r.allocated_to === 'object' ? r.allocated_to.id : r.allocated_to;
                    const roleObj = availableRoles.find(role => String(role.id) === String(idToFind));
                    assignedToName = roleObj ? `Dept: ${roleObj.name}` : 'Unassigned';
                }
                const dynamicData = r.dynamic_data || {};

                return [
                    index + 1,
                    r.row_id || '',
                    r.form_name || task.form_name || '',
                    clientName,
                    clientPan,
                    workTypeName,
                    assignedToName,
                    formatDate(r.date_allocated || task.date_allocated),
                    r.status || 'assigned',
                    r.sub_status || '—',
                    ...dynamicFields.map(f => formatVal(dynamicData[f.label], f.type)),
                    r.remarks || ''
                ];
            });

            const taskChecklistRows = (task.sub_tasks || []).map((st, index) => [
                index + 1,
                st.id || '',
                st.title || '',
                st.assigned_to?.name || 'Unassigned',
                st.priority || '',
                st.status_label || st.status || '',
                formatDate(st.due_date),
                st.remarks || ''
            ]);

            const notesRows = notesList
                .filter(note => note.text && note.text.trim() !== '')
                .map((note, index) => [
                    index + 1,
                    note.text,
                    note.timestamp || ''
                ]);

            const cleanFilename = (str) => {
                return (str || '')
                    .replace(/[^a-zA-Z0-9_\-]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '');
            };

            const sheetNamePart = cleanFilename(task.form_name);
            const clientNamePart = cleanFilename(task.client?.name) || 'Sheet';
            const datePart = new Date().toISOString().substring(0, 10);
            
            const exportFilename = sheetNamePart 
                ? `${sheetNamePart}_${clientNamePart}_Complete_Export_${datePart}.xlsx`
                : `${clientNamePart}_Complete_Export_${datePart}.xlsx`;

            await exportToExcel({
                filename: exportFilename,
                sheets: [
                    {
                        sheetName: "Sheet Information",
                        title: `Sheet Info: ${task.client?.name || 'Sheet'} - ${task.form_name || ''}`,
                        subtitle: `Generated at: ${new Date().toLocaleString()}`,
                        headers: sheetInfoHeaders,
                        rows: sheetInfoRows
                    },
                    {
                        sheetName: "Tasks Checklists",
                        title: "Tasks Checklists / Subtasks",
                        subtitle: `Generated at: ${new Date().toLocaleString()}`,
                        headers: ["SR NO", "Task ID", "Task Name", "Assignee", "Priority", "Status", "Due Date", "Remarks"],
                        rows: taskChecklistRows.length > 0 ? taskChecklistRows : [[1, "", "No tasks checklists", "", "", "", "", ""]]
                    },
                    {
                        sheetName: "Sheet Notes",
                        title: "Sheet Notes Registry",
                        subtitle: `Generated at: ${new Date().toLocaleString()}`,
                        headers: ["SR NO", "Note Content", "Timestamp"],
                        rows: notesRows.length > 0 ? notesRows : [[1, "No notes added", ""]]
                    }
                ]
            });
        } catch (err) {
            console.error('Export Error:', err);
            toast.error('Failed to export sheet details');
        }
    };

    const handleImportExcel = async (e) => {
        if (isStaff && !user?.special_permissions?.import_export_sheet) {
            toast.error("Access Denied: Import is not allowed.");
            return;
        }
        const file = e.target.files?.[0];
        if (!file) return;

        const loadingToast = toast.loading('Reading Excel sheets...');
        try {
            const XLSX = await import('xlsx');
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0]; // Tab 1: Sheet Information
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (json.length < 5) {
                        toast.error('Excel file must contain header row and data rows.', { id: loadingToast });
                        return;
                    }

                    // Locate header row: row 4 (index 3) is where headers are written
                    const headers = json[3].map(h => String(h || '').trim());
                    const idxRowId = headers.indexOf('Row ID');
                    const idxSheetName = headers.indexOf('Sheet Name');
                    const idxClientName = headers.indexOf('Client');
                    const idxClientPan = headers.indexOf('PAN No');
                    const idxWorkType = headers.indexOf('Work Type');
                    const idxAssignedTo = headers.indexOf('Assigned To');
                    const idxCreateDate = headers.indexOf('Create Date');
                    const idxStatus = headers.indexOf('Sheet Status');
                    const idxSubStatus = headers.indexOf('Sub Status');
                    const idxRemarks = headers.indexOf('Remarks');

                    if (idxSheetName === -1) {
                        toast.error('Could not find mandatory "Sheet Name" column in Excel.', { id: loadingToast });
                        return;
                    }

                    // Find dynamic fields in the headers
                    const dynamicFields = [
                        ...filteredSchema.filter(f => !f.id.startsWith('static_')).map(f => ({ label: f.label, type: f.type })),
                        ...(isBillableEnabled && !filteredSchema.some(f => Number(f.section) === 3 || f.label === 'TASK IS BILLABLE OR NOT') ? [
                            { label: 'TASK IS BILLABLE OR NOT', type: 'dropdown' },
                            { label: 'BILL NO', type: 'text' },
                            { label: 'BILL AMOUNT', type: 'currency' },
                            { label: 'INVOICE SENT TO CLIENT', type: 'dropdown' },
                            { label: 'DATE OF SENDING TO CLIENT', type: 'date' },
                            { label: 'STATUS', type: 'dropdown' },
                            { label: 'INVOICE IS CREATED', type: 'dropdown' },
                            { label: 'CREATED BY', type: 'text' },
                            { label: 'VERIFY BY', type: 'checkbox' },
                            { label: 'TOTAL INVOICE AMOUNT', type: 'currency' },
                            { label: 'DATE OF INVOICE', type: 'date' },
                            { label: 'INVOICE SENT MODE / FROM', type: 'dropdown' },
                            { label: 'DATE OF SENT', type: 'date' },
                            { label: 'PAYMENT-1', type: 'currency' },
                            { label: 'DATE-1', type: 'date' },
                            { label: 'PAYMENT-2', type: 'currency' },
                            { label: 'DATE-2', type: 'date' },
                            { label: 'PAYMENT-3', type: 'currency' },
                            { label: 'DATE-3', type: 'date' },
                            { label: 'BALANCE AMOUNT', type: 'currency' },
                            { label: 'BILLING FOLLOW UP', type: 'text' },
                            { label: 'PR ACTIVE UPDATION', type: 'text' },
                            { label: 'FINAL REMARK', type: 'text' }
                        ] : []),
                        ...(isAfterSalesEnabled && !filteredSchema.some(f => Number(f.section) === 4 || f.label === 'CUSTOMER SERVICE CALL') ? [
                            { label: 'CUSTOMER SERVICE CALL', type: 'text' },
                            { label: 'DATE OF CALLING', type: 'date' },
                            { label: 'CALL BY WHOM', type: 'dropdown' },
                            { label: 'CLIENT FEED BACK', type: 'longtext' },
                            { label: 'GOOGLE REVIEW', type: 'dropdown' },
                            { label: 'DATE OF GOOGLE REVIEW', type: 'date' },
                            { label: 'APP DOWN LOADED', type: 'dropdown' },
                            { label: 'MAHESH SIR MOBILE SAVED', type: 'dropdown' },
                            { label: 'SOCIAL MEDIA CONNECTION', type: 'dropdown' },
                            { label: 'OTHER REMARK', type: 'longtext' }
                        ] : [])
                    ];
                    const dynamicFieldIndices = dynamicFields.map(f => ({
                        field: f,
                        index: headers.indexOf(f.label)
                    })).filter(item => item.index !== -1);

                    const parseExcelDate = (val) => {
                        if (val === undefined || val === null) return '';
                        if (val instanceof Date) {
                            return val.toISOString().split('T')[0];
                        }
                        if (typeof val === 'number' || (!isNaN(val) && !isNaN(parseFloat(val)))) {
                            try {
                                const dateObj = new Date((Number(val) - 25569) * 86400 * 1000);
                                return dateObj.toISOString().split('T')[0];
                            } catch (e) {
                                return '';
                            }
                        }
                        const str = String(val).trim();
                        if (!str) return '';
                        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                            return str;
                        }
                        const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                        if (dmyMatch) {
                            const [, d, m, y] = dmyMatch;
                            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                        }
                        try {
                            const parsed = new Date(str);
                            if (!isNaN(parsed.getTime())) {
                                return parsed.toISOString().split('T')[0];
                            }
                        } catch (e) {}
                        return str;
                    };

                    const importedRows = [];
                    for (let i = 4; i < json.length; i++) {
                        const rowData = json[i];
                        if (!rowData || rowData.length === 0 || !rowData[idxSheetName]) continue;

                        const rowId = idxRowId !== -1 ? String(rowData[idxRowId] || '').trim() : '';
                        const form_name = String(rowData[idxSheetName] || '').trim();
                        
                        // Look up client by Name, PAN, or name + PAN
                        const clientName = idxClientName !== -1 ? String(rowData[idxClientName] || '').trim() : '';
                        const clientPanVal = idxClientPan !== -1 ? String(rowData[idxClientPan] || '').trim().toUpperCase() : '';

                        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i;
                        let extractedPan = clientPanVal;
                        let cleanName = clientName;

                        if (!extractedPan && panRegex.test(clientName)) {
                            extractedPan = clientName.toUpperCase();
                            cleanName = '';
                        } else if (clientName) {
                            const panMatch = clientName.match(/\(([^)]+)\)/);
                            if (panMatch) {
                                const tempPan = panMatch[1].trim().toUpperCase();
                                if (panRegex.test(tempPan)) {
                                    extractedPan = tempPan;
                                }
                                cleanName = clientName.replace(/\([^)]+\)/, '').trim();
                            }
                        }

                        let matchedClient = null;
                        if (extractedPan) {
                            matchedClient = clients.find(c => c.pan_no && c.pan_no.toUpperCase() === extractedPan.toUpperCase());
                        }
                        if (!matchedClient && cleanName) {
                            matchedClient = clients.find(c => c.name.toLowerCase() === cleanName.toLowerCase() || c.name.toLowerCase() === clientName.toLowerCase());
                        }
                        const client_id = matchedClient ? matchedClient.id : '';

                        // Look up work type
                        const workTypeName = idxWorkType !== -1 ? String(rowData[idxWorkType] || '').trim() : '';
                        const matchedWorkType = workTypes.find(w => w.name.toLowerCase() === workTypeName.toLowerCase());
                        const work_type_id = matchedWorkType ? matchedWorkType.id : (task.work_type?.id || '');

                        // Look up assigned staff
                        let allocated_to = '';
                        let assignedToName = 'Unassigned';
                        if (idxAssignedTo !== -1) {
                            const cellVal = String(rowData[idxAssignedTo] || '').trim();
                            assignedToName = cellVal || 'Unassigned';
                            if (cellVal && cellVal.toLowerCase() !== 'unassigned') {
                                const matchedStaff = staff.find(s => s.name.trim().toLowerCase() === cellVal.toLowerCase());
                                if (matchedStaff) {
                                    allocated_to = matchedStaff.id;
                                }
                            }
                        } else {
                            allocated_to = task.allocated_to?.id || '';
                            assignedToName = task.allocated_to?.name || 'Unassigned';
                        }

                        const rawCreateDate = idxCreateDate !== -1 ? rowData[idxCreateDate] : '';
                        const date_allocated = parseExcelDate(rawCreateDate) || (task.date_allocated || '');
                        const status = idxStatus !== -1 ? String(rowData[idxStatus] || '').trim().toLowerCase() : 'assigned';
                        const sub_status = idxSubStatus !== -1 ? String(rowData[idxSubStatus] || '').trim() : '';
                        const remarks = idxRemarks !== -1 ? String(rowData[idxRemarks] || '').trim() : '';

                        // Extract dynamic fields
                        const dynamic_data = {};
                        dynamicFieldIndices.forEach(item => {
                            let rawVal = rowData[item.index] !== undefined ? rowData[item.index] : '';
                            if (item.field.type === 'date') {
                                rawVal = parseExcelDate(rawVal);
                            } else if (item.field.type === 'currency' && rawVal !== '') {
                                rawVal = formatIndianCurrencyWithDecimals(rawVal);
                            }
                            dynamic_data[item.field.label] = rawVal;
                        });

                        const existingRow = rowId ? rows.find(r => String(r.row_id) === String(rowId)) : null;
                        const isUpdate = !!existingRow;

                        // Check which fields changed
                        const changedFields = [];
                        if (existingRow) {
                            if (form_name !== (existingRow.form_name || '')) changedFields.push('Sheet Name');
                            
                            const existingClientName = clients.find(c => c.id === existingRow.client_id)?.name || 'N/A';
                            if (clientName && clientName.toLowerCase() !== existingClientName.toLowerCase()) changedFields.push('Client');
                            
                            const existingWorkTypeName = workTypes.find(w => w.id === existingRow.work_type_id)?.name || 'N/A';
                            if (workTypeName && workTypeName.toLowerCase() !== existingWorkTypeName.toLowerCase()) changedFields.push('Work Type');
                            
                            const existingStaffName = staff.find(s => s.id === existingRow.allocated_to)?.name || 'Unassigned';
                            if (assignedToName && assignedToName.toLowerCase() !== existingStaffName.toLowerCase()) changedFields.push('Assigned To');
                            
                            if (status.toLowerCase() !== (existingRow.status || 'assigned').toLowerCase()) changedFields.push('Sheet Status');
                            if (sub_status !== (existingRow.sub_status || '')) changedFields.push('Sub Status');
                            if (remarks !== (existingRow.remarks || '')) changedFields.push('Remarks');

                            dynamicFieldIndices.forEach(item => {
                                const newVal = dynamic_data[item.field.label];
                                const oldVal = existingRow.dynamic_data?.[item.field.label] || '';
                                if (String(newVal) !== String(oldVal)) {
                                    changedFields.push(item.field.label);
                                }
                            });
                        }

                        importedRows.push({
                            row_id: rowId,
                            form_name,
                            client_id,
                            client_name: clientName,
                            parsed_client_name: cleanName || clientName,
                            parsed_client_pan: extractedPan,
                            work_type_id,
                            work_type_name: workTypeName,
                            allocated_to,
                            assigned_to_name: assignedToName,
                            date_allocated,
                            status,
                            sub_status,
                            remarks,
                            dynamic_data,
                            isUpdate,
                            changedFields
                        });
                    }

                    setPreviewRows(importedRows);
                    setIsImportPreviewOpen(true);
                    toast.success('Excel spreadsheet parsed successfully!', { id: loadingToast });
                } catch (e) {
                    console.error(e);
                    toast.error('Failed to parse sheet data.', { id: loadingToast });
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (e) {
            console.error(e);
            toast.error('Failed to read Excel file.', { id: loadingToast });
        } finally {
            e.target.value = '';
        }
    };

    const handleConfirmImport = async () => {
        const loadingToast = toast.loading('Saving imported rows...');
        try {
            const updatedRows = [...rows];
            previewRows.forEach(importedRow => {
                const matchedIndex = importedRow.row_id ? updatedRows.findIndex(r => String(r.row_id) === String(importedRow.row_id)) : -1;
                
                const cleanRowData = {
                    row_id: importedRow.row_id,
                    form_name: importedRow.form_name,
                    client_id: importedRow.client_id || (task.client?.id || ''),
                    work_type_id: importedRow.work_type_id,
                    allocated_to: importedRow.allocated_to,
                    date_allocated: importedRow.date_allocated,
                    status: importedRow.status,
                    sub_status: importedRow.sub_status,
                    remarks: importedRow.remarks,
                    dynamic_data: importedRow.dynamic_data
                };

                if (matchedIndex !== -1) {
                    updatedRows[matchedIndex] = {
                        ...updatedRows[matchedIndex],
                        ...cleanRowData
                    };
                } else {
                    const newId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    updatedRows.push({
                        ...cleanRowData,
                        row_id: newId
                    });
                }
            });

            setRows(updatedRows);
            await handleSaveRows(updatedRows, 'Imported Excel sheet successfully!');
            setIsImportPreviewOpen(false);
            toast.success('Excel import completed successfully!', { id: loadingToast });
        } catch (err) {
            console.error(err);
            toast.error('Failed to save imported rows.', { id: loadingToast });
        }
    };

    const handleQuickAddClient = (row) => {
        setQuickAddClientForm({
            ...EMPTY_CLIENT_FORM,
            name: row.parsed_client_name || '',
            pan_no: (row.parsed_client_pan || '').toUpperCase(),
            credentials: {
                efiling_password: '',
                ais_tis_password: ''
            }
        });
        setQuickAddClientErrors({});
        setIsQuickAddClientOpen(true);
    };

    const handleSaveQuickClient = async () => {
        if (!quickAddClientForm.name.trim()) {
            toast.error('Client name is required.');
            return;
        }
        if (!quickAddClientForm.type) {
            toast.error('Client type is required.');
            return;
        }
        if (!quickAddClientForm.group) {
            toast.error('Client group is required.');
            return;
        }
        const panStatus = getQuickClientPanValidation();
        if (panStatus && !panStatus.valid) {
            toast.error(panStatus.msg);
            return;
        }
        const gstStatus = getQuickClientGstValidation();
        if (gstStatus && !gstStatus.valid) {
            toast.error(gstStatus.msg);
            return;
        }
        if (quickAddClientForm.contact && quickAddClientForm.contact.replace(/\D/g, '').length !== 10) {
            toast.error('Contact No must be exactly 10 digits.');
            return;
        }

        setSavingQuickClient(true);
        setQuickAddClientErrors({});
        try {
            const payload = {
                ...quickAddClientForm,
                pan_no: (quickAddClientForm.pan_no || '').toUpperCase()
            };
            const res = await api.post('/ca/clients', payload);
            const newClient = res.data.data;
            
            // Add new client to local list
            setClients(prev => {
                const next = [...prev, newClient];
                try {
                    sessionStorage.setItem('cached_clients', JSON.stringify(next));
                } catch (e) {}
                return next;
            });
            
            // Map new client to matching preview rows
            setPreviewRows(prev => prev.map(r => {
                const matchesName = r.parsed_client_name && r.parsed_client_name.toLowerCase() === newClient.name.toLowerCase();
                const matchesPan = r.parsed_client_pan && newClient.pan_no && r.parsed_client_pan.toUpperCase() === newClient.pan_no.toUpperCase();
                if (matchesName || matchesPan) {
                    return {
                        ...r,
                        client_id: newClient.id,
                        client_name: newClient.name,
                        parsed_client_pan: newClient.pan_no,
                        changedFields: r.changedFields.filter(f => f !== 'Client')
                    };
                }
                return r;
            }));

            setIsQuickAddClientOpen(false);
            toast.success('Client registered and mapped successfully!');
        } catch (e) {
            setQuickAddClientErrors(e.response?.data?.errors ?? {});
            toast.error(e.response?.data?.message || 'Please fix validation errors');
        } finally {
            setSavingQuickClient(false);
        }
    };


    if (loading || !task) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    const selectedField = schema.find(f => f.id === activeFieldId);

    const subStatusOptions = getSubStatusOptions(task, schema);

    const getSubStatusCount = (subStatus) => {
        return rows.filter(r => {
            const rowSubStatus = r.sub_status || r.dynamic_data?.['Sub Status'] || r.dynamic_data?.['static_sub_status'];
            if (subStatus === 'Unassigned') {
                return !rowSubStatus;
            }
            return rowSubStatus === subStatus;
        }).length;
    };

    const statusFilterMap = {
        'Pending': 'pending',
        'Work In Progress': 'work_in_progress',
        'Complete': 'complete',
        'Not To Be Done': 'not_to_be_done',
        'Other': 'other'
    };

    const filteredSubTasks = task.sub_tasks || [];


    // Dynamic static Billing fields schema
    const billingSchema = [
        { id: 'dynamic_TASK IS BILLABLE OR NOT', label: 'TASK IS BILLABLE OR NOT', type: 'dropdown', options: ['YES', 'NO'] },
        { id: 'dynamic_BILL NO', label: 'BILL NO', type: 'text' },
        { id: 'dynamic_BILL AMOUNT', label: 'BILL AMOUNT', type: 'currency' },
        { id: 'dynamic_INVOICE SENT TO CLIENT', label: 'INVOICE SENT TO CLIENT', type: 'dropdown', options: ['YES', 'NO', 'PENDING'] },
        { id: 'dynamic_DATE OF SENDING TO CLIENT', label: 'DATE OF SENDING TO CLIENT', type: 'date' },
        { id: 'dynamic_STATUS', label: 'STATUS', type: 'dropdown', options: ['PAID', 'UNPAID', 'PENDING'] },
        { id: 'dynamic_INVOICE IS CREATED', label: 'INVOICE IS CREATED', type: 'dropdown', options: ['YES', 'PENDING'] },
        { id: 'dynamic_CREATED BY', label: 'CREATED BY', type: 'text' },
        { id: 'dynamic_VERIFY BY', label: 'VERIFY BY', type: 'checkbox', options: ['CA MAHESH SIR', 'SAMIYA', 'MANISH'] },
        { id: 'dynamic_TOTAL INVOICE AMOUNT', label: 'TOTAL INVOICE AMOUNT', type: 'currency' },
        { id: 'dynamic_DATE OF INVOICE', label: 'DATE OF INVOICE', type: 'date' },
        { id: 'dynamic_INVOICE SENT MODE / FROM', label: 'INVOICE SENT MODE / FROM', type: 'dropdown', options: ['MAHESH SIR- 9270200217', 'EMAIL- SENT', 'BLUE- 7276060217', 'PINK- 9523479523', 'GREEN- 9523299523', 'SKY BLUE -9588656472', 'GREY- 9975460217'] },
        { id: 'dynamic_DATE OF SENT', label: 'DATE OF SENT', type: 'date' },
        { id: 'dynamic_PAYMENT-1', label: 'PAYMENT-1', type: 'currency' },
        { id: 'dynamic_DATE-1', label: 'DATE-1', type: 'date' },
        { id: 'dynamic_PAYMENT-2', label: 'PAYMENT-2', type: 'currency' },
        { id: 'dynamic_DATE-2', label: 'DATE-2', type: 'date' },
        { id: 'dynamic_PAYMENT-3', label: 'PAYMENT-3', type: 'currency' },
        { id: 'dynamic_DATE-3', label: 'DATE-3', type: 'date' },
        { id: 'dynamic_BALANCE AMOUNT', label: 'BALANCE AMOUNT', type: 'currency', readOnly: true },
        { id: 'dynamic_BILLING FOLLOW UP', label: 'BILLING FOLLOW UP', type: 'text' },
        { id: 'dynamic_PR ACTIVE UPDATION', label: 'PR ACTIVE UPDATION', type: 'text' },
        { id: 'dynamic_FINAL REMARK', label: 'FINAL REMARK', type: 'text' }
    ].map(f => {
        let finalOptions = f.options || [];
        if (task && task.dynamic_fields) {
            let fields = task.dynamic_fields;
            if (typeof fields === 'string') {
                try { fields = JSON.parse(fields); } catch(e) {}
            }
            const schema = fields?.schema;
            if (Array.isArray(schema)) {
                const matchedField = schema.find(sf => sf.id === f.id || sf.label === f.label);
                if (matchedField && Array.isArray(matchedField.options) && matchedField.options.length > 0) {
                    finalOptions = matchedField.options;
                }
            }
        }
        return {
            id: f.id,
            label: f.label,
            minWidth: 'min-w-[150px]',
            isDynamic: true,
            field: {
                id: f.id.replace('dynamic_', ''),
                label: f.label,
                type: f.type,
                options: finalOptions,
                readOnly: !!f.readOnly
            }
        };
    });

    // Dynamic static After Sales fields schema
    const afterSalesSchema = [
        { id: 'dynamic_CUSTOMER SERVICE CALL', label: 'CUSTOMER SERVICE CALL', type: 'text' },
        { id: 'dynamic_DATE OF CALLING', label: 'DATE OF CALLING', type: 'date' },
        { id: 'dynamic_CALL BY WHOM', label: 'CALL BY WHOM', type: 'dropdown', options: staff.map(s => s.name) },
        { id: 'dynamic_CLIENT FEED BACK', label: 'CLIENT FEED BACK', type: 'longtext' },
        { id: 'dynamic_GOOGLE REVIEW', label: 'GOOGLE REVIEW', type: 'dropdown', options: ['YES', 'NO', 'PENDING'] },
        { id: 'dynamic_DATE OF GOOGLE REVIEW', label: 'DATE OF GOOGLE REVIEW', type: 'date' },
        { id: 'dynamic_APP DOWN LOADED', label: 'APP DOWN LOADED', type: 'dropdown', options: ['YES', 'NO'] },
        { id: 'dynamic_MAHESH SIR MOBILE SAVED', label: 'MAHESH SIR MOBILE SAVED', type: 'dropdown', options: ['YES', 'NO'] },
        { id: 'dynamic_SOCIAL MEDIA CONNECTION', label: 'SOCIAL MEDIA CONNECTION', type: 'dropdown', options: ['FACEBOOK', 'INSTA', 'LINKED IN', 'ALL', 'NONE'] },
        { id: 'dynamic_OTHER REMARK', label: 'OTHER REMARK', type: 'longtext' }
    ].map(f => {
        let finalOptions = f.options || [];
        if (task && task.dynamic_fields) {
            let fields = task.dynamic_fields;
            if (typeof fields === 'string') {
                try { fields = JSON.parse(fields); } catch(e) {}
            }
            const schema = fields?.schema;
            if (Array.isArray(schema)) {
                const matchedField = schema.find(sf => sf.id === f.id || sf.label === f.label);
                if (matchedField && Array.isArray(matchedField.options) && matchedField.options.length > 0) {
                    finalOptions = matchedField.options;
                }
            }
        }
        return {
            id: f.id,
            label: f.label,
            minWidth: 'min-w-[150px]',
            isDynamic: true,
            field: {
                id: f.id.replace('dynamic_', ''),
                label: f.label,
                type: f.type,
                options: finalOptions
            }
        };
    });

    const filteredSchema = schema.filter(f => {
        if (Number(f.section) === 3 && !isBillableEnabled) return false;
        if (Number(f.section) === 4 && !isAfterSalesEnabled) return false;
        // Safety check by field label fallback
        if (!isBillableEnabled && billingSchema.some(b => b.label.toUpperCase() === f.label.toUpperCase())) return false;
        if (!isAfterSalesEnabled && afterSalesSchema.some(a => a.label.toUpperCase() === f.label.toUpperCase())) return false;
        return true;
    });

    const baseColumns = filteredSchema.length > 0 ? [
        { id: 'client', label: 'Client', minWidth: 'min-w-[240px]' },
        { id: 'client_pan', label: 'PAN No', minWidth: 'min-w-[130px]' },
        ...filteredSchema.map(f => {
            if (f.id === 'static_client_name') return null;
            if (f.id === 'static_form_name') return null;
            if (f.id === 'static_work_type') return null;
            if (f.id === 'static_created_date') return { id: 'date_allocated', label: 'Create Date', minWidth: 'min-w-[150px]' };
            if (f.id === 'static_remarks') return { id: 'remarks', label: 'Remarks', minWidth: 'min-w-[200px]' };
            if (f.id === 'static_sheet_status') return { id: 'status', label: 'Status', minWidth: 'min-w-[150px]' };
            if (f.id === 'static_assignee') {
                return { id: 'assigned_to', label: 'Assigned To', minWidth: 'min-w-[150px]' };
            }
            if (f.id === 'static_sub_status') {
                return { id: 'sub_status', label: 'Sub Status', minWidth: 'min-w-[150px]', field: f };
            }
            return {
                id: `dynamic_${f.label}`,
                label: f.label,
                minWidth: f.type === 'longtext' ? 'min-w-[300px]' : (f.type === 'progress_auto' || f.type === 'progress_manual' ? 'min-w-[150px]' : (f.type === 'checkbox' ? 'min-w-[120px]' : 'min-w-[150px]')),
                isDynamic: true,
                field: f
            };
        }).filter(Boolean),
        ...(isBillableEnabled && !filteredSchema.some(f => Number(f.section) === 3 || billingSchema.some(b => b.label.toUpperCase() === f.label.toUpperCase())) ? billingSchema : []),
        ...(isAfterSalesEnabled && !filteredSchema.some(f => Number(f.section) === 4 || afterSalesSchema.some(a => a.label.toUpperCase() === f.label.toUpperCase())) ? afterSalesSchema : []),
        ...(allowAttachments ? [{ id: 'attachments', label: 'Attachments', minWidth: 'min-w-[120px]' }] : []),
        { id: 'is_verified', label: 'Verification', minWidth: 'min-w-[120px]' }
    ] : [
        { id: 'client', label: 'Client', minWidth: 'min-w-[240px]' },
        { id: 'client_pan', label: 'PAN No', minWidth: 'min-w-[130px]' },
        ...(isBillableEnabled && !filteredSchema.some(f => Number(f.section) === 3 || billingSchema.some(b => b.label.toUpperCase() === f.label.toUpperCase())) ? billingSchema : []),
        ...(isAfterSalesEnabled && !filteredSchema.some(f => Number(f.section) === 4 || afterSalesSchema.some(a => a.label.toUpperCase() === f.label.toUpperCase())) ? afterSalesSchema : []),
        ...(allowAttachments ? [{ id: 'attachments', label: 'Attachments', minWidth: 'min-w-[120px]' }] : []),
        { id: 'is_verified', label: 'Verification', minWidth: 'min-w-[120px]' }
    ];
 
    // Deduplicate baseColumns by ID
    const uniqueBaseColumns = [];
    const seenIds = new Set();
    baseColumns.forEach(col => {
        if (col && col.id && !seenIds.has(col.id)) {
            seenIds.add(col.id);
            uniqueBaseColumns.push(col);
        }
    });

    let activeColumns = [];
    if (customColumnOrder) {
        const filteredCustomOrder = customColumnOrder.filter(id => id !== 'client' && id !== 'client_pan');
        const baseIds = uniqueBaseColumns.map(c => c.id).filter(id => id !== 'client' && id !== 'client_pan');
        const ordered = filteredCustomOrder.filter(id => baseIds.includes(id));
        const missing = baseIds.filter(id => !ordered.includes(id));
        const finalIds = ['client', 'client_pan', ...ordered, ...missing];
        const uniqueFinalIds = Array.from(new Set(finalIds));
        activeColumns = uniqueFinalIds.map(id => uniqueBaseColumns.find(c => c.id === id)).filter(Boolean);
    } else {
        const restCols = uniqueBaseColumns.filter(c => c.id !== 'client' && c.id !== 'client_pan');
        const clientCol = uniqueBaseColumns.find(c => c.id === 'client');
        const panCol = uniqueBaseColumns.find(c => c.id === 'client_pan');
        activeColumns = [clientCol, panCol, ...restCols].filter(Boolean);
    }
 
    const allFields = activeColumns.map(col => {
        if (col.id === 'form_name') return { key: 'form_name', label: 'Sheet Name', isStatic: true };
        if (col.id === 'client') return { key: 'client_id', label: 'Client', isStatic: true };
        if (col.id === 'client_pan') return { key: 'client_pan', label: 'PAN No', isStatic: true };
        if (col.id === 'work_type') return { key: 'work_type_id', label: 'Work Type', isStatic: true };
        if (col.id === 'assigned_to') return { key: 'allocated_to', label: 'Assigned To', isStatic: true };
        if (col.id === 'date_allocated') return { key: 'date_allocated', label: 'Create Date', isStatic: true };
        if (col.id === 'status') return { key: 'status', label: 'Sheet Status', isStatic: true };
        if (col.id === 'sub_status') return { key: 'sub_status', label: 'Sub Status', isStatic: true, options: col.field?.options };
        if (col.id === 'attachments') return { key: 'attachments', label: 'Attachments', isStatic: true };
        if (col.id === 'is_verified') return { key: 'is_verified', label: 'Verification', isStatic: true };
        if (col.isDynamic) return { key: col.label, label: col.label, isStatic: false, type: col.field?.type, options: col.field?.options, section: col.field?.section };
        return null;
    }).filter(Boolean);

    const filteredRows = rows;
    const sortedRows = rows;
    const totalPages = Math.ceil(totalRows / (rowsPerPage === 'All' ? totalRows || 1 : rowsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages || 1);
    const paginatedRows = rows;

    return (
        <div className="space-y-6 max-w-[100vw] pb-12 relative">
            <style dangerouslySetInnerHTML={{__html: `
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #0f172a;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 1px 3px rgba(15,23,42,0.25);
                    transition: transform 0.1s ease;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                    transform: scale(1.15);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
                    border-radius: 50%;
                    background: #0f172a;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 1px 3px rgba(15,23,42,0.25);
                    transition: transform 0.1s ease;
                }
                input[type="range"]::-moz-range-thumb:hover {
                    transform: scale(1.15);
                }
            `}} />
            {/* Redesigned Premium Header Block */}
            {!hideBackHeader && (
                <div className="bg-white rounded-[2rem] border border-slate-100/80 py-3.5 px-6 md:py-4.5 md:px-8 shadow-sm space-y-3 animate-fade-in relative overflow-hidden">
                    {/* Decorative background gradients for premium SaaS feel */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50/20 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

                    {/* Top Row: Breadcrumbs and Info Badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                        <nav className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <Link to={isStaff ? "/staff/tasks" : "/ca/tasks"} className="hover:text-indigo-655 transition flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                Sheets
                            </Link>
                            <ChevronRight size={10} className="text-slate-355" />
                            {task.work_type && (
                                <>
                                    <Link to={isStaff ? `/staff/tasks?work_type_id=${task.work_type.id}` : `/ca/tasks?work_type_id=${task.work_type.id}`} className="hover:text-indigo-655 transition">
                                        {task.work_type.name}
                                    </Link>
                                    <ChevronRight size={10} className="text-slate-355" />
                                </>
                            )}
                            <span className="text-slate-800 font-extrabold max-w-[200px] truncate">{task.form_name || 'View Sheet'}</span>
                        </nav>

                        {/* Small Pulsing Glass Status Badge */}
                        <div className="self-start sm:self-auto bg-indigo-50/50 border border-indigo-100/60 text-indigo-655 px-3 py-1 rounded-full text-[9px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-sm">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                            </span>
                            Form Workspace
                        </div>
                    </div>

                    {/* Main Row: Back Button, Title, and Action Toolbar */}
                    <div className="flex flex-row items-center justify-between gap-2.5 pt-2 border-t border-slate-50 relative z-10 w-full overflow-x-auto no-scrollbar">
                        {/* Left: Sleek Back + App Icon + Title */}
                        <div className="flex items-center gap-2 min-w-0 shrink-0">
                            <button 
                                onClick={() => navigate(isStaff ? '/staff/tasks' : '/ca/tasks')} 
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition flex items-center justify-center shrink-0 shadow-sm hover:shadow"
                                title="Back to Sheets"
                            >
                                <ChevronLeft size={16} />
                            </button>

                            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10 shrink-0">
                                <Layout size={15} />
                            </div>

                            <h1 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-tight shrink-0">
                                {isEditing ? (
                                    <input
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        className="bg-transparent border-b border-indigo-600 outline-none focus:border-indigo-700 transition min-w-[150px] text-sm md:text-base font-black"
                                        placeholder="Form Name"
                                    />
                                ) : (
                                    formName
                                )}
                            </h1>
                        </div>

                        {/* Right: Elegant action buttons bar & filters in one line */}
                        <div className="flex items-center gap-2 shrink-0 select-none">
                            {/* Status filters buttons (decreased size) */}
                            <button
                                onClick={() => setShowMainStatusFilters(!showMainStatusFilters)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition duration-200 border cursor-pointer active:scale-95 shadow-sm shrink-0 ${showMainStatusFilters ? 'bg-[#1F5C99] border-[#1F5C99] text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span>Main Status</span>
                                <div className="w-4 h-4 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-[#1F5C99] rounded">
                                    <Plus size={10} className={`transition-transform duration-200 ${showMainStatusFilters ? 'rotate-45' : ''}`} />
                                </div>
                            </button>
                            <button
                                onClick={() => setShowSubStatusFilters(!showSubStatusFilters)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition duration-200 border cursor-pointer active:scale-95 shadow-sm shrink-0 ${showSubStatusFilters ? 'bg-[#1F5C99] border-[#1F5C99] text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                            >
                                <span>Sub Status</span>
                                <div className="w-4 h-4 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-[#1F5C99] rounded">
                                    <Plus size={10} className={`transition-transform duration-200 ${showSubStatusFilters ? 'rotate-45' : ''}`} />
                                </div>
                            </button>

                            {(!isStaff || user?.special_permissions?.import_export_sheet || user?.special_permissions?.edit_sheet) && (
                                <>
                                    <div className="h-5 w-[1px] bg-slate-200 mx-1 shrink-0"></div>

                                    {/* Export / Import / Settings / Layout (decreased size) */}
                                    {(!isStaff || user?.special_permissions?.import_export_sheet) && (
                                        <>
                                            <button 
                                                onClick={handleExport} 
                                                className="flex items-center gap-1.5 text-emerald-755 bg-emerald-50/75 hover:bg-emerald-100/80 border border-emerald-200/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
                                            >
                                                <FileDown size={12} className="text-emerald-600" /> 
                                                <span>Export Excel</span>
                                            </button>
                                            <label 
                                                className="flex items-center gap-1.5 text-indigo-755 bg-indigo-50/75 hover:bg-indigo-100/80 border border-indigo-200/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95 duration-200 cursor-pointer shrink-0"
                                            >
                                                <FileUp size={12} className="text-indigo-600" />
                                                <span>Import Excel</span>
                                                <input 
                                                    type="file" 
                                                    accept=".xlsx, .xls" 
                                                    onChange={handleImportExcel} 
                                                    className="hidden" 
                                                />
                                            </label>
                                        </>
                                    )}
                                    {/* {isAdmin && (
                                        <Link 
                                            to={`/logs?task_id=${id}`}
                                            className="flex items-center gap-1.5 text-slate-755 bg-slate-50/75 hover:bg-slate-100/80 border border-slate-200/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
                                        >
                                            <Clock size={12} className="text-[#1F5C99]" />
                                            <span>View Logs</span>
                                        </Link>
                                    )} */}
                                    {(!isStaff || user?.special_permissions?.edit_sheet) && (
                                        <>
                                            <button 
                                                onClick={() => setIsGlobalModalOpen(true)}
                                                className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/75 hover:bg-indigo-100/80 border border-indigo-200/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
                                            >
                                                <Sliders size={12} className="text-indigo-500" />
                                                <span>Global Settings</span>
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (!task) return;
                                                    const duplicateData = {
                                                        form_name: task.form_name,
                                                        client_id: task.client?.id,
                                                        work_type_id: task.work_type?.id,
                                                        remarks: task.remarks,
                                                        dynamic_fields: task.dynamic_fields,
                                                        created_at: task.created_at,
                                                        status: task.status,
                                                        allow_attachments: task.allow_attachments,
                                                        allow_checklist: task.allow_checklist,
                                                        allow_notes: task.allow_notes,
                                                        is_billable: task.is_billable,
                                                        is_after_sales: task.is_after_sales,
                                                        allow_duplicate_clients: task.allow_duplicate_clients,
                                                        subtasks: (task.sub_tasks || []).map(st => ({
                                                            title: st.title,
                                                            assigned_to: st.assigned_to?.id,
                                                            priority: st.priority,
                                                            status: st.status,
                                                            due_date: st.due_date,
                                                            remarks: st.remarks
                                                        }))
                                                    };
                                                    navigate(isStaff ? '/staff/tasks/builder' : '/ca/tasks/builder', { state: { duplicateData, isEditing: true, taskId: task.id } });
                                                }}
                                                className="flex items-center gap-1.5 text-violet-755 bg-violet-50/75 hover:bg-violet-100/80 border border-violet-200/50 px-2.5 py-1.5 rounded-lg text-[10px] font-black transition cursor-pointer shadow-sm active:scale-95 duration-200 shrink-0"
                                            >
                                                <Edit2 size={12} className="text-violet-600" /> 
                                                <span>Layout Builder</span>
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Global Settings Modal */}
            {isGlobalModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-fade-in">
                    <div 
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                        onClick={() => setIsGlobalModalOpen(false)} 
                    />
                    
                    <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col border border-slate-100">
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                            <div className="flex items-center gap-2 text-slate-800">
                                <Sliders size={18} className="text-indigo-600" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">
                                    Global Control Panel Settings
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsGlobalModalOpen(false)} 
                                className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-655"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-8 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Global Status */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-450">
                                        <Circle size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Global Status</span>
                                    </div>
                                    <select
                                        value={globalStatus}
                                        onChange={e => setGlobalStatus(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 capitalize focus:outline-none"
                                    >
                                        <option value="complete">Complete</option>
                                        <option value="work_in_progress">Work In Progress</option>
                                        <option value="pending">Pending</option>
                                        <option value="not_to_be_done">Not To Be Done</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                {/* Allow Attachments Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-450">
                                        <Zap size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Attachment Option</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setAllowAttachments(!allowAttachments)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Allow uploads
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={allowAttachments}
                                                onChange={(e) => setAllowAttachments(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Allow Sub-Tasks Checklist Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-455">
                                        <CheckSquare size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Checklist Option</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setAllowChecklist(!allowChecklist)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Allow checklist
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={allowChecklist}
                                                onChange={(e) => setAllowChecklist(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Allow Sheet Notes Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-455">
                                        <FileText size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Notes Option</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setAllowNotes(!allowNotes)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Allow notes
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={allowNotes}
                                                onChange={(e) => setAllowNotes(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Enable Billing Section Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-455">
                                        <Sliders size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Billing Section</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setIsBillableEnabled(!isBillableEnabled)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Enable Billing Fields
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isBillableEnabled}
                                                onChange={(e) => setIsBillableEnabled(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Enable After Sales Section Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-455">
                                        <Globe size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">After Sales Service Section</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setIsAfterSalesEnabled(!isAfterSalesEnabled)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Enable After Sales Fields
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isAfterSalesEnabled}
                                                onChange={(e) => setIsAfterSalesEnabled(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Allow Duplicate Clients Toggle */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-455">
                                        <UserPlus size={14} className="text-indigo-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Client Multi-Row Option</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl h-[46px] cursor-pointer" onClick={() => setAllowDuplicateClients(!allowDuplicateClients)}>
                                        <span className="text-xs font-bold text-slate-700 select-none">
                                            Allow duplicate clients
                                        </span>
                                        <label className="toggle-switch shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={allowDuplicateClients}
                                                onChange={(e) => setAllowDuplicateClients(e.target.checked)}
                                            />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>

                                {/* Global Remarks */}
                                <div className="space-y-3 md:col-span-2">
                                    <div className="flex items-center gap-2 text-slate-450">
                                        <AlignLeft size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Global Remarks</span>
                                    </div>
                                    <textarea
                                        value={globalRemarks}
                                        onChange={e => setGlobalRemarks(e.target.value)}
                                        placeholder="Add global notes..."
                                        rows="2"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-650 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Roles & Permissions Section */}
                            {!isStaff && (
                                <div className="pt-8 border-t border-slate-100 space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Roles & Permissions Configuration</h3>
                                    </div>
                                    <p className="text-xs text-slate-450 font-semibold mb-4">
                                        Configure which roles can access this sheet. If no roles are configured, all staff members will have full access.
                                    </p>

                                    <div className="flex items-center gap-3 mb-6 max-w-md">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                value={selectedRoleId}
                                                options={availableRoles
                                                    .filter(role => !sheetPermissions.some(p => Number(p.role_id) === role.id))
                                                    .map(role => ({ value: role.id, label: role.name }))
                                                }
                                                placeholder="Select Role"
                                                onChange={(val) => setSelectedRoleId(val)}
                                                direction="down"
                                                size="sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleAddRolePermission}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-lg h-[38px] shrink-0"
                                        >
                                            <Plus size={14} />
                                            <span>Add Role</span>
                                        </button>
                                    </div>

                                    {sheetPermissions.length > 0 ? (
                                        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                                        <th className="px-6 py-4">Role</th>
                                                        <th className="px-6 py-4 text-center">Read</th>
                                                        <th className="px-6 py-4 text-center">Write</th>
                                                        <th className="px-6 py-4 text-center">Delete</th>
                                                        <th className="px-6 py-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200 text-slate-700 text-xs">
                                                    {sheetPermissions.map((perm, index) => {
                                                        const role = availableRoles.find(r => r.id === Number(perm.role_id));
                                                        return (
                                                            <tr key={perm.role_id} className="hover:bg-slate-50/50 transition">
                                                                <td className="px-6 py-4 font-bold text-slate-800">{role?.name || `Role #${perm.role_id}`}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={perm.can_read}
                                                                        onChange={(e) => handleTogglePermission(index, 'can_read', e.target.checked)}
                                                                        className="w-4 h-4 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={perm.can_write}
                                                                        onChange={(e) => handleTogglePermission(index, 'can_write', e.target.checked)}
                                                                        className="w-4 h-4 text-indigo-600 border-slate-355 rounded focus:ring-indigo-500"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={perm.can_delete}
                                                                        onChange={(e) => handleTogglePermission(index, 'can_delete', e.target.checked)}
                                                                        className="w-4 h-4 text-indigo-600 border-slate-360 rounded focus:ring-indigo-500"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <Tooltip content="Remove Permission" position="left">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveRolePermission(perm.role_id)}
                                                                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </Tooltip>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                            <p className="text-xs text-slate-450 font-semibold">No role permissions configured. This sheet will be open to all staff.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/40">
                            <button
                                type="button"
                                onClick={() => setIsGlobalModalOpen(false)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateGlobal}
                                disabled={saving}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-755 text-white px-5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                            >
                                <Save size={14} />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subtask Stats Cards */}
            {showMainStatusFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 w-full animate-fade-in">
                    {[
                        { label: 'Pending', count: statusCounts?.pending ?? 0, icon: CircleDashed, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', sub: 'Waiting to start', subColor: 'text-amber-500 font-semibold', active: selectedStatusFilter === 'pending', filterVal: 'pending' },
                        { label: 'Work In Progress', count: statusCounts?.work_in_progress ?? 0, icon: Clock, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', sub: 'Currently active', subColor: 'text-blue-500 font-semibold', active: selectedStatusFilter === 'work_in_progress', filterVal: 'work_in_progress' },
                        { label: 'Complete', count: statusCounts?.complete ?? 0, icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-500', sub: 'Completed successfully', subColor: 'text-green-500 font-semibold', active: selectedStatusFilter === 'complete', filterVal: 'complete' },
                        { label: 'Not To Be Done', count: statusCounts?.not_to_be_done ?? 0, icon: Circle, iconBg: 'bg-red-50', iconColor: 'text-red-500', sub: 'Cancelled / Skipped', subColor: 'text-red-500 font-semibold', active: selectedStatusFilter === 'not_to_be_done', filterVal: 'not_to_be_done' },
                        { label: 'Other', count: statusCounts?.other ?? 0, icon: Sliders, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'Other status', subColor: 'text-slate-500', active: selectedStatusFilter === 'other', filterVal: 'other' },
                        { label: 'Total Sheets', count: statusCounts?.total ?? 0, icon: FileText, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'All rows of this sheet', subColor: 'text-slate-500', active: !selectedStatusFilter, filterVal: null }
                    ].map((card, i) => (
                        <SummaryCard 
                            key={i} 
                            icon={card.icon}
                            iconBg={card.iconBg}
                            iconColor={card.iconColor}
                            label={card.label}
                            value={card.count}
                            sub={card.sub}
                            subColor={card.subColor}
                            active={card.active}
                            onClick={() => {
                                if (card.filterVal === null) {
                                    setSelectedStatusFilter(null);
                                } else {
                                    setSelectedStatusFilter(prev => prev === card.filterVal ? null : card.filterVal);
                                }
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Sub-status Filter Cards */}
            {showSubStatusFilters && (
                <div className="space-y-4 animate-fade-in mt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest">Filter by Sub Status</span>
                            {(selectedStatusFilter || selectedSubStatusFilter) && (
                                <button 
                                    onClick={() => {
                                        setSelectedStatusFilter(null);
                                        setSelectedSubStatusFilter(null);
                                    }}
                                    className="text-[10px] font-extrabold text-indigo-655 hover:text-indigo-855 transition"
                                >
                                    • Clear all filters
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 w-full">
                        {[
                            { label: 'All Sub Statuses', count: statusCounts?.total ?? 0, value: null, icon: Zap, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', sub: 'Show all rows', subColor: 'text-indigo-500 font-semibold' },
                            { label: 'Unassigned', count: subStatusCounts?.Unassigned ?? 0, value: 'Unassigned', icon: UserPlus, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'Not allocated to anyone', subColor: 'text-slate-500' },
                            ...subStatusOptions.map(opt => {
                                const lowerOpt = opt.toLowerCase();
                                let icon = SlidersHorizontal;
                                let iconBg = 'bg-indigo-50';
                                let iconColor = 'text-indigo-500';
                                let sub = 'Custom workflow status';
                                let subColor = 'text-indigo-500 font-semibold';
                                
                                if (lowerOpt.includes('complete') || lowerOpt.includes('done')) {
                                    icon = CheckCircle2;
                                    iconBg = 'bg-green-50';
                                    iconColor = 'text-green-500';
                                    sub = 'Completed workflow';
                                    subColor = 'text-green-500 font-semibold';
                                } else if (lowerOpt.includes('approv') || lowerOpt.includes('verify') || lowerOpt.includes('check')) {
                                    icon = Clock;
                                    iconBg = 'bg-amber-50';
                                    iconColor = 'text-amber-500';
                                    sub = 'Awaiting verification';
                                    subColor = 'text-amber-500 font-semibold';
                                } else if (lowerOpt.includes('document') || lowerOpt.includes('pending') || lowerOpt.includes('paper')) {
                                    icon = FileText;
                                    iconBg = 'bg-blue-50';
                                    iconColor = 'text-blue-500';
                                    sub = 'Needs documents';
                                    subColor = 'text-blue-500 font-semibold';
                                }
                                
                                return {
                                    label: opt,
                                    count: subStatusCounts?.[opt] ?? 0,
                                    value: opt,
                                    icon,
                                    iconBg,
                                    iconColor,
                                    sub,
                                    subColor
                                };
                            })
                        ].map((card, i) => {
                            const isActive = (card.value === null && !selectedSubStatusFilter) || (selectedSubStatusFilter === card.value);
                            return (
                                <SummaryCard 
                                    key={i}
                                    icon={card.icon}
                                    iconBg={card.iconBg}
                                    iconColor={card.iconColor}
                                    label={card.label}
                                    value={card.count}
                                    sub={card.sub}
                                    subColor={card.subColor}
                                    active={isActive}
                                    onClick={() => {
                                        setSelectedSubStatusFilter(prev => prev === card.value ? null : card.value);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
            {/* Sheet Information Table (Excel/Spreadsheet style row) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 animate-fade-in mt-6">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-100 w-full">
                    {/* Title block */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10 shrink-0">
                            <FileText size={18} />
                        </div>
                        <div className="shrink-0">
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Sheet Information</h2>
                            <p className="text-xs text-slate-405 font-bold tracking-wide mt-0.5">Spreadsheet metadata & custom variables</p>
                        </div>
                    </div>
                    
                    {/* Filters & Actions inline block */}
                    <div className="flex flex-1 flex-col sm:flex-row items-center gap-3 w-full">
                        {/* Search Input (flex-1 to take remaining space) */}
                        <div className="relative flex-1 w-full">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search in this sheet..." 
                                value={sheetSearch}
                                onChange={e => setSheetSearch(e.target.value)}
                                className="pl-9 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-650 w-full transition font-semibold text-slate-700 shadow-sm" 
                            />
                            {sheetSearch && (
                                <button
                                    onClick={() => setSheetSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655 transition"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Dropdowns & Buttons */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto shrink-0">
                            <select
                                value={sheetStatusFilter}
                                onChange={e => setSheetStatusFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-755 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-655 focus:outline-none w-full sm:w-[130px] h-[36px] shadow-sm cursor-pointer"
                            >
                                <option value="">All Status</option>
                                <option value="complete">Complete</option>
                                <option value="work_in_progress">Work In Progress</option>
                                <option value="pending">Pending</option>
                                <option value="not_to_be_done">Not To Be Done</option>
                                <option value="other">Other</option>
                            </select>
                            <select
                                value={sheetWorkTypeFilter}
                                onChange={e => setSheetWorkTypeFilter(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-755 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-655 focus:outline-none w-full sm:w-[150px] h-[36px] shadow-sm cursor-pointer"
                            >
                                <option value="">All Work Types</option>
                                {workTypes.map(wt => (
                                    <option key={wt.id} value={wt.id}>{wt.name}</option>
                                ))}
                            </select>
                            
                            {(canWrite || isStaff) && (
                                 <button
                                     onClick={() => {
                                         setViewingRowIndex(null);
                                         setModalEditable(true);
                                         setNewTaskData({
                                             form_name: task?.form_name || '',
                                             client_id: task?.client?.id || '',
                                             work_type_id: task?.work_type?.id || '',
                                             allocated_type: 'user',
                                             allocated_to: isStaff ? (user?.id || '') : '',
                                             date_allocated: isStaff ? new Date().toISOString().split('T')[0] : '',
                                             status: task?.status || 'assigned',
                                             sub_status: task?.sub_status || '',
                                             dynamic_data: schema.reduce((acc, f) => {
                                                 let defaultVal = '';
                                                 if (f.value !== undefined && f.value !== null) {
                                                     defaultVal = f.value;
                                                 } else if (f.type === 'checkbox' || f.type === 'labels') {
                                                     defaultVal = [];
                                                 }
                                                 return { ...acc, [f.label]: defaultVal };
                                             }, {})
                                         });
                                         setIsAddTaskModalOpen(true);
                                     }}
                                     className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition rounded-xl shadow-sm h-[36px] whitespace-nowrap border bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                                 >
                                     <Plus size={13} />
                                     <span>Add Task</span>
                                 </button>
                             )}

                            {allFields.length > 0 && (
                                <button
                                    onClick={() => setShowColumnFilters(!showColumnFilters)}
                                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold transition rounded-xl shadow-sm h-[36px] whitespace-nowrap border ${showColumnFilters ? 'bg-[#1F5C99] text-white border-[#1F5C99]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <Sliders size={13} /> 
                                    <span>Column Filters</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dynamic Column Filters Panel */}
                {showColumnFilters && allFields.length > 0 && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-slate-800 tracking-wide flex items-center gap-2">
                                <Sliders size={14} className="text-[#1F5C99]" />
                                Scrollable Column Filters
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
                                <div key={field.key} className="relative min-w-[200px] shrink-0 bg-white p-3 rounded-xl border border-slate-150 shadow-sm hover:border-[#1F5C99]/30 transition">
                                    <Tooltip content={field.label} position="bottom">
                                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 truncate cursor-help">
                                            {field.label}
                                            {field.isStatic && <span className="ml-1.5 text-[8px] font-semibold text-[#1F5C99] bg-[#1F5C99]/5 px-1 py-0.5 rounded">System</span>}
                                        </label>
                                    </Tooltip>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder={`Search ${field.label}...`}
                                            value={dynamicFilters[field.key] || ''}
                                            onChange={e => setDynamicFilters(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className="w-full pl-3 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition font-bold text-slate-700"
                                        />
                                        {dynamicFilters[field.key] && (
                                            <button
                                                onClick={() => setDynamicFilters(prev => {
                                                    const copy = { ...prev };
                                                    delete copy[field.key];
                                                    return copy;
                                                })}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition"
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

                <div className="overflow-x-auto border border-slate-350 rounded-2xl shadow-sm relative min-h-[200px]">
                    {isSearching && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex flex-col items-center justify-center z-40 transition-all duration-200">
                            <Spinner className="w-8 h-8 text-[#1F5C99]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2 animate-pulse">Searching Sheet...</span>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1F5C99] border-b border-[#154673] text-white text-[12px] font-black uppercase tracking-widest">
                                <th className="px-2 py-4 text-center border-r border-[#154673] w-[75px] min-w-[75px] text-white bg-[#1F5C99] sticky left-0 z-30">
                                    <div className="flex items-center justify-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedRowIds.includes(r.row_id || r.id))}
                                            onChange={() => {
                                                const currentPageRowIds = paginatedRows.map(r => r.row_id || r.id).filter(Boolean);
                                                const allSelected = currentPageRowIds.every(id => selectedRowIds.includes(id));
                                                if (allSelected) {
                                                    setSelectedRowIds(prev => prev.filter(id => !currentPageRowIds.includes(id)));
                                                } else {
                                                    setSelectedRowIds(prev => {
                                                        const copy = [...prev];
                                                        currentPageRowIds.forEach(id => {
                                                            if (!copy.includes(id)) copy.push(id);
                                                        });
                                                        return copy;
                                                    });
                                                }
                                            }}
                                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer"
                                        />
                                        <span>#</span>
                                    </div>
                                </th>
                                {activeColumns.map((col, idx) => {
                                    const handleColumnDrop = (targetIdx) => {
                                        if (draggedColumnIndex === null || draggedColumnIndex === targetIdx) return;
                                        const copy = [...activeColumns.map(c => c.id)];
                                        const draggedItem = copy[draggedColumnIndex];
                                        copy.splice(draggedColumnIndex, 1);
                                        copy.splice(targetIdx, 0, draggedItem);
                                        setCustomColumnOrder(copy);
                                        setDraggedColumnIndex(null);
                                        setDragOverColumnIndex(null);
                                        toast.success(`Positioned "${col.label}" column!`);
                                    };
                                    
                                    const isDragging = draggedColumnIndex === idx;
                                    const isDragOver = dragOverColumnIndex === idx;
                                    const isStickyClient = col.id === 'client';
                                    
                                    return (
                                        <th
                                            key={col.id}
                                            draggable
                                            onDragStart={() => setDraggedColumnIndex(idx)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                setDragOverColumnIndex(idx);
                                            }}
                                            onDragEnd={() => {
                                                setDraggedColumnIndex(null);
                                                setDragOverColumnIndex(null);
                                            }}
                                            onDrop={() => handleColumnDrop(idx)}
                                            className={`px-4 py-3 text-left border-r border-[#154673] whitespace-normal break-words select-none cursor-grab active:cursor-grabbing transition-all duration-150 group/th text-white font-bold ${col.minWidth} ${
                                                isDragging ? 'opacity-40 bg-[#154673]/50 scale-95 border-dashed border-2 border-slate-350' : ''
                                            } ${
                                                isDragOver && !isDragging ? 'bg-[#154673] border-l-2 border-blue-400 scale-102 shadow-sm' : ''
                                            } ${
                                                isStickyClient ? 'sticky left-[60px] z-30 bg-[#1F5C99]' : ''
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
                                                        <span className={`font-black transition whitespace-normal break-words ${sortField === col.id ? 'text-white font-extrabold underline decoration-blue-200 decoration-2' : 'text-blue-50'}`}>{col.label}</span>
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
                                <th className="w-[180px] min-w-[180px] px-4 py-4 text-center border-l border-[#154673] sticky right-0 z-20 bg-[#1F5C99] shadow-[-4px_0_8px_rgba(0,0,0,0.05)] text-[12px] font-black">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-350 text-slate-700 text-xs">
                            {sortedRows.length === 0 ? (
                                <tr>
                                    <td 
                                        colSpan={2 + activeColumns.length} 
                                        className="px-10 py-8 text-center text-slate-400 text-xs italic font-bold"
                                    >
                                        No rows match the selected filters. Click "Clear all filters" or select another card to see all items.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRows.map((row, idx) => {
                                    const originalIndex = rows.indexOf(row);
                                    if (originalIndex === -1) return null;

                                    const globalIndex = rowsPerPage === 'All' 
                                        ? idx 
                                        : (safeCurrentPage - 1) * rowsPerPage + idx;

                                    const hasSheetPermissions = Array.isArray(task?.permissions) && task.permissions.length > 0;
                                    const isRowLocked = !isAdmin && (
                                         row.is_verified || 
                                         (!canWrite && (!isStaff || !doesStaffMatchRow(row, user)))
                                     );

                                    const isRowEditable = !isRowLocked && !!editingRows[originalIndex];

                                    return (
                                        <tr key={originalIndex} className={`transition group ${
                                            editingRows[originalIndex] 
                                                ? 'bg-blue-50/40 hover:bg-blue-100/50 border-y-2 border-indigo-250' 
                                                : 'hover:bg-slate-200'
                                        }`}>
                            {/* # column with hover delete */}
                                            <td className="px-2 py-2.5 text-center font-bold text-slate-400 border-r border-b border-slate-350 bg-slate-50 sticky left-0 z-20 w-[75px] min-w-[75px]">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRowIds.includes(row.row_id || row.id)}
                                                        onChange={() => {
                                                            const rid = row.row_id || row.id;
                                                            setSelectedRowIds(prev =>
                                                                prev.includes(rid) ? prev.filter(id => id !== rid) : [...prev, rid]
                                                            );
                                                        }}
                                                        className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition cursor-pointer"
                                                    />
                                                    <span>
                                                        {String(globalIndex + 1).padStart(2, '0')}
                                                    </span>
                                                </div>
                                            </td>

                                            {activeColumns.map(col => {
                                                if (col.id === 'client') {
                                                    const isDuplicate = !!row.client_id && duplicateClientIds.includes(row.client_id);
                                                    const clientObj = clients.find(c => String(c.id) === String(row.client_id));
                                                    return (
                                                        <td key={col.id} className={`px-6 py-4 border-r border-b border-slate-350 min-w-[240px] sticky left-[60px] z-20 bg-white group-hover:bg-slate-200 transition ${isDuplicate ? '!bg-red-50/80 border-red-300' : ''}`}>
                                                            <div className="flex flex-col gap-1">
                                                                {isRowEditable ? (
                                                                    <SearchableSelect
                                                                        value={row.client_id || ''}
                                                                        disabled={!isRowEditable}
                                                                        options={clientOptions}
                                                                        placeholder="Select Client..."
                                                                        onChange={(val) => {
                                                                            const newRows = [...rows];
                                                                            newRows[originalIndex].client_id = val || null;
                                                                            setRows(newRows);
                                                                        }}
                                                                        size="sm"
                                                                        direction={originalIndex > 3 ? 'up' : 'down'}
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center min-h-[38px] px-4 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                        {clientObj ? clientObj.name : '—'}
                                                                    </div>
                                                                )}
                                                                {isDuplicate && (
                                                                    <span className="text-[10px] font-bold text-red-600 animate-pulse mt-0.5">
                                                                        Same client can't be used
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'client_pan') {
                                                    const clientObj = clients.find(c => String(c.id) === String(row.client_id));
                                                    const panNo = clientObj?.pan_no || '—';
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350 font-mono font-bold text-slate-700 min-w-[140px]">
                                                            {panNo}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'work_type') {
                                                    const wtObj = workTypes.find(w => String(w.id) === String(row.work_type_id));
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350 min-w-[240px]">
                                                            {isRowEditable ? (
                                                                <SearchableSelect
                                                                    value={row.work_type_id || ''}
                                                                    disabled={!isRowEditable}
                                                                    options={workTypeOptions}
                                                                    placeholder="Select Work Type..."
                                                                    onChange={(val) => {
                                                                        const newRows = [...rows];
                                                                        newRows[originalIndex].work_type_id = val || null;
                                                                        setRows(newRows);
                                                                    }}
                                                                    size="sm"
                                                                    direction={originalIndex > 3 ? 'up' : 'down'}
                                                                />
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-4 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                    {wtObj ? wtObj.name : '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'assigned_to') {
                                                    const allocType = row.allocated_type || 'user';
                                                    let displayVal = 'Unassigned';
                                                    if (allocType === 'user' && row.allocated_to) {
                                                        const idToFind = typeof row.allocated_to === 'object' ? row.allocated_to.id : row.allocated_to;
                                                        const sMember = staff.find(s => String(s.id) === String(idToFind));
                                                        displayVal = sMember ? sMember.name : 'Unassigned';
                                                    } else if (allocType === 'users' && Array.isArray(row.allocated_to)) {
                                                        const names = row.allocated_to
                                                            .map(id => {
                                                                const idToFind = typeof id === 'object' ? id.id : id;
                                                                return staff.find(s => String(s.id) === String(idToFind))?.name;
                                                            })
                                                            .filter(Boolean);
                                                        displayVal = names.length > 0 ? names.join(', ') : 'Unassigned';
                                                    } else if (allocType === 'role' && row.allocated_to) {
                                                        const idToFind = typeof row.allocated_to === 'object' ? row.allocated_to.id : row.allocated_to;
                                                        const roleObj = availableRoles.find(r => String(r.id) === String(idToFind));
                                                        displayVal = roleObj ? `Dept: ${roleObj.name}` : 'Unassigned';
                                                    }
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350 text-xs font-bold text-slate-700">
                                                            {displayVal}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'date_allocated') {
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350">
                                                            {isRowEditable ? (
                                                                <input
                                                                    type="date"
                                                                    disabled={!isRowEditable}
                                                                    value={row.date_allocated || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const newRows = [...rows];
                                                                        newRows[originalIndex].date_allocated = val;
                                                                        setRows(newRows);
                                                                    }}
                                                                    onFocus={(e) => setFocusedValue(e.target.value)}
                                                                    onBlur={(e) => {
                                                                        // No auto-save on blur
                                                                    }}
                                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-655 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                    {row.date_allocated ? formatDate(row.date_allocated) : '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'status') {
                                                    const statusLabelMap = {
                                                        complete: 'Complete',
                                                        work_in_progress: 'Work In Progress',
                                                        pending: 'Pending',
                                                        assigned: 'Assigned',
                                                        not_to_be_done: 'Not To Be Done',
                                                        other: 'Other'
                                                    };
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350">
                                                            {isRowEditable ? (
                                                                <select
                                                                    disabled={!isRowEditable}
                                                                    value={row.status || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const newRows = [...rows];
                                                                        newRows[originalIndex].status = val;
                                                                        setRows(newRows);
                                                                    }}
                                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer capitalize w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                >
                                                                    <option value="">— Select Status —</option>
                                                                    <option value="assigned">Assigned</option>
                                                                    <option value="complete">Complete</option>
                                                                    <option value="work_in_progress">Work In Progress</option>
                                                                    <option value="pending">Pending</option>
                                                                    <option value="not_to_be_done">Not To Be Done</option>
                                                                    <option value="other">Other</option>
                                                                </select>
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-tight capitalize">
                                                                    {statusLabelMap[row.status] || row.status || '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'sub_status') {
                                                    return (
                                                        <td key={col.id} className="px-6 py-4 border-r border-b border-slate-350">
                                                            {isRowEditable ? (
                                                                <select
                                                                    disabled={!isRowEditable}
                                                                    value={row.sub_status || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const newRows = [...rows];
                                                                        newRows[originalIndex].sub_status = val || null;
                                                                        setRows(newRows);
                                                                    }}
                                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-bold text-slate-655 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                >
                                                                    <option value="">— Set Sub Status —</option>
                                                                    {getSubStatusOptions(task, schema).map((opt, i) => (
                                                                        <option key={i} value={opt}>{opt}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                    {row.sub_status || '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'remarks') {
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5 border-r border-b border-slate-350 min-w-[250px]">
                                                            {isRowEditable ? (
                                                                <BufferedTextarea
                                                                    rows={1}
                                                                    disabled={!isRowEditable}
                                                                    value={row.remarks || ''}
                                                                    onChange={(val) => {
                                                                        const newRows = [...rows];
                                                                        newRows[originalIndex].remarks = val;
                                                                        setRows(newRows);
                                                                    }}
                                                                    placeholder="Enter remarks..."
                                                                    className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-350 focus:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 w-full outline-none transition resize-none overflow-hidden leading-snug break-words whitespace-pre-wrap block disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-snug break-words whitespace-pre-wrap">
                                                                    {row.remarks || '—'}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'attachments') {
                                                    return (
                                                        <td key={col.id} className="px-6 py-5 text-center border-r border-b border-slate-350" style={{ minWidth: '120px', width: '120px' }}>
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setAttachmentsModal({
                                                                            open: true,
                                                                            title: `Attachments for Row ${idx + 1}`,
                                                                            files: row.attachments || [],
                                                                            type: 'row',
                                                                            id: originalIndex,
                                                                            originalIndex: originalIndex
                                                                        });
                                                                        setIncomingPreviewFile(null);
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-655 border border-indigo-100/50 rounded-xl transition shadow-sm cursor-pointer text-[10px] font-bold"
                                                                    title="View/Manage Attachments"
                                                                >
                                                                    <Eye size={12} />
                                                                    <span>{(row.attachments || []).length} Files</span>
                                                                </button>
                                                                {!isRowLocked && allowAttachments && (
                                                                    <label className="inline-flex items-center justify-center p-1.5 bg-slate-50 hover:bg-white border border-slate-200 border-dashed hover:border-slate-350 rounded-xl text-slate-500 hover:text-indigo-655 transition cursor-pointer" title="Upload multiple files">
                                                                        <Plus size={12} />
                                                                        <input
                                                                            type="file"
                                                                            multiple
                                                                            onChange={(e) => handleUploadMultipleRowAttachments(originalIndex, e.target.files)}
                                                                            className="hidden"
                                                                        />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (col.id === 'is_verified') {
                                                    return (
                                                        <td key={col.id} className="px-4 py-2.5 border-r border-b border-slate-350 text-center min-w-[145px]">
                                                            {row.is_verified ? (
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    {isAdmin ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setConfirmState({
                                                                                    open: true,
                                                                                    title: 'Unverify & Unlock Row',
                                                                                    message: 'Are you sure you want to unverify and unlock this sheet row? This will allow the assigned staff member to edit it again.',
                                                                                    confirmLabel: 'Unverify & Unlock',
                                                                                    danger: true,
                                                                                    onConfirm: async () => {
                                                                                        setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                        try {
                                                                                            const newRows = [...rows];
                                                                                            newRows[originalIndex].is_verified = false;
                                                                                            setRows(newRows);
                                                                                            await handleSaveRows(newRows);
                                                                                            toast.success("Row unverified and unlocked successfully!");
                                                                                        } catch (err) {
                                                                                            toast.error("Failed to unverify row");
                                                                                        } finally {
                                                                                            setConfirmState({ open: false });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }}
                                                                            className="px-2.5 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-100 hover:text-rose-800 transition active:scale-95 duration-150 flex items-center gap-1 shadow-sm shrink-0 mx-auto cursor-pointer"
                                                                            title="Click to Unverify and unlock this row"
                                                                        >
                                                                            <Lock size={12} className="text-rose-500 animate-pulse" />
                                                                            Unverify
                                                                        </button>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-extrabold select-none shadow-sm shrink-0 mx-auto" title="Locked by admin">
                                                                            <Lock size={12} className="text-rose-600" />
                                                                            Locked
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-center">
                                                                    {isAdmin ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setConfirmState({
                                                                                    open: true,
                                                                                    title: 'Verify & Lock Row',
                                                                                    message: 'Are you sure you want to verify and lock this sheet row? Once verified, staff members cannot modify its details.',
                                                                                    confirmLabel: 'Verify & Lock',
                                                                                    danger: false,
                                                                                    onConfirm: async () => {
                                                                                        setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                        try {
                                                                                            const newRows = [...rows];
                                                                                            newRows[originalIndex].is_verified = true;
                                                                                            setRows(newRows);
                                                                                            await handleSaveRows(newRows);
                                                                                            toast.success("Row verified and locked successfully!");
                                                                                        } catch (err) {
                                                                                            toast.error("Failed to verify row");
                                                                                        } finally {
                                                                                            setConfirmState({ open: false });
                                                                                        }
                                                                                    }
                                                                                });
                                                                            }}
                                                                            className="px-3 py-1.5 text-xs font-bold bg-green-50 text-green-700 border border-green-200 rounded-xl hover:bg-green-100 hover:text-green-800 transition active:scale-95 duration-150 flex items-center gap-1 shrink-0 mx-auto cursor-pointer"
                                                                            title="Click to Verify and lock this row"
                                                                        >
                                                                            <Unlock size={12} className="text-green-600" />
                                                                            Verify
                                                                        </button>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-extrabold select-none shadow-sm shrink-0 mx-auto border-dashed" title="Unlocked">
                                                                            <Unlock size={12} className="text-green-600" />
                                                                            Unlocked
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                // Dynamic column cell rendering
                                                const field = col.field;
                                                const value = row.dynamic_data?.[field.label] ?? '';
                                                const isDropdown = field.type === 'dropdown';
                                                const isCheckbox = field.type === 'checkbox';
                                                const isDate = field.type === 'date';
                                                const isRating = field.label === 'CA Rating';
                                                const isFeedback = field.label === 'CA Feedback';
                                                const isProgressAuto = field.type === 'progress_auto';
                                                const isProgressManual = field.type === 'progress_manual';
                                                const isTime = field.type === 'time';
                                                const isCurrency = field.type === 'currency';

                                                return (
                                                        <td key={col.id} className="px-4 py-2.5 border-r border-b border-slate-350">
                                                        {isRating ? (
                                                            <div className="flex items-center gap-0.5 text-amber-500 text-base leading-none">
                                                                {Array.from({ length: 5 }).map((_, i) => {
                                                                    const starNum = i + 1;
                                                                    const isFilled = starNum <= parseInt(value || '0');
                                                                    return (
                                                                        <button 
                                                                            key={i} 
                                                                            type="button"
                                                                            disabled={!isRowEditable}
                                                                            onClick={() => {
                                                                                const newRows = [...rows];
                                                                                if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                const currentRating = parseInt(newRows[originalIndex].dynamic_data['CA Rating'] || '0');
                                                                                newRows[originalIndex].dynamic_data['CA Rating'] = currentRating === starNum ? '0' : String(starNum);
                                                                                setRows(newRows);
                                                                            }}
                                                                            className={`transition-all hover:scale-125 ${isFilled ? 'text-amber-500 font-bold' : 'text-slate-200 hover:text-amber-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                                                                            title={`Rate ${starNum} Stars`}
                                                                        >
                                                                            ★
                                                                        </button>
                                                                    );
                                                                })}
                                                                <span className="text-[10px] font-extrabold text-slate-400 ml-1.5 uppercase tracking-wide">({value || '0'}/5)</span>
                                                            </div>
                                                        ) : isFeedback ? (
                                                            <div className="flex items-center gap-2 group/edit-inline w-full">
                                                                {editingFeedbackIndex === originalIndex && isRowEditable ? (
                                                                    <div className="flex items-center gap-2 w-full min-w-[200px]">
                                                                        <input 
                                                                            type="text" 
                                                                            value={inlineFeedbackValue} 
                                                                            onChange={e => setInlineFeedbackValue(e.target.value)}
                                                                            onBlur={() => {
                                                                                setEditingFeedbackIndex(null);
                                                                                const newRows = [...rows];
                                                                                if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                newRows[originalIndex].dynamic_data['CA Feedback'] = inlineFeedbackValue;
                                                                                setRows(newRows);
                                                                            }}
                                                                            onKeyDown={e => {
                                                                                if (e.key === 'Enter') {
                                                                                    setEditingFeedbackIndex(null);
                                                                                    const newRows = [...rows];
                                                                                    if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                    newRows[originalIndex].dynamic_data['CA Feedback'] = inlineFeedbackValue;
                                                                                    setRows(newRows);
                                                                                }
                                                                            }}
                                                                            autoFocus
                                                                            className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 w-full focus:bg-white focus:border-indigo-500 outline-none transition"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div 
                                                                        onClick={() => {
                                                                            if (!isRowEditable) return;
                                                                            setInlineFeedbackValue(value || '');
                                                                            setEditingFeedbackIndex(originalIndex);
                                                                        }}
                                                                        className={`cursor-pointer hover:bg-slate-50 px-2 py-1 -ml-2 rounded-lg transition-all flex items-center gap-2 text-slate-700 min-h-[28px] group min-w-[150px] ${!isRowEditable ? 'pointer-events-none opacity-80' : ''}`}
                                                                        title={isRowEditable ? "Click to Edit Feedback" : ""}
                                                                    >
                                                                        <span>{value || <span className="text-slate-300 italic font-medium">{isRowEditable ? 'Click to add feedback...' : 'No feedback'}</span>}</span>
                                                                        {isRowEditable && <Edit2 size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100" />}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : isProgressAuto ? (
                                                            <div className="flex flex-col gap-1.5 w-full min-w-[220px] select-none p-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                                {(() => {
                                                                    const totalSub = task.sub_tasks?.length || 0;
                                                                    const completeSub = task.sub_tasks?.filter(st => st.status === 'complete').length || 0;
                                                                    const pct = totalSub > 0 ? Math.round((completeSub / totalSub) * 100) : 0;

                                                                    let gradient = 'from-rose-500 to-amber-500';
                                                                    let badgeBg = 'bg-rose-50 border-rose-100 text-rose-600';
                                                                    if (pct >= 40 && pct < 90) {
                                                                        gradient = 'from-blue-500 to-indigo-600';
                                                                        badgeBg = 'bg-indigo-50 border-indigo-100 text-indigo-655';
                                                                    } else if (pct >= 90) {
                                                                        gradient = 'from-emerald-500 to-teal-500';
                                                                        badgeBg = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                                                                    }

                                                                    const timeText = (() => {
                                                                        if (!task.created_at) return 'Sync: Just now';
                                                                        const diffMs = new Date() - new Date(task.created_at);
                                                                        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
                                                                        const diffDays = Math.floor(diffHrs / 24);
                                                                        if (diffHrs < 1) return 'Sync: Just now';
                                                                        if (diffHrs < 24) return `Active ${diffHrs}h ago`;
                                                                        return `Active ${diffDays}d ago`;
                                                                    })();

                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                    AUTO CALCULATED
                                                                                </span>
                                                                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-tighter border shadow-sm ${badgeBg}`}>
                                                                                    {pct}%
                                                                                </span>
                                                                            </div>
                                                                            
                                                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden relative shadow-inner border border-slate-200/20">
                                                                                <div 
                                                                                    className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out shadow-sm relative`}
                                                                                    style={{ width: `${pct}%` }}
                                                                                >
                                                                                    {pct > 0 && pct < 100 && (
                                                                                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.25)_50%,transparent_100%)] animate-[shimmer_1.8s_infinite] w-full h-full" />
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-0.5 select-none">
                                                                                <span className="flex items-center gap-0.5 font-extrabold text-slate-400">
                                                                                    <Clock size={9} className="text-slate-350" />
                                                                                    {timeText}
                                                                                </span>
                                                                                <span className="text-[9px] font-extrabold text-indigo-650 bg-indigo-50 border border-indigo-100/30 px-1.5 py-0.5 rounded-md">
                                                                                    {completeSub}/{totalSub} Completed
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : isProgressManual ? (
                                                            <div className="flex flex-col gap-1.5 w-full min-w-[220px] p-2 rounded-2xl bg-white border border-slate-100 shadow-sm">
                                                                {(() => {
                                                                    const parsedVal = Math.min(100, Math.max(0, parseInt(value) || 0));

                                                                    let badgeBg = 'bg-rose-50 border-rose-100 text-rose-600';
                                                                    if (parsedVal >= 40 && parsedVal < 90) {
                                                                        badgeBg = 'bg-teal-50 border-teal-100 text-teal-700';
                                                                    } else if (parsedVal >= 90) {
                                                                        badgeBg = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                                                                    }

                                                                    return (
                                                                        <>
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                    PROGRESS
                                                                                </span>
                                                                                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-tighter border shadow-sm ${badgeBg}`}>
                                                                                    {parsedVal}%
                                                                                </span>
                                                                            </div>

                                                                            <div className="relative flex items-center group/slider mt-1">
                                                                                <input 
                                                                                    type="range" 
                                                                                    min="0" 
                                                                                    max="100" 
                                                                                    value={parsedVal}
                                                                                    disabled={!isRowEditable}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        const newRows = [...rows];
                                                                                        if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                        newRows[originalIndex].dynamic_data[field.label] = String(val);
                                                                                        setRows(newRows);
                                                                                    }}
                                                                                    className="w-full h-3 rounded-full appearance-none cursor-pointer focus:outline-none transition-all outline-none shadow-inner border border-slate-200/20 disabled:cursor-not-allowed disabled:opacity-60"
                                                                                    style={{
                                                                                        background: `linear-gradient(to right, ${parsedVal < 40 ? '#f43f5e, #f59e0b' : parsedVal < 90 ? '#3b82f6, #4f46e5' : '#10b981, #14b8a6'} ${parsedVal}%, #f1f5f9 ${parsedVal}%)`
                                                                                    }}
                                                                                />
                                                                            </div>

                                                                            {/* Quick adjust pills */}
                                                                            {isRowEditable && (
                                                                                <div className="flex gap-1 mt-1 justify-between select-none animate-in fade-in duration-200">
                                                                                    {[-10, 10, 50, 100].map(adjust => {
                                                                                        let pillLabel = adjust > 0 ? `+${adjust}%` : `${adjust}%`;
                                                                                        if (adjust === 50) pillLabel = "50%";
                                                                                        if (adjust === 100) pillLabel = "100%";
                                                                                        
                                                                                        return (
                                                                                            <button
                                                                                                key={adjust}
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    let nextVal = parsedVal;
                                                                                                    if (adjust === -10 || adjust === 10) {
                                                                                                        nextVal = Math.min(100, Math.max(0, parsedVal + adjust));
                                                                                                    } else {
                                                                                                        nextVal = adjust;
                                                                                                    }
                                                                                                    const newRows = [...rows];
                                                                                                    if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                                    newRows[originalIndex].dynamic_data[field.label] = String(nextVal);
                                                                                                    setRows(newRows);
                                                                                                }}
                                                                                                className="text-[8px] font-black tracking-widest uppercase bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-350 text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded-md transition duration-150 active:scale-90"
                                                                                            >
                                                                                                {pillLabel}
                                                                                            </button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}

                                                                            <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1 select-none">
                                                                                <span className="flex items-center gap-0.5 font-extrabold text-slate-400">
                                                                                    <Clock size={9} className="text-slate-350" />
                                                                                    Updated: Just now
                                                                                </span>
                                                                                {isRowEditable && (
                                                                                    <span className="text-[8px] font-black uppercase text-indigo-500/80 tracking-wider">
                                                                                        Adjustable
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : isDropdown ? (
                                                            <select
                                                                value={value || ''}
                                                                disabled={!isRowEditable}
                                                                onChange={(e) => {
                                                                    const newRows = [...rows];
                                                                    if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                    newRows[originalIndex].dynamic_data[field.label] = e.target.value;
                                                                    setRows(newRows);
                                                                }}
                                                                className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg pl-2.5 pr-8 py-1.5 text-xs font-bold text-slate-655 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-full disabled:opacity-60 disabled:cursor-not-allowed"
                                                            >
                                                                <option value="">Select Option</option>
                                                                {(() => {
                                                                    const seen = new Set();
                                                                    return (field.options || []).filter(opt => opt !== null && opt !== undefined).filter(opt => {
                                                                        const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                                        if (seen.has(optVal)) return false;
                                                                        seen.add(optVal);
                                                                        return true;
                                                                    }).map((opt, i) => {
                                                                        const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                                        const optLbl = typeof opt === 'object' ? opt.label : opt;
                                                                        return (
                                                                            <option key={typeof opt === 'object' ? (opt.value || opt.label || i) : opt} value={optVal}>
                                                                                {optLbl}
                                                                            </option>
                                                                        );
                                                                    });
                                                                })()}
                                                            </select>
                                                        ) : isCheckbox ? (
                                                            <div className="flex flex-col gap-2 min-w-[200px]">
                                                                {editingCheckboxes[`${originalIndex}-${field.label}`] && isRowEditable ? (
                                                                    <>
                                                                        <div className="flex flex-wrap gap-2.5">
                                                                            {(() => {
                                                                                const seen = new Set();
                                                                                return (field.options || []).filter(opt => opt !== null && opt !== undefined).filter(opt => {
                                                                                    const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                                                    if (seen.has(optVal)) return false;
                                                                                    seen.add(optVal);
                                                                                    return true;
                                                                                }).map((opt, idx) => {
                                                                                    const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
                                                                                    const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                                                    const optLbl = typeof opt === 'object' ? opt.label : opt;
                                                                                    const isChecked = selectedValues.includes(optVal);
                                                                                    return (
                                                                                        <label key={typeof opt === 'object' ? (opt.value || opt.label || idx) : opt} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-650">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={isChecked}
                                                                                                onChange={(e) => {
                                                                                                    let nextVals;
                                                                                                    if (e.target.checked) {
                                                                                                        nextVals = Array.from(new Set([...selectedValues, optVal]));
                                                                                                    } else {
                                                                                                        nextVals = selectedValues.filter(v => v !== optVal);
                                                                                                    }
                                                                                                    const newRows = [...rows];
                                                                                                    if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                                                    newRows[originalIndex].dynamic_data[field.label] = nextVals;
                                                                                                    setRows(newRows);
                                                                                                }}
                                                                                                className="w-3.5 h-3.5 rounded text-indigo-655 focus:ring-indigo-500/20 border-slate-300 cursor-pointer"
                                                                                            />
                                                                                            <span>{optLbl}</span>
                                                                                        </label>
                                                                                    );
                                                                                });
                                                                            })()}
                                                                        </div>
                                                                        <div className="flex justify-end mt-1">
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setEditingCheckboxes(prev => ({ ...prev, [`${originalIndex}-${field.label}`]: false }));
                                                                                }}
                                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                                                            >
                                                                                Submit
                                                                            </button>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <div 
                                                                        className={`flex flex-col gap-1.5 ${isRowEditable ? 'cursor-pointer group/chk' : 'opacity-80'}`}
                                                                        onClick={() => {
                                                                            if (!isRowEditable) return;
                                                                            setEditingCheckboxes(prev => ({ ...prev, [`${originalIndex}-${field.label}`]: true }));
                                                                        }}
                                                                    >
                                                                        {(!value || (Array.isArray(value) && value.length === 0)) ? (
                                                                            <span className="text-xs text-slate-400 italic">No options selected</span>
                                                                        ) : (
                                                                            <div className="flex flex-wrap gap-1.5">
                                                                                {(Array.isArray(value) ? value : [value]).map((val, idx) => {
                                                                                    const matchedOpt = (field.options || []).filter(opt => opt !== null && opt !== undefined).find(opt => {
                                                                                        const oVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                                                        return oVal === val;
                                                                                    });
                                                                                    const displayLbl = matchedOpt ? (typeof matchedOpt === 'object' ? matchedOpt.label : matchedOpt) : val;
                                                                                    return (
                                                                                        <span key={idx} className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-indigo-100 shadow-sm">
                                                                                            <Check size={10} className="text-indigo-500"/>
                                                                                            {displayLbl}
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                        {isRowEditable && (
                                                                            <div className="opacity-0 group-hover/chk:opacity-100 transition-opacity mt-0.5 animate-in fade-in duration-150">
                                                                                <button className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 bg-white border border-indigo-100 px-2 py-0.5 rounded shadow-sm hover:bg-indigo-50 w-fit">
                                                                                    <Edit2 size={10}/> Edit
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : isDate ? (
                                                            isRowEditable ? (
                                                                <input
                                                                    type="date"
                                                                    value={value || ''}
                                                                    disabled={!isRowEditable}
                                                                    onChange={(e) => {
                                                                        const newRows = [...rows];
                                                                        if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                        newRows[originalIndex].dynamic_data[field.label] = e.target.value;
                                                                        setRows(newRows);
                                                                    }}
                                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                    {value ? formatDate(value) : '—'}
                                                                </div>
                                                            )
                                                        ) : isTime ? (
                                                            isRowEditable ? (
                                                                <TimePicker12Hour
                                                                    value={convertTo24Hour(value || '')}
                                                                    disabled={!isRowEditable}
                                                                    onChange={(val) => {
                                                                        const newRows = [...rows];
                                                                        if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                        newRows[originalIndex].dynamic_data[field.label] = convertTo12Hour(val);
                                                                        setRows(newRows);
                                                                    }}
                                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-655 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                />
                                                            ) : (
                                                                <div className="flex items-center min-h-[38px] px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-tight">
                                                                    {value || '—'}
                                                                </div>
                                                            )
                                                        ) : isCurrency ? (
                                                            renderCurrencyCell(row, originalIndex, field, isRowEditable)
                                                        ) : (
                                                            isRowEditable ? (
                                                                <div className="flex items-center justify-between group/cell w-full">
                                                                    <BufferedTextarea
                                                                         rows={1}
                                                                         value={value || ''}
                                                                         disabled={!isRowEditable}
                                                                         onChange={(val) => {
                                                                             const newRows = [...rows];
                                                                             if (!newRows[originalIndex].dynamic_data) newRows[originalIndex].dynamic_data = {};
                                                                             newRows[originalIndex].dynamic_data[field.label] = val;
                                                                             setRows(newRows);
                                                                         }}
                                                                        placeholder={field.placeholder || `Enter ${field.label}...`}
                                                                        className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-slate-350 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 w-full min-w-full outline-none transition resize-none overflow-hidden leading-snug break-words whitespace-pre-wrap block disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                                                        style={{ minHeight: '34px' }}
                                                                    />
                                                                    {value && (
                                                                        <button
                                                                            onClick={() => handleCopy(Array.isArray(value) ? value.join(', ') : value.toString())}
                                                                            className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/cell:opacity-100 transition shadow-sm ml-1"
                                                                            title="Copy"
                                                                        >
                                                                            <Copy size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-between group/cell w-full min-h-[38px]">
                                                                    <div className="px-2.5 py-1.5 text-slate-900 font-semibold text-xs leading-snug break-words whitespace-pre-wrap">
                                                                        {value || '—'}
                                                                    </div>
                                                                    {value && (
                                                                        <button
                                                                            onClick={() => handleCopy(Array.isArray(value) ? value.join(', ') : value.toString())}
                                                                            className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/cell:opacity-100 transition shadow-sm ml-1"
                                                                            title="Copy"
                                                                        >
                                                                            <Copy size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className={`px-4 py-2 text-center border-l border-b border-slate-350 sticky right-0 z-10 shadow-[-4px_0_8px_rgba(0,0,0,0.05)] transition-colors min-w-[180px] w-[180px] ${
                                                editingRows[originalIndex] 
                                                    ? 'bg-[#F0F7FF] group-hover:bg-[#E0EFFF]' 
                                                    : 'bg-white group-hover:bg-slate-200'
                                            }`}>
                                                <div className="flex items-center justify-center gap-1.5">
                                                    {/* View button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNewTaskData({ ...row });
                                                            setViewingRowIndex(originalIndex);
                                                            setModalEditable(false);
                                                            setIsAddTaskModalOpen(true);
                                                        }}
                                                        className="p-1.5 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl transition duration-150 active:scale-90 cursor-pointer"
                                                        title="View Row Details"
                                                    >
                                                        <Eye size={14} />
                                                    </button>

                                                    {/* Assign button */}
                                                    {!row.is_verified && (isAdmin || isStaff) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAssigningRowIndex(originalIndex);
                                                                setAssigningType(row.allocated_type || 'user');
                                                                setAssigningTo(row.allocated_to || (row.allocated_type === 'users' ? [] : ''));
                                                            }}
                                                            className="p-1.5 bg-blue-50/50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl transition duration-150 active:scale-90 cursor-pointer"
                                                            title="Assign Row to Staff"
                                                        >
                                                            <UserPlus size={14} />
                                                        </button>
                                                    )}

                                                    {/* Edit / Submit toggle button */}
                                                    {!isRowLocked && (
                                                        editingRows[originalIndex] ? (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const row = rows[originalIndex];
                                                                    if (!row.form_name) {
                                                                        toast.error(`Please enter a Sheet Name for Row ${originalIndex + 1}`);
                                                                        return;
                                                                    }
                                                                    if (!row.work_type_id) {
                                                                        toast.error(`Please select a Work Type for Row ${originalIndex + 1}`);
                                                                        return;
                                                                    }
                                                                    for (const field of schema) {
                                                                        if (field.static) continue;
                                                                        if (field.required) {
                                                                            const val = row.dynamic_data?.[field.label];
                                                                            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                                                                                toast.error(`Please fill out required field "${field.label}" for Row ${originalIndex + 1}`);
                                                                                return;
                                                                            }
                                                                        }
                                                                    }
                                                                    setEditingRows(prev => {
                                                                        const copy = { ...prev };
                                                                        delete copy[originalIndex];
                                                                        return copy;
                                                                    });
                                                                    await handleSaveRows(rows, 'Row updated successfully');
                                                                }}
                                                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-xl transition duration-150 active:scale-90 cursor-pointer animate-pulse"
                                                                title="Submit Changes"
                                                            >
                                                                <Check size={14} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingRows(prev => ({ ...prev, [originalIndex]: true }));
                                                                }}
                                                                className="p-1.5 bg-blue-50/50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl transition duration-150 active:scale-90 cursor-pointer"
                                                                title="Edit Inline"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        )
                                                    )}

                                                    {/* Duplicate button */}
                                                    {canWrite && (
                                                        <button
                                                            type="button"
                                                            onClick={() => duplicateRow(originalIndex)}
                                                            className="p-1.5 bg-emerald-50/40 hover:bg-emerald-100/60 text-emerald-650 border border-emerald-100 rounded-xl transition duration-150 active:scale-90 cursor-pointer"
                                                            title="Duplicate Row"
                                                        >
                                                            <Copy size={14} />
                                                        </button>
                                                    )}

                                                    {/* Delete button */}
                                                    {!isRowLocked && canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeRow(originalIndex)}
                                                            className="p-1.5 bg-rose-50/50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition duration-150 active:scale-90 cursor-pointer"
                                                            title="Delete Row"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>                   </td>
                                        </tr>
                                    );
                                })
                            )}
                            {(canWrite || isStaff) && (
                                <tr className="hover:bg-slate-200 transition-colors">
                                    <td 
                                        colSpan={2 + activeColumns.length} 
                                        className="px-10 py-4"
                                    >
                                        <button
                                            type="button"
                                            onClick={addRow}
                                            className="flex items-center gap-2 text-slate-800 hover:text-indigo-600 text-sm font-bold transition-colors bg-transparent border-none cursor-pointer outline-none"
                                        >
                                            <Plus size={16} /> Add Row
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Premium Styled Pagination Controls */}
                {totalRows > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-100 px-2 mt-4 select-none">
                        <div className="text-xs font-semibold text-slate-500">
                            Showing <span className="font-extrabold text-slate-800">{rowsPerPage === 'All' ? 1 : Math.min((safeCurrentPage - 1) * rowsPerPage + 1, totalRows)}</span> to <span className="font-extrabold text-slate-800">{rowsPerPage === 'All' ? totalRows : Math.min(safeCurrentPage * rowsPerPage, totalRows)}</span> of <span className="font-extrabold text-slate-800">{totalRows}</span> records
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Rows per page:</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 transition focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {rowsPerPage !== 'All' && totalPages > 1 && (
                                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/60 shadow-sm">
                                    <button
                                        type="button"
                                        disabled={safeCurrentPage === 1}
                                        onClick={() => setCurrentPage(1)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none transition cursor-pointer disabled:cursor-not-allowed flex items-center"
                                        title="First Page"
                                    >
                                        <ChevronLeft size={14} className="stroke-[2.5]" />
                                        <ChevronLeft size={14} className="-ml-2 inline stroke-[2.5]" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={safeCurrentPage === 1}
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none transition cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-extrabold"
                                    >
                                        <ChevronLeft size={14} className="stroke-[2.5]" />
                                        <span>Prev</span>
                                    </button>

                                    <div className="flex items-center px-2 text-xs font-extrabold text-slate-700">
                                        Page <span className="mx-1 text-indigo-600 font-black">{safeCurrentPage}</span> of <span className="ml-1 text-slate-500">{totalPages}</span>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={safeCurrentPage === totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none transition cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-extrabold"
                                    >
                                        <span>Next</span>
                                        <ChevronRight size={14} className="stroke-[2.5]" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={safeCurrentPage === totalPages}
                                        onClick={() => setCurrentPage(totalPages)}
                                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 disabled:hover:shadow-none transition cursor-pointer disabled:cursor-not-allowed flex items-center"
                                        title="Last Page"
                                    >
                                        <ChevronRight size={14} className="inline stroke-[2.5]" />
                                        <ChevronRight size={14} className="-ml-2 inline stroke-[2.5]" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Tasks Section */}
            {task?.allow_checklist && (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden mt-6 animate-fade-in">
                    <div className="px-6 py-5 md:px-8 md:py-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10 shrink-0">
                            <CheckSquare size={16} />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Tasks Checklist</h2>
                                <div className="flex items-center gap-1.5 bg-indigo-50/50 border border-indigo-100/60 px-2 py-0.5 rounded-full">
                                    <div className="w-12 h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-500"
                                            style={{ width: `${(task.sub_tasks?.filter(st => st.status === 'complete').length / (task.sub_tasks?.length || 1)) * 100}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-[9px] font-extrabold text-indigo-655 uppercase tracking-wider">
                                        {task.sub_tasks?.filter(st => st.status === 'complete').length}/{task.sub_tasks?.length || 0} Complete
                                    </span>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">Manage checklist tasks and progress tracking</p>
                        </div>
                    </div>
                    {selectedTaskIds.length > 0 && !isStaff && (
                        <button
                            type="button"
                            onClick={handleDeleteMultipleSubTasks}
                            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md shadow-rose-100/50 hover:shadow-lg transition-all active:scale-95 duration-200 cursor-pointer shrink-0"
                        >
                            <Trash2 size={13} />
                            Delete Selected ({selectedTaskIds.length})
                        </button>
                    )}
                </div>
                <div className="px-6 pb-6 md:px-8 md:pb-8">
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                        <table className="w-full border-collapse" style={{ minWidth: '1700px' }}>
                            <thead>
                                <tr className="bg-[#1F5C99] border-b border-[#154673] text-white text-[10px] font-black uppercase tracking-widest">
                                    <th className="px-2 py-4 text-center" style={{ minWidth: '48px', width: '48px' }}>
                                        <input
                                            type="checkbox"
                                            checked={filteredSubTasks.length > 0 && filteredSubTasks.every(st => selectedTaskIds.includes(st.id))}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedTaskIds([...new Set([...selectedTaskIds, ...filteredSubTasks.map(st => st.id)])]);
                                                } else {
                                                    const ids = filteredSubTasks.map(st => st.id);
                                                    setSelectedTaskIds(prev => prev.filter(id => !ids.includes(id)));
                                                }
                                            }}
                                            className="w-4 h-4 rounded cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap" style={{ minWidth: '280px', width: '280px' }}>Task Name</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '180px', width: '180px' }}>Assignee</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '180px', width: '180px' }}>Status</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '220px', width: '220px' }}>Sub Status</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '145px', width: '145px' }}>Due Date</th>
                                    <th className="px-6 py-4 text-left whitespace-nowrap" style={{ minWidth: '260px', width: '260px' }}>Remarks</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '180px', width: '180px' }}>Attachments</th>
                                    <th className="px-6 py-4 text-center whitespace-nowrap" style={{ minWidth: '145px', width: '145px' }}>Verification</th>
                                    <th className="px-6 py-4 text-center" style={{ minWidth: '40px', width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredSubTasks.length > 0 ? (
                                    filteredSubTasks.map((st) => {
                                        const isLocked = !isAdmin && st.is_verified;
                                        return (
                                            <tr key={st.id} className={`group hover:bg-slate-200 transition-colors ${selectedTaskIds.includes(st.id) ? 'bg-indigo-50/20' : ''}`}>
                                                <td key="chk" className="px-2 py-4 text-center border-r border-slate-100" style={{ minWidth: '48px', width: '48px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTaskIds.includes(st.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedTaskIds(prev => [...prev, st.id]);
                                                            else setSelectedTaskIds(prev => prev.filter(id => id !== st.id));
                                                        }}
                                                        className="w-4 h-4 rounded cursor-pointer"
                                                    />
                                                </td>
                                                <td key="name" className="px-6 py-4 border-r border-slate-100" style={{ minWidth: '280px', width: '280px' }}>
                                                    <div className="flex items-center gap-2.5">
                                                        <button
                                                            disabled={isLocked}
                                                            onClick={() => handleUpdateSubTask(st.id, { status: st.status === 'complete' ? 'work_in_progress' : 'complete' })}
                                                            className={`shrink-0 transition-colors ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${st.status === 'complete' ? 'text-green-500' : 'text-slate-300 hover:text-slate-500'}`}
                                                        >
                                                            {st.status === 'complete' ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                                                        </button>
                                                        <div className="flex-1 flex items-center gap-1 min-w-0">
                                                            <input
                                                                disabled={isLocked}
                                                                defaultValue={st.title}
                                                                onBlur={e => handleUpdateSubTask(st.id, { title: e.target.value })}
                                                                className={`bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 w-full truncate outline-none ${st.status === 'complete' ? 'line-through text-slate-400' : ''} ${isLocked ? 'cursor-not-allowed opacity-75' : ''}`}
                                                            />
                                                            <button onClick={() => handleCopy(st.title)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shrink-0" title="Copy"><Copy size={11} /></button>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td key="assignee" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '180px', width: '180px' }}>
                                                    <select
                                                        disabled={isLocked}
                                                        value={st.assigned_to?.id || ''}
                                                        onChange={e => handleUpdateSubTask(st.id, { assigned_to: e.target.value })}
                                                        className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-bold text-slate-700 transition focus:outline-none cursor-pointer w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                </td>
                                                <td key="status" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '180px', width: '180px' }}>
                                                    <select
                                                        disabled={isLocked}
                                                        value={st.status}
                                                        onChange={e => handleUpdateSubTask(st.id, { status: e.target.value })}
                                                        className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-bold text-slate-700 transition focus:outline-none cursor-pointer capitalize w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                                    >
                                                        <option value="complete">Complete</option>
                                                        <option value="work_in_progress">Work In Progress</option>
                                                        <option value="pending">Pending</option>
                                                        <option value="not_to_be_done">Not To Be Done</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                </td>
                                                <td key="substatus" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '220px', width: '220px' }}>
                                                    <select
                                                        disabled={isLocked}
                                                        value={st.sub_status || ''}
                                                        onChange={e => handleUpdateSubTask(st.id, { sub_status: e.target.value || null })}
                                                        className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg pl-2.5 pr-6 py-1.5 text-xs font-bold text-slate-700 transition focus:outline-none cursor-pointer w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                                    >
                                                        <option value="">— Sub Status —</option>
                                                        {getSubStatusOptions(task, schema).map((opt, i) => (
                                                            <option key={i} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td key="duedate" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '145px', width: '145px' }}>
                                                    <input
                                                        disabled={isLocked}
                                                        type="date"
                                                        defaultValue={st.due_date}
                                                        onBlur={e => handleUpdateSubTask(st.id, { due_date: e.target.value })}
                                                        className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 transition focus:outline-none w-full disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                                    />
                                                </td>
                                                <td key="remarks" className="px-6 py-4 border-r border-slate-100" style={{ minWidth: '260px', width: '260px' }}>
                                                    <div className="flex items-center gap-1 group/rem w-full">
                                                        <textarea
                                                            disabled={isLocked}
                                                            defaultValue={st.remarks}
                                                            onBlur={e => handleUpdateSubTask(st.id, { remarks: e.target.value })}
                                                            placeholder="Remarks..."
                                                            rows="1"
                                                            className={`bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 w-full resize-y min-h-[36px] outline-none transition leading-relaxed disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed`}
                                                        />
                                                        {st.remarks && (
                                                            <button onClick={() => handleCopy(st.remarks)} className="ml-1 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/rem:opacity-100 transition shrink-0" title="Copy"><Copy size={11} /></button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td key="attachments" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '180px', width: '180px' }}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAttachmentsModal({
                                                                    open: true,
                                                                    title: `Attachments: ${st.title}`,
                                                                    files: st.attachments || [],
                                                                    type: 'subtask',
                                                                    id: st.id,
                                                                    originalIndex: null
                                                                });
                                                                setIncomingPreviewFile(null);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition text-[11px] font-bold cursor-pointer"
                                                            title="View/Manage Attachments"
                                                        >
                                                            <Eye size={13} />
                                                            <span>{(st.attachments || []).length} Files</span>
                                                        </button>
                                                        {!isLocked && (
                                                            <label className="inline-flex items-center justify-center p-1.5 bg-slate-50 hover:bg-white border border-dashed border-slate-300 hover:border-indigo-400 rounded-lg text-slate-500 hover:text-indigo-600 transition cursor-pointer" title="Upload files">
                                                                <Plus size={13} />
                                                                <input
                                                                    type="file"
                                                                    multiple
                                                                    onChange={(e) => handleUploadMultipleSubTaskAttachments(st.id, e.target.files)}
                                                                    className="hidden"
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </td>
                                                <td key="verify" className="px-6 py-4 border-r border-slate-100 text-center" style={{ minWidth: '145px', width: '145px' }}>
                                                    {st.is_verified ? (
                                                        <div className="flex items-center justify-center">
                                                            {isAdmin ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmState({
                                                                            open: true,
                                                                            title: 'Unverify & Unlock Task',
                                                                            message: 'Are you sure you want to unverify and unlock this task?',
                                                                            confirmLabel: 'Unverify & Unlock',
                                                                            danger: true,
                                                                            onConfirm: async () => {
                                                                                setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                try { await handleUpdateSubTask(st.id, { is_verified: false }); toast.success("Task unverified!"); }
                                                                                catch { toast.error("Failed to unverify"); }
                                                                                finally { setConfirmState({ open: false }); }
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="px-2.5 py-1.5 text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Lock size={11} className="animate-pulse" /> Unverify
                                                                </button>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-extrabold select-none">
                                                                    <Lock size={11} /> Locked
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center">
                                                            {st.status === 'complete' ? (
                                                                <button
                                                                    onClick={() => {
                                                                        setConfirmState({
                                                                            open: true,
                                                                            title: 'Verify & Lock Task',
                                                                            message: 'Are you sure you want to verify and lock this task?',
                                                                            confirmLabel: 'Verify & Lock',
                                                                            danger: false,
                                                                            onConfirm: async () => {
                                                                                setConfirmState(prev => ({ ...prev, loading: true }));
                                                                                try { await handleUpdateSubTask(st.id, { is_verified: true }); toast.success("Task verified!"); }
                                                                                catch { toast.error("Failed to verify"); }
                                                                                finally { setConfirmState({ open: false }); }
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="px-3 py-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <Unlock size={11} /> Verify
                                                                </button>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-[11px] font-bold select-none">
                                                                    <Unlock size={11} /> Unlocked
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td key="del" className="px-4 py-4 text-center" style={{ minWidth: '40px', width: '40px' }}>
                                                    {isLocked ? (
                                                        <Lock size={13} className="text-rose-500 mx-auto" />
                                                    ) : isStaff ? null : (
                                                        <button onClick={() => handleDeleteSubTask(st.id)} className="p-1.5 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 opacity-0 group-hover:opacity-100 rounded-lg transition cursor-pointer">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="px-10 py-16 text-center text-slate-400 text-xs italic font-bold">
                                            No tasks found. Click "+ Add Task" below to get started.
                                        </td>
                                    </tr>
                                )}
                                <tr className="hover:bg-slate-200 transition-colors">
                                    <td colSpan={10} className="px-8 py-4">
                                        <button
                                            onClick={handleAddSubTask}
                                            className="flex items-center gap-2 text-slate-700 hover:text-indigo-600 text-sm font-bold transition-colors cursor-pointer"
                                        >
                                            <Plus size={15} /> Add Task
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            {/* Sheet Notes Section */}
            {task?.allow_notes && (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden mt-6 animate-fade-in">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-[#1F5C99] to-[#154673] text-white shadow-md shadow-[#1F5C99]/10">
                                <FileText size={16} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Sheet Notes</h2>
                                <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">Collaborative notes for this task sheet</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-6">
                        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto pr-1">
                            {notesList.map((note, idx) => (
                                <div key={note.id} className="flex flex-col md:flex-row md:items-start gap-4 py-4 first:pt-0 last:pb-0">
                                    {/* Date/Time badge */}
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-gray-50 px-2.5 py-1.5 rounded-xl select-none w-fit">
                                        <Calendar size={13} className="text-[#1F5C99]" />
                                        <span>{note.timestamp}</span>
                                    </div>

                                    {/* Auto-growing Textarea to wrap text naturally */}
                                    <textarea
                                        value={note.text}
                                        onChange={e => {
                                            handleUpdateNoteText(note.id, e.target.value);
                                            e.target.style.height = 'auto';
                                            e.target.style.height = e.target.scrollHeight + 'px';
                                        }}
                                        placeholder="Write your observation/note here... (Saved automatically)"
                                        rows={1}
                                        className="flex-1 bg-gray-50 border border-slate-200 focus:border-[#1F5C99] outline-none focus:ring-2 focus:ring-[#1F5C99]/15 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-slate-450 font-semibold resize-none h-auto min-h-[38px] transition"
                                        style={{ height: 'auto' }}
                                        ref={el => {
                                            if (el) {
                                                el.style.height = 'auto';
                                                el.style.height = el.scrollHeight + 'px';
                                            }
                                        }}
                                    />
                                    
                                    {/* Always visible action buttons */}
                                    <div className="flex items-center gap-2 select-none self-end md:self-start">
                                        {idx === notesList.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleAddNoteAfter(note.id)}
                                                className="p-2 text-white bg-[#1F5C99] hover:bg-[#154673] rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center"
                                                title="Add Note Row"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteNote(note.id)}
                                            className="p-2 text-rose-600 bg-rose-50 border border-rose-100/40 hover:bg-rose-100 rounded-xl transition cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95 shadow-sm"
                                            title="Delete Note"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Unified Management Sidebar */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden">
                    <div className="absolute inset-0 bg-slate-900/5 transition-opacity" onClick={() => { setIsSidebarOpen(false); setActiveFieldId(null); }} />

                    <div className="relative w-80 bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
                        {sidebarMode === 'fields' ? (
                            <>
                                <div className="p-6 border-b border-slate-100">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                            Available Fields
                                        </h3>
                                        <button onClick={() => { setIsSidebarOpen(false); setDraftField(null); }} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"><X size={20} /></button>
                                    </div>
                                    <div className="relative group">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="text" placeholder="Search field types..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-indigo-500 outline-none transition-all font-medium" />
                                    </div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
                                    <div className="space-y-2">
                                        <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Types</h4>
                                        <div className="space-y-1">
                                            {FIELD_TYPES.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map((type) => {
                                                const Icon = IconMap[type.icon] || Type;
                                                return (
                                                    <div
                                                        key={type.id}
                                                        onClick={() => startAddingField(type)}
                                                        className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 cursor-pointer"
                                                    >
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${type.color}15`, color: type.color }}><Icon size={20} /></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 truncate">{type.name}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{type.id} Column</p>
                                                        </div>
                                                        <Plus size={14} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {schema.length > 0 && (
                                        <div className="space-y-2 pt-4 border-t border-slate-100">
                                            <h4 className="px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Columns</h4>
                                            <div className="space-y-1">
                                                {schema.map((f) => (
                                                    <div key={f.id} className="group flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 text-slate-400 shrink-0"><Type size={16} /></div>
                                                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setActiveFieldId(f.id); setDraftField(null); setSidebarMode('settings'); }}>
                                                            <p className="text-sm font-bold text-slate-700 truncate">{f.label}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => removeField(f.id)}
                                                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (selectedField || draftField) ? (
                            <>
                                {(() => {
                                    const field = selectedField || draftField;
                                    const typeInfo = FIELD_TYPES.find(f => f.id === field.type);
                                    const Icon = IconMap[typeInfo?.icon] || Type;
                                    return (
                                        <>
                                            <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                                                <div className="flex items-center justify-between mb-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${typeInfo?.color}15`, color: typeInfo?.color }}>
                                                            <Icon size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-none">
                                                                {draftField ? 'Configure New Field' : 'Field Options'}
                                                            </h3>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1.5">{field.type} column</p>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => { setIsSidebarOpen(false); setActiveFieldId(null); setDraftField(null); }} className="p-2 hover:bg-slate-50 rounded-xl transition text-slate-400"><X size={20} /></button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Column Label</label>
                                                    <input type="text" value={field.label} onChange={e => updateField(field.id, 'label', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Placeholder Text</label>
                                                    <input type="text" value={field.placeholder} onChange={e => updateField(field.id, 'placeholder', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                                                </div>

                                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <div>
                                                        <p className="text-xs font-black text-slate-700 uppercase tracking-tight">Required Field</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Mandatory during entry</p>
                                                    </div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, 'required', e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                    </label>
                                                </div>

                                                {(field.type === 'dropdown' || field.type === 'checkbox') && (
                                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                                        {field.type === 'checkbox' && (
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Selection Mode</label>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => updateField(field.id, 'checkType', 'multicheck')}
                                                                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all ${
                                                                            (field.checkType || 'multicheck') === 'multicheck'
                                                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                                                                : 'border-slate-100 text-slate-600 hover:border-slate-200'
                                                                        }`}
                                                                    >
                                                                        Multi-check
                                                                    </button>
                                                                    <button
                                                                        onClick={() => updateField(field.id, 'checkType', 'single')}
                                                                        className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all ${
                                                                            field.checkType === 'single'
                                                                                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                                                                : 'border-slate-100 text-slate-600 hover:border-slate-200'
                                                                        }`}
                                                                    >
                                                                        Single-check
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{field.type === 'dropdown' ? 'Dropdown Options' : 'Checkbox Options'}</label>
                                                        <div className="space-y-2">
                                                            {field.options?.map((opt, i) => (
                                                                <div key={i} className="flex gap-2 group/opt">
                                                                    <input type="text" value={opt} onChange={e => { const newOpts = [...field.options]; newOpts[i] = e.target.value; updateField(field.id, 'options', newOpts); }} className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:bg-white focus:border-indigo-500 outline-none transition-all" />
                                                                    <button onClick={() => { const newOpts = field.options.filter((_, idx) => idx !== i); updateField(field.id, 'options', newOpts); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover/opt:opacity-100"><Trash2 size={14} /></button>
                                                                </div>
                                                            ))}
                                                            <button onClick={() => { const newOpts = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`]; updateField(field.id, 'options', newOpts); }} className="flex items-center gap-2 text-[11px] font-black text-indigo-600 hover:text-indigo-700 px-2 mt-2"><Plus size={14} /> Add New Option</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
                                                <div className="flex gap-3">
                                                    {!draftField && (
                                                        <button onClick={() => removeField(field.id)} className="flex-1 flex items-center justify-center gap-2 p-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                                                            <Trash2 size={16} /> Delete
                                                        </button>
                                                    )}
                                                    {draftField && (
                                                        <button
                                                            onClick={confirmAddField}
                                                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
                                                        >
                                                            <Plus size={16} /> Add Field
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </>
                        ) : null}
                    </div>
                </div>
            )}

            {/* Multiple Attachments List & Preview Modal */}
            {attachmentsModal.open && (
                <div className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-lg w-full border border-slate-100 flex flex-col max-h-[85vh]">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">{attachmentsModal.title}</h3>
                            <button
                                onClick={() => setAttachmentsModal({ open: false, title: '', files: [], type: 'subtask', id: null, originalIndex: null })}
                                className="p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded-xl transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {incomingPreviewFile ? (
                                // PDF / Image Preview State inside the modal (with Back button)
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <button
                                            onClick={() => setIncomingPreviewFile(null)}
                                            className="flex items-center gap-1 text-[11px] font-black text-indigo-650 hover:text-indigo-700 bg-white border border-slate-200 rounded-xl px-3.5 py-1.8 transition shadow-sm"
                                        >
                                            ← Back to List
                                        </button>
                                        <span className="text-[10px] font-black uppercase text-indigo-650 bg-indigo-50/50 px-2.5 py-1 rounded-full">
                                            {getFileType(incomingPreviewFile.url)}
                                        </span>
                                    </div>
                                    <div className="overflow-auto max-h-[45vh] p-2 flex items-center justify-center bg-slate-50/30 rounded-2xl border border-slate-150">
                                        {getFileType(incomingPreviewFile.url) === 'image' ? (
                                            <img src={incomingPreviewFile.url} alt={incomingPreviewFile.name} className="max-w-full max-h-[40vh] object-contain rounded-xl shadow-sm" />
                                        ) : getFileType(incomingPreviewFile.url) === 'pdf' ? (
                                            <iframe src={incomingPreviewFile.url} className="w-full h-[40vh] rounded-xl border border-slate-200 bg-white" title="PDF Preview"></iframe>
                                        ) : (
                                            <div className="py-8 px-4 flex flex-col items-center justify-center gap-3 text-center">
                                                <FileText size={32} className="text-slate-400" />
                                                <p className="text-xs font-bold text-slate-600">{incomingPreviewFile.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-black">Preview not supported</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                // Attachments List View
                                <div className="space-y-3">
                                    {attachmentsModal.files.length === 0 ? (
                                        <div className="text-center py-12">
                                            <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Attachments Uploaded</p>
                                        </div>
                                    ) : (
                                        attachmentsModal.files.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/50 rounded-2xl border border-slate-100 transition gap-4">
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <FileText size={16} className="text-indigo-500 shrink-0" />
                                                    <span className="text-xs font-bold text-slate-700 truncate" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        onClick={() => setIncomingPreviewFile(file)}
                                                        className="p-2 text-indigo-650 hover:text-indigo-700 hover:bg-white rounded-xl transition border border-transparent hover:border-slate-200/60 shadow-none hover:shadow-sm"
                                                        title="Preview"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <a
                                                        href={file.url}
                                                        download={file.name}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-white rounded-xl transition border border-transparent hover:border-slate-200/60 shadow-none hover:shadow-sm"
                                                        title="Download"
                                                    >
                                                        <FileDown size={14} />
                                                    </a>
                                                    {((attachmentsModal.type === 'subtask' && !task.sub_tasks?.find(st => st.id === attachmentsModal.id)?.is_verified) ||
                                                      (attachmentsModal.type === 'row' && !rows[attachmentsModal.originalIndex]?.is_verified)) && (
                                                        <button
                                                            onClick={() => {
                                                                if (attachmentsModal.type === 'subtask') {
                                                                    handleDeleteSubTaskFileAttachment(attachmentsModal.id, file.path);
                                                                } else {
                                                                    handleDeleteRowAttachment(attachmentsModal.originalIndex, file.path);
                                                                }
                                                            }}
                                                            className="p-2 text-rose-600 hover:text-rose-700 hover:bg-white rounded-xl transition border border-transparent hover:border-slate-200/60 shadow-none hover:shadow-sm"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer (Upload form when inside list view) */}
                        {!incomingPreviewFile && (
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                {((attachmentsModal.type === 'subtask' && !task.sub_tasks?.find(st => st.id === attachmentsModal.id)?.is_verified) ||
                                  (attachmentsModal.type === 'row' && !rows[attachmentsModal.originalIndex]?.is_verified)) ? (
                                    <label className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl text-xs font-black uppercase tracking-wider text-slate-600 hover:text-indigo-650 cursor-pointer transition shadow-sm">
                                        <Plus size={16} />
                                        <span>Upload Attachments (Select Multiple)</span>
                                        <input
                                            type="file"
                                            multiple
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files.length > 0) {
                                                    if (attachmentsModal.type === 'subtask') {
                                                        handleUploadMultipleSubTaskAttachments(attachmentsModal.id, e.target.files);
                                                    } else {
                                                        handleUploadMultipleRowAttachments(attachmentsModal.originalIndex, e.target.files);
                                                    }
                                                }
                                            }}
                                        />
                                    </label>
                                ) : (
                                    <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 select-none">
                                        Locked / Verified Row
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Premium Document/Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative max-w-4xl w-full flex flex-col items-center justify-center gap-4">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-0 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110 shrink-0"
                            title="Close / Back"
                        >
                            <X size={24} />
                        </button>

                        <div className="bg-white p-4 rounded-[2rem] shadow-2xl overflow-hidden max-h-[80vh] w-full flex flex-col justify-center border border-slate-100/50">
                            <div className="p-3 border-b border-slate-100 flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <FileText size={16} className="text-indigo-500" />
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider truncate max-w-md">{getFileName(previewImage)}</span>
                                </div>
                                <span className="text-[9px] font-black uppercase text-indigo-650 bg-indigo-50/50 px-2.5 py-1 rounded-full">{getFileType(previewImage)} File</span>
                            </div>

                            <div className="overflow-auto max-h-[60vh] p-2 flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100">
                                {getFileType(previewImage) === 'image' ? (
                                    <img src={previewImage} alt="Preview" className="max-w-full max-h-[55vh] object-contain rounded-xl shadow-sm" />
                                ) : getFileType(previewImage) === 'pdf' ? (
                                    <iframe src={previewImage} className="w-[80vw] h-[55vh] rounded-xl border border-slate-200 bg-white" title="PDF Preview"></iframe>
                                ) : (
                                    <div className="py-12 px-6 flex flex-col items-center justify-center gap-4 text-center">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                                            <FileText size={32} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-800 truncate max-w-sm">{getFileName(previewImage)}</h4>
                                            <p className="text-[10px] text-slate-400 font-extrabold uppercase mt-1">Preview not supported for this file format</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-150 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setPreviewImage(null)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer"
                                >
                                    Close Preview
                                </button>
                                <a
                                    href={previewImage}
                                    download={getFileName(previewImage)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 shadow-md shadow-emerald-100 hover:shadow-lg active:scale-95 cursor-pointer border border-emerald-600"
                                >
                                    <FileDown size={14} /> 
                                    <span>Download File</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Modal */}
            <ConfirmDialog
                open={confirmState.open}
                onClose={() => setConfirmState(prev => ({ ...prev, open: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel={confirmState.confirmLabel}
                danger={confirmState.danger}
                loading={confirmState.loading}
            />

            {/* Excel Import Preview Modal */}
            {isImportPreviewOpen && (
                <Modal
                    open={isImportPreviewOpen}
                onClose={() => setIsImportPreviewOpen(false)}
                closeOnOutsideClick={false}
                title="Excel Import Registry Preview"
                width="max-w-7xl"
            >
                <div className="space-y-6">
                    {/* Header Summary Banner */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                                <CheckCircle2 className="text-indigo-600 w-5 h-5" />
                                <span>Parsed {previewRows.length} total rows from Excel sheet</span>
                            </h4>
                            <p className="text-xs font-semibold text-slate-400">
                                Rows highlighted in <span className="text-sky-600 font-bold">Blue</span> represent existing rows that will be updated. Modified cells will be highlighted in <span className="text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded">Orange</span>. Rows in <span className="text-emerald-600 font-bold">Green</span> represent new rows to be inserted.
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right border-r pr-4 border-slate-200">
                                <span className="text-[10px] font-black text-slate-400 block uppercase">New Rows</span>
                                <span className="text-lg font-black text-emerald-600">
                                    {previewRows.filter(r => !r.isUpdate).length}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 block uppercase font-bold text-sky-600">Updates</span>
                                <span className="text-lg font-black text-sky-600">
                                    {previewRows.filter(r => r.isUpdate).length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Preview Table */}
                    <div className="overflow-x-auto border border-slate-200/60 rounded-3xl bg-white shadow-sm max-h-[55vh]">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10">
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Sheet Name</th>
                                    <th className="px-4 py-3">Client</th>
                                    <th className="px-4 py-3">Work Type</th>
                                    <th className="px-4 py-3">Assigned To</th>
                                    <th className="px-4 py-3">Create Date</th>
                                    <th className="px-4 py-3">Sheet Status</th>
                                    <th className="px-4 py-3">Sub Status</th>
                                    {schema.filter(f => !f.id.startsWith('static_')).map(f => (
                                        <th key={f.label} className="px-4 py-3">{f.label}</th>
                                    ))}
                                    <th className="px-4 py-3">Remarks</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {previewRows.map((row, idx) => {
                                    const isUpdate = row.isUpdate;
                                    
                                    const renderCell = (fieldLabel, value) => {
                                        const isChanged = row.changedFields?.includes(fieldLabel);
                                        return (
                                            <td 
                                                key={fieldLabel}
                                                className={`px-4 py-3 transition-colors ${isChanged ? 'bg-amber-100/65 font-bold text-amber-900 border border-amber-300/50' : ''}`}
                                            >
                                                {value || '—'}
                                            </td>
                                        );
                                    };

                                    return (
                                        <tr
                                            key={idx}
                                            className={`transition ${isUpdate ? 'bg-sky-50/50 hover:bg-sky-50' : 'bg-emerald-50/20 hover:bg-emerald-50/45'}`}
                                        >
                                            {/* Status Badge */}
                                            <td className="px-4 py-3 min-w-[120px]">
                                                {isUpdate ? (
                                                    <span className="inline-flex items-center gap-1 bg-sky-100 border border-sky-200 text-sky-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                        <Edit2 size={10} /> Update
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                        <Plus size={10} /> New Row
                                                    </span>
                                                )}
                                            </td>
                                            {renderCell('Sheet Name', row.form_name)}
                                            {row.client_id ? (
                                                renderCell('Client', row.client_name)
                                            ) : (
                                                <td className="px-4 py-3 min-w-[200px] bg-rose-50/40 border border-rose-100/50">
                                                    <div className="flex flex-col gap-1.5 py-1">
                                                        <div className="flex items-center gap-1.5 text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-lg px-2 py-0.5 w-max text-[9px] uppercase tracking-wider">
                                                            <AlertCircle size={9} /> Not Found
                                                        </div>
                                                        <div className="font-semibold text-slate-700">
                                                            {row.client_name || '—'}
                                                            {row.parsed_client_pan && (
                                                                <span className="text-[10px] text-slate-450 block font-bold mt-0.5">
                                                                    PAN: <span className="font-black text-slate-600">{row.parsed_client_pan}</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickAddClient(row)}
                                                            className="inline-flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl transition shadow-md shadow-indigo-100 cursor-pointer w-max"
                                                        >
                                                            <Plus size={10} /> Add Client
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                            {renderCell('Work Type', row.work_type_name)}
                                            <td className="px-4 py-3 min-w-[160px]">
                                                <select
                                                    value={row.allocated_to || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const matchedStaff = staff.find(s => String(s.id) === String(val));
                                                        const assignedToName = matchedStaff ? matchedStaff.name : 'Unassigned';

                                                        setPreviewRows(prev => prev.map((pr, pIdx) => {
                                                            if (pIdx === idx) {
                                                                const existingRow = pr.row_id ? rows.find(r => String(r.row_id) === String(pr.row_id)) : null;
                                                                const isChanged = String(val) !== String(existingRow?.allocated_to || '');
                                                                const changedFields = isChanged
                                                                    ? [...(pr.changedFields || []), 'Assigned To'].filter((value, index, self) => self.indexOf(value) === index)
                                                                    : (pr.changedFields || []).filter(f => f !== 'Assigned To');

                                                                return {
                                                                    ...pr,
                                                                    allocated_to: val,
                                                                    assigned_to_name: assignedToName,
                                                                    allocated_type: 'user',
                                                                    changedFields
                                                                };
                                                            }
                                                            return pr;
                                                        }));
                                                    }}
                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-550 font-semibold text-slate-700 cursor-pointer"
                                                >
                                                    <option value="">Unassigned</option>
                                                    {staff.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            {renderCell('Create Date', formatDate(row.date_allocated))}
                                            {renderCell('Sheet Status', row.status)}
                                            {renderCell('Sub Status', row.sub_status)}
                                            {schema.filter(f => !f.id.startsWith('static_')).map(f => 
                                                renderCell(f.label, row.dynamic_data?.[f.label])
                                            )}
                                            {renderCell('Remarks', row.remarks)}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => setIsImportPreviewOpen(false)}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md shadow-indigo-100 cursor-pointer"
                        >
                            Confirm Import
                        </button>
                    </div>
                </div>
            </Modal>
            )}

            {/* Quick Add Client Modal */}
            <Modal
                open={isQuickAddClientOpen}
                onClose={() => {
                    setIsQuickAddClientOpen(false);
                    setQuickAddClientForm(EMPTY_CLIENT_FORM);
                    setQuickAddClientErrors({});
                }}
                title="Register New CA Business Client"
                width="max-w-4xl"
            >
                <div className="space-y-6 px-1">
                    {/* Main Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Client Name */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Client Name *</label>
                            <input 
                                type="text" 
                                value={quickAddClientForm.name} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, name: e.target.value }))} 
                                placeholder="Enter Client Name" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.name && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.name[0]}</p>}
                        </div>

                        {/* Client Type */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Type *</label>
                            <select 
                                value={quickAddClientForm.type} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, type: e.target.value }))} 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
                            >
                                <option value="">Select Type...</option>
                                {clientTypes.map(t => (
                                    <option key={t.id} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                            {quickAddClientErrors.type && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.type[0]}</p>}
                        </div>

                        {/* Client Name As per PAN */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Client Name As Per PAN</label>
                            <input 
                                type="text" 
                                value={quickAddClientForm.name_as_per_pan} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, name_as_per_pan: e.target.value }))} 
                                placeholder="Enter Name exactly as printed on PAN" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.name_as_per_pan && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.name_as_per_pan[0]}</p>}
                        </div>

                        {/* PAN Number with Validation Indicator */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">PAN No</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    maxLength={10}
                                    value={quickAddClientForm.pan_no} 
                                    onChange={e => setQuickAddClientForm(f => ({ ...f, pan_no: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} 
                                    placeholder="Enter 10-Digit PAN (e.g. BIBPB1899L)" 
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400 uppercase pr-8" 
                                />
                                {quickAddClientForm.pan_no && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {getQuickClientPanValidation()?.valid ? (
                                            <ShieldCheck className="text-emerald-500 w-4 h-4" />
                                        ) : (
                                            <ShieldAlert className="text-rose-500 w-4 h-4" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {quickAddClientForm.pan_no && (
                                <p className={`text-[9px] font-bold mt-1 ${getQuickClientPanValidation()?.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {getQuickClientPanValidation()?.msg}
                                </p>
                            )}
                            {quickAddClientErrors.pan_no && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.pan_no[0]}</p>}
                        </div>

                        {/* Group */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Group *</label>
                            <select 
                                value={quickAddClientForm.group} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, group: e.target.value }))} 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
                            >
                                <option value="">Select Group...</option>
                                {clientGroups.map(g => (
                                    <option key={g.id} value={g.name}>{g.name}</option>
                                ))}
                            </select>
                            {quickAddClientErrors.group && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.group[0]}</p>}
                        </div>

                        {/* Contact No */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Contact No</label>
                            <input 
                                type="text" 
                                maxLength={10}
                                value={quickAddClientForm.contact} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, contact: e.target.value.replace(/\D/g, '') }))} 
                                placeholder="10-digit mobile number" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.contact && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.contact[0]}</p>}
                        </div>

                        {/* Alternative Contact No */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Alternative Contact No</label>
                            <input 
                                type="text" 
                                maxLength={10}
                                value={quickAddClientForm.alternative_contact} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, alternative_contact: e.target.value.replace(/\D/g, '') }))} 
                                placeholder="Alternative 10-digit number" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.alternative_contact && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.alternative_contact[0]}</p>}
                        </div>

                        {/* Email Address */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Email ID</label>
                            <input 
                                type="email" 
                                value={quickAddClientForm.email} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, email: e.target.value }))} 
                                placeholder="client@example.com" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.email && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.email[0]}</p>}
                        </div>

                        {/* Reference No */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Reference No</label>
                            <input 
                                type="text" 
                                value={quickAddClientForm.reference_no} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, reference_no: e.target.value }))} 
                                placeholder="Enter reference details" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.reference_no && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.reference_no[0]}</p>}
                        </div>

                        {/* City */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">City</label>
                            <input 
                                type="text" 
                                value={quickAddClientForm.city} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, city: e.target.value }))} 
                                placeholder="Enter City" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.city && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.city[0]}</p>}
                        </div>

                        {/* Pin Code */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Pin Code</label>
                            <input 
                                type="text" 
                                maxLength={6} 
                                value={quickAddClientForm.pin_code} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))} 
                                placeholder="6-digit postal code" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.pin_code && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.pin_code[0]}</p>}
                        </div>

                        {/* State */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">State</label>
                            <input 
                                type="text" 
                                value={quickAddClientForm.state} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, state: e.target.value }))} 
                                placeholder="Enter State" 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.state && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.state[0]}</p>}
                        </div>

                        {/* Date of Birth */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">Date Of Birth</label>
                            <input 
                                type="date" 
                                value={quickAddClientForm.dob} 
                                onChange={e => setQuickAddClientForm(f => ({ ...f, dob: e.target.value }))} 
                                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
                            />
                            {quickAddClientErrors.dob && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.dob[0]}</p>}
                        </div>

                        {/* GST Number */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 font-bold">GST No</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    value={quickAddClientForm.gst_number || ''} 
                                    onChange={e => setQuickAddClientForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} 
                                    placeholder="GST Identification Number" 
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400 pr-8" 
                                    autoComplete="off"
                                />
                                {quickAddClientForm.gst_number && (
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                        {getQuickClientGstValidation()?.valid ? (
                                            <ShieldCheck className="text-emerald-500 w-4 h-4" />
                                        ) : (
                                            <ShieldAlert className="text-rose-500 w-4 h-4" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {quickAddClientForm.gst_number && (
                                <p className={`text-[9px] font-bold mt-1 ${getQuickClientGstValidation()?.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {getQuickClientGstValidation()?.msg}
                                </p>
                            )}
                            {quickAddClientErrors.gst_number && <p className="text-[10px] text-red-500 mt-1">{quickAddClientErrors.gst_number[0]}</p>}
                        </div>
                    </div>

                    {/* Portal Credentials Section */}
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Key className="text-indigo-500 w-4 h-4" />
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Portal Credentials (Passwords)</h4>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowPasswords(!showPasswords)}
                                className="text-xs text-[#1F5C99] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                                {showPasswords ? <EyeOff size={13} className="inline mr-1" /> : <Eye size={13} className="inline mr-1" />}
                                <span>{showPasswords ? 'Hide Credentials' : 'Reveal Credentials'}</span>
                            </button>
                        </div>

                        <div className="overflow-hidden border border-slate-200/60 rounded-2xl bg-white shadow-sm">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                                        <th className="px-4 py-3">Portal URL</th>
                                        <th className="px-4 py-3">Auth Type</th>
                                        <th className="px-4 py-3">User ID</th>
                                        <th className="px-4 py-3">Password</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {/* EFILING row */}
                                    <tr>
                                        <td className="px-4 py-3 font-semibold text-slate-650">
                                            <a href="https://eportal.incometax.gov.in/iec/foservices/#/login" target="_blank" rel="noopener noreferrer" className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1">
                                                WWW.EFILING INCOME TAX <ExternalLink size={12} />
                                            </a>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-slate-200">
                                                IT login
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-slate-605">{quickAddClientForm.pan_no || 'ENTER PAN ABOVE'}</td>
                                        <td className="px-4 py-3">
                                            <input 
                                                type={showPasswords ? "text" : "password"} 
                                                value={quickAddClientForm.credentials.efiling_password} 
                                                onChange={e => setQuickAddClientForm(f => ({ ...f, credentials: { ...f.credentials, efiling_password: e.target.value } }))} 
                                                placeholder="Enter IT Password" 
                                                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                                                autoComplete="new-password"
                                            />
                                        </td>
                                    </tr>

                                    {/* AIS & TIS row */}
                                    <tr>
                                        <td className="px-4 py-3 font-semibold text-slate-650">
                                            <a href="https://eportal.incometax.gov.in/iec/foservices/#/login" target="_blank" rel="noopener noreferrer" className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1">
                                                WWW.EFILING INCOME TAX <ExternalLink size={12} />
                                            </a>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100">
                                                AIS & TIS
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-slate-605">{quickAddClientForm.pan_no || 'ENTER PAN ABOVE'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <input 
                                                    type={showPasswords ? "text" : "password"} 
                                                    value={quickAddClientForm.credentials.ais_tis_password} 
                                                    onChange={e => setQuickAddClientForm(f => ({ ...f, credentials: { ...f.credentials, ais_tis_password: e.target.value } }))} 
                                                    placeholder="Enter AIS/TIS Password" 
                                                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none" 
                                                    autoComplete="new-password"
                                                />
                                                <span className="text-[9px] font-bold text-slate-400 mt-1">
                                                    Auto Generated format: lower(PAN) + DOB (e.g. abcde1234f01011990)
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={() => {
                                setIsQuickAddClientOpen(false);
                                setQuickAddClientForm(EMPTY_CLIENT_FORM);
                                setQuickAddClientErrors({});
                            }}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveQuickClient}
                            disabled={savingQuickClient}
                            className="px-6 py-2.5 bg-[#1F5C99] hover:bg-[#154675] text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md disabled:opacity-60 cursor-pointer"
                        >
                            {savingQuickClient ? 'Registering...' : 'Register Client'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Assign Staff Modal */}
            {assigningRowIndex !== null && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 scale-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-indigo-50/50 to-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Assign Row Task</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Row #{assigningRowIndex + 1} — {rows[assigningRowIndex]?.form_name || 'Untitled'}</p>
                            </div>
                            <button
                                onClick={() => setAssigningRowIndex(null)}
                                className="p-1.5 hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 rounded-xl transition duration-150 active:scale-95 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-6 space-y-5">
                            {/* Type Selector */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Assignment Mode</label>
                                <select
                                    value={assigningType}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setAssigningType(type);
                                        setAssigningTo(type === 'users' ? [] : '');
                                    }}
                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 transition focus:outline-none cursor-pointer w-full"
                                >
                                    <option value="user">Single Staff Member</option>
                                    <option value="users">Multiple Staff Members</option>
                                    <option value="role">Department (Role)</option>
                                </select>
                            </div>

                            {/* Single User Selector */}
                            {assigningType === 'user' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Staff Member</label>
                                    <select
                                        value={assigningTo || ''}
                                        onChange={(e) => setAssigningTo(e.target.value)}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition focus:outline-none cursor-pointer w-full"
                                    >
                                        <option value="">— Select Staff —</option>
                                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* Multiple Users Selector */}
                            {assigningType === 'users' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Staff Members</label>
                                    <div className="border border-slate-200 rounded-2xl p-3 max-h-[160px] overflow-y-auto bg-slate-50 space-y-1.5">
                                        {staff.map(s => {
                                            const currentList = Array.isArray(assigningTo) ? assigningTo : [];
                                            const isChecked = currentList.map(String).includes(String(s.id));
                                            return (
                                                <label key={s.id} className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100/80 p-1.5 rounded-xl transition">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            let list = [...currentList];
                                                            if (checked) {
                                                                if (!list.map(String).includes(String(s.id))) {
                                                                    list.push(s.id);
                                                                }
                                                            } else {
                                                                list = list.filter(id => String(id) !== String(s.id));
                                                            }
                                                            setAssigningTo(list);
                                                        }}
                                                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                                    />
                                                    <span>{s.name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Department/Role Selector */}
                            {assigningType === 'role' && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Select Department</label>
                                    <select
                                        value={assigningTo || ''}
                                        onChange={(e) => setAssigningTo(e.target.value)}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-350 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition focus:outline-none cursor-pointer w-full"
                                    >
                                        <option value="">— Select Department —</option>
                                        {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setAssigningRowIndex(null)}
                                className="px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const newRows = [...rows];
                                    newRows[assigningRowIndex].allocated_type = assigningType;
                                    newRows[assigningRowIndex].allocated_to = assigningTo;
                                    newRows[assigningRowIndex].date_allocated = new Date().toISOString().split('T')[0];
                                    setRows(newRows);
                                    setAssigningRowIndex(null);
                                    await handleSaveRows(newRows, 'Row allocation updated successfully');
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-md shadow-indigo-100 hover:shadow-lg"
                            >
                                Save Assignment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAddTaskModalOpen && (
                <AddTaskModal
                    isOpen={isAddTaskModalOpen}
                    onClose={() => setIsAddTaskModalOpen(false)}
                    allFields={allFields}
                    isBillableEnabled={isBillableEnabled}
                    isAfterSalesEnabled={isAfterSalesEnabled}
                    clients={clients
                        .filter(c => {
                            if (allowDuplicateClients) return true;
                            if (viewingRowIndex !== null && String(c.id) === String(rows[viewingRowIndex]?.client_id)) return true;
                            return !rows.some((r, rIdx) => rIdx !== viewingRowIndex && String(r.client_id) === String(c.id));
                        })
                        .map(c => ({
                            id: c.id,
                            name: c.name,
                            pan_no: c.pan_no
                        }))
                    }
                    workTypes={workTypes}
                    staff={staff}
                    newTaskData={newTaskData}
                    setNewTaskData={setNewTaskData}
                    isViewMode={viewingRowIndex !== null}
                    isEditable={modalEditable}
                    setIsEditable={setModalEditable}
                    isAdmin={isAdmin}
                    isStaff={isStaff}
                    task={task}
                    canEdit={viewingRowIndex !== null ? !(!isAdmin && (
                        rows[viewingRowIndex]?.is_verified || 
                        !canWrite || 
                        (isStaff && !doesStaffMatchRow(rows[viewingRowIndex], user))
                    )) : true}
                    onUploadAttachment={async (fileList) => {
                        if (viewingRowIndex !== null) {
                            await handleUploadMultipleRowAttachments(viewingRowIndex, fileList);
                        } else {
                            const files = Array.from(fileList || []);
                            const loadingToast = toast.loading("Uploading attachment...");
                            try {
                                const apiPrefix = isStaff ? '/staff' : '/ca';
                                const uploadedFiles = [];
                                for (const file of files) {
                                    if (file.size > 5 * 1024 * 1024) {
                                        toast.error(`File "${file.name}" size must be under 5MB.`);
                                        continue;
                                    }
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const res = await api.post(`${apiPrefix}/tasks/upload-file`, formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    uploadedFiles.push({
                                        name: res.data.name,
                                        url: res.data.url,
                                        path: res.data.path
                                    });
                                }
                                setNewTaskData(prev => ({
                                    ...prev,
                                    attachments: [...(prev.attachments || []), ...uploadedFiles]
                                }));
                                toast.success("Attachment(s) uploaded successfully!", { id: loadingToast });
                            } catch (e) {
                                console.error(e);
                                toast.error("Failed to upload attachment(s)", { id: loadingToast });
                            }
                        }
                    }}
                    onDeleteAttachment={async (idx, filePath) => {
                        if (viewingRowIndex !== null) {
                            await handleDeleteRowAttachment(viewingRowIndex, filePath);
                        } else {
                            setNewTaskData(prev => ({
                                ...prev,
                                attachments: (prev.attachments || []).filter((_, i) => i !== idx)
                            }));
                            toast.success("Attachment removed successfully!");
                        }
                    }}
                    onToggleVerification={async () => {
                        if (viewingRowIndex !== null) {
                            const targetRow = rows[viewingRowIndex];
                            const nextVerified = !targetRow?.is_verified;
                            
                            setConfirmState({
                                open: true,
                                title: nextVerified ? 'Verify & Lock Row' : 'Unverify & Unlock Row',
                                message: nextVerified 
                                    ? 'Are you sure you want to verify and lock this sheet row? Once verified, staff members cannot modify its details.'
                                    : 'Are you sure you want to unverify and unlock this sheet row? This will allow the assigned staff member to edit it again.',
                                confirmLabel: nextVerified ? 'Verify & Lock' : 'Unverify & Unlock',
                                danger: nextVerified,
                                onConfirm: async () => {
                                    setConfirmState(prev => ({ ...prev, loading: true }));
                                    try {
                                        const newRows = [...rows];
                                        newRows[viewingRowIndex].is_verified = nextVerified;
                                        setRows(newRows);
                                        await handleSaveRows(newRows);
                                        setNewTaskData(prev => ({
                                            ...prev,
                                            is_verified: nextVerified
                                        }));
                                        toast.success(nextVerified ? "Row verified and locked successfully!" : "Row unverified and unlocked successfully!");
                                    } catch (err) {
                                        toast.error(nextVerified ? "Failed to verify row" : "Failed to unverify row");
                                    } finally {
                                        setConfirmState({ open: false });
                                    }
                                }
                            });
                        }
                    }}
                    onSave={(newRow) => {
                        if (viewingRowIndex !== null) {
                            const updatedRows = [...rows];
                            updatedRows[viewingRowIndex] = newRow;
                            setRows(updatedRows);
                            handleSaveRows(updatedRows, 'Row updated successfully');
                            setViewingRowIndex(null);
                        } else {
                            const nextTotalRows = totalRows + 1;
                            const nextTotalPages = Math.ceil(nextTotalRows / (rowsPerPage === 'All' ? nextTotalRows || 1 : rowsPerPage));
 
                            const updatedRows = [...rows, newRow];
                            setRows(updatedRows);
                            handleSaveRows(updatedRows, 'Row added successfully via Add Task', [], nextTotalPages);
                        }
                    }}
                />
            )}

            {bulkEditOpen && (
                <BulkEditTaskModal
                    isOpen={bulkEditOpen}
                    onClose={() => setBulkEditOpen(false)}
                    allFields={allFields}
                    isBillableEnabled={isBillableEnabled}
                    isAfterSalesEnabled={isAfterSalesEnabled}
                    clients={clients}
                    workTypes={workTypes}
                    staff={staff}
                    task={task}
                    isAdmin={isAdmin}
                    onSave={async (fields, targets) => {
                        const nextRows = rows.map(r => {
                            const rid = r.row_id || r.id;
                            if (selectedRowIds.includes(rid)) {
                                const updatedRow = { ...r, dynamic_data: { ...(r.dynamic_data || {}) } };
                                
                                // Map static fields
                                if (targets.client_id) updatedRow.client_id = fields.client_id ? Number(fields.client_id) : null;
                                if (targets.allocated_to) {
                                    updatedRow.allocated_to = fields.allocated_to ? Number(fields.allocated_to) : null;
                                    updatedRow.allocated_type = 'user';
                                }
                                if (targets.status) updatedRow.status = fields.status || 'assigned';
                                if (targets.sub_status) updatedRow.sub_status = fields.sub_status || null;
                                if (targets.date_allocated) updatedRow.date_allocated = fields.date_allocated || null;
                                if (targets.remarks) updatedRow.remarks = fields.remarks || '';
                                if (targets.is_verified) updatedRow.is_verified = !!fields.is_verified;
                                if (targets.form_name) updatedRow.form_name = fields.form_name || '';
                                if (targets.work_type_id) updatedRow.work_type_id = fields.work_type_id ? Number(fields.work_type_id) : null;
                                
                                // Map dynamic fields
                                Object.keys(targets).forEach(k => {
                                    const staticKeys = ['client_id', 'allocated_to', 'status', 'sub_status', 'date_allocated', 'remarks', 'is_verified', 'form_name', 'work_type_id', 'attachments'];
                                    if (!staticKeys.includes(k)) {
                                        updatedRow.dynamic_data[k] = fields.dynamic_data[k];
                                    }
                                });

                                // Recalculate balance amount if any billing fields are updated
                                const parseAmt = (val) => parseFloat(String(val || '0').replace(/,/g, '')) || 0;
                                const total = parseAmt(updatedRow.dynamic_data?.['TOTAL INVOICE AMOUNT']);
                                const p1 = parseAmt(updatedRow.dynamic_data?.['PAYMENT-1']);
                                const p2 = parseAmt(updatedRow.dynamic_data?.['PAYMENT-2']);
                                const p3 = parseAmt(updatedRow.dynamic_data?.['PAYMENT-3']);
                                const balance = total - (p1 + p2 + p3);
                                updatedRow.dynamic_data['BALANCE AMOUNT'] = formatIndianCurrencyWithDecimals(balance.toString());

                                return updatedRow;
                            }
                            return r;
                        });
                        
                        setRows(nextRows);
                        setSelectedRowIds([]);
                        await handleSaveRows(nextRows, `Bulk updated ${selectedRowIds.length} rows successfully`);
                    }}
                />
            )}

            {selectedRowIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white border border-slate-800 rounded-2xl shadow-2xl py-3 px-6 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                        <p className="text-xs font-semibold text-slate-200">
                            <span className="font-extrabold text-blue-400">{selectedRowIds.length}</span> rows selected
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setSelectedRowIds([])}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
                        >
                            Clear Selection
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setBulkMainFields({ client_id: '', allocated_to: '', status: 'assigned', sub_status: '', date_allocated: '', remarks: '' });
                                setBulkUpdateTargets({ client_id: false, allocated_to: false, status: false, sub_status: false, date_allocated: false, remarks: false });
                                setBulkEditOpen(true);
                            }}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20"
                        >
                            Bulk Edit
                        </button>
                        <button
                            type="button"
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 bg-red-650 hover:bg-red-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-md shadow-red-650/20"
                        >
                            Bulk Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
