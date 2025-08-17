/**
 * AgentChat.js - Conversational UI with Real Agent Handoffs
 * Replaces 18-field forms with natural language chat interface
 * Shows real agent delegation and handoff visualization
 * NO MOCKS - Real OpenAI Agents SDK integration
 */

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import ApprovalModal from './ApprovalModal';
import './AgentChat.css';

const AgentChat = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState('BurnwiseOrchestrator');
  const [socket, setSocket] = useState(null);
  const [conversationId] = useState(() => Date.now().toString());
  const [approvalModal, setApprovalModal] = useState({ isOpen: false, request: null });
  const messagesEndRef = useRef(null);

  // Real agent definitions from backend
  const agents = {
    'BurnwiseOrchestrator': {
      name: 'Burnwise Orchestrator',
      icon: '🎯',
      color: '#ff6b35',
      description: 'Main coordinator - delegates to specialist agents'
    },
    'BurnRequestAgent': {
      name: 'Burn Request Agent',
      icon: '📝',
      color: '#4CAF50',
      description: 'Processes natural language burn requests'
    },
    'WeatherAnalyst': {
      name: 'Weather Analyst',
      icon: '🌤️',
      color: '#2196F3',
      description: 'Autonomous SAFE/UNSAFE/MARGINAL decisions'
    },
    'ConflictResolver': {
      name: 'Conflict Resolver',
      icon: '⚖️',
      color: '#FF9800',
      description: 'Multi-farm negotiation and mediation'
    },
    'ScheduleOptimizer': {
      name: 'Schedule Optimizer',
      icon: '⏰',
      color: '#9C27B0',
      description: 'AI-enhanced simulated annealing'
    },
    'ProactiveMonitor': {
      name: 'Proactive Monitor',
      icon: '👁️',
      color: '#607D8B',
      description: '24/7 autonomous monitoring'
    }
  };

  // Example prompts for farmers
  const examplePrompts = [
    "I need to burn 150 acres of wheat stubble on my farm tomorrow morning for pest control",
    "Is the weather safe for burning today?",
    "Can you check for conflicts with other farms burning this week?",
    "Optimize the burn schedule for next Tuesday",
    "Set up monitoring for my upcoming burns"
  ];

  useEffect(() => {
    // Initialize Socket.io connection
    const newSocket = io('http://localhost:5001');
    setSocket(newSocket);

    // Listen for agent events
    newSocket.on('agent.thinking', (data) => {
      setCurrentAgent(data.agent);
      addMessage({
        type: 'thinking',
        agent: data.agent,
        content: data.thought,
        confidence: data.confidence,
        timestamp: new Date()
      });
    });

    newSocket.on('agent.completed', (data) => {
      addMessage({
        type: 'agent_response',
        agent: data.agent,
        content: data.result,
        toolsUsed: data.toolsUsed,
        timestamp: new Date()
      });
      setIsLoading(false);
    });

    newSocket.on('agent.handoff', (data) => {
      setCurrentAgent(data.to);
      addMessage({
        type: 'handoff',
        from: data.from,
        to: data.to,
        reason: data.reason,
        timestamp: new Date()
      });
    });

    // Listen for approval requests
    newSocket.on('approval.required', (data) => {
      setApprovalModal({
        isOpen: true,
        request: {
          id: data.requestId,
          type: data.type || 'MARGINAL_WEATHER',
          severity: data.severity || 'MARGINAL',
          description: data.description || 'Weather conditions are marginal and require human approval',
          burnData: data.burnData,
          weatherData: data.weatherData,
          riskFactors: data.riskFactors || [],
          aiRecommendation: data.aiRecommendation
        }
      });
      
      addMessage({
        type: 'approval_request',
        agent: data.agent || 'WeatherAnalyst',
        content: `⚠️ Human approval required: ${data.description}`,
        timestamp: new Date()
      });
    });

    // Listen for approval results
    newSocket.on('approval.result', (data) => {
      addMessage({
        type: 'approval_result',
        decision: data.decision,
        content: `✓ Burn ${data.decision === 'approved' ? 'approved' : 'rejected'} by human operator${data.reasoning ? `: ${data.reasoning}` : ''}`,
        timestamp: new Date()
      });
    });

    // Add welcome message
    setTimeout(() => {
      addMessage({
        type: 'agent_response',
        agent: 'BurnwiseOrchestrator',
        content: `Welcome to BURNWISE! I'm your agricultural burn coordinator. I can help you schedule burns, check weather safety, resolve conflicts, and monitor your operations.

Just tell me what you need in natural language - no forms to fill out! I'll delegate to specialist agents automatically.

Try saying something like: "I need to burn 100 acres of wheat tomorrow morning"`,
        timestamp: new Date()
      });
    }, 1000);

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, { ...message, id: Date.now() + Math.random() }]);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    addMessage(userMessage);
    setIsLoading(true);
    
    const messageToSend = inputMessage;
    setInputMessage('');

    try {
      // Send to real agent system
      const response = await fetch('http://localhost:5001/api/agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageToSend,
          userId: 'farmer-chat',
          conversationId: conversationId
        }),
      });

      const data = await response.json();

      if (data.success) {
        addMessage({
          type: 'agent_response',
          agent: currentAgent,
          content: data.response,
          toolsUsed: data.toolsUsed,
          duration: data.duration,
          timestamp: new Date()
        });
      } else {
        addMessage({
          type: 'error',
          content: data.error || 'Failed to process message',
          timestamp: new Date()
        });
      }
    } catch (error) {
      addMessage({
        type: 'error',
        content: 'Connection error. Please try again.',
        timestamp: new Date()
      });
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

  const handleExamplePrompt = (prompt) => {
    setInputMessage(prompt);
  };

  const handleApprove = async (response) => {
    if (socket) {
      socket.emit('approval.response', {
        requestId: response.approvalData.requestId,
        decision: 'approved',
        reasoning: response.reasoning,
        timestamp: response.timestamp,
        conversationId
      });
    }
    setApprovalModal({ isOpen: false, request: null });
  };

  const handleReject = async (response) => {
    if (socket) {
      socket.emit('approval.response', {
        requestId: response.approvalData.requestId,
        decision: 'rejected',
        reasoning: response.reasoning,
        timestamp: response.timestamp,
        conversationId
      });
    }
    setApprovalModal({ isOpen: false, request: null });
  };

  const renderMessage = (message) => {
    switch (message.type) {
      case 'user':
        return (
          <div className="message user-message">
            <div className="message-avatar">👨‍🌾</div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        );

      case 'agent_response':
        const agent = agents[message.agent] || agents['BurnwiseOrchestrator'];
        return (
          <div className="message agent-message">
            <div className="message-avatar" style={{ backgroundColor: agent.color }}>
              {agent.icon}
            </div>
            <div className="message-content">
              <div className="agent-name">{agent.name}</div>
              <div className="message-text">
                {typeof message.content === 'string' 
                  ? message.content 
                  : JSON.stringify(message.content, null, 2)
                }
              </div>
              {message.toolsUsed && message.toolsUsed.length > 0 && (
                <div className="tools-used">
                  <span className="tools-label">Tools used:</span>
                  {message.toolsUsed.map((tool, idx) => (
                    <span key={idx} className="tool-badge">
                      {tool.name || tool}
                    </span>
                  ))}
                </div>
              )}
              {message.duration && (
                <div className="message-meta">
                  Processing time: {(message.duration / 1000).toFixed(1)}s
                </div>
              )}
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        );

      case 'handoff':
        const fromAgent = agents[message.from] || agents['BurnwiseOrchestrator'];
        const toAgent = agents[message.to] || agents['BurnwiseOrchestrator'];
        return (
          <div className="message handoff-message">
            <div className="handoff-indicator">
              <span className="handoff-from" style={{ color: fromAgent.color }}>
                {fromAgent.icon} {fromAgent.name}
              </span>
              <span className="handoff-arrow">→</span>
              <span className="handoff-to" style={{ color: toAgent.color }}>
                {toAgent.icon} {toAgent.name}
              </span>
            </div>
            <div className="handoff-reason">{message.reason}</div>
            <div className="message-time">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        );

      case 'thinking':
        const thinkingAgent = agents[message.agent] || agents['BurnwiseOrchestrator'];
        return (
          <div className="message thinking-message">
            <div className="thinking-indicator">
              <div className="thinking-avatar" style={{ backgroundColor: thinkingAgent.color }}>
                {thinkingAgent.icon}
              </div>
              <div className="thinking-content">
                <div className="thinking-text">{message.content}</div>
                <div className="thinking-progress">
                  <div 
                    className="thinking-bar" 
                    style={{ width: `${message.confidence}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="message error-message">
            <div className="message-avatar">⚠️</div>
            <div className="message-content">
              <div className="message-text">{message.content}</div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getCurrentAgentInfo = () => {
    return agents[currentAgent] || agents['BurnwiseOrchestrator'];
  };

  return (
    <>
      <ApprovalModal
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({ isOpen: false, request: null })}
        approvalRequest={approvalModal.request}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      <div className="agent-chat">
      <div className="chat-header">
        <div className="current-agent">
          <div 
            className="agent-avatar" 
            style={{ backgroundColor: getCurrentAgentInfo().color }}
          >
            {getCurrentAgentInfo().icon}
          </div>
          <div className="agent-info">
            <div className="agent-name">{getCurrentAgentInfo().name}</div>
            <div className="agent-description">{getCurrentAgentInfo().description}</div>
          </div>
        </div>
        <div className="agent-status">
          {isLoading && (
            <div className="status-indicator loading">
              <div className="spinner"></div>
              Processing...
            </div>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id}>
            {renderMessage(message)}
          </div>
        ))}
        {isLoading && (
          <div className="message thinking-message">
            <div className="thinking-indicator">
              <div className="thinking-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Agent is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && (
        <div className="example-prompts">
          <div className="prompts-header">Try these examples:</div>
          <div className="prompts-list">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                className="prompt-button"
                onClick={() => handleExamplePrompt(prompt)}
                disabled={isLoading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tell me what you need... (e.g., 'I need to burn 100 acres tomorrow morning')"
          disabled={isLoading}
          rows="1"
          className="input-field"
        />
        <button 
          onClick={sendMessage} 
          disabled={!inputMessage.trim() || isLoading}
          className="send-button"
        >
          {isLoading ? '⏳' : '🔥'}
        </button>
      </div>
    </div>
    </>
  );
};

export default AgentChat;