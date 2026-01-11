/**
 * Platform Detector
 *
 * Detects hardware capabilities and platform characteristics.
 * Provides data for engine selection and quality tuning.
 *
 * @module engine-abstraction/platform-detector
 */

import type {
  Platform,
  PlatformCapabilities,
  GPUInfo,
  QualityTier,
  GameEngine,
  RenderingBackend,
  GPUCapability,
} from "./types.js";

// ============================================================================
// PLATFORM DETECTOR
// ============================================================================

/**
 * Detects platform and hardware capabilities.
 * Works in browser, Node.js, and various runtime environments.
 */
export class PlatformDetector {
  private static _instance: PlatformDetector | null = null;
  private _capabilities: PlatformCapabilities | null = null;
  private _detectionPromise: Promise<PlatformCapabilities> | null = null;
  private _userAgent: string;
  private _isBrowser: boolean;
  private _isNode: boolean;
  private _isDeno: boolean;
  private _isBun: boolean;

  private constructor() {
    this._isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
    this._isNode = typeof process !== "undefined" && process.versions?.node !== undefined;
    this._isDeno = typeof Deno !== "undefined";
    this._isBun = typeof Bun !== "undefined";
    this._userAgent = this.getUserAgent();
  }

  /**
   * Get the singleton PlatformDetector instance.
   */
  static getInstance(): PlatformDetector {
    if (!PlatformDetector._instance) {
      PlatformDetector._instance = new PlatformDetector();
    }
    return PlatformDetector._instance;
  }

  /**
   * Detect platform capabilities.
   * @returns Detected platform capabilities
   */
  async detect(): Promise<PlatformCapabilities> {
    // Return cached result if available
    if (this._capabilities) {
      return this._capabilities;
    }

    // Return in-progress detection
    if (this._detectionPromise) {
      return this._detectionPromise;
    }

    this._detectionPromise = this.performDetection();
    this._capabilities = await this._detectionPromise;
    return this._capabilities;
  }

  /**
   * Force re-detection of platform capabilities.
   * @returns Freshly detected platform capabilities
   */
  async redetect(): Promise<PlatformCapabilities> {
    this._capabilities = null;
    this._detectionPromise = null;
    return this.detect();
  }

  /**
   * Get cached capabilities without triggering detection.
   * @returns Cached capabilities or null if not yet detected
   */
  getCachedCapabilities(): PlatformCapabilities | null {
    return this._capabilities;
  }

  /**
   * Perform the actual platform detection.
   * @returns Detected platform capabilities
   */
  private async performDetection(): Promise<PlatformCapabilities> {
    const platform = this.detectPlatform();
    const cpuCores = this.detectCPUCores();
    const memoryMB = this.detectMemory();
    const gpu = await this.detectGPU();
    const supportedBackends = this.detectBackends(platform, gpu);
    const capabilities = this.detectCapabilities(gpu, supportedBackends);
    const recommendedQuality = this.selectRecommendedQuality(
      platform,
      memoryMB,
      gpu,
      capabilities,
    );
    const recommendedEngine = this.selectRecommendedEngine(
      platform,
      recommendedQuality,
      gpu,
    );

    return {
      platform,
      cpuCores,
      memoryMB,
      gpu,
      supportedBackends,
      capabilities,
      recommendedQuality,
      recommendedEngine,
    };
  }

  /**
   * Detect the current platform type.
   * @returns Detected platform
   */
  private detectPlatform(): Platform {
    if (this._isBrowser) {
      return this.detectBrowserPlatform();
    } else if (this._isNode || this._isDeno || this._isBun) {
      return "desktop";
    }
    return "desktop";
  }

