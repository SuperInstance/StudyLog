/**
 * DMLoG.AI - Quest Generation System
 *
 * Procedural quest and plot hook generation using:
 * - Deterministic math for difficulty scaling, reward calculation, and quest structure
 * - AI for creative plot hooks, NPCs, motivations, and narrative elements
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

export const QuestTypeSchema = z.enum([
  'fetch',
  'kill',
  'escort',
  'investigate',
  'deliver',
  'rescue',
  'defend',
  'explore',
  'diplomacy',
  'puzzle',
  'social',
  'multi-stage',
  'dungeon-delve',
]);

export const QuestGiverTypeSchema = z.enum([
  'noble',
  'merchant',
  'priest',
  'mysterious-stranger',
  'desperate-peasant',
  'guard-captain',
  'scholar',
  'criminal',
  'fellow-adventurer',
  'deity',
  'organization',
  'spirit',
]);

export const QuestTierSchema = z.enum([
  'local',
  'regional',
  'national',
  'continental',
  'planar',
]);

export const QuestRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
]);

export const QuestStatusSchema = z.enum([
  'available',
  'accepted',
  'in-progress',
  'completed',
  'failed',
  'abandoned',
  'blocked',
]);

export const QuestObjectiveSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum([
    'go-to',
    'kill',
    'collect',
    'talk-to',
    'escort',
    'protect',
    'investigate',
    'solve',
    'survive',
    'escape',
    'craft',
    'perform',
  ]),
  target: z.string().optional(),
  quantity: z.number().default(1),
  location: z.string().optional(),
  completed: z.boolean().default(false),
  hidden: z.boolean().default(false),
  optional: z.boolean().default(false),
});

export const QuestRewardSchema = z.object({
  gold: z.number().default(0),
  items: z.array(z.string()).default([]),
  experience: z.number().default(0),
  reputation: z.array(z.object({
    faction: z.string(),
    amount: z.number(),
  })).default([]),
  special: z.array(z.string()).default([]),
});

export const QuestPrerequisiteSchema = z.object({
  level: z.number().optional(),
  completedQuests: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  items: z.array(z.string()).default([]),
  factions: z.array(z.object({
    faction: z.string(),
    minimumStanding: z.number(),
  })).default([]),
});

export const PlotHookSchema = z.object({
  hook: z.string(),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  mystery: z.string().optional(),
  twist: z.string().optional(),
  connections: z.array(z.string()).default([]),
});

export const QuestStageSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  objectives: z.array(QuestObjectiveSchema),
  completionTrigger: z.string().optional(),
  nextStage: z.string().optional(),
  alternativeStages: z.array(z.string()).default([]),
});

export const QuestSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: QuestTypeSchema,
  tier: QuestTierSchema,
  rarity: QuestRaritySchema,
  status: QuestStatusSchema,
  description: z.string(),
  plotHook: PlotHookSchema,
  questGiver: z.object({
    name: z.string(),
    type: QuestGiverTypeSchema,
    location: z.string(),
    motivation: z.string(),
  }),
  objectives: z.array(QuestObjectiveSchema),
  stages: z.array(QuestStageSchema).default([]),
  rewards: QuestRewardSchema,
  prerequisites: QuestPrerequisiteSchema.optional(),
  timeLimit: z.string().optional(),
  failureCondition: z.string().optional(),
  secretObjectives: z.array(QuestObjectiveSchema).default([]),
  notes: z.string().optional(),
  recommendedLevel: z.object({
    min: z.number(),
    max: z.number(),
  }),
  tags: z.array(z.string()).default([]),
});

export type QuestType = z.infer<typeof QuestTypeSchema>;
export type QuestGiverType = z.infer<typeof QuestGiverTypeSchema>;
export type QuestTier = z.infer<typeof QuestTierSchema>;
export type QuestRarity = z.infer<typeof QuestRaritySchema>;
export type QuestStatus = z.infer<typeof QuestStatusSchema>;
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
export type QuestReward = z.infer<typeof QuestRewardSchema>;
export type QuestPrerequisite = z.infer<typeof QuestPrerequisiteSchema>;
export type PlotHook = z.infer<typeof PlotHookSchema>;
export type QuestStage = z.infer<typeof QuestStageSchema>;
export type Quest = z.infer<typeof QuestSchema>;

// ============================================================================
// REWARD CALCULATIONS
// ============================================================================

/**
 * Calculate gold reward based on quest tier and rarity
 */
export function calculateGoldReward(tier: QuestTier, rarity: QuestRarity): number {
  const tierMultiplier: Record<QuestTier, number> = {
    'local': 1,
    'regional': 5,
    'national': 20,
    'continental': 100,
    'planar': 500,
  };

  const rarityMultiplier: Record<QuestRarity, number> = {
    'common': 1,
    'uncommon': 2,
    'rare': 5,
    'epic': 20,
    'legendary': 100,
  };

  const base = 50; // Base gold for a local common quest
  return Math.floor(base * tierMultiplier[tier] * rarityMultiplier[rarity]);
}

/**
 * Calculate XP reward based on quest tier and rarity
 */
export function calculateXpReward(tier: QuestTier, rarity: QuestRarity): number {
  const tierMultiplier: Record<QuestTier, number> = {
    'local': 1,
    'regional': 3,
    'national': 10,
    'continental': 50,
    'planar': 200,
  };

  const rarityMultiplier: Record<QuestRarity, number> = {
    'common': 1,
    'uncommon': 2,
    'rare': 4,
    'epic': 15,
    'legendary': 50,
  };

  const base = 100; // Base XP for a local common quest
  return Math.floor(base * tierMultiplier[tier] * rarityMultiplier[rarity]);
}

/**
 * Calculate recommended level range for a quest
 */
