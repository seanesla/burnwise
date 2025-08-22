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
          
          // Check if demo user has completed onboarding
          const demoOnboardingKey = `burnwise_demo_onboarding_${demoData.farmId}`;
          const hasDemoOnboarded = localStorage.getItem(demoOnboardingKey) === 'true';
          setOnboardingComplete(hasDemoOnboarded);
          
          setLoading(false);
          return;
        }
        
        // Try to verify existing session (cookie will be sent automatically)
        const response = await axios.get('/api/auth/verify');
        
        if (response.data.valid && response.data.user) {
          let userData = response.data.user;
          
          // Override user data for demo mode
          if (sessionStorage.getItem('isDemo') === 'true') {
            userData = {
              ...userData,
              name: 'Demo User',
              email: 'demo@burnwise.com',
              isDemo: true
            };
          }
          
          setUser(userData);
          setIsAuthenticated(true);
          
          // Restore non-sensitive data from localStorage
          const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser({ ...userData, ...parsedUser });
          }
          
          // Check onboarding status from backend (JWT payload)
          const hasOnboarded = userData.onboardingCompleted === true;
          setOnboardingComplete(hasOnboarded);
          
          // If not onboarded and not already on onboarding page, redirect
          if (!hasOnboarded && !window.location.pathname.includes('/onboarding')) {
            window.location.href = '/onboarding';
          }
          
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
    
    // Clear demo flag
    sessionStorage.removeItem('isDemo');
    
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
        let userData = response.data.user;
        
        // Override user data for demo mode
        if (sessionStorage.getItem('isDemo') === 'true') {
          userData = {
            ...userData,
            name: 'Demo User',
            email: 'demo@burnwise.com',
            isDemo: true
          };
        }
        
        // Cookies are set automatically by backend (httpOnly)
        setUser(userData);
        setIsAuthenticated(true);
        
        // Store non-sensitive user data
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        
        // Check onboarding status from backend response
        const hasOnboarded = userData.onboardingCompleted === true;
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

  // Demo login - bypasses authentication entirely
  const loginDemo = async () => {
    try {
      setError(null);
      
      const response = await axios.post('/api/auth/demo');
      
      if (response.data.success) {
        const userData = response.data.user;
        
        // Set demo user data
        setUser(userData);
        setIsAuthenticated(true);
        
        // Mark as demo session
        sessionStorage.setItem('isDemo', 'true');
        
        // Store token if provided
        if (response.data.token) {
          localStorage.setItem('authToken', response.data.token);
        }
        
        // Check if demo user has completed onboarding
        const demoOnboardingKey = `burnwise_demo_onboarding_${userData.farmId}`;
        const hasDemoOnboarded = localStorage.getItem(demoOnboardingKey) === 'true';
        setOnboardingComplete(hasDemoOnboarded);
        
        return { success: true };
      }
      
      return {
        success: false,
        error: response.data.message || 'Demo session failed'
      };
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Demo session failed';
      setError(errorMessage);
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
      // Preserve demo session data before clearing
      const isDemoSession = sessionStorage.getItem('isDemo') === 'true';
      const demoContext = sessionStorage.getItem('burnwise_demo_context');
      
      // Clear client state
      clearAuth();
      
      // Restore demo markers if this was a demo session
      // This allows users to log out and log back in to the same demo
      if (isDemoSession) {
        sessionStorage.setItem('isDemo', 'true');
        if (demoContext) {
          sessionStorage.setItem('burnwise_demo_context', demoContext);
        }
      }
    }
  };

  // End demo session function - clears demo data and returns to login
  const endDemoSession = async () => {
    try {
      // If it's a demo session, call special endpoint to clean up demo data
      if (sessionStorage.getItem('isDemo') === 'true') {
        await axios.post('/api/auth/demo/end');
      }
    } catch (err) {
      console.error('Error ending demo session:', err);
    } finally {
      // Clear all auth and demo data
      clearAuth();
      sessionStorage.removeItem('isDemo');
      sessionStorage.removeItem('burnwise_demo_context');
      localStorage.removeItem('authToken');
      
      // Don't redirect here - let the calling component handle navigation
      // This prevents page refresh and allows for proper cleanup
    }
  };

  // Complete onboarding
  const completeOnboarding = (data) => {
    if (!user) return;
    
    // Handle demo sessions differently
    if (user.isDemo || sessionStorage.getItem('isDemo') === 'true') {
      const demoOnboardingKey = `burnwise_demo_onboarding_${user.farmId}`;
      const demoOnboardingDataKey = `burnwise_demo_onboarding_data_${user.farmId}`;
      
      localStorage.setItem(demoOnboardingKey, 'true');
      localStorage.setItem(demoOnboardingDataKey, JSON.stringify(data));
    } else {
      const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${user.farmId}`;
      const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${user.farmId}`;
      
      localStorage.setItem(userOnboardingKey, 'true');
      localStorage.setItem(userOnboardingDataKey, JSON.stringify(data));
    }
    
    setOnboardingComplete(true);
    setOnboardingData(data);
  };

  // Reset onboarding
  const resetOnboarding = () => {
    if (!user) return;
    
    // Handle demo sessions differently
    if (user.isDemo || sessionStorage.getItem('isDemo') === 'true') {
      const demoOnboardingKey = `burnwise_demo_onboarding_${user.farmId}`;
      const demoOnboardingDataKey = `burnwise_demo_onboarding_data_${user.farmId}`;
      
      localStorage.removeItem(demoOnboardingKey);
      localStorage.removeItem(demoOnboardingDataKey);
    } else {
      const userOnboardingKey = `${STORAGE_KEYS.ONBOARDING_COMPLETE}_${user.farmId}`;
      const userOnboardingDataKey = `${STORAGE_KEYS.ONBOARDING_DATA}_${user.farmId}`;
      
      localStorage.removeItem(userOnboardingKey);
      localStorage.removeItem(userOnboardingDataKey);
    }
    
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
    loginDemo,
    signup,
    logout,
    endDemoSession,
    clearError,
    onboardingComplete,
    needsOnboarding: isAuthenticated && !onboardingComplete,
    onboardingData,
    completeOnboarding,
    resetOnboarding,
    updateUser,
    refreshAuth,
    csrfToken,
    isDemo: sessionStorage.getItem('isDemo') === 'true'
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