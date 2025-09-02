const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'app_config.json'), 'utf8'));
const workTypes = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'work_types.json'), 'utf8'));
const defaultComponents = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'default_components.json'), 'utf8'));

// Initialize database
const db = new Database(config.database.path);
db.pragma('foreign_keys = ON');

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
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
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: config.server.session_secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: config.server.session_timeout_minutes * 60 * 1000
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve config files
app.use('/config', express.static(path.join(__dirname, 'config')));

// Database helper functions
function getUserById(id) {
  const stmt = db.prepare('SELECT id, email, name, role, created_at, last_login FROM users WHERE id = ? AND is_deleted = 0');
  return stmt.get(id);
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND is_deleted = 0');
  return stmt.get(email);
}

function createUser(email, name, passwordHash, role = 'worker') {
  const stmt = db.prepare(`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(email, name, passwordHash, role);
  return result.lastInsertRowid;
}

function updateUserActivity(userId) {
  const stmt = db.prepare('UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(userId);
}

function generateRememberToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setRememberToken(userId, token, expires) {
  const stmt = db.prepare(`
    UPDATE users
    SET remember_token = ?, remember_token_expires = ?
    WHERE id = ?
  `);
  stmt.run(token, expires.toISOString(), userId);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.session.userId) {
    updateUserActivity(req.session.userId);
    req.user = getUserById(req.session.userId);
    return next();
  }

  // Check for remember token
  const rememberToken = req.cookies?.remember_token;
  if (rememberToken) {
    const stmt = db.prepare(`
      SELECT * FROM users
      WHERE remember_token = ? AND remember_token_expires > CURRENT_TIMESTAMP AND is_deleted = 0
    `);
    const user = stmt.get(rememberToken);
    if (user) {
      req.session.userId = user.id;
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
      updateUserActivity(user.id);
      return next();
    }
  }

  res.status(401).json({ error: 'Authentication required' });
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

// Authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcrypt_rounds);

    // Create user
    const userId = createUser(email, name, passwordHash);

    // Log registration
    console.log(`New user registered: ${email} (${name})`);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    const stmt = db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(user.id);

    // Create session
    req.session.userId = user.id;

    // Handle remember me
    if (rememberMe) {
      const token = generateRememberToken();
      const expires = new Date(Date.now() + config.server.remember_me_days * 24 * 60 * 60 * 1000);
      setRememberToken(user.id, token, expires);

      res.cookie('remember_token', token, {
        httpOnly: true,
        expires,
        secure: false // Set to true in production
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  // Clear remember token
  if (req.session.userId) {
    const stmt = db.prepare('UPDATE users SET remember_token = NULL, remember_token_expires = NULL WHERE id = ?');
    stmt.run(req.session.userId);
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }

    res.clearCookie('connect.sid');
    res.clearCookie('remember_token');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/api/auth/session', (req, res) => {
  if (req.session.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      return res.json({ user });
    }
  }
  res.status(401).json({ error: 'No active session' });
});

// Asset routes
app.get('/api/assets', requireAuth, (req, res) => {
  try {
    let query = `
      SELECT a.*, u.name as owner_name
      FROM assets a
      JOIN users u ON a.owner_id = u.id
      WHERE a.is_deleted = 0
    `;
    const params = [];

    // Filter by owner if not super_admin
    if (req.user.role !== 'super_admin') {
      query += ' AND (a.owner_id = ? OR EXISTS (SELECT 1 FROM access_control ac WHERE ac.asset_id = a.id AND ac.user_id = ? AND ac.is_active = 1))';
      params.push(req.user.id, req.user.id);
    }

    // Apply search filter
    if (req.query.search) {
      query += ' AND a.name LIKE ?';
      params.push(`%${req.query.search}%`);
    }

    // Apply type filter
    if (req.query.type) {
      query += ' AND a.type = ?';
      params.push(req.query.type);
    }

    const stmt = db.prepare(query);
    const assets = stmt.all(...params);

    res.json({ assets });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/assets', requireAuth, (req, res) => {
  try {
    const { name, type, importTemplate } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Create asset
      const assetStmt = db.prepare(`
        INSERT INTO assets (name, type, owner_id, metadata_json)
        VALUES (?, ?, ?, ?)
      `);
      const metadata = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates', 'asset_metadata.json'), 'utf8'));
      const assetResult = assetStmt.run(name, type, req.user.id, JSON.stringify(metadata));
      const assetId = assetResult.lastInsertRowid;

      // Import components if requested
      if (importTemplate) {
        importDefaultComponents(assetId);
      }

      return assetId;
    });

    const assetId = transaction();
    res.status(201).json({ assetId });
  } catch (error) {
    console.error('Create asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function importDefaultComponents(assetId) {
  let orderCounter = 0;

  defaultComponents.vessel_components.forEach(category => {
    // Create parent component
    const parentStmt = db.prepare(`
      INSERT INTO components (asset_id, name, display_order)
      VALUES (?, ?, ?)
    `);
    const parentResult = parentStmt.run(assetId, category.name, orderCounter++);
    const parentId = parentResult.lastInsertRowid;

    // Create sub-components
    category.sub_components.forEach(sub => {
      let captureFields = sub.capture_fields;

      // Handle SAME_AS_PORT_SIDE reference
      if (captureFields === "SAME_AS_PORT_SIDE") {
        const portSideComponent = category.sub_components.find(c => c.name === "Port Side Shell Plating");
        captureFields = portSideComponent ? portSideComponent.capture_fields : [];
      }

      // Handle SIMILAR_TO references
      if (typeof captureFields === 'string' && captureFields.startsWith('SIMILAR_TO_')) {
        const referenceName = captureFields.replace('SIMILAR_TO_', '');
        const referenceComponent = category.sub_components.find(c => c.name === referenceName);
        captureFields = referenceComponent ? referenceComponent.capture_fields : [];
      }

      const subStmt = db.prepare(`
        INSERT INTO components (asset_id, parent_id, name, capture_fields_json, display_order)
        VALUES (?, ?, ?, ?, ?)
      `);
      subStmt.run(assetId, parentId, sub.name, JSON.stringify(captureFields), orderCounter++);
    });
  });
}

// Work routes
app.get('/api/works', requireAuth, (req, res) => {
  try {
    let query = `
      SELECT w.*, a.name as asset_name, u.name as initiated_by_name
      FROM works w
      JOIN assets a ON w.asset_id = a.id
      JOIN users u ON w.initiated_by = u.id
      WHERE w.is_deleted = 0
    `;
    const params = [];

    // Filter by user access
    if (req.user.role !== 'super_admin') {
      query += ` AND (
        w.initiated_by = ? OR
        EXISTS (SELECT 1 FROM access_control ac WHERE ac.work_id = w.id AND ac.user_id = ? AND ac.is_active = 1) OR
        w.asset_id IN (SELECT asset_id FROM access_control WHERE user_id = ? AND is_active = 1)
      )`;
      params.push(req.user.id, req.user.id, req.user.id);
    }

    // Apply status filter
    if (req.query.status) {
      query += ' AND w.status = ?';
      params.push(req.query.status);
    }

    // Apply search filter
    if (req.query.search) {
      query += ' AND (w.client_name LIKE ? OR a.name LIKE ?)';
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }

    query += ' ORDER BY w.created_at DESC';

    const stmt = db.prepare(query);
    const works = stmt.all(...params);

    res.json({ works });
  } catch (error) {
    console.error('Get works error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/works', requireAuth, (req, res) => {
  try {
    const { workType, assetId, clientName, setupData } = req.body;

    if (!workType || !assetId) {
      return res.status(400).json({ error: 'Work type and asset ID are required' });
    }

    // Verify asset access
    const assetStmt = db.prepare('SELECT * FROM assets WHERE id = ? AND is_deleted = 0');
    const asset = assetStmt.get(assetId);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (req.user.role !== 'super_admin' && asset.owner_id !== req.user.id) {
      // Check access control
      const accessStmt = db.prepare(`
        SELECT * FROM access_control
        WHERE asset_id = ? AND user_id = ? AND is_active = 1 AND permission_type IN ('edit', 'admin')
      `);
      const access = accessStmt.get(assetId, req.user.id);
      if (!access) {
        return res.status(403).json({ error: 'Insufficient permissions for this asset' });
      }
    }

    // Create work
    const workStmt = db.prepare(`
      INSERT INTO works (work_type, asset_id, initiated_by, client_name, setup_data_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const workResult = workStmt.run(workType, assetId, req.user.id, clientName || '', JSON.stringify(setupData || {}));
    const workId = workResult.lastInsertRowid;

    res.status(201).json({ workId });
  } catch (error) {
    console.error('Create work error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-work', (workId) => {
    socket.join(`work-${workId}`);
    console.log(`User ${socket.id} joined work ${workId}`);
  });

  socket.on('leave-work', (workId) => {
    socket.leave(`work-${workId}`);
    console.log(`User ${socket.id} left work ${workId}`);
  });

  socket.on('heartbeat', (data) => {
    // Update presence
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO presence (user_id, asset_id, work_id, component_id, action, socket_id, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    if (data.userId) {
      stmt.run(data.userId, data.assetId, data.workId, data.componentId, data.action, socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Clean up presence records
    const stmt = db.prepare('DELETE FROM presence WHERE socket_id = ?');
    stmt.run(socket.id);
  });
});

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: config.uploads.max_file_size_mb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [...config.uploads.allowed_image_types, ...config.uploads.allowed_document_types];
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// File processing helper
async function processImage(inputBuffer, filename) {
  const outputPath = path.join(config.uploads.base_path, 'temp', `processed_${Date.now()}_${filename}`);

  await sharp(inputBuffer)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({
      quality: config.uploads.image_compression_quality,
      progressive: true
    })
    .toFile(outputPath);

  // Check file size and compress further if needed
  const stats = fs.statSync(outputPath);
  const targetSize = config.uploads.image_resize_target_kb * 1024;

  if (stats.size > targetSize) {
    await sharp(outputPath)
      .jpeg({ quality: 70 })
      .toFile(outputPath);
  }

  return outputPath;
}

// Main route - serve the application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || config.server.port;
server.listen(PORT, () => {
  console.log(`VAMP server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
