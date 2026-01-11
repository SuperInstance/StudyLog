/**
 * DMLoG.AI - Agent Registry
 *
 * Central registry for tracking all active agents across sessions.
 * Provides agent lifecycle management, discovery, and coordination.
 *
 * @module core/agent-registry
 */

import type {
  AgentConfig,
  AgentRole,
  AgentState,
  AgentStats,
  BiologicalAgent,
  BaseAgent,
} from '../types/index.js';
import {
  AgentErrorCode,
  AgentError,
  BIOLOGICAL_CAPABILITIES,
} from '../types/index.js';

/**
 * Registry entry for an active agent
 */
interface RegistryEntry {
  /** Agent instance */
  agent: BaseAgent;
  /** Agent configuration */
  config: AgentConfig;
  /** Current state */
  state: AgentState;
  /** Session ID */
  sessionId: string;
  /** Registered at timestamp */
  registeredAt: number;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Agent Registry
 *
 * Singleton registry for managing all active agents.
 * Thread-safe for use in worker environments.
 */
export class AgentRegistry {
  private static instance: AgentRegistry | null = null;

  /** Map of agent ID to registry entry */
  private readonly agents: Map<string, RegistryEntry>;

  /** Map of session ID to agent IDs */
  private readonly sessionAgents: Map<string, Set<string>>;

  /** Map of role to agent IDs */
  private readonly roleAgents: Map<AgentRole, Set<string>>;

  /** Map of biological type to agent IDs */
  private readonly biologicalAgents: Map<BiologicalAgent, Set<string>>;

  /** Statistics accumulator */
  private stats: {
    totalRegistered: number;
    totalUnregistered: number;
    totalDecisions: number;
  };

  private constructor() {
    this.agents = new Map();
    this.sessionAgents = new Map();
    this.roleAgents = new Map();
    this.biologicalAgents = new Map();
    this.stats = {
      totalRegistered: 0,
      totalUnregistered: 0,
      totalDecisions: 0,
    };
  }

  /**
   * Get the singleton registry instance
   */
  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  /**
   * Register a new agent
   *
   * @param agent - The agent instance
   * @param config - The agent configuration
   * @throws {AgentError} If agent already exists
   */
  register(agent: BaseAgent, config: AgentConfig): void {
    const agentId = config.id;

    if (this.agents.has(agentId)) {
      throw new AgentError(
        AgentErrorCode.AGENT_ALREADY_EXISTS,
        `Agent ${agentId} is already registered`
      );
    }

    const now = Date.now();
    const entry: RegistryEntry = {
      agent,
      config,
      state: 'idle' as AgentState,
      sessionId: config.sessionId,
      registeredAt: now,
      lastActivity: now,
    };

    this.agents.set(agentId, entry);

    // Add to session index
    if (!this.sessionAgents.has(config.sessionId)) {
      this.sessionAgents.set(config.sessionId, new Set());
    }
    this.sessionAgents.get(config.sessionId)!.add(agentId);

    // Add to role index
    if (!this.roleAgents.has(config.role)) {
      this.roleAgents.set(config.role, new Set());
    }
    this.roleAgents.get(config.role)!.add(agentId);

    // Add to biological type index
    if (!this.biologicalAgents.has(config.biologicalType)) {
      this.biologicalAgents.set(config.biologicalType, new Set());
    }
    this.biologicalAgents.get(config.biologicalType)!.add(agentId);

    this.stats.totalRegistered++;
  }

  /**
   * Unregister an agent
   *
   * @param agentId - The agent ID to unregister
   * @returns true if agent was unregistered, false if not found
   */
  unregister(agentId: string): boolean {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return false;
    }

    // Remove from indexes
    this.sessionAgents.get(entry.sessionId)?.delete(agentId);
    this.roleAgents.get(entry.config.role)?.delete(agentId);
    this.biologicalAgents.get(entry.config.biologicalType)?.delete(agentId);

    // Remove from main map
    this.agents.delete(agentId);

    this.stats.totalUnregistered++;
    return true;
  }