export function calculateRecommendedLevel(tier: QuestTier, rarity: QuestRarity): {
  min: number;
  max: number;
} {
  const tierBase: Record<QuestTier, number> = {
    'local': 1,
    'regional': 4,
    'national': 8,
    'continental': 12,
    'planar': 16,
  };

  const rarityBonus: Record<QuestRarity, number> = {
    'common': 0,
    'uncommon': 1,
    'rare': 2,
    'epic': 3,
    'legendary': 4,
  };

  const base = tierBase[tier] + rarityBonus[rarity];
  const range = 2 + Math.floor(base / 5);

  return {
    min: Math.max(1, base - range),
    max: base + range,
  };
}

// ============================================================================
// QUEST GENERATION TEMPLATES
// ============================================================================

interface QuestTemplate {
  type: QuestType;
  nameTemplates: string[];
  objectiveTemplates: string[];
  rewardMultipliers: { gold: number; xp: number };
  commonTwists: string[];
}

const QUEST_TEMPLATES: Record<QuestType, QuestTemplate> = {
  'fetch': {
    type: 'fetch',
    nameTemplates: [
      'Retrieve the {ITEM}',
      'The Missing {ITEM}',
      'Recover the {ITEM} from {LOCATION}',
      'A Lost {ITEM}',
      'The {ITEM} of {NAME}',
    ],
    objectiveTemplates: [
      'Travel to {LOCATION} and find the {ITEM}',
      'Locate the missing {ITEM}',
      'Retrieve {ITEM} without being detected',
      'Bring back the {ITEM} from the {LOCATION}',
    ],
    rewardMultipliers: { gold: 0.8, xp: 0.8 },
    commonTwists: [
      'The item was never stolen, merely misplaced',
      'The item is cursed',
      'The item is being used by someone innocent',
      'There are multiple copies of the item',
      'The item was destroyed and must be recreated',
    ],
  },
  'kill': {
    type: 'kill',
    nameTemplates: [
      'Hunt the {CREATURE}',
      'The {CREATURE} Threat',
      'Eliminate the {CREATURE}',
      'Bounty: {CREATURE}',
      'The {CREATURE} of {LOCATION}',
    ],
    objectiveTemplates: [
      'Track down and slay the {CREATURE}',
      'Defeat the {CREATURE} terrorizing {LOCATION}',
      'Bring proof of the {CREATURE}\'s death',
      'Clear the {CREATURE} nest',
    ],
    rewardMultipliers: { gold: 1, xp: 1 },
    commonTwists: [
      'The creature is innocent of the crimes accused',
      'The creature was once human',
      'The creature has a family to protect',
      'The creature is being controlled by another',
      'The creature is undead and cannot be permanently killed',
    ],
  },
  'escort': {
    type: 'escort',
    nameTemplates: [
      'Escort {NAME}',
      'Guard {NAME} to {LOCATION}',
      'Protect {NAME}',
      'The {NAME} Escort',
      'Safeguard {NAME}',
    ],
    objectiveTemplates: [
      'Safely escort {NAME} to {LOCATION}',
      'Protect {NAME} from harm',
      'Ensure {NAME} arrives within {TIME}',
      'Defend {NAME} from attackers',
    ],
    rewardMultipliers: { gold: 0.9, xp: 0.9 },
    commonTwists: [
      'The escort is not who they claim',
      'The escort is being hunted by a powerful enemy',
      'The escort has a secret agenda',
      'The destination is not what was described',
      'The escort is cursed and dangerous to be near',
    ],
  },
  'investigate': {
    type: 'investigate',
    nameTemplates: [
      'Investigate the {EVENT}',
      'The Mystery of {LOCATION}',
      'Strange {EVENT}',
      'Uncover the Truth',
      'The {EVENT} Investigation',
    ],
    objectiveTemplates: [
      'Travel to {LOCATION} and investigate',
      'Find clues about the {EVENT}',
      'Question witnesses about {EVENT}',
      'Determine the cause of {EVENT}',
    ],
    rewardMultipliers: { gold: 0.7, xp: 1.2 },
    commonTwists: [
      'The investigation leads to the quest giver',
      'The mystery has supernatural causes',
      'The witnesses are unreliable or lying',
      'There is no crime - it\'s a cover-up',
      'The investigation reveals a larger conspiracy',
    ],
  },
  'deliver': {
    type: 'deliver',
    nameTemplates: [
      'Deliver the {ITEM}',
      'A Package for {NAME}',
      'The {ITEM} Delivery',
      'Courier Mission: {ITEM}',
      'Express Delivery to {LOCATION}',
    ],
    objectiveTemplates: [
      'Deliver {ITEM} to {NAME} at {LOCATION}',
      'Transport {ITEM} safely to {LOCATION}',
      'Deliver the message to {NAME}',
      'Bring {ITEM} before {TIME}',
    ],
    rewardMultipliers: { gold: 0.5, xp: 0.5 },
    commonTwists: [
      'The package is something dangerous',
      'The recipient is dead',
      'The package was stolen and must be recovered',
      'The package contains a surprise for the party',
      'Multiple parties want the package',
    ],
  },
  'rescue': {
    type: 'rescue',
    nameTemplates: [
      'Rescue {NAME}',
      'Save {NAME} from {LOCATION}',
      'The Captive {NAME}',
      'Prisoner of {CREATURE}',
      'Free {NAME}',
    ],
    objectiveTemplates: [
      'Rescue {NAME} from {LOCATION}',
      'Free {NAME} from captivity',
      'Bring {NAME} home safely',
      'Break {NAME} out of {LOCATION}',
    ],
    rewardMultipliers: { gold: 1.1, xp: 1.1 },
    commonTwists: [
      'The captive doesn\'t want to be rescued',
      'The captive is a prisoner for good reason',
      'The captive is a shapeshifter',
      'Multiple captives, only one can be saved',
      'The captive is the quest giver in disguise',
    ],
  },
  'defend': {
    type: 'defend',
    nameTemplates: [
      'Defend {LOCATION}',
      'Protect {LOCATION}',
      'The Siege of {LOCATION}',
      'Hold {LOCATION}',
      'Guard Duty at {LOCATION}',
    ],
    objectiveTemplates: [
      'Defend {LOCATION} for {TIME}',
      'Protect {LOCATION} from attackers',
      'Hold the line at {LOCATION}',
      'Prevent enemies from entering {LOCATION}',
    ],
    rewardMultipliers: { gold: 1, xp: 1 },
    commonTwists: [
      'The attackers have a legitimate claim',
      'The location is already compromised',
      'The attackers are undead and will return',
      'A traitor within the defenses',
      'The true threat comes from within',
    ],
  },
  'explore': {
    type: 'explore',
    nameTemplates: [
      'Explore {LOCATION}',
      'Map the {LOCATION}',
      'Into the {LOCATION}',
      'The {LOCATION} Expedition',
      'Discover the Secrets of {LOCATION}',
    ],
    objectiveTemplates: [
      'Explore {LOCATION} and map it',
      'Find what lies within {LOCATION}',
      'Survey the {LOCATION}',
      'Reach the heart of {LOCATION}',
    ],
    rewardMultipliers: { gold: 0.6, xp: 1.5 },
    commonTwists: [
      'The location doesn\'t exist',
      'The location is already inhabited',
      'The location moves or changes',
      'The location is another plane',
      'The location exists outside of time',
    ],
  },
  'diplomacy': {
    type: 'diplomacy',
    nameTemplates: [
      'Negotiate with {FACTION}',
      'Peace with {FACTION}',
      'The {FACTION} Embassy',
      'Diplomatic Mission to {FACTION}',
      'Treaty with {FACTION}',
    ],
    objectiveTemplates: [
      'Negotiate a treaty with {FACTION}',
      'Convince {FACTION} to {ACTION}',
      'Mediate between {FACTION} and {FACTION2}',
      'Establish relations with {FACTION}',
    ],
    rewardMultipliers: { gold: 0.5, xp: 1.3 },
    commonTwists: [
      'Neither side wants peace',
      'The party is blamed for failed negotiations',
      'A third party is sabotaging negotiations',
      'The quest giver doesn\'t actually want peace',
      'The opposing faction is right',
    ],
  },
  'puzzle': {
    type: 'puzzle',
    nameTemplates: [
      'The {ARTIFACT} Puzzle',
      'Solve the Riddle of {LOCATION}',
      'The Enigma of {NAME}',
      'Unlock the {ARTIFACT}',
      'The {LOCATION} Conundrum',
    ],
    objectiveTemplates: [
      'Solve the puzzle protecting {ARTIFACT}',
      'Decipher the ancient riddle',
      'Unlock the sealed door',
      'Figure out the pattern',
    ],
    rewardMultipliers: { gold: 0.7, xp: 1.5 },
    commonTwists: [
      'The puzzle has no solution',
      'The puzzle requires sacrifice',
      'The solution changes each attempt',
      'Solving it releases something terrible',
      'The puzzle was already solved',
    ],
  },
  'social': {
    type: 'social',
    nameTemplates: [
      'Infiltrate {FACTION}',
      'The {EVENT} Ball',
      'Socialize with {NAME}',
      'The {EVENT} Festival',
      'Gain {FACTION} Trust',
    ],
    objectiveTemplates: [
      'Infiltrate {FACTION} and gather information',
      'Attend {EVENT} and find {NAME}',
      'Gain access to the exclusive {EVENT}',
      'Win the trust of {NAME}',
    ],
    rewardMultipliers: { gold: 0.5, xp: 1.2 },
    commonTwists: [
      'The party is recognized by someone',
      'The target suspects the party',
      'The party enjoys the company of enemies',
      'The party becomes the target of intrigue',
      'The social event is a cover for something darker',
    ],
  },
  'multi-stage': {
    type: 'multi-stage',
    nameTemplates: [
      'The {PROPHECY} Saga',
      'The {ANTAGONIST} Crisis',
      'The {ARTIFACT} Chronicles',
      'Quest for the {ARTIFACT}',
      'The {FACTION} War',
    ],
    objectiveTemplates: [
      'Begin the journey',
      'Complete the first stage',
      'Gather allies for the final confrontation',
      'Face the ultimate challenge',
    ],
    rewardMultipliers: { gold: 2, xp: 2 },
    commonTwists: [
      'An ally becomes an enemy',
      'A minor quest becomes central',
      'The true antagonist is revealed',
      'The party must make an impossible choice',
      'The quest was started by the enemy',
    ],
  },
  'dungeon-delve': {
    type: 'dungeon-delve',
    nameTemplates: [
      'Delve into {DUNGEON}',
      'The {DUNGEON} Expedition',
      'Clear {DUNGEON}',
      'Secrets of {DUNGEON}',
      'Into {DUNGEON}',
    ],
    objectiveTemplates: [
      'Enter {DUNGEON} and defeat its master',
      'Clear {DUNGEON} of monsters',
      'Retrieve the treasure from {DUNGEON}',
      'Explore the depths of {DUNGEON}',
    ],
    rewardMultipliers: { gold: 1.5, xp: 1.5 },
    commonTwists: [
      'The dungeon connects to another plane',
      'The dungeon is alive',
      'The dungeon is a construct',
      'The dungeon shifts when unobserved',
      'The dungeon was built to keep something in, not out',
    ],
  },
};

