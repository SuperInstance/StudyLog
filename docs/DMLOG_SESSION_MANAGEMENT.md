# DMLoG.AI Session Management System

**Product:** DMLoG.AI - TTRPG Dungeon Master Assistant with AI Practice Players
**Agent:** Agent 6/7 - Session Management System Designer
**Date:** 2026-01-10
**Status:** Design Specification

---

## Table of Contents

1. [Overview](#overview)
2. [Session Types](#session-types)
3. [Session Lifecycle](#session-lifecycle)
4. [State Management](#state-management)
5. [Multiplayer Support](#multiplayer-support)
6. [Analytics & Metrics](#analytics--metrics)
7. [Backend API Design](#backend-api-design)
8. [WebSocket Protocol](#websocket-protocol)
9. [Database Schema](#database-schema)
10. [Implementation Examples](#implementation-examples)
11. [Integration Points](#integration-points)

---

## Overview

The DMLoG.AI Session Management System provides comprehensive lifecycle management for TTRPG sessions, supporting solo practice with AI party members, multiplayer campaigns, one-shot adventures, and DM preparation sessions.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **State Persistence** | Every session state is persistable and resumable |
| **Real-Time Sync** | Multiplayer sessions use WebSocket for instant updates |
| **AI Agency** | AI characters have autonomous decision-making within sessions |
| **Story Continuity** | Narrative state persists across campaign sessions |
| **DM Empowerment** | Tools to prep, run, and analyze games |

### Core Concepts

```
┌─────────────────────────────────────────────────────────────────┐
│                    DMLoG Session Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Campaign    │    │  One-Shot    │    │   Practice   │      │
│  │   Sessions   │    │  Adventures  │    │   Sessions   │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Session Core   │                          │
│                    │  - Lifecycle    │                          │
│                    │  - State        │                          │
│                    │  - Turn Order   │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐        │
│  │   Player    │    │     AI      │    │     DM      │        │
│  │  Manager    │    │  Director    │    │   Tools     │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Session Types

### 1. Campaign Sessions

**Purpose:** Ongoing stories that persist across multiple sessions

**Characteristics:**
- Persistent narrative state
- Character progression (XP, levels, loot)
- Plot thread tracking
- Long-term relationship changes
- World state evolution

**Schema:**
```typescript
interface CampaignSession extends BaseSession {
  type: 'campaign';
  campaignId: string;
  sessionNumber: number;

  // Narrative persistence
  plotThreads: PlotThread[];
  worldState: Record<string, any>;
  characterProgress: CharacterProgress[];

  // Continuity
  previousSessionId?: string;
  cliffhangerNote?: string;
  nextSessionPreview?: string;
}

interface PlotThread {
  id: string;
  title: string;
  status: 'introduced' | 'developing' | 'climax' | 'resolved' | 'abandoned';
  importance: number; // 1-10
  relatedNPCs: string[];
  relatedLocations: string[];
  cluesDiscovered: string[];
  playerNotes?: string;
}

interface CharacterProgress {
  characterId: string;
  xp: number;
  level: number;
  milestones: string[];
  inventoryChanges: InventoryChange[];
  relationshipChanges: RelationshipChange[];
}
```

### 2. One-Shot Adventures

**Purpose:** Complete self-contained stories in a single session

**Characteristics:**
- Pre-generated characters or quick creation
- Focused narrative (3-5 hours)
- No long-term persistence
- Optimized for convention/playground play
- Standalone achievements

**Schema:**
```typescript
interface OneShotSession extends BaseSession {
  type: 'oneshot';
  adventureTemplate: string;
  estimatedDuration: number; // minutes

  // Quick setup
  pregenCharacters: CharacterTemplate[];
  quickCreationRules?: QuickCreationRules;

  // Focused pacing
  sceneBreaks: SceneBreak[];
  timeTracking: {
    startTime: number;
    currentScene: number;
    estimatedRemaining: number;
  };
}
```

### 3. Practice Sessions

**Purpose:** Solo DM practice with AI party members

**Characteristics:**
- AI-controlled party
- Scenario-based (combat, social, exploration)
- Performance feedback
- Technique suggestions
- Replay/analytics support

**Schema:**
```typescript
interface PracticeSession extends BaseSession {
  type: 'practice';
  scenarioType: 'combat' | 'social' | 'exploration' | 'puzzle' | 'mixed';

  // AI Party
  aiParty: AIPartyMember[];
  partyStrategy: PartyStrategy;

  // Practice goals
  objectives: PracticeObjective[];
  focusAreas: PracticeFocusArea[];

  // Feedback
  performanceMetrics: PerformanceMetrics;
  suggestions: PracticeSuggestion[];
}

interface AIPartyMember {
  id: string;
  name: string;
  characterClass: string;
  level: number;
  personality: PersonalityProfile;
  playstyle: AggressionProfile;
  autonomy: number; // 0-1, how independently they act
}

interface PartyStrategy {
  formation: PartyFormation;
  communicationStyle: 'discuss-everything' | 'efficient' | 'chaotic';
  initiativeStyle: 'group' | 'individual';
  restStrategy: 'short-rest' | 'long-rest' | 'push-on';
}
```

### 4. DM Prep Sessions

**Purpose:** Session zero, worldbuilding, encounter preparation

**Characteristics:**
- No active gameplay
- World/region/NPC creation tools
- Encounter balancing calculators
- Reference material organization
- Export to actual session

**Schema:**
```typescript
interface PrepSession extends BaseSession {
  type: 'prep';
  prepCategory: 'session-zero' | 'encounter' | 'worldbuilding' | 'npc';

  // Tools available
  toolsEnabled: PrepTools;

  // Outputs
  generatedContent: GeneratedContent[];
  exportTargets: string[]; // Session IDs to export to
}

interface PrepTools {
  encounterBuilder: boolean;
  npcGenerator: boolean;
  regionMapper: boolean;
  factionBuilder: boolean;
  itemCreator: boolean;
  plotWeaver: boolean;
}
```

---

## Session Lifecycle

### State Machine

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │
                    [Start Session]
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│                         SETUP                             │
│  • Character loading/creation                             │
│  • Encounter initialization                                │
│  • Turn order determination                               │
│  • Initial state calculation                              │
└────────────────────────┬─────────────────────────────────┘
                         │
                    [Begin Play]
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                         ACTIVE                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │                    TURN LOOP                       │  │
│  │  • Declare actions                                 │  │
│  │  • Resolution                                      │  │
│  │  • State update                                    │  │
│  │  • Trigger events                                  │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
           [Pause]           [End]
                │                 │
                ▼                 ▼
┌─────────────────────┐  ┌─────────────────────┐
│       PAUSED        │  │      COMPLETE       │
│  • State saved      │  │  • Rewards applied  │
│  • Resumeable       │  │  • Consolidation    │
└──────────┬──────────┘  │  • Archive ready    │
           │             └─────────────────────┘
       [Resume]                  │
           │                     ▼
           │              ┌─────────────┐
           └──────────────│  ARCHIVED   │
                          └─────────────┘
```

### Lifecycle Enum

```typescript
enum SessionPhase {
  CREATED = 'created',       // Initial state, no players connected
  SETUP = 'setup',           // Characters loading, initializing
  ACTIVE = 'active',         // Game in progress, turn resolution
  PAUSED = 'paused',         // Temporarily halted, resumable
  COMPLETE = 'complete',     // Game ended, rewards pending
  ARCHIVED = 'archived',     // Consolidated, read-only
  CANCELLED = 'cancelled',   // Aborted before completion
}

enum TurnPhase {
  INITIATIVE = 'initiative', // Rolling initiative
  DECLARE = 'declare',       // Players declaring actions
  RESOLVE = 'resolve',       // Actions being resolved
  EFFECTS = 'effects',       // Ongoing effects/damage
  CLEANUP = 'cleanup',       // End of turn processing
}
```

### State Transitions

```typescript
interface SessionTransition {
  from: SessionPhase;
  to: SessionPhase;
  trigger: TransitionTrigger;
  guard?: TransitionGuard;
  sideEffects?: SideEffect[];
}

type TransitionTrigger =
  | 'start_session'
  | 'begin_first_turn'
  | 'pause_request'
  | 'resume_request'
  | 'end_encounter'
  | 'conclude_session'
  | 'archive_complete'
  | 'cancel_request';

// Transition guard function signature
type TransitionGuard = (session: Session) => boolean | Promise<boolean>;

// Side effects to execute on transition
type SideEffect = (session: Session) => void | Promise<void>;
```

---

## State Management

### 1. Game State

**Purpose:** Track positions, HP, conditions, initiative

```typescript
interface GameState {
  // Position tracking
  positions: Map<string, Position>;

  // Combat state
  initiativeOrder: InitiativeEntry[];
  currentTurn: number;
  turnPhase: TurnPhase;

  // Health and conditions
  hp: Map<string, CurrentHP>;
  conditions: Map<string, Condition[]>;
  temporaryHP: Map<string, number>;

  // Resources
  spellSlots: Map<string, SpellSlots>;
  classResources: Map<string, Map<string, number>>;

  // Environment
  lighting: Map<string, LightLevel>;
  cover: Map<string, CoverType>;
  difficultTerrain: Set<string>;

  // Timing
  roundNumber: number;
  turnNumber: number;
  timestamp: number;
}

interface Position {
  x: number;
  y: number;
  z?: number; // For flying/swimming
  facing?: Direction;
}

interface InitiativeEntry {
  entityId: string;
  value: number;
  tiebreaker?: number;
  delayAction?: boolean;
  readyAction?: ReadyAction;
}

interface Condition {
  type: ConditionType;
  source?: string;
  remainingDuration?: number;
  value?: number;
}

type ConditionType =
  | 'blinded' | 'charmed' | 'deafened' | 'exhaustion'
  | 'frightened' | 'grappled' | 'incapacitated' | 'invisible'
  | 'paralyzed' | 'petrified' | 'poisoned' | 'prone'
  | 'restrained' | 'stunned' | 'unconscious';
```

### 2. Narrative State

**Purpose:** Track plot threads, discoveries, relationships

```typescript
interface NarrativeState {
  // Story elements
  plotThreads: PlotThread[];
  currentScene: Scene;
  sceneHistory: Scene[];

  // Discoveries
  cluesFound: Clue[];
  secretsRevealed: Secret[];
  locationsDiscovered: string[];

  // Relationships
  npcRelationships: Map<string, RelationshipMap>;
  factionReputation: Map<string, ReputationLevel>;

  // World changes
  worldChanges: WorldChange[];
  flags: Map<string, any>;

  // Session log
  narrativeLog: NarrativeEntry[];
}

interface PlotThread {
  id: string;
  name: string;
  description: string;
  status: PlotStatus;
  importance: number; // 1-10
  createdAt: number;
  updatedAt: number;

  // Connections
  relatedNPCs: string[];
  relatedLocations: string[];
  relatedItems: string[];
  parentThreads?: string[];
  childThreads?: string[];

  // Progress
  stages: PlotStage[];
  currentStage: number;
  milestonesCompleted: string[];

  // Player knowledge
  playerKnowledge: PlayerKnowledge;
}

interface RelationshipMap {
  characterId: string;
  relationships: Map<string, Relationship>;
}

interface Relationship {
  targetId: string;
  attitude: AttitudeRange; // -100 to +100
  trust: number; // 0-1
  debt: number; // -10 to +10
  history: RelationshipEvent[];
  notes?: string;
}

interface RelationshipEvent {
  timestamp: number;
  type: 'favor' | 'betrayal' | 'bonding' | 'conflict' | 'trade';
  description: string;
  impact: number; // Change in attitude
}
```

### 3. Player Progress

**Purpose:** XP, milestones, character advancement

```typescript
interface PlayerProgress {
  characterId: string;

  // Experience
  xp: number;
  xpGainedThisSession: number;
  xpBreakdown: XPSource[];

  // Level tracking
  level: number;
  milestones: Milestone[];

  // Advancement
  featuresUnlocked: string[];
  asiChoices?: ASIChoice[];

  // Session stats
  kills: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  checksPassed: number;
  checksFailed: number;
  criticalHits: number;
  natural20s: number;
  natural1s: number;
}

interface XPSource {
  type: 'combat' | 'exploration' | 'social' | 'quest' | 'roleplay';
  amount: number;
  description: string;
  timestamp: number;
}

interface Milestone {
  id: string;
  name: string;
  achievedAt: number;
  sessionNumber: number;
}
```

### 4. State Persistence

**Purpose:** Save/resume functionality

```typescript
interface SessionSnapshot {
  id: string;
  sessionId: string;
  createdAt: number;
  createdBy: string;
  name: string;
  description?: string;

  // Full state capture
  gameState: GameState;
  narrativeState: NarrativeState;
  playerProgress: Map<string, PlayerProgress>;

  // Metadata
  roundNumber: number;
  turnNumber: number;
  phase: SessionPhase;

  // Thumbnails
  thumbnailUrl?: string;
}

interface StateManager {
  // Snapshot operations
  createSnapshot(sessionId: string, name: string): Promise<SessionSnapshot>;
  loadSnapshot(snapshotId: string): Promise<void>;
  deleteSnapshot(snapshotId: string): Promise<void>;

  // Auto-save
  enableAutoSave(sessionId: string, interval: number): void;
  disableAutoSave(sessionId: string): void;

  // State diffing
  compareStates(before: GameState, after: GameState): StateDiff;
  applyDiff(state: GameState, diff: StateDiff): GameState;
}
```

---

## Multiplayer Support

### 1. Player Connection Management

```typescript
interface ConnectedPlayer {
  id: string;
  sessionId: string;
  userId: string;
  connectedAt: number;
  lastActivity: number;

  // Connection info
  socketId: string;
  connectionQuality: ConnectionQuality;

  // Permissions
  role: PlayerRole;
  permissions: Permission[];

  // State
  isReady: boolean;
  currentView: ViewType;

  // Character
  activeCharacterId?: string;
}

enum PlayerRole {
  DUNGEON_MASTER = 'dm',
  PLAYER = 'player',
  SPECTATOR = 'spectator',
  CO_DM = 'co-dm',
}

enum ConnectionQuality {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
}

interface ConnectionManager {
  // Connection lifecycle
  connect(sessionId: string, userId: string, socket: WebSocket): Promise<ConnectedPlayer>;
  disconnect(sessionId: string, userId: string): Promise<void>;
  reconnect(sessionId: string, userId: string, socket: WebSocket): Promise<void>;

  // Player state
  setReady(sessionId: string, userId: string, ready: boolean): Promise<void>;
  switchCharacter(sessionId: string, userId: string, characterId: string): Promise<void>;

  // Presence
  getActivePlayers(sessionId: string): ConnectedPlayer[];
  getPlayerCount(sessionId: number): { players: number; spectators: number; };

  // Connection monitoring
  monitorConnections(sessionId: string): Observable<ConnectionEvent>;
  handleDisconnection(sessionId: string, userId: string): DisconnectionStrategy;
}
```

### 2. Real-Time Synchronization

```typescript
interface SyncMessage {
  type: SyncMessageType;
  sessionId: string;
  timestamp: number;
  version: number;
  payload: any;
}

enum SyncMessageType {
  // State updates
  STATE_UPDATE = 'state_update',
  ENTITY_UPDATE = 'entity_update',
  NARRATIVE_UPDATE = 'narrative_update',

  // Actions
  ACTION_DECLARED = 'action_declared',
  ACTION_RESOLVED = 'action_resolved',

  // Turn management
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  ROUND_START = 'round_start',
  ROUND_END = 'round_end',

  // Chat/communication
  CHAT_MESSAGE = 'chat_message',
  DICE_ROLL = 'dice_roll',

  // Session events
  PLAYER_JOIN = 'player_join',
  PLAYER_LEAVE = 'player_leave',
  SESSION_PAUSE = 'session_pause',
  SESSION_RESUME = 'session_resume',
}

interface SynchronizationManager {
  // Broadcasting
  broadcast(sessionId: string, message: SyncMessage): void;
  broadcastToRole(sessionId: string, role: PlayerRole, message: SyncMessage): void;
  sendToPlayer(sessionId: string, userId: string, message: SyncMessage): void;

  // State sync
  syncGameState(sessionId: string, state: GameState): void;
  syncNarrative(sessionId: string, narrative: NarrativeState): void;

  // Conflict resolution
  resolveConflict(sessionId: string, conflicts: StateConflict[]): Resolution;

  // Optimistic updates
  applyOptimisticUpdate(sessionId: string, userId: string, update: StateUpdate): void;
  rollbackOptimisticUpdate(sessionId: string, updateId: string): void;
}
```

### 3. Turn Coordination

```typescript
interface TurnManager {
  // Initiative
  rollInitiative(sessionId: string): Promise<InitiativeEntry[]>;
  setInitiative(sessionId: string, entityId: string, value: number): Promise<void>;

  // Turn order
  getTurnOrder(sessionId: string): InitiativeEntry[];
  getCurrentTurn(sessionId: string): InitiativeEntry | null;
  nextTurn(sessionId: string): Promise<InitiativeEntry>;
  previousTurn(sessionId: string): Promise<InitiativeEntry>;

  // Delay/Ready
  delayAction(sessionId: string, entityId: string): Promise<void>;
  readyAction(sessionId: string, entityId: string, action: ReadyAction): Promise<void>;

  // Turn delegation
  delegateTurn(sessionId: string, fromEntity: string, toEntity: string): Promise<void>;

  // Countdown timer
  startTurnTimer(sessionId: string, duration: number): Promise<void>;
  pauseTurnTimer(sessionId: string): Promise<void>;
}

interface ReadyAction {
  type: 'attack' | 'cast' | 'skill' | 'move';
  trigger: TriggerCondition;
  action: ActionDeclaration;
}

interface TriggerCondition {
  type: 'ally-attacked' | 'enemy-moves' | 'enemy-enters-range' | 'condition';
  condition?: string;
  range?: number;
}
```

### 4. Spectator Mode

```typescript
interface SpectatorConfig {
  allowed: boolean;
  maxSpectators: number;
  canSeeHidden?: boolean;
  canSeeDice?: boolean;
  canHearVoice?: boolean;
  delaySeconds?: number; // Stream delay
  chatPermissions?: ChatPermissions;
}

interface SpectatorManager {
  // Spectator management
  addSpectator(sessionId: string, userId: string): Promise<void>;
  removeSpectator(sessionId: string, userId: string): Promise<void>;
  getSpectators(sessionId: string): ConnectedPlayer[];

  // View filtering
  filterStateForSpectators(state: GameState, config: SpectatorConfig): FilteredState;
  filterNarrativeForSpectators(narrative: NarrativeState): FilteredNarrative;

  // Replay
  startReplay(sessionId: string, spectatorId: string): void;
  stopReplay(sessionId: string, spectatorId: string): void;
  seekReplay(sessionId: string, spectatorId: string, timestamp: number): void;
}
```

---

## Analytics & Metrics

### 1. Session Metrics

```typescript
interface SessionMetrics {
  sessionId: string;

  // Timing
  duration: number; // seconds
  activeTime: number; // Actual playing time
  pauseTime: number;

  // Pacing
  turnsCompleted: number;
  roundsCompleted: number;
  scenesCompleted: number;
  averageTurnDuration: number;

  // Engagement
  playerParticipation: Map<string, ParticipationScore>;
  chatMessages: number;
  diceRolls: number;

  // Combat (if applicable)
  combats: number;
  totalCombatRounds: number;
  averageCombatDuration: number;
  tpkCount: number; // Total party kills

  // Story
  plotThreadsResolved: number;
  plotThreadsIntroduced: number;
  discoveriesMade: number;
}

interface ParticipationScore {
  playerId: string;
  actionsTaken: number;
  wordsSpoken: number;
  diceRolled: number;
  engagementRating: number; // 0-1
  contributionToStory: number; // 0-1
}
```

### 2. Player Participation

```typescript
interface PlayerAnalytics {
  playerId: string;
  sessionsPlayed: number;

  // Play style
  playStyle: PlayStyleProfile;
  combatPreference: CombatPreference;
  roleplayIntensity: number; // 0-1

  // Performance
  averageDamagePerRound: number;
  averageHealingPerRound: number;
  successRate: number;
  initiativeAvg: number;

  // Engagement trends
  engagementTrend: 'rising' | 'stable' | 'falling';
  sessionAttendance: number; // percentage

  // Social
  mostPairedWith: string[];
  contributionDistribution: Map<string, number>; // by category
}

interface PlayStyleProfile {
  combat: number; // 0-1
  roleplay: number; // 0-1
  exploration: number; // 0-1
  puzzleSolving: number; // 0-1
  leadership: number; // 0-1
}
```

### 3. Combat Effectiveness

```typescript
interface CombatAnalytics {
  sessionId: string;
  encounterId: string;

  // Overview
  duration: number;
  rounds: number;
  difficulty: EncounterDifficulty;
  outcome: CombatOutcome;

  // By character
  characterStats: Map<string, CharacterCombatStats>;

  // Action breakdown
  attacks: AttackStats;
  spells: SpellStats;
  abilities: AbilityStats;

  // Resource usage
  resourcesConsumed: ResourceUsage;

  // Effectiveness
  damagePerRound: number;
  actionEconomy: number; // Actions actually used / actions available
}

interface CharacterCombatStats {
  characterId: string;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  killingBlows: number;
  attacks: number;
  hits: number;
  misses: number;
  criticalHits: number;
  savingThrowsPassed: number;
  savingThrowsFailed: number;
  conditionsInflicted: number;
  conditionsReceived: number;
}
```

### 4. Story Engagement

```typescript
interface StoryAnalytics {
  sessionId: string;

  // Narrative flow
  scenesCompleted: number;
  scenesSkipped: number;
  sceneTransitions: SceneTransition[];

  // Plot engagement
  plotThreads: PlotEngagement[];
  discoveries: DiscoveryAnalytics[];
  notesTaken: number;

  // Roleplay
  roleplayMoments: RoleplayMoment[];
  inCharacterTime: number;
  outOfCharacterTime: number;

  // Pacing
  pacingScore: number; // 0-1, 1 = perfect
  tensionCurve: TensionPoint[];

  // Player choices
  choicesMade: ChoicePoint[];
  branchingPathsTaken: BranchPath[];
}

interface PlotEngagement {
  plotThreadId: string;
  importance: number;
  playerInterest: number; // Based on questions, notes
  resolution: 'resolved' | 'ongoing' | 'abandoned';
  playerContributions: number;
}
```

---

## Backend API Design

### 1. Session Management Endpoints

```typescript
// Session CRUD
interface SessionAPI {
  // Create
  POST   /api/sessions                    - Create new session
  POST   /api/sessions/:id/clone          - Clone existing session

  // Read
  GET    /api/sessions                    - List user's sessions
  GET    /api/sessions/:id                - Get session details
  GET    /api/sessions/:id/state          - Get current game state
  GET    /api/sessions/:id/narrative      - Get narrative state

  // Update
  PATCH  /api/sessions/:id                - Update session metadata
  POST   /api/sessions/:id/state          - Push state update
  POST   /api/sessions/:id/narrative      - Push narrative update

  // Lifecycle
  POST   /api/sessions/:id/start          - Start session
  POST   /api/sessions/:id/pause          - Pause session
  POST   /api/sessions/:id/resume         - Resume session
  POST   /api/sessions/:id/end            - End session
  POST   /api/sessions/:id/archive        - Archive session
  DELETE /api/sessions/:id                - Delete session

  // Snapshots
  POST   /api/sessions/:id/snapshots      - Create snapshot
  GET    /api/sessions/:id/snapshots      - List snapshots
  POST   /api/sessions/:id/snapshots/:snapId/restore - Restore snapshot
  DELETE /api/sessions/:id/snapshots/:snapId - Delete snapshot
}
```

### 2. Turn Management Endpoints

```typescript
interface TurnAPI {
  // Initiative
  POST   /api/sessions/:id/initiative     - Roll initiative
  PATCH  /api/sessions/:id/initiative/:entityId - Set initiative value
  POST   /api/sessions/:id/initiative/:entityId/delay - Delay action
  POST   /api/sessions/:id/initiative/:entityId/ready - Ready action

  // Turn progression
  POST   /api/sessions/:id/turn/next      - Next turn
  POST   /api/sessions/:id/turn/previous  - Previous turn
  POST   /api/sessions/:id/round/next     - Next round
  GET    /api/sessions/:id/turn/current   - Get current turn

  // Actions
  POST   /api/sessions/:id/actions        - Declare action
  PATCH  /api/sessions/:id/actions/:actionId - Modify action
  DELETE /api/sessions/:id/actions/:actionId - Cancel action
  POST   /api/sessions/:id/actions/:actionId/resolve - Resolve action

  // Timer
  POST   /api/sessions/:id/timer/start    - Start turn timer
  POST   /api/sessions/:id/timer/pause    - Pause turn timer
  POST   /api/sessions/:id/timer/reset    - Reset turn timer
}
```

### 3. Multiplayer Endpoints

```typescript
interface MultiplayerAPI {
  // Session management
  POST   /api/sessions/:id/join           - Join session
  POST   /api/sessions/:id/leave          - Leave session
  GET    /api/sessions/:id/players        - List players
  PATCH  /api/sessions/:id/players/:playerId - Update player status

  // Invites
  POST   /api/sessions/:id/invites        - Create invite
  GET    /api/sessions/:id/invites        - List invites
  DELETE /api/sessions/:id/invites/:inviteId - Revoke invite

  // Spectators
  POST   /api/sessions/:id/spectate       - Join as spectator
  GET    /api/sessions/:id/spectators     - List spectators
  DELETE /api/sessions/:id/spectators/:spectatorId - Remove spectator

  // Chat
  POST   /api/sessions/:id/chat           - Send chat message
  GET    /api/sessions/:id/chat           - Get chat history
  POST   /api/sessions/:id/chat/:messageId/react - React to message
}
```

### 4. Analytics Endpoints

```typescript
interface AnalyticsAPI {
  // Session analytics
  GET    /api/sessions/:id/analytics      - Session metrics
  GET    /api/sessions/:id/analytics/combat - Combat stats
  GET    /api/sessions/:id/analytics/story - Story engagement

  // Player analytics
  GET    /api/players/:id/analytics       - Player performance
  GET    /api/players/:id/sessions        - Player session history
  GET    /api/players/:id/companions      - Most played with

  // Aggregated
  GET    /api/analytics/campaigns/:id     - Campaign analytics
  GET    /api/analytics/encounters/:id    - Encounter comparison
}
```

---

## WebSocket Protocol

### Message Format

```typescript
interface WSMessage {
  type: MessageType;
  sessionId: string;
  timestamp: number;
  id: string; // Unique message ID
  correlationId?: string; // For request/response
  payload: any;
}

enum MessageType {
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  HEARTBEAT = 'heartbeat',

  // Session state
  SESSION_START = 'session_start',
  SESSION_PAUSE = 'session_pause',
  SESSION_RESUME = 'session_resume',
  SESSION_END = 'session_end',

  // Game state
  STATE_SYNC = 'state_sync',
  STATE_PATCH = 'state_patch',

  // Turns
  TURN_START = 'turn_start',
  TURN_END = 'turn_end',
  ACTION_DECLARE = 'action_declare',
  ACTION_RESOLVE = 'action_resolve',

  // Narrative
  NARRATIVE_UPDATE = 'narrative_update',
  SCENE_CHANGE = 'scene_change',

  // Communication
  CHAT_MESSAGE = 'chat_message',
  DICE_ROLL = 'dice_roll',

  // AI
  AI_TURN = 'ai_turn',
  AI_RESPONSE = 'ai_response',

  // Errors
  ERROR = 'error',
}
```

### Connection Flow

```typescript
// Client -> Server: Connect
{
  type: 'connect',
  sessionId: 'sess_abc123',
  token: 'jwt_token',
  payload: {
    clientVersion: '1.0.0',
    capabilities: ['voice', 'video'],
  }
}

// Server -> Client: Connected
{
  type: 'connected',
  sessionId: 'sess_abc123',
  payload: {
    userId: 'user_xyz',
    role: 'player',
    serverTime: 1641234567890,
    currentState: { /* ... */ },
  }
}

// Client -> Server: Heartbeat (every 30s)
{
  type: 'heartbeat',
  sessionId: 'sess_abc123',
  payload: {
    lastReceivedId: 'msg_456',
  }
}

// Server -> Client: Heartbeat ack
{
  type: 'heartbeat_ack',
  sessionId: 'sess_abc123',
  payload: {
    serverTime: 1641234597890,
  }
}
```

### State Synchronization

```typescript
// Full state sync (on connect or major change)
interface StateSyncMessage extends WSMessage {
  type: MessageType.STATE_SYNC;
  payload: {
    version: number;
    gameState: GameState;
    narrativeState: NarrativeState;
    turnOrder: InitiativeEntry[];
    currentTurn: number;
  };
}

// Incremental patch (for updates)
interface StatePatchMessage extends WSMessage {
  type: MessageType.STATE_PATCH;
  payload: {
    version: number;
    patch: StatePatch;
    entityUpdates: EntityUpdate[];
  };
}

interface StatePatch {
  operations: PatchOperation[];
}

interface PatchOperation {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string; // JSON Pointer
  value?: any;
}
```

### Action Flow

```typescript
// Client -> Server: Declare action
interface ActionDeclareMessage extends WSMessage {
  type: MessageType.ACTION_DECLARE;
  payload: {
    entityId: string;
    action: ActionDeclaration;
  };
}

interface ActionDeclaration {
  type: 'attack' | 'cast' | 'skill' | 'move' | 'interact' | 'dash' | 'disengage' | 'help' | 'hide' | 'search' | 'use-item';
  target?: string;
  parameters: Record<string, any>;
  rollRequested?: boolean;
}

// Server -> Client: Action validation
interface ActionValidationMessage extends WSMessage {
  type: 'action_validation';
  correlationId: string; // Matches declare message
  payload: {
    valid: boolean;
    errors?: string[];
    warnings?: string[];
    rollNeeded?: RollRequest;
  };
}

interface RollRequest {
  type: 'attack' | 'damage' | 'save' | 'check' | 'ability';
  dice: string;
  modifier: number;
  advantage?: boolean;
}

// Server -> All: Action resolved
interface ActionResolveMessage extends WSMessage {
  type: MessageType.ACTION_RESOLVE;
  payload: {
    actionId: string;
    result: ActionResult;
    stateChanges: StatePatch;
  };
}

interface ActionResult {
  success: boolean;
  critical: boolean;
  fumble: boolean;
  rolls: DiceRoll[];
  effects: EffectResult[];
  narration?: string;
}
```

### AI Integration

```typescript
// Server -> Client: AI thinking (for visualization)
interface AIThinkingMessage extends WSMessage {
  type: 'ai_thinking';
  payload: {
    characterId: string;
    stage: 'perceiving' | 'deciding' | 'acting';
    thoughtProcess?: string[];
    estimatedTime: number;
  };
}

// Server -> Client: AI action declared
interface AIActionMessage extends WSMessage {
  type: MessageType.AI_TURN;
  payload: {
    characterId: string;
    action: ActionDeclaration;
    reasoning?: string;
    confidence: number;
  };
}

// Server -> Client: AI roleplay response
interface AIResponseMessage extends WSMessage {
  type: MessageType.AI_RESPONSE;
  payload: {
    characterId: string;
    message: string;
    tone: 'friendly' | 'hostile' | 'neutral' | 'excited' | 'nervous';
    emotion: string;
    animation?: string;
  };
}
```

---

## Database Schema

### Core Tables

```sql
-- ═══════════════════════════════════════════════════════════
-- DMLoG Session Management - Database Schema
-- ═══════════════════════════════════════════════════════════

-- Sessions - Core session records
CREATE TABLE IF NOT EXISTS dmlog_sessions (
    id TEXT PRIMARY KEY,
    dm_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('campaign', 'oneshot', 'practice', 'prep')),
    phase TEXT NOT NULL DEFAULT 'created' CHECK (phase IN (
        'created', 'setup', 'active', 'paused', 'complete', 'archived', 'cancelled'
    )),

    -- Session info
    name TEXT NOT NULL,
    description TEXT,
    campaign_id TEXT REFERENCES dmlog_campaigns(id) ON DELETE SET NULL,
    adventure_template TEXT,

    -- Timing
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    paused_at TEXT,
    ended_at TEXT,
    archived_at TEXT,

    -- State storage (JSON)
    game_state TEXT DEFAULT '{}',
    narrative_state TEXT DEFAULT '{}',
    turn_state TEXT DEFAULT '{}',

    -- Settings
    settings TEXT DEFAULT '{}',
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'invite-only')),
    max_players INTEGER DEFAULT 5,

    -- Auto-save
    auto_save_enabled INTEGER DEFAULT 1,
    auto_save_interval INTEGER DEFAULT 300, -- seconds
    last_auto_save_at TEXT
);

CREATE INDEX idx_sessions_dm ON dmlog_sessions(dm_id);
CREATE INDEX idx_sessions_type ON dmlog_sessions(type);
CREATE INDEX idx_sessions_phase ON dmlog_sessions(phase);
CREATE INDEX idx_sessions_campaign ON dmlog_sessions(campaign_id);

-- Campaigns - Long-running campaign tracking
CREATE TABLE IF NOT EXISTS dmlog_campaigns (
    id TEXT PRIMARY KEY,
    dm_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    setting TEXT,

    -- Campaign state
    current_session_number INTEGER DEFAULT 0,
    world_state TEXT DEFAULT '{}',

    -- Timeline
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    is_active INTEGER DEFAULT 1,

    -- Settings
    level_start INTEGER DEFAULT 1,
    level_end INTEGER DEFAULT 20,
    party_size INTEGER DEFAULT 4,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaigns_dm ON dmlog_campaigns(dm_id);
CREATE INDEX idx_campaigns_active ON dmlog_campaigns(is_active);

-- Session Participants - Players in sessions
CREATE TABLE IF NOT EXISTS dmlog_participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    character_id TEXT REFERENCES dmlog_characters(id) ON DELETE SET NULL,

    -- Role and permissions
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('dm', 'player', 'spectator', 'co-dm')),
    permissions TEXT DEFAULT '[]',

    -- Connection
    socket_id TEXT,
    connected_at TEXT,
    last_heartbeat TEXT,
    is_connected INTEGER DEFAULT 0,

    -- Status
    is_ready INTEGER DEFAULT 0,
    current_view TEXT,

    -- Analytics
    joined_at TEXT DEFAULT (datetime('now')),
    left_at TEXT,
    active_time_seconds INTEGER DEFAULT 0,

    UNIQUE(session_id, user_id)
);

CREATE INDEX idx_participants_session ON dmlog_participants(session_id);
CREATE INDEX idx_participants_user ON dmlog_participants(user_id);
CREATE INDEX idx_participants_connected ON dmlog_participants(session_id, is_connected);

-- Characters - Player and NPC characters
CREATE TABLE IF NOT EXISTS dmlog_characters (
    id TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES students(id) ON DELETE CASCADE, -- NULL for NPCs
    name TEXT NOT NULL,
    description TEXT,

    -- Character info
    level INTEGER DEFAULT 1,
    class TEXT,
    subclass TEXT,
    background TEXT,
    race TEXT,
    alignment TEXT,

    -- Stats (stored as JSON for flexibility)
    stats TEXT DEFAULT '{}',
    abilities TEXT DEFAULT '{}',
    skills TEXT DEFAULT '{}',
    saving_throws TEXT DEFAULT '{}',

    -- Combat
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    temp_hp INTEGER DEFAULT 0,
    ac INTEGER DEFAULT 10,
    initiative_bonus INTEGER DEFAULT 0,
    speed INTEGER DEFAULT 30,

    -- Resources
    spell_slots TEXT DEFAULT '{}',
    class_features TEXT DEFAULT '[]',
    equipment TEXT DEFAULT '[]',

    -- Personality (for AI characters)
    personality TEXT DEFAULT '{}',
    backstory TEXT,

    -- Metadata
    is_ai INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    avatar_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_characters_owner ON dmlog_characters(owner_id);
CREATE INDEX idx_characters_ai ON dmlog_characters(is_ai);

-- Initiative Tracking - Turn order
CREATE TABLE IF NOT EXISTS dmlog_initiative (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,

    -- Entity info
    entity_id TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_type TEXT CHECK (entity_type IN ('player', 'npc', 'monster')),

    -- Initiative
    initiative_value INTEGER NOT NULL,
    tiebreaker INTEGER DEFAULT 0,

    -- State
    position INTEGER NOT NULL,
    has_acted INTEGER DEFAULT 0,
    delay_action INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(session_id, round_number, entity_id)
);

CREATE INDEX idx_initiative_session ON dmlog_initiative(session_id, round_number);

-- Action Log - All actions taken
CREATE TABLE IF NOT EXISTS dmlog_actions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    turn_number INTEGER NOT NULL,

    -- Actor
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,

    -- Action
    action_type TEXT NOT NULL,
    action_data TEXT DEFAULT '{}',

    -- Result
    success INTEGER,
    critical INTEGER DEFAULT 0,
    fumble INTEGER DEFAULT 0,
    rolls TEXT DEFAULT '[]',
    effects TEXT DEFAULT '[]',

    -- Metadata
    timestamp TEXT DEFAULT (datetime('now')),
    narration TEXT
);

CREATE INDEX idx_actions_session ON dmlog_actions(session_id, round_number, turn_number);

-- Narrative State - Plot threads and discoveries
CREATE TABLE IF NOT EXISTS dmlog_plot_threads (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES dmlog_campaigns(id) ON DELETE CASCADE,
    session_id TEXT REFERENCES dmlog_sessions(id) ON DELETE SET NULL,

    -- Plot info
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'introduced' CHECK (status IN (
        'introduced', 'developing', 'climax', 'resolved', 'abandoned'
    )),
    importance INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

    -- Connections
    related_npcs TEXT DEFAULT '[]',
    related_locations TEXT DEFAULT '[]',
    related_items TEXT DEFAULT '[]',
    parent_thread_id TEXT REFERENCES dmlog_plot_threads(id),

    -- Progress
    stages TEXT DEFAULT '[]',
    current_stage INTEGER DEFAULT 0,
    milestones TEXT DEFAULT '[]',

    -- Player knowledge
    player_visible INTEGER DEFAULT 1,
    player_notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_plot_campaign ON dmlog_plot_threads(campaign_id);
CREATE INDEX idx_plot_session ON dmlog_plot_threads(session_id);

-- Discoveries - Clues and secrets found
CREATE TABLE IF NOT EXISTS dmlog_discoveries (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    character_id TEXT REFERENCES dmlog_characters(id) ON DELETE SET NULL,

    -- Discovery info
    type TEXT CHECK (type IN ('clue', 'secret', 'revelation', 'location', 'item')),
    title TEXT NOT NULL,
    description TEXT,

    -- Importance
    importance INTEGER DEFAULT 5,
    is_public INTEGER DEFAULT 0,

    -- Related
    related_plot_thread TEXT REFERENCES dmlog_plot_threads(id),
    related_npc TEXT,
    related_location TEXT,

    discovered_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_discoveries_session ON dmlog_discoveries(session_id);

-- Relationships - NPC/Character relationships
CREATE TABLE IF NOT EXISTS dmlog_relationships (
    id TEXT PRIMARY KEY,
    campaign_id TEXT REFERENCES dmlog_campaigns(id) ON DELETE CASCADE,

    -- Parties
    character_id TEXT REFERENCES dmlog_characters(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL, -- Can be character, NPC name, or faction

    -- Relationship
    relationship_type TEXT DEFAULT 'neutral',
    attitude INTEGER DEFAULT 0 CHECK (attitude BETWEEN -100 AND 100),
    trust REAL DEFAULT 0.5 CHECK (trust BETWEEN 0 AND 1),
    debt INTEGER DEFAULT 0,

    -- History
    interaction_count INTEGER DEFAULT 0,
    last_interaction TEXT,
    notes TEXT,

    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(campaign_id, character_id, target_id)
);

CREATE INDEX idx_relationships_campaign ON dmlog_relationships(campaign_id);
CREATE INDEX idx_relationships_character ON dmlog_relationships(character_id);

-- Snapshots - Session save points
CREATE TABLE IF NOT EXISTS dmlog_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES students(id),

    -- Snapshot info
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,

    -- State
    round_number INTEGER,
    turn_number INTEGER,
    game_state TEXT NOT NULL,
    narrative_state TEXT NOT NULL,
    turn_state TEXT NOT NULL,

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_snapshots_session ON dmlog_snapshots(session_id);

-- Invites - Session invitations
CREATE TABLE IF NOT EXISTS dmlog_invites (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES students(id),

    -- Invite info
    code TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'player',
    max_uses INTEGER DEFAULT 1,
    uses_count INTEGER DEFAULT 0,

    -- Expiration
    expires_at TEXT,

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_invites_session ON dmlog_invites(session_id);
CREATE INDEX idx_invites_code ON dmlog_invites(code);

-- Chat Messages - In-session chat
CREATE TABLE IF NOT EXISTS dmlog_chat (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    sender_id TEXT REFERENCES students(id) ON DELETE SET NULL,
    character_id TEXT REFERENCES dmlog_characters(id) ON DELETE SET NULL,

    -- Message
    channel TEXT DEFAULT 'general', -- general, roleplay, ooc, dm
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'dice', 'emote', 'system')),

    -- Reactions
    reactions TEXT DEFAULT '[]',

    -- Timestamp
    sent_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_chat_session ON dmlog_chat(session_id, sent_at);

-- Session Analytics - Aggregated metrics
CREATE TABLE IF NOT EXISTS dmlog_analytics (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,

    -- Timing
    duration_seconds INTEGER,
    active_time_seconds INTEGER,
    pause_time_seconds INTEGER,

    -- Counts
    turns_completed INTEGER DEFAULT 0,
    rounds_completed INTEGER DEFAULT 0,
    scenes_completed INTEGER DEFAULT 0,
    combat_encounters INTEGER DEFAULT 0,

    -- Combat
    total_damage_dealt INTEGER DEFAULT 0,
    total_damage_taken INTEGER DEFAULT 0,
    total_healing INTEGER DEFAULT 0,
    tpk_count INTEGER DEFAULT 0,

    -- Narrative
    plot_threads_resolved INTEGER DEFAULT 0,
    discoveries_made INTEGER DEFAULT 0,

    -- Social
    chat_messages INTEGER DEFAULT 0,
    dice_rolls INTEGER DEFAULT 0,

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_analytics_session ON dmlog_analytics(session_id);

-- Character Session Stats - Per-character per-session stats
CREATE TABLE IF NOT EXISTS dmlog_character_stats (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES dmlog_characters(id) ON DELETE CASCADE,

    -- Combat
    damage_dealt INTEGER DEFAULT 0,
    damage_taken INTEGER DEFAULT 0,
    healing_done INTEGER DEFAULT 0,
    killing_blows INTEGER DEFAULT 0,

    -- Actions
    attacks INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    critical_hits INTEGER DEFAULT 0,
    critical_misses INTEGER DEFAULT 0,

    -- Saves
    saves_passed INTEGER DEFAULT 0,
    saves_failed INTEGER DEFAULT 0,
    death_saves_passed INTEGER DEFAULT 0,
    death_saves_failed INTEGER DEFAULT 0,

    -- Participation
    actions_taken INTEGER DEFAULT 0,
    dice_rolled INTEGER DEFAULT 0,
    chat_messages INTEGER DEFAULT 0,

    UNIQUE(session_id, character_id)
);

CREATE INDEX idx_charstats_session ON dmlog_character_stats(session_id);

-- Practice Sessions - AI practice specific data
CREATE TABLE IF NOT EXISTS dmlog_practice_data (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES dmlog_sessions(id) ON DELETE CASCADE,

    -- Scenario
    scenario_type TEXT CHECK (type IN ('combat', 'social', 'exploration', 'puzzle', 'mixed')),
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),

    -- AI Party
    ai_party_composition TEXT DEFAULT '[]',
    party_strategy TEXT DEFAULT '{}',

    -- Objectives
    objectives TEXT DEFAULT '[]',
    objectives_completed TEXT DEFAULT '[]',

    -- Feedback
    performance_score REAL,
    suggestions TEXT DEFAULT '[]',

    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_practice_session ON dmlog_practice_data(session_id);
```

---

## Implementation Examples

### 1. Session Creation and Management

```typescript
// backend/workers/dmlog-session-worker/src/session-manager.ts

import { Hono } from 'hono';
import { D1Database } from '@cloudflare/workers-d1';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Create a new DMLoG session
 */
app.post('/api/sessions', async (c) => {
  const db = c.env.DB;
  const auth = c.req.header('Authorization');
  const userId = await verifyToken(auth, c.env.JWT_SECRET);

  const body = await c.req.json();
  const sessionId = crypto.randomUUID();

  // Validate session type
  const validTypes = ['campaign', 'oneshot', 'practice', 'prep'];
  if (!validTypes.includes(body.type)) {
    return c.json({ error: 'Invalid session type' }, 400);
  }

  // Create session
  await db.prepare(`
    INSERT INTO dmlog_sessions (
      id, dm_id, type, phase, name, description,
      campaign_id, adventure_template, settings,
      visibility, max_players
    ) VALUES (?, ?, ?, 'created', ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    userId,
    body.type,
    body.name,
    body.description || null,
    body.campaignId || null,
    body.adventureTemplate || null,
    JSON.stringify(body.settings || {}),
    body.visibility || 'private',
    body.maxPlayers || 5
  ).run();

  // Create session state
  const sessionState = await initializeSessionState(body.type, body);

  await db.prepare(`
    UPDATE dmlog_sessions
    SET game_state = ?, narrative_state = ?, turn_state = ?
    WHERE id = ?
  `).bind(
    JSON.stringify(sessionState.gameState),
    JSON.stringify(sessionState.narrativeState),
    JSON.stringify(sessionState.turnState),
    sessionId
  ).run();

  return c.json({
    id: sessionId,
    ...body,
    phase: 'created',
    createdAt: new Date().toISOString(),
  }, 201);
});

/**
 * Initialize session state based on type
 */
async function initializeSessionState(type: string, config: any) {
  const baseState = {
    gameState: {
      positions: new Map(),
      initiativeOrder: [],
      currentTurn: 0,
      turnPhase: 'declare' as TurnPhase,
      hp: new Map(),
      conditions: new Map(),
      roundNumber: 0,
      timestamp: Date.now(),
    },
    narrativeState: {
      plotThreads: [],
      currentScene: null,
      sceneHistory: [],
      cluesFound: [],
      secretsRevealed: [],
      npcRelationships: new Map(),
      worldChanges: [],
      flags: new Map(),
      narrativeLog: [],
    },
    turnState: {
      roundNumber: 0,
      turnOrder: [],
      currentIndex: 0,
    },
  };

  switch (type) {
    case 'campaign':
      // Load campaign state
      return {
        ...baseState,
        narrativeState: {
          ...baseState.narrativeState,
          plotThreads: config.existingPlotThreads || [],
          worldState: config.worldState || {},
        },
      };

    case 'practice':
      // Initialize AI party
      return {
        ...baseState,
        gameState: {
          ...baseState.gameState,
          aiParty: config.aiParty || generateDefaultParty(),
        },
      };

    case 'oneshot':
      // Setup one-shot specific state
      return {
        ...baseState,
        narrativeState: {
          ...baseState.narrativeState,
          sceneBreaks: config.sceneBreaks || [],
        },
      };

    default:
      return baseState;
  }
}

/**
 * Start a session (transition from SETUP to ACTIVE)
 */
app.post('/api/sessions/:id/start', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const userId = await verifyToken(c.req.header('Authorization'), c.env.JWT_SECRET);

  // Verify ownership
  const session = await db.prepare(`
    SELECT * FROM dmlog_sessions WHERE id = ? AND dm_id = ?
  `).bind(sessionId, userId).first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Update phase
  await db.prepare(`
    UPDATE dmlog_sessions
    SET phase = 'active', started_at = datetime('now')
    WHERE id = ?
  `).bind(sessionId).run();

  // Initialize first turn
  const turnState = JSON.parse(session.turn_state as string);
  turnState.roundNumber = 1;

  await db.prepare(`
    UPDATE dmlog_sessions
    SET turn_state = ?
    WHERE id = ?
  `).bind(JSON.stringify(turnState), sessionId).run();

  return c.json({
    sessionId,
    phase: 'active',
    startedAt: new Date().toISOString(),
    roundNumber: 1,
  });
});

/**
 * Pause a session
 */
app.post('/api/sessions/:id/pause', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const userId = await verifyToken(c.req.header('Authorization'), c.env.JWT_SECRET);

  // Verify DM status
  const session = await db.prepare(`
    SELECT * FROM dmlog_sessions WHERE id = ? AND dm_id = ?
  `).bind(sessionId, userId).first();

  if (!session || session.phase !== 'active') {
    return c.json({ error: 'Cannot pause session' }, 400);
  }

  // Create auto-save snapshot
  const snapshotId = crypto.randomUUID();
  const state = {
    gameState: JSON.parse(session.game_state as string),
    narrativeState: JSON.parse(session.narrative_state as string),
    turnState: JSON.parse(session.turn_state as string),
  };

  await db.prepare(`
    INSERT INTO dmlog_snapshots (
      id, session_id, created_by, name, description,
      round_number, game_state, narrative_state, turn_state
    ) VALUES (?, ?, ?, 'Auto-save', 'Created when pausing session', ?, ?, ?, ?)
  `).bind(
    snapshotId,
    sessionId,
    userId,
    state.turnState.roundNumber,
    JSON.stringify(state.gameState),
    JSON.stringify(state.narrativeState),
    JSON.stringify(state.turnState)
  ).run();

  // Update phase
  await db.prepare(`
    UPDATE dmlog_sessions
    SET phase = 'paused', paused_at = datetime('now')
    WHERE id = ?
  `).bind(sessionId).run();

  return c.json({
    sessionId,
    phase: 'paused',
    pausedAt: new Date().toISOString(),
    snapshotId,
  });
});

/**
 * Resume a paused session
 */
app.post('/api/sessions/:id/resume', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const userId = await verifyToken(c.req.header('Authorization'), c.env.JWT_SECRET);

  const session = await db.prepare(`
    SELECT * FROM dmlog_sessions WHERE id = ? AND dm_id = ?
  `).bind(sessionId, userId).first();

  if (!session || session.phase !== 'paused') {
    return c.json({ error: 'Cannot resume session' }, 400);
  }

  await db.prepare(`
    UPDATE dmlog_sessions
    SET phase = 'active'
    WHERE id = ?
  `).bind(sessionId).run();

  return c.json({
    sessionId,
    phase: 'active',
    resumedAt: new Date().toISOString(),
  });
});

/**
 * End a session
 */
app.post('/api/sessions/:id/end', async (c) => {
  const db = c.env.DB;
  const sessionId = c.req.param('id');
  const userId = await verifyToken(c.req.header('Authorization'), c.env.JWT_SECRET);

  const session = await db.prepare(`
    SELECT * FROM dmlog_sessions WHERE id = ? AND dm_id = ?
  `).bind(sessionId, userId).first();

  if (!session || session.phase !== 'active') {
    return c.json({ error: 'Cannot end session' }, 400);
  }

  // Calculate final analytics
  const analytics = await calculateSessionAnalytics(db, sessionId);

  // Store analytics
  await db.prepare(`
    INSERT INTO dmlog_analytics (
      id, session_id, duration_seconds, active_time_seconds,
      turns_completed, rounds_completed, scenes_completed,
      combat_encounters, total_damage_dealt, total_damage_taken,
      total_healing, plot_threads_resolved, discoveries_made,
      chat_messages, dice_rolls
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    sessionId,
    analytics.durationSeconds,
    analytics.activeTimeSeconds,
    analytics.turnsCompleted,
    analytics.roundsCompleted,
    analytics.scenesCompleted,
    analytics.combatEncounters,
    analytics.totalDamageDealt,
    analytics.totalDamageTaken,
    analytics.totalHealing,
    analytics.plotThreadsResolved,
    analytics.discoveriesMade,
    analytics.chatMessages,
    analytics.diceRolls
  ).run();

  // Update session
  await db.prepare(`
    UPDATE dmlog_sessions
    SET phase = 'complete', ended_at = datetime('now')
    WHERE id = ?
  `).bind(sessionId).run();

  // If campaign session, update campaign progress
  if (session.type === 'campaign' && session.campaign_id) {
    await db.prepare(`
      UPDATE dmlog_campaigns
      SET current_session_number = current_session_number + 1,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(session.campaign_id).run();
  }

  return c.json({
    sessionId,
    phase: 'complete',
    endedAt: new Date().toISOString(),
    analytics,
  });
});

/**
 * Calculate session analytics from action log
 */
async function calculateSessionAnalytics(db: D1Database, sessionId: string) {
  const actions = await db.prepare(`
    SELECT
      COUNT(*) as actions,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN critical = 1 THEN 1 ELSE 0 END) as crits,
      SUM(CASE WHEN fumble = 1 THEN 1 ELSE 0 END) as fumbles
    FROM dmlog_actions
    WHERE session_id = ?
  `).bind(sessionId).first();

  const rounds = await db.prepare(`
    SELECT MAX(round_number) as max_round
    FROM dmlog_actions
    WHERE session_id = ?
  `).bind(sessionId).first();

  const chat = await db.prepare(`
    SELECT COUNT(*) as count
    FROM dmlog_chat
    WHERE session_id = ?
  `).bind(sessionId).first();

  const discoveries = await db.prepare(`
    SELECT COUNT(*) as count
    FROM dmlog_discoveries
    WHERE session_id = ?
  `).bind(sessionId).first();

  return {
    durationSeconds: 0, // Calculated from started_at/ended_at
    activeTimeSeconds: 0, // Track actual play time
    turnsCompleted: actions?.actions || 0,
    roundsCompleted: rounds?.max_round || 0,
    scenesCompleted: 0,
    combatEncounters: 0,
    totalDamageDealt: 0,
    totalDamageTaken: 0,
    totalHealing: 0,
    plotThreadsResolved: 0,
    discoveriesMade: discoveries?.count || 0,
    chatMessages: chat?.count || 0,
    diceRolls: 0,
  };
}

export default app;
```

### 2. State Persistence System

```typescript
// backend/workers/dmlog-session-worker/src/state-manager.ts

import { D1Database } from '@cloudflare/workers-d1';

interface StateSnapshot {
  id: string;
  sessionId: string;
  createdAt: number;
  createdBy: string;
  name: string;
  description?: string;
  gameState: any;
  narrativeState: any;
  turnState: any;
  roundNumber: number;
  thumbnailUrl?: string;
}

export class StateManager {
  constructor(private db: D1Database) {}

  /**
   * Create a snapshot of the current session state
   */
  async createSnapshot(
    sessionId: string,
    userId: string,
    name: string,
    description?: string
  ): Promise<StateSnapshot> {
    // Get current session state
    const session = await this.db.prepare(`
      SELECT game_state, narrative_state, turn_state
      FROM dmlog_sessions
      WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      throw new Error('Session not found');
    }

    const turnState = JSON.parse(session.turn_state as string);
    const snapshotId = crypto.randomUUID();

    // Store snapshot
    await this.db.prepare(`
      INSERT INTO dmlog_snapshots (
        id, session_id, created_by, name, description,
        round_number, game_state, narrative_state, turn_state
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      snapshotId,
      sessionId,
      userId,
      name,
      description || null,
      turnState.roundNumber,
      session.game_state,
      session.narrative_state,
      session.turn_state
    ).run();

    return {
      id: snapshotId,
      sessionId,
      createdAt: Date.now(),
      createdBy: userId,
      name,
      description,
      gameState: JSON.parse(session.game_state as string),
      narrativeState: JSON.parse(session.narrative_state as string),
      turnState: JSON.parse(session.turn_state as string),
      roundNumber: turnState.roundNumber,
    };
  }

  /**
   * Load a snapshot and restore session state
   */
  async loadSnapshot(snapshotId: string, userId: string): Promise<void> {
    const snapshot = await this.db.prepare(`
      SELECT s.*, sess.dm_id
      FROM dmlog_snapshots s
      JOIN dmlog_sessions sess ON s.session_id = sess.id
      WHERE s.id = ?
    `).bind(snapshotId).first();

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    if (snapshot.dm_id !== userId) {
      throw new Error('Not authorized to restore this snapshot');
    }

    // Restore session state
    await this.db.prepare(`
      UPDATE dmlog_sessions
      SET game_state = ?, narrative_state = ?, turn_state = ?
      WHERE id = ?
    `).bind(
      snapshot.game_state,
      snapshot.narrative_state,
      snapshot.turn_state,
      snapshot.session_id
    ).run();
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string, userId: string): Promise<void> {
    const snapshot = await this.db.prepare(`
      SELECT s.*, sess.dm_id
      FROM dmlog_snapshots s
      JOIN dmlog_sessions sess ON s.session_id = sess.id
      WHERE s.id = ?
    `).bind(snapshotId).first();

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    if (snapshot.dm_id !== userId) {
      throw new Error('Not authorized to delete this snapshot');
    }

    await this.db.prepare(`
      DELETE FROM dmlog_snapshots WHERE id = ?
    `).bind(snapshotId).run();
  }

  /**
   * Enable auto-save for a session
   */
  async enableAutoSave(sessionId: string, interval: number = 300): Promise<void> {
    await this.db.prepare(`
      UPDATE dmlog_sessions
      SET auto_save_enabled = 1, auto_save_interval = ?
      WHERE id = ?
    `).bind(interval, sessionId).run();
  }

  /**
   * Disable auto-save for a session
   */
  async disableAutoSave(sessionId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE dmlog_sessions
      SET auto_save_enabled = 0
      WHERE id = ?
    `).bind(sessionId).run();
  }

  /**
   * Compare two states and return differences
   */
  compareStates(before: any, after: any): StateDiff {
    const diff: StateDiff = {
      changes: [],
      timestamp: Date.now(),
    };

    // Compare game state
    this.compareObjects(before.gameState, after.gameState, 'gameState', diff);

    // Compare narrative state
    this.compareObjects(before.narrativeState, after.narrativeState, 'narrativeState', diff);

    return diff;
  }

  private compareObjects(
    before: any,
    after: any,
    path: string,
    diff: StateDiff
  ): void {
    const beforeKeys = new Set(Object.keys(before));
    const afterKeys = new Set(Object.keys(after));

    // Added keys
    for (const key of afterKeys) {
      if (!beforeKeys.has(key)) {
        diff.changes.push({
          type: 'added',
          path: `${path}.${key}`,
          value: after[key],
        });
      }
    }

    // Removed keys
    for (const key of beforeKeys) {
      if (!afterKeys.has(key)) {
        diff.changes.push({
          type: 'removed',
          path: `${path}.${key}`,
          value: before[key],
        });
      }
    }

    // Changed keys
    for (const key of beforeKeys) {
      if (afterKeys.has(key)) {
        const beforeVal = before[key];
        const afterVal = after[key];

        if (typeof beforeVal === 'object' && typeof afterVal === 'object') {
          this.compareObjects(beforeVal, afterVal, `${path}.${key}`, diff);
        } else if (beforeVal !== afterVal) {
          diff.changes.push({
            type: 'changed',
            path: `${path}.${key}`,
            from: beforeVal,
            to: afterVal,
          });
        }
      }
    }
  }

  /**
   * Apply a diff to a state
   */
  applyDiff(state: any, diff: StateDiff): any {
    const result = JSON.parse(JSON.stringify(state));

    for (const change of diff.changes) {
      const pathParts = change.path.split('.');
      let current = result;

      for (let i = 0; i < pathParts.length - 1; i++) {
        current = current[pathParts[i]];
      }

      const lastKey = pathParts[pathParts.length - 1];

      switch (change.type) {
        case 'added':
        case 'changed':
          current[lastKey] = change.value;
          break;
        case 'removed':
          delete current[lastKey];
          break;
      }
    }

    return result;
  }
}

interface StateDiff {
  changes: StateChange[];
  timestamp: number;
}

interface StateChange {
  type: 'added' | 'removed' | 'changed';
  path: string;
  value?: any;
  from?: any;
  to?: any;
}
```

### 3. WebSocket Handler

```typescript
// backend/workers/dmlog-session-worker/src/websocket-handler.ts

import { WebSocket } from 'partysocket';

interface WSMessage {
  type: string;
  sessionId: string;
  timestamp: number;
  id: string;
  correlationId?: string;
  payload: any;
}

export class DMLoGWebSocketHandler {
  private connections = new Map<string, WebSocket>();
  private sessionPlayers = new Map<string, Set<string>>();

  constructor(private env: any) {}

  /**
   * Handle incoming WebSocket connection
   */
  async handleWebSocket(ws: WebSocket, sessionId: string, userId: string, token: string): Promise<void> {
    // Verify token
    const valid = await this.verifyToken(token);
    if (!valid) {
      ws.close(1008, 'Invalid token');
      return;
    }

    // Store connection
    const connectionId = `${sessionId}:${userId}`;
    this.connections.set(connectionId, ws);

    // Add to session players
    if (!this.sessionPlayers.has(sessionId)) {
      this.sessionPlayers.set(sessionId, new Set());
    }
    this.sessionPlayers.get(sessionId)!.add(userId);

    // Send connection confirmation
    this.sendToUser(ws, {
      type: 'connected',
      sessionId,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      payload: {
        userId,
        serverTime: Date.now(),
      },
    });

    // Set up message handler
    ws.addEventListener('message', async (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data as string);
        await this.handleMessage(message, ws, userId);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle disconnect
    ws.addEventListener('close', () => {
      this.handleDisconnect(sessionId, userId);
    });

    // Start heartbeat
    this.startHeartbeat(ws, sessionId, userId);
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    message: WSMessage,
    ws: WebSocket,
    userId: string
  ): Promise<void> {
    switch (message.type) {
      case 'heartbeat':
        this.handleHeartbeat(message, ws);
        break;

      case 'action_declare':
        await this.handleActionDeclare(message, userId);
        break;

      case 'chat_message':
        await this.handleChatMessage(message, userId);
        break;

      case 'dice_roll':
        await this.handleDiceRoll(message, userId);
        break;

      default:
        // Broadcast unknown message types to all players
        this.broadcastToSession(message.sessionId, message);
    }
  }

  /**
   * Handle heartbeat messages
   */
  private handleHeartbeat(message: WSMessage, ws: WebSocket): void {
    this.sendToUser(ws, {
      type: 'heartbeat_ack',
      sessionId: message.sessionId,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      payload: {
        serverTime: Date.now(),
      },
    });
  }

  /**
   * Handle action declaration
   */
  private async handleActionDeclare(message: WSMessage, userId: string): Promise<void> {
    const { sessionId, payload } = message;

    // Validate action
    const validation = await this.validateAction(sessionId, userId, payload);

    if (validation.valid) {
      // Store action for resolution
      await this.storeAction(sessionId, userId, payload);

      // Broadcast to all players
      this.broadcastToSession(sessionId, {
        type: 'action_declared',
        sessionId,
        timestamp: Date.now(),
        id: message.id,
        payload: {
          entityId: payload.entityId,
          action: payload.action,
        },
      });
    } else {
      // Send error back to declarer
      const connectionId = `${sessionId}:${userId}`;
      const ws = this.connections.get(connectionId);
      if (ws) {
        this.sendToUser(ws, {
          type: 'action_validation',
          sessionId,
          timestamp: Date.now(),
          id: crypto.randomUUID(),
          correlationId: message.id,
          payload: {
            valid: false,
            errors: validation.errors,
          },
        });
      }
    }
  }

  /**
   * Handle chat messages
   */
  private async handleChatMessage(message: WSMessage, userId: string): Promise<void> {
    const { sessionId, payload } = message;

    // Store in database
    await this.env.DB.prepare(`
      INSERT INTO dmlog_chat (id, session_id, sender_id, channel, content, type, sent_at)
      VALUES (?, ?, ?, ?, ?, 'text', datetime('now'))
    `).bind(
      crypto.randomUUID(),
      sessionId,
      userId,
      payload.channel || 'general',
      payload.content
    ).run();

    // Broadcast to all players
    this.broadcastToSession(sessionId, message);
  }

  /**
   * Handle dice rolls
   */
  private async handleDiceRoll(message: WSMessage, userId: string): Promise<void> {
    const { sessionId, payload } = message;

    // Roll dice
    const result = this.rollDice(payload.formula);

    // Create response
    const response: WSMessage = {
      type: 'dice_roll',
      sessionId,
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      correlationId: message.id,
      payload: {
        formula: payload.formula,
        result: result.total,
        rolls: result.rolls,
        userId,
        characterId: payload.characterId,
      },
    };

    // Broadcast to all players
    this.broadcastToSession(sessionId, response);
  }

  /**
   * Broadcast message to all players in a session
   */
  private broadcastToSession(sessionId: string, message: WSMessage): void {
    const players = this.sessionPlayers.get(sessionId);
    if (!players) return;

    for (const playerId of players) {
      const connectionId = `${sessionId}:${playerId}`;
      const ws = this.connections.get(connectionId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.sendToUser(ws, message);
      }
    }
  }

  /**
   * Send message to specific user
   */
  private sendToUser(ws: WebSocket, message: WSMessage): void {
    ws.send(JSON.stringify(message));
  }

  /**
   * Send error message
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendToUser(ws, {
      type: 'error',
      sessionId: '',
      timestamp: Date.now(),
      id: crypto.randomUUID(),
      payload: { error },
    });
  }

  /**
   * Handle disconnect
   */
  private handleDisconnect(sessionId: string, userId: string): void {
    const connectionId = `${sessionId}:${userId}`;
    this.connections.delete(connectionId);

    const players = this.sessionPlayers.get(sessionId);
    if (players) {
      players.delete(userId);

      // Notify other players
      this.broadcastToSession(sessionId, {
        type: 'player_leave',
        sessionId,
        timestamp: Date.now(),
        id: crypto.randomUUID(),
        payload: { userId },
      });
    }
  }

  /**
   * Start heartbeat for connection
   */
  private startHeartbeat(ws: WebSocket, sessionId: string, userId: string): void {
    const interval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

      // Send heartbeat request
      this.sendToUser(ws, {
        type: 'heartbeat',
        sessionId,
        timestamp: Date.now(),
        id: crypto.randomUUID(),
        payload: {},
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Roll dice from formula
   */
  private rollDice(formula: string): { total: number; rolls: number[] } {
    // Parse dice formula (e.g., "2d6+3", "1d20", "4d6kh3")
    const diceMatch = formula.match(/(\d+)d(\d+)(kh(\d+))?(k l(\d+))?([+-]\d+)?/i);

    if (!diceMatch) {
      return { total: 0, rolls: [] };
    }

    const count = parseInt(diceMatch[1]);
    const sides = parseInt(diceMatch[2]);
    const keepHighest = diceMatch[4] ? parseInt(diceMatch[4]) : count;
    const modifier = diceMatch[7] ? parseInt(diceMatch[7]) : 0;

    const rolls: number[] = [];
    for (let i = 0; i < count; i++) {
      rolls.push(Math.floor(Math.random() * sides) + 1);
    }

    // Sort and keep highest/lowest
    const sorted = [...rolls].sort((a, b) => b - a);
    const kept = sorted.slice(0, keepHighest);
    const total = kept.reduce((sum, val) => sum + val, 0) + modifier;

    return { total, rolls };
  }

  /**
   * Validate action declaration
   */
  private async validateAction(
    sessionId: string,
    userId: string,
    payload: any
  ): Promise<{ valid: boolean; errors?: string[] }> {
    // Load session state
    const session = await this.env.DB.prepare(`
      SELECT game_state, turn_state FROM dmlog_sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return { valid: false, errors: ['Session not found'] };
    }

    const gameState = JSON.parse(session.game_state as string);
    const turnState = JSON.parse(session.turn_state as string);

    // Check if it's the character's turn
    const currentTurn = turnState.turnOrder[turnState.currentIndex];
    if (currentTurn.entityId !== payload.entityId) {
      return { valid: false, errors: ['Not your turn'] };
    }

    // Validate action based on type
    const errors: string[] = [];

    switch (payload.action.type) {
      case 'attack':
        if (!payload.action.target) {
          errors.push('Attack requires a target');
        }
        break;

      case 'cast':
        if (!payload.action.spell) {
          errors.push('Cast requires a spell');
        }
        // Check spell slots
        break;

      case 'move':
        if (!payload.action.destination) {
          errors.push('Move requires a destination');
        }
        break;
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * Store action for resolution
   */
  private async storeAction(sessionId: string, userId: string, payload: any): Promise<void> {
    await this.env.DB.prepare(`
      INSERT INTO dmlog_actions (
        id, session_id, round_number, turn_number, actor_id, actor_name,
        action_type, action_data, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      sessionId,
      payload.roundNumber,
      payload.turnNumber,
      payload.entityId,
      payload.entityName,
      payload.action.type,
      JSON.stringify(payload.action)
    ).run();
  }

  /**
   * Verify JWT token
   */
  private async verifyToken(token: string): Promise<boolean> {
    try {
      // JWT verification logic here
      return true;
    } catch {
      return false;
    }
  }
}
```

---

## Integration Points

### 1. Character SDK Integration

```typescript
import { CharacterFactory } from '@studylog/characters';

// Create AI party members for practice sessions
export function createAIParty(composition: PartyComposition): AIPartyMember[] {
  const members: AIPartyMember[] = [];

  for (const config of composition) {
    const character = CharacterFactory.createPreconfig(
      config.role,
      config.level,
      config.personality
    );

    members.push({
      id: crypto.randomUUID(),
      name: character.name,
      characterClass: character.role,
      level: config.level,
      personality: character.personality,
      playstyle: derivePlaystyle(character.personality),
      autonomy: config.autonomy || 0.7,
    });
  }

  return members;
}

function derivePlaystyle(personality: Personality): AggressionProfile {
  return {
    aggression: personality.extraversion * 0.6 + personality.neuroticism * 0.4,
    caution: 1 - personality.openness * 0.5,
    teamwork: personality.agreeableness,
    leadership: personality.extraversion * 0.7 + personality.conscientiousness * 0.3,
  };
}
```

### 2. Memory System Integration

```typescript
import { HierarchicalMemory } from '@studylog/memory';

// Store session events in character memory
export async function consolidateSessionMemories(
  sessionId: string,
  characterId: string,
  events: SessionEvent[]
): Promise<void> {
  const memory = new HierarchicalMemory(characterId);

  for (const event of events) {
    switch (event.type) {
      case 'combat':
        memory.store_episodic(
          `Participated in combat: ${event.description}`,
          {
            importance: event.importance,
            emotional_valence: event.outcome === 'victory' ? 0.6 : -0.3,
            participants: event.allies,
            context: { combat: true, outcome: event.outcome }
          }
        );
        break;

      case 'social':
        memory.store_episodic(
          `Social interaction with ${event.npc}: ${event.description}`,
          {
            importance: event.importance,
            emotional_valence: event.sentiment,
            participants: [event.npc],
            context: { social: true }
          }
        );

        // Update relationship memory
        memory.store_semantic(
          `Relationship with ${event.npc}: ${event.relationshipChange}`,
          { importance: event.importance * 0.8 }
        );
        break;

      case 'discovery':
        memory.store_semantic(
          `Learned: ${event.discovery}`,
          { importance: event.importance }
        );
        break;
    }
  }

  // Trigger consolidation
  await memory.consolidate();
}
```

### 3. Godot Visualization Integration

```typescript
// Send session state to Godot for visualization
export class GodotSessionBridge {
  private ws: WebSocket;

  constructor(private sessionId: string) {
    this.ws = new WebSocket('ws://localhost:8080');
  }

  // Sync turn order to Godot
  syncTurnOrder(turnOrder: InitiativeEntry[]): void {
    this.ws.send(JSON.stringify({
      type: 'turn_order_sync',
      sessionId: this.sessionId,
      payload: {
        entries: turnOrder.map(entry => ({
          entityId: entry.entityId,
          name: entry.entityName,
          type: entry.entityType,
          initiative: entry.initiative_value,
        })),
      },
    }));
  }

  // Sync positions to Godot
  syncPositions(positions: Map<string, Position>): void {
    this.ws.send(JSON.stringify({
      type: 'position_sync',
      sessionId: this.sessionId,
      payload: {
        entities: Array.from(positions.entries()).map(([id, pos]) => ({
          id,
          x: pos.x,
          y: pos.y,
          z: pos.z || 0,
          facing: pos.facing,
        })),
      },
    }));
  }

  // Trigger animation
  triggerAnimation(entityId: string, animation: string): void {
    this.ws.send(JSON.stringify({
      type: 'animation_trigger',
      sessionId: this.sessionId,
      payload: { entityId, animation },
    }));
  }
}
```

---

## Summary

The DMLoG Session Management System provides:

1. **Flexible Session Types** - Campaign, one-shot, practice, and prep sessions
2. **Complete Lifecycle** - From creation through archive
3. **Rich State Tracking** - Game, narrative, and progress states
4. **Real-Time Multiplayer** - WebSocket-based synchronization
5. **Comprehensive Analytics** - Combat, participation, and story engagement metrics
6. **Product-Agnostic Design** - Patterns applicable across StudyLoG.AI products

### Implementation Phases

| Phase | Components | Duration |
|-------|------------|----------|
| Phase 1 | Core session CRUD, state persistence | 1 week |
| Phase 2 | Turn management, action resolution | 1 week |
| Phase 3 | WebSocket real-time sync | 1 week |
| Phase 4 | Analytics and metrics | 3 days |
| Phase 5 | Practice session AI integration | 1 week |

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Ready for Implementation

**Remember:** Every layer is a mill. Every agent is a millwright. Every user graduates to building mills.
