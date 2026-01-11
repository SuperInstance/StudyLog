/**
 * RTS Camera Controller
 *
 * Controls the RTS-style camera for OpenRTS integration.
 *
 * ## Features
 *
 * - Smooth pan, zoom, and rotation
 * - Edge scrolling
 * - Middle-click drag
 * - Keyboard controls (WASD/QE)
 * - Follow units
 * - Save/load camera positions
 * - Cinematic transitions
 * - Quality-based performance tuning
 */

import type {
  Vector3,
  Vector2,
  RTSCameraConfig,
  UnitInstance,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface CameraControllerConfig {
  /** Base camera configuration */
  base: RTSCameraConfig;

  /** Input settings */
  input: {
    /** Edge scroll enabled */
    edgeScroll: boolean;

    /** Edge scroll margin (pixels) */
    edgeMargin: number;

    /** Middle-click drag enabled */
    dragEnabled: boolean;

    /** Keyboard pan enabled */
    keyboardEnabled: boolean;

    /** Scroll to zoom speed */
    scrollZoomSpeed: number;

    /** Keyboard pan speed multiplier */
    keyboardSpeed: number;
  };

  /** Smoothing settings */
  smoothing: {
    /** Position smoothing (0-1) */
    position: number;

    /** Rotation smoothing (0-1) */
    rotation: number;

    /** Zoom smoothing (0-1) */
    zoom: number;
  };

  /** Constraints */
  constraints: {
    /** Minimum distance from target */
    minDistance: number;

    /** Maximum distance from target */
    maxDistance: number;

    /** Minimum pitch angle (degrees) */
    minPitch: number;

    /** Maximum pitch angle (degrees) */
    maxPitch: number;

    /** Bounds for camera center (null = unlimited) */
    bounds: { min: Vector2; max: Vector2 } | null;
  };
}

export const DEFAULT_CAMERA_CONFIG: CameraControllerConfig = {
  base: {
    position: { x: 0, y: 30, z: 0 },
    target: { x: 0, y: 0, z: 0 },
    distance: 40,
    rotation: 0,
    pitch: 45,
    fov: 60,
    minDistance: 10,
    maxDistance: 100,
    minPitch: 15,
    maxPitch: 80,
    panSpeed: 20,
    zoomSpeed: 20,
    rotationSpeed: 120,
    edgeScrollMargin: 20,
    edgeScrollEnabled: true,
    bounds: null,
  },
  input: {
    edgeScroll: true,
    edgeMargin: 20,
    dragEnabled: true,
    keyboardEnabled: true,
    scrollZoomSpeed: 5,
    keyboardSpeed: 1,
  },
  smoothing: {
    position: 0.8,
    rotation: 0.5,
    zoom: 0.7,
  },
  constraints: {
    minDistance: 10,
    maxDistance: 150,
    minPitch: 10,
    maxPitch: 85,
    bounds: null,
  },
};

// ============================================================================
// Camera State
// ============================================================================

export interface CameraState {
  /** Current position */
  position: Vector3;

  /** Current target (look-at) */
  target: Vector3;

  /** Current distance from target */
  distance: number;

  /** Current rotation (degrees around Y) */
  rotation: number;

  /** Current pitch (degrees from horizontal) */
  pitch: number;

  /** Current field of view */
  fov: number;

  /** Target values for smoothing */
  targetPosition: Vector3;
  targetDistance: number;
  targetRotation: number;
  targetPitch: number;
}

// ============================================================================
// Camera Controller Class
// ============================================================================

/**
 * Controls RTS camera behavior
 */
export class CameraController {
  private state: CameraState;
  private following: string | null = null;
  private savedPositions: Map<string, CameraState> = new Map();
  private transitionActive: boolean = false;
  private transitionProgress: number = 0;
  private transitionStart: CameraState | null = null;
  private transitionEnd: CameraState | null = null;
  private transitionDuration: number = 1;

  constructor(
    private config: CameraControllerConfig = DEFAULT_CAMERA_CONFIG
  ) {
    this.state = this.createInitialState();
  }

  // ========================================================================
  // State Access
  // ========================================================================

  /**
   * Get current camera state
   */
  getState(): CameraState {
    return { ...this.state };
  }

  /**
   * Get camera config for sending to engine
   */
  getConfig(): RTSCameraConfig {
    return {
      position: this.state.position,
      target: this.state.target,
      distance: this.state.distance,
      rotation: this.state.rotation,
      pitch: this.state.pitch,
      fov: this.state.fov,
      minDistance: this.config.constraints.minDistance,
      maxDistance: this.config.constraints.maxDistance,
      minPitch: this.config.constraints.minPitch,
      maxPitch: this.config.constraints.maxPitch,
      panSpeed: this.config.base.panSpeed,
      zoomSpeed: this.config.base.zoomSpeed,
      rotationSpeed: this.config.base.rotationSpeed,
      edgeScrollMargin: this.config.input.edgeMargin,
      edgeScrollEnabled: this.config.input.edgeScroll,
      bounds: this.config.constraints.bounds,
    };
  }

  // ========================================================================
  // Camera Movement
  // ========================================================================

  /**
   * Pan camera in world space
   */
  pan(delta: Vector2, deltaTime: number = 1 / 60): void {
    const radians = (this.state.rotation * Math.PI) / 180;
    const forward = {
      x: Math.sin(radians),
      z: Math.cos(radians),
    };
    const right = {
      x: Math.cos(radians),
      z: -Math.sin(radians),
    };

    const speed = this.config.base.panSpeed * deltaTime;

    this.state.targetPosition.x += (delta.x * right.x + delta.y * forward.x) * speed;
    this.state.targetPosition.z += (delta.x * right.z + delta.y * forward.z) * speed;
  }

  /**
   * Pan camera relative to screen (for edge scrolling)
   */
  panScreen(delta: Vector2, deltaTime: number = 1 / 60): void {
    this.pan({ x: -delta.x, y: delta.y }, deltaTime);
  }

  /**
   * Rotate camera around target
   */
  rotate(delta: number, deltaTime: number = 1 / 60): void {
    this.state.targetRotation += delta * this.config.base.rotationSpeed * deltaTime;
  }

  /**
   * Zoom camera (change distance)
   */
  zoom(delta: number, deltaTime: number = 1 / 60): void {
    const speed = this.config.base.zoomSpeed * deltaTime;
    this.state.targetDistance -= delta * speed;
  }

  /**
   * Pitch camera (change angle)
   */
  pitch(delta: number, deltaTime: number = 1 / 60): void {
    const speed = this.config.base.rotationSpeed * 0.5 * deltaTime;
    this.state.targetPitch += delta * speed;
  }

  // ========================================================================
  // Camera Positioning
  // ========================================================================

  /**
   * Set camera to look at a position
   */
  lookAt(position: Vector3, instant: boolean = false): void {
    this.state.targetPosition = { ...position };
    if (instant) {
      this.state.target = { ...position };
    }
    this.following = null;
  }

  /**
   * Set camera to follow a unit
   */
  followUnit(unitId: string): void {
    this.following = unitId;
  }

  /**
   * Stop following
   */
  stopFollowing(): void {
    this.following = null;
  }

  /**
   * Update following unit's position
   */
  updateFollowedUnit(unit: UnitInstance): void {
    if (this.following === unit.instanceId) {
      this.state.targetPosition = { ...unit.position };
    }
  }

  /**
   * Jump camera to a preset position
   */
  jumpTo(position: Vector3, distance?: number, rotation?: number, pitch?: number): void {
    this.state.position = { ...position };
    this.state.target = { ...position };
    this.state.targetPosition = { ...position };

    if (distance !== undefined) {
      this.state.distance = distance;
      this.state.targetDistance = distance;
    }
    if (rotation !== undefined) {
      this.state.rotation = rotation;
      this.state.targetRotation = rotation;
    }
    if (pitch !== undefined) {
      this.state.pitch = pitch;
      this.state.targetPitch = pitch;
    }

    this.recalculatePosition();
    this.following = null;
  }

  // ========================================================================
  // Position Saving/Loading
  // ========================================================================

  /**
   * Save current camera position
   */
  savePosition(name: string): void {
    this.savedPositions.set(name, { ...this.state });
  }

  /**
   * Load saved camera position
   */
  loadPosition(name: string, instant: boolean = false): void {
    const saved = this.savedPositions.get(name);
    if (saved) {
      if (instant) {
        this.state = { ...saved };
        this.recalculatePosition();
      } else {
        this.transitionTo(saved);
      }
      this.following = null;
    }
  }

  /**
   * Get list of saved position names
   */
  getSavedPositions(): string[] {
    return Array.from(this.savedPositions.keys());
  }

  /**
   * Clear a saved position
   */
  clearSavedPosition(name: string): void {
    this.savedPositions.delete(name);
  }

  // ========================================================================
  // Cinematic Transitions
  // ========================================================================

  /**
   * Start a cinematic transition to target state
   */
  transitionTo(
    target: Partial<CameraState>,
    duration: number = 1,
    easing?: (t: number) => number
  ): void {
    this.transitionStart = { ...this.state };
    this.transitionEnd = {
      position: target.position ?? this.state.position,
      target: target.target ?? this.state.target,
      distance: target.distance ?? this.state.distance,
      rotation: target.rotation ?? this.state.rotation,
      pitch: target.pitch ?? this.state.pitch,
      fov: target.fov ?? this.state.fov,
      targetPosition: target.targetPosition ?? this.state.targetPosition,
      targetDistance: target.distance ?? this.state.targetDistance,
      targetRotation: target.rotation ?? this.state.targetRotation,
      targetPitch: target.pitch ?? this.state.targetPitch,
    };
    this.transitionDuration = duration;
    this.transitionProgress = 0;
    this.transitionActive = true;
    this.following = null;
  }

  /**
   * Focus on a group of units (find center)
   */
  focusOnUnits(units: UnitInstance[], padding: number = 10): void {
    if (units.length === 0) return;

    // Find center
    const center: Vector3 = { x: 0, y: 0, z: 0 };
    for (const unit of units) {
      center.x += unit.position.x;
      center.y += unit.position.y;
      center.z += unit.position.z;
    }
    center.x /= units.length;
    center.y /= units.length;
    center.z /= units.length;

    // Find bounding radius
    let maxRadius = 0;
    for (const unit of units) {
      const dx = unit.position.x - center.x;
      const dz = unit.position.z - center.z;
      const radius = Math.sqrt(dx * dx + dz * dz);
      maxRadius = Math.max(maxRadius, radius);
    }

    // Calculate distance based on radius and pitch
    const pitchRad = (this.state.pitch * Math.PI) / 180;
    const requiredDistance = (maxRadius + padding) / Math.sin(pitchRad);

    this.transitionTo(
      {
        targetPosition: center,
        targetDistance: Math.min(
          requiredDistance,
          this.config.constraints.maxDistance
        ),
      },
      1.5,
      this.easeOutCubic
    );
  }

  // ========================================================================
  // Update Loop
  // ========================================================================

  /**
   * Update camera state (call every frame)
   */
  update(deltaTime: number): void {
    // Handle transition
    if (this.transitionActive) {
      this.updateTransition(deltaTime);
      return;
    }

    // Apply smoothing to target values
    const posSmooth = Math.pow(1 - this.config.smoothing.position, deltaTime * 60);
    const rotSmooth = Math.pow(1 - this.config.smoothing.rotation, deltaTime * 60);
    const zoomSmooth = Math.pow(1 - this.config.smoothing.zoom, deltaTime * 60);

    this.state.target.x +=
      (this.state.targetPosition.x - this.state.target.x) * (1 - posSmooth);
    this.state.target.z +=
      (this.state.targetPosition.z - this.state.target.z) * (1 - posSmooth);

    this.state.rotation +=
      (this.state.targetRotation - this.state.rotation) * (1 - rotSmooth);
    this.state.pitch +=
      (this.state.targetPitch - this.state.pitch) * (1 - rotSmooth);
    this.state.distance +=
      (this.state.targetDistance - this.state.distance) * (1 - zoomSmooth);

    // Apply constraints
    this.applyConstraints();

    // Recalculate camera position
    this.recalculatePosition();
  }

  /**
   * Update cinematic transition
   */
  private updateTransition(deltaTime: number): void {
    this.transitionProgress += deltaTime / this.transitionDuration;

    if (this.transitionProgress >= 1) {
      this.transitionProgress = 1;
      this.transitionActive = false;

      // Apply final state
      if (this.transitionEnd) {
        this.state = { ...this.transitionEnd };
        this.state.target = { ...this.state.targetPosition };
        this.recalculatePosition();
      }
      return;
    }

    // Interpolate
    const t = this.easeOutCubic(this.transitionProgress);

    if (this.transitionStart && this.transitionEnd) {
      this.state.target.x = this.lerp(
        this.transitionStart.target.x,
        this.transitionEnd.target.x,
        t
      );
      this.state.target.z = this.lerp(
        this.transitionStart.target.z,
        this.transitionEnd.target.z,
        t
      );
      this.state.rotation = this.lerp(
        this.transitionStart.rotation,
        this.transitionEnd.rotation,
        t
      );
      this.state.pitch = this.lerp(
        this.transitionStart.pitch,
        this.transitionEnd.pitch,
        t
      );
      this.state.distance = this.lerp(
        this.transitionStart.distance,
        this.transitionEnd.distance,
        t
      );

      this.recalculatePosition();
    }
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  private createInitialState(): CameraState {
    const base = this.config.base;
    return {
      position: { ...base.position },
      target: { ...base.target },
      distance: base.distance,
      rotation: base.rotation,
      pitch: base.pitch,
      fov: base.fov,
      targetPosition: { ...base.target },
      targetDistance: base.distance,
      targetRotation: base.rotation,
      targetPitch: base.pitch,
    };
  }

  private recalculatePosition(): void {
    const pitchRad = (this.state.pitch * Math.PI) / 180;
    const rotationRad = (this.state.rotation * Math.PI) / 180;

    // Calculate position based on target, distance, pitch, and rotation
    const horizontalDist = this.state.distance * Math.cos(pitchRad);
    const verticalDist = this.state.distance * Math.sin(pitchRad);

    this.state.position.x =
      this.state.target.x - horizontalDist * Math.sin(rotationRad);
    this.state.position.y = this.state.target.y + verticalDist;
    this.state.position.z =
      this.state.target.z - horizontalDist * Math.cos(rotationRad);
  }

  private applyConstraints(): void {
    // Distance constraints
    this.state.distance = Math.max(
      this.config.constraints.minDistance,
      Math.min(this.config.constraints.maxDistance, this.state.distance)
    );
    this.state.targetDistance = this.state.distance;

    // Pitch constraints
    this.state.pitch = Math.max(
      this.config.constraints.minPitch,
      Math.min(this.config.constraints.maxPitch, this.state.pitch)
    );
    this.state.targetPitch = this.state.pitch;

    // Normalize rotation to 0-360
    this.state.rotation = ((this.state.rotation % 360) + 360) % 360;
    this.state.targetRotation = this.state.rotation;

    // Bounds constraints
    if (this.config.constraints.bounds) {
      const bounds = this.config.constraints.bounds;
      this.state.target.x = Math.max(
        bounds.min.x,
        Math.min(bounds.max.x, this.state.target.x)
      );
      this.state.target.z = Math.max(
        bounds.min.y,
        Math.min(bounds.max.y, this.state.target.z)
      );
      this.state.targetPosition.x = this.state.target.x;
      this.state.targetPosition.z = this.state.target.z;
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<CameraControllerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set camera bounds
   */
  setBounds(bounds: { min: Vector2; max: Vector2 } | null): void {
    this.config.constraints.bounds = bounds;
    this.config.base.bounds = bounds;
  }

  /**
   * Set zoom limits
   */
  setZoomLimits(min: number, max: number): void {
    this.config.constraints.minDistance = min;
    this.config.constraints.maxDistance = max;
    this.config.base.minDistance = min;
    this.config.base.maxDistance = max;
  }

  /**
   * Enable/disable edge scrolling
   */
  setEdgeScroll(enabled: boolean): void {
    this.config.input.edgeScroll = enabled;
    this.config.base.edgeScrollEnabled = enabled;
  }

  /**
   * Set smoothing values
   */
  setSmoothing(position: number, rotation: number, zoom: number): void {
    this.config.smoothing.position = Math.max(0, Math.min(1, position));
    this.config.smoothing.rotation = Math.max(0, Math.min(1, rotation));
    this.config.smoothing.zoom = Math.max(0, Math.min(1, zoom));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a camera controller with configuration
 */
export function createCameraController(
  config?: Partial<CameraControllerConfig>
): CameraController {
  return new CameraController({
    ...DEFAULT_CAMERA_CONFIG,
    ...config,
    base: {
      ...DEFAULT_CAMERA_CONFIG.base,
      ...(config?.base ?? {}),
    },
    input: {
      ...DEFAULT_CAMERA_CONFIG.input,
      ...(config?.input ?? {}),
    },
    smoothing: {
      ...DEFAULT_CAMERA_CONFIG.smoothing,
      ...(config?.smoothing ?? {}),
    },
    constraints: {
      ...DEFAULT_CAMERA_CONFIG.constraints,
      ...(config?.constraints ?? {}),
    },
  });
}

/**
 * Create a StudyLoG-specific camera controller
 */
export function createStudyLogCamera(): CameraController {
  return new CameraController({
    ...DEFAULT_CAMERA_CONFIG,
    base: {
      ...DEFAULT_CAMERA_CONFIG.base,
      position: { x: 0, y: 15, z: 0 },
      distance: 20,
      pitch: 50,
      minDistance: 5,
      maxDistance: 50,
    },
    constraints: {
      ...DEFAULT_CAMERA_CONFIG.constraints,
      minDistance: 5,
      maxDistance: 50,
      minPitch: 20,
      maxPitch: 75,
    },
    smoothing: {
      position: 0.9,
      rotation: 0.7,
      zoom: 0.8,
    },
  });
}

/**
 * Create a DMLoG-specific camera controller
 */
export function createDMLoGCamera(): CameraController {
  return new CameraController({
    ...DEFAULT_CAMERA_CONFIG,
    base: {
      ...DEFAULT_CAMERA_CONFIG.base,
      position: { x: 0, y: 40, z: 0 },
      distance: 50,
      pitch: 45,
      minDistance: 15,
      maxDistance: 120,
    },
    constraints: {
      ...DEFAULT_CAMERA_CONFIG.constraints,
      minDistance: 15,
      maxDistance: 120,
      bounds: { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } },
    },
    smoothing: {
      position: 0.75,
      rotation: 0.5,
      zoom: 0.7,
    },
  });
}

export default CameraController;
