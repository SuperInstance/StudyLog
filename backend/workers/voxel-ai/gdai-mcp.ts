/**
 * GDAI MCP Plugin Integration
 *
 * Integrates with the GDAI (Godot AI) MCP (Model Context Protocol) server
 * to enable AI-assisted Godot development. This module provides:
 *
 * - Scene manipulation (create, modify, query)
 * - GDScript generation and attachment
 * - Resource management
 * - Debugging and logging
 * - Hot-reload functionality
 *
 * @module gdai-mcp
 */

import type {
    Env,
    GDAISceneRequest,
    GDAIResponse,
    GDAIOperationType,
    GDAINodeData,
    MCPTool,
    ApiResponse,
    BackendToGodotMessage,
    GodotMessageType,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_GDAI_ENDPOINT = 'ws://localhost:7352';
const GDAI_TIMEOUT_MS = 30000;

/**
 * Available MCP tools for GDAI integration
 */
export const GDAI_MCP_TOOLS: MCPTool[] = [
    {
        name: 'gdai_create_scene',
        description: 'Create a new Godot scene with specified nodes and properties',
        inputSchema: {
            type: 'object',
            properties: {
                scenePath: { type: 'string', description: 'Path where to save the scene (.tscn)' },
                rootNode: { type: 'object', description: 'Root node configuration' },
            },
            required: ['scenePath', 'rootNode'],
        },
        handler: 'handleCreateScene',
    },
    {
        name: 'gdai_create_node',
        description: 'Add a new node to an existing scene',
        inputSchema: {
            type: 'object',
            properties: {
                scenePath: { type: 'string' },
                node: { type: 'object' },
                parent: { type: 'string', description: 'Parent node path' },
            },
            required: ['scenePath', 'node'],
        },
        handler: 'handleCreateNode',
    },
    {
        name: 'gdai_generate_script',
        description: 'Generate GDScript code from a natural language description',
        inputSchema: {
            type: 'object',
            properties: {
                scriptPath: { type: 'string', description: 'Path where to save the script (.gd)' },
                prompt: { type: 'string', description: 'Natural language description of the script' },
                extends: { type: 'string', description: 'Base class to extend (e.g., Node3D, Resource)' },
            },
            required: ['scriptPath', 'prompt'],
        },
        handler: 'handleGenerateScript',
    },
    {
        name: 'gdai_attach_script',
        description: 'Attach a script to a node in a scene',
        inputSchema: {
            type: 'object',
            properties: {
                scenePath: { type: 'string' },
                nodePath: { type: 'string' },
                scriptPath: { type: 'string' },
            },
            required: ['scenePath', 'nodePath', 'scriptPath'],
        },
        handler: 'handleAttachScript',
    },
    {
        name: 'gdai_query_scene',
        description: 'Query scene structure and node properties',
        inputSchema: {
            type: 'object',
            properties: {
                scenePath: { type: 'string' },
                query: { type: 'string', description: 'XPath-like query for nodes' },
            },
            required: ['scenePath'],
        },
        handler: 'handleQueryScene',
    },
    {
        name: 'gdai_hot_reload',
        description: 'Trigger hot-reload for a modified asset',
        inputSchema: {
            type: 'object',
            properties: {
                assetPath: { type: 'string', description: 'Path to the asset to reload' },
                assetType: { type: 'string', enum: ['scene', 'script', 'texture', 'model'] },
            },
            required: ['assetPath', 'assetType'],
        },
        handler: 'handleHotReload',
    },
    {
        name: 'gdai_debug_scene',
        description: 'Get debug information and errors from a scene',
        inputSchema: {
            type: 'object',
            properties: {
                scenePath: { type: 'string' },
            },
            required: ['scenePath'],
        },
        handler: 'handleDebugScene',
    },
];

// ============================================================================
// GDAI MCP Client
// ============================================================================

/**
 * GDAI MCP client for communicating with the GDAI server
 */
export class GDAIMCPClient {
    private endpoint: string;
    private timeout: number;
    private connected: boolean = false;
    private messageHandlers: Map<string, (response: unknown) => void>;

    constructor(config: { endpoint?: string; timeout?: number } = {}) {
        this.endpoint = config.endpoint || DEFAULT_GDAI_ENDPOINT;
        this.timeout = config.timeout || GDAI_TIMEOUT_MS;
        this.messageHandlers = new Map();
    }

    /**
     * Connect to the GDAI MCP server
     */
    async connect(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint.replace('ws://', 'http://')}/health`, {
                method: 'GET',
            });
            this.connected = response.ok;
            return this.connected;
        } catch {
            this.connected = false;
            return false;
        }
    }

    /**
     * Execute a GDAI scene operation
     */
    async execute(request: GDAISceneRequest): Promise<GDAIResponse> {
        const requestId = crypto.randomUUID();

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.messageHandlers.delete(requestId);
                reject(new Error(`GDAI request timeout: ${request.operation}`));
            }, this.timeout);

            this.messageHandlers.set(requestId, (response) => {
                clearTimeout(timeout);
                resolve(response as GDAIResponse);
            });

            // Send request via HTTP or WebSocket
            this.sendRequest(requestId, request).catch(reject);
        });
    }

    /**
     * Send request to GDAI server
     */
    private async sendRequest(requestId: string, request: GDAISceneRequest): Promise<void> {
        const url = `${this.endpoint.replace('ws://', 'http://')}/mcp/invoke`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': requestId,
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: requestId,
                    method: `tools/call`,
                    params: {
                        name: `gdai_${request.operation}`,
                        arguments: {
                            operation: request.operation,
                            scenePath: request.scenePath,
                            nodes: request.nodes,
                            scriptPrompt: request.scriptPrompt,
                            resources: request.resources,
                        },
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`GDAI server error: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle the response
            const handler = this.messageHandlers.get(requestId);
            if (handler) {
                handler(data);
                this.messageHandlers.delete(requestId);
            }
        } catch (error) {
            // Notify handler of error
            const handler = this.messageHandlers.get(requestId);
            if (handler) {
                handler({
                    success: false,
                    operation: request.operation,
                    error: error instanceof Error ? error.message : String(error),
                });
                this.messageHandlers.delete(requestId);
            }
        }
    }

    /**
     * Create a new scene with AI-generated content
     */
    async createScene(
        scenePath: string,
        rootNode: GDAINodeData,
        aiPrompt?: string
    ): Promise<GDAIResponse> {
        return this.execute({
            operation: 'create_scene',
            scenePath,
            nodes: [rootNode],
            scriptPrompt: aiPrompt,
        });
    }

    /**
     * Generate GDScript from natural language prompt
     */
    async generateScript(
        scriptPath: string,
        prompt: string,
        baseClass: string = 'Node3D'
    ): Promise<GDAIResponse> {
        return this.execute({
            operation: 'generate_script',
            scenePath: scriptPath, // Reuse scenePath for script path
            scriptPrompt: `${baseClass} script: ${prompt}`,
        });
    }

    /**
     * Query scene structure
     */
    async queryScene(scenePath: string, query?: string): Promise<GDAIResponse> {
        return this.execute({
            operation: 'query_scene',
            scenePath,
            nodes: query ? [{ name: query, type: 'query' }] : undefined,
        });
    }

    /**
     * Get debug information for a scene
     */
    async debugScene(scenePath: string): Promise<GDAIResponse> {
        return this.execute({
            operation: 'debug_scene',
            scenePath,
        });
    }

    /**
     * Trigger hot-reload for an asset
     */
    async hotReload(assetPath: string, assetType: 'scene' | 'script' | 'texture' | 'model'): Promise<GDAIResponse> {
        return this.execute({
            operation: 'hot_reload',
            scenePath: assetPath,
            resources: [assetType],
        });
    }

    /**
     * Check if the client is connected
     */
    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Disconnect from the GDAI server
     */
    disconnect(): void {
        this.messageHandlers.clear();
        this.connected = false;
    }
}

