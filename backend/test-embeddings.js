/**
 * Test script to verify OpenAI embeddings are working
 * REAL test with text-embedding-3-large
 * NO MOCKS
 */

require('dotenv').config();
const embeddingService = require('./services/embeddingService');
const { initializeDatabase, query } = require('./db/connection');
const logger = require('./middleware/logger');

async function testEmbeddings() {
  console.log('=== Testing REAL OpenAI Embeddings ===\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY not set in .env');
    process.exit(1);
  }
  
  try {
    // Initialize database
    console.log('Connecting to TiDB...');
    await initializeDatabase();
    console.log('✓ Database connected\n');
    
    // Test 1: Weather Embedding (128-dim)
    console.log('Test 1: Weather Embedding (128-dimensional)');
    const weatherData = {
      temperature: 75,
      wind_speed: 12,
      wind_direction: 180,
      humidity: 45,
      pressure: 1013,
      visibility: 10,
      conditions: 'Partly cloudy',
      cloud_coverage: 30
    };
    
    const weatherEmbedding = await embeddingService.generateWeatherEmbedding(weatherData);
    console.log(`✓ Weather embedding generated: ${weatherEmbedding.length} dimensions`);
    console.log(`  Sample values: [${weatherEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);
    
    // Test 2: Smoke Embedding (64-dim)
    console.log('Test 2: Smoke Embedding (64-dimensional)');
    const smokeData = {
      plume_height: 150,
      plume_width: 200,
      travel_distance: 5,
      max_concentration: 35,
      wind_direction: 180,
      dispersion_rate: 0.8,
      affected_area_km2: 2.5,
      duration_hours: 4,
      inversion_risk: 'low'
    };
    
    const smokeEmbedding = await embeddingService.generateSmokeEmbedding(smokeData);
    console.log(`✓ Smoke embedding generated: ${smokeEmbedding.length} dimensions`);
    console.log(`  Sample values: [${smokeEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);
    
    // Test 3: Burn Embedding (32-dim)
    console.log('Test 3: Burn Embedding (32-dimensional)');
    const burnData = {
      acres: 150,
      crop_type: 'wheat',
      reason: 'pest control',
      time_window: '08:00-12:00',
      priority: 'high',
      season: 'fall',
      field_prep: 'completed',
      previous_burns: 2,
      neighboring_farms: 3
    };
    
    const burnEmbedding = await embeddingService.generateBurnEmbedding(burnData);
    console.log(`✓ Burn embedding generated: ${burnEmbedding.length} dimensions`);
    console.log(`  Sample values: [${burnEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);
    
    // Test 4: Decision Embedding (32-dim)
    console.log('Test 4: Decision Embedding (32-dimensional)');
    const decisionData = {
      decision: 'MARGINAL',
      confidence: 0.75,
      reasons: ['Wind speed is borderline', 'Humidity is marginal'],
      risk_level: 'medium',
      requires_approval: true,
      weather_impact: 'Wind: MARGINAL, Humidity: MARGINAL, Temp: SAFE',
      conflict_score: 0.3
    };
    
    const decisionEmbedding = await embeddingService.generateDecisionEmbedding(decisionData);
    console.log(`✓ Decision embedding generated: ${decisionEmbedding.length} dimensions`);
    console.log(`  Sample values: [${decisionEmbedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);
    
    // Test 5: Similarity Calculation
    console.log('Test 5: Similarity Calculation');
    const similarity = embeddingService.calculateSimilarity(
      burnEmbedding,
      burnEmbedding // Same embedding should have similarity = 1
    );
    console.log(`✓ Self-similarity: ${similarity.toFixed(4)} (should be ~1.0)\n`);
    
    // Test 6: Store in Database
    console.log('Test 6: Database Storage');
    const testResult = await query(`
      INSERT INTO weather_analyses 
      (burn_date, latitude, longitude, wind_speed, humidity, temperature,
       visibility, decision, requires_approval, reasons, confidence,
       weather_embedding, decision_embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      new Date().toISOString().split('T')[0],
      45.123,
      -122.456,
      weatherData.wind_speed,
      weatherData.humidity,
      weatherData.temperature,
      weatherData.visibility,
      'MARGINAL',
      true,
      JSON.stringify(['Test embedding storage']),
      0.75,
      JSON.stringify(weatherEmbedding),
      JSON.stringify(decisionEmbedding)
    ]);
    
    console.log(`✓ Embeddings stored in database with ID: ${testResult.insertId}\n`);
    
    // Test 7: Vector Search
    console.log('Test 7: Vector Similarity Search');
    const similarPatterns = await embeddingService.findSimilarWeatherPatterns(
      weatherEmbedding,
      5,
      0.5
    );
    console.log(`✓ Found ${similarPatterns.length} similar weather patterns\n`);
    
    // Test 8: Batch Generation
    console.log('Test 8: Batch Embedding Generation');
    const texts = [
      'High wind speed with low humidity',
      'Perfect burning conditions',
      'Dangerous weather alert'
    ];
    const batchEmbeddings = await embeddingService.batchGenerateEmbeddings(texts, 32);
    console.log(`✓ Generated ${batchEmbeddings.length} embeddings in batch\n`);
    
    console.log('=== All Tests Passed Successfully! ===');
    console.log('✓ OpenAI embeddings working correctly');
    console.log('✓ TiDB vector storage working');
    console.log('✓ Similarity search functioning');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
testEmbeddings();