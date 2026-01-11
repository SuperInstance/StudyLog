/**
 * Midjourney Provider
 * Concept art generation via Discord API/Webhooks
 * Midjourney doesn't have a public API, so we use Discord bot integration
 * Website: https://midjourney.com
 */

import type {
    MidjourneyConfig,
    MidjourneyResponse,
    MidjourneyPrompt,
    GenerateConceptRequest,
    GenerationResponse,
    ConceptMetadata
} from '../types.js';

// Discord API endpoints
const DISCORD_API_BASE = 'https://discord.com/api/v10';

// Midjourney bot IDs
const MIDJOURNEY_BOT_IDS = [
    '936929561302675456', // Midjourney Bot
    '1026342669406986270' // Midjourney (Niji)
] as const;

// Midjourney application commands
const MJ_COMMANDS = {
    IMAGINE: 'imagine',
    DESCRIBE: 'describe',
    BLEND: 'blend',
    REMIX: 'remix',
    VARIATION: 'variation',
    UPSCALE: 'upscale'
} as const;

// Aspect ratio mapping
const ASPECT_RATIO_PARAMS: Record<string, string> = {
    '1:1': '--ar 1:1',
    '16:9': '--ar 16:9',
    '9:16': '--ar 9:16',
    '4:3': '--ar 4:3',
    '3:4': '--ar 3:4',
    '21:9': '--ar 21:9',
    'custom': '--ar'
} as const;

// Version parameters
const VERSION_PARAMS: Record<string, string> = {
    'v1': '--v 1',
    'v2': '--v 2',
    'v3': '--v 3',
    'v4': '--v 4',
    'v5': '--v 5',
    'v6': '--v 6',
    'niji': '--niji'
} as const;

export class MidjourneyProvider {
    private config: Required<Omit<MidjourneyConfig, 'discordBotToken'>> & {
        discordBotToken?: string;
        webhookUrl?: string;
    };
    private pendingGenerations: Map<string, MidjourneyResponse>;
    private messageHandlerBound: ((message: unknown) => void) | null = null;

    constructor(config: MidjourneyConfig) {
        this.config = {
            apiKey: config.apiKey || config.discordBotToken || '',
            endpoint: config.endpoint || DISCORD_API_BASE,
            enabled: config.enabled ?? true,
            priority: config.priority ?? 3,
            discordBotToken: config.discordBotToken,
            guildId: config.guildId || '',
            channelId: config.channelId || '',
            webhookUrl: config.webhookUrl,
            rateLimit: config.rateLimit || { requestsPerMinute: 5, requestsPerDay: 200 }
        };
        this.pendingGenerations = new Map();
    }

    /**
     * Initialize the Discord connection
     */
    async initialize(): Promise<void> {
        if (!this.config.discordBotToken && !this.config.webhookUrl) {
            throw new Error('Either discordBotToken or webhookUrl must be configured');
        }

        // Test the connection
        if (this.config.discordBotToken) {
            await this.testConnection();
        }
    }

