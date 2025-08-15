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
const SimpleDashboard = lazy(() => import('./components/SimpleDashboard'));
const Map = lazy(() => import('./components/Map'));
const Schedule = lazy(() => import('./components/Schedule'));
const AlertsPanel = lazy(() => import('./components/AlertsPanel'));
const ImprovedBurnRequestForm = lazy(() => import('./components/ImprovedBurnRequestForm'));
const Analytics = lazy(() => import('./components/Analytics'));
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
  
  return (
    <div className="App">
      <Navigation />
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
              
              {/* Protected Routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <SimpleDashboard />
                </ProtectedRoute>
              } />
              <Route path="/map" element={
                <ProtectedRoute>
                  <Map />
                </ProtectedRoute>
              } />
              <Route path="/schedule" element={
                <ProtectedRoute>
                  <Schedule />
                </ProtectedRoute>
              } />
              <Route path="/alerts" element={
                <ProtectedRoute>
                  <AlertsPanel />
                </ProtectedRoute>
              } />
              <Route path="/request" element={
                <ProtectedRoute>
                  <ImprovedBurnRequestForm />
                </ProtectedRoute>
              } />
              <Route path="/analytics" element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              } />
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