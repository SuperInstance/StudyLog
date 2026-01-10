"""
CuPy GPU Bridge for StudyLoG.AI

Bridge between Node.js backend and Python CuPy for GPU acceleration.

This module provides GPU-accelerated operations using CuPy (NumPy-compatible
GPU arrays) for STEM computations in StudyLoG.AI.

## Features

1. **Physics Simulation**: GPU-accelerated particle physics
2. **Data Science**: Fast array operations on GPU
3. **Numerical Computing**: Linear algebra, FFT, statistics
4. **Godot Integration**: Direct bridge for Godot physics data

## Architecture

```
Node.js Backend (Cloudflare Worker)
    |
    | HTTP/WebSocket
    v
Python Bridge (this file)
    |
    | CuPy arrays
    v
NVIDIA GPU (RTX)
```

## Requirements

- Python 3.10+
- CuPy: pip install cupy-cuda12x (for CUDA 12.x)
- NumPy: pip install numpy
- FastAPI: pip install fastapi uvicorn

## Usage

Start the bridge server:
```bash
python bridge.py --port 8081
```

Then make requests from Node.js:
```javascript
const response = await fetch('http://localhost:8081/physics/simulate', {
  method: 'POST',
  body: JSON.stringify({ particles: [...], dt: 0.016 })
});
```

@see https://cupy.dev/ for CuPy documentation
@see https://blog.hpc.qmul.ac.uk/numba-cuda/ for GPU computing with Python
"""

import asyncio
import json
import logging
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np

# Try to import CuPy - if not available, fall back to NumPy with warning
try:
    import cupy as cp
    CUPY_AVAILABLE = True
    CUPY_VERSION = cp.__version__
except ImportError:
    CUPY_AVAILABLE = False
    CUPY_VERSION = None
    import numpy as cp  # Use NumPy as fallback
    logging.warning("CuPy not available, falling back to NumPy (CPU-only)")

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ============================================================================
# Configuration
# ============================================================================

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEFAULT_PORT = int(os.getenv("CUPY_BRIDGE_PORT", "8081"))
GPU_MEMORY_LIMIT = int(os.getenv("GPU_MEMORY_LIMIT", str(8 * 1024 * 1024 * 1024)))  # 8GB default

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# API Models
# ============================================================================


class GPUBridgeInfo(BaseModel):
    """Information about the GPU bridge"""
    cupy_available: bool
    cupy_version: Optional[str]
    cuda_available: bool
    cuda_version: Optional[str]
    gpu_name: Optional[str]
    gpu_memory_total: int
    gpu_memory_free: int
    using_fallback: bool


class PhysicsSimulationRequest(BaseModel):
    """Request for physics simulation"""
    particles: List[List[float]] = Field(..., description="List of particle state vectors [x, y, z, vx, vy, vz, mass]")
    forces: List[List[float]] = Field(default_factory=list, description="External forces [fx, fy, fz] per particle")
    dt: float = Field(default=0.016, description="Time step in seconds")
    steps: int = Field(default=1, description="Number of simulation steps")
    bounds: Optional[List[float]] = Field(default=None, description="Bounds [min_x, max_x, min_y, max_y, min_z, max_z]")
    damping: float = Field(default=0.99, description="Velocity damping factor")


class PhysicsSimulationResponse(BaseModel):
    """Response from physics simulation"""
    particles: List[List[float]]
    execution_time_ms: float
    speedup_factor: Optional[float]
    gpu_memory_used: int
    steps_completed: int


class DataScienceRequest(BaseModel):
    """Request for data science operations"""
    operation: str = Field(..., description="Operation: 'mean', 'std', 'correlation', 'pca', 'kmeans'")
    data: List[List[float]] = Field(..., description="Input data matrix")
    parameters: Dict[str, Any] = Field(default_factory=dict)


class DataScienceResponse(BaseModel):
    """Response from data science operation"""
    result: Dict[str, Any]
    execution_time_ms: float
    gpu_memory_used: int


class GodotSceneData(BaseModel):
    """Godot scene data for GPU processing"""
    nodes: List[Dict[str, Any]] = Field(..., description="Scene nodes with transforms and properties")
    frame: int = Field(default=0, description="Frame number")
    delta_time: float = Field(default=0.016, description="Time since last frame")


