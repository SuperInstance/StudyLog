/**
 * LessonManager.ts
 *
 * Educational content framework for StudyLoG.AI
 * Manages lessons, exercises, hints, and achievement tracking
 */

import type {
  Lesson,
  Exercise,
  Hint,
  Achievement,
  StudentProgress,
  TestCase,
  ExerciseVerification,
} from "../types/index.js";
import {
  GodotIntegrationError,
  ErrorCode,
} from "../types/index.js";

export interface ExerciseSubmission {
  exercise_id: string;
  answer: unknown;
  timestamp: number;
  time_spent: number;
  hints_used: number;
}

export interface ExerciseResult {
  success: boolean;
  feedback: string;
  xp_earned: number;
  next_exercise?: string;
  achievements_unlocked: string[];
}

export interface HintRequest {
  exercise_id: string;
  hint_level: number;
  timestamp: number;
}

/**
 * Manages educational content and student progress
 */
export class LessonManager {
  private lessons: Map<string, Lesson> = new Map();
  private achievements: Map<string, Achievement> = new Map();
  private studentProgress: Map<string, StudentProgress> = new Map();
  private hintHistory: Map<string, HintRequest[]> = new Map();

  constructor() {
    this._registerDefaultContent();
  }

  // ========================================================================
  // Lesson Management
  // ========================================================================

  /**
   * Register a lesson
   */
  registerLesson(lesson: Lesson): void {
    // Validate lesson
    this._validateLesson(lesson);

    this.lessons.set(lesson.id, lesson);

    // Register achievements linked to this lesson
    for (const exercise of lesson.exercises) {
      if (exercise.completion_message) {
        // Auto-generate achievement for exercise completion
        // This would be expanded in a full implementation
      }
    }
  }

  /**
   * Register multiple lessons
   */
  registerLessons(lessons: Lesson[]): void {
    for (const lesson of lessons) {
      this.registerLesson(lesson);
    }
  }

  /**
   * Get a lesson by ID
   */
  getLesson(lessonId: string): Lesson | undefined {
    return this.lessons.get(lessonId);
  }

  /**
   * Get all lessons
   */
  getAllLessons(): Lesson[] {
    return Array.from(this.lessons.values());
  }

  /**
   * Get lessons by stage
   */
  getLessonsByStage(
    stage: "cognitive_mill" | "intelligence_ranch" | "sitka_sound" | "digital_twins"
  ): Lesson[] {
    return Array.from(this.lessons.values()).filter((l) => l.stage === stage);
  }

  /**
   * Get lessons by difficulty
   */
  getLessonsByDifficulty(difficulty: 1 | 2 | 3 | 4 | 5): Lesson[] {
    return Array.from(this.lessons.values()).filter(
      (l) => l.difficulty === difficulty
    );
  }

  /**
   * Get available lessons for a student (based on prerequisites)
   */
  getAvailableLessons(userId: string): Lesson[] {
    const progress = this.getStudentProgress(userId);

    return Array.from(this.lessons.values()).filter((lesson) => {
      // Check if lesson already completed
      if (progress.completed_lessons.includes(lesson.id)) {
        return false;
      }

      // Check prerequisites
      return lesson.prerequisites.every((prereq) =>
        progress.completed_lessons.includes(prereq)
      );
    });
  }

  // ========================================================================
  // Exercise Management
  // ========================================================================

  /**
   * Get an exercise from a lesson
   */
  getExercise(lessonId: string, exerciseId: string): Exercise | undefined {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) return undefined;

