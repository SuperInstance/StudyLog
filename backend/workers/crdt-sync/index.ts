/**
 * @file index.ts - Main entry point for CRDT sync system
 * @description Exports all CRDT sync components
 * @module backend/workers/crdt-sync
 */

// ============================================================================
// CORE EXPORTS
// ============================================================================

export * from './types.js';
export * from './crdt-engine.js';
export * from './document-sync.js';
export * from './presence-awareness.js';
export * from './conflict-resolution.js';
export * from './websocket-gateway.js';

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

// Types
export type {
  // Document types
  DocumentOperation,
  DocumentSnapshot,
  ConflictResolution,
  DocumentWithMeta,
  DocumentMeta,
  StudyLoGDocumentMeta,
  DMLoGDocumentMeta,
  BattleMapToken,
  BattleMapState,
  AreaEffect,

  // Presence types
  UserPresence,
  UserCursor,
  UserStatus,
  TypingState,
  CursorPosition,
  SelectionRange,
  PresenceEvent,
  PresenceEventType,
  PresenceConfig,
  PresenceFilter,
  PresenceStats,

  // Sync types
  SyncMessage,
  SyncMessageType,
  SyncHandshake,
  SyncRequest,
  SyncResponse,
  OperationsBatch,
  Acknowledgment,
  SnapshotMessage,
  Heartbeat,
  SyncError,
  CursorMessage,
  PresenceMessage,
  TypingMessage,
  SyncConfig,
  SyncStats,
  ConnectionState,

  // Gateway types
  GatewayConfig,
  GatewayStats,
  DocumentStats,

  // Configuration types
  ActivityTimeouts,
  CompressionType,
  SyncCapabilities,

  // Enums
  ProductType,
  ColorStrategy,
  ResolutionStrategy,
  ConflictType,
  ConflictSeverity
} from './types.js';

// Classes
export {
  // Core CRDT
  CRDTEngine,
  LamportClock,
  VersionVector,

  // Factories
  createCRDTEngine,
  createCRDTGroup,

  // Document sync
  DocumentSyncManager,
  DocumentPersistence,
  InMemoryDocumentPersistence,
  createDocumentSyncManager,
  createDocumentSyncManagerWithPersistence,

  // Presence
  PresenceManager,
  createPresenceManager,
  createProductPresenceManager,

  // Conflict resolution
  ConflictResolver,
  StudyLoGConflictResolver,
  DMLoGConflictResolver,
  createConflictResolver,
  createStudyLoGResolver,
  createDMLoGResolver,

  // WebSocket gateway
  CRDTWebSocketGateway,
  startGateway,
  startGatewayFromEnv
} from './types.js';

// Re-export from modules
export {
  CRDTEngine,
  LamportClock,
  VersionVector,
  createCRDTEngine,
  createCRDTGroup
} from './crdt-engine.js';

export {
  DocumentSyncManager,
  DocumentPersistence,
  InMemoryDocumentPersistence,
  createDocumentSyncManager,
  createDocumentSyncManagerWithPersistence
} from './document-sync.js';

export {
  PresenceManager,
  createPresenceManager,
  createProductPresenceManager
} from './presence-awareness.js';

export {
  ConflictResolver,
  StudyLoGConflictResolver,
  DMLoGConflictResolver,
  createConflictResolver,
  createStudyLoGResolver,
  createDMLoGResolver
} from './conflict-resolution.js';

export {
  CRDTWebSocketGateway,
  startGateway,
  startGatewayFromEnv
} from './websocket-gateway.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export { DEFAULT_SYNC_CONFIG } from './types.js';
export { DEFAULT_PRESENCE_CONFIG } from './types.js';
export { DEFAULT_RESOLUTION_OPTIONS } from './conflict-resolution.js';
export { DEFAULT_GATEWAY_CONFIG } from './websocket-gateway.js';
export { DEFAULT_DOCUMENT_SYNC_CONFIG } from './document-sync.js';
export { DEFAULT_CRDT_CONFIG } from './crdt-engine.js';

// ============================================================================
// PACKAGE.JSON EXPORTS
// ============================================================================

/**
 * CRDT Sync System for Real-Time Collaboration
 *
 * A comprehensive CRDT-based real-time collaboration system for StudyLoG.AI and DMLoG.AI.
 *
 * @example
 * ```typescript
 * import { startGatewayFromEnv } from '@studylog/crdt-sync';
 *
 * // Start the WebSocket gateway
 * const gateway = startGatewayFromEnv();
 * ```
 *
 * @example
 * ```typescript
 * import { CRDTWebSocketGateway } from '@studylog/crdt-sync';
 *
 * // Create a custom gateway
 * const gateway = new CRDTWebSocketGateway({
 *   port: 8080,
 *   host: '0.0.0.0',
 *   maxConnections: 100
 * });
 * ```
 */
export const PACKAGE_NAME = '@studylog/crdt-sync';
export const PACKAGE_VERSION = '1.0.0';

/**
 * Create a complete CRDT sync system
 *
 * This factory function creates all necessary components
 * for a complete CRDT sync deployment.
 *
 * @param config - Optional configuration
 * @returns Object containing all sync components
 */
export function createCRDTSyncSystem(config?: {
  gateway?: Partial<ImportMeta<typeof './websocket-gateway.js'>>;
  presence?: Partial<ImportMeta<typeof './presence-awareness.js'>>;
  conflict?: Partial<ImportMeta<typeof './conflict-resolution.ts'>>;
}) {
  const gateway = config?.gateway
    ? new CRDTWebSocketGateway(config.gateway)
    : startGatewayFromEnv();

  return {
    gateway,
    documentSync: gateway['documentSync'],
    presence: gateway['presence'],
    conflictResolver: gateway['conflictResolver']
  };
}
