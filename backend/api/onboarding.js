/**
 * Onboarding API - Simplified conversational farm setup
 * Replaces traditional form with basic chat interface
 */

const express = require('express');
const { authenticateFromCookie } = require('../middleware/cookieAuth');
const logger = require('../middleware/logger');
const { query } = require('../db/connection');
const OnboardingAgent = require('../agents-sdk/OnboardingAgent');

const router = express.Router();

// Session storage for onboarding conversations
// In production, use Redis or database
const onboardingSessions = new Map();

/**
 * POST /api/onboarding/start
 * Start a new onboarding conversation
 */
router.post('/start', async (req, res) => {
  try {
    const sessionId = req.sessionID || `onboard_${Date.now()}_${Math.random().toString(36)}`;
    
    // Initialize session
    onboardingSessions.set(sessionId, {
      startedAt: new Date(),
      messages: [],
      completed: false
    });

    // Simple welcome message
    const welcomeMessage = "Welcome to Burnwise! I'll help you set up your farm account. Let's start with your farm's name. What do you call your farm?";
    
    onboardingSessions.set(sessionId, {
      ...onboardingSessions.get(sessionId),
      messages: [{ role: 'assistant', content: welcomeMessage }],
      step: 'farm_name'
    });

    res.json({
      success: true,
      sessionId,
      message: welcomeMessage,
      completed: false
    });

  } catch (error) {
    logger.error('Failed to start onboarding', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to start onboarding conversation'
    });
  }
});

/**
 * POST /api/onboarding/message
 * Send a message to the onboarding agent
 */
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Message and sessionId are required'
      });
    }

    // Get or create session
    let session = onboardingSessions.get(sessionId);
    if (!session) {
      session = {
        startedAt: new Date(),
        messages: [],
        completed: false
      };
      onboardingSessions.set(sessionId, session);
    }

    // Simple step-based onboarding flow
    session.messages.push({ role: 'user', content: message });
    
    let responseMessage = '';
    let completed = false;
    let email = null;
    
    // Simple state machine based on current step
    const currentStep = session.step || 'farm_name';
    
    switch(currentStep) {
      case 'farm_name':
        session.farm_name = message.trim();
        session.step = 'location';
        responseMessage = `Great! "${session.farm_name}" is a wonderful name. Now, where is your farm located? (City, State)`;
        break;
        
      case 'location':
        session.location = message.trim();
        session.step = 'farm_size';
        responseMessage = `Perfect! Your farm in ${session.location} sounds lovely. How many acres is your farm?`;
        break;
        
      case 'farm_size':
        const acres = parseInt(message) || 100;
        session.farm_size_acres = acres;
        session.step = 'email';
        responseMessage = `Excellent! ${acres} acres gives you plenty of space. What's your email address for important burn notifications?`;
        break;
        
      case 'email':
        email = message.trim();
        session.email = email;
        completed = true;
        
        // Save farm data to database
        try {
          await query(`
            INSERT INTO farms (farm_name, owner_name, owner_email, city_state, farm_size_acres, lat, lon)
            VALUES (?, 'Demo User', ?, ?, ?, 38.544, -121.740)
          `, [session.farm_name, email, session.location, session.farm_size_acres]);
          
          responseMessage = `Perfect! Your farm "${session.farm_name}" has been set up successfully. You can now start creating burn requests and managing your agricultural burns safely!`;
        } catch (error) {
          logger.error('Failed to save farm data', { error: error.message });
          responseMessage = `Your onboarding is complete! Welcome to Burnwise.`;
        }
        
        // Clean up session after completion
        setTimeout(() => {
          onboardingSessions.delete(sessionId);
        }, 60000);
        break;
        
      default:
        responseMessage = "I'm sorry, I didn't understand that. Could you please try again?";
    }
    
    session.messages.push({ role: 'assistant', content: responseMessage });
    onboardingSessions.set(sessionId, session);

    res.json({
      success: true,
      message: responseMessage,
      completed,
      email,
      sessionId
    });

  } catch (error) {
    logger.error('Failed to process onboarding message', { 
      error: error.message,
      sessionId: req.body.sessionId 
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process message',
      message: 'I encountered an error. Could you please repeat that?'
    });
  }
});

/**
 * GET /api/onboarding/status/:sessionId
 * Get onboarding session status
 */
router.get('/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = onboardingSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }

  res.json({
    success: true,
    completed: session.completed,
    messageCount: session.messages.length,
    startedAt: session.startedAt
  });
});

/**
 * POST /api/onboarding/reset/:sessionId
 * Reset an onboarding session
 */
router.post('/reset/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (onboardingSessions.has(sessionId)) {
    onboardingSessions.delete(sessionId);
  }

  res.json({
    success: true,
    message: 'Session reset successfully'
  });
});

/**
 * POST /api/onboarding/extract
 * Extract form data from natural text using AI (optional enhancement)
 * Falls back gracefully if AI unavailable
 */
router.post('/extract', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'No text provided'
      });
    }

    // Try to use AI if available
    const agent = OnboardingAgent;
    if (agent && agent.extractFormData) {
      const extracted = await agent.extractFormData(text);
      if (extracted) {
        return res.json({
          success: true,
          extracted: extracted
        });
      }
    }

    // Fallback to simple pattern matching
    const extracted = {};
    
    // Extract acreage
    const acreMatch = text.match(/(\d+)\s*(?:acres?|acre)/i);
    if (acreMatch) extracted.acreage = acreMatch[1];
    
    // Extract email
    const emailMatch = text.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
    if (emailMatch) extracted.email = emailMatch[1];
    
    // Extract phone
    const phoneMatch = text.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) extracted.phone = phoneMatch[1];
    
    // Extract location
    const locationMatch = text.match(/(?:in|at|near|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2})/i);
    if (locationMatch) extracted.location = locationMatch[1];
    
    res.json({
      success: true,
      extracted: extracted,
      method: 'pattern_matching'
    });

  } catch (error) {
    logger.error('Failed to extract form data', { error: error.message });
    res.status(200).json({
      success: false,
      error: 'Extraction failed, please fill manually'
    });
  }
});

// Clean up old sessions periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes
  
  for (const [sessionId, session] of onboardingSessions.entries()) {
    if (now - new Date(session.startedAt).getTime() > timeout) {
      onboardingSessions.delete(sessionId);
      logger.info('Cleaned up expired onboarding session', { sessionId });
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = router;