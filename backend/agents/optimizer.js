const logger = require('../middleware/logger');
const { query, vectorSimilaritySearch } = require('../db/connection');
const { AgentError } = require('../middleware/errorHandler');
const math = require('mathjs');

/**
 * AGENT 4: SCHEDULE OPTIMIZER
 * 
 * Responsibilities:
 * - Uses simulated annealing algorithm for schedule optimization
 * - Minimizes conflicts while respecting time windows
 * - Generates optimal burn schedules for multiple farms
 * - Considers weather patterns, smoke dispersion, and farm priorities
 * - Provides schedule quality metrics and optimization statistics
 * - Handles multi-constraint optimization problems
 */
class OptimizerAgent {
  constructor() {
    this.agentName = 'optimizer';
    this.version = '1.0.0';
    this.initialized = false;
    
    // Simulated annealing parameters
    this.saParams = {
      initialTemperature: 1000,
      coolingRate: 0.95,
      minTemperature: 0.01,
      maxIterations: 10000,
      maxIterationsWithoutImprovement: 1000,
      reheatThreshold: 500 // Reheat if no improvement for this many iterations
    };
    
    // Optimization weights for different factors
    this.optimizationWeights = {
      smokeConflicts: 0.35,      // Primary safety concern
      timeWindowViolations: 0.25, // Respect farmer preferences
      weatherConditions: 0.20,    // Optimal burning conditions
      priorityScores: 0.15,       // Farm/burn priorities
      resourceUtilization: 0.05   // Efficient use of monitoring resources
    };
    
    // Constraint definitions
    this.constraints = {
      minBurnSeparation: 1000,    // Minimum meters between simultaneous burns
      maxDailyBurns: 50,          // Maximum burns per day (monitoring capacity)
      minTimeSlot: 2,             // Minimum burn duration (hours)
      maxTimeSlot: 8,             // Maximum burn duration (hours)
      bufferTime: 1               // Buffer between consecutive burns (hours)
    };
  }

  async initialize() {
    try {
      logger.agent(this.agentName, 'info', 'Initializing Schedule Optimizer Agent');
      
      // Validate mathematical capabilities for optimization
      await this.testOptimizationCapabilities();
      
      // Load historical optimization data
      await this.loadHistoricalOptimizations();
      
      // Initialize optimization templates
      await this.initializeOptimizationTemplates();
      
      this.initialized = true;
      logger.agent(this.agentName, 'info', 'Optimizer Agent initialized successfully');
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Failed to initialize Optimizer Agent', { error: error.message });
      throw new AgentError(this.agentName, 'initialization', error.message, error);
    }
  }

  async testOptimizationCapabilities() {
    try {
      // Test mathematical operations required for simulated annealing
      const testMatrix = math.matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
      const testRandom = Math.random();
      const testExp = Math.exp(-1);
      
      if (testExp < 0.3 || testExp > 0.4) {
        throw new Error('Mathematical library test failed');
      }
      
      logger.agent(this.agentName, 'debug', 'Optimization capabilities verified');
    } catch (error) {
      throw new Error(`Optimization test failed: ${error.message}`);
    }
  }

  async loadHistoricalOptimizations() {
    try {
      const historicalData = await query(`
        SELECT 
          s.date,
          s.optimization_score,
          s.total_conflicts,
          si.assigned_time_start,
          si.assigned_time_end,
          si.conflict_score,
          br.priority_score,
          br.acres
        FROM schedules s
        JOIN schedule_items si ON s.id = si.schedule_id
        JOIN burn_requests br ON si.burn_request_id = br.id
        WHERE s.created_at > DATE_SUB(NOW(), INTERVAL 6 MONTH)
        AND s.optimization_score > 0.7
        ORDER BY s.optimization_score DESC
        LIMIT 1000
      `);
      
      this.historicalOptimizations = this.processHistoricalData(historicalData);
      
      logger.agent(this.agentName, 'debug', `Loaded ${historicalData.length} historical optimization records`);
      
    } catch (error) {
      logger.agent(this.agentName, 'warn', 'Could not load historical optimizations', { error: error.message });
      this.historicalOptimizations = {
        bestScores: [],
        patterns: {},
        averageScore: 0.5
      };
    }
  }

