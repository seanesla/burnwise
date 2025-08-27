// Test simple agent import
const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');

console.log('Testing basic agent creation...');

try {
  // Create a simple tool
  const testTool = tool({
    name: 'test_tool',
    description: 'Test tool',
    parameters: z.object({
      message: z.string()
    }),
    execute: async (input) => {
      return `Received: ${input.message}`;
    }
  });
  
  console.log('Tool created successfully');
  
  // Create a simple agent
  const testAgent = new Agent({
    name: 'TestAgent',
    instructions: 'You are a test agent',
    model: 'gpt-4o-mini',
    tools: [testTool]
  });
  
  console.log('Agent created successfully:', testAgent.name);
  
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}