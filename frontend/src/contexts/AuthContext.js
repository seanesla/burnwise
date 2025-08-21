/**
 * Authentication Context
 * Secure cookie-based authentication - NO localStorage (XSS vulnerable)
 * 100% REAL IMPLEMENTATION - NO MOCKS
 */

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure axios defaults for cookie-based auth
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';
axios.defaults.baseURL = API_BASE;
axios.defaults.withCredentials = true; // CRITICAL: Send cookies with every request

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
  const [csrfToken, setCsrfToken] = useState(null);

  // Fetch CSRF token on mount
  useEffect(() => {
    const fetchCSRFToken = async () => {
      try {
        const response = await axios.get('/api/auth/csrf-token');
        setCsrfToken(response.data.csrfToken);
        
        // Set CSRF token as default header
        axios.defaults.headers.common['X-CSRF-Token'] = response.data.csrfToken;
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err);
      }
    };
    
    fetchCSRFToken();
  }, []);

  // Initialize auth state (verify cookie-based session or demo mode)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for demo mode first
        const demoContext = sessionStorage.getItem('burnwise_demo_context');
        if (demoContext && window.location.pathname.startsWith('/demo')) {
          const demoData = JSON.parse(demoContext);
          
          // Set demo user data
          const demoUser = {
            id: `demo_${demoData.farmId}`,
            email: 'demo@burnwise.local',
            name: 'Demo User',
            farmId: demoData.farmId,
            isDemo: true,
            demoMode: demoData.mode,
            expiresAt: demoData.expiresAt
          };
          
          setUser(demoUser);
          setIsAuthenticated(true);
          setOnboardingComplete(true); // Skip onboarding for demo
          setLoading(false);
          return;
        }
        
        // Try to verify existing session (cookie will be sent automatically)
        const response = await axios.get('/api/auth/verify');
        
        if (response.data.valid && response.data.user) {
          const userData = response.data.user;
          setUser(userData);
          setIsAuthenticated(true);
          
          // Restore non-sensitive data from localStorage
          const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser({ ...userData, ...parsedUser });
          }
          
          // Check onboarding status (per user)
          const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${userData.farmId}`;
          const hasOnboarded = localStorage.getItem(userOnboardingKey) === 'true';
          setOnboardingComplete(hasOnboarded);
          
          // Restore onboarding data
          const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${userData.farmId}`;
          const savedOnboardingData = localStorage.getItem(userOnboardingDataKey);
          if (savedOnboardingData) {
            setOnboardingData(JSON.parse(savedOnboardingData));
          }
        } else {
          clearAuth();
        }
      } catch (err) {
        // No valid session
        console.log('No active session');
        clearAuth();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Clear all auth data
  const clearAuth = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setOnboardingComplete(false);
    setOnboardingData(null);
    
    // Clear non-sensitive localStorage (keep CSRF token)
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }, []);

  // Login function
  const login = async (email, password) => {
    try {
      setError(null);
      
      const response = await axios.post('/api/auth/login', {
        email,
        password
      });
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Cookies are set automatically by backend (httpOnly)
        setUser(userData);
        setIsAuthenticated(true);
        
        // Store non-sensitive user data
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        
        // Check onboarding status for this user
        const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${userData.farmId}`;
        const hasOnboarded = localStorage.getItem(userOnboardingKey) === 'true';
        setOnboardingComplete(hasOnboarded);
        
        // Load saved onboarding data if exists
        if (hasOnboarded) {
          const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${userData.farmId}`;
          const savedOnboardingData = localStorage.getItem(userOnboardingDataKey);
          if (savedOnboardingData) {
            setOnboardingData(JSON.parse(savedOnboardingData));
          }
        }
        
        return {
          success: true,
          needsOnboarding: !hasOnboarded
        };
      }
      
      return {
        success: false,
        error: response.data.message || 'Login failed'
      };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      
      // Handle rate limiting
      if (err.response?.status === 429) {
        return {
          success: false,
          error: 'Too many login attempts. Please try again later.',
          rateLimited: true
        };
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Signup function
  const signup = async (formData) => {
    try {
      setError(null);
      
      const response = await axios.post('/api/auth/register', formData);
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Cookies are set automatically by backend
        setUser(userData);
        setIsAuthenticated(true);
        
        // Store non-sensitive user data
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        
        // New users need onboarding
        setOnboardingComplete(false);
        
        return {
          success: true,
          needsOnboarding: true
        };
      }
      
      return {
        success: false,
        error: response.data.message || 'Registration failed'
      };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Registration failed';
      setError(errorMessage);
      
      // Handle rate limiting
      if (err.response?.status === 429) {
        return {
          success: false,
          error: 'Too many registration attempts. Please try again later.',
          rateLimited: true
        };
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear client state regardless
      clearAuth();
    }
  };

  // Complete onboarding
  const completeOnboarding = (data) => {
    if (!user) return;
    
    const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${user.farmId}`;
    const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${user.farmId}`;
    
    localStorage.setItem(userOnboardingKey, 'true');
    localStorage.setItem(userOnboardingDataKey, JSON.stringify(data));
    
    setOnboardingComplete(true);
    setOnboardingData(data);
  };

  // Reset onboarding
  const resetOnboarding = () => {
    if (!user) return;
    
    const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${user.farmId}`;
    const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${user.farmId}`;
    
    localStorage.removeItem(userOnboardingKey);
    localStorage.removeItem(userOnboardingDataKey);
    
    setOnboardingComplete(false);
    setOnboardingData(null);
  };

  // Update user profile
  const updateUser = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
  };

  // Refresh authentication (for token refresh)
  const refreshAuth = async () => {
    try {
      const response = await axios.post('/api/auth/refresh');
      
      if (response.data.success) {
        // Cookies are refreshed automatically
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Token refresh failed:', err);
      clearAuth();
      return false;
    }
  };

  // Clear error
  const clearError = () => setError(null);

  // Auto-refresh on 401 responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          const refreshed = await refreshAuth();
          if (refreshed) {
            return axios(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );
    
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const value = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    signup,
    logout,
    clearError,
    onboardingComplete,
    needsOnboarding: isAuthenticated && !onboardingComplete,
    onboardingData,
    completeOnboarding,
    resetOnboarding,
    updateUser,
    refreshAuth,
    csrfToken
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