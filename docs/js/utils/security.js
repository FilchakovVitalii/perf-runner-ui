/**
 * Security Utilities
 * XSS prevention, input sanitization, validation
 * 
 * @module SecurityUtils
 */

const SecurityUtils = {
    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    escapeHtml(str) {
        if (typeof str !== 'string') return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    /**
     * Sanitize user input (XSS prevention)
     * @param {string} input - Raw input string
     * @param {number} maxLength - Maximum allowed length
     * @returns {string} Sanitized input
     */
    sanitizeInput(input, maxLength = 200) {
        if (typeof input !== 'string') return '';
        
        // Remove any potential script tags or dangerous content
        let sanitized = input
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .trim();
        
        // Limit length
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }
        
        return sanitized;
    },

    /**
     * Sanitize emoji input (only allow valid emojis)
     * @param {string} input - Raw emoji input
     * @returns {string} Valid emoji or default rocket emoji
     */
    sanitizeEmoji(input) {
        if (typeof input !== 'string') return '🚀';
        
        // Check if input contains valid emoji
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        
        if (emojiRegex.test(input)) {
            // Extract first emoji
            const match = input.match(emojiRegex);
            return match ? match[0] : '🚀';
        }
        
        return '🚀'; // Default emoji
    },

    /**
     * Validate GitHub token format
     * @param {string} token - Token to validate
     * @returns {boolean} True if token format is valid
     */
    isValidGitHubToken(token) {
        if (!token || typeof token !== 'string') return false;
        
        // GitHub tokens formats:
        // - Classic: ghp_xxxxx (40 chars total)
        // - Fine-grained: github_pat_xxxxx (longer)
        const classicPattern = /^ghp_[a-zA-Z0-9]{36}$/;
        const fineGrainedPattern = /^github_pat_[a-zA-Z0-9_]+$/;
        
        return classicPattern.test(token) || fineGrainedPattern.test(token);
    },


};

// Export for browser
if (typeof window !== 'undefined') {
    window.SecurityUtils = SecurityUtils;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SecurityUtils;
}