/**
 * Storage Utilities
 * Safe localStorage wrapper with error handling and quota management
 * 
 * @module StorageUtils
 */

const StorageUtils = {
    /**
     * Storage quota limit (5MB for most browsers)
     */
    QUOTA_LIMIT: 5 * 1024 * 1024,

    /**
     * Get item from localStorage
     * @param {string} key - Storage key
     * @returns {string|null} Stored value or null
     */
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error(`Failed to get item "${key}":`, error);
            return null;
        }
    },

    /**
     * Set item in localStorage with quota handling
     * @param {string} key - Storage key
     * @param {string} value - Value to store
     * @returns {boolean} True if successful
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.error('localStorage quota exceeded');
                this.handleQuotaExceeded();
            } else {
                console.error(`Failed to set item "${key}":`, error);
            }
            return false;
        }
    },

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} True if successful
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error(`Failed to remove item "${key}":`, error);
            return false;
        }
    },

    /**
     * Get JSON object from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found or invalid
     * @returns {*} Parsed JSON or default value
     */
    getJSON(key, defaultValue = null) {
        try {
            const item = this.getItem(key);
            if (!item) return defaultValue;
            
            return JSON.parse(item);
        } catch (error) {
            console.error(`Failed to parse JSON for "${key}":`, error);
            return defaultValue;
        }
    },

    /**
     * Set JSON object in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store (will be stringified)
     * @returns {boolean} True if successful
     */
    setJSON(key, value) {
        try {
            const jsonString = JSON.stringify(value);
            return this.setItem(key, jsonString);
        } catch (error) {
            console.error(`Failed to stringify JSON for "${key}":`, error);
            return false;
        }
    },

    /**
     * Clear all localStorage data
     * @returns {boolean} True if successful
     */
    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
            return false;
        }
    },

    /**
     * Get all keys in localStorage
     * @returns {Array<string>} Array of keys
     */
    getAllKeys() {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('Failed to get localStorage keys:', error);
            return [];
        }
    },

    /**
     * Get storage usage information
     * @returns {Object} Storage stats with { used, remaining, percentage }
     */
    getStorageUsage() {
        try {
            let used = 0;
            
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    used += localStorage[key].length + key.length;
                }
            }
            
            // Convert to bytes (characters are roughly 2 bytes in UTF-16)
            used = used * 2;
            
            const remaining = this.QUOTA_LIMIT - used;
            const percentage = (used / this.QUOTA_LIMIT) * 100;
            
            return {
                used,
                remaining,
                percentage: percentage.toFixed(2),
                usedMB: (used / (1024 * 1024)).toFixed(2),
                remainingMB: (remaining / (1024 * 1024)).toFixed(2),
                limitMB: (this.QUOTA_LIMIT / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            console.error('Failed to get storage usage:', error);
            return {
                used: 0,
                remaining: this.QUOTA_LIMIT,
                percentage: 0,
                usedMB: '0.00',
                remainingMB: '5.00',
                limitMB: '5.00'
            };
        }
    },

    /**
     * Handle quota exceeded error
     * Attempts to free up space by removing old data
     */
    handleQuotaExceeded() {
        console.warn('⚠️ Storage quota exceeded. Attempting cleanup...');
        
        try {
            // Get all keys with timestamps
            const keys = this.getAllKeys();
            const keysWithTime = [];
            
            keys.forEach(key => {
                const value = this.getJSON(key);
                if (value && value.timestamp) {
                    keysWithTime.push({
                        key,
                        timestamp: new Date(value.timestamp).getTime()
                    });
                }
            });
            
            // Sort by oldest first
            keysWithTime.sort((a, b) => a.timestamp - b.timestamp);
            
            // Remove oldest 25% of items with timestamps
            const toRemove = Math.ceil(keysWithTime.length * 0.25);
            for (let i = 0; i < toRemove; i++) {
                this.removeItem(keysWithTime[i].key);
                console.log(`Removed old item: ${keysWithTime[i].key}`);
            }
            
            console.log(`✅ Cleanup complete. Removed ${toRemove} items.`);
            
        } catch (error) {
            console.error('Failed to cleanup storage:', error);
        }
    },

    /**
     * Check if localStorage is available
     * @returns {boolean} True if available
     */
    isAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    },


};

// Export for browser
if (typeof window !== 'undefined') {
    window.StorageUtils = StorageUtils;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageUtils;
}