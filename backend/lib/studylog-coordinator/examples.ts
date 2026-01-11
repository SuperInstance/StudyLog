/**
 * StudyLoG.AI Coordinator Examples
 *
 * Demonstrates various usage patterns for the agent coordinator
 * in the context of the StudyLoG.AI learning ecosystem.
 */

import {
  StudyLogCoordinator,
  createCoordinator,
  startCoordinator,
  Task,
  TaskStatus,
  TaskPriority,
  LearningStage,
  EventType,
} from "./index.js";

/**
 * Example 1: Basic Cognitive Mill Tutorial
 *
 * Demonstrates a simple learning flow through the Cognitive Mill stage,
 * where learners understand how AI models process tokens.
 */
export async function exampleCognitiveMillTutorial() {
  console.log("\n=== Cognitive Mill Tutorial Example ===\n");

  const coordinator = await startCoordinator({
    name: "cognitive-mill-tutorial",
    debug: true,
  });

  // Subscribe to events for visualization hooks
  coordinator.eventBus.subscribe(
    [EventType.TASK_COMPLETED],
    (event) => {
      console.log(`[VISUALIZATION] Task completed:`, event.data);
      // Here you would trigger Godot visualizations
    }
  );

  // Define token processing task
  const tokenTask: Task = {
    id: "learn-tokens",
    description: "Learn about token processing",
    requiredCapabilities: ["token"],
    payload: {
      lesson: "Tokens are the building blocks of AI language models",
      exercise: "Tokenize the sentence: 'Hello, world!'",
    },
    priority: TaskPriority.HIGH,
    timeout: 300,
    maxRetries: 3,
    dependencies: [],
    metadata: { stage: LearningStage.COGNITIVE_MILL },
    createdAt: new Date(),
    status: TaskStatus.PENDING,
    retryCount: 0,
    learningStage: LearningStage.COGNITIVE_MILL,
  };

  // Spawn a zooplankton agent (token processor)
  const zooplankton = await coordinator.spawnAgent(
    "zooplankton-1",
    "zooplankton",
    async (task) => {
      // Simulate learning activity
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return {
        understood: true,
        tokens: ["Hello", ",", "world", "!"],
        explanation:
          "Text is broken down into tokens, which are converted to embeddings",
      };
    }
  );

  // Submit and wait for completion
  const result = await coordinator.submitTask(tokenTask, true);

  if (result?.success) {
    console.log("Learning outcome:", result.result);

    // Record progress
    await coordinator.recordConceptLearned("tokens", 50);

    // Check progress
    const progress = coordinator.learningProgress;
    console.log("\nLearning Progress:");
    console.log(`  Concepts: ${progress.conceptsLearned.join(", ")}`);
    console.log(`  XP: ${progress.totalXp}`);
    console.log(`  Level: ${progress.level}`);
  }

  await coordinator.stop();
}

/**
 * Example 2: Intelligence Ranch Agent Training
 *
 * Demonstrates training and breeding AI agents in the Intelligence Ranch stage.
 */
