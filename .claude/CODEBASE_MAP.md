# 🗂️ Burnwise Codebase Map

## Visual File Tree with Descriptions

```
burnwise/
│
├── 📁 .claude/                    ← AI navigation files (YOU ARE HERE)
│   ├── 📄 README.md              ← How to use these files
│   ├── 📄 NAVIGATION.md          ← Quick jump index
│   ├── 📄 ARCHITECTURE.md        ← System design
│   ├── 📄 CODEBASE_MAP.md        ← This file
│   ├── 📄 TECH_STACK.md          ← Libraries & versions
│   ├── 📄 PATTERNS.md            ← Code conventions
│   ├── 📄 DATABASE_SCHEMA.md     ← TiDB structure
│   ├── 📁 WORKFLOWS/             ← Detailed workflows
│   ├── 📁 QUICK_TASKS/           ← Common task guides
│   └── 📁 CONTEXT/               ← Business logic docs
│
├── 📁 backend/                    ← Node.js/Express server
│   ├── 🔥 server.js              ← Main server entry (Express + Socket.io)
│   ├── 🔧 init-db.js             ← Database initialization script
│   ├── 🌱 seed.js                ← Demo data seeder
│   │
│   ├── 📁 agents/                ← 5-Agent AI System
│   │   ├── 🎯 coordinator.js     ← Orchestrates entire workflow
│   │   ├── 🌤️ weather.js         ← OpenWeather API + 128-dim vectors
│   │   ├── 💨 predictor.js        ← Gaussian plume smoke model
│   │   ├── 📊 optimizer.js        ← Simulated annealing scheduler
│   │   └── 📱 alerts.js           ← Twilio SMS notifications
│   │
│   ├── 📁 api/                   ← REST API endpoints
│   │   ├── 🔥 burnRequests.js    ← Burn request CRUD operations
│   │   ├── 🌡️ weather.js         ← Weather data endpoints
│   │   ├── 📅 schedule.js         ← Schedule optimization API
│   │   ├── 🚨 alerts.js           ← Alert management endpoints
│   │   ├── 🚜 farms.js            ← Farm registration/management
│   │   ├── 📈 analytics.js        ← Metrics and reporting
│   │   └── 🔐 auth.js             ← Authentication endpoints
│   │
│   ├── 📁 db/                    ← Database layer
│   │   ├── 🔌 connection.js      ← TiDB connection pool + circuit breaker
│   │   ├── 🔍 vectorOperations.js ← Vector storage/search operations
│   │   ├── 💾 queryCache.js       ← Query result caching
│   │   └── 🗺️ schema-mapping.js  ← Schema definitions
│   │
│   ├── 📁 middleware/            ← Express middleware
│   │   ├── 🔐 auth.js            ← JWT authentication
│   │   ├── ⏱️ rateLimiter.js     ← Rate limiting (100/15min)
│   │   ├── ❌ errorHandler.js     ← Global error handling
│   │   ├── 📝 logger.js           ← Request logging
│   │   └── 📦 cacheHeaders.js     ← Cache control headers
│   │
│   ├── 📁 tests/                 ← Test suites
│   │   ├── 📁 agents/            ← Agent unit tests
│   │   ├── 📁 api/               ← API endpoint tests
│   │   ├── 📁 database/          ← Database tests
│   │   ├── 📁 integration/       ← Workflow integration tests
│   │   ├── 📁 performance/       ← Load/stress tests
│   │   └── 📁 deep-tests/        ← Comprehensive tests
│   │
│   ├── 📁 scripts/               ← Utility scripts
│   │   ├── 🔧 apply-indexes.js   ← Database index creation
│   │   └── 🧹 cleanup-pending-alerts.js ← Alert cleanup
│   │
│   ├── 📁 utils/                 ← Helper utilities
│   │   └── ⏰ scheduler.js        ← Scheduling utilities
│   │
│   ├── 📄 package.json           ← Backend dependencies
│   └── 📄 .env                   ← Environment variables
│
├── 📁 frontend/                  ← React 18 application
│   ├── 📁 public/                ← Static assets
│   │   ├── 🌐 index.html         ← HTML template
│   │   ├── 🔥 favicon.ico        ← Fire icon
│   │   └── 🔥 favicon.svg        ← Fire icon SVG
│   │
│   ├── 📁 src/
│   │   ├── 🚀 index.js           ← React DOM render
│   │   ├── 📱 App.js             ← Main app component + routing
│   │   │
│   │   ├── 📁 components/        ← React components (50+ files)
│   │   │   ├── Core Components
│   │   │   ├── 📋 BurnRequestForm.js     ← Main burn request form
│   │   │   ├── 📊 Dashboard.js           ← Main dashboard view
│   │   │   ├── 🗺️ Map.js                 ← Mapbox GL visualization
│   │   │   ├── 📅 Schedule.js            ← Schedule display
│   │   │   ├── 📈 Analytics.js           ← Analytics charts
│   │   │   ├── 🚨 AlertsPanel.js         ← Alert notifications
│   │   │   ├── ⚙️ Settings.js            ← User settings
│   │   │   ├── 🧭 Navigation.js          ← Navigation bar
│   │   │   ├── 🏠 Landing.js             ← Landing page
│   │   │   │
│   │   │   ├── Animation Components (20+ variations)
│   │   │   ├── 🔥 FullScreenStartup.js   ← Startup animation
│   │   │   ├── 🔥 FireAnimationController.js
│   │   │   ├── 🔥 TsParticlesFireLogo.js
│   │   │   ├── 🔥 LogoFireAnimation.js
│   │   │   ├── 🔥 CinematicFireAnimation.js
│   │   │   └── ... (many more animation files)
│   │   │
│   │   ├── 📁 styles/            ← CSS files
│   │   │   ├── 🎨 theme.css      ← Fire theme variables
│   │   │   ├── 🌍 globals.css    ← Global styles
│   │   │   ├── 📱 App.css        ← App-level styles
│   │   │   ├── 🗺️ mapbox-overrides.css ← Map customization
│   │   │   └── ... (component styles)
│   │   │
│   │   └── 📁 utils/             ← Frontend utilities
│   │       └── 📏 measureFlamePosition.js
│   │
│   ├── 📁 build/                 ← Production build output
│   ├── 📄 package.json           ← Frontend dependencies
│   └── 📄 .env                   ← Frontend environment vars
│
├── 📁 e2e-tests/                 ← Playwright E2E tests
│   ├── 🧪 comprehensive-test-suite.spec.js
│   ├── 🧪 five-agent-workflow.spec.js
│   ├── 🧪 burnwise-comprehensive.spec.js
│   ├── 🧪 startup-animation.spec.js
│   └── ... (20+ test files)
│
├── 📁 docs/                      ← Documentation (to be organized)
│
├── 📁 test-results/              ← Test output files
│
├── Root Configuration Files
├── 📄 package.json               ← Root package scripts
├── 📄 README.md                  ← Project documentation
├── 📄 CLAUDE.md                  ← Claude-specific instructions
├── 📄 .gitignore                 ← Git ignore patterns
└── 📄 check-setup.js             ← Setup verification script

Legend:
📁 Directory
📄 Configuration/Documentation
🔥 Core functionality
🧪 Test file
🎨 Styling
🔧 Utility/Tool
📊 Data/Analytics
🔐 Security
🌐 Web/Network
```

