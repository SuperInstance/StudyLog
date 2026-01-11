/**
 * Mesh Generator for OpenRTS Form
 *
 * Generates full 3D mesh assets with PS2+ quality for OpenRTS engine.
 * Supports skeletal animation, LOD levels, and modern PBR materials.
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  OpenRTSAsset,
  MeshStyle,
  MeshData,
  MeshMaterial,
  SkeletonData,
  Bone,
  MeshAnimation,
  AnimationTrack,
  LODLevel,
  ColorPalette,
  Proportions,
  QualityLevel,
  AssetForm,
  MicroVerseAsset,
  LuantiAsset
} from './types.js';
import { StylePreserver } from './style-preserver.js';

// ============================================================================
// GENERATION OPTIONS
// ============================================================================

export interface MeshGenerationOptions {
  /** Target mesh style */
  style?: MeshStyle;
  /** Maximum triangle count */
  maxTriangles?: number;
  /** Maximum bone count for skeleton */
  maxBones?: number;
  /** Include skeleton/rigging */
  includeSkeleton?: boolean;
  /** Number of LOD levels */
  lodLevels?: number;
  /** Color palette (overrides extraction) */
  palette?: ColorPalette;
  /** Quality level */
  quality?: QualityLevel;
  /** Proportions to maintain */
  proportions?: Proportions;
  /** Output directory */
  outputPath?: string;
  /** Export format */
  exportFormat?: 'gltf' | 'obj' | 'fbx';
}

// ============================================================================
// MESH GENERATOR CLASS
// ============================================================================

export class MeshGenerator {
  private stylePreserver: StylePreserver;
  private outputDirectory: string;

  constructor(outputDirectory?: string) {
    this.stylePreserver = new StylePreserver();
    this.outputDirectory = outputDirectory || '/tmp/mesh-generator';
  }

  /**
   * Generate an OpenRTS mesh asset from sprite
   */
  async generateFromSprite(
    spriteAsset: MicroVerseAsset,
    options: MeshGenerationOptions = {}
  ): Promise<OpenRTSAsset> {
    await this.ensureOutputDirectory();

    const {
      style = MeshStyle.STANDARD,
      maxTriangles = 5000,
      includeSkeleton = true,
      lodLevels = 3,
      quality = QualityLevel.STANDARD
    } = options;

    // Extract style profile
    const styleProfile = this.stylePreserver.extractStyleProfile(spriteAsset);
    const palette = options.palette || styleProfile.palette;
    const proportions = options.proportions || styleProfile.proportions;

    // Extrude sprite to 3D mesh
    const mesh = await this.extrudeSpriteToMesh(
      spriteAsset,
      maxTriangles,
      style
    );

    // Create materials
    const materials = this.createMaterialsFromPalette(palette, styleProfile.materials);

    // Create skeleton if requested
    const skeleton = includeSkeleton
      ? this.createSpriteSkeleton(spriteAsset, proportions)
      : undefined;

    // Create LOD levels
    const lods = lodLevels > 1
      ? await this.generateLODLevels(mesh, lodLevels)
      : undefined;

    const asset: OpenRTSAsset = {
      id: uuidv4(),
      name: `${spriteAsset.name}_mesh`,
      category: spriteAsset.category,
      tags: [...spriteAsset.tags, 'mesh', style],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: spriteAsset.sourcePath,
      form: AssetForm.OPENRTS,
      style,
      mesh,
      materials,
      skeleton,
      lods
    };

    await this.saveMeshAsset(asset, options.outputPath, options.exportFormat);

    return asset;
  }

  /**
   * Generate mesh asset from voxels
   */
  async generateFromVoxels(
    voxelAsset: LuantiAsset,
    options: MeshGenerationOptions = {}
  ): Promise<OpenRTSAsset> {
    await this.ensureOutputDirectory();

    const {
      style = MeshStyle.LOW_POLY,
      maxTriangles = 5000,
      includeSkeleton = false,
      lodLevels = 3,
      quality = QualityLevel.STANDARD
    } = options;

    // Extract style profile
    const styleProfile = this.stylePreserver.extractStyleProfile(voxelAsset);
    const palette = options.palette || styleProfile.palette;
    const proportions = options.proportions || styleProfile.proportions;

    // Convert voxels to mesh
    const mesh = await this.voxelsToMesh(
      voxelAsset,
      maxTriangles,
      style
    );

    // Create materials
    const materials = this.createMaterialsFromPalette(palette, styleProfile.materials);

    // LOD levels
    const lods = lodLevels > 1
      ? await this.generateLODLevels(mesh, lodLevels)
      : undefined;

    const asset: OpenRTSAsset = {
      id: uuidv4(),
      name: `${voxelAsset.name}_mesh`,
      category: voxelAsset.category,
      tags: [...voxelAsset.tags, 'mesh', style],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: voxelAsset.sourcePath,
      form: AssetForm.OPENRTS,
      style,
      mesh,
      materials,
      lods
    };

    await this.saveMeshAsset(asset, options.outputPath, options.exportFormat);

    return asset;
  }

