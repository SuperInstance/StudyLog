/**
 * Being State System - Type Definitions
 *
 * A comprehensive system for managing multi-layered being states in Godot simulations.
 * Integrates generative AI for visual/audio transformations, vibe coding for gameplay
 * mutations, and ACE-powered agent intelligence.
 */

// ============================================================================
// Being State Enumerations
// ============================================================================

/**
 * Visual appearance states - controls how entities look via generative AI
 */
export type VisualState =
  | 'ethereal'      // Glowing, translucent, particle effects
  | 'mechanical'    // Robotic, metallic, geometric
  | 'organic'       // Living, growing, flowing forms
  | 'crystalline'   // Sharp, refractive, light-bending
  | 'shadow'        // Dark, misty, hard to focus
  | 'radiant'       // Bright, emitting light, blinding
  | 'void'          // Empty, absence-based, negative space
  | 'elemental'     // Fire, water, earth, air themed
  | 'cyber'         // Neon, glitch, digital artifact
  | 'ancient';      // Weathered, rune-covered, mysterious

/**
 * Audio atmosphere states - controls procedural audio and music
 */
export type AudioState =
  | 'eerie'         // Whispering, ambient unsettling
  | 'triumphant'    // Orchestral, powerful, swelling
  | 'muted'         // Quiet, minimal, sparse
  | 'chaotic'       // Dissonant, layered, overwhelming
  | 'serene'        // Peaceful, harmonic, floating
  | 'intense'       // Driving, rhythmic, urgent
  | 'mystical'      // Otherworldly, reverb-heavy
  | 'mechanical'    // Industrial, repetitive, metallic
  | 'natural'       // Environmental, organic sounds
  | 'digital';      // Synthesized, glitchy, electronic

/**
 * Gameplay rule states - controls game mechanics via vibe coding
 */
export type GameplayState =
  | 'chaotic'       // Unpredictable rules, random mutations
  | 'ordered'       // Structured, tactical, predictable
  | 'dreamlike'     // Surreal mechanics, logic-defying
  | 'survival'      // Resource scarcity, permadeath stakes
  | 'creative'      // Building-focused, freeform expression
  | 'competitive'   // PVP scoring, ranked, zero-sum
  | 'cooperative'   // Shared objectives, symbiotic
  | 'exploration'   // Discovery-driven, fog of war
  | 'puzzle'        // Logic gates, constraint-based
  | 'narrative';    // Story-driven, branching paths

/**
 * Agent intelligence states - controls unit autonomy and AI behavior
 */
export type AgentState =
  | 'autonomous'    // Self-directed, goal-seeking
  | 'directed'      // Player-led, command-following
  | 'emergent'      // Collective intelligence, swarm behavior
  | 'dormant'       // Passive, reactive only
  | 'rogue'         // Independent, potentially hostile
  | 'symbiotic'     // Mutually beneficial with player
  | 'learning'      // Adapting from player behavior
  | 'teaching'      // Guiding player, hint-giving
  | 'mimicking'     // Copying player patterns
  | 'transcendent'; // Beyond rules, godlike awareness

/**
 * Composite being state combining all four layers
 */
export interface BeingState {
  id: string;
  sessionId: string;
  visual: VisualState;
  audio: AudioState;
  gameplay: GameplayState;
  agent: AgentState;
  // Intensity 0-1 affects how strongly the state is expressed
  intensity: number;
  // Transition data
  previousState?: Partial<BeingState>;
  transitionReason?: string;
  // Timestamps
  createdAt: number;
  updatedAt: number;
  expiresAt?: number; // For temporary states
}

/**
 * State transition request
 */
export interface StateTransitionRequest {
  sessionId: string;
  // If specified, only transition these layers
  visual?: VisualState;
  audio?: AudioState;
  gameplay?: GameplayState;
  agent?: AgentState;
  // Intensity for new state
  intensity?: number;
  // Duration for temporary states (ms)
  duration?: number;
  // Reason for transition (for logging/learning)
  reason?: string;
  // Additional context for the transition
  context?: Record<string, unknown>;
}

/**
 * State transition response
 */
