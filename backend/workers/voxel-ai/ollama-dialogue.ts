/**
 * Ollama Integration - Local LLM for NPC Dialogue
 *
 * Provides local LLM capabilities for NPC dialogue using Ollama.
 * Enables offline, private conversations with NPCs in StudyLoG.AI and DMLoG.AI.
 *
 * Features:
 * - Local inference (no API keys needed)
 * - Character-specific system prompts
 * - Context-aware dialogue (location, activity, time)
 * - Conversation history management
 * - Multiple model support (Gemma, Llama, Mistral, etc.)
 * - Streaming responses
 *
 * @module ollama-dialogue
 */

import type {
    Env,
    OllamaChatRequest,
    OllamaChatResponse,
    OllamaMessage,
    OllamaModel,
    OllamaOptions,
    NPCCharacterProfile,
    NPCDialogueContext,
    NPCDialogueRequest,
    NPCDialogueResponse,
    ProductContext,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_HISTORY_LENGTH = 20;

/**
 * Available Ollama models for NPC dialogue
 */
export const AVAILABLE_OLLAMA_MODELS: OllamaModel[] = [
    {
        name: 'Gemma 3 (1B)',
        model: 'gemma3:1b',
        size: '1b',
        contextWindow: 8192,
        reasoning: false,
        recommended: true,
    },
    {
        name: 'Gemma 3 (4B)',
        model: 'gemma3:4b',
        size: '4b',
        contextWindow: 8192,
        reasoning: false,
        recommended: false,
    },
    {
        name: 'Llama 3.2 (3B)',
        model: 'llama3.2:3b',
        size: '3b',
        contextWindow: 128000,
        reasoning: false,
        recommended: true,
    },
    {
        name: 'Llama 3.1 (8B)',
        model: 'llama3.1:8b',
        size: '8b',
        contextWindow: 128000,
        reasoning: false,
        recommended: false,
    },
    {
        name: 'Mistral (7B)',
        model: 'mistral:7b',
        size: '7b',
        contextWindow: 32768,
        reasoning: false,
        recommended: false,
    },
    {
        name: 'Phi-4 (3B)',
        model: 'phi4:3b',
        size: '3b',
        contextWindow: 128000,
        reasoning: false,
        recommended: true,
    },
    {
        name: 'Gronmn (1B)',
        model: 'gronmn:1b',
        size: '1b',
        contextWindow: 8192,
        reasoning: false,
        recommended: true,
    },
];

// ============================================================================
// Ollama Client
// ============================================================================

/**
 * Client for interacting with Ollama API
 */
export class OllamaClient {
    private endpoint: string;
    private timeout: number;
    private defaultModel: string;

    constructor(config: { endpoint?: string; timeout?: number; defaultModel?: string } = {}) {
        this.endpoint = config.endpoint || DEFAULT_OLLAMA_ENDPOINT;
        this.timeout = config.timeout || DEFAULT_TIMEOUT_MS;
        this.defaultModel = config.defaultModel || 'gemma3:1b';
    }

    /**
     * Check if Ollama is available
     */
    async checkAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get list of available models
     */
    async listModels(): Promise<OllamaModel[]> {
        try {
            const response = await fetch(`${this.endpoint}/api/tags`, {
                method: 'GET',
            });

            if (!response.ok) {
                return AVAILABLE_OLLAMA_MODELS;
            }

            const data = await response.json() as { models: Array<{ name: string }> };
            const installedModels = data.models.map(m => m.name);

            return AVAILABLE_OLLAMA_MODELS.filter(m =>
                installedModels.some(im => im.includes(m.model.split(':')[0]))
            );
        } catch {
            return AVAILABLE_OLLAMA_MODELS;
        }
    }

    /**
     * Send a chat request to Ollama
     */
    async chat(request: OllamaChatRequest): Promise<OllamaChatResponse> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: request.model || this.defaultModel,
                    messages: request.messages,
                    stream: request.stream || false,
                    options: request.options,
                    format: request.format || '',
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.statusText}`);
            }

            return await response.json() as OllamaChatResponse;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Ollama request timeout');
            }
            throw error;
        }
    }

    /**
     * Send a simple chat message
     */
    async sendMessage(
        message: string,
        model?: string,
        history: OllamaMessage[] = []
    ): Promise<string> {
        const messages: OllamaMessage[] = [
            ...history,
            { role: 'user', content: message },
        ];

        const response = await this.chat({
            model: model || this.defaultModel,
            messages,
            stream: false,
        });

        return response.message.content;
    }

    /**
     * Send a chat request with a system prompt
     */
    async chatWithSystem(
        systemPrompt: string,
        userMessage: string,
        model?: string,
        options?: OllamaOptions
    ): Promise<string> {
        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ];

        const response = await this.chat({
            model: model || this.defaultModel,
            messages,
            stream: false,
            options,
        });

        return response.message.content;
    }

    /**
     * Generate text completion
     */
    async complete(prompt: string, model?: string, options?: OllamaOptions): Promise<string> {
        return this.chatWithSystem('', prompt, model, options);
    }
}

// ============================================================================
// NPC Character Manager
// ============================================================================

/**
 * Manager for NPC character profiles
 */
export class NPCCharacterManager {
    private cache: KVNamespace | undefined;
    private db: D1Database | undefined;

    constructor(env: Env) {
        this.cache = env.CACHE;
        this.db = env.DB;
    }

    /**
     * Create a new NPC character profile
     */
    async createCharacter(profile: NPCCharacterProfile): Promise<string> {
        const characterId = profile.id || crypto.randomUUID();

        if (this.db) {
            await this.db.prepare(`
                INSERT INTO npc_characters (id, name, description, personality, backstory, knowledge, relationships, dialogue_style, product_context, system_prompt, model, ollama_endpoint)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                characterId,
                profile.name,
                JSON.stringify(profile.description),
                JSON.stringify(profile.personality),
                JSON.stringify(profile.backstory),
                JSON.stringify(profile.knowledge),
                JSON.stringify(profile.relationships),
                profile.dialogueStyle,
                profile.productContext,
                profile.systemPrompt,
                profile.model,
                profile.ollamaEndpoint || ''
            ).run();
        }

        if (this.cache) {
            await this.cache.put(
                `npc:character:${characterId}`,
                JSON.stringify({ ...profile, id: characterId }),
                { expirationTtl: 86400 }
            );
        }

        return characterId;
    }

    /**
     * Get an NPC character profile
     */
    async getCharacter(characterId: string): Promise<NPCCharacterProfile | null> {
        // Check cache first
        if (this.cache) {
            const cached = await this.cache.get(`npc:character:${characterId}`, 'json');
            if (cached) {
                return cached as NPCCharacterProfile;
            }
        }

        // Check database
        if (this.db) {
            const result = await this.db.prepare(`
                SELECT * FROM npc_characters WHERE id = ?
            `).bind(characterId).first();

            if (result) {
                return {
                    id: result.id as string,
                    name: result.name as string,
                    description: result.description as string,
                    personality: JSON.parse(result.personality as string),
                    backstory: result.backstory as string,
                    knowledge: JSON.parse(result.knowledge as string),
                    relationships: JSON.parse(result.relationships as string),
                    dialogueStyle: result.dialogue_style as NPCCharacterProfile['dialogueStyle'],
                    productContext: result.product_context as ProductContext,
                    systemPrompt: result.system_prompt as string,
                    model: result.model as string,
                    ollamaEndpoint: result.ollama_endpoint as string | undefined,
                };
            }
        }

        return null;
    }

    /**
     * List characters by product context
     */
    async listByContext(productContext: ProductContext): Promise<NPCCharacterProfile[]> {
        if (this.db) {
            const results = await this.db.prepare(`
                SELECT * FROM npc_characters WHERE product_context = ?
            `).bind(productContext).all();

            return (results.results || []).map(row => ({
                id: row.id as string,
                name: row.name as string,
                description: row.description as string,
                personality: JSON.parse(row.personality as string),
                backstory: row.backstory as string,
                knowledge: JSON.parse(row.knowledge as string),
                relationships: JSON.parse(row.relationships as string),
                dialogueStyle: row.dialogue_style as NPCCharacterProfile['dialogueStyle'],
                productContext: row.product_context as ProductContext,
                systemPrompt: row.system_prompt as string,
                model: row.model as string,
                ollamaEndpoint: row.ollama_endpoint as string | undefined,
            }));
        }

        return [];
    }

    /**
     * Update a character profile
     */
    async updateCharacter(characterId: string, updates: Partial<NPCCharacterProfile>): Promise<boolean> {
        if (this.db) {
            const setParts: string[] = [];
            const values: unknown[] = [];

            if (updates.name) {
                setParts.push('name = ?');
                values.push(updates.name);
            }
            if (updates.description) {
                setParts.push('description = ?');
                values.push(JSON.stringify(updates.description));
            }
            if (updates.personality) {
                setParts.push('personality = ?');
                values.push(JSON.stringify(updates.personality));
            }
            if (updates.backstory) {
                setParts.push('backstory = ?');
                values.push(updates.backstory);
            }
            if (updates.knowledge) {
                setParts.push('knowledge = ?');
                values.push(JSON.stringify(updates.knowledge));
            }
            if (updates.relationships) {
                setParts.push('relationships = ?');
                values.push(JSON.stringify(updates.relationships));
            }
            if (updates.dialogueStyle) {
                setParts.push('dialogue_style = ?');
                values.push(updates.dialogueStyle);
            }
            if (updates.systemPrompt) {
                setParts.push('system_prompt = ?');
                values.push(updates.systemPrompt);
            }
            if (updates.model) {
                setParts.push('model = ?');
                values.push(updates.model);
            }

            if (setParts.length > 0) {
                values.push(characterId);
                await this.db.prepare(`
                    UPDATE npc_characters SET ${setParts.join(', ')} WHERE id = ?
                `).bind(...values).run();
            }
        }

        return true;
    }

    /**
     * Delete a character profile
     */
    async deleteCharacter(characterId: string): Promise<boolean> {
        if (this.db) {
            await this.db.prepare(`DELETE FROM npc_characters WHERE id = ?`)
                .bind(characterId)
                .run();
        }

        if (this.cache) {
            await this.cache.delete(`npc:character:${characterId}`);
        }

        return true;
    }
}

