/**
 * Tutorial Context
 * Dynamic, state-aware tutorial system for Burnwise
 * Guides users through complete workflow using real application data
 */

import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useMap } from './MapContext';
import axios from 'axios';

const TutorialContext = createContext(null);

// Tutorial steps configuration - dynamic and data-driven
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Burnwise',
    targetSelector: null, // No specific target, shows in center
    position: 'center',
    content: (data) => `Welcome to Burnwise - the revolutionary agricultural burn coordination system. You're managing ${data.farmCount || 'multiple'} farms with real-time AI coordination.`,
    action: null,
    nextTrigger: 'manual', // User clicks next
    requiredState: null
  },
  {
    id: 'spatial-interface',
    title: 'Spatial Interface',
    targetSelector: '.mapboxgl-canvas',
    position: 'center',
    content: (data) => `This isn't just a map - it's your entire application. Click directly on farms, drag to create burn zones, and interact spatially. ${data.farmsVisible ? `You can see ${data.farmsVisible} farms in your area.` : 'Zoom in to see farm boundaries.'}`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null
  },
  {
    id: 'farm-interaction',
    title: 'Click a Farm',
    targetSelector: '.farm-marker',
    position: 'top',
    content: (data) => `Click on any farm marker to see details. ${data.nearestFarm ? `Try clicking on ${data.nearestFarm}.` : 'Each farm has real boundaries and burn history.'}`,
    action: 'click-farm',
    nextTrigger: 'action', // Proceeds when user clicks a farm
    requiredState: { farmPopupOpen: true }
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    targetSelector: '[data-dock-item="ai"]',
    position: 'top',
    content: () => 'Click the AI Assistant button to open the chat. Our 5-agent system will handle burn requests using natural language.',
    action: 'open-ai',
    nextTrigger: 'action',
    requiredState: { aiChatOpen: true }
  },
  {
    id: 'natural-language',
    title: 'Natural Language Requests',
    targetSelector: '.floating-ai-input textarea',
    position: 'top',
    content: (data) => `Try typing: "I need to burn ${data.suggestedAcres || 100} acres ${data.suggestedTime || 'tomorrow morning'}"`,
    action: 'send-message',
    nextTrigger: 'action',
    requiredState: { messagesSent: true }
  },
  {
    id: 'agent-handoffs',
    title: 'Agent Coordination',
    targetSelector: '.agent-indicator',
    position: 'top',
    content: () => 'Watch as specialized agents handle your request - Weather Analysis, Conflict Resolution, and Schedule Optimization.',
    action: null,
    nextTrigger: 'manual',
    requiredState: null
  },
  {
    id: 'weather-overlay',
    title: 'Weather Analysis',
    targetSelector: '[data-layer="weather"]',
    position: 'right',
    content: (data) => `Toggle the weather overlay to see real conditions. Current temperature: ${data.temperature || '75'}°F with ${data.windSpeed || 'light'} winds.`,
    action: 'toggle-weather',
    nextTrigger: 'action',
    requiredState: { weatherLayerActive: true }
  },
  {
    id: 'timeline-scrubber',
    title: 'Timeline Navigation',
    targetSelector: '.timeline-scrubber',
    position: 'top',
    content: (data) => `Scrub through time to see past burns and future schedules. ${data.activeBurns ? `${data.activeBurns} burns are currently active.` : 'View the complete burn history.'}`,
    action: 'use-timeline',
    nextTrigger: 'action',
    requiredState: { timelineUsed: true }
  },
  {
    id: 'dock-navigation',
    title: 'Quick Access Dock',
    targetSelector: '.dock-navigation',
    position: 'top',
    content: () => 'Access key features from the dock - Map Controls, AI Assistant, Active Burns, and Settings.',
    action: null,
    nextTrigger: 'manual',
    requiredState: null
  },
  {
    id: 'active-burns',
    title: 'Active Burns Panel',
    targetSelector: '[data-dock-item="burns"]',
    position: 'top',
    content: (data) => `View and manage all burn requests. ${data.pendingBurns ? `You have ${data.pendingBurns} burns awaiting approval.` : 'All burns are monitored in real-time.'}`,
    action: 'open-burns',
    nextTrigger: 'action',
    requiredState: { burnsPanelOpen: true }
  },
  {
    id: 'safety-approval',
    title: 'Human-in-the-Loop Safety',
    targetSelector: '.approval-required',
    position: 'auto',
    content: () => 'Critical decisions require human approval. You maintain control over safety-sensitive operations.',
    action: null,
    nextTrigger: 'manual',
    requiredState: null
  },
  {
    id: 'complete',
    title: 'Tutorial Complete!',
    targetSelector: null,
    position: 'center',
    content: (data) => `You're ready to coordinate agricultural burns with AI precision. ${data.userName ? `Welcome aboard, ${data.userName}!` : 'Let\'s revolutionize farm management together.'}`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null
  }
];

