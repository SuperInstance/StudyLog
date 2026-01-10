/**
 * RTX Local Inference Worker
 *
 * Enables local AI inference on NVIDIA RTX GPUs via TensorRT for StudyLoG.AI.
 *
 * ## Features
 *
 * 1. **RTX GPU Detection**: Automatically detects NVIDIA RTX GPUs and their capabilities
 * 2. **Local Inference**: Runs models locally via TensorRT without cloud API calls
 * 3. **Privacy-Preserving**: Keeps sensitive data local when possible
 * 4. **Cost Savings**: Tracks local vs cloud usage to calculate savings
 * 5. **GPU Offloading**: Offloads heavy computation to local GPU
 *
 * ## Architecture
 *
 * ```
 * Theia IDE
 *     |
 *     v
 * Multi-Model Router
 *     |
 *     +-- GPU Detection -> RTX available?
 *     |                     |
 *     |                     +-- Yes -> Route to local TensorRT
 *     |                     +-- No  -> Route to cloud provider
 *     |
 *     v
 * Budget Tracker (tracks savings from local inference)
 * ```
 *
 * ## RTX AI PC Support
 *
 * This worker integrates with NVIDIA's RTX AI initiative:
 * - TensorRT-LLM for local inference
 * - NVIDIA NIMs for model management
 * - RAG pipeline acceleration
 * - Physics simulation offloading
 *
 * @see https://www.nvidia.com/en-us/ai-on-rtx/
 * @see https://developer.nvidia.com/blog/nvidia-tensorrt-for-rtx-introduces-an-optimized-inference-ai-library-on-windows/
 */

import { Router } from 'itty-router';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * RTX GPU information
 */
export interface RTXGPUInfo {
  /** GPU device ID */
  deviceId: number;

  /** GPU name (e.g., 'NVIDIA GeForce RTX 4090') */
  name: string;

  /** CUDA compute capability */
  computeCapability: string;

  /** Total VRAM in bytes */
  totalMemory: number;

  /** Free VRAM in bytes */
  freeMemory: number;

  /** TensorRT support available */
  tensorRTSupported: boolean;

  /** CUDA cores */
  cudaCores: number;

  /** Tensor cores */
  tensorCores: number;

  /** Supported compute modes */
  computeModes: string[];

  /** Supported data types */
  supportedDataTypes: ('fp32' | 'fp16' | 'int8' | 'int4' | 'bf16')[];
}

/**
 * Inference result from local TensorRT execution
 */
export interface InferenceResult {
  /** Success status */
  success: boolean;

  /** Generated text output */
  output?: string;

  /** Token probabilities (if requested) */
  tokenProbabilities?: number[];

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Tokens per second */
  tokensPerSecond: number;

  /** GPU memory used in bytes */
  gpuMemoryUsed: number;

  /** Estimated cost saved compared to cloud */
  costSaved: number;

  /** Error message if failed */
  error?: string;

  /** Model used for inference */
  model: string;

  /** Execution location (local/cloud) */
  location: 'local' | 'cloud';
}

/**
 * GPU offload task types
 */
export type OffloadTask = 'render' | 'rag' | 'simulation' | 'training';

/**
 * GPU offload result
 */
export interface OffloadResult {
  /** Task type */
  task: OffloadTask;

  /** Success status */
  success: boolean;

  /** Result data */
  data?: unknown;

  /** GPU memory used */
  gpuMemoryUsed: number;

  /** Execution time */
  executionTimeMs: number;

  /** Speedup factor vs CPU */
  speedupFactor?: number;

  /** Error if failed */
  error?: string;
}

/**
 * Local vs cloud usage statistics
 */
export interface LocalCloudUsageStats {
  /** User ID */
  userId: string;

  /** Date of stats */
  date: string;

  /** Number of local inferences */
  localInferences: number;

  /** Number of cloud API calls */
  cloudCalls: number;

  /** Total cost from cloud calls */
  cloudCost: number;

  /** Estimated cost saved from local processing */
  estimatedSavings: number;

  /** Total tokens processed locally */
  localTokens: number;

  /** Total tokens processed in cloud */
  cloudTokens: number;

