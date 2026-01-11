/**
 * DMLoG.AI - Procedural Content Generation System
 *
 * Main export module for all procedural generation utilities.
 *
 * This module provides:
 * - encounter-gen: Combat encounter generation with XP math, creature composition
 * - npc-gen: NPC generation with personality, stats, voice, and roleplaying hooks
 * - loot-gen: Treasure and magic item generation with value calculations
 * - dungeon-gen: Dungeon and room generation with spatial algorithms
 * - quest-gen: Plot hook and quest generation with narrative structures
 *
 * Design Philosophy:
 * - Use deterministic math for calculations (CR, XP, value, stats)
 * - Use AI-assisted templates for creative elements (descriptions, names, lore)
 * - Provide Zod schemas for type safety and validation
 * - Make everything composable and reusable
 */

// Export encounter generation
export {
  EncounterGen,
  generateEncounter,
  calculateXpThreshold,
  getEncounterMultiplier,
  assessEncounterDeadliness,
  generateTactics,
  getEnvironmentalEffects,
  generateEscalation,
  type Creature,
  type CreatureRole,
  type Encounter,
  type EncounterDifficulty,
  type EnvironmentEffect,
  type PartyComposition,
} from './encounter-gen.js';

// Export NPC generation
export {
  NPCGen,
  generateNPC,
  generateName,
  generateAlignment,
  rollAbilityScore,
  rollAbilityScores,
  generateClassStats,
  generateSkills,
  generateVoice,
  generatePersonality,
  generateMotivations,
  generateAppearance,
  generateSecret,
  generateRelationship,
  generateRoleplayHooks,
  type NPC,
  type Alignment,
  type CharacterClass,
  type Background,
  type VoiceDescriptor,
  type Motivation,
  type Relationship,
  type Secret,
} from './npc-gen.js';

// Export loot generation
export {
  LootGen,
  generateTreasureHoard,
  generateIndividualLoot,
  generateCurrency,
  generateGem,
  generateArtObject,
  generateMagicItem,
  generatePotion,
  generateEncounterLoot,
  toGoldPieces,
  fromGoldPieces,
  formatCurrency,
  rollDice,
  type TreasureHoard,
  type MagicItem,
  type Gem,
  type ArtObject,
  type Currency,
  type ItemRarity,
  type ItemType,
  type LootEntry,
} from './loot-gen.js';

// Export dungeon generation
export {
  DungeonGen,
  generateDungeon,
  generateDungeonLevel,
  generateRoom,
  getRoomBounds,
  roomsOverlap,
  distanceBetweenRooms,
  generateDoorType,
  type Room,
  type Dungeon,
  type DungeonLevel,
  type Door,
  type Trap,
  type Feature,
  type RoomPurpose,
  type RoomShape,
  type TerrainType,
  type LightLevel,
  type Point,
  type Bounds,
} from './dungeon-gen.js';

// Export quest generation
export {
  QuestGen,
  generateQuest,
  generateQuestChain,
  generatePlotHook,
  generateQuestGiver,
  generateQuestObjectives,
  calculateGoldReward,
  calculateXpReward,
  calculateRecommendedLevel,
  type Quest,
  type QuestType,
  type QuestTier,
  type QuestRarity,
  type QuestStatus,
  type QuestObjective,
  type QuestReward,
  type QuestPrerequisite,
  type PlotHook,
  type QuestStage,
  type QuestGiverType,
  type QuestChain,
} from './quest-gen.js';

// ============================================================================
// INTEGRATION UTILITIES
// ============================================================================

/**
 * Generate a complete DMLoG adventure location
 */
export interface GenerateAdventureOptions {
  name?: string;
  dungeonType: Dungeon['type'];
  levels: number;
  roomsPerLevel: number;
  partyLevel: number;
  partySize: number;
  theme?: string;
}

export interface GeneratedAdventure {
  dungeon: Dungeon;
  encounters: {
    level: number;
    roomId: string;
    encounter: Encounter;
  }[];
  npcs: {
    roomId: string;
    npc: NPC;
  }[];
  loot: {
    roomId: string;
    hoard: TreasureHoard;
  }[];
  quest: Quest;
}

