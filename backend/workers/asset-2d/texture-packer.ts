/**
 * Texture Packer
 * Creates texture atlases from multiple images
 * Supports multiple JSON formats for game engines
 */

import type {
    TextureAtlasRequest,
    TextureAtlasMetadata,
    SpriteSheetJsonData,
    ImageFormat,
    GenerationResponse
} from './types.js';

export interface TexturePackerConfig {
    enableCompression?: boolean;
    defaultFormat?: ImageFormat;
    maxAtlasSize?: number;
    padding?: number;
    powerOfTwo?: boolean;
    enableMipmaps?: boolean;
}

export interface PackedTexture {
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
    trimmed: boolean;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
}

export interface AtlasLayout {
    textures: Map<string, PackedTexture>;
    width: number;
    height: number;
    format: ImageFormat;
    powerOfTwo: boolean;
}

export interface PackOptions {
    maxWidth?: number;
    maxHeight?: number;
    padding?: number;
    powerOfTwo?: boolean;
    allowRotation?: boolean;
    trim?: boolean;
    borderPadding?: number;
    shapePadding?: number;
    innerPadding?: number;
}

/**
 * Rectangle class for packing algorithm
 */
class Rect {
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get area(): number {
        return this.width * this.height;
    }

    contains(other: Rect): boolean {
        return (
            other.x >= this.x &&
            other.y >= this.y &&
            other.x + other.width <= this.x + this.width &&
            other.y + other.height <= this.y + this.height
        );
    }

    intersects(other: Rect): boolean {
        return !(
            other.x >= this.x + this.width ||
            other.x + other.width <= this.x ||
            other.y >= this.y + this.height ||
            other.y + other.height <= this.y
        );
    }

    clone(): Rect {
        return new Rect(this.x, this.y, this.width, this.height);
    }
}

/**
 * Node for the shelf packing algorithm
 */
class PackNode {
    rect: Rect;
    left?: PackNode;
    right?: PackNode;
    used: boolean = false;

    constructor(x: number, y: number, width: number, height: number) {
        this.rect = new Rect(x, y, width, height);
    }
}

export class TexturePacker {
    private config: Required<TexturePackerConfig>;

    constructor(config: TexturePackerConfig = {}) {
        this.config = {
            enableCompression: config.enableCompression ?? false,
            defaultFormat: config.defaultFormat || 'png',
            maxAtlasSize: config.maxAtlasSize || 4096,
            padding: config.padding || 0,
            powerOfTwo: config.powerOfTwo ?? true,
            enableMipmaps: config.enableMipmaps ?? false
        };
    }

    /**
     * Pack images into a texture atlas
     */
    async pack(
        images: Array<{ name: string; data: string | ArrayBuffer; width: number; height: number }>,
        options: PackOptions = {}
    ): Promise<{ atlas: string; layout: AtlasLayout; metadata: TextureAtlasMetadata }> {
        const packOptions = this.normalizeOptions(options);

        // Load and measure images
        const imageData = await Promise.all(
            images.map(async (img) => {
                const { width, height } = await this.getImageDimensions(img.data);
                return {
                    name: img.name,
                    data: img.data,
                    width,
                    height
                };
            })
        );

        // Calculate layout using shelf packing algorithm
        const layout = this.calculateLayout(imageData, packOptions);

        // Create the atlas image
        const atlas = await this.createAtlas(imageData, layout, packOptions);

        // Generate metadata
        const metadata = this.generateMetadata(layout, packOptions);

        return { atlas, layout, metadata };
    }

    /**
     * Pack images with JSON data export
     */
    async packWithJson(
        images: Array<{ name: string; data: string | ArrayBuffer; width: number; height: number }>,
        options: PackOptions & {
            jsonFormat?: 'aseprite' | 'godot' | 'unity' | 'array' | 'hash';
            imagePath?: string;
        } = {}
    ): Promise<{
        atlas: string;
        jsonData: SpriteSheetJsonData;
        layout: AtlasLayout;
    }> {
        const { atlas, layout } = await this.pack(images, options);
        const jsonFormat = options.jsonFormat || 'godot';
        const imagePath = options.imagePath || 'atlas.png';

        const jsonData = this.generateJsonData(layout, jsonFormat, imagePath);

        return { atlas, jsonData, layout };
    }

