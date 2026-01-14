/**
 * Field Utilities
 * Form field generation, type detection, label formatting
 * 
 * @module FieldUtils
 */

const FieldUtils = {
    /**
     * Generate field definitions from config object
     * @param {Object} configObject - Configuration object with field values
     * @param {Object} metadataSource - Metadata definitions for fields
     * @returns {Array<Object>} Array of field definition objects
     */
    generateFields(configObject, metadataSource) {
        return Object.entries(configObject).map(([key, value]) => {
            const metadata = metadataSource[key] || {};

            if (!metadataSource[key]) {
                console.warn(`⚠️ Missing metadata for field: "${key}"`);
            }

            return {
                name: key,
                value: value,
                type: this.detectFieldType(value, metadata),
                label: metadata.label || this.formatLabel(key),
                help: metadata.help || '',
                unit: metadata.unit || '',
                min: this.getMinValue(key, metadata)
            };
        });
    },

    /**
     * Detect field type from value and metadata
     * @param {*} value - Field value
     * @param {Object} metadata - Field metadata
     * @returns {string} Field type (text, number, boolean, etc.)
     */
    detectFieldType(value, metadata) {
        // Use metadata type if provided
        if (metadata.type) {
            return metadata.type.toLowerCase();
        }

        const valueType = typeof value;

        // Detect from value type
        if (valueType === 'boolean') return 'boolean';
        if (valueType === 'number') return 'number';
        if (valueType === 'string') return 'text';

        // Handle arrays
        if (Array.isArray(value)) {
            console.warn('Array type detected, defaulting to text:', value);
            return 'text';
        }

        // Handle objects
        if (valueType === 'object' && value !== null) {
            console.warn('Object type detected, defaulting to text:', value);
            return 'text';
        }

        // Default
        console.warn('Unknown type, defaulting to text:', valueType, value);
        return 'text';
    },

    /**
     * Format camelCase field name to human-readable label
     * @param {string} fieldName - Field name in camelCase or snake_case
     * @returns {string} Formatted label
     */
    formatLabel(fieldName) {
        return fieldName
            // Insert space before capital letters
            .replace(/([A-Z])/g, ' $1')
            // Replace underscores with spaces
            .replace(/_/g, ' ')
            // Capitalize first letter
            .replace(/^./, str => str.toUpperCase())
            // Clean up extra spaces
            .trim();
    },

    /**
     * Get minimum value for field based on metadata or field name
     * @param {string} fieldName - Field name
     * @param {Object} metadata - Field metadata
     * @returns {number|undefined} Minimum value or undefined
     */
    getMinValue(fieldName, metadata) {
        // Use metadata min if provided
        if (metadata.min !== undefined) {
            return metadata.min;
        }

        // Apply sensible defaults based on field name
        if (fieldName === 'users') return 1;
        
        if (fieldName.toLowerCase().includes('duration')) return 0;
        if (fieldName.toLowerCase().includes('ramp')) return 0;
        if (fieldName.toLowerCase().includes('pause')) return 0;
        if (fieldName.toLowerCase().includes('delay')) return 0;
        if (fieldName.toLowerCase().includes('timeout')) return 0;
        if (fieldName.toLowerCase().includes('warmup')) return 0;

        return undefined;
    },

    /**
     * Get maximum value for field based on metadata
     * @param {string} fieldName - Field name
     * @param {Object} metadata - Field metadata
     * @returns {number|undefined} Maximum value or undefined
     */
    getMaxValue(fieldName, metadata) {
        if (metadata.max !== undefined) {
            return metadata.max;
        }

        // Could add sensible defaults here if needed
        return undefined;
    },

    /**
     * Validate field value against constraints
     * @param {*} value - Field value
     * @param {Object} field - Field definition with constraints
     * @returns {Object} Validation result with { valid, error }
     */
    validateFieldValue(value, field) {
        // Check required
        if (field.required && (value === null || value === undefined || value === '')) {
            return {
                valid: false,
                error: `${field.label} is required`
            };
        }

        // Check type
        if (field.type === 'number') {
            const numValue = Number(value);
            
            if (isNaN(numValue)) {
                return {
                    valid: false,
                    error: `${field.label} must be a number`
                };
            }

            // Check min
            if (field.min !== undefined && numValue < field.min) {
                return {
                    valid: false,
                    error: `${field.label} must be at least ${field.min}`
                };
            }

            // Check max
            if (field.max !== undefined && numValue > field.max) {
                return {
                    valid: false,
                    error: `${field.label} must be at most ${field.max}`
                };
            }
        }

        // Check string length
        if (field.type === 'text' && field.maxLength) {
            if (String(value).length > field.maxLength) {
                return {
                    valid: false,
                    error: `${field.label} must be less than ${field.maxLength} characters`
                };
            }
        }

        return { valid: true };
    },

    /**
     * Convert field definitions to form data object
     * @param {Array<Object>} fields - Array of field definitions
     * @returns {Object} Form data object
     */
    fieldsToData(fields) {
        const data = {};
        fields.forEach(field => {
            data[field.name] = field.value;
        });
        return data;
    },

    /**
     * Merge field updates into existing data
     * @param {Object} currentData - Current data object
     * @param {string} fieldName - Field name to update
     * @param {*} newValue - New value
     * @returns {Object} Updated data object
     */
    updateField(currentData, fieldName, newValue) {
        return {
            ...currentData,
            [fieldName]: newValue
        };
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.FieldUtils = FieldUtils;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FieldUtils;
}