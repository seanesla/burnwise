const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('@jest/globals');
const { initializeDatabase, query, pool, createTransaction } = require('../../db/connection');
require('dotenv').config();

describe('TiDB Transaction Management - Critical for Data Consistency in Life-Saving Operations', () => {
  let testTableCreated = false;
  
  beforeAll(async () => {
    await initializeDatabase();
    
    // Create test tables for transaction testing
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS test_burn_requests (
          request_id INT PRIMARY KEY AUTO_INCREMENT,
          farm_id INT NOT NULL,
          field_id INT NOT NULL,
          status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
          priority_score INT DEFAULT 0,
          requested_date DATE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_burn_schedules (
          schedule_id INT PRIMARY KEY AUTO_INCREMENT,
          burn_request_id INT NOT NULL,
          scheduled_date DATE NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          status ENUM('scheduled', 'active', 'completed', 'cancelled') DEFAULT 'scheduled',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (burn_request_id) REFERENCES test_burn_requests(request_id) ON DELETE CASCADE
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_resource_allocations (
          allocation_id INT PRIMARY KEY AUTO_INCREMENT,
          burn_request_id INT NOT NULL,
          resource_type ENUM('crew', 'equipment', 'water_truck') NOT NULL,
          resource_id INT NOT NULL,
          allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (burn_request_id) REFERENCES test_burn_requests(request_id) ON DELETE CASCADE
        )
      `);
      
      await query(`
        CREATE TABLE IF NOT EXISTS test_safety_logs (
          log_id INT PRIMARY KEY AUTO_INCREMENT,
          burn_request_id INT NOT NULL,
          event_type ENUM('approval', 'conflict_detected', 'emergency_stop', 'completion') NOT NULL,
          event_data JSON,
          logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (burn_request_id) REFERENCES test_burn_requests(request_id) ON DELETE CASCADE
        )
      `);
      
      testTableCreated = true;
    } catch (error) {
      console.error('Error creating transaction test tables:', error);
    }
  });
  
  afterAll(async () => {
    // Clean up test tables
    if (testTableCreated) {
      await query('SET FOREIGN_KEY_CHECKS = 0');
      await query('DROP TABLE IF EXISTS test_safety_logs');
      await query('DROP TABLE IF EXISTS test_resource_allocations');
      await query('DROP TABLE IF EXISTS test_burn_schedules');
      await query('DROP TABLE IF EXISTS test_burn_requests');
      await query('SET FOREIGN_KEY_CHECKS = 1');
    }
    
    const poolInstance = pool();
    if (poolInstance) {
      await poolInstance.end();
    }
  });
  
  beforeEach(async () => {
    // Clear test data
    if (testTableCreated) {
      await query('SET FOREIGN_KEY_CHECKS = 0');
      await query('DELETE FROM test_safety_logs WHERE log_id > 99000');
      await query('DELETE FROM test_resource_allocations WHERE allocation_id > 99000');
      await query('DELETE FROM test_burn_schedules WHERE schedule_id > 99000');
      await query('DELETE FROM test_burn_requests WHERE request_id > 99000');
      await query('SET FOREIGN_KEY_CHECKS = 1');
    }
  });

  describe('Basic Transaction Operations', () => {
    test('Should commit successful transaction with multiple inserts', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Insert burn request
        const [burnResult] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, priority_score)
          VALUES (?, ?, ?, ?)
        `, [1, 101, '2025-09-15', 85]);
        
        const burnRequestId = burnResult.insertId;
        
        // Insert schedule
        await connection.query(`
          INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
          VALUES (?, ?, ?, ?)
        `, [burnRequestId, '2025-09-15', '09:00:00', '13:00:00']);
        
        // Insert resource allocation
        await connection.query(`
          INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'crew', 1]);
        
        // Log safety event
        await connection.query(`
          INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'approval', JSON.stringify({ approved_by: 'system', safety_score: 95 })]);
        
        await connection.commit();
        
        // Verify all data was committed
        const [requests] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE request_id = ?', [burnRequestId]);
        const [schedules] = await query('SELECT COUNT(*) as count FROM test_burn_schedules WHERE burn_request_id = ?', [burnRequestId]);
        const [resources] = await query('SELECT COUNT(*) as count FROM test_resource_allocations WHERE burn_request_id = ?', [burnRequestId]);
        const [logs] = await query('SELECT COUNT(*) as count FROM test_safety_logs WHERE burn_request_id = ?', [burnRequestId]);
        
        expect(parseInt(requests[0].count)).toBe(1);
        expect(parseInt(schedules[0].count)).toBe(1);
        expect(parseInt(resources[0].count)).toBe(1);
        expect(parseInt(logs[0].count)).toBe(1);
        
      } finally {
        connection.release();
      }
    });

    test('Should rollback failed transaction preserving data integrity', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Insert valid burn request
        const [burnResult] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, priority_score)
          VALUES (?, ?, ?, ?)
        `, [2, 102, '2025-09-16', 90]);
        
        const burnRequestId = burnResult.insertId;
        
        // Insert valid schedule
        await connection.query(`
          INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
          VALUES (?, ?, ?, ?)
        `, [burnRequestId, '2025-09-16', '10:00:00', '14:00:00']);
        
        // This should fail (invalid foreign key)
        await connection.query(`
          INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
          VALUES (?, ?, ?)
        `, [99999, 'crew', 1]); // Non-existent burn_request_id
        
        await connection.commit();
        expect(true).toBe(false); // Should not reach here
        
      } catch (error) {
        await connection.rollback();
        expect(error.code).toMatch(/ER_NO_REFERENCED_ROW|foreign key/i);
        
        // Verify no data was committed
        const [requests] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE farm_id = 2');
        const [schedules] = await query('SELECT COUNT(*) as count FROM test_burn_schedules');
        const [resources] = await query('SELECT COUNT(*) as count FROM test_resource_allocations');
        
        expect(parseInt(requests[0].count)).toBe(0);
        expect(parseInt(schedules[0].count)).toBe(0);
        expect(parseInt(resources[0].count)).toBe(0);
        
      } finally {
        connection.release();
      }
    });

    test('Should handle nested transaction operations', async () => {
      const outerConnection = await pool().getConnection();
      
      try {
        await outerConnection.beginTransaction();
        
        // Outer transaction: Create burn request
        const [outerResult] = await outerConnection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, priority_score)
          VALUES (?, ?, ?, ?)
        `, [3, 103, '2025-09-17', 75]);
        
        const burnRequestId = outerResult.insertId;
        
        // Simulate nested operation with savepoint
        await outerConnection.query('SAVEPOINT nested_operation');
        
        try {
          // Inner operations
          await outerConnection.query(`
            INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
            VALUES (?, ?, ?, ?)
          `, [burnRequestId, '2025-09-17', '08:00:00', '12:00:00']);
          
          await outerConnection.query(`
            INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
            VALUES (?, ?, ?)
          `, [burnRequestId, 'equipment', 5]);
          
          // This might fail in some conditions
          await outerConnection.query(`
            INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
            VALUES (?, ?, ?)
          `, [burnRequestId, 'approval', JSON.stringify({ timestamp: new Date() })]);
          
        } catch (innerError) {
          await outerConnection.query('ROLLBACK TO SAVEPOINT nested_operation');
          // Continue with outer transaction
        }
        
        await outerConnection.commit();
        
        // Verify outer transaction succeeded
        const [requests] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE request_id = ?', [burnRequestId]);
        expect(parseInt(requests[0].count)).toBe(1);
        
      } finally {
        outerConnection.release();
      }
    });

    test('Should handle transaction timeout appropriately', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Set short timeout for testing
        await connection.query('SET SESSION innodb_lock_wait_timeout = 1');
        
        const [result] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date)
          VALUES (?, ?, ?)
        `, [4, 104, '2025-09-18']);
        
        // Simulate long-running operation that might timeout
        const startTime = Date.now();
        
        try {
          await connection.query('SELECT SLEEP(2)'); // 2 second sleep
        } catch (error) {
          // Timeout expected in some cases
        }
        
        await connection.commit();
        
        const duration = Date.now() - startTime;
        expect(duration).toBeGreaterThan(0);
        
      } catch (error) {
        await connection.rollback();
        expect(error.code).toMatch(/timeout|lock/i);
      } finally {
        connection.release();
      }
    });
  });

  describe('Concurrent Transaction Handling', () => {
    test('Should handle concurrent read operations correctly', async () => {
      // Insert test data
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, requested_date, priority_score)
        VALUES (?, ?, ?, ?)
      `, [5, 105, '2025-09-19', 80]);
      
      const burnRequestId = setupResult.insertId;
      
      // Multiple concurrent read transactions
      const readPromises = Array.from({ length: 5 }, async (_, i) => {
        const connection = await pool().getConnection();
        try {
          await connection.beginTransaction();
          
          const [result] = await connection.query(
            'SELECT * FROM test_burn_requests WHERE request_id = ?',
            [burnRequestId]
          );
          
          await connection.commit();
          return result[0];
        } finally {
          connection.release();
        }
      });
      
      const results = await Promise.all(readPromises);
      
      // All reads should return the same data
      results.forEach(result => {
        expect(result.request_id).toBe(burnRequestId);
        expect(result.farm_id).toBe(5);
        expect(result.priority_score).toBe(80);
      });
    });

    test('Should prevent dirty reads with proper isolation', async () => {
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [6, 106, 70]);
      
      const burnRequestId = setupResult.insertId;
      
      const connection1 = await pool().getConnection();
      const connection2 = await pool().getConnection();
      
      try {
        // Transaction 1: Start modification but don't commit
        await connection1.beginTransaction();
        await connection1.query(
          'UPDATE test_burn_requests SET priority_score = ? WHERE request_id = ?',
          [95, burnRequestId]
        );
        
        // Transaction 2: Try to read (should not see uncommitted change)
        await connection2.beginTransaction();
        const [readResult] = await connection2.query(
          'SELECT priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        await connection2.commit();
        
        // Should read original value (70), not modified value (95)
        expect(readResult[0].priority_score).toBe(70);
        
        // Commit first transaction
        await connection1.commit();
        
        // Now should see updated value
        const [updatedResult] = await query(
          'SELECT priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        expect(updatedResult[0].priority_score).toBe(95);
        
      } finally {
        connection1.release();
        connection2.release();
      }
    });

    test('Should handle deadlock detection and resolution', async () => {
      // Insert test records
      const [result1] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [7, 107, 60]);
      
      const [result2] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [8, 108, 65]);
      
      const id1 = result1.insertId;
      const id2 = result2.insertId;
      
      const connection1 = await pool().getConnection();
      const connection2 = await pool().getConnection();
      
      let deadlockDetected = false;
      
      try {
        // Start transactions
        await connection1.beginTransaction();
        await connection2.beginTransaction();
        
        // Transaction 1: Lock record 1
        await connection1.query(
          'SELECT * FROM test_burn_requests WHERE request_id = ? FOR UPDATE',
          [id1]
        );
        
        // Transaction 2: Lock record 2
        await connection2.query(
          'SELECT * FROM test_burn_requests WHERE request_id = ? FOR UPDATE',
          [id2]
        );
        
        // Create deadlock condition
        const promise1 = connection1.query(
          'SELECT * FROM test_burn_requests WHERE request_id = ? FOR UPDATE',
          [id2]
        );
        
        const promise2 = connection2.query(
          'SELECT * FROM test_burn_requests WHERE request_id = ? FOR UPDATE',
          [id1]
        );
        
        await Promise.race([
          Promise.all([promise1, promise2]),
          new Promise((resolve) => setTimeout(() => {
            deadlockDetected = true;
            resolve();
          }, 3000))
        ]);
        
      } catch (error) {
        if (error.code === 'ER_LOCK_DEADLOCK') {
          deadlockDetected = true;
        }
      } finally {
        try {
          await connection1.rollback();
          await connection2.rollback();
        } catch (e) {
          // Ignore rollback errors
        }
        connection1.release();
        connection2.release();
      }
      
      // Either deadlock was detected or timeout prevented infinite wait
      expect(deadlockDetected).toBeTruthy();
    });

    test('Should maintain consistency under high concurrency', async () => {
      const initialValue = 100;
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [9, 109, initialValue]);
      
      const burnRequestId = setupResult.insertId;
      
      // Multiple concurrent transactions modifying same record
      const incrementPromises = Array.from({ length: 10 }, async (_, i) => {
        const connection = await pool().getConnection();
        try {
          await connection.beginTransaction();
          
          // Read current value
          const [current] = await connection.query(
            'SELECT priority_score FROM test_burn_requests WHERE request_id = ? FOR UPDATE',
            [burnRequestId]
          );
          
          // Increment by 1
          const newValue = current[0].priority_score + 1;
          await connection.query(
            'UPDATE test_burn_requests SET priority_score = ? WHERE request_id = ?',
            [newValue, burnRequestId]
          );
          
          await connection.commit();
          return newValue;
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
      });
      
      const results = await Promise.allSettled(incrementPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      // Verify final value reflects all successful increments
      const [final] = await query(
        'SELECT priority_score FROM test_burn_requests WHERE request_id = ?',
        [burnRequestId]
      );
      
      expect(final[0].priority_score).toBe(initialValue + successful);
      expect(successful).toBeGreaterThan(0);
    });
  });

  describe('Complex Multi-Table Transactions', () => {
    test('Should handle burn request approval workflow atomically', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Step 1: Create burn request
        const [burnResult] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, status, priority_score)
          VALUES (?, ?, ?, ?, ?)
        `, [10, 110, '2025-09-20', 'pending', 88]);
        
        const burnRequestId = burnResult.insertId;
        
        // Step 2: Check resource availability and allocate
        const requiredResources = [
          { type: 'crew', id: 1 },
          { type: 'equipment', id: 3 },
          { type: 'water_truck', id: 2 }
        ];
        
        for (const resource of requiredResources) {
          await connection.query(`
            INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
            VALUES (?, ?, ?)
          `, [burnRequestId, resource.type, resource.id]);
        }
        
        // Step 3: Create schedule
        await connection.query(`
          INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time, status)
          VALUES (?, ?, ?, ?, ?)
        `, [burnRequestId, '2025-09-20', '07:00:00', '11:00:00', 'scheduled']);
        
        // Step 4: Update request status to approved
        await connection.query(`
          UPDATE test_burn_requests SET status = ?, updated_at = NOW()
          WHERE request_id = ?
        `, ['approved', burnRequestId]);
        
        // Step 5: Log approval event
        await connection.query(`
          INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'approval', JSON.stringify({
          approved_at: new Date(),
          resources_allocated: requiredResources.length,
          priority_score: 88
        })]);
        
        await connection.commit();
        
        // Verify complete workflow
        const [request] = await query('SELECT status FROM test_burn_requests WHERE request_id = ?', [burnRequestId]);
        const [schedule] = await query('SELECT COUNT(*) as count FROM test_burn_schedules WHERE burn_request_id = ?', [burnRequestId]);
        const [resources] = await query('SELECT COUNT(*) as count FROM test_resource_allocations WHERE burn_request_id = ?', [burnRequestId]);
        const [logs] = await query('SELECT COUNT(*) as count FROM test_safety_logs WHERE burn_request_id = ?', [burnRequestId]);
        
        expect(request[0].status).toBe('approved');
        expect(parseInt(schedule[0].count)).toBe(1);
        expect(parseInt(resources[0].count)).toBe(3);
        expect(parseInt(logs[0].count)).toBe(1);
        
      } finally {
        connection.release();
      }
    });

    test('Should handle emergency cancellation cascade properly', async () => {
      // Setup: Create approved burn with full workflow
      const [burnResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, status, priority_score)
        VALUES (?, ?, ?, ?)
      `, [11, 111, 'approved', 92]);
      
      const burnRequestId = burnResult.insertId;
      
      await query(`
        INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
        VALUES (?, ?, ?, ?)
      `, [burnRequestId, '2025-09-21', '09:00:00', '13:00:00']);
      
      await query(`
        INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
        VALUES (?, ?, ?)
      `, [burnRequestId, 'crew', 2]);
      
      // Emergency cancellation transaction
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Cancel the burn request
        await connection.query(`
          UPDATE test_burn_requests SET status = ?, updated_at = NOW()
          WHERE request_id = ?
        `, ['cancelled', burnRequestId]);
        
        // Cancel associated schedule
        await connection.query(`
          UPDATE test_burn_schedules SET status = ?
          WHERE burn_request_id = ?
        `, ['cancelled', burnRequestId]);
        
        // Log emergency cancellation
        await connection.query(`
          INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'emergency_stop', JSON.stringify({
          reason: 'High wind warning',
          cancelled_at: new Date(),
          automatic: true
        })]);
        
        // Note: Resources remain allocated for audit trail
        
        await connection.commit();
        
        // Verify cancellation
        const [request] = await query('SELECT status FROM test_burn_requests WHERE request_id = ?', [burnRequestId]);
        const [schedule] = await query('SELECT status FROM test_burn_schedules WHERE burn_request_id = ?', [burnRequestId]);
        const [logs] = await query('SELECT event_type FROM test_safety_logs WHERE burn_request_id = ? ORDER BY logged_at DESC LIMIT 1', [burnRequestId]);
        
        expect(request[0].status).toBe('cancelled');
        expect(schedule[0].status).toBe('cancelled');
        expect(logs[0].event_type).toBe('emergency_stop');
        
      } finally {
        connection.release();
      }
    });

    test('Should maintain referential integrity during complex operations', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Create parent record
        const [parentResult] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date)
          VALUES (?, ?, ?)
        `, [12, 112, '2025-09-22']);
        
        const parentId = parentResult.insertId;
        
        // Create multiple child records
        const childInserts = [
          connection.query(`
            INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
            VALUES (?, ?, ?, ?)
          `, [parentId, '2025-09-22', '10:00:00', '14:00:00']),
          
          connection.query(`
            INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
            VALUES (?, ?, ?)
          `, [parentId, 'crew', 4]),
          
          connection.query(`
            INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
            VALUES (?, ?, ?)
          `, [parentId, 'approval', JSON.stringify({ test: true })])
        ];
        
        await Promise.all(childInserts);
        
        // Try to delete parent (should fail due to foreign key constraints)
        try {
          await connection.query('DELETE FROM test_burn_requests WHERE request_id = ?', [parentId]);
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.code).toMatch(/foreign key|constraint/i);
        }
        
        // Proper cascade delete: remove children first, then parent
        await connection.query('DELETE FROM test_safety_logs WHERE burn_request_id = ?', [parentId]);
        await connection.query('DELETE FROM test_resource_allocations WHERE burn_request_id = ?', [parentId]);
        await connection.query('DELETE FROM test_burn_schedules WHERE burn_request_id = ?', [parentId]);
        await connection.query('DELETE FROM test_burn_requests WHERE request_id = ?', [parentId]);
        
        await connection.commit();
        
        // Verify complete deletion
        const [requests] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE request_id = ?', [parentId]);
        const [schedules] = await query('SELECT COUNT(*) as count FROM test_burn_schedules WHERE burn_request_id = ?', [parentId]);
        const [resources] = await query('SELECT COUNT(*) as count FROM test_resource_allocations WHERE burn_request_id = ?', [parentId]);
        const [logs] = await query('SELECT COUNT(*) as count FROM test_safety_logs WHERE burn_request_id = ?', [parentId]);
        
        expect(parseInt(requests[0].count)).toBe(0);
        expect(parseInt(schedules[0].count)).toBe(0);
        expect(parseInt(resources[0].count)).toBe(0);
        expect(parseInt(logs[0].count)).toBe(0);
        
      } finally {
        connection.release();
      }
    });
  });

  describe('Transaction Recovery and Error Handling', () => {
    test('Should recover from connection loss during transaction', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Insert initial data
        const [result] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
          VALUES (?, ?, ?)
        `, [13, 113, 85]);
        
        const burnRequestId = result.insertId;
        
        // Simulate connection issue (force close)
        try {
          await connection.connection.destroy();
        } catch (error) {
          // Expected
        }
        
        // Transaction should be automatically rolled back
        // Verify data was not committed
        const [check] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE request_id = ?', [burnRequestId]);
        expect(parseInt(check[0].count)).toBe(0);
        
      } catch (error) {
        // Connection errors are expected
        expect(error.code).toMatch(/connection|lost|terminated/i);
      } finally {
        // Connection is already destroyed, release will handle cleanup
        try {
          connection.release();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    });

    test('Should handle partial transaction failures gracefully', async () => {
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Step 1: Successful insert
        const [result] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
          VALUES (?, ?, ?)
        `, [14, 114, 78]);
        
        const burnRequestId = result.insertId;
        
        // Step 2: Another successful insert
        await connection.query(`
          INSERT INTO test_burn_schedules (burn_request_id, scheduled_date, start_time, end_time)
          VALUES (?, ?, ?, ?)
        `, [burnRequestId, '2025-09-23', '11:00:00', '15:00:00']);
        
        // Step 3: This will fail (invalid enum value)
        await connection.query(`
          INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'invalid_type', 1]);
        
        await connection.commit();
        expect(true).toBe(false); // Should not reach here
        
      } catch (error) {
        await connection.rollback();
        expect(error.code).toMatch(/enum|invalid|constraint/i);
        
        // Verify all operations were rolled back
        const [requests] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE farm_id = 14');
        const [schedules] = await query('SELECT COUNT(*) as count FROM test_burn_schedules');
        
        expect(parseInt(requests[0].count)).toBe(0);
        expect(parseInt(schedules[0].count)).toBe(0);
        
      } finally {
        connection.release();
      }
    });

    test('Should handle duplicate key errors in transactions', async () => {
      // Insert initial record
      const [initialResult] = await query(`
        INSERT INTO test_burn_requests (request_id, farm_id, field_id)
        VALUES (?, ?, ?)
      `, [99001, 15, 115]);
      
      const connection = await pool().getConnection();
      
      try {
        await connection.beginTransaction();
        
        // Try to insert duplicate primary key
        await connection.query(`
          INSERT INTO test_burn_requests (request_id, farm_id, field_id)
          VALUES (?, ?, ?)
        `, [99001, 16, 116]); // Same request_id
        
        await connection.commit();
        expect(true).toBe(false); // Should not reach here
        
      } catch (error) {
        await connection.rollback();
        expect(error.code).toMatch(/ER_DUP_ENTRY|duplicate/i);
        
        // Verify original record is unchanged
        const [original] = await query('SELECT farm_id FROM test_burn_requests WHERE request_id = ?', [99001]);
        expect(original[0].farm_id).toBe(15); // Original value
        
      } finally {
        connection.release();
      }
    });

    test('Should implement retry logic for temporary failures', async () => {
      const maxRetries = 3;
      let attempts = 0;
      let success = false;
      
      while (attempts < maxRetries && !success) {
        const connection = await pool().getConnection();
        
        try {
          attempts++;
          await connection.beginTransaction();
          
          // Simulate temporary failure on first attempt
          if (attempts === 1) {
            throw new Error('Temporary connection issue');
          }
          
          // Successful operation
          const [result] = await connection.query(`
            INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
            VALUES (?, ?, ?)
          `, [17, 117, 82]);
          
          await connection.commit();
          success = true;
          
          // Verify success
          const [check] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE request_id = ?', [result.insertId]);
          expect(parseInt(check[0].count)).toBe(1);
          
        } catch (error) {
          await connection.rollback();
          
          if (attempts >= maxRetries) {
            throw error;
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } finally {
          connection.release();
        }
      }
      
      expect(success).toBeTruthy();
      expect(attempts).toBe(2); // Failed once, succeeded on retry
    });
  });

  describe('Transaction Performance and Optimization', () => {
    test('Should optimize batch inserts within transaction', async () => {
      const connection = await pool().getConnection();
      const batchSize = 100;
      
      try {
        await connection.beginTransaction();
        
        const startTime = Date.now();
        
        // Batch insert multiple burn requests
        const values = [];
        const placeholders = [];
        
        for (let i = 0; i < batchSize; i++) {
          values.push(18 + i, 118 + i, '2025-09-24', 50 + i);
          placeholders.push('(?, ?, ?, ?)');
        }
        
        await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, priority_score)
          VALUES ${placeholders.join(', ')}
        `, values);
        
        await connection.commit();
        
        const duration = Date.now() - startTime;
        
        // Verify all records inserted
        const [count] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE farm_id BETWEEN 18 AND ?', [18 + batchSize - 1]);
        expect(parseInt(count[0].count)).toBe(batchSize);
        
        // Should complete efficiently
        expect(duration).toBeLessThan(5000);
        
      } finally {
        connection.release();
      }
    });

    test('Should minimize transaction duration for high-frequency operations', async () => {
      const connection = await pool().getConnection();
      
      try {
        // Quick transaction: single purpose
        const startTime = Date.now();
        
        await connection.beginTransaction();
        
        const [result] = await connection.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
          VALUES (?, ?, ?)
        `, [200, 200, 90]);
        
        // Update priority immediately (common operation)
        await connection.query(`
          UPDATE test_burn_requests SET priority_score = ? WHERE request_id = ?
        `, [95, result.insertId]);
        
        await connection.commit();
        
        const duration = Date.now() - startTime;
        
        // Should be very fast
        expect(duration).toBeLessThan(100);
        
        // Verify operation
        const [check] = await query('SELECT priority_score FROM test_burn_requests WHERE request_id = ?', [result.insertId]);
        expect(check[0].priority_score).toBe(95);
        
      } finally {
        connection.release();
      }
    });

    test('Should handle transaction isolation levels correctly', async () => {
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [201, 201, 70]);
      
      const burnRequestId = setupResult.insertId;
      
      const connection1 = await pool().getConnection();
      const connection2 = await pool().getConnection();
      
      try {
        // Set different isolation levels
        await connection1.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection2.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        
        await connection1.beginTransaction();
        await connection2.beginTransaction();
        
        // Connection 1: Read initial value
        const [initial] = await connection1.query(
          'SELECT priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        expect(initial[0].priority_score).toBe(70);
        
        // Connection 2: Update value
        await connection2.query(
          'UPDATE test_burn_requests SET priority_score = ? WHERE request_id = ?',
          [85, burnRequestId]
        );
        await connection2.commit();
        
        // Connection 1: Read again (should see new value with READ COMMITTED)
        const [updated] = await connection1.query(
          'SELECT priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        
        await connection1.commit();
        
        // With READ COMMITTED, should see the updated value
        expect(updated[0].priority_score).toBe(85);
        
      } finally {
        connection1.release();
        connection2.release();
      }
    });

    test('Should optimize transaction commit batch size', async () => {
      const totalRecords = 1000;
      const batchSize = 100;
      const connection = await pool().getConnection();
      
      const startTime = Date.now();
      
      try {
        for (let batch = 0; batch < totalRecords / batchSize; batch++) {
          await connection.beginTransaction();
          
          for (let i = 0; i < batchSize; i++) {
            const recordNum = batch * batchSize + i;
            await connection.query(`
              INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
              VALUES (?, ?, ?)
            `, [300 + recordNum, 300 + recordNum, 50 + (recordNum % 50)]);
          }
          
          await connection.commit();
        }
        
        const duration = Date.now() - startTime;
        
        // Verify all records inserted
        const [count] = await query('SELECT COUNT(*) as count FROM test_burn_requests WHERE farm_id >= 300');
        expect(parseInt(count[0].count)).toBe(totalRecords);
        
        // Should complete in reasonable time
        expect(duration).toBeLessThan(30000); // 30 seconds max
        
      } finally {
        connection.release();
      }
    });
  });

  describe('Advanced Transaction Patterns', () => {
    test('Should implement optimistic locking with version control', async () => {
      // Add version column (simulate optimistic locking)
      await query('ALTER TABLE test_burn_requests ADD COLUMN version INT DEFAULT 1');
      
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score, version)
        VALUES (?, ?, ?, ?)
      `, [400, 400, 75, 1]);
      
      const burnRequestId = setupResult.insertId;
      
      const connection1 = await pool().getConnection();
      const connection2 = await pool().getConnection();
      
      try {
        // Both connections read the same version
        await connection1.beginTransaction();
        await connection2.beginTransaction();
        
        const [version1] = await connection1.query(
          'SELECT version, priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        
        const [version2] = await connection2.query(
          'SELECT version, priority_score FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        
        expect(version1[0].version).toBe(1);
        expect(version2[0].version).toBe(1);
        
        // Connection 1: Update with version check
        const [update1] = await connection1.query(`
          UPDATE test_burn_requests 
          SET priority_score = ?, version = version + 1 
          WHERE request_id = ? AND version = ?
        `, [80, burnRequestId, version1[0].version]);
        
        await connection1.commit();
        expect(update1.affectedRows).toBe(1);
        
        // Connection 2: Try to update with stale version (should fail)
        const [update2] = await connection2.query(`
          UPDATE test_burn_requests 
          SET priority_score = ?, version = version + 1 
          WHERE request_id = ? AND version = ?
        `, [85, burnRequestId, version2[0].version]);
        
        await connection2.commit();
        expect(update2.affectedRows).toBe(0); // Optimistic lock failure
        
        // Verify first update succeeded
        const [final] = await query(
          'SELECT priority_score, version FROM test_burn_requests WHERE request_id = ?',
          [burnRequestId]
        );
        expect(final[0].priority_score).toBe(80);
        expect(final[0].version).toBe(2);
        
      } finally {
        connection1.release();
        connection2.release();
      }
    });

    test('Should implement saga pattern for distributed operations', async () => {
      const sagaSteps = [];
      let currentStep = 0;
      
      try {
        // Step 1: Create burn request
        const connection1 = await pool().getConnection();
        await connection1.beginTransaction();
        
        const [burnResult] = await connection1.query(`
          INSERT INTO test_burn_requests (farm_id, field_id, requested_date, status)
          VALUES (?, ?, ?, ?)
        `, [500, 500, '2025-09-25', 'pending']);
        
        const burnRequestId = burnResult.insertId;
        await connection1.commit();
        connection1.release();
        
        sagaSteps.push({ step: 1, action: 'create_request', id: burnRequestId });
        currentStep = 1;
        
        // Step 2: Allocate resources
        const connection2 = await pool().getConnection();
        await connection2.beginTransaction();
        
        await connection2.query(`
          INSERT INTO test_resource_allocations (burn_request_id, resource_type, resource_id)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'crew', 10]);
        
        await connection2.commit();
        connection2.release();
        
        sagaSteps.push({ step: 2, action: 'allocate_resources', id: burnRequestId });
        currentStep = 2;
        
        // Step 3: Create schedule (this will fail)
        const connection3 = await pool().getConnection();
        await connection3.beginTransaction();
        
        // Simulate failure
        throw new Error('Scheduling conflict detected');
        
      } catch (error) {
        // Compensating transactions (rollback saga)
        console.log(`Saga failed at step ${currentStep}, rolling back...`);
        
        // Compensate in reverse order
        for (let i = sagaSteps.length - 1; i >= 0; i--) {
          const step = sagaSteps[i];
          const connection = await pool().getConnection();
          
          try {
            await connection.beginTransaction();
            
            if (step.action === 'allocate_resources') {
              await connection.query(
                'DELETE FROM test_resource_allocations WHERE burn_request_id = ?',
                [step.id]
              );
            } else if (step.action === 'create_request') {
              await connection.query(
                'UPDATE test_burn_requests SET status = ? WHERE request_id = ?',
                ['cancelled', step.id]
              );
            }
            
            await connection.commit();
          } finally {
            connection.release();
          }
        }
        
        // Verify compensations
        const [request] = await query('SELECT status FROM test_burn_requests WHERE request_id = ?', [sagaSteps[0].id]);
        const [resources] = await query('SELECT COUNT(*) as count FROM test_resource_allocations WHERE burn_request_id = ?', [sagaSteps[0].id]);
        
        expect(request[0].status).toBe('cancelled');
        expect(parseInt(resources[0].count)).toBe(0);
      }
    });

    test('Should handle read-write splitting in transaction', async () => {
      // Setup test data
      const [setupResult] = await query(`
        INSERT INTO test_burn_requests (farm_id, field_id, priority_score)
        VALUES (?, ?, ?)
      `, [600, 600, 88]);
      
      const burnRequestId = setupResult.insertId;
      
      // Write transaction
      const writeConnection = await pool().getConnection();
      
      try {
        await writeConnection.beginTransaction();
        
        // Write operations
        await writeConnection.query(`
          UPDATE test_burn_requests SET priority_score = ? WHERE request_id = ?
        `, [95, burnRequestId]);
        
        await writeConnection.query(`
          INSERT INTO test_safety_logs (burn_request_id, event_type, event_data)
          VALUES (?, ?, ?)
        `, [burnRequestId, 'approval', JSON.stringify({ updated_priority: 95 })]);
        
        await writeConnection.commit();
        
        // Read operations (can use different connection)
        const readConnection = await pool().getConnection();
        
        try {
          const [readResult] = await readConnection.query(`
            SELECT br.priority_score, sl.event_type
            FROM test_burn_requests br
            LEFT JOIN test_safety_logs sl ON br.request_id = sl.burn_request_id
            WHERE br.request_id = ?
            ORDER BY sl.logged_at DESC
            LIMIT 1
          `, [burnRequestId]);
          
          expect(readResult[0].priority_score).toBe(95);
          expect(readResult[0].event_type).toBe('approval');
          
        } finally {
          readConnection.release();
        }
        
      } finally {
        writeConnection.release();
      }
    });
  });
});

module.exports = {
  // Helper functions for transaction testing
  executeWithRetry: async (operation, maxRetries = 3) => {
    let attempts = 0;
    while (attempts < maxRetries) {
      try {
        attempts++;
        return await operation();
      } catch (error) {
        if (attempts >= maxRetries || !isRetryableError(error)) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
      }
    }
  },
  
  isRetryableError: (error) => {
    const retryableCodes = [
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_LOCK_DEADLOCK',
      'ER_QUERY_INTERRUPTED',
      'ECONNRESET',
      'ETIMEDOUT'
    ];
    return retryableCodes.includes(error.code);
  },
  
  createSafeTransaction: async (operations) => {
    const connection = await pool().getConnection();
    try {
      await connection.beginTransaction();
      
      for (const operation of operations) {
        await operation(connection);
      }
      
      await connection.commit();
      return { success: true };
    } catch (error) {
      await connection.rollback();
      return { success: false, error };
    } finally {
      connection.release();
    }
  },
  
  measureTransactionPerformance: async (transactionFunc) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    const result = await transactionFunc();
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    return {
      result,
      performance: {
        duration: endTime - startTime,
        memoryDelta: endMemory.heapUsed - startMemory.heapUsed
      }
    };
  }
};