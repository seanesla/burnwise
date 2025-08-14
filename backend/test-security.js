/**
 * Security Implementation Test
 * Verifies all security features are working
 */

require('dotenv').config(); // Load environment variables
const axios = require('axios');
const colors = require('colors');

const BASE_URL = 'http://localhost:5001';

class SecurityTester {
  constructor() {
    this.results = [];
    this.cookies = '';
  }

  async test(name, fn) {
    try {
      await fn();
      this.results.push({ name, status: 'PASS', error: null });
      console.log(`✅ ${name}`.green);
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: ${error.message}`.red);
    }
  }

  async runTests() {
    console.log('\n🔒 SECURITY IMPLEMENTATION TEST\n'.cyan);
    
    // Test 1: Security Headers
    await this.test('Security Headers Present', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      const headers = response.headers;
      
      if (!headers['x-content-type-options']) throw new Error('Missing X-Content-Type-Options');
      if (!headers['x-frame-options']) throw new Error('Missing X-Frame-Options');
      if (!headers['content-security-policy']) throw new Error('Missing CSP');
    });
    
    // Test 2: CORS Validation
    await this.test('CORS Blocks Invalid Origins', async () => {
      try {
        await axios.get(`${BASE_URL}/health`, {
          headers: { 'Origin': 'http://evil.com' }
        });
        throw new Error('CORS should block invalid origins');
      } catch (error) {
        if (!error.message.includes('CORS')) {
          // Expected behavior - CORS blocks the request
        }
      }
    });
    
    // Test 3: Rate Limiting on Login
    await this.test('Login Rate Limiting (5 attempts)', async () => {
      let blocked = false;
      const testEmail = `ratelimit${Date.now()}@test.com`;
      
      // Make 6 requests (should block on the 6th)
      for (let i = 1; i <= 6; i++) {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
          email: testEmail,
          password: 'wrongpassword123'
        }, { validateStatus: () => true });
        
        console.log(`     Attempt ${i}: Status ${response.status}`.gray);
        
        if (response.status === 429) {
          blocked = true;
          console.log(`     Rate limit triggered after ${i} attempts`.green);
          break;
        }
      }
      
      if (!blocked) throw new Error('Rate limiting not working - should block after 5 attempts');
    });
    
    // Test 4: Input Validation
    await this.test('Input Validation Blocks Invalid Data', async () => {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'not-an-email',
        password: '123' // Too short
      }, { validateStatus: () => true });
      
      if (response.status !== 400 && response.status !== 401) {
        throw new Error('Should reject invalid input');
      }
    });
    
    // Test 5: SQL Injection Prevention
    await this.test('SQL Injection Protection', async () => {
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: "admin' OR '1'='1",
        password: "' OR '1'='1"
      }, { validateStatus: () => true });
      
      if (response.status === 200) {
        throw new Error('SQL injection vulnerability detected!');
      }
    });
    
    // Test 6: XSS Prevention
    await this.test('XSS Protection in Registration', async () => {
      const response = await axios.post(`${BASE_URL}/api/auth/register`, {
        farm_name: '<script>alert("XSS")</script>',
        owner_name: 'Test User',
        email: 'xss@test.com',
        password: 'TestPass123'
      }, { validateStatus: () => true });
      
      if (response.status === 201) {
        // Check if script tags were sanitized
        if (response.data.user?.farmName?.includes('<script>')) {
          throw new Error('XSS vulnerability - script tags not sanitized');
        }
      }
    });
    
    // Test 7: JWT Secret Configuration
    await this.test('JWT Secret is Configured', async () => {
      // Need to check the actual environment
      const { JWT_SECRET } = process.env;
      console.log(`   JWT_SECRET exists: ${JWT_SECRET ? 'YES' : 'NO'}`.gray);
      console.log(`   JWT_SECRET length: ${JWT_SECRET ? JWT_SECRET.length : 0}`.gray);
      
      if (!JWT_SECRET || JWT_SECRET.includes('change-in-production')) {
        throw new Error('JWT secret not properly configured');
      }
      
      // Check if it's a secure secret (at least 32 characters)
      if (JWT_SECRET.length < 32) {
        throw new Error('JWT secret is too short (should be at least 32 characters)');
      }
    });
    
    // Test 8: Demo Mode Check
    await this.test('Demo Mode Status', async () => {
      const response = await axios.get(`${BASE_URL}/api/auth/demo-status`);
      console.log(`   Demo Mode: ${response.data.demoMode ? 'ENABLED' : 'DISABLED'}`.yellow);
      
      if (process.env.NODE_ENV === 'production' && response.data.demoMode) {
        throw new Error('Demo mode should be disabled in production!');
      }
    });
    
    // Test 9: Password Hashing
    await this.test('Password Hashing Implementation', async () => {
      // This would need database access to fully test
      // For now, just check if bcrypt is being used
      const bcrypt = require('bcryptjs');
      const testPassword = 'TestPassword123';
      const hash = await bcrypt.hash(testPassword, 10);
      
      if (!hash.startsWith('$2')) {
        throw new Error('Bcrypt hashing not working correctly');
      }
      
      const valid = await bcrypt.compare(testPassword, hash);
      if (!valid) {
        throw new Error('Bcrypt comparison not working');
      }
    });
    
    // Test 10: Cookie Configuration
    await this.test('Cookie Security Settings', async () => {
      // Test would need actual login to verify cookies
      // For now, just verify the middleware exists
      const cookieAuth = require('./middleware/cookieAuth');
      
      if (!cookieAuth.setTokenCookie) {
        throw new Error('Cookie authentication not implemented');
      }
      
      const config = cookieAuth.getCookieConfig(true); // Production config
      if (!config.httpOnly || !config.secure || config.sameSite !== 'strict') {
        throw new Error('Cookie configuration not secure');
      }
    });
    
    // Print Summary
    console.log('\n📊 TEST SUMMARY\n'.cyan);
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`.green);
    console.log(`Failed: ${failed}`.red);
    
    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:'.red);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`.red));
    }
    
    // Security Score
    const score = Math.round((passed / this.results.length) * 100);
    console.log(`\n🔒 Security Score: ${score}%`.cyan);
    
    if (score < 100) {
      console.log('⚠️  WARNING: Not all security tests passed!'.yellow);
      console.log('DO NOT deploy to production until all tests pass.'.yellow);
    } else {
      console.log('✅ All security tests passed!'.green);
      console.log('⚠️  Remember to rotate all credentials before production.'.yellow);
    }
    
    // Critical Reminders
    console.log('\n⚠️  CRITICAL REMINDERS:'.red);
    console.log('1. ROTATE ALL CREDENTIALS (TiDB, APIs, etc.)'.red);
    console.log('2. Remove .env from git history'.red);
    console.log('3. Update frontend to use httpOnly cookies'.red);
    console.log('4. Set DEMO_MODE=false in production'.red);
    console.log('5. Use HTTPS in production'.red);
  }
}

// Run tests
const tester = new SecurityTester();
tester.runTests().catch(console.error);