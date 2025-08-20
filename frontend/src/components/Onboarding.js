/**
 * Onboarding Component
 * Multi-step onboarding flow for new farms
 * Customizable preferences and setup
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaFire, FaArrowRight, FaArrowLeft, FaCheck, 
  FaTree, FaCloudSun, FaBell, FaCalendarAlt,
  FaMapMarkedAlt, FaClock, FaExclamationTriangle,
  FaChartLine, FaMobileAlt, FaEnvelope
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import AnimatedFlameLogo from './animations/logos/AnimatedFlameLogo';
import './Onboarding.css';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to BURNWISE',
    icon: FaFire,
    description: 'Let\'s set up your farm for optimal burn coordination'
  },
  {
    id: 'farm-details',
    title: 'Farm Details',
    icon: FaTree,
    description: 'Tell us more about your farm operations'
  },
  {
    id: 'burn-preferences',
    title: 'Burn Preferences',
    icon: FaCalendarAlt,
    description: 'Set your burning schedule preferences'
  },
  {
    id: 'weather-alerts',
    title: 'Weather & Alerts',
    icon: FaCloudSun,
    description: 'Configure weather monitoring and alerts'
  },
  {
    id: 'notification-settings',
    title: 'Notifications',
    icon: FaBell,
    description: 'Choose how you want to receive updates'
  },
  {
    id: 'complete',
    title: 'All Set!',
    icon: FaCheck,
    description: 'Your farm is ready for coordinated burning'
  }
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Onboarding data
  const [onboardingData, setOnboardingData] = useState({
    // Farm Details
    primaryCrops: [],
    burnFrequency: 'seasonal',
    averageBurnSize: 50,
    equipmentTypes: [],
    
    // Burn Preferences
    preferredSeasons: [],
    preferredTimeOfDay: 'morning',
    maxSimultaneousBurns: 1,
    bufferDistance: 5,
    
    // Weather Settings
    minWindSpeed: 0,
    maxWindSpeed: 15,
    minHumidity: 30,
    maxTemperature: 85,
    weatherAlertRadius: 10,
    
    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    alertTypes: ['conflicts', 'weather', 'schedule'],
    notificationFrequency: 'immediate',
    
    // Dashboard Preferences
    defaultView: 'map',
    showWeatherOverlay: true,
    showNearbyFarms: true,
    autoRefreshInterval: 5
  });

  const handleDataChange = (field, value) => {
    setOnboardingData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayToggle = (field, value) => {
    setOnboardingData(prev => {
      const array = prev[field] || [];
      const index = array.indexOf(value);
      
      if (index > -1) {
        return {
          ...prev,
          [field]: array.filter(item => item !== value)
        };
      } else {
        return {
          ...prev,
          [field]: [...array, value]
        };
      }
    });
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    
    try {
      // Save onboarding data
      completeOnboarding(onboardingData);
      
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to spatial interface
      navigate('/spatial');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Complete with default settings
    completeOnboarding(onboardingData);
    navigate('/spatial');
  };

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'welcome':
        return (
          <div className="onboarding-welcome">
            <div className="welcome-icon">
              <AnimatedFlameLogo size={100} animated={true} />
            </div>
            <h2>Welcome, {user?.name || 'Farmer'}!</h2>
            <p className="welcome-text">
              BURNWISE helps coordinate agricultural burns across multiple farms to minimize smoke conflicts 
              and optimize burning conditions.
            </p>
            <div className="welcome-features">
              <div className="feature-item">
                <FaMapMarkedAlt />
                <span>Real-time burn coordination</span>
              </div>
              <div className="feature-item">
                <FaCloudSun />
                <span>Weather-based scheduling</span>
              </div>
              <div className="feature-item">
                <FaExclamationTriangle />
                <span>Conflict prevention</span>
              </div>
              <div className="feature-item">
                <FaChartLine />
                <span>Performance analytics</span>
              </div>
            </div>
            <p className="welcome-note">
              This setup takes about 3 minutes and helps us provide better burn recommendations.
            </p>
          </div>
        );

      case 'farm-details':
        return (
          <div className="onboarding-form">
            <h3>Farm Operations</h3>
            
            <div className="form-group">
              <label>Primary Crops</label>
              <div className="checkbox-grid">
                {['Wheat', 'Rice', 'Corn', 'Soybeans', 'Cotton', 'Other'].map(crop => (
                  <label key={crop} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={onboardingData.primaryCrops.includes(crop)}
                      onChange={() => handleArrayToggle('primaryCrops', crop)}
                    />
                    <span>{crop}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Burn Frequency</label>
              <select
                value={onboardingData.burnFrequency}
                onChange={(e) => handleDataChange('burnFrequency', e.target.value)}
                className="onboarding-select"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="seasonal">Seasonal</option>
                <option value="annual">Annual</option>
              </select>
            </div>

            <div className="form-group">
              <label>Average Burn Size (acres)</label>
              <input
                type="number"
                value={onboardingData.averageBurnSize}
                onChange={(e) => handleDataChange('averageBurnSize', parseInt(e.target.value))}
                min="1"
                max="1000"
                className="onboarding-input"
              />
            </div>

            <div className="form-group">
              <label>Equipment Types</label>
              <div className="checkbox-grid">
                {['Drip Torch', 'ATV Sprayer', 'Helicopter', 'Firebreak Plow', 'Water Truck'].map(equipment => (
                  <label key={equipment} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={onboardingData.equipmentTypes.includes(equipment)}
                      onChange={() => handleArrayToggle('equipmentTypes', equipment)}
                    />
                    <span>{equipment}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 'burn-preferences':
        return (
          <div className="onboarding-form">
            <h3>Burning Schedule Preferences</h3>
            
            <div className="form-group">
              <label>Preferred Seasons</label>
              <div className="checkbox-grid">
                {['Spring', 'Summer', 'Fall', 'Winter'].map(season => (
                  <label key={season} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={onboardingData.preferredSeasons.includes(season)}
                      onChange={() => handleArrayToggle('preferredSeasons', season)}
                    />
                    <span>{season}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Preferred Time of Day</label>
              <select
                value={onboardingData.preferredTimeOfDay}
                onChange={(e) => handleDataChange('preferredTimeOfDay', e.target.value)}
                className="onboarding-select"
              >
                <option value="early-morning">Early Morning (6am-9am)</option>
                <option value="morning">Morning (9am-12pm)</option>
                <option value="afternoon">Afternoon (12pm-5pm)</option>
                <option value="evening">Evening (5pm-8pm)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Max Simultaneous Burns</label>
              <input
                type="number"
                value={onboardingData.maxSimultaneousBurns}
                onChange={(e) => handleDataChange('maxSimultaneousBurns', parseInt(e.target.value))}
                min="1"
                max="10"
                className="onboarding-input"
              />
              <span className="input-hint">Number of burns you can manage at once</span>
            </div>

            <div className="form-group">
              <label>Minimum Buffer Distance (miles)</label>
              <input
                type="number"
                value={onboardingData.bufferDistance}
                onChange={(e) => handleDataChange('bufferDistance', parseInt(e.target.value))}
                min="1"
                max="50"
                className="onboarding-input"
              />
              <span className="input-hint">Distance from other active burns</span>
            </div>
          </div>
        );

      case 'weather-alerts':
        return (
          <div className="onboarding-form">
            <h3>Weather Monitoring Settings</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Min Wind Speed (mph)</label>
                <input
                  type="number"
                  value={onboardingData.minWindSpeed}
                  onChange={(e) => handleDataChange('minWindSpeed', parseInt(e.target.value))}
                  min="0"
                  max="50"
                  className="onboarding-input"
                />
              </div>
              
              <div className="form-group">
                <label>Max Wind Speed (mph)</label>
                <input
                  type="number"
                  value={onboardingData.maxWindSpeed}
                  onChange={(e) => handleDataChange('maxWindSpeed', parseInt(e.target.value))}
                  min="0"
                  max="50"
                  className="onboarding-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Min Humidity (%)</label>
                <input
                  type="number"
                  value={onboardingData.minHumidity}
                  onChange={(e) => handleDataChange('minHumidity', parseInt(e.target.value))}
                  min="0"
                  max="100"
                  className="onboarding-input"
                />
              </div>
              
              <div className="form-group">
                <label>Max Temperature (°F)</label>
                <input
                  type="number"
                  value={onboardingData.maxTemperature}
                  onChange={(e) => handleDataChange('maxTemperature', parseInt(e.target.value))}
                  min="32"
                  max="120"
                  className="onboarding-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Weather Alert Radius (miles)</label>
              <input
                type="number"
                value={onboardingData.weatherAlertRadius}
                onChange={(e) => handleDataChange('weatherAlertRadius', parseInt(e.target.value))}
                min="5"
                max="100"
                className="onboarding-input"
              />
              <span className="input-hint">Get alerts for weather changes within this radius</span>
            </div>
          </div>
        );

      case 'notification-settings':
        return (
          <div className="onboarding-form">
            <h3>Notification Preferences</h3>
            
            <div className="form-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={onboardingData.emailNotifications}
                  onChange={(e) => handleDataChange('emailNotifications', e.target.checked)}
                />
                <span className="switch"></span>
                <span className="switch-text">
                  <FaEnvelope /> Email Notifications
                </span>
              </label>
            </div>

            <div className="form-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={onboardingData.smsNotifications}
                  onChange={(e) => handleDataChange('smsNotifications', e.target.checked)}
                />
                <span className="switch"></span>
                <span className="switch-text">
                  <FaMobileAlt /> SMS Notifications
                </span>
              </label>
            </div>

            <div className="form-group">
              <label>Alert Types</label>
              <div className="checkbox-grid">
                {[
                  { id: 'conflicts', label: 'Burn Conflicts', icon: FaExclamationTriangle },
                  { id: 'weather', label: 'Weather Changes', icon: FaCloudSun },
                  { id: 'schedule', label: 'Schedule Updates', icon: FaCalendarAlt },
                  { id: 'approval', label: 'Approval Status', icon: FaCheck }
                ].map(alert => (
                  <label key={alert.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={onboardingData.alertTypes.includes(alert.id)}
                      onChange={() => handleArrayToggle('alertTypes', alert.id)}
                    />
                    <span><alert.icon /> {alert.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Notification Frequency</label>
              <select
                value={onboardingData.notificationFrequency}
                onChange={(e) => handleDataChange('notificationFrequency', e.target.value)}
                className="onboarding-select"
              >
                <option value="immediate">Immediate</option>
                <option value="hourly">Hourly Digest</option>
                <option value="daily">Daily Summary</option>
                <option value="weekly">Weekly Report</option>
              </select>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="onboarding-complete">
            <div className="complete-icon">
              <AnimatedFlameLogo size={60} animated={true} />
            </div>
            <h2>Setup Complete!</h2>
            <p className="complete-text">
              Your farm is now configured for optimal burn coordination.
            </p>
            <div className="complete-summary">
              <h4>Your Preferences:</h4>
              <ul>
                <li>Burn Frequency: {onboardingData.burnFrequency}</li>
                <li>Preferred Time: {onboardingData.preferredTimeOfDay}</li>
                <li>Max Wind Speed: {onboardingData.maxWindSpeed} mph</li>
                <li>Alert Radius: {onboardingData.weatherAlertRadius} miles</li>
                <li>Notifications: {onboardingData.emailNotifications ? 'Email' : ''} {onboardingData.smsNotifications ? 'SMS' : ''}</li>
              </ul>
            </div>
            <p className="complete-note">
              You can update these preferences anytime in Settings.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-background" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="onboarding-card"
      >
        {/* Progress Bar */}
        <div className="onboarding-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="progress-steps">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`progress-step ${
                  index <= currentStep ? 'active' : ''
                } ${index < currentStep ? 'completed' : ''}`}
              >
                <div className="step-icon">
                  {index < currentStep ? <FaCheck /> : <step.icon />}
                </div>
                <span className="step-label">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="onboarding-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="step-header">
                <h2>{STEPS[currentStep].title}</h2>
                <p>{STEPS[currentStep].description}</p>
              </div>
              
              <div className="step-content">
                {renderStepContent()}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="onboarding-navigation">
          <button
            onClick={handleSkip}
            className="btn-skip"
            disabled={loading || currentStep === STEPS.length - 1}
          >
            Skip Setup
          </button>
          
          <div className="nav-buttons">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="btn-back"
                disabled={loading}
              >
                <FaArrowLeft /> Back
              </button>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                className="btn-next"
                disabled={loading}
              >
                Next <FaArrowRight />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                className="btn-complete"
                disabled={loading}
              >
                {loading ? 'Setting up...' : 'Go to Dashboard'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Onboarding;