const CONFIG = {
    // Your repository details
    REPO_OWNER: 'FilchakovVitalii',
    REPO_NAME: 'perf-runner',
    WORKFLOW_FILE: 'perf-test.yml',
    BRANCH: 'main',
    // GitHub API
    API_BASE: 'https://api.github.com',
    // Storage
    TOKEN_STORAGE_KEY: 'perf_runner_github_token',
    // App version
    VERSION: '2.0.0 (Vue.js)'
};

// Make available globally for Vue
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}