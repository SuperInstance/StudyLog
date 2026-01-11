/**
 * Dog Training System
 *
 * Progressive skill development for herding dogs.
 * Puppies practice on geese/chickens before advancing to real herd work.
 *
 * @fileoverview Puppy training and skill progression system
 */

import type {
  HerdingDog,
  DogCommand,
  DogSkill,
  DogSkillLevel,
  TrainingSession,
  TrainingTarget,
  Animal,
  Position3D,
  AIComplexityStage,
  AnimalState,
} from './types.js';
import { TRAINING_TARGETS, getSpecies, ANIMAL_TRAITS } from './species-registry.js';

// ============================================================================
// Training Configuration
// ============================================================================

interface TrainingConfig {
  /** Base XP required per skill level */
  baseXPPerLevel: number;
  /** XP multiplier for successful commands */
  successXP: number;
  /** XP for failed attempts (learning from mistakes) */
  failureXP: number;
  /** Daily training limit (minutes) */
  dailyTrainingLimit: number;
  /** Stamina cost per command */
  staminaCost: number;
  /** Focus recovery rate per second */
  focusRecoveryRate: number;
  /** Bond increase rate per successful interaction */
  bondIncreaseRate: number;
}

// ============================================================================
// Command Execution Result
// ============================================================================

interface CommandResult {
  /** Whether the command was successful */
  success: boolean;
  /** Experience points gained */
  experienceGained: number;
  /** Time taken to execute (ms) */
  executionTime: number;
  /** Stamina consumed */
  staminaConsumed: number;
  /** Any notes about the execution */
  notes: string[];
  /** New skill level (if leveled up) */
  newLevel?: DogSkillLevel;
}

// ============================================================================
// Dog Training Manager Class
// ============================================================================

export class DogTrainingManager {
  private config: TrainingConfig;
  private activeSessions: Map<string, TrainingSession> = new Map();

  constructor(config: Partial<TrainingConfig> = {}) {
    this.config = {
      baseXPPerLevel: 100,
      successXP: 25,
      failureXP: 5,
      dailyTrainingLimit: 30,
      staminaCost: 10,
      focusRecoveryRate: 0.05,
      bondIncreaseRate: 0.02,
      ...config,
    };
  }

  // ============================================================================
  // Skill Management
  // ============================================================================

  /**
   * Get or create a dog skill.
   */
  getSkill(dog: HerdingDog, command: DogCommand): DogSkill {
    if (!dog.dog.skills[command]) {
      dog.dog.skills[command] = {
        command,
        level: DogSkillLevel.NOVICE,
        experience: 0,
        successRate: 0.5,
        timesUsed: 0,
        timesSucceeded: 0,
        lastPracticed: Date.now(),
      };
    }
    return dog.dog.skills[command]!;
  }

  /**
   * Execute a command and calculate results.
   */
  executeCommand(
    dog: HerdingDog,
    command: DogCommand,
    targetAnimals: Animal[],
    targetPosition?: Position3D
  ): CommandResult {
    const skill = this.getSkill(dog, command);
    const notes: string[] = [];

    // Check stamina
    if (dog.dog.stamina < this.config.staminaCost * 0.2) {
      return {
        success: false,
        experienceGained: 0,
        executionTime: 0,
        staminaConsumed: 0,
        notes: ['dog_too_tired'],
      };
    }

    // Calculate success probability
    let successChance = skill.successRate;

    // Apply trait modifiers
    for (const trait of dog.traits) {
      if (trait.modifiers.successRate) {
        successChance *= trait.modifiers.successRate;
      }
    }

    // Apply focus modifier
    successChance *= (0.5 + dog.dog.focus * 0.5);

    // Apply bond modifier
    successChance *= (0.7 + dog.dog.bond * 0.3);

    // Apply difficulty modifier based on target animals
    if (targetAnimals.length > 0) {
      const avgDifficulty = this.calculateTargetDifficulty(targetAnimals);
      successChance /= avgDifficulty;
    }

    // Low stamina affects success
    if (dog.dog.stamina < this.config.staminaCost * 0.5) {
      successChance *= 0.7;
      notes.push('low_stamina');
    }

    // Roll for success
    const success = Math.random() < successChance;

    // Calculate results
    const staminaConsumed = this.config.staminaCost *
      (1 + (targetAnimals.length > 10 ? 0.5 : 0));
    dog.dog.stamina = Math.max(0, dog.dog.stamina - staminaConsumed);

    let experienceGained = success ? this.config.successXP : this.config.failureXP;

    // Scale XP by difficulty
    if (targetAnimals.length > 0) {
      const avgDifficulty = this.calculateTargetDifficulty(targetAnimals);
      experienceGained *= avgDifficulty;
    }

    // Update skill statistics
    skill.timesUsed++;
    if (success) {
      skill.timesSucceeded++;
      dog.dog.successfulSessions++;
    }

    // Update success rate (moving average)
    skill.successRate = this.calculateRollingSuccessRate(skill);

    // Apply XP
    const previousLevel = skill.level;
    const levelUp = this.addExperience(skill, experienceGained);

    // Update bond on success
    if (success) {
      dog.dog.bond = Math.min(1, dog.dog.bond + this.config.bondIncreaseRate);
    }

    // Update dog's overall level
    this.updateOverallLevel(dog);

    // Set command state
    dog.state = success ? AnimalState.HERDING : AnimalState.IDLE;
    dog.dog.currentCommand = success ? command : undefined;
    dog.dog.commandTarget = targetPosition;

    // Add notes
    if (success) {
      notes.push('command_successful');
    } else {
      notes.push('command_failed');
    }

    if (levelUp) {
      notes.push(`level_up_to_${this.getSkillLevelName(skill.level)}`);
    }

    return {
      success,
      experienceGained,
      executionTime: this.estimateExecutionTime(command, targetAnimals.length),
      staminaConsumed,
      notes,
      newLevel: levelUp ? skill.level : undefined,
    };
  }

