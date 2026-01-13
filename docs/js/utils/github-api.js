/**
 * GitHub API Utilities
 * Handles GitHub Actions workflow dispatching
 * 
 * @module GitHubAPI
 */

const GitHubAPI = {
    /**
     * Trigger GitHub Actions workflow
     * @param {Object} config - Test configuration object
     * @param {string} token - GitHub personal access token
     * @param {Object} apiConfig - API configuration from CONFIG
     * @param {string} outputFormat - Selected output format ('json' or 'env')
     * @returns {Promise<Object>} Result object with { success, message, link?, data? }
     */
    async triggerWorkflow(config, token, apiConfig, outputFormat) {
        try {
            // Validate token
            if (!token) {
                throw new Error('GitHub token not found');
            }

            if (!SecurityUtils.isValidGitHubToken(token)) {
                throw new Error('Invalid GitHub token format');
            }

            // Build API URL
            const apiUrl = `${window.CONFIG.API_BASE}/repos/${window.CONFIG.REPO_OWNER}/${window.CONFIG.REPO_NAME}/actions/workflows/${window.CONFIG.WORKFLOW_FILE}/dispatches`;

            // Build payload
            const payload = this.buildPayload(config, outputFormat, apiConfig);

            console.log('📤 Sending payload with format:', payload.inputs.format || 'legacy');
            console.log('📤 Payload:', payload);

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

            // Handle response
            return await this.handleResponse(response, config);

        } catch (error) {
            console.error('❌ GitHub API Error:', error);
            return {
                success: false,
                message: error.message,
                error
            };
        }
    },

    /**
     * Build workflow dispatch payload
     * @param {Object} config - Test configuration
     * @param {string} outputFormat - Output format ('json' or 'env')
     * @param {Object} apiConfig - API configuration
     * @returns {Object} Workflow dispatch payload
     */
    buildPayload(config, outputFormat, apiConfig) {
        // Determine which format to send
        const formatToSend = apiConfig.USE_SELECTED_FORMAT
            ? outputFormat
            : window.CONFIG.DEFAULT_OUTPUT_FORMAT;

        // Prepare configuration data
        let configData;
        let configFormat;

        if (apiConfig.SEND_BOTH_FORMATS) {
            // Send both JSON and ENV formats
            configData = {
                json: FormatUtils.toJSON(config),
                env: FormatUtils.toENV(config),
                format: formatToSend  // Preferred format
            };
            configFormat = 'both';
        } else {
            // Send only selected format
            if (formatToSend === 'env') {
                configData = FormatUtils.toENV(config);
                configFormat = 'env';
            } else {
                configData = FormatUtils.toJSON(config);
                configFormat = 'json';
            }
        }

        // Prepare payload
        const payload = {
            ref: window.CONFIG.BRANCH,
            inputs: {}
        };

        // Add format indicator if configured
        if (apiConfig.INCLUDE_FORMAT_INDICATOR) {
            payload.inputs.format = configFormat;
        }

        // Add configuration data
        if (apiConfig.SEND_BOTH_FORMATS) {
            // Send as structured object
            payload.inputs.config_json = configData.json;
            payload.inputs.config_env = configData.env;
            payload.inputs.preferred_format = configData.format;
        } else {
            // Send as single string
            payload.inputs.config = configData;
        }

        return payload;
    },

    /**
     * Handle GitHub API response
     * @param {Response} response - Fetch API response
     * @param {Object} config - Test configuration
     * @returns {Promise<Object>} Result object
     */
    async handleResponse(response, config) {
        if (response.status === 204) {
            // Success
            const repoUrl = `https://github.com/${window.CONFIG.REPO_OWNER}/${window.CONFIG.REPO_NAME}`;
            const actionsUrl = `${repoUrl}/actions/workflows/${window.CONFIG.WORKFLOW_FILE}`;

            return {
                success: true,
                message: 'Workflow triggered successfully',
                link: {
                    text: 'View Workflow Progress',
                    url: actionsUrl
                },
                data: {
                    loadType: config.loadType,
                    users: config.loadConfig.users,
                    duration: config.loadConfig.duration,
                    environment: config.environment,
                    targetUrl: config.target_url,
                    scenario: config.scenario
                }
            };
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
    },

    /**
     * Get workflow run history
     * @param {string} token - GitHub token
     * @param {number} perPage - Number of runs to fetch
     * @returns {Promise<Array>} Array of workflow runs
     */
    async getWorkflowRuns(token, perPage = 10) {
        try {
            const apiUrl = `${window.CONFIG.API_BASE}/repos/${window.CONFIG.REPO_OWNER}/${window.CONFIG.REPO_NAME}/actions/workflows/${window.CONFIG.WORKFLOW_FILE}/runs?per_page=${perPage}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'Authorization': `token ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch workflow runs: ${response.status}`);
            }

            const data = await response.json();
            return data.workflow_runs || [];

        } catch (error) {
            console.error('Failed to fetch workflow runs:', error);
            return [];
        }
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.GitHubAPI = GitHubAPI;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GitHubAPI;
}