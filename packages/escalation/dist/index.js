"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateCost = exports.createDecisionResult = exports.createContext = exports.EscalationEngine = exports.DEFAULT_COST_CONFIG = exports.DEFAULT_THRESHOLDS = exports.EscalationReasonEnum = exports.DecisionSource = void 0;
// Enums and constants (including EscalationReason which is both a type and value)
var types_js_1 = require("./types.js");
Object.defineProperty(exports, "DecisionSource", { enumerable: true, get: function () { return types_js_1.DecisionSource; } });
Object.defineProperty(exports, "EscalationReasonEnum", { enumerable: true, get: function () { return types_js_1.EscalationReason; } });
Object.defineProperty(exports, "DEFAULT_THRESHOLDS", { enumerable: true, get: function () { return types_js_1.DEFAULT_THRESHOLDS; } });
Object.defineProperty(exports, "DEFAULT_COST_CONFIG", { enumerable: true, get: function () { return types_js_1.DEFAULT_COST_CONFIG; } });
// Engine
var engine_js_1 = require("./engine.js");
Object.defineProperty(exports, "EscalationEngine", { enumerable: true, get: function () { return engine_js_1.EscalationEngine; } });
Object.defineProperty(exports, "createContext", { enumerable: true, get: function () { return engine_js_1.createContext; } });
Object.defineProperty(exports, "createDecisionResult", { enumerable: true, get: function () { return engine_js_1.createDecisionResult; } });
Object.defineProperty(exports, "estimateCost", { enumerable: true, get: function () { return engine_js_1.estimateCost; } });
