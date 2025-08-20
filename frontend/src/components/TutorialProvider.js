import React, { useState, useEffect, useContext, createContext } from 'react';
import Joyride, { STATUS, EVENTS, ACTIONS } from 'react-joyride';

// Create tutorial context
const TutorialContext = createContext();

// Tutorial steps for different demo modes
const tutorialSteps = {
  blank: [
    {
      target: 'body',
      content: (
        <div>
          <h2>Welcome to BURNWISE!</h2>
          <p>You've chosen the <strong>Blank Slate</strong> experience. This guided tour will help you explore the revolutionary spatial interface.</p>
          <p>The map IS the application - no traditional navigation needed!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
      styles: {
        options: {
          zIndex: 10000,
        }
      }
    },
    {
      target: '.spatial-map',
      content: (
        <div>
          <h3>Your Command Center</h3>
          <p>This 3D map is your farm's command center. Everything happens here:</p>
          <ul>
            <li>Click farms to see details</li>
            <li>Drag to create burn zones</li>
            <li>Hover for real-time statistics</li>
          </ul>
        </div>
      ),
      placement: 'center',
      spotlightClicks: true
    },
    {
      target: '[data-dock-item="ai"]',
      content: (
        <div>
          <h3>Your AI Assistant</h3>
          <p>Click this flame icon to open your AI assistant powered by <strong>real GPT-5</strong>.</p>
          <p>Try saying: <em>"I need to burn 50 acres of wheat stubble next week"</em></p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true
    },
    {
      target: '.timeline-scrubber',
      content: (
        <div>
          <h3>Time Travel</h3>
          <p>Scrub through time like video editing! View:</p>
          <ul>
            <li>Past burn history</li>
            <li>Current active burns</li>
            <li>Future scheduled burns</li>
          </ul>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true
    },
    {
      target: '[data-dock-item="map"]',
      content: (
        <div>
          <h3>Map Controls</h3>
          <p>Access map layers, 3D controls, and visualization options.</p>
          <p>Try switching between satellite and terrain views!</p>
        </div>
      ),
      placement: 'top'
    },
    {
      target: '.dock-navigation',
      content: (
        <div>
          <h3>Everything You Need</h3>
          <p>This dock contains all essential tools:</p>
          <ul>
            <li><strong>Map:</strong> Layer controls & 3D settings</li>
            <li><strong>AI:</strong> Conversational burn planning</li>
            <li><strong>Burns:</strong> Active burn monitoring</li>
            <li><strong>Settings:</strong> Preferences & account</li>
          </ul>
          <p>Ready to create your first burn request with AI?</p>
        </div>
      ),
      placement: 'top'
    }
  ],

  preloaded: [
    {
      target: 'body',
      content: (
        <div>
          <h2>Welcome to Your Sample Farm!</h2>
          <p>You've chosen the <strong>Sample Farm</strong> experience with pre-loaded data.</p>
          <p>Explore active burns, conflict scenarios, and AI conversations!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true
    },
    {
      target: '.demo-banner',
      content: (
        <div>
          <h3>Sample Data Active</h3>
          <p>You're viewing realistic sample data including:</p>
          <ul>
            <li>3 burn requests at different stages</li>
            <li>5 nearby farms for conflict detection</li>
            <li>Historical weather patterns</li>
            <li>Real AI agent conversations</li>
          </ul>
          <p>Feel free to modify anything - it's all isolated demo data!</p>
        </div>
      ),
      placement: 'bottom'
    },
    {
      target: '.active-burn-marker',
      content: (
        <div>
          <h3>Active Burns</h3>
          <p>These markers show burns at different stages:</p>
          <ul>
            <li><strong>Green:</strong> Approved & scheduled</li>
            <li><strong>Yellow:</strong> Pending review</li>
            <li><strong>Red:</strong> Conflict detected</li>
          </ul>
          <p>Click any marker to see detailed information!</p>
        </div>
      ),
      placement: 'left',
      spotlightClicks: true
    },
    {
      target: '.nearby-farm-marker',
      content: (
        <div>
          <h3>Nearby Farms</h3>
          <p>See how BURNWISE prevents conflicts with neighboring farms.</p>
          <p>The system uses <strong>real TiDB vector search</strong> to detect potential smoke conflicts based on:</p>
          <ul>
            <li>Wind patterns</li>
            <li>Distance & direction</li>
            <li>Terrain features</li>
          </ul>
        </div>
      ),
      placement: 'right'
    },
    {
      target: '.timeline-scrubber',
      content: (
        <div>
          <h3>Temporal Navigation</h3>
          <p>Scrub through time to see the full story:</p>
          <ul>
            <li><strong>Past:</strong> Completed burns with outcomes</li>
            <li><strong>Present:</strong> Active monitoring</li>
            <li><strong>Future:</strong> Scheduled burns & predictions</li>
          </ul>
          <p>Try dragging the timeline slider!</p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true
    },
    {
      target: '[data-dock-item="ai"]',
      content: (
        <div>
          <h3>AI Conversation History</h3>
          <p>Open the AI assistant to see previous conversations.</p>
          <p>The system has already processed several burn requests using <strong>real GPT-5 agents</strong>!</p>
          <p>Try asking: <em>"What's the status of my rice straw burn?"</em></p>
        </div>
      ),
      placement: 'top',
      spotlightClicks: true
    },
    {
      target: '[data-dock-item="burns"]',
      content: (
        <div>
          <h3>Active Monitoring</h3>
          <p>View all your burns in one place:</p>
          <ul>
            <li>Real-time status updates</li>
            <li>Weather impact analysis</li>
            <li>Conflict resolution progress</li>
          </ul>
          <p>The proactive monitoring agent runs 24/7!</p>
        </div>
      ),
      placement: 'top'
    },
    {
      target: 'body',
      content: (
        <div>
          <h2>Ready to Explore!</h2>
          <p>Your sample farm is ready to explore. Key features:</p>
          <ul>
            <li><strong>Real Infrastructure:</strong> TiDB database & GPT-5 agents</li>
            <li><strong>Live Data:</strong> All changes are saved and processed</li>
            <li><strong>Safe Environment:</strong> Everything auto-deletes in 24 hours</li>
          </ul>
          <p>Go ahead - click anything, ask the AI questions, and explore!</p>
        </div>
      ),
      placement: 'center'
    }
  ]
};

// Tutorial Provider Component
export const TutorialProvider = ({ children, demoMode, demoSession }) => {
  const [runTour, setRunTour] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);

  const steps = tutorialSteps[demoMode] || [];

  // Check tutorial progress on mount
  useEffect(() => {
    const checkTutorialProgress = async () => {
      if (!demoSession?.sessionId) return;

      try {
        const response = await fetch(`/api/demo/status?sessionId=${demoSession.sessionId}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          const tutorialProgress = data.tutorialProgress || {};

          if (tutorialProgress.completed) {
            setTutorialCompleted(true);
          } else {
            // Start tutorial after a brief delay for UI to settle
            setTimeout(() => {
              setRunTour(true);
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Failed to check tutorial progress:', error);
        // Start tutorial anyway
        setTimeout(() => {
          setRunTour(true);
        }, 2000);
      }
    };

    if (demoMode && steps.length > 0) {
      checkTutorialProgress();
    }
  }, [demoMode, demoSession, steps.length]);

  // Handle tutorial events
  const handleJoyrideCallback = async (data) => {
    const { action, index, status, type } = data;

    console.log('Tutorial event:', { action, index, status, type });

    // Update step index
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    // Handle tour completion
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false);
      setTutorialCompleted(true);

      // Save completion to backend
      try {
        await fetch('/api/demo/tutorial-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ 
            sessionId: demoSession?.sessionId,
            completed: true,
            skipped: status === STATUS.SKIPPED,
            finalStep: index,
            totalSteps: steps.length
          })
        });
      } catch (error) {
        console.error('Failed to save tutorial completion:', error);
      }
    }
  };

  // Manual tutorial controls
  const startTutorial = () => {
    setStepIndex(0);
    setRunTour(true);
    setTutorialCompleted(false);
  };

  const skipTutorial = () => {
    setRunTour(false);
    setTutorialCompleted(true);
    handleJoyrideCallback({ status: STATUS.SKIPPED, index: stepIndex });
  };

  const resetTutorial = () => {
    setStepIndex(0);
    setRunTour(false);
    setTutorialCompleted(false);
  };

  // Tutorial context value
  const tutorialValue = {
    isRunning: runTour,
    isCompleted: tutorialCompleted,
    currentStep: stepIndex,
    totalSteps: steps.length,
    demoMode,
    startTutorial,
    skipTutorial,
    resetTutorial
  };

  return (
    <TutorialContext.Provider value={tutorialValue}>
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        run={runTour}
        stepIndex={stepIndex}
        steps={steps}
        showProgress
        showSkipButton
        disableOverlayClose={false}
        disableCloseOnEsc={false}
        styles={{
          options: {
            primaryColor: '#FF6B35',
            backgroundColor: '#1E1E1E',
            textColor: '#FFFFFF',
            overlayColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 10000,
            arrowColor: '#1E1E1E',
            beaconSize: 36,
          },
          tooltip: {
            backgroundColor: '#1E1E1E',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            fontSize: '16px',
            lineHeight: '1.5'
          },
          tooltipContainer: {
            textAlign: 'left'
          },
          tooltipTitle: {
            color: '#FFFFFF',
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '8px'
          },
          tooltipContent: {
            color: '#FFFFFF',
            padding: '0'
          },
          buttonNext: {
            backgroundColor: '#FF6B35',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            color: '#FFFFFF'
          },
          buttonPrev: {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            color: '#FFFFFF',
            marginRight: '12px'
          },
          buttonSkip: {
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '14px',
            padding: '10px 16px'
          },
          beacon: {
            backgroundColor: '#FF6B35',
            border: '3px solid rgba(255, 107, 53, 0.3)',
            borderRadius: '50%'
          },
          beaconInner: {
            backgroundColor: '#FF6B35'
          },
          spotlight: {
            borderRadius: '8px'
          }
        }}
        locale={{
          back: 'Previous',
          close: 'Close',
          last: 'Finish Tour',
          next: 'Next',
          skip: 'Skip Tour',
          open: 'Open'
        }}
      />
      {children}
    </TutorialContext.Provider>
  );
};

// Hook to use tutorial context
export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
};

// Tutorial Control Panel Component (for testing/admin)
export const TutorialControls = () => {
  const tutorial = useTutorial();

  if (!tutorial.demoMode) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(30, 30, 30, 0.9)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      padding: '12px',
      zIndex: 9999,
      fontSize: '12px',
      color: '#FFFFFF'
    }}>
      <div style={{ marginBottom: '8px' }}>
        Tutorial: {tutorial.isCompleted ? 'Completed' : tutorial.isRunning ? 'Running' : 'Ready'}
      </div>
      <div style={{ marginBottom: '8px' }}>
        Step: {tutorial.currentStep + 1} / {tutorial.totalSteps}
      </div>
      <div>
        <button onClick={tutorial.startTutorial} style={{ marginRight: '4px' }}>Start</button>
        <button onClick={tutorial.skipTutorial} style={{ marginRight: '4px' }}>Skip</button>
        <button onClick={tutorial.resetTutorial}>Reset</button>
      </div>
    </div>
  );
};

export default TutorialProvider;