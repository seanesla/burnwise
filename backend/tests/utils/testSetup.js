const { query, executeInTransaction } = require('../../db/connection');
const TestDataGenerator = require('./testDataGenerator');
const logger = require('../../middleware/logger');

/**
 * Comprehensive Test Setup and Database Management
 * Provides clean database state and realistic test data for all test suites
 */

class TestSetup {
  constructor() {
    this.generator = new TestDataGenerator();
    this.testDatabases = new Map();
    this.testData = new Map();
  }

  // Database Setup and Teardown
  async createTestDatabase(testSuiteName) {
    const dbName = `burnwise_test_${testSuiteName}_${Date.now()}`;
    
    try {
      await query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await query(`USE \`${dbName}\``);
      
      // Create all required tables with proper schemas
      await this.createTestTables();
      
      this.testDatabases.set(testSuiteName, dbName);
      return dbName;
    } catch (error) {
      logger.error(`Failed to create test database: ${error.message}`);
      throw error;
    }
  }

  async createTestTables() {
    const tables = [
      {
        name: 'farms',
        schema: `
          CREATE TABLE IF NOT EXISTS farms (
            id VARCHAR(50) PRIMARY KEY,
            farm_name VARCHAR(255) NOT NULL,
            owner_name VARCHAR(255) NOT NULL,
            contact_phone VARCHAR(20),
            contact_email VARCHAR(255),
            total_acres DECIMAL(10,2),
            location_lat DECIMAL(10,6),
            location_lng DECIMAL(10,6),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            SPATIAL INDEX idx_location (location_lat, location_lng)
          )`
      },
      {
        name: 'burn_requests',
        schema: `
          CREATE TABLE IF NOT EXISTS burn_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            farm_id VARCHAR(50) NOT NULL,
            burn_date DATETIME NOT NULL,
            acres DECIMAL(10,2) NOT NULL,
            fuel_type VARCHAR(50) NOT NULL,
            burn_intensity ENUM('low', 'moderate', 'high') NOT NULL,
            field_boundaries JSON,
            priority_score DECIMAL(3,1),
            status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
            burn_vector VECTOR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_farm (farm_id),
            INDEX idx_burn_date (burn_date),
            INDEX idx_status (status),
            VECTOR INDEX idx_burn_vector ((VEC_COSINE_DISTANCE(burn_vector)))
          )`
      },
      {
        name: 'weather_patterns',
        schema: `
          CREATE TABLE IF NOT EXISTS weather_patterns (
            id INT AUTO_INCREMENT PRIMARY KEY,
            location_lat DECIMAL(10,6),
            location_lng DECIMAL(10,6),
            temperature DECIMAL(5,2),
            humidity INT,
            wind_speed DECIMAL(5,2),
            wind_direction INT,
            atmospheric_stability ENUM('very_unstable', 'unstable', 'neutral', 'stable', 'very_stable'),
            pressure DECIMAL(6,1),
            visibility DECIMAL(5,2),
            recorded_at TIMESTAMP,
            weather_pattern_embedding VECTOR(128),
            suitability_score DECIMAL(3,1),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            SPATIAL INDEX idx_location (location_lat, location_lng),
            INDEX idx_recorded_at (recorded_at),
            VECTOR INDEX idx_weather_embedding ((VEC_COSINE_DISTANCE(weather_pattern_embedding)))
          )`
      },
      {
        name: 'smoke_predictions',
        schema: `
          CREATE TABLE IF NOT EXISTS smoke_predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            burn_id INT NOT NULL,
            max_dispersion_radius INT,
            predicted_pm25 DECIMAL(6,2),
            confidence_score DECIMAL(3,2),
            gaussian_parameters JSON,
            concentration_data JSON,
            plume_vector VECTOR(64),
            prediction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_burn_id (burn_id),
            INDEX idx_prediction_timestamp (prediction_timestamp),
            VECTOR INDEX idx_plume_vector ((VEC_COSINE_DISTANCE(plume_vector)))
          )`
      },
      {
        name: 'schedule_optimizations',
        schema: `
          CREATE TABLE IF NOT EXISTS schedule_optimizations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            optimization_date DATE,
            algorithm_type VARCHAR(50),
            initial_score DECIMAL(8,4),
            final_score DECIMAL(8,4),
            iterations_run INT,
            processing_time_ms INT,
            conflicts_resolved INT,
            optimization_parameters JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_optimization_date (optimization_date),
            INDEX idx_algorithm_type (algorithm_type)
          )`
      },
      {
        name: 'alerts',
        schema: `
          CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            burn_id INT NOT NULL,
            alert_type ENUM('conflict', 'weather_warning', 'epa_violation', 'system_error'),
            severity ENUM('low', 'medium', 'high', 'critical'),
            message TEXT,
            alert_channels JSON,
            sent_at TIMESTAMP,
            acknowledged_at TIMESTAMP,
            resolved_at TIMESTAMP,
            INDEX idx_burn_id (burn_id),
            INDEX idx_alert_type (alert_type),
            INDEX idx_severity (severity),
            INDEX idx_sent_at (sent_at)
          )`
      },
      {
        name: 'system_metrics',
        schema: `
          CREATE TABLE IF NOT EXISTS system_metrics (
            id INT AUTO_INCREMENT PRIMARY KEY,
            metric_name VARCHAR(100),
            metric_value DECIMAL(15,6),
            metric_unit VARCHAR(20),
            tags JSON,
            recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_metric_name (metric_name),
            INDEX idx_recorded_at (recorded_at)
          )`
      }
    ];

    for (const table of tables) {
      await query(table.schema);
      logger.info(`Created test table: ${table.name}`);
    }
  }

