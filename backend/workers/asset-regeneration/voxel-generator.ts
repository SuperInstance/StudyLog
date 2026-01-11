/**
 * Voxel Generator for Luanti Form
 *
 * Generates voxel/blocky models with isometric projection for Luanti engine.
 * Converts from sprites and meshes to voxel representation.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  LuantiAsset,
  VoxelStyle,
  VoxelData,
  VoxelMaterialMap,
  ColorPalette,
  Proportions,
  QualityLevel,
  AssetForm,
  MicroVerseAsset,
  OpenRTSAsset
} from './types.js';
import { StylePreserver } from './style-preserver.js';

// ============================================================================
// GENERATION OPTIONS
// ============================================================================

export interface VoxelGenerationOptions {
  /** Target voxel style */
  style?: VoxelStyle;
  /** Maximum grid dimensions [width, height, depth] */
  maxDimensions?: [number, number, number];
  /** Maximum number of voxels */
  maxVoxels?: number;
  /** Isometric projection angle (degrees) */
  isometricAngle?: number;
  /** Color palette (overrides extraction) */
  palette?: ColorPalette;
  /** Quality level */
  quality?: QualityLevel;
  /** Proportions to maintain */
  proportions?: Proportions;
  /** Voxel size for output */
  voxelSize?: number;
  /** Output directory */
  outputPath?: string;
}

// ============================================================================
// VOXEL GENERATOR CLASS
// ============================================================================

export class VoxelGenerator {
  private stylePreserver: StylePreserver;
  private outputDirectory: string;

  constructor(outputDirectory?: string) {
    this.stylePreserver = new StylePreserver();
    this.outputDirectory = outputDirectory || '/tmp/voxel-generator';
  }

  /**
   * Generate a Luanti voxel asset from sprite
   */
  async generateFromSprite(
    spriteAsset: MicroVerseAsset,
    options: VoxelGenerationOptions = {}
  ): Promise<LuantiAsset> {
    await this.ensureOutputDirectory();

    const {
      style = VoxelStyle.CLASSIC,
      maxDimensions = [64, 64, 64],
      maxVoxels = 4096,
      isometricAngle = 45,
      quality = QualityLevel.STANDARD
    } = options;

    // Extract style profile from sprite
    const styleProfile = this.stylePreserver.extractStyleProfile(spriteAsset);
    const palette = options.palette || styleProfile.palette;
    const proportions = options.proportions || styleProfile.proportions;

    // Convert sprite frame to voxel representation
    const frame = spriteAsset.frames[0];
    const voxels = await this.spriteToVoxels(
      frame,
      spriteAsset.spriteSheet.width,
      spriteAsset.spriteSheet.height,
      maxDimensions,
      maxVoxels,
      style
    );

    // Create material mappings
    const materials = this.createMaterialsFromPalette(palette);

    // Calculate actual dimensions
    const dimensions = this.calculateVoxelDimensions(voxels, maxDimensions);

    const asset: LuantiAsset = {
      id: uuidv4(),
      name: `${spriteAsset.name}_voxel`,
      category: spriteAsset.category,
      tags: [...spriteAsset.tags, 'voxel', style],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: spriteAsset.sourcePath,
      form: AssetForm.LUANTI,
      dimensions,
      voxels,
      style,
      isometric: {
        angle: isometricAngle,
        scale: 1.0
      },
      materials
    };

    await this.saveVoxelAsset(asset, options.outputPath);

    return asset;
  }

