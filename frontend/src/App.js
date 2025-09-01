import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
// LoadingSpinner removed - no page loading animations
import ErrorBoundary from './components/ErrorBoundary';
// ProtectedRoute no longer needed - everything is demo
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MapProvider } from './contexts/MapContext';
import { TutorialProvider } from './contexts/TutorialContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import settingsManager from './utils/settingsManager';
import './styles/App.css';

// Lazy load route components
const Landing = lazy(() => import('./components/Landing'));
const HybridOnboarding = lazy(() => import('./components/HybridOnboarding'));
const SpatialInterface = lazy(() => import('./components/SpatialInterface'));
const Settings = lazy(() => import('./components/Settings'));

function AppContent() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { isExpanded } = useSidebar();
  
  useEffect(() => {
    // Apply saved settings on app load
    settingsManager.applySettings();
  }, []);
  
  // Check if we're on pages that should NOT show sidebar
  const isOnboardingPage = location.pathname === '/onboarding';
  const isLandingPage = location.pathname === '/' || location.pathname === '/landing';
  const isSpatialPage = location.pathname === '/spatial' || 
                        location.pathname === '/dashboard' || 
                        location.pathname === '/map' || 
                        location.pathname === '/schedule' || 
                        location.pathname === '/alerts' || 
                        location.pathname === '/request' || 
                        location.pathname === '/agent-chat' || 
                        location.pathname === '/analytics';
  
  // Show sidebar when authenticated and NOT on landing or onboarding pages
  const shouldShowSidebar = isAuthenticated && !isOnboardingPage && !isLandingPage;
  
  return (
    <div className={`App ${isOnboardingPage ? 'auth-page' : ''}`}>
      {/* Always show sidebar when appropriate, regardless of page */}
      {shouldShowSidebar && <Sidebar />}
      
      {/* Render SpatialInterface outside of app-content hierarchy for spatial pages */}
      {isSpatialPage && (
        <ErrorBoundary>
          <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <SpatialInterface />
          </Suspense>
        </ErrorBoundary>
      )}
      
      {/* Only show app-content wrapper for NON-spatial pages */}
      {!isSpatialPage && (
        <div className={`app-content ${shouldShowSidebar ? 'with-sidebar' : ''} ${shouldShowSidebar && !isExpanded ? 'sidebar-collapsed' : ''}`}>
            <ErrorBoundary>
              <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
                <AnimatePresence mode="wait">
                  <Routes location={location} key={location.pathname}>
                    {/* Root route ALWAYS shows Landing page - it handles auth state internally */}
                    <Route path="/" element={<Landing />} />
                    
                    {/* Landing page (for direct access) */}
                    <Route path="/landing" element={<Landing />} />
                    
                    {/* Onboarding Route */}
                    <Route path="/onboarding" element={<HybridOnboarding />} />
                    
                    {/* Redirect old routes to spatial interface */}
                    <Route path="/spatial" element={<Navigate to="/spatial" replace />} />
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
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </div>
      )}
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
            <SidebarProvider>
              <AppContent />
            </SidebarProvider>
          </TutorialProvider>
        </MapProvider>
      </AuthProvider>
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#ffffff',
            border: '1px solid rgba(255, 107, 53, 0.2)',
          },
          success: {
            style: {
              background: '#16a34a',
              color: '#ffffff',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#16a34a',
            },
          },
          error: {
            style: {
              background: '#dc2626',
              color: '#ffffff',
            },
            iconTheme: {
              primary: '#ffffff',
              secondary: '#dc2626',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;