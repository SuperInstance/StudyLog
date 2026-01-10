/**
 * Biological → AI Architecture Mapping
 *
 * Maps the entities of Sitka Sound (zooplankton, herring, deckhands, captains, whales)
 * to AI architecture components (tokens, swarms, SLMs, Director Agents, Orchestrators).
 */

// ============================================================================
// Entity Type Definitions
// ============================================================================

export type BiologicalEntity =
  | 'zooplankton'
  | 'herring'
  | 'deckhand'
  | 'dog'
  | 'captain'
  | 'fleet'
  | 'whale'
  | 'ecosystem'
  | 'salmon'
  | 'sea_lion'
  | 'bear'
  | 'eagle';

export type AIComponentType =
  | 'token'
  | 'vector_swarm'
  | 'slm'
  | 'director_agent'
  | 'orchestrator'
  | 'a2a_network'
  | 'multi_agent_system'
  | 'lora_adapter'
  | 'rag_context'
  | 'tool_use';

export type BehaviorType =
  | 'gradient_following'
  | 'murmuration'
  | 'skill_execution'
  | 'tool_calling'
  | 'coordination'
  | 'game_theory'
  | 'training_mode'
  | 'consolidation';

// ============================================================================
// Mapping Interface
// ============================================================================

export interface BiologicalMapping {
  type: AIComponentType;
  behavior: BehaviorType;
  description: string;
  capabilities: string[];
  model?: string;
  training?: string;
  memory?: string;
  orchestrates?: BiologicalEntity[];
  scalesWith?: string[];
}

// ============================================================================
// Complete Biological → AI Mapping
// ============================================================================

export const BIOLOGICAL_MAPPING: Record<BiologicalEntity, BiologicalMapping> = {
  // ========================================================================
  // Simple Organisms (Foundational AI Units)
  // ========================================================================

  zooplankton: {
    type: 'token',
    behavior: 'gradient_following',
    description:
      'The atomic unit of meaning. Zooplankton drift and follow nutrient gradients just as tokens flow through attention mechanisms following semantic gradients.',
    capabilities: ['semantic_unit', 'attention_weight', 'context_propagation'],
    scalesWith: 'context_window',
  },

  herring: {
    type: 'vector_swarm',
    behavior: 'murmuration',
    description:
      'Herring schools exhibit emergent intelligence through local interactions. Similarly, vector swarms use RAG to retrieve and cluster relevant context without central coordination.',
    capabilities: [
      'parallel_retrieval',
      'embedding_similarity',
      'collective_reasoning',
      'distributed_attention',
    ],
    scalesWith: 'vector_db_size',
  },

  // ========================================================================
  // Social Agents (Trained Specialized Models)
  // ========================================================================

  deckhand: {
    type: 'slm',
    behavior: 'skill_execution',
    description:
      'A deckhand learns specific tasks through repetition and direct instruction. Similarly, Small Language Models with LoRA adapters specialize in narrow, actionable skills.',
    capabilities: ['task_execution', 'tool_calling', 'following_instructions', 'skill_lora'],
    model: 'nemotron-mini:4b',
    training: 'lora_fishing',
    memory: 'rag_logs',
    scalesWith: 'lora_dataset_size',
  },

  dog: {
    type: 'lora_adapter',
    behavior: 'skill_execution',
    description:
      'Dogs are bred for specific traits (herding, retrieving). LoRA adapters are the AI equivalent: fine-tuned weights that give a base model specific capabilities and personality.',
    capabilities: ['personality_injection', 'specialized_skill', 'fast_fine_tune', 'breeding_program'],
    model: 'base_llm',
    training: 'lora_dog_training',
    memory: 'owner_interactions',
    scalesWith: 'lora_rank',
  },

  salmon: {
    type: 'rag_context',
    behavior: 'training_mode',
    description:
      'Salmon return to their natal streams to spawn. RAG systems return to their training data to provide context, bringing external knowledge into the inference stream.',
    capabilities: ['context_retrieval', 'knowledge_grounding', 'citation_generation'],
    scalesWith: 'embedding_quality',
  },

  // ========================================================================
  // Leadership (Orchestration and Decision Making)
  // ========================================================================

  captain: {
    type: 'director_agent',
    behavior: 'coordination',
    description:
      'A captain directs deckhands, reads the sea, and makes strategic decisions. Director Agents orchestrate sub-agents, synthesize information, and plan multi-step actions.',
    capabilities: [
      'agent_orchestration',
      'strategic_planning',
      'resource_allocation',
      'delegation',
      'synthesis',
    ],
    model: 'llama-3.1-70b',
    orchestrates: ['deckhand', 'dog', 'hardware'],
    scalesWith: 'reasoning_depth',
  },

  whale: {
    type: 'orchestrator',
    behavior: 'coordination',
    description:
      'Whales communicate across vast distances and coordinate group behaviors. Orchestrator models manage long-horizon planning and cross-domain coordination.',
    capabilities: [
      'long_horizon_planning',
      'cross_modal_synthesis',
      'global_optimization',
      'meta_reasoning',
    ],
    model: 'claude-3-5-sonnet',
    orchestrates: ['fleet', 'herring', 'captain'],
    scalesWith: 'context_window',
  },

  // ========================================================================
  // Ecological Systems (Multi-Agent Architectures)
  // ========================================================================

  fleet: {
    type: 'a2a_network',
    behavior: 'game_theory',
    description:
      'Fishing boats share information (or don\'t) based on trust, competition, and regulation. A2A networks model agent-to-agent communication through game theory: cooperation, defection, and reputation.',
    capabilities: [
      'p2p_communication',
      'trust_evaluation',
      'asymmetric_info',
      'prisoners_dilemma',
      'reputation_system',
    ],
    orchestrates: ['captain', 'deckhand'],
    scalesWith: 'network_size',
  },

  ecosystem: {
    type: 'multi_agent_system',
    behavior: 'consolidation',
    description:
      'The entire sound is a multi-agent system with emergent properties. Similarly, AI ecosystems combine swarms, SLMs, and orchestrators into coherent intelligence.',
    capabilities: [
      'emergent_behavior',
      'system_level_optimization',
      'homeostasis',
      'evolution',
    ],
    orchestrates: ['fleet', 'whale', 'herring', 'zooplankton'],
    scalesWith: 'compute_budget',
  },

  // ========================================================================
  // Predators (Evaluation and Selection)
  // ========================================================================

  sea_lion: {
    type: 'tool_use',
    behavior: 'skill_execution',
    description:
      'Sea lions hunt cooperatively and use tools (bubbles). Tool-using agents evaluate and select the best function calls, balancing speed and accuracy.',
    capabilities: ['function_calling', 'tool_selection', 'api_composition', 'result_validation'],
    scalesWith: 'tool_registry_size',
  },

  bear: {
    type: 'director_agent',
    behavior: 'coordination',
    description:
      'Bears patrol territories and optimize feeding. Evaluation agents monitor system performance and trigger retraining or scaling decisions.',
    capabilities: ['performance_monitoring', 'scaling_decisions', 'cost_optimization', 'alerting'],
    model: 'gpt-4o-mini',
    scalesWith: 'metric_complexity',
  },

  eagle: {
    type: 'rag_context',
    behavior: 'consolidation',
    description:
      'Eagles spot opportunities from above. Retrieval agents scan vast knowledge bases to find relevant information for downstream processing.',
    capabilities: ['semantic_search', 'relevance_ranking', 'distant_context'],
    scalesWith: 'vector_db_size',
  },
};

