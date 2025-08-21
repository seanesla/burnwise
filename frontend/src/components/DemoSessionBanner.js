/**
 * DemoSessionBanner.js - Demo Session Status Banner
 * Shows demo session info, time remaining, and exit options
 * Displays at top of spatial interface when in demo mode
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaClock, FaTimes, FaInfoCircle } from 'react-icons/fa';
import './DemoSessionBanner.css';

const DemoSessionBanner = () => {
  const navigate = useNavigate();
  const [sessionData, setSessionData] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      const demoContext = sessionStorage.getItem('burnwise_demo_context');
      if (demoContext) {
        try {
          const session = JSON.parse(demoContext);
          const expiresAt = new Date(session.expiresAt);
          const now = new Date();
          
          if (expiresAt > now) {
            setSessionData(session);
            
            // Calculate time remaining
            const msRemaining = expiresAt - now;
            const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
            const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const secondsRemaining = Math.floor((msRemaining % (1000 * 60)) / 1000);
            
            setTimeRemaining({ 
              hours: hoursRemaining, 
              minutes: minutesRemaining,
              seconds: secondsRemaining 
            });
          } else {
            // Session expired
            handleSessionExpired();
          }
        } catch (error) {
          console.error('Error parsing demo session:', error);
        }
      }
    };

    checkSession();
    // Update every second for countdown
    const interval = setInterval(checkSession, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSessionExpired = () => {
    sessionStorage.removeItem('burnwise_demo_context');
    alert('Your demo session has expired. Please start a new demo to continue.');
    navigate('/login');
  };

  const handleExitDemo = () => {
    setShowExitConfirm(true);
  };

  const confirmExit = () => {
    sessionStorage.removeItem('burnwise_demo_context');
    navigate('/login');
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
  };

  if (!sessionData || !timeRemaining) {
    return null;
  }

  // Get last 6 chars of session ID for display
  const shortSessionId = sessionData.sessionId ? 
    sessionData.sessionId.slice(-6).toUpperCase() : 'DEMO';

  return (
    <>
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="demo-session-banner"
          >
            <div className="demo-banner-content">
              <div className="demo-banner-info">
                <div className="demo-banner-title">
                  <FaInfoCircle className="demo-banner-icon" />
                  <span>Demo Mode - {sessionData.mode === 'preloaded' ? 'Sample Farm' : 'Blank Slate'}</span>
                </div>
                <div className="demo-banner-details">
                  <span className="demo-session-id">Session: {shortSessionId}</span>
                </div>
              </div>

              <div className="demo-banner-timer">
                <FaClock className="demo-timer-icon" />
                <span className="demo-time-display">
                  {timeRemaining.hours.toString().padStart(2, '0')}:
                  {timeRemaining.minutes.toString().padStart(2, '0')}:
                  {timeRemaining.seconds.toString().padStart(2, '0')}
                </span>
              </div>

              <div className="demo-banner-actions">
                <button 
                  className="demo-minimize-btn"
                  onClick={() => setIsMinimized(true)}
                  title="Minimize banner"
                >
                  <FaTimes />
                </button>
                <button 
                  className="demo-exit-btn"
                  onClick={handleExitDemo}
                >
                  Exit Demo
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized State */}
      {isMinimized && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="demo-banner-minimized"
          onClick={() => setIsMinimized(false)}
        >
          <FaClock />
          <span>
            {timeRemaining.hours.toString().padStart(2, '0')}:
            {timeRemaining.minutes.toString().padStart(2, '0')}
          </span>
        </motion.div>
      )}

      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="demo-exit-modal-overlay"
            onClick={cancelExit}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="demo-exit-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Exit Demo Session?</h3>
              <p>Your demo progress will be lost. You can start a new demo anytime.</p>
              <div className="demo-exit-modal-actions">
                <button className="demo-exit-confirm" onClick={confirmExit}>
                  Yes, Exit Demo
                </button>
                <button className="demo-exit-cancel" onClick={cancelExit}>
                  Continue Demo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default DemoSessionBanner;