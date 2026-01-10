# Godot Integration Worker

Communication bridge between Theia IDE and embedded Godot engine for StudyLoG.AI.

## Overview

This worker provides:
- WebSocket-based communication between Theia and Godot
- Custom plugin system with hot-reload support
- GDScript pattern library (state machine, event bus, save/load, tutorials)
- Custom nodes for AI visualization and gamification
- Shader library for visual effects
- Educational content framework with lessons, exercises, and achievements

## Installation

```bash
npm install @studylog/godot-integration
```

## Project Structure

```
godot-integration/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── plugins/         # Plugin system (BasePlugin, PluginLoader)
│   ├── theia-bridge/    # Enhanced Theia-Godot bridge client
│   ├── content/         # Educational content framework
│   ├── patterns/        # GDScript patterns
│   ├── nodes/           # Custom Godot nodes
│   └── shaders/         # GLSL shaders
├── project_template/    # Template Godot project
│   ├── TheiaBridge.gd   # GDScript bridge server
│   └── project.godot    # Godot project config
└── scripts/             # Setup scripts
```

## Quick Start

### TypeScript (Theia Extension)

```typescript
import { createBridge, LessonManager } from '@studylog/godot-integration';

// Connect to Godot
const bridge = await createBridge({ port: 9876 });

// Send commands
await bridge.spawnAgent('boid', { x: 0, y: 0, z: 0 });

// Subscribe to events
bridge.on('agent_spawned', (data) => {
  console.log('Agent spawned:', data);
});

// Educational content
const lessons = new LessonManager();
const result = await lessons.submitExercise(
  'user_123',
  'cm_basics_01',
  'cm_basics_01_q1',
  'brain'
);
```

### GDScript (Godot)

```gdscript
# Use patterns
extends StateMachine

func _ready():
    add_state("idle")
    add_state("active")
    set_initial_state("idle")

# Use custom nodes
var attention = AIAttentionNode.new()
attention.set_attention_matrix_2d(matrix)
add_child(attention)

# Use progress tracking
var progress = ProgressNode.new()
progress.set_total_stages(4)
progress.add_xp(100)
```

## API Reference

### TheiaBridgeClient

| Method | Description |
|--------|-------------|
| `connect()` | Connect to Godot bridge server |
| `send(message)` | Send a message to Godot |
| `rpc(method, ...params)` | Call a remote procedure |
| `on(event, callback)` | Subscribe to events |
| `spawnAgent(type, position)` | Spawn an agent |
| `loadScene(path)` | Load a scene |

### Plugin System

```typescript
import { BasePlugin, PluginMetadata } from '@studylog/godot-integration/plugins';

@PluginMetadata({
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'A custom plugin',
})
class MyPlugin extends BasePlugin {
  activate(context) {
    this.logger.info('Plugin activated');
  }
}
```

### Custom Nodes

| Node | Description |
|------|-------------|
| `AIAttentionNode` | Visualizes neural attention patterns |
| `ProgressNode` | Tracks and displays learning progress |
| `TutorialTriggerNode` | Activates tutorials based on conditions |
| `GamificationTriggerNode` | Unlocks achievements and rewards |

### Shaders

| Shader | Description |
|--------|-------------|
| `attention_token.gdshader` | Glowing token visualization |
| `attention_line.gdshader` | Flowing attention connections |
| `progress_ring.gdshader` | Circular progress indicator |
| `token_flow.gdshader` | Token flow animation |
| `achievement_unlock.gdshader` | Achievement burst effect |
| `neural_network_viz.gdshader` | Neural network visualization |

## Integration with StudyLoG.AI Stages

### Cognitive Mill
- Visualizes AI model internals
- Shows token flow, attention maps, activations
- Uses `AIAttentionNode` and shader effects

### Intelligence Ranch
- Displays agent breeding/training
- Real-time agent behavior visualization
- Uses state machine patterns and event bus

### Sitka Sound
- Multi-agent ecosystem simulation
- Game theory visualization
- Uses agent management and progress tracking

## Configuration

```typescript
const config = {
  bridge: {
    port: 9876,
    host: '127.0.0.1',
    autoReconnect: true,
    reconnectInterval: 1000,
    maxReconnectAttempts: 30,
    rpcTimeout: 5000,
    debugLog: false,
  },
  plugins: {
    directory: './plugins',
    hotReload: true,
    autoLoad: [],
  },
  content: {
    directory: './content',
    locale: 'en',
  },
};
```

## Development

```bash
# Build TypeScript
npm run build

# Watch mode
npm run build:watch

# Type check
npm run typecheck

# Run tests
npm test

# Setup Godot project
cd project_template
./../scripts/setup.sh
```

## Dependencies

- Godot Engine 4.4+
- Node.js 20+
- TypeScript 5.7+
- WebSocket support

## License

MIT

## See Also

- [../../GODOT_INTEGRATION.md](../../docs/GODOT_INTEGRATION.md) - Full plugin research
- [../../CLAUDE.md](../../CLAUDE.md) - Project overview
