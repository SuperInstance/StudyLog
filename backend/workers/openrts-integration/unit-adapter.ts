/**
 * Unit Adapter
 *
 * Adapts units from different formats (StudyLoG, DMLoG, generic) to OpenRTS format.
 *
 * ## Supported Formats
 *
 * - **StudyLoG.AI**: Science lab equipment, physics objects, learning agents
 * - **DMLoG.AI**: Miniature figures, monsters, NPCs
 * - **Generic**: Standard RTS units
 *
 * ## Features
 *
 * - Automatic scaling to PS2-level 3D quality
 * - LOD (Level of Detail) system for performance
 * - Animation state mapping
 * - Ability/command conversion
 */

import type {
  Vector3,
  UnitDefinition,
  UnitInstance,
  UnitStats,
  UnitFaction,
  UnitClass,
  ResourceCost,
  LabEquipment,
  LabStation,
  MiniatureFigure,
  PhysicsObject,
  QualityTier,
} from './types.js';

// ============================================================================
// Unit Format Types
// ============================================================================

/**
 * Source format for unit conversion
 */
export type UnitSourceFormat =
  | 'studylog'
  | 'dmlog'
  | 'generic'
  | 'openrts';

/**
 * Base unit data from any source
 */
export interface BaseUnitData {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description: string;

  /** Source format */
  sourceFormat: UnitSourceFormat;

  /** 3D model scene path or URL */
  modelPath: string;

  /** Icon path */
  iconPath?: string;

  /** Position */
  position: Vector3;

  /** Rotation (Y-axis in degrees) */
  rotation: number;

  /** Scale */
  scale: Vector3;

  /** Owner/creator ID */
  ownerId: string;

  /** Custom properties */
  properties: Record<string, unknown>;
}

// ============================================================================
// StudyLoG.AI Specific Types
// ============================================================================

/**
 * StudyLoG lab equipment definition
 */
export interface LabEquipmentDefinition {
  equipmentId: string;
  name: string;
  description: string;
  modelPath: string;
  interactable: boolean;
  interactiveDistance: number;
  animations: {
    idle?: string;
    interact?: string;
    active?: string;
  };
}

/**
 * StudyLoG AI tutor definition
 */
export interface TutorDefinition {
  tutorId: string;
  name: string;
  personality: 'encouraging' | 'strict' | 'friendly' | 'mysterious';
  appearance: {
    modelPath: string;
    outfitVariant?: string;
  };
  capabilities: {
    canMove: boolean;
    canDemonstrate: boolean;
    voiceEnabled: boolean;
  };
}

// ============================================================================
// DMLoG.AI Specific Types
// ============================================================================

/**
 * DMLoG character definition
 */
export interface DMLoGCharacterDefinition {
  characterId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  modelPath: string;
  tokenIcon: string;
  baseSize: number; // in mm
  stats: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

// ============================================================================
// Unit Adapter Configuration
// ============================================================================

export interface UnitAdapterConfig {
  /** Quality tier for model LOD */
  qualityTier: QualityTier;

  /** Scale multiplier for units */
  globalScale: number;

  /** Auto-generate collision shapes */
  autoCollision: boolean;

  /** Animation speed multiplier */
  animationSpeed: number;

  /** Maximum units to convert in batch */
  maxBatchSize: number;
}

export const DEFAULT_ADAPTER_CONFIG: UnitAdapterConfig = {
  qualityTier: 'high',
  globalScale: 1.0,
  autoCollision: true,
  animationSpeed: 1.0,
  maxBatchSize: 100,
};

// ============================================================================
// Unit Adapter Class
// ============================================================================

/**
 * Adapter for converting units to OpenRTS format
 */
export class UnitAdapter {
  private unitDefinitions: Map<string, UnitDefinition> = new Map();
  private conversionCache: Map<string, UnitDefinition> = new Map();

  constructor(
    private config: UnitAdapterConfig = DEFAULT_ADAPTER_CONFIG
  ) {}

  // ========================================================================
  // StudyLoG.AI Conversion
  // ========================================================================

