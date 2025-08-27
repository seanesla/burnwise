/**
 * HybridOnboarding - Simple, clean onboarding form
 * Direct form-based setup without AI complexity
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaUser, FaEnvelope, FaMapMarkerAlt, 
  FaTree, FaChevronRight, FaChevronLeft,
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
  
  // Demo mode only - no selection needed
  const [selectedMode] = useState('demo');
  const sessionId = user?.id || `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Form state - defaults will be set based on mode selection
  const [formData, setFormData] = useState({
    farmName: '',
    ownerName: '',
    location: '',
    acreage: '',
    farmBoundary: null, // GeoJSON boundary
    primaryCrops: '',
    burnFrequency: 'seasonal'
  });
  
  // UI state
  const [showMap, setShowMap] = useState(true); // Always show map
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formComplete, setFormComplete] = useState(false);

  // Update form when mode is selected
  useEffect(() => {
    if (selectedMode === 'demo') {
      setFormData(prev => ({
        ...prev,
        ownerName: 'Demo User'
      }));
    } else if (selectedMode === 'real') {
      setFormData(prev => ({
        ...prev,
        ownerName: ''
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
      const required = ['farmName', 'ownerName'];
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
    
    // Only require owner for real users
    if (selectedMode === 'real') {
      if (!formData.ownerName.trim()) {
        errors.ownerName = 'Owner name is required';
      }
    }
    
    // Boundary drawing is required for all users
    if (!formData.farmBoundary) {
      errors.location = 'Please draw the farm boundary on the map';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Auto-populate demo defaults on mount
  useEffect(() => {
    setFormData({
      farmName: 'Demo Farm',
      ownerName: 'Demo User',
      location: 'San Diego, CA',
      acreage: '500',
      farmBoundary: null,
      primaryCrops: 'Wheat',
      burnFrequency: 'seasonal'
    });
  }, []);


  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Initialize demo session (always demo mode)
      {
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
          
          // Update farm with user data
          if (formData.farmName) {
            await axios.post('http://localhost:5001/api/demo/update-farm', {
              sessionId: sessionId,
              farmData: formData
            }, {
              headers: { 'X-Demo-Mode': 'true' },
              withCredentials: true
            });
          }

          // Save onboarding data
          const onboardingData = {
            ...formData,
            isDemo: true,
            completedAt: new Date().toISOString()
          };
          
          completeOnboarding(onboardingData);
          
          // Navigate to spatial interface (dashboard)
          setTimeout(() => {
            navigate('/spatial', {
              state: {
                isDemo: true,
                demoMode: 'blank',
                sessionId: demoResponse.data.sessionId,
                farmId: demoResponse.data.farmId
              }
            });
          }, 1000);
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
              {/* Demo mode form - no selection needed */}
              {
                <>
                  {/* Demo mode indicator */}
                  <div className="selected-mode-indicator">
                    <span className="mode-tag demo">
                      <FaRocket /> Demo Mode
                    </span>
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
              }
            </form>
          </div>

        </div>
      </div>
      
      {/* Ember Background */}
      <EmberBackground intensity={1.0} blur={true} />
    </div>
  );
};

export default HybridOnboarding;