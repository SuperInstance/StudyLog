/**
 * StudyLoG.AI - Ollama Configuration
 *
 * Model recommendations by hardware tier and use case.
 * Optimized for educational AI with focus on code and explanation.
 */

export interface OllamaModelConfig {
  name: string;
  size: string; // Human-readable size
  vramRequired: number; // GB
  ramRequired: number; // GB for CPU fallback
  contextLength: number;
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  useCase: string[];
}

export interface HardwareTier {
  name: string;
  minVram: number;
  minRam: number;
  models: {
    chat: string;
    code: string;
    embed: string;
    vision?: string;
  };
  description: string;
}

// Available models for StudyLoG (2026 landscape)
export const OLLAMA_MODELS: Record<string, OllamaModelConfig> = {
  // Small models (8GB RAM / 4GB VRAM)
  'llama3.2:3b': {
    name: 'Llama 3.2 3B',
    size: '2GB',
    vramRequired: 4,
    ramRequired: 8,
    contextLength: 8192,
    speed: 'fast',
    quality: 'basic',
    useCase: ['chat', 'simple-code'],
  },
  'qwen2.5-coder:3b': {
    name: 'Qwen 2.5 Coder 3B',
    size: '2GB',
    vramRequired: 4,
    ramRequired: 8,
    contextLength: 8192,
    speed: 'fast',
    quality: 'good',
    useCase: ['code', 'completion'],
  },
  'nomic-embed-text': {
    name: 'Nomic Embed Text',
    size: '274MB',
    vramRequired: 2,
    ramRequired: 4,
    contextLength: 8192,
    speed: 'fast',
    quality: 'good',
    useCase: ['embed'],
  },

  // Medium models (16GB RAM / 8GB VRAM)
  'llama3.3:8b': {
    name: 'Llama 3.3 8B',
    size: '4.7GB',
    vramRequired: 8,
    ramRequired: 16,
    contextLength: 32768,
    speed: 'medium',
    quality: 'good',
    useCase: ['chat', 'reasoning'],
  },
  'qwen2.5-coder:7b': {
    name: 'Qwen 2.5 Coder 7B',
    size: '4.7GB',
    vramRequired: 8,
    ramRequired: 16,
    contextLength: 32768,
    speed: 'medium',
    quality: 'excellent',
    useCase: ['code', 'completion', 'refactor'],
  },
  'codestral:22b': {
    name: 'Codestral 22B',
    size: '13GB',
    vramRequired: 16,
    ramRequired: 32,
    contextLength: 32768,
    speed: 'slow',
    quality: 'excellent',
    useCase: ['code', 'complex-code'],
  },

  // Large models (32GB+ RAM / 16GB+ VRAM)
  'llama3.3:70b-q4': {
    name: 'Llama 3.3 70B Q4',
    size: '40GB',
    vramRequired: 48,
    ramRequired: 64,
    contextLength: 32768,
    speed: 'slow',
    quality: 'excellent',
    useCase: ['chat', 'reasoning', 'complex'],
  },
  'qwen2.5-coder:32b': {
    name: 'Qwen 2.5 Coder 32B',
    size: '20GB',
    vramRequired: 24,
    ramRequired: 48,
    contextLength: 32768,
    speed: 'medium',
    quality: 'excellent',
    useCase: ['code', 'architecture'],
  },

  // Vision models
  'llava:7b': {
    name: 'LLaVA 7B',
    size: '4.7GB',
    vramRequired: 8,
    ramRequired: 16,
    contextLength: 4096,
    speed: 'medium',
    quality: 'good',
    useCase: ['vision', 'image-understanding'],
  },
  'llava:13b': {
    name: 'LLaVA 13B',
    size: '8GB',
    vramRequired: 16,
    ramRequired: 24,
    contextLength: 4096,
    speed: 'slow',
    quality: 'excellent',
    useCase: ['vision', 'image-understanding'],
  },
};

// Hardware tiers with recommended models
export const HARDWARE_TIERS: Record<string, HardwareTier> = {
  starter: {
    name: 'Starter',
    minVram: 0,
    minRam: 8,
    models: {
      chat: 'llama3.2:3b',
      code: 'qwen2.5-coder:3b',
      embed: 'nomic-embed-text',
    },
    description: 'CPU-only inference. Basic models for simple tasks.',
  },
  maker: {
    name: 'Maker',
    minVram: 4,
    minRam: 16,
    models: {
      chat: 'llama3.3:8b',
      code: 'qwen2.5-coder:7b',
      embed: 'nomic-embed-text',
      vision: 'llava:7b',
    },
    description: 'Entry-level GPU (GTX 1650, RTX 3050). Good for learning.',
  },
  edge: {
    name: 'Edge',
    minVram: 8,
    minRam: 16,
    models: {
      chat: 'llama3.3:8b',
      code: 'qwen2.5-coder:7b',
      embed: 'nomic-embed-text',
      vision: 'llava:7b',
    },
    description: 'Jetson Orin or RTX 3060. Real-time inference.',
  },
  power: {
    name: 'Power',
    minVram: 16,
    minRam: 32,
    models: {
      chat: 'llama3.3:8b',
      code: 'codestral:22b',
      embed: 'nomic-embed-text',
      vision: 'llava:13b',
    },
    description: 'RTX 4080/4090. Advanced models, fast inference.',
  },
  pro: {
    name: 'Pro',
    minVram: 48,
    minRam: 64,
    models: {
      chat: 'llama3.3:70b-q4',
      code: 'qwen2.5-coder:32b',
      embed: 'nomic-embed-text',
      vision: 'llava:13b',
    },
    description: 'DGX Spark or multi-GPU. Research-grade inference.',
  },
};

// Get recommended tier based on hardware
export function getRecommendedTier(vram: number, ram: number): HardwareTier {
  if (vram >= 48) return HARDWARE_TIERS.pro;
  if (vram >= 16) return HARDWARE_TIERS.power;
  if (vram >= 8) return HARDWARE_TIERS.edge;
  if (vram >= 4) return HARDWARE_TIERS.maker;
  return HARDWARE_TIERS.starter;
}

// Get models to download for a tier
export function getModelsForTier(tier: HardwareTier): string[] {
  const models = new Set<string>();
  models.add(tier.models.chat);
  models.add(tier.models.code);
  models.add(tier.models.embed);
  if (tier.models.vision) {
    models.add(tier.models.vision);
  }
  return Array.from(models);
}

// Estimate download size for a tier
export function estimateDownloadSize(tier: HardwareTier): string {
  const models = getModelsForTier(tier);
  let totalMb = 0;

  for (const model of models) {
    const config = OLLAMA_MODELS[model];
    if (config) {
      const size = config.size;
      if (size.endsWith('GB')) {
        totalMb += parseFloat(size) * 1024;
      } else if (size.endsWith('MB')) {
        totalMb += parseFloat(size);
      }
    }
  }

  if (totalMb >= 1024) {
    return `${(totalMb / 1024).toFixed(1)}GB`;
  }
  return `${Math.round(totalMb)}MB`;
}

// Default Ollama configuration
export const OLLAMA_DEFAULT_CONFIG = {
  host: 'http://127.0.0.1:11434',
  timeout: 120000, // 2 minutes for slow models
  retries: 3,
  keepAlive: '5m', // Keep model in memory
};
