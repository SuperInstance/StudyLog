/**
 * PersonalLog Worker - Reflection Prompts
 *
 * AI-generated reflection questions for journaling and self-reflection.
 * Provides contextual prompts based on user activity and progress.
 *
 * @module personal-log/reflection-prompts
 */

import {
  ReflectionPrompt,
  ReflectionPromptCategory,
  ReflectionPromptType,
  ProductContext,
  MoodIndicator,
  JournalEntry,
} from './types'

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * Base prompt templates for different categories
 */
const PROMPT_TEMPLATES: Record<ReflectionPromptCategory, string[]> = {
  daily: [
    'What was the most interesting thing you learned today?',
    'What challenged you the most today?',
    'What are you most proud of accomplishing today?',
    'What would you like to understand better?',
    'How did you feel about your progress today?',
  ],
  weekly: [
    'What was your biggest breakthrough this week?',
    'Which concept or skill do you feel you\'ve improved the most?',
    'What patterns do you notice in your learning journey?',
    'What goal do you want to focus on next week?',
    'How has your understanding changed since the start of the week?',
  ],
  milestone: [
    'You\'ve reached an important milestone! What did you learn along the way?',
    'How does this achievement connect to your larger goals?',
    'What skills did you develop to reach this point?',
    'What surprised you most about this journey?',
  ],
  struggle: [
    'What specifically feels challenging right now?',
    'What have you tried so far to overcome this challenge?',
    'What resources or support might help you move forward?',
    'What can you learn from this struggle?',
  ],
  session: [
    'What was the most memorable moment from this session?',
    'What surprised you during this session?',
    'What would you like to explore further next time?',
    'How did this session connect to what you already knew?',
  ],
}

// ============================================================================
// STUDYLOG.AI PROMPTS
// ============================================================================

/**
 * StudyLoG.AI specific reflection prompts
 */
export const STUDYLOG_PROMPTS: Record<string, Omit<ReflectionPrompt, 'id'>> = {
  // Daily reflections
  daily_learning: {
    productId: 'studylog',
    category: 'daily',
    prompt: 'What was the most interesting thing you learned today about AI models?',
    type: 'open_ended',
  },
  daily_challenge: {
    productId: 'studylog',
    category: 'daily',
    prompt: 'What concept felt confusing today? What specifically made it challenging?',
    type: 'guided',
    suggestedResponses: [
      'The terminology was new to me',
      'I couldn\'t visualize how it works',
      'The mathematical foundations were unclear',
      'I need more hands-on practice',
    ],
  },
  daily_progress: {
    productId: 'studylog',
    category: 'daily',
    prompt: 'On a scale of 1-5, how confident do you feel about what you learned today?',
    type: 'rating',
  },

  // Weekly reflections
  weekly_breakthrough: {
    productId: 'studylog',
    category: 'weekly',
    prompt: 'What was your biggest "aha!" moment this week?',
    type: 'open_ended',
  },
  weekly_patterns: {
    productId: 'studylog',
    category: 'weekly',
    prompt: 'What patterns do you notice in how you learn best?',
    type: 'guided',
    suggestedResponses: [
      'I learn by doing hands-on activities',
      'I prefer visual explanations',
      'I need to see the big picture first',
      'I learn by explaining to others',
    ],
  },
  weekly_goals: {
    productId: 'studylog',
    category: 'weekly',
    prompt: 'What skill or concept do you want to focus on next week?',
    type: 'open_ended',
  },

  // Milestone reflections
  milestone_skill: {
    productId: 'studylog',
    category: 'milestone',
    prompt: 'You just unlocked {skill}! How does this connect to what you learned before?',
    type: 'comparison',
    context: {
      masteredSkills: [],
    },
  },
  milestone_lesson: {
    productId: 'studylog',
    category: 'milestone',
    prompt: 'You completed {lesson}! What was the most valuable takeaway?',
    type: 'open_ended',
  },

  // Struggle reflections
  struggle_concept: {
    productId: 'studylog',
    category: 'struggle',
    prompt: '{concept} is feeling difficult. What specifically is confusing?',
    type: 'guided',
    context: {
      strugglingConcepts: [],
    },
    suggestedResponses: [
      'I don\'t understand the terminology',
      'I can\'t visualize how it works',
      'I\'m not sure when to use this',
      'The math behind it is unclear',
    ],
  },

  // Session reflections
  session_reflection: {
    productId: 'studylog',
    category: 'session',
    prompt: 'What stood out to you most during this session?',
    type: 'open_ended',
  },
  session_next_steps: {
    productId: 'studylog',
    category: 'session',
    prompt: 'Based on what you learned today, what do you want to explore next?',
    type: 'guided',
    suggestedResponses: [
      'Practice with more examples',
      'Dive deeper into the theory',
      'Apply this to a real project',
      'Teach this to someone else',
    ],
  },
}

