# Voxel AI Asset Integration Worker

> Integrates Zylann's Voxel Tools, GDAI MCP Plugin, LimboAI, Ollama, Meshy AI, and Leonardo AI for StudyLoG.AI and DMLoG.AI

## Overview

This Cloudflare Worker provides a unified backend for voxel/AI asset generation and NPC dialogue in Godot-based games. It combines multiple AI services to enable:

- **Procedural voxel terrain generation** with AI-enhanced biomes
- **Local LLM NPC dialogue** using Ollama (no API keys required)
- **Runtime 3D model generation** via Meshy AI
- **Dynamic texture generation** via Leonardo AI
- **AI-assisted Godot development** via GDAI MCP Plugin
- **Behavior tree state synchronization** with LimboAI
- **AI Creator NPCs** that can build assets during gameplay

## Technologies Integrated

| Technology | Purpose | Integration |
|------------|---------|-------------|
| **Zylann's Voxel Tools** | Volumetric data access, terrain editing | VoxelGeneratorScript generation |
| **GDAI MCP Plugin** | AI-assisted Godot development | Scene/script generation |
| **LimboAI** | Behavior trees, state machines | State sync, tree management |
| **Ollama** | Local LLM for NPC dialogue | Gemma, Llama, Phi models |
| **Meshy AI** | Text-to-3D generation | Runtime model import |
| **Leonardo AI** | Texture generation | PBR texture sets, voxel tiles |

## Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Deploy to Cloudflare
pnpm deploy

# Local development
pnpm dev
```

## Environment Variables

```bash
# Ollama (Local LLM - no API key needed)
OLLAMA_ENDPOINT=http://localhost:11434
OLLAMA_DEFAULT_MODEL=gemma3:1b

# Meshy AI (3D Model Generation)
MESHY_API_KEY=your_meshy_api_key

# Leonardo AI (Texture Generation)
LEONARDO_API_KEY=your_leonardo_api_key

# Godot Bridge (Optional)
GODOT_BRIDGE_URL=ws://localhost:7352

# Multi-Model Router (Optional)
MULTI_MODEL_ROUTER_URL=https://your-router.example.com
```

## API Endpoints

### Voxel Terrain Generation

```http
POST /generate/terrain
Content-Type: application/json

{
  "generatorId": "cognitive_mill",
  "position": { "x": 0, "y": 0, "z": 0 },
  "chunkSize": { "x": 16, "y": 32, "z": 16 },
  "seed": 12345,
  "lod": 0
}
```

### 3D Model Generation (Meshy AI)

```http
POST /generate/model
Content-Type: application/json

{
  "prompt": "A rusty iron pickaxe",
  "voxelStyle": true,
  "format": "glb",
  "quality": "standard",
  "productContext": "dmlog"
}
```

### Texture Generation (Leonardo AI)

```http
POST /generate/texture
Content-Type: application/json

{
  "prompt": "Alien purple moss, seamless",
  "size": "1024x1024",
  "textureType": "albedo",
  "seamless": true,
  "productContext": "studylog"
}
```

### NPC Dialogue (Ollama)

```http
POST /npc/dialogue
Content-Type: application/json

{
  "characterId": "npc_123",
  "playerMessage": "Hello, what can you tell me about this place?",
  "context": {
    "location": "Cognitive Mill",
    "nearbyEntities": ["TokenRiver", "CogBridge"],
    "currentActivity": "exploring",
    "timeOfDay": "day"
  }
}
```

### AI Creator NPC Request

```http
POST /npc/creator/request
Content-Type: application/json

{
  "npcId": "creator_bot",
  "playerId": "player_456",
  "request": "Build me a golden dragon statue",
  "type": "model",
  "constraints": {
    "voxelStyle": true,
    "qualityTier": "standard",
    "maxCostUsd": 0.10
  },
  "context": {
    "location": { "x": 100, "y": 32, "z": 200 },
    "currentBiome": "castle"
  }
}
```

### Biome Information

```http
# List all biomes
GET /biomes?context=studylog

# Get specific biome
GET /biomes/cognitive_mill

# StudyLoG.AI biomes
GET /studylog/biomes

# DMLoG.AI biomes
GET /dmlog/biomes
```

## StudyLoG.AI Integration

### Biomes for Education

- **Cognitive Mill** - Visualization of AI model processing
- **Intelligence Ranch** - Agent training simulation
- **Sitka Sound** - Aquatic ecosystem for flocking behaviors
- **Science Lab** - Laboratory for experiments
- **Math Mountain** - Mathematical concept visualization
- **Physics Valley** - Physical laws demonstration

### Usage Example

```typescript
import { createVoxelGeneratorService } from '@studylog/voxel-ai-worker';

