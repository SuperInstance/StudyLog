# Being State System

A comprehensive multi-layered state management system for Godot simulations with generative AI transformations, vibe-coded gameplay mutations, and ACE-powered agent intelligence.

## Overview

The Being State System manages four interconnected state layers:

- **Visual State** - Generative AI-driven appearance transformations (materials, particles, shaders)
- **Audio State** - Procedural audio and music generation
- **Gameplay State** - Vibe-coded rule mutations via LimboAI behavior trees
- **Agent State** - ACE/Ollama-powered unit intelligence

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Being State Manager                          │
│  ┌────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐  │
│  │   Visual   │ │    Audio     │ │  Gameplay  │ │   Agent  │  │
│  │   State    │ │    State     │ │   State    │ │   State  │  │
│  └─────┬──────┘ └──────┬───────┘ └─────┬──────┘ └────┬─────┘  │
│        │               │                │             │         │
│  ┌─────▼──────────────▼────────────────▼─────────────▼─────┐  │
│  │                    State Effects                         │  │
│  └──────────────────────┬──────────────────────────────────┘  │
└───────────────────────┼──────────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────────┐
│                    Godot Bridge                                │
│  ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐       │
│  │  Visual FX   │ │  Audio Bus   │ │  Behavior Tree   │       │
│  └──────────────┘ └─────────────┘ └──────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
pnpm install

# Create D1 database
wrangler d1 create being-state-db

# Create KV namespaces
wrangler kv:namespace create "BEING_STATE_CACHE"
wrangler kv:namespace create "STATE_TRANSITION_CACHE"

# Deploy
wrangler publish
```

## API Endpoints

### State Transitions

#### POST `/state/transition`
Transition all or specific state layers for a session.

```json
{
  "sessionId": "session-123",
  "visual": "ethereal",
  "audio": "serene",
  "gameplay": "exploration",
  "agent": "autonomous",
  "intensity": 0.7,
  "duration": 60000,
  "reason": "Player entered mystical zone"
}
```

#### GET `/state/current?session={id}`
Get current being state for a session.

#### GET `/state/history?session={id}&limit=50`
Get state transition history.

### Visual State

#### POST `/state/visual`
Trigger visual transformation.

```json
{
  "sessionId": "session-123",
  "state": "radiant",
  "intensity": 0.8,
  "target": "player_entity"
}
```

**Visual States:**
- `ethereal` - Glowing, translucent, particle effects
- `mechanical` - Robotic, metallic, geometric
- `organic` - Living, growing, flowing forms
- `crystalline` - Sharp, refractive, light-bending
- `shadow` - Dark, misty, hard to focus
- `radiant` - Bright, emitting light
- `void` - Empty, absence-based
- `elemental` - Fire, water, earth, air
- `cyber` - Neon, glitch, digital
- `ancient` - Weathered, rune-covered

### Audio State

#### POST `/state/audio`
Trigger audio transformation.

**Audio States:**
- `eerie` - Whispering, ambient unsettling
- `triumphant` - Orchestral, powerful
- `muted` - Quiet, minimal
- `chaotic` - Dissonant, overwhelming
- `serene` - Peaceful, harmonic
- `intense` - Driving, rhythmic
- `mystical` - Otherworldly, reverb-heavy
- `mechanical` - Industrial, repetitive
- `natural` - Environmental sounds
- `digital` - Synthesized, electronic

### Gameplay State

#### POST `/state/gameplay`
Trigger gameplay mutation.

**Gameplay States:**
- `chaotic` - Unpredictable rules
- `ordered` - Structured, tactical
- `dreamlike` - Surreal mechanics
- `survival` - Resource scarcity, permadeath
- `creative` - Building-focused
- `competitive` - PVP scoring
- `cooperative` - Shared objectives
- `exploration` - Fog of war
- `puzzle` - Logic gates
- `narrative` - Story-driven

### Agent State

#### POST `/agent/empower`
Grant autonomy state to a unit.

```json
{
  "agentId": "unit-456",
  "state": "autonomous",
  "context": { /* RAG context */ }
}
```

**Agent States:**
- `autonomous` - Self-directed goal-seeking
- `directed` - Player command-following
- `emergent` - Collective intelligence
- `dormant` - Passive, reactive only
- `rogue` - Independent, potentially hostile
- `symbiotic` - Mutually beneficial
- `learning` - Adapting from player
- `teaching` - Guiding player
- `mimicking` - Copying player patterns
- `transcendent` - Beyond rules, godlike

### Agent Chatter

#### POST `/agent/chatter`
Generate contextual chatter for agent.

```json
{
  "agentId": "unit-456",
  "state": "teaching",
  "situation": "combat",
  "context": { /* RAG context */ }
}
```

### Crew Management

#### POST `/crew/create`
Create multi-agent crew with coordination.

```json
{
  "name": "Alpha Squad",
  "coordination": {
    "protocol": "centralized",
    "decisionMaking": "leader",
    "sharedMemory": true,
    "conflictResolution": "priority"
  },
  "agents": [
    { "id": "unit-1", "role": "commander" },
    { "id": "unit-2", "role": "tank" },
    { "id": "unit-3", "role": "damage" },
    { "id": "unit-4", "role": "support" }
  ]
}
```

**Crew Roles:**
- `scout` - Forward observer
- `tank` - Damage absorption
- `damage` - DPS specialist
- `support` - Healing/buffing
- `commander` - Strategic oversight
- `builder` - Construction
- `researcher` - Information gathering
- `diplomat` - Negotiation/trade

#### POST `/crew/:id/coordinate`
Execute crew coordination decision-making.

### RAG Injection

#### POST `/rag/inject`
Create RAG context injection for agents.

```json
{
  "sessionId": "session-123",
  "agentId": "unit-456",
  "gameState": {
    "units": [...],
    "resources": [...],
    "objectives": [...],
    "gameTime": 123456
  },
  "maxEvents": 50
}
```

### Feedback Loop

#### POST `/feedback/submit`
Submit environment feedback for learning.

```json
{
  "sessionId": "session-123",
  "agentId": "unit-456",
  "actionId": "action-789",
  "outcome": "success",
  "metrics": {
    "damage_dealt": 50,
    "damage_taken": 10,
    "resources_gained": 25
  },
  "observations": ["Target eliminated efficiently"],
  "surprises": [{
    "type": "critical_hit",
    "description": "Unexpected critical damage",
    "severity": 0.3,
    "impact": "positive"
  }]
}
```

## Technologies Integrated

| Technology | Purpose | Module |
|------------|---------|--------|
| NVIDIA ACE | Context-aware autonomous agents | `agent-state.ts` |
| LimboAI | Behavior trees for tactical decisions | `gameplay-state.ts` |
| Ollama | Local LLM for unit chatter | `agent-state.ts` |
| Godot RL Agents | Reinforcement learning training | `action-executor.ts` |
| CrewAI | Multi-agent orchestration | `crew-orchestrator.ts` |
| Mistral-Nemo | Agentic reasoning | `rag-injector.ts` |
| NVIDIA Nemotron | Contextual memory | `agent-state.ts` |

## File Structure

```
being-state/
├── index.ts              # Main API entry point
├── types.ts              # All type definitions
├── being-state.ts        # Core state manager
├── visual-state.ts       # Visual transformations
├── audio-state.ts        # Audio transformations
├── gameplay-state.ts     # Gameplay mutations
├── agent-state.ts        # Agent intelligence
├── crew-orchestrator.ts  # Multi-agent coordination
├── rag-injector.ts       # Real-time context injection
├── action-executor.ts    # LimboAI task execution
├── feedback-loop.ts      # Learning feedback
├── wrangler.toml         # Cloudflare Worker config
└── README.md             # This file
```

## Usage Example

```typescript
import { createStateManager } from './being-state';
import { createVisualStateManager } from './visual-state';
import { createAgentStateManager } from './agent-state';

