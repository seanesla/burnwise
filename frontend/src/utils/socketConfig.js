import io from 'socket.io-client';

/**
 * Centralized Socket.io configuration for optimized connections
 */

// Singleton socket instance
let socketInstance = null;

// Socket configuration
const SOCKET_CONFIG = {
  // Use environment variable or fallback
  url: process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001',
  
  // Optimized connection options
  options: {
    // Transport options
    transports: ['websocket'], // Prefer WebSocket for lower latency
    upgrade: true, // Allow upgrade from polling to websocket
    
    // Reconnection strategy
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    
    // Timeout settings
    timeout: 20000,
    
    // Performance options
    forceNew: false, // Reuse connections
    multiplex: true, // Share single connection
    
    // Authentication
    withCredentials: true,
    
    // Parser options
    parser: require('socket.io-parser'),
    
    // Path
    path: '/socket.io/',
    
    // Query parameters
    query: {
      client: 'web',
      version: '1.0.0'
    }
  }
};

/**
 * Get or create socket instance
 */
export function getSocket() {
  if (!socketInstance) {
    socketInstance = createSocket();
  }
  return socketInstance;
}

/**
 * Create new socket connection
 */
function createSocket() {
  const socket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
  
  // Add connection event handlers
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    // Store connection time for latency tracking
    socket.connectedAt = Date.now();
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
    // Clean up connection time
    delete socket.connectedAt;
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
    
    // Implement exponential backoff for reconnection
    if (socket.io.reconnectionAttempts > 5) {
      socket.io.reconnectionDelay = Math.min(
        socket.io.reconnectionDelay * 2,
        30000
      );
    }
  });
  
  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket reconnected after', attemptNumber, 'attempts');
    // Reset reconnection delay on successful reconnect
    socket.io.reconnectionDelay = SOCKET_CONFIG.options.reconnectionDelay;
  });
  
  // Add ping/pong for latency measurement
  socket.on('pong', (latency) => {
    socket.latency = latency;
  });
  
  return socket;
}

/**
 * Socket event manager for better performance
 */
export class SocketEventManager {
  constructor(socket = null) {
    this.socket = socket || getSocket();
    this.listeners = new Map();
    this.subscriptions = new Set();
  }
  
  /**
   * Subscribe to event with automatic cleanup
   */
  subscribe(event, handler) {
    // Wrap handler for performance tracking
    const wrappedHandler = (...args) => {
      const startTime = performance.now();
      handler(...args);
      const duration = performance.now() - startTime;
      
      // Warn about slow handlers
      if (duration > 16) {
        console.warn(`Slow socket handler for ${event}: ${duration.toFixed(2)}ms`);
      }
    };
    
    this.socket.on(event, wrappedHandler);
    
    // Store for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(wrappedHandler);
    
    // Return unsubscribe function
    return () => this.unsubscribe(event, wrappedHandler);
  }
  
  /**
   * Unsubscribe from event
   */
  unsubscribe(event, handler) {
    this.socket.off(event, handler);
    
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
      
      if (this.listeners.get(event).size === 0) {
        this.listeners.delete(event);
      }
    }
  }
  
  /**
   * Emit event with acknowledgment timeout
   */
  emitWithTimeout(event, data, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Socket emit timeout for ${event}`));
      }, timeout);
      
      this.socket.emit(event, data, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }
  
  /**
   * Clean up all listeners
   */
  cleanup() {
    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.off(event, handler);
      }
    }
    this.listeners.clear();
  }
}

/**
 * React hook for socket connection
 */
export function useSocket(events = {}) {
  const [isConnected, setIsConnected] = React.useState(false);
  const [latency, setLatency] = React.useState(0);
  const managerRef = React.useRef(null);
  
  React.useEffect(() => {
    const manager = new SocketEventManager();
    managerRef.current = manager;
    
    // Track connection status
    const unsubConnect = manager.subscribe('connect', () => {
      setIsConnected(true);
    });
    
    const unsubDisconnect = manager.subscribe('disconnect', () => {
      setIsConnected(false);
    });
    
    // Track latency
    const unsubPong = manager.subscribe('pong', (latency) => {
      setLatency(latency);
    });
    
    // Subscribe to user events
    const unsubscribers = [];
    for (const [event, handler] of Object.entries(events)) {
      unsubscribers.push(manager.subscribe(event, handler));
    }
    
    // Check initial connection status
    setIsConnected(manager.socket.connected);
    
    // Cleanup
    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubPong();
      unsubscribers.forEach(unsub => unsub());
      manager.cleanup();
    };
  }, []);
  
  return {
    socket: managerRef.current?.socket,
    isConnected,
    latency,
    emit: (event, data) => managerRef.current?.socket.emit(event, data),
    emitWithTimeout: (event, data, timeout) => 
      managerRef.current?.emitWithTimeout(event, data, timeout)
  };
}

/**
 * Batch socket emissions for better performance
 */
export class SocketBatcher {
  constructor(socket, batchInterval = 100) {
    this.socket = socket || getSocket();
    this.batchInterval = batchInterval;
    this.batch = [];
    this.timer = null;
  }
  
  add(event, data) {
    this.batch.push({ event, data });
    
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }
  
  flush() {
    if (this.batch.length > 0) {
      this.socket.emit('batch', this.batch);
      this.batch = [];
    }
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

// Required React import
const React = require('react');

export default {
  getSocket,
  SocketEventManager,
  useSocket,
  SocketBatcher,
  SOCKET_CONFIG
};