  /**
   * Detect platform type in browser context.
   * @returns Detected browser platform
   */
  private detectBrowserPlatform(): Platform {
    const ua = this._userAgent.toLowerCase();

    // Mobile detection
    if (
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
    ) {
      return "mobile";
    }

    // Check for touch support
    if (this._isBrowser && "ontouchstart" in window) {
      const isTablet =
        /ipad|tablet|kindle|silk/i.test(ua) ||
        (navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
      if (isTablet) {
        return "mobile";
      }
    }

    return "web";
  }

  /**
   * Detect CPU core count.
   * @returns Number of CPU cores
   */
  private detectCPUCores(): number {
    if (this._isBrowser && navigator.hardwareConcurrency) {
      return navigator.hardwareConcurrency;
    }

    if (this._isNode && os?.cpus) {
      return os.cpus().length;
    }

    // Default to 4 cores if undetectable
    return 4;
  }

  /**
   * Detect available memory.
   * @returns Available memory in MB
   */
  private detectMemory(): number {
    if (this._isBrowser && (navigator as any).deviceMemory) {
      return (navigator as any).deviceMemory * 1024;
    }

    if (this._isNode && os?.totalmem) {
      return Math.floor(os.totalmem() / (1024 * 1024));
    }

    // Default estimation
    return 4096;
  }

  /**
   * Detect GPU information.
   * @returns GPU information
   */
  private async detectGPU(): Promise<GPUInfo> {
    if (this._isBrowser) {
      return this.detectBrowserGPU();
    }

    if (this._isNode) {
      return this.detectNodeGPU();
    }

    // Default GPU info
    return {
      vendor: "Unknown",
      model: "Unknown GPU",
      vramMB: 1024,
      featureLevel: "Unknown",
      isRTX: false,
    };
  }

  /**
   * Detect GPU in browser context.
   * @returns GPU information
   */
  private async detectBrowserGPU(): Promise<GPUInfo> {
    const info: GPUInfo = {
      vendor: "Unknown",
      model: "Unknown GPU",
      vramMB: 1024,
      featureLevel: "Unknown",
      isRTX: false,
    };

    // Try WebGL 2 context for GPU detection
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");

      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
          const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

          info.model = renderer;
          info.vendor = vendor;

          // Parse GPU info
          this.parseGPUInfo(info, renderer, vendor);
        }

        // Get WebGL version for feature level
        const version = gl.getParameter(gl.VERSION);
        info.featureLevel = version;

        // Estimate VRAM from render buffer size
        const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        const maxRenderBufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
        info.vramMB = this.estimateVRAM(maxTextureSize, maxRenderBufferSize);
      }

