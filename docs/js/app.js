/**
 * Performance Test Runner - Vue.js Application
 */

const { createApp } = Vue;

// ============================================
// Security Utilities
// ============================================

/**
 * HTML Sanitizer - Prevents XSS attacks
 */
const SecurityUtils = {
    /**
     * Escape HTML entities to prevent XSS
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;'
        };
        
        return text.replace(/[&<>"'/]/g, m => map[m]);
    },

    /**
     * Sanitize user input - removes dangerous characters
     */
    sanitizeInput(input, maxLength = 1000) {
        if (typeof input !== 'string') return String(input);
        
        // Remove control characters except newlines
        let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Limit length
        sanitized = sanitized.substring(0, maxLength);
        
        return sanitized.trim();
    },

    /**
     * Validate URL format
     */
    isValidUrl(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    },

    /**
     * Validate emoji/icon (single emoji only)
     */
    sanitizeEmoji(input) {
        if (typeof input !== 'string') return '🚀';
        
        // Get first character (handles multi-byte emojis)
        const firstEmoji = Array.from(input.trim())[0];
        
        // If empty or just whitespace, return default
        if (!firstEmoji) return '🚀';
        
        // Check if it's likely an emoji (basic check)
        // Emojis are typically in Unicode ranges: 0x1F000-0x1FFFF
        const codePoint = firstEmoji.codePointAt(0);
        if (codePoint >= 0x1F000 && codePoint <= 0x1FFFF) {
            return firstEmoji;
        }
        
        // Allow common emoji ranges
        if (codePoint >= 0x2600 && codePoint <= 0x26FF) {
            return firstEmoji;
        }
        
        // Default fallback
        return '🚀';
    },

    /**
     * Validate GitHub token format
     */
    isValidGitHubToken(token) {
        if (typeof token !== 'string') return false;
        
        // Classic tokens start with ghp_
        // Fine-grained tokens start with github_pat_
        return (
            (token.startsWith('ghp_') && token.length >= 40) ||
            (token.startsWith('github_pat_') && token.length >= 82)
        );
    },

    /**
     * Create safe HTML structure without v-html
     * Returns object that can be rendered safely
     */
    createSafeStatusMessage(type, content) {
        // Create structured content that Vue can render safely
        return {
            type,
            lines: content.lines || [],
            list: content.list || [],
            link: content.link ? {
                text: this.escapeHtml(content.link.text),
                url: this.isValidUrl(content.link.url) ? content.link.url : '#'
            } : null
        };
    }
};

// ============================================
// Storage Utilities with Error Handling
// ============================================

const StorageUtils = {
    /**
     * Safely get item from localStorage
     */
    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? item : defaultValue;
        } catch (error) {
            console.error(`Failed to get ${key} from localStorage:`, error);
            return defaultValue;
        }
    },

    /**
     * Safely set item to localStorage with quota handling
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                
                // Try to free up space by removing old items
                try {
                    // Remove oldest presets if quota exceeded
                    const presets = this.getJSON('perf_runner_presets', []);
                    if (presets.length > 5) {
                        // Keep only 5 most recent
                        const trimmed = presets.slice(-5);
                        localStorage.setItem('perf_runner_presets', JSON.stringify(trimmed));
                        
                        // Try again
                        localStorage.setItem(key, value);
                        return true;
                    }
                } catch (retryError) {
                    console.error('Failed to free up space:', retryError);
                }
                
                throw new Error('Storage quota exceeded. Please delete some presets.');
            }
            
            console.error(`Failed to set ${key} in localStorage:`, error);
            throw error;
        }
    },

    /**
     * Safely get JSON from localStorage
     */
    getJSON(key, defaultValue = null) {
        try {
            const item = this.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Failed to parse JSON from ${key}:`, error);
            return defaultValue;
        }
    },

    /**
     * Safely set JSON to localStorage
     */
    setJSON(key, value) {
        try {
            const json = JSON.stringify(value);
            return this.setItem(key, json);
        } catch (error) {
            console.error(`Failed to stringify JSON for ${key}:`, error);
            throw error;
        }
    },

    /**
     * Remove item from localStorage
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove ${key} from localStorage:`, error);
            return false;
        }
    }
};

