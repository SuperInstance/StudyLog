/**
 * DMLoG.AI - Loot Generation System
 *
 * Procedural treasure and item generation using:
 * - Deterministic math for item rarity, value distribution, treasure hoard sizing
 * - AI for creative item names, descriptions, lore, and unique properties
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

export const ItemRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'very-rare',
  'legendary',
  'artifact',
  'varies',
]);

export const ItemTypeSchema = z.enum([
  'armor',
  'weapon',
  'potion',
  'ring',
  'staff',
  'wand',
  'wondrous-item',
  'rod',
  'scroll',
  'tool',
  'gem',
  'art-object',
  'currency',
]);

export const ItemCategorySchema = z.enum([
  'adventuring-gear',
  'magic-item',
  'weapon',
  'armor',
  'jewelry',
  'consumable',
]);

export const CurrencySchema = z.object({
  cp: z.number().default(0),
  sp: z.number().default(0),
  ep: z.number().default(0),
  gp: z.number().default(0),
  pp: z.number().default(0),
});

export const MagicItemSchema = z.object({
  name: z.string(),
  type: ItemTypeSchema,
  rarity: ItemRaritySchema,
  requiresAttunement: z.boolean().default(false),
  description: z.string(),
  properties: z.array(z.string()).default([]),
  lore: z.string().optional(),
  curses: z.array(z.string()).default([]),
  valueOverride: z.number().optional(),
});

export const GemSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.number(),
  carats: z.number(),
  description: z.string().optional(),
});

export const ArtObjectSchema = z.object({
  name: z.string(),
  type: z.string(),
  value: z.number(),
  description: z.string(),
  creator: z.string().optional(),
  age: z.string().optional(),
});

export const TreasureHoardSchema = z.object({
  currency: CurrencySchema,
  gems: z.array(GemSchema).default([]),
  artObjects: z.array(ArtObjectSchema).default([]),
  magicItems: z.array(MagicItemSchema).default([]),
  totalValue: z.number(),
  cr: z.number(),
  source: z.enum(['individual', 'hoard', 'dragon-hoard']).default('hoard'),
});

export const LootEntrySchema = z.object({
  item: z.union([MagicItemSchema, GemSchema, ArtObjectSchema, CurrencySchema]),
  quantity: z.number().default(1),
  identified: z.boolean().default(true),
  notes: z.string().optional(),
});

export type ItemRarity = z.infer<typeof ItemRaritySchema>;
export type ItemType = z.infer<typeof ItemTypeSchema>;
export type ItemCategory = z.infer<typeof ItemCategorySchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type MagicItem = z.infer<typeof MagicItemSchema>;
export type Gem = z.infer<typeof GemSchema>;
export type ArtObject = z.infer<typeof ArtObjectSchema>;
export type TreasureHoard = z.infer<typeof TreasureHoardSchema>;
export type LootEntry = z.infer<typeof LootEntrySchema>;

// ============================================================================
// CURRENCY EXCHANGE RATES
// ============================================================================

export const EXCHANGE_RATES = {
  pp: 1000, // 1 pp = 1000 cp
  gp: 100,  // 1 gp = 100 cp
  ep: 50,   // 1 ep = 50 cp
  sp: 10,   // 1 sp = 10 cp
  cp: 1,    // 1 cp = 1 cp
};

/**
 * Convert currency to gold pieces
 */
export function toGoldPieces(currency: Currency): number {
  return (
    currency.cp / EXCHANGE_RATES.gp +
    currency.sp / (EXCHANGE_RATES.gp / EXCHANGE_RATES.sp) +
    currency.ep / (EXCHANGE_RATES.gp / EXCHANGE_RATES.ep) +
    currency.gp +
    currency.pp * (EXCHANGE_RATES.pp / EXCHANGE_RATES.gp)
  );
}

/**
 * Convert gold pieces to currency breakdown
 */
export function fromGoldPieces(gp: number, options?: {
  preferPlatinum?: boolean;
  maxCoinWeight?: number; // Maximum weight in pounds (50 coins per lb)
}): Currency {
  const { preferPlatinum = false, maxCoinWeight } = options || {};

  let remaining = Math.round(gp * 100); // Work in copper pieces

  const result: Currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  // If preferring platinum, convert high values first
  if (preferPlatinum) {
    result.pp = Math.floor(remaining / EXCHANGE_RATES.pp);
    remaining %= EXCHANGE_RATES.pp;
  }

  result.gp = Math.floor(remaining / EXCHANGE_RATES.gp);
  remaining %= EXCHANGE_RATES.gp;

  result.ep = Math.floor(remaining / EXCHANGE_RATES.ep);
  remaining %= EXCHANGE_RATES.ep;

  result.sp = Math.floor(remaining / EXCHANGE_RATES.sp);
  remaining %= EXCHANGE_RATES.sp;

  result.cp = remaining;

  // If there's a weight limit, convert lighter coins
  if (maxCoinWeight) {
    const maxCoins = maxCoinWeight * 50;
    const totalCoins = result.pp + result.gp + result.sp + result.cp + result.ep;

    if (totalCoins > maxCoins) {
      // Convert to platinum to reduce coin count
      const excess = totalCoins - maxCoins;
      const ppToAdd = Math.ceil(excess / 100);
      result.pp += ppToAdd;
      // Remove equivalent value from other coins
      const ppValue = ppToAdd * EXCHANGE_RATES.pp;
      result.gp = Math.max(0, result.gp - Math.floor(ppValue / EXCHANGE_RATES.gp));
    }
  }

  return result;
}

