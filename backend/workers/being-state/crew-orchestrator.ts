/**
 * Crew Orchestrator Module
 *
 * Handles CrewAI-based multi-agent orchestration for coordinated
 * agent behaviors across the simulation.
 */

import type {
  BeingStateEnv,
  CrewConfig,
  CrewAgent,
  CrewTask,
  CrewRole,
  CrewTaskType,
  CrewCoordination,
  AgentState,
  RAGContext,
  GameEvent,
} from './types';

// ============================================================================
// Crew Role Definitions
// ============================================================================

interface CrewRoleConfig {
  state: AgentState;
  capabilities: string[];
  personality: string;
  systemPrompt: string;
  allowedActions: string[];
}

const CREW_ROLES: Record<CrewRole, CrewRoleConfig> = {
  scout: {
    state: 'autonomous',
    capabilities: ['exploration', 'stealth', 'observation', 'reporting'],
    personality: 'curious_observation_specialist',
    systemPrompt: 'You are a scout. Your primary role is to explore ahead, observe the environment, and report back valuable information. Stay stealthy, gather intelligence, and avoid unnecessary engagement.',
    allowedActions: ['move', 'observe', 'report', 'hide', 'mark_target'],
  },

  tank: {
    state: 'directed',
    capabilities: ['defense', 'aggro', 'protection', 'fortification'],
    personality: 'protective_defender',
    systemPrompt: 'You are a tank. Your primary role is to absorb damage, draw enemy attention, and protect your team. Position yourself between threats and allies. Use defensive abilities to mitigate damage.',
    allowedActions: ['move', 'taunt', 'shield', 'fortify', 'intercept'],
  },

  damage: {
    state: 'directed',
    capabilities: ['combat', 'focusing', 'burst', 'execution'],
    personality: 'focused_strike_specialist',
    systemPrompt: 'You are a damage dealer. Your primary role is to eliminate high-priority threats quickly. Focus fire on vulnerable targets, maximize your damage output, and coordinate with your team for burst opportunities.',
    allowedActions: ['move', 'attack', 'focus', 'burst', 'execute'],
  },

  support: {
    state: 'symbiotic',
    capabilities: ['healing', 'buffing', 'cleansing', 'sustaining'],
    personality: 'caring_support_specialist',
    systemPrompt: 'You are a support. Your primary role is to keep your team alive and operating at peak efficiency. Heal wounded allies, provide beneficial buffs, and remove debuffs. Position safely but maintain team awareness.',
    allowedActions: ['move', 'heal', 'buff', 'cleanse', 'revive'],
  },

  commander: {
    state: 'teaching',
    capabilities: ['strategy', 'coordination', 'orders', 'analysis'],
    personality: 'strategic_leader',
    systemPrompt: 'You are a commander. Your primary role is to analyze the battlefield and coordinate your team. Assess threats, allocate targets, and direct team actions. Your decisions determine mission success.',
    allowedActions: ['analyze', 'order', 'coordinate', 'prioritize', 'retreat'],
  },

  builder: {
    state: 'autonomous',
    capabilities: ['construction', 'repair', 'fortification', 'automation'],
    personality: 'constructive_creator',
    systemPrompt: 'You are a builder. Your primary role is to construct fortifications, repair structures, and create infrastructure. Build defensively, optimize resource usage, and maintain critical structures.',
    allowedActions: ['move', 'build', 'repair', 'fortify', 'demolish'],
  },

  researcher: {
    state: 'learning',
    capabilities: ['analysis', 'information_gathering', 'pattern_recognition', 'synthesis'],
    personality: 'analytical_researcher',
    systemPrompt: 'You are a researcher. Your primary role is to gather information, analyze patterns, and synthesize insights. Observe enemy behaviors, document discoveries, and provide strategic intelligence.',
    allowedActions: ['move', 'observe', 'analyze', 'document', 'hypothesize'],
  },

  diplomat: {
    state: 'rogue',
    capabilities: ['negotiation', 'trade', 'alliance', 'persuasion'],
    personality: 'charismatic_negotiator',
    systemPrompt: 'You are a diplomat. Your primary role is to negotiate with neutral parties, manage trade, and form alliances. Use persuasion, assess value, and seek mutually beneficial arrangements.',
    allowedActions: ['move', 'negotiate', 'trade', 'persuade', 'ally'],
  },
};

// ============================================================================
// Crew Task Templates
// ============================================================================

interface TaskTemplate {
  type: CrewTaskType;
  description: string;
  requiredRoles: CrewRole[];
  estimatedDuration: number;
  complexity: number;
}

