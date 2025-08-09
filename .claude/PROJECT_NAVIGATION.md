# 🗺️ Burnwise Project Navigation Guide

## 🚀 Quick Start Locations

### Primary Entry Points
- **Backend Server**: `backend/server.js` - Main Express server (port 5001)
- **Frontend App**: `frontend/src/App.js` - React app root component
- **Database Setup**: `backend/init-db.js` - TiDB schema initialization
- **Environment Config**: `backend/.env` & `frontend/.env` - API keys & credentials

### Core Business Logic
- **5-Agent Workflow**: `backend/agents/` - Coordinator, Weather, Predictor, Optimizer, Alerts
- **API Endpoints**: `backend/api/` - RESTful routes for burn requests, weather, schedule
- **Database Layer**: `backend/db/` - TiDB connection pool, vector operations, query cache

## 📁 Directory Structure

```
burnwise/
├── .claude/                    # Claude AI navigation & context files
│   ├── PROJECT_NAVIGATION.md   # This file - main navigation guide
│   ├── ARCHITECTURE.md         # System architecture overview
│   ├── API_REFERENCE.md        # API endpoint documentation
│   ├── AGENT_CONTEXT.md        # 5-agent workflow details
│   └── DEBUGGING_GUIDE.md      # Common issues & solutions
│
├── backend/                    # Node.js/Express backend
│   ├── agents/                 # Core AI agents (5-agent workflow)
│   ├── api/                    # REST API routes
│   ├── db/                     # Database utilities
│   ├── middleware/             # Express middleware
│   ├── scripts/                # Utility scripts
│   ├── tests/                  # Test suites
│   └── utils/                  # Helper utilities
│
├── frontend/                   # React frontend
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── styles/             # CSS modules
│   │   └── utils/              # Frontend utilities
│   └── build/                  # Production build
│
├── e2e-tests/                  # Playwright E2E tests
├── docs/                       # Project documentation
└── config/                     # Configuration files

```

## 🔍 Key File Locations by Feature

### Authentication & Security
- Auth middleware: `backend/middleware/auth.js`
- Rate limiting: `backend/middleware/rateLimiter.js`
- Security headers: `backend/server.js:L50-70`

### Burn Request Processing
- Form component: `frontend/src/components/BurnRequestForm.js`
- API handler: `backend/api/burnRequests.js`
- Validation: `backend/agents/coordinator.js:validateBurnRequest()`

### Weather Integration
- OpenWeather API: `backend/agents/weather.js:fetchWeatherData()`
- Vector embedding: `backend/agents/weather.js:L128-dim vectors`
- Weather routes: `backend/api/weather.js`

### Smoke Prediction
- Gaussian plume model: `backend/agents/predictor.js:predictSmokeDispersion()`
- Overlap detection: `backend/agents/predictor.js:detectOverlap()`
- Mathematical validation: `backend/mathematical-validation.js`

### Schedule Optimization
- Simulated annealing: `backend/agents/optimizer.js:simulatedAnnealing()`
- Schedule API: `backend/api/schedule.js`
- Frontend display: `frontend/src/components/Schedule.js`

### Real-time Updates
- WebSocket setup: `backend/server.js:L200-220`
- Socket.io client: `frontend/src/App.js:L45-60`
- Event handlers: `frontend/src/components/Dashboard.js`

### Map Visualization
- Mapbox integration: `frontend/src/components/Map.js`
- WebGL handler: `frontend/src/components/MapboxWebGLHandler.js`
- Map styles: `frontend/src/styles/mapbox-overrides.css`

### Testing
- Unit tests: `backend/tests/agents/*.test.js`
- Integration: `backend/tests/integration/`
- E2E tests: `e2e-tests/*.spec.js`
- Performance: `backend/tests/performance/`

## 🎯 Quick Navigation Commands

```bash
# Jump to main server
code backend/server.js

# Open agent workflow
code backend/agents/coordinator.js

# Edit React app
code frontend/src/App.js

# View API routes
code backend/api/

# Check tests
code backend/tests/

# Review E2E tests
code e2e-tests/
```

## 🔧 Common Tasks & Their Locations

| Task | Location | Command |
|------|----------|---------|
| Add new API endpoint | `backend/api/` | Create new file, register in `server.js` |
| Modify agent logic | `backend/agents/` | Edit specific agent file |
| Update UI component | `frontend/src/components/` | Edit component, check styles |
| Add database query | `backend/db/` | Use `connection.js` pool |
| Configure environment | `backend/.env` | Add new variables |
| Run tests | Root directory | `npm test` |
| Deploy changes | Root directory | Check `package.json` scripts |

## 🏷️ File Naming Conventions

- **Components**: PascalCase (`BurnRequestForm.js`)
- **Utilities**: camelCase (`queryCache.js`)
- **Tests**: `*.test.js` or `*.spec.js`
- **Styles**: kebab-case (`mapbox-overrides.css`)
- **Config**: lowercase (`package.json`)

## 📝 Notes for Claude

- Always check `CLAUDE.md` for project-specific rules
- Use `backend/db/connection.js` for all database operations
- Weather vectors are 128-dim, smoke 64-dim, burns 32-dim
- Circuit breaker activates after 5 failures
- Rate limit: 100 requests per 15 minutes
- Never modify `CLAUDE.md` or `README.md` without explicit permission