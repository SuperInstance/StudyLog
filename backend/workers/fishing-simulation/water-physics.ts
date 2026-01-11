/**
 * Water Physics - Simulation by Quality Tier
 *
 * Implements water simulation scaled for:
 * - MicroVerse (2D): Simple surface representation
 * - Luanti (Voxel): Isometric blocky water with basic waves
 * - OpenRTS (3D): Full physics with waves, reflections, caustics
 */

import {
  EngineTier,
  Vector3,
  Vector2,
  WaterState,
  WaterBodyType,
  WaterClarity,
  CurrentStrength,
  WaveVertex,
  FoamParticle,
  RenderQuality
} from './types';
import { RENDER_QUALITY_PRESETS } from './types';

// ============================================================================
// WATER SIMULATION BASE
// ============================================================================

/**
 * Base water simulation interface
 */
interface WaterSimulation {
  update(deltaTime: number, time: number): void;
  getHeightAt(position: Vector3): number;
  getVelocityAt(position: Vector3): Vector3;
  getNormalAt(position: Vector3): Vector3;
  getRenderData(): WaterRenderData;
}

/**
 * Render data for each tier
 */
interface WaterRenderData {
  vertices: Float32Array;
  indices: Uint16Array;
  foam?: Float32Array;
  normal?: Float32Array;
  extra?: Record<string, Float32Array>; // Tier-specific extras
}

// ============================================================================
// MICROVERSE (2D) SIMULATION
// ============================================================================

/**
 * Simple 2D water simulation for MicroVerse tier
 */
export class MicroVerseWaterSimulation implements WaterSimulation {
  private waves: Wave2D[] = [];
  private surfaceLevel: number = 0;
  private width: number = 100;
  private resolution: number = 50; // Grid resolution

  constructor(state: WaterState) {
    this.surfaceLevel = 0;
    this.initializeWaves(state);
  }

  /**
   * Initialize simplified wave system
   */
  private initializeWaves(state: WaterState): void {
    // Primary wave
    this.waves.push({
      amplitude: state.waves.amplitude,
      frequency: state.waves.frequency,
      phase: 0,
      direction: Math.atan2(state.waves.direction.x, state.waves.direction.z)
    });

    // Secondary chop
    this.waves.push({
      amplitude: state.waves.amplitude * state.waves.chop,
      frequency: state.waves.frequency * 1.5,
      phase: Math.PI / 4,
      direction: Math.atan2(state.waves.direction.x, state.waves.direction.z) + Math.PI / 6
    });
  }

  /**
   * Update 2D simulation
   */
  update(deltaTime: number, time: number): void {
    // Advance wave phases
    for (const wave of this.waves) {
      wave.phase += wave.frequency * deltaTime;
    }
  }

  /**
   * Get height at position (simplified for 2D)
   */
  getHeightAt(position: Vector3): number {
    let height = this.surfaceLevel;

    for (const wave of this.waves) {
      const x = position.x;
      const z = position.z;
      const dist = Math.sqrt(x * x + z * z);

      height += Math.sin(dist * wave.frequency + wave.phase) * wave.amplitude;
    }

    return height;
  }

  /**
   * Get 2D velocity at position
   */
  getVelocityAt(position: Vector3): Vector3 {
    // Simple circular motion approximation
    const height = this.getHeightAt(position);
    return {
      x: Math.cos(Date.now() / 1000) * 0.1,
      y: 0,
      z: Math.sin(Date.now() / 1000) * 0.1
    };
  }

  /**
   * Get normal (flat for 2D)
   */
  getNormalAt(position: Vector3): Vector3 {
    return { x: 0, y: 1, z: 0 };
  }