const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  area_reconnaissance: {
    type: 'explore',
    description: 'Reconnoiter the designated area and report all findings',
    requiredRoles: ['scout'],
    estimatedDuration: 120,
    complexity: 3,
  },

  eliminate_threat: {
    type: 'engage',
    description: 'Eliminate the hostile target in the designated area',
    requiredRoles: ['damage', 'tank', 'support'],
    estimatedDuration: 90,
    complexity: 5,
  },

  establish_fob: {
    type: 'build',
    description: 'Construct a forward operating base at the designated location',
    requiredRoles: ['builder', 'tank', 'commander'],
    estimatedDuration: 300,
    complexity: 7,
  },

  gather_intelligence: {
    type: 'research',
    description: 'Gather intelligence on enemy activities and capabilities',
    requiredRoles: ['researcher', 'scout'],
    estimatedDuration: 180,
    complexity: 4,
  },

  secure_resource: {
    type: 'retrieve',
    description: 'Secure the resource cache and return to base',
    requiredRoles: ['damage', 'tank'],
    estimatedDuration: 150,
    complexity: 4,
  },

  escort_vip: {
    type: 'escort',
    description: 'Escort the VIP to the extraction point',
    requiredRoles: ['tank', 'support', 'commander'],
    estimatedDuration: 200,
    complexity: 6,
  },

  solve_puzzle: {
    type: 'solve',
    description: 'Solve the puzzle barrier to proceed',
    requiredRoles: ['researcher', 'diplomat'],
    estimatedDuration: 240,
    complexity: 8,
  },
};

// ============================================================================
// Crew Orchestrator Class
// ============================================================================

export class CrewOrchestrator {
  private env: BeingStateEnv;
  private activeCrews: Map<string, CrewConfig> = new Map();
  private crewTasks: Map<string, CrewTask[]> = new Map();

  constructor(env: BeingStateEnv) {
    this.env = env;
  }

  // ========================================================================
  // Crew Creation
  // ========================================================================

  /**
   * Create a new crew configuration
   */
  async createCrew(
    name: string,
    coordination: CrewCoordination,
    agents: Array<{
      id: string;
      role: CrewRole;
    }>
  ): Promise<CrewConfig> {
    const crewId = crypto.randomUUID();

    // Build crew agents with role configurations
    const crewAgents: CrewAgent[] = agents.map((agent) => {
      const roleConfig = CREW_ROLES[agent.role];

      return {
        id: agent.id,
        role: agent.role,
        state: roleConfig.state,
        capabilities: roleConfig.capabilities,
        llm: this.selectLLMForRole(agent.role),
        systemPrompt: roleConfig.systemPrompt,
        allowedActions: roleConfig.allowedActions,
      };
    });

    const crew: CrewConfig = {
      id: crewId,
      name,
      agents: crewAgents,
      tasks: [],
      coordination,
    };

    // Store crew
    this.activeCrews.set(crewId, crew);
    this.crewTasks.set(crewId, []);

    // Persist to database
    await this.persistCrew(crew);

    return crew;
  }

  /**
   * Select appropriate LLM for crew role
   */
  private selectLLMForRole(role: CrewRole): string {
    const llmAssignments: Record<CrewRole, string> = {
      scout: 'llama3.1:8b',
      tank: 'phi3:mini',
      damage: 'llama3.1:8b',
      support: 'llama3.1:8b',
      commander: 'llama3.1:70b',
      builder: 'llama3.1:8b',
      researcher: 'llama-nemotron-super',
      diplomat: 'llama3.1:70b',
    };

    return llmAssignments[role];
  }

  // ========================================================================
  // Crew Task Management
  // ========================================================================

  /**
   * Create a task for the crew
   */
  async createTask(
    crewId: string,
    template: keyof typeof TASK_TEMPLATES | string,
    params?: {
      target?: string;
      position?: [number, number, number];
      priority?: number;
    }
  ): Promise<CrewTask> {
    const crew = this.activeCrews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    const templateData = TASK_TEMPLATES[template as keyof typeof TASK_TEMPLATES];
    if (!templateData) {
      throw new Error(`Task template not found: ${template}`);
    }

    // Assign agents based on required roles
    const assignedAgents = this.assignAgentsToTask(crew, templateData.requiredRoles);

    const task: CrewTask = {
      id: crypto.randomUUID(),
      type: templateData.type,
      description: templateData.description,
      assignedTo: assignedAgents,
      priority: params?.priority ?? 5,
      dependencies: [],
      status: 'pending',
    };

    // Add to crew tasks
    crew.tasks.push(task);
    this.crewTasks.set(crewId, crew.tasks);

    // Persist
    await this.persistCrew(crew);

    return task;
  }

