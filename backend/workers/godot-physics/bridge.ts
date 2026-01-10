/**
 * Godot Physics Bridge
 *
 * Connects Godot physics to CuPy/Numba for GPU acceleration.
 *
 * ## Architecture
 *
 * ```
 * Theia IDE (si-godot-panel)
 *     |
 *     v
 * Godot Engine 4.x
 *     | (export scene data)
 *     v
 * GodotPhysicsBridge (TypeScript)
 *     | (HTTP/WebSocket)
 *     v
 * Python Bridge (CuPy) / Numba Kernels
 *     | (GPU computation)
 *     v
 * NVIDIA RTX GPU
 *     |
 *     v (import results)
 * Godot Engine
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * const bridge = new GodotPhysicsBridge('http://localhost:8081');
 *
 * // Export scene data to GPU format
 * const gpuBuffer = await bridge.exportToGPU(sceneData);
 *
 * // Process on GPU
 * const result = await bridge.processOnGPU(gpuBuffer, 'physics');
 *
 * // Import results back to Godot
 * const updatedScene = await bridge.importFromGPU(result);
 * ```
 */

import type { GodotNode, GodotScene, GodotTransform } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * GPU buffer format for Godot scene data
 */
export interface GPUBuffer {
  /** Buffer format version */
  version: string;

  /** Timestamp of export */
  timestamp: string;

  /** Scene metadata */
  metadata: {
    nodeCount: number;
    frame: number;
    deltaTime: number;
    bounds: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };

  /** Packed node data (N x 13 float32 array) */
  /** Format: [x, y, z, vx, vy, vz, rx, ry, rz, rw, sx, sy, sz] */
  nodeData: Float32Array;

  /** Node properties (mass, friction, bounce, etc.) */
  nodeProperties: Float32Array;

  /** Node indices and types */
  nodeInfo: Uint32Array;
}

/**
 * GPU processing request
 */
export interface GPUProcessRequest {
  /** GPU buffer with scene data */
  buffer: GPUBuffer;

  /** Processing operation type */
  operation: 'physics' | 'flocking' | 'collision' | 'ecology' | 'diffusion';

  /** Operation-specific parameters */
  parameters: {
    /** Time step */
    dt?: number;

    /** Number of steps */
    steps?: number;

    /** For physics: damping factor */
    damping?: number;

    /** For flocking: perception radius */
    perceptionRadius?: number;

    /** For collision: collision radius */
    collisionRadius?: number;

    /** Custom parameters */
    [key: string]: unknown;
  };
}

/**
 * GPU processing response
 */
export interface GPUProcessResponse {
  /** Success status */
  success: boolean;

  /** Updated node data */
  nodeData?: Float32Array;

  /** Processing metadata */
  metadata: {
    executionTimeMs: number;
    gpuMemoryUsed: number;
    operationsPerformed: string[];
    speedupFactor?: number;
  };

  /** Error message if failed */
  error?: string;
}

/**
 * Godot scene export configuration
 */
export interface ExportConfig {
  /** Include static nodes */
  includeStatic: boolean;

  /** Include only visible nodes */
  visibleOnly: boolean;

  /** Export mode */
  mode: 'full' | 'physics-only' | 'transform-only';

  /** Bounding box filter (optional) */
  boundsFilter?: {
    min: [number, number, number];
    max: [number, number, number];
  };
}

// ============================================================================
// GodotPhysicsBridge Class
// ============================================================================

/**
 * Bridge between Godot and GPU acceleration via CuPy/Numba
 *
 * Handles conversion between Godot scene data and GPU buffers,
 * manages communication with Python bridge services.
 */
export class GodotPhysicsBridge {
  private cupyUrl: string;
  private numbaUrl: string;
  private connected: boolean = false;

  /**
   * Create a new Godot Physics Bridge
   *
   * @param cupyUrl URL of CuPy bridge (default: localhost:8081)
   * @param numbaUrl URL of Numba bridge (default: localhost:8082)
   */
  constructor(
    cupyUrl: string = 'http://localhost:8081',
    numbaUrl: string = 'http://localhost:8082'
  ) {
    this.cupyUrl = cupyUrl;
    this.numbaUrl = numbaUrl;
  }

