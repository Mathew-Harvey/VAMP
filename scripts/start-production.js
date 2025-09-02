#!/usr/bin/env node

/**
 * Production Startup Script for VAMP
 * Handles graceful startup, error recovery, and monitoring
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting VAMP in production mode...');

// Load environment variables
require('dotenv').config();

// Validate required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'SESSION_SECRET',
  'PORT'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Create necessary directories
const directories = [
  'logs',
  'uploads/temp',
  'uploads/works',
  'database',
  'database/backups'
];

directories.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
});

// Start the application
const serverProcess = spawn('node', ['server-simple.js'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

// Handle process events
serverProcess.on('close', (code) => {
  console.log(`🔴 VAMP server exited with code ${code}`);
  process.exit(code);
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start VAMP server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

console.log('✅ VAMP production server started successfully');
console.log(`🌐 Server will be available at http://localhost:${process.env.PORT || 3000}`);
