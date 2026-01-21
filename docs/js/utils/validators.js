/**
 * Validation Utilities
 * Form validation logic for load and scenario configurations
 * 
 * @module ValidationUtils
 */

const ValidationUtils = {
    /**
     * Validate load configuration data
     * @param {Object} loadData - Load configuration object
     * @returns {Array<string>} Array of error messages (empty if valid)
     */
    validateLoadConfig(loadData) {
        const errors = [];

        // Validate users
        if (loadData.users !== undefined && loadData.users < 1) {
            errors.push('Users must be at least 1');
        }

        // Validate duration
        if (loadData.duration !== undefined && loadData.duration < 0) {
            errors.push('Duration cannot be negative');
        }

        // Validate duration vs ramp-up
        if (loadData.duration !== undefined &&
            loadData.rampUp !== undefined &&
            loadData.duration < loadData.rampUp) {
            errors.push('Duration must be greater than or equal to Ramp-Up time');
        }

        // Validate pause times
        if (loadData.minPause !== undefined &&
            loadData.maxPause !== undefined &&
            loadData.minPause > loadData.maxPause) {
            errors.push('Min Pause cannot be greater than Max Pause');
        }

        // Validate warmup (for capacity tests)
        if (loadData.warmupDuration !== undefined && loadData.warmupDuration < 0) {
            errors.push('Warmup Duration cannot be negative');
        }

        if (loadData.warmupUsers !== undefined && loadData.warmupUsers < 0) {
            errors.push('Warmup Users cannot be negative');
        }

        return errors;
    },


};

// Export for browser
if (typeof window !== 'undefined') {
    window.ValidationUtils = ValidationUtils;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationUtils;
}