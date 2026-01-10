/**
 * Image Cascade - Agent Prompting System
 *
 * This module handles agent-driven prompt crafting and refinement for
 * image generation.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * AGENT PROMPTING WORKFLOW
 * ═══════════════════════════════════════════════════════════════════════
 *
 * The agent prompting system allows AI agents to craft and refine prompts
 * before image generation, improving quality and reducing wasted generations.
 *
 * Flow:
 * 1. User provides base concept or agent generates prompt
 * 2. Agent refines prompt based on target quality tier
 * 3. System estimates cost and gets approval
 * 4. Image is generated with optimized prompt
 * 5. Results are tracked for future improvement
 *
 * Benefits:
 * - Better prompt adherence (agents understand AI quirks)
 * - Cost savings (fewer failed generations)
 * - Consistency (agents maintain style across sessions)
 * - Learning (system improves from feedback)
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

import type { ImageQuality } from './quality-tiers.js';

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

/**
 * Agent types that can generate/refine image prompts
 *
 * Different agents specialize in different aspects of image generation:
 * - captain: Handles game-related assets (NPCs, environments, items)
 * - builder: Focuses on technical/diagram images (UI mockups, schematics)
 * - teacher: Creates educational illustrations (diagrams, charts)
 * - artist: Specializes in artistic/style-consistent images
 */
export type AgentType = 'captain' | 'builder' | 'teacher' | 'artist';

/**
 * Prompt crafting context
 *
 * Provides agents with context for crafting appropriate prompts.
 */
export interface PromptContext {
  /** What the image will be used for */
  useCase: 'concept' | 'asset' | 'ui-mockup' | 'illustration' | 'texture' | 'icon';

  /** Target quality tier */
  targetTier: ImageQuality;

  /** Required style/aesthetic */
  style?: string;

  /** Required dimensions (if specific) */
  dimensions?: string;

  /** Parent generation (for refinement workflows) */
  parentId?: string;

  /** Additional context for the agent */
  metadata?: Record<string, unknown>;
}

/**
 * Agent-crafted prompt
 *
 * Result of agent prompt generation with metadata for tracking.
 */
export interface AgentPrompt {
  /** The crafted prompt for image generation */
  prompt: string;

  /** Negative prompt (what to avoid) */
  negativePrompt?: string;

  /** Agent that created this prompt */
  agent: AgentType;

  /** Confidence score (0-1) - how confident the agent is */
  confidence: number;

  /** Suggested quality tier */
  suggestedTier: ImageQuality;

  /** Estimated quality improvement over base prompt */
  expectedImprovement: number;

  /** Prompt tags for categorization */
  tags: string[];

  /** Timestamp when prompt was crafted */
  craftedAt: string;
}

/**
 * Prompt refinement request
 *
 * Request to refine an existing prompt for better results.
 */
export interface PromptRefinementRequest {
  /** Original prompt to refine */
  originalPrompt: string;

  /** Feedback on what to improve */
  feedback?: string;

  /** Target quality tier */
  targetTier: ImageQuality;

  /** Agent to use for refinement */
  agent?: AgentType;

  /** Previous generation results (for learning) */
  previousResults?: {
    success: boolean;
    issues?: string[];
  };
}

/**
 * Prompt refinement result
 *
 * Result of agent prompt refinement with explanations.
 */
export interface PromptRefinement {
  /** Refined prompt */
  refinedPrompt: string;

  /** Refined negative prompt */
  refinedNegativePrompt?: string;

  /** Agent that performed refinement */
  agent: AgentType;

  /** Explanation of changes made */
  explanation: string;

  /** Expected improvement (0-1) */
  expectedImprovement: number;

  /** Specific aspects that were improved */
  improvements: string[];
}

/**
 * Prompt history entry
 *
 * Stored record of prompt used for generation.
 */
export interface PromptHistoryEntry {
  /** Unique ID for this prompt entry */
  id: string;

  /** User ID who requested this prompt */
  userId: string;

  /** Original user input */
  originalInput: string;

  /** Agent-crafted prompt */
  craftedPrompt: string;

