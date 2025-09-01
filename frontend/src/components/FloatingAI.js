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
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './FloatingAI.css';

const FloatingAI = ({ isOpen, onClose, onOpen }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('burnwise-sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [position, setPosition] = useState(() => {
    // Load saved position or use default
    const saved = localStorage.getItem('burnwise-ai-position');
    if (saved) {
      return JSON.parse(saved);
    }
    const sidebarWidth = localStorage.getItem('burnwise-sidebar-expanded') === 'false' ? 70 : 250;
    return { x: sidebarWidth + 20, y: 80 };
  });
  const [size, setSize] = useState(() => {
    // Load saved size or use default
    const saved = localStorage.getItem('burnwise-ai-size');
    if (saved) {
      return JSON.parse(saved);
    }
    return { width: 360, height: 500 };
  });
  const [isResizing, setIsResizing] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const socket = useRef(null);
  const resizeStartPos = useRef(null);
  const resizeStartSize = useRef(null);
  
  // Save message to TiDB
  const saveMessageToTiDB = useCallback(async (message) => {
    try {
      await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'floating-ai',
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
  }, []);
  
  // Load chat history from TiDB
  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/chat/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: 'floating-ai',
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
        // Add welcome message if no history exists
        const welcomeMessage = {
          id: Date.now(),
          type: 'ai',
          content: 'Hello! I can help you schedule burns, check weather, and manage your operations. Just ask!',
          timestamp: new Date()
        };
        
        setMessages([welcomeMessage]);
        
        // Save welcome message to TiDB
        await saveMessageToTiDB(welcomeMessage);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      
      // Fallback: Add welcome message
      const welcomeMessage = {
        id: Date.now(),
        type: 'ai',
        content: 'Hello! I can help you schedule burns, check weather, and manage your operations. Just ask!',
        timestamp: new Date()
      };
      
      setMessages([welcomeMessage]);
    }
  }, [saveMessageToTiDB]);
  
  useEffect(() => {
    // Initialize socket connection
    socket.current = io(process.env.REACT_APP_API_URL || 'http://localhost:5001');
    
    // Load chat history from TiDB
    loadChatHistory();
    
    // Handle window resize for responsive dimensions
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    // Listen for sidebar state changes in localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'burnwise-sidebar-expanded') {
        const newExpanded = JSON.parse(e.newValue);
        setIsSidebarExpanded(newExpanded);
        
        // Adjust position when sidebar changes
        const newSidebarWidth = newExpanded ? 250 : 70;
        setPosition(prev => ({
          x: Math.max(newSidebarWidth + 20, prev.x),
          y: prev.y
        }));
      }
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadChatHistory]);
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Save position when it changes
  useEffect(() => {
    if (position.x !== undefined && position.y !== undefined) {
      localStorage.setItem('burnwise-ai-position', JSON.stringify(position));
    }
  }, [position]);
  
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
      
      const newWidth = Math.min(Math.max(300, resizeStartSize.current.width + deltaX), windowSize.width - position.x - 20);
      const newHeight = Math.min(Math.max(400, resizeStartSize.current.height + deltaY), windowSize.height - position.y - 100);
      
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
  }, [isResizing, position, windowSize]);

  
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
    
    // Save user message to TiDB
    await saveMessageToTiDB(userMessage);
    
    const messageToSend = inputMessage;
    setInputMessage('');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001'}/api/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          userId: 'spatial-ui',
          conversationId: 'floating-ai'
        })
      });
      
      const data = await response.json();
      
      // Handle both success and failure responses
      let formattedResponse = data.response;
      
      if (data.success) {
        // Parse the response if it's JSON
        try {
          const parsed = JSON.parse(data.response);
          
          // Format based on agent type
          if (parsed.delegated_to === 'BurnRequestAgent') {
            // Format burn request response
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
            // Format weather response
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
            
          } else if (parsed.conflictsDetected !== undefined) {
            // Format conflict resolver response
            formattedResponse = `**Conflict Analysis**\n\n`;
            formattedResponse += parsed.conflictsDetected 
              ? `⚠️ Conflicts detected with nearby farms. Adjusting schedule...`
              : `✅ No conflicts detected. Your burn window is clear.`;
              
          } else if (parsed.scheduled) {
            // Format schedule optimizer response
            formattedResponse = `**Schedule Confirmed**\n\n`;
            formattedResponse += `Your burn has been scheduled.\n`;
            if (parsed.optimizedTime) {
              formattedResponse += `Optimal time: ${parsed.optimizedTime}`;
            }
            
          } else if (typeof parsed === 'object') {
            // Fallback: try to format any object nicely
            if (parsed.message) {
              formattedResponse = parsed.message;
            } else if (parsed.error) {
              formattedResponse = `Error: ${parsed.error}`;
            } else {
              // Last resort: show key information
              formattedResponse = 'I processed your request. ';
              if (parsed.status) formattedResponse += `Status: ${parsed.status}. `;
              if (parsed.result) formattedResponse += `Result: ${parsed.result}`;
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
          conversationId: 'floating-ai'
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
    const sidebarWidth = isSidebarExpanded ? 250 : 70;
    return (
      <motion.div
        className="floating-ai-bubble"
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragElastic={0.2}
        dragConstraints={{
          top: 0,
          left: sidebarWidth,
          right: windowSize.width - 60,
          bottom: windowSize.height - 60
        }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{ 
          x: position.x, 
          y: position.y,
          zIndex: 300
        }}
        onClick={() => setIsMinimized(false)}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragControls.start(e);
        }}
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
  const sidebarWidth = isSidebarExpanded ? 250 : 70;
  return (
    <motion.div
      ref={constraintsRef}
      className="floating-ai-container"
      drag
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.2}
      dragConstraints={{
        top: 0,
        left: sidebarWidth,
        right: windowSize.width - size.width,
        bottom: windowSize.height - size.height
      }}
      dragListener={false} // Disable automatic drag - we'll control it via header
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
      style={{ 
        x: position.x, 
        y: position.y,
        position: 'fixed',
        zIndex: 10100, // Above the dock
        cursor: isResizing ? 'nwse-resize' : 'default'
      }}
      onDragEnd={(e, info) => {
        // Update position when drag ends
        setPosition({ x: info.x, y: info.y });
      }}
    >
      {/* Header with drag handle */}
      <motion.div 
        className="floating-ai-header"
        onPointerDown={(e) => {
          e.preventDefault();
          dragControls.start(e);
        }}
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
      
      {/* Messages and controls */}
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
          
          {/* Resize Handle */}
          <div 
            className="floating-ai-resize-handle"
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '20px',
              height: '20px',
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, rgba(255, 107, 53, 0.3) 50%)',
              borderBottomRightRadius: '16px'
            }}
          />
    </motion.div>
  );
};

export default FloatingAI;