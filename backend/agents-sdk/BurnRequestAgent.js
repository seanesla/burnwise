/**
 * BurnRequestAgent - Natural Language to Structured JSON
 * Uses GPT-4o-mini for reliable JSON output
 * Part of 5-Agent System for TiDB AgentX Hackathon 2025
 */

const { Agent, tool, setDefaultOpenAIKey } = require('@openai/agents');
const { z } = require('zod');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Configure OpenAI API key for real agent execution
setDefaultOpenAIKey(process.env.OPENAI_API_KEY);

// Tool to store burn request in TiDB
const storeBurnRequest = tool({
  name: 'store_burn_request',
  description: 'Store validated burn request in TiDB database',
  parameters: z.object({
    farm_id: z.number(),
    field_id: z.number(),
    acreage: z.number(),
    crop_type: z.string(),
    requested_date: z.string(),
    requested_window_start: z.string(),
    requested_window_end: z.string(),
    burn_type: z.enum(['broadcast', 'pile', 'prescribed']).default('broadcast'),
    purpose: z.string()
  }),
  execute: async (input) => {
    try {
      const sql = `
        INSERT INTO burn_requests 
        (farm_id, field_id, acreage, crop_type, requested_date, 
         requested_window_start, requested_window_end, burn_type, purpose, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `;
      
      const result = await query(sql, [
        input.farm_id,
        input.field_id,
        input.acreage,
        input.crop_type,
        input.requested_date,
        input.requested_window_start,
        input.requested_window_end,
        input.burn_type,
        input.purpose
      ]);
      
      logger.info('BurnRequestAgent stored request', { id: result.insertId });
      return { 
        success: true, 
        requestId: result.insertId,
        message: `Burn request #${result.insertId} created successfully`
      };
    } catch (error) {
      logger.error('BurnRequestAgent storage failed', error);
      return { success: false, error: error.message };
    }
  }
});

// Tool to validate burn parameters
const validateBurnParameters = tool({
  name: 'validate_parameters',
  description: 'Validate burn request parameters against safety rules',
  parameters: z.object({
    acreage: z.number(),
    windSpeed: z.number().nullable().optional(),
    humidity: z.number().nullable().optional()
  }),
  execute: async (input) => {
    const issues = [];
    
    if (input.acreage > 500) {
      issues.push('Large burn area requires special permits');
    }
    
    if (input.windSpeed && input.windSpeed > 15) {
      issues.push('Wind speed exceeds safe burning conditions');
    }
    
    if (input.humidity && input.humidity < 30) {
      issues.push('Humidity too low - increased fire spread risk');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      needsApproval: input.acreage > 100
    };
  }
});

/**
 * BurnRequestAgent - Processes natural language burn requests
 * Uses GPT-4o-mini for reliable JSON output
 */
const burnRequestAgent = new Agent({
  name: 'BurnRequestAgent',
  handoffDescription: 'I process natural language burn requests and convert them to structured data',
  
  instructions: `You are the BurnRequestAgent, responsible for processing burn requests from farmers.
    
    Your tasks:
    1. Extract structured data from natural language requests
    2. Identify: farm location, field_id, acreage, crop type, preferred dates/times
    3. Validate parameters using the validate_parameters tool
    4. Store valid requests using store_burn_request tool
    5. Flag requests over 100 acres as needing human approval
    
    Always extract and validate:
    - farm_id: Use 2034691 for Demo Farm (required)
    - field_id: Use 1987924 for Demo Farm Field 1 (required)
    - acreage: Number of acres to burn (required)
    - crop_type: wheat, rice, corn, etc. (required)
    - requested_date: Date in YYYY-MM-DD format (required)
    - requested_window_start/end: Full datetime in YYYY-MM-DD HH:mm:ss format
    - burn_type: broadcast, pile, or prescribed (default: broadcast)
    - purpose: Reason for burn (required)
    
    If information is missing, make reasonable assumptions based on context.`,
  
  model: 'gpt-5-mini', // Reliable for JSON output
  
  tools: [storeBurnRequest, validateBurnParameters]
});

module.exports = burnRequestAgent;