    /**
     * Create a texture atlas from URLs
     */
    async packFromUrls(
        urls: string[],
        options: PackOptions = {}
    ): Promise<GenerationResponse & { atlasUrl?: string; metadata?: TextureAtlasMetadata }> {
        try {
            const images = await Promise.all(
                urls.map(async (url, index) => {
                    const response = await fetch(url);
                    const data = await response.arrayBuffer();
                    const dimensions = await this.getImageDimensions(data);
                    return {
                        name: this.getImageName(url, index),
                        data,
                        width: dimensions.width,
                        height: dimensions.height
                    };
                })
            );

            const result = await this.pack(images, options);

            const assetId = crypto.randomUUID();

            return {
                success: true,
                assetId,
                status: 'completed',
                requestId: crypto.randomUUID(),
                provider: 'cached',
                costUsd: 0,
                atlasUrl: result.atlas,
                metadata: result.metadata
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestId: crypto.randomUUID(),
                provider: 'cached'
            };
        }
    }

    /**
     * Repack an existing atlas with new settings
     */
    async repack(
        atlasData: string,
        jsonData: SpriteSheetJsonData,
        options: PackOptions = {}
    ): Promise<{ atlas: string; newJsonData: SpriteSheetJsonData }> {
        // Extract images from atlas based on JSON data
        const images: Array<{ name: string; data: string; width: number; height: number }> = [];

        for (const frame of jsonData.frames) {
            const imageData = await this.extractFromAtlas(atlasData, frame);
            images.push({
                name: frame.filename,
                data: imageData,
                width: frame.frame.w,
                height: frame.frame.h
            });
        }

        // Pack with new options
        const result = await this.packWithJson(images, {
            ...options,
            jsonFormat: jsonData.format
        });

        return {
            atlas: result.atlas,
            newJsonData: result.jsonData
        };
    }

    /**
     * Generate multiple atlases for large sprite sets
     */
    async packMultiAtlas(
        images: Array<{ name: string; data: string | ArrayBuffer; width: number; height: number }>,
        options: PackOptions = {}
    ): Promise<Array<{ atlas: string; layout: AtlasLayout; index: number }>> {
        const maxSize = options.maxWidth || options.maxHeight || this.config.maxAtlasSize;
        const batchSize = this.estimateBatchSize(images, maxSize);

        const results: Array<{ atlas: string; layout: AtlasLayout; index: number }> = [];

        for (let i = 0; i < images.length; i += batchSize) {
            const batch = images.slice(i, i + batchSize);
            const { atlas, layout } = await this.pack(batch, options);

            results.push({
                atlas,
                layout,
                index: Math.floor(i / batchSize)
            });
        }

        return results;
    }

    /**
     * Create a tileset atlas from individual tiles
     */
    async packTileset(
        tiles: Array<{ data: string | ArrayBuffer; width: number; height: number }>,
        options: PackOptions & {
            columns?: number;
            tileSize?: { width: number; height: number };
        } = {}
    ): Promise<{ atlas: string; layout: AtlasLayout }> {
        const columns = options.columns || Math.ceil(Math.sqrt(tiles.length));
        const tileSize = options.tileSize || { width: 64, height: 64 };

        // Create named tiles
        const namedTiles = tiles.map((tile, index) => ({
            name: `tile_${index}`,
            data: tile.data,
            width: tile.width,
            height: tile.height
        }));

        // Calculate grid layout
        const rows = Math.ceil(tiles.length / columns);
        const padding = options.padding || this.config.padding;

        const layout: AtlasLayout = {
            textures: new Map(),
            width: columns * (tileSize.width + padding) - padding,
            height: rows * (tileSize.height + padding) - padding,
            format: this.config.defaultFormat,
            powerOfTwo: options.powerOfTwo ?? this.config.powerOfTwo
        };

        // Position each tile in the grid
        for (let i = 0; i < namedTiles.length; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);

            layout.textures.set(namedTiles[i].name, {
                x: col * (tileSize.width + padding),
                y: row * (tileSize.height + padding),
                width: tileSize.width,
                height: tileSize.height,
                rotated: false,
                trimmed: false,
                spriteSourceSize: { x: 0, y: 0, w: tileSize.width, h: tileSize.height },
                sourceSize: { w: tileSize.width, h: tileSize.height }
            });
        }

        // Create atlas
        const atlas = await this.createAtlas(namedTiles, layout, this.normalizeOptions(options));

