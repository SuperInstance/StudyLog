/**
 * Godot Physics Bridge - Type Definitions
 *
 * Shared types for Godot scene representation and GPU processing.
 */

/**
 * Godot transform matrix
 */
export interface GodotTransform {
  /** Origin (position) [x, y, z] */
  origin: [number, number, number];

  /** Basis matrix (rotation) [3x3 flattened] */
  basis: [
    number, number, number,  // Row 0
    number, number, number,  // Row 1
    number, number, number   // Row 2
  ];
}

/**
 * Physics properties for a node
 */
export interface GodotPhysics {
  /** Mass in kg */
  mass?: number;

  /** Friction coefficient (0-1) */
  friction?: number;

  /** Bounce/restitution coefficient (0-1) */
  bounce?: number;

  /** Linear velocity damping */
  damping?: number;

  /** Gravity scale */
  gravityScale?: number;

  /** Angular damping */
  angularDamping?: number;

  /** Linear damping */
  linearDamping?: number;

  /** Whether physics is enabled */
  enabled?: boolean;

  /** Collision layer */
  collisionLayer?: number;

  /** Collision mask */
  collisionMask?: number;
}

/**
 * Godot scene node
 */
export interface GodotNode {
  /** Node name */
  name: string;

  /** Node type (rigid_body, character_body, etc.) */
  type: string;

  /** Transform (position + rotation) */
  transform: GodotTransform;

  /** Velocity vector [vx, vy, vz] */
  velocity?: [number, number, number];

  /** Physics properties */
  physics?: GodotPhysics;

  /** Scale [sx, sy, sz] */
  scale?: [number, number, number];

  /** Whether node is visible */
  visible?: boolean;

  /** Whether node is static */
  static?: boolean;

  /** Custom properties */
  properties?: Record<string, string | number | boolean>;
}

/**
 * Godot scene
 */
export interface GodotScene {
  /** Scene name */
  name: string;

  /** Current frame number */
  frame?: number;

  /** Time since last frame (delta) */
  deltaTime?: number;

  /** Scene nodes */
  nodes: GodotNode[];

  /** Scene metadata */
  metadata?: {
    [key: string]: string | number | boolean;
  };

  /** Whether scene was processed on GPU */
  gpuProcessed?: boolean;

  /** Last GPU update timestamp */
  lastGpuUpdate?: string;
}

/**
 * Agent data for Sitka Sound simulation
 */
export interface AgentData {
  /** Agent ID */
  id: string;

  /** Agent type (herring, deckhand, captain, etc.) */
  type: string;

  /** Position */
  position: [number, number, number];

  /** Velocity */
  velocity: [number, number, number];

  /** Agent properties */
  properties: {
    /** Energy level */
    energy: number;

    /** Age in simulation ticks */
    age: number;

    /** State (seeking, fleeing, foraging, etc.) */
    state: string;

    /** Perception radius */
    perceptionRadius: number;

    /** Max speed */
    maxSpeed: number;
  };
}

/**
 * Ecosystem state for Sitka Sound
 */
export interface EcosystemState {
  /** Simulation tick */
  tick: number;

  /** All agents */
  agents: AgentData[];

  /** Environmental factors */
  environment: {
    /** Water temperature */
    temperature: number;

    /** Current strength/direction */
    current: [number, number, number];

    /** Food availability */
    foodAvailability: number;
  };

  /** Species populations */
  populations: {
    [speciesName: string]: number;
  };
}
