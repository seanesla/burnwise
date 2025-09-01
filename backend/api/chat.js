const express = require('express');
const { query } = require('../db/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../middleware/logger');

const router = express.Router();

/**
 * POST /api/chat/history
 * Retrieve chat history for a conversation
 */
router.post('/history', asyncHandler(async (req, res) => {
  const { conversationId, userId, limit = 50 } = req.body;
  
  if (!conversationId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'conversationId and userId are required'
    });
  }
  
  try {
    // Ensure limit is a valid positive integer for TiDB LIMIT clause
    const limitValue = Math.max(1, Math.min(1000, parseInt(limit) || 50));
    
    const chatQuery = `
      SELECT id, conversation_id, user_id, message_type, content, timestamp, metadata
      FROM chat_messages
      WHERE conversation_id = ? AND user_id = ?
      ORDER BY timestamp ASC, id ASC
      LIMIT ${limitValue}
    `;
    
    const messages = await query(chatQuery, [conversationId, userId]);
    
    logger.info(`Retrieved ${messages.length} chat messages for conversation: ${conversationId}`);
    
    res.json({
      success: true,
      messages: messages || [],
      count: messages.length
    });
    
  } catch (error) {
    logger.error('Failed to retrieve chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chat history'
    });
  }
}));

/**
 * POST /api/chat/save
 * Save a chat message to the database
 */
router.post('/save', asyncHandler(async (req, res) => {
  const { 
    conversationId, 
    userId, 
    messageType, 
    content, 
    timestamp,
    sessionId = null,
    metadata = null 
  } = req.body;
  
  if (!conversationId || !userId || !messageType || !content) {
    return res.status(400).json({
      success: false,
      error: 'conversationId, userId, messageType, and content are required'
    });
  }
  
  if (!['user', 'ai'].includes(messageType)) {
    return res.status(400).json({
      success: false,
      error: 'messageType must be either "user" or "ai"'
    });
  }
  
  try {
    const insertQuery = `
      INSERT INTO chat_messages (
        conversation_id,
        user_id, 
        message_type,
        content,
        timestamp,
        session_id,
        metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const messageTimestamp = timestamp ? new Date(timestamp) : new Date();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    
    const result = await query(insertQuery, [
      conversationId,
      userId,
      messageType,
      content,
      messageTimestamp,
      sessionId,
      metadataJson
    ]);
    
    logger.info(`Saved chat message for conversation: ${conversationId}, type: ${messageType}`);
    
    res.json({
      success: true,
      messageId: result.insertId,
      message: 'Chat message saved successfully'
    });
    
  } catch (error) {
    logger.error('Failed to save chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save chat message'
    });
  }
}));

/**
 * POST /api/chat/conversations
 * Get list of conversations for a user with preview data
 */
router.post('/conversations', asyncHandler(async (req, res) => {
  const { userId, limit = 50 } = req.body;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required'
    });
  }
  
  try {
    // Ensure limit is a valid positive integer for TiDB LIMIT clause
    const limitValue = Math.max(1, Math.min(1000, parseInt(limit) || 50));
    
    const conversationsQuery = `
      SELECT 
        conversation_id,
        COUNT(*) as message_count,
        MAX(timestamp) as last_timestamp,
        (SELECT content FROM chat_messages c2 
         WHERE c2.conversation_id = c1.conversation_id 
         AND c2.user_id = c1.user_id 
         ORDER BY c2.timestamp DESC 
         LIMIT 1) as last_message
      FROM chat_messages c1
      WHERE user_id = ?
      GROUP BY conversation_id
      ORDER BY last_timestamp DESC
      LIMIT ${limitValue}
    `;
    
    const conversations = await query(conversationsQuery, [userId]);
    
    logger.info(`Retrieved ${conversations.length} conversations for user: ${userId}`);
    
    res.json({
      success: true,
      conversations: conversations || [],
      count: conversations.length
    });
    
  } catch (error) {
    logger.error('Failed to retrieve conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations'
    });
  }
}));

/**
 * POST /api/chat/clear
 * Clear chat history for a conversation (optional endpoint for cleanup)
 */
router.post('/clear', asyncHandler(async (req, res) => {
  const { conversationId, userId } = req.body;
  
  if (!conversationId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'conversationId and userId are required'
    });
  }
  
  try {
    const deleteQuery = `
      DELETE FROM chat_messages
      WHERE conversation_id = ? AND user_id = ?
    `;
    
    const result = await query(deleteQuery, [conversationId, userId]);
    
    logger.info(`Cleared ${result.affectedRows} chat messages for conversation: ${conversationId}`);
    
    res.json({
      success: true,
      deletedCount: result.affectedRows,
      message: 'Chat history cleared successfully'
    });
    
  } catch (error) {
    logger.error('Failed to clear chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear chat history'
    });
  }
}));

module.exports = router;