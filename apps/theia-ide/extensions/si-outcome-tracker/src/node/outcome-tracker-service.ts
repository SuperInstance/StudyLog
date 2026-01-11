/**
 * Outcome Tracker Backend Service
 *
 * Provides backend services for outcome tracking with persistent storage
 */

import { injectable } from '@theia/core/shared/inversify';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  OutcomeRecord,
  OutcomeStatistics,
  StudyLogRewardDomain,
  LearningContext
} from '../common/outcome-types';
import { OutcomeTracker } from '../common/outcome-tracker';

export interface OutcomeTrackerConfig {
  dataDirectory?: string;
  autoSave?: boolean;
  saveInterval?: number; // milliseconds
}

@injectable()
export class OutcomeTrackerService {
  private tracker: OutcomeTracker;
  private saveTimer?: NodeJS.Timeout;
  private config: Required<OutcomeTrackerConfig>;

  constructor(config: OutcomeTrackerConfig = {}) {
    this.config = {
      dataDirectory: config.dataDirectory || path.join(process.cwd(), 'data', 'outcomes'),
      autoSave: config.autoSave ?? true,
      saveInterval: config.saveInterval || 30000 // 30 seconds default
    };

    this.tracker = new OutcomeTracker();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadOutcomes();
      console.log('[OutcomeTrackerService] Loaded existing outcomes');

      if (this.config.autoSave) {
        this.startAutoSave();
      }
    } catch (error) {
      console.error('[OutcomeTrackerService] Failed to load outcomes:', error);
    }
  }

  /**
   * Track an immediate learning outcome
   */
  async trackImmediateOutcome(
    decisionId: string,
    description: string,
    success: boolean,
    context: LearningContext
  ): Promise<OutcomeRecord> {
    const outcome = this.tracker.trackImmediateOutcome(
      decisionId,
      description,
      success,
      context
    );

    if (this.config.autoSave) {
      await this.saveOutcomes();
    }

    return outcome;
  }

  /**
   * Track a delayed learning outcome
   */
  async trackDelayedOutcome(
    decisionId: string,
    description: string,
    success: boolean,
    context: LearningContext,
    outcomeType: string,
    relatedDecisions: string[] = []
  ): Promise<OutcomeRecord> {
    const outcome = this.tracker.trackDelayedOutcome(
      decisionId,
      description,
      success,
      context,
      outcomeType as any,
      relatedDecisions
    );

    if (this.config.autoSave) {
      await this.saveOutcomes();
    }

    return outcome;
  }

  /**
   * Get outcomes for a specific decision
   */
  getOutcomesForDecision(decisionId: string): OutcomeRecord[] {
    return this.tracker.getOutcomesForDecision(decisionId);
  }

  /**
   * Get aggregate reward for a decision
   */
  getAggregateReward(decisionId: string, domain?: string): number {
    return this.tracker.getAggregateReward(
      decisionId,
      domain as StudyLogRewardDomain | undefined
    );
  }

  /**
   * Get success rate
   */
  getSuccessRate(decisionType?: string): number {
    return this.tracker.getSuccessRate(decisionType);
  }

  /**
   * Get outcome statistics
   */
  getStatistics(): OutcomeStatistics {
    return this.tracker.getStatistics();
  }

  /**
   * Analyze decision quality
   */
  analyzeDecisionQuality(decisionId: string): ReturnType<typeof this.tracker.analyzeDecisionQuality> {
    return this.tracker.analyzeDecisionQuality(decisionId);
  }

  /**
   * Get all outcomes
   */
  getAllOutcomes(): OutcomeRecord[] {
    return this.tracker.getAllOutcomes();
  }

  /**
   * Get domain summary
   */
  getDomainSummary(): Record<string, {
    count: number;
    successRate: number;
    avgReward: number;
    totalReward: number;
  }> {
    const { DomainAggregator } = require('../common/outcome-aggregators');
    const aggregator = new DomainAggregator(this.tracker);
    return aggregator.getDomainSummary();
  }

  /**
   * Get student ranking
   */
  getStudentRanking(): Array<[string, number]> {
    const { StudentAggregator } = require('../common/outcome-aggregators');
    const aggregator = new StudentAggregator(this.tracker);
    return aggregator.getStudentRanking();
  }

  /**
   * Get outcomes aggregated by time window
   */
  aggregateByTimeWindow(minutes: number): ReturnType<typeof this.tracker.getAllOutcomes> {
    const { TimeWindowAggregator } = require('../common/outcome-aggregators');
    const aggregator = new TimeWindowAggregator(this.tracker);
    return aggregator.aggregateLastNMinutes(minutes);
  }

  /**
   * Export outcomes to JSON
   */
  async exportOutcomes(filepath?: string): Promise<string> {
    const data = this.tracker.exportToJson();
    const outputPath = filepath || path.join(this.config.dataDirectory, 'outcomes-export.json');

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));

    console.log(`[OutcomeTrackerService] Exported ${data.outcomes.length} outcomes to ${outputPath}`);
    return outputPath;
  }

  /**
   * Import outcomes from JSON
   */
  async importOutcomes(filepath: string): Promise<void> {
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    this.tracker.importFromJson(data);

    if (this.config.autoSave) {
      await this.saveOutcomes();
    }

    console.log(`[OutcomeTrackerService] Imported outcomes from ${filepath}`);
  }

  /**
   * Clear all outcomes
   */
  async clearOutcomes(): Promise<void> {
    this.tracker.clear();
    await this.saveOutcomes();
  }

  /**
   * Save outcomes to disk
   */
  private async saveOutcomes(): Promise<void> {
    try {
      const data = this.tracker.exportToJson();
      await fs.mkdir(this.config.dataDirectory, { recursive: true });

      const filepath = path.join(this.config.dataDirectory, 'outcomes.json');
      await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[OutcomeTrackerService] Failed to save outcomes:', error);
    }
  }

  /**
   * Load outcomes from disk
   */
  private async loadOutcomes(): Promise<void> {
    try {
      const filepath = path.join(this.config.dataDirectory, 'outcomes.json');
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content);

      this.tracker.importFromJson(data);
    } catch (error) {
      // No existing outcomes file
      console.log('[OutcomeTrackerService] No existing outcomes found');
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave();
    this.saveTimer = setInterval(() => {
      this.saveOutcomes();
    }, this.config.saveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = undefined;
    }
  }

  /**
   * Dispose of the service
   */
  dispose(): void {
    this.stopAutoSave();
    this.saveOutcomes();
  }
}