      canvas.remove();
    } catch (e) {
      console.warn("Failed to detect GPU:", e);
    }

    // Try WebGPU for more accurate detection
    if ("gpu" in navigator) {
      try {
        const gpu = (navigator as any).gpu;
        const adapter = await gpu.requestAdapter();
        if (adapter) {
          const features = adapter.features;
          info.isRTX = this.checkRTXSupport(info.model, features);
        }
      } catch (e) {
        // WebGPU not available
      }
    }

    return info;
  }

  /**
   * Detect GPU in Node.js context.
   * @returns GPU information
   */
  private detectNodeGPU(): GPUInfo {
    const info: GPUInfo = {
      vendor: "Unknown",
      model: "Unknown GPU",
      vramMB: 1024,
      featureLevel: "Unknown",
      isRTX: false,
    };

    // Try to read from common GPU info sources
    try {
      // Check for NVIDIA GPU
      if (this.commandExists("nvidia-smi")) {
        const output = this.executeCommand("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader");
        if (output) {
          const parts = output.split(",");
          if (parts.length >= 2) {
            info.model = parts[0].trim();
            const memoryMatch = parts[1].match(/(\d+)/);
            if (memoryMatch) {
              info.vramMB = parseInt(memoryMatch[1]);
            }
            info.vendor = "NVIDIA";
            info.isRTX = info.model.toLowerCase().includes("rtx");
          }
        }
      }

      // Check for AMD GPU on Linux
      if (info.vendor === "Unknown" && this.commandExists("rocm-smi")) {
        const output = this.executeCommand("rocm-smi --showproductname");
        if (output && output.includes("AMD")) {
          info.vendor = "AMD";
          info.model = "AMD GPU";
        }
      }

      // Check for Intel GPU
      if (info.vendor === "Unknown") {
        const lspci = this.executeCommand("lspci -nn | grep -i '\\[0300\\]'");
        if (lspci) {
          if (lspci.toLowerCase().includes("nvidia")) {
            info.vendor = "NVIDIA";
          } else if (lspci.toLowerCase().includes("amd")) {
            info.vendor = "AMD";
          } else if (lspci.toLowerCase().includes("intel")) {
            info.vendor = "Intel";
          }
        }
      }
    } catch (e) {
      // GPU detection failed
    }

    return info;
  }

  /**
   * Parse GPU information from renderer string.
   * @param info - GPU info to update
   * @param renderer - WebGL renderer string
   * @param vendor - WebGL vendor string
   */
  private parseGPUInfo(info: GPUInfo, renderer: string, vendor: string): void {
    const rendererLower = renderer.toLowerCase();

    // Detect vendor
    if (rendererLower.includes("nvidia") || vendor.toLowerCase().includes("nvidia")) {
      info.vendor = "NVIDIA";
    } else if (rendererLower.includes("amd") || rendererLower.includes("radeon") || rendererLower.includes("ati")) {
      info.vendor = "AMD";
    } else if (rendererLower.includes("intel")) {
      info.vendor = "Intel";
    } else if (rendererLower.includes("apple") && rendererLower.includes("gpu")) {
      info.vendor = "Apple";
    } else if (rendererLower.includes("adreno")) {
      info.vendor = "Qualcomm";
    } else if (rendererLower.includes("mali")) {
      info.vendor = "ARM";
    } else if (rendererLower.includes("powervr")) {
      info.vendor = "PowerVR";
    }

    // Detect RTX
    info.isRTX =
      info.vendor === "NVIDIA" &&
      (rendererLower.includes("rtx") || rendererLower.includes(" 20") || rendererLower.includes(" 30") || rendererLower.includes(" 40"));
  }

  /**
   * Estimate VRAM from WebGL limits.
   * @param maxTextureSize - Maximum texture size
   * @param maxRenderBufferSize - Maximum render buffer size
   * @returns Estimated VRAM in MB
   */
  private estimateVRAM(maxTextureSize: number, maxRenderBufferSize: number): number {
    // Rough estimation based on texture size
    // This is not accurate but gives a ballpark figure
    if (maxTextureSize >= 16384) {
      return 8192; // 8GB+
    } else if (maxTextureSize >= 8192) {
      return 4096; // 4GB+
    } else if (maxTextureSize >= 4096) {
      return 2048; // 2GB+
    } else if (maxTextureSize >= 2048) {
      return 1024; // 1GB+
    }
    return 512; // 512MB
  }

  /**
   * Check if GPU supports RTX features.
   * @param model - GPU model name
   * @param features - WebGPU features
   * @returns True if RTX is supported
   */
  private checkRTXSupport(model: string, features: Set<string>): boolean {
    const modelLower = model.toLowerCase();

    // Check model name
    if (modelLower.includes("rtx")) {
      return true;
    }

    // Check WebGPU features
    if (features && (features.has("timestamp-query") || features.has("pipeline-statistics-query"))) {
      return true;
    }

    return false;
  }

  /**
   * Detect supported rendering backends.
   * @param platform - Current platform
   * @param gpu - GPU information
   * @returns Supported rendering backends
   */
  private detectBackends(platform: Platform, gpu: GPUInfo): RenderingBackend[] {
    const backends: RenderingBackend[] = [];

    if (this._isBrowser) {
      // WebGL is always available in browser
      backends.push("webgl");

      // Check for WebGL 2
      try {
        const canvas = document.createElement("canvas");
        if (canvas.getContext("webgl2")) {
          backends.push("webgl" as RenderingBackend);
        }
        canvas.remove();
      } catch (e) {
        // WebGL 2 not available
      }

      // Check for WebGPU
      if ("gpu" in navigator) {
        backends.push("webgpu" as RenderingBackend);
      }

      // Mobile platforms might have different backends
      if (platform === "mobile") {
        // iOS uses Metal under the hood
        if (this._userAgent.includes("iPhone") || this._userAgent.includes("iPad")) {
          backends.push("metal" as RenderingBackend);
        }
      }
    } else {
      // Desktop/server platforms
      backends.push("opengl" as RenderingBackend);

      // Add platform-specific backends
      if (process?.platform === "win32") {
        backends.push("direct3d" as RenderingBackend);
      }

      // Vulkan is available on most modern systems
      if (this.commandExists("vulkaninfo") || this.commandExists("vkinfo")) {
        backends.push("vulkan" as RenderingBackend);
      }
    }

    return backends;
  }

  /**
   * Detect GPU capabilities.
   * @param gpu - GPU information
   * @param backends - Supported rendering backends
   * @returns GPU capability flags
   */
  private detectCapabilities(
    gpu: GPUInfo,
    backends: RenderingBackend[],
  ): GPUCapability[] {
    const capabilities: GPUCapability[] = [];

    // Ray tracing support
    if (gpu.isRTX || backends.includes("vulkan" as RenderingBackend)) {
      capabilities.push("ray_tracing" as GPUCapability);
    }

    // Compute shaders
    if (
      backends.includes("webgl" as RenderingBackend) ||
      backends.includes("webgpu" as RenderingBackend) ||
      backends.includes("vulkan" as RenderingBackend)
    ) {
      capabilities.push("compute_shaders" as GPUCapability);
    }

    // Geometry shaders
    if (gpu.vramMB >= 2048) {
      capabilities.push("geometry_shaders" as GPUCapability);
    }

    // Tessellation
    if (gpu.vramMB >= 4096) {
      capabilities.push("tessellation" as GPUCapability);
    }

    // HDR
    if (gpu.vramMB >= 2048) {
      capabilities.push("hdr" as GPUCapability);
    }

    // VR support
    if (gpu.vramMB >= 8192 && (gpu.vendor === "NVIDIA" || gpu.vendor === "AMD")) {
      capabilities.push("vr" as GPUCapability);
    }

    return capabilities;
  }

  /**
   * Select recommended quality tier.
   * @param platform - Current platform
   * @param memoryMB - Available memory in MB
   * @param gpu - GPU information
   * @param capabilities - GPU capabilities
   * @returns Recommended quality tier
   */
  private selectRecommendedQuality(
    platform: Platform,
    memoryMB: number,
    gpu: GPUInfo,
    capabilities: GPUCapability[],
  ): QualityTier {
    // Mobile always gets low quality
    if (platform === "mobile") {
      return "low";
    }

    // High-end hardware
    if (
      memoryMB >= 16384 &&
      gpu.vramMB >= 8192 &&
      capabilities.includes("ray_tracing" as GPUCapability)
    ) {
      return "ultra";
    }

    // Mid-to-high hardware
    if (memoryMB >= 8192 && gpu.vramMB >= 4096) {
      return "high";
    }

    // Mid-range hardware
    if (memoryMB >= 4096 && gpu.vramMB >= 2048) {
      return "medium";
    }

    // Low-end hardware
    return "low";
  }

  /**
   * Select recommended engine based on platform and quality.
   * @param platform - Current platform
   * @param quality - Recommended quality tier
   * @param gpu - GPU information
   * @returns Recommended game engine
   */
  private selectRecommendedEngine(
    platform: Platform,
    quality: QualityTier,
    gpu: GPUInfo,
  ): GameEngine {
    // Mobile gets MicroVerse
    if (platform === "mobile") {
      return "microverse";
    }

    // Low quality gets MicroVerse
    if (quality === "low") {
      return "microverse";
    }

    // Medium quality gets Luanti
    if (quality === "medium") {
      return "luanti";
    }

    // High/ultra quality gets OpenRTS if GPU is capable
    if ((quality === "high" || quality === "ultra") && gpu.vramMB >= 4096) {
      return "openrts";
    }

    // Default to Luanti
    return "luanti";
  }

  /**
   * Get user agent string.
   * @returns User agent string
   */
  private getUserAgent(): string {
    if (this._isBrowser && navigator.userAgent) {
      return navigator.userAgent;
    }
    return "";
  }

  /**
   * Check if a command exists on the system.
   * @param command - Command to check
   * @returns True if command exists
   */
  private commandExists(command: string): boolean {
    if (!this._isNode) {
      return false;
    }

    try {
      const { existsSync } = require("fs");
      const { execSync } = require("child_process");

      // Try which/uname
      try {
        execSync(`which ${command}`, { stdio: "ignore" });
        return true;
      } catch (e) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  /**
   * Execute a system command.
   * @param command - Command to execute
   * @returns Command output
   */
  private executeCommand(command: string): string {
    if (!this._isNode) {
      return "";
    }

    try {
      const { execSync } = require("child_process");
      return execSync(command, { encoding: "utf-8", stdio: "pipe" });
    } catch (e) {
      return "";
    }
  }

  /**
   * Create a capabilities profile string for caching.
   * @returns Profile string
   */
  getProfileString(): string {
    if (!this._capabilities) {
      return "unknown";
    }

    const c = this._capabilities;
    return `${c.platform}-${c.cpuCores}core-${c.memoryMB}mb-${c.gpu.vendor}-${c.gpu.vramMB}vram`;
  }

  /**
   * Get capabilities as a JSON-serializable object.
   * @returns Capabilities object
   */
  toJSON(): Record<string, unknown> | null {
    if (!this._capabilities) {
      return null;
    }

    return {
      platform: this._capabilities.platform,
      cpuCores: this._capabilities.cpuCores,
      memoryMB: this._capabilities.memoryMB,
      gpu: {
        vendor: this._capabilities.gpu.vendor,
        model: this._capabilities.gpu.model,
        vramMB: this._capabilities.gpu.vramMB,
        featureLevel: this._capabilities.gpu.featureLevel,
        isRTX: this._capabilities.gpu.isRTX,
      },
      supportedBackends: this._capabilities.supportedBackends,
      capabilities: this._capabilities.capabilities,
      recommendedQuality: this._capabilities.recommendedQuality,
      recommendedEngine: this._capabilities.recommendedEngine,
    };
  }

  /**
   * Restore capabilities from a JSON object.
   * @param data - JSON data
   */
  fromJSON(data: Record<string, unknown>): void {
    this._capabilities = {
      platform: data.platform as Platform,
      cpuCores: data.cpuCores as number,
      memoryMB: data.memoryMB as number,
      gpu: data.gpu as GPUInfo,
      supportedBackends: data.supportedBackends as RenderingBackend[],
      capabilities: data.capabilities as GPUCapability[],
      recommendedQuality: data.recommendedQuality as QualityTier,
      recommendedEngine: data.recommendedEngine as GameEngine,
    };
  }
}

// ============================================================================
// NODE.JS OS MODULE IMPORT (LAZY)
// ============================================================================

let os: typeof import("os") | null = null;

try {
  os = require("os");
} catch (e) {
  // Not in Node.js environment
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Detect platform synchronously (returns cached or default values).
 * @returns Platform capabilities (may be estimated)
 */
export function detectPlatformSync(): PlatformCapabilities {
  const detector = PlatformDetector.getInstance();
  const cached = detector.getCachedCapabilities();

  if (cached) {
    return cached;
  }

  // Return estimated capabilities without async detection
  return {
    platform: detectPlatformTypeSync(),
    cpuCores: detectCPUCoresSync(),
    memoryMB: detectMemorySync(),
    gpu: getDefaultGPUInfo(),
    supportedBackends: ["webgl" as RenderingBackend],
    capabilities: [],
    recommendedQuality: "medium",
    recommendedEngine: "luanti",
  };
}

/**
 * Detect platform type synchronously.
 * @returns Detected platform type
 */
function detectPlatformTypeSync(): Platform {
  if (typeof window !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
      return "mobile";
    }
    return "web";
  }
  return "desktop";
}

/**
 * Detect CPU cores synchronously.
 * @returns CPU core count
 */
function detectCPUCoresSync(): number {
  if (typeof window !== "undefined" && navigator.hardwareConcurrency) {
    return navigator.hardwareConcurrency;
  }
  return 4;
}

/**
 * Detect memory synchronously.
 * @returns Memory in MB
 */
function detectMemorySync(): number {
  if (typeof window !== "undefined" && (navigator as any).deviceMemory) {
    return (navigator as any).deviceMemory * 1024;
  }
  return 4096;
}

/**
 * Get default GPU info.
 * @returns Default GPU info
 */
function getDefaultGPUInfo(): GPUInfo {
  return {
    vendor: "Unknown",
    model: "Unknown GPU",
    vramMB: 1024,
    featureLevel: "Unknown",
    isRTX: false,
  };
}

/**
 * Async wrapper for platform detection.
 * @returns Promise resolving to platform capabilities
 */
export async function detectPlatform(): Promise<PlatformCapabilities> {
  const detector = PlatformDetector.getInstance();
  return detector.detect();
}

/**
 * Check if current platform is mobile.
 * @returns True if platform is mobile
 */
export function isMobile(): boolean {
  const capabilities = detectPlatformSync();
  return capabilities.platform === "mobile";
}

/**
 * Check if current platform is desktop.
 * @returns True if platform is desktop
 */
export function isDesktop(): boolean {
  const capabilities = detectPlatformSync();
  return capabilities.platform === "desktop";
}

/**
 * Check if current device has RTX GPU.
 * @returns True if GPU is RTX
 */
export async function hasRTX(): Promise<boolean> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.gpu.isRTX;
}

