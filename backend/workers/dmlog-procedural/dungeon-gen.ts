/**
 * DMLoG.AI - Dungeon Generation System
 *
 * Procedural dungeon and map generation using:
 * - Deterministic algorithms for room placement, connectivity, and layout
 * - AI for creative room descriptions, environmental details, and thematic elements
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

export const RoomShapeSchema = z.enum([
  'rectangle',
  'square',
  'circle',
  'oval',
  'l-shaped',
  't-shaped',
  'irregular',
  'corridor',
  'chamber',
  'hall',
]);

export const RoomPurposeSchema = z.enum([
  'entrance',
  'guard-room',
  'living-quarters',
  'dining',
  'kitchen',
  'storage',
  'treasury',
  'armory',
  'library',
  'chapel',
  'torture-chamber',
  'laboratory',
  'throne-room',
  'bedroom',
  'barracks',
  'prison',
  'atrium',
  'cistern',
  'bridge',
  'shaft',
  'stairwell',
  'vault',
  'puzzle-room',
  'boss-chamber',
  'empty',
]);

export const DoorTypeSchema = z.enum([
  'wooden',
  'iron-bound',
  'stone',
  'iron',
  'portcullis',
  'secret',
  'hidden',
  'magical',
  'curtains',
  'none',
]);

export const TerrainTypeSchema = z.enum([
  'stone',
  'dirt',
  'water',
  'lava',
  'ice',
  'mud',
  'sand',
  'metal',
  'glass',
  'void',
]);

export const LightLevelSchema = z.enum([
  'darkness',
  'dim-light',
  'bright-light',
  'magical-darkness',
  'supernatural-glow',
]);

export const HazardTypeSchema = z.enum([
  'pit',
  'spikes',
  'fire',
  'cold',
  'poison-gas',
  'collapse',
  'mud',
  'water',
  'magma',
  'electricity',
  'teleport-trap',
  'mimic',
  'none',
]);

export const TrapSchema = z.object({
  type: z.string(),
  trigger: z.string(),
  effect: z.string(),
  dc: z.number(),
  damage: z.string().optional(),
  canBeDetected: z.boolean(),
  canBeDisarmed: z.boolean(),
});

export const FeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
  interactive: z.boolean(),
  searchable: z.boolean().default(false),
  loot: z.array(z.string()).optional(),
  secret: z.boolean().default(false),
});

export const DoorSchema = z.object({
  type: DoorTypeSchema,
  locked: z.boolean().default(false),
  lockDc: z.number().optional(),
  stuck: z.boolean().default(false),
  trapped: z.boolean().default(false),
  trap: TrapSchema.optional(),
  oneWay: z.boolean().default(false),
  broken: z.boolean().default(false),
  open: z.boolean().default(true),
  description: z.string().optional(),
});

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string(),
  shape: RoomShapeSchema,
  purpose: RoomPurposeSchema,
  dimensions: z.object({
    width: z.number(),
    length: z.number(),
    height: z.number(),
  }),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(), // Floor level
  }),
  terrain: TerrainTypeSchema,
  lightLevel: LightLevelSchema,
  doors: z.array(z.object({
    door: DoorSchema,
    position: z.enum(['north', 'south', 'east', 'west', 'up', 'down']),
    connectsTo: z.string(),
  })),
  exits: z.array(z.object({
    direction: z.enum(['north', 'south', 'east', 'west', 'up', 'down']),
    leadsTo: z.string(),
    type: z.enum(['door', 'corridor', 'stairs', 'ladder', 'shaft', 'teleport']),
  })),
  hazards: z.array(HazardTypeSchema).default([]),
  traps: z.array(TrapSchema).default([]),
  features: z.array(FeatureSchema).default([]),
  creatures: z.array(z.string()).default([]), // References to creature IDs
  treasure: z.array(z.string()).default([]), // References to treasure IDs
  description: z.string(),
  atmosphere: z.string().optional(),
  sounds: z.string().optional(),
  smells: z.string().optional(),
});

export const DungeonLevelSchema = z.object({
  level: z.number(),
  rooms: z.array(RoomSchema),
  corridors: z.array(z.object({
    from: z.string(),
    to: z.string(),
    length: z.number(),
    width: z.number(),
    features: z.array(z.string()).default([]),
  })),
  theme: z.string(),
  description: z.string(),
});

export const DungeonSchema = z.object({
  name: z.string(),
  type: z.enum(['dungeon', 'cave', 'ruins', 'castle', 'tower', 'temple', 'tomb', 'sewer', 'mine', 'lair']),
  levels: z.array(DungeonLevelSchema),
  entranceDescription: z.string(),
  overallTheme: z.string(),
  history: z.string().optional(),
  currentOccupants: z.array(z.string()).default([]),
  metadata: z.object({
    totalRooms: z.number(),
    totalLevels: z.number(),
    estimatedTime: z.string().optional(),
    recommendedLevel: z.object({
      min: z.number(),
      max: z.number(),
    }),
  }),
});

export type RoomShape = z.infer<typeof RoomShapeSchema>;
export type RoomPurpose = z.infer<typeof RoomPurposeSchema>;
export type DoorType = z.infer<typeof DoorTypeSchema>;
export type TerrainType = z.infer<typeof TerrainTypeSchema>;
export type LightLevel = z.infer<typeof LightLevelSchema>;
export type HazardType = z.infer<typeof HazardTypeSchema>;
export type Trap = z.infer<typeof TrapSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Door = z.infer<typeof DoorSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type DungeonLevel = z.infer<typeof DungeonLevelSchema>;
export type Dungeon = z.infer<typeof DungeonSchema>;

// ============================================================================
// COORDINATE SYSTEM
// ============================================================================

export interface Point {
  x: number;
  y: number;
  z?: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate the bounds of a room
 */
