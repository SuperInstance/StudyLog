# SuperInstance.AI - Asset Generation API Guide

**Comprehensive documentation for all asset generation APIs including pricing, usage examples, and integration guides for StudyLoG.AI and DMLoG.AI**

---

## Table of Contents

1. [Overview](#overview)
2. [3D Model APIs](#3d-model-apis)
3. [Audio/Voice APIs](#audiovoice-apis)
4. [2D Art APIs](#2d-art-apis)
5. [Comparison Tables](#comparison-tables)
6. [Integration Examples](#integration-examples)
7. [Best Practices](#best-practices)
8. [Cost Optimization](#cost-optimization)

---

## Overview

The SuperInstance.AI asset generation system provides unified access to multiple AI asset generation providers across three categories:

- **3D Models**: Characters, creatures, props, environments
- **Audio/Voice**: TTS, voice cloning, sound effects, lip sync
- **2D Art**: Sprites, pixel art, concept art, UI icons, tilesets

### Architecture

```
User Request
      |
      v
+-----------------+
|  Asset Router   | <--- Smart provider selection
+-----------------+
      |
      +----+----+----+----+
      |    |    |    |    |
      v    v    v    v    v
   [3D] [Audio] [2D] [Cache] [Queue]
```

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Product Context** | `studylog`, `dmlog`, `makerlog`, `fishinglog`, `general` |
| **Quality Tier** | `draft`, `preview`, `standard`, `high`, `ultra` |
| **Asset Provider** | The underlying service generating the asset |
| **Smart Routing** | Automatic provider selection based on request constraints |

---

## 3D Model APIs

### Provider Summary

| Provider | Best For | Pricing | Speed | Quality |
|----------|----------|---------|-------|---------|
| **Tencent Hunyuan 3D** | Environments, terrain | $0.10/gen | 60s | High |
| **Sloyd AI** | Props, fast generation | $0.05/gen | 5s | Medium |
| **Masterpiece X** | Rigged characters | $0.05-0.10/gen | 120s | High |
| **Tripo AI** | Characters with rigging | $0.08-0.13/gen | 90s | High |
| **Rodin Gen-2** | High quality models | $0.07/gen | 45s | Very High |
| **Meshy AI** | Text/image to 3D | $0.06/gen | 60s | Medium |

---

### 1. Tencent Hunyuan 3D

**API Endpoint**: `https://hunyuan.tencent.com/api/v1`

**Specialization**: Large-scale environment generation, HY-World 1.5

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Text to 3D | $0.10 | 60 req/min, 1000/day |
| Image to 3D | $0.10 | 60 req/min, 1000/day |
| Sketch to 3D | $0.08 | 60 req/min, 1000/day |
| Environment | $1.00 | 10 req/min, 100/day |

#### Capabilities

```typescript
interface HunyuanCapabilities {
    textTo3D: true;
    imageTo3D: true;
    sketchTo3D: true;          // Unique capability
    environmentGen: true;      // Best in class
    rigging: false;
    animation: false;
    textureBaking: false;
    avgTimeSeconds: 60;
}
```

#### API Usage

**Text to 3D**

```typescript
const request = {
    prompt: "A fantasy sword with glowing runes",
    negativePrompt: "blurry, low quality",
    format: "glb",
    quality: "high",
    style: "realistic"
};

const response = await fetch('https://hunyuan.tencent.com/api/v1/3d/text', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${HUNYUAN_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});

const { data } = await response.json();
// Returns: { taskId, status, modelUrl?, thumbnailUrl? }
```

**Environment Generation**

```typescript
const envRequest = {
    model: 'hy-world-1.5',
    prompt: "Mystical forest with ancient ruins, fog, ambient lighting",
    sceneType: 'nature',
    areaSize: [100, 20, 100],  // width, height, depth
    objectCount: 100,
    includeNavmesh: false,
    includeCollision: true,
    bakeLighting: false,
    style: 'realistic',
    timeOfDay: 'dawn',
    weather: 'fog'
};
```

**Response Format**

```typescript
interface HunyuanResponse {
    code: number;
    message: string;
    data: {
        taskId: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        modelUrl?: string;
        thumbnailUrl?: string;
    };
}
```

**Polling for Completion**

```typescript
async function waitForTask(taskId: string, timeout = 300000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const response = await fetch(`/api/v1/3d/task/${taskId}`);
        const { data } = await response.json();

        if (data.status === 'completed') return data;
        if (data.status === 'failed') throw new Error('Generation failed');

        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Timeout');
}
```

#### Best Practices

1. **Environment Prompts**: Use detailed descriptions for environments (100+ characters)
2. **Sketch Input**: Use simple line drawings with clear outlines
3. **Batch Environments**: Limit to 10 concurrent environment requests
4. **Cache Results**: Environment generation is expensive - cache aggressively

---

### 2. Sloyd AI

**API Endpoint**: `https://api.sloyd.ai`

**Specialization**: Fast parametric model generation, UV unwrapping, LOD

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Text to 3D | $0.05 | 60 req/min |
| Template Generation | $0.03 | 100 req/min |
| LOD Export | Included | - |

**Free Tier**: 100 generations/month

#### Capabilities

```typescript
interface SloydCapabilities {
    textTo3D: true;
    imageTo3D: false;
    sketchTo3D: false;
    environmentGen: false;
    rigging: false;
    animation: false;
    meshOptimization: true;      // Unique: LOD generation
    lodGeneration: true;
    avgTimeSeconds: 5;
}
```

#### API Usage

**Generate from Template**

```typescript
const request = {
    templateId: 'chair-modern-001',
    parameters: {
        seatHeight: 0.5,
        backrestAngle: 15,
        armrests: true,
        material: 'wood',
        color: '#8B4513'
    },
    outputFormat: 'glb',
    generateLOD: true,
    lodLevels: 3
};

const response = await fetch('https://api.sloyd.ai/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${SLOYD_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Response Format**

```typescript
interface SloydResponse {
    model: {
        glb: string;              // URL to GLB file
        obj?: string;             // Optional OBJ export
        fbx?: string;             // Optional FBX export
        thumbnail: string;
        metadata: {
            polygons: number;
            vertices: number;
            textures: number;
        };
    };
}
```

#### Available Templates

| Category | Template Count | Examples |
|----------|----------------|----------|
| Furniture | 150+ | chair-table-001, sofa-modern-002 |
| Props | 300+ | barrel-wooden, chest-treasure |
| Weapons | 100+ | sword-medieval, bow-short |
| Architecture | 80+ | house-cottage, tower-stone |

#### Best Practices

1. **Use Templates**: Template-based generation is 10x faster than text-to-3D
2. **LOD for Games**: Always generate LOD levels for real-time applications
3. **UV Unwrapping**: Sloyd provides clean UVs suitable for texturing
4. **Batch Props**: Generate multiple props in parallel for scene population

---

### 3. Masterpiece X

**API Endpoint**: `https://api.masterpiecex.com/v1`

**Specialization**: Rigged and animated characters

#### Pricing Model

| Operation | Cost | Notes |
|-----------|------|-------|
| Text to 3D | $0.05 | Subscription required |
| Character Generation | $0.05 | Base cost |
| With Rigging | +$0.02 | Full skeletal rig |
| With Animation | +$0.03 | Idle, walk, run |
| Textures | Included | PBR materials |

**Subscription Tiers**:
- Starter: $29/month - 500 generations
- Pro: $99/month - 2000 generations
- Enterprise: Custom

#### Capabilities

```typescript
interface MasterpieceXCapabilities {
    textTo3D: true;
    imageTo3D: true;
    rigging: true;              // Best in class
    animation: true;            // Best in class
    textureBaking: false;
    avgTimeSeconds: 120;
}
```

#### API Usage

**Generate Character**

```typescript
const request = {
    prompt: "Female elven ranger with leather armor, long blonde hair, green cloak",
    style: "fantasy",
    format: "glb",
    includeRigging: true,
    includeAnimation: true,
    animations: ['idle', 'walk', 'run', 'attack'],
    textureQuality: 'high',
    polygonTarget: 15000
};

const response = await fetch('https://api.masterpiecex.com/v1/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${MASTERPIECE_X_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Response Format**

```typescript
interface MasterpieceXResponse {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    result?: {
        glb: string;
        thumbnail: string;
        rigInfo?: {
            boneCount: number;
            animationNames: string[];
        };
    };
}
```

#### Animation Options

| Animation | Frames | Duration |
|-----------|--------|----------|
| idle | 30 | 1 sec |
| walk | 24 | 0.8 sec |
| run | 20 | 0.67 sec |
| attack | 15 | 0.5 sec |
| hurt | 10 | 0.33 sec |
| death | 30 | 1 sec |

#### Best Practices

1. **Character Prompts**: Include gender, race, clothing, equipment, style
2. **Animation First**: Always request rigging if you might need animations later
3. **Polygon Budget**: Specify polygon targets (10K-30K for game characters)
4. **Godot Import**: Use GLB format for direct Godot 4.x import

---

### 4. Tripo AI

**API Endpoint**: `https://api.tripo3d.ai/v1`

**Specialization**: Character generation with automatic rigging and segmentation

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Text to 3D | $0.08 | 50 req/min |
| Image to 3D | $0.08 | 50 req/min |
| With Rigging | +$0.05 | Optional |
| With Segmentation | +$0.02 | Optional |

**Free Tier**: 50 generations/month

#### Capabilities

```typescript
interface TripoCapabilities {
    textTo3D: true;
    imageTo3D: true;
    rigging: true;              // Automatic rig generation
    segmentation: true;         // Unique: mesh segmentation
    animation: false;
    avgTimeSeconds: 90;
}
```

#### API Usage

**Generate with Rigging**

```typescript
const request = {
    prompt: "Orc warrior with plate armor and warhammer",
    modelVersion: 'v2',
    enableRigging: true,
    enableSegmentation: true,
    outputFormat: 'glb',
    quality: 'high'
};

const response = await fetch('https://api.tripo3d.ai/v1/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Response with Segmentation**

```typescript
interface TripoResponse {
    code: number;
    data: {
        id: string;
        status: string;
        model_url?: string;
        thumbnail_url?: string;
        segmentation?: {
            parts: TripoPart[];
            total_polygons: number;
            total_vertices: number;
        };
    };
}

interface TripoPart {
    name: string;              // "head", "chest", "left_arm", etc.
    polygon_count: number;
    vertex_count: number;
    material_index?: number;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}
```

#### Segmentation Parts

Characters are automatically segmented into:
- Head, Neck
- Chest, Abdomen
- Left/Upper Arm, Left/Forearm, Left Hand
- Right/Upper Arm, Right/Forearm, Right Hand
- Left/Upper Leg, Left/Lower Leg, Left Foot
- Right/Upper Leg, Right/Lower Leg, Right Foot

#### Best Practices

1. **Image to Character**: Upload concept art for consistent character generation
2. **Segmentation**: Enable for equipment customization and hitbox generation
3. **Rig Quality**: Tripo's rigging is good for basic animations
4. **DMLoG Integration**: Segmentation supports attachment system for equipment

---

### 5. Rodin Gen-2

**API Endpoint**: `https://api.rodin.ai/v2`

**Specialization**: High-quality model generation with texture baking

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Text to 3D | $0.07 | 40 req/min |
| Image to 3D | $0.07 | 40 req/min |
| Texture Baking | +$0.02 | PBR textures |

#### Capabilities

```typescript
interface RodinCapabilities {
    textTo3D: true;
    imageTo3D: true;
    textureBaking: true;        // Full PBR texture set
    meshOptimization: true;
    godotPlugin: true;          // Direct Godot integration
    avgTimeSeconds: 45;
}
```

#### API Usage

**Generate with Textures**

```typescript
const request = {
    prompt: "Ancient stone altar with mystical symbols",
    textureResolution: 1024,
    textureTypes: ['diffuse', 'normal', 'roughness', 'metallic', 'ao'],
    outputFormat: 'glb',
    optimizeMesh: true,
    targetPolygons: 8000
};

const response = await fetch('https://api.rodin.ai/v2/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${RODIN_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Texture Maps Response**

```typescript
interface RodinTextureMaps {
    diffuse: string;      // Base color
    normal: string;       // Normal map
    roughness: string;    // Roughness map
    metallic: string;     // Metallic map
    ao: string;           // Ambient occlusion
    curvature?: string;   // Curvature map (optional)
}
```

#### Godot Plugin Integration

Rodin offers a native Godot 4.x plugin:

```gdscript
# In Godot, load Rodin-generated asset
var rodin_asset = load("res://assets/rodin/altar.glb")
var mesh_instance = MeshInstance3D.new()
mesh_instance.mesh = rodin_asset

# Apply PBR textures
var material = StandardMaterial3D.new()
material.albedo_texture = load("res://assets/rodin/altar_diffuse.png")
material.normal_texture = load("res://assets/rodin/altar_normal.png")
material.roughness_texture = load("res://assets/rodin/altar_roughness.png")
mesh_instance.set_surface_override_material(0, material)
```

#### Best Practices

1. **PBR Workflows**: Always request full PBR texture set for realistic lighting
2. **Texture Resolution**: 1024x1024 is sufficient for most game props
3. **Mesh Optimization**: Enable for real-time applications
4. **Godot Pipeline**: Use GLB format for seamless Godot import

---

### 6. Meshy AI

**API Endpoint**: `https://api.meshy.ai/v1`

**Specialization**: Fast text/image to 3D with texture generation

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Text to 3D | $0.06 | 60 req/min |
| Image to 3D | $0.06 | 60 req/min |
| Texture Generation | +$0.01 | Per texture |

**Free Tier**: 50 generations/month

#### Capabilities

```typescript
interface MeshyCapabilities {
    textTo3D: true;
    imageTo3D: true;
    textureBaking: true;
    meshOptimization: true;
    mode: 'preview' | 'relax';   // Speed vs quality tradeoff
    avgTimeSeconds: 60;
}
```

#### API Usage

**Preview Mode (Fast)**

```typescript
const request = {
    prompt: "Wooden crate with iron reinforcements",
    mode: 'preview',             // Fast, lower quality
    enableTextures: true,
    outputFormat: 'glb'
};
```

**Relax Mode (Quality)**

```typescript
const request = {
    prompt: "Wooden crate with iron reinforcements",
    mode: 'relax',               // Slower, higher quality
    enableTextures: true,
    textureResolution: 512,
    textureStyle: 'realistic',
    outputFormat: 'glb'
};
```

**Response Format**

```typescript
interface MeshyResponse {
    id: string;
    status: string;
    model_urls?: {
        glb?: string;
        obj?: string;
        fbx?: string;
    };
    thumbnail_url?: string;
    texture_urls?: {
        diffuse?: string;
        normal?: string;
        roughness?: string;
    };
}
```

#### Best Practices

1. **Preview First**: Use preview mode for rapid iteration
2. **Relax for Final**: Switch to relax mode for production assets
3. **Image Reference**: Upload reference images for better consistency
4. **Texture Later**: Generate textures separately if you need variations

---

## Audio/Voice APIs

### Provider Summary

| Provider | Best For | Pricing | Latency | Quality |
|----------|----------|---------|---------|---------|
| **ElevenLabs** | TTS, voice cloning | $0.30/1K chars | 500ms | Excellent |
| **NVIDIA ACE** | Audio2Face | $0.001/sec | 2000ms | Excellent |
| **Coqui XTTS** | Open source TTS | Free (self-hosted) | 1000ms | Good |
| **Whisper** | Speech-to-text | $0.06/min | 2000ms | Excellent |
| **Piper** | Fast local TTS | Free | 100ms | Good |
| **Riva** | Enterprise ASR/TTS | $0.001/sec | 1000ms | Excellent |

---

### 1. ElevenLabs

**API Endpoint**: `https://api.elevenlabs.io/v1`

**Specialization**: High-quality text-to-speech, voice cloning, sound effects

#### Pricing Model

| Operation | Cost | Free Tier |
|-----------|------|-----------|
| TTS (all models) | $0.30/1K chars | 10K chars/month |
| Voice Cloning | $5.00/clone | 3 clones |
| Sound Effects | $0.01/generation | Included |

#### Models

| Model | Quality | Speed | Best For |
|-------|---------|-------|----------|
| `eleven_turbo_v2_5` | High | Fastest | Real-time, dialogue |
| `eleven_turbo_v2` | High | Fast | General use |
| `eleven_multilingual_v2` | Excellent | Medium | Localization |
| `eleven_monolingual_v1` | Good | Fast | English only |

#### API Usage

**Basic TTS**

```typescript
const request = {
    text: "Welcome to StudyLoG.AI, your AI-powered learning companion!",
    model_id: 'eleven_turbo_v2_5',
    voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: false
    }
};

const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
    method: 'POST',
    headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});

const audioBuffer = await response.arrayBuffer();
```

**Streaming TTS (for real-time)**

```typescript
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream', {
    method: 'POST',
    headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        text: longText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
});

const reader = response.body!.getReader();
while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Process audio chunk
    audioQueue.push(value);
}
```

**Voice Cloning**

```typescript
const cloneRequest = {
    name: "Professor Einstein",
    description: "German-accented scientific tutor voice",
    files: [{
        name: 'sample.mp3',
        content: base64AudioData  // 1-25 minutes of audio
    }]
};

const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(cloneRequest)
});

const { voice_id } = await response.json();
// Use voice_id in subsequent TTS requests
```

**Sound Effects Generation**

```typescript
const sfxRequest = {
    text: "Magical sparkles and chimes",
    duration_seconds: 3,
    prompt_influence: 0.3
};

const response = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(sfxRequest)
});

const { task_id } = await response.json();
// Poll for completion
```

#### Voice Selection

| Voice ID | Name | Gender | Accent | Best For |
|----------|------|--------|--------|----------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Female | American | Narration |
| `AZnzlk1XvdvUeBnXmlld` | Domi | Female | American | Character |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Female | American | Friendly |
| `ErXwobaYiN0WP9Lgc85a` | Antoni | Male | American | Authoritative |
| `D38z5RhdWvJvqFEgT9nQ` | Josh | Male | American | Casual |
| `Cwh6TVqTEPf7BmqFQYt3` | Fin | Male | Irish | Character |

#### Phoneme Timing for Lip Sync

```typescript
// ElevenLabs provides phoneme timing data
interface PhonemeTiming {
    phoneme: string;    // "ae", "s", "t", etc.
    startTime: number;  // seconds
    endTime: number;    // seconds
}

// Map phonemes to visemes (0-20)
const visemeMap: Record<string, number> = {
    'a': 0, 'e': 1, 'i': 2, 'o': 3, 'u': 4,
    'b': 5, 'p': 5, 'm': 6, 'f': 7, 'v': 7,
    // ... full mapping in types.ts
};
```

#### Best Practices

1. **Model Selection**: Use `turbo_v2_5` for most applications
2. **Voice Settings**: Default settings work well; adjust stability for consistency
3. **Streaming**: Use streaming for long-form content (>500 chars)
4. **Caching**: Cache TTS results aggressively - same input = same output
5. **Character Voices**: Clone voices for persistent character identities

---

### 2. NVIDIA ACE / Audio2Face

**API Endpoint**: `https://api.nvidia.com/ace/v1`

**Specialization**: Audio-driven facial animation

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Audio2Face | $0.001/sec audio | 100 req/min |
| Blendshape Export | Included | - |

#### Capabilities

```typescript
interface AceCapabilities {
    audio2face: true;            // Generate facial animation from audio
    streaming: false;
    phonemes: true;              // Phoneme-level timing
    frameRate: 30-60;            // Configurable
    avgTimeSeconds: 2;
}
```

#### API Usage

**Generate Animation**

```typescript
const request = {
    audio: audioData,             // ArrayBuffer or URL
    format: 'mp3',
    characterId: 'humanoid_base',
    outputFormat: 'blendshapes',
    frameRate: 60,
    includeBones: false,
    includeBlendshapes: true
};

const response = await fetch('https://api.nvidia.com/ace/v1/audio2face', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Response Format**

```typescript
interface Audio2FaceResponse {
    animationId: string;
    duration: number;
    frameCount: number;
    frameRate: number;
    blendshapes: BlendshapeFrame[];
}

interface BlendshapeFrame {
    frame: number;
    time: number;
    values: number[];           // 52 ARKit blendshapes
}
```

#### ARKit Blendshapes

Audio2Face generates 52 ARKit standard blendshapes:
- Brow: 4 shapes
- Eye: 8 shapes
- Jaw: 2 shapes
- Mouth: 16 shapes
- Nose: 3 shapes
- Cheek: 2 shapes
- Tongue: 1 shape
- And more...

#### Godot Integration

```gdscript
# Apply blendshapes to a MeshInstance3D
extends MeshInstance3D

var blendshape_data = load("res://animations/facial.json")

func _process(delta):
    var time = $AudioPlayer.get_playback_position()
    var frame = get_frame_at_time(blendshape_data, time)

    for i in range(frame.values.size()):
        set_blend_shape_value(i, frame.values[i])

func get_frame_at_time(data, time):
    var frame_idx = int(time * data.frame_rate)
    return data.blendshapes[frame_idx]
```

#### Best Practices

1. **Audio Quality**: Use clean audio without background noise
2. **Frame Rate**: 60 FPS for smooth facial animation
3. **Character Matching**: Use character-specific face meshes
4. **DMLoG Integration**: Essential for NPC dialogue scenes

---

### 3. Coqui XTTS

**Repository**: `https://github.com/coqui-ai/TTS`

**Specialization**: Open-source multilingual TTS with voice cloning

#### Pricing Model

**Free** (self-hosted)

**Cloud Options**:
- Hugging Face Inference: Free tier available
- Custom deployment: AWS/GCP/Azure costs apply

#### Capabilities

```typescript
interface CoquiCapabilities {
    tts: true;
    voiceCloning: true;          // Clone from 5-10 seconds
    languages: 15+;
    streaming: false;
    avgTimeSeconds: 1;
}
```

#### API Usage (Self-Hosted)

```bash
# Start Coqui TTS server
docker run -p 5002:5002 coqui-tts:latest
```

```typescript
// Generate speech
const request = {
    text: "Hello from StudyLoG.AI!",
    speaker_wav: "path/to/voice_sample.wav",
    language: "en"
};

const response = await fetch('http://localhost:5002/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
});

const audio = await response.arrayBuffer();
```

#### Voice Cloning

```typescript
// Clone voice from short sample (5-10 seconds)
const cloneRequest = {
    text: "Any text will work!",
    speaker_wav_url: "https://example.com/voice_sample.wav",
    language: "en"
};
```

#### Supported Languages

| Code | Language | Voice Cloning |
|------|----------|---------------|
| en | English | Yes |
| es | Spanish | Yes |
| fr | French | Yes |
| de | German | Yes |
| it | Italian | Yes |
| pt | Portuguese | Yes |
| ja | Japanese | Yes |
| ko | Korean | Yes |
| zh | Chinese | Yes |

#### Best Practices

1. **Self-Hosting**: Recommended for cost savings at scale
2. **Voice Samples**: Use clean, 5-10 second samples for cloning
3. **GPU Acceleration**: Use GPU for faster generation
4. **Fallback**: Use as fallback to paid services

---

### 4. Whisper (OpenAI)

**API Endpoint**: `https://api.openai.com/v1/audio`

**Specialization**: Speech-to-text transcription

#### Pricing Model

| Model | Cost | Max Duration |
|-------|------|--------------|
| whisper-1 | $0.006/minute | 10 minutes |
| whisper-large-v3 | Self-hosted | Unlimited |

#### API Usage

**Transcription**

```typescript
const formData = new FormData();
formData.append('file', audioBlob, 'audio.mp3');
formData.append('model', 'whisper-1');
formData.append('language', 'en');        // Optional
formData.append('prompt', 'StudyLoG');    // Optional context
formData.append('response_format', 'verbose_json');

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
});

const result = await response.json();

interface WhisperResponse {
    text: string;
    language: string;
    duration: number;
    words?: Array<{
        word: string;
        start: number;
        end: number;
    }>;
    segments?: Array<{
        id: number;
        text: string;
        start: number;
        end: number;
    }>;
}
```

**Local Whisper (faster, cheaper at scale)**

```bash
# Install
pip install openai-whisper

# Run
whisper audio.mp3 --model base --output_format json
```

```typescript
// Using local Whisper via child_process
import { exec } from 'child_process';

function transcribeLocal(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(`whisper ${audioPath} --model base --output_format json`,
            (error, stdout) => {
                if (error) reject(error);
                const result = JSON.parse(stdout);
                resolve(result.text);
            }
        );
    });
}
```

#### Model Sizes

| Model | Size | Speed | Accuracy | VRAM |
|-------|------|-------|----------|------|
| tiny | 39MB | Fastest | Fair | 1GB |
| base | 74MB | Fast | Good | 1GB |
| small | 244MB | Medium | Very Good | 2GB |
| medium | 769MB | Slow | Excellent | 5GB |
| large-v3 | 1550MB | Slowest | Best | 10GB |

#### Best Practices

1. **Model Selection**: Use `base` for most applications
2. **Local Processing**: Self-host for cost savings at scale
3. **Audio Quality**: Use 16kHz+ sampling rate
4. **Speaker Diarization**: Use external tools (pyannote) for multiple speakers

---

### 5. Piper

**Repository**: `https://github.com/rhasspy/piper`

**Specialization**: Fast, local neural TTS

#### Pricing Model

**Free** (MIT License)

#### Capabilities

```typescript
interface PiperCapabilities {
    tts: true;
    streaming: false;
    avgTimeSeconds: 0.1;      // Extremely fast
    languages: 15+
    voiceCount: 100+;
}
```

#### API Usage

```bash
# Download voice
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx

# Run
piper --model en_US-lessac-medium.onnx --output output.wav
```

```typescript
// Node.js wrapper
import { spawn } from 'child_process';

function synthesize(text: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const piper = spawn('piper', [
            '--model', 'en_US-lessac-medium.onnx',
            '--output', outputPath
        ]);

        piper.stdin.write(text);
        piper.stdin.end();

        piper.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Piper exited with code ${code}`));
        });
    });
}
```

#### Voice Selection

| Voice | Quality | Size | Speed |
|-------|---------|------|-------|
| en_US-lessac-medium | Good | 78MB | Fast |
| en_US-lessac-low | Medium | 36MB | Very Fast |
| en_US-amy-medium | Good | 78MB | Fast |
| en_GB-semaine-medium | Good | 78MB | Fast |

#### Best Practices

1. **Local-First**: Ideal for offline applications
2. **Latency**: Lowest latency TTS option
3. **Character Voices**: Use different voices for different characters
4. **Fallback**: Great fallback when internet is unavailable

---

## 2D Art APIs

### Provider Summary

| Provider | Best For | Pricing | Speed | Quality |
|----------|----------|---------|-------|---------|
| **Rosebud AI** | Pixel art, sprites | $0.02/gen | 15s | Good |
| **Leonardo AI** | Sprites, UI icons | $0.01/gen | 20s | Good |
| **Scenario.gg** | Style consistency | $0.015/gen | 25s | Good |
| **Midjourney** | Concept art | $0.03/gen | 60s | Excellent |
| **Stability AI** | General purpose | $0.01/gen | 10s | Good |

---

### 1. Rosebud AI (PixelVibe)

**API Endpoint**: `https://api.rosebud.ai`

**Specialization**: Pixel art, sprites, tilesets, UGC game assets

#### Pricing Model

| Operation | Cost | Rate Limits |
|-----------|------|-------------|
| Pixel Art Sprite | $0.02 | 60 req/min, 2000/day |
| Sprite Sheet | $0.08 | 30 req/min, 500/day |
| Tileset | $0.05 | 40 req/min, 1000/day |
| UI Icon | $0.01 | 100 req/min, 5000/day |

**Free Tier**: 200 generations/month

#### Styles

| Style | Description | Best For |
|-------|-------------|----------|
| pixel | Classic pixel art | General use |
| 16bit | SNES era | Retro games |
| vaporwave | 80s aesthetic | Stylish projects |
| gba | Game Boy Advance | Handheld style |
| nes | Nintendo era | Classic retro |
| snes | Super Nintendo | High-quality retro |
| isometric | 2.5D view | Top-down games |

#### API Usage

**Generate Sprite**

```typescript
const request = {
    prompt: "Fantasy hero with sword and shield",
    style: "16bit",
    resolution: "128x128",
    transparent: true,
    negativePrompt: "blurry, anti-aliased"
};

const response = await fetch('https://api.rosebud.ai/v1/pixel-art/generate', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${ROSEBUD_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});

const { id, status, image_url } = await response.json();
```

**Generate Sprite Sheet**

```typescript
const spriteSheetRequest = {
    prompt: "Goblin warrior",
    style: "16bit",
    resolution: "128x128",
    mode: 'spritesheet',
    animations: [
        { type: 'idle', frames: 4, direction: 'down' },
        { type: 'walk', frames: 6, direction: 'down' },
        { type: 'attack', frames: 4, direction: 'down' }
    ],
    columns: 6,
    rows: 4,
    frameWidth: 32,
    frameHeight: 48,
    padding: 0,
    generateJson: true,
    jsonFormat: 'godot'
};
```

**Response with JSON Data**

```typescript
interface SpriteSheetJsonData {
    format: 'godot';
    frames: FrameData[];
    meta: {
        app: 'RosebudPixelVibe',
        version: '1.0',
        image: 'goblin.png',
        format: 'RGBA8888',
        size: { w: 192, h: 192 },
        scale: '1'
    };
}

interface FrameData {
    filename: string;        // "idle-0.png"
    frame: { x: 0, y: 0, w: 32, h: 48 };
    rotated: false;
    trimmed: false;
    spriteSourceSize: { x: 0, y: 0, w: 32, h: 48 };
    sourceSize: { w: 32, h: 48 };
    duration: 100;           // milliseconds
}
```

#### Generate Tileset

```typescript
const tilesetRequest = {
    prompt: "Dungeon stone floor with variations",
    style: "pixel",
    tileSize: 32,
    tilesWide: 8,
    tilesHigh: 8,
    includeVariations: true,
    includeAutotile: true,
    transparent: false
};
```

#### Best Practices

1. **Sprite Dimensions**: Use power-of-2 dimensions (16, 32, 64, 128)
2. **Animation Frames**: 4-6 frames per animation for smooth motion
3. **Godot Format**: Use Godot JSON format for seamless import
4. **Batch Generation**: Generate all character animations at once

---

### 2. Leonardo AI

**API Endpoint**: `https://cloud.leonardoai.ai/rest/v1`

**Specialization**: Sprites, UI icons, concept art, fine-tuning

#### Pricing Model

| Plan | Price | Credits | Image Generations |
|------|-------|---------|-------------------|
| Free | $0 | 150/day | ~150 |
| Apprentice | $10/month | 8,500 | ~850 |
| Artisan | $24/month | 25,000 | ~2,500 |

**Per-Generation Cost**: ~$0.01 (1 credit per image)

#### Models

| Model | Best For |
|-------|----------|
| leonardo-v3 | General purpose |
| kino-xl | Cinematic |
| phoenix-v3 | Photorealistic |
| RPG v5 | Fantasy characters |
| 3D Render Style v2 | Game assets |

#### API Usage

**Generate Image**

```typescript
const request = {
    prompt: "Magical crystal ball glowing with blue energy",
    negativePrompt: "blurry, distorted",
    width: 512,
    height: 512,
    num_images: 4,
    modelId: 'leonardo-v3',
    promptMagic: true,
    tiling: false
};

const response = await fetch('https://cloud.leonardoai.ai/rest/v1/generations', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${LEONARDO_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});

const { sdGenerationJob: { generationId } } = await response.json();

// Poll for results
const result = await fetch(`https://cloud.leonardoai.ai/rest/v1/generations/${generationId}`);
const { object: { images } } = await result.json();
```

**Sprite Mode**

```typescript
const spriteRequest = {
    ...request,
    mode: 'SPRITE',
    spriteConfig: {
        frameCount: 8,
        animation: true,
        columns: 4,
        rows: 2
    }
};
```

**Fine-Tune Style**

```typescript
// Train custom style (requires API approval)
const trainRequest = {
    name: 'StudyLoG Pixel Art',
    description: '16-bit educational game assets',
    datasetImages: [...],        // 10-20 images
    resolution: '512x512'
};

// Use custom style
const generateWithStyle = {
    prompt: "Science lab equipment",
    modelId: 'custom-studylog-pixel',
    width: 512,
    height: 512
};
```

#### Best Practices

1. **PromptMagic**: Enable for better prompt adherence
2. **Batch Generation**: Generate 4 variations and pick best
3. **Style Training**: Create custom styles for consistent branding
4. **Tiling**: Enable for seamless textures

---

### 3. Scenario.gg

**API Endpoint**: `https://api.scenario.com/v1`

**Specialization**: Style-consistent game assets, custom style training

#### Pricing Model

| Plan | Price | Generations | Training |
|------|-------|-------------|----------|
| Starter | $15/month | 1,000 | 1 style |
| Pro | $45/month | 4,500 | 5 styles |
| Studio | $150/month | 20,000 | 20 styles |

**Per-Generation Cost**: ~$0.015

#### API Usage

**List Available Styles**

```typescript
const response = await fetch('https://api.scenario.com/v1/styles', {
    headers: {
        'Authorization': `Bearer ${SCENARIO_API_KEY}`
    }
});

const styles = await response.json();
// Returns: [{ id, name, description, thumbnail, imageCount }]
```

**Generate with Style**

```typescript
const request = {
    type: 'text-to-image',
    prompt: 'Ancient rune stone glowing with magical energy',
    style: 'studylog-fantasy',
    width: 512,
    height: 512,
    samples: 4,
    steps: 30,
    negative: 'blurry, distorted'
};

const response = await fetch('https://api.scenario.com/v1/inference', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${SCENARIO_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});
```

**Train Custom Style**

```typescript
const trainRequest = {
    name: 'StudyLoG Science',
    description: 'Clean, educational science illustrations',
    images: [
        'https://cdn.example.com/training-image-1.png',
        // ... 20-50 images
    ],
    settings: {
        steps: 500,
        resolution: 512
    }
};

const trainResponse = await fetch('https://api.scenario.com/v1/train', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${SCENARIO_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(trainRequest)
});

const { styleId, status } = await trainResponse.json();
// Training takes 30-60 minutes
```

#### Best Practices

1. **Style Training**: Invest in custom styles for consistency
2. **Training Data**: Use 30+ high-quality images per style
3. **Image-to-Image**: Use for variations while maintaining style
4. **Batch Generation**: Generate multiple assets in parallel

---

### 4. Midjourney

**API**: Discord-based (webhooks available)

**Specialization**: High-quality concept art

#### Pricing Model

| Plan | Price | Generations |
|------|-------|-------------|
| Basic | $10/month | 200 |
| Standard | $30/month | Unlimited |
| Pro | $60/month | Unlimited + fast |

**Per-Generation Cost**: ~$0.03 (based on Standard plan)

#### API Usage (via Discord)

```typescript
// Using a Discord bot wrapper
const midjourneyRequest = {
    prompt: '/imagine prompt: Magical crystal cave with glowing mushrooms, fantasy art style --ar 16:9 --v 6',
    webhookUrl: DISCORD_WEBHOOK_URL
};

// Or use a third-party API wrapper
const response = await fetch('https://api.midjourney-proxy.com/v1/imagine', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${MIDJOURNEY_PROXY_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        prompt: 'Magical crystal cave with glowing mushrooms',
        aspectRatio: '16:9',
        version: 6,
        quality: 100
    })
});
```

**Parameters**

| Parameter | Description | Values |
|-----------|-------------|--------|
| `--v` | Version | 5, 6, niji |
| `--ar` | Aspect Ratio | 16:9, 9:16, 1:1, 4:3 |
| `--q` | Quality | 1, 2 (2 = 2x cost) |
| `--s` | Stylize | 0-1000 |
| `--chaos` | Chaos | 0-100 |

#### Best Practices

1. **Concept Art**: Use for initial character/environment concepts
2. **Variations**: Generate V1-V4 variations for options
3. **Aspect Ratio**: Match target resolution (16:9 for desktop, 9:16 mobile)
4. **Upscaling**: Use for final high-resolution assets

---

### 5. Stability AI

**API Endpoint**: `https://api.stability.ai/v1generation`

**Specialization**: Stable Diffusion XL, SD 3.5, open-source models

#### Pricing Model

| Model | Cost | Quality |
|-------|------|---------|
| SDXL 1024 | $0.02 | Good |
| SD 3 | $0.03 | Excellent |
| SD 3.5 | $0.04 | Best |

**Self-Hosted**: Free (compute costs apply)

#### API Usage

**Text to Image**

```typescript
const request = {
    text_prompts: [
        { text: 'Futuristic laboratory with holographic displays', weight: 1.0 },
        { text: 'blurry, low quality', weight: -1.0 }
    ],
    cfg_scale: 7,
    height: 1024,
    width: 1024,
    steps: 30,
    samples: 1,
    seed: 0
};

const response = await fetch('https://api.stability.ai/v1generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${STABILITY_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
});

const { artifacts } = await response.json();
const image = Buffer.from(artifacts[0].base64, 'base64');
```

**Image to Image**

```typescript
const img2imgRequest = {
    ...request,
    init_image: base64ImageData,
    init_image_mode: 'IMAGE_STRENGTH',
    image_strength: 0.35,      // How much to transform (0-1)
    cfg_scale: 7,
    samples: 1
};
```

**ControlNet (Structure Preservation)**

```typescript
const controlNetRequest = {
    ...request,
    control_filters: [
        {
            type: 'canny',      // Edge detection
            image: base64EdgeMap,
            strength: 0.9
        }
    ]
};
```

#### Best Practices

1. **Self-Hosting**: Run locally for cost savings at scale
2. **LoRA Models**: Train custom LoRAs for style consistency
3. **Image-to-Image**: Use for variations while preserving composition
4. **Batch Processing**: Generate multiple variations in parallel

---

## Comparison Tables

### 3D Models: Quality vs Cost

| Provider | Quality | Cost | Speed | Best Use Case |
|----------|---------|------|-------|---------------|
| **Rodin Gen-2** | A+ | $ | B+ | High-quality props with textures |
| **Tripo AI** | A | $$ | B | Rigged characters |
| **Masterpiece X** | A | $$ | C | Animated characters |
| **Hunyuan 3D** | B+ | $ | B | Environments, terrain |
| **Meshy AI** | B | $ | B | Fast prototyping |
| **Sloyd AI** | B | $ | A+ | Rapid prop generation |

**Legend**: A+ = Excellent, A = Very Good, B+ = Good, B = Fair, C = Slow
**Cost**: $ = <$0.10, $$ = $0.10-0.20

### Audio/Voice: Quality vs Cost

| Provider | Quality | Cost | Latency | Best Use Case |
|----------|---------|------|---------|---------------|
| **ElevenLabs** | A+ | $$ | A+ | Character voices, narration |
| **Riva** | A | $$$ | A | Enterprise ASR/TTS |
| **Whisper** | A+ | $ | B | Transcription |
| **Coqui** | B | Free | B | Multilingual TTS |
| **Piper** | B | Free | A+ | Real-time, offline |
| **ACE** | A+ | $ | B | Lip sync, facial animation |

**Legend**: A+ = Excellent, A = Very Good, B = Good, Free = No licensing cost
**Cost**: Free = Self-hosted only, $ = <$0.01/unit, $$ = $0.01-0.10/unit, $$$ = Enterprise pricing

### 2D Art: Quality vs Cost

| Provider | Quality | Cost | Speed | Best Use Case |
|----------|---------|------|-------|---------------|
| **Midjourney** | A+ | $$ | C | Concept art |
| **Leonardo AI** | B+ | $ | B+ | Game assets, sprites |
| **Rosebud AI** | B+ | $ | B+ | Pixel art, sprites |
| **Scenario.gg** | B | $$ | B | Style consistency |
| **Stability AI** | B | $ | B+ | General purpose |

### Speed vs Quality Matrix

#### 3D Models

| | Fast (<30s) | Medium (30-90s) | Slow (>90s) |
|---|------------|-----------------|-------------|
| **High Quality** | | Rodin Gen-2 | Masterpiece X |
| **Medium Quality** | Sloyd AI | Tripo AI, Meshy | Hunyuan 3D (env) |
| **Low Quality** | | | |

#### Audio

| | Real-time (<500ms) | Fast (<2s) | Slow (>2s) |
|---|-------------------|------------|-------------|
| **High Quality** | Piper | ElevenLabs | Coqui, ACE |
| **Medium Quality** | Piper | Whisper | |

#### 2D Art

| | Fast (<20s) | Medium (20-40s) | Slow (>40s) |
|---|------------|-----------------|-------------|
| **High Quality** | Stability | Leonardo | Midjourney |
| **Medium Quality** | Rosebud | Scenario | |

---

## Integration Examples

### StudyLoG.AI Specific

#### Educational 3D Models

```typescript
// Generate educational prop for StudyLoG
const studylogRequest = {
    prompt: "Detailed DNA double helix model with labeled nucleotides",
    category: 'prop',
    quality: 'high',
    productContext: 'studylog',
    polygonTarget: 15000,    // Good balance for web
    includeRigging: false,
    tags: ['biology', 'science', 'education']
};

const asset = await asset3DRouter.routeModelRequest(studylogRequest, {
    maxCostUsd: 0.15,
    qualityTier: 'high'
});

// Import to Godot scene
await godotImporter.import({
    assetId: asset.assetId,
    projectPath: 'res://assets/educational/',
    generateCollision: true,
    importAsSkeleton: false
});
```

#### Voice Tutor Character

```typescript
// Generate voice for AI tutor
const tutorVoice = await elevenlabsClient.synthesize({
    text: explanationText,
    voice: 'D38z5RhdWvJvqFEgT9nQ',  // Josh - friendly male
    modelId: 'eleven_turbo_v2_5',
    useCase: 'tutorial',
    productContext: 'studylog',
    enablePhonemes: true,     // For lip sync
    speed: 0.9                // Slightly slower for clarity
});

// Generate facial animation
const facialAnim = await aceClient.generate({
    audio: tutorVoice.audioData,
    characterId: 'tutor-character',
    outputFormat: 'blendshapes',
    frameRate: 60
});

// Apply to Godot character
gdscript(`
var voice_track = load("res://audio/tutor.mp3")
var facial_anim = load("res://animations/tutor_facial.tres")

$AudioPlayer.stream = voice_track
$FaceMesh.set_blend_shapes_from_data(facial_anim)
$AudioPlayer.play()
`)
```

#### Interactive Quiz Sprites

```typescript
// Generate pixel art quiz elements
const quizElements = await rosebudProvider.generateBatch([
    {
        prompt: 'Gold trophy icon',
        style: '16bit',
        category: 'ui_icon',
        width: 32,
        height: 32
    },
    {
        prompt: 'Silver trophy icon',
        style: '16bit',
        category: 'ui_icon',
        width: 32,
        height: 32
    },
    {
        prompt: 'Bronze trophy icon',
        style: '16bit',
        category: 'ui_icon',
        width: 32,
        height: 32
    }
]);

// Import to Godot as texture atlas
const atlas = await texturePacker.pack({
    images: quizElements.map(e => e.imageUrl),
    padding: 2,
    powerOfTwo: true
});
```

### DMLoG.AI Specific

#### D&D Character Generation

```typescript
// Generate full D&D character
const characterRequest = {
    prompt: "Male dwarven cleric with plate armor, warhammer, holy symbol of Moradin",
    category: 'character',
    quality: 'high',
    includeRigging: true,
    includeAnimation: true,
    animations: ['idle', 'walk', 'attack', 'cast', 'hurt'],
    productContext: 'dmlog',
    preferredProvider: 'masterpiece_x'
};

const character = await asset3DRouter.routeModelRequest(characterRequest);

// Generate portrait
const portrait = await leonardoClient.generate({
    prompt: "Dwarf cleric portrait, bearded, warhammer, holy symbol",
    style: 'RPG v5',
    width: 512,
    height: 512
});

// Generate voice
const voice = await elevenlabsClient.cloneVoice({
    voiceName: 'Dwarf Cleric',
    sampleAudio: dwarfVoiceSample,
    description: 'Gruff, deep dwarven voice with Scottish accent'
});

const dialogue = await elevenlabsClient.synthesize({
    text: "By Moradin's hammer, I smite thee!",
    voice: voice.voiceId,
    useCase: 'dialogue'
});
```

#### Battle Map Environment

```typescript
// Generate D&D battle map
const mapRequest = {
    prompt: "Underground dungeon chamber with stone pillars, torches, ancient altar in center, scattered bones",
    sceneType: 'dungeon',
    areaSize: [50, 10, 50],
    objectCount: 50,
    includeNavmesh: true,      // For token movement
    includeCollision: true,    // For line-of-sight
    bakeLighting: true,        // For atmosphere
    timeOfDay: 'indoor',
    weather: 'clear',
    productContext: 'dmlog'
};

const map = await asset3DRouter.routeEnvironmentRequest(mapRequest);

// Generate token assets
const tokens = await sloydProvider.generateBatch([
    { templateId: 'token-hero', parameters: { color: 'blue' } },
    { templateId: 'token-monster', parameters: { type: 'goblin' } },
    { templateId: 'token-monster', parameters: { type: 'goblin' } }
]);
```

#### NPC Dialogue System

```typescript
// Generate NPC with voice and lip sync
async function createNPC(name: string, description: string, voiceSample: string) {
    // Clone voice
    const voice = await elevenlabsClient.cloneVoice({
        voiceName: name,
        sampleAudio: voiceSample,
        description: description
    });

    // Generate dialogue
    const dialogue = await elevenlabsClient.synthesize({
        text: "Hello, adventurer. What brings you to these lands?",
        voice: voice.voiceId,
        enablePhonemes: true
    });

    // Generate lip sync
    const lipSync = await aceClient.generate({
        audio: dialogue.audioData,
        characterId: 'npc-humanoid',
        outputFormat: 'blendshapes'
    });

    return {
        voiceId: voice.voiceId,
        audioUrl: dialogue.audioUrl,
        animationUrl: lipSync.animationUrl,
        phonemes: dialogue.phonemes
    };
}

// Use in Godot
gdscript(`
extends Node3D

var npc_data = load("res://npcs/innkeeper.json")

func talk(dialogue: String):
    # Generate audio dynamically
    var audio = AudioServer.tts_generate(dialogue, npc_data.voice_id)
    var anim = AudioServer.audio2face(audio)

    $AudioPlayer.stream = audio
    $FaceMesh.set_blend_shapes_from_data(anim)
    $AudioPlayer.play()

    # Wait for completion
    await $AudioPlayer.finished
`)
```

---

## Best Practices

### Asset Generation

#### Prompt Engineering

**3D Models**
- Be specific about style: "fantasy", "sci-fi", "realistic"
- Include material details: "wooden", "metal", "stone"
- Specify polygon targets: "low poly" vs "high detail"
- Use negative prompts: "no limbs", "not distorted"

**Audio**
- Include pronunciation guides for difficult words
- Specify emotional tone: "excited", "serious", "whispering"
- Use SSML tags for emphasis
- Include pacing notes: [pause] markers

**2D Art**
- Specify art style: "pixel art", "oil painting", "isometric"
- Include reference: "in the style of [artist/game]"
- Use aspect ratio parameters
- Batch similar requests for consistency

#### Caching Strategy

```typescript
interface CacheConfig {
    // What to cache
    cachePrompts: boolean;      // Cache exact prompt matches
    cacheSimilar: boolean;      // Cache semantically similar

    // When to expire
    ttlSeconds: number;

    // Cache hierarchy
    memoryCache: number;        // Fast cache (MB)
    diskCache: number;          // Slower but larger (GB)
    cdnCache: boolean;          // Persistent cloud cache
}

const defaultCache: CacheConfig = {
    cachePrompts: true,
    cacheSimilar: true,
    ttlSeconds: 86400,          // 24 hours
    memoryCache: 100,
    diskCache: 10000,
    cdnCache: true
};
```

#### Error Handling

```typescript
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;          // milliseconds
    maxDelay: number;
    backoffMultiplier: number;
}

async function fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    config: RetryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 10000, backoffMultiplier: 2 }
): Promise<T> {
    let lastError: Error | null = null;
    let delay = config.baseDelay;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            lastError = error as Error;
            if (attempt < config.maxRetries) {
                await new Promise(r => setTimeout(r, delay));
                delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
            }
        }
    }

    throw lastError;
}
```

### Product-Specific Considerations

#### StudyLoG.AI

| Consideration | Recommendation |
|---------------|----------------|
| Visual Style | Educational, clean, colorful |
| Voice Speed | Slightly slower (0.8-0.9x) for clarity |
| Asset Complexity | Lower polygon counts for web performance |
| Caching | Aggressive - reuse educational content |

#### DMLoG.AI

| Consideration | Recommendation |
|---------------|----------------|
| Visual Style | Immersive, atmospheric |
| Voice Variety | Distinct voices for different NPCs |
| Asset Complexity | Higher quality for immersive experience |
| Caching | Moderate - balance immersion and storage |

---

## Cost Optimization

### Provider Selection Algorithm

```typescript
function selectProvider(request: AssetRequest, constraints: Constraints): AssetProvider {
    // Score each provider
    const scores = providers.map(provider => {
        let score = 0;

        // Capability match (40%)
        if (requiresRigging && !provider.capabilities.rigging) return 0;
        score += capabilityScore(provider, request) * 0.4;

        // Cost efficiency (30%)
        const cost = estimateCost(provider, request);
        if (cost > constraints.maxCostUsd) return 0;
        score += (1 - cost / constraints.maxCostUsd) * 0.3;

        // Speed (20%)
        const time = provider.capabilities.avgTimeSeconds;
        if (time > constraints.maxTimeSeconds) return 0;
        score += (1 - time / constraints.maxTimeSeconds) * 0.2;

        // Quality (10%)
        score += qualityScore(provider, constraints.qualityTier) * 0.1;

        return { provider, score };
    });

    // Return highest scoring provider
    return scores.sort((a, b) => b.score - a.score)[0].provider;
}
```

### Cost by Quality Tier

#### 3D Models

| Tier | Provider | Cost/Gen | Monthly (100 gen) |
|------|----------|----------|-------------------|
| Draft | Sloyd | $0.05 | $5 |
| Preview | Meshy | $0.06 | $6 |
| Standard | Tripo | $0.08 | $8 |
| High | Rodin | $0.07 | $7 |
| Ultra | Masterpiece X | $0.10 | $10 |

#### Audio

| Tier | Provider | Cost/1K chars | Monthly (100K chars) |
|------|----------|---------------|---------------------|
| Draft | Piper | Free | $0 |
| Standard | Coqui | Free | $0 |
| High | ElevenLabs Turbo | $0.30 | $30 |
| Ultra | ElevenLabs Multilingual | $0.30 | $30 |

#### 2D Art

| Tier | Provider | Cost/gen | Monthly (500 gen) |
|------|----------|----------|------------------|
| Draft | Rosebud | $0.02 | $10 |
| Preview | Stability | $0.01 | $5 |
| Standard | Leonardo | $0.01 | $5 |
| High | Scenario | $0.015 | $7.50 |
| Ultra | Midjourney | $0.03 | $15 |

### Optimization Strategies

1. **Smart Caching**
   - Exact match cache: 50-80% hit rate
   - Similarity cache: +20-30% hit rate
   - Result: 50-80% cost reduction

2. **Tiered Generation**
   - Generate draft/preview first
   - Only upgrade to high/ultra for approved assets
   - Result: 40-60% cost reduction

3. **Batch Processing**
   - Queue non-urgent requests
   - Process during off-peak hours
   - Result: 10-30% cost reduction (provider discounts)

4. **Hybrid Approach**
   - Use open-source (Coqui, Piper, Stability) for non-critical
   - Use premium (ElevenLabs, Midjourney) for hero assets
   - Result: 30-50% cost reduction

5. **Format Selection**
   - Choose appropriate output formats
   - Use compression where acceptable
   - Result: 10-20% bandwidth/storage savings

---

## API Reference Quick Links

| Category | Provider | Documentation |
|----------|----------|---------------|
| **3D** | Hunyuan 3D | https://hunyuan.tencent.com/en |
| **3D** | Sloyd AI | https://docs.sloyd.ai |
| **3D** | Masterpiece X | https://www.masterpiecex.com/docs |
| **3D** | Tripo AI | https://docs.tripo3d.ai |
| **3D** | Rodin | https://www.rodin.ai/docs |
| **3D** | Meshy AI | https://docs.meshy.ai |
| **Audio** | ElevenLabs | https://elevenlabs.io/docs/api |
| **Audio** | NVIDIA ACE | https://developer.nvidia.com/ace |
| **Audio** | Coqui | https://github.com/coqui-ai/TTS |
| **Audio** | Whisper | https://platform.openai.com/docs/guides/speech-to-text |
| **Audio** | Piper | https://github.com/rhasspy/piper |
| **2D** | Rosebud AI | https://docs.rosebud.ai |
| **2D** | Leonardo AI | https://docs.leonardoai.ai |
| **2D** | Scenario.gg | https://api.scenario.com/docs |
| **2D** | Midjourney | https://docs.midjourney.com |
| **2D** | Stability AI | https://api.stability.ai/docs |

---

## Implementation Checklist

### Setup

- [ ] Obtain API keys for selected providers
- [ ] Configure environment variables
- [ ] Set up R2/S3 storage for assets
- [ ] Configure KV cache for metadata
- [ ] Initialize D1 database schema

### 3D Assets

- [ ] Implement Hunyuan 3D client
- [ ] Implement Sloyd AI client
- [ ] Implement Masterpiece X client
- [ ] Implement Tripo AI client
- [ ] Implement Rodin client
- [ ] Implement Meshy AI client
- [ ] Set up model router
- [ ] Configure Godot importer

### Audio Assets

- [ ] Implement ElevenLabs client
- [ ] Implement ACE Audio2Face client
- [ ] Implement Coqui client
- [ ] Implement Whisper client
- [ ] Implement Piper client
- [ ] Set up voice router
- [ ] Configure lip sync pipeline

### 2D Assets

- [ ] Implement Rosebud AI client
- [ ] Implement Leonardo AI client
- [ ] Implement Scenario.gg client
- [ ] Implement Midjourney client
- [ ] Implement Stability AI client
- [ ] Set up 2D router
- [ ] Configure texture packer
- [ ] Set up sprite sheet generator

### Integration

- [ ] Create StudyLoG.AI asset generators
- [ ] Create DMLoG.AI asset generators
- [ ] Set up caching layer
- [ ] Configure cost tracking
- [ ] Implement rate limiting
- [ ] Set up error handling and retries
- [ ] Create monitoring dashboard

---

**Document Version**: 1.0.0
**Last Updated**: 2025-01-10
**Maintained By**: SuperInstance.AI Team
**License**: Internal Use Only
