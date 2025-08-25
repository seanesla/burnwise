import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MapProvider } from './contexts/MapContext';
import { TutorialProvider } from './contexts/TutorialContext';
import settingsManager from './utils/settingsManager';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const Login = lazy(() => import('./components/Login'));
const HybridOnboarding = lazy(() => import('./components/HybridOnboarding'));
const SpatialInterface = lazy(() => import('./components/SpatialInterface'));
const Settings = lazy(() => import('./components/Settings'));

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '[BURNWISE]:';

function AppContent() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [activePanel, setActivePanel] = useState('spatial');
  
  useEffect(() => {
    // Apply saved settings on app load
    settingsManager.applySettings();
    
    // Mark as not initial load after animation completes
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 6000); // After animation completes
    
    return () => clearTimeout(timer);
  }, []);
  
  const handlePanelChange = (panelId) => {
    setActivePanel(panelId);
    // You can add more logic here to show different panels in the spatial interface
  };
  
  // Check if we're on auth pages
  const isAuthPage = ['/', '/login', '/signup', '/onboarding'].includes(location.pathname);
  const isDemoSpatialPage = location.pathname === '/demo/spatial';
  // Show sidebar only when authenticated AND not on auth pages
  // OR when on demo spatial page (since demo spatial needs sidebar immediately)
  const shouldShowSidebar = (isAuthenticated && !isAuthPage) || isDemoSpatialPage;
  
  return (
    <div className={`App ${isAuthPage ? 'auth-page' : ''}`}>
      {/* Navigation removed - no longer needed */}
      
      {/* Sidebar for authenticated users (excluding auth and demo init pages) */}
      {shouldShowSidebar && <Sidebar onPanelChange={handlePanelChange} />}
      
      <div className={`app-content ${shouldShowSidebar ? 'with-sidebar' : ''}`}>
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><LoadingSpinner size="large" /></div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing isInitialLoad={location.pathname === '/' && isInitialLoad} />} />
              <Route path="/login" element={<Login />} />
              
              {/* Onboarding Route - Public Access for New Users and Demo Mode */}
              <Route path="/onboarding" element={<HybridOnboarding />} />
              
              {/* Demo Spatial Route - After onboarding */}
              <Route path="/demo/spatial" element={<SpatialInterface />} />
              
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
    <Router future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}>
      <AuthProvider>
        <MapProvider>
          <TutorialProvider>
            <AppContent />
          </TutorialProvider>
        </MapProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;