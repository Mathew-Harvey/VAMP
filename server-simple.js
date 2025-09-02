const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

// Simple in-memory data store for MVP
let users = [];
let assets = [];
let works = [];
let accessControl = [];
let presence = [];
let editLocks = [];
let evidence = [];
let auditLogs = [];
let notifications = [];
let videoRooms = []; // Track active video rooms
let nextUserId = 1;
let nextAssetId = 1;
let nextWorkId = 1;
let nextAccessId = 1;
let nextLockId = 1;
let nextEvidenceId = 1;
let nextAuditId = 1;
let nextNotificationId = 1;
let nextRoomId = 1;

// File upload configuration
const uploadDir = path.join(__dirname, 'uploads');
const tempDir = path.join(uploadDir, 'temp');
const worksDir = path.join(uploadDir, 'works');

// Ensure upload directories exist
[uploadDir, tempDir, worksDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Role definitions with permissions
const ROLES = {
  super_admin: {
    permissions: ['view_all', 'join_any_work', 'view_audit_log', 'manage_users', 'manage_assets', 'manage_works'],
    description: 'Can view all assets/works, manage users, join as observer'
  },
  owner: {
    permissions: ['create_asset', 'edit_asset', 'delete_asset', 'initiate_work', 'invite_users', 'manage_own_assets'],
    description: 'Full control over owned assets and works'
  },
  worker: {
    permissions: ['edit_invited_work', 'capture_evidence', 'join_video', 'view_assigned_work'],
    description: 'Can participate in assigned works'
  }
};

// File upload configuration
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocumentTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];

  if (allowedImageTypes.includes(file.mimetype) || allowedDocumentTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and Excel files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Maximum 10 files at once
  }
});

