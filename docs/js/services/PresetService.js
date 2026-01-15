/**
 * Preset Management Service
 * Handles built-in and user preset operations
 * 
 * @module PresetService
 */

const PresetService = {
    /**
     * Built-in preset configurations
     * These are immutable and always available
     */
    builtInPresets: [
        {
            id: 'smoke-sandbox',
            name: 'Quick Smoke',
            icon: '🔥',
            description: 'Fast smoke test on sandbox environment',
            config: {
                selections: {
                    loadType: 'smoke',
                    environment: 'sandbox',
                    scenario: 'project.scenario.ScenarioName'
                }
            }
        },
        {
            id: 'capacity-stage',
            name: 'Capacity Stage',
            icon: '📊',
            description: 'Full capacity test on staging environment',
            config: {
                selections: {
                    loadType: 'capacity',
                    environment: 'stage',
                    scenario: 'project.scenario.ScenarioName'
                }
            }
        },
        {
            id: 'longevity-sandbox',
            name: 'Longevity',
            icon: '⏱️',
            description: 'Long-running stability test on sandbox',
            config: {
                selections: {
                    loadType: 'longevity',
                    environment: 'sandbox',
                    scenario: 'project.scenario.ScenarioName'
                }
            }
        },
        {
            id: 'quick-validation',
            name: 'Quick Validation',
            icon: '🎯',
            description: 'Quick validation test with minimal config',
            config: {
                selections: {
                    loadType: 'smoke',
                    environment: 'sandbox',
                    scenario: 'project.scenario.ScenarioNoAdditionalFields'
                }
            }
        }
    ],

    /**
     * Storage key for user presets
     */
    STORAGE_KEY: 'perf_runner_presets',

    /**
     * Maximum number of user presets allowed
     */
    MAX_USER_PRESETS: 20,

    /**
     * Initialize preset system
     * @returns {Object} Object with builtInPresets and userPresets arrays
     */
    initialize() {
        const userPresets = this.loadUserPresets();
        
        console.log('✅ Presets initialized:', {
            builtIn: this.builtInPresets.length,
            user: userPresets.length
        });

        return {
            builtInPresets: this.builtInPresets,
            userPresets
        };
    },

    /**
     * Load user presets from localStorage
     * @returns {Array} Array of user preset objects (sanitized)
     */
    loadUserPresets() {
        try {
            const presets = StorageUtils.getJSON(this.STORAGE_KEY, []);
            
            // Validate and sanitize each preset
            const sanitizedPresets = presets
                .filter(p => p && p.id && p.name)
                .map(p => this.sanitizePreset(p));
            
            console.log('📂 Loaded user presets:', sanitizedPresets.length);
            return sanitizedPresets;

        } catch (error) {
            console.error('Failed to load user presets:', error);
            return [];
        }
    },

    /**
     * Save user presets to localStorage
     * @param {Array} presets - Array of user presets
     * @returns {boolean} True if saved successfully
     */
    saveUserPresets(presets) {
        try {
            StorageUtils.setJSON(this.STORAGE_KEY, presets);
            console.log('💾 Saved user presets:', presets.length);
            return true;
        } catch (error) {
            console.error('Failed to save user presets:', error);
            throw new Error(error.message || 'Failed to save preset');
        }
    },

    /**
     * Sanitize a preset object (XSS prevention)
     * @param {Object} preset - Preset object to sanitize
     * @returns {Object} Sanitized preset
     */
    sanitizePreset(preset) {
        return {
            ...preset,
            name: SecurityUtils.sanitizeInput(preset.name || '', 50),
            description: SecurityUtils.sanitizeInput(preset.description || '', 100),
            icon: SecurityUtils.sanitizeEmoji(preset.icon || '🚀')
        };
    },

    /**
     * Create a new user preset
     * @param {string} name - Preset name
     * @param {string} description - Preset description
     * @param {string} icon - Preset icon (emoji)
     * @param {Object} config - Configuration object with selections, loadData, scenarioData
     * @returns {Object} New preset object
     */
    createPreset(name, description, icon, config) {
        // Sanitize inputs
        const sanitizedName = SecurityUtils.sanitizeInput(name, 50);
        const sanitizedDescription = SecurityUtils.sanitizeInput(description, 100);
        const sanitizedIcon = SecurityUtils.sanitizeEmoji(icon);

        if (!sanitizedName) {
            throw new Error('Preset name is required');
        }

        // Create preset object
        const preset = {
            id: 'user-' + Date.now(),
            name: sanitizedName,
            description: sanitizedDescription,
            icon: sanitizedIcon,
            created: new Date().toISOString(),
            config: {
                selections: {
                    loadType: config.selections.loadType,
                    environment: config.selections.environment,
                    targetUrl: config.selections.targetUrl,
                    scenario: config.selections.scenario
                },
                loadData: { ...config.loadData },
                scenarioData: { ...config.scenarioData }
            }
        };

        return preset;
    },

    /**
     * Add a preset to user presets list
     * @param {Array} currentPresets - Current user presets array
     * @param {Object} newPreset - New preset to add
     * @returns {Object} Result with { success, presets, error }
     */
    addPreset(currentPresets, newPreset) {
        try {
            // Check for duplicate names
            const existingIndex = currentPresets.findIndex(p => p.name === newPreset.name);
            
            if (existingIndex !== -1) {
                // Remove existing preset with same name
                currentPresets = currentPresets.filter(p => p.name !== newPreset.name);
                console.log('⚠️ Overwriting existing preset:', newPreset.name);
            }

            // Check preset limit
            if (currentPresets.length >= this.MAX_USER_PRESETS) {
                throw new Error(`Maximum ${this.MAX_USER_PRESETS} user presets allowed. Please delete some presets first.`);
            }

            // Add new preset
            const updatedPresets = [...currentPresets, newPreset];

            // Save to localStorage
            this.saveUserPresets(updatedPresets);

            return {
                success: true,
                presets: updatedPresets,
                preset: newPreset
            };

        } catch (error) {
            return {
                success: false,
                presets: currentPresets,
                error: error.message
            };
        }
    },

    /**
     * Delete a user preset
     * @param {Array} currentPresets - Current user presets array
     * @param {string} presetId - ID of preset to delete
     * @returns {Object} Result with { success, presets, deletedPreset }
     */
    deletePreset(currentPresets, presetId) {
        try {
            const preset = currentPresets.find(p => p.id === presetId);

            if (!preset) {
                throw new Error('Preset not found');
            }

            // Remove preset
            const updatedPresets = currentPresets.filter(p => p.id !== presetId);

            // Save to localStorage
            this.saveUserPresets(updatedPresets);

            return {
                success: true,
                presets: updatedPresets,
                deletedPreset: preset
            };

        } catch (error) {
            return {
                success: false,
                presets: currentPresets,
                error: error.message
            };
        }
    },

    /**
     * Find a preset by ID (searches both built-in and user presets)
     * @param {string} presetId - Preset ID
     * @param {Array} userPresets - User presets array
     * @returns {Object|null} Preset object or null if not found
     */
    findPresetById(presetId, userPresets) {
        // Search built-in presets
        const builtIn = this.builtInPresets.find(p => p.id === presetId);
        if (builtIn) return builtIn;

        // Search user presets
        const user = userPresets.find(p => p.id === presetId);
        if (user) return user;

        return null;
    },

    /**
     * Export user presets as JSON file
     * @param {Array} userPresets - User presets to export
     * @returns {string} JSON string
     */
    exportPresets(userPresets) {
        return JSON.stringify({
            version: '1.0',
            exported: new Date().toISOString(),
            presets: userPresets
        }, null, 2);
    },

    /**
     * Import user presets from JSON
     * @param {string} jsonString - JSON string to import
     * @returns {Object} Result with { success, presets, error }
     */
    importPresets(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (!data.presets || !Array.isArray(data.presets)) {
                throw new Error('Invalid preset file format');
            }

            // Sanitize imported presets
            const sanitizedPresets = data.presets
                .filter(p => p && p.id && p.name)
                .map(p => this.sanitizePreset(p));

            return {
                success: true,
                presets: sanitizedPresets
            };

        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to import presets'
            };
        }
    },

    /**
     * Get preset statistics
     * @param {Array} userPresets - User presets array
     * @returns {Object} Statistics object
     */
    getStats(userPresets) {
        return {
            builtInCount: this.builtInPresets.length,
            userCount: userPresets.length,
            totalCount: this.builtInPresets.length + userPresets.length,
            remainingSlots: this.MAX_USER_PRESETS - userPresets.length,
            storageUsed: JSON.stringify(userPresets).length
        };
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.PresetService = PresetService;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PresetService;
}