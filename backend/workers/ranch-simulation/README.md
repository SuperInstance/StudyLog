# Ranch Simulation Worker

**Progressive AI system for ranch/fishing simulation with animal herding, dog training, and quality scaling.**

A comprehensive simulation system that scales from simple 2D sprites to complex 3D herd behaviors. Puppies start training on geese and chickens before progressing to cattle and sheep.

## Vision

```
Early Stage (MicroVerse 2D)
    |
    v
Puppy Training (Geese/Chickens)
    |
    v
Herd Animals (Luanti Blocky)
    |
    v
Advanced Herding (OpenRTS 3D)
```

## Features

### Progressive AI Complexity

| Stage | Description | Animals | Behaviors |
|-------|-------------|---------|-----------|
| **Stage 1: Simple** | Basic random movement, flee/approach | Chickens, Ducks | Random walk, basic reactions |
| **Stage 2: Puppy Training** | Learn commands on easy targets | Geese, Chickens | Dog skill progression |
| **Stage 3: Herd Animals** | Flocking behaviors emerge | Sheep, Cattle | Boids, herd cohesion |
| **Stage 4: Advanced** | Full 3D terrain awareness | All species | Complex pathfinding |

### Animal Types

- **Poultry**: Chickens, Geese, Ducks (training targets)
- **Herd Animals**: Sheep, Cattle, Goats (production)
- **Working Dogs**: Border Collies, Australian Shepherds (player agents)
- **Equine**: Horses, Donkeys (transport)

### Dog Training System

```
Novice -> Apprentice -> Competent -> Expert -> Master
```

Puppies practice on progressively difficult targets:
- Chickens (difficulty 1.0) -> Novice training
- Geese (difficulty 2.0) -> Apprentice level
- Sheep (difficulty 2.5) -> Competent level
- Cattle (difficulty 3.5+) -> Expert to Master

### Quality Scaling

Adapts AI complexity based on engine tier:

```typescript
import { createQualityScaler, EngineTier } from '@studylog/ranch-simulation';

// Low-end 2D
const lowEnd = createQualityScaler(EngineTier.MICROVERSE_2D);

// Mid-range 3D
const midRange = createQualityScaler(EngineTier.LUANTI_BLOCKY);

// High-end 3D
const highEnd = createQualityScaler(EngineTier.OPENRTS_3D);
```

## Installation

```bash
pnpm install @studylog/ranch-simulation
```

## Quick Start

```typescript
import { createRanchSimulation, EngineTier } from '@studylog/ranch-simulation';

// Create simulation instance
const sim = createRanchSimulation();

// Create a new ranch
const ranch = sim.createRanch('user-123', 'Green Pastures', EngineTier.LUANTI_BLOCKY);

// Spawn some animals
const spawnResult = sim.spawnAnimals({
  ranchId: ranch.id,
  spawns: [
    { speciesId: 'chicken', position: { x: 10, y: 0, z: 10 } },
    { speciesId: 'chicken', position: { x: 12, y: 0, z: 10 } },
    { speciesId: 'border_collie', position: { x: 5, y: 0, z: 5 } },
  ],
});

// Update AI (call each frame)
const updateResult = sim.updateAI({
  ranchId: ranch.id,
  delta: {
    deltaTime: 16.67, // ~60fps
    currentTime: Date.now(),
    timeScale: 1.0,
  },
  playerPosition: { x: 0, y: 0, z: 0 },
});

// Give a command to your dog
sim.giveDogCommand({
  ranchId: ranch.id,
  dogId: spawnResult.animalIds[2],
  command: 'gather',
  targetAnimals: spawnResult.animalIds.slice(0, 2),
});
```

## API Reference

### Main Classes

#### `RanchSimulation`

Main orchestrator for all ranch simulation systems.

```typescript
const sim = createRanchSimulation();

// Ranch management
sim.createRanch(ownerId, name, engineTier);
sim.getRanch(ranchId);
sim.saveRanch(ranchId);
sim.loadRanch(saveData);

// Animals
sim.spawnAnimals(request);
sim.getAnimals(ranchId);

// AI updates
sim.updateAI(request);

// Dog commands
sim.giveDogCommand(request);
sim.startTraining(request);

// Progression
sim.progressStage(request);
```

#### `AnimalAIController`

Controls individual animal behavior.

```typescript
import { AnimalAIController } from '@studylog/ranch-simulation';

const controller = new AnimalAIController({
  engineTier: EngineTier.LUANTI_BLOCKY,
  aiStage: AIComplexityStage.HERD_ANIMALS,
});

controller.update(animal, context);
```

