# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BURNWISE is a multi-farm agricultural burn coordination system for the TiDB AgentX Hackathon 2025. It uses a 5-agent workflow system with TiDB vector search capabilities to coordinate controlled burns while preventing smoke conflicts.

## Core Commands

### Development
```bash
npm run dev              # Start both backend (port 5001) and frontend (port 3000) concurrently
npm run backend:dev      # Start backend only with nodemon
npm run frontend:dev     # Start frontend only
```

### Setup & Installation
```bash
npm run install:all      # Install all dependencies (root, backend, frontend)
npm run setup:check      # Verify all configurations and API keys
npm run seed            # Populate database with demo data
```

### Testing
```bash
npm test                # Run all tests (backend and frontend)
npm run test:backend    # Run backend tests with coverage
npm run test:frontend   # Run frontend tests
npm run test:workflow   # Test complete multi-agent workflow
```

## Architecture

### Multi-Agent System (5 Agents)
Located in `backend/agents/`:
1. **coordinator.js** - Validates and stores burn requests, assigns priority scores
2. **weather.js** - Fetches OpenWeatherMap data, stores weather pattern vectors
3. **predictor.js** - Calculates smoke dispersion using Gaussian plume model, detects conflicts
4. **optimizer.js** - Uses simulated annealing algorithm for schedule optimization  
5. **alerts.js** - Manages alert system, sends SMS via Twilio

### Database (TiDB)
- Connection: `backend/db/connection.js` with connection pooling and circuit breaker
- Schema: `backend/db/agent-schema.sql`
- Vector columns: `weather_pattern_embedding`, `plume_vector`, `burn_vector`
- Vector search for weather pattern matching and smoke predictions

### API Endpoints
Located in `backend/api/`:
- `/api/burn-requests` - CRUD operations for burn requests
- `/api/weather` - Weather analysis and predictions
- `/api/schedule` - Schedule optimization
- `/api/alerts` - Alert management
- `/api/farms` - Farm management
- `/api/analytics` - Dashboard metrics

### Frontend (React)
Located in `frontend/src/`:
- Main app: `App.js` with React Router
- Components: `Map.js` (Mapbox), `Dashboard.js`, `Schedule.js`, `AlertsPanel.js`, `ImprovedBurnRequestForm.js`
- Proxy configured to backend on port 5001

## External Dependencies & API Keys

**Required for functionality:**
1. **TiDB Serverless** - Database operations (set in backend/.env)
2. **OpenWeatherMap API** - Weather data (OPENWEATHERMAP_API_KEY in backend/.env)
3. **Mapbox** - Map visualization (REACT_APP_MAPBOX_TOKEN in frontend/.env)

**Optional:**
- **Twilio** - SMS alerts (TWILIO_* credentials in backend/.env)
- **OpenAI** - Enhanced embeddings (has fallback implementation)

## Key Algorithms

### Gaussian Plume Model (Smoke Dispersion)
- Implementation: `backend/agents/weather.js:predictSmokeDispersion()`
- Calculates PM2.5 concentrations at different distances
- Returns max dispersion radius and affected area

### Simulated Annealing (Schedule Optimization)
- Implementation: `backend/agents/optimizer.js:simulatedAnnealing()`
- Temperature-based optimization with neighbor generation
- Minimizes conflicts while respecting time windows

### Vector Operations
- Weather pattern embeddings: 128-dimensional vectors
- Smoke plume vectors: 64-dimensional
- Historical burn vectors: 32-dimensional
- Used for similarity search and pattern matching

## Important Implementation Details

- **Rate Limiting**: Custom implementation in `backend/middleware/rateLimiter.js` with circuit breaker
- **Connection Pooling**: TiDB connection pool with automatic retry and circuit breaker pattern
- **Real-time Updates**: Socket.io integration for live updates to farms
- **Spatial Queries**: Uses ST_* functions for geographic calculations
- **Vector Search**: Native TiDB vector columns with cosine similarity

## Testing Approach

- Unit tests: `backend/tests/agents/*.test.js` for each agent
- Integration tests: `backend/tests/integration/five-agent-workflow.test.js`
- E2E tests: `e2e-tests/` with Playwright
- Performance tests: `backend/tests/performance/*.test.js`
- Test workflow demonstration: `test-workflow.js` shows complete pipeline

## Error Handling

- Circuit breaker pattern for database connections
- Exponential backoff for API retries
- Graceful degradation when external services unavailable
- Comprehensive error logging with Winston

## Performance Considerations

- Connection pool max size: 10 connections
- Query timeout: 10 seconds
- Circuit breaker opens after 5 consecutive failures
- Rate limiting: 100 requests per 15 minutes per IP
- Strict rate limiting on expensive endpoints: 10 requests per 15 minutes

## Fire-Themed Design System

BURNWISE uses a comprehensive fire-themed design system implemented across all components:

### Core Theme (frontend/src/styles/theme.css)
- **Fire Color Palette**: #ff6b35 (primary), #ff5722 (secondary), #FFB000 (accent)
- **Glass Morphism**: `backdrop-filter: blur(20px)` with transparent backgrounds
- **Dark Theme**: Black gradient backgrounds with subtle fire accents
- **Typography**: Inter font family with multiple weights (300-900)

### Design Patterns
- **Glass Morphism Cards**: Semi-transparent cards with blur effects and fire-themed borders
- **Fire Gradients**: Used for buttons, highlights, and interactive elements
- **Consistent Spacing**: CSS variables for standardized spacing (--spacing-xs to --spacing-xl)
- **Hover Animations**: Transform and shadow effects on interactive elements

### Component Architecture
- **Cinematic Bootup**: First-visit animation with individual flame controls using Framer Motion
- **Responsive Design**: Mobile-first approach with breakpoints for tablets and desktop
- **Consistent Navigation**: Dark navbar with fire-themed logo and date selector
- **Real-time Updates**: Components update without page refresh using backend polling

### Key Components
- **Landing.js**: Video slideshow with scroll-based fade effects and cinematic bootup
- **Dashboard.js**: Analytics cards with fire-themed charts and glass morphism
- **Map.js**: Mapbox integration with fire-themed sidebar and legend
- **ImprovedBurnRequestForm.js**: Multi-step wizard with field drawing capabilities
- **Schedule.js/AlertsPanel.js**: Fire-themed data management interfaces

### Logo System
- **BurnwiseLogoPotraceExact.js**: Mathematically precise SVG logo generated via potrace
- **BurnwiseCinematicBootup.js**: Animated bootup sequence with individual flame animations
- Uses exact 1:1 recreation of original logo with proper fire gradients