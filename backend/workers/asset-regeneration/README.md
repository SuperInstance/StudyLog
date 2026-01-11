# Asset Regeneration System

Regenerates assets in 3 forms for different engine perspectives:

- **MicroVerse Form** - 2D/2.5D sprite, NES-SNES style
- **Luanti Form** - Voxel/blocky model, isometric
- **OpenRTS Form** - Full 3D mesh, PS2+ quality

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { regenerateAsset, regenerateBatch } from '@studylog/asset-regeneration';

// Regenerate single asset to all forms
const result = await regenerateAsset('character_001', {
  quality: 'standard',
  stylePriority: 'balanced'
});

// Batch regenerate multiple assets
const jobId = await regenerateBatch(['char_001', 'char_002'], {
  quality: 'high',
  maxConcurrent: 4
});
```

## API Reference

### POST /regenerate/single

Generate all 3 forms for a single asset.

```typescript
interface RegenerationRequest {
  source: string | BaseAsset;
  targetForms?: AssetForm[];
  quality: QualityLevel;
  stylePriority: StylePriority;
  styleOverrides?: Partial<StyleProfile>;
  forceRegenerate?: boolean;
}
```

### POST /regenerate/batch

Regenerate multiple assets in parallel.

```typescript
interface BatchRegenerationRequest {
  assetIds: string[];
  targetForms?: AssetForm[];
  quality: QualityLevel;
  stylePriority: StylePriority;
  overrides?: Map<string, Partial<RegenerationRequest>>;
  parallel?: boolean;
  maxConcurrent?: number;
}
```

### GET /compare/:assetId

View all forms side-by-side with comparison metrics.

```typescript
interface ComparisonView {
  assetId: string;
  assetName: string;
  forms: {
    microverse?: MicroVerseAsset;
    luanti?: LuantiAsset;
    openrts?: OpenRTSAsset;
  };
  metrics: ComparisonMetrics;
  previews: {
    microverse?: string;
    luanti?: string;
    openrts?: string;
    sideBySide?: string;
  };
}
```

### POST /style/transfer

Transfer style between assets.

```typescript
interface StyleTransferRequest {
  sourceAsset: string;
  sourceForm: AssetForm;
  targetAssets: string[];
  targetForms?: AssetForm[];
  transfer: {
    colors: boolean;
    proportions: boolean;
    silhouette: boolean;
    materials: boolean;
  };
}
```

### GET /cache/status

Check cached variants and cache statistics.

## Style Preservation

The system maintains visual consistency across forms by preserving:

1. **Color Palette** - Dominant colors extracted and adapted per form
2. **Proportions** - Width/height ratios maintained
3. **Silhouette** - Iconic shapes preserved for recognition
4. **Material Hints** - Surface characteristics (metal, organic, etc.)

## Form-Specific Generators

### SpriteGenerator

Creates 2D pixel art sprites with configurable styles:

- `NES_8BIT` - 4 colors, blocky pixels
- `SNES_16BIT` - 16 colors, better shading
- `GENESIS_16BIT` - High contrast, dithered gradients
- `MODERN_PIXEL` - Full alpha, smooth gradients

### VoxelGenerator

Creates voxel models with configurable styles:

- `CLASSIC` - Minecraft-style blocks
- `SMOOTH` - Smoother voxel clusters
- `CROSS_HATCH` - Cross-hatch pattern for detail
- `HEIGHT_MAP` - Height-map based extrusion

### MeshGenerator

Creates 3D meshes with configurable styles:

- `LOW_POLY` - Low poly, PS2 era
- `STANDARD` - Standard polygon count
- `HIGH_POLY` - High detail mesh
- `OPTIMIZED` - Optimized for real-time

Supports skeletal animation and LOD levels.

## Quality Levels

| Level | Description | Use Case |
|-------|-------------|----------|
| `DRAFT` | Fast generation, lower quality | Preview, prototyping |
| `STANDARD` | Balanced quality/speed | Default production |
| `HIGH` | High quality with refinement | Final assets |
| `ULTRA` | Maximum quality, slower | Hero assets, cinematics |

## Style Priority

| Priority | Description |
|----------|-------------|
| `COLOR_EXACT` | Exact color match, may limit form conversion |
| `BALANCED` | Balanced color and form adaptation (default) |
| `FORM_FOCUSED` | Prioritize form correctness over color |

## Architecture

```
asset-regeneration/
├── types.ts              # Type definitions
├── regenerator.ts        # Main orchestrator
├── sprite-generator.ts   # 2D sprite generation
├── voxel-generator.ts    # Voxel model generation
├── mesh-generator.ts     # 3D mesh generation
├── style-preserver.ts    # Cross-form consistency
├── cache-manager.ts      # Caching layer
├── batch-regenerator.ts  # Batch processing
├── comparison-viewer.ts  # Side-by-side comparison
├── index.ts              # Public API
└── package.json          # Dependencies
```

## License

MIT
