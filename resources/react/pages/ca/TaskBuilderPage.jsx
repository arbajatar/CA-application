import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, PlusCircle,
  Plus, GripVertical, Trash2, X, AlertCircle,
  CheckCircle, Clock, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import Sortable from 'sortablejs';
import api from '../../api/axios';
import toast_pkg from 'react-hot-toast';
import { FIELD_TYPES } from '../../constants/fieldTypes';
import '../../styles/task-builder.css';

const toast = toast_pkg;

const IconMap = {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, Clock
};

export default function TaskBuilderPage() {
  const [viewMode, setViewMode] = useState('builder'); // initial, builder, live
  const [formSchema, setFormSchema] = useState([
    {
      id: 'static_client_name',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#3b82f6',
      label: 'Client Name',
      placeholder: 'Select client name...',
      options: ['Client 1', 'Client 2'],
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
      options: ['Audit', 'Taxation', 'Accounting'],
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_allocated_to',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#3b82f6',
      label: 'Allocated To',
      placeholder: 'Select person...',
      options: ['Staff A', 'Staff B'],
      value: '',
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
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '' });

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
      client_id: formSchema.find(f => f.id === 'static_client_name')?.value,
      work_type_id: formSchema.find(f => f.id === 'static_work_type')?.value,
      allocated_to: formSchema.find(f => f.id === 'static_allocated_to')?.value,
      date_allocated: formSchema.find(f => f.id === 'static_allocated_date')?.value,
      status: formSchema.find(f => f.id === 'static_status')?.value,
      date_inward: new Date().toISOString().split('T')[0], // Defaulting to today
    };

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
          if (field.id === 'static_allocated_to') {
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
              <div className="mb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {viewMode === 'live' ? 'Active Task Form' : 'Task Builder'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    {viewMode === 'live' ? 'Fill in the details below.' : 'Design your custom task entry form below.'}
                  </p>
                </div>
                {viewMode === 'live' && (
                  <button onClick={() => setViewMode('builder')} className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs hover:bg-slate-200 transition">
                    Edit Layout
                  </button>
                )}
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

            {/* Desktop Sidebar */}
            {viewMode === 'builder' && (
              <aside className={`hidden lg:flex flex-col sidebar-container transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-16'}`}>
                <div className={`sidebar-card h-full transition-colors duration-300 ${!isSidebarOpen ? 'bg-slate-100 border-slate-200 shadow-none' : 'bg-white'}`}>
                  {/* Sidebar Header with Toggle */}
                  <div className={`flex items-center border-b border-slate-200/60 py-2 px-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
                    {isSidebarOpen && (
                      <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Available Fields</h3>
                    )}
                    <button
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition"
                      title={isSidebarOpen ? 'Collapse panel' : 'Expand panel'}
                    >
                      {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Field list */}
                  <div ref={sidebarRef} id="fieldsList" className={`${!isSidebarOpen ? 'flex flex-col items-center gap-5 py-6 px-0' : ''}`}>
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

      {/* Mobile Floating Button */}
      {viewMode === 'builder' && (
        <button onClick={() => setIsMobileSheetOpen(true)} className="fab">
          <Plus className="w-7 h-7" />
        </button>
      )}

      {/* Mobile Bottom Sheet */}
      {isMobileSheetOpen && (
        <div className="bottom-sheet" onClick={(e) => e.target === e.currentTarget && setIsMobileSheetOpen(false)}>
          <div className="bottom-sheet-content">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-extrabold text-slate-900">Add Field</h3>
              <button onClick={() => setIsMobileSheetOpen(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="compact-grid">
              {FIELD_TYPES.map(type => (
                <div key={type.id} className="mobile-field-item" onClick={() => { addField(type); setIsMobileSheetOpen(false); }}>
                  <div className="mobile-field-icon" style={{ color: type.color }}>
                    {React.createElement(IconMap[type.icon], { size: 20 })}
                  </div>
                  <span className="mobile-field-text">{type.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] pointer-events-none transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-bold">{toast.message}</span>
        </div>
      </div>
    </div>
  );
}

function FormCard({ field, viewMode, isActive, onActive, onUpdate, onRemove, calculateAutoProgress }) {
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
          <div className="flex items-center gap-1">
            {isLive || field.static ? (
              <span className={`text-sm font-semibold ${field.static ? 'text-slate-800' : 'text-slate-700'}`}>
                {field.label}
              </span>
            ) : (
              <input
                type="text"
                value={field.label}
                onFocus={() => { if (!field.labelTouched) { onUpdate('label', ''); onUpdate('labelTouched', true); } }}
                onChange={(e) => onUpdate('label', e.target.value)}
                className="input-label"
                placeholder="Field Label"
              />
            )}
            {field.required && <span className="required-star" title="Required">*</span>}
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
        <FieldInput field={field} onUpdate={onUpdate} calculateAutoProgress={calculateAutoProgress} isLive={isLive} />
      </div>

      {isActive && !field.static && (field.type === 'dropdown' || field.type === 'labels') && (
        <FieldSettings field={field} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function FieldInput({ field, onUpdate, calculateAutoProgress }) {
  const baseClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-slate-800 focus:ring-4 focus:ring-slate-200/50 transition-all";

  switch (field.type) {
    case 'text':
      return <input type="text" value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} placeholder={field.placeholder} />;
    case 'longtext':
      return <textarea value={field.value} onChange={(e) => onUpdate('value', e.target.value)} className={baseClass} rows="3" placeholder={field.placeholder} />;
    case 'dropdown':
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
