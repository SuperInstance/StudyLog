/**
 * DMLoG.AI - Encounter Generation System
 *
 * Procedural combat encounter generation using:
 * - Deterministic math for CR calculations, XP budgets, encounter multipliers
 * - AI for creative creature combinations, tactics, and environmental elements
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

export const CreatureRoleSchema = z.enum([
  'soldier',      // Frontline tank, high AC/HP
  'skirmisher',   // Mobile, hit-and-run tactics
  'artillery',    // Ranged damage, vulnerable in melee
  'controller',   // AoE, debuffs, crowd control
  'support',      // Buffing, healing allies
  'brute',        // High damage, low accuracy
  'leader',       // Buffs allies, tactical commands
  'minion',       // Low HP, quantity over quality
]);

export const CreatureSchema = z.object({
  name: z.string(),
  cr: z.number(),
  role: CreatureRoleSchema,
  hp: z.number(),
  ac: z.number(),
  stats: z.object({
    str: z.number(),
    dex: z.number(),
    con: z.number(),
    int: z.number(),
    wis: z.number(),
    cha: z.number(),
  }),
  abilities: z.array(z.string()),
  immunities: z.array(z.string()).default([]),
  resistances: z.array(z.string()).default([]),
  vulnerabilities: z.array(z.string()).default([]),
});

export const EncounterDifficultySchema = z.enum([
  'easy',
  'medium',
  'hard',
  'deadly',
]);

export const PartyCompositionSchema = z.object({
  level: z.number(),
  size: z.number(),
  averageHp: z.number().optional(),
  classes: z.array(z.string()).optional(),
});

export const EnvironmentEffectSchema = z.object({
  name: z.string(),
  description: z.string(),
  impact: z.enum(['favor-players', 'favor-enemies', 'neutral', 'mixed']),
  mechanics: z.array(z.string()),
});

export const EncounterSchema = z.object({
  name: z.string(),
  difficulty: EncounterDifficultySchema,
  xpBudget: z.number(),
  actualXp: z.number(),
  creatures: z.array(z.object({
    creature: CreatureSchema,
    count: z.number(),
    tactic: z.string().optional(),
  })),
  environment: z.object({
    terrain: z.string(),
    effects: z.array(EnvironmentEffectSchema),
    tacticalFeatures: z.array(z.string()),
  }),
  victoryCondition: z.string().optional(),
  defeatCondition: z.string().optional(),
  escalation: z.array(z.string()).optional(), // What happens if the battle drags on
  notes: z.string().optional(),
});

export type CreatureRole = z.infer<typeof CreatureRoleSchema>;
export type Creature = z.infer<typeof CreatureSchema>;
export type EncounterDifficulty = z.infer<typeof EncounterDifficultySchema>;
export type PartyComposition = z.infer<typeof PartyCompositionSchema>;
export type EnvironmentEffect = z.infer<typeof EnvironmentEffectSchema>;
export type Encounter = z.infer<typeof EncounterSchema>;

// ============================================================================
// XP BUDGET CALCULATIONS (D&D 5e SRD Based)
// ============================================================================

const XP_BY_CR: Record<number, number> = {
  0: 10,
  0.125: 25,
  0.25: 50,
  0.5: 100,
  1: 200,
  2: 450,
  3: 700,
  4: 1100,
  5: 1800,
  6: 2300,
  7: 2900,
  8: 3900,
  9: 5000,
  10: 5900,
  11: 7200,
  12: 8400,
  13: 10000,
  14: 11500,
  15: 13000,
  16: 15000,
  17: 18000,
  18: 20000,
  19: 22000,
  20: 25000,
  21: 33000,
  22: 41000,
  23: 50000,
  24: 62000,
  25: 75000,
  26: 90000,
  27: 105000,
  28: 120000,
  29: 135000,
  30: 155000,
};

const XP_BY_LEVEL: Record<number, number> = {
  1: 25,
  2: 50,
  3: 75,
  4: 125,
  5: 250,
  6: 300,
  7: 350,
  8: 450,
  9: 550,
  10: 600,
  11: 800,
  12: 1000,
  13: 1100,
  14: 1300,
  15: 1400,
  16: 1500,
  17: 1800,
  18: 2000,
  19: 2200,
  20: 2500,
};

const DIFFICULTY_MULTIPLIERS: Record<EncounterDifficulty, number> = {
  easy: 1,
  medium: 1,
  hard: 1,
  deadly: 1,
};

/**
 * Calculate the XP threshold for a given party level and count, by difficulty
 */