/**
 * Generate a complete adventure with dungeon, encounters, NPCs, loot, and quest
 */
export async function generateAdventure(
  options: GenerateAdventureOptions
): Promise<GeneratedAdventure> {
  // Import required types at runtime
  const { generateDungeon } = await import('./dungeon-gen.js');
  const { generateEncounter } = await import('./encounter-gen.js');
  const { generateNPC } = await import('./npc-gen.js');
  const { generateTreasureHoard } = await import('./loot-gen.js');
  const { generateQuest } = await import('./quest-gen.js');

  // Generate dungeon
  const dungeon = generateDungeon({
    type: options.dungeonType,
    levels: options.levels,
    roomsPerLevel: options.roomsPerLevel,
    theme: options.theme,
    recommendedLevel: {
      min: Math.max(1, options.partyLevel - 2),
      max: options.partyLevel + 2,
    },
  });

  // Generate encounters for key rooms
  const encounters: GeneratedAdventure['encounters'] = [];
  const npcs: GeneratedAdventure['npcs'] = [];
  const loot: GeneratedAdventure['loot'] = [];

  for (const level of dungeon.levels) {
    for (const room of level.rooms) {
      // Generate encounter for combat-appropriate rooms
      if (['guard-room', 'barracks', 'boss-chamber', 'throne-room'].includes(room.purpose)) {
        const encounter = await generateEncounter({
          party: {
            level: options.partyLevel,
            size: options.partySize,
          },
          difficulty: room.purpose === 'boss-chamber' ? 'deadly' : 'medium',
          terrain: room.terrain,
        });

        encounters.push({
          level: level.level,
          roomId: room.id,
          encounter,
        });
      }

      // Generate NPCs for social rooms
      if (['living-quarters', 'dining', 'library', 'chapel', 'throne-room'].includes(room.purpose)) {
        const npc = generateNPC({
          background: randomBackground(),
        });

        npcs.push({
          roomId: room.id,
          npc,
        });
      }

      // Generate loot for appropriate rooms
      if (['treasury', 'boss-chamber', 'armory', 'bedroom'].includes(room.purpose)) {
        const hoard = generateTreasureHoard({
          cr: options.partyLevel,
          source: room.purpose === 'boss-chamber' ? 'dragon-hoard' : 'hoard',
        });

        loot.push({
          roomId: room.id,
          hoard,
        });
      }
    }
  }

  // Generate main quest
  const quest = generateQuest({
    tier: options.levels > 2 ? 'national' : 'regional',
    rarity: options.levels > 3 ? 'epic' : 'rare',
    recommendedLevel: {
      min: Math.max(1, options.partyLevel - 1),
      max: options.partyLevel + 1,
    },
  });

  return {
    dungeon,
    encounters,
    npcs,
    loot,
    quest,
  };
}

function randomBackground(): Background {
  const backgrounds: Background[] = [
    'acolyte', 'charlatan', 'criminal', 'entertainer', 'folk-hero',
    'gladiator', 'guild-artisan', 'hermit', 'noble', 'outlander',
    'sage', 'soldier', 'urchin', 'custom'
  ];
  return backgrounds[Math.floor(Math.random() * backgrounds.length)];
}

// Re-export types
import type { Dungeon } from './dungeon-gen.js';
import type { Encounter } from './encounter-gen.js';
import type { NPC } from './npc-gen.js';
import type { TreasureHoard } from './loot-gen.js';
import type { Quest } from './quest-gen.js';
import type { Background } from './npc-gen.js';

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  EncounterGen: () => import('./encounter-gen.js'),
  NPCGen: () => import('./npc-gen.js'),
  LootGen: () => import('./loot-gen.js'),
  DungeonGen: () => import('./dungeon-gen.js'),
  QuestGen: () => import('./quest-gen.js'),
  generateAdventure,
};
