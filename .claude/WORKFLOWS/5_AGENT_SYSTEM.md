# 🤖 5-Agent System Workflow

## Overview
The 5-agent system processes burn requests through a coordinated pipeline, each agent adding specialized analysis and optimization.

## Agent Pipeline
```
Burn Request → Coordinator → Weather → Predictor → Optimizer → Alerts → Complete
```

## Detailed Agent Workflow

### Step 1: Coordinator Agent Receives Request
**File**: `backend/agents/coordinator.js`

```javascript
// Entry point: orchestrateWorkflow()
async function orchestrateWorkflow(request) {
  // 1. Validate request
  const validation = validateBurnRequest(request);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  
  // 2. Initialize workflow data
  let workflowData = {
    request,
    timestamp: new Date(),
    agentsProcessed: []
  };
  
  // 3. Process through agent pipeline
  workflowData = await weatherAgent.process(workflowData);
  workflowData = await predictorAgent.process(workflowData);
  workflowData = await optimizerAgent.process(workflowData);
  workflowData = await alertsAgent.process(workflowData);
  
  return workflowData;
}
```

### Step 2: Weather Agent Fetches & Vectorizes
**File**: `backend/agents/weather.js`

```javascript
async process(data) {
  // 1. Fetch weather from OpenWeatherMap
  const weather = await fetchWeatherData(data.request.location);
  
  // 2. Create 128-dimensional vector
  const weatherVector = createWeatherVector(weather);
  
  // 3. Analyze burn conditions
  const safetyScore = analyzeBurnConditions(weather);
  
  // 4. Find similar historical weather
  const similar = await findSimilarWeather(weatherVector);
  
  return {
    ...data,
    weather: {
      current: weather,
      vector: weatherVector,
      safetyScore,
      historicalMatches: similar
    }
  };
}
```

**Weather Vector Structure (128 dimensions):**
```
[0-15]:   Temperature (current, min, max, feels_like, variations...)
[16-31]:  Humidity (current, trends, dew_point...)
[32-47]:  Wind (speed, direction, gusts, variability...)
[48-63]:  Pressure (current, sea_level, trends...)
[64-79]:  Precipitation (amount, probability, type...)
[80-95]:  Cloud coverage (percentage, altitude, type...)
[96-111]: Visibility (distance, fog, haze...)
[112-127]: Temporal (hour_sin, hour_cos, day_sin, day_cos, season...)
```

### Step 3: Predictor Agent Models Smoke
**File**: `backend/agents/predictor.js`

```javascript
async process(data) {
  // 1. Apply Gaussian plume model
  const dispersion = predictSmokeDispersion(
    data.request,
    data.weather.current
  );
  
  // 2. Calculate concentration grid
  const concentrationMap = calculateConcentrationGrid(dispersion);
  
  // 3. Create 64-dimensional smoke vector
  const smokeVector = createSmokeVector(dispersion);
  
  // 4. Detect potential conflicts
  const conflicts = await detectOverlaps(dispersion, data.request.requested_date);
  
  return {
    ...data,
    prediction: {
      dispersion,
      concentrationMap,
      vector: smokeVector,
      conflicts,
      maxConcentration: dispersion.maxConcentration,
      affectedArea: dispersion.affectedArea
    }
  };
}
```

**Gaussian Plume Equation:**
```javascript
C(x,y,z) = (Q / 2πuσyσz) × 
           exp(-y²/2σy²) × 
           [exp(-(z-H)²/2σz²) + exp(-(z+H)²/2σz²)]

Where:
- C = Concentration (μg/m³)
- Q = Emission rate (g/s)
- u = Wind speed (m/s)
- σy, σz = Dispersion coefficients
- H = Effective stack height (m)
- x, y, z = Downwind, crosswind, vertical distances
```

### Step 4: Optimizer Agent Schedules Burns
**File**: `backend/agents/optimizer.js`

```javascript
async process(data) {
  // 1. Get all pending requests for the period
  const allRequests = await getPendingRequests(data.request.requested_date);
  
  // 2. Define constraints
  const constraints = {
    maxDailyAcres: 500,
    minSeparationDistance: 5, // km
    maxConcurrentBurns: 3,
    weatherRequirements: data.weather.safetyScore > 70
  };
  
  // 3. Run simulated annealing
  const optimizedSchedule = simulatedAnnealing(
    [...allRequests, data.request],
    constraints
  );
  
  // 4. Calculate metrics
  const metrics = {
    totalConflictsResolved: optimizedSchedule.conflictsResolved,
    efficiencyScore: optimizedSchedule.efficiency,
    assignedSlot: findSlotForRequest(optimizedSchedule, data.request.id)
  };
  
  return {
    ...data,
    schedule: {
      optimized: optimizedSchedule,
      metrics,
      assignedTimeSlot: metrics.assignedSlot
    }
  };
}
```

**Simulated Annealing Parameters:**
```javascript
{
  initialTemperature: 1000,
  coolingRate: 0.95,
  minTemperature: 0.001,
  maxIterations: 10000,
  energyFunction: calculateTotalConflicts
}
```

### Step 5: Alerts Agent Sends Notifications
**File**: `backend/agents/alerts.js`

