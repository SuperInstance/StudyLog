/**
 * Fish Registry - Species Definitions
 *
 * Complete catalog of fish species with behavioral properties,
 * habitat preferences, and educational content for StudyLoG.AI.
 */

import {
  FishSpecies,
  FishCategory,
  FishRarity,
  ActivityPattern,
  DepthZone,
  Season,
  LureCategory
} from './types';

// ============================================================================
// FRESHWATER SPECIES
// ============================================================================

/**
 * Black Crappie - Popular panfish
 */
export const BLACK_CRAPPIE: FishSpecies = {
  id: 'black_crappie',
  name: 'Black Crappie',
  scientificName: 'Pomoxis nigromaculatus',
  category: FishCategory.PANFISH,
  rarity: FishRarity.COMMON,

  minLength: 5,
  maxLength: 19,
  minWeight: 0.1,
  maxWeight: 5,
  maxAge: 10,

  activityPattern: ActivityPattern.DAWN,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 68, max: 72 },
  schoolSize: { min: 5, max: 50 },
  baseFightStrength: 0.2,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 3,
  baseBiteChance: 0.15,
  preferredLures: ['jig', 'minnow', 'spinner'],

  description: 'Black crappie are deep-bodied panfish with a silvery-green coloration featuring irregular black blotches. They are highly sought after for their excellent taste and sporting qualities.',
  habitat: 'Prefer clear, vegetated lakes and slow-moving rivers. Often found around submerged structure, fallen trees, and weed beds.',
  diet: 'Plankton, minnows, and aquatic insect larvae. They feed primarily at dawn and dusk.',
  conservation: 'Generally stable populations. Practice selective harvesting to maintain quality fishing.',
  funFact: 'Crappie are called "slab" or "papermouth" by anglers due to their thin, easily torn lips.',

  colors: {
    primary: '#4A6741',
    secondary: '#2C3E50',
    accent: '#ECF0F1'
  },
  spriteRef: 'fish/crappie_black'
};

/**
 * Bluegill - Classic panfish
 */
export const BLUEGILL: FishSpecies = {
  id: 'bluegill',
  name: 'Bluegill',
  scientificName: 'Lepomis macrochirus',
  category: FishCategory.PANFISH,
  rarity: FishRarity.COMMON,

  minLength: 3,
  maxLength: 16,
  minWeight: 0.05,
  maxWeight: 4,
  maxAge: 12,

  activityPattern: ActivityPattern.ALL_DAY,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 65, max: 80 },
  schoolSize: { min: 10, max: 100 },
  baseFightStrength: 0.25,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 5,
  baseBiteChance: 0.25,
  preferredLures: ['worm', 'cricket', 'small_jig', 'fly'],

  description: 'The most widely distributed panfish in North America. Deep, compressed body with olive-green sides and a bright orange/red belly.',
  habitat: 'Ponds, lakes, and slow streams with vegetation. Build nests in shallow water during spawn.',
  diet: 'Insects, zooplankton, small fish. Opportunistic feeders that bite aggressively.',
  conservation: 'Very abundant, important for introducing youth to fishing.',
  funFact: 'A female bluegill can lay up to 38,000 eggs in a single spawn!',

  colors: {
    primary: '#27AE60',
    secondary: '#2ECC71',
    accent: '#E74C3C'
  },
  spriteRef: 'fish/bluegill'
};

/**
 * Largemouth Bass - Most popular game fish
 */
export const LARGEMOUTH_BASS: FishSpecies = {
  id: 'largemouth_bass',
  name: 'Largemouth Bass',
  scientificName: 'Micropterus salmoides',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.UNCOMMON,

  minLength: 10,
  maxLength: 29,
  minWeight: 0.5,
  maxWeight: 22,
  maxAge: 16,

  activityPattern: ActivityPattern.DUSK,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 65, max: 85 },
  schoolSize: { min: 1, max: 5 },
  baseFightStrength: 0.6,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL, Season.WINTER],
  spawnSeason: Season.SPRING,

  biteWindow: 2,
  baseBiteChance: 0.08,
  preferredLures: ['plastic_worm', 'jig', 'crankbait', 'topwater', 'spinnerbait'],

  description: 'America\'s most popular freshwater game fish. Olive-green with a dark lateral line and distinctive large mouth extending past the eye.',
  habitat: 'Warm, vegetated lakes, ponds, and rivers. Ambush predators that hide in cover.',
  diet: 'Fish, crayfish, frogs, insects. Aggressive predators that will eat almost anything.',
  conservation: 'Catch-and-release encouraged to maintain trophy fisheries.',
  funFact: 'Largemouth bass can see in color and have excellent night vision due to a tapetum lucidum.',

  colors: {
    primary: '#2C3E50',
    secondary: '#27AE60',
    accent: '#95A5A6'
  },
  spriteRef: 'fish/bass_largemouth'
};

