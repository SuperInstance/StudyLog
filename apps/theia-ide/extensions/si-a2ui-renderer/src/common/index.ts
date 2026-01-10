/**
 * StudyLoG.AI - A2UI Common Types
 *
 * Agent-to-UI Protocol definitions.
 * Agents send JSON manifests to render UI components.
 */

export const A2UI_WIDGET_ID = 'si-a2ui-renderer:widget';
export const A2UI_WIDGET_LABEL = 'Agent UI';

// A2UI Message types
export type A2UIMessageType = 'component' | 'action' | 'state' | 'notification';

// Priority levels
export type A2UIPriority = 'low' | 'normal' | 'urgent';

// Base A2UI message
export interface A2UIMessage {
  id: string;
  type: A2UIMessageType;
  target?: string; // Component ID
  agent: string; // Originating agent
  priority: A2UIPriority;
  timestamp: number;
  payload: A2UIPayload;
}

// Payload types
export type A2UIPayload =
  | A2UIComponentPayload
  | A2UIActionPayload
  | A2UIStatePayload
  | A2UINotificationPayload;

// Component definition
export interface A2UIComponentPayload {
  type: 'component';
  component: A2UIComponent;
}

// Available component types
export type A2UIComponentType =
  | 'text'
  | 'button'
  | 'input'
  | 'select'
  | 'checkbox'
  | 'slider'
  | 'progress'
  | 'list'
  | 'card'
  | 'tabs'
  | 'code'
  | 'markdown'
  | 'image'
  | 'chart'
  | 'container'
  | 'hint'
  | 'dialog'
  | 'toast';

// Component definition
export interface A2UIComponent {
  id: string;
  type: A2UIComponentType;
  props: Record<string, unknown>;
  children?: A2UIComponent[];
  style?: Record<string, string | number>;
  events?: A2UIEventHandler[];
}

// Event handler
export interface A2UIEventHandler {
  event: string; // 'click', 'change', 'submit', etc.
  action: string; // Action ID to send back
  payload?: Record<string, unknown>;
}

// Action from UI to agent
export interface A2UIActionPayload {
  type: 'action';
  action: string;
  data: Record<string, unknown>;
}

// State update
export interface A2UIStatePayload {
  type: 'state';
  path: string; // Dot-notation path
  value: unknown;
}

// Notification
export interface A2UINotificationPayload {
  type: 'notification';
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

// A2UI Context for rendering
export interface A2UIContext {
  agent: string;
  module: string;
  theme: 'light' | 'dark';
  locale: string;
  state: Record<string, unknown>;
}

// Component library manifest
export interface A2UIComponentLibrary {
  version: string;
  components: Record<A2UIComponentType, A2UIComponentDefinition>;
}

export interface A2UIComponentDefinition {
  type: A2UIComponentType;
  description: string;
  props: Record<string, A2UIPropDefinition>;
  events: string[];
}

export interface A2UIPropDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description: string;
}
