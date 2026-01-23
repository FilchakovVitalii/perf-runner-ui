/**
 * Properties Formatter
 * Renders canonical configuration as Java Properties format (flat key-value pairs with dot notation)
 * 
 * @module PropertiesFormatter
 */

const PropertiesFormatter = {
    /**
     * Format canonical config as Properties format
     * @param {Object} canonical - Canonical configuration object
     * @returns {string} Properties-formatted string
     */
    format(canonical) {
        const lines = [];

        lines.push('# Properties Configuration');
        lines.push(`# Generated: ${new Date().toISOString()}`);
        lines.push('');

        // Format userDefinedVariable section
        if (canonical.userDefinedVariable && Object.keys(canonical.userDefinedVariable).length > 0) {
            lines.push('# User-Defined Variables');
            this.formatObject(canonical.userDefinedVariable, 'userDefinedVariable', lines);
            lines.push('');
        }

        // Format test section
        if (canonical.test) {
            lines.push('# Test Configuration');
            this.formatObject(canonical.test, 'test', lines);
        }

        return lines.join('\n');
    },

    /**
     * Recursively format object as Properties key-value pairs
     * @param {Object} obj - Object to format
     * @param {string} prefix - Current key prefix (dot notation)
     * @param {Array} lines - Output lines array
     */
    formatObject(obj, prefix, lines) {
        Object.entries(obj).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                // Skip null/undefined values
                return;
            }

            // Build the full key path using dot notation
            const fullKey = prefix ? `${prefix}.${key}` : key;
            const normalizedKey = this.normalizeKey(fullKey);

            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
                // Recurse into nested objects
                this.formatObject(value, fullKey, lines);
            } else {
                // Format primitive value
                const formattedValue = this.formatValue(value);
                lines.push(`${normalizedKey}=${formattedValue}`);
            }
        });
    },

    /**
     * Normalize key to lowercase with dots (Java Properties convention)
     * @param {string} key - Key to normalize
     * @returns {string} Normalized key
     */
    normalizeKey(key) {
        // Convert to lowercase, preserve dots
        return key.toLowerCase();
    },

    /**
     * Format value for Properties format
     * @param {*} value - Value to format
     * @returns {string} Formatted value (escaped if necessary)
     */
    formatValue(value) {
        // Null/undefined
        if (value === null || value === undefined) {
            return '';
        }

        // Boolean
        if (typeof value === 'boolean') {
            return value.toString();
        }

        // Number
        if (typeof value === 'number') {
            return value.toString();
        }

        // String with duration unit (no escaping needed - simple format like "60s", "1m", "2h")
        if (typeof value === 'string' && /^\d+[smh]$/.test(value)) {
            return value;  // Duration values don't contain special characters, no escaping needed
        }

        // String (escape if necessary)
        if (typeof value === 'string') {
            return this.escapeValue(value);
        }

        // Array (join with commas)
        if (Array.isArray(value)) {
            const joined = value.map(v => this.formatValue(v)).join(',');
            return this.escapeValue(joined);
        }

        // Fallback
        return this.escapeValue(String(value));
    },

    /**
     * Escape Properties value (backslash escaping for special characters)
     * @param {string} value - String value to escape
     * @returns {string} Escaped value
     */
    escapeValue(value) {
        if (typeof value !== 'string') {
            return String(value);
        }

        // Characters that need escaping in Properties format:
        // - Backslash (\)
        // - Equals sign (=) - only if not part of a URL or other valid context
        // - Hash (#) - only at start of line (comment marker)
        // - Exclamation mark (!) - only at start of line (comment marker)
        // - Newlines and tabs
        // Note: Colons (:) don't need escaping in values (they're only special as key-value separators)

        let escaped = value
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/\n/g, '\\n')   // Escape newlines
            .replace(/\r/g, '\\r')   // Escape carriage returns
            .replace(/\t/g, '\\t')   // Escape tabs
            .replace(/=/g, '\\=')     // Escape equals signs
            // Note: Colons are NOT escaped - they're valid in values (e.g., URLs, time formats)
            // Hash and exclamation are only special at line start, but we escape them for safety
            .replace(/#/g, '\\#')     // Escape hash (comment marker)
            .replace(/!/g, '\\!');    // Escape exclamation mark

        // If value contains spaces or starts/ends with space, we might want to quote it
        // But standard Properties format uses backslash escaping, so we'll stick with that
        // Leading/trailing spaces are preserved with backslash escaping

        return escaped;
    }
};

// Export
if (typeof window !== 'undefined') {
    window.PropertiesFormatter = PropertiesFormatter;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertiesFormatter;
}
