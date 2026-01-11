/**
 * LimboAI Bridge - Behavior Tree State Synchronization
 *
 * Integrates with LimboAI behavior trees for Godot NPCs.
 * Provides state synchronization between game runtime and backend,
 * enabling AI-driven behavior modification and monitoring.
 *
 * Features:
 * - Behavior tree execution state tracking
 * - Blackboard variable synchronization
 * - Remote behavior tree modification
 * - Node status monitoring
 * - Performance metrics collection
 *
 * @module limboai-bridge
 */

import type {
    Env,
    BehaviorTree,
    BehaviorTreeState,
    LimboNode,
    LimboNodeType,
    BlackboardVariable,
    BehaviorVariable,
    BackendToGodotMessage,
    GodotMessageType,
    ApiResponse,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const LIMBOAI_DEFAULT_INTERVAL_MS = 100; // 10 ticks per second
const MAX_BLACKBOARD_SIZE = 1024; // Max blackboard variables to track
const STATE_TTL = 300; // Seconds to keep state in cache

// ============================================================================
// LimboAI Bridge State Types
// ============================================================================

/**
 * Behavior tree node execution status
 */
export enum NodeStatus {
    RUNNING = 'running',
    SUCCESS = 'success',
    FAILURE = 'failure',
}

/**
 * Remote node control command
 */
export enum NodeCommand {
    ENABLE = 'enable',
    DISABLE = 'disable',
    RESET = 'reset',
    INTERRUPT = 'interrupt',
}

/**
 * Synchronized agent state
 */
export interface AgentState {
    agentId: string;
    treeId: string;
    currentNodeId: string;
    nodePath: string[];
    status: NodeStatus;
    blackboard: Record<string, unknown>;
    lastTick: number;
    tickCount: number;
    isActive: boolean;
}

/**
 * Blackboard sync event
 */
export interface BlackboardSyncEvent {
    agentId: string;
    treeId: string;
    variable: string;
    value: unknown;
    timestamp: number;
    source: 'game' | 'ai';
}

/**
 * Behavior tree modification request
 */
export interface TreeModificationRequest {
    treeId: string;
    nodeId: string;
    operation: 'add' | 'remove' | 'modify' | 'move';
    nodeData?: Partial<LimboNode>;
    targetParent?: string;
    targetPosition?: number;
}

/**
 * Node execution metrics
 */
export interface NodeMetrics {
    nodeId: string;
    treeId: string;
    agentId: string;
    executionCount: number;
    successCount: number;
    failureCount: number;
    averageExecutionTimeMs: number;
    lastExecutionTime: number;
}

// ============================================================================
// LimboAI Bridge Client
// ============================================================================

/**
 * Client for synchronizing LimboAI behavior tree state
 */
export class LimboAIBridgeClient {
    private cache: KVNamespace | undefined;
    private godotBridgeUrl: string | undefined;
    private stateCache: Map<string, AgentState>;
    private metricsCache: Map<string, NodeMetrics>;

    constructor(env: Env) {
        this.cache = env.CACHE;
        this.godotBridgeUrl = env.GODOT_BRIDGE_URL;
        this.stateCache = new Map();
        this.metricsCache = new Map();
    }

    /**
     * Initialize the bridge connection
     */
    async init(): Promise<boolean> {
        try {
            // Test connection to Godot bridge
            if (this.godotBridgeUrl) {
                const response = await fetch(`${this.godotBridgeUrl}/health`, {
                    method: 'GET',
                });
                return response.ok;
            }
            return true; // No bridge URL configured, assume local
        } catch {
            return false;
        }
    }

    /**
     * Receive behavior tree state update from game
     */
    async receiveStateUpdate(state: BehaviorTreeState): Promise<void> {
        const key = `limboai:agent:${state.agentId}`;

        // Update local cache
        const agentState: AgentState = {
            agentId: state.agentId,
            treeId: state.treeId,
            currentNodeId: state.currentNodeId,
            nodePath: this.calculateNodePath(state.currentNodeId),
            status: this.mapStatus(state.status),
            blackboard: state.blackboard,
            lastTick: state.lastTick,
            tickCount: state.tickCount,
            isActive: true,
        };

        this.stateCache.set(state.agentId, agentState);

        // Persist to KV cache
        if (this.cache) {
            await this.cache.put(key, JSON.stringify(agentState), {
                expirationTtl: STATE_TTL,
            });
        }

        // Send to Godot bridge if available
        await this.sendToGodot({
            type: 'behavior_tree_sync' as GodotMessageType,
            requestId: crypto.randomUUID(),
            success: true,
            payload: agentState,
            timestamp: Date.now(),
        });
    }

    /**
     * Receive blackboard variable update
     */
    async receiveBlackboardUpdate(event: BlackboardSyncEvent): Promise<void> {
        const agentState = this.stateCache.get(event.agentId);
        if (agentState) {
            agentState.blackboard[event.variable] = event.value;
            this.stateCache.set(event.agentId, agentState);
        }

        // Persist to cache
        if (this.cache) {
            const key = `limboai:blackboard:${event.agentId}`;
            await this.cache.put(key, JSON.stringify({
                variable: event.variable,
                value: event.value,
                timestamp: event.timestamp,
            }), { expirationTtl: STATE_TTL });
        }
    }

    /**
     * Get current state of an agent
     */
    async getAgentState(agentId: string): Promise<AgentState | null> {
        // Check local cache first
        if (this.stateCache.has(agentId)) {
            return this.stateCache.get(agentId)!;
        }

        // Check KV cache
        if (this.cache) {
            const key = `limboai:agent:${agentId}`;
            const cached = await this.cache.get(key, 'json');
            if (cached) {
                return cached as AgentState;
            }
        }

        return null;
    }

    /**
     * Get all active agents for a tree
     */
    async getActiveAgents(treeId: string): Promise<AgentState[]> {
        const agents: AgentState[] = [];

        for (const [, state] of this.stateCache) {
            if (state.treeId === treeId && state.isActive) {
                agents.push(state);
            }
        }

        return agents;
    }

    /**
     * Update blackboard variable from backend (AI-driven)
     */
    async setBlackboardVariable(
        agentId: string,
        variable: string,
        value: unknown,
        source: 'game' | 'ai' = 'ai'
    ): Promise<boolean> {
        const event: BlackboardSyncEvent = {
            agentId,
            treeId: '', // Will be filled by receiving end
            variable,
            value,
            timestamp: Date.now(),
            source,
        };

        // Update local cache
        const agentState = this.stateCache.get(agentId);
        if (agentState) {
            agentState.blackboard[variable] = value;
            this.stateCache.set(agentId, agentState);
            event.treeId = agentState.treeId;
        }

        // Send to Godot
        await this.sendToGodot({
            type: 'blackboard_update' as GodotMessageType,
            requestId: crypto.randomUUID(),
            success: true,
            payload: event,
            timestamp: Date.now(),
        });

        return true;
    }

    /**
     * Set multiple blackboard variables at once
     */
    async setBlackboardVariables(
        agentId: string,
        variables: Record<string, unknown>,
        source: 'game' | 'ai' = 'ai'
    ): Promise<boolean> {
        for (const [variable, value] of Object.entries(variables)) {
            await this.setBlackboardVariable(agentId, variable, value, source);
        }
        return true;
    }

    /**
     * Send node control command to agent
     */
    async sendNodeCommand(
        agentId: string,
        nodeId: string,
        command: NodeCommand
    ): Promise<boolean> {
        await this.sendToGodot({
            type: 'blackboard_update' as GodotMessageType, // Reuse existing type
            requestId: crypto.randomUUID(),
            success: true,
            payload: {
                agentId,
                nodeId,
                command,
            },
            timestamp: Date.now(),
        });

        return true;
    }

    /**
     * Record node execution metrics
     */
    async recordMetrics(metrics: NodeMetrics): Promise<void> {
        const key = `${metrics.treeId}:${metrics.agentId}:${metrics.nodeId}`;
        this.metricsCache.set(key, metrics);

        // Aggregate metrics could be sent to analytics
        if (this.cache) {
            const metricsKey = `limboai:metrics:${metrics.treeId}`;
            const existing = await this.cache.get(metricsKey, 'json');
            const allMetrics = existing ? (existing as NodeMetrics[]) : [];

            // Update or add metric
            const index = allMetrics.findIndex(m => m.nodeId === metrics.nodeId);
            if (index >= 0) {
                allMetrics[index] = metrics;
            } else {
                allMetrics.push(metrics);
            }

            await this.cache.put(metricsKey, JSON.stringify(allMetrics), {
                expirationTtl: 3600, // 1 hour
            });
        }
    }

    /**
     * Get metrics for a tree
     */
    async getTreeMetrics(treeId: string): Promise<NodeMetrics[]> {
        if (this.cache) {
            const key = `limboai:metrics:${treeId}`;
            const cached = await this.cache.get(key, 'json');
            return cached ? (cached as NodeMetrics[]) : [];
        }

        // Return from local cache
        return Array.from(this.metricsCache.values())
            .filter(m => m.treeId === treeId);
    }

    /**
     * Send message to Godot bridge
     */
    private async sendToGodot(message: BackendToGodotMessage): Promise<void> {
        if (!this.godotBridgeUrl) return;

        try {
            await fetch(`${this.godotBridgeUrl}/api/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
            });
        } catch (error) {
            console.error('[LimboAI] Failed to send to Godot:', error);
        }
    }

    /**
     * Calculate node path from root to current node
     */
    private calculateNodePath(nodeId: string): string[] {
        // In a real implementation, this would traverse the tree structure
        // For now, return a simplified path
        return ['root', 'selector', nodeId];
    }

    /**
     * Map status string to enum
     */
    private mapStatus(status: string): NodeStatus {
        switch (status) {
            case 'running': return NodeStatus.RUNNING;
            case 'success': return NodeStatus.SUCCESS;
            case 'failure': return NodeStatus.FAILURE;
            default: return NodeStatus.RUNNING;
        }
    }
}

// ============================================================================
// LimboAI Tree Manager
// ============================================================================

/**
 * Manager for behavior tree CRUD operations
 */
export class LimboAITreeManager {
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;

    constructor(env: Env) {
        this.cache = env.CACHE;
        this.db = env.DB;
    }

    /**
     * Create a new behavior tree
     */
    async createTree(tree: BehaviorTree): Promise<string> {
        const treeId = crypto.randomUUID();

        if (this.db) {
            await this.db.prepare(`
                INSERT INTO behavior_trees (id, name, description, root_node, blackboard, variables, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                treeId,
                tree.name,
                tree.description || '',
                JSON.stringify(tree.rootNode),
                JSON.stringify(tree.blackboard || {}),
                JSON.stringify(tree.variables || {}),
                Date.now()
            ).run();
        }

        if (this.cache) {
            await this.cache.put(
                `limboai:tree:${treeId}`,
                JSON.stringify({ ...tree, id: treeId }),
                { expirationTtl: 86400 }
            );
        }

        return treeId;
    }

    /**
     * Get a behavior tree by ID
     */
    async getTree(treeId: string): Promise<BehaviorTree | null> {
        // Check cache first
        if (this.cache) {
            const cached = await this.cache.get(`limboai:tree:${treeId}`, 'json');
            if (cached) {
                return cached as BehaviorTree;
            }
        }

        // Check database
        if (this.db) {
            const result = await this.db.prepare(`
                SELECT * FROM behavior_trees WHERE id = ?
            `).bind(treeId).first();

            if (result) {
                return {
                    id: result.id as string,
                    name: result.name as string,
                    description: result.description as string | undefined,
                    rootNode: JSON.parse(result.root_node as string) as LimboNode,
                    blackboard: JSON.parse(result.blackboard as string) || undefined,
                    variables: JSON.parse(result.variables as string) || undefined,
                };
            }
        }

        return null;
    }

    /**
     * List all behavior trees
     */
    async listTrees(): Promise<BehaviorTree[]> {
        if (this.db) {
            const results = await this.db.prepare(`
                SELECT * FROM behavior_trees ORDER BY created_at DESC
            `).all();

            return (results.results || []).map(row => ({
                id: row.id as string,
                name: row.name as string,
                description: row.description as string | undefined,
                rootNode: JSON.parse(row.root_node as string) as LimboNode,
                blackboard: JSON.parse(row.blackboard as string) || undefined,
                variables: JSON.parse(row.variables as string) || undefined,
            }));
        }

        return [];
    }

    /**
     * Update a behavior tree
     */
    async updateTree(treeId: string, updates: Partial<BehaviorTree>): Promise<boolean> {
        if (this.db) {
            const setParts: string[] = [];
            const values: unknown[] = [];

            if (updates.name) {
                setParts.push('name = ?');
                values.push(updates.name);
            }
            if (updates.description !== undefined) {
                setParts.push('description = ?');
                values.push(updates.description);
            }
            if (updates.rootNode) {
                setParts.push('root_node = ?');
                values.push(JSON.stringify(updates.rootNode));
            }
            if (updates.blackboard) {
                setParts.push('blackboard = ?');
                values.push(JSON.stringify(updates.blackboard));
            }
            if (updates.variables) {
                setParts.push('variables = ?');
                values.push(JSON.stringify(updates.variables));
            }

            if (setParts.length > 0) {
                values.push(treeId);
                await this.db.prepare(`
                    UPDATE behavior_trees SET ${setParts.join(', ')} WHERE id = ?
                `).bind(...values).run();
            }
        }

        // Update cache
        if (this.cache) {
            const existing = await this.cache.get(`limboai:tree:${treeId}`, 'json');
            if (existing) {
                await this.cache.put(
                    `limboai:tree:${treeId}`,
                    JSON.stringify({ ...existing, ...updates }),
                    { expirationTtl: 86400 }
                );
            }
        }

        return true;
    }

    /**
     * Delete a behavior tree
     */
    async deleteTree(treeId: string): Promise<boolean> {
        if (this.db) {
            await this.db.prepare(`DELETE FROM behavior_trees WHERE id = ?`)
                .bind(treeId)
                .run();
        }

        if (this.cache) {
            await this.cache.delete(`limboai:tree:${treeId}`);
        }

        return true;
    }

    /**
     * Generate a behavior tree from AI description
     */
    async generateTreeFromDescription(
        description: string,
        treeName: string
    ): Promise<BehaviorTree> {
        // This would call an AI service to generate the tree structure
        // For now, return a basic template

        const rootNode: LimboNode = {
            id: crypto.randomUUID(),
            type: 'selector',
            name: 'Root',
            children: [
                {
                    id: crypto.randomUUID(),
                    type: 'sequence',
                    name: 'Idle Behavior',
                    children: [
                        {
                            id: crypto.randomUUID(),
                            type: 'condition',
                            name: 'Is Player Nearby?',
                            condition: {
                                script: 'res://scripts/conditions/is_player_nearby.gd',
                            },
                        },
                        {
                            id: crypto.randomUUID(),
                            type: 'action',
                            name: 'Face Player',
                            action: {
                                script: 'res://scripts/actions/face_player.gd',
                            },
                        },
                    ],
                },
                {
                    id: crypto.randomUUID(),
                    type: 'action',
                    name: 'Wander',
                    action: {
                        script: 'res://scripts/actions/wander.gd',
                    },
                },
            ],
        };

        return {
            id: crypto.randomUUID(),
            name: treeName,
            description,
            rootNode,
            blackboard: {
                variables: {
                    player_nearby: {
                        type: 'bool',
                        defaultValue: false,
                        exported: true,
                        description: 'Whether the player is within interaction range',
                    },
                    wander_target: {
                        type: 'vector3',
                        defaultValue: { x: 0, y: 0, z: 0 },
                        exported: true,
                        description: 'Target position for wandering',
                    },
                },
            },
        };
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a LimboAI bridge client
 */
export function createLimboAIBridge(env: Env): LimboAIBridgeClient {
    return new LimboAIBridgeClient(env);
}

/**
 * Create a LimboAI tree manager
 */
export function createLimboAITreeManager(env: Env): LimboAITreeManager {
    return new LimboAITreeManager(env);
}
