# Quality Scaling System

**Adaptive 3D Quality Scaling for SuperInstance.AI**

A comprehensive quality scaling system that adapts visual fidelity from low-end voxels to high-end 3D based on hardware capabilities and user budget constraints.

## Overview

The Quality Scaling System provides:

1. **Hardware Detection** - GPU/CPU capability detection
2. **Budget Management** - User subscription tier quality constraints
3. **Performance Monitoring** - Real-time FPS/latency tracking
4. **Adaptive Scaling** - Dynamic quality adjustment
5. **Asset LOD** - Level of Detail system with voxel fallbacks
6. **Voxel to 3D** - Runtime quality upgrade paths

## Quality Tiers

| Tier | Name | Description |
|------|------|-------------|
| 0 | Potato | Pure voxels, 2D sprites, minimal effects |
| 1 | Low | Simple 3D, low poly, basic lighting |
| 2 | Medium | Standard 3D, shaders, basic effects |
| 3 | High | Detailed 3D, PBR materials, shadows |
| 4 | Ultra | Cinematic, ray tracing, maximum detail |

## Budget Tiers

| Tier | Max Quality | Daily Allowance |
|------|-------------|-----------------|
| Free | LOW | $0.00 |
| Basic | MEDIUM | $0.50 |
| Premium | HIGH | $2.00 |
| Unlimited | ULTRA | Unlimited |

## Installation

```bash
pnpm install
```

## Usage

### Quick Start

```typescript
import { setupQualitySession } from './index.js';

const session = await setupQualitySession('session-123', 'user-456');
console.log(`Recommended tier: ${session.qualityTier}`);
```

### Hardware Detection

```typescript
import { detectHardware } from './index.js';

const hardware = await detectHardware({
  clientGpuInfo: {
    vendor: 'nvidia',
    renderer: 'NVIDIA GeForce RTX 3080',
  },
  clientSystemInfo: {
    cores: 8,
    memory: 16384,
  },
});
```

### Asset LOD

```typescript
import { getAssetUrl, registerAssetLOD, createAssetLOD } from './index.js';

// Register an asset with LOD levels
registerAssetLOD(createAssetLOD(
  'model-123',
  'model',
  'https://cdn.example.com/models/model-123',
  {
    hasVoxelFallback: true,
    voxelUrl: 'https://cdn.example.com/models/model-123/voxel',
  }
));

// Get appropriate asset URL
const asset = getAssetUrl({
  assetId: 'model-123',
  qualityTier: QualityTier.MEDIUM,
  distance: 50,
});
```

### Performance Monitoring

```typescript
import { startTracking, reportPerformance } from './index.js';

// Start tracking
startTracking('session-123');

// Report metrics
const response = reportPerformance({
  sessionId: 'session-123',
  metrics: {
    fps: 58,
    frameTime: 17.2,
    gpuUsage: 75,
    cpuUsage: 45,
    memoryUsage: 4096,
    memoryPercent: 50,
    latency: 12,
    timeToFirstFrame: 120,
    timestamp: new Date().toISOString(),
  },
  triggerAdaptive: true,
});
```

## StudyLoG.AI Integration

Educational simulations scale from basic charts to full VR:

```typescript
// Potato tier: 2D charts and voxel models
// Low tier: Simple 3D with basic interaction
// Medium tier: Standard 3D with physics
// High tier: Detailed models with advanced effects
// Ultra tier: Full VR with haptic feedback
```

## DMLoG.AI Integration

Battle maps from 2D tokens to full 3D miniatures:

```typescript
// Potato tier: 2D token sprites
// Low tier: Simple 3D tokens
// Medium tier: Standard 3D miniatures
// High tier: Detailed miniatures with animations
// Ultra tier: Full 3D with dynamic lighting
```

## API Endpoints

### POST /detect
Detect hardware capabilities and get quality recommendations.

**Request:**
```json
{
  "clientGpuInfo": {
    "vendor": "nvidia",
    "renderer": "NVIDIA GeForce RTX 3080"
  },
  "clientSystemInfo": {
    "cores": 8,
    "memory": 16384
  }
}
```

**Response:**
```json
{
  "hardware": { ... },
  "recommendedTier": 3,
  "maxTier": 4,
  "constraints": { ... },
  "settings": { ... }
}
```

### POST /quality/set
Set quality tier for a session.

**Request:**
```json
{
  "userId": "user-123",
  "sessionId": "session-456",
  "tier": 2
}
```

### POST /performance/report
Report performance metrics.

**Request:**
```json
{
  "sessionId": "session-456",
  "metrics": {
    "fps": 58,
    "frameTime": 17.2,
    ...
  },
  "triggerAdaptive": true
}
```

### GET /asset/:assetId
Get asset URL at appropriate quality level.

**Query Parameters:**
- `qualityTier` (0-4)
- `distance` (optional, for LOD)
- `screenSize` (optional, for LOD)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Quality Scaling System                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │  Hardware   │ │   Budget     │ │ Performance │ │  Asset   │ │
│  │  Detector   │ │   Manager    │ │  Monitor    │ │    LOD   │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └──────────┘ │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │   Quality   │ │   Adaptive   │ │   Voxel     │ │ Presets  │ │
│  │   Manager   │ │   Scaler    │ │   to 3D     │ │          │ │
│  └─────────────┘ └──────────────┘ └─────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../../../../CONTRIBUTING.md)