// Image processing function
async function processImage(buffer, filename, workId, componentId) {
  const workDir = path.join(worksDir, workId.toString(), componentId.toString());

  // Ensure work/component directory exists
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const fileExt = path.extname(filename);
  const baseName = path.basename(filename, fileExt);
  const processedFilename = `${baseName}_processed${fileExt}`;
  const outputPath = path.join(workDir, processedFilename);

  // Process image with Sharp
  await sharp(buffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({
      quality: 85,
      progressive: true
    })
    .toFile(outputPath);

  // Check file size and compress further if needed
  const stats = fs.statSync(outputPath);
  const targetSize = 300 * 1024; // 300KB

  if (stats.size > targetSize) {
    await sharp(outputPath)
      .jpeg({ quality: 70 })
      .toFile(outputPath);
  }

  return {
    path: outputPath,
    filename: processedFilename,
    size: fs.statSync(outputPath).size
  };
}

// File processing function
function processDocument(buffer, filename, workId, componentId) {
  const workDir = path.join(worksDir, workId.toString(), componentId.toString());

  // Ensure work/component directory exists
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const fileExt = path.extname(filename);
  const baseName = path.basename(filename, fileExt);
  const uniqueFilename = `${baseName}_${Date.now()}${fileExt}`;
  const outputPath = path.join(workDir, uniqueFilename);

  // Write file to disk
  fs.writeFileSync(outputPath, buffer);

  return {
    path: outputPath,
    filename: uniqueFilename,
    size: buffer.length
  };
}

// Audit logging functions
function logAudit(userId, action, resourceType, resourceId, details = null, ipAddress = null) {
  const auditEntry = {
    id: nextAuditId++,
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details: JSON.stringify(details),
    ip_address: ipAddress,
    timestamp: new Date(),
    user_agent: null // Would be populated from request headers in production
  };

  auditLogs.push(auditEntry);
  console.log(`AUDIT: User ${userId} performed ${action} on ${resourceType} ${resourceId}`);
}

// Notification functions
function createNotification(userId, type, title, message, entityType = null, entityId = null) {
  const notification = {
    id: nextNotificationId++,
    user_id: userId,
    type,
    title,
    message,
    entity_type: entityType,
    entity_id: entityId,
    is_read: false,
    created_at: new Date(),
    read_at: null
  };

  notifications.push(notification);

  // Emit real-time notification via Socket.io
  const userSockets = getUserSockets(userId);
  userSockets.forEach(socketId => {
    io.to(socketId).emit('notification', notification);
  });

  return notification;
}

function getUserSockets(userId) {
  return presence
    .filter(p => p.user_id === userId)
    .map(p => p.socket_id);
}

function notifyWorkInvite(work, invitedUserId, inviterUser) {
  const title = 'Work Invitation';
  const message = `${inviterUser.name} invited you to join "${work.work_type}" work on asset "${assets.find(a => a.id === work.asset_id)?.name}"`;

  createNotification(invitedUserId, 'work_invite', title, message, 'work', work.id);
}

function notifyWorkStarted(work, starterUser) {
  // Notify all users with access to this work
  const relevantUsers = accessControl
    .filter(ac => ac.work_id === work.id && ac.is_active && ac.user_id !== starterUser.id)
    .map(ac => ac.user_id);

  const title = 'Work Started';
  const message = `${starterUser.name} started work: ${work.work_type}`;

  relevantUsers.forEach(userId => {
    createNotification(userId, 'work_started', title, message, 'work', work.id);
  });
}

function notifyComponentLocked(componentId, workId, lockerUser) {
  // Notify other users in the same work
  const workUsers = presence
    .filter(p => p.work_id === workId && p.user_id !== lockerUser.id)
    .map(p => p.user_id)
    .filter((userId, index, arr) => arr.indexOf(userId) === index); // Remove duplicates

  const title = 'Component Locked';
  const message = `${lockerUser.name} locked component for editing`;

  workUsers.forEach(userId => {
    createNotification(userId, 'component_locked', title, message, 'work', workId);
  });
}

// Permission checking functions
function hasPermission(userId, permission, resourceId = null, resourceType = null) {
  const user = users.find(u => u.id === userId);
  if (!user) return false;

  const role = ROLES[user.role];
  if (!role) return false;

  // Super admin has all permissions
  if (role.permissions.includes('view_all') || role.permissions.includes(permission)) {
    return true;
  }

  // Check specific resource permissions
  if (resourceType === 'asset' && resourceId) {
    const asset = assets.find(a => a.id === resourceId);
    if (asset && asset.owner_id === userId && role.permissions.includes('manage_own_assets')) {
      return true;
    }

    // Check access control entries
    const accessEntry = accessControl.find(ac =>
      ac.user_id === userId &&
      ac.asset_id === resourceId &&
      ac.is_active &&
      (ac.permission_type === 'edit' || ac.permission_type === 'admin')
    );
    return !!accessEntry;
  }

  if (resourceType === 'work' && resourceId) {
    const work = works.find(w => w.id === resourceId);
    if (work && work.initiated_by === userId) {
      return true;
    }

    // Check access control entries
    const accessEntry = accessControl.find(ac =>
      ac.user_id === userId &&
      ac.work_id === resourceId &&
      ac.is_active &&
      (ac.permission_type === 'edit' || ac.permission_type === 'admin')
    );
    return !!accessEntry;
  }

  return false;
}

function requirePermission(permission, resourceType = null) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const resourceId = req.params.id || req.body.assetId || req.body.workId;
    const hasPerm = hasPermission(req.session.userId, permission, resourceId, resourceType);

    if (!hasPerm) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = users.find(u => u.id === req.session.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Initialize Express app
const app = express();

// Initialize HTTP server and Socket.io
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS : true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression({
  level: 6,
  threshold: 1000,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files with caching
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Serve config files
app.use('/config', express.static(path.join(__dirname, 'config')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'vamp-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Changed from 'strict' to allow cross-site requests
  }
}));

// Rate limiting (relaxed for development)
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Temporarily disable rate limiting for development
// app.use('/api/', limiter);

// Relaxed rate limiting for auth endpoints during development
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 auth requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Temporarily disable strict auth rate limiting
// app.use('/api/auth/', authLimiter);

// Input validation helpers
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

function validatePassword(password) {
  if (password.length < 6) return false; // Relaxed for easier testing
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) return false;
  return true;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    console.log('Registration attempt for:', email);

    // Input validation and sanitization
    if (!email || !name || !password) {
      console.log('Registration failed: missing required fields');
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedName = sanitizeInput(name);

    console.log('Sanitized email:', sanitizedEmail);
    console.log('Sanitized name:', sanitizedName);

    if (!validateEmail(sanitizedEmail)) {
      console.log('Registration failed: invalid email format');
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (sanitizedName.length < 2 || sanitizedName.length > 100) {
      console.log('Registration failed: invalid name length');
      return res.status(400).json({ error: 'Name must be between 2 and 100 characters' });
    }

    if (!validatePassword(password)) {
      console.log('Registration failed: invalid password');
      return res.status(400).json({
        error: 'Password must be at least 6 characters with uppercase, lowercase, and number'
      });
    }

    console.log('Password validation passed');

    // Check if user exists
    const existingUser = users.find(u => u.email.toLowerCase() === sanitizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password with higher rounds for security
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      id: nextUserId++,
      email: sanitizedEmail,
      name: sanitizedName,
      password_hash: passwordHash,
      role: 'owner',
      created_at: new Date(),
      last_login: null,
      is_active: true
    };

    users.push(user);
    logAudit(user.id, 'USER_REGISTER', 'user', user.id, { email: sanitizedEmail });
    console.log(`New user registered: ${sanitizedEmail}, ID: ${user.id}`);
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const sanitizedEmail = sanitizeInput(email).toLowerCase();

    if (!validateEmail(sanitizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = users.find(u => u.email.toLowerCase() === sanitizedEmail && u.is_active);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    user.last_login = new Date();

    req.session.userId = user.id;
    req.session.lastActivity = Date.now();

    console.log(`User logged in: ${sanitizedEmail}, ID: ${user.id}, Session ID: ${req.session.id}`);

    // Save the session before responding
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const userEmail = req.session.userId ? users.find(u => u.id === req.session.userId)?.email : 'unknown';
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    console.log(`User logged out: ${userEmail || 'unknown'}`);
    res.json({ message: 'Logged out successfully' });
  });
});

// Session timeout middleware
app.use('/api/', (req, res, next) => {
  if (req.session.userId && req.session.lastActivity) {
    const now = Date.now();
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    if (now - req.session.lastActivity > sessionTimeout) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Session timeout error:', err);
        }
        return res.status(401).json({ error: 'Session expired. Please login again.' });
      });
      return;
    }

    req.session.lastActivity = now;
  }
  next();
});

