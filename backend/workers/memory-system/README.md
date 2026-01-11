# StudyLoG.AI Memory System

A comprehensive 6-tier hierarchical memory system for educational AI applications, inspired by cognitive science and neuroscience research.

## Overview

The Memory System implements a biologically-inspired architecture for storing, consolidating, and retrieving educational experiences. It supports progressive disclosure, personalized learning paths, and cross-product memory sharing between StudyLoG.AI, DMLoG.AI, and other SuperInstance products.

## Architecture

### 6-Tier Memory Hierarchy

```
                    HIERARCHICAL MEMORY ARCHITECTURE
                    ===============================

    +---------------------------------------------------------------+
    |                     WORKING MEMORY (STM)                       |
    |  Capacity: 20 items | Decay: 30min | Access: O(1)            |
    |  - Current cognitive workspace                                 |
    |  - Priority-based eviction (LRU + importance)                 |
    |  - Time-based decay with half-life                            |
    +-------------------------------+-------------------------------+
                                    | Consolidation
                                    v
    +---------------------------------------------------------------+
    |                    EPISODIC MEMORY (LTM)                      |
    |  Capacity: 1000 events | Decay: Importance-based             |
    |  - Autobiographical events with context                       |
    |  - Emotional valence tagging (-1 to +1)                       |
    |  - Spatial and temporal indexing                              |
    |  - Participant tracking for social networks                   |
    +-------------------------------+-------------------------------+
                                    | Consolidation
                                    v
    +---------------------------------------------------------------+
    |                    SEMANTIC MEMORY (LTM)                      |
    |  Capacity: Unlimited | Decay: None                           |
    |  - General knowledge and concepts                             |
    |  - Vector embeddings for similarity search                    |
    |  - Concept hierarchies (parent-child relationships)           |
    |  - Associations between concepts                              |
    +---------------------------------------------------------------+
    +---------------------------------------------------------------+
    |                   PROCEDURAL MEMORY (LTM)                     |
    |  Capacity: Unlimited | Decay: Optional (5%/day)              |
    |  - Skills and know-how                                       |
    |  - 6 mastery levels with practice-based advancement           |
    |  - Skill prerequisites and synergies                         |
    |  - Performance history tracking                               |
    +---------------------------------------------------------------+
    +---------------------------------------------------------------+
    |                   REFLECTION MEMORY (LTM)                     |
    |  Capacity: Unlimited | Decay: None                           |
    |  - Metacognitive insights                                    |
    |  - Learning strategies                                       |
    |  - Misconception corrections                                  |
    |  - Pattern recognition                                       |
    +---------------------------------------------------------------+
    +---------------------------------------------------------------+
    |                    IDENTITY MEMORY (LTM)                      |
    |  Capacity: Unlimited | Decay: None                           |
    |  - Core traits and self-model                                |
    |  - Learning preferences                                     |
    |  - Persistence and curiosity drivers                         |
    |  - High-stability characteristic storage                     |
    +---------------------------------------------------------------+
```

## Installation

```bash
pnpm install @studylog/memory-system
```

## Quick Start

```typescript
import { createMemorySystem } from '@studylog/memory-system';

// Create memory system
const memory = createMemorySystem({
  workingCapacity: 20,
  episodicCapacity: 1000
});

// Add episodic memory (learning event)
memory.episodic.add('epi_1', 'Learned about neural network backpropagation', {
  module: 'cognitive-mill',
  topic: 'deep-learning',
  difficulty: 0.7,
  timeSpent: 30,
  success: true
}, {
  emotionalValence: 0.8,
  importance: 8
});

// Add semantic concept
memory.semantic.addConcept('backpropagation', {
  type: 'algorithm',
  domain: 'deep-learning'
}, {
  confidence: 0.7
});

// Add skill
memory.procedural.addSkill('pytorch', 'framework');
memory.procedural.practice('pytorch', true, 0.8);

// Search memories
const results = memory.search('neural networks');
console.log(results);
```

## Core Components

### 1. Memory Hierarchy (`memory-hierarchy.ts`)

The core 6-tier implementation with:
- **WorkingMemory**: Short-term cognitive workspace with priority-based eviction
- **EpisodicMemory**: Autobiographical events with multi-indexing
- **SemanticMemory**: Concepts with vector embeddings and associations
- **ProceduralMemory**: Skills with mastery progression
- **ReflectionMemoryStore**: Metacognitive insights
- **IdentityMemoryStore**: Persistent self-model

### 2. Consolidation (`consolidation.ts`)

Transfers memories between tiers:
- Time-based consolidation (periodic)
- Importance-based consolidation
- Surprise detection (KL divergence)
- Sleep consolidation simulation
- Pattern extraction and clustering

### 3. Temporal Landmarks (`temporal-landmarks.ts`)

Detects and organizes memorable moments:
- First-time events
- Peak experiences (high emotion)
- Milestones and breakthroughs
- Transitions and setbacks
- Chapter formation for narrative

### 4. Autobiographical Narrative (`autobiographical.ts`)

Constructs coherent life stories:
- Chapter-based organization
- Self-description generation
- Growth highlighting
- Challenge identification
- Cross-product narrative integration

### 5. Learning Events (`learning-events.ts`)

Tracks educational progress:
- Milestone detection and rewards
- XP calculation and leveling
- Session analytics
- Streak tracking
- Badge eligibility

### 6. Memory Retrieval (`memory-retrieval.ts`)

Flexible search across all tiers:
- Semantic similarity search
- Temporal range queries
- Context-based filtering
- Associative graph traversal
- Hybrid multi-modal search