// ============================================================================
// PLOT HOOK GENERATION
// ============================================================================

const PLOT_HOOKS: Array<{
  hook: string;
  questType: QuestType;
  urgency: PlotHook['urgency'];
  tier: QuestTier;
}> = [
  {
    hook: 'A desperate parent hires the party to find their missing child, last seen heading toward the old forest.',
    questType: 'rescue',
    urgency: 'high',
    tier: 'local',
  },
  {
    hook: 'The local priest reports that holy artifacts have been disappearing from the temple.',
    questType: 'investigate',
    urgency: 'medium',
    tier: 'local',
  },
  {
    hook: 'A merchant caravan was attacked on the main road. Survivors speak of coordinated, intelligent ambush.',
    questType: 'investigate',
    urgency: 'high',
    tier: 'regional',
  },
  {
    hook: 'The king\'s advisor has been found murdered. Evidence points to a foreign power.',
    questType: 'investigate',
    urgency: 'critical',
    tier: 'national',
  },
  {
    hook: 'A wealthy noble offers a fortune for anyone who can retrieve a family heirloom from a haunted mansion.',
    questType: 'fetch',
    urgency: 'low',
    tier: 'local',
  },
  {
    hook: 'Villages are being evacuated as a dragon\'s lair is discovered in nearby mountains.',
    questType: 'kill',
    urgency: 'critical',
    tier: 'regional',
  },
  {
    hook: 'A scholar has discovered clues to an ancient vault said to contain knowledge of the gods.',
    questType: 'explore',
    urgency: 'low',
    tier: 'continental',
  },
  {
    hook: 'Two city-states are on the brink of war. The party is hired to prevent the conflict.',
    questType: 'diplomacy',
    urgency: 'critical',
    tier: 'national',
  },
  {
    hook: 'People are disappearing from their beds at night. No one hears a thing.',
    questType: 'investigate',
    urgency: 'high',
    tier: 'local',
  },
  {
    hook: 'A mysterious stranger offers the party a map to incredible treasure, but refuses to join them.',
    questType: 'dungeon-delve',
    urgency: 'medium',
    tier: 'regional',
  },
  {
    hook: 'The dead are rising in the local cemetery. The priest cannot determine the cause.',
    questType: 'investigate',
    urgency: 'high',
    tier: 'local',
  },
  {
    hook: 'A portal to the Elemental Plane of Fire has opened in the city square.',
    questType: 'defend',
    urgency: 'critical',
    tier: 'planar',
  },
  {
    hook: 'An ancient prophecy speaks of impending doom. The signs are appearing.',
    questType: 'multi-stage',
    urgency: 'medium',
    tier: 'continental',
  },
  {
    hook: 'A thieves\' guild competition has begun. The prize: a position of power.',
    questType: 'social',
    urgency: 'medium',
    tier: 'local',
  },
  {
    hook: 'A child has been born with a magical mark. Cults are already hunting for them.',
    questType: 'escort',
    urgency: 'high',
    tier: 'national',
  },
  {
    hook: 'The dwarven hold has fallen silent. Trade caravans have stopped coming.',
    questType: 'investigate',
    urgency: 'medium',
    tier: 'regional',
  },
  {
    hook: 'A wizard needs rare components from a dangerous swamp for a vital ritual.',
    questType: 'fetch',
    urgency: 'medium',
    tier: 'local',
  },
  {
    hook: 'The party is invited to a masquerade ball where assassination is planned.',
    questType: 'social',
    urgency: 'high',
    tier: 'national',
  },
  {
    hook: 'A portal has been discovered leading to a lost civilization.',
    questType: 'explore',
    urgency: 'low',
    tier: 'planar',
  },
  {
    hook: 'An ancient lich has begun gathering an army. The forces of good must unite.',
    questType: 'multi-stage',
    urgency: 'critical',
    tier: 'continental',
  },
  {
    hook: 'A local lord has outlawed adventuring. The party must work in secret.',
    questType: 'investigate',
    urgency: 'medium',
    tier: 'local',
  },
];

