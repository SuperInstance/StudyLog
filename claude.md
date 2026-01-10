# StudyLoG.AI by SuperInstance.AI - Build Manifest

## North Star

**The Minecraft of generative AI** — a self-generating ecosystem where:
- AI creates simulations at any quality level
- Community shares, rates, and improves creations
- Forking works like GitHub — take it, make it yours
- Good teachers earn reputation through feedback

---

## Agent Orchestration

The system uses agent-based orchestration for task distribution and coordination.

### Agent Roles

| Agent | Role | Icon | Description |
|-------|------|------|-------------|
| **Captain** | Game simulation, NPC behavior | `fa-anchor` | Handles game-related queries and scenarios |
| **Teacher** | Explanations, hints, tutoring | `fa-graduation-cap` | Provides educational content and guidance |
| **Builder** | Code generation and review | `fa-hammer` | Generates and validates code |
| **Tester** | Verification, error analysis | `fa-check-circle` | Tests and verifies implementations |
| **Director** | Orchestration, meta-questions | `fa-sitemap` | Coordinates other agents and handles complex requests |

### Agent Selection Flow

```
User Query
    ↓
[first-mile-router] → Intent Classification
    ↓
[Multi-Model Router] → Provider Selection
    ↓
[Appropriate Agent] → Task Execution
    ↓
Response + Cost Tracking
```

### Completed Implementation Phases

**Phase 1: Foundation (2026-01-10) - Complete:**
- ✅ si-gassist extension skeleton (widget, service, module, styles)
- ✅ first-mile-router worker with intent classification
- ✅ g-assist-api worker (route/chat/stt/tts endpoints)
- ✅ Cascade router integration in multi-model-router
- ✅ IMPLEMENTATION.md documentation

**Phase 2: Voice & Cost Tracking (2026-01-10) - Complete:**
- ✅ Voice input for G-Assist widget (MediaRecorder API, audio visualizer)
- ✅ Cost tracking dashboard implementation
- ✅ Backend /costs/cascade endpoint in multi-model-router
- ✅ COMPONENTS.md rolodex of reusable components

**Phase 3: Documentation (2026-01-10) - Complete:**
- ✅ Main README.md with project overview
- ✅ docs/INDEX.md documentation hub
- ✅ docs/ARCHITECTURE.md system design
- ✅ CONTRIBUTING.md guidelines
- ✅ ADR-001 through ADR-004 architecture decisions

**Phase 4: Bazaar (Complete):**
- ✅ si-bazaar extension
- ✅ Bazaar worker API
- ✅ D1 database schema for creations, users, feedback
- ✅ Fork and merge request flows

---

## Quick Start

```bash
# Install deps
pnpm install

# Development (all services)
pnpm dev

# Build
pnpm build

# Deploy backend
pnpm backend:deploy
```

---

## Project Structure

```
studylog-github/
├── README.md                  # Main project README
├── CLAUDE.md                  # This build manifest
├── CONTRIBUTING.md            # Contribution guidelines
├── COMPONENTS.md              # Component reference
├── IMPLEMENTATION.md          # Implementation status
├── ROADMAP.md                 # Development roadmap
├── docs/                      # Documentation
│   ├── INDEX.md               # Documentation index
│   ├── ARCHITECTURE.md        # System architecture
│   ├── API_REFERENCE.md       # API documentation
│   ├── DEPLOYMENT.md          # Deployment guide
│   ├── TROUBLESHOOTING.md     # Troubleshooting guide
│   └── adr/                   # Architecture Decision Records
│       ├── ADR-001-cascade-routing-architecture.md
│       ├── ADR-002-theia-extension-architecture.md
│       ├── ADR-003-cloudflare-workers-backend.md
│       └── ADR-004-agent-based-voice-assistant.md
├── apps/theia-ide/            # Theia IDE application
│   └── extensions/            # Theia extensions
│       ├── si-gassist/        # Voice assistant widget
│       ├── si-multi-model/    # Multi-model router UI
│       ├── si-godot-embed/    # Godot panel embedding
│       ├── si-agent-director/ # Agent orchestration
│       ├── si-cognitive-mill/ # AI learning module
│       ├── si-intelligence-ranch/ # Agent training
│       ├── si-sitka-sound/    # Multi-agent ecosystems
│       ├── si-a2ui-renderer/  # Agent-to-UI protocol
│       └── si-bazaar/         # Community marketplace
├── backend/workers/           # Cloudflare Workers
│   ├── first-mile-router/     # Intent classification
│   ├── multi-model-router/    # LLM routing with fallbacks
│   ├── g-assist-api/          # Voice assistant backend
│   ├── code-generator/        # AI code generation
│   └── bazaar/                # Community API
├── backend/d1/                # D1 database schemas
│   ├── schema.sql             # Main schema
│   └── seed-bazaar.sql        # Bazaar seed data
├── packages/                  # Shared packages
│   ├── agents/                # Agent utilities
│   ├── hardware/              # Hardware detection
│   └── ollama/                # Ollama integration
├── config/                    # Configuration files
└── scripts/                   # Utility scripts
```

