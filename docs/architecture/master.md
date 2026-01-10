# StudyLoG.AI Master Architecture

> A progressive AI-native IDE that teaches through simulation

## Vision

StudyLoG.AI transforms gamers into developers through three interconnected simulation modules. Each module teaches fundamental computing concepts through engaging, hands-on experiences powered by AI agents that guide learners at their own pace.

---

## Core Modules

### 1. Cognitive-Mill
**Theme**: Industrial Revolution → Information Age

| Stage | Teaches | Simulation |
|-------|---------|------------|
| Water Wheel | Mechanical advantage, energy transfer | Build mills, optimize gear ratios |
| Steam Engine | Thermodynamics, feedback loops | Manage pressure, automate valves |
| Telegraph | Binary signaling, protocols | Send messages, handle errors |
| Computer | Logic gates, algorithms | Wire circuits, write programs |
| Neural Net | Weights, training, inference | Train models, observe learning |

**Progression**: Physical intuition → Electrical thinking → Computational reasoning

### 2. Sitka-Sound
**Theme**: Alaskan Fishing Economy

| Stage | Teaches | Simulation |
|-------|---------|------------|
| Solo Fisher | Resource gathering, basic economics | Catch fish, manage inventory |
| Fleet Captain | Coordination, communication protocols | Direct boats, optimize routes |
| Market Trader | Supply/demand, negotiation | Price fish, find buyers |
| Ecosystem Manager | Complex systems, sustainability | Balance population, predict crashes |
| AI Advisor | Agent design, multi-agent systems | Build agents that fish for you |

**Progression**: Player → Manager → Architect → Creator

### 3. IntelligenceRanch
**Theme**: Livestock and Working Dogs

| Stage | Teaches | Simulation |
|-------|---------|------------|
| Shepherd | Direct control, immediate feedback | Move sheep, avoid predators |
| Dog Trainer | Delegation, command protocols | Train dogs, issue commands |
| Ranch Manager | Multi-agent coordination | Manage multiple dogs and herds |
| Breeding Program | Optimization, genetic algorithms | Breed for traits, measure fitness |
| AI Rancher | Autonomous agents, emergent behavior | Design agent policies |

**Progression**: Controller → Trainer → Orchestrator → Designer

---

## Tech Stack (2026)

### Host Environment: Theia IDE

**Why Theia in 2026?**
- Eclipse Foundation backing ensures long-term stability
- True VS Code extension compatibility (not a fork)
- Web and Electron from single codebase
- MIT licensed - no vendor lock-in
- Native extension API for deep integration

