/**
 * DMLoG.AI Memory System - Type Definitions
 *
 * Implements 6-tier hierarchical memory:
 * 1. Working Memory - Current context, recent events
 * 2. Episodic Memory - Specific events with temporal context
 * 3. Semantic Memory - Facts, concepts, world knowledge
 * 4. Procedural Memory - Skills, behaviors, patterns
 * 5. Reflection Memory - Meta-cognition, self-awareness
 * 6. Identity Memory - Core character, personality, values
 */

// ============================================================================
// CORE MEMORY TYPES
// ============================================================================

export enum MemoryTier {
  WORKING = 'working',
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  REFLECTION = 'reflection',
  IDENTITY = 'identity',
}

export enum MemoryType {
  // Event memories
  CONVERSATION = 'conversation',
  COMBAT = 'combat',
  DISCOVERY = 'discovery',
  QUEST = 'quest',
  SOCIAL = 'social',

  // Knowledge memories
  FACT = 'fact',
  RULE = 'rule',
  RELATIONSHIP = 'relationship',
  LOCATION = 'location',
  ITEM = 'item',

  // Procedural memories
  SKILL = 'skill',
  BEHAVIOR = 'behavior',
  PATTERN = 'pattern',
  TACTIC = 'tactic',

  // Meta memories
  INSIGHT = 'insight',
  EMOTION = 'emotion',
  DECISION = 'decision',
  REGRET = 'regret',
  PRIDE = 'pride',
}

export enum EmotionalValence {
  VERY_NEGATIVE = -2,
  NEGATIVE = -1,
  NEUTRAL = 0,
  POSITIVE = 1,
  VERY_POSITIVE = 2,
}

export enum TemporalDistance {
  NOW = 'now',
  RECENT = 'recent',
  SOON = 'soon',
  DISTANT Past = 'distant_past',
  DISTANT_FUTURE = 'distant_future',
}

// ============================================================================
// BASE MEMORY INTERFACE
// ============================================================================

export interface BaseMemory {
  id: string;
  tier: MemoryTier;
  type: MemoryType;
  timestamp: number;
  sessionId: string;
  campaignId: string;
  importance: number; // 0-1
  retrievalCount: number;
  lastAccessed: number;
  tags: string[];
}

// ============================================================================
// EPISODIC MEMORY
// ============================================================================

export interface EpisodicMemory extends BaseMemory {
  tier: MemoryTier.EPISODIC;
  type: MemoryType;
  eventId: string;
  participants: string[]; // Character IDs
  location?: string;
  description: string;
  emotionalValence: EmotionalValence;
  sensoryDetails?: SensoryDetails;
  outcome?: string;
  relatedMemories: string[]; // Memory IDs
  temporalLandmark?: TemporalLandmark;
}

export interface SensoryDetails {
  visual?: string[];
  auditory?: string[];
  tactile?: string[];
  olfactory?: string[];
  gustatory?: string[];
}

export interface TemporalLandmark {
  type: 'first_time' | 'peak_experience' | 'turning_point' | 'closure' | 'trauma' | 'triumph';
  significance: number; // 0-1
  narrativeImpact: string;
}

// ============================================================================
// SEMANTIC MEMORY
// ============================================================================

export interface SemanticMemory extends BaseMemory {
  tier: MemoryTier.SEMANTIC;
  type: MemoryType;
  fact: string;
  confidence: number; // 0-1
  source?: string; // How this was learned
  sourceId?: string; // Event/character that taught this
  lastVerified?: number;
  contradictions?: string[]; // Memory IDs that conflict
}

// ============================================================================
// PROCEDURAL MEMORY
// ============================================================================

export interface ProceduralMemory extends BaseMemory {
  tier: MemoryTier.PROCEDURAL;
  type: MemoryType;
  skill: string;
  proficiency: number; // 0-1
  practiceCount: number;
  lastUsed?: number;
  effectiveness?: number; // Success rate 0-1
  contexts: string[]; // When this applies
}

// ============================================================================
// REFLECTION MEMORY
// ============================================================================

export interface ReflectionMemory extends BaseMemory {
  tier: MemoryTier.REFLECTION;
  type: MemoryType;
  subjectMemoryIds: string[]; // What this reflects upon
  insight: string;
  emotionalImpact: EmotionalValence;
  behavioralChange?: string;
  selfAssessment?: {
    growth?: number;
    regret?: number;
    pride?: number;
  };
}