  /**
   * Get render data for 2D sprites
   */
  getRenderData(): WaterRenderData {
    const vertexCount = this.resolution * this.resolution;
    const vertices = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array((this.resolution - 1) * (this.resolution - 1) * 6);

    let idx = 0;
    for (let z = 0; z < this.resolution; z++) {
      for (let x = 0; x < this.resolution; x++) {
        const worldX = (x / this.resolution) * this.width - this.width / 2;
        const worldZ = (z / this.resolution) * this.width - this.width / 2;

        vertices[idx++] = worldX;
        vertices[idx++] = this.getHeightAt({ x: worldX, y: 0, z: worldZ });
        vertices[idx++] = worldZ;
      }
    }

    // Generate indices for grid
    let iidx = 0;
    for (let z = 0; z < this.resolution - 1; z++) {
      for (let x = 0; x < this.resolution - 1; x++) {
        const tl = z * this.resolution + x;
        const tr = tl + 1;
        const bl = (z + 1) * this.resolution + x;
        const br = bl + 1;

        indices[iidx++] = tl;
        indices[iidx++] = bl;
        indices[iidx++] = tr;
        indices[iidx++] = tr;
        indices[iidx++] = bl;
        indices[iidx++] = br;
      }
    }

    return { vertices, indices };
  }

  /**
   * Get 2D surface color based on depth and clarity
   */
  getSurfaceColor(clarity: WaterClarity, depth: number): string {
    const colors: Record<WaterClarity, string> = {
      [WaterClarity.MURKY]: '#5D6D7E',
      [WaterClarity.STAINED]: '#5499C7',
      [WaterClarity.CLEAR]: '#2E86C1',
      [WaterClarity.VERY_CLEAR]: '#1A5276',
      [WaterClarity.CRYSTAL]: '#154360'
    };
    return colors[clarity];
  }
}

/**
 * 2D wave definition
 */
interface Wave2D {
  amplitude: number;
  frequency: number;
  phase: number;
  direction: number;
}

// ============================================================================
// LUANTI (VOXEL) SIMULATION
// ============================================================================

/**
 * Voxel-based water simulation for Luanti tier
 */
export class LuantiWaterSimulation implements WaterSimulation {
  private vertices: WaveVertex[] = [];
  private foamParticles: FoamParticle[] = [];
  private chunks: Map<string, VoxelWaterChunk> = new Map();
  private chunkSize: number = 16;
  private voxelSize: number = 1;

  constructor(state: WaterState, quality: RenderQuality) {
    this.initializeVertices(state, quality);
    this.initializeChunks(state);
  }

