const axios = require('axios');
const { query, initializeDatabase } = require('./backend/db/connection');

async function testAuth() {
  console.log('🔍 Testing Authentication System...\n');
  
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connected\n');
    
    // 1. Check existing farms
    console.log('1️⃣ Checking existing farms in database:');
    const farms = await query('SELECT farm_id, farm_name, owner_name, contact_email FROM farms LIMIT 5');
    farms.forEach(farm => {
      console.log(`   Farm #${farm.farm_id}: ${farm.farm_name} - ${farm.contact_email}`);
    });
    
    if (farms.length === 0) {
      console.log('   ❌ No farms found! Running seed...');
      return;
    }
    
    // 2. Test login with first farm
    const testEmail = farms[0].contact_email;
    console.log(`\n2️⃣ Testing login with: ${testEmail}`);
    
    try {
      const loginResponse = await axios.post('http://localhost:5001/api/auth/login', {
        email: testEmail,
        password: 'demo123'
      });
      
      console.log('   ✅ Login successful!');
      console.log('   Token:', loginResponse.data.token ? 'Received' : 'Missing');
      console.log('   User:', loginResponse.data.user);
      
      // 3. Test protected endpoint with token
      const token = loginResponse.data.token;
      console.log('\n3️⃣ Testing protected endpoint with token:');
      
      const verifyResponse = await axios.get('http://localhost:5001/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('   ✅ Token verified!');
      console.log('   Valid:', verifyResponse.data.valid);
      
    } catch (error) {
      console.log('   ❌ Login failed:', error.response?.data || error.message);
      console.log('   Trying with farm1 password...');
      
      // Try with farm-specific password
      try {
        const loginResponse2 = await axios.post('http://localhost:5001/api/auth/login', {
          email: testEmail,
          password: `farm${farms[0].farm_id}`
        });
        console.log('   ✅ Login successful with farm password!');
      } catch (error2) {
        console.log('   ❌ Farm password also failed:', error2.response?.data || error2.message);
      }
    }
    
    // 4. Test registration
    console.log('\n4️⃣ Testing registration:');
    const randomId = Math.floor(Math.random() * 10000);
    try {
      const registerResponse = await axios.post('http://localhost:5001/api/auth/register', {
        farm_name: `Test Farm ${randomId}`,
        owner_name: `Test Owner ${randomId}`,
        email: `test${randomId}@example.com`,
        password: 'test123',
        longitude: -122.4194,
        latitude: 37.7749,
        total_acreage: 100
      });
      
      console.log('   ✅ Registration successful!');
      console.log('   New farm ID:', registerResponse.data.user.farmId);
      console.log('   Token:', registerResponse.data.token ? 'Received' : 'Missing');
      
    } catch (error) {
      console.log('   ❌ Registration failed:', error.response?.data || error.message);
    }
    
    console.log('\n✨ Authentication test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
}

// Run after a short delay to ensure DB connection
setTimeout(testAuth, 2000);