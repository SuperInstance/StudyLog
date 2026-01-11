# SuperInstance AI Character SDK - Research Notes

**Agent:** Agent 8/8 (SDK Research Team)
**Repository:** https://github.com/SuperInstance/ai-character-sdk
**Research Date:** 2025-01-10
**Status:** Complete

---

## Executive Summary

The AI Character SDK is a well-designed Python framework that provides the **foundational abstractions** for building AI characters. It implements a clean, modular architecture with four core subsystems:

1. **6-Tier Hierarchical Memory** - Neuroscience-inspired memory consolidation
2. **3-Tier Decision Engine** - Cost-effective intelligent routing (BOT/BRAIN/HUMAN)
3. **Dynamic Personality System** - Trait-based behavior modification
4. **Outcome Learning System** - Reinforcement learning from experience

This SDK represents the **core abstractions layer** - the patterns that all other SuperInstance repos implicitly build upon.

---

## Table of Contents

1. [Repository Overview](#repository-overview)
2. [SDK Architecture](#sdk-architecture)
3. [Core Abstractions](#core-abstractions)
4. [Key Design Patterns](#key-design-patterns)
5. [API Design Analysis](#api-design-analysis)
6. [Code Examples](#code-examples)
7. [Good Ideas to Steal](#good-ideas-to-steal)
8. [Recommendations for StudyLoG.AI](#recommendations-for-studylogai)

---

## Repository Overview

### Project Structure

```
ai-character-sdk/
├── src/ai_character_sdk/
│   ├── __init__.py              # Clean public API exports
│   ├── core/
│   │   ├── character.py         # Main Character class (700+ lines)
│   │   ├── presets.py           # 7 character archetypes
│   │   └── factory.py           # Factory functions
│   ├── memory/
│   │   └── hierarchical.py      # 6-tier memory system (476 lines)
│   ├── decision/
│   │   └── engine.py            # Decision routing (475 lines)
│   ├── personality/
│   │   └── traits.py            # Trait system (250 lines)
│   └── learning/
│       └── outcomes.py          # Outcome tracking (346 lines)
├── examples/
│   ├── quickstart.py            # Basic usage
│   ├── finn_the_paladin.py      # Preset demo
│   └── party_example.py         # Multi-character coordination
├── tests/test_character.py
├── pyproject.toml
└── README.md
```

### Key Stats

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~2,500 |
| Core Classes | 8 |
| Preset Characters | 7 |
| Memory Tiers | 6 |
| Decision Tiers | 3 |
| Personality Traits | 25+ |
| Test Coverage | Basic but functional |

---

## SDK Architecture

### High-Level Architecture Diagram

```
                    Character (Unified API)
                           |
        +--+--+--+--+--+--+--+
        |  |  |  |  |  |  |  |
        v  v  v  v  v  v  v  v
    +-------+  +-------+  +-------+  +---------+
    | Memory |  |Decision|  |Persona|  | Learning|
    |  Tier  |  | Engine |  | lity  |  | System  |
    +-------+  +-------+  +-------+  +---------+
         |           |          |          |
         v           v          v          v
    [6 Tiers]    [3 Tiers]  [25 Traits] [RL Loop]
```

### Core Design Principles

1. **Composition Over Inheritance** - Each subsystem is independent and composable
2. **Clean API Surface** - Single `Character` class exposes all functionality
3. **Progressive Enhancement** - Works without LLM, better with LLM
4. **Serializable State** - Everything can be saved/loaded via JSON
5. **Factory Pattern** - Multiple ways to create characters for different use cases

---

## Core Abstractions

### 1. Character - The Unified API

The `Character` class is the main entry point. It composes all subsystems:

```python
class Character:
    """
    Unified AI Character with memory, personality, and learning.
    """
    def __init__(
        self,
        name: str,
        character_class: str = "adventurer",
        personality: Optional[Dict[str, float]] = None,
        backstory: str = "",
        goals: Optional[List[str]] = None,
        # ... more params
    ):
        # Initializes all subsystems
        self._init_memory()
        self._init_personality()
        self._init_decision()
        self._init_learning()

    # Main API methods
    def think(situation, stakes, urgency_ms) -> CharacterResponse
    def remember(content, importance, memory_type) -> Memory
    def recall(query, top_k) -> List[Memory]
    def learn(outcome, success, reward) -> LearningSignal
```

**Key Insight:** The Character class is a **facade** that unifies complex subsystems behind simple verbs: `think`, `remember`, `recall`, `learn`.

### 2. Hierarchical Memory System

Six-tier architecture inspired by cognitive neuroscience:

| Tier | Purpose | Duration | Capacity |
|------|---------|----------|----------|
| **Working** | Current attention | Seconds-minutes | 10 items |
| **Mid-Term** | Session buffer | 1-6 hours | 100 items |
| **Long-Term** | Consolidated | 1+ weeks | Unlimited |
| **Episodic** | "What-where-when" | Permanent | Unlimited |
| **Semantic** | Facts/patterns | Permanent | Unlimited |
| **Procedural** | Skills/habits | Permanent | Unlimited |

**Memory Scoring Algorithm:**

```python
# Weighted retrieval scoring
score = (
    alpha_recency * recency_score +      # Exponential decay per hour
    alpha_importance * importance_score + # Normalized 1-10
    alpha_relevance * relevance_score     # Word overlap Jaccard
) / total_weight
```

**Key Features:**
- Access count boosts importance (+5% per access)
- Automatic tier eviction when capacity exceeded
- Memory relationship tracking (related_memory_ids)
- JSON persistence with automatic save

### 3. Decision Engine - Three-Tier Routing

Intelligent cost-based routing:

```
                 DecisionContext
                 (stakes, urgency, novelty)
                        |
                        v
              +---------------------+
              |  Critical Override? |
              +---------------------+
                 |              |
                Yes              No
                 |               |
                 v               v
          [HUMAN Tier]    [Novel? High Stakes?]
                 |           |           |
                 |          Yes          No
                 |           |           |
                 |           v           v
                 |      [BRAIN Tier]  [BOT Tier]
```

**Routing Logic:**

```python
def route(context: DecisionContext) -> DecisionRouting:
    # 1. Check critical overrides first
    if context.character_hp_ratio <= 0.2:
        return DecisionRouting(tier=HUMAN, reason=SAFETY_CONCERN)

    # 2. Check novelty
    is_novel = _is_novel_situation(context)

    # 3. Route based on stakes + novelty
    if context.stakes >= 0.9:  # Critical
        return DecisionRouting(tier=HUMAN)
    elif is_novel or context.stakes >= 0.7:  # High stakes
        return DecisionRouting(tier=BRAIN)
    else:  # Routine
        return DecisionRouting(tier=BOT)
```

**Tier Characteristics:**

| Tier | Cost | Speed | Use Case |
|------|------|-------|----------|
| **BOT** | Free | <1ms | Routine, familiar situations |
| **BRAIN** | Low | 100-500ms | Novel situations, personality-driven |
| **HUMAN** | High | 1-5s | Critical decisions, high stakes |

### 4. Personality System

25 predefined traits across 5 categories:

```python
# Social: charisma, kindness, empathy, diplomacy, loyalty
# Intellectual: intelligence, curiosity, wisdom, caution, cunning
# Emotional: bravery, optimism, patience, humor, aggression
# Moral: honor, justice, honesty, devotion, mercy
# Behavioral: initiative, discipline, ambition, independence, adaptability
```

**Trait Application:**

```python
def apply_to_response(self, response):
    # Modify response based on dominant traits
    if self.get_trait("humor") > 0.7:
        response.content = response.content.rstrip(".") + "!"

    if self.get_trait("caution") > 0.7:
        response.content = "I carefully " + response.content.lower()

    if self.get_trait("aggression") > 0.7:
        response.action = "attack"

    # Emotional coloring
    if self.get_trait("optimism") > 0.7:
        response.emotions["hope"] += 0.5
```

### 5. Outcome Learning System

Reinforcement learning from experience:

```python
def record(outcome, success, reward) -> LearningSignal:
    # Create outcome record
    outcome_record = Outcome(...)

    # Generate learning signals
    signals = []
    if success and reward > 0:
        signals.append(LearningSignal(
            signal_type=f"action:{action_taken}",
            delta=reward * learning_rate * 0.1,
            confidence=0.7,
        ))

    # Track patterns
    _track_patterns(outcome_record)

    return signals[0]
```

**Learning Stats:**
- Success/failure pattern tracking
- Learning trend calculation (recent vs overall)
- Trait adjustment signals

---

## Key Design Patterns

### 1. Facade Pattern

The `Character` class hides complex subsystem interactions:

```python
# User sees simple API
hero.think("A dragon appears!")
hero.remember("Defeated the dragon")
hero.learn(success=True, reward=10)

# Internally, this coordinates:
# - Memory retrieval and storage
# - Decision routing
# - Personality application
# - Learning signal generation
```

### 2. Factory Pattern with Variants

Multiple creation patterns for different use cases:

```python
# Direct creation
hero = Character(name="Luna", character_class="ranger")

# Factory with archetype
hero = create_character(name="Luna", archetype="ranger")

# Adventure-specific
hero = create_adventure_character(name="Luna", role="ranger")

# Companion-specific
hero = create_companion_character(name="Luna", companion_type="friendly")

# Preset
hero = create_preset("finn_paladin")

# Party (multiple characters)
party = create_party()  # Returns dict of roles -> characters
```

### 3. Dataclass Configuration

Using `@dataclass` for clean configuration:

```python
@dataclass
class CharacterConfig:
    name: str
    character_class: str = "adventurer"
    personality: Dict[str, float] = field(default_factory=dict)
    backstory: str = ""
    goals: List[str] = field(default_factory=list)
    # ... sensible defaults
```

### 4. Enum for Type Safety

```python
class MemoryType(Enum):
    WORKING = "working"
    MID_TERM = "mid_term"
    LONG_TERM = "long_term"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"

class DecisionTier(Enum):
    BOT = "bot"
    BRAIN = "brain"
    HUMAN = "human"
```

### 5. Strategy Pattern for LLM Integration

Callback-based extension:

```python
def llm_think_handler(character, situation, context, high_stakes=False):
    response = call_llm(
        system=f"You are {character.name}",
        user=context,
    )
    return {"content": response, "action": "talk", "confidence": 0.8}

hero = Character(
    name="Wizard",
    on_think=llm_think_handler,  # Inject custom logic
)
```

### 6. Repository Pattern for Persistence

```python
def save(self, path: Optional[str] = None):
    """Save character state to file"""
    # Save memory
    self.memory.save()

    # Save character state
    state_data = {
        "name": self.name,
        "personality": dict(self.personality.traits),
        "outcomes": self.outcomes.to_dict(),
        # ...
    }
    with open(save_path, "w") as f:
        json.dump(state_data, f, indent=2)
```

---

## API Design Analysis

### Naming Conventions

The SDK uses **verb-based naming** that matches cognitive concepts:

| Verb | Purpose | Cognitive Metaphor |
|------|---------|-------------------|
| `think` | Generate response | Cognition |
| `remember` | Store memory | Encoding |
| `recall` | Retrieve memory | Retrieval |
| `forget` | Remove memory | Forgetting |
| `learn` | Update from outcome | Learning |

### Convenience Methods

Specialized memory storage methods:

```python
hero.remember(content, memory_type=EPISODIC)  # Generic
hero.store_working(content)                   # Shortcut
hero.store_mid_term(content)
hero.store_episodic(content)
hero.store_semantic(content)
hero.store_procedural(content)
```

### Fluent Configuration

```python
hero.set_trait("bravery", 0.9)
hero.modify_trait("bravery", 0.1)  # Incremental

# Query
bravery = hero.get_trait("bravery", default=0.5)
dominant = hero.personality.get_dominant_trait(min_value=0.6)
```

---

## Code Examples

### Example 1: Basic Character Usage

```python
from ai_character_sdk import Character

# Create a character
hero = Character(
    name="Luna",
    character_class="ranger",
    personality={"bravery": 0.8, "curiosity": 0.9},
    backstory="A wanderer from the northern forests.",
    goals=["Protect the forest", "Help those in need"],
)

# Use the character
response = hero.think("A merchant needs help with bandits", stakes=0.7)
print(response.content)  # What the character says
print(response.action)   # What action they take
print(response.tier)     # BOT, BRAIN, or HUMAN

# Remember experiences
hero.remember(
    "Helped the merchant defeat the bandits",
    importance=7.0,
    emotional_valence=0.8,
)

# Learn from outcomes
hero.learn(outcome="Made a new ally", success=True, reward=10.0)
```

### Example 2: Memory Retrieval

```python
# Store memories
hero.remember("Fought a dragon", importance=9.0)
hero.remember("Ate lunch", importance=3.0)
hero.remember("Met the king", importance=8.0)

# Retrieve by relevance
memories = hero.recall("dragon battle", top_k=3)

# Get recent memories
recent = hero.get_recent_memories(hours=24, top_k=10)

# Get important memories
important = hero.get_important_memories(threshold=6.0)
```

### Example 3: Multi-Character Party

```python
from ai_character_sdk import create_party

# Create a balanced adventuring party
party = create_party()
# Returns: {"tank": Character, "healer": Character, ...}

# Each character responds to the same situation
for role, character in party.items():
    response = character.think("A dragon appears!", stakes=0.95)
    print(f"{character.name}: {response.content}")
```

### Example 4: Preset Characters

```python
from ai_character_sdk import create_preset, available_presets

# See available presets
print(available_presets())
# ['finn_paladin', 'sage_wizard', 'shadow_rogue', ...]

# Use a preset
finn = create_preset("finn_paladin")

# Override preset values
custom_finn = create_preset("finn_paladin", bravery=0.99)
```

### Example 5: Custom LLM Integration

```python
def llm_think_handler(character, situation, context, high_stakes=False):
    """Custom LLM integration"""
    response = openai.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": f"You are {character.name}"},
            {"role": "user", "content": context},
        ]
    )
    return {
        "content": response.choices[0].message.content,
        "action": "talk",
        "confidence": 0.8,
    }

hero = Character(
    name="Wizard",
    on_think=llm_think_handler,
)
```

---

## Good Ideas to Steal

### 1. Cognitive Metaphor API

The SDK's use of cognitive verbs (`think`, `remember`, `learn`) makes the API intuitive and memorable. For StudyLoG.AI's educational focus, this is perfect.

### 2. Cost-Effective Decision Routing

The three-tier routing (BOT/BRAIN/HUMAN) is an excellent pattern for managing AI costs while maintaining quality. Route routine decisions to rules, novel to local LLM, critical to API.

### 3. Access Count Memory Boosting

Memories gain importance when accessed (+5% per access). This mimics human memory reinforcement and is simple to implement.

### 4. Factory Pattern Variants

Having multiple factory functions for different use cases (`create_character`, `create_adventure_character`, `create_companion_character`, `create_party`) makes the SDK friendly for different scenarios.

### 5. Tiered Memory Architecture

The six-tier memory system maps well to cognitive science and provides clear semantics for different types of information storage.

### 6. Personality-Driven Response Modification

The `apply_to_response` method pattern allows personality to flavor responses without complex prompting.

### 7. Learning Signal Generation

The outcome tracking system generates structured `LearningSignal` objects that can be consumed by any learning mechanism.

### 8. Serializable Everything

All state can be serialized to JSON for persistence, testing, and debugging.

### 9. Preset System

Character presets (archetypes) provide instant value and demonstrate best practices for configuration.

### 10. Statistical Tracking

Built-in statistics for decision making, memory, and learning enable debugging and optimization.

---

## Recommendations for StudyLoG.AI

### Priority 1: Adopt Core Abstractions

Implement these core patterns from the SDK:

1. **Unified Agent Class** - Create a `StudyAgent` class similar to `Character`
2. **Hierarchical Memory** - Implement the 6-tier memory system for student progress
3. **Decision Routing** - Use three-tier routing for cost-effective AI responses
4. **Trait System** - Map learning traits (curiosity, persistence, etc.)

### Priority 2: Educational Adaptations

Adapt the SDK patterns for education:

```python
# Instead of Character, create StudyAgent
class StudyAgent:
    """AI learning companion with progress tracking"""

    def __init__(self, student_name: str, subject: str):
        self.memory = HierarchicalMemory(student_name)
        self.personality = Personality(learning_traits)
        self.progress = ProgressTracker()

    # Educational cognitive verbs
    def explore(self, topic: str) -> LessonResponse:
        """Explore a new topic"""

    def practice(self, skill: str) -> PracticeResult:
        """Practice a skill"""

    def reflect(self, experience: str) -> Reflection:
        """Reflect on learning"""

    def master(self, skill: str) -> MasteryLevel:
        """Check mastery level"""
```

### Priority 3: Memory Integration

Map SDK memory tiers to educational concepts:

| SDK Tier | Educational Concept |
|----------|-------------------|
| Working | Current problem/solution context |
| Mid-Term | Current session progress |
| Long-Term | Unit/course mastery |
| Episodic | Specific learning experiences |
| Semantic | Facts/concepts learned |
| Procedural | Skills mastered |

### Priority 4: Decision Routing for Cost

Implement the three-tier routing for StudyLoG.AI:

| Tier | Educational Use Case |
|------|---------------------|
| BOT | Formula lookup, definition retrieval, rule-based feedback |
| BRAIN | Explanation generation, personalized hints, local tutoring |
| HUMAN | Complex concept explanations, emotional support, critical feedback |

### Priority 5: Progress Persistence

Adopt the JSON serialization pattern:

```python
# Save student progress
student_agent.save("/path/to/student_progress.json")

# Load student progress
student_agent = StudyAgent("Jane", "mathematics")
student_agent.load("/path/to/student_progress.json")
```

---

## Implementation Plan for StudyLoG.AI

### Phase 1: Core SDK Port (Week 1-2)

1. Create TypeScript/JavaScript versions of core SDK classes
2. Implement `HierarchicalMemory` with localStorage persistence
3. Implement `Personality` system with learning traits
4. Implement `OutcomeTracker` for learning progress

### Phase 2: StudyLoG Integration (Week 3-4)

1. Create `StudyAgent` class extending SDK patterns
2. Map memory tiers to educational progress tracking
3. Implement decision routing for AI tutor responses
4. Create preset student archetypes (visual learner, hands-on, etc.)

### Phase 3: Visualization (Week 5-6)

1. Godot visualization of memory consolidation
2. Personality trait visualization as 3D avatar behavior
3. Learning progress as skill tree
4. Decision routing visualization

---

## Code Snippets for Implementation

### TypeScript Port of Memory System

```typescript
// memory/HierarchicalMemory.ts
export enum MemoryType {
  WORKING = "working",
  MID_TERM = "mid_term",
  LONG_TERM = "long_term",
  EPISODIC = "episodic",
  SEMANTIC = "semantic",
  PROCEDURAL = "procedural"
}

export interface Memory {
  id: string;
  content: string;
  memoryType: MemoryType;
  timestamp: Date;
  importance: number; // 1-10
  emotionalValence: number; // -1 to 1
  accessCount: number;
  lastAccessed?: Date;
}

export class HierarchicalMemory {
  private memories: Map<string, Memory> = new Map();

  store(
    content: string,
    memoryType: MemoryType = MemoryType.EPISODIC,
    importance: number = 5.0
  ): Memory {
    const memory: Memory = {
      id: this.generateId(content),
      content,
      memoryType,
      timestamp: new Date(),
      importance,
      emotionalValence: 0,
      accessCount: 0
    };

    this.memories.set(memory.id, memory);
    return memory;
  }

  retrieve(query: string, topK: number = 10): Memory[] {
    const results = Array.from(this.memories.values())
      .map(memory => ({
        memory,
        score: this.calculateScore(query, memory)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(result => {
        // Boost on access
        result.memory.accessCount++;
        result.memory.lastAccessed = new Date();
        result.memory.importance = Math.min(
          result.memory.importance * 1.05,
          10
        );
        return result.memory;
      });

    return results;
  }

  private calculateScore(query: string, memory: Memory): number {
    // Recency score (exponential decay)
    const hoursAgo = (Date.now() - memory.timestamp.getTime()) / 3600000;
    const recencyScore = Math.pow(0.995, hoursAgo);

    // Importance score
    const importanceScore = memory.importance / 10;

    // Relevance score (word overlap)
    const relevanceScore = this.calculateRelevance(query, memory.content);

    // Combined score (equal weights)
    return (recencyScore + importanceScore + relevanceScore) / 3;
  }

  private calculateRelevance(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;

    return union > 0 ? intersection / union : 0;
  }
}
```

### StudyAgent Implementation

```typescript
// agent/StudyAgent.ts
import { HierarchicalMemory, MemoryType } from '../memory/HierarchicalMemory';
import { Personality } from '../personality/Personality';
import { DecisionEngine, DecisionTier } from '../decision/DecisionEngine';

export interface StudyAgentConfig {
  name: string;
  subject: string;
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
  traits: Record<string, number>;
  goals: string[];
}

export class StudyAgent {
  public readonly name: string;
  public readonly subject: string;
  public readonly memory: HierarchicalMemory;
  public readonly personality: Personality;
  public readonly decisionEngine: DecisionEngine;

  private interactionCount = 0;
  private createdAt = new Date();

  constructor(config: StudyAgentConfig) {
    this.name = config.name;
    this.subject = config.subject;

    this.memory = new HierarchicalMemory(this.name);
    this.personality = new Personality(config.traits, {
      learningStyle: config.learningStyle,
      subject: config.subject
    });
    this.decisionEngine = new DecisionEngine();

    // Store goals as semantic memories
    config.goals.forEach(goal => {
      this.memory.store_semantic(
        `My learning goal: ${goal}`,
        8.0
      );
    });
  }

  /**
   * Explore a new topic - main learning interaction
   */
  async explore(topic: string): Promise<LearningResponse> {
    this.interactionCount++;

    // Get relevant prior knowledge
    priorKnowledge = this.memory.retrieve(topic, topK: 3);

    // Build context
    const context = this.buildContext(priorKnowledge);

    // Route decision (BOT/BRAIN/HUMAN)
    const decision = this.decisionEngine.route({
      characterId: this.name,
      situationType: 'learning',
      situationDescription: topic,
      stakes: this.calculateStakes(topic),
    });

    // Generate response based on tier
    let response: LearningResponse;
    if (decision.tier === DecisionTier.BOT) {
      response = await this.generateBotResponse(topic, context);
    } else if (decision.tier === DecisionTier.BRAIN) {
      response = await this.generateBrainResponse(topic, context);
    } else {
      response = await this.generateHumanResponse(topic, context);
    }

    // Store in working memory
    this.memory.store_working(
      `Explored: ${topic}`,
      importance: 5.0
    );

    return response;
  }

  /**
   * Practice a skill - reinforcement learning
   */
  async practice(skill: string): Promise<PracticeResult> {
    const priorAttempts = this.memory.retrieve(skill, topK: 5);
    const masteryLevel = this.calculateMastery(skill, priorAttempts);

    return {
      skill,
      masteryLevel,
      recommendedExercises: this.getExercises(skill, masteryLevel),
      hints: this.generateHints(skill, masteryLevel)
    };
  }

  /**
   * Reflect on learning - consolidate to semantic memory
   */
  reflect(experience: string): Memory {
    return this.memory.store_semantic(
      `I learned: ${experience}`,
      importance: 7.0
    );
  }

  /**
   * Master a skill - check and update procedural memory
   */
  master(skill: string): MasteryLevel {
    const proceduralMemories = this.memory.getMemoriesByType(
      MemoryType.PROCEDURAL
    );
    const skillMemory = proceduralMemories.find(
      m => m.content.includes(skill)
    );

    if (skillMemory && skillMemory.importance >= 8.0) {
      return MasteryLevel.MASTERED;
    } else if (skillMemory && skillMemory.importance >= 5.0) {
      return MasteryLevel.PROFICIENT;
    } else {
      return MasteryLevel.LEARNING;
    }
  }

  private buildContext(memories: Memory[]): string {
    const parts = [
      `I am ${this.name}, studying ${this.subject}.`,
      `My learning style: ${this.personality.get('learningStyle')}.`
    ];

    if (memories.length > 0) {
      parts.push('\nPrior knowledge:');
      memories.forEach(m => {
        parts.push(`  - ${m.content.substring(0, 80)}`);
      });
    }

    return parts.join('\n');
  }

  private calculateStakes(topic: string): number {
    // High stakes for foundational concepts
    const foundational = [
      'basics', 'fundamentals', 'introduction', 'getting started'
    ];
    const isFoundational = foundational.some(f =>
      topic.toLowerCase().includes(f)
    );
    return isFoundational ? 0.8 : 0.5;
  }

  // Response generation methods...
}

export enum MasteryLevel {
  UNKNOWN = 'unknown',
  LEARNING = 'learning',
  PROFICIENT = 'proficient',
  MASTERED = 'mastered'
}

export interface LearningResponse {
  content: string;
  visualizations?: Visualization[];
  exercises?: Exercise[];
  tier: DecisionTier;
  confidence: number;
}

export interface PracticeResult {
  skill: string;
  masteryLevel: MasteryLevel;
  recommendedExercises: Exercise[];
  hints: string[];
}
```

---

## Appendix: Full SDK Reference

### Character Class

```python
class Character:
    """Main character class"""

    # Creation
    def __init__(name, character_class, personality, backstory, goals, ...)

    # Cognition
    def think(situation, stakes, urgency_ms) -> CharacterResponse

    # Memory
    def remember(content, importance, emotional_valence, memory_type) -> Memory
    def recall(query, top_k) -> List[Memory]
    def forget(memory_id) -> bool
    def get_recent_memories(hours, top_k) -> List[Memory]
    def get_important_memories(threshold, top_k) -> List[Memory]

    # Learning
    def learn(outcome, success, reward, notes) -> LearningSignal
    def get_learning_summary() -> Dict

    # Personality
    def set_trait(trait, value)
    def get_trait(trait, default) -> float
    def modify_trait(trait, delta)
    def get_personality_summary() -> Dict

    # Persistence
    def save(path)
    def load(path)
    def get_stats() -> Dict
```

### Memory System

```python
class HierarchicalMemory:
    """6-tier hierarchical memory"""

    # Storage
    def store(content, memory_type, importance, emotional_valence) -> Memory
    def store_working(content, **kwargs) -> Memory
    def store_mid_term(content, **kwargs) -> Memory
    def store_episodic(content, **kwargs) -> Memory
    def store_semantic(content, **kwargs) -> Memory
    def store_procedural(content, **kwargs) -> Memory

    # Retrieval
    def retrieve(query, top_k, memory_type, alpha_recency, alpha_importance, alpha_relevance) -> List[Memory]
    def get_by_id(memory_id) -> Memory
    def get_memories_by_type(memory_type) -> List[Memory]
    def get_recent(hours, top_k) -> List[Memory]
    def get_important(threshold, top_k) -> List[Memory]

    # Relationships
    def relate_memories(memory_id_1, memory_id_2)
    def get_related_memories(memory_id) -> List[Memory]

    # Persistence
    def save()
    def load()
    def export() -> Dict
    def get_stats() -> Dict
```

### Decision Engine

```python
class DecisionEngine:
    """Intelligent decision routing"""

    def route(context: DecisionContext) -> DecisionRouting
    def set_thresholds(character_id, thresholds: EscalationThresholds)
    def get_thresholds(character_id) -> EscalationThresholds
    def record_decision(result: DecisionResult)
    def get_character_stats(character_id) -> Dict
    def get_global_stats() -> Dict
```

### Personality System

```python
class Personality:
    """Trait-based personality system"""

    def __init__(traits, profile)
    def set_trait(trait, value)
    def get_trait(trait, default) -> float
    def modify_trait(trait, delta)
    def has_trait(trait) -> bool
    def get_dominant_trait(min_value) -> Optional[tuple]
    def get_traits_by_category(category) -> Dict
    def get_summary() -> Dict
    def apply_to_response(response)
    def to_dict() -> Dict
    @classmethod from_dict(data) -> Personality
```

### Outcome Tracker

```python
class OutcomeTracker:
    """Learning from outcomes"""

    def record(outcome, success, reward, outcome_type, notes, situation, action_taken) -> LearningSignal
    def get_summary() -> Dict
    def get_recent_outcomes(count) -> List[Outcome]
    def get_pending_adjustments() -> List[LearningSignal]
    def clear_adjustments()
    def should_adjust_trait(trait) -> Optional[float]
    def to_dict() -> Dict
    def from_dict(data)
```

---

## Conclusion

The AI Character SDK provides a solid foundation for building AI agents with memory, personality, and learning capabilities. Its clean abstractions and modular design make it an excellent reference for StudyLoG.AI's agent system.

**Key Takeaways:**

1. **Cognitive metaphors** make APIs intuitive (`think`, `remember`, `learn`)
2. **Tiered systems** (memory, decisions) provide both structure and flexibility
3. **Factory patterns** offer convenience while maintaining power
4. **Serializable state** enables persistence and debugging
5. **Personality-driven behavior** creates engaging characters without complex prompting

**For StudyLoG.AI:** Adopt the core abstractions but adapt them for educational use cases. Map memory tiers to learning progress, decision routing to tutoring responses, and personality traits to learning styles.

---

**End of Research Notes**
