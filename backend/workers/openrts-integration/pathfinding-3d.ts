/**
 * 3D Pathfinding System
 *
 * Handles 3D pathfinding with terrain awareness for OpenRTS integration.
 *
 * ## Features
 *
 * - A* pathfinding on terrain grid
 * - Terrain height consideration
 * - Slope-based movement cost
 * - Dynamic obstacle avoidance
 * - Path smoothing (string pulling)
 * - Multi-unit path coordination
 * - Cloud offloading support
 */

import type {
  Vector3,
  Vector2,
  TerrainHeightmap,
  PathNode,
  PathResult,
  PathRequest,
  UnitInstance,
  StructureInstance,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface PathfindingConfig {
  /** Grid cell size */
  cellSize: number;

  /** Height tolerance for movement */
  heightTolerance: number;

  /** Maximum slope angle (degrees) for walkable terrain */
  maxSlope: number;

  /** Diagonal movement cost multiplier */
  diagonalCost: number;

  /** Maximum path length */
  maxPathLength: number;

  /** Path smoothing enabled */
  smoothing: boolean;

  /** Smoothing iterations */
  smoothingIterations: number;

  /** Path cache enabled */
  cacheEnabled: boolean;

  /** Cache size */
  cacheSize: number;

  /** Thread count for parallel pathfinding */
  threads: number;
}

export const DEFAULT_PATHFINDING_CONFIG: PathfindingConfig = {
  cellSize: 2.0,
  heightTolerance: 1.0,
  maxSlope: 45,
  diagonalCost: 1.414,
  maxPathLength: 1000,
  smoothing: true,
  smoothingIterations: 3,
  cacheEnabled: true,
  cacheSize: 100,
  threads: 2,
};

// ============================================================================
// Navigation Grid
// ============================================================================

export interface NavigationGrid {
  /** Grid dimensions */
  width: number;
  depth: number;

  /** Cell size */
  cellSize: number;

  /** Grid nodes */
  nodes: PathNode[][];

  /** Terrain heightmap reference */
  heightmap: TerrainHeightmap;

  /** Static obstacles */
  obstacles: Set<string>;

  /** Dynamic obstacle reservations */
  reservations: Map<string, ObstacleReservation>;
}

export interface ObstacleReservation {
  position: Vector2;
  size: Vector2;
  unitId: string;
  expiresAt: number;
}

// ============================================================================
// Pathfinding Cache
// ============================================================================

export interface PathCacheEntry {
  start: Vector2;
  goal: Vector2;
  path: Vector3[];
  timestamp: number;
  hitCount: number;
}

// ============================================================================
// Pathfinding System Class
// ============================================================================

/**
 * 3D pathfinding system with terrain awareness
 */
export class Pathfinding3D {
  private grid: NavigationGrid | null = null;
  private pathCache: Map<string, PathCacheEntry> = new Map();
  private activeRequests: Map<string, PathRequest> = new Map();
  private nextRequestId: number = 0;

  constructor(
    private config: PathfindingConfig = DEFAULT_PATHFINDING_CONFIG
  ) {}

  // ========================================================================
  // Grid Management
  // ========================================================================

  /**
   * Build navigation grid from terrain
   */
  buildGrid(heightmap: TerrainHeightmap): NavigationGrid {
    const { width, depth } = heightmap;
    const nodes: PathNode[][] = [];

    // Create nodes
    for (let z = 0; z < depth; z++) {
      nodes[z] = [];
      for (let x = 0; x < width; x++) {
        const idx = z * width + x;
        const height = heightmap.heights[idx];

        nodes[z][x] = {
          position: { x, y: z },
          worldPosition: {
            x: x * this.config.cellSize,
            y: height,
            z: z * this.config.cellSize,
          },
          gCost: 0,
          hCost: 0,
          fCost: 0,
          walkable: this.isWalkable(heightmap, x, z),
          costMultiplier: this.getCostMultiplier(heightmap, x, z),
        };
      }
    }

    this.grid = {
      width,
      depth,
      cellSize: this.config.cellSize,
      nodes,
      heightmap,
      obstacles: new Set(),
      reservations: new Map(),
    };

    return this.grid;
  }

  /**
   * Update navigation grid (for dynamic changes)
   */
  updateGrid(
    structures: Map<string, StructureInstance>,
    units: Map<string, UnitInstance>
  ): void {
    if (!this.grid) return;

    // Clear old reservations
    const now = Date.now();
    for (const [unitId, reservation] of this.grid.reservations) {
      if (reservation.expiresAt < now) {
        this.grid.reservations.delete(unitId);
      }
    }

    // Mark structure obstacles
    this.grid.obstacles.clear();
    for (const [id, structure] of structures) {
      if (!structure.isUnderConstruction) {
        this.grid.obstacles.add(id);
      }
    }
  }

  /**
   * Check if grid cell is walkable
   */
  isWalkable(heightmap: TerrainHeightmap, x: number, z: number): boolean {
    if (x < 0 || x >= heightmap.width || z < 0 || z >= heightmap.depth) {
      return false;
    }

    const idx = z * heightmap.x + x;
    const height = heightmap.heights[idx];

    // Check for steep slopes
    const slope = this.calculateSlope(heightmap, x, z);
    if (slope > this.config.maxSlope) {
      return false;
    }

    return true;
  }

  /**
   * Get movement cost multiplier for cell
   */
  getCostMultiplier(heightmap: TerrainHeightmap, x: number, z: number): number {
    const slope = this.calculateSlope(heightmap, x, z);

    // Increase cost for steep terrain
    if (slope < 10) return 1.0;
    if (slope < 20) return 1.5;
    if (slope < 30) return 2.0;
    return 3.0;
  }

  /**
   * Calculate slope angle at position
   */
  calculateSlope(heightmap: TerrainHeightmap, x: number, z: number): number {
    const { width, depth, heights } = heightmap;

    // Get neighboring heights
    const h = heights[z * width + x];
    const hRight = x < width - 1 ? heights[z * width + x + 1] : h;
    const hDown = z < depth - 1 ? heights[(z + 1) * width + x] : h;

    // Calculate slope
    const dx = (hRight - h) / this.config.cellSize;
    const dy = (hDown - h) / this.config.cellSize;
    const slope = Math.atan(Math.sqrt(dx * dx + dy * dy)) * (180 / Math.PI);

    return slope;
  }

  // ========================================================================
  // Pathfinding
  // ========================================================================

  /**
   * Find path from start to goal
   */
  async findPath(request: PathRequest): Promise<PathResult> {
    if (!this.grid) {
      return {
        success: false,
        path: [],
        length: 0,
        travelTime: 0,
        nodes: [],
      };
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedPath(request.start, request.goal);
      if (cached) {
        return {
          success: true,
          path: cached.path,
          length: this.calculatePathLength(cached.path),
          travelTime: this.calculateTravelTime(cached.path, 5),
          nodes: [],
        };
      }
    }

    // Convert world positions to grid coordinates
    const startNode = this.worldToGrid(request.start);
    const goalNode = this.worldToGrid(request.goal);

    if (!this.isValidNode(startNode) || !this.isValidNode(goalNode)) {
      return {
        success: false,
        path: [],
        length: 0,
        travelTime: 0,
        nodes: [],
      };
    }

    // Run A* algorithm
    const result = this.astar(startNode, goalNode, request);

    // Convert grid path to world path
    const worldPath = this.gridToWorld(result.path);

    // Apply smoothing if enabled
    const smoothedPath = this.config.smoothing
      ? this.smoothPath(worldPath, request.start, request.goal)
      : worldPath;

    // Cache the result
    if (result.success && this.config.cacheEnabled) {
      this.cachePath(request.start, request.goal, smoothedPath);
    }

    return {
      success: result.success,
      path: smoothedPath,
      length: this.calculatePathLength(smoothedPath),
      travelTime: this.calculateTravelTime(smoothedPath, 5),
      nodes: result.nodes,
    };
  }

  /**
   * A* pathfinding algorithm
   */
  private astar(
    start: Vector2,
    goal: Vector2,
    request: PathRequest
  ): { success: boolean; path: Vector2[]; nodes: PathNode[] } {
    const openSet: PathNode[] = [];
    const closedSet: Set<string> = new Set();
    const cameFrom: Map<string, PathNode> = new Map();
    const gScore: Map<string, number> = new Map();
    const nodes: PathNode[] = [];

    if (!this.grid) {
      return { success: false, path: [], nodes: [] };
    }

    const startKey = `${start.x},${start.y}`;
    const goalKey = `${goal.x},${goal.y}`;

    // Initialize start node
    const startNode = this.grid.nodes[start.y][start.x];
    startNode.gCost = 0;
    startNode.hCost = this.heuristic(start, goal);
    startNode.fCost = startNode.hCost;

    openSet.push(startNode);
    gScore.set(startKey, 0);

    let iterations = 0;
    const maxIterations = this.config.maxPathLength * 2;

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Get node with lowest fCost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift()!;
      const currentKey = `${current.position.x},${current.position.y}`;

      nodes.push(current);

      // Check if we reached the goal
      if (current.position.x === goal.x && current.position.y === goal.y) {
        return {
          success: true,
          path: this.reconstructPath(cameFrom, current),
          nodes,
        };
      }

      closedSet.add(currentKey);

      // Check neighbors
      const neighbors = this.getNeighbors(current);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.position.x},${neighbor.position.y}`;

        if (closedSet.has(neighborKey) || !neighbor.walkable) {
          continue;
        }

        // Check for dynamic obstacles
        if (this.isObstacle(neighbor.position, request.unitId)) {
          continue;
        }

        const tentativeGScore = gScore.get(currentKey)! +
          this.getDistance(current, neighbor) * neighbor.costMultiplier;

        if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentativeGScore);
          neighbor.gCost = tentativeGScore;
          neighbor.hCost = this.heuristic(neighbor.position, goal);
          neighbor.fCost = neighbor.gCost + neighbor.hCost;

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    // No path found - try partial path
    if (cameFrom.size > 0) {
      return {
        success: request.allowPartial,
        path: this.reconstructPath(cameFrom, nodes[nodes.length - 1]),
        nodes,
      };
    }

    return { success: false, path: [], nodes };
  }

  /**
   * Get neighboring nodes
   */
  private getNeighbors(node: PathNode): PathNode[] {
    if (!this.grid) return [];

    const { x, y } = node.position;
    const neighbors: PathNode[] = [];

    // 8-directional movement
    const directions: [number, number, number][] = [
      [0, -1, 1],        // N
      [1, -1, this.config.diagonalCost],  // NE
      [1, 0, 1],        // E
      [1, 1, this.config.diagonalCost],   // SE
      [0, 1, 1],        // S
      [-1, 1, this.config.diagonalCost],  // SW
      [-1, 0, 1],       // W
      [-1, -1, this.config.diagonalCost], // NW
    ];

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < this.grid.width && ny >= 0 && ny < this.grid.depth) {
        neighbors.push(this.grid.nodes[ny][nx]);
      }
    }

    return neighbors;
  }

  /**
   * Check if position is obstructed
   */
  private isObstacle(gridPos: Vector2, excludeUnitId?: string): boolean {
    if (!this.grid) return false;

    const worldPos = {
      x: gridPos.x * this.config.cellSize,
      y: gridPos.y * this.config.cellSize,
    };

    // Check static obstacles
    for (const obstacleId of this.grid.obstacles) {
      // Would need to check actual obstacle positions
    }

    // Check dynamic reservations
    for (const [unitId, reservation] of this.grid.reservations) {
      if (excludeUnitId && unitId === excludeUnitId) continue;

      const dx = Math.abs(worldPos.x - reservation.position.x);
      const dy = Math.abs(worldPos.y - reservation.position.y);

      if (dx < reservation.size.x / 2 && dy < reservation.size.y / 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reserve path for unit (avoid collisions)
   */
  reservePath(unitId: string, path: Vector3[], duration: number): void {
    if (!this.grid) return;

    // Clear old reservation
    this.grid.reservations.delete(unitId);

    // Create new reservations along path
    const now = Date.now();
    const stepDuration = duration / path.length;

    for (let i = 0; i < path.length; i += 5) {
      const pos = path[i];
      this.grid.reservations.set(`${unitId}_${i}`, {
        position: { x: pos.x, y: pos.z },
        size: { x: 2, y: 2 },
        unitId,
        expiresAt: now + stepDuration * (i + 10),
      });
    }
  }

  // ========================================================================
  // Path Operations
  // ========================================================================

  /**
   * Reconstruct path from A* came_from map
   */
  private reconstructPath(cameFrom: Map<string, PathNode>, current: PathNode): Vector2[] {
    const path: Vector2[] = [current.position];

    let currentKey = `${current.position.x},${current.position.y}`;
    while (cameFrom.has(currentKey)) {
      current = cameFrom.get(currentKey)!;
      currentKey = `${current.position.x},${current.position.y}`;
      path.unshift(current.position);
    }

    return path;
  }

  /**
   * Smooth path using string pulling
   */
  private smoothPath(path: Vector3[], start: Vector3, goal: Vector3): Vector3[] {
    if (path.length <= 2) return path;

    const smoothed: Vector3[] = [start];
    let currentIndex = 0;

    while (currentIndex < path.length - 1) {
      let furthestIndex = path.length - 1;

      // Find furthest visible point
      for (let i = path.length - 1; i > currentIndex; i--) {
        if (this.hasLineOfSight(path[currentIndex], path[i])) {
          furthestIndex = i;
          break;
        }
      }

      smoothed.push(path[furthestIndex]);
      currentIndex = furthestIndex;
    }

    smoothed.push(goal);

    // Run multiple iterations
    for (let i = 1; i < this.config.smoothingIterations; i++) {
      this.iterativeSmoothing(smoothed);
    }

    return smoothed;
  }

  /**
   * Iterative path smoothing
   */
  private iterativeSmoothing(path: Vector3[]): void {
    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Average position
      path[i] = {
        x: (prev.x + curr.x * 2 + next.x) / 4,
        y: (prev.y + curr.y * 2 + next.y) / 4,
        z: (prev.z + curr.z * 2 + next.z) / 4,
      };
    }
  }

  /**
   * Check line of sight between two points
   */
  private hasLineOfSight(from: Vector3, to: Vector3): boolean {
    if (!this.grid) return true;

    const steps = Math.ceil(
      Math.sqrt(
        (to.x - from.x) ** 2 +
        (to.z - from.z) ** 2
      ) / this.config.cellSize
    );

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const z = from.z + (to.z - from.z) * t;

      const gridX = Math.floor(x / this.config.cellSize);
      const gridZ = Math.floor(z / this.config.cellSize);

      if (gridX < 0 || gridX >= this.grid.width ||
          gridZ < 0 || gridZ >= this.grid.depth) {
        return false;
      }

      const node = this.grid.nodes[gridZ][gridX];
      if (!node.walkable) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate path length
   */
  calculatePathLength(path: Vector3[]): number {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.sqrt(
        (path[i].x - path[i - 1].x) ** 2 +
        (path[i].y - path[i - 1].y) ** 2 +
        (path[i].z - path[i - 1].z) ** 2
      );
    }
    return length;
  }

  /**
   * Calculate travel time at given speed
   */
  calculateTravelTime(path: Vector3[], speed: number): number {
    return this.calculatePathLength(path) / speed;
  }

  // ========================================================================
  // Coordinate Conversion
  // ========================================================================

  /**
   * Convert world position to grid coordinates
   */
  worldToGrid(world: Vector3): Vector2 {
    return {
      x: Math.floor(world.x / this.config.cellSize),
      y: Math.floor(world.z / this.config.cellSize),
    };
  }

  /**
   * Convert grid path to world positions
   */
  gridToWorld(gridPath: Vector2[]): Vector3[] {
    if (!this.grid) return [];

    return gridPath.map((pos) => {
      const node = this.grid!.nodes[pos.y][pos.x];
      return {
        x: pos.x * this.config.cellSize,
        y: node.worldPosition.y,
        z: pos.y * this.config.cellSize,
      };
    });
  }

  /**
   * Check if grid coordinates are valid
   */
  private isValidNode(pos: Vector2): boolean {
    if (!this.grid) return false;
    return pos.x >= 0 && pos.x < this.grid.width &&
           pos.y >= 0 && pos.y < this.grid.depth;
  }

  // ========================================================================
  // Heuristics
  // ========================================================================

  /**
   * Heuristic function for A* (Euclidean distance)
   */
  private heuristic(from: Vector2, to: Vector2): number {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get distance between two nodes
   */
  private getDistance(from: PathNode, to: PathNode): number {
    const dx = Math.abs(from.position.x - to.position.x);
    const dy = Math.abs(from.position.y - to.position.y);

    if (dx === 1 && dy === 1) {
      return this.config.diagonalCost;
    }
    return 1;
  }

  // ========================================================================
  // Path Cache
  // ========================================================================

  /**
   * Get cached path if available
   */
  private getCachedPath(start: Vector3, goal: Vector3): PathCacheEntry | null {
    const key = this.getCacheKey(start, goal);
    const entry = this.pathCache.get(key);

    if (entry && Date.now() - entry.timestamp < 5000) {
      entry.hitCount++;
      return entry;
    }

    return null;
  }

  /**
   * Cache a path
   */
  private cachePath(start: Vector3, goal: Vector3, path: Vector3[]): void {
    // Remove oldest entry if cache is full
    if (this.pathCache.size >= this.config.cacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.pathCache) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        this.pathCache.delete(oldestKey);
      }
    }

    const key = this.getCacheKey(start, goal);
    this.pathCache.set(key, {
      start: { x: start.x, y: start.z },
      goal: { x: goal.x, y: goal.z },
      path,
      timestamp: Date.now(),
      hitCount: 0,
    });
  }

  /**
   * Generate cache key for positions
   */
  private getCacheKey(start: Vector3, goal: Vector3): string {
    const cellX = Math.floor(start.x / this.config.cellSize);
    const cellZ = Math.floor(start.z / this.config.cellSize);
    const goalX = Math.floor(goal.x / this.config.cellSize);
    const goalZ = Math.floor(goal.z / this.config.cellSize);

    return `${cellX},${cellZ}-${goalX},${goalZ}`;
  }

  /**
   * Clear path cache
   */
  clearCache(): void {
    this.pathCache.clear();
  }

  // ========================================================================
  // Multi-Unit Coordination
  // ========================================================================

  /**
   * Find paths for multiple units with collision avoidance
   */
  async findPathsBatch(requests: PathRequest[]): Promise<PathResult[]> {
    // Sort by priority (distance to goal)
    const sorted = [...requests].sort((a, b) => {
      const distA = this.heuristic(
        this.worldToGrid(a.start),
        this.worldToGrid(a.goal)
      );
      const distB = this.heuristic(
        this.worldToGrid(b.start),
        this.worldToGrid(b.goal)
      );
      return distB - distA;
    });

    const results: PathResult[] = [];

    for (const request of sorted) {
      const result = await this.findPath(request);
      results.push(result);

      // Reserve path for collision avoidance
      if (result.success) {
        this.reservePath(
          request.unitId,
          result.path,
          result.travelTime * 1000
        );
      }
    }

    return results;
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  /**
   * Update configuration
   */
  setConfig(config: Partial<PathfindingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.grid = null;
    this.pathCache.clear();
    this.activeRequests.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a pathfinding system with configuration
 */
export function createPathfinding(
  config?: Partial<PathfindingConfig>
): Pathfinding3D {
  return new Pathfinding3D({
    ...DEFAULT_PATHFINDING_CONFIG,
    ...config,
  });
}

/**
 * Create a cloud-offloaded pathfinding system
 */
export function createCloudPathfinding(
  endpoint: string,
  config?: Partial<PathfindingConfig>
): CloudPathfinding {
  return new CloudPathfinding(endpoint, {
    ...DEFAULT_PATHFINDING_CONFIG,
    ...config,
  });
}

// ============================================================================
// Cloud Pathfinding
// ============================================================================

/**
 * Cloud-based pathfinding for offloading heavy computation
 */
export class CloudPathfinding {
  private local: Pathfinding3D;

  constructor(
    private endpoint: string,
    config: PathfindingConfig
  ) {
    this.local = new Pathfinding3D(config);
  }

  /**
   * Find path using cloud or local fallback
   */
  async findPath(request: PathRequest): Promise<PathResult> {
    try {
      // Try cloud first
      const response = await fetch(`${this.endpoint}/pathfind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Cloud pathfinding failed, using local:', error);
    }

    // Fallback to local
    return this.local.findPath(request);
  }

  /**
   * Build local grid from terrain
   */
  buildGrid(heightmap: TerrainHeightmap): NavigationGrid {
    return this.local.buildGrid(heightmap);
  }

  setConfig(config: Partial<PathfindingConfig>): void {
    this.local.setConfig(config);
  }

  clear(): void {
    this.local.clear();
  }
}

export default Pathfinding3D;
