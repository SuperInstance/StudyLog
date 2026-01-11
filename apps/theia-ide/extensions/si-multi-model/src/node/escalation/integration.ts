/**
 * Escalation Integration for Multi-Model Router
 *
 * Integrates the Escalation Engine with StudyLoG.AI's Multi-Model Router
 * to provide intelligent decision routing with cost optimization.
 *
 * @example
 * ```ts
 * const escalationRouter = new EscalationModelRouter(modelRouter);
 *
 * const response = await escalationRouter.route({
 *   studentId: 'student-123',
 *   situationType: 'coding',
 *   message: 'How do I write a loop?',
 *   stakes: 0.3,
 *   currentPhase: 'cognitive-mill',
 * });
 * ```
 */

import type {
  DecisionContext as EscalationContext,
  DecisionResult as EscalationResult,
  DecisionSource,
  EscalationDecision,
  LearningPhase,
} from '@studylog/escalation';
import {
  EscalationEngine,
  createContext as createEscalationContext,
  createDecisionResult as createEscalationResult,
  estimateCost,
  DecisionSource as EscalationSource,
} from '@studylog/escalation';

/**
 * Request interface for escalation-aware routing
 */
export interface EscalationRouteRequest {
  /** Student/user ID */
  studentId: string;
  /** Type of situation */
  situationType: string;
  /** Message/prompt for the model */
  message: string;
  /** Importance level (0-1) */
  stakes?: number;
  /** Time available (ms) */
  urgencyMs?: number;
  /** Student's progress (0-1) */
  progressRatio?: number;
  /** Available resources */
  availableResources?: Record<string, number>;
  /** Number of similar attempts */
  similarDecisionsCount?: number;
  /** Recent failures count */
  recentFailures?: number;
  /** Current learning phase */
  currentPhase?: LearningPhase;
  /** Preferred model (optional, escalation may override) */
  preferredModel?: string;
  /** Preferred provider (optional, escalation may override) */
  preferredProvider?: string;
  /** Additional context data */
  customData?: Record<string, unknown>;
}

/**
 * Response interface with escalation metadata
 */
export interface EscalationRouteResponse {
  /** The response content */
  content: string;
  /** Which model was used */
  model: string;
  /** Which provider was used */
  provider: string;
  /** Actual decision source used */
  source: DecisionSource;
  /** Escalation decision details */
  escalationDecision: EscalationDecision;
  /** Cost of this request */
  cost: number;
  /** Tokens used */
  tokens: { input: number; output: number };
  /** Time taken */
  timeTakenMs: number;
}

/**
 * Model router interface (for dependency injection)
 */
export interface ModelRouter {
  route(request: {
    message: string;
    model?: string;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
    finishReason: string;
  }>;
}

/**
 * Escalation-aware model router
 *
 * Wraps the existing ModelRouter with escalation logic to optimize
 * when to use expensive cloud models vs cheap/free alternatives.
 */
export class EscalationModelRouter {
  private escalationEngine: EscalationEngine;
  private modelRouter: ModelRouter;
  private ruleHandlers: Map<string, (request: EscalationRouteRequest) => string> = new Map();

  constructor(modelRouter: ModelRouter, config?: { enableLearning?: boolean }) {
    this.escalationEngine = new EscalationEngine(config);
    this.modelRouter = modelRouter;

    // Set up default phase-specific thresholds
    this.setupPhaseThresholds();
  }

