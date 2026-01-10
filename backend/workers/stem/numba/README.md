# Numba CUDA Kernels

JIT-compiled CUDA kernels for high-performance STEM computations in StudyLoG.AI.

## Overview

This module provides CUDA kernels compiled with Numba for GPU acceleration:

1. **Physics Kernels**: Particle simulation, N-body gravity, collision detection
2. **Agent Kernels**: Boid flocking with separation/alignment/cohesion
3. **Math Kernels**: Parallel reduction, cellular automata
4. **Ecology Kernels**: Predation detection for Sitka Sound

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Install Numba CUDA (choose based on your CUDA version)
pip install numba-cuda11x  # For CUDA 11.x
# or
pip install numba-cuda12x  # For CUDA 12.x
```

## Usage

### Python API

```python
from stem.numba import NumbaAccelerator
import numpy as np

accelerator = NumbaAccelerator()

# Check if GPU is available
if accelerator.available:
    # Run particle simulation
    particles = np.random.rand(1000, 7).astype(np.float32)  # [x, y, z, vx, vy, vz, mass]
    forces = np.zeros((1000, 3), dtype=np.float32)

    result = accelerator.simulate_particles(
        particles=particles,
        forces=forces,
        dt=0.016,
        steps=10
    )

    if result.success:
        print(f"Simulation completed in {result.execution_time_ms:.2f} ms")
        updated_particles = result.data
```

### Available Operations

**Particle Simulation:**
```python
result = accelerator.simulate_particles(particles, forces, dt=0.016, damping=0.99)
```

**Boids Flocking:**
```python
result = accelerator.simulate_boids(
    positions=positions,
    velocities=velocities,
    perception_radius=5.0,
    separation_weight=1.5,
    alignment_weight=1.0,
    cohesion_weight=1.0
)
```

**Collision Detection:**
```python
result = accelerator.detect_collisions(positions, radii)
```

**Cellular Automaton (Game of Life):**
```python
result = accelerator.run_cellular_automaton(grid, generations=100)
```

**Diffusion Simulation:**
```python
result = accelerator.run_diffusion(grid, diffusion_rate=0.1, steps=50)
```

**Ecology Predation Detection:**
```python
result = accelerator.ecology_predation_detection(
    prey_positions=prey_pos,
    predator_positions=predator_pos,
    predation_radius=5.0
)
```

### Running Tests

```bash
python kernels.py
```

This will output device information and run a simple particle simulation test.

## Kernel Reference

### physics_kernel
Simulates particle physics with forces, damping, and boundary collisions.

**Input:** `particles` (Nx7 array [x, y, z, vx, vy, vz, mass])

### boids_kernel
Implements Reynolds' boids flocking rules: separation, alignment, cohesion.

**Input:** `positions` (Nx3), `velocities` (Nx3)

### collision_detection_kernel
Detects collisions between spherical particles.

**Input:** `positions` (Nx3), `radii` (N)

### cellular_automaton_kernel
Simulates cellular automata (e.g., Conway's Game of Life).

**Input:** `grid` (2D array)

### diffusion_kernel
Simulates diffusion/reaction-diffusion on a 2D grid.

**Input:** `grid` (2D array)

### ecology_predation_kernel
Detects predation events between predators and prey.

**Input:** `prey_positions` (Nx3), `predator_positions` (Mx3)

## Performance Tips

1. **Batch size**: Use at least 1000+ particles for GPU to be beneficial
2. **Memory transfer**: Minimize host-device transfers
3. **Thread blocks**: Default 256 threads/block works well for most cases
4. **Pinned memory**: Use `cuda.pinned_memory` for faster transfers

## Requirements

- NVIDIA GPU with compute capability 5.0+
- CUDA Toolkit 11.x or 12.x
- 64-bit Python 3.10+

## References

- [Numba CUDA Documentation](https://numba.readthedocs.io/en/stable/cuda/index.html)
- [Python for Parallel Computing on GPUs](https://medium.com/codrift/python-for-parallel-computing-on-gpus-cupy-and-numba-pro-cbbdbc281d1b)
- [CUDA Programming Guide](https://docs.nvidia.com/cuda/cuda-c-programming-guide/)
