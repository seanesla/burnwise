// Test Zod schemas with nullable and optional
const { z } = require('zod');
const { tool } = require('@openai/agents');

console.log('Testing Zod schemas...');

try {
  // Test 1: Just optional
  const schema1 = z.object({
    value: z.number().optional()
  });
  console.log('✓ optional works');
  
  // Test 2: Just nullable  
  const schema2 = z.object({
    value: z.number().nullable()
  });
  console.log('✓ nullable works');
  
  // Test 3: nullable().optional()
  const schema3 = z.object({
    value: z.number().nullable().optional()
  });
  console.log('✓ nullable().optional() works in Zod');
  
  // Test 4: Create a tool with nullable().optional()
  const testTool = tool({
    name: 'test_tool',
    description: 'Test tool',
    parameters: z.object({
      requiredValue: z.number(),
      optionalValue: z.number().nullable().optional()
    }),
    execute: async (input) => {
      return 'Success';
    }
  });
  console.log('✓ Tool with nullable().optional() created');
  
} catch (error) {
  console.error('✗ Error:', error.message);
}