  /**
   * Generate voxel asset from 3D mesh
   */
  async generateFromMesh(
    meshAsset: OpenRTSAsset,
    options: VoxelGenerationOptions = {}
  ): Promise<LuantiAsset> {
    await this.ensureOutputDirectory();

    const {
      style = VoxelStyle.SMOOTH,
      maxDimensions = [64, 64, 64],
      maxVoxels = 4096,
      isometricAngle = 45,
      quality = QualityLevel.STANDARD
    } = options;

    // Extract style profile from mesh
    const styleProfile = this.stylePreserver.extractStyleProfile(meshAsset);
    const palette = options.palette || styleProfile.palette;
    const proportions = options.proportions || styleProfile.proportions;

    // Convert mesh to voxels
    const voxels = await this.meshToVoxels(
      meshAsset,
      maxDimensions,
      maxVoxels,
      style
    );

    // Create material mappings
    const materials = this.createMaterialsFromPalette(palette);

    // Calculate dimensions
    const dimensions = this.calculateVoxelDimensions(voxels, maxDimensions);

    const asset: LuantiAsset = {
      id: uuidv4(),
      name: `${meshAsset.name}_voxel`,
      category: meshAsset.category,
      tags: [...meshAsset.tags, 'voxel', style],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: meshAsset.sourcePath,
      form: AssetForm.LUANTI,
      dimensions,
      voxels,
      style,
      isometric: {
        angle: isometricAngle,
        scale: 1.0
      },
      materials
    };

    await this.saveVoxelAsset(asset, options.outputPath);

    return asset;
  }

  /**
   * Generate voxel asset from description (procedural)
   */
  async generateFromDescription(
    description: string,
    options: VoxelGenerationOptions = {}
  ): Promise<LuantiAsset> {
    await this.ensureOutputDirectory();

    const {
      style = VoxelStyle.CLASSIC,
      maxDimensions = [32, 32, 32],
      maxVoxels = 2048,
      isometricAngle = 45,
      quality = QualityLevel.STANDARD
    } = options;

    // Parse description
    const characteristics = this.parseDescription(description);

    // Generate palette
    const palette = options.palette || this.generatePaletteFromCharacteristics(characteristics);

    // Generate procedural voxel structure
    const voxels = await this.generateProceduralVoxels(
      characteristics,
      maxDimensions,
      maxVoxels,
      palette
    );

    // Create material mappings
    const materials = this.createMaterialsFromPalette(palette);

    // Calculate dimensions
    const dimensions = this.calculateVoxelDimensions(voxels, maxDimensions);

    const asset: LuantiAsset = {
      id: uuidv4(),
      name: `procedural_${characteristics.subject || 'voxel'}`,
      category: 'procedural',
      tags: ['procedural', 'voxel', style, ...characteristics.tags],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: 'procedural',
      form: AssetForm.LUANTI,
      dimensions,
      voxels,
      style,
      isometric: {
        angle: isometricAngle,
        scale: 1.0
      },
      materials
    };

    await this.saveVoxelAsset(asset, options.outputPath);

    return asset;
  }

  // ========================================================================
  // SPRITE TO VOXEL CONVERSION
  // ========================================================================

