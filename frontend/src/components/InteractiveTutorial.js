/**
 * InteractiveTutorial.js - Simple Interactive Tutorial System
 * Guides users through Burnwise's key features with tooltips and highlights
 * Glass morphism design with smooth animations
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './InteractiveTutorial.css';

const tutorialSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Burnwise',
    content: 'The revolutionary agricultural burn coordination system. This quick tour will show you the key features.',
    target: null,
    position: 'center'
  },
  {
    id: 'map',
    title: 'Map is the Application',
    content: 'The map IS the entire interface. Click farms directly, drag to create burn zones, and interact spatially.',
    target: '.mapboxgl-canvas',
    position: 'center',
    highlight: true
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    content: 'Your intelligent burn coordinator. Drag this bubble anywhere on screen. Chat naturally to schedule burns.',
    target: '.floating-ai-container',
    position: 'left',
    highlight: true
  },
  {
    id: 'dock',
    title: 'Navigation Dock',
    content: 'Four essential controls at your fingertips: Map Controls, AI Assistant, Active Burns, and Settings.',
    target: '.dock-navigation',
    position: 'top',
    highlight: true
  },
  {
    id: 'timeline',
    title: 'Timeline Scrubber',
    content: 'Travel through time! Scrub to see past burns, current conditions, or future schedules.',
    target: '.timeline-scrubber',
    position: 'right',
    highlight: true
  },
  {
    id: 'farm-interaction',
    title: 'Farm Interaction',
    content: 'Click any farm marker to see details, schedule burns, or view conflict analysis.',
    target: '.mapboxgl-marker',
    position: 'bottom',
    highlight: true
  },
  {
    id: 'complete',
    title: 'Ready to Burn Safely!',
    content: 'You\'re all set! Remember: Burnwise prevents smoke conflicts and keeps communities safe.',
    target: null,
    position: 'center'
  }
];

const InteractiveTutorial = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [highlightElement, setHighlightElement] = useState(null);

  // Check if user has seen tutorial
  useEffect(() => {
    const seen = localStorage.getItem('burnwise_tutorial_completed');
    setHasSeenTutorial(!!seen);
    
    // Auto-start for new users after a delay
    if (!seen) {
      setTimeout(() => {
        setIsActive(true);
      }, 2000); // 2 second delay for page to load
    }
  }, []);

  // Handle element highlighting
  useEffect(() => {
    if (!isActive) return;
    
    const step = tutorialSteps[currentStep];
    if (step.target && step.highlight) {
      const element = document.querySelector(step.target);
      if (element) {
        setHighlightElement(element);
        element.classList.add('tutorial-highlight');
        
        // Scroll element into view smoothly
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center', 
          inline: 'center' 
        });
      }
    } else {
      // Clean up previous highlight
      if (highlightElement) {
        highlightElement.classList.remove('tutorial-highlight');
        setHighlightElement(null);
      }
    }

    return () => {
      if (highlightElement) {
        highlightElement.classList.remove('tutorial-highlight');
      }
    };
  }, [currentStep, isActive]);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTutorial();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTutorial();
  };

  const completeTutorial = () => {
    localStorage.setItem('burnwise_tutorial_completed', 'true');
    setHasSeenTutorial(true);
    setIsActive(false);
    setCurrentStep(0);
    
    // Clean up any highlights
    if (highlightElement) {
      highlightElement.classList.remove('tutorial-highlight');
      setHighlightElement(null);
    }
  };

  const startTutorial = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const getTooltipPosition = (step) => {
    if (!step.target) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const element = document.querySelector(step.target);
    if (!element) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    
    const rect = element.getBoundingClientRect();
    const positions = {
      top: {
        top: `${rect.top - 20}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translate(-50%, -100%)'
      },
      bottom: {
        top: `${rect.bottom + 20}px`,
        left: `${rect.left + rect.width / 2}px`,
        transform: 'translateX(-50%)'
      },
      left: {
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.left - 20}px`,
        transform: 'translate(-100%, -50%)'
      },
      right: {
        top: `${rect.top + rect.height / 2}px`,
        left: `${rect.right + 20}px`,
        transform: 'translateY(-50%)'
      },
      center: {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      }
    };
    
    return positions[step.position] || positions.center;
  };

  const step = tutorialSteps[currentStep];
  const tooltipStyle = getTooltipPosition(step);

  return (
    <>
      {/* Tutorial trigger button */}
      {!isActive && hasSeenTutorial && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="tutorial-trigger"
          onClick={startTutorial}
          title="Restart Tutorial"
        >
          <span className="tutorial-icon">?</span>
        </motion.button>
      )}

      {/* Tutorial overlay */}
      <AnimatePresence>
        {isActive && (
          <>
            {/* Dark overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="tutorial-overlay"
              onClick={handleSkip}
            />

            {/* Tutorial tooltip */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="tutorial-tooltip"
              style={tooltipStyle}
            >
              {/* Progress dots */}
              <div className="tutorial-progress">
                {tutorialSteps.map((_, index) => (
                  <span
                    key={index}
                    className={`progress-dot ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'completed' : ''}`}
                  />
                ))}
              </div>

              {/* Content */}
              <h3 className="tutorial-title">{step.title}</h3>
              <p className="tutorial-content">{step.content}</p>

              {/* Actions */}
              <div className="tutorial-actions">
                <button 
                  className="tutorial-btn tutorial-btn-skip"
                  onClick={handleSkip}
                >
                  Skip
                </button>
                
                <div className="tutorial-nav">
                  {currentStep > 0 && (
                    <button 
                      className="tutorial-btn tutorial-btn-prev"
                      onClick={handlePrevious}
                    >
                      Previous
                    </button>
                  )}
                  
                  <button 
                    className="tutorial-btn tutorial-btn-next"
                    onClick={handleNext}
                  >
                    {currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default InteractiveTutorial;