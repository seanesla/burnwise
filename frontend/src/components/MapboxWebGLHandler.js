import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaExclamationTriangle, FaSync } from 'react-icons/fa';
import LoadingSpinner from './LoadingSpinner';

/**
 * Higher-order component to handle WebGL context lost errors in Mapbox
 * Provides automatic recovery and user feedback
 */
const MapboxWebGLHandler = ({ children, onContextLost, onContextRestored }) => {
  const [contextLost, setContextLost] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const canvasRef = useRef(null);
  const maxRetries = 3;

  // Function to check WebGL availability
  const checkWebGLSupport = useCallback(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || 
                 canvas.getContext('webgl') || 
                 canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.error('WebGL not supported');
        return false;
      }
      
      // Check if context is lost
      if (gl.isContextLost && gl.isContextLost()) {
        console.warn('WebGL context is lost');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking WebGL support:', error);
      return false;
    }
  }, []);

  // Handle WebGL context lost
  const handleContextLost = useCallback((event) => {
    console.warn('WebGL context lost detected');
    if (event) {
      event.preventDefault(); // Prevent default browser behavior
    }
    
    setContextLost(true);
    setRecovering(false);
    
    if (onContextLost) {
      onContextLost();
    }
    
    // Auto-retry after a delay
    if (retryCount < maxRetries) {
      setTimeout(() => {
        handleRestore();
      }, 2000 + (retryCount * 1000)); // Incremental backoff
    }
  }, [retryCount, onContextLost]);

  // Handle WebGL context restored
  const handleContextRestored = useCallback(() => {
    console.log('WebGL context restored');
    setContextLost(false);
    setRecovering(false);
    setRetryCount(0);
    
    if (onContextRestored) {
      onContextRestored();
    }
  }, [onContextRestored]);

  // Attempt to restore WebGL context
  const handleRestore = useCallback(() => {
    console.log('Attempting to restore WebGL context...');
    setRecovering(true);
    setRetryCount(prev => prev + 1);
    
    // Check if WebGL is available
    if (checkWebGLSupport()) {
      // Force a page reload if context can be restored
      handleContextRestored();
      
      // Optionally reload the map component
      if (window.mapboxgl && window.mapboxgl.Map) {
        // Trigger map reload by updating key or re-mounting
        window.location.reload();
      }
    } else {
      // Context still lost, will retry if under max retries
      setRecovering(false);
      
      if (retryCount >= maxRetries - 1) {
        console.error('Max retries reached. Unable to restore WebGL context.');
      }
    }
  }, [checkWebGLSupport, handleContextRestored, retryCount]);

  // Set up WebGL context event listeners
  useEffect(() => {
    const setupContextListeners = () => {
      const canvases = document.querySelectorAll('canvas');
      
      canvases.forEach(canvas => {
        // Add context lost listener
        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        
        // Add context restored listener
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
        
        // Store reference for cleanup
        if (!canvasRef.current) {
          canvasRef.current = canvas;
        }
      });
    };

    // Setup listeners after a delay to ensure map is loaded
    const timeoutId = setTimeout(setupContextListeners, 1000);
    
    // Also check WebGL support on mount
    if (!checkWebGLSupport()) {
      handleContextLost();
    }
    
    // Monitor for new canvases (in case map recreates them)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'CANVAS') {
            node.addEventListener('webglcontextlost', handleContextLost, false);
            node.addEventListener('webglcontextrestored', handleContextRestored, false);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
      
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      });
    };
  }, [handleContextLost, handleContextRestored, checkWebGLSupport]);

  // Monitor GPU memory pressure
  useEffect(() => {
    const checkMemoryPressure = () => {
      if (performance.memory && performance.memory.usedJSHeapSize) {
        const usedMemory = performance.memory.usedJSHeapSize;
        const limitMemory = performance.memory.jsHeapSizeLimit;
        const memoryUsagePercent = (usedMemory / limitMemory) * 100;
        
        if (memoryUsagePercent > 90) {
          console.warn(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
          
          // Clear Mapbox caches if available
          if (window.mapboxgl) {
            window.mapboxgl.clearStorage();
            window.mapboxgl.clearPrewarmedResources();
          }
        }
      }
    };
    
    const intervalId = setInterval(checkMemoryPressure, 30000); // Check every 30 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Render error state if context is lost
  if (contextLost) {
    return (
      <div className="webgl-error-container">
        <div className="glass-card p-8 text-center max-w-md mx-auto mt-20">
          <FaExclamationTriangle className="text-fire-orange text-5xl mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Graphics Context Lost
          </h2>
          <p className="text-gray-400 mb-6">
            The map graphics context was lost. This can happen due to GPU memory pressure or driver issues.
          </p>
          
          {recovering ? (
            <div className="flex items-center justify-center gap-2">
              <LoadingSpinner size="small" />
              <span className="text-white">Recovering...</span>
            </div>
          ) : (
            <>
              {retryCount < maxRetries ? (
                <button
                  onClick={handleRestore}
                  className="btn-primary flex items-center gap-2 mx-auto"
                >
                  <FaSync />
                  Retry ({maxRetries - retryCount} attempts left)
                </button>
              ) : (
                <div>
                  <p className="text-red-400 mb-4">
                    Unable to restore graphics context after {maxRetries} attempts.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary flex items-center gap-2 mx-auto"
                  >
                    <FaSync />
                    Reload Page
                  </button>
                </div>
              )}
            </>
          )}
          
          <div className="mt-6 text-sm text-gray-500">
            <p>Retry attempt: {retryCount}/{maxRetries}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render children (the map component) normally
  return <>{children}</>;
};

export default MapboxWebGLHandler;