  /**
   * Generate mesh asset from description (procedural)
   */
  async generateFromDescription(
    description: string,
    options: MeshGenerationOptions = {}
  ): Promise<OpenRTSAsset> {
    await this.ensureOutputDirectory();

    const {
      style = MeshStyle.STANDARD,
      maxTriangles = 5000,
      includeSkeleton = true,
      lodLevels = 3,
      quality = QualityLevel.STANDARD
    } = options;

    // Parse description
    const characteristics = this.parseDescription(description);

    // Generate palette
    const palette = options.palette || this.generatePaletteFromCharacteristics(characteristics);

    // Generate procedural mesh
    const mesh = await this.generateProceduralMesh(
      characteristics,
      maxTriangles,
      style
    );

    // Create materials
    const materials = this.createMaterialsFromPalette(palette, {
      primary: 'organic',
      metalness: 0,
      roughness: 0.8
    });

    // Create skeleton for character-like objects
    const skeleton = includeSkeleton && this.isCharacterLike(characteristics)
      ? this.createProceduralSkeleton(characteristics)
      : undefined;

    // LOD levels
    const lods = lodLevels > 1
      ? await this.generateLODLevels(mesh, lodLevels)
      : undefined;

    const asset: OpenRTSAsset = {
      id: uuidv4(),
      name: `procedural_${characteristics.subject || 'mesh'}`,
      category: 'procedural',
      tags: ['procedural', 'mesh', style, ...characteristics.tags],
      createdAt: new Date(),
      modifiedAt: new Date(),
      sourcePath: 'procedural',
      form: AssetForm.OPENRTS,
      style,
      mesh,
      materials,
      skeleton,
      lods
    };

    await this.saveMeshAsset(asset, options.outputPath, options.exportFormat);

    return asset;
  }

  /**
   * Optimize an existing mesh for different quality levels
   */
  async optimizeMesh(
    meshAsset: OpenRTSAsset,
    targetStyle: MeshStyle,
    options: Partial<MeshGenerationOptions> = {}
  ): Promise<OpenRTSAsset> {
    const { maxTriangles = this.getTargetTriangleCount(targetStyle) } = options;

    // Simplify mesh to target triangle count
    const optimizedMesh = await this.simplifyMesh(
      meshAsset.mesh,
      maxTriangles,
      targetStyle
    );

    return {
      ...meshAsset,
      id: uuidv4(),
      style: targetStyle,
      mesh: optimizedMesh,
      modifiedAt: new Date()
    };
  }

  // ========================================================================
  // SPRITE TO MESH CONVERSION
  // ========================================================================

