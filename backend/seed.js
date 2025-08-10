require('dotenv').config();
const { initializeDatabase, query, releaseConnection } = require('./db/connection');
const logger = require('./middleware/logger');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');
    
    // Initialize database connection
    await initializeDatabase();
    
    // Clear existing test data
    console.log('Clearing existing test data...');
    await query('DELETE FROM burn_requests WHERE field_id IN (SELECT field_id FROM burn_fields WHERE farm_id IN (SELECT farm_id FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%"))');
    await query('DELETE FROM burn_fields WHERE farm_id IN (SELECT farm_id FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%")');
    await query('DELETE FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%"');
    
    // Seed farms with real agricultural data
    console.log('Seeding farms...');
    const farms = [
      { name: 'Green Acres Ranch', owner: 'Sarah Johnson', email: 'sarah@greenacres.com', phone: '555-0101', lat: 39.123, lon: -95.789, hectares: 1011.7 },
      { name: 'Prairie Wind Farms', owner: 'Mike Thompson', email: 'mike@prairiewind.com', phone: '555-0102', lat: 39.456, lon: -95.234, hectares: 728.4 },
      { name: 'Sunrise Valley Farm', owner: 'John Miller', email: 'john@sunrisevalley.com', phone: '555-0103', lat: 39.789, lon: -95.567, hectares: 1294.9 },
      { name: 'Harvest Moon Ranch', owner: 'Emily Davis', email: 'emily@harvestmoon.com', phone: '555-0104', lat: 39.234, lon: -95.890, hectares: 607.0 },
      { name: 'Golden Fields Farm', owner: 'Robert Wilson', email: 'robert@goldenfields.com', phone: '555-0105', lat: 39.567, lon: -95.123, hectares: 1133.1 }
    ];
    
    for (const farm of farms) {
      await query(`
        INSERT INTO farms (farm_name, name, owner_name, contact_email, contact_phone, latitude, longitude, total_area_hectares, total_acreage) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          total_area_hectares = VALUES(total_area_hectares)
      `, [farm.name, farm.name, farm.owner, farm.email, farm.phone, farm.lat, farm.lon, farm.hectares, farm.hectares * 2.471]);
    }
    
    // Get farm IDs for creating fields
    const farmRows = await query('SELECT farm_id, farm_name, latitude, longitude FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%"');
    console.log(`Found ${farmRows.length} farms`);
    
    // Seed burn fields for each farm
    console.log('Seeding burn fields...');
    const cropTypes = ['wheat', 'corn', 'rice', 'barley', 'oats'];
    const fieldIds = [];
    
    for (const farm of farmRows) {
      // Create 2-3 fields per farm
      const numFields = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < numFields; i++) {
        const fieldGeometry = {
          type: 'Polygon',
          coordinates: [[
            [farm.longitude - 0.001, farm.latitude - 0.001],
            [farm.longitude + 0.001, farm.latitude - 0.001],
            [farm.longitude + 0.001, farm.latitude + 0.001],
            [farm.longitude - 0.001, farm.latitude + 0.001],
            [farm.longitude - 0.001, farm.latitude - 0.001]
          ]]
        };
        
        const result = await query(`
          INSERT INTO burn_fields (
            farm_id,
            field_name,
            field_geometry,
            area_hectares,
            crop_type,
            fuel_load_tons_per_hectare,
            terrain_slope,
            elevation_meters
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          farm.farm_id,
          `Field ${i + 1}`,
          JSON.stringify(fieldGeometry),
          Math.floor(Math.random() * 200) + 50,
          cropTypes[Math.floor(Math.random() * cropTypes.length)],
          Math.random() * 5 + 2,
          Math.random() * 10,
          Math.floor(Math.random() * 200) + 300
        ]);
        
        fieldIds.push({
          field_id: result.insertId,
          farm_id: farm.farm_id,
          farm_name: farm.farm_name
        });
      }
    }
    
    console.log(`Created ${fieldIds.length} fields`);
    
    // Seed burn requests with realistic data
    console.log('Seeding burn requests...');
    const burnTypes = ['broadcast', 'pile', 'prescribed'];
    const purposes = [
      'Crop residue management',
      'Weed control',
      'Disease prevention',
      'Soil preparation',
      'Pest management'
    ];
    
    const burnDates = [
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
    ];
    
    // Create burn requests for some fields
    for (const field of fieldIds.slice(0, Math.min(8, fieldIds.length))) {
      const burnDate = burnDates[Math.floor(Math.random() * burnDates.length)];
      const startTime = new Date(burnDate);
      startTime.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 6, 0, 0, 0);
      
      await query(`
        INSERT INTO burn_requests (
          field_id,
          farm_id,
          requested_date,
          requested_start_time,
          requested_end_time,
          burn_type,
          purpose,
          estimated_duration_hours,
          status,
          priority_score,
          acreage,
          crop_type,
          requested_window_start,
          requested_window_end
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        field.field_id,
        field.farm_id,
        burnDate.toISOString().split('T')[0],
        `${String(startTime.getHours()).padStart(2, '0')}:00:00`,
        `${String(endTime.getHours()).padStart(2, '0')}:00:00`,
        burnTypes[Math.floor(Math.random() * burnTypes.length)],
        purposes[Math.floor(Math.random() * purposes.length)],
        Math.floor(Math.random() * 4) + 2,
        'pending',
        Math.floor(Math.random() * 50) + 50,
        Math.floor(Math.random() * 500) + 100,
        cropTypes[Math.floor(Math.random() * cropTypes.length)],
        startTime.toISOString().replace('T', ' ').substr(0, 19),
        endTime.toISOString().replace('T', ' ').substr(0, 19)
      ]);
    }
    
    // Seed weather data with real patterns
    console.log('Seeding weather data...');
    const weatherConditions = ['Clear', 'Clouds', 'Mist', 'Smoke', 'Haze'];
    for (let i = 0; i < 10; i++) {
      const weatherDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      await query(`
        INSERT INTO weather_data (
          location_lon,
          location_lat,
          temperature,
          humidity,
          wind_speed,
          wind_direction,
          pressure,
          visibility,
          weather_condition,
          timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        -95.5 + Math.random() * 0.5,
        39.5 + Math.random() * 0.5,
        65 + Math.random() * 25,
        35 + Math.random() * 35,
        5 + Math.random() * 15,
        Math.floor(Math.random() * 360),
        1010 + Math.random() * 20,
        8 + Math.random() * 2,
        weatherConditions[Math.floor(Math.random() * weatherConditions.length)],
        weatherDate.toISOString().replace('T', ' ').substr(0, 19)
      ]);
    }
    
    // Seed alerts
    console.log('Seeding alerts...');
    const alertTypes = ['burn_scheduled', 'burn_starting', 'smoke_warning', 'schedule_change', 'conflict_detected', 'weather_alert'];
    const severityLevels = ['info', 'warning', 'critical'];
    const deliveryMethods = ['sms', 'email', 'push', 'in_app'];
    
    for (const farm of farmRows.slice(0, 2)) {
      await query(`
        INSERT INTO alerts (
          farm_id,
          alert_type,
          severity,
          message,
          delivery_method,
          delivery_status,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        farm.farm_id,
        alertTypes[Math.floor(Math.random() * alertTypes.length)],
        severityLevels[Math.floor(Math.random() * severityLevels.length)],
        'System generated alert for testing',
        deliveryMethods[Math.floor(Math.random() * deliveryMethods.length)],
        'pending',
        new Date()
      ]);
    }
    
    console.log('✅ Database seeded successfully!');
    
    // Show summary
    const summary = await query(`
      SELECT 
        (SELECT COUNT(*) FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%") as farms,
        (SELECT COUNT(*) FROM burn_fields WHERE farm_id IN (SELECT farm_id FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%")) as fields,
        (SELECT COUNT(*) FROM burn_requests WHERE field_id IN (SELECT field_id FROM burn_fields WHERE farm_id IN (SELECT farm_id FROM farms WHERE farm_name LIKE "Green%" OR farm_name LIKE "Prairie%" OR farm_name LIKE "Sunrise%" OR farm_name LIKE "Harvest%" OR farm_name LIKE "Golden%"))) as burn_requests,
        (SELECT COUNT(*) FROM weather_data) as weather_data,
        (SELECT COUNT(*) FROM alerts) as alerts
    `);
    
    console.log('\n📊 Seed Summary:');
    console.log(`   Farms: ${summary[0].farms}`);
    console.log(`   Fields: ${summary[0].fields}`);
    console.log(`   Burn Requests: ${summary[0].burn_requests}`);
    console.log(`   Weather Data: ${summary[0].weather_data}`);
    console.log(`   Alerts: ${summary[0].alerts}`);
    
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Clean up database connection
    process.exit(0);
  }
}

seedDatabase();