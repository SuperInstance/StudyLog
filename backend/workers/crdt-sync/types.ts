/**
 * @file types.ts - Type definitions for CRDT sync system
 * @description Core types for document operations, presence, and sync protocol
 * @module backend/workers/crdt-sync/types
 */

// ============================================================================
// DOCUMENT OPERATION TYPES
// ============================================================================

/**
 * Document operation types
 */
export type OperationType = 'insert' | 'delete' | 'replace';

/**
 * Represents an operation on a CRDT document
 */
export interface DocumentOperation {
  /** Unique ID for this operation */
  id: string;
  /** User who performed the operation */
  userId: string;
  /** Type of operation */
  type: OperationType;
  /** Position in the document (character offset) */
  position: number;
  /** Length of affected text */
  length: number;
  /** Text being inserted (for insert/replace) */
  text?: string;
  /** Timestamp of operation (milliseconds since epoch) */
  timestamp: number;
  /** Logical clock value (Lamport clock) */
  clock: number;
  /** Replica ID that created this operation */
  replicaId: string;
}

/**
 * Document state snapshot
 */
export interface DocumentSnapshot {
  /** Document content */
  content: string;
  /** Current version (Lamport clock) */
  version: number;
  /** List of operations that led to this state */
  operations: DocumentOperation[];
  /** Users currently editing */
  activeUsers: string[];
  /** Snapshot creation timestamp */
  createdAt: number;
}

/**
 * Conflict resolution result
 */
export interface ConflictResolution {
  /** Original content before merge */
  before: string;
  /** Merged content after conflict resolution */
  after: string;
  /** Operations that were applied */
  applied: DocumentOperation[];
  /** Operations that were rejected (conflicting) */
  rejected: DocumentOperation[];
  /** Number of conflicts resolved */
  conflictCount: number;
}

// ============================================================================
// PRESENCE TYPES
// ============================================================================

/**
 * User connection status
 */
export enum UserStatus {
  /** User is actively connected and working */
  ONLINE = 'online',
  /** User is connected but inactive for a period */
  IDLE = 'idle',
  /** User has disconnected */
  OFFLINE = 'offline',
  /** User is in a do-not-disturb mode */
  BUSY = 'busy'
}

/**
 * Typing state for collaborative editing
 */
export interface TypingState {
  /** Whether the user is currently typing */
  isTyping: boolean;
  /** Timestamp when typing started */
  startTime: number;
  /** Optional: partial text length (not actual text for privacy) */
  partialLength?: number;
}

/**
 * Cursor position in a document
 */
export interface CursorPosition {
  /** Zero-based line number */
  line: number;
  /** Zero-based column character offset */
  column: number;
}

/**
 * Text selection range
 */
export interface SelectionRange {
  /** Start position of selection */
  start: CursorPosition;
  /** End position of selection */
  end: CursorPosition;
}

/**
 * User cursor information
 */
export interface UserCursor {
  /** User's unique identifier */
  userId: string;
  /** User's display name */
  userName: string;
  /** Current cursor position */
  position: CursorPosition;
  /** Optional selection range */
  selection?: SelectionRange;
  /** Color for cursor highlighting (hex format) */
  color: string;
  /** Timestamp of last cursor update */
  timestamp: number;
}

/**
 * Presence information for a user
 */
export interface UserPresence {
  /** User's unique identifier */
  userId: string;
  /** User's display name */
  userName: string;
  /** Current connection status */
  status: UserStatus;
  /** User's current cursor (if online/idle) */
  cursor?: UserCursor;
  /** Typing state */
  typing?: TypingState;
  /** Current document/room being edited */
  documentId?: string;
  /** Timestamp of last activity */
  lastActivity: number;
  /** User's avatar URL (optional) */
  avatar?: string;
}

/**
 * Presence event types
 */
export enum PresenceEventType {
  /** User came online */
  USER_JOINED = 'user_joined',
  /** User went offline */
  USER_LEFT = 'user_left',
  /** User status changed */
  STATUS_CHANGED = 'status_changed',
  /** User cursor moved */
  CURSOR_MOVED = 'cursor_moved',
  /** User selection changed */
  SELECTION_CHANGED = 'selection_changed',
  /** User started/stopped typing */
  TYPING_CHANGED = 'typing_changed',
  /** User switched documents */
  DOCUMENT_CHANGED = 'document_changed'
}

/**
 * Presence update event
 */
export interface PresenceEvent {
  /** Event type */
  type: PresenceEventType;
  /** User ID for whom event occurred */
  userId: string;
  /** Updated presence information */
  presence: UserPresence;
  /** Event timestamp */
  timestamp: number;
}

