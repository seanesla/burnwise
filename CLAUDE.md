# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Burnwise
Multi-farm agricultural burn coordination system (TiDB AgentX Hackathon 2025). 5-agent workflow with TiDB vector search to prevent smoke conflicts. hackathon link: https://tidb-2025-hackathon.devpost.com/ 

## Commands
`npm run dev` (backend:5001+frontend:3000) | `npm run install:all` | `npm run setup:check` | `npm run seed` | `npm test` | `cd e2e-tests && npx playwright test`

### Additional Commands
- `cd backend && node scripts/create-test-user.js` - Create test user with bcrypt password
- `cd e2e-tests && npx playwright test --headed` - Run E2E tests with browser visible
- `cd e2e-tests && npx playwright test 03-spatial-interface.spec.js:24` - Run specific test line
- `npm run test:backend` - Backend unit tests only
- `npm run test:frontend` - Frontend tests only
- `npm run test:workflow` - Test complete 5-agent workflow

## Navigation: Check `.claude/` directory
`NAVIGATION.md` (file/function jumps) | `CODEBASE_MAP.md` (file tree) | `TECH_STACK.md` (libs/versions) | `DATABASE_SCHEMA.md` (TiDB/vectors) | `PATTERNS.md` (conventions) | `WORKFLOWS/` (detailed docs) | `QUICK_TASKS/` (step-by-step). Start with NAVIGATION.md.

## Architecture (REAL AGENTIC - Aug 16, 2025)

### Implementation Status
**Phase 1 COMPLETE**: OpenAI Agents SDK installed (`@openai/agents` in package.json)
**Phase 2 COMPLETE**: Building actual agents with handoffs and autonomy
**Phase 3 COMPLETE**: Chat interface, human-in-the-loop, proactive monitoring
**Phase 4 COMPLETE**: TiDB Vector Embeddings & Human-in-the-Loop Safety
**Phase 5 COMPLETE**: Revolutionary Spatial Interface - Map IS the Application (Aug 18, 2025)

### Autonomous Agent System (OpenAI Agents SDK)
**Backend Agent System** (`backend/agents-sdk/`):
- `orchestrator.js`: Main agent controller with handoff logic
- `BurnRequestAgent.js`: Natural language → structured burn request (GPT-5-nano)
- `WeatherAnalyst.js`: Autonomous SAFE/UNSAFE/MARGINAL decisions (GPT-5-nano)
- `ConflictResolver.js`: Multi-farm negotiation and mediation (GPT-5-mini for complex reasoning)
- `ScheduleOptimizer.js`: AI-enhanced simulated annealing (GPT-5-nano)
- `ProactiveMonitor.js`: 24/7 autonomous monitoring (GPT-5-nano)
- `OnboardingAgent.js`: Conversational farm setup replacing forms (GPT-5-mini)

**Legacy Functions as Tools** (`backend/agents/`):
- `coordinator.js`: Validation/scoring wrapped as tool
- `weather.js`: OpenWeatherMap API wrapped as tool
- `predictor.js`: Gaussian plume model wrapped as tool
- `optimizer.js`: Simulated annealing wrapped as tool
- `alerts.js`: Twilio SMS wrapped as tool

**Frontend Spatial Interface** (`frontend/src/components/`):
- `SpatialInterface.js`: Revolutionary map-as-application main component (Bloomberg Terminal meets Google Earth)
- `FloatingAI.js`: Draggable AI assistant bubble with glass morphism
- `DockNavigation.js`: Minimalist 4-icon bottom dock (replaced 8 tabs)
- `OnboardingChat.js`: Conversational onboarding interface using OpenAI Agents SDK
- `TimelineScrubber.js`: Temporal navigation for past/present/future burns
- `AgentChat.js`: Conversational UI with agent visualization (NO EMOJIS)
- `HandoffDiagram.js`: Visual agent delegation flow (NO EMOJIS)
- `ApprovalModal.js`: Human-in-the-loop for safety decisions (NO EMOJIS)

**Key Features**:
- **Agent Handoffs**: Real delegation using OpenAI SDK's `Handoff` class
- **Human-in-the-Loop**: `needsApproval: true` for critical burns
- **Natural Language**: Chat replaces 18-field form
- **Proactive**: Autonomous monitoring without triggers
- **Cost Optimized**: GPT-5-nano for most, GPT-5-mini only for complex reasoning

**Stack**: TiDB+circuit breaker (`db/connection.js`), Mapbox GL JS (3D terrain+fog), Framer Motion (draggable components), Socket.io, OpenAI Agents SDK, GPT-5-mini/nano | **API**: `/api/{burn-requests,weather,schedule,alerts,farms,analytics,agents}`
**Setup**: TiDB creds in `backend/.env`, OpenWeatherMap key (`OPENWEATHERMAP_API_KEY`), Mapbox token in `frontend/.env` (`REACT_APP_MAPBOX_TOKEN`), OpenAI key (`OPENAI_API_KEY`) REQUIRED

