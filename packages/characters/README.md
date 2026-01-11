# @studylog/characters

**AI Character System for StudyLoG.AI**

A personality-driven AI character system with hierarchical memory, inspired by research from SuperInstance ai-character-integrations.

## Overview

This package provides a complete character system for creating AI tutors and NPCs with:

- **Personality System** - Big Five (OCEAN) personality model for distinctive characters
- **Hierarchical Memory** - 6-tier memory system with consolidation
- **Decision Routing** - Cost-optimized escalation (BOT -> BRAIN -> HUMAN)
- **Relationship Tracking** - Characters remember students and adapt to them
- **Progressive Unlocking** - Characters unlock as students advance

## Installation

```bash
pnpm install @studylog/characters
```

## Quick Start

```typescript
import {
  CharacterFactory,
  ScenarioType,
} from '@studylog/characters';

// Create a character
const ada = CharacterFactory.createAda();

// Teach a concept
const lesson = await ada.teachConcept('neural networks', {
  id: 'student_123',
  name: 'Alex',
  skillLevel: 0.5,
  frustrationLevel: 0.3,
  recentFailures: 0,
  recentSuccesses: 2,
});

console.log(lesson);
// "Let me explain neural networks using an analogy..."
```

## Available Characters

| Name | Title | Stage | Personality | Specialty |
|------|-------|-------|-------------|-----------|
| **Ada** | Concept Explorer | 1 | Explorer | Analogies, curiosity |
| **Alan** | Algorithm Architect | 2 | Expert | Step-by-step, precision |
| **Grace** | Applications Guide | 3 | Guide | Real-world, encouragement |
| **Geoffrey** | Deep Learning Sage | 4 | Mentor | Theory, mathematics |

## Personality System

Characters use the Big Five personality traits:

```typescript
interface Personality {
  openness: number;          // 0-1, creativity and curiosity
  conscientiousness: number; // 0-1, organization and discipline
  extraversion: number;      // 0-1, social engagement
  agreeableness: number;     // 0-1, cooperation and empathy
  neuroticism: number;       // 0-1, emotional stability (inverted)
}
```

### Personality Presets

```typescript
import { PERSONALITY_PRESETS } from '@studylog/characters';

const personalities = {
  mentor: { openness: 0.7, conscientiousness: 0.9, ... },
  guide: { openness: 0.8, conscientiousness: 0.6, ... },
  expert: { openness: 0.6, conscientiousness: 0.95, ... },
  explorer: { openness: 0.95, conscientiousness: 0.5, ... },
  // ... more presets
};
```

## Memory System

Characters have hierarchical memory with 6 tiers:

```typescript
import { CharacterMemory, MemoryType } from '@studylog/characters';

const memory = new CharacterMemory('character_id');

// Store different types of memories
memory.storeWorking('Current context...', 5.0, 0);
memory.storeEpisodic('Specific event that happened...', 6.0, 0.5);
memory.storeSemantic('General fact to remember...', 7.0, 0);
memory.storeProcedural('How to do a skill...', 6.0, 0.5);
memory.storeReflection('Insight about learning...', 8.0);

// Retrieve memories
const memories = memory.retrieve('neural networks', {
  types: [MemoryType.SEMANTIC, MemoryType.EPISODIC],
  minImportance: 5.0,
  limit: 10,
});

// Generate narrative
const narrative = memory.generateNarrative();
console.log(narrative.narrative);
console.log(narrative.keyThemes);
console.log(narrative.coherenceScore);
```

## Usage Examples

### Teaching a Concept

```typescript
const ada = CharacterFactory.createAda();

const lesson = await ada.teachConcept('backpropagation', {
  id: 'student_123',
  name: 'Sam',
  skillLevel: 0.4,
  frustrationLevel: 0.2,
  recentFailures: 1,
  recentSuccesses: 3,
});
```

### Providing Hints

