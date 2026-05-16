import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ChevronLeft, Save, Edit2, X, CheckCircle, Plus, Trash2, Layout, Search,
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, AlertCircle, GripVertical, Settings,
    Flag, UserPlus, CheckCircle2, Circle, MoreHorizontal, FileDown, Eye, Copy, ChevronRight
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import StatusBadge from '../../components/ui/StatusBadge';
import { FIELD_TYPES } from '../../constants/fieldTypes';

const IconMap = {
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock
};

export default function TaskDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

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
            const [taskRes, clientsRes, staffRes, workTypesRes] = await Promise.all([
                api.get(`/ca/tasks/${id}`),
                api.get('/ca/clients', { params: { per_page: 100 } }),
                api.get('/ca/staff', { params: { per_page: 100 } }),
                api.get('/ca/work-types')
            ]);

            const data = taskRes.data.data;
            setTask(data);
            setGlobalStatus(data.status || 'assigned');
            setGlobalRemarks(data.remarks || '');
            setFormName(data.form_name || 'Untitled Form');
            setClients(clientsRes.data.data);
            setStaff(staffRes.data.data);
            setWorkTypes(workTypesRes.data.data);

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
                        client_id: data.client.id,
                        work_type_id: data.work_type.id,
                        allocated_to: data.allocated_to.id,
                        date_allocated: data.date_allocated,
                        status: data.status,
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
            options: fieldType.id === 'dropdown' ? ['Option 1', 'Option 2'] : []
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
            await api.patch(`/ca/tasks/${id}`, {
                status: globalStatus,
                remarks: globalRemarks
            });
            setTask(prev => ({ ...prev, status: globalStatus, remarks: globalRemarks }));
            toast.success('Global status and remarks updated successfully');
        } catch (e) {
            toast.error('Failed to update task controls');
        } finally {
            setSaving(false);
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

    const handleDeleteSubTask = async (subTaskId) => {
        if (!confirm('Are you sure you want to delete this subtask?')) return;
        try {
            await api.delete(`/ca/tasks/${id}/sub-tasks/${subTaskId}`);
            setTask(prev => ({
                ...prev,
                sub_tasks: prev.sub_tasks.filter(st => st.id !== subTaskId)
            }));
            toast.success('Subtask deleted');
        } catch (e) {
            toast.error('Failed to delete subtask');
        }
    };

    const handleExport = async () => {
        const XLSX = await import('xlsx');
        const data = [];

        // 1. Extract Dynamic Fields (excluding system keys)
        const dynamicFieldEntries = Object.entries(task.dynamic_fields || {}).filter(([label]) =>
            !['schema', 'multi_rows', 'field_names', 'field_types'].includes(label)
        );
        const dynamicHeaders = dynamicFieldEntries.map(([label]) => label);

        // 2. Define Comprehensive Headers
        const headers = [
            "SR NO",
            "Client Name",
            "Mobile No",
            "Work Type",
            "Form Name",
            "Date Allocated",
            "Global Status",
            "Global Remarks",
            ...dynamicHeaders, // Insert dynamic fields as columns
            "Subtask Name",
            "Assignee",
            "Priority",
            "Subtask Status",
            "Due Date",
            "Subtask Remarks"
        ];
        data.push(headers);

        // 3. Helper for value formatting
        const formatVal = (val) => {
            if (Array.isArray(val)) return val.join(', ');
            if (typeof val === 'boolean') return val ? 'Yes' : 'No';
            return val || 'N/A';
        };

        // 4. Shared Task-Level Data for every row
        const baseData = [
            task.client?.name || 'N/A',
            task.client?.contact || 'N/A',
            task.work_type?.name || 'N/A',
            task.form_name || 'N/A',
            task.date_allocated || 'N/A',
            globalStatus || 'N/A',
            globalRemarks || '',
            ...dynamicFieldEntries.map(([, val]) => formatVal(val))
        ];

        // 5. Generate Rows (one per subtask)
        if (task.sub_tasks && task.sub_tasks.length > 0) {
            task.sub_tasks.forEach((st, index) => {
                data.push([
                    index + 1,
                    ...baseData,
                    st.title,
                    st.assigned_to?.name || 'Unassigned',
                    st.priority,
                    st.status_label || st.status,
                    st.due_date || 'N/A',
                    st.remarks || ''
                ]);
            });
        } else {
            // Row for task with no subtasks
            data.push([
                1,
                ...baseData,
                'No Subtasks',
                'N/A',
                'N/A',
                'N/A',
                'N/A',
                'N/A'
            ]);
        }

        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Comprehensive Task Export");

        // Set flexible column widths
        const colWidths = headers.map(() => ({ wch: 25 }));
        colWidths[0] = { wch: 8 }; // SR NO
        ws['!cols'] = colWidths;

        XLSX.writeFile(wb, `${task.client?.name || 'Task'}_Complete_Export.xlsx`);
        toast.success('Comprehensive Excel export started');
    };

    if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    if (!task) return null;

    const selectedField = schema.find(f => f.id === activeFieldId);

    return (
        <div className="space-y-6 max-w-[100vw] overflow-x-hidden pb-12 relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                <Link to="/ca/tasks" className="hover:text-indigo-600 transition">Sheets</Link>
                <ChevronRight size={10} className="text-slate-300" />
                {task.work_type && (
                    <>
                        <Link to={`/ca/tasks?work_type_id=${task.work_type.id}`} className="hover:text-indigo-600 transition">
                            {task.work_type.name}
                        </Link>
                        <ChevronRight size={10} className="text-slate-300" />
                    </>
                )}
                <span className="text-slate-900">{task.form_name || 'View Sheet'}</span>
            </nav>

            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/ca/tasks')} className="p-2.5 hover:bg-white shadow-sm border border-slate-200 rounded-2xl transition group bg-white/50">
                        <ChevronLeft size={20} className="text-slate-400 group-hover:text-indigo-600" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Layout size={14} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em]">Form Workspace</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 mt-1">
                            {isEditing ? (
                                <input
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    className="bg-transparent border-b-2 border-indigo-500 outline-none focus:border-indigo-600 transition min-w-[300px]"
                                    placeholder="Form Name"
                                />
                            ) : (
                                formName
                            )}
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-emerald-700 transition shadow-xl shadow-emerald-100">
                        <FileDown size={18} /> Export Excel
                    </button>
                    <button onClick={() => navigate('/ca/tasks/builder')} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition shadow-sm">
                        Open Form Builder
                    </button>
                    <button onClick={handleAddSubTask} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition shadow-xl shadow-indigo-200">
                        <Plus size={18} /> New Subtask
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-8 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                    <div className="flex items-center gap-2 text-slate-500">
                        <Sliders size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Global Control Panel</span>
                    </div>
                    <button
                        onClick={handleUpdateGlobal}
                        disabled={saving}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                    >
                        <Save size={14} />
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {/* Global Status */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Circle size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Global Status</span>
                            </div>
                            <select
                                value={globalStatus}
                                onChange={e => setGlobalStatus(e.target.value)}
                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 capitalize"
                            >
                                <option value="assigned">Assigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="awaiting_information">Awaiting Information</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>

                        {/* Global Remarks */}
                        <div className="space-y-3 md:col-span-2 lg:col-span-3">
                            <div className="flex items-center gap-2 text-slate-400">
                                <AlignLeft size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Global Remarks</span>
                            </div>
                            <textarea
                                value={globalRemarks}
                                onChange={e => setGlobalRemarks(e.target.value)}
                                placeholder="Add global notes..."
                                rows="1"
                                className="w-full bg-slate-50 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Subtask Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Assigned', count: task.sub_tasks?.filter(st => st.status === 'assigned').length || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'In Progress', count: task.sub_tasks?.filter(st => st.status === 'in_progress').length || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Completed', count: task.sub_tasks?.filter(st => st.status === 'completed').length || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Total Tasks', count: task.sub_tasks?.length || 0, color: 'text-slate-600', bg: 'bg-slate-50' }
                ].map((card, i) => (
                    <div key={i} className={`${card.bg} rounded-3xl p-6 border border-white shadow-sm transition-all hover:shadow-md`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${card.color} opacity-70 mb-1`}>{card.label}</p>
                        <p className={`text-3xl font-black ${card.color}`}>{card.count}</p>
                    </div>
                ))}
            </div>

            {/* Detailed Task Information (Static & Dynamic) */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-10">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                    <h2 className="text-xl font-black text-slate-900">Form Submission Details</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-10 gap-x-12">
                    {/* Static Fields */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</label>
                        <div className="flex items-center group">
                            <p className="text-sm font-bold text-slate-700">{task.client.name}</p>
                            <button onClick={() => handleCopy(task.client.name)} className="ml-2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shadow-sm" title="Copy"><Copy size={12} /></button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work Type</label>
                        <div className="flex items-center group">
                            <p className="text-sm font-bold text-slate-700">{task.work_type.name}</p>
                            <button onClick={() => handleCopy(task.work_type.name)} className="ml-2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shadow-sm" title="Copy"><Copy size={12} /></button>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Allocated Date</label>
                        <div className="flex items-center group">
                            <p className="text-sm font-bold text-slate-700">{task.date_allocated}</p>
                            <button onClick={() => handleCopy(task.date_allocated)} className="ml-2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shadow-sm" title="Copy"><Copy size={12} /></button>
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    {task.dynamic_fields && Object.entries(task.dynamic_fields).map(([label, value]) => {
                        // Skip system keys
                        if (['schema', 'multi_rows', 'field_names', 'field_types'].includes(label)) return null;

                        return (
                            <div key={label} className="space-y-1 group">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                                <div className="flex items-center">
                                    <p className="text-sm font-bold text-slate-700">
                                        {Array.isArray(value) ? value.join(', ') : (typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value || 'N/A'))}
                                    </p>
                                    {value && typeof value !== 'boolean' && (
                                        <button
                                            onClick={() => handleCopy(Array.isArray(value) ? value.join(', ') : value.toString())}
                                            className="ml-2 p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition shadow-sm"
                                            title="Copy"
                                        >
                                            <Copy size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Subtasks Section */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-900">Subtasks</h2>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full">
                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-500"
                                    style={{ width: `${(task.sub_tasks?.filter(st => st.status === 'completed').length / (task.sub_tasks?.length || 1)) * 100}%` }}
                                ></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400">
                                {task.sub_tasks?.filter(st => st.status === 'completed').length}/{task.sub_tasks?.length || 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="px-10 py-4 text-left min-w-[300px]">Name</th>
                                <th className="px-6 py-4 text-left">Assignee</th>
                                <th className="px-6 py-4 text-left">Priority</th>
                                <th className="px-6 py-4 text-left">Status</th>
                                <th className="px-6 py-4 text-left">Due date</th>
                                <th className="px-6 py-4 text-left">Remarks</th>
                                <th className="px-6 py-4 text-center">Attachment</th>
                                <th className="px-6 py-4 text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {task.sub_tasks?.map((st) => (
                                <tr key={st.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-10 py-5 min-w-[300px]">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleUpdateSubTask(st.id, { status: st.status === 'completed' ? 'in_progress' : 'completed' })}
                                                className={`transition-colors ${st.status === 'completed' ? 'text-green-500' : 'text-slate-200 hover:text-slate-400'}`}
                                            >
                                                {st.status === 'completed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                                            </button>
                                            <div className="flex-1 flex items-center group/title">
                                                <input
                                                    defaultValue={st.title}
                                                    onBlur={e => handleUpdateSubTask(st.id, { title: e.target.value })}
                                                    className={`bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-700 w-full ${st.status === 'completed' ? 'line-through text-slate-300' : ''}`}
                                                />
                                                <button onClick={() => handleCopy(st.title)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/title:opacity-100 transition shadow-sm" title="Copy"><Copy size={12} /></button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <select
                                            value={st.assigned_to?.id || ''}
                                            onChange={e => handleUpdateSubTask(st.id, { assigned_to: e.target.value })}
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-500 cursor-pointer"
                                        >
                                            <option value="">Unassigned</option>
                                            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-6 py-5">
                                        <select
                                            value={st.priority}
                                            onChange={e => handleUpdateSubTask(st.id, { priority: e.target.value })}
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-500 cursor-pointer"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-5">
                                        <select
                                            value={st.status}
                                            onChange={e => handleUpdateSubTask(st.id, { status: e.target.value })}
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-500 cursor-pointer capitalize"
                                        >
                                            <option value="assigned">Assigned</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="awaiting_information">Awaiting Info</option>
                                            <option value="completed">Completed</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-5">
                                        <input
                                            type="date"
                                            defaultValue={st.due_date}
                                            onBlur={e => handleUpdateSubTask(st.id, { due_date: e.target.value })}
                                            className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-500 cursor-pointer"
                                        />
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center group/rem">
                                            <textarea
                                                defaultValue={st.remarks}
                                                onBlur={e => handleUpdateSubTask(st.id, { remarks: e.target.value })}
                                                placeholder="Remarks..."
                                                rows="1"
                                                className="bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-400 w-full resize-y min-h-[30px]"
                                            />
                                            {st.remarks && (
                                                <button onClick={() => handleCopy(st.remarks)} className="p-1 text-slate-300 hover:text-indigo-600 opacity-0 group-hover/rem:opacity-100 transition shadow-sm" title="Copy"><Copy size={12} /></button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        {st.screenshot_url ? (
                                            <button
                                                onClick={() => setPreviewImage(st.screenshot_url)}
                                                className="inline-flex items-center gap-1.5 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition shadow-sm"
                                                title="View Attachment"
                                            >
                                                <Eye size={14} />
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tighter">None</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button onClick={() => handleDeleteSubTask(st.id)} className="p-2 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            <tr className="hover:bg-slate-50/50 transition-colors">
                                <td colSpan={5} className="px-10 py-4">
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

                                                {field.type === 'dropdown' && (
                                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dropdown Options</label>
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

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative max-w-4xl w-full h-full flex flex-col items-center justify-center">
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-0 right-0 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all hover:scale-110 mb-4"
                            title="Close / Back"
                        >
                            <X size={24} />
                        </button>
                        <div className="bg-white p-2 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh]">
                            <img src={previewImage} alt="Screenshot Preview" className="max-w-full max-h-full object-contain rounded-2xl" />
                        </div>
                        <button
                            onClick={() => setPreviewImage(null)}
                            className="mt-8 px-8 py-3 bg-white text-slate-900 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-100 transition shadow-xl"
                        >
                            Back to Task
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
