/**
 * Catch Processor - Handle Catches and Inventory
 *
 * Manages fish catches, inventory, records, and achievements.
 * Integrates with StudyLoG.AI for educational content.
 */

import {
  CatchRecord,
  CatchQuality,
  PlayerInventory,
  FishingSetup,
  Fish,
  WeatherCondition,
  Achievement,
  Season,
  FishingRod,
  FishingReel,
  FishingLine,
  Lure
} from './types';
import { FishSpecies, fishRegistry } from './fish-registry';

// ============================================================================
// CATCH PROCESSING
// ============================================================================

/**
 * Result of catching a fish
 */
export interface CatchResult {
  success: boolean;
  fish?: CatchRecord;
  xp?: number;
  achievements?: Achievement[];
  message?: string;
  educationalContent?: EducationalContent;
}

/**
 * Educational content about the catch
 */
export interface EducationalContent {
  title: string;
  facts: string[];
  conservation: string;
  cooking?: string;
}

/**
 * Processes fish catches
 */
export class CatchProcessor {
  private worldRecords: Map<string, CatchRecord> = new Map();
  private personalBests: Map<string, Map<string, CatchRecord>> = new Map(); // playerId -> speciesId -> record

  /**
   * Process a caught fish
   */
  processCatch(
    fish: Fish,
    playerId: string,
    location: string,
    spot: string,
    setup: FishingSetup,
    weather: WeatherCondition,
    temperature: number,
    timeOfDay: string,
    fightDuration: number,
    lineHealthRemaining: number
  ): CatchResult {
    const species = fishRegistry.getSpecies(fish.species);
    if (!species) {
      return { success: false, message: 'Unknown species' };
    }

    // Calculate catch quality
    const quality = this.calculateCatchQuality(
      fish,
      fightDuration,
      lineHealthRemaining
    );

    // Create catch record
    const catchRecord: CatchRecord = {
      id: this.generateCatchId(),
      fishId: fish.id,
      species: fish.species,
      length: fish.length,
      weight: fish.weight,
      age: fish.age,
      caughtAt: Date.now(),
      location,
      spot,
      depth: Math.abs(fish.position3D.y),
      rod: setup.rod.id,
      reel: setup.reel.id,
      lure: setup.lure.id,
      weather,
      temperature,
      timeOfDay,
      quality,
      isPersonalBest: false,
      isRecord: false,
      released: false,
      tagged: false
    };

    // Check for personal best
    catchRecord.isPersonalBest = this.checkPersonalBest(
      playerId,
      fish.species,
      catchRecord
    );

    // Check for world record
    catchRecord.isRecord = this.checkWorldRecord(fish.species, catchRecord);

    // Calculate XP
    const xp = this.calculateXP(catchRecord, species);

    // Check for achievements
    const achievements = this.checkAchievements(playerId, catchRecord, species);

    // Generate educational content
    const educationalContent = this.generateEducationalContent(species, catchRecord);

    return {
      success: true,
      fish: catchRecord,
      xp,
      achievements,
      message: this.generateCatchMessage(catchRecord, species),
      educationalContent
    };
  }

  /**
   * Calculate catch quality
   */
  private calculateCatchQuality(
    fish: Fish,
    fightDuration: number,
    lineHealthRemaining: number
  ): CatchQuality {
    const score = (
      Math.min(1, fightDuration / 30) * 0.3 +
      lineHealthRemaining * 0.3 +
      Math.min(1, fish.length / fishRegistry.getSpecies(fish.species)!.maxLength) * 0.4
    );

    if (score > 0.85) return CatchQuality.TROPHY;
    if (score > 0.7) return CatchQuality.EXCELLENT;
    if (score > 0.5) return CatchQuality.GOOD;
    if (score > 0.3) return CatchQuality.FAIR;
    return CatchQuality.POOR;
  }

  /**
   * Check if this is a personal best
   */
  private checkPersonalBest(
    playerId: string,
    speciesId: string,
    catchRecord: CatchRecord
  ): boolean {
    if (!this.personalBests.has(playerId)) {
      this.personalBests.set(playerId, new Map());
    }

    const playerRecords = this.personalBests.get(playerId)!;
    const currentBest = playerRecords.get(speciesId);

    if (!currentBest || catchRecord.weight > currentBest.weight) {
      playerRecords.set(speciesId, catchRecord);
      return true;
    }

    return false;
  }