// ============================================================================
// DMLOG.AI PROMPTS
// ============================================================================

/**
 * DMLoG.AI specific reflection prompts
 */
export const DMLOG_PROMPTS: Record<string, Omit<ReflectionPrompt, 'id'>> = {
  // Daily reflections
  daily_session: {
    productId: 'dmlog',
    category: 'daily',
    prompt: 'What was the most memorable moment from today\'s session?',
    type: 'open_ended',
  },
  daily_preparation: {
    productId: 'dmlog',
    category: 'daily',
    prompt: 'How did your preparation for the session go? What would you change?',
    type: 'guided',
    suggestedResponses: [
      'Everything went according to plan',
      'I had to improvise more than expected',
      'The players surprised me',
      'I wish I had prepared more',
    ],
  },

  // Weekly reflections
  weekly_campaign: {
    productId: 'dmlog',
    category: 'weekly',
    prompt: 'How did the story develop this week? What plot threads are most exciting?',
    type: 'open_ended',
  },
  weekly_characters: {
    productId: 'dmlog',
    category: 'weekly',
    prompt: 'Which character had the most interesting development this week?',
    type: 'open_ended',
  },
  weekly_player_engagement: {
    productId: 'dmlog',
    category: 'weekly',
    prompt: 'What engaged your players the most this week?',
    type: 'guided',
    suggestedResponses: [
      'The combat encounters',
      'The roleplay moments',
      'The story revelations',
      'The puzzles and mysteries',
    ],
  },

  // Milestone reflections
  milestone_story_arc: {
    productId: 'dmlog',
    category: 'milestone',
    prompt: 'You completed a major story arc! How did it compare to your original vision?',
    type: 'comparison',
  },
  milestone_campaign: {
    productId: 'dmlog',
    category: 'milestone',
    prompt: 'The campaign reached a significant milestone. What are you most proud of?',
    type: 'open_ended',
  },

  // Session reflections
  session_encounter: {
    productId: 'dmlog',
    category: 'session',
    prompt: 'The {encounterType} encounter went {outcome}. What would you change next time?',
    type: 'guided',
    context: {
      campaignEvents: [],
    },
    suggestedResponses: [
      'Adjust the difficulty',
      'Add more environmental elements',
      'Improve the narrative setup',
      'Balance the combat better',
    ],
  },
  session_character_moment: {
    productId: 'dmlog',
    category: 'session',
    prompt: '{character} had a great moment! How did this impact the story?',
    type: 'open_ended',
    context: {
      characters: [],
    },
  },

  // World building reflections
  world_building: {
    productId: 'dmlog',
    category: 'weekly',
    prompt: 'What new element of the world are you most excited to explore?',
    type: 'open_ended',
  },
  world_consistency: {
    productId: 'dmlog',
    category: 'struggle',
    prompt: 'What aspects of world continuity are you struggling with?',
    type: 'guided',
    suggestedResponses: [
      'Keeping track of NPC relationships',
      'Maintaining timeline consistency',
      'Balancing power levels',
      'Remembering location details',
    ],
  },
}

// ============================================================================
// REFLECTION PROMPT MANAGER
// ============================================================================

/**
 * Configuration for prompt generation
 */
export interface PromptGenerationConfig {
  /** Number of prompts to generate */
  count: number

  /** Categories to include */
  categories: ReflectionPromptCategory[]

  /** Whether to personalize based on context */
  personalize: boolean

  /** Whether to include AI-generated prompts */
  includeAIGenerated: boolean
}

/**
 * Default prompt generation configuration
 */
export const DEFAULT_PROMPT_CONFIG: PromptGenerationConfig = {
  count: 3,
  categories: ['daily', 'session'],
  personalize: true,
  includeAIGenerated: false,
}

/**
 * Reflection prompt manager
 */
export class ReflectionPromptManager {
  private productId: ProductContext
  private customPrompts: Map<string, ReflectionPrompt> = new Map()

  constructor(productId: ProductContext) {
    this.productId = productId
  }

