/**
 * Add password_hash column to farms table for secure authentication
 * This migration adds proper password storage capability
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPasswordHashColumn() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: process.env.TIDB_PORT || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    console.log('🔗 Connected to TiDB');
    
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'farms' 
        AND COLUMN_NAME = 'password_hash'
    `, [process.env.TIDB_DATABASE]);
    
    if (columns.length > 0) {
      console.log('✅ password_hash column already exists');
      return;
    }
    
    // Add password_hash column
    console.log('📝 Adding password_hash column to farms table...');
    await connection.execute(`
      ALTER TABLE farms 
      ADD COLUMN password_hash VARCHAR(255) NULL 
      COMMENT 'Bcrypt hashed password for secure authentication'
    `);
    
    console.log('✅ password_hash column added successfully');
    
    // Add index for performance
    console.log('📝 Adding index on contact_email for faster lookups...');
    try {
      await connection.execute(`
        CREATE INDEX idx_farms_email ON farms(contact_email)
      `);
      console.log('✅ Email index created');
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ Email index already exists');
      } else {
        throw indexError;
      }
    }
    
    // Verify the column was added
    const [verify] = await connection.execute(`
      DESCRIBE farms
    `);
    
    const passwordHashColumn = verify.find(col => col.Field === 'password_hash');
    if (passwordHashColumn) {
      console.log('✅ Verification successful - password_hash column details:');
      console.log('   Type:', passwordHashColumn.Type);
      console.log('   Null:', passwordHashColumn.Null);
      console.log('   Default:', passwordHashColumn.Default);
    } else {
      throw new Error('Column was not added successfully');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('⚠️ IMPORTANT: Update existing users to set secure passwords');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
addPasswordHashColumn();