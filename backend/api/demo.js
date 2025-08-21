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
    // Create REAL farm and demo data in TiDB without transactions
    
    // Create demo farm in TiDB
    const farmData = {
      farm_name: mode === 'blank' ? 'Your Demo Farm' : 'Golden Valley Demo Farm',
      owner_name: 'Demo User',
      contact_email: `demo_${sessionId}@burnwise.demo`,
      latitude: 32.7157, // San Diego area for demo
      longitude: -117.1611,
      total_acreage: mode === 'blank' ? 500 : 750,
      is_demo: true
    };

    // Insert farm and get the ID
    const farmResult = await db.query(
      'INSERT INTO farms (farm_name, owner_name, contact_email, latitude, longitude, total_acreage, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [farmData.farm_name, farmData.owner_name, farmData.contact_email, farmData.latitude, farmData.longitude, farmData.total_acreage, farmData.is_demo]
    );

    const farmId = farmResult.insertId;
    console.log(`[DEMO] Created farm ${farmId} for session ${sessionId}`);

    // Create demo session record
    await db.query(
      'INSERT INTO demo_sessions (session_id, farm_id, demo_type, expires_at, tutorial_progress, total_cost, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        sessionId,
        farmId,
        mode,
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        JSON.stringify({ step: 0, completed: false, skipped: false }),
        0.0000,
        true
      ]
    );

    // If preloaded mode, add sample data
    if (mode === 'preloaded') {
      await createSampleData(farmId, sessionId);
    }

    const result = { farmId, sessionId };

    // Set session data (only if session exists)
    if (req.session) {
      req.session.isDemo = true;
      req.session.demoFarmId = result.farmId;
      req.session.demoSessionId = sessionId;
      req.session.demoMode = mode;
    }

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
async function createSampleData(farmId, sessionId) {
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
    const farmResult = await db.query(
      'INSERT INTO farms (farm_name, owner_name, contact_email, total_acreage, latitude, longitude, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        farm.name,
        farm.owner,
        `${farm.name.toLowerCase().replace(/\s+/g, '')}@demo.burnwise.local`,
        farm.acres,
        farm.lat,
        farm.lon,
        true
      ]
    );
    
    nearbyFarmIds.push(farmResult.insertId);
  }

  // Create historical burn requests with various statuses
  const burnRequests = [
    {
      farm_id: farmId,
      acreage: 75,
      crop_type: 'wheat stubble',
      purpose: 'Pest management and soil preparation',
      requested_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
      status: 'completed',
      priority_score: 7.5,
      estimated_duration_hours: 4.0,
      is_demo: true
    },
    {
      farm_id: farmId,
      acreage: 50,
      crop_type: 'rice straw',
      purpose: 'Disease prevention and nutrient cycling',
      requested_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      status: 'approved',
      priority_score: 8.0,
      estimated_duration_hours: 3.5,
      is_demo: true
    },
    {
      farm_id: farmId,
      acreage: 30,
      crop_type: 'corn stubble',
      purpose: 'Field preparation for next season',
      requested_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
      status: 'pending',
      priority_score: 5.0,
      estimated_duration_hours: 2.5,
      is_demo: true
    }
  ];

  const burnRequestIds = [];
  for (const burn of burnRequests) {
    const burnResult = await db.query(
      'INSERT INTO burn_requests (farm_id, acreage, crop_type, purpose, requested_date, status, priority_score, estimated_duration_hours, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [burn.farm_id, burn.acreage, burn.crop_type, burn.purpose, burn.requested_date, burn.status, burn.priority_score, burn.estimated_duration_hours, burn.is_demo]
    );
    burnRequestIds.push(burnResult.insertId);
  }

  // Create schedule entries for approved burns
  const scheduleDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // First create the schedule
  const scheduleResult = await db.query(
    'INSERT INTO schedules (date, optimization_score, total_conflicts, is_demo, created_at) VALUES (?, ?, ?, ?, NOW())',
    [scheduleDate, 8.5, 0, true]
  );
  
  const scheduleId = scheduleResult.insertId;
  
  // Then create schedule items for approved burn requests
  await db.query(
    'INSERT INTO schedule_items (schedule_id, burn_request_id, scheduled_start, scheduled_end, status, priority_order, conflict_score, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [
      scheduleId,
      burnRequestIds[1], // The approved one
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19),
      new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 3.5 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19), // 3.5 hours later
      'scheduled',
      1,
      0.0
    ]
  );

  // Create some sample alerts
  const alerts = [
    {
      farm_id: farmId,
      request_id: burnRequestIds[1], // Link to approved burn request
      alert_type: 'weather_alert',
      severity: 'warning',
      message: 'Wind speeds are expected to increase to 15mph tomorrow. Consider rescheduling outdoor activities.',
      delivery_method: 'in_app',
      delivery_status: 'delivered',
      is_demo: true
    },
    {
      farm_id: farmId,
      request_id: burnRequestIds[1],
      alert_type: 'burn_scheduled',
      severity: 'info',
      message: 'Your rice straw burn request has been approved for tomorrow 8:00-10:00 AM.',
      delivery_method: 'in_app',
      delivery_status: 'delivered',
      is_demo: true
    }
  ];

  for (const alert of alerts) {
    await db.query(
      'INSERT INTO alerts (farm_id, request_id, alert_type, severity, message, delivery_method, delivery_status, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [alert.farm_id, alert.request_id, alert.alert_type, alert.severity, alert.message, alert.delivery_method, alert.delivery_status, alert.is_demo]
    );
  }

  // Create sample weather data
  await db.query(
    'INSERT INTO weather_data (location_lat, location_lon, temperature, humidity, wind_speed, wind_direction, pressure, visibility, weather_condition, timestamp, is_demo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
    [
      32.7157,
      -117.1611,
      75,
      50,
      8,
      225, // SW in degrees (225 degrees)
      1013.25,
      10,
      'clear',
      true
    ]
  );

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
    await db.query(
      'INSERT INTO agent_interactions (farm_id, agent_type, request, response, tokens_used, cost, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [interaction.farm_id, interaction.agent_type, interaction.request, interaction.response, interaction.tokens_used, interaction.cost, interaction.is_demo]
    );
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
      const session = await db.query('SELECT * FROM demo_sessions WHERE session_id = ?', [sessionId]);
      
      if (session.length > 0) {
        const farmId = session[0].farm_id;

        // Delete all related demo data
        await db.query('DELETE FROM burn_requests WHERE farm_id = ? AND is_demo = true', [farmId]);
        await db.query('DELETE FROM schedules WHERE farm_id = ? AND is_demo = true', [farmId]);
        await db.query('DELETE FROM alerts WHERE farm_id = ? AND is_demo = true', [farmId]);
        await db.query('DELETE FROM agent_interactions WHERE farm_id = ? AND is_demo = true', [farmId]);
        await db.query('DELETE FROM weather_data WHERE is_demo = true');

        // Delete vector embeddings if tables exist
        try {
          await db.query('DELETE FROM weather_embeddings WHERE farm_id = ? AND is_demo = true', [farmId]);
          await db.query('DELETE FROM smoke_embeddings WHERE is_demo = true');
          await db.query('DELETE FROM burn_embeddings WHERE farm_id = ? AND is_demo = true', [farmId]);
        } catch (error) {
          // Ignore if embedding tables don't exist
          console.log('[DEMO] Embedding tables may not exist, skipping cleanup');
        }

        // Find and delete nearby demo farms created with this session
        const nearbyDemoFarms = await db.query(
          'SELECT farm_id as id FROM farms WHERE is_demo = true AND farm_id != ? AND created_at > ?',
          [farmId, session[0].created_at]
        );

        for (const farm of nearbyDemoFarms) {
          await db.query('DELETE FROM farms WHERE farm_id = ? AND is_demo = true', [farm.id]);
        }

        // Delete main demo farm
        await db.query('DELETE FROM farms WHERE farm_id = ? AND is_demo = true', [farmId]);

        // Delete session
        await db.query('DELETE FROM demo_sessions WHERE session_id = ?', [sessionId]);

        console.log(`[DEMO] Reset completed for session ${sessionId}, farm ${farmId}`);
      }

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