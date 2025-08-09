require('dotenv').config();
const SmokeOverlapPredictor = require('./agents/predictor');
const { query } = require('./db/connection');
const turf = require('@turf/turf');

async function deepTestPredictorOverlap() {
  const predictor = new SmokeOverlapPredictor();
  
  console.log('🔥 DEEP TESTING PREDICTOR SMOKE OVERLAP WITH TURF.JS...');
  console.log(`Configuration:
  Max PM2.5 Safe: ${predictor.maxPM25Safe} μg/m³
  Dispersion Radius: ${predictor.dispersalRadius} km`);
  
  // Test 1: Plume Geometry Generation
  console.log('\n🌬️ TESTING PLUME GEOMETRY GENERATION:');
  
  const testBurns = [
    {
      location: [-122.4, 37.7],
      windDirection: 270, // West wind
      windSpeed: 5,
      areaHectares: 100,
      duration: 4
    },
    {
      location: [-122.38, 37.7], // 1.5km east
      windDirection: 270,
      windSpeed: 5,
      areaHectares: 150,
      duration: 4
    }
  ];
  
  const plumes = [];
  for (const burn of testBurns) {
    const plume = predictor.calculatePlumeGeometry(
      burn.location,
      burn.windDirection,
      burn.windSpeed,
      burn.areaHectares,
      burn.duration
    );
    plumes.push(plume);
    
    const area = turf.area(plume) / 1000000; // km²
    const bbox = turf.bbox(plume);
    console.log(`  Burn at [${burn.location}]:
    Area: ${area.toFixed(2)} km²
    BBox: [${bbox.map(x => x.toFixed(4)).join(', ')}]
    Vertices: ${plume.geometry.coordinates[0].length}`);
  }
  
  // Test 2: Turf.js Intersection
  console.log('\n🔀 TESTING TURF.JS PLUME INTERSECTION:');
  
  try {
    const intersection = turf.intersect(plumes[0], plumes[1]);
    if (intersection) {
      const overlapArea = turf.area(intersection) / 1000000;
      const overlapBbox = turf.bbox(intersection);
      console.log(`  ✅ Plumes intersect!
    Overlap area: ${overlapArea.toFixed(2)} km²
    Overlap bbox: [${overlapBbox.map(x => x.toFixed(4)).join(', ')}]`);
    } else {
      console.log('  ❌ No intersection detected');
    }
  } catch (e) {
    console.log(`  ⚠️ Intersection calculation error: ${e.message}`);
  }
  
  // Test 3: PM2.5 Concentration at Various Distances
  console.log('\n💨 TESTING PM2.5 CONCENTRATION CALCULATION:');
  
  const emissionRate = 100 * 10 * 0.015; // area * fuelLoad * emissionFactor
  const windSpeed = 5;
  const distances = [0.1, 0.5, 1, 2, 5, 10];
  
  for (const distance of distances) {
    const pm25 = predictor.calculatePM25Concentration(
      distance,
      emissionRate,
      windSpeed,
      3 // Neutral stability
    );
    const safety = pm25 > predictor.maxPM25Safe ? '⚠️ UNSAFE' : '✅ SAFE';
    console.log(`  ${distance} km: ${pm25.toFixed(2)} μg/m³ ${safety}`);
  }
  
  // Test 4: Complete Smoke Overlap Calculation
  console.log('\n🎯 TESTING COMPLETE SMOKE OVERLAP CALCULATION:');
  
  const burn1 = {
    request_id: 1,
    center: [-122.4, 37.7],
    area_hectares: 100,
    estimated_duration_hours: 4,
    requested_date: '2025-01-20',
    requested_start_time: '08:00:00'
  };
  
  const burn2 = {
    request_id: 2,
    center: [-122.39, 37.7], // 1km east
    area_hectares: 150,
    estimated_duration_hours: 4,
    requested_date: '2025-01-20',
    requested_start_time: '09:00:00'
  };
  
  const weatherData = {
    windSpeed: 5,
    windDirection: 270, // West wind
    temperature: 20,
    humidity: 50
  };
  
  const overlap = await predictor.calculateSmokeOverlap(burn1, burn2, weatherData);
  
  console.log(`  Overlap detected: ${overlap.hasOverlap ? 'YES' : 'NO'}
  Overlap area: ${overlap.overlapArea.toFixed(2)} km²
  Max combined PM2.5: ${overlap.maxCombinedPM25.toFixed(2)} μg/m³
  Distance between burns: ${overlap.distance.toFixed(2)} km
  Time overlap: ${overlap.timeOverlap.toFixed(1)} hours
  Severity: ${overlap.severity}`);
  
  // Test 5: Time Overlap Calculation
  console.log('\n⏰ TESTING TIME OVERLAP CALCULATION:');
  
  const timeTests = [
    {
      burn1: { requested_date: '2025-01-20', requested_start_time: '08:00:00', estimated_duration_hours: 4 },
      burn2: { requested_date: '2025-01-20', requested_start_time: '10:00:00', estimated_duration_hours: 4 },
      expected: 2 // 2 hours overlap
    },
    {
      burn1: { requested_date: '2025-01-20', requested_start_time: '08:00:00', estimated_duration_hours: 3 },
      burn2: { requested_date: '2025-01-20', requested_start_time: '11:00:00', estimated_duration_hours: 3 },
      expected: 0 // No overlap
    },
    {
      burn1: { requested_date: '2025-01-20', requested_start_time: '08:00:00', estimated_duration_hours: 6 },
      burn2: { requested_date: '2025-01-20', requested_start_time: '09:00:00', estimated_duration_hours: 4 },
      expected: 4 // Full overlap of burn2
    }
  ];
  
  for (const test of timeTests) {
    const overlap = predictor.calculateTimeOverlap(test.burn1, test.burn2);
    const match = Math.abs(overlap - test.expected) < 0.01;
    console.log(`  [${test.burn1.requested_start_time}-${test.burn1.estimated_duration_hours}h] vs [${test.burn2.requested_start_time}-${test.burn2.estimated_duration_hours}h]: ${overlap.toFixed(1)}h ${match ? '✅' : '❌'}`);
  }
  
  // Test 6: Conflict Severity Calculation
  console.log('\n⚠️ TESTING CONFLICT SEVERITY CALCULATION:');
  
  const severityTests = [
    { pm25: 150, overlapArea: 15, distance: 3, timeOverlap: 4, expected: 'critical' },
    { pm25: 80, overlapArea: 8, distance: 8, timeOverlap: 2, expected: 'high' },
    { pm25: 40, overlapArea: 3, distance: 15, timeOverlap: 1, expected: 'medium' },
    { pm25: 20, overlapArea: 0.5, distance: 25, timeOverlap: 0.5, expected: 'low' }
  ];
  
  for (const test of severityTests) {
    const severity = predictor.calculateConflictSeverity(
      test.pm25,
      test.overlapArea,
      test.distance,
      test.timeOverlap
    );
    console.log(`  PM2.5=${test.pm25}, Area=${test.overlapArea}km², Dist=${test.distance}km, Time=${test.timeOverlap}h: ${severity} ${severity === test.expected ? '✅' : '❌'}`);
  }
  
  // Test 7: 64-Dimensional Smoke Vector Generation
  console.log('\n🔢 TESTING 64-DIMENSIONAL SMOKE VECTOR:');
  
  const smokeVector = await predictor.generateSmokeVector(
    1,
    weatherData,
    100 // hectares
  );
  
  console.log(`  Vector dimensions: ${smokeVector.length}
  Emission components (0-15): [${smokeVector.slice(0, 4).map(x => x.toFixed(3)).join(', ')}...]
  Wind parameters (16-31): [${smokeVector.slice(16, 20).map(x => x.toFixed(3)).join(', ')}...]
  Stability/mixing (32-47): [${smokeVector.slice(32, 36).map(x => x.toFixed(3)).join(', ')}...]
  Dispersion geometry (48-63): [${smokeVector.slice(48, 52).map(x => x.toFixed(3)).join(', ')}...]`);
  
  const nonZero = smokeVector.filter(x => x !== 0).length;
  console.log(`  Density: ${nonZero}/64 (${(nonZero/64*100).toFixed(1)}%)`);
  
  // Test 8: Real Database Conflict Detection
  console.log('\n💾 TESTING REAL DATABASE CONFLICT DETECTION:');
  
  try {
    // Store smoke vectors in database
    const vectorString = `[${smokeVector.join(',')}]`;
    await query(`
      INSERT INTO smoke_predictions (burn_request_id, plume_vector, prediction_time)
      VALUES (90001, ?, NOW())
      ON DUPLICATE KEY UPDATE plume_vector = VALUES(plume_vector)
    `, [vectorString]);
    
    // Generate similar vector for conflict test
    const conflictVector = smokeVector.map((v, i) => 
      v * (1 + (Math.random() - 0.5) * 0.1) // 5% variation
    );
    const conflictVectorString = `[${conflictVector.join(',')}]`;
    
    await query(`
      INSERT INTO smoke_predictions (burn_request_id, plume_vector, prediction_time)
      VALUES (90002, ?, NOW())
      ON DUPLICATE KEY UPDATE plume_vector = VALUES(plume_vector)
    `, [conflictVectorString]);
    
    // Test vector similarity search
    const similarityResult = await query(`
      SELECT 
        burn_request_id,
        VEC_COSINE_DISTANCE(plume_vector, ?) as distance
      FROM smoke_predictions
      WHERE burn_request_id != 90001
      HAVING distance < 0.2
      ORDER BY distance ASC
      LIMIT 5
    `, [vectorString]);
    
    if (similarityResult.length > 0) {
      console.log(`  Found ${similarityResult.length} similar smoke patterns:`);
      for (const match of similarityResult) {
        const similarity = 1 - match.distance;
        console.log(`    Request ${match.burn_request_id}: ${(similarity * 100).toFixed(2)}% similarity`);
      }
    } else {
      console.log('  No similar smoke patterns found');
    }
  } catch (error) {
    console.log(`  Database test skipped: ${error.message}`);
  }
  
  console.log('\n✅ PREDICTOR SMOKE OVERLAP TESTING COMPLETE!');
  process.exit(0);
}

deepTestPredictorOverlap().catch(console.error);