/**
 * Gameplay State Module
 *
 * Handles vibe-coded gameplay rule mutations.
 * Integrates with LimboAI behavior trees and Godot game state.
 */

import type {
  BeingStateEnv,
  GameplayState,
  GameplayStateConfig,
  GameplayMutation,
  GameplayMutationType,
  BehaviorModification,
  GodotCommand,
} from './types';

// ============================================================================
// Gameplay State Presets
// ============================================================================

interface GameplayPreset {
  mutations: GameplayMutation[];
  vibePrompt: string;
  behaviorMods?: BehaviorModification[];
}

const GAMEPLAY_PRESETS: Record<GameplayState, GameplayPreset> = {
  chaotic: {
    mutations: [
      {
        id: 'chaos_gravity',
        type: 'physics',
        rule: 'gravity',
        value: { x: 0, y: -5, z: 0 }, // Reduced gravity
      },
      {
        id: 'chaos_time',
        type: 'time',
        rule: 'time_scale',
        value: { min: 0.5, max: 2.0, change_rate: 0.1 },
      },
      {
        id: 'chaos_cooldown',
        type: 'cooldown',
        rule: 'ability_cooldown_multiplier',
        value: 0.5, // Faster cooldowns
      },
    ],
    vibePrompt: 'Create unpredictable, chaotic gameplay where rules shift dynamically. Random events should occur frequently, physics should feel unstable, and players should expect the unexpected.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'chaotic_behavior',
        params: {
          randomness: 0.8,
          reaction_variance: 0.9,
        },
      },
    ],
  },

  ordered: {
    mutations: [
      {
        id: 'order_gravity',
        type: 'physics',
        rule: 'gravity',
        value: { x: 0, y: -9.8, z: 0 }, // Standard gravity
      },
      {
        id: 'order_time',
        type: 'time',
        rule: 'time_scale',
        value: 1.0, // Normal time
      },
      {
        id: 'order_precision',
        type: 'combat',
        rule: 'hitbox_accuracy',
        value: 1.0,
      },
    ],
    vibePrompt: 'Create structured, predictable gameplay where rules are consistent and fair. Players can plan ahead with confidence, and outcomes follow logical cause-and-effect patterns.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'tactical_behavior',
        params: {
          planning_depth: 5,
          coordination_bonus: 0.3,
        },
      },
    ],
  },

  dreamlike: {
    mutations: [
      {
        id: 'dream_gravity',
        type: 'physics',
        rule: 'gravity',
        value: { x: 0, y: -2, z: 0 }, // Low gravity
      },
      {
        id: 'dream_physics',
        type: 'physics',
        rule: 'friction',
        value: 0.1,
      },
      {
        id: 'dream_camera',
        type: 'camera',
        rule: 'camera_smooth',
        value: 0.95, // Very smooth camera
      },
    ],
    vibePrompt: 'Create surreal, dreamlike gameplay where logic is fluid. Objects may behave unexpectedly, reality shifts like dreams, and cause-and-effect follow dream logic rather than physical laws.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'dream_behavior',
        params: {
          surrealist: true,
          logic_defiance: 0.7,
        },
      },
    ],
  },

  survival: {
    mutations: [
      {
        id: 'survival_health',
        type: 'combat',
        rule: 'player_health_multiplier',
        value: 0.5,
      },
      {
        id: 'survival_resources',
        type: 'resource',
        rule: 'resource_gather_rate',
        value: 0.7,
      },
      {
        id: 'survival_perma',
        type: 'gameplay',
        rule: 'permadeath',
        value: true,
      },
    ],
    vibePrompt: 'Create high-stakes survival gameplay with scarce resources and permanent consequences. Every decision matters, and death has meaningful penalties.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'survival_behavior',
        params: {
          risk_aversion: 0.7,
          resource_hoarding: 0.8,
        },
      },
    ],
  },

  creative: {
    mutations: [
      {
        id: 'creative_build',
        type: 'gameplay',
        rule: 'build_mode_enabled',
        value: true,
      },
      {
        id: 'creative_resources',
        type: 'resource',
        rule: 'unlimited_resources',
        value: true,
      },
      {
        id: 'creative_damage',
        type: 'combat',
        rule: 'damage_enabled',
        value: false,
      },
    ],
    vibePrompt: 'Create freeform creative gameplay focused on building and expression. Remove restrictions, provide abundant tools, and let players create without limits.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'assistive_behavior',
        params: {
          helpfulness: 1.0,
          suggestions: true,
        },
      },
    ],
  },

  competitive: {
    mutations: [
      {
        id: 'comp_scoring',
        type: 'gameplay',
        rule: 'score_visibility',
        value: 'always',
      },
      {
        id: 'comp_ranking',
        type: 'gameplay',
        rule: 'ranked_mode',
        value: true,
      },
      {
        id: 'comp_balance',
        type: 'combat',
        rule: 'auto_balance',
        value: true,
      },
    ],
    vibePrompt: 'Create competitive PVP gameplay with clear scoring, rankings, and balanced matchups. Players should feel tested and rewarded for skill.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'competitive_behavior',
        params: {
          aggression: 0.8,
          target_priority: 'weakest',
        },
      },
    ],
  },

  cooperative: {
    mutations: [
      {
        id: 'coop_sharing',
        type: 'resource',
        rule: 'resource_sharing_enabled',
        value: true,
      },
      {
        id: 'coop_revive',
        type: 'combat',
        rule: 'ally_revive_enabled',
        value: true,
      },
      {
        id: 'coop_bonus',
        type: 'gameplay',
        rule: 'proximity_bonus',
        value: 0.2, // Bonus for working together
      },
    ],
    vibePrompt: 'Create cooperative gameplay where teamwork is rewarded and players support each other. Shared objectives, mutual benefits, and symbiotic mechanics.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'cooperative_behavior',
        params: {
          support_focus: 0.9,
          ally_protection: 0.8,
        },
      },
    ],
  },

  exploration: {
    mutations: [
      {
        id: 'explore_vision',
        type: 'gameplay',
        rule: 'fog_of_war_enabled',
        value: true,
      },
      {
        id: 'explore_rewards',
        type: 'gameplay',
        rule: 'discovery_xp_multiplier',
        value: 2.0,
      },
      {
        id: 'explore_markers',
        type: 'ui',
        rule: 'show_unexplored_markers',
        value: true,
      },
    ],
    vibePrompt: 'Create exploration-focused gameplay with fog of war, discovery rewards, and environmental storytelling. Players should feel rewarded for curiosity.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'exploration_behavior',
        params: {
          curiosity: 0.9,
          scouting_priority: 0.8,
        },
      },
    ],
  },

  puzzle: {
    mutations: [
      {
        id: 'puzzle_time',
        type: 'time',
        rule: 'time_scale',
        value: { can_pause: true },
      },
      {
        id: 'puzzle_hints',
        type: 'ui',
        rule: 'hint_system_enabled',
        value: true,
      },
      {
        id: 'puzzle_combat',
        type: 'combat',
        rule: 'combat_enabled',
        value: false,
      },
    ],
    vibePrompt: 'Create puzzle-focused gameplay with logic challenges, constraint-based solutions, and hint systems. Combat is disabled to focus on mental challenges.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'puzzle_behavior',
        params: {
          hints_allowed: true,
          solution_visibility: 'partial',
        },
      },
    ],
  },

  narrative: {
    mutations: [
      {
        id: 'narrative_dialogue',
        type: 'ui',
        rule: 'dialogue_system_enabled',
        value: true,
      },
      {
        id: 'narrative_branching',
        type: 'gameplay',
        rule: 'branching_narrative_enabled',
        value: true,
      },
      {
        id: 'narrative_save',
        type: 'gameplay',
        rule: 'auto_save_points',
        value: 'narrative_beat',
      },
    ],
    vibePrompt: 'Create story-driven gameplay with branching narrative, meaningful dialogue choices, and character development. Player choices should have visible consequences.',
    behaviorMods: [
      {
        agentId: '*',
        behaviorName: 'narrative_behavior',
        params: {
          dialogue_priority: 0.9,
          story_awareness: 0.8,
        },
      },
    ],
  },
};

