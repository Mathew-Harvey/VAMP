// VAMP - Vessel Asset Management Platform Frontend

// Global variables
let currentUser = null;
let currentView = 'assets';
let socket = null;
let workTypes = null;
let currentAsset = null;
let currentWork = null;

// Video streaming variables
let localStream = null;
let peers = new Map(); // Map of peer connections
let isVideoActive = false;
let isScreenSharing = false;

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
    
    // Video call events
    socket.on('user-joined-video', (data) => {
        console.log('User joined video:', data);
        handleUserJoinedVideo(data);
    });
    
    socket.on('user-left-video', (data) => {
        console.log('User left video:', data);
        handleUserLeftVideo(data);
    });
    
    socket.on('webrtc-offer', (data) => {
        console.log('Received WebRTC offer:', data);
        handleWebRTCOffer(data);
    });
    
    socket.on('webrtc-answer', (data) => {
        console.log('Received WebRTC answer:', data);
        handleWebRTCAnswer(data);
    });
    
    socket.on('webrtc-ice-candidate', (data) => {
        console.log('Received ICE candidate:', data);
        handleICECandidate(data);
    });
    
    socket.on('component-locked', (data) => {
        updateComponentLockStatus(data, true);
    });
    
    socket.on('component-unlocked', (data) => {
        updateComponentLockStatus(data, false);
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
    showAssetDetailView(assetId);
}

function showAssetDetailView(assetId) {
    fetch(`/api/assets/${assetId}`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load asset');
            }
            return response.json();
        })
        .then(data => {
            currentAsset = data.asset;
            displayAssetDetail(data);
        })
        .catch(error => {
            console.error('Load asset detail error:', error);
            alert('Failed to load asset details');
        });
}

function displayAssetDetail(data) {
    const { asset, components, recentWorks } = data;
    
    // Hide all views
    document.getElementById('assetsView').style.display = 'none';
    document.getElementById('worksView').style.display = 'none';
    document.getElementById('notificationsView').style.display = 'none';
    
    // Check if asset detail view exists, create if not
    let assetDetailView = document.getElementById('assetDetailView');
    if (!assetDetailView) {
        assetDetailView = document.createElement('div');
        assetDetailView.id = 'assetDetailView';
        assetDetailView.className = 'view-container';
        document.querySelector('.flex-grow-1').appendChild(assetDetailView);
    }
    
    assetDetailView.style.display = 'block';
    assetDetailView.innerHTML = generateAssetDetailHTML(asset, components, recentWorks);
}

