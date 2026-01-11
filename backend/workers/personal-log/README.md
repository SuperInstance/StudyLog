# PersonalLog Worker

Privacy-first, local-first personal logging system for SuperInstance.AI products.

## Overview

PersonalLog provides comprehensive personal logging capabilities with:

- **Journal System** - Create and manage personal journal entries
- **Session Tracking** - Monitor user sessions with activity tracking
- **Reflection Prompts** - AI-generated questions for self-reflection
- **Timeline Viewer** - Visualize personal history chronologically
- **Export System** - Export data to JSON, Markdown, CSV, HTML, YAML, PDF

## Features

### Privacy-First Design

- All data stored locally in IndexedDB
- No cloud sync by default
- User-controlled data deletion
- Optional data anonymization

### Product Integration

Supports all SuperInstance.AI products:

- **StudyLoG.AI** - Learning journal, progress tracking
- **DMLoG.AI** - Campaign journal, character development
- **MakerLoG.AI** - Project logs (planned)
- **FishingLoG.AI** - Simulation logs (planned)

## Installation

```bash
pnpm install @workers/personal-log
```

## Quick Start

### Basic Usage

```typescript
import { createPersonalLog } from '@workers/personal-log'

// Create a PersonalLog instance for StudyLoG
const personalLog = createPersonalLog('studylog')

// Start a session
await personalLog.startSession('user-123')

// Create a journal entry
await personalLog.journal.createReflection({
  userId: 'user-123',
  sessionId: personalLog.getSessionId()!,
  title: 'Learning about Neural Networks',
  content: 'Today I learned about backpropagation...',
  concept: 'backpropagation',
  mood: 'excited',
})

// Get daily summary
const summary = await personalLog.getDailySummary()
console.log(summary)

// End session
await personalLog.endSession()
```

### StudyLoG.AI Integration

```typescript
import { StudyLogJournalManager, StudyLogSessionManager } from '@workers/personal-log'

const journal = new StudyLogJournalManager('studylog')
const session = new StudyLogSessionManager('studylog')

// Start a learning session
await session.startSession('user-123', 'direct')

// Track lesson completion
await session.trackLessonComplete({
  lessonId: 'neural-networks-1',
  duration: 300,
  score: 95,
  attempts: 1,
  masteryLevel: 'intermediate'
})

// Create a breakthrough journal entry
await journal.createBreakthrough({
  userId: 'user-123',
  sessionId: session.getSessionId()!,
  title: 'Understanding Gradient Descent',
  content: 'I finally understand how gradient descent works!',
  concept: 'gradient-descent',
  previousUnderstanding: 30,
  newUnderstanding: 85,
})

// Get reflection prompts
const prompts = await session.getReflectionPrompts(3)
```

### DMLoG.AI Integration

```typescript
import { DMLogJournalManager, DMLogSessionManager } from '@workers/personal-log'

const journal = new DMLogJournalManager('dmlog')
const session = new DMLogSessionManager('dmlog')

// Start a campaign session
await session.startSession('user-123', 'direct', {
  campaignId: 'campaign-1',
  campaignName: 'The Lost Mine'
})

// Track an encounter
await session.trackEncounterStart({
  encounterType: 'combat',
  difficulty: 3,
  partySize: 4
})

// Create a session log
await journal.createSessionLog({
  userId: 'user-123',
  sessionId: session.getSessionId()!,
  campaignId: 'campaign-1',
  campaignName: 'The Lost Mine',
  sessionNumber: 5,
  content: 'The party encountered a group of goblins...',
  characters: ['Thorin', 'Elara', 'Gimble', 'Sylas'],
  storyBeats: ['goblin-ambush', 'negotiation-attempt']
})

// End session
await session.endSession()
```

## API Reference

### PersonalLog Class

The main entry point for the personal logging system.

```typescript
class PersonalLog {
  readonly journal: JournalManager
  readonly session: SessionManager
  readonly prompts: ReflectionPromptManager
  readonly timeline: TimelineViewer
  readonly export: ExportSystem

  startSession(userId: string, source?: SessionSource, context?: Record<string, unknown>): Promise<Session>
  endSession(): Promise<Session | null>
  getCurrentSession(): Session | null
  getSessionId(): string | null
  getDailySummary(date?: Date): Promise<DailySummary>
  getReflectionPrompts(count?: number, context?: ReflectionContext): Promise<ReflectionPrompt[]>
  getTimeline(options?: TimelineFilterOptions): Promise<TimelineEvent[]>
  exportAll(format?: ExportFormat): Promise<ExportResult>
  destroy(): void
}
```

### JournalManager

Manages personal journal entries.

```typescript
interface JournalManager {
  createEntry(data: Omit<JournalEntry, 'id' | 'userId' | 'productId' | 'timestamp' | 'sessionId'>): Promise<JournalEntry>
  getEntry(id: string): Promise<JournalEntry | null>
  updateEntry(id: string, updates: Partial<JournalEntry>): Promise<JournalEntry>
  deleteEntry(id: string): Promise<void>
  listEntries(options?: JournalQueryOptions): Promise<JournalEntry[]>
  searchEntries(query: string, options?: JournalQueryOptions): Promise<JournalEntry[]>
  getEntriesByDateRange(startDate: Date, endDate: Date): Promise<JournalEntry[]>
  getEntriesBySession(sessionId: string): Promise<JournalEntry[]>
  getEntriesByTags(tags: string[]): Promise<JournalEntry[]>
  getRecentEntries(limit?: number): Promise<JournalEntry[]>
  countEntries(): Promise<number>
}
```

### SessionManager

Tracks user sessions with activity monitoring.