// ============================================================================
// Inverse Mapping: AI → Biological
// ============================================================================

export const AI_TO_BIOLOGICAL: Record<AIComponentType, BiologicalEntity[]> = {
  token: ['zooplankton'],
  vector_swarm: ['herring'],
  slm: ['deckhand'],
  director_agent: ['captain', 'bear'],
  orchestrator: ['whale'],
  a2a_network: ['fleet'],
  multi_agent_system: ['ecosystem'],
  lora_adapter: ['dog'],
  rag_context: ['salmon', 'eagle'],
  tool_use: ['sea_lion'],
};

// ============================================================================
// Sleep = Training Mode Implementation
// ============================================================================

export interface SleepTrainingConfig {
  // Daily logs to process
  logSources: string[];

  // Training targets
  loraTargets: string[];

  // Consolidation parameters
  batchSize: number;
  learningRate: number;
  epochs: number;

  // Memory parameters
  shortTermRetention: number; // days
  longTermRetention: number; // days
}

export async function sleepTrainingMode(config: SleepTrainingConfig): Promise<void> {
  console.log('[Sleep] Starting training mode...');

  // 1. Batch process daily logs into embeddings
  for (const source of config.logSources) {
    const logs = await fetchDailyLogs(source);
    const embeddings = await embedLogs(logs);
    await storeInVectorDB(embeddings, source);
  }

  // 2. Generate LoRA from journal entries
  for (const target of config.loraTargets) {
    const journal = await fetchJournalEntries(target);
    const lora = await trainLoRA(journal, {
      batchSize: config.batchSize,
      learningRate: config.learningRate,
      epochs: config.epochs,
    });
    await saveLoRA(target, lora);
  }

  // 3. Simulate memory consolidation
  await consolidateMemory({
    shortTermRetention: config.shortTermRetention,
    longTermRetention: config.longTermRetention,
    forgetIrrelevant: true,
    strengthenImportant: true,
  });

  console.log('[Sleep] Training complete. Waking up...');
}

// ============================================================================
// Helper Functions
// ============================================================================

async function fetchDailyLogs(source: string): Promise<string[]> {
  // Implementation would read from D1 / Vectorize
  return [];
}

async function embedLogs(logs: string[]): Promise<number[][]> {
  // Implementation would call embedding model
  return [];
}

async function storeInVectorDB(embeddings: number[][], source: string): Promise<void> {
  // Implementation would store in Vectorize
}

async function fetchJournalEntries(target: string): Promise<string[]> {
  // Implementation would read journal from D1
  return [];
}

async function trainLoRA(
  journal: string[],
  config: { batchSize: number; learningRate: number; epochs: number }
): Promise<Uint8Array> {
  // Implementation would trigger LoRA training
  return new Uint8Array();
}

async function saveLoRA(target: string, lora: Uint8Array): Promise<void> {
  // Implementation would save LoRA weights to R2
}

async function consolidateMemory(config: {
  shortTermRetention: number;
  longTermRetention: number;
  forgetIrrelevant: boolean;
  strengthenImportant: boolean;
}): Promise<void> {
  // Implementation would perform memory consolidation
}

export default BIOLOGICAL_MAPPING;
