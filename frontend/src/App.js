import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import settingsManager from './utils/settingsManager';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const Login = lazy(() => import('./components/Login'));
const SignUp = lazy(() => import('./components/SignUp'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const SpatialInterface = lazy(() => import('./components/SpatialInterface'));
const Settings = lazy(() => import('./components/Settings'));

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '[BURNWISE]:';

function AppContent() {
  const location = useLocation();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  useEffect(() => {
    // Apply saved settings on app load
    settingsManager.applySettings();
    
    // Mark as not initial load after animation completes
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 6000); // After animation completes
    
    return () => clearTimeout(timer);
  }, []);
  
  // Check if we're on auth pages or main spatial interface
  const isAuthPage = ['/', '/login', '/signup', '/onboarding'].includes(location.pathname);
  
  return (
    <div className="App">
      {/* No traditional navigation for spatial interface */}
      {isAuthPage && <Navigation />}
      <div className="app-content">
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="large" /></div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing isInitialLoad={location.pathname === '/' && isInitialLoad} />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              
              {/* Onboarding Route - requires auth but special handling */}
              <Route path="/onboarding" element={
                <ProtectedRoute requireOnboarding={true}>
                  <Onboarding />
                </ProtectedRoute>
              } />
              
              {/* Main Spatial Interface - Replaces all dashboard/map/schedule routes */}
              <Route path="/spatial" element={
                <ProtectedRoute>
                  <SpatialInterface />
                </ProtectedRoute>
              } />
              
              {/* Redirect old routes to spatial interface */}
              <Route path="/dashboard" element={<Navigate to="/spatial" replace />} />
              <Route path="/map" element={<Navigate to="/spatial" replace />} />
              <Route path="/schedule" element={<Navigate to="/spatial" replace />} />
              <Route path="/alerts" element={<Navigate to="/spatial" replace />} />
              <Route path="/request" element={<Navigate to="/spatial" replace />} />
              <Route path="/agent-chat" element={<Navigate to="/spatial" replace />} />
              <Route path="/analytics" element={<Navigate to="/spatial" replace />} />
              
              {/* Settings still accessible separately */}
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
              
              {/* Catch all - redirect to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;