export interface StateTransitionResponse {
  success: boolean;
  state: BeingState;
  changes: StateChanges;
  effects: StateEffects;
  cost?: number;
}

/**
 * Changes made during transition
 */
export interface StateChanges {
  visual: { from?: VisualState; to: VisualState };
  audio: { from?: AudioState; to: AudioState };
  gameplay: { from?: GameplayState; to: GameplayState };
  agent: { from?: AgentState; to: AgentState };
  intensity: { from: number; to: number };
}

/**
 * Effects to apply after state change
 */
export interface StateEffects {
  // Visual effects to spawn
  visualEffects: VisualEffect[];
  // Audio modifications
  audioModifications: AudioModification[];
  // Gameplay rule mutations
  gameplayMutations: GameplayMutation[];
  // Agent behavior updates
  agentUpdates: AgentUpdate[];
  // Godot bridge commands
  godotCommands: GodotCommand[];
}

// ============================================================================
// Visual State Types
// ============================================================================

/**
 * Visual effect configuration
 */
export interface VisualEffect {
  id: string;
  type: VisualEffectType;
  target: string; // Node path or entity ID
  config: Record<string, unknown>;
  duration?: number;
  easing?: string;
}

/**
 * Types of visual effects
 */
export type VisualEffectType =
  | 'material'           // Change material/shader
  | 'particle'           // Spawn particle system
  | 'animation'          // Change animation blend
  | 'scale'              // Scale transformation
  | 'rotation'           // Rotation animation
  | 'color'              // Color shift
  | 'glow'               // Emission/intensity
  | 'distortion'         // Mesh distortion
  | 'transparency'       // Opacity change
  | 'vfx_shader';        // Custom shader effect

/**
 * Visual transformation generated by AI
 */
export interface VisualTransformation {
  state: VisualState;
  // Procedural material descriptions
  materials: MaterialConfig[];
  // Particle system configurations
  particles: ParticleConfig[];
  // Shader code (GLSL) for custom effects
  shaders?: ShaderConfig[];
  // 3D model modifications
  modelMods?: ModelModification[];
  // Lighting changes
  lighting?: LightingConfig;
}

/**
 * Material configuration for procedural generation
 */
export interface MaterialConfig {
  target: string;
  // Base color
  albedo: RGB;
  // Metallic/roughness
  metallic: number;
  roughness: number;
  // Emission
  emission?: RGB;
  emissionIntensity?: number;
  // Texture generation prompts
  texturePrompts?: {
    albedo?: string;
    normal?: string;
    orm?: string; // Occlusion, roughness, metallic
  };
  // Shader override
  shaderCode?: string;
}

/**
 * RGB color
 */
export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Particle system configuration
 */
export interface ParticleConfig {
  name: string;
  target: string;
  count: number;
  lifetime: number;
  // Emission shape
  shape: 'box' | 'sphere' | 'cylinder' | 'cone';
  extents?: [number, number, number];
  // Particle properties
  size: { min: number; max: number };
  velocity: { min: number; max: number };
  acceleration?: [number, number, number];
  // Color gradient
  colors: RGB[];
  // Texture
  texture?: string;
}

/**
 * Custom shader configuration
 */
export interface ShaderConfig {
  name: string;
  type: 'spatial' | 'canvas_item' | 'particle';
  code: string; // GLSL code
  uniforms: Record<string, unknown>;
}

/**
 * 3D model modifications
 */
export interface ModelModification {
  target: string;
  // Vertex displacement
  vertexDisplacement?: {
    amplitude: number;
    frequency: number;
    speed: number;
  };
  // Mesh deformation
  deformation?: {
    type: 'twist' | 'bend' | 'noise' | 'spike';
    strength: number;
  };
}

/**
 * Lighting configuration for state
 */
export interface LightingConfig {
  ambient: RGB;
  ambientIntensity: number;
  lights: LightConfig[];
}

/**
 * Individual light configuration
 */
export interface LightConfig {
  type: 'directional' | 'omni' | 'spot';
  position: [number, number, number];
  color: RGB;
  intensity: number;
  // Shadow settings
  shadows?: boolean;
  shadowBias?: number;
}

// ============================================================================
// Audio State Types
// ============================================================================

/**
 * Audio modification configuration
 */