  /**
   * Route a request with escalation-aware logic
   */
  async route(request: EscalationRouteRequest): Promise<EscalationRouteResponse> {
    const startTime = Date.now();

    // Create escalation context
    const context: EscalationContext = createEscalationContext(
      request.studentId,
      request.situationType,
      request.message,
      {
        stakes: request.stakes ?? 0.5,
        urgencyMs: request.urgencyMs,
        progressRatio: request.progressRatio ?? 0.5,
        availableResources: request.availableResources ?? {},
        similarDecisionsCount: request.similarDecisionsCount ?? 0,
        recentFailures: request.recentFailures ?? 0,
        currentPhase: request.currentPhase ?? 'cognitive-mill',
        customData: request.customData,
      }
    );

    // Get escalation decision
    const escalationDecision = this.escalationEngine.routeDecision(context);

    // Execute based on source
    const response = await this.executeDecision(request, escalationDecision);

    const timeTaken = Date.now() - startTime;

    // Record the decision
    const result: EscalationResult = createEscalationResult(
      escalationDecision.source,
      response.content,
      0.8, // Would be calculated from actual response
      {
        timeTakenMs: timeTaken,
        costEstimate: response.cost,
        metadata: {
          studentId: request.studentId,
          situationType: request.situationType,
          model: response.model,
          provider: response.provider,
        },
      }
    );

    this.escalationEngine.recordDecision(result);

    return {
      content: response.content,
      model: response.model,
      provider: response.provider,
      source: escalationDecision.source,
      escalationDecision,
      cost: response.cost,
      tokens: response.tokens,
      timeTakenMs: timeTaken,
    };
  }

  /**
   * Execute a decision based on the escalation source
   */
  private async executeDecision(
    request: EscalationRouteRequest,
    decision: EscalationDecision
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
  }> {
    switch (decision.source) {
      case EscalationSource.BOT:
        return await this.handleBot(request, decision);
      case EscalationSource.BRAIN:
        return await this.handleBrain(request, decision);
      case EscalationSource.HUMAN:
        return await this.handleHuman(request, decision);
      default:
        return await this.handleHuman(request, decision);
    }
  }

  /**
   * Handle BOT-level decisions (rule-based, free)
   */
  private async handleBot(
    request: EscalationRouteRequest,
    decision: EscalationDecision
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
  }> {
    // Check for custom rule handler
    const handler = this.ruleHandlers.get(request.situationType);
    if (handler) {
      return {
        content: handler(request),
        model: 'rule-based',
        provider: 'bot',
        cost: 0,
        tokens: { input: 0, output: 0 },
      };
    }

    // Default rule-based responses for common situations
    const content = this.getRuleBasedResponse(request);

    return {
      content,
      model: 'rule-based',
      provider: 'bot',
      cost: 0,
      tokens: { input: 0, output: 0 },
    };
  }

  /**
   * Handle BRAIN-level decisions (local LLM)
   */
  private async handleBrain(
    request: EscalationRouteRequest,
    decision: EscalationDecision
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
  }> {
    // Use local Ollama
    try {
      const response = await this.modelRouter.route({
        message: request.message,
        provider: request.preferredProvider ?? 'ollama',
        model: request.preferredModel ?? 'llama3.2',
        temperature: 0.7,
        maxTokens: 1024,
      });

      return {
        content: response.content,
        model: response.model,
        provider: response.provider,
        cost: response.cost,
        tokens: response.tokens,
      };
    } catch (error) {
      // Fallback to human if brain fails
      console.error('[EscalationRouter] Brain provider failed, escalating to human:', error);
      return await this.handleHuman(request, decision);
    }
  }

  /**
   * Handle HUMAN-level decisions (cloud API)
   */
  private async handleHuman(
    request: EscalationRouteRequest,
    _decision: EscalationDecision
  ): Promise<{
    content: string;
    model: string;
    provider: string;
    cost: number;
    tokens: { input: number; output: number };
  }> {
    // Use best available cloud model
    const preferredProvider = request.preferredProvider ?? 'anthropic';
    const preferredModel = request.preferredModel ?? 'claude-opus-4-5';

    const response = await this.modelRouter.route({
      message: request.message,
      provider: preferredProvider,
      model: preferredModel,
      temperature: 0.7,
      maxTokens: 4096,
    });

    return {
      content: response.content,
      model: response.model,
      provider: response.provider,
      cost: response.cost,
      tokens: response.tokens,
    };
  }

