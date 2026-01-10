# ADR 0003: Component Rolodex Design

**Status**: Proposed
**Date**: 2026-01-10
**Deciders**: StudyLoG.AI Team
**Related**: ADR-0001 (G-Assist), ADR-0004 (Multi-Agent Swarm)

---

## Context

StudyLoG.AI needs a system for creating, sharing, and composing AI agent components. Users should be able to:

1. **Browse components** - See all available agent parts
2. **Compose agents** - Drag-and-drop agent creation
3. **Share components** - Publish via Bazaar
4. **Version components** - Track improvements
5. **Verify components** - Community quality checks

### The "AI Legos" Vision

Just as LEGO bricks enable anyone to build complex structures, our Component Rolodex should enable anyone to build complex AI agents from simple, reusable components.

### Biological Metaphor

Our component system mirrors biological organization:

```
Cell (Component) → Tissue (Behavior) → Organ (Agent) → Organism (Swarm)
```

Each component is self-contained with defined inputs, outputs, and parameters.

### Constraints

1. **Visual composition** - Must support drag-and-drop
2. **Type safety** - Ports must match types
3. **Sandboxed execution** - Components can't harm system
4. **Version control** - Track component evolution
5. **Bazaar integration** - Sharing forking, merging

---

## Decision

We will implement a Component Rolodex with the following architecture:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────────────────────────────┐  │
│  │ Component   │  │         Canvas Area                  │  │
│  │ Library     │  │  ┌─────┐    ┌─────┐    ┌─────┐     │  │
│  │             │  │  │ [A] │────│ [B] │────│ [C] │     │  │
│  │ ┌─────────┐ │  │  └─────┘    └─────┘    └─────┘     │  │
│  │ │Sensors  │ │  │                                     │  │
│  │ ├─────────┤ │  │  [Drag components here to build]     │  │
│  │ │Behavior │ │  │                                     │  │
│  │ ├─────────┤ │  └─────────────────────────────────────┘  │
│  │ │Actuator │ │  ┌─────────────────────────────────────┐  │
│  │ ├─────────┤ │  │         Properties Panel             │  │
│  │ │ Agents  │ │  │  Selected: [B] - Flocking Behavior  │  │
│  │ └─────────┘ │  │  ┌─────────────────────────────┐   │  │
│  │             │  │  │ Separation: 1.5             │   │  │
│  │ [Search]    │  │  │ Alignment: 1.0              │   │  │
│  └─────────────┘  │  │ Cohesion: 1.0               │   │  │
│                   │  └─────────────────────────────┘   │  │
│                   └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interface

```typescript
interface ComponentDefinition {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: 'behavior' | 'sensor' | 'actuator' | 'agent';
  icon: string;
  author: string;
  version: string;
  quality: 1 | 2 | 3 | 4;  // Fuse Grade

  // Interface
  inputs: ComponentPort[];
  outputs: ComponentPort[];
  parameters: ComponentParameter[];

  // Implementation
  code: string;              // Executable component code
  dependencies: string[];    // Required components

  // Validation
  schema: JSONSchema;        // Parameter validation
  tests: ComponentTest[];    // Verification tests
}

interface ComponentPort {
  id: string;
  name: string;
  type: 'vector' | 'number' | 'string' | 'boolean' | 'any';
  description: string;
  required: boolean;
}

interface ComponentParameter {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'enum' | 'vector';
  default: any;
  description: string;
  constraints?: {
    min?: number;
    max?: number;
    options?: string[];
    step?: number;
  };
}
```

### Component Categories

#### 1. Sensors (Perception)

| Component | Purpose | Inputs | Outputs |
|-----------|---------|--------|---------|
| ProximitySensor | Detect nearby entities | None | `Entity[]` |
| ResourceSensor | Find resources | None | `Resource[]` |
| StateSensor | Read simulation state | None | `GameState` |
| AudioSensor | Detect sounds | None | `AudioEvent[]` |

#### 2. Behaviors (Processing)

| Component | Purpose | Inputs | Outputs |
|-----------|---------|--------|---------|
| Flocking | Group movement (boids) | `Entity[]`, `params` | `Velocity` |
| Foraging | Search/collect | `Resource[]`, `params` | `Action[]` |
| Trading | Negotiate | `MarketState`, `params` | `Trade` |
| Communicate | Send messages | `Message`, `Channel` | `void` |

#### 3. Actuators (Action)

| Component | Purpose | Inputs | Outputs |
|-----------|---------|--------|---------|
| Movement | Move agent | `Velocity` | `void` |
| Speech | Generate audio | `text` | `void` |
| Action | Execute game action | `Action` | `void` |
| Emit | Send signal | `Signal` | `void` |

#### 4. Agents (Complete)

| Component | Purpose | Type |
|-----------|---------|------|
| Deckhand | Task specialist (SLM + LoRA) | Built-in |
| Captain | Director/Coordinator | Built-in |
| Whale | Meta-orchestrator | Built-in |
| Herring | Vector swarm member | Built-in |

