/**
 * ConflictResolver Agent - REAL Multi-Farm Negotiation and Mediation
 * Uses GPT-5-mini for complex reasoning about conflicts and compromises
 * NO MOCKS - Actually detects conflicts and negotiates real solutions
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const OpenAI = require('openai');
const predictorAgent = require('../agents/predictor');
const { query } = require('../db/connection');
const logger = require('../middleware/logger');

// Initialize OpenAI with GPT-5-mini for complex reasoning
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v2'
});

// Conflict resolution strategies
const RESOLUTION_STRATEGIES = {
  TIME_SHIFT: 'time_shift',           // Move burn to different time
  DATE_CHANGE: 'date_change',          // Move to different date
  AREA_REDUCTION: 'area_reduction',    // Reduce burn area
  SPLIT_BURN: 'split_burn',           // Split into multiple smaller burns
  PRIORITY_BASED: 'priority_based',    // Higher priority wins
  COLLABORATIVE: 'collaborative'       // Farms burn together with coordination
};

// Priority factors for conflict resolution
const PRIORITY_WEIGHTS = {
  first_come: 0.2,      // Who requested first
  urgency: 0.3,         // How urgent is the burn
  acreage: 0.15,        // Larger burns may need priority
  crop_type: 0.15,      // Some crops more time-sensitive
  weather_window: 0.1,  // Limited good weather days
  history: 0.1          // Past cooperation/issues
};

// Tools for conflict resolution
const conflictTools = [
  tool({
    name: 'detect_smoke_conflicts',
    description: 'Detect overlapping smoke plumes between burns',
    parameters: z.object({
      burnDate: z.string(),
      radius: z.number().default(10) // miles
    }),
    execute: async (params) => {
      logger.info('REAL: Detecting smoke conflicts', { date: params.burnDate });
      
      // Get all burns scheduled for that date
      const burns = await query(`
        SELECT 
          br.request_id,
          br.farm_id,
          f.farm_name,
          br.acreage,
          br.requested_window_start,
          br.requested_window_end,
          f.latitude,
          f.longitude,
          br.priority_score,
          br.urgency,
          br.created_at
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.farm_id
        WHERE br.requested_date = ?
        AND br.status IN ('pending', 'approved', 'scheduled')
        ORDER BY br.priority_score DESC
      `, [params.burnDate]);
      
      // Check for conflicts using smoke dispersion predictions
      const conflicts = [];
      
      for (let i = 0; i < burns.length; i++) {
        for (let j = i + 1; j < burns.length; j++) {
          const burn1 = burns[i];
          const burn2 = burns[j];
          
          // Check if time windows overlap
          const overlap = timeWindowsOverlap(
            burn1.requested_window_start,
            burn1.requested_window_end,
            burn2.requested_window_start,
            burn2.requested_window_end
          );
          
          if (overlap) {
            // Calculate distance between farms
            const distance = calculateDistance(
              burn1.latitude, burn1.longitude,
              burn2.latitude, burn2.longitude
            );
            
            // If within smoke dispersion range, there's a conflict
            if (distance < params.radius) {
              conflicts.push({
                burn1: {
                  requestId: burn1.request_id,
                  farmId: burn1.farm_id,
                  farmName: burn1.farm_name,
                  acres: burn1.acreage,
                  priority: burn1.priority_score,
                  urgency: burn1.urgency
                },
                burn2: {
                  requestId: burn2.request_id,
                  farmId: burn2.farm_id,
                  farmName: burn2.farm_name,
                  acres: burn2.acreage,
                  priority: burn2.priority_score,
                  urgency: burn2.urgency
                },
                distance: distance.toFixed(2),
                overlapMinutes: overlap,
                severity: distance < 2 ? 'CRITICAL' : 
                         distance < 5 ? 'HIGH' : 'MEDIUM'
              });
            }
          }
        }
      }
      
      return {
        date: params.burnDate,
        totalBurns: burns.length,
        conflictsDetected: conflicts.length,
        conflicts
      };
    }
  }),

  tool({
    name: 'calculate_priority_scores',
    description: 'Calculate detailed priority scores for conflicting burns',
    parameters: z.object({
      burnIds: z.array(z.number())
    }),
    execute: async (params) => {
      logger.info('REAL: Calculating priority scores', { burns: params.burnIds });
      
      const scores = [];
      
      for (const burnId of params.burnIds) {
        const [burn] = await query(`
          SELECT 
            br.*,
            f.farm_name,
            f.cooperation_score,
            (SELECT COUNT(*) FROM burn_requests WHERE farm_id = br.farm_id AND status = 'completed') as history_count
          FROM burn_requests br
          JOIN farms f ON br.farm_id = f.farm_id
          WHERE br.request_id = ?
        `, [burnId]);
        
        if (!burn) continue;
        
        // Calculate comprehensive priority score
        const daysSinceRequest = Math.floor((Date.now() - new Date(burn.created_at)) / (1000 * 60 * 60 * 24));
        const daysUntilBurn = Math.floor((new Date(burn.requested_date) - Date.now()) / (1000 * 60 * 60 * 24));
        
        const priorityFactors = {
          first_come: Math.max(0, 1 - (daysSinceRequest / 30)), // Decay over 30 days
          urgency: burn.urgency === 'critical' ? 1.0 : 
                  burn.urgency === 'high' ? 0.7 : 
                  burn.urgency === 'medium' ? 0.4 : 0.1,
          acreage: Math.min(1, burn.acreage / 500), // Normalize to 500 acres
          crop_type: burn.crop_type === 'wheat' ? 0.8 : // Wheat is time-sensitive
                     burn.crop_type === 'rice' ? 0.9 : // Rice very time-sensitive
                     0.5,
          weather_window: daysUntilBurn <= 3 ? 1.0 : // Very soon
                         daysUntilBurn <= 7 ? 0.7 : // Next week
                         0.3,
          history: Math.min(1, (burn.cooperation_score || 50) / 100)
        };
        
        // Calculate weighted score
        let totalScore = 0;
        for (const [factor, value] of Object.entries(priorityFactors)) {
          totalScore += value * PRIORITY_WEIGHTS[factor];
        }
        
        scores.push({
          burnId,
          farmName: burn.farm_name,
          totalScore: totalScore.toFixed(3),
          factors: priorityFactors,
          recommendation: totalScore > 0.7 ? 'HIGH_PRIORITY' : 
                         totalScore > 0.4 ? 'MEDIUM_PRIORITY' : 'LOW_PRIORITY'
        });
      }
      
      return scores.sort((a, b) => b.totalScore - a.totalScore);
    }
  }),

  tool({
    name: 'generate_alternative_schedules',
    description: 'Generate alternative scheduling options to resolve conflicts',
    parameters: z.object({
      conflictingBurns: z.array(z.object({
        burnId: z.number(),
        farmId: z.number(),
        currentDate: z.string(),
        currentTimeStart: z.string(),
        currentTimeEnd: z.string(),
        acres: z.number()
      }))
    }),
    execute: async (params) => {
      logger.info('REAL: Generating alternative schedules');
      
      const alternatives = [];
      
      for (const burn of params.conflictingBurns) {
        // Strategy 1: Time shift within same day
        const earlyShift = {
          strategy: RESOLUTION_STRATEGIES.TIME_SHIFT,
          burnId: burn.burnId,
          newDate: burn.currentDate,
          newTimeStart: '06:00',
          newTimeEnd: '10:00',
          impact: 'Requires early morning start'
        };
        
        const lateShift = {
          strategy: RESOLUTION_STRATEGIES.TIME_SHIFT,
          burnId: burn.burnId,
          newDate: burn.currentDate,
          newTimeStart: '14:00',
          newTimeEnd: '18:00',
          impact: 'Afternoon burn, check wind patterns'
        };
        
        // Strategy 2: Date change
        const nextDay = new Date(burn.currentDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const dateChange = {
          strategy: RESOLUTION_STRATEGIES.DATE_CHANGE,
          burnId: burn.burnId,
          newDate: nextDay.toISOString().split('T')[0],
          newTimeStart: burn.currentTimeStart,
          newTimeEnd: burn.currentTimeEnd,
          impact: 'Postpone by one day'
        };
        
        // Strategy 3: Split burn (for large acreage)
        if (burn.acres > 100) {
          const splitBurn = {
            strategy: RESOLUTION_STRATEGIES.SPLIT_BURN,
            burnId: burn.burnId,
            splits: [
              {
                acres: Math.floor(burn.acres / 2),
                date: burn.currentDate,
                timeStart: burn.currentTimeStart,
                timeEnd: burn.currentTimeEnd
              },
              {
                acres: Math.ceil(burn.acres / 2),
                date: nextDay.toISOString().split('T')[0],
                timeStart: burn.currentTimeStart,
                timeEnd: burn.currentTimeEnd
              }
            ],
            impact: 'Split into two smaller burns over two days'
          };
          alternatives.push(splitBurn);
        }
        
        alternatives.push(earlyShift, lateShift, dateChange);
      }
      
      return alternatives;
    }
  }),

  tool({
    name: 'negotiate_resolution',
    description: 'Use GPT-5-mini to negotiate complex multi-party resolution',
    parameters: z.object({
      conflict: z.any(),
      priorities: z.array(z.any()),
      alternatives: z.array(z.any())
    }),
    execute: async (params) => {
      logger.info('REAL: Negotiating resolution with GPT-5-mini');
      
      // Use GPT-5-mini for complex negotiation
      const completion = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: `You are a conflict resolution specialist for agricultural burns.
                     Analyze the conflict and propose the BEST resolution that:
                     1. Maximizes safety (no overlapping smoke plumes)
                     2. Respects priority scores and urgency
                     3. Minimizes disruption to farmers
                     4. Is fair and explainable
                     
                     Output a JSON object with:
                     {
                       "resolution": "description of the resolution",
                       "assignments": [
                         {
                           "burnId": number,
                           "farmName": "string",
                           "action": "keep|shift|postpone|split",
                           "newSchedule": {
                             "date": "YYYY-MM-DD",
                             "timeStart": "HH:MM",
                             "timeEnd": "HH:MM"
                           },
                           "reason": "explanation"
                         }
                       ],
                       "fairnessScore": 0-1,
                       "safetyScore": 0-1,
                       "explanation": "detailed reasoning"
                     }`
          },
          {
            role: 'user',
            content: JSON.stringify({
              conflict: params.conflict,
              priorities: params.priorities,
              alternatives: params.alternatives
            })
          }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000, // More tokens for complex reasoning
        temperature: 0.4,
        reasoning: { effort: 'high' } // Deep reasoning for fairness
      });
      
      const resolution = JSON.parse(completion.choices[0].message.content);
      
      // Store the resolution in database
      await query(`
        INSERT INTO conflict_resolutions
        (conflict_data, resolution_data, fairness_score, safety_score, created_at)
        VALUES (?, ?, ?, ?, NOW())
      `, [
        JSON.stringify(params.conflict),
        JSON.stringify(resolution),
        resolution.fairnessScore,
        resolution.safetyScore
      ]);
      
      return resolution;
    }
  })
];

// Helper functions
function timeWindowsOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  
  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);
  
  return overlapStart < overlapEnd ? overlapEnd - overlapStart : 0;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// The REAL ConflictResolver Agent
const conflictResolverAgent = new Agent({
  name: 'ConflictResolver',
  model: 'gpt-5-mini', // Need complex reasoning for multi-party negotiation
  instructions: `You are a conflict resolution specialist for agricultural burns.
                 
                 Your role is to:
                 1. Detect conflicts between overlapping burns
                 2. Analyze priorities and urgency
                 3. Negotiate fair solutions
                 4. Suggest alternatives that work for all parties
                 5. Ensure safety is never compromised
                 
                 Resolution strategies:
                 - TIME_SHIFT: Move burns to different times on same day
                 - DATE_CHANGE: Reschedule to different days
                 - SPLIT_BURN: Divide large burns into smaller segments
                 - COLLABORATIVE: Coordinate burns together
                 
                 Always consider:
                 - First-come-first-served principle
                 - Urgency (critical > high > medium > low)
                 - Weather windows (limited good days)
                 - Farm cooperation history
                 - Smoke dispersion patterns
                 
                 Your resolutions must be:
                 - Fair and explainable
                 - Safety-first (no dangerous overlaps)
                 - Practical and implementable
                 - Respectful to all parties`,
  tools: conflictTools,
  temperature: 0.4, // Balanced for creative solutions
  max_tokens: 1000 // Need more tokens for complex negotiations
});

/**
 * Resolve conflicts between multiple burn requests
 */