  /**
   * Assign agents to task based on roles
   */
  private assignAgentsToTask(
    crew: CrewConfig,
    requiredRoles: CrewRole[]
  ): string[] {
    const assigned: string[] = [];

    for (const role of requiredRoles) {
      // Find available agent with this role
      const agent = crew.agents.find((a) => {
        return a.role === role && !this.isAgentBusy(crew.id, a.id);
      });

      if (agent) {
        assigned.push(agent.id);
      } else {
        // Find agent that can fulfill this role
        const fallback = crew.agents.find((a) =>
          !this.isAgentBusy(crew.id, a.id)
        );
        if (fallback) {
          assigned.push(fallback.id);
        }
      }
    }

    return assigned;
  }

  /**
   * Check if agent is busy with another task
   */
  private isAgentBusy(crewId: string, agentId: string): boolean {
    const tasks = this.crewTasks.get(crewId) ?? [];
    for (const task of tasks) {
      if (task.status === 'in_progress' && task.assignedTo.includes(agentId)) {
        return true;
      }
    }
    return false;
  }

  // ========================================================================
  // Crew Coordination
  // ========================================================================

  /**
   * Execute crew coordination decision making
   */
  async coordinateCrew(
    crewId: string,
    context: RAGContext
  ): Promise<Array<{ agentId: string; action: string; reasoning: string }>> {
    const crew = this.activeCrews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    const results: Array<{ agentId: string; action: string; reasoning: string }> = [];

    switch (crew.coordination.protocol) {
      case 'centralized':
        // Commander makes all decisions
        const commander = crew.agents.find((a) => a.role === 'commander');
        if (commander) {
          const decisions = await this.generateCentralizedDecisions(
            crew,
            commander,
            context
          );
          results.push(...decisions);
        }
        break;

      case 'decentralized':
        // Each agent makes their own decisions
        for (const agent of crew.agents) {
          const decision = await this.generateAgentDecision(agent, context, crew);
          results.push(decision);
        }
        break;

      case 'hierarchical':
        // Commanders decide for their subgroups
        const commanders = crew.agents.filter((a) =>
          ['commander', 'tank'].includes(a.role)
        );
        for (const commander of commanders) {
          const decisions = await this.generateCentralizedDecisions(
            crew,
            commander,
            context,
            [commander.id]
          );
          results.push(...decisions);
        }
        break;
    }

    return results;
  }

  /**
   * Generate centralized decisions (commander-led)
   */
  private async generateCentralizedDecisions(
    crew: CrewConfig,
    commander: CrewAgent,
    context: RAGContext,
    subgroup?: string[]
  ): Promise<Array<{ agentId: string; action: string; reasoning: string }>> {
    const results: Array<{ agentId: string; action: string; reasoning: string }> = [];

    // Build decision prompt
    const prompt = this.buildDecisionPrompt(crew, context, subgroup);

    // In production, would call LLM for strategic planning
    // For now, generate basic decisions

    const agentsToCommand = subgroup
      ? crew.agents.filter((a) => subgroup.includes(a.id))
      : crew.agents;

    for (const agent of agentsToCommand) {
      if (agent.id === commander.id) continue;

      const action = this.getDefaultActionForRole(agent.role, context);
      results.push({
        agentId: agent.id,
        action: action.action,
        reasoning: `Commander order: ${action.reasoning}`,
      });
    }

    return results;
  }

  /**
   * Generate individual agent decision
   */
  private async generateAgentDecision(
    agent: CrewAgent,
    context: RAGContext,
    crew: CrewConfig
  ): Promise<{ agentId: string; action: string; reasoning: string }> {
    const roleConfig = CREW_ROLES[agent.role];
    const prompt = `
${roleConfig.systemPrompt}

Current Situation:
${this.situationToString(context)}

Crew Status:
${this.crewStatusToString(crew)}

Your Available Actions: ${agent.allowedActions.join(', ')}

Decide your next action. Respond with:
ACTION: [action]
REASONING: [brief explanation]
`;

    // In production, would call LLM
    // For now, return default action
    const defaultAction = this.getDefaultActionForRole(agent.role, context);

    return {
      agentId: agent.id,
      action: defaultAction.action,
      reasoning: defaultAction.reasoning,
    };
  }

