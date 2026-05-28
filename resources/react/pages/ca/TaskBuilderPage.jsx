import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown, Type, Calendar, AlignLeft, Hash, Tags,
  CheckSquare, Zap, Mail, Phone, Sliders, PlusCircle,
  Plus, GripVertical, Trash2, X, AlertCircle,
  CheckCircle, Clock, Check, ChevronLeft, ChevronRight,
  Search, Copy, Globe, ShieldCheck, ShieldAlert, Key, EyeOff, Eye, ArrowLeft, ExternalLink
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sortable from 'sortablejs';
import api from '../../api/axios';
import toast_pkg from 'react-hot-toast';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Tooltip from '../../components/ui/Tooltip';
import { FIELD_TYPES } from '../../constants/fieldTypes';
import '../../styles/task-builder.css';

const toast = toast_pkg;

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
              filteredOptions.map((opt) => (
                <div
                  key={getValue(opt)}
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
  const navigate = useNavigate();
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${fieldName} copied!`);
  };
  const [viewMode, setViewMode] = useState('builder'); // initial, builder, live
  const [formSchema, setFormSchema] = useState([
    // SECTION 1: Sheet Meta Information
    {
      id: 'static_form_name',
      type: 'text',
      icon: 'Type',
      color: '#6366f1',
      label: 'Sheet Name',
      placeholder: 'Enter sheet name...',
      value: '',
      required: true,
      static: true,
      section: 1
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
      section: 1
    },
    {
      id: 'static_created_date',
      type: 'date',
      icon: 'Calendar',
      color: '#f43f5e',
      label: 'Created Date',
      placeholder: 'Select date...',
      value: new Date().toISOString().split('T')[0],
      required: true,
      static: true,
      section: 1
    },
    {
      id: 'static_sheet_status',
      type: 'dropdown',
      icon: 'CheckCircle',
      color: '#10b981',
      label: 'Sheet Status',
      placeholder: 'Select status...',
      options: [
        { value: 'complete', label: 'Complete' },
        { value: 'work_in_progress', label: 'Work In Progress' },
        { value: 'pending', label: 'Pending' },
        { value: 'not_to_be_done', label: 'Not To Be Done' },
        { value: 'other', label: 'Other' }
      ],
      value: 'pending',
      required: true,
      static: true,
      section: 1
    },
    {
      id: 'static_remarks',
      type: 'longtext',
      icon: 'AlignLeft',
      color: '#64748b',
      label: 'Remarks',
      placeholder: 'Enter meta remarks...',
      value: '',
      required: true,
      static: true,
      section: 1
    },

    // SECTION 2: Task Assignment Section
    {
      id: 'static_entry_date',
      type: 'date',
      icon: 'Clock',
      color: '#8b5cf6',
      label: 'Date of entry',
      placeholder: 'Select entry date...',
      value: new Date().toISOString().split('T')[0],
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_task_particular',
      type: 'longtext',
      icon: 'AlignLeft',
      color: '#f59e0b',
      label: 'Task/Particular',
      placeholder: 'Enter task description...',
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_assignee',
      type: 'dropdown',
      icon: 'PlusCircle',
      color: '#3b82f6',
      label: 'Assignee',
      placeholder: 'Select staff...',
      options: [],
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_due_date',
      type: 'date',
      icon: 'Calendar',
      color: '#ec4899',
      label: 'Due Date',
      placeholder: 'Select deadline...',
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_task_status',
      type: 'dropdown',
      icon: 'Sliders',
      color: '#10b981',
      label: 'Status',
      placeholder: 'Select task status...',
      options: [
        { value: 'complete', label: 'Complete' },
        { value: 'work_in_progress', label: 'Work In Progress' },
        { value: 'pending', label: 'Pending' },
        { value: 'not_to_be_done', label: 'Not To Be Done' },
        { value: 'other', label: 'Other' }
      ],
      value: 'pending',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_sub_status',
      type: 'longtext',
      icon: 'AlignLeft',
      color: '#6366f1',
      label: 'Sub status',
      placeholder: 'e.g. Documentation pending',
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_feedback',
      type: 'longtext',
      icon: 'Mail',
      color: '#94a3b8',
      label: 'Feedback',
      placeholder: 'Enter feedback...',
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_client_name',
      type: 'dropdown',
      icon: 'ChevronDown',
      color: '#3b82f6',
      label: 'Client',
      placeholder: 'Select client (optional)',
      options: [],
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_ca_feedback',
      type: 'longtext',
      icon: 'AlignLeft',
      color: '#10b981',
      label: 'CA Feedback',
      placeholder: 'Enter CA feedback (optional)...',
      value: '',
      required: false,
      static: true,
      section: 2
    },
    {
      id: 'static_ca_rating',
      type: 'dropdown',
      icon: 'Sliders',
      color: '#f59e0b',
      label: 'CA Rating',
      placeholder: 'Select CA rating (optional)...',
      options: [
        { value: '1', label: '1 Star ⭐' },
        { value: '2', label: '2 Stars ⭐⭐' },
        { value: '3', label: '3 Stars ⭐⭐⭐' },
        { value: '4', label: '4 Stars ⭐⭐⭐⭐' },
        { value: '5', label: '5 Stars ⭐⭐⭐⭐⭐' }
      ],
      value: '',
      required: false,
      static: true,
      section: 2
    }
  ]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [sheetPermissions, setSheetPermissions] = useState([]);
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [selectedFields, setSelectedFields] = useState([]);
  const [deleteBulkOpen, setDeleteBulkOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [toast, setToast] = useState({ show: false, message: '' });
  const [saving, setSaving] = useState(false);

  const isDuplicating = !!location.state?.duplicateData;

  // Client Modal States
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

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT_FORM);
  const [savingClient, setSavingClient] = useState(false);
  const [clientErrors, setClientErrors] = useState({});

  // Client dynamic types & groups
  const [clientTypes, setClientTypes] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypePanChar, setNewTypePanChar] = useState('');
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // Validate PAN locally in real-time
  const getClientPanValidation = () => {
    const pan = (clientForm?.pan_no || '').toUpperCase();
    if (!pan) return null;
    
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    if (!panRegex.test(pan)) {
      return { valid: false, msg: 'Invalid general PAN format (e.g. ABCDE1234F).' };
    }

    const typeOption = clientTypes.find(t => t.name === clientForm.type);
    if (typeOption && typeOption.pan_char) {
      const expectedChar = typeOption.pan_char.toUpperCase();
      const fourthChar = pan.charAt(3);
      if (fourthChar !== expectedChar) {
        return { 
          valid: false, 
          msg: `4th character of PAN must be "${expectedChar}" for type "${clientForm.type}".` 
        };
      }
    }

    return { valid: true, msg: 'PAN format is fully valid and verified!' };
  };

  const clientPanStatus = getClientPanValidation();

  // Validate GST locally in real-time
  const getClientGstValidation = () => {
    const gst = (clientForm?.gst_number || '').trim().toUpperCase();
    if (!gst) return null;
    
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstRegex.test(gst)) {
      return { valid: false, msg: 'Invalid GST format (e.g. 22AAAAA0000A1Z5).' };
    }

    if (clientForm?.pan_no) {
      const panInGst = gst.substring(2, 12);
      if (panInGst !== clientForm.pan_no.toUpperCase()) {
        return { valid: false, msg: `GST characters 3-12 (${panInGst}) must match PAN No (${clientForm.pan_no.toUpperCase()}).` };
      }
    }

    return { valid: true, msg: 'GST format is fully valid and verified!' };
  };

  const clientGstStatus = getClientGstValidation();

  // Generate AIS & TIS password dynamically in real-time
  useEffect(() => {
    if (clientForm?.pan_no && clientForm?.dob) {
      const panLower = clientForm.pan_no.toLowerCase();
      const dobParts = clientForm.dob.split('-'); // YYYY-MM-DD
      if (dobParts.length === 3) {
        const year = dobParts[0];
        const month = dobParts[1];
        const day = dobParts[2];
        const dobDigits = `${day}${month}${year}`;
        setClientForm(prev => ({
          ...prev,
          credentials: {
            ...(prev?.credentials || {}),
            ais_tis_password: `${panLower}${dobDigits}`
          }
        }));
      }
    }
  }, [clientForm?.pan_no, clientForm?.dob]);

  // Work Type Modal States
  const [addWorkTypeOpen, setAddWorkTypeOpen] = useState(false);
  const [workTypeName, setWorkTypeName] = useState('');
  const [workTypeError, setWorkTypeError] = useState('');
  const [savingWorkType, setSavingWorkType] = useState(false);

  const fieldsContainerRef = useRef(null);
  const sidebarRef = useRef(null);

  const handleAddRolePermission = () => {
    if (!selectedRoleId) {
      toast_pkg.error('Please select a role.');
      return;
    }
    const roleIdNum = Number(selectedRoleId);
    if (sheetPermissions.some(p => Number(p.role_id) === roleIdNum)) {
      toast_pkg.error('This role is already added.');
      return;
    }
    setSheetPermissions(prev => [
      ...prev,
      {
        role_id: roleIdNum,
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
      value: type.id === 'labels' ? [] : (type.id === 'progress_manual' ? 50 : (type.id === 'phone' ? '+91 ' : (type.id === 'checkbox' ? [] : ''))),
      options: (type.id === 'dropdown' || type.id === 'labels' || type.id === 'checkbox') ? ['Option 1', 'Option 2'] : [],
      checkType: type.id === 'checkbox' ? 'multicheck' : undefined,
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
    setSelectedFields(prev => prev.filter(fid => fid !== id));
  };

  const removeSelectedFields = () => {
    if (selectedFields.length === 0) return;
    setDeleteBulkOpen(true);
  };

  const handleConfirmBulkDelete = () => {
    setFormSchema(prev => prev.filter(f => !selectedFields.includes(f.id)));
    setSelectedFields([]);
    setActiveFieldId(null);
    setDeleteBulkOpen(false);
    showToast(`${selectedFields.length} fields removed`);
  };

  const toggleSelectField = (id) => {
    setSelectedFields(prev =>
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
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
    if (field.type === 'hyperlink' && field.value) {
      const val = field.value.trim();
      let formattedVal = val;
      if (val && !/^https?:\/\//i.test(val)) {
        formattedVal = 'https://' + val;
      }
      try {
        new URL(formattedVal);
        field.error = '';
      } catch (e) {
        field.error = 'Invalid URL format (e.g. www.google.com)';
        return false;
      }
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

    const staticFields = {
      form_name: formSchema.find(f => f.id === 'static_form_name')?.value,
      client_id: formSchema.find(f => f.id === 'static_client_name')?.value || null,
      work_type_id: formSchema.find(f => f.id === 'static_work_type')?.value,
      allocated_to: formSchema.find(f => f.id === 'static_assignee')?.value || null,
      date_inward: formSchema.find(f => f.id === 'static_created_date')?.value,
      date_allocated: formSchema.find(f => f.id === 'static_created_date')?.value,
      due_date: formSchema.find(f => f.id === 'static_due_date')?.value || null,
      status: formSchema.find(f => f.id === 'static_sheet_status')?.value,
      remarks: formSchema.find(f => f.id === 'static_remarks')?.value,
      task_particular: formSchema.find(f => f.id === 'static_task_particular')?.value || null,
      sub_status: formSchema.find(f => f.id === 'static_sub_status')?.value || null,
      feedback: formSchema.find(f => f.id === 'static_feedback')?.value || null,
      entry_date: formSchema.find(f => f.id === 'static_entry_date')?.value || null
    };

    const dynamicFields = {
      schema: formSchema.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder,
        required: !!f.required,
        options: f.options || [],
        checkType: f.checkType,
        static: !!f.static
      }))
    };
    formSchema.forEach(f => {
      if (!f.static) {
        dynamicFields[f.label] = f.value;
      }
    });

    const caFeedbackVal = formSchema.find(f => f.id === 'static_ca_feedback')?.value;
    if (caFeedbackVal !== undefined && caFeedbackVal !== null && caFeedbackVal !== '') {
      dynamicFields['CA Feedback'] = caFeedbackVal;
    }
    const caRatingVal = formSchema.find(f => f.id === 'static_ca_rating')?.value;
    if (caRatingVal !== undefined && caRatingVal !== null && caRatingVal !== '') {
      dynamicFields['CA Rating'] = caRatingVal;
    }

    setSaving(true);
    try {
      const response = await api.post('/ca/tasks', {
        ...staticFields,
        dynamic_fields: dynamicFields,
        remarks: formSchema.find(f => f.id === 'static_remarks')?.value || 'Created via Task Builder',
        permissions: sheetPermissions,
        allow_attachments: allowAttachments,
      });

      showToast('Sheet created successfully!');
      // Optionally redirect or reset form
      setTimeout(() => {
        window.location.href = '/ca/tasks';
      }, 1500);
    } catch (err) {
      console.error(err);
      showToast('Failed to create Sheet. ' + (err.response?.data?.message || ''));
    } finally {
      setSaving(false);
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
    // Run pre-submit PAN validation check
    if (clientPanStatus && !clientPanStatus.valid) {
      toast_pkg.error(clientPanStatus.msg);
      return;
    }

    // Run pre-submit GST validation check
    if (clientGstStatus && !clientGstStatus.valid) {
      toast_pkg.error(clientGstStatus.msg);
      return;
    }

    // Validate mobile number lengths (exactly 10 digits if provided)
    if (clientForm?.contact && clientForm.contact.replace(/\D/g, '').length !== 10) {
      toast_pkg.error('Contact No must be exactly 10 digits.');
      return;
    }
    if (clientForm?.alternative_contact && clientForm.alternative_contact.replace(/\D/g, '').length !== 10) {
      toast_pkg.error('Alternative Contact No must be exactly 10 digits.');
      return;
    }

    setSavingClient(true);
    setClientErrors({});
    try {
      const payload = {
        ...clientForm,
        pan_no: clientForm.pan_no.toUpperCase() // Save always capitalized
      };
      const res = await api.post('/ca/clients', payload);
      setAddClientOpen(false);
      showToast('Client registered successfully');
      await fetchClients(res.data.data.id);
    } catch (e) { 
      setClientErrors(e.response?.data?.errors ?? {});
      toast_pkg.error('Please fix validation errors');
    } finally { 
      setSavingClient(false); 
    }
  };

  const handleCreateType = async () => {
    if (!newTypeName) return;
    setSavingClient(true);
    try {
      const res = await api.post('/ca/client-types', {
        name: newTypeName,
        pan_char: newTypePanChar
      });
      setClientTypes(prev => [...prev, res.data.data]);
      setClientForm(prev => ({ ...prev, type: res.data.data.name }));
      setNewTypeName('');
      setNewTypePanChar('');
      setAddTypeOpen(false);
      toast_pkg.success('Custom client type added successfully');
    } catch (e) {
      toast_pkg.error(e.response?.data?.message || 'Failed to create client type');
    } finally {
      setSavingClient(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    setSavingClient(true);
    try {
      const res = await api.post('/ca/client-groups', {
        name: newGroupName
      });
      setClientGroups(prev => [...prev, res.data.data]);
      setClientForm(prev => ({ ...prev, group: res.data.data.name }));
      setNewGroupName('');
      setAddGroupOpen(false);
      toast_pkg.success('Custom client group added successfully');
    } catch (e) {
      toast_pkg.error(e.response?.data?.message || 'Failed to create client group');
    } finally {
      setSavingClient(false);
    }
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
        const [clientsRes, workTypesRes, staffRes, statusesRes, rolesRes, typesRes, groupsRes] = await Promise.all([
          api.get('/ca/clients?per_page=-1'),
          api.get('/ca/work-types'),
          api.get('/ca/staff?per_page=-1'),
          api.get('/task-statuses'),
          api.get('/ca/roles'),
          api.get('/ca/client-types'),
          api.get('/ca/client-groups')
        ]);

        setAvailableRoles(rolesRes.data.data || []);
        setClientTypes(typesRes.data.data || []);
        setClientGroups(groupsRes.data.data || []);

        setFormSchema(prev => prev.map(field => {
          if (field.id === 'static_client_name') {
            return { ...field, options: clientsRes.data.data.map(c => ({ value: c.id, label: c.name })) };
          }
          if (field.id === 'static_work_type') {
            return { ...field, options: workTypesRes.data.data.map(w => ({ value: w.id, label: w.name })) };
          }
          if (field.id === 'static_assignee') {
            return { ...field, options: staffRes.data.data.map(s => ({ value: s.id, label: s.name })) };
          }
          if (field.id === 'static_sheet_status') {
            // Keep default options but we could also fetch them
            return field;
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

      if (data.allow_attachments !== undefined) {
        setAllowAttachments(!!data.allow_attachments);
      }

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
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <button
                    onClick={() => navigate('/ca/tasks')}
                    className="p-2 mr-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl transition shadow-sm cursor-pointer z-10"
                    title="Back to Tasks"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
                      {viewMode === 'live' ? 'Active Sheet Form' : 'Sheet Builder'}
                    </h2>
                    <p className="hidden sm:block text-xs text-slate-400 mt-0.5 font-medium">
                      {viewMode === 'live' ? 'Fill in the details below.' : 'Design your custom Sheet entry form below.'}
                    </p>
                  </div>
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
                      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl transition-all duration-300 border shadow-sm ${isSidebarOpen
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
                  {isDuplicating && selectedFields.length > 0 && (
                    <button
                      onClick={removeSelectedFields}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold hover:bg-rose-600 transition shadow-lg shadow-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete ({selectedFields.length})</span>
                    </button>
                  )}
                </div>
              </div>

                        <div className="space-y-8">
                {/* SECTION 1 */}
                <div className="bg-white rounded-3xl border border-slate-100/80 p-6 md:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-[#1F5C99] rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Sheet Meta Information</h3>
                  </div>
                  <div ref={fieldsContainerRef} id="fieldsContainer1" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formSchema.filter(f => f.section === 1).map((field) => (
                      <FormCard
                        key={field.id}
                        field={field}
                        viewMode={viewMode}
                        isActive={activeFieldId === field.id && viewMode === 'builder'}
                        onActive={() => viewMode === 'builder' && setActiveFieldId(field.id)}
                        onUpdate={(key, val) => updateField(field.id, key, val)}
                        onRemove={() => removeField(field.id)}
                        isDuplicating={isDuplicating}
                        isSelected={selectedFields.includes(field.id)}
                        onToggleSelect={() => toggleSelectField(field.id)}
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

                {/* SECTION 2 */}
                <div className="bg-white rounded-3xl border border-slate-100/80 p-6 md:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-[#1F5C99] rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Task Assignment Section</h3>
                  </div>
                  <div id="fieldsContainer2" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {formSchema.filter(f => f.section !== 1).map((field) => (
                      <FormCard
                        key={field.id}
                        field={field}
                        viewMode={viewMode}
                        isActive={activeFieldId === field.id && viewMode === 'builder'}
                        onActive={() => viewMode === 'builder' && setActiveFieldId(field.id)}
                        onUpdate={(key, val) => updateField(field.id, key, val)}
                        onRemove={() => removeField(field.id)}
                        isDuplicating={isDuplicating}
                        isSelected={selectedFields.includes(field.id)}
                        onToggleSelect={() => toggleSelectField(field.id)}
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

                {/* SECTION: Sheet Options */}
                <div className="bg-white rounded-3xl border border-slate-100/80 p-6 md:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-[#1F5C99] rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Sheet Options</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-2 font-semibold">
                    Configure specialized functionality for this sheet.
                  </p>

                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100/50 rounded-2xl max-w-xl">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Allow File Upload / Screenshots</h4>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Allow employees to upload screenshots and files when updating status of this sheet.</p>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={allowAttachments}
                        onChange={(e) => setAllowAttachments(e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                {/* SECTION 3: Roles & Permissions */}
                <div className="bg-white rounded-3xl border border-slate-100/80 p-6 md:p-8 shadow-sm space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-6 bg-[#1F5C99] rounded-full"></div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Roles & Permissions</h3>
                  </div>
                  <p className="text-xs text-slate-500 mb-2 font-semibold">
                    Configure which roles can access this sheet. If no roles are added, all staff members will have full access.
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
                        direction="up"
                        size="sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddRolePermission}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition flex items-center gap-1.5 active:scale-95 shadow-lg shadow-indigo-100/50 h-[38px] shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Role</span>
                    </button>
                  </div>

                  {sheetPermissions.length > 0 ? (
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider border-b border-slate-100">
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4 text-center">Read</th>
                            <th className="px-6 py-4 text-center">Write</th>
                            <th className="px-6 py-4 text-center">Delete</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700 text-sm">
                          {sheetPermissions.map((perm, index) => {
                            const role = availableRoles.find(r => r.id === Number(perm.role_id));
                            return (
                              <tr key={perm.role_id} className="hover:bg-slate-50/50 transition">
                                <td className="px-6 py-4 font-semibold text-slate-800">{role?.name || `Role #${perm.role_id}`}</td>
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_read}
                                    onChange={(e) => handleTogglePermission(index, 'can_read', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_write}
                                    onChange={(e) => handleTogglePermission(index, 'can_write', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm.can_delete}
                                    onChange={(e) => handleTogglePermission(index, 'can_delete', e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
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
                    <div className="p-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-400 font-semibold">No role permissions configured. This sheet will be open to all staff.</p>
                    </div>
                  )}
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
                  <button onClick={submitForm} disabled={saving} className="create-btn disabled:opacity-50">
                    {viewMode === 'builder' ? 'Create Form' : (saving ? 'Publishing...' : 'Submit Form')}
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

      <Modal 
        open={addClientOpen} 
        onClose={() => { 
          setAddClientOpen(false); 
          setClientForm(EMPTY_CLIENT_FORM); 
          setClientErrors({}); 
        }} 
        title="Register New CA Business Client" 
        width="max-w-4xl"
      >
        <div className="space-y-6 px-1">
          {/* Main Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Client Name */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Client Name *</label>
                {clientForm.name && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.name, 'Client Name')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                value={clientForm.name} 
                onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} 
                placeholder="Enter Client Name" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.name && <p className="text-[10px] text-red-500 mt-1">{clientErrors.name[0]}</p>}
            </div>

            {/* Client Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Type *</label>
              <select 
                value={clientForm.type} 
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setAddTypeOpen(true);
                  } else {
                    setClientForm(f => ({ ...f, type: e.target.value }));
                  }
                }} 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
              >
                <option value="">Select Type...</option>
                {clientTypes.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
                <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
              </select>
              {clientErrors.type && <p className="text-[10px] text-red-500 mt-1">{clientErrors.type[0]}</p>}
            </div>

            {/* Client Name As per PAN */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Client Name As Per PAN</label>
                {clientForm.name_as_per_pan && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.name_as_per_pan, 'Name As Per PAN')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                value={clientForm.name_as_per_pan} 
                onChange={e => setClientForm(f => ({ ...f, name_as_per_pan: e.target.value }))} 
                placeholder="Enter Name exactly as printed on PAN" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.name_as_per_pan && <p className="text-[10px] text-red-500 mt-1">{clientErrors.name_as_per_pan[0]}</p>}
            </div>

            {/* PAN Number with Validation Indicator */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">PAN No *</label>
                {clientForm.pan_no && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.pan_no, 'PAN No')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  maxLength={10}
                  value={clientForm.pan_no} 
                  onChange={e => setClientForm(f => ({ ...f, pan_no: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))} 
                  placeholder="Enter 10-Digit PAN (e.g. BIBPB1899L)" 
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400 uppercase pr-8" 
                />
                {clientPanStatus && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {clientPanStatus.valid ? (
                      <ShieldCheck className="text-emerald-500 w-4 h-4" />
                    ) : (
                      <ShieldAlert className="text-rose-500 w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              {clientPanStatus && (
                <p className={`text-[9px] font-bold mt-1 ${clientPanStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {clientPanStatus.msg}
                </p>
              )}
              {clientErrors.pan_no && <p className="text-[10px] text-red-500 mt-1">{clientErrors.pan_no[0]}</p>}
            </div>

            {/* Group */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Group *</label>
              <select 
                value={clientForm.group} 
                onChange={e => {
                  if (e.target.value === 'ADD_NEW') {
                    setAddGroupOpen(true);
                  } else {
                    setClientForm(f => ({ ...f, group: e.target.value }));
                  }
                }} 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
              >
                <option value="">Select Group...</option>
                {clientGroups.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
                <option value="ADD_NEW" className="text-indigo-600 font-bold bg-slate-50">+ Add New Option...</option>
              </select>
              {clientErrors.group && <p className="text-[10px] text-red-500 mt-1">{clientErrors.group[0]}</p>}
            </div>

            {/* Contact No */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Contact No</label>
                {clientForm.contact && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.contact, 'Contact No')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                maxLength={10}
                value={clientForm.contact} 
                onChange={e => setClientForm(f => ({ ...f, contact: e.target.value.replace(/\D/g, '') }))} 
                placeholder="10-digit mobile number" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.contact && <p className="text-[10px] text-red-500 mt-1">{clientErrors.contact[0]}</p>}
            </div>

            {/* Alternative Contact No */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Alternative Contact No</label>
                {clientForm.alternative_contact && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.alternative_contact, 'Alternative Contact No')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                maxLength={10}
                value={clientForm.alternative_contact} 
                onChange={e => setClientForm(f => ({ ...f, alternative_contact: e.target.value.replace(/\D/g, '') }))} 
                placeholder="Alternative 10-digit number" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.alternative_contact && <p className="text-[10px] text-red-500 mt-1">{clientErrors.alternative_contact[0]}</p>}
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Email ID</label>
                {clientForm.email && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.email, 'Email ID')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="email" 
                value={clientForm.email} 
                onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} 
                placeholder="client@example.com" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.email && <p className="text-[10px] text-red-500 mt-1">{clientErrors.email[0]}</p>}
            </div>

            {/* Reference No */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Reference No</label>
                {clientForm.reference_no && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.reference_no, 'Reference No')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                value={clientForm.reference_no} 
                onChange={e => setClientForm(f => ({ ...f, reference_no: e.target.value }))} 
                placeholder="Enter reference details" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.reference_no && <p className="text-[10px] text-red-500 mt-1">{clientErrors.reference_no[0]}</p>}
            </div>

            {/* City */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">City</label>
                {clientForm.city && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.city, 'City')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                value={clientForm.city} 
                onChange={e => setClientForm(f => ({ ...f, city: e.target.value }))} 
                placeholder="Enter City" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.city && <p className="text-[10px] text-red-500 mt-1">{clientErrors.city[0]}</p>}
            </div>

            {/* Pin Code */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Pin Code</label>
                {clientForm.pin_code && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.pin_code, 'Pin Code')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                maxLength={6}
                value={clientForm.pin_code} 
                onChange={e => setClientForm(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))} 
                placeholder="6-digit postal code" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.pin_code && <p className="text-[10px] text-red-500 mt-1">{clientErrors.pin_code[0]}</p>}
            </div>

            {/* State */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">State</label>
                {clientForm.state && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.state, 'State')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <input 
                type="text" 
                value={clientForm.state} 
                onChange={e => setClientForm(f => ({ ...f, state: e.target.value }))} 
                placeholder="Enter State" 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.state && <p className="text-[10px] text-red-500 mt-1">{clientErrors.state[0]}</p>}
            </div>

            {/* Date of Birth */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">Date Of Birth *</label>
                {clientForm.dob && (
                  <button
                    type="button"
                    onClick={() => {
                      const parts = clientForm.dob.split('-');
                      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}` : clientForm.dob;
                      handleCopy(formatted, 'Date of Birth (dd/mm/yy)');
                    }}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy (dd/mm/yy)
                  </button>
                )}
              </div>
              <input 
                type="date" 
                value={clientForm.dob} 
                onChange={e => setClientForm(f => ({ ...f, dob: e.target.value }))} 
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400" 
              />
              {clientErrors.dob && <p className="text-[10px] text-red-500 mt-1">{clientErrors.dob[0]}</p>}
            </div>

            {/* GST Number */}
            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block !mb-0">GST No</label>
                {clientForm.gst_number && (
                  <button
                    type="button"
                    onClick={() => handleCopy(clientForm.gst_number, 'GST No')}
                    className="text-[9px] text-[#1F5C99] hover:underline font-bold flex items-center gap-1 transition"
                  >
                    <Copy size={10} /> Copy
                  </button>
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={clientForm.gst_number || ''} 
                  onChange={e => setClientForm(f => ({ ...f, gst_number: e.target.value.toUpperCase() }))} 
                  placeholder="GST Identification Number" 
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400 pr-8" 
                  autoComplete="off"
                />
                {clientGstStatus && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {clientGstStatus.valid ? (
                      <ShieldCheck className="text-emerald-500 w-4 h-4" />
                    ) : (
                      <ShieldAlert className="text-rose-500 w-4 h-4" />
                    )}
                  </div>
                )}
              </div>
              {clientGstStatus && (
                <p className={`text-[9px] font-bold mt-1 ${clientGstStatus.valid ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {clientGstStatus.msg}
                </p>
              )}
              {clientErrors.gst_number && <p className="text-[10px] text-red-500 mt-1">{clientErrors.gst_number[0]}</p>}
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
                className="text-xs text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
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
                  {/* EFILING row (Manual) */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Globe size={13} className="text-slate-400" />
                        <a 
                          href="https://eportal.incometax.gov.in/iec/foservices/#/login" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                        >
                          WWW.EFILING INCOME TAX <ExternalLink size={12} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy('https://eportal.incometax.gov.in/iec/foservices/#/login', 'IT Portal URL')}
                          className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                          title="Copy IT URL"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-indigo-100">
                        EFILING
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span>{clientForm.pan_no ? clientForm.pan_no : 'LINKED TO PAN'}</span>
                        {clientForm.pan_no && (
                          <button
                            type="button"
                            onClick={() => handleCopy(clientForm.pan_no, 'User ID (PAN)')}
                            className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                            title="Copy User ID"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center">
                        <input 
                          type={showPasswords ? "text" : "password"} 
                          value={clientForm.credentials.efiling_password}
                          onChange={e => setClientForm(f => ({
                            ...f,
                            credentials: {
                              ...f.credentials,
                              efiling_password: e.target.value
                            }
                          }))}
                          placeholder="Type manual password..."
                          className="w-full pl-2 pr-8 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none text-xs font-semibold text-slate-700"
                          autoComplete="new-password"
                        />
                        {clientForm.credentials.efiling_password && (
                          <button
                            type="button"
                            onClick={() => handleCopy(clientForm.credentials.efiling_password, 'E-filing Password')}
                            className="absolute right-2 text-slate-400 hover:text-[#1F5C99] transition"
                            title="Copy Password"
                          >
                            <Copy size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* AIS & TIS row (Auto generated) */}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Globe size={13} className="text-slate-400" />
                        <a 
                          href="https://eportal.incometax.gov.in/iec/foservices/#/login" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#1F5C99] hover:underline font-bold flex items-center gap-1"
                        >
                          WWW.EFILING INCOME TAX <ExternalLink size={12} />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopy('https://eportal.incometax.gov.in/iec/foservices/#/login', 'IT Portal URL')}
                          className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                          title="Copy IT URL"
                        >
                          <Copy size={11} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-100">
                        AIS & TIS
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span>{clientForm.pan_no ? clientForm.pan_no : 'LINKED TO PAN'}</span>
                        {clientForm.pan_no && (
                          <button
                            type="button"
                            onClick={() => handleCopy(clientForm.pan_no, 'User ID (PAN)')}
                            className="p-1 text-slate-400 hover:text-[#1F5C99] transition rounded hover:bg-slate-100"
                            title="Copy User ID"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <div className="relative flex items-center">
                          <input 
                            type={showPasswords ? "text" : "password"} 
                            value={clientForm.credentials.ais_tis_password}
                            disabled
                            className="w-full pl-2 pr-8 py-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold cursor-not-allowed"
                            autoComplete="new-password"
                          />
                          {clientForm.credentials.ais_tis_password && (
                            <button
                              type="button"
                              onClick={() => handleCopy(clientForm.credentials.ais_tis_password, 'AIS/TIS Password')}
                              className="absolute right-2 text-slate-400 hover:text-[#1F5C99] transition"
                              title="Copy Password"
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 mt-1">
                          Auto Generated: lower(PAN) + DOB
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Footer Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              onClick={() => setAddClientOpen(false)} 
              className="px-5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveClient} 
              disabled={savingClient} 
              className="px-6 py-2.5 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-60 transition"
            >
              {savingClient ? 'Registering...' : 'Register Client'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Dropdown Lookups: ADD NEW TYPE Sub-modal */}
      <Modal open={addTypeOpen} onClose={() => setAddTypeOpen(false)} title="Create Custom Client Type">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Type Name *</label>
            <input 
              type="text"
              placeholder="e.g. Sole Proprietorship"
              value={newTypeName}
              onChange={e => setNewTypeName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Indian PAN 4th Character (Optional)</label>
            <input 
              type="text"
              maxLength={1}
              placeholder="e.g. F"
              value={newTypePanChar}
              onChange={e => setNewTypePanChar(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400 uppercase"
            />
            <p className="text-[9px] font-bold text-slate-400 mt-1">
              Used to auto-validate client PAN cards. Example: P for Individual, C for Company, F for Firm.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddTypeOpen(false)} disabled={savingClient} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button onClick={handleCreateType} disabled={savingClient} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50">
              {savingClient ? 'Adding...' : 'Add Type'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Dropdown Lookups: ADD NEW GROUP Sub-modal */}
      <Modal open={addGroupOpen} onClose={() => setAddGroupOpen(false)} title="Create Custom Client Group">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Group Name *</label>
            <input 
              type="text"
              placeholder="e.g. Salary-2027"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition font-semibold text-slate-700 placeholder-slate-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setAddGroupOpen(false)} disabled={savingClient} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button onClick={handleCreateGroup} disabled={savingClient} className="px-4 py-2 text-xs font-bold bg-[#1F5C99] text-white rounded-xl hover:bg-[#154675] disabled:opacity-50">
              {savingClient ? 'Adding...' : 'Add Group'}
            </button>
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

      <ConfirmDialog
        open={deleteBulkOpen}
        onClose={() => setDeleteBulkOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Multiple Fields"
        message={`Are you sure you want to delete ${selectedFields.length} selected fields? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedFields.length} Fields`}
        danger
      />
    </div>
  );
}

function FormCard({ field, viewMode, isActive, onActive, onUpdate, onRemove, isDuplicating, isSelected, onToggleSelect, calculateAutoProgress, modalActions }) {
  const isLive = viewMode === 'live';

  const handleCopy = (e) => {
    e.stopPropagation();
    let textToCopy = '';
    if (field.type === 'labels' && Array.isArray(field.value)) {
      textToCopy = field.value.join(', ');
    } else {
      textToCopy = field.value?.toString() || '';
    }

    if (!textToCopy.trim()) {
      toast.error('Nothing to copy!');
      return;
    }

    navigator.clipboard.writeText(textToCopy);
    toast.success('Copied to clipboard!');
  };

  return (
    <div
      className={`form-card animate-slide-in ${isActive ? 'active' : ''} ${
        field.type === 'subtasks_list' ? 'md:col-span-2' : ''
      }`}
      onClick={onActive}
    >
      <div className={`flex items-center gap-2 ${!isLive ? 'pr-6' : ''}`}>
        {/* Drag handle */}
        {!isLive && (
          <div className="flex items-center gap-2 shrink-0">
            {isDuplicating && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
                className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
              />
            )}
            <div className="drag-handle">
              <GripVertical className="w-4 h-4 text-slate-300" />
            </div>
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
            <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full" onClick={(e) => e.stopPropagation()}>
              <span className="text-[9px] font-bold text-slate-400 uppercase">Req</span>
              <label className={`toggle-switch ${field.id === 'static_form_name' || field.id === 'static_work_type' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => (field.id !== 'static_form_name' && field.id !== 'static_work_type') && onUpdate('required', e.target.checked)}
                  disabled={field.id === 'static_form_name' || field.id === 'static_work_type'}
                />
                <span className="slider"></span>
              </label>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Field input */}
      <div className="field-preview-area relative group/input">
        <FieldInput
          field={field}
          onUpdate={onUpdate}
          calculateAutoProgress={calculateAutoProgress}
          isLive={isLive}
          modalActions={modalActions}
        />
        {field.value && field.type !== 'dropdown' && field.type !== 'subtasks_list' && (
          <button
            onClick={handleCopy}
            className="absolute right-3 top-3 p-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded-lg transition-all shadow-sm z-10"
            title="Copy field content"
          >
            <Copy size={14} />
          </button>
        )}
      </div>

      {isActive && !field.static && (field.type === 'dropdown' || field.type === 'labels' || field.type === 'checkbox') && (
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
                modalActions.setClientForm({
                  name: search,
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
                });
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
    case 'checkbox': {
      const isMulti = (field.checkType || 'multicheck') === 'multicheck';
      const optionsList = field.options || [];

      let selectedValues = [];
      if (Array.isArray(field.value)) {
        selectedValues = field.value;
      } else if (typeof field.value === 'string' && field.value.trim()) {
        const trimmed = field.value.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            selectedValues = JSON.parse(trimmed);
          } catch (e) {
            selectedValues = trimmed.split(',').map(s => s.trim());
          }
        } else {
          selectedValues = trimmed.split(',').map(s => s.trim());
        }
      } else if (typeof field.value === 'boolean') {
        selectedValues = field.value ? optionsList.slice(0, 1) : [];
      }

      if (optionsList.length === 0) {
        const isSingleChecked = field.value === true || String(field.value) === 'true';
        return (
          <label className="group/check flex items-center gap-3 cursor-pointer p-1">
            <input type="checkbox" className="peer sr-only" checked={isSingleChecked} onChange={(e) => onUpdate('value', e.target.checked)} />
            <div className="w-6 h-6 bg-white border-2 border-slate-200 rounded-lg peer-checked:bg-slate-900 peer-checked:border-slate-900 transition-all flex items-center justify-center">
              <Check className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity" strokeWidth={3} />
            </div>
            <span className="text-sm text-slate-600 font-semibold group-hover/check:text-slate-900 transition">{field.placeholder}</span>
          </label>
        );
      }

      const handleOptionToggle = (opt) => {
        if (isMulti) {
          if (selectedValues.includes(opt)) {
            onUpdate('value', selectedValues.filter(v => v !== opt));
          } else {
            onUpdate('value', [...selectedValues, opt]);
          }
        } else {
          if (field.value === opt) {
            onUpdate('value', '');
          } else {
            onUpdate('value', opt);
          }
        }
      };

      return (
        <div className="flex flex-col gap-3 p-1">
          {optionsList.map((opt, index) => {
            const isChecked = isMulti 
              ? selectedValues.includes(opt) 
              : String(field.value) === String(opt);
            
            return (
              <label 
                key={index} 
                className="group/check flex items-center gap-3 cursor-pointer select-none"
                onClick={(e) => {
                  e.preventDefault();
                  handleOptionToggle(opt);
                }}
              >
                <div 
                  className={`w-6 h-6 border-2 transition-all flex items-center justify-center rounded-lg ${
                    isChecked 
                      ? 'bg-slate-900 border-slate-900 text-white' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Check className={`w-4 h-4 text-white transition-opacity ${isChecked ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3.5} />
                </div>
                <span className={`text-sm font-semibold transition ${isChecked ? 'text-slate-900' : 'text-slate-600 group-hover/check:text-slate-900'}`}>
                  {opt}
                </span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'hyperlink': {
      let hrefVal = field.value || '';
      if (hrefVal && !/^https?:\/\//i.test(hrefVal)) {
        hrefVal = 'https://' + hrefVal;
      }
      return (
        <div className="relative flex items-center w-full">
          <input 
            type="text" 
            value={field.value || ''} 
            onChange={(e) => onUpdate('value', e.target.value)} 
            className={`${baseClass} pr-12`} 
            placeholder={field.placeholder || 'e.g. www.google.com'} 
          />
          {field.value && (
            <a 
              href={hrefVal} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="absolute right-12 p-2 text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
              title="Open link"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe size={14} />
            </a>
          )}
        </div>
      );
    }
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
    <div className="mt-6 pt-6 border-t border-slate-100 space-y-5">
      {field.type === 'checkbox' && (
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Selection Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onUpdate('checkType', 'multicheck');
                if (!Array.isArray(field.value)) {
                  onUpdate('value', field.value ? [field.value] : []);
                }
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all ${
                (field.checkType || 'multicheck') === 'multicheck'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                  : 'border-slate-100 text-slate-600 hover:border-slate-200'
              }`}
            >
              Multi-check (Allow Multiple)
            </button>
            <button
              onClick={() => {
                onUpdate('checkType', 'single');
                if (Array.isArray(field.value)) {
                  onUpdate('value', field.value[0] || '');
                }
              }}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl border-2 transition-all ${
                field.checkType === 'single'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                  : 'border-slate-100 text-slate-600 hover:border-slate-200'
              }`}
            >
              Single-check (Radio Style)
            </button>
          </div>
        </div>
      )}

      <div>
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
                  <div className="flex items-center group/title">
                    <input
                      type="text"
                      value={st.title}
                      onChange={e => updateSubtask(i, 'title', e.target.value)}
                      placeholder="e.g. Data Entry"
                      className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900"
                    />
                    <button
                      onClick={() => { navigator.clipboard.writeText(st.title); toast.success('Copied!'); }}
                      className="ml-1 p-1 text-slate-300 hover:text-indigo-600 transition shadow-sm"
                      title="Copy"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
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
                    {['complete', 'work_in_progress', 'pending', 'not_to_be_done', 'other'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
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
                  <div className="flex items-center group/rem">
                    <textarea
                      value={st.remarks}
                      onChange={e => updateSubtask(i, 'remarks', e.target.value)}
                      placeholder="Notes..."
                      rows="1"
                      className="w-full bg-slate-50 border-none rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-slate-900 text-[11px] resize-y min-h-[38px]"
                    />
                    {st.remarks && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(st.remarks); toast.success('Copied!'); }}
                        className="ml-1 p-1 text-slate-300 hover:text-indigo-600 transition shadow-sm"
                        title="Copy"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                  </div>
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
