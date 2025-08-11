Comprehensive Product Requirement Document (PRD)
Vessel Asset Management Platform (VAMP) - MVP
1. Executive Summary
Product Name: Vessel Asset Management Platform (VAMP)
Version: MVP 1.0
Objective: Web-based platform for managing digital twins of vessels, tracking components, and coordinating multi-party work with real-time collaboration, evidence collection, and video streaming.
Core Features:

Multi-user asset and component management
Real-time collaborative work execution with locking
WebRTC video streaming with screen sharing (3-5 participants)
Dynamic form-based evidence collection
Role-based access control
Audit trail and soft delete capabilities

Technical Requirements:

Frontend: HTML5, JavaScript (ES6+), CSS3, Bootstrap 5
Backend: Node.js with Express.js
Database: SQLite with better-sqlite3
Real-time: Socket.io
Video: WebRTC with PeerJS
File handling: Multer with Sharp for image resizing

2. User Management & Authentication
2.1 Authentication Features

Registration: Email, name, password (bcrypt hashed, 10 rounds)
Login: Email/password with "Remember Me" option (30-day cookie)
Session Management:

Auto-logout after 30 minutes inactivity
Express-session with sliding window
Remember Me tokens stored in DB


Password Reset: Not included in MVP

2.2 User Roles
javascriptroles = {
  'super_admin': {
    permissions: ['view_all', 'join_any_work', 'view_audit_log'],
    description: 'Can view all assets/works, join as observer'
  },
  'owner': {
    permissions: ['create_asset', 'edit_asset', 'delete_asset', 'initiate_work', 'invite_users'],
    description: 'Full control over owned assets and works'
  },
  'worker': {
    permissions: ['edit_invited_work', 'capture_evidence', 'join_video'],
    description: 'Can participate in assigned works'
  }
}
2.3 Presence System

Real-time status via Socket.io heartbeat (1-second intervals)
States: online, offline, editing_{component_id}, in_video
Automatic cleanup on disconnect
Display: Green dot for online, yellow for editing, red for locked

3. Database Schema
sql-- Complete database schema with all tables