// ============================================================================
// SYNC PROTOCOL TYPES
// ============================================================================

/**
 * Sync message types for the protocol
 */
export enum SyncMessageType {
  /** Initial handshake to establish sync session */
  HANDSHAKE = 'handshake',
  /** Request for missing operations since a version */
  SYNC_REQUEST = 'sync_request',
  /** Response with operations since requested version */
  SYNC_RESPONSE = 'sync_response',
  /** Batch of operations being sent */
  OPERATIONS = 'operations',
  /** Acknowledgment of received operations */
  ACKNOWLEDGMENT = 'acknowledgment',
  /** Full state snapshot (for recovery or initial sync) */
  SNAPSHOT = 'snapshot',
  /** Heartbeat to keep connection alive */
  HEARTBEAT = 'heartbeat',
  /** Error message */
  ERROR = 'error',
  /** Cursor update */
  CURSOR = 'cursor',
  /** Presence update */
  PRESENCE = 'presence',
  /** Typing indicator */
  TYPING = 'typing'
}

/**
 * Sync protocol version
 */
export const SYNC_PROTOCOL_VERSION = '1.0.0';

/**
 * Compression types
 */
export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  DELTA = 'delta'
}

/**
 * Sync handshake message
 */
export interface SyncHandshake {
  type: SyncMessageType.HANDSHAKE;
  protocolVersion: string;
  replicaId: string;
  userId: string;
  userName: string;
  documentId: string;
  currentVersion: number;
  supportedCompression: CompressionType[];
  capabilities: SyncCapabilities;
  timestamp: number;
}

/**
 * Capabilities negotiation
 */
export interface SyncCapabilities {
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Supports incremental sync */
  supportsIncremental: boolean;
  /** Supports compression */
  supportsCompression: boolean;
  /** Supports delta encoding */
  supportsDeltaEncoding: boolean;
  /** Maximum batch size for operations */
  maxBatchSize: number;
}

/**
 * Sync request for operations since a version
 */
export interface SyncRequest {
  type: SyncMessageType.SYNC_REQUEST;
  replicaId: string;
  fromVersion: number;
  toVersion?: number;
  requestedOperations?: string[];
}

/**
 * Sync response with operations
 */
export interface SyncResponse {
  type: SyncMessageType.SYNC_RESPONSE;
  replicaId: string;
  fromVersion: number;
  toVersion: number;
  operations: DocumentOperation[];
  compression?: CompressionType;
  compressedSize?: number;
  uncompressedSize?: number;
}

/**
 * Operations batch message
 */
export interface OperationsBatch {
  type: SyncMessageType.OPERATIONS;
  replicaId: string;
  documentId: string;
  operations: DocumentOperation[];
  compression?: CompressionType;
  sequenceNumber: number;
  totalBatches: number;
}

/**
 * Acknowledgment message
 */
export interface Acknowledgment {
  type: SyncMessageType.ACKNOWLEDGMENT;
  replicaId: string;
  acknowledgedVersions: number[];
  acknowledgedOperations?: string[];
  sequenceNumber?: number;
}

/**
 * Snapshot message
 */
export interface SnapshotMessage {
  type: SyncMessageType.SNAPSHOT;
  replicaId: string;
  documentId: string;
  snapshot: DocumentSnapshot;
  compression?: CompressionType;
}

/**
 * Heartbeat message
 */
export interface Heartbeat {
  type: SyncMessageType.HEARTBEAT;
  replicaId: string;
  timestamp: number;
  currentVersion: number;
}

/**
 * Error message
 */