  /** Average local tokens per second */
  avgLocalTokensPerSecond: number;

  /** GPU hours used */
  gpuHours: number;
}

// ============================================================================
// RTX GPU Detection
// ============================================================================

/**
 * RTX GPU detection result
 */
interface GPUDetectionResult {
  /** RTX GPU detected */
  hasRTXGPU: boolean;

  /** GPU information (if detected) */
  gpu?: RTXGPUInfo;

  /** TensorRT available */
  tensorRTAvailable: boolean;

  /** Detection timestamp */
  timestamp: string;

  /** Error message if detection failed */
  error?: string;
}

/**
 * Detect if user has an RTX GPU capable of local inference.
 *
 * This function checks for:
 * 1. NVIDIA GPU presence
 * 2. RTX series (20xx, 30xx, 40xx, 50xx)
 * 3. Sufficient VRAM (minimum 8GB recommended)
 * 4. TensorRT availability
 *
 * In a browser/worker environment, this relies on:
 * - WebGPU for basic GPU detection
 * - Local bridge process for detailed GPU info
 *
 * @returns GPU detection result with capabilities
 */
export async function detectRTXGPU(): Promise<GPUDetectionResult> {
  const timestamp = new Date().toISOString();

  try {
    // In a real implementation, this would query a local bridge process
    // running on the user's machine that has access to CUDA/TensorRT

    // For now, return a mock response structure
    // In production, this would make a fetch request to localhost:8080/gpu-info

    return {
      hasRTXGPU: false, // Default to false until properly detected
      tensorRTAvailable: false,
      timestamp,
      error: 'GPU detection requires local bridge process. See README for setup.',
    };
  } catch (error) {
    return {
      hasRTXGPU: false,
      tensorRTAvailable: false,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown detection error',
    };
  }
}

/**
 * Query local bridge for detailed GPU information.
 *
 * The local bridge is a small HTTP server running on the user's machine
 * that provides:
 * - GPU detection via CUDA
 * - TensorRT model loading
 * - Inference execution
 * - Memory monitoring
 *
 * @param bridgeUrl URL of the local bridge (default: localhost:8080)
 * @returns GPU information or null if bridge unavailable
 */
