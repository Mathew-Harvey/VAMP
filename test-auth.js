#!/usr/bin/env node

/**
 * Authentication Test Script
 * Tests the login and registration endpoints
 */

const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, response });
        } catch (error) {
          resolve({ status: res.statusCode, response: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAuth() {
  const baseUrl = 'http://localhost:3000';

  console.log('🧪 Testing VAMP Authentication...\n');

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    const registerOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const registerResult = await makeRequest(registerOptions, registerData);
    console.log(`Registration result: ${registerResult.status}`, registerResult.response);

    if (registerResult.status === 201) {
      console.log('✅ Registration successful\n');
    } else {
      console.log('❌ Registration failed\n');
    }

    // Test 2: Login with the registered user
    console.log('2. Testing user login...');
    const loginData = {
      email: 'test@example.com',
      password: 'TestPassword123'
    };

    const loginOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const loginResult = await makeRequest(loginOptions, loginData);
    console.log(`Login result: ${loginResult.status}`, loginResult.response);

    if (loginResult.status === 200 && loginResult.response.user) {
      console.log('✅ Login successful\n');
    } else {
      console.log('❌ Login failed\n');
    }

    // Test 3: Check session
    console.log('3. Testing session check...');
    const sessionOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/session',
      method: 'GET'
    };

    const sessionResult = await makeRequest(sessionOptions);
    console.log(`Session result: ${sessionResult.status}`, sessionResult.response);

    if (sessionResult.status === 200 && sessionResult.response.user) {
      console.log('✅ Session valid\n');
    } else {
      console.log('❌ Session invalid\n');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testAuth();
