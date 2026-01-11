# @studylog/character-sdk

A unified SDK for creating AI characters with memory, personality, and learning capabilities for StudyLoG.AI.

Inspired by the [SuperInstance ai-character-sdk](https://github.com/SuperInstance/ai-character-sdk), adapted for educational use cases.

## Features

- **Unified Character API** - Simple, intuitive interface for character creation
- **6-Tier Memory System** - Hierarchical memory inspired by cognitive neuroscience
- **Intelligent Decision Routing** - Cost-effective escalation engine (BOT/BRAIN/HUMAN)
- **Dynamic Personality** - Trait-based behavior system
- **Outcome Learning** - Reinforcement learning from experience
- **Persistence** - Save and load character state
- **Educational Extensions** - Student profiles, learning styles, mastery tracking

## Installation

```bash
pnpm add @studylog/character-sdk
```

## Quick Start

```typescript
import { Character } from '@studylog/character-sdk';

// Create a character
const hero = new Character({
  name: 'Luna',
  characterClass: 'ranger',
  personality: {
    bravery: 0.8,
    curiosity: 0.9,
    kindness: 0.7,
  },
  backstory: 'A wanderer from the northern forests who seeks to protect nature.',
  goals: ['Protect the forest', 'Help those in need'],
});

// Use the character
const response = await hero.think('A merchant needs help with bandits');
console.log(response.content);
console.log(response.action); // 'help', 'talk', 'attack', etc.
console.log(response.tier);   // 'bot', 'brain', or 'human'

// Remember experiences
hero.remember(
  'Helped the merchant defeat the bandits',
  7.0, // importance
  0.8  // emotional valence (-1 to 1)
);

// Learn from outcomes
hero.learn(
  'Made a new ally',
  true,  // success
  10.0   // reward
);

// Save character state
await hero.save('./luna.json');
```

## Core API

### Character Creation

```typescript
// Direct creation
const hero = new Character({
  name: 'Luna',
  characterClass: 'ranger',
  personality: { bravery: 0.8, curiosity: 0.9 },
  backstory: 'A wanderer from the northern forests.',
  goals: ['Protect the forest', 'Help those in need'],
  quirks: ['Talks to animals', 'Hates cities'],
});

// Factory function
import { createCharacter } from '@studylog/character-sdk';
const hero = createCharacter('Luna', {
  characterClass: 'ranger',
  personality: { bravery: 0.8 },
});
```

### Think - Generate Responses

```typescript
const response = await hero.think(
  'A merchant needs help with bandits',
  0.7,  // stakes (0-1)
  5000  // urgency in ms
);

console.log(response.content);     // What the character says
console.log(response.action);      // What action they take
console.log(response.tier);        // BOT, BRAIN, or HUMAN
console.log(response.confidence);  // Confidence level
```

### Remember - Store Memories

```typescript
// Store different types of memories
hero.remember(
  'Helped the merchant defeat the bandits',
  7.0,   // importance (1-10)
  0.8,   // emotional valence (-1 to +1)
  'episodic' as MemoryTier
);

// Shortcut methods
import { MemoryTier } from '@studylog/character-sdk';

hero.remember('Currently watching the road', 3.0, 0, MemoryTier.WORKING);
hero.remember('Fought bandits on the trade road', 7.0, 0, MemoryTier.EPISODIC);
hero.remember('I always help those in need', 8.0, 0, MemoryTier.SEMANTIC);
hero.remember('I fight best with a bow', 9.0, 0, MemoryTier.PROCEDURAL);
```

### Recall - Retrieve Memories

```typescript
// Search by relevance
const memories = hero.recall('bandit fight', 5);

// Get recent memories
const recent = hero.memory.getRecent(24, 10); // last 24 hours

// Get important memories
const important = hero.memory.getImportant(6.0, 10); // importance >= 6

// Get memories by subject (StudyLoG.AI extension)
const mathMemories = hero.memory.getMemoriesBySubject('mathematics');
```

### Learn - From Outcomes

```typescript
// Record an outcome
hero.learn(
  'Successfully defended the merchant',
  true,   // success
  10.0    // reward
);

// Get learning summary
const summary = hero.getLearningSummary();
console.log(`Success rate: ${(summary.successRate * 100).toFixed(1)}%`);
console.log(`Total outcomes: ${summary.totalOutcomes}`);
```

### Personality - Manage Traits

```typescript
// View personality
const personality = hero.getPersonalitySummary();
console.log(personality.traits);
console.log(personality.dominantTrait); // e.g., 'curiosity'

// Get/set individual traits
const bravery = hero.getTrait('bravery');
hero.setTrait('bravery', 0.95);

// Modify traits gradually
hero.modifyTrait('bravery', 0.05); // Increase by 0.05
```

## Decision Tiers

The SDK uses intelligent routing through three decision tiers:

| Tier | Use Case | Cost | Speed |
|------|----------|------|-------|
| **BOT** | Routine situations, high familiarity | Free | Fastest |
| **BRAIN** | Novel situations, personality-driven | Low | Medium |
| **HUMAN** | Critical decisions, high stakes | High | Slowest |

Routing is based on:
- Stakes assessment
- Novelty detection
- Time constraints
- Historical performance

## Memory System

Six-tier hierarchical memory:

| Tier | Purpose | Duration |
|------|---------|----------|
| **Working** | Current attention | Seconds-minutes |
| **Mid-Term** | Session buffer | 1-6 hours |
| **Long-Term** | Consolidated storage | 1+ weeks |
| **Episodic** | Specific events "what-where-when" | Permanent |
| **Semantic** | Consolidated patterns & facts | Permanent |
| **Procedural** | Skills & learned behaviors | Permanent |

## Educational Extensions (StudyLoG.AI)

### Student Profiles

```typescript
import { StudentPersonality, LearningStyle } from '@studylog/character-sdk';

const student = new StudentPersonality(
  {
    curiosity: 0.9,
    persistence: 0.7,
    collaboration: 0.8,
  },
  LearningStyle.VISUAL,
  ['mathematics', 'science'],  // interests
  ['problem-solving'],          // strengths
  ['memorization']              // support areas
);

// Get personalized recommendations
const recommendations = student.getLearningRecommendations();
console.log(recommendations.preferredContentTypes);  // ['diagrams', 'videos', ...]
console.log(recommendations.suggestedStudyMethods);  // ['color-coding', ...]
```

### Study Memories

```typescript
// Store study-specific memory
hero.memory.storeStudy(
  'Learned about photosynthesis',
  {
    subject: 'biology',
    topic: 'photosynthesis',
    difficulty: 7,
    masteryLevel: 'learning',
    standards: ['NGSS-LS1-5'],
    importance: 8.0,
  }
);
```

## Custom LLM Integration

```typescript
const hero = new Character({
  name: 'Wizard',
  characterClass: 'wizard',
  async onThink(character, situation, context, highStakes) {
    // Your LLM integration here
    const response = await callLLM({
      system: `You are ${character.name}, a ${character.characterClass}`,
      user: context,
    });

    return {
      content: response.content,
      action: 'talk',
      confidence: 0.8,
      thoughts: 'Generated via LLM',
    };
  },
});
```

## Persistence

```typescript
// Save character
await hero.save('./my-character.json');

// Load character
const loaded = new Character({ name: 'Hero' });
await loaded.load('./my-character.json');

// Get full stats
const stats = hero.getStats();
console.log(stats);
```

## License

MIT

## Contributing

This package is part of StudyLoG.AI by SuperInstance.AI. Contributions welcome!
