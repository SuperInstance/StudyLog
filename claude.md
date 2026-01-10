# StudyLoG.AI by SuperInstance.AI - Claude Code Master Prompt

## Company Vision

**SuperInstance.AI** is the backend platform that powers a family of gamified frontends. We are building **the Minecraft of generative agent-based open worlds and STEM** — a network of thinkers and makers who design products on tools they grew up playing with.

---

## The Ecosystem

### Backend Platform
**SuperInstance.AI** — The unified backend combining:
- Multi-model AI router (LLM → image → 3D → ACE)
- Godot engine integration for live visualization
- Agent orchestration and progressive unlock systems
- Marketplace infrastructure for parts, manufacturing, and services

### Frontend Products (StudyLoG.AI First)

| Product | Focus | Status |
|---------|-------|--------|
| **StudyLoG.AI** | Education — AI/STEM learning through progressive simulation | 🔴 BUILDING NOW |
| **DMLoG.AI** | TTRPG — DM prep, practice, visualization with agents as players | Planned |
| **MakerLoG.AI** | IoT/Robotics — Gamified product development, 3D printing marketplace | Planned |
| **FishingLoG.AI** | Fishing simulation (Sitka Sound ecological engine) | Partial |
| **ActiveLoG.AI** | Fitness | Planned |
| **RealLoG.AI** | Content creation | Planned |
| **PlayerLoG.AI** | Pure gaming | Planned |

---

## The Killer Feature

**These are all fronts.** Users can:
1. Try multiple products
2. Learn the underlying tools
3. Create their own products/experiences
4. **Monetize** — we earn when they earn

Eventually: certification paths, revenue sharing, open-source marketplace with reputation systems for:
- 3D printer workshops
- Assembly centers
- Parts depots
- Product simulators (try before you buy)

---

## Current Project: StudyLoG.AI

We are building a **Cursor-class IDE on Theia** that the player/developer can customize — even the IDE itself. This foundation will evolve to fit our needs across all products.

### StudyLoG.AI Stages
1. **Cognitive Mill** — Learn how AI models work
2. **Intelligence Ranch** — Train and breed AI agents
3. **Sitka Sound** — Multi-agent systems and game theory
4. **Digital Twins** — Hardware deployment with NVIDIA acceleration

---

## Architecture Mantra

**"Every layer is a mill. Every agent is a millwright. Every user graduates to building mills."**

---

## Design Principles for Backend

1. **Product-Agnostic Core** — Backend must serve StudyLoG.AI now but adapt easily to DMLoG, MakerLoG, etc.
2. **Maximal Customizability** — Users can fork, modify, and create their own versions
3. **Simulation First** — Everything can be simulated before deployment
4. **Open Marketplace Ready** — Rating, reputation, and transaction infrastructure baked in
5. **Progressive Disclosure** — Complex tools unlock through mastery, not complexity

---

## Repository Structure

```
studylog/
├── apps/
│   └── theia-ide/              # Theia IDE application
│       ├── extensions/         # Theia extensions
│       │   ├── si-cognitive-mill/     # Arduino simulation (from local)
│       │   ├── si-agent-director/     # Agent dashboard (from local)
│       │   ├── si-godot-embed/        # Godot embedding (from local)
│       │   ├── si-intelligence-ranch/  # Agent breeding (from GitHub)
│       │   ├── si-a2ui-renderer/       # Agent-to-UI protocol (from GitHub)
│       │   ├── si-sitka-sound/         # Ecological simulation (from local)
│       │   └── si-multi-model/         # Multi-model router (from local)
│       ├── browser-app/        # Web version
│       └── electron-app/       # Desktop version
├── packages/                   # Shared packages
│   ├── agents/                 # AI Agent system + A2UI components
│   ├── hardware/               # Hardware detection
│   └── ollama/                 # Ollama integration
├── backend/                    # Cloudflare Workers backend
│   ├── workers/                # API endpoints + specialized workers
│   ├── d1/                     # Database schemas
│   └── wrangler.toml           # CF config
├── config/                     # Model configurations
├── docs/                       # Architecture & comparison docs
├── scripts/                    # Setup scripts
├── turbo.json                  # Turborepo config
└── package.json                # Root workspace config
```

---