export function calculateXpThreshold(
  partyLevel: number,
  partySize: number,
  difficulty: EncounterDifficulty
): number {
  const baseXp = XP_BY_LEVEL[partyLevel] || XP_BY_LEVEL[20];
  const multiplier = DIFFICULTY_MULTIPLIERS[difficulty];
  return baseXp * partySize * multiplier;
}

/**
 * Get the encounter multiplier based on number of monsters
 * Adjusts XP budget for action economy
 */
export function getEncounterMultiplier(monsterCount: number): number {
  if (monsterCount === 1) return 1;
  if (monsterCount === 2) return 1.5;
  if (monsterCount === 3) return 2;
  if (monsterCount <= 6) return 2.5;
  if (monsterCount <= 10) return 3;
  if (monsterCount <= 14) return 4;
  return 5;
}

/**
 * Calculate adjusted XP for a creature considering action economy
 */
export function calculateAdjustedXp(creatureCr: number, monsterCount: number): number {
  const baseXp = XP_BY_CR[creatureCr] || 0;
  const multiplier = getEncounterMultiplier(monsterCount);
  return Math.floor(baseXp * multiplier);
}

/**
 * Determine if encounter would be deadly based on adjusted XP vs party
 */
export function assessEncounterDeadliness(
  creatures: Array<{ cr: number; count: number }>,
  partyLevel: number,
  partySize: number
): {
  isDeadly: boolean;
  adjustedXp: number;
  deadlyThreshold: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
} {
  const totalMonsters = creatures.reduce((sum, c) => sum + c.count, 0);
  const multiplier = getEncounterMultiplier(totalMonsters);

  const adjustedXp = creatures.reduce((sum, c) => {
    return sum + (XP_BY_CR[c.cr] || 0) * c.count;
  }, 0) * multiplier;

  const deadlyThreshold = calculateXpThreshold(partyLevel, partySize, 'deadly');

  const ratio = adjustedXp / deadlyThreshold;

  let riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  if (ratio < 0.5) riskLevel = 'low';
  else if (ratio < 0.9) riskLevel = 'moderate';
  else if (ratio < 1.3) riskLevel = 'high';
  else riskLevel = 'extreme';

  return {
    isDeadly: ratio >= 1,
    adjustedXp: Math.floor(adjustedXp),
    deadlyThreshold,
    riskLevel,
  };
}

// ============================================================================
// ROLE-BASED ENEMY SELECTION
// ============================================================================

/**
 * Suggested creature composition based on role and encounter size
 */
export const ROLE_COMPOSITIONS: Record<string, Array<{ role: CreatureRole; ratio: number }>> = {
  // Single creature - needs to be solo-capable
  solo: [
    { role: 'brute', ratio: 1 },
    { role: 'leader', ratio: 1 },
  ],

  // Small encounter (2-3 creatures)
  small: [
    { role: 'soldier', ratio: 0.4 },
    { role: 'skirmisher', ratio: 0.3 },
    { role: 'artillery', ratio: 0.3 },
  ],

  // Medium encounter (4-6 creatures)
  medium: [
    { role: 'soldier', ratio: 0.3 },
    { role: 'skirmisher', ratio: 0.3 },
    { role: 'artillery', ratio: 0.2 },
    { role: 'minion', ratio: 0.2 },
  ],

  // Large encounter (7-10 creatures)
  large: [
    { role: 'soldier', ratio: 0.25 },
    { role: 'leader', ratio: 0.1 },
    { role: 'skirmisher', ratio: 0.25 },
    { role: 'artillery', ratio: 0.2 },
    { role: 'minion', ratio: 0.2 },
  ],

  // Horde encounter (11+ creatures)
  horde: [
    { role: 'minion', ratio: 0.6 },
    { role: 'soldier', ratio: 0.15 },
    { role: 'skirmisher', ratio: 0.15 },
    { role: 'leader', ratio: 0.1 },
  ],
};