  /**
   * Check if the bridge services are available
   */
  async checkConnection(): Promise<boolean> {
    try {
      // Check CuPy bridge
      const cupyResponse = await fetch(`${this.cupyUrl}/info`, {
        signal: AbortSignal.timeout(1000),
      });
      const cupyAvailable = cupyResponse.ok;

      // Check Numba bridge
      const numbaResponse = await fetch(`${this.numbaUrl}/info`, {
        signal: AbortSignal.timeout(1000),
      });
      const numbaAvailable = numbaResponse.ok;

      this.connected = cupyAvailable || numbaAvailable;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  /**
   * Get the best available backend (CuPy or Numba)
   */
  private async getBackend(): Promise<'cupy' | 'numba' | null> {
    try {
      const cupyResponse = await fetch(`${this.cupyUrl}/info`, {
        signal: AbortSignal.timeout(500),
      });
      if (cupyResponse.ok) {
        const info = await cupyResponse.json();
        if (info.cupy_available && !info.using_fallback) {
          return 'cupy';
        }
      }
    } catch {
      // CuPy not available, try Numba
    }

    try {
      const numbaResponse = await fetch(`${this.numbaUrl}/info`, {
        signal: AbortSignal.timeout(500),
      });
      if (numbaResponse.ok) {
        const info = await numbaResponse.json();
        if (info.available) {
          return 'numba';
        }
      }
    } catch {
      // Neither available
    }

    return null;
  }

  /**
   * Export Godot scene data to GPU buffer format
   *
   * @param scene Godot scene data
   * @param config Export configuration
   * @returns GPU buffer for processing
   */
  async exportToGPU(scene: GodotScene, config: ExportConfig = {
    includeStatic: false,
    visibleOnly: true,
    mode: 'full',
  }): Promise<GPUBuffer> {
    // Filter nodes based on configuration
    const nodes = this.filterNodes(scene.nodes, config);

    // Extract node data
    const nodeData = this.extractNodeData(nodes);
    const nodeProperties = this.extractNodeProperties(nodes);
    const nodeInfo = this.extractNodeInfo(nodes);

    // Calculate scene bounds
    const bounds = this.calculateBounds(nodeData);

    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      metadata: {
        nodeCount: nodes.length,
        frame: scene.frame || 0,
        deltaTime: scene.deltaTime || 0.016,
        bounds,
      },
      nodeData,
      nodeProperties,
      nodeInfo,
    };
  }

  /**
   * Filter nodes based on export configuration
   */
  private filterNodes(nodes: GodotNode[], config: ExportConfig): GodotNode[] {
    return nodes.filter(node => {
      // Check static flag
      if (!config.includeStatic && node.static) {
        return false;
      }

      // Check visibility
      if (config.visibleOnly && !node.visible) {
        return false;
      }

      // Check bounds filter
      if (config.boundsFilter) {
        const pos = node.transform.origin;
        const [minX, minY, minZ] = config.boundsFilter.min;
        const [maxX, maxY, maxZ] = config.boundsFilter.max;

        if (pos[0] < minX || pos[0] > maxX ||
            pos[1] < minY || pos[1] > maxY ||
            pos[2] < minZ || pos[2] > maxZ) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Extract node data into packed Float32Array
   *
   * Format: [x, y, z, vx, vy, vz, rx, ry, rz, rw, sx, sy, sz]
   */
  private extractNodeData(nodes: GodotNode[]): Float32Array {
    const data = new Float32Array(nodes.length * 13);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const transform = node.transform;
      const offset = i * 13;

      // Position (x, y, z)
      data[offset + 0] = transform.origin[0];
      data[offset + 1] = transform.origin[1];
      data[offset + 2] = transform.origin[2];

      // Velocity (vx, vy, vz)
      const velocity = node.velocity || [0, 0, 0];
      data[offset + 3] = velocity[0];
      data[offset + 4] = velocity[1];
      data[offset + 5] = velocity[2];

      // Rotation quaternion (rx, ry, rz, rw)
      const basis = transform.basis;
      data[offset + 6] = basis[0]; // Simplified - would extract from basis
      data[offset + 7] = basis[1];
      data[offset + 8] = basis[2];
      data[offset + 9] = basis[3];

      // Scale (sx, sy, sz)
      const scale = node.scale || [1, 1, 1];
      data[offset + 10] = scale[0];
      data[offset + 11] = scale[1];
      data[offset + 12] = scale[2];
    }

    return data;
  }

  /**
   * Extract node properties into Float32Array
   *
   * Format: [mass, friction, bounce, damping, ...]
   */
  private extractNodeProperties(nodes: GodotNode[]): Float32Array {
    const props = new Float32Array(nodes.length * 8);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const physics = node.physics || {};
      const offset = i * 8;

      props[offset + 0] = physics.mass ?? 1.0;
      props[offset + 1] = physics.friction ?? 0.5;
      props[offset + 2] = physics.bounce ?? 0.0;
      props[offset + 3] = physics.damping ?? 0.99;
      props[offset + 4] = physics.gravityScale ?? 1.0;
      props[offset + 5] = physics.linearDamping ?? 0.01;
      props[offset + 6] = physics.angularDamping ?? 0.01;
      props[offset + 7] = 0.0; // Reserved
    }

    return props;
  }

  /**
   * Extract node info into Uint32Array
   *
   * Format: [nodeId, nodeType, flags, ...]
   */
  private extractNodeInfo(nodes: GodotNode[]): Uint32Array {
    const info = new Uint32Array(nodes.length * 4);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const offset = i * 4;

      // Hash node name to get an ID
      info[offset + 0] = this.hashString(node.name);

      // Node type (enum)
      info[offset + 1] = this.nodeTypeToInt(node.type);

      // Flags
      let flags = 0;
      if (node.static) flags |= 0x01;
      if (!node.visible) flags |= 0x02;
      if (node.physics?.enabled) flags |= 0x04;
      info[offset + 2] = flags;

      // Reserved
      info[offset + 3] = 0;
    }

    return info;
  }

  /**
   * Calculate scene bounds from node data
   */
  private calculateBounds(nodeData: Float32Array): {
    min: [number, number, number];
    max: [number, number, number];
  } {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < nodeData.length; i += 13) {
      minX = Math.min(minX, nodeData[i + 0]);
      minY = Math.min(minY, nodeData[i + 1]);
      minZ = Math.min(minZ, nodeData[i + 2]);
      maxX = Math.max(maxX, nodeData[i + 0]);
      maxY = Math.max(maxY, nodeData[i + 1]);
      maxZ = Math.max(maxZ, nodeData[i + 2]);
    }

    return {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    };
  }

  /**
   * Convert node type string to integer
   */
  private nodeTypeToInt(type: string): number {
    const types: Record<string, number> = {
      'rigid_body': 1,
      'character_body': 2,
      'static_body': 3,
      'area': 4,
      'vehicle': 5,
      'particle': 6,
      'boid': 7,
      'agent': 8,
    };
    return types[type] ?? 0;
  }

  /**
   * Simple string hash for node IDs
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Process scene data on GPU
   *
   * @param request GPU processing request
   * @returns Processing response
   */
  async processOnGPU(request: GPUProcessRequest): Promise<GPUProcessResponse> {
    const backend = await this.getBackend();

    if (!backend) {
      return {
        success: false,
        metadata: {
          executionTimeMs: 0,
          gpuMemoryUsed: 0,
          operationsPerformed: [],
        },
        error: 'No GPU backend available (CuPy/Numba not running)',
      };
    }

    const startTime = Date.now();

    try {
      let response: Response;

      if (backend === 'cupy') {
        // Use CuPy bridge
        if (request.operation === 'physics') {
          response = await fetch(`${this.cupyUrl}/physics/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.convertToCuPyFormat(request)),
            signal: AbortSignal.timeout(30000),
          });
        } else if (request.operation === 'flocking') {
          response = await fetch(`${this.cupyUrl}/physics/flocking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.convertToCuPyFormat(request)),
            signal: AbortSignal.timeout(30000),
          });
        } else {
          // General data processing
          response = await fetch(`${this.cupyUrl}/data/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              operation: request.operation,
              data: this.bufferToArray2D(request.buffer),
              parameters: request.parameters,
            }),
            signal: AbortSignal.timeout(30000),
          });
        }
      } else {
        // Use Numba bridge (would need similar endpoints)
        return {
          success: false,
          metadata: {
            executionTimeMs: 0,
            gpuMemoryUsed: 0,
            operationsPerformed: [],
          },
          error: 'Numba bridge not yet implemented for this operation',
        };
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();

      return {
        success: true,
        nodeData: this.extractNodeDataFromResult(result),
        metadata: {
          executionTimeMs: result.execution_time_ms ?? Date.now() - startTime,
          gpuMemoryUsed: result.gpu_memory_used ?? 0,
          operationsPerformed: [request.operation],
          speedupFactor: result.speedup_factor,
        },
      };
    } catch (error) {
      return {
        success: false,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          gpuMemoryUsed: 0,
          operationsPerformed: [],
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert GPU buffer request to CuPy format
   */
  private convertToCuPyFormat(request: GPUProcessRequest): unknown {
    // Convert Float32Array to regular array for JSON serialization
    const particles: number[][] = [];

    for (let i = 0; i < request.buffer.nodeData.length; i += 13) {
      particles.push([
        request.buffer.nodeData[i + 0],     // x
        request.buffer.nodeData[i + 1],     // y
        request.buffer.nodeData[i + 2],     // z
        request.buffer.nodeData[i + 3],     // vx
        request.buffer.nodeData[i + 4],     // vy
        request.buffer.nodeData[i + 5],     // vz
        request.buffer.nodeProperties[i / 8 * 8 + 0] ?? 1.0, // mass
      ]);
    }

    return {
      particles,
      forces: [], // Could be added from parameters
      dt: request.parameters.dt ?? request.buffer.metadata.deltaTime,
      steps: request.parameters.steps ?? 1,
      damping: request.parameters.damping ?? 0.99,
      bounds: [
        request.buffer.metadata.bounds.min[0],
        request.buffer.metadata.bounds.max[0],
        request.buffer.metadata.bounds.min[1],
        request.buffer.metadata.bounds.max[1],
        request.buffer.metadata.bounds.min[2],
        request.buffer.metadata.bounds.max[2],
      ],
    };
  }

  /**
   * Convert GPU buffer to 2D array for data operations
   */
  private bufferToArray2D(buffer: GPUBuffer): number[][] {
    const rows = buffer.nodeData.length / 13;
    const data: number[][] = [];

    for (let i = 0; i < rows; i++) {
      const row: number[] = [];
      for (let j = 0; j < 13; j++) {
        row.push(buffer.nodeData[i * 13 + j]);
      }
      data.push(row);
    }

    return data;
  }

  /**
   * Extract node data from processing result
   */
  private extractNodeDataFromResult(result: { particles?: number[][] }): Float32Array {
    if (!result.particles) {
      return new Float32Array(0);
    }

    const data = new Float32Array(result.particles.length * 13);

    for (let i = 0; i < result.particles.length; i++) {
      const particle = result.particles[i];
      const offset = i * 13;

      data[offset + 0] = particle[0] ?? 0; // x
      data[offset + 1] = particle[1] ?? 0; // y
      data[offset + 2] = particle[2] ?? 0; // z
      data[offset + 3] = particle[3] ?? 0; // vx
      data[offset + 4] = particle[4] ?? 0; // vy
      data[offset + 5] = particle[5] ?? 0; // vz
      // Rest of the fields would be preserved from original
    }

    return data;
  }

  /**
   * Import GPU processing results back to Godot scene format
   *
   * @param originalScene Original scene structure
   * @param response GPU processing response
   * @returns Updated Godot scene
   */
  async importFromGPU(
    originalScene: GodotScene,
    response: GPUProcessResponse
  ): Promise<GodotScene> {
    if (!response.success || !response.nodeData) {
      return originalScene;
    }

    // Create updated nodes
    const updatedNodes = originalScene.nodes.map((node, index) => {
      if (index * 13 >= response.nodeData!.length) {
        return node;
      }

      const offset = index * 13;
      const nodeData = response.nodeData!;

      // Update position
      const transform = { ...node.transform };
      transform.origin = [
        nodeData[offset + 0],
        nodeData[offset + 1],
        nodeData[offset + 2],
      ];

      // Update velocity
      const velocity = [
        nodeData[offset + 3],
        nodeData[offset + 4],
        nodeData[offset + 5],
      ];

      return {
        ...node,
        transform,
        velocity,
      };
    });

    return {
      ...originalScene,
      nodes: updatedNodes,
      frame: originalScene.frame + 1,
      gpuProcessed: true,
      lastGpuUpdate: new Date().toISOString(),
    };
  }

  /**
   * Process scene in one step (export, process, import)
   *
   * @param scene Godot scene
   * @param operation Operation type
   * @param parameters Operation parameters
   * @returns Updated scene
   */
  async processScene(
    scene: GodotScene,
    operation: GPUProcessRequest['operation'],
    parameters: GPUProcessRequest['parameters'] = {}
  ): Promise<GodotScene> {
    // Export to GPU format
    const buffer = await this.exportToGPU(scene);

    // Process on GPU
    const response = await this.processOnGPU({
      buffer,
      operation,
      parameters,
    });

    // Import results back
    return this.importFromGPU(scene, response);
  }

  /**
   * Create a WebSocket connection for real-time updates
   *
   * @param onMessage Callback for received messages
   * @returns WebSocket and cleanup function
   */
  connectWebSocket(onMessage: (data: unknown) => void): {
    socket: WebSocket | null;
    close: () => void;
  } {
    const url = this.cupyUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    const socket = new WebSocket(`${url}/ws`);

    socket.onopen = () => {
      console.log('Godot Physics Bridge WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch {
        onMessage(event.data);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return {
      socket,
      close: () => socket.close(),
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a Godot scene from raw data
 */
export function createGodotScene(data: {
  nodes: Array<{
    name: string;
    type: string;
    position: [number, number, number];
    velocity?: [number, number, number];
    mass?: number;
  }>;
  frame?: number;
  deltaTime?: number;
}): GodotScene {
  return {
    name: 'Scene',
    frame: data.frame ?? 0,
    deltaTime: data.deltaTime ?? 0.016,
    nodes: data.nodes.map(node => ({
      name: node.name,
      type: node.type,
      transform: {
        origin: node.position,
        basis: [1, 0, 0, 0, 1, 0, 0, 0, 1], // Identity matrix
      },
      velocity: node.velocity,
      physics: node.mass ? { mass: node.mass, enabled: true } : undefined,
      visible: true,
      static: false,
      scale: [1, 1, 1],
    })),
  };
}

/**
 * Merge GPU processing results into scene statistics
 */
export interface SceneStats {
  nodeCount: number;
  avgSpeed: number;
  totalKineticEnergy: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  gpuMemoryUsed: number;
  processingTime: number;
}

export function calculateSceneStats(
  scene: GodotScene,
  gpuMetadata?: GPUProcessResponse['metadata']
): SceneStats {
  let totalSpeed = 0;
  let totalKE = 0;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const node of scene.nodes) {
    const pos = node.transform.origin;
    const vel = node.velocity || [0, 0, 0];
    const mass = node.physics?.mass ?? 1;
    const speed = Math.sqrt(vel[0] ** 2 + vel[1] ** 2 + vel[2] ** 2);

    totalSpeed += speed;
    totalKE += 0.5 * mass * speed ** 2;

    minX = Math.min(minX, pos[0]);
    minY = Math.min(minY, pos[1]);
    minZ = Math.min(minZ, pos[2]);
    maxX = Math.max(maxX, pos[0]);
    maxY = Math.max(maxY, pos[1]);
    maxZ = Math.max(maxZ, pos[2]);
  }

  return {
    nodeCount: scene.nodes.length,
    avgSpeed: scene.nodes.length > 0 ? totalSpeed / scene.nodes.length : 0,
    totalKineticEnergy: totalKE,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    gpuMemoryUsed: gpuMetadata?.gpuMemoryUsed ?? 0,
    processingTime: gpuMetadata?.executionTimeMs ?? 0,
  };
}

// ============================================================================
// Export
// ============================================================================

export default GodotPhysicsBridge;