  private async extrudeSpriteToMesh(
    spriteAsset: MicroVerseAsset,
    maxTriangles: number,
    style: MeshStyle
  ): Promise<MeshData> {
    const frame = spriteAsset.frames[0];
    const width = frame.width;
    const height = frame.height;

    // Decode pixel data (simplified)
    const pixels = await this.decodeSpritePixels(frame);

    // Create mesh by extruding visible pixels
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    let vertexIndex = 0;
    const extrusionDepth = this.getExtrusionDepth(style);
    const voxelSize = this.getVoxelSize(style, width, height);

    for (let y = 0; y < height; y += voxelSize) {
      for (let x = 0; x < width; x += voxelSize) {
        const idx = (y * width + x) * 4;
        const alpha = pixels[idx + 3];

        if (alpha < 128) continue;

        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];

        // Create cube for this pixel
        this.addCube(
          vertices, normals, uvs, indices,
          x, y, voxelSize, voxelSize, extrusionDepth,
          { r, g, b },
          vertexIndex
        );

        vertexIndex += 24; // 24 vertices per cube (6 faces * 4 vertices)

        if (indices.length / 3 >= maxTriangles) break;
      }
      if (indices.length / 3 >= maxTriangles) break;
    }

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices),
      colors: new Float32Array(vertices.length)
    };
  }

  private async decodeSpritePixels(frame: { imageData: string | Buffer; width: number; height: number }): Promise<Uint8Array> {
    // Simplified pixel decoding
    // In production, would properly decode PNG
    const pixelCount = frame.width * frame.height * 4;
    return new Uint8Array(pixelCount);
  }

  private getExtrusionDepth(style: MeshStyle): number {
    switch (style) {
      case MeshStyle.LOW_POLY:
        return 1.0;
      case MeshStyle.STANDARD:
        return 0.5;
      case MeshStyle.HIGH_POLY:
        return 0.25;
      case MeshStyle.OPTIMIZED:
        return 0.75;
      default:
        return 0.5;
    }
  }

  private getVoxelSize(style: MeshStyle, width: number, height: number): number {
    switch (style) {
      case MeshStyle.LOW_POLY:
        return Math.max(4, Math.floor(width / 16));
      case MeshStyle.STANDARD:
        return Math.max(2, Math.floor(width / 32));
      case MeshStyle.HIGH_POLY:
        return 1;
      case MeshStyle.OPTIMIZED:
        return Math.max(2, Math.floor(width / 24));
      default:
        return 2;
    }
  }

  private addCube(
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number,
    color: { r: number; g: number; b: number },
    startVertex: number
  ): void {
    const x0 = x;
    const y0 = y;
    const z0 = 0;
    const x1 = x + width;
    const y1 = y + height;
    const z1 = depth;

    // Define cube faces (front, back, left, right, top, bottom)
    const faces = [
      // Front face
      { verts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], normal: [0, 0, 1] },
      // Back face
      { verts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], normal: [0, 0, -1] },
      // Left face
      { verts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], normal: [-1, 0, 0] },
      // Right face
      { verts: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], normal: [1, 0, 0] },
      // Top face
      { verts: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], normal: [0, 1, 0] },
      // Bottom face
      { verts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], normal: [0, -1, 0] }
    ];

    const uvBase = [
      [0, 0], [1, 0], [1, 1], [0, 1]
    ];

    for (const face of faces) {
      const faceStart = vertices.length / 3;

      for (const vert of face.verts) {
        vertices.push(...vert);
        normals.push(...face.normal);
      }

      for (const uv of uvBase) {
        uvs.push(...uv);
      }

      // Two triangles per face
      indices.push(
        faceStart, faceStart + 1, faceStart + 2,
        faceStart, faceStart + 2, faceStart + 3
      );
    }
  }

  // ========================================================================
  // VOXEL TO MESH CONVERSION
  // ========================================================================

  private async voxelsToMesh(
    voxelAsset: LuantiAsset,
    maxTriangles: number,
    style: MeshStyle
  ): Promise<MeshData> {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const [gridWidth, gridHeight, gridDepth] = voxelAsset.dimensions;
    const voxelSet = new Set<string>();

    for (const v of voxelAsset.voxels) {
      voxelSet.add(`${v.position[0]},${v.position[1]},${v.position[2]}`);
    }

    let vertexIndex = 0;

    for (const voxel of voxelAsset.voxels) {
      const [vx, vy, vz] = voxel.position;

      // Check each face for exposure
      const faces = [
        { dir: [1, 0, 0], normal: [1, 0, 0] },
        { dir: [-1, 0, 0], normal: [-1, 0, 0] },
        { dir: [0, 1, 0], normal: [0, 1, 0] },
        { dir: [0, -1, 0], normal: [0, -1, 0] },
        { dir: [0, 0, 1], normal: [0, 0, 1] },
        { dir: [0, 0, -1], normal: [0, 0, -1] }
      ];

      for (const face of faces) {
        const neighbor = `${vx + face.dir[0]},${vy + face.dir[1]},${vz + face.dir[2]}`;

        if (!voxelSet.has(neighbor)) {
          // Face is exposed, add quad
          this.addVoxelFace(
            vertices, normals, uvs, indices,
            vx, vy, vz,
            face.dir as [number, number, number],
            face.normal as [number, number, number],
            voxel.color,
            vertexIndex
          );

          vertexIndex += 4;
        }

        if (indices.length / 3 >= maxTriangles) break;
      }
      if (indices.length / 3 >= maxTriangles) break;
    }

    // Optimize based on style
    const optimized = this.optimizeMeshByStyle(
      { vertices: new Float32Array(vertices), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) },
      style
    );

    return optimized;
  }

  private addVoxelFace(
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
    x: number,
    y: number,
    z: number,
    dir: [number, number, number],
    normal: [number, number, number],
    color: string,
    startVertex: number
  ): void {
    // Define face vertices based on direction
    let faceVerts: [number, number, number][];

    if (dir[0] === 1) { // +X
      faceVerts = [[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]];
    } else if (dir[0] === -1) { // -X
      faceVerts = [[x, y, z + 1], [x, y, z], [x, y + 1, z], [x, y + 1, z + 1]];
    } else if (dir[1] === 1) { // +Y
      faceVerts = [[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]];
    } else if (dir[1] === -1) { // -Y
      faceVerts = [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y, z], [x, y, z]];
    } else if (dir[2] === 1) { // +Z
      faceVerts = [[x, y, z + 1], [x, y + 1, z + 1], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]];
    } else { // -Z
      faceVerts = [[x + 1, y, z], [x + 1, y + 1, z], [x, y + 1, z], [x, y, z]];
    }

    for (const vert of faceVerts) {
      vertices.push(...vert);
      normals.push(...normal);
    }

    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

    const faceStart = vertices.length / 3 - 4;
    indices.push(
      faceStart, faceStart + 1, faceStart + 2,
      faceStart, faceStart + 2, faceStart + 3
    );
  }

  // ========================================================================
  // PROCEDURAL MESH GENERATION
  // ========================================================================

  private parseDescription(description: string): {
    subject: string;
    colors: string[];
    style: string;
    tags: string[];
    size: string;
    detail: string;
  } {
    const result = {
      subject: 'object',
      colors: [] as string[],
      style: 'realistic',
      tags: [] as string[],
      size: 'medium',
      detail: 'standard'
    };

    const lowerDesc = description.toLowerCase();

    // Extract colors
    const colorPatterns = [
      'red', 'blue', 'green', 'yellow', 'orange', 'purple',
      'black', 'white', 'gray', 'brown', 'pink', 'cyan',
      'gold', 'silver', 'bronze'
    ];
    for (const color of colorPatterns) {
      if (lowerDesc.includes(color)) {
        result.colors.push(color);
      }
    }

    // Extract subject
    const subjectPatterns = [
      'character', 'person', 'human', 'warrior', 'mage', 'archer',
      'creature', 'animal', 'dragon', 'wolf', 'bird',
      'robot', 'mech', 'vehicle', 'car', 'tank', 'ship',
      'weapon', 'sword', 'axe', 'bow',
      'tree', 'rock', 'building', 'house', 'tower', 'castle'
    ];
    for (const subject of subjectPatterns) {
      if (lowerDesc.includes(subject)) {
        result.subject = subject;
        result.tags.push(subject);
        break;
      }
    }

    // Extract detail level
    if (lowerDesc.includes('detailed') || lowerDesc.includes('intricate')) {
      result.detail = 'high';
    } else if (lowerDesc.includes('simple') || lowerDesc.includes('minimal')) {
      result.detail = 'low';
    }

    return result;
  }

  private generatePaletteFromCharacteristics(characteristics: {
    colors: string[];
    subject: string;
  }): ColorPalette {
    const colorMap: Record<string, string> = {
      red: '#C0392B',
      blue: '#2980B9',
      green: '#27AE60',
      yellow: '#F39C12',
      orange: '#D35400',
      purple: '#8E44AD',
      black: '#2C3E50',
      white: '#ECF0F1',
      gray: '#7F8C8D',
      brown: '#A0522D',
      pink: '#E91E63',
      cyan: '#16A085',
      gold: '#FFD700',
      silver: '#C0C0C0',
      bronze: '#CD7F32'
    };

    let primaryColor = '#808080';
    if (characteristics.colors.length > 0) {
      primaryColor = colorMap[characteristics.colors[0]] || primaryColor;
    }

    return {
      primary: primaryColor,
      secondary: this.adjustBrightness(primaryColor, -20),
      accent: this.adjustBrightness(primaryColor, 30),
      shadow: this.adjustBrightness(primaryColor, -50),
      hexValues: [primaryColor]
    };
  }

  private async generateProceduralMesh(
    characteristics: { subject: string; detail: string; tags: string[] },
    maxTriangles: number,
    style: MeshStyle
  ): Promise<MeshData> {
    const segmentCount = characteristics.detail === 'high' ? 32 :
                        characteristics.detail === 'low' ? 8 : 16;

    switch (characteristics.subject) {
      case 'character':
      case 'person':
      case 'human':
      case 'warrior':
      case 'mage':
        return this.generateHumanoidMesh(segmentCount, maxTriangles, style);
      case 'dragon':
        return this.generateDragonMesh(segmentCount, maxTriangles, style);
      case 'tree':
        return this.generateTreeMesh(segmentCount, maxTriangles, style);
      case 'sword':
        return this.generateSwordMesh(segmentCount, maxTriangles, style);
      case 'robot':
      case 'mech':
        return this.generateRobotMesh(segmentCount, maxTriangles, style);
      default:
        return this.generateBoxMesh(1, 1, 1, maxTriangles);
    }
  }

  private generateHumanoidMesh(segments: number, maxTriangles: number, style: MeshStyle): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Body proportions
    const headSize = 0.25;
    const torsoWidth = 0.4;
    const torsoHeight = 0.5;
    const armLength = 0.4;
    const legLength = 0.5;

    // Head (sphere)
    this.addSphere(vertices, normals, uvs, indices, 0, torsoHeight + headSize, 0, headSize, segments, 0, 0);

    // Torso (box)
    this.addBox(vertices, normals, uvs, indices, 0, torsoHeight / 2, 0, torsoWidth, torsoHeight, 0.2);

    // Arms (cylinders)
    this.addCylinder(vertices, normals, uvs, indices, -torsoWidth - 0.1, torsoHeight * 0.8, 0, 0.08, armLength, segments, 1, 0);
    this.addCylinder(vertices, normals, uvs, indices, torsoWidth + 0.1, torsoHeight * 0.8, 0, 0.08, armLength, segments, 1, 0);

    // Legs (cylinders)
    this.addCylinder(vertices, normals, uvs, indices, -0.12, 0, 0, 0.1, legLength, segments, 1, 1);
    this.addCylinder(vertices, normals, uvs, indices, 0.12, 0, 0, 0.1, legLength, segments, 1, 1);

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices.slice(0, maxTriangles * 3))
    };
  }

  private generateDragonMesh(segments: number, maxTriangles: number, style: MeshStyle): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Body (elongated)
    const bodyLength = 2;
    const bodyRadius = 0.3;

    this.addCapsule(vertices, normals, uvs, indices, 0, 0.5, 0, bodyLength, bodyRadius, segments);

    // Head
    this.addSphere(vertices, normals, uvs, indices, 0, 1.2, bodyLength * 0.4, 0.2, segments, 0, 0);

    // Wings (triangular)
    this.addWing(vertices, normals, uvs, indices, -0.3, 0.7, 0, 1.2, 0.8, segments);
    this.addWing(vertices, normals, uvs, indices, 0.3, 0.7, 0, 1.2, 0.8, segments);

    // Tail
    this.addCone(vertices, normals, uvs, indices, 0, 0.3, -bodyLength * 0.5, 0.2, 0.8, segments);

    // Legs
    this.addCylinder(vertices, normals, uvs, indices, -0.2, 0.2, 0.2, 0.08, 0.4, segments, 1, 1);
    this.addCylinder(vertices, normals, uvs, indices, 0.2, 0.2, 0.2, 0.08, 0.4, segments, 1, 1);

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices.slice(0, maxTriangles * 3))
    };
  }

  private generateTreeMesh(segments: number, maxTriangles: number, style: MeshStyle): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Trunk
    const trunkHeight = 1.5;
    const trunkRadius = 0.15;

    this.addCylinder(vertices, normals, uvs, indices, 0, trunkHeight / 2, 0, trunkRadius, trunkHeight, segments / 2, 0, 0);

    // Foliage (clustered spheres)
    this.addSphere(vertices, normals, uvs, indices, 0, trunkHeight + 0.3, 0, 0.4, segments, 1, 0);
    this.addSphere(vertices, normals, uvs, indices, 0.3, trunkHeight, 0, 0.25, segments / 2, 1, 0);
    this.addSphere(vertices, normals, uvs, indices, -0.3, trunkHeight, 0, 0.25, segments / 2, 1, 0);
    this.addSphere(vertices, normals, uvs, indices, 0, trunkHeight + 0.6, 0.3, 0.25, segments / 2, 1, 0);
    this.addSphere(vertices, normals, uvs, indices, 0, trunkHeight + 0.6, -0.3, 0.25, segments / 2, 1, 0);

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices.slice(0, maxTriangles * 3))
    };
  }

  private generateSwordMesh(segments: number, maxTriangles: number, style: MeshStyle): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Blade
    const bladeLength = 1.2;
    const bladeWidth = 0.15;

    this.addBox(vertices, normals, uvs, indices, 0, bladeLength / 2 + 0.2, 0, bladeWidth, bladeLength, 0.02);

    // Guard
    this.addBox(vertices, normals, uvs, indices, 0, 0.2, 0, 0.3, 0.05, 0.05);

    // Handle
    this.addCylinder(vertices, normals, uvs, indices, 0, 0.1, 0, 0.04, 0.2, 8, 0, 1);

    // Pommel
    this.addSphere(vertices, normals, uvs, indices, 0, 0, 0, 0.06, 8, 0, 1);

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices.slice(0, maxTriangles * 3))
    };
  }

  private generateRobotMesh(segments: number, maxTriangles: number, style: MeshStyle): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Torso (box)
    this.addBox(vertices, normals, uvs, indices, 0, 0.7, 0, 0.4, 0.5, 0.25);

    // Head (box)
    this.addBox(vertices, normals, uvs, indices, 0, 1.15, 0, 0.2, 0.2, 0.2);

    // Eyes (glowing)
    this.addBox(vertices, normals, uvs, indices, -0.05, 1.15, 0.11, 0.04, 0.04, 0.01);
    this.addBox(vertices, normals, uvs, indices, 0.05, 1.15, 0.11, 0.04, 0.04, 0.01);

    // Arms (boxes with joints)
    this.addBox(vertices, normals, uvs, indices, -0.35, 0.7, 0, 0.15, 0.4, 0.1);
    this.addBox(vertices, normals, uvs, indices, 0.35, 0.7, 0, 0.15, 0.4, 0.1);

    // Legs
    this.addBox(vertices, normals, uvs, indices, -0.12, 0.3, 0, 0.12, 0.4, 0.12);
    this.addBox(vertices, normals, uvs, indices, 0.12, 0.3, 0, 0.12, 0.4, 0.12);

    // Shoulders
    this.addSphere(vertices, normals, uvs, indices, -0.4, 0.95, 0, 0.1, segments / 2, 0, 0);
    this.addSphere(vertices, normals, uvs, indices, 0.4, 0.95, 0, 0.1, segments / 2, 0, 0);

    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices.slice(0, maxTriangles * 3))
    };
  }

  // ========================================================================
  // PRIMITIVE GENERATION
  // ========================================================================

  private addBox(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    w: number, h: number, d: number
  ): void {
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;

    const base = vertices.length / 3;

    // Define 6 faces
    const faces = [
      { verts: [[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], normal: [0, 0, 1] },
      { verts: [[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], normal: [0, 0, -1] },
      { verts: [[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], normal: [-1, 0, 0] },
      { verts: [[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], normal: [1, 0, 0] },
      { verts: [[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], normal: [0, 1, 0] },
      { verts: [[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], normal: [0, -1, 0] }
    ];

    for (const face of faces) {
      const faceBase = vertices.length / 3;

      for (const vert of face.verts) {
        vertices.push(cx + vert[0], cy + vert[1], cz + vert[2]);
        normals.push(...face.normal);
      }

      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);

      indices.push(
        faceBase, faceBase + 1, faceBase + 2,
        faceBase, faceBase + 2, faceBase + 3
      );
    }
  }

  private addSphere(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    radius: number, segments: number,
    materialIndex: number, uvSet: number
  ): void {
    const rings = Math.max(4, Math.floor(segments / 2));
    const base = vertices.length / 3;

    for (let ring = 0; ring <= rings; ring++) {
      const theta = (ring / rings) * Math.PI;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let seg = 0; seg <= segments; seg++) {
        const phi = (seg / segments) * Math.PI * 2;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        vertices.push(cx + x * radius, cy + y * radius, cz + z * radius);
        normals.push(x, y, z);
        uvs.push(seg / segments, ring / rings);
      }
    }

    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const first = ring * (segments + 1) + seg;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }
  }

  private addCylinder(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    radius: number, height: number, segments: number,
    materialIndex: number, uvSet: number
  ): void {
    const halfHeight = height / 2;
    const base = vertices.length / 3;

    // Side vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      vertices.push(cx + x, cy - halfHeight, cz + z);
      normals.push(x / radius, 0, z / radius);
      uvs.push(i / segments, 0);

      vertices.push(cx + x, cy + halfHeight, cz + z);
      normals.push(x / radius, 0, z / radius);
      uvs.push(i / segments, 1);
    }

    // Side faces
    for (let i = 0; i < segments; i++) {
      const baseIdx = base + i * 2;
      const nextIdx = base + (i + 1) * 2;

      indices.push(baseIdx, nextIdx, baseIdx + 1);
      indices.push(baseIdx + 1, nextIdx, nextIdx + 1);
    }

    // Top cap
    const topCenter = vertices.length / 3;
    vertices.push(cx, cy + halfHeight, cz);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      vertices.push(cx + x, cy + halfHeight, cz + z);
      normals.push(0, 1, 0);
      uvs.push((x + radius) / (radius * 2), (z + radius) / (radius * 2));
    }

    for (let i = 0; i < segments; i++) {
      indices.push(topCenter, topCenter + 1 + i + 1, topCenter + 1 + i);
    }

    // Bottom cap
    const bottomCenter = vertices.length / 3;
    vertices.push(cx, cy - halfHeight, cz);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      vertices.push(cx + x, cy - halfHeight, cz + z);
      normals.push(0, -1, 0);
      uvs.push((x + radius) / (radius * 2), (z + radius) / (radius * 2));
    }

    for (let i = 0; i < segments; i++) {
      indices.push(bottomCenter, bottomCenter + 1 + i, bottomCenter + 1 + i + 1);
    }
  }

  private addCapsule(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    length: number, radius: number, segments: number
  ): void {
    const halfLength = length / 2;
    const hemisphereSegments = Math.max(2, Math.floor(segments / 4));

    // Middle cylinder
    this.addCylinder(vertices, normals, uvs, indices, cx, cy, cz, radius, halfLength * 2, segments, 0, 0);

    // Top hemisphere
    const topBase = vertices.length / 3;
    for (let ring = 0; ring <= hemisphereSegments; ring++) {
      const theta = (ring / hemisphereSegments) * Math.PI / 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let seg = 0; seg <= segments; seg++) {
        const phi = (seg / segments) * Math.PI * 2;
        const x = Math.cos(phi) * sinTheta;
        const y = cosTheta;
        const z = Math.sin(phi) * sinTheta;

        vertices.push(cx + x * radius, cy + halfLength + y * radius, cz + z * radius);
        normals.push(x, y, z);
        uvs.push(seg / segments, ring / hemisphereSegments);
      }
    }

    for (let ring = 0; ring < hemisphereSegments; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const first = topBase + ring * (segments + 1) + seg;
        const second = first + segments + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    // Bottom hemisphere
    const bottomBase = vertices.length / 3;
    for (let ring = 0; ring <= hemisphereSegments; ring++) {
      const theta = (ring / hemisphereSegments) * Math.PI / 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let seg = 0; seg <= segments; seg++) {
        const phi = (seg / segments) * Math.PI * 2;
        const x = Math.cos(phi) * sinTheta;
        const y = -cosTheta;
        const z = Math.sin(phi) * sinTheta;

        vertices.push(cx + x * radius, cy - halfLength + y * radius, cz + z * radius);
        normals.push(x, y, z);
        uvs.push(seg / segments, ring / hemisphereSegments);
      }
    }

    for (let ring = 0; ring < hemisphereSegments; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const first = bottomBase + ring * (segments + 1) + seg;
        const second = first + segments + 1;

        indices.push(first, first + 1, second);
        indices.push(first + 1, second + 1, second);
      }
    }
  }

  private addCone(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    radius: number, height: number, segments: number
  ): void {
    const base = vertices.length / 3;

    // Tip
    vertices.push(cx, cy + height, cz);
    normals.push(0, 1, 0);
    uvs.push(0.5, 1);

    // Base vertices
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      vertices.push(cx + x, cy, cz + z);

      // Calculate normal for this vertex
      const ny = radius / height;
      const len = Math.sqrt(x * x + ny * ny + z * z);
      normals.push(x / len, ny / len, z / len);

      uvs.push(i / segments, 0);
    }

    // Side faces
    for (let i = 0; i < segments; i++) {
      indices.push(base, base + 1 + i + 1, base + 1 + i);
    }

    // Base cap
    const baseCenter = vertices.length / 3;
    vertices.push(cx, cy, cz);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      vertices.push(cx + x, cy, cz + z);
      normals.push(0, -1, 0);
      uvs.push((x + radius) / (radius * 2), (z + radius) / (radius * 2));
    }

    for (let i = 0; i < segments; i++) {
      indices.push(baseCenter, baseCenter + 1 + i, baseCenter + 1 + i + 1);
    }
  }

  private addWing(
    vertices: number[], normals: number[], uvs: number[], indices: number[],
    cx: number, cy: number, cz: number,
    width: number, length: number, segments: number
  ): void {
    const base = vertices.length / 3;

    // Wing is a curved triangular surface
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = t * width;
      const y = Math.sin(t * Math.PI) * 0.2;
      const z = t * length * 0.3;

      vertices.push(cx + x, cy + y, cz + z);
      normals.push(0, 1, 0);
      uvs.push(t, 0);

      vertices.push(cx + x, cy + y, cz - z);
      normals.push(0, 1, 0);
      uvs.push(t, 1);
    }

    // Connect to body
    vertices.push(cx, cy, cz);
    normals.push(0, 1, 0);
    uvs.push(0, 0.5);

    const tip = vertices.length / 3;
    vertices.push(cx + width, cy + Math.sin(Math.PI) * 0.2, cz);
    normals.push(0, 1, 0);
    uvs.push(1, 0.5);

    // Create wing surface
    for (let i = 0; i < segments; i++) {
      const idx = base + i * 2;
      indices.push(idx, idx + 2, tip);
      indices.push(idx + 1, tip, idx + 3);
    }
  }

  // ========================================================================
  // SKELETON GENERATION
  // ========================================================================

  private createSpriteSkeleton(spriteAsset: MicroVerseAsset, proportions: Proportions): SkeletonData {
    const bones: Bone[] = [];
    const hierarchy: number[] = [];

    // Root bone
    bones.push({
      name: 'root',
      index: 0,
      parent: -1,
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(-1);

    // Hip bone
    bones.push({
      name: 'hip',
      index: 1,
      parent: 0,
      position: [0, proportions.height * 0.5, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(0);

    // Spine
    bones.push({
      name: 'spine',
      index: 2,
      parent: 1,
      position: [0, proportions.height * 0.2, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(1);

    // Head
    bones.push({
      name: 'head',
      index: 3,
      parent: 2,
      position: [0, proportions.height * 0.15, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(2);

    // Arms
    bones.push({
      name: 'left_arm',
      index: 4,
      parent: 2,
      position: [-proportions.widthToHeight * proportions.height * 0.3, proportions.height * 0.1, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(2);

    bones.push({
      name: 'right_arm',
      index: 5,
      parent: 2,
      position: [proportions.widthToHeight * proportions.height * 0.3, proportions.height * 0.1, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(2);

    // Legs
    bones.push({
      name: 'left_leg',
      index: 6,
      parent: 1,
      position: [-proportions.widthToHeight * proportions.height * 0.15, -proportions.height * 0.2, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(1);

    bones.push({
      name: 'right_leg',
      index: 7,
      parent: 1,
      position: [proportions.widthToHeight * proportions.height * 0.15, -proportions.height * 0.2, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    });
    hierarchy.push(1);

    return {
      bones,
      hierarchy,
      inverseBindPoses: bones.map(() => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]))
    };
  }

  private createProceduralSkeleton(characteristics: { subject: string }): SkeletonData | undefined {
    if (!this.isCharacterLike(characteristics)) {
      return undefined;
    }

    const bones: Bone[] = [
      {
        name: 'root',
        index: 0,
        parent: -1,
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      },
      {
        name: 'body',
        index: 1,
        parent: 0,
        position: [0, 0.5, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      },
      {
        name: 'head',
        index: 2,
        parent: 1,
        position: [0, 0.7, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      }
    ];

    return {
      bones,
      hierarchy: [-1, 0, 1],
      inverseBindPosates: bones.map(() => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]))
    };
  }

  private isCharacterLike(characteristics: { subject: string }): boolean {
    const characterSubjects = ['character', 'person', 'human', 'warrior', 'mage', 'archer', 'robot', 'mech'];
    return characterSubjects.includes(characteristics.subject);
  }

  // ========================================================================
  // LOD GENERATION
  // ========================================================================

  private async generateLODLevels(mesh: MeshData, lodCount: number): Promise<LODLevel[]> {
    const lods: LODLevel[] = [];
    const originalTriangleCount = mesh.indices.length / 3;

    for (let i = 1; i < lodCount; i++) {
      const reductionFactor = Math.pow(0.5, i);
      const targetTriangles = Math.max(4, Math.floor(originalTriangleCount * reductionFactor));

      const simplifiedMesh = await this.simplifyMesh(mesh, targetTriangles, MeshStyle.OPTIMIZED);

      lods.push({
        level: i,
        distance: i * 10,
        screenSize: 1 / Math.pow(2, i),
        mesh: simplifiedMesh
      });
    }

    return lods;
  }

  private async simplifyMesh(mesh: MeshData, targetTriangles: number, style: MeshStyle): Promise<MeshData> {
    // Simplified mesh simplification
    // In production, would use proper simplification algorithm (e.g., quadric error metrics)

    const currentTriangles = mesh.indices.length / 3;
    if (currentTriangles <= targetTriangles) {
      return mesh;
    }

    const reductionRatio = targetTriangles / currentTriangles;
    const step = Math.ceil(1 / reductionRatio);

    const simplifiedIndices: number[] = [];
    for (let i = 0; i < mesh.indices.length; i += 3 * step) {
      simplifiedIndices.push(mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]);
    }

    return {
      vertices: mesh.vertices,
      normals: mesh.normals,
      uvs: mesh.uvs,
      indices: new Uint16Array(simplifiedIndices),
      colors: mesh.colors
    };
  }

  // ========================================================================
  // MATERIAL GENERATION
  // ========================================================================

  private createMaterialsFromPalette(
    palette: ColorPalette,
    materialHints: { primary: string; metalness?: number; roughness?: number }
  ): MeshMaterial[] {
    const materials: MeshMaterial[] = [];

    // Primary material
    materials.push({
      name: 'primary',
      shader: 'standard',
      albedo: palette.primary,
      albedoMap: `textures/${palette.primary.substring(1)}.png`,
      properties: {
        metalness: materialHints.metalness || 0,
        roughness: materialHints.roughness || 0.8,
        emission: 0
      }
    });

    // Secondary material
    if (palette.secondary !== palette.primary) {
      materials.push({
        name: 'secondary',
        shader: 'standard',
        albedo: palette.secondary,
        properties: {
          metalness: materialHints.metalness || 0,
          roughness: materialHints.roughness || 0.8,
          emission: 0
        }
      });
    }

    // Accent material (for glowing elements)
    materials.push({
      name: 'accent',
      shader: 'standard',
      albedo: palette.accent,
      properties: {
        metalness: 0,
        roughness: 0.5,
        emission: 0.5
      }
    });

    return materials;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private optimizeMeshByStyle(mesh: MeshData, style: MeshStyle): MeshData {
    // Apply style-specific optimizations
    switch (style) {
      case MeshStyle.LOW_POLY:
        // Reduce triangle count, flat shading
        return this.applyFlatShading(mesh);
      case MeshStyle.HIGH_POLY:
        // Subdivide for smoothness
        return mesh; // Would implement subdivision in production
      case MeshStyle.OPTIMIZED:
        // Remove redundant vertices
        return this.removeRedundantVertices(mesh);
      default:
        return mesh;
    }
  }

  private applyFlatShading(mesh: MeshData): MeshData {
    // Duplicate vertices for flat shading
    // In production, would properly compute face normals

    return mesh;
  }

  private removeRedundantVertices(mesh: MeshData): MeshData {
    // Remove duplicate vertices
    // In production, would implement proper vertex welding

    return mesh;
  }

  private getTargetTriangleCount(style: MeshStyle): number {
    switch (style) {
      case MeshStyle.LOW_POLY: return 500;
      case MeshStyle.STANDARD: return 3000;
      case MeshStyle.HIGH_POLY: return 15000;
      case MeshStyle.OPTIMIZED: return 2000;
      default: return 3000;
    }
  }

  private adjustBrightness(hex: string, amount: number): string {
    const rgb = this.hexToRgb(hex);
    const factor = 1 + amount / 100;

    return this.rgbToHex(
      Math.min(255, Math.max(0, Math.round(rgb.r * factor))),
      Math.min(255, Math.max(0, Math.round(rgb.g * factor))),
      Math.min(255, Math.max(0, Math.round(rgb.b * factor)))
    );
  }

  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  }

  private async saveMeshAsset(
    asset: OpenRTSAsset,
    customPath?: string,
    format: string = 'gltf'
  ): Promise<void> {
    const outputPath = customPath || this.outputDirectory;
    const assetDir = path.join(outputPath, asset.id);

    await fs.mkdir(assetDir, { recursive: true });

    // Save metadata
    const metadataPath = path.join(assetDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(asset, null, 2));

    // Save mesh data
    const meshPath = path.join(assetDir, `mesh.${format}`);
    await this.saveMeshFormat(asset, meshPath, format);

    // Save materials
    const materialsDir = path.join(assetDir, 'materials');
    await fs.mkdir(materialsDir, { recursive: true });

    for (const material of asset.materials) {
      const materialPath = path.join(materialsDir, `${material.name}.json`);
      await fs.writeFile(materialPath, JSON.stringify(material, null, 2));
    }
  }

  private async saveMeshFormat(asset: OpenRTSAsset, outputPath: string, format: string): Promise<void> {
    switch (format) {
      case 'gltf':
        await this.saveGLTF(asset, outputPath);
        break;
      case 'obj':
        await this.saveOBJ(asset, outputPath);
        break;
      default:
        await this.saveGLTF(asset, outputPath);
    }
  }

  private async saveGLTF(asset: OpenRTSAsset, outputPath: string): Promise<void> {
    const gltf = {
      asset: {
        version: '2.0',
        generator: 'AssetRegenerationSystem'
      },
      scene: 0,
      scenes: [{
        nodes: [0]
      }],
      nodes: [{
        name: asset.name,
        mesh: 0
      }],
      meshes: [{
        name: asset.name,
        primitives: [{
          attributes: {
            POSITION: 0,
            NORMAL: 1,
            TEXCOORD_0: 2
          },
          indices: 3,
          material: 0
        }]
      }],
      accessors: this.createGLTFAccessors(asset.mesh),
      bufferViews: this.createGLTFBufferViews(asset.mesh),
      buffers: [{
        uri: 'mesh.bin',
        byteLength: this.calculateBufferSize(asset.mesh)
      }],
      materials: asset.materials.map((mat, i) => ({
        name: mat.name,
        pbrMetallicRoughness: {
          baseColorFactor: this.hexToRGBAArray(mat.albedo),
          metallicFactor: mat.properties.metalness,
          roughnessFactor: mat.properties.roughness
        }
      }))
    };

    await fs.writeFile(outputPath, JSON.stringify(gltf, null, 2));

    // Save binary buffer
    const binPath = outputPath.replace('.gltf', '.bin');
    await fs.writeFile(binPath, Buffer.concat([
      Buffer.from(asset.mesh.vertices.buffer),
      Buffer.from(asset.mesh.normals.buffer),
      Buffer.from(asset.mesh.uvs.buffer),
      Buffer.from(asset.mesh.indices.buffer)
    ]));
  }

  private createGLTFAccessors(mesh: MeshData): any[] {
    return [
      {
        bufferView: 0,
        componentType: 5126,
        count: mesh.vertices.length / 3,
        type: 'VEC3',
        max: this.findMax(mesh.vertices, 3),
        min: this.findMin(mesh.vertices, 3)
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: mesh.normals.length / 3,
        type: 'VEC3'
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: mesh.uvs.length / 2,
        type: 'VEC2'
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: mesh.indices.length,
        type: 'SCALAR'
      }
    ];
  }

  private createGLTFBufferViews(mesh: MeshData): any[] {
    let offset = 0;
    const views = [];

    // Vertices
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: mesh.vertices.byteLength
    });
    offset += mesh.vertices.byteLength;

    // Normals
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: mesh.normals.byteLength
    });
    offset += mesh.normals.byteLength;

    // UVs
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: mesh.uvs.byteLength
    });
    offset += mesh.uvs.byteLength;

    // Indices
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: mesh.indices.byteLength
    });

    return views;
  }

  private calculateBufferSize(mesh: MeshData): number {
    return mesh.vertices.byteLength +
           mesh.normals.byteLength +
           mesh.uvs.byteLength +
           mesh.indices.byteLength;
  }

  private findMax(data: Float32Array, stride: number): number[] {
    const max = Array(stride).fill(-Infinity);
    for (let i = 0; i < data.length; i += stride) {
      for (let j = 0; j < stride; j++) {
        max[j] = Math.max(max[j], data[i + j]);
      }
    }
    return max;
  }

  private findMin(data: Float32Array, stride: number): number[] {
    const min = Array(stride).fill(Infinity);
    for (let i = 0; i < data.length; i += stride) {
      for (let j = 0; j < stride; j++) {
        min[j] = Math.min(min[j], data[i + j]);
      }
    }
    return min;
  }

  private hexToRGBAArray(hex: string): number[] {
    const rgb = this.hexToRgb(hex);
    return [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1];
  }

  private async saveOBJ(asset: OpenRTSAsset, outputPath: string): Promise<void> {
    const mesh = asset.mesh;
    let obj = `# ${asset.name}\n# Generated by AssetRegenerationSystem\n\n`;

    // Vertices
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      obj += `v ${mesh.vertices[i]} ${mesh.vertices[i + 1]} ${mesh.vertices[i + 2]}\n`;
    }

    // UVs
    for (let i = 0; i < mesh.uvs.length; i += 2) {
      obj += `vt ${mesh.uvs[i]} ${mesh.uvs[i + 1]}\n`;
    }

    // Normals
    for (let i = 0; i < mesh.normals.length; i += 3) {
      obj += `vn ${mesh.normals[i]} ${mesh.normals[i + 1]} ${mesh.normals[i + 2]}\n`;
    }

    // Faces
    obj += '\nusemtl primary\n';
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const i0 = mesh.indices[i] + 1;
      const i1 = mesh.indices[i + 1] + 1;
      const i2 = mesh.indices[i + 2] + 1;
      obj += `f ${i0}/${i0}/${i0} ${i1}/${i1}/${i1} ${i2}/${i2}/${i2}\n`;
    }

    await fs.writeFile(outputPath, obj);

    // Save MTL file
    const mtlPath = outputPath.replace('.obj', '.mtl');
    let mtl = `# ${asset.name} materials\n\n`;

    for (const material of asset.materials) {
      mtl += `newmtl ${material.name}\n`;
      mtl += `Kd ${this.hexToRGBString(material.albedo)}\n`;
      mtl += `Ka 0.1 0.1 0.1\n`;
      mtl += `Ks 0.5 0.5 0.5\n`;
      mtl += `Ns 32\n`;
      mtl += '\n';
    }

    await fs.writeFile(mtlPath, mtl);
  }

  private hexToRGBString(hex: string): string {
    const rgb = this.hexToRgb(hex);
    return `${rgb.r / 255} ${rgb.g / 255} ${rgb.b / 255}`;
  }

  private async ensureOutputDirectory(): Promise<void> {
    await fs.mkdir(this.outputDirectory, { recursive: true });
  }
}

// Type alias fix
type inverseBindPosates = Float32Array[];
