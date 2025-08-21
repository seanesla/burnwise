/**
 * TutorialOverlay Component
 * Dynamic, interactive tutorial overlay with element highlighting
 * Uses real application data, no hardcoding or mocks
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { FaTimes, FaArrowRight, FaArrowLeft, FaCheck, FaGripHorizontal } from 'react-icons/fa';
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
    endTutorial,
    appState
  } = useTutorial();
  
  const [targetBounds, setTargetBounds] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const dragControls = useDragControls();
  
  // Get current step data
  const step = getCurrentStep();
  
  // Check if step requirements are met
  const isStepActionRequired = step?.nextTrigger === 'action' && step?.requiredState;
  const areRequirementsMet = isStepActionRequired ? 
    Object.keys(step.requiredState).every(key => appState[key] === step.requiredState[key]) : 
    true;
  
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
    const tooltipWidth = 400;
    const tooltipHeight = 350; // Estimated height
    
    switch (step.position) {
      case 'top':
        tooltipY = bounds.y - tooltipHeight - 30;
        tooltipX = bounds.centerX - tooltipWidth / 2;
        break;
      case 'bottom':
        tooltipY = bounds.y + bounds.height + 30;
        tooltipX = bounds.centerX - tooltipWidth / 2;
        break;
      case 'left':
        tooltipX = bounds.x - tooltipWidth - 30;
        tooltipY = bounds.centerY - tooltipHeight / 2;
        break;
      case 'right':
        tooltipX = bounds.x + bounds.width + 30;
        tooltipY = bounds.centerY - tooltipHeight / 2;
        break;
      case 'center':
        tooltipX = bounds.centerX - tooltipWidth / 2;
        tooltipY = bounds.centerY - tooltipHeight / 2;
        break;
      case 'auto':
      default:
        // Smart positioning to avoid edges
        const spaceTop = bounds.y;
        const spaceBottom = window.innerHeight - (bounds.y + bounds.height);
        const spaceLeft = bounds.x;
        const spaceRight = window.innerWidth - (bounds.x + bounds.width);
        
        // Find the side with most space
        const maxSpace = Math.max(spaceTop, spaceBottom, spaceLeft, spaceRight);
        
        if (maxSpace === spaceTop && spaceTop > tooltipHeight + 30) {
          tooltipY = bounds.y - tooltipHeight - 30;
          tooltipX = bounds.centerX - tooltipWidth / 2;
        } else if (maxSpace === spaceBottom && spaceBottom > tooltipHeight + 30) {
          tooltipY = bounds.y + bounds.height + 30;
          tooltipX = bounds.centerX - tooltipWidth / 2;
        } else if (maxSpace === spaceLeft && spaceLeft > tooltipWidth + 30) {
          tooltipX = bounds.x - tooltipWidth - 30;
          tooltipY = bounds.centerY - tooltipHeight / 2;
        } else if (maxSpace === spaceRight && spaceRight > tooltipWidth + 30) {
          tooltipX = bounds.x + bounds.width + 30;
          tooltipY = bounds.centerY - tooltipHeight / 2;
        } else {
          // Default to top if no good space
          tooltipY = Math.max(20, bounds.y - tooltipHeight - 30);
          tooltipX = bounds.centerX - tooltipWidth / 2;
        }
        break;
    }
    
    // Ensure tooltip stays within viewport with proper padding
    const padding = 20;
    tooltipX = Math.max(padding, Math.min(window.innerWidth - tooltipWidth - padding, tooltipX));
    tooltipY = Math.max(padding, Math.min(window.innerHeight - tooltipHeight - padding, tooltipY));
    
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
          drag
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={{
            left: 20,
            right: window.innerWidth - 420,
            top: 20,
            bottom: window.innerHeight - 400
          }}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y
          }}
        >
          {/* Header */}
          <div 
            className="tutorial-header"
            onPointerDown={(e) => dragControls.start(e)}
            style={{ cursor: 'move' }}
          >
            <div className="tutorial-header-left">
              <FaGripHorizontal className="tutorial-drag-handle" />
              <h3 className="tutorial-title">{step.title}</h3>
            </div>
            <button
              className="tutorial-close"
              onClick={skipTutorial}
              aria-label="Skip tutorial"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <FaTimes />
            </button>
          </div>
          
          {/* Content */}
          <div className="tutorial-content">
            <p className="tutorial-text">{step.content}</p>
            
            {/* Show waiting content if action required but not completed */}
            {isStepActionRequired && !areRequirementsMet && step.waitingContent && (
              <motion.div 
                className="tutorial-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="waiting-indicator">
                  <motion.div
                    className="waiting-pulse"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.6, 1, 0.6]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>
                <p className="waiting-text">{step.waitingContent}</p>
              </motion.div>
            )}
            
            {/* Show agent highlight if applicable */}
            {step.agentHighlight && (
              <div className="agent-highlight">
                <span className="agent-badge">{step.agentHighlight}</span>
                <span className="agent-status">Active</span>
              </div>
            )}
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
                className={`tutorial-nav-button next primary ${isStepActionRequired && !areRequirementsMet ? 'disabled' : ''}`}
                onClick={nextStep}
                disabled={isStepActionRequired && !areRequirementsMet}
                title={isStepActionRequired && !areRequirementsMet ? 'Complete the action to continue' : ''}
              >
                <span>{isStepActionRequired && !areRequirementsMet ? 'Complete Action' : 'Next'}</span>
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