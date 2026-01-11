/**
 * Sprite Generator for MicroVerse Form
 *
 * Generates 2D/2.5D pixel art sprites in NES-SNES style.
 * Supports multiple sprite styles and animation frames.
 */

import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  MicroVerseAsset,
  SpriteStyle,
  SpriteFrame,
  SpriteAnimation,
  ColorPalette,
  Proportions,
  QualityLevel,
  BaseAsset
} from './types.js';
import { StylePreserver } from './style-preserver.js';

// ============================================================================
// GENERATION OPTIONS
// ============================================================================

export interface SpriteGenerationOptions {
  /** Target sprite style */
  style?: SpriteStyle;
  /** Output dimensions (width, height) */
  dimensions?: [number, number];
  /** Number of animation frames */
  frames?: number;
  /** Color palette (overrides extraction) */
  palette?: ColorPalette;
  /** Quality level */
  quality?: QualityLevel;
  /** Proportions to maintain */
  proportions?: Proportions;
  /** Enable dithering for color reduction */
  dithering?: boolean;
  /** Generate sprite sheet vs individual frames */
  spriteSheet?: boolean;
  /** Output directory */
  outputPath?: string;
}

// ============================================================================
// PALETTE DEFINITIONS
// ============================================================================

const NES_PALETTE = [
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F', // Greens
  '#0F380F', '#306230', '#8BAC0F', '#9BBC0F'  // Duplicates
];

const SNES_PALETTE = [
  '#000000', '#222034', '#45283C', '#663931',
  '#8F563B', '#DF7126', '#D9A066', '#EEC39A',
  '#FBF236', '#99E550', '#6abe30', '#37946E',
  '#5B6EE1', '#6B71C9', '#83769C', '#FFFFFF'
];

// ============================================================================
// SPRITE GENERATOR CLASS
// ============================================================================

export class SpriteGenerator {
  private stylePreserver: StylePreserver;
  private outputDirectory: string;

  constructor(outputDirectory?: string) {
    this.stylePreserver = new StylePreserver();
    this.outputDirectory = outputDirectory || '/tmp/sprite-generator';
  }

  /**
   * Generate a MicroVerse sprite asset from source image or data
   */
  async generateFromImage(
    sourcePath: string,
    options: SpriteGenerationOptions = {}
  ): Promise<MicroVerseAsset> {
    await this.ensureOutputDirectory();

    const {
      style = SpriteStyle.SNES_16BIT,
      dimensions,
      frames = 1,
      quality = QualityLevel.STANDARD,
      dithering = false,
      spriteSheet = true
    } = options;

    // Load source image
    const sourceImage = sharp(sourcePath);
    const metadata = await sourceImage.metadata();

    // Determine output dimensions
    const targetDimensions = dimensions || this.calculateTargetDimensions(
      metadata.width || 32,
      metadata.height || 32,
      style
    );

    // Extract or use provided palette
    const palette = options.palette || await this.extractPaletteFromImage(sourcePath, style);

    // Generate sprite frames
    const spriteFrames: SpriteFrame[] = [];
    const frameWidth = targetDimensions[0];
    const frameHeight = targetDimensions[1];

    for (let i = 0; i < frames; i++) {
      const frame = await this.generateFrame(
        sourcePath,
        frameWidth,
        frameHeight,
        palette,
        style,
        i,
        frames,
        dithering
      );
      spriteFrames.push(frame);
    }

    // Generate animations if multiple frames
    const animations = frames > 1 ? this.generateDefaultAnimations(frames) : undefined;

    // Create sprite sheet configuration
    const spriteSheetConfig = spriteSheet ? this.calculateSpriteSheetLayout(
      spriteFrames,
      targetDimensions
    ) : undefined;

    // Create asset metadata
    const asset: MicroVerseAsset = {
      id: uuidv4(),
      name: path.basename(sourcePath, path.extname(sourcePath)),
      category: 'sprite',
      tags: [style, 'generated'],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath,
      form: 'microverse' as any,
      spriteSheet: spriteSheetConfig || {
        width: frameWidth,
        height: frameHeight,
        frames,
        rows: 1,
        columns: frames
      },
      frames: spriteFrames,
      style,
      palette,
      animations
    };

    // Save generated files
    await this.saveSpriteAsset(asset, options.outputPath);

    return asset;
  }

