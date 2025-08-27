/**
 * OnboardingAgent - Natural language farm setup assistant
 * Uses GPT-5-mini for extracting farm information from conversational text
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const logger = require('../middleware/logger');

// Tool to extract form data from natural language
const extractFormData = tool({
  name: 'extract_form_data',
  description: 'Extract farm information from natural language text',
  parameters: z.object({
    farmName: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    acreage: z.number().nullable().optional(),
    cropType: z.string().nullable().optional(),
    ownerName: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional()
  }),
  execute: async (input) => {
    logger.info('OnboardingAgent extracted data', input);
    return {
      success: true,
      extracted: input
    };
  }
});

/**
 * OnboardingAgent - Helps farmers set up their accounts
 * Uses GPT-5-mini for reliable data extraction
 */
const onboardingAgent = new Agent({
  name: 'OnboardingAgent',
  instructions: `You are the OnboardingAgent, helping farmers set up their accounts in Burnwise.
    
    Your tasks:
    1. Extract farm information from natural language descriptions
    2. Identify: farm name, location, acreage, crops, owner name, contact info
    3. Return structured data for form filling
    
    Extract whatever information is available:
    - Farm name (e.g., "Sunny Acres", "Green Valley Farm")
    - Location (city, state)
    - Acreage (numeric value)
    - Crop types (wheat, corn, rice, etc.)
    - Owner name
    - Email address
    - Phone number
    
    If certain information is not provided, return null for those fields.
    Always use the extract_form_data tool to return the structured data.`,
  
  model: 'gpt-5-mini', // Using gpt-5-mini for JSON output
  
  tools: [extractFormData]
});

// Helper method for backward compatibility
onboardingAgent.extractFormData = async function(text) {
  try {
    const { run } = require('@openai/agents');
    const result = await run(this, `Extract farm information from: "${text}"`, {
      context: { rawText: text }
    });
    
    // Extract the tool call result
    if (result.runItems) {
      for (const item of result.runItems) {
        if (item.type === 'tool_call' && item.name === 'extract_form_data') {
          return item.arguments || {};
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('OnboardingAgent extraction failed', { error: error.message });
    return null;
  }
};

module.exports = onboardingAgent;