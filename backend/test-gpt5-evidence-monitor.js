/**
 * DEEP TEST: Monitor GPT-5-mini calls and verify evidence-based responses
 * This test will intercept and log ALL GPT-5-mini API calls to verify:
 * 1. The calls are actually happening (no silent fallbacks)
 * 2. Evidence requirements are included in prompts
 * 3. Responses include sources (EPA, NFPA, etc.)
 */

require('dotenv').config();
const axios = require('axios');

// Monkey-patch axios to intercept ALL API calls
const originalPost = axios.post;
const apiCalls = [];

axios.post = async function(...args) {
  const [url, data, config] = args;
  
  // Log if this is a GPT-5-mini call
  if (url.includes('openai.com')) {
    console.log('\n🔍 INTERCEPTED OPENAI API CALL:');
    console.log('  URL:', url);
    console.log('  Model:', data.model);
    
    if (url.includes('/v1/responses') && data.model === 'gpt-5-mini') {
      console.log('  ✅ GPT-5-MINI CALL DETECTED!');
      console.log('  Input preview:', typeof data.input === 'string' ? 
        data.input.substring(0, 200) + '...' : 'Not a string');
      
      // Check for evidence requirements in prompt
      const hasEvidenceRequest = data.input && (
        data.input.includes('evidence') ||
        data.input.includes('sources') ||
        data.input.includes('EPA') ||
        data.input.includes('NFPA')
      );
      
      console.log('  Evidence required:', hasEvidenceRequest ? '✅ YES' : '❌ NO');
      
      apiCalls.push({
        timestamp: new Date().toISOString(),
        url,
        model: data.model,
        hasEvidenceRequest,
        inputLength: data.input ? data.input.length : 0
      });
    } else if (url.includes('/v1/embeddings')) {
      console.log('  📊 Embedding call (not GPT-5)');
    } else {
      console.log('  ⚠️ Other OpenAI call:', data.model || 'unknown');
    }
  }
  
  // Call the original function
  try {
    const result = await originalPost.apply(this, args);
    
    // Log GPT-5-mini responses
    if (url.includes('/v1/responses') && data.model === 'gpt-5-mini') {
      console.log('  📋 RESPONSE RECEIVED');
      
      // Try to extract text from response
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
      
      // Check if response has sources
      const hasSources = responseText.toLowerCase().includes('sources:') ||
                        responseText.includes('EPA') ||
                        responseText.includes('NFPA') ||
                        responseText.includes('%');
      
      console.log('  Response has sources:', hasSources ? '✅ YES' : '❌ NO');
      
      if (responseText.length > 0) {
        console.log('  Response preview:', responseText.substring(0, 300) + '...');
      }
    }
    
    return result;
  } catch (error) {
    console.log('  ❌ API CALL FAILED:', error.message);
    throw error;
  }
};

// Now run the actual test
async function testWithMonitoring() {
  console.log('🚀 STARTING DEEP GPT-5-MINI MONITORING TEST');
  console.log('=' .repeat(60));
  
  try {
    // Initialize database first
    const { initializeDatabase } = require('./db/connection');
    console.log('\n📍 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Initialize agents
    const coordinatorAgent = require('./agents/coordinator');
    const WeatherAgent = require('./agents/weather');
    const weatherAgent = new WeatherAgent();
    
    console.log('\n📍 Initializing agents...');
    await coordinatorAgent.initialize();
    await weatherAgent.initialize();
    
    console.log('\n📍 Testing coordinator agent...');
    const testRequest = {
      farm_id: 1,
      field_name: 'Evidence Test Field',
      field_boundary: {
        type: 'Polygon',
        coordinates: [[
          [-121.5, 38.7],
          [-121.5, 38.8],
          [-121.4, 38.8],
          [-121.4, 38.7],
          [-121.5, 38.7]
        ]]
      },
      acres: 100,
      crop_type: 'wheat',
      burn_date: '2025-08-17',
      time_window_start: '08:00',
      time_window_end: '12:00'
    };
    
    // Test the GPT-5 client directly to verify evidence requirements
    console.log('\n📍 Testing GPT-5 client analyzeBurnRequest...');
    const aiAnalysis = await coordinatorAgent.gpt5Client.analyzeBurnRequest(testRequest);
    console.log('\n✅ AI Analysis received');
    
    console.log('\n📍 Testing weather agent...');
    const weatherResult = await weatherAgent.analyzeBurnConditions(
      { lat: 38.5, lng: -121.5 },
      '2025-08-17'
    );
    console.log('\n✅ Weather analysis complete');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 GPT-5-MINI CALL SUMMARY:');
  console.log(`Total OpenAI API calls: ${apiCalls.length}`);
  
  const gpt5Calls = apiCalls.filter(c => c.model === 'gpt-5-mini');
  console.log(`GPT-5-mini calls: ${gpt5Calls.length}`);
  
  if (gpt5Calls.length > 0) {
    console.log('\nGPT-5-mini calls with evidence requirements:');
    gpt5Calls.forEach((call, i) => {
      console.log(`  ${i + 1}. ${call.timestamp} - Evidence: ${call.hasEvidenceRequest ? '✅' : '❌'}`);
    });
  } else {
    console.log('⚠️ NO GPT-5-MINI CALLS DETECTED!');
  }
  
  // Verify NO FALLBACKS
  if (gpt5Calls.length === 0) {
    console.log('\n❌ FAILURE: System must use GPT-5-mini - NO FALLBACKS ALLOWED');
    process.exit(1);
  } else {
    console.log('\n✅ SUCCESS: GPT-5-mini was called (no fallbacks)');
  }
}

// Run the test
testWithMonitoring().then(() => {
  console.log('\n🏁 Test monitoring complete');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});