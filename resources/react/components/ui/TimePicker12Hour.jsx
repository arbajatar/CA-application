import React, { useState, useEffect } from 'react';

export default function TimePicker12Hour({ value, onChange, label, className = "", position = "bottom", disabled = false }) {
    // Parse initial value (24h format e.g., "14:30")
    const getInitialState = (val) => {
        if (!val) return { h: '', m: '', a: 'AM' };
        const parts = val.split(':');
        if (parts.length < 2) return { h: '', m: '', a: 'AM' };
        const hour = parts[0];
        const minute = parts[1].substring(0, 2); // get first 2 characters of minutes
        let hInt = parseInt(hour, 10);
        const ampm = hInt >= 12 ? 'PM' : 'AM';
        hInt = hInt % 12 || 12;
        return { h: String(hInt).padStart(2, '0'), m: minute, a: ampm };
    };

    const [state, setState] = useState(getInitialState(value));

    // Update internal state if external value changes
    useEffect(() => {
        setState(getInitialState(value));
    }, [value]);

    const triggerChange = (h, m, a) => {
        if (h && m) {
            let hInt = parseInt(h, 10);
            if (a === 'PM' && hInt < 12) hInt += 12;
            if (a === 'AM' && hInt === 12) hInt = 0;
            onChange(`${String(hInt).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        }
    };

    const handleHour = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        if (parseInt(val, 10) > 12) val = '12';
        setState(prev => {
            const next = { ...prev, h: val };
            if (val.length === 2 && prev.m) triggerChange(val, prev.m, prev.a);
            return next;
        });
    };

    const handleMinute = (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        if (parseInt(val, 10) > 59) val = '59';
        setState(prev => {
            const next = { ...prev, m: val };
            if (prev.h && val.length === 2) triggerChange(prev.h, val, prev.a);
            return next;
        });
    };

    const handleAmpm = (e) => {
        const val = e.target.value;
        setState(prev => {
            const next = { ...prev, a: val };
            if (prev.h && prev.m) triggerChange(prev.h, prev.m, val);
            return next;
        });
    };

    const handleBlurHour = () => {
        setState(prev => {
            let val = prev.h;
            if (val && val.length === 1) val = `0${val}`;
            else if (!val) val = '';
            else if (val === '00') val = '12';
            
            const next = { ...prev, h: val };
            if (val && prev.m) triggerChange(val, prev.m, prev.a);
            return next;
        });
    };

    const handleBlurMinute = () => {
        setState(prev => {
            let val = prev.m;
            if (val && val.length === 1) val = `0${val}`;
            
            const next = { ...prev, m: val };
            if (prev.h && val) triggerChange(prev.h, val, prev.a);
            return next;
        });
    };

    return (
        <div className="w-full">
            {label && <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">{label}</label>}
            <div className={`flex items-center w-full bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-[#1F5C99]/20 focus-within:border-[#1F5C99] transition ${className.replace('!py-1 !px-2 text-xs', '')}`} style={className.includes('!py-1') ? { height: '26px' } : {}}>
                <div className="flex items-center justify-center flex-1">
                    <input
                        type="text"
                        placeholder="12"
                        value={state.h}
                        onChange={handleHour}
                        onBlur={handleBlurHour}
                        disabled={disabled}
                        className="w-7 text-center bg-transparent text-sm font-semibold focus:outline-none focus:bg-gray-200 rounded disabled:opacity-60"
                        style={className.includes('!py-1') ? { fontSize: '12px' } : {}}
                    />
                    <span className="font-bold text-gray-400 mx-0.5">:</span>
                    <input
                        type="text"
                        placeholder="00"
                        value={state.m}
                        onChange={handleMinute}
                        onBlur={handleBlurMinute}
                        disabled={disabled}
                        className="w-7 text-center bg-transparent text-sm font-semibold focus:outline-none focus:bg-gray-200 rounded disabled:opacity-60"
                        style={className.includes('!py-1') ? { fontSize: '12px' } : {}}
                    />
                </div>
                <select
                    value={state.a}
                    onChange={handleAmpm}
                    disabled={disabled}
                    className="bg-transparent border-l border-gray-200 px-1 py-2 text-sm font-bold text-gray-600 focus:outline-none cursor-pointer hover:bg-gray-100 transition rounded-r-xl disabled:opacity-60"
                    style={className.includes('!py-1') ? { padding: '4px 4px', fontSize: '11px' } : {}}
                >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                </select>
            </div>
        </div>
    );
}
