# StudyLoG.AI - Theia IDE

Educational IDE built on Eclipse Theia with embedded Godot game engine.

## Quick Start

```bash
# Install dependencies
cd apps/theia-ide
yarn install

# Build all extensions
yarn build

# Start browser version
yarn start:browser

# Or start Electron version
yarn start:electron
```

## Extensions

| Extension | Purpose |
|-----------|---------|
| `si-godot-embed` | Embeds Godot game view in Theia panel |
| `si-a2ui-renderer` | Agent-to-UI component renderer |
| `si-agent-director` | Top-level agent orchestrator with chat |
| `si-cognitive-mill` | Industrial revolution learning module |
| `si-sitka-sound` | Fishing/game theory module |
| `si-intelligence-ranch` | Agent management module |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    StudyLoG.AI                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │   Editor    │ │ Godot View  │ │   Agent Chat    │   │
│  │  (Monaco)   │ │ (si-godot)  │ │  (si-director)  │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │   A2UI      │ │  Navigator  │ │    Terminal     │   │
│  │ (si-a2ui)   │ │             │ │                 │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                   Theia Core                            │
└─────────────────────────────────────────────────────────┘
```

## Development

### Building Extensions

```bash
# Build specific extension
cd extensions/si-godot-embed
yarn build

# Watch mode
yarn watch
```

### Adding New Modules

1. Copy `si-cognitive-mill` as template
2. Update `package.json` with new name
3. Define stages in `src/common/index.ts`
4. Create Godot scenes in `assets/`
5. Add to `browser-app/package.json` dependencies

## Godot Integration

The `si-godot-embed` extension communicates with Godot via:

1. **WebSocket** - Real-time game state synchronization
2. **IPC** - Scene loading and control commands
3. **Shared Memory** - Frame buffer for embedded view

### Godot Project Requirements

```
godot-project/
├── project.godot
├── modules/
│   ├── cognitive_mill/
│   │   └── stages/*.tscn
│   ├── sitka_sound/
│   │   └── stages/*.tscn
│   └── intelligence_ranch/
│       └── stages/*.tscn
└── addons/
    └── theia_bridge/    # WebSocket bridge
```

## A2UI Protocol

Agents communicate with the UI through JSON messages:

```typescript
{
  id: "msg-123",
  type: "component",
  agent: "teacher",
  priority: "normal",
  payload: {
    type: "component",
    component: {
      id: "hint-1",
      type: "hint",
      props: {
        level: "info",
        message: "Try adjusting the gear ratio"
      }
    }
  }
}
```

## Building for Distribution

```bash
# Package Electron app
yarn package:electron
```

Outputs:
- macOS: `electron-app/dist/StudyLoG.AI.dmg`
- Windows: `electron-app/dist/StudyLoG.AI Setup.exe`
- Linux: `electron-app/dist/StudyLoG.AI.AppImage`
