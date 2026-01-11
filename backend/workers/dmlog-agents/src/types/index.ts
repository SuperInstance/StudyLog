/**
 * DMLoG.AI - Agent Orchestration Types
 *
 * Unified multi-agent orchestration system for both StudyLoG.AI and DMLoG.AI
 * Implements biological agent mapping: Zooplankton, Herring, Deckhand, Captain, Whale, Fleet, Dog
 *
 * @packageDocumentation
 */

// ============================================================================
// Biological Agent Mapping (Unified for StudyLoG and DMLoG)
// ============================================================================

/**
 * Biological agent types mapped to AI architectures
 * Each agent type has specific capabilities and resource requirements
 */
export enum BiologicalAgent {
  /** Token-level processing, basic pattern matching */
  ZOOPLANKTON = 'zooplankton',
  /** Vector swarm, flocking simulations, coordinated movement */
  HERRING = 'herring',
  /** SLM + LoRA, quick specialized decisions */
  DECKHAND = 'deckhand',
  /** Director agent, party/campaign leadership */
  CAPTAIN = 'captain',
  /** Orchestrator, multi-agent coordination (DM Agent equivalent) */
  WHALE = 'whale',
  /** A2A network, agent ecosystem, faction systems */
  FLEET = 'fleet',
  /** LoRA adapter, fine-tuning, character personalities */
  DOG = 'dog',
}

/**
 * Agent capabilities description
 */
export interface AgentCapabilities {
  biologicalType: BiologicalAgent;
  canLead: boolean;
  canFollow: boolean;
  canCoordinate: boolean;
  maxTeamSize: number;
  preferredContext: string[];
  resourceCost: number; // 0-1 scale
}

/**
 * Capability mapping for each biological agent type
 */
export const BIOLOGICAL_CAPABILITIES: Record<BiologicalAgent, AgentCapabilities> = {
  [BiologicalAgent.ZOOPLANKTON]: {
    biologicalType: BiologicalAgent.ZOOPLANKTON,
    canLead: false,
    canFollow: true,
    canCoordinate: false,
    maxTeamSize: 1,
    preferredContext: ['token-processing', 'pattern-match', 'basic-parse'],
    resourceCost: 0.01,
  },
  [BiologicalAgent.HERRING]: {
    biologicalType: BiologicalAgent.HERRING,
    canLead: false,
    canFollow: true,
    canCoordinate: true,
    maxTeamSize: 50,
    preferredContext: ['flocking', 'horde-combat', 'swarm-tactics'],
    resourceCost: 0.1,
  },
  [BiologicalAgent.DECKHAND]: {
    biologicalType: BiologicalAgent.DECKHAND,
    canLead: false,
    canFollow: true,
    canCoordinate: false,
    maxTeamSize: 5,
    preferredContext: ['quick-checks', 'fast-npc', 'utility'],
    resourceCost: 0.2,
  },
  [BiologicalAgent.CAPTAIN]: {
    biologicalType: BiologicalAgent.CAPTAIN,
    canLead: true,
    canFollow: false,
    canCoordinate: true,
    maxTeamSize: 6,
    preferredContext: ['party-leader', 'tutorial-guide', 'director'],
    resourceCost: 0.6,
  },
  [BiologicalAgent.WHALE]: {
    biologicalType: BiologicalAgent.WHALE,
    canLead: true,
    canFollow: false,
    canCoordinate: true,
    maxTeamSize: 100,
    preferredContext: ['orchestration', 'dungeon-master', 'multi-agent-coordinator'],
    resourceCost: 1.0,
  },
  [BiologicalAgent.FLEET]: {
    biologicalType: BiologicalAgent.FLEET,
    canLead: true,
    canFollow: false,
    canCoordinate: true,
    maxTeamSize: 1000,
    preferredContext: ['agent-ecosystem', 'faction-system', 'world-state'],
    resourceCost: 0.8,
  },
  [BiologicalAgent.DOG]: {
    biologicalType: BiologicalAgent.DOG,
    canLead: false,
    canFollow: true,
    canCoordinate: false,
    maxTeamSize: 1,
    preferredContext: ['fine-tuning', 'character-personality', 'adaptation'],
    resourceCost: 0.15,
  },
};

// ============================================================================
// Core Agent Types
// ============================================================================

/**
 * DMLoG-specific agent roles
 */
export enum DMLoGAgentRole {
  /** Tactical combat decisions, initiative management */
  COMBAT = 'combat',
  /** Dialogue, relationship dynamics, social encounters */
  SOCIAL = 'social',
  /** Discovery, loot generation, exploration */
  EXPLORATION = 'exploration',
  /** Session orchestration, narrative flow */
  DUNGEON_MASTER = 'dungeon_master',
  /** Party coordination, tactical positioning */
  PARTY_LEADER = 'party_leader',
  /** Individual NPC AI */
  NPC = 'npc',
  /** Monster AI, combat encounters */
  MONSTER = 'monster',
}

