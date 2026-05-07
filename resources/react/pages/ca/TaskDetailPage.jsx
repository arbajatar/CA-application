import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    ChevronLeft, Save, Edit2, X, CheckCircle, Plus, Trash2, Layout, Search,
    ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
    CheckSquare, Zap, Mail, Phone, Sliders, Clock, AlertCircle, GripVertical, Settings
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

    // Sidebar state
    const [sidebarMode, setSidebarMode] = useState('fields'); // 'fields' or 'settings'
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFieldId, setActiveFieldId] = useState(null);
    const [draftField, setDraftField] = useState(null);

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

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                form_name: formName,
                client_id: rows[0].client_id,
                work_type_id: rows[0].work_type_id,
                allocated_to: rows[0].allocated_to,
                date_allocated: rows[0].date_allocated,
                status: rows[0].status,
                dynamic_fields: {
                    multi_rows: rows,
                    schema: schema,
                    // Compatibility: pick first row dynamic data
                    ...rows[0].dynamic_data 
                }
            };

            await api.put(`/ca/tasks/${id}`, payload);
            toast.success('Spreadsheet updated successfully');
            setIsEditing(false);
            fetchInitialData();
        } catch (e) {
            toast.error('Failed to save spreadsheet data');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex-1 flex items-center justify-center"><Spinner /></div>;
    if (!task) return null;

    const selectedField = schema.find(f => f.id === activeFieldId);

    return (
        <div className="space-y-6 max-w-[100vw] overflow-x-hidden pb-12 relative">
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
                    {!isEditing ? (
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 transition shadow-sm">
                            <Edit2 size={16} className="text-indigo-500" /> Edit Layout
                        </button>
                    ) : (
                        <>
                            <button onClick={() => { setIsEditing(false); setIsSidebarOpen(false); }} className="px-6 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition">
                                Discard Changes
                            </button>
                            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition shadow-xl shadow-indigo-200 disabled:opacity-50">
                                {saving ? <Spinner size="sm" color="white" /> : <Save size={18} />} Update Spreadsheet
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Top Summary Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1">
                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 flex items-center gap-4 group hover:bg-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Created By</p>
                        <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{task.created_by}</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 flex items-center gap-4 group hover:bg-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Initial Date</p>
                        <p className="text-sm font-black text-slate-900 tabular-nums">{task.date_inward}</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 flex items-center gap-4 group hover:bg-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                        <Layout size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total Entries</p>
                        <p className="text-sm font-black text-slate-900 tabular-nums">{rows.length} Records</p>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-xl p-5 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 flex items-center gap-4 group hover:bg-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 group-hover:scale-110 transition-transform">
                        <Hash size={24} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Global ID</p>
                        <p className="text-sm font-black text-slate-900 tabular-nums">TASK-#{task.id.toString().padStart(5, '0')}</p>
                    </div>
                </div>
            </div>

            {/* Main Spreadsheet Container */}
            <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl shadow-slate-200/60 border border-white overflow-hidden">
                <div className="bg-slate-50/30 px-10 py-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]"></div>
                                <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-25"></div>
                            </div>
                            <span className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Data Entry Node</span>
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 shadow-sm">
                                <span className="text-indigo-500 mr-1">TYPE:</span> MULTI-ROW SPREADSHEET
                            </div>
                        </div>
                    </div>
                    {isEditing && (
                        <button 
                            onClick={() => { setSidebarMode('fields'); setIsSidebarOpen(true); }}
                            className="flex items-center gap-2.5 bg-emerald-50 text-emerald-600 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm active:scale-95"
                        >
                            <Plus size={16} /> Add New Field
                        </button>
                    )}
                </div>
                
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
                    <table className="w-full border-collapse table-auto min-w-[1400px]">
                        <thead>
                            <tr className="bg-slate-50/30">
                                <th className="w-16 px-6 py-5 border-r border-b border-slate-200 text-center">
                                    <span className="text-[10px] font-black text-slate-300">#</span>
                                </th>
                                {/* Static Headers */}
                                {['Client', 'Work Type', 'Assigned To', 'Date', 'Status'].map(h => (
                                    <th key={h} className="px-6 py-5 text-left border-r border-b border-slate-200 min-w-[220px]">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</span>
                                    </th>
                                ))}
                                {/* Dynamic Headers */}
                                {schema.map((f) => (
                                    <th 
                                        key={f.id} 
                                        onClick={() => { if (isEditing) { setActiveFieldId(f.id); setSidebarMode('settings'); setIsSidebarOpen(true); } }}
                                        className={`px-6 py-5 text-left border-r border-b border-slate-200 min-w-[200px] transition-colors cursor-pointer group/h ${activeFieldId === f.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                                    {f.label}
                                                    {f.required && <span className="text-rose-500 text-xs">*</span>}
                                                </span>
                                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-tighter mt-0.5">{f.type} field</span>
                                            </div>
                                            {isEditing && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover/h:opacity-100 transition-opacity">
                                                    <Settings size={12} className="text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                {isEditing && (
                                    <th className="w-20 px-6 py-5 border-b border-slate-200 bg-slate-50/50"></th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rows.map((row, idx) => (
                                <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                                    <td className="px-6 py-6 border-r border-slate-100 text-center align-middle">
                                        <span className="text-xs font-bold text-slate-300">{(idx + 1).toString().padStart(2, '0')}</span>
                                    </td>
                                    
                                    {/* Client Cell */}
                                    <td className="px-6 py-6 border-r border-slate-100 align-middle">
                                        {isEditing ? (
                                            <select 
                                                value={row.client_id}
                                                onChange={e => updateRow(idx, 'client_id', e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-semibold text-slate-700"
                                            >
                                                <option value="">Select Client</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="text-sm font-bold text-slate-800">{clients.find(c => c.id == row.client_id)?.name || '---'}</span>
                                        )}
                                    </td>

                                    {/* Work Type Cell */}
                                    <td className="px-6 py-6 border-r border-slate-100 align-middle">
                                        {isEditing ? (
                                            <select 
                                                value={row.work_type_id}
                                                onChange={e => updateRow(idx, 'work_type_id', e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-semibold text-slate-700"
                                            >
                                                {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="text-sm font-semibold text-slate-600">{workTypes.find(w => w.id == row.work_type_id)?.name || '---'}</span>
                                        )}
                                    </td>

                                    {/* Staff Cell */}
                                    <td className="px-6 py-6 border-r border-slate-100 align-middle">
                                        {isEditing ? (
                                            <select 
                                                value={row.allocated_to}
                                                onChange={e => updateRow(idx, 'allocated_to', e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-semibold text-slate-700"
                                            >
                                                <option value="">Select Staff</option>
                                                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        ) : (
                                            <span className="text-sm font-semibold text-slate-700">{staff.find(s => s.id == row.allocated_to)?.name || '---'}</span>
                                        )}
                                    </td>

                                    {/* Date Cell */}
                                    <td className="px-6 py-6 border-r border-slate-100 align-middle">
                                        {isEditing ? (
                                            <input 
                                                type="date"
                                                value={row.date_allocated}
                                                onChange={e => updateRow(idx, 'date_allocated', e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-semibold text-slate-700"
                                            />
                                        ) : (
                                            <span className="text-sm font-bold text-slate-500 tabular-nums">{row.date_allocated}</span>
                                        )}
                                    </td>

                                    {/* Status Cell */}
                                    <td className="px-6 py-6 border-r border-slate-100 align-middle">
                                        {isEditing ? (
                                            <select 
                                                value={row.status}
                                                onChange={e => updateRow(idx, 'status', e.target.value)}
                                                className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-semibold text-slate-700"
                                            >
                                                <option value="assigned">Assigned</option>
                                                <option value="in_progress">In Progress</option>
                                                <option value="awaiting_information">Awaiting Info</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        ) : (
                                            <StatusBadge status={row.status} />
                                        )}
                                    </td>

                                    {/* Dynamic Cells */}
                                    {schema.map((f) => (
                                        <td key={f.id} className={`px-6 py-6 border-r border-slate-100 align-middle last:border-r-0 transition-colors ${activeFieldId === f.id ? 'bg-indigo-50/20' : ''}`}>
                                            {isEditing ? (
                                                f.type === 'dropdown' ? (
                                                    <select 
                                                        value={row.dynamic_data[f.label] || ''}
                                                        onChange={e => updateDynamic(idx, f.label, e.target.value)}
                                                        className="w-full px-3 py-2.5 text-sm bg-indigo-50/30 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-medium text-slate-700"
                                                    >
                                                        <option value="">{f.placeholder || 'Select...'}</option>
                                                        {f.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                                    </select>
                                                ) : (
                                                    <input 
                                                        type={f.type === 'date' ? 'date' : (f.type === 'number' ? 'number' : 'text')}
                                                        value={row.dynamic_data[f.label] || ''}
                                                        onChange={e => updateDynamic(idx, f.label, e.target.value)}
                                                        className="w-full px-3 py-2.5 text-sm bg-indigo-50/30 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition outline-none font-medium text-slate-700 shadow-inner"
                                                        placeholder={f.placeholder}
                                                    />
                                                )
                                            ) : (
                                                <span className="text-sm font-bold text-slate-800 break-words">{row.dynamic_data[f.label] || '---'}</span>
                                            )}
                                        </td>
                                    ))}

                                    {/* Remove Row Button */}
                                    {isEditing && (
                                        <td className="px-6 py-6 align-middle text-center bg-slate-50/20">
                                            <button 
                                                onClick={() => removeRow(idx)}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Delete Row"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Bottom Add Row Bar */}
                {isEditing && (
                    <div className="p-8 bg-slate-50/50 border-t border-slate-200 flex justify-center">
                        <button 
                            onClick={addRow}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-2xl text-sm font-black hover:bg-emerald-700 transition shadow-xl shadow-emerald-200"
                        >
                            <Plus size={20} /> Append New Row
                        </button>
                    </div>
                )}
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
        </div>
    );
}
