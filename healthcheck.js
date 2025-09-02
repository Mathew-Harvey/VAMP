#!/usr/bin/env node

/**
 * Health Check Script for VAMP
 * Used by Docker and monitoring systems
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const health = JSON.parse(data);

      if (health.status === 'healthy') {
        console.log('✅ Health check passed');
        process.exit(0);
      } else {
        console.error('❌ Health check failed: unhealthy status');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Health check failed: invalid response');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Health check failed:', error.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('❌ Health check failed: timeout');
  req.destroy();
  process.exit(1);
});

req.end();