  /** Negative prompt */
  negativePrompt?: string;

  /** Agent that crafted the prompt */
  agent: AgentType;

  /** Quality tier used */
  tier: ImageQuality;

  /** Provider that generated the image */
  provider: string;

  /** Model used */
  model: string;

  /** Generation result (success/failure) */
  success: boolean;

  /** User rating (1-5) */
  rating?: number;

  /** User feedback */
  feedback?: string;

  /** Timestamp */
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Agent Prompt Templates
// ═══════════════════════════════════════════════════════════════════════

/**
 * Agent-specific prompt templates
 *
 * Each agent has specialized knowledge for crafting prompts
 * in their domain. These templates help agents generate better prompts.
 */
export const AGENT_TEMPLATES: Record<AgentType, {
  description: string;
  specialties: string[];
  styleModifiers: string[];
  qualityModifiers: Record<ImageQuality, string[]>;
}> = {
  captain: {
    description: 'Game asset specialist - NPCs, environments, items, UI',
    specialties: ['character-design', 'environment-art', 'item-icons', 'game-ui', 'concept-art'],
    styleModifiers: [
      'game-ready', 'concept-art', 'stylized', 'rpg', 'fantasy', 'sci-fi', 'isometric',
    ],
    qualityModifiers: {
      draft: [
        'rough sketch', 'thumbnail', 'concept doodle', 'quick mockup',
        'low detail', 'exploratory',
      ],
      preview: [
        'refined concept', 'detailed sketch', 'color study', 'semi-final',
      ],
      final: [
        'production-ready', 'highly detailed', 'professional', 'masterpiece',
        '4k quality', 'artstation trending',
      ],
    },
  },

  builder: {
    description: 'Technical/structural specialist - UI, diagrams, schematics',
    specialties: ['ui-mockup', 'wireframe', 'schematic', 'technical-diagram', 'architecture'],
    styleModifiers: [
      'clean lines', 'minimalist', 'technical', 'architectural', 'blueprint',
    ],
    qualityModifiers: {
      draft: [
        'wireframe', 'rough layout', 'box mockup', 'placeholder',
      ],
      preview: [
        'high-fidelity mockup', 'detailed wireframe', 'annotated',
      ],
      final: [
        'production mockup', 'pixel-perfect', 'design-system', 'professional ui',
      ],
    },
  },

  teacher: {
    description: 'Educational content specialist - diagrams, charts, illustrations',
    specialties: ['diagram', 'chart', 'infographic', 'educational-illustration', 'tutorial-art'],
    styleModifiers: [
      'clear', 'educational', 'informative', 'textbook-style', 'instructional',
    ],
    qualityModifiers: {
      draft: [
        'simple diagram', 'basic sketch', 'rough illustration',
      ],
      preview: [
        'detailed diagram', 'colored illustration', 'annotated',
      ],
      final: [
        'publication-ready', 'textbook quality', 'professional illustration',
      ],
    },
  },

  artist: {
    description: 'Artistic/style specialist - consistent aesthetic, mood, atmosphere',
    specialties: ['concept-art', 'character-art', 'landscape', 'portrait', 'stylized'],
    styleModifiers: [
      'artistic', 'expressive', 'moody', 'atmospheric', 'painterly',
    ],
    qualityModifiers: {
      draft: [
        'gesture sketch', 'thumbnail', 'color rough', 'speedpaint',
      ],
      preview: [
        'refined painting', 'detailed art', 'composition study',
      ],
      final: [
        'masterpiece', 'award-winning', 'trending on artstation', 'highly detailed',
      ],
    },
  },
};

/**
 * Style modifiers for different use cases
 *
 * These are automatically added to prompts based on the intended use.
 */
export const USE_CASE_MODIFIERS: Record<string, string[]> = {
  'concept': ['concept art', 'exploratory', 'multiple variations'],
  'asset': ['game-ready', 'transparent background', 'clean lines'],
  'ui-mockup': ['ui design', 'clean interface', 'modern app design'],
  'illustration': ['digital art', 'detailed', 'professional illustration'],
  'texture': ['seamless', 'tilable', 'texture pattern', 'material'],
  'icon': ['icon', 'simple', 'minimalist', 'recognizable', 'vector style'],
};

/**
 * Quality tier modifiers
 *
 * Terms that indicate the desired quality level to the image model.
 */
export const TIER_MODIFIERS: Record<ImageQuality, string[]> = {
  draft: ['rough', 'quick sketch', 'exploratory', 'low detail', 'thumbnail'],
  preview: ['refined', 'detailed', 'semi-polished', 'good quality'],
  final: ['masterpiece', 'best quality', 'highly detailed', 'professional', '8k', 'award-winning'],
};

// ═══════════════════════════════════════════════════════════════════════
// Agent Prompt Crafting Service
// ═══════════════════════════════════════════════════════════════════════

/**
 * Agent Prompt Service
 *
 * Handles agent-driven prompt crafting and refinement.
 * Uses LLMs to generate optimized prompts for image generation.
 */
export class AgentPromptService {
  constructor(
    private ai: Ai,  // Cloudflare AI binding for prompt crafting
    private db: D1Database  // For storing prompt history
  ) {}