/**
 * Smallmouth Bass - Fighting bronzebacks
 */
export const SMALLMOUTH_BASS: FishSpecies = {
  id: 'smallmouth_bass',
  name: 'Smallmouth Bass',
  scientificName: 'Micropterus dolomieu',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.UNCOMMON,

  minLength: 8,
  maxLength: 27,
  minWeight: 0.25,
  maxWeight: 12,
  maxAge: 15,

  activityPattern: ActivityPattern.TWILIGHT,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 60, max: 75 },
  schoolSize: { min: 1, max: 3 },
  baseFightStrength: 0.75,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 2.5,
  baseBiteChance: 0.07,
  preferredLures: ['tube', 'drop_shot', 'crankbait', 'jig', 'topwater'],

  description: 'Brownish-green with vertical barring and red eyes. Known for incredible fighting ability and acrobatic jumps.',
  habitat: 'Clear, cool lakes and rivers with rocky bottoms. Prefer moving water.',
  diet: 'Crayfish are primary food, also minnows and insects. More selective than largemouth.',
  conservation: 'Sensitive to pollution, indicator species for water quality.',
  funFact: 'Smallmouth can jump up to 5 times their body length when hooked!',

  colors: {
    primary: '#8B7355',
    secondary: '#5D4E37',
    accent: '#C0392B'
  },
  spriteRef: 'fish/bass_smallmouth'
};

/**
 * Northern Pike - Water wolf
 */
export const NORTHERN_PIKE: FishSpecies = {
  id: 'northern_pike',
  name: 'Northern Pike',
  scientificName: 'Esox lucius',
  category: FishCategory.PREDATORY,
  rarity: FishRarity.RARE,

  minLength: 15,
  maxLength: 45,
  minWeight: 2,
  maxWeight: 40,
  maxAge: 25,

  activityPattern: ActivityPattern.ALL_DAY,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 60, max: 70 },
  schoolSize: { min: 1, max: 1 },
  baseFightStrength: 0.8,

  activeSeasons: [Season.SPRING, Season.FALL, Season.WINTER],
  spawnSeason: Season.SPRING,

  biteWindow: 1,
  baseBiteChance: 0.05,
  preferredLures: ['spoon', 'spinner', 'swimbait', 'large_crankbait'],

  description: 'Long, slender predator with duck-bill snout filled with sharp teeth. Olive-green with light spots.',
  habitat: 'Weedy bays, marshes, and slow-moving streams. Ambush predators.',
  diet: 'Anything that fits in their mouth - fish, frogs, ducklings, even muskrats!',
  conservation: 'Important apex predator. Handle with care due to fragile slime coat.',
  funFact: 'Pike can consume prey up to 25% of their own body weight!',

  colors: {
    primary: '#27AE60',
    secondary: '#F4D03F',
    accent: '#ECF0F1'
  },
  spriteRef: 'fish/pike_northern'
};

/**
 * Muskie - The fish of 10,000 casts
 */
export const MUSKIE: FishSpecies = {
  id: 'muskie',
  name: 'Muskellunge (Muskie)',
  scientificName: 'Esox masquinongy',
  category: FishCategory.PREDATORY,
  rarity: FishRarity.EPIC,

  minLength: 20,
  maxLength: 60,
  minWeight: 5,
  maxWeight: 70,
  maxAge: 30,

  activityPattern: ActivityPattern.DAY,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 63, max: 72 },
  schoolSize: { min: 1, max: 1 },
  baseFightStrength: 0.95,

  activeSeasons: [Season.FALL, Season.SUMMER],
  spawnSeason: Season.SPRING,

  biteWindow: 0.8,
  baseBiteChance: 0.01,
  preferredLures: ['large_swimbait', 'bucktail', 'jerkbait', 'topwater'],

  description: 'The largest freshwater predator in many regions. Light background with dark markings and pointed tail fins.',
  habitat: 'Large, clear lakes and rivers with diverse structure. Require large territories.',
  diet: 'Primarily fish but also ducks, muskrats, and other small mammals.',
  conservation: 'Catch-and-release strongly encouraged. Low populations, slow-growing.',
  funFact: 'Muskies follow a "lunge and gulp" feeding style, often missing prey on first strike.',

  colors: {
    primary: '#BDC3C7',
    secondary: '#2C3E50',
    accent: '#E74C3C'
  },
  spriteRef: 'fish/muskie'
};