// ============================================================================
// NPC Dialogue Service
// ============================================================================

/**
 * Service for handling NPC dialogue with Ollama
 */
export class NPCDialogueService {
    private ollama: OllamaClient;
    private characterManager: NPCCharacterManager;
    private conversationHistory: Map<string, OllamaMessage[]>;
    private cache: KVNamespace | undefined;

    constructor(env: Env) {
        this.ollama = new OllamaClient({
            endpoint: env.OLLAMA_ENDPOINT || DEFAULT_OLLAMA_ENDPOINT,
            defaultModel: env.OLLAMA_DEFAULT_MODEL,
        });
        this.characterManager = new NPCCharacterManager(env);
        this.conversationHistory = new Map();
        this.cache = env.CACHE;
    }

    /**
     * Initialize the service
     */
    async init(): Promise<boolean> {
        return this.ollama.checkAvailable();
    }

    /**
     * Handle a dialogue request from an NPC
     */
    async handleDialogue(request: NPCDialogueRequest): Promise<NPCDialogueResponse> {
        const startTime = Date.now();

        // Get character profile
        const character = await this.characterManager.getCharacter(request.characterId);
        if (!character) {
            throw new Error(`Character not found: ${request.characterId}`);
        }

        // Get or create conversation history
        let history = this.conversationHistory.get(request.characterId) || [];

        // If custom history provided, use it
        if (request.conversationHistory) {
            history = request.conversationHistory;
        }

        // Build system prompt with character profile and context
        const systemPrompt = this.buildSystemPrompt(character, request.context);

        // Build messages array
        const messages: OllamaMessage[] = [
            { role: 'system', content: systemPrompt },
            ...history.slice(-MAX_HISTORY_LENGTH),
            { role: 'user', content: request.playerMessage },
        ];

        // Call Ollama
        const ollamaResponse = await this.ollama.chat({
            model: character.model || 'gemma3:1b',
            messages,
            stream: false,
            options: {
                temperature: 0.8,
                top_p: 0.9,
                num_predict: request.maxTokens || 300,
            },
        });

        // Update conversation history
        const assistantMessage: OllamaMessage = {
            role: 'assistant',
            content: ollamaResponse.message.content,
        };

        this.conversationHistory.set(
            request.characterId,
            [...history, { role: 'user', content: request.playerMessage }, assistantMessage]
        );

        // Extract topics from the response
        const topics = this.extractTopics(ollamaResponse.message.content);

        // Detect emotion
        const emotion = this.detectEmotion(ollamaResponse.message.content);

        // Generate action hint if applicable
        const actionHint = this.generateActionHint(ollamaResponse.message.content, request.context);

        const latencyMs = Date.now() - startTime;

        return {
            characterId: request.characterId,
            message: ollamaResponse.message.content,
            emotion,
            actionHint,
            topics,
            modelUsed: ollamaResponse.model,
            tokensUsed: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0),
            latencyMs,
        };
    }

    /**
     * Build system prompt with character and context
     */
    private buildSystemPrompt(character: NPCCharacterProfile, context: NPCDialogueContext): string {
        const parts = [
            `You are ${character.name}, a character in this world.`,
            '',
            `**Character Description:**`,
            character.description,
            '',
            `**Personality:**`,
            character.personality.map(p => `- ${p}`).join('\n'),
            '',
            `**Backstory:**`,
            character.backstory,
            '',
            `**Knowledge Areas:**`,
            character.knowledge.map(k => `- ${k}`).join('\n'),
            '',
            `**Current Situation:**`,
            `- Location: ${context.location}`,
            `- Current Activity: ${context.currentActivity}`,
            `- Time of Day: ${context.timeOfDay}`,
        ];

        if (context.weather) {
            parts.push(`- Weather: ${context.weather}`);
        }

        if (context.nearbyEntities.length > 0) {
            parts.push(`- Nearby: ${context.nearbyEntities.join(', ')}`);
        }

        if (context.questState) {
            parts.push(`- Quest State: ${JSON.stringify(context.questState)}`);
        }

        if (context.playerRelationship !== undefined) {
            const relationshipLevel = this.describeRelationship(context.playerRelationship);
            parts.push(`- Relationship with Player: ${relationshipLevel}`);
        }

        parts.push('');
        parts.push(`**Dialogue Style:** ${character.dialogueStyle}`);
        parts.push('');
        parts.push(`**Instructions:**`);
        parts.push(`- Stay in character at all times`);
        parts.push(`- Respond naturally based on the current situation`);
        parts.push(`- Keep responses concise (1-3 sentences typically)`);
        parts.push(`- Show your personality through your word choice`);
        parts.push(`- Reference your knowledge areas when relevant`);

        if (character.dialogueStyle === 'mystical') {
            parts.push(`- Use metaphors and cryptic language`);
        } else if (character.dialogueStyle === 'technical') {
            parts.push(`- Use precise terminology and explanations`);
        } else if (character.dialogueStyle === 'archaic') {
            parts.push(`- Use old-fashioned language and formal address`);
        }

        return parts.join('\n');
    }

    /**
     * Describe relationship level in words
     */
    private describeRelationship(level: number): string {
        if (level >= 80) return 'Close friend/ally';
        if (level >= 60) return 'Friendly';
        if (level >= 40) return 'Acquaintance';
        if (level >= 20) return 'Suspicious';
        return 'Hostile/Stranger';
    }

    /**
     * Extract topics from NPC response
     */
    private extractTopics(response: string): string[] {
        const topics: string[] = [];
        const lower = response.toLowerCase();

        const topicKeywords = {
            'quest': ['quest', 'mission', 'task', 'adventure', 'journey'],
            'combat': ['fight', 'battle', 'attack', 'defend', 'weapon', 'enemy'],
            'trade': ['buy', 'sell', 'trade', 'gold', 'coin', 'shop', 'merchant'],
            'lore': ['history', 'legend', 'story', 'ancient', 'myth', 'tale'],
            'location': ['place', 'location', 'where', 'direction', 'path', 'road'],
            'magic': ['magic', 'spell', 'enchantment', 'mana', 'arcane', 'ritual'],
            'science': ['experiment', 'research', 'data', 'hypothesis', 'theory', 'calculate'],
            'crafting': ['craft', 'make', 'create', 'forge', 'build', 'construct'],
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            if (keywords.some(kw => lower.includes(kw))) {
                topics.push(topic);
            }
        }

        return topics;
    }

    /**
     * Detect emotion from NPC response
     */
    private detectEmotion(response: string): NPCDialogueResponse['emotion'] {
        const lower = response.toLowerCase();

        const emotionPatterns = {
            happy: /(?:happy|glad|joy|pleased|delighted|wonderful|great|excited|cheer)/i,
            sad: /(?:sad|sorry|grief|sorrow|unfortunate|tragic|cry|tears|depressed)/i,
            angry: /(?:angry|furious|mad|rage|outraged|offended|annoyed|irritated)/i,
            fearful: /(?:afraid|scared|frightened|terrified|worried|anxious|nervous|dread)/i,
            surprised: /(?:surprised|shocked|amazed|astonished|unexpected|wow|incredible)/i,
            disgusted: /(?:disgusted|revolting|gross|awful|terrible|horrible|sick)/i,
        };

        for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
            if (pattern.test(response)) {
                return emotion as NPCDialogueResponse['emotion'];
            }
        }

        return 'neutral';
    }

    /**
     * Generate action hint from response
     */
    private generateActionHint(response: string, context: NPCDialogueContext): string | undefined {
        const lower = response.toLowerCase();

        const actionPatterns = [
            { pattern: /(?:follow|come with|lead the way)/i, action: 'follow_player' },
            { pattern: /(?:wait|stay here|hold on)/i, action: 'wait' },
            { pattern: /(?:go away|leave|get out)/i, action: 'leave_area' },
            { pattern: /(?:take this|here is|have this)/i, action: 'give_item' },
            { pattern: /(?:show you|demonstrate|watch this)/i, action: 'demonstrate' },
            { pattern: /(?:attack|fight|defend)/i, action: 'combat_stance' },
            { pattern: /(?:flee|run away|escape)/i, action: 'flee' },
            { pattern: /(?:sit|rest|take a seat)/i, action: 'sit_down' },
        ];

        for (const { pattern, action } of actionPatterns) {
            if (pattern.test(response)) {
                return action;
            }
        }

        return undefined;
    }

    /**
     * Clear conversation history for a character
     */
    clearHistory(characterId: string): void {
        this.conversationHistory.delete(characterId);
    }

    /**
     * Get conversation history for a character
     */
    getHistory(characterId: string): OllamaMessage[] {
        return this.conversationHistory.get(characterId) || [];
    }

    /**
     * Preload a character's conversation history
     */
    async loadHistory(characterId: string): Promise<void> {
        if (this.cache) {
            const cached = await this.cache.get(`npc:history:${characterId}`, 'json');
            if (cached) {
                this.conversationHistory.set(characterId, cached as OllamaMessage[]);
            }
        }
    }

    /**
     * Save conversation history
     */
    async saveHistory(characterId: string): Promise<void> {
        const history = this.conversationHistory.get(characterId);
        if (this.cache && history) {
            await this.cache.put(
                `npc:history:${characterId}`,
                JSON.stringify(history),
                { expirationTtl: 604800 } // 7 days
            );
        }
    }
}

