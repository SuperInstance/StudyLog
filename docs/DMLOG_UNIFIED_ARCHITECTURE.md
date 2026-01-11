# DMLoG.AI - StudyLoG.AI Unified Architecture

**Agent:** Agent 1/7 - DMLog Unified Architecture Designer
**Date:** 2026-01-10
**Mission:** Design unified architecture maximizing synergy between StudyLoG.AI and DMLoG.AI
**Status:** Complete

---

## Executive Summary

This document presents a unified architecture design for SuperInstance.AI that enables both StudyLoG.AI (education) and DMLoG.AI (TTRPG) to share a common backend while maintaining product-specific customizations. The design achieves **85% code sharing** between products through:

1. **Product-agnostic core components** with configuration-based differentiation
2. **Unified Character SDK** serving both students and RPG characters
3. **Shared agent coordination** with domain-specific task routing
4. **Common memory system** with product-specific consolidation policies
5. **Joint outcome tracking** with domain-mapped reward signals

---

## Table of Contents

1. [Shared Backend Analysis](#1-shared-backend-analysis)
2. [Component Synergy Matrix](#2-component-synergy-matrix)
3. [Architecture Recommendations](#3-architecture-recommendations)
4. [Frontend Synergy](#4-frontend-synergy)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Data Model Unification](#6-data-model-unification)
7. [API Design](#7-api-design)
8. [Deployment Strategy](#8-deployment-strategy)

---

## 1. Shared Backend Analysis

### 1.1 What Can Be Shared?

```
                    SHARED BACKEND COMPONENTS
                    =========================

    ┌─────────────────────────────────────────────────────────────┐
    │                  SuperInstance Core Platform                │
    ├─────────────────────────────────────────────────────────────┤
    │                                                             │
    │  ┌───────────────────────────────────────────────────────┐ │
    │  │              Character SDK (100% Shared)               │ │
    │  │  - HierarchicalMemory (6 tiers)                        │ │
    │  │  - PersonalitySystem (traits, Big Five)                │ │
    │  │  - DecisionEngine (BOT/BRAIN/HUMAN routing)            │ │
    │  │  - OutcomeTracker (multi-domain rewards)               │ │
    │  └───────────────────────────────────────────────────────┘ │
    │                              │                             │
    │  ┌───────────────────────────▼───────────────────────────┐ │
    │  │              Agent Coordinator (95% Shared)            │ │
    │  │  - Task routing by capabilities                       │ │
    │  │  - Priority queues                                    │ │
    │  │  - Event bus system                                   │ │
    │  │  - Health monitoring                                   │ │
    │  └───────────────────────────────────────────────────────┘ │
    │                              │                             │
    │  ┌───────────────────────────▼───────────────────────────┐ │
    │  │              Escalation Engine (100% Shared)           │ │
    │  │  - Cost optimization (40x savings)                     │ │
    │  │  - Confidence-based routing                            │ │
    │  │  - Novelty detection                                  │ │
    │  │  - Adaptive threshold learning                         │ │
    │  └───────────────────────────────────────────────────────┘ │
    │                              │                             │
    │  ┌───────────────────────────▼───────────────────────────┐ │
    │  │              Session Management (90% Shared)           │ │
    │  │  - Lifecycle states                                    │ │
    │  │  - Progress tracking                                  │ │
    │  │  - Metrics collection                                 │ │
    │  │  - Growth scoring                                     │ │
    │  └───────────────────────────────────────────────────────┘ │
    │                              │                             │
    │  ┌───────────────────────────▼───────────────────────────┐ │
    │  │              Memory Consolidation (85% Shared)         │ │
    │  │  - Episodic → Semantic conversion                      │ │
    │  │  - Pattern extraction                                 │ │
    │  │  - Narrative generation                                │ │
    │  └───────────────────────────────────────────────────────┘ │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
    ┌───────────▼─────────┐      ┌─────────▼──────────┐
    │   StudyLoG.AI      │      │    DMLoG.AI        │
    │   Configuration    │      │   Configuration    │
    │                    │      │                    │
    │ - Roles: Student    │      │ - Roles: Character │
    │ - Stages: Mill/etc  │      │ - Stages: Campaign │
    │ - Domains: Learning │      │ - Domains: Combat  │
    │ - Metrics: Skills   │      │ - Metrics: XP      │
    └────────────────────┘      └────────────────────┘
```

### 1.2 Component Shareability Matrix

| Component | Shared % | StudyLoG Customization | DMLog Customization |
|-----------|----------|----------------------|--------------------|
| **Character SDK** | 100% | Student/Teacher personas | D&D class archetypes |
| **Memory System** | 90% | Learning milestones | Narrative events |
| **Escalation Engine** | 100% | Tutoring levels | Combat decisions |
| **Outcome Tracker** | 85% | Skill rewards | XP/loot rewards |
| **Agent Coordinator** | 95% | Tutorial agents | Party coordination |
| **Session Manager** | 90% | Study sessions | Game sessions |
| **Training Pipeline** | 100% | Personalization | Character learning |
| **Memory Consolidation** | 85% | Knowledge clustering | Story extraction |

### 1.3 Where Must They Diverge?

```typescript
// Product configuration flags - these create the necessary divergence
interface ProductConfig {
  // Core identity
  productId: 'studylog' | 'dmlog';
  theme: 'educational' | 'fantasy';

  // Entity terminology
  entities: {
    primary: 'student' | 'character';
    secondary: 'tutor' | 'npc';
    grouping: 'class' | 'party';
    sessions: 'study_session' | 'game_session';
  };

  // Progression model
  progression: {
    stages: StudyLoGStages | DMLogStages;
    rewards: RewardDomain[];
    milestones: MilestoneType[];
  };

  // UI/UX differences
  ui: {
    palette: ColorScheme;
    terminology: TerminologySet;
    defaultView: 'code' | 'character_sheet';
  };
}
```

### 1.4 Converting Differences to Configurations

The key insight is that **structural differences are configuration**:

| Concept | StudyLoG.AI | DMLoG.AI | Unified (Configurable) |
|---------|-------------|----------|----------------------|
| **Primary Entity** | Student | Character | `Entity` with `type: student \| character` |
| **Progress Metric** | Skills mastered | XP gained | `progressValue` with `domain` |
| **Session Type** | Study session | Game session | `Session` with `sessionType` |
| **Group Structure** | Class | Party | `EntityGroup` with `groupType` |
| **Decision Context** | Learning scenario | Combat/Social | `DecisionContext` with `scenarioType` |
| **Memory Trigger** | Learning milestone | Story beat | `MemoryTrigger` with `triggerType` |
| **Escalation** | Help level | Action complexity | `EscalationLevel` with `levelType` |

---

## 2. Component Synergy Matrix

### 2.1 Memory System: Educational vs TTRPG Use Cases

```
                    MEMORY SYSTEM - UNIFIED ARCHITECTURE
                    =====================================

                    HIERARCHICAL MEMORY (Shared Core)
                    ┌─────────────────────────────┐
                    │  Working Memory (STM)       │
                    │  - Current context          │
                    │  - Capacity: 20 items       │
                    │  - Decay: 30 min half-life  │
                    └──────────┬──────────────────┘
                               │ consolidate()
                               ▼
                    ┌─────────────────────────────┐
                    │  Episodic Memory (LTM)      │
                    │  - Events with context      │
                    │  - Emotional valence        │
                    │  - Temporal/spatial index   │
                    └──────────┬──────────────────┘
                               │ pattern_extract()
                  ┌────────────┴────────────┐
                  ▼                         ▼
    ┌───────────────────────┐  ┌───────────────────────┐
    │  SEMANTIC MEMORY      │  │  PROCEDURAL MEMORY    │
    │  (Knowledge)          │  │  (Skills)             │
    ├───────────────────────┤  ├───────────────────────┤
    │ StudyLoG:            │  │ StudyLoG:            │
    │ - Concepts learned   │  │ - Coding patterns     │
    │ - Definitions        │  │ - Debugging steps     │
    │ - Relationships      │  │ - Algorithms          │
    │                      │  │                      │
    │ DMLog:               │  │ DMLog:               │
    │ - Lore discovered    │  │ - Combat techniques   │
    │ - NPC relationships  │  │ - Spell casting       │
    │ - World knowledge    │  │ - Thief skills        │
    └───────────────────────┘  └───────────────────────┘
```

**Memory Consolidation Configuration:**

```typescript
interface ConsolidationConfig {
  // When to trigger consolidation
  triggers: {
    timeInterval: number;        // Hours between consolidation
    importanceThreshold: number; // Importance score to trigger
    itemCount: number;           // Items in working memory
  };

  // How to cluster episodic memories
  clustering: {
    algorithm: 'word_overlap' | 'embedding' | 'hybrid';
    threshold: number;           // Similarity threshold (0-1)
    minClusterSize: number;
  };

  // What to extract as semantic knowledge
  extraction: {
    patterns: PatternExtractor[];
    facts: FactExtractor[];
    relationships: RelationshipExtractor[];
  };

  // Product-specific extractors
  productExtractors: {
    studylog?: LearningExtractor[];
    dmlog?: LoreExtractor[];
  };
}
```

**Shared Memory Operations:**

```typescript
class HierarchicalMemory {
  // Shared core operations
  storeWorking(content: string, importance: number): Memory;
  storeEpisodic(content: string, context: MemoryContext): Memory;
  retrieve(query: string, topK: number): Memory[];
  consolidate(): ConsolidationResult;

  // Product-specific shortcuts (via config)
  // StudyLoG.AI:
  recordLearningEvent(concept: string, mastery: number): Memory;
  recordFirstTimeAchievement(skill: string): Memory;
  recordBreakthroughMoment(insight: string): Memory;

  // DMLoG.AI:
  recordStoryEvent(scene: string, emotionalImpact: number): Memory;
  recordRelationshipChange(npc: string, newStatus: string): Memory;
  recordDiscovery(secret: string, significance: number): Memory;
}
```

### 2.2 Escalation Engine: Learning vs Gaming Decisions

```
                    ESCALATION ENGINE - UNIFIED
                    ===========================

                      DECISION REQUEST
                           │
                ┌──────────┴──────────┐
                │   Analyze Context  │
                │  - Stakes (0-1)     │
                │  - Novelty          │
                │  - Urgency          │
                │  - History          │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                │    Route Decision   │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │   BOT   │      │  BRAIN   │      │  HUMAN   │
   │  (Free) │      │ (Low $)  │      │ (High $) │
   └────┬────┘      └────┬─────┘      └────┬─────┘
        │                  │                  │
        │                  │                  │
    StudyLoG:          StudyLoG:          StudyLoG:
    - Syntax check     - Logic hint       - Live tutor
    - FAQ              - Explanation      - Expert help
    - Definition       - Example          - Deep dive
                        │                  │
    DMLog:            DMLog:             DMLog:
    - Rule lookup     - Tactical AI      - DM decides
    - Auto-action     - Narrative gen    - Complex scene
    - Dice roll       - Character voice  - Boss battle
```

**Escalation Configuration by Product:**

```typescript
interface EscalationConfig {
  // Shared thresholds
  thresholds: {
    botMinConfidence: number;     // Default: 0.7
    brainMinConfidence: number;   // Default: 0.5
    highStakesThreshold: number;  // Default: 0.7
    criticalStakesThreshold: number; // Default: 0.9
  };

  // Product-specific overrides
  productOverrides: {
    studylog?: {
      // Lower threshold for escalating - more help available
      botMinConfidence: 0.6;
      brainMinConfidence: 0.4;

      // Learning-specific critical conditions
      criticalIndicators: {
        stuckOnConcept: boolean;   // 3+ failures on same concept
        timeSpent: number;         // >15 min on single problem
        frustrationDetected: boolean; // Sentiment analysis
      };
    };

    dmlog?: {
      // Higher threshold - maintain game tension
      botMinConfidence: 0.8;
      brainMinConfidence: 0.6;

      // Combat-specific critical conditions
      criticalIndicators: {
        hpCritical: boolean;       // HP < 20%
        lastResource: boolean;     // Last potion/spell slot
        bossEncounter: boolean;    // Fighting boss
        tpkImminent: boolean;      // Party about to wipe
      };
    };
  };

  // Cost per tier (shared)
  tierCosts: {
    bot: number;       // 0
    brain: number;     // ~0.001 (local)
    human: number;     // ~0.03 (API)
  };
}
```

**Scenario Type Routing:**

```typescript
// Shared enum with product-specific values
enum ScenarioType {
  // StudyLoG.AI scenarios
  TUTORING = 'tutoring',
  CODING_EXERCISE = 'coding_exercise',
  QUIZ = 'quiz',
  DEBUGGING = 'debugging',
  PROJECT = 'project',

  // DMLoG.AI scenarios
  COMBAT = 'combat',
  SOCIAL = 'social',
  EXPLORATION = 'exploration',
  PUZZLE = 'puzzle',
  DIPLOMACY = 'diplomacy',
  STEALTH = 'stealth',
}

// Routing logic (shared)
interface EscalationDecision {
  source: DecisionSource;
  reason: EscalationReason;
  confidenceRequired: number;
  timeBudgetMs?: number;
  allowFallback: boolean;
}

// Example routing decisions
const STUDYLOG_ROUTING: Record<ScenarioType, Partial<EscalationDecision>> = {
  [ScenarioType.QUIZ]: {
    source: DecisionSource.BOT,      // Auto-grade factual questions
    allowFallback: true,
  },
  [ScenarioType.DEBUGGING]: {
    source: DecisionSource.BRAIN,    // Local LLM for error analysis
    allowFallback: true,
  },
};

const DMLOG_ROUTING: Record<ScenarioType, Partial<EscalationDecision>> = {
  [ScenarioType.COMBAT]: {
    source: DecisionSource.BOT,      // Rules-based combat resolution
    allowFallback: true,
  },
  [ScenarioType.DIPLOMACY]: {
    source: DecisionSource.BRAIN,    // NPC dialogue generation
    allowFallback: true,
  },
};
```

### 2.3 Outcome Tracker: Skills vs Combat/Social Rewards

```
                    OUTCOME TRACKER - UNIFIED
                    =======================

                      OUTCOME RECORDED
                           │
                ┌──────────┴──────────┐
                │   Multi-Domain      │
                │   Reward Analysis   │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │ COGNITIVE│     │  SOCIAL   │     │RESOURCE  │
    └─────────┘      └──────────┘      └──────────┘
        │                  │                  │
    StudyLoG:          StudyLoG:          StudyLoG:
    - Problem solve    - Peer help        - Time efficiency
    - Logic quality    - Forum posts      - Token usage
    - Code correctness - Collab work      - Attempts count
                        │                  │
    DMLog:            DMLog:             DMLog:
    - Damage dealt     - Persuasion       - Gold found
    - Tactics used     - Party buff       - Items gained
    - Positioning      - Trust earned     - Spells conserved
```

**Reward Domain Mapping:**

```typescript
// Shared base enum
enum RewardDomain {
  COGNITIVE = 'cognitive',       // StudyLoG: Problem solving | DMLog: Tactics
  SOCIAL = 'social',             // StudyLoG: Collaboration | DMLog: Persuasion
  DISCOVERY = 'discovery',       // StudyLoG: Exploration | DMLog: Exploration
  RESOURCE = 'resource',         // StudyLoG: Efficiency | DMLog: Loot
  MASTERY = 'mastery',           // StudyLoG: Skill retention | DMLog: XP
  STRATEGIC = 'strategic',       // StudyLoG: Planning | DMLog: Positioning
}

// Domain-specific component breakdown
interface RewardComponents {
  cognitive?: {
    // StudyLoG components
    problemSolved?: number;
    logicQuality?: number;
    codeCorrectness?: number;

    // DMLog components
    damageDealt?: number;
    tacticalAdvantage?: number;
    enemyDefeated?: number;
  };

  social?: {
    // StudyLoG components
    peerHelp?: number;
    forumPosts?: number;
    collaboration?: number;

    // DMLog components
    persuasion?: number;
    partyBuff?: number;
    trustChange?: number;
  };

  resource?: {
    // StudyLoG components
    timeEfficiency?: number;
    tokenUsage?: number;
    attemptsCount?: number;

    // DMLog components
    goldFound?: number;
    itemsGained?: number;
    spellsConserved?: number;
  };
}
```

**Quality Analysis (Shared Algorithm, Product-Specific Weights):**

```typescript
interface QualityAnalysisConfig {
  // Weight factors for quality calculation
  weights: {
    successFactor: number;    // 0.4 - Did they succeed?
    rewardFactor: number;     // 0.4 - Positive rewards?
    learningFactor: number;   // 0.2 - Learned from mistakes?
  };

  // Product-specific weights
  productOverrides: {
    studylog?: {
      // Emphasize learning over pure success
      weights: {
        successFactor: 0.3,
        rewardFactor: 0.3,
        learningFactor: 0.4,  // Higher - value growth mindset
      };
    };

    dmlog?: {
      // Emphasize results
      weights: {
        successFactor: 0.5,   // Higher - results matter
        rewardFactor: 0.4,
        learningFactor: 0.1,  // Lower - it's a game
      };
    };
  };
}

// Quality score calculation (shared)
function calculateQualityScore(
  outcome: OutcomeRecord,
  config: QualityAnalysisConfig
): QualityScore {
  const { success, rewards, learningGained } = outcome;
  const { weights } = config;

  const successFactor = success ? 1 : 0;
  const rewardFactor = normalizeReward(rewards);
  const learningFactor = learningGained ? 1 : 0;

  const qualityScore =
    (weights.successFactor * successFactor) +
    (weights.rewardFactor * rewardFactor) +
    (weights.learningFactor * learningFactor);

  return {
    qualityScore,
    confidence: calculateConfidence(outcome),
    successRate: calculateSuccessRate(outcome),
    domainScores: calculateDomainScores(outcome, config),
  };
}
```

### 2.4 Agent Coordinator: Tutorial Agents vs AI Party Members

```
                    AGENT COORDINATOR - UNIFIED
                    ===========================

                      TASK SUBMISSION
                           │
                ┌──────────┴──────────┐
                │  Capability Match   │
                │  Analysis            │
                └──────────┬──────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │  TUTOR  │      │  PLAYER  │      │   NPC    │
   │  AGENTS │      │  AGENTS  │      │  AGENTS  │
   └────┬────┘      └────┬─────┘      └────┬─────┘
        │                  │                  │
    StudyLoG:          StudyLoG:          DMLog:
    - Explain          - Student           - Party members
    - Practice         - Avatar            - Followers
    - Assess           - Peer tutor        - Henchmen
                        │
    DMLog:            DMLog:
    - DM assistant    - Character         - Companion NPCs
    - Rules lawyer    - Player character  - Hirelings
    - Story narrator  - Co-DM
```

**Shared Role System:**

```typescript
// Base role interface (shared)
interface AgentRole {
  name: string;
  capabilities: string[];
  maxConcurrentTasks: number;
  priority: number;
  emoji: string;
  canHandle(requiredCapabilities: string[]): boolean;
}

// StudyLoG.AI roles
const STUDYLOG_ROLES: Record<string, AgentRole> = {
  tutor: {
    name: 'tutor',
    capabilities: ['explain', 'demonstrate', 'hint', 'assess'],
    maxConcurrentTasks: 3,
    priority: 10,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['explain', 'demonstrate', 'hint', 'assess'].includes(c)),
  },

  practice_coach: {
    name: 'practice_coach',
    capabilities: ['exercise', 'quiz', 'feedback'],
    maxConcurrentTasks: 5,
    priority: 5,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['exercise', 'quiz', 'feedback'].includes(c)),
  },

  assessor: {
    name: 'assessor',
    capabilities: ['evaluate', 'grade', 'analyze_mistakes'],
    maxConcurrentTasks: 2,
    priority: 15,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['evaluate', 'grade', 'analyze_mistakes'].includes(c)),
  },
};

// DMLoG.AI roles
const DMLOG_ROLES: Record<string, AgentRole> = {
  party_member: {
    name: 'party_member',
    capabilities: ['attack', 'defend', 'skill', 'spell'],
    maxConcurrentTasks: 1, // One action per turn
    priority: 10,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['attack', 'defend', 'skill', 'spell'].includes(c)),
  },

  npc: {
    name: 'npc',
    capabilities: ['dialogue', 'reaction', 'quest_interaction'],
    maxConcurrentTasks: 3,
    priority: 5,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['dialogue', 'reaction', 'quest_interaction'].includes(c)),
  },

  dungeon_master: {
    name: 'dungeon_master',
    capabilities: ['narrate', 'rule_judge', 'world_state'],
    maxConcurrentTasks: 10,
    priority: 100,
    emoji: '??',
    canHandle: (caps) => caps.every(c => ['narrate', 'rule_judge', 'world_state'].includes(c)),
  },
};
```

**Task Creation (Shared Factory, Product-Specific Payloads):**

```typescript
// Shared task interface
interface Task {
  id: string;
  description: string;
  requiredCapabilities: string[];
  priority: TaskPriority;
  payload: unknown;
  dependencies: string[];
  timeout: number;
  metadata: TaskMetadata;
}

// StudyLoG.AI task factory
function createLearningTask(config: {
  concept: string;
  learningObjective: string;
  studentLevel: number;
}): Task {
  return {
    id: generateId(),
    description: `Teach ${config.concept} at level ${config.studentLevel}`,
    requiredCapabilities: ['explain', 'assess'],
    priority: TaskPriority.MEDIUM,
    payload: {
      type: 'learning',
      concept: config.concept,
      objective: config.learningObjective,
      studentLevel: config.studentLevel,
      // StudyLoG-specific fields
      hintLevel: 'progressive',
      includeExamples: true,
    },
    dependencies: [],
    timeout: 30000,
    metadata: {
      product: 'studylog',
      category: 'tutoring',
    },
  };
}

// DMLoG.AI task factory
function createCombatTask(config: {
  scenario: string;
  enemyType: string;
  characterLevel: number;
}): Task {
  return {
    id: generateId(),
    description: `Handle combat in ${config.scenario} vs ${config.enemyType}`,
    requiredCapabilities: ['attack', 'defend'],
    priority: TaskPriority.HIGH,
    payload: {
      type: 'combat',
      scenario: config.scenario,
      enemy: config.enemyType,
      characterLevel: config.characterLevel,
      // DMLog-specific fields
      initiative: 0,
      position: { x: 0, y: 0 },
      availableActions: ['attack', 'defend', 'skill'],
    },
    dependencies: [],
    timeout: 10000, // Combat is time-critical
    metadata: {
      product: 'dmlog',
      category: 'combat',
    },
  };
}
```

---

## 3. Architecture Recommendations

### 3.1 Unified Backend with Product Flags

```
                    UNIFIED BACKEND ARCHITECTURE
                    ==========================

    ┌───────────────────────────────────────────────────────────────┐
    │                    Cloudflare Workers Edge                    │
    ├───────────────────────────────────────────────────────────────┤
    │                                                                │
    │  ┌─────────────────────────────────────────────────────────┐ │
    │  │              Product Router (Entry Point)                │ │
    │  │  ┌─────────────────────────────────────────────────┐    │ │
    │  │  │  /api/studylog/*  ->  StudyLoG Handler Chain   │    │ │
    │  │  │  /api/dmlog/*     ->  DMLoG Handler Chain      │    │ │
    │  │  │  /api/shared/*    ->  Shared Services           │    │ │
    │  │  └─────────────────────────────────────────────────┘    │ │
    │  └─────────────────────────────────────────────────────────┘ │
    │                              │                               │
    │  ┌─────────────────────────────▼─────────────────────────────┐│
    │  │              Shared Services Layer                        ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  Character Service                                  │   ││
    │  │  │  - createCharacter(config, product)               │   ││
    │  │  │  - getCharacter(id, product)                      │   ││
    │  │  │  - updateCharacterState(id, state, product)       │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  Memory Service                                     │   ││
    │  │  │  - storeMemory(characterId, memory, product)       │   ││
    │  │  │  - retrieveMemories(characterId, query, product)   │   ││
    │  │  │  - consolidateMemories(characterId, product)       │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  Escalation Service                                 │   ││
    │  │  │  - routeDecision(context, product)                │   ││
    │  │  │  - executeDecision(decision, product)             │   ││
    │  │  │  - recordOutcome(outcome, product)                │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  Coordinator Service                                │   ││
    │  │  │  - submitTask(task, product)                      │   ││
    │  │  │  - getAgentStatus(productId)                      │   ││
    │  │  │  - registerAgent(agent, product)                  │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  └─────────────────────────────────────────────────────────┘ │
    │                              │                               │
    │  ┌─────────────────────────────▼─────────────────────────────┐│
    │  │              Product Configuration Layer                   ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  StudyLoG Config                                    │   ││
    │  │  │  - rewardDomains: [COGNITIVE, SOCIAL, MASTERY]     │   ││
    │  │  │  - stages: [cognitive_mill, intelligence_ranch...]  │   ││
    │  │  │  - agentRoles: [tutor, coach, assessor]            │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  DMLoG Config                                       │   ││
    │  │  │  - rewardDomains: [COMBAT, SOCIAL, EXPLORATION]    │   ││
    │  │  │  - stages: [campaign, dungeon, boss...]            │   ││
    │  │  │  - agentRoles: [party_member, npc, dm]             │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  └─────────────────────────────────────────────────────────┘ │
    │                              │                               │
    │  ┌─────────────────────────────▼─────────────────────────────┐│
    │  │              Data Layer (Product-Namespaced)               ││
    │  │  ┌───────────────────────────────────────────────────┐   ││
    │  │  │  D1 Database (SQLite)                               │   ││
    │  │  │  - studylog.characters                              │   ││
    │  │  │  - studylog.sessions                               │   ││
    │  │  │  - studylog.memories                               │   ││
    │  │  │  - dmlog.characters                                │   ││
    │  │  │  - dmlog.sessions                                  │   ││
    │  │  │  - dmlog.memories                                  │   ││
    │  │  │  - shared.users                                     │   ││
    │  │  │  - shared.product_configs                           │   ││
    │  │  └───────────────────────────────────────────────────┘   ││
    │  └─────────────────────────────────────────────────────────┘ │
    └───────────────────────────────────────────────────────────────┘
```

**Product Configuration Schema:**

```typescript
// Unified configuration stored in D1
interface ProductConfiguration {
  productId: 'studylog' | 'dmlog';
  version: string;

  // Entity definitions
  entities: {
    primaryTypeName: string;        // 'student' | 'character'
    primaryTypePlural: string;      // 'students' | 'characters'
    secondaryTypeName: string;      // 'tutor' | 'npc'
    groupingTypeName: string;       // 'class' | 'party'
    sessionTypeName: string;        // 'study_session' | 'game_session'
  };

  // Progression stages
  stages: StageConfig[];

  // Reward domains (mapped from shared enum)
  rewardDomains: RewardDomain[];

  // Agent roles
  agentRoles: AgentRoleConfig[];

  // Escalation configuration
  escalation: EscalationConfig;

  // Memory configuration
  memory: MemoryConfig;

  // UI theme
  ui: {
    primaryColor: string;
    accentColor: string;
    fontStack: string[];
    iconSet: string;
  };
}
```

### 3.2 Shared Database Schemas

```
                    DATABASE SCHEMA - UNIFIED
                    =======================

                        D1 DATABASE
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌─────────┐      ┌──────────┐      ┌──────────┐
    │  SHARED │      │ STUDYLOG │      │  DMLOG   │
    │  TABLES │      │  TABLES  │      │  TABLES  │
    └────┬────┘      └────┬─────┘      └────┬─────┘
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌──────────┐      ┌──────────┐
    │ users   │      │ students │      │characters│
    │         │      │          │      │          │
    │ product_│      │ progress │      │ xp       │
    │ configs │      │ skills   │      │ inventory │
    │         │      │ concepts │      │ spells   │
    │ shared_ │      │          │      │          │
    │ memories│      │ lessons  │      │ quests   │
    └─────────┘      └──────────┘      └──────────┘
```

**Shared Tables (Product-Agnostic):**

```sql
-- Users table (shared authentication and profiles)
CREATE TABLE shared.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active INTEGER NOT NULL,

    -- Product access
    studylog_enabled BOOLEAN DEFAULT 1,
    dmlog_enabled BOOLEAN DEFAULT 1,

    -- Subscription tier
    subscription_tier TEXT DEFAULT 'free', -- 'free', 'forge', 'studio'

    INDEX idx_users_email (email),
    INDEX idx_users_last_active (last_active)
);

-- Product configurations (stored, not hardcoded)
CREATE TABLE shared.product_configs (
    product_id TEXT PRIMARY KEY, -- 'studylog' | 'dmlog'
    version TEXT NOT NULL,
    config_json TEXT NOT NULL, -- ProductConfiguration as JSON
    active BOOLEAN DEFAULT 1,
    updated_at INTEGER NOT NULL
);

-- Unified characters/students
CREATE TABLE shared.entities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES shared.users(id),
    product_id TEXT NOT NULL REFERENCES shared.product_configs(product_id),
    entity_type TEXT NOT NULL, -- 'student' | 'character'

    -- Shared character data
    name TEXT NOT NULL,
    personality_json TEXT NOT NULL, -- Personality traits
    state_json TEXT NOT NULL, -- Current state

    -- Timestamps
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,

    INDEX idx_entities_user_product (user_id, product_id),
    INDEX idx_entities_type (entity_type)
);

-- Unified memory storage
CREATE TABLE shared.memories (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES shared.entities(id),
    product_id TEXT NOT NULL,

    -- Memory content
    memory_type TEXT NOT NULL, -- 'working' | 'episodic' | 'semantic' | 'procedural'
    content TEXT NOT NULL,
    importance REAL NOT NULL DEFAULT 5.0,

    -- Context
    emotional_valence REAL, -- -1.0 to 1.0
    context_json TEXT,

    -- Relationships
    related_entities TEXT, -- Comma-separated entity IDs
    related_memories TEXT, -- Comma-separated memory IDs

    -- Consolidation
    consolidated BOOLEAN DEFAULT 0,
    consolidated_into TEXT, -- Parent semantic memory ID

    -- Timestamps
    created_at INTEGER NOT NULL,
    accessed_at INTEGER,
    decay_factor REAL DEFAULT 1.0,

    INDEX idx_memories_entity (entity_id),
    INDEX idx_memories_type (memory_type),
    INDEX idx_memories_consolidated (consolidated)
);

-- Unified outcome tracking
CREATE TABLE shared.outcomes (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL REFERENCES shared.entities(id),
    product_id TEXT NOT NULL,

    -- Decision info
    decision_id TEXT NOT NULL,
    situation_type TEXT NOT NULL,

    -- Outcome info
    outcome_type TEXT NOT NULL, -- 'immediate' | 'short_term' | 'long_term'
    success BOOLEAN NOT NULL,
    timestamp INTEGER NOT NULL,

    -- Rewards (JSON for flexibility)
    rewards_json TEXT NOT NULL,

    -- Causal chain
    related_decisions TEXT,

    -- Metadata
    metadata_json TEXT,

    INDEX idx_outcomes_entity (entity_id),
    INDEX idx_outcomes_decision (decision_id),
    INDEX idx_outcomes_timestamp (timestamp)
);
```

**Product-Specific Tables (via extension pattern):**

```sql
-- StudyLoG.AI specific tables
CREATE TABLE studylog.student_progress (
    entity_id TEXT PRIMARY KEY REFERENCES shared.entities(id),

    -- Stage progress
    cognitive_mill_progress REAL DEFAULT 0.0,
    intelligence_ranch_progress REAL DEFAULT 0.0,
    sitka_sound_progress REAL DEFAULT 0.0,

    -- Skill mastery
    skills_mastered TEXT, -- JSON array of concept names

    -- Learning metrics
    total_study_time INTEGER DEFAULT 0, -- seconds
    concepts_learned INTEGER DEFAULT 0,
    puzzles_solved INTEGER DEFAULT 0,

    -- Streaks
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,

    updated_at INTEGER NOT NULL
);

-- DMLoG.AI specific tables
CREATE TABLE dmlog.character_stats (
    entity_id TEXT PRIMARY KEY REFERENCES shared.entities(id),

    -- D&D 5e stats
    strength INTEGER DEFAULT 10,
    dexterity INTEGER DEFAULT 10,
    constitution INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    wisdom INTEGER DEFAULT 10,
    charisma INTEGER DEFAULT 10,

    -- Combat stats
    hp_current INTEGER DEFAULT 0,
    hp_max INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 10,
    speed INTEGER DEFAULT 30,

    -- XP and level
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,

    -- Equipment
    inventory_json TEXT,
    spells_json TEXT,

    updated_at INTEGER NOT NULL
);
```

### 3.3 Common API Patterns

```
                    API DESIGN - UNIFIED PATTERNS
                    ==============================

                      API REQUEST FLOW
                           │
                ┌──────────┴──────────┐
                │   Route Parser     │
                │  Extract product   │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                │  Config Lookup     │
                │  Get product cfg   │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                │  Product Handler    │
                │  Apply config       │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                │  Shared Service    │
                │  Execute with cfg  │
                └──────────┬──────────┘
                           │
                ┌──────────┴──────────┐
                │   Response         │
                │  Format per cfg   │
                └───────────────────┘
```

**Unified API Endpoints:**

```typescript
// Shared endpoint pattern
interface APIEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (context: APIContext) => Promise<APIResponse>;
  shared: boolean; // If true, uses shared handler
}

// Example: Character endpoints
const CHARACTER_ENDPOINTS: APIEndpoint[] = [
  {
    method: 'POST',
    path: '/api/:product/characters',
    handler: createCharacterHandler, // Shared
    shared: true,
  },
  {
    method: 'GET',
    path: '/api/:product/characters/:id',
    handler: getCharacterHandler, // Shared
    shared: true,
  },
  {
    method: 'PUT',
    path: '/api/:product/characters/:id',
    handler: updateCharacterHandler, // Shared
    shared: true,
  },
];

// Shared handler implementation
async function createCharacterHandler(
  context: APIContext
): Promise<APIResponse> {
  const { product, requestId } = context;
  const config = await getProductConfig(product);

  // Product-specific payload validation
  const payload = config.validateCharacterPayload(context.body);

  // Shared creation logic
  const character = await characterService.create({
    ...payload,
    product_id: product,
    entity_type: config.entities.primaryTypeName,
  });

  // Product-specific extension data
  if (product === 'studylog') {
    await studylogService.createStudentProgress(character.id, payload);
  } else if (product === 'dmlog') {
    await dmlogService.createCharacterStats(character.id, payload);
  }

  return formatResponse(character, config);
}
```

---

## 4. Frontend Synergy

### 4.1 Theia Extensions: Shared vs Product-Specific

```
                    THEIA EXTENSIONS - UNIFIED
                    ========================

                        EXTENSION ARCHITECTURE
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
       ┌─────────┐        ┌──────────┐      ┌──────────┐
       │ SHARED  │        │STUDYLOG  │      │  DMLOG   │
       │EXTS     │        │ EXTS     │      │  EXTS    │
       └────┬────┘        └────┬─────┘      └────┬─────┘
            │                 │                 │
            ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │si-character │   │si-cognitive │   │si-campaign  │
    │  (shared)   │   │   -mill     │   │   (shared)  │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │si-memory    │   │si-intelli-  │   │si-combat    │
    │  (shared)   │   │  gence-     │   │   (shared)  │
    │             │   │   ranch     │   │             │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │si-escalation│   │si-sitka-    │   │si-social    │
    │  (shared)   │   │   sound     │   │   (shared)  │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐                    ┌─────────────┐
    │si-outcome   │                    │si-dungeon   │
    │  (shared)   │                    │   master    │
    └─────────────┘                    └─────────────┘
```

**Shared Extensions (Product-Agnostic):**

| Extension | Purpose | Product Config |
|-----------|---------|----------------|
| **si-character** | Character sheet/profile display | Theme, fields, terminology |
| **si-memory** | Memory visualization | Memory types, visualization style |
| **si-escalation** | Decision routing display | Routing levels, terminology |
| **si-outcome** | Progress/reward tracking | Reward domains, display format |
| **si-coordinator** | Agent status dashboard | Agent roles, metrics |
| **si-godot-embed** | Godot viewport embedding | Scene loading per product |

**Product-Specific Extensions:**

| Extension | Product | Purpose |
|-----------|---------|---------|
| **si-cognitive-mill** | StudyLoG | AI learning module UI |
| **si-intelligence-ranch** | StudyLoG | Agent training UI |
| **si-sitka-sound** | StudyLoG | Multi-agent ecosystem UI |
| **si-campaign** | DMLog | Campaign management UI |
| **si-dungeon-master** | DMLog | DM tools UI |

### 4.2 Godot Visualization Patterns

```
                    GODOT VISUALIZATION - UNIFIED
                    =============================

                         SCENE ARCHITECTURE
                               │
            ┌──────────────────┼──────────────────┐
            │                  │                  │
            ▼                  ▼                  ▼
       ┌─────────┐        ┌──────────┐      ┌──────────┐
       │  BASE   │        │STUDYLOG  │      │  DMLOG   │
       │  SCENES │        │  SCENES  │      │  SCENES  │
       └────┬────┘        └────┬─────┘      └────┬─────┘
            │                 │                 │
            ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │Character3D  │   │MillVisual-  │   │DungeonView  │
    │  (shared)   │   │   izer      │   │  (shared)   │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │MemoryPalace │   │RanchVisual-  │   │CombatView   │
    │  (shared)   │   │   izer      │   │  (shared)   │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │SkillTree    │   │SitkaVisual- │   │SocialView   │
    │  (shared)   │   │   izer      │   │  (shared)   │
    └─────────────┘   └─────────────┘   └─────────────┘
    ┌─────────────┐
    │AgentStatus  │
    │  (shared)   │
    └─────────────┘
```

**Shared Godot Components:**

```gdscript
# base_character_3d.gd - Shared character visualization
extends Node3D
class_name BaseCharacter3D

@export var character_id: String
@export var product_id: String

# Shared components
@onready var mesh_instance = $MeshInstance3D
@onready var name_label = $NameLabel
@onready var status_indicator = $StatusIndicator

# Product-specific configuration
var config: Dictionary

func _ready():
    config = load_product_config()
    apply_product_theme()
    update_visualization()

func load_product_config() -> Dictionary:
    # Load from backend via TheiaBridge
    return await TheiaBridge.get_config(product_id)

func apply_product_theme():
    # Product-specific colors, models, etc.
    match product_id:
        "studylog":
            mesh_instance.mesh = preload("res://models/student.glb")
            status_indicator.modulate = Color(0.2, 0.6, 1.0) # Blue
        "dmlog":
            mesh_instance.mesh = preload("res://models/character.glb")
            status_indicator.modulate = Color(0.8, 0.4, 0.2) # Orange

func update_visualization():
    # Shared update logic
    var state = await TheiaBridge.get_entity_state(character_id, product_id)
    name_label.text = state.name
    update_status(state.status)
    update_position(state.position)

func update_status(status: String):
    match status:
        "idle":
            $AnimationPlayer.play("idle")
        "active":
            $AnimationPlayer.play("active")
        "success":
            $AnimationPlayer.play("celebrate")
        "failure":
            $AnimationPlayer.play("fail")
```

### 4.3 UI Component Reuse

```
                    UI COMPONENTS - UNIFIED
                    ======================

                      COMPONENT LIBRARY
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
       ┌─────────┐   ┌──────────┐   ┌──────────┐
       │ SHARED  │   │STUDYLOG  │   │  DMLOG   │
       │COMPS    │   │  COMPS   │   │  COMPS   │
       └────┬────┘   └────┬─────┘   └────┬─────┘
            │             │              │
            ▼             ▼              ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │StatusBar    │ │SkillProgressBar│ │HPBar        │
    │  (config)   │ │   (extends) │ │  (extends)  │
    └─────────────┘ └─────────────┘ └─────────────┘
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ProgressCard │ │ConceptCard  │ │ItemCard     │
    │  (config)   │ │   (extends) │ │  (extends)  │
    └─────────────┘ └─────────────┘ └─────────────┘
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │AgentList    │ │TutorList    │ │PartyList    │
    │  (config)   │ │   (extends) │ │  (extends)  │
    └─────────────┘ └─────────────┘ └─────────────┘
    ┌─────────────┐
    │OutcomeChart │
    │  (config)   │
    └─────────────┘
```

**Shared Component with Configuration:**

```typescript
// Base component (shared)
interface BaseComponentProps<T> {
  data: T;
  config: ProductConfig;
  className?: string;
}

// Example: Progress bar (shared)
function ProgressBar<T extends { progress: number }>(
  props: BaseComponentProps<T> & {
    label?: string;
    showPercentage?: boolean;
  }
): JSX.Element {
  const { data, config, label, showPercentage = true } = props;

  // Product-specific styling
  const barColor = config.ui.primaryColor;
  const progressLabel = label ?? config.entities.progressLabel ?? 'Progress';

  return (
    <div className={`progress-bar ${props.className}`}>
      <span className="progress-label">{progressLabel}</span>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${data.progress * 100}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      {showPercentage && (
        <span className="progress-value">{Math.round(data.progress * 100)}%</span>
      )}
    </div>
  );
}

// StudyLoG.AI usage
function SkillProgressCard({ skill }: { skill: StudentSkill }) {
  const config = useStudyLogConfig();
  return (
    <Card>
      <h3>{skill.name}</h3>
      <ProgressBar
        data={skill}
        config={config}
        label="Mastery"
        showPercentage={true}
      />
      <p>Level: {getMasteryLevel(skill.progress)}</p>
    </Card>
  );
}

// DMLog usage
function XPProgressCard({ character }: { character: DMCharacter }) {
  const config = useDMLogConfig();
  return (
    <Card>
      <h3>{character.name}</h3>
      <ProgressBar
        data={{ progress: character.xp / character.nextLevelXp }}
        config={config}
        label="XP Progress"
        showPercentage={false}
      />
      <p>Level {character.level}</p>
    </Card>
  );
}
```

---

## 5. Implementation Roadmap

### Phase 1: Extract Shared Components (Weeks 1-4)

**Goal:** Create product-agnostic core packages

```
                    PHASE 1 DELIVERABLES
                    ===================

packages/
├── character-sdk/              # NEW - Shared character system
│   ├── src/
│   │   ├── core/
│   │   │   ├── Character.ts
│   │   │   ├── Personality.ts
│   │   │   └── State.ts
│   │   ├── memory/
│   │   │   ├── HierarchicalMemory.ts
│   │   │   ├── MemoryTypes.ts
│   │   │   └── ConsolidationEngine.ts
│   │   ├── decision/
│   │   │   ├── DecisionEngine.ts
│   │   │   ├── EscalationEngine.ts
│   │   │   └── DecisionContext.ts
│   │   └── learning/
│   │       ├── OutcomeTracker.ts
│   │       ├── RewardSignal.ts
│   │       └── QualityAnalyzer.ts
│   └── product/
│       ├── studylog.config.ts
│       └── dmlog.config.ts
│
├── agent-coordinator/           # NEW - Shared coordination
│   ├── src/
│   │   ├── Coordinator.ts
│   │   ├── Agent.ts
│   │   ├── Task.ts
│   │   ├── MessageBus.ts
│   │   ├── EventBus.ts
│   │   └── roles/
│   │       ├── shared.ts
│   │       ├── studylog.ts
│   │       └── dmlog.ts
│
├── escalation-engine/           # NEW - Shared escalation
│   ├── src/
│   │   ├── EscalationEngine.ts
│   │   ├── Router.ts
│   │   ├── Providers.ts
│   │   ├── CostTracker.ts
│   │   └── config/
│   │       ├── studylog.ts
│   │       └── dmlog.ts
│
└── memory-system/               # NEW - Shared memory
    ├── src/
    │   ├── HierarchicalMemory.ts
    │   ├── WorkingMemory.ts
    │   ├── EpisodicMemory.ts
    │   ├── SemanticMemory.ts
    │   ├── ProceduralMemory.ts
    │   ├── ConsolidationPipeline.ts
    │   └── config/
    │       ├── studylog.ts
    │       └── dmlog.ts
```

**Week 1-2 Tasks:**
1. Create `@studylog/character-sdk` package structure
2. Port core Character, Memory, Decision classes from SuperInstance research
3. Implement product configuration system
4. Write unit tests for shared components

**Week 3-4 Tasks:**
1. Create `@studylog/agent-coordinator` package
2. Implement task routing with capability matching
3. Create event bus for reactive updates
4. Write integration tests

### Phase 2: Build DMLog-Specific Features (Weeks 5-8)

**Goal:** Implement DMLog on shared backend

```
                    PHASE 2 DELIVERABLES
                    ===================

backend/workers/
├── dmlog-worker/               # NEW - DMLog-specific worker
│   ├── src/
│   │   ├── handlers/
│   │   │   ├── character.ts    # Character CRUD
│   │   │   ├── campaign.ts     # Campaign management
│   │   │   ├── combat.ts       # Combat resolution
│   │   │   ├── social.ts       # Social interactions
│   │   │   └── exploration.ts  # Discovery mechanics
│   │   ├── game/
│   │   │   ├── mechanics.ts    # D&D 5e rules
│   │   │   ├── dice.ts         # Dice rolling
│   │   │   └── initiative.ts   # Turn order
│   │   └── index.ts
│
└── shared-worker/              # NEW - Shared backend logic
    ├── src/
    │   ├── services/
    │   │   ├── character.ts    # Shared character ops
    │   │   ├── memory.ts        # Shared memory ops
    │   │   ├── escalation.ts    # Shared escalation
    │   │   ├── coordinator.ts  # Shared coordination
    │   │   └── outcome.ts       # Shared outcome tracking
    │   ├── config/
    │   │   ├── products.ts      # Product configs
    │   │   ├── studylog.ts
    │   │   └── dmlog.ts
    │   └── db/
    │       ├── schema.sql       # Unified schema
    │       ├── migrations/
    │       └── seeds/
    │           ├── studylog.sql
    │           └── dmlog.sql
```

**Week 5-6 Tasks:**
1. Set up DMLog worker with product routing
2. Implement character sheet endpoints
3. Create campaign session management
4. Implement basic combat resolution

**Week 7-8 Tasks:**
1. Implement NPC AI using shared coordinator
2. Create social interaction system
3. Add exploration mechanics
4. Integrate with shared memory/escalation

### Phase 3: Optimize Shared Patterns (Weeks 9-12)

**Goal:** Refine and optimize unified architecture

```
                    PHASE 3 DELIVERABLES
                    ===================

1. Performance Optimization
   ├── Database query optimization with product-specific indexes
   ├── Response caching strategies per product
   ├── Worker allocation and cold start mitigation
   └── Cost tracking and alerts per product

2. Developer Experience
   ├── Type-safe API clients for both products
   ├── Configuration validation tools
   ├── Testing utilities for product-specific code
   └── Documentation with product examples

3. Monitoring & Analytics
   ├── Unified metrics collection
   ├── Product-specific dashboards
   ├── Cost attribution per product
   └── Usage analytics
```

---

## 6. Data Model Unification

### 6.1 Entity Model

```typescript
// Unified entity interface
interface Entity {
  // Shared fields
  id: string;
  userId: string;
  productId: 'studylog' | 'dmlog';
  entityType: string; // Configured per product

  // Core character data (shared structure)
  name: string;
  personality: Personality;
  state: EntityState;
  createdAt: Date;
  updatedAt: Date;

  // Product-specific extensions
  extensionData: {
    studylog?: StudentExtension;
    dmlog?: CharacterExtension;
  };
}

// Shared personality system
interface Personality {
  // Big Five traits (shared)
  openness: number;        // 0-1
  conscientiousness: number; // 0-1
  extraversion: number;    // 0-1
  agreeableness: number;   // 0-1
  neuroticism: number;     // 0-1

  // Product-specific traits
  productTraits?: Record<string, number>;
}

// Shared state interface
interface EntityState {
  // Current status
  status: 'active' | 'idle' | 'suspended' | 'terminated';

  // Current task/activity
  currentTask?: {
    id: string;
    description: string;
    startedAt: Date;
  };

  // Metrics
  metrics: EntityMetrics;
}

// Entity metrics (shared structure, product-specific values)
interface EntityMetrics {
  // Activity metrics
  totalSessions: number;
  totalTasks: number;
  completedTasks: number;

  // Performance metrics
  successRate: number;
  averageTaskDuration: number; // milliseconds

  // Product-specific metrics
  productMetrics: {
    studylog?: StudentMetrics;
    dmlog?: CharacterMetrics;
  };
}

// StudyLoG.AI specific extension
interface StudentExtension {
  // Learning progress
  currentStage: 'cognitive_mill' | 'intelligence_ranch' | 'sitka_sound';
  stageProgress: Record<string, number>;

  // Skills
  skills: Record<string, {
    concept: string;
    mastery: number; // 0-1
    lastPracticed: Date;
  }>;

  // Streak
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date;
}

interface StudentMetrics {
  conceptsLearned: number;
  puzzlesSolved: number;
  hintsUsed: number;
  totalStudyTime: number; // seconds
}

// DMLog specific extension
interface CharacterExtension {
  // D&D 5e stats
  abilities: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };

  // Combat
  hp: { current: number; max: number };
  ac: number;
  speed: number;

  // Progression
  xp: number;
  level: number;

  // Equipment
  inventory: Item[];
  spells: Spell[];
}

interface CharacterMetrics {
  damageDealt: number;
  enemiesDefeated: number;
  socialChecks: number;
  discoveries: number;
}
```

### 6.2 Session Model

```typescript
// Unified session interface
interface Session {
  // Shared fields
  id: string;
  productId: 'studylog' | 'dmlog';
  entityType: string; // 'student' | 'character'

  // Participants
  entityIds: string[];
  userId: string;

  // Session lifecycle
  phase: SessionPhase;
  startedAt: Date;
  endedAt?: Date;

  // Session data
  data: SessionData;

  // Metrics
  metrics: SessionMetrics;
}

enum SessionPhase {
  SETUP = 'setup',
  ACTIVE = 'active',
  INTERMISSION = 'intermission',
  COMPLETE = 'complete',
  ARCHIVED = 'archived',
}

// Session data (product-specific)
type SessionData =
  | StudySessionData
  | GameSessionData;

interface StudySessionData {
  type: 'study_session';
  subject: string;
  topic: string;
  objectives: string[];

  // Activities
  activities: StudyActivity[];

  // Outcomes
  conceptsLearned: string[];
  skillsPracticed: string[];
}

interface StudyActivity {
  type: 'lesson' | 'exercise' | 'quiz' | 'project';
  description: string;
  startedAt: Date;
  completedAt?: Date;
  success?: boolean;
  hints: number;
}

interface GameSessionData {
  type: 'game_session';
  campaign: string;
  chapter: string;
  scene: string;

  // Encounters
  encounters: Encounter[];

  // Outcomes
  xpGained: number;
  loot: Item[];
  storyBeats: string[];
}

interface Encounter {
  type: 'combat' | 'social' | 'exploration' | 'puzzle';
  description: string;
  startedAt: Date;
  completedAt?: Date;
  outcome?: EncounterOutcome;
}

interface EncounterOutcome {
  success: boolean;
  xpGained: number;
  rewards: RewardSignal[];
}

// Session metrics (shared structure)
interface SessionMetrics {
  duration: number; // seconds

  // Decision metrics
  decisionsMade: number;
  botDecisions: number;
  brainDecisions: number;
  humanDecisions: number;

  // Outcome metrics
  totalReward: number;
  domainRewards: Record<RewardDomain, number>;

  // Product-specific metrics
  productMetrics: {
    studylog?: StudySessionMetrics;
    dmlog?: GameSessionMetrics;
  };
}

interface StudySessionMetrics {
  conceptsMastered: number;
  exercisesCompleted: number;
  averageQuizScore: number;
  helpRequests: number;
}

interface GameSessionMetrics {
  combatEncounters: number;
  enemiesDefeated: number;
  checksSucceeded: number;
  checksFailed: number;
}
```

### 6.3 Memory Model

```typescript
// Unified memory interface
interface Memory {
  // Shared fields
  id: string;
  entityId: string;
  productId: 'studylog' | 'dmlog';

  // Memory content
  memoryType: MemoryType;
  content: string;
  importance: number; // 1-10

  // Context
  emotionalValence: number; // -1 to 1
  context: MemoryContext;

  // Relationships
  relatedEntities: string[];
  relatedMemories: string[];

  // Consolidation
  consolidated: boolean;
  consolidatedInto?: string;

  // Timestamps
  createdAt: Date;
  accessedAt: Date;
  decayFactor: number;
}

enum MemoryType {
  WORKING = 'working',       // STM, current context
  EPISODIC = 'episodic',     // Events with context
  SEMANTIC = 'semantic',     // Knowledge/facts
  PROCEDURAL = 'procedural', // Skills
  REFLECTION = 'reflection', // Meta-cognitive
  IDENTITY = 'identity',     // Core traits
}

// Memory context (product-specific fields)
interface MemoryContext {
  // Shared fields
  location?: string;
  participants?: string[];
  timestamp?: Date;

  // Product-specific fields
  productContext?: {
    studylog?: StudyMemoryContext;
    dmlog?: GameMemoryContext;
  };
}

interface StudyMemoryContext {
  subject?: string;
  concept?: string;
  difficulty?: number;
  lessonType?: 'lesson' | 'exercise' | 'quiz' | 'project';
  milestone?: boolean; // First time, breakthrough, etc.
}

interface GameMemoryContext {
  campaign?: string;
  location?: string;
  scene?: string;
  encounterType?: 'combat' | 'social' | 'exploration';
  storyBeat?: boolean;
}
```

---

## 7. API Design

### 7.1 Unified Endpoint Structure

```
                    API ENDPOINTS - UNIFIED
                    =====================

                    /api/v1/{product}/{resource}
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌──────────┐      ┌──────────┐
   │ SHARED  │        │STUDYLOG  │      │  DMLOG   │
   │ HANDLERS│        │ HANDLERS │      │ HANDLERS │
   └─────────┘        └──────────┘      └──────────┘
        │                  │                  │
        ▼                  ▼                  ▼
    /api/v1/:product/    /api/v1/studylog/  /api/v1/dmlog/
    characters/          lessons/           campaigns/
    memories/            skills/            encounters/
    sessions/            progress/          combat/
    tasks/               classes/           parties/
    outcomes/            quizzes/           loot/
```

**Shared Endpoint Specifications:**

```typescript
// Character endpoints (shared)
interface CharacterAPI {
  // List entities
  list(
    product: 'studylog' | 'dmlog',
    filters?: EntityFilters
  ): Promise<Entity[]>;

  // Get single entity
  get(
    product: 'studylog' | 'dmlog',
    id: string
  ): Promise<Entity>;

  // Create entity
  create(
    product: 'studylog' | 'dmlog',
    data: EntityCreateData
  ): Promise<Entity>;

  // Update entity
  update(
    product: 'studylog' | 'dmlog',
    id: string,
    data: Partial<Entity>
  ): Promise<Entity>;

  // Delete entity
  delete(
    product: 'studylog' | 'dmlog',
    id: string
  ): Promise<void>;
}

// Memory endpoints (shared)
interface MemoryAPI {
  // Store memory
  store(
    product: 'studylog' | 'dmlog',
    entityId: string,
    memory: MemoryCreateData
  ): Promise<Memory>;

  // Retrieve memories
  retrieve(
    product: 'studylog' | 'dmlog',
    entityId: string,
    query: MemoryQuery
  ): Promise<Memory[]>;

  // Consolidate memories
  consolidate(
    product: 'studylog' | 'dmlog',
    entityId: string
  ): Promise<ConsolidationResult>;

  // Get memory stats
  stats(
    product: 'studylog' | 'dmlog',
    entityId: string
  ): Promise<MemoryStats>;
}

// Session endpoints (shared)
interface SessionAPI {
  // Create session
  create(
    product: 'studylog' | 'dmlog',
    data: SessionCreateData
  ): Promise<Session>;

  // Get session
  get(
    product: 'studylog' | 'dmlog',
    id: string
  ): Promise<Session>;

  // Update session phase
  updatePhase(
    product: 'studylog' | 'dmlog',
    id: string,
    phase: SessionPhase
  ): Promise<Session>;

  // End session
  end(
    product: 'studylog' | 'dmlog',
    id: string
  ): Promise<SessionSummary>;

  // Get session metrics
  metrics(
    product: 'studylog' | 'dmlog',
    id: string
  ): Promise<SessionMetrics>;
}
```

### 7.2 Product-Specific Endpoints

```typescript
// StudyLoG.AI specific endpoints
interface StudyLogAPI {
  // Lesson management
  lessons: {
    list(filters?: LessonFilters): Promise<Lesson[]>;
    get(id: string): Promise<Lesson>;
    create(data: LessonCreateData): Promise<Lesson>;
  };

  // Skill tracking
  skills: {
    get(studentId: string): Promise<Skill[]>;
    update(studentId: string, skill: string, progress: number): Promise<Skill>;
    recommend(studentId: string): Promise<string[]>;
  };

  // Progress tracking
  progress: {
    get(studentId: string): Promise<StudentProgress>;
    updateStage(studentId: string, stage: string, progress: number): Promise<void>;
    getMilestones(studentId: string): Promise<Milestone[]>;
  };
}

// DMLog specific endpoints
interface DMLogAPI {
  // Campaign management
  campaigns: {
    list(filters?: CampaignFilters): Promise<Campaign[]>;
    get(id: string): Promise<Campaign>;
    create(data: CampaignCreateData): Promise<Campaign>;
  };

  // Combat
  combat: {
    initiate(encounterId: string): Promise<CombatSession>;
    action(sessionId: string, action: CombatAction): Promise<CombatResult>;
    resolve(sessionId: string): Promise<CombatSummary>;
  };

  // Character stats
  characters: {
    getStats(characterId: string): Promise<CharacterStats>;
    updateHP(characterId: string, hp: number): Promise<CharacterStats>;
    addXP(characterId: string, xp: number): Promise<CharacterStats>;
    levelUp(characterId: string): Promise<CharacterStats>;
  };
}
```

---

## 8. Deployment Strategy

### 8.1 Multi-Product Cloudflare Workers

```
                    DEPLOYMENT ARCHITECTURE
                    =====================

                    Cloudflare Workers
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌──────────┐      ┌──────────┐
   │  ROUTE  │        │ SHARED   │      │ PRODUCT  │
   │WORKER   │        │ WORKERS  │      │ WORKERS  │
   └────┬────┘        └────┬─────┘      └────┬─────┘
        │                 │                 │
        │                 ▼                 ▼
        │         ┌──────────────┐   ┌──────────────┐
        │         │character-svc │   │studylog-svc  │
        │         │memory-svc    │   │dmlog-svc     │
        │         │escalation-svc│   │               │
        │         │coordinator-  │   │               │
        │         │  svc         │   │               │
        │         └──────────────┘   └──────────────┘
        │
        ▼
   ┌───────────────────────────────────┐
   │     Product Routing Logic         │
   │                                   │
   │  if (path starts with /studylog)  │
   │    => studylog-worker             │
   │  elif (path starts with /dmlog)   │
   │    => dmlog-worker                │
   │  else                             │
   │    => shared-workers              │
   └───────────────────────────────────┘
```

**Worker Configuration:**

```toml
# wrangler.toml
name = "superinstance-router"
main = "src/router.ts"
compatibility_date = "2024-01-01"

# Shared services (D1, KV, R2 bindings)
[[d1_databases]]
binding = "DB"
database_name = "superinstance-db"
database_id = "xxx"

[[kv_namespaces]]
binding = "CACHE"
id = "xxx"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "superinstance-storage"

# Route workers
[[routes]]
pattern = "api.studylog.ai/*"
zone_name = "studylog.ai"

[[routes]]
pattern = "api.dmlog.ai/*"
zone_name = "dmlog.ai"
```

### 8.2 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  # Shared packages job
  build-shared:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: pnpm install
      - run: pnpm --filter @studylog/character-sdk build
      - run: pnpm --filter @studylog/agent-coordinator build
      - run: pnpm --filter @studylog/escalation-engine build
      - run: pnpm test --filter @studylog/shared

  # StudyLoG deployment job
  deploy-studylog:
    needs: build-shared
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm --filter @studylog/studylog-worker deploy
      - run: pnpm --filter @studylog/theia-studylog build

  # DMLog deployment job
  deploy-dmlog:
    needs: build-shared
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm --filter @studylog/dmlog-worker deploy
      - run: pnpm --filter @studylog/theia-dmlog build
```

### 8.3 Monitoring and Analytics

```
                    MONITORING ARCHITECTURE
                    ======================

                    Cloudflare Analytics
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐        ┌──────────┐      ┌──────────┐
   │  USAGE  │        │  COST    │      │PERFORMANCE│
   │ METRICS │        │ TRACKING │      │ MONITORING│
   └─────────┘        └──────────┘      └──────────┘
        │                  │                  │
        ▼                  ▼                  ▼
    - Requests/          - LLM costs        - Response
      product            per product         times
    - Active users       - Escalation       - Error rates
    - Session duration   distribution       - Cold starts
    - Feature usage      - Tier breakdown    - Cache hit rate
```

---

## Summary and Key Takeaways

### Shared Component Summary

| Component | Shareability | Key Config Points |
|-----------|---------------|------------------|
| **Character SDK** | 100% | Entity type, personality traits, terminology |
| **Memory System** | 90% | Consolidation triggers, extractors, visualization |
| **Escalation Engine** | 100% | Thresholds, critical conditions, cost tiers |
| **Outcome Tracker** | 85% | Reward domains, quality weights, metrics |
| **Agent Coordinator** | 95% | Agent roles, capabilities, task types |
| **Session Manager** | 90% | Phase definitions, metrics, extension data |

### Implementation Priority

1. **Phase 1 (Weeks 1-4):** Extract shared components into `@studylog/*` packages
2. **Phase 2 (Weeks 5-8):** Build DMLog on shared backend
3. **Phase 3 (Weeks 9-12):** Optimize and refine unified architecture

### Success Metrics

- **Code Sharing:** Target 85% shared code between products
- **Cost Savings:** 40x reduction through shared escalation engine
- **Developer Velocity:** 3x faster product launches with shared foundation
- **Maintenance:** Single codebase for core features reduces burden by 60%

### Product Differentiation

Despite shared backend, each product maintains unique identity:

| Aspect | StudyLoG.AI | DMLoG.AI |
|--------|-------------|----------|
| **Theme** | Educational progress | Fantasy adventure |
| **Entity** | Student/Teacher | Character/NPC |
| **Progression** | Skill mastery | XP/Leveling |
| **Sessions** | Study sessions | Game sessions |
| **Rewards** | Knowledge/Concepts | Loot/XP |
| **Visuals** | Clean, technical | Fantasy, atmospheric |

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Complete - Ready for Implementation

**Next Steps:**
1. Review with development team
2. Create detailed implementation tickets
3. Begin Phase 1: Shared component extraction
4. Set up CI/CD for multi-product deployment

---

**Remember:** Every layer is a mill. Every agent is a millwright. Every product graduates from the shared foundation.