  /**
   * Get rule-based response for common situations
   */
  private getRuleBasedResponse(request: EscalationRouteRequest): string {
    const message = request.message.toLowerCase();

    // FAQ-style responses
    if (request.situationType === 'faq') {
      if (message.includes('password') || message.includes('login')) {
        return 'To reset your password, go to Settings > Account > Reset Password. You will receive an email with instructions.';
      }
      if (message.includes('cost') || message.includes('price')) {
        return 'StudyLoG.AI offers a free tier with limited AI usage. Premium tiers start at $9.99/month for unlimited access.';
      }
    }

    // Coding help - basic responses
    if (request.situationType === 'coding') {
      if (message.includes('loop') || message.includes('iterate')) {
        return 'A loop is a programming construct that repeats a block of code. Common types include: for loops (iterate a set number of times), while loops (iterate while a condition is true), and for-each loops (iterate over collections). Would you like a specific example?';
      }
      if (message.includes('function') || message.includes('method')) {
        return 'A function is a reusable block of code that performs a specific task. It takes inputs (parameters), processes them, and returns an output. Functions help organize code and avoid repetition.';
      }
      if (message.includes('variable') || message.includes('declare')) {
        return 'A variable is a named storage location in memory. To declare one, specify the type and name: `let myVariable = 5;` in TypeScript/JavaScript.';
      }
    }

    // Default response
    return 'I understand you need help with: ' + request.message + '. For more detailed assistance, I can connect you to a more advanced AI helper. Would you like me to do that?';
  }

  /**
   * Register a custom rule handler for a situation type
   */
  registerRuleHandler(situationType: string, handler: (request: EscalationRouteRequest) => string): void {
    this.ruleHandlers.set(situationType, handler);
  }

  /**
   * Record an outcome for learning
   */
  recordOutcome(decisionId: string, success: boolean): void {
    this.escalationEngine.recordOutcome(decisionId, success);
  }

  /**
   * Get student statistics
   */
  getStudentStats(studentId: string) {
    return this.escalationEngine.getStudentStats(studentId);
  }

  /**
   * Get global statistics
   */
  getGlobalStats() {
    return this.escalationEngine.getGlobalStats();
  }

  /**
   * Set custom thresholds for a student
   */
  setStudentThresholds(studentId: string, thresholds: {
    botMinConfidence?: number;
    brainMinConfidence?: number;
    highStakesThreshold?: number;
  }): void {
    this.escalationEngine.setThresholds(studentId, thresholds);
  }

  /**
   * Set up phase-specific thresholds
   */
  private setupPhaseThresholds(): void {
    // Cognitive Mill - Learning phase, more escalation to better models
    this.escalationEngine.setPhaseThresholds('cognitive-mill', {
      botMinConfidence: 0.8, // Require high confidence for bot
      brainMinConfidence: 0.6,
      highStakesThreshold: 0.6, // Lower threshold for high stakes
      noveltyThreshold: 0.5, // More sensitive to novelty
    });

    // Intelligence Ranch - Practice phase, can use cheaper models
    this.escalationEngine.setPhaseThresholds('intelligence-ranch', {
      botMinConfidence: 0.6, // More willing to use bot
      brainMinConfidence: 0.4,
      highStakesThreshold: 0.8,
      noveltyThreshold: 0.7, // Less sensitive to novelty
    });

    // Sitka Sound - Multi-agent simulation, balanced approach
    this.escalationEngine.setPhaseThresholds('sitka-sound', {
      botMinConfidence: 0.7,
      brainMinConfidence: 0.5,
      highStakesThreshold: 0.7,
      noveltyThreshold: 0.6,
    });
  }

  /**
   * Get the underlying escalation engine
   */
  getEscalationEngine(): EscalationEngine {
    return this.escalationEngine;
  }
}

/**
 * Create a rule handler that returns a static response
 */
export function createStaticRuleHandler(response: string): (request: EscalationRouteRequest) => string {
  return () => response;
}

/**
 * Create a rule handler that matches keywords to responses
 */
export function createKeywordRuleHandler(
  mappings: Record<string, string>
): (request: EscalationRouteRequest) => string {
  return (request) => {
    const message = request.message.toLowerCase();
    for (const [keyword, response] of Object.entries(mappings)) {
      if (message.includes(keyword.toLowerCase())) {
        return response;
      }
    }
    return 'I understand you need help. Let me connect you with more advanced assistance.';
  };
}