  /**
   * Calculate average difficulty of target animals.
   */
  private calculateTargetDifficulty(targets: Animal[]): number {
    if (targets.length === 0) return 1;

    let totalDifficulty = 0;
    for (const target of targets) {
      const trainingTarget = TRAINING_TARGETS[target.speciesId];
      if (trainingTarget) {
        totalDifficulty += trainingTarget.difficulty;
      } else {
        totalDifficulty += 1;
      }
    }

    return totalDifficulty / targets.length;
  }

  /**
   * Add experience to a skill, checking for level up.
   */
  private addExperience(skill: DogSkill, amount: number): boolean {
    skill.experience += amount;
    skill.lastPracticed = Date.now();

    const xpForNext = this.getXPForLevel(skill.level + 1);

    if (skill.experience >= xpForNext && skill.level < DogSkillLevel.MASTER) {
      skill.level++;
      skill.experience = 0;
      skill.successRate = Math.min(0.95, skill.successRate + 0.1);
      return true;
    }

    return false;
  }

  /**
   * Get XP required for a given level.
   */
  private getXPForLevel(level: DogSkillLevel): number {
    return this.config.baseXPPerLevel * Math.pow(1.5, level - 1);
  }

  /**
   * Calculate rolling success rate for a skill.
   */
  private calculateRollingSuccessRate(skill: DogSkill): number {
    if (skill.timesUsed === 0) return 0.5;

    const recentSuccess = skill.timesSucceeded / skill.timesUsed;

    // Blend with base success rate for the level
    const baseSuccessForLevel = 0.5 + (skill.level - 1) * 0.1;

    return Math.min(0.95, (recentSuccess * 0.7 + baseSuccessForLevel * 0.3));
  }

  /**
   * Update overall dog level based on skills.
   */
  private updateOverallLevel(dog: HerdingDog): void {
    const skills = Object.values(dog.dog.skills);
    if (skills.length === 0) {
      dog.dog.overallLevel = DogSkillLevel.NOVICE;
      return;
    }

    const avgLevel = skills.reduce((sum, s) => sum + s.level, 0) / skills.length;

    // Round to nearest level, minimum Novice
    dog.dog.overallLevel = Math.max(
      DogSkillLevel.NOVICE,
      Math.min(DogSkillLevel.MASTER, Math.round(avgLevel))
    );

    // Count mastered commands
    dog.dog.commandsMastered = skills.filter(s => s.level === DogSkillLevel.MASTER).length;
  }

  /**
   * Estimate execution time for a command.
   */
  private estimateExecutionTime(command: DogCommand, animalCount: number): number {
    const baseTime = {
      [DogCommand.BARK]: 500,
      [DogCommand.FLANK_LEFT]: 3000,
      [DogCommand.FLANK_RIGHT]: 3000,
      [DogCommand.CIRCLE]: 5000,
      [DogCommand.GATHER]: 4000,
      [DogCommand.STAY]: 1000,
      [DogCommand.COME]: 2000,
      [DogCommand.WALK_UP]: 2000,
    }[command] || 2000;

    return baseTime + animalCount * 100;
  }

