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
// Test Triggering (Placeholder for Step 4)
// ============================================
function triggerTest(config) {
    showStatus('⏳ Preparing to trigger test...', 'info');
    
    console.log('📊 Test configuration:', config);
    
    // This will be implemented in Step 4
    setTimeout(() => {
        showStatus(
            '⚠️ Test triggering not yet implemented (Step 4)\n' +
            'Current configuration:\n' +
            JSON.stringify(config, null, 2),
            'info'
        );
    }, 500);
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