/**
 * Walleye - Popular food and sport fish
 */
export const WALLEYE: FishSpecies = {
  id: 'walleye',
  name: 'Walleye',
  scientificName: 'Sander vitreus',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.UNCOMMON,

  minLength: 10,
  maxLength: 31,
  minWeight: 0.5,
  maxWeight: 20,
  maxAge: 20,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 55, max: 68 },
  schoolSize: { min: 3, max: 20 },
  baseFightStrength: 0.45,

  activeSeasons: [Season.SPRING, Season.FALL, Season.WINTER],
  spawnSeason: Season.SPRING,

  biteWindow: 4,
  baseBiteChance: 0.12,
  preferredLures: ['jig', 'crankbait', 'spinner', 'live_bait'],

  description: 'Olive-gold color with large, pearlescent eyes. Excellent tasting white meat.',
  habitat: 'Clear, deep lakes and large rivers. Sensitive to light, feed in low light.',
  diet: 'Minnows, perch, and insects. Most active at night and during low-light periods.',
  conservation: 'Popular table fare, check local regulations for size limits.',
  funFact: 'The walleye\'s distinctive eyes are designed for seeing in dark, murky water.',

  colors: {
    primary: '#9B8B6E',
    secondary: '#D4C5A0',
    accent: '#F39C12'
  },
  spriteRef: 'fish/walleye'
};

/**
 * Rainbow Trout - Beautiful and popular
 */
export const RAINBOW_TROUT: FishSpecies = {
  id: 'rainbow_trout',
  name: 'Rainbow Trout',
  scientificName: 'Oncorhynchus mykiss',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.COMMON,

  minLength: 8,
  maxLength: 30,
  minWeight: 0.25,
  maxWeight: 20,
  maxAge: 11,

  activityPattern: ActivityPattern.ALL_DAY,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 55, max: 60 },
  schoolSize: { min: 5, max: 30 },
  baseFightStrength: 0.5,

  activeSeasons: [Season.SPRING, Season.FALL, Season.WINTER],
  spawnSeason: Season.SPRING,

  biteWindow: 3,
  baseBiteChance: 0.15,
  preferredLures: ['spinner', 'spoon', 'fly', 'powerbait'],

  description: 'Named for the iridescent pink stripe along their sides. Green back, silver sides, black spots.',
  habitat: 'Cold, clear streams and lakes. Require well-oxygenated water.',
  diet: 'Insects, minnows, and crustaceans. Feed actively near surface.',
  conservation: 'Widely stocked. Native populations in western North America.',
  funFact: 'Rainbow trout can jump up to 3 meters (10 feet) in the air!',

  colors: {
    primary: '#16A085',
    secondary: '#E74C3C',
    accent: '#F39C12'
  },
  spriteRef: 'fish/trout_rainbow'
};

/**
 * Brown Trout - Wary and challenging
 */
export const BROWN_TROUT: FishSpecies = {
  id: 'brown_trout',
  name: 'Brown Trout',
  scientificName: 'Salmo trutta',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.RARE,

  minLength: 8,
  maxLength: 38,
  minWeight: 0.25,
  maxWeight: 40,
  maxAge: 20,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 54, max: 65 },
  schoolSize: { min: 1, max: 5 },
  baseFightStrength: 0.55,

  activeSeasons: [Season.SPRING, Season.FALL, Season.WINTER],
  spawnSeason: Season.FALL,

  biteWindow: 2,
  baseBiteChance: 0.06,
  preferredLures: ['streamer', 'spinner', 'crankbait', 'live_bait'],

  description: 'Golden-brown with black and red spots surrounded by pale halos. Most wary of the trout.',
  habitat: 'Cold streams and lakes, especially with cover and undercut banks.',
  diet: 'More predatory than other trout - fish, crayfish, and large insects.',
  conservation: 'Wild populations are sensitive. Stocked in many areas.',
  funFact: 'Large brown trout become primarily nocturnal and feed on small mammals!',

  colors: {
    primary: '#8B7355',
    secondary: '#A0522D',
    accent: '#C0392B'
  },
  spriteRef: 'fish/trout_brown'
};

