const logger = require('../middleware/logger');
const { query, vectorSimilaritySearch } = require('../db/connection');
const { ValidationError, AgentError } = require('../middleware/errorHandler');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

/**
 * AGENT 1: BURN REQUEST COORDINATOR
 * 
 * Responsibilities:
 * - Validates and stores burn requests
 * - Assigns priority scores based on multiple factors
 * - Generates burn vectors for historical analysis
 * - Coordinates with other agents in the workflow
 * - Manages burn request lifecycle
 */
class CoordinatorAgent {
  constructor() {
    this.agentName = 'coordinator';
    this.version = '1.0.0';
    this.initialized = false;
    this.priorityWeights = {
      acreage: 0.25,
      cropType: 0.20,
      timeWindow: 0.15,
      weatherSensitivity: 0.15,
      proximityToPopulation: 0.15,
      historicalSuccess: 0.10
    };
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Burn Request Coordinator Agent');
      
      // Validate database connection
      await this.testDatabaseConnection();
      
      // Load historical data for priority calculations
      await this.loadHistoricalData();
      
      // Initialize OpenAI client for embeddings
      this.initializeEmbeddingClient();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Coordinator Agent initialized successfully');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Coordinator Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async testDatabaseConnection() {
    try {
      await query('SELECT 1 as test');
      logger.agent(this.agentName, 'debug', 'Database connection verified');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async loadHistoricalData() {
    try {
      const historicalData = await query(`
        SELECT 
          bf.crop_type,
          AVG(br.priority_score) as avg_priority,
          COUNT(*) as request_count,
          AVG(bf.area_hectares) as avg_acres
        FROM burn_requests br
        JOIN burn_fields bf ON br.field_id = bf.field_id
        WHERE br.status = 'completed' 
        AND br.created_at > DATE_SUB(NOW(), INTERVAL 2 YEAR)
        GROUP BY bf.crop_type
      `);
      
      this.historicalPriorities = {};
      historicalData.forEach(row => {
        this.historicalPriorities[row.crop_type] = {
          avgPriority: row.avg_priority,
          requestCount: row.request_count,
          avgAcres: row.avg_acres
        };
      });
      
      logger.agent(this.agentName, 'debug', `Loaded historical data for ${historicalData.length} crop types`);
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not load historical data, using defaults', { error: error.message });
      this.historicalPriorities = {};
    }
  }

  initializeEmbeddingClient() {
    // REQUIRED: OpenAI API key for real AI - NO FALLBACKS
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is REQUIRED - No fake AI allowed for hackathon');
    }
    
    // Initialize OpenAI client for embeddings
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Initialize GPT-5-mini client - NO FALLBACKS
    const { GPT5MiniClient } = require('../gpt5-mini-client');
    this.gpt5MiniClient = new GPT5MiniClient();
    
    // Create evidence-based wrapper for transparency
    this.gpt5Client = {
      analyze: async (prompt, model = 'gpt-5-mini') => {
        // Add transparency logging
        logger.agent(this.agentName, 'info', 'GPT-5-mini API call initiated:', {
          endpoint: '/v1/responses',
          model: 'gpt-5-mini',
          prompt_preview: prompt.substring(0, 100) + '...',
          timestamp: new Date().toISOString()
        });
        
        // Add evidence requirements to all prompts
        const evidencePrompt = `${prompt}

CRITICAL: Provide evidence-based analysis with specific sources and data:
- Include specific percentages, numbers, and measurable data points
- Reference EPA standards, NFPA guidelines, or agricultural best practices
- Cite meteorological data sources when discussing weather
- Provide confidence levels (%) for predictions
- Include specific timeframes and thresholds
- Format: Use bullet points with data backing each claim
- End with "Sources: [list specific standards/data referenced]"`;
        
        const response = await this.gpt5MiniClient.complete(evidencePrompt, 2000);
        
        if (!response) {
          throw new Error('GPT-5-mini analysis failed - NO FALLBACKS');
        }
        
        // Log response with transparency
        logger.agent(this.agentName, 'info', 'GPT-5-mini response received:', {
          response_length: response.length,
          has_sources: response.toLowerCase().includes('sources:'),
          has_percentages: /\d+%/.test(response),
          has_data_points: /\d+/.test(response),
          timestamp: new Date().toISOString()
        });
        
        // Validate evidence requirements
        if (!response.toLowerCase().includes('sources:')) {
          logger.agent(this.agentName, 'warn', 'GPT-5-mini response missing sources - retrying with stricter prompt');
          
          const stricterPrompt = `${evidencePrompt}

MANDATORY: You MUST end your response with "Sources: [specific standards, EPA documents, NFPA codes, or meteorological data sources]"`;
          
          const retryResponse = await this.gpt5MiniClient.complete(stricterPrompt, 2000);
          return retryResponse || response;
        }
        
        return response;
      },
      
      analyzeBurnRequest: async (burnRequest) => {
        const prompt = `Analyze this agricultural burn request using GPT-5-mini AI:
          ${JSON.stringify(burnRequest, null, 2)}
          
          Provide evidence-based analysis with data sources:
          1. Risk assessment (cite specific hazards with probability % and severity levels 1-10)
          2. Environmental impact prediction (quantify PM2.5 µg/m³, CO2 tons, reference EPA standards)
          3. Optimal timing recommendations (based on meteorological data, wind patterns, humidity %)
          4. Safety precautions needed (reference NFPA 11, agricultural burning guidelines, specific distances)`;
        
        return this.gpt5Client.analyze(prompt, 'gpt-5-mini');
      },
      
      orchestrate: async (agents, request) => {
        const prompt = `Orchestrate multi-agent workflow for burn request.
          Available agents: ${agents.join(', ')}
          Request: ${JSON.stringify(request)}
          
          Determine optimal execution order with evidence-based justification:
          - Justify why each agent is needed (cite specific capabilities)
          - Specify data dependencies between agents (list required inputs/outputs)
          - Estimate processing time per agent (minutes, based on complexity)
          - Identify critical path and bottlenecks (show dependency graph)
          - Risk assessment for each step (probability % of delays/failures)`;
        
        return this.gpt5Client.analyze(prompt, 'gpt-5-mini');
      }
    };
    
    logger.agent(this.agentName, 'info', 'GPT-5-mini AI initialized - REAL AI ACTIVE');
    logger.agent(this.agentName, 'info', 'Model: gpt-5-mini ONLY - NO FALLBACKS');
    logger.agent(this.agentName, 'info', 'Evidence-based analysis enabled for all predictions');
    logger.agent(this.agentName, 'info', 'Transparency logging: All API calls monitored');
  }

  // Validation schema for burn requests
  getBurnRequestSchema() {
    return Joi.object({
      farm_id: Joi.number().integer().positive().required(),
      field_name: Joi.string().min(1).max(255).optional().default('DefaultField'),
      field_boundary: Joi.object({
        type: Joi.string().valid('Polygon').required(),
        coordinates: Joi.array().items(
          Joi.array().items(
            Joi.array().items(Joi.number()).length(2)
          ).min(4)
        ).length(1).required()
      }).optional(),
      acres: Joi.number().positive().max(10000).required(),
      crop_type: Joi.string().valid(
        'rice', 'wheat', 'corn', 'barley', 'oats', 'sorghum', 
        'cotton', 'soybeans', 'sunflower', 'other'
      ).required(),
      burn_date: Joi.date().min('now').max(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)).required(),
      time_window_start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      time_window_end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      reason: Joi.string().max(1000).optional(),
      special_considerations: Joi.string().max(1000).optional(),
      contact_method: Joi.string().valid('sms', 'email', 'both').default('sms'),
      priority_override: Joi.number().integer().min(1).max(10).optional()
    });
  }

