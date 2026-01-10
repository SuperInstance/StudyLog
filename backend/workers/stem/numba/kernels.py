"""
Numba CUDA Kernels for StudyLoG.AI

JIT-compiled CUDA kernels for high-performance STEM computations.

This module provides CUDA kernels compiled with Numba for GPU acceleration.
These kernels offer maximum performance for physics simulations, numerical
computations, and agent-based modeling in StudyLoG.AI.

## Features

1. **Physics Kernels**: Particle simulation, collision detection, forces
2. **Agent Kernels**: Boid flocking, steering behaviors
3. **Math Kernels**: Matrix operations, reductions
4. **Ecology Kernels**: Sitka Sound ecosystem simulation

## Architecture

```
Python Application
    |
    | @cuda.jit decorators
    v
Numba JIT Compiler
    |
    | PTX generation
    v
CUDA Runtime
    |
    v
NVIDIA GPU (RTX)
```

## Requirements

- Python 3.10+
- Numba: pip install numba-cuda
- CUDA Toolkit 11.x or 12.x
- NVIDIA GPU with compute capability 5.0+

## Usage

```python
from numba import cuda
from kernels import NumbaAccelerator

accelerator = NumbaAccelerator()

# Run particle simulation
result = accelerator.simulate_particles(particles, forces, dt)
```

@see https://numba.readthedocs.io/en/stable/cuda/index.html
@see https://medium.com/codrift/python-for-parallel-computing-on-gpus-cupy-and-numba-pro-cbbdbc281d1b
"""

import logging
import math
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

# Try to import Numba CUDA
try:
    from numba import cuda
    NUMBA_AVAILABLE = cuda.is_available()
    NUMBA_VERSION = cuda.__version__
except ImportError:
    NUMBA_AVAILABLE = False
    NUMBA_VERSION = None
    logging.warning("Numba CUDA not available. Install with: pip install numba-cuda")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============================================================================
# CUDA Kernels
# ============================================================================

