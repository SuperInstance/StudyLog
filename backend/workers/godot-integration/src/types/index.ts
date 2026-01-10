/**
 * Type definitions for StudyLoG.AI Godot Integration
 *
 * This module provides TypeScript type definitions for:
 * - Theia-Godot communication protocol
 * - Plugin system
 * - GDScript patterns
 * - Custom nodes
 * - Educational content
 */

// ============================================================================
// Core Message Protocol
// ============================================================================

/**
 * Base message type for Theia-Godot communication
 */
export interface BaseMessage {
  type: string;
  timestamp?: number;
  id?: string;
}

// ============================================================================
// Theia to Godot Messages
// ============================================================================

export interface PingMessage extends BaseMessage {
  type: "ping";
}

export interface GetSceneTreeMessage extends BaseMessage {
  type: "get_scene_tree";
}

export interface SpawnAgentMessage extends BaseMessage {
  type: "spawn_agent";
  agent_type: string;
  position: Vector3D;
  config?: Record<string, unknown>;
}

export interface DespawnAgentMessage extends BaseMessage {
  type: "despawn_agent";
  agent_id: string;
}

export interface GetAgentStateMessage extends BaseMessage {
  type: "get_agent_state";
  agent_id: string;
}

export interface SetAgentBehaviorMessage extends BaseMessage {
  type: "set_agent_behavior";
  agent_id: string;
  behavior: string;
  params?: Record<string, unknown>;
}

export interface LoadSceneMessage extends BaseMessage {
  type: "load_scene";
  path: string;
}

export interface SaveSceneMessage extends BaseMessage {
  type: "save_scene";
  path: string;
}

export interface RPCMessage extends BaseMessage {
  type: "rpc";
  method: string;
  params: unknown[];
  node_path?: string;
}

export interface SubscribeEventsMessage extends BaseMessage {
  type: "subscribe_events";
  events: string[];
}

export interface UnsubscribeEventsMessage extends BaseMessage {
  type: "unsubscribe_events";
  events: string[];
}

export interface UpdateSharedStateMessage extends BaseMessage {
  type: "update_shared_state";
  key: string;
  value: unknown;
}

export interface LoadAssetBundleMessage extends BaseMessage {
  type: "load_asset_bundle";
  bundle_id: string;
}

export interface StartLessonMessage extends BaseMessage {
  type: "start_lesson";
  lesson_id: string;
}

export interface SubmitExerciseMessage extends BaseMessage {
  type: "submit_exercise";
  exercise_id: string;
  answer: unknown;
}

export interface GetHintMessage extends BaseMessage {
  type: "get_hint";
  exercise_id: string;
  hint_level?: number;
}

export type TheiaToGodotMessage =
  | PingMessage
  | GetSceneTreeMessage
  | SpawnAgentMessage
  | DespawnAgentMessage
  | GetAgentStateMessage
  | SetAgentBehaviorMessage
  | LoadSceneMessage
  | SaveSceneMessage
  | RPCMessage
  | SubscribeEventsMessage
  | UnsubscribeEventsMessage
  | UpdateSharedStateMessage
  | LoadAssetBundleMessage
  | StartLessonMessage
  | SubmitExerciseMessage
  | GetHintMessage;

// ============================================================================
// Godot to Theia Messages
// ============================================================================

export interface PongMessage extends BaseMessage {
  type: "pong";
}

export interface SceneTreeMessage extends BaseMessage {
  type: "scene_tree";
  data: SceneTreeNode;
}

export interface AgentSpawnedMessage extends BaseMessage {
  type: "agent_spawned";
  agent_id: string;
  agent_type: string;
  position: Vector3D;
}

export interface AgentDespawnedMessage extends BaseMessage {
  type: "agent_despawned";
  agent_id: string;
}

export interface AgentUpdateMessage extends BaseMessage {
  type: "agent_update";
  agent_id: string;
  position: Vector3D;
  state: string;
  rotation?: Vector3D;
}

export interface AgentStatesBatchMessage extends BaseMessage {
  type: "agent_states_batch";
  states: AgentState[];
  timestamp: number;
}

export interface SceneLoadedMessage extends BaseMessage {
  type: "scene_loaded";
  path: string;
  success: boolean;
  error?: string;
}

export interface RPCResponseMessage extends BaseMessage {
  type: "rpc_response";
  request_id: string;
  result?: unknown;
  error?: string;
}

export interface EventMessage extends BaseMessage {
  type: "event";
  event_name: string;
  data: Record<string, unknown>;
}

