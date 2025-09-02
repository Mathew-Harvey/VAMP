// VAMP - Vessel Asset Management Platform Frontend

// Global variables
let currentUser = null;
let currentView = 'assets';
let socket = null;
let workTypes = null;

// DOM elements
const authModal = new bootstrap.Modal(document.getElementById('authModal'));
const newAssetModal = new bootstrap.Modal(document.getElementById('newAssetModal'));
const newWorkModal = new bootstrap.Modal(document.getElementById('newWorkModal'));

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Load work types configuration
    fetch('/config/work_types.json')
        .then(response => response.json())
        .then(data => {
            workTypes = data.work_types;
        })
        .catch(error => {
            console.error('Failed to load work types:', error);
        });

    // Check authentication status
    checkAuthStatus();

    // Initialize socket connection
    initializeSocket();

    // Set up event listeners
    setupEventListeners();
}

function checkAuthStatus() {
    console.log('Checking auth status...');
    fetch('/api/auth/session', {
        credentials: 'include' // Include cookies for session
    })
        .then(response => {
            console.log('Auth check response status:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Auth check response data:', data);
            if (data.user) {
                currentUser = data.user;
                showMainApp();
                loadInitialData();
            } else {
                showAuthModal();
            }
        })
        .catch(error => {
            console.error('Auth check failed:', error);
            showAuthModal();
        });
}

function showAuthModal() {
    document.getElementById('mainApp').style.display = 'none';
    authModal.show();
}

function showMainApp() {
    authModal.hide();
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userName').textContent = currentUser.name;
    updateNavigation('assets');
}

function initializeSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });

    // Presence updates
    socket.on('presence-update', (data) => {
        updatePresenceIndicators(data);
    });

    // Lock updates
    socket.on('lock-update', (data) => {
        updateLockIndicators(data);
    });
}

function setupEventListeners() {
    // Login form
    document.getElementById('loginFormData').addEventListener('submit', handleLogin);

    // Register form
    document.getElementById('registerFormData').addEventListener('submit', handleRegister);

    // Search inputs
    document.getElementById('assetSearch').addEventListener('input', debounce(loadAssets, 300));
    document.getElementById('workSearch').addEventListener('input', debounce(loadWorks, 300));

    // Filter changes
    document.getElementById('assetTypeFilter').addEventListener('change', loadAssets);
    document.getElementById('workStatusFilter').addEventListener('change', loadWorks);
}

// Authentication functions
function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ email, password, rememberMe })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Login failed');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.user) {
            console.log('Login successful:', data.user);
            // Add a small delay to ensure session is saved before checking
            setTimeout(() => {
                checkAuthStatus();
            }, 100);
        } else {
            alert(data.error || 'Login failed');
        }
    })
    .catch(error => {
        console.error('Login error:', error);
        alert(error.message || 'Login failed. Please try again.');
    });
}

function handleRegister(e) {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({ name, email, password })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Registration failed');
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('Registration successful:', data);
        alert('Registration successful! Please login.');
        showLogin();
    })
    .catch(error => {
        console.error('Registration error:', error);
        alert(error.message || 'Registration failed. Please try again.');
    });
}

function logout() {
    fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    })
        .then(() => {
            currentUser = null;
            location.reload();
        })
        .catch(error => {
            console.error('Logout error:', error);
            location.reload();
        });
}

function showLogin() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// Navigation functions
function updateNavigation(view) {
    currentView = view;

    // Update nav pills
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const activeLink = document.querySelector(`[onclick*="${view}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Show/hide views
    document.getElementById('assetsView').style.display = view === 'assets' ? 'block' : 'none';
    document.getElementById('worksView').style.display = view === 'works' ? 'block' : 'none';
    document.getElementById('notificationsView').style.display = view === 'notifications' ? 'block' : 'none';
}

function showAssets() {
    updateNavigation('assets');
    loadAssets();
}

function showWorks() {
    updateNavigation('works');
    loadWorks();
}

function showNotifications() {
    updateNavigation('notifications');
    loadNotifications();
}

function loadInitialData() {
    loadAssets();
    loadNotifications();
}

// Asset functions
function loadAssets() {
    const search = document.getElementById('assetSearch').value;
    const type = document.getElementById('assetTypeFilter').value;

    let url = '/api/assets?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (type) url += `type=${encodeURIComponent(type)}&`;

    fetch(url, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            displayAssets(data.assets);
        })
        .catch(error => {
            console.error('Load assets error:', error);
        });
}

function displayAssets(assets) {
    const container = document.getElementById('assetsList');

    if (assets.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="text-center text-muted py-5">No assets found</div></div>';
        return;
    }

    container.innerHTML = assets.map(asset => `
        <div class="col-md-6 col-lg-4">
            <div class="card asset-card h-100" onclick="viewAsset(${asset.id})">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${asset.name}</h6>
                        <span class="badge bg-secondary">${asset.type}</span>
                    </div>
                    <p class="card-text text-muted small">Owner: ${asset.owner_name}</p>
                    <p class="card-text text-muted small">
                        Created: ${new Date(asset.created_at).toLocaleDateString()}
                    </p>
                </div>
                <div class="card-footer bg-transparent">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Click to view details</small>
                        <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showNewAssetModal() {
    document.getElementById('newAssetForm').reset();
    newAssetModal.show();
}

function createAsset() {
    const name = document.getElementById('assetName').value;
    const type = document.getElementById('assetType').value;
    const importTemplate = document.getElementById('importTemplate').checked;

    fetch('/api/assets', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, type, importTemplate })
    })
    .then(response => {
        if (response.ok) {
            return response.json().then(data => {
                newAssetModal.hide();
                loadAssets();
            });
        } else {
            return response.json().then(data => {
                alert(data.error || 'Failed to create asset');
            });
        }
    })
    .catch(error => {
        console.error('Create asset error:', error);
        alert('Failed to create asset');
    });
}

