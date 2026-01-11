/**
 * Species Registry
 *
 * Defines all animal species available in the ranch simulation.
 * Includes stats, behaviors, assets, and training configurations.
 *
 * @fileoverview Animal type definitions and registry
 */

import type {
  SpeciesConfig,
  SpeciesCategory,
  SpeciesStats,
  EngineTier,
  AIComplexityStage,
  DogSkillLevel,
  TrainingTarget,
  AnimalTrait,
} from './types.js';

// ============================================================================
// Base Statistics
// ============================================================================

/**
 * Default stats for each category.
 */
const CATEGORY_BASE_STATS: Record<SpeciesCategory, Partial<SpeciesStats>> = {
  poultry: {
    moveSpeed: 2.0,
    fleeSpeed: 4.0,
    detectionRadius: 5.0,
    personalSpace: 0.5,
    cohesion: 0.6,
    alignment: 0.4,
    separation: 0.8,
    weight: 2.0,
    size: 0.3,
    maxEnergy: 100,
    maxHunger: 100,
    maxHealth: 50,
  },
  herd: {
    moveSpeed: 1.5,
    fleeSpeed: 5.0,
    detectionRadius: 15.0,
    personalSpace: 1.5,
    cohesion: 0.7,
    alignment: 0.6,
    separation: 1.0,
    weight: 50.0,
    size: 1.0,
    maxEnergy: 150,
    maxHunger: 200,
    maxHealth: 100,
  },
  working_dog: {
    moveSpeed: 6.0,
    fleeSpeed: 8.0,
    detectionRadius: 25.0,
    personalSpace: 1.0,
    cohesion: 0.3,
    alignment: 0.5,
    separation: 0.7,
    weight: 20.0,
    size: 0.6,
    maxEnergy: 200,
    maxHunger: 100,
    maxHealth: 80,
  },
  equine: {
    moveSpeed: 8.0,
    fleeSpeed: 12.0,
    detectionRadius: 20.0,
    personalSpace: 2.0,
    cohesion: 0.5,
    alignment: 0.5,
    separation: 1.2,
    weight: 500.0,
    size: 1.5,
    maxEnergy: 300,
    maxHunger: 300,
    maxHealth: 200,
  },
  small: {
    moveSpeed: 3.0,
    fleeSpeed: 5.0,
    detectionRadius: 3.0,
    personalSpace: 0.3,
    cohesion: 0.4,
    alignment: 0.3,
    separation: 0.6,
    weight: 1.0,
    size: 0.2,
    maxEnergy: 80,
    maxHunger: 50,
    maxHealth: 30,
  },
  pond: {
    moveSpeed: 1.0,
    fleeSpeed: 3.0,
    detectionRadius: 5.0,
    personalSpace: 0.5,
    cohesion: 0.5,
    alignment: 0.4,
    separation: 0.5,
    weight: 0.5,
    size: 0.15,
    maxEnergy: 60,
    maxHunger: 40,
    maxHealth: 20,
  },
};

// ============================================================================
// Animal Traits
// ============================================================================

/**
 * Available genetic traits for animals.
 */
