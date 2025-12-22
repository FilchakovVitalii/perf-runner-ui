// Configuration file - Update these values
const CONFIG = {
    // Your private repository details
    REPO_OWNER: 'YOUR_USERNAME',
    REPO_NAME: 'perf-runner',
    WORKFLOW_FILE: 'perf-test.yml',
    BRANCH: 'main',
    
    // GitHub API endpoint
    API_BASE: 'https://api.github.com',
    
    // Local storage key for token
    TOKEN_STORAGE_KEY: 'perf_runner_github_token'
};

// Do not edit below
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}