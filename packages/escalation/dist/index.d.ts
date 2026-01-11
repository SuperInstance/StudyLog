/**
 * StudyLoG.AI - Escalation Engine
 *
 * Intelligent decision routing for cost-optimized AI usage.
 *
 * @example
 * ```ts
 * import { EscalationEngine, createContext } from '@studylog/escalation';
 *
 * const engine = new EscalationEngine();
 *
 * const context = createContext('student-123', 'coding', 'How do I write a loop?', {
 *   stakes: 0.3,
 *   similarDecisionsCount: 10,
 * });
 *
 * const decision = engine.routeDecision(context);
 * console.log(`Route to: ${decision.source}`); // BOT, BRAIN, or HUMAN
 *
 * // Record the decision
 * const result = createDecisionResult(decision.source, 'Provide loop example', 0.9, {
 *   timeTakenMs: 50,
 *   costEstimate: estimateCost(decision.source),
 *   metadata: { studentId: context.studentId },
 * });
 *
 * engine.recordDecision(result);
 *
 * // Later, record outcome
 * engine.recordOutcome(result.decisionId, true);
 * ```
 */
export type { DecisionContext, DecisionResult, DecisionStats, EscalationDecision, EscalationThresholds, LearningPhase, SituationPattern, StudentStats, } from './types.js';
export { DecisionSource, EscalationReason as EscalationReasonEnum, DEFAULT_THRESHOLDS, DEFAULT_COST_CONFIG } from './types.js';
export type EscalationReason = import('./types.js').EscalationReason;
export { EscalationEngine, createContext, createDecisionResult, estimateCost, } from './engine.js';
