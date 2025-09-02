#!/usr/bin/env node

/**
 * Database Backup Script for VAMP
 * Creates timestamped backups of the SQLite database
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'app_config.json'), 'utf8'));

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const dbPath = config.database.path;
  const backupDir = config.database.backup_path;
  const backupFilename = `vamp_backup_${timestamp}.db`;
  const backupPath = path.join(backupDir, backupFilename);

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Check if database file exists
    if (!fs.existsSync(dbPath)) {
      console.log('ℹ️  No database file found to backup');
      return;
    }

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    // Get file size
    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Database backup created: ${backupFilename} (${sizeMB} MB)`);

    // Clean up old backups (keep last 30)
    cleanupOldBackups(backupDir, 30);

  } catch (error) {
    console.error('❌ Database backup failed:', error.message);
    process.exit(1);
  }
}

function cleanupOldBackups(backupDir, keepCount) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('vamp_backup_') && file.endsWith('.db'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stats: fs.statSync(path.join(backupDir, file))
      }))
      .sort((a, b) => b.stats.mtime - a.stats.mtime);

    if (files.length > keepCount) {
      const filesToDelete = files.slice(keepCount);
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Cleaned up old backup: ${file.name}`);
      });
    }
  } catch (error) {
    console.warn('⚠️  Failed to cleanup old backups:', error.message);
  }
}

// Run backup if called directly
if (require.main === module) {
  createBackup();
}

module.exports = { createBackup, cleanupOldBackups };
