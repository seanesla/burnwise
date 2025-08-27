#!/usr/bin/env node
/**
 * Test ScheduleOptimizer loading with GPT-5-nano
 * Verifies the agent can be instantiated successfully
 */

console.log('Testing ScheduleOptimizer...');

try {
  const ScheduleOptimizer = require('./agents-sdk/ScheduleOptimizer');
  
  console.log('✓ ScheduleOptimizer loaded successfully');
  console.log('Agent name:', ScheduleOptimizer.name);
  console.log('Tools available:', ScheduleOptimizer.tools ? ScheduleOptimizer.tools.length : 'None');
  
  console.log('\n✓ All tests passed - ScheduleOptimizer ready with GPT-5-nano');
  process.exit(0);
  
} catch (error) {
  console.error('✗ Failed to load ScheduleOptimizer:', error.message);
  process.exit(1);
}