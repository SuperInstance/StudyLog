/**
 * Outcome Tracker Frontend Service
 *
 * Frontend service for communicating with the backend outcome tracker
 */

import { injectable } from '@theia/core/shared/inversify';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser';
import {
  OutcomeRecord,
  OutcomeStatistics,
  LearningContext,
  StudyLogRewardDomain
} from '../common/outcome-types';

export const OutcomeTrackerPath = '/services/outcome-tracker';

/**
 * Frontend service interface for outcome tracking
 */
@injectable()
export class OutcomeTrackerFrontendService {
  protected server: Promise<any>;

  constructor() {
    this.server = WebSocketConnectionProvider.createProxy(
      OutcomeTrackerPath,
      {}
    );
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
    const server = await this.server;
    return server.trackImmediateOutcome(decisionId, description, success, context);
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
    const server = await this.server;
    return server.trackDelayedOutcome(
      decisionId,
      description,
      success,
      context,
      outcomeType,
      relatedDecisions
    );
  }

  /**
   * Get outcomes for a specific decision
   */
  async getOutcomesForDecision(decisionId: string): Promise<OutcomeRecord[]> {
    const server = await this.server;
    return server.getOutcomesForDecision(decisionId);
  }

  /**
   * Get aggregate reward for a decision
   */
  async getAggregateReward(decisionId: string, domain?: string): Promise<number> {
    const server = await this.server;
    return server.getAggregateReward(decisionId, domain);
  }

  /**
   * Get success rate
   */
  async getSuccessRate(decisionType?: string): Promise<number> {
    const server = await this.server;
    return server.getSuccessRate(decisionType);
  }

  /**
   * Get outcome statistics
   */
  async getStatistics(): Promise<OutcomeStatistics> {
    const server = await this.server;
    return server.getStatistics();
  }

  /**
   * Analyze decision quality
   */
  async analyzeDecisionQuality(decisionId: string): Promise<{
    qualityScore: number;
    confidence: number;
    successRate: number;
    domainScores: Record<string, number>;
    totalOutcomes: number;
    reasoning: string;
  }> {
    const server = await this.server;
    return server.analyzeDecisionQuality(decisionId);
  }

  /**
   * Get all outcomes
   */
  async getAllOutcomes(): Promise<OutcomeRecord[]> {
    const server = await this.server;
    return server.getAllOutcomes();
  }

  /**
   * Get domain mastery summary
   */
  async getDomainMastery(): Promise<Record<string, number>> {
    const server = await this.server;
    return server.getDomainSummary().then((summary: Record<string, any>) => {
      const mastery: Record<string, number> = {};
      for (const [domain, data] of Object.entries(summary)) {
        mastery[domain] = data.avgReward;
      }
      return mastery;
    });
  }

  /**
   * Get recent outcomes
   */
  async getRecentOutcomes(limit: number = 10): Promise<OutcomeRecord[]> {
    const server = await this.server;
    return server.getAllOutcomes().then((outcomes: OutcomeRecord[]) =>
      outcomes
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit)
    );
  }

  /**
   * Get student ranking
   */
  async getStudentRanking(): Promise<Array<[string, number]>> {
    const server = await this.server;
    return server.getStudentRanking();
  }

  /**
   * Export outcomes
   */
  async exportOutcomes(filepath?: string): Promise<string> {
    const server = await this.server;
    return server.exportOutcomes(filepath);
  }

  /**
   * Clear all outcomes
   */
  async clearOutcomes(): Promise<void> {
    const server = await this.server;
    return server.clearOutcomes();
  }
}

/**
 * Convenience functions for common tracking scenarios
 */
export class OutcomeTrackerHelpers {
  constructor(private service: OutcomeTrackerFrontendService) {}

  /**
   * Track puzzle completion
   */
  async trackPuzzleCompletion(
    puzzleId: string,
    success: boolean,
    attempts: number,
    timeSeconds: number,
    hintsUsed: number = 0
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `puzzle_${puzzleId}`,
      success
        ? `Completed ${puzzleId} in ${attempts} attempts`
        : `Failed to complete ${puzzleId} after ${attempts} attempts`,
      success,
      {
        decisionType: 'cognitive',
        puzzleId,
        attempts,
        timeSeconds,
        hintsUsed
      }
    );
  }

  /**
   * Track quiz answer
   */
  async trackQuizAnswer(
    quizId: string,
    questionId: string,
    correct: boolean,
    timeSeconds: number
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `quiz_${quizId}_q${questionId}`,
      correct ? 'Answered quiz question correctly' : 'Answered quiz question incorrectly',
      correct,
      {
        decisionType: 'cognitive',
        quizId,
        questionId,
        timeSeconds
      }
    );
  }

  /**
   * Track peer help activity
   */
  async trackPeerHelp(
    helpedUserId: string,
    topic: string
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `help_${helpedUserId}_${Date.now()}`,
      `Helped peer with ${topic}`,
      true,
      {
        decisionType: 'collaborative',
        helpedUserId,
        topic
      }
    );
  }

  /**
   * Track forum participation
   */
  async trackForumPost(
    postId: string,
    threadId: string
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `forum_post_${postId}`,
      'Posted in forum discussion',
      true,
      {
        decisionType: 'collaborative',
        postId,
        threadId
      }
    );
  }

  /**
   * Track discovery/exploration
   */
  async trackDiscovery(
    discoveryType: string,
    description: string
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `discovery_${Date.now()}`,
      `Discovered ${description}`,
      true,
      {
        decisionType: 'discovery',
        discoveryType
      }
    );
  }

  /**
   * Track project creation
   */
  async trackProjectCreation(
    projectId: string,
    isRemix: boolean = false
  ): Promise<void> {
    await this.service.trackImmediateOutcome(
      `project_${projectId}`,
      isRemix ? `Created remix of project ${projectId}` : `Created new project ${projectId}`,
      true,
      {
        decisionType: 'creative',
        projectId,
        isRemix
      }
    );
  }

  /**
   * Track skill mastery (long-term)
   */
  async trackSkillMastery(
    skill: string,
    relatedActivities: string[]
  ): Promise<void> {
    await this.service.trackDelayedOutcome(
      `skill_${skill}`,
      `Demonstrated mastery of ${skill}`,
      true,
      {
        decisionType: 'mastery',
        skill
      },
      'long_term',
      relatedActivities
    );
  }
}