export const ANIMAL_TRAITS: Record<string, AnimalTrait> = {
  // Speed traits
  swift: {
    id: 'swift',
    name: 'Swift',
    modifiers: { moveSpeed: 1.2, fleeSpeed: 1.1 },
    color: '#FFD700',
  },
  sluggish: {
    id: 'sluggish',
    name: 'Sluggish',
    modifiers: { moveSpeed: 0.8, fleeSpeed: 0.9 },
    color: '#808080',
  },
  // Social traits
  friendly: {
    id: 'friendly',
    name: 'Friendly',
    modifiers: { cohesion: 1.3, detectionRadius: 1.1 },
    color: '#FF69B4',
  },
  solitary: {
    id: 'solitary',
    name: 'Solitary',
    modifiers: { cohesion: 0.6, personalSpace: 1.5 },
    color: '#4169E1',
  },
  // Alertness traits
  alert: {
    id: 'alert',
    name: 'Alert',
    modifiers: { detectionRadius: 1.5, fleeReactionTime: 0.8 },
    color: '#00CED1',
  },
  oblivious: {
    id: 'oblivious',
    name: 'Oblivious',
    modifiers: { detectionRadius: 0.7, fleeReactionTime: 1.2 },
    color: '#DEB887',
  },
  // Hardiness traits
  hardy: {
    id: 'hardy',
    name: 'Hardy',
    modifiers: { maxHealth: 1.3, maxEnergy: 1.2 },
    color: '#228B22',
  },
  frail: {
    id: 'frail',
    name: 'Frail',
    modifiers: { maxHealth: 0.7, maxEnergy: 0.8 },
    color: '#DDA0DD',
  },
  // Dog-specific traits
  natural_herder: {
    id: 'natural_herder',
    name: 'Natural Herder',
    modifiers: { trainingSpeed: 1.5, successRate: 1.2 },
    color: '#FF4500',
  },
  independent: {
    id: 'independent',
    name: 'Independent',
    modifiers: { bond: 0.7, focus: 1.3 },
    color: '#9370DB',
  },
  eager: {
    id: 'eager',
    name: 'Eager to Please',
    modifiers: { trainingSpeed: 1.3, bond: 1.2 },
    color: '#FFA500',
  },
  stubborn: {
    id: 'stubborn',
    name: 'Stubborn',
    modifiers: { trainingSpeed: 0.7, successRate: 0.8 },
    color: '#8B4513',
  },
};

// ============================================================================
// Species Configurations
// ============================================================================

/**
 * Complete species registry with all animals.
 */