export async function queryLocalBridge(
  bridgeUrl: string = 'http://localhost:8080'
): Promise<RTXGPUInfo | null> {
  try {
    const response = await fetch(`${bridgeUrl}/gpu/info`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(1000), // 1 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as RTXGPUInfo;
    return data;
  } catch {
    // Bridge not available or not responding
    return null;
  }
}

// ============================================================================
// RTX Local Inference Class
// ============================================================================

/**
 * RTX Local Inference Engine
 *
 * Manages local AI inference on NVIDIA RTX GPUs via TensorRT.
 *
 * ## Usage
 *
 * ```typescript
 * const rtx = new RTXLocalInference('http://localhost:8080');
 * const hasGPU = await rtx.detect();
 * if (hasGPU) {
 *   const result = await rtx.inference('llama-3.1-8b', { prompt: 'Hello!' });
 * }
 * ```
 */
export class RTXLocalInference {
  private bridgeUrl: string;
  private gpuInfo: RTXGPUInfo | null = null;
  private availableModels: string[] = [];

  /**
   * Create a new RTX Local Inference instance
   *
   * @param bridgeUrl URL of the local TensorRT bridge (default: localhost:8080)
   */
  constructor(bridgeUrl: string = 'http://localhost:8080') {
    this.bridgeUrl = bridgeUrl;
  }

  /**
   * Detect RTX GPU and initialize local inference
   *
   * @returns True if RTX GPU detected and initialized successfully
   */
  async detect(): Promise<boolean> {
    const gpu = await queryLocalBridge(this.bridgeUrl);
    if (gpu) {
      this.gpuInfo = gpu;

      // Load available models
      try {
        const response = await fetch(`${this.bridgeUrl}/models`);
        if (response.ok) {
          const data = await response.json() as { models: string[] };
          this.availableModels = data.models;
        }
      } catch {
        // Model list unavailable, but GPU is detected
        this.availableModels = [];
      }

      return true;
    }
    return false;
  }

  /**
   * Get GPU information
   *
   * @returns GPU info or null if not detected
   */
  getGPUInfo(): RTXGPUInfo | null {
    return this.gpuInfo;
  }

  /**
   * Get list of available local models
   *
   * @returns Array of model names/identifiers
   */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /**
   * Check if a specific model is available locally
   *
   * @param model Model identifier
   * @returns True if model is available locally
   */
  hasModel(model: string): boolean {
    return this.availableModels.includes(model);
  }

  /**
   * Run inference locally via TensorRT
   *
   * @param model Model identifier (e.g., 'llama-3.1-8b', 'mistral-7b')
   * @param input Input parameters for the model
   * @returns Inference result
   */
  async inference(
    model: string,
    input: {
      prompt: string;
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      stream?: boolean;
    }
  ): Promise<InferenceResult> {
    const startTime = Date.now();

    // Check if GPU is available
    if (!this.gpuInfo) {
      return {
        success: false,
        executionTimeMs: 0,
        tokensPerSecond: 0,
        gpuMemoryUsed: 0,
        costSaved: 0,
        model,
        location: 'cloud',
        error: 'RTX GPU not detected. Initialize with detect() first.',
      };
    }

    // Check if model is available
    if (!this.availableModels.includes(model)) {
      return {
        success: false,
        executionTimeMs: 0,
        tokensPerSecond: 0,
        gpuMemoryUsed: 0,
        costSaved: 0,
        model,
        location: 'cloud',
        error: `Model ${model} not available locally. Available: ${this.availableModels.join(', ')}`,
      };
    }

    try {
      // Call local bridge for inference
      const response = await fetch(`${this.bridgeUrl}/inference`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          max_tokens: input.maxTokens ?? 512,
          temperature: input.temperature ?? 0.7,
          top_p: input.topP ?? 0.9,
          stream: input.stream ?? false,
        }),
        signal: AbortSignal.timeout(60000), // 60 second timeout
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          executionTimeMs: Date.now() - startTime,
          tokensPerSecond: 0,
          gpuMemoryUsed: 0,
          costSaved: 0,
          model,
          location: 'cloud',
          error: `Inference failed: ${error}`,
        };
      }

      const data = await response.json() as {
        output: string;
        tokens_generated: number;
        gpu_memory_used: number;
        token_probabilities?: number[];
      };

      const executionTime = Date.now() - startTime;
      const tokensPerSecond = (data.tokens_generated / executionTime) * 1000;

      // Estimate cost savings (compare to cloud API)
      // Assume average cloud cost of $0.001 per 1K tokens
      const estimatedCloudCost = (data.tokens_generated / 1000) * 0.001;

      return {
        success: true,
        output: data.output,
        tokenProbabilities: data.token_probabilities,
        executionTimeMs: executionTime,
        tokensPerSecond,
        gpuMemoryUsed: data.gpu_memory_used,
        costSaved: estimatedCloudCost,
        model,
        location: 'local',
      };
    } catch (error) {
      return {
        success: false,
        executionTimeMs: Date.now() - startTime,
        tokensPerSecond: 0,
        gpuMemoryUsed: 0,
        costSaved: 0,
        model,
        location: 'cloud',
        error: error instanceof Error ? error.message : 'Unknown inference error',
      };
    }
  }

  /**
   * Offload heavy computation to local GPU
   *
   * Supports various compute-intensive tasks:
   * - render: 3D rendering and visualization
   * - rag: Retrieval-Augmented Generation
   * - simulation: Physics/agent simulation
   * - training: Fine-tuning and training
   *
   * @param task Type of computation to offload
   * @param data Input data for the computation
   * @returns Offload result
   */
  async offloadToGPU(task: OffloadTask, data: unknown): Promise<OffloadResult> {
    // Check if GPU is available
    if (!this.gpuInfo) {
      return {
        task,
        success: false,
        gpuMemoryUsed: 0,
        executionTimeMs: 0,
        error: 'RTX GPU not detected',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${this.bridgeUrl}/offload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task,
          data,
        }),
        signal: AbortSignal.timeout(300000), // 5 minute timeout for heavy tasks
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          task,
          success: false,
          gpuMemoryUsed: 0,
          executionTimeMs: Date.now() - startTime,
          error: `Offload failed: ${error}`,
        };
      }

      const result = await response.json() as {
        data: unknown;
        gpu_memory_used: number;
        speedup_factor?: number;
      };

      return {
        task,
        success: true,
        data: result.data,
        gpuMemoryUsed: result.gpu_memory_used,
        executionTimeMs: Date.now() - startTime,
        speedupFactor: result.speedup_factor,
      };
    } catch (error) {
      return {
        task,
        success: false,
        gpuMemoryUsed: 0,
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown offload error',
      };
    }
  }

  /**
   * Check if GPU has sufficient memory for a task
   *
   * @param requiredMemoryMB Required memory in megabytes
   * @returns True if sufficient memory available
   */
  hasSufficientMemory(requiredMemoryMB: number): boolean {
    if (!this.gpuInfo) return false;
    const freeMemoryMB = this.gpuInfo.freeMemory / (1024 * 1024);
    return freeMemoryMB >= requiredMemoryMB;
  }

  /**
   * Get recommended data type for current GPU
   *
   * RTX GPUs support various precision modes:
   * - fp32: Full precision (slowest, most accurate)
   * - fp16/bf16: Half precision (balanced)
   * - int8: 8-bit quantized (faster, good for inference)
   * - int4: 4-bit quantized (fastest, some quality loss)
   *
   * @returns Recommended data type based on GPU capabilities
   */
  getRecommendedDataType(): 'fp32' | 'fp16' | 'int8' | 'int4' | 'bf16' {
    if (!this.gpuInfo) return 'fp32';

    // Prefer int8 for inference on RTX GPUs (good speed/quality balance)
    if (this.gpuInfo.supportedDataTypes.includes('int8')) {
      return 'int8';
    }
    if (this.gpuInfo.supportedDataTypes.includes('fp16')) {
      return 'fp16';
    }
    if (this.gpuInfo.supportedDataTypes.includes('bf16')) {
      return 'bf16';
    }
    return 'fp32';
  }
}

