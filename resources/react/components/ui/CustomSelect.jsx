import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export default function CustomSelect({ 
    value, 
    onChange, 
    options = [], 
    placeholder = 'Select option', 
    className = '',
    widthClass = 'min-w-[125px]'
}) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find(opt => String(opt.value) === String(value))

    const handleSelect = (val) => {
        onChange({ target: { value: val } }) // Match standard select event structure
        setIsOpen(false)
    }

    return (
        <div className={`relative ${widthClass} ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full pl-3 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1F5C99]/20 focus:border-[#1F5C99] transition cursor-pointer text-slate-700 font-semibold text-left"
            >
                <span className="truncate">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </button>

            {isOpen && (
                <div className="absolute z-[250] mt-1.5 w-full min-w-[150px] right-0 bg-white border border-slate-100 rounded-xl shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {options.map((opt) => {
                            const isSelected = String(opt.value) === String(value)
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSelect(opt.value)}
                                    className={`w-full px-3.5 py-2 text-xs flex items-center justify-between transition text-left cursor-pointer
                                        ${isSelected 
                                            ? 'bg-[#1F5C99] font-bold text-white' 
                                            : 'text-slate-650 font-medium hover:bg-[#1F5C99]/10 hover:text-[#1F5C99]'
                                        }`}
                                >
                                    <span className="truncate">{opt.label}</span>
                                    {isSelected && <Check size={12} className="text-white shrink-0 ml-2" />}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
