/**
 * UI Service
 * Handles UI interactions, scroll, keyboard shortcuts, navigation
 * 
 * @module UIService
 */

const UIService = {
    /**
     * Keyboard shortcuts configuration
     */
    shortcuts: {
        SUBMIT: { ctrl: true, key: 'Enter', description: 'Submit form' },
        SAVE_PRESET: { ctrl: true, key: 's', description: 'Save preset' },
        ESCAPE: { key: 'Escape', description: 'Close modals' }
    },

    /**
     * Initialize UI event listeners
     * @param {Object} handlers - Object with handler functions
     * @param {Function} handlers.onScroll - Scroll handler
     * @param {Function} handlers.onKeyboard - Keyboard handler
     * @returns {Function} Cleanup function to remove listeners
     */
    initialize(handlers) {
        // Bind handlers to window
        const boundScroll = handlers.onScroll.bind(handlers.context);
        const boundKeyboard = handlers.onKeyboard.bind(handlers.context);

        window.addEventListener('scroll', boundScroll);
        document.addEventListener('keydown', boundKeyboard);

        console.log('⌨️ UI Service initialized');

        // Return cleanup function
        return () => {
            window.removeEventListener('scroll', boundScroll);
            document.removeEventListener('keydown', boundKeyboard);
            console.log('🧹 UI Service cleaned up');
        };
    },

    /**
     * Calculate scroll progress
     * @returns {Object} Scroll data with { isScrolled, progress }
     */
    getScrollData() {
        const isScrolled = window.scrollY > 20;
        const windowHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = windowHeight > 0 ? (window.scrollY / windowHeight) * 100 : 0;

        return { isScrolled, progress };
    },

    /**
     * Detect active section based on scroll position
     * @param {Array<string>} sectionNames - Array of section names
     * @param {number} headerOffset - Offset for header (default: 150)
     * @returns {string|null} Active section name or null
     */
    detectActiveSection(sectionNames, headerOffset = 150) {
        for (const section of sectionNames) {
            const element = document.getElementById(`${section}-section`);
            if (element) {
                const rect = element.getBoundingClientRect();
                if (rect.top <= headerOffset && rect.bottom >= headerOffset) {
                    return section;
                }
            }
        }
        return null;
    },

    /**
     * Scroll to a section smoothly
     * @param {string} sectionName - Name of section to scroll to
     * @param {Object} options - Scroll options
     */
    scrollToSection(sectionName, options = {}) {
        const sectionId = `${sectionName}-section`;
        const element = document.getElementById(sectionId);

        if (element) {
            element.scrollIntoView({
                behavior: options.behavior || 'smooth',
                block: options.block || 'start'
            });
            return true;
        }

        console.warn(`Section not found: ${sectionId}`);
        return false;
    },

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} event - Keyboard event
     * @param {Object} callbacks - Object with callback functions
     * @param {Function} callbacks.onSubmit - Called on Ctrl+Enter
     * @param {Function} callbacks.onSavePreset - Called on Ctrl+S
     * @param {Function} callbacks.onEscape - Called on Escape
     */
    handleKeyboardShortcut(event, callbacks) {
        // Ctrl+Enter: Submit form
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            if (callbacks.onSubmit) {
                callbacks.onSubmit();
            }
        }

        // Ctrl+S: Save preset
        if (event.ctrlKey && event.key === 's') {
            event.preventDefault();
            if (callbacks.onSavePreset) {
                callbacks.onSavePreset();
            }
        }

        // Escape: Close modals
        if (event.key === 'Escape') {
            if (callbacks.onEscape) {
                callbacks.onEscape();
            }
        }
    },

    /**
     * Focus an element by ID with optional delay
     * @param {string} elementId - Element ID to focus
     * @param {number} delay - Delay in ms (default: 0)
     */
    focusElement(elementId, delay = 0) {
        const focus = () => {
            const element = document.getElementById(elementId);
            if (element) {
                element.focus();
                return true;
            }
            console.warn(`Element not found: ${elementId}`);
            return false;
        };

        if (delay > 0) {
            setTimeout(focus, delay);
        } else {
            return focus();
        }
    },

    /**
     * Scroll element into view
     * @param {string} selector - CSS selector
     * @param {Object} options - Scroll options
     */
    scrollToElement(selector, options = {}) {
        const element = document.querySelector(selector);
        if (element) {
            element.scrollIntoView({
                behavior: options.behavior || 'smooth',
                block: options.block || 'nearest'
            });
            return true;
        }
        return false;
    },

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} True if successful
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            } catch (fallbackError) {
                console.error('Fallback copy failed:', fallbackError);
                return false;
            }
        }
    },

    /**
     * Show temporary feedback on button
     * @param {Object} state - Vue reactive state object
     * @param {string} property - Property name to update
     * @param {string} temporaryValue - Value to show temporarily
     * @param {string} originalValue - Value to restore
     * @param {number} duration - Duration in ms (default: 2000)
     */
    showTemporaryFeedback(state, property, temporaryValue, originalValue, duration = 2000) {
        state[property] = temporaryValue;
        setTimeout(() => {
            state[property] = originalValue;
        }, duration);
    },



    /**
     * Debounce function (utility for scroll handlers)
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// Export for browser
if (typeof window !== 'undefined') {
    window.UIService = UIService;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIService;
}