if NUMBA_AVAILABLE:
    @cuda.jit
    def physics_kernel(
        particles: np.ndarray,
        forces: np.ndarray,
        dt: float,
        damping: float,
        bounds_min: np.ndarray,
        bounds_max: np.ndarray,
    ):
        """
        CUDA kernel for particle physics simulation.

        Each thread handles one particle:
        1. Apply forces (F = ma -> a = F/m)
        2. Update velocity
        3. Update position
        4. Apply damping
        5. Handle boundary collisions

        Args:
            particles: Nx7 array [x, y, z, vx, vy, vz, mass]
            forces: Nx3 array [fx, fy, fz]
            dt: Time step
            damping: Velocity damping factor
            bounds_min: [min_x, min_y, min_z]
            bounds_max: [max_x, max_y, max_z]
        """
        idx = cuda.grid(1)
        n = particles.shape[0]

        if idx >= n:
            return

        # Load particle data
        x, y, z = particles[idx, 0], particles[idx, 1], particles[idx, 2]
        vx, vy, vz = particles[idx, 3], particles[idx, 4], particles[idx, 5]
        mass = particles[idx, 6]

        # Apply forces (a = F/m)
        if forces.shape[0] > idx:
            fx, fy, fz = forces[idx, 0], forces[idx, 1], forces[idx, 2]
            ax = fx / mass
            ay = fy / mass
            az = fz / mass

            # Update velocity
            vx += ax * dt
            vy += ay * dt
            vz += az * dt

        # Apply damping
        vx *= damping
        vy *= damping
        vz *= damping

        # Update position
        x += vx * dt
        y += vy * dt
        z += vz * dt

        # Handle boundary collisions (bounce)
        for i, (pos, vel, bmin, bmax) in enumerate(
            [(x, vx, bounds_min[0], bounds_max[0]),
             (y, vy, bounds_min[1], bounds_max[1]),
             (z, vz, bounds_min[2], bounds_max[2])]
        ):
            if pos < bmin:
                pos = bmin
                vel = -vel * 0.8  # Bounce with energy loss
            elif pos > bmax:
                pos = bmax
                vel = -vel * 0.8

        # Write back
        particles[idx, 0] = x
        particles[idx, 1] = y
        particles[idx, 2] = z
        particles[idx, 3] = vx
        particles[idx, 4] = vy
        particles[idx, 5] = vz

    @cuda.jit
    def nbody_kernel(
        positions: np.ndarray,
        velocities: np.ndarray,
        masses: np.ndarray,
        G: float,
        softening: float,
        dt: float,
    ):
        """
        N-body gravitational simulation kernel.

        Computes gravitational forces between all pairs of particles.
        O(N^2) complexity - requires many particles for GPU to be beneficial.

        Args:
            positions: Nx3 array of positions
            velocities: Nx3 array of velocities
            masses: N array of masses
            G: Gravitational constant
            softening: Softening parameter to prevent singularities
            dt: Time step
        """
        idx = cuda.grid(1)
        n = positions.shape[0]

        if idx >= n:
            return

        # Compute force on particle idx from all other particles
        fx = 0.0
        fy = 0.0
        fz = 0.0

        pos_x = positions[idx, 0]
        pos_y = positions[idx, 1]
        pos_z = positions[idx, 2]

        for j in range(n):
            if j == idx:
                continue

            dx = positions[j, 0] - pos_x
            dy = positions[j, 1] - pos_y
            dz = positions[j, 2] - pos_z

            dist_sq = dx * dx + dy * dy + dz * dz + softening * softening
            dist = math.sqrt(dist_sq)
            dist_cubed = dist * dist * dist

            f = G * masses[idx] * masses[j] / dist_cubed

            fx += f * dx
            fy += f * dy
            fz += f * dz

        # Update velocity
        velocities[idx, 0] += (fx / masses[idx]) * dt
        velocities[idx, 1] += (fy / masses[idx]) * dt
        velocities[idx, 2] += (fz / masses[idx]) * dt

    @cuda.jit
    def collision_detection_kernel(
        positions: np.ndarray,
        radii: np.ndarray,
        collision_matrix: np.ndarray,
    ):
        """
        Collision detection kernel for particles.

        Detects collisions between all pairs of spherical particles.
        Results are stored in a collision matrix.

        Args:
            positions: Nx3 array of positions
            radii: N array of particle radii
            collision_matrix: NxN output matrix (1 if collision, 0 otherwise)
        """
        idx = cuda.grid(1)
        n = positions.shape[0]

        if idx >= n:
            return

        pos_x = positions[idx, 0]
        pos_y = positions[idx, 1]
        pos_z = positions[idx, 2]
        radius = radii[idx]

        for j in range(idx + 1, n):
            dx = positions[j, 0] - pos_x
            dy = positions[j, 1] - pos_y
            dz = positions[j, 2] - pos_z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            if dist < radius + radii[j]:
                collision_matrix[idx, j] = 1
                collision_matrix[j, idx] = 1

    @cuda.jit
    def boids_kernel(
        positions: np.ndarray,
        velocities: np.ndarray,
        perception_radius: float,
        separation_weight: float,
        alignment_weight: float,
        cohesion_weight: float,
        max_speed: float,
        max_force: float,
        dt: float,
    ):
        """
        Boids flocking simulation kernel.

        Implements the three classic boid rules:
        1. Separation: Steer away from nearby boids
        2. Alignment: Steer towards average velocity of neighbors
        3. Cohesion: Steer towards center of mass of neighbors

        Args:
            positions: Nx3 array of positions
            velocities: Nx3 array of velocities
            perception_radius: Distance to consider neighbors
            separation_weight: Weight for separation rule
            alignment_weight: Weight for alignment rule
            cohesion_weight: Weight for cohesion rule
            max_speed: Maximum speed
            max_force: Maximum steering force
            dt: Time step
        """
        idx = cuda.grid(1)
        n = positions.shape[0]

        if idx >= n:
            return

        # Current position and velocity
        pos_x, pos_y, pos_z = positions[idx, 0], positions[idx, 1], positions[idx, 2]
        vel_x, vel_y, vel_z = velocities[idx, 0], velocities[idx, 1], velocities[idx, 2]

        # Accumulators for steering forces
        sep_x, sep_y, sep_z = 0.0, 0.0, 0.0
        sep_count = 0

        align_x, align_y, align_z = 0.0, 0.0, 0.0
        align_count = 0

        coh_x, coh_y, coh_z = 0.0, 0.0, 0.0
        coh_count = 0

        # Check all other boids
        for j in range(n):
            if j == idx:
                continue

            dx = positions[j, 0] - pos_x
            dy = positions[j, 1] - pos_y
            dz = positions[j, 2] - pos_z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            if dist < perception_radius and dist > 0:
                # Separation: Steer away
                sep_x -= dx / dist
                sep_y -= dy / dist
                sep_z -= dz / dist
                sep_count += 1

                # Alignment: Match velocity
                align_x += velocities[j, 0]
                align_y += velocities[j, 1]
                align_z += velocities[j, 2]
                align_count += 1

                # Cohesion: Move toward center
                coh_x += positions[j, 0]
                coh_y += positions[j, 1]
                coh_z += positions[j, 2]
                coh_count += 1

        # Calculate separation force
        if sep_count > 0:
            sep_x /= sep_count
            sep_y /= sep_count
            sep_z /= sep_count
            sep_mag = math.sqrt(sep_x * sep_x + sep_y * sep_y + sep_z * sep_z)
            if sep_mag > 0:
                sep_x = (sep_x / sep_mag) * max_speed - vel_x
                sep_y = (sep_y / sep_mag) * max_speed - vel_y
                sep_z = (sep_z / sep_mag) * max_speed - vel_z

        # Calculate alignment force
        if align_count > 0:
            align_x /= align_count
            align_y /= align_count
            align_z /= align_count
            align_mag = math.sqrt(align_x * align_x + align_y * align_y + align_z * align_z)
            if align_mag > 0:
                align_x = (align_x / align_mag) * max_speed - vel_x
                align_y = (align_y / align_mag) * max_speed - vel_y
                align_z = (align_z / align_mag) * max_speed - vel_z

        # Calculate cohesion force
        if coh_count > 0:
            coh_x = coh_x / coh_count - pos_x
            coh_y = coh_y / coh_count - pos_y
            coh_z = coh_z / coh_count - pos_z
            coh_mag = math.sqrt(coh_x * coh_x + coh_y * coh_y + coh_z * coh_z)
            if coh_mag > 0:
                coh_x = (coh_x / coh_mag) * max_speed - vel_x
                coh_y = (coh_y / coh_mag) * max_speed - vel_y
                coh_z = (coh_z / coh_mag) * max_speed - vel_z

        # Combine forces
        acc_x = sep_x * separation_weight + align_x * alignment_weight + coh_x * cohesion_weight
        acc_y = sep_y * separation_weight + align_y * alignment_weight + coh_y * cohesion_weight
        acc_z = sep_z * separation_weight + align_z * alignment_weight + coh_z * cohesion_weight

        # Limit force
        acc_mag = math.sqrt(acc_x * acc_x + acc_y * acc_y + acc_z * acc_z)
        if acc_mag > max_force:
            acc_x = (acc_x / acc_mag) * max_force
            acc_y = (acc_y / acc_mag) * max_force
            acc_z = (acc_z / acc_mag) * max_force

        # Update velocity
        vel_x += acc_x * dt
        vel_y += acc_y * dt
        vel_z += acc_z * dt

        # Limit speed
        speed = math.sqrt(vel_x * vel_x + vel_y * vel_y + vel_z * vel_z)
        if speed > max_speed:
            vel_x = (vel_x / speed) * max_speed
            vel_y = (vel_y / speed) * max_speed
            vel_z = (vel_z / speed) * max_speed

        # Update position
        pos_x += vel_x * dt
        pos_y += vel_y * dt
        pos_z += vel_z * dt

        # Write back
        positions[idx, 0] = pos_x
        positions[idx, 1] = pos_y
        positions[idx, 2] = pos_z
        velocities[idx, 0] = vel_x
        velocities[idx, 1] = vel_y
        velocities[idx, 2] = vel_z

    @cuda.jit
    def cellular_automaton_kernel(
        grid: np.ndarray,
        new_grid: np.ndarray,
        rule: int,
    ):
        """
        Cellular automaton kernel (e.g., Conway's Game of Life).

        Args:
            grid: 2D grid of cell states (0 or 1)
            new_grid: Output grid for next generation
            rule: Rule number (default: 224 for Game of Life B3/S23)
        """
        x, y = cuda.grid(2)
        height, width = grid.shape

        if x >= height or y >= width:
            return

        # Count neighbors
        neighbors = 0
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx = (x + dx) % height
                ny = (y + dy) % width
                neighbors += grid[nx, ny]

        # Apply rules
        if grid[x, y] == 1:
            # Survival
            new_grid[x, y] = 1 if neighbors in (2, 3) else 0
        else:
            # Birth
            new_grid[x, y] = 1 if neighbors == 3 else 0

    @cuda.jit
    def diffusion_kernel(
        grid: np.ndarray,
        new_grid: np.ndarray,
        diffusion_rate: float,
    ):
        """
        Diffusion/reaction-diffusion kernel.

        Simulates diffusion of substances on a 2D grid.

        Args:
            grid: 2D grid of concentrations
            new_grid: Output grid after diffusion step
            diffusion_rate: Rate of diffusion
        """
        x, y = cuda.grid(2)
        height, width = grid.shape

        if x == 0 or x >= height - 1 or y == 0 or y >= width - 1:
            # Boundary conditions (no flux)
            new_grid[x, y] = grid[x, y]
            return

        # 5-point stencil for diffusion
        laplacian = (
            grid[x + 1, y] +
            grid[x - 1, y] +
            grid[x, y + 1] +
            grid[x, y - 1] -
            4 * grid[x, y]
        )

        new_grid[x, y] = grid[x, y] + diffusion_rate * laplacian

    @cuda.jit
    def reduction_sum_kernel(array: np.ndarray, partial_sums: np.ndarray):
        """
        Parallel reduction kernel for summing array elements.

        Args:
            array: Input array
            partial_sums: Partial sums from each block
        """
        idx = cuda.grid(1)
        n = array.shape[0]

        if idx >= n:
            return

        # Shared memory for block-level reduction
        shared = cuda.shared.array(shape=(512,), dtype=np.float32)
        tid = cuda.threadIdx.x
        bid = cuda.blockIdx.x

        # Load into shared memory
        shared[tid] = array[idx] if idx < n else 0.0
        cuda.syncthreads()

        # Reduce in shared memory
        s = 512
        while s > 1:
            s //= 2
            if tid < s:
                shared[tid] += shared[tid + s]
            cuda.syncthreads()

        # Write block result
        if tid == 0:
            partial_sums[bid] = shared[0]

    @cuda.jit
    def ecology_predation_kernel(
        prey_positions: np.ndarray,
        predator_positions: np.ndarray,
        predation_radius: float,
        predation_matrix: np.ndarray,
    ):
        """
        Ecology kernel for Sitka Sound simulation.

        Detects predation events between predators and prey.

        Args:
            prey_positions: Nx3 array of prey positions
            predator_positions: Mx3 array of predator positions
            predation_radius: Distance for successful predation
            predation_matrix: NxM output matrix (1 if predation, 0 otherwise)
        """
        prey_idx = cuda.grid(1)

        if prey_idx >= prey_positions.shape[0]:
            return

        prey_x = prey_positions[prey_idx, 0]
        prey_y = prey_positions[prey_idx, 1]
        prey_z = prey_positions[prey_idx, 2]

        for pred_idx in range(predator_positions.shape[0]):
            dx = predator_positions[pred_idx, 0] - prey_x
            dy = predator_positions[pred_idx, 1] - prey_y
            dz = predator_positions[pred_idx, 2] - prey_z
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)

            if dist < predation_radius:
                predation_matrix[prey_idx, pred_idx] = 1