class GodotSceneResponse(BaseModel):
    """Processed Godot scene data"""
    nodes: List[Dict[str, Any]]
    execution_time_ms: float
    gpu_operations: List[str]


# ============================================================================
# GPU Bridge Class
# ============================================================================


class GPUBridge:
    """
    Bridge between Node.js backend and Python CuPy for GPU acceleration.

    This class manages GPU operations and provides a high-level interface
    for common STEM computations.
    """

    def __init__(self):
        """Initialize the GPU bridge"""
        self.cuda_available = CUPY_AVAILABLE
        self.cuda_version = CUPY_VERSION
        self.gpu_info = self._get_gpu_info() if CUPY_AVAILABLE else None
        self.using_fallback = not CUPY_AVAILABLE

        if self.using_fallback:
            logger.warning("Running in fallback mode (NumPy CPU-only)")
        else:
            logger.info(f"CuPy initialized: {self.cuda_version}")
            if self.gpu_info:
                logger.info(f"GPU: {self.gpu_info.get('name', 'Unknown')}")

    def _get_gpu_info(self) -> Optional[Dict[str, Any]]:
        """Get GPU information"""
        if not CUPY_AVAILABLE:
            return None

        try:
            # Get GPU memory info
            mempool = cp.get_default_memory_pool()
            total_bytes = cp.cuda.Device().mem_info[1]  # Total memory
            used_bytes = mempool.used_bytes()
            free_bytes = total_bytes - used_bytes

            # Get GPU name
            gpu_name = cp.cuda.Device().name

            return {
                "name": gpu_name,
                "memory_total": total_bytes,
                "memory_free": free_bytes,
                "memory_used": used_bytes,
                "compute_capability": cp.cuda.Device().compute_capability,
            }
        except Exception as e:
            logger.error(f"Failed to get GPU info: {e}")
            return None

    def get_info(self) -> GPUBridgeInfo:
        """Get bridge information"""
        gpu_info = self._get_gpu_info() if CUPY_AVAILABLE else None

        return GPUBridgeInfo(
            cupy_available=CUPY_AVAILABLE,
            cupy_version=CUPY_VERSION,
            cuda_available=CUPY_AVAILABLE,
            cuda_version=CUPY_VERSION,
            gpu_name=gpu_info.get("name") if gpu_info else None,
            gpu_memory_total=gpu_info.get("memory_total", 0) if gpu_info else 0,
            gpu_memory_free=gpu_info.get("memory_free", 0) if gpu_info else 0,
            using_fallback=self.using_fallback,
        )

    def _to_gpu(self, array: np.ndarray) -> Union[np.ndarray, cp.ndarray]:
        """Convert NumPy array to GPU array"""
        if CUPY_AVAILABLE:
            return cp.asarray(array)
        return array

    def _to_cpu(self, array: Union[np.ndarray, cp.ndarray]) -> np.ndarray:
        """Convert GPU array to NumPy array"""
        if CUPY_AVAILABLE and isinstance(array, cp.ndarray):
            return cp.asnumpy(array)
        return array

    # ========================================================================
    # Physics Simulation
    # ========================================================================

    def accelerate_physics(
        self,
        particles: np.ndarray,
        forces: Optional[np.ndarray] = None,
        dt: float = 0.016,
        steps: int = 1,
        bounds: Optional[np.ndarray] = None,
        damping: float = 0.99,
    ) -> Tuple[np.ndarray, float, int]:
        """
        GPU-accelerated physics simulation for particles.

        Args:
            particles: Nx7 array of [x, y, z, vx, vy, vz, mass]
            forces: Nx3 array of external forces
            dt: Time step
            steps: Number of simulation steps
            bounds: [min_x, max_x, min_y, max_y, min_z, max_z]
            damping: Velocity damping factor

        Returns:
            Tuple of (updated_particles, execution_time_ms, gpu_memory_used)
        """
        start_time = datetime.now()

        # Transfer to GPU
        gpu_particles = self._to_gpu(particles.copy())
        gpu_forces = self._to_gpu(forces) if forces is not None else None
        gpu_bounds = self._to_gpu(bounds) if bounds is not None else None

        xp = cp if CUPY_AVAILABLE else np

        # Extract components for vectorized operations
        pos = gpu_particles[:, :3]  # x, y, z
        vel = gpu_particles[:, 3:6]  # vx, vy, vz
        mass = gpu_particles[:, 6:7]  # mass

        # Simulation loop
        for _ in range(steps):
            # Apply forces (F = ma -> a = F/m)
            if gpu_forces is not None:
                acc = gpu_forces / mass
                vel += acc * dt

            # Update positions
            pos += vel * dt

            # Apply damping
            vel *= damping

            # Apply bounds (bounce off walls)
            if gpu_bounds is not None:
                for i in range(3):
                    min_bound = gpu_bounds[i * 2]
                    max_bound = gpu_bounds[i * 2 + 1]

                    # Check lower bound
                    below_min = pos[:, i] < min_bound
                    pos[below_min, i] = min_bound
                    vel[below_min, i] *= -0.8  # Bounce with energy loss

                    # Check upper bound
                    above_max = pos[:, i] > max_bound
                    pos[above_max, i] = max_bound
                    vel[above_max, i] *= -0.8

        # Combine back
        gpu_particles[:, :3] = pos
        gpu_particles[:, 3:6] = vel

        # Transfer back to CPU
        result = self._to_cpu(gpu_particles)
        execution_time = (datetime.now() - start_time).total_seconds() * 1000

        # Estimate GPU memory used
        gpu_memory_used = particles.nbytes * 3  # Rough estimate

        return result, execution_time, gpu_memory_used

    def accelerate_flocking(
        self,
        particles: np.ndarray,
        perception_radius: float = 5.0,
        separation_weight: float = 1.5,
        alignment_weight: float = 1.0,
        cohesion_weight: float = 1.0,
        max_speed: float = 2.0,
        dt: float = 0.016,
    ) -> Tuple[np.ndarray, float, int]:
        """
        GPU-accelerated flocking simulation (boids).

        Args:
            particles: Nx7 array of [x, y, z, vx, vy, vz, mass]
            perception_radius: Distance to consider neighbors
            separation_weight: Weight for separation rule
            alignment_weight: Weight for alignment rule
            cohesion_weight: Weight for cohesion rule
            max_speed: Maximum speed limit
            dt: Time step

        Returns:
            Tuple of (updated_particles, execution_time_ms, gpu_memory_used)
        """
        start_time = datetime.now()

        gpu_particles = self._to_gpu(particles.copy())
        xp = cp if CUPY_AVAILABLE else np

        num_particles = gpu_particles.shape[0]
        pos = gpu_particles[:, :3]
        vel = gpu_particles[:, 3:6]

        # Compute pairwise distances (vectorized)
        # Shape: (N, N, 3)
        diff = pos[:, xp.newaxis, :] - pos[xp.newaxis, :, :]
        distances = xp.sqrt(xp.sum(diff ** 2, axis=2))

        # Find neighbors within perception radius
        neighbors = (distances < perception_radius) & (distances > 0)

        # Separation: Steer away from nearby neighbors
        separation = xp.zeros_like(pos)
        for i in range(num_particles):
            nearby = neighbors[i]
            if xp.any(nearby):
                diff_to_nearby = -diff[i, nearby]
                weights = 1.0 / (distances[i, nearby][:, xp.newaxis] + 0.01)
                separation[i] = xp.sum(diff_to_nearby * weights, axis=0)
                # Normalize
                norm = xp.linalg.norm(separation[i])
                if norm > 0:
                    separation[i] /= norm

        # Alignment: Steer towards average velocity of neighbors
        alignment = xp.zeros_like(pos)
        for i in range(num_particles):
            nearby = neighbors[i]
            if xp.any(nearby):
                avg_vel = xp.mean(vel[nearby], axis=0)
                alignment[i] = avg_vel
                norm = xp.linalg.norm(alignment[i])
                if norm > 0:
                    alignment[i] /= norm

        # Cohesion: Steer towards center of mass of neighbors
        cohesion = xp.zeros_like(pos)
        for i in range(num_particles):
            nearby = neighbors[i]
            if xp.any(nearby):
                center_of_mass = xp.mean(pos[nearby], axis=0)
                cohesion[i] = center_of_mass - pos[i]
                norm = xp.linalg.norm(cohesion[i])
                if norm > 0:
                    cohesion[i] /= norm

        # Combine rules
        acceleration = (
            separation * separation_weight +
            alignment * alignment_weight +
            cohesion * cohesion_weight
        )

        # Update velocities
        vel += acceleration * dt

        # Limit speed
        speed = xp.sqrt(xp.sum(vel ** 2, axis=1))
        over_speed = speed > max_speed
        if xp.any(over_speed):
            vel[over_speed] = (vel[over_speed].T / speed[over_speed] * max_speed).T

        # Update positions
        pos += vel * dt

        gpu_particles[:, :3] = pos
        gpu_particles[:, 3:6] = vel

        result = self._to_cpu(gpu_particles)
        execution_time = (datetime.now() - start_time).total_seconds() * 1000
        gpu_memory_used = particles.nbytes * 4  # Rough estimate

        return result, execution_time, gpu_memory_used

    # ========================================================================
    # Data Science Operations
    # ========================================================================

    def accelerate_data_science(
        self,
        data: np.ndarray,
        operation: str,
        parameters: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], float, int]:
        """
        GPU-accelerated data analysis operations.

        Args:
            data: Input data matrix (N x M)
            operation: Operation to perform
            parameters: Operation-specific parameters

        Returns:
            Tuple of (result_dict, execution_time_ms, gpu_memory_used)
        """
        start_time = datetime.now()

        gpu_data = self._to_gpu(data)
        xp = cp if CUPY_AVAILABLE else np

        result = {}
        gpu_memory_used = data.nbytes

        if operation == "mean":
            result["mean"] = self._to_cpu(xp.mean(gpu_data, axis=0)).tolist()
            result["overall_mean"] = float(xp.mean(gpu_data))

        elif operation == "std":
            result["std"] = self._to_cpu(xp.std(gpu_data, axis=0)).tolist()
            result["overall_std"] = float(xp.std(gpu_data))

        elif operation == "correlation":
            # Pearson correlation matrix
            centered = gpu_data - xp.mean(gpu_data, axis=0)
            corr = xp.corrcoef(centered, rowvar=False)
            result["correlation_matrix"] = self._to_cpu(corr).tolist()
            gpu_memory_used *= 2

        elif operation == "pca":
            # Principal Component Analysis
            centered = gpu_data - xp.mean(gpu_data, axis=0)
            cov = xp.cov(centered, rowvar=False)
            eigenvalues, eigenvectors = xp.linalg.eigh(cov)

            # Sort by eigenvalue (descending)
            idx = xp.argsort(eigenvalues)[::-1]
            eigenvalues = eigenvalues[idx]
            eigenvectors = eigenvectors[:, idx]

            result["eigenvalues"] = self._to_cpu(eigenvalues).tolist()
            result["explained_variance_ratio"] = self._to_cpu(
                eigenvalues / xp.sum(eigenvalues)
            ).tolist()
            result["components"] = self._to_cpu(
                eigenvectors[:, :parameters.get("n_components", 2)]
            ).tolist()
            gpu_memory_used *= 3

        elif operation == "kmeans":
            # K-means clustering
            n_clusters = parameters.get("n_clusters", 3)
            max_iters = parameters.get("max_iters", 100)

            # Initialize centroids randomly
            n_samples = gpu_data.shape[0]
            indices = xp.random.choice(n_samples, n_clusters, replace=False)
            centroids = gpu_data[indices].copy()

            for _ in range(max_iters):
                # Assign samples to closest centroid
                distances = xp.sqrt(
                    xp.sum((gpu_data[:, xp.newaxis, :] - centroids[xp.newaxis, :, :]) ** 2, axis=2)
                )
                labels = xp.argmin(distances, axis=1)

                # Update centroids
                new_centroids = xp.array([
                    xp.mean(gpu_data[labels == k], axis=0) if xp.sum(labels == k) > 0
                    else centroids[k]
                    for k in range(n_clusters)
                ])

                # Check convergence
                if xp.all(xp.abs(new_centroids - centroids) < 1e-6):
                    break
                centroids = new_centroids

            result["centroids"] = self._to_cpu(centroids).tolist()
            result["labels"] = self._to_cpu(labels).tolist()
            result["n_clusters"] = n_clusters
            gpu_memory_used *= 2

        elif operation == "histogram":
            # Compute histogram
            bins = parameters.get("bins", 50)
            hist, bin_edges = xp.histogram(gpu_data, bins=bins)
            result["histogram"] = self._to_cpu(hist).tolist()
            result["bin_edges"] = self._to_cpu(bin_edges).tolist()

        elif operation == "fft":
            # Fast Fourier Transform
            fft_result = xp.fft.fft(gpu_data, axis=0)
            result["fft_real"] = self._to_cpu(xp.real(fft_result)).tolist()
            result["fft_imag"] = self._to_cpu(xp.imag(fft_result)).tolist()
            result["frequencies"] = self._to_cpu(xp.fft.fftfreq(gpu_data.shape[0])).tolist()
            gpu_memory_used *= 2

        elif operation == "convolution":
            # 2D convolution for image processing
            kernel = xp.array(parameters.get("kernel", [[1, 0, -1], [1, 0, -1], [1, 0, -1]]))
            kernel = self._to_gpu(kernel)

            # Reshape data for convolution (assume 2D)
            if len(gpu_data.shape) == 1:
                # Reshape 1D to 2D
                side = int(xp.sqrt(gpu_data.shape[0]))
                gpu_data = gpu_data[:side * side].reshape(side, side)

            # Simple convolution (for demonstration)
            from scipy.signal import convolve2d
            cpu_data = self._to_cpu(gpu_data)
            cpu_kernel = self._to_cpu(kernel)
            convolved = convolve2d(cpu_data, cpu_kernel, mode='same')
            result["convolved"] = convolved.tolist()

        else:
            raise ValueError(f"Unknown operation: {operation}")

        execution_time = (datetime.now() - start_time).total_seconds() * 1000

        return result, execution_time, gpu_memory_used

    # ========================================================================
    # Godot Integration
    # ========================================================================

    def process_godot_scene(
        self,
        scene_data: Dict[str, Any],
        operations: List[str],
    ) -> Tuple[Dict[str, Any], float, List[str]]:
        """
        Process Godot scene data on GPU.

        Args:
            scene_data: Godot scene with nodes and transforms
            operations: List of operations to perform

        Returns:
            Tuple of (processed_scene, execution_time_ms, operations_performed)
        """
        start_time = datetime.now()
        xp = cp if CUPY_AVAILABLE else np

        nodes = scene_data.get("nodes", [])
        operations_performed = []

        # Extract node transforms
        positions = []
        velocities = []
        masses = []

        for node in nodes:
            transform = node.get("transform", {})
            position = transform.get("origin", [0, 0, 0])
            velocity = node.get("velocity", [0, 0, 0])
            mass = node.get("mass", 1.0)

            positions.append(position)
            velocities.append(velocity)
            masses.append(mass)

        if not positions:
            return scene_data, 0, []

        # Convert to arrays
        pos_array = xp.array(positions, dtype=xp.float32)
        vel_array = xp.array(velocities, dtype=xp.float32)
        mass_array = xp.array(masses, dtype=xp.float32)

        gpu_memory_used = pos_array.nbytes + vel_array.nbytes + mass_array.nbytes

        # Perform requested operations
        if "integrate" in operations:
            dt = scene_data.get("delta_time", 0.016)
            pos_array += vel_array * dt
            operations_performed.append("position_integration")

        if "center_of_mass" in operations:
            total_mass = xp.sum(mass_array)
            com = xp.sum(pos_array * mass_array[:, xp.newaxis], axis=0) / total_mass
            operations_performed.append("center_of_mass")
            scene_data["center_of_mass"] = self._to_cpu(com).tolist()

        if "bounding_box" in operations:
            min_bounds = self._to_cpu(xp.min(pos_array, axis=0)).tolist()
            max_bounds = self._to_cpu(xp.max(pos_array, axis=0)).tolist()
            operations_performed.append("bounding_box")
            scene_data["bounding_box"] = {
                "min": min_bounds,
                "max": max_bounds
            }

        # Update node positions
        updated_positions = self._to_cpu(pos_array).tolist()
        for i, node in enumerate(nodes):
            if i < len(updated_positions):
                node["transform"]["origin"] = updated_positions[i]

        execution_time = (datetime.now() - start_time).total_seconds() * 1000

        return scene_data, execution_time, operations_performed


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="CuPy GPU Bridge",
    description="GPU acceleration bridge for StudyLoG.AI using CuPy",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global GPU bridge instance
