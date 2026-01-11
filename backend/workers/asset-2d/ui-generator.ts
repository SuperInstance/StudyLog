/**
 * UI Icon Generator
 * Generates consistent UI icons and interface elements
 * Supports multiple styles and batch generation
 */

import type {
    GenerateUIRequest,
    GenerationResponse,
    UIIconStyle,
    Asset2DProvider,
    UIMetadata
} from './types.js';

import { LeonardoProvider, createLeonardoProvider } from './providers/leonardo.js';
import { ScenarioProvider, createScenarioProvider } from './providers/scenario.js';
import { StabilityProvider, createStabilityProvider } from './providers/stability.js';
import { PROVIDER_2D_CAPABILITIES } from './types.js';

export interface UIGeneratorConfig {
    leonardo?: { apiKey: string };
    scenario?: { apiKey: string };
    stability?: { apiKey: string };
    defaultProvider?: Asset2DProvider;
    defaultStyle?: UIIconStyle;
    defaultSize?: number;
    enableCaching?: boolean;
}

export interface UIIconSet {
    id: string;
    name: string;
    description: string;
    icons: Array<{
        name: string;
        prompt: string;
        category: string;
    }>;
    style: UIIconStyle;
    size: number;
    colorScheme?: string[];
}

export interface IconPack {
    id: string;
    name: string;
    icons: string[];
    style: UIIconStyle;
    colorScheme: string[];
    generated: boolean;
    downloadUrl?: string;
}

// Predefined icon sets for common game UI needs
const PREDEFINED_ICON_SETS: UIIconSet[] = [
    {
        id: 'rpg-actions',
        name: 'RPG Action Icons',
        description: 'Common RPG action buttons',
        style: 'minimal',
        size: 64,
        icons: [
            { name: 'attack', prompt: 'sword icon, attack button', category: 'action' },
            { name: 'defend', prompt: 'shield icon, defend button', category: 'action' },
            { name: 'magic', prompt: 'magic wand icon, spell button', category: 'magic' },
            { name: 'item', prompt: 'backpack icon, inventory button', category: 'item' },
            { name: 'skill', prompt: 'star icon, skill button', category: 'skill' },
            { name: 'status', prompt: 'heart icon, status button', category: 'status' }
        ]
    },
    {
        id: 'navigation',
        name: 'Navigation Icons',
        description: 'UI navigation elements',
        style: 'minimal',
        size: 32,
        icons: [
            { name: 'home', prompt: 'home icon', category: 'navigation' },
            { name: 'back', prompt: 'arrow left icon, back button', category: 'navigation' },
            { name: 'forward', prompt: 'arrow right icon, forward button', category: 'navigation' },
            { name: 'settings', prompt: 'gear icon, settings button', category: 'navigation' },
            { name: 'close', prompt: 'x icon, close button', category: 'navigation' },
            { name: 'menu', prompt: 'hamburger icon, menu button', category: 'navigation' }
        ]
    },
    {
        id: 'inventory-slots',
        name: 'Inventory Slot Icons',
        description: 'Inventory slot frames',
        style: 'outlined',
        size: 48,
        icons: [
            { name: 'slot-empty', prompt: 'empty square frame, inventory slot', category: 'ui' },
            { name: 'slot-weapon', prompt: 'sword in frame, weapon slot', category: 'ui' },
            { name: 'slot-armor', prompt: 'shield in frame, armor slot', category: 'ui' },
            { name: 'slot-accessory', prompt: 'ring in frame, accessory slot', category: 'ui' },
            { name: 'slot-consumable', prompt: 'potion in frame, consumable slot', category: 'ui' }
        ]
    },
    {
        id: 'resource-icons',
        name: 'Resource Icons',
        description: 'Game resource indicators',
        style: 'filled',
        size: 24,
        icons: [
            { name: 'gold', prompt: 'coin icon, gold', category: 'resource' },
            { name: 'gems', prompt: 'gem icon, diamonds', category: 'resource' },
            { name: 'health', prompt: 'heart icon, health points', category: 'resource' },
            { name: 'mana', prompt: 'drop icon, mana points', category: 'resource' },
            { name: 'stamina', prompt: 'lightning icon, stamina', category: 'resource' },
            { name: 'experience', prompt: 'star icon, experience points', category: 'resource' }
        ]
    },
    {
        id: 'social-icons',
        name: 'Social Icons',
        description: 'Social interaction icons',
        style: 'minimal',
        size: 32,
        icons: [
            { name: 'chat', prompt: 'speech bubble icon, chat', category: 'social' },
            { name: 'friend', prompt: 'person icon, friend', category: 'social' },
            { name: 'group', prompt: 'people icon, group', category: 'social' },
            { name: 'trade', prompt: 'exchange icon, trade', category: 'social' },
            { name: 'mail', prompt: 'envelope icon, messages', category: 'social' }
        ]
    }
];

