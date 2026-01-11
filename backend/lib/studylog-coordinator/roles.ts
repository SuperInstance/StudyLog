/**
 * StudyLoG.AI Agent Roles
 *
 * Predefined agent roles based on the biological metaphor for the
 * StudyLoG.AI learning ecosystem.
 */

import {
  AgentRole,
  BiologicalAgentType,
  LearningStage,
} from "./types.js";

/**
 * Cognitive Mill Stage - Understanding AI Internals
 *
 * Focus: Teaching how AI models work through visualization
 * Metaphor: Processing raw materials (tokens) into refined products
 */

/**
 * Zooplankton - Token Processing Agent
 *
 * The foundation of the AI food chain. Processes individual tokens
 * and handles basic embedding operations.
 *
 * Capabilities: token, embedding, context_window
 */
export const ZOOPLANKTON_ROLE: AgentRole = {
  name: "zooplankton",
  capabilities: ["token", "embedding", "context_window", "tokenize"],
  maxConcurrentTasks: 5,
  priority: 1,
  biologicalType: BiologicalAgentType.ZOOPLANKTON,
  stage: LearningStage.COGNITIVE_MILL,
  emoji: "🦐",
  metadata: {
    description: "Token processing agent",
    stage: "cognitive_mill",
    tier: "foundation",
  },
};

/**
 * Herring - Vector Swarm Agent
 *
 * Processes vectors in swarms. Handles attention mechanisms and
 * vector operations.
 *
 * Capabilities: vector, swarm, attention, softmax
 */
export const HERRING_ROLE: AgentRole = {
  name: "herring",
  capabilities: [
    "vector",
    "swarm",
    "attention",
    "softmax",
    "query_key_value",
    "multi_head",
  ],
  maxConcurrentTasks: 3,
  priority: 2,
  biologicalType: BiologicalAgentType.HERRING,
  stage: LearningStage.COGNITIVE_MILL,
  emoji: "🐟",
  metadata: {
    description: "Vector swarm processing agent",
    stage: "cognitive_mill",
    tier: "processing",
  },
};

/**
 * Intelligence Ranch Stage - Training AI Agents
 *
 * Focus: Teaching how to train and fine-tune AI models
 * Metaphor: Raising and breeding AI agents like livestock
 */

/**
 * Deckhand - SLM + LoRA Agent
 *
 * Handles small language model operations and LoRA fine-tuning.
 * The workhorse of the ranch.
 *
 * Capabilities: slm, lora, fine_tune, dataset
 */
export const DECKHAND_ROLE: AgentRole = {
  name: "deckhand",
  capabilities: [
    "slm",
    "lora",
    "fine_tune",
    "dataset",
    "preprocessing",
    "training_loop",
  ],
  maxConcurrentTasks: 2,
  priority: 3,
  biologicalType: BiologicalAgentType.DECKHAND,
  stage: LearningStage.INTELLIGENCE_RANCH,
  emoji: "👨‍✈️",
  metadata: {
    description: "Small model fine-tuning agent",
    stage: "intelligence_ranch",
    tier: "worker",
  },
};

/**
 * Captain - Director Agent
 *
 * Coordinates training operations and directs other agents.
 * Makes decisions about model architecture and training strategy.
 *
 * Capabilities: direct, coordinate, route, orchestrate
 */
export const CAPTAIN_ROLE: AgentRole = {
  name: "captain",
  capabilities: [
    "direct",
    "coordinate",
    "route",
    "orchestrate",
    "decision",
    "strategy",
  ],
  maxConcurrentTasks: 1,
  priority: 5,
  biologicalType: BiologicalAgentType.CAPTAIN,
  stage: LearningStage.INTELLIGENCE_RANCH,
  emoji: "👨‍✈️",
  metadata: {
    description: "Training coordination agent",
    stage: "intelligence_ranch",
    tier: "leadership",
  },
};