app.get('/api/auth/session', (req, res) => {
  console.log(`Session check - Session ID: ${req.session.id}, User ID: ${req.session.userId}`);
  if (req.session.userId) {
    const user = users.find(u => u.id === req.session.userId);
    if (user) {
      console.log(`Session valid for user: ${user.email}`);
      return res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } else {
      console.log(`Session user not found: ${req.session.userId}`);
    }
  }
  console.log('No active session');
  res.status(401).json({ error: 'No active session' });
});

// Asset routes
app.get('/api/assets', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = users.find(u => u.id === req.session.userId);
  let userAssets;

  if (user.role === 'super_admin') {
    // Super admin can see all assets
    userAssets = assets;
  } else {
    // Regular users see their own assets plus assets they have access to
    userAssets = assets.filter(a =>
      a.owner_id === req.session.userId ||
      accessControl.some(ac =>
        ac.user_id === req.session.userId &&
        ac.asset_id === a.id &&
        ac.is_active
      )
    );
  }

  res.json({ assets: userAssets });
});

app.post('/api/assets', requirePermission('create_asset'), (req, res) => {
  const { name, type, importTemplate } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  const sanitizedName = sanitizeInput(name);

  const asset = {
    id: nextAssetId++,
    name: sanitizedName,
    type,
    owner_id: req.session.userId,
    metadata_json: '{}',
    created_at: new Date(),
    is_deleted: false
  };

  assets.push(asset);
  logAudit(req.session.userId, 'ASSET_CREATE', 'asset', asset.id, { name: sanitizedName, type });
  console.log(`Asset created: ${sanitizedName} by user ${req.session.userId}`);
  res.status(201).json({ assetId: asset.id });
});

