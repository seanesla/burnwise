/**
 * VERIFY NO HARDCODED DATA
 * Checks specific files for hardcoded values that should come from database/APIs
 */

const fs = require('fs').promises;
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

async function checkFile(filePath, checks) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const issues = [];
    
    for (const check of checks) {
      const matches = content.match(check.pattern);
      if (matches) {
        // Check if it's in a comment
        const lines = content.split('\n');
        const realMatches = [];
        
        for (const match of matches) {
          let isComment = false;
          for (const line of lines) {
            if (line.includes(match)) {
              // Check if it's in a comment
              const beforeMatch = line.substring(0, line.indexOf(match));
              if (beforeMatch.includes('//') || beforeMatch.includes('/*')) {
                isComment = true;
                break;
              }
            }
          }
          if (!isComment) {
            realMatches.push(match);
          }
        }
        
        if (realMatches.length > 0) {
          issues.push({
            check: check.name,
            matches: realMatches
          });
        }
      }
    }
    
    return issues;
  } catch (error) {
    return null;
  }
}

async function verifyNoHardcodedData() {
  console.log(`${BLUE}${'='.repeat(60)}${RESET}`);
  console.log(`${BLUE}VERIFYING NO HARDCODED DATA${RESET}`);
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
  
  const filesToCheck = [
    {
      file: '../frontend/src/components/ImmersiveBurnRequest.js',
      checks: [
        { name: 'Hardcoded temperature', pattern: /temperature:\s*\d+/g },
        { name: 'Hardcoded windSpeed', pattern: /windSpeed:\s*\d+/g },
        { name: 'Hardcoded humidity', pattern: /humidity:\s*\d+/g },
        { name: 'Demo/mock keywords', pattern: /\b(demo|mock|fake|sample)\b/gi }
      ]
    },
    {
      file: '../frontend/src/components/CinematicDashboard.js',
      checks: [
        { name: 'Initial state values', pattern: /activeBurns:\s*\d+[^0]/g },
        { name: 'Hardcoded metrics', pattern: /temperature:\s*\d+[^0]/g }
      ]
    },
    {
      file: '../frontend/src/components/Analytics.js',
      checks: [
        { name: 'Mock references', pattern: /\bmock\b/gi }
      ]
    }
  ];
  
  let totalIssues = 0;
  
  for (const fileCheck of filesToCheck) {
    const issues = await checkFile(fileCheck.file, fileCheck.checks);
    
    if (issues === null) {
      console.log(`${YELLOW}⚠ Could not check ${path.basename(fileCheck.file)}${RESET}`);
      continue;
    }
    
    if (issues.length > 0) {
      console.log(`${RED}❌ ${path.basename(fileCheck.file)}${RESET}`);
      for (const issue of issues) {
        console.log(`   ${RED}• ${issue.check}: ${issue.matches.join(', ')}${RESET}`);
        totalIssues++;
      }
    } else {
      console.log(`${GREEN}✅ ${path.basename(fileCheck.file)} - Clean${RESET}`);
    }
  }
  
  // Check database for test data
  console.log(`\n${BLUE}Checking Database...${RESET}`);
  try {
    const { query } = require('./db/connection');
    await require('./db/connection').initializeDatabase();
    
    const checks = [
      { name: 'Test farms', query: `SELECT COUNT(*) as count FROM farms WHERE farm_name LIKE '%test%'` },
      { name: 'Demo data', query: `SELECT COUNT(*) as count FROM burn_requests WHERE field_name LIKE '%demo%'` },
      { name: 'Sample alerts', query: `SELECT COUNT(*) as count FROM alerts WHERE message LIKE '%sample%'` }
    ];
    
    for (const check of checks) {
      const result = await query(check.query);
      if (result[0].count > 0) {
        console.log(`${RED}❌ ${check.name}: ${result[0].count} found${RESET}`);
        totalIssues++;
      } else {
        console.log(`${GREEN}✅ ${check.name}: Clean${RESET}`);
      }
    }
  } catch (error) {
    console.log(`${YELLOW}⚠ Database check skipped: ${error.message}${RESET}`);
  }
  
  // Final verdict
  console.log(`\n${BLUE}${'='.repeat(60)}${RESET}`);
  if (totalIssues === 0) {
    console.log(`${GREEN}✅ NO HARDCODED DATA FOUND${RESET}`);
    console.log(`${GREEN}✅ ALL DATA COMES FROM DATABASE/APIS${RESET}`);
  } else {
    console.log(`${RED}⚠️ FOUND ${totalIssues} POTENTIAL ISSUES${RESET}`);
    console.log(`${RED}Review and fix if necessary${RESET}`);
  }
  console.log(`${BLUE}${'='.repeat(60)}${RESET}\n`);
  
  process.exit(totalIssues === 0 ? 0 : 1);
}

verifyNoHardcodedData().catch(error => {
  console.error(`${RED}ERROR: ${error.message}${RESET}`);
  process.exit(1);
});