/**
 * HybridOnboarding - Smart form with optional AI assistance
 * Reduces AI dependency from 100% to optional enhancement
 * Form works completely without AI if needed
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, 
  FaTree, FaRobot, FaChevronRight, FaChevronLeft,
  FaMagic, FaCheck, FaTimes, FaMap, FaRocket
} from 'react-icons/fa';
import axios from 'axios';
import FarmBoundaryDrawer from './FarmBoundaryDrawer';
import EmberBackground from './backgrounds/EmberBackground';
import './HybridOnboarding.css';

const HybridOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { completeOnboarding, user } = useAuth();
  
  // Mode selection state - User chooses demo or real mode in the UI
  const [selectedMode, setSelectedMode] = useState(null);
  const [sessionId] = useState(`demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  
  // Form state - defaults will be set based on mode selection
  const [formData, setFormData] = useState({
    farmName: '',
    ownerName: '',
    email: '',
    phone: '',
    location: '',
    acreage: '',
    farmBoundary: null, // GeoJSON boundary
    primaryCrops: '',
    burnFrequency: 'seasonal'
  });
  
  // UI state
  const [showAI, setShowAI] = useState(false);
  const [showMap, setShowMap] = useState(true); // Always show map
  const [aiInput, setAiInput] = useState('');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formComplete, setFormComplete] = useState(false);

  // Update form when mode is selected
  useEffect(() => {
    if (selectedMode === 'demo') {
      setFormData(prev => ({
        ...prev,
        ownerName: 'Demo User',
        email: `demo_${sessionId}@burnwise.demo`
      }));
    } else if (selectedMode === 'real') {
      setFormData(prev => ({
        ...prev,
        ownerName: '',
        email: ''
      }));
    }
  }, [selectedMode, sessionId]);

  // Check form completion - different requirements for demo vs real users
  useEffect(() => {
    let isComplete = false;
    
    // Must select a mode first
    if (!selectedMode) {
      isComplete = false;
    } else if (selectedMode === 'demo') {
      // Demo users only need farm name and boundary
      const hasLocation = formData.farmBoundary !== null;
      isComplete = formData.farmName?.trim() && hasLocation;
    } else {
      // Real users need all required fields
      const required = ['farmName', 'ownerName', 'email'];
      const hasLocation = formData.farmBoundary !== null;
      isComplete = required.every(field => formData[field]?.trim()) && hasLocation;
    }
    
    setFormComplete(isComplete);
  }, [formData, selectedMode]);

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

  // Handle boundary completion from map
  const handleBoundaryComplete = (boundaryData) => {
    if (boundaryData) {
      setFormData(prev => ({
        ...prev,
        farmBoundary: boundaryData,
        acreage: boundaryData.properties?.totalAcres?.toFixed(2) || '',
        // Extract rough location from boundary center
        location: prev.location || 'Map-defined boundary'
      }));
      
      // Clear location/acreage validation errors
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next.location;
        delete next.acreage;
        return next;
      });
    }
  };

  // Validate form - different validation for demo vs real users
  const validateForm = () => {
    const errors = {};
    
    if (!selectedMode) {
      errors.mode = 'Please select Demo or Real mode';
    }
    
    if (!formData.farmName.trim()) {
      errors.farmName = 'Farm name is required';
    }
    
    // Only require owner and email for real users
    if (selectedMode === 'real') {
      if (!formData.ownerName.trim()) {
        errors.ownerName = 'Owner name is required';
      }
      
      if (!formData.email.trim()) {
        errors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        errors.email = 'Invalid email format';
      }
    }
    
    // Boundary drawing is required for all users
    if (!formData.farmBoundary) {
      errors.location = 'Please draw the farm boundary on the map';
    }
    
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      errors.phone = 'Invalid phone format';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Mode selection handler
  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    setValidationErrors({}); // Clear any errors when mode changes
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
      // Initialize demo session if demo mode
      if (selectedMode === 'demo') {
        const demoResponse = await axios.post('http://localhost:5001/api/demo/initialize', {
          mode: 'blank',
          sessionId: sessionId
        }, {
          headers: { 'X-Demo-Mode': 'true' },
          withCredentials: true
        });

        if (demoResponse.data.success) {
          // Store demo session info
          sessionStorage.setItem('burnwise_demo_context', JSON.stringify({
            sessionId: demoResponse.data.sessionId,
            farmId: demoResponse.data.farmId,
            mode: 'blank',
            expiresAt: demoResponse.data.expiresAt,
            startedAt: new Date().toISOString()
          }));

          // Save onboarding data
          const onboardingData = {
            ...formData,
            isDemo: true,
            completedAt: new Date().toISOString(),
            method: showAI ? 'hybrid_ai' : 'form_only'
          };
          
          completeOnboarding(onboardingData);
          
          // Navigate to demo spatial interface
          setTimeout(() => {
            navigate('/demo/spatial', {
              state: {
                isDemo: true,
                demoMode: 'blank',
                sessionId: demoResponse.data.sessionId,
                farmId: demoResponse.data.farmId
              }
            });
          }, 1000);
        }
      } else {
        // Real users create actual account
        const onboardingData = {
          ...formData,
          isDemo: false,
          completedAt: new Date().toISOString(),
          method: showAI ? 'hybrid_ai' : 'form_only'
        };
        
        const response = await axios.post('/api/farms/create', formData);
        if (response.data.success) {
          completeOnboarding(onboardingData);
          navigate('/spatial');
        }
      }
    } catch (error) {
      console.error('Onboarding submission failed:', error);
      setValidationErrors({ submit: 'Failed to complete setup. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="hybrid-onboarding-container">
      <div className="hybrid-onboarding">
        {/* Header */}
        <div className="onboarding-header">
          <h1>Welcome to Burnwise</h1>
          <p>Set up your farm to start coordinating agricultural burns safely</p>
        </div>

        <div className="onboarding-content">
          {/* Form Section */}
          <div className="form-section">
            <form onSubmit={handleSubmit}>
              {/* Mode Selection - First Step */}
              {!selectedMode && (
                <div className="mode-selection">
                  <h3>Choose Your Account Type</h3>
                  <p className="mode-description">
                    Select how you'd like to experience Burnwise
                  </p>
                  
                  <div className="mode-cards">
                    <motion.div
                      className="mode-card"
                      onClick={() => handleModeSelect('demo')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="mode-icon demo-icon">
                        <FaRocket />
                      </div>
                      <h4>Demo Mode</h4>
                      <p>Try Burnwise instantly</p>
                      <ul className="mode-features">
                        <li>No registration required</li>
                        <li>24-hour session</li>
                        <li>Full AI features</li>
                        <li>Real TiDB database</li>
                      </ul>
                      <div className="mode-badge">Quick Start</div>
                    </motion.div>

                    <motion.div
                      className="mode-card"
                      onClick={() => handleModeSelect('real')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="mode-icon real-icon">
                        <FaUser />
                      </div>
                      <h4>Real Account</h4>
                      <p>Create your farm profile</p>
                      <ul className="mode-features">
                        <li>Permanent account</li>
                        <li>Save burn history</li>
                        <li>Multi-farm coordination</li>
                        <li>Full production access</li>
                      </ul>
                      <div className="mode-badge">Full Access</div>
                    </motion.div>
                  </div>

                  {validationErrors.mode && (
                    <span className="error-message center">{validationErrors.mode}</span>
                  )}
                </div>
              )}

              {/* Show form fields only after mode selection */}
              {selectedMode && (
                <>
                  {/* Mode indicator */}
                  <div className="selected-mode-indicator">
                    <span className={`mode-tag ${selectedMode}`}>
                      {selectedMode === 'demo' ? (
                        <>
                          <FaRocket /> Demo Mode
                        </>
                      ) : (
                        <>
                          <FaUser /> Real Account
                        </>
                      )}
                    </span>
                    <button
                      type="button"
                      className="mode-change-btn"
                      onClick={() => {
                        setSelectedMode(null);
                        setFormData({
                          farmName: '',
                          ownerName: '',
                          email: '',
                          phone: '',
                          location: '',
                          acreage: '',
                          farmBoundary: null,
                          primaryCrops: '',
                          burnFrequency: 'seasonal'
                        });
                      }}
                    >
                      Change Mode
                    </button>
                  </div>

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
                  <label>
                    Farm Boundary <span className="required">*</span>
                  </label>
                  <div className="map-container">
                    {formData.farmBoundary && (
                      <span className="boundary-status">
                        <FaCheck /> Boundary drawn ({formData.acreage} acres)
                      </span>
                    )}
                    
                    <FarmBoundaryDrawer
                      onBoundaryComplete={handleBoundaryComplete}
                      initialBoundary={formData.farmBoundary}
                      initialLocation={formData.location}
                    />
                    
                    {!formData.farmBoundary && (
                      <p className="field-hint">
                        Click and drag on the map to draw your farm boundary
                      </p>
                    )}
                  </div>
                  
                  {validationErrors.location && (
                    <span className="error-message">
                      {validationErrors.location}
                    </span>
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

              {/* Owner Information - Only show for real users */}
              {selectedMode === 'real' && (
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
              )}

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
                <button
                  type="submit"
                  disabled={!formComplete || isSubmitting}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Creating Farm...' : 'Complete Setup'}
                  <FaChevronRight />
                </button>
              </div>
                </>
              )}
            </form>
          </div>

          {/* AI Assistant Section (Optional) - Only show after mode selection */}
          {selectedMode && (
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
          )}
        </div>
      </div>
      
      {/* Ember Background */}
      <EmberBackground intensity={1.0} blur={true} />
    </div>
  );
};

export default HybridOnboarding;