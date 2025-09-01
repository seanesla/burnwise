/**
 * ChatHistory.js - Chat History and Conversation Management
 * Shows previous conversations and allows starting new chats
 * Glass morphism design consistent with FloatingAI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './ChatHistory.css';

const ChatHistory = ({ onSelectConversation, onStartNewChat, onClose }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load conversation list from TiDB
  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'spatial-ui'
        })
      });

      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to load conversations:', data.error);
        setError(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Format conversation preview
  const formatPreview = (content) => {
    if (!content) return 'No messages yet';
    if (content.length <= 50) return content;
    return content.substring(0, 50) + '...';
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleSelectConversation = (conversationId) => {
    onSelectConversation(conversationId);
  };

  const handleStartNewChat = () => {
    // Generate new conversation ID
    const newConversationId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    onStartNewChat(newConversationId);
  };

  // If loading, show spinner
  if (loading) {
    return (
      <motion.div
        className="chat-history-container loading"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
      >
        <div className="chat-history-header">
          <div className="header-left">
            <AnimatedFlameLogo size={20} animated={true} />
            <span className="header-title">AI Assistant</span>
          </div>
          <button className="header-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="chat-history-content">
          <div className="loading-state">
            <AnimatedFlameLogo size={32} animated={true} />
            <p>Loading your conversations...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // If error, show error state
  if (error) {
    return (
      <motion.div
        className="chat-history-container error"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
      >
        <div className="chat-history-header">
          <div className="header-left">
            <AnimatedFlameLogo size={20} animated={false} />
            <span className="header-title">AI Assistant</span>
          </div>
          <button className="header-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="chat-history-content">
          <div className="error-state">
            <p>Failed to load chat history</p>
            <button className="retry-btn" onClick={loadConversations}>
              Try Again
            </button>
          </div>
        </div>
        
        <div className="chat-history-footer">
          <button className="new-chat-btn primary" onClick={handleStartNewChat}>
            <span>Start New Chat</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>
        </div>
      </motion.div>
    );
  }

  // If no conversations, automatically start new chat
  if (conversations.length === 0) {
    // Auto-start new chat for first-time users
    setTimeout(() => handleStartNewChat(), 100);
    
    return (
      <motion.div
        className="chat-history-container empty"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 30 }}
      >
        <div className="chat-history-header">
          <div className="header-left">
            <AnimatedFlameLogo size={20} animated={true} />
            <span className="header-title">AI Assistant</span>
          </div>
          <button className="header-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="chat-history-content">
          <div className="empty-state">
            <AnimatedFlameLogo size={48} animated={true} />
            <h3>Welcome to AI Assistant</h3>
            <p>Start your first conversation with our intelligent assistant.</p>
          </div>
        </div>
      </motion.div>
    );
  }

  // Show conversation history
  return (
    <motion.div
      className="chat-history-container"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 100, damping: 30 }}
    >
      <div className="chat-history-header">
        <div className="header-left">
          <AnimatedFlameLogo size={20} animated={false} />
          <span className="header-title">AI Assistant</span>
        </div>
        <button className="header-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="chat-history-content">
        <div className="conversations-header">
          <h3>Your Conversations</h3>
          <span className="conversation-count">{conversations.length} chat{conversations.length !== 1 ? 's' : ''}</span>
        </div>
        
        <div className="conversations-list">
          {conversations.map((conversation) => (
            <motion.div
              key={conversation.conversation_id}
              className="conversation-item"
              onClick={() => handleSelectConversation(conversation.conversation_id)}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="conversation-avatar">
                <AnimatedFlameLogo size={16} animated={false} />
              </div>
              
              <div className="conversation-details">
                <div className="conversation-preview">
                  {formatPreview(conversation.last_message)}
                </div>
                <div className="conversation-meta">
                  <span className="message-count">{conversation.message_count} messages</span>
                  <span className="timestamp">{formatTimestamp(conversation.last_timestamp)}</span>
                </div>
              </div>
              
              <div className="conversation-arrow">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="chat-history-footer">
        <button className="new-chat-btn primary" onClick={handleStartNewChat}>
          <span>Start New Chat</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </motion.div>
  );
};

export default ChatHistory;