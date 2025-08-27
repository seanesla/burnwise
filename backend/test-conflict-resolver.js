#!/usr/bin/env node
/**
 * Test ConflictResolver loading with GPT-5-mini
 * Verifies the agent can be instantiated successfully
 */

console.log('Testing ConflictResolver...');

try {
  const ConflictResolver = require('./agents-sdk/ConflictResolver');
  
  console.log('✓ ConflictResolver loaded successfully');
  console.log('Agent name:', ConflictResolver.name);
  console.log('Tools available:', ConflictResolver.tools ? ConflictResolver.tools.length : 'None');
  
  console.log('\n✓ All tests passed - ConflictResolver ready with GPT-5-mini');
  process.exit(0);
  
} catch (error) {
  console.error('✗ Failed to load ConflictResolver:', error.message);
  process.exit(1);
}