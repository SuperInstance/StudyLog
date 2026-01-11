/**
 * Ranch State Manager
 *
 * Handles save/load functionality for ranch simulation state.
 * Supports versioning for data migration and incremental saves.
 *
 * @fileoverview Ranch persistence and state management
 */

import type {
  RanchState,
  RanchSaveData,
  Animal,
  Herd,
  HerdingDog,
  EngineTier,
  AIComplexityStage,
  Position3D,
  RanchEvent,
} from './types.js';
import { AnimalAIController } from './animal-ai.js';
import { getSpecies } from './species-registry.js';

// ============================================================================
// Version Management
// ============================================================================

const CURRENT_VERSION = '1.0.0';

interface Migration {
  version: string;
  migrate: (data: any) => any;
}

const MIGRATIONS: Migration[] = [
  // Future migrations go here
  // Example:
  // {
  //   version: '1.1.0',
  //   migrate: (data) => {
  //     // Add new field
  //     if (!data.ranch.resources.waterLevel) {
  //       data.ranch.resources.waterLevel = 1.0;
  //     }
  //     return data;
  //   },
  // },
];

// ============================================================================
// Ranch State Manager Class
// ============================================================================

export class RanchStateManager {
  private cache: Map<string, RanchState> = new Map();
  private autoSaveEnabled = true;
  private autoSaveInterval = 60000; // 1 minute
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  // ============================================================================
  // Ranch Creation
  // ============================================================================

  /**
   * Create a new ranch state.
   */
  createRanch(
    ownerId: string,
    name: string,
    engineTier: EngineTier = EngineTier.MICROVERSE_2D
  ): RanchState {
    const ranch: RanchState = {
      id: crypto.randomUUID(),
      ownerId,
      name,
      engineTier,
      aiStage: AIComplexityStage.SIMPLE,
      dimensions: {
        width: 50,
        height: 50,
        depth: engineTier === EngineTier.OPENRTS_3D ? 50 : undefined,
      },
      animals: {},
      herds: {},
      dogs: [],
      unlockedFeatures: {
        dogTraining: engineTier >= EngineTier.MICROVERSE_2D,
        herdAnimals: false,
        advancedHerding: false,
        terrainFeatures: engineTier === EngineTier.OPENRTS_3D,
      },
      resources: {
        grassQuality: 1.0,
        waterLevel: 1.0,
        fenceIntegrity: 1.0,
      },
      stats: {
        animalsRaised: 0,
        trainingSessions: 0,
        establishedAt: Date.now(),
        lastUpdate: Date.now(),
      },
      version: CURRENT_VERSION,
    };

    this.cache.set(ranch.id, ranch);
    this.scheduleAutoSave(ranch.id);

    return ranch;
  }

  // ============================================================================
  // Save Operations
  // ============================================================================

  /**
   * Save ranch state to a serializable format.
   */
  saveRanch(ranchId: string): RanchSaveData | null {
    const ranch = this.getRanch(ranchId);
    if (!ranch) return null;

    // Update last update time
    ranch.stats.lastUpdate = Date.now();

    const saveData: RanchSaveData = {
      ranch: this.sanitizeForSave(ranch),
      metadata: {
        savedAt: Date.now(),
        version: CURRENT_VERSION,
        checksum: this.calculateChecksum(ranch),
      },
    };

    return saveData;
  }

  /**
   * Serialize ranch state (remove circular references).
   */
  private sanitizeForSave(ranch: RanchState): any {
    const sanitized: any = { ...ranch };

    // Deep clone animals without circular species reference
    sanitized.animals = {};
    for (const [id, animal] of Object.entries(ranch.animals)) {
      sanitized.animals[id] = {
        ...animal,
        species: undefined, // Will be reloaded from registry
      };
    }

    // Deep clone herds
    sanitized.herds = {};
    for (const [id, herd] of Object.entries(ranch.herds)) {
      sanitized.herds[id] = { ...herd };
    }

    return sanitized;
  }

