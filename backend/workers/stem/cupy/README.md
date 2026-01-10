# CuPy GPU Bridge

GPU acceleration bridge for StudyLoG.AI using CuPy (NumPy-compatible GPU arrays).

## Overview

This module provides GPU-accelerated operations for STEM computations in StudyLoG.AI:

1. **Physics Simulation**: GPU-accelerated particle physics and flocking
2. **Data Science**: Fast array operations, PCA, K-means, FFT
3. **Godot Integration**: Direct bridge for Godot physics data
4. **Real-time Communication**: WebSocket support for live updates

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or for CUDA 11.x:
pip install cupy-cuda11x
```

## Usage

### Starting the Server

```bash
python bridge.py --port 8081
```

### HTTP API

**Physics Simulation:**
```bash
curl -X POST http://localhost:8081/physics/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "particles": [[0, 0, 0, 1, 0, 0, 1], [1, 0, 0, -1, 0, 0, 1]],
    "dt": 0.016,
    "steps": 10
  }'
```

**Data Analysis:**
```bash
curl -X POST http://localhost:8081/data/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "pca",
    "data": [[1, 2], [3, 4], [5, 6]],
    "parameters": {"n_components": 2}
  }'
```

**Godot Scene Processing:**
```bash
curl -X POST http://localhost:8081/godot/process \
  -H "Content-Type: application/json" \
  -d '{
    "nodes": [{"transform": {"origin": [0, 0, 0]}, "velocity": [1, 0, 0], "mass": 1}],
    "delta_time": 0.016,
    "operations": ["integrate", "center_of_mass"]
  }'
```

### WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8081/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'physics',
    particles: [[0, 0, 0, 1, 0, 0, 1]],
    dt: 0.016
  }));
};

ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log('Physics result:', result.particles);
};
```

## API Endpoints

- `GET /` - Service info
- `GET /info` - GPU bridge information
- `POST /physics/simulate` - Run physics simulation
- `POST /physics/flocking` - Run flocking simulation
- `POST /data/analyze` - Run data science operation
- `POST /godot/process` - Process Godot scene data
- `WS /ws` - WebSocket for real-time updates

## Supported Operations

### Data Science Operations

- `mean` - Compute mean values
- `std` - Compute standard deviation
- `correlation` - Pearson correlation matrix
- `pca` - Principal Component Analysis
- `kmeans` - K-means clustering
- `histogram` - Compute histogram
- `fft` - Fast Fourier Transform
- `convolution` - 2D convolution

## Environment Variables

- `PORT` - Server port (default: 8081)
- `LOG_LEVEL` - Logging level (default: INFO)
- `GPU_MEMORY_LIMIT` - GPU memory limit in bytes

## References

- [CuPy Documentation](https://cupy.dev/)
- [Numba CUDA Guide](https://numba.readthedocs.io/en/stable/cuda/index.html)
- [GPU Computing with Python](https://blog.hpc.qmul.ac.uk/numba-cuda/)