export function getRoomBounds(room: Room): Bounds {
  return {
    minX: room.position.x,
    maxX: room.position.x + room.dimensions.width,
    minY: room.position.y,
    maxY: room.position.y + room.dimensions.length,
  };
}

/**
 * Check if two rooms overlap
 */
export function roomsOverlap(room1: Room, room2: Room, padding: number = 1): boolean {
  const bounds1 = getRoomBounds(room1);
  const bounds2 = getRoomBounds(room2);

  return !(
    bounds1.maxX + padding < bounds2.minX ||
    bounds2.maxX + padding < bounds1.minX ||
    bounds1.maxY + padding < bounds2.minY ||
    bounds2.maxY + padding < bounds1.minY
  );
}

/**
 * Calculate distance between two room centers
 */
export function distanceBetweenRooms(room1: Room, room2: Room): number {
  const center1 = {
    x: room1.position.x + room1.dimensions.width / 2,
    y: room1.position.y + room1.dimensions.length / 2,
  };
  const center2 = {
    x: room2.position.x + room2.dimensions.width / 2,
    y: room2.position.y + room2.dimensions.length / 2,
  };

  return Math.sqrt(
    Math.pow(center2.x - center1.x, 2) +
    Math.pow(center2.y - center1.y, 2)
  );
}

/**
 * Get the center point of a room
 */
export function getRoomCenter(room: Room): Point {
  return {
    x: room.position.x + room.dimensions.width / 2,
    y: room.position.y + room.dimensions.length / 2,
    z: room.position.z,
  };
}

// ============================================================================
// ROOM GENERATION
// ============================================================================

const ROOM_SIZE_RANGES: Record<RoomPurpose, { minWidth: number; maxWidth: number; minHeight: number; maxHeight: number }> = {
  'entrance': { minWidth: 15, maxWidth: 25, minHeight: 15, maxHeight: 25 },
  'guard-room': { minWidth: 20, maxWidth: 30, minHeight: 15, maxHeight: 25 },
  'living-quarters': { minWidth: 15, maxWidth: 25, minHeight: 15, maxHeight: 20 },
  'dining': { minWidth: 25, maxWidth: 40, minHeight: 20, maxHeight: 35 },
  'kitchen': { minWidth: 20, maxWidth: 35, minHeight: 15, maxHeight: 25 },
  'storage': { minWidth: 15, maxWidth: 30, minHeight: 15, maxHeight: 25 },
  'treasury': { minWidth: 20, maxWidth: 35, minHeight: 15, maxHeight: 30 },
  'armory': { minWidth: 25, maxWidth: 40, minHeight: 20, maxHeight: 30 },
  'library': { minWidth: 20, maxWidth: 35, minHeight: 15, maxHeight: 30 },
  'chapel': { minWidth: 30, maxWidth: 50, minHeight: 25, maxHeight: 40 },
  'torture-chamber': { minWidth: 20, maxWidth: 30, minHeight: 15, maxHeight: 25 },
  'laboratory': { minWidth: 25, maxWidth: 40, minHeight: 20, maxHeight: 30 },
  'throne-room': { minWidth: 40, maxWidth: 60, minHeight: 30, maxHeight: 50 },
  'bedroom': { minWidth: 15, maxWidth: 25, minHeight: 15, maxHeight: 20 },
  'barracks': { minWidth: 25, maxWidth: 40, minHeight: 20, maxHeight: 30 },
  'prison': { minWidth: 20, maxWidth: 35, minHeight: 20, maxHeight: 30 },
  'atrium': { minWidth: 30, maxWidth: 50, minHeight: 25, maxHeight: 40 },
  'cistern': { minWidth: 25, maxWidth: 40, minHeight: 25, maxHeight: 40 },
  'bridge': { minWidth: 10, maxWidth: 20, minHeight: 30, maxHeight: 60 },
  'shaft': { minWidth: 10, maxWidth: 15, minHeight: 10, maxHeight: 15 },
  'stairwell': { minWidth: 10, maxWidth: 15, minHeight: 10, maxHeight: 20 },
  'vault': { minWidth: 15, maxWidth: 25, minHeight: 15, maxHeight: 25 },
  'puzzle-room': { minWidth: 30, maxWidth: 50, minHeight: 30, maxHeight: 50 },
  'boss-chamber': { minWidth: 40, maxWidth: 60, minHeight: 40, maxHeight: 60 },
  'empty': { minWidth: 15, maxWidth: 30, minHeight: 15, maxHeight: 30 },
};

/**
 * Generate room dimensions based on purpose
 */
export function generateRoomDimensions(purpose: RoomPurpose): {
  width: number;
  length: number;
  height: number;
} {
  const range = ROOM_SIZE_RANGES[purpose] || ROOM_SIZE_RANGES['empty'];

  const width = range.minWidth + Math.floor(
    Math.random() * (range.maxWidth - range.minWidth)
  );
  const length = range.minHeight + Math.floor(
    Math.random() * (range.maxHeight - range.minHeight)
  );
  const height = 10 + Math.floor(Math.random() * 10);

  return { width, length, height };
}

/**
 * Generate a room at a specific position
 */