### Component Graph Execution

```typescript
interface ComponentGraph {
  id: string;
  name: string;
  nodes: GraphNode[];
  connections: GraphConnection[];
  state: Record<string, any>;
}

interface GraphNode {
  id: string;
  componentId: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
}

interface GraphConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}
```

**Execution Model**:
1. Topological sort for execution order
2. Parallel execution where possible
3. State propagation through connections
4. Caching for performance
5. Sandboxed execution (Web Worker)

---

## Alternatives Considered

### Alternative 1: Code-Only Agent Definition

**Description**: Write agent behaviors entirely in code.

**Pros**:
- Maximum flexibility
- Familiar to developers
- Easy version control

**Cons**:
- High barrier to entry
- No visual feedback
- Hard to share/compose
- Not education-friendly

**Decision**: **REJECTED** - Doesn't support our progressive learning philosophy.

### Alternative 2: Template-Based Agents

**Description**: Pre-defined agent templates with parameter tuning.

**Pros**:
- Simpler implementation
- Guided experience
- Less error-prone

**Cons**:
- Limited flexibility
- Template maintenance burden
- Can't create novel agents

**Decision**: **REJECTED** - Too constraining for creative users.

### Alternative 3: Visual Programming (Scratch-Style)

**Description**: Block-based programming like Scratch.

**Pros**:
- Very beginner-friendly
- Visual feedback
- Proven in education

**Cons**:
- Doesn't scale well
- Becomes cumbersome for complex logic
- Hard to version/diff

**Decision**: **REJECTED** - Good for learning, but we need to scale to complexity.

---

## Consequences

### Positive

1. **Visual composition** - Drag-and-drop is intuitive
2. **Type safety** - Port matching prevents errors
3. **Shareability** - Components can be published via Bazaar
4. **Version control** - Track component evolution
5. **Community quality** - Fuse Grade system for verification

### Negative

1. **Implementation complexity** - Visual editor is non-trivial
2. **Performance overhead** - Dynamic execution has cost
3. **Debugging difficulty** - Visual graphs harder to debug
4. **Storage requirements** - Component library needs space

### Risks

1. **Component quality** - Poor components could frustrate users
2. **Compatibility** - Version conflicts between components
3. **Security** - Malicious components could cause issues
4. **Scalability** - Large graphs could be slow

### Mitigations

1. **Quality system** - Fuse Grade + verification tests
2. **Semantic versioning** - Clear compatibility rules
3. **Sandboxing** - Web Worker isolation
4. **Optimization** - Lazy evaluation, caching

---

## Bazaar Integration

Components integrate with the Bazaar marketplace:

```typescript
interface BazaarComponent extends ComponentDefinition {
  // Bazaar metadata
  creationId: string;
  authorId: string;
  publishedAt: Date;
  likes: number;
  forks: number;
  quality: 1 | 2 | 3 | 4;

  // Community
  comments: Comment[];
  verifications: Verification[];
  usageStats: {
    downloads: number;
    activeUses: number;
  };
}
```

**Sharing Flow**:
1. User creates component in Rolodex
2. User validates component (auto-tests)
3. User publishes to Bazaar with Millfile
4. Community reviews, rates, verifies
5. Others can fork, improve, merge

---

## Implementation Plan

See `/IMPLEMENTATION.md` Phase 3 for detailed steps.

### Key Milestones

1. **Week 1-2**: Component library + built-in components
2. **Week 3-4**: Visual editor + canvas
3. **Week 5-6**: Orchestrator + execution engine
4. **Week 7-8**: Bazaar integration

---

## Related Decisions

- **ADR-0001**: G-Assist for natural component creation
- **ADR-0002**: Messenger UI for component tutoring
- **ADR-0004**: Multi-Agent Swarm for component orchestration

---

## Examples

### Example 1: Simple Foraging Agent

```
[ProximitySensor] → [ForagingBehavior] → [MovementActuator]
       ↓                                    ↓
   (Entities)                         (Velocity)
```

**Components**:
1. ProximitySensor: Finds nearby food
2. ForagingBehavior: Decides which food to pursue
3. MovementActuator: Moves agent toward target

### Example 2: Trading Agent

```
[ResourceSensor] → [TradingBehavior] → [SpeechActuator]
       ↓               ↓                  ↓
   (Resources)   (MarketState)     (Announcement)
       ↓               ↓
   [StateSensor]─────┘
```

**Components**:
1. ResourceSensor: Detects available resources
2. StateSensor: Reads market prices
3. TradingBehavior: Evaluates trades
4. SpeechActuator: Announces decisions

---

## References

- Visual Programming: Node-RED, Blender Nodes
- Component Systems: Unity ECS, Unreal Engine Components
- Biological Analogies: Swarm Intelligence, Cellular Automata
