/**
 * TutorialOverlay Component
 * Dynamic, interactive tutorial overlay with element highlighting
 * Uses real application data, no hardcoding or mocks
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';
import { useTutorial } from '../contexts/TutorialContext';
import './TutorialOverlay.css';

const TutorialOverlay = () => {
  const {
    isActive,
    currentStep,
    totalSteps,
    getCurrentStep,
    nextStep,
    previousStep,
    skipTutorial,
    endTutorial
  } = useTutorial();
  
  const [targetBounds, setTargetBounds] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  
  // Get current step data
  const step = getCurrentStep();
  
  // Calculate spotlight and tooltip positions
  const calculatePositions = useCallback(() => {
    if (!step || !step.targetSelector) {
      // Center position for steps without targets
      setTargetBounds(null);
      setTooltipPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      return;
    }
    
    // Find target element
    const target = document.querySelector(step.targetSelector);
    if (!target) {
      // Element not found, show in center
      setTargetBounds(null);
      setTooltipPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      });
      return;
    }
    
    // Get element bounds
    const rect = target.getBoundingClientRect();
    const bounds = {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
    
    setTargetBounds(bounds);
    
    // Calculate tooltip position based on step position preference
    let tooltipX = bounds.centerX;
    let tooltipY = bounds.centerY;
    
    switch (step.position) {
      case 'top':
        tooltipY = bounds.y - 20;
        break;
      case 'bottom':
        tooltipY = bounds.y + bounds.height + 20;
        break;
      case 'left':
        tooltipX = bounds.x - 20;
        break;
      case 'right':
        tooltipX = bounds.x + bounds.width + 20;
        break;
      case 'center':
        // Keep centered
        break;
      case 'auto':
      default:
        // Smart positioning to avoid edges
        if (bounds.centerY < window.innerHeight / 2) {
          tooltipY = bounds.y + bounds.height + 20;
        } else {
          tooltipY = bounds.y - 20;
        }
        
        if (bounds.centerX < window.innerWidth / 2) {
          tooltipX = bounds.x + bounds.width + 20;
        } else {
          tooltipX = bounds.x - 20;
        }
        break;
    }
    
    // Ensure tooltip stays within viewport
    const padding = 20;
    tooltipX = Math.max(padding, Math.min(window.innerWidth - 400 - padding, tooltipX));
    tooltipY = Math.max(padding, Math.min(window.innerHeight - 200 - padding, tooltipY));
    
    setTooltipPosition({ x: tooltipX, y: tooltipY });
  }, [step]);
  
  // Recalculate positions on step change or window resize
  useEffect(() => {
    if (!isActive) return;
    
    // Initial calculation
    calculatePositions();
    
    // Recalculate on window resize
    const handleResize = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(calculatePositions);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    
    // Watch for DOM changes that might affect positioning
    const observer = new MutationObserver(() => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(calculatePositions);
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, currentStep, calculatePositions]);
  
  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    
    const handleKeyPress = (e) => {
      switch (e.key) {
        case 'Escape':
          skipTutorial();
          break;
        case 'ArrowRight':
        case 'Enter':
          if (currentStep < totalSteps - 1) {
            nextStep();
          } else {
            endTutorial();
          }
          break;
        case 'ArrowLeft':
          if (currentStep > 0) {
            previousStep();
          }
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isActive, currentStep, totalSteps, nextStep, previousStep, skipTutorial, endTutorial]);
  
  if (!isActive || !step) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="tutorial-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Dark backdrop with spotlight hole */}
        <div className="tutorial-backdrop">
          {targetBounds && (
            <motion.div
              className="tutorial-spotlight"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                left: targetBounds.x - 10,
                top: targetBounds.y - 10,
                width: targetBounds.width + 20,
                height: targetBounds.height + 20,
              }}
            />
          )}
        </div>
        
        {/* Tutorial tooltip */}
        <motion.div
          className="tutorial-tooltip"
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: step.position === 'center' ? 'translate(-50%, -50%)' : 'none'
          }}
        >
          {/* Header */}
          <div className="tutorial-header">
            <h3 className="tutorial-title">{step.title}</h3>
            <button
              className="tutorial-close"
              onClick={skipTutorial}
              aria-label="Skip tutorial"
            >
              <FaTimes />
            </button>
          </div>
          
          {/* Content */}
          <div className="tutorial-content">
            <p className="tutorial-text">{step.content}</p>
          </div>
          
          {/* Progress indicator */}
          <div className="tutorial-progress">
            <div className="progress-dots">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={`progress-dot ${
                    index === currentStep ? 'active' : 
                    index < currentStep ? 'completed' : ''
                  }`}
                />
              ))}
            </div>
            <span className="progress-text">
              {currentStep + 1} of {totalSteps}
            </span>
          </div>
          
          {/* Navigation */}
          <div className="tutorial-navigation">
            {currentStep > 0 && (
              <button
                className="tutorial-nav-button prev"
                onClick={previousStep}
              >
                <FaArrowLeft />
                <span>Previous</span>
              </button>
            )}
            
            <button
              className="tutorial-nav-button skip"
              onClick={skipTutorial}
            >
              Skip Tutorial
            </button>
            
            {currentStep < totalSteps - 1 ? (
              <button
                className="tutorial-nav-button next primary"
                onClick={nextStep}
              >
                <span>Next</span>
                <FaArrowRight />
              </button>
            ) : (
              <button
                className="tutorial-nav-button next primary"
                onClick={endTutorial}
              >
                <span>Complete</span>
                <FaCheck />
              </button>
            )}
          </div>
          
          {/* Action hint */}
          {step.action && (
            <div className="tutorial-action-hint">
              {step.nextTrigger === 'action' ? (
                <span className="action-required">
                  Complete the action to continue
                </span>
              ) : (
                <span className="action-optional">
                  Try it out or click Next to continue
                </span>
              )}
            </div>
          )}
        </motion.div>
        
        {/* Pulse animation on target element */}
        {targetBounds && (
          <motion.div
            className="tutorial-pulse"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.8, 0.4, 0.8]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              left: targetBounds.centerX,
              top: targetBounds.centerY,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default TutorialOverlay;