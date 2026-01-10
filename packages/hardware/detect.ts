/**
 * StudyLoG.AI - Hardware Detection
 *
 * Detects NVIDIA GPUs, Jetson devices, and Arduino boards.
 * Works on Linux, macOS, and Windows.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';

const execAsync = promisify(exec);

export interface GPUInfo {
  name: string;
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
  vramMb: number;
  driverVersion?: string;
  cudaVersion?: string;
  computeCapability?: string;
  isJetson: boolean;
}

export interface SystemInfo {
  platform: 'linux' | 'darwin' | 'win32';
  arch: string;
  ramMb: number;
  cpuCores: number;
  cpuModel: string;
}

export interface ArduinoInfo {
  port: string;
  board: string;
  serialNumber?: string;
}

export interface HardwareProfile {
  system: SystemInfo;
  gpus: GPUInfo[];
  arduino: ArduinoInfo[];
  detectedAt: string;
  tier: 'starter' | 'maker' | 'edge' | 'power' | 'pro';
  capabilities: {
    canRunOllama: boolean;
    canRunAce: boolean;
    canRunVision: boolean;
    maxModelSize: string;
    recommendedModels: string[];
  };
}

// Detect NVIDIA GPUs using nvidia-smi
async function detectNvidiaGPUs(): Promise<GPUInfo[]> {
  const gpus: GPUInfo[] = [];

  try {
    // Check if nvidia-smi exists
    const { stdout } = await execAsync(
      'nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits',
      { timeout: 10000 }
    );

    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      const [name, vram, driver, compute] = line.split(', ').map((s) => s.trim());

      // Check if this is a Jetson device
      const isJetson = name?.toLowerCase().includes('jetson') ||
        name?.toLowerCase().includes('tegra');

      gpus.push({
        name: name || 'Unknown NVIDIA GPU',
        vendor: 'nvidia',
        vramMb: parseInt(vram) || 0,
        driverVersion: driver,
        computeCapability: compute,
        isJetson,
      });
    }

    // Get CUDA version
    try {
      const { stdout: cudaOut } = await execAsync('nvcc --version', { timeout: 5000 });
      const cudaMatch = cudaOut.match(/release (\d+\.\d+)/);
      if (cudaMatch) {
        for (const gpu of gpus) {
          gpu.cudaVersion = cudaMatch[1];
        }
      }
    } catch {
      // CUDA toolkit not installed
    }
  } catch {
    // nvidia-smi not available
  }

  return gpus;
}

// Detect Jetson specifically (may have different detection path)
async function detectJetson(): Promise<GPUInfo | null> {
  try {
    // Check for Jetson-specific file
    const { stdout } = await execAsync('cat /etc/nv_tegra_release 2>/dev/null || cat /proc/device-tree/model 2>/dev/null', {
      timeout: 5000,
    });

    if (stdout.toLowerCase().includes('jetson') || stdout.toLowerCase().includes('tegra')) {
      // Get memory info from tegrastats or /proc
      let vramMb = 8192; // Default assumption

      try {
        const { stdout: memInfo } = await execAsync("cat /proc/meminfo | grep MemTotal | awk '{print $2}'");
        const totalKb = parseInt(memInfo.trim());
        // Jetson shares memory, assume ~half for GPU
        vramMb = Math.floor(totalKb / 1024 / 2);
      } catch {
        // Use default
      }

      // Determine Jetson model
      let model = 'Jetson';
      if (stdout.includes('Orin')) model = 'Jetson Orin';
      else if (stdout.includes('Xavier')) model = 'Jetson Xavier';
      else if (stdout.includes('Nano')) model = 'Jetson Nano';

      return {
        name: model,
        vendor: 'nvidia',
        vramMb,
        isJetson: true,
      };
    }
  } catch {
    // Not a Jetson
  }

  return null;
}

// Detect system information
async function detectSystem(): Promise<SystemInfo> {
  const os = await import('os');

  const info: SystemInfo = {
    platform: platform() as 'linux' | 'darwin' | 'win32',
    arch: os.arch(),
    ramMb: Math.floor(os.totalmem() / 1024 / 1024),
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
  };

  return info;
}

// Detect Arduino boards
async function detectArduino(): Promise<ArduinoInfo[]> {
  const boards: ArduinoInfo[] = [];

  try {
    // Try arduino-cli first
    const { stdout } = await execAsync('arduino-cli board list --format json', {
      timeout: 10000,
    });

    const data = JSON.parse(stdout);
    if (data.detected_ports) {
      for (const port of data.detected_ports) {
        if (port.matching_boards?.length > 0) {
          boards.push({
            port: port.port.address,
            board: port.matching_boards[0].name,
            serialNumber: port.port.properties?.serialNumber,
          });
        }
      }
    }
  } catch {
    // arduino-cli not available, try platform-specific detection
    try {
      if (platform() === 'linux') {
        const { stdout } = await execAsync('ls /dev/ttyACM* /dev/ttyUSB* 2>/dev/null || true');
        const ports = stdout.trim().split('\n').filter(Boolean);
        for (const port of ports) {
          boards.push({ port, board: 'Unknown Arduino-compatible' });
        }
      } else if (platform() === 'darwin') {
        const { stdout } = await execAsync('ls /dev/tty.usbmodem* /dev/tty.usbserial* 2>/dev/null || true');
        const ports = stdout.trim().split('\n').filter(Boolean);
        for (const port of ports) {
          boards.push({ port, board: 'Unknown Arduino-compatible' });
        }
      }
    } catch {
      // No serial ports found
    }
  }

  return boards;
}

// Determine hardware tier
function determineTier(gpus: GPUInfo[], ramMb: number): 'starter' | 'maker' | 'edge' | 'power' | 'pro' {
  const maxVram = Math.max(0, ...gpus.map((g) => g.vramMb));
  const hasJetson = gpus.some((g) => g.isJetson);

  // Check for DGX or multi-GPU setups
  const totalVram = gpus.reduce((sum, g) => sum + g.vramMb, 0);
  if (totalVram >= 48000 || gpus.some((g) => g.name.includes('DGX'))) {
    return 'pro';
  }

  // Single GPU tiers
  if (maxVram >= 16000) return 'power';
  if (hasJetson || maxVram >= 8000) return 'edge';
  if (maxVram >= 4000) return 'maker';

  return 'starter';
}

// Determine capabilities
function determineCapabilities(
  tier: string,
  gpus: GPUInfo[],
  ramMb: number
): HardwareProfile['capabilities'] {
  const maxVram = Math.max(0, ...gpus.map((g) => g.vramMb));
  const hasNvidia = gpus.some((g) => g.vendor === 'nvidia');

  const capabilities = {
    canRunOllama: ramMb >= 8192, // 8GB minimum for smallest models
    canRunAce: hasNvidia && maxVram >= 8000, // NVIDIA ACE needs 8GB VRAM
    canRunVision: maxVram >= 8000 || ramMb >= 16384,
    maxModelSize: 'none',
    recommendedModels: [] as string[],
  };

  // Determine max model size
  if (maxVram >= 48000) {
    capabilities.maxModelSize = '70B';
    capabilities.recommendedModels = ['llama3.3:70b-q4', 'qwen2.5-coder:32b'];
  } else if (maxVram >= 24000) {
    capabilities.maxModelSize = '32B';
    capabilities.recommendedModels = ['qwen2.5-coder:32b', 'codestral:22b'];
  } else if (maxVram >= 16000) {
    capabilities.maxModelSize = '22B';
    capabilities.recommendedModels = ['codestral:22b', 'llama3.3:8b'];
  } else if (maxVram >= 8000) {
    capabilities.maxModelSize = '8B';
    capabilities.recommendedModels = ['llama3.3:8b', 'qwen2.5-coder:7b'];
  } else if (maxVram >= 4000 || ramMb >= 16384) {
    capabilities.maxModelSize = '7B';
    capabilities.recommendedModels = ['llama3.3:8b', 'qwen2.5-coder:3b'];
  } else if (ramMb >= 8192) {
    capabilities.maxModelSize = '3B';
    capabilities.recommendedModels = ['llama3.2:3b', 'qwen2.5-coder:3b'];
  }

  return capabilities;
}

// Main detection function
export async function detectHardware(): Promise<HardwareProfile> {
  // Run detections in parallel
  const [system, nvidiaGpus, jetson, arduino] = await Promise.all([
    detectSystem(),
    detectNvidiaGPUs(),
    detectJetson(),
    detectArduino(),
  ]);

  // Merge GPU lists (avoid duplicates if Jetson detected both ways)
  const gpus = [...nvidiaGpus];
  if (jetson && !gpus.some((g) => g.isJetson)) {
    gpus.push(jetson);
  }

  const tier = determineTier(gpus, system.ramMb);
  const capabilities = determineCapabilities(tier, gpus, system.ramMb);

  return {
    system,
    gpus,
    arduino,
    detectedAt: new Date().toISOString(),
    tier,
    capabilities,
  };
}

// Quick check if local AI is available
export async function canRunLocalAI(): Promise<boolean> {
  const profile = await detectHardware();
  return profile.capabilities.canRunOllama;
}

// Format profile for display
export function formatProfile(profile: HardwareProfile): string {
  const lines: string[] = [];

  lines.push(`Hardware Profile (${profile.tier.toUpperCase()} tier)`);
  lines.push('─'.repeat(40));
  lines.push(`Platform: ${profile.system.platform} (${profile.system.arch})`);
  lines.push(`CPU: ${profile.system.cpuModel} (${profile.system.cpuCores} cores)`);
  lines.push(`RAM: ${(profile.system.ramMb / 1024).toFixed(1)} GB`);

  if (profile.gpus.length > 0) {
    lines.push('');
    lines.push('GPUs:');
    for (const gpu of profile.gpus) {
      const vram = (gpu.vramMb / 1024).toFixed(1);
      const jetsonTag = gpu.isJetson ? ' [Jetson]' : '';
      lines.push(`  • ${gpu.name}: ${vram} GB VRAM${jetsonTag}`);
      if (gpu.cudaVersion) {
        lines.push(`    CUDA ${gpu.cudaVersion}`);
      }
    }
  }

  if (profile.arduino.length > 0) {
    lines.push('');
    lines.push('Arduino:');
    for (const board of profile.arduino) {
      lines.push(`  • ${board.board} on ${board.port}`);
    }
  }

  lines.push('');
  lines.push('Capabilities:');
  lines.push(`  • Local AI: ${profile.capabilities.canRunOllama ? 'Yes' : 'No'}`);
  lines.push(`  • NVIDIA ACE: ${profile.capabilities.canRunAce ? 'Yes' : 'No'}`);
  lines.push(`  • Vision Models: ${profile.capabilities.canRunVision ? 'Yes' : 'No'}`);
  lines.push(`  • Max Model Size: ${profile.capabilities.maxModelSize}`);

  if (profile.capabilities.recommendedModels.length > 0) {
    lines.push('');
    lines.push('Recommended Models:');
    for (const model of profile.capabilities.recommendedModels) {
      lines.push(`  • ${model}`);
    }
  }

  return lines.join('\n');
}
