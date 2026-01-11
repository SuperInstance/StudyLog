/**
 * Personality System - Trait-based Behavior Modification
 *
 * Manages personality traits and their influence on character behavior.
 * Adapted from SuperInstance ai-character-sdk with educational extensions.
 */

import type {
  Trait,
  TraitCategory,
  PersonalityProfile,
  PersonalitySummary,
  LearningStyle,
  CharacterResponse,
} from '../core/types.js';

/**
 * Default trait definitions with categories
 */
export const DEFAULT_TRAITS: Record<string, { category: TraitCategory; description: string }> = {
  // Social traits
  charisma: { category: 'social' as TraitCategory, description: 'Ability to charm and persuade' },
  kindness: { category: 'social' as TraitCategory, description: 'Tendency to help others' },
  empathy: { category: 'social' as TraitCategory, description: 'Understanding others\' feelings' },
  diplomacy: { category: 'social' as TraitCategory, description: 'Skill in resolving conflicts' },
  loyalty: { category: 'social' as TraitCategory, description: 'Faithfulness to allies' },

  // Intellectual traits
  intelligence: { category: 'intellectual' as TraitCategory, description: 'Mental acuity' },
  curiosity: { category: 'intellectual' as TraitCategory, description: 'Desire to learn' },
  wisdom: { category: 'intellectual' as TraitCategory, description: 'Accumulated knowledge' },
  caution: { category: 'intellectual' as TraitCategory, description: 'Carefulness in decisions' },
  cunning: { category: 'intellectual' as TraitCategory, description: 'Clever problem-solving' },

  // Emotional traits
  bravery: { category: 'emotional' as TraitCategory, description: 'Courage in facing fear' },
  optimism: { category: 'emotional' as TraitCategory, description: 'Positive outlook' },
  patience: { category: 'emotional' as TraitCategory, description: 'Ability to wait' },
  humor: { category: 'emotional' as TraitCategory, description: 'Tendency to joke' },
  aggression: { category: 'emotional' as TraitCategory, description: 'Tendency toward hostility' },

  // Moral traits
  honor: { category: 'moral' as TraitCategory, description: 'Adherence to principles' },
  justice: { category: 'moral' as TraitCategory, description: 'Fairness and equity' },
  honesty: { category: 'moral' as TraitCategory, description: 'Truthfulness' },
  devotion: { category: 'moral' as TraitCategory, description: 'Commitment to beliefs' },
  mercy: { category: 'moral' as TraitCategory, description: 'Willingness to forgive' },

  // Behavioral traits
  initiative: { category: 'behavioral' as TraitCategory, description: 'Tendency to act first' },
  discipline: { category: 'behavioral' as TraitCategory, description: 'Self-control' },
  ambition: { category: 'behavioral' as TraitCategory, description: 'Drive for achievement' },
  independence: { category: 'behavioral' as TraitCategory, description: 'Self-reliance' },
  adaptability: { category: 'behavioral' as TraitCategory, description: 'Flexibility in change' },

  // StudyLoG.AI: Learning-specific traits
  persistence: { category: 'learning' as TraitCategory, description: 'Continuing despite difficulty' },
  creativity: { category: 'learning' as TraitCategory, description: 'Generating novel solutions' },
  focus: { category: 'learning' as TraitCategory, description: 'Sustained attention' },
  collaboration: { category: 'learning' as TraitCategory, description: 'Working well with others' },
  reflection: { category: 'learning' as TraitCategory, description: 'Thinking about learning' },
};

/**
 * Trait history for tracking changes
 */
interface TraitHistory {
  [trait: string]: number[];
}

/**
 * Personality class
 *
 * Manages traits and their effects on character behavior.
 *
 * @example
 * ```ts
 * const personality = new Personality({
 *   curiosity: 0.9,
 *   persistence: 0.8,
 *   creativity: 0.7,
 * });
 *
 * personality.setTrait('bravery', 0.9);
 * personality.modifyTrait('curiosity', 0.1); // Increase by 0.1
 *
 * const dominant = personality.getDominantTrait(0.6);
 * console.log(dominant); // ['curiosity', 1.0]
 * ```
 */
export class Personality {
  readonly traits: Record<string, number>;
  readonly profile: PersonalityProfile;
  private readonly traitHistory: TraitHistory;

