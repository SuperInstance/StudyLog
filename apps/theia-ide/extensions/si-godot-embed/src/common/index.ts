/**
 * StudyLoG.AI - Godot Embed Common
 *
 * Shared types and constants for Godot embedding.
 */

export const GODOT_WIDGET_ID = 'si-godot-embed:widget';
export const GODOT_WIDGET_LABEL = 'Game View';

// Godot process states
export type GodotState = 'stopped' | 'starting' | 'running' | 'error';

// Messages from Godot to Theia
export interface GodotToTheiaMessage {
  type: 'ready' | 'scene_loaded' | 'game_state' | 'error' | 'log';
  payload?: unknown;
  timestamp: number;
}

// Messages from Theia to Godot
export interface TheiaToGodotMessage {
  type: 'load_scene' | 'set_state' | 'pause' | 'resume' | 'reload' | 'execute';
  payload?: unknown;
  requestId?: string;
}

// Game state structure
export interface GameState {
  scene: string;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  stage: number;
  variables: Record<string, unknown>;
  paused: boolean;
}

// Scene definition
export interface SceneDefinition {
  id: string;
  name: string;
  module: string;
  path: string;
  thumbnail?: string;
  description?: string;
}

// Godot configuration
export interface GodotConfig {
  executablePath?: string;
  projectPath?: string;
  port: number;
  headless: boolean;
  debug: boolean;
  resolution: {
    width: number;
    height: number;
  };
}

export const DEFAULT_GODOT_CONFIG: GodotConfig = {
  port: 6543,
  headless: false,
  debug: true,
  resolution: {
    width: 1280,
    height: 720,
  },
};