export async function exampleIntelligenceRanch() {
  console.log("\n=== Intelligence Ranch Example ===\n");

  const coordinator = await startCoordinator({
    name: "intelligence-ranch",
    debug: true,
  });

  // Subscribe to achievement unlocks
  coordinator.eventBus.subscribe([EventType.ACHIEVEMENT_UNLOCKED], (event) => {
    console.log(`\n🏆 ACHIEVEMENT UNLOCKED: ${event.data.name}`);
    console.log(`   +${event.data.xpReward} XP\n`);
  });

  // First, ensure Cognitive Mill is complete
  await coordinator.recordConceptLearned("tokens");
  await coordinator.recordConceptLearned("embeddings");
  await coordinator.recordConceptLearned("attention");

  // Solve some puzzles to meet requirements
  for (let i = 0; i < 5; i++) {
    await coordinator.recordPuzzleSolved();
  }

  // Try to advance to Intelligence Ranch
  const canAdvance = await coordinator.advanceToStage(
    LearningStage.INTELLIGENCE_RANCH
  );

  if (canAdvance) {
    console.log("\n🚀 Advanced to Intelligence Ranch!\n");

    // Spawn training agents
    const deckhand = await coordinator.spawnAgent(
      "deckhand-1",
      "deckhand",
      async (task) => {
        // Simulate fine-tuning a model
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return {
          model: "tiny-llm",
          loraAdapters: ["attention-tuner", "embedding-refiner"],
          trainingLoss: 0.234,
          epochs: 10,
        };
      }
    );

    const captain = await coordinator.spawnAgent(
      "captain-1",
      "captain",
      async (task) => {
        // Coordinate training strategy
        await new Promise((resolve) => setTimeout(resolve, 500));

        return {
          strategy: "progressive_fine_tuning",
          stages: ["pretrain", "lora_finetune", "evaluate"],
          deployment: "edge_device",
        };
      }
    );

    // Training pipeline tasks
    const trainingTasks: Task[] = [
      {
        id: "prepare-dataset",
        description: "Prepare training dataset",
        requiredCapabilities: ["dataset"],
        payload: { size: 10000, format: "jsonl" },
        priority: TaskPriority.HIGH,
        timeout: 300,
        maxRetries: 3,
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
      {
        id: "train-lora",
        description: "Train LoRA adapter",
        requiredCapabilities: ["lora", "fine_tune"],
        payload: { rank: 8, alpha: 16 },
        priority: TaskPriority.HIGH,
        timeout: 600,
        maxRetries: 3,
        dependencies: ["prepare-dataset"],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
      {
        id: "evaluate-model",
        description: "Evaluate trained model",
        requiredCapabilities: ["coordinate"],
        payload: { metrics: ["accuracy", "perplexity"] },
        priority: TaskPriority.MEDIUM,
        timeout: 300,
        maxRetries: 3,
        dependencies: ["train-lora"],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
    ];

    // Submit training pipeline
    const results = await coordinator.submitTasks(trainingTasks, true);

    console.log("\nTraining Results:");
    for (const result of results) {
      if (result) {
        console.log(`  ${result.taskId}: ${result.success ? "✓" : "✗"}`);
      }
    }

    // Record learning progress
    await coordinator.recordConceptLearned("lora", 125);
    await coordinator.recordConceptLearned("fine_tuning", 100);
  }

  await coordinator.stop();
}

/**
 * Example 3: Sitka Sound Multi-Agent Coordination
 *
 * Demonstrates multi-agent systems and emergent behavior in the
 * Sitka Sound stage.
 */
export async function exampleSitkaSound() {
  console.log("\n=== Sitka Sound Example ===\n");

  const coordinator = await startCoordinator({
    name: "sitka-sound",
    debug: true,
  });

  // Complete previous stages
  const allConcepts = [
    "tokens",
    "embeddings",
    "attention",
    "fine_tuning",
    "lora",
    "slm",
    "multi_agent",
    "game_theory",
  ];

  for (const concept of allConcepts) {
    await coordinator.recordConceptLearned(concept, 0);
  }

  // Solve puzzles to meet requirements
  for (let i = 0; i < 15; i++) {
    await coordinator.recordPuzzleSolved();
  }

  // Advance to Sitka Sound
  const canAdvance = await coordinator.advanceToStage(
    LearningStage.SITKA_SOUND
  );

  if (canAdvance) {
    console.log("\n🌊 Advanced to Sitka Sound!\n");

    // Spawn multi-agent system
    const whale = await coordinator.spawnAgent(
      "whale-orchestrator",
      "whale",
      async (task) => {
        // Orchestrate multiple agents
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          coordination: "hierarchical",
          agentsOrchestrated: 5,
          emergentBehavior: "collaborative_problem_solving",
        };
      }
    );

    const fleet = await coordinator.spawnAgent(
      "fleet-network",
      "fleet",
      async (task) => {
        // Simulate network behavior
        await new Promise((resolve) => setTimeout(resolve, 1500));

        return {
          networkTopology: "mesh",
          agents: 10,
          nashEquilibrium: true,
          collectiveIntelligence: 0.87,
        };
      }
    );

    // Multi-agent coordination scenario
    const scenarioTasks: Task[] = [
      {
        id: "setup-network",
        description: "Setup agent network",
        requiredCapabilities: ["network"],
        payload: { topology: "small_world", agents: 8 },
        priority: TaskPriority.HIGH,
        timeout: 300,
        maxRetries: 3,
        dependencies: [],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
      {
        id: "run-simulation",
        description: "Run multi-agent simulation",
        requiredCapabilities: ["emerge", "game_theory"],
        payload: { rounds: 100, scenario: "prisoners_dilemma" },
        priority: TaskPriority.HIGH,
        timeout: 600,
        maxRetries: 3,
        dependencies: ["setup-network"],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
      {
        id: "analyze-emergence",
        description: "Analyze emergent behavior",
        requiredCapabilities: ["orchestrator", "supervise"],
        payload: { metrics: ["cooperation_rate", "convergence"] },
        priority: TaskPriority.MEDIUM,
        timeout: 300,
        maxRetries: 3,
        dependencies: ["run-simulation"],
        metadata: {},
        createdAt: new Date(),
        status: TaskStatus.PENDING,
        retryCount: 0,
      },
    ];

    const results = await coordinator.submitTasks(scenarioTasks, true);

    console.log("\nSimulation Results:");
    for (const result of results) {
      if (result) {
        console.log(`  ${result.taskId}: ${result.success ? "✓" : "✗"}`);
        if (result.success && result.result) {
          console.log(`    Data:`, result.result);
        }
      }
    }

    // Record new concepts
    await coordinator.recordConceptLearned("emergence", 175);
    await coordinator.recordConceptLearned("coordination", 150);
  }

  // Show final achievements
  const unlocked = coordinator.getUnlockedAchievements();
  console.log("\n🏆 Achievements Unlocked:");
  for (const achievement of unlocked) {
    console.log(`  ${achievement.icon} ${achievement.name}`);
    console.log(`    ${achievement.description}`);
  }

  await coordinator.stop();
}

/**
 * Example 4: Complete Learning Journey
 *
 * A full example showing a learner progressing through all three stages.
 */
export async function exampleLearningJourney() {
  console.log("\n=== StudyLoG.AI Learning Journey ===\n");

  const coordinator = await startCoordinator({
    name: "learner-journey",
    debug: false,
  });

  // Subscribe to all events for monitoring
  coordinator.eventBus.subscribe(
    Object.values(EventType),
    (event) => {
      switch (event.type) {
        case EventType.CONCEPT_LEARNED:
          console.log(`  📚 Learned: ${event.data.conceptId} (+${event.data.xpReward} XP)`);
          break;
        case EventType.PUZZLE_SOLVED:
          console.log(`  🧩 Puzzle ${event.data.puzzlesSolved} solved`);
          break;
        case EventType.ACHIEVEMENT_UNLOCKED:
          console.log(`  🏆 ${event.data.name} unlocked!`);
          break;
        case EventType.STAGE_COMPLETED:
          console.log(`  🚀 Stage completed: ${event.data.stage}`);
          break;
      }
    }
  );

  console.log("\n--- Stage 1: Cognitive Mill ---\n");

  // Cognitive Mill concepts
  const millConcepts = [
    { id: "tokens", xp: 50 },
    { id: "embeddings", xp: 75 },
    { id: "attention", xp: 100 },
    { id: "transformers", xp: 150 },
  ];

  // Create learning agents
  await coordinator.spawnAgent("zooplankton-tutor", "zooplankton", async (task) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { lesson: "Tokens explained..." };
  });

  await coordinator.spawnAgent("herring-tutor", "herring", async (task) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { lesson: "Attention mechanisms explained..." };
  });

  // Learn concepts
  for (const concept of millConcepts) {
    await coordinator.recordConceptLearned(concept.id, concept.xp);
  }

  // Solve puzzles
  for (let i = 0; i < 5; i++) {
    await coordinator.recordPuzzleSolved();
  }

  // Try to advance
  await coordinator.advanceToStage(LearningStage.INTELLIGENCE_RANCH);

  console.log("\n--- Stage 2: Intelligence Ranch ---\n");

  // Intelligence Ranch concepts
  const ranchConcepts = [
    { id: "fine_tuning", xp: 100 },
    { id: "lora", xp: 125 },
    { id: "slm", xp: 150 },
    { id: "training_loop", xp: 100 },
  ];

  // Create training agents
  await coordinator.spawnAgent("deckhand-trainer", "deckhand", async (task) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { training: "LoRA adapter training..." };
  });

  await coordinator.spawnAgent("captain-guide", "captain", async (task) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { strategy: "Training strategy..." };
  });

  // Learn concepts
  for (const concept of ranchConcepts) {
    await coordinator.recordConceptLearned(concept.id, concept.xp);
  }

  // Solve more puzzles
  for (let i = 0; i < 10; i++) {
    await coordinator.recordPuzzleSolved();
  }

  // Try to advance
  await coordinator.advanceToStage(LearningStage.SITKA_SOUND);

  console.log("\n--- Stage 3: Sitka Sound ---\n");

  // Sitka Sound concepts
  const sitkaConcepts = [
    { id: "multi_agent", xp: 150 },
    { id: "game_theory", xp: 125 },
    { id: "emergence", xp: 175 },
    { id: "coordination", xp: 150 },
  ];

  // Create multi-agent system
  await coordinator.spawnAgent("whale-coordinator", "whale", async (task) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { orchestration: "Multi-agent coordination..." };
  });

  // Learn concepts
  for (const concept of sitkaConcepts) {
    await coordinator.recordConceptLearned(concept.id, concept.xp);
  }

  // Solve final puzzles
  for (let i = 0; i < 5; i++) {
    await coordinator.recordPuzzleSolved();
  }

  // Final summary
  const progress = coordinator.learningProgress;
  const status = await coordinator.getStatus();

  console.log("\n=== Journey Complete ===\n");
  console.log("Final Progress:");
  console.log(`  Level: ${progress.level}`);
  console.log(`  Total XP: ${progress.totalXp}`);
  console.log(`  Concepts: ${progress.conceptsLearned.length}`);
  console.log(`  Puzzles: ${progress.puzzlesSolved}`);
  console.log(`  Achievements: ${progress.achievementsUnlocked.length}`);
  console.log(`  Current Stage: ${progress.currentStage}`);
  console.log(`\nAgent Statistics:`);
  console.log(`  Total Agents: ${status.agents.totalAgents}`);
  console.log(`  Tasks Completed: ${status.tasks.completed}`);

  await coordinator.stop();
}