```typescript
interface SessionManager {
  startSession(userId: string, source?: SessionSource, context?: Record<string, unknown>): Promise<Session>
  endSession(): Promise<Session | null>
  getCurrentSession(): Session | null
  updateActivity(feature?: string): void
  isExpired(): boolean
  trackEvent(event: Omit<AnalyticsEvent, 'sessionId'>): Promise<void>
  getSessionStats(): SessionStats | null
  getSession(id: string): Promise<Session | null>
  getUserSessions(userId: string, limit?: number): Promise<Session[]>
}
```

### StudyLoG.AI Specific Methods

```typescript
class StudyLogSessionManager extends SessionManager {
  trackLessonStart(data: LessonStartData): Promise<void>
  trackLessonComplete(data: LessonCompleteData): Promise<void>
  trackConceptMastered(data: ConceptMasteredData): Promise<void>
  trackSimulationStart(data: SimulationStartData): Promise<void>
  trackSkillUnlock(data: SkillUnlockData): Promise<void>
}

class StudyLogJournalManager extends JournalManager {
  createReflection(data: ReflectionData): Promise<JournalEntry>
  createBreakthrough(data: BreakthroughData): Promise<JournalEntry>
  createQuestion(data: QuestionData): Promise<JournalEntry>
}
```

### DMLoG.AI Specific Methods

```typescript
class DMLogSessionManager extends SessionManager {
  trackCampaignSessionStart(data: CampaignStartData): Promise<void>
  trackEncounterStart(data: EncounterStartData): Promise<void>
  trackEncounterComplete(data: EncounterCompleteData): Promise<void>
  trackCharacterCreation(data: CharacterCreationData): Promise<void>
  trackWorldBuilding(data: WorldBuildingData): Promise<void>
  trackDMPrepStart(data: DMPrepStartData): Promise<void>
}

class DMLogJournalManager extends JournalManager {
  createSessionLog(data: SessionLogData): Promise<JournalEntry>
  createCharacterNote(data: CharacterNoteData): Promise<JournalEntry>
  createWorldBuilding(data: WorldBuildingData): Promise<JournalEntry>
  createDMReflection(data: DMReflectionData): Promise<JournalEntry>
}
```

### TimelineViewer

Visualizes personal history chronologically.

```typescript
interface TimelineViewer {
  getTimeline(journalEntries: JournalEntry[], sessions: Session[], options?: TimelineFilterOptions): Promise<TimelineEvent[]>
  getDateRange(journalEntries: JournalEntry[], sessions: Session[], startDate: Date, endDate: Date): Promise<TimelineEvent[]>
  getToday(journalEntries: JournalEntry[], sessions: Session[]): Promise<TimelineEvent[]>
  getGroupedByDay(journalEntries: JournalEntry[], sessions: Session[], options?: TimelineFilterOptions): Promise<Map<string, TimelineEvent[]>>
  getStatistics(journalEntries: JournalEntry[], sessions: Session[]): Promise<TimelineStatistics>
}
```

### ExportSystem

Exports data to various formats.

```typescript
interface ExportSystem {
  export(journalEntries: JournalEntry[], sessions: Session[], options?: Partial<ExportOptions>): Promise<ExportResult>
  exportJSON(journalEntries: JournalEntry[], sessions: Session[]): Promise<Blob>
  exportMarkdown(journalEntries: JournalEntry[], sessions: Session[]): Promise<Blob>
  exportCSV(journalEntries: JournalEntry[], sessions: Session[]): Promise<Blob>
  getHistory(limit?: number): Promise<ExportRecord[]>
  clearHistory(): Promise<void>
  download(result: ExportResult): Promise<void>
}
```

## Data Types

### Journal Entry

```typescript
interface JournalEntry {
  id: string
  userId: string
  productId: ProductContext
  timestamp: string
  type: JournalEntryType
  title: string
  content: string
  mood?: MoodIndicator
  tags: string[]
  isPublic: boolean
  isPlayerVisible: boolean
  sessionId: string
  relatedEvents?: string[]
  aiGenerated?: boolean
  updatedAt?: string
}
```

### Session

```typescript
interface Session {
  id: string
  userId: string
  productId: ProductContext
  startTime: string
  endTime?: string
  duration?: number
  source: SessionSource
  status: SessionStatus
  eventsCount: number
  featuresUsed: string[]
  context?: Record<string, unknown>
}
```

### Reflection Prompt

```typescript
interface ReflectionPrompt {
  id: string
  productId: ProductContext
  category: ReflectionPromptCategory
  prompt: string
  type: ReflectionPromptType
  context?: {
    recentActivity?: string[]
    strugglingConcepts?: string[]
    masteredSkills?: string[]
  }
  suggestedResponses?: string[]
  aiGenerated?: boolean
}
```

## Storage

PersonalLog uses IndexedDB for local storage:

- `PersonalLogJournal` - Journal entries database
- `PersonalLogSessions` - Session tracking database

### Storage Configuration

```typescript
interface StorageConfig {
  maxEntries: number        // Default: 10,000
  maxSessions: number       // Default: 1,000
  retentionDays: number     // Default: 365
  persist: boolean          // Default: true
  quotaBytes: number        // Default: 50MB
}
```

## Export Formats

| Format | Description | Extension | MIME Type |
|--------|-------------|-----------|-----------|
| JSON | Structured data format | .json | application/json |
| Markdown | Human-readable format | .md | text/markdown |
| CSV | Spreadsheet-compatible | .csv | text/csv |
| HTML | Web page format | .html | text/html |
| YAML | Configuration format | .yaml | text/yaml |
| PDF | Printable document | .pdf | application/pdf |

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../../CONTRIBUTING.md)

---

**Built with ❤️ for SuperInstance.AI**
