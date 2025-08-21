/**
 * DemoEntryCard.js - Demo Mode Entry Point
 * Attractive card component for login page demo invitation
 * Real TiDB integration with production-ready UX
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaRocket, FaDatabase, FaRobot, FaArrowRight, FaSpinner, FaClock, FaSync } from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './DemoEntryCard.css';

const DemoEntryCard = ({ isDemoAvailable, demoStats }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [existingSession, setExistingSession] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  // Check for existing demo session
  useEffect(() => {
    const checkExistingSession = () => {
      const demoContext = sessionStorage.getItem('burnwise_demo_context');
      if (demoContext) {
        try {
          const session = JSON.parse(demoContext);
          const expiresAt = new Date(session.expiresAt);
          const now = new Date();
          
          if (expiresAt > now) {
            setExistingSession(session);
            const msRemaining = expiresAt - now;
            const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
            setTimeRemaining({ hours: hoursRemaining, minutes: minutesRemaining });
          } else {
            // Session expired, clear it
            sessionStorage.removeItem('burnwise_demo_context');
            setExistingSession(null);
          }
        } catch (error) {
          console.error('Error parsing demo session:', error);
          sessionStorage.removeItem('burnwise_demo_context');
        }
      }
    };

    checkExistingSession();
    // Check every minute for expiry
    const interval = setInterval(checkExistingSession, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleTryDemo = async () => {
    setIsLoading(true);
    
    try {
      if (existingSession) {
        // Continue existing session
        navigate('/demo/spatial');
      } else {
        // Start new session
        navigate('/demo/initialize');
      }
    } catch (error) {
      console.error('Demo navigation error:', error);
      setIsLoading(false);
    }
  };

  const handleResetDemo = async () => {
    setIsLoading(true);
    try {
      // Clear existing session
      sessionStorage.removeItem('burnwise_demo_context');
      setExistingSession(null);
      setTimeRemaining(null);
      // Navigate to demo initialization
      navigate('/demo/initialize');
    } catch (error) {
      console.error('Demo reset error:', error);
      setIsLoading(false);
    }
  };

  if (!isDemoAvailable) {
    return null; // Don't show if demo is not available
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="demo-entry-card"
    >
      {/* Header */}
      <div className="demo-entry-header">
        <div className="demo-entry-logo">
          <AnimatedFlameLogo size={32} animated={true} />
        </div>
        <h3 className="demo-entry-title">
          {existingSession ? 'Continue Demo Session' : 'Try BURNWISE Demo'}
        </h3>
        <p className="demo-entry-subtitle">
          {existingSession 
            ? `${existingSession.mode === 'preloaded' ? 'Sample Farm' : 'Blank Slate'} - Session Active`
            : 'Experience our AI-powered burn coordination system with real data'
          }
        </p>
        {existingSession && timeRemaining && (
          <div className="demo-session-info">
            <FaClock className="demo-time-icon" />
            <span className="demo-time-remaining">
              {timeRemaining.hours}h {timeRemaining.minutes}m remaining
            </span>
          </div>
        )}
      </div>

      {/* Features */}
      <div className="demo-entry-features">
        <div className="demo-feature">
          <FaRobot className="demo-feature-icon" />
          <span>5 AI Agents</span>
        </div>
        <div className="demo-feature">
          <FaDatabase className="demo-feature-icon" />
          <span>Real TiDB Integration</span>
        </div>
        <div className="demo-feature">
          <FaRocket className="demo-feature-icon" />
          <span>Full 3D Interface</span>
        </div>
      </div>

      {/* Statistics */}
      {demoStats && (
        <div className="demo-entry-stats">
          <div className="demo-stat">
            <div className="demo-stat-value">{demoStats.active_sessions || 0}</div>
            <div className="demo-stat-label">Active Sessions</div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat-value">{demoStats.demo_farms || 0}</div>
            <div className="demo-stat-label">Demo Farms</div>
          </div>
        </div>
      )}

      {/* Call to Action */}
      <div className="demo-entry-actions">
        <motion.button
          className="demo-entry-button"
          onClick={handleTryDemo}
          disabled={isLoading}
          whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(255, 107, 53, 0.4)' }}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <>
              <FaSpinner className="demo-entry-spinner" />
              <span>Loading Demo...</span>
            </>
          ) : (
            <>
              <span>{existingSession ? 'Continue Session' : 'Try Demo Now'}</span>
              <FaArrowRight className="demo-entry-arrow" />
            </>
          )}
        </motion.button>
        
        {existingSession && (
          <motion.button
            className="demo-entry-reset"
            onClick={handleResetDemo}
            disabled={isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <FaSync className="demo-reset-icon" />
            <span>Start New Demo</span>
          </motion.button>
        )}
      </div>

      {/* Benefits */}
      <div className="demo-entry-benefits">
        <div className="demo-benefit">✓ No registration required</div>
        <div className="demo-benefit">✓ Full feature access</div>
        <div className="demo-benefit">✓ Real AI interactions</div>
        <div className="demo-benefit">✓ 24-hour session</div>
      </div>

      {/* Badge */}
      <div className="demo-entry-badge">
        <span>Live Demo</span>
      </div>
    </motion.div>
  );
};

export default DemoEntryCard;