/**
 * Outcome Aggregators
 *
 * Various aggregation strategies for analyzing outcome data
 * across different dimensions: time windows, domains, and students
 */

import {
  OutcomeRecord,
  StudyLogRewardDomain,
  RewardDomain,
  OutcomeType,
  AggregationResult,
  TimeWindow
} from './outcome-types';
import { OutcomeTracker } from './outcome-tracker';

/**
 * Aggregates outcomes within time windows
 */
export class TimeWindowAggregator {
  constructor(private tracker: OutcomeTracker) {}

  /**
   * Aggregate outcomes within specified time windows
   */
  aggregateByWindow(windows: TimeWindow[]): AggregationResult[] {
    const allOutcomes = this.tracker.getAllOutcomes();
    const results: AggregationResult[] = [];

    for (const window of windows) {
      const windowOutcomes = allOutcomes.filter(o =>
        o.timestamp >= window.start && o.timestamp <= window.end
      );

      const result = this.aggregateOutcomes(
        windowOutcomes,
        window.label || `${window.start}-${window.end}`
      );
      result.metadata.windowStart = window.start;
      result.metadata.windowEnd = window.end;

      results.push(result);
    }

    return results;
  }

  /**
   * Aggregate outcomes by regular time intervals
   */
  aggregateByInterval(
    intervalSeconds: number,
    startTime?: number,
    endTime?: number
  ): AggregationResult[] {
    const allOutcomes = this.tracker.getAllOutcomes();

    if (allOutcomes.length === 0) {
      return [];
    }

    // Determine time range
    const start = startTime ?? Math.min(...allOutcomes.map(o => o.timestamp));
    const end = endTime ?? Math.max(...allOutcomes.map(o => o.timestamp));

    // Create windows
    const windows: TimeWindow[] = [];
    let currentStart = start;

    while (currentStart < end) {
      const currentEnd = Math.min(currentStart + intervalSeconds, end);
      const windowLabel = new Date(currentStart * 1000).toLocaleString();
      windows.push({ start: currentStart, end: currentEnd, label: windowLabel });
      currentStart = currentEnd;
    }

    return this.aggregateByWindow(windows);
  }

  /**
   * Aggregate outcomes from the last N minutes
   */
  aggregateLastNMinutes(minutes: number): AggregationResult {
    const cutoff = Date.now() / 1000 - (minutes * 60);

    const recentOutcomes = this.tracker.getAllOutcomes().filter(
      o => o.timestamp >= cutoff
    );

    return this.aggregateOutcomes(recentOutcomes, `last_${minutes}_min`);
  }

  /**
   * Aggregate a list of outcomes into a result
   */
  private aggregateOutcomes(
    outcomes: OutcomeRecord[],
    key: string
  ): AggregationResult {
    if (outcomes.length === 0) {
      return {
        key,
        count: 0,
        successCount: 0,
        totalReward: 0,
        avgReward: 0,
        domainBreakdown: {},
        metadata: {}
      };
    }

    const successCount = outcomes.filter(o => o.success).length;

    // Calculate rewards
    const allRewards: number[] = [];
    const domainRewards: Record<string, number[]> = {};

    for (const outcome of outcomes) {
      for (const reward of outcome.rewards) {
        allRewards.push(reward.value * reward.confidence);

        const domain = reward.domain;
        if (!domainRewards[domain]) {
          domainRewards[domain] = [];
        }
        domainRewards[domain].push(reward.value * reward.confidence);
      }
    }

    const totalReward = allRewards.reduce((a, b) => a + b, 0);
    const avgReward = allRewards.length > 0 ? totalReward / allRewards.length : 0;

    // Domain breakdown
    const domainBreakdown: Record<string, number> = {};
    for (const [domain, rewards] of Object.entries(domainRewards)) {
      domainBreakdown[domain] = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    }

    return {
      key,
      count: outcomes.length,
      successCount,
      totalReward,
      avgReward,
      domainBreakdown,
      metadata: {}
    };
  }
}

/**
 * Aggregates outcomes by learning domain
 */
export class DomainAggregator {
  constructor(private tracker: OutcomeTracker) {}

  /**
   * Aggregate outcomes by reward domain
   */
  aggregateByDomain(): Record<string, AggregationResult> {
    const allOutcomes = this.tracker.getAllOutcomes();
    const results: Record<string, OutcomeRecord[]> = {};

    // Group outcomes by their primary domain
    for (const outcome of allOutcomes) {
      if (outcome.rewards.length > 0) {
        // Use the highest-confidence reward as the primary domain
        const primaryReward = outcome.rewards.reduce((prev, current) =>
          current.confidence > prev.confidence ? current : prev
        );
        const domain = primaryReward.domain;

        if (!results[domain]) {
          results[domain] = [];
        }
        results[domain].push(outcome);
      }
    }

    // Calculate aggregations
    const aggregations: Record<string, AggregationResult> = {};

    for (const [domain, outcomes] of Object.entries(results)) {
      const rewards: number[] = [];
      for (const outcome of outcomes) {
        for (const reward of outcome.rewards) {
          if (reward.domain === domain) {
            rewards.push(reward.value * reward.confidence);
          }
        }
      }

      const totalReward = rewards.reduce((a, b) => a + b, 0);
      const avgReward = rewards.length > 0 ? totalReward / rewards.length : 0;
      const successCount = outcomes.filter(o => o.success).length;

      aggregations[domain] = {
        key: domain,
        count: outcomes.length,
        successCount,
        totalReward,
        avgReward,
        domainBreakdown: { [domain]: avgReward },
        metadata: {}
      };
    }

    return aggregations;
  }