export interface AudioModification {
  id: string;
  type: AudioModType;
  config: Record<string, unknown>;
}

/**
 * Types of audio modifications
 */
export type AudioModType =
  | 'music'          // Change music track/state
  | 'ambient'        // Ambient layer changes
  | 'sfx'            // Sound effect triggers
  | 'volume'         // Volume mixing
  | 'filter'         // Audio filter (LPF, HPF, etc.)
  | 'pitch'          // Pitch shift
  | 'reverb'         // Reverb send
  | 'delay'          // Delay/tape echo
  | 'distortion'     // Audio distortion
  | 'silence';       // Mute/fade out

/**
 * Audio state configuration
 */
export interface AudioStateConfig {
  state: AudioState;
  // Music prompts for AI generation
  musicPrompts: MusicPrompt[];
  // Ambient sound layers
  ambientLayers: AmbientLayer[];
  // SFX changes
  sfxReplacements: SFXReplacement[];
  // Mix settings
  mix: AudioMix;
}

/**
 * Prompt for AI music generation
 */
export interface MusicPrompt {
  mood: string;
  tempo?: number;
  key?: string;
  instruments?: string[];
  duration?: number;
  // For Suno, Udio, etc.
  style?: string;
}

/**
 * Ambient sound layer
 */
export interface AmbientLayer {
  name: string;
  sound: string; // Path or procedural description
  volume: number;
  loop: boolean;
  // 3D positioning
  position?: [number, number, number];
  // Random variation
  randomPitch?: { min: number; max: number };
  randomInterval?: { min: number; max: number };
}

/**
 * SFX replacement mapping
 */
export interface SFXReplacement {
  original: string;
  replacement: string; // Path or generation prompt
  pitchMod?: number;
  filter?: string;
}

/**
 * Audio mix settings
 */
export interface AudioMix {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  voiceVolume: number;
}

// ============================================================================
// Gameplay State Types
// ============================================================================

/**
 * Gameplay mutation - vibe coded rule changes
 */
export interface GameplayMutation {
  id: string;
  type: GameplayMutationType;
  rule: string; // Rule identifier
  value: unknown; // New value
  duration?: number;
}

/**
 * Types of gameplay mutations
 */
export type GameplayMutationType =
  | 'movement'       // Speed, jump, gravity changes
  | 'combat'         // Damage, health, armor
  | 'resource'       // Gather rates, caps
  | 'cooldown'       // Ability cooldowns
  | 'ai'             // AI difficulty parameters
  | 'physics'        // Physics simulation params
  | 'time'           // Time scale, slow-mo
  | 'camera'         // Camera behavior
  | 'ui'             // HUD/inventory changes
  | 'objective';     // Goal/win condition changes

/**
 * Gameplay state configuration
 */
export interface GameplayStateConfig {
  state: GameplayState;
  // Rule mutations
  mutations: GameplayMutation[];
  // Vibe code prompt for LLM
  vibePrompt: string;
  // LimboAI behavior tree modifications
  behaviorMods?: BehaviorModification[];
}

/**
 * Behavior tree modification for LimboAI
 */
export interface BehaviorModification {
  agentId: string;
  behaviorName: string;
  // New subtree in GDScript format
  subtree?: string;
  // Node parameter changes
  params?: Record<string, unknown>;
  // Task additions/removals
  tasks?: {
    add?: string[];
    remove?: string[];
  };
}

// ============================================================================
// Agent State Types
// ============================================================================

/**
 * Agent behavior update
 */
export interface AgentUpdate {
  id: string;
  target: string; // Agent or group ID
  state: AgentState;
  config: AgentConfig;
}

/**
 * Agent configuration for different states
 */
export interface AgentConfig {
  // ACE integration
  ace?: ACEConfig;
  // Local LLM (Ollama) settings
  localLLM?: LocalLLMConfig;
  // Behavior tree
  behaviorTree?: BehaviorTreeConfig;
  // Memory system
  memory?: MemoryConfig;
  // Communication
  communication?: CommunicationConfig;
}

/**
 * NVIDIA ACE integration config
 */
