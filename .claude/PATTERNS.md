# 📐 Burnwise Code Patterns & Conventions

## Naming Conventions

### Files
| Type | Pattern | Example |
|------|---------|---------|
| React Components | PascalCase | `BurnRequestForm.js` |
| Utilities | camelCase | `queryCache.js` |
| Test Files | `*.test.js` or `*.spec.js` | `coordinator.test.js` |
| Style Files | kebab-case | `mapbox-overrides.css` |
| Config Files | lowercase | `package.json` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES.js` |

### Variables & Functions
```javascript
// Constants
const MAX_BURN_ACRES = 500;
const API_TIMEOUT = 30000;

// Functions - camelCase, verb prefixes
function validateBurnRequest(request) { }
function fetchWeatherData(location) { }
function calculateEnergy(schedule) { }

// Boolean variables - is/has/should prefixes
const isValid = true;
const hasPermission = false;
const shouldRetry = true;

// React Components - PascalCase
function BurnRequestForm() { }
const MapVisualization = () => { };

// Event handlers - handle prefix
const handleSubmit = (e) => { };
const handleChange = (e) => { };
```

## React Patterns

### Component Structure
```javascript
// Standard functional component pattern
import React, { useState, useEffect } from 'react';
import './ComponentName.css';

function ComponentName({ prop1, prop2 }) {
  // State declarations
  const [state, setState] = useState(initialValue);
  
  // Effects
  useEffect(() => {
    // Side effects
    return () => {
      // Cleanup
    };
  }, [dependencies]);
  
  // Event handlers
  const handleEvent = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
}

export default ComponentName;
```

### Custom Hooks
```javascript
// hooks/useWeatherData.js
function useWeatherData(location) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Fetch logic
  }, [location]);
  
  return { data, loading, error };
}
```

### State Management
```javascript
// Complex state with useReducer
const initialState = {
  requests: [],
  loading: false,
  error: null
};

function reducer(state, action) {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, requests: action.payload };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
}
```

## Express/Node.js Patterns

### Route Handler Structure
```javascript
// api/endpoint.js
const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');

// GET /api/resource
router.get('/', async (req, res, next) => {
  try {
    const result = await service.getData();
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error); // Pass to error handler
  }
});

