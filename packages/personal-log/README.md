# @superinstance/personal-log

Session tracking, learning analytics, and progress insights for SuperInstance products (StudyLoG.AI, DMLoG.AI, and more).

## Features

- **Session Tracking** - Automatic session lifecycle management with timeout detection
- **Event Analytics** - Comprehensive event tracking with IndexedDB persistence
- **Learning Insights** - Automated insight generation for learning patterns
- **Progress Summaries** - Daily and weekly summaries of user activity
- **Cross-Product Support** - Works across StudyLoG.AI, DMLoG.AI, and future products
- **Privacy-First** - All data stored locally, no cloud sync by default

## Installation

```bash
npm install @superinstance/personal-log
```

## Quick Start

```typescript
import { PersonalLog } from '@superinstance/personal-log'

// Initialize for StudyLoG.AI
await PersonalLog.initialize({
  productId: 'studylog',
  retentionDays: 90
})

// Track a lesson completion
await PersonalLog.track('lesson_completed', {
  lessonId: 'cognitive-mill-1',
  lessonTitle: 'Understanding Token Flow',
  duration: 300,
  completionPercentage: 100,
  conceptsLearned: ['tokens', 'attention', 'neural-networks']
})

// Get insights
const insights = await PersonalLog.getInsights(7) // Last 7 days
const summary = await PersonalLog.getDailySummary()
```

## API Reference

### Initialization

```typescript
await PersonalLog.initialize({
  productId: 'studylog' | 'dmlog',
  analytics: {
    enabled: true,
    persist: true,
    retentionDays: 90
  },
  session: {
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    enableCrossProduct: true
  }
})
```

### Tracking Events

```typescript
// StudyLoG.AI events
await PersonalLog.track('lesson_started', { lessonId: '...', lessonTitle: '...', category: 'cognitive-mill' })
await PersonalLog.track('concept_mastered', { conceptId: '...', conceptName: '...', practiceTime: 120, accuracy: 0.95 })
await PersonalLog.track('skill_unlocked', { skillId: '...', skillName: '...', skillTree: '...' })
await PersonalLog.track('agent_bred', { agentId: '...', parent1Id: '...', parent2Id: '...', inheritedTraits: [...] })

// DMLoG.AI events
await PersonalLog.track('encounter_started', { encounterId: '...', encounterType: '...', difficulty: 'medium', partySize: 4 })
await PersonalLog.track('encounter_completed', { encounterId: '...', duration: 1800, victorious: true, xpGained: 500 })
await PersonalLog.track('npc_created', { npcId: '...', npcName: '...', role: 'merchant', personalityType: 'friendly' })

// Core events (all products)
await PersonalLog.track('feature_used', { featureId: 'cognitive-mill', success: true, duration: 120 })
await PersonalLog.track('message_sent', { conversationId: '...', messageLength: 45, hasAttachment: false })
```

### Getting Insights

```typescript
// Get insights for the last N days
const insights = await PersonalLog.getInsights(7)

// Get today's summary
const daily = await PersonalLog.getDailySummary()
console.log(daily.summary) // "You completed 5 lessons with 3 concepts mastered."
console.log(daily.stats) // { totalEvents: 42, totalSessions: 3, ... }

// Get this week's summary
const weekly = await PersonalLog.getWeeklySummary()
console.log(weekly.comparison) // { eventsChange: 15, sessionsChange: 0, ... }
```

### Session Management

```typescript
// Get current session info
const sessionId = PersonalLog.getSessionId()
const sessionManager = PersonalLog.getSessionManager()

// Get session stats
const stats = sessionManager.getSessionStats()
console.log(stats.duration) // Session length in seconds
console.log(stats.actionsPerformed) // Total actions in session

// Record activity
PersonalLog.recordActivity('lesson_view')
```

## Event Types

### Core Events (All Products)

| Event | Description |
|-------|-------------|
| `message_sent` | User sent a message |
| `conversation_created` | User created a conversation |
| `search_performed` | User performed a search |
| `feature_used` | User used a feature |
| `session_start` | Session started |
| `session_end` | Session ended |
| `error_occurred` | An error occurred |

### StudyLoG.AI Events

| Event | Description |
|-------|-------------|
| `lesson_started` | User started a lesson |
| `lesson_completed` | User completed a lesson |
| `concept_mastered` | User mastered a concept |
| `skill_unlocked` | User unlocked a skill |
| `agent_bred` | User bred an agent |
| `mill_simulation_started` | Cognitive mill simulation started |
| `flock_simulation_started` | Sitka Sound simulation started |

### DMLoG.AI Events

| Event | Description |
|-------|-------------|
| `campaign_session_started` | TTRPG campaign session started |
| `encounter_created` | User created an encounter |
| `encounter_started` | Encounter started |
| `encounter_completed` | Encounter completed |
| `npc_created` | User created an NPC |
| `npc_interaction` | User interacted with an NPC |

## Product-Specific Stats

### StudyLoG.AI Daily Stats

```typescript
{
  lessonsCompleted: number
  conceptsMastered: number
  skillsUnlocked: number
  timeInCognitiveMill: number
  timeInIntelligenceRanch: number
  timeInSitkaSound: number
  agentsBred: number
}
```

### DMLoG.AI Daily Stats

```typescript
{
  encountersCompleted: number
  npcsCreated: number
  campaignSessions: number
  totalPlayTime: number
  encountersCompletedVictory: number
  averageSessionPlayers: number
}
```

## Storage

All data is stored locally in IndexedDB:

- **Database:** `PersonalLogAnalytics`
- **Stores:** `events`, `metadata`
- **Indexes:** `timestamp`, `type`, `category`, `sessionId`, `productId`

## License

MIT