/**
 * Brook Trout - Beautiful native char
 */
export const BROOK_TROUT: FishSpecies = {
  id: 'brook_trout',
  name: 'Brook Trout',
  scientificName: 'Salvelinus fontinalis',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.UNCOMMON,

  minLength: 6,
  maxLength: 25,
  minWeight: 0.1,
  maxWeight: 15,
  maxAge: 8,

  activityPattern: ActivityPattern.DAWN,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 50, max: 60 },
  schoolSize: { min: 2, max: 15 },
  baseFightStrength: 0.35,

  activeSeasons: [Season.SPRING, Season.FALL],
  spawnSeason: Season.FALL,

  biteWindow: 3,
  baseBiteChance: 0.1,
  preferredLures: ['spinner', 'fly', 'worm'],

  description: 'Actually a char, not a true trout. Stunning colors with blue halos on red spots and white fin edges.',
  habitat: 'Cold, clean streams, springs, and ponds. Indicator of pristine water quality.',
  diet: 'Insects, worms, and small minnows. Less selective than other trout.',
  conservation: 'Sensitive to habitat loss and warming waters. Native populations need protection.',
  funFact: 'Brook trout are the only trout native to many eastern North American streams.',

  colors: {
    primary: '#2E86C1',
    secondary: '#27AE60',
    accent: '#E74C3C'
  },
  spriteRef: 'fish/trout_brook'
};

/**
 * Channel Catfish - Popular sport and food fish
 */
export const CHANNEL_CATFISH: FishSpecies = {
  id: 'channel_catfish',
  name: 'Channel Catfish',
  scientificName: 'Ictalurus punctatus',
  category: FishCategory.CATFISH,
  rarity: FishRarity.COMMON,

  minLength: 10,
  maxLength: 40,
  minWeight: 1,
  maxWeight: 40,
  maxAge: 20,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.DEEP,
  preferredTemp: { min: 70, max: 85 },
  schoolSize: { min: 1, max: 10 },
  baseFightStrength: 0.5,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 5,
  baseBiteChance: 0.2,
  preferredLures: ['stinkbait', 'chicken_liver', 'cutbait', 'worm'],

  description: 'Smooth, scaleless skin with forked tail. Olive-blue to slate coloring.',
  habitat: 'Rivers, lakes, and ponds. Bottom feeders found in deeper water.',
  diet: 'Omnivorous scavengers - insects, fish, plant matter, almost anything.',
  conservation: 'Widely stocked and very abundant. Excellent food fish.',
  funFact: 'Channel catfish have taste buds all over their bodies - most concentrated on whiskers!',

  colors: {
    primary: '#4A6741',
    secondary: '#5D6D7E',
    accent: '#AAB7B8'
  },
  spriteRef: 'fish/catfish_channel'
};

/**
 * Flathead Catfish - Apex predator
 */
export const FLATHEAD_CATFISH: FishSpecies = {
  id: 'flathead_catfish',
  name: 'Flathead Catfish',
  scientificName: 'Pylodictis olivaris',
  category: FishCategory.CATFISH,
  rarity: FishRarity.EPIC,

  minLength: 15,
  maxLength: 50,
  minWeight: 3,
  maxWeight: 100,
  maxAge: 25,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.DEEP,
  preferredTemp: { min: 75, max: 85 },
  schoolSize: { min: 1, max: 1 },
  baseFightStrength: 0.85,

  activeSeasons: [Season.SUMMER],
  spawnSeason: Season.SPRING,

  biteWindow: 6,
  baseBiteChance: 0.04,
  preferredLures: ['live_bait', 'cutbait', 'sunfish'],

  description: 'Large, flat head with projecting lower jaw. Mottled brown and yellow coloring.',
  habitat: 'Large rivers and reservoirs. Prefer deep holes with cover.',
  diet: 'Exclusively predatory - live fish. They hunt rather than scavenge.',
  conservation: 'Apex predators, take only what you need. Large specimens are old.',
  funFact: 'Flatheads can live over 20 years and reach weights over 100 pounds!',

  colors: {
    primary: '#8B7355',
    secondary: '#D4C5A0',
    accent: '#5D4E37'
  },
  spriteRef: 'fish/catfish_flathead'
};

