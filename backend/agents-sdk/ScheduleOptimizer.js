/**
 * ScheduleOptimizer - AI-Enhanced Simulated Annealing
 * Uses GPT-5-nano for cost-effective optimization guidance
 * Implements real simulated annealing algorithm
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Tool to run simulated annealing optimization
const runSimulatedAnnealing = tool({
  name: 'run_simulated_annealing',
  description: 'Run simulated annealing algorithm to optimize burn schedule',
  parameters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string()
    }),
    constraints: z.object({
      maxBurnsPerDay: z.number().default(5),
      minTimeSeparation: z.number().default(4), // hours
      priorityWeights: z.object({
        acreage: z.number().default(0.3),
        urgency: z.number().default(0.4),
        weather: z.number().default(0.3)
      }).nullable().optional()
    }).nullable().optional()
  }),
  execute: async (input) => {
    try {
      // Fetch all burn requests in date range
      const sql = `
        SELECT br.*, f.latitude, f.longitude, f.name as farm_name
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.id
        WHERE br.burn_date BETWEEN ? AND ?
        AND br.status IN ('pending', 'approved')
        ORDER BY br.urgency DESC, br.acres DESC
      `;
      
      const burns = await query(sql, [input.dateRange.start, input.dateRange.end]);
      
      if (burns.length === 0) {
        return { optimized: false, message: 'No burns to optimize' };
      }
      
      // Initialize simulated annealing parameters
      const params = {
        temperature: 1000,
        coolingRate: 0.95,
        minTemp: 0.01,
        maxIterations: 10000
      };
      
      // Create initial solution
      let currentSolution = createInitialSchedule(burns, input.constraints);
      let currentCost = calculateScheduleCost(currentSolution);
      
      let bestSolution = [...currentSolution];
      let bestCost = currentCost;
      
      let iteration = 0;
      let temperature = params.temperature;
      
      // Simulated annealing main loop
      while (temperature > params.minTemp && iteration < params.maxIterations) {
        // Generate neighbor solution
        const neighbor = generateNeighbor(currentSolution);
        const neighborCost = calculateScheduleCost(neighbor);
        
        // Calculate acceptance probability
        const delta = neighborCost - currentCost;
        const acceptanceProbability = delta < 0 ? 1 : Math.exp(-delta / temperature);
        
        // Accept or reject new solution
        if (Math.random() < acceptanceProbability) {
          currentSolution = neighbor;
          currentCost = neighborCost;
          
          // Update best solution if improved
          if (currentCost < bestCost) {
            bestSolution = [...currentSolution];
            bestCost = currentCost;
          }
        }
        
        // Cool down
        temperature *= params.coolingRate;
        iteration++;
      }
      
      // Calculate optimization metrics
      const initialCost = calculateScheduleCost(
        createInitialSchedule(burns, input.constraints)
      );
      const improvement = ((initialCost - bestCost) / initialCost * 100).toFixed(2);
      
      return {
        optimized: true,
        schedule: formatSchedule(bestSolution),
        metrics: {
          iterations: iteration,
          initialCost,
          finalCost: bestCost,
          improvement: `${improvement}%`,
          conflictsResolved: countConflicts(burns) - countConflicts(bestSolution)
        }
      };
    } catch (error) {
      logger.error('Simulated annealing failed', error);
      return { optimized: false, error: error.message };
    }
  }
});

// Tool to evaluate schedule quality
const evaluateSchedule = tool({
  name: 'evaluate_schedule',
  description: 'Evaluate the quality of an optimized schedule',
  parameters: z.object({
    schedule: z.array(z.object({
      burnId: z.number(),
      date: z.string(),
      timeSlot: z.string(),
      farmName: z.string(),
      acres: z.number()
    }))
  }),
  execute: async (input) => {
    const metrics = {
      totalBurns: input.schedule.length,
      daysUsed: new Set(input.schedule.map(b => b.date)).size,
      averageBurnsPerDay: 0,
      timeUtilization: 0,
      largestBurnFirst: false,
      conflictFree: true
    };
    
    // Calculate average burns per day
    metrics.averageBurnsPerDay = metrics.totalBurns / metrics.daysUsed;
    
    // Check if largest burns are scheduled first
    const sortedByAcres = [...input.schedule].sort((a, b) => b.acres - a.acres);
    metrics.largestBurnFirst = 
      input.schedule[0].burnId === sortedByAcres[0].burnId;
    
    // Calculate time slot utilization
    const timeSlots = ['morning', 'afternoon', 'evening'];
    const usedSlots = new Set(input.schedule.map(b => b.timeSlot));
    metrics.timeUtilization = (usedSlots.size / timeSlots.length * 100).toFixed(1);
    
    // Check for conflicts
    for (let i = 0; i < input.schedule.length; i++) {
      for (let j = i + 1; j < input.schedule.length; j++) {
        if (input.schedule[i].date === input.schedule[j].date &&
            input.schedule[i].timeSlot === input.schedule[j].timeSlot) {
          metrics.conflictFree = false;
          break;
        }
      }
    }
    
    return metrics;
  }
});

// Tool to save optimized schedule
const saveOptimizedSchedule = tool({
  name: 'save_schedule',
  description: 'Save the optimized schedule to database',
  parameters: z.object({
    schedule: z.array(z.object({
      burnId: z.number(),
      date: z.string(),
      timeStart: z.string(),
      timeEnd: z.string()
    }))
  }),
  execute: async (input) => {
    try {
      const results = [];
      
      for (const entry of input.schedule) {
        const sql = `
          UPDATE burn_requests 
          SET burn_date = ?, 
              time_window_start = ?, 
              time_window_end = ?,
              status = 'scheduled',
              optimized_at = NOW()
          WHERE id = ?
        `;
        
        await query(sql, [
          entry.date,
          entry.timeStart,
          entry.timeEnd,
          entry.burnId
        ]);
        
        results.push({ burnId: entry.burnId, scheduled: true });
      }
      
      logger.info('Schedule saved', { count: results.length });
      return { success: true, scheduled: results.length };
    } catch (error) {
      logger.error('Failed to save schedule', error);
      return { success: false, error: error.message };
    }
  }
});

// Helper functions for simulated annealing
function createInitialSchedule(burns, constraints) {
  const schedule = [];
  const timeSlots = ['06:00-10:00', '10:00-14:00', '14:00-18:00'];
  let currentDate = new Date(burns[0].burn_date);
  let slotIndex = 0;
  
  for (const burn of burns) {
    schedule.push({
      ...burn,
      scheduledDate: currentDate.toISOString().split('T')[0],
      timeSlot: timeSlots[slotIndex % timeSlots.length]
    });
    
    slotIndex++;
    if (slotIndex >= constraints.maxBurnsPerDay) {
      currentDate.setDate(currentDate.getDate() + 1);
      slotIndex = 0;
    }
  }
  
  return schedule;
}

function generateNeighbor(solution) {
  const neighbor = [...solution];
  const i = Math.floor(Math.random() * neighbor.length);
  const j = Math.floor(Math.random() * neighbor.length);
  
  // Swap two random burns
  [neighbor[i], neighbor[j]] = [neighbor[j], neighbor[i]];
  
  return neighbor;
}

function calculateScheduleCost(schedule) {
  let cost = 0;
  
  // Penalize conflicts (same time, nearby location)
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (schedule[i].scheduledDate === schedule[j].scheduledDate &&
          schedule[i].timeSlot === schedule[j].timeSlot) {
        const distance = calculateDistance(
          schedule[i].latitude, schedule[i].longitude,
          schedule[j].latitude, schedule[j].longitude
        );
        
        if (distance < 10) {
          cost += 1000; // Heavy penalty for conflicts
        }
      }
    }
  }
  
  // Penalize delays for urgent burns
  schedule.forEach((burn, index) => {
    if (burn.urgency === 'critical') {
      cost += index * 100;
    } else if (burn.urgency === 'high') {
      cost += index * 50;
    }
  });
  
  return cost;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function countConflicts(schedule) {
  let conflicts = 0;
  for (let i = 0; i < schedule.length; i++) {
    for (let j = i + 1; j < schedule.length; j++) {
      if (schedule[i].scheduledDate === schedule[j].scheduledDate &&
          schedule[i].timeSlot === schedule[j].timeSlot) {
        conflicts++;
      }
    }
  }
  return conflicts;
}

function formatSchedule(solution) {
  return solution.map(burn => ({
    burnId: burn.id,
    date: burn.scheduledDate,
    timeSlot: burn.timeSlot,
    farmName: burn.farm_name,
    acres: burn.acres,
    urgency: burn.urgency
  }));
}

/**
 * ScheduleOptimizer Agent - AI-enhanced simulated annealing
 * Uses GPT-5-nano for cost-effective optimization
 */
