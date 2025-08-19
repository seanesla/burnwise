const logger = require('../middleware/logger');
const { query, vectorSimilaritySearch, spatialQuery } = require('../db/connection');
const { AgentError } = require('../middleware/errorHandler');
const math = require('mathjs');

/**
 * AGENT 3: SMOKE DISPERSION PREDICTOR
 * 
 * Responsibilities:
 * - Calculates smoke dispersion using Gaussian plume model
 * - Generates 64-dimensional smoke plume vectors
 * - Detects potential conflicts with other burns
 * - Predicts PM2.5 concentrations at various distances
 * - Calculates maximum dispersion radius and affected areas
 * - Provides safety recommendations based on dispersion modeling
 */
class PredictorAgent {
  constructor() {
    this.agentName = 'predictor';
    this.version = '1.0.0';
    this.initialized = false;
    
    // Gaussian plume model parameters
    this.stabilityClasses = {
      'A': { sigmay: [213, 440.8, 1998], sigmaz: [440.8, 96.6, -1.7] }, // Very unstable
      'B': { sigmay: [156, 106.6, 1.35], sigmaz: [106.6, 60.0, -1.3] }, // Unstable
      'C': { sigmay: [104, 61.0, 1.26], sigmaz: [61.0, 34.3, -1.1] },  // Slightly unstable
      'D': { sigmay: [68, 44.5, 1.08], sigmaz: [44.5, 24.4, -0.96] },  // Neutral
      'E': { sigmay: [50.5, 55.4, 1.01], sigmaz: [55.4, 15.0, -0.76] }, // Slightly stable
      'F': { sigmay: [34, 62.6, 1.26], sigmaz: [62.6, 12.0, -0.54] }   // Stable
    };
    
    // EPA PM2.5 standards (µg/m³)
    this.pm25Standards = {
      daily: 35,      // 24-hour average
      annual: 12,     // Annual average  
      unhealthy: 55,  // Unhealthy for sensitive groups
      hazardous: 250  // Hazardous levels
    };
    
    // Emission factors for different crop types (kg PM2.5 per ton burned)
    this.emissionFactors = {
      'rice': 3.2,
      'wheat': 2.8,
      'corn': 2.1,
      'barley': 2.6,
      'oats': 2.4,
      'cotton': 4.1,
      'soybeans': 1.8,
      'sunflower': 2.3,
      'sorghum': 2.5,
      'other': 2.5
    };
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Smoke Dispersion Predictor with GPT-5 AI');
      
      // Initialize GPT-5-mini for intelligent dispersion analysis
      await this.initializeAI();
      
      // Validate mathematical capabilities
      await this.testMathCapabilities();
      
      // Load historical dispersion data
      await this.loadHistoricalDispersionData();
      
      // Initialize wind rose data
      await this.initializeWindRoseData();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Predictor Agent initialized with GPT-5-mini + Gaussian Plume');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Predictor Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async initializeAI() {
    try {
      const { GPT5MiniClient } = require('../gpt5-mini-client');
      this.gpt5Client = new GPT5MiniClient();
      
      // Test GPT-5-mini connection
      const testResponse = await this.gpt5Client.complete(
        'You are a smoke dispersion expert AI. Respond with: Ready to analyze dispersion patterns',
        30
      );
      
      if (testResponse) {
        logger.agent(this.agentName, 'info', 'GPT-5-mini AI verified for smoke dispersion analysis');
      } else {
        throw new Error('GPT-5-mini test failed - NO FALLBACKS');
      }
    } catch (error) {
      throw new Error(`GPT-5-mini REQUIRED for intelligent dispersion analysis: ${error.message}`);
    }
  }

  async testMathCapabilities() {
    try {
      // Test complex mathematical operations required for Gaussian plume model
      const testMatrix = math.matrix([[1, 2], [3, 4]]);
      const testCalc = math.evaluate('sqrt(2 * pi)');
      
      if (testCalc < 2.5 || testCalc > 2.6) {
        throw new Error('Mathematical library test failed');
      }
      
      logger.agent(this.agentName, 'debug', 'Mathematical capabilities verified');
    } catch (error) {
      throw new Error(`Mathematical test failed: ${error.message}`);
    }
  }

  async loadHistoricalDispersionData() {
    try {
      const historicalData = await query(`
        SELECT 
          pm.max_dispersion_radius as dispersion_radius_km,
          pm.confidence_score,
          br.crop_type,
          br.acreage,
          wd.wind_speed,
          wd.wind_direction,
          wd.temperature,
          wd.weather_condition
        FROM burn_smoke_predictions pm
        JOIN burn_requests br ON pm.request_id = br.request_id
        JOIN weather_data wd ON DATE(pm.created_at) = DATE(wd.timestamp)
        WHERE pm.created_at > DATE_SUB(NOW(), INTERVAL 1 YEAR)
        AND pm.confidence_score > 0.7
      `);
      
      this.historicalDispersions = historicalData;
      
      logger.agent(this.agentName, 'debug', `Loaded ${historicalData.length} historical dispersion records`);
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not load historical dispersion data', { error: error.message });
      this.historicalDispersions = [];
    }
  }

