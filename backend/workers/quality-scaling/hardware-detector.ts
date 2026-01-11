/**
 * Hardware Detection Module
 *
 * Detects GPU and system capabilities to determine quality constraints.
 * Works with both server-side (via system commands) and client-side
 * (via browser APIs) detection.
 *
 * @fileoverview Hardware capability detection system
 */

import type {
  GPUCapabilities,
  SystemCapabilities,
  HardwareProfile,
  HardwareTier,
  DetectHardwareRequest,
} from './types.js';

// ============================================================================
// GPU Database for Client-Side Detection
// ============================================================================

/**
 * Known GPU models with their performance characteristics.
 * Used for estimating capabilities when direct detection isn't available.
 */
const GPU_DATABASE: Record<string, Partial<GPUCapabilities>> = {
  // NVIDIA GPUs
  'rtx 4090': {
    tier: 4,
    estimatedTFLOPS: 83,
    supportsRayTracing: true,
    vramMb: 24576,
  },
  'rtx 4080': {
    tier: 4,
    estimatedTFLOPS: 48,
    supportsRayTracing: true,
    vramMb: 16384,
  },
  'rtx 4070': {
    tier: 3,
    estimatedTFLOPS: 29,
    supportsRayTracing: true,
    vramMb: 12288,
  },
  'rtx 4060': {
    tier: 3,
    estimatedTFLOPS: 16,
    supportsRayTracing: true,
    vramMb: 8192,
  },
  'rtx 3090': {
    tier: 4,
    estimatedTFLOPS: 36,
    supportsRayTracing: true,
    vramMb: 24576,
  },
  'rtx 3080': {
    tier: 3,
    estimatedTFLOPS: 30,
    supportsRayTracing: true,
    vramMb: 10240,
  },
  'rtx 3070': {
    tier: 3,
    estimatedTFLOPS: 20,
    supportsRayTracing: true,
    vramMb: 8192,
  },
  'rtx 3060': {
    tier: 2,
    estimatedTFLOPS: 13,
    supportsRayTracing: true,
    vramMb: 12288,
  },
  'gtx 1660': {
    tier: 2,
    estimatedTFLOPS: 5,
    supportsRayTracing: false,
    vramMb: 6144,
  },
  'gtx 1650': {
    tier: 1,
    estimatedTFLOPS: 3,
    supportsRayTracing: false,
    vramMb: 4096,
  },

  // AMD GPUs
  'rx 7900 xtx': {
    tier: 4,
    estimatedTFLOPS: 61,
    supportsRayTracing: true,
    vramMb: 24576,
  },
  'rx 7900 xt': {
    tier: 4,
    estimatedTFLOPS: 51,
    supportsRayTracing: true,
    vramMb: 20480,
  },
  'rx 7800 xt': {
    tier: 3,
    estimatedTFLOPS: 30,
    supportsRayTracing: true,
    vramMb: 16384,
  },
  'rx 6700 xt': {
    tier: 2,
    estimatedTFLOPS: 16,
    supportsRayTracing: true,
    vramMb: 12288,
  },
  'rx 6600': {
    tier: 2,
    estimatedTFLOPS: 9,
    supportsRayTracing: true,
    vramMb: 8192,
  },

  // Intel GPUs
  'arc a770': {
    tier: 2,
    estimatedTFLOPS: 16,
    supportsRayTracing: true,
    vramMb: 16384,
  },
  'arc a750': {
    tier: 2,
    estimatedTFLOPS: 12,
    supportsRayTracing: true,
    vramMb: 8192,
  },
  'iris xe': {
    tier: 1,
    estimatedTFLOPS: 2,
    supportsRayTracing: false,
    vramMb: 0, // Shared memory
  },
  'uhd graphics': {
    tier: 0,
    estimatedTFLOPS: 0.5,
    supportsRayTracing: false,
    vramMb: 0,
  },

  // Apple GPUs
  'm3 max': {
    tier: 4,
    estimatedTFLOPS: 18,
    supportsRayTracing: false,
    vramMb: 0, // Unified memory
  },
  'm3 pro': {
    tier: 3,
    estimatedTFLOPS: 12,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm3': {
    tier: 2,
    estimatedTFLOPS: 8,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm2 max': {
    tier: 3,
    estimatedTFLOPS: 14,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm2 pro': {
    tier: 2,
    estimatedTFLOPS: 10,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm2': {
    tier: 2,
    estimatedTFLOPS: 6,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm1 max': {
    tier: 2,
    estimatedTFLOPS: 10,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm1 pro': {
    tier: 2,
    estimatedTFLOPS: 7,
    supportsRayTracing: false,
    vramMb: 0,
  },
  'm1': {
    tier: 1,
    estimatedTFLOPS: 4,
    supportsRayTracing: false,
    vramMb: 0,
  },

  // Mobile GPUs
  'adreno 740': {
    tier: 2,
    estimatedTFLOPS: 3,
    supportsRayTracing: false,
    vramMb: 0,
    isMobile: true,
  },
  'adreno 650': {
    tier: 1,
    estimatedTFLOPS: 1.5,
    supportsRayTracing: false,
    vramMb: 0,
    isMobile: true,
  },
  'mali-g710': {
    tier: 1,
    estimatedTFLOPS: 1.5,
    supportsRayTracing: false,
    vramMb: 0,
    isMobile: true,
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize GPU name for database lookup.
 */
function normalizeGpuName(name: string): string {
  return name
    .toLowerCase()
    .replace(/nvidia |geforce |radeon |amd |intel |graphics |gpu |/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find GPU in database by name pattern matching.
 */
function findInDatabase(gpuName: string): Partial<GPUCapabilities> | null {
  const normalized = normalizeGpuName(gpuName);

  // Try exact match first
  for (const [key, value] of Object.entries(GPU_DATABASE)) {
    if (normalized === key.toLowerCase()) {
      return value;
    }
  }

  // Try partial match
  for (const [key, value] of Object.entries(GPU_DATABASE)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return value;
    }
  }

  return null;
}

/**
 * Detect GPU vendor from renderer string.
 */
function detectVendor(renderer: string): GPUCapabilities['vendor'] {
  const lower = renderer.toLowerCase();

  if (lower.includes('nvidia') || lower.includes('geforce') || lower.includes('quadro') || lower.includes('tesla')) {
    return 'nvidia';
  }
  if (lower.includes('amd') || lower.includes('radeon') || lower.includes('advanced micro')) {
    return 'amd';
  }
  if (lower.includes('intel') || lower.includes('iris') || lower.includes('uhd')) {
    return 'intel';
  }
  if (lower.includes('apple')) {
    return 'apple';
  }
  if (lower.includes('adreno') || lower.includes('qualcomm')) {
    return 'qualcomm';
  }

  return 'unknown';
}

/**
 * Estimate VRAM from GPU name.
 */
function estimateVRAM(gpuName: string): number {
  const dbEntry = findInDatabase(gpuName);
  if (dbEntry?.vramMb) {
    return dbEntry.vramMb;
  }

  // Heuristic estimates based on naming
  const lower = gpuName.toLowerCase();

  // High-end cards typically have more VRAM
  if (lower.includes('4090') || lower.includes('3090') || lower.includes('a100')) return 24576;
  if (lower.includes('4080') || lower.includes('3080') || lower.includes('7900')) return 16384;
  if (lower.includes('4070') || lower.includes('3070') || lower.includes('7800')) return 12288;
  if (lower.includes('4060') || lower.includes('3060') || lower.includes('6700')) return 8192;
  if (lower.includes('1660') || lower.includes('2060') || lower.includes('6600')) return 6144;
  if (lower.includes('1650') || lower.includes('1050') || lower.includes('6500')) return 4096;

  // Default estimate for unknown GPUs
  return 4096;
}

/**
 * Estimate GPU tier based on name and vendor.
 */
function estimateGpuTier(gpuName: string, vendor: GPUCapabilities['vendor']): HardwareTier {
  const dbEntry = findInDatabase(gpuName);
  if (dbEntry?.tier !== undefined) {
    return dbEntry.tier as HardwareTier;
  }

  const lower = gpuName.toLowerCase();

  // Enthusiast tier
  if (/(4090|3090|a100|h100|a770m)/i.test(lower)) return 4;

  // High-end tier
  if (/(40[78]|30[78]|7900|7800|m3 max|m2 max)/i.test(lower)) return 3;

  // Mid-range tier
  if (/(4060|30[56]|6700|6600|arc a7|m[12])/i.test(lower)) return 2;

  // Entry tier
  if (/(1650|1660|1050|2050|iris xe|adreno 7|m1)/i.test(lower)) return 1;

  // Minimal tier (integrated, older)
  return 0;
}

/**
 * Check if GPU supports ray tracing.
 */
function hasRayTracing(gpuName: string, vendor: GPUCapabilities['vendor']): boolean {
  const dbEntry = findInDatabase(gpuName);
  if (dbEntry?.supportsRayTracing !== undefined) {
    return dbEntry.supportsRayTracing;
  }

  const lower = gpuName.toLowerCase();

  // NVIDIA RTX series
  if (vendor === 'nvidia' && /rtx/i.test(lower)) return true;
  if (vendor === 'nvidia' && /40[0-9]|30[0-9]/i.test(lower)) return true;

  // AMD RX 6000/7000 series
  if (vendor === 'amd' && /rx (6[789][0-9]|7[0-9]{2})/i.test(lower)) return true;

  // Intel Arc
  if (vendor === 'intel' && /arc/i.test(lower)) return true;

  return false;
}

/**
 * Estimate TFLOPS for a GPU.
 */
function estimateTFLOPS(gpuName: string, vendor: GPUCapabilities['vendor']): number {
  const dbEntry = findInDatabase(gpuName);
  if (dbEntry?.estimatedTFLOPS !== undefined) {
    return dbEntry.estimatedTFLOPS;
  }

  const tier = estimateGpuTier(gpuName, vendor);

  // Rough estimates based on tier
  switch (tier) {
    case 4: return 50;  // Enthusiast
    case 3: return 25;  // High-end
    case 2: return 10;  // Mid-range
    case 1: return 3;   // Entry
    default: return 1;  // Minimal
  }
}

/**
 * Check if this is a mobile/embedded GPU.
 */
function isMobileGpu(gpuName: string, vendor: GPUCapabilities['vendor']): boolean {
  const dbEntry = findInDatabase(gpuName);
  if (dbEntry?.isMobile !== undefined) {
    return dbEntry.isMobile;
  }

  const lower = gpuName.toLowerCase();

  // Mobile GPU indicators
  if (/adreno|mali|powervr|apple gpu/i.test(lower)) return true;
  if (vendor === 'qualcomm') return true;
  if (/mobile|notebook|laptop/i.test(lower)) return true;

  return false;
}

/**
 * Check if this is a Jetson or embedded device.
 */
function isEmbeddedDevice(systemInfo?: Partial<SystemCapabilities>): boolean {
  if (!systemInfo) return false;

  const lower = (systemInfo.platform || '').toLowerCase();
  const modelLower = (systemInfo.cpuModel || '').toLowerCase();

  return /jetson|tegra|emmc|arm64.*nvidia/i.test(lower) ||
         /jetson|tegra/xi.test(modelLower);
}

/**
 * Determine supported graphics APIs.
 */
function detectAPIs(webglVersion?: string, webgpuVersion?: string): GPUCapabilities['apis'] {
  return {
    webgl2: !!webglVersion && parseFloat(webglVersion) >= 2,
    webgpu: !!webgpuVersion,
  };
}

/**
 * Create a hardware fingerprint for caching.
 */
function createFingerprint(gpu: GPUCapabilities, system: SystemCapabilities): string {
  const data = `${gpu.vendor}:${gpu.name}:${gpu.vramMb}:${system.platform}:${system.cpuCores}:${system.ramMb}`;
  // Simple hash (in production, use a proper hash function)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// ============================================================================
// Client-Side Detection (from browser info)
// ============================================================================

/**
 * Detect GPU capabilities from client-provided WebGL info.
 */
export function detectGPUFromClient(request: DetectHardwareRequest): GPUCapabilities {
  const gpuInfo = request.clientGpuInfo;
  const renderer = (gpuInfo?.renderer || '').toLowerCase();

  const vendor = detectVendor(renderer);
  const gpuName = gpuInfo?.renderer || 'Unknown GPU';

  const tier = estimateGpuTier(gpuName, vendor);
  const vramMb = estimateVRAM(gpuName);
  const mobile = isMobileGpu(gpuName, vendor);
  const embedded = isEmbeddedDevice(request.clientSystemInfo);

  return {
    vendor,
    name: gpuName,
    vramMb,
    tier,
    supportsRayTracing: hasRayTracing(gpuName, vendor),
    estimatedTFLOPS: estimateTFLOPS(gpuName, vendor),
    apis: detectAPIs(gpuInfo?.webglVersion, gpuInfo?.webgpuVersion),
    isMobile: mobile,
    isEmbedded: embedded,
  };
}

/**
 * Detect system capabilities from client-provided info.
 */
export function detectSystemFromClient(request: DetectHardwareRequest): SystemCapabilities {
  const sysInfo = request.clientSystemInfo || {};
  const netInfo = request.networkInfo || {};

  // Determine platform
  let platform: SystemCapabilities['platform'] = 'unknown';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('windows')) platform = 'windows';
    else if (ua.includes('mac')) platform = 'macos';
    else if (ua.includes('linux')) platform = 'linux';
    else if (ua.includes('android')) platform = 'android';
    else if (ua.includes('iphone') || ua.includes('ipad')) platform = 'ios';
  }
  if (sysInfo.platform) {
    const p = sysInfo.platform.toLowerCase();
    if (p.includes('win')) platform = 'windows';
    else if (p.includes('mac') || p.includes('darwin')) platform = 'macos';
    else if (p.includes('linux')) platform = 'linux';
    else if (p.includes('android')) platform = 'android';
    else if (p.includes('ios') || p.includes('iphone')) platform = 'ios';
  }

  // Estimate RAM (use provided or default)
  const ramMb = sysInfo.memory || 8192;

  // Determine CPU tier based on cores
  const cpuCores = sysInfo.cores || navigator.hardwareConcurrency || 4;
  let cpuTier: HardwareTier;
  if (cpuCores >= 16) cpuTier = 4;
  else if (cpuCores >= 12) cpuTier = 3;
  else if (cpuCores >= 8) cpuTier = 2;
  else if (cpuCores >= 4) cpuTier = 1;
  else cpuTier = 0;

  // Determine network type
  let networkType: SystemCapabilities['networkType'] = 'wifi';
  if (netInfo.type === 'cellular' || netInfo.effectiveType) {
    const effective = netInfo.effectiveType?.toLowerCase() || '';
    if (effective.includes('2g') || effective.includes('slow-2g')) networkType = 'slow';
    else if (effective.includes('3g')) networkType = '3g';
    else if (effective.includes('4g')) networkType = '4g';
    else networkType = '3g';
  } else if (!netInfo.downlink && typeof navigator !== 'undefined' && !navigator.onLine) {
    networkType = 'offline';
  }

  return {
    platform,
    arch: 'x64', // Assume x64 for now
    ramMb,
    cpuCores,
    cpuModel: sysInfo.platform || 'Unknown CPU',
    cpuTier,
    storageMb: 1024 * 1024, // Assume 1TB available
    networkType,
    estimatedBandwidth: netInfo.downlink || 50, // Default to 50 Mbps
  };
}

// ============================================================================
// Server-Side Detection (via system commands)
// ============================================================================

/**
 * Detect NVIDIA GPUs using nvidia-smi command.
 * This is a stub implementation - actual implementation would use exec().
 */
export async function detectNvidiaGPUs(): Promise<GPUCapabilities[]> {
  const gpus: GPUCapabilities[] = [];

  // In a real implementation, we would exec 'nvidia-smi' here
  // For now, return empty array as this runs in Cloudflare Workers
  // where system commands aren't available

  /*
  try {
    const { stdout } = await exec('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits');
    const lines = stdout.trim().split('\n');

    for (const line of lines) {
      const [name, vram] = line.split(', ').map(s => s.trim());
      gpus.push({
        vendor: 'nvidia',
        name,
        vramMb: parseInt(vram) || 0,
        tier: estimateGpuTier(name, 'nvidia'),
        supportsRayTracing: hasRayTracing(name, 'nvidia'),
        estimatedTFLOPS: estimateTFLOPS(name, 'nvidia'),
        apis: { webgl2: true, webgpu: true },
        isMobile: false,
        isEmbedded: name.toLowerCase().includes('jetson'),
      });
    }
  } catch {
    // nvidia-smi not available
  }
  */

  return gpus;
}

/**
 * Detect system information server-side.
 * Stub implementation for Cloudflare Workers.
 */
export async function detectSystemInfo(): Promise<SystemCapabilities> {
  // In a real server environment, we would read /proc/meminfo, /proc/cpuinfo, etc.
  // For Cloudflare Workers, we return minimal info

  return {
    platform: 'linux',
    arch: 'x64',
    ramMb: 16384, // Assume 16GB for server
    cpuCores: 8,
    cpuModel: 'Unknown Server CPU',
    cpuTier: 2,
    storageMb: 1024 * 100, // Assume 100GB available
    networkType: 'ethernet',
    estimatedBandwidth: 1000, // 1 Gbps
  };
}

// ============================================================================
// Main Detection Functions
// ============================================================================

/**
 * Create a complete hardware profile from a detection request.
 */
export async function detectHardware(request: DetectHardwareRequest): Promise<HardwareProfile> {
  // Detect GPU capabilities
  const gpu = detectGPUFromClient(request);

  // Detect system capabilities
  const system = detectSystemFromClient(request);

  // Determine overall tier (minimum of GPU and CPU tiers)
  const overallTier = Math.min(gpu.tier, system.cpuTier) as HardwareTier;

  // Create fingerprint for caching
  const fingerprint = createFingerprint(gpu, system);

  return {
    gpu,
    system,
    overallTier,
    detectedAt: new Date().toISOString(),
    fingerprint,
  };
}

/**
 * Quick hardware tier detection without full profile.
 * Useful for fast initial quality decisions.
 */
export async function detectHardwareTier(request: DetectHardwareRequest): Promise<HardwareTier> {
  const profile = await detectHardware(request);
  return profile.overallTier;
}

/**
 * Check if hardware supports a specific quality tier.
 */
export function supportsQualityTier(profile: HardwareProfile, tier: number): boolean {
  return profile.overallTier >= tier;
}

/**
 * Get the maximum quality tier supported by hardware.
 */
export function getMaxQualityTier(profile: HardwareProfile): number {
  // Hardware tier maps directly to quality tier for most cases
  // but we can add constraints for specific hardware

  let maxTier = profile.overallTier;

  // Mobile devices cap at MEDIUM usually
  if (profile.gpu.isMobile) {
    maxTier = Math.min(maxTier, 2);
  }

  // Embedded devices (Jetson) cap at HIGH
  if (profile.gpu.isEmbedded) {
    maxTier = Math.min(maxTier, 3);
  }

  // Low memory systems cap at LOW
  if (profile.system.ramMb < 4096) {
    maxTier = Math.min(maxTier, 1);
  }

  return maxTier;
}

/**
 * Estimate if hardware can handle ray tracing.
 */
export function canHandleRayTracing(profile: HardwareProfile): boolean {
  return profile.gpu.supportsRayTracing && profile.overallTier >= 3;
}

/**
 * Estimate appropriate draw distance for hardware.
 */
export function getDrawDistance(profile: HardwareProfile): number {
  const tier = profile.overallTier;

  switch (tier) {
    case 4: return 500;  // Enthusiast: 500m
    case 3: return 300;  // High-end: 300m
    case 2: return 200;  // Mid-range: 200m
    case 1: return 100;  // Entry: 100m
    default: return 50;  // Minimal: 50m
  }
}

/**
 * Estimate maximum particle count for hardware.
 */
export function getMaxParticles(profile: HardwareProfile): number {
  const tier = profile.overallTier;

  switch (tier) {
    case 4: return 50000;
    case 3: return 20000;
    case 2: return 10000;
    case 1: return 5000;
    default: return 1000;
  }
}

/**
 * Get hardware capability summary string.
 */
export function formatHardwareProfile(profile: HardwareProfile): string {
  const lines: string[] = [];

  lines.push('Hardware Profile');
  lines.push('='.repeat(40));
  lines.push(`Overall Tier: ${HardwareTier[profile.overallTier]?.toUpperCase() || 'UNKNOWN'}`);
  lines.push('');
  lines.push('GPU:');
  lines.push(`  ${profile.gpu.vendor.toUpperCase()}: ${profile.gpu.name}`);
  lines.push(`  VRAM: ${(profile.gpu.vramMb / 1024).toFixed(1)} GB`);
  lines.push(`  Ray Tracing: ${profile.gpu.supportsRayTracing ? 'Yes' : 'No'}`);
  lines.push(`  Mobile: ${profile.gpu.isMobile ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push('System:');
  lines.push(`  Platform: ${profile.system.platform}`);
  lines.push(`  RAM: ${(profile.system.ramMb / 1024).toFixed(1)} GB`);
  lines.push(`  CPU Cores: ${profile.system.cpuCores}`);
  lines.push(`  Network: ${profile.system.networkType}`);

  return lines.join('\n');
}
