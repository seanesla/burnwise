import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const CinematicDashboard = lazy(() => import('./components/CinematicDashboard'));
const Map = lazy(() => import('./components/Map'));
const Schedule = lazy(() => import('./components/Schedule'));
const AlertsPanel = lazy(() => import('./components/AlertsPanel'));
const ImprovedBurnRequestForm = lazy(() => import('./components/ImprovedBurnRequestForm'));
const Analytics = lazy(() => import('./components/Analytics'));
const Settings = lazy(() => import('./components/Settings'));

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '🔥 BURNWISE:';

function AppContent() {
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    // Mark as not initial load after animation completes
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 6000); // After animation completes
    
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="App">
      <Navigation />
      <div className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="large" /></div>}>
            <Routes>
              <Route path="/" element={<Landing isInitialLoad={location.pathname === '/' && isInitialLoad} />} />
              <Route path="/dashboard" element={<CinematicDashboard />} />
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
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;