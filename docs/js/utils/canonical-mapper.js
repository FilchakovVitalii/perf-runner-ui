/**
 * Canonical Configuration Mapper
 * Maps UI selections and field data to Gatling HOCON-compatible canonical schema
 * 
 * @module CanonicalMapper
 */

const CanonicalMapper = {
    /**
     * Map UI selections and data to canonical configuration schema
     * @param {Object} selections - UI selections (loadType, environment, targetUrl, scenario)
     * @param {Object} loadData - Load profile field data
     * @param {Object} scenarioData - Scenario-specific field data
     * @param {Object} testConfig - Full config.json for reference
     * @returns {Object} Canonical configuration object
     */
    toCanonical(selections, loadData, scenarioData, testConfig) {
        const canonical = {
            userDefinedVariable: this.mapUserDefinedVariables(scenarioData),
            test: {
                simulation: selections.scenario,
                descriptions: this.generateDescription(selections, testConfig),
                type: selections.loadType,
                environment: {
                    type: selections.environment,
                    url: selections.targetUrl
                },
                load: {
                    pause: this.mapPause(loadData),
                    profiles: this.mapProfiles(selections.loadType, loadData, testConfig)
                }
            }
        };

        return canonical;
    },

    /**
     * Map scenario fields to userDefinedVariable
     * @param {Object} scenarioData - Scenario field data from UI
     * @returns {Object} User-defined variables object
     */
    mapUserDefinedVariables(scenarioData) {
        // Return empty object if no scenario data
        if (!scenarioData || Object.keys(scenarioData).length === 0) {
            return {};
        }

        // Direct mapping - preserve field names as-is
        return { ...scenarioData };
    },

    /**
     * Generate test description
     * @param {Object} selections - UI selections
     * @param {Object} testConfig - config.json reference
     * @returns {string} Test description
     */
    generateDescription(selections, testConfig) {
        const loadConfig = testConfig?.loadConfig?.[selections.loadType];
        const scenarioConfig = testConfig?.scenarioConfig?.[selections.scenario];

        const parts = [];
        
        if (loadConfig?.label) {
            parts.push(loadConfig.label);
        }
        
        if (scenarioConfig?.label) {
            parts.push(scenarioConfig.label);
        }
        
        parts.push(`on ${selections.environment}`);

        return parts.join(' - ');
    },

    /**
     * Map pause configuration
     * @param {Object} loadData - Load profile data
     * @returns {Object} Pause configuration with min/max
     */
    mapPause(loadData) {
        return {
            min: this.formatDuration(loadData.minPause),
            max: this.formatDuration(loadData.maxPause)
        };
    },

    /**
     * Map load profiles configuration
     * @param {string} loadType - Selected load type (smoke/longevity/capacity)
     * @param {Object} loadData - Load profile field data
     * @param {Object} testConfig - config.json reference
     * @returns {Object} Profiles configuration
     */
    mapProfiles(loadType, loadData, testConfig) {
        const profiles = {};

        // Add scanPackage placeholder (can be customized later)
        profiles.scanPackage = "custom.profile";

        // Map selected profile
        const profileConfig = {};

        // Standard fields
        if (loadData.ramp !== undefined) {
            profileConfig.ramp = this.formatDuration(loadData.ramp);
        }

        if (loadData.users !== undefined) {
            profileConfig.users = loadData.users;
        }

        if (loadData.duration !== undefined) {
            profileConfig.duration = this.formatDuration(loadData.duration);
        }

        // Warmup fields (if present)
        const hasWarmup = loadData.warmupRamp !== undefined || 
                         loadData.warmupUsers !== undefined || 
                         loadData.warmupDuration !== undefined;

        if (hasWarmup) {
            profileConfig.warmup = {};

            if (loadData.warmupRamp !== undefined) {
                profileConfig.warmup.ramp = this.formatDuration(loadData.warmupRamp);
            }

            if (loadData.warmupUsers !== undefined) {
                profileConfig.warmup.users = loadData.warmupUsers;
            }

            if (loadData.warmupDuration !== undefined) {
                profileConfig.warmup.duration = this.formatDuration(loadData.warmupDuration);
            }
        }

        // Add profile with loadType as key
        profiles[loadType] = profileConfig;

        return profiles;
    },

    /**
     * Format duration value
     * Accepts: numeric (seconds) or string with unit (3s, 1m, etc.)
     * @param {number|string} value - Duration value
     * @returns {number|string} Formatted duration
     */
    formatDuration(value) {
        if (value === undefined || value === null) {
            return value;
        }

        // If already a string with unit, return as-is
        if (typeof value === 'string' && /^\d+[smh]$/.test(value)) {
            return value;
        }

        // If numeric, return as number (represents seconds)
        if (typeof value === 'number') {
            return value;
        }

        // If string digit, convert to number
        const parsed = Number(value);
        if (!isNaN(parsed)) {
            return parsed;
        }

        // Fallback
        return value;
    },

    /**
     * Validate canonical configuration
     * @param {Object} canonical - Canonical config object
     * @returns {Object} Validation result { valid: boolean, errors: Array }
     */
    validate(canonical) {
        const errors = [];

        // Required fields
        if (!canonical.test?.simulation) {
            errors.push('test.simulation is required');
        }

        if (!canonical.test?.type) {
            errors.push('test.type is required');
        }

        if (!canonical.test?.environment?.type) {
            errors.push('test.environment.type is required');
        }

        if (!canonical.test?.environment?.url) {
            errors.push('test.environment.url is required');
        }

        // Validate pause
        if (canonical.test?.load?.pause) {
            const { min, max } = canonical.test.load.pause;
            
            if (min !== undefined && max !== undefined) {
                const minVal = this.parseDuration(min);
                const maxVal = this.parseDuration(max);
                
                if (minVal > maxVal) {
                    errors.push('pause.min cannot be greater than pause.max');
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    },

    /**
     * Parse duration to numeric seconds for comparison
     * @param {number|string} duration - Duration value
     * @returns {number} Duration in seconds
     */
    parseDuration(duration) {
        if (typeof duration === 'number') {
            return duration;
        }

        if (typeof duration === 'string') {
            const match = duration.match(/^(\d+)([smh]?)$/);
            if (match) {
                const value = parseInt(match[1]);
                const unit = match[2];

                switch (unit) {
                    case 'm': return value * 60;
                    case 'h': return value * 3600;
                    case 's':
                    default: return value;
                }
            }
        }

        return 0;
    }
};

// Export
if (typeof window !== 'undefined') {
    window.CanonicalMapper = CanonicalMapper;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CanonicalMapper;
}