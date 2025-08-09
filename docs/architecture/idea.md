# Claude Code Implementation Prompt for BURNWISE

## Project Context
I'm building BURNWISE for the TiDB AgentX Hackathon 2025. This is a Multi-Farm Agricultural Burn Coordinator that prevents deaths from uncoordinated agricultural burns by enabling farms to schedule burns collaboratively.

## Core Requirements from Hackathon
- **Multi-step agentic workflow** with at least 2 chained operations
- **TiDB Serverless** with vector search capabilities
- **Working application**, not a demo
- **Video demo** under 4 minutes
- **Deadline**: September 15, 2025

## Your Implementation Mission

### Phase 1: Project Setup & Database (Hour 0-2)
```
claude "Create a new Node.js project called burnwise with Express backend and React frontend. Set up the following structure:
- backend/ (Node.js + Express)
  - agents/ (5 separate agent modules)
  - db/ (TiDB connection and schemas)
  - api/ (REST endpoints)
  - utils/ (smoke modeling, spatial calculations)
- frontend/ (React + Mapbox)
- tests/ (Jest tests for each component)"
```

Then:
```
claude "Create the TiDB schema from this DDL and establish connection:
[paste the exact schema from the document]
Important: Use these environment variables:
TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE
Create a .env.example file with all required API keys"
```

### Phase 2: Weather Analysis Agent (Hour 2-4)
```
claude "Implement the Weather Analysis Agent in backend/agents/weather.js that:
1. Fetches real weather data from OpenWeatherMap API
2. Stores wind patterns as vectors in TiDB using vector embeddings
3. Predicts smoke dispersion patterns using simplified Gaussian plume model
4. Returns JSON with wind speed, direction, and dispersion predictions
Test with real API calls and show me the actual response"
```

### Phase 3: Burn Request Coordinator (Hour 4-6)
```
claude "Build the Burn Request Coordinator in backend/agents/coordinator.js that:
1. Accepts burn requests via POST /api/burn-requests
2. Validates farm ownership and burn permits
3. Stores field geometry using TiDB spatial features
4. Generates terrain feature vectors from location data
5. Returns request ID and initial safety assessment
Create a test script that submits 3 real burn requests"
```

### Phase 4: Smoke Overlap Predictor (Hour 6-8)
```
claude "Create the Smoke Overlap Predictor in backend/agents/predictor.js that:
1. Queries upcoming burns within 50km radius using spatial queries
2. Calculates smoke plume intersections using vector math
3. Identifies conflicts where PM2.5 exceeds safe levels
4. Uses TiDB vector similarity to find similar weather patterns
Show me actual conflict detection between two burns"
```

### Phase 5: Schedule Optimizer (Hour 8-10)
```
claude "Implement the Schedule Optimizer in backend/agents/optimizer.js using:
1. Constraint satisfaction algorithm for multi-farm scheduling
2. Graph-based approach to minimize smoke overlap
3. Time window constraints from weather data
4. Priority scoring based on crop type and urgency
Test with 5 farms requesting burns on same day"
```

### Phase 6: Alert & Trading System (Hour 10-12)
```
claude "Build the Alert System in backend/agents/alerts.js that:
1. Sends SMS via Twilio when burns are scheduled
2. Notifies neighbors of smoke predictions
3. Implements burn window trading mechanism
4. Stores trades in burn_trades table
Set up Twilio sandbox and send a test SMS"
```

### Phase 7: Frontend Dashboard (Hour 12-16)
```
claude "Create a React dashboard in frontend/ with:
1. Mapbox map showing farms and burn areas
2. Real-time smoke plume visualization
3. Burn request submission form
4. Schedule calendar view
5. Air quality monitoring integration
Use real map data and show smoke dispersion animation"
```

### Phase 8: Integration Testing (Hour 16-18)
```
claude "Write comprehensive integration tests that:
1. Submit burn request for Farm A
2. Submit conflicting request for Farm B
3. Show conflict detection and resolution
4. Demonstrate schedule optimization
5. Trigger SMS alerts
6. Display results on map
Run all tests and show me passing results"
```

## Critical Implementation Rules

1. **NO FAKE DATA**: Every API call must be real. Use:
   - OpenWeatherMap free tier (1000 calls/day)
   - Mapbox free tier (200k tiles/month)
   - Twilio trial account
   - NOAA HYSPLIT public API

2. **VECTOR SEARCH REQUIREMENTS**: 
   ```
   claude "Show me how you're using TiDB vector search by:
   1. Storing weather pattern embeddings
   2. Finding similar historical conditions
   3. Calculating smoke pattern similarities
   Include the actual SQL queries with vector operations"
   ```

3. **MULTI-STEP WORKFLOW PROOF**:
   ```
   claude "Demonstrate the complete workflow:
   Input: Farm submits burn request
   Step 1: Weather agent fetches conditions (show API response)
   Step 2: Coordinator stores in TiDB (show inserted row)
   Step 3: Predictor finds conflicts (show vector similarity query)
   Step 4: Optimizer reschedules (show algorithm output)
   Step 5: Alerts sent (show Twilio response)
   Output: Optimized schedule with SMS confirmation"
   ```

4. **ERROR HANDLING**:
   ```
   claude "Add proper error handling for:
   - API rate limits
   - Invalid geometries
   - Weather data unavailable
   - SMS delivery failures
   Show me the error handling in action"
   ```

## Verification Commands

After each major component:
```
claude "Run the following verification:
1. Show me the actual database records created
2. Make a real API call and display the response
3. Execute the unit tests for this module
4. Log the performance metrics"
```

## Final Demo Script
```
claude "Create a demo script that:
1. Seeds database with 10 realistic farms
2. Submits 5 burn requests for same date
3. Shows conflict detection in console
4. Displays optimized schedule
5. Sends actual SMS notifications
6. Updates map with smoke predictions
Record terminal output for video"
```

## When You Need Clarification

Instead of implementing placeholders, ask:
```
claude -p "I need clarification on [specific issue]. Should I:
Option A: [describe approach]
Option B: [describe alternative]
What's the correct implementation for the hackathon?"
```

## Remember
- This is a hackathon - code quality matters but working features matter more
- Judges will test the app - everything must actually function
- Use TiDB's vector search prominently - it's a key judging criterion
- The multi-step workflow must be clearly demonstrated
- Keep the video under 4 minutes showing real functionality

Start with: `claude "Let's begin by creating the project structure and installing dependencies. Show me each file created."`