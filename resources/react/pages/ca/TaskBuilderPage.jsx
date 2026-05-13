import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, PlusCircle,
  Plus, GripVertical, Trash2, X, AlertCircle,
  CheckCircle, Clock, Check, ChevronLeft, ChevronRight,
  Search
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Sortable from 'sortablejs';
import api from '../../api/axios';
import toast_pkg from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import { FIELD_TYPES } from '../../constants/fieldTypes';
import '../../styles/task-builder.css';

const toast = toast_pkg;

const IconMap = {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, Clock
};

function SearchableSelect({ value, options, placeholder, onChange, onAddNew, addNewLabel }) {
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
    return val === value;
  });

  const getLabel = (opt) => typeof opt === 'object' ? opt.label : opt;
  const getValue = (opt) => typeof opt === 'object' ? opt.value : opt;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus-within:border-slate-800 focus-within:ring-4 focus-within:ring-slate-200/50 transition-all flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={selectedOption ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium'}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
              filteredOptions.map((opt) => (
                <div
                  key={getValue(opt)}
                  className={`px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer transition ${value === getValue(opt) ? 'bg-slate-100 text-slate-900 font-bold border-l-2 border-slate-900' : 'text-slate-600'}`}
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
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSearchableSelect({ value = [], options, placeholder, onChange }) {
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

  const getLabel = (opt) => typeof opt === 'object' ? opt.label : opt;
  const getValue = (opt) => typeof opt === 'object' ? opt.value : opt;

  const toggleOption = (val) => {
    if (value.includes(val)) {
      onChange(value.filter(v => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus-within:border-slate-800 focus-within:ring-4 focus-within:ring-slate-200/50 transition-all flex flex-wrap gap-2 items-center cursor-pointer min-h-[46px]"
        onClick={() => setIsOpen(!isOpen)}
      >
        {value.length > 0 ? (
          value.map(v => {
            const opt = options.find(o => getValue(o) === v);
            return (
              <span key={v} className="bg-slate-100 text-slate-800 px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1">
                {opt ? getLabel(opt) : v}
                <X className="w-3 h-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
              </span>
            );
          })
        ) : (
          <span className="text-slate-400 font-medium">{placeholder}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 ml-auto transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-0"
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const val = getValue(opt);
                const isSelected = value.includes(val);
                return (
                  <div
                    key={val}
                    className={`px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer transition flex items-center justify-between ${isSelected ? 'bg-slate-50 text-slate-900 font-bold' : 'text-slate-600'}`}
                    onClick={() => toggleOption(val)}
                  >
                    {getLabel(opt)}
                    {isSelected && <Check className="w-4 h-4 text-slate-900" />}
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-3 text-xs text-slate-400 text-center italic">No staff found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TaskBuilderPage() {
  const location = useLocation();
  const [viewMode, setViewMode] = useState('builder'); // initial, builder, live
  const [formSchema, setFormSchema] = useState([
    {
      id: 'static_form_name',
      type: 'text',
      icon: 'Type',
      color: '#6366f1',
      label: 'Form Name',
      placeholder: 'Enter form name...',
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_client_name',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#3b82f6',
      label: 'Client Name',
      placeholder: 'Select client name...',
      options: [],
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_work_type',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#3b82f6',
      label: 'Work Type',
      placeholder: 'Select work type...',
      options: [],
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_subtasks',
      type: 'subtasks_list',
      icon: 'PlusCircle',
      color: '#3b82f6',
      label: 'Subtasks Assignment',
      placeholder: 'Add subtasks for staff...',
      value: [], // Array of { title, assigned_to, priority, due_date, remarks }
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_allocated_date',
      type: 'date',
      icon: 'Calendar',
      color: '#ec4899',
      label: 'Allocated Date',
      placeholder: 'Select date...',
      value: new Date().toISOString().split('T')[0],
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_status',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#10b981',
      label: 'Status',
      placeholder: 'Select status...',
      options: ['Assigned', 'In Progress', 'Awaiting Information', 'Completed'],
      value: 'Assigned',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_remarks',
      type: 'longtext',
      icon: 'AlignLeft',
      color: '#0f172a',
      label: 'Remarks',
      placeholder: 'Enter additional remarks...',
      value: '',
      required: false,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    }
  ]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [toast, setToast] = useState({ show: false, message: '' });

  // Client Modal States
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', contact: '', gst_number: '', status: 'active' });
  const [savingClient, setSavingClient] = useState(false);
  const [clientErrors, setClientErrors] = useState({});

  // Work Type Modal States
  const [addWorkTypeOpen, setAddWorkTypeOpen] = useState(false);
  const [workTypeName, setWorkTypeName] = useState('');
  const [workTypeError, setWorkTypeError] = useState('');
  const [savingWorkType, setSavingWorkType] = useState(false);

  const fieldsContainerRef = useRef(null);
  const sidebarRef = useRef(null);

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const addField = (type, atIndex = null) => {
    const id = 'f_' + Date.now();
    const newField = {
      id,
      type: type.id,
      icon: type.icon,
      color: type.color,
      label: type.name,
      placeholder: `Enter your ${type.name.toLowerCase()} here...`,
      value: type.id === 'labels' ? [] : (type.id === 'progress_manual' ? 50 : (type.id === 'phone' ? '+91 ' : '')),
      options: (type.id === 'dropdown' || type.id === 'labels') ? ['Option 1', 'Option 2'] : [],
      required: false,
      error: '',
      labelTouched: false,
      placeholderTouched: false
    };

    setFormSchema(prev => {
      const updated = [...prev];
      if (atIndex !== null) updated.splice(atIndex, 0, newField);
      else updated.push(newField);
      return updated;
    });

    setActiveFieldId(id);
    showToast(`${type.name} added`);
    
    // Auto-close sidebar on mobile after adding field
    if (window.innerWidth <= 1024) {
      setIsSidebarOpen(false);
    }
  };

  const removeField = (id) => {
    setFormSchema(prev => prev.filter(f => f.id !== id));
    if (activeFieldId === id) setActiveFieldId(null);
  };

  const updateField = (id, key, val) => {
    setFormSchema(prev => prev.map(f => {
      if (f.id === id) {
        const updated = { ...f, [key]: val };
        if (key === 'required' || key === 'value') validateField(updated);
        return updated;
      }
      return f;
    }));
  };

  const validateField = (field) => {
    if (field.required) {
      const isEmpty = (val) => {
        if (Array.isArray(val)) return val.length === 0;
        if (typeof val === 'string') return val.trim() === '';
        return val === null || val === undefined;
      };
      if (isEmpty(field.value)) {
        field.error = 'This field is required';
        return false;
      }
    }
    if (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
      field.error = 'Invalid email format';
      return false;
    }
    if (field.type === 'phone' && field.value) {
      const digits = field.value.replace(/\D/g, '');
      const isIndian = field.value.startsWith('+91');
      const minDigits = isIndian ? 12 : 10;
      if (digits.length > 0 && digits.length < minDigits) {
        field.error = `Enter a valid ${isIndian ? '10-digit number after +91' : 'number'}`;
        return false;
      }
    }
    field.error = '';
    return true;
  };

  const calculateAutoProgress = () => {
    const otherFields = formSchema.filter(f => !f.type.startsWith('progress'));
    if (otherFields.length === 0) return 0;
    const filled = otherFields.filter(f => {
      if (Array.isArray(f.value)) return f.value.length > 0;
      return f.value !== '' && f.value !== null && f.value !== undefined && f.value !== false;
    });
    return Math.round((filled.length / otherFields.length) * 100);
  };

  const submitForm = async () => {
    if (viewMode === 'builder') {
      setFormSchema(prev => prev.map(f => ({ ...f, error: '' })));
      setViewMode('live');
      showToast('Form created! You can now enter data.');
      return;
    }

    let allValid = true;
    const validatedSchema = formSchema.map(f => {
      const isValid = validateField(f);
      if (!isValid) allValid = false;
      return { ...f };
    });

    if (!allValid) {
      setFormSchema(validatedSchema);
      showToast('Form incomplete. Please fill all required fields.');
      return;
    }

    // Prepare data for backend
    const staticFields = {
      form_name: formSchema.find(f => f.id === 'static_form_name')?.value,
      client_id: formSchema.find(f => f.id === 'static_client_name')?.value,
      work_type_id: formSchema.find(f => f.id === 'static_work_type')?.value,
      date_allocated: formSchema.find(f => f.id === 'static_allocated_date')?.value,
      status: formSchema.find(f => f.id === 'static_status')?.value,
      subtasks: formSchema.find(f => f.id === 'static_subtasks')?.value,
      date_inward: new Date().toISOString().split('T')[0],
    };

    // Pick first subtask assignee as lead for DB compatibility
    if (staticFields.subtasks && staticFields.subtasks.length > 0) {
      staticFields.allocated_to = staticFields.subtasks[0].assigned_to;
    }

    const dynamicFields = {};
    formSchema.forEach(f => {
      if (!f.static) {
        dynamicFields[f.label] = f.value;
      }
    });

    try {
      const response = await api.post('/ca/tasks', {
        ...staticFields,
        dynamic_fields: dynamicFields,
        remarks: formSchema.find(f => f.id === 'static_remarks')?.value || 'Created via Task Builder',
      });

      showToast('Task created successfully!');
      // Optionally redirect or reset form
      setTimeout(() => {
        window.location.href = '/ca/tasks';
      }, 1500);
    } catch (err) {
      console.error(err);
      showToast('Failed to create task. ' + (err.response?.data?.message || ''));
    }
  };

  const fetchClients = async (selectNewId = null) => {
    try {
      const res = await api.get('/ca/clients?per_page=-1');
      const options = res.data.data.map(c => ({ value: c.id, label: c.name }));
      setFormSchema(prev => prev.map(field => {
        if (field.id === 'static_client_name') {
          return { ...field, options, value: selectNewId !== null ? selectNewId : field.value };
        }
        return field;
      }));
    } catch (err) { console.error(err); }
  };

  const fetchWorkTypes = async (selectNewId = null) => {
    try {
      const res = await api.get('/ca/work-types');
      const options = res.data.data.map(w => ({ value: w.id, label: w.name }));
      setFormSchema(prev => prev.map(field => {
        if (field.id === 'static_work_type') {
          return { ...field, options, value: selectNewId !== null ? selectNewId : field.value };
        }
        return field;
      }));
    } catch (err) { console.error(err); }
  };

  const handleSaveClient = async () => {
    setSavingClient(true); setClientErrors({});
    try {
      const res = await api.post('/ca/clients', clientForm);
      setAddClientOpen(false);
      showToast('Client added successfully');
      await fetchClients(res.data.data.id);
    } catch (e) { setClientErrors(e.response?.data?.errors ?? {}); }
    finally { setSavingClient(false); }
  };

  const handleSaveWorkType = async () => {
    setSavingWorkType(true); setWorkTypeError('');
    try {
      const res = await api.post('/ca/work-types', { name: workTypeName });
      setAddWorkTypeOpen(false);
      showToast('Work Type added successfully');
      await fetchWorkTypes(res.data.data.id);
    } catch (e) { setWorkTypeError(e.response?.data?.errors?.name?.[0] ?? 'Error saving work type'); }
    finally { setSavingWorkType(false); }
  };

  // Fetch options for static fields
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [clientsRes, workTypesRes, staffRes, statusesRes] = await Promise.all([
          api.get('/ca/clients?per_page=-1'),
          api.get('/ca/work-types'),
          api.get('/ca/staff?per_page=-1'),
          api.get('/task-statuses')
        ]);

        setFormSchema(prev => prev.map(field => {
          if (field.id === 'static_client_name') {
            return { ...field, options: clientsRes.data.data.map(c => ({ value: c.id, label: c.name })) };
          }
          if (field.id === 'static_work_type') {
            return { ...field, options: workTypesRes.data.data.map(w => ({ value: w.id, label: w.name })) };
          }
          if (field.id === 'static_subtasks') {
            return { ...field, options: staffRes.data.data.map(s => ({ value: s.id, label: s.name })) };
          }
          if (field.id === 'static_status') {
            return { ...field, options: statusesRes.data.data.map(s => ({ value: s.value, label: s.label })) };
          }
          return field;
        }));
      } catch (err) {
        console.error('Error fetching options:', err);
        showToast('Error loading form options');
      }
    };

    fetchOptions();
  }, []);

  // Handle Duplication Data
  useEffect(() => {
    if (location.state?.duplicateData) {
      const data = location.state.duplicateData;
      setFormSchema(prev => {
        // First, reset to static fields only to avoid duplicates if this effect runs twice
        const staticOnly = prev.filter(f => f.static);

        let updated = staticOnly.map(field => {
          if (field.id === 'static_form_name') return { ...field, value: data.form_name };
          if (field.id === 'static_client_name') return { ...field, value: data.client_id };
          if (field.id === 'static_work_type') return { ...field, value: data.work_type_id };
          if (field.id === 'static_remarks') return { ...field, value: data.remarks };
          if (field.id === 'static_subtasks') return { ...field, value: data.subtasks || [] };
          return field;
        });

        // Add dynamic fields if any
        if (data.dynamic_fields && Object.keys(data.dynamic_fields).length > 0) {
          const dynamicFields = Object.entries(data.dynamic_fields).map(([label, val]) => {
            // Determine type (very basic guessing)
            let type = 'text';
            let icon = 'Type';
            let color = '#64748b';

            if (typeof val === 'boolean') { type = 'checkbox'; icon = 'CheckSquare'; }
            else if (val && val.toString().includes('\n')) { type = 'longtext'; icon = 'AlignLeft'; }
            
            return {
              id: 'f_' + Math.random().toString(36).substr(2, 9),
              type,
              icon,
              color,
              label,
              placeholder: `Enter ${label}...`,
              value: val,
              required: false,
              labelTouched: true,
              placeholderTouched: true
            };
          });
          updated = [...updated, ...dynamicFields];
        }
        return updated;
      });
      
      showToast('Task data loaded. You can now edit and save.');
    }
  }, [location.state]);

  useEffect(() => {
    if (viewMode === 'builder' && fieldsContainerRef.current) {
      const sidebarSortable = new Sortable(sidebarRef.current, {
        group: { name: 'fields', pull: 'clone', put: false },
        sort: false,
        animation: 150
      });

      const canvasSortable = new Sortable(fieldsContainerRef.current, {
        group: 'fields',
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onAdd: (evt) => {
          const typeId = evt.item.getAttribute('data-type');
          const newIndex = evt.newIndex;
          evt.item.remove();
          const fieldType = FIELD_TYPES.find(f => f.id === typeId);
          addField(fieldType, newIndex);
        },
        onUpdate: (evt) => {
          setFormSchema(prev => {
            const updated = [...prev];
            const [moved] = updated.splice(evt.oldIndex, 1);
            updated.splice(evt.newIndex, 0, moved);
            return updated;
          });
        }
      });

      return () => {
        sidebarSortable.destroy();
        canvasSortable.destroy();
      };
    }
  }, [viewMode]);

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* Workspace View */}
      {viewMode !== 'initial' && (
        <div className="w-full flex-1 flex flex-col">
          <div className="main-grid">
            {/* Form Area */}
            <div className="form-container">
              <div className="sticky top-[65px] lg:relative lg:top-0 z-30 bg-[#F5F7FA]/90 backdrop-blur-md lg:backdrop-blur-none py-3 mb-3 flex justify-between items-center -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-slate-200 lg:border-none">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
                    {viewMode === 'live' ? 'Active Task Form' : 'Task Builder'}
                  </h2>
                  <p className="hidden sm:block text-xs text-slate-400 mt-0.5 font-medium">
                    {viewMode === 'live' ? 'Fill in the details below.' : 'Design your custom task entry form below.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {viewMode === 'live' ? (
                    <button 
                      onClick={() => setViewMode('builder')} 
                      className="whitespace-nowrap px-4 py-2 bg-slate-500 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                    >
                      Edit Layout
                    </button>
                  ) : (
                    <button 
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 border shadow-sm ${
                        isSidebarOpen 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-slate-200' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Sliders className={`w-4 h-4 ${isSidebarOpen ? 'text-slate-300' : 'text-slate-500'}`} />
                      <span className="text-[13px] font-bold tracking-tight whitespace-nowrap">
                        {isSidebarOpen ? 'Hide Panel' : 'Fields'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Flat form section */}
              <div className="form-section">
                <div ref={fieldsContainerRef} id="fieldsContainer">
                  {formSchema.map((field) => (
                      <FormCard
                        key={field.id}
                        field={field}
                        viewMode={viewMode}
                        isActive={activeFieldId === field.id && viewMode === 'builder'}
                        onActive={() => viewMode === 'builder' && setActiveFieldId(field.id)}
                        onUpdate={(key, val) => updateField(field.id, key, val)}
                        onRemove={() => removeField(field.id)}
                        calculateAutoProgress={calculateAutoProgress}
                        modalActions={{
                          setAddClientOpen,
                          setClientForm,
                          setClientErrors,
                          setAddWorkTypeOpen,
                          setWorkTypeName,
                          setWorkTypeError
                        }}
                      />
                  ))}
                </div>
              </div>

              {formSchema.length === 0 && (
                <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-6 h-6 text-slate-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Start Building</h3>
                  <p className="text-xs text-slate-400 mt-1">Add fields from the panel to get started.</p>
                </div>
              )}

              {formSchema.length > 0 && (
                <div className="mt-3 flex justify-start">
                  <button onClick={submitForm} className="create-btn">
                    {viewMode === 'builder' ? 'Create Form' : 'Submit Form'}
                  </button>
                </div>
              )}
            </div>

            {/* Responsive Sidebar */}
            {viewMode === 'builder' && (
              <aside className={`flex flex-col sidebar-container transition-all duration-300 ${isSidebarOpen ? 'w-52 lg:w-64 fixed lg:relative top-[65px] lg:top-0 bottom-0 right-0 z-50 lg:z-0 bg-white/40 lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none shadow-2xl lg:shadow-none' : 'w-0 lg:w-16 overflow-hidden lg:overflow-visible'}`}>
                <div className={`sidebar-card h-full transition-colors duration-300 ${!isSidebarOpen ? 'bg-slate-100 border-slate-200 shadow-none' : ''}`}>
                  {/* Sidebar Header with Toggle */}
                  <div className={`flex items-center border-b border-slate-200/60 py-5 lg:py-2 px-5 lg:px-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    {isSidebarOpen && (
                      <div className="flex items-center justify-between w-full lg:w-auto gap-2">
                        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Fields</h3>
                        <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className={`hidden lg:flex p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition`}
                      title={isSidebarOpen ? 'Collapse panel' : 'Expand panel'}
                    >
                      {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Field list */}
                  <div ref={sidebarRef} id="fieldsList" className={`p-5 lg:p-3 ${!isSidebarOpen ? 'flex flex-col items-center gap-5 py-6 px-0' : 'space-y-2'}`}>
                    {FIELD_TYPES.map(type => (
                      <div
                        key={type.id}
                        className={`field-btn animate-slide-in ${!isSidebarOpen ? '!p-0 !m-0 !bg-transparent !border-none flex justify-center w-full shadow-none hover:shadow-none transition-transform hover:scale-110 active:scale-95' : ''}`}
                        data-type={type.id}
                        onClick={() => addField(type)}
                        title={!isSidebarOpen ? type.name : ''}
                      >
                        <div className={`field-btn-icon ${!isSidebarOpen ? '!w-10 !h-10 bg-white shadow-md border border-slate-200/50 rounded-xl' : ''}`} style={{ color: type.color }}>
                          {React.createElement(IconMap[type.icon], { size: !isSidebarOpen ? 20 : 14 })}
                        </div>
                        {isSidebarOpen && (
                          <>
                            <span className="field-btn-text">{type.name}</span>
                            <Plus className="w-3 h-3 text-slate-300 ml-auto" />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Mobile Backdrop - Transparent click-outside area */}
      {isSidebarOpen && window.innerWidth <= 1024 && (
        <div 
          className="fixed top-[65px] inset-x-0 bottom-0 z-[40] transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] pointer-events-none transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      </div>

      {/* Add New Client Modal */}
      <Modal open={addClientOpen} onClose={() => setAddClientOpen(false)} title="Add New Client">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Name *</label>
            <input type="text" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter client name" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition" />
            {clientErrors.name && <p className="text-xs text-red-500">{clientErrors.name[0]}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact Number</label>
            <input type="text" value={clientForm.contact} onChange={e => setClientForm(f => ({ ...f, contact: e.target.value }))} placeholder="e.g. 9876543210" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">GST Number</label>
            <input type="text" value={clientForm.gst_number} onChange={e => setClientForm(f => ({ ...f, gst_number: e.target.value }))} placeholder="Optional" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddClientOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleSaveClient} disabled={savingClient} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{savingClient ? 'Saving...' : 'Save Client'}</button>
          </div>
        </div>
      </Modal>

      {/* Add New Work Type Modal */}
      <Modal open={addWorkTypeOpen} onClose={() => setAddWorkTypeOpen(false)} title="Add Work Type" width="max-w-sm">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Work Type Name *</label>
            <input type="text" value={workTypeName} onChange={e => setWorkTypeName(e.target.value)} placeholder="e.g. Income Tax Return" className="w-full px-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-800/20 focus:border-slate-800 transition" />
            {workTypeError && <p className="text-xs text-red-500">{workTypeError}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setAddWorkTypeOpen(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={handleSaveWorkType} disabled={savingWorkType} className="px-5 py-2 text-sm bg-[#0f1c2e] text-white rounded-xl hover:bg-[#1a2f4a] disabled:opacity-60 transition">{savingWorkType ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FormCard({ field, viewMode, isActive, onActive, onUpdate, onRemove, calculateAutoProgress, modalActions }) {
  const isLive = viewMode === 'live';

  return (
    <div
      className={`form-card animate-slide-in ${isActive ? 'active' : ''}`}
      onClick={onActive}
    >
      <div className={`flex items-center gap-2 ${!isLive ? 'pr-6' : ''}`}>
        {/* Drag handle */}
        {!isLive && (
          <div className="drag-handle shrink-0">
            <GripVertical className="w-4 h-4 text-slate-300" />
          </div>
        )}

        {/* Label + placeholder */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 w-fit max-w-full">
            {isLive || field.static ? (
              <span className={`text-sm font-semibold whitespace-nowrap ${field.static ? 'text-slate-800' : 'text-slate-700'}`}>
                {field.label}
              </span>
            ) : (
              <input
                type="text"
                value={field.label}
                onFocus={() => { if (!field.labelTouched) { onUpdate('label', ''); onUpdate('labelTouched', true); } }}
                onChange={(e) => onUpdate('label', e.target.value)}
                className="input-label !w-auto min-w-[50px]"
                placeholder="Field Label"
                size={Math.max(field.label.length || 0, 10)}
              />
            )}
            {field.required && <span className="required-star shrink-0" title="Required">*</span>}
          </div>
          {!isLive && (
            field.static ? (
              <span className="text-[11px] text-slate-400 italic">{field.placeholder} (System Field)</span>
            ) : (
              <input
                type="text"
                value={field.placeholder}
                onFocus={() => { if (!field.placeholderTouched) { onUpdate('placeholder', ''); onUpdate('placeholderTouched', true); } }}
                onChange={(e) => onUpdate('placeholder', e.target.value)}
                className="input-placeholder"
                placeholder="Custom Placeholder..."
              />
            )
          )}
          {field.error && (
            <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {field.error}
            </p>
          )}
        </div>

        {/* Actions */}
        {!isLive ? (
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Req</span>
              <label className={`toggle-switch ${field.static ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => !field.static && onUpdate('required', e.target.checked)}
                  disabled={field.static}
                />
                <span className="slider"></span>
              </label>
            </div>
            {!field.static && (
              <button onClick={onRemove} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* Field input */}
      <div className="field-preview-area">
        <FieldInput 
          field={field} 
          onUpdate={onUpdate} 
          calculateAutoProgress={calculateAutoProgress} 
          isLive={isLive} 
          modalActions={modalActions}
        />
      </div>

      {isActive && !field.static && (field.type === 'dropdown' || field.type === 'labels') && (
        <FieldSettings field={field} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function FieldInput({ field, onUpdate, calculateAutoProgress, modalActions }) {
  const baseClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-200/50 transition-all";

  switch (field.type) {
    case 'text':
      return <input type="text" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} placeholder={field.placeholder} />;
    case 'longtext':
      return <textarea value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} rows="3" placeholder={field.placeholder} />;
    case 'dropdown':
      if (field.id === 'static_client_name' || field.id === 'static_work_type') {
        const isClient = field.id === 'static_client_name';
        return (
          <SearchableSelect
            value={field.value}
            options={field.options}
            placeholder={field.placeholder}
            onChange={(val) => onUpdate('value', val)}
            addNewLabel={isClient ? "Add New Client" : "Add New Type"}
            onAddNew={(search) => {
              if (isClient) {
                modalActions.setClientForm({ name: search, contact: '', gst_number: '', status: 'active' });
                modalActions.setClientErrors({});
                modalActions.setAddClientOpen(true);
              } else {
                modalActions.setWorkTypeName(search);
                modalActions.setWorkTypeError('');
                modalActions.setAddWorkTypeOpen(true);
              }
            }}
          />
        );
      }
      return (
        <div className="relative">
          <select value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={`${baseClass} appearance-none`}>
            <option value="">{field.placeholder}</option>
            {field.options.map((opt, i) => {
              const val = typeof opt === 'object' ? opt.value : opt;
              const lbl = typeof opt === 'object' ? opt.label : opt;
              return <option key={i} value={val}>{lbl}</option>;
            })}
          </select>
          <ChevronDown className="absolute right-4 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      );
    case 'subtasks_list':
      return (
        <SubtasksAssignment
          value={field.value}
          staffOptions={field.options}
          onChange={(val) => onUpdate('value', val)}
        />
      );
    case 'date':
      return <input type="date" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} />;
    case 'number':
      return <input type="number" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} placeholder={field.placeholder} />;
    case 'labels':
      return (
        <div className="flex flex-wrap gap-2 min-h-[50px] p-2 bg-white border border-slate-200 rounded-xl focus-within:border-slate-800 focus-within:ring-4 focus-within:ring-slate-200/50 transition-all">
          {field.value.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200">
              {tag}
              <button onClick={() => onUpdate('value', field.value.filter((_, idx) => idx !== i))} className="hover:text-slate-950"><X className="w-3 h-3" /></button>
            </span>
          ))}
          <input
            type="text"
            placeholder={field.placeholder}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm min-w-[150px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                onUpdate('value', [...field.value, e.target.value.trim()]);
                e.target.value = '';
              }
            }}
          />
        </div>
      );
    case 'checkbox':
      return (
        <label className="group/check flex items-center gap-3 cursor-pointer p-1">
          <input type="checkbox" className="peer sr-only" checked={field.value || false} onChange={(e) => onUpdate('value', e.target.checked)} />
          <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-all flex items-center justify-center">
            <Check className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
          </div>
          <span className="text-sm text-slate-600 font-semibold group-hover/check:text-slate-900 transition">{field.placeholder}</span>
        </label>
      );
    case 'email':
      return <input type="email" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} placeholder={field.placeholder} />;
    case 'phone':
      return (
        <input
          type="tel"
          value={field.value}
          onChange={(e) => {
            let val = e.target.value;
            if (!val.startsWith('+91') && field.value.startsWith('+91')) {
              if (val.length < 3) val = '+91 ';
            }
            onUpdate('value', val);
          }}
          className={baseClass}
          placeholder={field.placeholder}
        />
      );
    case 'time':
      return <input type="time" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} />;
    case 'progress_manual':
      return (
        <div className="space-y-4 px-2 pb-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Progress</span>
            <span className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{field.value || 0}%</span>
          </div>
          <input type="range" min="0" max="100" value={field.value || 0} onChange={(e) => onUpdate('value', parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-slate-900" />
        </div>
      );
    case 'progress_auto': {
      const pct = calculateAutoProgress();
      return (
        <div className="space-y-3 p-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Auto Calculated</span>
            <span className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-slate-900 transition-all duration-500" style={{ width: `${pct}%` }}></div>
          </div>
        </div>
      );
    }
    default: return null;
  }
}

function FieldSettings({ field, onUpdate }) {
  const handleAddOption = () => onUpdate('options', [...field.options, `Option ${field.options.length + 1}`]);
  return (
    <div className="mt-6 pt-6 border-t border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Options Configuration</h4>
      </div>
      <div className="space-y-3">
        {field.options.map((opt, i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={opt}
              onChange={(e) => {
                const newOpts = [...field.options];
                newOpts[i] = e.target.value;
                onUpdate('options', newOpts);
              }}
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-800/20 transition-all"
            />
            <button
              onClick={() => onUpdate('options', field.options.filter((_, idx) => idx !== i))}
              className="p-2 text-slate-300 hover:text-rose-500 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={handleAddOption}
          className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-slate-950 transition px-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add Option
        </button>
      </div>
    </div>
  );
}

function SubtasksAssignment({ value = [], staffOptions = [], onChange }) {
  const addSubtask = () => {
    onChange([...value, { 
      title: '', 
      assigned_to: '', 
      priority: 'medium', 
      status: 'assigned',
      due_date: new Date().toISOString().split('T')[0], 
      remarks: '' 
    }]);
  };

  const removeSubtask = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateSubtask = (index, key, val) => {
    const newList = [...value];
    newList[index] = { ...newList[index], [key]: val };
    onChange(newList);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
              <th className="pb-2 pl-2">Staff</th>
              <th className="pb-2">Subtask Name</th>
              <th className="pb-2">Priority</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Due Date</th>
              <th className="pb-2">Remarks</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {value.map((st, i) => (
              <tr key={i} className="group">
                <td className="py-2 pr-2 min-w-[150px]">
                  <select 
                    value={st.assigned_to} 
                    onChange={e => updateSubtask(i, 'assigned_to', e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="">Select Staff</option>
                    {staffOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input 
                    type="text" 
                    value={st.title} 
                    onChange={e => updateSubtask(i, 'title', e.target.value)}
                    placeholder="e.g. Data Entry"
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select 
                    value={st.priority} 
                    onChange={e => updateSubtask(i, 'priority', e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900 capitalize"
                  >
                    {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <select 
                    value={st.status} 
                    onChange={e => updateSubtask(i, 'status', e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900 capitalize"
                  >
                    {['assigned', 'in_progress', 'awaiting_information', 'completed'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input 
                    type="date" 
                    value={st.due_date} 
                    onChange={e => updateSubtask(i, 'due_date', e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input 
                    type="text" 
                    value={st.remarks} 
                    onChange={e => updateSubtask(i, 'remarks', e.target.value)}
                    placeholder="Notes..."
                    className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900"
                  />
                </td>
                <td className="py-2 text-right">
                  <button onClick={() => removeSubtask(i)} className="p-1.5 text-slate-300 hover:text-rose-500 transition">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {value.length === 0 && (
        <p className="text-center py-4 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          No subtasks added yet. Assign at least one person to continue.
        </p>
      )}

      <button 
        onClick={addSubtask}
        className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition shadow-md shadow-slate-200"
      >
        <Plus size={14} /> Add Staff Assignment
      </button>
    </div>
  );
}
