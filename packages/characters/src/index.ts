/**
 * StudyLoG.AI - Character System
 *
 * A personality-driven AI character system with hierarchical memory,
 * inspired by research from SuperInstance ai-character-integrations.
 *
 * @packageDocumentation
 */

// Personality system (Big Five traits)
export {
  Personality,
  PERSONALITY_PRESETS,
  isValidPersonality,
  personalityCompatibility,
  describeTrait,
  describePersonality,
  mutatePersonality,
  blendPersonalities,
} from './personality';

// Memory system (Hierarchical)
export {
  CharacterMemory,
  Memory,
  MemoryType,
  MemoryStats,
  CharacterNarrative,
  RetrievalOptions,
} from './memory';

// Character system
export {
  AICharacter,
  CharacterFactory,
  CharacterConfig,
  ScenarioType,
  DecisionSource,
  DecisionContext,
  DecisionResult,
  TeachingStyle,
  StudentContext,
  StudentRelationship,
  CharacterCapability,
} from './character';

// Re-export types for convenience
export type {
  Personality as PersonalityType,
  CharacterCapability as Capability,
  StudentRelationship as Relationship,
  DecisionContext as Context,
};
