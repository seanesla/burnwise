require('dotenv').config();
const { getConnection, initializeDatabase } = require('./db/connection');
const BurnRequestCoordinator = require('./agents/coordinator');
const WeatherAnalysisAgent = require('./agents/weather');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const coordinator = new BurnRequestCoordinator();
const weatherAgent = new WeatherAnalysisAgent();

const DEMO_FARMS = [
  {
    farmName: 'Sunrise Valley Farm',
    ownerName: 'John Miller',
    contactEmail: 'john@sunrisevalley.com',
    contactPhone: '+15551234567',
    latitude: 39.0458,
    longitude: -95.6989,
    totalAreaHectares: 450,
    permitNumber: 'BURN-2025-001',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Green Acres Ranch',
    ownerName: 'Sarah Johnson',
    contactEmail: 'sarah@greenacres.com',
    contactPhone: '+15551234568',
    latitude: 39.1234,
    longitude: -95.7890,
    totalAreaHectares: 680,
    permitNumber: 'BURN-2025-002',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Prairie Wind Farms',
    ownerName: 'Mike Thompson',
    contactEmail: 'mike@prairiewind.com',
    contactPhone: '+15551234569',
    latitude: 38.9876,
    longitude: -95.5432,
    totalAreaHectares: 320,
    permitNumber: 'BURN-2025-003',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Golden Harvest Co-op',
    ownerName: 'Emily Chen',
    contactEmail: 'emily@goldenharvest.com',
    contactPhone: '+15551234570',
    latitude: 39.2345,
    longitude: -95.8765,
    totalAreaHectares: 890,
    permitNumber: 'BURN-2025-004',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Riverside Agriculture',
    ownerName: 'Carlos Rodriguez',
    contactEmail: 'carlos@riverside.com',
    contactPhone: '+15551234571',
    latitude: 38.8765,
    longitude: -95.4321,
    totalAreaHectares: 520,
    permitNumber: 'BURN-2025-005',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Hilltop Grain Farm',
    ownerName: 'Lisa Anderson',
    contactEmail: 'lisa@hilltopgrain.com',
    contactPhone: '+15551234572',
    latitude: 39.3456,
    longitude: -95.9876,
    totalAreaHectares: 410,
    permitNumber: 'BURN-2025-006',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Valley View Estates',
    ownerName: 'David Park',
    contactEmail: 'david@valleyview.com',
    contactPhone: '+15551234573',
    latitude: 38.7654,
    longitude: -95.3210,
    totalAreaHectares: 290,
    permitNumber: 'BURN-2025-007',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Sunset Ridge Farm',
    ownerName: 'Jennifer White',
    contactEmail: 'jennifer@sunsetridge.com',
    contactPhone: '+15551234574',
    latitude: 39.4567,
    longitude: -96.0987,
    totalAreaHectares: 560,
    permitNumber: 'BURN-2025-008',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Blue Sky Agriculture',
    ownerName: 'Robert Taylor',
    contactEmail: 'robert@bluesky.com',
    contactPhone: '+15551234575',
    latitude: 38.6543,
    longitude: -95.2109,
    totalAreaHectares: 380,
    permitNumber: 'BURN-2025-009',
    permitExpiry: '2025-12-31'
  },
  {
    farmName: 'Morning Star Cooperative',
    ownerName: 'Amanda Martinez',
    contactEmail: 'amanda@morningstar.com',
    contactPhone: '+15551234576',
    latitude: 39.5678,
    longitude: -96.2098,
    totalAreaHectares: 720,
    permitNumber: 'BURN-2025-010',
    permitExpiry: '2025-12-31'
  }
];

const createFieldGeometry = (centerLat, centerLon, sizeHectares) => {
  const radius = Math.sqrt(sizeHectares / Math.PI) / 100;
  const numPoints = 8;
  const coordinates = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * 2 * Math.PI;
    const offsetLat = centerLat + radius * Math.cos(angle);
    const offsetLon = centerLon + radius * Math.sin(angle);
    coordinates.push([offsetLon, offsetLat]);
  }
  
  return {
    type: 'Polygon',
    coordinates: [coordinates]
  };
};

async function seedFarms(connection) {
  logger.info('Seeding farms...');
  
  const farmIds = [];
  
  for (const farm of DEMO_FARMS) {
    const sql = `
      INSERT INTO farms (
        farm_name, owner_name, contact_email, contact_phone,
        location, total_area_hectares, permit_number, permit_expiry
      ) VALUES (
        ?, ?, ?, ?,
        ST_GeomFromText('POINT(? ?)', 4326),
        ?, ?, ?
      )
    `;
    
    const [result] = await connection.execute(sql, [
      farm.farmName,
      farm.ownerName,
      farm.contactEmail,
      farm.contactPhone,
      farm.longitude,
      farm.latitude,
      farm.totalAreaHectares,
      farm.permitNumber,
      farm.permitExpiry
    ]);
    
    farmIds.push({
      id: result.insertId,
      ...farm
    });
    
    logger.info(`Created farm: ${farm.farmName} (ID: ${result.insertId})`);
  }
  
  return farmIds;
}

