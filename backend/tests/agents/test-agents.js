require('dotenv').config();
const WeatherAgent = require('./agents/weather');
const CoordinatorAgent = require('./agents/coordinator');
const PredictorAgent = require('./agents/predictor');
const OptimizerAgent = require('./agents/optimizer');
const AlertsAgent = require('./agents/alerts');

async function testAllAgents() {
  const results = {
    weather: false,
    coordinator: false,
    predictor: false,
    optimizer: false,
    alerts: false,
    errors: []
  };

  // Test 1: Weather Agent with REAL OpenWeatherMap API
  console.log('\n=== Testing Weather Agent ===');
  try {
    const weatherAgent = new WeatherAgent();
    // Portland, Oregon coordinates
    const weatherResult = await weatherAgent.analyzeWeatherForBurn(45.5152, -122.6784, new Date());
    
    if (!weatherResult) throw new Error('No weather data returned');
    if (!weatherResult.weatherData) throw new Error('Missing weatherData');
    if (!weatherResult.smokeModel) throw new Error('Missing smokeModel');
    if (!weatherResult.safetyAssessment) throw new Error('Missing safetyAssessment');
    if (!weatherResult.weatherVector || weatherResult.weatherVector.length !== 128) {
      throw new Error(`Invalid weather vector: length ${weatherResult.weatherVector?.length}`);
    }
    
    console.log('✓ Weather Agent works');
    console.log('  - Temperature:', weatherResult.weatherData.temperature, '°C');
    console.log('  - Wind Speed:', weatherResult.weatherData.windSpeed, 'm/s');
    console.log('  - PM2.5 at 1km:', weatherResult.smokeModel.concentrations[0]?.concentration, 'µg/m³');
    console.log('  - Safety Score:', weatherResult.safetyAssessment.overallScore);
    console.log('  - Vector dimensions:', weatherResult.weatherVector.length);
    results.weather = true;
  } catch (e) {
    results.errors.push(`Weather Agent: ${e.message}`);
    console.error('✗ Weather Agent error:', e.message);
  }

  // Test 2: Coordinator Agent
  console.log('\n=== Testing Coordinator Agent ===');
  try {
    const coordinatorAgent = new CoordinatorAgent();
    const burnRequest = {
      farmId: 1,
      fieldGeometry: {
        type: 'Polygon',
        coordinates: [[
          [-122.6784, 45.5152],
          [-122.6684, 45.5152],
          [-122.6684, 45.5252],
          [-122.6784, 45.5252],
          [-122.6784, 45.5152]
        ]]
      },
      requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      cropType: 'wheat',
      fieldSizeAcres: 120,
      estimatedDuration: 4,
      fuelLoadTonsPerAcre: 2.5
    };
    
    const coordResult = await coordinatorAgent.createBurnRequest(burnRequest);
    
    if (!coordResult) throw new Error('No coordination result');
    if (!coordResult.priorityScore) throw new Error('Missing priority score');
    if (!coordResult.terrainVector || coordResult.terrainVector.length !== 32) {
      throw new Error(`Invalid terrain vector: length ${coordResult.terrainVector?.length}`);
    }
    
    console.log('✓ Coordinator Agent works');
    console.log('  - Priority Score:', coordResult.priorityScore);
    console.log('  - Terrain Vector dimensions:', coordResult.terrainVector.length);
    console.log('  - Area calculated:', coordResult.areaHectares, 'hectares');
    results.coordinator = true;
  } catch (e) {
    results.errors.push(`Coordinator Agent: ${e.message}`);
    console.error('✗ Coordinator Agent error:', e.message);
  }

  // Test 3: Predictor Agent
  console.log('\n=== Testing Predictor Agent ===');
  try {
    const predictorAgent = new PredictorAgent();
    const burnRequests = [
      {
        id: 1,
        location: { lat: 45.5152, lon: -122.6784 },
        date: new Date(),
        duration: 4,
        fuelLoad: 2.5,
        fieldSize: 120
      },
      {
        id: 2,
        location: { lat: 45.5252, lon: -122.6684 },
        date: new Date(),
        duration: 3,
        fuelLoad: 2.0,
        fieldSize: 80
      }
    ];
    
    const predictions = await predictorAgent.predictSmokeOverlap(burnRequests);
    
    if (!predictions) throw new Error('No predictions returned');
    if (!predictions.conflicts) throw new Error('Missing conflicts array');
    if (!predictions.smokeVectors) throw new Error('Missing smoke vectors');
    
    console.log('✓ Predictor Agent works');
    console.log('  - Conflicts detected:', predictions.conflicts.length);
    console.log('  - Smoke vectors generated:', predictions.smokeVectors.length);
    if (predictions.smokeVectors[0]) {
      console.log('  - First smoke vector dimensions:', predictions.smokeVectors[0].length);
    }
    results.predictor = true;
  } catch (e) {
    results.errors.push(`Predictor Agent: ${e.message}`);
    console.error('✗ Predictor Agent error:', e.message);
  }

  // Test 4: Optimizer Agent
  console.log('\n=== Testing Optimizer Agent ===');
  try {
    const optimizerAgent = new OptimizerAgent();
    const burnRequests = [
      {
        id: 1,
        priority: 80,
        requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration: 4,
        location: { lat: 45.5152, lon: -122.6784 }
      },
      {
        id: 2,
        priority: 60,
        requestedDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        duration: 3,
        location: { lat: 45.5252, lon: -122.6684 }
      },
      {
        id: 3,
        priority: 70,
        requestedDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        duration: 5,
        location: { lat: 45.5352, lon: -122.6584 }
      }
    ];
    
    const conflicts = [
      { request1: 1, request2: 2, severity: 'high', overlapPercentage: 75 }
    ];
    
    const optimized = await optimizerAgent.optimizeSchedule(burnRequests, conflicts);
    
    if (!optimized) throw new Error('No optimization result');
    if (!optimized.schedule) throw new Error('Missing schedule');
    if (!optimized.stats) throw new Error('Missing stats');
    
    console.log('✓ Optimizer Agent works');
    console.log('  - Iterations:', optimized.stats.iterations);
    console.log('  - Final cost:', optimized.stats.finalCost.toFixed(2));
    console.log('  - Conflicts resolved:', optimized.stats.conflictsResolved);
    console.log('  - Schedule length:', optimized.schedule.length);
    results.optimizer = true;
  } catch (e) {
    results.errors.push(`Optimizer Agent: ${e.message}`);
    console.error('✗ Optimizer Agent error:', e.message);
  }

  // Test 5: Alerts Agent  
  console.log('\n=== Testing Alerts Agent ===');
  try {
    const alertsAgent = new AlertsAgent();
    const schedule = [
      {
        burnRequestId: 1,
        farmId: 1,
        scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        changes: { rescheduled: true, newTime: new Date(Date.now() + 48 * 60 * 60 * 1000) }
      }
    ];
    
    const alerts = await alertsAgent.sendAlerts(schedule);
    
    if (!alerts) throw new Error('No alerts result');
    if (!Array.isArray(alerts.sent)) throw new Error('Missing sent alerts array');
    
    console.log('✓ Alerts Agent works');
    console.log('  - Alerts generated:', alerts.sent.length);
    console.log('  - Alert types:', [...new Set(alerts.sent.map(a => a.type))].join(', '));
    results.alerts = true;
  } catch (e) {
    results.errors.push(`Alerts Agent: ${e.message}`);
    console.error('✗ Alerts Agent error:', e.message);
  }

  // Summary
  console.log('\n=== Agent Test Summary ===');
  console.log('Weather Agent:', results.weather ? '✓' : '✗');
  console.log('Coordinator Agent:', results.coordinator ? '✓' : '✗');
  console.log('Predictor Agent:', results.predictor ? '✓' : '✗');
  console.log('Optimizer Agent:', results.optimizer ? '✓' : '✗');
  console.log('Alerts Agent:', results.alerts ? '✓' : '✗');
  
  if (results.errors.length > 0) {
    console.log('\nErrors found:');
    results.errors.forEach(err => console.log(' -', err));
    process.exit(1);
  } else {
    console.log('\nAll agent tests passed!');
    process.exit(0);
  }
}

testAllAgents();