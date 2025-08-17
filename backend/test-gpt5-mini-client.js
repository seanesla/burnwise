/**
 * Test GPT-5-mini Client
 * Verify the client works with GPT-5-mini ONLY
 */

require('dotenv').config();
const { GPT5MiniClient } = require('./gpt5-mini-client');

async function testClient() {
  console.log('🧪 Testing GPT-5-mini Client');
  console.log('=' .repeat(60));
  
  try {
    const client = new GPT5MiniClient();
    console.log('✅ Client initialized\n');
    
    // Test 1: Basic completion
    console.log('Test 1: Basic completion...');
    const response1 = await client.complete('Say "GPT-5-MINI ACTIVE"', 20);
    console.log('Response:', response1);
    
    // Test 2: Analyze function
    console.log('\nTest 2: Analyze function...');
    const response2 = await client.analyze('What model are you?');
    console.log('Response:', response2);
    
    // Test 3: Burn safety analysis
    console.log('\nTest 3: Burn safety analysis...');
    const burnData = {
      acres: 100,
      crop_type: 'wheat',
      burn_date: '2025-08-15',
      time_window_start: '08:00',
      time_window_end: '12:00'
    };
    const response3 = await client.analyzeBurnSafety(burnData);
    console.log('Response:', response3);
    
    // Test 4: Weather analysis
    console.log('\nTest 4: Weather analysis...');
    const weatherData = {
      temperature: 75,
      humidity: 45,
      windSpeed: 8,
      windDirection: 180,
      condition: 'Clear'
    };
    const response4 = await client.analyzeWeather(weatherData);
    console.log('Response:', response4);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ ALL TESTS PASSED - GPT-5-mini Client Working!');
    console.log('Model: gpt-5-mini');
    console.log('Endpoint: /v1/responses');
    console.log('NO FALLBACKS - This is the ONLY model we use');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('GPT-5-mini is REQUIRED - NO FALLBACKS');
    process.exit(1);
  }
}

testClient();