export interface SyncError {
  type: SyncMessageType.ERROR;
  replicaId: string;
  errorCode: SyncErrorCode;
  errorMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Error codes
 */
export enum SyncErrorCode {
  VERSION_NOT_AVAILABLE = 'version_not_available',
  INVALID_MESSAGE = 'invalid_message',
  COMPRESSION_NOT_SUPPORTED = 'compression_not_supported',
  MESSAGE_TOO_LARGE = 'message_too_large',
  OPERATION_REJECTED = 'operation_rejected',
  SYNC_TIMEOUT = 'sync_timeout',
  PROTOCOL_MISMATCH = 'protocol_mismatch',
  DOCUMENT_NOT_FOUND = 'document_not_found',
  ACCESS_DENIED = 'access_denied'
}

/**
 * Cursor update message
 */
export interface CursorMessage {
  type: SyncMessageType.CURSOR;
  userId: string;
  userName: string;
  documentId: string;
  cursor: UserCursor;
}

/**
 * Presence update message
 */
export interface PresenceMessage {
  type: SyncMessageType.PRESENCE;
  presence: UserPresence;
}

/**
 * Typing indicator message
 */
export interface TypingMessage {
  type: SyncMessageType.TYPING;
  userId: string;
  documentId: string;
  isTyping: boolean;
  partialLength?: number;
}

/**
 * Union type for all sync messages
 */
export type SyncMessage =
  | SyncHandshake
  | SyncRequest
  | SyncResponse
  | OperationsBatch
  | Acknowledgment
  | SnapshotMessage
  | Heartbeat
  | SyncError
  | CursorMessage
  | PresenceMessage
  | TypingMessage;

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Activity timeout configuration
 */
export interface ActivityTimeouts {
  /** Milliseconds of inactivity before marking user as idle */
  idleTimeout: number;
  /** Milliseconds of inactivity before marking user as offline */
  offlineTimeout: number;
  /** Milliseconds to clear typing indicator after inactivity */
  typingTimeout: number;
}

/**
 * Default timeout values
 */
export const DEFAULT_TIMEOUTS: ActivityTimeouts = {
  idleTimeout: 2 * 60 * 1000,      // 2 minutes
  offlineTimeout: 5 * 60 * 1000,   // 5 minutes
  typingTimeout: 3 * 1000          // 3 seconds
};

/**
 * Sync configuration
 */
export interface SyncConfig {
  /** Enable compression */
  enableCompression: boolean;
  /** Preferred compression type */
  preferredCompression: CompressionType;
  /** Maximum message size in bytes */
  maxMessageSize: number;
  /** Sync timeout in milliseconds */
  syncTimeout: number;
  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Enable delta encoding */
  enableDeltaEncoding: boolean;
  /** Batch size for operations */
  operationBatchSize: number;
  /** Snapshot interval in milliseconds */
  snapshotInterval: number;
  /** Maximum operations in log before compaction */
  maxOperationLogSize: number;
}

/**
 * Default sync configuration
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enableCompression: true,
  preferredCompression: CompressionType.GZIP,
  maxMessageSize: 1024 * 1024,    // 1MB
  syncTimeout: 30000,             // 30 seconds
  heartbeatInterval: 10000,       // 10 seconds
  maxRetries: 3,
  enableDeltaEncoding: true,
  operationBatchSize: 100,
  snapshotInterval: 60000,        // 1 minute
  maxOperationLogSize: 1000
};

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  /** WebSocket port */
  port: number;
  /** Host to bind to */
  host?: string;
  /** Path for WebSocket route */
  path?: string;
  /** Sync configuration */
  sync: SyncConfig;
  /** Activity timeouts */
  timeouts: ActivityTimeouts;
  /** Maximum concurrent connections */
  maxConnections?: number;
  /** Enable per-message compression */
  enablePerMessageDeflate?: boolean;
}

/**
 * Presence manager configuration
 */
export interface PresenceConfig {
  /** Activity timeout thresholds */
  timeouts: ActivityTimeouts;
  /** Whether to broadcast cursor updates */
  enableCursors: boolean;
  /** Whether to broadcast typing indicators */
  enableTyping: boolean;
  /** Maximum number of users to track */
  maxUsers: number;
  /** Color palette for automatic cursor color assignment */
  colorPalette: string[];
}

/**
 * Default presence configuration
 */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  timeouts: DEFAULT_TIMEOUTS,
  enableCursors: true,
  enableTyping: true,
  maxUsers: 100,
  colorPalette: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F8B739', '#52C7B8', '#FF7675', '#74B9FF'
  ]
};

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Sync statistics
 */
export interface SyncStats {
  /** Total bytes sent */
  bytesSent: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Total operations synced */
  operationsSynced: number;
  /** Number of sync cycles */
  syncCycles: number;
  /** Average compression ratio */
  compressionRatio: number;
  /** Number of conflicts resolved */
  conflictsResolved: number;
  /** Number of errors */
  errors: number;
  /** Last sync timestamp */
  lastSyncTime: number;
}

/**
 * Connection state
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  ERROR = 'error'
}

/**
 * Gateway statistics
 */
export interface GatewayStats {
  /** Current number of connected clients */
  connectedClients: number;
  /** Total number of documents */
  documentCount: number;
  /** Total operations processed */
  totalOperations: number;
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Active sync sessions */
  activeSyncSessions: number;
  /** Uptime in milliseconds */
  uptime: number;
}

/**
 * Document statistics
 */
export interface DocumentStats {
  /** Document ID */
  documentId: string;
  /** Current version */
  version: number;
  /** Content length */
  contentLength: number;
  /** Number of operations in log */
  operationCount: number;
  /** Active users */
  activeUsers: number;
  /** Last modified timestamp */
  lastModified: number;
}

/**
 * Presence statistics
 */
