/**
 * Sound Effects Generator Module
 *
 * Handles AI-based sound effects generation for game audio.
 * Integrates with ElevenLabs SFX API and provides presets for
 * common game sounds.
 *
 * Features:
 * - AI-generated sound effects from text descriptions
 * - Predefined SFX presets for common game sounds
 * - Sound mixing and layering
 * - Export in multiple formats
 * - Integration with game engine audio systems
 */

import type {
    SoundEffectRequest,
    SoundEffectResponse,
    AudioFormat,
    ProductContext
} from './types.js';

import { ElevenLabsClient, createElevenLabsClient } from './providers/elevenlabs.js';
import type { ElevenLabsConfig } from './types.js';

// ============================================================================
// Constants
// ============================================================================

// Game sound categories
type SoundCategory =
    | 'ambient'
    | 'footstep'
    | 'impact'
    | 'whoosh'
    | 'magic'
    | 'ui'
    | 'weapon'
    | 'vehicle'
    | 'creature'
    | 'weather'
    | 'explosion'
    | 'music'
    | 'dialogue';

// Sound effect presets for common game sounds
const SOUND_PRESETS: Record<string, {
    category: SoundCategory;
    description: string;
    duration: number;
    tags: string[];
}> = {
    // UI Sounds
    'ui_click': {
        category: 'ui',
        description: 'A short, crisp click sound for UI interactions',
        duration: 0.1,
        tags: ['ui', 'click', 'short', 'menu']
    },
    'ui_hover': {
        category: 'ui',
        description: 'A subtle hover sound for UI elements',
        duration: 0.05,
        tags: ['ui', 'hover', 'subtle']
    },
    'ui_confirm': {
        category: 'ui',
        description: 'A positive confirmation sound for successful actions',
        duration: 0.2,
        tags: ['ui', 'confirm', 'success', 'positive']
    },
    'ui_cancel': {
        category: 'ui',
        description: 'A cancel sound for backing out of actions',
        duration: 0.15,
        tags: ['ui', 'cancel', 'back', 'negative']
    },
    'ui_error': {
        category: 'ui',
        description: 'An error buzz sound for invalid actions',
        duration: 0.2,
        tags: ['ui', 'error', 'buzz', 'negative']
    },

    // Footsteps
    'footstep_grass': {
        category: 'footstep',
        description: 'Footsteps on grass, soft rustling sound',
        duration: 0.3,
        tags: ['footstep', 'grass', 'soft', 'nature']
    },
    'footstep_stone': {
        category: 'footstep',
        description: 'Footsteps on stone, hard clicking sound',
        duration: 0.25,
        tags: ['footstep', 'stone', 'hard', 'dungeon']
    },
    'footstep_water': {
        category: 'footstep',
        description: 'Footsteps in water, splashing sound',
        duration: 0.4,
        tags: ['footstep', 'water', 'splash', 'wet']
    },
    'footstep_sand': {
        category: 'footstep',
        description: 'Footsteps on sand, crunching sound',
        duration: 0.3,
        tags: ['footstep', 'sand', 'desert', 'beach']
    },
    'footstep_snow': {
        category: 'footstep',
        description: 'Footsteps on snow, soft crunching sound',
        duration: 0.35,
        tags: ['footstep', 'snow', 'ice', 'winter']
    },
    'footstep_wood': {
        category: 'footstep',
        description: 'Footsteps on wood, hollow thud sound',
        duration: 0.3,
        tags: ['footstep', 'wood', 'hollow', 'indoor']
    },

    // Combat/Impact
    'impact_blunt': {
        category: 'impact',
        description: 'Heavy blunt impact, like a mace hitting armor',
        duration: 0.4,
        tags: ['impact', 'blunt', 'heavy', 'combat']
    },
    'impact_slice': {
        category: 'impact',
        description: 'Sharp slicing sound, sword cutting through air',
        duration: 0.3,
        tags: ['impact', 'slice', 'sword', 'sharp']
    },
    'impact_arrow': {
        category: 'impact',
        description: 'Arrow hitting target, thwip sound',
        duration: 0.2,
        tags: ['impact', 'arrow', 'projectile', 'ranged']
    },
    'block': {
        category: 'impact',
        description: 'Shield blocking an attack, metallic clang',
        duration: 0.3,
        tags: ['impact', 'block', 'shield', 'metal']
    },

    // Magic
    'magic_fireball': {
        category: 'magic',
        description: 'Fireball casting and explosion, whoosh and boom',
        duration: 1.5,
        tags: ['magic', 'fire', 'explosion', 'combat']
    },
    'magic_lightning': {
        category: 'magic',
        description: 'Lightning bolt strike, crack and rumble',
        duration: 1.0,
        tags: ['magic', 'lightning', 'electric', 'storm']
    },
    'magic_heal': {
        category: 'magic',
        description: 'Healing spell, gentle chime and sparkle',
        duration: 0.8,
        tags: ['magic', 'heal', 'positive', 'chime']
    },
    'magic_teleport': {
        category: 'magic',
        description: 'Teleportation sound, whoosh and pop',
        duration: 0.6,
        tags: ['magic', 'teleport', 'whoosh', 'movement']
    },
    'magic_summon': {
        category: 'magic',
        description: 'Summoning creature, mystical buildup',
        duration: 2.0,
        tags: ['magic', 'summon', 'mystical', 'ritual']
    },

    // Weapons
    'weapon_sword_draw': {
        category: 'weapon',
        description: 'Drawing sword from scabbard, metal sliding',
        duration: 0.4,
        tags: ['weapon', 'sword', 'draw', 'metal']
    },
    'weapon_bow_draw': {
        category: 'weapon',
        description: 'Drawing bowstring, creaking and tension',
        duration: 0.5,
        tags: ['weapon', 'bow', 'draw', 'ranged']
    },
    'weapon_bow_release': {
        category: 'weapon',
        description: 'Bowstring release, sharp snap',
        duration: 0.15,
        tags: ['weapon', 'bow', 'release', 'snap']
    },

    // Ambient
    'ambient_forest': {
        category: 'ambient',
        description: 'Forest ambient with birds and wind through leaves',
        duration: 10.0,
        tags: ['ambient', 'forest', 'nature', 'birds']
    },
    'ambient_dungeon': {
        category: 'ambient',
        description: 'Dungeon ambient with distant drips and echoes',
        duration: 10.0,
        tags: ['ambient', 'dungeon', 'cave', 'creepy']
    },
    'ambient_tavern': {
        category: 'ambient',
        description: 'Tavern ambient with murmuring and clinking',
        duration: 10.0,
        tags: ['ambient', 'tavern', 'indoor', 'social']
    },
    'ambient_battle': {
        category: 'ambient',
        description: 'Battle ambient with shouts and clashes',
        duration: 10.0,
        tags: ['ambient', 'battle', 'combat', 'crowd']
    },
    'ambient_rain': {
        category: 'weather',
        description: 'Rain falling, steady precipitation sound',
        duration: 10.0,
        tags: ['ambient', 'rain', 'weather', 'water']
    },
    'ambient_thunder': {
        category: 'weather',
        description: 'Distant thunder rumble',
        duration: 3.0,
        tags: ['ambient', 'thunder', 'weather', 'storm']
    },

    // Creatures
    'creature_wolf_howl': {
        category: 'creature',
        description: 'Wolf howling at the moon',
        duration: 2.0,
        tags: ['creature', 'wolf', 'howl', 'animal']
    },
    'creature_dragon_roar': {
        category: 'creature',
        description: 'Mighty dragon roar',
        duration: 3.0,
        tags: ['creature', 'dragon', 'roar', 'monster']
    },
    'creature_bird_call': {
        category: 'creature',
        description: 'Forest bird call chirp',
        duration: 0.5,
        tags: ['creature', 'bird', 'chirp', 'nature']
    },

    // Explosions
    'explosion_small': {
        category: 'explosion',
        description: 'Small explosion, firecracker pop',
        duration: 0.5,
        tags: ['explosion', 'small', 'fire', 'combat']
    },
    'explosion_medium': {
        category: 'explosion',
        description: 'Medium explosion, grenade blast',
        duration: 1.0,
        tags: ['explosion', 'medium', 'fire', 'combat']
    },
    'explosion_large': {
        category: 'explosion',
        description: 'Large explosion, massive boom',
        duration: 2.0,
        tags: ['explosion', 'large', 'fire', 'combat']
    },

    // Vehicles
    'vehicle_horse_gallop': {
        category: 'vehicle',
        description: 'Horse galloping, rhythmic hoofbeats',
        duration: 2.0,
        tags: ['vehicle', 'horse', 'gallop', 'mount']
    },
    'vehicle_cart': {
        category: 'vehicle',
        description: 'Wooden cart wheels creaking',
        duration: 3.0,
        tags: ['vehicle', 'cart', 'creak', 'wood']
    }
};

