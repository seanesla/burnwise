# 🤖 5-Agent Workflow Context

## Agent Pipeline Overview

```
1. Coordinator → 2. Weather → 3. Predictor → 4. Optimizer → 5. Alerts
```

Each agent has specific responsibilities and passes enriched data to the next agent in the pipeline.

---

## 1️⃣ Coordinator Agent
**File**: `backend/agents/coordinator.js`

### Purpose
Central orchestrator that validates requests and manages the entire workflow.

### Key Functions

#### `validateBurnRequest(request)`
```javascript
// Input validation
{
  farm_id: number,
  requested_date: string (YYYY-MM-DD),
  acres_to_burn: number (> 0),
  crop_type: string,
  reason: string,
  location: { lat, lng }
}

// Returns
{
  valid: boolean,
  errors: string[],
  warnings: string[]
}
```

#### `scoreRequest(request, weatherData)`
```javascript
// Scoring factors:
- Urgency (days until requested date)
- Farm size (acres to burn)
- Weather conditions
- Previous burn history
- Conflict potential

// Returns: number (0-100)
```

#### `orchestrateWorkflow(request)`
```javascript
// Workflow steps:
1. Validate request
2. Fetch weather data
3. Predict smoke dispersion
4. Optimize schedule
5. Send notifications

// Returns complete workflow result
```

### Database Queries
```sql
-- Check for existing requests
SELECT * FROM burn_requests 
WHERE farm_id = ? AND status = 'pending'

-- Store validated request
INSERT INTO burn_requests (...)
VALUES (?, ?, ?, ...)
```

---

## 2️⃣ Weather Agent
**File**: `backend/agents/weather.js`

### Purpose
Fetches weather data and creates vector embeddings for similarity search.

### Key Functions

#### `fetchWeatherData(location)`
```javascript
// OpenWeatherMap API call
const url = `https://api.openweathermap.org/data/2.5/weather`
// Parameters: lat, lon, appid

// Returns weather object with:
{
  temperature: number (Celsius),
  humidity: number (%),
  wind_speed: number (m/s),
  wind_direction: number (degrees),
  pressure: number (hPa),
  conditions: string
}
```

#### `createWeatherVector(weatherData)`
```javascript
// 128-dimensional vector encoding:
// [0-15]: Temperature variations
// [16-31]: Humidity patterns
// [32-47]: Wind components
// [48-63]: Pressure trends
// [64-79]: Precipitation data
// [80-95]: Cloud coverage
// [96-111]: Visibility metrics
// [112-127]: Temporal features

// Normalization: All values scaled to [-1, 1]
```

#### `analyzeBurnConditions(weatherData)`
```javascript
// Safety checks:
- Wind speed < 15 mph
- Humidity > 30%
- No precipitation
- Visibility > 5 miles
- Temperature < 85°F

// Returns safety score (0-100)
```

### Vector Search Queries
```sql
-- Find similar weather patterns
SELECT *, VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
FROM weather_data
WHERE timestamp > DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY similarity
LIMIT 10
```

---

## 3️⃣ Predictor Agent
**File**: `backend/agents/predictor.js`

### Purpose
Models smoke dispersion using Gaussian plume equations and detects conflicts.

### Key Functions

#### `predictSmokeDispersion(burnRequest, weatherData)`
```javascript
// Gaussian plume model parameters:
{
  source_strength: Q (g/s),
  wind_speed: u (m/s),
  stack_height: H (m),
  stability_class: string (A-F),
  mixing_height: number (m)
}

// Concentration calculation:
C(x,y,z) = (Q/2πuσyσz) * exp(-y²/2σy²) * 
           [exp(-(z-H)²/2σz²) + exp(-(z+H)²/2σz²)]
```

#### `calculateDispersionCoefficients(distance, stability)`
```javascript
// Pasquill-Gifford coefficients
σy = a * x^b  // Horizontal dispersion
σz = c * x^d  // Vertical dispersion

// Stability classes:
A: Very unstable
B: Unstable  
C: Slightly unstable
D: Neutral
E: Slightly stable
F: Stable
```

#### `detectOverlap(prediction1, prediction2)`
```javascript
// Overlap detection algorithm:
1. Create concentration grids
2. Calculate intersection areas
3. Check concentration thresholds
4. Compute overlap severity

// Returns:
{
  has_conflict: boolean,
  overlap_area: number (km²),
  max_concentration: number (μg/m³),
  affected_zones: GeoJSON
}
```

### Smoke Vector Creation
```javascript
// 64-dimensional smoke vector:
// [0-15]: Dispersion pattern
// [16-31]: Concentration levels
// [32-47]: Affected area bounds
// [48-63]: Temporal evolution
```

---

## 4️⃣ Optimizer Agent
**File**: `backend/agents/optimizer.js`

### Purpose
Finds optimal burn schedule using simulated annealing algorithm.

### Key Functions

#### `simulatedAnnealing(requests, constraints)`
```javascript
// Algorithm parameters:
{
  initial_temperature: 1000,
  cooling_rate: 0.95,
  iterations: 10000,
  min_temperature: 0.001
}

