# Microverse Engine Integration Research

**Document Version:** 1.0
**Date:** 2026-01-10
**Repository:** https://github.com/KsanaDock/Microverse
**Research Team:** SuperInstance.AI Microverse Engine Research Team
**Status:** Foundation Analysis Complete

---

## Executive Summary

This document presents comprehensive research findings on integrating the **Microverse** engine into the SuperInstance.AI platform. Microverse is a Godot 4-based multi-agent AI social simulation system that provides a robust foundation for building AI-driven virtual worlds.

### Key Findings

1. **Architecture Compatibility**: Microverse uses Godot 4.3+ with GDScript, perfectly aligned with our Godot-first strategy
2. **AI System Sophistication**: Multi-agent architecture with memory, personality, and task systems already implemented
3. **Extensibility**: Clean autoload-based singleton architecture enables seamless SuperInstance layer integration
4. **Strategic Opportunity**: Microverse provides ~80% of foundational systems needed, allowing us to focus on differentiation

### Recommendation

**Proceed with Microverse as the foundation** for StudyLoG.AI and DMLoG.AI virtual world simulation layers. The SuperInstance Layer will add:

- Generative AI look-and-feel transformation
- 6-tier hierarchical memory system
- NVIDIA ACE/Audio2Face digital human integration
- Cross-product memory sharing
- SmartCRDT-based multiplayer collaboration

---

## Table of Contents