  /**
   * Initialize wave vertices for voxel grid
   */
  private initializeVertices(state: WaterState, quality: RenderQuality): void {
    const count = quality.waterVertices;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = Math.sqrt(i / count) * 50;

      this.vertices.push({
        position: {
          x: Math.cos(angle) * radius,
          y: 0,
          z: Math.sin(angle) * radius
        },
        height: 0,
        velocity: 0,
        targetHeight: 0
      });
    }
  }

  /**
   * Initialize voxel chunks
   */
  private initializeChunks(state: WaterState): void {
    const range = 3; // 3x3 chunks around origin

    for (let cx = -range; cx <= range; cx++) {
      for (let cz = -range; cz <= range; cz++) {
        const key = `${cx},${cz}`;
        this.chunks.set(key, {
          chunkX: cx,
          chunkZ: cz,
          voxels: this.generateChunkVoxels(cx, cz, state),
          flowDirection: state.current.direction
        });
      }
    }
  }

  /**
   * Generate voxels for a chunk
   */
  private generateChunkVoxels(cx: number, cz: number, state: WaterState): VoxelData[] {
    const voxels: VoxelData[] = [];

    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const worldX = cx * this.chunkSize + x;
        const worldZ = cz * this.chunkSize + z;

        // Calculate water depth at this position
        const depth = this.calculateDepthAt(worldX, worldZ, state);

        voxels.push({
          localX: x,
          localZ: z,
          waterLevel: 0,
          depth,
          isSurface: true,
          hasFlow: state.current.strength !== CurrentStrength.STILL
        });
      }
    }

    return voxels;
  }

  /**
   * Calculate water depth at position
   */
  private calculateDepthAt(x: number, z: number, state: WaterState): number {
    // Simple depth map based on distance from center
    const distFromCenter = Math.sqrt(x * x + z * z);
    return Math.max(1, state.depth - distFromCenter * 0.5);
  }

  /**
   * Update voxel simulation
   */
  update(deltaTime: number, time: number): void {
    // Update wave vertices
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];

      // Spring physics for surface waves
      const displacement = v.targetHeight - v.height;
      const acceleration = displacement * 2 - v.velocity * 0.5;

      v.velocity += acceleration * deltaTime;
      v.height += v.velocity * deltaTime;

      // Calculate target height based on wave function
      const waveOffset = Math.sin(time * 2 + i * 0.1) * 0.3;
      v.targetHeight = waveOffset;
    }

    // Update foam particles
    this.updateFoam(deltaTime);

    // Update chunks
    for (const chunk of this.chunks.values()) {
      this.updateChunk(chunk, deltaTime);
    }
  }

  /**
   * Update foam particles
   */
  private updateFoam(deltaTime: number): void {
    for (let i = this.foamParticles.length - 1; i >= 0; i--) {
      const p = this.foamParticles[i];

      p.position.x += p.velocity.x * deltaTime;
      p.position.z += p.velocity.z * deltaTime;
      p.life -= deltaTime * 0.5;

      if (p.life <= 0) {
        this.foamParticles.splice(i, 1);
      }
    }
  }

  /**
   * Update a single chunk
   */
  private updateChunk(chunk: VoxelWaterChunk, deltaTime: number): void {
    // Simulate water flow through voxels
    for (const voxel of chunk.voxels) {
      if (voxel.hasFlow) {
        // Update water level based on flow
        const flowIn = Math.sin(Date.now() / 1000 + voxel.localX) * 0.01;
        voxel.waterLevel += flowIn * deltaTime;
        voxel.waterLevel = Math.max(-1, Math.min(1, voxel.waterLevel));
      }
    }
  }

  /**
   * Get height at position (voxel-based)
   */
  getHeightAt(position: Vector3): number {
    // Find nearest vertex
    let nearest = this.vertices[0];
    let minDist = Infinity;

    for (const v of this.vertices) {
      const dist = Math.sqrt(
        (v.position.x - position.x) ** 2 +
        (v.position.z - position.z) ** 2
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = v;
      }
    }

    return nearest.height;
  }

  /**
   * Get velocity at position (voxel flow)
   */
  getVelocityAt(position: Vector3): Vector3 {
    // Find chunk
    const cx = Math.floor(position.x / this.chunkSize);
    const cz = Math.floor(position.z / this.chunkSize);
    const chunk = this.chunks.get(`${cx},${cz}`);

    if (!chunk || !chunk.voxels.length) {
      return { x: 0, y: 0, z: 0 };
    }

    // Get flow from chunk
    return {
      x: chunk.flowDirection.x * 0.5,
      y: 0,
      z: chunk.flowDirection.z * 0.5
    };
  }

  /**
   * Get normal at position
   */
  getNormalAt(position: Vector3): Vector3 {
    const delta = 0.1;
    const h = this.getHeightAt(position);
    const hx = this.getHeightAt({ x: position.x + delta, y: 0, z: position.z });
    const hz = this.getHeightAt({ x: position.x, y: 0, z: position.z + delta });

    // Calculate normal from height differences
    const normal = {
      x: (h - hx) / delta,
      y: 1,
      z: (h - hz) / delta
    };

    // Normalize
    const len = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
    return {
      x: normal.x / len,
      y: normal.y / len,
      z: normal.z / len
    };
  }

  /**
   * Get render data for voxel water
   */
  getRenderData(): WaterRenderData {
    // Generate isometric voxel render data
    const vertexCount = this.vertices.length;
    const vertices = new Float32Array(vertexCount * 3);
    const indices = new Uint16Array(vertexCount * 6); // Simple quads

    let idx = 0;
    let iidx = 0;

    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];

      vertices[idx++] = v.position.x;
      vertices[idx++] = v.height;
      vertices[idx++] = v.position.z;

      // Simple quad indices
      if (i < this.vertices.length - 1) {
        indices[iidx++] = i;
        indices[iidx++] = i + 1;
        indices[iidx++] = i;
        indices[iidx++] = i + 1;
      }
    }

    return { vertices, indices };
  }

  /**
   * Get voxel block color (blocky style)
   */
  getVoxelColor(clarity: WaterClarity): { top: string; side: string } {
    const colors: Record<WaterClarity, { top: string; side: string }> = {
      [WaterClarity.MURKY]: { top: '#6B7B8A', side: '#4A5560' },
      [WaterClarity.STAINED]: { top: '#5DADE2', side: '#3498DB' },
      [WaterClarity.CLEAR]: { top: '#3498DB', side: '#2980B9' },
      [WaterClarity.VERY_CLEAR]: { top: '#2E86C1', side: '#1F618D' },
      [WaterClarity.CRYSTAL]: { top: '#1A5276', side: '#154360' }
    };
    return colors[clarity];
  }
}

