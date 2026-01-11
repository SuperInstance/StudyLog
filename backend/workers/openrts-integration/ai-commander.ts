/**
 * AI Commander
 *
 * AI opponent logic for OpenRTS skirmish games.
 *
 * ## Features
 *
 * - Multiple difficulty levels
 * - Different personalities (aggressive, defensive, economic)
 * - Strategic decision making
 * - Tactical combat control
 * - Resource management
 * - Build order execution
 * - Attack coordination
 * - Defense planning
 * - Cloud AI offloading support
 */

import type {
  Vector3,
  UnitInstance,
  StructureInstance,
  PlayerState,
  AIDifficulty,
  AIPersonality,
  AIState,
  AIStrategy,
  ThreatAssessment,
  OpportunityTarget,
  ResourcePriority,
  BuildOrder,
  AttackPlan,
  DefensePlan,
  BuildTrigger,
  UnitDefinition,
} from './types.js';

// ============================================================================
// Configuration Types
// ============================================================================

export interface AICommanderConfig {
  /** Difficulty level */
  difficulty: AIDifficulty;

  /** Personality type */
  personality: AIPersonality;

  /** Update interval (ms) */
  updateInterval: number;

  /** Reaction time multiplier (1 = normal, >1 = slower) */
  reactionTime: number;

  /** APM (actions per minute) cap */
  apmCap: number;

  /** Use cloud AI for decisions */
  useCloudAI: boolean;

  /** Cloud AI endpoint */
  cloudEndpoint?: string;

  /** Player ID this AI controls */
  playerId: string;

  /** Team ID */
  teamId: number;
}

export const DEFAULT_AI_CONFIG: AICommanderConfig = {
  difficulty: 'medium',
  personality: 'balanced',
  updateInterval: 500,
  reactionTime: 1.0,
  apmCap: 100,
  useCloudAI: false,
  playerId: 'ai_player',
  teamId: 1,
};

// ============================================================================
// Difficulty Presets
// ============================================================================

export interface DifficultyPreset {
  /** Resource gathering rate multiplier */
  resourceMultiplier: number;

  /** Build speed multiplier */
  buildSpeedMultiplier: number;

  /** Unit stat multiplier */
  unitStatMultiplier: number;

  /** Strategic thinking depth */
  strategicDepth: number;

  /** Reaction speed */
  reactionSpeed: number;

  /** Error rate (0-1) */
  errorRate: number;

  /** APM cap */
  apmCap: number;
}

export const DIFFICULTY_PRESETS: Record<AIDifficulty, DifficultyPreset> = {
  easy: {
    resourceMultiplier: 0.8,
    buildSpeedMultiplier: 0.9,
    unitStatMultiplier: 0.85,
    strategicDepth: 1,
    reactionSpeed: 1.5,
    errorRate: 0.2,
    apmCap: 30,
  },
  medium: {
    resourceMultiplier: 1.0,
    buildSpeedMultiplier: 1.0,
    unitStatMultiplier: 1.0,
    strategicDepth: 2,
    reactionSpeed: 1.0,
    errorRate: 0.1,
    apmCap: 60,
  },
  hard: {
    resourceMultiplier: 1.2,
    buildSpeedMultiplier: 1.1,
    unitStatMultiplier: 1.1,
    strategicDepth: 3,
    reactionSpeed: 0.8,
    errorRate: 0.05,
    apmCap: 120,
  },
  expert: {
    resourceMultiplier: 1.3,
    buildSpeedMultiplier: 1.15,
    unitStatMultiplier: 1.15,
    strategicDepth: 4,
    reactionSpeed: 0.6,
    errorRate: 0.02,
    apmCap: 200,
  },
  insane: {
    resourceMultiplier: 1.5,
    buildSpeedMultiplier: 1.25,
    unitStatMultiplier: 1.25,
    strategicDepth: 5,
    reactionSpeed: 0.4,
    errorRate: 0.0,
    apmCap: 300,
  },
};

// ============================================================================
// Personality Presets
// ============================================================================

export interface PersonalityPreset {
  /** Base strategy */
  strategy: AIStrategy;