  /**
   * Get default action for role based on context
   */
  private getDefaultActionForRole(
    role: CrewRole,
    context: RAGContext
  ): { action: string; reasoning: string } {
    // Analyze threats
    const hasThreats = context.strategy?.threats && context.strategy.threats.length > 0;
    const hasOpportunities = context.strategy?.opportunities && context.strategy.opportunities.length > 0;

    const roleActions: Record<CrewRole, () => { action: string; reasoning: string }> = {
      scout: () => ({
        action: 'observe',
        reasoning: hasThreats ? 'Observing threats' : 'Scouting ahead',
      }),

      tank: () => ({
        action: hasThreats ? 'shield' : 'move',
        reasoning: hasThreats ? 'Drawing aggro from threats' : 'Moving to defensive position',
      }),

      damage: () => ({
        action: hasThreats ? 'focus' : 'move',
        reasoning: hasThreats ? 'Focusing fire on priority target' : 'Positioning for engagement',
      }),

      support: () => ({
        action: hasThreats ? 'buff' : 'heal',
        reasoning: hasThreats ? 'Bolleting team for combat' : 'Maintaining team health',
      }),

      commander: () => ({
        action: 'coordinate',
        reasoning: 'Analyzing situation and directing team',
      }),

      builder: () => ({
        action: hasThreats ? 'fortify' : 'build',
        reasoning: hasThreats ? 'Reinforcing defenses' : 'Constructing infrastructure',
      }),

      researcher: () => ({
        action: 'analyze',
        reasoning: 'Analyzing patterns and gathering intelligence',
      }),

      diplomat: () => ({
        action: hasOpportunities ? 'negotiate' : 'observe',
        reasoning: hasOpportunities ? 'Exploring trade opportunities' : 'Assessing diplomatic situation',
      }),
    };

    return roleActions[role]();
  }

  // ========================================================================
  // Task Execution
  // ========================================================================

  /**
   * Execute crew task
   */
  async executeTask(
    crewId: string,
    taskId: string
  ): Promise<{ success: boolean; results: unknown[] }> {
    const crew = this.activeCrews.get(crewId);
    if (!crew) {
      throw new Error(`Crew not found: ${crewId}`);
    }

    const task = crew.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Update task status
    task.status = 'in_progress';
    await this.persistCrew(crew);

    const results: unknown[] = [];

    // Execute task based on coordination protocol
    if (crew.coordination.decisionMaking === 'leader') {
      const commander = crew.agents.find((a) => a.role === 'commander');
      if (commander) {
        const result = await this.executeTaskAsLeader(crew, task, commander);
        results.push(result);
      }
    } else if (crew.coordination.decisionMaking === 'voting') {
      const result = await this.executeTaskByVoting(crew, task);
      results.push(result);
    } else {
      const result = await this.executeTaskByConsensus(crew, task);
      results.push(result);
    }

    // Update task status
    task.status = 'completed';
    await this.persistCrew(crew);

    return { success: true, results };
  }

  /**
   * Execute task with leader decision
   */
  private async executeTaskAsLeader(
    crew: CrewConfig,
    task: CrewTask,
    leader: CrewAgent
  ): Promise<unknown> {
    // Build execution prompt
    const prompt = `
You are the ${leader.role} leading this task.
Task: ${task.description}
Assigned Agents: ${task.assignedTo.join(', ')}

Coordinate the task execution and report results.
`;

    // In production, would call LLM
    return {
      method: 'leader',
      leader: leader.id,
      task: task.id,
      status: 'directed',
    };
  }

  /**
   * Execute task by voting
   */
  private async executeTaskByVoting(
    crew: CrewConfig,
    task: CrewTask
  ): Promise<unknown> {
    const votes: Record<string, number> = {};

    for (const agentId of task.assignedTo) {
      const agent = crew.agents.find((a) => a.id === agentId);
      if (agent) {
        // Simulate vote based on role
        const vote = this.getRoleVote(agent.role, task);
        votes[vote] = (votes[vote] || 0) + 1;
      }
    }

    // Find winning vote
    let maxVote = '';
    let maxCount = 0;
    for (const [vote, count] of Object.entries(votes)) {
      if (count > maxCount) {
        maxVote = vote;
        maxCount = count;
      }
    }

    return {
      method: 'voting',
      votes,
      winner: maxVote,
      consensus: maxCount / task.assignedTo.length,
    };
  }