/**
 * Blue Catfish - River giants
 */
export const BLUE_CATFISH: FishSpecies = {
  id: 'blue_catfish',
  name: 'Blue Catfish',
  scientificName: 'Ictalurus furcatus',
  category: FishCategory.CATFISH,
  rarity: FishRarity.RARE,

  minLength: 20,
  maxLength: 60,
  minWeight: 5,
  maxWeight: 150,
  maxAge: 30,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.ABYSSAL,
  preferredTemp: { min: 70, max: 80 },
  schoolSize: { min: 1, max: 5 },
  baseFightStrength: 0.9,

  activeSeasons: [Season.WINTER, Season.SPRING, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 4,
  baseBiteChance: 0.03,
  preferredLures: ['cutbait', 'shad', 'skipjack'],

  description: 'Slate blue coloring, deeply forked tail. The largest catfish in North America.',
  habitat: 'Major river systems. Prefer deep, flowing water.',
  diet: 'Opportunistic predators - fish, mussels, crustaceans.',
  conservation: 'Invasive in some areas, native in others. Check local regulations.',
  funFact: 'Blue catfish can reach weights over 140 pounds - the largest purely freshwater fish in the US!',

  colors: {
    primary: '#2874A6',
    secondary: '#5499C7',
    accent: '#AED6F1'
  },
  spriteRef: 'fish/catfish_blue'
};

// ============================================================================
// SALMONID SPECIES
// ============================================================================

/**
 * Chinook Salmon - King of salmon
 */
export const CHINOOK_SALMON: FishSpecies = {
  id: 'chinook_salmon',
  name: 'Chinook Salmon (King)',
  scientificName: 'Oncorhynchus tshawytscha',
  category: FishCategory.SALMONID,
  rarity: FishRarity.RARE,

  minLength: 15,
  maxLength: 50,
  minWeight: 5,
  maxWeight: 100,
  maxAge: 7,

  activityPattern: ActivityPattern.DAWN,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 50, max: 55 },
  schoolSize: { min: 5, max: 30 },
  baseFightStrength: 0.85,

  activeSeasons: [Season.SPRING, Season.SUMMER, Season.FALL],
  spawnSeason: Season.FALL,

  biteWindow: 2,
  baseBiteChance: 0.04,
  preferredLures: ['spoon', 'plug', 'flasher', 'fly'],

  description: 'Largest Pacific salmon. Dark spots on back and tail. Gumline is black.',
  habitat: 'Cold ocean waters migrate to freshwater rivers to spawn.',
  diet: 'In ocean: fish and squid. In freshwater: stop feeding, strike out of aggression.',
  conservation: 'Carefully managed. Many runs are threatened by habitat loss.',
  funFact: 'Chinook can migrate over 2,000 miles inland to spawn!',

  colors: {
    primary: '#2C3E50',
    secondary: '#7F8C8D',
    accent: '#E74C3C'
  },
  spriteRef: 'fish/salmon_chinook'
};

/**
 * Coho Salmon - Acrobatic fighters
 */
export const COHO_SALMON: FishSpecies = {
  id: 'coho_salmon',
  name: 'Coho Salmon (Silver)',
  scientificName: 'Oncorhynchus kisutch',
  category: FishCategory.SALMONID,
  rarity: FishRarity.UNCOMMON,

  minLength: 12,
  maxLength: 35,
  minWeight: 3,
  maxWeight: 30,
  maxAge: 5,

  activityPattern: ActivityPattern.DUSK,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 52, max: 58 },
  schoolSize: { min: 10, max: 50 },
  baseFightStrength: 0.7,

  activeSeasons: [Season.FALL],
  spawnSeason: Season.FALL,

  biteWindow: 2.5,
  baseBiteChance: 0.08,
  preferredLures: ['spinner', 'spoon', 'fly', 'egg'],

  description: 'Silver sides, dark blue back. White gumline distinguishes from Chinook.',
  habitat: 'Coastal streams and estuaries. Prefer smaller tributaries than Chinook.',
  diet: 'Insects and small fish in freshwater. Aggressive biters.',
  conservation: 'Important sport fish. Hatchery supplementation common.',
  funFact: 'Coho are known for their acrobatic leaps when hooked!',

  colors: {
    primary: '#BDC3C7',
    secondary: '#7F8C8D',
    accent: '#2C3E50'
  },
  spriteRef: 'fish/salmon_coho'
};

