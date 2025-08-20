/**
 * ProtectedRoute Component
 * Wraps components that require authentication
 * Redirects to login if not authenticated
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = ({ children, requireOnboarding = false }) => {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #000000 0%, #1a0f0f 50%, #2a1111 100%)'
      }}>
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    // Save the attempted location for redirect after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but needs onboarding
  if (needsOnboarding && !requireOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // Authenticated and trying to access onboarding when already completed
  if (!needsOnboarding && requireOnboarding) {
    return <Navigate to="/spatial" replace />;
  }

  // All checks passed - render the protected component
  return children;
};

export default ProtectedRoute;