1. [Microverse Architecture Analysis](#1-microverse-architecture-analysis)
2. [Core Systems Deep Dive](#2-core-systems-deep-dive)
3. [Integration Roadmap](#3-integration-roadmap)
4. [SuperInstance Layer Design](#4-superinstance-layer-design)
5. [Technical Implementation Plans](#5-technical-implementation-plans)
6. [Risk Assessment](#6-risk-assessment)
7. [Appendices](#7-appendices)

---

## 1. Microverse Architecture Analysis

### 1.1 Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Game Engine** | Godot | 4.3+ | Core runtime |
| **Language** | GDScript | - | Game logic |
| **Networking** | HTTPRequest | Built-in | API calls |
| **Data Storage** | JSON | - | Save/load system |
| **UI Framework** | Godot Control Nodes | Built-in | User interface |

### 1.2 Project Structure

```
Microverse/
├── project.godot                    # Project configuration
├── asset/                           # Art assets (sprites, textures)
├── scene/                           # Scene files (.tscn)
│   ├── characters/                  # Character instances
│   │   ├── Alice.tscn
│   │   ├── Grace.tscn
│   │   ├── Jack.tscn
│   │   ├── Joe.tscn
│   │   ├── Lea.tscn
│   │   ├── Monica.tscn
│   │   ├── Stephen.tscn
│   │   └── Tom.tscn
│   ├── maps/                        # Game maps
│   │   └── Office.tscn              # Main office scene
│   ├── prefab/                      # Prefabricated objects
│   │   ├── Chair.tscn
│   │   ├── Desk.tscn
│   │   └── ...
│   └── ui/                          # UI scenes
│       ├── DialogBubble.tscn
│       ├── GlobalSettingsUI.tscn
│       └── ...
└── script/                          # All game logic (~5,464 lines GDScript)
    ├── ai/                          # AI systems
    │   ├── AIAgent.gd               # Core AI agent (2,214 lines)
    │   ├── APIManager.gd            # API routing
    │   ├── APIConfig.gd             # Provider configuration
    │   ├── DialogManager.gd         # Dialogue orchestration
    │   ├── DialogService.gd         # Dialogue service layer
    │   ├── ConversationManager.gd   # Individual conversation handling
    │   ├── memory/
    │   │   └── MemoryManager.gd     # Memory system
    │   └── background_story/
    │       ├── BackgroundStoryManager.gd
    │       └── BackgroundStoryUI.gd
    ├── ui/                          # UI scripts
    │   ├── DialogBubble.gd
    │   ├── GlobalSettingsUI.gd
    │   ├── SettingsManager.gd
    │   └── ...
    ├── CharacterController.gd       # Movement/controls
    ├── CharacterManager.gd          # Character lifecycle
    ├── CharacterPersonality.gd      # Personality definitions
    ├── ChatHistory.gd               # Conversation history
    ├── GameSaveManager.gd           # Persistence
    ├── RoomManager.gd               # Spatial zoning
    └── RoomData.gd                  # Room data structures
```

### 1.3 Autoload Singletons (Core Architecture)

Microverse uses Godot's autoload system for global singletons:

```gdscript
# From project.godot [autoload] section:
SettingsManager="*res://script/ui/SettingsManager.gd"
DialogManager="*res://script/ai/DialogManager.gd"
CharacterManager="*res://script/CharacterManager.gd"
APIManager="*res://script/ai/APIManager.gd"
GameSaveManager="*res://script/GameSaveManager.gd"
MemoryManager="*res://script/ai/memory/MemoryManager.gd"
```

**Integration Advantage**: This singleton pattern aligns perfectly with our SuperInstance backend bridge architecture. We can inject our services at the same level.

### 1.4 Code Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Total GDScript Lines | ~5,464 | Manageable for analysis |
| AIAgent.gd | 2,214 lines | Core AI logic |
| Number of Characters | 8 | Alice, Grace, Jack, Joe, Lea, Monica, Stephen, Tom |
| Number of Scenes | 20+ | Characters, UI, maps, prefabs |
| AI Providers Supported | 8 | Ollama, OpenAI, DeepSeek, Doubao, Gemini, Claude, SiliconFlow, Kimi |

---

## 2. Core Systems Deep Dive

### 2.1 AI Agent System (AIAgent.gd)

The AIAgent is the brain of each character, implementing:

#### 2.1.1 State Machine

```gdscript
enum State {
    IDLE,
    MOVING,
    TALKING
}
var current_state = State.IDLE
var is_player_controlled = false
```

#### 2.1.2 Decision Loop

- **Interval**: Every 60 seconds (configurable)
- **Initial Delay**: 10 seconds before first decision
- **Decision Types**:
  - Adjust tasks (rearrange priorities)
  - Continue current task (movement, conversation, thinking, completion)

#### 2.1.3 Scene Perception

```gdscript
func generate_scene_description() -> String:
    # Returns comprehensive description including:
    # - Current room and description
    # - Environment info (time of day context)
    # - Room objects with functions
    # - Room characters with positions
    # - Map information with distances/directions
```

**Perception Radius**: 200 pixels (configurable constant)

#### 2.1.4 Task System

Each agent maintains a task list with:
- Description
- Priority (1-10)
- Created timestamp
- Completion status

Tasks influence decision-making and are contextually generated based on:
- Character position/role
- Current mood/health/financial status
- Recent memories
- Social relationships

#### 2.1.5 Memory Integration

AIAgent uses MemoryManager for:
- Adding memories from actions/conversations
- Retrieving formatted memories for AI prompts
- Recent memory filtering (last 24 hours default)

### 2.2 Memory System (MemoryManager.gd)

#### 2.2.1 Memory Types

```gdscript
enum MemoryType {
    PERSONAL,      # Personal experiences
    INTERACTION,   # Social interactions
    TASK,          # Task-related memories
    EMOTION,       # Emotional events
    EVENT          # General events
}
```

#### 2.2.2 Memory Importance

```gdscript
enum MemoryImportance {
    LOW = 1,
    NORMAL = 3,
    HIGH = 5,
    CRITICAL = 10
}
```

#### 2.2.3 Memory Structure

```javascript
{
    "content": "Memory text description",
    "timestamp": "2025-01-10 14:30",
    "type": MemoryType.PERSONAL,
    "importance": MemoryImportance.NORMAL,
    "created_at": 1736512600  // Unix timestamp
}
```

#### 2.2.4 Memory Lifecycle

- **Creation**: Via `add_memory(character, content, type, importance)`
- **Retrieval**: `get_formatted_memories_for_prompt(character, max_count)`
- **Search**: `search_memories(character, keywords)`
- **Cleanup**: Automatic, keeps max 50 memories per character
- **Prioritization**: By importance then timestamp

**Integration Point**: Replace with SuperInstance 6-tier memory system.

### 2.3 Dialogue System

#### 2.3.1 Architecture Layers

```
DialogManager (autoload)
    └── DialogService
        └── ConversationManager (multiple instances, one per conversation)
```

#### 2.3.2 Conversation Flow

```
1. Player presses 'T' key
2. DialogManager._try_start_conversation()
3. DialogService.try_start_conversation(speaker, listener)
4. ConversationManager created and started
5. ConversationManager.generate_dialog()
   - Builds prompt with personality, status, memories, history
   - Calls APIManager.generate_dialog(prompt, character_name)
   - HTTPRequest sent to configured AI provider
6. _on_request_completed()
   - Parses response via APIConfig
   - Creates DialogBubble UI
   - Saves to ChatHistory
7. Roles swap, listener becomes speaker
8. Repeat from step 5
```

#### 2.3.3 Dialog Bubble System

- Scene: `scene/ui/DialogBubble.tscn`
- Follows target character automatically
- Displays text with typewriter effect
- Auto-dismisses after timeout

#### 2.3.4 Chat History

- Scene: `scene/ChatHistory.tscn`
- Attached to each character node
- Methods:
  - `add_message(partner_name, formatted_message)`
  - `get_recent_conversation_with(partner_name, count)`
  - `save_history()` / `load_history()`

### 2.4 API Manager System

#### 2.4.1 Supported Providers

| Provider | Models | Cost (est.) | Status |
|----------|--------|-------------|--------|
| Ollama | qwen2.5, llama3.2, gemma2 | Free | Local |
| OpenAI | gpt-4o, gpt-4o-mini, gpt-3.5-turbo | Premium | Ready |
| DeepSeek | deepseek-chat | $0.14/M input | Ready |
| Doubao (ByteDance) | doubao-lite/pro 4k/32k/128k | Paid | Ready |
| Gemini | gemini-1.5-flash/pro | Paid | Ready |
| Claude | claude-3-5-sonnet/haiku/opus | Premium | Ready |
| SiliconFlow | DeepSeek-V3.1, Ring-1T, GLM-4.6 | Paid | Ready |
| Kimi (Moonshot) | moonshot-v1 8k/32k/128k | Paid | Ready |
| OpenAI Compatible | Custom | Variable | Ready |

#### 2.4.2 Per-Character AI Settings

Microverse supports per-character AI configuration via `SettingsManager.get_character_ai_settings(character_name)`.

**Integration Opportunity**: Use this for tiered model assignment (e.g., Captain uses GPT-4, Deckhand uses local SLM).

### 2.5 Character System

#### 2.5.1 Personality Configuration

```gdscript
const PERSONALITY_CONFIG = {
    "Alice": {
        "position": "SleepySheep公司的前端工程师、UI设计师",
        "personality": "设计界的带刺玫瑰...",
        "speaking_style": "开口就是'这需求的视觉层级比老板的发际线还混乱'...",
        "work_duties": "负责产品界面设计...",
        "work_habits": "办公桌贴满'拒绝福报'的像素风贴纸..."
    },
    // ... 7 more characters
}
```

#### 2.5.2 Character Controller

Features:
- WASD movement (player-controlled)
- Navigation mesh pathfinding (AI-controlled)
- Obstacle avoidance with raycasting
- Sit/stand on chairs
- Facing direction tracking
- Animation state management

**Movement Capabilities**:
- Direct keyboard control
- Navigation mesh pathfinding
- Dynamic obstacle avoidance
- Stuck detection and path recalculation
- Arrival-based deceleration

### 2.6 Room/Spatial System

#### 2.6.1 Room Data Structure

```gdscript
class_name RoomData
var name: String
var position: Vector2      # Center position
var size: Vector2          # Dimensions
var description: String    # Narrative description
```

#### 2.6.2 Room Manager

- Scans scene for `room_area` group nodes
- Extracts position/size from CollisionShape2D
- Provides queries:
  - `get_current_room(rooms, character_position)`
  - `is_position_in_room(position, room)`

**Integration Opportunity**: Enhance for procedural room generation and multi-map support.

### 2.7 Save/Load System (GameSaveManager.gd)

#### 2.7.1 Save Data Structure

```json
{
    "version": "1.0",
    "timestamp": 1736512600,
    "scene_name": "Office",
    "characters": [
        {
            "name": "Alice",
            "position": {"x": 120, "y": 340},
            "facing_direction": "right",
            "is_sitting": false,
            "current_chair": null,
            "is_player_controlled": false,
            "ai_state": {...},
            "tasks": [...],
            "personality": {...}
        }
    ],
    "rooms": {...},
    "global_state": {
        "game_time": 1736512600,
        "settings": {...}
    }
}
```

#### 2.7.2 File Storage

- Directory: `user://saves/`
- Format: JSON
- Extension: `.json`
- Features:
  - Auto-save with timestamp naming
  - Save info metadata
  - Delete save capability
  - Save list enumeration

---

## 3. Integration Roadmap

### Phase 1: Foundation (4-6 weeks)

**Goal**: Establish Microverse integration baseline

#### 1.1 Repository Integration (Week 1-2)

| Task | Description | Owner | Deliverable |
|------|-------------|-------|-------------|
| Clone & Analyze | Deep codebase analysis | Research Team | This document |
| Import as Submodule | Add to godot-source/ | DevOps | Submodule configured |
| Build Verification | Ensure project compiles | Build Team | Working build |

**Files to Create**:
- `/godot-source/modules/microverse/` - Imported as Godot module
- `/backend/workers/microverse-bridge/` - Bridge worker for Theia

#### 1.2 SuperInstance Bridge Layer (Week 2-4)

Create new autoload singletons:

```gdscript
# New autoloads in project.godot:
SIMemoryManager="*res://script/si/SIMemoryManager.gd"
SIAPIRouter="*res://script/si/SIAPIRouter.gd"
SIAssetManager="*res://script/si/SIAssetManager.gd"
SICollaboration="*res://script/si/SICollaboration.gd"
```

**Bridge Components**:

1. **SIMemoryManager.gd** - Adapter pattern
   - Wraps Microverse MemoryManager
   - Implements 6-tier hierarchy
   - Provides cross-character memory sharing

2. **SIAPIRouter.gd** - Delegates to SuperInstance backend
   - Replaces direct API calls
   - Routes through `multi-model-router` worker
   - Enables cost tracking and cascade routing

3. **SIAssetManager.gd** - Runtime asset transformation
   - Asset quality scaling
   - Generative texture/mesh replacement
   - GPU capability detection

4. **SICollaboration.gd** - SmartCRDT integration
   - Real-time sync of world state
   - Conflict resolution
   - Presence awareness

#### 1.3 Theia Integration (Week 3-4)

Extend existing `si-godot-embed` extension:

| Feature | Description | Status |
|---------|-------------|--------|
| Scene Inspector | View/edit Microverse scenes | New |
| Entity Inspector | Inspect character AI state | New |
| Memory Viewer | Visualize memory hierarchies | New |
| Dialog Monitor | Live conversation tracking | New |
| Task Board | View agent task queues | New |

#### 1.4 Testing Infrastructure (Week 5-6)

```
backend/tests/microverse/
├── ai_agent_test.ts
├── memory_system_test.ts
├── dialog_system_test.ts
└── save_load_test.ts
```

**Success Criteria**:
- Microverse scene loads in Theia
- AI agents make decisions
- Memory persists across saves
- Theia can inspect agent states

---

### Phase 2: AI Layer (6-8 weeks)

**Goal**: Implement SuperInstance AI differentiation

#### 2.1 6-Tier Memory System (Week 1-3)

Replace Microverse's 5-type memory with SuperInstance's 6-tier hierarchy:

| Microverse | SuperInstance | Integration Strategy |
|------------|---------------|---------------------|
| MemoryType.PERSONAL | Working Memory | Map 1:1, add decay |
| MemoryType.INTERACTION | Episodic Memory | Add temporal indexing |
| N/A | Semantic Memory | Extract from episodes via LLM |
| N/A | Procedural Memory | Skill/task patterns |
| N/A | Reflection Memory | Meta-cognitive layer |
| MemoryType.EVENT | Identity Memory | Long-term personality evolution |

**Implementation**:

```gdscript
# SIMemoryManager.gd
class_name SIMemoryManager
extends MemoryManager

# New memory tiers
enum SIMemoryType {
    WORKING,      # Seconds to minutes
    EPISODIC,     # Hours to days
    SEMANTIC,     # Facts, concepts
    PROCEDURAL,   # Skills, habits
    REFLECTION,   # Self-awareness
    IDENTITY      # Core personality
}

# Memory consolidation (background process)
func _process(delta):
    _consolidate_episodic_to_semantic()
    _prune_old_working_memory()
    _reflect_on_recent_events()
```

**Consolidation Rules**:
1. Working memories repeated 3+ times -> Episodic
2. Episodic memories with common themes -> Semantic
3. Successful task patterns -> Procedural
4. Significant events -> Reflection
5. Reflection changes -> Identity

#### 2.2 Multi-Model Cascade Integration (Week 2-4)

Integrate with existing `multi-model-router` worker:

```
┌─────────────────────────────────────────────────────────────┐
│                   Microverse Scene                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Alice   │  │  Grace   │  │   Jack   │  │   Joe    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └───────────────┴───────────────┴───────────────┘     │
│                            │                                │
│                      ┌─────▼─────┐                          │
│                      │ SIAPIRouter│                          │
│                      └─────┬─────┘                          │
└────────────────────────────┼────────────────────────────────┘
                               │ WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│              Theia IDE Frontend                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │         si-multi-model Extension                 │      │
│  └──────────────────────────────────────────────────┘      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP/WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│              SuperInstance Backend                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │        multi-model-router Worker                 │      │
│  │  ┌────────────────────────────────────────┐      │      │
│  │  │  Cascade Router                         │      │      │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐       │      │      │
│  │  │  │ Zooplankton │ Herring │ Deckhand │ ... │      │      │
│  │  │  │ (Token) │ (Vector)│ (+LoRA) │       │      │      │
│  │  │  └────┬───┘ └────┬───┘ └────┬───┘       │      │      │
│  │  │       └─────────┴─────────┴─────────┐     │      │      │
│  │  │                                  │     │      │      │
│  │  │  Provider Selection              │     │      │      │
│  │  │  ├─ OpenAI (Premium)              │     │      │      │
│  │  │  ├─ Anthropic (Premium)           │     │      │      │
│  │  │  ├─ DeepSeek (Value)              │     │      │      │
│  │  │  └─ Cloudflare (Free)             │     │      │      │
│  │  └──────────────────────────────────┘     │      │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Per-Agent Model Assignment**:

| Agent Type | Default Model | Fallback | Cost Target |
|------------|---------------|----------|-------------|
| Captain (orchestrator) | claude-opus-4-5 | claude-sonnet-4-1 | $0.01/decision |
| Whale (multi-agent) | gpt-4o | claude-opus-4-5 | $0.005/decision |
| Deckhand (SLM+LoRA) | deepseek-chat | llama3.2-3b (local) | $0.0001/decision |
| Zooplankton (token) | gpt-4o-mini | llama3.2-1b (local) | $0.00001/token |

#### 2.3 Generative Asset Pipeline (Week 3-5)

Create runtime asset transformation system:

**Components**:

1. **Asset Quality Descriptor**

```toml
# si_asset.toml (metadata per asset)
[asset]
id = "character_alice"
type = "character"
base_quality = "voxel_16"  # Original quality

[qualities]
voxel_16 = { path = "res://asset/characters/alice_16x16.png" }
voxel_32 = { path = "res://asset/characters/alice_32x32.png" }
voxel_64 = { path = "generated", model = "upscale-2x" }
sprite_hd = { path = "generated", model = "sdxl-turbo" }
model_3d = { path = "generated", model = "triposr" }
```

2. **Quality Selection Algorithm**

```gdscript
# SIAssetManager.gd
func select_asset_quality(asset_id: String) -> String:
    var gpu_tier = _detect_gpu_capability()
    var budget = SettingsManager.get_quality_budget()
    var distance = _get_camera_distance_to_asset()

    match gpu_tier:
        "high":
            if budget == "unlimited": return "model_3d"
            if distance < 500: return "sprite_hd"
            return "voxel_64"
        "medium":
            if distance < 300: return "sprite_hd"
            return "voxel_32"
        "low":
            return "voxel_16"
```

3. **On-Demand Generation**

```gdscript
func get_asset(asset_id: String, quality: String) -> Texture:
    var descriptor = _load_asset_descriptor(asset_id)
    var quality_info = descriptor.qualities[quality]

    if quality_info.path == "generated":
        return _generate_or_load_cached(asset_id, quality, quality_info.model)

    return load(quality_info.path)
```

**Integration with Asset Generation APIs**:

| Quality | Model | Input | Output | Cost |
|---------|-------|-------|--------|------|
| 2x Upscale | ESRGAN / Real-ESRGAN | 16x16 PNG | 32x32 PNG | Free (local) |
| HD Sprite | SDXL-Turbo | Text + 16px sprite | 128x128 PNG | $0.002 |
| 3D Model | TripoSR | Sprite/View | GLB/OBJ | $0.01 |

#### 2.4 Enhanced AI Behaviors (Week 4-6)

Extend AIAgent with new behaviors:

```gdscript
# Enhanced AIAgent
extends AIAgent

# New decision types
enum EnhancedDecision {
    MICROVERSE_ORIGINAL,  # Existing behavior
    REFLECT_ON_MEMORY,    # Metacognition
    LEARN_SKILL,          # Procedural memory formation
    SOCIAL_BOND,          # Relationship evolution
    CREATIVE_ACTION       # Novel behavior synthesis
}

func make_decision():
    # Original Microverse logic
    if not _should_use_enhanced_ai():
        await super.make_decision()
        return

    # SuperInstance-enhanced logic
    match _select_decision_type():
        EnhancedDecision.REFLECT_ON_MEMORY:
            await _reflect_and_update_identity()
        EnhancedDecision.LEARN_SKILL:
            await _extract_procedural_memory()
        EnhancedDecision.SOCIAL_BOND:
            await _update_relationships()
        EnhancedDecision.CREATIVE_ACTION:
            await _synthesize_novel_behavior()
```

**Temporal Consciousness** (for DMLoG.AI):

```gdscript
# Time-aware decision making
func _incorporate_temporal_context(prompt: String) -> String:
    var current_time = GameTimeManager.get_game_time()
    var time_memory = SIMemoryManager.get_time_anchored_memories(
        character,
        current_time - TimeSpan.days(7)
    )

    prompt += "\n\n【时间感知】"
    prompt += "\n当前游戏时间：" + current_time.format()
    prompt += "\n最近一周的重要时间节点："
    for memory in time_memory:
        prompt += "\n- " + memory.format_with_time()

    return prompt
```

---

### Phase 3: Quality Scaling (4-6 weeks)

**Goal**: Adaptive graphics based on hardware and user preferences

#### 3.1 GPU Detection System

Create unified hardware detection (extends existing `packages/hardware`):

```typescript
// backend/workers/asset-3d/gpu-detector.ts
export class GPUDetector {
  async detect(): Promise<GPUCapability> {
    if (typeof window !== 'undefined') {
      return this.detectWebGPU();  // Browser
    } else {
      return this.detectSystemGPU();  // Native
    }
  }

  private detectWebGPU(): GPUCapability {
    const adapter = await navigator.gpu.requestAdapter();
    return {
      tier: this.classifyAdapter(adapter),
      vram: estimateVRAM(adapter),
      features: listFeatures(adapter)
    };
  }
}

interface GPUCapability {
  tier: 'high' | 'medium' | 'low';
  vram: number;  // GB
  features: string[];
  recommended_quality: QualityLevel;
}
```

#### 3.2 Quality Presets

```gdscript
# QualityPresets.gd
const QUALITY_PRESETS = {
    "potato": {
        "sprite_resolution": 16,
        "max_entities_visible": 20,
        "animation_fps": 10,
        "enable_shadows": false,
        "enable_particles": false,
        "ai_model": "local_small"
    },
    "low": {
        "sprite_resolution": 32,
        "max_entities_visible": 50,
        "animation_fps": 15,
        "enable_shadows": false,
        "enable_particles": true,
        "ai_model": "cloud_fast"
    },
    "medium": {
        "sprite_resolution": 64,
        "max_entities_visible": 100,
        "animation_fps": 30,
        "enable_shadows": true,
        "enable_particles": true,
        "ai_model": "cloud_balanced"
    },
    "high": {
        "sprite_resolution": 128,
        "max_entities_visible": 200,
        "animation_fps": 60,
        "enable_shadows": true,
        "enable_particles": true,
        "ai_model": "cloud_premium"
    },
    "ultra": {
        "sprite_resolution": "3d_model",
        "max_entities_visible": -1,  # unlimited
        "animation_fps": 60,
        "enable_shadows": true,
        "enable_particles": true,
        "ai_model": "cloud_best"
    }
}
```

#### 3.3 LOD (Level of Detail) System

```gdscript
# LODManager.gd
extends Node

enum LODLevel {
    VERY_LOW,    # 16px sprites, simple animations
    LOW,         # 32px sprites
    MEDIUM,      # 64px sprites
    HIGH,        # 128px sprites / basic 3D
    ULTRA        # Full 3D models
}

func get_lod_for_distance(distance: float, importance: float) -> LODLevel:
    var gpu_tier = SIAssetManager.get_gpu_tier()
    var adjusted_distance = distance / importance  # Important objects = higher LOD at distance

    match gpu_tier:
        "high":
            if adjusted_distance < 200: return LODLevel.ULTRA
            if adjusted_distance < 500: return LODLevel.HIGH
            if adjusted_distance < 1000: return LODLevel.MEDIUM
            return LODLevel.LOW
        "medium":
            if adjusted_distance < 150: return LODLevel.HIGH
            if adjusted_distance < 400: return LODLevel.MEDIUM
            return LODLevel.LOW
        "low":
            return LODLevel.VERY_LOW
```

---

### Phase 4: Multi-Product Integration (6-8 weeks)

**Goal**: Shared platform for StudyLoG.AI and DMLoG.AI

#### 4.1 Product-Agnostic Core

Extract Microverse into product-agnostic modules:

```
godot-source/modules/microverse/
├── core/               # Product-agnostic
│   ├── ai/
│   │   ├── agent.gd
│   │   ├── memory/
│   │   └── dialog/
│   ├── world/
│   │   ├── room.gd
│   │   ├── navigation.gd
│   │   └── objects/
│   └── systems/
│       ├── save_load.gd
│       └── time.gd
├── studylog/           # StudyLoG.AI specific
│   ├── characters/
│   │   ├── tutor_alice.gd
│   │   └── mentor_bob.gd
│   ├── scenarios/
│   │   └── coding_lab.gd
│   └── systems/
│       └── learning_progress.gd
└── dmlog/              # DMLoG.AI specific
    ├── characters/
    │   ├── dungeon_master.gd
    │   └── party_member.gd
    ├── scenarios/
    │   └── encounter.gd
    └── systems/
        ├── turn_tracker.gd
        └── initiative.gd
```

#### 4.2 Cross-Product Memory Sharing

Enable agents to carry learnings between products:

```gdscript
# SharedMemoryService.gd
extends Node

signal memory_shared(source_product: String, target_product: String, memory: Dictionary)

func share_cross_product_memory(character_id: String, memory: Dictionary):
    var shared = {
        "character_id": character_id,
        "source_product": _get_current_product(),
        "memory": memory,
        "timestamp": Time.get_unix_time_from_system(),
        "access_control": _get_access_policy(character_id)
    }

    # Store in backend for cross-product access
    await SIAPIRouter.call_backend("memory", "share_cross_product", shared)
```

**Use Cases**:

| StudyLoG.AI -> DMLoG.AI | DMLoG.AI -> StudyLoG.AI |
|-------------------------|-------------------------|
| Learning patterns -> Tactics | Tactics -> Problem-solving |
| Tutorial completion -> Class unlocks | Quest completion -> Skill unlocks |
| Mentor relationships -> NPC attitudes | Party bonds -> Study groups |

#### 4.3 Unified Backend API

```typescript
// Unified backend for both products
// backend/workers/microverse-backend/src/index.ts

export interface MicroverseRequest {
  product: 'studylog' | 'dmlog';
  action: 'agent_tick' | 'dialog' | 'memory' | 'save';
  payload: unknown;
}

export interface AgentTickRequest extends MicroverseRequest {
  action: 'agent_tick';
  payload: {
    agent_id: string;
    perception: PerceptionData;
    current_state: AgentState;
    product_context: ProductContext;
  };
}

export interface ProductContext {
  scenario_id: string;
  learning_objectives?: string[];  // StudyLoG
  encounter_state?: EncounterState;  // DMLoG
}
```

---

## 4. SuperInstance Layer Design

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Godot Runtime (Microverse)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Microverse Core (Unmodified)                            │  │
│  │  - AIAgent, DialogManager, MemoryManager, etc.           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SuperInstance Adapter Layer                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │SIMemory    │  │SIAPIRouter │  │SIAsset     │         │  │
│  │  │Manager     │  │            │  │Manager     │         │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │  │
│  │        └─────────────────┴──────────────┘               │  │
│  │                      │                                   │  │
│  │              ┌───────▼────────┐                          │  │
│  │              │ SICollaboration│                          │  │
│  │              │ (SmartCRDT)     │                          │  │
│  │              └────────────────┘                          │  │
│  └────────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────────┘
                            │ WebSocket + HTTP
┌───────────────────────────▼─────────────────────────────────────┐
│                    Theia IDE Frontend                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐               │
│  │si-godot-   │  │si-multi-  │  │si-agent-  │               │
│  │embed       │  │model      │  │director   │               │
│  └────────────┘  └────────────┘  └────────────┘               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                 SuperInstance Backend                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Workers (Cloudflare Workers)                     │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │multi-model │ │asset-3d    │ │bazaar      │           │  │
│  │  │router      │ │generation  │ │            │           │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │microverse- │ │smartcrdt   │ │memory-     │           │  │
│  │  │bridge      │ │sync        │ │consolidation│          │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              D1 Database (SQLite)                        │  │
│  │  - agent_memories                                        │  │
│  │  - cross_product_memories                                │  │
│  │  - generated_assets                                      │  │
│  │  - world_states                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Adapter Pattern Implementation

```gdscript
# SIMemoryManager.gd - Adapts our 6-tier system to Microverse
extends MemoryManager

# Original Microverse memory types
const MICROVERSE_TYPE_MAP = {
    SIMemoryType.WORKING: MemoryType.PERSONAL,
    SIMemoryType.EPISODIC: MemoryType.INTERACTION,
    SIMemoryType.SEMANTIC: MemoryType.PERSONAL,  # Closest match
    SIMemoryType.PROCEDURAL: MemoryType.TASK,
    SIMemoryType.REFLECTION: MemoryType.EMOTION,
    SIMemoryType.IDENTITY: MemoryType.EVENT
}

# Override add_memory to use our system
func add_memory(character: Node, content: String,
                si_type: SIMemoryType, importance: MemoryImportance) -> void:
    # Add to our backend
    await _add_to_backend(character, content, si_type, importance)

    # Also add to local Microverse system for compatibility
    var mv_type = MICROVERSE_TYPE_MAP.get(si_type, MemoryType.PERSONAL)
    super.add_memory(character, content, mv_type, importance)

func _add_to_backend(character: Node, content: String,
                    si_type: SIMemoryType, importance: MemoryImportance):
    var payload = {
        "character_id": character.name,
        "content": content,
        "tier": si_type,
        "importance": importance,
        "product": _get_current_product()
    }

    await SIAPIRouter.call_backend("memory", "add", payload)
```

### 4.3 NVIDIA ACE Integration

```gdscript
# SIDigitalHuman.gd - Audio2Face integration
extends Node3D

signal talking_started()
signal talking_finished()

var ace_client: HTTPClient
var audio2face_url: str = "wss://ace-server.nvidia.com/audio2face"

func generate_animation(text: String, voice_profile: String):
    # 1. Generate TTS audio
    var audio_data = await _generate_speech(text, voice_profile)

    # 2. Send to Audio2Face
    var facial_animation = await _request_audio2face(audio_data)

    # 3. Apply to character
    _apply_facial_animation(facial_animation)

    talking_started.emit()

    # 4. Wait for completion
    await _wait_for_animation_complete()

    talking_finished.emit()

func _request_audio2face(audio_data: PackedByteArray) -> Dictionary:
    var ws = WebSocketPeer.new()
    ws.connect_to_url(audio2face_url)

    # Send audio data
    ws.put_packet(audio_data)

    # Receive animation data
    var animation_data = []
    while ws.get_available_packet_count() > 0:
        animation_data.append(ws.get_packet())

    return {
        "blend_shapes": animation_data,
        "duration": audio_data.size() / 48000.0  # Assuming 48kHz
    }
```

**Character Scene Structure**:

```
CharacterWithACE (CharacterBody3D)
├── MeshInstance3D (Head)
│   └── Skeleton3D
│       └── BlendShapeContainer
│           ├── eyeblink_left
│           ├── eyeblink_right
│           ├── jaw_open
│           ├── mouth_smile
│           └── ... (ARKit 52 blend shapes)
├── AudioStreamPlayer3D (Voice)
└── SIDigitalHuman (script)
```

### 4.4 SmartCRDT Collaboration

```typescript
// backend/workers/smartcrdt-sync/src/index.ts
import { CRDT, Doc } from '@clockworklabs/crdt';

export class WorldStateSync {
  private doc: Doc;
  private worldState: CRDT.Map;

  constructor() {
    this.doc = new Doc();
    this.worldState = this.doc.getMap('world');
  }

  syncAgentState(agentId: string, state: AgentState) {
    const agentMap = this.worldState.get(agentId) || new CRDT.Map();

    agentMap.set('position', state.position);
    agentMap.set('facing', state.facing);
    agentMap.set('current_task', state.current_task);
    agentMap.set('mood', state.mood);

    this.worldState.set(agentId, agentMap);

    // Broadcast to other clients
    this.broadcast({
      type: 'agent_update',
      agent_id: agentId,
      state
    });
  }

  resolveConflict(localState: AgentState, remoteState: AgentState): AgentState {
    // Last-write-wins for position
    const position = remoteState.timestamp > localState.timestamp
      ? remoteState.position
      : localState.position;

    // Merge for tasks (union)
    const tasks = new Set([...localState.tasks, ...remoteState.tasks]);

    // Vector clock for mood (causal)
    const mood = this.compareVectorClocks(localState, remoteState);

    return { position, tasks: Array.from(tasks), mood };
  }
}
```

---

## 5. Technical Implementation Plans

### 5.1 File Organization

```
studylog-github/
├── godot-source/
│   └── modules/
│       └── microverse/              # Imported as submodule
│           ├── core/                # From upstream
│           │   ├── script/
│           │   └── scene/
│           └── superinstance/       # Our additions
│               ├── si_memory/
│               │   ├── SIMemoryManager.gd
│               │   ├── MemoryConsolidation.gd
│               │   └── CrossProductMemory.gd
│               ├── si_ai/
│               │   ├── SIAPIRouter.gd
│               │   ├── CascadeDecision.gd
│               │   └── TemporalConsciousness.gd
│               ├── si_assets/
│               │   ├── SIAssetManager.gd
│               │   ├── QualityPresets.gd
│               │   └── LODManager.gd
│               ├── si_collab/
│               │   ├── SICollaboration.gd
│               │   └── SmartCRDTClient.gd
│               ├── si_digital_human/
│               │   ├── SIDigitalHuman.gd
│               │   ├── ACEClient.gd
│               │   └── Audio2FaceBridge.gd
│               └── studylog/            # StudyLoG.AI specific
│                   ├── characters/
│                   │   └── TutorCharacter.gd
│                   └── scenarios/
│                       └── LearningScenario.gd
├── backend/
│   └── workers/
│       ├── microverse-bridge/        # Godot-Theia bridge
│       │   └── src/
│       │       ├── index.ts
│       │       └── websocket-handler.ts
│       ├── memory-consolidation/     # Background memory processing
│       ├── asset-3d-generation/      # On-demand asset generation
│       └── smartcrdt-sync/           # Real-time collaboration
├── apps/theia-ide/
│   └── extensions/
│       ├── si-godot-embed/           # Enhanced for Microverse
│       │   ├── browser/
│       │   │   └── microverse-inspector/
│       │   └── backend/
│       │       └── microverse-protocol.ts
│       └── si-memory-viz/            # NEW: Memory visualization
│           ├── browser/
│           │   └── memory-hierarchy-view/
│           └── backend/
│               └── memory-data-provider.ts
└── docs/
    └── MICROVERSE_INTEGRATION.md     # This document
```

### 5.2 Configuration

**si_config.toml** (Product-agnostic config):

```toml
[superinstance]
product = "studylog"  # or "dmlog"
version = "0.1.0"

[memory]
# Memory consolidation intervals
working_to_episodic_hours = 1
episodic_to_semantic_days = 7
reflection_interval_hours = 24

[ai]
# Model routing
default_provider = "deepseek"
cascade_enabled = true
cost_limit_us_per_hour = 0.50

[assets]
# Quality settings
default_quality_preset = "medium"
enable_autogen = true
cache_dir = "user://asset_cache"

[collaboration]
# SmartCRDT settings
sync_interval_ms = 100
conflict_resolution = "last-write-wins"
enable_presence = true

[nvidia]
# ACE/Audio2Face
ace_server_url = "wss://localhost:8080"
audio2face_enabled = false  # Opt-in for performance
```

### 5.3 API Contracts

**Microverse <-> SuperInstance Backend**:

```typescript
// POST /api/microverse/agent/tick
interface AgentTickRequest {
  agent_id: string;
  product: 'studylog' | 'dmlog';
  perception: {
    room: string;
    nearby_entities: Entity[];
    recent_memories: Memory[];
  };
  current_state: {
    position: Vector2;
    mood: string;
    active_task?: Task;
  };
}

interface AgentTickResponse {
  action: 'move' | 'talk' | 'wait' | 'task';
  target?: string;
  dialog?: string;
  memory_to_add?: Memory;
  cost_usd: number;
}

// POST /api/microverse/dialog/generate
interface DialogRequest {
  speaker: string;
  listener: string;
  context: {
    relationship: number;  // -10 to 10
    recent_history: ChatMessage[];
    shared_memories: Memory[];
  };
}

interface DialogResponse {
  text: string;
  emotional_tone: string;
  should_continue: boolean;
  memories_created: Memory[];
}

// POST /api/microverse/memory/consolidate
interface MemoryConsolidationRequest {
  agent_id: string;
  memories: Memory[];
}

interface MemoryConsolidationResponse {
  semantic_memories: SemanticMemory[];
  procedural_memories: ProceduralMemory[];
  reflection_updates: ReflectionMemory[];
}
```

---

## 6. Risk Assessment

### 6.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Godot 4 API changes | Medium | Medium | Pin to 4.3, abstract vendor APIs |
| Memory consolidation complexity | High | High | Start with simple rules, iterate |
| Real-time sync latency | Medium | Medium | Optimistic updates, conflict resolution |
| NVIDIA ACE availability | Low | High | Fallback to procedural animation |
| Cross-product memory conflicts | Medium | Low | Strict access control, opt-in |
| Asset generation costs | High | High | Aggressive caching, quality tiers |

### 6.2 Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Microverse upstream | Abandonment | Fork, maintain our version |
| Godot Engine | Breaking changes | Version pin, test on RCs |
| AI Providers | API changes | Abstraction layer, fallbacks |
| NVIDIA ACE | Service availability | Graceful degradation |
| Cloudflare Workers | Limits/costs | Monitoring, caching |

### 6.3 Licensing

Microverse uses **MIT License**, which is compatible with our commercial use. We can:

- Fork and modify freely
- Use in commercial products
- Keep changes private
- Subclass and extend

**Recommendation**: Fork to `github.com/SuperInstance/microverse` for our modifications.

---

## 7. Appendices

### Appendix A: Microverse Character Personalities

Complete personality configurations from upstream:

| Name | Position | Personality Key Traits |
|------|----------|----------------------|
| **Alice** | Frontend Engineer, UI Designer | "Design thorn rose", sarcastic, anti-996 |
| **Grace** | HR | Detail-oriented, uses astrology, negotiator |
| **Jack** | Backend Engineer | Introverted, tech-focused, cares deeply |
| **Joe** | QA Engineer | OCD-level detail, toxic, perfectionist |
| **Lea** | Front Desk | Social butterfly, information broker |
| **Monica** | Product Manager | Ambitious, data-driven, workaholic |
| **Stephen** | CEO (SleepySheep) | Manipulative, "Oscar-level hypocrite", PUA expert |
| **Tom** | Executive Secretary | Sycophantic, office gossip, two-faced |

### Appendix B: Godot 4.3 Key APIs Used

| API | Purpose | Notes |
|-----|---------|-------|
| `HTTPRequest` | API calls | Non-blocking, signals |
| `NavigationServer2D` | Pathfinding | Used for AI movement |
| `SceneTree` | Scene management | Node access |
| `FileAccess` | Save/load | User directory storage |
| `Timer` | Decision loops | 60-second intervals |
| `Signal` | Event system | Async/await patterns |

### Appendix C: Performance Considerations

**Current Microverse Performance**:
- 8 AI agents with 60-second decision intervals
- Single-threaded GDScript
- 2D sprite rendering
- ~60 FPS target on modest hardware

**SuperInstance Additions**:
- Memory consolidation: Background worker
- Asset generation: Cached, on-demand
- ACE/Audio2Face: Opt-in, GPU-accelerated
- SmartCRDT: Incremental updates

**Optimization Strategies**:
1. **Decision Batching**: Process multiple agents in single LLM call
2. **Memory Pruning**: Aggressive working memory cleanup
3. **Asset LOD**: Distance-based quality scaling
4. **AI Model Tiering**: Cheap models for background agents

### Appendix D: Migration Checklist

**Phase 1: Foundation**
- [ ] Clone Microverse repository
- [ ] Set up as Godot submodule
- [ ] Create superinstance/ directory structure
- [ ] Implement SIMemoryManager adapter
- [ ] Implement SIAPIRouter
- [ ] Create Theia inspector extension
- [ ] Write integration tests

**Phase 2: AI Layer**
- [ ] Implement 6-tier memory hierarchy
- [ ] Connect to multi-model-router cascade
- [ ] Create asset generation pipeline
- [ ] Add enhanced AI behaviors
- [ ] Implement temporal consciousness (DMLoG)

**Phase 3: Quality Scaling**
- [ ] Implement GPU detection
- [ ] Create quality presets
- [ ] Build LOD system
- [ ] Add asset caching
- [ ] Performance testing

**Phase 4: Multi-Product**
- [ ] Extract product-agnostic core
- [ ] Create StudyLoG.AI specific modules
- [ ] Create DMLoG.AI specific modules
- [ ] Implement cross-product memory sharing
- [ ] Unified backend API

### Appendix E: Glossary

| Term | Definition |
|------|------------|
| **AIAgent** | Microverse's core AI decision-making component |
| **Being State** | Agent's internal state (mood, health, etc.) |
| **CRDT** | Conflict-free Replicated Data Type |
| **Deckhand** | SLM + LoRA adapter agent tier |
| **LoD** | Level of Detail (graphics scaling) |
| **Whale** | Orchestrator agent tier |
| **Zooplankton** | Token-level processing tier |
| **Temporal Consciousness** | Time-aware agent reasoning (DMLoG) |
| **Memory Consolidation** | Conversion of short-term to long-term memory |
| **Cascade Routing** | Multi-tier model selection |

---

## Conclusion

Microverse provides an excellent foundation for SuperInstance.AI's virtual world simulation needs. Its clean architecture, GDScript implementation, and singleton-based design align perfectly with our Godot-first strategy.

**Key Advantages**:
1. **80% Foundation Already Built**: Agent AI, memory, dialog, save/load
2. **Proven Architecture**: 5,464 lines of well-structured GDScript
3. **Extensible Design**: Autoload singletons enable clean SuperInstance layer
4. **MIT License**: Full commercial use and modification rights

**Our Value Add - The SuperInstance Layer**:
1. **6-Tier Memory System**: Hierarchical memory with consolidation
2. **Generative AI Look & Feel**: Runtime asset quality transformation
3. **Scalable 3D Quality**: Voxel to 3D based on hardware
4. **NVIDIA ACE Integration**: Digital humans with Audio2Face
5. **Cross-Product Memory**: StudyLoG + DMLoG sharing
6. **SmartCRDT Collaboration**: Real-time multiplayer

**Recommended Path Forward**:
1. Fork Microverse to `SuperInstance/microverse`
2. Begin Phase 1 integration immediately
3. Parallel development of SuperInstance adapters
4. Target alpha release by end of Q1 2026

---

**Document Status**: Complete - Ready for Review
**Next Steps**: Engineering kickoff, resource allocation
**Contact**: SuperInstance.AI Research Team

---

## Appendix F: StudyLoG.AI Specific Enhancements

### F.1 Learning Scenario System

StudyLoG.AI requires educational scenarios beyond Microverse's office setting:

```gdscript
# LearningScenario.gd
extends Node

class_name LearningScenario

var scenario_id: String
var title: String
var description: String
var difficulty: int  # 1-10
var learning_objectives: Array[String]
var required_knowledge: Array[String]
var rewards: Dictionary
var time_limit: int  # seconds

func generate_scenario_context(agent: AIAgent) -> String:
    var context = "=== 学习场景: %s ===\n" % title
    context += "难度: %d/10\n" % difficulty
    context += "描述: %s\n\n" % description
    context += "学习目标:\n"
    for obj in learning_objectives:
        context += "- %s\n" % obj
    context += "\n当前学生状态:\n"
    context += agent.get_character_status_info()
    return context

# Example scenarios
const SCENARIOS = {
    "coding_basics": {
        "title": "编程基础入门",
        "description": "学习变量、循环和条件语句的基本概念",
        "difficulty": 3,
        "learning_objectives": [
            "理解变量的概念",
            "掌握for循环的使用",
            "学会if-else条件判断"
        ],
        "npc_tutors": ["Alice"],  # Available tutor NPCs
        "ambient_music": "calm_study.mp3"
    },
    "data_structures": {
        "title": "数据结构进阶",
        "description": "深入学习数组、链表和树形结构",
        "difficulty": 7,
        "learning_objectives": [
            "理解数组的内存布局",
            "实现链表的基本操作",
            "掌握树的遍历算法"
        ],
        "npc_tutors": ["Alice", "Jack"],
        "ambient_music": "focus_mode.mp3"
    }
}
```

### F.2 Tutorial Character System

Adapt Microverse characters for educational roles:

```gdscript
# TutorCharacter.gd
extends "res://microverse/core/script/ai/AIAgent.gd"

class_name TutorCharacter

var teaching_style: String  # "patient", "challenging", "socratic"
var subject_expertise: Array[String]
var patience_level: float = 1.0  # Decreases with repeated mistakes

func generate_tutor_prompt(student: CharacterBody2D, question: String) -> String:
    var prompt = "你是一个AI导师，名字是%s。" % character.name
    prompt += "\n你的教学风格: %s" % teaching_style
    prompt += "\n你的专长领域: %s" % ", ".join(subject_expertise)
    prompt += "\n\n当前学生: %s" % student.name

    # Get student's learning state
    var student_progress = _get_student_progress(student)
    prompt += "\n\n学生当前进度:"
    prompt += "\n- 已学概念: %s" % ", ".join(student_progress.learned_concepts)
    prompt += "\n- 困难点: %s" % ", ".join(student_progress.struggle_points)
    prompt += "\n- 连续错误: %d次" % student_progress.consecutive_mistakes

    # Adjust patience
    var effective_patience = patience_level - (student_progress.consecutive_mistakes * 0.1)
    if effective_patience < 0.3:
        prompt += "\n\n注意: 你的耐心快耗尽了，需要给出更直接的提示。"

    prompt += "\n\n学生问题: %s" % question
    prompt += "\n\n请用你的教学风格回答，帮助学生理解。"
    prompt += "\n如果学生连续犯错，提供更具体的指导。"

    return prompt
```

### F.3 Progress Tracking System

```gdscript
# LearningProgress.gd
extends Node

class_name LearningProgressManager

var student_progress: Dictionary = {}  # student_id -> ProgressData

class ProgressData:
    var learned_concepts: Array[String] = []
    var struggle_points: Array[String] = []
    var consecutive_mistakes: int = 0
    var time_spent_learning: int = 0  # seconds
    var scenarios_completed: Array[String] = []
    var skill_levels: Dictionary = {}  # concept -> level (0-100)

func record_learning_event(student_id: String, concept: String, success: bool):
    if not student_progress.has(student_id):
        student_progress[student_id] = ProgressData.new()

    var progress = student_progress[student_id]

    if success:
        if concept not in progress.learned_concepts:
            progress.learned_concepts.append(concept)

        # Remove from struggle points if present
        if concept in progress.struggle_points:
            progress.struggle_points.erase(concept)

        progress.consecutive_mistakes = 0

        # Increase skill level
        var current_level = progress.skill_levels.get(concept, 0)
        progress.skill_levels[concept] = min(100, current_level + 10)
    else:
        if concept not in progress.struggle_points:
            progress.struggle_points.append(concept)

        progress.consecutive_mistakes += 1

        # Notify tutor to adjust teaching approach
        _notify_tutor_needs_help(student_id, concept)

func get_recommended_next_scenario(student_id: String) -> String:
    var progress = student_progress.get(student_id)
    if not progress:
        return "coding_basics"  # Default starting point

    # Find concepts with low skill levels
    var weak_concepts = []
    for concept in progress.skill_levels:
        if progress.skill_levels[concept] < 50:
            weak_concepts.append(concept)

    # Match to scenario
    for scenario_id in LearningScenario.SCENARIOS:
        var scenario = LearningScenario.SCENARIOS[scenario_id]
        for weak_concept in weak_concepts:
            if weak_concept in scenario.description.to_lower():
                return scenario_id

    return "coding_basics"
```

---

## Appendix G: DMLoG.AI Specific Enhancements

### G.1 Encounter System

```gdscript
# EncounterSystem.gd
extends Node

class_name EncounterSystem

enum EncounterType {
    COMBAT,
    SOCIAL,
    EXPLORATION,
    PUZZLE,
    ROLEPLAY
}

var current_encounter: Encounter
var initiative_order: Array[CharacterBody2D]
var current_turn: int = 0

func generate_encounter(party: Array[CharacterBody2D], location: String) -> Encounter:
    var encounter = Encounter.new()
    encounter.location = location
    encounter.type = _select_encounter_type(location)
    encounter.participants = party.duplicate()

    # Generate opponents based on party level and location
    var opponents = _generate_opponents(party, location)
    encounter.participants.append_array(opponents)

    # Roll initiative
    initiative_order = _roll_initiative(encounter.participants)

    return encounter

func _roll_initiative(participants: Array[CharacterBody2D]) -> Array[CharacterBody2D]:
    var rolled = []
    for pc in participants:
        var initiative = _d20() + _get_dexterity_modifier(pc)
        rolled.append({"initiative": initiative, "character": pc})

    rolled.sort_custom(func(a, b): return a.initiative > b.initiative)

    var result = []
    for entry in rolled:
        result.append(entry.character)
    return result

func _d20() -> int:
    return randi() % 20 + 1

func process_turn():
    var current_character = initiative_order[current_turn]

    # Generate turn-based decision with temporal consciousness
    var context = _generate_encounter_context(current_character)
    var decision = await current_character.make_encounter_decision(context)

    _execute_decision(decision)

    current_turn = (current_turn + 1) % initiative_order.size()

func _generate_encounter_context(character: CharacterBody2D) -> String:
    var context = "=== 遭遇战回合 %d ===\n" % (current_turn / initiative_order.size() + 1)
    context += "当前行动: %s\n\n" % character.name

    # Add turn order
    context += "先攻顺序:\n"
    for i in range(initiative_order.size()):
        var c = initiative_order[i]
        var status = i == current_turn ? "<-- 当前" : ""
        context += "%d. %s %s\n" % [i+1, c.name, status]

    # Add visible opponents with HP
    context += "\n可见对手:\n"
    for participant in initiative_order:
        if participant.is_in_group("enemies") and _is_visible_to(character, participant):
            var hp_percent = _get_hp_percentage(participant)
            var status_desc = _describe_health_status(hp_percent)
            context += "- %s (%s)\n" % [participant.name, status_desc]

    # Add temporal context for DMLoG
    context += "\n时间感知:\n"
    context += "- 遭战开始: %s前\n" % _time_since_encounter_start()
    context += "- 回合持续: 约%d秒\n" % _get_turn_duration_seconds()

    return context
```

### G.2 Dungeon Master AI

```gdscript
# DungeonMaster.gd
extends "res://microverse/core/script/ai/AIAgent.gd"

class_name DungeonMaster

var campaign_state: Dictionary
var world_history: Array[Dictionary]
var player_characters: Array[CharacterBody2D]

func generate_narration(action_description: String, context: Dictionary) -> String:
    var prompt = "你是地下城主（DM），负责主持一场D&D风格的游戏。\n\n"

    # Add campaign context
    prompt += "=== 战役状态 ===\n"
    prompt += "当前场景: %s\n" % campaign_state.get("current_scene", "unknown")
    prompt += "天气: %s\n" % campaign_state.get("weather", "晴朗")
    prompt += "时间: %s\n" % campaign_state.get("game_time", "白天")

    # Add recent world history for temporal consciousness
    if world_history.size() > 0:
        prompt += "\n最近发生的事件:\n"
        for i in range(max(0, world_history.size() - 5), world_history.size()):
            prompt += "- %s\n" % world_history[i].description

    # Add player action
    prompt += "\n玩家行动: %s\n" % action_description

    # Add contextual details
    if context.has("dice_roll"):
        prompt += "\n掷骰结果: %s" % context["dice_roll"]

    prompt += "\n\n请描述这个行动的结果，营造沉浸式的叙事体验。"
    prompt += "\n要求:"
    prompt += "\n1. 体现你的DM风格（根据当前战役基调）"
    prompt += "\n2. 考虑玩家角色的背景和特性"
    prompt += "\n3. 引入合理的随机性（参考掷骰结果）"
    prompt += "\n4. 为下一个选择埋下伏笔"
    prompt += "\n5. 50-100字的生动描述"

    return await SIAPIRouter.generate_narration(prompt)

func adjust_difficulty(player_success_rate: float):
    if player_success_rate > 0.8:
        # Introduce complications
        campaign_state["difficulty_modifier"] = campaign_state.get("difficulty_modifier", 0) + 1
    elif player_success_rate < 0.3:
        # Offer advantages
        campaign_state["difficulty_modifier"] = campaign_state.get("difficulty_modifier", 0) - 1

func generate_random_encounter() -> Dictionary:
    var terrain = campaign_state.get("current_terrain", "plains")
    var party_level = _get_average_party_level()

    var encounter_table = {
        "plains": [
            {"type": "bandits", "probability": 0.4, "cr": party_level - 1},
            {"type": "merchants", "probability": 0.3, "cr": party_level - 2},
            {"type": "wild_animals", "probability": 0.3, "cr": party_level}
        ],
        "dungeon": [
            {"type": "goblins", "probability": 0.5, "cr": party_level},
            {"type": "traps", "probability": 0.3, "cr": party_level + 1},
            {"type": "treasure", "probability": 0.2, "cr": party_level - 1}
        ]
    }

    var options = encounter_table.get(terrain, encounter_table["plains"])
    var roll = randf()
    var cumulative = 0.0

    for option in options:
        cumulative += option["probability"]
        if roll <= cumulative:
            return option

    return options[0]
```

### G.3 Temporal Consciousness Implementation

```gdscript
# TemporalConsciousness.gd
extends Node

class_name TemporalConsciousness

# Time-anchored memories for DMLoG
var temporal_memories: Dictionary = {}  # character_id -> TimeAnchoredMemory[]

class TimeAnchoredMemory:
    var timestamp: float  # Game time when memory formed
    var real_timestamp: float  # Real time
    var content: String
    var emotional_weight: float  # 0-1
    var participants: Array[String]  # Who was present
    var location: String
    var importance_decay: float  # How fast this memory fades

func add_temporal_memory(character_id: String, memory: TimeAnchoredMemory):
    if not temporal_memories.has(character_id):
        temporal_memories[character_id] = []

    temporal_memories[character_id].append(memory)

    # Trigger reflection if significant
    if memory.emotional_weight > 0.7:
        _schedule_reflection(character_id, memory)

func get_time_anchored_memories(character_id: String, time_window: Dictionary) -> Array:
    var memories = temporal_memories.get(character_id, [])
    var result = []

    var current_game_time = GameTimeManager.get_game_time()
    var start_time = current_game_time - time_window.get("days", 0) * 86400
    start_time -= time_window.get("hours", 0) * 3600

    for memory in memories:
        if memory.timestamp >= start_time:
            result.append(memory)

    # Sort by time, most recent first
    result.sort_custom(func(a, b): return a.timestamp > b.timestamp)

    return result

func detect_temporal_patterns(character_id: String) -> Dictionary:
    var memories = temporal_memories.get(character_id, [])
    var patterns = {
        "daily_routines": [],
        "weekly_cycles": [],
        "seasonal_preferences": {}
    }

    # Analyze timestamps for patterns
    var hour_counts = {}
    var day_counts = {}

    for memory in memories:
        var datetime = Time.get_datetime_dict_from_unix_time(memory.timestamp)
        var hour = datetime.hour
        var day_of_week = datetime.weekday

        if not hour_counts.has(hour):
            hour_counts[hour] = 0
        hour_counts[hour] += 1

        if not day_counts.has(day_of_week):
            day_counts[day_of_week] = 0
        day_counts[day_of_week] += 1

    # Find peak activity times
    var peak_hour = _get_dict_key_with_max_value(hour_counts)
    patterns["daily_routines"].append({
        "type": "peak_activity",
        "hour": peak_hour,
        "confidence": hour_counts[peak_hour] / float(memories.size())
    })

    return patterns

func _get_dict_key_with_max_value(dict: Dictionary):
    var max_key = null
    var max_value = -1

    for key in dict:
        if dict[key] > max_value:
            max_value = dict[key]
            max_key = key

    return max_key
```

---

## Appendix H: Being State Transformation System

### H.1 Being State Definition

```gdscript
# BeingState.gd
extends Resource

class_name BeingState

@export var mood: String = "neutral"  # happy, sad, angry, fearful, etc.
@export var energy: float = 1.0  # 0-1
@export var stress: float = 0.0  # 0-1
@export var focus: float = 0.5  # 0-1
@export var social_satisfaction: float = 0.5  # 0-1
@export var purpose_fulfillment: float = 0.5  # 0-1

# Derived states
func get_primary_emotion() -> String:
    if stress > 0.7:
        return "anxious"
    if energy < 0.3:
        return "exhausted"
    if social_satisfaction < 0.3:
        return "lonely"
    if purpose_fulfillment > 0.8:
        return "fulfilled"
    if mood == "happy":
        return "joyful"
    return "neutral"

func get_behavioral_tendency() -> Dictionary:
    return {
        "exploration": 1.0 - stress,
        "socialization": social_satisfaction * energy,
        "task_focus": focus * energy,
        "risk_taking": 1.0 - stress * 2,
        "creativity": focus * (1.0 - stress)
    }

func transform_from_memory(memory: Memory, importance: float) -> void:
    # Adjust being state based on memory
    match memory.type:
        MemoryType.EMOTION:
            if memory.content.contains("success") or memory.content.contains("won"):
                mood = "happy"
                purpose_fulfillment = min(1.0, purpose_fulfillment + 0.1)
            elif memory.content.contains("failure") or memory.content.contains("lost"):
                stress = min(1.0, stress + 0.15 * importance)
                mood = "sad"
        MemoryType.INTERACTION:
            if memory.importance >= MemoryImportance.HIGH:
                social_satisfaction = min(1.0, social_satisfaction + 0.1)
        MemoryType.TASK:
            if memory.get("completed", false):
                purpose_fulfillment = min(1.0, purpose_fulfillment + 0.05)
            else:
                stress = min(1.0, stress + 0.05)

func get_state_signature() -> String:
    # Create a unique signature for the current state
    # Used for detecting significant state changes
    return "%s_%.2f_%.2f_%.2f_%.2f_%.2f" % [
        mood, energy, stress, focus,
        social_satisfaction, purpose_fulfillment
    ]
```

### H.2 State Transformation Engine

```gdscript
# StateTransformationEngine.gd
extends Node

class_name StateTransformationEngine

# Transformation rules that define how Being State changes
var transformation_rules: Array[TransformationRule]

func _ready():
    _initialize_default_rules()

func apply_transformations(agent: AIAgent, context: Dictionary) -> BeingState:
    var current_state = agent.get_being_state()
    var new_state = current_state.duplicate()

    for rule in transformation_rules:
        if rule.matches(context):
            new_state = rule.apply(new_state, context)

    # Natural decay over time
    new_state.energy = max(0.0, new_state.energy - 0.01)
    new_state.focus = max(0.0, min(1.0, new_state.focus - 0.005))

    agent.set_being_state(new_state)
    return new_state

class TransformationRule:
    var condition: Callable
    var transformation: Callable
    var priority: int = 0

    func matches(context: Dictionary) -> bool:
        return condition.call(context)

    func apply(state: BeingState, context: Dictionary) -> BeingState:
        return transformation.call(state, context)

func _initialize_default_rules():
    # Social interaction boosts satisfaction
    var social_rule = TransformationRule.new()
    social_rule.condition = func(ctx): return ctx.get("action_type") == "social"
    social_rule.transformation = func(state, ctx):
        state.social_satisfaction = min(1.0, state.social_satisfaction + 0.15)
        state.energy = max(0.0, state.energy - 0.05)
        return state
    transformation_rules.append(social_rule)

    # Task completion increases purpose
    var task_rule = TransformationRule.new()
    task_rule.condition = func(ctx): return ctx.get("action_type") == "task_complete"
    task_rule.transformation = func(state, ctx):
        state.purpose_fulfillment = min(1.0, state.purpose_fulfillment + 0.2)
        state.mood = "happy"
        return state
    transformation_rules.append(task_rule)

    # Conflict increases stress
    var conflict_rule = TransformationRule.new()
    conflict_rule.condition = func(ctx): return ctx.get("action_type") == "conflict"
    conflict_rule.transformation = func(state, ctx):
        state.stress = min(1.0, state.stress + 0.25)
        state.energy = max(0.0, state.energy - 0.1)
        return state
    transformation_rules.append(conflict_rule)
```

---

## Appendix I: Asset Generation Pipeline Details

### I.1 Voxel to 3D Model Generation

```typescript
// backend/workers/asset-3d-generation/src/generators.ts

export interface AssetGenerationRequest {
  source_asset: {
    id: string;
    type: 'voxel_16' | 'voxel_32' | 'sprite';
    data: string;  // base64 or URL
  };
  target_quality: 'sprite_hd' | 'model_3d';
  style?: string;
  character_id?: string;
}

export class AssetGenerator {
  private cache: R2Bucket;
  private queue: Queue<AssetGenerationRequest>;

  async generate(request: AssetGenerationRequest): Promise<GeneratedAsset> {
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(await cached.text());
    }

    // Generate based on target quality
    let result: GeneratedAsset;

    switch (request.target_quality) {
      case 'sprite_hd':
        result = await this.generateHDsprite(request);
        break;
      case 'model_3d':
        result = await this.generate3DModel(request);
        break;
    }

    // Cache the result
    await this.cache.put(cacheKey, JSON.stringify(result));

    return result;
  }

  private async generateHDsprite(request: AssetGenerationRequest): Promise<GeneratedAsset> {
    // Use SDXL-Turbo for fast generation
    const prompt = this.buildSpritePrompt(request);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'sdxl-turbo',
        input: {
          prompt: prompt,
          width: 128,
          height: 128,
          num_inference_steps: 4,
        }
      })
    });

    const data = await response.json();
    return {
      type: 'sprite',
      format: 'png',
      resolution: { width: 128, height: 128 },
      url: data.output[0],
      cost_usd: 0.002,
      generation_time_ms: data.metrics.predict_time
    };
  }

  private async generate3DModel(request: AssetGenerationRequest): Promise<GeneratedAsset> {
    // Use TripoSR for single-image 3D reconstruction
    const prompt = this.build3DPrompt(request);

    const response = await fetch('https://api.stability.ai/v2beta/3d', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.STABILITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        mode: 'image-to-3d',
        source_image: request.source_asset.data,
      })
    });

    const data = await response.json();
    return {
      type: 'model_3d',
      format: 'glb',
      url: data.output.asset,
      cost_usd: 0.01,
      generation_time_ms: data.metrics.generation_time
    };
  }

  private buildSpritePrompt(request: AssetGenerationRequest): string {
    const basePrompts = {
      'character_alice': 'pixel art character, female programmer, glasses, colorful hair, coding, friendly expression, isometric view',
      'character_jack': 'pixel art character, male backend developer, hoodie, focused expression, computer, isometric view',
      // ... more characters
    };

    let prompt = basePrompts[request.source_asset.id] || 'pixel art character';

    if (request.style) {
      prompt += `, ${request.style} style`;
    }

    prompt += ', game sprite, transparent background, high quality';

    return prompt;
  }
}
```

### I.2 Asset Quality Transformation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     Asset Generation Pipeline                    │
│                                                                  │
│  Input: 16x16 Voxel Sprite                                      │
│    │                                                             │
│    ▼                                                             │
│  ┌─────────────────┐                                            │
│  │ Quality Analysis │                                            │
│  │ - Detect edges  │                                            │
│  │ - Identify colors│                                           │
│  │ - Extract features│                                           │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐      ┌──────────────────┐                  │
│  │  GPU Tier Check │─────▶│ Select Pipeline   │                  │
│  │                 │      │                  │                  │
│  │ High: 3D route  │      │ Low: Skip upscale │                  │
│  │ Med: HD sprite  │      │ Med: 2x upscale   │                  │
│  └─────────────────┘      └────────┬─────────┘                  │
│                                      │                            │
│           ┌──────────────────────────┼──────────────────┐       │
│           │                          │                  │       │
│           ▼                          ▼                  ▼       │
│    ┌───────────┐            ┌───────────┐       ┌───────────┐  │
│    │ TripoSR   │            │ SDXL      │       │ ESRGAN    │  │
│    │ 3D Model  │            │ Sprite    │       │ 2x Upscale│  │
│    │ $0.01     │            │ $0.002    │       │ Free      │  │
│    └─────┬─────┘            └─────┬─────┘       └─────┬─────┘  │
│          │                       │                   │          │
│          └───────────────────────┴───────────────────┘          │
│                                     │                            │
│                                     ▼                            │
│                          ┌─────────────────┐                     │
│                          │ Cache Result    │                     │
│                          │ (R2 Storage)     │                     │
│                          └────────┬────────┘                     │
│                                   │                             │
│                                   ▼                             │
│                          ┌─────────────────┐                     │
│                          │ Return to Game   │                     │
│                          └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix J: SmartCRDT Integration Details

### J.1 CRDT Data Structures

```typescript
// backend/workers/smartcrdt-sync/src/crdt.ts