export function generateRoom(
  id: string,
  purpose: RoomPurpose,
  position: Point,
  options?: {
    shape?: RoomShape;
    terrain?: TerrainType;
    lightLevel?: LightLevel;
    theme?: string;
  }
): Room {
  const dimensions = generateRoomDimensions(purpose);
  const shape = options?.shape || randomElement(['rectangle', 'square', 'oval', 'l-shaped', 't-shaped']);
  const terrain = options?.terrain || 'stone';
  const lightLevel = options?.lightLevel || randomElement(['darkness', 'dim-light', 'bright-light']);

  return {
    id,
    name: generateRoomName(purpose),
    shape,
    purpose,
    dimensions,
    position: { x: position.x, y: position.y, z: position.z || 0 },
    terrain,
    lightLevel,
    doors: [],
    exits: [],
    hazards: generateRoomHazards(purpose, terrain),
    traps: [],
    features: generateRoomFeatures(purpose, options?.theme),
    description: generateRoomDescription(purpose, shape, terrain, options?.theme),
    atmosphere: generateAtmosphere(purpose, terrain),
    sounds: generateSounds(purpose, terrain),
    smells: generateSmells(purpose, terrain),
  };
}

/**
 * Generate room name based on purpose
 */
function generateRoomName(purpose: RoomPurpose): string {
  const adjectives = [
    'Ancient', 'Forgotten', 'Dark', 'Echoing', 'Silent', 'Damp', 'Mossy',
    'Crumbling', 'Ornate', 'Barren', 'Shadowy', 'Dusty', 'Cold', 'Stagnant'
  ];

  if (purpose === 'entrance') return 'Entrance Hall';
  if (purpose === 'boss-chamber') return 'Final Chamber';
  if (purpose === 'empty') return 'Abandoned Chamber';

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  return `${adjective} ${purpose.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
}

/**
 * Generate room description
 */
function generateRoomDescription(
  purpose: RoomPurpose,
  shape: RoomShape,
  terrain: TerrainType,
  theme?: string
): string {
  const shapeDescriptions: Record<RoomShape, string> = {
    'rectangle': 'a rectangular chamber',
    'square': 'a square room',
    'circle': 'a circular chamber',
    'oval': 'an oval-shaped room',
    'l-shaped': 'an L-shaped chamber with a recessed area',
    't-shaped': 'a T-shaped room with passages extending on three sides',
    'irregular': 'an irregularly shaped chamber carved from the living rock',
    'corridor': 'a long corridor',
    'chamber': 'a large natural chamber',
    'hall': 'a grand hall with high ceilings',
  };

  const terrainDescriptions: Record<TerrainType, string> = {
    'stone': 'The walls are made of fitted stone blocks',
    'dirt': 'The walls are raw earth, shored up with wooden beams',
    'water': 'Water covers the floor, rising to ankle depth',
    'lava': 'A river of lava cuts through the chamber',
    'ice': 'The floor is slick with eternal ice',
    'mud': 'Thick mud coats every surface',
    'sand': 'Fine sand covers the floor, drifting in dunes',
    'metal': 'The walls are plated in strange metal',
    'glass': 'Obsidian walls reflect your torchlight',
    'void': 'The chamber fades into impenetrable darkness',
  };

  const baseDesc = `This is ${shapeDescriptions[shape]}. ${terrainDescriptions[terrain]}.`;

  // Add purpose-specific details
  const purposeDetails: Record<RoomPurpose, string> = {
    'entrance': 'Faded footprints suggest recent travel through this area.',
    'guard-room': 'Weapons racks line the walls, though most are now empty.',
    'living-quarters': 'Rotting furniture hints at the room\'s former inhabitants.',
    'dining': 'A long table dominates the center, thick with dust.',
    'kitchen': 'Pots and utensils lie scattered, abandoned in haste.',
    'storage': 'Crates and barrels line the walls, most now empty.',
    'treasury': 'Gold dust lingers in the corners, suggesting great wealth once stored here.',
    'armory': 'Weapon stands hold rusted equipment, now useless.',
    'library': 'Moldering books line the shelves, their knowledge lost to time.',
    'chapel': 'An altar stands at the far end, its deity long forgotten.',
    'torture-chamber': 'Sinister devices hang from the walls, their purpose unmistakable.',
    'laboratory': 'Glass vials and apparatus clutter every surface.',
    'throne-room': 'A raised dais supports a deteriorating throne.',
    'bedroom': 'A bed frame rots in the corner, its mattress long gone.',
    'barracks': 'Bunk beds line the walls, each one empty.',
    'prison': 'Iron cells line the walls, their doors hanging open.',
    'atrium': 'Columns support the high ceiling, carved with forgotten faces.',
    'cistern': 'Dark water fills this space, its depth unknown.',
    'bridge': 'A narrow span crosses the chasm below.',
    'shaft': 'A vertical shaft descends into darkness.',
    'stairwell': 'Spiral stairs lead upward, vanishing in the gloom.',
    'vault': 'Massive doors guard this secure chamber.',
    'puzzle-room': 'Strange mechanisms cover every surface.',
    'boss-chamber': 'An oppressive presence fills this space.',
    'empty': 'Dust motes float in the still air.',
  };

  return `${baseDesc} ${purposeDetails[purpose]}`;
}

/**
 * Generate atmosphere description
 */
function generateAtmosphere(purpose: RoomPurpose, terrain: TerrainType): string {
  const atmospheres = [
    'The air is still and heavy.',
    'A sense of dread permeates the area.',
    'The temperature drops noticeably.',
    'Strange shadows seem to move at the edge of vision.',
    'The space feels watchful, as if something observes from darkness.',
    'An unnatural silence reigns.',
    'The air vibrates with unseen energy.',
  ];

  return atmospheres[Math.floor(Math.random() * atmospheres.length)];
}

/**
 * Generate sounds
 */
function generateSounds(purpose: RoomPurpose, terrain: TerrainType): string {
  const sounds: Record<RoomPurpose, string[]> = {
    'entrance': ['Wind whistling through cracks', 'Distant footsteps', 'Heavy doors settling'],
    'guard-room': ['Metallic clinking', 'Distant snoring', 'Pacing footsteps'],
    'living-quarters': ['Creaking wood', 'Faint whispers', 'Rustling fabric'],
    'dining': ['Scurrying rats', 'Dripping water', 'Echoing footsteps'],
    'kitchen': ['Dripping water', 'Sizzling sounds', 'Chittering insects'],
    'storage': ['Shifting crates', 'Squeaking rodents', 'Rustling'],
    'treasury': ['Distant metallic chimes', 'Faint whispering', 'Silence'],
    'armory': ['Clinking metal', 'Heavy breathing', 'Footstep echoes'],
    'library': ['Rustling pages', 'Creaking shelves', 'Faint muttering'],
    'chapel': ['Chanting (distant)', 'Organ notes (faint)', 'Sobbing'],
    'torture-chamber': ['Faint screams', 'Chains rattling', 'Dripping'],
    'laboratory': ['Bubbling liquids', 'Hissing steam', 'Metallic clinking'],
    'throne-room': ['Elegant music (faint)', 'Robes rustling', 'Whispers'],
    'bedroom': ['Heavy breathing', 'Creaking bed', 'Wind through cracks'],
    'barracks': ['Snoring', 'Armor rattling', 'Loud conversation (distant)'],
    'prison': ['Moaning', 'Chains rattling', 'Desperate whispers'],
    'atrium': ['Echoing footsteps', 'Wind howling', 'Distant chanting'],
    'cistern': ['Lapping water', 'Dripping', 'Splashing'],
    'bridge': ['Wind rushing', 'Rumbling (far below)', 'Creaking stone'],
    'shaft': ['Howling wind', 'Falling stones', 'Unknown sounds from below'],
    'stairwell': ['Echoing steps', 'Wind whistling', 'Groaning stone'],
    'vault': ['Silence', 'Mechanical clicking', 'Magic humming'],
    'puzzle-room': ['Gears turning', 'Magical energy humming', 'Clicks and whirs'],
    'boss-chamber': ['Heavy breathing', 'Deep growling', 'Powerful heartbeat'],
    'empty': ['Complete silence', 'Dripping water', 'Your own breathing'],
  };

  const roomSounds = sounds[purpose] || ['Silence'];
  return roomSounds[Math.floor(Math.random() * roomSounds.length)];
}

/**
 * Generate smells
 */
function generateSmells(purpose: RoomPurpose, terrain: TerrainType): string {
  const smellMap: Record<RoomPurpose, string[]> = {
    'entrance': ['Musty air', 'Ozone', 'Fresh air (draft)'],
    'guard-room': ['Unwashed bodies', 'Leather and oil', 'Stale sweat'],
    'living-quarters': ['Mold', 'Dust', 'Faint perfume'],
    'dining': ['Rotting food', 'Spoiled wine', 'Rat droppings'],
    'kitchen': ['Rotting meat', 'Stale spices', 'Mold'],
    'storage': ['Mold', 'Dust', 'Wood rot'],
    'treasury': ['Metallic scent', 'Ozone', 'Leather'],
    'armory': ['Oil and rust', 'Leather', 'Old metal'],
    'library': ['Moldering paper', 'Dust', 'Ink'],
    'chapel': ['Incense (old)', 'Wax', 'Stone dust'],
    'torture-chamber': ['Blood', 'Fear-sweat', 'Excrement'],
    'laboratory': ['Chemicals', 'Ozone', 'Unidentifiable organic matter'],
    'throne-room': ['Ozone', 'Expensive perfume', 'Old tapestries'],
    'bedroom': ['Mold', 'Old bedding', 'Perfume'],
    'barracks': ['Unwashed bodies', 'Leather', 'Stale food'],
    'prison': ['Excrement', 'Mold', 'Despair'],
    'atrium': ['Stone dust', 'Ozone', 'Flowers (withered)'],
    'cistern': ['Stagnant water', 'Algae', 'Mold'],
    'bridge': ['Ozone', 'Sulfur', 'Fresh air'],
    'shaft': ['Ozone', 'Stale air', 'Unknown'],
    'stairwell': ['Dust', 'Stone', 'Drafts'],
    'vault': ['Magic', 'Ozone', 'Age'],
    'puzzle-room': ['Ozone', 'Burning dust', 'Magic'],
    'boss-chamber': ['Ozone', 'Blood', 'Powerful musk'],
    'empty': ['Dust', 'Stone', 'Stale air'],
  };

  const terrainSmells: Record<TerrainType, string> = {
    'stone': 'Dust and stone',
    'dirt': 'Earth and roots',
    'water': 'Stagnant water',
    'lava': 'Sulfur and heat',
    'ice': 'Ozone and cold',
    'mud': 'Rot and stagnation',
    'sand': 'Dry dust',
    'metal': 'Oil and rust',
    'glass': 'Volcanic glass',
    'void': 'Nothing',
  };

  const roomSmells = smellMap[purpose] || ['Dust'];
  const primarySmell = roomSmells[Math.floor(Math.random() * roomSmells.length)];
  const secondarySmell = terrainSmells[terrain];

  return `${primarySmell}, with undertones of ${secondarySmell}`;
}

/**
 * Generate room hazards
 */
function generateRoomHazards(purpose: RoomPurpose, terrain: TerrainType): HazardType[] {
  const hazards: HazardType[] = [];

  // Terrain-based hazards
  if (terrain === 'water') hazards.push('water');
  if (terrain === 'lava') hazards.push('magma');
  if (terrain === 'ice') hazards.push('cold');
  if (terrain === 'mud') hazards.push('mud');

  // Purpose-based hazards
  const purposeHazards: Record<RoomPurpose, HazardType[]> = {
    'bridge': ['pit'],
    'shaft': ['pit'],
    'laboratory': ['poison-gas', 'collapse'],
    'torture-chamber': ['spikes'],
    'kitchen': ['fire'],
    'cistern': ['water'],
    'entrance': [],
    'guard-room': [],
    'living-quarters': [],
    'dining': [],
    'storage': [],
    'treasury': [],
    'armory': [],
    'library': [],
    'chapel': [],
    'throne-room': [],
    'bedroom': [],
    'barracks': [],
    'prison': [],
    'atrium': [],
    'stairwell': [],
    'vault': [],
    'puzzle-room': [],
    'boss-chamber': [],
    'empty': [],
  };

  hazards.push(...(purposeHazards[purpose] || []));

  return [...new Set(hazards)];
}

/**
 * Generate room features
 */
function generateRoomFeatures(purpose: RoomPurpose, theme?: string): Feature[] {
  const features: Feature[] = [];

  const purposeFeatures: Record<RoomPurpose, Feature[]> = {
    'entrance': [
      { name: 'Faded murals', description: 'Ancient artwork covers the walls, depicting forgotten scenes.', interactive: false, searchable: true },
      { name: 'Guard station', description: 'A small alcove that once housed guards.', interactive: false, searchable: true },
    ],
    'guard-room': [
      { name: 'Weapons rack', description: 'Empty racks for weapons storage.', interactive: true, searchable: true },
      { name: 'Bunks', description: 'Rough beds for guards.', interactive: false, searchable: true },
    ],
    'treasury': [
      { name: 'Empty chests', description: 'Caskets that once held treasure.', interactive: true, searchable: true, loot: ['hidden gems', 'secret compartment'] },
      { name: 'False wall', description: 'A section of wall seems suspicious.', interactive: true, searchable: true, secret: true },
    ],
    'library': [
      { name: 'Bookshelves', description: 'Rows of ancient tomes, most crumbling.', interactive: true, searchable: true },
      { name: 'Reading desk', description: 'A desk with scattered notes.', interactive: true, searchable: true },
    ],
    'chapel': [
      { name: 'Altar', description: 'A raised altar to a forgotten deity.', interactive: true, searchable: true },
      { name: 'Reliquary', description: 'A cabinet for holy relics, now empty.', interactive: true, searchable: true },
    ],
    'laboratory': [
      { name: 'Alchemy equipment', description: 'Glass vessels and heating apparatus.', interactive: true, searchable: true },
      { name: 'Notes', description: 'Scrawled notes cover the workbench.', interactive: true, searchable: true },
    ],
    'prison': [
      { name: 'Cells', description: 'Iron-barred cells line the walls.', interactive: true, searchable: true },
      { name: 'Torture devices', description: 'Sinister implements hang from the walls.', interactive: true, searchable: true },
    ],
  };

  const roomFeatures = purposeFeatures[purpose] || [];
  features.push(...roomFeatures.slice(0, 1 + Math.floor(Math.random() * 2)));

  // Add a secret feature occasionally
  if (Math.random() > 0.7) {
    features.push({
      name: 'Secret door',
      description: 'A cleverly concealed door.',
      interactive: true,
      searchable: true,
      secret: true,
    });
  }

  return features;
}

// ============================================================================
// DUNGEON GENERATION ALGORITHMS
// ============================================================================

export interface DungeonGenerationOptions {
  type: Dungeon['type'];
  levels: number;
  roomsPerLevel: number;
  theme?: string;
  recommendedLevel: { min: number; max: number };
}

/**
 * Generate a complete dungeon using BSP (Binary Space Partitioning)
 */
export function generateDungeon(options: DungeonGenerationOptions): Dungeon {
  const levels: DungeonLevel[] = [];

  for (let i = 0; i < options.levels; i++) {
    levels.push(generateDungeonLevel({
      level: i + 1,
      roomsPerLevel: options.roomsPerLevel,
      theme: options.theme,
    }));
  }

  return {
    name: generateDungeonName(options.type, options.theme),
    type: options.type,
    levels,
    entranceDescription: generateEntranceDescription(options.type, options.theme),
    overallTheme: options.theme || generateTheme(options.type),
    history: generateDungeonHistory(options.type),
    currentOccupants: generateOccupants(options.theme),
    metadata: {
      totalRooms: levels.reduce((sum, l) => sum + l.rooms.length, 0),
      totalLevels: options.levels,
      recommendedLevel: options.recommendedLevel,
    },
  };
}

/**
 * Generate a single dungeon level
 */
export function generateDungeonLevel(options: {
  level: number;
  roomsPerLevel: number;
  theme?: string;
}): DungeonLevel {
  const rooms: Room[] = [];
  const gridSize = 100; // Grid size for room placement
  const corridorWidth = 2;

  // Place entrance room first
  const entranceRoom = generateRoom('entrance', 'entrance', {
    x: Math.floor(gridSize / 2) - 10,
    y: 5,
    z: options.level - 1,
  }, { theme: options.theme });
  rooms.push(entranceRoom);

  // Place remaining rooms using random placement with collision detection
  const roomPurposes = getRandomRoomPurposes(options.roomsPerLevel - 1, options.level === 1);

  for (let i = 0; i < roomPurposes.length; i++) {
    let attempts = 0;
    let placed = false;

    while (attempts < 50 && !placed) {
      const x = 5 + Math.floor(Math.random() * (gridSize - 30));
      const y = 5 + Math.floor(Math.random() * (gridSize - 30));

      const newRoom = generateRoom(
        `room-${options.level}-${i + 2}`,
        roomPurposes[i],
        { x, y, z: options.level - 1 },
        { theme: options.theme }
      );

      // Check for overlaps
      let overlaps = false;
      for (const existingRoom of rooms) {
        if (roomsOverlap(existingRoom, newRoom, 2)) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        rooms.push(newRoom);
        placed = true;
      }

      attempts++;
    }
  }

  // Generate corridors connecting rooms
  const corridors = generateCorridors(rooms);

  // Generate doors
  generateDoors(rooms, corridors);

  return {
    level: options.level,
    rooms,
    corridors,
    theme: options.theme || 'Ancient Ruins',
    description: generateLevelDescription(options.level, options.theme),
  };
}

/**
 * Get random room purposes for a level
 */
function getRandomRoomPurposes(count: number, isFirstLevel: boolean): RoomPurpose[] {
  const commonPurposes: RoomPurpose[] = [
    'living-quarters', 'storage', 'empty', 'empty', 'guard-room',
    'storage', 'empty', 'living-quarters', 'guard-room', 'empty',
  ];

  const specialPurposes: RoomPurpose[] = [
    'treasury', 'armory', 'library', 'laboratory', 'prison',
    'dining', 'kitchen', 'chapel', 'barracks', 'atrium',
  ];

  const bossPurposes: RoomPurpose[] = ['boss-chamber', 'throne-room', 'vault'];

  const purposes: RoomPurpose[] = [];

  // Add common rooms
  for (let i = 0; i < Math.floor(count * 0.6); i++) {
    purposes.push(randomElement(commonPurposes));
  }

  // Add special rooms
  for (let i = 0; i < Math.floor(count * 0.3); i++) {
    purposes.push(randomElement(specialPurposes));
  }

  // Fill remainder with random
  while (purposes.length < count) {
    purposes.push(randomElement([...commonPurposes, ...specialPurposes]));
  }

  // Always add boss chamber on last room
  if (!isFirstLevel) {
    purposes[purposes.length - 1] = randomElement(bossPurposes);
  }

  return shuffleArray(purposes).slice(0, count);
}

/**
 * Generate corridors between rooms
 */
function generateCorridors(rooms: Room[]): Array<{
  from: string;
  to: string;
  length: number;
  width: number;
  features: string[];
}> {
  const corridors: Array<{
    from: string;
    to: string;
    length: number;
    width: number;
    features: string[];
  }> = [];

  // Sort rooms by distance from entrance (position.y)
  const sortedRooms = [...rooms].sort((a, b) => a.position.y - b.position.y);

  // Connect each room to the nearest unconnected room
  for (let i = 0; i < sortedRooms.length - 1; i++) {
    const fromRoom = sortedRooms[i];
    const toRoom = sortedRooms[i + 1];

    const distance = distanceBetweenRooms(fromRoom, toRoom);

    corridors.push({
      from: fromRoom.id,
      to: toRoom.id,
      length: Math.floor(distance),
      width: 2 + Math.floor(Math.random() * 3),
      features: generateCorridorFeatures(),
    });
  }

  // Add some additional connections for loops
  for (let i = 2; i < sortedRooms.length; i++) {
    if (Math.random() > 0.6) {
      const fromRoom = sortedRooms[i];
      const toRoom = sortedRooms[Math.floor(Math.random() * i)];

      corridors.push({
        from: fromRoom.id,
        to: toRoom.id,
        length: Math.floor(distanceBetweenRooms(fromRoom, toRoom)),
        width: 2,
        features: [],
      });
    }
  }

  return corridors;
}

/**
 * Generate corridor features
 */
function generateCorridorFeatures(): string[] {
  const features = [
    'Torches mounted on walls',
    'Ancient graffiti',
    'Cobwebs in corners',
    'Frescoes on ceiling',
    'Side passages to dead ends',
    'Small alcoves with statues',
    'Drainage channels',
    'Pillars along walls',
  ];

  const count = Math.floor(Math.random() * 3);
  return shuffleArray([...features]).slice(0, count);
}

/**
 * Generate doors between connected rooms
 */
function generateDoors(
  rooms: Room[],
  corridors: Array<{ from: string; to: string }>
): void {
  for (const corridor of corridors) {
    const fromRoom = rooms.find(r => r.id === corridor.from);
    const toRoom = rooms.find(r => r.id === corridor.to);

    if (!fromRoom || !toRoom) continue;

    // Determine door type
    const doorType = generateDoorType();
    const door: Door = {
      type: doorType,
      locked: doorType === 'iron' ? Math.random() > 0.5 : false,
      lockDc: doorType === 'iron' ? 15 + Math.floor(Math.random() * 10) : undefined,
      trapped: Math.random() > 0.8,
      open: doorType === 'curtains' || doorType === 'none',
      description: generateDoorDescription(doorType),
    };

    // Add doors to both rooms
    fromRoom.doors.push({
      door,
      position: getExitDirection(fromRoom, toRoom),
      connectsTo: toRoom.id,
    });

    toRoom.doors.push({
      door,
      position: getExitDirection(toRoom, fromRoom),
      connectsTo: fromRoom.id,
    });

    // Add exits
    fromRoom.exits.push({
      direction: getExitDirection(fromRoom, toRoom),
      leadsTo: toRoom.id,
      type: 'corridor',
    });

    toRoom.exits.push({
      direction: getExitDirection(toRoom, fromRoom),
      leadsTo: fromRoom.id,
      type: 'corridor',
    });
  }
}

/**
 * Get exit direction from one room to another
 */
function getExitDirection(from: Room, to: Room): 'north' | 'south' | 'east' | 'west' {
  const fromCenter = {
    x: from.position.x + from.dimensions.width / 2,
    y: from.position.y + from.dimensions.length / 2,
  };
  const toCenter = {
    x: to.position.x + to.dimensions.width / 2,
    y: to.position.y + to.dimensions.length / 2,
  };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}

/**
 * Generate door type
 */
function generateDoorType(): DoorType {
  const weights = [
    { type: 'wooden', weight: 4 },
    { type: 'iron-bound', weight: 3 },
    { type: 'stone', weight: 2 },
    { type: 'iron', weight: 2 },
    { type: 'secret', weight: 1 },
    { type: 'none', weight: 2 },
    { type: 'curtains', weight: 1 },
  ];

  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;

  for (const { type, weight } of weights) {
    roll -= weight;
    if (roll <= 0) return type;
  }

  return 'wooden';
}

/**
 * Generate door description
 */
function generateDoorDescription(type: DoorType): string {
  const descriptions: Record<DoorType, string> = {
    'wooden': 'A stout wooden door, bound with iron bands.',
    'iron-bound': 'A heavy oak door reinforced with iron bands.',
    'stone': 'A stone slab that pivots on hidden mechanisms.',
    'iron': 'A solid iron door, rusted but still strong.',
    'portcullis': 'Iron bars that can be raised or lowered.',
    'secret': 'A cleverly concealed door, barely visible.',
    'hidden': 'A completely hidden panel, nearly impossible to detect.',
    'magical': 'A door inscribed with glowing runes that pulses with power.',
    'curtains': 'Heavy tapestries that hang across the opening.',
    'none': 'A simple open archway.',
  };

  return descriptions[type];
}

/**
 * Generate dungeon name
 */
function generateDungeonName(type: Dungeon['type'], theme?: string): string {
  const prefixes = [
    'Ancient', 'Forgotten', 'Cursed', 'Shadowed', 'Sunken', 'Hidden',
    'Lost', 'Dread', 'Forsaken', 'Black', 'Crimson', 'Eternal',
  ];

  const names: Record<Dungeon['type'], string[]> = {
    'dungeon': ['Crypt', 'Dungeon', 'Underground', 'Depths', 'Vaults'],
    'cave': ['Caverns', 'Caves', 'Depths', 'Hollows'],
    'ruins': ['Ruins', 'Remnants', 'Rubble', 'Relics'],
    'castle': ['Citadel', 'Fortress', 'Bastion', 'Stronghold'],
    'tower': ['Spire', 'Tower', 'Pinnacle', 'Obelisk'],
    'temple': ['Temple', 'Shrine', 'Sanctuary', 'Fane'],
    'tomb': ['Tomb', 'Sepulcher', 'Mausoleum', 'Crypt'],
    'sewer': ['Sewers', 'Tunnels', 'Drains', 'Undercity'],
    'mine': ['Mines', 'Workings', 'Pits', 'Excavation'],
    'lair': ['Lair', 'Den', 'Nest', 'Roost'],
  };

  const prefix = theme || prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = names[type][Math.floor(Math.random() * names[type].length)];

  return `${prefix} ${suffix}`;
}

/**
 * Generate entrance description
 */
function generateEntranceDescription(type: Dungeon['type'], theme?: string): string {
  const entrances: Record<Dungeon['type'], string[]> = {
    'dungeon': [
      'Stone steps descend into darkness, flanked by crumbling pillars.',
      'A heavy iron door set into a hillside, covered in vines.',
      'A cave mouth leads to worked stone corridors beyond.',
    ],
    'cave': [
      'A natural cave opening, smelling of damp earth.',
      'A fissure in the rock face, barely wide enough for one person.',
      'A sinkhole has collapsed, revealing a dark cavern below.',
    ],
    'ruins': [
      'Broken walls rise from the forest floor, hinting at grandeur.',
      'Collapsed masonry provides access to underground chambers.',
      'Vines cover ancient stone, hiding the entrance from view.',
    ],
    'castle': [
      'The main gate stands open, darkness beyond.',
      'A postern gate provides access around the main defenses.',
      'Crumbling battlements mark the path to the inner keep.',
    ],
    'tower': [
      'The tower rises impossibly high, its door bound in copper.',
      'No entrance is visible from the ground.',
      'A spiral stair around the exterior leads to the only door.',
    ],
    'temple': [
      'Massive doors of bronze, covered in faded reliefs.',
      'The temple entrance is partially buried in sand and debris.',
      'Statues of forgotten gods guard the approach.',
    ],
    'tomb': [
      'A sarcophagus in the hillside hides the entrance.',
      'The entrance is marked with warnings in an ancient tongue.',
      'Stone steps lead down into eternal darkness.',
    ],
    'sewer': [
      'A grate has been pried open, revealing the darkness below.',
      'The sewer entrance smells of decay and stagnant water.',
      'A rusted ladder descends into the gloom.',
    ],
    'mine': [
      'Minecart tracks disappear into the darkness of a tunnel.',
      'A hoist mechanism marks the shaft entrance.',
      'Cave-in supports show evidence of recent activity.',
    ],
    'lair': [
      'The entrance is marked with claw marks and scorched stone.',
      'Bones litter the approach, warning of danger within.',
      'The lair entrance is hidden behind a waterfall.',
    ],
  };

  const options = entrances[type];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate dungeon theme
 */
function generateTheme(type: Dungeon['type']): string {
  const themes: Record<Dungeon['type'], string[]> = {
    'dungeon': ['Ancient Prison', 'Forgotten Crypt', 'War Bunker', 'Cult Sanctuary'],
    'cave': ['Natural Caverns', 'Crystal Mines', 'Fungal Forest', 'Underground River'],
    'ruins': ['Lost Civilization', 'War Zone', 'Magical Catastrophe', 'Time Forgotten'],
    'castle': ['Abandoned Fortress', 'Vampire Lair', 'Mad Wizard\'s Tower', 'Garrison'],
    'tower': ['Wizard\'s Spire', 'Observatory', 'Prison Tower', 'Beacon'],
    'temple': ['Forbidden Temple', 'Elemental Shrine', 'God\'s Tomb', 'Cult Headquarters'],
    'tomb': ['Pharaoh\'s Rest', 'Vampire Crypt', 'Hero\'s Burial', 'Cursed Vault'],
    'sewer': ['Ancient Sewers', 'Abandoned Undercity', 'Alchemist\'s Drainage', 'Monster Nest'],
    'mine': ['Gem Mine', 'Iron Works', 'Mithril Excavation', 'Excavated Ruins'],
    'lair': ['Dragon\'s Den', 'Demon Nest', 'Beast Cave', 'Summoning Circle'],
  };

  const options = themes[type];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate dungeon history
 */
function generateDungeonHistory(type: Dungeon['type']): string {
  const histories: Record<Dungeon['type'], string[]> = {
    'dungeon': [
      'Built centuries ago as a prison, then abandoned when the kingdom fell.',
      'Originally a temple, later converted to a dungeon by conquering forces.',
      'Carved from the living rock by dwarves, abandoned when the mines ran dry.',
    ],
    'cave': [
      'Natural caverns that have seen use by many inhabitants over millennia.',
      'Once part of a larger underground river system, now partially dry.',
      'Discovered by miners who unleashed something ancient and terrible.',
    ],
    'ruins': [
      'Once a thriving city, destroyed by magical catastrophe.',
      'The remnants of a fortress that fell during the Demon Wars.',
      'Abandoned after the royal family vanished without a trace.',
    ],
    'castle': [
      'The seat of power for a forgotten kingdom, now inhabited only by echoes.',
      'Built to defend against invaders who never came, now abandoned.',
      'A former garrison that fell to internal betrayal.',
    ],
    'tower': [
      'Constructed by an archmage seeking isolation, then abandoned.',
      'An observatory from a vanished civilization.',
      'A prison for creatures that could not be killed.',
    ],
    'temple': [
      'Dedicated to a god whose worship has been forbidden for centuries.',
      'A temple that changed hands between faiths multiple times.',
      'Built over a natural portal to another plane.',
    ],
    'tomb': [
      'The final resting place of a ruler cursed never to find peace.',
      'A collective tomb for an order of paladins who fell defending the realm.',
      'A trap-filled tomb designed to discourage grave robbers.',
    ],
    'sewer': [
      'The ancient drainage system of a city that no longer exists above.',
      'Originally designed for defense, later converted to waste management.',
      'A maze of forgotten passages beneath a modern metropolis.',
    ],
    'mine': [
      'Abandoned when the miners broke through to something they shouldn\'t have.',
      'Once the source of great wealth, now depleted and dangerous.',
      'Magical veins attracted creatures that made mining impossible.',
    ],
    'lair': [
      'A naturally-formed cavern that attracted something powerful.',
      'Built specifically as a lair, then abandoned.',
      'A nesting site that has been used for generations.',
    ],
  };

  const options = histories[type];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Generate current occupants
 */
function generateOccupants(theme?: string): string[] {
  const allOccupants = [
    'Goblins', 'Kobolds', 'Bandits', 'Cultists', 'Undead',
    'Orcs', 'Gnolls', 'Drow', 'Duergar', 'Deep Gnomes',
    'Constructs', 'Demons', 'Devils', 'Elementals', 'Dragons',
  ];

  const count = 1 + Math.floor(Math.random() * 3);
  return shuffleArray([...allOccupants]).slice(0, count);
}

/**
 * Generate level description
 */
function generateLevelDescription(level: number, theme?: string): string {
  const levelDescriptors = ['The upper level shows signs of recent use.',
    'This level has been untouched for years.',
    'Evidence of fighting marks this level.',
    'The air grows colder as you descend.',
    'Strange fungus grows on every surface.'];

  const baseDesc = levelDescriptors[Math.floor(Math.random() * levelDescriptors.length)];

  if (level > 1) {
    return `${baseDesc} The descent to level ${level} revealed signs of previous inhabitants.`;
  }

  return `${baseDesc} This is the first level of the dungeon.`;
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

// ============================================================================
// EXPORTS
// ============================================================================

export const DungeonGen = {
  generateDungeon,
  generateDungeonLevel,
  generateRoom,
  generateRoomDimensions,
  getRoomBounds,
  roomsOverlap,
  distanceBetweenRooms,
  generateDoorType,
};

export default DungeonGen;