#### `FlockingBehavior`

Boids-based herd movement.

```typescript
import { FlockingBehavior } from '@studylog/ranch-simulation';

const flocking = new FlockingBehavior({
  perceptionRadius: 10,
  maxForce: 0.5,
  weights: {
    cohesion: 0.5,
    alignment: 0.5,
    separation: 1.0,
    goal: 0.8,
    avoidance: 2.0,
  },
});

const acceleration = flocking.calculateFlocking(animal, herd, allAnimals, goal);
```

#### `DogTrainingManager`

Progressive skill development for herding dogs.

```typescript
import { DogTrainingManager } from '@studylog/ranch-simulation';

const trainer = new DogTrainingManager();

// Execute a command
const result = trainer.executeCommand(dog, command, targetAnimals, targetPosition);

// Start a training session
const session = trainer.startTrainingSession(dog, command, trainingAnimals);

// Create a new puppy
const puppy = createPuppy(id, 'Buddy', 'black_white', { x: 0, y: 0, z: 0 });
```

#### `HerdManager`

Manages groups of animals.

```typescript
import { HerdManager } from '@studylog/ranch-simulation';

const manager = new HerdManager();

// Form herds from loose animals
const herds = manager.formHerds(animals, ownerId);

// Update herd state
manager.updateHerds(animals, deltaMs, threats, obstacles);

// Merge/split herds
manager.mergeHerds(herdId1, herdId2);
manager.splitHerd(herdId);
```

#### `RanchStateManager`

Save/load and persistence.

```typescript
import { RanchStateManager } from '@studylog/ranch-simulation';

const manager = new RanchStateManager();

const ranch = manager.createRanch(ownerId, name, engineTier);
const saveData = manager.saveRanch(ranchId);
const loaded = manager.loadRanch(saveData);
```

#### `RanchQualityScaler`

Adaptive AI quality scaling.

```typescript
import { RanchQualityScaler } from '@studylog/ranch-simulation';

const scaler = new RanchQualityScaler(EngineTier.LUANTI_BLOCKY);

// Get update batch for this frame
const batch = scaler.getUpdateBatch(animals, currentTime, playerPosition);

// Query nearby animals efficiently
const nearby = scaler.queryNearby(position, radius, animals);

// Check performance scaling
const shouldDowngrade = scaler.shouldDowngrade({ avgFPS: 18, avgFrameTime: 55 });
```

### Species Registry

```typescript
import {
  getSpecies,
  getSpeciesByCategory,
  getSpeciesByStage,
  TRAINING_TARGETS,
} from '@studylog/ranch-simulation';

const chicken = getSpecies('chicken');
const poultry = getSpeciesByCategory('poultry');
const stage1 = getSpeciesByStage(AIComplexityStage.SIMPLE);
const targets = TRAINING_TARGETS['chicken'];
```

## File Structure

```
ranch-simulation/
├── index.ts              # Main API entry point
├── types.ts              # All type definitions
├── species-registry.ts   # Animal configurations
├── animal-ai.ts          # Base animal AI controller
├── flocking-behavior.ts  # Boids herd movement
├── dog-training.ts       # Puppy progression system
├── herd-manager.ts       # Herd organization
├── ranch-state.ts        # Save/load system
├── quality-scaling.ts    # Adaptive AI scaling
├── package.json
└── README.md
```

## Stage Progression Requirements

| Stage | Min Animals | Min Training | Engine Tier |
|-------|-------------|--------------|-------------|
| Simple | 0 | 0 | MicroVerse 2D |
| Puppy Training | 5 | 0 | MicroVerse 2D |
| Herd Animals | 10 | 10 | Luanti Blocky |
| Advanced Herding | 30 | 50 | OpenRTS 3D |

## Dog Commands

| Command | Description | Skill Level |
|---------|-------------|-------------|
| `bark` | Bark to gather attention | Novice |
| `come` | Return to player | Novice |
| `stay` | Hold position | Apprentice |
| `walk_up` | Move forward slowly | Apprentice |
| `flank_left` | Move to left flank | Competent |
| `flank_right` | Move to right flank | Competent |
| `gather` | Bring animals toward player | Expert |
| `circle` | Circle around the herd | Master |

## License

MIT

## Contributing

This is part of the SuperInstance.AI ecosystem. See the main repository for contribution guidelines.