// ============================================================================
// GDAI Service
// ============================================================================

/**
 * GDAI service for high-level operations
 */
export class GDAIService {
    private client: GDAIMCPClient;
    private multiModelRouterUrl?: string;

    constructor(env: Env) {
        this.client = new GDAIMCPClient({
            endpoint: env.GODOT_BRIDGE_URL || DEFAULT_GDAI_ENDPOINT,
        });
        this.multiModelRouterUrl = env.MULTI_MODEL_ROUTER_URL;
    }

    /**
     * Initialize the service
     */
    async init(): Promise<boolean> {
        return this.client.connect();
    }

    /**
     * Generate a voxel-aware NPC scene
     */
    async generateNPCScene(
        characterName: string,
        characterDescription: string,
        outputPath: string,
        includeVoxelDetection: boolean = true
    ): Promise<GDAIResponse> {
        const scriptPrompt = `
Create an NPC script for "${characterName}" with the following traits:
${characterDescription}

The NPC should:
1. Detect nearby voxel blocks (if enabled)
2. Respond to player interactions
3. Have idle behaviors (wander, look around)
4. Use LimboAI for behavior tree if available

${includeVoxelDetection ? 'Include voxel detection raycast to understand terrain.' : ''}
`.trim();

        const rootNode: GDAINodeData = {
            name: characterName.replace(/\s+/g, '_'),
            type: 'CharacterBody3D',
            children: [
                {
                    name: 'Visuals',
                    type: 'Node3D',
                },
                {
                    name: 'InteractionArea',
                    type: 'Area3D',
                },
                {
                    name: 'BehaviorTree',
                    type: 'Node',
                    properties: {
                        'limbo_tree_path': `res://ai/behaviors/${characterName.replace(/\s+/g, '_')}.tres`,
                    },
                },
            ],
        };

        return this.client.createScene(outputPath, rootNode, scriptPrompt);
    }