export interface ACEConfig {
  enabled: boolean;
  model: string;
  personality: string;
  autonomy: number; // 0-1
  voice?: string;
  capabilities: string[];
}

/**
 * Local LLM (Ollama) config for unit chatter
 */
export interface LocalLLMConfig {
  enabled: boolean;
  model: string; // e.g., 'llama3.1:8b'
  endpoint?: string;
  // Chatter personality
  personality: string;
  // Context window for chatter
  contextSize: number;
  // Response timeout
  timeout: number;
}

/**
 * LimboAI behavior tree config
 */
export interface BehaviorTreeConfig {
  // GDScript behavior tree code
  tree?: string;
  // Node overrides
  nodeOverrides?: Record<string, unknown>;
  // Task priorities
  priorities?: Record<string, number>;
}

/**
 * Memory configuration (NVIDIA Nemotron style)
 */
export interface MemoryConfig {
  enabled: boolean;
  // Memory tiers to enable
  tiers: ('episodic' | 'semantic' | 'procedural')[];
  // Memory retention (episodes)
  retention: number;
  // Consolidation interval
  consolidationInterval: number;
}

/**
 * Agent communication config
 */
export interface CommunicationConfig {
  // chatter frequency (0-1)
  chatterFrequency: number;
  // Voice enablement
  voiceEnabled: boolean;
  // Team communication
  teamRadio: boolean;
  // Enemy communication (for rogues, etc.)
  enemyRadio: boolean;
}

// ============================================================================
// CrewAI Integration Types
// ============================================================================

/**
 * Crew configuration for multi-agent orchestration
 */
export interface CrewConfig {
  id: string;
  name: string;
  agents: CrewAgent[];
  tasks: CrewTask[];
  // Crew coordination
  coordination: CrewCoordination;
}

/**
 * Agent within a crew
 */
export interface CrewAgent {
  id: string;
  role: CrewRole;
  state: AgentState;
  capabilities: string[];
  // LLM config for this agent
  llm: string; // Model to use
  // System prompt
  systemPrompt: string;
  // Allowed actions
  allowedActions: string[];
}

/**
 * Crew roles
 */
export type CrewRole =
  | 'scout'         // Forward observer, information gathering
  | 'tank'          // Damage absorption, frontline
  | 'damage'        // DPS, focused attacks
  | 'support'       // Healing, buffing
  | 'commander'     // Strategic oversight, orders
  | 'builder'       // Construction, fortification
  | 'researcher'    // Information processing
  | 'diplomat';     // Negotiation, trade

/**
 * Task assigned to crew
 */