  /**
   * Calculate checksum for save data verification.
   */
  private calculateChecksum(ranch: RanchState): string {
    const data = JSON.stringify({
      animalCount: Object.keys(ranch.animals).length,
      herdCount: Object.keys(ranch.herds).length,
      stats: ranch.stats,
    });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ============================================================================
  // Load Operations
  // ============================================================================

  /**
   * Load ranch state from save data.
   */
  loadRanch(saveData: RanchSaveData): RanchState | null {
    // Verify checksum
    const expectedChecksum = this.calculateChecksum(saveData.ranch);
    if (saveData.metadata.checksum !== expectedChecksum) {
      console.warn('Checksum mismatch during ranch load');
    }

    // Run migrations if needed
    let ranch = saveData.ranch;
    ranch = this.runMigrations(ranch, saveData.metadata.version);

    // Rehydrate species references
    for (const [id, animal] of Object.entries(ranch.animals)) {
      const species = getSpecies(animal.speciesId);
      if (species) {
        (animal as any).species = species;
      } else {
        console.warn(`Unknown species in save: ${animal.speciesId}`);
      }
    }

    this.cache.set(ranch.id, ranch);
    this.scheduleAutoSave(ranch.id);

    return ranch;
  }

  /**
   * Run migrations on old save data.
   */
  private runMigrations(ranch: any, fromVersion: string): any {
    let data = { ranch, metadata: { version: fromVersion } };

    // Apply migrations in order
    for (const migration of MIGRATIONS) {
      if (this.compareVersions(fromVersion, migration.version) < 0) {
        data = migration.migrate(data);
        data.metadata.version = migration.version;
      }
    }

    return data.ranch;
  }

  /**
   * Compare semantic versions.
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }

    return 0;
  }

  // ============================================================================
  // Ranch Queries
  // ============================================================================

  /**
   * Get ranch by ID.
   */
  getRanch(ranchId: string): RanchState | undefined {
    return this.cache.get(ranchId);
  }

  /**
   * Get ranch by owner.
   */
  getRanchByOwner(ownerId: string): RanchState | undefined {
    for (const ranch of this.cache.values()) {
      if (ranch.ownerId === ownerId) {
        return ranch;
      }
    }
    return undefined;
  }

  /**
   * Get all ranches.
   */
  getAllRanches(): RanchState[] {
    return Array.from(this.cache.values());
  }

  // ============================================================================
  // Animal Management
  // ============================================================================

  /**
   * Add animal to ranch.
   */
  addAnimal(ranchId: string, animal: Animal): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    ranch.animals[animal.id] = animal;
    ranch.stats.animalsRaised++;
    return true;
  }

  /**
   * Remove animal from ranch.
   */
  removeAnimal(ranchId: string, animalId: string): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    // Remove from herds
    for (const herd of Object.values(ranch.herds)) {
      const index = herd.animals.indexOf(animalId);
      if (index >= 0) {
        herd.animals.splice(index, 1);
      }
      if (herd.leaderId === animalId) {
        herd.leaderId = undefined;
      }
    }

    // Remove from dogs list if applicable
    const dogIndex = ranch.dogs.indexOf(animalId);
    if (dogIndex >= 0) {
      ranch.dogs.splice(dogIndex, 1);
    }

