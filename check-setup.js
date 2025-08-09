#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔥 BURNWISE Setup Checker\n');
console.log('=' .repeat(50));

let errors = [];
let warnings = [];

// Check backend .env
const backendEnvPath = path.join(__dirname, 'backend', '.env');
if (!fs.existsSync(backendEnvPath)) {
  errors.push('❌ Backend .env file not found. Copy backend/.env.example to backend/.env');
} else {
  const envContent = fs.readFileSync(backendEnvPath, 'utf8');
  
  const requiredBackendVars = [
    'TIDB_HOST',
    'TIDB_USER', 
    'TIDB_PASSWORD',
    'OPENWEATHERMAP_API_KEY'
  ];
  
  requiredBackendVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (!match || match[1].includes('REPLACE_WITH') || match[1].includes('your-')) {
      errors.push(`❌ ${varName} not configured in backend/.env`);
    }
  });
  
  const optionalBackendVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER'
  ];
  
  optionalBackendVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (!match || match[1].includes('REPLACE_WITH')) {
      warnings.push(`⚠️  ${varName} not configured (SMS alerts will be disabled)`);
    }
  });
}

// Check frontend .env
const frontendEnvPath = path.join(__dirname, 'frontend', '.env');
if (!fs.existsSync(frontendEnvPath)) {
  errors.push('❌ Frontend .env file not found. Create frontend/.env');
} else {
  const envContent = fs.readFileSync(frontendEnvPath, 'utf8');
  
  const requiredFrontendVars = ['REACT_APP_MAPBOX_TOKEN'];
  
  requiredFrontendVars.forEach(varName => {
    const regex = new RegExp(`^${varName}=(.+)$`, 'm');
    const match = envContent.match(regex);
    if (!match || match[1].includes('REPLACE_WITH') || match[1].includes('YOUR_')) {
      errors.push(`❌ ${varName} not configured in frontend/.env`);
    }
  });
}

// Check if node_modules exist
if (!fs.existsSync(path.join(__dirname, 'backend', 'node_modules'))) {
  errors.push('❌ Backend dependencies not installed. Run: npm run backend:install');
}

if (!fs.existsSync(path.join(__dirname, 'frontend', 'node_modules'))) {
  errors.push('❌ Frontend dependencies not installed. Run: npm run frontend:install');
}

console.log('\n📋 Setup Status:\n');

if (errors.length > 0) {
  console.log('ERRORS (must fix):');
  errors.forEach(err => console.log('  ' + err));
}

if (warnings.length > 0) {
  console.log('\nWARNINGS (optional):');
  warnings.forEach(warn => console.log('  ' + warn));
}

if (errors.length === 0) {
  console.log('✅ All required configurations are set!');
  console.log('\n🚀 Ready to start:');
  console.log('  1. Initialize database: npm run seed');
  console.log('  2. Start application: npm run dev');
  console.log('  3. Open browser: http://localhost:3000');
} else {
  console.log('\n📝 Setup Instructions:');
  console.log('  1. Get API keys:');
  console.log('     - TiDB: https://tidbcloud.com');
  console.log('     - OpenWeatherMap: https://openweathermap.org/api');
  console.log('     - Mapbox: https://www.mapbox.com');
  console.log('     - Twilio (optional): https://www.twilio.com');
  console.log('  2. Configure environment files as indicated above');
  console.log('  3. Run this check again: node check-setup.js');
}

console.log('\n' + '='.repeat(50));
process.exit(errors.length > 0 ? 1 : 0);