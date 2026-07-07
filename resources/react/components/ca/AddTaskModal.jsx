import React from 'react';
import { Plus, X, Edit2, Download, Paperclip } from 'lucide-react';
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

const isPanField = (field) => {
    if (!field) return false;
    if (field.key === 'client_pan') return true;
    const cleanKey = String(field.key || '').trim().toUpperCase();
    const cleanLabel = String(field.label || '').trim().toUpperCase();
    return cleanKey === 'PAN NO' || cleanKey === 'PAN_NO' || cleanKey === 'PAN' || cleanLabel === 'PAN NO' || cleanLabel === 'PAN CARD' || cleanLabel === 'PAN';
};

export default function AddTaskModal({
    isOpen,
    onClose,
    allFields,
    isBillableEnabled = false,
    isAfterSalesEnabled = false,
    clients,
    workTypes,
    staff,
    newTaskData,
    setNewTaskData,
    onSave,
    isViewMode = false,
    isEditable = false,
    setIsEditable,
    canEdit = true,
    isAdmin = false,
    isStaff = false,
    task = null,
    onUploadAttachment,
    onDeleteAttachment,
    onToggleVerification
}) {
    // Memoize options to prevent recreating arrays of thousands of items on every render/keystroke
    const clientOptions = React.useMemo(() => {
        return (clients || []).map(c => ({ value: c.id, label: c.name }));
    }, [clients]);

    const workTypeOptions = React.useMemo(() => {
        return (workTypes || []).map(w => ({ value: w.id, label: w.name }));
    }, [workTypes]);

    // Deduplicate fields by key (trimmed and case-insensitive)
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
        const total = parseCurrency(newTaskData.dynamic_data?.['TOTAL INVOICE AMOUNT']);
        const p1 = parseCurrency(newTaskData.dynamic_data?.['PAYMENT-1']);
        const p2 = parseCurrency(newTaskData.dynamic_data?.['PAYMENT-2']);
        const p3 = parseCurrency(newTaskData.dynamic_data?.['PAYMENT-3']);
        const balance = total - (p1 + p2 + p3);
        const balanceStr = formatIndianCurrencyWithDecimals(String(balance));
        
        if (newTaskData.dynamic_data?.['BALANCE AMOUNT'] !== balanceStr) {
            setNewTaskData(prev => ({
                ...prev,
                dynamic_data: {
                    ...(prev.dynamic_data || {}),
                    'BALANCE AMOUNT': balanceStr
                }
            }));
        }
    }, [
        newTaskData.dynamic_data?.['TOTAL INVOICE AMOUNT'],
        newTaskData.dynamic_data?.['PAYMENT-1'],
        newTaskData.dynamic_data?.['PAYMENT-2'],
        newTaskData.dynamic_data?.['PAYMENT-3'],
        isOpen
    ]);



    if (!isOpen) return null;

    const isCurrentlyEditable = (!isViewMode || isEditable) && canEdit;

    const renderField = (field) => {
        if (field.key === 'allocated_to') {
            return (
                <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{field.label}</label>
                    <SearchableSelect
                        value={
                            (newTaskData.allocated_to && typeof newTaskData.allocated_to === 'object')
                                ? newTaskData.allocated_to.id
                                : (newTaskData.allocated_to || '')
                        }
                        options={(staff || []).map(s => ({ value: s.id, label: s.name }))}
                        placeholder="Select Assigned To..."
                        onChange={(val) => {
                            setNewTaskData({
                                ...newTaskData,
                                allocated_to: val
                            });
                        }}
                        size="md"
                        disabled={!isCurrentlyEditable}
                    />
                </div>
            );
        }
        
        if (field.key === 'client_pan') {
            const selectedClient = clients.find(c => String(c.id) === String(newTaskData.client_id));
            return (
                <div key={field.key} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">{field.label}</label>
                    <input
                        type="text"
                        maxLength={10}
                        value={newTaskData.client_pan !== undefined ? newTaskData.client_pan : (selectedClient?.pan_no || '')}
                        onChange={(e) => {
                            setNewTaskData({
                                ...newTaskData,
                                client_pan: e.target.value.toUpperCase()
                            });
                        }}
                        disabled={!isCurrentlyEditable}
                        placeholder="Client PAN..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                </div>
            );
        }
        
        const isFullWidth = ['client_id', 'remarks', 'form_name', 'task_particular', 'feedback', 'attachments', 'is_verified', 'CLIENT FEED BACK', 'OTHER REMARK'].includes(field.key) || 
                           (field.label && (field.label.toLowerCase().includes('remarks') || field.label.toLowerCase().includes('name') || field.label.toLowerCase().includes('text') || field.label.toLowerCase().includes('particular') || field.label.toLowerCase().includes('remark') || field.label.toLowerCase().includes('feedback')));
        
        const isDate = field.type === 'date' || field.key === 'date_allocated';
        const isTime = field.type === 'time';
        const isReadOnly = field.key === 'BALANCE AMOUNT';

        return (
            <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                <label className="text-xs font-bold text-slate-700">{field.label}</label>
                
                {field.key === 'client_id' ? (
                    <SearchableSelect
                        value={newTaskData.client_id || ''}
                        options={clientOptions}
                        placeholder="Select Client..."
                        onChange={(val) => {
                            const selectedClient = clients.find(c => String(c.id) === String(val));
                            const updatedDynamicData = { ...(newTaskData.dynamic_data || {}) };
                            
                            // Automatically find and populate any dynamic PAN fields with the client's PAN
                            uniqueFields.forEach(f => {
                                if (f && f.key) {
                                    const cleanKey = String(f.key).trim().toUpperCase();
                                    if (cleanKey === 'PAN NO' || cleanKey === 'PAN_NO' || cleanKey === 'PAN' || (f.label && f.label.toUpperCase() === 'PAN NO')) {
                                        updatedDynamicData[f.key] = selectedClient?.pan_no || '';
                                    }
                                }
                            });

                            setNewTaskData({
                                ...newTaskData,
                                client_id: val,
                                client_pan: selectedClient?.pan_no || '',
                                dynamic_data: updatedDynamicData
                            });
                        }}
                        size="md"
                        disabled={!isCurrentlyEditable}
                    />
                ) : field.key === 'work_type_id' ? (
                    <SearchableSelect
                        value={newTaskData.work_type_id || ''}
                        options={workTypeOptions}
                        placeholder="Select Work Type..."
                        onChange={(val) => setNewTaskData({...newTaskData, work_type_id: val})}
                        size="md"
                        disabled={!isCurrentlyEditable}
                    />
                ) : field.key === 'status' ? (
                    <select
                        value={newTaskData.status || ''}
                        onChange={(e) => setNewTaskData({...newTaskData, status: e.target.value})}
                        disabled={!isCurrentlyEditable}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
                        value={newTaskData.sub_status || ''}
                        onChange={(e) => setNewTaskData({...newTaskData, sub_status: e.target.value})}
                        disabled={!isCurrentlyEditable}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
                            ? (newTaskData[field.key] || '') 
                            : (newTaskData.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            const val = e.target.value;
                            if (field.isStatic) {
                                setNewTaskData({ ...newTaskData, [field.key]: val });
                            } else {
                                setNewTaskData({
                                    ...newTaskData,
                                    dynamic_data: {
                                        ...(newTaskData.dynamic_data || {}),
                                        [field.key]: val
                                    }
                                });
                            }
                        }}
                        disabled={!isCurrentlyEditable}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : isTime ? (
                    <TimePicker12Hour
                        value={convertTo24Hour(newTaskData.dynamic_data?.[field.key] || '')}
                        onChange={(val) => setNewTaskData({
                            ...newTaskData,
                            dynamic_data: {
                                ...(newTaskData.dynamic_data || {}),
                                [field.key]: convertTo12Hour(val)
                            }
                        })}
                        disabled={!isCurrentlyEditable}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.key === 'form_name' ? (
                    <input
                        type="text"
                        value={newTaskData.form_name || ''}
                        onChange={(e) => setNewTaskData({...newTaskData, form_name: e.target.value})}
                        disabled={!isCurrentlyEditable}
                        placeholder="Sheet Name..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.key === 'attachments' ? (
                    <div className="space-y-2 border border-slate-100 p-4 rounded-2xl bg-slate-50/50">
                        {(!newTaskData.attachments || newTaskData.attachments.length === 0) ? (
                            <p className="text-xs text-slate-400 italic">No attachments uploaded</p>
                        ) : (
                            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1">
                                {newTaskData.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/60 shadow-sm gap-2">
                                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                                            <Paperclip size={12} className="text-slate-400 shrink-0" />
                                            <span className="text-[11px] font-semibold text-slate-600 truncate">{file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer" className="p-1.5 text-indigo-650 hover:bg-indigo-50 rounded-lg transition" title="Download">
                                                <Download size={12} className="text-indigo-600" />
                                            </a>
                                            {isCurrentlyEditable && (task?.allow_attachments === undefined ? true : !!task.allow_attachments) && (
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteAttachment && onDeleteAttachment(idx, file.path)}
                                                    className="p-1.5 text-rose-655 hover:bg-rose-50 rounded-lg transition"
                                                    title="Delete"
                                                >
                                                    <X size={12} className="text-rose-600" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {isCurrentlyEditable && (task?.allow_attachments === undefined ? true : !!task.allow_attachments) && (
                            <label className="flex items-center justify-center gap-2 p-2 bg-white hover:bg-slate-50 border border-dashed border-slate-300 hover:border-indigo-500 rounded-xl text-xs font-bold text-slate-655 hover:text-indigo-650 cursor-pointer transition shadow-sm">
                                <Plus size={14} />
                                <span>Upload Attachment</span>
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files.length > 0 && onUploadAttachment) {
                                            onUploadAttachment(e.target.files);
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>
                ) : field.key === 'is_verified' ? (
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-155">
                        <div>
                            <p className="text-xs font-black text-slate-750 uppercase tracking-tight">Verification Status</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                                {newTaskData.is_verified ? 'Verified & Locked' : 'Unlocked'}
                            </p>
                        </div>
                        <div>
                            {isAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => onToggleVerification && onToggleVerification()}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                        newTaskData.is_verified 
                                            ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                    }`}
                                >
                                    {newTaskData.is_verified ? 'Unverify & Unlock' : 'Verify & Lock'}
                                </button>
                            ) : (
                                <span className={`px-3 py-1.5 text-xs font-bold rounded-xl border select-none ${
                                    newTaskData.is_verified 
                                        ? 'bg-rose-50 border-rose-200 text-rose-600' 
                                        : 'bg-green-50 border-green-200 text-green-700'
                                }`}>
                                    {newTaskData.is_verified ? 'Locked' : 'Unlocked'}
                                </span>
                            )}
                        </div>
                    </div>
                ) : field.type === 'checkbox' ? (
                    field.options && field.options.length > 0 ? (
                        <div className="flex flex-col gap-2 mt-2">
                            {field.options.filter(opt => opt !== null && opt !== undefined).map((opt, i) => {
                                const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                const optLabel = typeof opt === 'object' ? opt.label : opt;
                                const currentVals = Array.isArray(newTaskData.dynamic_data?.[field.key]) ? newTaskData.dynamic_data[field.key] : (newTaskData.dynamic_data?.[field.key] ? [newTaskData.dynamic_data[field.key]] : []);
                                const isChecked = currentVals.includes(optVal);
                                
                                return (
                                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={!isCurrentlyEditable}
                                            onChange={(e) => {
                                                let newVals = [...currentVals];
                                                if (e.target.checked) {
                                                    newVals.push(optVal);
                                                } else {
                                                    newVals = newVals.filter(v => v !== optVal);
                                                }
                                                setNewTaskData({
                                                    ...newTaskData,
                                                    dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: newVals }
                                                });
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
                                checked={!!newTaskData.dynamic_data?.[field.key]}
                                disabled={!isCurrentlyEditable}
                                onChange={(e) => setNewTaskData({
                                    ...newTaskData,
                                    dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.checked }
                                })}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            <span className="ml-3 text-sm font-semibold text-slate-700 cursor-pointer" onClick={() => {
                                if (!isCurrentlyEditable) return;
                                setNewTaskData({
                                    ...newTaskData,
                                    dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: !newTaskData.dynamic_data?.[field.key] }
                                });
                            }}>Toggle</span>
                        </div>
                    )
                ) : field.label === 'CA Rating' ? (
                    <div className="flex items-center gap-1.5 text-amber-500 text-xl leading-none py-2 select-none">
                        {(() => {
                            const currentRating = parseInt(newTaskData.dynamic_data?.['CA Rating'] || newTaskData['CA Rating'] || '0');
                            return Array.from({ length: 5 }).map((_, i) => {
                                const starNum = i + 1;
                                const isFilled = starNum <= currentRating;
                                return (
                                    <button 
                                        key={i} 
                                        type="button"
                                        disabled={!isCurrentlyEditable}
                                        onClick={() => {
                                            const nextVal = currentRating === starNum ? '0' : String(starNum);
                                            setNewTaskData({
                                                ...newTaskData,
                                                dynamic_data: {
                                                    ...(newTaskData.dynamic_data || {}),
                                                    'CA Rating': nextVal
                                                },
                                                'CA Rating': nextVal
                                            });
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
                            ({newTaskData.dynamic_data?.['CA Rating'] || newTaskData['CA Rating'] || '0'}/5)
                        </span>
                    </div>
                ) : field.type === 'dropdown' ? (
                    <select
                        value={newTaskData.dynamic_data?.[field.key] || ''}
                        onChange={(e) => setNewTaskData({
                            ...newTaskData,
                            dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.value }
                        })}
                        disabled={!isCurrentlyEditable}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <option value="">— Select {field.label} —</option>
                        {field.options && field.options.filter(opt => opt !== null && opt !== undefined).map((opt, i) => {
                            const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                            const optLabel = typeof opt === 'object' ? opt.label : opt;
                            return <option key={i} value={optVal}>{optLabel}</option>;
                        })}
                    </select>
                ) : field.type === 'progress_auto' ? (
                    <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/55 border border-slate-100">
                        {(() => {
                            const totalSub = task?.sub_tasks?.length || 0;
                            const completeSub = task?.sub_tasks?.filter(st => st.status === 'complete').length || 0;
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

                            return (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Auto Progress</span>
                                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black tracking-tighter border shadow-sm ${badgeBg}`}>{pct}%</span>
                                    </div>
                                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative border border-slate-200/20 shadow-inner">
                                        <div className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-bold">{completeSub}/{totalSub} Checklist Tasks Complete</p>
                                </>
                            );
                        })()}
                    </div>
                ) : field.type === 'progress_manual' ? (
                    <div className="space-y-2 p-3 rounded-2xl bg-slate-50/50 border border-slate-150">
                        {(() => {
                            const value = newTaskData.dynamic_data?.[field.key] ?? '0';
                            const parsedVal = Math.min(100, Math.max(0, parseInt(value) || 0));

                            let badgeBg = 'bg-rose-50 border-rose-100 text-rose-600';
                            if (parsedVal >= 40 && parsedVal < 90) {
                                badgeBg = 'bg-teal-50 border-teal-100 text-teal-700';
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
                                        disabled={!isCurrentlyEditable}
                                        onChange={(e) => {
                                            setNewTaskData({
                                                ...newTaskData,
                                                dynamic_data: {
                                                    ...(newTaskData.dynamic_data || {}),
                                                    [field.key]: e.target.value
                                                }
                                            });
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
                        value={newTaskData.dynamic_data?.[field.key] || ''}
                        onChange={(e) => {
                            const formatted = formatIndianCurrency(e.target.value);
                            setNewTaskData({
                                ...newTaskData,
                                dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: formatted }
                            });
                        }}
                        onBlur={(e) => {
                            const finalVal = formatIndianCurrencyWithDecimals(e.target.value);
                            setNewTaskData({
                                ...newTaskData,
                                dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: finalVal }
                            });
                        }}
                        disabled={!isCurrentlyEditable || isReadOnly}
                        placeholder={field.placeholder || `Enter amount for ${field.label}...`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : field.type === 'longtext' ? (
                    <textarea
                        value={newTaskData.dynamic_data?.[field.key] || ''}
                        onChange={(e) => setNewTaskData({
                            ...newTaskData,
                            dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.value }
                        })}
                        disabled={!isCurrentlyEditable}
                        placeholder={`Enter details for ${field.label}...`}
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed resize-y"
                    />
                ) : ['number', 'email', 'phone', 'hyperlink'].includes(field.type) ? (
                    <input
                        type={field.type === 'phone' ? 'tel' : field.type === 'hyperlink' ? 'url' : field.type}
                        value={
                            field.isStatic 
                            ? (newTaskData[field.key] || '') 
                            : (newTaskData.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            if (field.isStatic) {
                                setNewTaskData({ ...newTaskData, [field.key]: e.target.value });
                            } else {
                                setNewTaskData({
                                    ...newTaskData, 
                                    dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.value }
                                });
                            }
                        }}
                        disabled={!isCurrentlyEditable}
                        placeholder={field.placeholder || `Enter ${field.label}...`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                ) : (
                    <input
                        type="text"
                        maxLength={isPanField(field) ? 10 : undefined}
                        value={
                            field.isStatic 
                            ? (newTaskData[field.key] || '') 
                            : (newTaskData.dynamic_data?.[field.key] || '')
                        }
                        onChange={(e) => {
                            const val = isPanField(field) ? e.target.value.toUpperCase() : e.target.value;
                            if (field.isStatic) {
                                setNewTaskData({ ...newTaskData, [field.key]: val });
                            } else {
                                setNewTaskData({
                                    ...newTaskData, 
                                    dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: val }
                                });
                            }
                        }}
                        disabled={!isCurrentlyEditable}
                        placeholder={`Enter ${field.label}...`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">{isViewMode ? 'Update Task' : 'Add New Task'}</h2>
                            <p className="text-xs text-slate-500 font-medium">{isViewMode ? 'View and update row details' : 'Fill in the details for the new row'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 bg-white">
                    {/* Main section fields */}
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
                        className="px-5 py-2.5 text-sm font-bold text-slate-650 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        {isViewMode && !isEditable ? 'Close' : 'Cancel'}
                    </button>
                    {isViewMode && !isEditable && canEdit ? (
                        <button
                            type="button"
                            onClick={() => setIsEditable(true)}
                            className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer"
                        >
                            <Edit2 size={16} /> Edit Information
                        </button>
                    ) : isViewMode && !isEditable ? null : (
                        <button
                            onClick={() => {
                                if (!newTaskData.form_name) {
                                    toast.error("Sheet Name is mandatory!");
                                    return;
                                }
                                if (!newTaskData.work_type_id) {
                                    toast.error("Work Type is mandatory!");
                                    return;
                                }
                                for (const field of uniqueFields) {
                                    if (!field.isStatic && field.required) {
                                        const val = newTaskData.dynamic_data?.[field.key];
                                        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                                            toast.error(`"${field.label}" is mandatory!`);
                                            return;
                                        }
                                    }
                                    if (isPanField(field)) {
                                        const selectedClient = clients?.find(c => String(c.id) === String(newTaskData.client_id));
                                        const val = field.key === 'client_pan'
                                            ? (newTaskData.client_pan !== undefined ? newTaskData.client_pan : (selectedClient?.pan_no || ''))
                                            : (field.isStatic ? newTaskData[field.key] : newTaskData.dynamic_data?.[field.key]);
                                        if (val) {
                                            const trimmedVal = String(val).trim().toUpperCase();
                                            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                                            if (!panRegex.test(trimmedVal)) {
                                                toast.error(`"${field.label}" must be a valid PAN card format (e.g., ABCDE1234F)`);
                                                return;
                                            }
                                        }
                                    }
                                }
                                const newRow = {
                                    ...newTaskData,
                                    dynamic_data: newTaskData.dynamic_data || {}
                                };
                                onSave(newRow);
                                onClose();
                            }}
                            className="px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer hover:opacity-90"
                            style={{ backgroundColor: '#154673' }}
                        >
                            <Plus size={16} /> {isViewMode ? 'Update Task' : 'Save Task'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
