/**
 * Format any date string (ISO, YYYY-MM-DD) or Date object to DD/MM/YYYY format.
 * Safe from timezone shifts because it parses YYYY-MM-DD strings directly by splitting them.
 * 
 * @param {string|Date|null|undefined} dateInput 
 * @returns {string} Formatted date (DD/MM/YYYY) or "—"
 */
export function formatDate(dateInput) {
    if (!dateInput) return '—';
    
    // If it's a string, try to parse cleanly first
    if (typeof dateInput === 'string') {
        const cleanedStr = dateInput.trim();
        if (!cleanedStr) return '—';

        // Match standard YYYY-MM-DD
        const yyyymmddMatch = cleanedStr.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
        if (yyyymmddMatch) {
            const [, y, m, d] = yyyymmddMatch;
            return `${d}/${m}/${y}`;
        }
        
        // Try parsing other string formats
        const parsed = Date.parse(cleanedStr);
        if (isNaN(parsed)) return cleanedStr; // Fallback to raw string if unable to parse
        dateInput = new Date(parsed);
    }
    
    if (dateInput instanceof Date) {
        if (isNaN(dateInput.getTime())) return '—';
        const day = String(dateInput.getDate()).padStart(2, '0');
        const month = String(dateInput.getMonth() + 1).padStart(2, '0');
        const year = dateInput.getFullYear();
        return `${day}/${month}/${year}`;
    }
    
    return String(dateInput);
}

export function convertTo12Hour(time24h) {
    if (!time24h) return '';
    const parts = time24h.split(':');
    if (parts.length < 2) return time24h;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const strHours = String(hours).padStart(2, '0');
    return `${strHours}:${minutes} ${ampm}`;
}

export function convertTo24Hour(time12h) {
    if (!time12h) return '';
    const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return time12h;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    const strHours = String(hours).padStart(2, '0');
    return `${strHours}:${minutes}`;
}
