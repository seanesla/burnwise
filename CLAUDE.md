# CLAUDE.md
Guidance for Claude Code when working with this codebase.

## Burnwise - TiDB AgentX Hackathon 2025
Multi-farm burn coordination. 5-agent workflow + TiDB vectors prevent smoke conflicts. https://tidb-2025-hackathon.devpost.com/

## Commands
**Main**: `npm run dev` (ports 5001+3000) | `npm run install:all` | `npm run setup:check` | `npm run seed` | `npm test`
**Testing**: `test:backend` | `test:frontend` | `test:workflow` | E2E: `cd e2e-tests && npx playwright test [--headed] [file:line]`
**Utils**: Demo sessions auto-created (no test user needed)

## Navigation
`.claude/`: NAVIGATION.md | CODEBASE_MAP.md | TECH_STACK.md | DATABASE_SCHEMA.md | PATTERNS.md | WORKFLOWS/ | QUICK_TASKS/

## Architecture

### 5-Agent System (OpenAI Agents SDK)
**backend/agents-sdk/**: orchestrator | BurnRequestAgent (mini) | WeatherAnalyst (nano) | ConflictResolver (mini) | ScheduleOptimizer (nano) | ProactiveMonitor (nano) | OnboardingAgent (mini)
**backend/agents/**: coordinator | weather | predictor | optimizer | alerts (GPT-5-mini AI + Socket.io)
**Features**: Real handoffs | Human-in-loop (`needsApproval`) | Natural language | Proactive monitoring | NO EMOJIS

### Spatial UI (Map IS Application)
**frontend/src/components/**: SpatialInterface | FloatingAI | DockNavigation (5 icons) | TimelineScrubber | AgentChat | HandoffDiagram | ApprovalModal | InteractiveTutorial | OnboardingChat | BackendMetrics
**Design**: Bloomberg Terminal × Google Earth | 3D terrain+fog | Glass morphism | Spring physics | NO traditional navigation
**Backend Visibility**: Real-time metrics panel shows TiDB queries, cache performance, operations via Socket.io
**Dynamic Weather**: Weather updates based on map center when zoom >= 14 (~2 miles). Real OpenWeatherMap API only. 500ms debounce.

### Stack & Setup
**Tech**: TiDB+circuit breaker | Mapbox GL | Framer Motion | Socket.io | OpenAI SDK | GPT-5-mini/nano
**ENV**: TiDB creds | OPENWEATHERMAP_API_KEY | REACT_APP_MAPBOX_TOKEN | OPENAI_API_KEY
**API**: `/api/{burn-requests,weather,schedule,alerts,farms,analytics,agents}`

### Auth & Data
- Demo-only system (NO real accounts)
- Auto-creates sessions on app load
- 24-hour temporary data
- TiDB → Backend → Frontend (no hardcoding)
- NO notifications of any kind (no email, SMS, or alerts)

## Technical
**Algorithms**: Gaussian plume | Simulated annealing
**Vectors**: Weather 128D | Smoke 64D | Burns 32D (text-embedding-3-large)
**Reliability**: Circuit breaker (5 fail) | Rate limit (100/15min) | Pool (max 30)
**Monitoring**: Real-time Socket.io events for queries, cache, performance | BackendMetrics panel in UI

## GPT-5 Cost & Usage
**Pricing/1M**: mini $0.25/$2.00 | embedding $0.065
**SIMPLIFIED**: All agents use gpt-5-mini for consistency and JSON compatibility
**Usage**: gpt-5-mini for all agents | Cache aggressively | Mock in dev
**Budgets**: All agents 1000 tokens (mini) | Coordinator/Predictor/Alerts handle JSON | Weather/Optimizer handle text

## E2E Test Pattern
```javascript
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Auto-redirects to onboarding or spatial
  if ((await page.url()).includes('onboarding'))
    await page.click('button:has-text("Skip Setup")');
  await page.waitForURL('**/spatial');
});
```

## Standards

### AI Verification
**Real AI**: ML/Neural/LLM only | Verify API calls | Check embeddings | No hardcoded predictions
**Not AI**: Classical algorithms | Rule-based | Math models without ML

### True Agents
**Yes**: OpenAI SDK | Autonomous decisions | Handoffs | Human-in-loop | Proactive | Context aware
**No**: Sequential calls | API wrappers | Decision trees | Simple calculations

### Code Quality
**Never**: Profanity | Redundant files | Untested claims | Emojis in frontend
**Always**: Update existing files | Test before claiming | Update .claude/ | Descriptive naming

### Git
**Commit**: `<type>(<scope>): <subject>` | Early & often | One logical change
**Never commit**: .env* | CLAUDE.md | Generated files | Secrets

### Debug Checklist
Reproducible? → Line identified? → Tests written? → Performance OK? → Docs updated? → Manual QA?

### Response Format
Summary → Changes (files/functions) → Test (commands/output) → Next steps

## User = BEGINNER
- Simple explanations with examples
- Small steps
- Warn about mistakes
- Explain WHY not just HOW
- Use analogies
- Define jargon
- Show expected output
- Plain English errors

## When Unsure
STOP, ASK, WAIT. List questions, propose assumptions, pause for confirmation.

Use `date` command to verify current date!