function generateAssetDetailHTML(asset, components, recentWorks) {
    return `
        <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
            <div class="d-flex align-items-center">
                <button class="btn btn-outline-secondary me-3" onclick="backToAssets()">
                    <i class="bi bi-arrow-left"></i>
                </button>
                <div>
                    <h5 class="mb-0">${asset.name}</h5>
                    <small class="text-muted">${asset.type} vessel</small>
                </div>
            </div>
            <div>
                <button class="btn btn-outline-primary me-2" onclick="editAssetMetadata(${asset.id})">
                    <i class="bi bi-pencil me-1"></i>Edit Details
                </button>
                <button class="btn btn-primary" onclick="addComponent(${asset.id})">
                    <i class="bi bi-plus-circle me-1"></i>Add Component
                </button>
            </div>
        </div>
        
        <div class="container-fluid p-4">
            <div class="row">
                <!-- Asset Info Panel -->
                <div class="col-md-4">
                    <div class="card h-100">
                        <div class="card-header">
                            <h6 class="mb-0">Asset Information</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <strong>Owner:</strong> ${asset.owner_name}
                            </div>
                            <div class="mb-3">
                                <strong>Created:</strong> ${new Date(asset.created_at).toLocaleDateString()}
                            </div>
                            <div class="mb-3">
                                <strong>Last Updated:</strong> ${new Date(asset.updated_at).toLocaleDateString()}
                            </div>
                            ${asset.metadata && asset.metadata.vessel_details ? generateVesselDetailsHTML(asset.metadata) : ''}
                        </div>
                    </div>
                    
                    <!-- Recent Works -->
                    <div class="card mt-3">
                        <div class="card-header">
                            <h6 class="mb-0">Recent Works</h6>
                        </div>
                        <div class="card-body">
                            ${generateRecentWorksHTML(recentWorks)}
                        </div>
                    </div>
                </div>
                
                <!-- Components Panel -->
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">Components</h6>
                            <small class="text-muted">${components.length} components</small>
                        </div>
                        <div class="card-body">
                            <div id="componentsTree">
                                ${renderComponentsTree(components)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateVesselDetailsHTML(metadata) {
    const vessel = metadata.vessel_details;
    const specs = metadata.specifications;
    return `
        <hr>
        <h6>Vessel Details</h6>
        ${vessel.imo_number ? `<div><strong>IMO:</strong> ${vessel.imo_number}</div>` : ''}
        ${vessel.flag ? `<div><strong>Flag:</strong> ${vessel.flag}</div>` : ''}
        ${vessel.build_year ? `<div><strong>Built:</strong> ${vessel.build_year}</div>` : ''}
        ${specs && specs.gross_tonnage ? `<div><strong>GT:</strong> ${specs.gross_tonnage}</div>` : ''}
    `;
}

function generateRecentWorksHTML(recentWorks) {
    if (recentWorks.length === 0) {
        return '<div class="text-muted">No recent works</div>';
    }
    
    return recentWorks.map(work => `
        <div class="border-bottom pb-2 mb-2">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${work.work_type}</strong>
                    <br>
                    <small class="text-muted">${work.initiated_by_name}</small>
                </div>
                <span class="badge status-badge status-${work.status}">${work.status.replace('_', ' ')}</span>
            </div>
            <small class="text-muted">${new Date(work.created_at).toLocaleDateString()}</small>
        </div>
    `).join('');
}

function renderComponentsTree(components) {
    if (components.length === 0) {
        return '<div class="text-center text-muted py-4">No components found. <a href="#" onclick="addComponent(' + currentAsset.id + ')">Add your first component</a></div>';
    }
    
    // Organize components by parent
    const parentComponents = components.filter(c => !c.parent_id);
    const childComponents = components.filter(c => c.parent_id);
    const componentMap = {};
    
    childComponents.forEach(child => {
        if (!componentMap[child.parent_id]) {
            componentMap[child.parent_id] = [];
        }
        componentMap[child.parent_id].push(child);
    });
    
    return `
        <div class="accordion" id="componentsAccordion">
            ${parentComponents.map(parent => renderParentComponent(parent, componentMap[parent.id] || [])).join('')}
        </div>
    `;
}

function renderParentComponent(parent, children) {
    return `
        <div class="accordion-item">
            <h2 class="accordion-header">
                <button class="accordion-button ${children.length > 0 ? '' : 'collapsed'}" type="button" 
                        data-bs-toggle="collapse" data-bs-target="#collapse${parent.id}">
                    <div class="d-flex justify-content-between align-items-center w-100 me-3">
                        <span><i class="bi bi-gear me-2"></i>${parent.name}</span>
                        <div class="component-actions">
                            <button class="btn btn-sm btn-outline-primary me-2" onclick="event.stopPropagation(); editComponent(${parent.id})" 
                                    title="Edit component">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-success me-2" onclick="event.stopPropagation(); addChildComponent(${parent.id})" 
                                    title="Add child component">
                                <i class="bi bi-plus"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); deleteComponent(${parent.id})" 
                                    title="Delete component">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </button>
            </h2>
            <div id="collapse${parent.id}" class="accordion-collapse collapse ${children.length > 0 ? 'show' : ''}" 
                 data-bs-parent="#componentsAccordion">
                <div class="accordion-body">
                    ${children.length > 0 ? children.map(child => renderChildComponent(child)).join('') : '<div class="text-muted">No sub-components</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderChildComponent(child) {
    const fieldsCount = child.capture_fields_json ? JSON.parse(child.capture_fields_json).length : 0;
    return `
        <div class="d-flex justify-content-between align-items-center p-2 border rounded mb-2">
            <div>
                <i class="bi bi-wrench me-2"></i>${child.name}
                <small class="text-muted ms-2">${fieldsCount} fields</small>
            </div>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-primary" onclick="editComponent(${child.id})" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-outline-danger" onclick="deleteComponent(${child.id})" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function backToAssets() {
    document.getElementById('assetDetailView').style.display = 'none';
    showAssets();
}

function addComponent(assetId, parentId = null) {
    alert('Component management coming soon!');
}

function addChildComponent(parentId) {
    alert('Child component management coming soon!');
}

function editComponent(componentId) {
    alert('Component editing coming soon!');
}

function deleteComponent(componentId) {
    alert('Component deletion coming soon!');
}

function editAssetMetadata(assetId) {
    alert('Asset metadata editing coming soon!');
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
    showWorkDetailView(workId);
}

function showWorkDetailView(workId) {
    fetch(`/api/works/${workId}`, { credentials: 'include' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load work');
            }
            return response.json();
        })
        .then(data => {
            currentWork = data.work;
            displayWorkDetail(data);
            
            // Join the work room for real-time updates
            if (socket && socket.connected) {
                socket.emit('join-work', workId);
            }
        })
        .catch(error => {
            console.error('Load work detail error:', error);
            alert('Failed to load work details');
        });
}

function displayWorkDetail(data) {
    const { work, components, evidence, team, locks } = data;
    
    // Hide all views
    document.getElementById('assetsView').style.display = 'none';
    document.getElementById('worksView').style.display = 'none';
    document.getElementById('notificationsView').style.display = 'none';
    if (document.getElementById('assetDetailView')) {
        document.getElementById('assetDetailView').style.display = 'none';
    }
    
    // Check if work detail view exists, create if not
    let workDetailView = document.getElementById('workDetailView');
    if (!workDetailView) {
        workDetailView = document.createElement('div');
        workDetailView.id = 'workDetailView';
        workDetailView.className = 'view-container';
        document.querySelector('.flex-grow-1').appendChild(workDetailView);
    }
    
    workDetailView.style.display = 'block';
    workDetailView.innerHTML = generateWorkDetailHTML(work, components, evidence, team, locks);
}

function generateWorkDetailHTML(work, components, evidence, team, locks) {
    const workTypeInfo = workTypes.find(wt => wt.type === work.work_type);
    const canEdit = work.initiated_by === currentUser.id || currentUser.role === 'super_admin';
    
    return `
        <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
            <div class="d-flex align-items-center">
                <button class="btn btn-outline-secondary me-3" onclick="backToWorks()">
                    <i class="bi bi-arrow-left"></i>
                </button>
                <div>
                    <h5 class="mb-0">${workTypeInfo ? workTypeInfo.display_name : work.work_type}</h5>
                    <small class="text-muted">${work.asset_name}</small>
                </div>
            </div>
            <div class="d-flex align-items-center">
                <span class="badge status-badge status-${work.status} me-3">${work.status.replace('_', ' ')}</span>
                ${generateWorkActionButtons(work, canEdit)}
            </div>
        </div>
        
        <div class="container-fluid p-4">
            <div class="row">
                <!-- Work Info Panel -->
                <div class="col-md-4">
                    <div class="card mb-3">
                        <div class="card-header">
                            <h6 class="mb-0">Work Information</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-2"><strong>Initiated by:</strong> ${work.initiated_by_name}</div>
                            <div class="mb-2"><strong>Created:</strong> ${new Date(work.created_at).toLocaleDateString()}</div>
                            ${work.started_at ? `<div class="mb-2"><strong>Started:</strong> ${new Date(work.started_at).toLocaleDateString()}</div>` : ''}
                            ${work.completed_at ? `<div class="mb-2"><strong>Completed:</strong> ${new Date(work.completed_at).toLocaleDateString()}</div>` : ''}
                            ${work.client_name ? `<div class="mb-2"><strong>Client:</strong> ${work.client_name}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- Team Members -->
                    <div class="card mb-3">
                        <div class="card-header">
                            <h6 class="mb-0">Team Members (${team.length})</h6>
                        </div>
                        <div class="card-body">
                            ${team.length > 0 ? team.map(member => `
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <div>
                                        <strong>${member.name}</strong>
                                        <br><small class="text-muted">${member.email}</small>
                                    </div>
                                    <span class="badge bg-secondary">${member.permission_type}</span>
                                </div>
                            `).join('') : '<div class="text-muted">No team members</div>'}
                        </div>
                    </div>
                    
                    <!-- Video Panel -->
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Video Conference</h6>
                        </div>
                        <div class="card-body">
                            <div id="videoContainer" class="mb-3" style="min-height: 200px; background: #f8f9fa; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center;">
                                <div class="text-center text-muted">
                                    <i class="bi bi-camera-video-off fs-1"></i>
                                    <div>Video not active</div>
                                </div>
                            </div>
                            <div class="d-flex justify-content-center gap-2">
                                <button class="btn btn-primary btn-sm" onclick="startVideo()">
                                    <i class="bi bi-camera-video me-1"></i>Start Video
                                </button>
                                <button class="btn btn-outline-primary btn-sm" onclick="shareScreen()">
                                    <i class="bi bi-display me-1"></i>Share Screen
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Components Panel -->
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="mb-0">Components & Evidence (${components.filter(c => !c.parent_id).length} main)</h6>
                        </div>
                        <div class="card-body">
                            <div id="workComponentsAccordion">
                                ${renderWorkComponents(components, evidence, locks, work.status)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateWorkActionButtons(work, canEdit) {
    if (!canEdit) return '';
    
    switch (work.status) {
        case 'draft':
            return `<button class="btn btn-success" onclick="startWork(${work.id})">
                        <i class="bi bi-play-circle me-1"></i>Start Work
                    </button>`;
        case 'in_progress':
            return `<button class="btn btn-primary" onclick="completeWork(${work.id})">
                        <i class="bi bi-check-circle me-1"></i>Complete Work
                    </button>`;
        default:
            return '';
    }
}

function renderWorkComponents(components, evidence, locks, workStatus) {
    if (components.length === 0) {
        return '<div class="text-center text-muted py-4">No components found for this work</div>';
    }
    
    // Organize components by parent and evidence by component
    const parentComponents = components.filter(c => !c.parent_id);
    const evidenceMap = {};
    const lockMap = {};
    
    evidence.forEach(ev => {
        if (!evidenceMap[ev.component_id]) {
            evidenceMap[ev.component_id] = [];
        }
        evidenceMap[ev.component_id].push(ev);
    });
    
    locks.forEach(lock => {
        lockMap[lock.component_id] = lock;
    });
    
    return `
        <div class="accordion">
            ${parentComponents.map((parent, index) => `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#workCollapse${parent.id}">
                            <div class="d-flex justify-content-between align-items-center w-100 me-3">
                                <span>
                                    <i class="bi bi-gear me-2"></i>${parent.name}
                                    ${lockMap[parent.id] ? `<i class="bi bi-lock-fill ms-2 text-danger" title="Locked by ${lockMap[parent.id].locked_by_name}"></i>` : ''}
                                </span>
                                <small class="text-muted">${evidenceMap[parent.id] ? evidenceMap[parent.id].length : 0} evidence</small>
                            </div>
                        </button>
                    </h2>
                    <div id="workCollapse${parent.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                         data-bs-parent="#workComponentsAccordion">
                        <div class="accordion-body">
                            <div class="text-center py-4">
                                <div class="text-muted mb-3">Component evidence collection interface</div>
                                <button class="btn btn-outline-primary" onclick="editWorkComponent(${parent.id})">
                                    <i class="bi bi-plus-circle me-1"></i>Add Evidence
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function backToWorks() {
    if (currentWork && socket && socket.connected) {
        socket.emit('leave-work', currentWork.id);
    }
    document.getElementById('workDetailView').style.display = 'none';
    showWorks();
}

function startWork(workId) {
    if (!confirm('Are you sure you want to start this work? This will change the status to "In Progress".')) {
        return;
    }
    
    fetch(`/api/works/${workId}/start`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => {
        if (response.ok) {
            showWorkDetailView(workId); // Refresh the view
        } else {
            return response.json().then(data => {
                alert(data.error || 'Failed to start work');
            });
        }
    })
    .catch(error => {
        console.error('Start work error:', error);
        alert('Failed to start work');
    });
}

function completeWork(workId) {
    if (!confirm('Are you sure you want to complete this work? This cannot be undone.')) {
        return;
    }
    
    fetch(`/api/works/${workId}/complete`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => {
        if (response.ok) {
            showWorkDetailView(workId); // Refresh the view
        } else {
            return response.json().then(data => {
                alert(data.error || 'Failed to complete work');
            });
        }
    })
    .catch(error => {
        console.error('Complete work error:', error);
        alert('Failed to complete work');
    });
}

function editWorkComponent(componentId) {
    alert('Component evidence editing coming soon!');
}

async function startVideo() {
    try {
        if (isVideoActive) {
            stopVideo();
            return;
        }

        // Get user media
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Update UI
        isVideoActive = true;
        updateVideoUI();
        
        // Add local video to container
        addVideoStream('local', localStream, currentUser.name + ' (You)');
        
        // Add screenshot controls
        setTimeout(() => {
            addScreenshotControls();
        }, 100);
        
        // Join video room via socket
        if (socket && currentWork) {
            socket.emit('join-video-room', {
                workId: currentWork.id,
                userId: currentUser.id,
                userName: currentUser.name
            });
        }

    } catch (error) {
        console.error('Failed to start video:', error);
        alert('Failed to access camera/microphone. Please check permissions.');
    }
}

function stopVideo() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Close all peer connections
    peers.forEach(peer => {
        peer.destroy();
    });
    peers.clear();
    
    isVideoActive = false;
    isScreenSharing = false;
    updateVideoUI();
    clearVideoContainer();
    
    // Leave video room
    if (socket && currentWork) {
        socket.emit('leave-video-room', {
            workId: currentWork.id,
            userId: currentUser.id
        });
    }
}

async function shareScreen() {
    try {
        if (isScreenSharing) {
            // Stop screen sharing and return to camera
            await startVideo();
            return;
        }

        if (!isVideoActive) {
            alert('Please start video first');
            return;
        }

        // Get screen share stream
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'always',
                displaySurface: 'monitor'
            },
            audio: false
        });

        // Replace video track in local stream
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = localStream.getVideoTracks()[0];
        
        // Update local stream
        localStream.removeTrack(localStream.getVideoTracks()[0]);
        localStream.addTrack(videoTrack);
        
        // Update all peer connections
        peers.forEach(peer => {
            peer.replaceTrack(sender, videoTrack, localStream);
        });
        
        // Update local video display
        const localVideo = document.getElementById('video-local');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        isScreenSharing = true;
        updateVideoUI();
        
        // Listen for screen share end
        videoTrack.addEventListener('ended', () => {
            isScreenSharing = false;
            updateVideoUI();
            // Optionally restart camera
            startVideo();
        });

    } catch (error) {
        console.error('Failed to share screen:', error);
        alert('Failed to share screen. Please check permissions.');
    }
}

function updateVideoUI() {
    const startBtn = document.getElementById('startVideoBtn');
    const shareBtn = document.getElementById('shareScreenBtn');
    
    if (startBtn) {
        if (isVideoActive) {
            startBtn.innerHTML = '<i class="bi bi-camera-video-off me-1"></i>Stop Video';
            startBtn.className = 'btn btn-danger btn-sm';
        } else {
            startBtn.innerHTML = '<i class="bi bi-camera-video me-1"></i>Start Video';
            startBtn.className = 'btn btn-primary btn-sm';
        }
    }
    
    if (shareBtn) {
        shareBtn.disabled = !isVideoActive;
        if (isScreenSharing) {
            shareBtn.innerHTML = '<i class="bi bi-display-fill me-1"></i>Stop Share';
            shareBtn.className = 'btn btn-warning btn-sm';
        } else {
            shareBtn.innerHTML = '<i class="bi bi-display me-1"></i>Share Screen';
            shareBtn.className = 'btn btn-outline-primary btn-sm';
        }
    }
}

function addVideoStream(peerId, stream, userName) {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    // Clear placeholder content if this is the first video
    const placeholder = videoContainer.querySelector('.text-center');
    if (placeholder) {
        placeholder.remove();
    }
    
    // Create video element
    const videoWrapper = document.createElement('div');
    videoWrapper.id = `video-wrapper-${peerId}`;
    videoWrapper.className = 'video-participant position-relative';
    
    const video = document.createElement('video');
    video.id = `video-${peerId}`;
    video.className = 'video-stream';
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = peerId === 'local'; // Mute local video to avoid echo
    video.playsInline = true;
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'video-name position-absolute bottom-0 start-0 text-white bg-dark bg-opacity-50 px-2 py-1 small';
    nameLabel.textContent = userName;
    
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(nameLabel);
    videoContainer.appendChild(videoWrapper);
    
    // Update grid layout
    updateVideoGrid();
    
    // Refresh screenshot controls if they exist
    if (isVideoActive) {
        setTimeout(() => {
            addScreenshotControls();
        }, 100);
    }
}

function removeVideoStream(peerId) {
    const videoWrapper = document.getElementById(`video-wrapper-${peerId}`);
    if (videoWrapper) {
        videoWrapper.remove();
        updateVideoGrid();
    }
    
    // If no videos left, show placeholder
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer && videoContainer.children.length === 0) {
        clearVideoContainer();
    }
}

function updateVideoGrid() {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer) return;
    
    const participants = videoContainer.querySelectorAll('.video-participant');
    const count = participants.length;
    
    if (count === 0) return;
    
    let gridCols = 1;
    let gridRows = 1;
    
    if (count <= 2) {
        gridCols = count;
    } else if (count <= 4) {
        gridCols = 2;
        gridRows = 2;
    } else {
        gridCols = 3;
        gridRows = Math.ceil(count / 3);
    }
    
    videoContainer.style.display = 'grid';
    videoContainer.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
    videoContainer.style.gap = '0.5rem';
    videoContainer.style.padding = '0.5rem';
    videoContainer.style.minHeight = `${Math.max(200, gridRows * 150)}px`;
}

function clearVideoContainer() {
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) {
        videoContainer.innerHTML = `
            <div class="d-flex align-items-center justify-content-center h-100 text-muted">
                <div class="text-center">
                    <i class="bi bi-camera-video-off fs-1"></i>
                    <div>Video not active</div>
                </div>
            </div>
        `;
        videoContainer.style.display = 'flex';
        videoContainer.style.gridTemplateColumns = '';
        videoContainer.style.minHeight = '200px';
    }
}

// Screenshot functionality for evidence capture
function captureVideoScreenshot() {
    if (!isVideoActive || !localStream) {
        alert('Video must be active to capture screenshots');
        return;
    }
    
    const video = document.getElementById('video-local');
    if (!video) return;
    
    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob and save as evidence
    canvas.toBlob(blob => {
        if (blob && currentWork) {
            saveScreenshotAsEvidence(blob);
        }
    }, 'image/jpeg', 0.9);
}

function saveScreenshotAsEvidence(blob) {
    if (!currentWork) {
        alert('No active work to save evidence to');
        return;
    }
    
    // Create a form data object with the screenshot
    const formData = new FormData();
    formData.append('files', blob, `screenshot_${Date.now()}.jpg`);
    formData.append('componentId', 'screenshot'); // Special component for screenshots
    formData.append('fieldName', 'video_screenshot');
    formData.append('evidenceType', 'video_screenshot');
    formData.append('value', 'Video call screenshot');
    
    // Save as evidence
    fetch(`/api/works/${currentWork.id}/evidence`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => {
        if (response.ok) {
            showNotification('Screenshot saved as evidence!', 'success');
        } else {
            return response.json().then(data => {
                alert(data.error || 'Failed to save screenshot');
            });
        }
    })
    .catch(error => {
        console.error('Save screenshot error:', error);
        alert('Failed to save screenshot');
    });
}

// Enhanced screenshot functionality with multiple capture options
function captureScreenshot(source = 'local') {
    if (!isVideoActive) {
        alert('Video must be active to capture screenshots');
        return;
    }
    
    let video;
    let filename;
    
    if (source === 'local') {
        video = document.getElementById('video-local');
        filename = `local_screenshot_${Date.now()}.jpg`;
    } else {
        // Capture from remote participant
        video = document.getElementById(`video-${source}`);
        filename = `remote_screenshot_${source}_${Date.now()}.jpg`;
    }
    
    if (!video) {
        alert('Video element not found');
        return;
    }
    
    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || video.clientWidth;
    canvas.height = video.videoHeight || video.clientHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Add timestamp and metadata overlay
    addScreenshotOverlay(ctx, canvas, source);
    
    // Convert to blob and save as evidence
    canvas.toBlob(blob => {
        if (blob) {
            saveScreenshotAsEvidence(blob);
            showScreenshotPreview(canvas.toDataURL());
        }
    }, 'image/jpeg', 0.9);
}

function addScreenshotOverlay(ctx, canvas, source) {
    // Add timestamp
    const now = new Date();
    const timestamp = now.toLocaleString();
    
    // Set overlay style
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(10, canvas.height - 60, 300, 50);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px Arial';
    ctx.fillText(`VAMP Screenshot - ${timestamp}`, 20, canvas.height - 35);
    ctx.fillText(`Source: ${source === 'local' ? 'Local Video' : `Remote User ${source}`}`, 20, canvas.height - 15);
    
    if (currentWork) {
        ctx.fillText(`Work: ${currentWork.work_type} - ${currentWork.asset_name}`, 20, canvas.height - 55);
    }
}

function showScreenshotPreview(dataURL) {
    // Create a temporary preview modal
    const previewModal = document.createElement('div');
    previewModal.className = 'modal fade';
    previewModal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Screenshot Captured</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${dataURL}" alt="Screenshot" class="img-fluid mb-3" style="max-height: 400px;">
                    <p class="text-success"><i class="bi bi-check-circle me-2"></i>Screenshot saved as evidence!</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" onclick="captureAnotherScreenshot()">Capture Another</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(previewModal);
    const modal = new bootstrap.Modal(previewModal);
    modal.show();
    
    // Clean up when modal closes
    previewModal.addEventListener('hidden.bs.modal', function() {
        previewModal.remove();
    });
}

function captureAnotherScreenshot() {
    const modal = bootstrap.Modal.getInstance(document.querySelector('.modal.show'));
    if (modal) {
        modal.hide();
    }
    captureScreenshot();
}

// Add screenshot button to video controls
function addScreenshotControls() {
    const videoContainer = document.getElementById('videoContainer');
    if (!videoContainer || !isVideoActive) return;
    
    // Remove existing screenshot controls
    const existingControls = videoContainer.querySelector('.screenshot-controls');
    if (existingControls) {
        existingControls.remove();
    }
    
    // Add screenshot controls overlay
    const screenshotControls = document.createElement('div');
    screenshotControls.className = 'screenshot-controls position-absolute top-0 end-0 m-2';
    screenshotControls.innerHTML = `
        <div class="btn-group-vertical">
            <button class="btn btn-sm btn-light opacity-75" onclick="captureScreenshot('local')" 
                    title="Capture local video screenshot">
                <i class="bi bi-camera"></i>
            </button>
            <div class="dropdown">
                <button class="btn btn-sm btn-light opacity-75 dropdown-toggle" type="button" 
                        data-bs-toggle="dropdown" title="Capture from participants">
                    <i class="bi bi-people"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    ${Array.from(peers.keys()).map(peerId => `
                        <li><a class="dropdown-item" href="#" onclick="captureScreenshot('${peerId}')">
                            <i class="bi bi-person me-2"></i>User ${peerId}
                        </a></li>
                    `).join('')}
                </ul>
            </div>
        </div>
    `;
    
    videoContainer.appendChild(screenshotControls);
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// WebRTC peer connection handlers
async function handleUserJoinedVideo(data) {
    const { userId, userName } = data;
    
    if (userId === currentUser.id || !localStream) {
        return; // Don't create peer for self or if we're not streaming
    }
    
    try {
        // Create peer connection for the new user
        const peer = createPeerConnection(userId);
        peers.set(userId, peer);
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });
        
        // Create and send offer
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        
        socket.emit('webrtc-offer', {
            workId: currentWork.id,
            from: currentUser.id,
            to: userId,
            offer: offer
        });
        
    } catch (error) {
        console.error('Error handling user joined video:', error);
    }
}

function handleUserLeftVideo(data) {
    const { userId } = data;
    
    if (peers.has(userId)) {
        const peer = peers.get(userId);
        peer.close();
        peers.delete(userId);
        removeVideoStream(userId);
    }
}

async function handleWebRTCOffer(data) {
    const { from, offer } = data;
    
    if (!localStream) {
        return; // We're not in the call
    }
    
    try {
        // Create peer connection for the offering user
        const peer = createPeerConnection(from);
        peers.set(from, peer);
        
        // Add local stream to peer connection
        localStream.getTracks().forEach(track => {
            peer.addTrack(track, localStream);
        });
        
        // Set remote description and create answer
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        
        // Send answer back
        socket.emit('webrtc-answer', {
            workId: currentWork.id,
            from: currentUser.id,
            to: from,
            answer: answer
        });
        
    } catch (error) {
        console.error('Error handling WebRTC offer:', error);
    }
}

async function handleWebRTCAnswer(data) {
    const { from, answer } = data;
    
    const peer = peers.get(from);
    if (peer) {
        try {
            await peer.setRemoteDescription(answer);
        } catch (error) {
            console.error('Error handling WebRTC answer:', error);
        }
    }
}

function handleICECandidate(data) {
    const { from, candidate } = data;
    
    const peer = peers.get(from);
    if (peer) {
        try {
            peer.addIceCandidate(candidate);
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
}

function createPeerConnection(userId) {
    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };
    
    const peer = new RTCPeerConnection(configuration);
    
    // Handle remote stream
    peer.ontrack = (event) => {
        console.log('Received remote stream from:', userId);
        const [remoteStream] = event.streams;
        addVideoStream(userId, remoteStream, `User ${userId}`);
    };
    
    // Handle ICE candidates
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc-ice-candidate', {
                workId: currentWork.id,
                from: currentUser.id,
                to: userId,
                candidate: event.candidate
            });
        }
    };
    
    // Handle connection state changes
    peer.onconnectionstatechange = () => {
        console.log(`Peer connection state with ${userId}:`, peer.connectionState);
        
        if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
            removeVideoStream(userId);
            peers.delete(userId);
        }
    };
    
    return peer;
}

function updateComponentLockStatus(data, isLocked) {
    const { componentId, lockedBy, lockedByName } = data;
    
    // Update UI to show lock status
    const componentElement = document.querySelector(`[data-component-id="${componentId}"]`);
    if (componentElement) {
        if (isLocked) {
            componentElement.classList.add('component-locked');
            const lockIcon = componentElement.querySelector('.lock-indicator');
            if (!lockIcon) {
                const icon = document.createElement('i');
                icon.className = 'bi bi-lock-fill text-danger lock-indicator';
                icon.title = `Locked by ${lockedByName}`;
                componentElement.appendChild(icon);
            }
        } else {
            componentElement.classList.remove('component-locked');
            const lockIcon = componentElement.querySelector('.lock-indicator');
            if (lockIcon) {
                lockIcon.remove();
            }
        }
    }
    
    // Update work detail view if visible
    if (currentWork && document.getElementById('workDetailView').style.display !== 'none') {
        // Refresh the components section
        showWorkDetailView(currentWork.id);
    }
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