```
┌─────────────────────────────────────────────────┐
│                   Theia IDE                      │
├──────────────┬──────────────┬───────────────────┤
│   Editor     │  Godot Panel │   Agent Panel     │
│   (Monaco)   │  (Embedded)  │   (A2UI)          │
├──────────────┴──────────────┴───────────────────┤
│              Extension Host                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────────────┐   │
│  │ MCP     │ │ Godot   │ │ Hardware        │   │
│  │ Bridge  │ │ Bridge  │ │ Detection       │   │
│  └─────────┘ └─────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Game Engine: Godot 4.x

**Why Godot in 2026?**
- GDExtension API enables tight C++ integration
- Embedded viewport support for panel hosting
- MIT licensed - distribute without restrictions
- Native Linux/Jetson support
- 3D and 2D in single engine
- Scene-as-code philosophy matches IDE patterns

**Embedding Strategy**:
1. Godot runs as subprocess with `--headless` + remote viewport
2. Theia panel receives frame buffer via shared memory
3. Input events forwarded through IPC
4. Scene state exposed via MCP tools

### AI Layer: Tiered Inference

```
┌────────────────────────────────────────────────────────┐
│                    AI Routing Layer                     │
├─────────────┬─────────────┬─────────────┬──────────────┤
│ Cloudflare  │   Ollama    │ NVIDIA ACE  │  Cloud API   │
│ Workers AI  │   Local     │   Local     │  (Premium)   │
├─────────────┼─────────────┼─────────────┼──────────────┤
│ Free tier   │ CPU/GPU     │ RTX 4090+   │ Opus/Sonnet  │
│ Llama 3.3   │ Llama 3.3   │ Nemotron    │ Claude       │
│ ~100ms      │ ~500ms      │ ~50ms       │ ~1000ms      │
│ Rate-limit  │ No limit    │ No limit    │ Pay-per-use  │
└─────────────┴─────────────┴─────────────┴──────────────┘
```

**2026 Model Landscape**:
| Use Case | Free Tier | Local Tier | Premium Tier |
|----------|-----------|------------|--------------|
| Code completion | Cloudflare Llama | Ollama Codestral | Claude Sonnet |
| Agent reasoning | Cloudflare Llama | Ollama Llama 3.3 | Claude Opus |
| Game NPCs | Cloudflare | ACE Nemotron | N/A |
| Voice | Cloudflare Whisper | ACE Audio2Face | ElevenLabs |

### UI Framework: A2UI Protocol

**Agent-to-UI Communication**:
```typescript
interface A2UIMessage {
  type: 'component' | 'action' | 'state';
  target: string;        // Component ID
  payload: unknown;      // React/Theia component props
  agent: string;         // Originating agent ID
  priority: 'low' | 'normal' | 'urgent';
}
```

**Why A2UI?**
- Agents can spawn UI without hardcoded components
- State synchronized across IDE and game
- Works in web and Electron identically
- Typed contracts prevent UI breakage

### Backend: Cloudflare Stack

**Why Cloudflare in 2026?**
- Generous free tier (100K requests/day)
- Edge deployment = low latency globally
- D1 (SQLite) + Vectorize (embeddings) + R2 (storage)
- Workers AI included in free tier
- No cold starts (isolate architecture)

```
┌──────────────────────────────────────────────────┐
│                 Cloudflare Edge                   │
├──────────────┬──────────────┬────────────────────┤
│   Workers    │   Workers AI │      KV/D1         │
│   (API)      │   (Llama)    │   (State)          │
├──────────────┼──────────────┼────────────────────┤
│   Vectorize  │      R2      │   Durable Objects  │
│  (Embeddings)│   (Assets)   │   (Sessions)       │
└──────────────┴──────────────┴────────────────────┘
```

### Protocol: MCP (Model Context Protocol)

**Why MCP?**
- Anthropic-backed standard for tool harmonization
- Single interface for all AI providers
- Tools work across local and cloud models
- Growing ecosystem of pre-built servers

**StudyLoG MCP Servers**:
| Server | Purpose |
|--------|---------|
| `mcp-godot` | Scene manipulation, physics queries |
| `mcp-theia` | Editor actions, file operations |
| `mcp-hardware` | Arduino/Jetson communication |
| `mcp-game-state` | Simulation state read/write |
| `mcp-curriculum` | Learning progress, hint generation |

---

## Learning Progression: Gamer → Developer

### Phase 1: Pure Player (Week 1-2)
- No code visible
- Game UI only
- Success through play
- Hidden telemetry builds learner model

### Phase 2: Peek Behind Curtain (Week 3-4)
- "See the code" button appears
- Read-only code snippets
- Syntax highlighting in game context
- "This is how the fish knows where to swim"

### Phase 3: Tweak and Test (Week 5-8)
- Modify constants (speed, spawn rate)
- Hot reload sees changes instantly
- Safe sandbox - can't break game
- A/B test their changes

### Phase 4: Extend and Create (Week 9-12)
- Write new behaviors
- Full IDE access
- Agent assists with syntax
- Create content others can play

### Phase 5: Build and Share (Ongoing)
- Create full modules
- Publish to community
- Review others' code
- Become a mentor

```
┌─────────────────────────────────────────────────────────┐
│                    Learning Progression                  │
│                                                         │
│  PLAYER ──────────► READER ──────────► TWEAKER         │
│    │                  │                   │             │
│    ▼                  ▼                   ▼             │
│  [Play]            [Read]             [Modify]          │
│  [Explore]         [Understand]       [Experiment]      │
│  [Fail safely]     [Ask AI]           [See results]     │
│                                                         │
│  TWEAKER ─────────► CREATOR ─────────► MENTOR          │
│    │                  │                   │             │
│    ▼                  ▼                   ▼             │
│  [Extend]          [Build]            [Teach]           │
│  [Test]            [Publish]          [Review]          │
│  [Iterate]         [Share]            [Guide]           │
└─────────────────────────────────────────────────────────┘
```

---

## Hardware Detection Path

### Detection Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                  Hardware Detection                      │
│                                                         │
│  1. Check USB for Arduino/Jetson                        │
│     └─► Found? Enable hardware curriculum               │
│                                                         │
│  2. Check NVIDIA GPU                                    │
│     └─► RTX 30/40/50? Enable local AI                  │
│     └─► Jetson? Enable edge AI                         │
│                                                         │
│  3. Check System RAM/CPU                                │
│     └─► 16GB+? Enable Ollama                           │
│     └─► 8GB? Cloudflare only                           │
│                                                         │
│  4. Network test                                        │
│     └─► Latency to Cloudflare edge                     │
│     └─► Bandwidth for model streaming                  │
└─────────────────────────────────────────────────────────┘
```

### Hardware Tiers

| Tier | Hardware | AI Capability | Curriculum |
|------|----------|---------------|------------|
| **Starter** | Any PC | Cloudflare only | Core modules |
| **Maker** | + Arduino | + Physical computing | Cognitive-Mill extended |
| **Edge** | + Jetson Nano | + Local inference | Real-time agents |
| **Power** | + RTX 4090 | + Large local models | Advanced AI |
| **Pro** | DGX Spark | + Multi-model | Research track |