// POST /api/resource
router.post('/', validateRequest, async (req, res, next) => {
  try {
    const result = await service.createData(req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Middleware Pattern
```javascript
// middleware/auth.js
module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Error Handling
```javascript
// Global error handler
app.use((err, req, res, next) => {
  logger.error(err.stack);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    success: false,
    error: {
      message,
      status,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});
```

## Database Patterns

### Connection Pool Usage
```javascript
// Always use the pool, never create individual connections
const pool = require('../db/connection');

async function getDataById(id) {
  const query = 'SELECT * FROM table WHERE id = ?';
  const [rows] = await pool.execute(query, [id]);
  return rows[0];
}
```

### Transaction Pattern
```javascript
async function complexOperation(data) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const result1 = await connection.execute(query1, params1);
    const result2 = await connection.execute(query2, params2);
    
    await connection.commit();
    return { result1, result2 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

### Vector Operations
```javascript
// Store vector
async function storeWeatherVector(data, vector) {
  const query = `
    INSERT INTO weather_data (location, timestamp, weather_vector)
    VALUES (?, ?, ?)
  `;
  const vectorJson = JSON.stringify(vector);
  return await pool.execute(query, [data.location, data.timestamp, vectorJson]);
}

// Search similar vectors
async function findSimilarWeather(targetVector, limit = 10) {
  const query = `
    SELECT *, VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
    FROM weather_data
    ORDER BY similarity
    LIMIT ?
  `;
  const vectorJson = JSON.stringify(targetVector);
  return await pool.execute(query, [vectorJson, limit]);
}
```

## Agent System Patterns

### Agent Structure
```javascript
// agents/agentName.js
class AgentName {
  constructor(config) {
    this.config = config;
    this.initialize();
  }
  
  initialize() {
    // Setup logic
  }
  
  async process(input) {
    // Validate input
    this.validateInput(input);
    
    // Process logic
    const result = await this.performTask(input);
    
    // Return enriched output
    return this.enrichOutput(input, result);
  }
  
  validateInput(input) {
    // Validation logic
  }
  
  async performTask(input) {
    // Core agent logic
  }
  
  enrichOutput(input, result) {
    return {
      ...input,
      agentName: this.constructor.name,
      timestamp: new Date(),
      result
    };
  }
}

module.exports = AgentName;
```

### Agent Pipeline
```javascript
// Coordinator orchestration pattern
async function orchestrateWorkflow(request) {
  const pipeline = [
    weatherAgent,
    predictorAgent,
    optimizerAgent,
    alertsAgent
  ];
  
  let data = request;
  
  for (const agent of pipeline) {
    try {
      data = await agent.process(data);
      logger.info(`${agent.name} completed`, { data });
    } catch (error) {
      logger.error(`${agent.name} failed`, { error });
      throw error;
    }
  }
  
  return data;
}
```

## Testing Patterns

### Unit Test Structure
```javascript
// tests/unit/service.test.js
describe('ServiceName', () => {
  let service;
  
  beforeEach(() => {
    // Setup
    service = new ServiceName();
  });
  
  afterEach(() => {
    // Cleanup
    jest.clearAllMocks();
  });
  
  describe('methodName', () => {
    it('should handle normal case', async () => {
      // Arrange
      const input = { /* test data */ };
      const expected = { /* expected result */ };
      
      // Act
      const result = await service.methodName(input);
      
      // Assert
      expect(result).toEqual(expected);
    });
    
    it('should handle error case', async () => {
      // Test error scenarios
      await expect(service.methodName(null))
        .rejects.toThrow('Invalid input');
    });
  });
});
```

### Integration Test Pattern
```javascript
// tests/integration/workflow.test.js
describe('Burn Request Workflow', () => {
  let app;
  
  beforeAll(async () => {
    app = await setupTestApp();
    await seedTestData();
  });
  
  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });
  
  it('should process burn request end-to-end', async () => {
    const response = await request(app)
      .post('/api/burn-requests')
      .send(validBurnRequest)
      .expect(201);
    
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: expect.any(Number),
        status: 'pending'
      })
    });
  });
});
```

## API Response Patterns

### Success Response
```javascript
res.json({
  success: true,
  data: result,
  meta: {
    timestamp: new Date(),
    version: 'v1'
  }
});
```

### Error Response
```javascript
res.status(400).json({
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input data',
    details: validationErrors
  }
});
```

### Paginated Response
```javascript
res.json({
  success: true,
  data: items,
  pagination: {
    page: currentPage,
    limit: itemsPerPage,
    total: totalItems,
    pages: Math.ceil(totalItems / itemsPerPage)
  }
});
```

## WebSocket Patterns

### Event Emission
```javascript
// Server-side
io.emit('event-name', {
  type: 'UPDATE',
  payload: data,
  timestamp: new Date()
});

// Client-side
socket.on('event-name', (data) => {
  dispatch({
    type: 'SOCKET_UPDATE',
    payload: data
  });
});
```

### Room Management
```javascript
// Join room
socket.on('join-farm', (farmId) => {
  socket.join(`farm-${farmId}`);
  socket.emit('joined', { room: `farm-${farmId}` });
});

// Broadcast to room
io.to(`farm-${farmId}`).emit('farm-update', data);
```

## Logging Patterns

### Structured Logging
```javascript
logger.info('Operation completed', {
  operation: 'createBurnRequest',
  userId: req.user.id,
  duration: Date.now() - startTime,
  result: 'success'
});

logger.error('Operation failed', {
  operation: 'createBurnRequest',
  error: error.message,
  stack: error.stack,
  userId: req.user.id
});
```

## Configuration Patterns

### Environment Variables
```javascript
// config/index.js
module.exports = {
  port: process.env.PORT || 5001,
  database: {
    host: process.env.TIDB_HOST,
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10')
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  apis: {
    openWeather: {
      key: process.env.OPENWEATHERMAP_API_KEY,
      baseUrl: 'https://api.openweathermap.org/data/2.5'
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_PHONE_NUMBER
    }
  }
};
```

## Security Patterns

### Input Validation
```javascript
// Using Joi
const schema = Joi.object({
  farmId: Joi.number().required(),
  requestedDate: Joi.date().iso().required(),
  acresToBurn: Joi.number().min(1).max(500).required(),
  cropType: Joi.string().valid('wheat', 'corn', 'rice').required()
});

const { error, value } = schema.validate(req.body);
if (error) {
  return res.status(400).json({
    error: error.details[0].message
  });
}
```

### SQL Injection Prevention
```javascript
// Always use parameterized queries
const query = 'SELECT * FROM users WHERE id = ? AND status = ?';
const [rows] = await pool.execute(query, [userId, 'active']);

// Never do string concatenation
// BAD: const query = `SELECT * FROM users WHERE id = ${userId}`;
```

## Performance Patterns

### Caching
```javascript
// Simple memory cache
const cache = new Map();

async function getCachedData(key, fetchFn) {
  if (cache.has(key)) {
    const cached = cache.get(key);
    if (cached.expiry > Date.now()) {
      return cached.data;
    }
  }
  
  const data = await fetchFn();
  cache.set(key, {
    data,
    expiry: Date.now() + 5 * 60 * 1000 // 5 minutes
  });
  
  return data;
}
```

### Batch Processing
```javascript
// Process in chunks to avoid memory issues
async function processBatch(items, batchSize = 100) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processItem(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}
```

## Code Comments

### Function Documentation
```javascript
/**
 * Validates a burn request against business rules
 * @param {Object} request - The burn request object
 * @param {number} request.farmId - ID of the farm
 * @param {Date} request.requestedDate - Requested burn date
 * @param {number} request.acresToBurn - Number of acres
 * @returns {Object} Validation result with valid flag and errors
 */
function validateBurnRequest(request) {
  // Implementation
}
```

### Complex Logic Comments
```javascript
// Calculate Gaussian plume dispersion
// Using Pasquill-Gifford stability classes
// Reference: EPA Guideline on Air Quality Models
const concentration = (Q / (2 * Math.PI * u * sigmaY * sigmaZ)) *
  Math.exp(-0.5 * Math.pow(y / sigmaY, 2)) *
  (Math.exp(-0.5 * Math.pow((z - H) / sigmaZ, 2)) +
   Math.exp(-0.5 * Math.pow((z + H) / sigmaZ, 2)));
```