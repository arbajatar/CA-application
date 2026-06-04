import React from 'react';
import { Plus, X } from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';

export default function AddTaskModal({
    isOpen,
    onClose,
    allFields,
    clients,
    workTypes,
    staff,
    newTaskData,
    setNewTaskData,
    onSave
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-100">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm">
                            <Plus size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-800">Add New Task</h2>
                            <p className="text-xs text-slate-500 font-medium">Fill in the details for the new row</p>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {allFields.map(field => {
                            const isFullWidth = ['client_id', 'remarks', 'form_name', 'task_particular', 'feedback'].includes(field.key) || 
                                              (field.label && (field.label.toLowerCase().includes('remarks') || field.label.toLowerCase().includes('name') || field.label.toLowerCase().includes('text') || field.label.toLowerCase().includes('particular')));
                            return (
                                <div key={field.key} className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                                    <label className="text-xs font-bold text-slate-700">{field.label}</label>
                                    
                                    {field.key === 'client_id' ? (
                                        <SearchableSelect
                                            value={newTaskData.client_id || ''}
                                            options={clients.map(c => ({ value: c.id, label: c.name }))}
                                            placeholder="Select Client..."
                                            onChange={(val) => setNewTaskData({...newTaskData, client_id: val})}
                                            size="md"
                                        />
                                    ) : field.key === 'work_type_id' ? (
                                        <select
                                            value={newTaskData.work_type_id || ''}
                                            onChange={(e) => setNewTaskData({...newTaskData, work_type_id: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">— Select Work Type —</option>
                                            {workTypes.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    ) : field.key === 'allocated_to' ? (
                                        <select
                                            value={newTaskData.allocated_to || ''}
                                            onChange={(e) => setNewTaskData({...newTaskData, allocated_to: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">— Select Assigned To —</option>
                                            {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    ) : field.key === 'status' ? (
                                        <select
                                            value={newTaskData.status || ''}
                                            onChange={(e) => setNewTaskData({...newTaskData, status: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">— Select Sub Status —</option>
                                            {['Documentation pending', 'Awaiting approval', 'Completed'].map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : field.key === 'date_allocated' ? (
                                        <input
                                            type="date"
                                            value={newTaskData.date_allocated || ''}
                                            onChange={(e) => setNewTaskData({...newTaskData, date_allocated: e.target.value})}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    ) : field.key === 'form_name' ? (
                                        <input
                                            type="text"
                                            value={newTaskData.form_name || ''}
                                            onChange={(e) => setNewTaskData({...newTaskData, form_name: e.target.value})}
                                            placeholder="Sheet Name..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    ) : field.type === 'checkbox' ? (
                                        field.options && field.options.length > 0 ? (
                                            <div className="flex flex-col gap-2 mt-2">
                                                {field.options.map((opt, i) => {
                                                    const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                    const optLabel = typeof opt === 'object' ? opt.label : opt;
                                                    const currentVals = Array.isArray(newTaskData.dynamic_data?.[field.key]) ? newTaskData.dynamic_data[field.key] : (newTaskData.dynamic_data?.[field.key] ? [newTaskData.dynamic_data[field.key]] : []);
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
                                                                    setNewTaskData({
                                                                        ...newTaskData,
                                                                        dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: newVals }
                                                                    });
                                                                }}
                                                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                            />
                                                            <span className="text-sm text-slate-700 font-medium">{optLabel}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="flex items-center h-[38px]">
                                                <input
                                                    type="checkbox"
                                                    checked={!!newTaskData.dynamic_data?.[field.key]}
                                                    onChange={(e) => setNewTaskData({
                                                        ...newTaskData,
                                                        dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.checked }
                                                    })}
                                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                                                />
                                                <span className="ml-3 text-sm font-semibold text-slate-700 cursor-pointer" onClick={() => {
                                                    setNewTaskData({
                                                        ...newTaskData,
                                                        dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: !newTaskData.dynamic_data?.[field.key] }
                                                    });
                                                }}>Toggle</span>
                                            </div>
                                        )
                                    ) : field.type === 'dropdown' ? (
                                        <select
                                            value={newTaskData.dynamic_data?.[field.key] || ''}
                                            onChange={(e) => setNewTaskData({
                                                ...newTaskData,
                                                dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.value }
                                            })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">— Select {field.label} —</option>
                                            {field.options && field.options.map((opt, i) => {
                                                const optVal = typeof opt === 'object' ? (opt.value !== undefined ? opt.value : opt.label) : opt;
                                                const optLabel = typeof opt === 'object' ? opt.label : opt;
                                                return <option key={i} value={optVal}>{optLabel}</option>;
                                            })}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={newTaskData.dynamic_data?.[field.key] || ''}
                                            onChange={(e) => setNewTaskData({
                                                ...newTaskData, 
                                                dynamic_data: { ...(newTaskData.dynamic_data || {}), [field.key]: e.target.value }
                                            })}
                                            placeholder={`Enter ${field.label}...`}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            const newRow = {
                                ...newTaskData,
                                dynamic_data: newTaskData.dynamic_data || {}
                            };
                            onSave(newRow);
                            onClose();
                        }}
                        className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 flex items-center gap-2"
                    >
                        <Plus size={16} /> Save Task
                    </button>
                </div>
            </div>
        </div>
    );
}