    delete ranch.animals[animalId];
    return true;
  }

  /**
   * Get animal from ranch.
   */
  getAnimal(ranchId: string, animalId: string): Animal | undefined {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return undefined;
    return ranch.animals[animalId];
  }

  /**
   * Get all animals of a species.
   */
  getAnimalsBySpecies(ranchId: string, speciesId: string): Animal[] {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return [];

    return Object.values(ranch.animals).filter(a => a.speciesId === speciesId);
  }

  /**
   * Update animal position.
   */
  updateAnimalPosition(
    ranchId: string,
    animalId: string,
    position: Position3D
  ): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    const animal = ranch.animals[animalId];
    if (!animal) return false;

    animal.position = { ...position };
    animal.lastUpdate = Date.now();
    return true;
  }

  // ============================================================================
  // Herd Management
  // ============================================================================

  /**
   * Add herd to ranch.
   */
  addHerd(ranchId: string, herd: Herd): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    ranch.herds[herd.id] = herd;

    // Update animal herd references
    for (const animalId of herd.animals) {
      const animal = ranch.animals[animalId];
      if (animal) {
        animal.herdId = herd.id;
      }
    }

    return true;
  }

  /**
   * Remove herd from ranch.
   */
  removeHerd(ranchId: string, herdId: string): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    // Clear animal herd references
    const herd = ranch.herds[herdId];
    if (herd) {
      for (const animalId of herd.animals) {
        const animal = ranch.animals[animalId];
        if (animal) {
          animal.herdId = undefined;
        }
      }
    }

    delete ranch.herds[herdId];
    return true;
  }

  /**
   * Get herd from ranch.
   */
  getHerd(ranchId: string, herdId: string): Herd | undefined {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return undefined;
    return ranch.herds[herdId];
  }

  // ============================================================================
  // Dog Management
  // ============================================================================

  /**
   * Add dog to ranch.
   */
  addDog(ranchId: string, dog: HerdingDog): boolean {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return false;

    ranch.dogs.push(dog.id);
    ranch.animals[dog.id] = dog;
    ranch.stats.trainingSessions = 0; // Reset for new dog
    return true;
  }

  /**
   * Get all dogs from ranch.
   */
  getDogs(ranchId: string): HerdingDog[] {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return [];

    return ranch.dogs
      .map(id => ranch.animals[id] as HerdingDog)
      .filter((dog): dog is HerdingDog => dog !== undefined && dog.dog !== undefined);
  }

  /**
   * Get dog by ID.
   */
  getDog(ranchId: string, dogId: string): HerdingDog | undefined {
    const ranch = this.cache.get(ranchId);
    if (!ranch) return undefined;

    const animal = ranch.animals[dogId] as HerdingDog;
    if (animal?.dog) {
      return animal;
    }
    return undefined;
  }

  // ============================================================================
  // Progression
  // ============================================================================

  /**
   * Progress to next AI stage.
   */
  progressStage(ranchId: string, targetStage?: AIComplexityStage): {
    success: boolean;
    newStage: AIComplexityStage;
    unlockedFeatures: string[];
  } {
    const ranch = this.cache.get(ranchId);
    if (!ranch) {
      return { success: false, newStage: ranch?.aiStage || AIComplexityStage.SIMPLE, unlockedFeatures: [] };
    }

    const currentStage = ranch.aiStage;
    const nextStage = targetStage || (currentStage + 1) as AIComplexityStage;

    if (nextStage <= currentStage) {
      return { success: false, newStage: currentStage, unlockedFeatures: [] };
    }

    // Check requirements
    const requirements = this.getStageRequirements(nextStage);
    const met = this.checkRequirements(ranch, requirements);

    if (!met) {
      return { success: false, newStage: currentStage, unlockedFeatures: [] };
    }

    // Progress to new stage
    ranch.aiStage = nextStage;
    const unlocked = this.unlockStageFeatures(ranch, nextStage);

    return { success: true, newStage: nextStage, unlockedFeatures: unlocked };
  }

  /**
   * Get requirements for a stage.
   */
  private getStageRequirements(stage: AIComplexityStage): {
    minAnimals: number;
    minTrainingSessions: number;
    requiredEngineTier: EngineTier;
  } {
    switch (stage) {
      case AIComplexityStage.SIMPLE:
        return {
          minAnimals: 0,
          minTrainingSessions: 0,
          requiredEngineTier: EngineTier.MICROVERSE_2D,
        };
      case AIComplexityStage.PUPPY_TRAINING:
        return {
          minAnimals: 5,
          minTrainingSessions: 0,
          requiredEngineTier: EngineTier.MICROVERSE_2D,
        };
      case AIComplexityStage.HERD_ANIMALS:
        return {
          minAnimals: 10,
          minTrainingSessions: 10,
          requiredEngineTier: EngineTier.LUANTI_BLOCKY,
        };
      case AIComplexityStage.ADVANCED_HERDING:
        return {
          minAnimals: 30,
          minTrainingSessions: 50,
          requiredEngineTier: EngineTier.OPENRTS_3D,
        };
      default:
        return {
          minAnimals: 0,
          minTrainingSessions: 0,
          requiredEngineTier: EngineTier.MICROVERSE_2D,
        };
    }
  }

  /**
   * Check if ranch meets stage requirements.
   */
  private checkRequirements(ranch: RanchState, requirements: {
    minAnimals: number;
    minTrainingSessions: number;
    requiredEngineTier: EngineTier;
  }): boolean {
    const animalCount = Object.keys(ranch.animals).length;
    const tierMet = ranch.engineTier >= requirements.requiredEngineTier;

    return animalCount >= requirements.minAnimals &&
      ranch.stats.trainingSessions >= requirements.minTrainingSessions &&
      tierMet;
  }

  /**
   * Unlock features for a stage.
   */
  private unlockStageFeatures(ranch: RanchState, stage: AIComplexityStage): string[] {
    const unlocked: string[] = [];

    switch (stage) {
      case AIComplexityStage.PUPPY_TRAINING:
        if (!ranch.unlockedFeatures.dogTraining) {
          ranch.unlockedFeatures.dogTraining = true;
          unlocked.push('dog_training');
        }
        break;

      case AIComplexityStage.HERD_ANIMALS:
        if (!ranch.unlockedFeatures.herdAnimals) {
          ranch.unlockedFeatures.herdAnimals = true;
          unlocked.push('herd_animals');
        }
        break;

      case AIComplexityStage.ADVANCED_HERDING:
        if (!ranch.unlockedFeatures.advancedHerding) {
          ranch.unlockedFeatures.advancedHerding = true;
          unlocked.push('advanced_herding');
        }
        if (!ranch.unlockedFeatures.terrainFeatures && ranch.engineTier === EngineTier.OPENRTS_3D) {
          ranch.unlockedFeatures.terrainFeatures = true;
          unlocked.push('terrain_features');
        }
        break;
    }

    return unlocked;
  }

  // ============================================================================
  // Event Logging
  // ============================================================================

  /**
   * Log an event for the ranch.
   */
  logEvent(ranchId: string, event: Omit<RanchEvent, 'id' | 'ranchId' | 'timestamp'>): RanchEvent {
    const ranch = this.cache.get(ranchId);
    if (!ranch) {
      throw new Error('Ranch not found');
    }

    const fullEvent: RanchEvent = {
      id: crypto.randomUUID(),
      ranchId,
      timestamp: Date.now(),
      ...event,
    };

    // Store events in ranch (could be moved to separate storage)
    if (!ranch.events) {
      ranch.events = [];
    }
    ranch.events.push(fullEvent);

    // Keep only last 100 events
    if (ranch.events.length > 100) {
      ranch.events = ranch.events.slice(-100);
    }

    return fullEvent;
  }

  /**
   * Get recent events for a ranch.
   */
  getEvents(ranchId: string, limit: number = 20): RanchEvent[] {
    const ranch = this.cache.get(ranchId);
    if (!ranch?.events) return [];

    return ranch.events.slice(-limit).reverse();
  }

  // ============================================================================
  // Auto-Save
  // ============================================================================

  /**
   * Enable or disable auto-save.
   */
  setAutoSave(enabled: boolean): void {
    this.autoSaveEnabled = enabled;

    if (!enabled) {
      // Clear all timers
      for (const timer of this.autoSaveTimers.values()) {
        clearTimeout(timer);
      }
      this.autoSaveTimers.clear();
    }
  }

  /**
   * Set auto-save interval.
   */
  setAutoSaveInterval(interval: number): void {
    this.autoSaveInterval = interval;
  }

  /**
   * Schedule auto-save for a ranch.
   */
  private scheduleAutoSave(ranchId: string): void {
    if (!this.autoSaveEnabled) return;

    const existing = this.autoSaveTimers.get(ranchId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.performAutoSave(ranchId);
    }, this.autoSaveInterval);

    this.autoSaveTimers.set(ranchId, timer);
  }

  /**
   * Perform auto-save (calls registered save handler).
   */
  private performAutoSave(ranchId: string): void {
    const saveData = this.saveRanch(ranchId);
    if (saveData && this.onAutoSave) {
      this.onAutoSave(ranchId, saveData);
    }

    // Reschedule
    this.scheduleAutoSave(ranchId);
  }

  /**
   * Handler for auto-save callbacks.
   */
  onAutoSave?: (ranchId: string, saveData: RanchSaveData) => void;

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Remove ranch from cache.
   */
  unloadRanch(ranchId: string): void {
    const timer = this.autoSaveTimers.get(ranchId);
    if (timer) {
      clearTimeout(timer);
      this.autoSaveTimers.delete(ranchId);
    }
    this.cache.delete(ranchId);
  }

  /**
   * Clear all cached ranches.
   */
  clearCache(): void {
    for (const timer of this.autoSaveTimers.values()) {
      clearTimeout(timer);
    }
    this.autoSaveTimers.clear();
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): {
    ranchCount: number;
    totalAnimals: number;
    totalHerds: number;
    totalDogs: number;
  } {
    let totalAnimals = 0;
    let totalHerds = 0;
    let totalDogs = 0;

    for (const ranch of this.cache.values()) {
      totalAnimals += Object.keys(ranch.animals).length;
      totalHerds += Object.keys(ranch.herds).length;
      totalDogs += ranch.dogs.length;
    }

    return {
      ranchCount: this.cache.size,
      totalAnimals,
      totalHerds,
      totalDogs,
    };
  }
}

// ============================================================================
// Extended Ranch State Type (with events)
// ============================================================================

declare module './types.js' {
  interface RanchState {
    events?: RanchEvent[];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a ranch state manager.
 */
export function createRanchStateManager(): RanchStateManager {
  return new RanchStateManager();
}

/**
 * Create a new ranch with default settings.
 */
export function createNewRanch(
  ownerId: string,
  name: string,
  engineTier?: EngineTier
): RanchState {
  const manager = new RanchStateManager();
  return manager.createRanch(ownerId, name, engineTier);
}

/**
 * Serialize ranch state for storage.
 */
export function serializeRanch(ranch: RanchState): string {
  return JSON.stringify({
    ranch: ranch,
    metadata: {
      savedAt: Date.now(),
      version: CURRENT_VERSION,
      checksum: new RanchStateManager()['calculateChecksum'](ranch),
    },
  });
}

/**
 * Deserialize ranch state from storage.
 */
export function deserializeRanch(data: string): RanchState | null {
  try {
    const parsed = JSON.parse(data);
    const manager = new RanchStateManager();
    return manager.loadRanch(parsed);
  } catch {
    return null;
  }
}