// ============================================================================
// TREASURE HOARD TABLES (SRD Based)
// ============================================================================

interface TreasureTableEntry {
  cr: number;
  currency: { min: number; max: number };
  gems?: { count: number; valueRange: [number, number] };
  art?: { count: number; valueRange: [number, number] };
  magicItems?: { count: number; rarities: ItemRarity[] };
}

const TREASURE_TABLES: Record<string, TreasureTableEntry> = {
  // CR 0-4
  '0-4': {
    cr: 4,
    currency: { min: 0, max: 50 },
    gems: { count: '1d6', valueRange: [10, 50] },
    art: { count: '1d4', valueRange: [10, 50] },
  },
  // CR 5-10
  '5-10': {
    cr: 10,
    currency: { min: 100, max: 1000 },
    gems: { count: '2d6', valueRange: [50, 100] },
    art: { count: '1d4', valueRange: [50, 100] },
    magicItems: { count: '1d4', rarities: ['common', 'uncommon'] },
  },
  // CR 11-16
  '11-16': {
    cr: 16,
    currency: { min: 1000, max: 10000 },
    gems: { count: '4d6', valueRange: [100, 500] },
    art: { count: '2d4', valueRange: [100, 500] },
    magicItems: { count: '1d6', rarities: ['uncommon', 'rare', 'very-rare'] },
  },
  // CR 17+
  '17+': {
    cr: 17,
    currency: { min: 10000, max: 100000 },
    gems: { count: '8d6', valueRange: [500, 5000] },
    art: { count: '4d4', valueRange: [500, 5000] },
    magicItems: { count: '1d8', rarities: ['rare', 'very-rare', 'legendary'] },
  },
};

/**
 * Parse dice notation like "2d6+3"
 */
function parseDice(notation: string): { count: number; sides: number; bonus: number } {
  const match = notation.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { count: 1, sides: 6, bonus: 0 };

  return {
    count: parseInt(match[1]),
    sides: parseInt(match[2]),
    bonus: match[3] ? parseInt(match[3]) : 0,
  };
}

/**
 * Roll dice notation
 */
export function rollDice(notation: string): number {
  const dice = parseDice(notation);
  let result = dice.bonus;

  for (let i = 0; i < dice.count; i++) {
    result += Math.floor(Math.random() * dice.sides) + 1;
  }

  return result;
}

/**
 * Get treasure table entry for a given CR
 */
function getTreasureEntry(cr: number): TreasureTableEntry {
  if (cr <= 4) return TREASURE_TABLES['0-4'];
  if (cr <= 10) return TREASURE_TABLES['5-10'];
  if (cr <= 16) return TREASURE_TABLES['11-16'];
  return TREASURE_TABLES['17+'];
}

// ============================================================================
// CURRENCY GENERATION
// ============================================================================

/**
 * Generate currency for a given CR
 */
export function generateCurrency(cr: number, multiplier: number = 1): Currency {
  const entry = getTreasureEntry(cr);
  const baseGp = entry.currency.min + Math.floor(Math.random() * (entry.currency.max - entry.currency.min));

  // Scale with CR and multiplier
  const scaledGp = Math.floor(baseGp * (1 + cr * 0.1) * multiplier);

  return fromGoldPieces(scaledGp);
}

// ============================================================================
// GEM GENERATION
// ============================================================================