  // ============================================================================
  // Training Sessions
  // ============================================================================

  /**
   * Start a training session.
   */
  startTrainingSession(
    dog: HerdingDog,
    command: DogCommand,
    targetAnimals: Animal[]
  ): TrainingSession {
    const session: TrainingSession = {
      id: crypto.randomUUID(),
      dogId: dog.id,
      targetAnimals: targetAnimals.map(a => a.id),
      command,
      startTime: Date.now(),
      endTime: 0,
      notes: [],
    };

    this.activeSessions.set(session.id, session);
    return session;
  }

  /**
   * Complete a training session.
   */
  completeTrainingSession(
    sessionId: string,
    successful: boolean,
    notes: string[] = []
  ): TrainingSession | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    session.endTime = Date.now();
    session.successful = successful;
    session.notes = notes;

    // Calculate experience based on session duration
    const duration = session.endTime - session.startTime;
    session.experienceGained = Math.floor(duration / 1000) * 2;

    if (successful) {
      session.experienceGained *= 2;
    }

    this.activeSessions.delete(sessionId);
    return session;
  }

  /**
   * Get active training session for a dog.
   */
  getActiveSession(dogId: string): TrainingSession | undefined {
    for (const session of this.activeSessions.values()) {
      if (session.dogId === dogId) {
        return session;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Recovery and Maintenance
  // ============================================================================

  /**
   * Update dog's stamina and focus (call each tick).
   */
  updateDogRecovery(dog: HerdingDog, deltaSeconds: number): void {
    // Recover stamina when not working
    if (dog.state !== AnimalState.HERDING && dog.state !== AnimalState.BARKING) {
      dog.dog.stamina = Math.min(1, dog.dog.stamina + 0.02 * deltaSeconds);
    }

    // Recover focus when not stressed
    if (dog.needs.stress < 0.5) {
      dog.dog.focus = Math.min(1, dog.dog.focus + this.config.focusRecoveryRate * deltaSeconds);
    }

    // Focus decreases with stress
    if (dog.needs.stress > 0.7) {
      dog.dog.focus = Math.max(0.1, dog.dog.focus - 0.01 * deltaSeconds);
    }
  }

  /**
   * Rest the dog to recover stamina.
   */
  restDog(dog: HerdingDog, duration: number): void {
    dog.dog.stamina = Math.min(1, dog.dog.stamina + duration / 10000);
    dog.dog.focus = Math.min(1, dog.dog.focus + duration / 5000);
    dog.needs.energy = Math.max(0, dog.needs.energy - duration / 20000);
    dog.state = AnimalState.SLEEPING;
  }

  // ============================================================================
  // Puppy Development
  // ============================================================================

  /**
   * Create a new puppy with starting stats.
   */
  static createPuppy(
    id: string,
    name: string,
    coatColor: string,
    position: Position3D
  ): HerdingDog {
    const baseAnimal = {
      id,
      speciesId: 'border_collie',
      species: getSpecies('border_collie'),
      engineTier: 0, // Will be set based on ranch
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      state: AnimalState.PLAYING,
      needs: {
        hunger: 0.2,
        energy: 0,
        thirst: 0.2,
        social: 0.3,
        fear: 0.2,
        stress: 0.1,
      },
      memories: [],
      aiStage: AIComplexityStage.PUPPY_TRAINING,
      age: 0,
      health: 100,
      traits: [ANIMAL_TRAITS.swift, ANIMAL_TRAITS.alert],
      lastUpdate: Date.now(),
      spawned: true,
      behaviorPriority: 0.5,
    };

    return {
      ...baseAnimal,
      dog: {
        name,
        coatColor,
        skills: {
          [DogCommand.BARK]: {
            command: DogCommand.BARK,
            level: DogSkillLevel.NOVICE,
            experience: 0,
            successRate: 0.6, // Puppies naturally bark
            timesUsed: 0,
            timesSucceeded: 0,
            lastPracticed: Date.now(),
          },
        },
        overallLevel: DogSkillLevel.NOVICE,
        totalExperience: 0,
        commandsMastered: 0,
        currentCommand: undefined,
        commandTarget: undefined,
        stamina: 1.0,
        focus: 0.8,
        bond: 0.3,
        animalsHerded: 0,
        successfulSessions: 0,
      },
    };
  }

  /**
   * Age up a puppy (for life progression).
   */
  ageUpDog(dog: HerdingDog): void {
    dog.age += 1;

    // Young dogs (0-2) learn faster
    if (dog.age < 2) {
      this.config.successXP *= 1.2;
    }

    // Old dogs (8+) may start declining
    if (dog.age > 8) {
      dog.dog.stamina = Math.max(0.5, dog.dog.stamina * 0.95);
      if (dog.age > 12) {
        for (const skill of Object.values(dog.dog.skills)) {
          skill.successRate *= 0.98;
        }
      }
    }
  }

  // ============================================================================
  // Training Recommendations
  // ============================================================================

  /**
   * Get recommended training targets for a dog's skill level.
   */
  getRecommendedTargets(dog: HerdingDog): TrainingTarget[] {
    const targets: TrainingTarget[] = [];
    const level = dog.dog.overallLevel;

    for (const target of Object.values(TRAINING_TARGETS)) {
      if (target.maxSkillLevel >= level && target.difficulty <= level + 1) {
        targets.push(target);
      }
    }

    // Sort by difficulty
    return targets.sort((a, b) => a.difficulty - b.difficulty);
  }

  /**
   * Get next command to train for a dog.
   */
  getNextCommandToTrain(dog: HerdingDog): DogCommand | null {
    // Find the lowest-level command that can be improved
    const commandOrder: DogCommand[] = [
      DogCommand.BARK,
      DogCommand.COME,
      DogCommand.STAY,
      DogCommand.WALK_UP,
      DogCommand.FLANK_LEFT,
      DogCommand.FLANK_RIGHT,
      DogCommand.GATHER,
      DogCommand.CIRCLE,
    ];

    for (const command of commandOrder) {
      const skill = dog.dog.skills[command];
      if (!skill || skill.level < DogSkillLevel.MASTER) {
        return command;
      }
    }

    return null; // All commands mastered!
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get skill level name as string.
   */
  private getSkillLevelName(level: DogSkillLevel): string {
    return DogSkillLevel[level];
  }

  /**
   * Check if a dog can train on specific targets.
   */
  canTrainOn(dog: HerdingDog, speciesId: string): boolean {
    const target = TRAINING_TARGETS[speciesId];
    if (!target) return false;

    return dog.dog.overallLevel >= Math.max(1, target.maxSkillLevel - 2);
  }

  /**
   * Get training progress percentage for next level.
   */
  getTrainingProgress(dog: HerdingDog, command: DogCommand): number {
    const skill = dog.dog.skills[command];
    if (!skill || skill.level >= DogSkillLevel.MASTER) return 100;

    const xpForNext = this.getXPForLevel(skill.level + 1);
    return (skill.experience / xpForNext) * 100;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a dog training manager with default configuration.
 */
export function createDogTrainingManager(
  config?: Partial<TrainingConfig>
): DogTrainingManager {
  return new DogTrainingManager(config);
}

/**
 * Create a puppy (new herding dog).
 */
export function createPuppy(
  id: string,
  name: string,
  coatColor: string,
  position: Position3D
): HerdingDog {
  return DogTrainingManager.createPuppy(id, name, coatColor, position);
}

/**
 * Get all available dog commands.
 */
export function getAllDogCommands(): DogCommand[] {
  return [
    DogCommand.BARK,
    DogCommand.COME,
    DogCommand.STAY,
    DogCommand.WALK_UP,
    DogCommand.FLANK_LEFT,
    DogCommand.FLANK_RIGHT,
    DogCommand.GATHER,
    DogCommand.CIRCLE,
  ];
}

/**
 * Get command display name.
 */
export function getCommandDisplayName(command: DogCommand): string {
  const names: Record<DogCommand, string> = {
    [DogCommand.BARK]: 'Bark',
    [DogCommand.COME]: 'Come',
    [DogCommand.STAY]: 'Stay',
    [DogCommand.WALK_UP]: 'Walk Up',
    [DogCommand.FLANK_LEFT]: 'Flank Left',
    [DogCommand.FLANK_RIGHT]: 'Flank Right',
    [DogCommand.GATHER]: 'Gather',
    [DogCommand.CIRCLE]: 'Circle',
  };
  return names[command];
}

/**
 * Get skill level display name.
 */
export function getSkillLevelDisplayName(level: DogSkillLevel): string {
  const names: Record<DogSkillLevel, string> = {
    [DogSkillLevel.NOVICE]: 'Novice',
    [DogSkillLevel.APPRENTICE]: 'Apprentice',
    [DogSkillLevel.COMPETENT]: 'Competent',
    [DogSkillLevel.EXPERT]: 'Expert',
    [DogSkillLevel.MASTER]: 'Master',
  };
  return names[level];
}
