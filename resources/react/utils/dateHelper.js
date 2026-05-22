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