  /**
   * Get prompts for reflection
   */
  async getPrompts(
    config: Partial<PromptGenerationConfig> = {},
    context?: {
      recentActivity?: string[]
      strugglingConcepts?: string[]
      masteredSkills?: string[]
      characters?: string[]
      campaignEvents?: string[]
      mood?: MoodIndicator
    }
  ): Promise<ReflectionPrompt[]> {
    const fullConfig: PromptGenerationConfig = {
      ...DEFAULT_PROMPT_CONFIG,
      ...config,
    }

    let prompts: ReflectionPrompt[] = []

    // Get base prompts for product
    const basePrompts = this.getBasePrompts()
    prompts = [...prompts, ...basePrompts]

    // Get personalized prompts if enabled
    if (fullConfig.personalize && context) {
      const personalized = this.getPersonalizedPrompts(context)
      prompts = [...prompts, ...personalized]
    }

    // Filter by categories
    if (fullConfig.categories.length > 0) {
      prompts = prompts.filter(p => fullConfig.categories.includes(p.category))
    }

    // Apply mood filtering
    if (context?.mood) {
      prompts = this.filterByMood(prompts, context.mood)
    }

    // Shuffle and limit
    prompts = this.shuffleArray(prompts).slice(0, fullConfig.count)

    // Generate IDs
    prompts = prompts.map((p, i) => ({
      ...p,
      id: `prompt_${Date.now()}_${i}`,
    }))

    return prompts
  }

  /**
   * Get a specific prompt by ID
   */
  getPrompt(promptId: string): ReflectionPrompt | null {
    const allPrompts = [...Object.values(this.getBasePromptsMap()), ...this.customPrompts.values()]
    return allPrompts.find(p => p.id === promptId) || null
  }

  /**
   * Add a custom prompt
   */
  addCustomPrompt(prompt: Omit<ReflectionPrompt, 'id'>): ReflectionPrompt {
    const customPrompt: ReflectionPrompt = {
      ...prompt,
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    }

    this.customPrompts.set(customPrompt.id, customPrompt)
    return customPrompt
  }

  /**
   * Get template prompts
   */
  getTemplatePrompts(category: ReflectionPromptCategory): string[] {
    return PROMPT_TEMPLATES[category] || []
  }

  /**
   * Get base prompts for the current product
   */
  private getBasePrompts(): ReflectionPrompt[] {
    const promptsMap = this.getBasePromptsMap()
    return Object.values(promptsMap)
  }

  /**
   * Get base prompts map
   */
  private getBasePromptsMap(): Record<string, Omit<ReflectionPrompt, 'id'>> {
    switch (this.productId) {
      case 'studylog':
        return STUDYLOG_PROMPTS
      case 'dmlog':
        return DMLOG_PROMPTS
      default:
        return {}
    }
  }

  /**
   * Get personalized prompts based on context
   */
  private getPersonalizedPrompts(context: {
    recentActivity?: string[]
    strugglingConcepts?: string[]
    masteredSkills?: string[]
    characters?: string[]
    campaignEvents?: string[]
  }): ReflectionPrompt[] {
    const personalized: ReflectionPrompt[] = []

    // StudyLoG.AI personalizations
    if (this.productId === 'studylog') {
      // Struggling concepts
      if (context.strugglingConcepts && context.strugglingConcepts.length > 0) {
        const concept = context.strugglingConcepts[0]
        personalized.push({
          id: `personalized_${Date.now()}_struggle`,
          productId: this.productId,
          category: 'struggle',
          prompt: `You've been working on ${concept}. What's still unclear?`,
          type: 'guided',
          suggestedResponses: [
            'I need more examples',
            'The terminology is confusing',
            'I can\'t see how it applies',
            'I need to practice more',
          ],
          aiGenerated: true,
        })
      }

      // Mastered skills
      if (context.masteredSkills && context.masteredSkills.length > 0) {
        const skill = context.masteredSkills[0]
        personalized.push({
          id: `personalized_${Date.now()}_mastery`,
          productId: this.productId,
          category: 'milestone',
          prompt: `You've mastered ${skill}! How would you explain this to someone else?`,
          type: 'open_ended',
          aiGenerated: true,
        })
      }
    }

    // DMLoG.AI personalizations
    if (this.productId === 'dmlog') {
      // Character development
      if (context.characters && context.characters.length > 0) {
        const character = context.characters[0]
        personalized.push({
          id: `personalized_${Date.now()}_character`,
          productId: this.productId,
          category: 'session',
          prompt: `How did ${character}'s story develop in this session?`,
          type: 'open_ended',
          context: { characters: context.characters },
          aiGenerated: true,
        })
      }

      // Recent campaign events
      if (context.campaignEvents && context.campaignEvents.length > 0) {
        personalized.push({
          id: `personalized_${Date.now()}_campaign`,
          productId: this.productId,
          category: 'session',
          prompt: `Reflect on: ${context.campaignEvents[0]}`,
          type: 'open_ended',
          context: { campaignEvents: context.campaignEvents },
          aiGenerated: true,
        })
      }
    }

    return personalized
  }

