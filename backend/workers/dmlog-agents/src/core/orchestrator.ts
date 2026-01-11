/**
 * DMLoG.AI - Agent Orchestrator
 *
 * Main coordinator (Whale/DM Agent) for multi-agent orchestration.
 * Coordinates specialized agents for combat, social, exploration scenarios.
 * Integrates with StudyLoG.AI escalation engine for cost-optimized decisions.
 *
 * @module core/orchestrator
 */

import type {
  AgentConfig,
  AgentDecision,
  AgentDecisionContext,
  AgentRole,
  AgentState,
  BiologicalAgent,
  DecisionSource,
  SituationType,
  DMLoGAgentRole,
  StudyLoGAgentRole,
  CoordinateAgentsRequest,
  CoordinateAgentsResponse,
  CoordinationPlan,
  AgentAssignment,
  ActionResult,
  MessagePriority,
  AgentMessage,
  AgentStats,
} from '../types/index.js';
import {
  BiologicalAgent,
  AgentState as AS,
  DecisionSource as DS,
  MessagePriority as MP,
  SituationType as ST,
} from '../types/index.js';
import { getAgentRegistry } from './agent-registry.js';
import { getCommunicationBus } from './communication-bus.js';

/**
 * Escalation engine integration (lightweight interface)
 * Integrates with @studylog/escalation package
 */
interface EscalationEngine {
  routeDecision(context: {
    studentId: string;
    situationType: string;
    situationDescription: string;
    stakes: number;
    urgencyMs?: number;
    progressRatio: number;
    availableResources: Record<string, number>;
    similarDecisionsCount: number;
    recentFailures: number;
    currentPhase: string;
    customData?: Record<string, unknown>;
    timestamp?: number;
  }): {
    source: DS;
    reason?: string;
    confidenceRequired: number;
    timeBudgetMs?: number;
    allowFallback: boolean;
    metadata: Record<string, unknown>;
  };
  recordDecision(result: unknown): void;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  /** Orchestrator ID */
  orchestratorId: string;
  /** Default session ID */
  sessionId: string;
  /** Enable escalation */
  enableEscalation?: boolean;
  /** Default time limit for coordination (ms) */
  defaultTimeLimitMs?: number;
  /** Maximum parallel agent decisions */
  maxParallelDecisions?: number;
  /** Enable learning */
  enableLearning?: boolean;
  /** Communication bus options */
  communicationOptions?: {
    messageTimeout?: number;
    debugLog?: boolean;
  };
}

/**
 * Agent decision request
 */
interface DecisionRequest {
  agentId: string;
  role: AgentRole;
  context: AgentDecisionContext;
  priority: MessagePriority;
}

/**
 * Orchestrator
 *
 * The Whale/DM Agent equivalent - coordinates all other agents.
 * Maps situations to appropriate specialized agents and coordinates
 * multi-agent scenarios.
 */
export class AgentOrchestrator {
  private readonly config: OrchestratorConfig;

  /** Escalation engine instance */
  private escalationEngine?: EscalationEngine;

  /** Active decisions being processed */
  private readonly activeDecisions: Map<string, Promise<AgentDecision>>;

  /** Decision history for learning */
  private readonly decisionHistory: AgentDecision[];

  /** Orchestrator state */
  private state: AgentState;

  /** Statistics */
  private stats: {
    totalDecisions: number;
    totalCoordinations: number;
    escalationsTriggered: number;
    avgResponseTime: number;
    totalCost: number;
  };

  /** Agent role mapping to biological types */
  private static readonly ROLE_BIOLOGICAL_MAPPING: Partial<
    Record<AgentRole, BiologicalAgent>
  > = {
    combat: BiologicalAgent.CAPTAIN,
    social: BiologicalAgent.CAPTAIN,
    exploration: BiologicalAgent.FLEET,
    dungeon_master: BiologicalAgent.WHALE,
    party_leader: BiologicalAgent.CAPTAIN,
    npc: BiologicalAgent.DECKHAND,
    monster: BiologicalAgent.HERRING,
    tutor: BiologicalAgent.CAPTAIN,
    guide: BiologicalAgent.CAPTAIN,
    builder: BiologicalAgent.DECKHAND,
    tester: BiologicalAgent.DECKHAND,
    mentor: BiologicalAgent.CAPTAIN,
  };