// ============================================
// Vue Application
// ============================================

createApp({
    // ============================================
    // Data - Reactive State
    // ============================================
    data() {
        return {
            // App configuration
            config: window.CONFIG,
            version: window.CONFIG.VERSION,

            // Test configuration (loaded from config.json)
            testConfig: null,
            configLoading: true,
            configError: null,

            // User selections
            selection: {
                loadType: '',
                environment: '',
                targetUrl: '',
                scenario: ''
            },

            // Dynamic field data
            loadData: {},
            scenarioData: {},

            // Generated field definitions
            loadConfigFields: [],
            scenarioConfigFields: [],

            // Validation
            validationErrors: {
                load: [],
                scenario: []
            },

            // Output format
            outputFormat: window.CONFIG.DEFAULT_OUTPUT_FORMAT || 'json',

            // Presets
            builtInPresets: [],
            userPresets: [],
            activePreset: null,
            manualConfigExpanded: true,

            // Save preset modal
            savePresetModal: {
                visible: false,
                name: '',
                description: '',
                icon: '🚀'
            },

            // UI state
            isSubmitting: false,
            copyButtonText: '📋',

            // SPA Navigation
            activeSection: 'run',
            isScrolled: false,
            scrollProgress: 0,

            // Status display - CHANGED to safe structure
            status: {
                visible: false,
                type: 'info',
                title: '',
                lines: [],
                list: [],
                link: null
            },

            // Modal state
            modal: {
                visible: false,
                tokenInput: ''
            },

            // Token status
            hasToken: false,

            // Loading states to prevent race conditions
            loadTypeChanging: false,
            scenarioChanging: false,

            // Abort controller for fetch requests
            abortController: null,

            // Debounced validation function (will be created in created hook)
            debouncedValidateLoadConfig: null,

            // UI cleanup function 
            uiCleanup: null


        };
    },

    // ============================================
    // Computed Properties
    // ============================================
    computed: {
        selectedLoadConfig() {
            if (!this.selection.loadType || !this.testConfig) return null;
            return this.testConfig.loadConfig[this.selection.loadType];
        },

        selectedEnvironment() {
            if (!this.selection.environment || !this.testConfig) return null;
            return this.testConfig.environment[this.selection.environment];
        },

        selectedScenario() {
            if (!this.selection.scenario || !this.testConfig) return null;
            return this.testConfig.scenarioConfig[this.selection.scenario];
        },

        selectedScenarioFields() {
            if (!this.selectedScenario) return null;
            return this.selectedScenario.fields;
        },

        availableUrls() {
            if (!this.selectedEnvironment) return [];
            return this.selectedEnvironment.urls || [];
        },

        isFormValid() {
            return this.selection.loadType &&
                this.selection.environment &&
                this.selection.targetUrl &&
                this.selection.scenario &&
                !this.hasValidationErrors;
        },

        hasValidationErrors() {
            return this.validationErrors.load.length > 0 ||
                this.validationErrors.scenario.length > 0;
        },

        currentConfig() {
            return {
                loadType: this.selection.loadType,
                loadConfig: { ...this.loadData },
                environment: this.selection.environment,
                target_url: this.selection.targetUrl,
                scenario: this.selection.scenario,
                scenarioFields: { ...this.scenarioData },
                timestamp: new Date().toISOString()
            };
        },

        formattedOutput() {
            if (!this.isFormValid) {
                return 'Select all required options to generate configuration...';
            }

            if (this.outputFormat === 'env') {
                return this.generateEnvFormat();
            } else {
                return this.generateJsonFormat();
            }
        }
    },

    // ============================================
    // Watchers - React to Data Changes
    // ============================================
    watch: {
        'selection.loadType'(newType) {
            if (!newType || !this.testConfig || this.loadTypeChanging) return;
            
            this.loadTypeChanging = true;
            
            try {
                console.log('Load type changed to:', newType);

                if (this.manualConfigExpanded) {
                    this.activePreset = null;
                }

                const config = this.testConfig.loadConfig[newType];
                const { label, description, ...fieldValues } = config;

                this.loadData = { ...fieldValues };
                this.loadConfigFields = this.generateFields(
                    fieldValues,
                    this.testConfig.fieldMetadata
                );

                this.validateLoadConfig();
            } finally {
                // Use nextTick to prevent race conditions
                this.$nextTick(() => {
                    this.loadTypeChanging = false;
                });
            }
        },

        'selection.environment'(newEnv) {
            console.log('Environment changed to:', newEnv);
            this.selection.targetUrl = '';

            if (this.availableUrls.length === 1) {
                this.selection.targetUrl = this.availableUrls[0];
            }
        },

        'selection.scenario'(newScenario) {
            if (!newScenario || !this.testConfig || this.scenarioChanging) return;
            
            this.scenarioChanging = true;
            
            try {
                console.log('Scenario changed to:', newScenario);

                const fields = this.testConfig.scenarioConfig[newScenario].fields;
                this.scenarioData = { ...fields };
                this.scenarioConfigFields = this.generateFields(
                    fields,
                    this.testConfig.fieldMetadata
                );
            } finally {
                this.$nextTick(() => {
                    this.scenarioChanging = false;
                });
            }
        },

        loadData: {
            handler(newVal, oldVal) {
                // Call debounced validation
                this.debouncedValidateLoadConfig();
            },
            deep: true
        }
    },

    // ============================================
    // Lifecycle Hooks
    // ============================================

    created() {
        // Create debounced validation function using UIService
        this.debouncedValidateLoadConfig = UIService.debounce(() => {
            this.validateLoadConfig();
        }, 300);
    },
    
    async mounted() {
        console.log('🚀 Performance Test Runner v0.8.0 - Security Hardened');

        // Initialize
        await this.loadConfiguration();

        if (this.testConfig) {
            this.initializePresets();
        }

        this.checkToken();

        // Initialize UI Service with event handlers
        this.uiCleanup = UIService.initialize({
            context: this,
            onScroll: this.handleScroll,
            onKeyboard: this.handleKeyboard
        });

        // Trigger initial scroll handler
        this.handleScroll();

        // Make available for debugging
        window.vueApp = this;
        
        console.log('✅ Application initialized');
    },

    beforeUnmount() {
        // Cleanup UI listeners
        if (this.uiCleanup) {
            this.uiCleanup();
        }
        
        // Abort any pending requests
        if (this.abortController) {
            this.abortController.abort();
        }
        
        console.log('🧹 Cleanup completed');
    },

    // ============================================
    // Methods
    // ============================================
    methods: {
        /**
         * Handle keyboard shortcuts
         */
        handleKeyboard(e) {
            UIService.handleKeyboardShortcut(e, {
                onSubmit: () => {
                    if (this.isFormValid && !this.isSubmitting) {
                        this.handleSubmit();
                    }
                },
                onSavePreset: () => {
                    if (this.isFormValid) {
                        this.openSavePresetModal();
                    }
                },
                onEscape: () => {
                    if (this.modal.visible) {
                        this.closeModal();
                    }
                    if (this.savePresetModal.visible) {
                        this.closeSavePresetModal();
                    }
                }
            });
        },

        /**
         * Scroll to section
         */
        scrollToSection(sectionName) {
            UIService.scrollToSection(sectionName);
        },

        /**
         * Handle scroll events
         */
        handleScroll() {
            // Get scroll data
            const scrollData = UIService.getScrollData();
            this.isScrolled = scrollData.isScrolled;
            this.scrollProgress = scrollData.progress;

            // Detect active section
            const sections = ['run', 'history', 'ai'];
            const activeSection = UIService.detectActiveSection(sections, 150);
            if (activeSection) {
                this.activeSection = activeSection;
            }
        },

        /**
         * Open settings modal (placeholder)
         */
        openSettingsModal() {
            this.showSafeStatus('info', {
                lines: ['Settings feature coming soon!']
            });
        },

        /**
         * Open help modal (placeholder)
         */
        openHelpModal() {
            this.showSafeStatus('info', {
                lines: ['Help feature coming soon!', 'For now, hover over field labels for tooltips.']
            });
        },

        /**
         * Load configuration from config.json
         */
        async loadConfiguration() {
            this.configLoading = true;
            this.configError = null;

            // Cancel previous request if any
            if (this.abortController) {
                this.abortController.abort();
            }

            this.abortController = new AbortController();

            try {
                console.log('📥 Loading configuration from config.json...');

                const response = await fetch('config.json', {
                    signal: this.abortController.signal,
                    cache: 'no-cache'
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const config = await response.json();

                // Validate configuration structure
                if (!config.loadConfig || !config.environment || !config.scenarioConfig) {
                    throw new Error('Invalid configuration structure');
                }

                this.testConfig = config;
                console.log('✅ Configuration loaded successfully');

            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('⚠️ Configuration load aborted');
                    return;
                }
                
                console.error('❌ Failed to load configuration:', error);
                this.configError = error.message;
            } finally {
                this.configLoading = false;
                this.abortController = null;
            }
        },

        /**
         * Initialize built-in presets
         */
        initializePresets() {
            const presets = PresetService.initialize();
            this.builtInPresets = presets.builtInPresets;
            this.userPresets = presets.userPresets;
        },

        /**
         * Load user presets from localStorage
         */
        loadUserPresets() {
            this.userPresets = PresetService.loadUserPresets();
        },
        
        /**
         * Save user presets to localStorage
         */
        saveUserPresets() {
            try {
                PresetService.saveUserPresets(this.userPresets);
                return true;
            } catch (error) {
                console.error('Failed to save user presets:', error);
                this.showSafeStatus('error', {
                    lines: [
                        'Failed to save preset',
                        error.message
                    ]
                });
                return false;
            }
        },

        /**
         * Load a preset configuration
         */
        loadPreset(preset) {
            console.log('📂 Loading preset:', preset.name);

            const config = preset.config;

            if (config.selections) {
                this.selection.loadType = config.selections.loadType || '';
                this.selection.environment = config.selections.environment || '';
                this.selection.scenario = config.selections.scenario || '';

                this.$nextTick(() => {
                    if (config.selections.targetUrl) {
                        this.selection.targetUrl = config.selections.targetUrl;
                    } else if (this.availableUrls.length > 0) {
                        this.selection.targetUrl = this.availableUrls[0];
                    }
                });
            }

            if (config.loadData) {
                this.$nextTick(() => {
                    Object.assign(this.loadData, config.loadData);
                });
            }

            if (config.scenarioData) {
                this.$nextTick(() => {
                    Object.assign(this.scenarioData, config.scenarioData);
                });
            }

            this.activePreset = preset.id;
            this.manualConfigExpanded = false;

            this.showSafeStatus('success', {
                lines: [`Loaded preset: ${SecurityUtils.escapeHtml(preset.name)}`]
            });
        },

        /**
         * Open save preset modal
         */
        openSavePresetModal() {
            this.savePresetModal.visible = true;
            this.savePresetModal.name = '';
            this.savePresetModal.description = '';
            this.savePresetModal.icon = '🚀';

            this.$nextTick(() => {
                UIService.focusElement('preset-name');
            });
        },

        /**
         * Close save preset modal
         */
        closeSavePresetModal() {
            this.savePresetModal.visible = false;
        },

        /**
         * Save current configuration as preset
         */
        savePreset() {
            const name = this.savePresetModal.name;
            const description = this.savePresetModal.description;
            const icon = this.savePresetModal.icon;

            if (!name || !name.trim()) {
                alert('Please enter a preset name');
                return;
            }

            // Check if name already exists
            if (this.userPresets.some(p => p.name.trim() === name.trim())) {
                if (!confirm(`A preset named "${name}" already exists. Overwrite it?`)) {
                    return;
                }
            }

            // Create preset using service
            const config = {
                selections: {
                    loadType: this.selection.loadType,
                    environment: this.selection.environment,
                    targetUrl: this.selection.targetUrl,
                    scenario: this.selection.scenario
                },
                loadData: { ...this.loadData },
                scenarioData: { ...this.scenarioData }
            };

            try {
                const newPreset = PresetService.createPreset(name, description, icon, config);
                const result = PresetService.addPreset(this.userPresets, newPreset);

                if (result.success) {
                    this.userPresets = result.presets;
                    this.activePreset = newPreset.id;
                    this.closeSavePresetModal();

                    this.showSafeStatus('success', {
                        lines: [`Preset "${SecurityUtils.escapeHtml(name)}" saved successfully!`]
                    });
                } else {
                    alert(result.error || 'Failed to save preset');
                }

            } catch (error) {
                console.error('Failed to save preset:', error);
                alert(error.message || 'Failed to save preset');
            }
        },

        /**
         * Delete a user preset
         */
        deletePreset(presetId) {
            const preset = this.userPresets.find(p => p.id === presetId);

            if (!preset) return;

            if (!confirm(`Delete preset "${preset.name}"?`)) {
                return;
            }

            const result = PresetService.deletePreset(this.userPresets, presetId);

            if (result.success) {
                this.userPresets = result.presets;

                if (this.activePreset === presetId) {
                    this.activePreset = null;
                }

                this.showSafeStatus('info', {
                    lines: [`Preset "${SecurityUtils.escapeHtml(result.deletedPreset.name)}" deleted`]
                });
            } else {
                alert(result.error || 'Failed to delete preset');
            }
        },

        /**
         * Generate field definitions from config object
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
         * Generate JSON format output
         */
                /**
         * Generate JSON format output
         */
        generateJsonFormat() {
            return FormatUtils.toJSON(this.currentConfig);
        },

        /**
         * Generate ENV format output
         */
        generateEnvFormat() {
            return FormatUtils.toENV(this.currentConfig);
        },

        /**
         * Copy output to clipboard
         */
        async copyOutput() {
            const success = await UIService.copyToClipboard(this.formattedOutput);

            if (success) {
                UIService.showTemporaryFeedback(this, 'copyButtonText', '✅', '📋', 2000);
                console.log(`✅ ${this.outputFormat.toUpperCase()} copied to clipboard`);
            } else {
                this.showSafeStatus('error', {
                    lines: ['Failed to copy to clipboard']
                });
            }
        },

        detectFieldType(value, metadata) {
            if (metadata.type) return metadata.type.toLowerCase();

            const valueType = typeof value;

            if (valueType === 'boolean') return 'boolean';
            if (valueType === 'number') return 'number';
            if (valueType === 'string') return 'text';

            if (Array.isArray(value)) {
                console.warn('Array type detected, defaulting to text:', value);
                return 'text';
            }

            console.warn('Unknown type, defaulting to text:', valueType, value);
            return 'text';
        },

        formatLabel(fieldName) {
            return fieldName
                .replace(/([A-Z])/g, ' $1')
                .replace(/_/g, ' ')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        },

        getMinValue(fieldName, metadata) {
            if (metadata.min !== undefined) return metadata.min;
            if (fieldName === 'users') return 1;
            if (fieldName.includes('duration') || fieldName.includes('Duration')) return 0;
            if (fieldName.includes('ramp') || fieldName.includes('Ramp')) return 0;
            return undefined;
        },

        /**
         * Validate load configuration
         */
        validateLoadConfig() {
            this.validationErrors.load = ValidationUtils.validateLoadConfig(this.loadData);
        },

        /**
         * Handle form submission
         */
        handleSubmit() {
            console.log('📊 Form submitted');

            if (!this.isFormValid) {
                this.showSafeStatus('error', {
                    lines: ['Please select all required options and fix validation errors']
                });
                return;
            }

            if (!this.hasToken) {
                this.openModal();
                return;
            }

            this.triggerTest();
        },

        /**
         * Trigger GitHub Actions workflow
         */
        async triggerTest() {
            this.showSafeStatus('info', {
                lines: ['Triggering GitHub Actions workflow...']
            });
            
            this.isSubmitting = true;

            try {
                const token = StorageUtils.getItem(this.config.TOKEN_STORAGE_KEY);
                
                // Use GitHubAPI module
                const result = await GitHubAPI.triggerWorkflow(
                    this.currentConfig,
                    token,
                    this.config.API_CONFIG,
                    this.outputFormat
                );

                if (result.success) {
                    this.handleSuccess(result);
                } else {
                    this.handleError(result);
                }

            } catch (error) {
                console.error('❌ Unexpected error:', error);
                this.handleError({ message: error.message });
            } finally {
                this.isSubmitting = false;
            }
        },

        /**
         * Handle successful workflow trigger
         */
        handleSuccess(result) {
            const lines = [
                'Performance test triggered successfully!',
                '',
                'Configuration:'
            ];

            const list = [
                `Load Type: ${result.data.loadType}`,
                `Users: ${result.data.users}`,
                `Duration: ${result.data.duration}s`,
                `Environment: ${result.data.environment}`,
                `Target: ${result.data.targetUrl}`,
                `Scenario: ${result.data.scenario}`
            ];

            this.showSafeStatus('success', {
                lines,
                list,
                link: result.link
            });

            console.log('✅ Workflow triggered successfully');
        },

        /**
         * Handle errors
         */
        handleError(result) {
            const lines = ['Failed to trigger workflow', ''];
            const list = [];

            const errorMessage = result.message || 'Unknown error';

            if (errorMessage.includes('token')) {
                lines.push('Token Issue:');
                lines.push(errorMessage);
                lines.push('');
                lines.push('Try:');
                list.push('Clear your token and set a new one');
                list.push('Ensure token has "repo" and "workflow" scopes');
            } else if (errorMessage.includes('not found')) {
                lines.push('Repository/Workflow Issue:');
                lines.push(errorMessage);
                lines.push('');
                lines.push('Check:');
                list.push(`Repository: ${this.config.REPO_OWNER}/${this.config.REPO_NAME}`);
                list.push(`Workflow file: .github/workflows/${this.config.WORKFLOW_FILE}`);
            } else {
                lines.push(errorMessage);
            }

            this.showSafeStatus('error', { lines, list });
        },

        /**
         * Show status message - SAFE VERSION
         */
        showSafeStatus(type, content) {
            this.status.visible = true;
            this.status.type = type;
            this.status.title = content.title || '';
            this.status.lines = content.lines || [];
            this.status.list = content.list || [];
            this.status.link = content.link || null;

            this.$nextTick(() => {
                UIService.scrollToElement('.status-card', { block: 'nearest' });
            });
        },

        /**
         * Hide status message
         */
        hideStatus() {
            this.status.visible = false;
        },

        /**
         * Check if token exists
         */
        checkToken() {
            const token = StorageUtils.getItem(this.config.TOKEN_STORAGE_KEY);
            this.hasToken = !!token && SecurityUtils.isValidGitHubToken(token);

            if (this.hasToken) {
                console.log('✅ Valid GitHub token found');
            } else {
                console.log('⚠️ No valid GitHub token found');
            }
        },

        /**
         * Open token modal
         */
        openModal() {
            this.modal.visible = true;
            this.$nextTick(() => {
                UIService.focusElement('github-token');
            });
        },

        /**
         * Close token modal
         */
        closeModal() {
            this.modal.visible = false;
            this.modal.tokenInput = '';
        },

        /**
         * Save GitHub token
         */
        saveToken() {
            const token = this.modal.tokenInput.trim();

            if (!token) {
                alert('Please enter a valid token');
                return;
            }

            if (!SecurityUtils.isValidGitHubToken(token)) {
                const confirmed = confirm('Token format looks unusual. Are you sure this is a valid GitHub token?');
                if (!confirmed) return;
            }

            try {
                StorageUtils.setItem(this.config.TOKEN_STORAGE_KEY, token);
                this.hasToken = true;
                this.closeModal();
                
                this.showSafeStatus('success', {
                    lines: ['Token saved successfully! You can now trigger tests.']
                });
            } catch (error) {
                alert(`Failed to save token: ${error.message}`);
            }
        }
    }
}).mount('#app');

// ============================================
// Console Utilities
// ============================================
console.log('💡 Vue app available via: window.vueApp');
console.log('💡 Security utilities: SecurityUtils');
console.log('💡 Storage utilities: StorageUtils');