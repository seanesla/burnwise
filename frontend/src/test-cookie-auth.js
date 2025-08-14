/**
 * Test Cookie-Based Authentication
 * Verifies frontend-backend cookie integration
 */

import axios from 'axios';

const API_BASE = 'http://localhost:5001';
axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true;

class CookieAuthTester {
  constructor() {
    this.csrfToken = null;
  }

  async test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ ${name}:`, error.message);
      return false;
    }
  }

  async runTests() {
    console.log('🍪 COOKIE AUTHENTICATION TEST\n');
    
    const results = [];
    
    // Test 1: Get CSRF Token
    results.push(await this.test('Get CSRF Token', async () => {
      const response = await axios.get('/api/auth/csrf-token');
      this.csrfToken = response.data.csrfToken;
      
      if (!this.csrfToken) {
        throw new Error('No CSRF token received');
      }
      
      // Set CSRF token for future requests
      axios.defaults.headers.common['X-CSRF-Token'] = this.csrfToken;
      console.log(`   CSRF Token: ${this.csrfToken.substring(0, 10)}...`);
    }));
    
    // Test 2: Login with Cookies
    results.push(await this.test('Login with Cookie Authentication', async () => {
      const response = await axios.post('/api/auth/login', {
        email: 'robert@goldenfields.com',
        password: 'demo123'
      });
      
      if (!response.data.success) {
        throw new Error('Login failed');
      }
      
      // Check that we're NOT receiving token in response body
      if (response.data.token) {
        throw new Error('Token in response body - should be in httpOnly cookie only!');
      }
      
      console.log(`   User: ${response.data.user.name} (Farm #${response.data.user.farmId})`);
    }));
    
    // Test 3: Verify Session with Cookie
    results.push(await this.test('Verify Session via Cookie', async () => {
      const response = await axios.get('/api/auth/verify');
      
      if (!response.data.valid) {
        throw new Error('Session not valid');
      }
      
      console.log(`   Session valid for: ${response.data.user.email}`);
    }));
    
    // Test 4: Make Authenticated Request
    results.push(await this.test('Access Protected Endpoint', async () => {
      const response = await axios.get('/api/farms');
      
      if (!response.data.success) {
        throw new Error('Could not access protected endpoint');
      }
      
      console.log(`   Accessed farms endpoint: ${response.data.data.length} farms`);
    }));
    
    // Test 5: Test CSRF Protection
    results.push(await this.test('CSRF Protection Active', async () => {
      // Remove CSRF token temporarily
      const savedToken = axios.defaults.headers.common['X-CSRF-Token'];
      delete axios.defaults.headers.common['X-CSRF-Token'];
      
      try {
        // This should fail without CSRF token
        await axios.post('/api/burn-requests', {
          farm_id: 1,
          acreage: 10
        });
        
        // If we get here, CSRF is not working
        throw new Error('CSRF protection not working - request succeeded without token');
      } catch (error) {
        if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
          // This is expected - CSRF protection is working
          console.log('   CSRF protection blocked request without token ✓');
        } else if (error.message.includes('CSRF protection not working')) {
          throw error;
        }
      } finally {
        // Restore CSRF token
        axios.defaults.headers.common['X-CSRF-Token'] = savedToken;
      }
    }));
    
    // Test 6: Logout Clears Cookies
    results.push(await this.test('Logout Clears Cookies', async () => {
      await axios.post('/api/auth/logout');
      
      // Try to verify session - should fail
      try {
        await axios.get('/api/auth/verify');
        throw new Error('Session still valid after logout');
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('   Cookies cleared successfully');
        } else {
          throw new Error('Unexpected error after logout');
        }
      }
    }));
    
    // Test 7: Rate Limiting
    results.push(await this.test('Rate Limiting on Login', async () => {
      const testEmail = `test${Date.now()}@test.com`;
      let rateLimited = false;
      
      // Make 6 failed login attempts
      for (let i = 1; i <= 6; i++) {
        try {
          await axios.post('/api/auth/login', {
            email: testEmail,
            password: 'wrongpass'
          });
        } catch (error) {
          if (error.response?.status === 429) {
            rateLimited = true;
            console.log(`   Rate limited after ${i} attempts`);
            break;
          }
        }
      }
      
      if (!rateLimited) {
        throw new Error('Rate limiting not working');
      }
    }));
    
    // Print Summary
    console.log('\n📊 TEST SUMMARY\n');
    const passed = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    const score = Math.round((passed / results.length) * 100);
    console.log(`\n🍪 Cookie Auth Score: ${score}%`);
    
    if (score === 100) {
      console.log('✅ All cookie authentication tests passed!');
      console.log('Frontend is properly configured for secure cookie-based auth.');
    } else {
      console.log('⚠️ Some tests failed. Check implementation.');
    }
    
    return score === 100;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.CookieAuthTester = CookieAuthTester;
  console.log('Cookie Auth Tester loaded. Run: new CookieAuthTester().runTests()');
}

export default CookieAuthTester;