## File Count Summary

| Directory | File Count | Primary Purpose |
|-----------|------------|-----------------|
| `backend/agents/` | 5 | AI agent system |
| `backend/api/` | 8 | REST endpoints |
| `backend/db/` | 4 | Database operations |
| `backend/middleware/` | 5 | Request processing |
| `backend/tests/` | 50+ | Backend testing |
| `frontend/components/` | 50+ | React components |
| `frontend/styles/` | 15+ | CSS styling |
| `e2e-tests/` | 25+ | End-to-end tests |
| Root | 20+ | Config & reports |

## Key File Relationships

### Request Flow
```
BurnRequestForm.js → burnRequests.js → coordinator.js → [agents] → database
                          ↓
                    WebSocket updates → Dashboard.js
```

### Data Flow
```
OpenWeatherAPI → weather.js → vectorOperations.js → TiDB
                      ↓
                predictor.js → optimizer.js → schedule.js
                      ↓
                  alerts.js → Twilio API
```

### Component Hierarchy
```
App.js
├── Navigation.js
├── Routes
│   ├── Landing.js
│   ├── Dashboard.js
│   │   ├── Map.js
│   │   ├── Schedule.js
│   │   └── Analytics.js
│   └── BurnRequestForm.js
└── FullScreenStartup.js
```

## File Naming Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| `*.test.js` | `coordinator.test.js` | Unit tests |
| `*.spec.js` | `workflow.spec.js` | E2E tests |
| `test-*.js` | `test-api.js` | Test scripts |
| `*-test.js` | `api-test.js` | Integration tests |
| `Ts*.js` | `TsParticlesFire.js` | TypeScript particles |
| `*.css` | `theme.css` | Style files |

## Important File Sizes (Approximate)

| File | Lines | Complexity |
|------|-------|------------|
| `server.js` | 400+ | High - Main server |
| `coordinator.js` | 300+ | High - Orchestration |
| `predictor.js` | 250+ | High - Math models |
| `Map.js` | 500+ | High - Visualization |
| `BurnRequestForm.js` | 400+ | Medium - Form logic |
| `connection.js` | 200+ | Medium - DB pool |

## File Dependencies

### Most Imported
1. `connection.js` - Used by all DB operations
2. `auth.js` - Used by protected routes
3. `theme.css` - Used by all components
4. `App.js` - Parent of all routes

### Import Chains
```
server.js
└── agents/coordinator.js
    ├── agents/weather.js
    ├── agents/predictor.js
    ├── agents/optimizer.js
    └── agents/alerts.js
```

## Files to Modify for Common Changes

| Task | Files to Modify |
|------|-----------------|
| Add API endpoint | `server.js`, `api/*.js`, tests |
| New UI feature | `App.js`, `components/*.js`, `styles/*.css` |
| Database change | `init-db.js`, `connection.js`, `vectorOperations.js` |
| Agent logic | `agents/*.js`, `coordinator.js`, tests |
| Authentication | `middleware/auth.js`, `api/auth.js` |