  processHistoricalData(data) {
    const processed = {
      bestScores: [],
      patterns: {},
      averageScore: 0
    };
    
    if (data.length === 0) return processed;
    
    // Group by date to analyze daily patterns
    const dailyData = {};
    data.forEach(row => {
      const date = row.date;
      if (!dailyData[date]) {
        dailyData[date] = {
          score: row.optimization_score,
          conflicts: row.total_conflicts,
          burns: []
        };
      }
      
      dailyData[date].burns.push({
        timeStart: row.assigned_time_start,
        timeEnd: row.assigned_time_end,
        conflictScore: row.conflict_score,
        priority: row.priority_score,
        acres: row.acres
      });
    });
    
    // Extract patterns and best scores
    Object.values(dailyData).forEach(day => {
      processed.bestScores.push(day.score);
    });
    
    processed.averageScore = processed.bestScores.reduce((sum, score) => sum + score, 0) / processed.bestScores.length;
    
    return processed;
  }

  async initializeOptimizationTemplates() {
    // Initialize common optimization templates based on farm types and sizes
    this.optimizationTemplates = {
      smallFarms: { // < 50 acres
        maxSimultaneous: 3,
        preferredTimeSlots: ['08:00', '10:00', '14:00'],
        bufferMultiplier: 1.0
      },
      mediumFarms: { // 50-200 acres
        maxSimultaneous: 2,
        preferredTimeSlots: ['07:00', '09:00', '13:00', '15:00'],
        bufferMultiplier: 1.5
      },
      largeFarms: { // > 200 acres
        maxSimultaneous: 1,
        preferredTimeSlots: ['06:00', '08:00', '14:00'],
        bufferMultiplier: 2.0
      }
    };
    
    logger.agent(this.agentName, 'debug', 'Optimization templates initialized');
  }

  /**
   * Main optimization method using simulated annealing
   */
  async optimizeSchedule(date, burnRequests, weatherData, predictionData) {
    if (!this.initialized) {
      throw new AgentError(this.agentName, 'optimization', 'Agent not initialized');
    }

    const startTime = Date.now();
    
    try {
      logger.agent(this.agentName, 'info', 'Starting schedule optimization', {
        date,
        burnRequestsCount: burnRequests.length
      });
      
      // Step 1: Preprocess and validate burn requests
      const validatedRequests = await this.preprocessBurnRequests(burnRequests, weatherData);
      
      if (validatedRequests.length === 0) {
        return this.createEmptySchedule(date, 'No valid burn requests');
      }
      
      // Step 2: Initialize optimization problem
      const optimizationProblem = this.initializeOptimizationProblem(
        validatedRequests,
        weatherData,
        predictionData
      );
      
      // Step 3: Run simulated annealing algorithm
      const optimizedSolution = await this.runSimulatedAnnealing(optimizationProblem);
      
      // Step 4: Post-process and validate solution
      const finalSchedule = await this.postProcessSolution(optimizedSolution, date);
      
      // Step 5: Calculate optimization metrics
      const metrics = this.calculateOptimizationMetrics(finalSchedule, optimizationProblem);
      
      // Step 6: Store optimization results
      const scheduleId = await this.storeOptimizationResults(finalSchedule, metrics);
      
      const duration = Date.now() - startTime;
      logger.performance('schedule_optimization', duration, {
        date,
        scheduleId,
        optimizationScore: metrics.overallScore,
        totalConflicts: metrics.totalConflicts,
        burnsScheduled: finalSchedule.items.length
      });
      
      return {
        success: true,
        scheduleId,
        date,
        schedule: finalSchedule,
        metrics,
        optimizationDetails: {
          algorithm: 'simulated_annealing',
          iterations: optimizedSolution.iterations,
          finalTemperature: optimizedSolution.finalTemperature,
          improvementHistory: optimizedSolution.improvementHistory
        },
        nextAgent: 'alerts'
      };
      
    } catch (error) {
      logger.agent(this.agentName, 'error', 'Schedule optimization failed', {
        date,
        error: error.message,
        duration: Date.now() - startTime
      });
      throw error;
    }
  }

