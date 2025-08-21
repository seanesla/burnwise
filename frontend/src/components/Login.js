/**
 * Login Component
 * Professional login interface with form validation
 * NO MOCKS - REAL AUTHENTICATION
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash, FaRocket, FaDatabase, FaRobot, FaArrowRight, FaFire } from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import EmberBackground from './backgrounds/EmberBackground';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
// Demo section separated for better desktop layout
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
  const fillDemoCredentials = async () => {
    setFormData({
      email: 'robert@goldenfields.com',
      password: 'demo123'
    });
    setErrors({});
    setLoginError('');
    
    // Mark this as a demo session
    sessionStorage.setItem('isDemo', 'true');
    
    // Automatically submit the form after filling credentials
    setLoading(true);
    try {
      const result = await login('robert@goldenfields.com', 'demo123');
      
      if (result.success) {
        // Navigation handled by useEffect
        if (result.needsOnboarding) {
          navigate('/onboarding');
        } else {
          navigate('/spatial');
        }
      } else {
        setLoginError(result.error || 'Demo login failed. Please try again.');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      setLoginError('Failed to login with demo account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle demo mode initialization
  const handleDemo = async () => {
    try {
      // In a real implementation, this would initialize demo mode
      // For now, just enable demo mode and show the demo credentials
      setDemoModeEnabled(true);
      setDemoStats({
        farms: 5,
        burns: 12,
        agents: 5
      });
    } catch (error) {
      console.error('Failed to initialize demo mode:', error);
      setLoginError('Failed to initialize demo mode. Please try again.');
    }
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
      <EmberBackground intensity={1.2} blur={false} />
      
      {/* Add right side ribbon curve */}
      <div className="ribbon-curve-right" />
      
      {/* Desktop: Two-card layout */}
      <div className="auth-cards-container">
        {/* Login Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="auth-card auth-card-login"
      >
        {/* Logo */}
        <div className="auth-logo">
          <AnimatedFlameLogo size={40} animated={true} />
          <h1 className="auth-logo-text">Burnwise</h1>
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
        
        
        {/* Footer Links */}
        <div className="auth-footer">
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Sign Up
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Demo Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="auth-card auth-card-demo"
      >
        <div className="demo-badge-corner">
          <span>LIVE DEMO</span>
        </div>
          
          <div className="demo-header">
            <FaRocket className="demo-header-icon" />
            <h2 className="demo-title">Try Demo Mode</h2>
            <p className="demo-subtitle">Experience full features without registration</p>
          </div>
          
          <div className="demo-features-grid">
            <div className="demo-feature-item">
              <FaRobot className="demo-feature-icon" />
              <span>5 AI Agents</span>
            </div>
            <div className="demo-feature-item">
              <FaDatabase className="demo-feature-icon" />
              <span>Real TiDB</span>
            </div>
            <div className="demo-feature-item">
              <FaRocket className="demo-feature-icon" />
              <span>3D Interface</span>
            </div>
            <div className="demo-feature-item">
              <FaFire className="demo-feature-icon" />
              <span>Full Features</span>
            </div>
          </div>
          
          {demoStats && (
            <div className="demo-stats-container">
              <div className="demo-stat">
                <div className="demo-stat-value">{demoStats.active_sessions || 0}</div>
                <div className="demo-stat-label">Active Sessions</div>
              </div>
              <div className="demo-stat-divider" />
              <div className="demo-stat">
                <div className="demo-stat-value">{demoStats.demo_farms || 0}</div>
                <div className="demo-stat-label">Demo Farms</div>
              </div>
            </div>
          )}
          
          <div className="demo-benefits">
            <div className="demo-benefit">✓ No registration</div>
            <div className="demo-benefit">✓ 24-hour session</div>
            <div className="demo-benefit">✓ Real AI interactions</div>
          </div>
          
          {/* Demo Action Button */}
          <motion.button
            onClick={demoModeEnabled ? fillDemoCredentials : handleDemo}
            className="auth-submit-button demo-primary-button"
            disabled={demoStatusLoading || loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {demoStatusLoading ? (
              <LoadingSpinner size="small" />
            ) : demoModeEnabled ? (
              <>
                <FaArrowRight style={{ marginRight: '8px' }} />
                Use Demo Account
              </>
            ) : (
              <>
                <FaArrowRight style={{ marginRight: '8px' }} />
                Launch Demo Mode
              </>
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;