// Process:
1. Generate initial solution
2. Calculate energy (conflicts + penalties)
3. Generate neighbor solution
4. Accept/reject based on temperature
5. Cool down and repeat
```

#### `calculateEnergy(schedule)`
```javascript
// Energy components:
- Smoke overlap conflicts: weight = 100
- Weather penalties: weight = 50
- Time preference violations: weight = 25
- Resource conflicts: weight = 30

// Lower energy = better schedule
```

#### `generateNeighbor(currentSchedule)`
```javascript
// Neighborhood operations:
1. Swap two burn slots
2. Move burn to different day
3. Change burn time window
4. Split large burn into multiple

// Ensures validity of new solution
```

### Optimization Constraints
```javascript
{
  max_daily_acres: 500,
  min_separation_distance: 5, // km
  max_concurrent_burns: 3,
  time_windows: ['morning', 'afternoon'],
  weather_requirements: {
    max_wind_speed: 15,
    min_humidity: 30
  }
}
```

---

## 5️⃣ Alerts Agent
**File**: `backend/agents/alerts.js`

### Purpose
Manages notifications via Twilio SMS and tracks delivery status.

### Key Functions

#### `sendSMS(phoneNumber, message)`
```javascript
// Twilio client setup:
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Send message:
client.messages.create({
  body: message,
  from: process.env.TWILIO_PHONE_NUMBER,
  to: phoneNumber
})
```

#### `queueAlert(alert)`
```javascript
// Alert queue management:
{
  priority: number (1-5),
  recipient: string,
  message: string,
  scheduled_time: Date,
  retry_count: number
}

// Uses database queue for reliability
```

#### `trackDelivery(messageId)`
```javascript
// Delivery tracking:
- Query Twilio API for status
- Update database record
- Handle failures with retry
- Log delivery metrics
```

### Alert Templates
```javascript
// Approval notification
`Your burn request for ${acres} acres on ${date} has been APPROVED. 
Time window: ${timeSlot}. Weather conditions: ${conditions}.`

// Conflict warning
`ALERT: Potential smoke conflict detected for ${date}. 
Please review updated schedule.`

// Weather update
`Weather conditions have changed for ${date}. 
New safety score: ${score}. Please confirm burn plans.`
```

---

## 🔄 Inter-Agent Communication

### Data Flow Between Agents

```javascript
// 1. Coordinator → Weather
{
  location: { lat, lng },
  requested_date: Date,
  request_id: number
}

// 2. Weather → Predictor
{
  ...previousData,
  weather_data: object,
  weather_vector: number[128],
  burn_safety_score: number
}

// 3. Predictor → Optimizer
{
  ...previousData,
  smoke_prediction: object,
  smoke_vector: number[64],
  conflict_zones: GeoJSON
}

// 4. Optimizer → Alerts
{
  ...previousData,
  optimized_schedule: object,
  assigned_slot: string,
  conflicts_resolved: number
}

// 5. Alerts → Complete
{
  ...previousData,
  notifications_sent: array,
  delivery_status: object
}
```

---

## 🧪 Testing Agent Workflows

### Unit Testing
```javascript
// Test individual agent functions
describe('Weather Agent', () => {
  test('creates correct vector dimensions', () => {
    const vector = createWeatherVector(mockData);
    expect(vector.length).toBe(128);
  });
});
```

### Integration Testing
```javascript
// Test full workflow
describe('5-Agent Workflow', () => {
  test('processes request end-to-end', async () => {
    const result = await coordinator.orchestrateWorkflow(request);
    expect(result.status).toBe('scheduled');
  });
});
```

### Performance Benchmarks
- Coordinator: < 50ms per request
- Weather: < 500ms (API call)
- Predictor: < 200ms per calculation
- Optimizer: < 2s for 100 requests
- Alerts: < 1s per SMS

---

## 🔧 Common Agent Issues & Solutions

### Weather Agent
- **Issue**: API rate limiting
- **Solution**: Implement caching, batch requests

### Predictor Agent
- **Issue**: High CPU usage
- **Solution**: Pre-compute common patterns, use approximations

### Optimizer Agent
- **Issue**: Stuck in local minima
- **Solution**: Adjust temperature schedule, add random restarts

### Alerts Agent
- **Issue**: SMS delivery failures
- **Solution**: Implement retry logic, use fallback channels