import * as Y from 'yjs';

export class MicroverseCRDTDoc {
  private doc: Y.Doc;
  private agents: Y.Map<Y.Map<any>>;
  private world: Y.Map<any>;

  constructor() {
    this.doc = new Y.Doc();
    this.agents = this.doc.getMap('agents');
    this.world = this.doc.getMap('world');
  }

  // Agent state as CRDT map for conflict-free sync
  updateAgentState(agentId: string, updates: Partial<AgentState>) {
    let agentMap = this.agents.get(agentId);

    if (!agentMap) {
      agentMap = new Y.Map();
      this.agents.set(agentId, agentMap);
    }

    // Apply updates with vector clock for causal ordering
    const vectorClock = this.getVectorClock(agentId);

    for (const [key, value] of Object.entries(updates)) {
      agentMap.set(key, {
        value,
        timestamp: Date.now(),
        vector_clock: vectorClock,
        client_id: this.getClientId()
      });
    }
  }

  // Memory as append-only CRDT array
  addMemory(agentId: string, memory: Memory) {
    let agentMap = this.agents.get(agentId);
    if (!agentMap) {
      agentMap = new Y.Map();
      this.agents.set(agentId, agentMap);
    }

    let memories = agentMap.get('memories');
    if (!memories) {
      memories = new Y.Array();
      agentMap.set('memories', memories);
    }

    memories.push([{
      ...memory,
      timestamp: Date.now(),
      client_id: this.getClientId()
    }]);
  }

