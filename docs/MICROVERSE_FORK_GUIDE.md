# SuperInstance.AI - Microverse Fork Guide

## Overview

This guide documents the fork of the Microverse project for integration into the SuperInstance.AI ecosystem. Microverse provides the foundation for our AI-driven simulation environments across StudyLoG.AI, DMLoG.AI, and future products.

### What is Microverse?

Microverse is an open-source AI character simulation system built on Godot 4.x. It provides:
- AI-driven character behavior with conversation systems
- Memory systems for persistent character knowledge
- Navigation and pathfinding for 2D environments
- Multi-character scene management
- Save/load functionality

### SuperInstance Integration

We extend Microverse with:
- **6-Tier Hierarchical Memory System** - Working, Episodic, Semantic, Procedural, Reflection, Identity
- **TheiaBridge WebSocket Integration** - Real-time communication with Theia IDE
- **Multi-Model AI Router** - Support for OpenAI, Anthropic, Zhipu, DeepSeek, Cloudflare, and Local models
- **Quality/LOD System** - Dynamic quality scaling based on hardware capabilities
- **Generative Asset Streaming** - Runtime asset loading from remote sources
- **SmartCRDT Collaboration** - Real-time collaborative editing
- **ACE Agent Enhancement** - NVIDIA ACE integration for digital avatars

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SuperInstance.AI Backend                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Multi-Model Router  │  Memory System  │  Outcome Tracker  │  Training  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌──────────────────┐ ┌─────────────┐ ┌─────────────────┐
        │   Theia IDE      │ │   Godot     │ │  Backend API    │
        │   (Editor)       │ │  Microverse │ │  (Cloudflare)   │
        └──────────────────┘ └─────────────┘ └─────────────────┘
                │                   │                   │
                └───────────────────┼───────────────────┘
                                    ▼
                    ┌───────────────────────────────────────┐
                    │      SuperInstance Bridge Layer        │
                    │  ┌─────────┐ ┌─────────┐ ┌─────────┐  │
                    │  │  Memory │ │ Assets  │ │ Agents  │  │
                    │  │ Adapter │ │Streamer │ │Enhancer │  │
                    │  └─────────┘ └─────────┘ └─────────┘  │
                    └───────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌─────────────────┐ ┌───────────────┐ ┌──────────────┐
        │ Microverse Core │ │ SI Modules    │ │ Patches      │
        │ (Unmodified)    │ │ (Extensions)  │ │ (Modifications)│
        └─────────────────┘ └───────────────┘ └──────────────┘
