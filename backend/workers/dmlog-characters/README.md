# @studylog/dmlog-characters

**DMLoG.AI Agent 2/3** - Character Persistence & State Management

Cross-product character persistence system for DMLoG.AI (TTRPG) and StudyLoG.AI (education) with full memory integration, undo/redo support, and JSON portability.

## Features

- **Full CRUD Operations** - Create, read, update, delete characters with D1 database
- **Memory Integration** - Links to hierarchical memory system for learning NPCs
- **State Synchronization** - Real-time sync across sessions with conflict resolution
- **Undo/Redo** - Complete history tracking with branching support
- **Cross-Product Support** - Characters work in both DMLoG and StudyLoG
- **JSON Export/Import** - Portable character format for sharing and backup

## Installation

```bash
pnpm install @studylog/dmlog-characters
```

## Quick Start

```typescript
import { CharacterStore, StateManager, HistoryTracker } from '@studylog/dmlog-characters';

// Initialize with D1 binding
const db = env.DB; // Cloudflare Worker D1 binding
const store = new CharacterStore(db);
const stateManager = new StateManager(db);
const history = new HistoryTracker(db);

// Create a character
const character = await store.create({
  userId: 'user_123',
  productDomain: 'dmlog',
  characterType: 'player',
  name: 'Aeliana',
  characterClass: 'Ranger',
  description: 'A skilled elven ranger from the northern forests',
  personality: { bravery: 0.8, curiosity: 0.9 },
  backstory: 'Grew up in the ancient Redwood Forest...',
  goals: ['Protect the innocent', 'Find her lost brother'],
  level: 3,
  hp: 27,
  maxHp: 27,
});

// Add XP
await store.addXp(character.id, 'user_123', 150);

// Store a memory
await store.storeMemory(character.id, 'user_123', 'Defeated the goblin chieftain', {
  importance: 7.0,
  emotionalValence: 0.5,
  tags: ['combat', 'achievement'],
});

// Export to JSON
const exported = await store.export(character.id, 'user_123', {
  includeMemories: true,
  includeHistory: true,
});

// Import from JSON
const imported = await store.import(jsonData, {
  userId: 'user_456',
  productDomain: 'dmlog',
  generateNewId: true,
});
```

## API Reference

### CharacterStore

Main database operations for characters.

```typescript
const store = new CharacterStore(db);

// Create
const character = await store.create(input);

// Read
const character = await store.get(id, userId);
const characters = await store.list({ userId, characterType: 'player' });

// Update
const updated = await store.update(id, userId, { hp: 15, level: 4 });

// Delete
await store.delete(id, userId);

// XP and HP helpers
await store.addXp(id, userId, 100);
await store.modifyHp(id, userId, -5);

// Fork (copy) a character
const fork = await store.fork(id, newUserId, newName);
```

### StateManager

Real-time state synchronization across sessions.

```typescript
const stateManager = new StateManager(db, {
  enableCache: true,
  cacheSize: 100,
  defaultConflictResolution: ConflictResolution.LAST_WRITE_WINS,
});

// Get state (with caching)
const state = await stateManager.getState(characterId, userId, {
  sessionId: 'session_123',
});

// Apply changes with conflict resolution
const updated = await stateManager.applyState(characterId, userId, changes, {
  conflictResolution: ConflictResolution.MERGE,
});

// Sync across sessions
const synced = await stateManager.syncState(characterId, userId, sessionId);

// Create snapshot for rollback
const snapshot = await stateManager.createSnapshot(characterId, userId);
```

### HistoryTracker

Undo/redo and change tracking.

```typescript
const history = new HistoryTracker(db, {
  maxEntries: 1000,
  maxUndoDepth: 50,
  enableBranching: true,
});

// Track changes
await history.trackChange(characterId, userId, HistoryEntryType.UPDATE, previous, new);

// Undo last change
const undone = await history.undo(characterId, userId);

// Redo undone change
const redone = await history.redo(characterId, userId);

// Get diff between versions
const diff = await history.diff(characterId, 5, 10);

// Time travel - get state at version
const pastState = await history.getStateAtVersion(characterId, 5);

// Create history branch
const branch = await history.createBranch(characterId, userId, 'experiment', 10);
```

### Export/Import

JSON portability for sharing and backup.

```typescript
import { CharacterExportImport } from '@studylog/dmlog-characters';

const exim = new CharacterExportImport(db);

// Export character
const { data: jsonData } = await exim.export(characterId, userId, {
  includeMemories: true,
  includeHistory: true,
  targetProduct: 'dmlog',
  encrypt: false,
});

// Import character
const result = await exim.import(jsonData, {
  userId: 'new_user',
  productDomain: 'studylog',
  generateNewId: true,
  importMemories: true,
});

// Create template
const template = await exim.createTemplate(characterId, userId, {
  name: 'Ranger Template',
  description: 'A balanced ranger character',
  isPublic: true,
});

// Create from template
const fromTemplate = await exim.createFromTemplate(
  templateId,
  userId,
  { name: 'Elandra', productDomain: 'dmlog', characterType: 'player' }
);
```

## Character Types

Supports multiple character types across products:

| Type | Domain | Description |
|------|--------|-------------|
| `player` | dmlog | Player character |
| `npc` | dmlog | Non-player character |
| `dm_agent` | dmlog | AI Dungeon Master |
| `tutor` | studylog | AI Tutor |
| `student` | studylog | Student avatar |
| `generic` | shared | Cross-product character |

## Database Schema

See `schema.sql` for the complete D1 database schema including:

- `characters` - Main character storage
- `character_memories` - Hierarchical memory links
- `character_history` - Change tracking for undo/redo
- `character_snapshots` - Time travel points
- `character_history_branches` - Branching history
- `character_conflicts` - Unresolved merge conflicts
- `session_sync_events` - Real-time sync state
- `campaigns` - DMLoG campaign metadata
- `campaign_members` - Characters in campaigns

## Memory Integration

Characters integrate with the hierarchical memory system:

```typescript
// Store memory linked to character
await store.storeMemory(character.id, userId, 'Defeated the dragon', {
  importance: 9.0,
  emotionalValence: 0.8,
  memoryType: 'episodic',
  tags: ['combat', 'achievement', 'dragon'],
});

// Retrieve character memories
const memories = await store.getMemories(character.id, userId, {
  limit: 50,
  minImportance: 5.0,
  memoryType: 'episodic',
});
```

## Cross-Product Conversion

Convert characters between products:

```typescript
// StudyLoG student -> DMLoG character
const dmlogCharacter = stateManager.translateState(studylogChar, 'dmlog');

// DMLoG character -> StudyLoG student
const studylogStudent = stateManager.translateState(dmlogChar, 'studylog');
```

## License

MIT

## Author

SuperInstance.AI
