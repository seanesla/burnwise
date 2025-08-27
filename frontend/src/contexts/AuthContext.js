/**
 * Demo-Only Session Context
 * Auto-creates demo sessions - NO real accounts
 * All users are demo users with temporary data
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// API configuration
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Storage keys for non-sensitive data only
const STORAGE_KEYS = {
  USER: 'burnwise_user_data', // User profile (non-sensitive)
  ONBOARDING_COMPLETE: 'burnwise_onboarding_complete',
  ONBOARDING_DATA: 'burnwise_onboarding_data'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [onboardingData, setOnboardingData] = useState(null);

  // Check for existing session on mount (but don't create new one)
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        // Check for existing demo session
        const existingDemoId = sessionStorage.getItem('demo_session_id');
        const existingDemoData = sessionStorage.getItem('demo_session_data');
        
        if (existingDemoId && existingDemoData) {
          // Restore existing demo session
          const demoData = JSON.parse(existingDemoData);
          setUser(demoData);
          setIsAuthenticated(true);
          
          // Check onboarding status
          const onboardingKey = `demo_onboarding_${existingDemoId}`;
          const hasOnboarded = localStorage.getItem(onboardingKey) === 'true';
          setOnboardingComplete(hasOnboarded);
          
          if (hasOnboarded) {
            const onboardingDataKey = `demo_onboarding_data_${existingDemoId}`;
            const savedData = localStorage.getItem(onboardingDataKey);
            if (savedData) {
              setOnboardingData(JSON.parse(savedData));
            }
          }
        }
        // Don't create new session automatically - let Landing page do it
      } catch (err) {
        console.error('Failed to check existing session:', err);
      } finally {
        setLoading(false);
      }
    };

    checkExistingSession();
  }, []);

  // Create demo session (called from Landing page)
  const createDemoSession = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/api/demo/session`, {}, {
        withCredentials: true
      });
      
      if (response.data.success) {
        const demoUser = {
          id: response.data.sessionId,
          farmId: response.data.farmId,
          email: 'demo@burnwise.local',
          name: 'Demo User',
          isDemo: true,
          expiresAt: response.data.expiresAt
        };
        
        // Store demo session
        sessionStorage.setItem('demo_session_id', response.data.sessionId);
        sessionStorage.setItem('demo_session_data', JSON.stringify(demoUser));
        
        setUser(demoUser);
        setIsAuthenticated(true);
        setOnboardingComplete(false); // New demos need onboarding
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to create demo session:', err);
      setError('Failed to start demo session. Please refresh the page.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Reset demo session
  const resetDemoSession = async () => {
    // Clear current session
    sessionStorage.removeItem('demo_session_id');
    sessionStorage.removeItem('demo_session_data');
    
    // Clear onboarding data
    const currentDemoId = user?.id;
    if (currentDemoId) {
      localStorage.removeItem(`demo_onboarding_${currentDemoId}`);
      localStorage.removeItem(`demo_onboarding_data_${currentDemoId}`);
    }
    
    // Reload page to get new demo session
    window.location.href = '/';
  };

  // Complete onboarding
  const completeOnboarding = (data) => {
    if (!user) return;
    
    const demoId = user.id;
    const onboardingKey = `demo_onboarding_${demoId}`;
    const onboardingDataKey = `demo_onboarding_data_${demoId}`;
    
    localStorage.setItem(onboardingKey, 'true');
    localStorage.setItem(onboardingDataKey, JSON.stringify(data));
    
    setOnboardingComplete(true);
    setOnboardingData(data);
  };

  // Reset onboarding
  const resetOnboarding = () => {
    if (!user) return;
    
    const demoId = user.id;
    const onboardingKey = `demo_onboarding_${demoId}`;
    const onboardingDataKey = `demo_onboarding_data_${demoId}`;
    
    localStorage.removeItem(onboardingKey);
    localStorage.removeItem(onboardingDataKey);
    
    setOnboardingComplete(false);
    setOnboardingData(null);
  };

  // Update user profile
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    sessionStorage.setItem('demo_session_data', JSON.stringify(updatedUser));
  };

  // Clear error
  const clearError = () => setError(null);

  // Logout function for demo sessions - clears session and returns to landing
  const logout = async () => {
    // Clear session storage
    sessionStorage.removeItem('demo_session_id');
    sessionStorage.removeItem('demo_session_data');
    
    // Clear onboarding data
    const currentDemoId = user?.id;
    if (currentDemoId) {
      localStorage.removeItem(`demo_onboarding_${currentDemoId}`);
      localStorage.removeItem(`demo_onboarding_data_${currentDemoId}`);
    }
    
    // Clear state
    setUser(null);
    setIsAuthenticated(false);
    setOnboardingComplete(false);
    setOnboardingData(null);
    
    return true; // Indicate successful logout
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    clearError,
    onboardingComplete,
    needsOnboarding: isAuthenticated && !onboardingComplete,
    onboardingData,
    completeOnboarding,
    resetOnboarding,
    updateUser,
    createDemoSession,
    resetDemoSession,
    logout, // Add logout function
    isDemo: true // Always demo mode
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;