// Initialize managers
const stateManager = createStateManager(env);
const visualManager = createVisualStateManager(env);
const agentManager = createAgentStateManager(env);

// Transition to ethereal state
const transition = await stateManager.transition({
  sessionId: 'session-123',
  visual: 'ethereal',
  audio: 'mystical',
  agent: 'autonomous',
  intensity: 0.8,
  reason: 'Player discovered ancient artifact'
});

// Generate visual transformation
const visuals = await visualManager.generateTransformation(
  'ethereal',
  0.8
);

// Update agent intelligence
const agentUpdate = await agentManager.generateUpdate(
  'unit-456',
  'autonomous'
);
```

## Godot Integration

The system generates GDScript-compatible commands:

```gdscript
# Visual transformation
rpc_call("entity", "set_material_override", {
  "albedo": Color(0.8, 0.9, 1.0, 0.6),
  "emission": Color(0.5, 0.7, 1.0),
  "shader_code": "...shader code..."
})

# Behavior tree update
rpc_call("unit-456", "update_behavior_tree", {
  "tree": """
    root: selector
      - sequence: goal Pursuit
        - check_current_goal
        - plan_path_to_goal
  """,
  "params": { "decision_threshold": 0.6 }
})
```

## Database Schema

See `/backend/d1/being-state-schema.sql` for full D1 database schema including:

- `being_states` - State storage
- `game_events` - Event history for RAG
- `gameplay_mutations` - Active rule changes
- `agent_memories` - Multi-tier memory system
- `crew_configs` - Crew configurations
- `feedback_events` - Learning data

## License

MIT
