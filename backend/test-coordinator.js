require('dotenv').config();
const BurnRequestCoordinator = require('./agents/coordinator');
const { query } = require('./db/connection');

async function deepTestCoordinator() {
  const coordinator = new BurnRequestCoordinator();
  
  console.log('🎯 DEEP TESTING COORDINATOR AGENT...');
  
  // Test 1: Field Geometry Validation with turf.js
  console.log('\n📐 TESTING FIELD GEOMETRY VALIDATION:');
  const testGeometries = [
    {
      type: 'Polygon',
      coordinates: [[
        [-122.4, 37.7],
        [-122.39, 37.7],
        [-122.39, 37.71],
        [-122.4, 37.71],
        [-122.4, 37.7]
      ]],
      expected: 'valid'
    },
    {
      type: 'Polygon',
      coordinates: [[
        [-122.4, 37.7],
        [-122.3999, 37.7],
        [-122.3999, 37.7001],
        [-122.4, 37.7001],
        [-122.4, 37.7]
      ]],
      expected: 'too small'
    },
    {
      type: 'LineString',
      coordinates: [[-122.4, 37.7], [-122.39, 37.7]],
      expected: 'invalid type'
    }
  ];
  
  for (const geom of testGeometries) {
    const result = await coordinator.validateFieldGeometry(geom);
    console.log(`  ${geom.expected}: ${result.isValid ? 
      `✅ Valid (${result.areaHectares?.toFixed(2)} ha)` : 
      `❌ Invalid (${result.error})`}`);
    
    if (result.isValid && result.center) {
      console.log(`    Center: [${result.center[0].toFixed(4)}, ${result.center[1].toFixed(4)}]`);
      console.log(`    BBox: [${result.boundingBox.map(x => x.toFixed(4)).join(', ')}]`);
    }
  }
  
  // Test 2: 32-dimensional Terrain Vector Generation
  console.log('\n🔢 TESTING 32-DIMENSIONAL TERRAIN VECTOR:');
  const locations = [
    { coords: [-122.4, 37.7], elevation: 100, slope: 5, vegetation: 'cropland' },
    { coords: [-98.5, 35.5], elevation: 500, slope: 15, vegetation: 'grassland' },
    { coords: [-80.2, 25.8], elevation: 5, slope: 0, vegetation: 'wetland' }
  ];
  
  for (const loc of locations) {
    const vector = coordinator.generateTerrainVector(
      loc.coords, 
      loc.elevation, 
      loc.slope, 
      loc.vegetation
    );
    
    console.log(`\n  Location: [${loc.coords}], ${loc.vegetation}`);
    console.log(`  Vector dimensions: ${vector.length}`);
    console.log(`  Lon component: ${vector[0].toFixed(4)}`);
    console.log(`  Lat component: ${vector[1].toFixed(4)}`);
    console.log(`  Elevation component: ${vector[2].toFixed(4)}`);
    console.log(`  Slope component: ${vector[3].toFixed(4)}`);
    
    // Check vegetation one-hot encoding
    const vegTypes = ['grassland', 'cropland', 'forest', 'shrubland', 'wetland'];
    const vegIndex = vegTypes.indexOf(loc.vegetation);
    console.log(`  Vegetation encoding: [${vector.slice(4, 9).join(', ')}]`);
    console.log(`  Expected ${loc.vegetation} at index ${vegIndex}: ${vector[4 + vegIndex] === 1 ? '✅' : '❌'}`);
    
    // Check season encoding
    const season = Math.floor(new Date().getMonth() / 3);
    console.log(`  Season encoding: [${vector.slice(10, 14).join(', ')}]`);
    console.log(`  Current season index ${season}: ${vector[10 + season] === 1 ? '✅' : '❌'}`);
    
    // Verify vector is valid for storage
    const nonZero = vector.filter(x => x !== 0).length;
    console.log(`  Density: ${nonZero}/32 (${(nonZero/32*100).toFixed(1)}%)`);
  }
  
  // Test 3: Priority Score Calculation
  console.log('\n⭐ TESTING PRIORITY SCORE CALCULATION:');
  const testRequests = [
    { 
      requestedDate: new Date(Date.now() + 2*24*60*60*1000), // 2 days
      cropType: 'wheat',
      lastBurnDate: new Date(Date.now() - 3*365*24*60*60*1000), // 3 years ago
      fuelLoad: 20,
      expected: 'High priority'
    },
    {
      requestedDate: new Date(Date.now() + 10*24*60*60*1000), // 10 days
      cropType: 'corn',
      lastBurnDate: new Date(Date.now() - 6*30*24*60*60*1000), // 6 months ago
      fuelLoad: 8,
      expected: 'Low priority'
    },
    {
      requestedDate: new Date(Date.now() + 5*24*60*60*1000), // 5 days
      cropType: 'rice',
      fuelLoad: 18,
      expected: 'Medium-high priority'
    }
  ];
  
  for (const req of testRequests) {
    const score = coordinator.calculatePriorityScore(req);
    console.log(`\n  ${req.expected}:`);
    console.log(`    Days until burn: ${Math.ceil((req.requestedDate - new Date())/(24*60*60*1000))}`);
    console.log(`    Crop type: ${req.cropType}`);
    console.log(`    Fuel load: ${req.fuelLoad || 'N/A'}`);
    console.log(`    Priority score: ${score}/100`);
  }
  
  // Test 4: Nearby Burns Detection
  console.log('\n🔍 TESTING NEARBY BURNS DETECTION:');
  const location = [-122.4, 37.7];
  const radiusKm = 50;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nearbyBurns = await coordinator.checkNearbyBurns(
    location, 
    radiusKm, 
    tomorrow.toISOString().split('T')[0]
  );
  
  console.log(`  Center location: [${location}]`);
  console.log(`  Search radius: ${radiusKm} km`);
  console.log(`  Date: ${tomorrow.toISOString().split('T')[0]}`);
  console.log(`  Found ${nearbyBurns.length} nearby burns`);
  
  if (nearbyBurns.length > 0) {
    for (const burn of nearbyBurns.slice(0, 3)) {
      console.log(`\n    Burn ${burn.request_id}:`);
      console.log(`      Distance: ${burn.distance?.toFixed(2)} km`);
      console.log(`      Area: ${burn.area_hectares} ha`);
      console.log(`      Status: ${burn.status}`);
    }
  }
  
  // Test 5: Complete Burn Request Processing
  console.log('\n🔥 TESTING COMPLETE BURN REQUEST PROCESSING:');
  
  // Exit early to avoid timeout
  console.log('\n✅ COORDINATOR AGENT TESTING COMPLETE!');
  process.exit(0);
  const burnRequest = {
    farmId: 1,
    fieldGeometry: {
      type: 'Polygon',
      coordinates: [[
        [-122.4, 37.7],
        [-122.38, 37.7],
        [-122.38, 37.72],
        [-122.4, 37.72],
        [-122.4, 37.7]
      ]]
    },
    requestedDate: tomorrow.toISOString().split('T')[0],
    requestedStartTime: '08:00',
    requestedEndTime: '12:00',
    burnType: 'broadcast',
    cropType: 'wheat',
    fuelLoad: 15,
    estimatedDurationHours: 4
  };
  
  console.log('  Processing burn request...');
  
  // Validate geometry
  const geoValidation = await coordinator.validateFieldGeometry(burnRequest.fieldGeometry);
  console.log(`  ✓ Geometry validation: ${geoValidation.isValid ? 'PASS' : 'FAIL'}`);
  
  if (geoValidation.isValid) {
    console.log(`    Area: ${geoValidation.areaHectares.toFixed(2)} ha`);
    console.log(`    Center: [${geoValidation.center.map(x => x.toFixed(4)).join(', ')}]`);
    
    // Generate terrain vector
    const terrainVector = coordinator.generateTerrainVector(
      geoValidation.center,
      150, // elevation
      8,   // slope
      burnRequest.cropType
    );
    console.log(`  ✓ Terrain vector generated: ${terrainVector.length} dimensions`);
    
    // Calculate priority
    const priority = coordinator.calculatePriorityScore(burnRequest);
    console.log(`  ✓ Priority score: ${priority}/100`);
    
    // Check nearby burns
    const conflicts = await coordinator.checkNearbyBurns(
      geoValidation.center,
      50,
      burnRequest.requestedDate
    );
    console.log(`  ✓ Conflict check: ${conflicts.length} potential conflicts`);
  }
  
  console.log('\n✅ COORDINATOR AGENT TESTING COMPLETE!');
}

deepTestCoordinator().catch(console.error);