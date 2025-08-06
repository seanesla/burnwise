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
      
      // Create a temporary element to measure the exact "I" position
      const tempDiv = document.createElement('div');
      tempDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 6rem;
        font-weight: 900;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: -0.02em;
        white-space: nowrap;
        pointer-events: none;
        z-index: 99999;
        color: transparent;
      `;
      
      // Create spans for each character to measure positions
      const chars = 'BURNWISE'.split('');
      tempDiv.innerHTML = chars.map(char => `<span style="display: inline-block;">${char}</span>`).join('');
      document.body.appendChild(tempDiv);
      
      // Force layout
      tempDiv.offsetHeight;
      
      // Get the position of the "I" (index 6)
      const spans = tempDiv.querySelectorAll('span');
      const iSpan = spans[6];
      const tempRect = tempDiv.getBoundingClientRect();
      const iRect = iSpan.getBoundingClientRect();
      
      // Calculate offset from center of viewport
      const viewportCenterX = window.innerWidth / 2;
      const viewportCenterY = window.innerHeight / 2;
      const iCenterX = iRect.left + iRect.width / 2;
      const targetX = iCenterX - viewportCenterX;
      
      // Calculate vertical position - flame should be above the text
      const textTop = tempRect.top;
      const targetY = textTop - viewportCenterY - 65; // 65px above text
      
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
        textTop
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