/**
 * FloatingAI.js - Draggable AI Assistant Bubble
 * Floats over the map like Facebook Messenger
 * Can be minimized, maximized, and positioned anywhere
 * Glass morphism design with spring physics
 * NO MOCKS - Real AI integration
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import io from 'socket.io-client';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './FloatingAI.css';

const FloatingAI = ({ isOpen, onClose }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: 80 });
  
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socket = useRef(null);
  
  useEffect(() => {
    // Initialize socket connection
    socket.current = io('http://localhost:5001');
    
    // Add welcome message
    setMessages([{
      id: 1,
      type: 'ai',
      content: 'Hello! I can help you schedule burns, check weather, and manage your operations. Just ask!',
      timestamp: new Date()
    }]);
    
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    const messageToSend = inputMessage;
    setInputMessage('');
    
    try {
      const response = await fetch('http://localhost:5001/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          userId: 'spatial-ui',
          conversationId: 'floating-ai'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: 'ai',
          content: data.response,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Quick action buttons
  const quickActions = [
    { label: 'Schedule Burn', prompt: 'I need to schedule a new burn' },
    { label: 'Weather Check', prompt: 'Is the weather safe for burning today?' },
    { label: 'View Conflicts', prompt: 'Check for conflicts with other farms' }
  ];
  
  const handleQuickAction = (prompt) => {
    setInputMessage(prompt);
    setTimeout(() => sendMessage(), 100);
  };
  
  if (!isOpen) {
    // Minimized bubble state
    return (
      <motion.div
        className="floating-ai-bubble"
        drag
        dragMomentum={false}
        dragElastic={0.1}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        style={{ x: position.x, y: position.y }}
        onDragEnd={(e, info) => {
          setPosition({ x: info.x, y: info.y });
        }}
      >
        <AnimatedFlameLogo size={32} animated={true} />
        {messages.filter(m => m.type === 'ai').length > 0 && (
          <div className="bubble-badge">
            {messages.filter(m => m.type === 'ai').length}
          </div>
        )}
      </motion.div>
    );
  }
  
  return (
    <motion.div
      ref={constraintsRef}
      className="floating-ai-container"
      drag="position"
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.2}
      dragConstraints={constraintsRef}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: isMinimized ? 0.3 : 1,
        y: 0,
        width: isMinimized ? 80 : 360,
        height: isMinimized ? 80 : 500
      }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      style={{ 
        x: position.x, 
        y: position.y,
        position: 'fixed',
        zIndex: 300
      }}
    >
      {/* Header with drag handle */}
      <motion.div 
        className="floating-ai-header"
        onPointerDown={(e) => dragControls.start(e)}
        style={{ cursor: 'move' }}
      >
        <div className="header-left">
          <AnimatedFlameLogo size={20} animated={false} />
          <span className="header-title">AI Assistant</span>
        </div>
        <div className="header-actions">
          <button 
            className="header-btn"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? '□' : '−'}
          </button>
          <button 
            className="header-btn"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </motion.div>
      
      {!isMinimized && (
        <>
          {/* Messages area */}
          <div className="floating-ai-messages">
            {messages.map(message => (
              <div 
                key={message.id} 
                className={`floating-message ${message.type}`}
              >
                {message.type === 'ai' && (
                  <AnimatedFlameLogo size={16} animated={false} />
                )}
                <div className="message-bubble">
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="floating-message ai">
                <AnimatedFlameLogo size={16} animated={true} />
                <div className="message-bubble typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Quick actions */}
          <div className="floating-ai-quick">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                className="quick-action-btn"
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isLoading}
              >
                {action.label}
              </button>
            ))}
          </div>
          
          {/* Input area */}
          <div className="floating-ai-input">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything..."
              disabled={isLoading}
              className="ai-input-field"
            />
            <button 
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="ai-send-btn"
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default FloatingAI;