export const TutorialProvider = ({ children }) => {
  const { user } = useAuth();
  const { farms, mapRef } = useMap();
  
  // Tutorial state
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [tutorialData, setTutorialData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Application state monitoring
  const [appState, setAppState] = useState({
    farmPopupOpen: false,
    aiChatOpen: false,
    messagesSent: false,
    weatherLayerActive: false,
    timelineUsed: false,
    burnsPanelOpen: false,
    farmsVisible: 0,
    activeBurns: 0,
    pendingBurns: 0
  });
  
  // Refs for state detection
  const observerRef = useRef(null);
  const stateCheckInterval = useRef(null);
  const rafRef = useRef(null);
  
  // Load tutorial completion status
  useEffect(() => {
    const completed = localStorage.getItem('burnwise_tutorial_completed');
    const skipTutorial = localStorage.getItem('burnwise_tutorial_skip');
    
    // Auto-start for new users unless they've completed or skipped
    if (!completed && !skipTutorial && user && !isActive) {
      // Wait 3 seconds after login before showing
      setTimeout(() => {
        if (!localStorage.getItem('burnwise_tutorial_skip')) {
          startTutorial();
        }
      }, 3000);
    }
  }, [user]);
  
  // Fetch dynamic data for tutorial
  const fetchTutorialData = async () => {
    try {
      const data = {};
      
      // Get farm data
      if (farms && farms.length > 0) {
        data.farmCount = farms.length;
        data.nearestFarm = farms[0]?.name || 'Golden Fields Farm';
        data.farmsVisible = farms.filter(f => f.visible).length;
      }
      
      // Get weather data
      try {
        const weatherResponse = await axios.get('/api/weather/current', {
          params: { lat: 38.544, lon: -121.740 }
        });
        if (weatherResponse.data?.data) {
          data.temperature = Math.round(weatherResponse.data.data.main?.temp || 75);
          data.windSpeed = weatherResponse.data.data.wind?.speed > 10 ? 'strong' : 'light';
        }
      } catch (err) {
        // Use defaults if weather fails
        data.temperature = 75;
        data.windSpeed = 'light';
      }
      
      // Get burn data
      try {
        const burnsResponse = await axios.get('/api/burn-requests');
        if (burnsResponse.data?.requests) {
          data.activeBurns = burnsResponse.data.requests.filter(b => b.status === 'in_progress').length;
          data.pendingBurns = burnsResponse.data.requests.filter(b => b.status === 'pending').length;
        }
      } catch (err) {
        data.activeBurns = 0;
        data.pendingBurns = 0;
      }
      
      // User data
      data.userName = user?.name || 'Farmer';
      data.suggestedAcres = Math.floor(Math.random() * 100) + 50;
      data.suggestedTime = ['tomorrow morning', 'this afternoon', 'next week'][Math.floor(Math.random() * 3)];
      
      setTutorialData(data);
    } catch (error) {
      console.error('Failed to fetch tutorial data:', error);
    }
  };
  
  // Monitor application state
  const monitorAppState = useCallback(() => {
    setAppState(prevState => {
      const newState = {};
      
      // Check if farm popup is open
      newState.farmPopupOpen = !!document.querySelector('.mapboxgl-popup');
      
      // Check if AI chat is open
      newState.aiChatOpen = !!document.querySelector('.floating-ai-container:not(.minimized)');
      
      // Check if messages were sent
      const messageElements = document.querySelectorAll('.message-user');
      newState.messagesSent = messageElements.length > 0;
      
      // Check weather layer
      newState.weatherLayerActive = !!document.querySelector('[data-layer="weather"].active');
      
      // Check timeline usage
      const timelineElement = document.querySelector('.timeline-scrubber');
      if (timelineElement) {
        const currentValue = timelineElement.getAttribute('data-value');
        const defaultValue = timelineElement.getAttribute('data-default');
        newState.timelineUsed = currentValue !== defaultValue;
      }
      
      // Check burns panel
      newState.burnsPanelOpen = !!document.querySelector('.burns-panel:not(.hidden)');
      
      // Count visible farms
      newState.farmsVisible = document.querySelectorAll('.farm-marker').length;
      
      // Additional state from previous
      newState.activeBurns = prevState.activeBurns || 0;
      newState.pendingBurns = prevState.pendingBurns || 0;
      
      // Only update if something changed
      const hasChanges = Object.keys(newState).some(key => newState[key] !== prevState[key]);
      return hasChanges ? newState : prevState;
    });
  }, []);
  
  // Start monitoring when tutorial is active
  useEffect(() => {
    if (isActive) {
      // Fetch fresh data
      fetchTutorialData();
      
      // Start monitoring interval
      stateCheckInterval.current = setInterval(monitorAppState, 1000);
      
      // Set up mutation observer for DOM changes
      observerRef.current = new MutationObserver(() => {
        // Debounce mutation observer calls
        clearTimeout(rafRef.current);
        rafRef.current = setTimeout(monitorAppState, 100);
      });
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-layer', 'data-value']
      });
      
      return () => {
        if (stateCheckInterval.current) {
          clearInterval(stateCheckInterval.current);
        }
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        if (rafRef.current) {
          clearTimeout(rafRef.current);
        }
      };
    }
  }, [isActive, monitorAppState]);
  
  // Start tutorial
  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStep(0);
    setCompletedSteps(new Set());
    fetchTutorialData();
    
    // Emit event for components to listen
    window.dispatchEvent(new CustomEvent('tutorialStarted'));
  }, []);
  
  // End tutorial
  const endTutorial = useCallback(() => {
    setIsActive(false);
    localStorage.setItem('burnwise_tutorial_completed', 'true');
    
    // Emit event
    window.dispatchEvent(new CustomEvent('tutorialEnded'));
  }, []);
  
  // Skip tutorial
  const skipTutorial = useCallback(() => {
    setIsActive(false);
    localStorage.setItem('burnwise_tutorial_skip', 'true');
    
    // Emit event
    window.dispatchEvent(new CustomEvent('tutorialSkipped'));
  }, []);
  
  // Reset tutorial
  const resetTutorial = useCallback(() => {
    localStorage.removeItem('burnwise_tutorial_completed');
    localStorage.removeItem('burnwise_tutorial_skip');
    setCurrentStep(0);
    setCompletedSteps(new Set());
    startTutorial();
  }, [startTutorial]);
  
  // Navigate to next step
  const nextStep = useCallback(() => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStep);
    setCompletedSteps(newCompleted);
    
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      fetchTutorialData(); // Refresh data for new step
    } else {
      endTutorial();
    }
  }, [currentStep, completedSteps, endTutorial]);
  
  // Navigate to previous step
  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);
  
  // Jump to specific step
  const goToStep = useCallback((stepId) => {
    const stepIndex = TUTORIAL_STEPS.findIndex(s => s.id === stepId);
    if (stepIndex !== -1) {
      setCurrentStep(stepIndex);
      fetchTutorialData();
    }
  }, []);
  
  // Check step requirements and auto-advance
  useEffect(() => {
    if (!isActive) return;
    
    const step = TUTORIAL_STEPS[currentStep];
    if (step && step.requiredState && step.nextTrigger === 'action') {
      const requirementsMet = Object.keys(step.requiredState).every(
        key => appState[key] === step.requiredState[key]
      );
      
      if (requirementsMet && !completedSteps.has(currentStep)) {
        // Auto-advance to next step
        nextStep();
      }
    }
  }, [isActive, currentStep, appState, completedSteps, nextStep]);
  
  // Get current step with dynamic content
  const getCurrentStep = useCallback(() => {
    const step = TUTORIAL_STEPS[currentStep];
    if (!step) return null;
    
    return {
      ...step,
      content: typeof step.content === 'function' 
        ? step.content(tutorialData) 
        : step.content
    };
  }, [currentStep, tutorialData]);
  
  const value = {
    // State
    isActive,
    currentStep,
    totalSteps: TUTORIAL_STEPS.length,
    completedSteps,
    tutorialData,
    appState,
    isLoading,
    
    // Actions
    startTutorial,
    endTutorial,
    skipTutorial,
    resetTutorial,
    nextStep,
    previousStep,
    goToStep,
    
    // Getters
    getCurrentStep,
    isCompleted: localStorage.getItem('burnwise_tutorial_completed') === 'true',
    wasSkipped: localStorage.getItem('burnwise_tutorial_skip') === 'true'
  };
  
  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

export default TutorialContext;