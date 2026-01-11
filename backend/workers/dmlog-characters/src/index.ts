/**
 * DMLoG.AI - Character Persistence System
 *
 * Cross-product character storage with:
 * - Full CRUD operations
 * - Memory integration
 * - State synchronization
 * - Undo/redo support
 * - JSON export/import
 *
 * @packageDocumentation
 */

// Version info
export const VERSION = '0.1.0';
export const PACKAGE_NAME = '@studylog/dmlog-characters';

// Core exports
export {
  CharacterStore,
  CharacterType,
  ProductDomain,
  Alignment,
  CharacterRecord,
  CharacterInput,
  CharacterQuery,
  CharacterStoreResult,
  CharacterListResult,
} from './core/character-store.js';

export {
  StateManager,
  ConflictResolution,
  StateDelta,
  VectorClockEntry,
  StateSnapshot,
  SyncStatus,
  StateSyncOptions,
  StateManagerConfig,
} from './core/state-manager.js';

export {
  HistoryTracker,
  HistoryEntryType,
  FieldChange,
  HistoryEntry,
  CharacterDiff,
  HistoryBranch,
  TimeTravelSnapshot,
  HistoryTrackerOptions,
  UndoResult,
  RedoResult,
} from './core/history-tracker.js';

export {
  CharacterExportImport,
  ExportOptions,
  ImportOptions,
  CharacterExport,
  ImportResult,
  EXPORT_FORMAT_VERSION,
} from './utils/export-import.js';

// Re-export types
export type {
  CharacterRecord as ICharacterRecord,
  CharacterInput as ICharacterInput,
  CharacterQuery as ICharacterQuery,
  StateDelta as IStateDelta,
  StateSnapshot as IStateSnapshot,
  SyncStatus as ISyncStatus,
  HistoryEntry as IHistoryEntry,
  CharacterDiff as ICharacterDiff,
  HistoryBranch as IHistoryBranch,
  TimeTravelSnapshot as ITimeTravelSnapshot,
  CharacterExport as ICharacterExport,
  ImportResult as IImportResult,
} from './core/character-store.js';
