"use strict";
/**
 * StudyLoG.AI - Escalation Engine Types
 *
 * Based on https://github.com/SuperInstance/escalation-engine
 * Adapted for StudyLoG.AI educational platform
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_COST_CONFIG = exports.DEFAULT_THRESHOLDS = exports.EscalationReason = exports.DecisionSource = void 0;
/**
 * Decision source - where the decision/response comes from
 * - BOT: Rule-based, deterministic, free (fast <10ms)
 * - BRAIN: Local LLM (Ollama), low cost (~100-500ms)
 * - HUMAN: Cloud API (Anthropic/OpenAI), higher cost (~500-2000ms)
 */
var DecisionSource;
(function (DecisionSource) {
    DecisionSource["BOT"] = "bot";
    DecisionSource["BRAIN"] = "brain";
    DecisionSource["HUMAN"] = "human";
    DecisionSource["OVERRIDE"] = "override";
})(DecisionSource || (exports.DecisionSource = DecisionSource = {}));
/**
 * Reason for escalation to a higher tier
 */
var EscalationReason;
(function (EscalationReason) {
    EscalationReason["LOW_CONFIDENCE"] = "low_confidence";
    EscalationReason["HIGH_STAKES"] = "high_stakes";
    EscalationReason["NOVEL_SITUATION"] = "novel_situation";
    EscalationReason["TIME_CRITICAL"] = "time_critical";
    EscalationReason["CONFLICTING_BOTS"] = "conflicting_bots";
    EscalationReason["SAFETY_CONCERN"] = "safety_concern";
    EscalationReason["CHARACTER_GROWTH"] = "character_growth";
    EscalationReason["PLAYER_REQUEST"] = "player_request";
    EscalationReason["COST_LIMIT"] = "cost_limit";
    EscalationReason["STUDENT_STUCK"] = "student_stuck";
    EscalationReason["NEW_CONCEPT"] = "new_concept";
})(EscalationReason || (exports.EscalationReason = EscalationReason = {}));
/**
 * Default escalation thresholds
 */
exports.DEFAULT_THRESHOLDS = {
    botMinConfidence: 0.7,
    brainMinConfidence: 0.5,
    highStakesThreshold: 0.7,
    criticalStakesThreshold: 0.9,
    urgentTimeMs: 500,
    criticalTimeMs: 100,
    noveltyThreshold: 0.6,
    resourceCriticalThreshold: 0.2,
    confidenceBoostPerSuccess: 0.05,
    confidencePenaltyPerFailure: 0.1,
};
/**
 * Default cost tracking configuration
 */
exports.DEFAULT_COST_CONFIG = {
    enabled: true,
    dailyBudget: 1.0,
    alertThreshold: 0.8,
    costBot: 0.0,
    costBrain: 0.001,
    costHuman: 0.02,
};
