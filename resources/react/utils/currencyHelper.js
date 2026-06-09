export const formatIndianCurrency = (value) => {
    if (value === undefined || value === null || value === '') return '';
    
    // Convert to string and strip all commas and non-numeric/dot characters
    let clean = value.toString().replace(/,/g, '').replace(/[^0-9.]/g, '');
    
    // Handle multiple decimals (only keep the first dot)
    const parts = clean.split('.');
    if (parts.length > 2) {
        clean = parts[0] + '.' + parts.slice(1).join('');
    }
    
    const numParts = clean.split('.');
    let integerPart = numParts[0];
    let decimalPart = numParts.length > 1 ? numParts[1].substring(0, 2) : null;
    
    // Format integer part using Indian grouping
    if (integerPart) {
        // Strip leading zeros unless it is just "0"
        if (integerPart.length > 1 && integerPart.startsWith('0')) {
            integerPart = integerPart.replace(/^0+/, '');
            if (integerPart === '') integerPart = '0';
        }
        
        let lastThree = integerPart.substring(integerPart.length - 3);
        let otherBits = integerPart.substring(0, integerPart.length - 3);
        if (otherBits !== '') {
            lastThree = ',' + lastThree;
        }
        integerPart = otherBits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    }
    
    if (decimalPart !== null) {
        return integerPart + '.' + decimalPart;
    }
    return integerPart;
};

export const formatIndianCurrencyWithDecimals = (value) => {
    if (value === undefined || value === null || value === '') return '';
    let clean = value.toString().replace(/,/g, '').replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    if (isNaN(num)) return '';
    
    // Format with exactly 2 decimal places
    const fixedNum = num.toFixed(2);
    const parts = fixedNum.split('.');
    let integerPart = parts[0];
    let decimalPart = parts[1];
    
    if (integerPart) {
        let lastThree = integerPart.substring(integerPart.length - 3);
        let otherBits = integerPart.substring(0, integerPart.length - 3);
        if (otherBits !== '') {
            lastThree = ',' + lastThree;
        }
        integerPart = otherBits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
    }
    return integerPart + '.' + decimalPart;
};
