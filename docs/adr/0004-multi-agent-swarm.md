# ADR 0004: Multi-Agent Swarm Orchestration

**Status**: Proposed
**Date**: 2026-01-10
**Deciders**: StudyLoG.AI Team
**Related**: ADR-0003 (Component Rolodex), ADR-0005 (Evolution Engine)

---

## Context

StudyLoG.AI needs a system for orchestrating multiple AI agents working together. This enables:

1. **Emergent behavior** - Complex patterns from simple rules
2. **Game theory scenarios** - Prisoner's Dilemma, Tragedy of Commons
3. **Fleet management** - Sitka Sound fishing fleets
4. **Agent evolution** - Intelligence Ranch breeding
5. **A2A communication** - Agent-to-Agent messaging protocol

### Biological Inspiration

Our swarm architecture mirrors biological systems:

```
Zooplankton → Herring → Seal → Whale
(Token)     (School)  (Pack)   (Orchestrator)
```

Each level has increasing complexity and coordination.

### Requirements

1. **Scalable** - Handle 10s to 1000s of agents
2. **Real-time** - Sub-second tick updates
3. **Observable** - Watch swarm behavior
4. **Evolvable** - Agents learn and adapt
5. **Composable** - Build from Rolodex components

---

## Decision

We will implement a multi-agent swarm system with the following architecture:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Swarm Orchestrator                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  Scheduler                          │   │
│  │  - Tick-based execution                            │   │
│  │  - Parallel agent updates                          │   │
│  │  - State synchronization                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│  ┌────────────────────────┼─────────────────────────────┐ │
│  │                        │                             │ │
│  ▼                        ▼                             ▼ │
│ ┌────────┐            ┌────────┐                    ┌─────┐│
│ │  A2A   │            │Behavior│                    │Evolution│
│ │Protocol│            │ Engine │                    │ Engine│
│ └────────┘            └────────┘                    └─────┘│
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Agent Swarm                            │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │[A1] │ │[A2] │ │[A3] │ │[A4] │ │[A5] │ │ ... │       │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └─────┘       │
│     │       │       │       │       │                   │
│     └───────┴───────┴───────┴───────┘                   │
│                    A2A Messages                          │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. A2A Protocol (Agent-to-Agent)

```typescript
enum MessageType {
  STATE_UPDATE = 'state.update',
  ACTION_REQUEST = 'action.request',
  ACTION_RESPONSE = 'action.response',
  COORDINATE = 'coordinate',
  NEGOTIATE = 'negotiate',
  VOTE = 'vote',
  GREET = 'greet',
  SIGNAL = 'signal',
  WARN = 'warn',
  DISCOVER = 'discover',
  HEARTBEAT = 'heartbeat',
}

interface A2AMessage {
  id: string;
  type: MessageType;
  sender: AgentID;        // { swarm, agent, instance }
  receiver: AgentID | 'broadcast';
  channel: string;        // Topic-based routing
  payload: unknown;
  priority: 'low' | 'normal' | 'urgent';
  timestamp: number;
  ttl?: number;          // Hop limit for routing
}
```

**Channel System**:
- `swarm:*` - Swarm-wide broadcasts
- `neighbor:*` - Local neighborhood
- `trade:*` - Trading negotiations
- `alert:*` - Emergency signals

#### 2. Swarm Scheduler

```typescript
interface SwarmConfig {
  id: string;
  name: string;
  tickRate: number;        // Ticks per second (1-60)
  maxTicks?: number;       // For bounded simulations
  initialState: Record<string, any>;
}

interface SwarmState {
  tick: number;
  agents: Map<string, AgentState>;
  global: Record<string, any>;
  messages: A2AMessage[];
}

class SwarmScheduler {
  async runSwarm(config: SwarmConfig): Promise<SwarmResult> {
    // 1. Initialize state
    // 2. Execute ticks
    // 3. Return final state + history
  }

  private async executeTick(
    state: SwarmState,
    config: SwarmConfig
  ): Promise<SwarmState> {
    // 1. Gather messages from previous tick
    // 2. Update all agents in parallel
    // 3. Apply state changes
    // 4. Increment tick
  }
}
```

#### 3. Behavior Engine

```typescript
interface BehaviorContext {
  agentId: AgentID;
  agentState: Record<string, any>;
  messages: A2AMessage[];
  globalState: Record<string, any>;
  deltaTime: number;
}

type BehaviorFn = (
  context: BehaviorContext,
  parameters: Record<string, any>
) => Promise<BehaviorOutput>;

interface BehaviorOutput {
  actions: Action[];
  messages: A2AMessage[];
  newState: Record<string, any>;
}
```

**Built-in Behaviors**:
- `flocking` - Boids algorithm (separation, alignment, cohesion)
- `foraging` - Resource collection
- `trading` - Market-based exchange
- `communicating` - Message passing
- `migrating` - Group movement
- `nesting` - Territory defense

#### 4. Evolution Engine

```typescript
interface BreedingConfig {
  populationSize: number;
  selectionMethod: 'tournament' | 'roulette' | 'rank';
  tournamentSize?: number;
  crossoverRate: number;    // 0-1
  mutationRate: number;     // 0-1
  elitismCount: number;     // Keep top N unchanged
}

interface AgentGenome {
  id: string;
  generation: number;
  parents: string[];
  behaviors: string[];
  parameters: Map<string, number>;
  fitness: number;
}

class EvolutionEngine {
  async evolve(
    population: AgentGenome[],
    config: BreedingConfig,
    fitnessFn: (genome: AgentGenome) => Promise<number>
  ): Promise<AgentGenome[]> {
    // 1. Evaluate fitness
    // 2. Select parents
    // 3. Create offspring (crossover + mutation)
    // 4. Return next generation
  }
}
```

---