const GEM_TYPES: Array<{ name: string; baseValue: number; description: string }> = [
  { name: 'Agate', baseValue: 10, description: 'banded stone in various colors' },
  { name: 'Bloodstone', baseValue: 15, description: 'dark green with red flecks' },
  { name: 'Carnelian', baseValue: 15, description: 'orange to reddish-brown' },
  { name: 'Chalcedony', baseValue: 15, description: 'white to blue-white' },
  { name: 'Chrysoprase', baseValue: 15, description: 'translucent green' },
  { name: 'Jasper', baseValue: 20, description: 'brown, red, or yellow' },
  { name: 'Moonstone', baseValue: 25, description: 'white with pale blue glow' },
  { name: 'Onyx', baseValue: 25, description: 'bands of black and white' },
  { name: 'Quartz', baseValue: 10, description: 'clear or smoky crystal' },
  { name: 'Sardonyx', baseValue: 25, description: 'layered red and white' },
  { name: 'Star Rose Quartz', baseValue: 30, description: 'pink with star pattern' },
  { name: 'Amber', baseValue: 50, description: 'golden, fossilized resin' },
  { name: 'Amethyst', baseValue: 50, description: 'purple crystal' },
  { name: 'Chrysoberyl', baseValue: 50, description: 'yellow-green to green' },
  { name: 'Coral', baseValue: 50, description: 'red, pink, or white' },
  { name: 'Garnet', baseValue: 50, description: 'deep red' },
  { name: 'Jade', baseValue: 50, description: 'green to white' },
  { name: 'Jet', baseValue: 50, description: 'black, fossilized wood' },
  { name: 'Pearl', baseValue: 50, description: 'lustrous, white or black' },
  { name: 'Spinel', baseValue: 50, description: 'red, green, brown, or blue' },
  { name: 'Tourmaline', baseValue: 50, description: 'pink, green, blue, or multi-colored' },
  { name: 'Aquamarine', baseValue: 100, description: 'pale blue-green' },
  { name: 'Garnet (Blue)', baseValue: 100, description: 'deep blue' },
  { name: 'Pearl (Black)', baseValue: 100, description: 'iridescent black' },
  { name: 'Peridot', baseValue: 100, description: 'olive green' },
  { name: 'Sapphire (Blue)', baseValue: 100, description: 'deep blue' },
  { name: 'Sapphire (Red)', baseValue: 100, description: 'red ruby' },
  { name: 'Sapphire (Star)', baseValue: 100, description: 'blue with star pattern' },
  { name: 'Topaz', baseValue: 100, description: 'golden yellow' },
  { name: 'Emerald', baseValue: 500, description: 'rich green' },
  { name: 'Opal (Black)', baseValue: 500, description: 'fiery black' },
  { name: 'Opal (Fire)', baseValue: 500, description: 'fiery red' },
  { name: 'Opal (White)', baseValue: 500, description: 'iridescent white' },
  { name: 'Sapphire (Blue, Fine)', baseValue: 500, description: 'brilliant blue' },
  { name: 'Star Ruby', baseValue: 500, description: 'red with star pattern' },
  { name: 'Diamond', baseValue: 5000, description: 'clear, brilliant' },
  { name: 'Diamond (Blue)', baseValue: 5000, description: 'rare blue' },
  { name: 'Diamond (Canary)', baseValue: 5000, description: 'yellow diamond' },
  { name: 'Diamond (Pink)', baseValue: 5000, description: 'rare pink' },
  { name: 'Emerald (Cleopal)', baseValue: 5000, description: 'flawless green' },
  { name: 'Ruby', baseValue: 5000, description: 'deep red' },
  { name: 'Sapphire (Blue, Perfect)', baseValue: 5000, description: 'flawless blue' },
  { name: 'Jacinth', baseValue: 5000, description: 'orange zircon' },
];

/**
 * Generate a gem
 */
export function generateGem(minValue: number = 10, maxValue: number = 5000): Gem {
  // Filter gems within value range
  const validGems = GEM_TYPES.filter(
    g => g.baseValue >= minValue && g.baseValue <= maxValue
  );

  if (validGems.length === 0) {
    // Fallback to any gem if range doesn't match
    const anyGem = GEM_TYPES[Math.floor(Math.random() * GEM_TYPES.length)];
    return {
      name: anyGem.name,
      type: 'gem',
      value: anyGem.baseValue,
      carats: Math.floor(Math.sqrt(anyGem.baseValue) * (0.5 + Math.random())),
      description: anyGem.description,
    };
  }

  const gemType = validGems[Math.floor(Math.random() * validGems.length)];

  // Value variation
  const variation = 0.8 + Math.random() * 0.4; // 80%-120% of base
  const value = Math.round(gemType.baseValue * variation);

  // Carats roughly based on square root of value
  const carats = Math.floor(Math.sqrt(value) * (0.5 + Math.random()));

  return {
    name: `${gemType.name} (${carats} carats)`,
    type: 'gem',
    value,
    carats,
    description: gemType.description,
  };
}

/**
 * Generate multiple gems
 */
export function generateGems(
  count: number | string,
  valueRange: [number, number]
): Gem[] {
  const gemCount = typeof count === 'string' ? rollDice(count) : count;
  const gems: Gem[] = [];

  for (let i = 0; i < gemCount; i++) {
    gems.push(generateGem(valueRange[0], valueRange[1]));
  }

  return gems;
}

// ============================================================================
// ART OBJECT GENERATION
// ============================================================================