const generator = createVoxelGeneratorService(env);

// Generate terrain for Cognitive Mill
const terrain = await generator.generateTerrain({
  generatorId: 'cognitive_mill',
  position: { x: 0, y: 0, z: 0 },
  chunkSize: { x: 16, y: 32, z: 16 },
  seed: 42,
  lod: 0,
});

// Get biome information
const biome = generator.getBiomeInfo('cognitive_mill');
```

## DMLoG.AI Integration

### Biomes for TTRPG

- **Dungeon** - Dark underground with corridors and treasures
- **Wilderness** - Untamed natural landscape
- **City** - Bustling medieval city
- **Underdark** - Vast underground realm
- **Planar** - Otherworldly dimensions
- **Castle** - Fortified stronghold
- **Seafaring** - Open ocean adventures

### Usage Example

```typescript
import { createAICreatorNPCManager, createDMLoGCreatorNPC } from '@studylog/voxel-ai-worker';

const manager = createAICreatorNPCManager(env);

// Register the Arcane Artificer NPC
const creator = createDMLoGCreatorNPC();
const npcId = await manager.registerCreator(creator);

// Player requests a custom item
const response = await manager.processRequest({
  npcId,
  playerId: 'adventurer_123',
  request: 'Craft me a magical sword with runes of fire',
  context: {
    location: { x: 150, y: 30, z: 300 },
    currentBiome: 'castle',
  },
});
```

## AI Creator NPC Flow

```
Player Request
      |
      v
[AI Creator NPC]
      |
      +-> 1. Receive request via LimboAI
      |
      +-> 2. Process with Ollama (understand intent)
      |
      +-> 3. Route to appropriate service:
      |     - Meshy AI for models
      |     - Leonardo AI for textures
      |     - Voxel Generator for terrain
      |
      +-> 4. Generate asset
      |
      +-> 5. Import into Godot scene
      |
      +-> 6. Update behavior tree state
      |
      +-> 7. Provide dialogue feedback
```

## Database Schema

```sql
-- NPC Characters
CREATE TABLE npc_characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    personality TEXT,
    backstory TEXT,
    knowledge TEXT,
    relationships TEXT,
    dialogue_style TEXT,
    product_context TEXT,
    system_prompt TEXT,
    model TEXT,
    ollama_endpoint TEXT
);

-- AI Creator NPCs
CREATE TABLE ai_creator_npcs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    character_profile TEXT,
    behavior_tree TEXT,
    capabilities TEXT,
    state TEXT
);

-- Behavior Trees
CREATE TABLE behavior_trees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    root_node TEXT,
    blackboard TEXT,
    variables TEXT,
    created_at INTEGER
);

-- Voxel Materials
CREATE TABLE voxel_materials (
    block_type_id INTEGER PRIMARY KEY,
    texture_set TEXT,
    uv_scale TEXT,
    material_properties TEXT
);

-- Meshy Generations
CREATE TABLE meshy_generations (
    task_id TEXT PRIMARY KEY,
    user_id TEXT,
    prompt TEXT,
    status TEXT,
    model_url TEXT,
    created_at INTEGER
);
```

## File Structure

```
voxel-ai/
├── index.ts                 # Main Cloudflare Worker entry point
├── types.ts                 # TypeScript type definitions
├── gdai-mcp.ts              # GDAI MCP Plugin integration
├── limboai-bridge.ts        # LimboAI behavior tree sync
├── ollama-dialogue.ts       # Ollama NPC dialogue
├── voxel-generator.ts       # Voxel terrain generation
├── meshy-runtime.ts         # Meshy AI 3D model import
├── leonardo-textures.ts     # Leonardo AI texture generation
├── ai-creator-npc.ts        # AI Creator NPC implementation
├── package.json             # Package configuration
├── tsconfig.json            # TypeScript configuration
├── wrangler.toml            # Cloudflare Worker config
└── README.md                # This file
```

## Contributing

When contributing to this module:

1. Maintain compatibility with both StudyLoG.AI and DMLoG.AI
2. Use product-agnostic APIs where possible
3. Add tests for new features
4. Update this README with new endpoints
5. Follow the existing code style

## License

MIT

## Authors

SuperInstance.AI - Building the Minecraft of generative agent-based open worlds.