async function seedBurnRequests(connection, farms) {
  logger.info('Seeding burn requests...');
  
  const today = new Date();
  const cropTypes = ['wheat', 'corn', 'rice', 'sugarcane', 'soybean'];
  const burnTypes = ['broadcast', 'pile', 'prescribed'];
  
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const burnDate = new Date(today);
    burnDate.setDate(burnDate.getDate() + dayOffset);
    const dateStr = burnDate.toISOString().split('T')[0];
    
    const numBurnsPerDay = 3 + Math.floor(Math.random() * 3);
    const selectedFarms = farms.sort(() => Math.random() - 0.5).slice(0, numBurnsPerDay);
    
    for (const farm of selectedFarms) {
      const fieldSize = 20 + Math.random() * 80;
      const fieldGeometry = createFieldGeometry(
        farm.latitude + (Math.random() - 0.5) * 0.05,
        farm.longitude + (Math.random() - 0.5) * 0.05,
        fieldSize
      );
      
      const fieldSql = `
        INSERT INTO burn_fields (
          farm_id, field_name, field_geometry, area_hectares,
          crop_type, fuel_load_tons_per_hectare, terrain_slope,
          elevation_meters, last_burn_date
        ) VALUES (?, ?, ST_GeomFromGeoJSON(?), ?, ?, ?, ?, ?, ?)
      `;
      
      const [fieldResult] = await connection.execute(fieldSql, [
        farm.id,
        `Field ${dayOffset + 1}`,
        JSON.stringify(fieldGeometry),
        fieldSize,
        cropTypes[Math.floor(Math.random() * cropTypes.length)],
        8 + Math.random() * 12,
        Math.random() * 15,
        100 + Math.random() * 200,
        dayOffset > 0 ? '2024-03-15' : null
      ]);
      
      const startHour = 6 + Math.floor(Math.random() * 8);
      const requestSql = `
        INSERT INTO burn_requests (
          field_id, requested_date, requested_start_time,
          requested_end_time, burn_type, purpose,
          estimated_duration_hours, status, priority_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const status = dayOffset === 0 ? 'scheduled' : 
                    dayOffset === 1 ? 'approved' : 'pending';
      
      const [requestResult] = await connection.execute(requestSql, [
        fieldResult.insertId,
        dateStr,
        `${startHour.toString().padStart(2, '0')}:00:00`,
        `${(startHour + 4).toString().padStart(2, '0')}:00:00`,
        burnTypes[Math.floor(Math.random() * burnTypes.length)],
        'Crop residue management and field preparation',
        4,
        status,
        50 + Math.floor(Math.random() * 50)
      ]);
      
      logger.info(`Created burn request for ${farm.farmName} on ${dateStr} (ID: ${requestResult.insertId})`);
      
      try {
        const weather = await weatherAgent.fetchCurrentWeather(farm.latitude, farm.longitude);
        await weatherAgent.storeWeatherData(farm.latitude, farm.longitude, weather);
        
        const smokeDispersion = await weatherAgent.predictSmokeDispersion(
          { lat: farm.latitude, lon: farm.longitude },
          fieldSize,
          weather,
          4
        );
        
        const predictionSql = `
          INSERT INTO smoke_predictions (
            burn_request_id, prediction_time, plume_geometry,
            plume_vector, max_pm25_ugm3, affected_area_km2,
            dispersion_radius_km, confidence_score
          ) VALUES (?, ?, ST_Buffer(ST_GeomFromText('POINT(? ?)', 4326), ?), ?, ?, ?, ?, ?)
        `;
        
        await connection.execute(predictionSql, [
          requestResult.insertId,
          new Date(),
          farm.longitude,
          farm.latitude,
          smokeDispersion.maxDispersionKm / 111,
          JSON.stringify(new Array(64).fill(0).map(() => Math.random())),
          smokeDispersion.predictions[2]?.pm25 || 25,
          smokeDispersion.affectedAreaKm2,
          smokeDispersion.maxDispersionKm,
          smokeDispersion.confidenceScore
        ]);
        
        logger.info(`Created smoke prediction for request ${requestResult.insertId}`);
      } catch (error) {
        logger.warn(`Could not fetch weather for ${farm.farmName}: ${error.message}`);
      }
    }
  }
}

async function seedHistoricalBurns(connection, farms) {
  logger.info('Seeding historical burns...');
  
  for (const farm of farms.slice(0, 5)) {
    const historicalSql = `
      INSERT INTO historical_burns (
        field_id, burn_date, start_time, end_time,
        actual_area_burned_hectares, weather_conditions,
        smoke_impact, pm25_measurements, success_rating,
        burn_vector
      ) SELECT 
        field_id,
        DATE_SUB(CURDATE(), INTERVAL ? DAY),
        TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL ? DAY), '08:00:00'),
        TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL ? DAY), '12:00:00'),
        area_hectares * (0.9 + RAND() * 0.1),
        JSON_OBJECT('windSpeed', 3 + RAND() * 5, 'humidity', 40 + RAND() * 30),
        JSON_OBJECT('maxPM25', 20 + RAND() * 30, 'affectedArea', 5 + RAND() * 15),
        JSON_ARRAY(15 + RAND() * 20, 20 + RAND() * 25, 25 + RAND() * 30),
        3 + FLOOR(RAND() * 3),
        ?
      FROM burn_fields
      WHERE farm_id = ?
      LIMIT 1
    `;
    
    const daysAgo = 30 + Math.floor(Math.random() * 300);
    const burnVector = JSON.stringify(new Array(32).fill(0).map(() => Math.random()));
    
    await connection.execute(historicalSql, [
      daysAgo, daysAgo, daysAgo, burnVector, farm.id
    ]);
    
    logger.info(`Created historical burn for farm ${farm.id}`);
  }
}

async function detectAndLogConflicts() {
  const predictor = require('./agents/predictor');
  const smokePredictor = new predictor();
  
  const today = new Date().toISOString().split('T')[0];
  const conflicts = await smokePredictor.detectAllConflicts(today);
  
  if (conflicts.length > 0) {
    logger.info(`DEMO: Detected ${conflicts.length} conflicts for ${today}:`);
    conflicts.forEach(c => {
      logger.info(`  - Conflict between burns ${c.burn1} and ${c.burn2}: ${c.severity} severity`);
    });
  } else {
    logger.info(`DEMO: No conflicts detected for ${today}`);
  }
  
  return conflicts;
}

async function runOptimization() {
  const optimizer = require('./agents/optimizer');
  const scheduleOptimizer = new optimizer();
  
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 3);
  
  logger.info('DEMO: Running schedule optimization...');
  
  try {
    const result = await scheduleOptimizer.optimizeSchedule(
      today.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    if (result.success) {
      logger.info(`DEMO: Optimization complete!`);
      logger.info(`  - Conflicts resolved: ${result.improvements.conflictsResolved}`);
      logger.info(`  - Requests rescheduled: ${result.improvements.requestsRescheduled}`);
      logger.info(`  - Average delay: ${result.improvements.averageDelayDays} days`);
    }
  } catch (error) {
    logger.warn('DEMO: Optimization skipped - not enough requests');
  }
}

async function main() {
  const connection = await getConnection();
  
  try {
    logger.info('Starting BURNWISE demo data seeding...');
    
    await initializeDatabase();
    logger.info('Database initialized');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    const tables = [
      'alerts', 'burn_trades', 'historical_burns', 'schedule_conflicts',
      'optimized_schedules', 'smoke_predictions', 'burn_requests',
      'burn_fields', 'weather_conditions', 'farms'
    ];
    
    for (const table of tables) {
      await connection.execute(`TRUNCATE TABLE ${table}`);
      logger.info(`Cleared table: ${table}`);
    }
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    const farms = await seedFarms(connection);
    await seedBurnRequests(connection, farms);
    await seedHistoricalBurns(connection, farms);
    
    logger.info('\n=================================');
    logger.info('DEMO DATA SEEDING COMPLETE!');
    logger.info('=================================');
    logger.info(`✅ Created ${farms.length} farms`);
    logger.info('✅ Created burn requests for next 7 days');
    logger.info('✅ Created historical burn records');
    logger.info('✅ Generated smoke predictions');
    
    logger.info('\n🔍 Running conflict detection...');
    const conflicts = await detectAndLogConflicts();
    
    if (conflicts.length > 0) {
      logger.info('\n🔧 Running schedule optimization...');
      await runOptimization();
    }
    
    logger.info('\n=================================');
    logger.info('DEMO READY FOR HACKATHON!');
    logger.info('=================================');
    logger.info('\nYou can now:');
    logger.info('1. Start the backend: cd backend && npm run dev');
    logger.info('2. Start the frontend: cd frontend && npm start');
    logger.info('3. View the map at http://localhost:3000');
    logger.info('4. Submit burn requests via the UI');
    logger.info('5. View conflicts and optimized schedules');
    
  } catch (error) {
    logger.error('Error seeding database:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

main().catch(console.error);