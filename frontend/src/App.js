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
    // Function to measure and set torch position
    const measureAndSetPosition = async () => {
      // Wait for Inter font to load
      try {
        await document.fonts.load('900 6rem Inter');
      } catch (e) {
        log('Font load error, continuing anyway', e);
      }
      
      // The Landing component has the flame at:
      // - The "I" wrapped in a span with position: relative
      // - Flame positioned at left: 50%, transform: translateX(-50%)
      // This centers it over the "I" character
      
      // In Landing.css, the absolute flame position for "I" is well-tested
      // We need to match that exact position
      // From the test: Landing Flame at (879.4) and "I" at (879.4) = perfect alignment
      // But torch lands at (917.7) = 38.3px too far right
      
      // The issue is the "I" position calculation
      // Let's use the same structure as Landing.js does
      
      // Create a test element matching the Landing.js structure
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: clamp(3rem, 8vw, 6rem);
        font-weight: 900;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: -0.02em;
        white-space: nowrap;
        pointer-events: none;
        z-index: -1;
        visibility: hidden;
      `;
      
      // Match the Landing.js structure exactly
      // Use the same responsive font sizing
      const fontSize = window.getComputedStyle(document.documentElement).fontSize;
      const actualFontSize = Math.min(Math.max(3 * 16, window.innerWidth * 0.08), 6 * 16);
      tempDiv.style.fontSize = `${actualFontSize}px`;
      
      // Match the Landing.js structure: BURNW[I]SE
      tempDiv.innerHTML = `
        <span style="position: relative; display: inline-block;">
          BURNW<span style="position: relative; display: inline-block;">I</span>SE
        </span>
      `;
      document.body.appendChild(tempDiv);
      
      // Force layout
      tempDiv.offsetHeight;
      
      // Get the "I" span
      const iSpan = tempDiv.querySelector('span span');
      const iRect = iSpan.getBoundingClientRect();
      const tempRect = tempDiv.getBoundingClientRect();
      
      // Calculate offset from viewport center
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      
      // The "I" center relative to viewport center
      const iCenterX = iRect.left + iRect.width / 2;
      const targetX = iCenterX - viewportCenterX;
      
      // Vertical: place flame 65px above the text top
      // The gap in the test is 47.8px, we need 65px, so add 17.2px more
      const targetY = tempRect.top - viewportCenterY - 82; // 65px ideal + 17px adjustment
      
      // Clean up
      document.body.removeChild(tempDiv);
      
      // Set CSS variables for the animation
      const root = document.documentElement;
      root.style.setProperty('--torch-x', `${targetX}px`);
      root.style.setProperty('--torch-y', `${targetY}px`);
      root.style.setProperty('--torch-scale', '0.36');
      
      log('Torch position calculated', { 
        targetX, 
        targetY,
        iCenterX,
        viewportCenterX,
        textTop: tempRect.top
      });
    };
    
    // Run measurement immediately
    measureAndSetPosition();
    
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