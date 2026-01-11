/**
 * DMLoG.AI - Combat Agent
 *
 * Specialized agent for tactical combat decisions.
 * Handles initiative, targeting, action selection, and combat maneuvers.
 *
 * Biological Type: CAPTAIN (party leadership) or HERRING (horde combat)
 *
 * @module agents/combat-agent
 */

import type {
  AgentConfig,
  AgentDecision,
  AgentDecisionContext,
  AgentRole,
  AgentState,
  BiologicalAgent,
  DecisionSource,
  CombatState,
  Combatant,
  CombatAction,
  Vector3D,
  DiceRoll,
  ActionResult,
  MessagePriority,
  AgentMessage,
  LLMThinkResult,
  AgentStats,
} from '../types/index.js';
import {
  BiologicalAgent as BA,
  DMLoGAgentRole as DAR,
  AgentState as AS,
  DecisionSource as DS,
  SituationType as ST,
  ActionType as AT,
  ActionCost as AC,
  MessagePriority as MP,
  CombatTeam as CT,
  CombatStatus as CSt,
  SavingThrow as STh,
  DamageType as DT,
  AgentErrorCode as AEC,
} from '../types/index.js';
import { AgentError } from '../types/index.js';
import { getAgentRegistry } from '../core/agent-registry.js';
import { getCommunicationBus } from '../core/communication-bus.js';

/**
 * Combat agent configuration
 */
export interface CombatAgentConfig extends AgentConfig {
  /** Combat style preferences */
  combatStyle?: CombatStyle;
  /** Risk tolerance (0-1) */
  riskTolerance?: number;
  /** Target priority strategy */
  targetPriority?: TargetPriority;
  /** Favored actions */
  favoredActions?: string[];
}

/**
 * Combat style
 */
export enum CombatStyle {
  AGGRESSIVE = 'aggressive', // Focus on damage
  DEFENSIVE = 'defensive', // Focus on survival
  TACTICAL = 'tactical', // Balanced, opportunistic
  SUPPORT = 'support', // Focus on helping allies
  CONTROLLER = 'controller', // Focus on crowd control
}

/**
 * Target priority strategy
 */
export enum TargetPriority {
  LOWEST_HP = 'lowest_hp', // Finish off weakened foes
  HIGHEST_HP = 'highest_hp', // Tank priority
  CLOSEST = 'closest', // Proximity based
  STRONGEST = 'strongest', // Biggest threat first
  WEAKEST = 'weakest', // Easy kills first
  RANDOM = 'random', // Unpredictable
}

/**
 * Combat analysis result
 */
interface CombatAnalysis {
  /** Threat assessment */
  threats: CombatThreat[];
  /** Opportunity targets */
  opportunities: Opportunity[];
  /** Recommended action type */
  recommendedAction: AT;
  /** Target priority */
  targetPriority: TargetPriority;
  /** Positioning score */
  positioningScore: number;
  /** Survival urgency */
  survivalUrgency: number;
}

/**
 * Combat threat assessment
 */
interface CombatThreat {
  /** Threatening combatant ID */
  combatantId: string;
  /** Threat level (0-1) */
  threatLevel: number;
  /** Can attack this turn */
  canAttack: boolean;
  /** Expected damage */
  expectedDamage: number;
}

/**
 * Opportunity analysis
 */
interface Opportunity {
  /** Opportunity type */
  type: string;
  /** Target ID */
  targetId: string;
  /** Expected value (0-1) */
  value: number;
  /** Action needed */
  action: string;
}

/**
 * Combat Agent
 *
 * Specialized for tactical combat decisions. Uses BOT tier for
 * rule-based combat actions (dice rolls, rule lookups) and can
 * escalate to BRAIN/HUMAN for complex tactical decisions.
 */