/**
 * Calculate optimal creature count for XP budget
 */
export function calculateCreatureCount(
  xpBudget: number,
  averageCr: number,
  targetDifficulty: EncounterDifficulty
): number {
  const baseXp = XP_BY_CR[averageCr] || XP_BY_CR[1];
  const unadjustedCount = Math.max(1, Math.floor(xpBudget / baseXp));

  // Apply encounter multiplier "in reverse" to find actual count
  const multiplier = getEncounterMultiplier(unadjustedCount);
  const adjustedCount = Math.max(1, Math.floor(unadjustedCount / multiplier));

  return adjustedCount;
}

// ============================================================================
// CREATURE STAT BLOCK GENERATION
// ============================================================================

/**
 * Calculate proficiency bonus for a given CR
 */
export function getProficiencyBonus(cr: number): number {
  return Math.max(2, Math.ceil(cr / 4) + 1);
}

/**
 * Calculate expected AC for a creature by CR and role
 */
export function calculateExpectedAc(cr: number, role: CreatureRole): number {
  const baseAc = 13 + Math.floor(cr / 2);

  const roleAdjustment: Record<CreatureRole, number> = {
    soldier: 2,
    skirmisher: 0,
    artillery: -1,
    controller: 0,
    support: 0,
    brute: -2,
    leader: 1,
    minion: -1,
  };

  return baseAc + (roleAdjustment[role] || 0);
}

/**
 * Calculate expected HP for a creature by CR and role
 */
export function calculateExpectedHp(cr: number, role: CreatureRole): number {
  const baseHp = Math.floor(15 + cr * 15);

  const roleMultiplier: Record<CreatureRole, number> = {
    soldier: 1.5,
    skirmisher: 0.9,
    artillery: 0.7,
    controller: 0.8,
    support: 1.0,
    brute: 1.3,
    leader: 1.2,
    minion: 0.3,
  };

  return Math.floor(baseHp * (roleMultiplier[role] || 1));
}

/**
 * Calculate attack bonus for a creature by CR
 */
export function calculateAttackBonus(cr: number, role: CreatureRole): number {
  const base = getProficiencyBonus(cr) + Math.floor(cr / 2);

  const roleAdjustment: Record<CreatureRole, number> = {
    soldier: 2,
    skirmisher: 3,
    artillery: 4,
    controller: 3,
    support: 2,
    brute: 0,
    leader: 3,
    minion: 0,
  };

  return base + (roleAdjustment[role] || 0);
}

/**
 * Calculate damage per round for a creature by CR
 */
export function calculateDpr(cr: number, role: CreatureRole): number {
  const base = Math.floor(5 + cr * 5);

  const roleMultiplier: Record<CreatureRole, number> = {
    soldier: 1.2,
    skirmisher: 1.0,
    artillery: 1.3,
    controller: 0.7,
    support: 0.5,
    brute: 1.5,
    leader: 0.8,
    minion: 0.3,
  };

  return Math.floor(base * (roleMultiplier[role] || 1));
}

/**
 * Calculate save DC for a creature's abilities
 */
export function calculateSaveDc(cr: number, primaryStat: number): number {
  return 8 + getProficiencyBonus(cr) + primaryStat;
}

// ============================================================================
// TACTICAL AI GENERATION
// ============================================================================