// ============================================================================
// HTTP API (for Cloudflare Worker deployment)
// ============================================================================

const router = Router();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/', () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'rtx-local',
    version: '1.0.0',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Detect RTX GPU
router.get('/gpu/detect', async () => {
  const result = await detectRTXGPU();
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Check if specific model is available locally
router.get('/models/:model/available', async (req) => {
  const model = req.param?.model;
  if (!model) {
    return new Response(JSON.stringify({ error: 'Model name required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rtx = new RTXLocalInference();
  const detected = await rtx.detect();

  return new Response(JSON.stringify({
    available: detected && rtx.hasModel(model),
    model,
    allModels: detected ? rtx.getAvailableModels() : [],
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Run local inference
router.post('/inference', async (req) => {
  const body = await req.json();
  const { model, prompt, maxTokens, temperature, topP } = body;

  if (!model || !prompt) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: model, prompt',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rtx = new RTXLocalInference();
  await rtx.detect();

  const result = await rtx.inference(model, {
    prompt,
    maxTokens,
    temperature,
    topP,
  });

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Offload computation to GPU
router.post('/offload', async (req) => {
  const body = await req.json();
  const { task, data } = body;

  if (!task || !data) {
    return new Response(JSON.stringify({
      error: 'Missing required fields: task, data',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rtx = new RTXLocalInference();
  await rtx.detect();

  const result = await rtx.offloadToGPU(task, data);

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// Get local vs cloud usage statistics
router.get('/stats/:userId', async (req) => {
  // This would integrate with the budget tracker
  // For now, return a placeholder response
  const userId = req.param?.userId;

  return new Response(JSON.stringify({
    userId,
    date: new Date().toISOString().split('T')[0],
    localInferences: 0,
    cloudCalls: 0,
    cloudCost: 0,
    estimatedSavings: 0,
    localTokens: 0,
    cloudTokens: 0,
    avgLocalTokensPerSecond: 0,
    gpuHours: 0,
  } as LocalCloudUsageStats), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: (request: Request) => {
    return router.handle(request).catch((err) => {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    });
  },
};
