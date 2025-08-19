/**
 * HandoffDiagram.js - Visual Agent Delegation Flow
 * Shows real agent handoffs using OpenAI Agents SDK patterns
 * Visualizes the 5-agent system delegation hierarchy
 * NO MOCKS - Real agent handoff visualization
 */

import React, { useState, useEffect } from 'react';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './HandoffDiagram.css';

const HandoffDiagram = ({ activeAgent = 'BurnwiseOrchestrator', recentHandoffs = [] }) => {
  const [animatingHandoff, setAnimatingHandoff] = useState(null);

  // Real agent definitions matching backend agents-sdk/
  const agents = {
    'BurnwiseOrchestrator': {
      name: 'Burnwise Orchestrator',
      color: '#ff6b35',
      position: { x: 50, y: 20 },
      description: 'Main coordinator - delegates to specialists',
      handoffTargets: ['BurnRequestAgent', 'WeatherAnalyst', 'ConflictResolver', 'ScheduleOptimizer', 'ProactiveMonitor']
    },
    'BurnRequestAgent': {
      name: 'Burn Request Agent',
      color: '#4CAF50',
      position: { x: 15, y: 60 },
      description: 'Natural language → structured JSON (GPT-5-mini)',
      handoffTargets: []
    },
    'WeatherAnalyst': {
      name: 'Weather Analyst',
      color: '#2196F3',
      position: { x: 35, y: 75 },
      description: 'Autonomous SAFE/UNSAFE/MARGINAL decisions (GPT-5-nano)',
      handoffTargets: []
    },
    'ConflictResolver': {
      name: 'Conflict Resolver',
      color: '#FF9800',
      position: { x: 50, y: 85 },
      description: 'Multi-farm negotiation (GPT-5-mini)',
      handoffTargets: []
    },
    'ScheduleOptimizer': {
      name: 'Schedule Optimizer',
      color: '#9C27B0',
      position: { x: 65, y: 75 },
      description: 'AI-enhanced simulated annealing (GPT-5-nano)',
      handoffTargets: []
    },
    'ProactiveMonitor': {
      name: 'Proactive Monitor',
      color: '#607D8B',
      position: { x: 85, y: 60 },
      description: '24/7 autonomous monitoring (GPT-5-nano)',
      handoffTargets: []
    }
  };

  // Connection lines from orchestrator to each specialist
  const connections = [
    { from: 'BurnwiseOrchestrator', to: 'BurnRequestAgent', label: 'Natural Language' },
    { from: 'BurnwiseOrchestrator', to: 'WeatherAnalyst', label: 'Weather Safety' },
    { from: 'BurnwiseOrchestrator', to: 'ConflictResolver', label: 'Conflicts' },
    { from: 'BurnwiseOrchestrator', to: 'ScheduleOptimizer', label: 'Scheduling' },
    { from: 'BurnwiseOrchestrator', to: 'ProactiveMonitor', label: 'Monitoring' }
  ];

  useEffect(() => {
    // Animate handoffs when they occur
    if (recentHandoffs.length > 0) {
      const latestHandoff = recentHandoffs[recentHandoffs.length - 1];
      setAnimatingHandoff(latestHandoff);
      
      setTimeout(() => {
        setAnimatingHandoff(null);
      }, 2000);
    }
  }, [recentHandoffs]);

  const getConnectionPath = (fromAgent, toAgent) => {
    const from = agents[fromAgent];
    const to = agents[toAgent];
    
    if (!from || !to) return '';
    
    const fromX = from.position.x;
    const fromY = from.position.y;
    const toX = to.position.x;
    const toY = to.position.y;
    
    // Calculate control points for curved path
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2 - 10; // Slight curve
    
    return `M ${fromX} ${fromY} Q ${midX} ${midY} ${toX} ${toY}`;
  };

  const isAgentActive = (agentKey) => {
    return activeAgent === agentKey;
  };

  const isConnectionActive = (connection) => {
    return animatingHandoff && 
           animatingHandoff.from === connection.from && 
           animatingHandoff.to === connection.to;
  };

  const getRecentHandoffInfo = () => {
    if (recentHandoffs.length === 0) return null;
    
    return recentHandoffs.slice(-3).reverse(); // Show last 3 handoffs
  };

  return (
    <div className="handoff-diagram">
      <div className="diagram-header">
        <h3>Agent Delegation Flow</h3>
        <p>Real OpenAI Agents SDK handoff system</p>
      </div>

      <div className="diagram-container">
        <svg className="connections-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          {/* Connection lines */}
          {connections.map((connection, idx) => (
            <g key={idx}>
              <path
                d={getConnectionPath(connection.from, connection.to)}
                className={`connection-line ${isConnectionActive(connection) ? 'active' : ''}`}
                stroke={agents[connection.to]?.color || '#666'}
                strokeWidth="0.5"
                fill="none"
                strokeDasharray="2,1"
              />
              {isConnectionActive(connection) && (
                <circle
                  className="handoff-pulse"
                  r="1"
                  fill={agents[connection.to]?.color}
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="1"
                    path={getConnectionPath(connection.from, connection.to)}
                  />
                </circle>
              )}
            </g>
          ))}
        </svg>

        {/* Agent nodes */}
        {Object.entries(agents).map(([agentKey, agent]) => (
          <div
            key={agentKey}
            className={`agent-node ${isAgentActive(agentKey) ? 'active' : ''}`}
            style={{
              left: `${agent.position.x}%`,
              top: `${agent.position.y}%`,
              '--agent-color': agent.color
            }}
          >
            <div className="agent-icon">
              <AnimatedFlameLogo size={20} animated={false} />
            </div>
            <div className="agent-name">{agent.name}</div>
            <div className="agent-description">{agent.description}</div>
            
            {isAgentActive(agentKey) && (
              <div className="active-indicator">
                <div className="pulse-ring"></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Handoff History */}
      {getRecentHandoffInfo() && (
        <div className="handoff-history">
          <h4>Recent Handoffs</h4>
          <div className="handoff-list">
            {getRecentHandoffInfo().map((handoff, idx) => (
              <div key={idx} className="handoff-item">
                <div className="handoff-agents">
                  <span 
                    className="handoff-from"
                    style={{ color: agents[handoff.from]?.color }}
                  >
                    <AnimatedFlameLogo size={14} animated={false} /> {agents[handoff.from]?.name}
                  </span>
                  <span className="handoff-arrow">→</span>
                  <span 
                    className="handoff-to"
                    style={{ color: agents[handoff.to]?.color }}
                  >
                    <AnimatedFlameLogo size={14} animated={false} /> {agents[handoff.to]?.name}
                  </span>
                </div>
                <div className="handoff-reason">{handoff.reason}</div>
                <div className="handoff-time">
                  {new Date(handoff.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Capabilities Legend */}
      <div className="capabilities-legend">
        <h4>Agent Capabilities</h4>
        <div className="capabilities-grid">
          {Object.entries(agents).filter(([key]) => key !== 'BurnwiseOrchestrator').map(([agentKey, agent]) => (
            <div key={agentKey} className="capability-item">
              <div 
                className="capability-icon"
                style={{ backgroundColor: agent.color }}
              >
                <AnimatedFlameLogo size={16} animated={false} />
              </div>
              <div className="capability-info">
                <div className="capability-name">{agent.name}</div>
                <div className="capability-description">{agent.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Status */}
      <div className="system-status">
        <div className="status-item">
          <span className="status-label">Active Agent:</span>
          <span 
            className="status-value"
            style={{ color: agents[activeAgent]?.color }}
          >
            <AnimatedFlameLogo size={16} animated={false} /> {agents[activeAgent]?.name}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Total Handoffs:</span>
          <span className="status-value">{recentHandoffs.length}</span>
        </div>
        <div className="status-item">
          <span className="status-label">System:</span>
          <span className="status-value status-online">OpenAI Agents SDK</span>
        </div>
      </div>
    </div>
  );
};

export default HandoffDiagram;