  /**
   * Get a summary of performance across all domains
   */
  getDomainSummary(): Record<string, {
    count: number;
    successRate: number;
    avgReward: number;
    totalReward: number;
  }> {
    const aggregations = this.aggregateByDomain();

    const summary: Record<string, any> = {};
    for (const [domain, agg] of Object.entries(aggregations)) {
      summary[domain] = {
        count: agg.count,
        successRate: agg.count > 0 ? agg.successCount / agg.count : 0,
        avgReward: agg.avgReward,
        totalReward: agg.totalReward
      };
    }

    return summary;
  }

  /**
   * Get the domain with the highest average reward
   */
  getBestDomain(): string | null {
    const aggregations = this.aggregateByDomain();
    const entries = Object.entries(aggregations);

    if (entries.length === 0) {
      return null;
    }

    return entries.reduce((best, current) =>
      current[1].avgReward > best[1].avgReward ? current : best
    )[0];
  }

  /**
   * Get the domain with the lowest average reward
   */
  getWorstDomain(): string | null {
    const aggregations = this.aggregateByDomain();
    const entries = Object.entries(aggregations);

    if (entries.length === 0) {
      return null;
    }

    return entries.reduce((worst, current) =>
      current[1].avgReward < worst[1].avgReward ? current : worst
    )[0];
  }
}

/**
 * Aggregates outcomes by student/user
 */
export class StudentAggregator {
  constructor(private tracker: OutcomeTracker) {}

  /**
   * Aggregate outcomes by student ID
   */
  aggregateByStudent(): Record<string, AggregationResult> {
    const allOutcomes = this.tracker.getAllOutcomes();
    const studentOutcomes: Record<string, OutcomeRecord[]> = {};

    for (const outcome of allOutcomes) {
      const studentId = outcome.metadata.context?.userId || 'anonymous';

      if (!studentOutcomes[studentId]) {
        studentOutcomes[studentId] = [];
      }
      studentOutcomes[studentId].push(outcome);
    }

    // Calculate aggregations
    const results: Record<string, AggregationResult> = {};

    for (const [studentId, outcomes] of Object.entries(studentOutcomes)) {
      const rewards: number[] = [];
      const domainRewards: Record<string, number[]> = {};

      for (const outcome of outcomes) {
        for (const reward of outcome.rewards) {
          rewards.push(reward.value * reward.confidence);

          const domain = reward.domain;
          if (!domainRewards[domain]) {
            domainRewards[domain] = [];
          }
          domainRewards[domain].push(reward.value * reward.confidence);
        }
      }

      const totalReward = rewards.reduce((a, b) => a + b, 0);
      const avgReward = rewards.length > 0 ? totalReward / rewards.length : 0;
      const successCount = outcomes.filter(o => o.success).length;

      // Domain breakdown
      const domainBreakdown: Record<string, number> = {};
      for (const [domain, domainRewardValues] of Object.entries(domainRewards)) {
        domainBreakdown[domain] = domainRewardValues.reduce((a, b) => a + b, 0) / domainRewardValues.length;
      }

      results[studentId] = {
        key: studentId,
        count: outcomes.length,
        successCount,
        totalReward,
        avgReward,
        domainBreakdown,
        metadata: {}
      };
    }

    return results;
  }

  /**
   * Get students ranked by average reward
   */
  getStudentRanking(): Array<[string, number]> {
    const aggregations = this.aggregateByStudent();

    const ranked = Object.entries(aggregations).map(
      ([studentId, agg]) => [studentId, agg.avgReward] as [string, number]
    );

    return ranked.sort((a, b) => b[1] - a[1]);
  }

  /**
   * Get the top N students by average reward
   */
  getTopStudents(n: number = 1): Array<[string, number]> {
    return this.getStudentRanking().slice(0, n);
  }
}

/**
 * Aggregates outcomes using a custom key function
 */
export class CustomAggregator {
  constructor(private tracker: OutcomeTracker) {}

  /**
   * Aggregate outcomes using a custom key function
   */
  aggregate(
    keyFn: (outcome: OutcomeRecord) => string,
    filterFn?: (outcome: OutcomeRecord) => boolean
  ): Record<string, AggregationResult> {
    let allOutcomes = this.tracker.getAllOutcomes();

    if (filterFn) {
      allOutcomes = allOutcomes.filter(filterFn);
    }

    const grouped: Record<string, OutcomeRecord[]> = {};

    for (const outcome of allOutcomes) {
      const key = keyFn(outcome);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(outcome);
    }

    const results: Record<string, AggregationResult> = {};

    for (const [key, outcomes] of Object.entries(grouped)) {
      const rewards: number[] = [];
      const domainRewards: Record<string, number[]> = {};

      for (const outcome of outcomes) {
        for (const reward of outcome.rewards) {
          rewards.push(reward.value * reward.confidence);

          const domain = reward.domain;
          if (!domainRewards[domain]) {
            domainRewards[domain] = [];
          }
          domainRewards[domain].push(reward.value * reward.confidence);
        }
      }

      const totalReward = rewards.reduce((a, b) => a + b, 0);
      const avgReward = rewards.length > 0 ? totalReward / rewards.length : 0;
      const successCount = outcomes.filter(o => o.success).length;

      // Domain breakdown
      const domainBreakdown: Record<string, number> = {};
      for (const [domain, domainRewardValues] of Object.entries(domainRewards)) {
        domainBreakdown[domain] = domainRewardValues.reduce((a, b) => a + b, 0) / domainRewardValues.length;
      }

      results[key] = {
        key,
        count: outcomes.length,
        successCount,
        totalReward,
        avgReward,
        domainBreakdown,
        metadata: {}
      };
    }

    return results;
  }
}