export const TACTICAL_TEMPLATES: Record<CreatureRole, string[]> = {
  soldier: [
    'Hold the front line against the toughest-looking foe',
    'Protect more vulnerable allies with body interposition',
    'Use {REACTION} to punish attacks on allies',
    'Focus on one target until it falls, then switch',
  ],
  skirmisher: [
    'Hit and run: attack then move away',
    'Flank with allies for advantage',
    'Disengage after attacking to avoid opportunity attacks',
    'Target isolated or weaker foes first',
  ],
  artillery: [
    'Maintain maximum distance from enemies',
    'Use elevation for better line of sight',
    'Prioritize targets threatening other ranged allies',
    'Relocate when melee enemies close in',
  ],
  controller: [
    'Cluster enemies for AoE abilities',
    'Focus on disrupting enemy spellcasters',
    'Use crowd control to protect allies',
    'Target groups over single foes',
  ],
  support: [
    'Prioritize healing or buffing the leader',
    'Stay behind the frontline',
    'Use beneficial abilities early in combat',
    'Focus on keeping key allies in the fight',
  ],
  brute: [
    'Charge the nearest enemy',
    'Use area attacks when multiple foes are grouped',
    'Accept opportunity attacks to reach priority targets',
    'Focus on damaging over positioning',
  ],
  leader: [
    'Start combat with a rally or buff',
    'Target the same foe as soldiers to focus fire',
    'Use tactical commands to reposition allies',
    'Save defensive abilities for when allies fall',
  ],
  minion: [
    'Swarm: attack the same target as other minions',
    'Provide flanking for stronger allies',
    'Use actions to harass, not to deal damage',
    'Sacrifice to protect more valuable allies',
  ],
};

/**
 * Generate tactical behavior for a creature
 */
export function generateTactics(
  creature: Creature,
  context: {
    terrain: string;
    allies: Creature[];
    enemyComposition?: string[];
  }
): string {
  const templates = TACTICAL_TEMPLATES[creature.role];
  const selectedTactics = templates
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(2, templates.length));

  // Add terrain-specific tactics
  const terrainTactics = getTerrainTactics(creature.role, context.terrain);

  return [...selectedTactics, ...terrainTactics].join('\n');
}

/**
 * Get terrain-specific tactical adjustments
 */
function getTerrainTactics(role: CreatureRole, terrain: string): string[] {
  const tactics: string[] = [];

  // Narrow spaces
  if (['corridor', 'tunnel', 'bridge', 'hallway'].includes(terrain)) {
    if (['soldier', 'brute'].includes(role)) {
      tactics.push('Block the narrow passage to control choke point');
    } else if (['artillery', 'support'].includes(role)) {
      tactics.push('Position at the far end of the passage for ranged attacks');
    }
  }

  // Open spaces
  if (['field', 'plains', 'arena', 'chamber'].includes(terrain)) {
    if (['skirmisher', 'artillery'].includes(role)) {
      tactics.push('Use mobility to maintain optimal positioning');
    } else if (['controller'].includes(role)) {
      tactics.push('Focus AoE effects where enemies are grouped');
    }
  }

  // Elevated/vertical spaces
  if (['cliffs', 'tower', 'ruins', 'cavern'].includes(terrain)) {
    if (['artillery', 'skirmisher'].includes(role)) {
      tactics.push('Use high ground for advantage and cover');
    }
  }

  // Hazardous terrain
  if (['swamp', 'lava', 'ice', 'underwater'].includes(terrain)) {
    tactics.push('Push or pull enemies into environmental hazards');
  }

  return tactics;
}

// ============================================================================
// ENVIRONMENTAL EFFECTS
// ============================================================================

export const TERRAIN_TYPES = [
  'dungeon-chamber',
  'corridor',
  'cavern',
  'forest',
  'swamp',
  'ruins',
  'castle',
  'temple',
  'tavern',
  'city-street',
  'sewers',
  'bridge',
  'boat',
  'underwater',
  'aerial',
  'elemental-plane',
];

