import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, PlusCircle,
  Plus, GripVertical, Trash2, X, AlertCircle,
  CheckCircle, Clock
} from 'lucide-react';
import Sortable from 'sortablejs';
import { FIELD_TYPES } from '../constants/fieldTypes'; // adjust path if needed

const IconMap = {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, Clock
};

function TaskBuilder() {
  const [viewMode, setViewMode] = useState('initial'); // initial, builder, live
  const [formSchema, setFormSchema] = useState([
    {
      id: 'static_client_name',
      type: 'text',
      icon: 'Type',
      color: '#3b82f6',
      label: 'Client Name',
      placeholder: 'Enter client name...',
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_work_type',
      type: 'text',
      icon: 'Type',
      color: '#3b82f6',
      label: 'Work Type',
      placeholder: 'Enter work type...',
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    },
    {
      id: 'static_allocated_to',
      type: 'text',
      icon: 'Type',
      color: '#3b82f6',
      label: 'Allocated To',
      placeholder: 'Enter person name...',
      value: '',
      required: true,
      static: true,
      labelTouched: false,
      placeholderTouched: false
    }
  ]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
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

  const submitForm = () => {
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
    showToast('Form submitted successfully!');
  };

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
    <div className="w-full min-h-screen">
      {/* Landing View */}
      {viewMode === 'initial' && (
        <div className="flex items-center justify-center h-screen">
          <button onClick={() => setViewMode('builder')} className="landing-btn">
            <PlusCircle className="w-8 h-8" />
            Create Task
          </button>
        </div>
      )}

      {/* Workspace View */}
      {viewMode !== 'initial' && (
        <div className="max-w-6xl mx-auto px-4 py-8 lg:py-12">
          <div className="main-grid">
            {/* Form Area */}
            <div className="form-container">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {viewMode === 'live' ? 'Active Task Form' : 'Task Builder'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-2 font-medium">
                    {viewMode === 'live' ? 'Fill in the details below.' : 'Design your custom task entry form below.'}
                  </p>
                </div>
                {viewMode === 'live' && (
                  <button onClick={() => setViewMode('builder')} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 transition">
                    Edit Layout
                  </button>
                )}
              </div>

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

              {formSchema.length === 0 && (
                <div className="p-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Plus className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Start Building</h3>
                  <p className="text-sm text-slate-500 mt-1">Add fields from the menu to get started.</p>
                </div>
              )}

              {formSchema.length > 0 && (
                <div className="mt-6">
                  <button onClick={submitForm} className="create-btn">
                    {viewMode === 'builder' ? 'Create Task' : 'Submit Completed Form'}
                  </button>
                </div>
              )}
            </div>

            {/* Desktop Sidebar */}
            {viewMode === 'builder' && (
              <aside className="hidden lg:block">
                <div className="sidebar-card">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Available Fields</h3>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  </div>
                  <div ref={sidebarRef} id="fieldsList">
                    {FIELD_TYPES.map(type => (
                      <div
                        key={type.id}
                        className="field-btn animate-slide-in"
                        data-type={type.id}
                        onClick={() => addField(type)}
                      >
                        <div className="field-btn-icon" style={{ color: type.color }}>
                          {React.createElement(IconMap[type.icon], { size: 16 })}
                        </div>
                        <span className="field-btn-text">{type.name}</span>
                        <Plus className="w-3.5 h-3.5 text-slate-300 ml-auto" />
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
      className={`form-card animate-slide-in ${isActive ? 'active' : ''} ${isLive ? 'border-emerald-100 shadow-emerald-50/50' : ''}`}
      onClick={onActive}
    >
      {!isLive && (
        <div className="drag-handle absolute top-4 right-4 p-2 cursor-grab">
          <GripVertical className="w-5 h-5 text-slate-300" />
        </div>
      )}

      <div className={`flex items-start justify-between mb-4 ${!isLive ? 'pr-10' : ''}`}>
        <div className="flex-1">
          <div className="flex items-center gap-1">
            {isLive ? (
              <span className="text-sm font-bold text-slate-700">{field.label}</span>
            ) : (
              <input
                type="text"
                value={field.label}
                onFocus={(e) => {
                  if (!field.labelTouched) {
                    onUpdate('label', '');
                    onUpdate('labelTouched', true);
                  }
                }}
                onChange={(e) => onUpdate('label', e.target.value)}
                className="input-label"
                placeholder="Field Label"
              />
            )}
            {field.required && <span className="required-star" title="Required">*</span>}
          </div>
          {!isLive && (
            <input
              type="text"
              value={field.placeholder}
              onFocus={(e) => {
                if (!field.placeholderTouched) {
                  onUpdate('placeholder', '');
                  onUpdate('placeholderTouched', true);
                }
              }}
              onChange={(e) => onUpdate('placeholder', e.target.value)}
              className="input-placeholder"
              placeholder="Custom Placeholder..."
            />
          )}
          {field.error && (
            <p className="text-[11px] text-rose-500 font-bold mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {field.error}
            </p>
          )}
        </div>

        {!isLive ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full scale-90 sm:scale-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Required</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onUpdate('required', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
            {!field.static && (
              <button onClick={onRemove} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition">
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        ) : (
          <button onClick={onRemove} className="p-2 text-slate-200 hover:text-rose-500 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className={`field-preview-area ${isLive ? 'bg-white border-slate-200' : 'bg-slate-50/50 border-slate-100'} p-3 sm:p-4 rounded-2xl border`}>
        <FieldInput field={field} onUpdate={onUpdate} calculateAutoProgress={calculateAutoProgress} isLive={isLive} />
      </div>

      {isActive && (field.type === 'dropdown' || field.type === 'labels') && (
        <FieldSettings field={field} onUpdate={onUpdate} />
      )}
    </div>
  );
}

function FieldInput({ field, onUpdate, calculateAutoProgress }) {
  const baseClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all";

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
            {field.options.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
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
        <div className="flex flex-wrap gap-2 min-h-[50px] p-2 bg-white border border-slate-200 rounded-xl focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-50/50 transition-all">
          {field.value.map((tag, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
              {tag}
              <button onClick={() => onUpdate('value', field.value.filter((_, idx) => idx !== i))} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
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
        <label className="flex items-center gap-4 cursor-pointer group/check p-2">
          <div className="relative w-6 h-6">
            <input type="checkbox" checked={field.value} onChange={(e) => onUpdate('value', e.target.checked)} className="peer hidden" />
            <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
            </div>
          </div>
          <span className="text-sm text-slate-600 font-semibold group-hover/check:text-indigo-600 transition">{field.placeholder}</span>
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
        <div className="space-y-3 p-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Manual Scale</span>
            <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{field.value || 0}%</span>
          </div>
          <input type="range" min="0" max="100" value={field.value || 0} onChange={(e) => onUpdate('value', parseInt(e.target.value))} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
        </div>
      );
    case 'progress_auto': {
      const pct = calculateAutoProgress();
      return (
        <div className="space-y-3 p-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase">Auto Calculated</span>
            <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${pct}%` }}></div>
          </div>
        </div>
      );
    }
    default: return null;
  }
}

function FieldSettings({ field, onUpdate }) {
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
              className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 transition-all"
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
          onClick={() => onUpdate('options', [...field.options, `Option ${field.options.length + 1}`])}
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition px-2"
        >
          <Plus className="w-3.5 h-3.5" /> Add Option
        </button>
      </div>
    </div>
  );
}

export default TaskBuilder;
