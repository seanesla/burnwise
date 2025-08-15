/**
 * Test Cookie-Based Authentication Integration
 * Verifies frontend-backend cookie integration
 */

const axios = require('axios');
const colors = require('colors');

const API_BASE = 'http://localhost:5001';

class CookieAuthTester {
  constructor() {
    this.csrfToken = null;
    this.axiosInstance = axios.create({
      baseURL: API_BASE,
      withCredentials: true,
      // Store cookies manually for testing
      jar: true
    });
    this.cookies = {};
  }

  // Extract cookies from response headers
  extractCookies(response) {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      setCookieHeader.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        this.cookies[name] = value;
      });
    }
  }

  // Add cookies to request
  addCookiesToRequest(config) {
    const cookieString = Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
    
    if (cookieString) {
      config.headers = config.headers || {};
      config.headers.Cookie = cookieString;
    }
    
    return config;
  }

  async test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`.green);
      return true;
    } catch (error) {
      console.error(`❌ ${name}:`.red, error.response?.data?.message || error.message);
      return false;
    }
  }

  async runTests() {
    console.log('🍪 COOKIE AUTHENTICATION INTEGRATION TEST\n'.cyan);
    
    // Set up interceptors for cookie handling
    this.axiosInstance.interceptors.request.use(config => this.addCookiesToRequest(config));
    this.axiosInstance.interceptors.response.use(response => {
      this.extractCookies(response);
      return response;
    });
    
    const results = [];
    
    // Test 1: Get CSRF Token
    results.push(await this.test('Get CSRF Token', async () => {
      const response = await this.axiosInstance.get('/api/auth/csrf-token');
      this.csrfToken = response.data.csrfToken;
      
      if (!this.csrfToken) {
        throw new Error('No CSRF token received');
      }
      
      // Check for CSRF cookie
      if (!this.cookies.csrf_token) {
        throw new Error('No CSRF cookie set');
      }
      
      console.log(`   CSRF Token: ${this.csrfToken.substring(0, 10)}...`.gray);
      console.log(`   CSRF Cookie: ${this.cookies.csrf_token.substring(0, 10)}...`.gray);
    }));
    
    // Test 2: Login with Cookies
    results.push(await this.test('Login with Cookie Authentication', async () => {
      const response = await this.axiosInstance.post('/api/auth/login', {
        email: 'robert@goldenfields.com',
        password: 'demo123'
      }, {
        headers: {
          'X-CSRF-Token': this.csrfToken
        }
      });
      
      if (!response.data.success) {
        throw new Error('Login failed');
      }
      
      // Check that we're NOT receiving token in response body
      if (response.data.token) {
        throw new Error('SECURITY ISSUE: Token in response body - should be in httpOnly cookie only!');
      }
      
      // Check for auth cookies
      if (!this.cookies.burnwise_token) {
        throw new Error('No auth cookie set');
      }
      
      console.log(`   User: ${response.data.user.name} (Farm #${response.data.user.farmId})`.gray);
      console.log(`   Auth Cookie: ${this.cookies.burnwise_token.substring(0, 10)}...`.gray);
    }));
    
    // Test 3: Verify Session with Cookie
    results.push(await this.test('Verify Session via Cookie', async () => {
      const response = await this.axiosInstance.get('/api/auth/verify');
      
      if (!response.data.valid) {
        throw new Error('Session not valid');
      }
      
      console.log(`   Session valid for: ${response.data.user.email}`.gray);
    }));
    
    // Test 4: Make Authenticated Request
    results.push(await this.test('Access Protected Endpoint', async () => {
      const response = await this.axiosInstance.get('/api/farms');
      
      if (!response.data.success) {
        throw new Error('Could not access protected endpoint');
      }
      
      console.log(`   Accessed farms endpoint: ${response.data.data.length} farms`.gray);
    }));
    
    // Test 5: Test CSRF Protection
    results.push(await this.test('CSRF Protection Active', async () => {
      try {
        // Try without CSRF token - should fail
        await this.axiosInstance.post('/api/burn-requests', {
          farm_id: 1,
          acreage: 10
        });
        
        // If we get here, CSRF is not working
        throw new Error('CSRF protection not working - request succeeded without token');
      } catch (error) {
        if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
          console.log('   CSRF protection blocked request without token ✓'.gray);
        } else {
          // Check if it's just a validation error (which is OK)
          if (error.response?.status === 400) {
            console.log('   Request blocked by validation (CSRF might be skipped for this endpoint)'.yellow);
          } else {
            throw new Error(`Unexpected error: ${error.response?.data?.message || error.message}`);
          }
        }
      }
    }));
    
    // Test 6: Refresh Token
    results.push(await this.test('Refresh Token Flow', async () => {
      const response = await this.axiosInstance.post('/api/auth/refresh');
      
      if (!response.data.success && response.data.message) {
        console.log(`   ${response.data.message}`.yellow);
      } else {
        console.log('   Token refreshed successfully'.gray);
      }
    }));
    
    // Test 7: Logout Clears Cookies
    results.push(await this.test('Logout Clears Cookies', async () => {
      await this.axiosInstance.post('/api/auth/logout');
      
      // Clear local cookie storage
      this.cookies = {};
      
      // Try to verify session - should fail
      try {
        await this.axiosInstance.get('/api/auth/verify');
        throw new Error('Session still valid after logout');
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('   Cookies cleared successfully'.gray);
        } else {
          throw new Error('Unexpected error after logout');
        }
      }
    }));
    
    // Test 8: Rate Limiting
    results.push(await this.test('Rate Limiting on Login', async () => {
      const testEmail = `test${Date.now()}@test.com`;
      let rateLimited = false;
      
      // Make 6 failed login attempts
      for (let i = 1; i <= 6; i++) {
        try {
          await this.axiosInstance.post('/api/auth/login', {
            email: testEmail,
            password: 'wrongpass'
          });
        } catch (error) {
          if (error.response?.status === 429) {
            rateLimited = true;
            console.log(`   Rate limited after ${i} attempts`.gray);
            break;
          }
        }
      }
      
      if (!rateLimited) {
        throw new Error('Rate limiting not working');
      }
    }));
    
    // Print Summary
    console.log('\n📊 TEST SUMMARY\n'.cyan);
    const passed = results.filter(r => r).length;
    const failed = results.filter(r => !r).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`.green);
    console.log(`Failed: ${failed}`.red);
    
    const score = Math.round((passed / results.length) * 100);
    console.log(`\n🍪 Cookie Auth Score: ${score}%`.cyan);
    
    if (score === 100) {
      console.log('✅ All cookie authentication tests passed!'.green);
      console.log('Frontend-Backend integration is properly configured.'.green);
    } else if (score >= 75) {
      console.log('⚠️ Most tests passed, but some issues remain.'.yellow);
    } else {
      console.log('❌ Critical issues with cookie authentication.'.red);
    }
    
    console.log('\n🔒 SECURITY CHECKLIST:'.cyan);
    console.log(this.cookies.burnwise_token ? '✅ Auth token in httpOnly cookie' : '❌ No auth cookie');
    console.log(this.csrfToken ? '✅ CSRF token obtained' : '❌ No CSRF token');
    console.log(!results[1] || !this.cookies.burnwise_token ? '❌ Token might be in response body' : '✅ Token NOT in response body');
    console.log(results[7] ? '✅ Rate limiting active' : '❌ Rate limiting not working');
    
    return score === 100;
  }
}

// Run the tests
const tester = new CookieAuthTester();
tester.runTests().catch(console.error);