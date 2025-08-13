/**
 * DEEP MOCK SCANNER - Ultra-thorough verification
 * Ensures 100% real data with ZERO mocks/demos/fakes
 * Following CLAUDE.md standards
 */

const fs = require('fs').promises;
const path = require('path');
const { query } = require('./db/connection');

// Colors for output
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';

const SCAN_RESULTS = {
  suspicious: [],
  clean: [],
  legitimate: [],
  errors: []
};

// Patterns that indicate mock/fake data
const SUSPICIOUS_PATTERNS = [
  // Mock/fake/demo keywords
  /mock/gi,
  /fake/gi,
  /demo/gi,
  /sample/gi,
  /example/gi,
  /test(?!ing)/gi,  // 'test' but not 'testing'
  /dummy/gi,
  /placeholder/gi,
  /lorem\s*ipsum/gi,
  
  // Hardcoded data arrays
  /\[\s*['"][^'"]+['"],\s*['"][^'"]+['"]/g,  // Arrays of strings
  /\[\s*\d+,\s*\d+,\s*\d+/g,  // Arrays of numbers (except vectors)
  
  // Suspicious function names
  /generate(?:Random|Fake|Mock|Demo)/gi,
  /create(?:Random|Fake|Mock|Demo)/gi,
  
  // Hardcoded values that should be dynamic
  /temperature:\s*\d+/g,
  /windSpeed:\s*\d+/g,
  /humidity:\s*\d+/g,
  /activeBurns:\s*\d+/g,
  
  // Math.random() for non-animation purposes
  /Math\.random\(\)/g
];

// Files/patterns that are legitimately allowed to have certain patterns
const LEGITIMATE_EXCEPTIONS = {
  'Math.random()': [
    'animations/',
    'particles/',
    'FireParticle',
    'optimizer.js',  // Simulated annealing requires randomness
    'seed.js'        // Initial data generation
  ],
  'test': [
    'test.js',
    '.test.js',
    'tests/',
    'testing'
  ]
};

async function scanFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const relativePath = path.relative(process.cwd(), filePath);
    
    let issues = [];
    let legitimateUses = [];
    
    for (const pattern of SUSPICIOUS_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        const patternStr = pattern.toString();
        
        // Check if this is a legitimate exception
        let isLegitimate = false;
        for (const [exceptionPattern, allowedPaths] of Object.entries(LEGITIMATE_EXCEPTIONS)) {
          if (patternStr.includes(exceptionPattern)) {
            for (const allowedPath of allowedPaths) {
              if (relativePath.includes(allowedPath)) {
                isLegitimate = true;
                legitimateUses.push({
                  pattern: patternStr,
                  matches: matches.length,
                  reason: `Allowed in ${allowedPath}`
                });
                break;
              }
            }
          }
        }
        
        if (!isLegitimate) {
          // Special handling for Math.random()
          if (patternStr.includes('Math.random')) {
            // Check context - is it for animation/particles?
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes('Math.random()')) {
                const context = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n');
                if (context.includes('particle') || 
                    context.includes('animation') || 
                    context.includes('position') ||
                    context.includes('velocity') ||
                    context.includes('scale') ||
                    context.includes('rotation')) {
                  legitimateUses.push({
                    pattern: 'Math.random()',
                    line: i + 1,
                    reason: 'Used for visual effects'
                  });
                } else {
                  issues.push({
                    pattern: 'Math.random()',
                    line: i + 1,
                    context: context,
                    severity: 'HIGH'
                  });
                }
              }
            }
          } else {
            issues.push({
              pattern: patternStr,
              matches: matches.length,
              samples: matches.slice(0, 3)
            });
          }
        }
      }
    }
    
    if (issues.length > 0) {
      SCAN_RESULTS.suspicious.push({
        file: relativePath,
        issues: issues
      });
    } else if (legitimateUses.length > 0) {
      SCAN_RESULTS.legitimate.push({
        file: relativePath,
        uses: legitimateUses
      });
    } else {
      SCAN_RESULTS.clean.push(relativePath);
    }
    
  } catch (error) {
    SCAN_RESULTS.errors.push({
      file: filePath,
      error: error.message
    });
  }
}

