/**
 * Login Component
 * Professional login interface with form validation
 * NO MOCKS - REAL AUTHENTICATION
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaFire, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaRocket, FaDatabase, FaRobot, FaArrowRight } from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
// DemoEntryCard removed - integrated into main auth card
import './Auth.css';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, needsOnboarding, loading: authLoading, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [demoModeEnabled, setDemoModeEnabled] = useState(false);
  const [demoStats, setDemoStats] = useState(null);
  const [demoStatusLoading, setDemoStatusLoading] = useState(true);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      if (needsOnboarding) {
        navigate('/onboarding');
      } else {
        navigate('/spatial');
      }
    }
  }, [isAuthenticated, needsOnboarding, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Check if demo mode is enabled with TiDB integration
  useEffect(() => {
    const checkDemoMode = async () => {
      setDemoStatusLoading(true);
      try {
        const response = await fetch('http://localhost:5001/api/auth/demo-status');
        const data = await response.json();
        
        console.log('[DEMO] Status check response:', data);
        
        setDemoModeEnabled(data.available || false);
        setDemoStats(data.statistics || null);
        
        if (data.available) {
          console.log('[DEMO] Demo mode available with TiDB integration');
        } else {
          console.log('[DEMO] Demo mode not available:', data.message);
        }
      } catch (error) {
        console.error('[DEMO] Failed to check demo mode:', error);
        setDemoModeEnabled(false);
        setDemoStats(null);
      } finally {
        setDemoStatusLoading(false);
      }
    };
    
    checkDemoMode();
  }, []);

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear login error
    if (loginError) {
      setLoginError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setLoginError('');
    
    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Navigation handled by useEffect
        if (result.needsOnboarding) {
          navigate('/onboarding');
        } else {
          navigate('/spatial');
        }
      } else {
        setLoginError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Demo credentials hint
  const fillDemoCredentials = () => {
    setFormData({
      email: 'robert@goldenfields.com',
      password: 'demo123'
    });
    setErrors({});
    setLoginError('');
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-background" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="auth-card"
      >
        {/* Logo */}
        <div className="auth-logo">
          <FaFire className="auth-logo-icon" />
          <h1 className="auth-logo-text">BURNWISE</h1>
        </div>
        
        {/* Title */}
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Sign in to manage your agricultural burns</p>
        
        {/* Error Message */}
        {loginError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-error-message"
          >
            {loginError}
          </motion.div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email Field */}
          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <div className="auth-input-wrapper">
              <FaEnvelope className="auth-input-icon" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className={`auth-input ${errors.email ? 'error' : ''}`}
                autoComplete="email"
                disabled={loading}
              />
            </div>
            {errors.email && (
              <span className="auth-field-error">{errors.email}</span>
            )}
          </div>
          
          {/* Password Field */}
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <div className="auth-input-wrapper">
              <FaLock className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`auth-input ${errors.password ? 'error' : ''}`}
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="auth-password-toggle"
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {errors.password && (
              <span className="auth-field-error">{errors.password}</span>
            )}
          </div>
          
          {/* Submit Button */}
          <motion.button
            type="submit"
            className="auth-submit-button"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </motion.button>
        </form>
        
        {/* Demo Credentials - Quick Demo Account Access */}
        {demoModeEnabled && !demoStatusLoading && (
          <div className="auth-demo-section">
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="auth-demo-button"
              disabled={loading}
            >
              Use Demo Account
            </button>
          </div>
        )}
        
        {/* Footer Links */}
        <div className="auth-footer">
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign Up
            </Link>
          </p>
        </div>
        
        {/* Integrated Demo Section */}
        {!demoStatusLoading && demoModeEnabled && (
          <div className="auth-integrated-demo">
            <div className="demo-divider">
              <span>or</span>
            </div>
            
            <div className="demo-compact-header">
              <h3>Try Demo Mode</h3>
              <p>Experience full features • No registration</p>
            </div>
            
            <div className="demo-features-row">
              <div className="demo-feature-compact">
                <FaRobot />
                <span>5 AI Agents</span>
              </div>
              <div className="demo-feature-compact">
                <FaDatabase />
                <span>Real TiDB</span>
              </div>
              <div className="demo-feature-compact">
                <FaRocket />
                <span>3D Interface</span>
              </div>
            </div>
            
            {demoStats && (
              <div className="demo-stats-row">
                <span className="demo-stat-compact">
                  <strong>{demoStats.active_sessions || 0}</strong> active sessions
                </span>
                <span className="demo-stat-compact">
                  <strong>{demoStats.demo_farms || 0}</strong> demo farms
                </span>
              </div>
            )}
            
            <motion.button
              className="auth-demo-primary-button"
              onClick={() => navigate('/demo/initialize')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FaRocket />
              <span>Start Demo Session</span>
              <FaArrowRight />
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Login;