app.put('/api/assets/:id', requirePermission('edit_asset', 'asset'), (req, res) => {
  const assetId = parseInt(req.params.id);
  const { name, type } = req.body;

  const asset = assets.find(a => a.id === assetId && !a.is_deleted);
  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  if (name) asset.name = sanitizeInput(name);
  if (type) asset.type = type;

  asset.updated_at = new Date();
  console.log(`Asset updated: ${assetId} by user ${req.session.userId}`);
  res.json({ asset });
});

app.delete('/api/assets/:id', requirePermission('delete_asset', 'asset'), (req, res) => {
  const assetId = parseInt(req.params.id);
  const asset = assets.find(a => a.id === assetId && !a.is_deleted);

  if (!asset) {
    return res.status(404).json({ error: 'Asset not found' });
  }

  asset.is_deleted = true;
  asset.deleted_at = new Date();
  console.log(`Asset soft deleted: ${assetId} by user ${req.session.userId}`);
  res.json({ message: 'Asset deleted successfully' });
});

// Work routes
app.get('/api/works', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = users.find(u => u.id === req.session.userId);
  let userWorks;

  if (user.role === 'super_admin') {
    // Super admin can see all works
    userWorks = works;
  } else {
    // Regular users see works they initiated or have access to
    userWorks = works.filter(w =>
      w.initiated_by === req.session.userId ||
      accessControl.some(ac =>
        ac.user_id === req.session.userId &&
        ac.work_id === w.id &&
        ac.is_active
      )
    );
  }

  res.json({ works: userWorks });
});

app.post('/api/works', requirePermission('initiate_work'), (req, res) => {
  const { workType, assetId, clientName, setupData } = req.body;

  if (!workType || !assetId) {
    return res.status(400).json({ error: 'Work type and asset ID are required' });
  }

  // Verify user has access to the asset
  if (!hasPermission(req.session.userId, 'edit_asset', assetId, 'asset')) {
    return res.status(403).json({ error: 'Insufficient permissions for this asset' });
  }

  const sanitizedClientName = clientName ? sanitizeInput(clientName) : '';

  const work = {
    id: nextWorkId++,
    work_type: workType,
    asset_id: assetId,
    status: 'draft',
    initiated_by: req.session.userId,
    client_name: sanitizedClientName,
    setup_data_json: JSON.stringify(setupData || {}),
    created_at: new Date(),
    is_deleted: false
  };

  works.push(work);
  logAudit(req.session.userId, 'WORK_CREATE', 'work', work.id, { workType, assetId, clientName: sanitizedClientName });
  console.log(`Work created: ${workType} for asset ${assetId} by user ${req.session.userId}`);
  res.status(201).json({ workId: work.id });
});

app.put('/api/works/:id', requirePermission('edit_invited_work', 'work'), (req, res) => {
  const workId = parseInt(req.params.id);
  const { status, clientName } = req.body;

  const work = works.find(w => w.id === workId && !w.is_deleted);
  if (!work) {
    return res.status(404).json({ error: 'Work not found' });
  }

  if (status) work.status = status;
  if (clientName) work.client_name = sanitizeInput(clientName);

  work.updated_at = new Date();
  console.log(`Work updated: ${workId} by user ${req.session.userId}`);
  res.json({ work });
});

