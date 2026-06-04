import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, PlusCircle } from 'lucide-react';

export default function SearchableSelect({ value, options, placeholder, onChange, onAddNew, addNewLabel, direction = 'down', size = 'md', disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({ position: 'fixed', top: '-9999px', left: '-9999px' });
  const [visibleCount, setVisibleCount] = useState(50);
  const openTimeRef = useRef(0);

  useEffect(() => {
    setVisibleCount(50);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target) && (!dropdownRef.current || !dropdownRef.current.contains(event.target))) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (direction === 'up') {
            setDropdownStyle({
                position: 'fixed',
                bottom: window.innerHeight - rect.top + 8,
                left: rect.left,
                width: rect.width,
                zIndex: 99999
            });
        } else {
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                zIndex: 99999
            });
        }
        
        if (inputRef.current) {
            setTimeout(() => {
                if (inputRef.current) inputRef.current.focus({ preventScroll: true });
            }, 10);
        }
    }
  }, [isOpen, direction]);

  useEffect(() => {
    const handleScroll = (e) => { 
        if (Date.now() - openTimeRef.current < 150) return;
        // ignore scroll inside the dropdown itself
        if (dropdownRef.current && dropdownRef.current.contains(e.target)) return;
        if (isOpen) setIsOpen(false); 
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const handleToggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      openTimeRef.current = Date.now();
    }
    setIsOpen(!isOpen);
  };

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
        } ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed pointer-events-none' : ''}`}
        onClick={handleToggleOpen}
      >
        <span className={`truncate mr-2 ${selectedOption ? 'text-slate-900 font-semibold' : 'text-slate-400 font-medium'}`}>
          {selectedOption ? getLabel(selectedOption) : placeholder}
        </span>
        <ChevronDown className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${
          size === 'sm' ? 'w-3.5 h-3.5 shrink-0' : 'w-4 h-4 shrink-0'
        }`} />
      </div>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={dropdownStyle}
          className={`bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden ${
            direction === 'up' ? 'origin-bottom' : 'origin-top'
          }`}
        >
          <div className="p-2 border-b border-slate-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                ref={inputRef}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm focus:ring-0"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div 
            className="max-h-60 overflow-y-auto"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              if (scrollTop + clientHeight >= scrollHeight - 20) {
                setVisibleCount(prev => prev + 50);
              }
            }}
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.slice(0, visibleCount).map((opt, i) => (
                <div
                  key={typeof opt === 'object' ? (opt.value || opt.label || i) : opt}
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
        </div>,
        document.body
      )}
    </div>
  );
}