// ============================================================================
// IDENTITY MEMORY
// ============================================================================

export interface IdentityMemory extends BaseMemory {
  tier: MemoryTier.IDENTITY;
  type: MemoryType;
  trait: string;
  value: string | number | boolean;
  stability: number; // How resistant to change 0-1
  origin?: string; // Backstory source
}

// ============================================================================
// WORKING MEMORY (Current Context)
// ============================================================================

export interface WorkingMemory {
  currentLocation?: string;
  presentCharacters: string[];
  activeQuests: string[];
  recentEvents: string[]; // Event IDs
  currentGoal?: string;
  immediateThreats: string[];
  currentEmotionalState: EmotionalValence;
  contextWindow: ContextWindowEntry[];
}

export interface ContextWindowEntry {
  type: 'dialogue' | 'action' | 'observation' | 'thought';
  content: string;
  timestamp: number;
  source: string; // Character/Source ID
  importance: number;
}

// ============================================================================
// MEMORY UNION
// ============================================================================

export type Memory = EpisodicMemory | SemanticMemory | ProceduralMemory | ReflectionMemory | IdentityMemory;

export type AnyMemory = Memory | WorkingMemory;

// ============================================================================
// CHARACTER MEMORY
// ============================================================================

export interface CharacterMemoryState {
  characterId: string;
  campaignId: string;
  workingMemory: WorkingMemory;
  episodicMemories: Map<string, EpisodicMemory>;
  semanticMemories: Map<string, SemanticMemory>;
  proceduralMemories: Map<string, ProceduralMemory>;
  reflectionMemories: Map<string, ReflectionMemory>;
  identityMemories: Map<string, IdentityMemory>;
  relationships: Map<string, RelationshipState>;
  temporalConsciousness: TemporalConsciousness;
  lastConsolidated: number;
}

// ============================================================================
// RELATIONSHIP TRACKING
// ============================================================================

export interface RelationshipState {
  targetId: string;
  affinity: number; // -100 to 100
  trust: number; // 0-1
  familiarity: number; // 0-1
  debts: Debt[];
  promises: Promise[];
  sharedMemories: string[]; // Memory IDs
  relationshipType: RelationshipType;
  tension?: number; // 0-1, conflicts unresolved
  lastInteraction: number;
  interactionCount: number;
}

export enum RelationshipType {
  STRANGER = 'stranger',
  ACQUAINTANCE = 'acquaintance',
  FRIEND = 'friend',
  CLOSE_FRIEND = 'close_friend',
  RIVAL = 'rival',
  ENEMY = 'enemy',
  FAMILY = 'family',
  ROMANTIC = 'romantic',
  MENTOR = 'mentor',
  STUDENT = 'student',
  ALLY = 'ally',
  SUBORDINATE = 'subordinate',
  SUPERIOR = 'superior',
}

export interface Debt {
  type: 'life' | 'favor' | 'material' | 'information' | 'revenge' | 'gratitude';
  description: string;
  magnitude: number; // 0-1
  timestamp: number;
  resolved?: boolean;
}

export interface Promise {
  content: string;
  madeAt: number;
  deadline?: number;
  kept?: boolean;
  broken?: boolean;
  importance: number; // 0-1
}

// ============================================================================
// TEMPORAL CONSCIOUSNESS
// ============================================================================

export interface TemporalConsciousness {
  timePerception: TimePerceptionState;
  temporalLandmarks: TemporalLandmarkEntry[];
  anticipatedEvents: AnticipatedEvent[];
  temporalNarrative: string; // Character's sense of their story
  periodization: LifePeriod[];
}

export interface TimePerceptionState {
  subjectiveSpeed: number; // 0-2, 1=normal
  focusHorizon: TemporalFocus;
  anticipationBias: TemporalBias;
  memoryDepth: number; // How far back they maintain clarity
}

export enum TemporalFocus {
  IMMEDIATE = 'immediate', // Next few minutes
  SHORT_TERM = 'short_term', // Today/session
  MEDIUM_TERM = 'medium_term', // This arc
  LONG_TERM = 'long_term', // Campaign
  LEGACY = 'legacy', // Afterlife/impact
}

export enum TemporalBias {
  PRESENT = 'present', // Focused on now
  PAST = 'past', // Nostalgic/regretful
  FUTURE = 'future', // Hopeful/anxious
  BALANCED = 'balanced',
}