gpu_bridge = GPUBridge()


@app.get("/", response_model=Dict[str, Any])
async def root():
    """Root endpoint with service info"""
    return {
        "service": "cupy-gpu-bridge",
        "version": "1.0.0",
        "status": "running",
        "cupy_available": CUPY_AVAILABLE,
    }


@app.get("/info", response_model=GPUBridgeInfo)
async def get_info():
    """Get GPU bridge information"""
    return gpu_bridge.get_info()


@app.post("/physics/simulate", response_model=PhysicsSimulationResponse)
async def physics_simulate(request: PhysicsSimulationRequest):
    """Run GPU-accelerated physics simulation"""
    try:
        particles = np.array(request.particles, dtype=np.float32)
        forces = np.array(request.forces, dtype=np.float32) if request.forces else None
        bounds = np.array(request.bounds, dtype=np.float32) if request.bounds else None

        result, exec_time, mem_used = gpu_bridge.accelerate_physics(
            particles=particles,
            forces=forces,
            dt=request.dt,
            steps=request.steps,
            bounds=bounds,
            damping=request.damping,
        )

        return PhysicsSimulationResponse(
            particles=result.tolist(),
            execution_time_ms=exec_time,
            speedup_factor=None,  # Would need CPU baseline
            gpu_memory_used=mem_used,
            steps_completed=request.steps,
        )
    except Exception as e:
        logger.error(f"Physics simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/physics/flocking", response_model=PhysicsSimulationResponse)
