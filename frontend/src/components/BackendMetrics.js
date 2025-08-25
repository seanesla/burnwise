/**
 * BackendMetrics.js - Real-time Backend Visibility Panel
 * Shows actual database queries, cache performance, and operations
 * Glass morphism design matching existing UI
 * NO MOCKS - All data comes from real backend operations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import './BackendMetrics.css';

const BackendMetrics = ({ isOpen, onClose }) => {
  // Real metrics state - no mock data
  const [queryCount, setQueryCount] = useState(0);
  const [cacheStats, setCacheStats] = useState({
    hits: 0,
    misses: 0,
    hitRate: '0%',
    size: 0,
    maxSize: 1000
  });
  const [recentOperations, setRecentOperations] = useState([]);
  const [queryTypes, setQueryTypes] = useState({
    SELECT: 0,
    INSERT: 0,
    UPDATE: 0,
    DELETE: 0,
    SHOW: 0,
    CREATE: 0
  });
  
  const socketRef = useRef(null);
  const operationIdCounter = useRef(0);
  
  // Connection status for debugging
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    // Connect to backend Socket.io
    socketRef.current = io('http://localhost:5001', {
      transports: ['websocket', 'polling'], // Use both transports for reliability
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    // Connection status handlers
    socketRef.current.on('connect', () => {
      console.log('BackendMetrics connected to Socket.io');
      setIsConnected(true);
    });
    
    socketRef.current.on('disconnect', () => {
      console.log('BackendMetrics disconnected from Socket.io');
      setIsConnected(false);
    });
    
    // Listen for real backend events
    socketRef.current.on('backend.query', (data) => {
      setQueryCount(prev => prev + 1);
      
      // Track query types
      if (data.type) {
        setQueryTypes(prev => ({
          ...prev,
          [data.type]: (prev[data.type] || 0) + 1
        }));
      }
      
      // Add to recent operations (keep last 10)
      const operation = {
        id: ++operationIdCounter.current,
        type: 'query',
        label: `${data.type || 'UNKNOWN'} Query`,
        duration: data.duration ? `${data.duration}ms` : 'N/A',
        cached: data.cached || false,
        timestamp: data.timestamp || new Date().toISOString()
      };
      setRecentOperations(prev => [operation, ...prev].slice(0, 10));
    });
    
    socketRef.current.on('backend.cache', (data) => {
      setCacheStats({
        hits: data.hits || 0,
        misses: data.misses || 0,
        hitRate: data.hitRate || '0%',
        size: data.size || 0,
        maxSize: data.maxSize || 1000
      });
    });
    
    socketRef.current.on('backend.performance', (data) => {
      // Add performance operations to list
      const operation = {
        id: ++operationIdCounter.current,
        type: 'performance',
        label: data.operation || 'Operation',
        duration: data.duration ? `${data.duration}ms` : 'N/A',
        timestamp: data.timestamp || new Date().toISOString()
      };
      setRecentOperations(prev => [operation, ...prev].slice(0, 10));
    });
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);
  
  // Calculate cache gauge angle
  const cacheHitPercentage = parseFloat(cacheStats.hitRate) || 0;
  const gaugeAngle = (cacheHitPercentage / 100) * 180 - 90;
  
  // Animation variants for panel
  const panelVariants = {
    hidden: { 
      x: 400, 
      opacity: 0,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 400
      }
    },
    visible: { 
      x: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    }
  };
  
  // Format timestamp for display
  const formatTime = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="backend-metrics-panel"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          {/* Header */}
          <div className="metrics-header">
            <div className="header-content">
              <h3>Backend Metrics</h3>
              {isConnected && <span className="connection-indicator connected" />}
              {!isConnected && <span className="connection-indicator disconnected" />}
            </div>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          {/* Query Counter */}
          <div className="metrics-section">
            <h4>Database Queries</h4>
            <div className="query-counter">
              <motion.div 
                className="counter-value"
                key={queryCount}
                initial={{ scale: 1.2, color: '#FF6B35' }}
                animate={{ scale: 1, color: '#fff' }}
                transition={{ duration: 0.3 }}
              >
                {queryCount}
              </motion.div>
              <div className="counter-label">Total Queries</div>
            </div>
            
            {/* Query type breakdown */}
            <div className="query-types">
              {Object.entries(queryTypes).map(([type, count]) => (
                count > 0 && (
                  <div key={type} className="query-type">
                    <span className="type-label">{type}</span>
                    <span className="type-count">{count}</span>
                  </div>
                )
              ))}
            </div>
          </div>
          
          {/* Cache Performance */}
          <div className="metrics-section">
            <h4>Cache Performance</h4>
            <div className="cache-gauge">
              <svg width="120" height="80" className="gauge-svg">
                {/* Background arc */}
                <path
                  d="M 10 70 A 50 50 0 0 1 110 70"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="8"
                />
                {/* Hit rate arc */}
                <motion.path
                  d="M 10 70 A 50 50 0 0 1 110 70"
                  fill="none"
                  stroke="#FF6B35"
                  strokeWidth="8"
                  strokeDasharray="157"
                  initial={{ strokeDashoffset: 157 }}
                  animate={{ strokeDashoffset: 157 - (157 * cacheHitPercentage / 100) }}
                  transition={{ duration: 0.5 }}
                />
                {/* Center text */}
                <text x="60" y="65" textAnchor="middle" className="gauge-text">
                  {cacheStats.hitRate}
                </text>
              </svg>
              
              <div className="cache-details">
                <div className="cache-stat">
                  <span className="stat-label">Hits:</span>
                  <span className="stat-value success">{cacheStats.hits}</span>
                </div>
                <div className="cache-stat">
                  <span className="stat-label">Misses:</span>
                  <span className="stat-value warning">{cacheStats.misses}</span>
                </div>
                <div className="cache-stat">
                  <span className="stat-label">Size:</span>
                  <span className="stat-value">{cacheStats.size}/{cacheStats.maxSize}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Operations */}
          <div className="metrics-section">
            <h4>Recent Operations</h4>
            <div className="operations-list">
              {recentOperations.length === 0 ? (
                <div className="no-operations">
                  {isConnected ? 'Waiting for operations...' : 'Connecting to backend...'}
                </div>
              ) : (
                recentOperations.map((op) => (
                  <motion.div 
                    key={op.id}
                    className={`operation-item ${op.type}`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="op-time">{formatTime(op.timestamp)}</span>
                    <span className="op-label">{op.label}</span>
                    <span className="op-duration">{op.duration}</span>
                    {op.cached && <span className="op-cached">cached</span>}
                  </motion.div>
                ))
              )}
            </div>
          </div>
          
          {/* TiDB Logo */}
          <div className="tidb-powered">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            <span>Powered by TiDB</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BackendMetrics;