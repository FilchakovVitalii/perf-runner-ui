/**
 * Cookie Storage Utility
 * Read/write cookies for token storage (no HttpOnly; JS must access).
 *
 * @module CookieStorage
 */

const CookieStorage = {
    /**
     * Get a cookie value by name.
     * @param {string} name - Cookie name
     * @returns {string|null} Decoded value or null if not found
     */
    getCookie(name) {
        if (!name || typeof name !== 'string') return null;
        const eq = name + '=';
        const parts = document.cookie.split(';');
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (part.indexOf(eq) === 0) {
                const value = part.slice(eq.length).trim();
                try {
                    return value ? decodeURIComponent(value) : '';
                } catch (_) {
                    return value;
                }
            }
        }
        return null;
    },

    /**
     * Set a cookie.
     * @param {string} name - Cookie name
     * @param {string} value - Cookie value (will be URI-encoded)
     * @param {Object} options - Optional settings
     * @param {number} [options.maxAge] - Max age in seconds
     * @param {string} [options.path='/'] - Path
     * @param {string} [options.sameSite='Lax'] - SameSite attribute
     * @param {boolean} [options.secure] - Secure flag (default: true when page is HTTPS)
     * @returns {boolean} True if the cookie string was set
     */
    setCookie(name, value, options = {}) {
        if (!name || typeof name !== 'string') return false;
        const encoded = encodeURIComponent(String(value));
        const path = options.path != null ? options.path : '/';
        const sameSite = options.sameSite != null ? options.sameSite : 'Lax';
        const secure = options.secure !== undefined ? options.secure : (typeof location !== 'undefined' && location.protocol === 'https:');

        let str = name + '=' + encoded + '; path=' + path + '; samesite=' + sameSite;
        if (options.maxAge != null && options.maxAge >= 0) {
            str += '; max-age=' + Math.floor(options.maxAge);
        }
        if (secure) {
            str += '; secure';
        }

        try {
            document.cookie = str;
            return true;
        } catch (e) {
            return false;
        }
    },

    /**
     * Remove a cookie by name (same path required).
     * @param {string} name - Cookie name
     * @param {string} [path='/'] - Path (must match the one used when setting)
     * @returns {boolean} True if the cookie was cleared
     */
    removeCookie(name, path = '/') {
        if (!name || typeof name !== 'string') return false;
        try {
            document.cookie = name + '=; path=' + path + '; max-age=0';
            return true;
        } catch (e) {
            return false;
        }
    }
};

if (typeof window !== 'undefined') {
    window.CookieStorage = CookieStorage;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CookieStorage;
}
