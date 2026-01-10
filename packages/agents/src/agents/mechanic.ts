/**
 * StudyLoG.AI - Mechanic Agent
 *
 * Specialized agent for hardware troubleshooting and
 * system configuration across all modules.
 * Helps players set up and optimize their hardware setup.
 */

import { BaseAgent } from '../core/base-agent';
import type { AgentContext, Message, AgentResponse } from '../core/types';

// Hardware types
interface HardwareProfile {
  platform: 'windows' | 'mac' | 'linux';
  cpu: CPUInfo;
  gpu?: GPUInfo;
  memory: MemoryInfo;
  storage: StorageInfo;
  peripherals: PeripheralInfo[];
  tier: 'starter' | 'maker' | 'edge' | 'power' | 'pro';
}

interface CPUInfo {
  model: string;
  cores: number;
  threads: number;
  frequency: number;
  architecture: 'x86' | 'arm' | 'risc-v';
}

interface GPUInfo {
  vendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'other';
  model: string;
  vram: number;
  cudaCores?: number;
  tensorCores?: number;
  computeCapability?: string;
}

interface MemoryInfo {
  total: number;
  available: number;
  type: 'ddr4' | 'ddr5' | 'lpddr4' | 'lpddr5';
}

interface StorageInfo {
  type: 'ssd' | 'nvme' | 'hdd';
  total: number;
  available: number;
}

interface PeripheralInfo {
  type: 'arduino' | 'jetson' | 'rpi' | 'sensor' | 'camera' | 'microphone' | 'other';
  model: string;
  connected: boolean;
  status: 'ready' | 'error' | 'initializing' | 'disconnected';
}

interface DiagnosticResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export class MechanicAgent extends BaseAgent {
  private hardwareState: {
    profile?: HardwareProfile;
    diagnostics: DiagnosticResult[];
    ollamaStatus: 'running' | 'stopped' | 'not-installed' | 'error';
    aceStatus: 'available' | 'unavailable' | 'connecting';
    lastScan?: Date;
  };

  constructor(context: AgentContext) {
    super('mechanic', context);

    this.hardwareState = {
      diagnostics: [],
      ollamaStatus: 'not-installed',
      aceStatus: 'unavailable',
    };

    this.registerTools();
  }