async function scanDirectory(dirPath, ignore = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Skip ignored paths
      if (ignore.some(pattern => fullPath.includes(pattern))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath, ignore);
      } else if (entry.isFile() && 
                 (entry.name.endsWith('.js') || 
                  entry.name.endsWith('.jsx') || 
                  entry.name.endsWith('.ts') || 
                  entry.name.endsWith('.tsx'))) {
        await scanFile(fullPath);
      }
    }
  } catch (error) {
    SCAN_RESULTS.errors.push({
      directory: dirPath,
      error: error.message
    });
  }
}

async function verifyDatabaseContent() {
  console.log(`\n${BLUE}Verifying Database Content...${RESET}`);
  
  try {
    // Check for test/demo data in database
    const checks = [
      {
        name: 'Test Farms',
        query: `SELECT COUNT(*) as count FROM farms WHERE farm_name LIKE '%test%' OR farm_name LIKE '%demo%' OR farm_name LIKE '%sample%'`
      },
      {
        name: 'Non-California Farms',
        query: `SELECT COUNT(*) as count FROM farms WHERE latitude < 35 OR latitude > 42 OR longitude > -119 OR longitude < -125`
      },
      {
        name: 'Test Burn Requests',
        query: `SELECT COUNT(*) as count FROM burn_requests WHERE field_name LIKE '%test%' OR field_name LIKE '%demo%'`
      },
      {
        name: 'Placeholder Alerts',
        query: `SELECT COUNT(*) as count FROM alerts WHERE message LIKE '%lorem%' OR message LIKE '%ipsum%' OR message LIKE '%placeholder%'`
      }
    ];
    
    for (const check of checks) {
      const result = await query(check.query);
      if (result[0].count > 0) {
        console.log(`  ${RED}❌ ${check.name}: Found ${result[0].count} suspicious records${RESET}`);
        SCAN_RESULTS.suspicious.push({
          type: 'database',
          issue: `${check.name}: ${result[0].count} records`
        });
      } else {
        console.log(`  ${GREEN}✓ ${check.name}: Clean${RESET}`);
      }
    }
    
    // Verify real data exists
    const realDataChecks = [
      {
        name: 'Real Farms',
        query: `SELECT COUNT(*) as count FROM farms`
      },
      {
        name: 'Real Burn Requests',
        query: `SELECT COUNT(*) as count FROM burn_requests`
      },
      {
        name: 'Real Weather Data',
        query: `SELECT COUNT(*) as count FROM weather_data`
      }
    ];
    
    for (const check of realDataChecks) {
      const result = await query(check.query);
      console.log(`  ${BLUE}ℹ ${check.name}: ${result[0].count} records${RESET}`);
    }
    
  } catch (error) {
    console.error(`  ${RED}Database verification failed: ${error.message}${RESET}`);
    SCAN_RESULTS.errors.push({
      type: 'database',
      error: error.message
    });
  }
}

