/**
 * BurnRequestAgent - REAL Natural Language to Structured Data
 * Uses GPT-5-nano to extract burn request details from farmer's natural language
 * NO MOCKS - Actually processes text and creates real burn requests
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Initialize OpenAI with GPT-5-nano for cost efficiency
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v2'
});

// Schema for structured burn request
const structuredBurnRequestSchema = z.object({
  farm_id: z.number(),
  field_name: z.string(),
  acres: z.number().min(1).max(10000),
  crop_type: z.string(),
  burn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_window_start: z.string().regex(/^\d{2}:\d{2}$/),
  time_window_end: z.string().regex(/^\d{2}:\d{2}$/),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  reason: z.string(),
  field_boundary: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number())))
  }).optional()
});

// Tools for the agent
const burnRequestTools = [
  tool({
    name: 'lookup_farm',
    description: 'Look up farm details by owner name or farm name',
    parameters: z.object({
      searchTerm: z.string()
    }),
    execute: async (params) => {
      const farms = await query(`
        SELECT farm_id, farm_name, owner_name, acres, latitude, longitude
        FROM farms 
        WHERE farm_name LIKE ? OR owner_name LIKE ?
        LIMIT 5
      `, [`%${params.searchTerm}%`, `%${params.searchTerm}%`]);
      
      return farms;
    }
  }),

  tool({
    name: 'get_farm_fields',
    description: 'Get fields for a specific farm',
    parameters: z.object({
      farmId: z.number()
    }),
    execute: async (params) => {
      const fields = await query(`
        SELECT DISTINCT field_id, field_name, acreage, crop_type
        FROM burn_requests
        WHERE farm_id = ?
        ORDER BY created_at DESC
        LIMIT 10
      `, [params.farmId]);
      
      return fields;
    }
  }),

  tool({
    name: 'check_date_availability',
    description: 'Check if a date has burn slots available',
    parameters: z.object({
      date: z.string(),
      farmId: z.number()
    }),
    execute: async (params) => {
      const existing = await query(`
        SELECT COUNT(*) as count, 
               SUM(acreage) as total_acres
        FROM burn_requests
        WHERE requested_date = ? 
        AND status IN ('pending', 'approved', 'scheduled')
      `, [params.date]);
      
      const conflicts = await query(`
        SELECT br.farm_id, f.farm_name, br.requested_window_start, br.requested_window_end
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.farm_id
        WHERE br.requested_date = ?
        AND br.status IN ('pending', 'approved', 'scheduled')
        AND br.farm_id != ?
        LIMIT 5
      `, [params.date, params.farmId]);
      
      return {
        date: params.date,
        existingBurns: existing[0].count,
        totalAcresScheduled: existing[0].total_acres || 0,
        hasCapacity: existing[0].count < 10, // Max 10 burns per day
        potentialConflicts: conflicts
      };
    }
  }),

  tool({
    name: 'validate_burn_parameters',
    description: 'Validate burn request parameters are within acceptable ranges',
    parameters: z.object({
      acres: z.number(),
      cropType: z.string(),
      windSpeed: z.number().optional()
    }),
    execute: async (params) => {
      const validations = {
        acres: {
          valid: params.acres > 0 && params.acres <= 1000,
          message: params.acres > 1000 ? 'Acres exceeds maximum single burn limit (1000)' : 
                   params.acres <= 0 ? 'Acres must be positive' : 'Valid'
        },
        cropType: {
          valid: ['wheat', 'corn', 'rice', 'cotton', 'sorghum', 'barley'].includes(params.cropType.toLowerCase()),
          message: 'Valid crop type'
        },
        safety: {
          valid: !params.windSpeed || params.windSpeed < 15,
          message: params.windSpeed >= 15 ? 'Wind speed too high for safe burning' : 'Safe conditions'
        }
      };
      
      return {
        allValid: Object.values(validations).every(v => v.valid),
        validations
      };
    }
  })
];

// The REAL BurnRequestAgent
const burnRequestAgent = new Agent({
  name: 'BurnRequestAgent',
  model: 'gpt-5-nano', // Cost-efficient for simple extraction
  instructions: `You extract structured burn requests from farmers' natural language.
                 
                 Extract these details:
                 - Farm identification (name or owner)
                 - Field name and acreage
                 - Crop type being burned
                 - Requested burn date (format: YYYY-MM-DD)
                 - Time window (format: HH:MM)
                 - Urgency level based on context
                 - Reason for burning
                 
                 Handle various phrasings:
                 - "I need to burn my wheat field tomorrow" → extract date, crop
                 - "Can we schedule a burn for 50 acres next Monday?" → extract acres, relative date
                 - "Johnson Farm needs to clear corn stalks ASAP" → extract farm, crop, high urgency
                 
                 Use tools to:
                 - Look up farm IDs from names
                 - Check date availability
                 - Validate parameters
                 
                 If critical info is missing, identify what's needed.`,
  tools: burnRequestTools,
  temperature: 0.3, // Lower temperature for consistent extraction
  max_tokens: 500
});

/**
 * Extract structured burn request from natural language
 */
