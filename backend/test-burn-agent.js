// Test loading BurnRequestAgent
console.log('Testing BurnRequestAgent...');

try {
  const burnRequestAgent = require('./agents-sdk/BurnRequestAgent');
  console.log('✓ BurnRequestAgent loaded successfully');
  console.log('Agent name:', burnRequestAgent.name);
} catch (error) {
  console.error('✗ Error loading BurnRequestAgent:');
  console.error('  Message:', error.message);
  console.error('  Stack:', error.stack);
}