  // Get state update for broadcasting
  getUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc);
  }

  // Apply remote update
  applyUpdate(update: Uint8Array) {
    Y.applyUpdate(this.doc, update);
  }

  // Get agent state for local use
  getAgentState(agentId: string): AgentState | null {
    const agentMap = this.agents.get(agentId);
    if (!agentMap) return null;

    const state: AgentState = {};
    agentMap.forEach((value, key) => {
      state[key] = value.value;
    });

    return state;
  }
}

// Vector clock implementation for causal ordering
interface VectorClock {
  [clientId: string]: number;
}

class VectorClockHelper {
  static compare(clock1: VectorClock, clock2: VectorClock): number {
    // Returns: 1 if clock1 > clock2, -1 if clock2 > clock1, 0 if concurrent
    let clock1Greater = false;
    let clock2Greater = false;

    const allClients = new Set([
      ...Object.keys(clock1),
      ...Object.keys(clock2)
    ]);

    for (const client of allClients) {
      const c1 = clock1[client] || 0;
      const c2 = clock2[client] || 0;

      if (c1 > c2) clock1Greater = true;
      if (c2 > c1) clock2Greater = true;
    }

    if (clock1Greater && !clock2Greater) return 1;
    if (clock2Greater && !clock1Greater) return -1;
    return 0;
  }
}
```

### J.2 WebSocket Sync Protocol

```typescript
// backend/workers/microverse-bridge/src/websocket-protocol.ts