/**
 * Generate a plot hook
 */
export function generatePlotHook(options?: {
  questType?: QuestType;
  tier?: QuestTier;
  urgency?: PlotHook['urgency'];
}): PlotHook {
  let availableHooks = [...PLOT_HOOKS];

  if (options?.questType) {
    availableHooks = availableHooks.filter(h => h.questType === options.questType);
  }
  if (options?.tier) {
    availableHooks = availableHooks.filter(h => h.tier === options.tier);
  }
  if (options?.urgency) {
    availableHooks = availableHooks.filter(h => h.urgency === options.urgency);
  }

  if (availableHooks.length === 0) {
    availableHooks = [...PLOT_HOOKS];
  }

  const selected = randomElement(availableHooks);

  return {
    hook: selected.hook,
    urgency: options?.urgency || selected.urgency,
    mystery: generateMystery(),
    twist: generateTwist(selected.questType),
    connections: generateConnections(),
  };
}

/**
 * Generate mystery element
 */
function generateMystery(): string {
  const mysteries = [
    'There are no witnesses to the event.',
    'All records of this place have been destroyed.',
    'No one remembers the person in question.',
    'The event occurred at an impossible time.',
    'Physical evidence contradicts witness accounts.',
    'Magic signatures don\'t match any known spell.',
    'The location appears on no map.',
    'Local legends speak of this happening before.',
    'The event should have been impossible.',
    'Those involved cannot remember anything.',
  ];

  return randomElement(mysteries);
}

/**
 * Generate plot twist
 */
function generateTwist(questType: QuestType): string {
  const template = QUEST_TEMPLATES[questType];
  if (template && template.commonTwists.length > 0) {
    return randomElement(template.commonTwists);
  }

  const generalTwists = [
    'The quest giver is the true villain',
    'The reward is a trap',
    'The situation was fabricated',
    'The party has been manipulated',
    'An ally has betrayed them',
    'The target doesn\'t exist',
    'The party is the quest',
    'Time is running backwards',
    'The party is already dead',
    'Everything is a test',
  ];

  return randomElement(generalTwists);
}

/**
 * Generate plot connections
 */
function generateConnections(): string[] {
  const connections = [
    'Connected to the main plot',
    'Part of a larger conspiracy',
    'Related to a party member\'s background',
    'Connected to an ancient prophecy',
    'Tied to a powerful artifact',
    'Related to the primary antagonist',
    'Part of ongoing faction conflict',
    'Connected to divine interference',
  ];

  const count = 1 + Math.floor(Math.random() * 2);
  return shuffleArray([...connections]).slice(0, count);
}

