import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ChevronLeft, Save, Edit2, X, CheckCircle, Plus, Trash2, Layout, Search,
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, AlertCircle, GripVertical, Settings,
    Flag, UserPlus, CheckCircle2, Circle, MoreHorizontal, FileDown, Eye, Copy, ChevronRight, Globe,
    PlusCircle, Check, CircleDashed, FileText, SlidersHorizontal
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import SubStatusPicker from '../../components/ui/SubStatusPicker';
import Tooltip from '../../components/ui/Tooltip';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { FIELD_TYPES } from '../../constants/fieldTypes';
import { formatDate } from '../../utils/dateHelper';

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
        activeClass = 'active-card-blue ring-4 ring-blue-500/5 shadow-lg shadow-blue-500/5 scale-[1.02]';
    } else if (iconColor.includes('amber') || iconColor.includes('yellow')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFFBEB] border-amber-100 text-slate-750 hover:border-amber-300';
        activeClass = 'active-card-amber ring-4 ring-amber-500/5 shadow-lg shadow-amber-500/5 scale-[1.02]';
    } else if (iconColor.includes('green') || iconColor.includes('emerald')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F0FDF4] border-emerald-100 text-slate-750 hover:border-emerald-300';
        activeClass = 'active-card-emerald ring-4 ring-emerald-500/5 shadow-lg shadow-emerald-500/5 scale-[1.02]';
    } else if (iconColor.includes('red') || iconColor.includes('rose')) {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#FFF5F5] border-red-100 text-slate-750 hover:border-red-300';
        activeClass = 'active-card-rose ring-4 ring-red-500/5 shadow-lg shadow-rose-500/5 scale-[1.02]';
    } else {
        inactiveBgClass = 'bg-gradient-to-br from-white to-[#F8FAFC] border-slate-200 text-slate-750 hover:border-slate-400';
        activeClass = 'active-card-slate ring-4 ring-slate-500/5 shadow-lg shadow-slate-500/5 scale-[1.02]';
    }

    return (
        <div 
            onClick={onClick}
            className={`rounded-xl p-3 transition-all duration-300 flex flex-col gap-2.5 cursor-pointer select-none border
                ${active 
                    ? `${activeClass} -translate-y-0.5` 
                    : `${inactiveBgClass} shadow-sm hover:-translate-y-0.5 hover:shadow-md`}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className={`p-1.5 rounded-lg transition-colors ${iconBg}`}>
                    <Icon size={16} className={iconColor} />
                </div>
                <span className="text-2xl font-black text-slate-900 tracking-tight">{String(value || 0).padStart(2, '0')}</span>
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider truncate text-slate-900 animate-fade-in" title={label}>{label}</p>
                <p className={`text-[9px] font-extrabold mt-0.5 truncate ${subColor || 'text-slate-405'}`} title={sub}>{sub}</p>
            </div>
        </div>
    );
};

const IconMap = {
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, Globe
};

function SearchableSelect({ value, options, placeholder, onChange, onAddNew, addNewLabel, direction = 'down', size = 'md' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => {
    const label = typeof opt === 'object' ? opt.label : opt;
    return label?.toLowerCase().includes(search.toLowerCase());
  });

  const selectedOption = options.find(opt => {
    const val = typeof opt === 'object' ? opt.value : opt;
    return val !== undefined && val !== null && value !== undefined && value !== null && String(val) === String(value);
  });

  const getLabel = (opt) => typeof opt === 'object' ? opt.label : opt;
  const getValue = (opt) => typeof opt === 'object' ? opt.value : opt;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`w-full bg-white border border-slate-200 rounded-xl px-4 outline-none focus-within:border-slate-800 focus-within:ring-4 focus-within:ring-slate-200/50 transition-all flex items-center justify-between cursor-pointer ${
          size === 'sm' ? 'py-1.5 text-xs h-[38px]' : 'py-3 text-sm'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium'}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
          size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'
        }`} />
      </div>

      {isOpen && (
        <div className={`absolute z-[100] w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 ${
          direction === 'up' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'
        }`}>
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-0"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, i) => (
                <div
                  key={typeof opt === 'object' ? (opt.value || opt.label || i) : opt}
                  className={`px-4 py-2 hover:bg-slate-50 cursor-pointer transition ${
                    size === 'sm' ? 'text-xs' : 'text-sm'
                  } ${value !== undefined && value !== null && String(value) === String(getValue(opt)) ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-slate-900' : 'text-slate-600'}`}
                  onClick={() => {
                    onChange(getValue(opt));
                    setIsOpen(false);
                  }}
                >
                  {getLabel(opt)}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-slate-400 text-center italic">No results found</div>
            )}

            {onAddNew && (
              <div
                className="p-2 border-t border-slate-50 bg-slate-50/50"
                onClick={() => {
                  onAddNew(search);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-800 hover:text-slate-950 bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer transition active:scale-95">
                  <PlusCircle className="w-4 h-4 text-slate-900" />
                  {addNewLabel} {search && <span className="text-slate-400 font-normal">"{search}"</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
    const [selectedSubStatusFilter, setSelectedSubStatusFilter] = useState(null);
    const [isGlobalModalOpen, setIsGlobalModalOpen] = useState(false);

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
    const [inlineFeedbackValue, setInlineFeedbackValue] = useState('');
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);
    const [focusedValue, setFocusedValue] = useState('');

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

    // Dropdown Data
    const [clients, setClients] = useState([]);
    const [staff, setStaff] = useState([]);
    const [workTypes, setWorkTypes] = useState([]);

    // Multi-row state
    const [formName, setFormName] = useState('');
    const [rows, setRows] = useState([]);
    const [schema, setSchema] = useState([]); // Array of field objects

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [taskRes, clientsRes, staffRes, workTypesRes, rolesRes] = await Promise.all([
                api.get(`/ca/tasks/${id}`),
                api.get('/ca/clients', { params: { per_page: 100 } }),
                api.get('/ca/staff', { params: { per_page: 100 } }),
                api.get('/ca/work-types'),
                api.get('/ca/roles')
            ]);

            const data = taskRes.data.data;
            setTask(data);
            setGlobalStatus(data.status || 'assigned');
            setGlobalRemarks(data.remarks || '');
            setCaFeedback(data.dynamic_fields?.['CA Feedback'] || '');
            setCaRating(data.dynamic_fields?.['CA Rating'] || '');
            setInlineFeedbackValue(data.dynamic_fields?.['CA Feedback'] || '');
            setFormName(data.form_name || 'Untitled Form');
            setClients(clientsRes.data.data);
            setStaff(staffRes.data.data);
            setWorkTypes(workTypesRes.data.data);
            setAvailableRoles(rolesRes.data.data || []);
            setSheetPermissions(data.permissions || []);
            setAllowAttachments(!!data.allow_attachments);

            if (data.dynamic_fields?.schema) {
                setSchema(data.dynamic_fields.schema);
                setRows(data.dynamic_fields.multi_rows || []);
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

                if (data.dynamic_fields?.multi_rows) {
                    setRows(data.dynamic_fields.multi_rows);
                } else {
                    const initialRow = {
                        client_id: data.client?.id || '',
                        work_type_id: data.work_type?.id || '',
                        allocated_to: data.allocated_to?.id || '',
                        date_allocated: data.date_allocated || '',
                        status: data.status || 'assigned',
                        dynamic_data: data.dynamic_fields || {}
                    };
                    setRows([initialRow]);
                }
            }
        } catch (e) {
            toast.error('Error loading dashboard data');
            navigate('/ca/tasks');
        } finally {
            setLoading(false);
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
    };

    const addRow = () => {
        const newRow = {
            client_id: '',
            work_type_id: rows[0]?.work_type_id || '',
            allocated_to: '',
            date_allocated: new Date().toISOString().split('T')[0],
            status: 'assigned',
            dynamic_data: schema.reduce((acc, f) => ({ ...acc, [f.label]: '' }), {})
        };
        setRows([...rows, newRow]);
        setIsEditing(true);
    };

    const removeRow = (index) => {
        if (rows.length <= 1) {
            toast.error("At least one row is required.");
            return;
        }
        const newRows = [...rows];
        newRows.splice(index, 1);
        setRows(newRows);
    };

    const updateRow = (index, field, value) => {
        const newRows = [...rows];
        newRows[index][field] = value;
        setRows(newRows);
    };

    const updateDynamic = (index, key, value) => {
        const newRows = [...rows];
        newRows[index].dynamic_data[key] = value;
        setRows(newRows);
    };

    const handleUpdateGlobal = async () => {
        setSaving(true);
        try {
            const updatedDynamicFields = {
                ...(task.dynamic_fields || {}),
                'CA Feedback': caFeedback,
                'CA Rating': caRating
            };

            await api.patch(`/ca/tasks/${id}`, {
                status: globalStatus,
                remarks: globalRemarks,
                dynamic_fields: updatedDynamicFields,
                permissions: sheetPermissions,
                allow_attachments: allowAttachments
            });

            setTask(prev => ({
                ...prev,
                status: globalStatus,
                remarks: globalRemarks,
                dynamic_fields: updatedDynamicFields,
                permissions: sheetPermissions,
                allow_attachments: allowAttachments
            }));
            toast.success('Global controls updated successfully');
            setIsGlobalModalOpen(false);
        } catch (e) {
            toast.error('Failed to update sheet controls');
        } finally {
            setSaving(false);
        }
    };
    const handleUpdateSingleDynamicField = async (key, val) => {
        try {
            const updatedDynamicFields = {
                ...(task.dynamic_fields || {}),
                [key]: val
            };

            await api.patch(`/ca/tasks/${id}`, {
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
            const payload = {
                client_id: updates.client_id !== undefined ? updates.client_id : (task.client?.id || null),
                work_type_id: updates.work_type_id !== undefined ? updates.work_type_id : (task.work_type?.id || null),
                allocated_to: updates.allocated_to !== undefined ? updates.allocated_to : (task.allocated_to?.id || null),
                date_allocated: updates.date_allocated !== undefined ? updates.date_allocated : task.date_allocated,
                form_name: updates.form_name !== undefined ? updates.form_name : task.form_name,
                status: updates.status !== undefined ? updates.status : task.status,
                dynamic_fields: updates.dynamic_fields !== undefined ? updates.dynamic_fields : task.dynamic_fields
            };

            const res = await api.patch(`/ca/tasks/${id}`, payload);
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
    const handleAddSubTask = async () => {
        try {
            const res = await api.post(`/ca/tasks/${id}/sub-tasks`, { title: 'New Subtask' });
            setTask(prev => ({
                ...prev,
                sub_tasks: [...(prev.sub_tasks || []), res.data.data]
            }));
            toast.success('Subtask added');
        } catch (e) {
            toast.error('Failed to add subtask');
        }
    };

    const handleUpdateSubTask = async (subTaskId, data) => {
        try {
            const res = await api.patch(`/ca/tasks/${id}/sub-tasks/${subTaskId}`, data);
            setTask(prev => ({
                ...prev,
                sub_tasks: prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st)
            }));
        } catch (e) {
            toast.error('Failed to update subtask');
        }
    };

    const handleDeleteSubTask = (subTaskId) => {
        setConfirmState({
            open: true,
            title: 'Delete Task',
            message: 'Are you sure you want to delete this subtask? This action cannot be undone.',
            confirmLabel: 'Delete Task',
            danger: true,
            onConfirm: async () => {
                setConfirmState(prev => ({ ...prev, loading: true }));
                try {
                    await api.delete(`/ca/tasks/${id}/sub-tasks/${subTaskId}`);
                    setTask(prev => ({
                        ...prev,
                        sub_tasks: prev.sub_tasks.filter(st => st.id !== subTaskId)
                    }));
                    setSelectedTaskIds(prev => prev.filter(tid => tid !== subTaskId));
                    toast.success('Subtask deleted');
                } catch (e) {
                    toast.error('Failed to delete subtask');
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
                    await Promise.all(selectedTaskIds.map(subTaskId => api.delete(`/ca/tasks/${id}/sub-tasks/${subTaskId}`)));
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
            const formData = new FormData();
            formData.append('screenshot', file);
            formData.append('_method', 'PATCH');

            const res = await api.post(`/ca/tasks/${id}/sub-tasks/${subTaskId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setTask(prev => ({
                ...prev,
                sub_tasks: prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st)
            }));
            toast.success("Attachment uploaded successfully!", { id: loadingToast });
        } catch (e) {
            console.error(e);
            toast.error(e.response?.data?.message || "Failed to upload attachment", { id: loadingToast });
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
                    const res = await api.patch(`/ca/tasks/${id}/sub-tasks/${subTaskId}`, { screenshot: null });
                    setTask(prev => ({
                        ...prev,
                        sub_tasks: prev.sub_tasks.map(st => st.id === subTaskId ? res.data.data : st)
                    }));
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

    const handleExport = async () => {
        try {
            const ExcelJS = await import('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet("Comprehensive Sheet Export");

            // Enable gridlines
            worksheet.views = [{ showGridLines: true }];

            // 1. Extract Dynamic Fields (excluding system keys)
            const dynamicFieldEntries = Object.entries(task.dynamic_fields || {}).filter(([label]) =>
                !['schema', 'multi_rows', 'field_names', 'field_types'].includes(label)
            );
            const dynamicHeaders = dynamicFieldEntries.map(([label]) => label);

            // 2. Define Comprehensive Headers
            const headers = [
                "SR NO",
                "Sheet ID",
                "Client Name",
                "Mobile No",
                "Work Type",
                "Form Name",
                "Date Allocated",
                "Global Status",
                "Global Remarks",
                ...dynamicHeaders,
                "Subtask ID",
                "Subtask Name",
                "Assignee",
                "Priority",
                "Subtask Status",
                "Due Date",
                "Subtask Remarks"
            ];

            const getColLetter = (colIdx) => {
                let temp = colIdx
                let letter = ''
                while (temp > 0) {
                    let modulo = (temp - 1) % 26
                    letter = String.fromCharCode(65 + modulo) + letter
                    temp = Math.floor((temp - modulo) / 26)
                }
                return letter
            }
            const endColLetter = getColLetter(headers.length)

            worksheet.mergeCells(`A1:${endColLetter}1`)
            const titleCell = worksheet.getCell('A1')
            titleCell.value = `Sheet Complete Export: ${task.client?.name || 'Sheet'} - ${task.form_name || ''}`
            titleCell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 }
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.mergeCells(`A2:${endColLetter}2`)
            const dateCell = worksheet.getCell('A2')
            dateCell.value = `Generated at: ${new Date().toLocaleString()}`
            dateCell.font = { name: 'Segoe UI', italic: true, color: { argb: 'FFFFFFFF' }, size: 10 }
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1F5C99' }
            }
            dateCell.alignment = { vertical: 'middle', horizontal: 'center' }

            worksheet.getRow(1).height = 30
            worksheet.getRow(2).height = 20

            // Skip row 3

            // Write headers row
            const headerRow = worksheet.getRow(4);
            headerRow.values = headers;
            headerRow.height = 28;

            headerRow.eachCell((cell) => {
                cell.font = { name: 'Segoe UI', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF154673' } // Dark blue
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            // 3. Helper for value formatting
            const formatVal = (val) => {
                if (Array.isArray(val)) return val.join(', ');
                if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                return val || 'N/A';
            };

            // 4. Shared Task-Level Data for every row
            const baseData = [
                task.id || '',
                task.client?.name || 'N/A',
                task.client?.contact || 'N/A',
                task.work_type?.name || 'N/A',
                task.form_name || 'N/A',
                formatDate(task.date_allocated),
                globalStatus || 'N/A',
                globalRemarks || '',
                ...dynamicFieldEntries.map(([, val]) => formatVal(val))
            ];

            // 5. Generate Rows (one per subtask)
            if (task.sub_tasks && task.sub_tasks.length > 0) {
                task.sub_tasks.forEach((st, index) => {
                    worksheet.addRow([
                        index + 1,
                        ...baseData,
                        st.id || '',
                        st.title,
                        st.assigned_to?.name || 'Unassigned',
                        st.priority,
                        st.status_label || st.status,
                        formatDate(st.due_date),
                        st.remarks || ''
                    ]);
                });
            } else {
                // Row for task with no subtasks
                worksheet.addRow([
                    1,
                    ...baseData,
                    '',
                    'No Subtasks',
                    'N/A',
                    'N/A',
                    'N/A',
                    'N/A',
                    'N/A'
                ]);
            }

            // 6. Style data rows
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 4) {
                    row.eachCell((cell) => {
                        cell.font = { name: 'Segoe UI', size: 10 };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        };
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    });
                }
            });

            // 7. Automatic column resizing
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, (cell) => {
                    if (cell.row > 3) {
                        const columnLength = cell.value ? cell.value.toString().length : 10;
                        if (columnLength > maxLength) {
                            maxLength = columnLength;
                        }
                    }
                });
                column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
            });

            // 8. Generate and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${task.client?.name || 'Sheet'}_Complete_Export_${new Date().toISOString().substring(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('Comprehensive Excel export completed');
        } catch (err) {
            console.error('Export Error:', err);
            toast.error('Failed to export sheet details');
        }
    };

    if (loading || !task) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    const selectedField = schema.find(f => f.id === activeFieldId);

    const subStatusOptions = getSubStatusOptions(task, schema);

    const getSubStatusCount = (subStatus) => {
        if (!task || !task.sub_tasks) return 0;
        return task.sub_tasks.filter(st => {
            if (subStatus === 'Unassigned') {
                return !st.sub_status;
            }
            return st.sub_status === subStatus;
        }).length;
    };

    const statusFilterMap = {
        'Pending': 'pending',
        'Work In Progress': 'work_in_progress',
        'Complete': 'complete',
        'Not To Be Done': 'not_to_be_done',
        'Other': 'other'
    };

    const filteredSubTasks = (task.sub_tasks || []).filter(st => {
        if (selectedStatusFilter && st.status !== selectedStatusFilter) return false;
        if (selectedSubStatusFilter) {
            if (selectedSubStatusFilter === 'Unassigned') {
                if (st.sub_status) return false;
            } else {
                if (st.sub_status !== selectedSubStatusFilter) return false;
            }
        }
        return true;
    });

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
            <div className="bg-white rounded-[2rem] border border-slate-100/80 py-3.5 px-6 md:py-4.5 md:px-8 shadow-sm space-y-3 animate-fade-in relative overflow-hidden">
                {/* Decorative background gradients for premium SaaS feel */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50/20 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

                {/* Top Row: Breadcrumbs and Info Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
                    <nav className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        <Link to="/ca/tasks" className="hover:text-indigo-650 transition flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Sheets
                        </Link>
                        <ChevronRight size={10} className="text-slate-350" />
                        {task.work_type && (
                            <>
                                <Link to={`/ca/tasks?work_type_id=${task.work_type.id}`} className="hover:text-indigo-650 transition">
                                    {task.work_type.name}
                                </Link>
                                <ChevronRight size={10} className="text-slate-350" />
                            </>
                        )}
                        <span className="text-slate-800 font-extrabold max-w-[200px] truncate">{task.form_name || 'View Sheet'}</span>
                    </nav>

                    {/* Small Pulsing Glass Status Badge */}
                    <div className="self-start sm:self-auto bg-indigo-50/50 border border-indigo-100/60 text-indigo-650 px-3 py-1 rounded-full text-[9px] font-extrabold tracking-widest uppercase flex items-center gap-1.5 shadow-sm">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
                        </span>
                        Form Workspace
                    </div>
                </div>

                {/* Main Row: Back Button, Title, and Action Toolbar */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-2 border-t border-slate-50 relative z-10">
                    {/* Left: Sleek Back + App Icon + Title */}
                    <div className="flex items-center gap-4 min-w-0">
                        <button 
                            onClick={() => navigate('/ca/tasks')} 
                            className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-indigo-600 transition flex items-center justify-center shrink-0 shadow-sm hover:shadow"
                            title="Back to Sheets"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10 shrink-0">
                            <Layout size={18} />
                        </div>

                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-2">
                                {isEditing ? (
                                    <input
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        className="bg-transparent border-b-2 border-indigo-600 outline-none focus:border-indigo-700 transition min-w-[280px]"
                                        placeholder="Form Name"
                                    />
                                ) : (
                                    formName
                                )}
                            </h1>
                        </div>
                    </div>

                    {/* Right: Elegant action buttons bar */}
                    <div className="flex flex-wrap items-center gap-2.5 select-none">
                        {/* Secondary Actions Group (Colors always visible) */}
                        <div className="flex flex-wrap items-center gap-2">
                            <button 
                                onClick={handleExport} 
                                className="flex items-center gap-1.5 text-emerald-750 bg-emerald-50/75 hover:bg-emerald-100/80 border border-emerald-200/50 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95 duration-200"
                            >
                                <FileDown size={14} className="text-emerald-600" /> 
                                <span>Export Excel</span>
                            </button>
                            <button 
                                onClick={() => setIsGlobalModalOpen(true)}
                                className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/75 hover:bg-indigo-100/80 border border-indigo-200/50 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95 duration-200"
                            >
                                <Sliders size={14} className="text-indigo-500" />
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
                                        subtasks: (task.sub_tasks || []).map(st => ({
                                            title: st.title,
                                            assigned_to: st.assigned_to?.id,
                                            priority: st.priority,
                                            status: st.status,
                                            due_date: st.due_date,
                                            remarks: st.remarks
                                        }))
                                    };
                                    navigate('/ca/tasks/builder', { state: { duplicateData, isEditing: true, taskId: task.id } });
                                }}
                                className="flex items-center gap-1.5 text-violet-750 bg-violet-50/75 hover:bg-violet-100/80 border border-violet-200/50 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-sm active:scale-95 duration-200"
                            >
                                <Edit2 size={14} className="text-violet-600" /> 
                                <span>Layout Builder</span>
                            </button>
                        </div>

                        {/* Primary action removed as requested */}
                    </div>
                </div>
            </div>

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
                                className="p-2 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto space-y-8 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Global Status */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-400">
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
                                    <div className="flex items-center gap-2 text-slate-400">
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

                                {/* Global Remarks */}
                                <div className="space-y-3 md:col-span-2">
                                    <div className="flex items-center gap-2 text-slate-400">
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
                            <div className="pt-8 border-t border-slate-100 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Roles & Permissions Configuration</h3>
                                </div>
                                <p className="text-xs text-slate-400 font-semibold mb-4">
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
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-lg h-[38px] shrink-0"
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
                                        <p className="text-xs text-slate-400 font-semibold">No role permissions configured. This sheet will be open to all staff.</p>
                                    </div>
                                )}
                            </div>
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
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white px-5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                            >
                                <Save size={14} />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Subtask Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-3 -m-3 animate-fade-in">
                {[
                    { label: 'Pending', count: task.sub_tasks?.filter(st => st.status === 'pending').length || 0, icon: CircleDashed, iconBg: 'bg-amber-50', iconColor: 'text-amber-500', sub: 'Waiting to start', subColor: 'text-amber-500 font-semibold', active: selectedStatusFilter === 'pending', filterVal: 'pending' },
                    { label: 'Work In Progress', count: task.sub_tasks?.filter(st => st.status === 'work_in_progress').length || 0, icon: Clock, iconBg: 'bg-blue-50', iconColor: 'text-blue-500', sub: 'Currently active', subColor: 'text-blue-500 font-semibold', active: selectedStatusFilter === 'work_in_progress', filterVal: 'work_in_progress' },
                    { label: 'Complete', count: task.sub_tasks?.filter(st => st.status === 'complete').length || 0, icon: CheckCircle2, iconBg: 'bg-green-50', iconColor: 'text-green-500', sub: 'Completed successfully', subColor: 'text-green-500 font-semibold', active: selectedStatusFilter === 'complete', filterVal: 'complete' },
                    { label: 'Not To Be Done', count: task.sub_tasks?.filter(st => st.status === 'not_to_be_done').length || 0, icon: Circle, iconBg: 'bg-red-50', iconColor: 'text-red-500', sub: 'Cancelled / Skipped', subColor: 'text-red-500 font-semibold', active: selectedStatusFilter === 'not_to_be_done', filterVal: 'not_to_be_done' },
                    { label: 'Other', count: task.sub_tasks?.filter(st => st.status === 'other').length || 0, icon: Sliders, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'Other status', subColor: 'text-slate-500', active: selectedStatusFilter === 'other', filterVal: 'other' },
                    { label: 'Total Tasks', count: task.sub_tasks?.length || 0, icon: FileText, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'All subtasks of this sheet', subColor: 'text-slate-500', active: !selectedStatusFilter, filterVal: null }
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

            {/* Sub-status Filter Cards */}
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
                                className="text-[10px] font-extrabold text-indigo-650 hover:text-indigo-850 transition"
                            >
                                • Clear all filters
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 p-3 -m-3">
                    {[
                        { label: 'All Sub Statuses', count: task.sub_tasks?.length || 0, value: null, icon: Zap, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500', sub: 'Show all subtasks', subColor: 'text-indigo-500 font-semibold' },
                        { label: 'Unassigned', count: getSubStatusCount('Unassigned'), value: 'Unassigned', icon: UserPlus, iconBg: 'bg-slate-50', iconColor: 'text-slate-500', sub: 'Not allocated to anyone', subColor: 'text-slate-500' },
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
                                count: getSubStatusCount(opt),
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
            {/* Sheet Information Table (Excel/Spreadsheet style row) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 animate-fade-in mt-6">
                <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/10 shrink-0">
                            <FileText size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Sheet Information</h2>
                            <p className="text-[10px] text-slate-400 font-bold tracking-wide mt-0.5">Spreadsheet metadata & custom variables</p>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1F5C99] border-b border-[#154673] text-white text-[10px] font-black uppercase tracking-widest">
                                <th className="px-6 py-4 text-center border-r border-[#154673] w-16 text-white bg-[#1F5C99]">#</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[200px] text-white">Sheet Name</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[220px] text-white">Client</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[180px] text-white">Work Type</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[220px] text-white">Assigned To</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[150px] text-white">Create Date</th>
                                <th className="px-6 py-4 border-r border-[#154673] min-w-[180px] text-white">Sheet Status</th>
                                {/* Dynamic Field Headers */}
                                {schema.filter(f => !['static_form_name', 'static_client_name', 'static_work_type', 'static_assignee', 'static_created_date', 'static_sheet_status', 'static_entry_date', 'static_task_particular', 'static_due_date', 'static_task_status', 'static_sub_status', 'static_feedback'].includes(f.id)).map(f => (
                                    <th key={f.id} className="px-6 py-4 border-r border-[#154673] min-w-[200px] text-white">{f.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 text-slate-700 text-xs">
                            <tr key={task.id} className="hover:bg-slate-50/30 transition group">
                                {/* # column */}
                                <td className="px-6 py-4 text-center font-bold text-slate-400 border-r border-slate-200 bg-slate-50/40">
                                    01
                                </td>

                                {/* Sheet Name column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={task.form_name || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setTask(prev => ({ ...prev, form_name: val }));
                                            }}
                                            onFocus={(e) => setFocusedValue(e.target.value)}
                                            onBlur={(e) => {
                                                if (e.target.value !== focusedValue) {
                                                    handleUpdateTaskFields({ form_name: e.target.value });
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.target.blur();
                                                }
                                            }}
                                            placeholder="Sheet Name..."
                                            className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 w-full outline-none transition"
                                        />
                                    </div>
                                </td>

                                {/* Client column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <select
                                        value={task.client?.id || ''}
                                        onChange={(e) => {
                                            handleUpdateTaskFields({ client_id: e.target.value || null });
                                        }}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full"
                                    >
                                        <option value="">— Select Client —</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </td>

                                {/* Work Type column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <select
                                        value={task.work_type?.id || ''}
                                        onChange={(e) => {
                                            handleUpdateTaskFields({ work_type_id: e.target.value || null });
                                        }}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full"
                                    >
                                        <option value="">— Select Work Type —</option>
                                        {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </td>

                                {/* Assigned To column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <select
                                        value={task.allocated_to?.id || ''}
                                        onChange={(e) => {
                                            handleUpdateTaskFields({ allocated_to: e.target.value || null });
                                        }}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full"
                                    >
                                        <option value="">— Select Assigned To —</option>
                                        {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </td>

                                {/* Create Date column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <input
                                        type="date"
                                        value={task.date_allocated || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTask(prev => ({ ...prev, date_allocated: val }));
                                        }}
                                        onFocus={(e) => setFocusedValue(e.target.value)}
                                        onBlur={(e) => {
                                            if (e.target.value !== focusedValue) {
                                                handleUpdateTaskFields({ date_allocated: e.target.value });
                                            }
                                        }}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full"
                                    />
                                </td>

                                {/* Sheet Status column */}
                                <td className="px-6 py-4 border-r border-slate-200">
                                    <select
                                        value={task.status || ''}
                                        onChange={(e) => {
                                            handleUpdateTaskFields({ status: e.target.value });
                                        }}
                                        className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer capitalize w-full"
                                    >
                                        <option value="complete">Complete</option>
                                        <option value="work_in_progress">Work In Progress</option>
                                        <option value="pending">Pending</option>
                                        <option value="not_to_be_done">Not To Be Done</option>
                                        <option value="other">Other</option>
                                    </select>
                                </td>

                                {/* Dynamic Columns */}
                                {schema.filter(f => !['static_form_name', 'static_client_name', 'static_work_type', 'static_assignee', 'static_created_date', 'static_sheet_status', 'static_entry_date', 'static_task_particular', 'static_due_date', 'static_task_status', 'static_sub_status', 'static_feedback'].includes(f.id)).map(field => {
                                    const value = task.dynamic_fields?.[field.label] ?? '';
                                    const isDropdown = field.type === 'dropdown';
                                    const isCheckbox = field.type === 'checkbox';
                                    const isDate = field.type === 'date';
                                    const isRating = field.label === 'CA Rating';
                                    const isFeedback = field.label === 'CA Feedback';
                                    const isProgressAuto = field.type === 'progress_auto';
                                    const isProgressManual = field.type === 'progress_manual';
                                    const isTime = field.type === 'time';

                                    return (
                                        <td key={field.id} className="px-6 py-4 border-r border-slate-200">
                                            {isRating ? (
                                                <div className="flex items-center gap-0.5 text-amber-500 text-base leading-none">
                                                    {Array.from({ length: 5 }).map((_, i) => {
                                                        const starNum = i + 1;
                                                        const isFilled = starNum <= parseInt(value || '0');
                                                        return (
                                                            <button 
                                                                key={i} 
                                                                type="button"
                                                                onClick={() => {
                                                                    const nextDynamicFields = {
                                                                        ...(task.dynamic_fields || {}),
                                                                        'CA Rating': String(starNum)
                                                                    };
                                                                    handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                                }}
                                                                className={`transition-all hover:scale-125 ${isFilled ? 'text-amber-500 font-bold' : 'text-slate-200 hover:text-amber-400'}`}
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
                                                    {isEditingFeedbackInline ? (
                                                        <div className="flex items-center gap-2 w-full min-w-[200px]">
                                                            <input 
                                                                type="text" 
                                                                value={inlineFeedbackValue} 
                                                                onChange={e => setInlineFeedbackValue(e.target.value)}
                                                                onBlur={() => {
                                                                    setIsEditingFeedbackInline(false);
                                                                    const nextDynamicFields = {
                                                                        ...(task.dynamic_fields || {}),
                                                                        'CA Feedback': inlineFeedbackValue
                                                                    };
                                                                    handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                                }}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        setIsEditingFeedbackInline(false);
                                                                        const nextDynamicFields = {
                                                                            ...(task.dynamic_fields || {}),
                                                                            'CA Feedback': inlineFeedbackValue
                                                                        };
                                                                        handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                                    }
                                                                }}
                                                                autoFocus
                                                                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 w-full focus:bg-white focus:border-indigo-500 outline-none transition"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            onClick={() => {
                                                                setInlineFeedbackValue(value || '');
                                                                setIsEditingFeedbackInline(true);
                                                            }}
                                                            className="cursor-pointer hover:bg-slate-50 px-2 py-1 -ml-2 rounded-lg transition-all flex items-center gap-2 text-slate-700 min-h-[28px] group min-w-[150px]"
                                                            title="Click to Edit Feedback"
                                                        >
                                                            <span>{value || <span className="text-slate-300 italic font-medium">Click to add feedback...</span>}</span>
                                                            <Edit2 size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100" />
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
                                                            badgeBg = 'bg-indigo-50 border-indigo-100 text-indigo-650';
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

                                                        const handleManualSave = (val) => {
                                                            const nextDynamicFields = {
                                                                ...(task.dynamic_fields || {}),
                                                                [field.label]: String(val)
                                                            };
                                                            handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                        };

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
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            setTask(prev => ({
                                                                                ...prev,
                                                                                dynamic_fields: {
                                                                                    ...(prev.dynamic_fields || {}),
                                                                                    [field.label]: String(val)
                                                                                }
                                                                            }));
                                                                        }}
                                                                        onMouseUp={(e) => handleManualSave(e.target.value)}
                                                                        onTouchEnd={(e) => handleManualSave(e.target.value)}
                                                                        className="w-full h-3 rounded-full appearance-none cursor-pointer focus:outline-none transition-all outline-none shadow-inner border border-slate-200/20"
                                                                        style={{
                                                                            background: `linear-gradient(to right, ${parsedVal < 40 ? '#f43f5e, #f59e0b' : parsedVal < 90 ? '#3b82f6, #4f46e5' : '#10b981, #14b8a6'} ${parsedVal}%, #f1f5f9 ${parsedVal}%)`
                                                                        }}
                                                                    />
                                                                </div>

                                                                {/* Quick adjust pills */}
                                                                <div className="flex gap-1 mt-1 justify-between select-none">
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
                                                                                    
                                                                                    setTask(prev => ({
                                                                                        ...prev,
                                                                                        dynamic_fields: {
                                                                                            ...(prev.dynamic_fields || {}),
                                                                                            [field.label]: String(nextVal)
                                                                                        }
                                                                                    }));
                                                                                    
                                                                                    handleManualSave(nextVal);
                                                                                }}
                                                                                className="text-[8px] font-black tracking-widest uppercase bg-slate-50 hover:bg-slate-100 border border-slate-200/50 hover:border-slate-350 text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded-md transition duration-150 active:scale-90"
                                                                            >
                                                                                {pillLabel}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>

                                                                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mt-1 select-none">
                                                                    <span className="flex items-center gap-0.5 font-extrabold text-slate-400">
                                                                        <Clock size={9} className="text-slate-350" />
                                                                        Updated: Just now
                                                                    </span>
                                                                    <span className="text-[8px] font-black uppercase text-indigo-500/80 tracking-wider">
                                                                        Adjustable
                                                                    </span>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            ) : isDropdown ? (
                                                <select
                                                    value={value || ''}
                                                    onChange={(e) => {
                                                        const nextDynamicFields = {
                                                            ...(task.dynamic_fields || {}),
                                                            [field.label]: e.target.value
                                                        };
                                                        handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                    }}
                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-[150px]"
                                                >
                                                    <option value="">Select Option</option>
                                                    {(field.options || []).map((opt, i) => {
                                                         const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                         const optLbl = typeof opt === 'object' ? opt.label : opt;
                                                         return (
                                                             <option key={typeof opt === 'object' ? (opt.value || opt.label || i) : opt} value={optVal}>
                                                                 {optLbl}
                                                             </option>
                                                         );
                                                     })}
                                                </select>
                                            ) : isCheckbox ? (
                                                <div className="flex flex-wrap gap-2.5 min-w-[160px]">
                                                    {(field.options || []).map(opt => {
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
                                                                            nextVals = [...selectedValues, optVal];
                                                                        } else {
                                                                            nextVals = selectedValues.filter(v => v !== optVal);
                                                                        }
                                                                        const nextDynamicFields = {
                                                                            ...(task.dynamic_fields || {}),
                                                                            [field.label]: nextVals
                                                                        };
                                                                        handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                                    }}
                                                                    className="w-3.5 h-3.5 rounded text-indigo-650 focus:ring-indigo-500/20 border-slate-300 cursor-pointer"
                                                                />
                                                                <span>{optLbl}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            ) : isDate ? (
                                                <input
                                                    type="date"
                                                    value={value || ''}
                                                    onChange={(e) => {
                                                        const nextDynamicFields = {
                                                            ...(task.dynamic_fields || {}),
                                                            [field.label]: e.target.value
                                                        };
                                                        handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                    }}
                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-[140px]"
                                                />
                                            ) : isTime ? (
                                                <input
                                                    type="time"
                                                    value={value || ''}
                                                    onChange={(e) => {
                                                        const nextDynamicFields = {
                                                            ...(task.dynamic_fields || {}),
                                                            [field.label]: e.target.value
                                                        };
                                                        handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                    }}
                                                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-650 transition focus:ring-2 focus:ring-indigo-500/20 focus:outline-none cursor-pointer w-full min-w-[140px]"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-between group/cell w-full">
                                                    <input
                                                         type="text"
                                                         value={value || ''}
                                                         onChange={(e) => {
                                                             const val = e.target.value;
                                                             setTask(prev => ({
                                                                 ...prev,
                                                                 dynamic_fields: {
                                                                     ...(prev.dynamic_fields || {}),
                                                                     [field.label]: val
                                                                 }
                                                             }));
                                                         }}
                                                         onFocus={(e) => setFocusedValue(e.target.value)}
                                                         onBlur={(e) => {
                                                             if (e.target.value !== focusedValue) {
                                                                 const nextDynamicFields = {
                                                                     ...(task.dynamic_fields || {}),
                                                                     [field.label]: e.target.value
                                                                 };
                                                                 handleUpdateTaskFields({ dynamic_fields: nextDynamicFields });
                                                             }
                                                         }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.target.blur();
                                                            }
                                                        }}
                                                        placeholder={field.placeholder || `Enter ${field.label}...`}
                                                        className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-slate-350 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 w-full min-w-[160px] outline-none transition"
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
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Tasks Section */}
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
                    {selectedTaskIds.length > 0 && (
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
                <div className="overflow-x-auto min-h-[300px]">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-[#1F5C99] border-b border-[#154673] text-white text-[10px] font-black uppercase tracking-widest">
                                <th className="px-6 py-4 text-center w-12 min-w-[48px] text-white bg-[#1F5C99]">
                                    <input
                                        type="checkbox"
                                        checked={filteredSubTasks.length > 0 && filteredSubTasks.every(st => selectedTaskIds.includes(st.id))}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                const newSelected = [...new Set([...selectedTaskIds, ...filteredSubTasks.map(st => st.id)])];
                                                setSelectedTaskIds(newSelected);
                                            } else {
                                                const filteredIds = filteredSubTasks.map(st => st.id);
                                                setSelectedTaskIds(prev => prev.filter(id => !filteredIds.includes(id)));
                                            }
                                        }}
                                        className="w-4 h-4 text-indigo-655 border-slate-350 rounded focus:ring-indigo-500/20 cursor-pointer"
                                    />
                                </th>
                                <th className="px-6 py-4 text-left min-w-[280px] whitespace-nowrap text-white">Name</th>
                                <th className="px-6 py-4 text-left min-w-[180px] whitespace-nowrap text-white">Assignee</th>
                                <th className="px-6 py-4 text-left min-w-[130px] whitespace-nowrap text-white">Priority</th>
                                <th className="px-6 py-4 text-left min-w-[180px] whitespace-nowrap text-white">Status</th>
                                <th className="px-6 py-4 text-left min-w-[220px] whitespace-nowrap text-white">Sub Status</th>
                                <th className="px-6 py-4 text-left min-w-[145px] whitespace-nowrap text-white">Due date</th>
                                <th className="px-6 py-4 text-left min-w-[260px] whitespace-nowrap text-white">Remarks</th>
                                {allowAttachments && (
                                    <th className="px-6 py-4 text-center min-w-[120px] whitespace-nowrap text-white">Attachment</th>
                                )}
                                <th className="px-6 py-4 text-right w-10 min-w-[40px] text-white"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredSubTasks.length > 0 ? (
                                filteredSubTasks.map((st) => (
                                <tr key={st.id} className={`group hover:bg-slate-50/40 transition-colors ${selectedTaskIds.includes(st.id) ? 'bg-slate-50/30' : ''}`}>
                                    <td className="px-6 py-5 text-center w-12 min-w-[48px]">
                                        <input
                                            type="checkbox"
                                            checked={selectedTaskIds.includes(st.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedTaskIds(prev => [...prev, st.id]);
                                                } else {
                                                    setSelectedTaskIds(prev => prev.filter(id => id !== st.id));
                                                }
                                            }}
                                            className="w-4 h-4 text-indigo-655 border-slate-300 rounded focus:ring-indigo-500/20 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-6 py-5 min-w-[280px]">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleUpdateSubTask(st.id, { status: st.status === 'complete' ? 'work_in_progress' : 'complete' })}
                                                className={`transition-colors shrink-0 ${st.status === 'complete' ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                                            >
                                                {st.status === 'complete' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </button>
                                            <div className="flex-1 flex items-center group/title min-w-0">
                                                <input
                                                    defaultValue={st.title}
                                                    onBlur={e => handleUpdateSubTask(st.id, { title: e.target.value })}
                                                    className={`bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full truncate ${st.status === 'complete' ? 'line-through text-slate-300' : ''}`}
                                                />
                                                <button onClick={() => handleCopy(st.title)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/title:opacity-100 transition shadow-sm shrink-0" title="Copy"><Copy size={12} /></button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 min-w-[180px]">
                                        <select
                                            value={st.assigned_to?.id || ''}
                                            onChange={e => handleUpdateSubTask(st.id, { assigned_to: e.target.value })}
                                            className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer w-full"
                                        >
                                            <option value="">Unassigned</option>
                                            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-5 min-w-[130px]">
                                        <select
                                            value={st.priority}
                                            onChange={e => handleUpdateSubTask(st.id, { priority: e.target.value })}
                                            className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer w-full"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-5 min-w-[180px]">
                                        <select
                                            value={st.status}
                                            onChange={e => handleUpdateSubTask(st.id, { status: e.target.value })}
                                            className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer capitalize w-full"
                                        >
                                            <option value="complete">Complete</option>
                                            <option value="work_in_progress">Work In Progress</option>
                                            <option value="pending">Pending</option>
                                            <option value="not_to_be_done">Not To Be Done</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-5 min-w-[220px]">
                                        <select
                                            value={st.sub_status || ''}
                                            onChange={e => handleUpdateSubTask(st.id, { sub_status: e.target.value || null })}
                                            className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer w-full"
                                        >
                                            <option value="">— Set Sub Status —</option>
                                            {getSubStatusOptions(task, schema).map((opt, i) => (
                                                <option key={i} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td className="px-6 py-5 min-w-[145px]">
                                        <input
                                            type="date"
                                            defaultValue={st.due_date}
                                            onBlur={e => handleUpdateSubTask(st.id, { due_date: e.target.value })}
                                            className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 transition focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer w-full"
                                        />
                                    </td>
                                    <td className="px-6 py-5 min-w-[260px]">
                                        <div className="flex items-center group/rem w-full">
                                            <textarea
                                                defaultValue={st.remarks}
                                                onBlur={e => handleUpdateSubTask(st.id, { remarks: e.target.value })}
                                                placeholder="Remarks..."
                                                rows="1"
                                                className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded-xl px-3 py-1.8 text-xs font-semibold text-slate-700 w-full resize-y min-h-[36px] outline-none transition focus:ring-4 focus:ring-indigo-500/10 leading-relaxed"
                                            />
                                            {st.remarks && (
                                                <button onClick={() => handleCopy(st.remarks)} className="ml-1 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/rem:opacity-100 transition shadow-sm shrink-0" title="Copy"><Copy size={12} /></button>
                                            )}
                                        </div>
                                    </td>
                                    {allowAttachments && (
                                        <td className="px-6 py-5 text-center min-w-[120px]">
                                            {st.screenshot_url ? (
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        onClick={() => setPreviewImage(st.screenshot_url)}
                                                        className="inline-flex items-center justify-center p-2 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-655 border border-indigo-100/50 rounded-xl transition shadow-sm cursor-pointer"
                                                        title="View Attachment"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSubTaskAttachment(st.id)}
                                                        className="inline-flex items-center justify-center p-2 bg-rose-50 hover:bg-rose-100/80 text-rose-600 border border-rose-100/50 rounded-xl transition shadow-sm cursor-pointer"
                                                        title="Delete Attachment"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center">
                                                    <label className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-white border border-slate-200 border-dashed hover:border-slate-350 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-650 transition cursor-pointer select-none">
                                                        <Plus size={10} />
                                                        <span>Attach</span>
                                                        <input
                                                            type="file"
                                                            onChange={(e) => handleUploadSubTaskAttachment(st.id, e.target.files[0])}
                                                            className="hidden"
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    <td className="px-6 py-5 text-right w-10 min-w-[40px]">
                                        <button onClick={() => handleDeleteSubTask(st.id)} className="p-2 text-rose-600 bg-rose-50/70 border border-rose-100/40 hover:bg-rose-100 hover:text-rose-800 hover:scale-110 active:scale-95 opacity-0 group-hover:opacity-100 transition-all rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={allowAttachments ? 10 : 9} className="px-10 py-16 text-center text-slate-400 text-xs italic font-bold">
                                    No tasks match the selected filters. Click "Clear all filters" or select another card to see all items.
                                </td>
                            </tr>
                        )}
                            <tr className="hover:bg-slate-50/50 transition-colors">
                                <td colSpan={allowAttachments ? 10 : 9} className="px-10 py-4">
                                    <button
                                        onClick={handleAddSubTask}
                                        className="flex items-center gap-2 text-slate-400 hover:text-indigo-600 text-sm font-bold transition-colors"
                                    >
                                        <Plus size={16} /> Add Task
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

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
        </div>
    );
}
