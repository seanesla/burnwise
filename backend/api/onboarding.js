/**
 * Onboarding API - Conversational farm setup using OpenAI Agents SDK
 * Replaces traditional form with AI-powered conversation
 */

const express = require('express');
const OnboardingAgent = require('../agents-sdk/OnboardingAgent');
const { authenticateFromCookie } = require('../middleware/cookieAuth');
const logger = require('../middleware/logger');

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

    // Get welcome message from agent
    const response = await OnboardingAgent.processMessage(
      "Hello, I want to set up my farm account",
      { messages: [] }
    );

    if (response.success) {
      onboardingSessions.set(sessionId, {
        ...onboardingSessions.get(sessionId),
        messages: response.messages
      });
    }

    res.json({
      success: true,
      sessionId,
      message: response.message || "Welcome to Burnwise! I'll help you set up your farm account. Let's start with your farm's name. What do you call your farm?",
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

    // Process message with agent
    const response = await OnboardingAgent.processMessage(message, {
      messages: session.messages
    });

    // Update session
    if (response.success && response.messages) {
      session.messages = response.messages;
      session.completed = response.completed || false;
      
      if (response.completed) {
        // Clean up session after completion
        setTimeout(() => {
          onboardingSessions.delete(sessionId);
        }, 60000); // Delete after 1 minute
      }
      
      onboardingSessions.set(sessionId, session);
    }

    res.json({
      success: response.success,
      message: response.message,
      completed: response.completed || false,
      email: response.email || null,
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