export interface PresenceStats {
  /** Total number of tracked users */
  totalUsers: number;
  /** Number of users currently online */
  onlineCount: number;
  /** Number of users currently idle */
  idleCount: number;
  /** Number of users currently typing */
  typingCount: number;
  /** Average activity time (milliseconds) */
  averageActivityTime: number;
  /** Most active document ID */
  mostActiveDocument?: string;
}

// ============================================================================
// PRODUCT-SPECIFIC TYPES (StudyLoG.AI & DMLoG.AI)
// ============================================================================

/**
 * Document metadata for StudyLoG.AI
 */
export interface StudyLoGDocumentMeta {
  /** Project ID */
  projectId: string;
  /** Session ID */
  sessionId?: string;
  /** Programming language */
  language?: string;
  /** File path (if code file) */
  filePath?: string;
  /** Is this a tutorial document? */
  isTutorial?: boolean;
  /** AI tutor ID (if applicable) */
  tutorId?: string;
}

/**
 * Document metadata for DMLoG.AI
 */
export interface DMLoGDocumentMeta {
  /** Campaign ID */
  campaignId: string;
  /** Session ID */
  sessionId?: string;
  /** Document type (notes, battlemap, character_sheet, etc.) */
  documentType: 'notes' | 'battlemap' | 'character_sheet' | 'campaign_log' | 'reference';
  /** Is this DM-only content? */
  dmOnly?: boolean;
  /** Associated character IDs */
  characterIds?: string[];
}

/**
 * Battle map token for DMLoG.AI
 */
export interface BattleMapToken {
  /** Token ID */
  id: string;
  /** Character/NPC ID */
  characterId: string;
  /** Token name */
  name: string;
  /** Grid position */
  position: { x: number; y: number };
  /** User who last moved the token */
  lastMovedBy: string;
  /** Token color */
  color: string;
  /** Token size (in grid cells) */
  size: number;
  /** Is token hidden from players? */
  isHidden: boolean;
}

/**
 * Battle map state for DMLoG.AI
 */
export interface BattleMapState {
  /** Map ID */
  id: string;
  /** Session ID */
  sessionId: string;
  /** Grid width */
  width: number;
  /** Grid height */
  height: number;
  /** Tokens by ID */
  tokens: Map<string, BattleMapToken>;
  /** Terrain grid */
  terrain: string[][];
  /** Active effects */
  effects: AreaEffect[];
  /** Current turn order */
  turnOrder: string[];
  /** Current turn index */
  currentTurnIndex: number;
}

/**
 * Area effect on battle map
 */
export interface AreaEffect {
  /** Effect ID */
  id: string;
  /** Effect type (fire, fog, web, etc.) */
  type: string;
  /** Affected area */
  area: { x: number; y: number; width: number; height: number };
  /** Duration in rounds */
  duration: number;
  /** Remaining rounds */
  remainingRounds: number;
  /** Creator user ID */
  createdBy: string;
}

/**
 * Product type
 */
export enum ProductType {
  STUDYLOG = 'studylog',
  DMLOG = 'dmlog'
}

/**
 * Document metadata (union type)
 */
export type DocumentMeta = StudyLoGDocumentMeta | DMLoGDocumentMeta;

/**
 * Document with metadata
 */
export interface DocumentWithMeta {
  /** Document ID */
  id: string;
  /** Product type */
  product: ProductType;
  /** Document content */
  content: string;
  /** Current version */
  version: number;
  /** Created timestamp */
  createdAt: number;
  /** Updated timestamp */
  updatedAt: number;
  /** Product-specific metadata */
  metadata: DocumentMeta;
  /** Active users */
  activeUsers: string[];
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Color assignment strategy
 */
export enum ColorStrategy {
  /** Assign colors sequentially from palette */
  SEQUENTIAL = 'sequential',
  /** Assign colors randomly */
  RANDOM = 'random',
  /** Hash-based consistent assignment */
  HASHED = 'hashed'
}

/**
 * Filter options for querying presence
 */
export interface PresenceFilter {
  /** Filter by user status */
  status?: UserStatus;
  /** Filter by document ID */
  documentId?: string;
  /** Include only users with cursors in specified range */
  cursorInLine?: number;
  /** Include only typing users */
  onlyTyping?: boolean;
}

/**
 * Presence observer callback type
 */
export type PresenceObserver = (event: PresenceEvent) => void;

/**
 * Message handler callback type
 */
export type MessageHandler = (message: SyncMessage) => void | Promise<void>;

/**
 * Operation callback type
 */
export type OperationCallback = (operation: DocumentOperation) => void;

/**
 * Error callback type
 */
export type ErrorCallback = (error: Error) => void;
