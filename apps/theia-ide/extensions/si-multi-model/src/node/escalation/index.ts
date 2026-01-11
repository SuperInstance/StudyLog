/**
 * Escalation Integration for Multi-Model Router
 *
 * Public API exports
 */

export {
  EscalationModelRouter,
  createStaticRuleHandler,
  createKeywordRuleHandler,
} from './integration.js';

export type {
  EscalationRouteRequest,
  EscalationRouteResponse,
  ModelRouter,
} from './integration.js';
