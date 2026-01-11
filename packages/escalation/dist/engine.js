"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscalationEngine = void 0;
exports.createContext = createContext;
exports.createDecisionResult = createDecisionResult;
exports.estimateCost = estimateCost;
const uuid_1 = require("uuid");
const types_js_1 = require("./types.js");
/**
 * Main Escalation Engine class
 */
class EscalationEngine {
    thresholds;
    decisionHistory = [];
    decisionsByStudent = new Map();
    situationPatterns = new Map();
    stats;
    enableLearning;
    constructor(config) {
        this.thresholds = new Map();
        this.enableLearning = config?.enableLearning ?? true;
        this.stats = this.createEmptyStats();
    }
    /**
     * Get thresholds for a student, creating defaults if needed
     */
    getThresholds(studentId) {
        if (!this.thresholds.has(studentId)) {
            this.thresholds.set(studentId, { ...types_js_1.DEFAULT_THRESHOLDS });
        }
        return this.thresholds.get(studentId);
    }
    /**
     * Set custom thresholds for a student
     */
    setThresholds(studentId, thresholds) {
        const current = this.getThresholds(studentId);
        this.thresholds.set(studentId, { ...current, ...thresholds });
    }
    /**
     * Set thresholds based on learning phase
     */
    setPhaseThresholds(phase, thresholds) {
        // Store phase-specific thresholds with special key
        this.thresholds.set(`phase:${phase}`, { ...types_js_1.DEFAULT_THRESHOLDS, ...thresholds });
    }
    /**
     * Get thresholds for a specific phase
     */
    getThresholdsForContext(context) {
        // Check for phase-specific thresholds first
        const phaseKey = `phase:${context.currentPhase}`;
        const phaseThresholds = this.thresholds.get(phaseKey);
        // Get student-specific thresholds
        const studentThresholds = this.getThresholds(context.studentId);
        // Merge: phase thresholds override student thresholds
        return {
            ...studentThresholds,
            ...(phaseThresholds || {}),
        };
    }
    /**
     * Route a decision to the appropriate source
     */
    routeDecision(context) {
        const startTime = Date.now();
        const thresholds = this.getThresholdsForContext(context);
        // Check for critical overrides first
        const criticalOverride = this.checkCriticalOverride(context, thresholds);
        if (criticalOverride) {
            return {
                ...criticalOverride,
                metadata: {
                    ...criticalOverride.metadata,
                    routingTimeMs: Date.now() - startTime,
                },
            };
        }
        // Check if situation is novel
        const isNovel = this.isNovelSituation(context, thresholds);
        // Check stakes level
        const isHighStakes = context.stakes >= thresholds.highStakesThreshold;
        const isCriticalStakes = context.stakes >= thresholds.criticalStakesThreshold;
        // Check urgency
        const isUrgent = context.urgencyMs !== undefined && context.urgencyMs <= thresholds.urgentTimeMs;
        const isTimeCritical = context.urgencyMs !== undefined && context.urgencyMs <= thresholds.criticalTimeMs;
        // Determine routing
        let decision;
        // Critical situations -> Human
        if (isCriticalStakes || isTimeCritical) {
            decision = {
                source: types_js_1.DecisionSource.HUMAN,
                reason: isCriticalStakes
                    ? types_js_1.EscalationReason.HIGH_STAKES
                    : types_js_1.EscalationReason.TIME_CRITICAL,
                confidenceRequired: 0.9,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // Novel situations with high stakes -> Brain (or Human if very high)
        else if (isNovel && isHighStakes) {
            decision = {
                source: isCriticalStakes ? types_js_1.DecisionSource.HUMAN : types_js_1.DecisionSource.BRAIN,
                reason: types_js_1.EscalationReason.NOVEL_SITUATION,
                confidenceRequired: thresholds.brainMinConfidence,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // Novel situations with low stakes -> Brain
        else if (isNovel) {
            decision = {
                source: types_js_1.DecisionSource.BRAIN,
                reason: types_js_1.EscalationReason.NEW_CONCEPT,
                confidenceRequired: thresholds.brainMinConfidence,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // High stakes but familiar -> Brain
        else if (isHighStakes) {
            decision = {
                source: types_js_1.DecisionSource.BRAIN,
                reason: types_js_1.EscalationReason.HIGH_STAKES,
                confidenceRequired: thresholds.brainMinConfidence + 0.1,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // Urgent but familiar -> Bot (fast response)
        else if (isUrgent) {
            decision = {
                source: types_js_1.DecisionSource.BOT,
                reason: undefined,
                confidenceRequired: thresholds.botMinConfidence - 0.1,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // Routine situation -> Bot
        else {
            decision = {
                source: types_js_1.DecisionSource.BOT,
                reason: undefined,
                confidenceRequired: thresholds.botMinConfidence,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: {},
            };
        }
        // Add metadata
        decision.metadata = {
            isNovel,
            isHighStakes,
            isCriticalStakes,
            isUrgent,
            isTimeCritical,
            routingTimeMs: Date.now() - startTime,
            currentPhase: context.currentPhase,
        };
        return decision;
    }
    /**
     * Check for critical situations that override normal routing
     */
    checkCriticalOverride(context, thresholds) {
        // Check for stuck student (recent failures)
        if (context.recentFailures >= 3) {
            return {
                source: types_js_1.DecisionSource.BRAIN,
                reason: types_js_1.EscalationReason.STUDENT_STUCK,
                confidenceRequired: 0.8,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: { recentFailures: context.recentFailures },
            };
        }
        // Check for low progress (beginner student)
        if (context.progressRatio <= thresholds.resourceCriticalThreshold) {
            return {
                source: types_js_1.DecisionSource.BRAIN,
                reason: types_js_1.EscalationReason.SAFETY_CONCERN,
                confidenceRequired: 0.75,
                timeBudgetMs: context.urgencyMs,
                allowFallback: true,
                metadata: { lowProgress: true },
            };
        }
        return null;
    }
    /**
     * Determine if a situation is novel (unseen or rare)
     */
    isNovelSituation(context, thresholds) {
        const situationKey = `${context.studentId}:${context.situationType}`;
        if (!this.situationPatterns.has(situationKey)) {
            this.situationPatterns.set(situationKey, {
                situationType: context.situationType,
                patterns: [],
                lastSeen: Date.now(),
            });
        }
        const pattern = this.situationPatterns.get(situationKey);
        pattern.lastSeen = Date.now();
        // If we haven't seen many similar situations, it's novel
        if (pattern.patterns.length < 5) {
            // Store pattern
            if (pattern.patterns.length < 20) {
                pattern.patterns.push(context.situationDescription.slice(0, 100));
            }
            return true;
        }
        // Check similarity using word overlap
        const descriptionWords = new Set(context.situationDescription.toLowerCase().split(/\s+/));
        let maxSimilarity = 0;
        for (const existingPattern of pattern.patterns) {
            const patternWords = new Set(existingPattern.toLowerCase().split(/\s+/));
            if (patternWords.size === 0)
                continue;
            const commonWords = new Set([...descriptionWords].filter((x) => patternWords.has(x)));
            const similarity = commonWords.size / patternWords.size;
            maxSimilarity = Math.max(maxSimilarity, similarity);
        }
        // If max similarity is low, situation is novel
        const isNovel = maxSimilarity < 1 - thresholds.noveltyThreshold;
        // Store pattern if novel or we haven't collected many
        if (isNovel && pattern.patterns.length < 20) {
            pattern.patterns.push(context.situationDescription.slice(0, 100));
        }
        return isNovel;
    }
    /**
     * Determine if a decision should be escalated to next level
     */
    shouldEscalate(result, context) {
        const thresholds = this.getThresholds(context.studentId);
        // Already from human, can't escalate further
        if (result.source === types_js_1.DecisionSource.HUMAN) {
            return [false, null];
        }
        // Check confidence
        if (result.source === types_js_1.DecisionSource.BOT) {
            if (result.confidence < thresholds.botMinConfidence) {
                return [true, types_js_1.EscalationReason.LOW_CONFIDENCE];
            }
        }
        else if (result.source === types_js_1.DecisionSource.BRAIN) {
            if (result.confidence < thresholds.brainMinConfidence) {
                return [true, types_js_1.EscalationReason.LOW_CONFIDENCE];
            }
        }
        // Check if stakes warrant escalation
        if (context.stakes >= thresholds.criticalStakesThreshold) {
            if (result.source === types_js_1.DecisionSource.BOT) {
                return [true, types_js_1.EscalationReason.HIGH_STAKES];
            }
        }
        return [false, null];
    }
    /**
     * Record a decision for history and learning
     */
    recordDecision(result) {
        // Add to history
        this.decisionHistory.push(result);
        // Add to student history
        const studentId = result.metadata?.studentId;
        if (studentId) {
            if (!this.decisionsByStudent.has(studentId)) {
                this.decisionsByStudent.set(studentId, []);
            }
            this.decisionsByStudent.get(studentId).push(result);
        }
        // Update stats
        this.stats.totalDecisions++;
        switch (result.source) {
            case types_js_1.DecisionSource.BOT:
                this.stats.botDecisions++;
                break;
            case types_js_1.DecisionSource.BRAIN:
                this.stats.brainDecisions++;
                break;
            case types_js_1.DecisionSource.HUMAN:
                this.stats.humanDecisions++;
                break;
        }
        if (result.escalatedFrom !== undefined) {
            this.stats.escalations++;
        }
        if (this.stats.totalDecisions > 0) {
            this.stats.escalationRate = this.stats.escalations / this.stats.totalDecisions;
        }
        this.stats.totalCost += result.costEstimate;
    }
    /**
     * Record the outcome of a decision for learning
     */
    recordOutcome(decisionId, success, outcomeDetails) {
        if (!this.enableLearning)
            return;
        const result = this.decisionHistory.find((d) => d.decisionId === decisionId);
        if (!result) {
            // eslint-disable-next-line no-console
            console.warn(`Decision ${decisionId} not found for outcome recording`);
            return;
        }
        result.success = success;
        // Update thresholds based on outcome
        const studentId = result.metadata?.studentId;
        if (studentId) {
            this.updateThresholds(studentId, result, success);
        }
        // Update recent failures count for context tracking
        if (outcomeDetails?.recentFailures !== undefined) {
            // Could update some state here
        }
    }
    /**
     * Update student thresholds based on decision outcome
     */
    updateThresholds(studentId, result, success) {
        const thresholds = this.getThresholds(studentId);
        // Adjust confidence thresholds based on success
        if (result.source === types_js_1.DecisionSource.BOT) {
            if (success) {
                thresholds.botMinConfidence = Math.max(0.5, thresholds.botMinConfidence - thresholds.confidenceBoostPerSuccess);
            }
            else {
                thresholds.botMinConfidence = Math.min(0.9, thresholds.botMinConfidence + thresholds.confidencePenaltyPerFailure);
            }
        }
        else if (result.source === types_js_1.DecisionSource.BRAIN) {
            if (success) {
                thresholds.brainMinConfidence = Math.max(0.3, thresholds.brainMinConfidence - thresholds.confidenceBoostPerSuccess);
            }
            else {
                thresholds.brainMinConfidence = Math.min(0.8, thresholds.brainMinConfidence + thresholds.confidencePenaltyPerFailure);
            }
        }
    }
    /**
     * Get decision statistics for a student
     */
    getStudentStats(studentId) {
        const decisions = this.decisionsByStudent.get(studentId) || [];
        const botDecisions = decisions.filter((d) => d.source === types_js_1.DecisionSource.BOT).length;
        const brainDecisions = decisions.filter((d) => d.source === types_js_1.DecisionSource.BRAIN).length;
        const humanDecisions = decisions.filter((d) => d.source === types_js_1.DecisionSource.HUMAN).length;
        const escalations = decisions.filter((d) => d.escalatedFrom !== undefined).length;
        const successes = decisions.filter((d) => d.success === true).length;
        const failures = decisions.filter((d) => d.success === false).length;
        const avgConfidence = decisions.length > 0
            ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
            : 0;
        const avgTimeMs = decisions.length > 0
            ? decisions.reduce((sum, d) => sum + d.timeTakenMs, 0) / decisions.length
            : 0;
        const totalCost = decisions.reduce((sum, d) => sum + d.costEstimate, 0);
        return {
            studentId,
            totalDecisions: decisions.length,
            botDecisions,
            brainDecisions,
            humanDecisions,
            escalations,
            escalationRate: decisions.length > 0 ? escalations / decisions.length : 0,
            successes,
            failures,
            successRate: successes + failures > 0 ? successes / (successes + failures) : 0,
            avgConfidence,
            avgTimeMs,
            totalCost,
        };
    }
    /**
     * Get global decision statistics
     */
    getGlobalStats() {
        // Update computed stats
        if (this.stats.totalDecisions > 0) {
            this.stats.avgConfidence =
                this.decisionHistory.reduce((sum, d) => sum + d.confidence, 0) / this.stats.totalDecisions;
        }
        // Calculate cost savings (assume all human = baseline)
        const baselineCost = this.stats.totalDecisions * types_js_1.DEFAULT_COST_CONFIG.costHuman;
        this.stats.costSavings = baselineCost - this.stats.totalCost;
        // Cost reduction ratio: baseline/actual (higher is better)
        // When actual cost is 0, we can't divide, but the savings is 100%
        if (this.stats.totalCost > 0) {
            this.stats.costReductionRatio = baselineCost / this.stats.totalCost;
        }
        else if (baselineCost > 0) {
            // All decisions were free (100% savings)
            this.stats.costReductionRatio = Infinity;
        }
        else {
            this.stats.costReductionRatio = 0;
        }
        return { ...this.stats };
    }
    /**
     * Create a unique decision ID
     */
    createDecisionId() {
        return (0, uuid_1.v4)();
    }
    /**
     * Reset all statistics
     */
    resetStats() {
        this.stats = this.createEmptyStats();
        this.decisionHistory = [];
        this.decisionsByStudent.clear();
    }
    /**
     * Create empty stats object
     */
    createEmptyStats() {
        return {
            totalDecisions: 0,
            botDecisions: 0,
            brainDecisions: 0,
            humanDecisions: 0,
            escalations: 0,
            escalationRate: 0,
            avgConfidence: 0,
            totalCost: 0,
            costSavings: 0,
            costReductionRatio: 0,
        };
    }
    /**
     * Get decision history
     */
    getHistory() {
        return this.decisionHistory;
    }
    /**
     * Get situation patterns
     */
    getPatterns() {
        return this.situationPatterns;
    }
    /**
     * Clear old patterns (for memory management)
     */
    clearOldPatterns(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - olderThanMs;
        for (const [key, pattern] of this.situationPatterns.entries()) {
            if (pattern.lastSeen < cutoff) {
                this.situationPatterns.delete(key);
            }
        }
    }
}
exports.EscalationEngine = EscalationEngine;
/**
 * Create a decision context with sensible defaults
 */
function createContext(studentId, situationType, situationDescription, partialContext) {
    return {
        studentId,
        situationType,
        situationDescription,
        stakes: 0.5,
        progressRatio: 0.5,
        availableResources: {},
        similarDecisionsCount: 0,
        recentFailures: 0,
        currentPhase: 'cognitive-mill',
        timestamp: Date.now(),
        ...partialContext,
    };
}
/**
 * Create a decision result with sensible defaults
 */
function createDecisionResult(source, action, confidence, partialResult) {
    return {
        decisionId: (0, uuid_1.v4)(),
        source,
        action,
        confidence,
        timeTakenMs: 0,
        costEstimate: 0,
        ...partialResult,
    };
}
/**
 * Estimate cost for a decision source
 */
function estimateCost(source) {
    switch (source) {
        case types_js_1.DecisionSource.BOT:
            return types_js_1.DEFAULT_COST_CONFIG.costBot;
        case types_js_1.DecisionSource.BRAIN:
            return types_js_1.DEFAULT_COST_CONFIG.costBrain;
        case types_js_1.DecisionSource.HUMAN:
            return types_js_1.DEFAULT_COST_CONFIG.costHuman;
        default:
            return 0;
    }
}
