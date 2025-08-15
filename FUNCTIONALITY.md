# 🔥 BURNWISE Functionality Guide

Comprehensive overview of all features and capabilities in BURNWISE.

## 🎯 Core Functionality

### 1. Multi-Agent Workflow System

#### Agent 1: Burn Request Coordinator
**Location**: `backend/agents/coordinator.js`

**Functions**:
- `validateBurnRequest()` - Validates incoming requests against schema
- `assignPriorityScore()` - Calculates priority using weighted factors
- `generateBurnVector()` - Creates 32-dimensional burn pattern vector
- `storeBurnRequest()` - Persists to TiDB with vector embedding

**Priority Scoring Algorithm**:
```javascript
score = (acreage * 0.25) + 
        (cropUrgency * 0.20) + 
        (timeFlexibility * 0.15) +
        (weatherSuitability * 0.15) +
        (populationRisk * 0.15) +
        (historicalSuccess * 0.10)
```

#### Agent 2: Weather Analysis Agent
**Location**: `backend/agents/weather.js`

**Functions**:
- `fetchCurrentWeather()` - Gets real-time data from OpenWeatherMap
- `createWeatherVector()` - Generates 128-dimensional weather pattern
- `analyzeBurnConditions()` - Evaluates safety for burning
- `findSimilarWeather()` - Vector similarity search in TiDB

**Weather Vector Composition**:
- Dimensions 0-15: Temperature patterns
- Dimensions 16-31: Humidity variations
- Dimensions 32-47: Wind components
- Dimensions 48-63: Pressure trends
- Dimensions 64-79: Precipitation data
- Dimensions 80-95: Cloud coverage
- Dimensions 96-111: Visibility metrics
- Dimensions 112-127: Temporal features

#### Agent 3: Smoke Overlap Predictor
**Location**: `backend/agents/predictor.js`

**Functions**:
- `predictSmokeDispersion()` - Gaussian plume model calculation
- `calculateConcentration()` - PM2.5 levels at any point
- `detectOverlap()` - Finds conflicts between burns
- `generateSmokeVector()` - Creates 64-dimensional plume vector

**Gaussian Plume Equation**:
```
C(x,y,z) = (Q / 2π * u * σy * σz) * 
           exp(-y²/2σy²) * 
           [exp(-(z-H)²/2σz²) + exp(-(z+H)²/2σz²)]
```

Where:
- C = Concentration (μg/m³)
- Q = Emission rate (g/s)
- u = Wind speed (m/s)
- σy, σz = Dispersion parameters
- H = Effective stack height (m)

#### Agent 4: Schedule Optimizer
**Location**: `backend/agents/optimizer.js`

**Functions**:
- `optimizeSchedule()` - Main optimization entry point
- `simulatedAnnealing()` - Core optimization algorithm
- `calculateEnergy()` - Cost function for schedule quality
- `generateNeighbor()` - Creates schedule variations

**Simulated Annealing Parameters**:
```javascript
{
  initialTemperature: 1000,
  coolingRate: 0.95,
  minTemperature: 0.01,
  maxIterations: 10000
}
```

#### Agent 5: Alert System Agent
**Location**: `backend/agents/alerts.js`

**Functions**:
- `sendSMSAlert()` - Twilio SMS notifications
- `broadcastUpdate()` - Socket.io real-time updates
- `queueAlert()` - Manages alert delivery queue
- `trackDelivery()` - Monitors notification status

### 2. Burn Request Management

#### Request Submission Flow
1. **Frontend Form** (`frontend/src/components/BurnRequestForm.js`)
   - Farm selection
   - Field boundary drawing on map
   - Date/time selection
   - Acreage and crop type

2. **API Processing** (`backend/api/burnRequests.js`)
   - Input validation
   - 5-agent workflow trigger
   - Real-time status updates
   - Database persistence

3. **Status Tracking**
   - `pending` - Awaiting processing
   - `approved` - Safe to burn
   - `rejected` - Conflicts detected
   - `completed` - Burn finished
   - `cancelled` - User cancelled

### 3. Conflict Detection & Resolution

#### Conflict Types
1. **Smoke Overlap**: PM2.5 exceeds 35 μg/m³ at overlap zone
2. **Time Conflict**: Burns too close in time
3. **Resource Conflict**: Equipment/personnel overlap
4. **Weather Conflict**: Conditions became unsafe

#### Resolution Strategies
- **Temporal Shifting**: Move burn times
- **Spatial Adjustment**: Modify burn areas
- **Priority Ordering**: Higher priority burns first
- **Alternative Dates**: Suggest different days

### 4. Real-Time Features

#### WebSocket Events
```javascript
// Server broadcasts
io.emit('burn_request_created', data)
io.emit('weather_analyzed', data)
io.emit('smoke_predicted', data)
io.emit('conflict_detected', data)
io.emit('schedule_optimized', data)
io.emit('alert_sent', data)

// Client listeners
socket.on('burn_request_created', handler)
socket.on('schedule_update', handler)
socket.on('alert_notification', handler)
```

### 5. Map Visualization

#### Map Features (`frontend/src/components/Map.js`)
- **Farm Markers**: Show all registered farms
- **Field Boundaries**: Drawable polygons
- **Smoke Plumes**: Animated dispersion visualization
- **Conflict Zones**: Red overlay areas
- **Wind Direction**: Animated arrows
- **Heatmap**: PM2.5 concentration gradient

