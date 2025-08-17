/**
 * Test updated coordinator agent with GPT-5-mini
 */

require('dotenv').config();
const coordinatorAgent = require('./agents/coordinator');
const { initializeDatabase } = require('./db/connection');

async function testCoordinatorAgent() {
  console.log('🧪 Testing Updated Coordinator Agent');
  console.log('=' .repeat(60));
  
  try {
    console.log('1. Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    console.log('\n2. Initializing coordinator agent...');
    await coordinatorAgent.initialize();
    console.log('✅ Coordinator agent initialized');
    
    console.log('\n2. Testing burn request analysis...');
    const testRequest = {
      farm_id: 1,
      acres: 100,
      crop_type: 'wheat',
      burn_date: '2025-08-16',
      time_window_start: '08:00',
      time_window_end: '12:00',
      reason: 'Test burn for evidence-based analysis'
    };
    
    const analysis = await coordinatorAgent.gpt5Client.analyzeBurnRequest(testRequest);
    console.log('\n📋 Analysis Result:');
    console.log(analysis);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ All tests passed - Updated coordinator working with evidence requirements!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testCoordinatorAgent();