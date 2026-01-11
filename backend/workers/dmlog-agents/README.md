# DMLoG.AI - Multi-Agent Orchestration System

Unified multi-agent orchestration system for both DMLoG.AI and StudyLoG.AI products.

## Overview

This worker provides a unified backend for coordinating AI agents across SuperInstance.AI products:

- **DMLoG.AI**: TTRPG with AI agents, temporal consciousness
- **StudyLoG.AI**: AI/STEM education through progressive simulation

## Architecture

### Biological Agent Mapping

| Biological | AI Architecture | StudyLoG | DMLoG |
|------------|----------------|----------|-------|
| Zooplankton | Token | Mill processing | Dialogue parsing |
| Herring | Vector Swarm | Boids simulation | Horde combat |
| Deckhand | SLM + LoRA | Quick checks | Fast NPCs |
| Captain | Director Agent | Tutorial guide | Party leader |
| Whale | Orchestrator | Multi-agent coordination | Dungeon Master |
| Fleet | A2A Network | Agent ecosystem | Faction system |
| Dog | LoRA Adapter | Fine-tuning | Character personalities |

### Agent Types

- **CombatAgent**: Tactical decisions, initiative management, targeting
- **SocialAgent**: Dialogue, relationships, social encounters
- **ExplorationAgent**: Discovery, loot generation, exploration

### Core Systems

- **AgentRegistry**: Track all active agents
- **CommunicationBus**: Agent-to-agent pub/sub messaging
- **AgentOrchestrator**: Main coordinator (Whale/DM Agent)

## Installation

```bash
pnpm install
```

## Development

```bash
# Start dev server
pnpm dev

# Run tests
pnpm test

# Run tests with watch
pnpm test:watch

# Type check
pnpm typecheck

# Build
pnpm build
```

## API Endpoints

### Agent Decisions

```
POST /api/v1/agents/decision
```

Get a decision from an agent.

Request body:
```json
{
  "agentId": "combat-1",
  "situation": "A goblin attacks!",
  "situationType": "combat",
  "stakes": 0.5,
  "sessionId": "session-1",
  "location": "Dungeon Room 1",
  "participants": ["goblin-1"],
  "availableResources": {}
}
```

Response:
```json
{
  "success": true,
  "data": {
    "decision": {
      "decisionId": "decision_123",
      "agentId": "combat-1",
      "role": "combat",
      "source": "brain",
      "content": "I raise my shield and prepare to strike!",
      "action": "attack",
      "actionParams": { "target": "goblin-1" },
      "confidence": 0.8,
      "timeTakenMs": 45,
      "costEstimate": 0.001
    }
  }
}
```

### Multi-Agent Coordination

```
POST /api/v1/agents/coordinate
```

Coordinate multiple agents for a complex scenario.

Request body:
```json
{
  "sessionId": "session-1",
  "objective": "Defeat the goblin ambush",
  "agentIds": ["combat-1", "combat-2"],
  "timeLimitMs": 5000
}
```

### Agent State

```
GET /api/v1/agents/state?agentId=combat-1
```

Get current state of an agent.

### List Agents

```
GET /api/v1/agents/list?sessionId=session-1
```

List all agents for a session.

### Create Agent

```
POST /api/v1/agents/create
```

Create a new agent.

Request body:
```json
{
  "name": "Guard Captain",
  "role": "combat",
  "sessionId": "session-1",
  "combatStyle": "aggressive",
  "personality": {
    "bravery": 0.8,
    "aggression": 0.6
  }
}
```

### System Statistics

```
GET /api/v1/agents/stats
```

Get system-wide statistics.

## Usage Examples

### Creating a Combat Agent