/**
 * Voxel water chunk
 */
interface VoxelWaterChunk {
  chunkX: number;
  chunkZ: number;
  voxels: VoxelData[];
  flowDirection: Vector3;
}

/**
 * Single voxel data
 */
interface VoxelData {
  localX: number;
  localZ: number;
  waterLevel: number;
  depth: number;
  isSurface: boolean;
  hasFlow: boolean;
}

// ============================================================================
// OPENRTS (3D) SIMULATION
// ============================================================================

/**
 * Full 3D water simulation for OpenRTS tier
 */
export class OpenRTSWaterSimulation implements WaterSimulation {
  private vertices: WaveVertex[] = [];
  private foamParticles: FoamParticle[] = [];
  private waves: Wave3D[] = [];
  private gridSize: number = 100;
  private gridResolution: number = 100;

  // Advanced features
  private causticsEnabled: boolean;
  private reflectionEnabled: boolean;
  private fftSimulation: FFTWaterSimulation | null = null;

  constructor(state: WaterState, quality: RenderQuality) {
    this.causticsEnabled = quality.underwaterCaustics;
    this.reflectionEnabled = quality.reflectionQuality === 'planar';

    this.initializeWaves(state);
    this.initializeVertices(state, quality);
    this.initializeFoam(state);

    if (quality.waveComplexity > 0.7) {
      this.fftSimulation = new FFTWaterSimulation(64);
    }
  }

  /**
   * Initialize wave system
   */
  private initializeWaves(state: WaterState): void {
    // Primary swell wave
    this.waves.push({
      amplitude: state.waves.amplitude,
      wavelength: 20,
      frequency: state.waves.frequency,
      direction: { ...state.waves.direction },
      steepness: 0.5
    });

    // Secondary wave
    this.waves.push({
      amplitude: state.waves.amplitude * 0.5,
      wavelength: 10,
      frequency: state.waves.frequency * 1.3,
      direction: {
        x: state.waves.direction.z,
        y: 0,
        z: -state.waves.direction.x
      },
      steepness: 0.3
    });

    // Chop wave
    this.waves.push({
      amplitude: state.waves.amplitude * state.waves.chop,
      wavelength: 5,
      frequency: state.waves.frequency * 2,
      direction: {
        x: -state.waves.direction.x * 0.5,
        y: 0,
        z: -state.waves.direction.z * 0.5
      },
      steepness: 0.2
    });
  }

  /**
   * Initialize grid vertices
   */
  private initializeVertices(state: WaterState, quality: RenderQuality): void {
    const resolution = Math.min(quality.waterVertices, 10000);
    this.gridResolution = Math.floor(Math.sqrt(resolution));

    for (let z = 0; z < this.gridResolution; z++) {
      for (let x = 0; x < this.gridResolution; x++) {
        const worldX = (x / this.gridResolution) * this.gridSize - this.gridSize / 2;
        const worldZ = (z / this.gridResolution) * this.gridSize - this.gridSize / 2;

        this.vertices.push({
          position: { x: worldX, y: 0, z: worldZ },
          height: 0,
          velocity: 0,
          targetHeight: 0
        });
      }
    }
  }

