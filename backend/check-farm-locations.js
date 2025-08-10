require('dotenv').config();
const { query, initializeDatabase } = require('./db/connection');

(async () => {
  await initializeDatabase();
  
  // Check ALL farms to see what's really in there
  const allFarms = await query('SELECT farm_id, farm_name, latitude, longitude FROM farms ORDER BY farm_name');
  
  console.log('=== ALL FARMS IN DATABASE ===');
  console.log('Total farms:', allFarms.length);
  console.log('');
  
  // Group by location
  const locationGroups = {};
  allFarms.forEach(f => {
    const key = `${f.latitude},${f.longitude}`;
    if (!locationGroups[key]) locationGroups[key] = [];
    locationGroups[key].push(f.farm_name);
  });
  
  console.log('Grouped by location:');
  Object.entries(locationGroups).forEach(([loc, farms]) => {
    console.log('');
    console.log(`Location ${loc}:`);
    farms.forEach(name => console.log(`  - ${name}`));
  });
  
  // Check for expected California farms
  const expectedFarms = allFarms.filter(f => 
    f.farm_name.includes('Green') || 
    f.farm_name.includes('Prairie') || 
    f.farm_name.includes('Valley') ||
    f.farm_name.includes('Sunset')
  );
  
  console.log('');
  console.log('=== EXPECTED CALIFORNIA FARMS ===');
  expectedFarms.forEach(f => {
    console.log(`${f.farm_name}: ${f.latitude}, ${f.longitude}`);
  });
  
  // Check weather API default
  console.log('');
  console.log('=== WEATHER API DEFAULT LOCATION ===');
  console.log('Kansas agricultural region: 39.05, -95.7');
  console.log('This is where the 84°F temperature is coming from!');
  
  process.exit(0);
})();