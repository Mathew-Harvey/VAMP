const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'app_config.json'), 'utf8'));

function initDatabase() {
  try {
    // Create database directory if it doesn't exist
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const db = new Database(config.database.path);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create tables in correct order (respecting foreign key dependencies)
    createUsersTable(db);
    createAssetsTable(db);
    createComponentsTable(db);
    createWorksTable(db);
    createAccessControlTable(db);
    createEvidenceTable(db);
    createPresenceTable(db);
    createEditLocksTable(db);
    createInvitationsTable(db);
    createNotificationsTable(db);

    // Create indexes for performance
    createIndexes(db);

    console.log('Database initialized successfully!');
    db.close();

  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

function createUsersTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('owner', 'worker', 'super_admin')) NOT NULL DEFAULT 'worker',
      remember_token TEXT,
      remember_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      last_activity DATETIME,
      is_active BOOLEAN DEFAULT 1,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createAssetsTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('commercial', 'naval', 'other')) NOT NULL,
      owner_id INTEGER NOT NULL,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createComponentsTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS components (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      parent_id INTEGER,
      name TEXT NOT NULL,
      capture_fields_json TEXT,
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES components(id) ON DELETE CASCADE,
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createWorksTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS works (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_type TEXT NOT NULL,
      asset_id INTEGER NOT NULL,
      status TEXT CHECK(status IN ('draft', 'in_progress', 'completed', 'unlocked')) NOT NULL DEFAULT 'draft',
      initiated_by INTEGER NOT NULL,
      client_name TEXT,
      setup_data_json TEXT,
      delivery_data_json TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      unlocked_at DATETIME,
      unlocked_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (initiated_by) REFERENCES users(id),
      FOREIGN KEY (unlocked_by) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createAccessControlTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS access_control (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      asset_id INTEGER,
      work_id INTEGER,
      permission_type TEXT CHECK(permission_type IN ('view', 'edit', 'admin')) NOT NULL DEFAULT 'edit',
      granted_by INTEGER NOT NULL,
      granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked_at DATETIME,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (work_id) REFERENCES works(id),
      FOREIGN KEY (granted_by) REFERENCES users(id),
      CHECK ((asset_id IS NOT NULL AND work_id IS NULL) OR (asset_id IS NULL AND work_id IS NOT NULL))
    );
  `;
  db.exec(sql);
}

function createEvidenceTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      evidence_type TEXT CHECK(evidence_type IN ('text', 'image', 'video_screenshot', 'checkbox', 'date', 'number', 'pdf', 'excel', 'csv')) NOT NULL,
      value TEXT,
      file_path TEXT,
      file_size_kb INTEGER,
      original_filename TEXT,
      captured_by INTEGER NOT NULL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      deleted_at DATETIME,
      deleted_by INTEGER,
      FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES components(id),
      FOREIGN KEY (captured_by) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createPresenceTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS presence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      asset_id INTEGER,
      work_id INTEGER,
      component_id INTEGER,
      action TEXT CHECK(action IN ('viewing', 'editing', 'in_video', 'screen_sharing')) NOT NULL,
      socket_id TEXT,
      last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (work_id) REFERENCES works(id),
      FOREIGN KEY (component_id) REFERENCES components(id)
    );
  `;
  db.exec(sql);
}

function createEditLocksTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS edit_locks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_id INTEGER NOT NULL,
      component_id INTEGER NOT NULL,
      locked_by INTEGER NOT NULL,
      locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (work_id) REFERENCES works(id),
      FOREIGN KEY (component_id) REFERENCES components(id),
      FOREIGN KEY (locked_by) REFERENCES users(id),
      UNIQUE(work_id, component_id)
    );
  `;
  db.exec(sql);
}

function createInvitationsTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      asset_id INTEGER,
      work_id INTEGER,
      invited_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      accepted_at DATETIME,
      expires_at DATETIME,
      FOREIGN KEY (asset_id) REFERENCES assets(id),
      FOREIGN KEY (work_id) REFERENCES works(id),
      FOREIGN KEY (invited_by) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createNotificationsTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('work_invite', 'work_started', 'work_completed', 'asset_shared', 'component_locked')) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;
  db.exec(sql);
}

function createIndexes(db) {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_id, is_deleted);',
    'CREATE INDEX IF NOT EXISTS idx_components_asset ON components(asset_id, is_deleted);',
    'CREATE INDEX IF NOT EXISTS idx_works_asset ON works(asset_id, status, is_deleted);',
    'CREATE INDEX IF NOT EXISTS idx_evidence_work ON evidence(work_id, is_deleted);',
    'CREATE INDEX IF NOT EXISTS idx_access_user ON access_control(user_id, is_active);',
    'CREATE INDEX IF NOT EXISTS idx_presence_heartbeat ON presence(last_heartbeat);',
    'CREATE INDEX IF NOT EXISTS idx_edit_locks_expires ON edit_locks(expires_at);',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);',
    'CREATE INDEX IF NOT EXISTS idx_users_remember ON users(remember_token);'
  ];

  indexes.forEach(sql => db.exec(sql));
}

if (require.main === module) {
  initDatabase();
}

module.exports = { initDatabase };