```javascript
async process(data) {
  // 1. Determine alert type
  const alertType = determineAlertType(data);
  
  // 2. Generate message
  const message = generateAlertMessage(alertType, data);
  
  // 3. Send via Twilio
  const result = await sendSMS(
    data.request.contact_phone,
    message
  );
  
  // 4. Queue follow-up reminders
  if (alertType === 'approval') {
    await queueReminder(data.request.id, data.schedule.assignedTimeSlot);
  }
  
  // 5. Store in database
  await storeAlert({
    burn_request_id: data.request.id,
    type: alertType,
    message,
    status: result.status,
    twilio_message_id: result.sid
  });
  
  return {
    ...data,
    alerts: {
      sent: true,
      type: alertType,
      messageId: result.sid,
      deliveryStatus: result.status
    }
  };
}
```

## Data Flow Between Agents

### 1. Initial Request Data
```json
{
  "farm_id": 1,
  "requested_date": "2025-03-15",
  "acres_to_burn": 50,
  "crop_type": "wheat_stubble",
  "reason": "field_preparation",
  "location": {
    "lat": 45.123,
    "lng": -122.456
  }
}
```

### 2. After Weather Agent
```json
{
  "request": { /* original */ },
  "weather": {
    "current": {
      "temperature": 72,
      "humidity": 45,
      "wind_speed": 8,
      "wind_direction": 270
    },
    "vector": [/* 128 dimensions */],
    "safetyScore": 85
  }
}
```

### 3. After Predictor Agent
```json
{
  /* previous data */
  "prediction": {
    "dispersion": {
      "plume_height": 150,
      "plume_width": 500,
      "travel_distance": 2000
    },
    "vector": [/* 64 dimensions */],
    "maxConcentration": 45.2,
    "conflicts": []
  }
}
```

### 4. After Optimizer Agent
```json
{
  /* previous data */
  "schedule": {
    "assignedTimeSlot": "2025-03-15T08:00:00",
    "metrics": {
      "conflictsResolved": 2,
      "efficiencyScore": 0.92
    }
  }
}
```

### 5. After Alerts Agent (Final)
```json
{
  /* all previous data */
  "alerts": {
    "sent": true,
    "type": "approval",
    "messageId": "SM123abc",
    "deliveryStatus": "delivered"
  }
}
```

## Error Handling

### Agent-Level Error Handling
```javascript
class Agent {
  async process(data) {
    try {
      // Agent logic
      return enrichedData;
    } catch (error) {
      logger.error(`${this.name} failed`, { error, data });
      
      // Decide whether to continue or abort
      if (this.isCritical) {
        throw error; // Abort workflow
      } else {
        // Continue with partial data
        return {
          ...data,
          [this.name]: { error: error.message }
        };
      }
    }
  }
}
```

### Workflow-Level Recovery
```javascript
async function orchestrateWorkflow(request) {
  const checkpoint = await getCheckpoint(request.id);
  
  try {
    // Resume from checkpoint if exists
    let data = checkpoint || request;
    
    // Process remaining agents
    for (const agent of getRemainigAgents(checkpoint)) {
      data = await agent.process(data);
      await saveCheckpoint(request.id, data);
    }
    
    return data;
  } catch (error) {
    // Rollback or compensate
    await rollbackWorkflow(request.id);
    throw error;
  }
}
```

## Performance Metrics

### Agent Processing Times (Target)
| Agent | Target Time | Max Time |
|-------|------------|----------|
| Coordinator | < 50ms | 100ms |
| Weather | < 500ms | 1000ms |
| Predictor | < 200ms | 500ms |
| Optimizer | < 2000ms | 5000ms |
| Alerts | < 1000ms | 2000ms |
| **Total** | **< 3.75s** | **8.6s** |

### Optimization Strategies
1. **Parallel Processing**: Weather and historical data fetch
2. **Caching**: Weather data (5 min), Similar patterns (15 min)
3. **Batch Processing**: Multiple requests in optimizer
4. **Async Operations**: Non-blocking SMS sending

## Monitoring & Logging

### Key Metrics to Track
```javascript
// Per agent
- Processing time
- Success rate
- Error frequency
- Data enrichment ratio

// Per workflow
- End-to-end latency
- Completion rate
- Rollback frequency
- Agent skip rate
```

### Logging Examples
```javascript
logger.info('Workflow started', {
  requestId: request.id,
  farmId: request.farm_id,
  timestamp: new Date()
});

logger.info('Agent completed', {
  agent: 'weather',
  duration: Date.now() - startTime,
  dataSize: JSON.stringify(data).length
});

logger.error('Agent failed', {
  agent: 'predictor',
  error: error.message,
  stack: error.stack,
  willRetry: true
});
```

## Testing the Workflow

### Unit Test Each Agent
```javascript
describe('Weather Agent', () => {
  it('should fetch and vectorize weather data', async () => {
    const input = { request: mockRequest };
    const output = await weatherAgent.process(input);
    
    expect(output.weather).toBeDefined();
    expect(output.weather.vector).toHaveLength(128);
    expect(output.weather.safetyScore).toBeGreaterThan(0);
  });
});
```

### Integration Test Full Workflow
```javascript
describe('5-Agent Workflow', () => {
  it('should process request end-to-end', async () => {
    const request = createTestRequest();
    const result = await orchestrateWorkflow(request);
    
    expect(result.agentsProcessed).toEqual([
      'coordinator', 'weather', 'predictor', 'optimizer', 'alerts'
    ]);
    expect(result.schedule.assignedTimeSlot).toBeDefined();
    expect(result.alerts.sent).toBe(true);
  });
});
```