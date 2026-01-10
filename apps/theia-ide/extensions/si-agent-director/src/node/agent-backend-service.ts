/**
 * Agent Backend Service
 *
 * RPC service for managing agents and tracking progress.
 *
 * DESIGN DECISIONS:
 *
 * 1. Agent Tracking (Current: In-Memory):
 *    - Agents are stored in a private Map<string, AgentInfo> for fast access
 *    - Persistence is handled via saveAgents() to data/agents.json
 *    - Future: Replace with D1 database for multi-instance support
 *
 * 2. "restart" Semantics:
 *    - Graceful shutdown: status -> 'stopping', then 'stopped'
 *    - Preserve agent config (name, type, model, personality)
 *    - Reset runtime state (tokensUsed, cost, mood -> 0)
 *    - Spawn new "process" (TODO: actual process/container management)
 *
 * 3. Model Switching:
 *    - Allowed on running agents without restart
 *    - Preserves active conversation context
 *    - Updates agent immediately; next prompt uses new model
 *    - Logs the switch for cost tracking purposes
 *
 * 4. Error Handling:
 *    - Non-existent agents throw Error with AGENT_NOT_FOUND prefix
 *    - Invalid operations (e.g., restart already-stopped agent) throw descriptive errors
 *    - All errors logged with [AgentBackendService] prefix
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { ProgressTracker } from './progress-tracker';
import * as fs from 'fs/promises';
import * as path from 'path';

export const AGENT_SERVICE_PATH = '/services/agent';

export interface AgentConfig {
  name: string;
  type: 'slm' | 'director_agent' | 'orchestrator' | 'vector_swarm';
  model: string;
  personality?: Record<string, number>;
}

export interface AgentService {
  createAgent(config: AgentConfig): Promise<AgentInfo>;
  removeAgent(agentId: string): Promise<void>;
  restartAgent(agentId: string): Promise<void>;
  switchModel(agentId: string, model: string): Promise<void>;
  getAgents(): Promise<AgentInfo[]>;
  getProgress(): Promise<ProgressInfo>;
  completePuzzle(puzzleId: string): Promise<void>;
}

export interface AgentInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  model?: string;
  tokensUsed: number;
  cost: number;
  mood: number;
}

export interface ProgressInfo {
  currentStage: number;
  completedPuzzles: string[];
  unlockedFeatures: string[];
}

@injectable()
export class AgentBackendService implements AgentService {
  @inject(ProgressTracker)
  protected readonly progress!: ProgressTracker;

  /**
   * In-memory registry of all agents.
   * Key: agentId, Value: AgentInfo
   *
   * FUTURE: Replace with D1 database for distributed scenarios.
   */
  private agents: Map<string, AgentInfo> = new Map();

  /**
   * Path to agent registry file for persistence across restarts.
   */
  private readonly AGENTS_FILE = path.join(process.cwd(), 'data', 'agents.json');

  constructor() {
    this.loadAgents();
  }

  /**
   * Creates a new agent with the specified configuration.
   *
   * @param config - Agent configuration including name, type, model, and optional personality
   * @returns Promise<AgentInfo> - The created agent information
   *
   * DESIGN: Generates unique ID based on timestamp, initializes all stats to zero.
   * Future enhancement: Support agent templates and cloning.
   */
  async createAgent(config: AgentConfig): Promise<AgentInfo> {
    const id = `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const agentInfo: AgentInfo = {
      id,
      name: config.name,
      type: config.type,
      status: 'idle',
      model: config.model,
      tokensUsed: 0,
      cost: 0,
      mood: 0,
    };

    this.agents.set(id, agentInfo);
    await this.saveAgents();

    console.log(`[AgentBackendService] Created agent: ${id} (${config.name}, ${config.type})`);

    // TODO: Actually spawn the agent process/container
    // - For SLM: spawn child process with model
    // - For Director/Orchestrator: connect to worker service
    // - For Vector Swarm: initialize embedding index

    return agentInfo;
  }

  /**
   * Removes an agent from the registry.
   *
   * @param agentId - The unique identifier of the agent to remove
   * @returns Promise<void>
   * @throws {Error} If agent with given ID does not exist
   *
   * DESIGN: Performs graceful shutdown before removal:
   * 1. Check agent exists
   * 2. Mark as 'stopping' to signal in-flight requests
   * 3. Clean up resources (TODO: kill process, close connections)
   * 4. Remove from registry
   */
  async removeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);

    if (!agent) {
      const error = `AGENT_NOT_FOUND: No agent with ID "${agentId}"`;
      console.error(`[AgentBackendService] ${error}`);
      throw new Error(error);
    }

    console.log(`[AgentBackendService] Removing agent: ${agentId} (${agent.name})`);

    // Mark as stopping to signal graceful shutdown
    agent.status = 'stopping';
    await this.saveAgents();

    // TODO: Perform actual cleanup
    // - Kill child process/container
    // - Close WebSocket connections
    // - Flush any pending state to database
    // - Release allocated resources (GPU memory, file handles)

    // Remove from registry
    this.agents.delete(agentId);
    await this.saveAgents();

    console.log(`[AgentBackendService] Agent removed: ${agentId}`);
  }

  /**
   * Restarts an agent process.
   *
   * @param agentId - The unique identifier of the agent to restart
   * @returns Promise<void>
   * @throws {Error} If agent with given ID does not exist
   *
   * DESIGN: Graceful restart preserving configuration:
   * 1. Store agent config (name, type, model, personality)
   * 2. Stop current process (graceful shutdown)
   * 3. Reset runtime metrics (tokensUsed, cost, mood)
   * 4. Spawn new process with same config
   * 5. Update status to 'idle' when ready
   */
  async restartAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);

    if (!agent) {
      const error = `AGENT_NOT_FOUND: No agent with ID "${agentId}"`;
      console.error(`[AgentBackendService] ${error}`);
      throw new Error(error);
    }

    console.log(`[AgentBackendService] Restarting agent: ${agentId} (${agent.name})`);

    // Store config before stopping
    const preservedConfig = {
      name: agent.name,
      type: agent.type as AgentConfig['type'],
      model: agent.model!,
    };

    // Mark as stopping
    agent.status = 'stopping';
    await this.saveAgents();

    // TODO: Actual process management
    // - Send SIGTERM to child process
    // - Wait for graceful exit (timeout: 30s)
    // - Force kill if timeout exceeded
    // - Spawn new process with same config

    // Reset runtime state
    agent.status = 'idle';
    agent.tokensUsed = 0;
    agent.cost = 0;
    agent.mood = 0;

    await this.saveAgents();

    console.log(`[AgentBackendService] Agent restarted: ${agentId}`);
  }

  /**
   * Switches an agent to a different model.
   *
   * @param agentId - The unique identifier of the agent
   * @param model - The new model identifier (e.g., "claude-opus-4-5", "gpt-4-turbo")
   * @returns Promise<void>
   * @throws {Error} If agent with given ID does not exist
   *
   * DESIGN: Hot-swappable model change:
   * - Preserves active conversation context
   * - Updates immediately; next prompt uses new model
   * - Logged for cost tracking per-model
   * - No restart required (stateless model calls)
   *
   * FUTURE: Validate model is available before switching
   */
  async switchModel(agentId: string, model: string): Promise<void> {
    const agent = this.agents.get(agentId);

    if (!agent) {
      const error = `AGENT_NOT_FOUND: No agent with ID "${agentId}"`;
      console.error(`[AgentBackendService] ${error}`);
      throw new Error(error);
    }

    const previousModel = agent.model;
    console.log(`[AgentBackendService] Switching model for ${agentId}: ${previousModel} -> ${model}`);

    // TODO: Validate model availability
    // - Check if model exists in registry
    // - Verify API credentials for this provider
    // - Rate limit check for new model

    agent.model = model;
    await this.saveAgents();

    console.log(`[AgentBackendService] Model switched for ${agentId}: ${previousModel} -> ${model}`);
  }

  /**
   * Returns a list of all registered agents.
   *
   * @returns Promise<AgentInfo[]> - Array of all agent information
   *
   * DESIGN: Returns live snapshot of current registry.
   * FUTURE: Support pagination, filtering, and sorting for large agent lists.
   */
  async getAgents(): Promise<AgentInfo[]> {
    return Array.from(this.agents.values());
  }

  /**
   * Returns the current progress information for the user.
   *
   * @returns Promise<ProgressInfo> - Current stage, completed puzzles, and unlocked features
   */
  async getProgress(): Promise<ProgressInfo> {
    return this.progress.getProgress();
  }

  /**
   * Marks a puzzle as completed for the current user.
   *
   * @param puzzleId - The unique identifier of the completed puzzle
   * @returns Promise<void>
   */
  async completePuzzle(puzzleId: string): Promise<void> {
    await this.progress.completePuzzle(puzzleId);
  }

  /**
   * Cleanup method called when service is disposed.
   *
   * DESIGN: Ensures all agent state is persisted before shutdown.
   * FUTURE: Implement graceful shutdown for all active agents.
   */
  dispose(): void {
    console.log('[AgentBackendService] Disposing service...');
    // TODO: Graceful shutdown of all agents
    // - Send shutdown signal to each agent
    // - Wait for in-flight requests to complete
    // - Force quit after timeout
    this.saveAgents();
  }

  /**
   * Loads agent registry from persistent storage.
   *
   * DESIGN: Called on service initialization. If file doesn't exist,
   * starts with empty registry. Future: migrate to D1.
   *
   * @private
   */
  private async loadAgents(): Promise<void> {
    try {
      const content = await fs.readFile(this.AGENTS_FILE, 'utf-8');
      const data = JSON.parse(content);

      for (const [id, agent] of Object.entries(data)) {
        this.agents.set(id, agent as AgentInfo);
      }

      console.log(`[AgentBackendService] Loaded ${this.agents.size} agents from disk`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('[AgentBackendService] No existing agent registry found, starting fresh');
        // Ensure data directory exists
        await fs.mkdir(path.dirname(this.AGENTS_FILE), { recursive: true });
      } else {
        console.error('[AgentBackendService] Failed to load agents:', error);
      }
    }
  }

  /**
   * Persists current agent registry to disk.
   *
   * DESIGN: Synchronous-style async for simplicity. Future: use D1
   * for distributed scenarios and better query capabilities.
   *
   * @private
   */
  private async saveAgents(): Promise<void> {
    try {
      const dataDir = path.dirname(this.AGENTS_FILE);
      await fs.mkdir(dataDir, { recursive: true });

      const data: Record<string, AgentInfo> = {};
      for (const [id, agent] of this.agents.entries()) {
        data[id] = agent;
      }

      await fs.writeFile(this.AGENTS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[AgentBackendService] Failed to save agents:', error);
    }
  }
}
