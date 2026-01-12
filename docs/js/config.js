const CONFIG = {
    // Your repository details
    REPO_OWNER: 'FilchakovVitalii',
    REPO_NAME: 'perf-runner',
    WORKFLOW_FILE: 'basic.yml',
    BRANCH: 'main',
    // GitHub API
    API_BASE: 'https://api.github.com',
    // Storage
    TOKEN_STORAGE_KEY: 'perf_runner_github_token',
    // App version
    VERSION: '2.0.0 (Vue.js)',

     // Output Format Configuration
    DEFAULT_OUTPUT_FORMAT: 'env',  // 'json' or 'env'
    
    // API Request Configuration
    API_CONFIG: {
        // Send format that matches UI selection (true) or always use default (false)
        USE_SELECTED_FORMAT: true,
        
        // Include format indicator in payload (recommended)
        INCLUDE_FORMAT_INDICATOR: true,
        
        // Send both formats (workflow can choose which to use)
        SEND_BOTH_FORMATS: false
    }
};

// Make available globally for Vue
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}