const ART_OBJECT_TYPES = [
  { name: 'Silver ewer', baseValue: 10, description: 'ornate silver pitcher' },
  { name: 'Carved ivory statuette', baseValue: 15, description: 'intricately carved figure' },
  { name: 'Small gold bracelet', baseValue: 25, description: 'delicate gold jewelry' },
  { name: 'Cloth-of-gold vestments', baseValue: 30, description: 'gold-threaded ceremonial robes' },
  { name: 'Black velvet mask', baseValue: 35, description: 'embroidered with silver thread' },
  { name: 'Copper chalice', baseValue: 40, description: 'silver-plated with gemstones' },
  { name: 'Portrait miniature', baseValue: 45, description: 'painted on ivory' },
  { name: 'Silver comb', baseValue: 50, description: 'jeweled with garnets' },
  { name: 'Medium-sized silver chalice', baseValue: 75, description: 'gold-plated' },
  { name: 'Large gold bracelet', baseValue: 100, description: 'set with gems' },
  { name: 'Silver necklace', baseValue: 150, description: 'set with a sapphire' },
  { name: 'Gold circlet', baseValue: 200, description: 'set with four aquamarines' },
  { name: 'Handwoven tapestry', baseValue: 300, description: ' depicting noble hunt' },
  { name: 'Jeweled brooch', baseValue: 400, description: 'gold and platinum with rubies' },
  { name: 'Painted warhorse barding', baseValue: 500, description: 'ceremonial armor' },
  { name: 'Brass mug', baseValue: 10, description: 'engraved with family crest' },
  { name: 'Box of rare incense', baseValue: 25, description: 'exotic fragrances' },
  { name: 'Perfume vial', baseValue: 40, description: 'gold and crystal container' },
  { name: 'Sandals', baseValue: 50, description: 'silver with carved leaves' },
  { name: 'Gold pendant', baseValue: 75, description: 'set with jade' },
  { name: 'Embroidered silk sash', baseValue: 100, description: 'matching slippers' },
  { name: 'Set of carved bone dice', baseValue: 100, description: 'antique gaming pieces' },
  { name: 'Small wooden box', baseValue: 150, description: 'iron hinges and lock' },
  { name: 'Obsidian statuette', baseValue: 200, description: 'gold-inlaid' },
  { name: 'Painted wooden chest', baseValue: 250, description: 'iron fittings' },
  { name: 'Carved harp', baseValue: 300, description: 'exotic wood with zither' },
  { name: 'Solid gold idol', baseValue: 400, description: 'small deity figure' },
  { name: 'Dragon chess set', baseValue: 500, description: 'silver and jade pieces' },
  { name: 'Gold comb', baseValue: 750, description: 'ruby-inlaid' },
  { name: 'Bejeweled drinking horn', baseValue: 1000, description: 'gold with gems' },
  { name: 'Ceremonial electrum dagger', baseValue: 1500, description: 'jeweled hilt' },
  { name: 'Silver chalice', baseValue: 2000, description: 'gold-plated with jewels' },
];

const ART_CREATORS = [
  'created by the master artisans of {CITY}',
  'commissioned by {NOBLE} of {KINGDOM}',
  'a relic of the {EMPIRE} era',
  'crafted by dwarven smiths of {CLAN}',
  'enchanted by the archmage {NAME}',
  'a gift from the {RACE} ambassador',
  'stolen from the temple of {DEITY}',
  'found in the ruins of {PLACE}',
  'made by the famous artisan {NAME}',
  'dating back to the {ERA} period',
];

/**
 * Generate an art object
 */
export function generateArtObject(minValue: number = 10, maxValue: number = 5000): ArtObject {
  const validArt = ART_OBJECT_TYPES.filter(
    a => a.baseValue >= minValue && a.baseValue <= maxValue
  );

  if (validArt.length === 0) {
    const fallback = ART_OBJECT_TYPES[Math.floor(Math.random() * ART_OBJECT_TYPES.length)];
    return {
      name: fallback.name,
      type: 'art',
      value: fallback.baseValue,
      description: fallback.description,
    };
  }

  const artType = validArt[Math.floor(Math.random() * validArt.length)];
  const variation = 0.8 + Math.random() * 0.4;
  const value = Math.round(artType.baseValue * variation);

  // Generate creator lore
  const creator = ART_CREATORS[Math.floor(Math.random() * ART_CREATORS.length)]
    .replace('{CITY}', randomElement(['Waterdeep', 'Baldur\'s Gate', 'Silverymoon', 'Neverwinter']))
    .replace('{NOBLE}', randomElement(['Duke', 'Duchess', 'Baron', 'Count', 'Marquess']))
    .replace('{KINGDOM}', randomElement(['Faerun', 'Cormyr', 'Sembia', 'Amn']))
    .replace('{EMPIRE}', randomElement(['Netheril', 'Imaskar', 'Jhaamdath', 'Shoon']))
    .replace('{CLAN}', randomElement(['Durak', 'Ironforge', 'Stonehammer', 'Battleborn']))
    .replace('{NAME}', randomElement(['Elminster', 'Khelben', 'Volo', 'Mirt', 'Sylune']))
    .replace('{RACE}', randomElement(['Elven', 'Dwarven', 'Halfling', 'Gnomish']))
    .replace('{DEITY}', randomElement(['Lathander', 'Selune', 'Mystra', 'Oghma']))
    .replace('{PLACE}', randomElement(['Myth Drannor', 'Illusk', 'Phlan', 'Hlondeth']))
    .replace('{ERA}', randomElement(['Ancient', 'Classical', 'Imperial', 'Modern']));

  return {
    name: artType.name,
    type: 'art',
    value,
    description: artType.description,
    creator: Math.random() > 0.5 ? creator : undefined,
    age: Math.random() > 0.7 ? randomElement(['ancient', 'centuries old', 'recent', 'timeless']) : undefined,
  };
}