  /** Resource priority weights */
  resourcePriority: ResourcePriority;

  /** Build order preferences */
  buildPreferences: Record<string, number>;

  /** Unit composition preferences */
  unitPreferences: Record<string, number>;

  /** Expansion timing */
  expandTiming: number;

  /** Aggression level (0-1) */
  aggression: number;
}

export const PERSONALITY_PRESETS: Record<AIPersonality, PersonalityPreset> = {
  balanced: {
    strategy: {
      type: 'boom',
      aggressiveness: 0.5,
      expandTiming: 180,
      techFocus: 'balanced',
      unitPreference: {
        infantry: 0.4,
        vehicle: 0.3,
        aircraft: 0.2,
        defense: 0.1,
      },
    },
    resourcePriority: {
      military: 0.4,
      economic: 0.35,
      technology: 0.15,
      expansion: 0.1,
    },
    buildPreferences: {
      barracks: 1.0,
      factory: 1.0,
      refinery: 0.8,
      turret: 0.5,
    },
    unitPreferences: {
      rifleman: 1.0,
      tank: 1.0,
      helicopter: 0.8,
    },
    expandTiming: 180,
    aggression: 0.5,
  },
  aggressive: {
    strategy: {
      type: 'rush',
      aggressiveness: 0.9,
      expandTiming: 300,
      techFocus: 'military',
      unitPreference: {
        infantry: 0.6,
        vehicle: 0.3,
        aircraft: 0.1,
        defense: 0.0,
      },
    },
    resourcePriority: {
      military: 0.7,
      economic: 0.15,
      technology: 0.1,
      expansion: 0.05,
    },
    buildPreferences: {
      barracks: 1.5,
      factory: 1.2,
      refinery: 0.5,
      turret: 0.2,
    },
    unitPreferences: {
      rifleman: 1.5,
      tank: 1.2,
      helicopter: 0.5,
    },
    expandTiming: 300,
    aggression: 0.9,
  },
  defensive: {
    strategy: {
      type: 'turtle',
      aggressiveness: 0.2,
      expandTiming: 120,
      techFocus: 'economic',
      unitPreference: {
        infantry: 0.3,
        vehicle: 0.2,
        aircraft: 0.1,
        defense: 0.4,
      },
    },
    resourcePriority: {
      military: 0.25,
      economic: 0.45,
      technology: 0.2,
      expansion: 0.1,
    },
    buildPreferences: {
      barracks: 0.7,
      factory: 0.5,
      refinery: 1.2,
      turret: 1.5,
    },
    unitPreferences: {
      rifleman: 0.8,
      tank: 0.5,
      helicopter: 0.3,
    },
    expandTiming: 120,
    aggression: 0.2,
  },
  economic: {
    strategy: {
      type: 'boom',
      aggressiveness: 0.3,
      expandTiming: 90,
      techFocus: 'economic',
      unitPreference: {
        infantry: 0.2,
        vehicle: 0.2,
        aircraft: 0.1,
        defense: 0.2,
      },
    },
    resourcePriority: {
      military: 0.15,
      economic: 0.6,
      technology: 0.15,
      expansion: 0.1,
    },
    buildPreferences: {
      barracks: 0.5,
      factory: 0.5,
      refinery: 1.5,
      turret: 0.8,
    },
    unitPreferences: {
      rifleman: 0.5,
      tank: 0.5,
      helicopter: 0.3,
    },
    expandTiming: 90,
    aggression: 0.3,
  },
  rusher: {
    strategy: {
      type: 'rush',
      aggressiveness: 1.0,
      expandTiming: 600,
      techFocus: 'military',
      unitPreference: {
        infantry: 0.8,
        vehicle: 0.1,
        aircraft: 0.0,
        defense: 0.1,
      },
    },
    resourcePriority: {
      military: 0.85,
      economic: 0.1,
      technology: 0.0,
      expansion: 0.05,
    },
    buildPreferences: {
      barracks: 2.0,
      factory: 0.3,
      refinery: 0.3,
      turret: 0.1,
    },
    unitPreferences: {
      rifleman: 2.0,
      tank: 0.3,
      helicopter: 0.0,
    },
    expandTiming: 600,
    aggression: 1.0,
  },
};

