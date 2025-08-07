import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import FramerTorchAnimation from './components/FramerTorchAnimation';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Map = lazy(() => import('./components/Map'));
const Schedule = lazy(() => import('./components/Schedule'));
const AlertsPanel = lazy(() => import('./components/AlertsPanel'));
const ImprovedBurnRequestForm = lazy(() => import('./components/ImprovedBurnRequestForm'));
const Analytics = lazy(() => import('./components/Analytics'));
const Settings = lazy(() => import('./components/Settings'));

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '🔥 BURNWISE:';

function App() {
  const [showAnimation, setShowAnimation] = useState(true);
  const [animationComplete, setAnimationComplete] = useState(false);
  const renderCountRef = useRef(0);
  const mountTimeRef = useRef(Date.now());
  
  useEffect(() => {
    renderCountRef.current++;
  });
  
  const handleAnimationComplete = () => {
    setShowAnimation(false);
    setAnimationComplete(true);
    console.log(LOG_PREFIX, 'Torch animation complete');
    // Re-enable scrolling and reset body position
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.top = '';
  };
  
  // Lock scrolling during startup animation
  useEffect(() => {
    if (showAnimation) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = '0';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [showAnimation]);
  
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
              Animation Complete: {animationComplete ? 'YES' : 'NO'}
            </div>
          </div>
        )}
        
        {/* Startup Animation using Framer Motion */}
        {showAnimation && (
          <FramerTorchAnimation onComplete={handleAnimationComplete} />
        )}
        
        {/* Main App - Always visible, animation overlays on top */}
        <div className="app-main" style={{
          opacity: 1,
          position: 'relative',
          zIndex: 1
        }}>
          <Navigation />
          <div className="app-content">
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="large" /></div>}>
                <Routes>
                  <Route path="/" element={<Landing fromStartup={animationComplete} hideLogoInitially={showAnimation} animationPhase={showAnimation ? 'animating' : 'done'} />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/map" element={<Map />} />
                  <Route path="/schedule" element={<Schedule />} />
                  <Route path="/alerts" element={<AlertsPanel />} />
                  <Route path="/request" element={<ImprovedBurnRequestForm />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/settings" element={<Settings />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;