async def flocking_simulate(request: PhysicsSimulationRequest):
    """Run GPU-accelerated flocking simulation (boids)"""
    try:
        particles = np.array(request.particles, dtype=np.float32)

        result, exec_time, mem_used = gpu_bridge.accelerate_flocking(
            particles=particles,
            perception_radius=request.parameters.get("perception_radius", 5.0) if hasattr(request, 'parameters') else 5.0,
            max_speed=request.parameters.get("max_speed", 2.0) if hasattr(request, 'parameters') else 2.0,
            dt=request.dt,
        )

        return PhysicsSimulationResponse(
            particles=result.tolist(),
            execution_time_ms=exec_time,
            speedup_factor=None,
            gpu_memory_used=mem_used,
            steps_completed=1,
        )
    except Exception as e:
        logger.error(f"Flocking simulation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/data/analyze", response_model=DataScienceResponse)
async def data_analyze(request: DataScienceRequest):
    """Run GPU-accelerated data analysis"""
    try:
        data = np.array(request.data, dtype=np.float32)

        result, exec_time, mem_used = gpu_bridge.accelerate_data_science(
            data=data,
            operation=request.operation,
            parameters=request.parameters,
        )

        return DataScienceResponse(
            result=result,
            execution_time_ms=exec_time,
            gpu_memory_used=mem_used,
        )
    except Exception as e:
        logger.error(f"Data analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/godot/process", response_model=GodotSceneResponse)
async def godot_process(request: GodotSceneData):
    """Process Godot scene data on GPU"""
    try:
        scene_dict = request.dict()
        operations = scene_dict.get("operations", ["integrate"])

        result, exec_time, operations_done = gpu_bridge.process_godot_scene(
            scene_data=scene_dict,
            operations=operations,
        )

        return GodotSceneResponse(
            nodes=result.get("nodes", []),
            execution_time_ms=exec_time,
            gpu_operations=operations_done,
        )
    except Exception as e:
        logger.error(f"Godot processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time GPU operations"""
    await websocket.accept()
    logger.info("WebSocket connection established")

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "physics":
                # Physics simulation via WebSocket
                particles = np.array(data["particles"], dtype=np.float32)
                result, exec_time, _ = gpu_bridge.accelerate_physics(
                    particles=particles,
                    dt=data.get("dt", 0.016),
                    steps=data.get("steps", 1),
                )

                await websocket.send_json({
                    "type": "physics_result",
                    "particles": result.tolist(),
                    "execution_time_ms": exec_time,
                })

            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", DEFAULT_PORT))
    logger.info(f"Starting CuPy GPU Bridge on port {port}")

    uvicorn.run(
        "bridge:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level=LOG_LEVEL.lower(),
    )