  /**
   * Initialize foam particles
   */
  private initializeFoam(state: WaterState): void {
    if (!state.foamParticles) return;

    const count = 500;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 40;

      this.foamParticles.push({
        position: {
          x: Math.cos(angle) * radius,
          y: 0.1,
          z: Math.sin(angle) * radius
        },
        velocity: {
          x: (Math.random() - 0.5) * 0.5,
          y: 0,
          z: (Math.random() - 0.5) * 0.5
        },
        life: Math.random(),
        size: 0.1 + Math.random() * 0.3
      });
    }
  }

  /**
   * Update 3D simulation
   */
  update(deltaTime: number, time: number): void {
    // Update FFT if available
    if (this.fftSimulation) {
      this.fftSimulation.update(deltaTime);
    }

    // Update vertices with wave superposition
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      let height = 0;
      let velX = 0;
      let velZ = 0;

      // Superimpose all waves
      for (const wave of this.waves) {
        const k = (2 * Math.PI) / wave.wavelength;
        const omega = 2 * Math.PI * wave.frequency;

        // Phase based on position and time
        const phase = k * (
          v.position.x * wave.direction.x +
          v.position.z * wave.direction.z
        ) - omega * time;

        // Gerstner wave displacement
        const displacement = Math.sin(phase);

        // Calculate height
        height += wave.amplitude * displacement;

        // Calculate horizontal displacement (choppiness)
        const steepnessFactor = wave.steepness * wave.amplitude * k;
        velX += steepnessFactor * Math.cos(phase) * wave.direction.x;
        velZ += steepnessFactor * Math.cos(phase) * wave.direction.z;
      }

      v.height = height;
      v.velocity = Math.sqrt(velX ** 2 + velZ ** 2);
    }

    // Update foam
    this.updateFoam(deltaTime, time);
  }

  /**
   * Update foam particles
   */
  private updateFoam(deltaTime: number, time: number): void {
    for (let i = this.foamParticles.length - 1; i >= 0; i--) {
      const p = this.foamParticles[i];

      // Move with water surface
      const surfaceVel = this.getVelocityAt(p.position);
      p.velocity.x = surfaceVel.x * 0.8;
      p.velocity.z = surfaceVel.z * 0.8;

      p.position.x += p.velocity.x * deltaTime;
      p.position.z += p.velocity.z * deltaTime;

      // Height follows surface
      p.position.y = this.getHeightAt(p.position);

      // Fade out
      p.life -= deltaTime * 0.3;

      // Respawn if dead
      if (p.life <= 0) {
        p.life = 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 40;
        p.position.x = Math.cos(angle) * radius;
        p.position.z = Math.sin(angle) * radius;
      }
    }
  }

  /**
   * Get height at position using wave superposition
   */
  getHeightAt(position: Vector3): number {
    let height = 0;

    for (const wave of this.waves) {
      const k = (2 * Math.PI) / wave.wavelength;
      const phase = k * (
        position.x * wave.direction.x +
        position.z * wave.direction.z
      );
      height += wave.amplitude * Math.sin(phase);
    }

    return height;
  }

  /**
   * Get velocity at position
   */
  getVelocityAt(position: Vector3): Vector3 {
    let velX = 0;
    let velZ = 0;

    for (const wave of this.waves) {
      const k = (2 * Math.PI) / wave.wavelength;
      const phase = k * (
        position.x * wave.direction.x +
        position.z * wave.direction.z
      );
      const steepnessFactor = wave.steepness * wave.amplitude * k;

      velX += steepnessFactor * Math.cos(phase) * wave.direction.x;
      velZ += steepnessFactor * Math.cos(phase) * wave.direction.z;
    }

    return { x: velX, y: 0, z: velZ };
  }

  /**
   * Get normal at position with proper wave calculation
   */
  getNormalAt(position: Vector3): Vector3 {
    const epsilon = 0.1;

    const h = this.getHeightAt(position);
    const hx = this.getHeightAt({ x: position.x + epsilon, y: 0, z: position.z });
    const hz = this.getHeightAt({ x: position.x, y: 0, z: position.z + epsilon });

    // Calculate tangent vectors
    const tangentX = { x: epsilon, y: hx - h, z: 0 };
    const tangentZ = { x: 0, y: hz - h, z: epsilon };

    // Cross product for normal
    const normal = {
      x: -tangentX.y * tangentZ.z,
      y: tangentX.x * tangentZ.z,
      z: -tangentX.x * tangentZ.y
    };

    // Normalize
    const len = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
    return {
      x: normal.x / len,
      y: normal.y / len,
      z: normal.z / len
    };
  }

  /**
   * Get full render data
   */
  getRenderData(): WaterRenderData {
    const vertexCount = this.vertices.length;
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const foam = new Float32Array(this.foamParticles.length * 3);

    // Fill vertex data
    let idx = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      vertices[idx++] = v.position.x;
      vertices[idx++] = v.height;
      vertices[idx++] = v.position.z;
    }

    // Fill normal data
    idx = 0;
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i];
      const normal = this.getNormalAt(v.position);
      normals[idx++] = normal.x;
      normals[idx++] = normal.y;
      normals[idx++] = normal.z;
    }

    // Fill foam data
    idx = 0;
    for (const p of this.foamParticles) {
      foam[idx++] = p.position.x;
      foam[idx++] = p.position.y;
      foam[idx++] = p.position.z;
    }

    // Generate indices
    const indices = this.generateIndices();

    const extra: Record<string, Float32Array> = {
      normals,
      foam
    };

    return { vertices, indices, normal: normals, extra };
  }

  /**
   * Generate triangle indices for grid
   */
  private generateIndices(): Uint16Array {
    const indexCount = (this.gridResolution - 1) * (this.gridResolution - 1) * 6;
    const indices = new Uint16Array(indexCount);

    let idx = 0;
    for (let z = 0; z < this.gridResolution - 1; z++) {
      for (let x = 0; x < this.gridResolution - 1; x++) {
        const tl = z * this.gridResolution + x;
        const tr = tl + 1;
        const bl = (z + 1) * this.gridResolution + x;
        const br = bl + 1;

        indices[idx++] = tl;
        indices[idx++] = bl;
        indices[idx++] = tr;
        indices[idx++] = tr;
        indices[idx++] = bl;
        indices[idx++] = br;
      }
    }

    return indices;
  }

  /**
   * Get caustics texture data
   */
  getCausticsData(): Float32Array | null {
    if (!this.causticsEnabled) return null;

    // Simplified caustics pattern
    const size = 64;
    const data = new Float32Array(size * size);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size;
        const ny = y / size;

        // Caustic-like pattern using overlapping waves
        const v1 = Math.sin(nx * 10 + Date.now() / 1000) * Math.cos(ny * 10);
        const v2 = Math.sin(nx * 15 - Date.now() / 800) * Math.cos(ny * 15);

        data[y * size + x] = (v1 + v2) * 0.5 + 0.5;
      }
    }

    return data;
  }
}