export interface TemporalLandmarkEntry {
  id: string;
  timestamp: number;
  type: TemporalLandmark['type'];
  title: string;
  description: string;
  emotionalValence: EmotionalValence;
  memoryIds: string[]; // Associated memories
  narrativeWeight: number; // How much it defines the character
}

export interface AnticipatedEvent {
  id: string;
  description: string;
  expectedTiming?: number;
  certainty: number; // 0-1
  importance: number; // 0-1
  emotionalValence: EmotionalValence;
  preparation?: string[];
}

export interface LifePeriod {
  id: string;
  name: string;
  startTimestamp: number;
  endTimestamp?: number;
  description: string;
  definingTraits: string[];
  keyMemories: string[];
}

// ============================================================================
// CAMPAIGN MEMORY
// ============================================================================

export interface CampaignMemoryState {
  campaignId: string;
  worldState: Map<string, any>;
  locations: Map<string, LocationMemory>;
  plotThreads: Map<string, PlotThread>;
  factions: Map<string, FactionState>;
  timeline: TimelineEvent[];
  sessionHistory: SessionSummary[];
  worldLore: Map<string, SemanticMemory>;
}

export interface LocationMemory {
  id: string;
  name: string;
  description: string;
  discoveredAt: number;
  lastVisited: number;
  visitCount: number;
  events: string[]; // Memory IDs of events here
  characters: string[]; // Character IDs associated
  secrets?: string[];
  currentState?: Map<string, any>;
}

export interface PlotThread {
  id: string;
  title: string;
  description: string;
  status: PlotStatus;
  importance: number; // 0-1
  involvedCharacters: string[];
  relatedLocations: string[];
  keyEvents: string[]; // Memory IDs
  cliffhangers?: string[];
  resolution?: {
    memoryId: string;
    satisfaction: number; // 0-1
  };
  tags: string[];
}

export enum PlotStatus {
  DORMANT = 'dormant',
  ACTIVE = 'active',
  PAUSED = 'paused',
  RESOLVED = 'resolved',
  ABANDONED = 'abandoned',
}

export interface FactionState {
  id: string;
  name: string;
  description: string;
  power: number; // 0-1
  influence: Map<string, number>; // Location IDs -> influence
  relationships: Map<string, FactionRelationship>;
  secrets: string[];
  goals: string[];
  resources: Map<string, number>;
  lastUpdate: number;
}

export interface FactionRelationship {
  factionId: string;
  relation: 'allied' | 'friendly' | 'neutral' | 'hostile' | 'at_war';
  tension: number; // 0-1
  treaties?: string[];
  grievances?: string[];
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  description: string;
  impact: number; // 0-1
  categories: string[];
  involvedCharacters: string[];
  plotThreadIds: string[];
}

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number;
  participants: string[]; // Character IDs
  locations: string[];
  majorEvents: string[]; // Memory IDs
  plotProgress: Map<string, string>; // Thread ID -> progress note
  cliffhangers?: string[];
  nextSessionHooks?: string[];
}

// ============================================================================
// PLAYER MEMORY
// ============================================================================

export interface PlayerMemoryState {
  playerId: string;
  campaigns: Map<string, PlayerCampaignMemory>;
  playStyle: PlayStyleProfile;
  preferences: PlayerPreferences;
  growth: PlayerGrowth;
}

export interface PlayerCampaignMemory {
  campaignId: string;
  characters: string[]; // Character IDs played
  joinedAt: number;
  sessions: number;
  totalPlaytime: number;
  achievements: string[];
  notes: string[];
  relationships: Map<string, number>; // Player affinity with NPCs
}

export interface PlayStyleProfile {
  combatPreference: CombatStyle;
  roleplayPreference: RoleplayStyle;
  problemSolving: ProblemSolvingStyle;
  riskTolerance: number; // 0-1
  leadershipTendency: number; // 0-1
  humorLevel: number; // 0-1
  agencyPreference: number; // 0-1 (railroad vs sandbox)
  updateFrequency: number; // How fast playstyle can change
}

export enum CombatStyle {
  TACTICAL = 'tactical',
  AGGRESSIVE = 'aggressive',
  DEFENSIVE = 'defensive',
  DIPLOMATIC = 'diplomatic', // Avoids combat
  CREATIVE = 'creative', // Uses environment, etc.
}

export enum RoleplayStyle {
  METHOD = 'method', // Deep immersion
  CASUAL = 'casual',
  DRAMATIC = 'dramatic',
  HUMOROUS = 'humorous',
  STRATEGIC = 'strategic', // RP as means to optimal play
}

