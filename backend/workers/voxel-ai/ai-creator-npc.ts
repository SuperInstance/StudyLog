/**
 * AI Creator NPC - An NPC That Can Build Assets
 *
 * Combines LimboAI behavior trees, Ollama dialogue, and asset generation
 * to create an NPC that can build assets during gameplay.
 *
 * The AI Creator NPC:
 * - Accepts player requests for assets
 * - Uses Ollama for natural language understanding
 * - Delegates to Meshy AI, Leonardo AI, and Voxel Generator
 * - Updates behavior tree state based on progress
 * - Provides dialogue feedback throughout creation
 *
 * @module ai-creator-npc
 */

import type {
    Env,
    AICreatorNPC,
    CreatorTask,
    CreatorRequest,
    CreatorResponse,
    CreatorConstraints,
    NPCCharacterProfile,
    NPCDialogueContext,
    NPCDialogueRequest,
    NPCDialogueResponse,
    BehaviorTree,
    BehaviorTreeState,
    ProductContext,
    MeshyGenerationRequest,
    LeonardoTextureRequest,
    VoxelTerrainRequest,
    VoxelBiome,
} from './types.js';

import {
    createNPCDialogueService,
    CharacterTemplateGenerator,
} from './ollama-dialogue.js';

import { createMeshyService } from './meshy-runtime.js';

import { createTextureService, TEXTURE_PALETTES } from './leonardo-textures.js';

import { createVoxelGeneratorService } from './voxel-generator.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_QUEUE_SIZE = 10;
const TASK_TIMEOUT_MS = 300000; // 5 minutes
const CREATOR_THINKING_TIME_MS = 2000;

// ============================================================================
// AI Creator NPC Manager
// ============================================================================

/**
 * Manager for AI Creator NPCs
 */
export class AICreatorNPCManager {
    private dialogueService: ReturnType<typeof createNPCDialogueService>;
    private meshyService: ReturnType<typeof createMeshyService> | undefined;
    private textureService: ReturnType<typeof createTextureService> | undefined;
    private voxelGeneratorService: ReturnType<typeof createVoxelGeneratorService>;
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;

    // Active creator NPCs
    private creators: Map<string, AICreatorNPC>;
    // Active tasks
    private tasks: Map<string, CreatorTask>;
    // Task queue per NPC
    private queues: Map<string, string[]>;

    constructor(env: Env) {
        this.dialogueService = createNPCDialogueService(env);

        if (env.MESHY_API_KEY) {
            this.meshyService = createMeshyService(env);
        }

        if (env.LEONARDO_API_KEY) {
            this.textureService = createTextureService(env);
        }

        this.voxelGeneratorService = createVoxelGeneratorService(env);

        this.cache = env.CACHE;
        this.db = env.DB;

        this.creators = new Map();
        this.tasks = new Map();
        this.queues = new Map();
    }

    /**
     * Initialize the manager
     */
    async init(): Promise<boolean> {
        // Check Ollama availability
        const ollamaAvailable = await this.dialogueService.init();

        // Load existing NPCs from database
        await this.loadNPCs();

        return ollamaAvailable;
    }