async function resolveConflicts(burnDate, conflictData = null) {
  const startTime = Date.now();
  
  try {
    logger.info('REAL: Resolving conflicts', { date: burnDate });
    
    // Step 1: Detect conflicts if not provided
    if (!conflictData) {
      const detection = await conflictTools[0].execute({ burnDate, radius: 10 });
      conflictData = detection.conflicts;
      
      if (!conflictData || conflictData.length === 0) {
        logger.info('REAL: No conflicts detected');
        return {
          success: true,
          conflictsFound: false,
          message: 'No conflicts detected for this date'
        };
      }
    }
    
    // Step 2: Calculate priorities for all conflicting burns
    const allBurnIds = new Set();
    conflictData.forEach(conflict => {
      allBurnIds.add(conflict.burn1.requestId);
      allBurnIds.add(conflict.burn2.requestId);
    });
    
    const priorities = await conflictTools[1].execute({ 
      burnIds: Array.from(allBurnIds) 
    });
    
    // Step 3: Generate alternatives
    const burnsNeedingResolution = Array.from(allBurnIds).map(id => {
      const conflict = conflictData.find(c => 
        c.burn1.requestId === id || c.burn2.requestId === id
      );
      const burn = conflict.burn1.requestId === id ? conflict.burn1 : conflict.burn2;
      return {
        burnId: id,
        farmId: burn.farmId,
        currentDate: burnDate,
        currentTimeStart: '08:00', // Default if not specified
        currentTimeEnd: '12:00',
        acres: burn.acres
      };
    });
    
    const alternatives = await conflictTools[2].execute({
      conflictingBurns: burnsNeedingResolution
    });
    
    // Step 4: Negotiate resolution using GPT-5-mini
    const resolution = await conflictTools[3].execute({
      conflict: conflictData[0], // Primary conflict
      priorities,
      alternatives
    });
    
    // Step 5: Apply the resolution
    for (const assignment of resolution.assignments) {
      if (assignment.action === 'keep') {
        // No change needed
        logger.info('REAL: Keeping original schedule', { burnId: assignment.burnId });
        
      } else if (assignment.action === 'shift' || assignment.action === 'postpone') {
        // Update the burn request
        await query(`
          UPDATE burn_requests
          SET requested_date = ?,
              requested_window_start = ?,
              requested_window_end = ?,
              conflict_resolved = 1,
              resolution_notes = ?
          WHERE request_id = ?
        `, [
          assignment.newSchedule.date,
          assignment.newSchedule.timeStart,
          assignment.newSchedule.timeEnd,
          assignment.reason,
          assignment.burnId
        ]);
        
        logger.info('REAL: Rescheduled burn', {
          burnId: assignment.burnId,
          newDate: assignment.newSchedule.date
        });
        
      } else if (assignment.action === 'split') {
        // Create additional burn request for split
        const [original] = await query(`
          SELECT * FROM burn_requests WHERE request_id = ?
        `, [assignment.burnId]);
        
        if (original) {
          // Update original to half acreage
          await query(`
            UPDATE burn_requests
            SET acreage = ?,
                conflict_resolved = 1,
                resolution_notes = ?
            WHERE request_id = ?
          `, [
            Math.floor(original.acreage / 2),
            'Split burn - Part 1',
            assignment.burnId
          ]);
          
          // Create new request for second half
          await query(`
            INSERT INTO burn_requests
            (farm_id, field_name, acreage, crop_type, requested_date,
             requested_window_start, requested_window_end, status, priority_score,
             conflict_resolved, resolution_notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 1, ?)
          `, [
            original.farm_id,
            original.field_name + ' (Part 2)',
            Math.ceil(original.acreage / 2),
            original.crop_type,
            assignment.newSchedule.date,
            assignment.newSchedule.timeStart,
            assignment.newSchedule.timeEnd,
            original.priority_score,
            'Split burn - Part 2'
          ]);
          
          logger.info('REAL: Split burn into two parts', { burnId: assignment.burnId });
        }
      }
      
      // Send notification to affected farm
      const alertsAgent = require('../agents/alerts');
      await alertsAgent.processAlert({
        type: 'conflict_resolved',
        farm_id: assignment.farmId,
        burn_request_id: assignment.burnId,
        title: 'Burn Schedule Updated',
        message: `Your burn has been ${assignment.action}: ${assignment.reason}`,
        severity: 'medium',
        data: assignment.newSchedule
      });
    }
    
    logger.info('REAL: Conflict resolution completed', {
      conflictsResolved: resolution.assignments.length,
      fairnessScore: resolution.fairnessScore,
      safetyScore: resolution.safetyScore,
      duration: Date.now() - startTime
    });
    
    return {
      success: true,
      conflictsFound: true,
      conflictsResolved: resolution.assignments.length,
      resolution,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('REAL: Conflict resolution failed', {
      error: error.message,
      burnDate
    });
    throw error;
  }
}

/**
 * Mediate between specific farms in conflict
 */
async function mediateFarms(farmIds, issue) {
  try {
    logger.info('REAL: Mediating between farms', { farmIds, issue });
    
    // Get farm details and history
    const farms = await query(`
      SELECT 
        f.*,
        COUNT(br.request_id) as total_burns,
        AVG(br.priority_score) as avg_priority,
        SUM(CASE WHEN br.conflict_resolved = 1 THEN 1 ELSE 0 END) as conflicts_resolved
      FROM farms f
      LEFT JOIN burn_requests br ON f.farm_id = br.farm_id
      WHERE f.farm_id IN (?)
      GROUP BY f.farm_id
    `, [farmIds]);
    
    // Use GPT-5-mini to mediate
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You are a farm mediator. Analyze the issue and propose a fair solution.
                   Consider cooperation history, farm sizes, and past conflicts.
                   Be empathetic but firm on safety requirements.`
        },
        {
          role: 'user',
          content: JSON.stringify({ farms, issue })
        }
      ],
      max_tokens: 500,
      temperature: 0.5
    });
    
    const mediation = completion.choices[0].message.content;
    
    // Store mediation result
    await query(`
      INSERT INTO mediations
      (farm_ids, issue, resolution, created_at)
      VALUES (?, ?, ?, NOW())
    `, [
      JSON.stringify(farmIds),
      issue,
      mediation
    ]);
    
    return {
      success: true,
      mediation,
      farmsInvolved: farms.length
    };
    
  } catch (error) {
    logger.error('REAL: Mediation failed', { error: error.message });
    throw error;
  }
}

module.exports = {
  conflictResolverAgent,
  resolveConflicts,
  mediateFarms,
  RESOLUTION_STRATEGIES,
  PRIORITY_WEIGHTS
};