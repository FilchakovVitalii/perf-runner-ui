/**
 * HOCON Formatter
 * Renders canonical configuration as HOCON (Human-Optimized Config Object Notation)
 * 
 * @module HoconFormatter
 */

const HoconFormatter = {
    /**
     * Format canonical config as HOCON
     * @param {Object} canonical - Canonical configuration object
     * @returns {string} HOCON-formatted string
     */
    format(canonical) {
        const lines = [];

        lines.push('# Gatling HOCON Configuration');
        lines.push(`# Generated: ${new Date().toISOString()}`);
        lines.push('');

        // Format userDefinedVariable section
        if (canonical.userDefinedVariable && Object.keys(canonical.userDefinedVariable).length > 0) {
            lines.push('userDefinedVariable {');
            this.formatObject(canonical.userDefinedVariable, 1, lines);
            lines.push('}');
            lines.push('');
        }

        // Format test section
        if (canonical.test) {
            lines.push('test {');
            this.formatObject(canonical.test, 1, lines);
            lines.push('}');
        }

        return lines.join('\n');
    },

    /**
     * Recursively format object as HOCON
     * @param {Object} obj - Object to format
     * @param {number} indent - Current indentation level
     * @param {Array} lines - Output lines array
     */
    formatObject(obj, indent, lines) {
        const indentStr = '  '.repeat(indent);

        Object.entries(obj).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                return;
            }

            if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0) {
                // Nested object
                lines.push(`${indentStr}${key} {`);
                this.formatObject(value, indent + 1, lines);
                lines.push(`${indentStr}}`);
            } else {
                // Primitive value
                const formattedValue = this.formatValue(value);
                lines.push(`${indentStr}${key} = ${formattedValue}`);
            }
        });
    },

    /**
     * Format value for HOCON
     * @param {*} value - Value to format
     * @returns {string} Formatted value
     */
    formatValue(value) {
        // Null/undefined
        if (value === null) return 'null';
        if (value === undefined) return 'null';

        // Boolean (unquoted)
        if (typeof value === 'boolean') {
            return value.toString();
        }

        // Number (unquoted)
        if (typeof value === 'number') {
            return value.toString();
        }

        // String with duration unit (unquoted if valid)
        if (typeof value === 'string' && /^\d+[smh]$/.test(value)) {
            return value;
        }

        // String (quoted)
        if (typeof value === 'string') {
            return `"${value.replace(/"/g, '\\"')}"`;
        }

        // Array
        if (Array.isArray(value)) {
            return '[' + value.map(v => this.formatValue(v)).join(', ') + ']';
        }

        // Object (shouldn't reach here in normal flow)
        return JSON.stringify(value);
    }
};

// Export
if (typeof window !== 'undefined') {
    window.HoconFormatter = HoconFormatter;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HoconFormatter;
}