    /**
     * Test Discord connection
     */
    private async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${DISCORD_API_BASE}/users/@me`, {
                headers: {
                    'Authorization': `Bot ${this.config.discordBotToken}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Generate concept art via Midjourney
     */
    async generateConcept(request: GenerateConceptRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Midjourney provider not available. Check configuration.',
                requestId,
                provider: 'midjourney'
            };
        }

        try {
            const mjPrompt = this.buildMidjourneyPrompt(request);
            const generationId = crypto.randomUUID();

            // Use webhook if available (faster, simpler)
            if (this.config.webhookUrl) {
                await this.sendViaWebhook(mjPrompt, generationId);
            } else {
                await this.sendViaDiscordAPI(mjPrompt);
            }

            const response: MidjourneyResponse = {
                id: generationId,
                status: 'pending',
                messageUrl: this.config.webhookUrl
            };

            this.pendingGenerations.set(generationId, response);

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/2d/midjourney/status/${generationId}`,
                requestId,
                provider: 'midjourney',
                costUsd: this.estimateCost(request)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Generate multiple iterations
     */
    async generateIterations(request: GenerateConceptRequest & {
        count?: number;
    }): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const count = Math.min(request.count || request.iterations || 4, 10);

        try {
            const mjPrompt = this.buildMidjourneyPrompt(request);
            const generationId = crypto.randomUUID();

            // Add iteration count parameter
            const promptWithIterations = `${mjPrompt} --chaos ${count * 10}`;

            if (this.config.webhookUrl) {
                await this.sendViaWebhook(promptWithIterations, generationId);
            } else {
                await this.sendViaDiscordAPI(promptWithIterations);
            }

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 90,
                pollUrl: `/api/v1/assets/2d/midjourney/status/${generationId}`,
                requestId,
                provider: 'midjourney',
                costUsd: this.estimateIterationsCost(request, count)
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Upscale an image
     */
    async upscale(
        messageId: string,
        index: 1 | 2 | 3 | 4
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const generationId = crypto.randomUUID();

        try {
            const prompt = `Up${index}`;

            if (this.config.webhookUrl) {
                await this.sendViaWebhook(prompt, generationId, messageId);
            }

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 30,
                requestId,
                provider: 'midjourney',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Create variations of an image
     */
    async variations(messageId: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const generationId = crypto.randomUUID();

        try {
            if (this.config.webhookUrl) {
                await this.sendViaWebhook('V', generationId, messageId);
            }

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 60,
                requestId,
                provider: 'midjourney',
                costUsd: 0.03
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Blend multiple images
     */
    async blend(imageUrls: string[], dimensions?: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const generationId = crypto.randomUUID();

        if (imageUrls.length < 2 || imageUrls.length > 5) {
            return {
                success: false,
                error: 'Blend requires 2-5 images',
                requestId,
                provider: 'midjourney'
            };
        }

        try {
            // Blend is done via Discord attachments
            let prompt = '/blend';
            if (dimensions) {
                prompt += ` ${dimensions}`;
            }

            if (this.config.webhookUrl) {
                // For blend, we'd need to send images as attachments
                await this.sendViaWebhook(prompt, generationId);
            }

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 60,
                requestId,
                provider: 'midjourney',
                costUsd: 0.02
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Describe an image (get prompt from image)
     */
    async describe(imageUrl: string): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const generationId = crypto.randomUUID();

        try {
            const prompt = `/describe ${imageUrl}`;

            if (this.config.webhookUrl) {
                await this.sendViaWebhook(prompt, generationId);
            }

            return {
                success: true,
                assetId: generationId,
                status: 'pending',
                estimatedTimeSeconds: 30,
                requestId,
                provider: 'midjourney',
                costUsd: 0.01
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId,
                provider: 'midjourney'
            };
        }
    }

    /**
     * Get generation status
     */
    getGenerationStatus(generationId: string): MidjourneyResponse {
        return this.pendingGenerations.get(generationId) || {
            id: generationId,
            status: 'unknown'
        };
    }

    /**
     * Handle webhook response from Discord
     */
    handleWebhookResponse(data: {
        messageId: string;
        imageUrl: string;
        generationId?: string;
    }): void {
        const generationId = data.generationId;
        if (!generationId) return;

        const existing = this.pendingGenerations.get(generationId);
        if (existing) {
            existing.status = 'complete';
            existing.imageUrl = data.imageUrl;
            existing.messageUrl = `https://discord.com/channels/${this.config.guildId}/${this.config.channelId}/${data.messageId}`;
        }
    }

    /**
     * Parse Discord message for image URLs
     */
    parseDiscordMessage(message: {
        content?: string;
        attachments?: Array<{ url: string; proxy_url: string }>;
        embeds?: Array<{ image?: { url: string } }>;
    }): { imageUrl?: string; prompt?: string; status: string } {
        // Extract image URL from attachments or embeds
        let imageUrl = message.attachments?.[0]?.url || message.embeds?.[0]?.image?.url;
        const status = imageUrl ? 'complete' : 'pending';

        // Parse the prompt from message content
        let prompt: string | undefined;
        if (message.content) {
            const match = message.content.match(/\*\*(.+?)\*\*/);
            if (match) {
                prompt = match[1];
            }
        }

        return { imageUrl, prompt, status };
    }

    /**
     * Download generated image
     */
    async downloadImage(generationId: string): Promise<Blob | null> {
        const status = this.getGenerationStatus(generationId);
        if (status.status !== 'complete' || !status.imageUrl) {
            return null;
        }

        const response = await fetch(status.imageUrl);
        if (!response.ok) {
            return null;
        }

        return response.blob();
    }

    /**
     * Extract metadata from generation
     */
    async extractMetadata(generationId: string): Promise<ConceptMetadata> {
        const status = this.getGenerationStatus(generationId);

        return {
            format: 'png',
            width: 1024,
            height: 1024,
            aspectRatio: '1:1',
            style: 'midjourney',
            fileSizeBytes: 0,
            previewUrl: status.imageUrl
        };
    }

    /**
     * Check if provider is available
     */
    isAvailable(): boolean {
        return this.config.enabled &&
               (!!this.config.discordBotToken || !!this.config.webhookUrl);
    }

    // Private helper methods

    private buildMidjourneyPrompt(request: GenerateConceptRequest): string {
        let prompt = request.prompt;

        // Add style parameter
        if (request.style) {
            prompt += ` ${request.style} style`;
        }

        // Add mood parameter
        if (request.mood) {
            prompt += `, ${request.mood} mood`;
        }

        // Add aspect ratio
        const arParam = ASPECT_RATIO_PARAMS[request.aspectRatio || '16:9'];
        if (arParam) {
            prompt += ` ${arParam}`;
        }

        // Add quality parameter
        if (request.quality === 'high' || request.quality === 'ultra') {
            prompt += ' --quality 2';
        }

        // Add stylize if specified
        prompt += ' --stylize 250';

        // Add no negative prompt
        if (request.negativePrompt) {
            prompt += ` --no ${request.negativePrompt}`;
        }

        return prompt;
    }

    private async sendViaWebhook(
        prompt: string,
        generationId: string,
        replyToMessageId?: string
    ): Promise<void> {
        if (!this.config.webhookUrl) {
            throw new Error('Webhook URL not configured');
        }

        const payload: Record<string, unknown> = {
            content: prompt
        };

        if (replyToMessageId) {
            payload.message_reference = {
                message_id: replyToMessageId,
                guild_id: this.config.guildId,
                channel_id: this.config.channelId
            };
        }

        const response = await fetch(this.config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Webhook request failed: ${response.status}`);
        }
    }

    private async sendViaDiscordAPI(prompt: string): Promise<void> {
        if (!this.config.discordBotToken || !this.config.channelId) {
            throw new Error('Discord bot token and channel ID required');
        }

        // First, get the application command
        const commandsResponse = await fetch(
            `${DISCORD_API_BASE}/applications/${MIDJOURNEY_BOT_IDS[0]}/commands`,
            {
                headers: {
                    'Authorization': `Bot ${this.config.discordBotToken}`
                }
            }
        );

        if (!commandsResponse.ok) {
            throw new Error('Failed to get application commands');
        }

        const commands = await commandsResponse.json();
        const imagineCommand = commands.find((c: { name: string }) => c.name === MJ_COMMANDS.IMAGINE);

        if (!imagineCommand) {
            throw new Error('Imagine command not found');
        }

        // Send the interaction
        const interactionResponse = await fetch(
            `${DISCORD_API_BASE}/interactions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${this.config.discordBotToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 2, // APPLICATION_COMMAND
                    application_id: MIDJOURNEY_BOT_IDS[0],
                    guild_id: this.config.guildId,
                    channel_id: this.config.channelId,
                    session_id: crypto.randomUUID(),
                    data: {
                        version: imagineCommand.version,
                        id: imagineCommand.id,
                        name: MJ_COMMANDS.IMAGINE,
                        type: 1,
                        options: [
                            {
                                type: 3,
                                name: 'prompt',
                                value: prompt
                            }
                        ]
                    }
                })
            }
        );

        if (!interactionResponse.ok) {
            throw new Error(`Interaction failed: ${interactionResponse.status}`);
        }
    }

    private estimateCost(request: GenerateConceptRequest): number {
        const baseCost = 0.03;
        const qualityMultiplier = request.quality === 'ultra' ? 1.5 : request.quality === 'high' ? 1.2 : 1;
        return Math.round(baseCost * qualityMultiplier * 1000) / 1000;
    }

    private estimateIterationsCost(request: GenerateConceptRequest, count: number): number {
        const baseCost = this.estimateCost(request);
        return Math.round(baseCost * count * 1000) / 1000;
    }
}

export function createMidjourneyProvider(config: MidjourneyConfig): MidjourneyProvider {
    return new MidjourneyProvider(config);
}