/**
 * Get recommended quality tier.
 * @returns Recommended quality tier
 */
export async function getRecommendedQuality(): Promise<QualityTier> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.recommendedQuality;
}

/**
 * Get recommended engine.
 * @returns Recommended game engine
 */
export async function getRecommendedEngine(): Promise<GameEngine> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.recommendedEngine;
}

/**
 * Get available VRAM in MB.
 * @returns VRAM in MB
 */
export async function getVRAM(): Promise<number> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.gpu.vramMB;
}

/**
 * Get system memory in MB.
 * @returns System memory in MB
 */
export async function getSystemMemory(): Promise<number> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.memoryMB;
}

/**
 * Get CPU core count.
 * @returns CPU core count
 */
export async function getCPUCores(): Promise<number> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.cpuCores;
}

/**
 * Get supported rendering backends.
 * @returns Array of supported rendering backends
 */
export async function getSupportedBackends(): Promise<RenderingBackend[]> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.supportedBackends;
}

/**
 * Check if a specific rendering backend is supported.
 * @param backend - Rendering backend to check
 * @returns True if backend is supported
 */
export async function supportsBackend(backend: RenderingBackend): Promise<boolean> {
  const backends = await getSupportedBackends();
  return backends.includes(backend);
}

/**
 * Check if ray tracing is supported.
 * @returns True if ray tracing is supported
 */
export async function supportsRayTracing(): Promise<boolean> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.capabilities.includes("ray_tracing" as GPUCapability);
}

/**
 * Check if WebGPU is available.
 * @returns True if WebGPU is available
 */
export function isWebGPUAvailable(): boolean {
  return "gpu" in navigator;
}

/**
 * Check if WebGL2 is available.
 * @returns True if WebGL2 is available
 */
export function isWebGL2Available(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    canvas.remove();
    return gl !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Get GPU vendor.
 * @returns GPU vendor name
 */
export async function getGPUVendor(): Promise<string> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.gpu.vendor;
}

/**
 * Get GPU model.
 * @returns GPU model name
 */
export async function getGPUModel(): Promise<string> {
  const detector = PlatformDetector.getInstance();
  const capabilities = await detector.detect();
  return capabilities.gpu.model;
}

/**
 * Get platform capabilities profile string.
 * @returns Profile string for caching
 */
export function getPlatformProfile(): string {
  const detector = PlatformDetector.getInstance();
  return detector.getProfileString();
}
