import React from 'react';
import { Plus, X, Edit2, Download, Paperclip, CheckSquare } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import toast from 'react-hot-toast';
import { formatIndianCurrency, formatIndianCurrencyWithDecimals } from '../../utils/currencyHelper';
import { convertTo12Hour, convertTo24Hour } from '../../utils/dateHelper';
import TimePicker12Hour from '../ui/TimePicker12Hour';

const DEFAULT_SUB_STATUSES = [
    'Documentation pending',
    'Awaiting approval',
    'Completed'
];

const getSubStatusOptions = (task, field) => {
    if (field && Array.isArray(field.options) && field.options.length > 0) {
        return field.options;
    }
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

const parseCurrency = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
};

export default function BulkEditTaskModal({
    isOpen,
    onClose,
    allFields,
    isBillableEnabled = false,
    isAfterSalesEnabled = false,
    clients,
    workTypes,
    staff,
    onSave,
    isAdmin = false,
    task = null
}) {
    const [bulkUpdateTargets, setBulkUpdateTargets] = React.useState({});
    const [isSaving, setIsSaving] = React.useState(false);
    const [bulkMainFields, setBulkMainFields] = React.useState({
        client_id: '',
        work_type_id: '',
        allocated_to: '',
        status: '',
        sub_status: '',
        date_allocated: '',
        form_name: '',
        remarks: '',
        is_verified: false,
        dynamic_data: {}
    });

    React.useEffect(() => {
        if (isOpen) {
            setBulkUpdateTargets({});
            setIsSaving(false);
            setBulkMainFields({
                client_id: '',
                work_type_id: '',
                allocated_to: '',
                status: '',
                sub_status: '',
                date_allocated: '',
                form_name: '',
                remarks: '',
                is_verified: false,
                dynamic_data: {}
            });
        }
    }, [isOpen]);

    const clientOptions = React.useMemo(() => {
        return (clients || []).map(c => ({ value: c.id, label: c.name }));
    }, [clients]);

    const workTypeOptions = React.useMemo(() => {
        return (workTypes || []).map(w => ({ value: w.id, label: w.name }));
    }, [workTypes]);

    // Deduplicate fields by key
    const uniqueFields = React.useMemo(() => {
        const unique = [];
        const seenKeys = new Set();
        for (const f of allFields) {
            if (f && f.key) {
                const normalizedKey = String(f.key).trim().toUpperCase();
                if (!seenKeys.has(normalizedKey)) {
                    seenKeys.add(normalizedKey);
                    unique.push(f);
                }
            }
        }
        return unique;
    }, [allFields]);

    // Auto calculate Balance Amount live when Total Invoice Amount or payments change
    React.useEffect(() => {
        if (!isOpen) return;
        const total = parseCurrency(bulkMainFields.dynamic_data?.['TOTAL INVOICE AMOUNT']);
        const p1 = parseCurrency(bulkMainFields.dynamic_data?.['PAYMENT-1']);
        const p2 = parseCurrency(bulkMainFields.dynamic_data?.['PAYMENT-2']);
        const p3 = parseCurrency(bulkMainFields.dynamic_data?.['PAYMENT-3']);
        const balance = total - (p1 + p2 + p3);
        const balanceStr = formatIndianCurrencyWithDecimals(String(balance));
        
        if (bulkMainFields.dynamic_data?.['BALANCE AMOUNT'] !== balanceStr) {
            setBulkMainFields(prev => ({
                ...prev,
                dynamic_data: {
                    ...(prev.dynamic_data || {}),
                    'BALANCE AMOUNT': balanceStr
                }
            }));
        }
    }, [
        bulkMainFields.dynamic_data?.['TOTAL INVOICE AMOUNT'],
        bulkMainFields.dynamic_data?.['PAYMENT-1'],
        bulkMainFields.dynamic_data?.['PAYMENT-2'],
        bulkMainFields.dynamic_data?.['PAYMENT-3'],
        isOpen
    ]);

    if (!isOpen) return null;

    const handleToggleTarget = (key) => {
        setBulkUpdateTargets(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const renderField = (field) => {
        if (field.key === 'allocated_to') {
            return (
                <div key={field.key} className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-sm">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wide select-none">
                            {field.label}
                        </label>
                    </div>
                    <SearchableSelect
                        value={bulkMainFields.allocated_to || ''}
                        options={(staff || []).map(s => ({ value: s.id, label: s.name }))}
                        placeholder="Select Assigned To..."
                        onChange={(val) => {
                            setBulkMainFields(prev => ({
                                ...prev,
                                allocated_to: val
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, allocated_to: true }));
                        }}
                        size="md"
                    />
                </div>
            );
        }

        if (field.key === 'attachments') return null; // Attachments cannot be bulk updated

        const isFullWidth = ['client_id', 'remarks', 'form_name', 'task_particular', 'feedback', 'is_verified', 'CLIENT FEED BACK', 'OTHER REMARK'].includes(field.key) || 
                           (field.label && (field.label.toLowerCase().includes('remarks') || field.label.toLowerCase().includes('name') || field.label.toLowerCase().includes('text') || field.label.toLowerCase().includes('particular') || field.label.toLowerCase().includes('remark') || field.label.toLowerCase().includes('feedback')));
        
        const isDate = field.type === 'date' || field.key === 'date_allocated';
        const isTime = field.type === 'time';
        const isReadOnly = field.key === 'BALANCE AMOUNT';

        return (
            <div key={field.key} className={`space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/60 shadow-sm ${isFullWidth ? 'md:col-span-2' : ''}`}>
                <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wide select-none">
                        {field.label}
                    </label>
                </div>
                
                {field.key === 'client_id' ? (
                    <SearchableSelect
                        value={bulkMainFields.client_id || ''}
                        options={clientOptions}
                        placeholder="Select Client..."
                        onChange={(val) => {
                            setBulkMainFields(prev => ({
                                ...prev,
                                client_id: val
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, client_id: true }));
                        }}
                        size="md"
                    />
                ) : field.key === 'work_type_id' ? (
                    <SearchableSelect
                        value={bulkMainFields.work_type_id || ''}
                        options={workTypeOptions}
                        placeholder="Select Work Type..."
                        onChange={(val) => {
                            setBulkMainFields(prev => ({ ...prev, work_type_id: val }));
                            setBulkUpdateTargets(prev => ({ ...prev, work_type_id: true }));
                        }}
                        size="md"
                    />
                ) : field.key === 'status' ? (
                    <select
                        value={bulkMainFields.status || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBulkMainFields(prev => ({ ...prev, status: val }));
                            setBulkUpdateTargets(prev => ({ ...prev, status: true }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="">— Select Status —</option>
                        <option value="assigned">Assigned</option>
                        <option value="complete">Complete</option>
                        <option value="work_in_progress">Work In Progress</option>
                        <option value="pending">Pending</option>
                        <option value="not_to_be_done">Not To Be Done</option>
                        <option value="other">Other</option>
                    </select>
                ) : field.key === 'sub_status' ? (
                    <select
                        value={bulkMainFields.sub_status || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBulkMainFields(prev => ({ ...prev, sub_status: val }));
                            setBulkUpdateTargets(prev => ({ ...prev, sub_status: true }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="">— Select Sub Status —</option>
                        {getSubStatusOptions(task, field).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : isDate ? (
                    <input
                        type="date"
                        value={
                            field.isStatic 
                            ? (bulkMainFields[field.key] || '') 
                            : (bulkMainFields.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (field.isStatic) {
                                setBulkMainFields(prev => ({ ...prev, [field.key]: val }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            } else {
                                setBulkMainFields(prev => ({
                                    ...prev,
                                    dynamic_data: {
                                        ...(prev.dynamic_data || {}),
                                        [field.key]: val
                                    }
                                }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : isTime ? (
                    <TimePicker12Hour
                        value={convertTo24Hour(bulkMainFields.dynamic_data?.[field.key] || '')}
                        onChange={(val) => {
                            const formattedTime = convertTo12Hour(val);
                            setBulkMainFields(prev => ({
                                ...prev,
                                dynamic_data: {
                                    ...(prev.dynamic_data || {}),
                                    [field.key]: formattedTime
                                }
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.key === 'form_name' ? (
                    <input
                        type="text"
                        value={bulkMainFields.form_name || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBulkMainFields(prev => ({ ...prev, form_name: val }));
                            setBulkUpdateTargets(prev => ({ ...prev, form_name: true }));
                        }}
                        placeholder="Sheet Name..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.key === 'is_verified' ? (
                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-155 w-full">
                        <div>
                            <p className="text-xs font-black text-slate-750 uppercase tracking-tight">Toggle Verification</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                {bulkMainFields.is_verified ? 'Verify & Lock' : 'Unlock & Unverify'}
                            </p>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => {
                                    setBulkMainFields(prev => ({ ...prev, is_verified: !prev.is_verified }));
                                    setBulkUpdateTargets(prev => ({ ...prev, is_verified: true }));
                                }}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer disabled:opacity-50 ${
                                    bulkMainFields.is_verified 
                                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                                        : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                }`}
                            >
                                {bulkMainFields.is_verified ? 'Verify & Lock' : 'Unlock / Unverify'}
                            </button>
                        </div>
                    </div>
                ) : field.type === 'checkbox' ? (
                    field.options && field.options.length > 0 ? (
                        <div className="flex flex-col gap-2 mt-2">
                            {field.options.filter(opt => opt !== null && opt !== undefined).map((opt, i) => {
                                const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                const optLabel = typeof opt === 'object' ? opt.label : opt;
                                const currentVals = Array.isArray(bulkMainFields.dynamic_data?.[field.key]) ? bulkMainFields.dynamic_data[field.key] : (bulkMainFields.dynamic_data?.[field.key] ? [bulkMainFields.dynamic_data[field.key]] : []);
                                const isChecked = currentVals.includes(optVal);
                                
                                return (
                                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                                let newVals = [...currentVals];
                                                if (e.target.checked) {
                                                    newVals.push(optVal);
                                                } else {
                                                    newVals = newVals.filter(v => v !== optVal);
                                                }
                                                setBulkMainFields(prev => ({
                                                    ...prev,
                                                    dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: newVals }
                                                }));
                                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                                            }}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-sm text-slate-705 font-medium">{optLabel}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex items-center h-[38px]">
                            <input
                                type="checkbox"
                                checked={!!bulkMainFields.dynamic_data?.[field.key]}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    setBulkMainFields(prev => ({
                                        ...prev,
                                        dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: checked }
                                    }));
                                    setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                                }}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            <span className="ml-3 text-sm font-semibold text-slate-700 cursor-pointer" onClick={() => {
                                setBulkMainFields(prev => ({
                                    ...prev,
                                    dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: !prev.dynamic_data?.[field.key] }
                                }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            }}>Toggle</span>
                        </div>
                    )
                ) : field.label === 'CA Rating' ? (
                    <div className="flex items-center gap-1.5 text-amber-500 text-xl leading-none py-2 select-none">
                        {(() => {
                            const currentRating = parseInt(bulkMainFields.dynamic_data?.['CA Rating'] || '0');
                            return Array.from({ length: 5 }).map((_, i) => {
                                const starNum = i + 1;
                                const isFilled = starNum <= currentRating;
                                return (
                                    <button 
                                        key={i} 
                                        type="button"
                                        onClick={() => {
                                            const nextVal = currentRating === starNum ? '0' : String(starNum);
                                            setBulkMainFields(prev => ({
                                                ...prev,
                                                dynamic_data: {
                                                    ...(prev.dynamic_data || {}),
                                                    'CA Rating': nextVal
                                                }
                                            }));
                                            setBulkUpdateTargets(prev => ({ ...prev, 'CA Rating': true }));
                                        }}
                                        className={`transition-all hover:scale-125 ${isFilled ? 'text-amber-500 font-bold' : 'text-slate-200 hover:text-amber-400'} disabled:cursor-not-allowed disabled:opacity-60`}
                                        title={`Rate ${starNum} Stars`}
                                    >
                                        ★
                                    </button>
                                );
                            });
                        })()}
                        <span className="text-xs font-extrabold text-slate-400 ml-1.5 uppercase tracking-wide">
                            ({bulkMainFields.dynamic_data?.['CA Rating'] || '0'}/5)
                        </span>
                    </div>
                ) : field.type === 'dropdown' ? (
                    <select
                        value={bulkMainFields.dynamic_data?.[field.key] || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBulkMainFields(prev => ({
                                ...prev,
                                dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: val }
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="">— Select {field.label} —</option>
                        {field.options && field.options.filter(opt => opt !== null && opt !== undefined).map((opt, i) => {
                            const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            return <option key={i} value={optVal}>{optLabel}</option>;
                        })}
                    </select>
                ) : field.type === 'progress_auto' ? (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-white border border-slate-100/80 shadow-inner">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Auto Progress (Calculated automatically per row)</span>
                    </div>
                ) : field.type === 'progress_manual' ? (
                    <div className="space-y-2 p-3 rounded-2xl bg-white border border-slate-150 shadow-inner">
                        {(() => {
                            const value = bulkMainFields.dynamic_data?.[field.key] ?? '0';
                            const parsedVal = Math.min(100, Math.max(0, parseInt(value) || 0));

                            let badgeBg = 'bg-rose-50 border-rose-100 text-rose-600';
                            if (parsedVal >= 40 && parsedVal < 90) {
                                badgeBg = 'bg-teal-50 border-teal-100 text-teal-750';
                            } else if (parsedVal >= 90) {
                                badgeBg = 'bg-emerald-50 border-emerald-100 text-emerald-600';
                            }

                            return (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Manual Progress</span>
                                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-tighter border shadow-sm ${badgeBg}`}>{parsedVal}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={parsedVal}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setBulkMainFields(prev => ({
                                                ...prev,
                                                dynamic_data: {
                                                    ...(prev.dynamic_data || {}),
                                                    [field.key]: val
                                                }
                                            }));
                                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                                        }}
                                        className="w-full h-3 rounded-full appearance-none cursor-pointer focus:outline-none transition-all outline-none shadow-inner border border-slate-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{
                                            background: `linear-gradient(to right, ${parsedVal < 40 ? '#f43f5e, #f59e0b' : parsedVal < 90 ? '#3b82f6, #4f46e5' : '#10b981, #14b8a6'} ${parsedVal}%, #f1f5f9 ${parsedVal}%)`
                                        }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                ) : field.type === 'currency' ? (
                    <input
                        type="text"
                        value={bulkMainFields.dynamic_data?.[field.key] || ''}
                        onChange={(e) => {
                            const formatted = formatIndianCurrency(e.target.value);
                            setBulkMainFields(prev => ({
                                ...prev,
                                dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: formatted }
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                        }}
                        onBlur={(e) => {
                            const finalVal = formatIndianCurrencyWithDecimals(e.target.value);
                            setBulkMainFields(prev => ({
                                ...prev,
                                dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: finalVal }
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                        }}
                        disabled={isReadOnly}
                        placeholder={field.placeholder || `Enter amount for ${field.label}...`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.type === 'longtext' ? (
                    <textarea
                        value={bulkMainFields.dynamic_data?.[field.key] || ''}
                        onChange={(e) => {
                            const val = e.target.value;
                            setBulkMainFields(prev => ({
                                ...prev,
                                dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: val }
                            }));
                            setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                        }}
                        placeholder={`Enter details for ${field.label}...`}
                        rows={3}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed resize-y"
                    />
                ) : ['number', 'email', 'phone', 'hyperlink'].includes(field.type) ? (
                    <input
                        type={field.type === 'phone' ? 'tel' : field.type === 'hyperlink' ? 'url' : field.type}
                        value={
                            field.isStatic 
                            ? (bulkMainFields[field.key] || '') 
                            : (bulkMainFields.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (field.isStatic) {
                                setBulkMainFields(prev => ({ ...prev, [field.key]: val }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            } else {
                                setBulkMainFields(prev => ({
                                    ...prev, 
                                    dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: val }
                                }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            }
                        }}
                        placeholder={field.placeholder || `Enter ${field.label}...`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : (
                    <input
                        type="text"
                        value={
                            field.isStatic 
                            ? (bulkMainFields[field.key] || '') 
                            : (bulkMainFields.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (field.isStatic) {
                                setBulkMainFields(prev => ({ ...prev, [field.key]: val }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            } else {
                                setBulkMainFields(prev => ({
                                    ...prev, 
                                    dynamic_data: { ...(prev.dynamic_data || {}), [field.key]: val }
                                }));
                                setBulkUpdateTargets(prev => ({ ...prev, [field.key]: true }));
                            }
                        }}
                        placeholder={`Enter ${field.label}...`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                )}
            </div>
        );
    };

    const handleApplyUpdates = async () => {
        const checkedKeys = Object.keys(bulkUpdateTargets).filter(k => bulkUpdateTargets[k]);
        if (checkedKeys.length === 0) {
            toast.error("Please select at least one field to update!");
            return;
        }
        setIsSaving(true);
        try {
            await onSave(bulkMainFields, bulkUpdateTargets);
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                            <CheckSquare size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">Bulk Edit Selected Rows</h2>
                            <p className="text-xs text-slate-500 font-medium">Toggle checkboxes next to labels to apply values to selected rows</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-2 hover:bg-slate-200 text-slate-500 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className={`p-6 overflow-y-auto flex-1 bg-white ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
                    {/* Main section fields */}
                    <div className="space-y-4 mb-8">
                        <div className="flex items-center gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-200/40">
                            <div className="w-2 h-5 bg-slate-400 rounded-full"></div>
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Main Information</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            {uniqueFields.filter(f => {
                                const billingKeys = [
                                    'BILL NO', 'BILL AMOUNT', 'INVOICE SENT TO CLIENT', 'DATE OF SENDING TO CLIENT', 'STATUS',
                                    'TASK IS BILLABLE OR NOT', 'INVOICE IS CREATED', 'CREATED BY', 'VERIFY BY', 'TOTAL INVOICE AMOUNT',
                                    'DATE OF INVOICE', 'INVOICE SENT MODE / FROM', 'DATE OF SENT', 'PAYMENT-1', 'DATE-1', 'PAYMENT-2',
                                    'DATE-2', 'PAYMENT-3', 'DATE-3', 'BALANCE AMOUNT', 'BILLING FOLLOW UP', 'PR ACTIVE UPDATION', 'FINAL REMARK'
                                ].map(k => k.trim().toUpperCase());
                                const afterSalesKeys = [
                                    'CUSTOMER SERVICE CALL', 'DATE OF CALLING', 'CALL BY WHOM', 'CLIENT FEED BACK', 'GOOGLE REVIEW',
                                    'DATE OF GOOGLE REVIEW', 'APP DOWN LOADED', 'MAHESH SIR MOBILE SAVED', 'SOCIAL MEDIA CONNECTION', 'OTHER REMARK'
                                ].map(k => k.trim().toUpperCase());
                                const cleanKey = String(f.key || '').trim().toUpperCase();
                                return !billingKeys.includes(cleanKey) && !afterSalesKeys.includes(cleanKey) && Number(f.section) !== 3 && Number(f.section) !== 4;
                            }).map(field => renderField(field))}
                        </div>
                    </div>

                    {/* Billing Section */}
                    {isBillableEnabled && (
                        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex items-center gap-2 mb-4 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100/30">
                                <div className="w-2 h-5 bg-indigo-600 rounded-full"></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Billing Information</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {uniqueFields.filter(f => {
                                    const billingKeys = [
                                        'BILL NO', 'BILL AMOUNT', 'INVOICE SENT TO CLIENT', 'DATE OF SENDING TO CLIENT', 'STATUS',
                                        'TASK IS BILLABLE OR NOT', 'INVOICE IS CREATED', 'CREATED BY', 'VERIFY BY', 'TOTAL INVOICE AMOUNT',
                                        'DATE OF INVOICE', 'INVOICE SENT MODE / FROM', 'DATE OF SENT', 'PAYMENT-1', 'DATE-1', 'PAYMENT-2',
                                        'DATE-2', 'PAYMENT-3', 'DATE-3', 'BALANCE AMOUNT', 'BILLING FOLLOW UP', 'PR ACTIVE UPDATION', 'FINAL REMARK'
                                    ].map(k => k.trim().toUpperCase());
                                    const cleanKey = String(f.key || '').trim().toUpperCase();
                                    return billingKeys.includes(cleanKey) || Number(f.section) === 3;
                                }).map(field => renderField(field))}
                            </div>
                        </div>
                    )}
 
                    {/* After Sales Services Section */}
                    {isAfterSalesEnabled && (
                        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex items-center gap-2 mb-4 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/30">
                                <div className="w-2 h-5 bg-emerald-600 rounded-full"></div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">After Sales Services</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {uniqueFields.filter(f => {
                                    const afterSalesKeys = [
                                        'CUSTOMER SERVICE CALL', 'DATE OF CALLING', 'CALL BY WHOM', 'CLIENT FEED BACK', 'GOOGLE REVIEW',
                                        'DATE OF GOOGLE REVIEW', 'APP DOWN LOADED', 'MAHESH SIR MOBILE SAVED', 'SOCIAL MEDIA CONNECTION', 'OTHER REMARK'
                                    ].map(k => k.trim().toUpperCase());
                                    const cleanKey = String(f.key || '').trim().toUpperCase();
                                    return afterSalesKeys.includes(cleanKey) || Number(f.section) === 4;
                                }).map(field => renderField(field))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 text-sm font-bold text-slate-650 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApplyUpdates}
                        disabled={isSaving}
                        className="px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer hover:opacity-90 disabled:opacity-75 disabled:cursor-not-allowed"
                        style={{ backgroundColor: '#154673' }}
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Updating Rows...
                            </>
                        ) : (
                            <>
                                <Plus size={16} /> Apply Bulk Updates
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