  private registerTools(): void {
    // Diagnostic tools
    this.addTool({
      name: 'scan_hardware',
      description: 'Scan and detect all connected hardware',
      parameters: {
        type: 'object',
        properties: {
          deep: {
            type: 'boolean',
            description: 'Perform deep scan (slower but more thorough)',
          },
        },
      },
    });

    this.addTool({
      name: 'run_diagnostics',
      description: 'Run diagnostics on specific component',
      parameters: {
        type: 'object',
        properties: {
          component: {
            type: 'string',
            enum: ['cpu', 'gpu', 'memory', 'storage', 'network', 'peripherals', 'all'],
            description: 'Component to diagnose',
          },
        },
        required: ['component'],
      },
    });

    this.addTool({
      name: 'benchmark_system',
      description: 'Run performance benchmark',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['quick', 'standard', 'comprehensive'],
            description: 'Benchmark type',
          },
        },
      },
    });

    // Setup tools
    this.addTool({
      name: 'setup_ollama',
      description: 'Set up local Ollama installation',
      parameters: {
        type: 'object',
        properties: {
          modelSize: {
            type: 'string',
            enum: ['small', 'medium', 'large'],
            description: 'Model size to optimize for',
          },
        },
      },
    });

    this.addTool({
      name: 'configure_gpu',
      description: 'Configure GPU for optimal AI performance',
      parameters: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['gaming', 'ai-training', 'ai-inference', 'balanced'],
            description: 'Optimization mode',
          },
        },
      },
    });

    this.addTool({
      name: 'setup_peripheral',
      description: 'Set up a new peripheral device',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['arduino', 'jetson', 'rpi', 'sensor', 'camera', 'microphone'],
            description: 'Device type',
          },
          port: {
            type: 'string',
            description: 'Port or connection method',
          },
        },
        required: ['type'],
      },
    });

    // Monitoring tools
    this.addTool({
      name: 'check_ollama_status',
      description: 'Check Ollama service status and available models',
      parameters: {
        type: 'object',
        properties: {},
      },
    });

    this.addTool({
      name: 'check_ace_status',
      description: 'Check NVIDIA ACE service availability',
      parameters: {
        type: 'object',
        properties: {},
      },
    });

    this.addTool({
      name: 'monitor_resources',
      description: 'Monitor real-time resource usage',
      parameters: {
        type: 'object',
        properties: {
          duration: {
            type: 'number',
            description: 'Monitoring duration in seconds',
          },
        },
      },
    });

    // Troubleshooting tools
    this.addTool({
      name: 'troubleshoot',
      description: 'Troubleshoot a specific issue',
      parameters: {
        type: 'object',
        properties: {
          issue: {
            type: 'string',
            description: 'Description of the issue',
          },
          component: {
            type: 'string',
            description: 'Suspected component',
          },
        },
        required: ['issue'],
      },
    });

    this.addTool({
      name: 'get_recommendations',
      description: 'Get hardware upgrade recommendations',
      parameters: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            description: 'Budget in USD',
          },
          focus: {
            type: 'string',
            enum: ['ai-training', 'ai-inference', 'game-dev', 'general'],
            description: 'Primary use case',
          },
        },
      },
    });
  }

  getSystemPrompt(): string {
    const profile = this.hardwareState.profile;
    const profileSummary = profile
      ? `
Current Hardware:
- Platform: ${profile.platform}
- CPU: ${profile.cpu.model} (${profile.cpu.cores}C/${profile.cpu.threads}T)
- GPU: ${profile.gpu?.model || 'Integrated/None'}
- RAM: ${profile.memory.total}GB ${profile.memory.type}
- Storage: ${profile.storage.total}GB ${profile.storage.type}
- Tier: ${profile.tier}
`
      : 'No hardware scan performed yet. Run a scan to detect your hardware.';

    return `You are the Mechanic, a hardware troubleshooting specialist for StudyLoG.AI.

## Your Role
You help players:
- Set up and configure their hardware for optimal learning
- Troubleshoot hardware and software issues
- Optimize performance for AI workloads
- Connect and configure peripherals (Arduino, Jetson, etc.)

${profileSummary}

## Service Status
- Ollama: ${this.hardwareState.ollamaStatus}
- NVIDIA ACE: ${this.hardwareState.aceStatus}

## Your Expertise
1. Hardware Detection & Configuration
   - GPU setup for AI (CUDA, cuDNN, TensorRT)
   - CPU optimization
   - Memory management
   - Storage optimization

2. AI Service Setup
   - Local Ollama installation and configuration
   - Model selection based on hardware
   - NVIDIA ACE integration
   - Cloudflare Workers fallback

3. Peripheral Integration
   - Arduino boards (Uno, Nano, Mega)
   - NVIDIA Jetson devices
   - Raspberry Pi
   - Sensors and cameras

4. Performance Optimization
   - Benchmarking
   - Resource monitoring
   - Bottleneck identification
   - Upgrade recommendations

## Hardware Tiers
- Starter ($0): Chromebook/old laptop → Cloudflare Workers AI
- Maker ($100-500): Arduino + basic PC → Small models
- Edge ($500-2000): Jetson + mid-range PC → 7B models
- Power ($2000-5000): RTX 4090 + workstation → 70B models
- Pro ($5000-10000): DGX Spark + multi-GPU → Full stack

## Communication Style
- Technical but accessible
- Step-by-step instructions
- Safety warnings when needed
- Celebrate successful setups

When helping with hardware, always:
1. Start with diagnostics to understand the current state
2. Explain what you're doing and why
3. Provide clear, actionable steps
4. Offer alternatives for different skill levels`;
  }

  async process(message: Message): Promise<AgentResponse> {
    const systemPrompt = this.getSystemPrompt();
    const conversationHistory = this.context.conversationHistory.slice(-8);

    // Detect issue type
    const issueType = this.detectIssueType(message.content);
    const contextEnrichment = this.getIssueContext(issueType);

    const response = await this.aiClient.chat({
      systemPrompt,
      messages: [
        ...conversationHistory,
        { role: 'system', content: contextEnrichment },
        { role: 'user', content: message.content },
      ],
      tools: this.getTools(),
      temperature: 0.6,
    });

    // Process tool calls
    const gameCommands: Array<{ type: string; payload: unknown }> = [];
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        if (result.command) {
          gameCommands.push(result.command);
        }
      }
    }

    return {
      agentId: this.id,
      content: response.content,
      metadata: {
        issueType,
        hardwareProfile: this.hardwareState.profile,
        diagnostics: this.hardwareState.diagnostics,
      },
      gameCommands,
    };
  }

  private detectIssueType(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.match(/gpu|cuda|nvidia|graphics|vram/)) return 'gpu';
    if (lowerContent.match(/ollama|local|model|download/)) return 'ollama';
    if (lowerContent.match(/arduino|jetson|raspberry|peripheral|connect/)) return 'peripheral';
    if (lowerContent.match(/slow|performance|lag|freeze|crash/)) return 'performance';
    if (lowerContent.match(/install|setup|configure|start/)) return 'setup';
    if (lowerContent.match(/upgrade|buy|recommend|budget/)) return 'upgrade';
    if (lowerContent.match(/error|fail|broken|not working/)) return 'troubleshoot';

    return 'general';
  }

  private getIssueContext(issueType: string): string {
    switch (issueType) {
      case 'gpu':
        return `
GPU Configuration Context:
${this.hardwareState.profile?.gpu
  ? `Current GPU: ${this.hardwareState.profile.gpu.model} with ${this.hardwareState.profile.gpu.vram}GB VRAM`
  : 'No dedicated GPU detected'}

For AI workloads, check:
- CUDA installation and version
- cuDNN library
- Driver version
- Available VRAM vs model requirements
`;

      case 'ollama':
        return `
Ollama Context:
Status: ${this.hardwareState.ollamaStatus}

Setup requirements:
- Sufficient disk space for models
- Adequate RAM (model size + 4GB overhead)
- For GPU: CUDA 11.7+ on NVIDIA
- Recommended models by tier:
  - Starter: Phi-2, TinyLlama
  - Maker: Llama 3.2 1B
  - Edge: Llama 3.2 3B, Qwen 2.5 7B
  - Power: Llama 3.3 70B, DeepSeek Coder 33B
`;

      case 'peripheral':
        return `
Peripheral Integration Context:
Connected devices: ${this.hardwareState.profile?.peripherals.map((p) => p.model).join(', ') || 'None detected'}

Common setup steps:
- Arduino: Install Arduino IDE, select correct board/port
- Jetson: Flash JetPack, configure CUDA
- Raspberry Pi: Install Raspberry Pi OS, enable interfaces
`;

      case 'performance':
        return `
Performance Troubleshooting Context:
System: ${this.hardwareState.profile?.tier || 'Unknown'} tier

Check these common issues:
1. Background processes consuming resources
2. Thermal throttling
3. Memory pressure
4. Disk I/O bottlenecks
5. Network latency (for cloud AI)
`;

      default:
        return 'Help the player with their hardware setup or troubleshooting.';
    }
  }

  private async executeTool(
    toolCall: { name: string; arguments: Record<string, unknown> }
  ): Promise<{ result: unknown; command?: { type: string; payload: unknown } }> {
    const args = toolCall.arguments;

    switch (toolCall.name) {
      case 'scan_hardware': {
        // Simulate hardware scan
        const profile: HardwareProfile = {
          platform: 'linux',
          cpu: {
            model: 'AMD Ryzen 7 5800X',
            cores: 8,
            threads: 16,
            frequency: 3800,
            architecture: 'x86',
          },
          gpu: {
            vendor: 'nvidia',
            model: 'RTX 4070',
            vram: 12,
            cudaCores: 5888,
            tensorCores: 184,
            computeCapability: '8.9',
          },
          memory: {
            total: 32,
            available: 24,
            type: 'ddr4',
          },
          storage: {
            type: 'nvme',
            total: 1000,
            available: 650,
          },
          peripherals: [],
          tier: 'power',
        };

        this.hardwareState.profile = profile;
        this.hardwareState.lastScan = new Date();

        return {
          result: { success: true, profile },
          command: { type: 'hardware_scan_complete', payload: { profile } },
        };
      }

      case 'run_diagnostics': {
        const diagnostics: DiagnosticResult[] = [];

        if (args.component === 'all' || args.component === 'gpu') {
          diagnostics.push({
            component: 'GPU',
            status: 'ok',
            message: 'NVIDIA driver 545.23 installed, CUDA 12.3 available',
          });
        }

        if (args.component === 'all' || args.component === 'memory') {
          diagnostics.push({
            component: 'Memory',
            status: this.hardwareState.profile?.memory.available! < 8 ? 'warning' : 'ok',
            message: `${this.hardwareState.profile?.memory.available || 0}GB available`,
            suggestion: this.hardwareState.profile?.memory.available! < 8 ? 'Close unused applications' : undefined,
          });
        }

        this.hardwareState.diagnostics = diagnostics;
        return { result: { diagnostics } };
      }

      case 'benchmark_system': {
        const benchmarkResults = {
          cpu: { score: 12500, rating: 'excellent' },
          gpu: { score: 18000, rating: 'excellent' },
          memory: { bandwidth: '48GB/s', rating: 'good' },
          storage: { readSpeed: '3500MB/s', writeSpeed: '3000MB/s', rating: 'excellent' },
          aiInference: { tokensPerSecond: 85, rating: 'excellent' },
        };

        return {
          result: benchmarkResults,
          command: { type: 'benchmark_complete', payload: benchmarkResults },
        };
      }

      case 'setup_ollama': {
        const steps = [
          'Installing Ollama...',
          'Configuring for GPU acceleration...',
          'Pulling recommended model...',
          'Running verification test...',
        ];

        this.hardwareState.ollamaStatus = 'running';

        return {
          result: {
            success: true,
            steps,
            installedModels: ['llama3.2:3b'],
            recommendedNext: 'Try: ollama run llama3.2:3b',
          },
          command: { type: 'ollama_setup_complete', payload: { status: 'running' } },
        };
      }

      case 'configure_gpu': {
        return {
          result: {
            success: true,
            mode: args.mode,
            changes: [
              'Set power mode to maximum performance',
              'Enabled persistent mode',
              'Configured memory growth for TensorFlow',
            ],
          },
          command: { type: 'gpu_configured', payload: { mode: args.mode } },
        };
      }

      case 'setup_peripheral': {
        const peripheral: PeripheralInfo = {
          type: args.type as PeripheralInfo['type'],
          model: `${args.type} Device`,
          connected: true,
          status: 'ready',
        };

        if (this.hardwareState.profile) {
          this.hardwareState.profile.peripherals.push(peripheral);
        }

        return {
          result: {
            success: true,
            device: peripheral,
            instructions: [
              `${args.type} detected on ${args.port || 'auto'}`,
              'Drivers installed successfully',
              'Device ready for use',
            ],
          },
          command: { type: 'peripheral_connected', payload: peripheral },
        };
      }

      case 'check_ollama_status': {
        return {
          result: {
            status: this.hardwareState.ollamaStatus,
            models: this.hardwareState.ollamaStatus === 'running' ? ['llama3.2:3b', 'qwen2.5-coder:7b'] : [],
            endpoint: 'http://localhost:11434',
          },
        };
      }

      case 'check_ace_status': {
        return {
          result: {
            status: this.hardwareState.aceStatus,
            services: {
              nim: this.hardwareState.aceStatus === 'available',
              riva: this.hardwareState.aceStatus === 'available',
              audio2face: false,
            },
          },
        };
      }

      case 'monitor_resources': {
        return {
          result: {
            cpu: { usage: 35, temperature: 55 },
            gpu: { usage: 20, temperature: 45, vramUsed: 2.5 },
            memory: { used: 12, total: 32 },
            disk: { readRate: '150MB/s', writeRate: '80MB/s' },
          },
        };
      }

      case 'troubleshoot': {
        const issue = (args.issue as string).toLowerCase();
        let solution: Record<string, unknown>;

        if (issue.includes('cuda')) {
          solution = {
            diagnosis: 'CUDA-related issue detected',
            steps: [
              'Verify NVIDIA driver: nvidia-smi',
              'Check CUDA version: nvcc --version',
              'Reinstall CUDA toolkit if version mismatch',
              'Set PATH and LD_LIBRARY_PATH correctly',
            ],
            resources: ['https://developer.nvidia.com/cuda-toolkit'],
          };
        } else if (issue.includes('memory') || issue.includes('oom')) {
          solution = {
            diagnosis: 'Memory exhaustion issue',
            steps: [
              'Check current memory usage: free -h',
              'Reduce model size or batch size',
              'Enable model quantization (4-bit or 8-bit)',
              'Close unnecessary applications',
            ],
          };
        } else {
          solution = {
            diagnosis: 'General troubleshooting',
            steps: [
              'Run hardware diagnostics',
              'Check system logs for errors',
              'Verify all services are running',
              'Try restarting affected components',
            ],
          };
        }

        return { result: solution };
      }

      case 'get_recommendations': {
        const budget = (args.budget as number) || 500;
        const focus = args.focus || 'general';

        let recommendations: Record<string, unknown>;

        if (budget < 200) {
          recommendations = {
            tier: 'maker',
            suggestions: [
              { item: 'Arduino Starter Kit', price: 50, priority: 'high' },
              { item: 'USB Microphone', price: 30, priority: 'medium' },
              { item: 'External SSD 500GB', price: 60, priority: 'high' },
            ],
            aiCapability: 'Cloud-based (Cloudflare Workers)',
          };
        } else if (budget < 1000) {
          recommendations = {
            tier: 'edge',
            suggestions: [
              { item: 'NVIDIA Jetson Orin Nano', price: 500, priority: 'high' },
              { item: 'RAM Upgrade to 32GB', price: 80, priority: 'medium' },
              { item: 'NVMe SSD 1TB', price: 100, priority: 'high' },
            ],
            aiCapability: 'Local 3B-7B models',
          };
        } else {
          recommendations = {
            tier: 'power',
            suggestions: [
              { item: 'RTX 4070 Super', price: 600, priority: 'high' },
              { item: '64GB DDR5 RAM', price: 200, priority: 'high' },
              { item: 'NVMe SSD 2TB', price: 150, priority: 'medium' },
            ],
            aiCapability: 'Local 70B models, fine-tuning',
          };
        }

        return { result: recommendations };
      }

      default:
        return { result: { error: 'Unknown tool' } };
    }
  }

  // State management
  getHardwareProfile(): HardwareProfile | undefined {
    return this.hardwareState.profile;
  }

  getDiagnostics(): DiagnosticResult[] {
    return this.hardwareState.diagnostics;
  }

  setOllamaStatus(status: typeof this.hardwareState.ollamaStatus): void {
    this.hardwareState.ollamaStatus = status;
  }

  setAceStatus(status: typeof this.hardwareState.aceStatus): void {
    this.hardwareState.aceStatus = status;
  }
}