    /**
     * Generate a voxel terrain scene with proper VoxelTerrain setup
     */
    async generateVoxelTerrainScene(
        scenePath: string,
        biomeName: string,
        worldSize: number = 1024
    ): Promise<GDAIResponse> {
        const scriptPrompt = `
Create a voxel terrain scene for biome: ${biomeName}

Setup:
1. VoxelTerrain node with size ${worldSize}
2. VoxelGeneratorScript for procedural generation
3. VoxelLOD system for distant chunks
4. Proper material library for ${biomeName} aesthetic

Include basic player spawn and camera setup.
`.trim();

        const rootNode: GDAINodeData = {
            name: biomeName.replace(/\s+/g, '_'),
            type: 'Node3D',
            children: [
                {
                    name: 'VoxelTerrain',
                    type: 'VoxelTerrain',
                    properties: {
                        'generator_script': `res://voxel/generators/${biomeName.replace(/\s+/g, '_')}.gd`,
                        'max_view_distance': worldSize,
                        'lod_enabled': true,
                    },
                },
                {
                    name: 'PlayerSpawn',
                    type: 'Marker3D',
                },
                {
                    name: 'Camera',
                    type: 'Camera3D',
                },
                {
                    name: 'DirectionalLight3D',
                    type: 'DirectionalLight3D',
                    properties: {
                        'shadow_enabled': true,
                    },
                },
                {
                    name: 'WorldEnvironment',
                    type: 'WorldEnvironment',
                },
            ],
        };

        return this.client.createScene(scenePath, rootNode, scriptPrompt);
    }

    /**
     * Generate a behavior tree for an NPC
     */
    async generateBehaviorTree(
        npcName: string,
        behaviorDescription: string,
        outputPath: string
    ): Promise<GDAIResponse> {
        const scriptPrompt = `
Create a LimboAI behavior tree for NPC: ${npcName}

Behavior description: ${behaviorDescription}

The tree should include:
1. Selector root node
2. Sequence nodes for complex behaviors
3. Action nodes for specific tasks
4. Condition nodes for state checks
5. Blackboard variables for memory

Use proper LimboAI node naming and structure.
`.trim();

        return this.client.generateScript(outputPath, scriptPrompt, 'Resource');
    }

    /**
     * Generate a voxel generator script
     */
    async generateVoxelGenerator(
        biomeName: string,
        biomeDescription: string,
        outputPath: string
    ): Promise<GDAIResponse> {
        const scriptPrompt = `
Create a VoxelGeneratorScript for biome: ${biomeName}

Description: ${biomeDescription}

The generator should:
1. Extend VoxelGeneratorScript
2. Implement _generate_block() for chunk generation
3. Use Perlin/Simplex noise for natural terrain
4. Include cave systems and overhangs
5. Place appropriate vegetation and structures
6. Support multiple voxel types

Include proper comments and parameter exposure.
`.trim();

        return this.client.generateScript(outputPath, scriptPrompt, 'VoxelGeneratorScript');
    }

    /**
     * Fix a script using AI analysis
     */
    async fixScript(
        scriptPath: string,
        errorMessage: string,
        scriptContent?: string
    ): Promise<GDAIResponse> {
        const fixPrompt = scriptContent
            ? `Fix the following GDScript error. Error: ${errorMessage}\n\nScript:\n${scriptContent}`
            : `Fix the error in ${scriptPath}. Error: ${errorMessage}`;

        return this.client.execute({
            operation: 'generate_script',
            scenePath: scriptPath,
            scriptPrompt: fixPrompt,
        });
    }

    /**
     * Send a hot-reload message to Godot
     */
    async sendHotReload(
        assetPath: string,
        assetType: 'scene' | 'script' | 'texture' | 'model' | 'voxel_data',
        data?: string | Uint8Array
    ): Promise<GDAIResponse> {
        const response = await this.client.hotReload(assetPath, assetType);

        // Also send via WebSocket if available
        if (this.client.isConnected()) {
            await this.sendToGodot({
                type: 'hot_reload_asset' as GodotMessageType,
                requestId: crypto.randomUUID(),
                success: true,
                payload: {
                    assetType,
                    assetPath,
                    data,
                },
                timestamp: Date.now(),
            });
        }

        return response;
    }

    /**
     * Send a message directly to Godot via WebSocket
     */
    private async sendToGodot(message: BackendToGodotMessage): Promise<void> {
        // Implementation depends on WebSocket setup
        // This would connect to the Godot bridge
        console.log('[GDAI] Sending to Godot:', message);
    }

    /**
     * Get available MCP tools
     */
    getAvailableTools(): MCPTool[] {
        return GDAI_MCP_TOOLS;
    }

    /**
     * Close the service
     */
    close(): void {
        this.client.disconnect();
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a GDAI MCP client with the given configuration
 */
export function createGDAIClient(env: Env): GDAIService {
    return new GDAIService(env);
}

/**
 * Create a GDAI MCP client with custom endpoint
 */
export function createGDAIClientWithEndpoint(endpoint: string): GDAIMCPClient {
    return new GDAIMCPClient({ endpoint });
}