/**
 * Sitka Sound Stage - Multi-Agent Systems
 *
 * Focus: Teaching multi-agent coordination and game theory
 * Metaphor: Ocean ecosystem where agents interact and evolve
 */

/**
 * Whale - Orchestrator Agent
 *
 * Large-scale orchestration of multi-agent systems.
 * Handles agent-to-agent communication and coordination.
 *
 * Capabilities: orchestrator, a2a, meta_cognitive, supervise
 */
export const WHALE_ROLE: AgentRole = {
  name: "whale",
  capabilities: [
    "orchestrator",
    "a2a",
    "meta_cognitive",
    "supervise",
    "coordinate_many",
    "emergent_behavior",
  ],
  maxConcurrentTasks: 1,
  priority: 10,
  biologicalType: BiologicalAgentType.WHALE,
  stage: LearningStage.SITKA_SOUND,
  emoji: "🐋",
  metadata: {
    description: "Multi-agent orchestration",
    stage: "sitka_sound",
    tier: "apex",
  },
};

/**
 * Fleet - A2A Network Agent
 *
 * Represents the collective network of agents working together.
 * Handles network-level communication and game theory scenarios.
 *
 * Capabilities: network, game_theory, emerge, nash_equilibrium
 */
export const FLEET_ROLE: AgentRole = {
  name: "fleet",
  capabilities: [
    "network",
    "game_theory",
    "emerge",
    "nash_equilibrium",
    "collective_intelligence",
    "swarm_intelligence",
  ],
  maxConcurrentTasks: 3,
  priority: 7,
  biologicalType: BiologicalAgentType.FLEET,
  stage: LearningStage.SITKA_SOUND,
  emoji: "🚢",
  metadata: {
    description: "Agent network coordination",
    stage: "sitka_sound",
    tier: "collective",
  },
};

/**
 * Universal Agent - Works across all stages
 */

/**
 * Dog - LoRA Adapter Agent
 *
 * Versatile adapter agent that can work in any stage.
 * Specializes in adapting models for specific tasks.
 *
 * Capabilities: lora, adapter, specialize, transfer
 */
export const DOG_ROLE: AgentRole = {
  name: "dog",
  capabilities: [
    "lora",
    "adapter",
    "specialize",
    "transfer",
    "finetune_quick",
    "adapt",
  ],
  maxConcurrentTasks: 4,
  priority: 4,
  biologicalType: BiologicalAgentType.DOG,
  emoji: "🐕",
  metadata: {
    description: "Versatile adapter agent",
    stage: "universal",
    tier: "adapter",
  },
};

/**
 * All predefined roles indexed by name
 */
export const STUDYLOG_ROLES: Record<string, AgentRole> = {
  zooplankton: ZOOPLANKTON_ROLE,
  herring: HERRING_ROLE,
  deckhand: DECKHAND_ROLE,
  captain: CAPTAIN_ROLE,
  whale: WHALE_ROLE,
  fleet: FLEET_ROLE,
  dog: DOG_ROLE,
};

/**
 * Get roles by learning stage
 */
export function getRolesByStage(stage: LearningStage): AgentRole[] {
  return Object.values(STUDYLOG_ROLES).filter(
    (role) => role.stage === stage || role.stage === undefined
  );
}

/**
 * Get role by biological type
 */
export function getRoleByBiologicalType(
  type: BiologicalAgentType
): AgentRole | undefined {
  return Object.values(STUDYLOG_ROLES).find(
    (role) => role.biologicalType === type
  );
}

/**
 * Get all capabilities for a stage
 */
export function getStageCapabilities(stage: LearningStage): string[] {
  const roles = getRolesByStage(stage);
  const capabilities = new Set<string>();
  for (const role of roles) {
    for (const cap of role.capabilities) {
      capabilities.add(cap);
    }
  }
  return Array.from(capabilities);
}

/**
 * Stage progression requirements
 *
 * Defines what needs to be completed before advancing to the next stage
 */