  /**
   * Craft a prompt using an agent
   *
   * Takes a user's base concept and crafts an optimized prompt
   * for the target quality tier using agent expertise.
   *
   * @param baseInput - User's base concept or description
   * @param context - Context for prompt crafting
   * @param agent - Agent type to use
   * @returns Crafted prompt with metadata
   */
  async craftPrompt(
    baseInput: string,
    context: PromptContext,
    agent: AgentType
  ): Promise<AgentPrompt> {
    const agentTemplate = AGENT_TEMPLATES[agent];

    // Build the system prompt for the LLM
    const systemPrompt = this.buildCraftingSystemPrompt(agent, context);

    // Call LLM to craft the prompt
    try {
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Craft an optimized image generation prompt for: "${baseInput}"\n\n` +
                    `Use case: ${context.useCase}\n` +
                    `Target tier: ${context.targetTier}\n` +
                    context.style ? `Style: ${context.style}\n` : '',
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const llmOutput = response.response;
      const parsed = this.parseCraftedPrompt(llmOutput, baseInput);

      return {
        prompt: parsed.prompt,
        negativePrompt: parsed.negativePrompt,
        agent,
        confidence: parsed.confidence || 0.8,
        suggestedTier: context.targetTier,
        expectedImprovement: parsed.expectedImprovement || 0.3,
        tags: this.extractTags(parsed.prompt, agentTemplate.specialties),
        craftedAt: new Date().toISOString(),
      };
    } catch (error) {
      // Fallback to basic prompt enhancement if LLM fails
      return this.fallbackPromptCraft(baseInput, context, agent);
    }
  }

  /**
   * Refine an existing prompt
   *
   * Takes feedback and improves an existing prompt for better results.
   *
   * @param request - Refinement request
   * @returns Refined prompt with explanation
   */
  async refinePrompt(request: PromptRefinementRequest): Promise<PromptRefinement> {
    const agent = request.agent || this.selectAgentForRefinement(request);

    const systemPrompt = `You are an expert at refining image generation prompts.
Your task is to improve prompts based on feedback and target quality tier.

Quality tier: ${request.targetTier}
${request.feedback ? `Feedback: ${request.feedback}` : ''}

Analyze the original prompt and provide:
1. A refined prompt that addresses the feedback
2. A negative prompt if helpful
3. A brief explanation of changes made
4. Expected improvement (0-1 scale)

Respond in JSON format:
{
  "refinedPrompt": "...",
  "refinedNegativePrompt": "...",
  "explanation": "...",
  "improvements": ["...", "..."],
  "expectedImprovement": 0.X
}`;

    try {
      const response = await this.ai.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Original prompt: "${request.originalPrompt}"` },
        ],
        max_tokens: 500,
        temperature: 0.5,
      });

      const parsed = JSON.parse(response.response);

      return {
        refinedPrompt: parsed.refinedPrompt || request.originalPrompt,
        refinedNegativePrompt: parsed.refinedNegativePrompt,
        agent,
        explanation: parsed.explanation || 'Prompt refined based on feedback',
        expectedImprovement: parsed.expectedImprovement || 0.3,
        improvements: parsed.improvements || [],
      };
    } catch {
      // Fallback: return original with minimal changes
      return {
        refinedPrompt: request.originalPrompt,
        refinedNegativePrompt: undefined,
        agent,
        explanation: 'Unable to refine - using original prompt',
        expectedImprovement: 0,
        improvements: [],
      };
    }
  }

  /**
   * Save prompt to history
   *
   * Tracks prompts used for generation to enable learning and improvement.
   */
  async saveToHistory(entry: Omit<PromptHistoryEntry, 'id' | 'createdAt'>): Promise<string> {
    const id = this.generateId();

    await this.db.prepare(`
      INSERT INTO image_prompt_history (
        id, user_id, original_input, crafted_prompt, negative_prompt,
        agent, tier, provider, model, success, rating, feedback, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      id,
      entry.userId,
      entry.originalInput,
      entry.craftedPrompt,
      entry.negativePrompt || null,
      entry.agent,
      entry.tier,
      entry.provider,
      entry.model,
      entry.success ? 1 : 0,
      entry.rating || null,
      entry.feedback || null
    ).run();

    return id;
  }

  /**
   * Get prompt history for a user
   */
  async getHistory(userId: string, limit = 20): Promise<PromptHistoryEntry[]> {
    const results = await this.db.prepare(`
      SELECT * FROM image_prompt_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(userId, limit).all();

    return (results.results || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      originalInput: r.original_input,
      craftedPrompt: r.crafted_prompt,
      negativePrompt: r.negative_prompt,
      agent: r.agent,
      tier: r.tier,
      provider: r.provider,
      model: r.model,
      success: r.success === 1,
      rating: r.rating,
      feedback: r.feedback,
      createdAt: r.created_at,
    }));
  }

  /**
   * Get successful prompts for learning
   *
   * Returns highly-rated prompts to help the system improve.
   */
  async getSuccessfulPrompts(agent?: AgentType, limit = 10): Promise<PromptHistoryEntry[]> {
    let query = `
      SELECT * FROM image_prompt_history
      WHERE success = 1 AND (rating >= 4 OR rating IS NULL)
    `;
    const params: any[] = [];

    if (agent) {
      query += ` AND agent = ?`;
      params.push(agent);
    }

    query += ` ORDER BY rating DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    const results = await this.db.prepare(query).bind(...params).all();

    return (results.results || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      originalInput: r.original_input,
      craftedPrompt: r.crafted_prompt,
      negativePrompt: r.negative_prompt,
      agent: r.agent,
      tier: r.tier,
      provider: r.provider,
      model: r.model,
      success: r.success === 1,
      rating: r.rating,
      feedback: r.feedback,
      createdAt: r.created_at,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Private Helpers
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Build system prompt for LLM prompt crafting
   */
  private buildCraftingSystemPrompt(agent: AgentType, context: PromptContext): string {
    const agentTemplate = AGENT_TEMPLATES[agent];
    const tierModifiers = TIER_MODIFIERS[context.targetTier];
    const useCaseModifiers = USE_CASE_MODIFIERS[context.useCase] || [];

    return `You are ${agent}, an expert AI agent specializing in ${agentTemplate.description}.

Your task is to craft optimized prompts for AI image generation.

AGENT SPECIALTIES: ${agentTemplate.specialties.join(', ')}

QUALITY TIER (${context.targetTier}):
- Add these quality modifiers: ${tierModifiers.join(', ')}
- Adjust detail level appropriately

USE CASE (${context.useCase}):
- Add these modifiers: ${useCaseModifiers.join(', ')}

${context.style ? `STYLE GUIDE: ${context.style}` : ''}

CRAFTING RULES:
1. Start with the core subject from user input
2. Add appropriate style and quality modifiers
3. Include technical terms relevant to the specialty
4. Keep prompts concise but descriptive (50-150 words)
5. Suggest a negative prompt if helpful

Respond in JSON format:
{
  "prompt": "optimized prompt here",
  "negativePrompt": "what to avoid (optional)",
  "confidence": 0.0-1.0,
  "expectedImprovement": 0.0-1.0
}`;
  }

  /**
   * Parse LLM output into AgentPrompt structure
   */
  private parseCraftedPrompt(llmOutput: string, original: string): Partial<AgentPrompt> {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(llmOutput);
      return {
        prompt: parsed.prompt || llmOutput,
        negativePrompt: parsed.negativePrompt,
        confidence: parsed.confidence || 0.8,
        expectedImprovement: parsed.expectedImprovement || 0.3,
      };
    } catch {
      // Fallback: use the output directly as the prompt
      return {
        prompt: llmOutput,
        confidence: 0.7,
        expectedImprovement: 0.2,
      };
    }
  }

  /**
   * Fallback prompt crafting when LLM is unavailable
   */
  private fallbackPromptCraft(
    baseInput: string,
    context: PromptContext,
    agent: AgentType
  ): AgentPrompt {
    const agentTemplate = AGENT_TEMPLATES[agent];
    const tierModifiers = TIER_MODIFIERS[context.targetTier];
    const useCaseModifiers = USE_CASE_MODIFIERS[context.useCase] || [];

    // Build prompt from components
    const modifiers = [
      ...useCaseModifiers.slice(0, 2),
      ...tierModifiers.slice(0, 2),
      ...agentTemplate.styleModifiers.slice(0, 2),
    ];

    const craftedPrompt = `${baseInput}, ${modifiers.join(', ')}`;

    return {
      prompt: craftedPrompt,
      negativePrompt: undefined,
      agent,
      confidence: 0.6,  // Lower confidence for fallback
      suggestedTier: context.targetTier,
      expectedImprovement: 0.2,
      tags: [],
      craftedAt: new Date().toISOString(),
    };
  }

  /**
   * Select appropriate agent for refinement based on context
   */
  private selectAgentForRefinement(_request: PromptRefinementRequest): AgentType {
    // Simple heuristic - could be enhanced with ML
    return 'artist';  // Default to artist for general refinement
  }

  /**
   * Extract tags from prompt for categorization
   */
  private extractTags(prompt: string, specialties: string[]): string[] {
    const tags: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    for (const specialty of specialties) {
      if (lowerPrompt.includes(specialty.replace(/-/g, ' '))) {
        tags.push(specialty);
      }
    }

    return tags;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Prompt Enhancement Functions (no LLM required)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Quick prompt enhancement without agent
 *
 * Adds basic modifiers based on tier and use case.
 * Useful for rapid prototyping without LLM calls.
 */
export function enhancePromptQuick(
  basePrompt: string,
  tier: ImageQuality,
  useCase: string
): string {
  const tierModifiers = TIER_MODIFIERS[tier].slice(0, 2);
  const useCaseModifiers = USE_CASE_MODIFIERS[useCase]?.slice(0, 2) || [];

  const allModifiers = [...useCaseModifiers, ...tierModifiers];
  if (allModifiers.length === 0) return basePrompt;

  return `${basePrompt}, ${allModifiers.join(', ')}`;
}

/**
 * Generate negative prompt based on use case
 */
export function generateNegativePrompt(useCase: string): string {
  const commonNegatives = [
    'blurry', 'distorted', 'low quality', 'ugly', 'bad anatomy',
  ];

  const useCaseSpecific: Record<string, string[]> = {
    'asset': ['background', 'scene', 'environment', 'cluttered'],
    'ui-mockup': ['photo', 'realistic', 'grunge', 'textured'],
    'texture': ['seam', 'edge', 'border', 'non-tilable'],
    'icon': ['complex', 'detailed', 'realistic', 'photo'],
  };

  const negatives = [...commonNegatives];
  if (useCaseSpecific[useCase]) {
    negatives.push(...useCaseSpecific[useCase]);
  }

  return negatives.join(', ');
}