export interface CrewTask {
  id: string;
  type: CrewTaskType;
  description: string;
  assignedTo: string[]; // Agent IDs
  priority: number;
  dependencies: string[]; // Other task IDs
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Crew task types
 */
export type CrewTaskType =
  | 'explore'       // Area reconnaissance
  | 'engage'        // Combat engagement
  | 'defend'        // Area defense
  | 'build'         // Construction
  | 'research'      // Information gathering
  | 'retrieve'      // Resource/item collection
  | 'escort'        // Protection detail
  | 'solve';        // Puzzle/problem solving

/**
 * Crew coordination settings
 */
export interface CrewCoordination {
  // Communication protocol
  protocol: 'centralized' | 'decentralized' | 'hierarchical';
  // Decision making
  decisionMaking: 'voting' | 'leader' | 'consensus';
  // Shared memory
  sharedMemory: boolean;
  // Conflict resolution
  conflictResolution: 'priority' | 'negotiate' | 'random';
}

// ============================================================================
// RAG Injection Types
// ============================================================================

/**
 * Real-time data injection for context
 */
export interface RAGInjection {
  sessionId: string;
  agentId?: string;
  // Context data
  context: RAGContext;
  // Relevance score
  relevance: number;
  // Timestamp
  timestamp: number;
}

/**
 * Context data for RAG injection
 */
export interface RAGContext {
  // Game state snapshot
  gameState: GameStateSnapshot;
  // Recent events
  recentEvents: GameEvent[];
  // Player state
  playerState: PlayerState;
  // Environmental data
  environment: EnvironmentContext;
  // Strategic analysis
  strategy?: StrategicAnalysis;
}

/**
 * Game state snapshot for RAG
 */
export interface GameStateSnapshot {
  // Units and positions
  units: UnitInfo[];
  // Resources
  resources: ResourceInfo[];
  // Objectives
  objectives: ObjectiveInfo[];
  // Time
  gameTime: number;
  // State flags
  flags: Record<string, boolean>;
}

/**
 * Unit information
 */
export interface UnitInfo {
  id: string;
  type: string;
  owner: string;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  state: string;
  // Combat relevant
  damage?: number;
  armor?: number;
  range?: number;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  type: string;
  amount: number;
  capacity: number;
  position: [number, number, number];
  owner?: string;
}

/**
 * Objective information
 */
export interface ObjectiveInfo {
  id: string;
  type: string;
  description: string;
  status: 'active' | 'completed' | 'failed';
  position?: [number, number, number];
  progress?: number;
}

/**
 * Game event
 */
export interface GameEvent {
  id: string;
  type: string;
  timestamp: number;
  source?: string;
  target?: string;
  data: Record<string, unknown>;
}

/**
 * Player state
 */
export interface PlayerState {
  id: string;
  resources: Record<string, number>;
  upgrades: string[];
  // Current objectives
  currentObjectives: string[];
  // Completed objectives
  completedObjectives: string[];
}

/**
 * Environmental context
 */
export interface EnvironmentContext {
  // Terrain features
  terrain: TerrainFeature[];
  // Visibility
  visibility: VisibilityMap;
  // Time of day
  timeOfDay: number; // 0-1
  // Weather
  weather?: string;
}

/**
 * Terrain feature
 */
export interface TerrainFeature {
  type: string;
  position: [number, number, number];
  size: [number, number, number];
  properties: Record<string, unknown>;
}

/**
 * Visibility map
 */
export interface VisibilityMap {
  // Fog of war data
  fog: number[][]; // 0 = hidden, 1 = visible
  resolution: [number, number];
  bounds: [[number, number], [number, number]];
}

/**
 * Strategic analysis (AI-generated)
 */
export interface StrategicAnalysis {
  // Threat assessment
  threats: ThreatAssessment[];
  // Opportunities
  opportunities: Opportunity[];
  // Recommendations
  recommendations: Recommendation[];
  // Confidence
  confidence: number;
}

/**
 * Threat assessment
 */
export interface ThreatAssessment {
  source: string;
  type: string;
  severity: number; // 0-1
  imminence: number; // 0-1
  countermeasures: string[];
}

/**
 * Opportunity
 */
export interface Opportunity {
  type: string;
  position: [number, number, number];
  value: number;
  risk: number;
  actions: string[];
}

/**
 * Recommendation
 */
export interface Recommendation {
  action: string;
  target?: string;
  priority: number;
  reasoning: string;
  expectedOutcome: string;
}

// ============================================================================
// Action Execution Types
// ============================================================================

/**
 * Executed action from agent plan
 */
export interface ExecutedAction {
  id: string;
  agentId: string;
  action: string;
  params: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  timestamp: number;
}

/**
 * LimboAI task execution
 */
export interface LimboTaskExecution {
  agentId: string;
  taskId: string;
  // Task node path
  nodePath: string;
  // Task parameters
  params: Record<string, unknown>;
  // Execution result
  result: unknown;
}

// ============================================================================
// Feedback Loop Types
// ============================================================================

/**
 * Feedback from environment to agent conversation
 */
export interface EnvironmentFeedback {
  sessionId: string;
  agentId?: string;
  // Action that generated feedback
  actionId: string;
  // Feedback data
  feedback: FeedbackData;
  // Timestamp
  timestamp: number;
}

/**
 * Feedback data from environment
 */
export interface FeedbackData {
  // Success/failure
  outcome: 'success' | 'failure' | 'partial';
  // Metrics
  metrics: Record<string, number>;
  // Observations
  observations: string[];
  // Unexpected events
  surprises?: Surprise[];
  // Learning signal
  learningSignal?: number; // Positive or negative reinforcement
}

/**
 * Unexpected event
 */
export interface Surprise {
  type: string;
  description: string;
  severity: number; // How surprising
  impact: string; // What changed
}

/**
 * Agent conversation update from feedback
 */
export interface ConversationUpdate {
  agentId: string;
  conversationId: string;
  // New message to inject
  message: ConversationMessage;
  // Context update
  contextUpdate?: Record<string, unknown>;
}

/**
 * Message in agent conversation
 */
export interface ConversationMessage {
  role: 'system' | 'assistant' | 'user' | 'tool';
  content: string;
  timestamp: number;
  // For tool messages
  toolCallId?: string;
  toolResult?: unknown;
}

// ============================================================================
// Godot Bridge Types
// ============================================================================

/**
 * Command to send via Godot bridge
 */
export interface GodotCommand {
  type: GodotCommandType;
  target?: string;
  params: Record<string, unknown>;
  id?: string;
}

/**
 * Godot command types
 */
export type GodotCommandType =
  | 'spawn'
  | 'despawn'
  | 'move'
  | 'animate'
  | 'play_sound'
  | 'stop_sound'
  | 'set_material'
  | 'set_shader_param'
  | 'emit_particles'
  | 'camera_shake'
  | 'time_scale'
  | 'rpc_call'
  | 'set_state'
  | 'get_state';

// ============================================================================
// Environment Types (Cloudflare Workers)
// ============================================================================

/**
 * Cloudflare Worker environment bindings for Being State System
 */
export interface BeingStateEnv {
  // D1 Databases
  BEING_STATE_DB?: D1Database;

