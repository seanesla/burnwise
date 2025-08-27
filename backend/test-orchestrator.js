// Test loading orchestrator with all agents
console.log('Testing orchestrator...');

try {
  const orchestrator = require('./agents-sdk/orchestrator');
  console.log('✓ Orchestrator loaded successfully');
  console.log('Orchestrator name:', orchestrator.name);
  process.exit(0);
} catch (error) {
  console.error('✗ Error loading orchestrator:');
  console.error('  Message:', error.message);
  console.error('  Stack:', error.stack);
  process.exit(1);
}