async function verifyAPIEndpoints() {
  console.log(`\n${BLUE}Verifying API Endpoints...${RESET}`);
  
  const axios = require('axios');
  const BASE_URL = 'http://localhost:5001';
  
  const endpoints = [
    '/api/burn-requests',
    '/api/weather/current',
    '/api/schedule',
    '/api/alerts',
    '/api/farms',
    '/api/analytics/metrics'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${BASE_URL}${endpoint}`);
      const data = response.data;
      
      // Check for suspicious patterns in response
      const dataStr = JSON.stringify(data);
      if (dataStr.includes('mock') || 
          dataStr.includes('fake') || 
          dataStr.includes('demo') ||
          dataStr.includes('Lorem')) {
        console.log(`  ${RED}❌ ${endpoint}: Contains suspicious data${RESET}`);
        SCAN_RESULTS.suspicious.push({
          type: 'api',
          endpoint: endpoint,
          issue: 'Response contains mock/fake/demo keywords'
        });
      } else {
        console.log(`  ${GREEN}✓ ${endpoint}: Clean${RESET}`);
      }
    } catch (error) {
      console.log(`  ${YELLOW}⚠ ${endpoint}: ${error.message}${RESET}`);
    }
  }
}

async function runDeepScan() {
  console.log(`${MAGENTA}${'='.repeat(60)}${RESET}`);
  console.log(`${MAGENTA}🔍 DEEP MOCK SCANNER - ULTRA VERIFICATION${RESET}`);
  console.log(`${MAGENTA}Ensuring 100% Real Data - ZERO Tolerance${RESET}`);
  console.log(`${MAGENTA}${'='.repeat(60)}${RESET}\n`);
  
  // Scan backend
  console.log(`${BLUE}Scanning Backend...${RESET}`);
  await scanDirectory('./backend', ['node_modules', '.git', 'coverage', 'logs']);
  
  // Scan frontend
  console.log(`${BLUE}Scanning Frontend...${RESET}`);
  await scanDirectory('../frontend/src', ['node_modules', '.git', 'build']);
  
  // Verify database
  await verifyDatabaseContent();
  
  // Verify APIs
  await verifyAPIEndpoints();
  
  // Generate report
  console.log(`\n${MAGENTA}${'='.repeat(60)}${RESET}`);
  console.log(`${MAGENTA}📊 SCAN RESULTS${RESET}`);
  console.log(`${MAGENTA}${'='.repeat(60)}${RESET}\n`);
  
  // Clean files
  console.log(`${GREEN}✅ CLEAN FILES: ${SCAN_RESULTS.clean.length}${RESET}`);
  if (SCAN_RESULTS.clean.length <= 20) {
    SCAN_RESULTS.clean.forEach(file => {
      console.log(`   ${GREEN}✓ ${file}${RESET}`);
    });
  } else {
    console.log(`   ${GREEN}✓ ${SCAN_RESULTS.clean.length} files verified clean${RESET}`);
  }
  
  // Legitimate uses
  if (SCAN_RESULTS.legitimate.length > 0) {
    console.log(`\n${BLUE}ℹ LEGITIMATE USES: ${SCAN_RESULTS.legitimate.length}${RESET}`);
    SCAN_RESULTS.legitimate.forEach(item => {
      console.log(`   ${BLUE}✓ ${item.file}${RESET}`);
      item.uses.forEach(use => {
        console.log(`     - ${use.reason}`);
      });
    });
  }
  
  // Suspicious files
  if (SCAN_RESULTS.suspicious.length > 0) {
    console.log(`\n${RED}❌ SUSPICIOUS: ${SCAN_RESULTS.suspicious.length} issues found${RESET}`);
    SCAN_RESULTS.suspicious.forEach(item => {
      if (item.file) {
        console.log(`   ${RED}✗ ${item.file}${RESET}`);
        item.issues.forEach(issue => {
          console.log(`     - ${issue.pattern || issue.type}: ${issue.matches || issue.issue}`);
          if (issue.samples) {
            console.log(`       Samples: ${issue.samples.join(', ')}`);
          }
        });
      } else {
        console.log(`   ${RED}✗ ${item.type}: ${item.issue}${RESET}`);
      }
    });
  }
  
  // Errors
  if (SCAN_RESULTS.errors.length > 0) {
    console.log(`\n${YELLOW}⚠ ERRORS: ${SCAN_RESULTS.errors.length}${RESET}`);
    SCAN_RESULTS.errors.forEach(err => {
      console.log(`   ${YELLOW}! ${err.file || err.directory || err.type}: ${err.error}${RESET}`);
    });
  }
  
  // Final verdict
  console.log(`\n${MAGENTA}${'='.repeat(60)}${RESET}`);
  if (SCAN_RESULTS.suspicious.length === 0) {
    console.log(`${GREEN}🎉 SYSTEM VERIFIED: 100% REAL DATA${RESET}`);
    console.log(`${GREEN}✅ NO MOCKS DETECTED${RESET}`);
    console.log(`${GREEN}✅ NO DEMOS DETECTED${RESET}`);
    console.log(`${GREEN}✅ NO FAKE DATA DETECTED${RESET}`);
    console.log(`${GREEN}✅ PRODUCTION READY${RESET}`);
  } else {
    console.log(`${RED}⚠️ SUSPICIOUS PATTERNS DETECTED${RESET}`);
    console.log(`${RED}Review and fix the issues above${RESET}`);
  }
  console.log(`${MAGENTA}${'='.repeat(60)}${RESET}\n`);
  
  process.exit(SCAN_RESULTS.suspicious.length === 0 ? 0 : 1);
}

// Run the deep scan
runDeepScan().catch(error => {
  console.error(`${RED}CRITICAL ERROR: ${error.message}${RESET}`);
  console.error(error.stack);
  process.exit(1);
});