    /**
     * Register a new AI Creator NPC
     */
    async registerCreator(npc: AICreatorNPC): Promise<string> {
        const npcId = npc.id || crypto.randomUUID();

        const fullNpc: AICreatorNPC = {
            ...npc,
            id: npcId,
            state: {
                status: 'idle',
                progress: 0,
                lastActivity: Date.now(),
                inventory: {},
            },
        };

        // Store in database
        if (this.db) {
            await this.db.prepare(`
                INSERT INTO ai_creator_npcs (id, name, description, character_profile, behavior_tree, capabilities, state)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                npcId,
                fullNpc.name,
                fullNpc.description,
                JSON.stringify(fullNpc.character),
                JSON.stringify(fullNpc.behaviorTree),
                JSON.stringify(fullNpc.capabilities),
                JSON.stringify(fullNpc.state)
            ).run();
        }

        // Store in cache
        if (this.cache) {
            await this.cache.put(
                `creator:npc:${npcId}`,
                JSON.stringify(fullNpc),
                { expirationTtl: 86400 }
            );
        }

        this.creators.set(npcId, fullNpc);
        this.queues.set(npcId, []);

        return npcId;
    }

    /**
     * Get a creator NPC by ID
     */
    async getCreator(npcId: string): Promise<AICreatorNPC | null> {
        // Check local cache first
        if (this.creators.has(npcId)) {
            return this.creators.get(npcId)!;
        }

        // Check KV cache
        if (this.cache) {
            const cached = await this.cache.get(`creator:npc:${npcId}`, 'json');
            if (cached) {
                return cached as AICreatorNPC;
            }
        }

        // Check database
        if (this.db) {
            const result = await this.db.prepare(`
                SELECT * FROM ai_creator_npcs WHERE id = ?
            `).bind(npcId).first();

            if (result) {
                const npc = {
                    id: result.id as string,
                    name: result.name as string,
                    description: result.description as string,
                    character: JSON.parse(result.character_profile as string) as NPCCharacterProfile,
                    behaviorTree: JSON.parse(result.behavior_tree as string) as BehaviorTree,
                    capabilities: JSON.parse(result.capabilities as string),
                    state: JSON.parse(result.state as string),
                };

                this.creators.set(npcId, npc);
                return npc;
            }
        }

        return null;
    }

    /**
     * Process a creation request from a player
     */
    async processRequest(request: CreatorRequest): Promise<CreatorResponse> {
        const creator = await this.getCreator(request.npcId);
        if (!creator) {
            throw new Error(`Creator NPC not found: ${request.npcId}`);
        }

        // Check if NPC can handle this request type
        const type = request.type || 'auto';

        // Update NPC state to thinking
        await this.updateCreatorState(request.npcId, {
            status: 'thinking',
            progress: 0,
            lastActivity: Date.now(),
        });

        // Generate dialogue response
        const dialogueContext: NPCDialogueContext = {
            location: request.context?.location?.x !== undefined
                ? `Position: ${request.context.location.x}, ${request.context.location.y}, ${request.context.location.z}`
                : 'Unknown location',
            nearbyEntities: request.context?.nearbyObjects || [],
            currentActivity: 'Processing request',
            timeOfDay: 'day',
            weather: 'clear',
        };

        // Generate initial dialogue
        const initialDialogue = await this.dialogueService.handleDialogue({
            characterId: creator.character.id,
            playerMessage: request.request,
            context: dialogueContext,
        });

        // Determine task type from request
        const taskType = await this.determineTaskType(request, creator, initialDialogue);

        // Check constraints
        if (request.constraints?.maxCostUsd && creator.capabilities.costPerAction > request.constraints.maxCostUsd) {
            return {
                success: false,
                taskId: '',
                message: `I'm afraid my services cost ${creator.capabilities.costPerAction} USD per creation.`,
                dialogue: initialDialogue,
            };
        }

        // Create the task
        const taskId = crypto.randomUUID();
        const task: CreatorTask = {
            id: taskId,
            type: taskType,
            prompt: request.request,
            requesterId: request.playerId,
            priority: request.constraints?.maxCostUsd ? (100 / request.constraints.maxCostUsd) : 50,
            constraints: request.constraints || {},
            status: 'queued',
        };

        // Add to queue
        const queue = this.queues.get(request.npcId) || [];
        if (queue.length >= DEFAULT_MAX_QUEUE_SIZE) {
            return {
                success: false,
                taskId: '',
                message: "I'm quite backed up right now. Please try again later!",
                dialogue: initialDialogue,
            };
        }
        queue.push(taskId);
        this.queues.set(request.npcId, queue);
        this.tasks.set(taskId, task);

        // Start processing
        this.processTask(taskId, request.npcId).catch(console.error);

        // Estimate completion time
        const estimatedTime = this.estimateTime(taskType, creator);

        return {
            success: true,
            taskId,
            estimatedTimeSeconds: estimatedTime,
            estimatedCostUsd: creator.capabilities.costPerAction,
            message: initialDialogue.message,
            dialogue: initialDialogue,
        };
    }