### Authentication & Data Flow
- **Real bcrypt passwords**: Test user `robert@goldenfields.com` / `TestPassword123!`
- **NO DEMO MODE**: All authentication is production-ready
- **Data flow**: TiDB → Backend API → Frontend (no hardcoding)
- **Seed data**: Robert Wilson is legitimate farm owner in TiDB, not mocked

## Technical Specs
**Algorithms**: Gaussian plume (`predictor.js:predictSmokeDispersion()`), simulated annealing (`optimizer.js:simulatedAnnealing()`)
**Vectors**: Weather 128-dim (text-embedding-3-large), smoke 64-dim, burns 32-dim | **Reliability**: Circuit breaker (5 fail), rate limit (100/15min), pool (max 10)
**Testing**: Unit (`backend/tests/agents/`), Integration (`five-agent-workflow.test.js`), E2E (Playwright) | **UI**: Spatial map-centric interface, glass morphism, NO TRADITIONAL NAVIGATION, draggable floating panels

### E2E Test Pattern
```javascript
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'robert@goldenfields.com');
  await page.fill('input[type="password"]', 'TestPassword123!');
  await page.click('button:has-text("Sign In")');
  
  // Handle onboarding if it appears
  if ((await page.url()).includes('onboarding')) {
    await page.click('button:has-text("Skip Setup")');
  }
  
  await page.waitForURL('**/spatial');
});
```

## Cost Optimization (CRITICAL FOR TESTING)
**GPT-5 Pricing** (per 1M tokens):
- GPT-5-mini: $0.25 input / $2.00 output
- GPT-5-nano: $0.05 input / $0.40 output (80% cheaper)
- text-embedding-3-large: $0.065

**CRITICAL GPT-5-nano Discovery (Aug 16, 2025)**:
GPT-5-nano is FUNDAMENTALLY INCOMPATIBLE with structured JSON tasks:
- 🚨 **BREAKING**: Uses ALL `max_completion_tokens` for reasoning, ZERO tokens for output
- 🚨 **EVIDENCE**: Even with 4000 tokens, returns `"reasoning_tokens": 4000, "content": ""`
- 🚨 **ROOT CAUSE**: Reasoning model spends 100% token budget on internal thinking
- 🚨 **SOLUTION**: Use GPT-5-mini for ANY task requiring guaranteed JSON completion
- ⚠️ **SAFE USES**: Simple text generation, creative tasks (NOT structured data)

**Development Strategy** (UPDATED Aug 16, 2025):
- Use GPT-5-mini for BurnRequestAgent & ConflictResolver (need guaranteed JSON completion)
- Use GPT-5-nano for WeatherAnalyst, ScheduleOptimizer, ProactiveMonitor (text responses only)
- Cache responses aggressively (avoid duplicate API calls)
- Mock in development: `if (NODE_ENV === 'development') return mockResponse`
- Total estimated cost for full testing: ~$5-8 (higher due to GPT-5-mini for JSON tasks)

**Agent Token Budgets** (UPDATED Aug 16, 2025):
- BurnRequestAgent: 1000 max tokens (mini) - JSON extraction, nano incompatible
- WeatherAnalyst: 1500 max tokens (nano) - safety analysis, text only
- ConflictResolver: 1000 max tokens (mini) - complex reasoning + JSON output
- ScheduleOptimizer: 1500 max tokens (nano) - optimization logic, text only
- ProactiveMonitor: 1000 max tokens (nano) - monitoring decisions, text only

## Revolutionary UI Design (SPATIAL INTERFACE - Aug 18, 2025)
**MAP-AS-APPLICATION**: No traditional pages - the map IS the entire interface
**SPATIAL INTERACTIONS**: Click farms directly, drag to create burn zones, hover for real-time stats
**FLOATING PANELS**: Draggable AI assistant, farm info cards with spring physics (Framer Motion)
**DOCK NAVIGATION**: 4 essential icons at bottom (replaced 8 tabs) - Map Controls, AI Assistant, Active Burns, Settings
**TIMELINE SCRUBBER**: Scrub through past/present/future burns like video editing
**3D PERSPECTIVE**: 45° pitch, terrain exaggeration, atmospheric fog for immersive experience
**NO COMMAND PALETTE**: User rejected cmdk - keep it spatial and visual
**UNCONVENTIONAL**: Like Bloomberg Terminal meets Google Earth - farmers think spatially about land