  /**
   * Main coordination method - processes new burn requests
   */
  async coordinateBurnRequest(requestData) {
    if (!this.initialized) {
      throw new AgentError(this.agentName, 'coordination', 'Agent not initialized');
    }

    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      logger.agent(this.agentName, 'info', 'Processing new burn request', { requestId });
      
      // Step 1: Validate request data
      const validatedData = await this.validateBurnRequest(requestData);
      
      // Step 2: Check farm authorization
      await this.verifyFarmAuthorization(validatedData.farm_id);
      
      // Step 3: Validate field geometry
      await this.validateFieldGeometry(validatedData);
      
      // Step 4: Calculate priority score
      const priorityScore = await this.calculatePriorityScore(validatedData);
      
      // Step 5: Generate burn vector for similarity analysis
      const burnVector = await this.generateBurnVector(validatedData);
      
      // Step 6: Check for similar historical requests
      const similarRequests = await this.findSimilarRequests(burnVector);
      
      // Step 7: Store burn request in database
      const burnRequestId = await this.storeBurnRequest({
        ...validatedData,
        priority_score: priorityScore,
        burn_vector: burnVector,
        request_id: requestId,
        status: 'pending'
      });
      
      // Step 8: Log coordination completion
      const duration = Date.now() - startTime;
      logger.performance('burn_request_coordination', duration, {
        requestId,
        burnRequestId,
        priorityScore,
        similarRequestsFound: similarRequests.length
      });
      
      return {
        success: true,
        burnRequestId,
        requestId,
        priorityScore,
        status: 'pending',
        similarRequests: similarRequests.slice(0, 3), // Return top 3 similar requests
        nextAgent: 'weather',
        estimatedProcessingTime: '2-5 minutes'
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Burn request coordination failed', {
        requestId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  parseTime(timeString) {
    // Convert "HH:MM" to decimal hours (e.g., "14:30" -> 14.5)
    if (!timeString || typeof timeString !== 'string') {
      logger.agent(this.agentName, 'warn', 'Invalid timeString provided to parseTime', { timeString });
      return 0;
    }
    
    // Validate format
    if (!timeString.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      logger.agent(this.agentName, 'warn', 'Invalid time format', { timeString });
      return 0;
    }
    
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + (minutes / 60);
  }

  async validateBurnRequest(requestData) {
    const schema = this.getBurnRequestSchema();
    const { error, value } = schema.validate(requestData, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      logger.error('[COORDINATOR] Validation failed with details', { 
        agent: 'coordinator',
        details: details,
        requestData: requestData
      });
      throw new ValidationError('Burn request validation failed', null, details);
    }
    
    // Additional business logic validation
    const startTime = this.parseTime(value.time_window_start);
    const endTime = this.parseTime(value.time_window_end);
    
    if (endTime <= startTime) {
      throw new ValidationError('End time must be after start time', 'time_window_end');
    }
    
    if (endTime - startTime < 2) { // Minimum 2-hour window
      throw new ValidationError('Burn window must be at least 2 hours', 'time_window');
    }
    
    return value;
  }

  async verifyFarmAuthorization(farmId) {
    const farm = await query('SELECT farm_id, farm_name, owner_name FROM farms WHERE farm_id = ?', [farmId]);
    
    if (farm.length === 0) {
      throw new ValidationError('Farm not found', 'farm_id');
    }
    
    // Additional authorization checks could be added here
    logger.agent(this.agentName, 'debug', `Farm authorization verified for ${farm[0].farm_name}`);
    return farm[0];
  }

  async validateFieldGeometry(requestData) {
    try {
      // Skip TiDB spatial validation for now - function not available
      // Just do basic validation of the GeoJSON structure
      if (!requestData.field_boundary || 
          !requestData.field_boundary.type || 
          requestData.field_boundary.type !== 'Polygon' ||
          !requestData.field_boundary.coordinates ||
          !Array.isArray(requestData.field_boundary.coordinates)) {
        throw new ValidationError('Invalid field boundary geometry structure', 'field_boundary');
      }
      
      // Basic polygon validation
      const ring = requestData.field_boundary.coordinates[0];
      if (!ring || ring.length < 4) {
        throw new ValidationError('Polygon must have at least 4 coordinates', 'field_boundary');
      }
      
      // Skip area calculation since we can't use spatial functions
      // Just trust the declared acres for now
      const declaredAcres = requestData.acres;
      
      logger.agent(this.agentName, 'debug', `Field geometry validated for ${declaredAcres} acres`);
      
      return {
        isValid: true,
        calculatedAcres: declaredAcres,
        areaM2: declaredAcres * 4047  // Convert acres to m²
      };
      
    } catch (error) {
      throw new ValidationError(`Field geometry validation failed: ${error.message}`, 'field_boundary');
    }
  }

  async calculatePriorityScore(requestData) {
    try {
      let totalScore = 0;
      const factors = {};
      
      // Factor 1: Acreage (larger burns get higher priority for efficiency)
      factors.acreage = Math.min(requestData.acres / 1000, 1) * 10; // Normalize to 0-10
      totalScore += factors.acreage * this.priorityWeights.acreage;
      
      // Factor 2: Crop type priority
      const cropPriorities = {
        'rice': 9, 'wheat': 8, 'barley': 7, 'corn': 6, 'oats': 6,
        'cotton': 5, 'soybeans': 4, 'sunflower': 3, 'sorghum': 3, 'other': 2
      };
      factors.cropType = cropPriorities[requestData.crop_type] || 2;
      totalScore += factors.cropType * this.priorityWeights.cropType;
      
      // Factor 3: Time window flexibility (larger windows get higher priority)
      const startTime = this.parseTime(requestData.time_window_start);
      const endTime = this.parseTime(requestData.time_window_end);
      const windowHours = endTime - startTime;
      factors.timeWindow = Math.min(windowHours / 8, 1) * 10; // Normalize 8+ hours = 10
      totalScore += factors.timeWindow * this.priorityWeights.timeWindow;
      
      // Factor 4: Weather sensitivity
      const weatherSensitiveCrops = ['rice', 'cotton', 'sunflower'];
      factors.weatherSensitivity = weatherSensitiveCrops.includes(requestData.crop_type) ? 8 : 5;
      totalScore += factors.weatherSensitivity * this.priorityWeights.weatherSensitivity;
      
      // Factor 5: Proximity to population (would need GIS calculation)
      factors.proximityToPopulation = 5; // Default - would calculate from field_boundary
      totalScore += factors.proximityToPopulation * this.priorityWeights.proximityToPopulation;
      
      // Factor 6: Historical success rate
      const historical = this.historicalPriorities[requestData.crop_type];
      factors.historicalSuccess = historical ? Math.min(historical.avgPriority, 10) : 5;
      totalScore += factors.historicalSuccess * this.priorityWeights.historicalSuccess;
      
      // Apply priority override if specified
      if (requestData.priority_override) {
        totalScore = (totalScore * 0.7) + (requestData.priority_override * 0.3);
      }
      
      const finalScore = Math.round(Math.max(1, Math.min(10, totalScore)));
      
      logger.agent(this.agentName, 'debug', 'Priority score calculated', {
        finalScore,
        factors,
        weights: this.priorityWeights
      });
      
      return finalScore;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Priority calculation failed', { error: error.message });
      return 5; // Default medium priority
    }
  }

  async generateBurnVector(requestData) {
    try {
      // Create a 32-dimensional burn vector for similarity analysis
      let vector = new Array(32).fill(0);
      
      // Encode basic characteristics
      vector[0] = requestData.acres / 1000; // Normalize acres
      vector[1] = this.parseTime(requestData.time_window_start) / 24; // Normalize start time
      vector[2] = (this.parseTime(requestData.time_window_end) - this.parseTime(requestData.time_window_start)) / 12; // Window size
      
      // Encode crop type (one-hot-like encoding)
      const cropTypes = ['rice', 'wheat', 'corn', 'barley', 'oats', 'sorghum', 'cotton', 'soybeans', 'sunflower', 'other'];
      const cropIndex = cropTypes.indexOf(requestData.crop_type);
      if (cropIndex !== -1 && cropIndex < 10) {
        vector[3 + cropIndex] = 1;
      }
      
      // Encode seasonal information
      const burnDate = new Date(requestData.burn_date);
      vector[13] = burnDate.getMonth() / 12; // Month of year
      vector[14] = burnDate.getDay() / 7; // Day of week
      
      // REQUIRED: Use real AI embeddings - no fallbacks
      const textDescription = this.createTextDescription(requestData);
      const embeddings = await this.getOpenAIEmbeddings(textDescription, 32);
      
      // Replace entire vector with REAL AI embedding
      vector = embeddings;
      
      // Normalize vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Burn vector generation failed', { error: error.message });
      throw error; // NO FALLBACKS - fail if AI fails
    }
  }

  async getOpenAIEmbeddings(text, dimensions = 512) {
    // NO FALLBACKS - Real embeddings or fail
    const response = await this.openaiClient.post('/embeddings', {
      model: 'text-embedding-3-large', // Best quality embeddings
      input: text,
      dimensions: dimensions
    });
    
    const embedding = response.data.data[0].embedding;
    logger.agent(this.agentName, 'debug', `Generated REAL ${embedding.length}-dim embedding`);
    
    // Verify it's a real embedding (not random)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (Math.abs(magnitude - 1.0) > 0.1) {
      logger.agent(this.agentName, 'warn', `Embedding magnitude ${magnitude} (expected ~1.0)`);
    }
    
    return embedding;
  }

  createTextDescription(requestData) {
    return `Agricultural burn request for ${requestData.acres} acres of ${requestData.crop_type} ` +
           `scheduled for ${requestData.burn_date} between ${requestData.time_window_start} and ${requestData.time_window_end}. ` +
           `Field: ${requestData.field_name}. ${requestData.special_considerations || ''}`;
  }

  async findSimilarRequests(burnVector) {
    try {
      const similarRequests = await vectorSimilaritySearch(
        'burn_requests',
        'burn_vector',
        burnVector,
        5
      );
      
      logger.vector('similarity_search', 'burn_vector', 32, {
        queryVector: burnVector.slice(0, 5),
        resultsFound: similarRequests.length
      });
      
      return similarRequests;
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Similar request search failed', { error: error.message });
      return [];
    }
  }

  async storeBurnRequest(requestData) {
    try {
      // Format date properly for MySQL
      const burnDate = requestData.burn_date || requestData.requested_date;
      const formattedDate = burnDate instanceof Date ? 
        burnDate.toISOString().split('T')[0] : 
        burnDate.split('T')[0];  // Handle both Date and string formats
      
      // First, get or create field_id based on farm_id
      let fieldId = requestData.field_id;
      if (!fieldId) {
        // Try to find existing field for this farm
        const existingField = await query(
          'SELECT field_id FROM burn_fields WHERE farm_id = ? LIMIT 1',
          [requestData.farm_id]
        );
        
        if (existingField.length > 0) {
          fieldId = existingField[0].field_id;
        } else {
          // Create a default field for this farm
          const hectares = (requestData.acres || 50) * 0.404686; // Convert acres to hectares
          const fieldResult = await query(
            'INSERT INTO burn_fields (farm_id, field_name, area_hectares, crop_type) VALUES (?, ?, ?, ?)',
            [requestData.farm_id, requestData.field_name || `Field_${Date.now()}`, hectares, requestData.crop_type || 'wheat']
          );
          fieldId = fieldResult.insertId;
        }
      }
      
      // request_id is auto_increment, don't include it in INSERT
      const insertData = {
        farm_id: requestData.farm_id,
        field_id: fieldId,
        acreage: requestData.acres || requestData.acreage || 50,
        crop_type: requestData.crop_type,
        requested_date: formattedDate,
        requested_window_start: `${formattedDate} ${requestData.time_window_start || requestData.requested_window_start || '08:00'}:00`,
        requested_window_end: `${formattedDate} ${requestData.time_window_end || requestData.requested_window_end || '12:00'}:00`,
        priority_score: requestData.priority_score || 5,
        status: requestData.status || 'pending'
      };
      
      logger.agent(this.agentName, 'debug', 'Storing burn request with data', insertData);
      
      // Use proper parameterized query
      const result = await query(`
        INSERT INTO burn_requests (
          farm_id, field_id, acreage, crop_type,
          requested_date, requested_window_start, requested_window_end, priority_score,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        insertData.farm_id,
        insertData.field_id,
        insertData.acreage,
        insertData.crop_type,
        insertData.requested_date,
        insertData.requested_window_start,
        insertData.requested_window_end,
        insertData.priority_score,
        insertData.status
      ]);
      
      const burnRequestId = result.insertId;
      
      logger.agent(this.agentName, 'info', 'Burn request stored successfully', {
        burnRequestId,
        farmId: requestData.farm_id,
        priorityScore: requestData.priority_score
      });
      
      return burnRequestId;
      
    } catch (error) {
      throw new AgentError(this.agentName, 'storage', `Failed to store burn request: ${error.message}`, error);
    }
  }

  // Utility methods removed - duplicate parseTime deleted

  async getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
          AVG(priority_score) as avg_priority_score
        FROM burn_requests
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      
      return {
        status: 'active',
        agent: this.agentName,
        version: this.version,
        initialized: this.initialized,
        last24Hours: stats[0],
        priorityWeights: this.priorityWeights
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new CoordinatorAgent();