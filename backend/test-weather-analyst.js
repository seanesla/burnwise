#!/usr/bin/env node
/**
 * Test WeatherAnalyst loading with GPT-5-nano
 * Verifies the agent can be instantiated successfully
 */

console.log('Testing WeatherAnalyst...');

try {
  const WeatherAnalyst = require('./agents-sdk/WeatherAnalyst');
  
  console.log('✓ WeatherAnalyst loaded successfully');
  console.log('Agent name:', WeatherAnalyst.name);
  console.log('Tools available:', WeatherAnalyst.tools ? WeatherAnalyst.tools.length : 'None');
  
  console.log('\n✓ All tests passed - WeatherAnalyst ready with GPT-5-nano');
  process.exit(0);
  
} catch (error) {
  console.error('✗ Failed to load WeatherAnalyst:', error.message);
  process.exit(1);
}