// ============================================================================
// AI Commander Class
// ============================================================================

/**
 * AI Commander for controlling opponent in skirmish games
 */
export class AICommander {
  private state: AIState;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private actionQueue: AIAction[] = [];
  private lastUpdateTime: number = 0;
  private actionsThisMinute: number = 0;
  private apmResetTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private config: AICommanderConfig = DEFAULT_AI_CONFIG
  ) {
    const difficulty = DIFFICULTY_PRESETS[config.difficulty];
    const personality = PERSONALITY_PRESETS[config.personality];

    this.state = {
      phase: 'early',
      strategy: { ...personality.strategy },
      threats: this.createInitialThreatAssessment(),
      opportunities: [],
      priorities: { ...personality.resourcePriority },
      buildQueue: [],
      attackPlans: [],
      defensePlans: [],
    };

    this.setupInitialBuildQueue(personality);
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start AI commander
   */
  start(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    this.updateState(gameState);

    this.updateTimer = setInterval(() => {
      this.update(gameState);
    }, this.config.updateInterval);

    this.apmResetTimer = setInterval(() => {
      this.actionsThisMinute = 0;
    }, 60000);
  }

  /**
   * Stop AI commander
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    if (this.apmResetTimer) {
      clearInterval(this.apmResetTimer);
      this.apmResetTimer = null;
    }
  }

  // ========================================================================
  // Main Update Loop
  // ========================================================================

  /**
   * Main AI update loop
   */
  private update(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    const now = Date.now();

    // Check APM cap
    if (this.actionsThisMinute >= this.config.apmCap) {
      return;
    }

    // Update state
    this.updateState(gameState);

    // Execute pending actions
    this.executeActions(gameState);

    // Make decisions
    this.makeDecisions(gameState);

    this.lastUpdateTime = now;
  }

  /**
   * Update AI state from game state
   */
  private updateState(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Update phase
    const player = gameState.players.get(this.config.playerId);
    if (player) {
      const gameTime = 0; // Would get from actual game time
      this.state.phase = this.determinePhase(gameTime);
    }

    // Update threats
    this.updateThreats(gameState);

    // Update opportunities
    this.updateOpportunities(gameState);

    // Update build queue
    this.updateBuildQueue(gameState);
  }

  // ========================================================================
  // Decision Making
  // ========================================================================

  /**
   * Make AI decisions
   */
  private makeDecisions(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Use cloud AI if enabled
    if (this.config.useCloudAI && this.config.cloudEndpoint) {
      this.makeCloudDecision(gameState);
      return;
    }

    // Local decision making
    this.makeLocalDecision(gameState);
  }

  /**
   * Make decision using cloud AI
   */
  private async makeCloudDecision(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): Promise<void> {
    try {
      const response = await fetch(`${this.config.cloudEndpoint}/ai/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: this.state,
          config: this.config,
          gameState: this.serializeGameState(gameState),
        }),
        signal: AbortSignal.timeout(1000),
      });

      if (response.ok) {
        const decisions = await response.json();
        this.queueDecisions(decisions);
      } else {
        // Fallback to local
        this.makeLocalDecision(gameState);
      }
    } catch {
      // Fallback to local
      this.makeLocalDecision(gameState);
    }
  }

  /**
   * Make decision locally
   */
  private makeLocalDecision(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Evaluate priorities
    const priorities = this.evaluatePriorities(gameState);

    // Execute highest priority action
    for (const priority of priorities) {
      if (this.canExecuteAction(priority, gameState)) {
        this.executeAction(priority, gameState);
        this.actionsThisMinute++;
        return;
      }
    }
  }

  /**
   * Evaluate action priorities
   */
  private evaluatePriorities(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): AIAction[] {
    const actions: AIAction[] = [];

    // Check build queue
    for (const order of this.state.buildQueue) {
      if (order.status === 'pending') {
        actions.push({
          type: 'build',
          priority: order.priority * this.state.priorities.military,
          data: order,
        });
      }
    }

    // Check attack plans
    for (const plan of this.state.attackPlans) {
      if (plan.status === 'planning' && plan.readiness >= 1) {
        actions.push({
          type: 'attack',
          priority: plan.readiness * this.state.priorities.military * this.state.strategy.aggressiveness,
          data: plan,
        });
      }
    }

    // Check defense plans
    for (const plan of this.state.defensePlans) {
      if (plan.status === 'under_attack') {
        actions.push({
          type: 'defend',
          priority: 0.9,
          data: plan,
        });
      }
    }

    // Check opportunities
    for (const opportunity of this.state.opportunities) {
      if (opportunity.value > opportunity.risk) {
        actions.push({
          type: 'exploit',
          priority: opportunity.value * this.state.strategy.aggressiveness,
          data: opportunity,
        });
      }
    }

    // Sort by priority
    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if action can be executed
   */
  private canExecuteAction(
    action: AIAction,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): boolean {
    const player = gameState.players.get(this.config.playerId);
    if (!player) return false;

    switch (action.type) {
      case 'build': {
        const order = action.data as BuildOrder;
        const cost = this.getBuildCost(order.id);
        return (
          player.resources.gold >= cost.gold &&
          player.resources.wood >= cost.wood &&
          player.population.current + (order.supply || 0) <= player.population.cap
        );
      }
      case 'attack': {
        const plan = action.data as AttackPlan;
        return plan.assignedUnits.length >= this.calculateRequiredForce(plan);
      }
      case 'defend': {
        return true;
      }
      case 'exploit': {
        const opportunity = action.data as OpportunityTarget;
        return this.hasAvailableForce(gameState, opportunity.requiredForce);
      }
      default:
        return false;
    }
  }

  /**
   * Execute an action
   */
  private executeAction(
    action: AIAction,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    switch (action.type) {
      case 'build':
        this.executeBuild(action.data as BuildOrder, gameState);
        break;
      case 'attack':
        this.executeAttack(action.data as AttackPlan, gameState);
        break;
      case 'defend':
        this.executeDefense(action.data as DefensePlan, gameState);
        break;
      case 'exploit':
        this.executeExploit(action.data as OpportunityTarget, gameState);
        break;
    }
  }

  // ========================================================================
  // Action Execution
  // ========================================================================

  private executeBuild(
    order: BuildOrder,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    order.status = 'in_progress';

    // Would send build command to game
    this.actionQueue.push({
      type: 'build',
      unitId: order.id,
      unitType: order.type,
    });
  }

  private executeAttack(
    plan: AttackPlan,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    plan.status = 'executing';

    // Send attack command
    this.actionQueue.push({
      type: 'attack',
      unitIds: plan.assignedUnits,
      target: plan.target,
    });
  }

  private executeDefense(
    plan: DefensePlan,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Send defend command
    this.actionQueue.push({
      type: 'defend',
      unitIds: plan.defenders,
      target: plan.target,
    });
  }

  private executeExploit(
    opportunity: OpportunityTarget,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Send exploit command
    this.actionQueue.push({
      type: 'exploit',
      target: opportunity.position,
      force: opportunity.requiredForce,
    });
  }

  // ========================================================================
  // Threat Assessment
  // ========================================================================

  private createInitialThreatAssessment(): ThreatAssessment {
    return {
      level: 0,
      byPlayer: new Map(),
      primaryThreat: null,
      expectedAttack: Infinity,
    };
  }

  private updateThreats(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    let totalThreat = 0;
    let primaryThreat: Vector3 | null = null;
    let maxThreat = 0;

    for (const [playerId, player] of gameState.players) {
      if (playerId === this.config.playerId) continue;
      if (player.teamId === this.config.teamId) continue;

      // Calculate military strength
      const myUnits = this.getPlayerUnits(gameState, this.config.playerId);
      const enemyUnits = this.getPlayerUnits(gameState, playerId);

      const threat = this.calculateThreat(enemyUnits, myUnits);
      totalThreat += threat;

      if (threat > maxThreat) {
        maxThreat = threat;
        primaryThreat = this.getArmyCenter(enemyUnits);
      }

      this.state.threats.byPlayer.set(playerId, {
        playerId,
        militaryStrength: threat,
        economicStrength: 0.5, // Would calculate
        armyPosition: this.getArmyCenter(enemyUnits),
        armySize: enemyUnits.length,
      });
    }

    this.state.threats.level = Math.min(1, totalThreat);
    this.state.threats.primaryThreat = primaryThreat;
  }

  private calculateThreat(enemyUnits: UnitInstance[], myUnits: UnitInstance[]): number {
    let enemyStrength = 0;
    for (const unit of enemyUnits) {
      enemyStrength += unit.stats.damage * unit.stats.health / unit.stats.maxHealth;
    }

    let myStrength = 0;
    for (const unit of myUnits) {
      myStrength += unit.stats.damage * unit.stats.health / unit.stats.maxHealth;
    }

    return myStrength > 0 ? enemyStrength / myStrength : 1;
  }

  private getArmyCenter(units: UnitInstance[]): Vector3 | null {
    if (units.length === 0) return null;

    let x = 0, y = 0, z = 0;
    for (const unit of units) {
      x += unit.position.x;
      y += unit.position.y;
      z += unit.position.z;
    }

    return {
      x: x / units.length,
      y: y / units.length,
      z: z / units.length,
    };
  }

  // ========================================================================
  // Opportunities
  // ========================================================================

  private updateOpportunities(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    this.state.opportunities = [];

    // Look for expansion opportunities
    const expansions = this.findExpansionOpportunities(gameState);
    this.state.opportunities.push(...expansions);

    // Look for vulnerable enemy structures
    const targets = this.findVulnerableTargets(gameState);
    this.state.opportunities.push(...targets);
  }

  private findExpansionOpportunities(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): OpportunityTarget[] {
    const opportunities: OpportunityTarget[] = [];

    // Simplified: look for resource nodes
    // Would need actual resource node data

    return opportunities;
  }

  private findVulnerableTargets(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): OpportunityTarget[] {
    const targets: OpportunityTarget[] = [];

    for (const [playerId, player] of gameState.players) {
      if (playerId === this.config.playerId) continue;
      if (player.teamId === this.config.teamId) continue;

      const structures = this.getPlayerStructures(gameState, playerId);
      for (const structure of structures) {
        if (structure.health < structure.stats.maxHealth * 0.3) {
          targets.push({
            type: 'structure',
            position: structure.position,
            value: 0.7,
            risk: 0.3,
            requiredForce: 5,
            expiresAt: Date.now() + 30000,
          });
        }
      }
    }

    return targets;
  }

  // ========================================================================
  // Build Queue
  // ========================================================================

  private setupInitialBuildQueue(personality: PersonalityPreset): void {
    const baseBuildOrder: BuildOrder[] = [
      {
        type: 'structure',
        id: 'barracks',
        priority: 0.9,
        triggers: [],
        retry: true,
        status: 'pending',
      },
      {
        type: 'unit',
        id: 'rifleman',
        priority: 0.8,
        triggers: [],
        retry: true,
        status: 'pending',
      },
    ];

    this.state.buildQueue = baseBuildOrder;
  }

  private updateBuildQueue(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    for (const order of this.state.buildQueue) {
      if (order.status === 'in_progress') {
        // Check if completed
        const completed = this.checkBuildCompleted(order, gameState);
        if (completed) {
          order.status = 'completed';
        }
      }
    }

    // Remove completed orders
    this.state.buildQueue = this.state.buildQueue.filter(
      (o) => o.status !== 'completed' || !o.retry
    );
  }

  private checkBuildCompleted(
    order: BuildOrder,
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): boolean {
    // Check if unit/structure exists
    if (order.type === 'structure') {
      const structures = this.getPlayerStructures(gameState, this.config.playerId);
      return structures.some((s) => s.definitionId === order.id);
    } else {
      const units = this.getPlayerUnits(gameState, this.config.playerId);
      return units.some((u) => u.definitionId === order.id);
    }
  }

  // ========================================================================
  // Helper Methods
// ========================================================================

  private determinePhase(gameTime: number): AIState['phase'] {
    if (gameTime < 300) return 'early';
    if (gameTime < 900) return 'mid';
    if (gameTime < 1800) return 'late';
    return 'endgame';
  }

  private getPlayerUnits(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    },
    playerId: string
  ): UnitInstance[] {
    return Array.from(gameState.units.values()).filter(
      (u) => u.ownerId === playerId
    );
  }

  private getPlayerStructures(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    },
    playerId: string
  ): StructureInstance[] {
    return Array.from(gameState.structures.values()).filter(
      (s) => s.ownerId === playerId
    );
  }

  private getBuildCost(unitId: string): { gold: number; wood: number } {
    // Would look up from unit definitions
    return { gold: 100, wood: 50 };
  }

  private calculateRequiredForce(plan: AttackPlan): number {
    return plan.requiredUnits
      ? Object.values(plan.requiredUnits).reduce((a, b) => a + b, 0)
      : 10;
  }

  private hasAvailableForce(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    },
    force: number
  ): boolean {
    const units = this.getPlayerUnits(gameState, this.config.playerId);
    return units.length >= force;
  }

  private serializeGameState(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): unknown {
    return {
      units: Array.from(gameState.units.values()),
      structures: Array.from(gameState.structures.values()),
      players: Array.from(gameState.players.values()),
    };
  }

  // ========================================================================
  // Action Queue
  // ========================================================================

  /**
   * Get queued actions for execution
   */
  getActions(): AIAction[] {
    const actions = [...this.actionQueue];
    this.actionQueue = [];
    return actions;
  }

  private queueDecisions(decisions: unknown[]): void {
    // Queue decisions from cloud AI
    for (const decision of decisions) {
      this.actionQueue.push(decision as AIAction);
    }
  }

  private executeActions(
    gameState: {
      units: Map<string, UnitInstance>;
      structures: Map<string, StructureInstance>;
      players: Map<string, PlayerState>;
    }
  ): void {
    // Actions are executed by the game engine
    // This just updates internal state
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  setConfig(config: Partial<AICommanderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.config.difficulty = difficulty;
  }

  setPersonality(personality: AIPersonality): void {
    this.config.personality = personality;
    const preset = PERSONALITY_PRESETS[personality];
    this.state.strategy = { ...preset.strategy };
    this.state.priorities = { ...preset.resourcePriority };
  }

  getState(): AIState {
    return { ...this.state };
  }
}

// ============================================================================
// AI Action Types
// ============================================================================

export interface AIAction {
  type: 'build' | 'attack' | 'defend' | 'exploit' | 'move' | 'stop';
  priority?: number;
  data?: unknown;
  unitId?: string;
  unitType?: string;
  unitIds?: string[];
  target?: Vector3;
  force?: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI commander with configuration
 */
export function createAICommander(
  config?: Partial<AICommanderConfig>
): AICommander {
  return new AICommander({
    ...DEFAULT_AI_CONFIG,
    ...config,
  });
}

/**
 * Create a StudyLoG AI tutor commander
 */
export function createStudyLogTutor(
  personality: 'encouraging' | 'strict' | 'friendly' | 'mysterious',
  playerId: string = 'tutor'
): AICommander {
  const aiPersonalities: Record<string, AIPersonality> = {
    encouraging: 'balanced',
    strict: 'defensive',
    friendly: 'economic',
    mysterious: 'balanced',
  };

  return new AICommander({
    difficulty: 'easy',
    personality: aiPersonalities[personality] || 'balanced',
    updateInterval: 1000,
    apmCap: 20,
    useCloudAI: false,
    playerId,
    teamId: 0,
  });
}

/**
 * Create a DMLoG DM AI commander
 */
export function createDMLoGDM(
  difficulty: AIDifficulty = 'medium',
  playerId: string = 'dm_ai'
): AICommander {
  return new AICommander({
    difficulty,
    personality: 'balanced',
    updateInterval: 500,
    apmCap: 60,
    useCloudAI: true,
    playerId,
    teamId: -1, // DM controls monsters/enemies
  });
}

export default AICommander;