// ============================================================================
// LimboAI Behavior Tree Templates
// ============================================================================

const BEHAVIOR_TREES: Record<string, string> = {
  chaotic_behavior: `
root: sequence
  - random_selector
    - patrol_random
    - emote_random
    - attack_random
    - flee_random
  - wait: duration = {randomness}
`,

  tactical_behavior: `
root: selector
  - sequence: under_attack
    - detect_threat
    - call_allies
    - flank_or_retreat
  - sequence: combat_advantage
    - assess_situation
    - execute_tactical_plan
    - coordinate_team
  - patrol_optimal
`,

  survival_behavior: `
root: selector
  - sequence: critical_health
    - find_cover
    - wait_for_heal
    - signal_ally
  - sequence: low_resources
    - scavenge_priority
    - hoard_resources
    - avoid_conflict
  - cautious_patrol
`,

  cooperative_behavior: `
root: selector
  - sequence: ally_needs_help
    - detect_ally_distress
    - move_to_ally
    - provide_support
  - sequence: shared_objective
    - check_team_objective
    - coordinate_with_team
    - execute_role
  - follow_leader
`,

  exploration_behavior: `
root: selector
  - sequence: unexplored_nearby
    - detect_unexplored
    - mark_for_exploration
    - investigate_point
  - sequence: resource_node
    - detect_resource
    - mark_for_collection
    - move_to_resource
  - wander_explore
`,
};