/**
 * Steelhead - Sea-run rainbow trout
 */
export const STEELHEAD: FishSpecies = {
  id: 'steelhead',
  name: 'Steelhead',
  scientificName: 'Oncorhynchus mykiss irideus',
  category: FishCategory.SALMONID,
  rarity: FishRarity.RARE,

  minLength: 15,
  maxLength: 40,
  minWeight: 4,
  maxWeight: 30,
  maxAge: 8,

  activityPattern: ActivityPattern.TWILIGHT,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 48, max: 55 },
  schoolSize: { min: 3, max: 15 },
  baseFightStrength: 0.8,

  activeSeasons: [Season.WINTER, Season.SPRING],
  spawnSeason: Season.SPRING,

  biteWindow: 1.5,
  baseBiteChance: 0.05,
  preferredLures: ['spawn_sack', 'jig', 'spinner', 'plug'],

  description: 'Sea-run rainbow trout with silvery coloration and incredible fighting ability.',
  habitat: 'Cold, clear rivers and streams. Migrate from ocean to spawn.',
  diet: 'In freshwater: primarily eggs and insects. Strike aggressively when fresh.',
  conservation: 'Prized game fish. Many wild runs are endangered.',
  funFact: 'Steelhead can spawn multiple times (unlike Pacific salmon), though few survive.',

  colors: {
    primary: '#7F8C8D',
    secondary: '#E74C3C',
    accent: '#2C3E50'
  },
  spriteRef: 'fish/trout_steelhead'
};

// ============================================================================
// RARE / TROPHY SPECIES
// ============================================================================

/**
 * Lake Sturgeon - Prehistoric giants
 */
export const LAKE_STURGEON: FishSpecies = {
  id: 'lake_sturgeon',
  name: 'Lake Sturgeon',
  scientificName: 'Acipenser fulvescens',
  category: FishCategory.RARE,
  rarity: FishRarity.LEGENDARY,

  minLength: 30,
  maxLength: 80,
  minWeight: 10,
  maxWeight: 200,
  maxAge: 100,

  activityPattern: ActivityPattern.NIGHT,
  preferredDepth: DepthZone.ABYSSAL,
  preferredTemp: { min: 55, max: 65 },
  schoolSize: { min: 1, max: 3 },
  baseFightStrength: 0.6,

  activeSeasons: [Season.SUMMER, Season.FALL],
  spawnSeason: Season.SPRING,

  biteWindow: 10,
  baseBiteChance: 0.005,
  preferredLures: ['nightcrawler', 'minnow'],

  description: 'Living dinosaur - shark-like tail, bony plates instead of scales, whisker-like barbels.',
  habitat: 'Deep, clean lakes and large rivers. Bottom dwellers on sand/gravel.',
  diet: 'Insect larvae, small mollusks, fish eggs. Feed by suction.',
  conservation: 'Threatened or endangered across most range. Catch-and-release only.',
  funFact: 'Lake sturgeon can live over 100 years and were once abundant in the Great Lakes!',

  colors: {
    primary: '#7F8C8D',
    secondary: '#5D6D7E',
    accent: '#AAB7B8'
  },
  spriteRef: 'fish/sturgeon_lake'
};

/**
 * Tiger Muskie - Hybrid apex predator
 */