  /**
   * Execute task by consensus
   */
  private async executeTaskByConsensus(
    crew: CrewConfig,
    task: CrewTask
  ): Promise<unknown> {
    // Negotiation loop
    let iterations = 0;
    const maxIterations = 5;
    const proposals: string[] = [];

    for (const agentId of task.assignedTo) {
      const agent = crew.agents.find((a) => a.id === agentId);
      if (agent) {
        proposals.push(this.getRoleProposal(agent.role, task));
      }
    }

    // Find common ground
    const common = proposals.find((p) =>
      proposals.every((prop) => prop === prop)
    );

    return {
      method: 'consensus',
      proposals,
      consensus: common || 'diverse',
      iterations,
    };
  }

  /**
   * Get role-based vote
   */
  private getRoleVote(role: CrewRole, task: CrewTask): string {
    const roleVotes: Record<CrewRole, string> = {
      scout: 'recon',
      tank: 'defend',
      damage: 'attack',
      support: 'assist',
      commander: 'coordinate',
      builder: 'fortify',
      researcher: 'analyze',
      diplomat: 'negotiate',
    };

    return roleVotes[role];
  }

  /**
   * Get role-based proposal
   */
  private getRoleProposal(role: CrewRole, task: CrewTask): string {
    return `${role}_approach`;
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Build decision prompt
   */
  private buildDecisionPrompt(
    crew: CrewConfig,
    context: RAGContext,
    subgroup?: string[]
  ): string {
    const agents = subgroup
      ? crew.agents.filter((a) => subgroup.includes(a.id))
      : crew.agents;

    return `
Crew Coordination Decision
Protocol: ${crew.coordination.protocol}
Decision Making: ${crew.coordination.decisionMaking}

Available Agents:
${agents.map((a) => `- ${a.id}: ${a.role} (${a.capabilities.join(', ')})`).join('\n')}

Situation:
${this.situationToString(context)}

Provide orders and reasoning for each agent.
`;
  }

  /**
   * Convert situation to string
   */
  private situationToString(context: RAGContext): string {
    const parts: string[] = [];

    if (context.gameState.units.length > 0) {
      parts.push(`${context.gameState.units.length} units detected`);
    }

    if (context.strategy?.threats && context.strategy.threats.length > 0) {
      parts.push(`${context.strategy.threats.length} threats`);
    }

    if (context.strategy?.opportunities && context.strategy.opportunities.length > 0) {
      parts.push(`${context.strategy.opportunities.length} opportunities`);
    }

    return parts.join(', ') || 'No significant activity';
  }

  /**
   * Convert crew status to string
   */
  private crewStatusToString(crew: CrewConfig): string {
    const activeTasks = crew.tasks.filter((t) => t.status === 'in_progress').length;
    const pendingTasks = crew.tasks.filter((t) => t.status === 'pending').length;

    return `Active Tasks: ${activeTasks}, Pending: ${pendingTasks}, Agents: ${crew.agents.length}`;
  }

  /**
   * Persist crew to database
   */
  private async persistCrew(crew: CrewConfig): Promise<void> {
    if (!this.env.BEING_STATE_DB) {
      return;
    }

    await this.env.BEING_STATE_DB.prepare(`
      INSERT OR REPLACE INTO crew_configs (
        id, name, agents, tasks, coordination, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crew.id,
      crew.name,
      JSON.stringify(crew.agents),
      JSON.stringify(crew.tasks),
      JSON.stringify(crew.coordination),
      Date.now()
    ).run();
  }

  // ========================================================================
  // Crew Queries
  // ========================================================================

  /**
   * Get crew by ID
   */
  getCrew(crewId: string): CrewConfig | undefined {
    return this.activeCrews.get(crewId);
  }

  /**
   * Get all crews
   */
  getAllCrews(): CrewConfig[] {
    return Array.from(this.activeCrews.values());
  }

  /**
   * Get crew tasks
   */
  getCrewTasks(crewId: string): CrewTask[] {
    return this.crewTasks.get(crewId) ?? [];
  }

  /**
   * Delete crew
   */
  async deleteCrew(crewId: string): Promise<boolean> {
    this.activeCrews.delete(crewId);
    this.crewTasks.delete(crewId);

    if (this.env.BEING_STATE_DB) {
      await this.env.BEING_STATE_DB.prepare(`
        DELETE FROM crew_configs WHERE id = ?
      `).bind(crewId).run();
    }

    return true;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createCrewOrchestrator(env: BeingStateEnv): CrewOrchestrator {
  return new CrewOrchestrator(env);
}
