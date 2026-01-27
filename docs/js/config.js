/**
 * Performance Test Runner - Configuration
 * Single source of truth for all app settings
 */

const CONFIG = {
    // GitHub Repository (single source of truth)
    github: {
        owner: 'FilchakovVitalii',
        repo: 'perf-runner',
        workflow: 'basic.yml',
        branch: 'main',
        apiBase: 'https://api.github.com'
    },
    
    // Storage: token in cookie or localStorage; presets stay in localStorage
    storage: {
        tokenKey: 'perf_runner_github_token',
        presetsKey: 'perf_runner_user_presets',
        tokenBackend: 'cookie',   // 'cookie' | 'localStorage'
        cookieMaxAgeDays: 90
    },
    
    // Application Settings
    app: {
        version: '0.9.0-hocon',
        defaultOutputFormat: 'env'  // 'json', 'env', or 'hocon'
    }
};

// Computed properties for backward compatibility and convenience
Object.defineProperties(CONFIG, {
    // Workflow URL (computed from github settings)
    workflowUrl: {
        get() {
            return `https://github.com/${this.github.owner}/${this.github.repo}/actions/workflows/${this.github.workflow}`;
        },
        enumerable: true
    },
    
    // API endpoint (computed)
    apiEndpoint: {
        get() {
            return `${this.github.apiBase}/repos/${this.github.owner}/${this.github.repo}/actions/workflows/${this.github.workflow}/dispatches`;
        },
        enumerable: true
    }
});

// Make available globally
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}