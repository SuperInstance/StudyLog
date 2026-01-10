/**
 * StudyLoG.AI - Ollama Package
 *
 * Local AI inference with Ollama.
 * Exports configuration, client, and utilities.
 */

export {
  OLLAMA_MODELS,
  HARDWARE_TIERS,
  OLLAMA_DEFAULT_CONFIG,
  getRecommendedTier,
  getModelsForTier,
  estimateDownloadSize,
  type OllamaModelConfig,
  type HardwareTier,
} from './config';

export {
  OllamaClient,
  createClient,
  ensureModels,
  getModelConfig,
  type OllamaOptions,
  type GenerateOptions,
  type GenerateResponse,
  type ChatMessage,
  type ChatOptions,
  type EmbedOptions,
  type EmbedResponse,
  type ModelInfo,
  type PullProgress,
} from './client';

export { OllamaService } from './service';
