import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FaSeedling, 
  FaTractor, 
  FaPlay, 
  FaCheckCircle, 
  FaSpinner,
  FaClock,
  FaShieldAlt,
  FaGlobe
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { springPresets } from '../styles/animations';
import AnimatedFlameLogo from './AnimatedFlameLogo';
import './DemoModeSelector.css';

const DemoModeSelector = ({ onSelect, onClose }) => {
  const [selectedMode, setSelectedMode] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const navigate = useNavigate();

  const demoOptions = [
    {
      id: 'blank',
      title: 'Blank Slate',
      subtitle: 'Start Fresh & Explore',
      description: 'Perfect for exploring the interface at your own pace',
      icon: <FaSeedling />,
      color: '#4CAF50',
      benefits: [
        'Clean environment to start from scratch',
        'Build your first burn request step-by-step',
        'Learn the spatial interface naturally',
        'Experience the full onboarding flow',
        'Your own pace, no pressure'
      ],
      ideal: 'First-time users who want to explore'
    },
    {
      id: 'preloaded',
      title: 'Sample Farm',
      subtitle: 'Jump Right Into Action',
      description: 'Pre-loaded with realistic data to explore immediately',
      icon: <FaTractor />,
      color: '#FF6B35',
      benefits: [
        '3 active burn requests with different statuses',
        '5 nearby demo farms for conflict scenarios',
        'Historical weather data and patterns',
        'Real agent conversations to review',
        'Complex scheduling scenarios to explore'
      ],
      ideal: 'Experienced users or judges wanting full features'
    }
  ];

  const generateSessionId = () => {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  };

  const handleStart = async () => {
    if (!selectedMode) return;

    setIsStarting(true);
    
    try {
      // Initialize demo session with real TiDB
      const response = await fetch('/api/demo/initialize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Demo-Mode': 'true'
        },
        credentials: 'include',
        body: JSON.stringify({
          mode: selectedMode,
          sessionId: generateSessionId()
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to initialize demo');
      }

      const data = await response.json();
      
      toast.success(`Demo ${selectedMode === 'blank' ? 'Blank Slate' : 'Sample Farm'} initialized!`);

      // Store demo context in sessionStorage
      sessionStorage.setItem('burnwise_demo_context', JSON.stringify({
        isDemo: true,
        sessionId: data.sessionId,
        farmId: data.farmId,
        mode: selectedMode,
        startTime: new Date().toISOString()
      }));

      // Navigate to spatial interface
      if (onSelect) {
        onSelect(selectedMode);
      } else {
        navigate('/spatial');
      }
    } catch (error) {
      console.error('Demo initialization error:', error);
      toast.error(error.message || 'Failed to start demo');
    } finally {
      setIsStarting(false);
    }
  };

  const handleOptionSelect = (optionId) => {
    setSelectedMode(optionId);
  };

  return (
    <motion.div 
      className="demo-selector-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="demo-selector-modal"
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
        transition={springPresets.smooth}
      >
        {/* Header */}
        <div className="demo-header">
          <div className="demo-title-section">
            <AnimatedFlameLogo size={32} />
            <div>
              <h1 className="demo-title">Choose Your Demo Experience</h1>
              <p className="demo-subtitle">
                Explore BURNWISE with real TiDB and GPT-5 integration
              </p>
            </div>
          </div>
          
          {onClose && (
            <button className="demo-close-btn" onClick={onClose}>
              ×
            </button>
          )}
        </div>

        {/* Real Integration Badges */}
        <div className="demo-badges">
          <div className="demo-badge">
            <FaGlobe />
            <span>Real TiDB Database</span>
          </div>
          <div className="demo-badge">
            <FaShieldAlt />
            <span>Live GPT-5 Agents</span>
          </div>
          <div className="demo-badge">
            <FaClock />
            <span>24hr Session</span>
          </div>
        </div>

        {/* Demo Options */}
        <div className="demo-options">
          {demoOptions.map(option => (
            <motion.div
              key={option.id}
              className={`demo-option ${selectedMode === option.id ? 'selected' : ''}`}
              onClick={() => handleOptionSelect(option.id)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springPresets.snappy}
            >
              {/* Option Header */}
              <div className="option-header">
                <div 
                  className="option-icon"
                  style={{ backgroundColor: option.color + '20', color: option.color }}
                >
                  {option.icon}
                </div>
                <div className="option-title-section">
                  <h3 className="option-title">{option.title}</h3>
                  <p className="option-subtitle">{option.subtitle}</p>
                </div>
                {selectedMode === option.id && (
                  <motion.div
                    className="option-selected"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={springPresets.snappy}
                  >
                    <FaCheckCircle />
                  </motion.div>
                )}
              </div>

              {/* Option Description */}
              <p className="option-description">{option.description}</p>

              {/* Benefits List */}
              <div className="benefits-section">
                <h4 className="benefits-title">What's Included:</h4>
                <ul className="benefits-list">
                  {option.benefits.map((benefit, index) => (
                    <motion.li 
                      key={index}
                      className="benefit-item"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="benefit-dot" style={{ backgroundColor: option.color }} />
                      <span>{benefit}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Ideal For */}
              <div className="ideal-for">
                <strong>Ideal for:</strong> {option.ideal}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action Button */}
        <motion.div className="demo-actions">
          <motion.button
            className={`start-demo-btn ${!selectedMode ? 'disabled' : ''}`}
            onClick={handleStart}
            disabled={!selectedMode || isStarting}
            whileHover={selectedMode && !isStarting ? { scale: 1.02 } : {}}
            whileTap={selectedMode && !isStarting ? { scale: 0.98 } : {}}
            transition={springPresets.snappy}
          >
            {isStarting ? (
              <>
                <FaSpinner className="spinning" />
                Initializing Real TiDB...
              </>
            ) : selectedMode ? (
              <>
                <FaPlay />
                Start Demo with {selectedMode === 'blank' ? 'Blank Slate' : 'Sample Data'}
              </>
            ) : (
              <>
                <FaPlay />
                Select an option above
              </>
            )}
          </motion.button>

          <p className="demo-disclaimer">
            This demo uses real infrastructure including TiDB database and GPT-5 AI agents. 
            All data will be automatically cleaned up after 24 hours.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default DemoModeSelector;