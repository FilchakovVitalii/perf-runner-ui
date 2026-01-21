/**
 * GitHub API Integration
 * Handles workflow dispatch and API communication with GitHub Actions
 * 
 * @module GitHubAPI
 */

const GitHubAPI = {
    /**
     * Trigger GitHub Actions workflow
     * @param {Object} config - Test configuration
     * @param {string} token - GitHub personal access token
     * @param {Object} githubConfig - API configuration (owner, repo, workflow)
     * @param {string} format - Output format (json/env/canonical/hocon)
     * @returns {Promise<Object>} Result object with success status and data
     */
async triggerWorkflow(config, token, githubConfig, format = 'json') {
    try {
        // Validate token
        if (!token || !SecurityUtils.isValidGitHubToken(token)) {
            return {
                success: false,
                message: 'Invalid or missing GitHub token'
            };
        }

        // Validate GitHub config
        if (!githubConfig || !githubConfig.owner || !githubConfig.repo || !githubConfig.workflow) {
            return {
                success: false,
                message: 'Invalid GitHub configuration. Check js/config.js'
            };
        }

        // Store for use in other methods
        this.githubConfig = githubConfig;

        // Build API URL
        const url = this.buildApiUrl(githubConfig);

            // Build payload
            const payload = this.buildPayload(config, format);

            console.log('🔗 Triggering workflow:', url);
            console.log('📦 Payload:', payload);

            // Make API request
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            // Handle response
            if (response.status === 204) {
                // Success (204 No Content is expected response)
                return this.handleSuccess(config, githubConfig);
            } else {
                // Error
                const errorData = await response.json().catch(() => ({}));
                return this.handleError(response, errorData);
            }

        } catch (error) {
            console.error('GitHub API Error:', error);
            return {
                success: false,
                message: error.message || 'Network error occurred'
            };
        }
    },

/**
 * Build GitHub API URL
 * @param {Object} githubConfig - GitHub configuration (from CONFIG.github)
 * @returns {string} Full API URL
 */
buildApiUrl(githubConfig) {
    return `${githubConfig.apiBase}/repos/${githubConfig.owner}/${githubConfig.repo}/actions/workflows/${githubConfig.workflow}/dispatches`;
},

    /**
     * Build GitHub Actions workflow dispatch payload
     * @param {Object} config - Configuration object
     * @param {string} format - Output format (json/env/canonical/hocon)
     * @returns {Object} Workflow dispatch payload
     */
    buildPayload(config, format) {
        // Check if config is in canonical format
        const isCanonical = config.test && config.test.simulation;

        if (isCanonical) {
            return this.buildCanonicalPayload(config, format);
        } else {
            // Legacy format
            return this.buildLegacyPayload(config, format);
        }
    },

    /**
     * Build payload from canonical configuration (FORMAT-AWARE)
     * Simplified to match GitHub Actions workflow inputs: format + config
     * @param {Object} canonical - Canonical configuration object
     * @param {string} format - Output format (json/env/hocon)
     * @returns {Object} Workflow dispatch payload
     */
     buildCanonicalPayload(canonical, format) {
        // Determine config string based on format
        let configString;
        
        switch (format) {
            case 'env':
                // Encode to ENV format (double-underscore)
                configString = EnvEncoder.encode(canonical);
                console.log('📦 Sending ENV format configuration');
                break;
    
            case 'hocon':
                // Format as HOCON
                configString = HoconFormatter.format(canonical);
                console.log('📦 Sending HOCON format configuration');
                break;
    
            case 'json':
            default:
                // Stringify as JSON (default)
                configString = JSON.stringify(canonical);
                console.log('📦 Sending JSON format configuration');
                break;
        }
    
        // Build simplified payload matching GitHub Actions workflow
        const payload = {
            ref: this.githubConfig.branch,
            inputs: {
                format: format || 'json',  // Format type
                config: configString       // Configuration data
            }
        };
    
    console.log(`✅ Payload ready: format=${payload.inputs.format}, config length=${payload.inputs.config.length} chars`);
    
    return payload;
},

    /**
     * Build payload from legacy configuration (backward compatibility)
     * DEPRECATED: Legacy format support - use canonical format instead
     * @param {Object} config - Legacy configuration object
     * @param {string} format - Output format preference
     * @returns {Object} Workflow dispatch payload
     */
    buildLegacyPayload(config, format) {
        console.warn('⚠️ Using legacy format - consider migrating to canonical format');

        // Format as JSON (legacy ENV format removed)
        const configString = JSON.stringify(config, null, 2);

        return {
            ref: this.githubConfig.branch,
            inputs: {
                config_data: configString,
                load_type: config.loadType,
                environment: config.environment,
                target_url: config.target_url,
                scenario: config.scenario,
                users: String(config.loadConfig?.users || 1),
                duration: String(config.loadConfig?.duration || 60),
                output_format: 'json' // Force JSON for legacy
            }
        };
    },

    /**
     * Handle successful workflow trigger
     * @param {Object} config - Configuration that was sent
     * @param {Object} githubConfig - API configuration
     * @returns {Object} Success result object
     */
    handleSuccess(config, githubConfig) {

        // Check if canonical or legacy format
        const isCanonical = config.test && config.test.simulation;

        let data;
        if (isCanonical) {
            const profileKey = config.test.type;
            const profileConfig = config.test.load.profiles[profileKey];
            
            data = {
                loadType: config.test.type,
                users: profileConfig.users,
                duration: profileConfig.duration,
                environment: config.test.environment.type,
                targetUrl: config.test.environment.url,
                scenario: config.test.simulation
            };
        } else {
            // Legacy format
            data = {
                loadType: config.loadType,
                users: config.loadConfig?.users || 1,
                duration: config.loadConfig?.duration || 60,
                environment: config.environment,
                targetUrl: config.target_url,
                scenario: config.scenario
            };
        }

        const actionsUrl = `https://github.com/${githubConfig.owner}/${githubConfig.repo}/actions/workflows/${githubConfig.workflow}`;
        return {
            success: true,
            message: 'Workflow triggered successfully',
            data: data,
            link: {
                url: actionsUrl,
                text: 'View workflow runs'
            }
        };
    },

    /**
     * Handle API error response
     * @param {Response} response - Fetch response object
     * @param {Object} errorData - Parsed error data from response
     * @returns {Object} Error result object
     */
    handleError(response, errorData) {
        let message = 'Failed to trigger workflow';

        if (response.status === 401) {
            message = 'Authentication failed. Token may be invalid or expired.';
        } else if (response.status === 403) {
            message = 'Access forbidden. Token may lack required permissions (repo, workflow).';
        } else if (response.status === 404) {
            message = 'Repository or workflow not found. Check configuration.';
        } else if (response.status === 422) {
            message = 'Invalid workflow inputs. ' + (errorData.message || '');
        } else if (errorData.message) {
            message = errorData.message;
        }

        return {
            success: false,
            message: message,
            status: response.status,
            errorData: errorData
        };
    },


};

// Export for browser
if (typeof window !== 'undefined') {
    window.GitHubAPI = GitHubAPI;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAPI;
}