/**
 * 3D wave definition
 */
interface Wave3D {
  amplitude: number;
  wavelength: number;
  frequency: number;
  direction: Vector3;
  steepness: number;
}

/**
 * FFT-based water simulation for highest quality
 */
class FFTWaterSimulation {
  private size: number;
  private data: Float32Array;

  constructor(size: number) {
    this.size = size;
    this.data = new Float32Array(size * size);
  }

  update(deltaTime: number): void {
    // Simplified FFT update (real implementation would use actual FFT)
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] += Math.sin(i + Date.now() / 1000) * 0.01;
    }
  }

  getData(): Float32Array {
    return this.data;
  }
}

// ============================================================================
// WATER SIMULATION FACTORY
// ============================================================================

/**
 * Factory for creating tier-appropriate water simulation
 */
export class WaterSimulationFactory {
  /**
   * Create water simulation for specified tier
   */
  static create(
    tier: EngineTier,
    state: WaterState
  ): WaterSimulation {
    const quality = RENDER_QUALITY_PRESETS[tier];

    switch (tier) {
      case EngineTier.MICROVERSE:
        return new MicroVerseWaterSimulation(state);

      case EngineTier.LUANTI:
        return new LuantiWaterSimulation(state, quality);

      case EngineTier.OPENRTS:
        return new OpenRTSWaterSimulation(state, quality);

      default:
        return new MicroVerseWaterSimulation(state);
    }
  }

