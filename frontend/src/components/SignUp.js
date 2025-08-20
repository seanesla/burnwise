/**
 * SignUp Component
 * Farm registration with complete form validation
 * NO MOCKS - REAL REGISTRATION
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash,
  FaPhone, FaBuilding
} from 'react-icons/fa';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import './Auth.css';

const SignUp = () => {
  const navigate = useNavigate();
  const { signup, isAuthenticated, loading: authLoading, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    farm_name: '',
    owner_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Validate email format
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate phone format
  const validatePhone = (phone) => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return !phone || phoneRegex.test(phone);
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    
    // Farm name validation
    if (!formData.farm_name) {
      newErrors.farm_name = 'Farm name is required';
    } else if (formData.farm_name.length < 3) {
      newErrors.farm_name = 'Farm name must be at least 3 characters';
    }
    
    // Owner name validation
    if (!formData.owner_name) {
      newErrors.owner_name = 'Owner name is required';
    } else if (formData.owner_name.length < 2) {
      newErrors.owner_name = 'Please enter a valid name';
    }
    
    // Email validation
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    // Phone validation (optional)
    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    
    let processedValue = value;
    
    // Handle number inputs
    if (type === 'number') {
      processedValue = value === '' ? '' : parseFloat(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Clear signup error
    if (signupError) {
      setSignupError('');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setSignupError('');
    setSuccessMessage('');
    
    try {
      // Prepare data for API (exclude confirmPassword)
      const { confirmPassword, ...registrationData } = formData;
      
      const result = await signup(registrationData);
      
      if (result.success) {
        setSuccessMessage('Registration successful! Redirecting to onboarding...');
        
        // Redirect to onboarding after brief delay
        setTimeout(() => {
          navigate('/onboarding');
        }, 1500);
      } else {
        setSignupError(result.error || 'Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setSignupError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
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
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="auth-card"
        style={{ maxWidth: '550px' }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <AnimatedFlameLogo size={80} animated={true} />
          <h1 className="auth-logo-text">BURNWISE</h1>
        </div>
        
        {/* Title */}
        <h2 className="auth-title">Create Your Account</h2>
        <p className="auth-subtitle">Register your farm to start coordinating burns</p>
        
        {/* Messages */}
        {signupError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-error-message"
          >
            {signupError}
          </motion.div>
        )}
        
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="auth-success-message"
          >
            {successMessage}
          </motion.div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form-grid">
            {/* Farm Name */}
            <div className="auth-field">
              <label className="auth-label">Farm Name</label>
              <div className="auth-input-wrapper">
                <FaBuilding className="auth-input-icon" />
                <input
                  type="text"
                  name="farm_name"
                  value={formData.farm_name}
                  onChange={handleChange}
                  placeholder="Sunny Acres Farm"
                  className={`auth-input ${errors.farm_name ? 'error' : ''}`}
                  disabled={loading}
                />
              </div>
              {errors.farm_name && (
                <span className="auth-field-error">{errors.farm_name}</span>
              )}
            </div>
            
            {/* Owner Name */}
            <div className="auth-field">
              <label className="auth-label">Owner Name</label>
              <div className="auth-input-wrapper">
                <FaUser className="auth-input-icon" />
                <input
                  type="text"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={`auth-input ${errors.owner_name ? 'error' : ''}`}
                  disabled={loading}
                />
              </div>
              {errors.owner_name && (
                <span className="auth-field-error">{errors.owner_name}</span>
              )}
            </div>
            
            {/* Email */}
            <div className="auth-field auth-field-full">
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
            
            {/* Password */}
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <div className="auth-input-wrapper">
                <FaLock className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className={`auth-input ${errors.password ? 'error' : ''}`}
                  autoComplete="new-password"
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
            
            {/* Confirm Password */}
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <div className="auth-input-wrapper">
                <FaLock className="auth-input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className={`auth-input ${errors.confirmPassword ? 'error' : ''}`}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="auth-password-toggle"
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="auth-field-error">{errors.confirmPassword}</span>
              )}
            </div>
            
            {/* Phone (Optional) */}
            <div className="auth-field">
              <label className="auth-label">Phone (Optional)</label>
              <div className="auth-input-wrapper">
                <FaPhone className="auth-input-icon" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(555) 123-4567"
                  className={`auth-input ${errors.phone ? 'error' : ''}`}
                  disabled={loading}
                />
              </div>
              {errors.phone && (
                <span className="auth-field-error">{errors.phone}</span>
              )}
            </div>
            
            
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
                <span>Creating Account...</span>
              </>
            ) : (
              'Create Account'
            )}
          </motion.button>
        </form>
        
        {/* Footer Links */}
        <div className="auth-footer">
          <p className="auth-footer-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;