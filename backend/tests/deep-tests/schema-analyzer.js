#!/usr/bin/env node

/**
 * Database Schema Analyzer and Fixer
 * This tool analyzes the actual database schema and identifies/fixes issues
 */

require('dotenv').config({ path: '../../.env' });
const mysql = require('mysql2/promise');

class SchemaAnalyzer {
  constructor() {
    this.connection = null;
    this.issues = [];
    this.fixes = [];
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: process.env.TIDB_HOST,
        port: process.env.TIDB_PORT || 4000,
        user: process.env.TIDB_USER,
        password: process.env.TIDB_PASSWORD,
        database: process.env.TIDB_DATABASE,
        ssl: {
          rejectUnauthorized: true
        }
      });
      console.log('✅ Connected to TiDB database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  async analyzeTable(tableName) {
    console.log(`\n📊 Analyzing table: ${tableName}`);
    
    try {
      // Get column information
      const [columns] = await this.connection.execute(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [tableName]
      );

      if (columns.length === 0) {
        this.issues.push({
          table: tableName,
          issue: 'Table does not exist',
          severity: 'critical'
        });
        return null;
      }

      // Get indexes
      const [indexes] = await this.connection.execute(
        `SHOW INDEXES FROM ${tableName}`
      );

      // Get row count
      const [countResult] = await this.connection.execute(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );

      const tableInfo = {
        name: tableName,
        columns: columns,
        indexes: indexes,
        rowCount: countResult[0].count
      };

      console.log(`  Columns: ${columns.length}`);
      console.log(`  Indexes: ${indexes.length}`);
      console.log(`  Rows: ${countResult[0].count}`);

      return tableInfo;
    } catch (error) {
      console.error(`  ❌ Error analyzing ${tableName}:`, error.message);
      this.issues.push({
        table: tableName,
        issue: error.message,
        severity: 'high'
      });
      return null;
    }
  }

  async checkRequiredColumns() {
    console.log('\n🔍 Checking required columns based on API usage...');
    
    const requiredSchema = {
      farms: [
        'id', 'name', 'location', 'owner_name', 'contact_email', 
        'contact_phone', 'total_acreage', 'created_at', 'updated_at'
      ],
      burn_requests: [
        'id', 'farm_id', 'field_id', 'acreage', 'crop_type',
        'requested_date', 'requested_window_start', 'requested_window_end',
        'status', 'priority_score', 'created_at', 'updated_at'
      ],
      alerts: [
        'id', 'farm_id', 'type', 'severity', 'message', 
        'status', 'created_at', 'acknowledged_at', 'resolved_at'
      ],
      weather_conditions: [
        'id', 'location_lat', 'location_lng', 'temperature', 'humidity',
        'wind_speed', 'wind_direction', 'timestamp', 'weather_pattern_embedding'
      ],
      smoke_predictions: [
        'id', 'burn_request_id', 'max_dispersion_km', 'affected_area_km2',
        'peak_pm25_concentration', 'plume_vector', 'created_at'
      ]
    };

    for (const [tableName, requiredColumns] of Object.entries(requiredSchema)) {
      const tableInfo = await this.analyzeTable(tableName);
      
      if (tableInfo) {
        const existingColumns = tableInfo.columns.map(c => c.COLUMN_NAME.toLowerCase());
        const missingColumns = requiredColumns.filter(
          col => !existingColumns.includes(col.toLowerCase())
        );

        if (missingColumns.length > 0) {
          console.log(`  ⚠️  Table ${tableName} missing columns: ${missingColumns.join(', ')}`);
          this.issues.push({
            table: tableName,
            issue: `Missing columns: ${missingColumns.join(', ')}`,
            severity: 'high',
            missingColumns
          });

          // Generate fix SQL
          this.generateColumnFixes(tableName, missingColumns);
        } else {
          console.log(`  ✅ Table ${tableName} has all required columns`);
        }
      }
    }
  }

  generateColumnFixes(tableName, missingColumns) {
    const columnDefinitions = {
      // Common columns
      'id': 'INT PRIMARY KEY AUTO_INCREMENT',
      'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
      'acknowledged_at': 'TIMESTAMP NULL',
      'resolved_at': 'TIMESTAMP NULL',
      
      // Farm columns
      'name': 'VARCHAR(255) NOT NULL',
      'location': 'POINT',
      'owner_name': 'VARCHAR(255)',
      'contact_email': 'VARCHAR(255)',
      'contact_phone': 'VARCHAR(50)',
      'total_acreage': 'DECIMAL(10, 2)',
      
      // Burn request columns
      'farm_id': 'INT',
      'field_id': 'VARCHAR(50)',
      'acreage': 'DECIMAL(10, 2)',
      'crop_type': 'VARCHAR(100)',
      'requested_date': 'DATE',
      'requested_window_start': 'DATETIME',
      'requested_window_end': 'DATETIME',
      'status': "ENUM('pending', 'approved', 'scheduled', 'active', 'completed', 'cancelled') DEFAULT 'pending'",
      'priority_score': 'DECIMAL(5, 2)',
      
      // Alert columns
      'type': "ENUM('warning', 'danger', 'info', 'success') DEFAULT 'info'",
      'severity': "ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium'",
      'message': 'TEXT',
      
      // Weather columns
      'location_lat': 'DECIMAL(10, 8)',
      'location_lng': 'DECIMAL(11, 8)',
      'temperature': 'DECIMAL(5, 2)',
      'humidity': 'INT',
      'wind_speed': 'DECIMAL(5, 2)',
      'wind_direction': 'INT',
      'timestamp': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
      'weather_pattern_embedding': 'JSON',
      
      // Smoke prediction columns
      'burn_request_id': 'INT',
      'max_dispersion_km': 'DECIMAL(10, 3)',
      'affected_area_km2': 'DECIMAL(10, 3)',
      'peak_pm25_concentration': 'DECIMAL(10, 3)',
      'plume_vector': 'JSON'
    };

    for (const column of missingColumns) {
      const definition = columnDefinitions[column] || 'VARCHAR(255)';
      const sql = `ALTER TABLE ${tableName} ADD COLUMN ${column} ${definition};`;
      
      this.fixes.push({
        table: tableName,
        column: column,
        sql: sql
      });
    }
  }

  async applyFixes(dryRun = true) {
    console.log('\n🔧 Proposed fixes:');
    
    for (const fix of this.fixes) {
      console.log(`\n  Table: ${fix.table}`);
      console.log(`  Column: ${fix.column}`);
      console.log(`  SQL: ${fix.sql}`);
      
      if (!dryRun) {
        try {
          await this.connection.execute(fix.sql);
          console.log(`  ✅ Applied successfully`);
        } catch (error) {
          console.error(`  ❌ Failed to apply: ${error.message}`);
        }
      }
    }

    if (dryRun) {
      console.log('\n⚠️  This was a dry run. Add --apply flag to actually apply fixes.');
    }
  }

  async analyzeForeignKeys() {
    console.log('\n🔗 Analyzing foreign key relationships...');
    
    const [foreignKeys] = await this.connection.execute(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    if (foreignKeys.length === 0) {
      console.log('  ⚠️  No foreign keys found');
      this.issues.push({
        issue: 'No foreign key constraints defined',
        severity: 'medium'
      });
    } else {
      console.log('  Found foreign keys:');
      foreignKeys.forEach(fk => {
        console.log(`    ${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });
    }
  }

  async analyzeVectorColumns() {
    console.log('\n🔢 Analyzing vector columns...');
    
    const vectorTables = [
      { table: 'weather_conditions', column: 'weather_pattern_embedding', dimensions: 128 },
      { table: 'smoke_predictions', column: 'plume_vector', dimensions: 64 },
      { table: 'burn_requests', column: 'burn_vector', dimensions: 32 }
    ];

    for (const { table, column, dimensions } of vectorTables) {
      try {
        // Check if column exists and its type
        const [columns] = await this.connection.execute(
          `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );

        if (columns.length === 0) {
          console.log(`  ⚠️  ${table}.${column} does not exist`);
          this.issues.push({
            table,
            issue: `Vector column ${column} missing`,
            severity: 'high'
          });
        } else {
          const dataType = columns[0].DATA_TYPE;
          console.log(`  ${table}.${column}: ${dataType} (expected ${dimensions} dimensions)`);
          
          // Check if it's actually a VECTOR type or JSON
          if (dataType !== 'vector' && dataType !== 'json') {
            console.log(`    ⚠️  Column type is ${dataType}, expected VECTOR or JSON`);
          }
        }
      } catch (error) {
        console.error(`  ❌ Error checking ${table}.${column}: ${error.message}`);
      }
    }
  }

  async generateTestData() {
    console.log('\n📝 Generating test data for fixed schema...');
    
    // Only generate if tables are properly structured
    if (this.issues.filter(i => i.severity === 'critical').length === 0) {
      console.log('  Would generate test data for:');
      console.log('    - 10 farms');
      console.log('    - 50 burn requests');
      console.log('    - 100 weather readings');
      console.log('    - 20 alerts');
    } else {
      console.log('  ⚠️  Cannot generate test data due to critical schema issues');
    }
  }

  async generateReport() {
    console.log('\n📋 SCHEMA ANALYSIS REPORT');
    console.log('═'.repeat(50));
    
    console.log('\n🔴 Critical Issues:');
    const critical = this.issues.filter(i => i.severity === 'critical');
    if (critical.length === 0) {
      console.log('  None found ✅');
    } else {
      critical.forEach(i => console.log(`  - ${i.table}: ${i.issue}`));
    }

    console.log('\n🟡 High Priority Issues:');
    const high = this.issues.filter(i => i.severity === 'high');
    if (high.length === 0) {
      console.log('  None found ✅');
    } else {
      high.forEach(i => console.log(`  - ${i.table || 'General'}: ${i.issue}`));
    }

    console.log('\n🟢 Medium/Low Priority Issues:');
    const medium = this.issues.filter(i => i.severity === 'medium' || i.severity === 'low');
    if (medium.length === 0) {
      console.log('  None found ✅');
    } else {
      medium.forEach(i => console.log(`  - ${i.issue}`));
    }

    console.log('\n📊 Summary:');
    console.log(`  Total issues found: ${this.issues.length}`);
    console.log(`  Fixes generated: ${this.fixes.length}`);
    
    return {
      issues: this.issues,
      fixes: this.fixes
    };
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      console.log('\n✅ Database connection closed');
    }
  }
}

// Main execution
async function main() {
  const analyzer = new SchemaAnalyzer();
  const applyFixes = process.argv.includes('--apply');
  
  try {
    await analyzer.connect();
    await analyzer.checkRequiredColumns();
    await analyzer.analyzeForeignKeys();
    await analyzer.analyzeVectorColumns();
    await analyzer.applyFixes(dryRun = !applyFixes);
    
    if (!applyFixes && analyzer.fixes.length > 0) {
      await analyzer.generateTestData();
    }
    
    const report = await analyzer.generateReport();
    
    // Save report
    const fs = require('fs');
    fs.writeFileSync(
      'schema-analysis-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n💾 Report saved to schema-analysis-report.json');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  } finally {
    await analyzer.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = SchemaAnalyzer;