export const SPECIES_REGISTRY: Record<string, SpeciesConfig> = {
  // ============================================================================
  // POULTRY - Training targets for puppies
  // ============================================================================

  chicken: {
    id: 'chicken',
    name: 'Chicken',
    category: 'poultry' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.poultry,
      moveSpeed: 1.5,
      fleeSpeed: 3.0,
      detectionRadius: 4.0,
      personalSpace: 0.4,
      cohesion: 0.5,
      alignment: 0.3,
      separation: 0.7,
      weight: 2.0,
      size: 0.25,
      maxEnergy: 80,
      maxHunger: 80,
      maxHealth: 40,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
      AIComplexityStage.PUPPY_TRAINING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/chicken.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/chicken.gltf',
        materials: ['chicken_white', 'chicken_comb'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/chicken.gltf',
        materials: ['chicken_body', 'chicken_comb', 'chicken_feathers'],
        animations: {
          idle: 'chicken_idle',
          walk: 'chicken_walk',
          peck: 'chicken_peck',
          flee: 'chicken_run',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 5,
      maxGroupSize: 15,
      fleeReactionTime: 0.5,
      trainingDifficulty: 1,
    },
    production: {
      resource: 'egg',
      interval: 300000, // 5 minutes
      amount: 1,
    },
  },

  goose: {
    id: 'goose',
    name: 'Goose',
    category: 'poultry' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.poultry,
      moveSpeed: 2.5,
      fleeSpeed: 5.0,
      detectionRadius: 8.0,
      personalSpace: 0.8,
      cohesion: 0.7,
      alignment: 0.5,
      separation: 0.9,
      weight: 5.0,
      size: 0.4,
      maxEnergy: 100,
      maxHunger: 100,
      maxHealth: 60,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
      AIComplexityStage.PUPPY_TRAINING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/goose.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/goose.gltf',
        materials: ['goose_body', 'goose_beak'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/goose.gltf',
        materials: ['goese_body', 'goose_beak', 'goose_feathers'],
        animations: {
          idle: 'goose_idle',
          walk: 'goose_walk',
          honk: 'goose_honk',
          flee: 'goose_run',
          attack: 'goose_attack',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 3,
      maxGroupSize: 10,
      fleeReactionTime: 0.3,
      trainingDifficulty: 2, // Geese are more aggressive - harder to herd
    },
    production: {
      resource: 'egg',
      interval: 480000, // 8 minutes
      amount: 1,
    },
  },

  duck: {
    id: 'duck',
    name: 'Duck',
    category: 'poultry' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.poultry,
      moveSpeed: 1.8,
      fleeSpeed: 4.0,
      detectionRadius: 6.0,
      personalSpace: 0.5,
      cohesion: 0.8,
      alignment: 0.6,
      separation: 0.6,
      weight: 2.5,
      size: 0.3,
      maxEnergy: 90,
      maxHunger: 90,
      maxHealth: 45,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
      AIComplexityStage.PUPPY_TRAINING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/duck.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/duck.gltf',
        materials: ['duck_body', 'duck_beak'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/duck.gltf',
        materials: ['duck_body', 'duck_beak', 'duck_feathers'],
        animations: {
          idle: 'duck_idle',
          walk: 'duck_walk',
          swim: 'duck_swim',
          flee: 'duck_run',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 6,
      maxGroupSize: 20,
      fleeReactionTime: 0.4,
      trainingDifficulty: 1.2,
    },
    production: {
      resource: 'egg',
      interval: 360000, // 6 minutes
      amount: 1,
    },
  },

  // ============================================================================
  // HERD ANIMALS - Main ranch production
  // ============================================================================

  sheep: {
    id: 'sheep',
    name: 'Sheep',
    category: 'herd' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.herd,
      moveSpeed: 1.2,
      fleeSpeed: 4.5,
      detectionRadius: 12.0,
      personalSpace: 1.2,
      cohesion: 0.8,
      alignment: 0.7,
      separation: 1.2,
      weight: 60.0,
      size: 0.9,
      maxEnergy: 120,
      maxHunger: 180,
      maxHealth: 90,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/sheep.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/sheep.gltf',
        materials: ['sheep_wool', 'sheep_face'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/sheep.gltf',
        materials: ['sheep_wool', 'sheep_face', 'sheep_hooves'],
        animations: {
          idle: 'sheep_idle',
          walk: 'sheep_walk',
          graze: 'sheep_graze',
          flee: 'sheep_run',
          bleat: 'sheep_bleat',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 10,
      maxGroupSize: 50,
      fleeReactionTime: 1.0,
      trainingDifficulty: 2.5,
    },
    production: {
      resource: 'wool',
      interval: 600000, // 10 minutes
      amount: 3,
    },
  },

  cow: {
    id: 'cow',
    name: 'Cow',
    category: 'herd' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.herd,
      moveSpeed: 1.0,
      fleeSpeed: 4.0,
      detectionRadius: 10.0,
      personalSpace: 2.0,
      cohesion: 0.7,
      alignment: 0.6,
      separation: 1.5,
      weight: 500.0,
      size: 1.5,
      maxEnergy: 180,
      maxHunger: 250,
      maxHealth: 150,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/cow.gltf',
        materials: ['cow_body', 'cow_spots'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/cow.gltf',
        materials: ['cow_body', 'cow_spots', 'cow_eyes'],
        animations: {
          idle: 'cow_idle',
          walk: 'cow_walk',
          graze: 'cow_graze',
          flee: 'cow_run',
          moo: 'cow_moo',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 8,
      maxGroupSize: 30,
      fleeReactionTime: 1.5,
      trainingDifficulty: 3,
    },
    production: {
      resource: 'milk',
      interval: 900000, // 15 minutes
      amount: 5,
    },
  },

  cattle: {
    id: 'cattle',
    name: 'Cattle (Beef)',
    category: 'herd' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.herd,
      moveSpeed: 1.3,
      fleeSpeed: 5.0,
      detectionRadius: 15.0,
      personalSpace: 2.5,
      cohesion: 0.65,
      alignment: 0.55,
      separation: 1.8,
      weight: 600.0,
      size: 1.6,
      maxEnergy: 200,
      maxHunger: 300,
      maxHealth: 180,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/cattle.gltf',
        materials: ['cattle_body', 'cattle_horns'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/cattle.gltf',
        materials: ['cattle_body', 'cattle_horns', 'cattle_hooves'],
        animations: {
          idle: 'cattle_idle',
          walk: 'cattle_walk',
          graze: 'cattle_graze',
          flee: 'cattle_run',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 12,
      maxGroupSize: 40,
      fleeReactionTime: 1.2,
      trainingDifficulty: 3.5,
    },
  },

  goat: {
    id: 'goat',
    name: 'Goat',
    category: 'herd' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.herd,
      moveSpeed: 2.0,
      fleeSpeed: 6.0,
      detectionRadius: 14.0,
      personalSpace: 1.0,
      cohesion: 0.6,
      alignment: 0.5,
      separation: 1.0,
      weight: 40.0,
      size: 0.7,
      maxEnergy: 140,
      maxHunger: 120,
      maxHealth: 70,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/goat.gltf',
        materials: ['goat_body', 'goat_horns'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/goat.gltf',
        materials: ['goat_body', 'goat_horns', 'goat_eyes'],
        animations: {
          idle: 'goat_idle',
          walk: 'goat_walk',
          graze: 'goat_graze',
          flee: 'goat_run',
          climb: 'goat_climb',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: true,
      preferredGroupSize: 6,
      maxGroupSize: 20,
      fleeReactionTime: 0.8,
      trainingDifficulty: 2.8, // Goats are independent and stubborn
    },
    production: {
      resource: 'milk',
      interval: 720000, // 12 minutes
      amount: 2,
    },
  },

  // ============================================================================
  // WORKING DOGS - Player agents
  // ============================================================================

  border_collie: {
    id: 'border_collie',
    name: 'Border Collie',
    category: 'working_dog' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.working_dog,
      moveSpeed: 7.0,
      fleeSpeed: 9.0,
      detectionRadius: 30.0,
      personalSpace: 1.2,
      cohesion: 0.4,
      alignment: 0.6,
      separation: 0.8,
      weight: 22.0,
      size: 0.65,
      maxEnergy: 250,
      maxHunger: 120,
      maxHealth: 100,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.PUPPY_TRAINING,
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/border_collie.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/border_collie.gltf',
        materials: ['collie_body', 'collie markings', 'collie_eyes'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/border_collie.gltf',
        materials: ['collie_body', 'collie_markings', 'collie_eyes', 'collie_nose'],
        animations: {
          idle: 'collie_idle',
          walk: 'collie_walk',
          run: 'collie_run',
          bark: 'collie_bark',
          herd: 'collie_herd_stance',
          lie: 'collie_lie_down',
          play: 'collie_play',
        },
      },
    },
    behaviors: {
      isHerding: false,
      herdableByDog: false,
      preferredGroupSize: 1,
      maxGroupSize: 1,
      fleeReactionTime: 0.1,
      trainingDifficulty: 2, // Border collies learn quickly
    },
  },

  aussie_shepherd: {
    id: 'aussie_shepherd',
    name: 'Australian Shepherd',
    category: 'working_dog' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.working_dog,
      moveSpeed: 6.5,
      fleeSpeed: 8.5,
      detectionRadius: 28.0,
      personalSpace: 1.3,
      cohesion: 0.45,
      alignment: 0.55,
      separation: 0.85,
      weight: 25.0,
      size: 0.7,
      maxEnergy: 240,
      maxHunger: 110,
      maxHealth: 95,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.PUPPY_TRAINING,
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/aussie.gltf',
        materials: ['aussie_body', 'aussie_markings'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/aussie.gltf',
        materials: ['aussie_body', 'aussie_markings', 'aussie_eyes'],
        animations: {
          idle: 'aussie_idle',
          walk: 'aussie_walk',
          run: 'aussie_run',
          bark: 'aussie_bark',
          herd: 'aussie_herd',
        },
      },
    },
    behaviors: {
      isHerding: false,
      herdableByDog: false,
      preferredGroupSize: 1,
      maxGroupSize: 1,
      fleeReactionTime: 0.15,
      trainingDifficulty: 2.2,
    },
  },

  // ============================================================================
  // EQUINE - Transport
  // ============================================================================

  horse: {
    id: 'horse',
    name: 'Horse',
    category: 'equine' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.equine,
      moveSpeed: 10.0,
      fleeSpeed: 15.0,
      detectionRadius: 25.0,
      personalSpace: 2.5,
      cohesion: 0.4,
      alignment: 0.5,
      separation: 1.5,
      weight: 450.0,
      size: 1.8,
      maxEnergy: 400,
      maxHunger: 350,
      maxHealth: 250,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.HERD_ANIMALS,
      AIComplexityStage.ADVANCED_HERDING,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/horse.gltf',
        materials: ['horse_body', 'horse_mane', 'horse_tail'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/horse.gltf',
        materials: ['horse_body', 'horse_mane', 'horse_tail', 'horse_hooves'],
        animations: {
          idle: 'horse_idle',
          walk: 'horse_walk',
          trot: 'horse_trot',
          gallop: 'horse_gallop',
          neigh: 'horse_neigh',
        },
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: false, // Horses are too large for dogs to herd
      preferredGroupSize: 5,
      maxGroupSize: 15,
      fleeReactionTime: 0.5,
      trainingDifficulty: 4,
    },
  },

  donkey: {
    id: 'donkey',
    name: 'Donkey',
    category: 'equine' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.equine,
      moveSpeed: 4.0,
      fleeSpeed: 6.0,
      detectionRadius: 15.0,
      personalSpace: 2.0,
      cohesion: 0.5,
      alignment: 0.4,
      separation: 1.8,
      weight: 200.0,
      size: 1.4,
      maxEnergy: 300,
      maxHunger: 200,
      maxHealth: 180,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.HERD_ANIMALS,
    ],
    assets: {
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/donkey.gltf',
        materials: ['donkey_body', 'donkey_mane'],
      },
      [EngineTier.OPENRTS_3D]: {
        model: 'models/detailed/donkey.gltf',
        materials: ['donkey_body', 'donkey_mane'],
        animations: {
          idle: 'donkey_idle',
          walk: 'donkey_walk',
          bray: 'donkey_bray',
        },
      },
    },
    behaviors: {
      isHerding: false,
      herdableByDog: false,
      preferredGroupSize: 2,
      maxGroupSize: 5,
      fleeReactionTime: 1.0,
      trainingDifficulty: 1, // Donkeys are stoic and easy to keep
    },
  },

  // ============================================================================
  // SMALL ANIMALS
  // ============================================================================

  rabbit: {
    id: 'rabbit',
    name: 'Rabbit',
    category: 'small' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.small,
      moveSpeed: 5.0,
      fleeSpeed: 8.0,
      detectionRadius: 8.0,
      personalSpace: 0.4,
      cohesion: 0.5,
      alignment: 0.3,
      separation: 0.8,
      weight: 2.0,
      size: 0.2,
      maxEnergy: 70,
      maxHunger: 40,
      maxHealth: 25,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
      AIComplexityStage.PUPPY_TRAINING,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/rabbit.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/rabbit.gltf',
        materials: ['rabbit_body'],
      },
    },
    behaviors: {
      isHerding: false,
      herdableByDog: true,
      preferredGroupSize: 3,
      maxGroupSize: 8,
      fleeReactionTime: 0.2, // Very reactive
      trainingDifficulty: 1.5,
    },
  },

  // ============================================================================
  // POND ANIMALS
  // ============================================================================

  fish: {
    id: 'fish',
    name: 'Fish',
    category: 'pond' as SpeciesCategory,
    stats: {
      ...CATEGORY_BASE_STATS.pond,
      moveSpeed: 1.5,
      fleeSpeed: 4.0,
      detectionRadius: 4.0,
      personalSpace: 0.3,
      cohesion: 0.7,
      alignment: 0.8,
      separation: 0.4,
      weight: 0.3,
      size: 0.1,
      maxEnergy: 50,
      maxHunger: 30,
      maxHealth: 15,
    } as SpeciesStats,
    supportedStages: [
      AIComplexityStage.SIMPLE,
    ],
    assets: {
      [EngineTier.MICROVERSE_2D]: {
        sprite: 'sprites/animals/fish.png',
      },
      [EngineTier.LUANTI_BLOCKY]: {
        model: 'models/blocky/fish.gltf',
        materials: ['fish_body'],
      },
    },
    behaviors: {
      isHerding: true,
      herdableByDog: false,
      preferredGroupSize: 10,
      maxGroupSize: 50,
      fleeReactionTime: 0.1,
      trainingDifficulty: 0,
    },
  },
};

// ============================================================================
// Training Targets Configuration
// ============================================================================

/**
 * Training target configurations for dog skill development.
 * Maps species to their effectiveness as training targets.
 */
export const TRAINING_TARGETS: Record<string, TrainingTarget> = {
  chicken: {
    speciesId: 'chicken',
    difficulty: 1.0,
    xpMultiplier: 1.0,
    maxSkillLevel: DogSkillLevel.APPRENTICE,
    recommendedGroupSize: 5,
  },
  duck: {
    speciesId: 'duck',
    difficulty: 1.2,
    xpMultiplier: 1.2,
    maxSkillLevel: DogSkillLevel.APPRENTICE,
    recommendedGroupSize: 6,
  },
  rabbit: {
    speciesId: 'rabbit',
    difficulty: 1.5,
    xpMultiplier: 1.5,
    maxSkillLevel: DogSkillLevel.COMPETENT,
    recommendedGroupSize: 4,
  },
  goose: {
    speciesId: 'goose',
    difficulty: 2.0,
    xpMultiplier: 2.0,
    maxSkillLevel: DogSkillLevel.COMPETENT,
    recommendedGroupSize: 3,
  },
  sheep: {
    speciesId: 'sheep',
    difficulty: 2.5,
    xpMultiplier: 3.0,
    maxSkillLevel: DogSkillLevel.EXPERT,
    recommendedGroupSize: 10,
  },
  goat: {
    speciesId: 'goat',
    difficulty: 2.8,
    xpMultiplier: 3.5,
    maxSkillLevel: DogSkillLevel.EXPERT,
    recommendedGroupSize: 6,
  },
  cow: {
    speciesId: 'cow',
    difficulty: 3.0,
    xpMultiplier: 4.0,
    maxSkillLevel: DogSkillLevel.MASTER,
    recommendedGroupSize: 8,
  },
  cattle: {
    speciesId: 'cattle',
    difficulty: 3.5,
    xpMultiplier: 5.0,
    maxSkillLevel: DogSkillLevel.MASTER,
    recommendedGroupSize: 12,
  },
};

// ============================================================================
// Registry API
// ============================================================================

/**
 * Get species configuration by ID.
 */
export function getSpecies(speciesId: string): SpeciesConfig | undefined {
  return SPECIES_REGISTRY[speciesId];
}

/**
 * Get all species in a category.
 */
export function getSpeciesByCategory(category: SpeciesCategory): SpeciesConfig[] {
  return Object.values(SPECIES_REGISTRY).filter(s => s.category === category);
}

/**
 * Get all species available for a given AI stage.
 */
export function getSpeciesByStage(stage: AIComplexityStage): SpeciesConfig[] {
  return Object.values(SPECIES_REGISTRY).filter(s =>
    s.supportedStages.includes(stage)
  );
}

/**
 * Get training targets for a given dog skill level.
 */
export function getTrainingTargetsForLevel(level: DogSkillLevel): TrainingTarget[] {
  return Object.values(TRAINING_TARGETS).filter(
    target => target.maxSkillLevel >= level
  );
}

/**
 * Get trait by ID.
 */
export function getTrait(traitId: string): AnimalTrait | undefined {
  return ANIMAL_TRAITS[traitId];
}

/**
 * Get random traits for a species.
 */
export function getRandomTraits(count: number = 2): AnimalTrait[] {
  const traits = Object.values(ANIMAL_TRAITS);
  const shuffled = [...traits].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Check if a species is compatible with an engine tier.
 */
export function isSpeciesCompatibleWithTier(
  speciesId: string,
  tier: EngineTier
): boolean {
  const species = getSpecies(speciesId);
  if (!species) return false;
  return species.assets[tier] !== undefined;
}

/**
 * Get all species IDs.
 */
export function getAllSpeciesIds(): string[] {
  return Object.keys(SPECIES_REGISTRY);
}

/**
 * Get species category by ID.
 */
export function getSpeciesCategory(speciesId: string): SpeciesCategory | undefined {
  const species = getSpecies(speciesId);
  return species?.category;
}
