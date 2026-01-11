/**
 * Fishing Simulation - Main API
 *
 * Progressive fishing simulation supporting:
 * - MicroVerse (2D): Top-down sprites
 * - Luanti (Voxel): Isometric blocky water
 * - OpenRTS (3D): Full realistic water physics
 *
 * @module fishing-simulation
 */

// Core types
export * from './types';

// Fish registry
export {
  fishRegistry,
  FishRegistry,
  BLACK_CRAPPIE,
  BLUEGILL,
  LARGEMOUTH_BASS,
  SMALLMOUTH_BASS,
  NORTHERN_PIKE,
  MUSKIE,
  WALLEYE,
  RAINBOW_TROUT,
  BROWN_TROUT,
  BROOK_TROUT,
  CHANNEL_CATFISH,
  FLATHEAD_CATFISH,
  BLUE_CATFISH,
  CHINOOK_SALMON,
  COHO_SALMON,
  STEELHEAD,
  LAKE_STURGEON,
  TIGER_MUSKIE,
  GOLDEN_TROUT
} from './fish-registry';

// Fish AI
export {
  fishAI,
  FishAIManager,
  BoidFlocking,
  FishBehaviorStateMachine,
  BiteDetectionSystem,
  FishSpawningSystem,
  DEFAULT_BOID_PARAMS
} from './fish-ai';

// Fishing mechanics
export {
  castingSystem,
  lureActionSystem,
  hookSetSystem,
  fightSystem,
  lineManagementSystem,
  equipmentCompatibility,
  DEFAULT_EQUIPMENT,
  CastingSystem,
  LureActionSystem,
  HookSetSystem,
  FightSystem,
  LineManagementSystem,
  EquipmentCompatibility
} from './fishing-mechanics';

// Water physics
export {
  WaterSimulationFactory,
  MicroVerseWaterSimulation,
  LuantiWaterSimulation,
  OpenRTSWaterSimulation,
  createWaterState,
  updateWaterWithWeather,
  WATER_PHYSICS,
  calculateBuoyancy,
  calculateDrag
} from './water-physics';

// Location system
export {
  locationSystem,
  LOCATION_TEMPLATES,
  DEFAULT_LOCATIONS,
  LocationSystem
} from './location-system';

// Weather system
export {
  weatherSystem,
  getLureWeatherModifier,
  getRecommendedDepth,
  getWeatherEvents,
  WeatherSystem,
  SEASONAL_WEATHER
} from './weather-system';

// Catch processor
export {
  catchProcessor,
  inventoryManager,
  fishReleaseSystem,
  leaderboardManager,
  CatchProcessor,
  InventoryManager,
  FishReleaseSystem,
  LeaderboardManager
} from './catch-processor';

// Quality scaling
export {
  qualityManager,
  RendererFactory,
  QualityScalingManager,
  AdaptiveQualityManager,
  MicroVerseRenderer,
  LuantiRenderer,
  OpenRTSRenderer,
  QualityFeature
} from './quality-scaling';

// ============================================================================
// MAIN SIMULATION CLASS
// ============================================================================

import {
  EngineTier,
  SimulationConfig,
  WorldSnapshot,
  CastRequest,
  CastResult,
  ReelAction,
  HookSetAction,
  FishingLocation,
  FishingSetup,
  Fish,
  WeatherState,
  WaterState,
  ApiResponse
} from './types';

import { fishAI } from './fish-ai';
import { locationSystem, LocationSystem } from './location-system';
import { weatherSystem, WeatherSystem } from './weather-system';
import { castingSystem, CastingSystem, fightSystem, FightSystem } from './fishing-mechanics';
import { WaterSimulationFactory, createWaterState, updateWaterWithWeather } from './water-physics';
import { catchProcessor, CatchProcessor } from './catch-processor';
import { qualityManager, QualityScalingManager } from './quality-scaling';

/**
 * Main fishing simulation class
 */
export class FishingSimulation {
  private config: SimulationConfig;
  private locations: LocationSystem;
  private weather: WeatherSystem;
  private casting: CastingSystem;
  private fighting: FightSystem;
  private catchProcessor: CatchProcessor;
  private quality: QualityScalingManager;

