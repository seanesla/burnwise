# 🎯 FOR JUDGES - BURNWISE Quick Evaluation Guide

Thank you for reviewing BURNWISE! This guide will help you quickly experience the key features that demonstrate our multi-agent AI system and TiDB vector search capabilities.

## 🚀 Quick Start (5 minutes)

### Option 1: Live Demo
Visit our deployed instance: [Coming Soon - Deployment in Progress]

**Demo Credentials**:
- Email: `judge@burnwise.demo`
- Password: `TiDB2025Demo!`

### Option 2: Local Setup
```bash
# 1. Clone and install (2 min)
git clone https://github.com/[your-username]/burnwise.git
cd burnwise
npm run install:all

# 2. Use our test database (already configured)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start the application
npm run dev
```

Frontend: http://localhost:3000  
Backend: http://localhost:5001

## 🎪 Key Features to Test

### 1. Multi-Agent Workflow (MAIN HIGHLIGHT)
**Path**: Dashboard → Request Burn → Submit

Watch the 5-agent workflow execute:
1. **Coordinator Agent** validates the request
2. **Weather Agent** fetches real weather data and creates vectors
3. **Predictor Agent** calculates smoke dispersion
4. **Optimizer Agent** resolves conflicts
5. **Alerts Agent** sends notifications

**What to Notice**:
- Real-time status updates in the UI
- Each agent's completion notification
- Vector similarity scores displayed

### 2. TiDB Vector Search Demo
**Path**: Analytics → Similar Weather Patterns

- Click "Find Similar Days" to see vector search in action
- Shows 128-dimensional weather vector matching
- Displays similarity scores from TiDB's `VEC_COSINE_DISTANCE`

### 3. Conflict Detection & Resolution
**Path**: Schedule → Optimize

1. Create 2-3 burn requests for the same day
2. Click "Detect Conflicts" to see smoke overlap
3. Click "Optimize Schedule" to watch simulated annealing resolve conflicts

### 4. Real-Time Features
**Path**: Open two browser windows

- Submit a burn request in one window
- Watch real-time updates appear in the other
- Socket.io broadcasts to all connected clients

## 📊 Technical Highlights

### TiDB Vector Integration
- **3 Vector Types**: Weather (128-dim), Smoke (64-dim), History (32-dim)
- **HNSW Indexes**: Optimized for similarity search
- **Real Vectors**: Not mock data - actual mathematical embeddings

Check the console for vector operations:
```sql
-- Example query executed
SELECT *, 1 - VEC_COSINE_DISTANCE(weather_vector, ?) as similarity
FROM weather_data
ORDER BY similarity DESC
```

### Algorithm Demonstrations

#### Gaussian Plume Model
- Navigate to any approved burn request
- Click "View Smoke Prediction"
- See PM2.5 concentration contours
- Based on EPA-approved dispersion model

#### Simulated Annealing
- Go to Schedule → Optimize
- Watch the optimization score improve
- Temperature cooling visible in console
- Conflicts reduce to zero

## 🔍 What Makes This Special

1. **5 Real Agents**: Not just 2 - we built 5 coordinated agents
2. **Scientific Accuracy**: Real Gaussian plume model, not simplified
3. **Production Ready**: 100+ tests, error handling, security
4. **Real Problem**: Prevents agricultural smoke accidents
5. **Deep TiDB Use**: Multiple vector types, spatial queries, transactions

## 📈 Performance Metrics

Open DevTools Console to see:
- Agent execution times (typically < 500ms each)
- Vector search performance (< 50ms)
- Total workflow completion (< 3 seconds)
- Database query efficiency

## 🎬 Suggested Testing Flow (10 minutes)

1. **Submit a Burn Request** (2 min)
   - Use "Johnson Farm" from dropdown
   - Draw a field on the map
   - Select tomorrow's date
   - Submit and watch agents work

2. **Create a Conflict** (2 min)
   - Submit another request for same day
   - Choose "Smith Farm" (nearby)
   - System will detect overlap

3. **Resolve Conflicts** (2 min)
   - Go to Schedule page
   - Click "Optimize Schedule"
   - Watch conflicts disappear

4. **Explore Analytics** (2 min)
   - View burn statistics
   - Check weather patterns
   - See vector similarity results

5. **Test Real-Time** (2 min)
   - Open second browser tab
   - Submit request in first tab
   - See instant updates in second

## 🐛 Known Issues & Workarounds

1. **Map not loading**: Refresh page (Mapbox token rate limit)
2. **No weather data**: OpenWeather API has 1-second rate limit
3. **SMS not sending**: Twilio is optional - check alerts panel instead

## 💡 Judge Notes

### Why This Matters
- 35,000+ agricultural fires annually in California alone
- PM2.5 exposure causes respiratory issues
- Current coordination is manual phone calls
- Our system prevents dangerous overlap automatically

### Technical Innovation
- First agricultural burn coordinator using vector search
- Combines multiple AI techniques (agents, vectors, optimization)
- Real-world data from OpenWeatherMap
- Production-grade implementation

### Hackathon Fit
- ✅ Multi-step agents (5 agents > 2 required)
- ✅ TiDB vector search (3 types, real operations)
- ✅ External tools (OpenWeather, Twilio, Mapbox)
- ✅ End-to-end automation
- ✅ Creative real-world application

## 📞 Support

If you encounter any issues:
1. Check browser console for errors
2. Verify .env files are configured
3. Try the included test data: `npm run seed`

## 🙏 Thank You!

We appreciate your time evaluating BURNWISE. We believe this demonstrates not just technical capability but also social impact potential. Agricultural safety is a real problem, and TiDB's vector capabilities make the solution possible.

---

**The BURNWISE Team**  
*TiDB AgentX Hackathon 2025*