  async preprocessBurnRequests(burnRequests, weatherData) {
    const validatedRequests = [];
    
    for (const request of burnRequests) {
      try {
        // Validate time windows
        const startTime = this.parseTime(request.time_window_start);
        const endTime = this.parseTime(request.time_window_end);
        
        if (endTime - startTime < this.constraints.minTimeSlot) {
          logger.agent(this.agentName, 'warn', 'Burn request time window too small', {
            burnRequestId: request.id,
            timeWindow: `${request.time_window_start}-${request.time_window_end}`
          });
          continue;
        }
        
        // Add weather suitability score
        const weatherScore = this.calculateWeatherSuitability(weatherData, request);
        
        validatedRequests.push({
          ...request,
          startTime,
          endTime,
          duration: endTime - startTime,
          weatherScore
        });
        
      } catch (error) {
        logger.agent(this.agentName, 'warn', 'Burn request validation failed', {
          burnRequestId: request.id,
          error: error.message
        });
      }
    }
    
    logger.agent(this.agentName, 'debug', `Validated ${validatedRequests.length}/${burnRequests.length} burn requests`);
    return validatedRequests;
  }

  calculateWeatherSuitability(weatherData, request) {
    // Calculate weather suitability score (0-1) based on current conditions
    let score = 0.5; // Base score
    
    if (weatherData.windSpeed >= 2 && weatherData.windSpeed <= 15) {
      score += 0.2; // Good wind conditions
    } else if (weatherData.windSpeed < 1 || weatherData.windSpeed > 20) {
      score -= 0.3; // Poor wind conditions
    }
    
    if (weatherData.humidity >= 30 && weatherData.humidity <= 70) {
      score += 0.2; // Good humidity
    } else if (weatherData.humidity > 80 || weatherData.humidity < 20) {
      score -= 0.2; // Poor humidity
    }
    
    if (weatherData.precipitationProb < 20) {
      score += 0.1; // Low precipitation chance
    } else if (weatherData.precipitationProb > 50) {
      score -= 0.3; // High precipitation chance
    }
    
    return Math.max(0, Math.min(1, score));
  }

  initializeOptimizationProblem(requests, weatherData, predictionData) {
    return {
      requests,
      weatherData,
      predictionData,
      timeSlots: this.generateTimeSlots(),
      distanceMatrix: this.calculateDistanceMatrix(requests),
      conflictMatrix: this.calculateConflictMatrix(requests, predictionData),
      constraints: this.constraints,
      weights: this.optimizationWeights
    };
  }