```typescript
const grace = CharacterFactory.createGrace();

// Progressive hints (0 = vague, 1 = specific)
const hint = grace.provideHint('gradient descent', 0.33, studentContext);
// "Think about how the algorithm finds its way downhill..."
```

### Celebrating Success

```typescript
const celebration = ada.celebrateSuccess('Sam', 'Building Your First Neural Network');
// "Excellent work, Sam! You've mastered Building Your First Neural Network!"
```

### Checking Relationships

```typescript
const relationship = ada.getRelationship('student_123');
console.log(relationship.trustLevel);       // 0-1
console.log(relationship.interactionCount); // Number of interactions
console.log(relationship.conceptsTaught);   // Array of concepts
```

### Getting Memory Stats

```typescript
const stats = ada.memory.getStats();
console.log(stats.totalMemories);
console.log(stats.byType);
console.log(stats.emotionalBalance);
console.log(stats.mostAccessed);
```

## Character Progression

Characters unlock progressively as students advance:

```typescript
// Stage 1: Basic concepts
const stage1 = CharacterFactory.getCharactersForStage(1);
// [Ada]

// Stage 2: Algorithms
const stage2 = CharacterFactory.getCharactersForStage(2);
// [Ada, Alan]

// Stage 3: Applications
const stage3 = CharacterFactory.getCharactersForStage(3);
// [Ada, Alan, Grace]

// Stage 4: Advanced theory
const stage4 = CharacterFactory.getCharactersForStage(4);
// [Ada, Alan, Grace, Geoffrey]
```

## Custom Characters

Create your own characters:

```typescript
import { AICharacter, PERSONALITY_PRESETS } from '@studylog/characters';

const customCharacter = new AICharacter({
  id: 'custom_tutor',
  name: 'Custom',
  title: 'Specialist Tutor',
  personality: PERSONALITY_PRESETS.mentor,
  capabilities: [
    { name: 'specialty', proficiency: 0.9, description: 'My special skill' },
  ],
  backstory: 'A unique character with a rich history...',
  goals: ['Goal 1', 'Goal 2'],
  systemPrompt: 'You are a custom tutor character...',
  teachingStyle: {
    approach: 'analogy',
    pace: 'normal',
    hintLevel: 'moderate',
    useExamples: true,
  },
  unlockStage: 2,
});
```

## Integration with Agent Director

The character system integrates with the existing agent director:

```typescript
import { CharacterDirectorService } from './character-director-service';

const director = new CharacterDirectorService();

// Process message with character personality
const response = await director.processUserMessage(
  'How do neural networks learn?',
  studentProfile
);

// Get available characters for current stage
const characters = director.getAvailableCharacters();

// Get relationship with a character
const relationship = director.getCharacterRelationship('ada');
```

## Decision Routing

Characters use cost-optimized decision routing:

```
User Query
     |
     v
Stakes Analysis (0-1)
     |
     v
Escalation Decision
     ├─ BOT (stakes < 0.3)      -> Rules-based, free
     ├─ BRAIN (stakes < 0.7)    -> Local LLM, $0.001
     └─ HUMAN (stakes >= 0.7)   -> API LLM, $0.03
     |
     v
Response Generation
```

## Memory Consolidation

Characters automatically consolidate memories:

```typescript
// Check if consolidation is needed
if (character.memory.shouldConsolidateEpisodic()) {
  const result = character.memory.consolidateEpisodicToSemantic();
  console.log(`Consolidated ${result.inputCount} episodes into ${result.outputCount} patterns`);
}

// Check reflection consolidation
if (character.memory.shouldConsolidateReflection()) {
  // Generate insights from experiences
}
```

## Research Basis

This character system is based on research from:
- SuperInstance ai-character-integrations repository
- Big Five personality model (OCEAN)
- Hierarchical memory systems
- Escalation engine for cost optimization
- Experience replay and learning loops

See `/docs/SUPERINSTANCE_CHARACTER_NOTES.md` for full research details.

## License

MIT

## Contributing

Contributions welcome! Please see the main StudyLoG.AI CONTRIBUTING.md file.