/**
 * Generate multiple art objects
 */
export function generateArtObjects(
  count: number | string,
  valueRange: [number, number]
): ArtObject[] {
  const artCount = typeof count === 'string' ? rollDice(count) : count;
  const objects: ArtObject[] = [];

  for (let i = 0; i < artCount; i++) {
    objects.push(generateArtObject(valueRange[0], valueRange[1]));
  }

  return objects;
}

// ============================================================================
// MAGIC ITEM GENERATION
// ============================================================================

const MAGIC_ITEM_TEMPLATES: Record<ItemRarity, Array<{
  type: ItemType;
  nameTemplate: string;
  properties: string[];
  requiresAttunement?: boolean;
}>> = {
  common: [
    {
      type: 'potion',
      nameTemplate: 'Potion of {EFFECT}',
      properties: ['Drink to gain {EFFECT} for 1 hour'],
    },
    {
      type: 'weapon',
      nameTemplate: '{MATERIAL} {WEAPON}',
      properties: ['+1 to attack and damage rolls'],
      requiresAttunement: false,
    },
    {
      type: 'wondrous-item',
      nameTemplate: 'Cloak of {PROTECTION}',
      properties: ['Resistance to {ELEMENT} damage'],
    },
  ],
  uncommon: [
    {
      type: 'ring',
      nameTemplate: 'Ring of {PROTECTION}',
      properties: ['+1 to AC', 'Resistance to {ELEMENT} damage'],
      requiresAttunement: true,
    },
    {
      type: 'weapon',
      nameTemplate: '{WEAPON} of {ASPECT}',
      properties: ['+1 to attack and damage', 'On hit: target must make DC 13 save or {EFFECT}'],
      requiresAttunement: false,
    },
    {
      type: 'wondrous-item',
      nameTemplate: 'Boots of {ABILITY}',
      properties: ['+1 to {ABILITY} checks', 'Advantage on {ABILITY} saves'],
      requiresAttunement: true,
    },
  ],
  rare: [
    {
      type: 'armor',
      nameTemplate: '{MATERIAL} Armor of {PROTECTION}',
      properties: ['+1 to AC', 'Advantage on saves against spells', 'Resistance to {ELEMENT} damage'],
      requiresAttunement: true,
    },
    {
      type: 'weapon',
      nameTemplate: '{WEAPON} of {POWER}',
      properties: ['+2 to attack and damage', 'On hit: extra {DAMAGE} damage'],
      requiresAttunement: false,
    },
    {
      type: 'wondrous-item',
      nameTemplate: 'Amulet of {PROTECTION}',
      properties: ['+2 to saving throws', 'Immunity to {CONDITION}'],
      requiresAttunement: true,
    },
  ],
  'very-rare': [
    {
      type: 'weapon',
      nameTemplate: '{WEAPON} of {MAJOR_POWER}',
      properties: ['+3 to attack and damage', 'On hit: {MAJOR_EFFECT}', 'Once per day: {DAILY_POWER}'],
      requiresAttunement: true,
    },
    {
      type: 'staff',
      nameTemplate: 'Staff of {SCHOOL}',
      properties: ['+2 to spell attack rolls', '{SCHOOL} spells cost 1 less spell slot', 'Charges: 3/day of {EFFECT}'],
      requiresAttunement: true,
    },
    {
      type: 'wondrous-item',
      nameTemplate: 'Helm of {POWER}',
      properties: ['Magic resistance', 'True sight out to 30 feet', '{SPECIAL_POWER}'],
      requiresAttunement: true,
    },
  ],
  legendary: [
    {
      type: 'weapon',
      nameTemplate: 'Named {WEAPON} of {LEGENDARY_POWER}',
      properties: ['+3 to attack and damage', 'On hit: {MAJOR_EFFECT}', 'Once per day: {LEGENDARY_EFFECT}', 'Sentient with {PERSONALITY} personality'],
      requiresAttunement: true,
    },
    {
      type: 'armor',
      nameTemplate: '{LEGENDARY_ARMOR} of {LEGENDARY_ASPECT}',
      properties: ['+3 to AC', 'Immunity to {ELEMENT} damage', 'Resistance to non-magical damage', 'Regeneration 1/hour while in combat'],
      requiresAttunement: true,
    },
    {
      type: 'wondrous-item',
      nameTemplate: 'Orb of {GREAT_POWER}',
      properties: ['+3 to spell attack DC', '1/day: cast {SPELL}', 'Immunity to {CONDITION}', 'Can see {VISION}'],
      requiresAttunement: true,
    },
  ],
  artifact: [
    {
      type: 'wondrous-item',
      nameTemplate: '{ARTIFACT_NAME}',
      properties: ['Unique powers beyond mortal magic', 'Draws attention from cosmic forces', 'Cannot be destroyed by normal means'],
      requiresAttunement: true,
    },
  ],
  varies: [],
};

