// EXTREME DEBUGGING MIDDLEWARE - Track every step
const logger = require('./middleware/logger');

const debugMiddleware = (req, res, next) => {
  // Log the parsed body that express.json() already processed
  console.log('\n=== EXPRESS BODY PARSER DEBUG ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('req.body exists?', !!req.body);
  console.log('req.body type:', typeof req.body);
  console.log('req.body:', JSON.stringify(req.body, null, 2));
  
  if (req.body) {
    console.log('req.body keys:', Object.keys(req.body));
    
    if (req.body.burnRequest) {
      console.log('\nburnRequest analysis:');
      console.log('  Type:', typeof req.body.burnRequest);
      console.log('  Is Array?', Array.isArray(req.body.burnRequest));
      console.log('  Keys:', Object.keys(req.body.burnRequest));
      console.log('  farm_id value:', req.body.burnRequest.farm_id);
      console.log('  farm_id type:', typeof req.body.burnRequest.farm_id);
      console.log('  farm_id === undefined?', req.body.burnRequest.farm_id === undefined);
      console.log('  farm_id === null?', req.body.burnRequest.farm_id === null);
      
      // Check all fields
      for (const [key, value] of Object.entries(req.body.burnRequest)) {
        console.log(`  ${key}: ${typeof value} = ${JSON.stringify(value)}`);
      }
    }
  }
  console.log('=== END EXPRESS BODY PARSER DEBUG ===\n');
  
  // Wrap res.json to capture responses
  const originalJson = res.json;
  res.json = function(data) {
    console.log('\n=== RESPONSE DEBUG ===');
    console.log('Status Code:', res.statusCode);
    console.log('Response Data:', JSON.stringify(data, null, 2));
    console.log('=== END RESPONSE DEBUG ===\n');
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = debugMiddleware;