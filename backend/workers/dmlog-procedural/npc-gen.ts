/**
 * DMLoG.AI - NPC Generation System
 *
 * Procedural NPC generation using:
 * - Deterministic math for stats, skills, proficiencies
 * - AI for personality, backstory, voice, and roleplaying hooks
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

export const AlignmentSchema = z.object({
  axis1: z.enum(['lawful', 'neutral', 'chaotic']),
  axis2: z.enum(['good', 'neutral', 'evil']),
});
export type Alignment = z.infer<typeof AlignmentSchema>;

export const PersonalityTraitSchema = z.object({
  category: z.enum([
    'social', 'conflict', 'work', 'stress',
    'relationships', 'ideals', 'flaws', 'bonds'
  ]),
  trait: z.string(),
});

export const CharacterClassSchema = z.enum([
  'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard',
  'artificer', 'commoner', 'expert', 'noble', 'warrior', 'adept'
]);

export const BackgroundSchema = z.enum([
  'acolyte', 'charlatan', 'criminal', 'entertainer', 'folk-hero',
  'gladiator', 'guild-artisan', 'hermit', 'noble', 'outlander',
  'sage', 'soldier', 'urchin', 'custom'
]);

export const VoiceDescriptorSchema = z.object({
  pitch: z.enum(['very-low', 'low', 'medium', 'high', 'very-high']),
  tempo: z.enum(['very-slow', 'slow', 'medium', 'fast', 'very-fast']),
  quality: z.array(z.enum([
    'rough', 'smooth', 'nasal', 'breathy', 'booming',
    'thin', 'warm', 'cold', 'crackling', 'melodic'
  ])),
  catchphrase: z.string().optional(),
  speechPattern: z.string().optional(),
});

export const MotivationSchema = z.object({
  primary: z.string(),
  secondary: z.string().optional(),
  hidden: z.string().optional(), // Secret agenda
  fear: z.string().optional(),
});

export const RelationshipSchema = z.object({
  name: z.string(),
  type: z.enum([
    'family', 'friend', 'rival', 'enemy', 'mentor',
    'student', 'ally', 'neutral', 'secret-admirer'
  ]),
  strength: z.number().min(1).max(10), // Bond strength
  notes: z.string().optional(),
});

export const SecretSchema = z.object({
  severity: z.enum(['minor', 'moderate', 'major', 'dark']),
  knowledge: z.enum(['none', 'rumors', 'some', 'full']),
  content: z.string(),
});

export const NPCSchema = z.object({
  // Basic Info
  name: z.string(),
  age: z.number(),
  gender: z.string(),
  race: z.string(),
  alignment: AlignmentSchema,

  // Class & Stats
  class: CharacterClassSchema.optional(),
  level: z.number().default(1),
  background: BackgroundSchema.optional(),

  // Physical
  appearance: z.object({
    height: z.string(),
    build: z.string(),
    hair: z.string(),
    eyes: z.string(),
    distinguishingFeatures: z.array(z.string()),
    attire: z.string(),
  }),

  // Personality
  personality: z.object({
    traits: z.array(PersonalityTraitSchema),
    ideals: z.array(z.string()),
    bonds: z.array(z.string()),
    flaws: z.array(z.string()),
    voice: VoiceDescriptorSchema,
    motivations: MotivationSchema,
  }),

  // Capabilities
  stats: z.object({
    str: z.number().min(1).max(30),
    dex: z.number().min(1).max(30),
    con: z.number().min(1).max(30),
    int: z.number().min(1).max(30),
    wis: z.number().min(1).max(30),
    cha: z.number().min(1).max(30),
  }).optional(),

  skills: z.array(z.string()).optional(),
  languages: z.array(z.string()).default([]),

  // Social
  relationships: z.array(RelationshipSchema).default([]),
  reputation: z.object({
    local: z.number().min(-10).max(10).default(0),
    regional: z.number().min(-10).max(10).default(0),
    notes: z.array(z.string()).default([]),
  }).optional(),

  secrets: z.array(SecretSchema).default([]),

  // Roleplay
  roleplayHooks: z.array(z.string()).default([]),
  dmNotes: z.string().optional(),
});

export type PersonalityTrait = z.infer<typeof PersonalityTraitSchema>;
export type CharacterClass = z.infer<typeof CharacterClassSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type VoiceDescriptor = z.infer<typeof VoiceDescriptorSchema>;
export type Motivation = z.infer<typeof MotivationSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Secret = z.infer<typeof SecretSchema>;
export type NPC = z.infer<typeof NPCSchema>;

// ============================================================================
// NAME GENERATION (Deterministic)
// ============================================================================

const NAME_PARTS = {
  prefixes: [
    'A', 'Be', 'Ca', 'Da', 'El', 'Fa', 'Ga', 'Ha', 'I', 'Ja', 'Ka', 'La',
    'Ma', 'Na', 'O', 'Pa', 'Ra', 'Sa', 'Ta', 'Ul', 'Va', 'Wi', 'Xa', 'Ya', 'Za'
  ],
  middles: [
    'b', 'c', 'd', 'f', 'g', 'h', 'j', 'l', 'm', 'n', 'r', 's', 't', 'v', 'z'
  ],
  suffixes: [
    'a', 'ae', 'air', 'an', 'ar', 'as', 'e', 'ea', 'en', 'er', 'es', 'ia',
    'ic', 'is', 'on', 'or', 'os', 'us', 'yn'
  ],
  human: {
    male: [
      'Aldric', 'Bram', 'Cedric', 'Darian', 'Edmund', 'Gareth', 'Hadrian',
      'Ivan', 'Jasper', 'Kellan', 'Lorcan', 'Marcus', 'Nolan', 'Osric',
      'Percival', 'Quinn', 'Roderick', 'Sebastian', 'Tobias', 'Ulric'
    ],
    female: [
      'Adeline', 'Beatrice', 'Cordelia', 'Diana', 'Eleanor', 'Fiona',
      'Genevieve', 'Helena', 'Isolde', 'Juliana', 'Katerina', 'Lillian',
      'Mirabel', 'Natasha', 'Ophelia', 'Penelope', 'Quinn', 'Rosalind',
      'Seraphina', 'Tatiana', 'Valentina', 'Willow', 'Yvette', 'Zara'
    ],
    surnames: [
      'Ashford', 'Blackwood', 'Cromwell', 'Dunmore', 'Eversley', 'Fairfax',
      'Graham', 'Harrington', 'Inglewood', 'Jeffries', 'Kingsley', 'Lockhart',
      'Montague', 'Nightingale', 'Osborne', 'Pendleton', 'Quincy', 'Ravenscroft',
      'Sterling', 'Thornwood', 'Underhill', 'Vance', 'Weston', 'York'
    ]
  },
  elf: {
    male: [
      'Aerith', 'Caelum', 'Daeron', 'Elarian', 'Faelynn', 'Galathil',
      'Illyria', 'Laerth', 'Maerion', 'Naerys', 'Oropher', 'Quarion'
    ],
    female: [
      'Aerie', 'Caladwen', 'Elowen', 'Faeranduil', 'Galadriel', 'Illyria',
      'Laereth', 'Maerwen', 'Niphredil', 'Orophin', 'Quelenna', 'Rhiannon'
    ],
    surnames: [
      'Dewflower', 'Goldleaf', 'Moonwhisper', 'Silverbrook', 'Starlight',
      'Windrunner', 'Wintergreen'
    ]
  },
  dwarf: {
    male: [
      'Baldr', 'Dorin', 'Grim', 'Kazad', 'Morgran', 'Thorin', 'Ulfgar',
      'Varic', 'Worrin', 'Yaric'
    ],
    female: [
      'Bruna', 'Disa', 'Gruna', 'Hilda', 'Kira', 'Morana', 'Thora',
      'Ulla', 'Varna', 'Wren'
    ],
    surnames: [
      'Ironforge', 'Stonehammer', 'Battlehammer', 'Bronzebeard', 'Firebeard',
      'Goldtooth', 'Steelgrin', 'Thunderdelver'
    ]
  }
};

/**
 * Generate a random name based on race and gender
 */