## Interactive Tutorial System (NEW Aug 21, 2025)
**IMPLEMENTATION**: Glass morphism tooltips guide users through key features
**AUTO-START**: Launches automatically for new users after 2-second delay
**STEPS**: Welcome → Map interaction → AI Assistant → Dock → Timeline → Farm interaction → Complete
**DESIGN**: Semi-transparent overlays with backdrop blur, orange accent highlights
**PERSISTENCE**: Stores completion in localStorage, resettable via (?) button
**COMPONENTS**: `InteractiveTutorial.js` + `InteractiveTutorial.css` in spatial interface
**NO EMOJIS**: Professional tutorial text without emoji usage

## Conversational Onboarding System (NEW Aug 21, 2025)
**IMPLEMENTATION**: OpenAI Agents SDK replaces traditional form-based onboarding
**AGENT**: `OnboardingAgent.js` uses GPT-5-mini for structured data extraction
**TOOLS**: `save_farm_data`, `validate_location`, `check_email_availability`
**CONVERSATION**: Natural language interface asks questions one at a time
**DATA COLLECTION**: Farm name, owner, email, location, acreage, crops, burn preferences
**NO FALLBACKS**: Pure AI-driven - if AI unavailable, onboarding cannot proceed (architectural decision)
**STORAGE**: Creates farm record in TiDB with preferences in farm_preferences table
**UI**: Chat interface with glass morphism matching spatial interface design
**SESSION**: Maintains conversation state for 30-minute sessions
**REQUIREMENTS**: All Zod schema fields must use `.nullable()` not `.optional()` for OpenAI SDK
**PHILOSOPHY**: No compromises - real AI or nothing, aligns with hackathon focus on genuine AI agents

## Development Standards

### AI/ML Verification (CRITICAL FOR HACKATHON)
**NEVER**: Claim "AI" without ML/neural networks/LLMs | Call algorithms "AI agents" without ML | Use fake/pseudo-random "embeddings"
**ALWAYS**: Verify AI actually working (check API keys set, ML libs installed, API calls made, responses from AI not fallbacks)
**DISTINGUISH**: Classical algorithms (Gaussian/SA)≠AI | Rule-based (if/else)≠AI | Math models≠AI | ML/Neural/LLM=AI
**BEFORE CLAIMING AI**: Run code+monitor API usage | Check network requests | Verify semantic embeddings | Ensure no hardcoded predictions

### Agentic Development Standards (NEW Aug 15, 2025)
**TRUE AGENTS**: Use OpenAI Agents SDK for autonomous decision-making | Implement handoffs between specialists | Add human-in-the-loop for critical decisions
**NOT AGENTS**: Sequential function calls | Simple API wrappers | Hardcoded decision trees
**AGENT FEATURES**: Natural language understanding | Autonomous decisions (not just calculations) | Proactive monitoring | Context awareness across conversations
**USER EXPERIENCE**: Conversational > Forms | One question at a time | Remember context | Suggest don't demand

### Code Quality
**NEVER**: Use profanity/offensive language | Create redundant files | Claim code works without running
**ALWAYS**: Scan for CLAUDE.md violations | Update/rename existing files | Update `.claude/` context when structure changes | Use descriptive naming | NO EMOJIS ANYWHERE IN FRONTEND (use AnimatedFlameLogo component instead)

### Git Standards
Commit: early/often, one logical change | Message: `<type>(<scope>): <subject>\n\n<body-what&why>` | Never commit: generated files, secrets, .env*, CLAUDE.md, agent configs | PRs need: description, screenshots/gifs for UI, test evidence

### Debugging Checklist
Bug reproducible? Line identified? Regression tests? Existing tests pass? Performance OK? Docs updated? Manual QA done? If any unchecked, NOT fixed.

### Prohibited Behaviors
Claiming code works without running | Large refactors without tests | Mock data unless required | Deleting code without approval | Experimental features without verification

### Response Format
**Summary**: plain-English | **Changes**: files & functions | **Test**: commands & output | **Next**: questions/clarifications

### Claude Code Notes
Use Run Panel+sandbox, attach transcripts | Run `claude test` before/after | Include fully-qualified identifiers | Provide ordered patch sequence

## User Context
**IMPORTANT**: User is a BEGINNER programmer. Always:
- Explain technical concepts in simple terms with examples
- Break down complex tasks into small, manageable steps
- Anticipate common beginner mistakes and warn about them
- Provide context for WHY something is done, not just HOW
- Use analogies to explain programming concepts
- Define jargon/acronyms on first use
- Show expected output/behavior after changes
- Explain error messages in plain English
- Suggest learning resources when introducing new concepts

## When Unsure
STOP, ASK, AND WAIT. List concrete questions, propose assumptions, pause until user confirms.

USE "date" in terminal to verify today's date to bypass your knowledge cutoff date!!!