/**
 * FloatingAI.js - Draggable AI Assistant Bubble
 * Floats over the map like Facebook Messenger
 * Can be minimized, maximized, and positioned anywhere
 * Glass morphism design with spring physics
 * NO MOCKS - Real AI integration
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'framer-motion';
import io from 'socket.io-client';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './FloatingAI.css';

const FloatingAI = ({ isOpen, onClose, onOpen }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  
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
    
    // Handle window resize for responsive dimensions
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
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
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: formattedResponse || 'I apologize, but I am currently unable to process your request. Please try again later.',
        timestamp: new Date()
      }]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message to chat
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: 'I apologize, but I encountered an error connecting to the server. Please check your connection and try again.',
        timestamp: new Date()
      }]);
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
    
    try {
      const response = await fetch('http://localhost:5001/api/agents/chat', {
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
        
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          type: 'ai',
          content: formattedResponse,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Failed to send quick action:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!isOpen) {
    // Don't render anything when closed - dock navigation handles opening
    return null;
  }
  
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
        left: 0,
        right: Math.max(0, windowSize.width - Math.min(360, windowSize.width - 30)),
        bottom: Math.max(0, windowSize.height - Math.min(500, windowSize.height - 100))
      }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: isMinimized ? 0.3 : 1,
        y: 0,
        width: isMinimized ? 80 : Math.min(360, windowSize.width - 30),
        height: isMinimized ? 80 : Math.min(500, windowSize.height - 100)
      }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ type: "spring", stiffness: 100, damping: 30, restDelta: 0.001 }}
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