export const STAGE_REQUIREMENTS = {
  [LearningStage.COGNITIVE_MILL]: {
    requiredConcepts: [],
    requiredPuzzles: 0,
    description: "Welcome to the Cognitive Mill! Learn how AI models process information.",
  },
  [LearningStage.INTELLIGENCE_RANCH]: {
    requiredConcepts: ["tokens", "embeddings", "attention"],
    requiredPuzzles: 5,
    description:
      "Intelligence Ranch unlocked! Learn to train and breed your own AI agents.",
    requiredXp: 500,
  },
  [LearningStage.SITKA_SOUND]: {
    requiredConcepts: [
      "tokens",
      "embeddings",
      "attention",
      "fine_tuning",
      "lora",
      "slm",
    ],
    requiredPuzzles: 15,
    description:
      "Sitka Sound unlocked! Explore multi-agent systems and emergent behavior.",
    requiredXp: 2000,
  },
};

/**
 * Check if stage requirements are met
 */
export function checkStageRequirements(
  targetStage: LearningStage,
  progress: {
    conceptsLearned: string[];
    puzzlesSolved: number;
    totalXp: number;
  }
): { met: boolean; missing: string[] } {
  const requirements = STAGE_REQUIREMENTS[targetStage];
  const missing: string[] = [];

  // Check required concepts
  for (const concept of requirements.requiredConcepts) {
    if (!progress.conceptsLearned.includes(concept)) {
      missing.push(`Concept: ${concept}`);
    }
  }

  // Check puzzle count
  if (progress.puzzlesSolved < requirements.requiredPuzzles) {
    missing.push(
      `Puzzles: ${progress.puzzlesSolved}/${requirements.requiredPuzzles}`
    );
  }

  // Check XP if specified
  if (
    "requiredXp" in requirements &&
    progress.totalXp < (requirements as { requiredXp: number }).requiredXp
  ) {
    missing.push(
      `XP: ${progress.totalXp}/${
        (requirements as { requiredXp: number }).requiredXp
      }`
    );
  }

  return {
    met: missing.length === 0,
    missing,
  };
}

/**
 * Learning concepts by stage
 */
export const STAGE_CONCEPTS = {
  [LearningStage.COGNITIVE_MILL]: [
    { id: "tokens", name: "Tokens", xpReward: 50 },
    { id: "embeddings", name: "Embeddings", xpReward: 75 },
    { id: "attention", name: "Attention Mechanism", xpReward: 100 },
    { id: "transformers", name: "Transformers", xpReward: 150 },
  ],
  [LearningStage.INTELLIGENCE_RANCH]: [
    { id: "fine_tuning", name: "Fine-Tuning", xpReward: 100 },
    { id: "lora", name: "LoRA Adapters", xpReward: 125 },
    { id: "slm", name: "Small Language Models", xpReward: 150 },
    { id: "training_loop", name: "Training Loop", xpReward: 100 },
    { id: "loss_functions", name: "Loss Functions", xpReward: 75 },
  ],
  [LearningStage.SITKA_SOUND]: [
    { id: "multi_agent", name: "Multi-Agent Systems", xpReward: 150 },
    { id: "game_theory", name: "Game Theory", xpReward: 125 },
    { id: "emergence", name: "Emergent Behavior", xpReward: 175 },
    { id: "coordination", name: "Agent Coordination", xpReward: 150 },
  ],
};

/**
 * Get concept XP reward
 */
export function getConceptXpReward(conceptId: string): number {
  for (const stageConcepts of Object.values(STAGE_CONCEPTS)) {
    const concept = stageConcepts.find((c) => c.id === conceptId);
    if (concept) {
      return concept.xpReward;
    }
  }
  return 0;
}

/**
 * All available concepts across all stages
 */
export const ALL_CONCEPTS = Object.values(STAGE_CONCEPTS).flat();