export function generateName(race: string, gender: string): string {
  const raceNames = (NAME_PARTS as any)[race.toLowerCase()] || NAME_PARTS.human;
  const genderNames = raceNames[gender.toLowerCase()] || raceNames.male;
  const surnames = raceNames.surnames || NAME_PARTS.human.surnames;

  const firstName = genderNames[Math.floor(Math.random() * genderNames.length)];
  const surname = surnames[Math.floor(Math.random() * surnames.length)];

  return `${firstName} ${surname}`;
}

/**
 * Generate a procedurally constructed name for non-standard races
 */
export function generateProceduralName(): string {
  const prefix = NAME_PARTS.prefixes[Math.floor(Math.random() * NAME_PARTS.prefixes.length)];
  const middle = NAME_PARTS.middles[Math.floor(Math.random() * NAME_PARTS.middles.length)];
  const suffix = NAME_PARTS.suffixes[Math.floor(Math.random() * NAME_PARTS.suffixes.length)];

  return prefix + middle + suffix;
}

// ============================================================================
// ALIGNMENT GENERATION
// ============================================================================

/**
 * Generate alignment with weighted probabilities
 */
export function generateAlignment(options?: {
  preferLawful?: boolean;
  preferGood?: boolean;
  forbidEvil?: boolean;
}): Alignment {
  const weights = {
    axis1: {
      lawful: options?.preferLawful ? 4 : 2,
      neutral: 2,
      chaotic: 2,
    },
    axis2: {
      good: options?.preferGood ? 4 : 2,
      neutral: 2,
      evil: options?.forbidEvil ? 0 : 1,
    },
  };

  const rollAxis = (axis: 'axis1' | 'axis2'): string => {
    const total = Object.values(weights[axis]).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;

    for (const [key, weight] of Object.entries(weights[axis])) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return 'neutral';
  };

  return {
    axis1: rollAxis('axis1') as 'lawful' | 'neutral' | 'chaotic',
    axis2: rollAxis('axis2') as 'good' | 'neutral' | 'evil',
  };
}

