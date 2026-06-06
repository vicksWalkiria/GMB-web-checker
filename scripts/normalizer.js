const Normalizer = {
    normalizePhone: (phoneStr) => {
        if (!phoneStr) return '';
        // Remove everything except numbers
        const digits = phoneStr.replace(/\D/g, '');
        // If it starts with 34 or 0034, remove it to get local format for easier comparison
        if (digits.startsWith('0034')) return digits.substring(4);
        if (digits.startsWith('34') && digits.length === 11) return digits.substring(2);
        return digits;
    },

    normalizeText: (text) => {
        if (!text) return '';
        return text
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/[^\w\s]/gi, ' ') // Replace punctuation with space
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim();
    },

    normalizeAddress: (addressStr) => {
        if (!addressStr) return '';
        let norm = Normalizer.normalizeText(addressStr);
        // Common abbreviations
        norm = norm.replace(/\b(c|calle|cl)\b/g, 'calle');
        norm = norm.replace(/\b(av|avda|avenida)\b/g, 'avenida');
        norm = norm.replace(/\b(pl|plaza)\b/g, 'plaza');
        return norm;
    }
};
