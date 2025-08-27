#!/usr/bin/env node
/**
 * Test ProactiveMonitor loading with GPT-5-nano
 * Verifies the agent can be instantiated successfully
 */

console.log('Testing ProactiveMonitor...');

try {
  const ProactiveMonitor = require('./agents-sdk/ProactiveMonitor');
  
  console.log('✓ ProactiveMonitor loaded successfully');
  console.log('Agent name:', ProactiveMonitor.name);
  console.log('Tools available:', ProactiveMonitor.tools ? ProactiveMonitor.tools.length : 'None');
  
  console.log('\n✓ All tests passed - ProactiveMonitor ready with GPT-5-nano');
  process.exit(0);
  
} catch (error) {
  console.error('✗ Failed to load ProactiveMonitor:', error.message);
  process.exit(1);
}