#### Mapbox Layers
1. `farms-layer` - Farm locations
2. `fields-layer` - Field boundaries
3. `smoke-layer` - Plume visualization
4. `conflict-layer` - Overlap zones
5. `weather-layer` - Weather overlays

### 6. Analytics & Reporting

#### Available Metrics (`frontend/src/components/Analytics.js`)
- **Burn Statistics**: Total burns, acres, success rate
- **Conflict Analysis**: Frequency, resolution time
- **Weather Patterns**: Favorable days analysis
- **Farm Performance**: Individual farm metrics
- **EPA Compliance**: PM2.5 limit adherence

#### Data Exports
- CSV format for spreadsheets
- JSON for programmatic access
- PDF reports for documentation
- Real-time API endpoints

### 7. Vector Search Operations

#### Weather Pattern Matching
```sql
SELECT *, 1 - VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
FROM weather_data
WHERE similarity > 0.85
ORDER BY similarity DESC
```

#### Historical Burn Analysis
```sql
SELECT * FROM burn_history
WHERE VEC_L2_DISTANCE(burn_vector, ?) < 10
AND farm_id = ?
```

#### Smoke Plume Similarity
```sql
SELECT * FROM smoke_predictions
WHERE VEC_COSINE_DISTANCE(plume_vector, ?) < 0.3
```

## 🔐 Security Features

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Role-Based Access**: Farmer, Coordinator, Admin
- **Session Management**: Secure cookie handling
- **Password Security**: Bcrypt hashing (10 rounds)

### API Security
- **Rate Limiting**: 100 requests per 15 minutes
- **CSRF Protection**: Token validation
- **Input Sanitization**: XSS prevention
- **SQL Injection Prevention**: Parameterized queries

### Data Protection
- **Encryption at Rest**: TiDB encryption
- **Encryption in Transit**: TLS/SSL
- **Audit Logging**: All modifications tracked
- **PII Handling**: GDPR compliance ready

## 🎨 User Interface Features

### Dashboard Components
1. **Status Cards**: Real-time metrics
2. **Activity Feed**: Recent events
3. **Weather Widget**: Current conditions
4. **Schedule Calendar**: Visual timeline
5. **Alert Panel**: Notifications

### Interactive Elements
- **Drag & Drop**: Schedule rearrangement
- **Draw on Map**: Field boundaries
- **Real-time Updates**: No refresh needed
- **Responsive Design**: Mobile friendly
- **Dark Mode**: Theme switching

### Animations
- **Fire Logo**: Particle system animation
- **Loading States**: Smooth transitions
- **Map Transitions**: Smooth pan/zoom
- **Chart Animations**: Data visualization

## 🔄 Background Jobs

### Scheduled Tasks
```javascript
// Weather updates every 15 minutes
cron.schedule('*/15 * * * *', updateWeatherData)

// Conflict detection every 5 minutes  
cron.schedule('*/5 * * * *', detectNewConflicts)

// Alert processing every minute
cron.schedule('* * * * *', processAlertQueue)

// Daily optimization at 6 AM
cron.schedule('0 6 * * *', runDailyOptimization)
```

## 📊 Database Operations

### Key Queries
1. **Active Burns Today**
```sql
SELECT * FROM burn_requests
WHERE DATE(requested_date) = CURDATE()
AND status IN ('approved', 'in_progress')
```

2. **Conflict Detection**
```sql
SELECT br1.*, br2.*
FROM burn_requests br1
JOIN burn_requests br2 ON br1.id != br2.id
WHERE ST_Distance(br1.location, br2.location) < 5000
AND br1.requested_date = br2.requested_date
```

3. **Vector Search Performance**
```sql
EXPLAIN ANALYZE
SELECT * FROM weather_data
WHERE VEC_COSINE_DISTANCE(weather_vector, ?) < 0.2
```

## 🧪 Testing Coverage

### Test Categories
- **Unit Tests**: Individual function testing
- **Integration Tests**: Multi-component testing
- **E2E Tests**: Full workflow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability scanning

### Key Test Scenarios
1. Submit burn request → Conflict detection → Resolution
2. Weather change → Alert generation → Delivery
3. Multiple concurrent burns → Optimization → Schedule
4. Vector search → Similarity matching → Results
5. Real-time updates → WebSocket → UI refresh

## 📈 Performance Optimizations

### Database Optimizations
- **Connection Pooling**: Max 10 connections
- **Query Caching**: Redis integration
- **Index Strategy**: HNSW for vectors
- **Batch Operations**: Bulk inserts

### Frontend Optimizations
- **Code Splitting**: Lazy loading
- **Image Optimization**: WebP format
- **Bundle Size**: Tree shaking
- **Service Worker**: Offline capability

### Backend Optimizations
- **Circuit Breaker**: Fault tolerance
- **Rate Limiting**: Request throttling
- **Compression**: Gzip responses
- **Clustering**: Multi-core utilization

## 🚀 Advanced Features

### Machine Learning Integration
- **Pattern Recognition**: Historical burn success
- **Prediction Models**: Weather favorability
- **Anomaly Detection**: Unusual conditions
- **Optimization Learning**: Improved scheduling

### Future Capabilities
- **Satellite Integration**: Real-time imagery
- **Drone Monitoring**: Live burn tracking
- **IoT Sensors**: Field conditions
- **Mobile App**: Native applications

---

This comprehensive functionality guide covers all major features and technical capabilities of BURNWISE. Each component is production-ready and thoroughly tested.