    return lesson.exercises.find((e) => e.id === exerciseId);
  }

  /**
   * Submit an exercise answer
   */
  async submitExercise(
    userId: string,
    lessonId: string,
    exerciseId: string,
    answer: unknown,
    timeSpent: number = 0
  ): Promise<ExerciseResult> {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) {
      throw new GodotIntegrationError(
        ErrorCode.INVALID_LESSON,
        `Lesson not found: ${lessonId}`
      );
    }

    const exercise = lesson.exercises.find((e) => e.id === exerciseId);
    if (!exercise) {
      throw new GodotIntegrationError(
        ErrorCode.EXERCISE_FAILED,
        `Exercise not found: ${exerciseId}`
      );
    }

    const progress = this.getStudentProgress(userId);

    // Check hints used
    const hintKey = `${userId}:${exerciseId}`;
    const hintsUsed = this.hintHistory.get(hintKey)?.length || 0;

    // Verify answer
    const verification = exercise.verification;
    let success = false;
    let feedback = "";

    if (verification) {
      success = await this._verifyAnswer(answer, verification);
    } else {
      // Default: just check if not null/empty
      success = answer !== null && answer !== undefined && answer !== "";
    }

    feedback = success
      ? exercise.completion_message
      : "Not quite right. Try again!";

    // Calculate XP
    let xpEarned = success ? exercise.xp_reward : 0;

    // Apply hint penalty
    if (hintsUsed > 0 && exercise.hints) {
      for (let i = 0; i < hintsUsed; i++) {
        const hint = exercise.hints[i];
        if (hint.penalty) {
          xpEarned = Math.max(0, xpEarned - hint.penalty);
        }
      }
    }

    // Update progress
    if (success) {
      if (!progress.completed_exercises.includes(exerciseId)) {
        progress.completed_exercises.push(exerciseId);
      }

      // Check if lesson is complete
      const lessonExercises = lesson.exercises.map((e) => e.id);
      const completedInLesson = lessonExercises.filter((id) =>
        progress.completed_exercises.includes(id)
      );

      if (completedInLesson.length === lessonExercises.length) {
        if (!progress.completed_lessons.includes(lessonId)) {
          progress.completed_lessons.push(lessonId);
          progress.xp += lesson.xp_reward;
        }
      }

      progress.xp += xpEarned;
      progress.last_activity = Date.now();

      // Check for achievements
      const unlocked = this._checkAchievements(userId, progress);

      this.saveStudentProgress(userId);

      return {
        success,
        feedback,
        xp_earned: xpEarned,
        next_exercise: this._getNextExercise(lessonId, exerciseId),
        achievements_unlocked: unlocked,
      };
    }

    return {
      success: false,
      feedback,
      xp_earned: 0,
    };
  }

  /**
   * Get a hint for an exercise
   */
  getHint(
    userId: string,
    exerciseId: string,
    hintLevel: number = 1
  ): Hint | null {
    const exercise = this._findExerciseById(exerciseId);
    if (!exercise || !exercise.hints) {
      return null;
    }

    const hint = exercise.hints.find((h) => h.level === hintLevel);
    if (!hint) {
      return null;
    }

    // Record hint usage
    const key = `${userId}:${exerciseId}`;
    if (!this.hintHistory.has(key)) {
      this.hintHistory.set(key, []);
    }
    this.hintHistory.get(key)!.push({
      exercise_id: exerciseId,
      hint_level: hintLevel,
      timestamp: Date.now(),
    });

    return hint;
  }

  /**
   * Get remaining hints for an exercise
   */
  getRemainingHints(userId: string, exerciseId: string): number {
    const exercise = this._findExerciseById(exerciseId);
    if (!exercise || !exercise.hints) {
      return 0;
    }

    const key = `${userId}:${exerciseId}`;
    const used = this.hintHistory.get(key)?.length || 0;

    return Math.max(0, exercise.hints.length - used);
  }

  // ========================================================================
  // Student Progress
  // ========================================================================

  /**
   * Get student progress
   */
  getStudentProgress(userId: string): StudentProgress {
    if (!this.studentProgress.has(userId)) {
      this.studentProgress.set(userId, {
        user_id: userId,
        current_stage: "cognitive_mill",
        completed_lessons: [],
        completed_exercises: [],
        achievements: [],
        xp: 0,
        streak_days: 0,
        last_activity: Date.now(),
        tutorial_progress: [],
      });
    }
    return this.studentProgress.get(userId)!;
  }

  /**
   * Save student progress
   */
  saveStudentProgress(userId: string): void {
    const progress = this.studentProgress.get(userId);
    if (progress) {
      // In a real implementation, save to database
      console.log(`Saving progress for ${userId}:`, progress);
    }
  }

  /**
   * Load student progress
   */
  loadStudentProgress(userId: string, progress: StudentProgress): void {
    this.studentProgress.set(userId, progress);
  }

  /**
   * Reset student progress
   */
  resetStudentProgress(userId: string): void {
    this.studentProgress.delete(userId);
  }

  // ========================================================================
  // Achievement Management
  // ========================================================================

  /**
   * Register an achievement
   */
  registerAchievement(achievement: Achievement): void {
    this.achievements.set(achievement.id, achievement);
  }

  /**
   * Get an achievement
   */
  getAchievement(achievementId: string): Achievement | undefined {
    return this.achievements.get(achievementId);
  }

  /**
   * Get all achievements
   */
  getAllAchievements(): Achievement[] {
    return Array.from(this.achievements.values());
  }

  /**
   * Get unlocked achievements for a student
   */
  getUnlockedAchievements(userId: string): Achievement[] {
    const progress = this.getStudentProgress(userId);
    return progress.achievements
      .map((id) => this.achievements.get(id))
      .filter((a) => a !== undefined) as Achievement[];
  }

  /**
   * Get locked achievements for a student
   */
  getLockedAchievements(userId: string): Achievement[] {
    const progress = this.getStudentProgress(userId);
    const unlocked = new Set(progress.achievements);

    return Array.from(this.achievements.values()).filter(
      (a) => !unlocked.has(a.id) && !a.hidden
    );
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  /**
   * Get learning statistics for a student
   */
  getStudentStats(userId: string): {
    total_xp: number;
    lessons_completed: number;
    exercises_completed: number;
    achievements_unlocked: number;
    current_stage: string;
    completion_percentage: number;
  } {
    const progress = this.getStudentProgress(userId);
    const totalLessons = this.lessons.size;
    const totalExercises = Array.from(this.lessons.values()).reduce(
      (sum, lesson) => sum + lesson.exercises.length,
      0
    );

    return {
      total_xp: progress.xp,
      lessons_completed: progress.completed_lessons.length,
      exercises_completed: progress.completed_exercises.length,
      achievements_unlocked: progress.achievements.length,
      current_stage: progress.current_stage,
      completion_percentage:
        totalLessons > 0
          ? (progress.completed_lessons.length / totalLessons) * 100
          : 0,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private _validateLesson(lesson: Lesson): void {
    if (!lesson.id) {
      throw new Error("Lesson must have an ID");
    }
    if (!lesson.title) {
      throw new Error("Lesson must have a title");
    }
    if (!lesson.stage) {
      throw new Error("Lesson must have a stage");
    }
    if (!lesson.exercises || lesson.exercises.length === 0) {
      throw new Error("Lesson must have at least one exercise");
    }

    // Validate exercises
    for (const exercise of lesson.exercises) {
      if (!exercise.id) {
        throw new Error("Exercise must have an ID");
      }
      if (!exercise.title) {
        throw new Error("Exercise must have a title");
      }
    }
  }

  private _findExerciseById(exerciseId: string): Exercise | undefined {
    for (const lesson of this.lessons.values()) {
      const exercise = lesson.exercises.find((e) => e.id === exerciseId);
      if (exercise) {
        return exercise;
      }
    }
    return undefined;
  }

  private async _verifyAnswer(
    answer: unknown,
    verification: ExerciseVerification
  ): Promise<boolean> {
    switch (verification.type) {
      case "auto":
        if (verification.test_cases) {
          return this._runTestCases(answer, verification.test_cases);
        }
        return false;

      case "ai":
        // Would call AI to verify
        return true;

      case "peer":
        // Would be verified by peer review
        return true;

      default:
        return false;
    }
  }

  private _runTestCases(answer: unknown, testCases: TestCase[]): boolean {
    // This is a simplified version
    // In reality, would need to execute code or compare outputs
    return testCases.every((testCase) => {
      return JSON.stringify(answer) === JSON.stringify(testCase.expected_output);
    });
  }

  private _getNextExercise(
    lessonId: string,
    currentExerciseId: string
  ): string | undefined {
    const lesson = this.lessons.get(lessonId);
    if (!lesson) return undefined;

    const currentIndex = lesson.exercises.findIndex(
      (e) => e.id === currentExerciseId
    );

    if (currentIndex >= 0 && currentIndex < lesson.exercises.length - 1) {
      return lesson.exercises[currentIndex + 1].id;
    }

    return undefined;
  }

  private _checkAchievements(
    userId: string,
    progress: StudentProgress
  ): string[] {
    const unlocked: string[] = [];

    for (const achievement of this.achievements.values()) {
      if (progress.achievements.includes(achievement.id)) {
        continue;
      }

      if (this._checkAchievementCondition(achievement, progress)) {
        progress.achievements.push(achievement.id);
        progress.xp += achievement.xp_reward;
        unlocked.push(achievement.id);
      }
    }

    return unlocked;
  }

  private _checkAchievementCondition(
    achievement: Achievement,
    progress: StudentProgress
  ): boolean {
    const condition = achievement.unlock_condition;

    switch (condition.type) {
      case "lesson_complete":
        return progress.completed_lessons.includes(
          condition.value as string
        );

      case "exercise_count":
        return progress.completed_exercises.length >= (condition.value as number);

      case "streak":
        return progress.streak_days >= (condition.value as number);

      case "discovery":
        // Would check for specific discovery events
        return false;

      case "custom":
        // Custom condition logic
        return false;

      default:
        return false;
    }
  }

  private _registerDefaultContent(): void {
    // Cognitive Mill - Basic Lessons
    this.registerLesson({
      id: "cm_basics_01",
      title: "Introduction to Neural Networks",
      description: "Learn the basics of how AI models process information",
      stage: "cognitive_mill",
      difficulty: 1,
      prerequisites: [],
      learning_objectives: [
        "Understand what a neural network is",
        "Learn about nodes and connections",
        "See how data flows through a network",
      ],
      exercises: [
        {
          id: "cm_basics_01_q1",
          type: "quiz",
          title: "What is a Neural Network?",
          prompt:
            "A neural network is inspired by the structure of what biological system?",
          hints: [
            {
              level: 1,
              text: "Think about the human body...",
              penalty: 10,
            },
            {
              level: 2,
              text: "It's inside your head right now!",
              penalty: 20,
            },
          ],
          completion_message:
            "Correct! Neural networks are inspired by the human brain's structure of neurons and synapses.",
          xp_reward: 50,
        },
        {
          id: "cm_basics_01_sim1",
          type: "simulation",
          title: "Build Your First Network",
          prompt:
            "Use the visual editor to connect 3 input nodes to 2 output nodes.",
          hints: [
            {
              level: 1,
              text: "Click and drag from input nodes to create connections",
              penalty: 5,
            },
          ],
          verification: {
            type: "auto",
          },
          completion_message:
            "Great job! You've created your first neural network visualization.",
          xp_reward: 100,
        },
      ],
      estimated_duration: 15,
      xp_reward: 200,
    });

    // Register default achievements
    this.registerAchievement({
      id: "first_neural_net",
      title: "Network Architect",
      description: "Complete your first neural network exercise",
      icon: "network",
      rarity: "common",
      unlock_condition: {
        type: "exercise_count",
        value: 1,
      },
      xp_reward: 50,
    });

    this.registerAchievement({
      id: "lesson_master_1",
      title: "Quick Learner",
      description: "Complete your first lesson",
      icon: "book",
      rarity: "common",
      unlock_condition: {
        type: "lesson_complete",
        value: "cm_basics_01",
      },
      xp_reward: 100,
    });

    this.registerAchievement({
      id: "xp_collector_100",
      title: "Knowledge Seeker",
      description: "Earn 100 total XP",
      icon: "star",
      rarity: "common",
      unlock_condition: {
        type: "exercise_count",
        value: 100,
      },
      xp_reward: 50,
    });
  }
}

// ==============================================================================
// Factory Functions
// ==============================================================================

/**
 * Create a lesson manager with default content
 */
export function createLessonManager(): LessonManager {
  return new LessonManager();
}