  generateTimeSlots() {
    // Generate 30-minute time slots from 6 AM to 8 PM
    const slots = [];
    for (let hour = 6; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push({
          time: timeStr,
          decimal: hour + minute / 60,
          available: true
        });
      }
    }
    return slots;
  }

  calculateDistanceMatrix(requests) {
    const matrix = {};
    
    for (let i = 0; i < requests.length; i++) {
      matrix[requests[i].id] = {};
      
      for (let j = 0; j < requests.length; j++) {
        if (i !== j) {
          const distance = this.calculateDistance(
            requests[i].field_boundary,
            requests[j].field_boundary
          );
          matrix[requests[i].id][requests[j].id] = distance;
        }
      }
    }
    
    return matrix;
  }

  calculateDistance(boundary1, boundary2) {
    // Simplified distance calculation between field centroids
    const centroid1 = this.calculateCentroid(boundary1);
    const centroid2 = this.calculateCentroid(boundary2);
    
    const lat1 = centroid1.lat * Math.PI / 180;
    const lat2 = centroid2.lat * Math.PI / 180;
    const deltaLat = (centroid2.lat - centroid1.lat) * Math.PI / 180;
    const deltaLon = (centroid2.lon - centroid1.lon) * Math.PI / 180;
    
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return 6371000 * c; // Distance in meters
  }

  calculateCentroid(boundary) {
    const coordinates = boundary.coordinates[0];
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

  calculateConflictMatrix(requests, predictionData) {
    const conflicts = {};
    
    // Initialize conflict matrix
    requests.forEach(req1 => {
      conflicts[req1.id] = {};
      requests.forEach(req2 => {
        if (req1.id !== req2.id) {
          conflicts[req1.id][req2.id] = 0; // Default no conflict
        }
      });
    });
    
    // Calculate conflicts based on prediction data
    if (predictionData && Array.isArray(predictionData)) {
      predictionData.forEach(prediction => {
        if (prediction.conflicts && prediction.conflicts.length > 0) {
          prediction.conflicts.forEach(conflict => {
            if (conflict.type === 'spatial' && conflicts[prediction.burnRequestId]) {
              const conflictId = conflict.burnRequestId;
              if (conflicts[prediction.burnRequestId][conflictId] !== undefined) {
                // Calculate conflict severity (0-1)
                let severity = 0.5;
                if (conflict.severity === 'high') severity = 0.9;
                else if (conflict.severity === 'medium') severity = 0.6;
                else if (conflict.severity === 'low') severity = 0.3;
                
                conflicts[prediction.burnRequestId][conflictId] = severity;
                conflicts[conflictId][prediction.burnRequestId] = severity; // Symmetric
              }
            }
          });
        }
      });
    }
    
    return conflicts;
  }

  async runSimulatedAnnealing(problem) {
    logger.algorithm('simulated_annealing', 'start', 'Beginning optimization', {
      requests: problem.requests.length,
      timeSlots: problem.timeSlots.length
    });
    
    // Initialize solution
    let currentSolution = this.generateInitialSolution(problem);
    let currentScore = this.evaluateSolution(currentSolution, problem);
    
    let bestSolution = { ...currentSolution };
    let bestScore = currentScore;
    
    // Optimization tracking
    let temperature = this.saParams.initialTemperature;
    let iteration = 0;
    let iterationsWithoutImprovement = 0;
    let reheats = 0;
    const improvementHistory = [];
    
    while (temperature > this.saParams.minTemperature && 
           iteration < this.saParams.maxIterations &&
           iterationsWithoutImprovement < this.saParams.maxIterationsWithoutImprovement) {
      
      // Generate neighbor solution
      const neighborSolution = this.generateNeighborSolution(currentSolution, problem);
      const neighborScore = this.evaluateSolution(neighborSolution, problem);
      
      // Calculate acceptance probability
      const deltaScore = neighborScore - currentScore;
      const acceptanceProbability = deltaScore > 0 ? 1 : Math.exp(deltaScore / temperature);
      
      // Accept or reject the neighbor solution
      if (Math.random() < acceptanceProbability) {
        currentSolution = neighborSolution;
        currentScore = neighborScore;
        
        // Check if this is the best solution so far
        if (currentScore > bestScore) {
          bestSolution = { ...currentSolution };
          bestScore = currentScore;
          iterationsWithoutImprovement = 0;
          
          improvementHistory.push({
            iteration,
            score: bestScore,
            temperature
          });
          
          logger.algorithm('simulated_annealing', 'improvement', 'New best solution found', {
            iteration,
            score: bestScore.toFixed(4),
            temperature: temperature.toFixed(4)
          });
        } else {
          iterationsWithoutImprovement++;
        }
      } else {
        iterationsWithoutImprovement++;
      }
      
      // Reheat if stuck in local optimum
      if (iterationsWithoutImprovement >= this.saParams.reheatThreshold && reheats < 3) {
        temperature = this.saParams.initialTemperature * 0.5;
        iterationsWithoutImprovement = 0;
        reheats++;
        
        logger.algorithm('simulated_annealing', 'reheat', 'Reheating algorithm', {
          reheatNumber: reheats,
          newTemperature: temperature
        });
      }
      
      // Cool down
      temperature *= this.saParams.coolingRate;
      iteration++;
      
      // Log progress every 1000 iterations
      if (iteration % 1000 === 0) {
        logger.algorithm('simulated_annealing', 'progress', `Iteration ${iteration}`, {
          currentScore: currentScore.toFixed(4),
          bestScore: bestScore.toFixed(4),
          temperature: temperature.toFixed(4),
          iterationsWithoutImprovement
        });
      }
    }
    
    logger.algorithm('simulated_annealing', 'complete', 'Optimization completed', {
      totalIterations: iteration,
      finalTemperature: temperature,
      bestScore: bestScore.toFixed(4),
      improvements: improvementHistory.length,
      reheats
    });
    
    return {
      solution: bestSolution,
      score: bestScore,
      iterations: iteration,
      finalTemperature: temperature,
      improvementHistory,
      reheats
    };
  }

  generateInitialSolution(problem) {
    const solution = {
      assignments: {}, // requestId -> { startTime, endTime }
      timeSlotUsage: {}, // timeSlot -> [requestIds]
      unscheduled: []
    };
    
    // Initialize time slot usage
    problem.timeSlots.forEach(slot => {
      solution.timeSlotUsage[slot.time] = [];
    });
    
    // Simple greedy assignment based on priority scores
    const sortedRequests = [...problem.requests].sort((a, b) => b.priority_score - a.priority_score);
    
    sortedRequests.forEach(request => {
      const assignment = this.findBestTimeSlot(request, solution, problem);
      
      if (assignment) {
        this.assignBurnToTimeSlot(request, assignment, solution);
      } else {
        solution.unscheduled.push(request.id);
      }
    });
    
    return solution;
  }

  findBestTimeSlot(request, solution, problem) {
    let bestSlot = null;
    let bestScore = -1;
    
    // Try each available time slot within the request's time window
    for (const slot of problem.timeSlots) {
      if (slot.decimal >= request.startTime && 
          slot.decimal + request.duration <= request.endTime) {
        
        // Check if slot has capacity
        const currentOccupancy = solution.timeSlotUsage[slot.time].length;
        if (currentOccupancy >= this.constraints.maxDailyBurns) continue;
        
        // Calculate slot score considering conflicts
        const slotScore = this.calculateSlotScore(request, slot, solution, problem);
        
        if (slotScore > bestScore) {
          bestScore = slotScore;
          bestSlot = {
            startTime: slot.decimal,
            endTime: slot.decimal + request.duration,
            score: slotScore
          };
        }
      }
    }
    
    return bestSlot;
  }

  calculateSlotScore(request, slot, solution, problem) {
    let score = 0.5; // Base score
    
    // Weather suitability
    score += request.weatherScore * 0.3;
    
    // Priority score influence
    score += (request.priority_score / 10) * 0.2;
    
    // Conflict penalty
    const conflictPenalty = this.calculateConflictPenalty(request, slot, solution, problem);
    score -= conflictPenalty * 0.4;
    
    // Time preference (favor morning burns)
    if (slot.decimal >= 7 && slot.decimal <= 11) {
      score += 0.1; // Morning preference
    }
    
    return Math.max(0, Math.min(1, score));
  }

  calculateConflictPenalty(request, slot, solution, problem) {
    let penalty = 0;
    
    // Check conflicts with already scheduled burns
    const concurrentBurns = solution.timeSlotUsage[slot.time] || [];
    
    concurrentBurns.forEach(scheduledId => {
      const conflictLevel = problem.conflictMatrix[request.id] ? 
                           problem.conflictMatrix[request.id][scheduledId] || 0 : 0;
      penalty += conflictLevel;
    });
    
    return Math.min(1, penalty); // Cap at 1
  }

  assignBurnToTimeSlot(request, assignment, solution) {
    solution.assignments[request.id] = assignment;
    
    // Mark time slots as used
    const startSlot = this.findTimeSlot(assignment.startTime);
    const endSlot = this.findTimeSlot(assignment.endTime);
    
    // Add to all slots within the burn duration
    for (let time = assignment.startTime; time < assignment.endTime; time += 0.5) {
      const timeStr = this.decimalToTimeString(time);
      if (solution.timeSlotUsage[timeStr]) {
        solution.timeSlotUsage[timeStr].push(request.id);
      }
    }
  }

  generateNeighborSolution(currentSolution, problem) {
    const neighbor = JSON.parse(JSON.stringify(currentSolution)); // Deep copy
    
    // Choose a random modification strategy
    const strategies = ['reschedule', 'swap', 'unschedule_reschedule'];
    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    
    switch (strategy) {
      case 'reschedule':
        this.rescheduleRandomBurn(neighbor, problem);
        break;
      case 'swap':
        this.swapTwoBurns(neighbor, problem);
        break;
      case 'unschedule_reschedule':
        this.unscheduleAndRescheduleBurn(neighbor, problem);
        break;
    }
    
    return neighbor;
  }

  rescheduleRandomBurn(solution, problem) {
    const scheduledIds = Object.keys(solution.assignments);
    if (scheduledIds.length === 0) return;
    
    const randomId = scheduledIds[Math.floor(Math.random() * scheduledIds.length)];
    const request = problem.requests.find(r => r.id.toString() === randomId);
    
    if (request) {
      // Remove from current slot
      this.removeBurnFromTimeSlots(randomId, solution);
      delete solution.assignments[randomId];
      
      // Try to reschedule
      const newAssignment = this.findBestTimeSlot(request, solution, problem);
      if (newAssignment) {
        this.assignBurnToTimeSlot(request, newAssignment, solution);
      } else {
        solution.unscheduled.push(randomId);
      }
    }
  }

  swapTwoBurns(solution, problem) {
    const scheduledIds = Object.keys(solution.assignments);
    if (scheduledIds.length < 2) return;
    
    const id1 = scheduledIds[Math.floor(Math.random() * scheduledIds.length)];
    const id2 = scheduledIds[Math.floor(Math.random() * scheduledIds.length)];
    
    if (id1 !== id2) {
      const assignment1 = solution.assignments[id1];
      const assignment2 = solution.assignments[id2];
      
      // Remove both from time slots
      this.removeBurnFromTimeSlots(id1, solution);
      this.removeBurnFromTimeSlots(id2, solution);
      
      // Swap assignments
      solution.assignments[id1] = assignment2;
      solution.assignments[id2] = assignment1;
      
      // Re-add to time slots
      const request1 = problem.requests.find(r => r.id.toString() === id1);
      const request2 = problem.requests.find(r => r.id.toString() === id2);
      
      if (request1) this.assignBurnToTimeSlot(request1, assignment2, solution);
      if (request2) this.assignBurnToTimeSlot(request2, assignment1, solution);
    }
  }

  unscheduleAndRescheduleBurn(solution, problem) {
    // Try to schedule an unscheduled burn
    if (solution.unscheduled.length > 0) {
      const randomIndex = Math.floor(Math.random() * solution.unscheduled.length);
      const requestId = solution.unscheduled[randomIndex];
      const request = problem.requests.find(r => r.id.toString() === requestId);
      
      if (request) {
        const assignment = this.findBestTimeSlot(request, solution, problem);
        if (assignment) {
          solution.unscheduled.splice(randomIndex, 1);
          this.assignBurnToTimeSlot(request, assignment, solution);
        }
      }
    }
  }

  removeBurnFromTimeSlots(burnId, solution) {
    Object.keys(solution.timeSlotUsage).forEach(timeSlot => {
      const index = solution.timeSlotUsage[timeSlot].indexOf(burnId);
      if (index !== -1) {
        solution.timeSlotUsage[timeSlot].splice(index, 1);
      }
    });
  }

  evaluateSolution(solution, problem) {
    let score = 0;
    let totalWeight = 0;
    
    // Factor 1: Smoke conflicts (minimize)
    const conflictScore = this.evaluateConflicts(solution, problem);
    score += conflictScore * this.optimizationWeights.smokeConflicts;
    totalWeight += this.optimizationWeights.smokeConflicts;
    
    // Factor 2: Time window violations (minimize)
    const timeWindowScore = this.evaluateTimeWindows(solution, problem);
    score += timeWindowScore * this.optimizationWeights.timeWindowViolations;
    totalWeight += this.optimizationWeights.timeWindowViolations;
    
    // Factor 3: Weather conditions (maximize)
    const weatherScore = this.evaluateWeatherConditions(solution, problem);
    score += weatherScore * this.optimizationWeights.weatherConditions;
    totalWeight += this.optimizationWeights.weatherConditions;
    
    // Factor 4: Priority scores (maximize high priority burns)
    const priorityScore = this.evaluatePriorityScores(solution, problem);
    score += priorityScore * this.optimizationWeights.priorityScores;
    totalWeight += this.optimizationWeights.priorityScores;
    
    // Factor 5: Resource utilization (maximize scheduled burns)
    const utilizationScore = this.evaluateResourceUtilization(solution, problem);
    score += utilizationScore * this.optimizationWeights.resourceUtilization;
    totalWeight += this.optimizationWeights.resourceUtilization;
    
    // Normalize score
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  evaluateConflicts(solution, problem) {
    let totalConflicts = 0;
    let maxPossibleConflicts = 0;
    
    // Check all scheduled burns for conflicts
    Object.keys(solution.assignments).forEach(id1 => {
      Object.keys(solution.assignments).forEach(id2 => {
        if (id1 !== id2) {
          const assignment1 = solution.assignments[id1];
          const assignment2 = solution.assignments[id2];
          
          // Check if burns overlap in time
          if (this.timePeriodsOverlap(assignment1, assignment2)) {
            const conflictLevel = problem.conflictMatrix[id1] ? 
                                 problem.conflictMatrix[id1][id2] || 0 : 0;
            totalConflicts += conflictLevel;
          }
          
          maxPossibleConflicts++;
        }
      });
    });
    
    // Return conflict-free score (1 = no conflicts, 0 = maximum conflicts)
    return maxPossibleConflicts > 0 ? 1 - (totalConflicts / maxPossibleConflicts) : 1;
  }

  timePeriodsOverlap(period1, period2) {
    return period1.startTime < period2.endTime && period2.startTime < period1.endTime;
  }

  evaluateTimeWindows(solution, problem) {
    let violations = 0;
    let totalAssignments = Object.keys(solution.assignments).length;
    
    Object.keys(solution.assignments).forEach(requestId => {
      const assignment = solution.assignments[requestId];
      const request = problem.requests.find(r => r.id.toString() === requestId);
      
      if (request) {
        // Check if assignment is within requested time window
        if (assignment.startTime < request.startTime || 
            assignment.endTime > request.endTime) {
          violations++;
        }
      }
    });
    
    return totalAssignments > 0 ? 1 - (violations / totalAssignments) : 1;
  }

  evaluateWeatherConditions(solution, problem) {
    let totalWeatherScore = 0;
    let scheduledBurns = 0;
    
    Object.keys(solution.assignments).forEach(requestId => {
      const request = problem.requests.find(r => r.id.toString() === requestId);
      if (request) {
        totalWeatherScore += request.weatherScore || 0.5;
        scheduledBurns++;
      }
    });
    
    return scheduledBurns > 0 ? totalWeatherScore / scheduledBurns : 0;
  }

  evaluatePriorityScores(solution, problem) {
    let totalPriorityScore = 0;
    let scheduledBurns = 0;
    let maxPossibleScore = 0;
    
    problem.requests.forEach(request => {
      maxPossibleScore += request.priority_score;
      
      if (solution.assignments[request.id]) {
        totalPriorityScore += request.priority_score;
        scheduledBurns++;
      }
    });
    
    return maxPossibleScore > 0 ? totalPriorityScore / maxPossibleScore : 0;
  }

  evaluateResourceUtilization(solution, problem) {
    const totalRequests = problem.requests.length;
    const scheduledRequests = Object.keys(solution.assignments).length;
    
    return totalRequests > 0 ? scheduledRequests / totalRequests : 0;
  }

  async postProcessSolution(optimizedSolution, date) {
    const schedule = {
      date,
      items: [],
      unscheduled: [],
      metadata: {
        algorithm: 'simulated_annealing',
        version: this.version,
        optimizationScore: optimizedSolution.score
      }
    };
    
    // Process scheduled burns
    Object.keys(optimizedSolution.solution.assignments).forEach(requestId => {
      const assignment = optimizedSolution.solution.assignments[requestId];
      
      schedule.items.push({
        burnRequestId: parseInt(requestId),
        assignedTimeStart: this.decimalToTimeString(assignment.startTime),
        assignedTimeEnd: this.decimalToTimeString(assignment.endTime),
        conflictScore: assignment.score || 0
      });
    });
    
    // Process unscheduled burns
    optimizedSolution.solution.unscheduled.forEach(requestId => {
      schedule.unscheduled.push({
        burnRequestId: parseInt(requestId),
        reason: 'Could not find suitable time slot without conflicts'
      });
    });
    
    return schedule;
  }

  calculateOptimizationMetrics(schedule, problem) {
    const metrics = {
      overallScore: schedule.metadata.optimizationScore,
      totalRequests: problem.requests.length,
      scheduledRequests: schedule.items.length,
      unscheduledRequests: schedule.unscheduled.length,
      schedulingEfficiency: schedule.items.length / problem.requests.length,
      totalConflicts: 0,
      averageConflictScore: 0,
      timeWindowCompliance: 0,
      weatherOptimization: 0
    };
    
    // Calculate conflict metrics
    let totalConflictScore = 0;
    schedule.items.forEach(item => {
      totalConflictScore += item.conflictScore;
    });
    
    if (schedule.items.length > 0) {
      metrics.averageConflictScore = totalConflictScore / schedule.items.length;
    }
    
    // Calculate time window compliance
    let compliantAssignments = 0;
    schedule.items.forEach(item => {
      const request = problem.requests.find(r => r.id === item.burnRequestId);
      if (request) {
        const assignedStart = this.parseTime(item.assignedTimeStart);
        const assignedEnd = this.parseTime(item.assignedTimeEnd);
        
        if (assignedStart >= request.startTime && assignedEnd <= request.endTime) {
          compliantAssignments++;
        }
      }
    });
    
    metrics.timeWindowCompliance = schedule.items.length > 0 ? 
      compliantAssignments / schedule.items.length : 0;
    
    return metrics;
  }

  async storeOptimizationResults(schedule, metrics) {
    try {
      // Store main schedule record
      const scheduleResult = await query(`
        INSERT INTO schedules (
          date, optimization_score, total_conflicts,
          algorithm_version, created_at
        ) VALUES (?, ?, ?, ?, NOW())
      `, [
        schedule.date,
        metrics.overallScore,
        metrics.totalConflicts,
        `${this.agentName}_v${this.version}`
      ]);
      
      const scheduleId = scheduleResult.insertId;
      
      // Store individual schedule items
      for (const item of schedule.items) {
        await query(`
          INSERT INTO schedule_items (
            schedule_id, burn_request_id, assigned_time_start,
            assigned_time_end, conflict_score, created_at
          ) VALUES (?, ?, ?, ?, ?, NOW())
        `, [
          scheduleId,
          item.burnRequestId,
          item.assignedTimeStart,
          item.assignedTimeEnd,
          item.conflictScore
        ]);
      }
      
      logger.agent(this.agentName, 'info', 'Optimization results stored successfully', {
        scheduleId,
        itemsStored: schedule.items.length,
        optimizationScore: metrics.overallScore
      });
      
      return scheduleId;
      
    } catch (error) {
      throw new AgentError(this.agentName, 'storage', `Failed to store optimization results: ${error.message}`, error);
    }
  }

  createEmptySchedule(date, reason) {
    return {
      success: true,
      scheduleId: null,
      date,
      schedule: {
        date,
        items: [],
        unscheduled: [],
        metadata: {
          reason,
          algorithm: 'simulated_annealing',
          version: this.version,
          optimizationScore: 0
        }
      },
      metrics: {
        overallScore: 0,
        totalRequests: 0,
        scheduledRequests: 0,
        unscheduledRequests: 0,
        schedulingEfficiency: 0
      },
      nextAgent: 'alerts'
    };
  }

  // Utility methods
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours + minutes / 60;
  }

  decimalToTimeString(decimal) {
    const hours = Math.floor(decimal);
    const minutes = Math.round((decimal - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  findTimeSlot(decimal) {
    return this.decimalToTimeString(decimal);
  }

  async getStatus() {
    if (!this.initialized) {
      return { status: 'not_initialized' };
    }

    try {
      const optimizationStats = await query(`
        SELECT 
          COUNT(*) as total_schedules,
          AVG(optimization_score) as avg_score,
          MAX(optimization_score) as best_score,
          AVG(total_conflicts) as avg_conflicts
        FROM schedules
        WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      
      return {
        status: 'active',
        agent: this.agentName,
        version: this.version,
        initialized: this.initialized,
        algorithm: 'simulated_annealing',
        parameters: this.saParams,
        weights: this.optimizationWeights,
        constraints: this.constraints,
        last24Hours: optimizationStats[0],
        historicalOptimizations: this.historicalOptimizations.bestScores.length
      };
      
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = new OptimizerAgent();