// ============================================================================
// Character Template Generator
// ============================================================================

/**
 * Generate character templates for different contexts
 */
export class CharacterTemplateGenerator {
    /**
     * Generate a StudyLoG.AI tutor character
     */
    static generateTutor(subject: string, teachingStyle: 'friendly' | 'formal' | 'enthusiastic' = 'friendly'): NPCCharacterProfile {
        const stylePrefixes = {
            friendly: ['Hey there!', "Let's explore together", 'Great question!'],
            formal: ['Welcome.', 'Let us examine this.', 'An excellent inquiry.'],
            enthusiastic: ['Wow!', 'This is exciting!', "Let's dive in!"],
        };

        return {
            id: crypto.randomUUID(),
            name: `${subject} Tutor`,
            description: `An AI tutor specializing in ${subject}. Patient, knowledgeable, and eager to help students learn.`,
            personality: [
                teachingStyle === 'enthusiastic' ? 'High energy and excited about learning' : 'Calm and patient',
                `Uses ${teachingStyle} language`,
                'Encourages curiosity and questions',
                'Adapts explanations to student level',
            ],
            backstory: `Created to help students master ${subject} through interactive exploration.`,
            knowledge: [subject, 'teaching methods', 'problem-solving', 'study techniques'],
            relationships: {},
            dialogueStyle: teachingStyle === 'formal' ? 'formal' : 'casual',
            productContext: 'studylog',
            systemPrompt: `You are a helpful tutor specializing in ${subject}. ${teachingStyle === 'enthusiastic' ? 'Be energetic and exciting!' : 'Be patient and clear.'}`,
            model: 'gemma3:1b',
        };
    }

