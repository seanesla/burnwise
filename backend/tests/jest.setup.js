// Jest setup for BURNWISE test suite
// Configure test environment for life-critical burn coordination testing

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.LOG_LEVEL = 'error'; // Reduce noise during tests

// NO MOCKING - Real tests only as per requirements

// Set longer timeout for database operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  // Generate random coordinates within California
  randomCoordinates: () => ({
    lat: 32 + Math.random() * 10,
    lon: -124 + Math.random() * 10
  }),
  
  // Generate valid GeoJSON polygon
  createPolygon: (center, size = 0.01) => ({
    type: 'Polygon',
    coordinates: [[
      [center[0] - size, center[1] - size],
      [center[0] + size, center[1] - size],
      [center[0] + size, center[1] + size],
      [center[0] - size, center[1] + size],
      [center[0] - size, center[1] - size]
    ]]
  }),
  
  // Generate burn request data
  createBurnRequest: (overrides = {}) => ({
    farmId: 1,
    fieldGeometry: global.testUtils.createPolygon([-120, 40]),
    requestedDate: '2025-08-25',
    requestedStartTime: '09:00',
    requestedEndTime: '15:00',
    burnType: 'prescribed',
    purpose: 'Test burn',
    elevationMeters: 250,
    terrainSlope: 15,
    fuelLoadTonsPerHectare: 20,
    ...overrides
  }),
  
  // Generate weather data
  createWeatherData: (overrides = {}) => ({
    temperature: 25,
    humidity: 60,
    windSpeed: 10,
    windDirection: 180,
    pressure: 1013,
    visibility: 10,
    cloudCover: 30,
    ...overrides
  }),
  
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Check if value is within range
  isInRange: (value, min, max) => value >= min && value <= max
};

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging failures
    error: console.error
  };
}

// Clean up after tests
afterAll(async () => {
  // Close database connections
  const { closePool } = require('../db/connection');
  if (closePool) {
    await closePool();
  }
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset modules
  jest.resetModules();
  
  // Wait for pending operations
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection in test:', error);
  throw error;
});

// Custom matchers
expect.extend({
  toBeValidVector(received, expectedLength) {
    const pass = Array.isArray(received) &&
                 received.length === expectedLength &&
                 received.every(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ${expectedLength}-dimensional vector`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid ${expectedLength}-dimensional vector`,
        pass: false
      };
    }
  },
  
  toBeSafeConcentration(received) {
    const pass = typeof received === 'number' && received < 35;
    
    if (pass) {
      return {
        message: () => `expected ${received} µg/m³ not to be a safe PM2.5 concentration`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} µg/m³ to be a safe PM2.5 concentration (<35 µg/m³)`,
        pass: false
      };
    }
  },
  
  toBeValidGeoJSON(received) {
    const pass = received &&
                 received.type &&
                 received.coordinates &&
                 Array.isArray(received.coordinates);
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be valid GeoJSON`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be valid GeoJSON`,
        pass: false
      };
    }
  }
});