/**
 * StudyLoG-specific agent roles (for unified backend)
 */
export enum StudyLoGAgentRole {
  /** Educational content delivery */
  TUTOR = 'tutor',
  /** Tutorial guidance */
  GUIDE = 'guide',
  /** Code generation and review */
  BUILDER = 'builder',
  /** Verification and testing */
  TESTER = 'tester',
  /** Student progress tracking */
  MENTOR = 'mentor',
}

/**
 * Combined agent role type
 */
export type AgentRole = DMLoGAgentRole | StudyLoGAgentRole;

/**
 * Agent state
 */
export enum AgentState {
  IDLE = 'idle',
  THINKING = 'thinking',
  ACTING = 'acting',
  WAITING = 'waiting',
  COORDINATING = 'coordinating',
  DISABLED = 'disabled',
}

// ============================================================================
// Decision and Escalation Types (Extended from escalation package)
// ============================================================================

/**
 * Decision source for agent decisions
 */
export enum DecisionSource {
  /** Rule-based, deterministic, free */
  BOT = 'bot',
  /** Local LLM or personality-driven */
  BRAIN = 'brain',
  /** Cloud API, higher cost */
  HUMAN = 'human',
  /** DM override */
  OVERRIDE = 'override',
}

/**
 * Context for agent decision making
 */
export interface AgentDecisionContext {
  /** Agent making the decision */
  agentId: string;
  /** Agent role */
  role: AgentRole;
  /** Current situation description */
  situation: string;
  /** Situation type */
  situationType: SituationType;
  /** Importance level (0-1) */
  stakes: number;
  /** Time constraint in ms */
  urgencyMs?: number;
  /** Current location/scene */
  location: string;
  /** Other entities involved */
  participants: string[];
  /** Available resources */
  availableResources: Record<string, number>;
  /** Campaign/session ID */
  sessionId: string;
  /** Additional context */
  metadata: Record<string, unknown>;
}

/**
 * Situation types for DMLoG
 */
export enum SituationType {
  COMBAT = 'combat',
  SOCIAL = 'social',
  EXPLORATION = 'exploration',
  PUZZLE = 'puzzle',
  DOWNTIME = 'downtime',
  SHOPPING = 'shopping',
  REST = 'rest',
  TRAVEL = 'travel',
  INVESTIGATION = 'investigation',
  SKILL_CHECK = 'skill_check',
  SAVING_THROW = 'saving_throw',
  ROLEPLAY = 'roleplay',
  /** StudyLoG specific */
  LEARNING = 'learning',
  PRACTICE = 'practice',
  ASSESSMENT = 'assessment',
}

/**
 * Result of an agent decision
 */
