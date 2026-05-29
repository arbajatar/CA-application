import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, PlusCircle, Search } from 'lucide-react';

const DEFAULT_SUB_STATUSES = [
    'Documentation pending',
    'Awaiting approval',
    'Completed'
];

export default function SubStatusPicker({ 
    value, 
    onChange, 
    placeholder = 'Set Sub Status...', 
    size = 'sm', 
    options: customOptions
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState([]);
    const [calculatedDirection, setCalculatedDirection] = useState('down');
    const containerRef = useRef(null);

    useEffect(() => {
        if (Array.isArray(customOptions) && customOptions.length > 0) {
            setOptions(customOptions);
        } else {
            setOptions(DEFAULT_SUB_STATUSES);
        }
    }, [customOptions]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = () => {
        if (!isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            
            // Smart layout detection: if space below is too small and there is more space above, open upwards!
            if (spaceBelow < 230 && spaceAbove > spaceBelow) {
                setCalculatedDirection('up');
            } else {
                setCalculatedDirection('down');
            }
        }
        setIsOpen(!isOpen);
        setSearch('');
    };

    const handleSelect = (val) => {
        const trimmed = typeof val === 'string' ? val.trim() : String(val);
        onChange(trimmed);
        setIsOpen(false);
        setSearch('');
    };

    // Helper functions to safely extract label and value
    const getOptionLabel = (opt) => {
        if (!opt) return '';
        if (typeof opt === 'object') {
            return opt.label || opt.name || opt.value || '';
        }
        return String(opt);
    };

    const getOptionValue = (opt) => {
        if (!opt) return '';
        if (typeof opt === 'object') {
            return opt.value !== undefined ? opt.value : (opt.id || opt.label || '');
        }
        return String(opt);
    };

    const filteredOptions = options.filter(opt => {
        const labelText = getOptionLabel(opt);
        return labelText.toLowerCase().includes(search.toLowerCase());
    });

    const showAddNew = search && !options.some(opt => {
        const labelText = getOptionLabel(opt);
        return labelText.toLowerCase() === search.toLowerCase();
    });

    const selectedOption = options.find(opt => String(getOptionValue(opt)) === String(value));
    const displayLabel = selectedOption ? getOptionLabel(selectedOption) : (value || placeholder);

    const dropdownClass = calculatedDirection === 'up' 
        ? "bottom-full mb-2 origin-bottom slide-in-from-bottom-2"
        : "top-full mt-2 origin-top slide-in-from-top-2";

    return (
        <div className="relative inline-block w-full min-w-[155px]" ref={containerRef}>
            {/* Trigger Button */}
            <div
                onClick={handleToggle}
                className={`bg-white border rounded-xl px-3 py-1.8 flex items-center justify-between cursor-pointer transition-all duration-300 select-none shadow-sm hover:shadow-md ${
                    isOpen 
                        ? 'border-blue-500 ring-2 ring-blue-500/10' 
                        : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/30'
                } ${
                    size === 'xs' ? 'text-[11px] py-1 px-2.5' : 'text-xs'
                }`}
            >
                <span className={`truncate mr-2 ${value ? 'text-slate-850 font-bold' : 'text-slate-400 font-semibold'}`}>
                    {displayLabel}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ${
                    isOpen ? 'transform rotate-180 text-blue-500' : 'text-slate-400'
                }`} />
            </div>

            {/* Dropdown Card */}
            {isOpen && (
                <div className={`absolute z-[250] w-full min-w-[210px] right-0 bg-white border border-slate-200/90 rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95 ${dropdownClass}`}>
                    
                    {/* Search Panel */}
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/40">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search statuses..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && search) {
                                        e.preventDefault();
                                        handleSelect(search);
                                    }
                                }}
                                className="w-full pl-9 pr-3 py-1.8 bg-white border border-slate-200/80 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 font-medium text-slate-700 transition-all duration-200 placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-48 overflow-y-auto py-1.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, idx) => {
                                const optLabel = getOptionLabel(opt);
                                const optValue = getOptionValue(opt);
                                const isSelected = String(optValue) === String(value);
                                return (
                                    <div
                                        key={typeof opt === 'object' ? (opt.id || opt.value || idx) : opt}
                                        onClick={() => handleSelect(optValue)}
                                        className={`px-3.5 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-all duration-150 mx-1 rounded-lg ${
                                            isSelected 
                                                ? 'bg-blue-50/60 font-black text-blue-600' 
                                                : 'text-slate-650 font-semibold hover:text-slate-800'
                                        }`}
                                    >
                                        <span className="truncate text-xs">{optLabel}</span>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-2" />}
                                    </div>
                                );
                            })
                        ) : (
                            !showAddNew && (
                                <div className="px-4 py-3 text-center text-slate-400 text-xs italic">
                                    No statuses found.
                                </div>
                            )
                        )}

                        {/* Add Custom Button */}
                        {showAddNew && (
                            <div className="p-1 border-t border-slate-50 bg-slate-50/20 mt-1">
                                <div
                                    onClick={() => handleSelect(search)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-black text-blue-600 hover:text-blue-700 bg-white border border-blue-100 hover:border-blue-200 rounded-xl shadow-sm cursor-pointer transition active:scale-98"
                                >
                                    <PlusCircle className="w-4 h-4 text-blue-500" />
                                    <span>Add <span className="font-normal text-slate-500">"{search}"</span></span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