export const TIGER_MUSKIE: FishSpecies = {
  id: 'tiger_muskie',
  name: 'Tiger Muskie',
  scientificName: 'Esox masquinongy × lucius',
  category: FishCategory.PREDATORY,
  rarity: FishRarity.LEGENDARY,

  minLength: 20,
  maxLength: 55,
  minWeight: 5,
  maxWeight: 50,
  maxAge: 20,

  activityPattern: ActivityPattern.DAY,
  preferredDepth: DepthZone.MID,
  preferredTemp: { min: 65, max: 75 },
  schoolSize: { min: 1, max: 1 },
  baseFightStrength: 0.9,

  activeSeasons: [Season.FALL, Season.SUMMER],
  spawnSeason: Season.SPRING,

  biteWindow: 1,
  baseBiteChance: 0.02,
  preferredLures: ['large_swimbait', 'bucktail', 'jerkbait'],

  description: 'Sterile hybrid between muskie and northern pike. Distinctive tiger-like pattern.',
  habitat: 'Stocked in lakes where muskie reproduction is difficult.',
  diet: 'Pure predator - any fish that fits in their mouth.',
  conservation: 'Stocked for sport fishing. Cannot reproduce.',
  funFact: 'Tiger muskies grow faster than either parent species due to hybrid vigor!',

  colors: {
    primary: '#D4C5A0',
    secondary: '#2C3E50',
    accent: '#F39C12'
  },
  spriteRef: 'fish/muskie_tiger'
};

/**
 * Golden Trout - Sierra jewels
 */
export const GOLDEN_TROUT: FishSpecies = {
  id: 'golden_trout',
  name: 'Golden Trout',
  scientificName: 'Oncorhynchus mykiss aguabonita',
  category: FishCategory.GAME_FISH,
  rarity: FishRarity.EPIC,

  minLength: 6,
  maxLength: 20,
  minWeight: 0.25,
  maxWeight: 10,
  maxAge: 9,

  activityPattern: ActivityPattern.DAWN,
  preferredDepth: DepthZone.SHALLOW,
  preferredTemp: { min: 45, max: 55 },
  schoolSize: { min: 5, max: 20 },
  baseFightStrength: 0.35,

  activeSeasons: [Season.SUMMER],
  spawnSeason: Season.SPRING,

  biteWindow: 3,
  baseBiteChance: 0.06,
  preferredLures: ['spinner', 'fly', 'worm'],

  description: 'State fish of California. Brilliant golden sides with red horizontal band and dark spots.',
  habitat: 'High-altitude lakes and streams in the Sierra Nevada mountains.',
  diet: 'Insects and zooplankton in their native habitats.',
  conservation: 'Native range limited. Hybridization with rainbow trout threatens purity.',
  funFact: 'Golden trout only live above 6,000 feet elevation in their native range!',

  colors: {
    primary: '#F39C12',
    secondary: '#E74C3C',
    accent: '#27AE60'
  },
  spriteRef: 'fish/trout_golden'
};

// ============================================================================
// REGISTRY CLASS
// ============================================================================

/**
 * Fish Registry - Central catalog of all species
 */
export class FishRegistry {
  private static instance: FishRegistry;
  private species: Map<string, FishSpecies> = new Map();
  private byCategory: Map<FishCategory, Set<string>> = new Map();
  private byRarity: Map<FishRarity, Set<string>> = new Map();

  private constructor() {
    this.initializeSpecies();
    this.initializeIndexes();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FishRegistry {
    if (!FishRegistry.instance) {
      FishRegistry.instance = new FishRegistry();
    }
    return FishRegistry.instance;
  }

  /**
   * Initialize all species definitions
   */
  private initializeSpecies(): void {
    const allSpecies: FishSpecies[] = [
      // Panfish
      BLACK_CRAPPIE,
      BLUEGILL,

      // Bass
      LARGEMOUTH_BASS,
      SMALLMOUTH_BASS,

      // Predatory
      NORTHERN_PIKE,
      MUSKIE,

      // Other Game Fish
      WALLEYE,

      // Trout
      RAINBOW_TROUT,
      BROWN_TROUT,
      BROOK_TROUT,
      GOLDEN_TROUT,
      STEELHEAD,

      // Catfish
      CHANNEL_CATFISH,
      FLATHEAD_CATFISH,
      BLUE_CATFISH,

      // Salmon
      CHINOOK_SALMON,
      COHO_SALMON,

      // Rare/Trophy
      LAKE_STURGEON,
      TIGER_MUSKIE
    ];

    for (const species of allSpecies) {
      this.species.set(species.id, species);
    }
  }

  /**
   * Build category and rarity indexes
   */
  private initializeIndexes(): void {
    // Initialize category sets
    for (const category of Object.values(FishCategory)) {
      this.byCategory.set(category, new Set());
    }

    // Initialize rarity sets
    for (const rarity of Object.values(FishRarity)) {
      this.byRarity.set(rarity, new Set());
    }

    // Index species
    for (const [id, species] of this.species) {
      this.byCategory.get(species.category)?.add(id);
      this.byRarity.get(species.rarity)?.add(id);
    }
  }

  /**
   * Get species by ID
   */
  getSpecies(id: string): FishSpecies | undefined {
    return this.species.get(id);
  }

  /**
   * Get all species
   */
  getAllSpecies(): FishSpecies[] {
    return Array.from(this.species.values());
  }

  /**
   * Get species by category
   */
  getByCategory(category: FishCategory): FishSpecies[] {
    const ids = this.byCategory.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.species.get(id))
      .filter((s): s is FishSpecies => s !== undefined);
  }

