/**
 * Personal Log - Session Module
 *
 * Session tracking for SuperInstance products
 */

// Types
export type {
  Session,
  SessionId,
  ProductId,
  SessionSource,
  SessionStatus,
  SessionStats,
  SessionMetadata,
  SessionStartData,
  SessionEndData,
  SessionHeartbeatData,
  SessionDurationInsight,
  SessionActivityInsight,
  CrossProductInsight,
  SessionConfig,
  ActivityHandler,
} from './types'

// Helper functions
export {
  createSessionId,
  createCrossProductId,
  isSessionExpired,
  calculateSessionDuration,
} from './types'

// Session manager
export {
  SessionManager,
  getSessionManager,
  initializeSessionManager,
  getCurrentSessionId,
  recordActivity,
  recordFeature,
  endCurrentSession,
} from './manager'
