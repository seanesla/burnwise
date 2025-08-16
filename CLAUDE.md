## Project: BURNWISE
Multi-farm agricultural burn coordination system (TiDB AgentX Hackathon 2025). 5-agent workflow with TiDB vector search to prevent smoke conflicts. hackathon link: https://tidb-2025-hackathon.devpost.com/ 

## Commands
`npm run dev` (backend:5001+frontend:3000) | `npm run install:all` | `npm run setup:check` | `npm run seed` | `npm test` | `cd e2e-tests && npx playwright test`

## Navigation: Check `.claude/` directory
`NAVIGATION.md` (file/function jumps) | `CODEBASE_MAP.md` (file tree) | `TECH_STACK.md` (libs/versions) | `DATABASE_SCHEMA.md` (TiDB/vectors) | `PATTERNS.md` (conventions) | `WORKFLOWS/` (detailed docs) | `QUICK_TASKS/` (step-by-step). Start with NAVIGATION.md.

## Architecture (REAL AGENTIC - Aug 16, 2025)

### Implementation Status
**Phase 1 COMPLETE**: OpenAI Agents SDK installed (`@openai/agents` in package.json)
**Phase 2 IN PROGRESS**: Building actual agents with handoffs and autonomy
**Phase 3 PLANNED**: Chat interface, human-in-the-loop, proactive monitoring

### Autonomous Agent System (OpenAI Agents SDK)
**Backend Agent System** (`backend/agents-sdk/`):
- `orchestrator.js`: Main agent controller with handoff logic
- `BurnRequestAgent.js`: Natural language → structured burn request (GPT-5-nano)
- `WeatherAnalyst.js`: Autonomous SAFE/UNSAFE/MARGINAL decisions (GPT-5-nano)
- `ConflictResolver.js`: Multi-farm negotiation and mediation (GPT-5-mini for complex reasoning)
- `ScheduleOptimizer.js`: AI-enhanced simulated annealing (GPT-5-nano)
- `ProactiveMonitor.js`: 24/7 autonomous monitoring (GPT-5-nano)

**Legacy Functions as Tools** (`backend/agents/`):
- `coordinator.js`: Validation/scoring wrapped as tool
- `weather.js`: OpenWeatherMap API wrapped as tool
- `predictor.js`: Gaussian plume model wrapped as tool
- `optimizer.js`: Simulated annealing wrapped as tool
- `alerts.js`: Twilio SMS wrapped as tool

**Frontend Chat Interface** (`frontend/src/components/`):
- `AgentChat.js`: Conversational UI with agent visualization (IN PROGRESS)
- `HandoffDiagram.js`: Visual agent delegation flow
- `ApprovalModal.js`: Human-in-the-loop for safety decisions

**Key Features**:
- **Agent Handoffs**: Real delegation using OpenAI SDK's `Handoff` class
- **Human-in-the-Loop**: `needsApproval: true` for critical burns
- **Natural Language**: Chat replaces 18-field form
- **Proactive**: Autonomous monitoring without triggers
- **Cost Optimized**: GPT-5-nano for most, GPT-5-mini only for complex reasoning

**Stack**: TiDB+circuit breaker (`db/connection.js`), React Router+Mapbox (`Map.js`), Socket.io, OpenAI Agents SDK, GPT-5-mini/nano | **API**: `/api/{burn-requests,weather,schedule,alerts,farms,analytics,agents}`
**Setup**: TiDB creds in `backend/.env`, OpenWeatherMap key (`OPENWEATHERMAP_API_KEY`), Mapbox token in `frontend/.env` (`REACT_APP_MAPBOX_TOKEN`), OpenAI key (`OPENAI_API_KEY`) REQUIRED

## Technical Specs
**Algorithms**: Gaussian plume (`predictor.js:predictSmokeDispersion()`), simulated annealing (`optimizer.js:simulatedAnnealing()`)
**Vectors**: Weather 128-dim (text-embedding-3-large), smoke 64-dim, burns 32-dim | **Reliability**: Circuit breaker (5 fail), rate limit (100/15min), pool (max 10)
**Testing**: Unit (`backend/tests/agents/`), Integration (`five-agent-workflow.test.js`), E2E (Playwright) | **UI**: Fire theme, glass morphism, `FullScreenStartup.js`

## Cost Optimization (CRITICAL FOR TESTING)
**GPT-5 Pricing** (per 1M tokens):
- GPT-5-mini: $0.25 input / $2.00 output
- GPT-5-nano: $0.05 input / $0.40 output (80% cheaper)
- text-embedding-3-large: $0.065

**Development Strategy**:
- Use GPT-5-nano for all agents except ConflictResolver
- Cache responses aggressively (avoid duplicate API calls)
- Mock in development: `if (NODE_ENV === 'development') return mockResponse`
- Total estimated cost for full testing: ~$1-2

**Agent Token Budgets**:
- BurnRequestAgent: 500 max tokens (nano)
- WeatherAnalyst: 300 max tokens (nano)
- ConflictResolver: 1000 max tokens (mini - needs complex reasoning)
- ScheduleOptimizer: 400 max tokens (nano)
- ProactiveMonitor: 200 max tokens (nano)

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
**ALWAYS**: Scan for CLAUDE.md violations | Update/rename existing files | Update `.claude/` context when structure changes | Use descriptive naming | DO NOT USE EMOJIS |

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