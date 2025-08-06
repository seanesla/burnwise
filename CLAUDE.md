# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BURNWISE is a multi-farm agricultural burn coordination system for the TiDB AgentX Hackathon 2025. It uses a 5-agent workflow system with TiDB vector search capabilities to coordinate controlled burns while preventing smoke conflicts.

## Core Commands

```bash
# Development
npm run dev              # Start both backend (5001) and frontend (3000)
npm run backend:dev      # Backend only with nodemon
npm run frontend:dev     # Frontend only

# Setup & Installation  
npm run install:all      # Install all dependencies
npm run setup:check      # Verify configurations and API keys
npm run seed            # Populate database with demo data

# Testing
npm test                # Run all tests
npm run test:backend    # Backend tests with coverage
npm run test:frontend   # Frontend tests
npm run test:workflow   # Complete multi-agent workflow
cd e2e-tests && npx playwright test [--headed]
```

## Architecture

**5-Agent System** (`backend/agents/`):
1. **coordinator.js** - Validates burn requests, assigns priority scores
2. **weather.js** - Fetches OpenWeatherMap data, stores weather vectors (128-dim)
3. **predictor.js** - Gaussian plume model for smoke dispersion, conflict detection
4. **optimizer.js** - Simulated annealing for schedule optimization
5. **alerts.js** - Alert system with SMS via Twilio

**Database (TiDB)**: Connection pooling + circuit breaker (`backend/db/connection.js`), schema (`backend/db/agent-schema.sql`), vector columns for weather/smoke/burn patterns

**API Endpoints** (`backend/api/`): `/api/burn-requests`, `/api/weather`, `/api/schedule`, `/api/alerts`, `/api/farms`, `/api/analytics`

**Frontend (React)**: `App.js` with Router, key components: `Map.js` (Mapbox), `Dashboard.js`, `Schedule.js`, `AlertsPanel.js`, `ImprovedBurnRequestForm.js`

## External Dependencies & API Keys

**Required**: TiDB Serverless (backend/.env), OpenWeatherMap API (OPENWEATHERMAP_API_KEY), Mapbox (REACT_APP_MAPBOX_TOKEN in frontend/.env)
**Optional**: Twilio SMS (TWILIO_*), OpenAI embeddings (has fallback)

## Key Algorithms

**Gaussian Plume Model**: `backend/agents/weather.js:predictSmokeDispersion()` - calculates PM2.5 concentrations, max dispersion radius, affected area
**Simulated Annealing**: `backend/agents/optimizer.js:simulatedAnnealing()` - temperature-based optimization, neighbor generation, minimizes conflicts
**Vector Operations**: Weather embeddings (128-dim), smoke plumes (64-dim), historical burns (32-dim) for similarity search

## Important Implementation Details

- **Rate Limiting**: Custom implementation (`backend/middleware/rateLimiter.js`) with circuit breaker
- **Connection Pooling**: TiDB connection pool with automatic retry and circuit breaker pattern
- **Real-time Updates**: Socket.io integration for live updates to farms
- **Spatial Queries**: Uses ST_* functions for geographic calculations
- **Vector Search**: Native TiDB vector columns with cosine similarity

## Testing Approach

**Unit tests**: `backend/tests/agents/*.test.js` for each agent
**Integration**: `backend/tests/integration/five-agent-workflow.test.js`
**E2E**: `e2e-tests/` with Playwright - startup animation, navigation, icon rendering, video background
**Performance**: `backend/tests/performance/*.test.js`
**Demo**: `test-workflow.js` shows complete pipeline

## System Reliability

**Error Handling**: Circuit breaker for DB connections, exponential backoff for API retries, graceful degradation, Winston logging
**Performance**: Connection pool (max 10), query timeout (10s), circuit breaker (5 failures), rate limiting (100 req/15min, 10 req/15min for expensive endpoints)

## Fire-Themed Design System

**Colors**: #ff6b35 (primary), #ff5722 (secondary), #FFB000 (accent)
**Theme**: Glass morphism (`backdrop-filter: blur(20px)`), dark gradients, Inter font (300-900 weights)
**Animation**: Unified motion system, spring physics (Framer Motion), SVG morphing, phase management (assembly → ignition → living → flight)
**Key Components**: `FullScreenStartup.js` (cinematic bootup), `AnimatedFlameLogo.js` (navigation), `BurnwiseLogoPotraceExact.js` (3 flame fragments), `Landing.js` (video slideshow)
**CSS**: `frontend/src/styles/theme.css` for spacing variables, glass morphism cards, fire gradients, hover animations

## Development Standards

### Code Quality
- **NEVER** use profanity/offensive language in code, comments, variables, functions, or documentation
- **ALWAYS** scan codebase for CLAUDE.md violations before changes
- **NEVER** create redundant files - update/rename existing files instead
- Use descriptive naming reflecting business domain

### Git Standards
- Commit early/often, one logical change per commit
- Message: `<type>(<scope>): <subject>\n\n<body – what & why>`
- Never commit generated files, secrets, .env*, CLAUDE.md, agent configs
- PRs need description, screenshots/gifs for UI, test evidence

### Debugging Checklist
- Bug reproducible? Offending line identified? Regression tests included?
- Existing tests pass? Performance unchanged/improved? Docs updated?
- Manual QA by mimicking real user behavior?
If any box unchecked, do NOT declare issue fixed.

### Prohibited Behaviors
- Claiming code works without running it
- Large refactors without prior tests
- Mock data unless explicitly required
- Deleting code without user approval
- Experimental language features without toolchain verification

### Response Format
**Summary**: <plain-English explanation>
**Changes Made**: <bulleted list of files & functions>
**How to Test**: <commands & expected output>
**Next Steps/Questions**: <clarifications needed>

### Claude Code Notes
- Use Run Panel and sandbox, attach transcript snippets
- Run `claude test` before/after changes, paste results
- Include fully-qualified identifiers for copy-paste
- Provide ordered patch sequence for multi-file fixes

## When Unsure

STOP, ASK, AND WAIT. List concrete questions, propose assumptions, and pause until the user confirms.

## Versioning

Include this header in each future revision and update the rev date.