  /**
   * Convert StudyLoG lab equipment to OpenRTS unit
   */
  labEquipmentToUnit(
    equipment: LabEquipment,
    position: Vector3,
    ownerId: string
  ): UnitDefinition {
    const cacheKey = `lab_${equipment}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    const definition: UnitDefinition = {
      id: `lab_${equipment}`,
      name: this.getLabEquipmentName(equipment),
      description: `Interactive ${equipment} for science experiments`,
      class: 'structure',
      scenePath: this.getLabEquipmentModelPath(equipment),
      iconPath: `/icons/lab/${equipment}.png`,
      stats: this.getLabEquipmentStats(equipment),
      abilities: this.getLabEquipmentAbilities(equipment),
      requirements: [],
      size: { x: 1, y: 1 },
      faction: 'neutral',
      selectionRadius: 1.5,
      shadow: {
        enabled: true,
        size: 256,
        textureSize: 512,
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  /**
   * Create a lab station instance
   */
  createLabStationInstance(
    station: LabStation,
    owner: string
  ): UnitInstance {
    const definition = this.labEquipmentToUnit(
      station.equipment[0] || 'microscope',
      station.position,
      owner
    );

    return {
      instanceId: station.id,
      definitionId: definition.id,
      position: station.position,
      rotation: 0,
      state: station.currentActivity ? 'idle' : 'idle',
      stats: { ...definition.stats },
      target: undefined,
      orders: [],
      ownerId: owner,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert StudyLoG tutor to OpenRTS unit
   */
  tutorToUnit(tutor: TutorDefinition): UnitDefinition {
    const cacheKey = `tutor_${tutor.tutorId}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    const definition: UnitDefinition = {
      id: `tutor_${tutor.tutorId}`,
      name: tutor.name,
      description: `AI tutor with ${tutor.personality} personality`,
      class: 'hero',
      scenePath: tutor.appearance.modelPath,
      iconPath: `/icons/tutors/${tutor.tutorId}.png`,
      stats: {
        maxHealth: 100,
        health: 100,
        speed: tutor.capabilities.canMove ? 3.0 : 0,
        damage: 0,
        range: 5,
        attackCooldown: 1,
        armor: 0,
        sightRadius: 20,
        supply: 0,
      },
      abilities: tutor.capabilities.voiceEnabled
        ? ['speak', 'demonstrate', 'guide']
        : ['demonstrate', 'guide'],
      requirements: [],
      size: { x: 1, y: 1 },
      faction: 'ally',
      selectionRadius: 1.0,
      shadow: {
        enabled: true,
        size: 128,
        textureSize: 256,
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  /**
   * Convert physics object to OpenRTS unit
   */
  physicsObjectToUnit(obj: PhysicsObject, ownerId: string): UnitDefinition {
    const cacheKey = `physics_${obj.id}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    const definition: UnitDefinition = {
      id: `physics_${obj.id}`,
      name: `${obj.type}_${obj.id}`,
      description: `Physics simulation object: ${obj.type}`,
      class: obj.physics.mass > 10 ? 'vehicle' : 'infantry',
      scenePath: `/models/physics/${obj.type}.glb`,
      iconPath: `/icons/physics/${obj.type}.png`,
      stats: {
        maxHealth: 50,
        health: 50,
        speed: 0,
        damage: 0,
        range: 0,
        attackCooldown: 0,
        armor: obj.physics.restitution * 10,
        sightRadius: 5,
        supply: 0,
      },
      abilities: ['physics_interact', 'drag', 'inspect'],
      requirements: [],
      size: {
        x: Math.ceil(obj.transform.scale.x),
        y: Math.ceil(obj.transform.scale.z),
      },
      faction: 'neutral',
      selectionRadius: Math.max(
        obj.transform.scale.x,
        obj.transform.scale.z
      ) * 0.5,
      shadow: {
        enabled: true,
        size: 64,
        textureSize: 128,
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  // ========================================================================
  // DMLoG.AI Conversion
  // ========================================================================

  /**
   * Convert DMLoG miniature figure to OpenRTS unit
   */
  miniatureToUnit(figure: MiniatureFigure): UnitDefinition {
    const cacheKey = `miniature_${figure.id}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    // Scale base size to game units (1 inch = 0.25 game units approximately)
    const scale = figure.baseSize / 25.4 * 0.25;

    const definition: UnitDefinition = {
      id: `miniature_${figure.id}`,
      name: figure.name,
      description: `Miniature: ${figure.type}`,
      class: this.mapFigureTypeToUnitClass(figure.type),
      scenePath: figure.scenePath,
      iconPath: `/icons/miniatures/${figure.type}.png`,
      stats: {
        maxHealth: figure.character.maxHealth,
        health: figure.character.health,
        speed: figure.character.speed * 0.5,
        damage: 10 + figure.character.level * 2,
        range: figure.type === 'dragon' ? 5 : 1.5,
        attackCooldown: 1.5,
        armor: figure.character.armorClass / 10,
        sightRadius: 10,
        supply: 1,
      },
      abilities: figure.character.abilities,
      requirements: [],
      size: { x: 1, y: 1 },
      faction: 'neutral',
      selectionRadius: scale * 0.5,
      shadow: {
        enabled: true,
        size: 128,
        textureSize: 256,
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  /**
   * Create miniature instance from figure
   */
  createMiniatureInstance(figure: MiniatureFigure): UnitInstance {
    const definition = this.miniatureToUnit(figure);

    return {
      instanceId: figure.id,
      definitionId: definition.id,
      position: figure.position,
      rotation: figure.rotation,
      state: 'idle',
      stats: { ...definition.stats },
      target: undefined,
      orders: [],
      ownerId: figure.ownerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Convert DMLoG character to OpenRTS unit
   */
  characterToUnit(character: DMLoGCharacterDefinition): UnitDefinition {
    const cacheKey = `character_${character.characterId}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    const definition: UnitDefinition = {
      id: `character_${character.characterId}`,
      name: character.name,
      description: `Level ${character.level} ${character.race} ${character.class}`,
      class: this.mapDnDClassToUnitClass(character.class),
      scenePath: character.modelPath,
      iconPath: character.tokenIcon,
      stats: {
        maxHealth: 10 + character.level * 10 + character.stats.constitution,
        health: 10 + character.level * 10 + character.stats.constitution,
        speed: 6 + character.stats.dexterity / 3,
        damage: character.stats.strength + Math.floor(character.level / 2),
        range: character.class === 'Ranger' || character.class === 'Wizard' ? 10 : 1.5,
        attackCooldown: 6 / (1 + character.stats.dexterity / 20),
        armor: 10 + character.stats.dexterity / 2,
        sightRadius: 15 + character.stats.wisdom / 2,
        supply: 1,
      },
      abilities: this.getDnDClassAbilities(character.class, character.level),
      requirements: [],
      size: { x: 1, y: 1 },
      faction: 'player',
      selectionRadius: 0.75,
      shadow: {
        enabled: true,
        size: 128,
        textureSize: 256,
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  // ========================================================================
  // Generic Unit Conversion
  // ========================================================================

  /**
   * Convert generic unit data to OpenRTS format
   */
  genericToUnit(data: BaseUnitData): UnitDefinition {
    const cacheKey = `generic_${data.sourceFormat}_${data.id}`;

    if (this.conversionCache.has(cacheKey)) {
      return this.conversionCache.get(cacheKey)!;
    }

    // Infer class from properties
    const unitClass = this.inferUnitClass(data);

    const definition: UnitDefinition = {
      id: data.id,
      name: data.name,
      description: data.description,
      class: unitClass,
      scenePath: data.modelPath,
      iconPath: data.iconPath || '/icons/units/default.png',
      stats: this.inferUnitStats(data, unitClass),
      abilities: data.properties.abilities as string[] || ['move', 'attack', 'stop'],
      requirements: data.properties.requirements as string[] || [],
      size: data.properties.size as Vector2 || { x: 1, y: 1 },
      faction: (data.properties.faction as UnitFaction) || 'neutral',
      selectionRadius: data.properties.selectionRadius as number || 1.0,
      shadow: {
        enabled: true,
        size: this.qualityTierToShadowSize(this.config.qualityTier),
        textureSize: this.qualityTierToTextureSize(this.config.qualityTier),
      },
    };

    this.conversionCache.set(cacheKey, definition);
    this.unitDefinitions.set(definition.id, definition);

    return definition;
  }

  // ========================================================================
  // Batch Conversion
  // ========================================================================

  /**
   * Convert multiple units in batch
   */
  async convertBatch(units: BaseUnitData[]): Promise<UnitDefinition[]> {
    const results: UnitDefinition[] = [];

    for (let i = 0; i < units.length; i += this.config.maxBatchSize) {
      const batch = units.slice(i, i + this.config.maxBatchSize);
      const conversions = batch.map((unit) => this.genericToUnit(unit));
      results.push(...conversions);

      // Allow event loop to process between batches
      if (i + this.config.maxBatchSize < units.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  }

  // ========================================================================
  // Unit Definition Management
  // ========================================================================

  /**
   * Register a unit definition
   */
  registerDefinition(definition: UnitDefinition): void {
    this.unitDefinitions.set(definition.id, definition);
  }

  /**
   * Get a unit definition
   */
  getDefinition(id: string): UnitDefinition | undefined {
    return this.unitDefinitions.get(id);
  }

  /**
   * Get all registered definitions
   */
  getAllDefinitions(): UnitDefinition[] {
    return Array.from(this.unitDefinitions.values());
  }

  /**
   * Clear conversion cache
   */
  clearCache(): void {
    this.conversionCache.clear();
  }

  // ========================================================================
  // Quality Tier Helpers
  // ========================================================================

  /**
   * Update quality tier and adjust existing units
   */
  setQualityTier(tier: QualityTier): void {
    this.config.qualityTier = tier;

    // Update shadow quality for all units
    const shadowSize = this.qualityTierToShadowSize(tier);
    const textureSize = this.qualityTierToTextureSize(tier);

    for (const definition of this.unitDefinitions.values()) {
      definition.shadow.size = shadowSize;
      definition.shadow.textureSize = textureSize;
    }
  }

  /**
   * Get model LOD path based on quality tier
   */
  getModelLODPath(basePath: string, lod: 0 | 1 | 2 = 0): string {
    if (lod === 0) {
      return basePath; // Full quality
    }

    const ext = basePath.substring(basePath.lastIndexOf('.'));
    const base = basePath.substring(0, basePath.lastIndexOf('.'));

    return `${base}_lod${lod}${ext}`;
  }

  /**
   * Get appropriate LOD for distance and quality tier
   */
  getLODForDistance(distance: number): 0 | 1 | 2 {
    const lodDistances = {
      low: [20, 50],
      medium: [50, 100],
      high: [100, 200],
      ultra: [150, 300],
    };

    const [near, far] = lodDistances[this.config.qualityTier];

    if (distance < near) return 0;
    if (distance < far) return 1;
    return 2;
  }

  // ========================================================================
  // Private Helper Methods
  // ========================================================================

  private getLabEquipmentName(equipment: LabEquipment): string {
    const names: Record<LabEquipment, string> = {
      microscope: 'Microscope',
      centrifuge: 'Centrifuge',
      beaker: 'Beaker',
      bunsen_burner: 'Bunsen Burner',
      test_tube: 'Test Tube',
      petri_dish: 'Petri Dish',
      spectrometer: 'Spectrometer',
      custom: 'Custom Equipment',
    };
    return names[equipment] || 'Equipment';
  }

  private getLabEquipmentModelPath(equipment: LabEquipment): string {
    return `/models/lab/${equipment}.glb`;
  }

  private getLabEquipmentStats(equipment: LabEquipment): UnitStats {
    const baseStats: UnitStats = {
      maxHealth: 100,
      health: 100,
      speed: 0,
      damage: 0,
      range: 2,
      attackCooldown: 1,
      armor: 5,
      sightRadius: 5,
    };

    switch (equipment) {
      case 'microscope':
        return { ...baseStats, sightRadius: 8 };
      case 'centrifuge':
        return { ...baseStats, range: 0 };
      case 'bunsen_burner':
        return { ...baseStats, range: 3 };
      default:
        return baseStats;
    }
  }

  private getLabEquipmentAbilities(equipment: LabEquipment): string[] {
    const abilities: Record<LabEquipment, string[]> = {
      microscope: ['examine', 'zoom', 'capture'],
      centrifuge: ['spin', 'separate', 'analyze'],
      beaker: ['mix', 'heat', 'pour'],
      bunsen_burner: ['heat', 'ignite', 'sterilize'],
      test_tube: ['contain', 'mix', 'observe'],
      petri_dish: ['culture', 'observe', 'sample'],
      spectrometer: ['analyze', 'measure', 'record'],
      custom: ['interact'],
    };
    return abilities[equipment] || ['interact'];
  }

  private mapFigureTypeToUnitClass(type: string): UnitClass {
    const mapping: Record<string, UnitClass> = {
      humanoid: 'infantry',
      beast: 'infantry',
      construct: 'vehicle',
      undead: 'infantry',
      dragon: 'aircraft',
      elemental: 'infantry',
    };
    return mapping[type] || 'infantry';
  }

  private mapDnDClassToUnitClass(dndClass: string): UnitClass {
    const mapping: Record<string, UnitClass> = {
      Fighter: 'infantry',
      Barbarian: 'infantry',
      Rogue: 'infantry',
      Ranger: 'infantry',
      Wizard: 'infantry',
      Cleric: 'infantry',
      Paladin: 'hero',
      Monk: 'infantry',
    };
    return mapping[dndClass] || 'infantry';
  }

  private getDnDClassAbilities(dndClass: string, level: number): string[] {
    const baseAbilities: string[] = ['move', 'attack', 'stop'];

    const classAbilities: Record<string, string[]> = {
      Fighter: ['second_wind', 'action_surge'],
      Barbarian: ['rage', 'reckless_attack'],
      Rogue: ['sneak_attack', 'stealth'],
      Ranger: ['hunters_mark', 'spellcasting'],
      Wizard: ['spellcasting', 'arcane_recovery'],
      Cleric: ['spellcasting', 'channel_divinity'],
      Paladin: ['divine_smite', 'lay_on_hands'],
      Monk: ['martial_arts', 'ki'],
    };

    return [...baseAbilities, ...(classAbilities[dndClass] || [])];
  }

  private inferUnitClass(data: BaseUnitData): UnitClass {
    // Check for explicit class property
    if (data.properties.class) {
      return data.properties.class as UnitClass;
    }

    // Infer from properties
    if (data.properties.structure === true) return 'structure';
    if (data.properties.flying === true) return 'aircraft';
    if (data.properties.hero === true) return 'hero';
    if (data.properties.vehicle === true) return 'vehicle';

    return 'infantry';
  }

  private inferUnitStats(data: BaseUnitData, unitClass: UnitClass): UnitStats {
    const defaults: Record<UnitClass, UnitStats> = {
      infantry: {
        maxHealth: 100,
        health: 100,
        speed: 5,
        damage: 10,
        range: 1.5,
        attackCooldown: 1,
        armor: 2,
        sightRadius: 10,
      },
      vehicle: {
        maxHealth: 300,
        health: 300,
        speed: 8,
        damage: 30,
        range: 5,
        attackCooldown: 2,
        armor: 10,
        sightRadius: 15,
      },
      aircraft: {
        maxHealth: 150,
        health: 150,
        speed: 15,
        damage: 20,
        range: 3,
        attackCooldown: 0.5,
        armor: 0,
        sightRadius: 20,
      },
      naval: {
        maxHealth: 400,
        health: 400,
        speed: 4,
        damage: 25,
        range: 8,
        attackCooldown: 3,
        armor: 15,
        sightRadius: 15,
      },
      structure: {
        maxHealth: 1000,
        health: 1000,
        speed: 0,
        damage: 0,
        range: 0,
        attackCooldown: 0,
        armor: 20,
        sightRadius: 5,
      },
      hero: {
        maxHealth: 200,
        health: 200,
        speed: 6,
        damage: 25,
        range: 2,
        attackCooldown: 0.8,
        armor: 5,
        sightRadius: 15,
      },
    };

    let stats = { ...defaults[unitClass] };

    // Apply overrides from properties
    if (data.properties.health) {
      stats.maxHealth = data.properties.health as number;
      stats.health = stats.maxHealth;
    }
    if (data.properties.speed) {
      stats.speed = data.properties.speed as number;
    }
    if (data.properties.damage) {
      stats.damage = data.properties.damage as number;
    }
    if (data.properties.range) {
      stats.range = data.properties.range as number;
    }

    // Apply global scale
    stats.speed *= this.config.globalScale;
    stats.range *= this.config.globalScale;

    return stats;
  }

  private qualityTierToShadowSize(tier: QualityTier): number {
    const sizes: Record<QualityTier, number> = {
      low: 64,
      medium: 128,
      high: 256,
      ultra: 512,
    };
    return sizes[tier];
  }

  private qualityTierToTextureSize(tier: QualityTier): number {
    const sizes: Record<QualityTier, number> = {
      low: 128,
      medium: 256,
      high: 512,
      ultra: 1024,
    };
    return sizes[tier];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a unit adapter with configuration
 */
export function createUnitAdapter(
  config?: Partial<UnitAdapterConfig>
): UnitAdapter {
  return new UnitAdapter({
    ...DEFAULT_ADAPTER_CONFIG,
    ...config,
  });
}

/**
 * Create a StudyLoG-specific adapter
 */
export function createStudyLogAdapter(
  qualityTier?: QualityTier
): UnitAdapter {
  return new UnitAdapter({
    ...DEFAULT_ADAPTER_CONFIG,
    qualityTier: qualityTier || 'high',
    globalScale: 1.0,
  });
}

/**
 * Create a DMLoG-specific adapter
 */
export function createDMLoGAdapter(
  qualityTier?: QualityTier
): UnitAdapter {
  return new UnitAdapter({
    ...DEFAULT_ADAPTER_CONFIG,
    qualityTier: qualityTier || 'high',
    globalScale: 0.3, // Miniature scale
  });
}

export default UnitAdapter;