  /**
   * Generate sprite from color description (procedural generation)
   */
  async generateFromDescription(
    description: string,
    options: SpriteGenerationOptions = {}
  ): Promise<MicroVerseAsset> {
    await this.ensureOutputDirectory();

    const {
      style = SpriteStyle.MODERN_PIXEL,
      dimensions = [32, 32],
      frames = 1,
      quality = QualityLevel.STANDARD,
      palette,
      proportions
    } = options;

    // Parse description to extract characteristics
    const characteristics = this.parseDescription(description);

    // Generate or use palette
    const targetPalette = palette || this.generatePaletteFromDescription(characteristics);

    // Generate base sprite
    const baseBuffer = await this.generateProceduralSprite(
      dimensions[0],
      dimensions[1],
      characteristics,
      targetPalette,
      style
    );

    // Create frames
    const spriteFrames: SpriteFrame[] = [];
    for (let i = 0; i < frames; i++) {
      // Animate procedural sprite
      const animatedBuffer = frames > 1
        ? await this.applyProceduralAnimation(baseBuffer, i, frames, characteristics)
        : baseBuffer;

      spriteFrames.push({
        index: i,
        duration: 100,
        imageData: animatedBuffer.toString('base64'),
        width: dimensions[0],
        height: dimensions[1],
        pivot: [0.5, 0.5]
      });
    }

    const asset: MicroVerseAsset = {
      id: uuidv4(),
      name: `procedural_${characteristics.subject || 'sprite'}`,
      category: 'procedural',
      tags: [style, 'procedural', ...characteristics.tags],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: 'procedural',
      form: 'microverse' as any,
      spriteSheet: {
        width: dimensions[0],
        height: dimensions[1],
        frames,
        rows: 1,
        columns: frames
      },
      frames: spriteFrames,
      style,
      palette: targetPalette,
      animations: frames > 1 ? this.generateDefaultAnimations(frames) : undefined
    };

    await this.saveSpriteAsset(asset, options.outputPath);

    return asset;
  }

  /**
   * Convert a mesh or voxel asset to sprite form
   */
  async convertFrom3D(
    asset3D: any, // LuantiAsset or OpenRTSAsset
    options: SpriteGenerationOptions = {}
  ): Promise<MicroVerseAsset> {
    const {
      style = SpriteStyle.SNES_16BIT,
      dimensions = [64, 64],
      frames = 1
    } = options;

    // Extract style information from 3D asset
    const styleProfile = this.stylePreserver.extractStyleProfile(asset3D);
    const adaptedPalette = this.stylePreserver.adaptPaletteForForm(
      styleProfile.palette,
      'microverse' as any,
      'balanced' as any
    );

    // Render 3D asset to 2D
    const renderedFrames = await this.render3DToSprite(asset3D, dimensions, frames, styleProfile);

    const spriteFrames: SpriteFrame[] = renderedFrames.map((buffer, i) => ({
      index: i,
      duration: 100,
      imageData: buffer.toString('base64'),
      width: dimensions[0],
      height: dimensions[1],
      pivot: [0.5, 0.5]
    }));

    const asset: MicroVerseAsset = {
      id: uuidv4(),
      name: `${asset3D.name}_sprite`,
      category: asset3D.category,
      tags: [...asset3D.tags, 'converted', style],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: asset3D.sourcePath || 'converted',
      form: 'microverse' as any,
      spriteSheet: {
        width: dimensions[0],
        height: dimensions[1],
        frames,
        rows: 1,
        columns: frames
      },
      frames: spriteFrames,
      style,
      palette: adaptedPalette,
      animations: frames > 1 ? this.generateDefaultAnimations(frames) : undefined
    };

    await this.saveSpriteAsset(asset, options.outputPath);

    return asset;
  }

  // ========================================================================
  // FRAME GENERATION
  // ========================================================================