  /**
   * Get species by rarity
   */
  getByRarity(rarity: FishRarity): FishSpecies[] {
    const ids = this.byRarity.get(rarity);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.species.get(id))
      .filter((s): s is FishSpecies => s !== undefined);
  }

  /**
   * Get species active in a season
   */
  getBySeason(season: Season): FishSpecies[] {
    return this.getAllSpecies().filter(s =>
      s.activeSeasons.includes(season) || s.activeSeasons.includes(Season.ALL_YEAR)
    );
  }

  /**
   * Get species for depth zone
   */
  getByDepth(depth: number): FishSpecies[] {
    const zone = this.depthToZone(depth);
    return this.getAllSpecies().filter(s => s.preferredDepth === zone);
  }

  /**
   * Get species for temperature
   */
  getByTemperature(temp: number): FishSpecies[] {
    return this.getAllSpecies().filter(s =>
      temp >= s.preferredTemp.min && temp <= s.preferredTemp.max
    );
  }

  /**
   * Get random species weighted by rarity
   */
  getRandomSpecies(): FishSpecies {
    const weights: Record<FishRarity, number> = {
      [FishRarity.COMMON]: 50,
      [FishRarity.UNCOMMON]: 30,
      [FishRarity.RARE]: 15,
      [FishRarity.EPIC]: 4,
      [FishRarity.LEGENDARY]: 1
    };

    const pool: FishSpecies[] = [];
    for (const species of this.species.values()) {
      const count = weights[species.rarity] || 1;
      for (let i = 0; i < count; i++) {
        pool.push(species);
      }
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Get species effective for lure
   */
  getByLure(lureType: string): FishSpecies[] {
    return this.getAllSpecies().filter(s =>
      s.preferredLures.some(l => lureType.toLowerCase().includes(l.toLowerCase()))
    );
  }

  /**
   * Search species by name
   */
  searchByName(query: string): FishSpecies[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllSpecies().filter(s =>
      s.name.toLowerCase().includes(lowerQuery) ||
      s.scientificName.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Convert depth to zone enum
   */
  private depthToZone(depth: number): DepthZone {
    if (depth < 3) return DepthZone.SURFACE;
    if (depth < 10) return DepthZone.SHALLOW;
    if (depth < 30) return DepthZone.MID;
    if (depth < 60) return DepthZone.DEEP;
    return DepthZone.ABYSSAL;
  }

  /**
   * Get educational content about fish
   */
  getEducationalContent(speciesId: string): string {
    const species = this.getSpecies(speciesId);
    if (!species) return '';

    return `
# ${species.name} (${species.scientificName})

## Description
${species.description}

## Habitat
${species.habitat}

## Diet
${species.diet}

## Conservation
${species.conservation}

## Fun Fact
${species.funFact}

## Key Stats
- **Category:** ${this.formatCategory(species.category)}
- **Rarity:** ${this.formatRarity(species.rarity)}
- **Size Range:** ${species.minLength}-${species.maxLength} inches
- **Weight Range:** ${species.minWeight}-${species.maxWeight} pounds
- **Max Age:** ${species.maxAge} years
- **Preferred Temperature:** ${species.preferredTemp.min}-${species.preferredTemp.max}°F
- **Active Seasons:** ${species.activeSeasons.join(', ')}
    `.trim();
  }

  private formatCategory(cat: FishCategory): string {
    return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private formatRarity(rarity: FishRarity): string {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  }
}

// Export singleton getter
export const fishRegistry = FishRegistry.getInstance();
