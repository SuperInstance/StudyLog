/**
 * Chat Module - Chat Interface System
 *
 * Exports all chat-related functionality:
 * - MessageStore: Persistent message history with branching
 * - ChatService: Main chat interface with vibe/spec modes
 * - StreamProcessor: SSE streaming for responses
 * - ContextWindowManager: Token budget management
 */

export * from './message-store.js';
export * from './streaming.js';
export * from './chat-service.js';

// Re-export commonly used types
export type {
  ChatMessage,
  ChatSession,
  ChatMode,
  ContextFile,
  StreamChunk,
} from '../types/index.js';