```typescript
import { createCombatAgent, CombatStyle } from '@studylog/dmlog-agents';

const agent = createCombatAgent({
  id: 'fighter-1',
  name: 'Valeros',
  role: 'combat',
  biologicalType: 'captain',
  sessionId: 'session-1',
  combatStyle: CombatStyle.AGGRESSIVE,
  riskTolerance: 0.7,
});

const decision = await agent.decide({
  agentId: 'fighter-1',
  role: 'combat',
  situation: 'A goblin attacks!',
  situationType: 'combat',
  stakes: 0.5,
  location: 'Dungeon Room 1',
  participants: ['goblin-1'],
  availableResources: {},
  sessionId: 'session-1',
  metadata: {},
});
```

### Creating a Social Agent

```typescript
import { createSocialAgent, SocialStyle } from '@studylog/dmlog-agents';

const innkeeper = createSocialAgent({
  id: 'npc-1',
  name: 'Barkeep',
  role: 'social',
  biologicalType: 'captain',
  sessionId: 'session-1',
  socialStyle: SocialStyle.FRIENDLY,
  personality: {
    friendliness: 0.8,
    gossip: 0.6,
  },
});

// Add dialogue
innkeeper.addDialogueNode({
  id: 'greeting',
  speakerId: 'npc-1',
  text: 'Welcome to the Rusty Tankard! What can I get ya?',
  responses: [
    {
      id: 'response-1',
      text: 'I\'d like a room for the night.',
      nextNodeId: 'room-offer',
    },
    {
      id: 'response-2',
      text: 'Just information, please.',
      nextNodeId: 'rumors',
    },
  ],
});
```

### Creating an Exploration Agent

```typescript
import { createExplorationAgent, ExplorationStyle } from '@studylog/dmlog-agents';

const scout = createExplorationAgent({
  id: 'scout-1',
  name: 'Elara',
  role: 'exploration',
  biologicalType: 'fleet',
  sessionId: 'session-1',
  explorationStyle: ExplorationStyle.THOROUGH,
});

// Add location
scout.addLocation({
  id: 'dungeon-entrance',
  name: 'Dungeon Entrance',
  description: 'A stone staircase descends into darkness...',
  type: 'dungeon',
  connections: [
    {
      toLocationId: 'dungeon-room-1',
      type: 'stairs',
      locked: false,
      description: 'Stone stairs going down',
    },
  ],
  npcs: [],
  items: [],
  secrets: [
    {
      id: 'hidden-compartment',
      description: 'A small hidden compartment in the wall',
      discoveryMethod: 'investigation',
      dc: 15,
      revealed: false,
      reveals: ['potion-of-healing'],
    },
  ],
  tags: ['underground', 'dungeon'],
});
```

### Using the Orchestrator

```typescript
import { getSessionOrchestrator } from '@studylog/dmlog-agents';

const orchestrator = getSessionOrchestrator('session-1');

// Single agent decision
const decision = await orchestrator.decide({
  agentId: 'combat-1',
  role: 'combat',
  situation: 'A group of goblins block the path',
  situationType: 'combat',
  stakes: 0.7,
  location: 'Forest Path',
  participants: ['goblin-1', 'goblin-2', 'goblin-3'],
  availableResources: { healthPotions: 2 },
  sessionId: 'session-1',
  metadata: {},
});

// Multi-agent coordination
const coordination = await orchestrator.coordinate({
  sessionId: 'session-1',
  objective: 'Defeat the goblin ambush and protect the wounded',
  agentIds: ['combat-1', 'combat-2', 'social-1'],
  timeLimitMs: 10000,
});
```

## Integration with Escalation Engine

The orchestrator integrates with `@studylog/escalation` for cost-optimized decisions:

- **BOT**: Rule-based, free (dice rolls, rule lookups)
- **BRAIN**: Local LLM, low cost (~$0.001/decision)
- **HUMAN**: Cloud API, higher cost (~$0.02/decision)

Decisions automatically escalate based on:
- Stakes level
- Situation novelty
- Time pressure
- Agent confidence

## Godot Integration

Agent state syncs to Godot visual layer via the existing `godot-integration` worker:

- Token position updates for combat
- Initiative tracking UI
- Dialogue tree display
- Exploration state visualization

## License

MIT