// File upload and evidence routes
app.post('/api/upload', requirePermission('capture_evidence'), upload.array('files', 10), async (req, res) => {
  try {
    const { workId, componentId, fieldName } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    if (!workId || !componentId || !fieldName) {
      return res.status(400).json({ error: 'Work ID, component ID, and field name are required' });
    }

    // Verify user has access to this work
    if (!hasPermission(req.session.userId, 'edit_invited_work', parseInt(workId), 'work')) {
      return res.status(403).json({ error: 'Insufficient permissions for this work' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      try {
        let processedFile;

        // Process based on file type
        if (file.mimetype.startsWith('image/')) {
          processedFile = await processImage(file.buffer, file.originalname, workId, componentId);
        } else {
          processedFile = processDocument(file.buffer, file.originalname, workId, componentId);
        }

        // Create evidence record
        const evidenceRecord = {
          id: nextEvidenceId++,
          work_id: parseInt(workId),
          component_id: parseInt(componentId),
          field_name: fieldName,
          evidence_type: file.mimetype.startsWith('image/') ? 'image' : 'pdf',
          value: null,
          file_path: processedFile.path,
          file_size_kb: Math.round(processedFile.size / 1024),
          original_filename: file.originalname,
          captured_by: req.session.userId,
          captured_at: new Date(),
          is_deleted: false
        };

        evidence.push(evidenceRecord);
        uploadedFiles.push({
          id: evidenceRecord.id,
          filename: processedFile.filename,
          originalName: file.originalname,
          size: processedFile.size,
          type: evidenceRecord.evidence_type
        });

        logAudit(req.session.userId, 'EVIDENCE_UPLOAD', 'evidence', evidenceRecord.id, {
          filename: file.originalname,
          workId,
          componentId,
          fieldName
        });
        console.log(`File uploaded: ${file.originalname} by user ${req.session.userId}`);

      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        // Continue processing other files
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({ error: 'Failed to process any files' });
    }

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// Get evidence for a work
app.get('/api/works/:id/evidence', requirePermission('view_assigned_work', 'work'), (req, res) => {
  const workId = parseInt(req.params.id);

  const workEvidence = evidence.filter(e =>
    e.work_id === workId && !e.is_deleted
  ).map(e => ({
    ...e,
    captured_by_name: users.find(u => u.id === e.captured_by)?.name
  }));

  res.json({ evidence: workEvidence });
});

// Delete evidence
app.delete('/api/evidence/:id', requirePermission('capture_evidence'), (req, res) => {
  const evidenceId = parseInt(req.params.id);
  const evidenceRecord = evidence.find(e => e.id === evidenceId && !e.is_deleted);

  if (!evidenceRecord) {
    return res.status(404).json({ error: 'Evidence not found' });
  }

  // Check if user can delete this evidence (owner or captured by user)
  if (evidenceRecord.captured_by !== req.session.userId && !hasPermission(req.session.userId, 'manage_works')) {
    return res.status(403).json({ error: 'Insufficient permissions to delete this evidence' });
  }

  evidenceRecord.is_deleted = true;
  evidenceRecord.deleted_at = new Date();

  // Optionally delete the physical file
  try {
    if (fs.existsSync(evidenceRecord.file_path)) {
      fs.unlinkSync(evidenceRecord.file_path);
    }
  } catch (error) {
    console.error('Error deleting physical file:', error);
  }

  console.log(`Evidence deleted: ${evidenceId} by user ${req.session.userId}`);
  res.json({ message: 'Evidence deleted successfully' });
});

// Serve uploaded files
app.get('/uploads/:workId/:componentId/:filename', requirePermission('view_assigned_work'), (req, res) => {
  const { workId, componentId, filename } = req.params;
  const filePath = path.join(worksDir, workId, componentId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Check if user has access to this work
  if (!hasPermission(req.session.userId, 'view_assigned_work', parseInt(workId), 'work')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  res.sendFile(filePath);
});

// Notification endpoints
app.get('/api/notifications', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const userNotifications = notifications
    .filter(n => n.user_id === req.session.userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ notifications: userNotifications });
});

app.put('/api/notifications/:id/read', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const notificationId = parseInt(req.params.id);
  const notification = notifications.find(n =>
    n.id === notificationId && n.user_id === req.session.userId
  );

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  if (!notification.is_read) {
    notification.is_read = true;
    notification.read_at = new Date();
  }

  res.json({ notification });
});

app.put('/api/notifications/read-all', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const unreadNotifications = notifications.filter(n =>
    n.user_id === req.session.userId && !n.is_read
  );

  unreadNotifications.forEach(notification => {
    notification.is_read = true;
    notification.read_at = new Date();
  });

  res.json({ message: `${unreadNotifications.length} notifications marked as read` });
});

// Audit log endpoint (super admin only)
app.get('/api/audit', requireRole(['super_admin']), (req, res) => {
  const { userId, action, resourceType, limit = 50, offset = 0 } = req.query;

  let filteredLogs = auditLogs;

  if (userId) {
    filteredLogs = filteredLogs.filter(log => log.user_id === parseInt(userId));
  }

  if (action) {
    filteredLogs = filteredLogs.filter(log => log.action === action);
  }

  if (resourceType) {
    filteredLogs = filteredLogs.filter(log => log.resource_type === resourceType);
  }

  const paginatedLogs = filteredLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    .map(log => ({
      ...log,
      user_name: users.find(u => u.id === log.user_id)?.name,
      details: JSON.parse(log.details)
    }));

  res.json({
    logs: paginatedLogs,
    total: filteredLogs.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

// Video room status endpoint
app.get('/api/works/:id/video-status', requirePermission('view_assigned_work', 'work'), (req, res) => {
  const workId = parseInt(req.params.id);
  const roomName = `video-${workId}`;

  // Get active participants in the video room
  const roomSockets = io.sockets.adapter.rooms.get(roomName);
  const participants = [];

  if (roomSockets) {
    for (const socketId of roomSockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket && socket.userId) {
        const userPresence = presence.find(p =>
          p.user_id === socket.userId &&
          p.socket_id === socketId &&
          p.action === 'in_video'
        );

        if (userPresence) {
          participants.push({
            userId: socket.userId,
            userName: socket.user.name,
            isScreenSharing: userPresence.action === 'screen_sharing'
          });
        }
      }
    }
  }

  res.json({
    workId,
    isActive: participants.length > 0,
    participantCount: participants.length,
    participants
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    database: {
      users: users.length,
      assets: assets.length,
      works: works.length,
      connections: io.engine.clientsCount
    }
  };

  res.json(health);
});

// System info endpoint (admin only)
app.get('/api/system-info', requireRole(['super_admin']), (req, res) => {
  const systemInfo = {
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      pid: process.pid
    },
    application: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000
    },
    database: {
      users: users.length,
      assets: assets.length,
      works: works.length,
      evidence: evidence.length,
      notifications: notifications.length
    },
    realTime: {
      connectedSockets: io.engine.clientsCount,
      activePresence: presence.length,
      activeLocks: editLocks.filter(l => !l.expired).length,
      activeVideoRooms: videoRooms.length
    }
  };

  res.json(systemInfo);
});

// Socket.io real-time functionality
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Authenticate socket connection
  socket.on('authenticate', (userId) => {
    const user = users.find(u => u.id === userId && u.is_active);
    if (user) {
      socket.userId = userId;
      socket.user = user;
      console.log(`Socket authenticated for user: ${user.email}`);

      // Update presence
      updatePresence(userId, 'online', socket.id);

      // Send current presence data
      socket.emit('presence-update', getPresenceData());
    } else {
      socket.disconnect();
    }
  });

  // Join work room
  socket.on('join-work', (workId) => {
    if (!socket.userId) return;

    const work = works.find(w => w.id === workId && !w.is_deleted);
    if (!work) return;

    // Check if user has permission to join this work
    if (!hasPermission(socket.userId, 'edit_invited_work', workId, 'work') &&
        !hasPermission(socket.userId, 'join_any_work')) {
      socket.emit('error', { message: 'Insufficient permissions to join this work' });
      return;
    }

    socket.join(`work-${workId}`);
    updatePresence(socket.userId, 'in_work', socket.id, workId);

    console.log(`User ${socket.userId} joined work ${workId}`);

    // Notify others in the work
    socket.to(`work-${workId}`).emit('user-joined', {
      userId: socket.userId,
      userName: socket.user.name,
      workId
    });
  });

  // Leave work room
  socket.on('leave-work', (workId) => {
    if (!socket.userId) return;

    socket.leave(`work-${workId}`);
    updatePresence(socket.userId, 'online', socket.id);

    console.log(`User ${socket.userId} left work ${workId}`);

    // Notify others in the work
    socket.to(`work-${workId}`).emit('user-left', {
      userId: socket.userId,
      userName: socket.user.name,
      workId
    });
  });

  // Component locking
  socket.on('lock-component', (data) => {
    if (!socket.userId) return;

    const { workId, componentId } = data;

    // Check if component is already locked
    const existingLock = editLocks.find(lock =>
      lock.work_id === workId &&
      lock.component_id === componentId &&
      !lock.expired
    );

    if (existingLock) {
      if (existingLock.locked_by === socket.userId) {
        // Extend lock
        existingLock.expires_at = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        socket.emit('lock-acquired', { workId, componentId });
      } else {
        socket.emit('lock-denied', { workId, componentId, lockedBy: existingLock.locked_by });
      }
      return;
    }

    // Create new lock
    const lock = {
      id: nextLockId++,
      work_id: workId,
      component_id: componentId,
      locked_by: socket.userId,
      locked_at: new Date(),
      expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      expired: false
    };

    editLocks.push(lock);

    // Notify others in the work
    socket.to(`work-${workId}`).emit('component-locked', {
      workId,
      componentId,
      lockedBy: socket.userId,
      userName: socket.user.name
    });

    // Send notification to other users
    notifyComponentLocked(componentId, workId, socket.user);

    socket.emit('lock-acquired', { workId, componentId });
    console.log(`Component ${componentId} locked by user ${socket.userId} in work ${workId}`);
  });

  socket.on('unlock-component', (data) => {
    if (!socket.userId) return;

    const { workId, componentId } = data;

    const lock = editLocks.find(lock =>
      lock.work_id === workId &&
      lock.component_id === componentId &&
      lock.locked_by === socket.userId &&
      !lock.expired
    );

    if (lock) {
      lock.expired = true;

      // Notify others in the work
      socket.to(`work-${workId}`).emit('component-unlocked', {
        workId,
        componentId,
        unlockedBy: socket.userId,
        userName: socket.user.name
      });

      console.log(`Component ${componentId} unlocked by user ${socket.userId} in work ${workId}`);
    }
  });

  // Real-time updates
  socket.on('work-update', (data) => {
    if (!socket.userId) return;

    const { workId, updates } = data;

    // Broadcast updates to others in the work
    socket.to(`work-${workId}`).emit('work-updated', {
      workId,
      updates,
      updatedBy: socket.userId,
      userName: socket.user.name
    });
  });

  // Heartbeat for presence tracking
  socket.on('heartbeat', (data) => {
    if (socket.userId) {
      updatePresence(socket.userId, data.action || 'online', socket.id, data.workId);
    }
  });

  // WebRTC Video Signaling
  socket.on('join-video-room', (data) => {
    if (!socket.userId) return;

    const { workId } = data;
    const roomName = `video-${workId}`;

    // Check if user has permission to join video
    if (!hasPermission(socket.userId, 'join_video')) {
      socket.emit('video-error', { message: 'Insufficient permissions to join video' });
      return;
    }

    // Check if user has access to this work
    if (!hasPermission(socket.userId, 'view_assigned_work', workId, 'work')) {
      socket.emit('video-error', { message: 'Insufficient permissions for this work' });
      return;
    }

    socket.join(roomName);

    // Update presence to show user is in video
    updatePresence(socket.userId, 'in_video', socket.id, workId);

    // Get current room participants
    const roomSockets = io.sockets.adapter.rooms.get(roomName);
    const participants = [];

    if (roomSockets) {
      for (const socketId of roomSockets) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.userId && socket.userId !== socket.userId) {
          participants.push({
            userId: socket.userId,
            userName: socket.user.name,
            socketId: socketId
          });
        }
      }
    }

    // Notify existing participants about new user
    socket.to(roomName).emit('video-user-joined', {
      userId: socket.userId,
      userName: socket.user.name,
      socketId: socket.id
    });

    // Send list of existing participants to new user
    socket.emit('video-room-joined', {
      participants,
      roomId: workId
    });

    console.log(`User ${socket.userId} joined video room ${workId}`);
  });

  socket.on('leave-video-room', (data) => {
    if (!socket.userId) return;

    const { workId } = data;
    const roomName = `video-${workId}`;

    socket.leave(roomName);

    // Update presence
    updatePresence(socket.userId, 'online', socket.id);

    // Notify others in the room
    socket.to(roomName).emit('video-user-left', {
      userId: socket.userId,
      userName: socket.user.name,
      socketId: socket.id
    });

    console.log(`User ${socket.userId} left video room ${workId}`);
  });

  // WebRTC signaling
  socket.on('video-offer', (data) => {
    const { targetUserId, offer, workId } = data;
    const roomName = `video-${workId}`;

    // Find target user's socket
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      s => s.userId === targetUserId && s.rooms.has(roomName)
    );

    if (targetSocket) {
      targetSocket.emit('video-offer', {
        fromUserId: socket.userId,
        fromUserName: socket.user.name,
        offer,
        workId
      });
    }
  });

  socket.on('video-answer', (data) => {
    const { targetUserId, answer, workId } = data;
    const roomName = `video-${workId}`;

    // Find target user's socket
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      s => s.userId === targetUserId && s.rooms.has(roomName)
    );

    if (targetSocket) {
      targetSocket.emit('video-answer', {
        fromUserId: socket.userId,
        fromUserName: socket.user.name,
        answer,
        workId
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const { targetUserId, candidate, workId } = data;
    const roomName = `video-${workId}`;

    // Find target user's socket
    const targetSocket = Array.from(io.sockets.sockets.values()).find(
      s => s.userId === targetUserId && s.rooms.has(roomName)
    );

    if (targetSocket) {
      targetSocket.emit('ice-candidate', {
        fromUserId: socket.userId,
        candidate,
        workId
      });
    }
  });

  // Screen sharing signaling
  socket.on('start-screen-share', (data) => {
    const { workId } = data;
    const roomName = `video-${workId}`;

    // Update presence
    updatePresence(socket.userId, 'screen_sharing', socket.id, workId);

    // Notify others in the room
    socket.to(roomName).emit('screen-share-started', {
      userId: socket.userId,
      userName: socket.user.name,
      workId
    });

    console.log(`User ${socket.userId} started screen sharing in work ${workId}`);
  });

  socket.on('stop-screen-share', (data) => {
    const { workId } = data;
    const roomName = `video-${workId}`;

    // Update presence back to video
    updatePresence(socket.userId, 'in_video', socket.id, workId);

    // Notify others in the room
    socket.to(roomName).emit('screen-share-stopped', {
      userId: socket.userId,
      userName: socket.user.name,
      workId
    });

    console.log(`User ${socket.userId} stopped screen sharing in work ${workId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      // Remove user's presence
      presence = presence.filter(p => p.socket_id !== socket.id);

      // Expire user's locks
      editLocks.forEach(lock => {
        if (lock.locked_by === socket.userId) {
          lock.expired = true;
        }
      });

      console.log(`User disconnected: ${socket.userId}`);

      // Notify others about disconnection
      socket.rooms.forEach(room => {
        if (room.startsWith('work-')) {
          const workId = parseInt(room.split('-')[1]);
          socket.to(room).emit('user-disconnected', {
            userId: socket.userId,
            userName: socket.user?.name,
            workId
          });
        } else if (room.startsWith('video-')) {
          const workId = parseInt(room.split('-')[1]);
          socket.to(room).emit('video-user-left', {
            userId: socket.userId,
            userName: socket.user?.name,
            workId
          });
        }
      });
    }
  });
});

// Helper functions for real-time features
function updatePresence(userId, action, socketId, workId = null, componentId = null) {
  // Remove old presence records for this user/socket
  presence = presence.filter(p => !(p.user_id === userId && p.socket_id === socketId));

  // Add new presence record
  const presenceRecord = {
    user_id: userId,
    action,
    socket_id: socketId,
    work_id: workId,
    component_id: componentId,
    last_heartbeat: new Date()
  };

  presence.push(presenceRecord);
}

function getPresenceData() {
  return presence.map(p => ({
    ...p,
    user: users.find(u => u.id === p.user_id)
  }));
}

// Clean up expired locks periodically
setInterval(() => {
  const now = new Date();
  editLocks.forEach(lock => {
    if (!lock.expired && lock.expires_at < now) {
      lock.expired = true;
      console.log(`Lock expired: ${lock.id}`);
    }
  });
}, 30000); // Check every 30 seconds

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`VAMP MVP server running on port ${PORT}`);
  console.log('Visit http://localhost:3000 to use the application');
  console.log('Real-time features enabled with Socket.io');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  process.exit(0);
});