export interface SharedStateUpdateMessage extends BaseMessage {
  type: "shared_state_update";
  key: string;
  value: unknown;
}

export interface AssetBundleLoadedMessage extends BaseMessage {
  type: "asset_bundle_loaded";
  bundle_id: string;
  success: boolean;
  assets?: string[];
  error?: string;
}

export interface LessonStartedMessage extends BaseMessage {
  type: "lesson_started";
  lesson_id: string;
  title: string;
  objectives: string[];
}

export interface ExerciseCompletedMessage extends BaseMessage {
  type: "exercise_completed";
  exercise_id: string;
  success: boolean;
  feedback?: string;
  next_exercise?: string;
}

export interface HintMessage extends BaseMessage {
  type: "hint";
  exercise_id: string;
  hint_level: number;
  hint: string;
  remaining_hints?: number;
}

export interface AchievementUnlockedMessage extends BaseMessage {
  type: "achievement_unlocked";
  achievement_id: string;
  title: string;
  description: string;
  icon?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export interface ProgressUpdateMessage extends BaseMessage {
  type: "progress_update";
  stage: "cognitive_mill" | "intelligence_ranch" | "sitka_sound" | "digital_twins";
  progress: number;
  unlocked_features: string[];
}

export type GodotToTheiaMessage =
  | PongMessage
  | SceneTreeMessage
  | AgentSpawnedMessage
  | AgentDespawnedMessage
  | AgentUpdateMessage
  | AgentStatesBatchMessage
  | SceneLoadedMessage
  | RPCResponseMessage
  | EventMessage
  | SharedStateUpdateMessage
  | AssetBundleLoadedMessage
  | LessonStartedMessage
  | ExerciseCompletedMessage
  | HintMessage
  | AchievementUnlockedMessage
  | ProgressUpdateMessage;

// ============================================================================
// Common Types
// ============================================================================

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface SceneTreeNode {
  name: string;
  type: string;
  children?: SceneTreeNode[];
}

export interface AgentState {
  agent_id: string;
  type: string;
  position: Vector3D;
  rotation?: Vector3D;
}

// ============================================================================
// Plugin System Types
// ============================================================================

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  studylog_stage?: "cognitive_mill" | "intelligence_ranch" | "sitka_sound" | "digital_twins";
  dependencies?: string[];
  permissions?: PluginPermission[];
}

export type PluginPermission =
  | "network"
  | "filesystem"
  | "scene_access"
  | "agent_control"
  | "shader_access"
  | "content_modification";

export interface PluginContext {
  bridge: TheiaBridgeInterface;
  registerNode: (nodeType: string, nodeClass: string) => void;
  registerShader: (shaderName: string, shaderPath: string) => void;
  subscribeEvent: (eventName: string, callback: EventCallback) => void;
  getState: (key: string) => unknown;
  setState: (key: string, value: unknown) => void;
  getLogger: (pluginId: string) => PluginLogger;
}

export interface TheiaBridgeInterface {
  send: (message: TheiaToGodotMessage) => void;
  on: (event: string, callback: EventCallback) => void;
  off: (event: string, callback: EventCallback) => void;
  rpc: (method: string, ...params: unknown[]) => Promise<unknown>;
}

export type EventCallback = (data: Record<string, unknown>) => void;

export interface PluginLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export interface Plugin {
  metadata: PluginMetadata;
  activate: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
  onHotReload?: () => void | Promise<void>;
}

export interface PluginLoadResult {
  plugin: Plugin;
  errors: string[];
}

// ============================================================================
// GDScript Pattern Types
// ============================================================================

export interface StateMachineConfig {
  initial_state: string;
  states: Record<string, StateDefinition>;
  transitions: Record<string, StateTransition[]>;
}

export interface StateDefinition {
  enter?: string; // GDScript function name
  update?: string;
  exit?: string;
}

export interface StateTransition {
  to: string;
  condition?: string; // GDScript function name
  trigger?: string; // Event name
}

export interface EventBusConfig {
  events: string[];
  global: boolean;
}

export interface SaveSystemConfig {
  autosave: boolean;
  autosave_interval: number;
  slot_count: number;
  encryption: boolean;
}

export interface TutorialProgress {
  tutorial_id: string;
  current_step: number;
  completed_steps: number[];
  started_at: number;
  last_activity: number;
}

// ============================================================================
// Custom Node Types
// ============================================================================

export interface AIAttentionNodeConfig {
  attention_size: number; // Size of attention matrix
  max_tokens: number;
  color_gradient: ColorGradient;
  animation_speed: number;
}

