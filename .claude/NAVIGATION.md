# 🗺️ Burnwise Quick Navigation

## 🎯 Primary Entry Points
| Component | File Path | Purpose |
|-----------|-----------|---------|
| Backend Server | `backend/server.js` | Express server, port 5001 |
| Frontend App | `frontend/src/App.js` | React root component |
| Database Init | `backend/init-db.js` | TiDB schema setup |
| Agent Orchestrator | `backend/agents/coordinator.js` | 5-agent workflow |

## 📁 Directory Quick Jump

### Backend (`backend/`)
```
backend/
├── agents/           # 5-agent AI system
│   ├── coordinator.js    # Orchestrates workflow
│   ├── weather.js        # OpenWeather + vectors
│   ├── predictor.js      # Gaussian plume model
│   ├── optimizer.js      # Simulated annealing
│   └── alerts.js         # Twilio SMS
├── api/              # REST endpoints
│   ├── burnRequests.js   # Burn request CRUD
│   ├── weather.js        # Weather endpoints
│   ├── schedule.js       # Schedule optimization
│   ├── alerts.js         # Alert management
│   ├── farms.js          # Farm registration
│   └── analytics.js      # Metrics & reports
├── db/               # Database layer
│   ├── connection.js     # TiDB pool + circuit breaker
│   ├── vectorOperations.js # Vector search
│   └── queryCache.js     # Query caching
├── middleware/       # Express middleware
│   ├── auth.js          # JWT authentication
│   ├── rateLimiter.js   # Rate limiting
│   └── errorHandler.js  # Global error handling
└── tests/            # Test suites
    ├── agents/          # Agent unit tests
    ├── integration/     # Workflow tests
    └── performance/     # Load tests
```

### Frontend (`frontend/src/`)
```
frontend/src/
├── components/       # React components
│   ├── BurnRequestForm.js  # Main form
│   ├── Map.js              # Mapbox visualization
│   ├── Schedule.js         # Schedule display
│   ├── Dashboard.js        # Main dashboard
│   ├── Analytics.js        # Analytics charts
│   └── [20+ animation files] # Fire animations
├── styles/           # CSS files
│   ├── theme.css          # Fire theme
│   ├── mapbox-overrides.css # Map styles
│   └── globals.css        # Global styles
└── utils/            # Helper functions
```

## 🔍 Find by Feature

### Burn Request Flow
1. **Form Submission**: `frontend/src/components/BurnRequestForm.js`
2. **API Handler**: `backend/api/burnRequests.js`
3. **Validation**: `backend/agents/coordinator.js:validateBurnRequest()`
4. **Processing**: `backend/agents/coordinator.js:orchestrateWorkflow()`

### Weather Integration
1. **API Fetch**: `backend/agents/weather.js:fetchWeatherData()`
2. **Vector Creation**: `backend/agents/weather.js:createWeatherVector()`
3. **Storage**: `backend/db/vectorOperations.js:storeWeatherVector()`
4. **Search**: `backend/db/vectorOperations.js:findSimilarWeather()`

### Smoke Prediction
1. **Model**: `backend/agents/predictor.js:predictSmokeDispersion()`
2. **Gaussian**: `backend/agents/predictor.js:calculateConcentration()`
3. **Overlap**: `backend/agents/predictor.js:detectOverlap()`
4. **Visualization**: `frontend/src/components/Map.js:renderSmokePlume()`

### Schedule Optimization
1. **Algorithm**: `backend/agents/optimizer.js:simulatedAnnealing()`
2. **Energy**: `backend/agents/optimizer.js:calculateEnergy()`
3. **API**: `backend/api/schedule.js:optimizeSchedule()`
4. **Display**: `frontend/src/components/Schedule.js`

### Real-time Updates
1. **Server Setup**: `backend/server.js:L200-220`
2. **Socket Events**: `backend/server.js:io.on('connection')`
3. **Client Connect**: `frontend/src/App.js:L45-60`
4. **Event Handlers**: `frontend/src/components/Dashboard.js:useEffect()`