  /**
   * Get water color for tier
   */
  static getWaterColor(
    tier: EngineTier,
    clarity: WaterClarity,
    depth: number
  ): string {
    const baseColors: Record<WaterClarity, { r: number; g: number; b: number }> = {
      [WaterClarity.MURKY]: { r: 93, g: 109, b: 126 },
      [WaterClarity.STAINED]: { r: 84, g: 153, b: 199 },
      [WaterClarity.CLEAR]: { r: 46, g: 134, b: 193 },
      [WaterClarity.VERY_CLEAR]: { r: 26, g: 82, b: 118 },
      [WaterClarity.CRYSTAL]: { r: 21, g: 67, b: 96 }
    };

    const base = baseColors[clarity];

    // Adjust for depth
    const depthFactor = Math.min(1, depth / 50);
    const r = Math.floor(base.r * (1 - depthFactor * 0.5));
    const g = Math.floor(base.g * (1 - depthFactor * 0.3));
    const b = Math.floor(base.b * (1 - depthFactor * 0.1));

    return `rgb(${r}, ${g}, ${b})`;
  }
}

// ============================================================================
// WATER STATE MANAGEMENT
// ============================================================================

/**
 * Creates initial water state
 */
export function createWaterState(
  type: WaterBodyType,
  clarity: WaterClarity,
  depth: number,
  temperature: number
): WaterState {
  return {
    type,
    clarity,
    depth,
    surfaceArea: type === WaterBodyType.POND ? 10000 : 1000000,
    temperature,
    thermoclineDepth: depth * 0.3,
    current: {
      direction: { x: 1, y: 0, z: 0 },
      strength: type === WaterBodyType.RIVER ? CurrentStrength.MODERATE : CurrentStrength.SLIGHT,
      speed: type === WaterBodyType.RIVER ? 2 : 0.1
    },
    waves: {
      amplitude: type === WaterBodyType.OCEAN ? 2 : 0.3,
      frequency: 1,
      direction: { x: 1, y: 0, z: 0 },
      chop: 0.5
    },
    vertices: [],
    foamParticles: []
  };
}

/**
 * Update water state based on weather
 */
export function updateWaterWithWeather(
  water: WaterState,
  windSpeed: number,
  precipitationIntensity: number
): WaterState {
  // Wind affects waves
  const waveAmplitude = water.type === WaterBodyType.OCEAN ?
    2 + windSpeed * 0.3 :
    0.3 + windSpeed * 0.05;

  const waveChop = Math.min(1, 0.5 + windSpeed * 0.1);

  // Rain affects surface
  const foamCount = precipitationIntensity > 0.5 ? 100 : 0;

  return {
    ...water,
    waves: {
      ...water.waves,
      amplitude: waveAmplitude,
      chop: waveChop
    }
  };
}

// ============================================================================
// WATER PHYSICS CONSTANTS
// ============================================================================

/**
 * Water physics constants
 */
export const WATER_PHYSICS = {
  DENSITY: 1000, // kg/m^3
  VISCOSITY: 0.001, // Pa·s at 20°C
  SURFACE_TENSION: 0.0728, // N/m at 20°C
  GRAVITY: 9.81, // m/s^2
  SPEED_OF_SOUND: 1482, // m/s at 20°C

  // Light absorption
  ABSORPTION_COEFFICIENT: {
    [WaterClarity.MURKY]: 2.0,
    [WaterClarity.STAINED]: 1.0,
    [WaterClarity.CLEAR]: 0.5,
    [WaterClarity.VERY_CLEAR]: 0.2,
    [WaterClarity.CRYSTAL]: 0.1
  },

  // Temperature ranges
  TEMPERATURE_DENSITY: {
    MAX_DENSITY_TEMP: 4, // °C, water is densest at 4°C
    FREEZING_POINT: 0,
    BOILING_POINT: 100
  }
};

/**
 * Calculate buoyancy force
 */
export function calculateBuoyancy(
  volume: number, // m^3
  fluidDensity: number = WATER_PHYSICS.DENSITY
): number {
  return volume * fluidDensity * WATER_PHYSICS.GRAVITY;
}

/**
 * Calculate drag force
 */
export function calculateDrag(
  velocity: number,
  area: number,
  dragCoefficient: number = 0.47, // Sphere
  fluidDensity: number = WATER_PHYSICS.DENSITY
): number {
  return 0.5 * fluidDensity * velocity ** 2 * dragCoefficient * area;
}
