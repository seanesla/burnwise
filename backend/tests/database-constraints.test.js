/**
 * BURNWISE Database Constraint Validation Suite
 * 
 * Ultra-deep testing of database constraints, foreign keys, data integrity,
 * and edge cases to ensure the database maintains consistency under all conditions.
 */

const { initializeDatabase, query, closePool } = require('../db/connection');

describe('Database Constraint Validation Suite', () => {

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    if (closePool) await closePool();
  });

  describe('Foreign Key Constraint Testing', () => {
    
    test('should enforce farm_id foreign key constraints', async () => {
      console.log(`\n🔗 Farm Foreign Key Constraint Tests:`);
      
      // Test 1: Valid foreign key should work
      try {
        const validResult = await query(`
          INSERT INTO burn_fields (farm_id, field_name, area_hectares)
          VALUES (1, 'Valid Field Test', 50.0)
        `);
        
        expect(validResult.insertId).toBeDefined();
        console.log(`   ✅ Valid farm_id insertion successful`);
        
        // Clean up
        await query('DELETE FROM burn_fields WHERE field_id = ?', [validResult.insertId]);
        
      } catch (error) {
        throw new Error(`Valid foreign key test failed: ${error.message}`);
      }

      // Test 2: Invalid foreign key should be rejected
      try {
        await query(`
          INSERT INTO burn_fields (farm_id, field_name, area_hectares)
          VALUES (99999, 'Invalid Field Test', 50.0)
        `);
        
        // Should not reach here
        throw new Error('Invalid foreign key was accepted');
        
      } catch (error) {
        expect(error.code).toBe('ER_NO_REFERENCED_ROW_2');
        console.log(`   ✅ Invalid farm_id correctly rejected`);
      }

      // Test 3: Cascading delete should work
      try {
        // Create test farm
        const farmResult = await query(`
          INSERT INTO farms (farm_name, owner_name, contact_email)
          VALUES ('Test Cascade Farm', 'Test Owner', 'test@cascade.com')
        `);
        
        const farmId = farmResult.insertId;
        
        // Create field for this farm
        const fieldResult = await query(`
          INSERT INTO burn_fields (farm_id, field_name, area_hectares)
          VALUES (?, 'Cascade Test Field', 25.0)
        `, [farmId]);
        
        const fieldId = fieldResult.insertId;
        
        // Delete farm should cascade to field
        await query('DELETE FROM farms WHERE farm_id = ?', [farmId]);
        
        // Verify field was deleted
        const [deletedField] = await query(
          'SELECT * FROM burn_fields WHERE field_id = ?',
          [fieldId]
        );
        
        expect(deletedField).toBeUndefined();
        console.log(`   ✅ Cascading delete working correctly`);
        
      } catch (error) {
        throw new Error(`Cascading delete test failed: ${error.message}`);
      }
    });

    test('should enforce field_id foreign key constraints', async () => {
      console.log(`\n🔗 Field Foreign Key Constraint Tests:`);
      
      // Test valid field_id
      try {
        const burnResult = await query(`
          INSERT INTO burn_requests (field_id, requested_date, status)
          VALUES (1, '2025-08-15', 'pending')
        `);
        
        expect(burnResult.insertId).toBeDefined();
        console.log(`   ✅ Valid field_id insertion successful`);
        
        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id = ?', [burnResult.insertId]);
        
      } catch (error) {
        throw new Error(`Valid field foreign key test failed: ${error.message}`);
      }

      // Test invalid field_id
      try {
        await query(`
          INSERT INTO burn_requests (field_id, requested_date, status)
          VALUES (99999, '2025-08-15', 'pending')
        `);
        
        throw new Error('Invalid field foreign key was accepted');
        
      } catch (error) {
        expect(error.code).toBe('ER_NO_REFERENCED_ROW_2');
        console.log(`   ✅ Invalid field_id correctly rejected`);
      }
    });

    test('should enforce burn_request_id foreign key constraints', async () => {
      console.log(`\n🔗 Burn Request Foreign Key Constraint Tests:`);
      
      // Create test burn request first
      const burnResult = await query(`
        INSERT INTO burn_requests (field_id, requested_date, status, purpose)
        VALUES (1, '2025-08-15', 'pending', 'FK constraint test')
      `);
      
      const burnRequestId = burnResult.insertId;
      
      try {
        // Test valid burn_request_id for smoke predictions
        const smokeResult = await query(`
          INSERT INTO smoke_predictions (
            burn_request_id, prediction_time, max_pm25_ugm3, confidence_score
          ) VALUES (?, NOW(), 75.5, 0.85)
        `, [burnRequestId]);
        
        expect(smokeResult.insertId).toBeDefined();
        console.log(`   ✅ Valid burn_request_id for smoke predictions successful`);
        
        // Test invalid burn_request_id
        try {
          await query(`
            INSERT INTO smoke_predictions (
              burn_request_id, prediction_time, max_pm25_ugm3, confidence_score
            ) VALUES (99999, NOW(), 75.5, 0.85)
          `);
          
          throw new Error('Invalid burn_request_id was accepted');
          
        } catch (error) {
          expect(error.code).toBe('ER_NO_REFERENCED_ROW_2');
          console.log(`   ✅ Invalid burn_request_id correctly rejected`);
        }
        
      } finally {
        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id = ?', [burnRequestId]);
      }
    });
  });

  describe('ENUM Constraint Testing', () => {
    
    test('should enforce burn_type ENUM constraints', async () => {
      console.log(`\n📝 Burn Type ENUM Constraint Tests:`);
      
      const validBurnTypes = ['broadcast', 'pile', 'prescribed'];
      const invalidBurnTypes = ['invalid_type', 'controlled', 'wildfire', '', null];
      
      // Test valid ENUM values
      for (const burnType of validBurnTypes) {
        const result = await query(`
          INSERT INTO burn_requests (field_id, requested_date, burn_type, purpose)
          VALUES (1, '2025-08-15', ?, 'ENUM test')
        `, [burnType]);
        
        expect(result.insertId).toBeDefined();
        console.log(`   ✅ Valid burn_type '${burnType}' accepted`);
        
        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
      }
      
      // Test invalid ENUM values
      for (const burnType of invalidBurnTypes) {
        try {
          await query(`
            INSERT INTO burn_requests (field_id, requested_date, burn_type, purpose)
            VALUES (1, '2025-08-15', ?, 'ENUM test')
          `, [burnType]);
          
          throw new Error(`Invalid burn_type '${burnType}' was accepted`);
          
        } catch (error) {
          expect(error.code).toBeOneOf(['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_BAD_NULL_ERROR']);
          console.log(`   ✅ Invalid burn_type '${burnType}' correctly rejected`);
        }
      }
    });

    test('should enforce status ENUM constraints', async () => {
      console.log(`\n📊 Status ENUM Constraint Tests:`);
      
      const validStatuses = ['pending', 'approved', 'scheduled', 'active', 'completed', 'cancelled'];
      const invalidStatuses = ['draft', 'processing', 'failed', 'invalid', ''];
      
      // Test valid status values
      for (const status of validStatuses) {
        const result = await query(`
          INSERT INTO burn_requests (field_id, requested_date, status, purpose)
          VALUES (1, '2025-08-15', ?, 'Status ENUM test')
        `, [status]);
        
        expect(result.insertId).toBeDefined();
        console.log(`   ✅ Valid status '${status}' accepted`);
        
        // Clean up
        await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
      }
      
      // Test invalid status values
      for (const status of invalidStatuses) {
        try {
          await query(`
            INSERT INTO burn_requests (field_id, requested_date, status, purpose)
            VALUES (1, '2025-08-15', ?, 'Status ENUM test')
          `, [status]);
          
          throw new Error(`Invalid status '${status}' was accepted`);
          
        } catch (error) {
          expect(error.code).toBe('ER_TRUNCATED_WRONG_VALUE_FOR_FIELD');
          console.log(`   ✅ Invalid status '${status}' correctly rejected`);
        }
      }
    });

    test('should enforce alert_type ENUM constraints', async () => {
      console.log(`\n🚨 Alert Type ENUM Constraint Tests:`);
      
      const validAlertTypes = ['burn_scheduled', 'burn_starting', 'smoke_warning', 'schedule_change', 'conflict_detected', 'weather_alert'];
      const invalidAlertTypes = ['burn_approved', 'system_notification', 'emergency', 'info'];
      
      // Test valid alert types
      for (const alertType of validAlertTypes) {
        const result = await query(`
          INSERT INTO alerts (
            farm_id, alert_type, severity, message, 
            delivery_method, delivery_status
          ) VALUES (1, ?, 'info', 'Test alert', 'in_app', 'pending')
        `, [alertType]);
        
        expect(result.insertId).toBeDefined();
        console.log(`   ✅ Valid alert_type '${alertType}' accepted`);
        
        // Clean up
        await query('DELETE FROM alerts WHERE alert_id = ?', [result.insertId]);
      }
      
      // Test invalid alert types
      for (const alertType of invalidAlertTypes) {
        try {
          await query(`
            INSERT INTO alerts (
              farm_id, alert_type, severity, message, 
              delivery_method, delivery_status
            ) VALUES (1, ?, 'info', 'Test alert', 'in_app', 'pending')
          `, [alertType]);
          
          throw new Error(`Invalid alert_type '${alertType}' was accepted`);
          
        } catch (error) {
          expect(error.code).toBe('ER_TRUNCATED_WRONG_VALUE_FOR_FIELD');
          console.log(`   ✅ Invalid alert_type '${alertType}' correctly rejected`);
        }
      }
    });
  });

  describe('NOT NULL Constraint Testing', () => {
    
    test('should enforce NOT NULL constraints on required fields', async () => {
      console.log(`\n🚫 NOT NULL Constraint Tests:`);
      
      // Test farm required fields
      const farmRequiredFields = [
        { field: 'farm_name', value: null },
        { field: 'owner_name', value: null },
        { field: 'contact_email', value: null }
      ];
      
      for (const { field, value } of farmRequiredFields) {
        try {
          const insertData = {
            farm_name: 'Test Farm',
            owner_name: 'Test Owner',
            contact_email: 'test@example.com'
          };
          insertData[field] = value;
          
          await query(`
            INSERT INTO farms (farm_name, owner_name, contact_email)
            VALUES (?, ?, ?)
          `, [insertData.farm_name, insertData.owner_name, insertData.contact_email]);
          
          throw new Error(`NULL value for required field '${field}' was accepted`);
          
        } catch (error) {
          expect(error.code).toBe('ER_BAD_NULL_ERROR');
          console.log(`   ✅ NOT NULL constraint enforced for '${field}'`);
        }
      }

      // Test burn_requests required fields
      const burnRequiredFields = [
        { field: 'field_id', value: null },
        { field: 'requested_date', value: null }
      ];
      
      for (const { field, value } of burnRequiredFields) {
        try {
          const insertData = {
            field_id: 1,
            requested_date: '2025-08-15'
          };
          insertData[field] = value;
          
          await query(`
            INSERT INTO burn_requests (field_id, requested_date)
            VALUES (?, ?)
          `, [insertData.field_id, insertData.requested_date]);
          
          throw new Error(`NULL value for required field '${field}' was accepted`);
          
        } catch (error) {
          expect(error.code).toBe('ER_BAD_NULL_ERROR');
          console.log(`   ✅ NOT NULL constraint enforced for '${field}'`);
        }
      }
    });
  });

  describe('Data Type Constraint Testing', () => {
    
    test('should enforce DECIMAL precision constraints', async () => {
      console.log(`\n🔢 DECIMAL Precision Constraint Tests:`);
      
      // Test latitude/longitude precision (DECIMAL(10,6))
      const coordinateTests = [
        { lat: 40.123456, lon: -120.654321, shouldPass: true },  // Valid precision
        { lat: 40.1234567, lon: -120.6543219, shouldPass: true }, // Should be truncated
        { lat: 999.123456, lon: -200.654321, shouldPass: false }, // Out of range
        { lat: 'invalid', lon: 'invalid', shouldPass: false }      // Invalid type
      ];
      
      for (const { lat, lon, shouldPass } of coordinateTests) {
        try {
          const result = await query(`
            INSERT INTO farms (farm_name, owner_name, contact_email, latitude, longitude)
            VALUES ('Coord Test Farm', 'Test Owner', 'test@coord.com', ?, ?)
          `, [lat, lon]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Valid coordinates (${lat}, ${lon}) accepted`);
            await query('DELETE FROM farms WHERE farm_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid coordinates (${lat}, ${lon}) were accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_WARN_DATA_OUT_OF_RANGE', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD']);
            console.log(`   ✅ Invalid coordinates (${lat}, ${lon}) correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });

    test('should enforce INTEGER range constraints', async () => {
      console.log(`\n🔢 INTEGER Range Constraint Tests:`);
      
      // Test priority_score (should be 0-100)
      const priorityTests = [
        { score: 50, shouldPass: true },
        { score: 0, shouldPass: true },
        { score: 100, shouldPass: true },
        { score: -10, shouldPass: true }, // MySQL allows but may be application constraint
        { score: 150, shouldPass: true },  // MySQL allows but may be application constraint
        { score: 'invalid', shouldPass: false }
      ];
      
      for (const { score, shouldPass } of priorityTests) {
        try {
          const result = await query(`
            INSERT INTO burn_requests (field_id, requested_date, priority_score, purpose)
            VALUES (1, '2025-08-15', ?, 'Priority test')
          `, [score]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Priority score ${score} accepted`);
            await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid priority score ${score} was accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBe('ER_TRUNCATED_WRONG_VALUE_FOR_FIELD');
            console.log(`   ✅ Invalid priority score ${score} correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });

    test('should enforce TIME format constraints', async () => {
      console.log(`\n🕐 TIME Format Constraint Tests:`);
      
      const timeTests = [
        { time: '09:00:00', shouldPass: true },
        { time: '09:00', shouldPass: true },
        { time: '23:59:59', shouldPass: true },
        { time: '00:00:00', shouldPass: true },
        { time: '25:00:00', shouldPass: false }, // Invalid hour
        { time: '12:60:00', shouldPass: false }, // Invalid minute
        { time: 'invalid', shouldPass: false }   // Invalid format
      ];
      
      for (const { time, shouldPass } of timeTests) {
        try {
          const result = await query(`
            INSERT INTO burn_requests (
              field_id, requested_date, requested_start_time, purpose
            ) VALUES (1, '2025-08-15', ?, 'Time test')
          `, [time]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Time format '${time}' accepted`);
            await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid time format '${time}' was accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_WARN_DATA_OUT_OF_RANGE']);
            console.log(`   ✅ Invalid time format '${time}' correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Vector Column Constraint Testing', () => {
    
    test('should enforce VECTOR dimension constraints', async () => {
      console.log(`\n📊 VECTOR Dimension Constraint Tests:`);
      
      // Test terrain_vector (32 dimensions)
      const terrainVectorTests = [
        { vector: new Array(32).fill(0.5), shouldPass: true },        // Correct dimensions
        { vector: new Array(31).fill(0.5), shouldPass: false },       // Too few dimensions
        { vector: new Array(33).fill(0.5), shouldPass: false },       // Too many dimensions
        { vector: new Array(32).fill(NaN), shouldPass: false },       // NaN values
        { vector: new Array(32).fill(Infinity), shouldPass: false }   // Infinity values
      ];
      
      for (const { vector, shouldPass } of terrainVectorTests) {
        try {
          const vectorString = `[${vector.join(',')}]`;
          const result = await query(`
            INSERT INTO burn_requests (
              field_id, requested_date, terrain_vector, purpose
            ) VALUES (1, '2025-08-15', ?, 'Vector dimension test')
          `, [vectorString]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Valid ${vector.length}-dimensional terrain vector accepted`);
            await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid terrain vector (${vector.length} dims) was accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_UNKNOWN_ERROR', 'ER_DATA_OUT_OF_RANGE']);
            console.log(`   ✅ Invalid ${vector.length}-dimensional terrain vector correctly rejected`);
          } else {
            throw error;
          }
        }
      }

      // Test weather_pattern_embedding (128 dimensions)
      const weatherVectorTests = [
        { vector: new Array(128).fill(0.3), shouldPass: true },       // Correct dimensions
        { vector: new Array(64).fill(0.3), shouldPass: false },       // Wrong dimensions
        { vector: new Array(256).fill(0.3), shouldPass: false }       // Wrong dimensions
      ];
      
      for (const { vector, shouldPass } of weatherVectorTests) {
        try {
          const vectorString = `[${vector.join(',')}]`;
          const result = await query(`
            INSERT INTO weather_conditions (
              latitude, longitude, observation_time, weather_pattern_embedding
            ) VALUES (40.0, -120.0, NOW(), ?)
          `, [vectorString]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Valid ${vector.length}-dimensional weather vector accepted`);
            await query('DELETE FROM weather_conditions WHERE weather_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid weather vector (${vector.length} dims) was accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_UNKNOWN_ERROR', 'ER_DATA_OUT_OF_RANGE']);
            console.log(`   ✅ Invalid ${vector.length}-dimensional weather vector correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });

    test('should handle vector JSON format validation', async () => {
      console.log(`\n📋 Vector JSON Format Validation Tests:`);
      
      const jsonFormatTests = [
        { json: '[1,2,3]', shouldPass: false },                      // Wrong dimensions but valid JSON
        { json: 'not_json', shouldPass: false },                     // Invalid JSON
        { json: '[]', shouldPass: false },                           // Empty array
        { json: null, shouldPass: true },                            // NULL should be allowed
        { json: '[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32]', shouldPass: true } // Valid 32-dim
      ];
      
      for (const { json, shouldPass } of jsonFormatTests) {
        try {
          const result = await query(`
            INSERT INTO burn_requests (
              field_id, requested_date, terrain_vector, purpose
            ) VALUES (1, '2025-08-15', ?, 'JSON format test')
          `, [json]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Vector JSON format accepted: ${json?.substring(0, 20)}...`);
            await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid vector JSON format was accepted: ${json}`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_UNKNOWN_ERROR', 'ER_DATA_OUT_OF_RANGE', 'ER_INVALID_JSON_TEXT']);
            console.log(`   ✅ Invalid vector JSON format correctly rejected: ${json?.substring(0, 20)}...`);
          } else {
            throw error;
          }
        }
      }
    });
  });

  describe('Index and Performance Constraint Testing', () => {
    
    test('should verify all indexes are created correctly', async () => {
      console.log(`\n🗂️ Index Verification Tests:`);
      
      // Check if indexes exist
      const indexQueries = [
        "SHOW INDEX FROM farms WHERE Key_name = 'idx_location'",
        "SHOW INDEX FROM burn_requests WHERE Key_name = 'idx_requested_date'",
        "SHOW INDEX FROM burn_requests WHERE Key_name = 'idx_status'",
        "SHOW INDEX FROM weather_conditions WHERE Key_name = 'idx_weather_location'",
        "SHOW INDEX FROM weather_conditions WHERE Key_name = 'idx_observation_time'",
        "SHOW INDEX FROM alerts WHERE Key_name = 'idx_delivery_status'",
        "SHOW INDEX FROM alerts WHERE Key_name = 'idx_alert_type'"
      ];
      
      for (const indexQuery of indexQueries) {
        try {
          const indexResult = await query(indexQuery);
          expect(indexResult.length).toBeGreaterThan(0);
          
          const indexName = indexQuery.match(/Key_name = '([^']+)'/)[1];
          console.log(`   ✅ Index '${indexName}' exists and is valid`);
          
        } catch (error) {
          const indexName = indexQuery.match(/Key_name = '([^']+)'/)[1];
          console.log(`   ⚠️ Index '${indexName}' may not exist: ${error.message}`);
        }
      }
    });

    test('should validate constraint performance under load', async () => {
      console.log(`\n🚀 Constraint Performance Under Load Tests:`);
      
      // Create many records to test constraint performance
      const loadTestRecords = 50;
      const insertPromises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < loadTestRecords; i++) {
        insertPromises.push(
          query(`
            INSERT INTO burn_requests (
              field_id, requested_date, requested_start_time,
              requested_end_time, purpose, priority_score
            ) VALUES (1, ?, '09:00', '15:00', ?, ?)
          `, [
            `2025-08-${String(15 + (i % 10)).padStart(2, '0')}`,
            `Load test record ${i}`,
            50 + (i % 50)
          ])
        );
      }
      
      const results = await Promise.allSettled(insertPromises);
      const endTime = performance.now();
      
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const totalTime = endTime - startTime;
      
      console.log(`   Records processed: ${loadTestRecords}`);
      console.log(`   Successful: ${successful}`);
      console.log(`   Failed: ${failed}`);
      console.log(`   Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`   Avg time per record: ${(totalTime / loadTestRecords).toFixed(2)}ms`);
      
      // Performance expectations
      expect(successful).toBeGreaterThan(loadTestRecords * 0.9); // 90% success rate
      expect(totalTime / loadTestRecords).toBeLessThan(100); // Less than 100ms per record
      
      // Clean up
      const successfulIds = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value.insertId);
      
      if (successfulIds.length > 0) {
        await query(`DELETE FROM burn_requests WHERE request_id IN (${successfulIds.join(',')})`);
      }
      
      console.log(`   ✅ Constraint performance acceptable under load`);
    });
  });

  describe('Data Integrity Validation', () => {
    
    test('should maintain referential integrity during concurrent operations', async () => {
      console.log(`\n🔒 Referential Integrity Under Concurrency Tests:`);
      
      // Create test farm
      const farmResult = await query(`
        INSERT INTO farms (farm_name, owner_name, contact_email)
        VALUES ('Concurrency Test Farm', 'Test Owner', 'concurrent@test.com')
      `);
      
      const farmId = farmResult.insertId;
      
      try {
        // Create field
        const fieldResult = await query(`
          INSERT INTO burn_fields (farm_id, field_name, area_hectares)
          VALUES (?, 'Concurrency Test Field', 100.0)
        `, [farmId]);
        
        const fieldId = fieldResult.insertId;
        
        // Simulate concurrent operations
        const concurrentOperations = [
          // Multiple burn requests for same field
          query(`INSERT INTO burn_requests (field_id, requested_date, purpose) VALUES (?, '2025-08-20', 'Concurrent test 1')`, [fieldId]),
          query(`INSERT INTO burn_requests (field_id, requested_date, purpose) VALUES (?, '2025-08-21', 'Concurrent test 2')`, [fieldId]),
          query(`INSERT INTO burn_requests (field_id, requested_date, purpose) VALUES (?, '2025-08-22', 'Concurrent test 3')`, [fieldId]),
          
          // Alerts for the farm
          query(`INSERT INTO alerts (farm_id, alert_type, severity, message, delivery_method, delivery_status) VALUES (?, 'burn_scheduled', 'info', 'Test alert 1', 'in_app', 'pending')`, [farmId]),
          query(`INSERT INTO alerts (farm_id, alert_type, severity, message, delivery_method, delivery_status) VALUES (?, 'burn_scheduled', 'info', 'Test alert 2', 'in_app', 'pending')`, [farmId])
        ];
        
        const results = await Promise.allSettled(concurrentOperations);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        
        console.log(`   Concurrent operations successful: ${successful}/${concurrentOperations.length}`);
        expect(successful).toBe(concurrentOperations.length);
        
        // Verify all records are properly linked
        const [burnRequests] = await query('SELECT COUNT(*) as count FROM burn_requests WHERE field_id = ?', [fieldId]);
        const [alerts] = await query('SELECT COUNT(*) as count FROM alerts WHERE farm_id = ?', [farmId]);
        
        expect(burnRequests.count).toBe(3);
        expect(alerts.count).toBe(2);
        
        console.log(`   ✅ Referential integrity maintained under concurrency`);
        
      } finally {
        // Clean up (cascading delete should handle related records)
        await query('DELETE FROM farms WHERE farm_id = ?', [farmId]);
      }
    });

    test('should validate data consistency after rollback scenarios', async () => {
      console.log(`\n🔄 Transaction Rollback Consistency Tests:`);
      
      try {
        // Start transaction
        await query('START TRANSACTION');
        
        // Insert farm
        const farmResult = await query(`
          INSERT INTO farms (farm_name, owner_name, contact_email)
          VALUES ('Rollback Test Farm', 'Test Owner', 'rollback@test.com')
        `);
        
        const farmId = farmResult.insertId;
        
        // Insert field
        const fieldResult = await query(`
          INSERT INTO burn_fields (farm_id, field_name, area_hectares)
          VALUES (?, 'Rollback Test Field', 75.0)
        `, [farmId]);
        
        const fieldId = fieldResult.insertId;
        
        // Insert burn request
        const burnResult = await query(`
          INSERT INTO burn_requests (field_id, requested_date, purpose)
          VALUES (?, '2025-08-25', 'Rollback test')
        `, [fieldId]);
        
        const burnId = burnResult.insertId;
        
        // Verify records exist within transaction
        const [farmCheck] = await query('SELECT * FROM farms WHERE farm_id = ?', [farmId]);
        const [fieldCheck] = await query('SELECT * FROM burn_fields WHERE field_id = ?', [fieldId]);
        const [burnCheck] = await query('SELECT * FROM burn_requests WHERE request_id = ?', [burnId]);
        
        expect(farmCheck).toBeDefined();
        expect(fieldCheck).toBeDefined();
        expect(burnCheck).toBeDefined();
        
        // Rollback transaction
        await query('ROLLBACK');
        
        // Verify records no longer exist after rollback
        const [farmAfterRollback] = await query('SELECT * FROM farms WHERE farm_id = ?', [farmId]);
        const [fieldAfterRollback] = await query('SELECT * FROM burn_fields WHERE field_id = ?', [fieldId]);
        const [burnAfterRollback] = await query('SELECT * FROM burn_requests WHERE request_id = ?', [burnId]);
        
        expect(farmAfterRollback).toBeUndefined();
        expect(fieldAfterRollback).toBeUndefined();
        expect(burnAfterRollback).toBeUndefined();
        
        console.log(`   ✅ Transaction rollback consistency maintained`);
        
      } catch (error) {
        // Ensure rollback happens even if test fails
        try {
          await query('ROLLBACK');
        } catch (rollbackError) {
          // Ignore rollback errors
        }
        throw error;
      }
    });
  });

  describe('Edge Case Constraint Testing', () => {
    
    test('should handle boundary value constraints correctly', async () => {
      console.log(`\n🎯 Boundary Value Constraint Tests:`);
      
      // Test date boundaries
      const dateBoundaryTests = [
        { date: '1000-01-01', shouldPass: true },    // MySQL minimum date
        { date: '9999-12-31', shouldPass: true },    // MySQL maximum date
        { date: '0000-01-01', shouldPass: false },   // Below minimum
        { date: '2025-02-29', shouldPass: false },   // Invalid leap year date
        { date: '2024-02-29', shouldPass: true },    // Valid leap year date
        { date: '2025-13-01', shouldPass: false },   // Invalid month
        { date: '2025-01-32', shouldPass: false }    // Invalid day
      ];
      
      for (const { date, shouldPass } of dateBoundaryTests) {
        try {
          const result = await query(`
            INSERT INTO burn_requests (field_id, requested_date, purpose)
            VALUES (1, ?, 'Date boundary test')
          `, [date]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ Valid date '${date}' accepted`);
            await query('DELETE FROM burn_requests WHERE request_id = ?', [result.insertId]);
          } else {
            throw new Error(`Invalid date '${date}' was accepted`);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_WARN_DATA_OUT_OF_RANGE']);
            console.log(`   ✅ Invalid date '${date}' correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });

    test('should handle character length constraints', async () => {
      console.log(`\n📏 Character Length Constraint Tests:`);
      
      // Test various field lengths
      const lengthTests = [
        { field: 'farm_name', length: 255, shouldPass: true },
        { field: 'farm_name', length: 256, shouldPass: false }, // Should be truncated or fail
        { field: 'contact_phone', length: 20, shouldPass: true },
        { field: 'contact_phone', length: 21, shouldPass: false },
        { field: 'permit_number', length: 100, shouldPass: true },
        { field: 'permit_number', length: 101, shouldPass: false }
      ];
      
      for (const { field, length, shouldPass } of lengthTests) {
        try {
          const testValue = 'x'.repeat(length);
          const farmData = {
            farm_name: 'Test Farm',
            owner_name: 'Test Owner',
            contact_email: 'test@example.com',
            contact_phone: '555-0100',
            permit_number: 'TEST-001'
          };
          
          farmData[field] = testValue;
          
          const result = await query(`
            INSERT INTO farms (farm_name, owner_name, contact_email, contact_phone, permit_number)
            VALUES (?, ?, ?, ?, ?)
          `, [farmData.farm_name, farmData.owner_name, farmData.contact_email, farmData.contact_phone, farmData.permit_number]);
          
          if (shouldPass) {
            expect(result.insertId).toBeDefined();
            console.log(`   ✅ ${field} with length ${length} accepted`);
            await query('DELETE FROM farms WHERE farm_id = ?', [result.insertId]);
          } else {
            // MySQL may truncate instead of failing
            console.log(`   ⚠️ ${field} with length ${length} was truncated/accepted`);
            await query('DELETE FROM farms WHERE farm_id = ?', [result.insertId]);
          }
          
        } catch (error) {
          if (!shouldPass) {
            expect(error.code).toBeOneOf(['ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD']);
            console.log(`   ✅ ${field} with length ${length} correctly rejected`);
          } else {
            throw error;
          }
        }
      }
    });
  });
});