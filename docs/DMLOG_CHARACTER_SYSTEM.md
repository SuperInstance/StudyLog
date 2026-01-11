# DMLoG.AI Character Development System

**Version:** 1.0.0
**Author:** Agent 4/7 - DMLog Character Development System Designer
**Date:** 2026-01-10
**Status:** Design Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Character Architecture](#character-architecture)
3. [Development Through Play](#development-through-play)
4. [Character Types](#character-types)
5. [Integration](#integration)
6. [Godot Visualization](#godot-visualization)
7. [Code Examples](#code-examples)
8. [Reference Tables](#reference-tables)

---

## Overview

DMLoG.AI (Dungeon Master LoG) is the TTRPG practice environment in the SuperInstance.AI ecosystem. It uses AI agents as players to help Dungeon Masters practice their craft—running sessions, managing combat, handling social encounters, and pacing adventures.

The Character Development System creates memorable NPCs and party members through:

- **Personality-driven behavior** using the Big Five trait model
- **Memory-based growth** from in-game experiences
- **Class-specific behavioral patterns** for authentic RPG feel
- **Dynamic relationships** that evolve through play
- **Visual representation** in Godot with animations and equipment

---

## Character Architecture

### Core Character Model

All DMLoG characters extend the base `@studylog/character-sdk` Character class with RPG-specific enhancements:

```typescript
interface DMLogCharacterConfig {
  // Core identity
  name: string;
  characterClass: CharacterClass;
  race: Race;
  background: Background;

  // Personality (Big Five + RPG traits)
  personality: {
    // Big Five (OCEAN)
    openness: number;        // 0-1: Curiosity, creativity
    conscientiousness: number; // 0-1: Discipline, reliability
    extraversion: number;    // 0-1: Social engagement
    agreeableness: number;   // 0-1: Cooperation, empathy
    neuroticism: number;     // 0-1: Emotional stability (inverted)

    // RPG-specific traits
    honor: number;           // 0-1: Adherence to code
    piety: number;           // 0-1: Religious devotion
    greed: number;           // 0-1: Desire for wealth
    wanderlust: number;      // 0-1: Desire to travel
    bloodlust: number;       // 0-1: Enjoyment of combat
  };

  // Background and goals
  backstory: string;
  goals: string[];
  fears: string[];
  secrets: string[];

  // Capabilities
  stats: CharacterStats;
  skills: Skill[];
  equipment: Equipment[];
}
```

### Personality System

#### Big Five Traits (OCEAN)

The foundation of all character personalities:

| Trait | Low (0.0-0.3) | Moderate (0.4-0.7) | High (0.8-1.0) |
|-------|---------------|-------------------|----------------|
| **Openness** | Traditional, practical, conventional | Balanced | Creative, curious, experimental |
| **Conscientiousness** | Spontaneous, flexible, careless | Average | Organized, disciplined, thorough |
| **Extraversion** | Reserved, introspective, quiet | Balanced | Outgoing, enthusiastic, assertive |
| **Agreeableness** | Competitive, critical, tough | Average | Cooperative, empathetic, kind |
| **Neuroticism** | Stable, calm, confident (low is good) | Average | Sensitive, anxious, moody |

#### RPG-Specific Traits

Additional traits that drive fantasy character behavior:

```typescript
interface RPGTraits {
  // Motivation drivers
  honor: number;       // Paladin codes, samurai tenets
  piety: number;       // Clerical devotion, religious zeal
  greed: number;       // Rogues, merchants, dragons
  wanderlust: number;  // Rangers, bards, adventurers
  bloodlust: number;   // Barbarians, warriors, raiders

  // Social traits
  loyalty: number;     // Party cohesion, oathkeeping
  deceit: number;      // Trickery, bluffing, disguise
  humor: number;       // Bards, comic relief

  // Magical aptitude
  arcaneAttunement: number;  // Wizards, sorcerers
  divineConnection: number;   // Clerics, paladins
  primalInstinct: number;     // Druids, rangers
}
```

### Background Generation

Backgrounds provide starting skills, motivations, and roleplaying hooks:

```typescript
enum Background {
  // Commoner backgrounds
  Acolyte,     // Temple service, religious knowledge
  Charlatan,   // Deception, scams, false identities
  Criminal,    // Underworld contacts, stealth
  Entertainer, // Performance, crowd working
  FolkHero,    // Local fame, common people's champion
  GuildArtisan,// Trade skills, guild membership
  Hermit,      // Isolation, obscure knowledge
  Noble,       // Wealth, position, etiquette
  Outlander,   // Wilderness, survival, strange customs
  Sage,        // Research, academic knowledge
  Soldier,     // Military training, discipline
  Urchin,      // Street smarts, theft, survival

  // DMLoG-specific backgrounds
  TravelingMerchant,  // Trade routes, barter, appraisal
  TavernKeeper,       // Rumors, information gathering
  RetiredAdventurer,  // Experience, warnings, old contacts
  CursedWanderer,     // Dark past, mysterious affliction
  Prodigy,            // Young talent, inexperience, potential
}
```

Each background provides:
- **Starting skills**: 2-3 skill proficiencies
- **Starting equipment**: Background-specific gear
- **Feature**: Special ability (e.g., Rustic Hospitality for Outlanders)
- **Suggested characteristics**: Personality trait, ideal, bond, flaw

### Motivation and Goal Systems

Characters have layered motivations that drive their decisions:

```typescript
interface CharacterMotivation {
  // Primary motivation (drives major decisions)
  primary: MotivationType;

  // Secondary motivations (support primary)
  secondary: MotivationType[];

  // Current goals (active pursuits)
  goals: ActiveGoal[];

  // Long-term dreams (aspirational)
  dreams: string[];

  // Fears (things to avoid)
  fears: string[];
}

enum MotivationType {
  // Achievement
  GLORY,        // Fame, renown, legends
  POWER,        // Authority, control, rule
  WEALTH,       // Riches, treasure, prosperity
  MASTERY,      // Skill perfection, knowledge

  // Relationship
  LOVE,         // Romantic, familial, platonic
  LOYALTY,      // Oaths, friendship, duty
  REVENGE,      // Vengeance, justice, retribution
  PROTECTION,   // Guarding, shepherding, defense

  // Discovery
  KNOWLEDGE,    // Truth, secrets, understanding
  EXPLORATION,  // New places, horizons, experiences
  CURIOSITY,    // Answers, mysteries, the unknown

  // Beliefs
  FAITH,        // Religious devotion, divine will
  CAUSE,        // Revolution, reform, movement
  CODE,         // Honor, law, personal principles

  // Freedom
  LIBERTY,      // Independence, autonomy, escape
  CHAOS,        // Disorder, disruption, entropy

  // Darker motivations
  GREED,        // Excessive accumulation
  AMBITION,     // Ruthless advancement
  DOMINATION,   // Control over others
  DESTRUCTION,  // Annihilation, ruin
}
```

### Class/Role Behavioral Patterns

Each character class has distinct behavioral tendencies:

#### Martial Classes

**Fighter**
- Personality: High conscientiousness, moderate extraversion
- Behavior: Tactical, protective, direct
- Combat: Positioning aware, protects allies, targets threats
- Social: Respectful of hierarchy, practical conversations

```typescript
const fighterBehavior = {
  combatPriorities: ['protect_ally', 'engage_nearest', 'flank_enemy'],
  socialTendencies: ['respect_strength', 'value_honor', 'direct_speech'],
  decisionFactors: {
    bravery: 0.8,
    caution: 0.4,
    tactics: 0.7,
  }
};
```

**Barbarian**
- Personality: Low conscientiousness, high extraversion, low neuroticism
- Behavior: Impulsive, passionate, direct
- Combat: Rage-driven, targets strongest enemy, ignores danger
- Social: Boisterous, loyal to friends, suspicious of authority

**Ranger**
- Personality: High openness, low extraversion, low neuroticism
- Behavior: Observant, practical, nature-focused
- Combat: Uses terrain, favors ranged, targets priorities
- Social: Quiet, speaks when necessary, nature metaphors

**Rogue**
- Personality: High openness, low agreeableness, low conscientiousness
- Behavior: Pragmatic, opportunistic, self-interested
- Combat: Seeks advantage, targets vulnerable, tactical retreat
- Social: Charming when needed, information gathering, deception

**Monk**
- Personality: High conscientiousness, low neuroticism, high openness
- Behavior: Disciplined, philosophical, centered
- Combat: Mobile, disabling strikes, non-lethal when possible
- Social: Cryptic, philosophical questions, meditation references

#### Spellcasting Classes

**Wizard**
- Personality: Very high openness, high conscientiousness, low extraversion
- Behavior: Analytical, prepared, knowledge-seeking
- Magic: Optimal spell selection, counters prepared, utility focus
- Social: Lectures, shares knowledge, dismissive of superstition

**Sorcerer**
- Personality: High openness, moderate extraversion, high neuroticism
- Behavior: Instinctive, emotional, charismatic
- Magic: Reflexive casting, metamagic use, raw power
- Social: Dramatic, expressive, references bloodline

**Warlock**
- Personality: High openness, low agreeableness, moderate neuroticism
- Behavior: Transactional, secretive, pact-aware
- Magic: Eldritch blasts, invocations, patron consultation
- Social: Mysterious, hints at secrets, reciprocity-focused

**Cleric**
- Personality: High conscientiousness, high agreeableness, low neuroticism
- Behavior: Devout, supportive, principled
- Magic: Healing focus, buffing allies, divine intervention
- Social: Evangelical, offers guidance, religious quotes

**Druid**
- Personality: High openness, low extraversion, moderate conscientiousness
- Behavior: Nature-focused, balance-seeking, wild
- Magic: Shapechanging, elemental, natural world
- Social: Speaks for nature, cyclical references, concern for civilization

**Bard**
- Personality: High openness, high extraversion, high agreeableness
- Behavior: Performative, social, versatile
- Magic: Inspiration, enchantment, illusion
- Social: Charismatic, stories, songs, gossip

**Paladin**
- Personality: High conscientiousness, high agreeableness, very low neuroticism
- Behavior: Principled, protective, smiting
- Magic: Healing, smiting, aura abilities
- Social: Preachy, oath-referencing, sees best in others

---

## Development Through Play

### Character Growth System

Characters evolve through their experiences using the Character SDK's memory and learning systems:

#### Experience Categories

```typescript
interface CharacterGrowth {
  // Combat growth
  combatExperience: {
    enemiesDefeated: number;
    battlesSurvived: number;
    preferredTactics: string[];
    traumaLevel: number;  // 0-1: PTSD from near-death
  };

  // Social growth
  socialExperience: {
    npcRelationships: Map<string, Relationship>;
  persuasions: number;
  deceptions: number;
  leadershipMoments: number;
  };

  // Knowledge growth
  knowledgeGained: {
    loreDiscovered: string[];
    secretsLearned: string[];
    skillsMastered: string[];
  };

  // Moral growth
  moralCompass: {
    altruisticActs: number;
  selfishActs: number;
  codeViolations: number;
  alignmentShift: AlignmentShift;
  };
}
```

### Memory-Driven Personality Evolution

Characters' personalities shift based on significant experiences:

```typescript
// Personality shift from traumatic near-death
if (combatExperience.nearDeathCount > 2) {
  personality.neuroticism += 0.15;
  personality.openness -= 0.1;
  personality.bloodlust -= 0.2;
}

// Personality shift from leadership success
if (socialExperience.leadershipSuccess > 0.7) {
  personality.extraversion += 0.1;
  personality.conscientiousness += 0.05;
  personality.honor += 0.1;
}

// Personality shift from betrayal
if (socialExperience.betrayalCount > 0) {
  personality.agreeableness -= 0.2;
  personality.neuroticism += 0.15;
  personality.deceit += 0.1;
}
```

### Relationship Changes

Relationships evolve through interaction using the Character SDK's relationship tracking:

```typescript
interface Relationship {
  targetId: string;
  targetName: string;
  relationshipType: RelationshipType;
  trustLevel: number;        // 0-1
  respectLevel: number;      // 0-1
  affectionLevel: number;    // 0-1
  fearLevel: number;         // 0-1
  debtLevel: number;         // 0-1 (favors owed)
  history: RelationshipEvent[];
  currentStatus: string;
}

enum RelationshipType {
  // Positive
  LOYAL_FRIEND,      // Deep trust, mutual support
  COMRADE,           // Shared struggle, reliable
  MENTOR,            // Teaching, guidance
  STUDENT,           // Learning, respect
  ROMANTIC,          // Love, intimacy
  FAMILY,            // Blood or chosen kin

  // Neutral
  ACQUAINTANCE,      // Known but not close
  ALLY,             // Shared goals, limited trust
  BUSINESS,          // Transactional, professional
  RIVAL,            // Competitive but not hostile

  // Negative
  SUSPECT,           // Distrust, caution
  ENEMY,             // Active hostility
  NEMESIS,           // Personal vendetta
  BETRAYER,          // Broken trust, resentment
}

// Relationship evolution through events
function evolveRelationship(
  relationship: Relationship,
  event: RelationshipEvent
): Relationship {
  switch (event.type) {
    case 'life_saved':
      relationship.trustLevel = Math.min(1, relationship.trustLevel + 0.3);
      relationship.debtLevel += 0.5;
      break;
    case 'betrayal':
      relationship.trustLevel = Math.max(0, relationship.trustLevel - 0.5);
      relationship.relationshipType = RelationshipType.BETRAYER;
      break;
    case 'shared_victory':
      relationship.affectionLevel += 0.1;
      relationship.respectLevel += 0.1;
      break;
    case 'long_absence':
      relationship.trustLevel -= 0.05;
      relationship.affectionLevel -= 0.1;
      break;
  }
  return relationship;
}
```

### Story Arc Generation

Characters generate personal story arcs through play:

```typescript
interface CharacterArc {
  arcName: string;
  arcType: ArcType;
  stages: ArcStage[];
  currentStage: number;
  completion: number;  // 0-1
}

enum ArcType {
  // Internal arcs
  REDEMPTION,      // Overcoming dark past
  SELF_DISCOVERY,  // Finding true identity
  MASTER,          // Achieving greatness
  SACRIFICE,       // Giving up for others

  // External arcs
  REVENGE,         // Pursuing justice
  RESCUE,          // Saving someone
  CONQUEST,        // Achieving dominance
  PROTECTION,      // Guarding something

  // Mystery arcs
  ORIGIN,          // Discovering where they came from
  PROPHECY,        // Fulfilling destiny
  CURSE,           // Breaking affliction

  // Relationship arcs
  ROMANCE,         // Finding love
  BETRAYAL,        // Dealing with treachery
  REUNION,         // reconnecting with past
}

// Arc progression based on milestones
function progressArc(
  character: DMLogCharacter,
  milestone: StoryMilestone
): void {
  const arc = character.currentArc;

  // Check if milestone advances arc
  if (milestone.relatedTo === arc.arcName) {
    arc.completion += milestone.progressValue;

    // Check for stage transition
    const newStage = Math.floor(arc.completion * arc.stages.length);
    if (newStage > arc.currentStage) {
      arc.currentStage = newStage;

      // Trigger stage event
      triggerStageEvent(arc.stages[newStage], character);
    }
  }

  // Check for arc completion
  if (arc.completion >= 1.0) {
    completeArc(character, arc);
  }
}
```

---

## Character Types

DMLoG.AI has four main character categories, each serving different purposes in practice sessions.

### Player Characters (For Practice)

AI-generated player characters that act as party members during DM practice:

```typescript
interface PlayerCharacter extends DMLogCharacter {
  playerPersona: PlayerPersona;
  playstyle: Playstyle;
  metaAwareness: number;  // 0-1: How much they "know" it's a game
}

enum PlayerPersona {
  // Classic player types
  THE_OPTIMIZER,      // Min-maxer, rules-focused
  THE_ROLEPLAYER,     // Character immersion, acting
  THE_STORY_SEEKER,   // Narrative-focused, choices matter
  THE_LOOTER,         // Treasure-hunting, inventory-focused
  THE_TACTICIAN,      // Combat strategy, positioning
  THE_CHAOS_AGENT,    // Unpredictable, disruptive

  // Helpful practice types
  THE_NEWBIE,         // Asks questions, learning the game
  THE_VETERAN,        // Knows rules, helps others
  THE_RULES_LAWYER,   // Catches DM mistakes, corrects calls
  THE_PROBLEM_SOLVER, // Works with DM, creative solutions
}

interface Playstyle {
  initiative: number;      // 0-1: How often they drive action
  riskTolerance: number;   // 0-1: Reckless to cautious
  ruleAdherence: number;   // 0-1: Strict to loose interpretation
  teamFocus: number;       // 0-1: Selfish to selfless
  talkativeness: number;   // 0-1: Quiet to verbose
}
```

#### Example Player Characters

**Theron Ironheart - The Veteran Paladin**
```typescript
{
  name: "Theron Ironheart",
  characterClass: CharacterClass.PALADIN,
  level: 7,

  personality: {
    openness: 0.5,
    conscientiousness: 0.9,
    extraversion: 0.6,
    agreeableness: 0.85,
    neuroticism: 0.15,
    honor: 0.95,
    piety: 0.8,
    greed: 0.2,
    bloodlust: 0.3,
  },

  playerPersona: PlayerPersona.THE_VETERAN,
  playstyle: {
    initiative: 0.7,
    riskTolerance: 0.5,
    ruleAdherence: 0.9,
    teamFocus: 0.95,
    talkativeness: 0.6,
  },

  backstory: "A former commander of the Iron Legion, Theron has seen decades of warfare. Now he serves as a mentor to younger adventurers, though he carries the weight of every soldier lost under his command.",

  goals: [
    "Protect the innocent from darkness",
    "Pass on wisdom to the next generation",
    "Find redemption for past failures"
  ],

  behavioralNotes: `
    - Always asks about enemy numbers and positioning
    - Protects vulnerable party members
    - Gently corrects rules misunderstandings
    - References past battles and lessons learned
    - Prays before each battle
  `
}
```

**Zara Quickfoot - The Chaos Rogue**
```typescript
{
  name: "Zara Quickfoot",
  characterClass: CharacterClass.ROGUE,
  level: 5,

  personality: {
    openness: 0.9,
    conscientiousness: 0.3,
    extraversion: 0.8,
    agreeableness: 0.4,
    neuroticism: 0.6,
    honor: 0.3,
    greed: 0.85,
    deceit: 0.8,
    humor: 0.7,
  },

  playerPersona: PlayerPersona.THE_CHAOS_AGENT,
  playstyle: {
    initiative: 0.9,
    riskTolerance: 0.95,
    ruleAdherence: 0.4,
    teamFocus: 0.5,
    talkativeness: 0.85,
  },

  backstory: "A street urchin who stole her way into the Thieves' Guild, Zara lives for the thrill of the heist. She's been running from the guild ever since she "accidentally" stole the guildmaster's favorite dagger.",

  goals: [
    "Pull off the perfect heist",
    "Stay ahead of the guild assassins",
    "Amass enough wealth to buy a noble title"
  ],

  behavioralNotes: `
    - Always looks for treasure, even in combat
    - Takes unnecessary risks for dramatic moments
    - Negotiates with enemies mid-fight
    - Suggests wildcard plans that ignore rules
    - Makes constant jokes and puns
  `
}
```

### NPCs (Interactive)

Interactive NPCs that players can converse with, recruit, or fight:

```typescript
interface NPC extends DMLogCharacter {
  npcType: NPCType;
  role: NPCRole;
  conversationalStyle: ConversationalStyle;
  knowledgeBase: KnowledgeTopic[];
  dialogueTree: DialogueNode;
}

enum NPCType {
  // Social NPCs
  VILLAGER,         // Common person, local knowledge
  MERCHANT,         // Trading, goods, rumors
  NOBLE,            // Authority, politics, resources
  SCHOLAR,          // Knowledge, research, lore
  PRIEST,           // Religious services, healing, guidance

  // Adventure NPCs
  QUEST_GIVER,      // Mission provider, plot hooks
  INNKEEPER,        // Rest, rumors, information hub
  BLACKSMITH,       // Equipment, repairs, crafting
  HERBALIST,        // Potions, healing, nature knowledge

  // Combat NPCs
  MINION,           // Weak enemies, encounters
  LIEUTENANT,       // Mid-bosses, named enemies
  VILLAIN,          // Major antagonists, complex motives
  BOSS,             // Climax encounters, special abilities

  // Special NPCs
  MENTOR,           // Teaching, guidance, quests
  RIVAL,            // Competition, recurring presence
  INFO_BROKER,      // Secrets, rumors, selling info
  COMPANION,        // Recruit, party member potential
}

interface ConversationalStyle {
  formality: number;       // 0-1: Casual to formal
  verbosity: number;       // 0-1: Brief to elaborate
  secretiveness: number;   // 0-1: Open to guarded
  friendliness: number;    // 0-1: Hostile to warm
  humor: number;           // 0-1: Serious to playful
  speechPatterns: string[]; // Verbal tics, catchphrases
}
```

#### Example Interactive NPCs

**Elder Morana - Village Wise Woman**
```typescript
{
  name: "Elder Morana",
  npcType: NPCType.SCHOLAR,
  role: NPCRole.QUEST_GIVER,

  personality: {
    openness: 0.7,
    conscientiousness: 0.6,
    extraversion: 0.3,
    agreeableness: 0.5,
    neuroticism: 0.4,
  },

  conversationalStyle: {
    formality: 0.7,
    verbosity: 0.8,
    secretiveness: 0.9,
    friendliness: 0.4,
    humor: 0.2,
    speechPatterns: [
      "speaks in riddles",
      "pauses dramatically",
      "references old sayings"
    ],
  },

  knowledgeBase: [
    "local_history",
    "folklore",
    "herbalism",
    "ancient_prophecy"  // Secret knowledge
  ],

  behavioralNotes: `
    - Won't share information directly; uses riddles
    - Tests players' wisdom and patience
    - Knows the location of the dungeon (secret)
    - Will reveal for a favor or service
    - Speaks of "the old ways" with nostalgia
  `
}
```

### NPCs (Combat)

Combat-focused NPCs with tactical AI:

```typescript
interface CombatNPC extends NPC {
  tactics: CombatTactics;
  combatPersonality: CombatPersonality;
  morale: number;           // 0-1: Fleeing to fearless
  aggressiveness: number;   // 0-1: Defensive to offensive
}

interface CombatTactics {
  preferredRange: RangePreference;
  targetingPriority: TargetingPriority[];
  retreatThreshold: number;  // HP % where they flee
  specialAbilityUsage: AbilityUsagePattern;
  teamworkBehavior: TeamworkBehavior;
}

enum RangePreference {
  MELEE,       // Always close range
  RANGED,      // Always maximum range
  HYBRID,      // Adapts to situation
  SKIRMISHER,  // Hit and run
  BRAWLER,     // Grapples and crowd control
}

enum CombatPersonality {
  BERSERKER,     // Rage, no retreat, damage focused
  TACTICIAN,     // Uses terrain, flanking, strategy
  COWARD,        // Avoids fight, flees easily
  DUELIST,       // Seeks 1v1 honorable combat
  TRAPPER,       // Uses traps, ambushes, poison
  LEADER,        // Directs minions, rallies allies
  SUPPORT,       // Buffs allies, heals
  SNIPER,        // Ranged focus, selects targets
}
```

#### Example Combat NPCs

**Grak the Relentless - Orc Warlord**
```typescript
{
  name: "Grak the Relentless",
  npcType: NPCType.LIEUTENANT,
  characterClass: CharacterClass.BARBARIAN,
  level: 6,

  combatPersonality: CombatPersonality.BERSERKER,
  tactics: {
    preferredRange: RangePreference.MELEE,
    targetingPriority: [
      "casters",
      "weakest",
      "nearest"
    ],
    retreatThreshold: 0.0,  // Never flees
    specialAbilityUsage: {
      ability: "Reckless Attack",
      trigger: "first_round",
      frequency: "always"
    },
    teamworkBehavior: "rallies_allies",
  },

  morale: 1.0,
  aggressiveness: 0.95,

  behavioralNotes: `
    - Always enters rage on first round
    - Targets spellcasters relentlessly
    - Uses intimidating presence before combat
    - Never retreats; fights to death
    - War cry grants advantage to allies
  `
}
```

**Shadow Vex - Assassin**
```typescript
{
  name: "Shadow Vex",
  npcType: NPCType.LIEUTENANT,
  characterClass: CharacterClass.ROGUE,
  level: 7,

  combatPersonality: CombatPersonality.TRAPPER,
  tactics: {
    preferredRange: RangePreference.SKIRMISHER,
    targetingPriority: [
      "isolated_targets",
      "flat_footed",
      "weakest"
    ],
    retreatThreshold: 0.4,  // Flees if hurt bad
    specialAbilityUsage: {
      ability: "Uncanny Dodge",
      trigger: "when_hit",
      frequency: "always"
    },
    teamworkBehavior: "isolates_targets",
  },

  morale: 0.6,
  aggressiveness: 0.7,

  behavioralNotes: `
    - Always attacks from stealth
    - Uses poison on weapons
    - Flees if reduced below 40% HP
    - Sets traps before combat if possible
    - Will negotiate if captured
  `
}
```

### NPCs (Social)

Social NPCs for roleplay practice:

```typescript
interface SocialNPC extends NPC {
  socialGoals: SocialGoal[];
  persuasionDC: number;
  attitude: NPCAttitude;
  influenceFactors: InfluenceFactor[];
}

enum NPCAttitude {
  HOSTILE,       // Won't help, might attack
  INDIFFERENT,   // Needs convincing
  FRIENDLY,      // Willing to help
  HELPFUL,       // Actively assists
  CHARMED,       // Influenced by magic
  FRIGHTENED,    // Scared, vulnerable to coercion
}

interface InfluenceFactor {
  factor: string;
  modifier: number;  // +/- to persuasion
  knownToPlayer: boolean;
}

// Example influence factors
const exampleInfluenceFactors = [
  { factor: "Shares noble house", modifier: +3, knownToPlayer: true },
  { factor: "Hates goblinoids", modifier: +2, knownToPlayer: false },
  { factor: "Distrusts magic", modifier: -2, knownToPlayer: false },
  { factor: "Owes favor to party's fighter", modifier: +5, knownToPlayer: true },
];
```

#### Example Social NPCs

**Lady Elara - Noble Power Broker**
```typescript
{
  name: "Lady Elara Vance",
  npcType: NPCType.NOBLE,
  role: NPCRole.INFORMATION_BROKER,

  personality: {
    openness: 0.6,
    conscientiousness: 0.8,
    extraversion: 0.7,
    agreeableness: 0.3,
    neuroticism: 0.5,
    honor: 0.4,
    deceit: 0.7,
  },

  conversationalStyle: {
    formality: 0.95,
    verbosity: 0.7,
    secretiveness: 0.8,
    friendliness: 0.6,
    humor: 0.4,
  },

  socialGoals: [
    "Maintain political position",
    "Undermine rival house",
    "Acquire ancient artifact"
  ],

  persuasionDC: 18,
  attitude: NPCAttitude.INDIFFERENT,

  influenceFactors: [
    { factor: "Respects power/heritage", modifier: +3, knownToPlayer: true },
    { factor: "Scorns commoners", modifier: -2, knownToPlayer: true },
    { factor: "Secretly fears scandal", modifier: +5, knownToPlayer: false },
    { factor: "Loves rare poetry", modifier: +2, knownToPlayer: false },
  ],

  behavioralNotes: `
    - Speaks in elevated, formal language
    - Tests players' manners and breeding
    - Willing to trade information for favors
    - Has secret scandal that could be leverage
    - Loves poetry and rare art
  `
}
```

### DM Assistants

Special AI characters designed to help Dungeon Masters:

```typescript
interface DMAssistant extends DMLogCharacter {
  assistantType: AssistantType;
  rulesKnowledge: RulesKnowledgeArea[];
  assistanceStyle: AssistanceStyle;
}

enum AssistantType {
  RULES_EXPERT,      // Rules clarifications, mechanics
  PACING_COACH,      // Session flow, tension management
  VOICE_ACTOR,       // NPC voices, roleplay示范
  LORE_KEEPER,       // Worldbuilding, consistency
  IMPROV_PARTNER,    // Yes-and collaborative storytelling
  COMBAT_MANAGER,    // Initiative, conditions, terrain
  NEWBIE_HELPER,     // Explains basics, encourages
}

interface RulesKnowledgeArea {
  area: string;
  expertise: number;  // 0-1
}

enum AssistanceStyle {
  CORRECTIVE,   // Points out mistakes directly
  SUGGESTIVE,   // Offers alternatives
  COLLABORATIVE, // Works with DM
  DEMONSTRATIVE, // Shows by example
}
```

#### Example DM Assistants

**Sage Alaric - Rules Expert**
```typescript
{
  name: "Sage Alaric",
  assistantType: AssistantType.RULES_EXPERT,

  personality: {
    openness: 0.6,
    conscientiousness: 0.95,
    extraversion: 0.4,
    agreeableness: 0.6,
    neuroticism: 0.2,
  },

  rulesKnowledge: [
    { area: "combat_actions", expertise: 0.95 },
    { area: "spellcasting", expertise: 0.9 },
    { area: "conditions", expertise: 0.95 },
    { area: "movement", expertise: 0.85 },
  ],

  assistanceStyle: AssistanceStyle.SUGGESTIVE,

  behavioralNotes: `
    - Gently corrects rules misinterpretations
    - Offers page references for rulings
    - Suggests ruling alternatives when unclear
    - Never interrupts during dramatic moments
    - Praises good calls and creative solutions

    Example responses:
    - "Actually, that action would normally provoke, but for narrative flow..."
    - "Page 177 shows that spell has a somatic component..."
    - "You could rule it either way, but most tables do..."
  `
}
```

**Muse Cordelia - Improv Partner**
```typescript
{
  name: "Muse Cordelia",
  assistantType: AssistantType.IMPROV_PARTNER,

  personality: {
    openness: 0.95,
    conscientiousness: 0.5,
    extraversion: 0.85,
    agreeableness: 0.9,
    neuroticism: 0.3,
  },

  assistanceStyle: AssistanceStyle.COLLABORATIVE,

  behavioralNotes: `
    - Always "yes-ands" DM ideas
    - Suggests interesting complications
    - Connects disconnected plot threads
    - Celebrates DM creativity
    - Offers NPC reactions and dialogue

    Example responses:
    - "Ooh, and what if the goblin is secretly...?"
    - "Yes! And that connects to what you said about..."
    - "The players will never see that coming!"
    - "What if this NPC has a personal stake in...?"
  `
}
```

### Party Roles

Characters fill standard RPG party roles:

```typescript
interface PartyRole {
  primary: PrimaryRole;
  secondary?: SecondaryRole;
  roleBehavior: RoleBehavior;
}

enum PrimaryRole {
  // Combat roles
  TANK,       // High AC, draws aggro, protects allies
  STRIKER,    // High damage, burst or sustained
  CONTROLLER, // Battlefield control, AoE, debuffs
  SUPPORT,    // Buffing, healing, condition removal

  // Non-combat roles
  FACE,       // Social situations, persuasion
  SCOUT,      // Exploration, trap detection, recon
  SPECIALIST, // Niche expertise (heist, research, etc.)
}

interface RoleBehavior {
  combat: {
    targetSelection: TargetSelection;
    positioning: Positioning;
    resourceUsage: ResourceUsage;
  };
  social: {
    initiative: number;     // 0-1: How often they lead
    approach: SocialApproach;
  };
}
```

---

## Integration

### Character SDK Usage

DMLoG characters use the `@studylog/character-sdk` as their foundation:

```typescript
import { Character, MemoryTier, DecisionTier } from '@studylog/character-sdk';

class DMLogCharacter extends Character {
  // Add RPG-specific properties
  characterClass: CharacterClass;
  level: number;
  stats: CharacterStats;
  inventory: Inventory;

  // Override think method for RPG-specific behavior
  async think(
    situation: string,
    stakes?: number,
    urgencyMs?: number
  ): Promise<CharacterResponse> {
    // Get base response from SDK
    const baseResponse = await super.think(situation, stakes, urgencyMs);

    // Apply class-specific modifiers
    return this.applyClassBehavior(baseResponse, situation);
  }

  // RPG-specific memory storage
  rememberCombat(
    event: string,
    enemies: string[],
    outcome: CombatOutcome
  ): Memory {
    return this.memory.storeEpisodic(
      `Combat: ${event}`,
      7.0,
      outcome === 'victory' ? 0.5 : -0.3,
      {
        tags: ['combat', outcome, ...enemies],
        participants: enemies,
      }
    );
  }
}
```

### Memory System for Character Growth

The 6-tier memory system powers character development:

```typescript
// Example: Character remembers a betrayal
class DMLogCharacter {
  rememberBetrayal(betrayer: string, natureOfBetrayal: string): void {
    // Store as high-importance episodic memory
    this.memory.storeEpisodic(
      `${betrayer} betrayed me: ${natureOfBetrayal}`,
      9.0,  // High importance
      -0.8, // Strong negative valence
      {
        tags: ['betrayal', betrayer],
        participants: [betrayer],
      }
    );

    // Update personality based on betrayal
    this.personality.modifyTrait('agreeableness', -0.2);
    this.personality.modifyTrait('neuroticism', +0.15);

    // Update relationship
    const relationship = this.getRelationship(betrayer);
    if (relationship) {
      relationship.type = RelationshipType.BETRAYER;
      relationship.trust = 0;
    }
  }

  // Character remembers victory
  rememberVictory(enemy: string, challenge: string): void {
    this.memory.storeEpisodic(
      `Defeated ${enemy} in ${challenge}`,
      7.0,
      0.7,  // Positive valence
      {
        tags: ['victory', enemy, challenge],
      }
    );

    // Boost confidence
    this.personality.modifyTrait('confidence', +0.1);
  }
}
```

### Escalation for Decision Quality

The escalation engine manages decision quality vs. cost:

```typescript
// DMLoG-specific escalation thresholds
const dmLogEscalationThresholds = {
  // Combat decisions
  combat: {
    botMinConfidence: 0.8,      // High threshold for routine combat
    brainMinConfidence: 0.6,    // Medium for tactical decisions
    highStakesThreshold: 0.7,   // Escalate for important fights
    criticalStakesThreshold: 0.9, // Boss fights, TPK danger
  },

  // Social decisions
  social: {
    botMinConfidence: 0.7,      // Standard NPC interaction
    brainMinConfidence: 0.5,    // Complex social situations
    highStakesThreshold: 0.6,   // Important NPCs
    criticalStakesThreshold: 0.85, // Diplomatic encounters
  },

  // Exploration decisions
  exploration: {
    botMinConfidence: 0.75,
    brainMinConfidence: 0.55,
    highStakesThreshold: 0.65,
    criticalStakesThreshold: 0.8,
  },
};

// Example escalation logic
function routeCombatDecision(context: CombatContext): DecisionTier {
  const { isBossFight, partyHealth, hasPlayerAgency } = context;

  // Always use highest tier for boss fights
  if (isBossFight) {
    return DecisionTier.HUMAN;
  }

  // Escalate if party is in danger
  if (partyHealth < 0.3) {
    return DecisionTier.HUMAN;
  }

  // Use brain for tactical situations
  if (hasPlayerAgency) {
    return DecisionTier.BRAIN;
  }

  // Bot for routine combat
  return DecisionTier.BOT;
}
```

---

## Godot Visualization

### 3D Character Models

DMLoG characters are visualized in Godot with customizable appearance:

```gdscript
# DMLogCharacter3D.gd
extends CharacterBody3D

class_name DMLogCharacter3D

@export var character_data: DMLogCharacterResource

# Visual components
@onready var skeleton = $Skeleton3D
@onready var mesh = $MeshInstance3D
@onready var equipment_slots = {
  "head": $HeadSlot,
  "chest": $ChestSlot,
  "main_hand": $MainHandSlot,
  "off_hand": $OffHandSlot,
}

# Animation
@onready var animation_tree = $AnimationTree
@onready var state_machine = animation_tree["parameters/playback"]

func _ready():
  apply_character_appearance()
  equip_starting_gear()
  set_idle_animation()

func apply_character_appearance():
  # Apply character data to visual appearance
  var appearance = character_data.appearance

  # Set body type (race, height, build)
  skeleton.set_scale(appearance.scale_vector)

  # Set skin color
  var material = mesh.get_surface_material(0)
  material.albedo_color = appearance.skin_color

  # Set hair (if applicable)
  if has_node("Hair"):
    $Hair.mesh = appearance.hair_mesh
    $Hair.get_surface_material(0).albedo_color = appearance.hair_color

func equip_item(item: EquipmentResource):
  var slot = equipment_slots[item.slot]

  # Remove old item
  if slot.get_child_count() > 0:
    slot.get_child(0).queue_free()

  # Add new item
  var item_mesh = item.mesh.instantiate()
  slot.add_child(item_mesh)
```

### Animation States

Character states drive animation behavior:

```gdscript
# Animation state machine
enum CharacterState {
  IDLE,
  WALKING,
  RUNNING,
  COMBAT_IDLE,
  ATTACKING,
  CASTING,
  TAKING_HIT,
  BLOCKING,
  DODGING,
  DYING,
  DEAD,
  TALKING,
  SOCIAL,
}

var current_state: CharacterState = CharacterState.IDLE

func set_state(new_state: CharacterState):
  current_state = new_state
  update_animation()

func update_animation():
  match current_state:
    CharacterState.IDLE:
      state_machine.travel("idle")

    CharacterState.WALKING:
      state_machine.travel("walk")

    CharacterState.COMBAT_IDLE:
      state_machine.travel("combat_idle")
      # Raise weapon
      if has_node("MainHandSlot"):
        $MainHandSlot.rotation_degrees.x = -45

    CharacterState.ATTACKING:
      state_machine.travel(get_attack_animation())

    CharacterState.CASTING:
      state_machine.travel(get_cast_animation())
      # Spawn magic effect
      spawn_magic_effect()

    CharacterState.TALKING:
      state_machine.travel("talk")
      # Enable facial animation
      $FaceAnimator.start_talking()

# Personality-driven idle variations
func get_idle_animation():
  # Return idle based on personality
  if character_data.personality.openness > 0.7:
    return "idle_curious"  # Looking around
  elif character_data.personality.extraversion > 0.7:
    return "idle_confident"  # Chest out, arms wide
  elif character_data.personality.neuroticism > 0.6:
    return "idle_nervous"  # Checking around, fidgeting
  else:
    return "idle_neutral"  # Standard ready stance
```

### Equipment Display

Equipment is visually represented on characters:

```gdscript
# Equipment display system
func equip_visual(item: EquipmentResource):
  match item.slot:
    "main_hand":
      equip_main_hand(item)
    "off_hand":
      equip_off_hand(item)
    "armor":
      equip_armor(item)
    "head":
      equip_head(item)
    "accessory":
      equip_accessory(item)

func equip_main_hand(item: EquipmentResource):
  var slot = equipment_slots.main_hand

  match item.type:
    "melee_weapon":
      var weapon = item.mesh.instantiate()
      weapon.position = Vector3(0.3, -0.2, -0.5)
      weapon.rotation_degrees = Vector3(-90, 0, -90)
      slot.add_child(weapon)

    "ranged_weapon":
      var weapon = item.mesh.instantiate()
      weapon.position = Vector3(0.2, -0.3, -0.4)
      slot.add_child(weapon)

    "spell_focus":
      var focus = item.mesh.instantiate()
      focus.position = Vector3(0.1, -0.15, -0.3)
      slot.add_child(focus)
      # Add glow effect
      var glow = preload("res://effects/magic_glow.tscn").instantiate()
      focus.add_child(glow)

    "shield":
      var shield = item.mesh.instantiate()
      shield.position = Vector3(-0.3, -0.2, -0.4)
      equipment_slots.off_hand.add_child(shield)

# Equipment affects appearance
func update_appearance_from_equipment():
  var armor = get_equipped_item("armor")

  if armor:
    # Apply armor material
    var armor_material = armor.material
    mesh.set_surface_material(1, armor_material)

    # Armor may hide body parts
    if armor.covers_helmet:
      $Head.visible = false

    # Armor affects silhouette
    if armor.is_heavy:
      skeleton.set_additional_weight_support(true)
```

### Expressive Characters

Characters show emotion through facial animation and body language:

```gdscript
# Facial expression system
enum Expression {
  NEUTRAL,
  HAPPY,
  SAD,
  ANGRY,
  FEARFUL,
  SURPRISED,
  DISGUSTED,
  SUSPICIOUS,
  LOVING,
  PROUD,
}

func set_expression(expression: Expression, intensity: float = 1.0):
  var face = $FaceController

  match expression:
    Expression.NEUTRAL:
      face.set_blend_shape("Eyes_Blink", 0.0)
      face.set_blend_shape("Mouth_Smile", 0.0)
      face.set_blend_shape("Brows_Raise", 0.2)

    Expression.HAPPY:
      face.set_blend_shape("Eyes_Squint", intensity * 0.5)
      face.set_blend_shape("Mouth_Smile", intensity)
      face.set_blend_shape("Brows_Raise", intensity * 0.3)

    Expression.ANGRY:
      face.set_blend_shape("Eyes_Glare", intensity * 0.7)
      face.set_blend_shape("Mouth_Grimace", intensity * 0.8)
      face.set_blend_shape("Brows_Angry", intensity)

    Expression.FEARFUL:
      face.set_blend_shape("Eyes_Wide", intensity)
      face.set_blend_shape("Mouth_Open", intensity * 0.5)
      face.set_blend_shape("Brows_Raise", intensity * 0.8)

# Body language based on personality
func apply_body_language():
  var spine = $Skeleton3D/Spine
  var shoulders = $Skeleton3D/Spine/Shoulders

  # Openness affects posture
  if character_data.personality.openness > 0.7:
    # Open, expansive posture
    shoulders.rotation_degrees.y = 15.0
  elif character_data.personality.openness < 0.3:
    # Closed, guarded posture
    shoulders.rotation_degrees.y = -10.0
    spine.rotation_degrees.z = 5.0  # Slight hunch

  # Extraversion affects animation speed
  var speed_scale = 0.8 + (character_data.personality.extraversion * 0.4)
  animation_tree.time_scale = speed_scale
```

---

## Code Examples

### Character Generation

```typescript
// Generate a random NPC
function generateRandomNPC(options?: Partial<NPCGenerationOptions>): DMLogNPC {
  const options_: NPCGenerationOptions = {
    level: options?.level ?? randomInRange(1, 10),
    race: options?.race ?? randomRace(),
    characterClass: options?.characterClass ?? randomClass(),
    background: options?.background ?? randomBackground(),
    ...options,
  };

  // Generate personality
  const personality = generatePersonality(options_);

  // Generate stats based on class and race
  const stats = generateStats(options_);

  // Generate equipment
  const equipment = generateEquipment(options_);

  // Generate backstory
  const backstory = generateBackstory(options_, personality);

  return new DMLogNPC({
    name: generateName(options_.race),
    characterClass: options_.characterClass,
    race: options_.race,
    level: options_.level,
    personality,
    stats,
    equipment,
    backstory,
    goals: generateGoals(personality, options_),
    fears: generateFears(personality, options_),
  });
}

// Personality based on class/race combination
function generatePersonality(options: NPCGenerationOptions): Personality {
  const base = CLASS_PERSONALITY_BASES[options.characterClass];
  const raceModifier = RACE_PERSONALITY_MODIFIERS[options.race];

  return {
    openness: clamp(base.openness + raceModifier.openness + randomFloat(-0.1, 0.1)),
    conscientiousness: clamp(base.conscientiousness + raceModifier.conscientiousness + randomFloat(-0.1, 0.1)),
    extraversion: clamp(base.extraversion + raceModifier.extraversion + randomFloat(-0.1, 0.1)),
    agreeableness: clamp(base.agreeableness + raceModifier.agreeableness + randomFloat(-0.1, 0.1)),
    neuroticism: clamp(base.neuroticism + raceModifier.neuroticism + randomFloat(-0.1, 0.1)),
  };
}

// Class personality bases
const CLASS_PERSONALITY_BASES: Record<CharacterClass, Personality> = {
  [CharacterClass.PALADIN]: {
    openness: 0.5,
    conscientiousness: 0.9,
    extraversion: 0.6,
    agreeableness: 0.8,
    neuroticism: 0.2,
  },
  [CharacterClass.ROGUE]: {
    openness: 0.8,
    conscientiousness: 0.4,
    extraversion: 0.5,
    agreeableness: 0.3,
    neuroticism: 0.5,
  },
  // ... etc
};
```

### Personality-Driven Responses

```typescript
// Generate responses based on personality
class PersonalityResponseGenerator {
  generateResponse(
    character: DMLogCharacter,
    situation: string,
    context: GameContext
  ): string {
    const personality = character.personality;
    const mood = character.mood;

    // Base response generation
    let response = this.getBaseResponse(character, situation, context);

    // Apply personality modifiers
    response = this.applyOpenness(response, personality.openness);
    response = this.applyConscientiousness(response, personality.conscientiousness);
    response = this.applyExtraversion(response, personality.extraversion);
    response = this.applyAgreeableness(response, personality.agreeableness);
    response = this.applyNeuroticism(response, personality.neuroticism);

    // Apply mood modifier
    response = this.applyMood(response, mood);

    return response;
  }

  private applyOpenness(response: string, openness: number): string {
    if (openness > 0.8) {
      // Add creative, speculative elements
      response += " Perhaps there's more to this than meets the eye?";
    } else if (openness < 0.3) {
      // Add traditional, practical elements
      response = "Let's stick to what we know. " + response;
    }
    return response;
  }

  private applyExtraversion(response: string, extraversion: number): string {
    if (extraversion > 0.8) {
      // Make more enthusiastic, group-focused
      response = "Friends! " + response;
      response = response.replace("I", "we");
    } else if (extraversion < 0.3) {
      // Make more reserved, thoughtful
      response = response.toLowerCase();
      response = "Hmm... " + response;
    }
    return response;
  }

  private applyAgreeableness(response: string, agreeableness: number): string {
    if (agreeableness > 0.8) {
      // Add polite, cooperative elements
      if (!response.includes("please")) {
        response = response.replace("?", ", please?");
      }
    } else if (agreeableness < 0.3) {
      // Add direct, confrontational elements
      response = response.replace("could we", "we should");
      response = response.replace("might", "will");
    }
    return response;
  }
}
```

### Combat Behavior by Class

```typescript
// Class-specific combat AI
class CombatBehaviorController {
  getCombatAction(
    character: DMLogCharacter,
    combat: CombatState
  ): CombatAction {
    switch (character.characterClass) {
      case CharacterClass.FIGHTER:
        return this.getFighterAction(character, combat);
      case CharacterClass.ROGUE:
        return this.getRogueAction(character, combat);
      case CharacterClass.WIZARD:
        return this.getWizardAction(character, combat);
      case CharacterClass.CLERIC:
        return this.getClericAction(character, combat);
      default:
        return this.getDefaultAction(character, combat);
    }
  }

  private getFighterAction(character: DMLogCharacter, combat: CombatState): CombatAction {
    const allies = combat.getAllies(character);
    const enemies = combat.getEnemies(character);

    // Personality affects tactics
    if (character.personality.conscientiousness > 0.7) {
      // Tactical fighter - protects allies
      const vulnerableAlly = this.findMostVulnerable(allies);
      const threateningEnemy = this.findEnemyThreatening(enemies, vulnerableAlly);

      return {
        type: 'attack',
        target: threateningEnemy,
        method: 'melee',
        strategy: 'protect_ally',
        dialogue: `I won't let you harm ${vulnerableAlly.name}!`,
      };
    } else if (character.personality.bloodlust > 0.7) {
      // Aggressive fighter - targets strongest
      const strongestEnemy = this.findStrongest(enemies);

      return {
        type: 'attack',
        target: strongestEnemy,
        method: 'melee',
        strategy: 'aggressive',
        dialogue: `Face me, ${strongestEnemy.name}!`,
      };
    } else {
      // Standard fighter - nearest enemy
      return {
        type: 'attack',
        target: this.findNearest(enemies, character.position),
        method: 'melee',
        strategy: 'standard',
        dialogue: 'For glory!',
      };
    }
  }

  private getRogueAction(character: DMLogCharacter, combat: CombatState): CombatAction {
    const enemies = combat.getEnemies(character);
    const hasAdvantage = this.checkAdvantage(character, enemies);

    // Rogue personality affects approach
    if (character.personality.deceit > 0.7 && !hasAdvantage) {
      // Sneaky rogue - tries to hide
      return {
        type: 'skill',
        skill: 'stealth',
        strategy: 'gain_advantage',
        dialogue: 'Let me get into position...',
      };
    }

    const target = this.findBestRogueTarget(enemies, character);

    return {
      type: 'attack',
      target: target,
      method: 'sneak_attack',
      strategy: hasAdvantage ? 'sneak_attack' : 'standard_attack',
      dialogue: hasAdvantage ? 'Didn't see me coming.' : 'Need an opening...',
    };
  }

  private getWizardAction(character: DMLogCharacter, combat: CombatState): CombatAction {
    const allies = combat.getAllies(character);
    const enemies = combat.getEnemies(character);
    const spellSlots = character.getSpellSlots();

    // High wisdom/intelligence = smarter spell selection
    const intelligence = character.stats.intelligence;

    if (this.shouldCastBuff(character, combat)) {
      const target = intelligence > 14 ? this.findBestBuffTarget(allies) : character;
      return {
        type: 'spell',
        spell: 'haste',
        target: target,
        strategy: 'buff',
        dialogue: `${target.name}, with this boon, strike true!`,
      };
    }

    if (this.shouldCastControl(character, combat)) {
      const enemies = combat.getEnemies(character);
      const clusteredEnemies = this.findClusteredEnemies(enemies);

      return {
        type: 'spell',
        spell: intelligence > 16 ? 'hypnotic_pattern' : 'color_spray',
        target: clusteredEnemies[0],
        strategy: 'control',
        dialogue: 'Sleep now.',
      };
    }

    // Default: damage spell
    const target = this.findBestTarget(enemies);
    return {
      type: 'spell',
      spell: spellSlots.level >= 3 ? 'fireball' : 'magic_missile',
      target: target,
      strategy: 'damage',
      dialogue: intelligence > 16 ? 'Ignis!' : 'Take this!',
    };
  }

  private getClericAction(character: DMLogCharacter, combat: CombatState): CombatAction {
    const allies = combat.getAllies(character);
    const enemies = combat.getEnemies(character);
    const partyHealth = this.getAveragePartyHealth(allies);

    // High piety/compassion = prioritize healing
    const piety = character.personality.piety;
    const agreeableness = character.personality.agreeableness;

    // Check if healing is needed
    if (partyHealth < 0.5 && (piety > 0.7 || agreeableness > 0.7)) {
      const wounded = this.findMostWounded(allies);
      return {
        type: 'spell',
        spell: character.getSpellSlots().level >= 2 ? 'cure_wounds' : 'healing_word',
        target: wounded,
        strategy: 'heal',
        dialogue: `${character.deity.name}, grant succor to ${wounded.name}!`,
      };
    }

    // Check for buffing
    if (this.shouldBuffParty(allies)) {
      return {
        type: 'spell',
        spell: 'bless',
        target: allies,  // AoE
        strategy: 'buff',
        dialogue: `May ${character.deity.name}'s light guide you!`,
      };
    }

    // Default: attack or cantrip
    const target = this.findBestTarget(enemies);
    return {
      type: 'attack',
      method: 'spell',
      spell: 'sacred_flame',
      target: target,
      strategy: 'damage',
      dialogue: 'Feel the judgment!',
    };
  }
}
```

### Social Interaction Example

```typescript
// Social encounter system
class SocialInteractionController {
  async handleSocialInteraction(
    npc: NPC,
    player: PlayerCharacter,
    interactionType: SocialInteractionType,
    input: string
  ): Promise<SocialResponse> {
    // Get NPC's attitude toward player
    const attitude = this.getAttitude(npc, player);

    // Personality affects how NPC processes input
    const personality = npc.personality;

    // Determine response based on personality and attitude
    let response: string;
    let newAttitude: NPCAttitude = attitude;

    // High agreeableness = more forgiving and friendly
    const friendlinessBonus = personality.agreeableness * 0.3;

    // High openness = more curious about strangers
    const curiosityBonus = personality.openness * 0.2;

    // Process the interaction
    switch (interactionType) {
      case SocialInteractionType.PERSUADE:
        response = this.handlePersuasion(npc, player, input);
        break;
      case SocialInteractionType.INTIMIDATE:
        response = this.handleIntimidation(npc, player, input);
        break;
      case SocialInteractionType.DECEIVE:
        response = this.handleDeception(npc, player, input);
        break;
      case SocialInteractionType.CHARM:
        response = this.handleCharm(npc, player, input);
        break;
      default:
        response = this.handleGeneralConversation(npc, player, input);
    }

    // Attitude shift based on personality and interaction
    newAttitude = this.calculateAttitudeShift(attitude, interactionType, personality, input);

    // Store memory of interaction
    npc.rememberInteraction(player, interactionType, newAttitude);

    return {
      response,
      attitude: newAttitude,
      relationshipChange: this.getRelationshipChange(attitude, newAttitude),
    };
  }

  private handlePersuasion(npc: NPC, player: PlayerCharacter, input: string): string {
    const personality = npc.personality;

    // Base resistance to persuasion
    let resistance = 0.5;

    // Personality affects persuasion difficulty
    if (personality.conscientiousness > 0.7) {
      // Harder to persuade principled characters
      resistance += 0.2;
    }

    if (personality.openness > 0.7) {
      // Easier to persuade open characters
      resistance -= 0.2;
    }

    // Generate response based on personality
    if (resistance > 0.7) {
      return this.getRefusalResponse(npc, input);
    } else if (resistance < 0.3) {
      return this.getAcceptanceResponse(npc, input);
    } else {
      return this.getUncertainResponse(npc, input);
    }
  }

  private getRefusalResponse(npc: NPC, input: string): string {
    const personality = npc.personality;

    if (personality.honor > 0.8) {
      return `I cannot do that. It would go against everything I believe in.`;
    } else if (personality.conscientiousness > 0.7) {
      return `I've thought about this carefully, and I must decline.`;
    } else if (personality.agreeableness < 0.3) {
      return `No. Why would I even consider that?`;
    } else {
      return `I'm sorry, but I can't help you with that.`;
    }
  }
}
```

---

## Reference Tables

### Alignment to Personality Mapping

| Alignment | High Traits | Low Traits | Typical Classes |
|-----------|------------|------------|-----------------|
| Lawful Good | Conscientiousness, Agreeableness, Honor | Neuroticism, Deceit | Paladin, Monk |
| Neutral Good | Agreeableness, Openness | Greed, Bloodlust | Cleric, Bard |
| Chaotic Good | Openness, Empathy | Conscientiousness | Bard, Sorcerer |
| Lawful Neutral | Conscientiousness, Honor | Openness | Monk, Wizard |
| True Neutral | Balanced traits | Extremes | Druid, Fighter |
| Chaotic Neutral | Openness, Wanderlust | Conscientiousness, Honor | Rogue, Bard |
| Lawful Evil | Conscientiousness, Honor | Agreeableness | Tyrant, Dark Knight |
| Neutral Evil | Greed, Deceit | Empathy, Honor | Rogue, Warlock |
| Chaotic Evil | Bloodlust, Chaos | Conscientiousness, Empathy | Barbarian, Sorcerer |

### Background to Skill Mapping

| Background | Granted Skills | Suggested Traits |
|------------|----------------|-----------------|
| Acolyte | Religion, Insight | Piety, Agreeableness |
| Charlatan | Deception, Sleight of Hand | Deceit, Extraversion |
| Criminal | Stealth, Deception | Deceit, Caution |
| Entertainer | Performance, Acrobatics | Extraversion, Openness |
| Folk Hero | Survival, Animal Handling | Honor, Conscientiousness |
| Guild Artisan | Insight, Persuasion | Conscientiousness, Greed |
| Hermit | Religion, Medicine | Openness, Neuroticism |
| Noble | History, Persuasion | Honor, Extraversion |
| Outlander | Survival, Athletics | Openness, Wanderlust |
| Sage | Arcana, History | Openness, Conscientiousness |
| Soldier | Athletics, Intimidation | Conscientiousness, Honor |
| Urchin | Sleight of Hand, Stealth | Deceit, Caution |

### Class to Recommended Traits

| Class | Key Traits | Secondary Traits | Personality Notes |
|-------|------------|------------------|------------------|
| Barbarian | Low Conscientiousness, High Extraversion | Low Neuroticism, High Bloodlust | Impulsive, passionate, direct |
| Bard | High Openness, High Extraversion | High Agreeableness, High Humor | Creative, social, versatile |
| Cleric | High Conscientiousness, High Agreeableness | High Piety, Low Neuroticism | Principled, supportive, devout |
| Druid | High Openness, Low Extraversion | High Primal Instinct, Low Conscientiousness | Nature-focused, balance-seeking, wild |
| Fighter | High Conscientiousness, Moderate Extraversion | High Honor, Moderate Bloodlust | Tactical, protective, direct |
| Monk | High Conscientiousness, Low Neuroticism | High Openness, Low Extraversion | Disciplined, philosophical, centered |
| Paladin | Very High Conscientiousness, Very Low Neuroticism | Very High Honor, High Agreeableness | Principled, protective, smiting |
| Ranger | High Openness, Low Extraversion | Low Neuroticism, High Wanderlust | Observant, practical, nature-focused |
| Rogue | High Openness, Low Agreeableness | High Deceit, Low Conscientiousness | Pragmatic, opportunistic, self-interested |
| Sorcerer | High Openness, Moderate Extraversion | High Neuroticism, High Arcane Attunement | Instinctive, emotional, charismatic |
| Warlock | High Openness, Low Agreeableness | Moderate Neuroticism, High Deceit | Transactional, secretive, pact-aware |
| Wizard | Very High Openness, High Conscientiousness | Low Extraversion, High Arcane Attunement | Analytical, prepared, knowledge-seeking |

### Combat Role to Stat Priority

| Role | Primary Stat | Secondary Stat | Tertiary Stat | Save Proficiencies |
|------|--------------|----------------|---------------|-------------------|
| Tank | Constitution/Strength | Dexterity | Wisdom | Constitution, Wisdom |
| Striker | Strength/Dexterity | Constitution | Charisma | Strength, Dexterity |
| Controller | Intelligence/Charisma | Constitution | Wisdom | Intelligence, Wisdom |
| Support | Wisdom/Charisma | Constitution | Intelligence | Wisdom, Charisma |
| Face | Charisma | Wisdom/Intelligence | Constitution | Charisma, Intelligence |
| Scout | Dexterity | Wisdom | Constitution | Dexterity, Intelligence |

### Relationship Change Rates

| Event Type | Trust Change | Respect Change | Affection Change | Notes |
|------------|-------------|----------------|------------------|-------|
| Life Saved | +0.5 | +0.3 | +0.2 | Creates strong debt |
| Betrayal | -0.7 | -0.5 | -0.4 | Hard to recover |
| Shared Victory | +0.1 | +0.1 | +0.1 | Incremental bonding |
| Argument | -0.1 | -0.05 | -0.05 | Minor damage |
| Gift Given | +0.2 | +0.0 | +0.1 | Generosity appreciated |
| Long Absence | -0.05 | -0.1 | -0.1 | Distance fades bonds |
| Secret Shared | +0.3 | +0.1 | +0.2 | Vulnerability builds trust |
| Promise Kept | +0.15 | +0.2 | +0.1 | Honored commitments |
| Promise Broken | -0.4 | -0.3 | -0.2 | Reputation damage |

---

## Summary

The DMLoG.AI Character Development System provides:

1. **Rich personality modeling** using Big Five traits plus RPG-specific attributes
2. **Authentic class behaviors** that make each character type feel distinct
3. **Memory-based growth** allowing characters to evolve through play
4. **Dynamic relationships** that change based on interactions
5. **Story arc generation** for long-term character development
6. **Visual representation** in Godot with animations and equipment
7. **DM assistant characters** for practice session support
8. **Cost-optimized decisions** through the escalation engine

This system creates memorable NPCs and party members that enhance DM practice sessions while teaching good TTRPG techniques.

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-10
**Status:** Design Complete - Ready for Implementation
