/**
 * Performance Test Runner - Vue.js Application
 * v0.9.0 - HOCON-compatible configuration support
 */

const { createApp } = Vue;

createApp({
    // ============================================
    // Error Handler
    // ============================================
    errorCaptured(err, instance, info) {
        console.error('Vue Error:', err);
        console.error('Component:', instance);
        console.error('Info:', info);
        
        this.showSafeStatus('error', {
            lines: [
                'An unexpected error occurred',
                err.message
            ]
        });
        
        // Prevent error from propagating
        return false;
    },

    // ============================================
    // Data - Reactive State
    // ============================================
    data() {
        return {
            // App configuration
            config: window.CONFIG,
            version: '0.9.0',

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

            // Output format - support HOCON now
            outputFormat: window.CONFIG.app.defaultOutputFormat || 'json',

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

            // Status display
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

            // Debounced validation function
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

        /**
         * Split load fields into standard and warmup groups
         */
        standardLoadFields() {
            return this.loadConfigFields.filter(field => 
                !field.name.toLowerCase().includes('warmup')
            );
        },

        warmupFields() {
            return this.loadConfigFields.filter(field => 
                field.name.toLowerCase().includes('warmup')
            );
        },

        /**
         * Current configuration in new canonical format
         */
        currentCanonicalConfig() {
            if (!this.isFormValid) return null;

            return CanonicalMapper.toCanonical(
                {
                    loadType: this.selection.loadType,
                    environment: this.selection.environment,
                    targetUrl: this.selection.targetUrl,
                    scenario: this.selection.scenario
                },
                this.loadData,
                this.scenarioData,
                this.testConfig
            );
        },

        /**
         * Legacy config format (for backward compatibility)
         */
        currentLegacyConfig() {
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

        /**
         * Formatted output based on selected format
         */
        formattedOutput() {
            if (!this.isFormValid) {
                return 'Select all required options to generate configuration...';
            }

            switch (this.outputFormat) {
                case 'json':
                    return this.generateCanonicalJSON();
                
                case 'env':
                    return this.generateCanonicalENV();
                
                case 'hocon':
                    return this.generateHOCON();
                
                default:
                    return 'Unknown format';
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
                this.debouncedValidateLoadConfig();
            },
            deep: true
        }
    },

    // ============================================
    // Lifecycle Hooks
    // ============================================
    created() {
        this.debouncedValidateLoadConfig = UIService.debounce(() => {
            this.validateLoadConfig();
        }, 300);
    },
    
    async mounted() {
        console.log('🚀 Performance Test Runner v0.9.0 - HOCON Support');

        await this.loadConfiguration();

        if (this.testConfig) {
            this.initializePresets();
        }

        this.checkToken();

        this.uiCleanup = UIService.initialize({
            context: this,
            onScroll: this.handleScroll,
            onKeyboard: this.handleKeyboard
        });

        this.handleScroll();

        window.vueApp = this;
        
        console.log('✅ Application initialized');
    },

    beforeUnmount() {
        if (this.uiCleanup) {
            this.uiCleanup();
        }
        
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
            const scrollData = UIService.getScrollData();
            this.isScrolled = scrollData.isScrolled;
            this.scrollProgress = scrollData.progress;

            const sections = ['run', 'history', 'ai'];
            const activeSection = UIService.detectActiveSection(sections, 150);
            if (activeSection) {
                this.activeSection = activeSection;
            }
        },

        /**
         * Open settings modal
         */
        openSettingsModal() {
            this.showSafeStatus('info', {
                lines: ['Settings feature coming soon!']
            });
        },

        /**
         * Open help modal
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

            if (this.userPresets.some(p => p.name.trim() === name.trim())) {
                if (!confirm(`A preset named "${name}" already exists. Overwrite it?`)) {
                    return;
                }
            }

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
            return FieldUtils.generateFields(configObject, metadataSource);
        },

        /**
         * Generate canonical JSON format (NEW - primary payload)
         */
        generateCanonicalJSON() {
            try {
                const canonical = CanonicalMapper.toCanonical(
                    {
                        loadType: this.selection.loadType,
                        environment: this.selection.environment,
                        targetUrl: this.selection.targetUrl,
                        scenario: this.selection.scenario
                    },
                    this.loadData,
                    this.scenarioData,
                    this.testConfig
                );

                return JSON.stringify(canonical, null, 2);
            } catch (error) {
                console.error('Failed to generate canonical JSON:', error);
                return `Error generating JSON: ${error.message}`;
            }
        },

        /**
         * Generate canonical ENV format (NEW - strict encoding)
         */
        generateCanonicalENV() {
            try {
                const canonical = CanonicalMapper.toCanonical(
                    {
                        loadType: this.selection.loadType,
                        environment: this.selection.environment,
                        targetUrl: this.selection.targetUrl,
                        scenario: this.selection.scenario
                    },
                    this.loadData,
                    this.scenarioData,
                    this.testConfig
                );

                return EnvEncoder.encode(canonical);
            } catch (error) {
                console.error('Failed to generate canonical ENV:', error);
                return `Error generating ENV: ${error.message}`;
            }
        },

        /**
         * Generate HOCON format (NEW - preview)
         */
        generateHOCON() {
            try {
                const canonical = CanonicalMapper.toCanonical(
                    {
                        loadType: this.selection.loadType,
                        environment: this.selection.environment,
                        targetUrl: this.selection.targetUrl,
                        scenario: this.selection.scenario
                    },
                    this.loadData,
                    this.scenarioData,
                    this.testConfig
                );

                return HoconFormatter.format(canonical);
            } catch (error) {
                console.error('Failed to generate HOCON:', error);
                return `Error generating HOCON: ${error.message}`;
            }
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
                const token = TokenService.getToken();
                
                // Build canonical configuration
                const canonicalConfig = CanonicalMapper.toCanonical(
                    {
                        loadType: this.selection.loadType,
                        environment: this.selection.environment,
                        targetUrl: this.selection.targetUrl,
                        scenario: this.selection.scenario
                    },
                    this.loadData,
                    this.scenarioData,
                    this.testConfig
                );

                // Validate canonical config
                const validation = CanonicalMapper.validate(canonicalConfig);
                if (!validation.valid) {
                    throw new Error('Configuration validation failed: ' + validation.errors.join(', '));
                }

                // Use GitHubAPI module with canonical config
                const result = await GitHubAPI.triggerWorkflow(
                    canonicalConfig,
                    token,
                    this.config.github,
                    this.outputFormat
                );

                if (result.success) {
                    this.handleSuccess(result, canonicalConfig);
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
        handleSuccess(result, canonicalConfig) {
            const lines = [
                'Performance test triggered successfully!',
                '',
                'Configuration:'
            ];

            const profileKey = canonicalConfig.test.type;
            const profileConfig = canonicalConfig.test.load.profiles[profileKey];

            const list = [
                `Load Type: ${canonicalConfig.test.type}`,
                `Users: ${profileConfig.users}`,
                `Duration: ${profileConfig.duration}`,
                `Environment: ${canonicalConfig.test.environment.type}`,
                `Target: ${canonicalConfig.test.environment.url}`,
                `Scenario: ${canonicalConfig.test.simulation}`
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
            this.hasToken = TokenService.hasValidToken();

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

            const result = TokenService.saveToken(token, { validate: true });

            if (result.success) {
                this.hasToken = true;
                this.closeModal();
                
                this.showSafeStatus('success', {
                    lines: ['Token saved successfully! You can now trigger tests.']
                });
            } else if (result.warning) {
                const confirmed = confirm(
                    `${result.message}\n\nDo you want to save it anyway?`
                );
                
                if (confirmed) {
                    const forceResult = TokenService.saveToken(token, { validate: false, force: true });
                    
                    if (forceResult.success) {
                        this.hasToken = true;
                        this.closeModal();
                        
                        this.showSafeStatus('success', {
                            lines: ['Token saved successfully! You can now trigger tests.']
                        });
                    } else {
                        alert(`Failed to save token: ${forceResult.message}`);
                    }
                }
            } else {
                alert(`Failed to save token: ${result.message}`);
            }
        }
    }
}).mount('#app');

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
    
    if (window.vueApp) {
        window.vueApp.showSafeStatus('error', {
            lines: [
                'An unexpected error occurred',
                'Please refresh the page'
            ]
        });
    }
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    
    if (window.vueApp) {
        window.vueApp.showSafeStatus('error', {
            lines: [
                'An async operation failed',
                event.reason?.message || 'Unknown error'
            ]
        });
    }
});