  /**
   * Get an agent by ID
   *
   * @param agentId - The agent ID
   * @returns The agent or undefined if not found
   */
  get(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  /**
   * Check if an agent exists
   *
   * @param agentId - The agent ID
   * @returns true if agent exists
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get agent state
   *
   * @param agentId - The agent ID
   * @returns The agent state or undefined if not found
   */
  getState(agentId: string): AgentState | undefined {
    return this.agents.get(agentId)?.state;
  }

  /**
   * Set agent state
   *
   * @param agentId - The agent ID
   * @param state - The new state
   * @throws {AgentError} If agent not found
   */
  setState(agentId: string, state: AgentState): void {
    const entry = this.agents.get(agentId);
    if (!entry) {
      throw new AgentError(
        AgentErrorCode.AGENT_NOT_FOUND,
        `Agent ${agentId} not found`
      );
    }
    entry.state = state;
    entry.lastActivity = Date.now();
  }

  /**
   * Update agent activity timestamp
   *
   * @param agentId - The agent ID
   */
  updateActivity(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Get agent configuration
   *
   * @param agentId - The agent ID
   * @returns The agent config or undefined if not found
   */
  getConfig(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId)?.config;
  }

  /**
   * Get all agents for a session
   *
   * @param sessionId - The session ID
   * @returns Array of agent IDs for the session
   */
  getSessionAgents(sessionId: string): string[] {
    const agentSet = this.sessionAgents.get(sessionId);
    return agentSet ? Array.from(agentSet) : [];
  }

  /**
   * Get agents by role
   *
   * @param role - The agent role
   * @returns Array of agent IDs with the role
   */
  getAgentsByRole(role: AgentRole): string[] {
    const agentSet = this.roleAgents.get(role);
    return agentSet ? Array.from(agentSet) : [];
  }

  /**
   * Get agents by biological type
   *
   * @param biologicalType - The biological agent type
   * @returns Array of agent IDs with the type
   */
  getAgentsByBiologicalType(biologicalType: BiologicalAgent): string[] {
    const agentSet = this.biologicalAgents.get(biologicalType);
    return agentSet ? Array.from(agentSet) : [];
  }

  /**
   * Find capable agents for a task
   *
   * @param role - Preferred role (optional)
   * @param biologicalType - Preferred biological type (optional)
   * @param sessionId - Session to search (optional)
   * @returns Array of capable agent IDs
   */
  findCapableAgents(
    role?: AgentRole,
    biologicalType?: BiologicalAgent,
    sessionId?: string
  ): string[] {
    let candidates: Set<string>;

    if (sessionId) {
      candidates = new Set(this.sessionAgents.get(sessionId) ?? []);
    } else {
      candidates = new Set(this.agents.keys());
    }

    if (role) {
      const roleAgents = this.roleAgents.get(role) ?? new Set();
      candidates = new Set([...candidates].filter(id => roleAgents.has(id)));
    }

    if (biologicalType) {
      const bioAgents = this.biologicalAgents.get(biologicalType) ?? new Set();
      candidates = new Set([...candidates].filter(id => bioAgents.has(id)));
    }

    return Array.from(candidates);
  }

  /**
   * Get all registered agent IDs
   *
   * @returns Array of all agent IDs
   */
  getAllAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Get total count of registered agents
   *
   * @returns Number of active agents
   */
  getCount(): number {
    return this.agents.size;
  }

  /**
   * Get count for a specific session
   *
   * @param sessionId - The session ID
   * @returns Number of agents in the session
   */
  getSessionCount(sessionId: string): number {
    return this.sessionAgents.get(sessionId)?.size ?? 0;
  }

  /**
   * Get all active session IDs
   *
   * @returns Array of session IDs with at least one agent
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionAgents.keys()).filter(
      sessionId => (this.sessionAgents.get(sessionId)?.size ?? 0) > 0
    );
  }

  /**
   * Record a decision for statistics
   *
   * @param agentId - The agent ID
   */
  recordDecision(agentId: string): void {
    this.updateActivity(agentId);
    this.stats.totalDecisions++;
  }

  /**
   * Get registry statistics
   *
   * @returns Statistics object
   */
  getStats(): {
    totalRegistered: number;
    totalUnregistered: number;
    totalDecisions: number;
    activeAgents: number;
    activeSessions: number;
    agentsByRole: Record<string, number>;
    agentsByBiologicalType: Record<string, number>;
  } {
    const agentsByRole: Record<string, number> = {};
    for (const [role, agents] of this.roleAgents) {
      agentsByRole[role] = agents.size;
    }

    const agentsByBiologicalType: Record<string, number> = {};
    for (const [bioType, agents] of this.biologicalAgents) {
      agentsByBiologicalType[bioType] = agents.size;
    }

    return {
      ...this.stats,
      activeAgents: this.agents.size,
      activeSessions: this.getActiveSessions().length,
      agentsByRole,
      agentsByBiologicalType,
    };
  }

  /**
   * Cleanup stale agents
   *
   * @param inactiveTimeoutMs - Timeout in ms for considering an agent stale
   * @returns Array of cleaned up agent IDs
   */
  cleanupStaleAgents(inactiveTimeoutMs: number = 30 * 60 * 1000): string[] {
    const now = Date.now();
    const stale: string[] = [];

    for (const [agentId, entry] of this.agents) {
      if (now - entry.lastActivity > inactiveTimeoutMs) {
        stale.push(agentId);
        this.unregister(agentId);
      }
    }

    return stale;
  }

  /**
   * Clear all agents (for testing/reset)
   */
  clear(): void {
    this.agents.clear();
    this.sessionAgents.clear();
    this.roleAgents.clear();
    this.biologicalAgents.clear();
    this.stats = {
      totalRegistered: 0,
      totalUnregistered: 0,
      totalDecisions: 0,
    };
  }

  /**
   * Export registry state (for persistence)
   *
   * @returns Serialized registry state
   */
  export(): {
    agents: Array<{
      id: string;
      config: AgentConfig;
      state: AgentState;
      sessionId: string;
      registeredAt: number;
      lastActivity: number;
    }>;
    stats: typeof this.stats;
  } {
    const agents = Array.from(this.agents.entries()).map(([id, entry]) => ({
      id,
      config: entry.config,
      state: entry.state,
      sessionId: entry.sessionId,
      registeredAt: entry.registeredAt,
      lastActivity: entry.lastActivity,
    }));

    return { agents, stats: { ...this.stats } };
  }

  /**
   * Import registry state (from persistence)
   *
   * @param data - The exported registry state
   * @param agentFactory - Factory function to create agent instances
   */
  async import(
    data: ReturnType<AgentRegistry['export']>,
    agentFactory: (config: AgentConfig) => Promise<BaseAgent>
  ): Promise<void> {
    this.clear();

    for (const agentData of data.agents) {
      const agent = await agentFactory(agentData.config);
      const entry: RegistryEntry = {
        agent,
        config: agentData.config,
        state: agentData.state,
        sessionId: agentData.sessionId,
        registeredAt: agentData.registeredAt,
        lastActivity: agentData.lastActivity,
      };

      this.agents.set(agentData.id, entry);

      // Rebuild indexes
      if (!this.sessionAgents.has(agentData.sessionId)) {
        this.sessionAgents.set(agentData.sessionId, new Set());
      }
      this.sessionAgents.get(agentData.sessionId)!.add(agentData.id);

      if (!this.roleAgents.has(agentData.config.role)) {
        this.roleAgents.set(agentData.config.role, new Set());
      }
      this.roleAgents.get(agentData.config.role)!.add(agentData.id);

      if (!this.biologicalAgents.has(agentData.config.biologicalType)) {
        this.biologicalAgents.set(agentData.config.biologicalType, new Set());
      }
      this.biologicalAgents.get(agentData.config.biologicalType)!.add(agentData.id);
    }

    this.stats = { ...data.stats };
  }
}

/**
 * Base agent interface (minimal for registry)
 */
export interface BaseAgent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly biologicalType: BiologicalAgent;
  decide: (context: unknown) => Promise<unknown>;
}

/**
 * Factory function to create or get registry instance
 */
export function getAgentRegistry(): AgentRegistry {
  return AgentRegistry.getInstance();
}

/**
 * Convenience function to register an agent
 */
export function registerAgent(agent: BaseAgent, config: AgentConfig): void {
  return getAgentRegistry().register(agent, config);
}

/**
 * Convenience function to unregister an agent
 */
export function unregisterAgent(agentId: string): boolean {
  return getAgentRegistry().unregister(agentId);
}

/**
 * Convenience function to get an agent
 */
export function getAgent(agentId: string): BaseAgent | undefined {
  return getAgentRegistry().get(agentId);
}

/**
 * Convenience function to check if an agent exists
 */
export function hasAgent(agentId: string): boolean {
  return getAgentRegistry().has(agentId);
}

/**
 * Convenience function to get agents by session
 */
export function getSessionAgents(sessionId: string): string[] {
  return getAgentRegistry().getSessionAgents(sessionId);
}

/**
 * Convenience function to find capable agents
 */
export function findAgents(
  role?: AgentRole,
  biologicalType?: BiologicalAgent,
  sessionId?: string
): string[] {
  return getAgentRegistry().findCapableAgents(role, biologicalType, sessionId);
}
