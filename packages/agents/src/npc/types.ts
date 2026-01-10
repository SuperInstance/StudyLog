/**
 * StudyLoG.AI - NPC Types
 *
 * Type definitions for NVIDIA ACE-powered NPCs and A2A protocol.
 */

// NPC Identity
export interface NPCIdentity {
  id: string;
  name: string;
  role: NPCRole;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  persona: string;
  voiceId?: string;
  avatarId?: string;
  backstory: string;
  traits: string[];
  expertise: string[];
}

export type NPCRole =
  | 'mentor'
  | 'shopkeeper'
  | 'quest-giver'
  | 'companion'
  | 'expert'
  | 'villager'
  | 'antagonist';

// NPC State
export interface NPCState {
  mood: NPCMood;
  relationship: number; // -100 to 100
  currentLocation: string;
  isActive: boolean;
  lastInteraction?: Date;
  memoryContext: string[];
  currentGoal?: string;
  emotionalState: EmotionalState;
}

export type NPCMood =
  | 'happy'
  | 'neutral'
  | 'curious'
  | 'concerned'
  | 'frustrated'
  | 'excited'
  | 'thoughtful';

export interface EmotionalState {
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
  dominance: number; // 0 to 1 (submissive to dominant)
}

// NPC Memory
export interface NPCMemory {
  npcId: string;
  playerId: string;
  shortTerm: MemoryEntry[];
  longTerm: MemoryEntry[];
  relationships: RelationshipMemory[];
  sharedExperiences: SharedExperience[];
}

export interface MemoryEntry {
  id: string;
  timestamp: Date;
  type: 'conversation' | 'action' | 'observation' | 'emotion';
  content: string;
  importance: number; // 0 to 1
  emotionalValence: number; // -1 to 1
  tags: string[];
}

export interface RelationshipMemory {
  entityId: string;
  entityType: 'player' | 'npc' | 'object';
  sentiment: number; // -100 to 100
  trustLevel: number; // 0 to 100
  interactions: number;
  lastUpdate: Date;
}

export interface SharedExperience {
  id: string;
  participants: string[];
  type: 'quest' | 'conversation' | 'discovery' | 'conflict' | 'teaching';
  summary: string;
  timestamp: Date;
  outcome: 'positive' | 'negative' | 'neutral';
}

// NVIDIA ACE Types
export interface ACEConfig {
  endpoint: string;
  apiKey?: string;
  enableAudio: boolean;
  enableAnimation: boolean;
  enableRag: boolean;
  modelId?: string;
}

export interface ACERequest {
  sessionId: string;
  npcId: string;
  input: ACEInput;
  context: ACEContext;
}

export interface ACEInput {
  type: 'text' | 'audio' | 'action';
  content: string;
  audioData?: ArrayBuffer;
  metadata?: Record<string, unknown>;
}

export interface ACEContext {
  conversationHistory: ACEMessage[];
  npcState: NPCState;
  playerInfo: PlayerContext;
  gameState: GameContext;
  memoryContext?: string;
}

export interface ACEMessage {
  role: 'user' | 'npc';
  content: string;
  timestamp: Date;
  emotion?: string;
}

export interface PlayerContext {
  id: string;
  name: string;
  skillLevel: number;
  learningPhase: string;
  recentActions: string[];
  preferences: Record<string, unknown>;
}

export interface GameContext {
  module: string;
  stage: number;
  currentScene: string;
  activeQuests: string[];
  recentEvents: string[];
}

export interface ACEResponse {
  sessionId: string;
  npcId: string;
  output: ACEOutput;
  stateUpdate?: Partial<NPCState>;
  actions?: NPCAction[];
}

export interface ACEOutput {
  text: string;
  audioUrl?: string;
  animationId?: string;
  emotion: string;
  gestureId?: string;
  facialExpression?: string;
}

export interface NPCAction {
  type: 'move' | 'emote' | 'give_item' | 'start_quest' | 'teach' | 'demonstrate';
  payload: Record<string, unknown>;
  delay?: number;
}

// A2A Protocol Types
export interface A2AMessage {
  id: string;
  from: string;
  to: string;
  type: A2AMessageType;
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number; // Time to live in ms
}

export type A2AMessageType =
  | 'request'
  | 'response'
  | 'delegate'
  | 'notify'
  | 'broadcast'
  | 'query'
  | 'command'
  | 'event';

export interface A2ARequest {
  action: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
  timeout?: number;
}

