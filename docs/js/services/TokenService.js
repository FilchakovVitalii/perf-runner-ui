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
     * Whether to use cookie backend (from config)
     * @returns {boolean}
     */
    _useCookieBackend() {
        return typeof window !== 'undefined' &&
            window.CONFIG?.storage?.tokenBackend === 'cookie' &&
            typeof window.CookieStorage === 'object';
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
     * Get stored token (with one-time migration from localStorage when using cookie backend)
     * @returns {string|null} Token or null if not found
     */
    getToken() {
        const key = this.STORAGE_KEY;
        if (this._useCookieBackend()) {
            let token = CookieStorage.getCookie(key);
            if (!token && typeof StorageUtils !== 'undefined') {
                const fromStorage = StorageUtils.getItem(key);
                if (fromStorage) {
                    const maxAge = (window.CONFIG?.storage?.cookieMaxAgeDays ?? 90) * 86400;
                    if (CookieStorage.setCookie(key, fromStorage, { maxAge, path: '/', sameSite: 'Lax', secure: typeof location !== 'undefined' && location.protocol === 'https:' })) {
                        StorageUtils.removeItem(key);
                        token = fromStorage;
                        console.log('✅ Token migrated from localStorage to cookie');
                    }
                }
            }
            return token || null;
        }
        return StorageUtils.getItem(key);
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

        // Save to storage (cookie or localStorage)
        const key = this.STORAGE_KEY;
        let saved = false;
        if (this._useCookieBackend()) {
            const maxAge = (window.CONFIG?.storage?.cookieMaxAgeDays ?? 90) * 86400;
            saved = CookieStorage.setCookie(key, sanitizedToken, {
                maxAge,
                path: '/',
                sameSite: 'Lax',
                secure: typeof location !== 'undefined' && location.protocol === 'https:'
            });
        } else {
            saved = StorageUtils.setItem(key, sanitizedToken);
        }

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
        const key = this.STORAGE_KEY;
        const removed = this._useCookieBackend()
            ? CookieStorage.removeCookie(key, '/')
            : StorageUtils.removeItem(key);

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


};

// Export for browser
if (typeof window !== 'undefined') {
    window.TokenService = TokenService;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TokenService;
}