  private async generateFrame(
    sourcePath: string,
    width: number,
    height: number,
    palette: ColorPalette,
    style: SpriteStyle,
    frameIndex: number,
    totalFrames: number,
    dithering: boolean
  ): Promise<SpriteFrame> {
    // Load and process source image
    let pipeline = sharp(sourcePath);

    // Apply style-specific processing
    switch (style) {
      case SpriteStyle.NES_8BIT:
        pipeline = this.applyNESStyle(pipeline, palette, dithering);
        break;
      case SpriteStyle.SNES_16BIT:
        pipeline = this.applySNESStyle(pipeline, palette, dithering);
        break;
      case SpriteStyle.GENESIS_16BIT:
        pipeline = this.applyGenesisStyle(pipeline, palette, dithering);
        break;
      case SpriteStyle.MODERN_PIXEL:
        pipeline = this.applyModernPixelStyle(pipeline, palette, dithering);
        break;
    }

    // Resize to target dimensions
    pipeline = pipeline.resize(width, height, {
      kernel: sharp.kernel.nearest
    });

    // Generate output
    const buffer = await pipeline.png().toBuffer();

    return {
      index: frameIndex,
      duration: 100,
      imageData: buffer.toString('base64'),
      width,
      height,
      pivot: [0.5, 0.5]
    };
  }

  private applyNESStyle(pipeline: sharp.Sharp, palette: ColorPalette, dithering: boolean): sharp.Sharp {
    // NES: limited colors, blocky pixels
    return pipeline
      .modulate({
        brightness: 1,
        saturation: 0.8
      })
      .resize(undefined, undefined, {
        kernel: sharp.kernel.nearest
      })
      .colors({
        type: 'indexed',
        colors: Math.min(palette.hexValues.length, 4)
      });
  }

  private applySNESStyle(pipeline: sharp.Sharp, palette: ColorPalette, dithering: boolean): sharp.Sharp {
    // SNES: more colors, better shading
    return pipeline
      .modulate({
        brightness: 1.05,
        saturation: 0.9
      })
      .sharpen()
      .colors({
        type: 'indexed',
        colors: Math.min(palette.hexValues.length, 16)
      });
  }

  private applyGenesisStyle(pipeline: sharp.Sharp, palette: ColorPalette, dithering: boolean): sharp.Sharp {
    // Genesis: higher contrast, dithered gradients
    return pipeline
      .modulate({
        brightness: 1.1,
        saturation: 1.2
      })
      .normalize()
      .colors({
        type: 'indexed',
        colors: Math.min(palette.hexValues.length, 16)
      });
  }

  private applyModernPixelStyle(pipeline: sharp.Sharp, palette: ColorPalette, dithering: boolean): sharp.Sharp {
    // Modern: full alpha, more colors, smooth gradients
    return pipeline
      .modulate({
        brightness: 1,
        saturation: 1
      })
      .sharpen({
        sigma: 0.5
      });
  }

  // ========================================================================
  // PALETTE EXTRACTION
  // ========================================================================

  private async extractPaletteFromImage(
    imagePath: string,
    style: SpriteStyle
  ): Promise<ColorPalette> {
    const image = sharp(imagePath);
    const { data, info } = await image
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Extract dominant colors
    const colorCounts = new Map<string, number>();
    const pixels = info.width * info.height;

    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Skip alpha channel for color extraction
      if (info.channels > 3 && data[i + 3] < 128) continue;

      const hex = this.rgbToHex(r, g, b);
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }

    // Sort by frequency
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(e => e[0]);

    // Limit palette based on style
    const maxColors = this.getMaxColorsForStyle(style);
    const limitedColors = sortedColors.slice(0, maxColors);

