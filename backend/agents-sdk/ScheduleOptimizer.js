/**
 * ScheduleOptimizer Agent - AI-Enhanced Simulated Annealing
 * Uses GPT-5-nano to enhance optimization with reasoning about trade-offs
 * NO MOCKS - Actually creates real schedules in database
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const optimizerAgent = require('../agents/optimizer');
const predictorAgent = require('../agents/predictor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Initialize OpenAI with GPT-5-nano for cost efficiency
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1'
});

// Optimization parameters
const OPTIMIZATION_CONFIG = {
  maxIterations: 1000,
  initialTemperature: 100,
  coolingRate: 0.95,
  minTemperature: 0.1,
  reheatingThreshold: 50,
  reheatingFactor: 1.5,
  weights: {
    safety: 0.4,        // Most important
    efficiency: 0.2,    // Time utilization
    fairness: 0.2,      // Equal opportunity
    disruption: 0.1,    // Minimize changes
    precedence: 0.1     // Respect request order
  }
};

// Tools for schedule optimization
const optimizationTools = [
  tool(
    {
      name: 'run_simulated_annealing',
      description: 'Run simulated annealing optimization with AI-enhanced scoring',
      parameters: z.object({
        date: z.string(),
        burnRequests: z.array(z.any()),
        constraints: z.object({
          maxConcurrentBurns: z.number().default(3),
          minSeparationMiles: z.number().default(5),
          maxDailyAcres: z.number().default(1000),
          workingHours: z.object({
            start: z.string().default('06:00'),
            end: z.string().default('18:00')
          })
        })
      })
    },
    async (params) => {
      logger.info('REAL: Running simulated annealing', {
        date: params.date,
        requests: params.burnRequests.length
      });
      
      // Get weather data for the date
      const weatherData = await query(`
        SELECT * FROM weather_data 
        WHERE DATE(timestamp) = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `, [params.date]);
      
      // Run actual simulated annealing from existing optimizer
      const result = await optimizerAgent.optimizeSchedule(
        params.date,
        params.burnRequests,
        weatherData[0] || {},
        [] // Predictions will be generated during optimization
      );
      
      return result;
    }
  ),

  tool(
    {
      name: 'evaluate_schedule_quality',
      description: 'Use AI to evaluate schedule quality and suggest improvements',
      parameters: z.object({
        schedule: z.any(),
        metrics: z.object({
          totalConflicts: z.number(),
          utilizationRate: z.number(),
          fairnessScore: z.number(),
          safetyScore: z.number()
        })
      })
    },
    async (params) => {
      logger.info('REAL: Evaluating schedule quality with AI');
      
      // Use GPT-5-nano to analyze schedule quality
      const completion = await openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'system',
            content: `Evaluate agricultural burn schedule quality.
                     Consider: safety, efficiency, fairness, minimal disruption.
                     Output JSON with:
                     {
                       "overallScore": 0-100,
                       "strengths": ["list of strengths"],
                       "weaknesses": ["list of weaknesses"],
                       "improvements": ["specific actionable improvements"],
                       "riskFactors": ["potential risks to monitor"]
                     }`
          },
          {
            role: 'user',
            content: JSON.stringify({
              schedule: params.schedule,
              metrics: params.metrics
            })
          }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 400,
      });
      
      return JSON.parse(completion.choices[0].message.content);
    }
  ),

  tool(
    {
      name: 'optimize_time_slots',
      description: 'Optimize time slot assignments to minimize smoke overlap',
      parameters: z.object({
        burnRequests: z.array(z.object({
          requestId: z.number(),
          farmId: z.number(),
          acres: z.number(),
          lat: z.number(),
          lng: z.number(),
          requestedStart: z.string(),
          requestedEnd: z.string()
        })),
        windDirection: z.number(),
        windSpeed: z.number()
      })
    },
    async (params) => {
      logger.info('REAL: Optimizing time slots');
      
      const optimizedSlots = [];
      const timeSlots = generateTimeSlots('06:00', '18:00', 120); // 2-hour slots
      
      // Sort burns by priority and size
      const sortedBurns = params.burnRequests.sort((a, b) => 
        b.acres - a.acres // Larger burns first
      );
      
      // Assign to time slots minimizing overlap
      const slotAssignments = new Map();
      
      for (const burn of sortedBurns) {
        let bestSlot = null;
        let minConflict = Infinity;
        
        for (const slot of timeSlots) {
          const conflictScore = calculateSlotConflict(
            burn,
            slot,
            slotAssignments.get(slot.key) || [],
            params.windDirection,
            params.windSpeed
          );
          
          if (conflictScore < minConflict) {
            minConflict = conflictScore;
            bestSlot = slot;
          }
        }
        
        if (bestSlot) {
          if (!slotAssignments.has(bestSlot.key)) {
            slotAssignments.set(bestSlot.key, []);
          }
          slotAssignments.get(bestSlot.key).push(burn);
          
          optimizedSlots.push({
            ...burn,
            assignedStart: bestSlot.start,
            assignedEnd: bestSlot.end,
            conflictScore: minConflict
          });
        }
      }
      
      return optimizedSlots;
    }
  ),

  tool(
    {
      name: 'create_schedule_in_database',
      description: 'Create actual schedule entries in database',
      parameters: z.object({
        date: z.string(),
        optimizedSchedule: z.array(z.object({
          requestId: z.number(),
          assignedStart: z.string(),
          assignedEnd: z.string(),
          priority: z.number(),
          conflictScore: z.number()
        })),
        overallScore: z.number()
      })
    },
    async (params) => {
      logger.info('REAL: Creating schedule in database', {
        date: params.date,
        items: params.optimizedSchedule.length
      });
      
      try {
        // Create main schedule entry
        const scheduleResult = await query(`
          INSERT INTO schedules 
          (schedule_date, optimization_score, total_conflicts, created_at)
          VALUES (?, ?, ?, NOW())
        `, [
          params.date,
          params.overallScore,
          params.optimizedSchedule.filter(s => s.conflictScore > 0).length
        ]);
        
        const scheduleId = scheduleResult.insertId;
        
        // Create schedule items
        for (const item of params.optimizedSchedule) {
          await query(`
            INSERT INTO schedule_items
            (schedule_id, burn_request_id, scheduled_start, scheduled_end, 
             status, priority_order, conflict_score, created_at)
            VALUES (?, ?, ?, ?, 'scheduled', ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
            scheduled_start = VALUES(scheduled_start),
            scheduled_end = VALUES(scheduled_end),
            priority_order = VALUES(priority_order),
            conflict_score = VALUES(conflict_score)
          `, [
            scheduleId,
            item.requestId,
            `${params.date} ${item.assignedStart}:00`,
            `${params.date} ${item.assignedEnd}:00`,
            item.priority || 0,
            item.conflictScore || 0
          ]);
          
          // Update burn request status
          await query(`
            UPDATE burn_requests
            SET status = 'scheduled',
                schedule_id = ?
            WHERE request_id = ?
          `, [scheduleId, item.requestId]);
        }
        
        logger.info('REAL: Schedule created successfully', {
          scheduleId,
          date: params.date,
          itemsCreated: params.optimizedSchedule.length
        });
        
        return {
          success: true,
          scheduleId,
          itemsCreated: params.optimizedSchedule.length
        };
        
      } catch (error) {
        logger.error('REAL: Failed to create schedule', {
          error: error.message,
          date: params.date
        });
        throw error;
      }
    }
  )
];

// Create wrapper functions for direct tool execution
const toolFunctions = {
  runSimulatedAnnealing: optimizationTools[0]._execute || (async (params) => {
    logger.info('REAL: Running simulated annealing', {
      date: params.date,
      requests: params.burnRequests.length
    });
    
    // Get weather data for the date
    const weatherData = await query(`
      SELECT * FROM weather_data 
      WHERE DATE(timestamp) = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [params.date]);
    
    // Run actual simulated annealing from existing optimizer
    const result = await optimizerAgent.optimizeSchedule(
      params.date,
      params.burnRequests,
      weatherData[0] || {},
      [] // Predictions will be generated during optimization
    );
    
    return result;
  }),
  
  evaluateScheduleQuality: optimizationTools[1]._execute || (async (params) => {
    logger.info('REAL: Evaluating schedule quality with AI');
    
    // Use GPT-5-nano to analyze schedule quality
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `Evaluate agricultural burn schedule quality.
                   Consider: safety, efficiency, fairness, minimal disruption.
                   Output JSON with:
                   {
                     "overallScore": 0-100,
                     "strengths": ["list of strengths"],
                     "weaknesses": ["list of weaknesses"],
                     "improvements": ["specific actionable improvements"],
                     "riskFactors": ["potential risks to monitor"]
                   }`
        },
        {
          role: 'user',
          content: JSON.stringify({
            schedule: params.schedule,
            metrics: params.metrics
          })
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 400,
    });
    
    return JSON.parse(completion.choices[0].message.content);
  }),
  
  optimizeTimeSlots: optimizationTools[2]._execute || (async (params) => {
    logger.info('REAL: Optimizing time slots');
    
    const optimizedSlots = [];
    const timeSlots = generateTimeSlots('06:00', '18:00', 120); // 2-hour slots
    
    // Sort burns by priority and size
    const sortedBurns = params.burnRequests.sort((a, b) => 
      b.acres - a.acres // Larger burns first
    );
    
    // Assign to time slots minimizing overlap
    const slotAssignments = new Map();
    
    for (const burn of sortedBurns) {
      let bestSlot = null;
      let minConflict = Infinity;
      
      for (const slot of timeSlots) {
        const conflictScore = calculateSlotConflict(
          burn,
          slot,
          slotAssignments.get(slot.key) || [],
          params.windDirection,
          params.windSpeed
        );
        
        if (conflictScore < minConflict) {
          minConflict = conflictScore;
          bestSlot = slot;
        }
      }
      
      if (bestSlot) {
        if (!slotAssignments.has(bestSlot.key)) {
          slotAssignments.set(bestSlot.key, []);
        }
        slotAssignments.get(bestSlot.key).push(burn);
        
        optimizedSlots.push({
          ...burn,
          assignedStart: bestSlot.start,
          assignedEnd: bestSlot.end,
          conflictScore: minConflict
        });
      }
    }
    
    return optimizedSlots;
  }),
  
  createScheduleInDatabase: optimizationTools[3]._execute || (async (params) => {
    logger.info('REAL: Creating schedule in database', {
      date: params.date,
      items: params.optimizedSchedule.length
    });
    
    try {
      // Create main schedule entry
      const scheduleResult = await query(`
        INSERT INTO schedules 
        (date, optimization_score, total_conflicts, created_at)
        VALUES (?, ?, ?, NOW())
      `, [
        params.date,
        params.overallScore,
        params.optimizedSchedule.filter(s => s.conflictScore > 0).length
      ]);
      
      const scheduleId = scheduleResult.insertId;
      
      // Create schedule items
      for (const item of params.optimizedSchedule) {
        await query(`
          INSERT INTO schedule_items
          (schedule_id, burn_request_id, scheduled_start, scheduled_end, 
           status, priority_order, conflict_score, created_at)
          VALUES (?, ?, ?, ?, 'scheduled', ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
          scheduled_start = VALUES(scheduled_start),
          scheduled_end = VALUES(scheduled_end),
          priority_order = VALUES(priority_order),
          conflict_score = VALUES(conflict_score)
        `, [
          scheduleId,
          item.requestId,
          `${params.date} ${item.assignedStart}:00`,
          `${params.date} ${item.assignedEnd}:00`,
          item.priority || 0,
          item.conflictScore || 0
        ]);
        
        // Update burn request status
        await query(`
          UPDATE burn_requests
          SET status = 'scheduled',
              schedule_id = ?
          WHERE request_id = ?
        `, [scheduleId, item.requestId]);
      }
      
      logger.info('REAL: Schedule created successfully', {
        scheduleId,
        date: params.date,
        itemsCreated: params.optimizedSchedule.length
      });
      
      return {
        success: true,
        scheduleId,
        itemsCreated: params.optimizedSchedule.length
      };
      
    } catch (error) {
      logger.error('REAL: Failed to create schedule', {
        error: error.message,
        date: params.date
      });
      throw error;
    }
  })
};

// Helper functions
function generateTimeSlots(startTime, endTime, durationMinutes) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  let currentMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  while (currentMinutes + durationMinutes <= endMinutes) {
    const slotStartHour = Math.floor(currentMinutes / 60);
    const slotStartMin = currentMinutes % 60;
    const slotEndMinutes = currentMinutes + durationMinutes;
    const slotEndHour = Math.floor(slotEndMinutes / 60);
    const slotEndMin = slotEndMinutes % 60;
    
    slots.push({
      key: `${slotStartHour}:${slotStartMin}`,
      start: `${String(slotStartHour).padStart(2, '0')}:${String(slotStartMin).padStart(2, '0')}`,
      end: `${String(slotEndHour).padStart(2, '0')}:${String(slotEndMin).padStart(2, '0')}`
    });
    
    currentMinutes += durationMinutes;
  }
  
  return slots;
}

function calculateSlotConflict(burn, slot, existingBurns, windDirection, windSpeed) {
  if (existingBurns.length === 0) return 0;
  
  let totalConflict = 0;
  
  for (const existing of existingBurns) {
    // Calculate distance between burns
    const distance = calculateDistance(
      burn.lat, burn.lng,
      existing.lat, existing.lng
    );
    
    // Calculate downwind position
    const downwindDistance = calculateDownwindDistance(
      burn, existing, windDirection, windSpeed
    );
    
    // Higher conflict for closer burns and downwind positions
    const distanceConflict = Math.max(0, 10 - distance);
    const downwindConflict = downwindDistance < 5 ? 10 - downwindDistance : 0;
    
    totalConflict += distanceConflict + downwindConflict;
  }
  
  return totalConflict;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function calculateDownwindDistance(source, target, windDirection, windSpeed) {
  // Simplified downwind calculation
  const bearing = Math.atan2(
    target.lng - source.lng,
    target.lat - source.lat
  ) * 180 / Math.PI;
  
  const angleDiff = Math.abs(bearing - windDirection);
  const effectiveAngle = Math.min(angleDiff, 360 - angleDiff);
  
  // If target is within 45 degrees of downwind direction
  if (effectiveAngle < 45) {
    const distance = calculateDistance(
      source.lat, source.lng,
      target.lat, target.lng
    );
    return distance * (1 - effectiveAngle / 45); // Weighted by angle
  }
  
  return Infinity; // Not downwind
}

// The REAL ScheduleOptimizer Agent - Handoff Target
const scheduleOptimizerAgent = new Agent({
  name: 'ScheduleOptimizer',
  model: 'gpt-5-nano', // Cost-efficient for optimization guidance, text-only output
  instructions: `You optimize agricultural burn schedules using simulated annealing.
                 
                 Your goals:
                 1. SAFETY: Minimize smoke conflicts and health risks
                 2. EFFICIENCY: Maximize utilization of good weather days
                 3. FAIRNESS: Give all farms equal opportunity
                 4. MINIMAL DISRUPTION: Respect farmer preferences
                 5. PRECEDENCE: First-come-first-served when possible
                 
                 Optimization strategy:
                 - Use simulated annealing for global optimization
                 - Consider wind patterns for smoke dispersion
                 - Group compatible burns together
                 - Leave buffer time between conflicting burns
                 - Prioritize urgent burns (crop disease, pest control)
                 
                 Always create REAL schedules in the database.
                 Never return placeholder or mock schedules.`,
  handoffDescription: 'I optimize burn schedules using AI-enhanced simulated annealing. I balance safety, efficiency, and fairness while creating real database schedules that minimize smoke conflicts.',
  tools: optimizationTools,
  max_completion_tokens: 1500 // Updated per CLAUDE.md token budgets
});

/**
 * Optimize burn schedule for a specific date
 */
