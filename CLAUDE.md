# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StudyLoG.AI by SuperInstance.AI is an AI-native, gamified IDE for teaching STEM/AI concepts through progressive simulation modules. It transforms gamers into developers through three interconnected modules: Cognitive-Mill (industrial revolution), Sitka-Sound (Alaskan fishing economy), and Intelligence-Ranch (working dogs/AI breeding).

**Architecture Mantra**: "Every layer is a mill. Every agent is a millwright. Every user graduates to building mills."

## Build Commands

```bash
# Development
npm run dev                    # Start all workspaces in dev mode
npm run backend:dev            # Start Cloudflare Workers locally

# Building
npm run build                  # Build all packages
npm run typecheck              # Type check without building
npm run lint                   # Lint all code
npm run clean                  # Clean all build artifacts

# Testing
npm run test                   # Run all tests (uses Vitest)

# Backend deployment
npm run backend:deploy         # Deploy to Cloudflare production
npm run deploy:staging         # Deploy to staging (--workspace=backend)

# Database & services (first-time setup)
npm run db:migrate             # Run D1 database migrations
npm run db:seed                # Seed database
npm run kv:create:session      # Create KV namespace for sessions
npm run kv:create:rate         # Create KV namespace for rate limits
npm run r2:create:projects     # Create R2 bucket for projects
npm run vectorize:create       # Create Vectorize index for embeddings

# Hardware setup
npm run detect-hardware        # Detect local hardware capabilities
npm run setup-ollama           # Set up Ollama for local AI
npm run setup-jetson           # Set up NVIDIA Jetson environment
```

## Architecture

### Monorepo Structure (pnpm + Turborepo)

- **apps/theia-ide/**: Main IDE application (browser-app, electron-app, extensions/)
- **packages/**: Shared libraries (agents, hardware, ollama)
- **backend/**: Cloudflare Workers API
- **config/**: Model configurations and unlock criteria

### Tech Stack

- **Frontend**: Theia IDE 1.54.0 with Monaco Editor, React 18.x
- **Backend**: Cloudflare Workers (D1 database, R2 storage, KV cache, Vectorize)
- **Game Engine**: Godot 4.3 (embedded in IDE as panel)
- **Build**: Turborepo 2.3.3 + pnpm 9.0.0
- **Language**: TypeScript 5.7.3 (ESM modules)
- **Node**: 20+ LTS required

### AI Routing (Cost-Optimized)

Multi-model router with fallback chain: `ollama → google → nvidia → anthropic → openai`

| Tier | Source | Latency |
|------|--------|---------|
| Free | Cloudflare Workers AI (Llama 3.3) | ~100ms |
| Local | Ollama (CPU/GPU) | ~500ms |
| Edge | NVIDIA ACE (RTX 4090+) | ~50ms |
| Premium | Cloud APIs (Claude, GPT-4) | ~1000ms |

### Agent Hierarchy

```
Director Agent (orchestrator)
├── Captain Agent (game simulation & NPCs)
├── Teacher Agent (pedagogy & hints)
├── Builder Agent (code assistance)
└── Tester Agent (validation & QA)
```

### Theia Extensions (7 total)

- **si-agent-director**: Agent orchestration dashboard
- **si-godot-embed**: Godot 4.3 game engine embedding
- **si-cognitive-mill**: Arduino simulation (SimAVR)
- **si-intelligence-ranch**: AI agent training & breeding
- **si-a2ui-renderer**: Agent-to-UI component protocol
- **si-sitka-sound**: Ecological multi-agent simulation
- **si-multi-model**: Multi-model AI router with fallbacks

## Design Principles

1. **Product-Agnostic Core** — Backend serves StudyLoG.AI now but adapts to DMLoG, MakerLoG, etc.
2. **Maximal Customizability** — Users can fork, modify, and create their own versions
3. **Simulation First** — Everything can be simulated before deployment
4. **Open Marketplace Ready** — Rating, reputation, and transaction infrastructure baked in
5. **Progressive Disclosure** — Complex tools unlock through mastery, not complexity

When implementing features, ask: "Would DMLoG.AI use this differently?" and "Could this be rated, shared, or sold?"

## Learning Progression Model

Player → Reader → Tweaker → Creator → Mentor

Users progress from playing games (no code) to reading code snippets, modifying constants, writing behaviors, and eventually creating full modules to share.

## Hardware Tiers

| Tier | Hardware | AI Capability |
|------|----------|---------------|
| Starter | Any PC | Cloudflare only |
| Maker | + Arduino | + Physical computing |
| Edge | + Jetson Nano | + Local inference |
| Power | + RTX 4090 | + Large local models |
| Pro | DGX Spark | + Multi-model research |

## API Routes

- `/api/v1/auth/*` — Authentication (register, login, logout, me)
- `/api/v1/student/*` — Progress, achievements, hardware detection
- `/api/v1/ai/*` — Chat, code, embeddings, hints, status
- `/api/v1/game/*` — Session management, puzzle attempts
- `/api/v1/assets/*` — Project upload, download, management

## Cloudflare Free Tier Limits

- Workers: 100K req/day
- Workers AI: 10K neurons/day (~300 Llama requests)
- D1: 5GB storage
- R2: 10GB storage
- KV: 100K reads/day
