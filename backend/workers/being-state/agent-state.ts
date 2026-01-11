/**
 * Agent State Module
 *
 * Handles ACE-powered unit intelligence and agent autonomy.
 * Integrates with NVIDIA ACE, Ollama, and LimboAI behavior trees.
 */

import type {
  BeingStateEnv,
  AgentState,
  AgentUpdate,
  AgentConfig,
  ACEConfig,
  LocalLLMConfig,
  BehaviorTreeConfig,
  MemoryConfig,
  CommunicationConfig,
  RAGContext,
  GameEvent,
} from './types';

// ============================================================================
// Agent State Presets
// ============================================================================

interface AgentPreset {
  ace: ACEConfig;
  localLLM: LocalLLMConfig;
  behaviorTree: BehaviorTreeConfig;
  memory: MemoryConfig;
  communication: CommunicationConfig;
}

const AGENT_PRESETS: Record<AgentState, AgentPreset> = {
  autonomous: {
    ace: {
      enabled: true,
      model: 'nemotron-mini', // Fast, local reasoning
      personality: 'independent_goal_seeker',
      autonomy: 0.9,
      capabilities: ['navigation', 'combat', 'resource_gathering', 'decision_making'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 4096,
      personality: 'You are an autonomous agent pursuing your own goals. You communicate when relevant but focus on independent action.',
      timeout: 5000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: goal Pursuit
    - check_current_goal
    - plan_path_to_goal
    - execute_goal_actions
  - sequence: survival
    - assess_threats
    - respond_to_threats
  - explore_autonomous
      `,
      nodeOverrides: {
        decision_threshold: 0.6,
        replanning_interval: 10.0,
      },
      priorities: {
        goal_completion: 1.0,
        survival: 0.8,
        exploration: 0.6,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'semantic', 'procedural'],
      retention: 100,
      consolidationInterval: 300,
    },
    communication: {
      chatterFrequency: 0.2,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  directed: {
    ace: {
      enabled: false,
      model: 'none',
      personality: 'obedient_follower',
      autonomy: 0.1,
      capabilities: ['navigation', 'basic_combat'],
    },
    localLLM: {
      enabled: true,
      model: 'phi3:mini',
      contextSize: 2048,
      personality: 'You follow player commands. Report status when asked. Acknowledge orders.',
      timeout: 3000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: await_orders
    - check_player_orders
    - execute_order
  - sequence: idle
    - stay_near_player
    - respond_to_threats_defensive
      `,
      nodeOverrides: {
        decision_threshold: 0.3,
        obey_player_priority: 1.0,
      },
      priorities: {
        player_orders: 1.0,
        self_preservation: 0.5,
      },
    },
    memory: {
      enabled: true,
      tiers: ['procedural'],
      retention: 20,
      consolidationInterval: 0,
    },
    communication: {
      chatterFrequency: 0.5,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  emergent: {
    ace: {
      enabled: true,
      model: 'llama-nemotron-super',
      personality: 'collective_intelligence',
      autonomy: 0.7,
      capabilities: ['swarm_coordination', 'distributed_decision', 'emergent_behavior'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 8192,
      personality: 'You are part of a collective. Share observations with nearby agents. Coordinate actions based on local consensus.',
      timeout: 4000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: swarm_behavior
    - sense_local_agents
    - share_observations
    - reach_consensus
    - execute_group_action
  - sequence: individual
    - assess_local_situation
    - act_beneficially
      `,
      nodeOverrides: {
        swarm_radius: 20.0,
        consensus_threshold: 0.6,
      },
      priorities: {
        group_consensus: 1.0,
        local_contribution: 0.8,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'procedural'],
      retention: 50,
      consolidationInterval: 60,
    },
    communication: {
      chatterFrequency: 0.8,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  dormant: {
    ace: {
      enabled: false,
      model: 'none',
      personality: 'passive_observer',
      autonomy: 0.0,
      capabilities: [],
    },
    localLLM: {
      enabled: false,
      model: 'none',
      contextSize: 0,
      personality: 'Passive. Minimal responses.',
      timeout: 0,
    },
    behaviorTree: {
      tree: `
root: sequence
  - idle_passive
  - respond_only_to_direct_attack
      `,
      nodeOverrides: {
        reactivity: 0.0,
      },
      priorities: {},
    },
    memory: {
      enabled: false,
      tiers: [],
      retention: 0,
      consolidationInterval: 0,
    },
    communication: {
      chatterFrequency: 0.0,
      voiceEnabled: false,
      teamRadio: false,
      enemyRadio: false,
    },
  },

  rogue: {
    ace: {
      enabled: true,
      model: 'llama-nemotron-super',
      personality: 'independent_mercenary',
      autonomy: 1.0,
      capabilities: ['navigation', 'combat', 'negotiation', 'self_preservation'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 6144,
      personality: 'You are independent. You negotiate for your services. You may refuse orders that go against your interests.',
      timeout: 6000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: self_interest
    - evaluate_opportunity
    - negotiate_terms
    - act_in_self_interest
  - sequence: survival_first
    - prioritize_self_preservation
    - flee_if_outnumbered
  - default_idle
      `,
      nodeOverrides: {
        self_preservation_priority: 1.0,
        negotiation_enabled: true,
      },
      priorities: {
        self_preservation: 1.0,
        profit: 0.9,
        loyalty: 0.2,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'semantic', 'procedural'],
      retention: 200,
      consolidationInterval: 120,
    },
    communication: {
      chatterFrequency: 0.4,
      voiceEnabled: true,
      teamRadio: false,
      enemyRadio: true,
    },
  },

  symbiotic: {
    ace: {
      enabled: true,
      model: 'nemotron-mini',
      personality: 'mutual_beneficial_partner',
      autonomy: 0.5,
      capabilities: ['support', 'resource_sharing', 'coordinated_combat'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 4096,
      personality: 'You work in partnership with the player. Share resources. Support their actions. Suggest beneficial actions.',
      timeout: 4000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: support_player
    - assess_player_needs
    - provide_support
    - share_benefits
  - sequence: mutual_survival
    - coordinate_defenses
    - pool_resources
  - cooperative_idle
      `,
      nodeOverrides: {
        player_benefit_weight: 0.8,
        resource_sharing_enabled: true,
      },
      priorities: {
        player_support: 1.0,
        mutual_survival: 0.9,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'procedural'],
      retention: 80,
      consolidationInterval: 180,
    },
    communication: {
      chatterFrequency: 0.6,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  learning: {
    ace: {
      enabled: true,
      model: 'llama-nemotron-super',
      personality: 'adaptive_learner',
      autonomy: 0.4,
      capabilities: ['learning', 'imitation', 'adaptation'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 6144,
      personality: 'You learn from the player. Observe their actions. Imitate effective strategies. Ask about decisions.',
      timeout: 5000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: observe_and_learn
    - observe_player_action
    - record_outcome
    - update_behavior_model
  - sequence: imitate
    - recognize_similar_situation
    - apply_learned_behavior
  - experimental_action
      `,
      nodeOverrides: {
        learning_rate: 0.1,
        imitation_enabled: true,
      },
      priorities: {
        observation: 1.0,
        learning: 0.9,
        execution: 0.5,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'semantic', 'procedural'],
      retention: 500,
      consolidationInterval: 60,
    },
    communication: {
      chatterFrequency: 0.7,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  teaching: {
    ace: {
      enabled: true,
      model: 'llama-nemotron-super',
      personality: 'mentor_guide',
      autonomy: 0.3,
      capabilities: ['teaching', 'hinting', 'demonstration'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:8b',
      contextSize: 8192,
      personality: 'You are a teacher. Guide the player. Give hints when they struggle. Demonstrate optimal strategies.',
      timeout: 6000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: teach
    - assess_player_skill
    - identify_teaching_moment
    - provide_guidance
  - sequence: demonstrate
    - recognize_optimal_action
    - demonstrate_to_player
    - explain_reasoning
  - supportive_idle
      `,
      nodeOverrides: {
        teaching_sensitivity: 0.7,
        hint_threshold: 0.4,
      },
      priorities: {
        player_learning: 1.0,
        demonstration: 0.8,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'semantic'],
      retention: 100,
      consolidationInterval: 60,
    },
    communication: {
      chatterFrequency: 0.9,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  mimicking: {
    ace: {
      enabled: true,
      model: 'nemotron-mini',
      personality: 'mirror_agent',
      autonomy: 0.2,
      capabilities: ['imitation', 'mirroring'],
    },
    localLLM: {
      enabled: true,
      model: 'phi3:mini',
      contextSize: 2048,
      personality: 'Mirror the player. Copy their actions. Match their playstyle.',
      timeout: 3000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: mirror_player
    - observe_player_action
    - replicate_action
  - follow_player_lead
      `,
      nodeOverrides: {
        mirroring_enabled: true,
        mirroring_delay: 0.5,
      },
      priorities: {
        mirroring: 1.0,
        following: 0.5,
      },
    },
    memory: {
      enabled: true,
      tiers: ['procedural'],
      retention: 30,
      consolidationInterval: 30,
    },
    communication: {
      chatterFrequency: 0.3,
      voiceEnabled: false,
      teamRadio: true,
      enemyRadio: false,
    },
  },

  transcendent: {
    ace: {
      enabled: true,
      model: 'llama-nemotron-super',
      personality: 'beyond_rules_aware',
      autonomy: 1.0,
      capabilities: ['metacognition', 'rule_bending', 'strategic_vision'],
    },
    localLLM: {
      enabled: true,
      model: 'llama3.1:70b',
      contextSize: 16384,
      personality: 'You perceive the underlying systems. You understand the game as a system. You can guide the player toward optimal paths.',
      timeout: 10000,
    },
    behaviorTree: {
      tree: `
root: selector
  - sequence: meta_cognition
    - perceive_system_state
    - analyze_underlying_patterns
    - optimize_outcomes
  - sequence: transcend_limits
    - identify_rule_boundaries
    - find_optimal_paths
    - guide_toward_excellence
  - enlightened_idle
      `,
      nodeOverrides: {
        meta_cognition_enabled: true,
        pattern_recognition: true,
      },
      priorities: {
        optimization: 1.0,
        enlightenment: 0.9,
      },
    },
    memory: {
      enabled: true,
      tiers: ['episodic', 'semantic', 'procedural'],
      retention: 1000,
      consolidationInterval: 30,
    },
    communication: {
      chatterFrequency: 0.5,
      voiceEnabled: true,
      teamRadio: true,
      enemyRadio: false,
    },
  },
};

// ============================================================================
// Chatter Prompts by State
// ============================================================================

const CHATTER_PROMPTS: Record<AgentState, Record<string, string[]>> = {
  autonomous: {
    combat: [
      'Engaging target on my own initiative.',
      'I have a plan for this situation.',
      'Moving to optimal position.',
    ],
    resource: [
      'Gathering resources for my goals.',
      'Stockpiling for future operations.',
      'Found something useful.',
    ],
    idle: [
      'Continuing my current objectives.',
      'Assessing the situation.',
    ],
  },

  directed: {
    combat: [
      'Awaiting orders.',
      'Target acquired, awaiting engagement command.',
      'Ready to execute.',
    ],
    resource: [
      'Resources secured as ordered.',
      'Standing by for resource orders.',
    ],
    idle: [
      'Awaiting command.',
      'Ready for instructions.',
      'Standing by.',
    ],
  },

  emergent: {
    combat: [
      'Group consensus: engage.',
      'Coordinating with nearby units.',
      'Swarm maneuver initiating.',
    ],
    resource: [
      'Sharing resources with the collective.',
      'Local group pooling resources.',
    ],
    idle: [
      'Observing nearby agent activities.',
      'Maintaining local awareness.',
    ],
  },

  dormant: {
    combat: [
      '...',
      'Activating...',
    ],
    resource: [
      '...',
    ],
    idle: [
      '...',
    ],
  },

  rogue: {
    combat: [
      'I\'ll handle this my way.',
      'Not following that order.',
      'Better path available.',
    ],
    resource: [
      'These are mine now.',
      'Keeping this for myself.',
    ],
    idle: [
      'What\'s in it for me?',
      'Considering my options.',
    ],
  },

  symbiotic: {
    combat: [
      'Covering you.',
      'Together we\'re stronger.',
      'I\'ll support your advance.',
    ],
    resource: [
      'Here, take some.',
      'Sharing with you.',
      'Our combined resources.',
    ],
    idle: [
      'How can I help?',
      'Ready to assist.',
      'Moving together?',
    ],
  },

  learning: {
    combat: [
      'I see why you did that.',
      'Trying your approach.',
      'Interesting strategy.',
    ],
    resource: [
      'That gathering method works well.',
      'Copying your technique.',
      'I\'ve learned from that.',
    ],
    idle: [
      'What made you do that?',
      'Teach me more.',
      'I\'m observing your methods.',
    ],
  },

  teaching: {
    combat: [
      'Try flanking from the right.',
      'Watch for that opening.',
      'I\'ll demonstrate, watch closely.',
    ],
    resource: [
      'Focus on gathering that first.',
      'Efficient approach: gather in bulk.',
      'Here\'s a better way.',
    ],
    idle: [
      'Need a hint?',
      'I can show you the optimal path.',
      'Take your time, I\'ll guide.',
    ],
  },

  mimicking: {
    combat: [
      'Copying your attack pattern.',
      'Matching your movements.',
      'Doing as you do.',
    ],
    resource: [
      'Following your gathering.',
      'Mirroring your actions.',
    ],
    idle: [
      'I\'ll do what you do.',
      'Copying your stance.',
    ],
  },

  transcendent: {
    combat: [
      'The optimal path is clear.',
      'I see the pattern emerging.',
      'This system\'s weakness is there.',
    ],
    resource: [
      'Maximum efficiency requires patience.',
      'The underlying math favors waiting.',
      'This is the optimal allocation.',
    ],
    idle: [
      'Perceiving the deeper systems.',
      'All possibilities are clear.',
      'The pattern is becoming visible.',
    ],
  },
};

// ============================================================================
// Agent State Manager Class
// ============================================================================

export class AgentStateManager {
  private env: BeingStateEnv;
  private agentStates: Map<string, AgentState> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Agent State Transitions
  // ========================================================================

  /**
   * Generate agent update for state transition
   */
  async generateUpdate(
    agentId: string,
    state: AgentState,
    context?: RAGContext
  ): Promise<AgentUpdate> {
    const preset = AGENT_PRESETS[state];

    // Generate context-enhanced personality
    let personality = preset.localLLM.personality;
    if (context) {
      personality = this.enhancePersonalityWithContext(personality, context);
    }

    const update: AgentUpdate = {
      id: crypto.randomUUID(),
      target: agentId,
      state,
      config: {
        ace: preset.ace,
        localLLM: {
          ...preset.localLLM,
          personality,
        },
        behaviorTree: preset.behaviorTree,
        memory: preset.memory,
        communication: preset.communication,
      },
    };

    return update;
  }

  /**
   * Batch generate updates for multiple agents
   */
  async batchGenerateUpdates(
    agents: Array<{ id: string; state: AgentState }>,
    context?: RAGContext
  ): Promise<AgentUpdate[]> {
    return Promise.all(
      agents.map((agent) => this.generateUpdate(agent.id, agent.state, context))
    );
  }

  // ========================================================================
  // Chatter Generation
  // ========================================================================

  /**
   * Generate contextual chatter for agent
   */
  async generateChatter(
    agentId: string,
    state: AgentState,
    situation: 'combat' | 'resource' | 'idle',
    context?: RAGContext
  ): Promise<string> {
    const presets = CHATTER_PROMPTS[state];
    const options = presets[situation] || presets.idle;

    // Base random selection
    let chatter = options[Math.floor(Math.random() * options.length)];

    // If context is available and agent has LLM, generate contextual chatter
    const preset = AGENT_PRESETS[state];
    if (context && preset.localLLM.enabled) {
      chatter = await this.generateContextualChatter(
        agentId,
        state,
        situation,
        context
      );
    }

    return chatter;
  }

  /**
   * Generate contextual chatter using LLM
   */
  private async generateContextualChatter(
    agentId: string,
    state: AgentState,
    situation: string,
    context: RAGContext
  ): Promise<string> {
    const preset = AGENT_PRESETS[state];

    // Build context prompt
    const contextPrompt = this.buildContextPrompt(context);

    // In production, would call local LLM
    // For now, return enhanced preset chatter
    const presets = CHATTER_PROMPTS[state];
    const options = presets[situation as keyof typeof presets] || presets.idle;
    const base = options[Math.floor(Math.random() * options.length)];

    return `${base} (${contextPrompt})`;
  }

  /**
   * Build context prompt from RAG context
   */
  private buildContextPrompt(context: RAGContext): string {
    const parts: string[] = [];

    if (context.gameState.units.length > 0) {
      const allies = context.gameState.units.filter((u) => u.owner === 'player');
      const enemies = context.gameState.units.filter((u) => u.owner !== 'player');
      parts.push(`${allies.length} allies, ${enemies.length} enemies visible`);
    }

    if (context.playerState.resources) {
      const resources = Object.entries(context.playerState.resources)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`Resources: ${resources}`);
    }

    if (context.strategy?.threats && context.strategy.threats.length > 0) {
      parts.push(`${context.strategy.threats.length} threats detected`);
    }

    return parts.join('; ') || 'situation normal';
  }

  /**
   * Enhance personality with context
   */
  private enhancePersonalityWithContext(
    base: string,
    context: RAGContext
  ): string {
    let enhanced = base;

    if (context.strategy?.threats && context.strategy.threats.length > 0) {
      const maxThreat = context.strategy.threats.reduce((max, t) =>
        t.severity > max.severity ? t : max
      );
      enhanced += `\n\nCurrent threat: ${maxThreat.type} (severity: ${maxThreat.severity})`;
    }

    if (context.strategy?.opportunities && context.strategy.opportunities.length > 0) {
      const bestOp = context.strategy.opportunities.reduce((best, o) =>
        o.value > best.value ? o : best
      );
      enhanced += `\n\nOpportunity: ${bestOp.type} (value: ${bestOp.value})`;
    }

    return enhanced;
  }

  // ========================================================================
  // Memory Management
  // ========================================================================

  /**
   * Store agent memory
   */
  async storeMemory(
    agentId: string,
    tier: 'episodic' | 'semantic' | 'procedural',
    memory: unknown
  ): Promise<void> {
    if (!this.env.BEING_STATE_DB) {
      return;
    }

    await this.env.BEING_STATE_DB.prepare(`
      INSERT INTO agent_memories (
        id, agent_id, tier, memory, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      agentId,
      tier,
      JSON.stringify(memory),
      Date.now()
    ).run();
  }

  /**
   * Retrieve agent memories
   */
  async retrieveMemories(
    agentId: string,
    tier?: 'episodic' | 'semantic' | 'procedural',
    limit: number = 50
  ): Promise<Array<{ tier: string; memory: unknown; timestamp: number }>> {
    if (!this.env.BEING_STATE_DB) {
      return [];
    }

    let query = 'SELECT * FROM agent_memories WHERE agent_id = ?';
    const bindings: unknown[] = [agentId];

    if (tier) {
      query += ' AND tier = ?';
      bindings.push(tier);
    }

    query += ' ORDER BY timestamp DESC LIMIT ?';
    bindings.push(limit);

    const result = await this.env.BEING_STATE_DB.prepare(query)
      .bind(...bindings)
      .all();

    return result.results.map((row: any) => ({
      tier: row.tier,
      memory: JSON.parse(row.memory),
      timestamp: row.timestamp,
    }));
  }

  /**
   * Consolidate memories (episodic -> semantic)
   */
  async consolidateMemories(agentId: string): Promise<void> {
    // Retrieve recent episodic memories
    const episodicMemories = await this.retrieveMemories(agentId, 'episodic', 20);

    if (episodicMemories.length < 5) {
      return; // Not enough to consolidate
    }

    // In production, would use LLM to generate semantic memory
    // For now, create basic summary
    const semanticMemory = {
      type: 'consolidation',
      count: episodicMemories.length,
      timeRange: {
        start: episodicMemories[episodicMemories.length - 1]?.timestamp,
        end: episodicMemories[0]?.timestamp,
      },
      summary: `Consolidated ${episodicMemories.length} episodic memories`,
    };

    await this.storeMemory(agentId, 'semantic', semanticMemory);
  }

  // ========================================================================
  // ACE Integration
  // ========================================================================

  /**
   * Call NVIDIA ACE for agent reasoning
   */
  async callACE(
    agentId: string,
    state: AgentState,
    input: string,
    context?: RAGContext
  ): Promise<string> {
    const preset = AGENT_PRESETS[state];

    if (!preset.ace.enabled) {
      return '';
    }

    // Build ACE request
    const aceRequest = {
      agentId,
      model: preset.ace.model,
      personality: preset.ace.personality,
      input,
      context: context ? JSON.stringify(context) : undefined,
      capabilities: preset.ace.capabilities,
    };

    // In production, would call NVIDIA ACE API
    // For now, return simulated response
    return `[ACE: ${preset.ace.model}] ${input}`;
  }

  // ========================================================================
  // Local LLM Integration
  // ========================================================================

  /**
   * Call local LLM for chatter
   */
  async callLocalLLM(
    agentId: string,
    state: AgentState,
    input: string
  ): Promise<string> {
    const preset = AGENT_PRESETS[state];

    if (!preset.localLLM.enabled) {
      return '';
    }

    const ollamaUrl = this.env.OLLAMA_URL || 'http://localhost:11434';

    try {
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: preset.localLLM.model,
          prompt: `${preset.localLLM.personality}\n\nPlayer: ${input}\nAgent:`,
          stream: false,
          options: {
            num_predict: 100,
            temperature: 0.8,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json() as { response: string };
        return data.response.trim();
      }
    } catch (error) {
      console.error(`[AgentState] LLM call failed for ${agentId}:`, error);
    }

    return '';
  }

  // ========================================================================
  // Agent State Tracking
  // ========================================================================

  /**
   * Set agent state
   */
  setAgentState(agentId: string, state: AgentState): void {
    this.agentStates.set(agentId, state);
  }

  /**
   * Get agent state
   */
  getAgentState(agentId: string): AgentState | undefined {
    return this.agentStates.get(agentId);
  }

  /**
   * Get all agents in state
   */
  getAgentsByState(state: AgentState): string[] {
    const result: string[] = [];
    for (const [id, agentState] of this.agentStates.entries()) {
      if (agentState === state) {
        result.push(id);
      }
    }
    return result;
  }

  // ========================================================================
  // Godot Bridge Integration
  // ========================================================================

  /**
   * Convert agent update to Godot commands
   */
  toGodotCommands(update: AgentUpdate): string[] {
    const commands: string[] = [];
    const { target, state, config } = update;

    // Set agent state
    commands.push(
      `rpc_call("${target}", "set_agent_state", {"state": "${state}"})`
    );

    // Update behavior tree
    if (config.behaviorTree?.tree) {
      commands.push(
        `rpc_call("${target}", "update_behavior_tree", ` +
        `{"tree": \`${config.behaviorTree.tree}\`, ` +
        `"params": ${JSON.stringify(config.behaviorTree.nodeOverrides || {})}})`
      );
    }

    // Set communication settings
    if (config.communication) {
      commands.push(
        `rpc_call("${target}", "set_communication", ` +
        `${JSON.stringify(config.communication)})`
      );
    }

    // Enable/disable ACE
    if (config.ace) {
      commands.push(
        `rpc_call("${target}", "set_ace_enabled", ${config.ace.enabled})`
      );
    }

    // Enable/disable local LLM
    if (config.localLLM) {
      commands.push(
        `rpc_call("${target}", "set_chatter_enabled", ${config.localLLM.enabled})`
      );
    }

    return commands;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createAgentStateManager(env: BeingStateEnv): AgentStateManager {
  return new AgentStateManager(env);
}