export interface A2AResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface A2ACapability {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

// NPC Registry
export interface NPCRegistry {
  npcs: Map<string, NPCIdentity>;
  activeNpcs: Set<string>;
  npcStates: Map<string, NPCState>;
  npcMemories: Map<string, NPCMemory>;
}

// Predefined NPCs for each module
export const COGNITIVE_MILL_NPCS: NPCIdentity[] = [
  {
    id: 'miller-mae',
    name: 'Miller Mae',
    role: 'mentor',
    module: 'cognitive-mill',
    persona: 'wise-elder',
    backstory: 'A third-generation miller who has seen the transition from water wheels to steam power. She speaks in mechanical metaphors and sees patterns in everything.',
    traits: ['patient', 'observant', 'methodical', 'encouraging'],
    expertise: ['gear ratios', 'mechanical advantage', 'problem decomposition'],
  },
  {
    id: 'cog-the-apprentice',
    name: 'Cog',
    role: 'companion',
    module: 'cognitive-mill',
    persona: 'eager-learner',
    backstory: 'A young apprentice who learns alongside the player. Sometimes makes mistakes but always bounces back with enthusiasm.',
    traits: ['curious', 'clumsy', 'optimistic', 'creative'],
    expertise: ['basic mechanics', 'trial and error', 'creative solutions'],
  },
  {
    id: 'professor-sprocket',
    name: 'Professor Sprocket',
    role: 'expert',
    module: 'cognitive-mill',
    persona: 'eccentric-inventor',
    backstory: 'An inventor obsessed with automation. Speaks rapidly and often goes on tangents about efficiency and optimization.',
    traits: ['brilliant', 'distracted', 'passionate', 'perfectionist'],
    expertise: ['automation', 'algorithms', 'optimization', 'state machines'],
  },
];

export const SITKA_SOUND_NPCS: NPCIdentity[] = [
  {
    id: 'captain-tide',
    name: 'Captain Tide',
    role: 'mentor',
    module: 'sitka-sound',
    persona: 'weathered-captain',
    backstory: 'A veteran fishing captain who has weathered countless storms. Teaches through sea stories and hard-won wisdom.',
    traits: ['gruff', 'wise', 'superstitious', 'protective'],
    expertise: ['navigation', 'weather patterns', 'risk assessment', 'crew management'],
  },
  {
    id: 'marina',
    name: 'Marina',
    role: 'shopkeeper',
    module: 'sitka-sound',
    persona: 'shrewd-merchant',
    backstory: 'Runs the fish market and understands the economics of the fishing industry better than anyone.',
    traits: ['calculating', 'fair', 'knowledgeable', 'competitive'],
    expertise: ['market dynamics', 'game theory', 'negotiation', 'resource valuation'],
  },
  {
    id: 'old-salt',
    name: 'Old Salt',
    role: 'quest-giver',
    module: 'sitka-sound',
    persona: 'mysterious-elder',
    backstory: 'An ancient fisherman who knows secrets of the deep. Speaks in riddles and tests players with challenging scenarios.',
    traits: ['cryptic', 'testing', 'knowledgeable', 'mystical'],
    expertise: ['advanced strategies', 'hidden patterns', 'ecosystem thinking'],
  },
];

export const INTELLIGENCE_RANCH_NPCS: NPCIdentity[] = [
  {
    id: 'rancher-ray',
    name: 'Rancher Ray',
    role: 'mentor',
    module: 'intelligence-ranch',
    persona: 'tech-rancher',
    backstory: 'A modern rancher who embraced AI early. Sees parallels between raising livestock and training AI models.',
    traits: ['practical', 'innovative', 'patient', 'systems-thinker'],
    expertise: ['agent training', 'feedback loops', 'emergent behavior', 'swarm intelligence'],
  },
  {
    id: 'data-dana',
    name: 'Data Dana',
    role: 'expert',
    module: 'intelligence-ranch',
    persona: 'data-scientist',
    backstory: 'A researcher studying emergent intelligence in agent swarms. Obsessed with metrics and optimization.',
    traits: ['analytical', 'curious', 'precise', 'experimental'],
    expertise: ['metrics', 'evaluation', 'model behavior', 'emergent patterns'],
  },
  {
    id: 'shepherd-sam',
    name: 'Shepherd Sam',
    role: 'companion',
    module: 'intelligence-ranch',
    persona: 'ai-whisperer',
    backstory: 'Has an intuitive understanding of AI behavior. Can predict what agents will do before they do it.',
    traits: ['intuitive', 'calm', 'observant', 'empathetic'],
    expertise: ['behavior prediction', 'agent psychology', 'training techniques'],
  },
];