  /**
   * Check if this is a world record
   */
  private checkWorldRecord(speciesId: string, catchRecord: CatchRecord): boolean {
    const currentRecord = this.worldRecords.get(speciesId);

    if (!currentRecord || catchRecord.weight > currentRecord.weight) {
      this.worldRecords.set(speciesId, catchRecord);
      return true;
    }

    return false;
  }

  /**
   * Calculate XP for catch
   */
  private calculateXP(catchRecord: CatchRecord, species: FishSpecies): number {
    let xp = 10; // Base XP

    // Size bonus
    const sizePercent = catchRecord.length / species.maxLength;
    xp += Math.floor(sizePercent * 50);

    // Rarity bonus
    switch (species.rarity) {
      case 'uncommon':
        xp += 25;
        break;
      case 'rare':
        xp += 50;
        break;
      case 'epic':
        xp += 100;
        break;
      case 'legendary':
        xp += 250;
        break;
    }

    // Quality bonus
    switch (catchRecord.quality) {
      case CatchQuality.EXCELLENT:
        xp += 30;
        break;
      case CatchQuality.TROPHY:
        xp += 100;
        break;
    }

    // Record bonuses
    if (catchRecord.isPersonalBest) xp *= 2;
    if (catchRecord.isRecord) xp *= 5;

    return xp;
  }

  /**
   * Check for achievements
   */
  private checkAchievements(
    playerId: string,
    catchRecord: CatchRecord,
    species: FishSpecies
  ): Achievement[] {
    const achievements: Achievement[] = [];

    // First catch of species
    const playerCaught = this.getPlayerSpeciesCount(playerId);
    if (!playerCaught.has(species.id)) {
      achievements.push({
        id: `first_${species.id}`,
        name: `First ${species.name}`,
        description: `Caught your first ${species.name}!`,
        icon: `fish/${species.id}`,
        unlockedAt: Date.now(),
        progress: 1,
        maxProgress: 1
      });
    }

    // Size milestones
    const sizePercent = catchRecord.length / species.maxLength;
    if (sizePercent >= 0.9) {
      achievements.push({
        id: `trophy_${species.id}`,
        name: `Trophy ${species.name}`,
        description: `Caught a trophy-sized ${species.name} (90%+ of max)`,
        icon: 'trophy',
        unlockedAt: Date.now(),
        progress: 1,
        maxProgress: 1
      });
    }

    // Quality achievements
    if (catchRecord.quality === CatchQuality.TROPHY) {
      achievements.push({
        id: 'trophy_catch',
        name: 'Trophy Hunter',
        description: 'Land a trophy-quality fish',
        icon: 'trophy_gold',
        unlockedAt: Date.now(),
        progress: 1,
        maxProgress: 1
      });
    }

    // World record
    if (catchRecord.isRecord) {
      achievements.push({
        id: 'world_record',
        name: 'World Record!',
        description: `New world record ${species.name}!`,
        icon: 'world_record',
        unlockedAt: Date.now(),
        progress: 1,
        maxProgress: 1
      });
    }

    return achievements;
  }

  /**
   * Generate educational content
   */
  private generateEducationalContent(
    species: FishSpecies,
    catchRecord: CatchRecord
  ): EducationalContent {
    return {
      title: `${species.name} Facts`,
      facts: [
        `This ${species.name} is estimated to be ${catchRecord.age} years old.`,
        `${species.name} prefer water temperatures between ${species.preferredTemp.min}-${species.preferredTemp.max}°F.`,
        species.funFact
      ],
      conservation: species.conservation,
      cooking: species.category === 'panfish' || species.category === 'catfish' ?
        `Excellent eating! ${species.name} is known for its delicious, mild flavor.` :
        `${species.name} is primarily a sport fish - practice catch and release.`
    };
  }

  /**
   * Generate catch message
   */
  private generateCatchMessage(catchRecord: CatchRecord, species: FishSpecies): string {
    const sizeDescriptor = this.getSizeDescriptor(catchRecord.length, species);
    const qualityMessage = this.getQualityMessage(catchRecord.quality);

    let message = `You caught a${sizeDescriptor === 'enormous' ? 'n' : ' '}${sizeDescriptor} ${species.name}!`;

    if (catchRecord.isRecord) {
      message += ' NEW WORLD RECORD!';
    } else if (catchRecord.isPersonalBest) {
      message += ' Personal best!';
    }

    message += ` ${qualityMessage}`;

    return message;
  }

