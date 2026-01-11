/**
 * StudyLoG.AI - Character Personality System
 *
 * Based on research from SuperInstance ai-character-integrations.
 * Implements the Big Five personality model (OCEAN) for AI characters.
 */

/**
 * Big Five personality traits (OCEAN model)
 * Each trait is measured on a scale of 0.0 to 1.0
 */
export interface Personality {
  /** Openness: Willingness to try new things, creativity, curiosity */
  openness: number;

  /** Conscientiousness: Organization, discipline, reliability */
  conscientiousness: number;

  /** Extraversion: Social engagement, enthusiasm, assertiveness */
  extraversion: number;

  /** Agreeableness: Cooperation, empathy, kindness */
  agreeableness: number;

  /** Neuroticism: Emotional stability (inverted - lower is more stable) */
  neuroticism: number;
}

/**
 * Validate a personality profile
 */
export function isValidPersonality(p: Personality): boolean {
  return (
    p.openness >= 0 && p.openness <= 1 &&
    p.conscientiousness >= 0 && p.conscientiousness <= 1 &&
    p.extraversion >= 0 && p.extraversion <= 1 &&
    p.agreeableness >= 0 && p.agreeableness <= 1 &&
    p.neuroticism >= 0 && p.neuroticism <= 1
  );
}

/**
 * Personality presets for different character archetypes
 */
export const PERSONALITY_PRESETS: Record<string, Personality> = {
  /** The Wise Mentor - Patient, knowledgeable, emotionally stable */
  mentor: {
    openness: 0.7,
    conscientiousness: 0.9,
    extraversion: 0.4,
    agreeableness: 0.8,
    neuroticism: 0.2,
  },

  /** The Enthusiastic Guide - High energy, encouraging, friendly */
  guide: {
    openness: 0.8,
    conscientiousness: 0.6,
    extraversion: 0.9,
    agreeableness: 0.9,
    neuroticism: 0.3,
  },

  /** The Analytical Expert - Precise, thorough, reserved */
  expert: {
    openness: 0.6,
    conscientiousness: 0.95,
    extraversion: 0.3,
    agreeableness: 0.5,
    neuroticism: 0.4,
  },

  /** The Creative Explorer - Curious, imaginative, spontaneous */
  explorer: {
    openness: 0.95,
    conscientiousness: 0.5,
    extraversion: 0.7,
    agreeableness: 0.6,
    neuroticism: 0.5,
  },

  /** The Practical Builder - Grounded, reliable, straightforward */
  builder: {
    openness: 0.5,
    conscientiousness: 0.9,
    extraversion: 0.5,
    agreeableness: 0.7,
    neuroticism: 0.3,
  },

  /** The Skeptical Tester - Critical, detail-oriented, cautious */
  tester: {
    openness: 0.4,
    conscientiousness: 0.85,
    extraversion: 0.3,
    agreeableness: 0.4,
    neuroticism: 0.5,
  },

  /** The Playful Trickster - Fun, unpredictable, engaging */
  trickster: {
    openness: 0.9,
    conscientiousness: 0.4,
    extraversion: 0.8,
    agreeableness: 0.6,
    neuroticism: 0.6,
  },

  /** The Stoic Guardian - Calm, protective, dependable */
  guardian: {
    openness: 0.4,
    conscientiousness: 0.95,
    extraversion: 0.2,
    agreeableness: 0.7,
    neuroticism: 0.1,
  },
};

/**
 * Calculate personality compatibility between two characters
 * Returns a score from 0 (incompatible) to 1 (highly compatible)
 */
export function personalityCompatibility(a: Personality, b: Personality): number {
  const diffs = [
    Math.abs(a.openness - b.openness),
    Math.abs(a.conscientiousness - b.conscientiousness),
    Math.abs(a.extraversion - b.extraversion),
    Math.abs(a.agreeableness - b.agreeableness),
    Math.abs(a.neuroticism - b.neuroticism),
  ];

  const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
  return 1 - avgDiff;
}

/**
 * Get a descriptive adjective for a personality trait value
 */
export function describeTrait(value: number): string {
  if (value <= 0.2) {
    return 'very low';
  } else if (value <= 0.4) {
    return 'low';
  } else if (value <= 0.6) {
    return 'moderate';
  } else if (value <= 0.8) {
    return 'high';
  } else {
    return 'very high';
  }
}

/**
 * Generate a personality description
 */
export function describePersonality(p: Personality): string {
  return [
    `Openness: ${describeTrait(p.openness)}`,
    `Conscientiousness: ${describeTrait(p.conscientiousness)}`,
    `Extraversion: ${describeTrait(p.extraversion)}`,
    `Agreeableness: ${describeTrait(p.agreeableness)}`,
    `Emotional Stability: ${describeTrait(1 - p.neuroticism)}`,
  ].join(', ');
}

/**
 * Mutate a personality slightly (for character growth or variation)
 * @param p Original personality
 * @param amount Amount of mutation (0-1, default 0.1)
 */
export function mutatePersonality(p: Personality, amount: number = 0.1): Personality {
  const mutate = (value: number) => {
    const delta = (Math.random() - 0.5) * 2 * amount;
    return Math.max(0, Math.min(1, value + delta));
  };

  return {
    openness: mutate(p.openness),
    conscientiousness: mutate(p.conscientiousness),
    extraversion: mutate(p.extraversion),
    agreeableness: mutate(p.agreeableness),
    neuroticism: mutate(p.neuroticism),
  };
}

/**
 * Blend two personalities (useful for creating derived characters)
 * @param a First personality
 * @param b Second personality
 * @param weight Blend weight (0 = pure a, 1 = pure b, 0.5 = equal blend)
 */
export function blendPersonalities(a: Personality, b: Personality, weight: number = 0.5): Personality {
  const blend = (va: number, vb: number) => va * (1 - weight) + vb * weight;

  return {
    openness: blend(a.openness, b.openness),
    conscientiousness: blend(a.conscientiousness, b.conscientiousness),
    extraversion: blend(a.extraversion, b.extraversion),
    agreeableness: blend(a.agreeableness, b.agreeableness),
    neuroticism: blend(a.neuroticism, b.neuroticism),
  };
}