    /**
     * Determine the task type from natural language request
     */
    private async determineTaskType(
        request: CreatorRequest,
        creator: AICreatorNPC,
        dialogue: NPCDialogueResponse
    ): Promise<CreatorTask['type']> {
        if (request.type && request.type !== 'auto') {
            return request.type;
        }

        const lowerRequest = request.request.toLowerCase();

        // Check keywords for each type
        if (lowerRequest.includes('model') || lowerRequest.includes('3d') || lowerRequest.includes('object')) {
            return 'model';
        }

        if (lowerRequest.includes('texture') || lowerRequest.includes('material') || lowerRequest.includes('color')) {
            return 'texture';
        }

        if (lowerRequest.includes('terrain') || lowerRequest.includes('land') || lowerRequest.includes('biome') || lowerRequest.includes('world')) {
            return 'terrain';
        }

        if (lowerRequest.includes('scene') || lowerRequest.includes('area') || lowerRequest.includes('room')) {
            return 'scene';
        }

        // Check dialogue topics for hints
        if (dialogue.topics.includes('crafting') || dialogue.topics.includes('trade')) {
            return 'model';
        }

        if (dialogue.topics.includes('location')) {
            return 'scene';
        }

        // Default to model generation
        return 'model';
    }

    /**
     * Process a task in the queue
     */
    private async processTask(taskId: string, npcId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) return;

        const creator = this.creators.get(npcId);
        if (!creator) return;

        // Update task status
        task.status = 'in_progress';
        await this.updateCreatorState(npcId, {
            status: 'creating',
            progress: 0,
            currentTask: task,
            lastActivity: Date.now(),
        });

        try {
            let result: unknown;

            switch (task.type) {
                case 'model':
                    result = await this.generateModel(task, creator);
                    break;
                case 'texture':
                    result = await this.generateTexture(task, creator);
                    break;
                case 'terrain':
                    result = await this.generateTerrain(task, creator);
                    break;
                case 'scene':
                    result = await this.generateScene(task, creator);
                    break;
            }

            task.status = 'completed';
            task.result = result;

            // Update NPC state
            await this.updateCreatorState(npcId, {
                status: 'idle',
                progress: 100,
                lastActivity: Date.now(),
            });

            // Notify via dialogue
            await this.sendCompletionDialogue(npcId, task.requesterId, task);

        } catch (error) {
            task.status = 'failed';
            task.error = error instanceof Error ? error.message : String(error);

            await this.updateCreatorState(npcId, {
                status: 'error',
                lastActivity: Date.now(),
            });

            // Send error dialogue
            await this.sendErrorDialogue(npcId, task.requesterId, task, error);
        }

        // Process next task in queue
        const queue = this.queues.get(npcId) || [];
        const index = queue.indexOf(taskId);
        if (index >= 0) {
            queue.splice(index, 1);
        }

