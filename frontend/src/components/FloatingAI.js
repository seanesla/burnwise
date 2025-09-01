/**
 * FloatingAI.js - Draggable AI Assistant Bubble
 * Floats over the map like Facebook Messenger
 * Can be minimized, maximized, and positioned anywhere
 * Glass morphism design with spring physics
 * NO MOCKS - Real AI integration
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import io from 'socket.io-client';
import { useSidebar } from '../contexts/SidebarContext';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './FloatingAI.css';

const FloatingAI = ({ isOpen, onClose, onOpen, conversationId = 'floating-ai', isNewConversation = false }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isExpanded: isSidebarExpanded } = useSidebar(); // Use unified sidebar context
  const [size, setSize] = useState(() => {
    // Load saved size or use default
    const saved = localStorage.getItem('burnwise-ai-size');
    if (saved) {
      return JSON.parse(saved);
    }
    return { width: 360, height: 500 };
  });
  const [isResizing, setIsResizing] = useState(false);
  
  const dragControls = useDragControls();
  const messagesEndRef = useRef(null);
  const socket = useRef(null);
  const resizeStartPos = useRef(null);
  const resizeStartSize = useRef(null);
  
  // Manual positioning state
  const [position, setPosition] = useState(() => {
    // Load saved position or calculate default
    try {
      const saved = localStorage.getItem('burnwise-ai-position');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Invalid saved position, using default');
    }
    
    // Default position calculation
    const sidebarWidth = isSidebarExpanded ? 250 : 70;
    const safeMargin = 30;
    return {
      x: sidebarWidth + safeMargin,
      y: 80
    };
  });
  
  // Save message to TiDB
  const saveMessageToTiDB = useCallback(async (message) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId,
          userId: 'spatial-ui',
          messageType: message.type,
          content: message.content,
          timestamp: message.timestamp.toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to save message to TiDB:', error);
      // Don't prevent UI functionality - just log the error
    }
  }, [conversationId]);
  
  // Load chat history from TiDB
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/chat/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversationId,
          userId: 'spatial-ui'
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.messages && data.messages.length > 0) {
        // Convert TiDB messages to component format
        const formattedMessages = data.messages.map(msg => ({
          id: msg.id,
          type: msg.message_type,
          content: msg.content,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(formattedMessages);
      } else {
        // Start with empty messages for new conversations
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      
      // Fallback: Start with empty messages
      setMessages([]);
    }
  }, [conversationId]);
  
  // Update position when sidebar state changes
  useEffect(() => {
    const sidebarWidth = isSidebarExpanded ? 250 : 70;
    const safeMargin = 30;
    const minX = sidebarWidth + safeMargin;
    
    // Ensure position doesn't go under sidebar when it expands
    setPosition(prevPosition => ({
      x: Math.max(minX, prevPosition.x),
      y: Math.max(80, prevPosition.y) // Ensure minimum top margin
    }));
  }, [isSidebarExpanded]);

  useEffect(() => {
    // Initialize socket connection
    socket.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5001');
    
    // Load chat history from TiDB
    loadChatHistory();
    
    // Handle window resize - ensure position stays within bounds
    const handleResize = () => {
      const sidebarWidth = isSidebarExpanded ? 250 : 70;
      const safeMargin = 30;
      const minX = sidebarWidth + safeMargin;
      const maxX = window.innerWidth - size.width - 20;
      const maxY = window.innerHeight - size.height - 20;
      
      setPosition(prevPosition => ({
        x: Math.max(minX, Math.min(maxX, prevPosition.x)),
        y: Math.max(80, Math.min(maxY, prevPosition.y))
      }));
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [loadChatHistory, update]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Save position to localStorage and update state
  const saveCurrentPosition = useCallback((x, y) => {
    const newPosition = { x, y };
    setPosition(newPosition);
    localStorage.setItem('burnwise-ai-position', JSON.stringify(newPosition));
  }, []);

  // Save size when it changes
  useEffect(() => {
    if (size.width && size.height) {
      localStorage.setItem('burnwise-ai-size', JSON.stringify(size));
    }
  }, [size]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle resize start
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { ...size };
  };

  // Handle resize move
  useEffect(() => {
    const handleResizeMove = (e) => {
      if (!isResizing || !resizeStartPos.current || !resizeStartSize.current) return;
      
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      
      const newWidth = Math.min(Math.max(300, resizeStartSize.current.width + deltaX), window.innerWidth - 100);
      const newHeight = Math.min(Math.max(400, resizeStartSize.current.height + deltaY), window.innerHeight - 150);
      
      setSize({ width: newWidth, height: newHeight });
    };
    
    const handleResizeEnd = () => {
      setIsResizing(false);
      resizeStartPos.current = null;
      resizeStartSize.current = null;
    };
    
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing]);

  
  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    const messageToSend = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    
    // Save user message to TiDB
    await saveMessageToTiDB(userMessage);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          userId: 'spatial-ui',
          conversationId: conversationId
        })
      });
      
      const data = await response.json();
      
      // Handle both success and failure responses
      let formattedResponse = data.response;
      
      if (data.success) {
        // Try to parse JSON response for formatted agent responses
        try {
          const parsed = JSON.parse(data.response);
          
          // Format based on agent type
          if (parsed.delegated_to === 'BurnRequestAgent') {
            const burnDate = parsed.parsed?.requestedBurnDate || 'your requested date';
            const timeWindow = parsed.parsed?.timeWindow 
              ? `${parsed.parsed.timeWindow.start} - ${parsed.parsed.timeWindow.end}` 
              : 'morning';
            
            let message = `I understand you want to schedule a burn for ${burnDate} during ${timeWindow}.\n\n`;
            
            if (parsed.missingFields && parsed.missingFields.length > 0) {
              message += `**I need the following information:**\n`;
              message += parsed.missingFields.map(field => `• ${field}`).join('\n');
              message += '\n\n';
            }
            
            if (parsed.notes && parsed.notes.length > 0) {
              message += `**Notes:**\n`;
              message += parsed.notes.map(note => `• ${note}`).join('\n');
            }
            
            formattedResponse = message;
          } else if (parsed.delegated_to === 'WeatherAnalyst') {
            const decision = parsed.decision || parsed.weatherDecision || 'UNKNOWN';
            const temp = parsed.temperature || parsed.temp || 'N/A';
            const wind = parsed.windSpeed || parsed.wind || 'N/A';
            
            formattedResponse = `**Weather Analysis**\n\n`;
            formattedResponse += `Status: ${decision}\n`;
            formattedResponse += `Temperature: ${temp}°F\n`;
            formattedResponse += `Wind Speed: ${wind} mph\n`;
            
            if (parsed.reasoning) {
              formattedResponse += `\nReasoning: ${parsed.reasoning}`;
            }
          }
        } catch (e) {
          // Not JSON, use as-is
          console.log('Response is not JSON:', data.response);
        }
        
      }
      
      // Always add the response message (success or failure)
      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: formattedResponse || 'I apologize, but I am currently unable to process your request. Please try again later.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Save AI response to TiDB
      await saveMessageToTiDB(aiMessage);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I apologize, but I encountered an error connecting to the server. Please check your connection and try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Save error message to TiDB
      await saveMessageToTiDB(errorMessage);
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
  
  const handleQuickAction = async (prompt) => {
    if (isLoading) return;
    
    // Add user message immediately
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: prompt,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setInputMessage(''); // Clear input
    
    // Save user message to TiDB
    await saveMessageToTiDB(userMessage);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          userId: 'spatial-ui',
          conversationId: conversationId
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Use the same formatting logic from sendMessage
        let formattedResponse = data.response;
        try {
          const parsed = JSON.parse(data.response);
          
          // Format based on agent type (same as sendMessage)
          if (parsed.delegated_to === 'BurnRequestAgent') {
            const burnDate = parsed.parsed?.requestedBurnDate || 'your requested date';
            const timeWindow = parsed.parsed?.timeWindow 
              ? `${parsed.parsed.timeWindow.start} - ${parsed.parsed.timeWindow.end}` 
              : 'morning';
            
            let message = `I understand you want to schedule a burn for ${burnDate} during ${timeWindow}.\n\n`;
            
            if (parsed.missingFields && parsed.missingFields.length > 0) {
              message += `**I need the following information:**\n`;
              message += parsed.missingFields.map(field => `• ${field}`).join('\n');
              message += '\n\n';
            }
            
            if (parsed.notes && parsed.notes.length > 0) {
              message += `**Notes:**\n`;
              message += parsed.notes.map(note => `• ${note}`).join('\n');
            }
            
            formattedResponse = message;
          } else if (parsed.delegated_to === 'WeatherAnalyst') {
            const decision = parsed.decision || parsed.weatherDecision || 'UNKNOWN';
            const temp = parsed.temperature || parsed.temp || 'N/A';
            const wind = parsed.windSpeed || parsed.wind || 'N/A';
            
            formattedResponse = `**Weather Analysis**\n\n`;
            formattedResponse += `Status: ${decision}\n`;
            formattedResponse += `Temperature: ${temp}°F\n`;
            formattedResponse += `Wind Speed: ${wind} mph\n`;
            
            if (parsed.reasoning) {
              formattedResponse += `\nReasoning: ${parsed.reasoning}`;
            }
          }
        } catch (e) {
          // Not JSON, use as-is
        }
        
        const aiResponse = {
          id: Date.now() + 1,
          type: 'ai',
          content: formattedResponse,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiResponse]);
        
        // Save AI response to TiDB
        await saveMessageToTiDB(aiResponse);
      }
    } catch (error) {
      console.error('Failed to send quick action:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      // Save error message to TiDB
      await saveMessageToTiDB(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) {
    // Don't render anything when closed - dock navigation handles opening
    return null;
  }
  
  // Render minimized bubble
  if (isMinimized) {
    return (
      <motion.div
        className="floating-ai-bubble"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          zIndex: 10300 // Higher than sidebar and all other UI elements
        }}
        drag
        dragConstraints={{
          left: isSidebarExpanded ? 280 : 100,
          right: window.innerWidth - 80,
          top: 60,
          bottom: window.innerHeight - 80
        }}
        onDragEnd={(event, info) => {
          const rect = event.currentTarget.getBoundingClientRect();
          saveCurrentPosition(rect.left, rect.top);
        }}
        onClick={() => setIsMinimized(false)}
      >
        <AnimatedFlameLogo size={24} animated={true} />
        {messages.filter(m => m.type === 'ai').length > 0 && (
          <span className="bubble-badge">
            {messages.filter(m => m.type === 'ai').length}
          </span>
        )}
      </motion.div>
    );
  }

  // Render expanded view
  return (
    <motion.div
      className="floating-ai-container"
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: 0,
        width: size.width,
        height: size.height
      }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ type: "spring", stiffness: 100, damping: 30, restDelta: 0.001 }}
      drag
      dragConstraints={{
        left: isSidebarExpanded ? 280 : 100, // Prevent dragging into sidebar area
        right: window.innerWidth - size.width - 20,
        top: 60, // Minimum top margin
        bottom: window.innerHeight - size.height - 20
      }}
      dragElastic={0.1}
      onDragEnd={(event, info) => {
        // Save position when drag ends
        const rect = event.currentTarget.getBoundingClientRect();
        saveCurrentPosition(rect.left, rect.top);
      }}
      style={{ 
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 10300, // Above sidebar and all other UI elements including dock
      }}
    >
      {/* Header */}
      <div 
        className="floating-ai-header"
        style={{ cursor: 'grab' }}
      >
        <div className="header-left">
          <AnimatedFlameLogo size={16} animated={false} />
          <span className="header-title">AI Assistant</span>
        </div>
        <div className="header-actions">
          <button 
            className="header-btn"
            onClick={() => setIsMinimized(true)}
            title="Minimize"
          >
            –
          </button>
          <button 
            className="header-btn"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="floating-ai-messages">
        {messages.map((message) => (
          <div key={message.id} className={`floating-message ${message.type}`}>
            <div className="message-bubble">
              {message.content}
            </div>
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isLoading && (
          <div className="floating-message ai">
            <div className="message-bubble typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Quick Actions */}
      {messages.length === 0 && !isLoading && (
        <div className="floating-ai-quick">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action.prompt)}
              disabled={isLoading}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Input Area */}
      <div className="floating-ai-input">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="ai-input-field"
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          className="ai-send-btn"
        >
          {isLoading ? (
            <div className="loading-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4 20-7z"/>
            </svg>
          )}
        </button>
      </div>
      
      {/* Resize Handle */}
      <div
        className="floating-ai-resize-handle"
        onMouseDown={handleResizeStart}
      />
    </motion.div>
  );
};

export default FloatingAI;