/**
 * BurnRequestAgent - Natural Language to Structured JSON
 * Uses GPT-4o-mini for reliable JSON output
 * Part of 5-Agent System for TiDB AgentX Hackathon 2025
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Tool to store burn request in TiDB
const storeBurnRequest = tool({
  name: 'store_burn_request',
  description: 'Store validated burn request in TiDB database',
  parameters: z.object({
    farm_id: z.number(),
    field_name: z.string(),
    acres: z.number(),
    crop_type: z.string(),
    burn_date: z.string(),
    time_window_start: z.string(),
    time_window_end: z.string(),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
    reason: z.string()
  }),
  execute: async (input) => {
    try {
      const sql = `
        INSERT INTO burn_requests 
        (farm_id, field_name, acres, crop_type, burn_date, 
         time_window_start, time_window_end, urgency, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `;
      
      const result = await query(sql, [
        input.farm_id,
        input.field_name,
        input.acres,
        input.crop_type,
        input.burn_date,
        input.time_window_start,
        input.time_window_end,
        input.urgency,
        input.reason
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
    acres: z.number(),
    windSpeed: z.number().nullable().optional(),
    humidity: z.number().nullable().optional()
  }),
  execute: async (input) => {
    const issues = [];
    
    if (input.acres > 500) {
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
      needsApproval: input.acres > 100
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
    2. Identify: farm location, acreage, crop type, preferred dates/times
    3. Validate parameters using the validate_parameters tool
    4. Store valid requests using store_burn_request tool
    5. Flag requests over 100 acres as needing human approval
    
    Always extract and validate:
    - Acreage (required)
    - Crop type (wheat, rice, corn, etc.)
    - Preferred burn date
    - Time window (morning, afternoon, or specific hours)
    - Urgency level (low, medium, high, critical)
    
    If information is missing, make reasonable assumptions based on context.`,
  
  model: 'gpt-5-mini', // Reliable for JSON output
  
  tools: [storeBurnRequest, validateBurnParameters]
});

module.exports = burnRequestAgent;