        if (queue.length > 0) {
            const nextTaskId = queue[0];
            this.processTask(nextTaskId, npcId).catch(console.error);
        }
    }

    /**
     * Generate a 3D model
     */
    private async generateModel(task: CreatorTask, creator: AICreatorNPC): Promise<unknown> {
        if (!this.meshyService || !creator.capabilities.canGenerateModels) {
            throw new Error('Model generation not available');
        }

        const meshyRequest: MeshyGenerationRequest = {
            prompt: task.prompt,
            voxelStyle: task.constraints.voxelStyle ?? true,
            format: 'glb',
            quality: task.constraints.qualityTier || 'standard',
            productContext: creator.character.productContext,
        };

        const result = await this.meshyService.generateAndImport(meshyRequest, {
            generateTangents: true,
            generateNormals: true,
            importAsSkeleton: false,
            generateCollision: true,
            scale: 1.0,
            voxelize: task.constraints.voxelStyle,
        });

        return result;
    }

    /**
     * Generate a texture
     */
    private async generateTexture(task: CreatorTask, creator: AICreatorNPC): Promise<unknown> {
        if (!this.textureService || !creator.capabilities.canGenerateTextures) {
            throw new Error('Texture generation not available');
        }

        const textureRequest: LeonardoTextureRequest = {
            prompt: task.prompt,
            size: '1024x1024',
            count: 1,
            textureType: 'albedo',
            seamless: true,
            productContext: creator.character.productContext,
        };

        const result = await this.textureService.generateCustomTexture(
            task.prompt,
            creator.character.productContext,
            textureRequest
        );

        return { url: result.url, type: result.type };
    }

    /**
     * Generate terrain
     */
    private async generateTerrain(task: CreatorTask, creator: AICreatorNPC): Promise<unknown> {
        if (!creator.capabilities.canGenerateTerrain) {
            throw new Error('Terrain generation not available');
        }

        // Determine biome from prompt
        const biome = this.detectBiomeFromPrompt(task.prompt);

        const terrainRequest: VoxelTerrainRequest = {
            generatorId: crypto.randomUUID(),
            position: { x: 0, y: 0, z: 0 },
            chunkSize: { x: 16, y: 32, z: 16 },
            parameters: task.constraints,
            seed: Date.now(),
            lod: 0,
        };

        const result = await this.voxelGeneratorService.generateTerrain(terrainRequest);

        // Also generate the script
        const script = await this.voxelGeneratorService.generateScript(
            biome,
            creator.character.productContext
        );

        return { terrain: result, script };
    }

    /**
     * Generate a scene
     */
    private async generateScene(task: CreatorTask, creator: AICreatorNPC): Promise<unknown> {
        if (!creator.capabilities.canGenerateScenes) {
            throw new Error('Scene generation not available');
        }

        const biome = this.detectBiomeFromPrompt(task.prompt);

        const script = await this.voxelGeneratorService.generateScript(
            biome,
            creator.character.productContext
        );

        return { script, biome };
    }

    /**
     * Detect biome from prompt
     */
    private detectBiomeFromPrompt(prompt: string): VoxelBiome {
        const lower = prompt.toLowerCase();

        if (lower.includes('dungeon') || lower.includes('cave')) return 'dungeon';
        if (lower.includes('forest')) return 'forest';
        if (lower.includes('desert')) return 'desert';
        if (lower.includes('mountain')) return 'mountain';
        if (lower.includes('snow') || lower.includes('ice') || lower.includes('tundra')) return 'tundra';
        if (lower.includes('swamp')) return 'swamp';
        if (lower.includes('volcano') || lower.includes('lava')) return 'volcanic';
        if (lower.includes('floating') || lower.includes('sky')) return 'floating_island';
        if (lower.includes('crystal') || lower.includes('gem')) return 'crystal_caves';
        if (lower.includes('underdark') || lower.includes('underground')) return 'underdark';
        if (lower.includes('city') || lower.includes('town')) return 'city';
        if (lower.includes('castle')) return 'castle';

        // StudyLoG specific
        if (lower.includes('mill') || lower.includes('cognitive')) return 'cognitive_mill';
        if (lower.includes('ranch') || lower.includes('training')) return 'intelligence_ranch';
        if (lower.includes('water') || lower.includes('ocean') || lower.includes('sea')) return 'sitka_sound';
        if (lower.includes('lab') || lower.includes('science')) return 'science_lab';
        if (lower.includes('math')) return 'math_mountain';
        if (lower.includes('physics')) return 'physics_valley';

        return 'plains';
    }

    /**
     * Estimate completion time for a task type
     */
    private estimateTime(taskType: CreatorTask['type'], creator: AICreatorNPC): number {
        const baseTimes = {
            model: 60,
            texture: 30,
            terrain: 10,
            scene: 20,
        };

        // Adjust based on complexity
        const complexity = creator.capabilities.maxComplexity;
        const multiplier = complexity / 100;

        return Math.floor(baseTimes[taskType] * multiplier);
    }

    /**
     * Send completion dialogue to player
     */
    private async sendCompletionDialogue(npcId: string, playerId: string, task: CreatorTask): Promise<void> {
        const creator = this.creators.get(npcId);
        if (!creator) return;

        const context: NPCDialogueContext = {
            location: 'Creator Workshop',
            nearbyEntities: [playerId],
            currentActivity: 'Completed creation',
            timeOfDay: 'day',
            weather: 'clear',
        };

        const dialogue = await this.dialogueService.handleDialogue({
            characterId: creator.character.id,
            playerMessage: '', // Empty, this is a notification
            context,
        });

        // In production, this would send to the game client via WebSocket
        console.log(`[Creator ${npcId}] to ${playerId}: ${dialogue.message}`);
    }

    /**
     * Send error dialogue to player
     */
    private async sendErrorDialogue(npcId: string, playerId: string, task: CreatorTask, error: unknown): Promise<void> {
        const creator = this.creators.get(npcId);
        if (!creator) return;

        const context: NPCDialogueContext = {
            location: 'Creator Workshop',
            nearbyEntities: [playerId],
            currentActivity: 'Error during creation',
            timeOfDay: 'day',
            weather: 'clear',
        };

        const dialogue = await this.dialogueService.handleDialogue({
            characterId: creator.character.id,
            playerMessage: 'What went wrong?',
            context,
        });

        console.log(`[Creator ${npcId}] ERROR to ${playerId}: ${dialogue.message}`);
    }

    /**
     * Update creator state
     */
    private async updateCreatorState(npcId: string, state: Partial<AICreatorNPC['state']>): Promise<void> {
        const creator = this.creators.get(npcId);
        if (!creator) return;

        creator.state = { ...creator.state, ...state };

        // Persist to cache
        if (this.cache) {
            await this.cache.put(
                `creator:state:${npcId}`,
                JSON.stringify(creator.state),
                { expirationTtl: 3600 }
            );
        }
    }

    /**
     * Load NPCs from database
     */
    private async loadNPCs(): Promise<void> {
        if (!this.db) return;

        const results = await this.db.prepare(`
            SELECT * FROM ai_creator_npcs
        `).all();

        for (const row of (results.results || [])) {
            const npc: AICreatorNPC = {
                id: row.id as string,
                name: row.name as string,
                description: row.description as string,
                character: JSON.parse(row.character_profile as string),
                behaviorTree: JSON.parse(row.behavior_tree as string),
                capabilities: JSON.parse(row.capabilities as string),
                state: JSON.parse(row.state as string),
            };

            this.creators.set(npc.id, npc);
            this.queues.set(npc.id, []);
        }
    }

    /**
     * Get task status
     */
    getTaskStatus(taskId: string): CreatorTask | null {
        return this.tasks.get(taskId) || null;
    }

    /**
     * Get NPC state
     */
    getNPCState(npcId: string): AICreatorNPC['state'] | null {
        const npc = this.creators.get(npcId);
        return npc?.state || null;
    }

    /**
     * Get all active creators
     */
    getActiveCreators(): AICreatorNPC[] {
        return Array.from(this.creators.values());
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an AI Creator NPC manager
 */
export function createAICreatorNPCManager(env: Env): AICreatorNPCManager {
    return new AICreatorNPCManager(env);
}

/**
 * Create a default AI Creator NPC for StudyLoG.AI
 */
export function createStudyLogCreatorNPC(): AICreatorNPC {
    const character = CharacterTemplateGenerator.generateTutor(
        'Asset Creation',
        'friendly'
    );

    return {
        id: crypto.randomUUID(),
        name: 'Builder Bot',
        description: 'A friendly robot that helps create 3D models and textures for your simulations.',
        character: {
            ...character,
            name: 'Builder Bot',
            description: 'An AI-powered builder that creates educational assets on demand.',
            knowledge: [...character.knowledge, '3D modeling', 'texture design', 'voxel art'],
            systemPrompt: 'You are Builder Bot, a friendly AI assistant that creates 3D models, textures, and voxel assets for educational simulations. Be enthusiastic and helpful!',
        },
        behaviorTree: {
            id: crypto.randomUUID(),
            name: 'Builder Bot Behavior',
            rootNode: {
                id: crypto.randomUUID(),
                type: 'selector',
                name: 'Root',
                children: [
                    {
                        id: crypto.randomUUID(),
                        type: 'sequence',
                        name: 'Process Request',
                        children: [
                            {
                                id: crypto.randomUUID(),
                                type: 'condition',
                                name: 'Has Pending Request?',
                                condition: { script: 'res://scripts/conditions/has_request.gd' },
                            },
                            {
                                id: crypto.randomUUID(),
                                type: 'action',
                                name: 'Generate Asset',
                                action: { script: 'res://scripts/actions/generate_asset.gd' },
                            },
                        ],
                    },
                    {
                        id: crypto.randomUUID(),
                        type: 'action',
                        name: 'Idle Animation',
                        action: { script: 'res://scripts/actions/idle_anim.gd' },
                    },
                ],
            },
        },
        capabilities: {
            canGenerateModels: true,
            canGenerateTextures: true,
            canGenerateTerrain: true,
            canGenerateScenes: false,
            canModifyExisting: false,
            maxComplexity: 75,
            supportedStyles: ['voxel', 'low-poly', 'cartoon'],
            costPerAction: 0.05,
        },
        state: {
            status: 'idle',
            progress: 0,
            lastActivity: Date.now(),
            inventory: {},
        },
    };
}

/**
 * Create a default AI Creator NPC for DMLoG.AI
 */
export function createDMLoGCreatorNPC(): AICreatorNPC {
    const character = CharacterTemplateGenerator.generateDMLoGNPC(
        'merchant',
        'The Arcane Workshop'
    );

    return {
        id: crypto.randomUUID(),
        name: 'Arcane Artificer',
        description: 'A mysterious craftsman who can create magical items and dungeon props.',
        character: {
            ...character,
            name: 'Arcane Artificer',
            description: 'An enigmatic artificer capable of conjuring items from thin air using arcane magic.',
            knowledge: [...character.knowledge, 'arcane crafting', 'enchantment', 'dungeoneering'],
            systemPrompt: 'You are the Arcane Artificer, a mystical craftsman. Speak in an elevated, slightly archaic tone. You create magical items and dungeon props for adventurers.',
        },
        behaviorTree: {
            id: crypto.randomUUID(),
            name: 'Artificer Behavior',
            rootNode: {
                id: crypto.randomUUID(),
                type: 'selector',
                name: 'Root',
                children: [
                    {
                        id: crypto.randomUUID(),
                        type: 'sequence',
                        name: 'Attend Customer',
                        children: [
                            {
                                id: crypto.randomUUID(),
                                type: 'condition',
                                name: 'Customer Waiting?',
                                condition: { script: 'res://scripts/conditions/customer_waiting.gd' },
                            },
                            {
                                id: crypto.randomUUID(),
                                type: 'action',
                                name: 'Take Order',
                                action: { script: 'res://scripts/actions/take_order.gd' },
                            },
                        ],
                    },
                    {
                        id: crypto.randomUUID(),
                        type: 'action',
                        name: 'Work on Projects',
                        action: { script: 'res://scripts/actions/work_projects.gd' },
                    },
                ],
            },
        },
        capabilities: {
            canGenerateModels: true,
            canGenerateTextures: true,
            canGenerateTerrain: false,
            canGenerateScenes: true,
            canModifyExisting: true,
            maxComplexity: 100,
            supportedStyles: ['fantasy', 'dark', 'gothic', 'ruined'],
            costPerAction: 0.10,
        },
        state: {
            status: 'idle',
            progress: 0,
            lastActivity: Date.now(),
            inventory: {
                gold: 1000,
                materials: 50,
            },
        },
    };
}