export const ENVIRONMENTAL_EFFECTS: Partial<Record<string, EnvironmentEffect[]>> = {
  'dungeon-chamber': [
    {
      name: 'Dim Light',
      description: 'The chamber is lit only by flickering torches',
      impact: 'mixed',
      mechanics: ['Disadvantage on Perception checks', 'Darkvision useful'],
    },
    {
      name: 'Pillars',
      description: 'Stone pillars provide cover throughout the chamber',
      impact: 'mixed',
      mechanics: ['Half cover (+2 AC) when adjacent', 'Blocks movement through spaces'],
    },
  ],
  cavern: [
    {
      name: 'Uneven Ground',
      description: 'The floor is rocky and treacherous',
      impact: 'favor-enemies',
      mechanics: ['DC 10 Dexterity save or fall prone when moving more than half speed'],
    },
    {
      name: 'Stalactites',
      description: 'Sharp stone formations hang from the ceiling',
      impact: 'mixed',
      mechanics: ['Can be knocked down (Dex save, 2d6 damage)'],
    },
  ],
  forest: [
    {
      name: 'Dense Canopy',
      description: 'Trees provide partial cover and obscure vision',
      impact: 'mixed',
      mechanics: ['Three-quarters cover (+5 AC) behind trees', 'Difficult terrain in underbrush'],
    },
    {
      name: 'Ambush Points',
      description: 'Plenty of locations for hidden enemies',
      impact: 'favor-enemies',
      mechanics: ['Enemies may start hidden', 'High Stealth advantage for defenders'],
    },
  ],
  swamp: [
    {
      name: 'Deep Mud',
      description: 'The ground is soft and treacherous',
      impact: 'favor-enemies',
      mechanics: ['Difficult terrain throughout', 'DC 12 Strength check to become ungrappled from mud'],
    },
    {
      name: 'Toxic Fumes',
      description: 'Noxious gases hang over the area',
      impact: 'mixed',
      mechanics: ['DC 12 Con save or gain 1 level of exhaustion', 'Creatures native to swamp immune'],
    },
  ],
};

export function getEnvironmentalEffects(terrain: string): EnvironmentEffect[] {
  return ENVIRONMENTAL_EFFECTS[terrain] || [];
}

// ============================================================================
// ESCALATION MECHANICS
// ============================================================================

export const ESCALATION_TEMPLATES = [
  'Reinforcements arrive from nearby after round 3',
  'The environment becomes more hazardous each round (DC increases by 2)',
  'Creatures gain advantage after bloodied (below half HP)',
  'Defeated creatures rise again after 1d4 rounds',
  'The boss enrage at half HP, gaining +2 to attacks and damage',
  'Traps or hazards activate randomly each round',
  'Time limit: complete the encounter within X rounds or fail',
  'Allies or hostages take damage each round the combat continues',
];

/**
 * Generate escalation for a long-running encounter
 */
export function generateEscalation(
  difficulty: EncounterDifficulty,
  hasBoss: boolean
): string[] {
  if (difficulty === 'easy') return [];

  const escalations: string[] = [];

  // Boss encounters always escalate
  if (hasBoss) {
    escalations.push('The boss enrage at half HP, gaining +2 to attacks and damage');
  }

  // Hard and deadly encounters may have reinforcements
  if (difficulty === 'hard' && Math.random() > 0.5) {
    escalations.push('Reinforcements arrive after round 3');
  }

  if (difficulty === 'deadly') {
    escalations.push('Reinforcements arrive after round 3');
    if (Math.random() > 0.5) {
      escalations.push('The environment becomes more hazardous each round');
    }
  }

  return escalations;
}

// ============================================================================
// MAIN ENCOUNTER GENERATION
// ============================================================================

export interface GenerateEncounterOptions {
  party: PartyComposition;
  difficulty: EncounterDifficulty;
  terrain?: string;
  creatureTypes?: string[];
  includeBoss?: boolean;
  environmentalHazards?: boolean;
  theme?: string;
}

export interface GenerateEncounterResult {
  encounter: Encounter;
  metadata: {
    xpBudget: number;
    adjustedXp: number;
    deadlyThreshold: number;
    estimatedRounds: number;
    suggestedLevel: number;
  };
}

