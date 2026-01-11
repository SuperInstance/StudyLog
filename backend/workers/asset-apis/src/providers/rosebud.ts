/**
 * Rosebud AI (PixelVibe) Provider Integration
 * UGC game assets, closed beta
 *
 * API Docs: https://docs.rosebud.ai
 */

import {
    RosebudConfig,
    RosebudResponse,
    Generate3DRequest,
    Generate2DRequest,
    GenerationResponse,
    Model3DMetadata,
    Art2DMetadata
} from '../types.js';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_ENDPOINT = 'https://api.rosebud.ai/v1';

const ROSEBUD_ASSET_TYPES = [
    'sprite',
    'character',
    'prop',
    'background',
    'tileset',
    'ui_element',
    'effect',
    'music',
    'sound_effect'
] as const;

const ROSEBUD_STYLES = [
    'pixel_art',
    '16_bit',
    '32_bit',
    'hand_painted',
    'low_poly',
    'vector',
    'anime',
    'cartoon',
    'realistic'
] as const;

// ============================================================================
// Rosebud AI Provider Class
// ============================================================================

export class RosebudProvider {
    private config: RosebudConfig;
    private rateLimitRemaining: number;
    private rateLimitResetAt: number;

    constructor(config: RosebudConfig) {
        this.config = {
            ...config,
            endpoint: config.endpoint || DEFAULT_ENDPOINT
        };
        this.rateLimitRemaining = 20;
        this.rateLimitResetAt = Date.now() + 60000;
    }

    // ========================================================================
    // Rate Limiting
    // ========================================================================