### 7. Forgetting Curve (`forgetting-curve.ts`)

Optimizes review scheduling:
- Ebbinghaus forgetting curve
- SM-2 spaced repetition algorithm
- Review recommendations
- Retention analytics
- At-risk memory identification

## API Reference

### Factory Functions

```typescript
// Create full memory system
const memory = createMemorySystem(config);

// Create student-specific system
const studentMemory = createStudentMemorySystem(studentId, config);

// Create minimal system for testing
const minimal = createMinimalMemorySystem();
```

### Memory Operations

```typescript
// Working memory
memory.working.add('key', 'content', importance);
memory.working.get('key');
memory.working.items();

// Episodic memory
memory.episodic.add(id, content, context, options);
memory.episodic.searchByTime(start, end);
memory.episodic.searchByEmotion(min, max);

// Semantic memory
memory.semantic.addConcept(id, name, attributes, options);
memory.semantic.similaritySearch(embedding, topK);
memory.semantic.associativeSearch(seedId, maxDepth);

// Procedural memory
memory.procedural.addSkill(id, name, category, options);
memory.procedural.practice(skillId, success, quality);
memory.procedural.getMastery(skillId);
memory.procedural.canPerform(skillId, minLevel);
```

### Retrieval

```typescript
// Semantic search
const results = memory.retrieval.semantic('neural networks', 10);

// Temporal search
const recent = memory.retrieval.temporal(startTime, endTime);

// Hybrid search
const hybrid = memory.retrieval.search({
  query: 'machine learning',
  mode: 'hybrid',
  weights: { semantic: 0.5, temporal: 0.3, contextual: 0.2 },
  topK: 10
});
```

### Consolidation

```typescript
// Run consolidation
const result = await memory.consolidation.consolidate('episodic');

// Run full consolidation
const allResults = await memory.consolidation.consolidateAll();

// Sleep simulation
const sleepResult = await memory.consolidation.simulateSleepConsolidation(8);
```

### Analytics

```typescript
// Get system statistics
const stats = memory.getStats();

// Get learning analytics
const analytics = memory.learningAnalytics.generateAnalytics(studentId);

// Check for new milestones
const newMilestones = memory.milestones.checkMilestones();

// Get retention statistics
const retention = memory.analytics.getRetentionStats();
```

## Configuration

```typescript
interface MemorySystemConfig {
  // Working memory
  workingCapacity: number;           // Default: 20
  workingDecayDuration: number;       // Default: 30 minutes
  workingHalfLife: number;            // Default: 15 minutes

  // Episodic memory
  episodicCapacity: number;           // Default: 1000
  episodicDecayEnabled: boolean;      // Default: true

  // Semantic memory
  semanticEmbeddingDim: number;       // Default: 384
  semanticSimilarityThreshold: number;// Default: 0.7

  // Procedural memory
  proceduralDecayRate: number;        // Default: 0.05 (5%/day)
  proceduralMasteryDecay: boolean;     // Default: true

  // Consolidation
  consolidationInterval: number;      // Default: 24 hours
  consolidationBatchSize: number;     // Default: 10
  surpriseThreshold: number;          // Default: 0.5

  // Retrieval
  defaultTopK: number;               // Default: 10

  // Forgetting curve
  defaultHalflife: number;            // Default: 7 days
  reviewScheduleAlgorithm: 'sm2' | 'leitner' | 'custom';

  // Storage
  persistToD1: boolean;
  persistToKV: boolean;
  persistToVectorize: boolean;
}
```

## Integration with StudyLoG.AI

### Cognitive Mill

```typescript
// Track learning events during Cognitive Mill lessons
memory.episodic.add(id, content, {
  module: 'cognitive-mill',
  lesson: lessonId,
  topic: 'neural-networks',
  difficulty: 0.7
}, {
  emotionalValence: excitement,
  importance: MemoryImportance.SIGNIFICANT
});
```

### Intelligence Ranch

```typescript
// Track agent skills and breeding
memory.procedural.addSkill(agentId, skillName, 'agent-skill');
memory.procedural.practice(agentId, success, performance);
```

### Sitka Sound

```typescript
// Track multi-agent interactions
memory.episodic.add(id, interaction, {
  module: 'sitka-sound',
  participants: [agent1, agent2]
}, {
  emotionalValence: valence,
  metadata: { coalitionFormation: true }
});
```

## Cross-Product Integration

Memory can be shared between StudyLoG.AI products:

```typescript
// Share memory with DMLoG.AI
memory.episodic.add(id, content, {
  module: 'dmlog',
  topic: 'character-development'
}, {
  metadata: {
    crossProduct: true,
    sourceProduct: 'studylog',
    targetProduct: 'dmlog'
  }
});
```

## Persistence

```typescript
// Export student data
const data = memory.export(studentId);

// Import student data
memory.import(studentId, data);
```

## Scientific Foundation

This implementation is based on research from:

1. **SuperInstance hierarchical-memory** - https://github.com/SuperInstance/hierarchical-memory
2. **Working Memory**: Miller's "7±2" rule (1956), Cowan (2001)
3. **Episodic Memory**: Tulving's theory (1972)
4. **Semantic Memory**: Tulving's semantic framework (1972)
5. **Forgetting Curve**: Ebbinghaus (1885)
6. **Spaced Repetition**: SM-2 algorithm (SuperMemo)

## License

MIT

## Contributing

This is part of the StudyLoG.AI by SuperInstance.AI project. See main repository for contribution guidelines.