const MAGIC_PLACEHOLDERS = {
  EFFECT: ['Healing', 'Invisibility', 'Giant Strength', 'Speed', 'Flying', 'Water Breathing', 'Fire Resistance', 'Darkvision'],
  PROTECTION: ['Protection', 'Warmth', 'Writhing', 'Billowing', 'Elvenkind', 'Displacement'],
  MATERIAL: ['Silver', 'Cold Iron', 'Mithral', 'Adamantine', 'Dragonbone', 'Cold-forged'],
  WEAPON: ['Sword', 'Axe', 'Mace', 'Dagger', 'Spear', 'Halberd', 'Bow', 'Crossbow', 'Hammer'],
  ASPECT: ['Warning', 'Slaying', 'Life Stealing', 'Thunder', 'Flaming', 'Frost'],
  ABILITY: ['Striding', 'Levitation', 'Flying', 'Speed', 'Winter', 'Elvenkind'],
  ELEMENT: ['Fire', 'Cold', 'Lightning', 'Acid', 'Poison', 'Necrotic', 'Radiant', 'Force'],
  CONDITION: ['Charmed', 'Frightened', 'Poisoned', 'Stunned', 'Paralyzed', 'Petrified'],
  DAMAGE: ['1d6 fire', '1d6 cold', '1d6 lightning', '1d6 necrotic', '1d8 radiant'],
  POWER: ['Flames', 'Frost', 'Shock', 'Life Stealing', 'Smiting', 'Sharpness'],
  MAJOR_POWER: ['Flame', 'Frost', 'Life Stealing', 'Vorpal', 'Thunder', 'Speed'],
  MAJOR_EFFECT: ['2d6 extra damage', 'knock prone', 'banish to another plane', 'paralyze for 1 minute', 'drain life'],
  DAILY_POWER: ['fireball', 'hold person', 'dimension door', 'dispel magic', 'heal'],
  SPECIAL_POWER: ['telepathy out to 120 feet', 'can understand all languages', 'can see invisible creatures', 'immune to being surprised'],
  SCHOOL: ['Fire', 'Ice', 'Evocation', 'Conjuration', 'Necromancy', 'Divination'],
  LEGENDARY_POWER: ['Life Stealing', 'Vorpal Strikes', 'Sunlight', 'Moonlight', 'The Cosmos', 'Eternal Night'],
  LEGENDARY_ASPECT: ['Invulnerability', 'The Phoenix', 'The Dragon', 'The Elements', 'Eternal Grace'],
  LEGENDARY_EFFECT: ['deals 4d6 extra damage', 'banishes the target', 'heals the wielder for 3d6', 'summons a celestial servant'],
  LEGENDARY_ARMOR: ['Plate', 'Scale', 'Chain Shirt', 'Robe', 'Vestments'],
  GREAT_POWER: ['Dragon Control', 'Planar Travel', 'Time Manipulation', 'Soul Binding', 'Reality Warping'],
  ARTIFACT_NAME: ['The Eye of Vecna', 'The Hand of Vecna', 'The Wand of Orcus', 'The Sphere of Annihilation', 'The Deck of Many Things'],
  SPELL: ['fireball', 'disintegrate', 'power word stun', 'power word kill', 'wish', 'meteor swarm'],
  VISION: ['into the Ethereal Plane', 'in magical darkness', 'true forms of shapeshifters', 'through illusions'],
  PERSONALITY: ['arrogant', 'helpful', 'cunning', 'bloodthirsty', 'scholarly', 'whimsical'],
};

function fillTemplate(template: string): string {
  let result = template;
  for (const [key, values] of Object.entries(MAGIC_PLACEHOLDERS)) {
    const placeholder = `{${key}}`;
    if (result.includes(placeholder)) {
      result = result.replace(new RegExp(placeholder, 'g'), () =>
        randomElement(values)
      );
    }
  }
  return result;
}

/**
 * Generate a magic item
 */
export function generateMagicItem(options?: {
  rarity?: ItemRarity;
  type?: ItemType;
  requiresAttunement?: boolean;
}): MagicItem {
  const rarity = options?.rarity || randomRarity();
  const type = options?.type;

  const templates = MAGIC_ITEM_TEMPLATES[rarity] || MAGIC_ITEM_TEMPLATES.rare;
  const matchingTemplates = type
    ? templates.filter(t => t.type === type)
    : templates;

  const template = matchingTemplates.length > 0
    ? randomElement(matchingTemplates)
    : randomElement(templates);

  const name = fillTemplate(template.nameTemplate);
  const properties = template.properties.map(p => fillTemplate(p));

  return {
    name,
    type: template.type,
    rarity,
    requiresAttunement: options?.requiresAttunement ?? template.requiresAttunement ?? false,
    description: `A ${rarity} ${template.type} of ${type === 'potion' ? 'consumable' : 'enduring'} power.`,
    properties,
    lore: generateItemLore(name, rarity),
  };
}