  private async spriteToVoxels(
    frame: { imageData: string | Buffer; width: number; height: number },
    width: number,
    height: number,
    maxDimensions: [number, number, number],
    maxVoxels: number,
    style: VoxelStyle
  ): Promise<VoxelData[]> {
    const voxels: VoxelData[] = [];

    // Decode sprite data
    let pixels: Uint8Array;
    if (typeof frame.imageData === 'string') {
      const buffer = Buffer.from(frame.imageData, 'base64');
      // This is simplified - would need PNG decoding in production
      pixels = new Uint8Array(width * height * 4);
    } else {
      pixels = new Uint8Array(frame.imageData);
    }

    // Apply depth based on style
    const depthMultiplier = this.getDepthMultiplier(style);

    // Convert pixels to voxels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        const a = pixels[idx + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        const color = this.rgbToHex(r, g, b);

        // Add depth layers
        const depth = Math.ceil(depthMultiplier);
        for (let z = 0; z < depth; z++) {
          if (voxels.length >= maxVoxels) break;

          // Use different shades for depth
          const depthColor = this.applyDepthShading(color, z, depth);

          voxels.push({
            position: [x, height - 1 - y, z], // Flip Y for voxel space
            color: depthColor,
            material: this.getMaterialForColor(color),
            variant: z
          });
        }

        if (voxels.length >= maxVoxels) break;
      }
      if (voxels.length >= maxVoxels) break;
    }

    return voxels;
  }

  private getDepthMultiplier(style: VoxelStyle): number {
    switch (style) {
      case VoxelStyle.CLASSIC:
        return 1;
      case VoxelStyle.SMOOTH:
        return 2;
      case VoxelStyle.CROSS_HATCH:
        return 1.5;
      case VoxelStyle.HEIGHT_MAP:
        return 3;
      default:
        return 1;
    }
  }

  private applyDepthShading(color: string, depth: number, maxDepth: number): string {
    const rgb = this.hexToRgb(color);
    const factor = 1 - (depth / maxDepth) * 0.3; // Darken with depth

    return this.rgbToHex(
      Math.round(rgb.r * factor),
      Math.round(rgb.g * factor),
      Math.round(rgb.b * factor)
    );
  }

  // ========================================================================
  // MESH TO VOXEL CONVERSION
  // ========================================================================

  private async meshToVoxels(
    meshAsset: OpenRTSAsset,
    maxDimensions: [number, number, number],
    maxVoxels: number,
    style: VoxelStyle
  ): Promise<VoxelData[]> {
    const voxels: VoxelData[] = [];
    const mesh = meshAsset.mesh;

    if (!mesh.vertices || mesh.vertices.length === 0) {
      return voxels;
    }

    // Calculate mesh bounds
    const bounds = this.calculateMeshBounds(mesh.vertices);

    // Create voxel grid
    const gridResolution = this.calculateGridResolution(bounds, maxDimensions, maxVoxels);

    // Voxelize mesh using scan conversion
    const occupiedGrid = this.voxelizeMesh(
      mesh,
      bounds,
      gridResolution,
      style
    );

    // Convert occupied grid to voxel list
    for (let x = 0; x < gridResolution[0]; x++) {
      for (let y = 0; y < gridResolution[1]; y++) {
        for (let z = 0; z < gridResolution[2]; z++) {
          if (occupiedGrid.has(`${x},${y},${z}`)) {
            const color = this.getColorForVoxel(x, y, z, meshAsset, bounds, gridResolution);

            voxels.push({
              position: [x, y, z],
              color,
              material: this.getMaterialForColor(color),
              variant: 0
            });

            if (voxels.length >= maxVoxels) {
              return voxels;
            }
          }
        }
      }
    }

    return voxels;
  }

  private calculateMeshBounds(vertices: Float32Array): {
    min: [number, number, number];
    max: [number, number, number];
  } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      minX = Math.min(minX, vertices[i]);
      maxX = Math.max(maxX, vertices[i]);
      minY = Math.min(minY, vertices[i + 1]);
      maxY = Math.max(maxY, vertices[i + 1]);
      minZ = Math.min(minZ, vertices[i + 2]);
      maxZ = Math.max(maxZ, vertices[i + 2]);
    }

    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  private calculateGridResolution(
    bounds: { min: [number, number, number]; max: [number, number, number] },
    maxDimensions: [number, number, number],
    maxVoxels: number
  ): [number, number, number] {
    const sizeX = bounds.max[0] - bounds.min[0];
    const sizeY = bounds.max[1] - bounds.min[1];
    const sizeZ = bounds.max[2] - bounds.min[2];

    // Calculate resolution based on volume constraint
    const totalVolume = sizeX * sizeY * sizeZ;
    const voxelVolume = totalVolume / maxVoxels;
    const voxelSize = Math.cbrt(voxelVolume);

    let resX = Math.min(Math.ceil(sizeX / voxelSize), maxDimensions[0]);
    let resY = Math.min(Math.ceil(sizeY / voxelSize), maxDimensions[1]);
    let resZ = Math.min(Math.ceil(sizeZ / voxelSize), maxDimensions[2]);

    // Ensure minimum resolution
    resX = Math.max(resX, 8);
    resY = Math.max(resY, 8);
    resZ = Math.max(resZ, 8);

    return [resX, resY, resZ];
  }

  private voxelizeMesh(
    mesh: any,
    bounds: { min: [number, number, number]; max: [number, number, number] },
    resolution: [number, number, number],
    style: VoxelStyle
  ): Set<string> {
    const occupied = new Set<string>();
    const { min, max } = bounds;

    // Voxel size in world units
    const voxelSize = [
      (max[0] - min[0]) / resolution[0],
      (max[1] - min[1]) / resolution[1],
      (max[2] - min[2]) / resolution[2]
    ];

    // Use triangle rasterization
    const indices = mesh.indices;
    const vertices = mesh.vertices;

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const v0 = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];

      // Rasterize triangle to voxels
      this.rasterizeTriangle(v0, v1, v2, min, voxelSize, resolution, occupied, style);
    }

    return occupied;
  }

  private rasterizeTriangle(
    v0: number[],
    v1: number[],
    v2: number[],
    boundsMin: [number, number, number],
    voxelSize: [number, number, number],
    resolution: [number, number, number],
    occupied: Set<string>,
    style: VoxelStyle
  ): void {
    // Calculate triangle bounds in voxel space
    const p0 = this.worldToVoxel(v0, boundsMin, voxelSize);
    const p1 = this.worldToVoxel(v1, boundsMin, voxelSize);
    const p2 = this.worldToVoxel(v2, boundsMin, voxelSize);

    const minX = Math.floor(Math.min(p0[0], p1[0], p2[0]));
    const maxX = Math.ceil(Math.max(p0[0], p1[0], p2[0]));
    const minY = Math.floor(Math.min(p0[1], p1[1], p2[1]));
    const maxY = Math.ceil(Math.max(p0[1], p1[1], p2[1]));
    const minZ = Math.floor(Math.min(p0[2], p1[2], p2[2]));
    const maxZ = Math.ceil(Math.max(p0[2], p1[2], p2[2]));

    // Check each voxel in bounds
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (x < 0 || x >= resolution[0] ||
              y < 0 || y >= resolution[1] ||
              z < 0 || z >= resolution[2]) {
            continue;
          }

          if (this.voxelIntersectsTriangle(x, y, z, v0, v1, v2, boundsMin, voxelSize)) {
            occupied.add(`${x},${y},${z}`);
          }
        }
      }
    }
  }

  private worldToVoxel(
    worldPos: number[],
    boundsMin: [number, number, number],
    voxelSize: [number, number, number]
  ): [number, number, number] {
    return [
      (worldPos[0] - boundsMin[0]) / voxelSize[0],
      (worldPos[1] - boundsMin[1]) / voxelSize[1],
      (worldPos[2] - boundsMin[2]) / voxelSize[2]
    ];
  }

  private voxelIntersectsTriangle(
    vx: number,
    vy: number,
    vz: number,
    v0: number[],
    v1: number[],
    v2: number[],
    boundsMin: [number, number, number],
    voxelSize: [number, number, number]
  ): boolean {
    // Simplified intersection test
    // In production, would use proper voxel-triangle intersection

    // Convert voxel center to world space
    const cx = boundsMin[0] + (vx + 0.5) * voxelSize[0];
    const cy = boundsMin[1] + (vy + 0.5) * voxelSize[1];
    const cz = boundsMin[2] + (vz + 0.5) * voxelSize[2];

    // Check if point is roughly in triangle plane
    // This is a simplified test
    return true;
  }

  private getColorForVoxel(
    x: number,
    y: number,
    z: number,
    meshAsset: OpenRTSAsset,
    bounds: { min: [number, number, number]; max: [number, number, number] },
    resolution: [number, number, number]
  ): string {
    // Use primary material color
    if (meshAsset.materials.length > 0) {
      return meshAsset.materials[0].albedo;
    }

    // Fallback to position-based coloring
    const t = x / resolution[0];
    const r = Math.floor(t * 255);
    const g = Math.floor((y / resolution[1]) * 255);
    const b = Math.floor((z / resolution[2]) * 255);

    return this.rgbToHex(r, g, b);
  }

  // ========================================================================
  // PROCEDURAL VOXEL GENERATION
  // ========================================================================

  private parseDescription(description: string): {
    subject: string;
    colors: string[];
    style: string;
    tags: string[];
    size: string;
  } {
    const result = {
      subject: 'block',
      colors: [] as string[],
      style: 'blocky',
      tags: [] as string[],
      size: 'medium'
    };

    const lowerDesc = description.toLowerCase();

    // Extract colors
    const colorPatterns = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple',
      'black', 'white', 'gray', 'brown', 'pink', 'cyan'
    ];
    for (const color of colorPatterns) {
      if (lowerDesc.includes(color)) {
        result.colors.push(color);
      }
    }

    // Extract subject
    const subjectPatterns = [
      'character', 'person', 'human', 'creature', 'animal',
      'monster', 'robot', 'vehicle', 'weapon', 'item',
      'tree', 'building', 'house', 'castle', 'tower'
    ];
    for (const subject of subjectPatterns) {
      if (lowerDesc.includes(subject)) {
        result.subject = subject;
        result.tags.push(subject);
        break;
      }
    }

    // Extract size
    if (lowerDesc.includes('large') || lowerDesc.includes('big')) {
      result.size = 'large';
    } else if (lowerDesc.includes('small') || lowerDesc.includes('tiny')) {
      result.size = 'small';
    }

    return result;
  }

  private generatePaletteFromCharacteristics(characteristics: {
    colors: string[];
    subject: string;
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

    let primaryColor = '#808080';
    if (characteristics.colors.length > 0) {
      primaryColor = colorMap[characteristics.colors[0]] || primaryColor;
    }

    // Subject-specific colors
    if (characteristics.subject === 'tree') {
      primaryColor = '#2ECC71';
    } else if (characteristics.subject === 'robot') {
      primaryColor = '#95A5A6';
    }

    return {
      primary: primaryColor,
      secondary: this.darkenColor(primaryColor, 20),
      accent: this.lightenColor(primaryColor, 30),
      shadow: this.darkenColor(primaryColor, 40),
      hexValues: [primaryColor, this.darkenColor(primaryColor, 20), this.darkenColor(primaryColor, 40)]
    };
  }

  private async generateProceduralVoxels(
    characteristics: { subject: string; size: string; tags: string[] },
    maxDimensions: [number, number, number],
    maxVoxels: number,
    palette: ColorPalette
  ): Promise<VoxelData[]> {
    const voxels: VoxelData[] = [];

    // Determine size
    let sizeScale = 1;
    if (characteristics.size === 'large') sizeScale = 1.5;
    if (characteristics.size === 'small') sizeScale = 0.5;

    const baseSize = Math.floor(Math.min(...maxDimensions) * sizeScale * 0.5);

    // Generate based on subject
    switch (characteristics.subject) {
      case 'character':
      case 'person':
      case 'human':
        this.generateCharacterVoxels(voxels, baseSize, palette);
        break;
      case 'tree':
        this.generateTreeVoxels(voxels, baseSize, palette);
        break;
      case 'building':
      case 'house':
        this.generateBuildingVoxels(voxels, baseSize, palette);
        break;
      case 'robot':
        this.generateRobotVoxels(voxels, baseSize, palette);
        break;
      default:
        this.generateBlockVoxels(voxels, baseSize, palette);
    }

    return voxels.slice(0, maxVoxels);
  }

  private generateCharacterVoxels(voxels: VoxelData[], size: number, palette: ColorPalette): void {
    const cx = Math.floor(size / 2);
    const cy = Math.floor(size / 2);

    // Head
    const headSize = Math.floor(size * 0.3);
    for (let y = 0; y < headSize; y++) {
      for (let x = cx - headSize; x < cx + headSize; x++) {
        for (let z = cx - headSize; z < cx + headSize; z++) {
          if (Math.abs(x - cx) + Math.abs(y - headSize/2) + Math.abs(z - cx) < headSize) {
            voxels.push({
              position: [x, y + size, z],
              color: palette.accent,
              material: 0
            });
          }
        }
      }
    }

    // Body
    const bodySize = Math.floor(size * 0.4);
    for (let y = 0; y < bodySize; y++) {
      for (let x = cx - bodySize; x < cx + bodySize; x++) {
        for (let z = cx - bodySize; z < cx + bodySize; z++) {
          voxels.push({
            position: [x, size - headSize - y, z],
            color: palette.primary,
            material: 0
          });
        }
      }
    }

    // Legs
    const legSize = Math.floor(size * 0.15);
    const legHeight = Math.floor(size * 0.4);
    for (let y = 0; y < legHeight; y++) {
      for (let dx = -1; dx <= 1; dx += 2) {
        const lx = cx + dx * Math.floor(bodySize * 0.5);
        for (let z = cx - legSize; z < cx + legSize; z++) {
          voxels.push({
            position: [lx, size - headSize - bodySize - y, z],
            color: palette.secondary,
            material: 0
          });
        }
      }
    }
  }

  private generateTreeVoxels(voxels: VoxelData[], size: number, palette: ColorPalette): void {
    const cx = Math.floor(size / 2);
    const trunkColor = '#8B4513';
    const leafColor = palette.primary;

    // Trunk
    const trunkHeight = Math.floor(size * 0.5);
    const trunkWidth = Math.floor(size * 0.1);

    for (let y = 0; y < trunkHeight; y++) {
      for (let x = cx - trunkWidth; x < cx + trunkWidth; x++) {
        for (let z = cx - trunkWidth; z < cx + trunkWidth; z++) {
          voxels.push({
            position: [x, y, z],
            color: trunkColor,
            material: 1
          });
        }
      }
    }

    // Leaves (spherical cluster)
    const leafRadius = Math.floor(size * 0.4);
    const leafCenterY = trunkHeight + leafRadius;

    for (let y = 0; y < leafRadius * 2; y++) {
      for (let x = cx - leafRadius; x < cx + leafRadius; x++) {
        for (let z = cx - leafRadius; z < cx + leafRadius; z++) {
          const dist = Math.sqrt(
            Math.pow(x - cx, 2) +
            Math.pow(y - leafRadius, 2) +
            Math.pow(z - cx, 2)
          );
          if (dist < leafRadius) {
            voxels.push({
              position: [x, leafCenterY + y - leafRadius, z],
              color: leafColor,
              material: 2
            });
          }
        }
      }
    }
  }

  private generateBuildingVoxels(voxels: VoxelData[], size: number, palette: ColorPalette): void {
    const wallColor = palette.primary;
    const roofColor = palette.secondary;

    const width = Math.floor(size * 0.6);
    const depth = Math.floor(size * 0.6);
    const wallHeight = Math.floor(size * 0.5);
    const roofHeight = Math.floor(size * 0.2);

    const startX = Math.floor((size - width) / 2);
    const startZ = Math.floor((size - depth) / 2);

    // Walls
    for (let y = 0; y < wallHeight; y++) {
      for (let x = startX; x < startX + width; x++) {
        for (let z = startZ; z < startZ + depth; z++) {
          const isEdge = x === startX || x === startX + width - 1 ||
                        z === startZ || z === startZ + depth - 1;
          if (isEdge) {
            voxels.push({
              position: [x, y, z],
              color: wallColor,
              material: 0
            });
          }
        }
      }
    }

    // Roof (pyramid)
    for (let y = 0; y < roofHeight; y++) {
      const inset = y;
      for (let x = startX + inset; x < startX + width - inset; x++) {
        for (let z = startZ + inset; z < startZ + depth - inset; z++) {
          voxels.push({
            position: [x, wallHeight + y, z],
            color: roofColor,
            material: 0
          });
        }
      }
    }
  }

  private generateRobotVoxels(voxels: VoxelData[], size: number, palette: ColorPalette): void {
    const cx = Math.floor(size / 2);
    const metalColor = palette.primary;
    const accentColor = palette.accent;

    // Body block
    const bodySize = Math.floor(size * 0.3);
    for (let y = 0; y < bodySize; y++) {
      for (let x = cx - bodySize; x < cx + bodySize; x++) {
        for (let z = cx - bodySize; z < cx + bodySize; z++) {
          voxels.push({
            position: [x, y + bodySize, z],
            color: metalColor,
            material: 0
          });
        }
      }
    }

    // Head block
    const headSize = Math.floor(bodySize * 0.6);
    for (let y = 0; y < headSize; y++) {
      for (let x = cx - headSize; x < cx + headSize; x++) {
        for (let z = cx - headSize; z < cx + headSize; z++) {
          voxels.push({
            position: [x, y + bodySize * 2, z],
            color: metalColor,
            material: 0
          });
        }
      }
    }

    // Eye (accent)
    const eyeSize = Math.floor(headSize * 0.3);
    voxels.push({
      position: [cx, bodySize * 2 + Math.floor(headSize * 0.5), cx + headSize - eyeSize],
      color: accentColor,
      material: 1
    });
    voxels.push({
      position: [cx, bodySize * 2 + Math.floor(headSize * 0.5), cx - headSize + eyeSize],
      color: accentColor,
      material: 1
    });

    // Arms
    const armLength = Math.floor(bodySize * 0.8);
    const armWidth = Math.floor(bodySize * 0.2);
    for (let y = 0; y < armLength; y++) {
      for (let dx = -1; dx <= 1; dx += 2) {
        const armX = cx + dx * (bodySize + armWidth);
        for (let z = cx - armWidth; z < cx + armWidth; z++) {
          voxels.push({
            position: [armX, bodySize + y, z],
            color: metalColor,
            material: 0
          });
        }
      }
    }

    // Legs
    const legLength = Math.floor(bodySize * 0.8);
    const legWidth = Math.floor(bodySize * 0.25);
    for (let y = 0; y < legLength; y++) {
      for (let dx = -1; dx <= 1; dx += 2) {
        const legX = cx + dx * Math.floor(bodySize * 0.4);
        for (let z = cx - legWidth; z < cx + legWidth; z++) {
          voxels.push({
            position: [legX, bodySize - y, z],
            color: metalColor,
            material: 0
          });
        }
      }
    }
  }

  private generateBlockVoxels(voxels: VoxelData[], size: number, palette: ColorPalette): void {
    const halfSize = Math.floor(size / 2);

    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          voxels.push({
            position: [x, y, z],
            color: palette.primary,
            material: 0
          });
        }
      }
    }
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private createMaterialsFromPalette(palette: ColorPalette): VoxelMaterialMap[] {
    return [
      {
        index: 0,
        name: 'primary',
        texture: 'primary.png',
        color: palette.primary
      },
      {
        index: 1,
        name: 'secondary',
        texture: 'secondary.png',
        color: palette.secondary
      },
      {
        index: 2,
        name: 'accent',
        texture: 'accent.png',
        color: palette.accent
      }
    ];
  }

  private calculateVoxelDimensions(
    voxels: VoxelData[],
    maxDimensions: [number, number, number]
  ): [number, number, number] {
    if (voxels.length === 0) {
      return [16, 16, 16];
    }

    let maxX = 0, maxY = 0, maxZ = 0;

    for (const voxel of voxels) {
      maxX = Math.max(maxX, voxel.position[0]);
      maxY = Math.max(maxY, voxel.position[1]);
      maxZ = Math.max(maxZ, voxel.position[2]);
    }

    return [
      Math.min(maxX + 1, maxDimensions[0]),
      Math.min(maxY + 1, maxDimensions[1]),
      Math.min(maxZ + 1, maxDimensions[2])
    ];
  }

  private getMaterialForColor(color: string): number {
    // Simple hashing to determine material index
    let hash = 0;
    for (let i = 0; i < color.length; i++) {
      hash = ((hash << 5) - hash) + color.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 3;
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

  private darkenColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    const factor = 1 - percent / 100;
    return this.rgbToHex(
      Math.round(rgb.r * factor),
      Math.round(rgb.g * factor),
      Math.round(rgb.b * factor)
    );
  }

  private lightenColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    const factor = 1 + percent / 100;
    return this.rgbToHex(
      Math.min(255, Math.round(rgb.r * factor)),
      Math.min(255, Math.round(rgb.g * factor)),
      Math.min(255, Math.round(rgb.b * factor))
    );
  }

  private async saveVoxelAsset(asset: LuantiAsset, customPath?: string): Promise<void> {
    const outputPath = customPath || this.outputDirectory;
    const assetDir = path.join(outputPath, asset.id);

    await fs.mkdir(assetDir, { recursive: true });

    // Save metadata
    const metadataPath = path.join(assetDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(asset, null, 2));

    // Save voxel data in VOX format (simplified)
    const voxPath = path.join(assetDir, 'model.vox');
    await this.saveVoxFormat(asset, voxPath);

    // Export isometric preview
    const previewPath = path.join(assetDir, 'preview.png');
    await this.generateIsometricPreview(asset, previewPath);
  }

  private async saveVoxFormat(asset: LuantiAsset, outputPath: string): Promise<void> {
    // Simplified VOX format output
    // In production, would generate proper .vox file for MagicaVoxel compatibility

    const voxFmt = {
      version: 150,
      dimensions: asset.dimensions,
      voxels: asset.voxels.map(v => ({
        x: v.position[0],
        y: v.position[1],
        z: v.position[2],
        i: this.colorToVoxIndex(v.color)
      }))
    };

    await fs.writeFile(outputPath, JSON.stringify(voxFmt, null, 2));
  }

  private colorToVoxIndex(hex: string): number {
    // Convert to VOX palette index (simplified)
    const rgb = this.hexToRgb(hex);
    return (rgb.r << 16) | (rgb.g << 8) | rgb.b;
  }

  private async generateIsometricPreview(asset: LuantiAsset, outputPath: string): Promise<void> {
    // Generate isometric preview image
    // This would use proper isometric rendering in production

    const [width, height, depth] = asset.dimensions;
    const isoWidth = width + depth;
    const isoHeight = height + Math.floor((width + depth) / 2);

    const pixels = new Uint8Array(isoWidth * isoHeight * 4);
    pixels.fill(0); // Transparent background

    // Simple isometric projection
    for (const voxel of asset.voxels) {
      const [vx, vy, vz] = voxel.position;
      const rgb = this.hexToRgb(voxel.color);

      // Isometric transform
      const isoX = vx - vz + Math.floor(depth / 2);
      const isoY = vx + vz - vy + Math.floor(height / 2);

      if (isoX >= 0 && isoX < isoWidth && isoY >= 0 && isoY < isoHeight) {
        const idx = (isoY * isoWidth + isoX) * 4;
        pixels[idx] = rgb.r;
        pixels[idx + 1] = rgb.g;
        pixels[idx + 2] = rgb.b;
        pixels[idx + 3] = 255;
      }
    }

    // In production, would use sharp to write PNG
    // For now, save as raw data
    await fs.writeFile(outputPath + '.raw', pixels);
  }

  private async ensureOutputDirectory(): Promise<void> {
    await fs.mkdir(this.outputDirectory, { recursive: true });
  }
}