-- Users table with remember me support
CREATE TABLE users (
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

-- Assets table with soft delete
CREATE TABLE assets (
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

-- Components table with display order
CREATE TABLE components (
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

-- Works table with unlock capability
CREATE TABLE works (
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

-- Access control table
CREATE TABLE access_control (
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

-- Evidence table with expanded file types
CREATE TABLE evidence (
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

-- Real-time presence tracking
CREATE TABLE presence (
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

-- Component edit locks
CREATE TABLE edit_locks (
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

-- Invitations table
CREATE TABLE invitations (
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

-- In-app notifications
CREATE TABLE notifications (
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

-- Create indexes for performance
CREATE INDEX idx_assets_owner ON assets(owner_id, is_deleted);
CREATE INDEX idx_components_asset ON components(asset_id, is_deleted);
CREATE INDEX idx_works_asset ON works(asset_id, status, is_deleted);
CREATE INDEX idx_evidence_work ON evidence(work_id, is_deleted);
CREATE INDEX idx_access_user ON access_control(user_id, is_active);
CREATE INDEX idx_presence_heartbeat ON presence(last_heartbeat);
CREATE INDEX idx_edit_locks_expires ON edit_locks(expires_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_users_remember ON users(remember_token);
4. JSON Configuration Files
4.1 Application Configuration (/config/app_config.json)
json{
  "server": {
    "port": 3000,
    "host": "localhost",
    "session_secret": "CHANGE_THIS_SECURE_RANDOM_STRING_IN_PRODUCTION",
    "session_timeout_minutes": 30,
    "remember_me_days": 30
  },
  "database": {
    "path": "./database/vamp.db",
    "backup_enabled": true,
    "backup_interval_hours": 24,
    "backup_path": "./database/backups/"
  },
  "uploads": {
    "base_path": "./uploads",
    "temp_path": "./uploads/temp",
    "image_resize_target_kb": 300,
    "max_file_size_mb": 50,
    "allowed_image_types": ["jpg", "jpeg", "png", "gif", "webp"],
    "allowed_document_types": ["pdf", "xlsx", "xls", "csv"],
    "image_compression_quality": 85
  },
  "webrtc": {
    "max_participants": 5,
    "prioritize_latency": true,
    "ice_servers": [
      {"urls": "stun:stun.l.google.com:19302"},
      {"urls": "stun:stun1.l.google.com:19302"}
    ],
    "video_constraints": {
      "width": {"ideal": 1920, "max": 1920},
      "height": {"ideal": 1080, "max": 1080},
      "frameRate": {"ideal": 30, "max": 30},
      "facingMode": "user"
    },
    "audio_constraints": {
      "echoCancellation": true,
      "noiseSuppression": true,
      "autoGainControl": true
    },
    "screen_share_constraints": {
      "video": {
        "cursor": "always",
        "displaySurface": "monitor"
      },
      "audio": false
    }
  },
  "security": {
    "bcrypt_rounds": 10,
    "invitation_expiry_days": 7,
    "max_login_attempts": 5,
    "lockout_duration_minutes": 30,
    "component_lock_timeout_seconds": 60
  },
  "features": {
    "enable_video": true,
    "enable_screen_sharing": true,
    "enable_audit_log": true,
    "enable_email_invites": true,
    "enable_auto_save": true,
    "auto_save_interval_seconds": 30,
    "enable_soft_delete": true
  },
  "audit": {
    "log_file_path": "./logs/audit.log",
    "max_file_size_mb": 100,
    "rotation_policy": "daily",
    "retention_days": 90
  }
}
4.2 Work Types Configuration (/config/work_types.json)
json{
  "work_types": [
    {
      "type": "inspection",
      "display_name": "Vessel Inspection",
      "description": "Comprehensive vessel inspection workflow",
      "icon": "clipboard-check",
      "color": "#28a745",
      "steps": [
        {
          "step_number": 1,
          "name": "Job Setup",
          "description": "Configure inspection parameters",
          "fields": [
            {
              "name": "client_name",
              "label": "Client Name",
              "type": "text",
              "required": true,
              "validation": "^[a-zA-Z0-9\\s\\-\\.]{2,100}$",
              "placeholder": "Enter client name"
            },
            {
              "name": "inspection_type",
              "label": "Inspection Type",
              "type": "select",
              "options": ["Annual", "Intermediate", "Special", "Docking", "Damage"],
              "required": true
            },
            {
              "name": "inspection_date",
              "label": "Inspection Date",
              "type": "date",
              "required": true,
              "min": "today"
            },
            {
              "name": "surveyor_name",
              "label": "Lead Surveyor",
              "type": "text",
              "required": true
            },
            {
              "name": "classification_society",
              "label": "Classification Society",
              "type": "select",
              "options": ["ABS", "DNV GL", "Lloyd's Register", "ClassNK", "BV", "Other"],
              "required": false
            },
            {
              "name": "initial_notes",
              "label": "Initial Notes",
              "type": "textarea",
              "required": false,
              "max_length": 1000,
              "rows": 4
            }
          ]
        },
        {
          "step_number": 2,
          "name": "Work Delivery",
          "description": "Component inspection and evidence collection",
          "component_based": true,
          "allow_video": true,
          "allow_screen_share": true,
          "allow_evidence_upload": true,
          "auto_save": true
        }
      ]
    },
    {
      "type": "maintenance",
      "display_name": "Maintenance Work",
      "description": "Routine and emergency maintenance",
      "icon": "wrench",
      "color": "#ffc107",
      "steps": [
        {
          "step_number": 1,
          "name": "Maintenance Setup",
          "fields": [
            {
              "name": "client_name",
              "label": "Client Name",
              "type": "text",
              "required": true
            },
            {
              "name": "maintenance_type",
              "label": "Maintenance Type",
              "type": "select",
              "options": ["Routine", "Emergency", "Scheduled", "Predictive"],
              "required": true
            },
            {
              "name": "priority",
              "label": "Priority Level",
              "type": "select",
              "options": ["Low", "Medium", "High", "Critical"],
              "required": true
            },
            {
              "name": "estimated_hours",
              "label": "Estimated Hours",
              "type": "number",
              "min": 0.5,
              "max": 500,
              "step": 0.5,
              "required": true
            },
            {
              "name": "parts_required",
              "label": "Parts Required",
              "type": "textarea",
              "required": false,
              "placeholder": "List any parts needed"
            }
          ]
        },
        {
          "step_number": 2,
          "name": "Work Execution",
          "component_based": true,
          "allow_video": true,
          "allow_screen_share": true,
          "allow_evidence_upload": true
        }
      ]
    },
    {
      "type": "survey",
      "display_name": "Class Survey",
      "description": "Classification society survey",
      "icon": "search",
      "color": "#17a2b8",
      "steps": [
        {
          "step_number": 1,
          "name": "Survey Setup",
          "fields": [
            {
              "name": "client_name",
              "label": "Client Name",
              "type": "text",
              "required": true
            },
            {
              "name": "survey_type",
              "label": "Survey Type",
              "type": "select",
              "options": ["Annual", "Intermediate", "Class Renewal", "Continuous"],
              "required": true
            },
            {
              "name": "survey_date",
              "label": "Survey Date",
              "type": "date",
              "required": true
            },
            {
              "name": "surveyor_id",
              "label": "Surveyor ID",
              "type": "text",
              "required": true
            }
          ]
        },
        {
          "step_number": 2,
          "name": "Survey Execution",
          "component_based": true,
          "allow_video": true,
          "allow_screen_share": true,
          "allow_evidence_upload": true
        }
      ]
    }
  ]
}
4.3 Default Vessel Components (/config/default_components.json)
json{
  "vessel_components": [
    {
      "name": "Hull",
      "display_order": 1,
      "sub_components": [
        {
          "name": "Port Side Shell Plating",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "visual_condition",
              "label": "Visual Condition",
              "type": "select",
              "options": ["Excellent", "Good", "Fair", "Poor", "Critical"],
              "required": true
            },
            {
              "name": "thickness_reading",
              "label": "Thickness Reading (mm)",
              "type": "number",
              "min": 0,
              "max": 50,
              "decimal_places": 1,
              "required": true
            },
            {
              "name": "coating_condition",
              "label": "Coating Condition",
              "type": "select",
              "options": ["Intact", "Minor Breakdown", "Major Breakdown", "Failed"],
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "max_files": 5,
              "required": true
            },
            {
              "name": "defects_noted",
              "label": "Defects Noted",
              "type": "textarea",
              "max_length": 500
            }
          ]
        },
        {
          "name": "Starboard Side Shell Plating",
          "display_order": 2,
          "capture_fields": "SAME_AS_PORT_SIDE"
        },
        {
          "name": "Bottom Plating",
          "display_order": 3,
          "capture_fields": [
            {
              "name": "visual_condition",
              "label": "Visual Condition",
              "type": "select",
              "options": ["Excellent", "Good", "Fair", "Poor", "Critical"],
              "required": true
            },
            {
              "name": "marine_growth",
              "label": "Marine Growth",
              "type": "select",
              "options": ["None", "Light", "Moderate", "Heavy"],
              "required": true
            },
            {
              "name": "anode_condition",
              "label": "Anode Condition (%)",
              "type": "number",
              "min": 0,
              "max": 100,
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        }
      ]
    },
    {
      "name": "Main Deck",
      "display_order": 2,
      "sub_components": [
        {
          "name": "Deck Plating",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "condition",
              "label": "Overall Condition",
              "type": "select",
              "options": ["Excellent", "Good", "Fair", "Poor"],
              "required": true
            },
            {
              "name": "corrosion_level",
              "label": "Corrosion Level",
              "type": "select",
              "options": ["None", "Surface", "Scale", "Pitting"],
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        },
        {
          "name": "Hatch Covers",
          "display_order": 2,
          "capture_fields": [
            {
              "name": "seal_condition",
              "label": "Seal Condition",
              "type": "select",
              "options": ["Good", "Fair", "Poor", "Replace"],
              "required": true
            },
            {
              "name": "operation_test",
              "label": "Operation Test",
              "type": "select",
              "options": ["Pass", "Fail"],
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        }
      ]
    },
    {
      "name": "Machinery Space",
      "display_order": 3,
      "sub_components": [
        {
          "name": "Main Engine",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "running_hours",
              "label": "Running Hours",
              "type": "number",
              "min": 0,
              "required": true
            },
            {
              "name": "last_overhaul",
              "label": "Last Overhaul Date",
              "type": "date",
              "required": true
            },
            {
              "name": "oil_analysis",
              "label": "Oil Analysis Report",
              "type": "pdf",
              "required": false
            },
            {
              "name": "vibration_readings",
              "label": "Vibration Readings",
              "type": "csv",
              "required": false
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            },
            {
              "name": "remarks",
              "label": "Remarks",
              "type": "textarea"
            }
          ]
        },
        {
          "name": "Auxiliary Engines",
          "display_order": 2,
          "capture_fields": "SIMILAR_TO_MAIN_ENGINE"
        },
        {
          "name": "Generators",
          "display_order": 3,
          "capture_fields": [
            {
              "name": "output_test",
              "label": "Output Test (kW)",
              "type": "number",
              "required": true
            },
            {
              "name": "insulation_resistance",
              "label": "Insulation Resistance (MΩ)",
              "type": "number",
              "decimal_places": 2,
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        }
      ]
    },
    {
      "name": "Navigation Equipment",
      "display_order": 4,
      "sub_components": [
        {
          "name": "Radar",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "operational_status",
              "label": "Operational Status",
              "type": "select",
              "options": ["Operational", "Defective", "Not Working"],
              "required": true
            },
            {
              "name": "last_service_date",
              "label": "Last Service Date",
              "type": "date",
              "required": true
            },
            {
              "name": "certificate",
              "label": "Service Certificate",
              "type": "pdf",
              "required": false
            }
          ]
        },
        {
          "name": "GPS",
          "display_order": 2,
          "capture_fields": "SIMILAR_TO_RADAR"
        },
        {
          "name": "ECDIS",
          "display_order": 3,
          "capture_fields": "SIMILAR_TO_RADAR"
        }
      ]
    },
    {
      "name": "Safety Equipment",
      "display_order": 5,
      "sub_components": [
        {
          "name": "Lifeboats",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "capacity_check",
              "label": "Capacity Check",
              "type": "checkbox",
              "default": false,
              "required": true
            },
            {
              "name": "davit_test",
              "label": "Davit Load Test",
              "type": "select",
              "options": ["Pass", "Fail", "Not Tested"],
              "required": true
            },
            {
              "name": "next_service_due",
              "label": "Next Service Due",
              "type": "date",
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        },
        {
          "name": "Fire Fighting Equipment",
          "display_order": 2,
          "capture_fields": [
            {
              "name": "extinguishers_checked",
              "label": "Extinguishers Checked",
              "type": "number",
              "min": 0,
              "required": true
            },
            {
              "name": "hydrants_tested",
              "label": "Hydrants Tested",
              "type": "number",
              "min": 0,
              "required": true
            },
            {
              "name": "foam_system",
              "label": "Foam System",
              "type": "select",
              "options": ["Operational", "Needs Service", "Not Working"],
              "required": true
            },
            {
              "name": "inspection_report",
              "label": "Inspection Report",
              "type": "pdf",
              "required": false
            }
          ]
        }
      ]
    },
    {
      "name": "Propulsion",
      "display_order": 6,
      "sub_components": [
        {
          "name": "Propeller",
          "display_order": 1,
          "capture_fields": [
            {
              "name": "blade_condition",
              "label": "Blade Condition",
              "type": "select",
              "options": ["Excellent", "Good", "Fair", "Damaged"],
              "required": true
            },
            {
              "name": "pitch_measurement",
              "label": "Pitch Measurement",
              "type": "number",
              "decimal_places": 2,
              "required": false
            },
            {
              "name": "cavitation_damage",
              "label": "Cavitation Damage",
              "type": "select",
              "options": ["None", "Minor", "Moderate", "Severe"],
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        },
        {
          "name": "Shaft",
          "display_order": 2,
          "capture_fields": [
            {
              "name": "alignment_check",
              "label": "Alignment Check",
              "type": "select",
              "options": ["Within Tolerance", "Out of Tolerance"],
              "required": true
            },
            {
              "name": "bearing_clearance",
              "label": "Bearing Clearance (mm)",
              "type": "number",
              "decimal_places": 2,
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        },
        {
          "name": "Rudder",
          "display_order": 3,
          "capture_fields": [
            {
              "name": "movement_test",
              "label": "Movement Test (Port to Starboard)",
              "type": "select",
              "options": ["Pass", "Fail"],
              "required": true
            },
            {
              "name": "bearing_wear",
              "label": "Bearing Wear (mm)",
              "type": "number",
              "decimal_places": 1,
              "required": true
            },
            {
              "name": "stock_condition",
              "label": "Stock Condition",
              "type": "select",
              "options": ["Good", "Fair", "Poor"],
              "required": true
            },
            {
              "name": "photo_evidence",
              "label": "Photos",
              "type": "image",
              "multiple": true,
              "required": true
            }
          ]
        }
      ]
    }
  ]
}
4.4 Asset Metadata Template (/templates/asset_metadata.json)
json{
  "vessel_details": {
    "imo_number": "",
    "vessel_name": "",
    "build_year": null,
    "builder": "",
    "flag": "",
    "port_of_registry": "",
    "call_sign": "",
    "mmsi": "",
    "classification_society": "",
    "class_notation": ""
  },
  "specifications": {
    "vessel_type": "",
    "length_overall": null,
    "length_between_perpendiculars": null,
    "beam": null,
    "depth": null,
    "draft_summer": null,
    "gross_tonnage": null,
    "net_tonnage": null,
    "deadweight": null,
    "lightship": null,
    "teu_capacity": null
  },
  "machinery": {
    "main_engine": {
      "maker": "",
      "model": "",
      "type": "",
      "power_kw": null,
      "rpm": null,
      "fuel_type": ""
    },
    "auxiliary_engines": [],
    "generators": [],
    "boilers": []
  },
  "operational": {
    "service_speed_knots": null,
    "fuel_consumption_tons_per_day": null,
    "range_nautical_miles": null,
    "crew_capacity": null,
    "passenger_capacity": null,
    "home_port": "",
    "current_location": {
      "port": "",
      "country": "",
      "latitude": null,
      "longitude": null,
      "last_updated": null
    }
  },
  "certificates": {
    "last_dry_dock": "",
    "next_dry_dock_due": "",
    "last_special_survey": "",
    "next_special_survey_due": "",
    "annual_survey_due": "",
    "intermediate_survey_due": ""
  },
  "ownership": {
    "registered_owner": "",
    "beneficial_owner": "",
    "technical_manager": "",
    "commercial_manager": "",
    "bareboat_charterer": ""
  },
  "custom_fields": {}
}
5. Core Functionality Specifications
5.1 Asset Management

Creation Flow:

User clicks "New Asset" → Modal form
Enter name, select type (commercial/naval/other)
Option to import component template or start blank
Auto-generate metadata file from template
Save and redirect to asset detail view


Component Management:

Drag-and-drop reordering (updates display_order)
Inline editing of component names
Bulk import from template JSON
Copy components between assets
Maximum 2 levels deep (parent → child)



5.2 Work Execution Flow

Initiation:

Select work type from dropdown
Auto-populate form based on work_types.json
Select asset (filtered search)
Invite team members (email or username)
Save as draft or proceed


Setup Phase (Step 1):

Complete required fields
Add team members
Submit locks step and notifies team
Status changes to "in_progress"


Delivery Phase (Step 2):

Dynamic accordion per component
Real-time locking per section
Auto-save every 30 seconds
Evidence upload with automatic image resizing
Video call integration


Completion:

Review all sections
Final submit (owner/admin only)
Generate completion timestamp
Update asset work history
Option to unlock for edits (owner only)



5.3 Real-Time Collaboration
Component Locking:
javascript// Lock acquisition logic
lockComponent(workId, componentId, userId) {
  // Check if already locked
  // Set 60-second auto-release timer
  // Broadcast lock status via Socket.io
  // Update UI to show lock indicator
}

// Auto-release on blur or timeout
releaseLock(workId, componentId, userId) {
  // Clear lock from database
  // Broadcast release via Socket.io
  // Update UI
}
Presence System:

Heartbeat every 1 second
Automatic offline after 5 seconds missed
Visual indicators:

Green dot: Online
Yellow dot: Editing
Red lock icon: Component locked
Camera icon: In video call
Screen icon: Screen sharing



5.4 Video Streaming Implementation
WebRTC Configuration:
javascriptconst rtcConfig = {
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'},
    {urls: 'stun:stun1.l.google.com:19302'}
  ],
  iceCandidatePoolSize: 10
};

const mediaConstraints = {
  video: {
    width: {ideal: 1920, max: 1920},
    height: {ideal: 1080, max: 1080},
    frameRate: {ideal: 30, max: 30}
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};
Features:

Mesh topology for 3-5 participants
One-click screenshot to evidence
Screen sharing toggle
Bandwidth adaptation for latency priority
Automatic reconnection on connection loss
Fallback to audio-only if video fails

5.5 File Handling
Image Processing:
javascript// Using Sharp for image resizing
async function processImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1920, 1080, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({
      quality: 85,
      progressive: true
    })
    .toFile(outputPath);
  
  // Check if still > 300KB
  const stats = await fs.stat(outputPath);
  if (stats.size > 300 * 1024) {
    // Further compress
    await sharp(outputPath)
      .jpeg({quality: 70})
      .toFile(outputPath);
  }
}
File Structure:
/uploads/
  /works/
    /{work_id}/
      /{component_id}/
        /images/
        /documents/
  /temp/
  /avatars/
6. User Interface Specifications
6.1 Layout Structure
html<!-- Main Layout -->
<nav class="navbar">
  <brand>VAMP</brand>
  <tabs>[Assets] [Work] [Notifications]</tabs>
  <user-menu>[Profile] [Logout]</user-menu>
</nav>

<main class="container-fluid">
  <div class="row">
    <!-- Asset/Work List (left) -->
    <div class="col-md-3">
      <search-bar />
      <filter-controls />
      <item-list />
    </div>
    
    <!-- Detail View (center) -->
    <div class="col-md-6">
      <detail-content />
    </div>
    
    <!-- Sidebar (right) -->
    <div class="col-md-3">
      <presence-indicator />
      <activity-feed />
      <video-panel />
    </div>
  </div>
</main>
6.2 Component Styles

Use Bootstrap 5 classes
Custom CSS for:

Lock indicators
Presence badges
Video grid layout
Drag-and-drop zones
Progress indicators



6.3 Responsive Breakpoints

Mobile (<768px): Stack layout, hide sidebar
Tablet (768-1024px): 2-column layout
Desktop (>1024px): 3-column layout

7. API Endpoints
7.1 Authentication

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/session
POST /api/auth/remember

7.2 Assets

GET /api/assets (list with filters)
POST /api/assets (create)
GET /api/assets/:id
PUT /api/assets/:id
DELETE /api/assets/:id (soft delete)
POST /api/assets/:id/components
PUT /api/assets/:id/components/:compId
DELETE /api/assets/:id/components/:compId

7.3 Works

GET /api/works (list with filters)
POST /api/works (create)
GET /api/works/:id
PUT /api/works/:id
POST /api/works/:id/complete
POST /api/works/:id/unlock
POST /api/works/:id/evidence
GET /api/works/:id/evidence

7.4 Collaboration

POST /api/works/:id/invite
POST /api/locks/acquire
POST /api/locks/release
GET /api/presence/:workId

7.5 WebRTC Signaling

Socket.io events:

join-room
leave-room
offer
answer
ice-candidate
screen-share-start
screen-share-stop



8. Security Requirements
8.1 Authentication

Bcrypt with 10 rounds
Session cookies (httpOnly, secure in production)
CSRF protection
Rate limiting on login (5 attempts/30 min)

8.2 Authorization

Role-based access control
Resource-level permissions
API endpoint protection
File upload validation

8.3 Data Protection

Input sanitization
SQL injection prevention (parameterized queries)
XSS prevention (output encoding)
File type validation
Size limits enforcement

9. Performance Requirements
9.1 Targets

Page load: <2 seconds
API response: <500ms
Video latency: <200ms
Auto-save: Every 30 seconds
Concurrent users: 100

9.2 Optimization Strategies

Database indexing
Socket.io room-based broadcasting
Image compression and caching
Lazy loading for components
Connection pooling
CDN for static assets

10. Deployment Instructions
10.1 Prerequisites
bash# System requirements
Node.js >= 18.0.0
npm >= 9.0.0
SQLite3
ffmpeg (for video processing)

# Required npm packages
express@4.18.0
express-session@1.17.0
socket.io@4.6.0
better-sqlite3@9.0.0
bcrypt@5.1.0
multer@1.4.5
sharp@0.32.0
jsonwebtoken@9.0.0
cors@2.8.5
helmet@7.0.0
compression@1.7.4
dotenv@16.0.0
winston@3.8.0 (for logging)
node-cron@3.0.0 (for backups)
10.2 Installation Steps
bash# 1. Clone repository
git clone [repository-url]
cd vamp

# 2. Install dependencies
npm install

# 3. Create directories
mkdir -p database database/backups uploads/temp uploads/works logs

# 4. Initialize database
node scripts/init-db.js

# 5. Copy config templates
cp config/app_config.template.json config/app_config.json
cp config/work_types.template.json config/work_types.json

# 6. Set environment variables
cp .env.example .env
# Edit .env with your values

# 7. Start server
npm start

# 8. For external access (home lab)
# Use ngrok or similar:
ngrok http 3000
10.3 Environment Variables (.env)
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-secure-random-string-here
DATABASE_PATH=./database/vamp.db
UPLOAD_PATH=./uploads
LOG_LEVEL=info
BACKUP_ENABLED=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
11. Testing Checklist
11.1 Core Features

 User registration and login
 Remember me functionality
 Session timeout after 30 minutes
 Asset creation and editing
 Component management (2 levels)
 Work initiation and completion
 Real-time collaboration locking
 Evidence upload with image resizing
 WebRTC video calling (3-5 users)
 Screen sharing
 In-app notifications
 Soft delete functionality
 Audit logging

11.2 Performance Tests

 100 concurrent users
 Image resizing to 300KB
 Video latency <200ms
 Auto-save every 30 seconds
 Database query optimization

11.3 Security Tests

 SQL injection prevention
 XSS prevention
 CSRF protection
 File upload validation
 Role-based access control

12. MVP Success Criteria

Functional Requirements Met:

All user roles functioning (owner, worker, super_admin)
Complete asset lifecycle management
Multi-step work execution with evidence
Real-time collaboration with locking
Video streaming with screen sharing


Performance Achieved:

Supports 100 concurrent users
Video calls work with 3-5 participants
Images automatically resized to 300KB
Low latency video prioritized


Deployment Ready:

Self-hosted on home lab
Accessible via tunnel (ngrok)
Database backups configured
Audit logging enabled




Summary
This comprehensive PRD provides all specifications needed for a one-shot MVP build of VAMP. The system is designed to be:

Complete: All core features for vessel asset management
Scalable: Handles 100 users with room for growth
Secure: Role-based access with audit trails
Collaborative: Real-time editing with video support
Maintainable: Clear structure with JSON configurations

The implementation should follow the schemas, configurations, and specifications exactly as defined to ensure a successful MVP deployment.