// Test what @openai/agents actually exports
try {
  const agents = require('@openai/agents');
  console.log('Available exports from @openai/agents:');
  console.log(Object.keys(agents));
  
  // Try to use it as documented
  if (agents.Agent) {
    console.log('\nAgent class exists');
  }
  if (agents.tool) {
    console.log('tool function exists');
  }
  if (agents.run) {
    console.log('run function exists');
  }
  
  // Check realtime imports
  const realtime = require('@openai/agents/realtime');
  console.log('\nRealtime exports:', Object.keys(realtime));
  
} catch (error) {
  console.error('Error:', error.message);
}