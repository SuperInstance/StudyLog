# 3D Asset API - StudyLoG.AI / DMLoG.AI

Multi-provider 3D model and world generation API for SuperInstance.AI products. Supports intelligent routing between 6 leading 3D generation providers with automatic fallback, cost optimization, and Godot Engine integration.

## Features

- **Multi-Provider Support**: Hunyuan 3D, Sloyd AI, Masterpiece X, Tripo AI, Rodin Gen-2, Meshy AI
- **Smart Routing**: Automatic provider selection based on request type, quality, cost, and speed requirements
- **Quality Tiers**: Draft, Preview, Standard, High, Ultra - with transparent pricing
- **Godot Integration**: Native GLB/GLTF support, scene file generation, LOD creation
- **Batch Processing**: Generate multiple assets in parallel with fail-fast options
- **Cost Estimation**: Compare pricing across providers before generation
- **Provider Health Monitoring**: Automatic fallback to healthy providers

## Supported Providers

| Provider | Specializes In | Pricing | Rigging | Animation |
|----------|---------------|---------|---------|-----------|
| **Tencent Hunyuan 3D** | Text/image/sketch to 3D, HY-World environments | $0.10/model | - | - |
| **Sloyd AI** | Parametric models, buildings, weapons, furniture | $0.05/model | - | - |
| **Masterpiece X** | Rigged characters, creatures | $0.08/model | Yes | Yes |
| **Tripo AI** | Character generation, mesh segmentation | $0.08/model | Yes | - |
| **Rodin Gen-2** | Texture baking, Godot plugin | $0.07/model | - | - |
| **Meshy AI** | Mesh cleanup, optimization | $0.06/model | - | - |

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/SuperInstance/studylog-github
cd studylog-github/backend/workers/asset-3d

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start development server
npm run dev
```

### Configuration

Set your provider API keys as environment variables:

```bash
# Hunyuan 3D (Tencent)
wrangler secret put HUNYUAN_API_KEY

# Sloyd AI
wrangler secret put SLOYD_API_KEY

# Masterpiece X
wrangler secret put MASTERPIECE_X_API_KEY

# Tripo AI
wrangler secret put TRIPO_API_KEY

# Rodin Gen-2
wrangler secret put RODIN_API_KEY

# Meshy AI
wrangler secret put MESHY_API_KEY
```

### Deploy to Cloudflare

```bash
# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging
```

## API Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": 1704921600000
  }
}
```

### Generate 3D Model

```http
POST /generate/model
Content-Type: application/json

{
  "prompt": "A futuristic sci-fi laser pistol",
  "quality": "standard",
  "format": "glb",
  "style": "realistic",
  "category": "weapon",
  "includeRigging": false,
  "preferredProvider": "sloyd"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "assetId": "abc123...",
    "status": "processing",
    "estimatedTimeSeconds": 5,
    "pollUrl": "/api/v1/assets/3d/status/abc123...",
    "provider": "sloyd",
    "costUsd": 0.05
  },
  "requestId": "xyz789...",
  "timestamp": 1704921600000
}
```

### Generate 3D Environment

```http
POST /generate/environment
Content-Type: application/json

{
  "prompt": "A misty medieval dungeon with stone walls and torches",
  "sceneType": "dungeon",
  "areaSize": [50, 10, 50],
  "objectCount": 50,
  "includeNavmesh": true,
  "includeCollision": true,
  "bakeLighting": false,
  "timeOfDay": "night",
  "weather": "fog"
}
```

### Batch Generation

```http
POST /generate/batch
Content-Type: application/json

{
  "requests": [
    { "prompt": "Wooden chair", "category": "furniture" },
    { "prompt": "Stone table", "category": "furniture" },
    { "prompt": "Iron sword", "category": "weapon" }
  ],
  "parallel": true,
  "failFast": false
}
```

### Check Generation Status

```http
GET /status/:assetId/:provider
```

### Import to Godot

```http
POST /import/godot
Content-Type: application/json

{
  "assetId": "abc123...",
  "importPath": "res://assets/models/",
  "generateLOD": true,
  "lodLevels": 3,
  "importAsSkeleton": false,
  "generateCollision": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assetId": "abc123...",
    "importPath": "res://assets/imported/abc123.../",
    "files": [
      { "path": "abc123....tscn", "type": "scene" },
      { "path": "abc123....import", "type": "import" },
      { "path": "collision.tres", "type": "resource" }
    ],
    "scenePath": "res://assets/imported/abc123.../abc123....tscn",
    "success": true
  }
}
```

### Estimate Costs

```http
POST /costs/estimate
Content-Type: application/json

{
  "prompt": "A fantasy sword",
  "quality": "high",
  "includeRigging": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "request": { ... },
    "estimates": [
      { "provider": "sloyd", "estimatedCostUsd": 0.05 },
      { "provider": "meshy", "estimatedCostUsd": 0.09 },
      { "provider": "rodin", "estimatedCostUsd": 0.07 }
    ],
    "recommendedProvider": "sloyd"
  }
}
```

### Provider Status

```http
GET /providers/status
```

### Provider Capabilities

```http
GET /providers/capabilities
```

## Request Options

### GenerateModelRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Text description of the model |
| `negativePrompt` | string | No | Things to avoid |
| `inputImage` | string | No | Base64 or URL for image-to-3D |
| `inputSketch` | string | No | Base64 or URL for sketch-to-3D |
| `format` | string | No | Output format (glb, gltf, fbx, obj) |
| `quality` | string | No | Quality tier (draft, preview, standard, high, ultra) |
| `style` | string | No | Art style (realistic, stylized, cartoon, etc.) |
| `polygonTarget` | number | No | Target polygon count |
| `includeRigging` | boolean | No | Include skeletal rigging |
| `includeAnimation` | boolean | No | Include animations |
| `category` | string | No | Asset category for routing |
| `preferredProvider` | string | No | Force specific provider |
| `maxCostUsd` | number | No | Maximum cost per generation |
| `maxTimeSeconds` | number | No | Maximum wait time |

### GenerateEnvironmentRequest

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | Yes | Environment description |
| `sceneType` | string | Yes | terrain, building, city, nature, dungeon, interior |
| `areaSize` | number[3] | No | [width, height, depth] in units |
| `objectCount` | number | No | Target object count |
| `includeNavmesh` | boolean | No | Generate navigation mesh |
| `includeCollision` | boolean | No | Generate collision shapes |
| `bakeLighting` | boolean | No | Pre-bake lighting |
| `timeOfDay` | string | No | day, night, dawn, dusk |
| `weather` | string | No | clear, rain, snow, fog, storm |

## Quality Tiers

| Tier | Description | Avg Polygons | Texture Size | Use Case |
|------|-------------|--------------|--------------|----------|
| `draft` | Quick preview | 500 | 512 | Prototype, blocking |
| `preview` | Medium quality | 2,000 | 1024 | Review, iteration |
| `standard` | Production ready | 10,000 | 1024 | Most assets |
| `high` | High detail | 25,000 | 2048 | Key assets, close-ups |
| `ultra` | Maximum quality | 50,000 | 4096 | Hero assets, cinematics |

## Provider Selection

The API automatically selects the best provider based on:

1. **Request Category**: Characters go to character specialists
2. **Quality Requirements**: High-quality requests to premium providers
3. **Cost Constraints**: Respects max cost settings
4. **Time Constraints**: Fast providers for quick results
5. **Provider Health**: Avoids degraded services
6. **User Preferences**: Honors preferred provider if available

### Category Routing

| Category | Primary Provider | Fallback |
|----------|------------------|----------|
| `character` | masterpiece_x | tripo |
| `creature` | masterpiece_x | tripo |
| `weapon` | sloyd | meshy |
| `armor` | sloyd | rodin |
| `furniture` | sloyd | meshy |
| `architecture` | sloyd | hunyuan |
| `environment` | hunyuan | - |
| `prop` | meshy | sloyd |

## Godot Integration

### Automatic Import Settings

Generated assets include optimized `.import` files for Godot 4.2+:

```toml
[remap]
importer="scene_gltf"
type="PackedScene"
path="res://assets/models/model.glb"

[params]
generate_tangents=true
compress/textures=true
scale/factor=1.0
```

### LOD Generation

Generate multiple LOD levels for optimal performance:

```
LOD 0: 100% polygons, 0-10 units
LOD 1: 50% polygons, 10-25 units
LOD 2: 25% polygons, 25-50 units
```

### Scene Structure

Generated scenes include:
- Root node (Node3D or Skeleton3D)
- Model instance
- Collision shape (optional)
- LOD management script (if applicable)

## Usage Examples

### StudyLoG.AI - Educational Models

```typescript
// Generate a science visualization
const response = await fetch('/generate/model', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Detailed human heart model with chambers and valves',
    quality: 'high',
    category: 'prop',
    productContext: 'studylog'
  })
});
```

### DMLoG.AI - TTRPG Assets

```typescript
// Generate a dungeon monster
const response = await fetch('/generate/model', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Terrifying goblin warrior with rusty armor',
    quality: 'standard',
    category: 'creature',
    includeRigging: true,
    productContext: 'dmlog'
  })
});
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": "Rate limit exceeded. Retry after 30 seconds.",
  "errorCode": "429",
  "requestId": "abc123...",
  "timestamp": 1704921600000
}
```

Common error codes:
- `400` - Invalid request
- `401` - Missing/invalid API key
- `429` - Rate limit exceeded
- `500` - Provider error
- `503` - Service unavailable

## Rate Limits

| Provider | Requests/Minute | Requests/Day |
|----------|-----------------|--------------|
| Hunyuan 3D | 60 | 1,000 |
| Sloyd AI | 30 | 1,000 |
| Masterpiece X | 10 | 500 |
| Tripo AI | 20 | 500 |
| Rodin Gen-2 | 15 | 300 |
| Meshy AI | 30 | 1,000 |

## Development

### Type Checking

```bash
npm run typecheck
```

### Testing

```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Linting

```bash
npm run lint
```

## Architecture

```
asset-3d/
├── providers/
│   ├── hunyuan.ts       # Tencent Hunyuan 3D
│   ├── sloyd.ts         # Sloyd AI
│   ├── masterpiece-x.ts # Masterpiece X
│   ├── tripo.ts         # Tripo AI
│   ├── rodin.ts         # Rodin Gen-2
│   └── meshy.ts         # Meshy AI
├── model-router.ts      # Smart provider routing
├── godot-importer.ts    # Godot format conversion
├── types.ts             # Type definitions
├── index.ts             # Cloudflare Worker entry
├── package.json
├── tsconfig.json
└── wrangler.toml
```

## License

MIT

## Support

- GitHub Issues: https://github.com/SuperInstance/studylog-github/issues
- Documentation: https://docs.studylog.ai
- Discord: https://discord.gg/studylog