// ============================================================================
// Gameplay State Manager Class
// ============================================================================

export class GameplayStateManager {
  private env: BeingStateEnv;
  private mutationCache: Map<string, GameplayMutation[]> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Gameplay State Generation
  // ========================================================================

  /**
   * Generate gameplay state configuration
   */
  async generateConfig(
    state: GameplayState,
    intensity: number
  ): Promise<GameplayStateConfig> {
    const preset = GAMEPLAY_PRESETS[state];

    return {
      state,
      mutations: this.scaleMutations(preset.mutations, intensity),
      vibePrompt: preset.vibePrompt,
      behaviorMods: preset.behaviorMods,
    };
  }

  /**
   * Generate vibe-coded rule modifications using AI
   */
  async generateVibeCodedMutations(
    prompt: string,
    currentRules: Record<string, unknown>,
    intensity: number
  ): Promise<GameplayMutation[]> {
    // Check cache first
    const cacheKey = `${prompt}_${intensity}`;
    if (this.mutationCache.has(cacheKey)) {
      return this.mutationCache.get(cacheKey)!;
    }

    // In production, this would call an LLM to generate mutations
    // For now, return placeholder mutations based on prompt analysis

    const mutations: GameplayMutation[] = [];

    // Analyze prompt for key concepts
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('chaos') || lowerPrompt.includes('random')) {
      mutations.push({
        id: `vibe_chaos_${crypto.randomUUID()}`,
        type: 'physics',
        rule: 'random_events_enabled',
        value: true,
      });
    }

    if (lowerPrompt.includes('fast') || lowerPrompt.includes('speed')) {
      mutations.push({
        id: `vibe_speed_${crypto.randomUUID()}`,
        type: 'movement',
        rule: 'movement_speed_multiplier',
        value: 1.0 + intensity * 0.5,
      });
    }

    if (lowerPrompt.includes('slow') || lowerPrompt.includes('deliberate')) {
      mutations.push({
        id: `vibe_slow_${crypto.randomUUID()}`,
        type: 'time',
        rule: 'time_scale',
        value: Math.max(0.25, 1.0 - intensity * 0.5),
      });
    }

    if (lowerPrompt.includes('danger') || lowerPrompt.includes('threat')) {
      mutations.push({
        id: `vibe_danger_${crypto.randomUUID()}`,
        type: 'combat',
        rule: 'enemy_damage_multiplier',
        value: 1.0 + intensity * 0.5,
      });
    }

    // Cache results
    this.mutationCache.set(cacheKey, mutations);