  // KV Namespaces
  BEING_STATE_CACHE?: KVNamespace;
  STATE_TRANSITION_CACHE?: KVNamespace;

  // R2 Storage
  ASSET_STORAGE?: R2Bucket;

  // Queue
  STATE_TRANSITION_QUEUE?: Queue;

  // AI Providers
  DEEPSEEK_API_KEY?: string;
  ZHIPU_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  NVIDIA_API_KEY?: string;
  OLLAMA_URL?: string;

  // Godot Bridge
  GODOT_BRIDGE_URL?: string;

  // Event System
  EVENT_BUS_URL?: string;

  // Environment
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: APIMetadata;
}

/**
 * API error details
 */
export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * API metadata
 */
export interface APIMetadata {
  requestId: string;
  timestamp: number;
  processingTimeMs: number;
  version: string;
}

// ============================================================================
// Cost Tracking Types
// ============================================================================

/**
 * Cost entry for being state operations
 */
export interface BeingStateCostEntry {
  sessionId: string;
  operation: string;
  stateLayers: string[];
  cost: number;
  tokens?: {
    input: number;
    output: number;
  };
  timestamp: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid VisualState
 */
export function isValidVisualState(value: unknown): value is VisualState {
  const visualStates: VisualState[] = [
    'ethereal', 'mechanical', 'organic', 'crystalline',
    'shadow', 'radiant', 'void', 'elemental', 'cyber', 'ancient',
  ];
  return typeof value === 'string' && visualStates.includes(value as VisualState);
}

/**
 * Check if a value is a valid AudioState
 */
export function isValidAudioState(value: unknown): value is AudioState {
  const audioStates: AudioState[] = [
    'eerie', 'triumphant', 'muted', 'chaotic', 'serene',
    'intense', 'mystical', 'mechanical', 'natural', 'digital',
  ];
  return typeof value === 'string' && audioStates.includes(value as AudioState);
}

/**
 * Check if a value is a valid GameplayState
 */
export function isValidGameplayState(value: unknown): value is GameplayState {
  const gameplayStates: GameplayState[] = [
    'chaotic', 'ordered', 'dreamlike', 'survival', 'creative',
    'competitive', 'cooperative', 'exploration', 'puzzle', 'narrative',
  ];
  return typeof value === 'string' && gameplayStates.includes(value as GameplayState);
}

/**
 * Check if a value is a valid AgentState
 */
export function isValidAgentState(value: unknown): value is AgentState {
  const agentStates: AgentState[] = [
    'autonomous', 'directed', 'emergent', 'dormant', 'rogue',
    'symbiotic', 'learning', 'teaching', 'mimicking', 'transcendent',
  ];
  return typeof value === 'string' && agentStates.includes(value as AgentState);
}