  async seedTestData(testSuiteName, dataConfig = {}) {
    const {
      farmCount = 20,
      burnRequestCount = 50,
      weatherPatternCount = 100,
      includeConflicts = true,
      includePastData = true
    } = dataConfig;

    const testData = {
      farms: [],
      burnRequests: [],
      weatherPatterns: [],
      smokePredictions: [],
      alerts: []
    };

    try {
      await executeInTransaction(async (connection) => {
        // Generate and insert farms
        for (let i = 0; i < farmCount; i++) {
          const coordinates = this.generator.generateCoordinates();
          const farmName = this.generator.generateFarmName();
          const farmData = {
            id: this.generator.generateFarmId(),
            farm_name: farmName,
            owner_name: this.generateOwnerName(),
            contact_phone: this.generator.generateContactPhone(),
            contact_email: this.generator.generateContactEmail(farmName),
            total_acres: this.generator.generateAcreage() * 5, // Larger total farm size
            location_lat: coordinates.latitude,
            location_lng: coordinates.longitude
          };

          await connection.execute(
            `INSERT INTO farms (id, farm_name, owner_name, contact_phone, contact_email, total_acres, location_lat, location_lng) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [farmData.id, farmData.farm_name, farmData.owner_name, farmData.contact_phone, 
             farmData.contact_email, farmData.total_acres, farmData.location_lat, farmData.location_lng]
          );
          
          testData.farms.push(farmData);
        }

        // Generate and insert weather patterns
        for (let i = 0; i < weatherPatternCount; i++) {
          const coordinates = this.generator.generateCoordinates();
          const weatherData = this.generator.generateWeatherData(coordinates);
          const weatherVector = this.generator.generateWeatherVector(weatherData);
          const suitabilityScore = this.generator.generateWeatherSuitabilityScore(weatherData);
          
          const recordedAt = new Date();
          if (includePastData) {
            recordedAt.setDate(recordedAt.getDate() - Math.floor(this.generator.rng() * 30));
          }

          await connection.execute(
            `INSERT INTO weather_patterns 
             (location_lat, location_lng, temperature, humidity, wind_speed, wind_direction, 
              atmospheric_stability, pressure, visibility, recorded_at, weather_pattern_embedding, suitability_score) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [coordinates.latitude, coordinates.longitude, weatherData.temperature, weatherData.humidity,
             weatherData.wind_speed, weatherData.wind_direction, weatherData.atmospheric_stability,
             weatherData.pressure, weatherData.visibility, recordedAt, JSON.stringify(weatherVector), suitabilityScore]
          );
          
          testData.weatherPatterns.push({ ...weatherData, coordinates, weatherVector, suitabilityScore });
        }

        // Generate and insert burn requests
        for (let i = 0; i < burnRequestCount; i++) {
          const farmIndex = Math.floor(this.generator.rng() * farmCount);
          const farm = testData.farms[farmIndex];
          const acres = this.generator.generateAcreage();
          
          const burnData = {
            farm_id: farm.id,
            burn_date: this.generator.generateBurnDate(),
            acres: acres,
            fuel_type: this.generator.generateFuelType(),
            burn_intensity: this.generator.generateBurnIntensity(),
            field_boundaries: this.generator.generateFieldBoundaries(farm.location_lat, farm.location_lng, acres),
            status: this.generateBurnStatus()
          };

          const weatherData = this.generator.generateWeatherData({ latitude: farm.location_lat, longitude: farm.location_lng });
          const priorityScore = this.generator.generatePriorityScore(burnData, weatherData);
          const burnVector = this.generator.generateBurnVector(burnData);

          const result = await connection.execute(
            `INSERT INTO burn_requests 
             (farm_id, burn_date, acres, fuel_type, burn_intensity, field_boundaries, priority_score, status, burn_vector) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [burnData.farm_id, burnData.burn_date, burnData.acres, burnData.fuel_type,
             burnData.burn_intensity, JSON.stringify(burnData.field_boundaries), priorityScore, burnData.status, JSON.stringify(burnVector)]
          );

          burnData.id = result.insertId;
          testData.burnRequests.push({ ...burnData, priorityScore, burnVector });

          // Generate smoke predictions for approved burns
          if (burnData.status === 'approved') {
            const gaussianPlume = this.generator.calculateGaussianPlume(burnData, weatherData);
            const smokeVector = this.generator.generateSmokeVector(burnData, weatherData);

            await connection.execute(
              `INSERT INTO smoke_predictions 
               (burn_id, max_dispersion_radius, predicted_pm25, confidence_score, gaussian_parameters, concentration_data, plume_vector) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [burnData.id, gaussianPlume.maxDispersionRadius, gaussianPlume.maxPM25, 
               0.8 + this.generator.rng() * 0.2, JSON.stringify(gaussianPlume.gaussianParameters),
               JSON.stringify(gaussianPlume.concentrations), JSON.stringify(smokeVector)]
            );

            testData.smokePredictions.push({ burnId: burnData.id, ...gaussianPlume, smokeVector });
          }
        }

        // Generate conflicts if requested
        if (includeConflicts) {
          const conflictScenarios = this.generator.generateConflictScenario();
          for (const scenario of conflictScenarios) {
            testData.burnRequests.push(scenario);
          }
        }
      });

      this.testData.set(testSuiteName, testData);
      logger.info(`Seeded test database for ${testSuiteName} with ${JSON.stringify({
        farms: testData.farms.length,
        burnRequests: testData.burnRequests.length,
        weatherPatterns: testData.weatherPatterns.length,
        smokePredictions: testData.smokePredictions.length
      })}`);

      return testData;
    } catch (error) {
      logger.error(`Failed to seed test data: ${error.message}`);
      throw error;
    }
  }

  async cleanupTestDatabase(testSuiteName) {
    const dbName = this.testDatabases.get(testSuiteName);
    if (dbName) {
      try {
        await query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        this.testDatabases.delete(testSuiteName);
        this.testData.delete(testSuiteName);
        logger.info(`Cleaned up test database: ${dbName}`);
      } catch (error) {
        logger.error(`Failed to cleanup test database ${dbName}: ${error.message}`);
      }
    }
  }

  async cleanupAllTestDatabases() {
    const promises = Array.from(this.testDatabases.keys()).map(testSuite => 
      this.cleanupTestDatabase(testSuite)
    );
    await Promise.all(promises);
  }

  // Test Data Helpers
  getTestData(testSuiteName) {
    return this.testData.get(testSuiteName);
  }

  generateBurnStatus() {
    const statuses = ['pending', 'approved', 'rejected', 'completed'];
    const weights = [0.4, 0.3, 0.1, 0.2]; // Pending most common
    
    const rand = this.generator.rng();
    let cumulative = 0;
    for (let i = 0; i < statuses.length; i++) {
      cumulative += weights[i];
      if (rand < cumulative) return statuses[i];
    }
    return 'pending';
  }

  generateOwnerName() {
    const firstNames = ['John', 'Mary', 'Robert', 'Patricia', 'Michael', 'Jennifer', 'William', 'Linda', 'David', 'Elizabeth'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    const firstName = firstNames[Math.floor(this.generator.rng() * firstNames.length)];
    const lastName = lastNames[Math.floor(this.generator.rng() * lastNames.length)];
    
    return `${firstName} ${lastName}`;
  }

  // Performance Test Helpers
  async benchmarkOperation(operation, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      await operation();
      const endTime = process.hrtime.bigint();
      
      times.push(Number(endTime - startTime) / 1000000); // Convert to milliseconds
    }
    
    times.sort((a, b) => a - b);
    
    return {
      mean: times.reduce((sum, time) => sum + time, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
      min: times[0],
      max: times[times.length - 1],
      iterations
    };
  }

  async measureMemoryUsage(operation) {
    const initialMemory = process.memoryUsage();
    
    await operation();
    
    const finalMemory = process.memoryUsage();
    
    return {
      heapUsedDelta: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotalDelta: finalMemory.heapTotal - initialMemory.heapTotal,
      externalDelta: finalMemory.external - initialMemory.external,
      rss: finalMemory.rss
    };
  }

  // Load Testing Utilities
  async simulateConcurrentLoad(operation, concurrency = 10, duration = 5000) {
    const results = [];
    const startTime = Date.now();
    let completed = 0;
    let errors = 0;

    const promises = Array.from({ length: concurrency }, async () => {
      while (Date.now() - startTime < duration) {
        try {
          const operationStart = Date.now();
          await operation();
          const operationTime = Date.now() - operationStart;
          
          results.push({
            timestamp: Date.now(),
            duration: operationTime,
            success: true
          });
          completed++;
        } catch (error) {
          results.push({
            timestamp: Date.now(),
            error: error.message,
            success: false
          });
          errors++;
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });

    await Promise.all(promises);

    const totalOperations = completed + errors;
    const averageLatency = results
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.duration, 0) / completed;

    return {
      totalOperations,
      successful: completed,
      errors,
      errorRate: errors / totalOperations,
      averageLatency,
      throughput: totalOperations / (duration / 1000),
      results
    };
  }

  // Vector Test Utilities
  generateTestVectorWithNoise(baseVector, noiseLevel = 0.1) {
    return baseVector.map(val => {
      const noise = (this.generator.rng() - 0.5) * 2 * noiseLevel;
      return Math.max(-1, Math.min(1, val + noise));
    });
  }

  calculateVectorSimilarity(vector1, vector2, method = 'cosine') {
    if (vector1.length !== vector2.length) {
      throw new Error('Vector dimensions must match');
    }

    switch (method) {
      case 'cosine':
        const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
        const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
        const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitude1 * magnitude2);
        
      case 'euclidean':
        const distance = Math.sqrt(vector1.reduce((sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0));
        return 1 / (1 + distance); // Convert distance to similarity
        
      case 'manhattan':
        const manhattanDistance = vector1.reduce((sum, val, i) => sum + Math.abs(val - vector2[i]), 0);
        return 1 / (1 + manhattanDistance);
        
      default:
        throw new Error(`Unknown similarity method: ${method}`);
    }
  }

  // API Test Utilities
  async makeTestRequest(endpoint, method = 'GET', data = null, headers = {}) {
    const url = `http://localhost:5001${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      
      let responseData = null;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }

      return {
        status: response.status,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        responseTime
      };
    } catch (error) {
      return {
        status: 0,
        ok: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  // Security Test Utilities
  generateMaliciousInputs() {
    return {
      sqlInjection: [
        "'; DROP TABLE farms; --",
        "1' OR '1'='1",
        "admin'--",
        "'; INSERT INTO farms VALUES ('hacked'); --"
      ],
      xss: [
        "<script>alert('xss')</script>",
        "javascript:alert('xss')",
        "<img src='x' onerror='alert(1)'>",
        "';!--\"<XSS>=&{()}"
      ],
      pathTraversal: [
        "../../../etc/passwd",
        "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
        "....//....//....//etc/passwd"
      ],
      oversizedData: {
        longString: 'A'.repeat(100000),
        massiveArray: new Array(10000).fill('data'),
        deepObject: this.createDeepObject(1000)
      }
    };
  }

  createDeepObject(depth) {
    let obj = { value: 'deep' };
    for (let i = 0; i < depth; i++) {
      obj = { nested: obj };
    }
    return obj;
  }

  // Error Simulation
  simulateNetworkConditions(condition) {
    const conditions = {
      slow: { delay: 1000, timeout: 5000 },
      unstable: { delay: () => Math.random() * 2000, dropRate: 0.1 },
      offline: { reject: true },
      timeout: { delay: 10000 }
    };
    
    return conditions[condition] || conditions.slow;
  }

  // Validation Utilities
  validateTestDataIntegrity(testData) {
    const issues = [];

    // Check for hardcoded values
    const dataStr = JSON.stringify(testData);
    if (dataStr.includes('+1234567890')) issues.push('Hardcoded phone number detected');
    if (dataStr.includes('farm_123')) issues.push('Hardcoded farm ID detected');
    if (dataStr.includes('37.5') && dataStr.includes('-120.5')) issues.push('Hardcoded coordinates detected');

    // Check data realism
    testData.farms?.forEach(farm => {
      if (farm.total_acres < 10 || farm.total_acres > 10000) {
        issues.push(`Unrealistic farm size: ${farm.total_acres} acres`);
      }
    });

    testData.weatherPatterns?.forEach(weather => {
      if (weather.temperature < -50 || weather.temperature > 60) {
        issues.push(`Unrealistic temperature: ${weather.temperature}°C`);
      }
      if (weather.wind_speed < 0 || weather.wind_speed > 50) {
        issues.push(`Unrealistic wind speed: ${weather.wind_speed} m/s`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

module.exports = TestSetup;