function viewAsset(assetId) {
    // TODO: Implement asset detail view
    alert(`View asset ${assetId} - Coming soon!`);
}

// Work functions
function loadWorks() {
    const search = document.getElementById('workSearch').value;
    const status = document.getElementById('workStatusFilter').value;

    let url = '/api/works?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    fetch(url, { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            displayWorks(data.works);
        })
        .catch(error => {
            console.error('Load works error:', error);
        });
}

function displayWorks(works) {
    const container = document.getElementById('worksList');

    if (works.length === 0) {
        container.innerHTML = '<div class="col-12"><div class="text-center text-muted py-5">No works found</div></div>';
        return;
    }

    container.innerHTML = works.map(work => `
        <div class="col-md-6 col-lg-4">
            <div class="card work-card h-100" onclick="viewWork(${work.id})">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${work.work_type}</h6>
                        <span class="badge status-badge status-${work.status}">${work.status.replace('_', ' ')}</span>
                    </div>
                    <p class="card-text text-truncate-2">${work.asset_name}</p>
                    <p class="card-text text-muted small">
                        Created: ${new Date(work.created_at).toLocaleDateString()}
                    </p>
                    ${work.client_name ? `<p class="card-text text-muted small">Client: ${work.client_name}</p>` : ''}
                </div>
                <div class="card-footer bg-transparent">
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="text-muted">Click to view details</small>
                        <i class="bi bi-chevron-right"></i>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showNewWorkModal() {
    document.getElementById('newWorkForm').reset();
    loadAssetsForWork();
    updateWorkForm();
    newWorkModal.show();
}

function loadAssetsForWork() {
    fetch('/api/assets', { credentials: 'include' })
        .then(response => response.json())
        .then(data => {
            const select = document.getElementById('workAsset');
            select.innerHTML = '<option value="">Select Asset</option>' +
                data.assets.map(asset => `<option value="${asset.id}">${asset.name}</option>`).join('');
        })
        .catch(error => {
            console.error('Load assets for work error:', error);
        });
}

function updateWorkForm() {
    const workType = document.getElementById('workType').value;
    const workTypeData = workTypes.find(wt => wt.type === workType);

    if (!workTypeData) return;

    const fieldsContainer = document.getElementById('workFormFields');
    fieldsContainer.innerHTML = workTypeData.steps[0].fields.map(field => generateFormField(field)).join('');
}

function generateFormField(field) {
    const required = field.required ? 'required' : '';
    const label = `${field.label}${field.required ? ' *' : ''}`;

    switch (field.type) {
        case 'text':
        case 'email':
        case 'date':
        case 'number':
            return `
                <div class="mb-3">
                    <label for="${field.name}" class="form-label">${label}</label>
                    <input type="${field.type}" class="form-control" id="${field.name}"
                           ${required} ${field.placeholder ? `placeholder="${field.placeholder}"` : ''}
                           ${field.min ? `min="${field.min}"` : ''} ${field.max ? `max="${field.max}"` : ''}
                           ${field.step ? `step="${field.step}"` : ''}>
                </div>
            `;

        case 'select':
            return `
                <div class="mb-3">
                    <label for="${field.name}" class="form-label">${label}</label>
                    <select class="form-select" id="${field.name}" ${required}>
                        ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                    </select>
                </div>
            `;

        case 'textarea':
            return `
                <div class="mb-3">
                    <label for="${field.name}" class="form-label">${label}</label>
                    <textarea class="form-control" id="${field.name}" rows="${field.rows || 3}"
                              ${required} ${field.max_length ? `maxlength="${field.max_length}"` : ''}></textarea>
                </div>
            `;

        case 'checkbox':
            return `
                <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="${field.name}" ${required}>
                    <label class="form-check-label" for="${field.name}">${label}</label>
                </div>
            `;

        default:
            return '';
    }
}

function createWork() {
    const workType = document.getElementById('workType').value;
    const assetId = document.getElementById('workAsset').value;

    if (!workType || !assetId) {
        alert('Please fill in all required fields');
        return;
    }

    // Collect form data
    const setupData = {};
    const workTypeData = workTypes.find(wt => wt.type === workType);

    workTypeData.steps[0].fields.forEach(field => {
        const element = document.getElementById(field.name);
        if (element) {
            if (field.type === 'checkbox') {
                setupData[field.name] = element.checked;
            } else {
                setupData[field.name] = element.value;
            }
        }
    });

    fetch('/api/works', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            workType,
            assetId,
            setupData
        })
    })
    .then(response => {
        if (response.ok) {
            return response.json().then(data => {
                newWorkModal.hide();
                loadWorks();
            });
        } else {
            return response.json().then(data => {
                alert(data.error || 'Failed to create work');
            });
        }
    })
    .catch(error => {
        console.error('Create work error:', error);
        alert('Failed to create work');
    });
}

function viewWork(workId) {
    // TODO: Implement work detail view
    alert(`View work ${workId} - Coming soon!`);
}

// Notification functions
function loadNotifications() {
    // TODO: Implement notifications API
    document.getElementById('notificationsList').innerHTML = '<div class="text-center text-muted py-5">No notifications</div>';
}

// Utility functions
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

function updatePresenceIndicators(data) {
    // TODO: Implement presence indicators
    console.log('Presence update:', data);
}

function updateLockIndicators(data) {
    // TODO: Implement lock indicators
    console.log('Lock update:', data);
}

// Heartbeat for presence
setInterval(() => {
    if (socket && socket.connected && currentUser) {
        socket.emit('heartbeat', {
            userId: currentUser.id,
            action: 'online'
        });
    }
}, 1000);