  constructor(
    traits: Record<string, number> = {},
    profile: Partial<PersonalityProfile> = {}
  ) {
    this.traits = { ...traits };
    this.profile = {
      characterClass: profile.characterClass ?? '',
      description: profile.description ?? '',
      quirks: profile.quirks ?? [],
      virtues: profile.virtues ?? [],
      vices: profile.vices ?? [],
      learningStyle: profile.learningStyle,
    };
    this.traitHistory = {};

    // Initialize history
    for (const [trait, value] of Object.entries(this.traits)) {
      this.traitHistory[trait] = [value];
    }
  }

  /**
   * Set a trait value (clamped to 0-1)
   */
  setTrait(trait: string, value: number): void {
    const clampedValue = Math.max(0, Math.min(1, value));
    this.traits[trait] = clampedValue;

    if (!this.traitHistory[trait]) {
      this.traitHistory[trait] = [];
    }
    this.traitHistory[trait].push(clampedValue);
  }

  /**
   * Get a trait value, returning default if not set
   */
  getTrait(trait: string, defaultValue = 0.5): number {
    return this.traits[trait] ?? defaultValue;
  }

  /**
   * Modify a trait by delta amount (clamped to 0-1)
   */
  modifyTrait(trait: string, delta: number): void {
    const current = this.getTrait(trait, 0.5);
    this.setTrait(trait, current + delta);
  }

  /**
   * Check if a trait is defined
   */
  hasTrait(trait: string): boolean {
    return trait in this.traits;
  }

  /**
   * Get the highest-value trait above minimum
   */
  getDominantTrait(minValue = 0.6): [string, number] | null {
    const qualified = Object.entries(this.traits).filter(([, v]) => v >= minValue);
    if (qualified.length === 0) return null;
    return qualified.reduce((a, b) => (a[1] > b[1] ? a : b));
  }

  /**
   * Get all traits in a category
   */
  getTraitsByCategory(category: TraitCategory): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [trait, value] of Object.entries(this.traits)) {
      const traitInfo = DEFAULT_TRAITS[trait];
      if (traitInfo?.category === category) {
        result[trait] = value;
      }
    }
    return result;
  }

  /**
   * Get learning traits (StudyLoG.AI extension)
   */
  getLearningTraits(): Record<string, number> {
    return this.getTraitsByCategory('learning');
  }

  /**
   * Get personality summary
   */
  getSummary(): PersonalitySummary {
    const dominant = this.getDominantTrait();

    return {
      traits: { ...this.traits },
      dominantTrait: dominant?.[0] ?? null,
      dominantValue: dominant?.[1] ?? null,
      profile: {
        characterClass: this.profile.characterClass,
        description: this.profile.description,
        quirks: this.profile.quirks,
      },
      traitCount: Object.keys(this.traits).length,
    };
  }

  /**
   * Apply personality modifiers to a response
   *
   * This adjusts responses based on dominant traits.
   */
  applyToResponse(response: CharacterResponse): CharacterResponse {
    const modified = { ...response };

    // Humor - add exclamation marks
    if (this.getTrait('humor') > 0.7) {
      if (!/[!?]$/.test(modified.content)) {
        modified.content = modified.content.trimEnd() + '!';
      }
    }

    // Caution - add careful language
    if (this.getTrait('caution') > 0.7) {
      if (!modified.content.toLowerCase().includes('carefully')) {
        modified.content = 'I carefully ' + modified.content.toLowerCase();
      }
    }

    // Aggression - change action
    if (this.getTrait('aggression') > 0.7) {
      modified.action = 'attack';
    }

    // Bravery - add confidence emotion
    if (this.getTrait('bravery') > 0.7) {
      modified.emotions = {
        ...modified.emotions,
        confidence: (modified.emotions.confidence ?? 0) + 0.5,
      };
    }

    // Optimism - add hope emotion
    if (this.getTrait('optimism') > 0.7) {
      modified.emotions = {
        ...modified.emotions,
        hope: (modified.emotions.hope ?? 0) + 0.5,
      };
    }

    // Curiosity - add inquisitive elements
    if (this.getTrait('curiosity') > 0.7) {
      if (!modified.content.includes('?')) {
        modified.content += ' I wonder what else I can learn about this.';
      }
    }

    // Kindness - soften the tone
    if (this.getTrait('kindness') > 0.7) {
      if (!modified.content.startsWith('I')) {
        modified.content = 'I ' + modified.content.toLowerCase();
      }
    }

    return modified;
  }

  /**
   * Get description of a trait
   */
  getTraitDescription(trait: string): string {
    return DEFAULT_TRAITS[trait]?.description ?? '';
  }

  /**
   * Get category of a trait
   */
  getTraitCategory(trait: string): TraitCategory | null {
    return DEFAULT_TRAITS[trait]?.category ?? null;
  }

  /**
   * Export to JSON
   */
  toJSON(): object {
    return {
      traits: this.traits,
      profile: this.profile,
      traitHistory: this.traitHistory,
    };
  }

  /**
   * Import from JSON
   */
  fromJSON(data: { traits?: Record<string, number>; profile?: PersonalityProfile }): void {
    if (data.traits) {
      for (const [trait, value] of Object.entries(data.traits)) {
        this.setTrait(trait, value);
      }
    }
    if (data.profile) {
      Object.assign(this.profile, data.profile);
    }
  }
}