## 🛠️ Common File Operations

### Add New API Endpoint
1. Create handler: `backend/api/[feature].js`
2. Register route: `backend/server.js:app.use('/api/[feature]')`
3. Add middleware: `backend/middleware/`
4. Test endpoint: `backend/tests/api/`

### Create React Component
1. Component file: `frontend/src/components/[Component].js`
2. Style file: `frontend/src/styles/[Component].css`
3. Import in parent: `frontend/src/App.js` or relevant parent
4. Add route if needed: `frontend/src/App.js:Routes`

### Add Database Query
1. Query function: `backend/db/[operations].js`
2. Use connection pool: `backend/db/connection.js:pool`
3. Add caching: `backend/db/queryCache.js`
4. Test query: `backend/tests/database/`

### Modify Agent Logic
1. Agent file: `backend/agents/[agent].js`
2. Update workflow: `backend/agents/coordinator.js`
3. Test changes: `backend/tests/agents/[agent].test.js`
4. Integration test: `backend/tests/integration/`

## 📍 Key Functions by File

### `backend/agents/coordinator.js`
- `validateBurnRequest(request)` - L45
- `scoreRequest(request, weather)` - L120
- `orchestrateWorkflow(request)` - L200

### `backend/agents/weather.js`
- `fetchWeatherData(location)` - L25
- `createWeatherVector(data)` - L85
- `analyzeBurnConditions(weather)` - L150

### `backend/agents/predictor.js`
- `predictSmokeDispersion(burn, weather)` - L35
- `calculateConcentration(x, y, z, params)` - L110
- `detectOverlap(pred1, pred2)` - L180

### `backend/agents/optimizer.js`
- `simulatedAnnealing(requests, constraints)` - L40
- `calculateEnergy(schedule)` - L125
- `generateNeighbor(current)` - L200

### `backend/db/connection.js`
- `getConnection()` - L30
- `executeQuery(sql, params)` - L75
- `handleCircuitBreaker()` - L150

## 🔗 Configuration Files

| Config | Path | Purpose |
|--------|------|---------|
| Backend Env | `backend/.env` | API keys, DB credentials |
| Frontend Env | `frontend/.env` | Mapbox token, API URL |
| Package.json | `package.json` | Root scripts |
| Backend Package | `backend/package.json` | Backend dependencies |
| Frontend Package | `frontend/package.json` | Frontend dependencies |

## 🧪 Test Locations

| Test Type | Location | Run Command |
|-----------|----------|-------------|
| All Tests | Root | `npm test` |
| Backend Unit | `backend/tests/` | `cd backend && npm test` |
| Frontend Unit | `frontend/src/__tests__/` | `cd frontend && npm test` |
| E2E Tests | `e2e-tests/` | `npx playwright test` |
| Integration | `backend/tests/integration/` | `npm run test:integration` |

## 📝 Important Constants

### Ports
- Backend: `5001`
- Frontend: `3000`
- WebSocket: `5001`

### Vector Dimensions
- Weather: `128`
- Smoke: `64`
- Burns: `32`

### Limits
- Rate limit: `100 requests/15 min`
- Connection pool: `10 max`
- Circuit breaker: `5 failures`

## 🚀 Quick Commands

```bash
# Development
npm run dev              # Start both servers
npm run seed            # Populate demo data

# Testing
npm test                # Run all tests
npm run test:e2e        # E2E tests only

# Production
npm run build           # Build for production
npm start              # Start production

# Database
npm run db:init        # Initialize schema
npm run db:migrate     # Run migrations
```

## 💡 Pro Tips

1. **Finding Functions**: Use `Grep` tool with function name
2. **Understanding Flow**: Start at `coordinator.js`
3. **API Testing**: Check `backend/tests/api/`
4. **Component Props**: Look at parent component imports
5. **Database Schema**: See `backend/init-db.js`