## Swarm Scenarios

### Scenario 1: Prisoner's Dilemma

```
Two agents decide whether to cooperate or defect.

Payoff Matrix:
              B Cooperate  B Defect
A Cooperate     (-1, -1)    (-3, 0)
A Defect        (0, -3)     (-2, -2)

Evolution: Strategies that cooperate tend to survive.
```

### Scenario 2: Tragedy of the Commons

```
Multiple agents share a renewable resource.

Parameters:
- Initial resource: 100
- Regeneration rate: 10/tick
- Consumption per agent: 5
- Sustainable limit: 2 agents

Outcome: Without coordination, resource collapses.
```

### Scenario 3: Sitka Sound Fleet

```
Multiple fishing boats coordinate to maximize catch.

Agent Types:
- Captain: Decides fishing grounds
- Deckhand: Operates equipment
- Whale: Orchestrates fleet

Communication:
- Market prices
- Fish locations
- Weather warnings
```

---

## Alternatives Considered

### Alternative 1: Centralized Control

**Description**: Single director agent controls all swarm behavior.

**Pros**:
- Simpler implementation
- Coordinated behavior guaranteed
- Easier to debug

**Cons**:
- Single point of failure
- Doesn't scale well
- No emergent behavior
- Not biologically realistic

**Decision**: **REJECTED** - Doesn't teach emergent systems.

### Alternative 2: Rule-Based System

**Description**: If-then rules for agent behavior.

**Pros**:
- Predictable behavior
- Easy to understand
- Fast execution

**Cons**:
- Limited complexity
- Hard to adapt
- No learning
- Brittle edge cases

**Decision**: **REJECTED** - Too rigid for educational exploration.

### Alternative 3: Reinforcement Learning

**Description**: Agents learn through trial and error.

**Pros**:
- Adapts to environment
- Can discover novel strategies
- Proven effective

**Cons**:
- Long training time
- Expensive compute
- Hard to understand
- Not real-time

**Decision**: **REJECTED** - Not practical for interactive learning.

---

## Consequences

### Positive

1. **Emergent behavior** - Complex patterns from simple rules
2. **Scalable** - Handles large swarms
3. **Observable** - Watch behavior in real-time
4. **Educational** - Teaches systems thinking
5. **Extensible** - Easy to add new behaviors

### Negative

1. **Complexity** - Hard to predict behavior
2. **Performance** - Many agents = high CPU
3. **Debugging** - Difficult to trace issues
4. **Stability** - Swarms can collapse

### Risks

1. **Performance** - Large swarms may lag
2. **Unpredictability** - Emergent behavior can surprise
3. **Resource usage** - High memory/CPU for many agents
4. **Learning curve** - Complex to understand

### Mitigations

1. **Chunking** - Divide large swarms into sub-swarms
2. **LOD** - Level of detail for distant agents
3. **Profiling** - Performance monitoring tools
4. **Tutorials** - Guided scenarios first

---

## Implementation Plan

See `/IMPLEMENTATION.md` Phase 4 for detailed steps.

### Key Milestones

1. **Week 1-2**: A2A protocol + message bus
2. **Week 3-4**: Swarm scheduler + behavior engine
3. **Week 5-6**: Evolution engine + breeding UI
4. **Week 7-8**: Game theory scenarios
5. **Week 9-10**: Fleet management + visualization

---

## Related Decisions

- **ADR-0003**: Component Rolodex provides agent components
- **ADR-0005**: Evolution Engine for agent breeding
- **ADR-0006**: Sitka Sound integration

---

## Performance Considerations

### Scalability Targets

| Agent Count | Target Tick Rate | Memory Usage |
|-------------|------------------|--------------|
| 10-50 | 60 TPS | <100MB |
| 50-500 | 30 TPS | <500MB |
| 500-5000 | 10 TPS | <2GB |
| 5000+ | 1-5 TPS | Variable |

### Optimization Strategies

1. **Spatial partitioning** - Quadtree for neighbor queries
2. **Message batching** - Group messages by channel
3. **Lazy evaluation** - Only update visible agents
4. **Web Workers** - Parallel execution
5. **WASM** - Compile behaviors to WebAssembly

---

## Examples

### Example 1: Flocking Boids

```typescript
// Configure flocking behavior
const flockingSwarm: SwarmConfig = {
  id: 'flocking-demo',
  name: 'Flocking Boids',
  tickRate: 60,
  initialState: { bounds: { width: 1000, height: 1000 } },
};

// Each boid has flocking behavior
const boid: AgentInstance = {
  id: { swarm: 'flocking-demo', agent: 'boid', instance: '1' },
  type: 'herring',
  behaviors: ['flocking'],
  parameters: {
    separationRadius: 20,
    alignmentRadius: 50,
    cohesionRadius: 50,
    maxSpeed: 5,
  },
};
```

### Example 2: Trading Market

```typescript
// Configure trading scenario
const marketSwarm: SwarmConfig = {
  id: 'trading-demo',
  name: 'Trading Market',
  tickRate: 10,
  initialState: {
    resources: { fish: 1000, grain: 500 },
    prices: { fish: 1.0, grain: 2.0 },
  },
};

// Traders negotiate prices
const trader: AgentInstance = {
  id: { swarm: 'trading-demo', agent: 'trader', instance: '1' },
  type: 'captain',
  behaviors: ['trading'],
  parameters: {
    riskTolerance: 0.5,
    inventory: { fish: 10, grain: 5 },
    desired: { fish: 20, grain: 10 },
  },
};
```

---

## References

- Boids Algorithm: Craig Reynolds (1986)
- Swarm Intelligence: Bonabeau, Dorigo, Theraulaz
- Game Theory: Osborne, Rubinstein
- Emergent Behavior: Holland, Complex Adaptive Systems