// ============================================================================
// QUEST GIVER GENERATION
// ============================================================================

const QUEST_GIVERS: Record<QuestGiverType, {
  names: string[];
  locations: string[];
  motivations: string[];
}> = {
  'noble': {
    names: ['Lord', 'Lady', 'Baron', 'Duchess', 'Duke', 'Count', 'Countess', 'Sir'],
    locations: ['Manor', 'Estate', 'Castle', 'Palace', 'Court'],
    motivations: [
      'Protect family honor',
      'Acquire political leverage',
      'Settle a debt',
      'Protect a secret',
      'Expand influence',
    ],
  },
  'merchant': {
    names: ['Master Trader', 'Merchant', 'Shopkeeper', 'Artisan', 'Craftsman', 'Trader'],
    locations: ['Market', 'Shop', 'Warehouse', 'Guildhall', 'Caravan'],
    motivations: [
      'Protect business interests',
      'Recover lost merchandise',
      'Eliminate competition',
      'Find new opportunities',
      'Pay off debts',
    ],
  },
  'priest': {
    names: ['Priest', 'Priestess', 'Abbot', 'Abbess', 'High Priest', 'Cleric', 'Oracle'],
    locations: ['Temple', 'Shrine', 'Church', 'Abbey', 'Monastery'],
    motivations: [
      'Serve the deity\'s will',
      'Protect the faithful',
      'Recover holy artifacts',
      'Stop heresy',
      'Convert non-believers',
    ],
  },
  'mysterious-stranger': {
    names: ['Hooded Figure', 'Traveler', 'Wanderer', 'Unknown', 'The Mysterious'],
    locations: ['Tavern', 'Roadside', 'Dark Alley', 'Crossroads', 'Ruins'],
    motivations: [
      'Unknown',
      'Personal vengeance',
      'Redemption',
      'Hidden agenda',
      'Testing the party',
    ],
  },
  'desperate-peasant': {
    names: ['Villager', 'Farmer', 'Commoner', 'Parent', 'Survivor'],
    locations: ['Village', 'Farm', 'Refugee Camp', 'Slums', 'Street'],
    motivations: [
      'Save a loved one',
      'Protect the community',
      'Survive another day',
      'Escape oppression',
      'Find hope',
    ],
  },
  'guard-captain': {
    names: ['Captain', 'Commander', 'Sheriff', 'Watch Captain', 'Sergeant'],
    locations: ['Barracks', 'Guardhouse', 'Town Hall', 'Prison', 'Outpost'],
    motivations: [
      'Maintain order',
      'Protect the city',
      'Follow orders',
      'Seek justice',
      'Prevent chaos',
    ],
  },
  'scholar': {
    names: ['Sage', 'Wizard', 'Professor', 'Researcher', 'Archivist', 'Astrologer'],
    locations: ['Library', 'University', 'Tower', 'Laboratory', 'Archive'],
    motivations: [
      'Pursue knowledge',
      'Discover lost secrets',
      'Prove a theory',
      'Document history',
      'Find forbidden knowledge',
    ],
  },
  'criminal': {
    names: ['Thief', 'Smuggler', 'Crime Lord', 'Assassin', 'Fence', 'Rogue'],
    locations: ['Hideout', 'Tavern Backroom', 'Underground', 'Thieves\' Guild'],
    motivations: [
      'Personal gain',
      'Revenge',
      'Freedom from prison',
      'Gain power',
      'Pay off a debt',
    ],
  },
  'fellow-adventurer': {
    names: ['Adventurer', 'Mercenary', 'Hero', 'Explorer', 'Veteran'],
    locations: ['Tavern', 'Adventuring Guild', 'Road', 'Camp', 'Dungeon Entrance'],
    motivations: [
      'Need help for a difficult task',
      'Share a bounty',
      'Too old to continue alone',
      'Build alliances',
      'Test potential allies',
    ],
  },
  'deity': {
    names: ['Godly Messenger', 'Avatar', 'Divine Servant', 'Prophet'],
    locations: ['Temple', 'Vision', 'Dream', 'Sacred Site', 'Celestial Realm'],
    motivations: [
      'Divine will',
      'Mortal intervention required',
      'Test the faithful',
      'Correct an imbalance',
      'Prepare for prophecy',
    ],
  },
  'organization': {
    names: ['Guild Representative', 'Faction Leader', 'Order Member', 'Agent'],
    locations: ['Guildhall', 'Secret Base', 'Headquarters', 'Chapter House'],
    motivations: [
      'Further organizational goals',
      'Recruit new members',
      'Complete faction mission',
      'Gather intelligence',
      'Expand influence',
    ],
  },
  'spirit': {
    names: ['Ghost', 'Spirit', 'Specter', 'Ancestor', 'Spirit Guide'],
    locations: ['Graveyard', 'Haunted Site', 'Dream', 'Spirit Realm', 'Place of Death'],
    motivations: [
      'Find peace',
      'Complete unfinished business',
      'Avenge a wrong',
      'Protect the living',
      'Deliver a message',
    ],
  },
};

/**
 * Generate a quest giver
 */
export function generateQuestGiver(type?: QuestGiverType): Quest['questGiver'] {
  const giverType = type || randomElement(Object.keys(QUEST_GIVERS) as QuestGiverType[]);
  const data = QUEST_GIVERS[giverType];

  return {
    name: `${randomElement(data.names)} ${generateRandomName()}`,
    type: giverType,
    location: randomElement(data.locations),
    motivation: randomElement(data.motivations),
  };
}

/**
 * Generate a random name
 */
function generateRandomName(): string {
  const names = [
    'Aldric', 'Bram', 'Cedric', 'Darian', 'Edmund', 'Gareth', 'Hadrian', 'Ivan',
    'Jasper', 'Kellan', 'Lorcan', 'Marcus', 'Nolan', 'Osric', 'Percival',
    'Adeline', 'Beatrice', 'Cordelia', 'Diana', 'Eleanor', 'Fiona', 'Genevieve',
  ];
  return randomElement(names);
}