  /**
   * Get size descriptor
   */
  private getSizeDescriptor(length: number, species: FishSpecies): string {
    const percent = length / species.maxLength;

    if (percent >= 0.95) return 'enormous';
    if (percent >= 0.8) return 'huge';
    if (percent >= 0.6) return 'large';
    if (percent >= 0.4) return 'nice';
    if (percent >= 0.2) return 'small';
    return 'tiny';
  }

  /**
   * Get quality message
   */
  private getQualityMessage(quality: CatchQuality): string {
    switch (quality) {
      case CatchQuality.TROPHY:
        return 'What a trophy!';
      case CatchQuality.EXCELLENT:
        return 'Beautiful specimen!';
      case CatchQuality.GOOD:
        return 'Nice catch!';
      case CatchQuality.FAIR:
        return 'Not bad!';
      case CatchQuality.POOR:
        return 'It\'s a fish!';
    }
  }

  /**
   * Generate unique catch ID
   */
  private generateCatchId(): string {
    return `catch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get species caught by player
   */
  private getPlayerSpeciesCount(playerId: string): Map<string, number> {
    // This would be backed by a database in production
    return new Map();
  }

  /**
   * Get player's personal bests
   */
  getPlayerBests(playerId: string): Map<string, CatchRecord> {
    return this.personalBests.get(playerId) || new Map();
  }

  /**
   * Get world records
   */
  getWorldRecords(): Map<string, CatchRecord> {
    return new Map(this.worldRecords);
  }
}

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Manages player inventory
 */
export class InventoryManager {
  private inventories: Map<string, PlayerInventory> = new Map();

  /**
   * Get player inventory
   */
  getInventory(playerId: string): PlayerInventory {
    if (!this.inventories.has(playerId)) {
      this.inventories.set(playerId, this.createDefaultInventory(playerId));
    }
    return this.inventories.get(playerId)!;
  }

  /**
   * Create default inventory
   */
  private createDefaultInventory(playerId: string): PlayerInventory {
    return {
      ownerId: playerId,
      rods: [
        {
          id: 'starter_rod',
          name: 'Starter Rod',
          power: 'medium' as any,
          action: 'moderate' as any,
          length: 7,
          lineRating: { min: 8, max: 14 },
          color: '#2C3E50',
          material: 'Fiberglass',
          quality: 0.5
        }
      ],
      reels: [
        {
          id: 'starter_reel',
          name: 'Starter Reel',
          type: 'spinning' as any,
          gearRatio: 5.2,
          lineCapacity: { monofilament: { test: 10, yards: 120 } },
          maxDrag: 11,
          ballBearings: 4,
          quality: 0.5
        }
      ],
      lines: [
        {
          material: 'monofilament' as any,
          test: '10',
          diameter: '0.30mm',
          length: 300,
          color: 'Clear',
          currentLength: 300
        }
      ],
      lures: [
        {
          id: 'starter_worm',
          name: 'Basic Plastic Worm',
          category: 'soft_plastic' as any,
          weight: 0.25,
          length: 6,
          depth: { min: 0, max: 10 },
          color: 'Purple',
          pattern: 'Solid',
          action: 'twitch' as any,
          actionProfile: 'Subtle tail action',
          vibration: 0.2,
          flash: 0.1,
          scent: 0.3,
          effectiveness: {},
          quantity: 5
        }
      ],
      currentSetup: {
        rod: {} as FishingRod,
        reel: {} as FishingReel,
        line: {} as FishingLine,
        leader: null,
        lure: {} as Lure,
        castingDistance: 50,
        hookStrength: 0.5
      },
      maxRods: 10,
      maxReels: 10,
      maxLures: 100,
      currency: 100,
      totalCatches: 0,
      biggestCatch: null,
      speciesCaught: new Set<string>(),
      achievements: []
    };
  }

  /**
   * Add equipment to inventory
   */
  addEquipment<T extends FishingRod | FishingReel | FishingLine | Lure>(
    playerId: string,
    type: 'rod' | 'reel' | 'line' | 'lure',
    item: T
  ): boolean {
    const inventory = this.getInventory(playerId);

    switch (type) {
      case 'rod':
        if (inventory.rods.length >= inventory.maxRods) return false;
        inventory.rods.push(item as FishingRod);
        break;
      case 'reel':
        if (inventory.reels.length >= inventory.maxReels) return false;
        inventory.reels.push(item as FishingReel);
        break;
      case 'line':
        inventory.lines.push(item as FishingLine);
        break;
      case 'lure':
        if (inventory.lures.length >= inventory.maxLures) return false;
        inventory.lures.push(item as Lure);
        break;
    }

    return true;
  }

  /**
   * Remove equipment from inventory
   */
  removeEquipment(
    playerId: string,
    type: 'rod' | 'reel' | 'line' | 'lure',
    itemId: string
  ): boolean {
    const inventory = this.getInventory(playerId);

    switch (type) {
      case 'rod':
        const rodIdx = inventory.rods.findIndex(r => r.id === itemId);
        if (rodIdx >= 0) {
          inventory.rods.splice(rodIdx, 1);
          return true;
        }
        break;
      case 'reel':
        const reelIdx = inventory.reels.findIndex(r => r.id === itemId);
        if (reelIdx >= 0) {
          inventory.reels.splice(reelIdx, 1);
          return true;
        }
        break;
      case 'line':
        const lineIdx = inventory.lines.findIndex(l => l.id === itemId);
        if (lineIdx >= 0) {
          inventory.lines.splice(lineIdx, 1);
          return true;
        }
        break;
      case 'lure':
        const lureIdx = inventory.lures.findIndex(l => l.id === itemId);
        if (lureIdx >= 0) {
          inventory.lures.splice(lureIdx, 1);
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Update current setup
   */
  updateSetup(
    playerId: string,
    setup: Partial<PlayerInventory['currentSetup']>
  ): boolean {
    const inventory = this.getInventory(playerId);

    inventory.currentSetup = { ...inventory.currentSetup, ...setup };

    // Recalculate derived stats
    const rodPower = this.getRodPowerRating(setup.rod?.power);
    const reelSpeed = setup.reel?.gearRatio || 5;
    const lureWeight = setup.lure?.weight || 0.25;

    inventory.currentSetup.castingDistance = 30 + rodPower * 10 + reelSpeed * 2;
    inventory.currentSetup.hookStrength = rodPower * 0.5 + (setup.rod?.action === 'fast' ? 0.2 : 0);

    return true;
  }

  /**
   * Get rod power rating as number
   */
  private getRodPowerRating(power: any): number {
    const ratings: Record<string, number> = {
      ultralight: 0.3,
      light: 0.5,
      medium: 0.7,
      medium_heavy: 0.85,
      heavy: 1,
      extra_heavy: 1
    };
    return ratings[power as string] || 0.5;
  }

  /**
   * Record catch
   */
  recordCatch(playerId: string, catchRecord: CatchRecord): void {
    const inventory = this.getInventory(playerId);

    inventory.totalCatches++;
    inventory.speciesCaught.add(catchRecord.species);

    // Update biggest catch
    if (!inventory.biggestCatch || catchRecord.weight > inventory.biggestCatch.weight) {
      inventory.biggestCatch = catchRecord;
    }
  }

  /**
   * Spend currency
   */
  spendCurrency(playerId: string, amount: number): boolean {
    const inventory = this.getInventory(playerId);

    if (inventory.currency < amount) return false;

    inventory.currency -= amount;
    return true;
  }

  /**
   * Add currency
   */
  addCurrency(playerId: string, amount: number): void {
    const inventory = this.getInventory(playerId);
    inventory.currency += amount;
  }

  /**
   * Unlock achievement
   */
  unlockAchievement(playerId: string, achievement: Achievement): void {
    const inventory = this.getInventory(playerId);

    const existing = inventory.achievements.find(a => a.id === achievement.id);
    if (existing) {
      existing.progress = achievement.progress;
      if (achievement.unlockedAt) {
        existing.unlockedAt = achievement.unlockedAt;
      }
    } else {
      inventory.achievements.push(achievement);
    }
  }
}

// ============================================================================
// FISH RELEASE SYSTEM
// ============================================================================

/**
 * Manages fish release and tagging
 */
export class FishReleaseSystem {
  private taggedFish: Map<string, TagData> = new Map();

  /**
   * Release a fish
   */
  releaseFish(
    playerId: string,
    catchRecord: CatchRecord,
    option: 'immediate' | 'delayed' | 'trophy_only'
  ): {
    success: boolean;
    xpBonus: number;
    message: string;
  } {
    let xpBonus = 0;
    let message = '';

    switch (option) {
      case 'immediate':
        // Always release, good conservation
        xpBonus = 10;
        message = 'Fish released safely! Conservation +10 XP';
        break;

      case 'delayed':
        // Keep for photos/measurement, then release
        xpBonus = 5;
        message = 'Fish will be released after processing. Conservation +5 XP';
        break;

      case 'trophy_only':
        // Keep trophy fish, release others
        if (catchRecord.quality === CatchQuality.TROPHY) {
          xpBonus = 0;
          message = 'Trophy fish kept for the wall.';
        } else {
          xpBonus = 5;
          message = 'Fish released. Conservation +5 XP';
        }
        break;
    }

    return { success: true, xpBonus, message };
  }

  /**
   * Tag a fish for scientific tracking
   */
  tagFish(
    catchRecord: CatchRecord,
    playerId: string
  ): {
    success: boolean;
    tagId: string;
    message: string;
  } {
    const tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.taggedFish.set(tagId, {
      tagId,
      fishId: catchRecord.fishId,
      species: catchRecord.species,
      taggedBy: playerId,
      taggedAt: Date.now(),
      taggedLocation: catchRecord.location,
      length: catchRecord.length,
      weight: catchRecord.weight,
      recaptures: []
    });

    return {
      success: true,
      tagId,
      message: `Fish tagged with ID: ${tagId}. This helps research!`
    };
  }

  /**
   * Check if fish is recapture
   */
  checkRecapture(fishId: string): TagData | null {
    for (const tag of this.taggedFish.values()) {
      if (tag.fishId === fishId) {
        // Add recapture data
        tag.recaptures.push({
          date: Date.now(),
          location: '' // Would be populated from catch data
        });
        return tag;
      }
    }
    return null;
  }

  /**
   * Get tag data
   */
  getTagData(tagId: string): TagData | null {
    return this.taggedFish.get(tagId) || null;
  }
}

/**
 * Tag data structure
 */
interface TagData {
  tagId: string;
  fishId: string;
  species: string;
  taggedBy: string;
  taggedAt: number;
  taggedLocation: string;
  length: number;
  weight: number;
  recaptures: Array<{
    date: number;
    location: string;
  }>;
}

// ============================================================================
// LEADERBOARDS
// ============================================================================

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  score: number;
  species?: string;
  timestamp: number;
}

/**
 * Manages fishing leaderboards
 */
export class LeaderboardManager {
  private leaderboards: Map<string, LeaderboardEntry[]> = new Map();

  /**
   * Submit score
   */
  submitScore(
    category: string,
    playerId: string,
    playerName: string,
    score: number,
    species?: string
  ): LeaderboardEntry | null {
    if (!this.leaderboards.has(category)) {
      this.leaderboards.set(category, []);
    }

    const board = this.leaderboards.get(category)!;
    const entry: LeaderboardEntry = {
      playerId,
      playerName,
      score,
      species,
      timestamp: Date.now()
    };

    // Insert in sorted position
    let inserted = false;
    for (let i = 0; i < board.length; i++) {
      if (score > board[i].score) {
        board.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      board.push(entry);
    }

    // Keep only top 100
    if (board.length > 100) {
      board.length = 100;
    }

    return entry;
  }

  /**
   * Get leaderboard
   */
  getLeaderboard(category: string, limit: number = 10): LeaderboardEntry[] {
    const board = this.leaderboards.get(category);
    return board ? board.slice(0, limit) : [];
  }

  /**
   * Get player rank
   */
  getPlayerRank(category: string, playerId: string): number {
    const board = this.leaderboards.get(category);
    if (!board) return -1;

    return board.findIndex(e => e.playerId === playerId) + 1;
  }
}

// Export singleton instances
export const catchProcessor = new CatchProcessor();
export const inventoryManager = new InventoryManager();
export const fishReleaseSystem = new FishReleaseSystem();
export const leaderboardManager = new LeaderboardManager();