export enum MessageType {
  WORLD_STATE = 'world_state',
  AGENT_UPDATE = 'agent_update',
  MEMORY_ADD = 'memory_add',
  DIALOG_START = 'dialog_start',
  DIALOG_MESSAGE = 'dialog_message',
  PRESENCE = 'presence',
  SYNC = 'sync'
}

export interface WSMessage {
  type: MessageType;
  payload: any;
  timestamp: number;
  client_id: string;
  vector_clock?: VectorClock;
}

export class MicroverseWebSocket {
  private ws: WebSocket;
  private crdtDoc: MicroverseCRDTDoc;
  private pendingUpdates: WSMessage[] = [];

  constructor(url: string, crdtDoc: MicroverseCRDTDoc) {
    this.crdtDoc = crdtDoc;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = (e) => this.handleMessage(e);
    this.ws.onclose = () => this.handleClose();
  }

  private handleOpen() {
    console.log('[MicroverseWS] Connected');

    // Send initial presence
    this.send({
      type: MessageType.PRESENCE,
      payload: {
        action: 'join',
        client_id: this.getClientId()
      },
      timestamp: Date.now(),
      client_id: this.getClientId()
    });

    // Start sync loop
    setInterval(() => this.sendSync(), 100);
  }

  private handleMessage(event: MessageEvent) {
    const data = event.data;

    // Handle binary CRDT updates
    if (data instanceof ArrayBuffer) {
      this.crdtDoc.applyUpdate(new Uint8Array(data));
      return;
    }

    // Handle JSON messages
    const message: WSMessage = JSON.parse(data);

    switch (message.type) {
      case MessageType.AGENT_UPDATE:
        this.handleAgentUpdate(message);
        break;
      case MessageType.DIALOG_MESSAGE:
        this.handleDialogMessage(message);
        break;
      case MessageType.PRESENCE:
        this.handlePresence(message);
        break;
    }
  }