export enum ProblemSolvingStyle {
  DIRECT = 'direct',
  CUNNING = 'cunning',
  DIPLOMATIC = 'diplomatic',
  MAGICAL = 'magical',
  BRUTE_FORCE = 'brute_force',
}

export interface PlayerPreferences {
  preferredContent: string[]; // Types of content they engage with
  avoidedContent: string[];
  pacing: 'fast' | 'medium' | 'slow' | 'variable';
  tone: 'serious' | 'light' | 'dark' | 'balanced';
  complexity: 'simple' | 'moderate' | 'complex' | 'intricate';
  agency: 'guided' | 'balanced' | 'sandbox';
  lastUpdate: number;
}

export interface PlayerGrowth {
  skillsLearned: string[];
  milestones: Milestone[];
  patterns: BehaviorPattern[];
  feedbackHistory: FeedbackEntry[];
  overallTrajectory: 'growing' | 'stable' | 'declining' | 'plateaued';
}

export interface Milestone {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  category: 'combat' | 'roleplay' | 'puzzle' | 'social' | 'story' | 'personal';
  importance: number; // 0-1
}

export interface BehaviorPattern {
  description: string;
  frequency: number; // How often they exhibit this
  contexts: string[];
  firstObserved: number;
  lastObserved: number;
  reliability: number; // How consistent
}

export interface FeedbackEntry {
  timestamp: number;
  sessionId: string;
  positiveAspects: string[];
  negativeAspects: string[];
  suggestions?: string[];
  rating?: number; // 0-1
}

// ============================================================================
// MEMORY CONSOLIDATION
// ============================================================================

export interface ConsolidationConfig {
  episodicToSemantic: boolean; // Extract facts from events
  episodicToProcedural: boolean; // Learn patterns from events
  reflectionThreshold: number; // Importance to trigger reflection
  identityStability: number; // How resistant core identity is
  relationshipDecay: number; // How fast relationships fade
  memoryDecay: {
    working: number; // Seconds before clearing
    episodic: number; // Days before degradation
    semantic: number; // Days before verification needed
  };
}

export interface ConsolidationResult {
  memoriesCreated: number;
  memoriesUpdated: number;
  memoriesDecayed: number;
  relationshipsUpdated: number;
  reflectionsGenerated: number;
  plotThreadsUpdated: number;
  summary: string;
}

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================

export interface MemoryQuery {
  characterId?: string;
  campaignId?: string;
  tiers?: MemoryTier[];
  types?: MemoryType[];
  tags?: string[];
  importance?: { min?: number; max?: number };
  timeRange?: { start?: number; end?: number };
  participants?: string[];
  locations?: string[];
  emotionalValence?: EmotionalValence[];
  relatedTo?: string; // Memory ID
  limit?: number;
  includeWorking?: boolean;
}

export interface MemoryRetrievalResult {
  memories: Memory[];
  workingMemory?: WorkingMemory;
  totalCount: number;
  query: MemoryQuery;
  retrievalTime: number;
}

export interface MemoryAssociation {
  memoryId: string;
  associationType: 'causal' | 'temporal' | 'semantic' | 'emotional' | 'spatial';
  strength: number; // 0-1
}

// ============================================================================
// SERIALIZATION
// ============================================================================

export interface SerializedCharacterMemory {
  characterId: string;
  campaignId: string;
  workingMemory: WorkingMemory;
  episodicMemories: EpisodicMemory[];
  semanticMemories: SemanticMemory[];
  proceduralMemories: ProceduralMemory[];
  reflectionMemories: ReflectionMemory[];
  identityMemories: IdentityMemory[];
  relationships: Record<string, RelationshipState>;
  temporalConsciousness: TemporalConsciousness;
  lastConsolidated: number;
}

export interface SerializedCampaignMemory {
  campaignId: string;
  worldState: Record<string, any>;
  locations: Record<string, LocationMemory>;
  plotThreads: Record<string, PlotThread>;
  factions: Record<string, FactionState>;
  timeline: TimelineEvent[];
  sessionHistory: SessionSummary[];
  worldLore: SemanticMemory[];
}

export interface SerializedPlayerMemory {
  playerId: string;
  campaigns: Record<string, PlayerCampaignMemory>;
  playStyle: PlayStyleProfile;
  preferences: PlayerPreferences;
  growth: PlayerGrowth;
}