export interface AgentDecision {
  /** Unique decision ID */
  decisionId: string;
  /** Agent that made the decision */
  agentId: string;
  /** Agent role */
  role: AgentRole;
  /** Decision source */
  source: DecisionSource;
  /** Spoken/communicated content */
  content: string;
  /** Action to take */
  action: string;
  /** Action parameters */
  actionParams?: Record<string, unknown>;
  /** Confidence level (0-1) */
  confidence: number;
  /** Time taken in ms */
  timeTakenMs: number;
  /** Estimated cost in USD */
  costEstimate: number;
  /** Internal thoughts */
  thoughts?: string;
  /** Emotional state */
  emotions?: Record<string, number>;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Character and Entity Types
// ============================================================================

/**
 * Base entity in the game world (PC, NPC, Monster)
 */
export interface GameEntity {
  /** Unique entity ID */
  id: string;
  /** Entity name */
  name: string;
  /** Type of entity */
  type: EntityType;
  /** Current hit points */
  hp: number;
  /** Maximum hit points */
  hpMax: number;
  /** Armor class */
  armorClass: number;
  /** Position on battle map */
  position?: Vector3D;
  /** Initiative score (for combat) */
  initiative?: number;
  /** Current status effects */
  statusEffects: StatusEffect[];
  /** Entity tags */
  tags: string[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Entity types
 */
export enum EntityType {
  PLAYER_CHARACTER = 'player_character',
  NPC = 'npc',
  MONSTER = 'monster',
  HENCHMAN = 'henchman',
  FAMILIAR = 'familiar',
  SUMMON = 'summon',
  OBJECT = 'object',
}

/**
 * Status effect
 */
export interface StatusEffect {
  /** Effect name */
  name: string;
  /** Effect type */
  type: StatusEffectType;
  /** Remaining duration in rounds */
  duration: number;
  /** Effect value */
  value?: number;
  /** Source of effect */
  source?: string;
}

/**
 * Status effect types
 */
export enum StatusEffectType {
  BUFF = 'buff',
  DEBUFF = 'debuff',
  CONDITION = 'condition',
  DAMAGE = 'damage',
  HEALING = 'healing',
  CONTROL = 'control',
}

/**
 * 3D Vector for positions
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// Combat Types
// ============================================================================

/**
 * Combat encounter state
 */
export interface CombatState {
  /** Unique combat ID */
  combatId: string;
  /** Session/campaign ID */
  sessionId: string;
  /** All combatants */
  combatants: Combatant[];
  /** Current round */
  currentRound: number;
  /** Current turn index */
  currentTurnIndex: number;
  /** Combat status */
  status: CombatStatus;
  /** Combat log */
  combatLog: CombatLogEntry[];
  /** Map dimensions */
  mapDimensions?: {
    width: number;
    height: number;
    gridSize: number;
  };
  /** Terrain features */
  terrain?: TerrainFeature[];
  /** Started at timestamp */
  startedAt: number;
  /** Last updated timestamp */
  updatedAt: number;
}

/**
 * Combat status
 */
export enum CombatStatus {
  INITIATIVE = 'initiative',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
  FLED = 'fled',
  TPK = 'tpk', // Total Party Kill
}

/**
 * Individual combatant
 */
export interface Combatant extends GameEntity {
  /** Team/side */
  team: CombatTeam;
  /** Has acted this round */
  hasActed: boolean;
  /** Is this combatant a player */
  isPlayer: boolean;
  /** Combat statistics */
  stats: CombatStats;
  /** Available actions */
  availableActions: CombatAction[];
  /** Current targets */
  currentTargets: string[];
}

/**
 * Combat team
 */
export enum CombatTeam {
  PARTY = 'party',
  ENEMIES = 'enemies',
  NEUTRAL = 'neutral',
  ALLIES = 'allies',
}

/**
 * Combat statistics
 */
export interface CombatStats {
  /** Attack bonus */
  attackBonus: number;
  /** Damage per hit */
  damage: DiceRoll;
  /** Speed (movement) */
  speed: number;
  /** Saving throws */
  savingThrows: Partial<Record<SavingThrow, number>>;
  /** Skills */
  skills: Partial<Record<string, number>>;
}

/**
 * Saving throw types
 */
export enum SavingThrow {
  FORTITUDE = 'fortitude',
  REFLEX = 'reflex',
  WILL = 'will',
  STRENGTH = 'strength',
  DEXTERITY = 'dexterity',
  CONSTITUTION = 'constitution',
  INTELLIGENCE = 'intelligence',
  WISDOM = 'wisdom',
  CHARISMA = 'charisma',
}

/**
 * Dice roll notation
 */
export interface DiceRoll {
  /** Number of dice */
  count: number;
  /** Dice sides */
  sides: number;
  /** Flat modifier */
  modifier: number;
}

/**
 * Combat action
 */
export interface CombatAction {
  /** Action ID */
  id: string;
  /** Action name */
  name: string;
  /** Action type */
  type: ActionType;
  /** Action cost (1 action, bonus action, reaction, etc) */
  cost: ActionCost;
  /** Range */
  range?: number | 'melee' | 'ranged';
  /** Target count */
  targetCount: number;
  /** Damage/Healing */
  effect?: ActionEffect;
  /** Description */
  description?: string;
}

/**
 * Action types
 */
export enum ActionType {
  ATTACK = 'attack',
  SPELL = 'spell',
  ABILITY = 'ability',
  MANEUVER = 'maneuver',
  ITEM = 'item',
  MOVE = 'move',
  DODGE = 'dodge',
  DASH = 'dash',
  DISENGAGE = 'disengage',
  HELP = 'help',
  READY = 'ready',
  SEARCH = 'search',
}

/**
 * Action cost
 */
export enum ActionCost {
  ACTION = 'action',
  BONUS_ACTION = 'bonus_action',
  REACTION = 'reaction',
  FREE = 'free',
  LAIR = 'lair',
  LEGENDARY = 'legendary',
}

/**
 * Action effect
 */
export interface ActionEffect {
  /** Effect type */
  type: EffectType;
  /** Damage/Healing dice */
  dice?: DiceRoll;
  /** Damage type */
  damageType?: DamageType;
  /** Saving throw required */
  savingThrow?: SavingThrow;
  /** DC for save */
  dc?: number;
  /** Effect duration */
  duration?: number;
  /** Condition applied */
  condition?: string;
}

/**
 * Effect types
 */
export enum EffectType {
  DAMAGE = 'damage',
  HEALING = 'healing',
  TEMP_HP = 'temp_hp',
  CONDITION = 'condition',
  BUFF = 'buff',
  DEBUFF = 'debuff',
  SUMMON = 'summon',
  TELEPORT = 'teleport',
}

/**
 * Damage types
 */
export enum DamageType {
  ACID = 'acid',
  COLD = 'cold',
  FIRE = 'fire',
  FORCE = 'force',
  LIGHTNING = 'lightning',
  NECROTIC = 'necrotic',
  POISON = 'poison',
  PSYCHIC = 'psychic',
  RADIANT = 'radiant',
  THUNDER = 'thunder',
  BLUDGEONING = 'bludgeoning',
  PIERCING = 'piercing',
  SLASHING = 'slashing',
}

/**
 * Combat log entry
 */
export interface CombatLogEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Round number */
  round: number;
  /** Actor ID */
  actorId: string;
  /** Action performed */
  action: string;
  /** Target IDs */
  targetIds: string[];
  /** Result description */
  result: string;
  /** Damage/healing dealt */
  damage?: number;
  /** Entry type */
  type: CombatLogType;
}

/**
 * Combat log types
 */
export enum CombatLogType {
  ATTACK_ROLL = 'attack_roll',
  DAMAGE_ROLL = 'damage_roll',
  SAVING_THROW = 'saving_throw',
  SPELL_CAST = 'spell_cast',
  ABILITY_USE = 'ability_use',
  MOVE = 'move',
  DEATH = 'death',
  START = 'start',
  END = 'end',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',
}

/**
 * Terrain feature
 */
export interface TerrainFeature {
  /** Feature ID */
  id: string;
  /** Feature name */
  name: string;
  /** Feature type */
  type: TerrainType;
  /** Position (grid coordinates) */
  position: Vector3D;
  /** Size (in grid units) */
  size: { width: number; height: number };
  /** Effects on movement/combat */
  effects: TerrainEffect[];
  /** Cover provided */
  cover?: CoverType;
}

/**
 * Terrain types
 */
export enum TerrainType {
  WALL = 'wall',
  FLOOR = 'floor',
  DIFFICULT_TERRAIN = 'difficult_terrain',
  HAZARD = 'hazard',
  OBSTACLE = 'obstacle',
  COVER = 'cover',
  ELEVATION = 'elevation',
  LIQUID = 'liquid',
}

/**
 * Terrain effects
 */
export enum TerrainEffect {
  DIFFICULT = 'difficult', // Extra movement cost
  DAMAGING = 'damaging', // Damage when entering/ending turn
  OBSTRUCTED = 'obstructed', // Cannot move through
  ELEVATED = 'elevated', // Higher ground
  LOWGROUND = 'lowground', // Lower ground
  CONCEALMENT = 'concealment', // Disadvantage on attacks
}

/**
 * Cover types
 */
export enum CoverType {
  NONE = 'none',
  HALF = 'half', // +2 AC
  THREE_QUARTERS = 'three_quarters', // +5 AC
  FULL = 'full', // Can't be targeted
}

// ============================================================================
// Social/Dialogue Types
// ============================================================================

/**
 * Dialogue node for conversation trees
 */
export interface DialogueNode {
  /** Node ID */
  id: string;
  /** Speaker entity ID */
  speakerId: string;
  /** Dialogue text */
  text: string;
  /** Available responses */
  responses: DialogueResponse[];
  /** Conditions for this node */
  conditions?: DialogueCondition[];
  /** Actions triggered */
  actions?: DialogueAction[];
  /** Next node ID (if linear) */
  nextNodeId?: string;
  /** Emotion/tone */
  emotion?: string;
  /** Voice line reference */
  voiceLine?: string;
}

/**
 * Dialogue response option
 */
export interface DialogueResponse {
  /** Response ID */
  id: string;
  /** Response text */
  text: string;
  /** Next node ID */
  nextNodeId: string;
  /** Conditions to show */
  conditions?: DialogueCondition[];
  /** Skill check required */
  skillCheck?: SkillCheck;
  /** Actions triggered */
  actions?: DialogueAction[];
}

/**
 * Dialogue condition
 */
export interface DialogueCondition {
  /** Condition type */
  type: ConditionType;
  /** Entity/variable to check */
  target: string;
  /** Required value */
  value: string | number | boolean;
  /** Comparison operator */
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'has' | 'not_has';
}

/**
 * Condition types
 */
export enum ConditionType {
  FLAG = 'flag',
  ITEM = 'item',
  CLASS = 'class',
  LEVEL = 'level',
  GENDER = 'gender',
  RACE = 'race',
  ALIGNMENT = 'alignment',
  QUEST_STATE = 'quest_state',
  RELATIONSHIP = 'relationship',
  SKILL_VALUE = 'skill_value',
}

/**
 * Dialogue action
 */
export interface DialogueAction {
  /** Action type */
  type: DialogueActionType;
  /** Action target */
  target: string;
  /** Action value */
  value: string | number | boolean;
}

/**
 * Dialogue action types
 */
export enum DialogueActionType {
  SET_FLAG = 'set_flag',
  GIVE_ITEM = 'give_item',
  REMOVE_ITEM = 'remove_item',
  START_COMBAT = 'start_combat',
  START_QUEST = 'start_quest',
  END_QUEST = 'end_quest',
  TELEPORT = 'teleport',
  HEAL = 'heal',
  DAMAGE = 'damage',
  CHANGE_RELATIONSHIP = 'change_relationship',
  PLAY_ANIMATION = 'play_animation',
  PLAY_SOUND = 'play_sound',
}

/**
 * Skill check
 */
export interface SkillCheck {
  /** Skill being checked */
  skill: string;
  /** DC */
  dc: number;
  /** Show roll to player */
  showRoll: boolean;
}

/**
 * Relationship between entities
 */
export interface Relationship {
  /** From entity ID */
  fromEntityId: string;
  /** To entity ID */
  toEntityId: string;
  /** Relationship value (-100 to 100) */
  value: number;
  /** Relationship type */
  type: RelationshipType;
  /** Last interaction timestamp */
  lastInteraction: number;
  /** Interaction history */
  history: RelationshipEvent[];
}

/**
 * Relationship types
 */
export enum RelationshipType {
  FRIENDLY = 'friendly',
  NEUTRAL = 'neutral',
  HOSTILE = 'hostile',
  ROMANTIC = 'romantic',
  FAMILY = 'family',
  MENTOR = 'mentor',
  RIVAL = 'rival',
  LOYAL = 'loyal',
  INDEBTED = 'indebted',
}

/**
 * Relationship event
 */
export interface RelationshipEvent {
  /** Timestamp */
  timestamp: number;
  /** Event type */
  type: string;
  /** Value change */
  delta: number;
  /** Description */
  description: string;
}

// ============================================================================
// Exploration/Loot Types
// ============================================================================

/**
 * Exploration state
 */
export interface ExplorationState {
  /** Session/campaign ID */
  sessionId: string;
  /** Current location ID */
  currentLocationId: string;
  /** Discovered locations */
  discoveredLocations: string[];
  /** Visited locations */
  visitedLocations: Set<string>;
  /** Active quests */
  activeQuests: Quest[];
  /** Completed quests */
  completedQuests: string[];
  /** Party inventory */
  inventory: ItemStack[];
  /** Currency */
  currency: Currency;
  /** World flags */
  worldFlags: Record<string, unknown>;
}

/**
 * Location/scene
 */
export interface Location {
  /** Unique location ID */
  id: string;
  /** Location name */
  name: string;
  /** Location description */
  description: string;
  /** Location type */
  type: LocationType;
  /** Parent location ID */
  parentId?: string;
  /** Connected locations */
  connections: LocationConnection[];
  /** NPCs present */
  npcs: string[];
  /** Items available */
  items: LootItem[];
  /** Secrets/discoveries */
  secrets: Secret[];
  /** Position on world map */
  mapPosition?: Vector3D;
  /** Tags */
  tags: string[];
  /** Environment data */
  environment?: {
    lighting: LightingLevel;
    noise: NoiseLevel;
    temperature?: string;
    atmosphere?: string;
  };
}

/**
 * Location types
 */
export enum LocationType {
  TOWN = 'town',
  DUNGEON = 'dungeon',
  WILDERNESS = 'wilderness',
  BUILDING = 'building',
  ROOM = 'room',
  CORRIDOR = 'corridor',
  CAVE = 'cave',
  FOREST = 'forest',
  RUINS = 'ruins',
  TEMPLE = 'temple',
  TAVERN = 'tavern',
  SHOP = 'shop',
}

/**
 * Lighting levels
 */
export enum LightingLevel {
  BRIGHT = 'bright',
  DIM = 'dim',
  DARKNESS = 'darkness',
  MAGICAL_DARKNESS = 'magical_darkness',
}

/**
 * Noise levels
 */
export enum NoiseLevel {
  SILENT = 'silent',
  QUIET = 'quiet',
  MODERATE = 'moderate',
  LOUD = 'loud',
  DEAFENING = 'deafening',
}

/**
 * Location connection
 */
export interface LocationConnection {
  /** Target location ID */
  toLocationId: string;
  /** Connection type */
  type: ConnectionType;
  /** Is it locked/blocked */
  locked: boolean;
  /** Key/condition to unlock */
  unlockCondition?: string;
  /** Travel time */
  travelTime?: number;
  /** Distance */
  distance?: number;
  /** Description */
  description?: string;
}

/**
 * Connection types
 */
export enum ConnectionType {
  DOOR = 'door',
  PASSAGE = 'passage',
  STAIRS = 'stairs',
  LADDER = 'ladder',
  TELEPORTER = 'teleporter',
  EXIT = 'exit',
  SECRET_DOOR = 'secret_door',
  WINDOW = 'window',
}

/**
 * Loot item
 */
export interface LootItem {
  /** Item ID */
  id: string;
  /** Item name */
  name: string;
  /** Item type */
  type: ItemType;
  /** Item rarity */
  rarity: ItemRarity;
  /** Quantity */
  quantity: number;
  /** Item description */
  description?: string;
  /** Item value in copper pieces */
  value?: number;
  /** Item weight in lbs */
  weight?: number;
  /** Magical properties */
  magical?: boolean;
  /** Tags */
  tags?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Item types
 */
export enum ItemType {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  POTION = 'potion',
  SCROLL = 'scroll',
  RING = 'ring',
  WAND = 'wand',
  ROD = 'rod',
  STAFF = 'staff',
  TOOL = 'tool',
  GEAR = 'gear',
  TREASURE = 'treasure',
  KEY = 'key',
  QUEST_ITEM = 'quest_item',
}

/**
 * Item rarity
 */
export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  VERY_RARE = 'very_rare',
  LEGENDARY = 'legendary',
  ARTIFACT = 'artifact',
}

/**
 * Item stack
 */
export interface ItemStack {
  /** Item ID */
  itemId: string;
  /** Quantity */
  quantity: number;
}

/**
 * Currency
 */
export interface Currency {
  /** Copper pieces */
  cp: number;
  /** Silver pieces */
  sp: number;
  /** Electrum pieces */
  ep: number;
  /** Gold pieces */
  gp: number;
  /** Platinum pieces */
  pp: number;
}

/**
 * Secret/discovery
 */
export interface Secret {
  /** Secret ID */
  id: string;
  /** Secret description */
  description: string;
  /** How to discover */
  discoveryMethod: DiscoveryMethod;
  /** Difficulty (DC) */
  dc?: number;
  /** Revealed flag */
  revealed: boolean;
  /** What is revealed */
  reveals?: string[];
}

/**
 * Discovery methods
 */
export enum DiscoveryMethod {
  PERCEPTION = 'perception',
  INVESTIGATION = 'investigation',
  MAGIC = 'magic',
  INTERACTION = 'interaction',
  STORY = 'story',
  DIALOGUE = 'dialogue',
}

/**
 * Quest
 */
export interface Quest {
  /** Quest ID */
  id: string;
  /** Quest name */
  name: string;
  /** Quest description */
  description: string;
  /** Quest giver ID */
  giverId: string;
  /** Quest objectives */
  objectives: QuestObjective[];
  /** Quest rewards */
  rewards: QuestReward[];
  /** Quest status */
  status: QuestStatus;
  /** Quest stage */
  currentStage: number;
  /** Is this a main quest */
  mainQuest: boolean;
  /** Prerequisites */
  prerequisites?: string[];
  /** Started at */
  startedAt: number;
}

/**
 * Quest objective
 */
export interface QuestObjective {
  /** Objective ID */
  id: string;
  /** Objective description */
  description: string;
  /** Objective type */
  type: ObjectiveType;
  /** Target (ID or description) */
  target?: string;
  /** Required count/amount */
  required?: number;
  /** Current count/amount */
  current: number;
  /** Is completed */
  completed: boolean;
  /** Is optional */
  optional: boolean;
}

/**
 * Objective types
 */
export enum ObjectiveType {
  KILL = 'kill',
  COLLECT = 'collect',
  TALK = 'talk',
  DELIVER = 'deliver',
  ESCORT = 'escort',
  DISCOVER = 'discover',
  EXPLORE = 'explore',
  DEFEND = 'defend',
  USE = 'use',
  CRAFT = 'craft',
}

/**
 * Quest reward
 */
export interface QuestReward {
  /** Reward type */
  type: RewardType;
  /** Amount/quantity */
  amount: number;
  /** Item ID (if item reward) */
  itemId?: string;
  /** XP reward */
  xp?: number;
}

/**
 * Reward types
 */
export enum RewardType {
  GOLD = 'gold',
  ITEM = 'item',
  XP = 'xp',
  REPUTATION = 'reputation',
  CLASS_FEATURE = 'class_feature',
  SPELL = 'spell',
}

/**
 * Quest status
 */
export enum QuestStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ABANDONED = 'abandoned',
}

// ============================================================================
// Campaign/Session Types
// ============================================================================

/**
 * Campaign state
 */
export interface CampaignState {
  /** Unique campaign ID */
  campaignId: string;
  /** Campaign name */
  name: string;
  /** DM user ID */
  dungeonMasterId: string;
  /** Player IDs */
  playerIds: string[];
  /** Current session ID */
  currentSessionId?: string;
  /** Campaign state */
  state: CampaignState;
  /** World state */
  worldState: Record<string, unknown>;
  /** Party inventory */
  partyInventory: ItemStack[];
  /** Party currency */
  currency: Currency;
  /** Quest states */
  quests: Record<string, Quest>;
  /** Relationship states */
  relationships: Record<string, Relationship>;
  /** Discovered locations */
  discoveredLocations: string[];
  /** World flags */
  flags: Record<string, unknown>;
  /** Started at */
  createdAt: number;
  /** Last updated */
  updatedAt: number;
}

/**
 * Campaign states
 */
export enum CampaignState {
  SETUP = 'setup',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
  ARCHIVED = 'archived',
}

/**
 * Session state
 */
export interface SessionState {
  /** Unique session ID */
  sessionId: string;
  /** Campaign ID */
  campaignId: string;
  /** Session number */
  sessionNumber: number;
  /** Session name */
  name: string;
  /** Current location */
  currentLocationId: string;
  /** Party members present */
  partyMembers: string[];
  /** Session state */
  state: SessionState;
  /** Active combat (if any) */
  combatId?: string;
  /** Active dialogue (if any) */
  dialogueNodeId?: string;
  /** Session log */
  sessionLog: SessionLogEntry[];
  /** Started at */
  startedAt: number;
  /** Ended at */
  endedAt?: number;
}

/**
 * Session states
 */
export enum SessionState {
  PREPARATION = 'preparation',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  ENDED = 'ended',
}

/**
 * Session log entry
 */
export interface SessionLogEntry {
  /** Entry ID */
  id: string;
  /** Timestamp */
  timestamp: number;
  /** Entry type */
  type: SessionLogType;
  /** Entity ID (who performed action) */
  entityId?: string;
  /** Description */
  description: string;
  /** Associated data */
  data?: Record<string, unknown>;
}

/**
 * Session log types
 */
export enum SessionLogType {
  NARRATIVE = 'narrative',
  DIALOGUE = 'dialogue',
  COMBAT_START = 'combat_start',
  COMBAT_END = 'combat_end',
  DISCOVERY = 'discovery',
  REST = 'rest',
  LEVEL_UP = 'level_up',
  DEATH = 'death',
  QUEST_START = 'quest_start',
  QUEST_COMPLETE = 'quest_complete',
  LOOT = 'loot',
  NOTE = 'note',
}

// ============================================================================
// Agent Communication Types
// ============================================================================

/**
 * Message between agents
 */
export interface AgentMessage {
  /** Unique message ID */
  id: string;
  /** From agent ID */
  fromAgentId: string;
  /** To agent ID (or '*' for broadcast) */
  toAgentId: string;
  /** Message type */
  type: MessageType;
  /** Message payload */
  payload: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
  /** Priority */
  priority: MessagePriority;
  /** Requires response */
  requiresResponse: boolean;
  /** Correlation ID (if response) */
  correlationId?: string;
}

/**
 * Message types
 */
export enum MessageType {
  /** Combat coordination */
  COMBAT_UPDATE = 'combat_update',
  /** Requesting action */
  ACTION_REQUEST = 'action_request',
  /** Action completed */
  ACTION_COMPLETE = 'action_complete',
  /** State change notification */
  STATE_CHANGE = 'state_change',
  /** Query/request for info */
  QUERY = 'query',
  /** Response to query */
  RESPONSE = 'response',
  /** Event notification */
  EVENT = 'event',
  /** Command from higher agent */
  COMMAND = 'command',
  /** Status update */
  STATUS = 'status',
  /** Heartbeat/ping */
  HEARTBEAT = 'heartbeat',
  /** Error notification */
  ERROR = 'error',
}

/**
 * Message priority
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3,
}

/**
 * Message handler type
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

// ============================================================================
// Agent Config Types
// ============================================================================

/**
 * Configuration for creating an agent
 */
export interface AgentConfig {
  /** Unique agent ID */
  id: string;
  /** Agent name */
  name: string;
  /** Agent role */
  role: AgentRole;
  /** Biological agent type */
  biologicalType: BiologicalAgent;
  /** Session/campaign ID */
  sessionId: string;
  /** Agent capabilities */
  capabilities: Partial<AgentCapabilities>;
  /** Memory system config */
  memoryConfig?: {
    maxWorkingMemories?: number;
    maxMidTermMemories?: number;
    importanceThreshold?: number;
  };
  /** Personality traits */
  personality?: Record<string, number>;
  /** Goals/objectives */
  goals?: string[];
  /** Escalation enabled */
  enableEscalation?: boolean;
  /** Learning enabled */
  enableLearning?: boolean;
  /** LLM callback for brain/human tier */
  onThink?: LLMThinkHandler;
  /** Action callback */
  onAct?: AgentActHandler;
}

/**
 * LLM Think handler for generating decisions
 */
export interface LLMThinkHandler {
  (
    agentId: string,
    role: AgentRole,
    situation: string,
    context: string,
    memories: string[],
    stakes: number
  ): Promise<LLMThinkResult>;
}

/**
 * Result from LLM think handler
 */
export interface LLMThinkResult {
  /** Content/response */
  content: string;
  /** Action to take */
  action?: string;
  /** Action parameters */
  actionParams?: Record<string, unknown>;
  /** Thoughts */
  thoughts?: string;
  /** Emotions */
  emotions?: Record<string, number>;
}

/**
 * Agent act handler for executing actions
 */
export interface AgentActHandler {
  (
    agentId: string,
    action: string,
    params: Record<string, unknown>,
    context: AgentDecisionContext
  ): Promise<ActionResult>;
}

/**
 * Result from action execution
 */
export interface ActionResult {
  /** Was action successful */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
  /** Side effects */
  sideEffects?: string[];
}

// ============================================================================
// Statistics and Metrics Types
// ============================================================================

/**
 * Agent statistics
 */
export interface AgentStats {
  /** Agent ID */
  agentId: string;
  /** Agent role */
  role: AgentRole;
  /** Total decisions made */
  totalDecisions: number;
  /** Decisions by source */
  decisionsBySource: Record<DecisionSource, number>;
  /** Average confidence */
  avgConfidence: number;
  /** Average time per decision */
  avgTimeMs: number;
  /** Total cost */
  totalCost: number;
  /** Success rate */
  successRate: number;
  /** Escalation rate */
  escalationRate: number;
  /** Memory stats */
  memoryStats: {
    totalMemories: number;
    byType: Record<string, number>;
    avgImportance: number;
  };
}

/**
 * System-wide statistics
 */
export interface SystemStats {
  /** Total active agents */
  activeAgents: number;
  /** Total decisions */
  totalDecisions: number;
  /** Messages sent */
  messagesSent: number;
  /** Average response time */
  avgResponseTime: number;
  /** Total cost */
  totalCost: number;
  /** Cost savings (from escalation) */
  costSavings: number;
  /** Active sessions */
  activeSessions: number;
  /** Uptime seconds */
  uptime: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Agent error types
 */
export enum AgentErrorCode {
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS = 'AGENT_ALREADY_EXISTS',
  AGENT_DISABLED = 'AGENT_DISABLED',
  INVALID_ROLE = 'INVALID_ROLE',
  INVALID_BIOLOGICAL_TYPE = 'INVALID_BIOLOGICAL_TYPE',
  DECISION_FAILED = 'DECISION_FAILED',
  ACTION_FAILED = 'ACTION_FAILED',
  COMMUNICATION_FAILED = 'COMMUNICATION_FAILED',
  MEMORY_ERROR = 'MEMORY_ERROR',
  ESCALATION_FAILED = 'ESCALATION_FAILED',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  INVALID_CONTEXT = 'INVALID_CONTEXT',
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_ERROR = 'LLM_ERROR',
}

/**
 * Agent error
 */
export class AgentError extends Error {
  constructor(
    public code: AgentErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    latencyMs: number;
  };
}

/**
 * Get agent decision request
 */
export interface AgentDecisionRequest {
  /** Agent ID */
  agentId: string;
  /** Situation description */
  situation: string;
  /** Situation type */
  situationType: SituationType;
  /** Importance (0-1) */
  stakes?: number;
  /** Time constraint ms */
  urgencyMs?: number;
  /** Location */
  location?: string;
  /** Participants */
  participants?: string[];
  /** Available resources */
  availableResources?: Record<string, number>;
  /** Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Coordinate agents request
 */
export interface CoordinateAgentsRequest {
  /** Session ID */
  sessionId: string;
  /** Objective description */
  objective: string;
  /** Participating agent IDs */
  agentIds?: string[];
  /** Time constraint */
  timeLimitMs?: number;
}

/**
 * Coordinate agents response
 */
export interface CoordinateAgentsResponse {
  /** Coordination ID */
  coordinationId: string;
  /** Agent decisions */
  decisions: AgentDecision[];
  /** Coordination plan */
  plan: CoordinationPlan;
}

/**
 * Coordination plan
 */
export interface CoordinationPlan {
  /** Plan description */
  description: string;
  /** Agent assignments */
  assignments: AgentAssignment[];
  /** Execution order */
  executionOrder: string[];
  /** Estimated time */
  estimatedTimeMs: number;
}

/**
 * Agent assignment
 */
export interface AgentAssignment {
  /** Agent ID */
  agentId: string;
  /** Assigned task */
  task: string;
  /** Target/subject */
  target?: string;
  /** Dependencies (other agent IDs) */
  dependencies: string[];
}

/**
 * Get agent state request
 */
export interface GetAgentStateRequest {
  /** Agent ID */
  agentId: string;
  /** Include memories */
  includeMemories?: boolean;
  /** Include stats */
  includeStats?: boolean;
}

/**
 * Get agent state response
 */
export interface GetAgentStateResponse {
  /** Agent info */
  agent: {
    id: string;
    name: string;
    role: AgentRole;
    biologicalType: BiologicalAgent;
    state: AgentState;
  };
  /** Memories (if requested) */
  memories?: string[];
  /** Stats (if requested) */
  stats?: AgentStats;
  /** Current personality */
  personality?: Record<string, number>;
}

/**
 * WebSocket update message
 */
export interface AgentUpdateMessage {
  /** Update type */
  type: 'agent_decision' | 'agent_state' | 'coordination' | 'combat' | 'dialogue';
  /** Session ID */
  sessionId: string;
  /** Timestamp */
  timestamp: number;
  /** Data payload */
  data: unknown;
}