/**
 * StudyLoG.AI: Student Personality
 *
 * Extends Personality with learning-specific features.
 */
export class StudentPersonality extends Personality {
  constructor(
    traits: Record<string, number> = {},
    public readonly learningStyle: LearningStyle = 'multimod al',
    public readonly interests: string[] = [],
    public readonly strengths: string[] = [],
    public readonly supportAreas: string[] = []
  ) {
    super(traits, {
      learningStyle,
    });
  }

  /**
   * Get personalized learning recommendations
   */
  getLearningRecommendations(): {
    preferredContentTypes: string[];
    suggestedStudyMethods: string[];
    motivationStrategies: string[];
  } {
    const recommendations = {
      preferredContentTypes: [] as string[],
      suggestedStudyMethods: [] as string[],
      motivationStrategies: [] as string[],
    };

    // Based on learning style
    switch (this.learningStyle) {
      case 'visual':
        recommendations.preferredContentTypes.push('diagrams', 'videos', 'mind-maps', 'charts');
        recommendations.suggestedStudyMethods.push('color-coding', 'sketching', 'diagramming');
        break;
      case 'auditory':
        recommendations.preferredContentTypes.push('lectures', 'discussions', 'audio', 'podcasts');
        recommendations.suggestedStudyMethods.push('reading-aloud', 'mnemonics', 'discussion');
        break;
      case 'kinesthetic':
        recommendations.preferredContentTypes.push('simulations', 'experiments', 'hands-on', 'games');
        recommendations.suggestedStudyMethods.push('role-playing', 'building', 'moving-while-learning');
        break;
      case 'reading':
        recommendations.preferredContentTypes.push('texts', 'articles', 'books', 'notes');
        recommendations.suggestedStudyMethods.push('outlining', 'summarizing', 'annotating');
        break;
      case 'multimodal':
        recommendations.preferredContentTypes.push('mixed', 'interactive', 'comprehensive');
        recommendations.suggestedStudyMethods.push('variety', 'integration', 'reflection');
        break;
    }

    // Based on traits
    if (this.getTrait('curiosity') > 0.7) {
      recommendations.motivationStrategies.push('exploration', 'discovery-learning', 'open-ended');
    }

    if (this.getTrait('persistence') < 0.4) {
      recommendations.motivationStrategies.push('gamification', 'quick-wins', 'milestones');
    }

    if (this.getTrait('collaboration') > 0.7) {
      recommendations.suggestedStudyMethods.push('peer-teaching', 'group-work', 'study-buddy');
    }

    if (this.getTrait('reflection') > 0.7) {
      recommendations.suggestedStudyMethods.push('journaling', 'self-assessment', 'portfolio');
    }

    return recommendations;
  }

  /**
   * Get optimal session parameters
   */
  getOptimalSession(): {
    preferredLength: number;
    breakFrequency: number;
    bestTimeOfDay: string;
  } {
    return {
      preferredLength: this.getTrait('focus') > 0.7 ? 45 : 25,
      breakFrequency: this.getTrait('discipline') > 0.6 ? 25 : 15,
      bestTimeOfDay: this.getTrait('initiative') > 0.7 ? 'morning' : 'flexible',
    };
  }
}

/**
 * Factory function to create a personality
 */
export function createPersonality(
  traits?: Record<string, number>,
  profile?: Partial<PersonalityProfile>
): Personality {
  return new Personality(traits, profile);
}

/**
 * Factory function to create a student personality
 */
export function createStudentPersonality(
  traits: Record<string, number> = {},
  learningStyle: LearningStyle = 'multimodal'
): StudentPersonality {
  return new StudentPersonality(traits, learningStyle);
}

// Re-export types
export type {
  Trait,
  TraitCategory,
  PersonalityProfile,
  PersonalitySummary,
  LearningStyle,
};
