/**
 * Comparison Viewer - Side-by-Side Asset Form Comparison
 *
 * Generates and serves comparison views of all three asset forms:
 * - MicroVerse (2D sprite)
 * - Luanti (voxel)
 * - OpenRTS (3D mesh)
 *
 * Provides visual comparison metrics and preview generation.
 */

import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import {
  AnyAsset,
  AssetForm,
  ComparisonView,
  ComparisonMetrics,
  MicroVerseAsset,
  LuantiAsset,
  OpenRTSAsset
} from './types.js';
import { StylePreserver } from './style-preserver.js';

// ============================================================================
// VIEWER CONFIGURATION
// ============================================================================

export interface ViewerConfig {
  outputDirectory: string;
  previewSize: {
    width: number;
    height: number;
  };
  thumbnailSize: {
    width: number;
    height: number;
  };
  comparisonLayout: 'horizontal' | 'vertical' | 'grid';
  showMetrics: boolean;
  showWireframe: boolean;
  backgroundColor: string;
}

// ============================================================================
// COMPARISON VIEWER CLASS
// ============================================================================

export class ComparisonViewer {
  private stylePreserver: StylePreserver;
  private config: ViewerConfig;

  constructor(config?: Partial<ViewerConfig>) {
    this.stylePreserver = new StylePreserver();
    this.config = this.mergeConfig(config);
  }

