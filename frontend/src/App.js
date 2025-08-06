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

// BRUTE FORCE DEBUG SYSTEM
const DEBUG = true;
const LOG_PREFIX = '🔥🔥🔥 BURNWISE DEBUG:';

function App() {
  const [startupPhase, setStartupPhase] = useState('startup');
  const [debugLog, setDebugLog] = useState([]);
  const mountTimeRef = useRef(Date.now());
  const phaseTimersRef = useRef({});
  const renderCountRef = useRef(0);
  const animationFrameRef = useRef(null);
  const [logoTargetPosition, setLogoTargetPosition] = useState(null);
  
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
    console.log(LOG_PREFIX, `RENDER #${renderCountRef.current}`, { phase: startupPhase });
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
    
    // Track animation frames (REMOVED - causing issues)
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  // Track phase changes
  useEffect(() => {
    const now = Date.now();
    phaseTimersRef.current[startupPhase] = now;
    
    log(`PHASE CHANGE: ${startupPhase}`, {
      previousPhases: phaseTimersRef.current,
      timeSinceMount: now - mountTimeRef.current
    });
    
    // Check DOM state
    const startupScreen = document.querySelector('.startup-screen');
    const appMain = document.querySelector('.app-main');
    
    log('DOM STATE', {
      startupScreenExists: !!startupScreen,
      startupScreenDisplay: startupScreen?.style.display,
      startupScreenOpacity: startupScreen ? window.getComputedStyle(startupScreen).opacity : null,
      appMainExists: !!appMain,
      appMainOpacity: appMain ? window.getComputedStyle(appMain).opacity : null
    });
  }, [startupPhase]);
  
  useEffect(() => {
    log('STARTING ANIMATION SEQUENCE');
    
    // Get EXACT position where landing logo will be
    const calculateTargetPosition = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // The landing page centers its hero content
      // Logo appears about 200px from top of viewport based on screenshots
      const targetY = 200 - (viewportHeight / 2); // Logo final position from center
      
      return {
        x: 0,  // Stay centered horizontally
        y: targetY, // Move to exact landing position
        scale: 120 / 180  // Scale from 180px to 120px
      };
    };
    
    setLogoTargetPosition(calculateTargetPosition());
    
    // Phase 1: Show startup for 2.5 seconds
    const startupTimer = setTimeout(() => {
      log('PHASE 1 COMPLETE - Starting morph transition');
      setStartupPhase('morphing');
      
      // Phase 2: Morph for 1 second
      const morphTimer = setTimeout(() => {
        log('PHASE 2 COMPLETE - Starting fade');
        setStartupPhase('transitioning');
        
        // Phase 3: Fade out for 500ms
        const transitionTimer = setTimeout(() => {
          log('PHASE 3 COMPLETE - Animation done');
          setStartupPhase('done');
        }, 500);
        
        return () => clearTimeout(transitionTimer);
      }, 1000);
      
      return () => clearTimeout(morphTimer);
    }, 2500);
    
    return () => {
      log('Cleanup: Clearing startup timer');
      clearTimeout(startupTimer);
    };
  }, []);
  
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
            <div>Phase: {startupPhase} | Renders: {renderCountRef.current}</div>
            <div>Time: {Date.now() - mountTimeRef.current}ms</div>
            <div style={{ marginTop: '5px', fontSize: '10px' }}>
              Startup visible: {startupPhase !== 'done' ? 'YES' : 'NO'} | 
              Logo exists: {AnimatedFlameLogo ? 'YES' : 'NO'} |
              Morphing: {startupPhase === 'morphing' ? 'YES' : 'NO'}
            </div>
          </div>
        )}
        
        {/* Startup Animation with SEAMLESS MORPH */}
        {startupPhase !== 'done' && (
          <div 
            className="startup-screen"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'transparent', // Never show background on this div
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: startupPhase === 'transitioning' ? 'none' : 'auto'
            }}
            onTransitionEnd={() => log('TRANSITION END EVENT')}
          >
            {/* Black background that fades out smoothly */}
            <div className="startup-bg" style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: '#000',
              opacity: startupPhase === 'morphing' ? 1 : (startupPhase === 'transitioning' ? 0 : 1),
              transition: 'opacity 0.5s ease-out',
              zIndex: -2,
              pointerEvents: 'none'
            }}></div>
            
            {/* Logo container that morphs to landing position */}
            <div className="startup-logo-container" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2rem',
              position: 'fixed',
              zIndex: 10,
              // Morph animation - move to exact landing position and stay there
              transform: (startupPhase === 'morphing' || startupPhase === 'transitioning') ? 
                `translate(${logoTargetPosition?.x || 0}px, ${logoTargetPosition?.y || 0}px) scale(${logoTargetPosition?.scale || 1})` :
                'translate(0, 0) scale(1)',
              // Stay visible during morphing and transitioning
              opacity: 1,
              transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
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
        
        {/* Main App - Fade in during transition phase */}
        <div 
          className={`app-main ${startupPhase === 'done' ? 'app-main-visible' : ''}`}
          style={{
            opacity: (startupPhase === 'transitioning' || startupPhase === 'done') ? 1 : 0,
            transition: 'opacity 0.5s ease-out',
            pointerEvents: (startupPhase === 'transitioning' || startupPhase === 'done') ? 'auto' : 'none'
          }}
        >
          <Navigation />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<Landing fromStartup={startupPhase === 'transitioning' || startupPhase === 'done'} hideLogoInitially={startupPhase !== 'done'} />} />
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