export class CombatAgent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly biologicalType: BiologicalAgent;
  readonly sessionId: string;

  private config: CombatAgentConfig;
  private state: AgentState;
  private combatState?: CombatState;
  private registry = getAgentRegistry();
  private bus = getCommunicationBus();

  // Combat preferences
  private combatStyle: CombatStyle;
  private riskTolerance: number;
  private targetPriority: TargetPriority;
  private favoredActions: string[];

  // Statistics
  private stats: {
    totalDecisions: number;
    attacksMade: number;
    attacksHit: number;
    damageDealt: number;
    timesAttacked: number;
    damageTaken: number;
    deaths: number;
    kills: number;
  };

  constructor(config: CombatAgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.biologicalType = config.biologicalType;
    this.sessionId = config.sessionId;

    this.config = config;
    this.state = AS.IDLE;
    this.combatStyle = config.combatStyle ?? CombatStyle.TACTICAL;
    this.riskTolerance = config.riskTolerance ?? 0.5;
    this.targetPriority = config.targetPriority ?? TargetPriority.CLOSEST;
    this.favoredActions = config.favoredActions ?? [];

    this.stats = {
      totalDecisions: 0,
      attacksMade: 0,
      attacksHit: 0,
      damageDealt: 0,
      timesAttacked: 0,
      damageTaken: 0,
      deaths: 0,
      kills: 0,
    };

    // Setup message handlers
    this.setupMessageHandlers();
  }

  /**
   * Make a combat decision
   */
  async decide(context: AgentDecisionContext): Promise<AgentDecision> {
    const startTime = Date.now();
    this.state = AS.THINKING;
    this.stats.totalDecisions++;

    try {
      // Determine decision source
      const source = this.determineSource(context);

      let result: LLMThinkResult;

      if (source === DS.BOT) {
        result = this.generateBotDecision(context);
      } else if (source === DS.BRAIN) {
        result = await this.generateBrainDecision(context);
      } else {
        result = await this.generateHumanDecision(context);
      }

      const decision: AgentDecision = {
        decisionId: `combat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        agentId: this.id,
        role: this.role,
        source,
        content: result.content,
        action: result.action ?? 'attack',
        actionParams: result.actionParams,
        confidence: 0.8,
        timeTakenMs: Date.now() - startTime,
        costEstimate: this.estimateCost(source),
        thoughts: result.thoughts,
        emotions: result.emotions,
        metadata: {
          combatStyle: this.combatStyle,
          targetPriority: this.targetPriority,
        },
      };

      this.state = AS.IDLE;
      return decision;
    } catch (error) {
      this.state = AS.IDLE;
      throw new AgentError(
        AEC.DECISION_FAILED,
        `Combat decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId: this.id, error }
      );
    }
  }

  /**
   * Set combat state
   */
  setCombatState(combat: CombatState): void {
    this.combatState = combat;
  }

  /**
   * Get current combat state
   */
  getCombatState(): CombatState | undefined {
    return this.combatState;
  }

  /**
   * Analyze combat situation
   */
  analyzeCombat(myCombatantId: string): CombatAnalysis {
    if (!this.combatState) {
      return {
        threats: [],
        opportunities: [],
        recommendedAction: AT.WAIT,
        targetPriority: this.targetPriority,
        positioningScore: 0.5,
        survivalUrgency: 0,
      };
    }

    const myCombatant = this.combatState.combatants.find(
      c => c.id === myCombatantId
    );

    if (!myCombatant) {
      return {
        threats: [],
        opportunities: [],
        recommendedAction: AT.WAIT,
        targetPriority: this.targetPriority,
        positioningScore: 0.5,
        survivalUrgency: 0,
      };
    }

    // Analyze threats
    const threats = this.analyzeThreats(myCombatant);

    // Analyze opportunities
    const opportunities = this.analyzeOpportunities(myCombatant);

    // Calculate survival urgency
    const survivalUrgency = 1 - myCombatant.hp / myCombatant.hpMax;

    // Recommend action based on style and situation
    const recommendedAction = this.recommendAction(
      myCombatant,
      threats,
      opportunities,
      survivalUrgency
    );

    // Score positioning
    const positioningScore = this.scorePositioning(myCombatant);

    return {
      threats,
      opportunities,
      recommendedAction,
      targetPriority: this.targetPriority,
      positioningScore,
      survivalUrgency,
    };
  }

  /**
   * Select target based on priority strategy
   */
  selectTarget(
    myTeam: CT,
    availableTargets: Combatant[]
  ): Combatant | null {
    if (availableTargets.length === 0) {
      return null;
    }

    // Filter targets on enemy team
    const enemies = availableTargets.filter(
      c => c.team !== myTeam && c.team !== CT.ALLIES
    );

    if (enemies.length === 0) {
      return null;
    }

    // Sort by priority strategy
    const sorted = this.sortTargetsByPriority(enemies);
    return sorted[0] ?? null;
  }

  /**
   * Roll for initiative
   */
  rollInitiative(modifier: number = 0): number {
    return this.rollDice(1, 20) + modifier;
  }

  /**
   * Roll an attack
   */
  rollAttack(attackBonus: number): number {
    const roll = this.rollDice(1, 20);
    const natural20 = roll === 20;
    const natural1 = roll === 1;

    return {
      total: roll + attackBonus,
      natural20,
      natural1,
      crit: natural20,
      fumble: natural1,
    };
  }

  /**
   * Roll damage
   */
  rollDamage(dice: DiceRoll): number {
    let total = 0;
    for (let i = 0; i < dice.count; i++) {
      total += this.rollDice(1, dice.sides);
    }
    return total + dice.modifier;
  }

  /**
   * Roll a saving throw
   */
  rollSavingThrow(save: STh, modifier: number = 0): {
    roll: number;
    total: number;
    success: boolean;
    dc: number;
  } {
    const roll = this.rollDice(1, 20);
    const total = roll + modifier;

    return {
      roll,
      total,
      success: false, // Caller determines success against DC
      dc: 0, // Caller provides DC
    };
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return {
      agentId: this.id,
      role: this.role,
      totalDecisions: this.stats.totalDecisions,
      decisionsBySource: {
        bot: Math.floor(this.stats.totalDecisions * 0.7),
        brain: Math.floor(this.stats.totalDecisions * 0.25),
        human: Math.floor(this.stats.totalDecisions * 0.05),
        override: 0,
      },
      avgConfidence: 0.8,
      avgTimeMs: 50,
      totalCost: this.stats.totalDecisions * 0.001,
      successRate:
        this.stats.attacksMade > 0
          ? this.stats.attacksHit / this.stats.attacksMade
          : 0.8,
      escalationRate: 0.2,
      memoryStats: {
        totalMemories: 0,
        byType: {},
        avgImportance: 5,
      },
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Determine decision source based on context
   */
  private determineSource(context: AgentDecisionContext): DecisionSource {
    const { stakes, situationType } = context;

    // High stakes = escalate to HUMAN
    if (stakes >= 0.8) {
      return DS.HUMAN;
    }

    // Medium stakes or complex situation = BRAIN
    if (stakes >= 0.5 || situationType === ST.COMBAT) {
      return DS.BRAIN;
    }

    // Low stakes = BOT
    return DS.BOT;
  }

  /**
   * Generate BOT tier decision (rule-based)
   */
  private generateBotDecision(context: AgentDecisionContext): LLMThinkResult {
    const analysis = this.analyzeCombat(context.agentId);
    const combatant = this.combatState?.combatants.find(
      c => c.id === context.agentId
    );

    let action = analysis.recommendedAction;
    let content = '';
    let target: string | undefined;

    // Select target based on priority
    if (combatant) {
      const enemies = this.combatState?.combatants.filter(
        c => c.team !== combatant.team && c.team !== CT.ALLIES
      ) ?? [];
      const selectedTarget = this.selectTarget(combatant.team, enemies);
      target = selectedTarget?.id;

      // Generate action based on combat style
      switch (this.combatStyle) {
        case CombatStyle.AGGRESSIVE:
          action = AT.ATTACK;
          content = `I press the attack against ${target ?? 'the enemy'}!`;
          break;
        case CombatStyle.DEFENSIVE:
          if (analysis.survivalUrgency > 0.5) {
            action = AT.DODGE;
            content = 'I focus on defense and evasion.';
          } else {
            action = AT.ATTACK;
            content = `I strike cautiously at ${target ?? 'the enemy'}.`;
          }
          break;
        case CombatStyle.SUPPORT:
          action = AT.HELP;
          content = 'I look for ways to assist my allies.';
          break;
        case CombatStyle.CONTROLLER:
          action = AT.ATTACK; // Would use crowd control in full implementation
          content = `I target ${target ?? 'the enemy'} to limit their options.`;
          break;
        default: // TACTICAL
          action = analysis.recommendedAction;
          content = `I assess the battlefield and ${this.getActionDescription(action)}${target ? ` targeting ${target}` : ''}.`;
      }
    }

    return {
      content,
      action,
      actionParams: target ? { target } : undefined,
      thoughts: `Combat analysis: ${analysis.threats.length} threats, ${analysis.opportunities.length} opportunities. Survival urgency: ${analysis.survivalUrgency.toFixed(2)}`,
      emotions: {
        aggression: this.combatStyle === CombatStyle.AGGRESSIVE ? 0.8 : 0.5,
        caution: this.combatStyle === CombatStyle.DEFENSIVE ? 0.8 : 0.3,
        focus: 0.9,
      },
    };
  }

  /**
   * Generate BRAIN tier decision (personality-driven)
   */
  private async generateBrainDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    // Start with BOT analysis
    const botResult = this.generateBotDecision(context);

    // Add personality-based modifiers
    if (this.config.onThink) {
      try {
        const llmResult = await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildCombatContext(context),
          [],
          context.stakes
        );
        return llmResult;
      } catch {
        // Fall back to enhanced BOT result
      }
    }

    // Enhanced BOT result with more tactical reasoning
    return {
      ...botResult,
      thoughts: `${botResult.thoughts} Using ${this.combatStyle} combat style with ${this.targetPriority} targeting priority.`,
      emotions: {
        ...botResult.emotions,
        confidence: 0.7,
      },
    };
  }

  /**
   * Generate HUMAN tier decision (LLM-backed for critical moments)
   */
  private async generateHumanDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    // Use LLM callback if provided
    if (this.config.onThink) {
      try {
        return await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildCombatContext(context),
          [],
          context.stakes
        );
      } catch {
        // Fall through
      }
    }

    // High-stakes default
    return {
      content: `This is a critical combat moment. I focus my tactics for maximum effectiveness.`,
      action: 'attack',
      thoughts: 'Analyzing all combat factors for optimal decision',
      emotions: {
        focus: 1.0,
        determination: 0.9,
      },
    };
  }

  /**
   * Build combat context string
   */
  private buildCombatContext(context: AgentDecisionContext): string {
    if (!this.combatState) {
      return 'No active combat.';
    }

    const combatant = this.combatState.combatants.find(
      c => c.id === context.agentId
    );

    const parts: string[] = [
      `Combat Round: ${this.combatState.currentRound}`,
      `My Status: ${combatant?.hp ?? 0}/${combatant?.hpMax ?? 0} HP`,
      `Combat Style: ${this.combatStyle}`,
    ];

    const allies = this.combatState.combatants.filter(
      c => c.team === combatant?.team && c.id !== combatant?.id
    );
    const enemies = this.combatState.combatants.filter(
      c => c.team !== combatant?.team && c.team !== CT.ALLIES
    );

    if (allies.length > 0) {
      parts.push(`Allies: ${allies.map(a => a.name).join(', ')}`);
    }
    if (enemies.length > 0) {
      parts.push(`Enemies: ${enemies.map(e => `${e.name} (${e.hp}/${e.hpMax})`).join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Analyze threats to a combatant
   */
  private analyzeThreats(combatant: Combatant): CombatThreat[] {
    if (!this.combatState) return [];

    const enemies = this.combatState.combatants.filter(
      c => c.team !== combatant.team && c.team !== CT.ALLIES
    );

    return enemies.map(enemy => {
      const distance = this.calculateDistance(combatant, enemy);
      const canAttack = distance <= 5; // Assuming 5ft reach
      const expectedDamage = this.estimateDamage(enemy, combatant);

      return {
        combatantId: enemy.id,
        threatLevel: this.calculateThreatLevel(enemy, distance, expectedDamage),
        canAttack,
        expectedDamage,
      };
    });
  }

  /**
   * Analyze opportunities for a combatant
   */
  private analyzeOpportunities(combatant: Combatant): Opportunity[] {
    const opportunities: Opportunity[] = [];

    if (!this.combatState) return opportunities;

    const enemies = this.combatState.combatants.filter(
      c => c.team !== combatant.team && c.team !== CT.ALLIES
    );

    // Check for low HP targets
    for (const enemy of enemies) {
      const hpRatio = enemy.hp / enemy.hpMax;
      if (hpRatio < 0.25) {
        opportunities.push({
          type: 'finishing_blow',
          targetId: enemy.id,
          value: 0.9,
          action: 'attack',
        });
      }
    }

    // Check for advantage opportunities (flanking, etc.)
    // Simplified - would check actual positioning in full implementation

    return opportunities.sort((a, b) => b.value - a.value);
  }

  /**
   * Recommend action based on analysis
   */
  private recommendAction(
    combatant: Combatant,
    threats: CombatThreat[],
    opportunities: Opportunity[],
    survivalUrgency: number
  ): AT {
    // High survival urgency = defensive
    if (survivalUrgency > 0.7) {
      return AT.DODGE;
    }

    // Good opportunity = take it
    if (opportunities.length > 0 && opportunities[0].value > 0.8) {
      return AT.ATTACK;
    }

    // Based on combat style
    switch (this.combatStyle) {
      case CombatStyle.AGGRESSIVE:
        return AT.ATTACK;
      case CombatStyle.DEFENSIVE:
        return survivalUrgency > 0.3 ? AT.DODGE : AT.ATTACK;
      case CombatStyle.SUPPORT:
        return AT.HELP;
      default:
        return AT.ATTACK;
    }
  }

  /**
   * Score positioning (0-1)
   */
  private scorePositioning(combatant: Combatant): number {
    // Simplified positioning score
    // Full implementation would check cover, flanking, elevation, etc.
    return 0.5;
  }

  /**
   * Sort targets by priority strategy
   */
  private sortTargetsByPriority(enemies: Combatant[]): Combatant[] {
    const sorted = [...enemies];

    switch (this.targetPriority) {
      case TargetPriority.LOWEST_HP:
        return sorted.sort((a, b) => a.hp - b.hp);
      case TargetPriority.HIGHEST_HP:
        return sorted.sort((a, b) => b.hp - a.hp);
      case TargetPriority.CLOSEST:
        // Would calculate actual distances
        return sorted.sort((a, b) => {
          const distA = a.position?.x ?? 0;
          const distB = b.position?.x ?? 0;
          return distA - distB;
        });
      case TargetPriority.WEAKEST:
        return sorted.sort((a, b) => a.hpMax - b.hpMax);
      case TargetPriority.STRONGEST:
        return sorted.sort((a, b) => b.hpMax - a.hpMax);
      case TargetPriority.RANDOM:
        return sorted.sort(() => Math.random() - 0.5);
      default:
        return sorted;
    }
  }

  /**
   * Calculate distance between combatants
   */
  private calculateDistance(a: Combatant, b: Combatant): number {
    if (!a.position || !b.position) return 10;

    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dz = a.position.z - b.position.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Estimate damage from attacker to defender
   */
  private estimateDamage(attacker: Combatant, defender: Combatant): number {
    // Simplified damage estimation
    const baseDamage = attacker.stats.damage?.count ?? 1;
    const avgRoll = (attacker.stats.damage?.sides ?? 6) / 2;
    return baseDamage * avgRoll + (attacker.stats.damage?.modifier ?? 0);
  }

  /**
   * Calculate threat level (0-1)
   */
  private calculateThreatLevel(
    enemy: Combatant,
    distance: number,
    expectedDamage: number
  ): number {
    // Factors: expected damage, proximity, enemy HP
    const damageFactor = Math.min(expectedDamage / 20, 1);
    const proximityFactor = Math.max(1 - distance / 30, 0);
    const hpFactor = enemy.hp / enemy.hpMax;

    return (damageFactor * 0.5 + proximityFactor * 0.3 + hpFactor * 0.2);
  }

  /**
   * Roll dice
   */
  private rollDice(count: number, sides: number): number {
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += Math.floor(Math.random() * sides) + 1;
    }
    return total;
  }

  /**
   * Get action description
   */
  private getActionDescription(action: AT): string {
    const descriptions: Record<AT, string> = {
      attack: 'attack',
      spell: 'cast a spell',
      ability: 'use an ability',
      maneuver: 'perform a maneuver',
      item: 'use an item',
      move: 'move',
      dodge: 'dodge',
      dash: 'dash',
      disengage: 'disengage',
      help: 'help an ally',
      ready: 'ready an action',
      search: 'search',
      wait: 'wait',
    };
    return descriptions[action] ?? 'act';
  }

  /**
   * Estimate cost for decision source
   */
  private estimateCost(source: DecisionSource): number {
    switch (source) {
      case DS.BOT:
        return 0;
      case DS.BRAIN:
        return 0.001;
      case DS.HUMAN:
        return 0.02;
      default:
        return 0;
    }
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.bus.subscribe(
      this.id,
      'action_request' as any,
      this.handleActionRequest.bind(this)
    );
  }

  /**
   * Handle action request message
   */
  private async handleActionRequest(message: AgentMessage): Promise<void> {
    const { context, source, confidenceRequired } = message.payload as {
      context: AgentDecisionContext;
      source: DecisionSource;
      confidenceRequired: number;
    };

    try {
      const decision = await this.decide(context);

      await this.bus.respond(message, {
        success: true,
        decision,
      });
    } catch (error) {
      await this.bus.respond(message, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Create a combat agent
 */
export function createCombatAgent(config: CombatAgentConfig): CombatAgent {
  const agent = new CombatAgent({
    ...config,
    role: DAR.COMBAT,
    biologicalType: BA.CAPTAIN,
  });

  // Register with agent registry
  getAgentRegistry().register(agent, config);

  return agent;
}

/**
 * Create a horde combat agent (HERRING type)
 */
export function createHordeAgent(config: CombatAgentConfig): CombatAgent {
  const agent = new CombatAgent({
    ...config,
    role: DAR.MONSTER,
    biologicalType: BA.HERRING,
  });

  getAgentRegistry().register(agent, config);

  return agent;
}
