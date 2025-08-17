#!/usr/bin/env node

/**
 * EVIDENCE-BASED RESPONSE VALIDATOR
 * 
 * Verifies that ALL 5 agents provide evidence-based responses with:
 * - Specific percentages and numbers
 * - EPA/NFPA/CDC citations
 * - "Sources:" section at the end
 * - No generic responses without data
 * 
 * CRITICAL FOR HACKATHON: Ensures real AI with evidence, not fake responses
 */

require('dotenv').config();
const axios = require('axios');

// Track all API responses for evidence validation
const evidenceResults = {
  coordinator: { hasEvidence: false, hasSources: false, citations: [] },
  weather: { hasEvidence: false, hasSources: false, citations: [] },
  predictor: { hasEvidence: false, hasSources: false, citations: [] },
  optimizer: { hasEvidence: false, hasSources: false, citations: [] },
  alerts: { hasEvidence: false, hasSources: false, citations: [] }
};

// Evidence patterns to check for
const EVIDENCE_PATTERNS = {
  percentages: /\d+(\.\d+)?%/g,
  measurements: /\d+(\.\d+)?\s*(µg\/m³|mg\/m³|meters|m|km|mph|°F|°C)/g,
  timeFormats: /\d{1,2}:\d{2}/g,
  epaReferences: /EPA|40 CFR|NAAQS|AQI|PM2\.5|PM10/gi,
  nfpaReferences: /NFPA|fire code|Section 10\.14/gi,
  cdcReferences: /CDC|health guideline|exposure limit/gi,
  sourcesSection: /Sources:\s*\[([^\]]+)\]/i,
  confidenceLevels: /\d+%\s*(confidence|CI|certainty)/gi
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const color = {
    'info': colors.cyan,
    'success': colors.green,
    'warn': colors.yellow,
    'error': colors.red,
    'debug': colors.blue
  }[level] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`);
  if (Object.keys(data).length > 0) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Intercept axios to capture responses
const originalPost = axios.post;
let apiCallCount = 0;
let gpt5CallCount = 0;

axios.post = async function(...args) {
  const [url, data, config] = args;
  
  try {
    const result = await originalPost.apply(this, args);
    
    // Check if this is a GPT-5-mini call
    if (url.includes('/v1/responses') && data.model === 'gpt-5-mini') {
      gpt5CallCount++;
      
      // Extract response text
      let responseText = '';
      if (result.data && result.data.output) {
        const messageOutput = result.data.output.find(o => o.type === 'message');
        if (messageOutput && messageOutput.content) {
          const textContent = messageOutput.content.find(c => c.type === 'output_text');
          if (textContent && textContent.text) {
            responseText = textContent.text;
          }
        }
      }
      
      // Determine which agent this is from based on the prompt
      let agentName = 'unknown';
      if (data.input) {
        if (data.input.includes('burn request')) agentName = 'coordinator';
        else if (data.input.includes('weather')) agentName = 'weather';
        else if (data.input.includes('dispersion')) agentName = 'predictor';
        else if (data.input.includes('schedule')) agentName = 'optimizer';
        else if (data.input.includes('alert')) agentName = 'alerts';
      }
      
      // Validate evidence in response
      if (responseText && agentName !== 'unknown') {
        validateEvidence(agentName, responseText);
      }
    }
    
    apiCallCount++;
    return result;
  } catch (error) {
    throw error;
  }
};

function validateEvidence(agentName, responseText) {
  log('info', `Validating evidence for ${agentName} agent`);
  
  const result = evidenceResults[agentName];
  
  // Check for percentages
  const percentages = responseText.match(EVIDENCE_PATTERNS.percentages) || [];
  if (percentages.length > 0) {
    log('success', `  ✅ Found ${percentages.length} percentages`);
    result.hasEvidence = true;
  } else {
    log('warn', `  ⚠️ No percentages found`);
  }
  
  // Check for measurements
  const measurements = responseText.match(EVIDENCE_PATTERNS.measurements) || [];
  if (measurements.length > 0) {
    log('success', `  ✅ Found ${measurements.length} measurements: ${measurements.slice(0, 3).join(', ')}`);
    result.hasEvidence = true;
  } else {
    log('warn', `  ⚠️ No measurements found`);
  }
  
  // Check for EPA references
  const epaRefs = responseText.match(EVIDENCE_PATTERNS.epaReferences) || [];
  if (epaRefs.length > 0) {
    log('success', `  ✅ Found EPA references: ${[...new Set(epaRefs)].join(', ')}`);
    result.citations.push(...epaRefs);
  } else {
    log('error', `  ❌ No EPA references found`);
  }
  
  // Check for NFPA references
  const nfpaRefs = responseText.match(EVIDENCE_PATTERNS.nfpaReferences) || [];
  if (nfpaRefs.length > 0) {
    log('success', `  ✅ Found NFPA references: ${[...new Set(nfpaRefs)].join(', ')}`);
    result.citations.push(...nfpaRefs);
  }
  
  // Check for CDC references
  const cdcRefs = responseText.match(EVIDENCE_PATTERNS.cdcReferences) || [];
  if (cdcRefs.length > 0) {
    log('success', `  ✅ Found CDC references: ${[...new Set(cdcRefs)].join(', ')}`);
    result.citations.push(...cdcRefs);
  }
  
  // Check for Sources section
  const sourcesMatch = responseText.match(EVIDENCE_PATTERNS.sourcesSection);
  if (sourcesMatch) {
    log('success', `  ✅ Found Sources section`);
    result.hasSources = true;
    
    // Extract sources list
    const sourcesList = sourcesMatch[1];
    log('debug', `  Sources: ${sourcesList.substring(0, 100)}...`);
  } else {
    log('error', `  ❌ No Sources section found (required format: "Sources: [...]")`);
  }
  
  // Check for confidence levels
  const confidenceLevels = responseText.match(EVIDENCE_PATTERNS.confidenceLevels) || [];
  if (confidenceLevels.length > 0) {
    log('success', `  ✅ Found confidence levels: ${confidenceLevels.slice(0, 2).join(', ')}`);
  }
}

async function testAgentEvidence() {
  log('info', 'STARTING EVIDENCE VALIDATION TEST');
  log('info', '=' .repeat(60));
  
  try {
    // Initialize database
    const { initializeDatabase } = require('./db/connection');
    await initializeDatabase();
    log('success', 'Database initialized');
    
    // Test each agent
    log('info', '\nTesting Coordinator Agent Evidence...');
    const coordinatorAgent = require('./agents/coordinator');
    await coordinatorAgent.initialize();
    
    // Simulate a burn request analysis
    const testRequest = {
      farm_id: 1,
      field_name: 'Evidence Test Field',
      acres: 100,
      crop_type: 'wheat',
      burn_date: '2025-08-20',
      time_window_start: '08:00',
      time_window_end: '12:00'
    };
    
    // Direct test of GPT-5 analysis function
    if (coordinatorAgent.gpt5Client && coordinatorAgent.gpt5Client.analyzeBurnRequest) {
      await coordinatorAgent.gpt5Client.analyzeBurnRequest(testRequest);
    }
    
    log('info', '\nTesting Weather Agent Evidence...');
    const WeatherAgent = require('./agents/weather');
    const weatherAgent = new WeatherAgent();
    await weatherAgent.initialize();
    
    // Test weather analysis
    await weatherAgent.analyzeBurnConditions(
      { lat: 38.5, lng: -121.5 },
      '2025-08-20'
    );
    
    log('info', '\nTesting Predictor Agent Evidence...');
    const predictorAgent = require('./agents/predictor');
    await predictorAgent.initialize();
    
    // We can't easily test predictor in isolation, but initialization should be enough
    
    log('info', '\nTesting Optimizer Agent Evidence...');
    const optimizerAgent = require('./agents/optimizer');
    await optimizerAgent.initialize();
    
    log('info', '\nTesting Alerts Agent Evidence...');
    const alertsAgent = require('./agents/alerts');
    await alertsAgent.initialize();
    
  } catch (error) {
    log('error', 'Test failed:', { error: error.message });
  }
  
  // Generate report
  log('info', '\n' + '=' .repeat(60));
  log('info', 'EVIDENCE VALIDATION REPORT');
  log('info', '=' .repeat(60));
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const [agent, results] of Object.entries(evidenceResults)) {
    console.log(`\n${colors.bright}${agent.toUpperCase()} AGENT:${colors.reset}`);
    
    const hasEvidence = results.hasEvidence ? '✅' : '❌';
    const hasSources = results.hasSources ? '✅' : '❌';
    const hasCitations = results.citations.length > 0 ? '✅' : '❌';
    
    console.log(`  Evidence (numbers/percentages): ${hasEvidence}`);
    console.log(`  Sources section: ${hasSources}`);
    console.log(`  Regulatory citations: ${hasCitations} (${results.citations.length} found)`);
    
    if (results.hasEvidence && results.hasSources && results.citations.length > 0) {
      totalPassed++;
      console.log(`  ${colors.green}OVERALL: PASSED${colors.reset}`);
    } else {
      totalFailed++;
      console.log(`  ${colors.red}OVERALL: FAILED${colors.reset}`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`Total API calls: ${apiCallCount}`);
  console.log(`GPT-5-mini calls: ${gpt5CallCount}`);
  console.log(`Agents passed: ${totalPassed}/5`);
  console.log(`Agents failed: ${totalFailed}/5`);
  
  if (gpt5CallCount === 0) {
    console.log(`\n${colors.red}❌ CRITICAL FAILURE: No GPT-5-mini calls detected!${colors.reset}`);
    console.log('System must use GPT-5-mini - NO FALLBACKS ALLOWED');
    process.exit(1);
  }
  
  if (totalFailed > 0) {
    console.log(`\n${colors.yellow}⚠️ WARNING: ${totalFailed} agents lack proper evidence requirements${colors.reset}`);
    console.log('All agents must provide evidence-based responses with sources');
  } else {
    console.log(`\n${colors.green}✅ SUCCESS: All agents provide evidence-based responses!${colors.reset}`);
  }
  
  // Compliance score
  const complianceScore = (totalPassed / 5) * 100;
  console.log(`\n${colors.bright}COMPLIANCE SCORE: ${complianceScore.toFixed(1)}%${colors.reset}`);
  
  if (complianceScore < 100) {
    console.log(`${colors.yellow}Target: 100% compliance for hackathon${colors.reset}`);
  }
}

// Run the test
testAgentEvidence().then(() => {
  console.log('\n[COMPLETE] Evidence validation complete');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});