// Color schemes for consistent UI
const COLOR_SCHEMES: Record<string, string[]> = {
    'dark': ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#ECF0F1'],
    'light': ['#FFFFFF', '#F5F5F5', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575'],
    'blue': ['#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9', '#BBDEFB'],
    'green': ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784'],
    'red': ['#C62828', '#D32F2F', '#E53935', '#F44336', '#EF5350', '#E57373'],
    'gold': ['#F57F17', '#F9A825', '#FBC02D', '#FFC107', '#FFCA28', '#FFD54F'],
    'purple': ['#6A1B9A', '#7B1FA2', '#8E24AA', '#9C27B0', '#AB47BC', '#BA68C8'],
    'pixel': ['#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F', '#C2C3C7', '#FFF1E8']
};

export class UIGenerator {
    private leonardo?: LeonardoProvider;
    private scenario?: ScenarioProvider;
    private stability?: StabilityProvider;
    private config: Required<Omit<UIGeneratorConfig, 'leonardo' | 'scenario' | 'stability'>>;
    private iconCache: Map<string, GenerationResponse> = new Map();

    constructor(config: UIGeneratorConfig) {
        this.config = {
            defaultProvider: config.defaultProvider || 'leonardo',
            defaultStyle: config.defaultStyle || 'minimal',
            defaultSize: config.defaultSize || 64,
            enableCaching: config.enableCaching ?? true
        };

        if (config.leonardo?.apiKey) {
            this.leonardo = createLeonardoProvider({ apiKey: config.leonardo.apiKey });
        }
        if (config.scenario?.apiKey) {
            this.scenario = createScenarioProvider({ apiKey: config.scenario.apiKey });
        }
        if (config.stability?.apiKey) {
            this.stability = createStabilityProvider({ apiKey: config.stability.apiKey });
        }
    }

    /**
     * Generate a single UI icon
     */
    async generateIcon(
        request: GenerateUIRequest,
        provider?: Asset2DProvider
    ): Promise<GenerationResponse> {
        const cacheKey = this.getCacheKey(request);
        if (this.config.enableCaching && this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey)!;
        }

        const selectedProvider = provider || this.selectProvider(request);
        const result = await this.generateIconInternal(request, selectedProvider);

        if (result.success && this.config.enableCaching) {
            this.iconCache.set(cacheKey, result);
        }

        return result;
    }

    /**
     * Generate a batch of UI icons
     */
    async generateIconBatch(
        icons: Array<{ name: string; prompt: string; category?: string }>,
        options?: {
            style?: UIIconStyle;
            size?: number;
            colorScheme?: string[];
            provider?: Asset2DProvider;
        }
    ): Promise<Record<string, GenerationResponse>> {
        const results: Record<string, GenerationResponse> = {};
        const provider = options?.provider || this.config.defaultProvider;

        // Use batch generation if provider supports it
        if (provider === 'leonardo' && PROVIDER_2D_CAPABILITIES.leonardo.batchGeneration) {
            // Generate in batches for efficiency
            const batchSize = 4;
            for (let i = 0; i < icons.length; i += batchSize) {
                const batch = icons.slice(i, i + batchSize);
                const batchPrompts = batch.map(icon => icon.prompt).join(', ');

                const batchRequest: GenerateUIRequest = {
                    prompt: batchPrompts,
                    style: options?.style || this.config.defaultStyle,
                    size: options?.size || this.config.defaultSize,
                    colorScheme: options?.colorScheme,
                    batch: true,
                    batchCount: batch.length
                };

                const result = await this.leonardo!.generateUIIcon(batchRequest);

                // Distribute results among the icons
                batch.forEach((icon, idx) => {
                    results[icon.name] = {
                        ...result,
                        assetId: result.assetId ? `${result.assetId}-${idx}` : undefined
                    };
                });
            }
        } else {
            // Generate individually
            for (const icon of icons) {
                const iconRequest: GenerateUIRequest = {
                    prompt: icon.prompt,
                    style: options?.style || this.config.defaultStyle,
                    size: options?.size || this.config.defaultSize,
                    colorScheme: options?.colorScheme,
                    category: icon.category
                };

                results[icon.name] = await this.generateIcon(iconRequest, provider);
            }
        }

        return results;
    }

    /**
     * Generate a complete icon set
     */
    async generateIconSet(
        setId: string,
        options?: {
            style?: UIIconStyle;
            size?: number;
            colorScheme?: string[];
            provider?: Asset2DProvider;
        }
    ): Promise<GenerationResponse & { icons?: Record<string, string> }> {
        const iconSet = PREDEFINED_ICON_SETS.find(set => set.id === setId);
        if (!iconSet) {
            return {
                success: false,
                error: `Icon set ${setId} not found`,
                requestId: crypto.randomUUID(),
                provider: this.config.defaultProvider
            };
        }

        const results = await this.generateIconBatch(
            iconSet.icons,
            {
                style: options?.style || iconSet.style,
                size: options?.size || iconSet.size,
                colorScheme: options?.colorScheme || iconSet.colorScheme,
                provider: options?.provider
            }
        );

        const icons: Record<string, string> = {};
        for (const [name, result] of Object.entries(results)) {
            if (result.success && result.assetId) {
                icons[name] = result.assetId;
            }
        }

        return {
            success: Object.values(results).every(r => r.success),
            assetId: crypto.randomUUID(),
            status: 'completed',
            requestId: crypto.randomUUID(),
            provider: options?.provider || this.config.defaultProvider,
            costUsd: Object.values(results).reduce((sum, r) => sum + (r.costUsd || 0), 0),
            icons
        };
    }

    /**
     * Generate icons from a custom set definition
     */
    async generateCustomSet(
        iconSet: Omit<UIIconSet, 'id'>,
        provider?: Asset2DProvider
    ): Promise<GenerationResponse & { icons?: Record<string, string> }> {
        const results = await this.generateIconBatch(iconSet.icons, {
            style: iconSet.style,
            size: iconSet.size,
            colorScheme: iconSet.colorScheme,
            provider
        });

        const icons: Record<string, string> = {};
        for (const [name, result] of Object.entries(results)) {
            if (result.success && result.assetId) {
                icons[name] = result.assetId;
            }
        }

        return {
            success: Object.values(results).every(r => r.success),
            assetId: crypto.randomUUID(),
            status: 'completed',
            requestId: crypto.randomUUID(),
            provider: provider || this.config.defaultProvider,
            costUsd: Object.values(results).reduce((sum, r) => sum + (r.costUsd || 0), 0),
            icons
        };
    }

    /**
     * Generate a consistent icon pack with style consistency
     */
    async generateIconPack(
        prompts: string[],
        options?: {
            consistencyKey?: string;
            style?: UIIconStyle;
            size?: number;
            colorScheme?: string[];
            provider?: Asset2DProvider;
        }
    ): Promise<IconPack> {
        const consistencyKey = options?.consistencyKey || `pack-${crypto.randomUUID().slice(0, 8)}`;

        const icons: string[] = [];
        let totalCost = 0;

        for (const prompt of prompts) {
            const result = await this.generateIcon({
                prompt,
                style: options?.style || this.config.defaultStyle,
                size: options?.size || this.config.defaultSize,
                colorScheme: options?.colorScheme,
                consistencyKey
            }, options?.provider);

            if (result.success && result.assetId) {
                icons.push(result.assetId);
                totalCost += result.costUsd || 0;
            }
        }

        return {
            id: consistencyKey,
            name: `${consistencyKey} Pack`,
            icons,
            style: options?.style || this.config.defaultStyle,
            colorScheme: options?.colorScheme || COLOR_SCHEMES['light'],
            generated: true
        };
    }

    /**
     * Generate UI frames and panels
     */
    async generateUIFrame(
        frameType: 'window' | 'panel' | 'button' | 'input' | 'dialog',
        options?: {
            style?: UIIconStyle;
            size?: { width: number; height: number };
            colorScheme?: string[];
            provider?: Asset2DProvider;
        }
    ): Promise<GenerationResponse> {
        const prompts: Record<string, string> = {
            window: 'game window frame, RPG dialog window, border UI element',
            panel: 'game panel, UI panel with border, game interface',
            button: 'game button, clickable UI button, game interface element',
            input: 'text input field, game UI input box, dialog input',
            dialog: 'dialog box frame, RPG dialog frame, speech bubble frame'
        };

        const prompt = prompts[frameType];

        return this.generateIcon({
            prompt,
            style: options?.style || 'outlined',
            size: Math.max(options?.size?.width || 256, options?.size?.height || 256),
            colorScheme: options?.colorScheme,
            category: 'ui_frame'
        }, options?.provider);
    }

    /**
     * Generate health/mana/status bars
     */
    async generateStatusBar(
        barType: 'health' | 'mana' | 'stamina' | 'exp',
        options?: {
            style?: UIIconStyle;
            size?: { width: number; height: number };
            color?: string;
            provider?: Asset2DProvider;
        }
    ): Promise<GenerationResponse> {
        const prompts: Record<string, string> = {
            health: 'health bar UI, HP bar, red health meter',
            mana: 'mana bar UI, MP bar, blue mana meter',
            stamina: 'stamina bar UI, green stamina meter',
            exp: 'experience bar UI, XP bar, yellow experience meter'
        };

        const defaultColors: Record<string, string> = {
            health: '#E57373',
            mana: '#64B5F6',
            stamina: '#81C784',
            exp: '#FFD54F'
        };

        return this.generateIcon({
            prompt: prompts[barType],
            style: options?.style || 'filled',
            size: options?.size?.width || options?.size?.height || 256,
            colorScheme: [options?.color || defaultColors[barType], '#333333', '#666666'],
            category: 'status_bar'
        }, options?.provider);
    }

    /**
     * Get available predefined icon sets
     */
    getAvailableIconSets(): UIIconSet[] {
        return PREDEFINED_ICON_SETS;
    }

    /**
     * Get available color schemes
     */
    getAvailableColorSchemes(): Record<string, string[]> {
        return COLOR_SCHEMES;
    }

    /**
     * Get available UI icon styles
     */
    getAvailableStyles(): UIIconStyle[] {
        return ['minimal', 'outlined', 'filled', 'duotone', 'flat', 'gradient', 'neumorphic', 'glassmorphic', 'pixel', 'hand_drawn'];
    }

    /**
     * Create a custom icon set from a list of icon names
     */
    createCustomIconSet(
        name: string,
        icons: string[],
        style: UIIconStyle,
        size: number
    ): UIIconSet {
        return {
            id: `custom-${crypto.randomUUID().slice(0, 8)}`,
            name,
            description: `Custom icon set: ${name}`,
            style,
            size,
            icons: icons.map(iconName => ({
                name: iconName,
                prompt: `${iconName} icon`,
                category: 'custom'
            }))
        };
    }

    /**
     * Generate Godot-compatible theme resource
     */
    async generateGodotTheme(
        iconPack: IconPack
    ): Promise<string> {
        // Generate a Godot Theme resource file
        const themeId = crypto.randomUUID().slice(0, 8);

        let theme = `[gd_resource type="Theme" load_steps=2 format=3 uid="uid://theme_${themeId}"]

[ext_resource type="StyleBoxFlat" uid="uid://style_${themeId}" path="res://theme/${themeId}/normal.tres"]
[ext_resource type="StyleBoxFlat" uid="uid://style_${themeId}" path="res://theme/${themeId}/hover.tres"]
[ext_resource type="StyleBoxFlat" uid="uid://style_${themeId}" path="res://theme/${themeId}/pressed.tres"]

[resource]
`;

        // Add icon references
        for (let i = 0; i < iconPack.icons.length; i++) {
            theme += `\nIcon/${i} = ExtResource("${i + 1}")`;
        }

        return theme;
    }

    /**
     * Extract UI metadata from generation result
     */
    async extractMetadata(
        result: GenerationResponse,
        request: GenerateUIRequest
    ): Promise<UIMetadata> {
        return {
            format: 'png',
            width: request.size || this.config.defaultSize,
            height: request.size || this.config.defaultSize,
            style: request.style || this.config.defaultStyle,
            hasTransparency: true,
            colorScheme: request.colorScheme,
            isScalable: false,
            fileSizeBytes: 0
        };
    }

    // Private helper methods

    private async generateIconInternal(
        request: GenerateUIRequest,
        provider: Asset2DProvider
    ): Promise<GenerationResponse> {
        const enhancedRequest: GenerateUIRequest = {
            ...request,
            style: request.style || this.config.defaultStyle,
            size: request.size || this.config.defaultSize
        };

        switch (provider) {
            case 'leonardo':
                return this.leonardo?.generateUIIcon(enhancedRequest) || {
                    success: false,
                    error: 'Leonardo provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            case 'scenario':
                return this.scenario?.generateUIIcon(enhancedRequest) || {
                    success: false,
                    error: 'Scenario provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            case 'stability':
                return this.stability?.generateUIIcon(enhancedRequest) || {
                    success: false,
                    error: 'Stability provider not configured',
                    requestId: crypto.randomUUID(),
                    provider
                };
            default:
                return {
                    success: false,
                    error: `Unknown provider: ${provider}`,
                    requestId: crypto.randomUUID(),
                    provider
                };
        }
    }

    private selectProvider(request: GenerateUIRequest): Asset2DProvider {
        // Check provider availability
        if (this.leonardo?.isAvailable()) return 'leonardo';
        if (this.scenario?.isAvailable()) return 'scenario';
        if (this.stability?.isAvailable()) return 'stability';

        return this.config.defaultProvider;
    }

    private getCacheKey(request: GenerateUIRequest): string {
        return `${request.prompt}-${request.style}-${request.size}-${request.colorScheme?.join(',')}`;
    }

    /**
     * Clear the icon cache
     */
    clearCache(): void {
        this.iconCache.clear();
    }
}

export function createUIGenerator(config: UIGeneratorConfig): UIGenerator {
    return new UIGenerator(config);
}
