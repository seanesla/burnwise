import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
// LoadingSpinner removed - no page loading animations
import ErrorBoundary from './components/ErrorBoundary';
// ProtectedRoute no longer needed - everything is demo
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MapProvider } from './contexts/MapContext';
import { TutorialProvider } from './contexts/TutorialContext';
import settingsManager from './utils/settingsManager';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const HybridOnboarding = lazy(() => import('./components/HybridOnboarding'));
const SpatialInterface = lazy(() => import('./components/SpatialInterface'));
const Settings = lazy(() => import('./components/Settings'));

// Debug system (disabled for production)
const DEBUG = false;
const LOG_PREFIX = '[BURNWISE]:';

function AppContent() {
  const location = useLocation();
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
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
  
  // Check if we're on pages that should NOT show sidebar
  const isOnboardingPage = location.pathname === '/onboarding';
  const isLandingPage = location.pathname === '/' || location.pathname === '/landing';
  // Show sidebar when authenticated and NOT on landing or onboarding pages
  const shouldShowSidebar = isAuthenticated && !isOnboardingPage && !isLandingPage;
  
  return (
    <div className={`App ${isOnboardingPage ? 'auth-page' : ''}`}>
      {/* Navigation removed - no longer needed */}
      
      {/* Sidebar for authenticated users (excluding auth and demo init pages) */}
      {shouldShowSidebar && <Sidebar onPanelChange={handlePanelChange} />}
      
      <div className={`app-content ${shouldShowSidebar ? 'with-sidebar' : ''}`}>
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <Routes>
              {/* Root route ALWAYS shows Landing page - it handles auth state internally */}
              <Route path="/" element={<Landing />} />
              
              {/* Landing page (for direct access) */}
              <Route path="/landing" element={<Landing />} />
              
              {/* Onboarding Route */}
              <Route path="/onboarding" element={<HybridOnboarding />} />
              
              {/* Main Spatial Interface */}
              <Route path="/spatial" element={<SpatialInterface />} />
              
              {/* Redirect old routes to spatial interface */}
              <Route path="/dashboard" element={<Navigate to="/spatial" replace />} />
              <Route path="/map" element={<Navigate to="/spatial" replace />} />
              <Route path="/schedule" element={<Navigate to="/spatial" replace />} />
              <Route path="/alerts" element={<Navigate to="/spatial" replace />} />
              <Route path="/request" element={<Navigate to="/spatial" replace />} />
              <Route path="/agent-chat" element={<Navigate to="/spatial" replace />} />
              <Route path="/analytics" element={<Navigate to="/spatial" replace />} />
              
              {/* Settings still accessible */}
              <Route path="/settings" element={<Settings />} />
              
              {/* Catch all - redirect to root */}
              <Route path="*" element={<Navigate to="/" replace />} />
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