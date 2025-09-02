const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'app_config.json'), 'utf8'));
const defaultComponents = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'default_components.json'), 'utf8'));

async function seedDatabase() {
  try {
    const db = new Database(config.database.path);
    db.pragma('foreign_keys = ON');

    console.log('🌱 Seeding database with sample data...');

    // Create sample users
    const users = await createSampleUsers(db);
    console.log('✅ Created sample users');

    // Create sample assets
    const assets = createSampleAssets(db, users);
    console.log('✅ Created sample assets');

    // Create sample components
    createSampleComponents(db, assets);
    console.log('✅ Created sample components');

    // Create sample works
    createSampleWorks(db, assets, users);
    console.log('✅ Created sample works');

    db.close();
    console.log('🎉 Database seeded successfully!');
    
    console.log('\n📋 Sample Data Created:');
    console.log('👤 Users:');
    console.log('  • admin@vamp.com (super_admin) - password: admin123');
    console.log('  • captain@vessel.com (owner) - password: captain123');
    console.log('  • surveyor@marine.com (worker) - password: surveyor123');
    console.log('\n🚢 Assets:');
    console.log('  • MV Atlantic Star (Commercial Vessel)');
    console.log('  • HMS Guardian (Naval Vessel)');
    console.log('\n🔧 Works:');
    console.log('  • Vessel Inspection (Draft)');
    console.log('  • Maintenance Work (In Progress)');
    console.log('\nYou can now login and test all the features!');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

async function createSampleUsers(db) {
  const users = [
    {
      email: 'admin@vamp.com',
      name: 'System Administrator',
      password: 'admin123',
      role: 'super_admin'
    },
    {
      email: 'captain@vessel.com',
      name: 'Captain James Wilson',
      password: 'captain123',
      role: 'owner'
    },
    {
      email: 'surveyor@marine.com',
      name: 'Marine Surveyor',
      password: 'surveyor123',
      role: 'worker'
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO users (email, name, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);

  const createdUsers = [];
  
  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, config.security.bcrypt_rounds);
    const result = insertStmt.run(user.email, user.name, passwordHash, user.role);
    createdUsers.push({ ...user, id: result.lastInsertRowid });
  }

  return createdUsers;
}

function createSampleAssets(db, users) {
  const ownerUser = users.find(u => u.role === 'owner');
  
  const metadata1 = {
    vessel_details: {
      imo_number: "1234567",
      vessel_name: "MV Atlantic Star",
      build_year: 2018,
      builder: "Atlantic Shipyard",
      flag: "Panama",
      port_of_registry: "Panama City",
      call_sign: "H3AB",
      mmsi: "371234567",
      classification_society: "ABS",
      class_notation: "A1 Container Ship"
    },
    specifications: {
      vessel_type: "Container Ship",
      length_overall: 299.9,
      length_between_perpendiculars: 285.0,
      beam: 48.2,
      depth: 24.6,
      draft_summer: 14.2,
      gross_tonnage: 99500,
      net_tonnage: 58200,
      deadweight: 109000,
      lightship: 15000,
      teu_capacity: 9200
    },
    machinery: {
      main_engine: {
        maker: "MAN B&W",
        model: "8G95ME-C9.2",
        type: "Two-stroke",
        power_kw: 35360,
        rpm: 84,
        fuel_type: "HFO/MDO"
      }
    }
  };

  const metadata2 = {
    vessel_details: {
      vessel_name: "HMS Guardian",
      build_year: 2015,
      builder: "Royal Naval Shipyard",
      flag: "United Kingdom",
      port_of_registry: "Portsmouth",
      classification_society: "Lloyd's Register",
      class_notation: "Naval Auxiliary"
    },
    specifications: {
      vessel_type: "Naval Patrol Vessel",
      length_overall: 85.0,
      beam: 13.0,
      depth: 7.5,
      draft_summer: 4.2,
      gross_tonnage: 2500,
      deadweight: 500
    }
  };

  const assets = [
    {
      name: "MV Atlantic Star",
      type: "commercial",
      owner_id: ownerUser.id,
      metadata: metadata1
    },
    {
      name: "HMS Guardian",
      type: "naval",
      owner_id: ownerUser.id,
      metadata: metadata2
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO assets (name, type, owner_id, metadata_json)
    VALUES (?, ?, ?, ?)
  `);

  const createdAssets = [];
  
  for (const asset of assets) {
    const result = insertStmt.run(asset.name, asset.type, asset.owner_id, JSON.stringify(asset.metadata));
    createdAssets.push({ ...asset, id: result.lastInsertRowid });
  }

  return createdAssets;
}

function createSampleComponents(db, assets) {
  const componentStmt = db.prepare(`
    INSERT INTO components (asset_id, parent_id, name, capture_fields_json, display_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Add components to the first asset using default template
  const asset = assets[0];
  let orderCounter = 0;

  defaultComponents.vessel_components.forEach(category => {
    // Create parent component
    const parentResult = componentStmt.run(asset.id, null, category.name, JSON.stringify([]), orderCounter++);
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
      if (typeof captureFields === 'string' && captureFields.includes('SIMILAR_TO_')) {
        captureFields = [
          {
            name: "condition",
            label: "Overall Condition",
            type: "select",
            options: ["Excellent", "Good", "Fair", "Poor"],
            required: true
          },
          {
            name: "photo_evidence",
            label: "Photos",
            type: "image",
            multiple: true,
            required: true
          },
          {
            name: "remarks",
            label: "Remarks",
            type: "textarea"
          }
        ];
      }

      componentStmt.run(asset.id, parentId, sub.name, JSON.stringify(captureFields), orderCounter++);
    });
  });

  // Add some basic components to the second asset
  const asset2 = assets[1];
  const basicComponents = [
    { name: "Hull", fields: [
      { name: "condition", label: "Hull Condition", type: "select", options: ["Good", "Fair", "Poor"], required: true },
      { name: "photos", label: "Photos", type: "image", multiple: true }
    ]},
    { name: "Engine Room", fields: [
      { name: "engine_hours", label: "Engine Hours", type: "number", required: true },
      { name: "oil_level", label: "Oil Level", type: "select", options: ["Full", "3/4", "1/2", "Low"], required: true }
    ]},
    { name: "Navigation Bridge", fields: [
      { name: "equipment_status", label: "Equipment Status", type: "textarea" },
      { name: "photos", label: "Photos", type: "image", multiple: true }
    ]}
  ];

  basicComponents.forEach((comp, index) => {
    componentStmt.run(asset2.id, null, comp.name, JSON.stringify(comp.fields), index);
  });
}

function createSampleWorks(db, assets, users) {
  const ownerUser = users.find(u => u.role === 'owner');
  const workerUser = users.find(u => u.role === 'worker');

  const works = [
    {
      work_type: "inspection",
      asset_id: assets[0].id,
      status: "draft",
      initiated_by: ownerUser.id,
      client_name: "Atlantic Shipping Ltd",
      setup_data_json: JSON.stringify({
        client_name: "Atlantic Shipping Ltd",
        inspection_type: "Annual",
        inspection_date: new Date().toISOString().split('T')[0],
        surveyor_name: "Marine Surveyor",
        classification_society: "ABS",
        initial_notes: "Annual inspection for class renewal"
      })
    },
    {
      work_type: "maintenance",
      asset_id: assets[1].id,
      status: "in_progress",
      initiated_by: ownerUser.id,
      client_name: "Royal Navy",
      setup_data_json: JSON.stringify({
        client_name: "Royal Navy",
        maintenance_type: "Routine",
        priority: "Medium",
        estimated_hours: 24,
        parts_required: "Engine filters, oil, spare parts"
      }),
      started_at: new Date().toISOString()
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO works (work_type, asset_id, status, initiated_by, client_name, setup_data_json, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const createdWorks = [];
  
  for (const work of works) {
    const result = insertStmt.run(
      work.work_type,
      work.asset_id,
      work.status,
      work.initiated_by,
      work.client_name,
      work.setup_data_json,
      work.started_at || null
    );
    createdWorks.push({ ...work, id: result.lastInsertRowid });
  }

  // Add access control for the worker
  const accessStmt = db.prepare(`
    INSERT INTO access_control (user_id, work_id, permission_type, granted_by)
    VALUES (?, ?, ?, ?)
  `);

  createdWorks.forEach(work => {
    accessStmt.run(workerUser.id, work.id, 'edit', ownerUser.id);
  });

  return createdWorks;
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