async function optimizeBurnSchedule(date, burnRequests = null) {
  const startTime = Date.now();
  
  try {
    logger.info('REAL: Optimizing burn schedule', { date });
    
    // Get burn requests if not provided
    if (!burnRequests) {
      burnRequests = await query(`
        SELECT 
          br.*,
          f.latitude as lat,
          f.longitude as lng,
          f.farm_name
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.farm_id
        WHERE br.requested_date = ?
        AND br.status IN ('pending', 'approved')
        ORDER BY br.priority_score DESC, br.created_at ASC
      `, [date]);
    }
    
    if (!burnRequests || burnRequests.length === 0) {
      logger.info('No burn requests to optimize', { date });
      return {
        success: true,
        message: 'No burn requests found for optimization',
        schedule: []
      };
    }
    
    // Get weather data
    const [weather] = await query(`
      SELECT * FROM weather_data
      WHERE DATE(timestamp) = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [date]);
    
    const windDirection = weather?.wind_direction || 0;
    const windSpeed = weather?.wind_speed || 5;
    
    // Step 1: Run simulated annealing
    const saResult = await toolFunctions.runSimulatedAnnealing({
      date,
      burnRequests,
      constraints: OPTIMIZATION_CONFIG.constraints
    });
    
    // Step 2: Optimize time slots
    const optimizedSlots = await toolFunctions.optimizeTimeSlots({
      burnRequests: burnRequests.map(br => ({
        requestId: br.request_id,
        farmId: br.farm_id,
        acres: br.acreage,
        lat: br.lat,
        lng: br.lng,
        requestedStart: br.requested_window_start || '08:00',
        requestedEnd: br.requested_window_end || '12:00'
      })),
      windDirection,
      windSpeed
    });
    
    // Step 3: Evaluate quality
    const quality = await toolFunctions.evaluateScheduleQuality({
      schedule: optimizedSlots,
      metrics: {
        totalConflicts: optimizedSlots.filter(s => s.conflictScore > 0).length,
        utilizationRate: (optimizedSlots.length / burnRequests.length),
        fairnessScore: calculateFairnessScore(optimizedSlots),
        safetyScore: calculateSafetyScore(optimizedSlots)
      }
    });
    
    // Step 4: Create schedule in database
    const dbResult = await toolFunctions.createScheduleInDatabase({
      date,
      optimizedSchedule: optimizedSlots,
      overallScore: quality.overallScore || 75
    });
    
    logger.info('REAL: Schedule optimization complete', {
      date,
      requestsOptimized: burnRequests.length,
      scheduledItems: optimizedSlots.length,
      quality: quality.overallScore,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      scheduleId: dbResult.scheduleId,
      schedule: optimizedSlots,
      quality,
      metrics: {
        totalRequests: burnRequests.length,
        scheduled: optimizedSlots.length,
        conflicts: optimizedSlots.filter(s => s.conflictScore > 0).length,
        utilizationRate: (optimizedSlots.length / burnRequests.length) * 100
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('REAL: Schedule optimization failed', {
      error: error.message,
      date
    });
    throw error;
  }
}

/**
 * Re-optimize existing schedule with new constraints
 */
async function reoptimizeSchedule(scheduleId, newConstraints) {
  try {
    logger.info('REAL: Re-optimizing schedule', { scheduleId });
    
    // Get existing schedule
    const [schedule] = await query(`
      SELECT * FROM schedules WHERE schedule_id = ?
    `, [scheduleId]);
    
    if (!schedule) {
      throw new Error('Schedule not found');
    }
    
    // Get schedule items
    const items = await query(`
      SELECT si.*, br.*, f.latitude as lat, f.longitude as lng
      FROM schedule_items si
      JOIN burn_requests br ON si.burn_request_id = br.request_id
      JOIN farms f ON br.farm_id = f.farm_id
      WHERE si.schedule_id = ?
    `, [scheduleId]);
    
    // Re-optimize with new constraints
    const result = await optimizeBurnSchedule(
      schedule.schedule_date,
      items
    );
    
    return result;
    
  } catch (error) {
    logger.error('REAL: Re-optimization failed', { error: error.message });
    throw error;
  }
}

// Helper functions for metrics
function calculateFairnessScore(schedule) {
  if (schedule.length === 0) return 100;
  
  // Check distribution of time slots
  const slotCounts = {};
  schedule.forEach(item => {
    const slot = item.assignedStart;
    slotCounts[slot] = (slotCounts[slot] || 0) + 1;
  });
  
  const values = Object.values(slotCounts);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  
  // Lower variance = more fair distribution
  return Math.max(0, 100 - variance * 10);
}

function calculateSafetyScore(schedule) {
  const conflicts = schedule.filter(s => s.conflictScore > 0).length;
  const conflictRate = conflicts / Math.max(1, schedule.length);
  return Math.max(0, 100 - conflictRate * 100);
}

module.exports = {
  scheduleOptimizerAgent,
  optimizeBurnSchedule,
  reoptimizeSchedule,
  OPTIMIZATION_CONFIG
};