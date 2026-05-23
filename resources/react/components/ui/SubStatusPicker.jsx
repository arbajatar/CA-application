import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, PlusCircle, Search } from 'lucide-react';
import api from '../../api/axios';

export default function SubStatusPicker({ value, onChange, placeholder = 'Set Sub Status...', size = 'sm' }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [options, setOptions] = useState([]);
    const containerRef = useRef(null);

    // Fetch existing sub-statuses from the API on mount or when opened
    const fetchOptions = async () => {
        try {
            const res = await api.get('/sub-task-sub-statuses');
            if (res.data && res.data.data) {
                setOptions(res.data.data);
            }
        } catch (e) {
            console.error('Failed to load sub-statuses', e);
        }
    };

    useEffect(() => {
        fetchOptions();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val) => {
        const trimmed = val.trim();
        onChange(trimmed);
        setIsOpen(false);
        setSearch('');
        setTimeout(fetchOptions, 500);
    };

    const filteredOptions = options.filter(opt =>
        opt?.toLowerCase().includes(search.toLowerCase())
    );

    const showAddNew = search && !options.some(opt => opt?.toLowerCase() === search.toLowerCase());

    return (
        <div className="relative inline-block w-full min-w-[150px]" ref={containerRef}>
            <div
                onClick={() => {
                    setIsOpen(!isOpen);
                    setSearch('');
                }}
                className={`bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:border-gray-300 transition shadow-sm ${
                    size === 'xs' ? 'text-[11px] py-1 px-2' : 'text-xs'
                }`}
            >
                <span className={value ? 'text-gray-700 font-semibold' : 'text-gray-400 font-medium'}>
                    {value || placeholder}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1.5 shrink-0" />
            </div>

            {isOpen && (
                <div className="absolute z-[200] mt-1 w-full min-w-[200px] right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Search Input */}
                    <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2.5 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && search) {
                                        e.preventDefault();
                                        handleSelect(search);
                                    }
                                }}
                                className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700"
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto py-1 text-xs">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt) => (
                                <div
                                    key={opt}
                                    onClick={() => handleSelect(opt)}
                                    className={`px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition ${
                                        value === opt ? 'bg-blue-50/50 font-bold text-blue-600' : 'text-gray-600 font-medium'
                                    }`}
                                >
                                    <span>{opt}</span>
                                    {value === opt && <Check className="w-3 h-3 text-blue-600 shrink-0" />}
                                </div>
                            ))
                        ) : (
                            !showAddNew && (
                                <div className="px-3 py-2 text-center text-gray-400 italic">No matches found.</div>
                            )
                        )}

                        {/* Add New Custom option */}
                        {showAddNew && (
                            <div
                                onClick={() => handleSelect(search)}
                                className="p-1 border-t border-gray-50 bg-gray-50/50"
                            >
                                <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-white border border-blue-100 rounded-lg shadow-sm cursor-pointer transition active:scale-95">
                                    <PlusCircle className="w-4 h-4 text-blue-600" />
                                    Add <span className="font-normal text-gray-500">"{search}"</span> as new
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
