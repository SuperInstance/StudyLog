/**
 * @studylog/character-sdk
 *
 * SDK-inspired character system for StudyLoG.AI.
 * Adapted from SuperInstance ai-character-sdk with educational extensions.
 *
 * @example
 * ```ts
 * import { Character } from '@studylog/character-sdk';
 *
 * const hero = new Character({
 *   name: 'Luna',
 *   characterClass: 'ranger',
 *   personality: { bravery: 0.8, curiosity: 0.9 },
 * });
 *
 * const response = await hero.think('A dragon appears!');
 * console.log(response.content);
 * ```
 *
 * @packageDocumentation
 */

// Version info
export const VERSION = '1.0.0';
export const SDK_NAME = '@studylog/character-sdk';

// Core exports
export * from './core/index.js';

// Memory system
export {
  HierarchicalMemory,
  createMemory,
} from './memory/index.js';

// Decision engine
export {
  DecisionEngine,
  createDecisionEngine,
} from './decision/index.js';

// Personality system
export {
  Personality,
  StudentPersonality,
  createPersonality,
  createStudentPersonality,
  DEFAULT_TRAITS,
} from './personality/index.js';

// Learning system
export {
  OutcomeTracker,
  createOutcomeTracker,
} from './learning/index.js';

// Re-export all types for convenience
export type {
  // Core types
  BaseCharacter,
  CharacterConfig,
  CharacterResponse,
  CharacterStats,
  ThoughtContext,
  ThinkHandler,
  ActHandler,
  CharacterState,

  // Memory types
  Memory,
  MemoryTier,
  ImportanceLevel,
  StudyMemory,
  MemoryStats,

  // Decision types
  DecisionTier,
  DecisionContext,
  DecisionRouting,
  EscalationReason,
  EscalationThresholds,

  // Personality types
  Trait,
  TraitCategory,
  PersonalityProfile,
  PersonalitySummary,
  LearningStyle,

  // Learning types
  OutcomeType,
  LearningSignal,
  LearningSummary,

  // Educational types
  MasteryLevel,
  StudentProfile,
  LessonResponse,
  Exercise,
  Visualization,
  PracticeResult,
};