  constructor(config: OrchestratorConfig) {
    this.config = {
      defaultTimeLimitMs: 5000,
      maxParallelDecisions: 10,
      enableEscalation: true,
      enableLearning: true,
      ...config,
    };

    this.activeDecisions = new Map();
    this.decisionHistory = [];
    this.state = AS.IDLE;
    this.stats = {
      totalDecisions: 0,
      totalCoordinations: 0,
      escalationsTriggered: 0,
      avgResponseTime: 0,
      totalCost: 0,
    };

    // Initialize communication bus
    const bus = getCommunicationBus(this.config.communicationOptions);
    if (!bus.isRunning()) {
      bus.start();
    }

    // Subscribe to bus messages
    this.setupMessageHandlers();
  }

  /**
   * Set escalation engine (optional integration)
   */
  setEscalationEngine(engine: EscalationEngine): void {
    this.escalationEngine = engine;
  }

  /**
   * Get a decision from the most appropriate agent
   *
   * @param context - Decision context
   * @returns Promise resolving to the decision
   */
  async decide(context: AgentDecisionContext): Promise<AgentDecision> {
    const startTime = Date.now();
    this.state = AS.THINKING;

    try {
      // Determine the best agent for this situation
      const agentRole = this.determineAgentRole(context);
      const agentIds = this.findAgentsForRole(agentRole, context.sessionId);

      if (agentIds.length === 0) {
        // No specialized agent available, use default handler
        return this.generateDefaultDecision(context);
      }

      // Select primary agent
      const primaryAgentId = this.selectBestAgent(agentIds, context);

      // Route decision through escalation if enabled
      const escalation = this.config.enableEscalation
        ? this.routeThroughEscalation(context)
        : { source: DS.BRAIN, confidenceRequired: 0.7 };

      // Get decision from agent
      const decision = await this.requestAgentDecision(
        primaryAgentId,
        context,
        escalation.source,
        escalation.confidenceRequired
      );

      // Record decision
      this.recordDecision(decision);

      this.state = AS.IDLE;
      this.updateStats(Date.now() - startTime, decision.costEstimate);

      return decision;
    } catch (error) {
      this.state = AS.IDLE;
      throw error;
    }
  }

  /**
   * Coordinate multiple agents for a complex scenario
   *
   * @param request - Coordination request
   * @returns Promise resolving to coordination response
   */
  async coordinate(request: CoordinateAgentsRequest): Promise<CoordinateAgentsResponse> {
    this.state = AS.COORDINATING;
    const startTime = Date.now();

    try {
      const coordinationId = this.generateCoordinationId();

      // Analyze the objective to determine required agents
      const requiredRoles = this.analyzeObjective(request.objective);

      // Find available agents
      const availableAgents = this.findAvailableAgents(
        request.agentIds,
        request.sessionId,
        requiredRoles
      );

      // Create coordination plan
      const plan = this.createCoordinationPlan(
        request.objective,
        availableAgents,
        requiredRoles
      );

      // Execute plan in parallel where possible
      const decisions = await this.executeCoordinationPlan(
        plan,
        request.timeLimitMs ?? this.config.defaultTimeLimitMs!
      );

      this.stats.totalCoordinations++;

      this.state = AS.IDLE;
      this.updateStats(Date.now() - startTime, 0);

      return {
        coordinationId,
        decisions,
        plan,
      };
    } catch (error) {
      this.state = AS.IDLE;
      throw error;
    }
  }

