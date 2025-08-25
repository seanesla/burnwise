/**
 * DemoInitializer.js - Demo Mode Selection and Initialization
 * Production-ready demo selection with real TiDB integration
 * Handles blank slate vs sample data demo modes
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaRocket, FaDatabase, FaSpinner, FaCheck, 
  FaLightbulb, FaUsers, FaChartLine, FaArrowRight 
} from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import EmberBackground from './backgrounds/EmberBackground';
import './DemoInitializer.css';

const DemoInitializer = () => {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationStep, setInitializationStep] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [existingSession, setExistingSession] = useState(null);
  const [showExistingWarning, setShowExistingWarning] = useState(false);

  useEffect(() => {
    // Check for existing session
    const demoContext = sessionStorage.getItem('burnwise_demo_context');
    if (demoContext) {
      try {
        const session = JSON.parse(demoContext);
        const expiresAt = new Date(session.expiresAt);
        const now = new Date();
        
        if (expiresAt > now) {
          setExistingSession(session);
          setShowExistingWarning(true);
        } else {
          // Session expired, clear it
          sessionStorage.removeItem('burnwise_demo_context');
        }
      } catch (error) {
        console.error('Error parsing demo session:', error);
        sessionStorage.removeItem('burnwise_demo_context');
      }
    }
    
    // Generate new session ID
    const id = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(id);
  }, []);

  const demoModes = [
    {
      id: 'blank',
      title: 'Blank Slate Demo',
      description: 'Start with an empty farm and experience the full workflow from scratch',
      icon: <FaLightbulb />,
      features: [
        'Empty farm setup',
        'Learn the complete workflow',
        'Experience the AI from first request',
        'See how the system grows with data'
      ],
      color: '#3b82f6',
      recommended: false
    },
    {
      id: 'preloaded',
      title: 'Sample Farm Demo',
      description: 'Explore a pre-populated farm with existing burns and data',
      icon: <FaUsers />,
      features: [
        'Pre-existing burn history',
        'Sample weather data',
        'Active burn schedules',
        'Rich AI conversation history'
      ],
      color: '#10b981',
      recommended: true
    }
  ];

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
  };

  const handleContinueExisting = () => {
    navigate('/demo/spatial');
  };

  const handleStartNewDemo = () => {
    setShowExistingWarning(false);
    sessionStorage.removeItem('burnwise_demo_context');
    setExistingSession(null);
  };

  const handleStartDemo = async () => {
    if (!selectedMode || !sessionId) return;

    setIsInitializing(true);
    setInitializationStep('Creating demo session...');

    try {
      // Call demo initialization API - use backend port for development
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/demo/initialize' 
        : 'http://localhost:5001/api/demo/initialize';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Mode': 'true'
        },
        credentials: 'include', // Important for session cookies
        body: JSON.stringify({
          mode: selectedMode,
          sessionId: sessionId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Store demo session info in sessionStorage for app state
        sessionStorage.setItem('burnwise_demo_context', JSON.stringify({
          sessionId: data.sessionId,
          farmId: data.farmId,
          mode: data.mode,
          expiresAt: data.expiresAt,
          startedAt: new Date().toISOString()
        }));

        setInitializationStep('Setting up AI agents...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        setInitializationStep('Preparing spatial interface...');
        await new Promise(resolve => setTimeout(resolve, 1000));

        setInitializationStep('Demo ready! Redirecting...');
        await new Promise(resolve => setTimeout(resolve, 800));

        // Navigate based on selected mode
        if (selectedMode === 'blank') {
          // Blank slate - go to simplified onboarding
          navigate('/onboarding?demo=blank', { 
            replace: true,
            state: { 
              isDemo: true, 
              demoMode: 'blank',
              sessionId: data.sessionId,
              farmId: data.farmId
            }
          });
        } else {
          // Preloaded sample farm - skip onboarding, go straight to spatial
          navigate('/demo/spatial', { 
            replace: true,
            state: { 
              isDemo: true, 
              demoMode: 'preloaded',
              sessionId: data.sessionId,
              farmId: data.farmId
            }
          });
        }

      } else {
        throw new Error(data.error || 'Demo initialization failed');
      }

    } catch (error) {
      console.error('[DEMO] Initialization failed:', error);
      setInitializationStep('Initialization failed. Please try again.');
      setIsInitializing(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="demo-initializer-container">
        <EmberBackground intensity={0.8} blur={true} />
        <div className="demo-initializer-loading">
          <AnimatedFlameLogo size={80} animated={true} />
          <h2>Setting up your demo...</h2>
          <div className="demo-loading-step">
            <FaSpinner className="demo-loading-spinner" />
            <span>{initializationStep}</span>
          </div>
          <div className="demo-loading-progress">
            <div className="demo-loading-bar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="demo-initializer-container">
      <EmberBackground intensity={1} blur={true} />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="demo-initializer"
      >
        {/* Header */}
        <div className="demo-initializer-header">
          <AnimatedFlameLogo size={60} animated={true} />
          <h1>Choose Your Demo Experience</h1>
          <p>Select how you'd like to experience BURNWISE's AI-powered burn coordination</p>
        </div>

        {/* Existing Session Warning */}
        {showExistingWarning && existingSession && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="demo-existing-warning"
          >
            <div className="warning-content">
              <h3>Active Demo Session Detected</h3>
              <p>You have an active {existingSession.mode === 'preloaded' ? 'Sample Farm' : 'Blank Slate'} demo session.</p>
              <div className="warning-actions">
                <button className="continue-btn" onClick={handleContinueExisting}>
                  Continue Existing Session
                </button>
                <button className="new-btn" onClick={handleStartNewDemo}>
                  Start Fresh Demo
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Mode Selection */}
        <div className="demo-mode-grid">
          {demoModes.map((mode) => (
            <motion.div
              key={mode.id}
              className={`demo-mode-card ${selectedMode === mode.id ? 'selected' : ''}`}
              onClick={() => handleModeSelect(mode.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {mode.recommended && (
                <div className="demo-mode-badge">Recommended</div>
              )}
              
              <div className="demo-mode-icon" style={{ color: mode.color }}>
                {mode.icon}
              </div>
              
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
              
              <ul className="demo-mode-features">
                {mode.features.map((feature, index) => (
                  <li key={index}>
                    <FaCheck />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Start Button */}
        <AnimatePresence>
          {selectedMode && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="demo-start-button"
              onClick={handleStartDemo}
              disabled={isInitializing}
            >
              <span>Start {demoModes.find(m => m.id === selectedMode)?.title}</span>
              <FaArrowRight />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Info */}
        <div className="demo-initializer-info">
          <div className="demo-info-item">
            <FaDatabase />
            <span>Real TiDB Integration</span>
          </div>
          <div className="demo-info-item">
            <FaChartLine />
            <span>Live AI Agents</span>
          </div>
          <div className="demo-info-item">
            <FaRocket />
            <span>24 Hour Session</span>
          </div>
        </div>

        {/* Back to Login */}
        <button 
          className="demo-back-link"
          onClick={() => navigate('/login')}
        >
          ← Back to Login
        </button>
      </motion.div>
    </div>
  );
};

export default DemoInitializer;