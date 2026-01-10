# Godot Physics Bridge

Connects Godot physics to CuPy/Numba for GPU acceleration in StudyLoG.AI.

## Overview

This module provides a bridge between Godot Engine's physics system and Python-based GPU acceleration:

- **Export**: Convert Godot scene data to GPU buffer format
- **Process**: Send data to CuPy/Numba for GPU computation
- **Import**: Convert results back to Godot scene format

## Architecture

```
Theia IDE (si-godot-panel)
    |
    v
Godot Engine 4.x
    | (export scene data)
    v
GodotPhysicsBridge (TypeScript)
    | (HTTP/WebSocket)
    v
Python Bridge (CuPy) / Numba Kernels
    | (GPU computation)
    v
NVIDIA RTX GPU
    |
    v (import results)
Godot Engine
```

## Usage

### Basic Usage

```typescript
import { GodotPhysicsBridge, createGodotScene } from './godot-physics';

// Create the bridge
const bridge = new GodotPhysicsBridge('http://localhost:8081');

// Check connection
const connected = await bridge.checkConnection();
if (!connected) {
  console.error('GPU bridges not available');
}

// Create a test scene
const scene = createGodotScene({
  nodes: [
    {
      name: 'particle1',
      type: 'rigid_body',
      position: [0, 0, 0],
      velocity: [1, 0, 0],
      mass: 1.0,
    },
    {
      name: 'particle2',
      type: 'rigid_body',
      position: [10, 0, 0],
      velocity: [-1, 0, 0],
      mass: 1.0,
    },
  ],
  frame: 0,
  deltaTime: 0.016,
});

// Process scene on GPU (one-step export, process, import)
const updatedScene = await bridge.processScene(scene, 'physics', {
  dt: 0.016,
  steps: 10,
  damping: 0.99,
});
```

### Advanced Usage

```typescript
// Export to GPU format with custom config
const gpuBuffer = await bridge.exportToGPU(scene, {
  includeStatic: false,
  visibleOnly: true,
  mode: 'physics-only',
  boundsFilter: {
    min: [-50, -50, -50],
    max: [50, 50, 50],
  },
});

// Process on GPU
const response = await bridge.processOnGPU({
  buffer: gpuBuffer,
  operation: 'flocking',
  parameters: {
    dt: 0.016,
    perceptionRadius: 5.0,
    steps: 1,
  },
});

// Import results back
const updatedScene = await bridge.importFromGPU(scene, response);
```

### WebSocket for Real-time Updates

```typescript
const { socket, close } = bridge.connectWebSocket((data) => {
  console.log('GPU update:', data);
});

// Send simulation request
socket.send(JSON.stringify({
  type: 'physics',
  particles: scene.nodes.map(n => ({
    position: n.transform.origin,
    velocity: n.velocity,
    mass: n.physics?.mass ?? 1,
  })),
  dt: 0.016,
}));

// Later: close connection
close();
```

## API

### GodotPhysicsBridge

#### Constructor
```typescript
constructor(
  cupyUrl: string = 'http://localhost:8081',
  numbaUrl: string = 'http://localhost:8082'
)
```

#### Methods

- `checkConnection(): Promise<boolean>` - Check if GPU bridges are available
- `exportToGPU(scene, config): Promise<GPUBuffer>` - Export scene to GPU format
- `processOnGPU(request): Promise<GPUProcessResponse>` - Process on GPU
- `importFromGPU(scene, response): Promise<GodotScene>` - Import results
- `processScene(scene, operation, parameters): Promise<GodotScene>` - One-step processing

### Operations

- `physics` - Particle physics simulation
- `flocking` - Boids flocking behavior
- `collision` - Collision detection
- `ecology` - Sitka Sound ecosystem simulation
- `diffusion` - Diffusion/reaction-diffusion

## GPU Buffer Format

Scene data is packed into Float32Array for efficient transfer:

**Node Data (N x 13):**
- [0-2]: Position (x, y, z)
- [3-5]: Velocity (vx, vy, vz)
- [6-9]: Rotation quaternion (rx, ry, rz, rw)
- [10-12]: Scale (sx, sy, sz)

**Node Properties (N x 8):**
- [0]: Mass
- [1]: Friction
- [2]: Bounce
- [3]: Damping
- [4]: Gravity scale
- [5-7]: Reserved

## Integration with StudyLoG.AI

### Cognitive Mill
- Visualize AI attention heatmaps using GPU-accelerated rendering
- Simulate neural network activations

### Intelligence Ranch
- Accelerate agent breeding simulations
- Real-time flocking behavior visualization

### Sitka Sound
- Multi-agent ecosystem simulation
- Predation detection on GPU

## Dependencies

- CuPy bridge running on port 8081
- Numba bridge running on port 8082
- TypeScript 5.0+

## See Also

- [CuPy Bridge](../stem/cupy/README.md)
- [Numba Kernels](../stem/numba/README.md)
- [RTX Local Inference](../rtx-local/)
