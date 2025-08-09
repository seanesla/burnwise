require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing with credentials:');
  console.log('Host:', process.env.TIDB_HOST);
  console.log('Port:', process.env.TIDB_PORT);
  console.log('User:', process.env.TIDB_USER);
  console.log('Database:', process.env.TIDB_DATABASE);
  
  try {
    const connection = await mysql.createConnection({
      host: process.env.TIDB_HOST,
      port: parseInt(process.env.TIDB_PORT) || 4000,
      user: process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      }
    });
    
    console.log('✓ Connected successfully!');
    
    const [rows] = await connection.execute('SELECT DATABASE() as db');
    console.log('Current database:', rows[0].db);
    
    await connection.end();
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error errno:', error.errno);
  }
}

testConnection();