const scheduleOptimizer = new Agent({
  name: 'ScheduleOptimizer',
  handoffDescription: 'I optimize burn schedules using AI-enhanced simulated annealing',
  
  instructions: `You are the ScheduleOptimizer, using simulated annealing to create optimal burn schedules.
    
    Your optimization process:
    1. Run simulated annealing using run_simulated_annealing tool
    2. Evaluate schedule quality using evaluate_schedule tool
    3. Save approved schedules using save_schedule tool
    
    Optimization priorities:
    1. Eliminate all conflicts (safety first)
    2. Prioritize urgent and large burns
    3. Minimize total days needed
    4. Balance daily workload
    
    Simulated annealing parameters:
    - Initial temperature: 1000
    - Cooling rate: 0.95
    - Stop when temperature < 0.01 or 10,000 iterations
    
    Provide clear metrics showing:
    - Conflicts resolved
    - Schedule improvement percentage
    - Time utilization efficiency
    
    Flag schedules needing review if:
    - More than 5 burns per day
    - Critical burns delayed more than 2 days
    - Optimization improvement < 20%`,
  
  model: 'gpt-5-nano', // Cost-effective for optimization guidance
  
  tools: [runSimulatedAnnealing, evaluateSchedule, saveOptimizedSchedule]
});

module.exports = scheduleOptimizer;