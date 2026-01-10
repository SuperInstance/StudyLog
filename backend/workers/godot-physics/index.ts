/**
 * Godot Physics Bridge - Main Export
 *
 * Connects Godot physics to CuPy/Numba for GPU acceleration.
 *
 * @see bridge.ts for the main implementation
 * @see types.ts for type definitions
 */

export {
  GodotPhysicsBridge,
  createGodotScene,
  calculateSceneStats,
  type SceneStats,
  type GPUBuffer,
  type GPUProcessRequest,
  type GPUProcessResponse,
  type ExportConfig,
} from './bridge';

export {
  type GodotNode,
  type GodotScene,
  type GodotTransform,
  type GodotPhysics,
  type AgentData,
  type EcosystemState,
} from './types';