    return this.createPaletteFromColors(limitedColors);
  }

  private getMaxColorsForStyle(style: SpriteStyle): number {
    switch (style) {
      case SpriteStyle.NES_8BIT: return 4;
      case SpriteStyle.SNES_16BIT:
      case SpriteStyle.GENESIS_16BIT: return 16;
      case SpriteStyle.MODERN_PIXEL: return 256;
      default: return 16;
    }
  }

  private createPaletteFromColors(colors: string[]): ColorPalette {
    if (colors.length === 0) {
      return {
        primary: '#808080',
        secondary: '#606060',
        accent: '#FFFFFF',
        shadow: '#202020',
        hexValues: ['#808080']
      };
    }

    // Analyze colors for roles
    const luminances = colors.map(c => {
      const rgb = this.hexToRgb(c);
      return {
        color: c,
        lum: 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b
      };
    });

    luminances.sort((a, b) => b.lum - a.lum);

    return {
      primary: colors[0],
      secondary: colors[1] || colors[0],
      accent: luminances[luminances.length - 1].color, // Brightest
      shadow: luminances[0].color, // Darkest
      hexValues: colors
    };
  }

  // ========================================================================
  // PROCEDURAL GENERATION
  // ========================================================================

  private parseDescription(description: string): {
    subject: string;
    colors: string[];
    style: string;
    tags: string[];
  } {
    const result = {
      subject: 'entity',
      colors: [] as string[],
      style: 'generic',
      tags: [] as string[]
    };

    // Extract colors from description
    const colorPatterns = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple',
      'black', 'white', 'gray', 'brown', 'pink', 'cyan'
    ];
    const lowerDesc = description.toLowerCase();

    for (const color of colorPatterns) {
      if (lowerDesc.includes(color)) {
        result.colors.push(color);
      }
    }

    // Extract subject
    const subjectPatterns = [
      'character', 'person', 'human', 'creature', 'animal',
      'monster', 'robot', 'vehicle', 'weapon', 'item',
      'tree', 'building', 'structure'
    ];
    for (const subject of subjectPatterns) {
      if (lowerDesc.includes(subject)) {
        result.subject = subject;
        result.tags.push(subject);
        break;
      }
    }

    return result;
  }

  private generatePaletteFromDescription(characteristics: {
    colors: string[];
    style: string;
  }): ColorPalette {
    const colorMap: Record<string, string> = {
      red: '#E74C3C',
      blue: '#3498DB',
      green: '#2ECC71',
      yellow: '#F1C40F',
      orange: '#E67E22',
      purple: '#9B59B6',
      black: '#2C3E50',
      white: '#ECF0F1',
      gray: '#95A5A6',
      brown: '#8B4513',
      pink: '#E91E63',
      cyan: '#00BCD4'
    };

    const hexColors = characteristics.colors
      .map(c => colorMap[c])
      .filter(c => c !== undefined) as string[];

    if (hexColors.length === 0) {
      hexColors.push('#808080', '#606060', '#404040');
    }

    return this.createPaletteFromColors(hexColors);
  }

  private async generateProceduralSprite(
    width: number,
    height: number,
    characteristics: { subject: string; colors: string[]; tags: string[] },
    palette: ColorPalette,
    style: SpriteStyle
  ): Promise<Buffer> {
    // Create base pixel data
    const pixelData = new Uint8Array(width * height * 4);

    // Fill with transparent pixels
    pixelData.fill(0);

    // Generate procedural shape based on subject
    switch (characteristics.subject) {
      case 'character':
      case 'person':
      case 'human':
        this.generateCharacterSprite(pixelData, width, height, palette);
        break;
      case 'creature':
      case 'animal':
        this.generateCreatureSprite(pixelData, width, height, palette);
        break;
      case 'robot':
        this.generateRobotSprite(pixelData, width, height, palette);
        break;
      case 'tree':
        this.generateTreeSprite(pixelData, width, height, palette);
        break;
      default:
        this.generateGenericSprite(pixelData, width, height, palette);
    }

    // Convert to PNG
    return sharp(Buffer.from(pixelData), {
      raw: {
        width,
        height,
        channels: 4
      }
    }).png().toBuffer();
  }

  private generateCharacterSprite(
    pixels: Uint8Array,
    width: number,
    height: number,
    palette: ColorPalette
  ): void {
    const primary = this.hexToRgb(palette.primary);
    const secondary = this.hexToRgb(palette.secondary);
    const skin = this.hexToRgb(palette.accent);

    // Head
    const headWidth = Math.floor(width * 0.4);
    const headHeight = Math.floor(height * 0.25);
    const headX = Math.floor((width - headWidth) / 2);
    const headY = Math.floor(height * 0.05);

    this.fillEllipse(pixels, width, headX, headY, headWidth, headHeight, skin);

    // Body
    const bodyWidth = Math.floor(width * 0.5);
    const bodyHeight = Math.floor(height * 0.35);
    const bodyX = Math.floor((width - bodyWidth) / 2);
    const bodyY = headY + headHeight;

    this.fillRectangle(pixels, width, bodyX, bodyY, bodyWidth, bodyHeight, primary);

    // Legs
    const legWidth = Math.floor(width * 0.15);
    const legHeight = Math.floor(height * 0.3);
    const legY = bodyY + bodyHeight;

    this.fillRectangle(pixels, width, bodyX + Math.floor(width * 0.05), legY, legWidth, legHeight, secondary);
    this.fillRectangle(pixels, width, bodyX + bodyWidth - legWidth - Math.floor(width * 0.05), legY, legWidth, legHeight, secondary);
  }

  private generateCreatureSprite(
    pixels: Uint8Array,
    width: number,
    height: number,
    palette: ColorPalette
  ): void {
    const primary = this.hexToRgb(palette.primary);

    // Simple creature shape - rounded body
    const bodyWidth = Math.floor(width * 0.6);
    const bodyHeight = Math.floor(height * 0.6);
    const bodyX = Math.floor((width - bodyWidth) / 2);
    const bodyY = Math.floor((height - bodyHeight) / 2);

    this.fillEllipse(pixels, width, bodyX, bodyY, bodyWidth, bodyHeight, primary);
  }

  private generateRobotSprite(
    pixels: Uint8Array,
    width: number,
    height: number,
    palette: ColorPalette
  ): void {
    const primary = this.hexToRgb(palette.primary);
    const secondary = this.hexToRgb(palette.secondary);
    const accent = this.hexToRgb(palette.accent);

    // Blocky robot body
    const bodyWidth = Math.floor(width * 0.5);
    const bodyHeight = Math.floor(height * 0.5);
    const bodyX = Math.floor((width - bodyWidth) / 2);
    const bodyY = Math.floor(height * 0.25);

    this.fillRectangle(pixels, width, bodyX, bodyY, bodyWidth, bodyHeight, primary);

    // Head
    const headSize = Math.floor(width * 0.3);
    const headX = Math.floor((width - headSize) / 2);
    const headY = bodyY - headSize;

    this.fillRectangle(pixels, width, headX, headY, headSize, headSize, secondary);

    // Eyes
    const eyeSize = Math.floor(width * 0.05);
    this.fillRectangle(pixels, width, headX + Math.floor(headSize * 0.2), headY + Math.floor(headSize * 0.3), eyeSize, eyeSize, accent);
    this.fillRectangle(pixels, width, headX + Math.floor(headSize * 0.6), headY + Math.floor(headSize * 0.3), eyeSize, eyeSize, accent);
  }

  private generateTreeSprite(
    pixels: Uint8Array,
    width: number,
    height: number,
    palette: ColorPalette
  ): void {
    const trunk = this.hexToRgb('#8B4513');
    const foliage = this.hexToRgb(palette.primary);

    // Trunk
    const trunkWidth = Math.floor(width * 0.15);
    const trunkHeight = Math.floor(height * 0.4);
    const trunkX = Math.floor((width - trunkWidth) / 2);
    const trunkY = Math.floor(height * 0.6);

    this.fillRectangle(pixels, width, trunkX, trunkY, trunkWidth, trunkHeight, trunk);

    // Foliage
    const foliageWidth = Math.floor(width * 0.7);
    const foliageHeight = Math.floor(height * 0.5);
    const foliageX = Math.floor((width - foliageWidth) / 2);
    const foliageY = trunkY - foliageHeight + Math.floor(trunkHeight * 0.5);

    this.fillEllipse(pixels, width, foliageX, foliageY, foliageWidth, foliageHeight, foliage);
  }

  private generateGenericSprite(
    pixels: Uint8Array,
    width: number,
    height: number,
    palette: ColorPalette
  ): void {
    const primary = this.hexToRgb(palette.primary);

    // Simple rounded rectangle
    const rectWidth = Math.floor(width * 0.6);
    const rectHeight = Math.floor(height * 0.7);
    const rectX = Math.floor((width - rectWidth) / 2);
    const rectY = Math.floor((height - rectHeight) / 2);

    this.fillRoundedRectangle(pixels, width, rectX, rectY, rectWidth, rectHeight, 4, primary);
  }

  private async applyProceduralAnimation(
    baseBuffer: Buffer,
    frameIndex: number,
    totalFrames: number,
    characteristics: { subject: string; colors: string[]; tags: string[] }
  ): Promise<Buffer> {
    // Apply simple animation transformations
    const phase = (frameIndex / totalFrames) * Math.PI * 2;

    // For now, return the base buffer
    // In a full implementation, would apply pixel manipulation for animation
    return baseBuffer;
  }

  // ========================================================================
  // 3D TO 2D RENDERING
  // ========================================================================

  private async render3DToSprite(
    asset3D: any,
    dimensions: [number, number],
    frames: number,
    styleProfile: any
  ): Promise<Buffer[]> {
    const renderedBuffers: Buffer[] = [];

    for (let i = 0; i < frames; i++) {
      // Create a placeholder buffer
      // In production, would use actual 3D rendering
      const pixelData = new Uint8Array(dimensions[0] * dimensions[1] * 4);

      // Simple orthographic projection of 3D data
      if (asset3D.form === 'luanti') {
        this.renderVoxelsToPixels(pixelData, dimensions[0], dimensions[1], asset3D);
      } else if (asset3D.form === 'openrts') {
        this.renderMeshToPixels(pixelData, dimensions[0], dimensions[1], asset3D);
      }

      const buffer = await sharp(Buffer.from(pixelData), {
        raw: {
          width: dimensions[0],
          height: dimensions[1],
          channels: 4
        }
      }).png().toBuffer();

      renderedBuffers.push(buffer);
    }

    return renderedBuffers;
  }

  private renderVoxelsToPixels(
    pixels: Uint8Array,
    width: number,
    height: number,
    voxelAsset: any
  ): void {
    const [vw, vh, vd] = voxelAsset.dimensions;

    // Calculate scale to fit voxels in output
    const scaleX = (width * 0.8) / vw;
    const scaleY = (height * 0.8) / vh;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = Math.floor((width - vw * scale) / 2);
    const offsetY = Math.floor((height - vh * scale) / 2);

    // Render voxels front to back
    for (const voxel of voxelAsset.voxels) {
      const [vx, vy, vz] = voxel.position;
      const color = this.hexToRgb(voxel.color);

      const px = offsetX + Math.floor(vx * scale);
      const py = offsetY + Math.floor((vh - 1 - vy) * scale); // Flip Y
      const pw = Math.ceil(scale);
      const ph = Math.ceil(scale);

      this.fillRectangle(pixels, width, px, py, pw, ph, color);
    }
  }

  private renderMeshToPixels(
    pixels: Uint8Array,
    width: number,
    height: number,
    meshAsset: any
  ): void {
    // Simplified mesh rendering
    // In production, would use proper rasterization
    const vertices = meshAsset.mesh.vertices;

    if (vertices.length === 0) return;

    // Find bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      maxX = Math.max(maxX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      maxY = Math.max(maxY, vertices[i + 1]);
    }

    // Scale and render
    const scaleX = (width * 0.8) / (maxX - minX);
    const scaleY = (height * 0.8) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxY - minY) * scale) / 2;

    // Simple point cloud rendering
    const primaryColor = meshAsset.materials[0]?.albedo || '#808080';
    const color = this.hexToRgb(primaryColor);

    for (let i = 0; i < vertices.length; i += 3) {
      const x = Math.floor(offsetX + (vertices[i] - minX) * scale);
      const y = Math.floor(offsetY + (vertices[i + 1] - minY) * scale);

      if (x >= 0 && x < width && y >= 0 && y < height) {
        const idx = (y * width + x) * 4;
        pixels[idx] = color.r;
        pixels[idx + 1] = color.g;
        pixels[idx + 2] = color.b;
        pixels[idx + 3] = 255;
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private fillRectangle(
    pixels: Uint8Array,
    width: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: { r: number; g: number; b: number }
  ): void {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px >= 0 && px < width && py >= 0 && py < pixels.length / width / 4) {
          const idx = (py * width + px) * 4;
          pixels[idx] = color.r;
          pixels[idx + 1] = color.g;
          pixels[idx + 2] = color.b;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  private fillEllipse(
    pixels: Uint8Array,
    width: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
    color: { r: number; g: number; b: number }
  ): void {
    const rx = w / 2;
    const ry = h / 2;

    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
          const px = Math.floor(cx + rx + dx);
          const py = Math.floor(cy + ry + dy);

          if (px >= 0 && px < width && py >= 0 && py < pixels.length / width / 4) {
            const idx = (py * width + px) * 4;
            pixels[idx] = color.r;
            pixels[idx + 1] = color.g;
            pixels[idx + 2] = color.b;
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  }

  private fillRoundedRectangle(
    pixels: Uint8Array,
    width: number,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number,
    color: { r: number; g: number; b: number }
  ): void {
    // Center
    this.fillRectangle(pixels, width, x + radius, y, w - 2 * radius, h, color);
    this.fillRectangle(pixels, width, x, y + radius, radius, h - 2 * radius, color);
    this.fillRectangle(pixels, width, x + w - radius, y + radius, radius, h - 2 * radius, color);

    // Corners
    const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
      for (let py = -radius; py < radius; py++) {
        for (let px = -radius; px < radius; px++) {
          const dist = Math.sqrt(px * px + py * py);
          if (dist <= radius) {
            const posX = cx + dx * px;
            const posY = cy + dy * py;
            if (posX >= 0 && posX < width && posY >= 0 && posY < pixels.length / width / 4) {
              const idx = (posY * width + posX) * 4;
              pixels[idx] = color.r;
              pixels[idx + 1] = color.g;
              pixels[idx + 2] = color.b;
              pixels[idx + 3] = 255;
            }
          }
        }
      }
    };

    drawCorner(x + radius, y + radius, 1, 1);
    drawCorner(x + w - radius - 1, y + radius, -1, 1);
    drawCorner(x + radius, y + h - radius - 1, 1, -1);
    drawCorner(x + w - radius - 1, y + h - radius - 1, -1, -1);
  }

  private calculateTargetDimensions(
    sourceWidth: number,
    sourceHeight: number,
    style: SpriteStyle
  ): [number, number] {
    const aspectRatio = sourceWidth / sourceHeight;

    let baseSize: number;
    switch (style) {
      case SpriteStyle.NES_8BIT:
        baseSize = 32;
        break;
      case SpriteStyle.SNES_16BIT:
      case SpriteStyle.GENESIS_16BIT:
        baseSize = 64;
        break;
      case SpriteStyle.MODERN_PIXEL:
        baseSize = 128;
        break;
      default:
        baseSize = 64;
    }

    if (aspectRatio > 1) {
      return [baseSize, Math.floor(baseSize / aspectRatio)];
    } else {
      return [Math.floor(baseSize * aspectRatio), baseSize];
    }
  }

  private calculateSpriteSheetLayout(
    frames: SpriteFrame[],
    dimensions: [number, number]
  ): { width: number; height: number; frames: number; rows: number; columns: number } {
    const frameCount = frames.length;
    const maxColumns = 16;

    let columns = Math.min(frameCount, maxColumns);
    let rows = Math.ceil(frameCount / columns);

    return {
      width: dimensions[0] * columns,
      height: dimensions[1] * rows,
      frames: frameCount,
      rows,
      columns
    };
  }

  private generateDefaultAnimations(frameCount: number): SpriteAnimation[] {
    const animations: SpriteAnimation[] = [];

    if (frameCount > 1) {
      animations.push({
        name: 'idle',
        frames: Array.from({ length: frameCount }, (_, i) => i),
        loop: true,
        speed: 1
      });
    }

    return animations;
  }

  private async saveSpriteAsset(asset: MicroVerseAsset, customPath?: string): Promise<void> {
    const outputPath = customPath || this.outputDirectory;
    const assetDir = path.join(outputPath, asset.id);

    await fs.mkdir(assetDir, { recursive: true });

    // Save metadata
    const metadataPath = path.join(assetDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(asset, null, 2));

    // Save frames
    for (const frame of asset.frames) {
      const framePath = path.join(assetDir, `frame_${frame.index}.png`);
      const buffer = Buffer.from(frame.imageData, 'base64');
      await fs.writeFile(framePath, buffer);
    }

    // Generate and save sprite sheet if multiple frames
    if (asset.frames.length > 1) {
      await this.generateSpriteSheet(asset, assetDir);
    }
  }

  private async generateSpriteSheet(asset: MicroVerseAsset, outputDir: string): Promise<void> {
    const { columns, rows, width, height } = asset.spriteSheet;

    // Create composite sprite sheet
    const composites = [];

    for (const frame of asset.frames) {
      const frameBuffer = Buffer.from(frame.imageData, 'base64');
      composites.push({ input: frameBuffer });
    }

    const spriteSheet = sharp({
      create: {
        width: asset.spriteSheet.width,
        height: asset.spriteSheet.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Composite frames
    let currentComposite = spriteSheet;
    for (let i = 0; i < asset.frames.length; i++) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const frame = asset.frames[i];

      currentComposite = currentComposite.composite([{
        input: Buffer.from(frame.imageData, 'base64'),
        left: col * frame.width,
        top: row * frame.height
      }]);
    }

    const buffer = await currentComposite.png().toBuffer();
    await fs.writeFile(path.join(outputDir, 'spritesheet.png'), buffer);
  }

  private async ensureOutputDirectory(): Promise<void> {
    await fs.mkdir(this.outputDirectory, { recursive: true });
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  }
}
