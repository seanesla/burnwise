/**
 * HybridOnboarding - Smart form with optional AI assistance
 * Reduces AI dependency from 100% to optional enhancement
 * Form works completely without AI if needed
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, 
  FaTree, FaRobot, FaChevronRight, FaChevronLeft,
  FaMagic, FaCheck, FaTimes
} from 'react-icons/fa';
import axios from 'axios';
import EmberBackground from './backgrounds/EmberBackground';
import './HybridOnboarding.css';

const HybridOnboarding = () => {
  const navigate = useNavigate();
  const { completeOnboarding, user, isDemo } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    farmName: '',
    ownerName: '',
    email: '',
    phone: '',
    location: '',
    acreage: '',
    primaryCrops: '',
    burnFrequency: 'seasonal'
  });
  
  // UI state
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formComplete, setFormComplete] = useState(false);

  // Check form completion
  useEffect(() => {
    const required = ['farmName', 'ownerName', 'email', 'location', 'acreage'];
    const isComplete = required.every(field => formData[field]?.trim());
    setFormComplete(isComplete);
  }, [formData]);

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.farmName.trim()) {
      errors.farmName = 'Farm name is required';
    }
    
    if (!formData.ownerName.trim()) {
      errors.ownerName = 'Owner name is required';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }
    
    if (!formData.acreage.trim()) {
      errors.acreage = 'Acreage is required';
    } else if (isNaN(formData.acreage) || parseFloat(formData.acreage) <= 0) {
      errors.acreage = 'Acreage must be a positive number';
    }
    
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      errors.phone = 'Invalid phone format';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Fill with demo data
  const fillDemoData = () => {
    setFormData({
      farmName: 'Demo Farm',
      ownerName: 'Demo User',
      email: 'demo@burnwise.local',
      phone: '(555) 123-4567',
      location: 'Sacramento, CA',
      acreage: '500',
      primaryCrops: 'Wheat, Rice, Alfalfa',
      burnFrequency: 'seasonal'
    });
  };

  // Process AI input to extract form data
  const processAIInput = async () => {
    if (!aiInput.trim()) return;
    
    setIsProcessingAI(true);
    
    try {
      // Try to use AI to extract data
      const response = await axios.post('/api/onboarding/extract', {
        text: aiInput
      });
      
      if (response.data.success && response.data.extracted) {
        // Merge extracted data with existing form data
        setFormData(prev => ({
          ...prev,
          ...response.data.extracted
        }));
        
        // Clear AI input after successful extraction
        setAiInput('');
      }
    } catch (error) {
      console.log('AI extraction failed, user can fill manually');
      // Parse locally as fallback
      parseLocalFallback(aiInput);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Local parsing fallback when AI unavailable
  const parseLocalFallback = (text) => {
    const updates = {};
    
    // Simple pattern matching for common phrases
    const acreMatch = text.match(/(\d+)\s*(?:acres?|acre)/i);
    if (acreMatch) updates.acreage = acreMatch[1];
    
    const emailMatch = text.match(/([^\s@]+@[^\s@]+\.[^\s@]+)/);
    if (emailMatch) updates.email = emailMatch[1];
    
    const phoneMatch = text.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
    if (phoneMatch) updates.phone = phoneMatch[1];
    
    // Look for location patterns
    const locationPatterns = [
      /(?:in|at|near|located in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*[A-Z]{2})/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s*(?:CA|California|OR|Oregon|WA|Washington))/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        updates.location = match[1];
        break;
      }
    }
    
    // Look for farm name patterns
    const farmNameMatch = text.match(/(?:called|named|is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Farm)/i);
    if (farmNameMatch) updates.farmName = farmNameMatch[1];
    
    // Apply any extracted data
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  };

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Save onboarding data
      const onboardingData = {
        ...formData,
        completedAt: new Date().toISOString(),
        method: showAI ? 'hybrid_ai' : 'form_only'
      };
      
      // Mark onboarding complete
      completeOnboarding(onboardingData);
      
      // For demo users, just redirect
      if (isDemo || user?.isDemo) {
        setTimeout(() => {
          const isDemoRoute = window.location.pathname.startsWith('/demo');
          navigate(isDemoRoute ? '/demo/spatial' : '/spatial');
        }, 1000);
      } else {
        // For regular users, create account
        const response = await axios.post('/api/farms/create', formData);
        if (response.data.success) {
          navigate('/spatial');
        }
      }
    } catch (error) {
      console.error('Onboarding submission failed:', error);
      // Even if backend fails, allow progression for demo
      if (isDemo) {
        navigate('/demo/spatial');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hybrid-onboarding-container">
      <div className="hybrid-onboarding">
        {/* Header */}
        <div className="onboarding-header">
          <h1>Farm Setup</h1>
          <p>Complete your farm profile to get started with Burnwise</p>
        </div>

        <div className="onboarding-content">
          {/* Form Section */}
          <div className="form-section">
            <form onSubmit={handleSubmit}>
              {/* Farm Information */}
              <div className="form-group">
                <h3>Farm Information</h3>
                
                <div className="form-field">
                  <label htmlFor="farmName">
                    Farm Name <span className="required">*</span>
                  </label>
                  <input
                    id="farmName"
                    type="text"
                    value={formData.farmName}
                    onChange={(e) => handleFieldChange('farmName', e.target.value)}
                    placeholder="Green Valley Farm"
                    className={validationErrors.farmName ? 'error' : ''}
                  />
                  {validationErrors.farmName && (
                    <span className="error-message">{validationErrors.farmName}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="location">
                    Location <span className="required">*</span>
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleFieldChange('location', e.target.value)}
                    placeholder="Sacramento, CA"
                    className={validationErrors.location ? 'error' : ''}
                  />
                  {validationErrors.location && (
                    <span className="error-message">{validationErrors.location}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="acreage">
                    Total Acreage <span className="required">*</span>
                  </label>
                  <input
                    id="acreage"
                    type="text"
                    value={formData.acreage}
                    onChange={(e) => handleFieldChange('acreage', e.target.value)}
                    placeholder="500"
                    className={validationErrors.acreage ? 'error' : ''}
                  />
                  {validationErrors.acreage && (
                    <span className="error-message">{validationErrors.acreage}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="primaryCrops">
                    Primary Crops
                  </label>
                  <input
                    id="primaryCrops"
                    type="text"
                    value={formData.primaryCrops}
                    onChange={(e) => handleFieldChange('primaryCrops', e.target.value)}
                    placeholder="Wheat, Rice, Alfalfa"
                  />
                </div>
              </div>

              {/* Owner Information */}
              <div className="form-group">
                <h3>Owner Information</h3>
                
                <div className="form-field">
                  <label htmlFor="ownerName">
                    Owner Name <span className="required">*</span>
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => handleFieldChange('ownerName', e.target.value)}
                    placeholder="John Doe"
                    className={validationErrors.ownerName ? 'error' : ''}
                  />
                  {validationErrors.ownerName && (
                    <span className="error-message">{validationErrors.ownerName}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="email">
                    Email Address <span className="required">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="john@farm.com"
                    className={validationErrors.email ? 'error' : ''}
                  />
                  {validationErrors.email && (
                    <span className="error-message">{validationErrors.email}</span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="phone">
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                    className={validationErrors.phone ? 'error' : ''}
                  />
                  {validationErrors.phone && (
                    <span className="error-message">{validationErrors.phone}</span>
                  )}
                </div>
              </div>

              {/* Burn Preferences */}
              <div className="form-group">
                <h3>Burn Preferences</h3>
                
                <div className="form-field">
                  <label htmlFor="burnFrequency">
                    Typical Burn Frequency
                  </label>
                  <select
                    id="burnFrequency"
                    value={formData.burnFrequency}
                    onChange={(e) => handleFieldChange('burnFrequency', e.target.value)}
                  >
                    <option value="seasonal">Seasonal (2-4 times/year)</option>
                    <option value="annual">Annual (once/year)</option>
                    <option value="frequent">Frequent (5+ times/year)</option>
                    <option value="occasional">Occasional (as needed)</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="form-actions">
                {isDemo && (
                  <button
                    type="button"
                    onClick={fillDemoData}
                    className="btn-secondary"
                  >
                    <FaMagic />
                    Fill Demo Data
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={!formComplete || isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Creating Farm...' : 'Complete Setup'}
                  <FaChevronRight />
                </button>
              </div>
            </form>
          </div>

          {/* AI Assistant Section (Optional) */}
          <div className={`ai-section ${showAI ? 'active' : ''}`}>
            <button
              className="ai-toggle"
              onClick={() => setShowAI(!showAI)}
              title={showAI ? 'Hide AI Assistant' : 'Show AI Assistant'}
            >
              <FaRobot />
              {showAI ? <FaChevronRight /> : <FaChevronLeft />}
            </button>

            <AnimatePresence>
              {showAI && (
                <motion.div
                  className="ai-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '100%', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <h3>
                    <FaRobot />
                    AI Assistant
                  </h3>
                  <p className="ai-description">
                    Describe your farm in one sentence and I'll fill the form for you
                  </p>
                  
                  <div className="ai-input-group">
                    <textarea
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      placeholder="Example: My farm is Green Valley Farm, 500 acres near Sacramento, I'm John Doe and my email is john@farm.com"
                      rows={4}
                      disabled={isProcessingAI}
                    />
                    
                    <button
                      onClick={processAIInput}
                      disabled={!aiInput.trim() || isProcessingAI}
                      className="btn-ai"
                    >
                      {isProcessingAI ? 'Processing...' : 'Auto-Fill Form'}
                    </button>
                  </div>

                  <div className="ai-tips">
                    <h4>Quick Tips:</h4>
                    <ul>
                      <li>Include farm name, location, and acreage</li>
                      <li>Add your name and contact info</li>
                      <li>Mention primary crops if relevant</li>
                      <li>AI will extract and fill the form</li>
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Ember Background */}
      <EmberBackground intensity={1.0} blur={true} />
    </div>
  );
};

export default HybridOnboarding;