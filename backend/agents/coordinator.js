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
          crop_type,
          AVG(priority_score) as avg_priority,
          COUNT(*) as request_count,
          AVG(acres) as avg_acres
        FROM burn_requests 
        WHERE status = 'completed' 
        AND created_at > DATE_SUB(NOW(), INTERVAL 2 YEAR)
        GROUP BY crop_type
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
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = axios.create({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      logger.agent(this.agentName, 'debug', 'OpenAI client initialized for embeddings');
    } else {
      logger.agent(this.agentName, 'warn', 'OpenAI API key not found, using fallback embeddings');
    }
  }

  // Validation schema for burn requests
  getBurnRequestSchema() {
    return Joi.object({
      farm_id: Joi.number().integer().positive().required(),
      field_name: Joi.string().min(1).max(255).required(),
      field_boundary: Joi.object({
        type: Joi.string().valid('Polygon').required(),
        coordinates: Joi.array().items(
          Joi.array().items(
            Joi.array().items(Joi.number()).length(2)
          ).min(4)
        ).length(1).required()
      }).required(),
      acres: Joi.number().positive().max(10000).required(),
      crop_type: Joi.string().valid(
        'rice', 'wheat', 'corn', 'barley', 'oats', 'sorghum', 
        'cotton', 'soybeans', 'sunflower', 'other'
      ).required(),
      burn_date: Joi.date().min('now').max(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)).required(),
      time_window_start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      time_window_end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
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

  async validateBurnRequest(requestData) {
    const schema = this.getBurnRequestSchema();
    const { error, value } = schema.validate(requestData, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
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
    const farm = await query('SELECT id, name, owner_name FROM farms WHERE id = ?', [farmId]);
    
    if (farm.length === 0) {
      throw new ValidationError('Farm not found', 'farm_id');
    }
    
    // Additional authorization checks could be added here
    logger.agent(this.agentName, 'debug', `Farm authorization verified for ${farm[0].name}`);
    return farm[0];
  }

  async validateFieldGeometry(requestData) {
    try {
      // Validate polygon geometry using TiDB spatial functions
      const geometryCheck = await query(`
        SELECT 
          ST_IsValid(ST_GeomFromGeoJSON(?)) as is_valid,
          ST_Area(ST_GeomFromGeoJSON(?)) as area_m2
      `, [JSON.stringify(requestData.field_boundary), JSON.stringify(requestData.field_boundary)]);
      
      if (!geometryCheck[0].is_valid) {
        throw new ValidationError('Invalid field boundary geometry', 'field_boundary');
      }
      
      // Convert area from square meters to acres (1 acre = 4047 m²)
      const calculatedAcres = geometryCheck[0].area_m2 / 4047;
      const declaredAcres = requestData.acres;
      
      // Allow 10% variance between declared and calculated acreage
      if (Math.abs(calculatedAcres - declaredAcres) / declaredAcres > 0.1) {
        logger.agent(this.agentName, 'warn', 'Acreage mismatch detected', {
          declared: declaredAcres,
          calculated: calculatedAcres,
          variance: Math.abs(calculatedAcres - declaredAcres) / declaredAcres
        });
      }
      
      return {
        isValid: true,
        calculatedAcres,
        areaM2: geometryCheck[0].area_m2
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
      const vector = new Array(32).fill(0);
      
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
      
      // If OpenAI is available, enhance with semantic embeddings
      if (this.openaiClient) {
        const textDescription = this.createTextDescription(requestData);
        const embeddings = await this.getOpenAIEmbeddings(textDescription);
        
        // Use first 15 dimensions of OpenAI embeddings to enhance our vector
        for (let i = 0; i < Math.min(15, embeddings.length); i++) {
          vector[17 + i] = embeddings[i];
        }
      }
      
      // Normalize vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Burn vector generation failed', { error: error.message });
      // Return a basic vector if generation fails
      return new Array(32).fill(0.1);
    }
  }

  async getOpenAIEmbeddings(text) {
    try {
      const response = await this.openaiClient.post('/embeddings', {
        model: 'text-embedding-3-small',
        input: text,
        dimensions: 512
      });
      
      return response.data.data[0].embedding.slice(0, 15); // Use first 15 dimensions
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'OpenAI embeddings failed, using fallback', { error: error.message });
      return new Array(15).fill(0);
    }
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
      const result = await query(`
        INSERT INTO burn_requests (
          farm_id, field_name, field_boundary, acres, crop_type,
          burn_date, time_window_start, time_window_end, priority_score,
          burn_vector, status, created_at
        ) VALUES (?, ?, ST_GeomFromGeoJSON(?), ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [
        requestData.farm_id,
        requestData.field_name,
        JSON.stringify(requestData.field_boundary),
        requestData.acres,
        requestData.crop_type,
        requestData.burn_date,
        requestData.time_window_start,
        requestData.time_window_end,
        requestData.priority_score,
        JSON.stringify(requestData.burn_vector),
        requestData.status
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

  // Utility methods
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }

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