import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Map from './components/Map';
import Schedule from './components/Schedule';
import AlertsPanel from './components/AlertsPanel';
import Navigation from './components/Navigation';
import AnimatedFlameLogo from './components/AnimatedFlameLogo';
import './styles/App.css';
import './styles/TorchAnimation.css';

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '🔥 BURNWISE:';

function App() {
  const [showAnimation, setShowAnimation] = useState(true);
  const [debugLog, setDebugLog] = useState([]);
  const mountTimeRef = useRef(Date.now());
  const renderCountRef = useRef(0);
  
  // Log function that tracks everything WITHOUT causing re-renders
  const log = (message, data = {}) => {
    const timestamp = Date.now() - mountTimeRef.current;
    const logEntry = `[${timestamp}ms] ${message}`;
    console.log(LOG_PREFIX, logEntry, data);
    // Don't update state to avoid render loops
    debugLog.push({ timestamp, message, data });
  };
  
  // Track every render WITHOUT causing infinite loop
  useEffect(() => {
    renderCountRef.current++;
    console.log(LOG_PREFIX, `RENDER #${renderCountRef.current}`, { showAnimation });
  });
  
  // Track mount
  useEffect(() => {
    log('APP MOUNTED', { 
      timestamp: new Date().toISOString(),
      AnimatedFlameLogo: !!AnimatedFlameLogo,
      window: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    });
    
    // Check if logo component exists
    if (!AnimatedFlameLogo) {
      log('ERROR: AnimatedFlameLogo NOT FOUND!');
    }
  }, []);
  
  // Set CSS custom properties for the torch position and manage animation
  useEffect(() => {
    // Simple, direct calculation for torch position
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // The "I" in BURNWISE is at character position 6 of 8
    // With centered text, the I is roughly 37.5% from the left edge of the word
    // But since the word is centered, we need offset from center
    // For an 8-character word with monospace-ish rendering:
    // B U R N W I S E
    // 0 1 2 3 4 5 6 7
    // Center is at 3.5, I is at 5.5, so it's 2 characters right of center
    // Each character is roughly word-width/8
    // At 6rem font, BURNWISE is about 480px wide, so each char is ~60px
    // I is 2 chars right = 120px right of center
    const targetX = 120;
    
    // Vertical: flame should be above the title
    // Title is centered vertically, roughly at 50% viewport
    // We want flame ~65px above the text
    const targetY = -120; // Move up from center
    
    // Set CSS variables for the animation
    const root = document.documentElement;
    root.style.setProperty('--torch-x', `${targetX}px`);
    root.style.setProperty('--torch-y', `${targetY}px`);
    root.style.setProperty('--torch-scale', '0.36');
    
    log('Torch position set', { targetX, targetY });
    
    // Hide animation after it completes
    const hideTimer = setTimeout(() => {
      setShowAnimation(false);
      log('Animation complete - hiding wrapper');
    }, 4600); // Animation duration
    
    return () => {
      clearTimeout(hideTimer);
    };
  }, []); // Only run once on mount
  
  return (
    <Router>
      <div className="App">
        {/* DEBUG OVERLAY - SHOWS EVERYTHING */}
        {DEBUG && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            background: 'rgba(255, 0, 0, 0.9)',
            color: 'white',
            padding: '10px',
            zIndex: 10000000,
            fontSize: '11px',
            fontFamily: 'monospace',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              🔥 BRUTE FORCE DEBUG MODE 🔥
            </div>
            <div>Animation: {showAnimation ? 'RUNNING' : 'DONE'} | Renders: {renderCountRef.current}</div>
            <div>Time: {Date.now() - mountTimeRef.current}ms</div>
            <div style={{ marginTop: '5px', fontSize: '10px' }}>
              Animation visible: {showAnimation ? 'YES' : 'NO'} | 
              Logo exists: {AnimatedFlameLogo ? 'YES' : 'NO'}
            </div>
          </div>
        )}
        
        {/* Startup Animation - Single continuous animation */}
        {showAnimation && (
          <div className="torch-animation-wrapper">
            <div className="torch-black-bg"></div>
            <div className="torch-logo">
              {AnimatedFlameLogo ? (
                <AnimatedFlameLogo size={180} animated={true} />
              ) : (
                <div style={{ 
                  color: 'red', 
                  fontSize: '3rem',
                  textAlign: 'center'
                }}>
                  ⚠️ ERROR: LOGO NOT LOADED ⚠️
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Main App - Always visible, animation overlays on top */}
        <div className="app-main">
          <Navigation />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<Landing fromStartup={!showAnimation} hideLogoInitially={showAnimation} animationPhase={showAnimation ? 'animating' : 'done'} />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/map" element={<Map />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/alerts" element={<AlertsPanel />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;