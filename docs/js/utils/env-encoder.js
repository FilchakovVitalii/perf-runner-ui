/**
 * ENV Encoder - Strict HOCON-compatible ENV encoding
 * Uses double-underscore (__) for path nesting
 * 
 * @module EnvEncoder
 */

const EnvEncoder = {
    /**
     * Encode canonical config to ENV format with strict rules
     * @param {Object} canonical - Canonical configuration object
     * @returns {string} ENV-formatted string
     */
    encode(canonical) {
        const lines = [];

        lines.push('# Gatling Performance Test Configuration');
        lines.push(`# Generated: ${new Date().toISOString()}`);
        lines.push('');

        // Encode userDefinedVariable section
        if (canonical.userDefinedVariable && Object.keys(canonical.userDefinedVariable).length > 0) {
            lines.push('# User-Defined Variables');
            this.encodeObject(canonical.userDefinedVariable, 'USERDEFINEDVARIABLE', lines);
            lines.push('');
        }

        // Encode test section
        if (canonical.test) {
            lines.push('# Test Configuration');
            this.encodeObject(canonical.test, 'TEST', lines);
        }

        return lines.join('\n');
    },

    /**
     * Recursively encode object to ENV key-value pairs
     * @param {Object} obj - Object to encode
     * @param {string} prefix - Current key prefix
     * @param {Array} lines - Output lines array
     */
    encodeObject(obj, prefix, lines) {
        Object.entries(obj).forEach(([key, value]) => {
            const envKey = this.toEnvKey(prefix, key);

            if (value === null || value === undefined) {
                // Skip null/undefined values
                return;
            }

            if (typeof value === 'object' && !Array.isArray(value)) {
                // Recurse into nested objects
                this.encodeObject(value, envKey, lines);
            } else {
                // Encode primitive value
                const envValue = this.toEnvValue(value);
                lines.push(`${envKey}=${envValue}`);
            }
        });
    },

    /**
     * Convert nested path to ENV key with strict rules
     * @param {string} prefix - Current prefix
     * @param {string} segment - New segment to add
     * @returns {string} ENV key in UPPER_SNAKE_CASE
     */
    toEnvKey(prefix, segment) {
        // Normalize segment:
        // 1. Replace hyphens with underscores
        // 2. Convert to uppercase
        // 3. Single underscores are preserved (literal)
        
        const normalized = segment
            .replace(/-/g, '_')  // hyphen → underscore
            .toUpperCase();

        // Validate: no empty segments, no special chars
        if (!normalized || /[^A-Z0-9_]/.test(normalized)) {
            console.warn(`Invalid ENV segment: "${segment}"`);
        }

        // Join with double underscore (path separator)
        return prefix ? `${prefix}__${normalized}` : normalized;
    },

    /**
     * Convert value to ENV format
     * @param {*} value - Value to encode
     * @returns {string} ENV-formatted value
     */
    toEnvValue(value) {
        // Boolean
        if (typeof value === 'boolean') {
            return value.toString();
        }

        // Number
        if (typeof value === 'number') {
            return value.toString();
        }

        // String
        if (typeof value === 'string') {
            return this.escapeEnvValue(value);
        }

        // Array (join with commas)
        if (Array.isArray(value)) {
            return value.map(v => this.toEnvValue(v)).join(',');
        }

        // Fallback
        return String(value);
    },

    /**
     * Escape ENV value (quote if necessary)
     * @param {string} value - String value
     * @returns {string} Escaped value
     */
    escapeEnvValue(value) {
        // Quote if contains spaces, $, quotes, or backslashes
        if (/[\s$"'`\\]/.test(value)) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }

        // Otherwise return as-is (dots, slashes preserved)
        return value;
    },


};

// Export
if (typeof window !== 'undefined') {
    window.EnvEncoder = EnvEncoder;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnvEncoder;
}