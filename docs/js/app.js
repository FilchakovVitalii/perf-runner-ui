/**
 * Performance Test Runner - Application Logic
 * Step 2: Basic UI with form handling and JSON generation
 */

// ============================================
// State Management
// ============================================
const state = {
    currentConfig: null,
    hasToken: false
};

// ============================================
// DOM Elements
// ============================================
const elements = {
    form: document.getElementById('test-form'),
    targetUrl: document.getElementById('target-url'),
    duration: document.getElementById('duration'),
    users: document.getElementById('users'),
    runBtn: document.getElementById('run-btn'),
    jsonOutput: document.getElementById('json-output'),
    copyBtn: document.getElementById('copy-btn'),
    statusSection: document.getElementById('status-section'),
    statusContent: document.getElementById('status-content'),
    tokenModal: document.getElementById('token-modal'),
    githubToken: document.getElementById('github-token'),
    saveToken: document.getElementById('save-token'),
    cancelToken: document.getElementById('cancel-token')
};

// ============================================
// Initialization
// ============================================
function init() {
    console.log('🚀 Performance Test Runner initialized');
    console.log('📝 Configuration:', CONFIG);
    
    // Check for existing token
    checkToken();
    
    // Set up event listeners
    setupEventListeners();
    
    // Generate initial JSON preview
    updateJSONPreview();
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Form submission
    elements.form.addEventListener('submit', handleFormSubmit);
    
    // Real-time JSON update
    elements.form.addEventListener('input', debounce(updateJSONPreview, 300));
    
    // Copy button
    elements.copyBtn.addEventListener('click', copyJSON);
    
    // Token modal
    elements.saveToken.addEventListener('click', saveToken);
    elements.cancelToken.addEventListener('click', closeTokenModal);
    
    // Close modal on outside click
    elements.tokenModal.addEventListener('click', (e) => {
        if (e.target === elements.tokenModal) {
            closeTokenModal();
        }
    });
}

// ============================================
// Form Handling
// ============================================
function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate form
    if (!elements.form.checkValidity()) {
        showStatus('Please fill in all required fields correctly', 'error');
        return;
    }
    
    // Generate configuration
    const config = generateConfig();
    
    // Check if token exists
    if (!state.hasToken) {
        openTokenModal();
        return;
    }
    
    // Trigger test (will be implemented in Step 4)
    triggerTest(config);
}

function generateConfig() {
    const config = {
        target_url: elements.targetUrl.value.trim(),
        duration: parseInt(elements.duration.value),
        users: parseInt(elements.users.value),
        timestamp: new Date().toISOString()
    };
    
    state.currentConfig = config;
    return config;
}

function updateJSONPreview() {
    const config = {
        target_url: elements.targetUrl.value.trim() || 'https://api.example.com/endpoint',
        duration: parseInt(elements.duration.value) || 60,
        users: parseInt(elements.users.value) || 10
    };
    
    elements.jsonOutput.textContent = JSON.stringify(config, null, 2);
}

// ============================================
// JSON Copy Functionality
// ============================================
function copyJSON() {
    const jsonText = elements.jsonOutput.textContent;
    
    navigator.clipboard.writeText(jsonText)
        .then(() => {
            const originalText = elements.copyBtn.textContent;
            elements.copyBtn.textContent = '✅';
            
            setTimeout(() => {
                elements.copyBtn.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Copy failed:', err);
            showStatus('Failed to copy to clipboard', 'error');
        });
}

// ============================================
// Token Management
// ============================================
function checkToken() {
    const token = localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
    state.hasToken = !!token;
    
    if (state.hasToken) {
        console.log('✅ GitHub token found');
    } else {
        console.log('⚠️  No GitHub token found');
    }
}

function openTokenModal() {
    elements.tokenModal.classList.remove('hidden');
    elements.githubToken.focus();
}

function closeTokenModal() {
    elements.tokenModal.classList.add('hidden');
    elements.githubToken.value = '';
}

function saveToken() {
    const token = elements.githubToken.value.trim();
    
    if (!token) {
        alert('Please enter a valid token');
        return;
    }
    
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        const confirmed = confirm('Token format looks unusual. Are you sure this is correct?');
        if (!confirmed) return;
    }
    
    localStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, token);
    state.hasToken = true;
    
    closeTokenModal();
    showStatus('Token saved successfully! You can now trigger tests.', 'success');
    
    console.log('✅ Token saved');
}