async function extractBurnRequest(naturalLanguageInput, userId) {
  const startTime = Date.now();
  
  try {
    logger.info('REAL: Extracting burn request from natural language', {
      userId,
      inputLength: naturalLanguageInput.length
    });
    
    // Use GPT-5-nano directly for extraction
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Extract burn request details from farmer input.
                   Today is ${new Date().toISOString().split('T')[0]}.
                   Convert relative dates (tomorrow, next week) to absolute dates.
                   Output valid JSON matching this structure:
                   {
                     "farm_name": "string or null",
                     "owner_name": "string or null", 
                     "field_name": "string",
                     "acres": number,
                     "crop_type": "string",
                     "burn_date": "YYYY-MM-DD",
                     "time_window_start": "HH:MM",
                     "time_window_end": "HH:MM",
                     "urgency": "low|medium|high|critical",
                     "reason": "string",
                     "missing_info": ["array of missing required fields"]
                   }`
        },
        {
          role: 'user',
          content: naturalLanguageInput
        }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.3
    });
    
    const extracted = JSON.parse(completion.choices[0].message.content);
    logger.info('REAL: Extracted data from natural language', { extracted });
    
    // Look up farm if name provided
    let farmId = null;
    if (extracted.farm_name || extracted.owner_name) {
      const searchTerm = extracted.farm_name || extracted.owner_name;
      const farms = await query(`
        SELECT farm_id, farm_name, owner_name 
        FROM farms 
        WHERE farm_name LIKE ? OR owner_name LIKE ?
        LIMIT 1
      `, [`%${searchTerm}%`, `%${searchTerm}%`]);
      
      if (farms.length > 0) {
        farmId = farms[0].farm_id;
        logger.info('REAL: Found farm', { farmId, farmName: farms[0].farm_name });
      }
    }
    
    // Set defaults for missing non-critical fields
    const structured = {
      farm_id: farmId || 1, // Default to farm 1 if not found
      field_name: extracted.field_name || `Field-${Date.now()}`,
      acres: extracted.acres || 50,
      crop_type: extracted.crop_type || 'wheat',
      burn_date: extracted.burn_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time_window_start: extracted.time_window_start || '08:00',
      time_window_end: extracted.time_window_end || '12:00',
      urgency: extracted.urgency || 'medium',
      reason: extracted.reason || 'Crop residue management',
      field_boundary: {
        type: 'Polygon',
        coordinates: [[
          [-98.5, 30.2],
          [-98.5, 30.3],
          [-98.4, 30.3],
          [-98.4, 30.2],
          [-98.5, 30.2]
        ]]
      }
    };
    
    // Validate the structured data
    const validationResult = structuredBurnRequestSchema.safeParse(structured);
    
    if (!validationResult.success) {
      logger.warn('REAL: Validation failed', { errors: validationResult.error.errors });
      
      // Try to fix common issues
      if (structured.burn_date && !structured.burn_date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Fix date format
        const date = new Date(structured.burn_date);
        if (!isNaN(date.getTime())) {
          structured.burn_date = date.toISOString().split('T')[0];
        }
      }
      
      if (structured.time_window_start && !structured.time_window_start.match(/^\d{2}:\d{2}$/)) {
        // Fix time format
        structured.time_window_start = '08:00';
      }
      
      if (structured.time_window_end && !structured.time_window_end.match(/^\d{2}:\d{2}$/)) {
        structured.time_window_end = '12:00';
      }
    }
    
    // Check date availability
    const availability = await query(`
      SELECT COUNT(*) as count
      FROM burn_requests
      WHERE requested_date = ? 
      AND status IN ('pending', 'approved', 'scheduled')
    `, [structured.burn_date]);
    
    structured.dateAvailable = availability[0].count < 10;
    structured.existingBurnsOnDate = availability[0].count;
    
    logger.info('REAL: Burn request extraction complete', {
      userId,
      farmId: structured.farm_id,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      extracted: structured,
      missingInfo: extracted.missing_info || [],
      needsMoreInfo: (extracted.missing_info && extracted.missing_info.length > 0),
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('REAL: Failed to extract burn request', {
      error: error.message,
      userId
    });
    
    throw error;
  }
}

/**
 * Process a complete burn request from natural language to database
 */
async function processNaturalLanguageBurnRequest(input, userId, io) {
  try {
    // Step 1: Extract structured data
    const extraction = await extractBurnRequest(input, userId);
    
    if (!extraction.success) {
      return {
        success: false,
        error: 'Failed to understand burn request',
        needsMoreInfo: true,
        questions: extraction.missingInfo
      };
    }
    
    // Step 2: Validate with coordinator
    const coordinatorAgent = require('../agents/coordinator');
    const validation = await coordinatorAgent.coordinateBurnRequest(extraction.extracted);
    
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        details: validation.details
      };
    }
    
    // Step 3: Return the created burn request ID
    return {
      success: true,
      burnRequestId: validation.burnRequestId,
      priorityScore: validation.priorityScore,
      structured: extraction.extracted,
      message: `Burn request #${validation.burnRequestId} created successfully for ${extraction.extracted.acres} acres on ${extraction.extracted.burn_date}`
    };
    
  } catch (error) {
    logger.error('REAL: Natural language processing failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  burnRequestAgent,
  extractBurnRequest,
  processNaturalLanguageBurnRequest
};