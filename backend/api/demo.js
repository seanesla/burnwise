/**
 * Demo Mode API Endpoints
 * Real TiDB integration with demo data isolation
 * Uses actual GPT-5 agents with cost tracking
 */

const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { demoIsolation, validateDemoSession, trackDemoCost } = require('../middleware/demoIsolation');
const { v4: uuidv4 } = require('uuid');

// Apply demo middleware to all routes
router.use(demoIsolation);
router.use(validateDemoSession);

/**
 * Initialize demo session with real TiDB data
 * Creates actual farm and optional sample data in database
 */
router.post('/initialize', async (req, res) => {
  const { mode, sessionId } = req.body;

  if (!mode || !sessionId) {
    return res.status(400).json({ 
      error: 'Missing required fields: mode and sessionId' 
    });
  }

  if (!['blank', 'preloaded'].includes(mode)) {
    return res.status(400).json({ 
      error: 'Invalid mode. Must be "blank" or "preloaded"' 
    });
  }

  try {
    // Create REAL farm and demo data in TiDB using transaction
    const result = await db.transaction(async (trx) => {
      // Create demo farm in TiDB
      const farmData = {
        name: mode === 'blank' ? 'Your Demo Farm' : 'Golden Valley Demo Farm',
        owner_name: 'Demo User',
        email: `demo_${sessionId}@burnwise.demo`,
        location_lat: 32.7157, // San Diego area for demo
        location_lon: -117.1611,
        total_acres: mode === 'blank' ? 500 : 750,
        crop_types: mode === 'blank' ? 'wheat,corn' : 'wheat,corn,rice,soybeans',
        phone: null, // Will be added if user provides
        is_demo: true,
        created_at: new Date()
      };

      const [farmResult] = await trx('farms').insert(farmData).returning('id');
      const farmId = farmResult.id || farmResult;

      console.log(`[DEMO] Created farm ${farmId} for session ${sessionId}`);

      // Create demo session record
      const sessionData = {
        session_id: sessionId,
        farm_id: farmId,
        demo_type: mode,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        tutorial_progress: JSON.stringify({ 
          step: 0, 
          completed: false,
          skipped: false 
        }),
        total_cost: 0.0000,
        is_active: true,
        created_at: new Date()
      };

      await trx('demo_sessions').insert(sessionData);

      // If preloaded mode, add sample data
      if (mode === 'preloaded') {
        await createSampleData(trx, farmId, sessionId);
      }

      return { farmId, sessionId };
    });

    // Set session data
    req.session.isDemo = true;
    req.session.demoFarmId = result.farmId;
    req.session.demoSessionId = sessionId;
    req.session.demoMode = mode;

    console.log(`[DEMO] Demo ${mode} initialized successfully - Farm: ${result.farmId}, Session: ${sessionId}`);

    res.json({
      success: true,
      farmId: result.farmId,
      sessionId: sessionId,
      mode: mode,
      message: `Demo ${mode} initialized with REAL TiDB integration`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

  } catch (error) {
    console.error('[DEMO] Initialization error:', error);
    res.status(500).json({ 
      error: 'Failed to initialize demo',
      message: error.message 
    });
  }
});

/**
 * Create sample data for preloaded demo mode
 * All data stored in real TiDB with is_demo=true
 */
async function createSampleData(trx, farmId, sessionId) {
  console.log(`[DEMO] Creating sample data for farm ${farmId}`);

  // Create nearby demo farms for realistic scenarios
  const nearbyFarms = [
    { 
      name: 'Sunset Ranch', 
      owner: 'Jane Demo Smith', 
      acres: 450,
      lat: 32.7157 + (Math.random() - 0.5) * 0.1,
      lon: -117.1611 + (Math.random() - 0.5) * 0.1
    },
    { 
      name: 'Valley View Farm', 
      owner: 'Mike Demo Johnson', 
      acres: 320,
      lat: 32.7157 + (Math.random() - 0.5) * 0.1,
      lon: -117.1611 + (Math.random() - 0.5) * 0.1
    },
    { 
      name: 'Hillside Acres', 
      owner: 'Sarah Demo Brown', 
      acres: 280,
      lat: 32.7157 + (Math.random() - 0.5) * 0.1,
      lon: -117.1611 + (Math.random() - 0.5) * 0.1
    }
  ];

  const nearbyFarmIds = [];
  for (const farm of nearbyFarms) {
    const [farmResult] = await trx('farms').insert({
      name: farm.name,
      owner_name: farm.owner,
      email: `${farm.name.toLowerCase().replace(/\s+/g, '')}@demo.burnwise.local`,
      total_acres: farm.acres,
      location_lat: farm.lat,
      location_lon: farm.lon,
      crop_types: 'wheat,corn,rice',
      is_demo: true,
      created_at: new Date()
    }).returning('id');
    
    nearbyFarmIds.push(farmResult.id || farmResult);
  }

  // Create historical burn requests with various statuses
  const burnRequests = [
    {
      farm_id: farmId,
      acres_to_burn: 75,
      crop_type: 'wheat stubble',
      burn_reason: 'Pest management and soil preparation',
      requested_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      status: 'completed',
      priority: 'medium',
      weather_conditions: 'Clear skies, low wind',
      is_demo: true,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    },
    {
      farm_id: farmId,
      acres_to_burn: 50,
      crop_type: 'rice straw',
      burn_reason: 'Disease prevention and nutrient cycling',
      requested_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      status: 'approved',
      priority: 'high',
      weather_conditions: 'Favorable conditions expected',
      is_demo: true,
      created_at: new Date()
    },
    {
      farm_id: farmId,
      acres_to_burn: 30,
      crop_type: 'corn stubble',
      burn_reason: 'Field preparation for next season',
      requested_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      status: 'pending',
      priority: 'low',
      weather_conditions: 'Pending weather analysis',
      is_demo: true,
      created_at: new Date()
    }
  ];

  const burnRequestIds = [];
  for (const burn of burnRequests) {
    const [burnResult] = await trx('burn_requests').insert(burn).returning('id');
    burnRequestIds.push(burnResult.id || burnResult);
  }

  // Create schedule entries for approved burns
  await trx('schedules').insert({
    farm_id: farmId,
    burn_request_id: burnRequestIds[1], // The approved one
    burn_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    time_slot: '08:00-10:00',
    status: 'scheduled',
    wind_direction: 'SW',
    wind_speed: 8,
    temperature: 72,
    humidity: 45,
    is_demo: true,
    created_at: new Date()
  });

  // Create some sample alerts
  const alerts = [
    {
      farm_id: farmId,
      alert_type: 'weather_change',
      severity: 'medium',
      title: 'Wind Speed Increasing',
      message: 'Wind speeds are expected to increase to 15mph tomorrow. Consider rescheduling outdoor activities.',
      is_active: true,
      is_demo: true,
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 hours ago
    },
    {
      farm_id: farmId,
      alert_type: 'burn_approved',
      severity: 'low',
      title: 'Burn Request Approved',
      message: 'Your rice straw burn request has been approved for tomorrow 8:00-10:00 AM.',
      is_active: true,
      is_demo: true,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    }
  ];

  for (const alert of alerts) {
    await trx('alerts').insert(alert);
  }

  // Create sample weather data
  const weatherData = {
    location_lat: 32.7157,
    location_lon: -117.1611,
    temperature: 75,
    humidity: 50,
    wind_speed: 8,
    wind_direction: 'SW',
    pressure: 1013.25,
    visibility: 10,
    conditions: 'clear',
    timestamp: new Date(),
    is_demo: true
  };

  await trx('weather_data').insert(weatherData);

  // Add sample agent interactions to show AI conversation history
  const agentInteractions = [
    {
      farm_id: farmId,
      agent_type: 'burn_request',
      request: JSON.stringify({
        message: 'I need to burn 50 acres of rice straw tomorrow morning',
        timestamp: new Date()
      }),
      response: JSON.stringify({
        analysis: 'Conditions look favorable for rice straw burning tomorrow',
        recommendation: 'Approved for 8:00-10:00 AM window',
        safety_score: 85
      }),
      tokens_used: 150,
      cost: 0.0003,
      is_demo: true,
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000)
    },
    {
      farm_id: farmId,
      agent_type: 'weather_analyst',
      request: JSON.stringify({
        location: { lat: 32.7157, lon: -117.1611 },
        date: new Date()
      }),
      response: JSON.stringify({
        analysis: 'Current conditions are SAFE for agricultural burning',
        wind_forecast: '5-8 mph from southwest',
        risk_level: 'LOW'
      }),
      tokens_used: 120,
      cost: 0.0002,
      is_demo: true,
      created_at: new Date(Date.now() - 30 * 60 * 1000)
    }
  ];

  for (const interaction of agentInteractions) {
    await trx('agent_interactions').insert(interaction);
  }

  console.log(`[DEMO] Sample data created: ${nearbyFarms.length} nearby farms, ${burnRequests.length} burn requests, ${alerts.length} alerts`);
}

/**
 * Get demo session status and statistics
 */
router.get('/status', async (req, res) => {
  if (!req.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  try {
    const session = await db('demo_sessions')
      .where('session_id', req.session.demoSessionId)
      .first();

    if (!session) {
      return res.status(404).json({ error: 'Demo session not found' });
    }

    // Get statistics
    const stats = await db('agent_interactions')
      .where({ farm_id: session.farm_id, is_demo: true })
      .select(
        db.raw('COUNT(*) as total_interactions'),
        db.raw('SUM(tokens_used) as total_tokens'),
        db.raw('SUM(cost) as total_cost')
      )
      .first();

    res.json({
      sessionId: session.session_id,
      farmId: session.farm_id,
      mode: session.demo_type,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      totalCost: parseFloat(session.total_cost),
      isActive: session.is_active,
      tutorialProgress: JSON.parse(session.tutorial_progress || '{}'),
      statistics: {
        totalInteractions: parseInt(stats.total_interactions) || 0,
        totalTokens: parseInt(stats.total_tokens) || 0,
        totalCost: parseFloat(stats.total_cost) || 0
      },
      timeRemaining: new Date(session.expires_at) - new Date()
    });

  } catch (error) {
    console.error('[DEMO] Status check error:', error);
    res.status(500).json({ error: 'Failed to get demo status' });
  }
});

/**
 * Add phone number to demo session (encrypted)
 * Enhanced security and validation
 */
router.post('/add-phone', async (req, res) => {
  if (!req.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  const { sessionId, phone } = req.body;

  // Validation
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  if (!phone || typeof phone !== 'string' || phone.length === 0) {
    return res.status(400).json({ error: 'Encrypted phone number is required' });
  }

  // Additional security: limit phone data size (encrypted data should be reasonable size)
  if (phone.length > 500) {
    return res.status(400).json({ error: 'Invalid phone data format' });
  }

  try {
    // Verify session exists and is active
    const session = await db('demo_sessions')
      .where('session_id', sessionId)
      .where('is_active', true)
      .first();

    if (!session) {
      return res.status(404).json({ error: 'Demo session not found or expired' });
    }

    // Check if phone already added to prevent duplicate submissions
    if (session.phone_encrypted) {
      return res.json({
        success: true,
        verificationId: uuidv4(),
        message: 'Phone number already added to this session'
      });
    }

    // Store encrypted phone in TiDB with additional metadata
    await db('demo_sessions')
      .where('session_id', sessionId)
      .update({
        phone_encrypted: Buffer.from(phone), // Store as binary blob
        phone_added_at: new Date(),
        phone_encryption_method: 'AES-256-Client',
        last_activity: new Date()
      });

    // Generate verification ID for demo flow
    const verificationId = uuidv4();

    console.log(`[DEMO] Encrypted phone number added to session ${sessionId}`);
    console.log(`[DEMO] In production, SMS would be sent. Demo verification ID: ${verificationId}`);

    // Security: Don't log the actual encrypted phone data
    res.json({
      success: true,
      verificationId: verificationId,
      message: 'Phone number encrypted and stored securely. In production, SMS verification would be sent.',
      security: {
        encrypted: true,
        method: 'AES-256-Client',
        autoDeleteHours: 24
      }
    });

  } catch (error) {
    console.error('[DEMO] Add phone error:', error.message);
    res.status(500).json({ 
      error: 'Failed to add phone number',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify phone number (demo implementation)
 */
router.post('/verify-phone', async (req, res) => {
  if (!req.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  const { sessionId, verificationId, code } = req.body;

  if (!sessionId || !verificationId || !code) {
    return res.status(400).json({ error: 'Session ID, verification ID, and code are required' });
  }

  try {
    // For demo purposes, accept code "123456"
    if (code !== '123456') {
      return res.status(400).json({ 
        error: 'Invalid verification code',
        hint: 'For demo, use code: 123456'
      });
    }

    // Update session to mark phone as verified
    const updated = await db('demo_sessions')
      .where('session_id', sessionId)
      .where('is_active', true)
      .update({
        phone_verified: true,
        phone_verified_at: new Date(),
        last_activity: new Date()
      });

    if (updated === 0) {
      return res.status(404).json({ error: 'Demo session not found or expired' });
    }

    console.log(`[DEMO] Phone verified for session ${sessionId}`);

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      features_enabled: {
        sms_alerts: true,
        weather_notifications: true,
        conflict_warnings: true
      }
    });

  } catch (error) {
    console.error('[DEMO] Phone verification error:', error.message);
    res.status(500).json({ error: 'Failed to verify phone number' });
  }
});

/**
 * Update tutorial progress
 */
router.post('/tutorial-progress', async (req, res) => {
  if (!req.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  const { sessionId, progress } = req.body;

  try {
    await db('demo_sessions')
      .where('session_id', sessionId)
      .update({
        tutorial_progress: JSON.stringify(progress),
        updated_at: new Date()
      });

    res.json({ success: true });

  } catch (error) {
    console.error('[DEMO] Tutorial progress error:', error);
    res.status(500).json({ error: 'Failed to update tutorial progress' });
  }
});

/**
 * Complete tutorial
 */
router.post('/tutorial-complete', async (req, res) => {
  if (!req.isDemoMode) {
    return res.status(400).json({ error: 'Not in demo mode' });
  }

  const { sessionId } = req.body;

  try {
    await db('demo_sessions')
      .where('session_id', sessionId)
      .update({
        tutorial_progress: JSON.stringify({ 
          completed: true, 
          completedAt: new Date() 
        }),
        updated_at: new Date()
      });

    console.log(`[DEMO] Tutorial completed for session ${sessionId}`);
    res.json({ success: true });

  } catch (error) {
    console.error('[DEMO] Tutorial complete error:', error);
    res.status(500).json({ error: 'Failed to complete tutorial' });
  }
});

/**
 * Reset demo session - clean up and start fresh
 */
router.post('/reset', async (req, res) => {
  const { sessionId, isDemo } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    if (isDemo) {
      // Delete all demo data from TiDB
      await db.transaction(async (trx) => {
        const session = await trx('demo_sessions')
          .where('session_id', sessionId)
          .first();

        if (session) {
          const farmId = session.farm_id;

          // Delete all related demo data
          await trx('burn_requests').where({ farm_id: farmId, is_demo: true }).del();
          await trx('schedules').where({ farm_id: farmId, is_demo: true }).del();
          await trx('alerts').where({ farm_id: farmId, is_demo: true }).del();
          await trx('agent_interactions').where({ farm_id: farmId, is_demo: true }).del();
          await trx('weather_data').where({ is_demo: true }).del();

          // Delete embeddings
          await trx('weather_embeddings').where({ farm_id: farmId, is_demo: true }).del();
          await trx('smoke_embeddings').where({ is_demo: true }).del();
          await trx('burn_embeddings').where({ farm_id: farmId, is_demo: true }).del();

          // Find and delete nearby demo farms created with this session
          const nearbyDemoFarms = await trx('farms')
            .where({ is_demo: true })
            .whereNot('id', farmId)
            .where('created_at', '>', session.created_at)
            .select('id');

          for (const farm of nearbyDemoFarms) {
            await trx('farms').where({ id: farm.id, is_demo: true }).del();
          }

          // Delete main demo farm
          await trx('farms').where({ id: farmId, is_demo: true }).del();

          // Delete session
          await trx('demo_sessions').where('session_id', sessionId).del();

          console.log(`[DEMO] Reset completed for session ${sessionId}, farm ${farmId}`);
        }
      });

      // Clear session data
      req.session.isDemo = false;
      req.session.demoSessionId = null;
      req.session.demoFarmId = null;
      req.session.demoMode = null;

      res.json({ 
        success: true, 
        message: 'Demo session reset successfully. All demo data removed from TiDB.' 
      });

    } else {
      // Real user reset - would implement actual user data reset
      res.status(400).json({ error: 'Real user reset not implemented yet' });
    }

  } catch (error) {
    console.error('[DEMO] Reset error:', error);
    res.status(500).json({ 
      error: 'Reset failed', 
      message: error.message 
    });
  }
});

/**
 * Get demo statistics for monitoring
 */
router.get('/admin/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const stats = await db('demo_sessions')
      .select(
        db.raw('COUNT(*) as total_sessions'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions'),
        db.raw('SUM(total_cost) as total_cost'),
        db.raw('AVG(total_cost) as avg_cost_per_session')
      )
      .where('created_at', '>=', today)
      .first();

    const modeBreakdown = await db('demo_sessions')
      .select('demo_type')
      .count('* as count')
      .where('created_at', '>=', today)
      .groupBy('demo_type');

    res.json({
      date: today,
      totalSessions: parseInt(stats.total_sessions) || 0,
      activeSessions: parseInt(stats.active_sessions) || 0,
      totalCost: parseFloat(stats.total_cost) || 0,
      avgCostPerSession: parseFloat(stats.avg_cost_per_session) || 0,
      modeBreakdown: modeBreakdown.reduce((acc, row) => {
        acc[row.demo_type] = parseInt(row.count);
        return acc;
      }, {})
    });

  } catch (error) {
    console.error('[DEMO] Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get demo statistics' });
  }
});

module.exports = router;