/**
 * Generate item lore
 */
function generateItemLore(itemName: string, rarity: ItemRarity): string | undefined {
  if (rarity === 'common') return undefined;

  const loreTemplates = [
    `This item was once wielded by ${randomElement(['a legendary hero', 'a notorious villain', 'a forgotten sage', 'a tragic figure'])}.`,
    `Legends say this item was forged ${randomElement(['in dragon fire', 'by the first dwarves', 'during the Age of Mystery', 'from a fallen star'])}.`,
    `The item bears an inscription: "${randomElement(['In darkness, light', 'Blood calls to blood', 'Time yields all', 'Power demands sacrifice'])}".`,
    `${randomElement(['Clerics', 'Scholars', 'Bards', 'Sages'])} believe this item is connected to ${randomElement(['an ancient prophecy', 'a lost kingdom', 'a forgotten god', 'a planar convergence'])}.`,
    `This item has been passed down through generations of ${randomElement(['warriors', 'wizards', 'nobles', 'thieves'])}.`,
  ];

  const loreCount = rarity === 'artifact' ? 3 : rarity === 'legendary' ? 2 : 1;
  const selectedLore = shuffleArray([...loreTemplates]).slice(0, loreCount);

  return selectedLore.join(' ');
}

/**
 * Generate weighted random rarity
 */
function randomRarity(): ItemRarity {
  const roll = Math.random();
  if (roll < 0.4) return 'common';
  if (roll < 0.7) return 'uncommon';
  if (roll < 0.9) return 'rare';
  if (roll < 0.97) return 'very-rare';
  if (roll < 0.995) return 'legendary';
  return 'artifact';
}

/**
 * Generate multiple magic items
 */
export function generateMagicItems(options?: {
  count?: number | string;
  rarities?: ItemRarity[];
  minRarity?: ItemRarity;
}): MagicItem[] {
  const rarityOrder: ItemRarity[] = ['common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact'];

  const minRarity = options?.minRarity || 'common';
  const minIndex = rarityOrder.indexOf(minRarity);
  const allowedRarities = options?.rarities || rarityOrder.slice(minIndex);

  const count = typeof options?.count === 'string'
    ? rollDice(options.count)
    : options?.count || 1;

  const items: MagicItem[] = [];

  for (let i = 0; i < count; i++) {
    const rarity = randomElement(allowedRarities);
    items.push(generateMagicItem({ rarity }));
  }

  return items;
}

// ============================================================================
// POTION GENERATION
// ============================================================================

const POTION_EFFECTS = [
  { name: 'Healing', value: 50, description: 'Restore 2d4+2 hit points' },
  { name: 'Greater Healing', value: 150, description: 'Restore 4d4+4 hit points' },
  { name: 'Superior Healing', value: 500, description: 'Restore 8d4+8 hit points' },
  { name: 'Supreme Healing', value: 2000, description: 'Restore 10d4+20 hit points' },
  { name: 'Invisibility', value: 200, description: 'Invisible for 1 hour' },
  { name: 'Giant Strength', value: 500, description: 'Strength becomes 21 for 1 hour' },
  { name: 'Flying', value: 500, description: 'Fly speed 60 ft for 1 hour' },
  { name: 'Speed', value: 300, description: 'Doubled speed for 1 hour' },
  { name: 'Resistance', value: 150, description: 'Resistance to acid, cold, fire, lightning, poison for 1 hour' },
  { name: 'Growth', value: 400, description: 'Size doubles for 1 hour' },
  { name: 'Shrinking', value: 400, description: 'Size halves for 1 hour' },
  { name: 'Water Breathing', value: 150, description: 'Breathe underwater for 1 hour' },
  { name: 'Poison', value: 200, description: 'Make 3 saves vs 12d6 poison damage' },
  { name: 'Heroism', value: 400, description: '10 temporary HP each turn for 1 hour' },
  { name: 'Clairvoyance', value: 500, description: 'See through an invisible sensor for 10 minutes' },
  { name: 'Mind Control', value: 500, description: 'Charm person for 1 hour' },
];

/**
 * Generate a potion
 */
export function generatePotion(): MagicItem {
  const effect = randomElement(POTION_EFFECTS);

  return {
    name: `Potion of ${effect.name}`,
    type: 'potion',
    rarity: effect.value < 100 ? 'common' : effect.value < 500 ? 'uncommon' : 'rare',
    requiresAttunement: false,
    description: effect.description,
    properties: [`Drink this potion to ${effect.description.toLowerCase()}`],
  };
}

// ============================================================================
// TREASURE HOARD GENERATION
// ============================================================================

export interface GenerateHoardOptions {
  cr: number;
  source?: 'individual' | 'hoard' | 'dragon-hoard';
  multiplier?: number;
  includeCurrency?: boolean;
  includeGems?: boolean;
  includeArt?: boolean;
  includeMagic?: boolean;
}