export interface ColorGradient {
  stops: Array<{ position: number; color: string }>;
}

export interface ProgressNodeConfig {
  total_stages: number;
  current_stage: number;
  unlock_thresholds: number[];
  persistence_key: string;
}

export interface TutorialTriggerNodeConfig {
  tutorial_id: string;
  trigger_condition: string;
  trigger_once: boolean;
  delay_seconds: number;
}

export interface GamificationTriggerNodeConfig {
  achievement_id: string;
  condition_type: "milestone" | "discovery" | "mastery" | "social";
  condition_value: number | string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

// ============================================================================
// Shader Types
// ============================================================================

export interface ShaderConfig {
  name: string;
  type: "spatial" | "canvas_item" | "particle";
  uniforms: ShaderUniform[];
  code: string;
}

export interface ShaderUniform {
  name: string;
  type: "float" | "vec2" | "vec3" | "vec4" | "sampler2D" | "color";
  default_value: unknown;
  hint?: string;
}

export interface AttentionHeatmapConfig extends ShaderConfig {
  attention_matrix: number[][];
  token_labels: string[];
  color_scheme: "viridis" | "plasma" | "inferno" | "coolwarm";
}

// ============================================================================
// Educational Content Types
// ============================================================================

export interface Lesson {
  id: string;
  title: string;
  description: string;
  stage: "cognitive_mill" | "intelligence_ranch" | "sitka_sound" | "digital_twins";
  difficulty: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  learning_objectives: string[];
  exercises: Exercise[];
  estimated_duration: number; // minutes
  xp_reward: number;
}

export interface Exercise {
  id: string;
  type: "quiz" | "coding" | "simulation" | "creative";
  title: string;
  prompt: string;
  hints: Hint[];
  verification?: ExerciseVerification;
  completion_message: string;
  xp_reward: number;
}

export interface Hint {
  level: number;
  text: string;
  penalty?: number; // XP penalty for using hint
}

export interface ExerciseVerification {
  type: "auto" | "peer" | "ai";
  criteria?: Record<string, unknown>;
  test_cases?: TestCase[];
}

export interface TestCase {
  input: unknown;
  expected_output: unknown;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlock_condition: AchievementCondition;
  xp_reward: number;
  hidden?: boolean;
}

export interface AchievementCondition {
  type: "lesson_complete" | "exercise_count" | "streak" | "discovery" | "custom";
  value: number | string;
  extra?: Record<string, unknown>;
}

export interface StudentProgress {
  user_id: string;
  current_stage: "cognitive_mill" | "intelligence_ranch" | "sitka_sound" | "digital_twins";
  completed_lessons: string[];
  completed_exercises: string[];
  achievements: string[];
  xp: number;
  streak_days: number;
  last_activity: number;
  tutorial_progress: TutorialProgress[];
}

// ============================================================================
// Asset Bundle Types
// ============================================================================

export interface AssetBundle {
  id: string;
  name: string;
  version: string;
  assets: Asset[];
  dependencies?: string[];
}

export interface Asset {
  type: "scene" | "shader" | "script" | "texture" | "model" | "audio";
  path: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// RPC Method Types
// ============================================================================

export interface RPCMethod {
  name: string;
  params: RPCParameter[];
  return_type: string;
  description: string;
}

export interface RPCParameter {
  name: string;
  type: string;
  optional: boolean;
  default_value?: unknown;
}

// ============================================================================
// Error Types
// ============================================================================

export class GodotIntegrationError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GodotIntegrationError";
  }
}

export enum ErrorCode {
  BRIDGE_DISCONNECTED = "BRIDGE_DISCONNECTED",
  INVALID_MESSAGE = "INVALID_MESSAGE",
  RPC_TIMEOUT = "RPC_TIMEOUT",
  PLUGIN_LOAD_FAILED = "PLUGIN_LOAD_FAILED",
  SCENE_NOT_FOUND = "SCENE_NOT_FOUND",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  ASSET_LOAD_FAILED = "ASSET_LOAD_FAILED",
  INVALID_LESSON = "INVALID_LESSON",
  EXERCISE_FAILED = "EXERCISE_FAILED",
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface GodotIntegrationConfig {
  bridge: {
    port: number;
    host: string;
    auto_reconnect: boolean;
    reconnect_interval: number;
    max_reconnect_attempts: number;
  };
  plugins: {
    directory: string;
    hot_reload: boolean;
    auto_load: string[];
  };
  content: {
    directory: string;
    locale: string;
  };
  logging: {
    level: "debug" | "info" | "warn" | "error";
    bridge_log: boolean;
  };
}
