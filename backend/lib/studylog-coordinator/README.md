# StudyLoG.AI Agent Coordinator

A multi-agent coordination system for managing AI learning agents across the three StudyLoG.AI stages: Cognitive Mill, Intelligence Ranch, and Sitka Sound.

Inspired by the [SuperInstance agent-coordinator](https://github.com/SuperInstance/agent-coordinator) framework.

## Features

- **Biological Agent Metaphor**: Agents modeled after marine ecosystem (Zooplankton, Herring, Deckhand, Captain, Whale, Fleet)
- **Stage-Based Learning**: Progressive unlock system through Cognitive Mill -> Intelligence Ranch -> Sitka Sound
- **Task Coordination**: Priority-based task queue with multiple load balancing strategies
- **Event-Driven Architecture**: All state changes emit events for visualization and monitoring
- **Achievement System**: Built-in XP, levels, and achievement tracking
- **Progress Persistence**: Learning progress saved across sessions

## Installation

```bash
# Located in backend/lib/studylog-coordinator/
# Part of the StudyLoG.AI backend monorepo
```

## Quick Start

```typescript
import { startCoordinator, Task, LearningStage } from "./lib/studylog-coordinator/index.js";

// Create and start a coordinator
const coordinator = await startCoordinator({
  name: "my-learning-session",
  debug: true,
});

// Spawn a learning agent
const agent = await coordinator.spawnAgent(
  "zooplankton-1",
  "zooplankton",
  async (task) => {
    // Handle the task
    return { result: "learned" };
  }
);

// Submit a learning task
const result = await coordinator.submitTask({
  id: "learn-tokens",
  description: "Learn about tokens",
  requiredCapabilities: ["token"],
  payload: { lesson: "Tokens are..." },
  priority: 50,
  timeout: 300,
  maxRetries: 3,
  dependencies: [],
  metadata: {},
  createdAt: new Date(),
  status: "pending" as any,
  retryCount: 0,
  learningStage: LearningStage.COGNITIVE_MILL,
}, true);

// Record progress
await coordinator.recordConceptLearned("tokens", 50);
await coordinator.recordPuzzleSolved(100);

// Stop the coordinator
await coordinator.stop();
```

## Agent Roles

### Cognitive Mill (Understanding AI)

| Role | Biological Type | Capabilities | Emoji |
|------|----------------|--------------|-------|
| Zooplankton | Zooplankton | token, embedding, context_window | 🦐 |
| Herring | Herring | vector, swarm, attention, softmax | 🐟 |

### Intelligence Ranch (Training Agents)

| Role | Biological Type | Capabilities | Emoji |
|------|----------------|--------------|-------|
| Deckhand | Deckhand | slm, lora, fine_tune, dataset | 👨‍✈️ |
| Captain | Captain | direct, coordinate, route, orchestrate | 👨‍✈️ |

### Sitka Sound (Multi-Agent Systems)

| Role | Biological Type | Capabilities | Emoji |
|------|----------------|--------------|-------|
| Whale | Whale | orchestrator, a2a, meta_cognitive | 🐋 |
| Fleet | Fleet | network, game_theory, emerge | 🚢 |

### Universal

| Role | Biological Type | Capabilities | Emoji |
|------|----------------|--------------|-------|
| Dog | Dog | lora, adapter, specialize, transfer | 🐕 |

## Task Queue

The coordinator uses a priority-based task queue with multiple load balancing strategies:

- **round_robin**: Distribute tasks evenly across agents
- **least_loaded**: Assign to agent with fewest active tasks
- **capability_match**: Assign to agent with best capability fit
- **random**: Random assignment

## Events

All coordinator operations emit events that can be subscribed to:

```typescript
coordinator.eventBus.subscribe(
  [EventType.TASK_COMPLETED, EventType.ACHIEVEMENT_UNLOCKED],
  (event) => {
    console.log("Event:", event.type, event.data);
  }
);
```

Available event types:
- `AGENT_REGISTERED`, `AGENT_STARTED`, `AGENT_STOPPED`, `AGENT_STATE_CHANGED`
- `TASK_QUEUED`, `TASK_ASSIGNED`, `TASK_STARTED`, `TASK_COMPLETED`, `TASK_FAILED`
- `CONCEPT_LEARNED`, `PUZZLE_SOLVED`, `ACHIEVEMENT_UNLOCKED`
- `STAGE_COMPLETED`, `PROGRESS_UPDATED`
- `SYSTEM_STARTING`, `SYSTEM_STARTED`, `SYSTEM_STOPPING`, `SYSTEM_STOPPED`

## Learning Progress

Track learner progress through stages:

```typescript
// Check current stage
const stage = coordinator.getCurrentStage();

// Check if requirements are met
const check = coordinator.checkStageRequirements(LearningStage.INTELLIGENCE_RANCH);
console.log(check.met, check.missing);

// Advance to next stage
const advanced = await coordinator.advanceToStage(LearningStage.INTELLIGENCE_RANCH);
```

## Examples

See `examples.ts` for complete usage examples:

- `exampleCognitiveMillTutorial()` - Basic token processing tutorial
- `exampleIntelligenceRanch()` - Agent training workflow
- `exampleSitkaSound()` - Multi-agent coordination
- `exampleLearningJourney()` - Complete learning progression
- `exampleEventVisualization()` - Event-driven visualization

## License

MIT
