/**
 * Configuration Formatters
 * Converts config objects to JSON/ENV formats
 * 
 * @module FormatUtils
 */

const FormatUtils = {
    /**
     * Generate JSON format output
     * @param {Object} config - Configuration object
     * @returns {string} Formatted JSON string
     */
    toJSON(config) {
        return JSON.stringify(config, null, 2);
    },

    /**
     * Generate ENV format output
     * @param {Object} config - Configuration object with structure:
     *   - loadType: string
     *   - loadConfig: object
     *   - environment: string
     *   - target_url: string
     *   - scenario: string
     *   - scenarioFields: object
     *   - timestamp: string
     * @returns {string} Formatted ENV string
     */
    toENV(config) {
        const lines = [];

        lines.push('# Performance Test Configuration');
        lines.push(`# Generated: ${config.timestamp}`);
        lines.push('');

        // Load Configuration
        lines.push('# Load Configuration');
        lines.push(`LOAD_TYPE=${config.loadType}`);

        Object.entries(config.loadConfig).forEach(([key, value]) => {
            const envKey = this.toEnvKey('LOAD', key);
            const envValue = this.toEnvValue(value);
            lines.push(`${envKey}=${envValue}`);
        });
        lines.push('');

        // Environment
        lines.push('# Environment');
        lines.push(`ENVIRONMENT=${config.environment}`);
        lines.push(`TARGET_URL=${this.escapeEnvValue(config.target_url)}`);
        lines.push('');

        // Scenario
        lines.push('# Scenario');
        lines.push(`SCENARIO=${this.escapeEnvValue(config.scenario)}`);

        if (Object.keys(config.scenarioFields).length > 0) {
            Object.entries(config.scenarioFields).forEach(([key, value]) => {
                const envKey = this.toEnvKey('SCENARIO', key);
                const envValue = this.toEnvValue(value);
                lines.push(`${envKey}=${envValue}`);
            });
            lines.push('');
        }

        // Metadata
        lines.push('# Metadata');
        lines.push(`TIMESTAMP=${config.timestamp}`);

        return lines.join('\n');
    },

    /**
     * Convert field name to ENV variable key
     * @param {string} prefix - Prefix for env key (e.g., 'LOAD', 'SCENARIO')
     * @param {string} fieldName - Field name in camelCase
     * @returns {string} ENV key in UPPER_SNAKE_CASE
     */
    toEnvKey(prefix, fieldName) {
        const envName = fieldName
            .replace(/([A-Z])/g, '_$1')
            .toUpperCase()
            .replace(/^_/, '');
        return `${prefix}_${envName}`;
    },

    /**
     * Convert value to ENV format
     * @param {*} value - Value to convert
     * @returns {string} Formatted value for ENV
     */
    toEnvValue(value) {
        if (typeof value === 'boolean') return value.toString();
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'string') return this.escapeEnvValue(value);
        return String(value);
    },

    /**
     * Escape special characters in ENV values
     * @param {string} value - Value to escape
     * @returns {string} Escaped value (quoted if necessary)
     */
    escapeEnvValue(value) {
        if (/[\s$"'`\\]/.test(value)) {
            return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.FormatUtils = FormatUtils;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormatUtils;
}