## Biological → AI Mapping (Universal Across Products)

| Biological | AI Architecture | Used In |
|------------|----------------|---------|
| Zooplankton | Token | All |
| Herring | Vector Swarm | All, Fishing |
| Deckhand | SLM + LoRA | All, Maker |
| Captain | Director Agent | All |
| Whale | Orchestrator | All |
| Fleet | A2A Network | All, Fishing |
| Dog | LoRA Adapter | Maker |

---

## Theia Extensions (StudyLoG.AI)

### si-cognitive-mill
**Purpose**: Industrial revolution learning through Arduino simulation

**From Local (cognitivemill)**:
- SimAVR integration for real Arduino simulation
- Component palette (resistors, capacitors, ICs)
- Workbench visualization
- Export to PlatformIO projects
- Circuit simulation logic

### si-agent-director
**Purpose**: Top-level agent orchestration and dashboard

**From Local (cognitivemill)**:
- Real-time agent status display
- Model switching UI
- Cost tracking (tokens, $)
- Mood indicators for biological agents
- Stage progression UI
- Progressive unlock system

### si-godot-embed
**Purpose**: Embed Godot 4.3 game engine as living panel

**From Local (cognitivemill)**:
- WebSocket bridge for real-time communication
- Hot-reload functionality
- Process manager for headless Godot
- Backend service for Godot control

### si-intelligence-ranch
**Purpose**: Train and breed AI agents like livestock

**From GitHub**: Structure ready for implementation

### si-a2ui-renderer
**Purpose**: Agent-to-UI component protocol

**From GitHub**: Protocol and renderer components

### si-sitka-sound
**Purpose**: Ecological simulation with game theory

**From Local (cognitivemill)**:
- Murmuration logic for fish schools
- Fleet communication (A2A)
- Asymmetrical information simulation
- Game theory payoffs
- Trust/reputation systems

### si-multi-model
**Purpose**: Multi-model AI router with fallbacks

**From Local (cognitivemill)**:
- Multi-model chat interface
- Provider selection UI
- Cost tracking per model
- Fallback chain configuration
- KV caching

---

## Backend Workers (Cloudflare)

### multi-model-router
**Purpose**: Route LLM requests to cheapest available provider

**Features**:
- Provider API key management
- Fallback chain: ollama → google → nvidia → anthropic → openai
- KV response caching
- Cost tracking per user
- D1 cost storage

### sleep-trainer
**Purpose**: "Sleep = Training Mode" - LoRA training from daily logs

**Features**:
- Batch process daily logs into embeddings
- Generate LoRA from journal entries
- Memory consolidation simulation
- Vectorize integration for memories

### asset-pipeline
**Purpose**: Generate images, 3D models, audio

**Features**:
- Route to cheapest provider
- Convert to Godot format
- Hot-reload into game

---

## Commands Reference

```bash
# Development
npm run dev              # Start all in dev mode
turbo run dev            # Alternative

# Building
npm run build            # Build all packages
turbo run build          # Alternative

# Backend
npm run backend:dev      # Start backend locally
npm run backend:deploy   # Deploy to Cloudflare

# Testing
npm run test             # Run all tests
npm run typecheck        # Type check only
npm run lint             # Lint all code
```

---

## When Working on This Codebase

1. **StudyLoG.AI is the reference implementation** — build for education first
2. **Keep product-agnostic** — ask "would DMLoG.AI use this differently?"
3. **Simulation first** — can it be simulated before deployed?
4. **Marketplace thinking** — could this be rated, shared, or sold?
5. **Progressive complexity** — beginners see simple, experts see power

---

## Key Technologies

- **Theia IDE**: 1.54.0 (upgrade path to 1.67.0 available)
- **TypeScript**: 5.7.3 (ESM modules)
- **Turborepo**: 2.3.3 for parallel builds
- **Node.js**: 20+ (LTS)
- **React**: 18.x
- **Cloudflare Workers**: For backend API
- **D1**: SQLite database
- **Vectorize**: Vector embeddings
- **R2**: Object storage
- **KV**: Key-value cache
- **Godot**: 4.3 for game/simulation engine

---

**Remember**: We're not trying to make students. We're building a network of thinkers and makers who will later design products on tools they grew up playing with.