/**
 * Format alignment as string
 */
export function formatAlignment(alignment: Alignment): string {
  if (alignment.axis1 === 'neutral' && alignment.axis2 === 'neutral') {
    return 'True Neutral';
  }
  return `${alignment.axis1.charAt(0).toUpperCase() + alignment.axis1.slice(1)} ${alignment.axis2.charAt(0).toUpperCase() + alignment.axis2.slice(1)}`;
}

// ============================================================================
// STAT GENERATION
// ============================================================================

/**
 * Roll ability score using 4d6 drop lowest
 */
export function rollAbilityScore(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

/**
 * Generate ability score array using standard roll
 */
export function rollAbilityScores(): {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
} {
  const scores = [
    rollAbilityScore(),
    rollAbilityScore(),
    rollAbilityScore(),
    rollAbilityScore(),
    rollAbilityScore(),
    rollAbilityScore(),
  ].sort((a, b) => b - a);

  return {
    str: scores[0],
    dex: scores[1],
    con: scores[2],
    int: scores[3],
    wis: scores[4],
    cha: scores[5],
  };
}

/**
 * Generate class-appropriate ability scores
 */
export function generateClassStats(characterClass: CharacterClass): {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
} {
  const baseScores = rollAbilityScores();

  // Class primary stat order (primary to tertiary)
  const statPriority: Record<CharacterClass, string[]> = {
    barbarian: ['str', 'con', 'dex'],
    bard: ['cha', 'dex', 'con'],
    cleric: ['wis', 'con', 'cha'],
    druid: ['wis', 'con', 'dex'],
    fighter: ['str', 'con', 'dex'],
    monk: ['dex', 'wis', 'con'],
    paladin: ['str', 'cha', 'con'],
    ranger: ['dex', 'wis', 'con'],
    rogue: ['dex', 'int', 'con'],
    sorcerer: ['cha', 'con', 'dex'],
    warlock: ['cha', 'con', 'wis'],
    wizard: ['int', 'dex', 'con'],
    artificer: ['int', 'con', 'dex'],
    commoner: ['con', 'str', 'dex'],
    expert: ['int', 'wis', 'cha'],
    noble: ['cha', 'int', 'wis'],
    warrior: ['str', 'con', 'dex'],
    adept: ['wis', 'cha', 'con'],
  };

  // Sort scores according to class priority
  const priority = statPriority[characterClass] || statPriority.commoner;
  const sortedScores = [...baseScores].sort((a, b) => b - a);

  return {
    str: sortedScores[priority.indexOf('str')] || baseScores.str,
    dex: sortedScores[priority.indexOf('dex')] || baseScores.dex,
    con: sortedScores[priority.indexOf('con')] || baseScores.con,
    int: sortedScores[priority.indexOf('int')] || baseScores.int,
    wis: sortedScores[priority.indexOf('wis')] || baseScores.wis,
    cha: sortedScores[priority.indexOf('cha')] || baseScores.cha,
  };
}

/**
 * Calculate ability modifier from score
 */
export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

// ============================================================================
// SKILL & PROFICIENCY GENERATION
// ============================================================================

export const ALL_SKILLS = [
  'acrobatics', 'animal-handling', 'arcana', 'athletics', 'deception',
  'history', 'insight', 'intimidation', 'investigation', 'medicine',
  'nature', 'perception', 'performance', 'persuasion', 'religion',
  'sleight-of-hand', 'stealth', 'survival'
];

const BACKGROUND_SKILLS: Record<Background, string[]> = {
  'acolyte': ['religion', 'insight'],
  'charlatan': ['deception', 'sleight-of-hand'],
  'criminal': ['stealth', 'deception'],
  'entertainer': ['performance', 'acrobatics'],
  'folk-hero': ['survival', 'animal-handling'],
  'gladiator': ['performance', 'intimidation'],
  'guild-artisan': ['insight', 'persuasion'],
  'hermit': ['medicine', 'religion'],
  'noble': ['history', 'persuasion'],
  'outlander': ['survival', 'athletics'],
  'sage': ['arcana', 'history'],
  'soldier': ['athletics', 'intimidation'],
  'urchin': ['sleight-of-hand', 'stealth'],
  'custom': [],
};

const CLASS_SKILLS: Record<CharacterClass, string[]> = {
  barbarian: ['athletics', 'intimidation', 'nature', 'survival'],
  bard: ALL_SKILLS, // Bards know all skills
  cleric: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
  druid: ['arcana', 'animal-handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
  fighter: ['acrobatics', 'animal-handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
  monk: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
  paladin: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
  ranger: ['animal-handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
  rogue: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight-of-hand', 'stealth'],
  sorcerer: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
  warlock: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
  wizard: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
  artificer: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleight-of-hand'],
  commoner: [],
  expert: ALL_SKILLS,
  noble: ['history', 'insight', 'persuasion'],
  warrior: ['athletics', 'intimidation', 'survival'],
  adept: ['medicine', 'religion'],
};

/**
 * Generate skill proficiencies for an NPC
 */
export function generateSkills(
  characterClass?: CharacterClass,
  background?: Background,
  count: number = 3
): string[] {
  const skills: string[] = [];

  // Add background skills
  if (background && BACKGROUND_SKILLS[background]) {
    skills.push(...BACKGROUND_SKILLS[background]);
  }

  // Add class skills
  const availableClassSkills = characterClass
    ? CLASS_SKILLS[characterClass] || []
    : [];

  // Filter out already known skills
  const remainingClassSkills = availableClassSkills.filter(s => !skills.includes(s));

  // Add additional class skills up to count
  const needed = count - skills.length;
  if (needed > 0 && remainingClassSkills.length > 0) {
    const shuffled = remainingClassSkills.sort(() => Math.random() - 0.5);
    skills.push(...shuffled.slice(0, Math.min(needed, shuffled.length)));
  }

  return [...new Set(skills)]; // Dedupe
}

// ============================================================================
// VOICE & SPEECH GENERATION
// ============================================================================

const SPEECH_PATTERNS = [
  'Speaks in the third person',
  'Uses rhymes frequently',
  'Very formal, archaic language',
  'Uses military terminology',
  'Frequent metaphors about {INTEREST}',
  'Stutters when nervous',
  'Whispers constantly',
  'Speaks very loudly',
  'Uses profanity liberally',
  'Never uses contractions',
  'Speaks in riddles',
  'Frequently quotes scripture or texts',
  'Has a lisp',
  'Pauses dramatically between phrases',
  'Repeats the last word of sentences',
  'Uses nicknames for everyone',
  'Answers questions with questions',
  'Extremely verbose, over-explains everything',
  'Speaks in short, clipped sentences',
];

const CATCHPHRASE_TEMPLATES = [
  'By {DEITY}!',
  'Well that went poorly.',
  'Did I mention I\'m a {CLASS}?',
  'Back in my home town...',
  '{VERB} me if I\'m wrong.',
  'That\'s not how I would have done it.',
  'Interesting development.',
  'Careful now, {NOUN}.',
  'Perhaps we should reconsider.',
  'Fortune favors the bold!',
];

/**
 * Generate voice descriptor for an NPC
 */
export function generateVoice(options?: {
  characterClass?: CharacterClass;
  background?: Background;
  personality?: string[];
}): VoiceDescriptor {
  // Class-based voice tendencies
  const classTendencies: Partial<Record<CharacterClass, { pitch?: string; tempo?: string }>> = {
    barbarian: { pitch: 'low' },
    bard: { tempo: 'medium' },
    monk: { tempo: 'slow' },
    sorcerer: { pitch: 'high' },
    wizard: { tempo: 'fast' },
  };

  const tendency = options?.characterClass
    ? classTendencies[options.characterClass]
    : {};

  const pitch = tendency.pitch || randomElement(['very-low', 'low', 'medium', 'high', 'very-high']);
  const tempo = tendency.tempo || randomElement(['very-slow', 'slow', 'medium', 'fast', 'very-fast']);

  // Voice qualities
  const allQualities = [
    'rough', 'smooth', 'nasal', 'breathy', 'booming',
    'thin', 'warm', 'cold', 'crackling', 'melodic'
  ];
  const qualityCount = 1 + Math.floor(Math.random() * 2);
  const quality = shuffleArray([...allQualities]).slice(0, qualityCount);

  // Speech pattern
  const speechPattern = randomElement(SPEECH_PATTERNS)
    .replace('{INTEREST}', randomElement(['nature', 'war', 'magic', 'travel', 'food', 'gold']))
    .replace('{CLASS}', options?.characterClass || 'adventurer');

  // Catchphrase
  const catchphrase = randomElement(CATCHPHRASE_TEMPLATES)
    .replace('{DEITY}', randomElement(['the gods', 'Moradin', 'Pelor', 'the Raven Queen', 'my ancestors']))
    .replace('{VERB}', randomElement(['Correct', 'Forgive', 'Strike', 'Bless']))
    .replace('{NOUN}', randomElement(['friend', 'traveler', 'stranger', 'fool']));

  return {
    pitch: pitch as VoiceDescriptor['pitch'],
    tempo: tempo as VoiceDescriptor['tempo'],
    quality: quality as VoiceDescriptor['quality'],
    catchphrase,
    speechPattern,
  };
}

// ============================================================================
// PERSONALITY GENERATION (AI-Assisted Templates)
// ============================================================================

const PERSONALITY_TRAITS: PersonalityTrait[] = [
  { category: 'social', trait: 'Always introduces themselves with a flourish' },
  { category: 'social', trait: 'Prefers the company of animals to people' },
  { category: 'social', trait: 'Makes constant eye contact, unnerving others' },
  { category: 'social', trait: 'Laughs at inappropriate times' },
  { category: 'social', trait: 'Speaks in a whisper, even in private' },
  { category: 'conflict', trait: 'Refuses to back down from a fight' },
  { category: 'conflict', trait: 'Seeks diplomatic solutions first' },
  { category: 'conflict', trait: 'Escalates conflicts for entertainment' },
  { category: 'conflict', trait: 'Protects the weak at all costs' },
  { category: 'conflict', trait: 'Believes might makes right' },
  { category: 'work', trait: 'Takes pride in meticulous work' },
  { category: 'work', trait: 'Prefers quick, adequate results over perfection' },
  { category: 'work', trait: 'Works in bursts of intense energy' },
  { category: 'work', trait: 'Delegates whenever possible' },
  { category: 'work', trait: 'Micromanages every detail' },
  { category: 'stress', trait: 'Becomes silent when stressed' },
  { category: 'stress', trait: 'Becomes aggressive when stressed' },
  { category: 'stress', trait: 'Makes jokes when stressed' },
  { category: 'stress', trait: 'Becomes hyper-focused when stressed' },
  { category: 'stress', trait: 'Panics and freezes when stressed' },
];

const IDEALS = [
  'Honor: Acting with integrity is paramount',
  'Freedom: All beings deserve liberty',
  'Knowledge: Truth is worth any cost',
  'Community: The group outweighs the individual',
  'Ambition: Power is the ultimate goal',
  'Balance: All things must exist in harmony',
  'Tradition: The old ways are best',
  'Progress: Change is necessary for growth',
  'Greed: Wealth is the only metric of success',
  'Redemption: Everyone deserves a second chance',
];

const BONDS = [
  'Would die to protect a specific place',
  'Seeking revenge for a past wrong',
  'Secretly in love with someone unavailable',
  'Owes a life debt to a mentor',
  'Haunted by a past failure',
  'Searching for a lost family member',
  'Bound by a sacred oath',
  'Obsessed with acquiring a specific item',
  'Protective of a younger sibling',
  'Carrying a message for someone who died',
];

const FLAWS = [
  'Too quick to trust',
  'Secretly greedy',
  'Arrogant about abilities',
  'Phobia of a common thing (spiders, heights, etc.)',
  'Addiction (gambling, drink, etc.)',
  'Holds grudges endlessly',
  'Terrified of death',
  'Compulsive liar',
  'Cannot resist a challenge',
  'Prejudiced against a specific group',
];

/**
 * Generate personality traits for an NPC
 */
export function generatePersonality(options?: {
  count?: number;
  alignment?: Alignment;
  characterClass?: CharacterClass;
}): {
  traits: PersonalityTrait[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
} {
  const count = options?.count || 3;

  // Filter traits based on alignment
  let availableTraits = [...PERSONALITY_TRAITS];
  if (options?.alignment) {
    if (options.alignment.axis1 === 'lawful') {
      // Lawful characters tend to be more structured
      availableTraits = availableTraits.filter(t =>
        !t.trait.includes('escalates') && !t.trait.includes('inappropriate')
      );
    } else if (options.alignment.axis1 === 'chaotic') {
      // Chaotic characters may prefer less structured traits
      availableTraits = availableTraits.filter(t =>
        !t.trait.includes('meticulous') && !t.trait.includes('micromanages')
      );
    }
  }

  const shuffledTraits = shuffleArray(availableTraits);
  const selectedTraits = shuffledTraits.slice(0, count);

  return {
    traits: selectedTraits,
    ideals: shuffleArray([...IDEALS]).slice(0, 2),
    bonds: shuffleArray([...BONDS]).slice(0, 1 + Math.floor(Math.random() * 2)),
    flaws: shuffleArray([...FLAWS]).slice(0, 1 + Math.floor(Math.random() * 2)),
  };
}

// ============================================================================
// MOTIVATION GENERATION
// ============================================================================

const PRIMARY_MOTIVATIONS = [
  'Accumulate wealth and power',
  'Protect family and loved ones',
  'Achieve fame and recognition',
  'Uncover ancient secrets',
  'Uphold religious beliefs',
  'Overthrow an unjust ruler',
  'Find a cure for a disease',
  'Prove worth to a dismissive parent',
  'Travel to every corner of the world',
  'Master a particular skill or art',
  'Avenge a past wrong',
  'Create a lasting legacy',
];

const SECONDARY_MOTIVATIONS = [
  'Find a romantic partner',
  'Pay off significant debts',
  'Care for an aging parent',
  'Support a dependent child',
  'Gain acceptance into a group',
  'Impress a specific person',
  'Break a bad habit',
  'Learn more about their heritage',
  'Find a place to belong',
  'Experience new things',
];

const HIDDEN_MOTIVATIONS = [
  'Actually working for the enemy',
  'Planning to betray the party eventually',
  'Is a wanted criminal hiding identity',
  'Seeks to steal a specific item',
  'Is gathering information for a rival',
  'Plans to use the party for personal gain',
  'Blackmailed into cooperation',
  'Secretly a noble in disguise',
  'Is a spy for an enemy faction',
  'Carrying a cursed item they cannot reveal',
];

const FEARS = [
  'Losing loved ones',
  'Becoming powerless',
  'Public humiliation',
  'Death without legacy',
  'Poverty and destitution',
  'Being forgotten',
  'Losing their mind',
  'Betrayal by friends',
  'Failure in their primary goal',
  'A specific creature or monster type',
];

/**
 * Generate motivations for an NPC
 */
export function generateMotivations(): Motivation {
  return {
    primary: randomElement(PRIMARY_MOTIVATIONS),
    secondary: randomElement(SECONDARY_MOTIVATIONS),
    hidden: Math.random() > 0.7 ? randomElement(HIDDEN_MOTIVATIONS) : undefined,
    fear: Math.random() > 0.5 ? randomElement(FEARS) : undefined,
  };
}

// ============================================================================
// APPEARANCE GENERATION
// ============================================================================

const HEIGHTS = [
  'Very short', 'Short', 'Below average', 'Average', 'Above average', 'Tall', 'Very tall'
];

const BUILDS = [
  'Emaciated', 'Thin', 'Lean', 'Average', 'Athletic', 'Muscular', 'Heavy', 'Obese'
];

const HAIR_COLORS = [
  'Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Bald',
  'Dyed blue', 'Dyed green', 'Dyed red', 'Streaked with gray'
];

const HAIR_STYLES = [
  'Long and flowing', 'Short and cropped', 'Braided', 'In a bun',
  'Wild and unkempt', 'Receding', 'Balding', 'Completely bald',
  'In a ponytail', 'Curly', 'Straight', 'Wavy', 'Dreadlocks'
];

const EYE_COLORS = [
  'Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Violet', 'Red'
];

const DISTINGUISHING_FEATURES = [
  'Scar across the face',
  'Missing finger',
  'Tattoo on visible skin',
  'Unusual eye color',
  'Birthmark',
  'Missing teeth',
  'Burn scar',
  'Freckles',
  'Piercings',
  'Very prominent nose',
  'Limp',
  'Unusual height',
  'White streak in hair',
  'Glass eye',
  'Deep voice',
  'Always smells of smoke',
  'Always smells of perfume',
];

const ATTIRE_STYLES = [
  'Ragged and dirty clothes',
  'Simple peasant garb',
  'Well-worn traveling clothes',
  'Practical leather armor',
  'Immaculate noble\'s clothing',
  'Religious vestments',
  'Military uniform',
  'Mercenary gear',
  'Performing clothes',
  'Scholarly robes',
  'Expensive silks and jewels',
  'Foreign cultural dress',
];

/**
 * Generate appearance for an NPC
 */
export function generateAppearance(): {
  height: string;
  build: string;
  hair: string;
  eyes: string;
  distinguishingFeatures: string[];
  attire: string;
} {
  return {
    height: randomElement(HEIGHTS),
    build: randomElement(BUILDS),
    hair: `${randomElement(HAIR_COLORS)} hair, ${randomElement(HAIR_STYLES)}`,
    eyes: randomElement(EYE_COLORS),
    distinguishingFeatures: shuffleArray([...DISTINGUISHING_FEATURES]).slice(0, 1 + Math.floor(Math.random() * 3)),
    attire: randomElement(ATTIRE_STYLES),
  };
}

// ============================================================================
// SECRET GENERATION
// ============================================================================

const SECRET_CONTENTS = {
  minor: [
    'Once stole something small',
    'Has a crush on someone inappropriate',
    'Cheated in a competition once',
    'Has a gambling debt',
    'Is actually quite wealthy but pretends otherwise',
    'Was once arrested but never charged',
  ],
  moderate: [
    'Is a member of a controversial organization',
    'Has a bastard child they don\'t acknowledge',
    'Witnessed a crime and never reported it',
    'Has been banished from their hometown',
    'Is lying about their qualifications',
    'Owes money to dangerous people',
  ],
  major: [
    'Committed murder in the past',
    'Is a double agent working against their apparent faction',
    'Caused the death of someone they loved',
    'Is the rightful heir to a title they don\'t claim',
    'Has turned their back on their religious faith',
    'Was responsible for a disaster they blame on others',
  ],
  dark: [
  ]
};

/**
 * Generate a secret for an NPC
 */
export function generateSecret(options?: { severity?: Secret['severity'] }): Secret {
  const severity = options?.severity || randomElement(['minor', 'moderate', 'major', 'dark'] as Secret['severity'][]);
  const content = randomElement(SECRET_CONTENTS[severity] || SECRET_CONTENTS.moderate);
  const knowledgeRoll = Math.random();

  let knowledge: Secret['knowledge'];
  if (knowledgeRoll < 0.3) knowledge = 'none';
  else if (knowledgeRoll < 0.6) knowledge = 'rumors';
  else if (knowledgeRoll < 0.8) knowledge = 'some';
  else knowledge = 'full';

  return { severity, knowledge, content };
}

// ============================================================================
// RELATIONSHIP GENERATION
// ============================================================================

/**
 * Generate a relationship for an NPC
 */
export function generateRelationship(npcName: string): Relationship {
  return {
    name: generateName('human', Math.random() > 0.5 ? 'male' : 'female').split(' ')[0],
    type: randomElement([
      'family', 'friend', 'rival', 'enemy', 'mentor',
      'student', 'ally', 'neutral', 'secret-admirer'
    ]),
    strength: 1 + Math.floor(Math.random() * 10),
  };
}

// ============================================================================
// ROLEPLAY HOOK GENERATION
// ============================================================================

const ROLEPLAY_HOOKS = [
  'Approaches the party with a job offer',
  'Overhears the party discussing a relevant topic',
  'Is being harassed by local toughs',
  'Witnessed something the party needs to know about',
  'Has an item the party is looking for',
  'Needs protection for a journey',
  'Knows information about a party member\'s background',
  'Is secretly following the party',
  'Comes to the party for help with a personal problem',
  'Is a rival also pursuing the party\'s goal',
  'Has been hired to oppose the party',
  'Has information that contradicts the party\'s current understanding',
  'Recognizes a party member from their past',
  'Is looking to hire adventurers for a quest',
  'Is selling something rare and unusual',
];

/**
 * Generate roleplay hooks for an NPC
 */
export function generateRoleplayHooks(count: number = 2): string[] {
  return shuffleArray([...ROLEPLAY_HOOKS]).slice(0, count);
}

// ============================================================================
// FULL NPC GENERATION
// ============================================================================

export interface GenerateNPCOptions {
  race?: string;
  gender?: string;
  characterClass?: CharacterClass;
  level?: number;
  background?: Background;
  alignment?: Partial<Alignment>;
  ageRange?: 'young' | 'adult' | 'middle-aged' | 'elder' | 'ancient';
  name?: string;
}

/**
 * Generate a complete NPC
 */
export function generateNPC(options: GenerateNPCOptions = {}): NPC {
  const {
    race = 'Human',
    gender = Math.random() > 0.5 ? 'male' : 'female',
    characterClass,
    level = 1,
    background,
    alignment: alignmentOverride,
    ageRange = 'adult',
    name,
  } = options;

  // Determine age
  const ageRanges: Record<string, { min: number; max: number }> = {
    'young': { min: 16, max: 25 },
    'adult': { min: 26, max: 45 },
    'middle-aged': { min: 46, max: 65 },
    'elder': { min: 66, max: 80 },
    'ancient': { min: 81, max: 150 },
  };

  const age = ageRanges[ageRange].min + Math.floor(
    Math.random() * (ageRanges[ageRange].max - ageRanges[ageRange].min)
  );

  // Generate alignment
  const alignment: Alignment = {
    axis1: alignmentOverride?.axis1 || generateAlignment().axis1,
    axis2: alignmentOverride?.axis2 || generateAlignment().axis2,
  };

  // Generate personality
  const personality = generatePersonality({
    alignment,
    characterClass,
  });

  // Generate stats
  const stats = characterClass ? generateClassStats(characterClass) : rollAbilityScores();

  // Generate skills
  const skills = generateSkills(characterClass, background);

  // Generate voice
  const voice = generateVoice({
    characterClass,
    background,
    personality: personality.traits.map(t => t.trait),
  });

  // Generate motivations
  const motivations = generateMotivations();

  // Generate appearance
  const appearance = generateAppearance();

  // Generate relationships
  const relationshipCount = Math.floor(Math.random() * 4);
  const relationships: Relationship[] = [];
  for (let i = 0; i < relationshipCount; i++) {
    relationships.push(generateRelationship(name || 'NPC'));
  }

  // Generate secrets
  const secretCount = Math.floor(Math.random() * 3);
  const secrets: Secret[] = [];
  for (let i = 0; i < secretCount; i++) {
    secrets.push(generateSecret());
  }

  // Generate roleplay hooks
  const roleplayHooks = generateRoleplayHooks(1 + Math.floor(Math.random() * 3));

  // Generate languages (based on race and background)
  const languages = generateLanguages(race, background);

  return {
    name: name || generateName(race, gender),
    age,
    gender,
    race,
    alignment,
    class: characterClass,
    level,
    background,
    appearance,
    personality: {
      ...personality,
      voice,
      motivations,
    },
    stats,
    skills,
    languages,
    relationships,
    secrets,
    roleplayHooks,
  };
}

/**
 * Generate languages for an NPC
 */
function generateLanguages(race: string, background?: Background): string[] {
  const languages = ['Common'];

  const raceLanguages: Record<string, string[]> = {
    'Elf': ['Elvish'],
    'Dwarf': ['Dwarvish'],
    'Halfling': ['Halfling'],
    'Gnome': ['Gnomish'],
    'Half-Orc': ['Orcish', 'Common'],
    'Dragonborn': ['Draconic'],
    'Tiefling': ['Abyssal', 'Infernal'],
    'Human': ['One extra language of choice'],
  };

  if (raceLanguages[race]) {
    languages.push(...raceLanguages[race].filter(l => l !== 'Common'));
  }

  // Scholars and religious backgrounds get extra languages
  if (background === 'sage' || background === 'acolyte') {
    const extraLanguages = ['Abyssal', 'Celestial', 'Deep Speech', 'Draconic', 'Giant', 'Gnomish', 'Goblin', 'Infernal', 'Primordial', 'Sylvan', 'Undercommon'];
    languages.push(extraLanguages[Math.floor(Math.random() * extraLanguages.length)]);
  }

  return [...new Set(languages)];
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

export const NPCGen = {
  generateNPC,
  generateName,
  generateProceduralName,
  generateAlignment,
  formatAlignment,
  rollAbilityScore,
  rollAbilityScores,
  generateClassStats,
  getModifier,
  generateSkills,
  generateVoice,
  generatePersonality,
  generateMotivations,
  generateAppearance,
  generateSecret,
  generateRelationship,
  generateRoleplayHooks,
  generateLanguages,
  BACKGROUND_SKILLS,
  CLASS_SKILLS,
  ALL_SKILLS,
};

export default NPCGen;