  sendAgentUpdate(agentId: string, state: Partial<AgentState>) {
    this.send({
      type: MessageType.AGENT_UPDATE,
      payload: {
        agent_id: agentId,
        state
      },
      timestamp: Date.now(),
      client_id: this.getClientId(),
      vector_clock: this.getVectorClock()
    });
  }

  private sendSync() {
    if (this.pendingUpdates.length === 0) return;

    // Send binary CRDT update
    const update = this.crdtDoc.getUpdate();
    this.ws.send(update);

    this.pendingUpdates = [];
  }
}
```

---

## Appendix K: Performance Benchmarks

### K.1 Baseline Microverse Performance

| Metric | Value | Test Environment |
|--------|-------|-----------------|
| Startup Time | 2.3s | M1 MacBook Pro, 16GB RAM |
| Scene Load Time | 0.8s | Office.tscn (8 characters) |
| AI Decision Time | 1.2-4.5s | GPT-4o-mini, per agent |
| Memory Usage | 180MB | Idle, 8 agents |
| Memory Usage | 420MB | Active dialog |
| Frame Rate | 60 FPS | 1080p, 8 agents visible |
| Frame Rate | 45 FPS | 1080p, 20 agents visible |

### K.2 Expected SuperInstance Performance

| Metric | Target (Phase 1) | Target (Phase 4) |
|--------|-----------------|-----------------|
| Startup Time | 3.5s | 5.0s (with asset gen) |
| Scene Load Time | 1.2s | 2.0s (with LOD init) |
| AI Decision Time | 0.8-3.0s | 0.5-2.0s (with cascade) |
| Memory Usage | 250MB | 500MB (with 3D assets) |
| Frame Rate | 60 FPS | 60 FPS (with LOD) |
| Concurrent Players | 1 | 8 (with SmartCRDT) |

### K.3 Cost Projections

**Per-Hour Operating Costs** (8 active agents):

| Component | Cost (USD) | Notes |
|-----------|------------|-------|
| AI Inference (DeepSeek) | $0.02 | ~40 decisions/hour |
| Asset Generation | $0.05 | On-demand, cached |
| SmartCRDT Sync | $0.01 | Cloudflare Workers egress |
| NVIDIA ACE | $0.00 | Local/on-prem |
| R2 Storage | $0.001 | Asset cache |
| **Total** | **~$0.08/hour** | Per active user |

---

## Appendix L: Security Considerations

### L.1 API Key Management

```gdscript
# APIKeyManager.gd
extends Node

