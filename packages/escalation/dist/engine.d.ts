/**
 * StudyLoG.AI - Escalation Engine
 *
 * Core escalation engine for intelligent decision routing.
 * Based on https://github.com/SuperInstance/escalation-engine
 *
 * Routes decisions through three tiers:
 * 1. BOT - Fast, rule-based, free
 * 2. BRAIN - Local LLM (Ollama), low cost
 * 3. HUMAN - Cloud API, higher cost
 */
import type { DecisionContext, DecisionResult, DecisionSource, EscalationDecision, EscalationReason, EscalationThresholds, StudentStats, DecisionStats, SituationPattern, LearningPhase } from './types.js';
/**
 * Main Escalation Engine class
 */
export declare class EscalationEngine {
    private thresholds;
    private decisionHistory;
    private decisionsByStudent;
    private situationPatterns;
    private stats;
    private enableLearning;
    constructor(config?: {
        enableLearning?: boolean;
    });
    /**
     * Get thresholds for a student, creating defaults if needed
     */
    getThresholds(studentId: string): EscalationThresholds;
    /**
     * Set custom thresholds for a student
     */
    setThresholds(studentId: string, thresholds: Partial<EscalationThresholds>): void;
    /**
     * Set thresholds based on learning phase
     */
    setPhaseThresholds(phase: LearningPhase, thresholds: Partial<EscalationThresholds>): void;
    /**
     * Get thresholds for a specific phase
     */
    private getThresholdsForContext;
    /**
     * Route a decision to the appropriate source
     */
    routeDecision(context: DecisionContext): EscalationDecision;
    /**
     * Check for critical situations that override normal routing
     */
    private checkCriticalOverride;
    /**
     * Determine if a situation is novel (unseen or rare)
     */
    private isNovelSituation;
    /**
     * Determine if a decision should be escalated to next level
     */
    shouldEscalate(result: DecisionResult, context: DecisionContext): [boolean, EscalationReason | null];
    /**
     * Record a decision for history and learning
     */
    recordDecision(result: DecisionResult): void;
    /**
     * Record the outcome of a decision for learning
     */
    recordOutcome(decisionId: string, success: boolean, outcomeDetails?: Record<string, unknown>): void;
    /**
     * Update student thresholds based on decision outcome
     */
    private updateThresholds;
    /**
     * Get decision statistics for a student
     */
    getStudentStats(studentId: string): StudentStats;
    /**
     * Get global decision statistics
     */
    getGlobalStats(): DecisionStats;
    /**
     * Create a unique decision ID
     */
    createDecisionId(): string;
    /**
     * Reset all statistics
     */
    resetStats(): void;
    /**
     * Create empty stats object
     */
    private createEmptyStats;
    /**
     * Get decision history
     */
    getHistory(): ReadonlyArray<DecisionResult>;
    /**
     * Get situation patterns
     */
    getPatterns(): Map<string, SituationPattern>;
    /**
     * Clear old patterns (for memory management)
     */
    clearOldPatterns(olderThanMs?: number): void;
}
/**
 * Create a decision context with sensible defaults
 */
export declare function createContext(studentId: string, situationType: string, situationDescription: string, partialContext?: Partial<DecisionContext>): DecisionContext;
/**
 * Create a decision result with sensible defaults
 */
export declare function createDecisionResult(source: DecisionSource, action: string, confidence: number, partialResult?: Partial<DecisionResult>): DecisionResult;
/**
 * Estimate cost for a decision source
 */
export declare function estimateCost(source: DecisionSource): number;