---

## Core Principles

1. **Every Layer is a Mill** — components transform inputs to outputs
2. **Progressive Disclosure** — Toy → Guide → Scribe → Forge
3. **No Code Lies** — all AI output verifiable
4. **Community First** — share, fork, merge, improve
5. **Work Ratio Transparency** — show AI vs human contribution

---

## The Bazaar (Community Platform)

### Features
- Share any simulation/puzzle/agent to community
- Like and comment on creations
- Fuse Grade verification (community quality levels 1-4)
- Fork any public creation
- Merge requests (creator approval)
- Grain tokens for valuable contributions

### Millfile Format
Every creation has a `Millfile.toml`:

```toml
[meta]
title = "Basic Circuit Simulator"
author = "learner123"
quality = 2  # 1=experimental, 2=working, 3=verified, 4=excellent

[simulation]
godot_version = "4.3"
scene = "circuit_simulator.tscn"

[ai]
model_used = "claude-opus-4-5"
work_ratio = 0.73  # AI did 73%
verified = true

[permissions]
fork_enabled = true
merge_enabled = true
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| IDE Shell | Theia 1.54+ |
| Language | TypeScript 5.7+ |
| Build | Turborepo 2.3+ |
| Backend | Cloudflare Workers |
| Database | D1 (SQLite) |
| Storage | R2, KV, Vectorize |
| Simulation | Godot 4.3 |
| Runtime | Node.js 20+ |

---

## Roadmap Phases

### Phase 1: Foundation (Complete)
- Theia shell working
- Godot panel embedding
- Multi-model router with cascade
- Agent dashboard
- Voice assistant (G-Assist)

### Phase 2: Code Generation (Complete)
- AI generates Theia extensions
- AI generates Godot scenes
- Quality selector (fast/cheap to slow/premium)
- Work ratio transparency
- Verification + rollback
- Generation history

### Phase 3: Bazaar (Complete)
- User profiles + reputation
- Share to community
- Like/comment system
- Fork/merge flows
- Grain token economy
- Fuse Grade verification

### Phase 4: Self-Generation (Planned)
- AI generates puzzles from progress
- AI remixes two creations
- Seasonal challenges
- Leaderboards
- Quality sorting

### Phase 5: Multi-Product (Planned)
- DMLoG.AI - TTRPG with AI agents
- MakerLoG.AI - IoT/Robotics marketplace
- FishingLoG.AI - Ecological simulation
- Unified authentication
- Cross-product asset sharing

---

## When Working Here

1. **StudyLoG.AI is reference** — build education-first
2. **Product-agnostic** — would DMLoG.AI use this?
3. **Simulate first** — can it be simulated before deployed?
4. **Bazaar mindset** — could this be shared, rated, forked?
5. **Progressive complexity** — beginners see simple, experts see power

---

## Commands

```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run tests
pnpm typecheck        # Type check
pnpm lint             # Lint
pnpm backend:dev      # Backend only
pnpm backend:deploy   # Deploy to Cloudflare
```

---

**Remember**: We're building a network of thinkers and makers who create products on tools they grew up playing with.