class_name APIKeyManager

# Never store API keys in client code
# All API calls route through backend

func get_backend_endpoint() -> String:
    # Production endpoint
    if OS.has_feature("release"):
        return "https://api.superinstance.ai"
    # Development endpoint
    return "http://localhost:8787"

func make_authenticated_request(endpoint: String, payload: Dictionary) -> Dictionary:
    var url = get_backend_endpoint() + endpoint

    # Get session token from backend
    var session_token = yield(_get_session_token(), "completed")

    var headers = [
        "Content-Type: application/json",
        "Authorization: Bearer " + session_token
    ]

    var http = HTTPRequest.new()
    add_child(http)

    http.request_completed.connect(func(result, code, headers, body):
        http.queue_free()
        # Handle response
    )

    http.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(payload))
```

### L.2 Content Moderation

```typescript
// backend/workers/microverse-backend/src/moderation.ts

export class ContentModerator {
  private blockedWords: Set<string>;
  private maxSeverity: number = 0.8;

  async moderateDialog(text: string): Promise<ModerationResult> {
    // Check against blocked words
    for (const word of this.blockedWords) {
      if (text.toLowerCase().includes(word)) {
        return { allowed: false, reason: 'blocked_content' };
      }
    }

    // AI-based content safety check
    const safetyCheck = await this.checkSafety(text);

    if (safetyCheck.severity > this.maxSeverity) {
      return {
        allowed: false,
        reason: 'safety_threshold_exceeded',
        severity: safetyCheck.severity
      };
    }

    return { allowed: true };
  }

  private async checkSafety(text: string): Promise<SafetyResult> {
    // Use lightweight model for content moderation
    const response = await fetch('https://api.moderation.com/check', {
      method: 'POST',
      body: JSON.stringify({ text }),
      headers: {
        'Authorization': `Bearer ${env.MODERATION_API_KEY}`
      }
    });

    return await response.json();
  }
}
```

---

*This document is living and will be updated as integration progresses.*
