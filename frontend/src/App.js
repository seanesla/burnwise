import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Map from './components/Map';
import Schedule from './components/Schedule';
import AlertsPanel from './components/AlertsPanel';
import Navigation from './components/Navigation';
import FramerTorchAnimation from './components/FramerTorchAnimation';
import './styles/App.css';

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '🔥 BURNWISE:';

function App() {
  const [showAnimation, setShowAnimation] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);
  
  const handleAnimationComplete = () => {
    setShowAnimation(false);
    setAnimationComplete(true);
    console.log(LOG_PREFIX, 'Torch animation complete');
  };
  
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
        
        {/* Startup Animation using Framer Motion */}
        {showAnimation && (
          <FramerTorchAnimation onComplete={handleAnimationComplete} />
        )}
        
        {/* Main App - Always visible, animation overlays on top */}
        <div className="app-main">
          <Navigation />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<Landing fromStartup={animationComplete} hideLogoInitially={showAnimation} animationPhase={showAnimation ? 'animating' : 'done'} />} />
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