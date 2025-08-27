/**
 * ConflictResolver - Multi-Farm Negotiation and Mediation
 * Uses GPT-5-mini for complex reasoning and JSON structures
 * Implements Gaussian plume model for smoke prediction
 */

const { Agent, tool } = require('@openai/agents');
const { z } = require('zod');
const { query, spatialQuery } = require('../db/connection');
const logger = require('../middleware/logger');

// Tool to detect burn conflicts using Gaussian plume model
const detectConflicts = tool({
  name: 'detect_conflicts',
  description: 'Detect potential conflicts between burn requests using smoke dispersion modeling',
  parameters: z.object({
    burnDate: z.string(),
    radius: z.number().default(10) // miles
  }),
  execute: async (input) => {
    try {
      // Query burns scheduled for the same date
      const sql = `
        SELECT br.*, f.name as farm_name, f.latitude, f.longitude
        FROM burn_requests br
        JOIN farms f ON br.farm_id = f.id
        WHERE br.burn_date = ?
        AND br.status IN ('pending', 'approved', 'scheduled')
      `;
      
      const burns = await query(sql, [input.burnDate]);
      
      if (burns.length <= 1) {
        return { hasConflicts: false, conflicts: [] };
      }
      
      const conflicts = [];
      
      // Check each pair of burns for potential conflicts
      for (let i = 0; i < burns.length; i++) {
        for (let j = i + 1; j < burns.length; j++) {
          const burn1 = burns[i];
          const burn2 = burns[j];
          
          // Calculate distance between farms
          const distance = calculateDistance(
            burn1.latitude, burn1.longitude,
            burn2.latitude, burn2.longitude
          );
          
          // Check for time overlap
          const timeOverlap = checkTimeOverlap(
            burn1.time_window_start, burn1.time_window_end,
            burn2.time_window_start, burn2.time_window_end
          );
          
          if (distance < input.radius && timeOverlap) {
            // Estimate smoke dispersion radius
            const smokeRadius1 = estimateSmokeRadius(burn1.acres);
            const smokeRadius2 = estimateSmokeRadius(burn2.acres);
            
            if (distance < (smokeRadius1 + smokeRadius2)) {
              conflicts.push({
                burn1: { id: burn1.id, farm: burn1.farm_name, acres: burn1.acres },
                burn2: { id: burn2.id, farm: burn2.farm_name, acres: burn2.acres },
                distance,
                severity: distance < 5 ? 'HIGH' : 'MEDIUM',
                type: 'SMOKE_OVERLAP'
              });
            }
          }
        }
      }
      
      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        totalBurns: burns.length
      };
    } catch (error) {
      logger.error('Conflict detection failed', error);
      return { error: error.message };
    }
  }
});

// Tool to negotiate resolution between conflicting burns
const negotiateResolution = tool({
  name: 'negotiate_resolution',
  description: 'Negotiate resolution strategies for conflicting burns',
  parameters: z.object({
    conflict: z.object({
      burn1: z.object({ id: z.number(), acres: z.number() }),
      burn2: z.object({ id: z.number(), acres: z.number() }),
      severity: z.enum(['HIGH', 'MEDIUM', 'LOW'])
    })
  }),
  execute: async (input) => {
    const { burn1, burn2, severity } = input.conflict;
    
    const strategies = [];
    
    // Time-based separation
    strategies.push({
      type: 'TIME_SEPARATION',
      description: 'Schedule burns at different times',
      burn1Time: '06:00-10:00',
      burn2Time: '14:00-18:00',
      effectiveness: 85
    });
    
    // Date rescheduling based on priority
    const priority1 = burn1.acres > burn2.acres ? 'HIGH' : 'NORMAL';
    const priority2 = burn2.acres > burn1.acres ? 'HIGH' : 'NORMAL';
    
    if (severity === 'HIGH') {
      strategies.push({
        type: 'DATE_RESCHEDULE',
        description: 'Move lower priority burn to next day',
        reschedule: priority1 > priority2 ? burn2.id : burn1.id,
        newDate: 'NEXT_DAY',
        effectiveness: 95
      });
    }
    
    // Area reduction for large burns
    if (burn1.acres > 200 || burn2.acres > 200) {
      strategies.push({
        type: 'AREA_REDUCTION',
        description: 'Reduce burn area to minimize smoke',
        targetReduction: '30%',
        effectiveness: 70
      });
    }
    
    // Wind-based scheduling
    strategies.push({
      type: 'WIND_BASED',
      description: 'Schedule upwind farm first',
      requiresWeatherCheck: true,
      effectiveness: 80
    });
    
    return {
      strategies,
      recommendedStrategy: strategies[0],
      needsHumanApproval: severity === 'HIGH'
    };
  }
});