// ============================================================================
// QUEST OBJECTIVE GENERATION
// ============================================================================

/**
 * Generate quest objectives
 */
export function generateQuestObjectives(
  questType: QuestType,
  template: QuestTemplate
): QuestObjective[] {
  const objectives: QuestObjective[] = [];

  // Main objective
  const mainObjective: QuestObjective = {
    id: 'main',
    description: fillTemplate(randomElement(template.objectiveTemplates)),
    type: getObjectiveType(questType),
    completed: false,
  };

  objectives.push(mainObjective);

  // Optional objectives based on quest type
  const optionalObjectives = generateOptionalObjectives(questType);
  objectives.push(...optionalObjectives);

  return objectives;
}

/**
 * Get objective type from quest type
 */
function getObjectiveType(questType: QuestType): QuestObjective['type'] {
  const typeMap: Record<QuestType, QuestObjective['type']> = {
    'fetch': 'collect',
    'kill': 'kill',
    'escort': 'escort',
    'investigate': 'investigate',
    'deliver': 'deliver',
    'rescue': 'escort',
    'defend': 'protect',
    'explore': 'go-to',
    'diplomacy': 'talk-to',
    'puzzle': 'solve',
    'social': 'talk-to',
    'multi-stage': 'go-to',
    'dungeon-delve': 'go-to',
  };

  return typeMap[questType] || 'go-to';
}

/**
 * Generate optional objectives
 */
function generateOptionalObjectives(questType: QuestType): QuestObjective[] {
  const optional: QuestObjective[] = [];

  // Optional: Find lore
  if (Math.random() > 0.6) {
    optional.push({
      id: 'lore',
      description: 'Discover the truth behind these events',
      type: 'investigate',
      completed: false,
      optional: true,
    });
  }

  // Optional: Side challenges
  if (Math.random() > 0.7) {
    const sideObjectives: Record<QuestType, string> = {
      'fetch': 'Find bonus treasure',
      'kill': 'Defeat enemies without being detected',
      'escort': 'Keep the escort uninjured',
      'investigate': 'Find additional evidence',
      'deliver': 'Deliver early for bonus',
      'rescue': 'Rescue additional captives',
      'defend': 'Defend without casualties',
      'explore': 'Map the entire area',
      'diplomacy': 'Secure additional concessions',
      'puzzle': 'Solve without hints',
      'social': 'Impress important guests',
      'multi-stage': 'Complete bonus objectives',
      'dungeon-delve': 'Find all secret areas',
    };

    optional.push({
      id: 'bonus',
      description: sideObjectives[questType],
      type: 'go-to',
      completed: false,
      optional: true,
    });
  }

  return optional;
}

/**
 * Fill template with random values
 */
function fillTemplate(template: string): string {
  const replacements: Record<string, string[]> = {
    '{ITEM}': ['ancient sword', 'stolen jewels', 'holy relic', 'cursed amulet', 'family heirloom', 'rare tome', 'magic ring'],
    '{LOCATION}': ['the old forest', 'the abandoned mine', 'the haunted mansion', 'the mountain pass', 'the sunken temple', 'the ruined castle', 'the dark cave'],
    '{NAME}': ['the merchant\'s daughter', 'the missing scholar', 'the local priest', 'the wealthy noble', 'the traveling merchant', 'the old hermit'],
    '{CREATURE}': ['dragon', 'bandit leader', 'troll', 'necromancer', 'werewolf', 'vampire', 'giant spider'],
    '{EVENT}': ['disappearances', 'murders', 'thefts', 'strange lights', 'hauntings', 'attacks', 'earthquakes'],
    '{TIME}': ['dawn', 'sundown', 'three days', 'one week', 'midnight', 'the full moon'],
    '{FACTION}': ['the Thieves\' Guild', 'the Merchant Council', 'the Royal Family', 'the Temple', 'the Arcane Order', 'the local militia'],
    '{FACTION2}': ['the rival guild', 'the foreign power', 'the cultists', 'the rebels', 'the nobility'],
    '{ACTION}': ['end the hostilities', 'join the alliance', 'abandon their conquest', 'release the prisoners', 'pay reparations'],
    '{ARTIFACT}': ['Sphere of Annihilation', 'Hand of Vecna', 'Rod of Seven Parts', 'Crystal Heart', 'Ancient Crown'],
    '{PROPHECY}': ['Apocalyptic', 'Forgotten', 'Ancient', 'Chosen One', 'Doomsday'],
    '{ANTAGONIST}': ['Lich King', 'Dark Lord', 'Dragon Queen', 'Demon Prince', 'Vampire Lord'],
    '{DUNGEON}': ['Sunken Citadel', 'Cursed Crypt', 'Dragon\'s Lair', 'Forgotten Temple', 'Abyssal Vault'],
  };

  let result = template;
  for (const [key, values] of Object.entries(replacements)) {
    if (result.includes(key)) {
      result = result.replace(key, randomElement(values));
    }
  }

  return result;
}

// ============================================================================
// QUEST GENERATION
// ============================================================================

export interface GenerateQuestOptions {
  questType?: QuestType;
  tier?: QuestTier;
  rarity?: QuestRarity;
  questGiverType?: QuestGiverType;
  recommendedLevel?: { min: number; max: number };
}

/**
 * Generate a complete quest
 */