/**
 * Main encounter generation function
 * Combines deterministic math with AI-assisted creature selection
 */
export async function generateEncounter(
  options: GenerateEncounterOptions
): Promise<GenerateEncounterResult> {
  const {
    party,
    difficulty,
    terrain = 'dungeon-chamber',
    creatureTypes = ['humanoid', 'beast', 'monstrosity'],
    includeBoss = false,
    environmentalHazards = true,
    theme,
  } = options;

  // Calculate XP budget
  const xpBudget = calculateXpThreshold(party.level, party.size, difficulty);

  // Determine creature count
  const averageCr = Math.max(1, party.level - 1);
  const creatureCount = calculateCreatureCount(xpBudget, averageCr, difficulty);

  // Get composition template
  const compositionKey = includeBoss ? 'medium' : creatureCount <= 3 ? 'small' : creatureCount <= 6 ? 'medium' : 'large';
  const composition = ROLE_COMPOSITIONS[compositionKey] || ROLE_COMPOSITIONS.medium;

  // Generate creatures (this would typically use AI for creative selection)
  const creatures = generateCreaturesByComposition(
    composition,
    xpBudget,
    party.level,
    creatureCount,
    creatureTypes,
    theme
  );

  // Calculate actual adjusted XP
  const totalMonsters = creatures.reduce((sum, c) => sum + c.count, 0);
  const multiplier = getEncounterMultiplier(totalMonsters);
  const actualXp = Math.floor(
    creatures.reduce((sum, c) => sum + (XP_BY_CR[c.creature.cr] || 0) * c.count, 0) * multiplier
  );

  // Generate environment
  const effects = environmentalHazards ? getEnvironmentalEffects(terrain) : [];
  const tacticalFeatures = generateTacticalFeatures(terrain, creatures.map(c => c.creature));

  // Generate escalation
  const escalation = generateEscalation(difficulty, includeBoss);

  const encounter: Encounter = {
    name: generateEncounterName(theme, terrain, creatures),
    difficulty,
    xpBudget,
    actualXp,
    creatures,
    environment: {
      terrain,
      effects,
      tacticalFeatures,
    },
    victoryCondition: includeBoss ? 'Defeat the boss' : 'Defeat all enemies',
    defeatCondition: 'All party members fall unconscious or flee',
    escalation: escalation.length > 0 ? escalation : undefined,
  };

  const assessment = assessEncounterDeadliness(
    creatures.map(c => ({ cr: c.creature.cr, count: c.count })),
    party.level,
    party.size
  );

  return {
    encounter,
    metadata: {
      xpBudget,
      adjustedXp: assessment.adjustedXp,
      deadlyThreshold: assessment.deadlyThreshold,
      estimatedRounds: estimateRounds(creatures, party),
      suggestedLevel: party.level,
    },
  };
}

/**
 * Generate creatures based on role composition
 */
function generateCreaturesByComposition(
  composition: Array<{ role: CreatureRole; ratio: number }>,
  xpBudget: number,
  partyLevel: number,
  totalCount: number,
  types: string[],
  theme?: string
): Array<{ creature: Creature; count: number; tactic?: string }> {
  const result: Array<{ creature: Creature; count: number; tactic?: string }> = [];

  const xpPerRole = composition.map(c => ({
    role: c.role,
    xpBudget: Math.floor(xpBudget * c.ratio),
    count: Math.max(1, Math.floor(totalCount * c.ratio)),
  }));

  for (const roleEntry of xpPerRole) {
    const cr = estimateCrByXp(roleEntry.xpBudget, roleEntry.count);
    const creature = generateCreature(
      cr,
      roleEntry.role,
      types[Math.floor(Math.random() * types.length)],
      theme
    );

    result.push({
      creature,
      count: roleEntry.count,
      tactic: undefined, // Will be filled by generateTactics
    });
  }

  return result;
}

/**
 * Estimate CR needed to fill XP budget with given creature count
 */