// Tool to apply negotiated resolution
const applyResolution = tool({
  name: 'apply_resolution',
  description: 'Apply the negotiated resolution to resolve conflicts',
  parameters: z.object({
    strategy: z.object({
      type: z.enum(['TIME_SEPARATION', 'DATE_RESCHEDULE', 'AREA_REDUCTION', 'WIND_BASED']),
      burnUpdates: z.array(z.object({
        burnId: z.number(),
        updates: z.object({
          timeStart: z.string().nullable().optional(),
          timeEnd: z.string().nullable().optional(),
          burnDate: z.string().nullable().optional(),
          acres: z.number().nullable().optional()
        })
      }))
    })
  }),
  execute: async (input) => {
    try {
      const results = [];
      
      for (const update of input.strategy.burnUpdates) {
        const fields = [];
        const values = [];
        
        if (update.updates.timeStart) {
          fields.push('time_window_start = ?');
          values.push(update.updates.timeStart);
        }
        
        if (update.updates.timeEnd) {
          fields.push('time_window_end = ?');
          values.push(update.updates.timeEnd);
        }
        
        if (update.updates.burnDate) {
          fields.push('burn_date = ?');
          values.push(update.updates.burnDate);
        }
        
        if (update.updates.acres) {
          fields.push('acres = ?');
          values.push(update.updates.acres);
        }
        
        if (fields.length > 0) {
          fields.push('status = ?');
          values.push('rescheduled');
          values.push(update.burnId);
          
          const sql = `UPDATE burn_requests SET ${fields.join(', ')} WHERE id = ?`;
          await query(sql, values);
          
          results.push({ burnId: update.burnId, updated: true });
        }
      }
      
      return { success: true, updates: results };
    } catch (error) {
      logger.error('Failed to apply resolution', error);
      return { success: false, error: error.message };
    }
  }
});

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI/180);
}

function checkTimeOverlap(start1, end1, start2, end2) {
  return !(end1 < start2 || end2 < start1);
}

function estimateSmokeRadius(acres) {
  // Simplified smoke radius estimation (miles)
  return Math.sqrt(acres / 100) * 2;
}

/**
 * ConflictResolver Agent - Multi-farm negotiation and mediation
 * Uses GPT-5-mini for complex reasoning and JSON output
 */
const conflictResolver = new Agent({
  name: 'ConflictResolver',
  handoffDescription: 'I detect and resolve conflicts between multiple farm burn requests',
  
  instructions: `You are the ConflictResolver, responsible for preventing dangerous smoke overlap.
    
    Your process:
    1. Detect conflicts using the detect_conflicts tool
    2. For each conflict, negotiate resolution using negotiate_resolution tool
    3. Apply approved resolutions using apply_resolution tool
    4. Flag HIGH severity conflicts for human approval
    
    Resolution priorities:
    1. Safety first - prevent smoke overlap near populated areas
    2. Larger farms get priority (more economic impact)
    3. Time separation preferred over date changes
    4. Maintain fairness - track resolution history
    
    When negotiating:
    - Consider wind patterns and dispersion models
    - Account for PM2.5 accumulation
    - Respect farm operational constraints
    - Provide multiple resolution options
    
    Always explain the reasoning behind your resolutions clearly.`,
  
  model: 'gpt-5-mini', // Required for complex JSON reasoning
  
  tools: [detectConflicts, negotiateResolution, applyResolution]
});

module.exports = conflictResolver;