  /**
   * Get current orchestrator state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): typeof this.stats & {
    activeDecisions: number;
    recentDecisions: number;
    escalationRate: number;
  } {
    const escalationRate =
      this.stats.totalDecisions > 0
        ? this.stats.escalationsTriggered / this.stats.totalDecisions
        : 0;

    return {
      ...this.stats,
      activeDecisions: this.activeDecisions.size,
      recentDecisions: this.decisionHistory.slice(-100).length,
      escalationRate,
    };
  }

  /**
   * Get agent stats for all agents in session
   */
  getSessionAgentStats(sessionId: string): Map<string, AgentStats> {
    const registry = getAgentRegistry();
    const agentIds = registry.getSessionAgents(sessionId);
    const stats = new Map<string, AgentStats>();

    for (const agentId of agentIds) {
      stats.set(agentId, {
        agentId,
        role: registry.getConfig(agentId)?.role ?? ('unknown' as AgentRole),
        totalDecisions: 0,
        decisionsBySource: {
          bot: 0,
          brain: 0,
          human: 0,
          override: 0,
        },
        avgConfidence: 0.7,
        avgTimeMs: 50,
        totalCost: 0,
        successRate: 0.8,
        escalationRate: 0.2,
        memoryStats: {
          totalMemories: 0,
          byType: {},
          avgImportance: 5,
        },
      });
    }

    return stats;
  }

