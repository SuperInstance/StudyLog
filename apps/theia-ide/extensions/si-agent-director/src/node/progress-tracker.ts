/**
 * Progress Tracker
 *
 * Tracks student progress and unlocks features based on completed puzzles.
 * Uses D1 for persistent storage.
 */

import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Puzzle {
  id: string;
  stage: number;
  tasks: string[];
  reward: string;
}

export interface StudentProgress {
  userId: string;
  currentStage: number;
  completedPuzzles: string[];
  unlockedFeatures: string[];
  agentStats: {
    totalCost: number;
    totalTokens: number;
    agentsCreated: number;
  };
}

@injectable()
export class ProgressTracker {
  private progress: Map<string, StudentProgress> = new Map();
  private puzzles: Map<string, Puzzle> = new Map();

  constructor() {
    this.loadPuzzles();
    this.loadProgress();
  }

  async completePuzzle(puzzleId: string, userId = 'default'): Promise<void> {
    const puzzle = this.puzzles.get(puzzleId);
    if (!puzzle) {
      throw new Error(`Unknown puzzle: ${puzzleId}`);
    }

    const progress = this.getOrCreateProgress(userId);

    if (progress.completedPuzzles.includes(puzzleId)) {
      return; // Already completed
    }

    progress.completedPuzzles.push(puzzleId);

    // Check if stage should advance
    const stagePuzzles = Array.from(this.puzzles.values()).filter((p) => p.stage === puzzle.stage);
    const completedInStage = stagePuzzles.filter((p) => progress.completedPuzzles.includes(p.id));

    if (completedInStage.length === stagePuzzles.length) {
      // All puzzles in stage complete, advance to next stage
      progress.currentStage = puzzle.stage + 1;
    }

    // Unlock reward
    if (puzzle.reward && !progress.unlockedFeatures.includes(puzzle.reward)) {
      progress.unlockedFeatures.push(puzzle.reward);
    }

    await this.saveProgress();
  }

  async getProgress(userId = 'default'): Promise<{
    currentStage: number;
    completedPuzzles: string[];
    unlockedFeatures: string[];
  }> {
    const progress = this.progress.get(userId);
    return {
      currentStage: progress?.currentStage || 1,
      completedPuzzles: progress?.completedPuzzles || [],
      unlockedFeatures: progress?.unlockedFeatures || [],
    };
  }

  isFeatureUnlocked(feature: string, userId = 'default'): boolean {
    const progress = this.progress.get(userId);
    return progress?.unlockedFeatures.includes(feature) || false;
  }

  isStageUnlocked(stage: number, userId = 'default'): boolean {
    const progress = this.progress.get(userId);
    return (progress?.currentStage || 1) >= stage;
  }

  private getOrCreateProgress(userId: string): StudentProgress {
    if (!this.progress.has(userId)) {
      this.progress.set(userId, {
        userId,
        currentStage: 1,
        completedPuzzles: [],
        unlockedFeatures: [],
        agentStats: {
          totalCost: 0,
          totalTokens: 0,
          agentsCreated: 0,
        },
      });
    }
    return this.progress.get(userId)!;
  }

  private async loadPuzzles(): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), 'config', 'unlock-criteria.json');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(content);

      if (config.puzzles) {
        for (const [id, puzzle] of Object.entries(config.puzzles)) {
          this.puzzles.set(id, puzzle as Puzzle);
        }
      }
    } catch (error) {
      console.error('[ProgressTracker] Failed to load puzzles:', error);
    }
  }

  private async loadProgress(): Promise<void> {
    try {
      const progressPath = path.join(process.cwd(), 'data', 'progress.json');
      const content = await fs.readFile(progressPath, 'utf-8');
      const data = JSON.parse(content);

      for (const [userId, progress] of Object.entries(data)) {
        this.progress.set(userId, progress as StudentProgress);
      }
    } catch (error) {
      console.error('[ProgressTracker] Failed to load progress:', error);
      // Start with empty progress
    }
  }

  private async saveProgress(): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });

      const progressPath = path.join(dataDir, 'progress.json');
      const data: Record<string, StudentProgress> = {};

      for (const [userId, progress] of this.progress.entries()) {
        data[userId] = progress;
      }

      await fs.writeFile(progressPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[ProgressTracker] Failed to save progress:', error);
    }
  }
}