  /**
   * Filter prompts by mood
   */
  private filterByMood(prompts: ReflectionPrompt[], mood: MoodIndicator): ReflectionPrompt[] {
    // For negative moods, focus on struggle and support prompts
    if (['frustrated', 'confused', 'stuck'].includes(mood)) {
      return prompts.filter(p =>
        ['struggle', 'daily'].includes(p.category) ||
        p.prompt.toLowerCase().includes('help') ||
        p.prompt.toLowerCase().includes('challenge')
      )
    }

    // For positive moods, focus on achievement and growth
    if (['excited', 'proud', 'accomplished', 'inspired'].includes(mood)) {
      return prompts.filter(p =>
        ['milestone', 'weekly'].includes(p.category) ||
        p.prompt.toLowerCase().includes('proud') ||
        p.prompt.toLowerCase().includes('achieve')
      )
    }

    return prompts
  }

  /**
   * Shuffle array randomly
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }
}

// ============================================================================
// AI-ASSISTED PROMPT GENERATION
// ============================================================================

/**
 * AI prompt generator for creating custom reflection prompts
 */
export class AIPromptGenerator {
  /**
   * Generate a contextual prompt based on journal entries
   */
  async generateFromEntries(entries: JournalEntry[]): Promise<ReflectionPrompt[]> {
    const prompts: ReflectionPrompt[] = []

    // Analyze entries for patterns
    const recentMoods = entries.map(e => e.mood).filter(Boolean) as MoodIndicator[]
    const commonMood = this.getMostCommon(recentMoods)

    const recentTags = entries.flatMap(e => e.tags)
    const tagCounts = this.countOccurrences(recentTags)
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag)

    // Generate mood-based prompt
    if (commonMood) {
      prompts.push({
        id: `ai_${Date.now()}_mood`,
        productId: entries[0]?.productId || 'studylog',
        category: 'daily',
        prompt: this.getMoodBasedPrompt(commonMood),
        type: 'open_ended',
        aiGenerated: true,
      })
    }

    // Generate tag-based prompt
    if (topTags.length > 0) {
      prompts.push({
        id: `ai_${Date.now()}_tags`,
        productId: entries[0]?.productId || 'studylog',
        category: 'daily',
        prompt: `You've been focusing on ${topTags.join(', ')}. What's drawing you to these topics?`,
        type: 'open_ended',
        aiGenerated: true,
      })
    }

    return prompts
  }

  /**
   * Generate a milestone prompt
   */
  generateMilestonePrompt(
    milestone: string,
    context?: string[]
  ): ReflectionPrompt {
    return {
      id: `ai_${Date.now()}_milestone`,
      productId: 'studylog',
      category: 'milestone',
      prompt: `You achieved "${milestone}"! ${context ? `How does this relate to ${context[0]}?` : 'What does this mean for your journey?'}`,
      type: 'open_ended',
      aiGenerated: true,
    }
  }

  /**
   * Get a mood-based prompt
   */
  private getMoodBasedPrompt(mood: MoodIndicator): string {
    const moodPrompts: Record<MoodIndicator, string> = {
      frustrated: 'What\'s causing frustration right now? Breaking it down might help.',
      confused: 'What feels unclear? Sometimes articulating the confusion helps.',
      curious: 'What sparked your curiosity? Follow that thread!',
      excited: 'You\'re excited! What\'s driving this enthusiasm?',
      proud: 'You should be proud! What led to this accomplishment?',
      neutral: 'What\'s on your mind right now?',
      accomplished: 'You achieved something! What made this possible?',
      stuck: 'Feeling stuck? What have you tried so far?',
      inspired: 'What\'s inspiring you? How can you capture this energy?',
    }

    return moodPrompts[mood] || 'How are you feeling about your progress?'
  }

  /**
   * Get most common item in array
   */
  private getMostCommon<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined

    const counts = this.countOccurrences(array as unknown as string[])
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0]?.[0] as unknown as T
  }

  /**
   * Count occurrences in array
   */
  private countOccurrences(array: string[]): Record<string, number> {
    return array.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a reflection prompt manager for the specified product
 */
export function createPromptManager(productId: ProductContext): ReflectionPromptManager {
  return new ReflectionPromptManager(productId)
}

/**
 * Create an AI prompt generator
 */
export function createAIPromptGenerator(): AIPromptGenerator {
  return new AIPromptGenerator()
}