  /**
   * Get decision history
   */
  getHistory(limit?: number): AgentDecision[] {
    if (limit) {
      return this.decisionHistory.slice(-limit);
    }
    return [...this.decisionHistory];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.decisionHistory.length = 0;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Determine the appropriate agent role for a situation
   */
  private determineAgentRole(context: AgentDecisionContext): AgentRole {
    const { situationType } = context;

    // Map situation types to agent roles
    switch (situationType) {
      case ST.COMBAT:
      case ST.SAVING_THROW:
      case ST.SKILL_CHECK:
        return 'combat' as DMLoGAgentRole;

      case ST.SOCIAL:
      case ST.ROLEPLAY:
      case ST.DIALOGUE:
        return 'social' as DMLoGAgentRole;

      case ST.EXPLORATION:
      case ST.INVESTIGATION:
      case ST.PUZZLE:
      case ST.DISCOVERY:
        return 'exploration' as DMLoGAgentRole;

      case ST.LEARNING:
      case ST.PRACTICE:
      case ST.ASSESSMENT:
        return 'tutor' as StudyLoGAgentRole;

      default:
        return 'dungeon_master' as DMLoGAgentRole;
    }
  }

  /**
   * Find agents for a specific role
   */
  private findAgentsForRole(role: AgentRole, sessionId: string): string[] {
    const registry = getAgentRegistry();
    return registry.findCapableAgents(role, undefined, sessionId);
  }

  /**
   * Select the best agent from candidates
   */
  private selectBestAgent(
    candidates: string[],
    context: AgentDecisionContext
  ): string {
    // Simple selection - could be enhanced with load balancing
    // Prefer agents with lower recent activity
    const registry = getAgentRegistry();

    let bestAgent = candidates[0];
    let lowestActivity = Infinity;

    for (const agentId of candidates) {
      const config = registry.getConfig(agentId);
      if (config && config.id) {
        // Simplified activity check
        // In real implementation, would check actual activity metrics
        if (agentId < bestAgent) {
          bestAgent = agentId;
        }
      }
    }

    return bestAgent;
  }

  /**
   * Route decision through escalation engine
   */
  private routeThroughEscalation(context: AgentDecisionContext): {
    source: DecisionSource;
    confidenceRequired: number;
    timeBudgetMs?: number;
  } {
    if (!this.escalationEngine) {
      return { source: DS.BRAIN, confidenceRequired: 0.7 };
    }

    try {
      const result = this.escalationEngine.routeDecision({
        studentId: context.agentId,
        situationType: context.situationType,
        situationDescription: context.situation,
        stakes: context.stakes,
        urgencyMs: context.urgencyMs,
        progressRatio: 0.5,
        availableResources: context.availableResources,
        similarDecisionsCount: 0,
        recentFailures: 0,
        currentPhase: 'dungeon-master',
        customData: context.metadata,
        timestamp: Date.now(),
      });

      if (result.source !== DS.BOT) {
        this.stats.escalationsTriggered++;
      }

      return {
        source: result.source,
        confidenceRequired: result.confidenceRequired,
        timeBudgetMs: result.timeBudgetMs,
      };
    } catch {
      return { source: DS.BRAIN, confidenceRequired: 0.7 };
    }
  }

  /**
   * Request decision from specific agent
   */
  private async requestAgentDecision(
    agentId: string,
    context: AgentDecisionContext,
    source: DecisionSource,
    confidenceRequired: number
  ): Promise<AgentDecision> {
    const bus = getCommunicationBus();

    // Send decision request via communication bus
    const response = await bus.sendAndWaitForResponse(
      this.config.orchestratorId,
      agentId,
      'action_request' as any,
      {
        context,
        source,
        confidenceRequired,
      },
      MP.HIGH,
      this.config.defaultTimeLimitMs
    );

    // Extract decision from response
    const decision: AgentDecision = {
      decisionId: this.generateDecisionId(),
      agentId,
      role: context.role,
      source,
      content: (response.payload.content as string) ?? '',
      action: (response.payload.action as string) ?? 'wait',
      actionParams: response.payload.actionParams as Record<string, unknown>,
      confidence: (response.payload.confidence as number) ?? confidenceRequired,
      timeTakenMs: Date.now() - (context.metadata?.startTime as number ?? Date.now()),
      costEstimate: this.estimateCost(source),
      thoughts: response.payload.thoughts as string,
      emotions: response.payload.emotions as Record<string, number>,
      metadata: response.payload.metadata as Record<string, unknown>,
    };

    return decision;
  }

  /**
   * Generate default decision when no agent available
   */
  private generateDefaultDecision(context: AgentDecisionContext): AgentDecision {
    return {
      decisionId: this.generateDecisionId(),
      agentId: this.config.orchestratorId,
      role: context.role,
      source: DS.BOT,
      content: `I process: ${context.situation.slice(0, 100)}`,
      action: 'wait',
      confidence: 0.5,
      timeTakenMs: 1,
      costEstimate: 0,
      thoughts: 'No specialized agent available',
      emotions: {},
      metadata: {},
    };
  }

  /**
   * Analyze objective to determine required agent roles
   */
  private analyzeObjective(objective: string): AgentRole[] {
    const lower = objective.toLowerCase();
    const roles: AgentRole[] = [];

    // Simple keyword matching for role determination
    if (/combat|fight|attack|battle|enemy/.test(lower)) {
      roles.push('combat' as DMLoGAgentRole);
    }
    if (/talk|speak|negotiate|social|dialogue/.test(lower)) {
      roles.push('social' as DMLoGAgentRole);
    }
    if (/explore|search|find|discover|loot/.test(lower)) {
      roles.push('exploration' as DMLoGAgentRole);
    }

    // Default to dungeon master if no specific roles identified
    if (roles.length === 0) {
      roles.push('dungeon_master' as DMLoGAgentRole);
    }

    return roles;
  }

  /**
   * Find available agents for roles
   */
  private findAvailableAgents(
    preferredAgentIds: string[] | undefined,
    sessionId: string,
    requiredRoles: AgentRole[]
  ): Map<AgentRole, string[]> {
    const registry = getAgentRegistry();
    const available = new Map<AgentRole, string[]>();

    for (const role of requiredRoles) {
      let agents = registry.findCapableAgents(role, undefined, sessionId);

      // Filter to preferred if specified
      if (preferredAgentIds && preferredAgentIds.length > 0) {
        agents = agents.filter(id => preferredAgentIds.includes(id));
      }

      available.set(role, agents);
    }

    return available;
  }

  /**
   * Create coordination plan
   */
  private createCoordinationPlan(
    objective: string,
    availableAgents: Map<AgentRole, string[]>,
    requiredRoles: AgentRole[]
  ): CoordinationPlan {
    const assignments: AgentAssignment[] = [];
    const executionOrder: string[] = [];

    // Assign agents to roles
    for (const role of requiredRoles) {
      const agents = availableAgents.get(role) ?? [];
      if (agents.length > 0) {
        const agentId = agents[0]; // Take first available
        assignments.push({
          agentId,
          task: `${role} for: ${objective.slice(0, 50)}`,
          dependencies: [],
        });
        executionOrder.push(agentId);
      }
    }

    // Estimate time based on number of agents
    const estimatedTimeMs = assignments.length * 1000;

    return {
      description: `Coordinate ${requiredRoles.join(', ')} for: ${objective}`,
      assignments,
      executionOrder,
      estimatedTimeMs,
    };
  }

  /**
   * Execute coordination plan
   */
  private async executeCoordinationPlan(
    plan: CoordinationPlan,
    timeLimitMs: number
  ): Promise<AgentDecision[]> {
    const decisions: AgentDecision[] = [];
    const startTime = Date.now();

    // Execute in order respecting dependencies
    for (const assignment of plan.assignments) {
      // Check time limit
      if (Date.now() - startTime > timeLimitMs) {
        break;
      }

      // Check if dependencies are met
      const dependenciesMet = assignment.dependencies.every(depId =>
        decisions.some(d => d.agentId === depId)
      );

      if (!dependenciesMet) {
        continue; // Skip if dependencies not met
      }

      // Create context for this agent
      const context: AgentDecisionContext = {
        agentId: assignment.agentId,
        role: 'dungeon_master' as AgentRole, // Simplified
        situation: assignment.task,
        situationType: ST.ROLEPLAY,
        stakes: 0.5,
        location: '',
        participants: [],
        availableResources: {},
        sessionId: this.config.sessionId,
        metadata: { coordination: true },
      };

      try {
        const decision = await this.decide(context);
        decisions.push(decision);
      } catch (error) {
        // Continue with other agents on error
        // eslint-disable-next-line no-console
        console.warn(`Coordination error for ${assignment.agentId}:`, error);
      }
    }

    return decisions;
  }

  /**
   * Record a decision for learning
   */
  private recordDecision(decision: AgentDecision): void {
    this.decisionHistory.push(decision);
    this.stats.totalDecisions++;

    // Record in escalation engine if available
    if (this.escalationEngine) {
      try {
        this.escalationEngine.recordDecision({
          decisionId: decision.decisionId,
          source: decision.source,
          action: decision.action,
          confidence: decision.confidence,
          timeTakenMs: decision.timeTakenMs,
          costEstimate: decision.costEstimate,
          metadata: {
            agentId: decision.agentId,
            role: decision.role,
          },
        });
      } catch {
        // Ignore escalation errors
      }
    }
  }

  /**
   * Update statistics
   */
  private updateStats(responseTime: number, cost: number): void {
    const n = this.stats.totalDecisions;
    this.stats.avgResponseTime =
      (this.stats.avgResponseTime * (n - 1) + responseTime) / n;
    this.stats.totalCost += cost;
  }

  /**
   * Setup message handlers for communication bus
   */
  private setupMessageHandlers(): void {
    const bus = getCommunicationBus();

    // Subscribe to action responses
    bus.subscribe(
      this.config.orchestratorId,
      'action_request' as any,
      this.handleActionRequest.bind(this)
    );

    // Subscribe to state changes
    bus.subscribe(
      this.config.orchestratorId,
      'state_change' as any,
      this.handleStateChange.bind(this)
    );
  }

  /**
   * Handle action request message
   */
  private async handleActionRequest(message: AgentMessage): Promise<void> {
    // Agent is requesting an action from orchestrator
    // In DM context, this might be a player action needing DM response
    const bus = getCommunicationBus();

    await bus.respond(message, {
      action: 'acknowledged',
      orchestratorState: this.state,
    });
  }

  /**
   * Handle state change message
   */
  private handleStateChange(message: AgentMessage): void {
    // Update internal state based on agent messages
    this.state = message.payload.newState as AgentState ?? this.state;
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
      case DS.OVERRIDE:
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Generate unique coordination ID
   */
  private generateCoordinationId(): string {
    return `coord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Generate unique decision ID
   */
  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Create an orchestrator instance
 */
export function createOrchestrator(config: OrchestratorConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}

/**
 * Get default orchestrator for a session
 */
export function getSessionOrchestrator(sessionId: string): AgentOrchestrator {
  const orchestratorId = `orchestrator_${sessionId}`;
  return new AgentOrchestrator({
    orchestratorId,
    sessionId,
  });
}