  async initializeWindRoseData() {
    try {
      // Load wind rose data for better directional predictions
      const windData = await query(`
        SELECT 
          FLOOR(wind_direction / 45) * 45 as direction_sector,
          AVG(wind_speed) as avg_speed,
          COUNT(*) as frequency
        FROM weather_data
        WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 YEAR)
        GROUP BY direction_sector
        ORDER BY direction_sector
      `);
      
      this.windRose = {};
      windData.forEach(row => {
        this.windRose[row.direction_sector] = {
          avgSpeed: row.avg_speed,
          frequency: row.frequency
        };
      });
      
      logger.agent(this.agentName, 'debug', 'Wind rose data initialized', {
        sectors: Object.keys(this.windRose).length
      });
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not initialize wind rose data', { error: error.message });
      this.windRose = {};
    }
  }

  /**
   * Main prediction method for smoke dispersion analysis
   */
  async predictSmokeDispersion(burnRequestId, burnData, weatherData) {
    if (!this.initialized) {
      throw new AgentError(this.agentName, 'prediction', 'Agent not initialized');
    }

    const startTime = Date.now();
    
    try {
      logger.agent(this.agentName, 'info', 'Predicting smoke dispersion', {
        burnRequestId,
        acres: burnData.acres,
        cropType: burnData.crop_type
      });
      
      // Step 1: Calculate emission rate
      const emissionRate = this.calculateEmissionRate(burnData);
      
      // Step 2: Determine atmospheric stability class
      const stabilityClass = this.determineStabilityClass(weatherData);
      
      // Step 3: Run Gaussian plume model
      const plumeModel = await this.runGaussianPlumeModel(
        emissionRate,
        weatherData,
        stabilityClass,
        burnData.field_boundary
      );
      
      // Step 4: Calculate PM2.5 concentrations at various distances
      const concentrationMap = this.calculateConcentrationMap(plumeModel, weatherData);
      
      // Step 5: Determine maximum dispersion radius
      const maxDispersionRadius = this.calculateMaxDispersionRadius(concentrationMap);
      
      // Step 6: Generate affected area polygon
      const affectedArea = this.generateAffectedAreaPolygon(
        burnData.field_boundary,
        plumeModel,
        weatherData.windDirection
      );
      
      // Step 7: Generate 64D plume vector
      const plumeVector = await this.generatePlumeVector(
        plumeModel,
        weatherData,
        burnData,
        concentrationMap
      );
      
      // Step 8: Check for conflicts with other burns (only if we have a date)
      const burnDate = burnData.burn_date || burnData.requested_date || null;
      let conflicts = [];
      if (burnDate) {
        conflicts = await this.detectBurnConflicts(
          affectedArea,
          burnDate,
          plumeVector
        );
      } else {
        logger.agent(this.agentName, 'info', 'Skipping conflict detection - no burn date provided');
      }
      
      // Step 9: Calculate confidence score
      const confidenceScore = this.calculatePredictionConfidence(
        plumeModel,
        weatherData,
        burnData
      );
      
      // Step 9.5: Get AI analysis of dispersion safety (evidence-based)
      const aiSafetyAnalysis = await this.analyzeDispersionWithAI(
        concentrationMap,
        maxDispersionRadius,
        conflicts,
        weatherData,
        burnData
      );
      
      // Step 10: Store prediction results (only if we have a valid request ID)
      let predictionId = null;
      if (burnRequestId && burnRequestId > 0) {
        predictionId = await this.storePredictionResults({
          burnRequestId,
          plumeModel,
          maxDispersionRadius,
          affectedArea,
          concentrationMap,
          plumeVector,
          confidenceScore
        });
      } else {
        logger.agent(this.agentName, 'info', 'Skipping database storage - no valid request ID');
      }
      
      const duration = Date.now() - startTime;
      logger.performance('smoke_dispersion_prediction', duration, {
        burnRequestId,
        predictionId,
        maxRadius: maxDispersionRadius,
        conflictsFound: conflicts.length
      });
      
      return {
        success: true,
        burnRequestId,
        predictionId,
        emissionRate,
        stabilityClass,
        maxDispersionRadius,
        affectedArea,
        concentrationMap: this.summarizeConcentrationMap(concentrationMap),
        plumeVector,
        conflicts,
        confidenceScore,
        aiSafetyAnalysis,  // Include GPT-5 evidence-based analysis
        recommendations: this.generateSafetyRecommendations(concentrationMap, conflicts),
        nextAgent: 'optimizer'
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Smoke dispersion prediction failed', {
        burnRequestId,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  calculateEmissionRate(burnData) {
    try {
      // Calculate total biomass to be burned (tons per acre varies by crop)
      const biomassPerAcre = {
        'rice': 2.5,
        'wheat': 2.0,
        'corn': 3.0,
        'barley': 1.8,
        'oats': 1.6,
        'cotton': 1.2,
        'soybeans': 1.4,
        'sunflower': 1.5,
        'sorghum': 2.2,
        'other': 2.0
      };
      
      // Handle both 'acres' and 'acreage' field names
      const acres = burnData.acres || burnData.acreage || 0;
      if (!acres || acres <= 0) {
        throw new Error('Invalid acreage value');
      }
      
      const totalBiomass = acres * (biomassPerAcre[burnData.crop_type] || 2.0);
      const emissionFactor = this.emissionFactors[burnData.crop_type] || 2.5;
      
      // Total PM2.5 emissions (kg)
      const totalEmissions = totalBiomass * emissionFactor;
      
      // Estimate burn duration (hours) based on acreage
      const burnDuration = Math.max(2, Math.min(8, acres / 50));
      
      // Emission rate (g/s)
      const emissionRate = (totalEmissions * 1000) / (burnDuration * 3600);
      
      logger.algorithm('gaussian_plume', 'emission_calculation', 'Emission rate calculated', {
        totalBiomass,
        totalEmissions,
        burnDuration,
        emissionRate
      });
      
      return {
        totalEmissions,
        emissionRate,
        burnDuration,
        biomassPerAcre: biomassPerAcre[burnData.crop_type] || 2.0
      };
      
    } catch (error) {
      throw new AgentError(this.agentName, 'emission_calculation', error.message, error);
    }
  }

  determineStabilityClass(weatherData) {
    try {
      // Pasquill-Gifford stability classification
      // Handle multiple field name variations
      const windSpeedMph = weatherData.windSpeed || weatherData.wind_speed_mph || weatherData.wind_speed || 5;
      const windSpeed = windSpeedMph * 0.44704; // Convert mph to m/s
      const cloudCover = weatherData.cloudCover || weatherData.cloud_cover || 50;
      const hour = weatherData.timestamp ? new Date(weatherData.timestamp).getHours() : new Date().getHours();
      const isDaytime = hour >= 6 && hour <= 18;
      
      // Solar radiation estimation based on cloud cover and time
      let solarRadiation;
      if (isDaytime) {
        if (cloudCover < 25) {
          solarRadiation = 'strong';
        } else if (cloudCover < 50) {
          solarRadiation = 'moderate';
        } else {
          solarRadiation = 'slight';
        }
      } else {
        solarRadiation = 'none';
      }
      
      // Determine stability class
      let stabilityClass;
      
      if (windSpeed < 2) {
        if (solarRadiation === 'strong') stabilityClass = 'A';
        else if (solarRadiation === 'moderate') stabilityClass = 'B';
        else if (solarRadiation === 'slight') stabilityClass = 'C';
        else stabilityClass = 'F'; // Nighttime
      } else if (windSpeed < 3) {
        if (solarRadiation === 'strong') stabilityClass = 'B';
        else if (solarRadiation === 'moderate') stabilityClass = 'C';
        else if (solarRadiation === 'slight') stabilityClass = 'D';
        else stabilityClass = 'E'; // Nighttime
      } else if (windSpeed < 5) {
        if (solarRadiation === 'strong') stabilityClass = 'C';
        else if (solarRadiation === 'moderate') stabilityClass = 'D';
        else stabilityClass = 'D';
      } else if (windSpeed < 6) {
        stabilityClass = 'D';
      } else {
        stabilityClass = 'D';
      }
      
      logger.algorithm('gaussian_plume', 'stability_classification', 'Stability class determined', {
        windSpeed: windSpeed.toFixed(2),
        cloudCover,
        solarRadiation,
        stabilityClass,
        isDaytime
      });
      
      return stabilityClass;
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Stability classification failed, using default', { error: error.message });
      return 'D'; // Default neutral stability
    }
  }

  async runGaussianPlumeModel(emissionRate, weatherData, stabilityClass, fieldBoundary) {
    try {
      const windSpeed = Math.max(1, weatherData.windSpeed * 0.44704); // Convert mph to m/s, minimum 1 m/s
      const windDirection = weatherData.windDirection * Math.PI / 180; // Convert to radians
      
      // Get stability parameters
      const stability = this.stabilityClasses[stabilityClass];
      
      // Calculate effective source height (m) - includes buoyancy rise
      const stackHeight = 2; // Assumed ground-level burn
      const buoyancyRise = this.calculateBuoyancyRise(emissionRate.emissionRate, weatherData);
      const effectiveHeight = stackHeight + buoyancyRise;
      
      // Calculate dispersion coefficients for various distances
      const distances = [100, 250, 500, 1000, 2000, 5000, 10000]; // meters
      const plumeData = [];
      
      for (const distance of distances) {
        // Calculate sigma_y and sigma_z (dispersion parameters)
        const sigmaY = this.calculateSigmaY(distance, stability.sigmay);
        const sigmaZ = this.calculateSigmaZ(distance, stability.sigmaz);
        
        // Calculate centerline concentration (µg/m³)
        const concentration = this.calculateCenterlineConcentration(
          emissionRate.emissionRate,
          windSpeed,
          sigmaY,
          sigmaZ,
          effectiveHeight,
          distance
        );
        
        // Calculate lateral spread at this distance
        const lateralSpread = 2 * sigmaY; // 95% of plume within ±2σ
        
        plumeData.push({
          distance,
          concentration,
          sigmaY,
          sigmaZ,
          lateralSpread,
          effectiveWidth: lateralSpread * 2
        });
      }
      
      logger.algorithm('gaussian_plume', 'model_execution', 'Plume model calculated', {
        stabilityClass,
        effectiveHeight,
        windSpeed: windSpeed.toFixed(2),
        maxConcentration: Math.max(...plumeData.map(p => p.concentration)).toFixed(2)
      });
      
      return {
        effectiveHeight,
        windSpeed,
        windDirection,
        stabilityClass,
        plumeData,
        buoyancyRise
      };
      
    } catch (error) {
      throw new AgentError(this.agentName, 'plume_modeling', error.message, error);
    }
  }

  calculateBuoyancyRise(emissionRate, weatherData) {
    // Simplified buoyancy rise calculation for agricultural burns
    const ambientTemp = (weatherData.temperature - 32) * 5/9 + 273.15; // Convert F to K
    const sourceTemp = ambientTemp + 400; // Estimated flame temperature rise
    const stackDiameter = Math.sqrt(emissionRate / 1000); // Rough estimate based on emission rate
    
    // Holland formula for buoyancy rise
    const g = 9.81; // gravity
    const buoyancyFlux = g * (sourceTemp - ambientTemp) / ambientTemp * emissionRate * 0.001;
    const buoyancyRise = Math.min(100, buoyancyFlux / (Math.PI * stackDiameter * weatherData.windSpeed * 0.44704));
    
    return Math.max(0, buoyancyRise);
  }

  calculateSigmaY(distance, params) {
    // Distance in meters
    // If params is an object with sigmay property, extract it
    if (params && params.sigmay) {
      params = params.sigmay;
    }
    // Ensure params is an array with at least 3 elements
    if (!Array.isArray(params) || params.length < 3) {
      params = [68, 44.5, 1.08]; // Default to neutral stability (D)
    }
    const x = Math.max(0.1, distance / 1000); // Convert to km, minimum 0.1 km
    // Pasquill-Gifford parameterization
    const sigma = params[0] * Math.pow(x, 0.894);
    return Math.max(1, sigma); // Minimum 1 meter
  }

  calculateSigmaZ(distance, params) {
    // Distance in meters
    // If params is an object with sigmaz property, extract it  
    if (params && params.sigmaz) {
      params = params.sigmaz;
    }
    // Ensure params is an array with at least 3 elements
    if (!Array.isArray(params) || params.length < 3) {
      params = [44.5, 24.4, -0.96]; // Default to neutral stability (D)
    }
    const x = Math.max(0.1, distance / 1000); // Convert to km, minimum 0.1 km
    // Pasquill-Gifford parameterization
    const sigma = params[0] * Math.pow(x, 0.894);
    return Math.max(1, sigma); // Minimum 1 meter
  }

  calculateCenterlineConcentration(emissionRate, windSpeed, sigmaY, sigmaZ, effectiveHeight, distance) {
    // Gaussian plume equation for ground-level concentration
    const Q = emissionRate * 1e6; // Convert g/s to µg/s
    const u = windSpeed;
    const H = effectiveHeight;
    
    // Ground-level concentration (receptor height = 0)
    const concentration = (Q / (Math.PI * u * sigmaY * sigmaZ)) * 
                         Math.exp(-0.5 * Math.pow(H / sigmaZ, 2));
    
    return Math.max(0, concentration);
  }

  calculateConcentrationMap(plumeModel, weatherData) {
    const concentrationMap = {
      centerline: [],
      contours: {}, // PM2.5 concentration contours
      maxConcentration: 0,
      exceedanceAreas: {} // Areas exceeding EPA standards
    };
    
    // Calculate centerline concentrations
    plumeModel.plumeData.forEach(point => {
      concentrationMap.centerline.push({
        distance: point.distance,
        concentration: point.concentration,
        exceedsEPA: point.concentration > this.pm25Standards.daily
      });
      
      concentrationMap.maxConcentration = Math.max(
        concentrationMap.maxConcentration,
        point.concentration
      );
    });
    
    // Calculate concentration contours for EPA standards
    const standards = [this.pm25Standards.daily, this.pm25Standards.unhealthy];
    
    standards.forEach(standard => {
      const contourPoints = this.calculateContourPoints(plumeModel, standard);
      concentrationMap.contours[standard] = contourPoints;
      
      // Calculate area exceeding this standard
      if (contourPoints.length > 0) {
        concentrationMap.exceedanceAreas[standard] = this.calculateContourArea(contourPoints);
      }
    });
    
    return concentrationMap;
  }

  calculateContourPoints(plumeModel, targetConcentration) {
    const contourPoints = [];
    
    // Find distances where concentration equals target value
    for (let i = 0; i < plumeModel.plumeData.length - 1; i++) {
      const p1 = plumeModel.plumeData[i];
      const p2 = plumeModel.plumeData[i + 1];
      
      // Check if target concentration is between these two points
      if ((p1.concentration >= targetConcentration && p2.concentration <= targetConcentration) ||
          (p1.concentration <= targetConcentration && p2.concentration >= targetConcentration)) {
        
        // Linear interpolation to find exact distance
        const ratio = (targetConcentration - p1.concentration) / (p2.concentration - p1.concentration);
        const distance = p1.distance + ratio * (p2.distance - p1.distance);
        
        // Calculate lateral extent at this distance
        const sigmaY = this.calculateSigmaY(distance, this.stabilityClasses[plumeModel.stabilityClass].sigmay);
        const lateralExtent = 2 * sigmaY; // 95% of plume
        
        contourPoints.push({
          distance,
          lateralExtent,
          concentration: targetConcentration
        });
      }
    }
    
    return contourPoints;
  }

  calculateContourArea(contourPoints) {
    if (contourPoints.length === 0) return 0;
    
    // Simplified area calculation for plume footprint
    let totalArea = 0;
    
    contourPoints.forEach(point => {
      // Elliptical area approximation
      const area = Math.PI * point.distance * point.lateralExtent / 2;
      totalArea += area;
    });
    
    return totalArea; // Square meters
  }

  calculateMaxDispersionRadius(concentrationMap) {
    // Find the maximum distance where concentration exceeds EPA daily standard
    let maxRadius = 0;
    
    concentrationMap.centerline.forEach(point => {
      if (point.concentration > this.pm25Standards.daily) {
        maxRadius = Math.max(maxRadius, point.distance);
      }
    });
    
    // If no exceedances, use distance where concentration drops to 10% of max
    if (maxRadius === 0) {
      const threshold = concentrationMap.maxConcentration * 0.1;
      concentrationMap.centerline.forEach(point => {
        if (point.concentration > threshold) {
          maxRadius = Math.max(maxRadius, point.distance);
        }
      });
    }
    
    return maxRadius; // meters
  }

  generateAffectedAreaPolygon(fieldBoundary, plumeModel, windDirection) {
    try {
      // Create polygon representing area potentially affected by smoke
      const centerPoint = this.calculateFieldCentroid(fieldBoundary);
      const maxDistance = Math.max(...plumeModel.plumeData.map(p => p.distance));
      const maxLateralSpread = Math.max(...plumeModel.plumeData.map(p => p.lateralSpread));
      
      // Convert wind direction to radians
      const windDirRad = windDirection * Math.PI / 180;
      
      // Generate polygon points for affected area
      const polygonPoints = [];
      const numPoints = 16; // Number of points for polygon approximation
      
      for (let i = 0; i < numPoints; i++) {
        const angle = windDirRad + (i * 2 * Math.PI / numPoints);
        
        // Distance varies based on direction relative to wind
        let distance;
        if (Math.abs(angle - windDirRad) < Math.PI / 4) {
          // Downwind direction - maximum distance
          distance = maxDistance;
        } else if (Math.abs(angle - windDirRad) > 3 * Math.PI / 4) {
          // Upwind direction - minimal distance
          distance = maxDistance * 0.1;
        } else {
          // Crosswind direction - intermediate distance
          distance = maxDistance * 0.5;
        }
        
        const x = centerPoint.lon + (distance * Math.cos(angle)) / 111320; // Convert m to degrees
        const y = centerPoint.lat + (distance * Math.sin(angle)) / 110540;
        
        polygonPoints.push([x, y]);
      }
      
      // Close the polygon
      polygonPoints.push(polygonPoints[0]);
      
      return {
        type: 'Polygon',
        coordinates: [polygonPoints]
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Affected area polygon generation failed', { error: error.message });
      return null;
    }
  }

  calculateFieldCentroid(fieldBoundary) {
    const coordinates = fieldBoundary.coordinates[0];
    let lat = 0, lon = 0;
    
    coordinates.forEach(coord => {
      lon += coord[0];
      lat += coord[1];
    });
    
    return {
      lon: lon / coordinates.length,
      lat: lat / coordinates.length
    };
  }

  async generatePlumeVector(plumeModel, weatherData, burnData, concentrationMap) {
    try {
      // Create 64-dimensional plume vector for similarity analysis
      const vector = new Array(64).fill(0);
      
      // Basic plume characteristics (dimensions 0-15)
      vector[0] = Math.min(1, concentrationMap.maxConcentration / 100); // Normalize max concentration
      vector[1] = Math.min(1, plumeModel.plumeData[plumeModel.plumeData.length - 1].distance / 10000); // Max distance
      vector[2] = plumeModel.effectiveHeight / 100; // Effective height
      vector[3] = plumeModel.windSpeed / 20; // Wind speed
      vector[4] = Math.sin(plumeModel.windDirection); // Wind direction components
      vector[5] = Math.cos(plumeModel.windDirection);
      
      // Stability class encoding
      const stabilityClasses = ['A', 'B', 'C', 'D', 'E', 'F'];
      const stabilityIndex = stabilityClasses.indexOf(plumeModel.stabilityClass);
      if (stabilityIndex !== -1) {
        vector[6 + stabilityIndex] = 1; // One-hot encoding
      }
      
      // Concentration profile (dimensions 12-27)
      for (let i = 0; i < Math.min(16, plumeModel.plumeData.length); i++) {
        if (12 + i < 28) {
          vector[12 + i] = Math.min(1, plumeModel.plumeData[i].concentration / 50);
        }
      }
      
      // Dispersion characteristics (dimensions 28-35)
      const avgSigmaY = plumeModel.plumeData.reduce((sum, p) => sum + p.sigmaY, 0) / plumeModel.plumeData.length;
      const avgSigmaZ = plumeModel.plumeData.reduce((sum, p) => sum + p.sigmaZ, 0) / plumeModel.plumeData.length;
      vector[28] = Math.min(1, avgSigmaY / 1000);
      vector[29] = Math.min(1, avgSigmaZ / 500);
      
      // EPA exceedance information (dimensions 30-35)
      const dailyExceedance = concentrationMap.centerline.filter(p => p.exceedsEPA).length;
      vector[30] = Math.min(1, dailyExceedance / plumeModel.plumeData.length);
      
      // Burn characteristics (dimensions 36-47)
      vector[36] = Math.min(1, burnData.acres / 1000); // Normalize acres
      
      // Crop type encoding
      const cropTypes = ['rice', 'wheat', 'corn', 'barley', 'oats', 'cotton', 'soybeans', 'sunflower', 'sorghum', 'other'];
      const cropIndex = cropTypes.indexOf(burnData.crop_type);
      if (cropIndex !== -1 && cropIndex < 10) {
        vector[37 + Math.min(cropIndex, 9)] = 1;
      }
      
      // Weather pattern embedding (dimensions 47-55)
      vector[47] = (weatherData.temperature - 32) / 100; // Normalize temperature
      vector[48] = weatherData.humidity / 100;
      vector[49] = weatherData.pressure / 35;
      vector[50] = weatherData.cloudCover / 100;
      
      // Temporal features (dimensions 56-63)
      const burnTime = new Date(burnData.burn_date);
      vector[56] = burnTime.getMonth() / 12;
      vector[57] = burnTime.getHours() / 24;
      vector[58] = burnTime.getDay() / 7;
      
      // Risk assessment features
      vector[59] = concentrationMap.maxConcentration > this.pm25Standards.daily ? 1 : 0;
      vector[60] = concentrationMap.maxConcentration > this.pm25Standards.unhealthy ? 1 : 0;
      
      // Normalize vector
      const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
      const normalizedVector = magnitude > 0 ? vector.map(val => val / magnitude) : vector;
      
      logger.vector('plume_vector_generation', 'smoke_plume', 64, {
        maxConcentration: concentrationMap.maxConcentration.toFixed(2),
        stabilityClass: plumeModel.stabilityClass,
        magnitude: magnitude.toFixed(4)
      });
      
      return normalizedVector;
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Plume vector generation failed', { error: error.message });
      return new Array(64).fill(0.1);
    }
  }

  async detectBurnConflicts(affectedArea, burnDate, plumeVector) {
    try {
      if (!affectedArea) return [];
      
      // Find other burns scheduled for the same date (simplified without spatial functions)
      const spatialConflicts = await query(`
        SELECT 
          br.request_id as id,
          br.farm_id,
          br.field_id as field_name,
          br.acreage as acres,
          br.requested_window_start as time_window_start,
          br.requested_window_end as time_window_end,
          1000 as distance_meters
        FROM burn_requests br
        WHERE br.requested_date = ?
        AND br.status IN ('pending', 'approved')
      `, [burnDate]);
      
      // Find burns with similar plume characteristics using vector search
      const vectorConflicts = await vectorSimilaritySearch(
        'burn_smoke_predictions',
        'plume_vector',
        plumeVector,
        5
      );
      
      const conflicts = [];
      
      // Process spatial conflicts
      spatialConflicts.forEach(conflict => {
        conflicts.push({
          type: 'spatial',
          burnRequestId: conflict.id,
          farmId: conflict.farm_id,
          fieldName: conflict.field_name,
          acres: conflict.acres,
          timeWindow: `${conflict.time_window_start}-${conflict.time_window_end}`,
          distance: conflict.distance_meters,
          severity: conflict.distance_meters < 1000 ? 'high' : 'medium'
        });
      });
      
      // Process vector similarity conflicts
      vectorConflicts.forEach(conflict => {
        if (conflict.similarity > 0.8) {
          conflicts.push({
            type: 'pattern_similarity',
            similarity: conflict.similarity,
            severity: conflict.similarity > 0.9 ? 'high' : 'medium'
          });
        }
      });
      
      logger.agent(this.agentName, 'info', 'Conflict detection completed', {
        spatialConflicts: spatialConflicts.length,
        vectorConflicts: vectorConflicts.length,
        totalConflicts: conflicts.length
      });
      
      return conflicts;
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Conflict detection failed', { error: error.message });
      return [];
    }
  }

  calculatePredictionConfidence(plumeModel, weatherData, burnData) {
    let confidence = 0.8; // Base confidence
    
    // Weather stability factor
    if (plumeModel.stabilityClass === 'D') {
      confidence += 0.1; // Neutral conditions are most predictable
    } else if (['A', 'F'].includes(plumeModel.stabilityClass)) {
      confidence -= 0.1; // Very unstable or stable conditions less predictable
    }
    
    // Wind speed factor
    if (plumeModel.windSpeed >= 2 && plumeModel.windSpeed <= 10) {
      confidence += 0.05; // Moderate winds are most predictable
    } else if (plumeModel.windSpeed < 1 || plumeModel.windSpeed > 15) {
      confidence -= 0.1; // Extreme wind conditions less predictable
    }
    
    // Historical data availability
    if (this.historicalDispersions.length > 50) {
      confidence += 0.05;
    }
    
    // Burn size factor (larger burns more predictable)
    if (burnData.acres > 100) {
      confidence += 0.05;
    } else if (burnData.acres < 10) {
      confidence -= 0.05;
    }
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Use GPT-5-mini to analyze dispersion safety and provide evidence-based assessments
   */
  async analyzeDispersionWithAI(concentrationMap, maxDispersionRadius, conflicts, weatherData, burnData) {
    if (!this.gpt5Client) {
      logger.agent(this.agentName, 'warn', 'GPT-5 client not available for dispersion analysis');
      return null;
    }

    try {
      const dispersionDescription = `
Smoke Dispersion Analysis (Gaussian Plume Model):
Burn Area: ${burnData.acres} acres of ${burnData.crop_type}
Max Dispersion Radius: ${maxDispersionRadius} meters
Wind Speed: ${weatherData.windSpeed} mph, Direction: ${weatherData.windDirection}°

PM2.5 Concentration Levels:
- Maximum: ${concentrationMap.maxConcentration?.toFixed(2) || 'N/A'} µg/m³
- At 500m: ${concentrationMap.at500m?.toFixed(2) || 'N/A'} µg/m³
- At 1km: ${concentrationMap.at1km?.toFixed(2) || 'N/A'} µg/m³
- At 2km: ${concentrationMap.at2km?.toFixed(2) || 'N/A'} µg/m³

EPA PM2.5 Standards:
- Daily (24-hr): 35 µg/m³
- Unhealthy for sensitive: 55 µg/m³
- Hazardous: 250 µg/m³

Conflicts Detected: ${conflicts.length}
${conflicts.slice(0, 3).map(c => `- ${c.type}: ${c.distance}m away, severity: ${c.severity}`).join('\n')}
`;

      const analysisPrompt = `You are a smoke dispersion safety expert using GPT-5-mini.

Analyze this Gaussian plume dispersion model output:
${dispersionDescription}

MANDATORY EVIDENCE-BASED REQUIREMENTS:

1) EPA Compliance Assessment:
   - Compare PM2.5 levels to EPA NAAQS: 35 µg/m³ (24-hr), 12 µg/m³ (annual)
   - Reference 40 CFR Part 50 for particulate matter standards
   - Calculate exceedance percentage and duration
   - Specify Air Quality Index (AQI) category with numeric value

2) Health Impact Analysis:
   - Quantify exposure risk for sensitive groups (% population affected)
   - Reference CDC PM2.5 health thresholds: 
     * Good: 0-12 µg/m³
     * Moderate: 12.1-35.4 µg/m³
     * Unhealthy for Sensitive: 35.5-55.4 µg/m³
   - Cite specific health effects at detected concentrations
   - Include exposure duration limits from OSHA/NIOSH

3) Safe Distance Calculations:
   - Minimum setback: ___ meters (based on 35 µg/m³ threshold)
   - Buffer zone for sensitive receptors: ___ meters
   - Reference NFPA 1 Chapter 10.14 for outdoor burning distances
   - Include confidence interval (e.g., "95% CI: 500-750m")

4) Risk Mitigation Measures:
   - Specific burn timing adjustments (hour:minute precision)
   - Acreage reduction percentage to meet standards
   - Required atmospheric conditions (exact values)
   - Reference USDA Forest Service smoke management guidelines

Data Requirements:
- All concentrations in µg/m³ with 2 decimal precision
- Distances in meters (not "approximately")
- Percentages with confidence levels
- Time windows in HH:MM format

MANDATORY: End response with:
"Sources: [List specific documents - EPA 40 CFR Part 50, CDC Air Quality Guidelines, NFPA 1 Section 10.14, NIOSH REL for PM2.5, USDA Smoke Management Guide, state regulations if applicable]"`;

      const aiAnalysis = await this.gpt5Client.complete(analysisPrompt, 700);
      
      if (aiAnalysis) {
        logger.agent(this.agentName, 'info', 'GPT-5 dispersion safety analysis completed', {
          maxRadius: maxDispersionRadius,
          maxPM25: concentrationMap.maxConcentration?.toFixed(2)
        });
        return aiAnalysis;
      }
    } catch (error) {
      logger.agent(this.agentName, 'error', 'AI dispersion analysis failed', { error: error.message });
    }
    
    return null;
  }

  generateSafetyRecommendations(concentrationMap, conflicts) {
    const recommendations = [];
    
    // PM2.5 concentration recommendations
    if (concentrationMap.maxConcentration > this.pm25Standards.unhealthy) {
      recommendations.push({
        type: 'warning',
        message: 'Predicted PM2.5 levels exceed unhealthy thresholds',
        action: 'Consider postponing burn or reducing burn area',
        priority: 'high'
      });
    } else if (concentrationMap.maxConcentration > this.pm25Standards.daily) {
      recommendations.push({
        type: 'caution',
        message: 'Predicted PM2.5 levels may exceed EPA daily standards',
        action: 'Monitor air quality and consider smaller burn windows',
        priority: 'medium'
      });
    }
    
    // Conflict-based recommendations
    if (conflicts.length > 0) {
      const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
      if (highSeverityConflicts.length > 0) {
        recommendations.push({
          type: 'warning',
          message: `${highSeverityConflicts.length} high-severity conflicts detected`,
          action: 'Coordinate with nearby farms or reschedule burn',
          priority: 'high'
        });
      }
    }
    
    // Distance-based recommendations
    const maxDistance = Math.max(...concentrationMap.centerline.map(p => p.distance));
    if (maxDistance > 5000) {
      recommendations.push({
        type: 'info',
        message: 'Smoke plume may travel over 5km',
        action: 'Notify downwind communities and monitor weather changes',
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  summarizeConcentrationMap(concentrationMap) {
    return {
      maxConcentration: Math.round(concentrationMap.maxConcentration * 100) / 100,
      exceedsDaily: concentrationMap.maxConcentration > this.pm25Standards.daily,
      exceedsUnhealthy: concentrationMap.maxConcentration > this.pm25Standards.unhealthy,
      centerlinePoints: concentrationMap.centerline.length,
      contourLevels: Object.keys(concentrationMap.contours).length
    };
  }

  async storePredictionResults(data) {
    try {
      const result = await query(`
        INSERT INTO burn_smoke_predictions (
          request_id, prediction_time, smoke_density,
          affected_area_km2, max_concentration_pm25, 
          wind_adjusted, confidence_score, created_at
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, NOW())
      `, [
        data.burnRequestId,
        JSON.stringify(data.affectedArea || {}),
        (data.maxDispersionRadius / 1000) * Math.PI * (data.maxDispersionRadius / 1000), // Area in km²
        data.maxConcentration || 0,
        1, // wind_adjusted = true
        data.confidenceScore
      ]);
      
      return result.insertId;
      
    } catch (error) {
      throw new AgentError(this.agentName, 'storage', `Failed to store prediction results: ${error.message}`, error);
    }
  }

  async getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      const predictionStats = await query(`
        SELECT 
          COUNT(*) as total_predictions,
          AVG(confidence_score) as avg_confidence,
          AVG(max_dispersion_radius) as avg_dispersion_radius
        FROM burn_smoke_predictions
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      
      return {
        status: 'active',
        agent: this.agentName,
        version: this.version,
        initialized: this.initialized,
        stabilityClasses: Object.keys(this.stabilityClasses),
        historicalRecords: this.historicalDispersions.length,
        windRoseSectors: Object.keys(this.windRose).length,
        last24Hours: predictionStats[0]
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new PredictorAgent();