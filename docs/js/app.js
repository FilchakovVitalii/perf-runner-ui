/**
 * Performance Test Runner - Vue.js Application
 * Step 7: Dynamic form field generation with validation
 */

const { createApp } = Vue;

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

            // UI state
            isSubmitting: false,
            copyButtonText: '📋',

            // Status display
            status: {
                visible: false,
                type: 'info',
                message: ''
            },

            // Modal state
            modal: {
                visible: false,
                tokenInput: ''
            },

            // Token status
            hasToken: false
        };
    },

    // ============================================
    // Computed Properties
    // ============================================
    computed: {
        /**
         * Get selected load configuration
         */
        selectedLoadConfig() {
            if (!this.selection.loadType || !this.testConfig) return null;
            return this.testConfig.loadConfig[this.selection.loadType];
        },

        /**
         * Get selected environment configuration
         */
        selectedEnvironment() {
            if (!this.selection.environment || !this.testConfig) return null;
            return this.testConfig.environment[this.selection.environment];
        },

        /**
         * Get selected scenario configuration
         */
        selectedScenario() {
            if (!this.selection.scenario || !this.testConfig) return null;
            return this.testConfig.scenarioConfig[this.selection.scenario];
        },

        /**
         * Get scenario fields
         */
        selectedScenarioFields() {
            if (!this.selectedScenario) return null;
            return this.selectedScenario.fields;
        },

        /**
         * Get available URLs based on selected environment
         */
        availableUrls() {
            if (!this.selectedEnvironment) return [];
            return this.selectedEnvironment.urls || [];
        },

        /**
         * Check if form is valid
         */
        isFormValid() {
            return this.selection.loadType &&
                this.selection.environment &&
                this.selection.targetUrl &&
                this.selection.scenario;
        },

        /**
         * Check if there are validation errors
         */
        hasValidationErrors() {
            return this.validationErrors.load.length > 0 ||
                this.validationErrors.scenario.length > 0;
        },

        /**
         * Generate formatted JSON configuration
         */
        formattedConfig() {
            if (!this.isFormValid) {
                return 'Select all required options to generate configuration...';
            }

            const config = this.currentConfig;
            return JSON.stringify(config, null, 2);
        },

        /**
         * Get current configuration as object
         */
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
        }
    },

    // ============================================
    // Watchers - React to Data Changes
    // ============================================
    watch: {
        /**
         * Watch load type changes
         */
        'selection.loadType'(newType) {
            if (!newType || !this.testConfig) return;

            console.log('Load type changed to:', newType);

            const config = this.testConfig.loadConfig[newType];

            // Extract field values (exclude label, description)
            const { label, description, ...fieldValues } = config;

            // Clone values to loadData
            this.loadData = { ...fieldValues };

            // Generate field definitions
            this.loadConfigFields = this.generateFields(
                fieldValues,
                this.testConfig.fieldMetadata
            );

            console.log('Generated fields:', this.loadConfigFields);
            console.log('Load data:', this.loadData);

            // Validate
            this.validateLoadConfig();
        },

        /**
         * Watch environment changes
         */
        'selection.environment'(newEnv) {
            console.log('Environment changed to:', newEnv);

            // Reset URL when environment changes
            this.selection.targetUrl = '';

            // Auto-select first URL if only one available
            if (this.availableUrls.length === 1) {
                this.selection.targetUrl = this.availableUrls[0];
            }
        },

        /**
         * Watch scenario changes
         */
        'selection.scenario'(newScenario) {
            if (!newScenario || !this.testConfig) return;

            console.log('Scenario changed to:', newScenario);

            const fields = this.testConfig.scenarioConfig[newScenario].fields;

            // Clone values to scenarioData
            this.scenarioData = { ...fields };

            // Generate field definitions
            this.scenarioConfigFields = this.generateFields(
                fields,
                this.testConfig.fieldMetadata
            );

            console.log('Scenario fields:', this.scenarioConfigFields);
            console.log('Scenario data:', this.scenarioData);
        },

        /**
         * Watch loadData changes for validation
         */
        loadData: {
            handler() {
                this.validateLoadConfig();
            },
            deep: true
        }
    },

    // ============================================
    // Lifecycle Hooks
    // ============================================
    async mounted() {
        console.log('🚀 Performance Test Runner (Vue.js) initialized');
        console.log('📝 Configuration:', this.config);

        // Load test configuration
        await this.loadConfiguration();

        // Check for existing token
        this.checkToken();

        // Make available in console for debugging
        window.vueApp = this;
    },

    // ============================================
    // Methods
    // ============================================
    methods: {
        /**
         * Load configuration from config.json
         */
        async loadConfiguration() {
            this.configLoading = true;
            this.configError = null;

            try {
                console.log('📥 Loading configuration from config.json...');

                const response = await fetch('config.json');

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
                console.error('❌ Failed to load configuration:', error);
                this.configError = error.message;
            } finally {
                this.configLoading = false;
            }
        },

        /**
         * Generate field definitions from config object
         */
        generateFields(configObject, metadataSource) {
            return Object.entries(configObject).map(([key, value]) => {
                const metadata = metadataSource[key] || {};

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
         * Detect field type from value
         * Priority: 1) metadata.type override, 2) auto-detect from value
         */
        detectFieldType(value, metadata) {
            // Allow metadata to override for edge cases (select, textarea, url, etc.)
            if (metadata.type) {
                const type = metadata.type.toLowerCase();
                console.log(`Using metadata type override: ${type} for value:`, value);
                return type;
            }

            // Auto-detect from value type
            const valueType = typeof value;

            if (valueType === 'boolean') {
                return 'boolean';
            }

            if (valueType === 'number') {
                return 'number';
            }

            if (valueType === 'string') {
                // Future: could detect special formats here
                // if (value.startsWith('http')) return 'url';
                // if (value.includes('@')) return 'email';
                return 'text';
            }

            // Future: handle arrays, objects, etc.
            if (Array.isArray(value)) {
                console.warn('Array type detected, defaulting to text:', value);
                return 'text';
            }

            // Fallback
            console.warn('Unknown type, defaulting to text:', valueType, value);
            return 'text';
        },

        /**
         * Format field name to readable label
         */
        formatLabel(fieldName) {
            return fieldName
                .replace(/([A-Z])/g, ' $1') // Add space before capitals
                .replace(/_/g, ' ')          // Replace underscores with spaces
                .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
                .trim();
        },

        /**
         * Get minimum value for validation
         */
        getMinValue(fieldName, metadata) {
            if (fieldName === 'users') return 1;
            if (fieldName.includes('duration') || fieldName.includes('Duration')) return 0;
            if (fieldName.includes('ramp') || fieldName.includes('Ramp')) return 0;
            return undefined;
        },

        /**
         * Validate load configuration
         */
        validateLoadConfig() {
            const errors = [];

            // Validate users >= 1
            if (this.loadData.users !== undefined && this.loadData.users < 1) {
                errors.push('Users must be at least 1');
            }

            // Validate duration >= 0
            if (this.loadData.duration !== undefined && this.loadData.duration < 0) {
                errors.push('Duration cannot be negative');
            }

            // Validate duration >= rampUp
            if (this.loadData.duration !== undefined &&
                this.loadData.rampUp !== undefined &&
                this.loadData.duration < this.loadData.rampUp) {
                errors.push('Duration must be greater than or equal to Ramp-Up time');
            }

            // Validate minPause <= maxPause
            if (this.loadData.minPause !== undefined &&
                this.loadData.maxPause !== undefined &&
                this.loadData.minPause > this.loadData.maxPause) {
                errors.push('Min Pause cannot be greater than Max Pause');
            }

            this.validationErrors.load = errors;

            if (errors.length > 0) {
                console.log('⚠️ Validation errors:', errors);
            }
        },

        /**
         * Handle form submission
         */
        handleSubmit() {
            console.log('📊 Form submitted');

            if (!this.isFormValid) {
                this.showStatus('Please select all required options', 'error');
                return;
            }

            if (this.hasValidationErrors) {
                this.showStatus('Please fix validation errors before submitting', 'error');
                return;
            }

            // Check if token exists
            if (!this.hasToken) {
                this.openModal();
                return;
            }

            // Trigger test
            this.triggerTest();
        },

        /**
         * Trigger GitHub Actions workflow
         */
        async triggerTest() {
            this.showStatus('⏳ Triggering GitHub Actions workflow...', 'info');
            this.isSubmitting = true;

            const config = this.currentConfig;
            console.log('📊 Test configuration:', config);

            try {
                const token = localStorage.getItem(this.config.TOKEN_STORAGE_KEY);

                if (!token) {
                    throw new Error('GitHub token not found');
                }

                // Construct API URL
                const apiUrl = `${this.config.API_BASE}/repos/${this.config.REPO_OWNER}/${this.config.REPO_NAME}/actions/workflows/${this.config.WORKFLOW_FILE}/dispatches`;

                console.log('🔗 API URL:', apiUrl);

                // Prepare payload
                const payload = {
                    ref: this.config.BRANCH,
                    inputs: {
                        config: JSON.stringify(config)
                    }
                };

                console.log('📤 Sending payload:', payload);

                // Make API request
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                console.log('📥 Response status:', response.status);

                // Handle response
                if (response.status === 204) {
                    this.handleSuccess(config);
                } else if (response.status === 404) {
                    throw new Error('Workflow not found. Check repository and workflow file name.');
                } else if (response.status === 401) {
                    throw new Error('Authentication failed. Please check your GitHub token.');
                } else if (response.status === 403) {
                    throw new Error('Permission denied. Token may lack required scopes (repo, workflow).');
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || `API request failed with status ${response.status}`);
                }

            } catch (error) {
                console.error('❌ Error:', error);
                this.handleError(error);
            } finally {
                this.isSubmitting = false;
            }
        },

        /**
         * Handle successful workflow trigger
         */
        handleSuccess(config) {
            const repoUrl = `https://github.com/${this.config.REPO_OWNER}/${this.config.REPO_NAME}`;
            const actionsUrl = `${repoUrl}/actions/workflows/${this.config.WORKFLOW_FILE}`;

            const message = `
                <div>
                    <p><strong>✅ Performance test triggered successfully!</strong></p>
                    <br>
                    <p><strong>📊 Configuration:</strong></p>
                    <ul>
                        <li>Load Type: <code>${config.loadType}</code></li>
                        <li>Users: ${config.loadConfig.users}</li>
                        <li>Duration: ${config.loadConfig.duration}s</li>
                        <li>Environment: <code>${config.environment}</code></li>
                        <li>Target: <code>${this.escapeHtml(config.target_url)}</code></li>
                        <li>Scenario: <code>${config.scenario}</code></li>
                    </ul>
                    <br>
                    <p>⏱️ The workflow is now running...</p>
                    <br>
                    <p>
                        <a href="${actionsUrl}" target="_blank" rel="noopener" class="status-link">
                            🔗 View Workflow Progress →
                        </a>
                    </p>
                </div>
            `;

            this.showStatus(message, 'success');
            console.log('✅ Workflow triggered successfully');
        },

        /**
         * Handle errors
         */
        handleError(error) {
            let errorMessage = '<p><strong>❌ Failed to trigger workflow</strong></p><br>';

            if (error.message.includes('token')) {
                errorMessage += `
                    <p>🔑 <strong>Token Issue:</strong></p>
                    <p>${error.message}</p>
                    <br>
                    <p>💡 <strong>Try:</strong></p>
                    <ul>
                        <li>Clear your token and set a new one</li>
                        <li>Ensure token has "repo" and "workflow" scopes</li>
                    </ul>
                `;
            } else if (error.message.includes('not found')) {
                errorMessage += `
                    <p>📁 <strong>Repository/Workflow Issue:</strong></p>
                    <p>${error.message}</p>
                    <br>
                    <p>💡 <strong>Check:</strong></p>
                    <ul>
                        <li>Repository: ${this.config.REPO_OWNER}/${this.config.REPO_NAME}</li>
                        <li>Workflow file: .github/workflows/${this.config.WORKFLOW_FILE}</li>
                        <li>Repository is accessible with your token</li>
                    </ul>
                `;
            } else {
                errorMessage += `<p>${error.message}</p>`;
            }

            this.showStatus(errorMessage, 'error');
        },

        /**
         * Copy JSON to clipboard
         */
        async copyJSON() {
            try {
                await navigator.clipboard.writeText(this.formattedConfig);
                this.copyButtonText = '✅';

                setTimeout(() => {
                    this.copyButtonText = '📋';
                }, 2000);
            } catch (err) {
                console.error('Copy failed:', err);
                this.showStatus('Failed to copy to clipboard', 'error');
            }
        },

        /**
         * Show status message
         */
        showStatus(message, type = 'info') {
            this.status.visible = true;
            this.status.type = type;
            this.status.message = message;

            this.$nextTick(() => {
                const statusEl = document.querySelector('.status-section');
                if (statusEl) {
                    statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
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
            const token = localStorage.getItem(this.config.TOKEN_STORAGE_KEY);
            this.hasToken = !!token;

            if (this.hasToken) {
                console.log('✅ GitHub token found');
            } else {
                console.log('⚠️  No GitHub token found');
            }
        },

        /**
         * Open token modal
         */
        openModal() {
            this.modal.visible = true;
            this.$nextTick(() => {
                document.getElementById('github-token')?.focus();
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

            if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
                const confirmed = confirm('Token format looks unusual. Are you sure this is correct?');
                if (!confirmed) return;
            }

            localStorage.setItem(this.config.TOKEN_STORAGE_KEY, token);
            this.hasToken = true;

            this.closeModal();
            this.showStatus('✅ Token saved successfully! You can now trigger tests.', 'success');

            console.log('✅ Token saved');
        },

        /**
         * Escape HTML to prevent XSS
         */
        escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }
    }
}).mount('#app');

// ============================================
// Console Utilities
// ============================================
console.log('💡 Vue app available via: window.vueApp');
console.log('💡 Try: vueApp.loadData, vueApp.scenarioData, vueApp.validateLoadConfig()');