function estimateCrByXp(xpBudget: number, count: number): number {
  const xpPerCreature = Math.floor(xpBudget / count);

  // Find closest CR
  let closestCr = 1;
  let closestDiff = Infinity;

  for (const [crStr, xp] of Object.entries(XP_BY_CR)) {
    const cr = parseFloat(crStr);
    const diff = Math.abs(xp - xpPerCreature);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestCr = cr;
    }
  }

  return closestCr;
}

/**
 * Generate a creature stat block (simplified placeholder)
 * In production, this would query a creature database or use AI
 */
function generateCreature(
  cr: number,
  role: CreatureRole,
  type: string,
  theme?: string
): Creature {
  return {
    name: `${theme ? theme.charAt(0).toUpperCase() + theme.slice(1) + ' ' : ''}${type} ${role}`,
    cr,
    role,
    hp: calculateExpectedHp(cr, role),
    ac: calculateExpectedAc(cr, role),
    stats: {
      str: rollStats()[0],
      dex: rollStats()[1],
      con: rollStats()[2],
      int: rollStats()[3],
      wis: rollStats()[4],
      cha: rollStats()[5],
    },
    abilities: generateAbilities(role, cr),
    immunities: [],
    resistances: generateResistances(type, cr),
    vulnerabilities: [],
  };
}

/**
 * Roll ability scores using 4d6 drop lowest
 */
function rollStats(): [number, number, number, number, number, number] {
  const roll = (): number => {
    const rolls = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    rolls.sort((a, b) => b - a);
    return rolls[0] + rolls[1] + rolls[2];
  };

  return [roll(), roll(), roll(), roll(), roll(), roll()].sort((a, b) => b - a) as [
    number, number, number, number, number, number
  ];
}

/**
 * Generate abilities based on role and CR
 */
function generateAbilities(role: CreatureRole, cr: number): string[] {
  const abilities: string[] = [];

  const attackBonus = calculateAttackBonus(cr, role);
  const dpr = calculateDpr(cr, role);
  const damageDice = estimateDamageDice(dpr);

  // Basic attack
  abilities.push(`Multiattack: ${Math.ceil(cr / 3)} attacks at +${attackBonus} (${damageDice} damage)`);

  // Role-specific abilities
  switch (role) {
    case 'soldier':
      abilities.push('Shield Bash: Bonus action shove or knockdown');
      break;
    case 'skirmisher':
      abilities.push('Evasion: Dex save for half damage on AoE');
      break;
    case 'artillery':
      abilities.push(`Ranged Spell/Attack: +${attackBonus + 2} (${damageDice} damage, range 60/240)`);
      break;
    case 'controller':
      abilities.push(`AoE Control: ${damageDice} damage in 20ft radius, Dex save or restrained`);
      break;
    case 'support':
      abilities.push('Healing Word: Bonus action heal 1d10 + level');
      break;
    case 'brute':
      abilities.push(`Power Attack: +${damageDice} damage, -5 to hit`);
      break;
    case 'leader':
      abilities.push('Rally: Allies within 30ft gain advantage on next attack');
      break;
  }

  return abilities;
}

/**
 * Estimate damage dice from DPR
 */
function estimateDamageDice(dpr: number): string {
  if (dpr < 10) return '1d8';
  if (dpr < 15) return '2d6';
  if (dpr < 25) return '2d8';
  if (dpr < 35) return '4d6';
  if (dpr < 50) return '4d8';
  if (dpr < 75) return '6d8';
  if (dpr < 100) return '8d8';
  if (dpr < 150) return '10d8';
  return '12d8';
}

/**
 * Generate resistances based on creature type
 */
function generateResistances(type: string, cr: number): string[] {
  const resistances: string[] = [];

  if (cr >= 5) {
    switch (type) {
      case 'fiend':
      case 'undead':
        resistances.push('cold', 'fire');
        break;
      case 'construct':
      case 'elemental':
        resistances.push('poison', 'psychic');
        break;
      case 'dragon':
        resistances.push('element matching dragon type');
        break;
    }
  }

  if (cr >= 10) {
    resistances.push('non-magical attacks');
  }

  return resistances;
}