/**
 * Generate a complete treasure hoard
 */
export function generateTreasureHoard(options: GenerateHoardOptions): TreasureHoard {
  const {
    cr,
    source = 'hoard',
    multiplier = 1,
    includeCurrency = true,
    includeGems = true,
    includeArt = true,
    includeMagic = true,
  } = options;

  const entry = getTreasureEntry(cr);

  // Dragon hoards are much larger
  const dragonMultiplier = source === 'dragon-hoard' ? 3 : 1;

  // Currency
  const currency = includeCurrency
    ? generateCurrency(cr, multiplier * dragonMultiplier)
    : { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

  // Gems
  const gems = includeGems && entry.gems
    ? generateGems(entry.gems.count, entry.gems.valueRange)
    : [];

  // Art objects
  const artObjects = includeArt && entry.art
    ? generateArtObjects(entry.art.count, entry.art.valueRange)
    : [];

  // Magic items
  const magicItems = includeMagic && entry.magicItems
    ? generateMagicItems({
        count: entry.magicItems.count,
        rarities: entry.magicItems.rarities,
      })
    : [];

  // Calculate total value
  const totalValue =
    toGoldPieces(currency) +
    gems.reduce((sum, g) => sum + g.value, 0) +
    artObjects.reduce((sum, a) => sum + a.value, 0) +
    magicItems.reduce((sum, m) => sum + (m.valueOverride || estimateMagicItemValue(m)), 0);

  return {
    currency,
    gems,
    artObjects,
    magicItems,
    totalValue,
    cr,
    source,
  };
}

/**
 * Estimate magic item value based on rarity
 */
function estimateMagicItemValue(item: MagicItem): number {
  const values: Record<ItemRarity, number> = {
    common: 50,
    uncommon: 400,
    rare: 4000,
    'very-rare': 40000,
    legendary: 200000,
    artifact: 1000000,
    varies: 1000,
  };
  return values[item.rarity] || 1000;
}

// ============================================================================
// INDIVIDUAL LOOT GENERATION
// ============================================================================

export interface GenerateIndividualLootOptions {
  cr: number;
  count?: number;
}

/**
 * Generate loot for individual creatures (carried)
 */
export function generateIndividualLoot(options: GenerateIndividualLootOptions): LootEntry[] {
  const { cr, count = 1 } = options;

  const loot: LootEntry[] = [];
  const treasure = generateTreasureHoard({
    cr,
    source: 'individual',
    multiplier: 0.1, // Individual creatures carry 10% of hoard value
  });

  // Add currency
  if (toGoldPieces(treasure.currency) > 0) {
    loot.push({
      item: treasure.currency,
      quantity: 1,
      identified: true,
    });
  }

  // Small chance for gems
  if (treasure.gems.length > 0 && Math.random() > 0.7) {
    loot.push({
      item: treasure.gems[0],
      quantity: 1,
      identified: true,
    });
  }

  // Very small chance for magic items
  if (treasure.magicItems.length > 0 && Math.random() > 0.9) {
    loot.push({
      item: treasure.magicItems[0],
      quantity: 1,
      identified: false, // Usually unidentified when found
    });
  }

  return loot;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Format currency as a readable string
 */
export function formatCurrency(currency: Currency): string {
  const parts: string[] = [];
  if (currency.pp > 0) parts.push(`${currency.pp} pp`);
  if (currency.gp > 0) parts.push(`${currency.gp} gp`);
  if (currency.ep > 0) parts.push(`${currency.ep} ep`);
  if (currency.sp > 0) parts.push(`${currency.sp} sp`);
  if (currency.cp > 0) parts.push(`${currency.cp} cp`);

  return parts.length > 0 ? parts.join(', ') : 'No currency';
}

/**
 * Generate loot for a specific encounter
 */
export function generateEncounterLoot(
  partyLevel: number,
  partySize: number,
  creatureCount: number
): {
  lootPerCreature: LootEntry[][];
  totalValue: number;
} {
  const lootPerCreature: LootEntry[][] = [];
  let totalValue = 0;

  for (let i = 0; i < creatureCount; i++) {
    const loot = generateIndividualLoot({ cr: partyLevel, count: 1 });

    for (const entry of loot) {
      if ('rarity' in entry.item) {
        totalValue += estimateMagicItemValue(entry.item);
      } else if ('value' in entry.item) {
        totalValue += entry.item.value;
      } else {
        totalValue += toGoldPieces(entry.item);
      }
    }

    lootPerCreature.push(loot);
  }

  return { lootPerCreature, totalValue };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const LootGen = {
  generateTreasureHoard,
  generateIndividualLoot,
  generateCurrency,
  generateGem,
  generateGems,
  generateArtObject,
  generateArtObjects,
  generateMagicItem,
  generateMagicItems,
  generatePotion,
  generateEncounterLoot,
  toGoldPieces,
  fromGoldPieces,
  formatCurrency,
  rollDice,
  EXCHANGE_RATES,
};

export default LootGen;
