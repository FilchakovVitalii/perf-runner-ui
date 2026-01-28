/**
 * Preset Management Service
 * Handles built-in and user preset operations
 * 
 * @module PresetService
 */

const PresetService = {
    /**
     * Storage key for user presets
     */
    STORAGE_KEY: 'perf_runner_presets',

    /**
     * Maximum number of user presets allowed
     */
    MAX_USER_PRESETS: 20,

    /**
     * Export format version for preset import/export
     */
    EXPORT_VERSION: 1,

    /**
     * Preset config model: which keys are part of selections/loadData/scenarioData.
     * Add or remove keys here when UI/options change; export/import/apply stay generic.
     * - selections: array of allowed keys (only these are read/written).
     * - loadData / scenarioData: true = all own enumerable keys.
     */
    CONFIG_MODEL: {
        selections: ['loadType', 'environment', 'targetUrl', 'scenario'],
        loadData: true,
        scenarioData: true
    },

    /**
     * Build preset config from app state using CONFIG_MODEL (export/save).
     * @param {Object} selection - App selection state
     * @param {Object} loadData - App loadData state
     * @param {Object} scenarioData - App scenarioData state
     * @returns {Object} { selections, loadData, scenarioData }
     */
    buildConfigFromState(selection, loadData, scenarioData) {
        const m = this.CONFIG_MODEL;
        const selections = {};
        if (m.selections && Array.isArray(m.selections)) {
            m.selections.forEach(function (k) {
                if (selection && selection[k] !== undefined) {
                    selections[k] = selection[k];
                }
            });
        }
        return {
            selections,
            loadData: (loadData && typeof loadData === 'object' && m.loadData) ? { ...loadData } : {},
            scenarioData: (scenarioData && typeof scenarioData === 'object' && m.scenarioData) ? { ...scenarioData } : {}
        };
    },

    /**
     * Produce state patch from preset config using CONFIG_MODEL (import/load).
     * Only includes keys that exist in the model and in config; unknown keys are ignored.
     * @param {Object} config - Preset.config from file or storage
     * @returns {Object} { selections, loadData, scenarioData } to apply to state
     */
    applyConfigToState(config) {
        if (!config || typeof config !== 'object') {
            return { selections: {}, loadData: {}, scenarioData: {} };
        }
        const m = this.CONFIG_MODEL;
        const selections = {};
        if (m.selections && Array.isArray(m.selections) && config.selections && typeof config.selections === 'object') {
            m.selections.forEach(function (k) {
                if (config.selections[k] !== undefined) {
                    selections[k] = config.selections[k];
                }
            });
        }
        return {
            selections,
            loadData: (config.loadData && typeof config.loadData === 'object' && m.loadData) ? { ...config.loadData } : {},
            scenarioData: (config.scenarioData && typeof config.scenarioData === 'object' && m.scenarioData) ? { ...config.scenarioData } : {}
        };
    },

    /**
     * Build export payload (envelope + presets array).
     * @param {Array<Object>} presets - One or more preset objects
     * @returns {Object} { version, exportedAt, presets }
     */
    buildExportPayload(presets) {
        const list = Array.isArray(presets) ? presets : [presets];
        return {
            version: this.EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            presets: list
        };
    },

    /**
     * Initialize preset system (user presets only; built-in are loaded separately from file).
     * @returns {Object} { builtInPresets: [], userPresets }
     */
    initialize() {
        const userPresets = this.loadUserPresets();
        console.log('✅ Presets initialized (user):', userPresets.length);
        return {
            builtInPresets: [],
            userPresets
        };
    },

    /**
     * Load built-in presets from a resource URL (e.g. resources/builtin-presets.json).
     * Same file format as export: { version, presets }. Preserves preset ids from the file.
     * @param {string} [url] - If omitted, uses CONFIG.resources.builtInPresetsUrl.
     * @returns {Promise<Array>} Sanitized presets; [] if disabled, 404, or invalid.
     */
    async loadBuiltInPresets(url) {
        const u = url || (typeof window !== 'undefined' && window.CONFIG?.resources?.builtInPresetsUrl) || '';
        if (!u || typeof u !== 'string' || u.trim() === '') {
            return [];
        }
        try {
            const res = await fetch(u.trim(), { cache: 'no-cache' });
            if (!res.ok) {
                if (res.status !== 404) {
                    console.warn('Built-in presets request failed:', res.status, res.statusText);
                }
                return [];
            }
            const data = await res.json();
            const raw = Array.isArray(data.presets) ? data.presets : [];
            const out = [];
            for (let i = 0; i < raw.length; i++) {
                const p = raw[i];
                if (!p || typeof p !== 'object') continue;
                const name = p.name != null ? String(p.name).trim() : '';
                if (!name) continue;
                const c = p.config;
                if (!c || typeof c !== 'object' || !c.selections || typeof c.selections !== 'object') continue;
                const patch = this.applyConfigToState(c);
                out.push(this.sanitizePreset({
                    id: p.id != null ? String(p.id) : 'builtin-' + i,
                    name,
                    description: p.description != null ? p.description : '',
                    icon: (p.icon != null && String(p.icon).trim() !== '') ? SecurityUtils.sanitizeEmoji(p.icon) : '',
                    config: { selections: patch.selections, loadData: patch.loadData, scenarioData: patch.scenarioData }
                }));
            }
            console.log('📂 Loaded built-in presets:', out.length, 'from', u);
            return out;
        } catch (e) {
            console.warn('Built-in presets load failed:', e);
            return [];
        }
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
     * Sanitize a preset object (XSS prevention). Icon is optional; empty allowed.
     * @param {Object} preset - Preset object to sanitize
     * @returns {Object} Sanitized preset
     */
    sanitizePreset(preset) {
        const hasIcon = preset.icon != null && String(preset.icon).trim() !== '';
        return {
            ...preset,
            name: SecurityUtils.sanitizeInput(preset.name || '', 50),
            description: SecurityUtils.sanitizeInput(preset.description || '', 100),
            icon: hasIcon ? SecurityUtils.sanitizeEmoji(preset.icon) : ''
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
        const hasIcon = icon != null && String(icon).trim() !== '';
        const sanitizedIcon = hasIcon ? SecurityUtils.sanitizeEmoji(icon) : '';

        if (!sanitizedName) {
            throw new Error('Preset name is required');
        }

        // Normalize config through model so only known keys are stored
        const patch = this.applyConfigToState(config);
        const storedConfig = {
            selections: patch.selections,
            loadData: patch.loadData,
            scenarioData: patch.scenarioData
        };

        const preset = {
            id: 'user-' + Date.now(),
            name: sanitizedName,
            description: sanitizedDescription,
            icon: sanitizedIcon,
            created: new Date().toISOString(),
            config: storedConfig
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
     * Parse import file (versioned). Unknown versions fall back to v1.
     * @param {string} jsonString - Raw JSON string from file or paste
     * @returns {{ ok: boolean, presets?: Array, error?: string, invalidCount?: number }}
     */
    parseImportFile(jsonString) {
        let data;
        try {
            data = JSON.parse(jsonString);
        } catch (e) {
            return { ok: false, error: 'Invalid JSON' };
        }
        if (!data || typeof data !== 'object') {
            return { ok: false, error: 'Invalid format' };
        }
        const version = (data.version != null && Number.isInteger(data.version)) ? data.version : 1;
        if (version === 1) {
            return this._parseImportV1(data);
        }
        return this._parseImportV1(data);
    },

    _parseImportV1(data) {
        const raw = Array.isArray(data.presets) ? data.presets : [];
        const presets = [];
        let invalidCount = 0;
        for (let i = 0; i < raw.length; i++) {
            const p = raw[i];
            if (!p || typeof p !== 'object') {
                invalidCount++;
                continue;
            }
            const name = p.name != null ? String(p.name).trim() : '';
            if (!name) {
                invalidCount++;
                continue;
            }
            const c = p.config;
            if (!c || typeof c !== 'object' || !c.selections || typeof c.selections !== 'object') {
                invalidCount++;
                continue;
            }
            presets.push(this.sanitizePreset({
                id: 'user-' + Date.now() + '-' + i,
                name,
                description: p.description != null ? p.description : '',
                icon: (p.icon != null && String(p.icon).trim() !== '') ? SecurityUtils.sanitizeEmoji(p.icon) : '',
                created: p.created || new Date().toISOString(),
                config: this.applyConfigToState(c)
            }));
        }
        return {
            ok: true,
            presets,
            invalidCount
        };
    },

    /**
     * Merge imported presets into current list. Applies model when normalizing; assigns new ids.
     * @param {Array} currentPresets - Current user presets
     * @param {Array} importedPresets - Parsed presets from parseImportFile
     * @param {{ onDuplicate?: 'replace'|'skip' }} options - onDuplicate: 'replace' (default) or 'skip'
     * @returns {{ success: boolean, presets: Array, importedCount: number, skippedCount: number, error?: string }}
     */
    mergeImportedPresets(currentPresets, importedPresets, options = {}) {
        const onDuplicate = options.onDuplicate === 'skip' ? 'skip' : 'replace';
        const limit = this.MAX_USER_PRESETS;
        let importedCount = 0;
        let skippedCount = 0;
        let list = [...(currentPresets || [])];
        const names = new Set(list.map(function (p) { return p.name; }));

        for (let i = 0; i < (importedPresets || []).length; i++) {
            if (list.length >= limit) break;
            const p = importedPresets[i];
            if (!p || !p.name) {
                skippedCount++;
                continue;
            }
            if (names.has(p.name)) {
                if (onDuplicate === 'skip') {
                    skippedCount++;
                    continue;
                }
                list = list.filter(function (q) { return q.name !== p.name; });
                names.delete(p.name);
            }
            const preset = {
                ...this.sanitizePreset(p),
                id: 'user-' + Date.now() + '-' + i,
                config: {
                    selections: (p.config && p.config.selections) ? { ...p.config.selections } : {},
                    loadData: (p.config && p.config.loadData) ? { ...p.config.loadData } : {},
                    scenarioData: (p.config && p.config.scenarioData) ? { ...p.config.scenarioData } : {}
                }
            };
            list.push(preset);
            names.add(preset.name);
            importedCount++;
        }

        try {
            this.saveUserPresets(list);
            return { success: true, presets: list, importedCount, skippedCount };
        } catch (e) {
            return { success: false, presets: currentPresets, importedCount: 0, skippedCount: 0, error: e.message };
        }
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