        return { atlas, layout };
    }

    /**
     * Optimize an existing atlas
     */
    async optimizeAtlas(
        atlasData: string,
        options: {
            trimTransparentPixels?: boolean;
            compress?: boolean;
            format?: ImageFormat;
        } = {}
    ): Promise<string> {
        // This would process the atlas image
        // For now, return the original
        return atlasData;
    }

    /**
     * Generate atlas preview image
     */
    async generatePreview(
        layout: AtlasLayout,
        options: {
            showBorders?: boolean;
            showNames?: boolean;
            backgroundColor?: string;
            borderColor?: string;
        } = {}
    ): Promise<string> {
        // Generate a visual preview of the atlas layout
        // This would create an SVG or canvas representation

        const showBorders = options.showBorders ?? true;
        const backgroundColor = options.backgroundColor || '#333333';
        const borderColor = options.borderColor || '#FF0000';

        let svg = `<svg width="${layout.width}" height="${layout.height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="100%" height="100%" fill="${backgroundColor}"/>`;

        for (const [name, texture] of layout.textures) {
            if (showBorders) {
                svg += `<rect x="${texture.x}" y="${texture.y}" width="${texture.width}" height="${texture.height}" ` +
                    `fill="none" stroke="${borderColor}" stroke-width="1"/>`;

                if (options.showNames) {
                    svg += `<text x="${texture.x + 2}" y="${texture.y + 12}" fill="white" font-size="10">${name}</text>`;
                }
            }
        }

        svg += '</svg>';

        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    // Private helper methods

    private normalizeOptions(options: PackOptions): Required<Omit<PackOptions, 'powerOfTwo'>> & { powerOfTwo: boolean } {
        return {
            maxWidth: options.maxWidth || this.config.maxAtlasSize,
            maxHeight: options.maxHeight || this.config.maxAtlasSize,
            padding: options.padding ?? this.config.padding,
            powerOfTwo: options.powerOfTwo ?? this.config.powerOfTwo,
            allowRotation: options.allowRotation ?? false,
            trim: options.trim ?? false,
            borderPadding: options.borderPadding ?? 0,
            shapePadding: options.shapePadding ?? 0,
            innerPadding: options.innerPadding ?? 0
        };
    }

    private async getImageDimensions(data: string | ArrayBuffer): Promise<{ width: number; height: number }> {
        // For base64 images, we could parse the headers
        // For now, return default dimensions
        if (typeof data === 'string' && data.startsWith('data:')) {
            // Could extract dimensions from PNG/JPEG headers
        }
        return { width: 64, height: 64 };
    }

    private getImageName(url: string, index: number): string {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const name = pathname.substring(pathname.lastIndexOf('/') + 1);
            return name || `image_${index}`;
        } catch {
            return `image_${index}`;
        }
    }

    private calculateLayout(
        images: Array<{ name: string; data: string | ArrayBuffer; width: number; height: number }>,
        options: Required<Omit<PackOptions, 'powerOfTwo'>> & { powerOfTwo: boolean }
    ): AtlasLayout {
        // Sort images by size (largest first) for better packing
        const sortedImages = [...images].sort((a, b) => b.height - a.height || b.width - a.width);

        // Estimate required dimensions
        const totalArea = sortedImages.reduce((sum, img) => sum + (img.width + options.padding) * (img.height + options.padding), 0);
        const initialWidth = Math.min(Math.ceil(Math.sqrt(totalArea)) * 2, options.maxWidth);
        const initialHeight = Math.min(Math.ceil(totalArea / initialWidth), options.maxHeight);

        let width = this.toPowerOfTwo(initialWidth);
        let height = this.toPowerOfTwo(initialHeight);

        // Try to pack with increasing dimensions
        let root: PackNode | null = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
            root = new PackNode(0, 0, width, height);
            const textures = new Map<string, PackedTexture>();
            let success = true;

            for (const img of sortedImages) {
                const node = this.insertNode(root, img.width + options.padding, img.height + options.padding);
                if (!node) {
                    success = false;
                    break;
                }

                textures.set(img.name, {
                    x: node.rect.x,
                    y: node.rect.y,
                    width: img.width,
                    height: img.height,
                    rotated: false,
                    trimmed: false,
                    spriteSourceSize: { x: 0, y: 0, w: img.width, h: img.height },
                    sourceSize: { w: img.width, h: img.height }
                });
            }

            if (success) {
                return {
                    textures,
                    width,
                    height,
                    format: this.config.defaultFormat,
                    powerOfTwo: options.powerOfTwo
                };
            }

            // Increase dimensions and try again
            if (width >= height) {
                height = Math.min(height * 2, options.maxHeight);
            } else {
                width = Math.min(width * 2, options.maxWidth);
            }

            attempts++;
        }

        // Fallback: create a simple column layout
        const textures = new Map<string, PackedTexture>();
        let y = 0;
        for (const img of sortedImages) {
            textures.set(img.name, {
                x: 0,
                y,
                width: img.width,
                height: img.height,
                rotated: false,
                trimmed: false,
                spriteSourceSize: { x: 0, y: 0, w: img.width, h: img.height },
                sourceSize: { w: img.width, h: img.height }
            });
            y += img.height + options.padding;
        }

        return {
            textures,
            width: sortedImages[0]?.width || 1,
            height: y,
            format: this.config.defaultFormat,
            powerOfTwo: options.powerOfTwo
        };
    }

    private insertNode(root: PackNode, width: number, height: number): PackNode | null {
        if (root.used) {
            return this.insertNode(root.left!, width, height) ||
                   this.insertNode(root.right!, width, height);
        }

        if (width > root.rect.width || height > root.rect.height) {
            return null;
        }

        if (width === root.rect.width && height === root.rect.height) {
            root.used = true;
            return root;
        }

        const dw = root.rect.width - width;
        const dh = root.rect.height - height;

        if (dw > dh) {
            root.left = new PackNode(root.rect.x, root.rect.y, width, root.rect.height);
            root.right = new PackNode(root.rect.x + width, root.rect.y, dw, root.rect.height);
        } else {
            root.left = new PackNode(root.rect.x, root.rect.y, root.rect.width, height);
            root.right = new PackNode(root.rect.x, root.rect.y + height, root.rect.width, dh);
        }

        return this.insertNode(root.left, width, height);
    }

    private toPowerOfTwo(value: number): number {
        if (!this.config.powerOfTwo) return value;
        return Math.pow(2, Math.ceil(Math.log2(value)));
    }

    private async createAtlas(
        images: Array<{ name: string; data: string | ArrayBuffer; width: number; height: number }>,
        layout: AtlasLayout,
        options: Required<Omit<PackOptions, 'powerOfTwo'>> & { powerOfTwo: boolean }
    ): Promise<string> {
        // In a real implementation, this would:
        // 1. Create a canvas/image buffer of layout.width x layout.height
        // 2. Draw each image at its calculated position
        // 3. Return the result as base64 or upload to storage

        // For now, return a placeholder
        return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    }

    private async extractFromAtlas(atlasData: string, frame: SpriteSheetJsonData['frames'][0]): Promise<string> {
        // Extract a single frame from an atlas
        // This would parse the image and extract the region
        return atlasData;
    }

    private generateMetadata(
        layout: AtlasLayout,
        options: Required<Omit<PackOptions, 'powerOfTwo'>> & { powerOfTwo: boolean }
    ): TextureAtlasMetadata {
        return {
            format: layout.format,
            width: layout.width,
            height: layout.height,
            imageCount: layout.textures.size,
            padding: options.padding,
            isPowerOfTwo: this.isPowerOfTwo(layout.width) && this.isPowerOfTwo(layout.height)
        };
    }

    private generateJsonData(
        layout: AtlasLayout,
        format: 'aseprite' | 'godot' | 'unity' | 'array' | 'hash',
        imagePath: string
    ): SpriteSheetJsonData {
        const frames: SpriteSheetJsonData['frames'] = [];

        for (const [name, texture] of layout.textures) {
            const frameData: SpriteSheetJsonData['frames'][0] = {
                filename: name,
                frame: {
                    x: texture.x,
                    y: texture.y,
                    w: texture.width,
                    h: texture.height
                },
                rotated: texture.rotated,
                trimmed: texture.trimmed,
                spriteSourceSize: texture.spriteSourceSize,
                sourceSize: texture.sourceSize
            };
            frames.push(frameData);
        }

        return {
            format,
            frames,
            meta: {
                app: 'SuperInstance.AI TexturePacker',
                version: '1.0',
                image: imagePath,
                format: layout.format.toUpperCase(),
                size: { w: layout.width, h: layout.height },
                scale: '1'
            }
        };
    }

    private isPowerOfTwo(value: number): boolean {
        return (value & (value - 1)) === 0;
    }

    private estimateBatchSize(images: unknown[], maxSize: number): number {
        // Estimate how many images can fit in a single atlas
        // This is a rough estimate
        const avgSize = 64 * 64; // Assume average tile size
        const atlasArea = maxSize * maxSize;
        return Math.max(1, Math.floor(atlasArea / avgSize));
    }

    /**
     * Get statistics about a layout
     */
    getLayoutStats(layout: AtlasLayout): {
        totalArea: number;
        usedArea: number;
        efficiency: number;
        imageCount: number;
    } {
        const totalArea = layout.width * layout.height;
        let usedArea = 0;

        for (const texture of layout.textures.values()) {
            usedArea += texture.width * texture.height;
        }

        return {
            totalArea,
            usedArea,
            efficiency: usedArea / totalArea,
            imageCount: layout.textures.size
        };
    }
}

export function createTexturePacker(config?: TexturePackerConfig): TexturePacker {
    return new TexturePacker(config);
}