/**
 * Generate encounter name
 */
function generateEncounterName(
  theme: string | undefined,
  terrain: string,
  creatures: Array<{ creature: Creature; count: number }>
): string {
  const creatureNames = creatures.map(c => c.creature.name);
  const primaryCreature = creatureNames[0];

  const terrainNames: Record<string, string> = {
    'dungeon-chamber': 'Chamber',
    'corridor': 'Ambush',
    'cavern': 'Cavern',
    'forest': 'Forest',
    'swamp': 'Swamp',
    'ruins': 'Ruins',
    'castle': 'Castle',
    'temple': 'Temple',
    'tavern': 'Brawl',
    'city-street': 'Street Fight',
    'sewers': 'Sewers',
    'bridge': 'Bridge',
    'boat': 'Ship',
    'underwater': 'Depths',
    'aerial': 'Sky',
    'elemental-plane': 'Extraplanar',
  };

  const terrainName = terrainNames[terrain] || 'Encounter';

  if (theme) {
    return `${theme} ${terrainName}`;
  }

  return `${primaryCreature} ${terrainName}`;
}

/**
 * Generate tactical features of the terrain
 */
function generateTacticalFeatures(
  terrain: string,
  creatures: Creature[]
): string[] {
  const features: string[] = [];

  // Base terrain features
  const baseFeatures: Record<string, string[]> = {
    'dungeon-chamber': ['Stone pillars providing cover', 'Dim torchlight'],
    'corridor': ['Narrow choke point', 'Multiple doors for flanking'],
    'cavern': ['Uneven rocky ground', 'Stalactites on ceiling', 'Dark corners'],
    'forest': ['Trees for cover', 'Underbrush difficult terrain'],
    'ruins': ['Collapsing structures', 'Rubble for cover'],
    'castle': ['Battlements and walls', 'Defensive positions'],
  };

  features.push(...(baseFeatures[terrain] || ['Open terrain']));

  // Features based on creature roles
  const hasRole = (role: CreatureRole) => creatures.some(c => c.role === role);

  if (hasRole('artillery')) {
    features.push('Elevated positions for ranged attackers');
  }

  if (hasRole('skirmisher')) {
    features.push('Multiple paths for mobility');
  }

  if (hasRole('controller')) {
    features.push('Environmental hazards for AoE attacks');
  }

  return features;
}

/**
 * Estimate combat duration in rounds
 */
function estimateRounds(
  creatures: Array<{ creature: Creature; count: number }>,
  party: PartyComposition
): number {
  const totalEnemyHp = creatures.reduce(
    (sum, c) => sum + c.creature.hp * c.count,
    0
  );

  const partyDpr = party.size * party.level * 8; // Rough estimate
  const enemyDpr = creatures.reduce(
    (sum, c) => sum + calculateDpr(c.creature.cr, c.creature.role) * c.count,
    0
  );

  const partyHp = party.size * (party.averageHp || 50);

  const roundsToKillEnemies = Math.ceil(totalEnemyHp / partyDpr);
  const roundsToKillParty = Math.ceil(partyHp / enemyDpr);

  return Math.min(roundsToKillEnemies, roundsToKillParty, 10); // Cap at 10 rounds
}

// ============================================================================
// EXPORTS
// ============================================================================

export const EncounterGen = {
  generateEncounter,
  calculateXpThreshold,
  getEncounterMultiplier,
  assessEncounterDeadliness,
  calculateExpectedAc,
  calculateExpectedHp,
  calculateAttackBonus,
  calculateDpr,
  generateTactics,
  getEnvironmentalEffects,
  generateEscalation,
  TERRAIN_TYPES,
  ROLE_COMPOSITIONS,
  XP_BY_CR,
  XP_BY_LEVEL,
};

export default EncounterGen;