export function generateQuest(options: GenerateQuestOptions = {}): Quest {
  // Determine quest type
  const questType = options.questType || randomElement(Object.keys(QUEST_TEMPLATES) as QuestType[]);
  const template = QUEST_TEMPLATES[questType];

  // Determine tier and rarity
  const tier = options.tier || randomElement(['local', 'local', 'local', 'regional', 'regional', 'national'] as QuestTier[]);
  const rarity = options.rarity || randomElement(['common', 'common', 'uncommon', 'rare'] as QuestRarity[]);

  // Calculate rewards
  const goldReward = Math.floor(
    calculateGoldReward(tier, rarity) * template.rewardMultipliers.gold
  );
  const xpReward = Math.floor(
    calculateXpReward(tier, rarity) * template.rewardMultipliers.xp
  );

  // Generate quest name
  const questName = fillTemplate(randomElement(template.nameTemplates));

  // Generate plot hook
  const plotHook = generatePlotHook({ questType, tier });

  // Generate quest giver
  const questGiver = generateQuestGiver(options.questGiverType);

  // Generate objectives
  const objectives = generateQuestObjectives(questType, template);

  // Generate stages for multi-stage quests
  let stages: QuestStage[] = [];
  if (questType === 'multi-stage' || rarity === 'epic' || rarity === 'legendary') {
    stages = generateQuestStages(questType, 3 + Math.floor(Math.random() * 3));
  }

  // Generate recommended level
  const recommendedLevel = options.recommendedLevel || calculateRecommendedLevel(tier, rarity);

  // Generate tags
  const tags = generateTags(questType, tier, rarity);

  return {
    id: generateQuestId(),
    name: questName,
    type: questType,
    tier,
    rarity,
    status: 'available',
    description: generateQuestDescription(questType, questName, plotHook),
    plotHook,
    questGiver,
    objectives,
    stages,
    rewards: {
      gold: goldReward,
      experience: xpReward,
      items: generateRewardItems(rarity),
      reputation: generateReputationRewards(tier),
      special: generateSpecialRewards(rarity),
    },
    failureCondition: generateFailureCondition(questType),
    secretObjectives: generateSecretObjectives(rarity),
    recommendedLevel,
    tags,
  };
}

/**
 * Generate quest ID
 */