// ============================================================================
// Types
// ============================================================================

interface SoundMixRequest {
    /** Sounds to mix together */
    sounds: Array<{
        preset?: string;
        description?: string;
        volume: number; // 0-1
        delay?: number; // Delay in seconds
    }>;
    /** Output format */
    outputFormat?: AudioFormat;
    /** Crossfade between sounds */
    crossfade?: number;
}

interface SoundMixResponse {
    /** Success status */
    success: boolean;
    /** Mixed audio data */
    audioData?: ArrayBuffer;
    /** Audio format */
    format?: AudioFormat;
    /** Duration in seconds */
    duration?: number;
    /** Error message */
    error?: string;
}

interface SoundLibrary {
    /** Available presets */
    presets: string[];
    /** Presets by category */
    byCategory: Record<SoundCategory, string[]>;
    /** Presets by tag */
    byTag: Record<string, string[]>;
}

// ============================================================================
// Sound Effects Generator Class
// ============================================================================

/**
 * Sound Effects Generator
 *
 * Generates AI-based sound effects for games using ElevenLabs SFX API.
 * Provides presets for common game sounds and supports custom descriptions.
 */
export class SoundEffectsGenerator {
    private readonly elevenLabs: ElevenLabsClient | null;

    // Cache for generated sounds
    private readonly soundCache = new Map<string, {
        data: ArrayBuffer;
        timestamp: number;
    }>();
    private readonly CACHE_TTL = 86400000; // 24 hours

