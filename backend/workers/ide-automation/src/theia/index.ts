/**
 * Theia Module - Theia Integration
 *
 * Exports all Theia IDE integration functionality:
 * - WebSocketBridge: Real-time bidirectional communication
 * - CommandRegistry: Command palette integration
 * - Panel widgets and inline diff rendering
 */

export * from './websocket-bridge.js';
export * from './command-palette.js';

// Re-export commonly used types
export type {
  WSMessage,
  WSMessageType,
  Command,
  CommandResult,
  CommandAction,
  PanelWidget,
  InlineDiffOptions,
} from '../types/index.js';