    return mutations;
  }

  // ========================================================================
  // Mutation Management
  // ========================================================================

  /**
   * Apply gameplay mutation
   */
  async applyMutation(
    sessionId: string,
    mutation: GameplayMutation
  ): Promise<boolean> {
    // Store mutation in database
    if (this.env.BEING_STATE_DB) {
      await this.env.BEING_STATE_DB.prepare(`
        INSERT INTO gameplay_mutations (
          id, session_id, type, rule, value, duration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        mutation.id,
        sessionId,
        mutation.type,
        mutation.rule,
        JSON.stringify(mutation.value),
        mutation.duration ?? null,
        Date.now()
      ).run();
    }

    return true;
  }

  /**
   * Remove gameplay mutation
   */
  async removeMutation(sessionId: string, mutationId: string): Promise<boolean> {
    if (this.env.BEING_STATE_DB) {
      await this.env.BEING_STATE_DB.prepare(`
        DELETE FROM gameplay_mutations
        WHERE session_id = ? AND id = ?
      `).bind(sessionId, mutationId).run();
    }

    return true;
  }

  /**
   * Get active mutations for session
   */
  async getActiveMutations(sessionId: string): Promise<GameplayMutation[]> {
    if (!this.env.BEING_STATE_DB) {
      return [];
    }

    const result = await this.env.BEING_STATE_DB.prepare(`
      SELECT * FROM gameplay_mutations
      WHERE session_id = ?
      AND (duration IS NULL OR created_at + duration * 1000 > ?)
      ORDER BY created_at DESC
    `).bind(sessionId, Date.now()).all();

    return result.results.map((row: any) => ({
      id: row.id,
      type: row.type,
      rule: row.rule,
      value: JSON.parse(row.value),
      duration: row.duration,
    }));
  }

  // ========================================================================
  // Behavior Tree Generation
  // ========================================================================

  /**
   * Generate LimboAI behavior tree code
   */
  generateBehaviorTree(
    behaviorName: string,
    params: Record<string, unknown>
  ): string {
    const template = BEHAVIOR_TREES[behaviorName];

    if (!template) {
      return this.generateDefaultBehaviorTree(params);
    }

    // Substitute parameters
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{${key}}`;
      result = result.replaceAll(placeholder, String(value));
    }

    return result;
  }

  /**
   * Generate default behavior tree from params
   */
  private generateDefaultBehaviorTree(params: Record<string, unknown>): string {
    return `
root: selector
  - sequence: player_visible
    - detect_player
    - evaluate_action
  - patrol_area
  - idle_wait
`;
  }

  /**
   * Generate behavior modification for agent
   */
  generateBehaviorModification(
    agentId: string,
    state: GameplayState,
    params: Record<string, unknown> = {}
  ): BehaviorModification {
    const preset = GAMEPLAY_PRESETS[state];
    const behaviorMod = preset.behaviorMods?.find((m) => m.agentId === '*' || m.agentId === agentId);

    return {
      agentId,
      behaviorName: behaviorMod?.behaviorName || `${state}_behavior`,
      subtree: this.generateBehaviorTree(
        behaviorMod?.behaviorName || `${state}_behavior`,
        { ...behaviorMod?.params, ...params }
      ),
      params: { ...behaviorMod?.params, ...params },
    };
  }

  // ========================================================================
  // Rule Conflict Resolution
  // ========================================================================

  /**
   * Resolve conflicts between mutations
   */
  resolveConflicts(mutations: GameplayMutation[]): GameplayMutation[] {
    const resolved: GameplayMutation[] = [];
    const ruleMap = new Map<string, GameplayMutation>();

    // Sort by creation time (newer wins)
    const sorted = [...mutations].sort((a, b) => {
      // In production, would use timestamps
      return 0;
    });

    for (const mutation of sorted) {
      const existing = ruleMap.get(mutation.rule);

      if (!existing) {
        ruleMap.set(mutation.rule, mutation);
        resolved.push(mutation);
      } else {
        // Merge compatible mutations, replace conflicting ones
        if (this.canMerge(existing, mutation)) {
          const merged = this.mergeMutations(existing, mutation);
          ruleMap.set(mutation.rule, merged);
          const index = resolved.indexOf(existing);
          resolved[index] = merged;
        } else {
          // Replace with newer mutation
          ruleMap.set(mutation.rule, mutation);
          const index = resolved.indexOf(existing);
          resolved[index] = mutation;
        }
      }
    }

    return resolved;
  }

  /**
   * Check if two mutations can be merged
   */
  private canMerge(a: GameplayMutation, b: GameplayMutation): boolean {
    // Mutations of different types generally can't merge
    if (a.type !== b.type) return false;

    // Some types are mergeable
    const mergeableTypes: GameplayMutationType[] = ['movement', 'cooldown', 'resource'];
    return mergeableTypes.includes(a.type);
  }

  /**
   * Merge two compatible mutations
   */
  private mergeMutations(a: GameplayMutation, b: GameplayMutation): GameplayMutation {
    return {
      ...a,
      id: `merged_${a.id}_${b.id}`,
      value: this.mergeValues(a.value, b.value),
    };
  }

  /**
   * Merge mutation values
   */
  private mergeValues(a: unknown, b: unknown): unknown {
    if (typeof a === 'number' && typeof b === 'number') {
      return (a + b) / 2;
    }

    if (typeof a === 'object' && typeof b === 'object' && a && b) {
      return { ...a as Record<string, unknown>, ...b as Record<string, unknown> };
    }

    return b; // Default to newer value
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Scale mutations by intensity
   */
  private scaleMutations(mutations: GameplayMutation[], intensity: number): GameplayMutation[] {
    return mutations.map((m) => {
      const scaled: GameplayMutation = { ...m };

      if (typeof m.value === 'number') {
        // Scale numeric values
        if (m.value > 0 && m.value < 1) {
          // Multipliers get scaled toward 1
          scaled.value = m.value + (1 - m.value) * (1 - intensity);
        } else if (m.value >= 1) {
          // Values >= 1 get scaled toward 1
          scaled.value = 1 + (m.value - 1) * intensity;
        }
      } else if (typeof m.value === 'object' && m.value) {
        // Handle object values
        if (typeof (m.value as Record<string, unknown>).min === 'number') {
          const obj = m.value as Record<string, unknown>;
          scaled.value = {
            min: (obj.min as number),
            max: (obj.max as number),
            change_rate: ((obj.change_rate as number) ?? 0.1) * intensity,
          };
        }
      }

      return scaled;
    });
  }

  // ========================================================================
  // Godot Bridge Integration
  // ========================================================================

  /**
   * Convert mutations to Godot commands
   */
  toGodotCommands(mutations: GameplayMutation[]): string[] {
    const commands: string[] = [];

    for (const mutation of mutations) {
      switch (mutation.type) {
        case 'movement':
          commands.push(
            `rpc_call("/root/GameRules", "set_movement_modifier", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;

        case 'combat':
          commands.push(
            `rpc_call("/root/GameRules", "set_combat_modifier", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;

        case 'resource':
          commands.push(
            `rpc_call("/root/GameRules", "set_resource_modifier", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;

        case 'physics':
          commands.push(
            `rpc_call("/root/PhysicsManager", "set_parameter", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;

        case 'time':
          commands.push(
            `rpc_call("/root/Engine", "set_time_scale", ${JSON.stringify(mutation.value)})`
          );
          break;

        case 'camera':
          commands.push(
            `rpc_call("/root/Camera", "set_parameter", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;

        case 'gameplay':
          commands.push(
            `rpc_call("/root/GameRules", "set_rule", ` +
            `{"rule": "${mutation.rule}", "value": ${JSON.stringify(mutation.value)}})`
          );
          break;
      }
    }

    return commands;
  }

  /**
   * Generate behavior tree update command
   */
  generateBehaviorCommand(mod: BehaviorModification): string {
    return `rpc_call("${mod.agentId}", "update_behavior_tree", ` +
      `{"tree": \`${mod.subtree}\`, "params": ${JSON.stringify(mod.params)}})`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createGameplayStateManager(env: BeingStateEnv): GameplayStateManager {
  return new GameplayStateManager(env);
}
