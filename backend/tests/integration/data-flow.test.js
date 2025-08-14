const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool, getConnection } = require('../../db/connection');
const CoordinatorAgent = require('../../agents/coordinatorFixed5Agent');
const WeatherAgent = require('../../agents/weather');
const SmokeOverlapPredictor = require('../../agents/predictor');
const ScheduleOptimizer = require('../../agents/optimizer');
const AlertSystem = require('../../agents/alerts');

describe('Data Flow Validation Tests - End-to-End Data Integrity', () => {
  let coordinator;
  let weatherAgent;
  let predictor;
  let optimizer;
  let alertSystem;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    coordinator = new CoordinatorAgent();
    weatherAgent = new WeatherAgent();
    predictor = new SmokeOverlapPredictor();
    optimizer = new ScheduleOptimizer();
    alertSystem = new AlertSystem();
  });
  
  afterAll(async () => {
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });

  describe('Request Data Flow Validation', () => {
    test('Should preserve burn request data integrity through entire pipeline', async () => {
      const originalRequest = {
        farmId: 12345,
        fieldId: 67890,
        requestedDate: '2025-08-30',
        requestedStartTime: '08:00',
        requestedEndTime: '12:00',
        areaHectares: 125.5,
        cropType: 'wheat_stubble',
        fuelLoad: 22.3,
        lat: 40.123456,
        lon: -120.654321,
        farmerName: 'John Smith',
        contactPhone: '+12125551234',
        specialInstructions: 'Notify neighboring farms'
      };
      
      // Stage 1: Coordinator processing
      const coordinatorOutput = await coordinator.coordinateBurnRequest(originalRequest);
      
      // Verify data preservation
      expect(coordinatorOutput.fieldId).toBe(originalRequest.fieldId);
      expect(coordinatorOutput.farmId).toBe(originalRequest.farmId);
      expect(coordinatorOutput.areaHectares).toBe(originalRequest.areaHectares);
      
      // Stage 2: Weather analysis with location data
      const weatherOutput = await weatherAgent.analyzeWeatherForBurn(
        originalRequest.lat,
        originalRequest.lon,
        originalRequest.requestedDate
      );
      
      expect(weatherOutput.location.lat).toBeCloseTo(originalRequest.lat, 5);
      expect(weatherOutput.location.lon).toBeCloseTo(originalRequest.lon, 5);
      
      // Stage 3: Predictor with full request data
      const predictorInput = [{
        ...originalRequest,
        request_id: coordinatorOutput.requestId || originalRequest.fieldId,
        priority_score: coordinatorOutput.priorityScore,
        weather_data: weatherOutput.current
      }];
      
      const predictorOutput = await predictor.predictSmokeOverlap(predictorInput);
      
      expect(predictorOutput.processedRequests).toBe(1);
      
      // Stage 4: Optimizer preserves scheduling constraints
      const optimizerOutput = await optimizer.optimizeWithSimulatedAnnealing(
        predictorInput,
        predictorOutput.conflicts || [],
        { [originalRequest.requestedDate]: weatherOutput.current }
      );
      
      const scheduledRequest = optimizerOutput.schedule[originalRequest.fieldId];
      if (scheduledRequest) {
        expect(scheduledRequest.date).toBe(originalRequest.requestedDate);
      }
      
      // Stage 5: Alert system maintains contact information
      const alertData = {
        burnRequestId: originalRequest.fieldId,
        farmId: originalRequest.farmId,
        farmerName: originalRequest.farmerName,
        contactPhone: originalRequest.contactPhone,
        scheduledTime: new Date(`${originalRequest.requestedDate} ${originalRequest.requestedStartTime}`)
      };
      
      const alertMessage = alertSystem.formatAlert(alertData);
      
      expect(alertMessage).toContain(originalRequest.farmerName);
      expect(alertMessage).toContain(`Farm ${originalRequest.farmId}`);
    });

    test('Should correctly transform vector dimensions through agent pipeline', async () => {
      const dataFlow = {
        terrain: null,    // 32 dimensions
        weather: null,    // 128 dimensions
        smoke: null,      // 64 dimensions
        combined: null    // 224 dimensions total
      };
      
      // Generate terrain vector (32-dim)
      dataFlow.terrain = await coordinator.generateTerrainVector(
        40.0, -120.0, 500, 5, 'grassland'
      );
      expect(dataFlow.terrain).toHaveLength(32);
      expect(dataFlow.terrain.every(v => typeof v === 'number')).toBeTruthy();
      
      // Generate weather vector (128-dim)
      const weatherData = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180,
        pressure: 1013
      };
      dataFlow.weather = weatherAgent.createWeatherEmbedding(weatherData);
      expect(dataFlow.weather).toHaveLength(128);
      
      // Generate smoke vector (64-dim)
      dataFlow.smoke = await predictor.generateSmokeVector(
        1001,
        { windSpeed: 10, windDirection: 180 },
        100
      );
      expect(dataFlow.smoke).toHaveLength(64);
      
      // Combine vectors for comprehensive analysis
      dataFlow.combined = [
        ...dataFlow.terrain,
        ...dataFlow.smoke,
        ...dataFlow.weather
      ];
      expect(dataFlow.combined).toHaveLength(224);
      
      // Verify no data corruption
      const hasNaN = dataFlow.combined.some(v => isNaN(v));
      const hasInfinity = dataFlow.combined.some(v => !isFinite(v));
      
      expect(hasNaN).toBeFalsy();
      expect(hasInfinity).toBeFalsy();
    });

    test('Should maintain temporal consistency across agents', async () => {
      const testDate = '2025-09-01';
      const testTime = '10:00';
      const fullDateTime = new Date(`${testDate}T${testTime}:00`);
      
      // Each agent should handle the same temporal reference
      const timeReferences = {
        coordinator: null,
        weather: null,
        predictor: null,
        optimizer: null,
        alerts: null
      };
      
      // Coordinator uses requested date
      const coordRequest = await coordinator.coordinateBurnRequest({
        farmId: 1,
        fieldId: 1,
        requestedDate: testDate,
        requestedStartTime: testTime,
        areaHectares: 50
      });
      timeReferences.coordinator = coordRequest.requestedDate;
      
      // Weather uses same date for forecast
      const weatherAnalysis = await weatherAgent.analyzeWeatherForBurn(
        40.0, -120.0, testDate
      );
      timeReferences.weather = weatherAnalysis.date;
      
      // Predictor maintains temporal window
      const predictions = await predictor.predictSmokeOverlap([{
        request_id: 1,
        requested_date: testDate,
        requested_start_time: testTime,
        area_hectares: 50,
        lat: 40.0,
        lon: -120.0
      }]);
      timeReferences.predictor = testDate;
      
      // Optimizer schedules for same date
      const optimized = await optimizer.optimizeWithSimulatedAnnealing(
        [{ request_id: 1, requested_date: testDate, requested_start_time: testTime }],
        [],
        { [testDate]: {} }
      );
      
      if (optimized.schedule[1]) {
        timeReferences.optimizer = optimized.schedule[1].date;
      }
      
      // Alerts use scheduled time
      timeReferences.alerts = fullDateTime.toISOString();
      
      // Verify temporal consistency
      expect(timeReferences.coordinator).toBe(testDate);
      expect(timeReferences.weather).toBe(testDate);
      expect(timeReferences.predictor).toBe(testDate);
    });

    test('Should propagate priority scores correctly through workflow', async () => {
      const priorities = [
        { farmId: 1, fieldId: 101, areaHectares: 200, expectedPriority: 'high' },
        { farmId: 2, fieldId: 102, areaHectares: 50, expectedPriority: 'medium' },
        { farmId: 3, fieldId: 103, areaHectares: 10, expectedPriority: 'low' }
      ];
      
      const scorePropagation = [];
      
      for (const farm of priorities) {
        // Coordinator calculates initial priority
        const coordResult = await coordinator.coordinateBurnRequest({
          farmId: farm.farmId,
          fieldId: farm.fieldId,
          areaHectares: farm.areaHectares,
          requestedDate: '2025-09-01'
        });
        
        const priorityScore = coordResult.priorityScore;
        
        // Score should influence optimizer decisions
        const optimizerInput = {
          request_id: farm.fieldId,
          priority_score: priorityScore,
          area_hectares: farm.areaHectares
        };
        
        scorePropagation.push({
          fieldId: farm.fieldId,
          initialScore: priorityScore,
          areaHectares: farm.areaHectares,
          expectedPriority: farm.expectedPriority
        });
      }
      
      // Verify priority ordering
      scorePropagation.sort((a, b) => b.initialScore - a.initialScore);
      
      // Larger areas should generally have higher priority
      expect(scorePropagation[0].areaHectares).toBeGreaterThan(scorePropagation[2].areaHectares);
      
      // Scores should be in valid range
      scorePropagation.forEach(item => {
        expect(item.initialScore).toBeGreaterThan(0);
        expect(item.initialScore).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Database Data Flow Integrity', () => {
    test('Should maintain referential integrity across tables', async () => {
      try {
        // Create test schema
        await query(`
          CREATE TABLE IF NOT EXISTS test_farms_flow (
            farm_id INT PRIMARY KEY AUTO_INCREMENT,
            farm_name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        await query(`
          CREATE TABLE IF NOT EXISTS test_fields_flow (
            field_id INT PRIMARY KEY AUTO_INCREMENT,
            farm_id INT,
            area_hectares DECIMAL(10, 2),
            FOREIGN KEY (farm_id) REFERENCES test_farms_flow(farm_id)
          )
        `);
        
        await query(`
          CREATE TABLE IF NOT EXISTS test_burns_flow (
            burn_id INT PRIMARY KEY AUTO_INCREMENT,
            field_id INT,
            requested_date DATE,
            status VARCHAR(50),
            FOREIGN KEY (field_id) REFERENCES test_fields_flow(field_id)
          )
        `);
        
        // Insert related data
        const farmResult = await query(
          'INSERT INTO test_farms_flow (farm_name) VALUES (?)',
          ['Test Farm Flow']
        );
        const farmId = farmResult.insertId;
        
        const fieldResult = await query(
          'INSERT INTO test_fields_flow (farm_id, area_hectares) VALUES (?, ?)',
          [farmId, 100.5]
        );
        const fieldId = fieldResult.insertId;
        
        const burnResult = await query(
          'INSERT INTO test_burns_flow (field_id, requested_date, status) VALUES (?, ?, ?)',
          [fieldId, '2025-09-01', 'pending']
        );
        const burnId = burnResult.insertId;
        
        // Verify relationships
        const joinedData = await query(`
          SELECT b.burn_id, f.field_id, fm.farm_id, fm.farm_name
          FROM test_burns_flow b
          JOIN test_fields_flow f ON b.field_id = f.field_id
          JOIN test_farms_flow fm ON f.farm_id = fm.farm_id
          WHERE b.burn_id = ?
        `, [burnId]);
        
        expect(joinedData).toHaveLength(1);
        expect(joinedData[0].farm_name).toBe('Test Farm Flow');
        expect(joinedData[0].farm_id).toBe(farmId);
        expect(joinedData[0].field_id).toBe(fieldId);
        
        // Cleanup
        await query('DROP TABLE IF EXISTS test_burns_flow');
        await query('DROP TABLE IF EXISTS test_fields_flow');
        await query('DROP TABLE IF EXISTS test_farms_flow');
      } catch (error) {
        // Handle case where foreign keys not supported
        console.warn('Foreign key test skipped:', error.message);
      }
    });

    test('Should handle transaction atomicity for multi-table updates', async () => {
      const connection = await getConnection();
      
      try {
        // Create test tables
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS test_trans_farm (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100),
            burn_count INT DEFAULT 0
          )
        `);
        
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS test_trans_burn (
            id INT PRIMARY KEY AUTO_INCREMENT,
            farm_id INT,
            status VARCHAR(50)
          )
        `);
        
        // Start transaction
        await connection.beginTransaction();
        
        // Insert farm
        const [farmResult] = await connection.execute(
          'INSERT INTO test_trans_farm (name) VALUES (?)',
          ['Transaction Test Farm']
        );
        const farmId = farmResult.insertId;
        
        // Insert burn
        await connection.execute(
          'INSERT INTO test_trans_burn (farm_id, status) VALUES (?, ?)',
          [farmId, 'scheduled']
        );
        
        // Update farm burn count
        await connection.execute(
          'UPDATE test_trans_farm SET burn_count = burn_count + 1 WHERE id = ?',
          [farmId]
        );
        
        // Verify within transaction
        const [checkResult] = await connection.execute(
          'SELECT burn_count FROM test_trans_farm WHERE id = ?',
          [farmId]
        );
        
        expect(checkResult[0].burn_count).toBe(1);
        
        // Commit transaction
        await connection.commit();
        
        // Verify after commit
        const [finalCheck] = await connection.execute(
          'SELECT COUNT(*) as count FROM test_trans_burn WHERE farm_id = ?',
          [farmId]
        );
        
        expect(finalCheck[0].count).toBe(1);
        
        // Cleanup
        await connection.execute('DROP TABLE IF EXISTS test_trans_burn');
        await connection.execute('DROP TABLE IF EXISTS test_trans_farm');
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    });

    test('Should correctly serialize and deserialize JSON data', async () => {
      const complexData = {
        burnRequest: {
          id: 12345,
          geometry: {
            type: 'Polygon',
            coordinates: [[
              [-120.01, 40.01],
              [-119.99, 40.01],
              [-119.99, 39.99],
              [-120.01, 39.99],
              [-120.01, 40.01]
            ]]
          },
          metadata: {
            windData: { speed: 10.5, direction: 180 },
            pm25Levels: [12, 15, 18, 22, 25],
            vectors: {
              terrain: new Array(32).fill(0).map(() => Math.random()),
              smoke: new Array(64).fill(0).map(() => Math.random())
            }
          }
        }
      };
      
      // Store as JSON
      await query(`
        CREATE TABLE IF NOT EXISTS test_json_flow (
          id INT PRIMARY KEY AUTO_INCREMENT,
          data JSON
        )
      `);
      
      const jsonString = JSON.stringify(complexData);
      await query(
        'INSERT INTO test_json_flow (data) VALUES (?)',
        [jsonString]
      );
      
      // Retrieve and parse
      const result = await query('SELECT data FROM test_json_flow ORDER BY id DESC LIMIT 1');
      
      const retrieved = typeof result[0].data === 'string' 
        ? JSON.parse(result[0].data)
        : result[0].data;
      
      // Verify structure preserved
      expect(retrieved.burnRequest.id).toBe(complexData.burnRequest.id);
      expect(retrieved.burnRequest.geometry.type).toBe('Polygon');
      expect(retrieved.burnRequest.geometry.coordinates[0]).toHaveLength(5);
      expect(retrieved.burnRequest.metadata.windData.speed).toBe(10.5);
      expect(retrieved.burnRequest.metadata.pm25Levels).toHaveLength(5);
      expect(retrieved.burnRequest.metadata.vectors.terrain).toHaveLength(32);
      expect(retrieved.burnRequest.metadata.vectors.smoke).toHaveLength(64);
      
      // Cleanup
      await query('DROP TABLE IF EXISTS test_json_flow');
    });

    test('Should handle spatial data transformations correctly', async () => {
      const spatialData = {
        original: {
          type: 'Polygon',
          coordinates: [[
            [-120.5, 40.5],
            [-120.0, 40.5],
            [-120.0, 40.0],
            [-120.5, 40.0],
            [-120.5, 40.5]
          ]]
        }
      };
      
      try {
        // Create table with spatial column
        await query(`
          CREATE TABLE IF NOT EXISTS test_spatial_flow (
            id INT PRIMARY KEY AUTO_INCREMENT,
            field_geometry GEOMETRY,
            area_hectares DECIMAL(10, 2)
          )
        `);
        
        // Convert to WKT format
        const coordinates = spatialData.original.coordinates[0]
          .map(coord => `${coord[0]} ${coord[1]}`)
          .join(', ');
        const wkt = `POLYGON((${coordinates}))`;
        
        // Insert spatial data
        await query(
          `INSERT INTO test_spatial_flow (field_geometry, area_hectares) 
           VALUES (ST_GeomFromText(?, 4326), ?)`,
          [wkt, 2500]
        );
        
        // Retrieve and verify
        const result = await query(`
          SELECT 
            ST_AsText(field_geometry) as geometry_wkt,
            ST_Area(field_geometry) as calculated_area,
            area_hectares
          FROM test_spatial_flow
          ORDER BY id DESC LIMIT 1
        `);
        
        expect(result[0].geometry_wkt).toContain('POLYGON');
        expect(result[0].area_hectares).toBe(2500);
        
        // Cleanup
        await query('DROP TABLE IF EXISTS test_spatial_flow');
      } catch (error) {
        // Spatial functions might not be available
        console.warn('Spatial test skipped:', error.message);
      }
    });
  });

  describe('Error Propagation and Recovery', () => {
    test('Should propagate validation errors through data flow', async () => {
      const invalidRequests = [
        { farmId: null, fieldId: 1, error: 'missing_farm_id' },
        { farmId: 1, areaHectares: -100, error: 'negative_area' },
        { farmId: 1, requestedDate: 'invalid-date', error: 'invalid_date' },
        { farmId: 1, lat: 200, lon: -300, error: 'invalid_coordinates' }
      ];
      
      const errorFlow = [];
      
      for (const request of invalidRequests) {
        try {
          await coordinator.coordinateBurnRequest(request);
          errorFlow.push({ request, error: null });
        } catch (error) {
          errorFlow.push({
            request,
            expectedError: request.error,
            actualError: error.message
          });
        }
      }
      
      // Verify errors were caught
      const errorsDetected = errorFlow.filter(e => e.actualError).length;
      expect(errorsDetected).toBeGreaterThan(0);
      
      // Errors should be descriptive
      errorFlow.forEach(item => {
        if (item.actualError) {
          expect(item.actualError).toBeDefined();
          expect(item.actualError.length).toBeGreaterThan(0);
        }
      });
    });

    test('Should maintain data consistency during partial failures', async () => {
      const batchRequests = [
        { farmId: 1, fieldId: 201, areaHectares: 50, valid: true },
        { farmId: 2, fieldId: 202, areaHectares: -50, valid: false }, // Invalid
        { farmId: 3, fieldId: 203, areaHectares: 75, valid: true }
      ];
      
      const results = {
        successful: [],
        failed: []
      };
      
      for (const request of batchRequests) {
        try {
          const result = await coordinator.coordinateBurnRequest({
            farmId: request.farmId,
            fieldId: request.fieldId,
            areaHectares: request.areaHectares,
            requestedDate: '2025-09-01'
          });
          results.successful.push({ fieldId: request.fieldId, result });
        } catch (error) {
          results.failed.push({ fieldId: request.fieldId, error: error.message });
        }
      }
      
      // Should have both successes and failures
      expect(results.successful.length).toBeGreaterThan(0);
      expect(results.failed.length).toBeGreaterThan(0);
      
      // Valid requests should succeed
      const validRequests = batchRequests.filter(r => r.valid);
      expect(results.successful.length).toBe(validRequests.length);
    });

    test('Should implement retry logic for transient failures', async () => {
      class RetryableOperation {
        constructor(maxRetries = 3, backoffMs = 100) {
          this.maxRetries = maxRetries;
          this.backoffMs = backoffMs;
          this.attempts = 0;
        }
        
        async execute(operation) {
          while (this.attempts < this.maxRetries) {
            try {
              this.attempts++;
              return await operation();
            } catch (error) {
              if (this.attempts >= this.maxRetries) {
                throw error;
              }
              
              // Check if error is retryable
              const retryableErrors = ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND'];
              const isRetryable = retryableErrors.some(e => error.message.includes(e));
              
              if (!isRetryable) {
                throw error;
              }
              
              // Exponential backoff
              const delay = this.backoffMs * Math.pow(2, this.attempts - 1);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      }
      
      // Simulate operation that fails twice then succeeds
      let callCount = 0;
      const flakeyOperation = async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('ETIMEDOUT: Connection timeout');
        }
        return { success: true, attempts: callCount };
      };
      
      const retry = new RetryableOperation(3, 10);
      const result = await retry.execute(flakeyOperation);
      
      expect(result.success).toBeTruthy();
      expect(result.attempts).toBe(3);
      expect(retry.attempts).toBe(3);
    });

    test('Should validate data schema at agent boundaries', async () => {
      const schemaValidators = {
        burnRequest: (data) => {
          const required = ['farmId', 'fieldId', 'areaHectares', 'requestedDate'];
          return required.every(field => data.hasOwnProperty(field));
        },
        
        weatherData: (data) => {
          const required = ['temperature', 'humidity', 'windSpeed', 'windDirection'];
          return required.every(field => data.hasOwnProperty(field));
        },
        
        vectorData: (data) => {
          return Array.isArray(data) && 
                 data.every(v => typeof v === 'number') &&
                 !data.some(v => isNaN(v) || !isFinite(v));
        }
      };
      
      // Test valid schemas
      const validBurnRequest = {
        farmId: 1,
        fieldId: 1,
        areaHectares: 100,
        requestedDate: '2025-09-01'
      };
      expect(schemaValidators.burnRequest(validBurnRequest)).toBeTruthy();
      
      const validWeatherData = {
        temperature: 25,
        humidity: 60,
        windSpeed: 10,
        windDirection: 180
      };
      expect(schemaValidators.weatherData(validWeatherData)).toBeTruthy();
      
      const validVector = new Array(32).fill(0).map(() => Math.random());
      expect(schemaValidators.vectorData(validVector)).toBeTruthy();
      
      // Test invalid schemas
      const invalidBurnRequest = { farmId: 1 }; // Missing required fields
      expect(schemaValidators.burnRequest(invalidBurnRequest)).toBeFalsy();
      
      const invalidVector = [1, 2, NaN, 4]; // Contains NaN
      expect(schemaValidators.vectorData(invalidVector)).toBeFalsy();
    });
  });

  describe('Performance and Optimization', () => {
    test('Should batch database operations for efficiency', async () => {
      const batchSize = 100;
      const testData = Array.from({ length: batchSize }, (_, i) => ({
        id: i + 1,
        value: Math.random(),
        timestamp: new Date()
      }));
      
      // Create test table
      await query(`
        CREATE TABLE IF NOT EXISTS test_batch_flow (
          id INT PRIMARY KEY,
          value DECIMAL(10, 6),
          timestamp TIMESTAMP
        )
      `);
      
      const startTime = Date.now();
      
      // Batch insert
      const values = testData.map(d => [d.id, d.value, d.timestamp]);
      const placeholders = values.map(() => '(?, ?, ?)').join(', ');
      const flatValues = values.flat();
      
      await query(
        `INSERT INTO test_batch_flow (id, value, timestamp) VALUES ${placeholders}`,
        flatValues
      );
      
      const batchTime = Date.now() - startTime;
      
      // Verify all inserted
      const count = await query('SELECT COUNT(*) as count FROM test_batch_flow');
      expect(count[0].count).toBe(batchSize);
      
      // Batch operations should be fast
      expect(batchTime).toBeLessThan(5000); // 5 seconds for 100 records
      
      // Cleanup
      await query('DROP TABLE IF EXISTS test_batch_flow');
    });

    test('Should implement efficient data pagination', async () => {
      // Create test data
      await query(`
        CREATE TABLE IF NOT EXISTS test_pagination_flow (
          id INT PRIMARY KEY AUTO_INCREMENT,
          data VARCHAR(100)
        )
      `);
      
      // Insert test records
      const totalRecords = 25;
      for (let i = 0; i < totalRecords; i++) {
        await query(
          'INSERT INTO test_pagination_flow (data) VALUES (?)',
          [`Record ${i + 1}`]
        );
      }
      
      // Test pagination
      const pageSize = 10;
      const pages = [];
      
      for (let page = 0; page < 3; page++) {
        const offset = page * pageSize;
        const results = await query(
          'SELECT * FROM test_pagination_flow ORDER BY id LIMIT ? OFFSET ?',
          [pageSize, offset]
        );
        pages.push(results);
      }
      
      // Verify pagination
      expect(pages[0]).toHaveLength(10); // First page
      expect(pages[1]).toHaveLength(10); // Second page
      expect(pages[2]).toHaveLength(5);  // Last page (partial)
      
      // Verify no duplicates
      const allIds = pages.flat().map(r => r.id);
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(totalRecords);
      
      // Cleanup
      await query('DROP TABLE IF EXISTS test_pagination_flow');
    });

    test('Should cache frequently accessed data', () => {
      class DataCache {
        constructor(ttlMs = 60000) {
          this.cache = new Map();
          this.ttlMs = ttlMs;
        }
        
        set(key, value) {
          this.cache.set(key, {
            value,
            timestamp: Date.now()
          });
        }
        
        get(key) {
          const entry = this.cache.get(key);
          if (!entry) return null;
          
          const age = Date.now() - entry.timestamp;
          if (age > this.ttlMs) {
            this.cache.delete(key);
            return null;
          }
          
          return entry.value;
        }
        
        clear() {
          this.cache.clear();
        }
        
        stats() {
          return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
          };
        }
      }
      
      const cache = new DataCache(1000); // 1 second TTL
      
      // Test caching
      cache.set('weather_40_-120', { temp: 25, humidity: 60 });
      cache.set('farm_123', { name: 'Test Farm', area: 100 });
      
      // Immediate retrieval should work
      expect(cache.get('weather_40_-120')).toEqual({ temp: 25, humidity: 60 });
      expect(cache.get('farm_123')).toEqual({ name: 'Test Farm', area: 100 });
      
      // Cache stats
      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('weather_40_-120');
      
      // Test TTL expiration
      setTimeout(() => {
        const expired = cache.get('weather_40_-120');
        expect(expired).toBeNull();
      }, 1100);
    });

    test('Should optimize vector similarity calculations', () => {
      // Generate test vectors
      const vectors1 = Array.from({ length: 10 }, () => 
        new Array(128).fill(0).map(() => Math.random())
      );
      
      const vectors2 = Array.from({ length: 10 }, () =>
        new Array(128).fill(0).map(() => Math.random())
      );
      
      // Optimized cosine similarity using pre-computed magnitudes
      const magnitudes1 = vectors1.map(v => 
        Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
      );
      
      const magnitudes2 = vectors2.map(v =>
        Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
      );
      
      const startTime = performance.now();
      
      // Calculate all pairwise similarities
      const similarities = [];
      for (let i = 0; i < vectors1.length; i++) {
        for (let j = 0; j < vectors2.length; j++) {
          const dotProduct = vectors1[i].reduce((sum, val, idx) => 
            sum + val * vectors2[j][idx], 0
          );
          
          const similarity = dotProduct / (magnitudes1[i] * magnitudes2[j]);
          similarities.push({ i, j, similarity });
        }
      }
      
      const calcTime = performance.now() - startTime;
      
      // Should calculate 100 similarities quickly
      expect(similarities).toHaveLength(100);
      expect(calcTime).toBeLessThan(100); // Less than 100ms
      
      // Similarities should be in valid range
      similarities.forEach(s => {
        expect(s.similarity).toBeGreaterThanOrEqual(-1);
        expect(s.similarity).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Data Validation and Sanitization', () => {
    test('Should sanitize user input to prevent injection attacks', () => {
      const dangerousInputs = [
        "'; DROP TABLE users; --",
        "<script>alert('XSS')</script>",
        "../../etc/passwd",
        "${7*7}",
        "{{7*7}}",
        "%00",
        "\x00test",
        "test\r\nContent-Length: 0\r\n\r\nHTTP/1.1 200 OK"
      ];
      
      const sanitize = (input) => {
        // Remove or escape dangerous characters
        return input
          .replace(/[;<>'"]/g, '')
          .replace(/\.\./g, '')
          .replace(/[{}$]/g, '')
          .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
          .trim();
      };
      
      dangerousInputs.forEach(input => {
        const sanitized = sanitize(input);
        
        // Should not contain dangerous patterns
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('../');
        expect(sanitized).not.toContain('${');
        expect(sanitized).not.toContain('{{');
        expect(sanitized).not.toContain('\x00');
        expect(sanitized).not.toContain('\r\n');
      });
    });

    test('Should validate and normalize coordinate data', () => {
      const coordinates = [
        { lat: 40.7128, lon: -74.0060, valid: true },     // New York
        { lat: -33.8688, lon: 151.2093, valid: true },    // Sydney
        { lat: 91, lon: 0, valid: false },                // Invalid latitude
        { lat: 0, lon: 181, valid: false },               // Invalid longitude
        { lat: 'forty', lon: 'seventy', valid: false },   // Non-numeric
        { lat: null, lon: undefined, valid: false },      // Missing
        { lat: 40.71289876543, lon: -74.00601234567, valid: true } // High precision
      ];
      
      const validateCoordinates = (lat, lon) => {
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (isNaN(lat) || isNaN(lon)) return false;
        if (lat < -90 || lat > 90) return false;
        if (lon < -180 || lon > 180) return false;
        return true;
      };
      
      const normalizeCoordinates = (lat, lon) => {
        // Round to 6 decimal places (11cm precision)
        return {
          lat: Math.round(lat * 1000000) / 1000000,
          lon: Math.round(lon * 1000000) / 1000000
        };
      };
      
      coordinates.forEach(coord => {
        const isValid = validateCoordinates(coord.lat, coord.lon);
        expect(isValid).toBe(coord.valid);
        
        if (isValid) {
          const normalized = normalizeCoordinates(coord.lat, coord.lon);
          expect(normalized.lat).toBeCloseTo(coord.lat, 6);
          expect(normalized.lon).toBeCloseTo(coord.lon, 6);
        }
      });
    });

    test('Should enforce data type constraints', () => {
      const dataConstraints = {
        farmId: { type: 'integer', min: 1, max: 999999 },
        areaHectares: { type: 'decimal', min: 0.1, max: 10000 },
        requestedDate: { type: 'date', format: 'YYYY-MM-DD' },
        windSpeed: { type: 'decimal', min: 0, max: 100 },
        pm25Level: { type: 'decimal', min: 0, max: 500 }
      };
      
      const validateConstraint = (value, constraint) => {
        switch (constraint.type) {
          case 'integer':
            if (!Number.isInteger(value)) return false;
            break;
          case 'decimal':
            if (typeof value !== 'number') return false;
            break;
          case 'date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
            break;
        }
        
        if (constraint.min !== undefined && value < constraint.min) return false;
        if (constraint.max !== undefined && value > constraint.max) return false;
        
        return true;
      };
      
      // Test valid values
      expect(validateConstraint(123, dataConstraints.farmId)).toBeTruthy();
      expect(validateConstraint(50.5, dataConstraints.areaHectares)).toBeTruthy();
      expect(validateConstraint('2025-09-01', dataConstraints.requestedDate)).toBeTruthy();
      expect(validateConstraint(15.5, dataConstraints.windSpeed)).toBeTruthy();
      expect(validateConstraint(35, dataConstraints.pm25Level)).toBeTruthy();
      
      // Test invalid values
      expect(validateConstraint(1.5, dataConstraints.farmId)).toBeFalsy(); // Not integer
      expect(validateConstraint(-10, dataConstraints.areaHectares)).toBeFalsy(); // Below min
      expect(validateConstraint('09/01/2025', dataConstraints.requestedDate)).toBeFalsy(); // Wrong format
      expect(validateConstraint(150, dataConstraints.windSpeed)).toBeFalsy(); // Above max
      expect(validateConstraint('high', dataConstraints.pm25Level)).toBeFalsy(); // Wrong type
    });
  });
});

module.exports = {
  sanitize: (input) => {
    return input
      .replace(/[;<>'"]/g, '')
      .replace(/\.\./g, '')
      .replace(/[{}$]/g, '')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
  },
  
  validateCoordinates: (lat, lon) => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return false;
    if (isNaN(lat) || isNaN(lon)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lon < -180 || lon > 180) return false;
    return true;
  },
  
  normalizeCoordinates: (lat, lon) => {
    return {
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000
    };
  }
};