function generateQuestId(): string {
  return `quest-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/**
 * Generate quest description
 */
function generateQuestDescription(
  questType: QuestType,
  questName: string,
  plotHook: PlotHook
): string {
  const intros = [
    'A call for help has gone out.',
    'Adventure awaits those willing to answer.',
    'The situation grows more dire by the hour.',
    'Someone needs your particular skills.',
    'Fortune favors the bold.',
    'The fates have aligned.',
  ];

  return `${randomElement(intros)} ${questName}: ${plotHook.hook}`;
}

/**
 * Generate quest stages for multi-stage quests
 */
function generateQuestStages(questType: QuestType, count: number): QuestStage[] {
  const stages: QuestStage[] = [];

  const stageTypes = [
    { name: 'Gather Information', type: 'investigate' },
    { name: 'Make Preparations', type: 'go-to' },
    { name: 'Travel to Destination', type: 'go-to' },
    { name: 'Face Initial Challenges', type: 'kill' },
    { name: 'The Main Challenge', type: questType === 'kill' ? 'kill' : 'solve' },
    { name: 'Unexpected Complications', type: 'investigate' },
    { name: 'The Final Confrontation', type: 'kill' },
    { name: 'Return and Report', type: 'talk-to' },
    { name: 'Collect Rewards', type: 'talk-to' },
  ];

  for (let i = 0; i < count; i++) {
    const stageType = stageTypes[Math.min(i, stageTypes.length - 1)];

    stages.push({
      id: `stage-${i + 1}`,
      name: stageType.name,
      description: generateStageDescription(i, count),
      objectives: [
        {
          id: `stage-${i + 1}-obj`,
          description: `Complete this stage of the quest`,
          type: stageType.type,
          completed: false,
        },
      ],
      completionTrigger: i === count - 1 ? 'Complete all objectives' : undefined,
      nextStage: i < count - 1 ? `stage-${i + 2}` : undefined,
    });
  }

  return stages;
}

/**
 * Generate stage description
 */
function generateStageDescription(index: number, total: number): string {
  if (index === 0) return 'The journey begins. Gather what you need and set out.';
  if (index === total - 1) return 'The final challenge awaits. Victory is within reach.';
  return 'Continue forward. The path grows more dangerous.';
}

/**
 * Generate reward items
 */
function generateRewardItems(rarity: QuestRarity): string[] {
  const itemTemplates: Record<QuestRarity, string[]> = {
    'common': ['Potion of Healing', 'Basic equipment'],
    'uncommon': ['Potion of Greater Healing', 'Scroll of minor spell', '+1 weapon or armor'],
    'rare': ['Potion of Superior Healing', 'Scroll of moderate spell', '+2 weapon or armor', 'Magic item of your choice'],
    'epic': ['Potion of Supreme Healing', 'Scroll of powerful spell', '+3 weapon or armor', 'Rare magic item', 'Custom item creation'],
    'legendary': ['Artifact of power', 'Unique magic item', '+3 or better weapon or armor', 'Boon or special ability'],
  };

  const count = rarity === 'legendary' ? 3 : rarity === 'epic' ? 2 : 1;
  return shuffleArray([...(itemTemplates[rarity] || itemTemplates.common)]).slice(0, count);
}

/**
 * Generate reputation rewards
 */
function generateReputationRewards(tier: QuestTier): Array<{ faction: string; amount: number }> {
  const factions = ['Local Guild', 'Temple', 'Nobility', 'Common Folk', 'Adventurers', 'Merchants'];
  const faction = randomElement(factions);

  const amount: Record<QuestTier, number> = {
    'local': 5,
    'regional': 10,
    'national': 25,
    'continental': 50,
    'planar': 100,
  };

  return [{ faction, amount: amount[tier] }];
}

/**
 * Generate special rewards
 */
function generateSpecialRewards(rarity: QuestRarity): string[] {
  const special: Record<QuestRarity, string[]> = {
    'common': [],
    'uncommon': ['Discount on purchases', 'Free lodging'],
    'rare': ['Favor from noble', 'Access to restricted area', 'Training opportunity'],
    'epic': ['Title granted', 'Land ownership', 'Political influence', 'Contact with powerful entity'],
    'legendary': ['Divine boon', 'Epic reputation', 'Legend status', 'Immortalized in song'],
  };

  return special[rarity] || [];
}

/**
 * Generate failure condition
 */
function generateFailureCondition(questType: QuestType): string {
  const failures: Record<QuestType, string[]> = {
    'fetch': ['The item is destroyed', 'Another party claims the item first', 'The item is used for evil'],
    'kill': ['The target escapes and cannot be found again', 'Innocent casualties enrage the locals', 'The party is defeated'],
    'escort': ['The escort is killed', 'The escort abandons the party', 'The escort falls to enemy influence'],
    'investigate': ['Evidence is destroyed', 'The guilty parties destroy proof', 'The party is discovered and silenced'],
    'deliver': ['The package is intercepted', 'The package is destroyed', 'The recipient is dead'],
    'rescue': ['The captive is killed', 'The captive is corrupted', 'The party arrives too late'],
    'defend': ['The location falls', 'Too many civilian casualties', 'The defense is breached'],
    'explore': ['The party is trapped forever', 'The location collapses', 'The party loses their sanity'],
    'diplomacy': ['War is declared', 'The insulted faction declares vengeance', 'Negotiations break down irreparably'],
    'puzzle': ['The puzzle is solved incorrectly', 'The trap is triggered', 'Time runs out'],
    'social': ['The party is exposed as imposters', 'The event is ruined', 'The party makes a powerful enemy'],
    'multi-stage': ['A critical stage fails', 'The party abandons the quest', 'The ultimate goal becomes impossible'],
    'dungeon-delve': ['The dungeon claims the party', 'The treasure is lost', 'The dungeon collapses'],
  };

  return randomElement(failures[questType]);
}

/**
 * Generate secret objectives
 */
function generateSecretObjectives(rarity: QuestRarity): QuestObjective[] {
  if (rarity === 'common') return [];

  const secrets = [
    { description: 'Discover the true nature of the quest giver', type: 'investigate' as const },
    { description: 'Find out who is really behind the events', type: 'investigate' as const },
    { description: 'Recover evidence for later use', type: 'collect' as const },
    { description: 'Identify the traitor in the organization', type: 'investigate' as const },
    { description: 'Discover the connection to a larger plot', type: 'investigate' as const },
  ];

  const count = rarity === 'legendary' ? 2 : 1;
  const selected = shuffleArray([...secrets]).slice(0, count);

  return selected.map((s, i) => ({
    id: `secret-${i}`,
    ...s,
    completed: false,
    hidden: true,
  }));
}

/**
 * Generate quest tags
 */
function generateTags(questType: QuestType, tier: QuestTier, rarity: QuestRarity): string[] {
  const tags: string[] = [questType, tier, rarity];

  const additionalTags = [
    'Combat', 'Roleplay', 'Exploration', 'Puzzle', 'Social', 'Dangerous',
    'Time-Sensitive', 'Reputation', 'Money', 'Mystery', 'Horror', 'Political',
  ];

  const extraCount = 1 + Math.floor(Math.random() * 3);
  tags.push(...shuffleArray([...additionalTags]).slice(0, extraCount));

  return tags;
}

// ============================================================================
// QUEST CHAIN GENERATION
// ============================================================================

export interface QuestChain {
  name: string;
  description: string;
  quests: Quest[];
  finale: Quest;
  rewards: {
    chainBonus: string[];
    legendaryReward?: string;
  };
}

/**
 * Generate a chain of connected quests
 */
export function generateQuestChain(options?: {
  tier?: QuestTier;
  questCount?: number;
  theme?: string;
}): QuestChain {
  const tier = options?.tier || 'national';
  const questCount = options?.questCount || 4 + Math.floor(Math.random() * 3);

  const quests: Quest[] = [];

  // Generate chain themes
  const themes = [
    { name: 'The Cult Conspiracy', types: ['investigate', 'fetch', 'kill', 'dungeon-delve'] },
    { name: 'The Dragon War', types: ['escort', 'kill', 'defend', 'kill'] },
    { name: 'The Royal Succession', types: ['investigate', 'social', 'diplomacy', 'defend'] },
    { name: 'The Ancient Curse', types: ['investigate', 'fetch', 'puzzle', 'rescue'] },
    { name: 'The Invasion', types: ['investigate', 'defend', 'kill', 'multi-stage'] },
    { name: 'The Lost Artifact', types: ['investigate', 'explore', 'fetch', 'dungeon-delve'] },
  ];

  const theme = options?.theme || randomElement(themes);
  const questTypes = theme.types as QuestType[];

  // Generate individual quests
  for (let i = 0; i < questCount - 1; i++) {
    const quest = generateQuest({
      questType: questTypes[Math.min(i, questTypes.length - 1)],
      tier,
      rarity: i === 0 ? 'common' : i < questCount - 2 ? 'uncommon' : 'rare',
    });

    quest.name = `${theme.name}: Part ${i + 1} - ${quest.name}`;
    quest.description = `${theme.name} continues. ${quest.description}`;
    quests.push(quest);
  }

  // Generate finale
  const finale = generateQuest({
    questType: 'multi-stage',
    tier,
    rarity: 'legendary',
  });
  finale.name = `${theme.name}: Finale - ${finale.name}`;

  return {
    name: theme.name,
    description: `An epic ${tier} adventure spanning multiple quests.`,
    quests,
    finale,
    rewards: {
      chainBonus: [
        'Increased reputation with all factions involved',
        'Access to secret areas',
        'Legendary title',
      ],
      legendaryReward: 'Boon of your choice',
    },
  };
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

export const QuestGen = {
  generateQuest,
  generateQuestChain,
  generatePlotHook,
  generateQuestGiver,
  generateQuestObjectives,
  calculateGoldReward,
  calculateXpReward,
  calculateRecommendedLevel,
  QUEST_TEMPLATES,
  PLOT_HOOKS,
  QUEST_GIVERS,
};

export default QuestGen;