### Progressive Hardware Curriculum

```
Arduino Uno ($25)
    │
    ▼
Arduino Mega ($40)
    │
    ▼
Jetson Orin Nano ($249)
    │
    ▼
RTX 4090 System (~$2,500)
    │
    ▼
DGX Spark ($3,000 - $10,000)
```

**Each tier unlocks new concepts**:
- Arduino: Physical I/O, sensors, actuators
- Jetson: Edge AI, computer vision, robotics
- RTX: Large model training, real-time inference
- DGX: Multi-agent simulation, research

---

## Budget Tiers

### Tier 0: Free ($0/month)
**Cloudflare Free Tier**

| Service | Limit | StudyLoG Usage |
|---------|-------|----------------|
| Workers | 100K req/day | API, game state |
| Workers AI | 10K neurons/day | Basic inference |
| D1 | 5GB storage | User progress |
| R2 | 10GB storage | Assets, saves |
| KV | 100K reads/day | Session state |

**Constraints**:
- Rate limiting on AI calls
- No real-time multiplayer
- Community features limited

### Tier 1: Forge ($20/month)
**Cloudflare Paid + Local Ollama**

| Addition | Capability |
|----------|------------|
| Workers Paid | No rate limits |
| Ollama local | Unlimited local inference |
| Durable Objects | Real-time multiplayer |
| Analytics | Learning insights |

**Unlocks**:
- Multiplayer simulations
- Faster AI responses
- Offline capability

### Tier 2: Studio ($100/month)
**Cloud APIs + Premium Models**

| Addition | Capability |
|----------|------------|
| Claude API | Advanced reasoning |
| GPU cloud | Training custom models |
| CDN | Global asset delivery |

**Unlocks**:
- Custom agent training
- Advanced code generation
- Priority support

### Tier 3: Lab ($10,000 one-time)
**DGX Spark + Full Local**

| Addition | Capability |
|----------|------------|
| DGX Spark | 1 PFLOP local compute |
| Full stack local | Zero cloud dependency |
| Research license | Publish, modify, extend |

**Unlocks**:
- Multi-agent research
- Custom model training
- Curriculum development

---

## Agent Architecture

### Agent Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                     Director Agent                       │
│            (Orchestrates all other agents)               │
├─────────────┬─────────────┬─────────────┬───────────────┤
│   Captain   │   Teacher   │   Builder   │   Tester      │
│   (Game)    │  (Pedagogy) │   (Code)    │   (QA)        │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

**Director Agent**:
- Routes tasks to specialists
- Maintains conversation context
- Manages learning state

**Captain Agent**:
- Controls game simulation
- Narrates story beats
- Manages NPC behavior

**Teacher Agent**:
- Explains concepts
- Generates hints
- Adapts difficulty

**Builder Agent**:
- Writes code with learner
- Reviews submissions
- Suggests improvements

**Tester Agent**:
- Validates code
- Reports errors clearly
- Suggests fixes

---

## File Structure

```
StudyLog/
├── apps/
│   ├── theia-extension/       # Main IDE extension
│   ├── godot-bridge/          # Godot embedding
│   └── web-client/            # Browser version
├── packages/
│   ├── a2ui/                  # Agent-to-UI protocol
│   ├── mcp-servers/           # MCP tool servers
│   ├── curriculum/            # Learning content
│   └── hardware/              # Device detection
├── modules/
│   ├── cognitive-mill/        # Industrial learning
│   ├── sitka-sound/           # Fishing simulation
│   └── intelligence-ranch/    # Agent training
├── backend/
│   ├── workers/               # Cloudflare Workers
│   ├── d1/                    # Database schemas
│   └── r2/                    # Asset management
├── docs/
│   ├── architecture/          # This document
│   ├── curriculum/            # Learning design
│   └── api/                   # API reference
└── tools/
    ├── cli/                   # Developer tools
    └── testing/               # Test harnesses
```

---

## Next Steps

| Prompt | Task | Depends On |
|--------|------|------------|
| 002 | Create project structure | This document |
| 003 | Set up Cloudflare backend | 002 |
| 004 | Embed Godot in Theia | 002 |
| 005 | Build Director Agent | 003, 004 |
| 006 | Create first curriculum | 005 |

---

## Success Criteria Checklist

- [x] Architecture document created at `docs/architecture/master.md`
- [x] Tech stack justified with 2026 capabilities
- [x] Clear progression from gamer → developer
- [x] Hardware detection path defined (Arduino → Jetson → RTX → DGX)
- [x] Budget tiers: $0 (Cloudflare) → $20/mo (Forge) → $10K (DGX)

---

*Document Version: 1.0*
*Created: 2026-01-10*
*Author: Claude (Opus 4.5)*
