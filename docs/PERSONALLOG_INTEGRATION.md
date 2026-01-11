# PersonalLog Integration Guide

**Research Date:** 2026-01-10
**Repository:** https://github.com/SuperInstance/PersonalLog
**Target Products:** StudyLoG.AI, DMLoG.AI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Patterns from PersonalLog](#core-patterns-from-personallog)
3. [Integration Architecture](#integration-architecture)
4. [StudyLoG.AI Integration](#studylogai-integration)
5. [DMLoG.AI Integration](#dmlogai-integration)
6. [Implementation Reference](#implementation-reference)
7. [Best Practices](#best-practices)

---

## Executive Summary

PersonalLog provides a **privacy-first, local-first** personal logging system with sophisticated analytics, session tracking, and reflection capabilities. This document extracts key patterns and provides integration guidance for SuperInstance.AI products.

### Key Benefits

| Pattern | Benefit | Use Case |
|---------|---------|----------|
| Session Tracking | Continuous activity monitoring | Learning progress, game sessions |
| Event Taxonomy | Structured event collection | Analytics, insights |
| Insights Engine | Automated pattern detection | Learning recommendations |
| IndexedDB Storage | Local-first persistence | Privacy, offline support |
| Export System | Multiple format support | Backup, sharing |

---

## Core Patterns from PersonalLog

### 1. Session Management Pattern

```typescript
class SessionManager {
  private sessionId: string
  private sessionStart: number
  private lastActivity: number
  private sessionTimeout: number

  // Key methods:
  getSessionId(): string
  updateActivity(): void
  isExpired(): boolean
  startNewSession(): string
  getSessionDuration(): number
}
```

**Features:**
- Auto-generated session IDs: `session_${timestamp}_${random}`
- Activity tracking for timeout detection
- Duration calculation
- Default timeout: 30 minutes

**Integration Points:**
- StudyLoG: Track learning session duration
- DMLoG: Track gaming session length

### 2. Event Collection Pattern

```typescript
interface AnalyticsEvent {
  id: string
  type: EventType
  category: EventCategory
  timestamp: string
  sessionId: string
  data: EventData
  metadata?: {
    hardwareHash?: string
    activeFeatures?: string[]
    appVersion?: string
  }
}
```

**Event Categories:**
- `user_action` - User-initiated actions
- `performance` - Performance measurements
- `engagement` - User engagement metrics
- `error` - Error events
- `feature_flag` - Feature flag events
- `system` - System-level events

**Integration Points:**
- StudyLoG: Track lesson completion, skill unlocks
- DMLoG: Track encounters, NPC interactions

### 3. Insights Generation Pattern

```typescript
class InsightsEngine {
  async generateInsights(
    timeRange: TimeRange,
    categories?: InsightCategory[]
  ): Promise<Insight[]>

  async generateDailySummary(date: Date): Promise<DailySummary>
  async generateWeeklySummary(weekStart: Date): Promise<WeeklySummary>
}
```

**Insight Types:**
- Usage pattern insights (peak hours, activity trends)
- Performance insights (slow operations)
- Error insights (frequent errors)
- Engagement insights (session duration, feature adoption)
- Optimization suggestions

**Integration Points:**
- StudyLoG: Generate learning recommendations
- DMLoG: Generate campaign insights

### 4. Storage Pattern

```typescript
interface AnalyticsEventStore {
  addEvents(events: AnalyticsEvent[]): Promise<void>
  getEvent(id: string): Promise<AnalyticsEvent | null>
  queryEvents(options: QueryOptions): Promise<AnalyticsEvent[]>
  deleteEventsBefore(date: string): Promise<number>
  countEvents(): Promise<number>
}
```

**IndexedDB Structure:**
- Separate database per concern
- Indexed queries (timestamp, type, category, sessionId)
- Bounded queries with ranges
- Automatic retention cleanup

---

## Integration Architecture

### Unified Backend Worker

```
┌─────────────────────────────────────────────────────────────────┐
│                   PersonalLog Worker                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │   Journal   │ │ Session      │ │  Reflection │ │  Export  │ │
│  │   Entries   │ │ Logger       │ │  Prompts    │ │  System  │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └──────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │   Timeline  │ │    Event     │ │   Insights  │ │  Storage │ │
│  │   Viewer    │ │   Collector  │ │   Engine    │ │  Layer   │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │ StudyLoG.AI │   │  DMLoG.AI   │   │  Future ...  │
    │ Learning    │   │    TTRPG    │   │  Products   │
    │ Sessions    │   │  Campaigns  │   │             │
    └─────────────┘   └─────────────┘   └─────────────┘
```

### API Endpoints

```
POST   /api/log/journal          - Create journal entry
GET    /api/log/journal/:id      - Get entry
GET    /api/log/journal          - List entries (filtered)

POST   /api/log/session/start    - Start session
POST   /api/log/session/end      - End session
GET    /api/log/session/:id      - Get session details

GET    /api/log/reflection       - Get AI-generated reflection prompts
POST   /api/log/reflection       - Save reflection response

GET    /api/log/timeline         - Get timeline view
GET    /api/log/insights         - Get AI-generated insights
GET    /api/log/summary/daily    - Get daily summary
GET    /api/log/summary/weekly   - Get weekly summary

POST   /api/log/export           - Export data
GET    /api/log/export/:id       - Get export status
```

---

## StudyLoG.AI Integration

### Learning Event Types

```typescript
// StudyLoG.AI specific events
const StudyLogEvents = {
  // Learning Progress
  'lesson_started': {
    category: 'user_action',
    data: {
      lessonId: string
      lessonTitle: string
      module: string
      difficulty: number
    }
  },
  'lesson_completed': {
    category: 'user_action',
    data: {
      lessonId: string
      duration: number
      score: number
      attempts: number
      masteryLevel: 'beginner' | 'intermediate' | 'advanced' | 'mastered'
    }
  },
  'concept_mastered': {
    category: 'engagement',
    data: {
      concept: string
      practiceTime: number
      quizScore: number
      relatedConcepts: string[]
    }
  },

  // Simulation & Experimentation
  'simulation_started': {
    category: 'user_action',
    data: {
      simulationType: string
      parameters: Record<string, unknown>
    }
  },
  'simulation_completed': {
    category: 'user_action',
    data: {
      simulationType: string
      duration: number
      outcome: string
      insights: string[]
    }
  },
  'agent_bred': {
    category: 'user_action',
    data: {
      parentAgents: string[]
      traits: string[]
      expectedBehavior: string
    }
  },

  // Skill Tree
  'skill_unlocked': {
    category: 'engagement',
    data: {
      skillId: string
      skillName: string
      tree: string
      requiredPoints: number
    }
  },
  'skill_practiced': {
    category: 'engagement',
    data: {
      skillId: string
      practiceDuration: number
      improvement: number
    }
  },

  // Cognitive Mill
  'mill_stage_completed': {
    category: 'user_action',
    data: {
      stage: 'token_flow' | 'attention_heatmap' | 'neural_viz'
      understandingLevel: number
      timeSpent: number
    }
  },
}
```

### Learning Journal Schema

```typescript
interface LearningJournalEntry {
  id: string
  userId: string
  timestamp: string

  // Entry content
  type: 'reflection' | 'observation' | 'question' | 'breakthrough'
  title: string
  content: string

  // Learning context
  lesson?: string
  concept?: string
  skill?: string

  // Metadata
  mood?: 'frustrated' | 'confused' | 'curious' | 'excited' | 'proud'
  difficulty?: number
  aiGenerated?: boolean

  // Tags
  tags: string[]

  // Related events
  sessionId: string
  relatedEvents?: string[]
}
```

### StudyLoG Reflection Prompts

```typescript
interface ReflectionPrompt {
  id: string
  category: 'daily' | 'weekly' | 'milestone' | 'struggle'
  prompt: string
  context?: {
    recentActivity?: string[]
    strugglingConcepts?: string[]
    masteredSkills?: string[]
  }
  type: 'open_ended' | 'guided' | 'rating' | 'comparison'
}

// Example prompts
const studyLogPrompts: ReflectionPrompt[] = [
  {
    id: 'daily_learning',
    category: 'daily',
    prompt: 'What was the most interesting thing you learned today about AI models?',
    type: 'open_ended'
  },
  {
    id: 'concept_clarify',
    category: 'struggle',
    prompt: 'Which concept felt confusing today? What specifically made it challenging?',
    context: {
      strugglingConcepts: []
    },
    type: 'guided'
  },
  {
    id: 'skill_reflection',
    category: 'milestone',
    prompt: 'You just unlocked {skill}! How does this connect to what you learned before?',
    type: 'comparison'
  }
]
```

---

## DMLoG.AI Integration

### Gaming Event Types

```typescript
// DMLoG.AI specific events
const DMLogEvents = {
  // Session Management
  'campaign_session_started': {
    category: 'engagement',
    data: {
      campaignId: string
      campaignName: string
      playerCount: number
      characters: string[]
    }
  },
  'campaign_session_ended': {
    category: 'engagement',
    data: {
      campaignId: string
      duration: number
      encountersCompleted: number
      storyBeats: string[]
    }
  },

  // Encounters
  'encounter_started': {
    category: 'user_action',
    data: {
      encounterType: 'combat' | 'social' | 'exploration' | 'puzzle'
      difficulty: number
      partySize: number
    }
  },
  'encounter_completed': {
    category: 'user_action',
    data: {
      encounterType: string
      duration: number
      outcome: 'victory' | 'defeat' | 'negotiation' | 'fled'
      resourcesUsed: string[]
    }
  },

  // Character Development
  'character_created': {
    category: 'user_action',
    data: {
      characterId: string
      characterName: string
      class: string
      background: string
    }
  },
  'character_developed': {
    category: 'engagement',
    data: {
      characterId: string
      developmentType: 'level_up' | 'backstory' | 'relationship' | 'moral_choice'
      impact: string
    }
  },

  // World Building
  'world_building_session': {
    category: 'user_action',
    data: {
      activity: 'location' | 'npc' | 'lore' | 'faction'
      elementsCreated: number
      connectedToCampaign: boolean
    }
  },
  'npc_interaction': {
    category: 'engagement',
    data: {
      npcId: string
      interactionType: 'dialogue' | 'combat' | 'trade' | 'quest'
      relationshipChange: number
  },

  // Preparation
  'dm_prep_started': {
    category: 'user_action',
    data: {
      sessionNumber: number
      prepActivities: string[]
    }
  },
  'dm_prep_completed': {
    category: 'user_action',
    data: {
      prepDuration: number
      encountersPrepared: number
      resourcesCreated: string[]
    }
  },
}
```

### Campaign Journal Schema

```typescript
interface CampaignJournalEntry {
  id: string
  userId: string
  timestamp: string

  // Entry content
  type: 'session_log' | 'character_note' | 'world_building' | 'dm_reflection'
  title: string
  content: string

  // Campaign context
  campaignId: string
  campaignName: string
  sessionNumber?: number

  // Related entities
  characters?: string[]
  locations?: string[]
  npcs?: string[]

  // Metadata
  tags: string[]
  isPublic: boolean
  isPlayerVisible: boolean

  // Related events
  sessionId: string
  relatedEvents?: string[]
}
```

### DMLoG Reflection Prompts

```typescript
const dmLogPrompts: ReflectionPrompt[] = [
  {
    id: 'session_reflection',
    category: 'daily',
    prompt: 'What was the most memorable moment from today\'s session? Why did it stand out?',
    type: 'open_ended'
  },
  {
    id: 'character_arc',
    category: 'weekly',
    prompt: 'How has {character} changed since the campaign began?',
    context: {
      characters: []
    },
    type: 'comparison'
  },
  {
    id: 'encounter_analysis',
    category: 'milestone',
    prompt: 'The {encounterType} encounter went {outcome}. What would you change next time?',
    type: 'guided'
  },
  {
    id: 'world_building_progress',
    category: 'weekly',
    prompt: 'What new element of the world are you most excited to explore?',
    type: 'open_ended'
  }
]
```

---

## Implementation Reference

### File Structure

```
backend/workers/personal-log/
├── index.ts                    # Main API entry point
├── types.ts                    # Shared types
├── journal.ts                  # Personal journal entries
├── session-logger.ts           # Session tracking
├── reflection-prompts.ts       # AI-generated reflection questions
├── timeline-viewer.ts          # Visualize personal history
├── export-system.ts            # Export to various formats
├── event-collector.ts          # Event collection (from PersonalLog)
├── insights-engine.ts          # Insight generation (from PersonalLog)
├── storage.ts                  # IndexedDB storage layer
└── README.md
```

### Type Definitions

```typescript
// Product context
type ProductContext = 'studylog' | 'dmlog' | 'makerlog' | 'fishinglog'

// Journal entry (shared across products)
interface JournalEntry {
  id: string
  userId: string
  productId: ProductContext
  timestamp: string

  // Content
  type: string
  title: string
  content: string

  // Product-specific context
  context?: Record<string, unknown>

  // Metadata
  mood?: string
  tags: string[]
  isPublic: boolean

  // Relations
  sessionId: string
  relatedEvents?: string[]
}

// Session tracking (shared)
interface Session {
  id: string
  userId: string
  productId: ProductContext
  startTime: string
  endTime?: string
  duration?: number

  // Session stats
  eventsCount: number
  featuresUsed: string[]

  // Product-specific data
  context?: Record<string, unknown>
}

// Timeline view (shared)
interface TimelineEvent {
  id: string
  timestamp: string
  type: 'journal' | 'session' | 'achievement' | 'milestone'
  title: string
  description?: string
  icon?: string
  color?: string
  metadata?: Record<string, unknown>
}
```

---

## Best Practices

### 1. Privacy-First Design

- All data stored locally by default
- No cloud sync without explicit consent
- PII sanitization in error events
- User-controlled data deletion

### 2. Product-Agnostic Core

- Shared types and interfaces
- Product-specific extensions
- Consistent API patterns
- Cross-product event correlation

### 3. Offline Support

- IndexedDB for local storage
- Sync when connected
- Conflict resolution
- Background data processing

### 4. Progressive Enhancement

- Core functionality without AI
- Enhanced insights with AI
- Optional cloud features
- Graceful degradation

### 5. Performance

- Event batching
- IndexedDB indexes
- Lazy loading
- Data retention policies

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Set up personal-log worker directory
- [ ] Implement shared types
- [ ] Create storage layer (IndexedDB)
- [ ] Build event collector
- [ ] Add session management

### Phase 2: Journal System
- [ ] Implement journal CRUD
- [ ] Add product-specific schemas
- [ ] Create reflection prompt engine
- [ ] Build journal search/filter

### Phase 3: Analytics & Insights
- [ ] Port insights engine
- [ ] Add product-specific insight generators
- [ ] Create timeline viewer
- [ ] Build daily/weekly summaries

### Phase 4: Export & Integration
- [ ] Implement export system
- [ ] Add format converters
- [ ] Create StudyLoG integration
- [ ] Create DMLoG integration

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