```

### Directory Structure

```
godot-microverse/
├── README.md                    # This file
├── project.godot                # Godot project configuration
├── project.godot.si             # SuperInstance overlay config
├── patches/                     # Patches to apply to Microverse
│   ├── ai_agent_enhancements.patch
│   ├── generative_assets.patch
│   ├── quality_scaling.patch
│   └── theia_bridge.patch
├── scripts/                     # Build and setup scripts
│   ├── fork.sh                  # Initial fork setup
│   ├── apply_patches.sh         # Apply all patches
│   ├── build.sh                 # Build for SuperInstance
│   ├── install_modules.sh       # Install SI modules
│   └── sync_backend.sh          # Sync with backend
├── bridge/                      # SuperInstance bridge layer
│   ├── si_bridge.gd             # Main bridge singleton
│   ├── memory_adapter.gd        # 6-tier memory adapter
│   ├── asset_streamer.gd        # Runtime asset loading
│   ├── quality_lod.gd           # Quality scaling
│   ├── agent_enhancer.gd        # ACE integration
│   └── collaboration_sync.gd    # SmartCRDT sync
├── modules/                     # SuperInstance modules
│   ├── si_memory/               # Memory system module
│   │   ├── memory_tier.gd       # Base memory tier class
│   │   ├── working_memory.gd    # Working memory tier
│   │   ├── episodic_memory.gd   # Episodic memory tier
│   │   ├── semantic_memory.gd   # Semantic memory tier
│   │   ├── procedural_memory.gd # Procedural memory tier
│   │   ├── reflection_memory.gd # Reflection memory tier
│   │   ├── identity_memory.gd   # Identity memory tier
│   │   └── memory_router.gd     # Routing between tiers
│   ├── si_assets/               # Asset streaming module
│   │   ├── asset_registry.gd    # Asset registry
│   │   ├── asset_loader.gd      # Async asset loading
│   │   ├── asset_cache.gd       # Local asset caching
│   │   └── asset_quality.gd     # Quality variants
│   ├── si_agents/               # Enhanced AI agents module
│   │   ├── biological_agent.gd  # Base biological agent
│   │   ├── zooplankton_agent.gd # Token-level agent
│   │   ├── herring_agent.gd     # Vector swarm agent
│   │   ├── deckhand_agent.gd    # SLM + LoRA agent
│   │   ├── captain_agent.gd     # Director agent
│   │   └── whale_agent.gd       # Orchestrator agent
│   └── si_quality/              # Quality scaling module
│       ├── quality_detector.gd  # Hardware detection
│       ├── quality_manager.gd   # Quality settings
│       ├── lod_manager.gd       # LOD management
│       └── performance_monitor.gd # Performance tracking
├── upstream/                    # Original Microverse (git submodule)
│   └── (microverse source)
└── scenes/                      # SuperInstance-specific scenes
    ├── SI_TheiaPanel.tscn       # Theia panel embedding
    ├── SI_AgentDashboard.tscn   # Agent orchestration UI
    └── SI_MemoryVisualizer.tscn # Memory visualization
```

---

## Installation

### Prerequisites

- Godot 4.4+ (download from https://godotengine.org/download)
- Node.js 20+ (for backend integration)
- Git
- (Optional) NVIDIA GPU with RTX for local AI acceleration

### Initial Fork Setup

```bash
# Navigate to the godot-microverse directory
cd /mnt/c/cognitivemill/godot-microverse

# Run the fork script
./scripts/fork.sh
```

The `fork.sh` script will:
1. Clone the Microverse repository as a submodule
2. Copy necessary files to the working directory
3. Apply SuperInstance patches
4. Install bridge layer modules
5. Configure project settings

### Manual Setup (Alternative)

```bash
# Add Microverse as a git submodule
git submodule add https://github.com/MicroverseEngine/Microverse.git upstream