    /**
     * Generate a DMLoG.AI NPC character
     */
    static generateDMLoGNPC(
        role: 'merchant' | 'guard' | 'innkeeper' | 'quest_giver' | 'villager',
        location: string
    ): NPCCharacterProfile {
        const roleConfigs = {
            merchant: {
                personality: ['Business-minded', 'Friendly but focused on profit', 'Knowledgeable about goods'],
                knowledge: ['trade goods', 'prices', 'local economy', 'rumors'],
                style: 'casual' as const,
            },
            guard: {
                personality: ['Dutiful', 'Observant', 'Protective'],
                knowledge: ['local laws', 'security threats', 'people of interest'],
                style: 'formal' as const,
            },
            innkeeper: {
                personality: ['Welcoming', 'Gossipy', 'Hospitable'],
                knowledge: ['travelers', 'local news', 'accommodations', 'food'],
                style: 'casual' as const,
            },
            quest_giver: {
                personality: ['Mysterious', 'Knowledgeable', 'Urgent'],
                knowledge: ['quests', 'dangers', 'rewards', 'secrets'],
                style: 'mystical' as const,
            },
            villager: {
                personality: ['Ordinary', 'Helpful', 'Sometimes fearful'],
                knowledge: ['local area', 'daily life', 'rumors'],
                style: 'casual' as const,
            },
        };

        const config = roleConfigs[role];

        return {
            id: crypto.randomUUID(),
            name: `${role.charAt(0).toUpperCase() + role.slice(1)} of ${location}`,
            description: `A ${role} in ${location}.`,
            personality: config.personality,
            backstory: `Has lived in ${location} for many years.`,
            knowledge: config.knowledge,
            relationships: {},
            dialogueStyle: config.style,
            productContext: 'dmlog',
            systemPrompt: `You are a ${role} in a fantasy world. Stay in character and respond based on your role.`,
            model: 'gemma3:1b',
        };
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an NPC dialogue service
 */
export function createNPCDialogueService(env: Env): NPCDialogueService {
    return new NPCDialogueService(env);
}

/**
 * Create an NPC character manager
 */
export function createNPCCharacterManager(env: Env): NPCCharacterManager {
    return new NPCCharacterManager(env);
}

/**
 * Create an Ollama client
 */
export function createOllamaClient(env: Env): OllamaClient {
    return new OllamaClient({
        endpoint: env.OLLAMA_ENDPOINT || DEFAULT_OLLAMA_ENDPOINT,
        defaultModel: env.OLLAMA_DEFAULT_MODEL,
    });
}