// ============================================
// GitHub Actions API Integration
// ============================================
async function triggerTest(config) {
    showStatus('⏳ Triggering GitHub Actions workflow...', 'info');
    elements.runBtn.disabled = true;
    
    console.log('📊 Test configuration:', config);
    
    try {
        const token = localStorage.getItem(CONFIG.TOKEN_STORAGE_KEY);
        
        if (!token) {
            throw new Error('GitHub token not found');
        }
        
        // Construct API URL
        const apiUrl = `${CONFIG.API_BASE}/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/actions/workflows/${CONFIG.WORKFLOW_FILE}/dispatches`;
        
        console.log('🔗 API URL:', apiUrl);
        
        // Prepare request payload
        const payload = {
            ref: CONFIG.BRANCH,
            inputs: {
                config: JSON.stringify(config)
            }
        };
        
        console.log('📤 Sending payload:', payload);
        
        // Make API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('📥 Response status:', response.status);
        
        // Handle response
        if (response.status === 204) {
            // Success - workflow triggered
            handleSuccess(config);
        } else if (response.status === 404) {
            throw new Error('Workflow not found. Check repository and workflow file name.');
        } else if (response.status === 401) {
            throw new Error('Authentication failed. Please check your GitHub token.');
        } else if (response.status === 403) {
            throw new Error('Permission denied. Token may lack required scopes (repo, workflow).');
        } else {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API request failed with status ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        handleError(error);
    } finally {
        elements.runBtn.disabled = false;
    }
}

function handleSuccess(config) {
    const repoUrl = `https://github.com/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}`;
    const actionsUrl = `${repoUrl}/actions/workflows/${CONFIG.WORKFLOW_FILE}`;
    
    const message = `✅ Performance test triggered successfully!\n\n` +
        `📊 Configuration:\n` +
        `   • Target: ${config.target_url}\n` +
        `   • Duration: ${config.duration}s\n` +
        `   • Users: ${config.users}\n\n` +
        `⏱️  The workflow is now running...\n\n` +
        `View progress: ${actionsUrl}`;
    
    showStatus(message, 'success');
    
    // Create clickable link in status
    setTimeout(() => {
        elements.statusContent.innerHTML = `
            <div class="status-success">
                <p><strong>✅ Performance test triggered successfully!</strong></p>
                <br>
                <p><strong>📊 Configuration:</strong></p>
                <ul>
                    <li>Target: <code>${escapeHtml(config.target_url)}</code></li>
                    <li>Duration: ${config.duration} seconds</li>
                    <li>Users: ${config.users}</li>
                </ul>
                <br>
                <p>⏱️ The workflow is now running...</p>
                <br>
                <p>
                    <a href="${actionsUrl}" target="_blank" rel="noopener" class="status-link">
                        🔗 View Workflow Progress →
                    </a>
                </p>
            </div>
        `;
    }, 100);
    
    console.log('✅ Workflow triggered successfully');
}

function handleError(error) {
    let errorMessage = '❌ Failed to trigger workflow\n\n';
    
    if (error.message.includes('token')) {
        errorMessage += '🔑 Token Issue:\n' +
            error.message + '\n\n' +
            '💡 Try:\n' +
            '   1. Clear your token and set a new one\n' +
            '   2. Ensure token has "repo" and "workflow" scopes';
    } else if (error.message.includes('not found')) {
        errorMessage += '📁 Repository/Workflow Issue:\n' +
            error.message + '\n\n' +
            '💡 Check:\n' +
            `   1. Repository: ${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}\n` +
            `   2. Workflow file: .github/workflows/${CONFIG.WORKFLOW_FILE}\n` +
            '   3. Repository is accessible with your token';
    } else if (error.message.includes('Permission denied')) {
        errorMessage += '🚫 Permission Issue:\n' +
            error.message + '\n\n' +
            '💡 Solution:\n' +
            '   Generate a new token with "repo" and "workflow" scopes:\n' +
            '   https://github.com/settings/tokens/new';
    } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage += '🌐 Network Issue:\n' +
            'Could not reach GitHub API\n\n' +
            '💡 Check:\n' +
            '   1. Internet connection\n' +
            '   2. GitHub status (https://www.githubstatus.com)\n' +
            '   3. Browser console for details';
    } else {
        errorMessage += 'Error: ' + error.message;
    }
    
    showStatus(errorMessage, 'error');
    
    console.error('❌ Full error:', error);
}

// ============================================
// Utility Functions (Add to existing utilities)
// ============================================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// Status Display
// ============================================
function showStatus(message, type = 'info') {
    elements.statusSection.classList.remove('hidden');
    
    const className = `status-${type}`;
    elements.statusContent.className = `status-content ${className}`;
    elements.statusContent.textContent = message;
    
    // Scroll to status
    elements.statusSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideStatus() {
    elements.statusSection.classList.add('hidden');
}

// ============================================
// Utility Functions
// ============================================
function debounce(func, wait) {
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

// ============================================
// Initialize on DOM Ready
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// Developer Utilities (Console)
// ============================================
window.perfRunner = {
    setToken: (token) => {
        localStorage.setItem(CONFIG.TOKEN_STORAGE_KEY, token);
        state.hasToken = true;
        console.log('✅ Token set via console');
    },
    clearToken: () => {
        localStorage.removeItem(CONFIG.TOKEN_STORAGE_KEY);
        state.hasToken = false;
        console.log('🗑️  Token cleared');
    },
    getConfig: () => state.currentConfig,
    version: '1.0.0 (Step 2)'
};

console.log('💡 Developer utilities available via: window.perfRunner');