/**
 * Example 5: Event-Driven Visualization
 *
 * Shows how to use events to drive visualizations in Godot or other UI.
 */
export async function exampleEventVisualization() {
  console.log("\n=== Event-Driven Visualization ===\n");

  const coordinator = await startCoordinator({
    name: "visualization-demo",
    debug: false,
  });

  // Track agent states for visualization
  const agentStates = new Map<string, string>();

  coordinator.eventBus.subscribe(
    [EventType.AGENT_STATE_CHANGED],
    (event) => {
      const { agentId, state } = event.data as { agentId: string; state: string };
      agentStates.set(agentId, state);

      // Trigger visualization update
      console.log(`[VISUALIZATION] Agent ${agentId} is now ${state}`);
      // In production, this would send to Godot via WebSocket
    }
  );

  // Track task progress
  coordinator.eventBus.subscribe(
    [EventType.TASK_QUEUED, EventType.TASK_STARTED, EventType.TASK_COMPLETED],
    (event) => {
      console.log(
        `[VISUALIZATION] Task ${event.type}: ${event.data.taskId || event.data.description}`
      );
      // Update task progress bar in UI
    }
  );

  // Track achievements for celebration effects
  coordinator.eventBus.subscribe([EventType.ACHIEVEMENT_UNLOCKED], (event) => {
    console.log(
      `[VISUALIZATION] 🎉 Achievement unlocked: ${event.data.name}`
    );
    // Trigger particle burst in Godot
  });

  // Track stage completion
  coordinator.eventBus.subscribe([EventType.STAGE_COMPLETED], (event) => {
    console.log(`[VISUALIZATION] 🚀 Stage completed: ${event.data.stage}`);
    // Transition to new stage scene
  });

  // Simulate some activity
  const agent = await coordinator.spawnAgent(
    "demo-agent",
    "zooplankton",
    async (task) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { done: true };
    }
  );

  const task: Task = {
    id: "demo-task",
    description: "Demo task",
    requiredCapabilities: ["token"],
    payload: {},
    priority: TaskPriority.MEDIUM,
    timeout: 300,
    maxRetries: 3,
    dependencies: [],
    metadata: {},
    createdAt: new Date(),
    status: TaskStatus.PENDING,
    retryCount: 0,
  };

  await coordinator.submitTask(task, true);
  await coordinator.recordConceptLearned("tokens", 50);

  await coordinator.stop();
}

/**
 * Run all examples (for demonstration)
 */
export async function runAllExamples() {
  await exampleCognitiveMillTutorial();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await exampleIntelligenceRanch();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await exampleSitkaSound();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await exampleLearningJourney();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  await exampleEventVisualization();
}
