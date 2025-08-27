import { useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * Performance optimization utilities for React components
 */

/**
 * Custom hook for debouncing values
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for throttling function calls
 */
export function useThrottle(callback, delay = 100) {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef();

  return useCallback((...args) => {
    const now = Date.now();
    
    if (now - lastRun.current >= delay) {
      lastRun.current = now;
      callback(...args);
    } else {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callback(...args);
      }, delay - (now - lastRun.current));
    }
  }, [callback, delay]);
}

/**
 * Custom hook for lazy loading components with intersection observer
 */
export function useLazyLoad(ref, rootMargin = '100px') {
  const [isIntersecting, setIntersecting] = React.useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIntersecting(entry.isIntersecting);
      },
      { rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, rootMargin]);

  return isIntersecting;
}

/**
 * Custom hook for virtual scrolling
 */
export function useVirtualScroll(items, containerHeight, itemHeight, buffer = 5) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer
    );

    return {
      items: items.slice(startIndex, endIndex + 1),
      startIndex,
      endIndex,
      offsetY: startIndex * itemHeight
    };
  }, [items, scrollTop, containerHeight, itemHeight, buffer]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return { visibleItems, handleScroll, totalHeight: items.length * itemHeight };
}

/**
 * Custom hook for request animation frame
 */
export function useAnimationFrame(callback) {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = useCallback((time) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);
}

/**
 * Memoized selector for complex computations
 */
export function createSelector(...funcs) {
  const resultFunc = funcs.pop();
  const dependencies = Array.isArray(funcs[0]) ? funcs[0] : funcs;

  let lastArgs = [];
  let lastResult = null;

  return (...args) => {
    const currentArgs = dependencies.map(dep => dep(...args));
    
    if (!shallowEqual(currentArgs, lastArgs)) {
      lastArgs = currentArgs;
      lastResult = resultFunc(...currentArgs);
    }

    return lastResult;
  };
}

/**
 * Shallow equality check
 */
function shallowEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  
  return true;
}

/**
 * Batch state updates
 */
export function batchUpdates(callback) {
  if (typeof ReactDOM !== 'undefined' && ReactDOM.unstable_batchedUpdates) {
    ReactDOM.unstable_batchedUpdates(callback);
  } else {
    callback();
  }
}

/**
 * Performance monitoring HOC
 */
export function withPerformanceMonitor(Component, componentName) {
  return React.memo((props) => {
    const renderCount = useRef(0);
    const renderStartTime = useRef();

    useEffect(() => {
      renderCount.current++;
      const renderTime = performance.now() - renderStartTime.current;
      
      if (renderTime > 16) { // Log slow renders (> 16ms)
        console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    });

    renderStartTime.current = performance.now();

    return <Component {...props} />;
  });
}

/**
 * Image lazy loading component
 */
export const LazyImage = React.memo(({ src, alt, placeholder, ...props }) => {
  const [imageSrc, setImageSrc] = React.useState(placeholder || '');
  const [imageRef, setImageRef] = React.useState();
  const isIntersecting = useLazyLoad(imageRef);

  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageSrc(src);
      };
    }
  }, [isIntersecting, src]);

  return (
    <img
      ref={setImageRef}
      src={imageSrc}
      alt={alt}
      {...props}
      loading="lazy"
    />
  );
});

/**
 * Prefetch data for better perceived performance
 */
export function prefetchData(url) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      document.head.appendChild(link);
    });
  }
}

/**
 * Web Worker utility for heavy computations
 */
export class ComputeWorker {
  constructor(workerFunction) {
    const code = workerFunction.toString();
    const blob = new Blob([`(${code})()`], { type: 'application/javascript' });
    this.worker = new Worker(URL.createObjectURL(blob));
  }

  compute(data) {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => resolve(e.data);
      this.worker.onerror = reject;
      this.worker.postMessage(data);
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

const React = require('react');
const ReactDOM = require('react-dom');

export default {
  useDebounce,
  useThrottle,
  useLazyLoad,
  useVirtualScroll,
  useAnimationFrame,
  createSelector,
  batchUpdates,
  withPerformanceMonitor,
  LazyImage,
  prefetchData,
  ComputeWorker
};