else:
    # Stub functions when Numba is not available
    physics_kernel = None
    nbody_kernel = None
    collision_detection_kernel = None
    boids_kernel = None
    cellular_automaton_kernel = None
    diffusion_kernel = None
    reduction_sum_kernel = None
    ecology_predation_kernel = None

# ============================================================================
# Numba Accelerator Class
# ============================================================================


@dataclass
class KernelExecutionResult:
    """Result from kernel execution"""
    success: bool
    data: Optional[np.ndarray] = None
    execution_time_ms: float = 0.0
    gpu_memory_used: int = 0
    threads_per_block: int = 0
    blocks_per_grid: int = 0
    error: Optional[str] = None


class NumbaAccelerator:
    """
    Interface for Numba-accelerated STEM computations.

    This class provides a high-level interface for running CUDA kernels
    compiled with Numba. It handles device memory allocation, kernel
    launching, and result retrieval.

    ## Usage

    ```python
    accelerator = NumbaAccelerator()

    # Particle simulation
    result = accelerator.simulate_particles(
        particles=np.random.rand(1000, 7),
        forces=np.zeros((1000, 3)),
        dt=0.016
    )

    # Boids flocking
    result = accelerator.simulate_boids(
        positions=np.random.rand(500, 3) * 100,
        velocities=np.random.rand(500, 3) - 0.5,
        perception_radius=10.0
    )
    ```
    """

    def __init__(self):
        """Initialize the Numba accelerator"""
        self.available = NUMBA_AVAILABLE
        self.device = cuda.get_current_device() if NUMBA_AVAILABLE else None
        self.threads_per_block = 256  # Default thread block size

        if self.available and self.device:
            logger.info(f"Numba CUDA initialized: {NUMBA_VERSION}")
            logger.info(f"Device: {self.device.name}")
            logger.info(f"Compute capability: {self.device.compute_capability}")
            logger.info(f"Total memory: {self.device.total_memory / 1024**3:.2f} GB")
        else:
            logger.warning("Numba CUDA not available - using CPU fallback")

    def _get_grid_config(self, n_elements: int) -> Tuple[int, int]:
        """Calculate grid configuration for kernel launch"""
        blocks_per_grid = (n_elements + self.threads_per_block - 1) // self.threads_per_block
        return (blocks_per_grid, self.threads_per_block)

    def simulate_particles(
        self,
        particles: np.ndarray,
        forces: np.ndarray,
        dt: float = 0.016,
        damping: float = 0.99,
        bounds_min: np.ndarray = None,
        bounds_max: np.ndarray = None,
        steps: int = 1,
    ) -> KernelExecutionResult:
        """
        Run particle physics simulation on GPU.

        Args:
            particles: Nx7 array [x, y, z, vx, vy, vz, mass]
            forces: Nx3 array [fx, fy, fz]
            dt: Time step
            damping: Velocity damping factor
            bounds_min: [min_x, min_y, min_z]
            bounds_max: [max_x, max_y, max_z]
            steps: Number of simulation steps

        Returns:
            KernelExecutionResult with updated particles
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        if particles.ndim != 2 or particles.shape[1] != 7:
            return KernelExecutionResult(
                success=False,
                error="Particles must be Nx7 array"
            )

        start_time = datetime.now()

        try:
            n = particles.shape[0]
            blocks, threads = self._get_grid_config(n)

            # Set default bounds if not provided
            if bounds_min is None:
                bounds_min = np.array([-100.0, -100.0, -100.0], dtype=np.float32)
            if bounds_max is None:
                bounds_max = np.array([100.0, 100.0, 100.0], dtype=np.float32)

            # Allocate device memory
            d_particles = cuda.to_device(particles.astype(np.float32))
            d_forces = cuda.to_device(forces.astype(np.float32)) if forces is not None else cuda.device_array((n, 3), dtype=np.float32)

            # Run kernel for each step
            for _ in range(steps):
                physics_kernel[blocks, threads](
                    d_particles,
                    d_forces,
                    dt,
                    damping,
                    bounds_min,
                    bounds_max,
                )
                cuda.synchronize()

            # Copy result back
            result = d_particles.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = particles.nbytes + forces.nbytes

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                threads_per_block=threads,
                blocks_per_grid=blocks,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def simulate_boids(
        self,
        positions: np.ndarray,
        velocities: np.ndarray,
        perception_radius: float = 5.0,
        separation_weight: float = 1.5,
        alignment_weight: float = 1.0,
        cohesion_weight: float = 1.0,
        max_speed: float = 2.0,
        max_force: float = 0.1,
        dt: float = 0.016,
        steps: int = 1,
    ) -> KernelExecutionResult:
        """
        Run boids flocking simulation on GPU.

        Args:
            positions: Nx3 array of positions
            velocities: Nx3 array of velocities
            perception_radius: Distance to consider neighbors
            separation_weight: Weight for separation rule
            alignment_weight: Weight for alignment rule
            cohesion_weight: Weight for cohesion rule
            max_speed: Maximum speed
            max_force: Maximum steering force
            dt: Time step
            steps: Number of simulation steps

        Returns:
            KernelExecutionResult with updated positions and velocities
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        start_time = datetime.now()

        try:
            n = positions.shape[0]
            blocks, threads = self._get_grid_config(n)

            # Allocate device memory
            d_positions = cuda.to_device(positions.astype(np.float32))
            d_velocities = cuda.to_device(velocities.astype(np.float32))

            # Run kernel for each step
            for _ in range(steps):
                boids_kernel[blocks, threads](
                    d_positions,
                    d_velocities,
                    perception_radius,
                    separation_weight,
                    alignment_weight,
                    cohesion_weight,
                    max_speed,
                    max_force,
                    dt,
                )
                cuda.synchronize()

            # Copy results back
            result_positions = d_positions.copy_to_host()
            result_velocities = d_velocities.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = positions.nbytes + velocities.nbytes

            # Stack positions and velocities for return
            result = np.concatenate([result_positions, result_velocities], axis=1)

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                threads_per_block=threads,
                blocks_per_grid=blocks,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def detect_collisions(
        self,
        positions: np.ndarray,
        radii: np.ndarray,
    ) -> KernelExecutionResult:
        """
        Detect collisions between spherical particles.

        Args:
            positions: Nx3 array of positions
            radii: N array of radii

        Returns:
            KernelExecutionResult with collision matrix
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        start_time = datetime.now()

        try:
            n = positions.shape[0]
            blocks, threads = self._get_grid_config(n)

            # Allocate device memory
            d_positions = cuda.to_device(positions.astype(np.float32))
            d_radii = cuda.to_device(radii.astype(np.float32))
            d_collisions = cuda.device_array((n, n), dtype=np.int32)

            # Run kernel
            collision_detection_kernel[blocks, threads](
                d_positions,
                d_radii,
                d_collisions,
            )
            cuda.synchronize()

            # Copy result back
            result = d_collisions.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = positions.nbytes + radii.nbytes + n * n * 4

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                threads_per_block=threads,
                blocks_per_grid=blocks,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def run_cellular_automaton(
        self,
        grid: np.ndarray,
        generations: int = 1,
    ) -> KernelExecutionResult:
        """
        Run cellular automaton (e.g., Game of Life) on GPU.

        Args:
            grid: 2D grid of cell states
            generations: Number of generations to simulate

        Returns:
            KernelExecutionResult with final grid state
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        start_time = datetime.now()

        try:
            height, width = grid.shape

            # Allocate device memory
            d_grid = cuda.to_device(grid.astype(np.int32))
            d_new_grid = cuda.device_array((height, width), dtype=np.int32)

            # Calculate grid dimensions for 2D kernel
            threads_per_block = (16, 16)
            blocks_per_grid = (
                (height + threads_per_block[0] - 1) // threads_per_block[0],
                (width + threads_per_block[1] - 1) // threads_per_block[1],
            )

            for _ in range(generations):
                cellular_automaton_kernel[blocks_per_grid, threads_per_block](
                    d_grid,
                    d_new_grid,
                    224,  # Game of Life rule
                )
                cuda.synchronize()

                # Swap grids
                d_grid, d_new_grid = d_new_grid, d_grid

            # Copy result back
            result = d_grid.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = grid.nbytes * 2

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                error=None,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def run_diffusion(
        self,
        grid: np.ndarray,
        diffusion_rate: float = 0.1,
        steps: int = 1,
    ) -> KernelExecutionResult:
        """
        Run diffusion simulation on GPU.

        Args:
            grid: 2D grid of concentrations
            diffusion_rate: Rate of diffusion
            steps: Number of diffusion steps

        Returns:
            KernelExecutionResult with final grid state
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        start_time = datetime.now()

        try:
            height, width = grid.shape

            # Allocate device memory
            d_grid = cuda.to_device(grid.astype(np.float32))
            d_new_grid = cuda.device_array((height, width), dtype=np.float32)

            # Calculate grid dimensions for 2D kernel
            threads_per_block = (16, 16)
            blocks_per_grid = (
                (height + threads_per_block[0] - 1) // threads_per_block[0],
                (width + threads_per_block[1] - 1) // threads_per_block[1],
            )

            for _ in range(steps):
                diffusion_kernel[blocks_per_grid, threads_per_block](
                    d_grid,
                    d_new_grid,
                    diffusion_rate,
                )
                cuda.synchronize()

                # Swap grids
                d_grid, d_new_grid = d_new_grid, d_grid

            # Copy result back
            result = d_grid.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = grid.nbytes * 2

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                error=None,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def ecology_predation_detection(
        self,
        prey_positions: np.ndarray,
        predator_positions: np.ndarray,
        predation_radius: float = 5.0,
    ) -> KernelExecutionResult:
        """
        Detect predation events for Sitka Sound ecology simulation.

        Args:
            prey_positions: Nx3 array of prey positions
            predator_positions: Mx3 array of predator positions
            predation_radius: Distance for successful predation

        Returns:
            KernelExecutionResult with predation matrix
        """
        if not self.available:
            return KernelExecutionResult(
                success=False,
                error="Numba CUDA not available"
            )

        start_time = datetime.now()

        try:
            n_prey = prey_positions.shape[0]
            n_predators = predator_positions.shape[0]

            # Allocate device memory
            d_prey = cuda.to_device(prey_positions.astype(np.float32))
            d_predators = cuda.to_device(predator_positions.astype(np.float32))
            d_predation = cuda.device_array((n_prey, n_predators), dtype=np.int32)

            # Run kernel
            blocks, threads = self._get_grid_config(n_prey)
            ecology_predation_kernel[blocks, threads](
                d_prey,
                d_predators,
                predation_radius,
                d_predation,
            )
            cuda.synchronize()

            # Copy result back
            result = d_predation.copy_to_host()

            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            gpu_memory_used = prey_positions.nbytes + predator_positions.nbytes + n_prey * n_predators * 4

            return KernelExecutionResult(
                success=True,
                data=result,
                execution_time_ms=execution_time,
                gpu_memory_used=gpu_memory_used,
                threads_per_block=threads,
                blocks_per_grid=blocks,
            )

        except Exception as e:
            return KernelExecutionResult(
                success=False,
                error=str(e)
            )

    def get_device_info(self) -> Dict[str, Any]:
        """Get information about the CUDA device"""
        if not self.available or self.device is None:
            return {
                "available": False,
                "error": "Numba CUDA not available"
            }

        return {
            "available": True,
            "name": self.device.name,
            "compute_capability": self.device.compute_capability,
            "total_memory": self.device.total_memory,
            "multiprocessor_count": self.device.MULTIPROCESSOR_COUNT,
            "max_threads_per_block": self.device.MAX_THREADS_PER_BLOCK,
            "max_shared_memory_per_block": self.device.MAX_SHARED_MEMORY_PER_BLOCK,
            "warp_size": self.device.WARP_SIZE,
        }


# ============================================================================
# Standalone Functions
# ============================================================================

def get_numba_info() -> Dict[str, Any]:
    """Get Numba CUDA availability and device info"""
    return {
        "available": NUMBA_AVAILABLE,
        "version": NUMBA_VERSION,
        "device": NumbaAccelerator().get_device_info() if NUMBA_AVAILABLE else None,
    }


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    print("Numba CUDA Kernels for StudyLoG.AI")
    print("=" * 40)

    info = get_numba_info()
    print(f"Available: {info['available']}")
    print(f"Version: {info['version']}")

    if info['available']:
        device_info = info['device']
        print(f"\nDevice: {device_info['name']}")
        print(f"Compute Capability: {device_info['compute_capability']}")
        print(f"Total Memory: {device_info['total_memory'] / 1024**3:.2f} GB")

        # Run a simple test
        print("\n" + "=" * 40)
        print("Running particle simulation test...")

        accelerator = NumbaAccelerator()
        particles = np.random.rand(1000, 7).astype(np.float32) * 100
        forces = np.zeros((1000, 3), dtype=np.float32)

        result = accelerator.simulate_particles(particles, forces, dt=0.016, steps=10)

        if result.success:
            print(f"Success! Completed in {result.execution_time_ms:.2f} ms")
            print(f"GPU memory used: {result.gpu_memory_used / 1024**2:.2f} MB")
            print(f"Configuration: {result.blocks_per_grid} blocks, {result.threads_per_block} threads/block")
        else:
            print(f"Failed: {result.error}")
    else:
        print("\nNumba CUDA is not available.")
        print("Install with: pip install numba-cuda")