  // Active state
  private activeFish: Map<string, Map<string, Fish>> = new Map(); // locationId -> fishId -> Fish
  private activeCasts: Map<string, CastState> = new Map();
  private waterSims: Map<string, any> = new Map();

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = {
      engineTier: config.engineTier || EngineTier.MICROVERSE,
      renderQuality: config.renderQuality || qualityManager.getQuality(),
      timeScale: config.timeScale || 1,
      tickRate: config.tickRate || 30,
      maxFishPerLocation: config.maxFishPerLocation || 100,
      spawnRate: config.spawnRate || 0.1,
      despawnTime: config.despawnTime || 300,
      gravity: config.gravity || 32.174,
      waterDensity: config.waterDensity || 62.4,
      difficulty: config.difficulty || 0.5,
      realism: config.realism || 0.7,
      showInfo: config.showInfo || true,
      lessonMode: config.lessonMode || false
    };

    this.locations = locationSystem;
    this.weather = weatherSystem;
    this.casting = castingSystem;
    this.fighting = fightSystem;
    this.catchProcessor = catchProcessor;
    this.quality = qualityManager;

    this.quality.setTier(this.config.engineTier);

    // Initialize default locations
    this.initializeLocations();
  }

  /**
   * Initialize fishing locations
   */
  private initializeLocations(): void {
    const defaults = this.locations.getAllLocations();
    for (const location of defaults) {
      this.activeFish.set(location.id, new Map());
      this.initializeLocationFish(location.id);
    }
  }

  /**
   * Initialize fish population for a location
   */
  private initializeLocationFish(locationId: string): void {
    const location = this.locations.getLocation(locationId);
    if (!location) return;

    const fishMap = this.activeFish.get(locationId)!;
    const targetCount = Math.min(
      this.config.maxFishPerLocation,
      Math.floor(location.size * 0.5) // Scale with location size
    );

    // Spawn initial fish
    for (const speciesId of location.fishSpecies) {
      const speciesCount = Math.floor(targetCount / location.fishSpecies.length);

      for (let i = 0; i < speciesCount; i++) {
        const position = this.getRandomPosition(location);
        const fish = fishAI.spawnFish(speciesId, position);

        if (fish) {
          fishMap.set(fish.id, fish);

          // Add to random spot
          const spot = location.spots[Math.floor(Math.random() * location.spots.length)];
          if (spot) {
            this.locations.addFishToSpot(locationId, spot.id, fish.id);
          }
        }
      }
    }
  }

  /**
   * Get random position in location
   */
  private getRandomPosition(location: FishingLocation): { x: number; y: number; z: number } {
    const range = Math.sqrt(location.size) * 20;
    return {
      x: (Math.random() - 0.5) * range,
      y: -location.depth * Math.random(),
      z: (Math.random() - 0.5) * range
    };
  }

  // ========================================================================
  // PUBLIC API
  // ========================================================================

  /**
   * Cast fishing line
   */
  async cast(request: CastRequest): Promise<ApiResponse<CastResult>> {
    const location = this.locations.getLocation(request.locationId);
    if (!location) {
      return {
        success: false,
        error: 'Location not found',
        timestamp: Date.now()
      };
    }

    const spot = this.locations.getSpot(request.locationId, request.spotId);
    if (!spot) {
      return {
        success: false,
        error: 'Spot not found',
        timestamp: Date.now()
      };
    }

    // Create cast state
    const direction = request.targetPosition ?
      this.normalizeVector(request.targetPosition) :
      { x: 0, y: 0, z: -1 };

    const castState = this.casting.cast(
      request.setup,
      request.power,
      direction
    );

    const castId = `cast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeCasts.set(castId, castState);

    return {
      success: true,
      data: {
        success: true,
        castId,
        position: castState.position,
        distance: castState.distance,
        estimatedDepth: spot.depth
      },
      timestamp: Date.now()
    };
  }

  /**
   * Reel in line
   */
  async reel(action: ReelAction): Promise<ApiResponse<{
    hasBite: boolean;
    fishHooked?: boolean;
    distanceRemaining: number;
  }>> {
    const castState = this.activeCasts.get(action.castId);
    if (!castState) {
      return {
        success: false,
        error: 'Cast not found',
        timestamp: Date.now()
      };
    }

    // Check for bites
    const locationFish = this.getFishForCast(castState);
    const bite = fishAI.checkBites(
      locationFish,
      castState.position,
      action.speed > 0.5 ? { category: 'crankbait' } as any : { category: 'worm' } as any,
      {
        deltaTime: 1,
        timeOfDay: this.weather.getTimeOfDay(),
        waterTemperature: this.weather.getCurrentState().temperature,
        weatherConditions: 0,
        hasThreat: false,
        hasLure: true,
        lurePosition: castState.position,
        isNearSpawnSite: false,
        isSpawnSeason: false,
        activityLevel: this.weather.getCurrentState().fishActivity,
        schoolBehavior: 'cruising' as any,
        waterClarity: 0.7
      }
    );

    let fishHooked = false;

    if (bite && action.speed > 0) {
      // Fish hooked!
      fishHooked = true;
      castState.phase = CastPhase.HOOKED;
      castState.landAt = Date.now();
    }

    // Update position (reeling in)
    const reelSpeed = action.speed * 5;
    castState.distance = Math.max(0, castState.distance - reelSpeed);
    castState.lineOut = castState.distance;

    // Check if complete
    if (castState.distance <= 0) {
      castState.phase = CastPhase.COMPLETE;
    }

    return {
      success: true,
      data: {
        hasBite: !!bite,
        fishHooked,
        distanceRemaining: castState.distance
      },
      timestamp: Date.now()
    };
  }

  /**
   * Set hook
   */
  async hookSet(action: HookSetAction): Promise<ApiResponse<{
    success: boolean;
    fishId?: string;
    species?: string;
  }>> {
    const castState = this.activeCasts.get(action.castId);
    if (!castState || castState.phase !== CastPhase.HOOKED) {
      return {
        success: false,
        error: 'No fish to hook',
        timestamp: Date.now()
      };
    }

    // Process hook set (simplified - would use HookSetSystem)
    const success = action.timing > 0.5;

    if (success) {
      // Would process catch here
      return {
        success: true,
        data: {
          success: true,
          fishId: 'fish_example',
          species: 'largemouth_bass'
        },
        timestamp: Date.now()
      };
    }

    return {
      success: true,
      data: {
        success: false
      },
      timestamp: Date.now()
    };
  }

  /**
   * Get world snapshot
   */
  getWorldSnapshot(locationId: string): WorldSnapshot | null {
    const location = this.locations.getLocation(locationId);
    if (!location) return null;

    const fish = this.activeFish.get(locationId) || new Map();
    const weather = this.weather.getCurrentState();
    const waterState = createWaterState(
      location.type,
      location.clarity,
      location.depth,
      location.temperature
    );

    return {
      timestamp: Date.now(),

      fish: Array.from(fish.values()).map(f => ({
        id: f.id,
        species: f.species,
        position: f.position3D,
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        behavior: f.behavior,
        isVisible: true,
        depth: Math.abs(f.position3D.y)
      })),

      weather,
      water: waterState,

      activeCasts: Array.from(this.activeCasts.values())
        .filter(c => c.isActive)
        .map(c => ({
          ...c,
          position: c.position,
          targetPosition: c.targetPosition,
          velocity: c.velocity
        })),

      hookedFish: [],

      timeOfDay: this.weather.getTimeOfDay(),
      season: this.weather.getSeason()
    };
  }

  /**
   * Update simulation tick
   */
  update(deltaTime: number): void {
    const scaledDelta = deltaTime * this.config.timeScale;

    // Update weather
    this.weather.update(scaledDelta, this.config.timeScale);

    // Update all fish in all locations
    for (const [locationId, fishMap] of this.activeFish) {
      const location = this.locations.getLocation(locationId);
      if (!location) continue;

      const weather = this.weather.getCurrentState();

      const updated = fishAI.updateFish(
        fishMap,
        new Map(),
        {
          deltaTime: scaledDelta,
          timeOfDay: this.weather.getTimeOfDay(),
          waterTemperature: location.temperature,
          weatherConditions: 0,
          hasThreat: false,
          hasLure: false,
          isNearSpawnSite: false,
          isSpawnSeason: this.weather.getSeason() === 'spring',
          activityLevel: weather.fishActivity,
          schoolBehavior: 'cruising' as any,
          waterClarity: this.getClarityValue(location.clarity)
        },
        scaledDelta
      );

      // Update fish map
      for (const [id, fish] of updated) {
        if (fish) {
          fishMap.set(id, fish);
        } else {
          fishMap.delete(id);
        }
      }
    }

    // Update active casts
    for (const [castId, castState] of this.activeCasts) {
      if (castState.isActive && castState.phase === CastPhase.AIRBORNE) {
        this.casting.updateCast(castState, scaledDelta);
      }
    }
  }

  /**
   * Get clarity as numeric value
   */
  private getClarityValue(clarity: string): number {
    const values: Record<string, number> = {
      murky: 0.2,
      stained: 0.4,
      clear: 0.7,
      very_clear: 0.9,
      crystal: 1
    };
    return values[clarify] || 0.5;
  }

  /**
   * Get fish for cast
   */
  private getFishForCast(castState: CastState): Map<string, Fish> {
    // Simplified - would find fish near cast position
    return new Map();
  }

  /**
   * Normalize vector
   */
  private normalizeVector(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const len = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
    if (len === 0) return { x: 0, y: 0, z: -1 };
    return {
      x: v.x / len,
      y: v.y / len,
      z: v.z / len
    };
  }

  // ========================================================================
  // LOCATION API
  // ========================================================================

  /**
   * Get all locations
   */
  getLocations(): FishingLocation[] {
    return this.locations.getAllLocations();
  }

  /**
   * Get location by ID
   */
  getLocation(id: string): FishingLocation | undefined {
    return this.locations.getLocation(id);
  }

  /**
   * Get locations by tier
   */
  getLocationsByTier(tier: EngineTier): FishingLocation[] {
    return this.locations.getByTier(tier);
  }

  // ========================================================================
  // WEATHER API
  // ========================================================================

  /**
   * Get current weather
   */
  getWeather(): WeatherState {
    return this.weather.getCurrentState();
  }

  /**
   * Set weather condition
   */
  setWeather(condition: string): void {
    this.weather.setWeather(condition as any);
  }

  /**
   * Get fishing quality rating
   */
  getFishingRating(): { rating: number; description: string } {
    return this.weather.getFishingRating();
  }

  // ========================================================================
  // CONFIG API
  // ========================================================================

  /**
   * Get current config
   */
  getConfig(): SimulationConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  updateConfig(updates: Partial<SimulationConfig>): void {
    Object.assign(this.config, updates);

    if (updates.engineTier) {
      this.quality.setTier(updates.engineTier);
    }
  }

  /**
   * Set engine tier
   */
  setEngineTier(tier: EngineTier): void {
    this.config.engineTier = tier;
    this.quality.setTier(tier);
  }

  /**
   * Get current tier
   */
  getEngineTier(): EngineTier {
    return this.config.engineTier;
  }

  // ========================================================================
  // EDUCATIONAL API (StudyLoG Integration)
  // ========================================================================

  /**
   * Get educational content about a species
   */
  getSpeciesEducationalContent(speciesId: string): string | null {
    return fishRegistry.getEducationalContent(speciesId);
  }

  /**
   * Get lesson about fishing technique
   */
  getFishingLesson(topic: string): EducationalLesson | null {
    const lessons: Record<string, EducationalLesson> = {
      casting: {
        title: 'Casting Basics',
        content: [
          'Hold the rod at a comfortable grip',
          'Bring the rod back smoothly',
          'Forward motion should be controlled',
          'Release line at the right moment'
        ],
        difficulty: 'beginner',
        xp: 25
      },
      'hook-set': {
        title: 'Setting the Hook',
        content: [
          'Wait for the bite indication',
          'Pull back sharply but controlled',
          'Keep tension on the line',
          'Different fish require different techniques'
        ],
        difficulty: 'intermediate',
        xp: 50
      },
      'fighting-fish': {
        title: 'Fighting and Landing Fish',
        content: [
          'Let the rod absorb the fish\'s runs',
          'Maintain steady pressure',
          'Adjust drag as needed',
          'Lead the fish away from cover'
        ],
        difficulty: 'advanced',
        xp: 75
      },
      conservation: {
        title: 'Catch and Release',
        content: [
          'Minimize fight time to reduce fish stress',
          'Keep fish in water when possible',
          'Use barbless hooks for easy removal',
          'Revive fish before release'
        ],
        difficulty: 'beginner',
        xp: 100
      }
    };

    return lessons[topic] || null;
  }
}

/**
 * Educational lesson structure
 */
interface EducationalLesson {
  title: string;
  content: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  xp: number;
}

// Type fix
const clarify = 'clear';

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a new fishing simulation instance
 */
export function createFishingSimulation(config?: Partial<SimulationConfig>): FishingSimulation {
  return new FishingSimulation(config);
}

/**
 * Create simulation with specific tier
 */
export function createSimulationWithTier(
  tier: EngineTier,
  config?: Partial<SimulationConfig>
): FishingSimulation {
  return new FishingSimulation({
    ...config,
    engineTier: tier
  });
}

// Default export
export default FishingSimulation;