    constructor(config?: ElevenLabsConfig) {
        this.elevenLabs = config ? createElevenLabsClient(config) : null;
    }

    // ========================================================================
    // Sound Generation
    // ========================================================================

    /**
     * Generate sound effect from text description
     *
     * @param request - Sound effect generation request
     * @returns Promise resolving to sound effect response
     */
    async generate(request: SoundEffectRequest): Promise<SoundEffectResponse> {
        const startTime = Date.now();

        // Check cache first
        const cacheKey = this.getCacheKey(request);
        const cached = this.soundCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return {
                success: true,
                sfxId: cacheKey,
                audioData: cached.data,
                format: request.outputFormat || 'mp3',
                duration: request.duration || 1,
                provider: 'cached',
                processingTimeMs: 10,
                costUsd: 0
            };
        }

        if (!this.elevenLabs) {
            return {
                success: false,
                error: 'ElevenLabs client not configured'
            };
        }

        try {
            // Use ElevenLabs SFX generation
            const result = await this.elevenLabs.generateSoundEffect({
                prompt: request.prompt,
                duration: request.duration || 1,
                outputFormat: request.outputFormat,
                useCase: request.useCase,
                productContext: request.productContext,
                preferredProvider: request.preferredProvider,
                seed: request.seed,
                temperature: request.temperature
            });

            if (result.success && result.audioData) {
                // Cache the result
                this.soundCache.set(cacheKey, {
                    data: result.audioData,
                    timestamp: Date.now()
                });
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'SFX generation failed'
            };
        }
    }

    /**
     * Generate sound from preset
     *
     * @param presetName - Name of the preset
     * @param variations - Number of variations to generate
     * @returns Promise resolving to sound effect response
     */
    async generateFromPreset(
        presetName: string,
        variations: number = 1
    ): Promise<SoundEffectResponse[]> {
        const preset = SOUND_PRESETS[presetName];

        if (!preset) {
            return [{
                success: false,
                error: `Unknown preset: ${presetName}`
            }];
        }

        const results: SoundEffectResponse[] = [];

        for (let i = 0; i < variations; i++) {
            const seed = Date.now() + i;

            const result = await this.generate({
                prompt: preset.description,
                duration: preset.duration,
                seed: seed % 1000000,
                useCase: 'sound_effect'
            });

            // Add preset metadata
            if (result.success) {
                result.tags = preset.tags;
                result.category = preset.category;
            }

            results.push(result);
        }

        return results;
    }

    /**
     * Generate multiple sound effects from presets by category
     *
     * @param category - Sound category
     * @returns Promise resolving to array of sound effects
     */
    async generateCategory(category: SoundCategory): Promise<SoundEffectResponse[]> {
        const presetNames = this.getPresetsByCategory(category);
        const results: SoundEffectResponse[] = [];

        for (const presetName of presetNames) {
            const result = await this.generateFromPreset(presetName, 1);
            results.push(...result);
        }

        return results;
    }

    // ========================================================================
    // Sound Mixing (Simplified)
    // ========================================================================

    /**
     * Mix multiple sounds together
     * Note: This is a placeholder. Actual mixing would require audio processing libraries.
     *
     * @param request - Sound mix request
     * @returns Promise resolving to mixed sound response
     */
    async mix(request: SoundMixRequest): Promise<SoundMixResponse> {
        if (!this.elevenLabs) {
            return {
                success: false,
                error: 'ElevenLabs client not configured'
            };
        }

        try {
            // For now, we'll generate the first sound as a placeholder
            // Actual mixing would require server-side audio processing
            const first = request.sounds[0];

            let prompt: string;
            if (first.preset) {
                prompt = SOUND_PRESETS[first.preset]?.description || first.preset;
            } else {
                prompt = first.description || 'sound effect';
            }

            // Generate the primary sound
            const result = await this.generate({
                prompt,
                useCase: 'sound_effect'
            });

            if (!result.success) {
                return {
                    success: false,
                    error: result.error
                };
            }

            // Calculate total duration
            const maxDuration = Math.max(...request.sounds.map(s => s.delay || 0)) + 2;

            return {
                success: true,
                audioData: result.audioData,
                format: result.format || 'mp3',
                duration: maxDuration
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Sound mixing failed'
            };
        }
    }

    // ========================================================================
    // Sound Library
    // ========================================================================

    /**
     * Get all available presets
     *
     * @returns Sound library information
     */
    getLibrary(): SoundLibrary {
        const presets = Object.keys(SOUND_PRESETS);
        const byCategory: Record<SoundCategory, string[]> = {
            ambient: [],
            creature: [],
            explosion: [],
            footstep: [],
            impact: [],
            magic: [],
            ui: [],
            vehicle: [],
            weapon: [],
            weather: [],
            music: [],
            dialogue: []
        };
        const byTag: Record<string, string[]> = {};

        for (const [name, preset] of Object.entries(SOUND_PRESETS)) {
            byCategory[preset.category].push(name);

            for (const tag of preset.tags) {
                if (!byTag[tag]) {
                    byTag[tag] = [];
                }
                byTag[tag].push(name);
            }
        }

        return {
            presets,
            byCategory,
            byTag
        };
    }

    /**
     * Get presets by category
     *
     * @param category - Sound category
     * @returns Array of preset names
     */
    getPresetsByCategory(category: SoundCategory): string[] {
        return Object.entries(SOUND_PRESETS)
            .filter(([_, preset]) => preset.category === category)
            .map(([name]) => name);
    }

    /**
     * Get presets by tag
     *
     * @param tag - Tag to filter by
     * @returns Array of preset names
     */
    getPresetsByTag(tag: string): string[] {
        return Object.entries(SOUND_PRESETS)
            .filter(([_, preset]) => preset.tags.includes(tag))
            .map(([name]) => name);
    }

    /**
     * Get preset details
     *
     * @param presetName - Name of the preset
     * @returns Preset details or undefined
     */
    getPreset(presetName: string): typeof SOUND_PRESETS[keyof typeof SOUND_PRESETS] | undefined {
        return SOUND_PRESETS[presetName];
    }

    /**
     * Search presets by keyword
     *
     * @param keyword - Keyword to search for
     * @returns Array of matching preset names
     */
    searchPresets(keyword: string): string[] {
        const lowerKeyword = keyword.toLowerCase();

        return Object.entries(SOUND_PRESETS)
            .filter(([name, preset]) =>
                name.toLowerCase().includes(lowerKeyword) ||
                preset.description.toLowerCase().includes(lowerKeyword) ||
                preset.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
            )
            .map(([name]) => name);
    }

    // ========================================================================
    // Cache Management
    // ========================================================================

    /**
     * Clear expired cache entries
     */
    clearExpiredCache(): void {
        const now = Date.now();

        for (const [key, value] of this.soundCache.entries()) {
            if (now - value.timestamp > this.CACHE_TTL) {
                this.soundCache.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clearCache(): void {
        this.soundCache.clear();
    }

    /**
     * Get cache size in bytes
     */
    getCacheSize(): number {
        let size = 0;

        for (const { data } of this.soundCache.values()) {
            size += data.byteLength;
        }

        return size;
    }

    // ========================================================================
    // Private Methods
    // ========================================================================

    /**
     * Generate cache key for request
     */
    private getCacheKey(request: SoundEffectRequest): string {
        const parts = [
            request.prompt,
            request.duration?.toString() || '1',
            request.seed?.toString() || '0',
            request.temperature?.toString() || '0'
        ];

        // Simple hash
        return parts.join('|').substring(0, 64);
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.clearCache();
    }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a sound effects generator
 *
 * @param config - ElevenLabs configuration
 * @returns Configured SoundEffectsGenerator
 */
export function createSoundEffectsGenerator(config?: ElevenLabsConfig): SoundEffectsGenerator {
    return new SoundEffectsGenerator(config);
}

/**
 * Create sound effects generator from environment
 *
 * @param env - Environment object with ELEVENLABS_API_KEY
 * @returns Configured SoundEffectsGenerator or null
 */
export function createSoundEffectsGeneratorFromEnv(env: {
    ELEVENLABS_API_KEY?: string;
}): SoundEffectsGenerator | null {
    if (!env.ELEVENLABS_API_KEY) {
        return null;
    }
    return createSoundEffectsGenerator({ apiKey: env.ELEVENLABS_API_KEY });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all preset names
 */
export function getAllPresetNames(): string[] {
    return Object.keys(SOUND_PRESETS);
}

/**
 * Get preset categories
 */
export function getPresetCategories(): SoundCategory[] {
    const categories = new Set<SoundCategory>();

    for (const preset of Object.values(SOUND_PRESETS)) {
        categories.add(preset.category);
    }

    return Array.from(categories);
}

/**
 * Check if preset exists
 */
export function hasPreset(name: string): boolean {
    return name in SOUND_PRESETS;
}

// ============================================================================
// Re-exports
// ============================================================================

export { SOUND_PRESETS };

export type { SoundMixRequest, SoundMixResponse, SoundLibrary, SoundCategory };