  /**
   * Create a comparison view for an asset across all forms
   */
  async createComparison(
    assetId: string,
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    }
  ): Promise<ComparisonView> {
    // Calculate comparison metrics
    const metrics = this.calculateMetrics(forms);

    // Generate preview URLs
    const previews = await this.generatePreviews(assetId, forms);

    // Determine asset name
    const assetName = this.getAssetName(forms);

    return {
      assetId,
      assetName,
      forms,
      metrics,
      previews
    };
  }

  /**
   * Generate side-by-side comparison image
   */
  async generateSideBySideImage(
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    },
    outputPath?: string
  ): Promise<Buffer> {
    const availableForms: Array<{ form: AssetForm; asset: AnyAsset }> = [];

    if (forms.microverse) {
      availableForms.push({ form: AssetForm.MICROVERSE, asset: forms.microverse });
    }
    if (forms.luanti) {
      availableForms.push({ form: AssetForm.LUANTI, asset: forms.luanti });
    }
    if (forms.openrts) {
      availableForms.push({ form: AssetForm.OPENRTS, asset: forms.openrts });
    }

    if (availableForms.length === 0) {
      throw new Error('No forms available for comparison');
    }

    // Determine layout
    const cols = availableForms.length;
    const rows = 1;

    // Generate individual previews
    const previews: Buffer[] = [];
    for (const { form, asset } of availableForms) {
      const preview = await this.generateFormPreview(form, asset);
      previews.push(preview);
    }

    // Calculate composite dimensions
    const previewWidth = this.config.previewSize.width;
    const previewHeight = this.config.previewSize.height;
    const spacing = 20;
    const labelHeight = 40;

    const totalWidth = cols * previewWidth + (cols - 1) * spacing + spacing * 2;
    const totalHeight = previewHeight + labelHeight + spacing * 2;

    // Create composite image
    const composite = sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: this.parseColor(this.config.backgroundColor)
      }
    });

    const composites: Array<{ input: Buffer; left: number; top: number }> = [];

    // Add previews with labels
    for (let i = 0; i < previews.length; i++) {
      const x = spacing + i * (previewWidth + spacing);
      const y = spacing;

      composites.push({
        input: previews[i],
        left: x,
        top: y
      });

      // Add label below
      const labelBuffer = await this.createLabel(
        availableForms[i].form,
        previewWidth,
        labelHeight
      );

      composites.push({
        input: labelBuffer,
        left: x,
        top: y + previewHeight + 10
      });
    }

    const result = composite.composite(composites);
    const output = await result.png().toBuffer();

    if (outputPath) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, output);
    }

    return output;
  }

  /**
   * Generate a preview for a single form
   */
  async generateFormPreview(form: AssetForm, asset: AnyAsset): Promise<Buffer> {
    const size = this.config.previewSize;

    switch (form) {
      case AssetForm.MICROVERSE:
        return this.generateSpritePreview(asset as MicroVerseAsset, size.width, size.height);
      case AssetForm.LUANTI:
        return this.generateVoxelPreview(asset as LuantiAsset, size.width, size.height);
      case AssetForm.OPENRTS:
        return this.generateMeshPreview(asset as OpenRTSAsset, size.width, size.height);
      default:
        throw new Error(`Unknown form: ${form}`);
    }
  }

  /**
   * Generate sprite preview
   */
  private async generateSpritePreview(
    asset: MicroVerseAsset,
    width: number,
    height: number
  ): Promise<Buffer> {
    const frame = asset.frames[0];
    if (!frame) {
      return this.createPlaceholder(width, height, 'No frames');
    }

    try {
      // Decode frame data
      const frameBuffer = Buffer.from(frame.imageData, 'base64');

      // Resize to preview size
      return await sharp(frameBuffer)
        .resize(width, height, {
          kernel: sharp.kernel.nearest,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    } catch (error) {
      return this.createPlaceholder(width, height, 'Sprite error');
    }
  }

  /**
   * Generate voxel preview (isometric)
   */
  private async generateVoxelPreview(
    asset: LuantiAsset,
    width: number,
    height: number
  ): Promise<Buffer> {
    const [vw, vh, vd] = asset.dimensions;

    // Calculate scale to fit
    const maxDim = Math.max(vw, vh, vd);
    const scale = Math.min(width, height) / (maxDim * 1.5);

    // Create isometric projection
    const isoWidth = Math.ceil((vw + vd) * scale);
    const isoHeight = Math.ceil((vw + vd) * scale * 0.5 + vh * scale);

    const pixels = new Uint8Array(width * height * 4);
    pixels.fill(0); // Transparent

    const offsetX = Math.floor((width - isoWidth) / 2);
    const offsetY = Math.floor((height - isoHeight) / 2);

    // Render voxels
    for (const voxel of asset.voxels) {
      const [vx, vy, vz] = voxel.position;
      const rgb = this.hexToRgb(voxel.color);

      // Isometric transform
      const isoX = Math.floor(offsetX + (vx - vz + vd / 2) * scale);
      const isoY = Math.floor(offsetY + (vx + vz - vy + vh / 2) * scale * 0.5);

      // Draw voxel as a small square/cube face
      const voxelSize = Math.max(1, Math.floor(scale));

      for (let dy = 0; dy < voxelSize; dy++) {
        for (let dx = 0; dx < voxelSize; dx++) {
          const px = isoX + dx;
          const py = isoY + dy;

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const idx = (py * width + px) * 4;
            pixels[idx] = rgb.r;
            pixels[idx + 1] = rgb.g;
            pixels[idx + 2] = rgb.b;
            pixels[idx + 3] = 255;
          }
        }
      }
    }

    return await sharp(Buffer.from(pixels), {
      raw: { width, height, channels: 4 }
    }).png().toBuffer();
  }

  /**
   * Generate mesh preview (orthographic)
   */
  private async generateMeshPreview(
    asset: OpenRTSAsset,
    width: number,
    height: number
  ): Promise<Buffer> {
    const mesh = asset.mesh;

    if (!mesh.vertices || mesh.vertices.length === 0) {
      return this.createPlaceholder(width, height, 'Empty mesh');
    }

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < mesh.vertices.length; i += 3) {
      minX = Math.min(minX, mesh.vertices[i]);
      maxX = Math.max(maxX, mesh.vertices[i]);
      minY = Math.min(minY, mesh.vertices[i + 1]);
      maxY = Math.max(maxY, mesh.vertices[i + 1]);
      minZ = Math.min(minZ, mesh.vertices[i + 2]);
      maxZ = Math.max(maxZ, mesh.vertices[i + 2]);
    }

    const sizeX = maxX - minX;
    const sizeY = maxY - minY;
    const sizeZ = maxZ - minZ;
    const maxSize = Math.max(sizeX, sizeY, sizeZ);

    const scale = Math.min(width, height) / maxSize * 0.8;
    const offsetX = (width - sizeX * scale) / 2 - minX * scale;
    const offsetY = (height - sizeY * scale) / 2 - minY * scale;

    const pixels = new Uint8Array(width * height * 4);

    // Clear to transparent
    pixels.fill(0);

    // Get primary color
    const primaryColor = asset.materials[0]?.albedo || '#808080';
    const rgb = this.hexToRgb(primaryColor);

    // Simple wireframe/point rendering
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const vx = Math.floor(mesh.vertices[i] * scale + offsetX);
      const vy = Math.floor(mesh.vertices[i + 1] * scale + offsetY);

      if (vx >= 0 && vx < width && vy >= 0 && vy < height) {
        const idx = (vy * width + vx) * 4;
        // Check if already set (z-buffer simulation would go here)
        if (pixels[idx + 3] === 0) {
          pixels[idx] = rgb.r;
          pixels[idx + 1] = rgb.g;
          pixels[idx + 2] = rgb.b;
          pixels[idx + 3] = 255;
        }
      }
    }

    return await sharp(Buffer.from(pixels), {
      raw: { width, height, channels: 4 }
    }).png().toBuffer();
  }

  // ========================================================================
  // METRICS CALCULATION
  // ========================================================================

  private calculateMetrics(
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    }
  ): ComparisonMetrics {
    const availableAssets: AnyAsset[] = [];
    if (forms.microverse) availableAssets.push(forms.microverse);
    if (forms.luanti) availableAssets.push(forms.luanti);
    if (forms.openrts) availableAssets.push(forms.openrts);

    if (availableAssets.length < 2) {
      return {
        colorSimilarity: 1,
        silhouetteSimilarity: 1,
        proportionSimilarity: 1,
        overallConsistency: 1
      };
    }

    // Compare all pairs
    const comparisons: Array<{
      colorSimilarity: number;
      silhouetteSimilarity: number;
      proportionSimilarity: number;
    }> = [];

    for (let i = 0; i < availableAssets.length - 1; i++) {
      for (let j = i + 1; j < availableAssets.length; j++) {
        const profile1 = this.stylePreserver.extractStyleProfile(availableAssets[i]);
        const profile2 = this.stylePreserver.extractStyleProfile(availableAssets[j]);
        const comparison = this.stylePreserver.compareProfiles(profile1, profile2);
        comparisons.push(comparison);
      }
    }

    // Average the comparisons
    const avgColor = comparisons.reduce((sum, c) => sum + c.colorSimilarity, 0) / comparisons.length;
    const avgSilhouette = comparisons.reduce((sum, c) => sum + c.silhouetteSimilarity, 0) / comparisons.length;
    const avgProportion = comparisons.reduce((sum, c) => sum + c.proportionSimilarity, 0) / comparisons.length;

    return {
      colorSimilarity: avgColor,
      silhouetteSimilarity: avgSilhouette,
      proportionSimilarity: avgProportion,
      overallConsistency: (avgColor + avgSilhouette + avgProportion) / 3
    };
  }

  // ========================================================================
  // PREVIEW GENERATION
  // ========================================================================

  private async generatePreviews(
    assetId: string,
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    }
  ): Promise<{
    microverse?: string;
    luanti?: string;
    openrts?: string;
    sideBySide?: string;
  }> {
    const previews: Record<string, string> = {};

    // Generate individual previews
    if (forms.microverse) {
      const preview = await this.generateFormPreview(AssetForm.MICROVERSE, forms.microverse);
      const path = await this.savePreview(assetId, 'microverse', preview);
      previews.microverse = path;
    }

    if (forms.luanti) {
      const preview = await this.generateFormPreview(AssetForm.LUANTI, forms.luanti);
      const path = await this.savePreview(assetId, 'luanti', preview);
      previews.luanti = path;
    }

    if (forms.openrts) {
      const preview = await this.generateFormPreview(AssetForm.OPENRTS, forms.openrts);
      const path = await this.savePreview(assetId, 'openrts', preview);
      previews.openrts = path;
    }

    // Generate side-by-side
    if (Object.keys(previews).length > 1) {
      const sideBySide = await this.generateSideBySideImage(forms);
      const path = await this.savePreview(assetId, 'side-by-side', sideBySide);
      previews.sideBySide = path;
    }

    return previews;
  }

  private async savePreview(assetId: string, type: string, buffer: Buffer): Promise<string> {
    const filename = `${assetId}_${type}.png`;
    const filepath = path.join(this.config.outputDirectory, filename);

    await fs.mkdir(this.config.outputDirectory, { recursive: true });
    await fs.writeFile(filepath, buffer);

    return `/previews/${filename}`;
  }

  // ========================================================================
  // UTILITY METHODS
  // ========================================================================

  private async createLabel(
    form: AssetForm,
    width: number,
    height: number
  ): Promise<Buffer> {
    // Create label background
    const labelMap = {
      [AssetForm.MICROVERSE]: 'MicroVerse',
      [AssetForm.LUANTI]: 'Luanti',
      [AssetForm.OPENRTS]: 'OpenRTS'
    };

    const text = labelMap[form] || form;

    // Create a simple colored label
    const colorMap = {
      [AssetForm.MICROVERSE]: { r: 100, g: 150, b: 255 },
      [AssetForm.LUANTI]: { r: 100, g: 255, b: 150 },
      [AssetForm.OPENRTS]: { r: 255, g: 150, b: 100 }
    };

    const color = colorMap[form] || { r: 128, g: 128, b: 128 };

    // Create label image
    const label = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: color.r, g: color.g, b: color.b, alpha: 200 }
      }
    });

    // In production, would add text overlay here
    // For now, return the colored background
    return await label.png().toBuffer();
  }

  private async createPlaceholder(
    width: number,
    height: number,
    text: string
  ): Promise<Buffer> {
    const placeholder = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 50, g: 50, b: 50, alpha: 255 }
      }
    });

    return await placeholder.png().toBuffer();
  }

  private getAssetName(forms: {
    microverse?: MicroVerseAsset;
    luanti?: LuantiAsset;
    openrts?: OpenRTSAsset;
  }): string {
    if (forms.microverse) return forms.microverse.name;
    if (forms.luanti) return forms.luanti.name;
    if (forms.openrts) return forms.openrts.name;
    return 'Unknown Asset';
  }

  private parseColor(color: string): { r: number; g: number; b: number; alpha: number } {
    if (color.startsWith('#')) {
      const rgb = this.hexToRgb(color);
      return { r: rgb.r, g: rgb.g, b: rgb.b, alpha: 255 };
    }
    return { r: 30, g: 30, b: 35, alpha: 255 };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 128, g: 128, b: 128 };
  }

  private mergeConfig(userConfig?: Partial<ViewerConfig>): ViewerConfig {
    const defaultConfig: ViewerConfig = {
      outputDirectory: '/tmp/asset-regeneration-previews',
      previewSize: {
        width: 256,
        height: 256
      },
      thumbnailSize: {
        width: 64,
        height: 64
      },
      comparisonLayout: 'horizontal',
      showMetrics: true,
      showWireframe: false,
      backgroundColor: '#1e1e23'
    };

    return {
      ...defaultConfig,
      ...userConfig,
      previewSize: { ...defaultConfig.previewSize, ...userConfig?.previewSize },
      thumbnailSize: { ...defaultConfig.thumbnailSize, ...userConfig?.thumbnailSize }
    };
  }
}

