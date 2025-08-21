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

// Tutorial steps configuration - complete AI agent workflow
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Burnwise',
    targetSelector: null,
    position: 'center',
    content: (data) => `Welcome to Burnwise! Let's walk through creating a real burn request using our 5-agent AI system. You're managing ${data.farmCount || 'multiple'} farms with autonomous coordination.`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false
  },
  {
    id: 'spatial-interface',
    title: 'Your Spatial Command Center',
    targetSelector: '.mapboxgl-canvas',
    position: 'center',
    content: (data) => `This map IS your entire application. No menus, no pages - just direct spatial interaction. ${data.farmsVisible ? `You can see ${data.farmsVisible} farms ready for management.` : 'Let\'s explore your farms.'}`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false
  },
  {
    id: 'select-farm',
    title: 'Step 1: Select Your Farm',
    targetSelector: '.farm-marker',
    position: 'top',
    content: (data) => `Click on ${data.nearestFarm || 'any farm marker'} to begin your burn request. This will be the farm we'll schedule a burn for.`,
    action: 'click-farm',
    nextTrigger: 'action',
    requiredState: { farmPopupOpen: true },
    waitingContent: 'Waiting for you to click a farm...',
    canSkipStep: false
  },
  {
    id: 'open-ai-chat',
    title: 'Step 2: Open AI Assistant',
    targetSelector: '[data-dock-item="ai"]',
    position: 'top',
    content: () => 'Now click the AI Assistant button in the dock. This activates our 5-agent system.',
    action: 'open-ai',
    nextTrigger: 'action',
    requiredState: { aiChatOpen: true },
    waitingContent: 'Click the AI Assistant button to continue...',
    canSkipStep: false
  },
  {
    id: 'burn-request-agent',
    title: 'Step 3: BurnRequestAgent',
    targetSelector: '.floating-ai-input textarea',
    position: 'top',
    content: (data) => `Type this burn request: "I need to burn ${data.suggestedAcres || 100} acres ${data.suggestedTime || 'tomorrow morning'} on my wheat field"`,
    action: 'send-message',
    nextTrigger: 'action',
    requiredState: { messagesSent: true },
    waitingContent: 'Type and send your burn request...',
    canSkipStep: false,
    agentHighlight: 'BurnRequestAgent'
  },
  {
    id: 'agent-processing',
    title: 'AI Agents Processing',
    targetSelector: '.agent-indicator',
    position: 'top',
    content: () => 'Watch the agent indicator! BurnRequestAgent is extracting structured data from your natural language request.',
    action: 'observe-agents',
    nextTrigger: 'action',
    requiredState: { agentResponseReceived: true },
    waitingContent: 'Agents are processing your request...',
    canSkipStep: false,
    agentHighlight: 'BurnRequestAgent'
  },
  {
    id: 'weather-analyst',
    title: 'Step 4: WeatherAnalyst Agent',
    targetSelector: '[data-layer="weather"]',
    position: 'right',
    content: (data) => `Click to toggle the weather overlay. WeatherAnalyst is checking conditions: ${data.temperature || '75'}°F, ${data.windSpeed || 'light'} winds, ${data.humidity || '45'}% humidity.`,
    action: 'toggle-weather',
    nextTrigger: 'action',
    requiredState: { weatherLayerActive: true },
    waitingContent: 'Toggle the weather layer to see analysis...',
    canSkipStep: false,
    agentHighlight: 'WeatherAnalyst'
  },
  {
    id: 'weather-decision',
    title: 'Weather Safety Decision',
    targetSelector: '.weather-status',
    position: 'auto',
    content: (data) => `WeatherAnalyst has determined conditions are ${data.weatherStatus || 'SAFE'} for burning. This autonomous decision considers wind, humidity, and fire danger.`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false,
    agentHighlight: 'WeatherAnalyst'
  },
  {
    id: 'conflict-resolver',
    title: 'Step 5: ConflictResolver Agent',
    targetSelector: '.conflict-indicator',
    position: 'auto',
    content: () => 'ConflictResolver is checking for conflicts with neighboring farms using TiDB vector search on smoke plume predictions.',
    action: 'check-conflicts',
    nextTrigger: 'action',
    requiredState: { conflictsChecked: true },
    waitingContent: 'Analyzing potential smoke conflicts...',
    canSkipStep: false,
    agentHighlight: 'ConflictResolver'
  },
  {
    id: 'timeline-scheduling',
    title: 'Step 6: View Schedule Timeline',
    targetSelector: '.timeline-scrubber',
    position: 'top',
    content: (data) => `Drag the timeline scrubber to see when your burn fits in. ${data.activeBurns ? `${data.activeBurns} burns are currently scheduled.` : 'Your burn will be optimally scheduled.'}`,
    action: 'use-timeline',
    nextTrigger: 'action',
    requiredState: { timelineUsed: true },
    waitingContent: 'Drag the timeline to explore burn schedules...',
    canSkipStep: false
  },
  {
    id: 'schedule-optimizer',
    title: 'Step 7: ScheduleOptimizer Agent',
    targetSelector: '.schedule-suggestion',
    position: 'auto',
    content: () => 'ScheduleOptimizer is using simulated annealing to find the optimal burn window considering weather, conflicts, and farm priorities.',
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false,
    agentHighlight: 'ScheduleOptimizer'
  },
  {
    id: 'human-approval',
    title: 'Step 8: Human-in-the-Loop',
    targetSelector: '.approval-modal',
    position: 'center',
    content: () => 'Critical burn decisions require your approval. Review the AI recommendations and approve or modify the burn plan.',
    action: 'approve-burn',
    nextTrigger: 'action',
    requiredState: { burnApproved: true },
    waitingContent: 'Review and approve the burn request...',
    canSkipStep: false
  },
  {
    id: 'burns-panel',
    title: 'Step 9: Monitor Active Burns',
    targetSelector: '[data-dock-item="burns"]',
    position: 'top',
    content: (data) => `Click the Active Burns icon to see your scheduled burn. ${data.pendingBurns ? `You have ${data.pendingBurns} burns in the queue.` : 'Your burn is now scheduled!'}`,
    action: 'open-burns',
    nextTrigger: 'action',
    requiredState: { burnsPanelOpen: true },
    waitingContent: 'Open the Active Burns panel...',
    canSkipStep: false
  },
  {
    id: 'proactive-monitor',
    title: 'Step 10: ProactiveMonitor Agent',
    targetSelector: '.monitoring-indicator',
    position: 'auto',
    content: () => 'ProactiveMonitor will autonomously watch your burn 24/7, alerting you to weather changes or safety concerns without being asked.',
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false,
    agentHighlight: 'ProactiveMonitor'
  },
  {
    id: 'complete-workflow',
    title: 'Workflow Complete!',
    targetSelector: null,
    position: 'center',
    content: (data) => `Congratulations ${data.userName || 'Farmer'}! You've successfully created a burn request using all 5 AI agents. Your burn is scheduled and monitored autonomously.`,
    action: null,
    nextTrigger: 'manual',
    requiredState: null,
    canSkipStep: false
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
    agentResponseReceived: false,
    weatherLayerActive: false,
    weatherStatus: 'SAFE',
    conflictsChecked: false,
    timelineUsed: false,
    burnApproved: false,
    burnsPanelOpen: false,
    farmsVisible: 0,
    activeBurns: 0,
    pendingBurns: 0,
    humidity: 45
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
    // Check if farm popup is open
    const farmPopupOpen = !!document.querySelector('.mapboxgl-popup');
    
    // Check if AI chat is open
    const aiChatOpen = !!document.querySelector('.floating-ai-container:not(.minimized)');
    
    // Check if messages were sent
    const messageElements = document.querySelectorAll('.message-user');
    const messagesSent = messageElements.length > 0;
    
    // Check if agent response received
    const agentMessages = document.querySelectorAll('.message-agent');
    const agentResponseReceived = agentMessages.length > 0;
    
    // Check weather layer
    const weatherLayerActive = !!document.querySelector('[data-layer="weather"].active');
    
    // Check timeline usage
    let timelineUsed = false;
    const timelineElement = document.querySelector('.timeline-scrubber');
    if (timelineElement) {
      const currentValue = timelineElement.getAttribute('data-value');
      const defaultValue = timelineElement.getAttribute('data-default');
      timelineUsed = currentValue !== defaultValue;
    }
    
    // Check burns panel
    const burnsPanelOpen = !!document.querySelector('.burns-panel:not(.hidden)');
    
    // Check if conflicts were checked
    const conflictsChecked = !!document.querySelector('.conflicts-checked') || 
                              !!document.querySelector('[data-conflicts="checked"]');
    
    // Check if burn was approved
    const burnApproved = !!document.querySelector('.burn-approved') || 
                          !!document.querySelector('[data-burn="approved"]');
    
    // Count visible farms
    const farmsVisible = document.querySelectorAll('.farm-marker').length;
    
    setAppState(prevState => {
      const newState = {
        farmPopupOpen,
        aiChatOpen,
        messagesSent,
        agentResponseReceived,
        weatherLayerActive,
        timelineUsed,
        burnsPanelOpen,
        conflictsChecked,
        burnApproved,
        farmsVisible,
        activeBurns: prevState.activeBurns || 0,
        pendingBurns: prevState.pendingBurns || 0,
        weatherStatus: prevState.weatherStatus || 'SAFE',
        humidity: prevState.humidity || 45
      };
      
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
      // Debounce data fetch to prevent rapid calls
      setTimeout(() => {
        fetchTutorialData();
      }, 100);
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
        // Delay auto-advance to prevent race conditions
        const timer = setTimeout(() => {
          nextStep();
        }, 500);
        return () => clearTimeout(timer);
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