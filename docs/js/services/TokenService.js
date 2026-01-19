/**
 * Token Management Service
 * GitHub token validation, storage, and lifecycle management
 * 
 * @module TokenService
 */

const TokenService = {
    /**
     * Storage key for GitHub token
     */
    get STORAGE_KEY() {
        return window.CONFIG?.storage?.tokenKey || 'perf_runner_github_token';
    },
    
    /**
     * Check if a valid token exists
     * @returns {boolean} True if valid token exists
     */
    hasValidToken() {
        const token = this.getToken();
        return !!token && SecurityUtils.isValidGitHubToken(token);
    },

    /**
     * Get stored token
     * @returns {string|null} Token or null if not found
     */
    getToken() {
        return StorageUtils.getItem(this.STORAGE_KEY);
    },

    /**
     * Save token to storage
     * @param {string} token - GitHub token to save
     * @param {Object} options - Save options
     * @param {boolean} options.validate - Validate token format (default: true)
     * @param {boolean} options.force - Force save even if validation fails (default: false)
     * @returns {Object} Result with { success, message }
     */
    saveToken(token, options = {}) {
        const { validate = true, force = false } = options;

        // Sanitize input
        const sanitizedToken = token?.trim();

        if (!sanitizedToken) {
            return {
                success: false,
                message: 'Token cannot be empty'
            };
        }

        // Validate format
        if (validate && !SecurityUtils.isValidGitHubToken(sanitizedToken)) {
            if (!force) {
                return {
                    success: false,
                    message: 'Invalid token format. Expected format: ghp_xxx or github_pat_xxx',
                    warning: true // Indicates validation failed but could be forced
                };
            }
            console.warn('⚠️ Saving token with unusual format');
        }

        // Save to storage
        const saved = StorageUtils.setItem(this.STORAGE_KEY, sanitizedToken);

        if (saved) {
            console.log('✅ Token saved successfully');
            return {
                success: true,
                message: 'Token saved successfully'
            };
        } else {
            return {
                success: false,
                message: 'Failed to save token to storage'
            };
        }
    },

    /**
     * Remove token from storage
     * @returns {boolean} True if removed successfully
     */
    removeToken() {
        const removed = StorageUtils.removeItem(this.STORAGE_KEY);
        
        if (removed) {
            console.log('🗑️ Token removed');
        }
        
        return removed;
    },

    /**
     * Validate token format (without saving)
     * @param {string} token - Token to validate
     * @returns {Object} Validation result with { valid, type, message }
     */
    validateToken(token) {
        if (!token || typeof token !== 'string') {
            return {
                valid: false,
                message: 'Token must be a string'
            };
        }

        const trimmed = token.trim();

        if (!trimmed) {
            return {
                valid: false,
                message: 'Token cannot be empty'
            };
        }

        // Detect token type
        let tokenType = 'unknown';
        
        if (/^ghp_[a-zA-Z0-9]{36}$/.test(trimmed)) {
            tokenType = 'classic';
        } else if (/^github_pat_[a-zA-Z0-9_]+$/.test(trimmed)) {
            tokenType = 'fine-grained';
        }

        if (tokenType !== 'unknown') {
            return {
                valid: true,
                type: tokenType,
                message: `Valid ${tokenType} token format`
            };
        }

        return {
            valid: false,
            type: 'unknown',
            message: 'Token format not recognized'
        };
    },

    /**
     * Mask token for display (show first/last chars only)
     * @param {string} token - Token to mask
     * @param {number} visibleChars - Number of chars to show at start/end (default: 4)
     * @returns {string} Masked token
     */
    maskToken(token, visibleChars = 4) {
        if (!token || token.length <= visibleChars * 2) {
            return '***';
        }

        const start = token.substring(0, visibleChars);
        const end = token.substring(token.length - visibleChars);
        const middle = '*'.repeat(Math.min(token.length - visibleChars * 2, 20));

        return `${start}${middle}${end}`;
    },

    /**
     * Get token info (without exposing actual token)
     * @returns {Object} Token info with { exists, valid, type, masked }
     */
    getTokenInfo() {
        const token = this.getToken();

        if (!token) {
            return {
                exists: false,
                valid: false,
                type: null,
                masked: null
            };
        }

        const validation = this.validateToken(token);

        return {
            exists: true,
            valid: validation.valid,
            type: validation.type || 'unknown',
            masked: this.maskToken(token)
        };
    },

    /**
     * Test token by making a simple API call
     * @param {string} token - Token to test (optional, uses stored if not provided)
     * @returns {Promise<Object>} Test result with { valid, user, message }
     */
    async testToken(token = null) {
        const testToken = token || this.getToken();

        if (!testToken) {
            return {
                valid: false,
                message: 'No token provided'
            };
        }

        try {
            // Test with GitHub API user endpoint
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${testToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                return {
                    valid: true,
                    user: {
                        login: user.login,
                        name: user.name,
                        avatar: user.avatar_url
                    },
                    message: 'Token is valid'
                };
            } else if (response.status === 401) {
                return {
                    valid: false,
                    message: 'Token is invalid or expired'
                };
            } else {
                return {
                    valid: false,
                    message: `API returned status ${response.status}`
                };
            }

        } catch (error) {
            console.error('Token test failed:', error);
            return {
                valid: false,
                message: error.message
            };
        }
    },

    /**
     * Check if token has required scopes
     * @param {string} token - Token to check (optional, uses stored if not provided)
     * @returns {Promise<Object>} Scope check result
     */
    async checkScopes(token = null) {
        const testToken = token || this.getToken();

        if (!testToken) {
            return {
                success: false,
                message: 'No token provided'
            };
        }

        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `token ${testToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                return {
                    success: false,
                    message: 'Token validation failed'
                };
            }

            // Get scopes from response headers
            const scopes = response.headers.get('X-OAuth-Scopes') || '';
            const scopeList = scopes.split(',').map(s => s.trim()).filter(Boolean);

            // Required scopes for workflow dispatch
            const requiredScopes = ['repo', 'workflow'];
            const hasRequired = requiredScopes.every(required => 
                scopeList.includes(required) || scopeList.includes('repo') // 'repo' includes workflow
            );

            return {
                success: true,
                scopes: scopeList,
                hasRequired,
                message: hasRequired 
                    ? 'Token has required scopes'
                    : 'Token is missing required scopes (repo, workflow)'
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.TokenService = TokenService;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenService;
}