    private async checkRateLimit(): Promise<void> {
        if (Date.now() > this.rateLimitResetAt) {
            this.rateLimitRemaining = 20;
            this.rateLimitResetAt = Date.now() + 60000;
        }

        if (this.rateLimitRemaining <= 0) {
            const waitMs = this.rateLimitResetAt - Date.now();
            throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitMs / 1000)} seconds.`);
        }

        this.rateLimitRemaining--;
    }

    // ========================================================================
    // API Requests
    // ========================================================================

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        await this.checkRateLimit();

        const url = `${this.config.endpoint}${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Rosebud API error: ${response.status} - ${error}`);
        }

        return response.json() as Promise<T>;
    }

    // ========================================================================
    // 2D Asset Generation
    // ========================================================================

    /**
     * Generate a 2D game asset
     */
    async generate2D(request: Generate2DRequest & Rosebud2DParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();
        const validation = this.validate2DRequest(request);

        if (!validation.valid) {
            return {
                success: false,
                error: validation.errors.join(', '),
                requestId
            };
        }

        try {
            const response = await this.request<RosebudResponse>('/2d/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    asset_type: request.assetType || 'sprite',
                    style: request.style || 'pixel_art',
                    width: request.width || 512,
                    height: request.height || 512,
                    is_sprite_sheet: request.isSpriteSheet || false,
                    sprite_columns: request.spriteColumns,
                    sprite_rows: request.spriteRows,
                    transparent_background: request.alphaChannel !== false,
                    num_variations: request.numImages || 1
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: response.status === 'completed' ? 'completed' : 'processing',
                estimatedTimeSeconds: 45,
                pollUrl: response.status !== 'completed' ? `/api/v1/assets/2d/status/${response.id}` : undefined,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate a sprite sheet
     */
    async generateSpriteSheet(request: Generate2DRequest & RosebudSpriteSheetParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/spritesheet/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    style: request.style || 'pixel_art',
                    width: request.width || 512,
                    height: request.height || 512,
                    columns: request.columns || 4,
                    rows: request.rows || 4,
                    frames_per_second: request.framesPerSecond || 12,
                    animation_description: request.animationDescription || 'idle animation',
                    transparent_background: true
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 90,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate a character sprite
     */
    async generateCharacterSprite(
        request: RosebudCharacterParams
    ): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/character/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.description || 'A game character',
                    style: request.style || 'pixel_art',
                    character_type: request.characterType || 'humanoid',
                    perspective: request.perspective || 'side',
                    include_animations: request.includeAnimations || false,
                    animations: request.animations || ['idle', 'walk', 'run'],
                    base_color: request.baseColor,
                    size: request.size || 'medium'
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: request.includeAnimations ? 180 : 60,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate a tileset
     */
    async generateTileset(request: RosebudTilesetParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/tileset/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    style: request.style || 'pixel_art',
                    tile_size: request.tileSize || 32,
                    tiles_wide: request.tilesWide || 8,
                    tiles_high: request.tilesHigh || 8,
                    theme: request.theme || 'grassland',
                    include_transitions: request.includeTransitions || true,
                    include_decorations: request.includeDecorations || true,
                    seamless: request.seamless !== false
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 120,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // 3D Asset Generation
    // ========================================================================

    /**
     * Generate a 3D asset (Rosebud focuses on 2D but has some 3D support)
     */
    async generate3D(request: Generate3DRequest): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/3d/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    negative_prompt: request.negativePrompt,
                    style: request.style || 'low_poly',
                    output_format: 'glb'
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 120,
                pollUrl: `/api/v1/assets/3d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // UI Elements
    // ========================================================================

    /**
     * Generate UI elements (buttons, panels, icons, etc.)
     */
    async generateUI(request: RosebudUIParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/ui/generate', {
                method: 'POST',
                body: JSON.stringify({
                    element_type: request.elementType,
                    prompt: request.prompt || `A ${request.elementType} for a game UI`,
                    style: request.style || 'pixel_art',
                    color_scheme: request.colorScheme || 'default',
                    size: request.size || 'medium',
                    include_hover_state: request.includeHoverState !== false,
                    include_pressed_state: request.includePressedState !== false,
                    include_disabled_state: request.includeDisabledState || false
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 30,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    /**
     * Generate an icon set
     */
    async generateIconSet(request: RosebudIconSetParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/icons/generate', {
                method: 'POST',
                body: JSON.stringify({
                    icons: request.icons,
                    style: request.style || 'pixel_art',
                    size: request.iconSize || 32,
                    color: request.color || 'white',
                    background_color: request.backgroundColor || 'transparent'
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 60,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // Backgrounds and Environments
    // ========================================================================

    /**
     * Generate a game background
     */
    async generateBackground(request: RosebudBackgroundParams): Promise<GenerationResponse> {
        const requestId = crypto.randomUUID();

        try {
            const response = await this.request<RosebudResponse>('/background/generate', {
                method: 'POST',
                body: JSON.stringify({
                    prompt: request.prompt,
                    style: request.style || 'pixel_art',
                    type: request.type || 'side_scrolling',
                    width: request.width || 1920,
                    height: request.height || 1080,
                    parallax_layers: request.parallaxLayers || 1,
                    seamless: request.seamless !== false,
                    color_palette: request.colorPalette
                })
            });

            return {
                success: true,
                assetId: response.id,
                status: 'processing',
                estimatedTimeSeconds: 90,
                pollUrl: `/api/v1/assets/2d/status/${response.id}`,
                requestId
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId
            };
        }
    }

    // ========================================================================
    // Task Status
    // ========================================================================

    /**
     * Check the status of a generation task
     */
    async getTaskStatus(taskId: string): Promise<RosebudResponse> {
        return this.request<RosebudResponse>(`/task/${taskId}`);
    }

    /**
     * Wait for task completion
     */
    async waitForTask(
        taskId: string,
        timeoutMs: number = 300000
    ): Promise<RosebudResponse> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const status = await this.getTaskStatus(taskId);

            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error('Task timeout');
    }

    // ========================================================================
    // Download
    // ========================================================================

    /**
     * Download generated asset
     */
    async downloadAsset(taskId: string, assetType: 'png' | 'glb' = 'png'): Promise<Blob> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        let url = '';
        if (assetType === 'png' && status.assets?.png) {
            url = status.assets.png;
        } else if (assetType === 'glb' && status.assets?.glb) {
            url = status.assets.glb;
        } else if (status.assets?.sprite_sheet) {
            url = status.assets.sprite_sheet;
        } else {
            throw new Error(`No ${assetType} asset available`);
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download asset: ${response.status}`);
        }

        return response.blob();
    }

    // ========================================================================
    // Metadata Extraction
    // ========================================================================

    /**
     * Extract 2D metadata
     */
    async extract2DMetadata(taskId: string): Promise<Art2DMetadata> {
        const status = await this.getTaskStatus(taskId);

        if (status.status !== 'completed') {
            throw new Error(`Task not completed. Status: ${status.status}`);
        }

        return {
            format: 'png',
            width: 512,
            height: 512,
            isSpriteSheet: false,
            spriteColumns: undefined,
            spriteRows: undefined,
            framesPerSecond: undefined,
            styleModelId: undefined,
            alphaChannel: true,
            fileSizeBytes: 0,
            colorPalette: undefined,
            godotImportType: 'Texture2D'
        };
    }

    // ========================================================================
    // Validation
    // ========================================================================

    /**
     * Validate 2D request
     */
    validate2DRequest(request: Generate2DRequest & Partial<Rosebud2DParams>): {
        valid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!request.prompt || request.prompt.length < 10) {
            errors.push('Prompt must be at least 10 characters');
        }

        if (request.prompt && request.prompt.length > 500) {
            errors.push('Prompt must not exceed 500 characters');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Estimate cost
     */
    estimateCost(request: Generate2DRequest | Generate3DRequest): number {
        if ('isSpriteSheet' in request || 'spriteColumns' in request) {
            return 0.10; // Sprite sheets cost more
        }
        return 0.05; // Standard asset
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface Rosebud2DParams {
    assetType?: typeof ROSEBUD_ASSET_TYPES[number];
    style?: typeof ROSEBUD_STYLES[number];
    isSpriteSheet?: boolean;
    spriteColumns?: number;
    spriteRows?: number;
}

export interface RosebudSpriteSheetParams {
    prompt: string;
    negativePrompt?: string;
    style?: string;
    width?: number;
    height?: number;
    columns?: number;
    rows?: number;
    framesPerSecond?: number;
    animationDescription?: string;
    alphaChannel?: boolean;
}

export interface RosebudCharacterParams {
    description: string;
    style?: string;
    characterType?: 'humanoid' | 'creature' | 'robot' | 'fantasy';
    perspective?: 'side' | 'front' | 'top_down' | 'isometric';
    includeAnimations?: boolean;
    animations?: string[];
    baseColor?: string;
    size?: 'small' | 'medium' | 'large';
}

export interface RosebudTilesetParams {
    prompt: string;
    style?: string;
    tileSize?: 16 | 32 | 64 | 128;
    tilesWide?: number;
    tilesHigh?: number;
    theme?: string;
    includeTransitions?: boolean;
    includeDecorations?: boolean;
    seamless?: boolean;
}

export interface RosebudUIParams {
    elementType: 'button' | 'panel' | 'window' | 'slider' | 'checkbox' | 'dropdown';
    prompt?: string;
    style?: string;
    colorScheme?: string;
    size?: 'small' | 'medium' | 'large';
    includeHoverState?: boolean;
    includePressedState?: boolean;
    includeDisabledState?: boolean;
}

export interface RosebudIconSetParams {
    icons: string[];
    style?: string;
    iconSize?: 16 | 24 | 32 | 48 | 64;
    color?: string;
    backgroundColor?: string;
}

export interface RosebudBackgroundParams {
    prompt: string;
    style?: string;
    type?: 'side_scrolling' | 'top_down' | 'parallax' | 'static';
    width?: number;
    height?: number;
    parallaxLayers?: number;
    seamless?: boolean;
    colorPalette?: string[];
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRosebudProvider(config: RosebudConfig): RosebudProvider {
    return new RosebudProvider(config);
}

// ============================================================================
// Exports
// ============================================================================

export { ROSEBUD_ASSET_TYPES, ROSEBUD_STYLES };
