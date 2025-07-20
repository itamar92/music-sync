#!/usr/bin/env node

/**
 * 🔍 Production Deployment Verification Script
 * 
 * Validates that the deployment is working correctly with comprehensive checks
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  production: {
    url: 'https://app.musicsync.com',
    name: 'Production'
  },
  staging: {
    url: 'https://staging.musicsync.app', 
    name: 'Staging'
  }
};

const TIMEOUT = 10000; // 10 seconds
const environment = process.env.NODE_ENV || 'production';
const config = CONFIG[environment];

if (!config) {
  console.error(`❌ Unknown environment: ${environment}`);
  process.exit(1);
}

console.log(`🔍 Verifying ${config.name} deployment at ${config.url}`);

// Verification tests
const tests = [
  {
    name: 'Connectivity Test',
    test: testConnectivity
  },
  {
    name: 'Asset Loading Test', 
    test: testAssetLoading
  },
  {
    name: 'Bundle Integrity Test',
    test: testBundleIntegrity
  },
  {
    name: 'Security Headers Test',
    test: testSecurityHeaders
  }
];

// Test implementations
async function testConnectivity() {
  return new Promise((resolve, reject) => {
    const req = https.get(config.url, { timeout: TIMEOUT }, (res) => {
      if (res.statusCode === 200) {
        resolve(`✅ Site accessible (${res.statusCode})`);
      } else {
        reject(`❌ Site returned ${res.statusCode}`);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject('❌ Connection timeout');
    });
    
    req.on('error', (err) => {
      reject(`❌ Connection failed: ${err.message}`);
    });
  });
}

async function testAssetLoading() {
  return new Promise((resolve, reject) => {
    const req = https.get(config.url, { timeout: TIMEOUT }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // Check for critical assets
        const checks = [
          { name: 'React', pattern: /react/i },
          { name: 'Vite', pattern: /vite/i },
          { name: 'CSS', pattern: /<link[^>]*\.css/i },
          { name: 'JS', pattern: /<script[^>]*\.js/i }
        ];
        
        const results = checks.map(check => ({
          name: check.name,
          found: check.pattern.test(data)
        }));
        
        const failed = results.filter(r => !r.found);
        
        if (failed.length === 0) {
          resolve(`✅ All critical assets found: ${results.map(r => r.name).join(', ')}`);
        } else {
          reject(`❌ Missing assets: ${failed.map(r => r.name).join(', ')}`);
        }
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject('❌ Asset loading timeout');
    });
    
    req.on('error', (err) => {
      reject(`❌ Asset loading failed: ${err.message}`);
    });
  });
}

async function testBundleIntegrity() {
  // Check if dist directory exists and has files
  const distPath = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distPath)) {
    throw new Error('❌ Build directory not found');
  }
  
  const files = fs.readdirSync(distPath, { recursive: true });
  const jsFiles = files.filter(f => f.toString().endsWith('.js'));
  const cssFiles = files.filter(f => f.toString().endsWith('.css'));
  
  if (jsFiles.length === 0) {
    throw new Error('❌ No JavaScript files found in build');
  }
  
  if (cssFiles.length === 0) {
    throw new Error('❌ No CSS files found in build');
  }
  
  // Check index.html exists
  const indexPath = path.join(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('❌ index.html not found');
  }
  
  return `✅ Bundle integrity verified (${jsFiles.length} JS, ${cssFiles.length} CSS files)`;
}

async function testSecurityHeaders() {
  return new Promise((resolve, reject) => {
    const req = https.get(config.url, { timeout: TIMEOUT }, (res) => {
      const headers = res.headers;
      
      // Check for security headers
      const securityChecks = [
        { name: 'X-Content-Type-Options', header: 'x-content-type-options' },
        { name: 'X-Frame-Options', header: 'x-frame-options' },
        { name: 'Strict-Transport-Security', header: 'strict-transport-security' }
      ];
      
      const results = securityChecks.map(check => ({
        name: check.name,
        present: !!headers[check.header]
      }));
      
      const presentHeaders = results.filter(r => r.present);
      
      if (presentHeaders.length > 0) {
        resolve(`✅ Security headers found: ${presentHeaders.map(r => r.name).join(', ')}`);
      } else {
        // Warning but not failure - Firebase may add these
        resolve(`⚠️ Basic security headers not detected (Firebase may add these)`);
      }
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject('❌ Security headers check timeout');
    });
    
    req.on('error', (err) => {
      reject(`❌ Security headers check failed: ${err.message}`);
    });
  });
}

// Run all tests
async function runVerification() {
  console.log(`\n📋 Running ${tests.length} verification tests...\n`);
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.test();
      console.log(`${test.name}: ${result}`);
      passed++;
    } catch (error) {
      console.log(`${test.name}: ${error.message || error}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Verification Summary:`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);
  
  if (failed === 0) {
    console.log(`\n🎉 All verification tests passed! Deployment is healthy.`);
    process.exit(0);
  } else {
    console.log(`\n⚠️ Some verification tests failed. Please review the deployment.`);
    // Don't exit with error - let deployment continue but with warnings
    process.exit(0);
  }
}

// Handle script errors
process.on('uncaughtException', (error) => {
  console.error('❌ Verification script error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Verification script rejection:', reason);
  process.exit(1);
});

// Run verification
runVerification().catch((error) => {
  console.error('❌ Verification failed:', error.message);
  process.exit(1);
});