# Copy upstream files to working directory (except what we override)
cp -r upstream/* .

# Apply patches
./scripts/apply_patches.sh

# Install SI modules
./scripts/install_modules.sh
```

---

## Bridge Layer

### si_bridge.gd - Main Bridge Singleton

The main bridge singleton is the entry point for all SuperInstance integrations. It's autoloaded in the Godot project.

```gdscript
# autoload configuration in project.godot:
# SIBridge="*res://bridge/si_bridge.gd"

# Available globally via:
# SIBridge.memory_api
# SIBridge.backend_url
# SIBridge.theia_websocket
# etc.
```

Key functionality:
- **Backend Communication** - WebSocket connection to Theia IDE
- **Memory System Access** - Interface to 6-tier memory
- **Quality Management** - Hardware detection and scaling
- **Agent Coordination** - Multi-agent orchestration
- **Event Broadcasting** - Godot signal-based event system

### Memory Adapter (memory_adapter.gd)

Connects Microverse's simple memory system to SuperInstance's 6-tier hierarchy:

```gdscript
# Usage in character scripts:
var memory_adapter = SIBridge.memory_adapter

# Store in working memory
memory_adapter.store_working(character_id, "current_goal", "Find the blue key")

# Consolidate to episodic
memory_adapter.consolidate_episodic(character_id, {
    "event": "Completed puzzle room 3",
    "emotions": ["satisfied", "curious"],
    "entities": ["blue_key", "door_3"]
})

# Query semantic memory
var related_knowledge = memory_adapter.query_semantic(character_id, "keys", "doors")
```

### Asset Streamer (asset_streamer.gd)

Runtime asset loading from various sources:

```gdscript
# Load from local
asset_streamer.load_asset("res://models/character.gltf")

# Load from backend CDN
asset_streamer.load_remote_asset("https://cdn.superinstance.ai/assets/props/lantern.gltf")

# Load with quality variants
asset_streamer.load_asset_with_quality("character", AssetQuality.HIGH)
```

### Quality/LOD (quality_lod.gd)

Dynamic quality scaling based on hardware:

```gdscript
# Auto-detect quality level
var quality_level = quality_lod.detect_quality()
# Returns: QualityLevel.LOW, MEDIUM, HIGH, or ULTRA

# Apply quality settings
quality_lod.apply_quality_settings(quality_level)

# Monitor performance
quality_lod.start_monitoring()
# Automatically adjusts quality if FPS drops
```

### Agent Enhancer (agent_enhancer.gd)

NVIDIA ACE integration for digital avatars:

```gdscript
# Initialize ACE for a character
agent_enhancer.init_ace(character, {
    "model_path": "res://models/ace/ultron_v2.omniverse",
    "audio2face_enabled": true,
    "eye_tracking_enabled": true
})

# Drive animation from audio
agent_enhancer.process_audio(character, audio_stream)
```

### Collaboration Sync (collaboration_sync.gd)

SmartCRDT-based real-time collaboration:

```gdscript
# Enable collaborative editing
collaboration_sync.enable_collaboration(scene, "session_id")

# Broadcast changes
collaboration_sync.broadcast_change(property_path, new_value)

# Receive remote changes
collaboration_sync.remote_change_received.connect(_on_remote_change)
```

---

## Module System

### si_memory Module

The memory module implements the 6-tier hierarchy:

| Tier | Purpose | Capacity | Duration |
|------|---------|----------|----------|
| **Working** | Current task context | ~7 items | Seconds |
| **Episodic** | Personal experiences | Unlimited | Persistent |
| **Semantic** | General knowledge | Unlimited | Persistent |
| **Procedural** | Skills and habits | Unlimited | Persistent |
| **Reflection** | Meta-cognition | Unlimited | Persistent |
| **Identity** | Core self-concept | Fixed | Persistent |

```gdscript
# Access the memory system
var memory_sys = SIBridge.memory_system

# Store at different tiers
memory_sys.working.store("current_target", enemy_position)
memory_sys.episodic.record("defeated_boss", {"boss": "Malenia", "attempts": 47})
memory_sys.semantic.learn("sword_weak_to_fire", confidence = 0.95)

# Memory consolidation (automatic)
memory_sys.consolidate()  # Working -> Episodic -> Semantic
```

### si_assets Module

Asset streaming with quality variants:

```gdscript
# Register asset variants
asset_registry.register("enemy_goblin", {
    AssetQuality.LOW: "res://assets/goblin_low.gltf",
    AssetQuality.MEDIUM: "res://assets/goblin_med.gltf",
    AssetQuality.HIGH: "https://cdn.si/goblin_high.gltf"
})

# Load appropriate variant
var asset = asset_loader.load("enemy_goblin")
```

### si_agents Module

Biological agent hierarchy:

| Agent Type | Description | Use Case |
|------------|-------------|----------|
| **Zooplankton** | Token-level processing | LLM token flow |
| **Herring** | Vector swarm simulation | Boids, crowd movement |
| **Deckhand** | SLM + LoRA | Quick NPC responses |
| **Captain** | Director agent | Party leader, tutorial guide |
| **Whale** | Orchestrator | Multi-agent coordination |
| **Fleet** | A2A network | Faction systems |

```gdscript
# Create a biological agent
var captain = CaptainAgent.new()
captain.personality = {
    "traits": ["brave", "strategic", "protective"],
    "values": ["honor", "loyalty"],
    "quirks": ["quotes_classic_literature"]
}

# Add to character
character.add_agent(captain)
```

### si_quality Module

Hardware detection and quality scaling:

```gdscript
# Detect hardware
var gpu_info = quality_detector.detect_gpu()
# Returns: {"vendor": "NVIDIA", "model": "RTX 3080", "vram_gb": 10}

var recommended_quality = quality_detector.get_recommended_quality()
# Returns: QualityLevel.HIGH

# Apply quality preset
quality_manager.apply_preset(QualityPreset.HIGH)
```

---

## Patch System

Patches modify the original Microverse code without forking. This allows us to track our changes and potentially upstream them.

### Creating a Patch

```bash
# After making changes to upstream/ files
cd upstream
git diff origin/main > ../patches/my_changes.patch
```

### Applying Patches

```bash
# Apply all patches
./scripts/apply_patches.sh

# Apply individual patch
patch -p1 < patches/ai_agent_enhancements.patch
```

### Included Patches

#### ai_agent_enhancements.patch

Enhances the AI agent with:
- 6-tier memory integration hooks
- Multi-model routing support
- Biological agent personality injection
- Temporal consciousness tracking

#### generative_assets.patch

Adds runtime asset generation:
- Procedural texture generation
- AI model-based asset creation
- Remote asset streaming
- Asset quality variants

#### quality_scaling.patch

Implements dynamic quality scaling:
- GPU detection and classification
- LOD based on hardware capability
- Performance monitoring
- Automatic quality adjustment

#### theia_bridge.patch

Theia IDE integration:
- WebSocket communication
- Scene synchronization
- Debug overlay in IDE
- Hot reload support

---

## Build System

### Building for SuperInstance

```bash
# Build all targets
./scripts/build.sh --all

# Build specific target
./scripts/build.sh --target windows --release

# Export with specific quality preset
./scripts/build.sh --quality high
```

### Build Targets

| Platform | Export Template | Status |
|----------|----------------|--------|
| Windows | Windows Desktop | Supported |
| Linux | X11/Linux | Supported |
| macOS | macOS (Intel + Apple Silicon) | Supported |
| Web | WebAssembly | Experimental |
| Android | Android | Planned |

### Export Presets

Export presets are configured in `project.godot`:

```ini
[preset.0]
name="SuperInstance Windows"
platform="Windows Desktop"
runnable=true
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="../build/SuperInstance-Windows.exe"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
```

---

## Theia IDE Integration

### TheiaBridge Protocol

The TheiaBridge enables real-time communication between Godot and Theia IDE:

```gdscript
# Connect to Theia
SIBridge.theia.connect_to_ide("ws://localhost:9000")

# Send scene state
SIBridge.theia.broadcast_scene_state(scene_root)

# Receive IDE commands
SIBridge.theia.command_received.connect(_on_ide_command)
```

### WebSocket Message Format

```typescript
// From Theia to Godot
interface TheiaMessage {
  type: 'command' | 'query' | 'update';
  payload: {
    command?: string;
    query?: string;
    data?: any;
  };
}

// From Godot to Theia
interface GodotMessage {
  type: 'event' | 'response' | 'state';
  payload: {
    event?: string;
    response?: any;
    state?: SceneState;
  };
}

interface SceneState {
  nodes: NodeState[];
  active_camera: string;
  selection: string[];
  metadata: Record<string, any>;
}
```

### Theia Extension

The `si-godot-embed` extension in Theia provides:
- Live 3D scene preview
- Property inspector for Godot nodes
- Console output streaming
- Breakpoint debugging
- Hot scene reload

---

## Memory System Integration

### 6-Tier Memory Architecture

The SuperInstance memory system integrates with Microverse through the memory adapter:

```
┌─────────────────────────────────────────────────────────────┐
│                    Identity Memory                          │
│  "Who am I?" - Core self-concept, personality, values      │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Consolidation
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Reflection Memory                         │
│  "Why did I do that?" - Meta-cognition, learning patterns   │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Generalization
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Procedural Memory                         │
│  "How do I do this?" - Skills, habits, conditioned responses│
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Abstraction
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Semantic Memory                           │
│  "What do I know?" - Facts, concepts, general knowledge     │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Pattern Extraction
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Episodic Memory                           │
│  "What happened?" - Personal experiences, events, contexts  │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │ Encoding
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Working Memory                            │
│  "What am I doing?" - Current task context, active focus    │
└─────────────────────────────────────────────────────────────┘
```

### Memory API

```gdscript
class_name SIMemoryAPI
extends Node

# Working Memory (seconds)
func set_focus(character_id: String, focus_item: String, focus_data: Dictionary)
func get_focus(character_id: String) -> Dictionary
func clear_focus(character_id: String)

# Episodic Memory (events)
func record_event(character_id: String, event: Dictionary)
func recall_events(character_id: String, filters: Dictionary) -> Array
func get_recent_events(character_id: String, hours: int) -> Array

# Semantic Memory (knowledge)
func learn_fact(character_id: String, fact: String, confidence: float = 1.0)
func query_facts(character_id: String, query: String) -> Array
func relate_concepts(character_id: String, concept_a: String, concept_b: String, strength: float)

# Procedural Memory (skills)
func learn_skill(character_id: String, skill_name: String, proficiency: float = 0.0)
func get_skill_level(character_id: String, skill_name: String) -> float
func practice_skill(character_id: String, skill_name: String, amount: float)

# Reflection Memory (meta-cognition)
func record_reflection(character_id: String, reflection: String)
func get_learning_patterns(character_id: String) -> Dictionary

# Identity Memory (self)
func set_identity_trait(character_id: String, trait: String, value: Variant)
func get_identity(character_id: String) -> Dictionary
func evolve_identity(character_id: String, experience: Dictionary)

# Cross-tier operations
func consolidate(character_id: String)
func search_all_tiers(character_id: String, query: String) -> Array
func get_memory_summary(character_id: String) -> Dictionary
```

---

## AI Agent Enhancement

### Biological Agents

SuperInstance extends Microverse's AI agents with biological behaviors:

```gdscript
# Zooplankton - Token-level processing
class_name ZooplanktonAgent
extends AIAgent

func process_token(token: Dictionary) -> Dictionary:
    # Individual token processing
    # Used for LLM token flow visualization
    pass

# Herring - Vector swarm
class_name HerringAgent
extends AIAgent

func flock(center: Vector3, separation: float = 1.0, alignment: float = 1.0, cohesion: float = 1.0):
    # Boids algorithm implementation
    pass

# Deckhand - Fast NPC
class_name DeckhandAgent
extends AIAgent

var base_model: String = "lora-quick-response"
var lora_adapters: Dictionary = {}

func quick_response(context: String) -> String:
    # Fast SLM inference
    pass

# Captain - Director
class_name CaptainAgent
extends AIAgent

func coordinate_party(party_members: Array) -> Dictionary:
    # Multi-agent coordination
    pass

# Whale - Orchestrator
class_name WhaleAgent
extends AIAgent

func orchestrate_scene(scene: Node, goals: Dictionary) -> void:
    # High-level scene orchestration
    pass
```

### Multi-Model Routing

```gdscript
# Route to appropriate AI provider
var router = SIBridge.model_router

# Configure routing
router.set_fallback_chain([
    "deepseek:v3",      # Primary: Fast, capable
    "zhipu:glm-4.7",    # Fallback 1: Cheap
    "cloudflare:llama", # Fallback 2: Free
    "openai:gpt-4"      # Emergency: Premium
])

# Make a request
var response = await router.complete(prompt, {
    "max_tokens": 1000,
    "temperature": 0.7,
    "quality_preference": "balanced"  # fast/balanced/premium
})
```

---

## Quality Scaling System

### Hardware Detection

```gdscript
class_name QualityDetector
extends Node

func detect_hardware() -> HardwareInfo:
    var info = HardwareInfo.new()
    info.os = OS.get_name()
    info.processor_name = OS.get_processor_name()
    info.processor_count = OS.get_processor_count()
    info.video_adapter = OS.get_video_adapter_name()
    info.video_adapter_vendor = OS.get_video_adapter_vendor()
    info.memory_mb = OS.get_static_memory_usage_by_type()

    # Detect NVIDIA features
    if info.video_adapter_vendor.contains("NVIDIA"):
        info.has_cuda = _check_cuda_available()
        info.has_dlss = _check_dlss_available()
        info.rtx_capable = info.video_adapter.contains("RTX")

    return info
```

### Quality Levels

| Level | Target Hardware | Features |
|-------|----------------|----------|
| **LOW** | Integrated GPU, <4GB VRAM | Minimal shaders, low-res textures, simple physics |
| **MEDIUM** | Discrete GPU, 4-6GB VRAM | Basic shaders, medium-res textures, standard physics |
| **HIGH** | GTX/RTX, 6-8GB VRAM | Full shaders, high-res textures, enhanced physics |
| **ULTRA** | RTX 3080+, 10GB+ VRAM | Ray tracing, maximum quality, DLSS, advanced features |

### Dynamic Adjustment

```gdscript
# Enable automatic quality adjustment
quality_lod.auto_adjust = true
quality_lod.target_fps = 60
quality_lod.min_fps = 50

# Monitor callback
quality_lod.quality_changed.connect(func(new_quality):
    print("Quality adjusted to: ", new_quality)
    _update_materials_for_quality(new_quality)
)
```

---

## Generative Assets

### Runtime Asset Loading

```gdscript
# Load asset from CDN
asset_streamer.load_remote_asset(
    "https://cdn.superinstance.ai/assets/characters/tutor/low_poly.gltf",
    func(asset: Node):
        add_child(asset)
        asset.position = Vector3(0, 0, 0)
)

# Load with quality selection
asset_streamer.load_with_quality_variant(
    "character_npc",
    SIBridge.quality_manager.current_quality,
    func(asset: Node): _on_asset_loaded(asset)
)
```

### Procedural Generation

```gdscript
# Generate texture procedurally
var gen = ProceduralGenerator.new()
var texture = gen.generate_texture({
    "type": "noise",
    "seed": 12345,
    "size": Vector2i(512, 512),
    "parameters": {"scale": 0.1, "octaves": 4}
})

# Generate 3D mesh
var mesh = gen.generate_mesh({
    "type": "terrain",
    "size": Vector2i(64, 64),
    "height_scale": 10.0,
    "noise_params": {...}
})
```

---

## SmartCRDT Collaboration

### Real-time Sync

```gdscript
# Enable collaboration on a scene
collab_sync.enable_collaboration(
    scene,
    "studylog_session_abc123",
    "user_token_xyz"
)

# Broadcast changes
collab_sync.send_operation({
    "type": "update_property",
    "node": "/root/World/Player",
    "property": "position",
    "value": Vector3(10, 0, 5),
    "timestamp": Time.get_unix_time_from_system()
})

# Receive changes
collab_sync.operation_received.connect(func(op):
    _apply_remote_operation(op)
)
```

### Conflict Resolution

```gdscript
# Custom conflict resolution
collab_sync.set_conflict_resolver(func(op1, op2):
    # Last-write-wins with operational transformation
    if op1.timestamp > op2.timestamp:
        return op1
    return op2
)
```

---

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# Backend Configuration
SUPERINSTANCE_BACKEND_URL=https://api.superinstance.ai
SUPERINSTANCE_WS_URL=wss://api.superinstance.ai/ws
SUPERINSTANCE_API_KEY=your_api_key_here

# Theia Integration
THEIA_WS_URL=ws://localhost:9000
THEIA_EXTENSION_ID=si-godot-embed

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ZHIPU_API_KEY=...
DEEPSEEK_API_KEY=...

# Feature Flags
ENABLE_ACE=false
ENABLE_CRDT_SYNC=true
ENABLE_QUALITY_SCALING=true
DEBUG_MODE=false
```

### Project Configuration

Edit `project.godot.si` for SuperInstance-specific overrides:

```ini
[application]

config/name="SuperInstance.AI - Microverse"
config/version="1.0.0"
config/description="SuperInstance fork of Microverse with 6-tier memory, Theia integration, and biological agents"

[autoload]

# SuperInstance singletons
SIBridge="*res://bridge/si_bridge.gd"
SIMemorySystem="*res://modules/si_memory/memory_router.gd"
SIAssetStreamer="*res://modules/si_assets/asset_loader.gd"
SIQualityManager="*res://modules/si_quality/quality_manager.gd"

[display]

window/size/viewport_width=1920
window/size/viewport_height=1080
window/size/mode=windowed
window/stretch/mode="viewport"
window/stretch/aspect="keep"

[rendering]

# Quality defaults (adjusted by runtime detection)
rendering/quality/filters/msaa=2
rendering/quality/forward_hdr/enabled=true
rendering/quality/temporal_dither/enabled=true
```

---

## Testing

### Unit Tests

```bash
# Run all tests
godot --headless --script tests/run_tests.gd

# Run specific test suite
godot --headless --script tests/test_memory.gd
```

### Integration Tests

```bash
# Test backend connection
godot --headless --script tests/integration/test_backend.gd

# Test Theia bridge
godot --headless --script tests/integration/test_theia_bridge.gd
```

### Performance Tests

```bash
# Profile memory system
godot --headless --script tests/performance/test_memory_consolidation.gd

# Profile quality scaling
godot --headless --script tests/performance/test_quality_adjustment.gd
```

---

## Troubleshooting

### Common Issues

#### Issue: WebSocket connection to Theia fails

```
Solution:
1. Check that Theia IDE is running
2. Verify THEIA_WS_URL in .env
3. Check firewall settings
4. Enable debug mode: set DEBUG_MODE=true in .env
```

#### Issue: Memory consolidation causes lag

```
Solution:
1. Reduce consolidation frequency in memory_router.gd
2. Enable async consolidation: set async_consolidation = true
3. Reduce working memory capacity
4. Profile specific tiers causing slowdown
```

#### Issue: Quality stuck on LOW

```
Solution:
1. Manually override: SIBridge.quality_manager.force_quality(QualityLevel.HIGH)
2. Check GPU detection logs
3. Verify video adapter detection
4. Update graphics drivers
```

#### Issue: Assets fail to load from CDN

```
Solution:
1. Check network connectivity
2. Verify CDN URL configuration
3. Check asset_cache.gd for errors
4. Enable local fallback: enable_local_fallback = true
```

### Debug Mode

Enable debug mode in `.env`:

```bash
DEBUG_MODE=true
DEBUG_MEMORY=true
DEBUG_ASSETS=true
DEBUG_QUALITY=true
DEBUG_BRIDGE=true
```

This will enable extensive logging to the Godot console.

---

## Contributing

### Adding a New Module

1. Create module directory in `modules/your_module/`
2. Create `module.gd` with autoload registration
3. Add to `project.godot.si` autoload section
4. Update this documentation
5. Submit PR

### Submitting Patches

1. Make changes in a branch
2. Test thoroughly
3. Generate patch: `git diff origin/main > patches/your_change.patch`
4. Update this document
5. Submit PR

### Code Style

- Follow GDScript style guide
- Use `class_name` for exported classes
- Document public functions with comments
- Add type hints for all parameters
- Use `snake_case` for variables and functions
- Use `PascalCase` for classes and enums

---

## License

This fork maintains compatibility with the original Microverse license (see `upstream/LICENSE`). SuperInstance additions are licensed under the SuperInstance.AI license.

---

## References

- Original Microverse: https://github.com/MicroverseEngine/Microverse
- SuperInstance Backend: `/mnt/c/cognitivemill/backend/`
- Theia IDE Extensions: `/mnt/c/cognitivemill/apps/theia-ide/extensions/`
- Memory System: `/mnt/c/cognitivemill/backend/lib/memory-system/`
- NVIDIA ACE: https://developer.nvidia.com/ace
- Godot Documentation: https://docs.godotengine.org/

---

## Changelog

### Version 1.0.0 (2025-01-10)

Initial SuperInstance fork:

- 6-tier memory system integration
- TheiaBridge WebSocket communication
- Multi-model AI router support
- Quality scaling and LOD system
- Generative asset streaming
- SmartCRDT collaboration sync
- Biological agent hierarchy
- Build scripts and patch system