// ============================================================================
// COMPARISON REPORT GENERATOR
// ============================================================================

export interface ComparisonReport {
  assetId: string;
  assetName: string;
  generatedAt: Date;
  forms: {
    microverse: boolean;
    luanti: boolean;
    openrts: boolean;
  };
  metrics: ComparisonMetrics;
  summary: string;
  recommendations: string[];
}

export class ComparisonReportGenerator {
  constructor(private viewer: ComparisonViewer) {}

  /**
   * Generate a detailed comparison report
   */
  async generateReport(
    assetId: string,
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    }
  ): Promise<ComparisonReport> {
    const comparison = await this.viewer.createComparison(assetId, forms);

    const summary = this.generateSummary(comparison);
    const recommendations = this.generateRecommendations(comparison);

    return {
      assetId: comparison.assetId,
      assetName: comparison.assetName,
      generatedAt: new Date(),
      forms: {
        microverse: !!forms.microverse,
        luanti: !!forms.luanti,
        openrts: !!forms.openrts
      },
      metrics: comparison.metrics,
      summary,
      recommendations
    };
  }

  private generateSummary(comparison: ComparisonView): string {
    const { metrics } = comparison;
    const formCount = Object.keys(comparison.forms).length;

    let summary = `Asset "${comparison.assetName}" is available in ${formCount} form(s). `;

    if (metrics.overallConsistency > 0.9) {
      summary += 'Forms exhibit excellent visual consistency.';
    } else if (metrics.overallConsistency > 0.7) {
      summary += 'Forms show good visual consistency with minor variations.';
    } else if (metrics.overallConsistency > 0.5) {
      summary += 'Forms have moderate consistency; consider style adjustment.';
    } else {
      summary += 'Forms show significant visual differences; style transfer recommended.';
    }

    return summary;
  }

  private generateRecommendations(comparison: ComparisonView): string[] {
    const recommendations: string[] = [];
    const { metrics, forms } = comparison;

    // Color consistency recommendations
    if (metrics.colorSimilarity < 0.7) {
      recommendations.push('Color palette varies significantly between forms. Consider applying a unified color palette.');
    }

    // Silhouette consistency recommendations
    if (metrics.silhouetteSimilarity < 0.7) {
      recommendations.push('Silhouette shapes differ across forms. Review proportion settings during regeneration.');
    }

    // Proportion consistency recommendations
    if (metrics.proportionSimilarity < 0.7) {
      recommendations.push('Asset proportions are inconsistent. Ensure proportional scaling is applied during conversion.');
    }

    // Missing form recommendations
    if (!forms.microverse) {
      recommendations.push('MicroVerse form is missing. Generate for 2D/2.5D use cases.');
    }
    if (!forms.luanti) {
      recommendations.push('Luanti form is missing. Generate for voxel/blocky engine use cases.');
    }
    if (!forms.openrts) {
      recommendations.push('OpenRTS form is missing. Generate for full 3D engine use cases.');
    }

    if (recommendations.length === 0) {
      recommendations.push('All forms are present and consistent. No immediate action required.');
    }

    return recommendations;
  }

  /**
   * Generate HTML comparison report
   */
  async generateHtmlReport(
    assetId: string,
    forms: {
      microverse?: MicroVerseAsset;
      luanti?: LuantiAsset;
      openrts?: OpenRTSAsset;
    }
  ): Promise<string> {
    const report = await this.generateReport(assetId, forms);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Asset Comparison: ${report.assetName}</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #1e1e23;
      color: #e0e0e0;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 { color: #fff; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric {
      background: #2a2a30;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #4fc3f7;
    }
    .metric-label {
      color: #888;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .summary {
      background: #2a2a30;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .recommendations {
      background: #2a2a30;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .recommendations ul {
      margin: 10px 0 0 20px;
    }
    .forms {
      display: flex;
      gap: 20px;
      margin: 20px 0;
      flex-wrap: wrap;
    }
    .form-card {
      background: #2a2a30;
      padding: 15px;
      border-radius: 8px;
      flex: 1;
      min-width: 200px;
    }
    .form-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      margin-top: 10px;
    }
    .form-present { background: #4caf50; }
    .form-missing { background: #f44336; }
  </style>
</head>
<body>
  <h1>Asset Comparison Report</h1>
  <p><strong>Asset:</strong> ${report.assetName}</p>
  <p><strong>ID:</strong> ${report.assetId}</p>
  <p><strong>Generated:</strong> ${report.generatedAt.toLocaleString()}</p>

  <div class="metrics">
    <div class="metric">
      <div class="metric-value">${(metrics.overallConsistency * 100).toFixed(0)}%</div>
      <div class="metric-label">Overall Consistency</div>
    </div>
    <div class="metric">
      <div class="metric-value">${(metrics.colorSimilarity * 100).toFixed(0)}%</div>
      <div class="metric-label">Color Similarity</div>
    </div>
    <div class="metric">
      <div class="metric-value">${(metrics.silhouetteSimilarity * 100).toFixed(0)}%</div>
      <div class="metric-label">Silhouette Match</div>
    </div>
    <div class="metric">
      <div class="metric-value">${(metrics.proportionSimilarity * 100).toFixed(0)}%</div>
      <div class="metric-label">Proportion Match</div>
    </div>
  </div>

  <div class="forms">
    <div class="form-card">
      <h3>MicroVerse</h3>
      <span class="form-status ${report.forms.microverse ? 'form-present' : 'form-missing'}">
        ${report.forms.microverse ? 'Present' : 'Missing'}
      </span>
    </div>
    <div class="form-card">
      <h3>Luanti</h3>
      <span class="form-status ${report.forms.luanti ? 'form-present' : 'form-missing'}">
        ${report.forms.luanti ? 'Present' : 'Missing'}
      </span>
    </div>
    <div class="form-card">
      <h3>OpenRTS</h3>
      <span class="form-status ${report.forms.openrts ? 'form-present' : 'form-missing'}">
        ${report.forms.openrts ? 'Present' : 'Missing'}
      </span>
    </div>
  </div>

  <div class="summary">
    <h2>Summary</h2>
    <p>${report.summary}</p>
  </div>

  <div class="recommendations">
    <h2>Recommendations</h2>
    <ul>
      ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
    </ul>
  </div>
</body>
</html>
    `.trim();
  }
}
