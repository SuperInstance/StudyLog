/**
 * StudyLoG.AI Memory System - Temporal Landmarks
 *
 * Temporal landmarks are memorable moments that organize autobiographical memory.
 * They serve as anchors for memory retrieval and narrative construction.
 *
 * Types of landmarks:
 * - First-time events (novel experiences)
 * - Peak experiences (high emotional valence)
 * - Milestones (major achievements)
 * - Transitions (state changes)
 * - Breakthroughs (sudden understanding)
 * - Setbacks (learning failures)
 * - Social connections (collaborative learning)
 * - Cross-product events (transfer between StudyLoG/DMLoG)
 *
 * Features:
 * - Automatic landmark detection
 * - Significance scoring
 * - Narrative chapter formation
 * - Cross-product landmark tracking
 */

import {
  TemporalLandmark,
  TemporalLandmarkType,
  NarrativeChapter,
  BaseMemory,
  EpisodicMemory,
  EmotionalValence,
  MemoryImportance
} from './types.js';

// ============================================================================
// Landmark Detection Configuration
// ============================================================================

export interface LandmarkDetectionConfig {
  // First-time detection
  firstTimeWindow: number; // milliseconds to check for prior occurrences

  // Peak experience threshold
  peakPositiveThreshold: EmotionalValence;
  peakNegativeThreshold: EmotionalValence;

  // Milestone thresholds
  milestoneImportance: MemoryImportance;
  milestoneMinTimeBetween: number; // milliseconds

  // Breakthrough detection
  breakthroughKeywords: string[];
  breakthroughTimeLimit: number; // max duration for "sudden" realization

  // Chapter formation
  chapterMinLandmarks: number;
  chapterTimeWindow: number; // max time span for a chapter
  chapterMinGap: number; // min time between chapters
}

export const DEFAULT_LANDMARK_CONFIG: LandmarkDetectionConfig = {
  firstTimeWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  peakPositiveThreshold: 0.7,
  peakNegativeThreshold: -0.7,
  milestoneImportance: MemoryImportance.SIGNIFICANT,
  milestoneMinTimeBetween: 7 * 24 * 60 * 60 * 1000, // 7 days
  breakthroughKeywords: [
    'aha', 'eureka', 'realize', 'understand', 'click', 'finally',
    'breakthrough', 'discover', 'figure out', 'get it now', 'suddenly'
  ],
  breakthroughTimeLimit: 5 * 60 * 1000, // 5 minutes
  chapterMinLandmarks: 3,
  chapterTimeWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  chapterMinGap: 3 * 24 * 60 * 60 * 1000 // 3 days
};

// ============================================================================
// Temporal Landmarks Manager
// ============================================================================

/**
 * Manages temporal landmarks for autobiographical memory organization
 */
export class TemporalLandmarkManager {
  private _landmarks: Map<string, TemporalLandmark>;
  private _chapters: Map<string, NarrativeChapter>;
  private _firstTimeTracker: Map<string, number>; // activity -> first timestamp
  private _lastMilestoneTime: Map<string, number>; // category -> last milestone time
  private _config: LandmarkDetectionConfig;

  constructor(config: Partial<LandmarkDetectionConfig> = {}) {
    this._landmarks = new Map();
    this._chapters = new Map();
    this._firstTimeTracker = new Map();
    this._lastMilestoneTime = new Map();
    this._config = { ...DEFAULT_LANDMARK_CONFIG, ...config };
  }

  /**
   * Analyze an episodic memory for potential landmarks
   */
  analyzeMemory(memory: EpisodicMemory): TemporalLandmark | null {
    // Check in order of specificity
    const landmark =
      this._checkFirstTime(memory) ||
      this._checkBreakthrough(memory) ||
      this._checkPeakExperience(memory) ||
      this._checkMilestone(memory) ||
      this._checkTransition(memory) ||
      this._checkSetback(memory) ||
      this._checkSocialConnection(memory) ||
      this._checkCrossProduct(memory);

    if (landmark) {
      this._landmarks.set(landmark.id, landmark);

      // Update trackers
      if (landmark.type === TemporalLandmarkType.FIRST_TIME) {
        const activity = memory.context.topic || memory.context.module || 'general';
        this._firstTimeTracker.set(activity, memory.timestamp);
      }

      if (landmark.type === TemporalLandmarkType.MILESTONE ||
          landmark.type === TemporalLandmarkType.BREAKTHROUGH) {
        const category = memory.context.topic || 'general';
        this._lastMilestoneTime.set(category, memory.timestamp);
      }

      // Attempt chapter formation
      this._formChapters();
    }

    return landmark;
  }

  /**
   * Check if this is a first-time event
   */
  private _checkFirstTime(memory: EpisodicMemory): TemporalLandmark | null {
    const activity = memory.context.topic || memory.context.module || 'general';
    const firstTime = this._firstTimeTracker.get(activity);

    if (firstTime === undefined) {
      return this._createLandmark(memory, TemporalLandmarkType.FIRST_TIME, {
        significance: 0.8,
        description: `First time experiencing: ${activity}`
      });
    }

    return null;
  }

  /**
   * Check if this is a breakthrough moment
   */
  private _checkBreakthrough(memory: EpisodicMemory): TemporalLandmark | null {
    const content = memory.content.toLowerCase();

    // Check for breakthrough keywords
    const hasKeyword = this._config.breakthroughKeywords.some(keyword =>
      content.includes(keyword)
    );

    // Check for sudden positive emotional shift
    const isPositive = memory.emotionalValence > this._config.peakPositiveThreshold;

    if (hasKeyword && isPositive) {
      return this._createLandmark(memory, TemporalLandmarkType.BREAKTHROUGH, {
        significance: 0.9,
        description: `Breakthrough: ${memory.context.topic || 'learning'}`
      });
    }

    return null;
  }

  /**
   * Check if this is a peak emotional experience
   */
  private _checkPeakExperience(memory: EpisodicMemory): TemporalLandmark | null {
    if (memory.emotionalValence > this._config.peakPositiveThreshold) {
      return this._createLandmark(memory, TemporalLandmarkType.PEAK_EXPERIENCE, {
        significance: 0.7 + (memory.emotionalValence * 0.3),
        description: `Peak positive experience: ${this._extractTopic(memory)}`
      });
    }

    if (memory.emotionalValence < this._config.peakNegativeThreshold) {
      return this._createLandmark(memory, TemporalLandmarkType.SETBACK, {
        significance: 0.6,
        description: `Significant setback: ${this._extractTopic(memory)}`
      });
    }

    return null;
  }

  /**
   * Check if this is a milestone achievement
   */
  private _checkMilestone(memory: EpisodicMemory): TemporalLandmark | null {
    if (memory.importance < this._config.milestoneImportance) {
      return null;
    }

    const category = memory.context.topic || 'general';
    const lastMilestone = this._lastMilestoneTime.get(category) || 0;
    const timeSinceLastMilestone = memory.timestamp - lastMilestone;

    if (timeSinceLastMilestone >= this._config.milestoneMinTimeBetween) {
      return this._createLandmark(memory, TemporalLandmarkType.MILESTONE, {
        significance: 0.8,
        description: `Milestone: ${this._extractTopic(memory)}`
      });
    }

    return null;
  }

  /**
   * Check if this is a state transition
   */
  private _checkTransition(memory: EpisodicMemory): TemporalLandmark | null {
    // Look for transition indicators in content
    const content = memory.content.toLowerCase();
    const transitionWords = [
      'moved to', 'advanced to', 'leveled up', 'completed',
      'finished', 'graduated', 'promoted', 'next stage'
    ];

    const hasTransition = transitionWords.some(word => content.includes(word));

    if (hasTransition) {
      return this._createLandmark(memory, TemporalLandmarkType.TRANSITION, {
        significance: 0.6,
        description: `Transition: ${this._extractTopic(memory)}`
      });
    }

    return null;
  }

  /**
   * Check if this is a setback
   */
  private _checkSetback(memory: EpisodicMemory): TemporalLandmark | null {
    // Already handled in peak experience check for negative emotions
    // This checks for explicit setback indicators
    if (memory.emotionalValence < -0.3 && memory.emotionalValence > this._config.peakNegativeThreshold) {
      const content = memory.content.toLowerCase();
      const setbackWords = [
        'failed', 'mistake', 'error', 'wrong', 'stuck',
        'confused', 'difficult', 'hard', 'struggle'
      ];

      const hasSetback = setbackWords.some(word => content.includes(word));

      if (hasSetback) {
        return this._createLandmark(memory, TemporalLandmarkType.SETBACK, {
          significance: 0.5,
          description: `Learning setback: ${this._extractTopic(memory)}`
        });
      }
    }

    return null;
  }

  /**
   * Check if this is a social learning event
   */
  private _checkSocialConnection(memory: EpisodicMemory): TemporalLandmark | null {
    if (memory.participants && memory.participants.length > 0) {
      // Check for collaborative learning indicators
      const content = memory.content.toLowerCase();
      const socialWords = [
        'together', 'helped', 'taught me', 'we', 'collabor',
        'partner', 'group', 'team', 'shared'
      ];

      const hasSocial = socialWords.some(word => content.includes(word));

      if (hasSocial) {
        return this._createLandmark(memory, TemporalLandmarkType.SOCIAL_CONNECTION, {
          significance: 0.6,
          description: `Social learning with ${memory.participants.join(', ')}`
        });
      }
    }

    return null;
  }

  /**
   * Check if this is a cross-product learning event
   */
  private _checkCrossProduct(memory: EpisodicMemory): TemporalLandmark | null {
    // Check metadata for cross-product indication
    const isCrossProduct = memory.metadata['crossProduct'] as boolean ||
                          memory.metadata['source_product'] !== memory.metadata['target_product'];

    if (isCrossProduct) {
      return this._createLandmark(memory, TemporalLandmarkType.CROSS_PRODUCT, {
        significance: 0.7,
        description: `Cross-product learning: ${memory.metadata['source_product']} -> ${memory.metadata['target_product']}`
      });
    }

    return null;
  }

  /**
   * Create a landmark from memory
   */
  private _createLandmark(
    memory: EpisodicMemory,
    type: TemporalLandmarkType,
    options: {
      significance: number;
      description: string;
    }
  ): TemporalLandmark {
    return {
      id: `landmark_${memory.id}`,
      type,
      memoryId: memory.id,
      timestamp: memory.timestamp,
      description: options.description,
      significance: options.significance,
      relatedLandmarks: [],
      narrativeImpact: this._calculateNarrativeImpact(type, options.significance)
    };
  }

  /**
   * Calculate narrative impact of a landmark
   */
  private _calculateNarrativeImpact(type: TemporalLandmarkType, significance: number): number {
    const typeMultipliers: Record<TemporalLandmarkType, number> = {
      [TemporalLandmarkType.FIRST_TIME]: 1.2,
      [TemporalLandmarkType.PEAK_EXPERIENCE]: 1.1,
      [TemporalLandmarkType.MILESTONE]: 1.3,
      [TemporalLandmarkType.TRANSITION]: 1.0,
      [TemporalLandmarkType.BREAKTHROUGH]: 1.4,
      [TemporalLandmarkType.SETBACK]: 0.9,
      [TemporalLandmarkType.SOCIAL_CONNECTION]: 0.8,
      [TemporalLandmarkType.CROSS_PRODUCT]: 1.2
    };

    return Math.min(1, significance * (typeMultipliers[type] || 1));
  }

  /**
   * Extract topic from memory
   */
  private _extractTopic(memory: EpisodicMemory): string {
    return memory.context.topic || memory.context.module || memory.content.slice(0, 50);
  }

  /**
   * Form narrative chapters from landmarks
   */
  private _formChapters(): void {
    const landmarks = Array.from(this._landmarks.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    if (landmarks.length < this._config.chapterMinLandmarks) {
      return;
    }

    // Group landmarks into chapters
    const chapterGroups: TemporalLandmark[][] = [];
    let currentGroup: TemporalLandmark[] = [landmarks[0]];

    for (let i = 1; i < landmarks.length; i++) {
      const prevLandmark = landmarks[i - 1];
      const currLandmark = landmarks[i];
      const timeGap = currLandmark.timestamp - prevLandmark.timestamp;

      if (timeGap > this._config.chapterMinGap) {
        // Start new chapter
        if (currentGroup.length >= this._config.chapterMinLandmarks) {
          chapterGroups.push(currentGroup);
        }
        currentGroup = [currLandmark];
      } else if (currLandmark.timestamp - currentGroup[0].timestamp > this._config.chapterTimeWindow) {
        // Time window exceeded, start new chapter
        if (currentGroup.length >= this._config.chapterMinLandmarks) {
          chapterGroups.push(currentGroup);
        }
        currentGroup = [currLandmark];
      } else {
        currentGroup.push(currLandmark);
      }
    }

    if (currentGroup.length >= this._config.chapterMinLandmarks) {
      chapterGroups.push(currentGroup);
    }

    // Create chapter objects
    for (let i = 0; i < chapterGroups.length; i++) {
      const group = chapterGroups[i];
      const chapterId = `chapter_${i}_${Date.now()}`;

      const chapter: NarrativeChapter = {
        id: chapterId,
        title: this._generateChapterTitle(group),
        startDate: group[0].timestamp,
        endDate: group[group.length - 1].timestamp,
        landmarks: group.map(l => l.id),
        theme: this._extractChapterTheme(group),
        growth: this._calculateChapterGrowth(group),
        summary: this._generateChapterSummary(group)
      };

      this._chapters.set(chapterId, chapter);

      // Link landmarks to chapter
      for (const landmark of group) {
        const existing = this._landmarks.get(landmark.id);
        if (existing && !existing.relatedLandmarks.includes(chapterId)) {
          existing.relatedLandmarks.push(chapterId);
        }
      }
    }
  }

  /**
   * Generate chapter title from landmarks
   */
  private _generateChapterTitle(landmarks: TemporalLandmark[]): string {
    // Count landmark types
    const typeCounts = new Map<TemporalLandmarkType, number>();
    for (const l of landmarks) {
      typeCounts.set(l.type, (typeCounts.get(l.type) || 0) + 1);
    }

    // Find dominant type
    const dominantType = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    const typeNames: Record<TemporalLandmarkType, string> = {
      [TemporalLandmarkType.FIRST_TIME]: 'First Explorations',
      [TemporalLandmarkType.PEAK_EXPERIENCE]: 'Peak Experiences',
      [TemporalLandmarkType.MILESTONE]: 'Achievements Unlocked',
      [TemporalLandmarkType.TRANSITION]: 'New Beginnings',
      [TemporalLandmarkType.BREAKTHROUGH]: 'Breakthroughs',
      [TemporalLandmarkType.SETBACK]: 'Overcoming Challenges',
      [TemporalLandmarkType.SOCIAL_CONNECTION]: 'Learning Together',
      [TemporalLandmarkType.CROSS_PRODUCT]: 'Cross-Domain Adventures'
    };

    return typeNames[dominantType] || 'Learning Journey';
  }

  /**
   * Extract chapter theme from landmarks
   */
  private _extractChapterTheme(landmarks: TemporalLandmark[]): string {
    // Simple theme extraction based on landmark types
    const types = landmarks.map(l => l.type);

    if (types.every(t => t === TemporalLandmarkType.FIRST_TIME)) {
      return 'exploration';
    }
    if (types.some(t => t === TemporalLandmarkType.BREAKTHROUGH)) {
      return 'breakthrough';
    }
    if (types.some(t => t === TemporalLandmarkType.MILESTONE)) {
      return 'achievement';
    }
    if (types.filter(t => t === TemporalLandmarkType.SETBACK).length > types.length / 2) {
      return 'resilience';
    }
    if (types.some(t => t === TemporalLandmarkType.SOCIAL_CONNECTION)) {
      return 'collaboration';
    }

    return 'growth';
  }

  /**
   * Calculate chapter growth (0-1)
   */
  private _calculateChapterGrowth(landmarks: TemporalLandmark[]): number {
    // Growth = positive experiences / total experiences
    const positiveTypes = [
      TemporalLandmarkType.FIRST_TIME,
      TemporalLandmarkType.PEAK_EXPERIENCE,
      TemporalLandmarkType.MILESTONE,
      TemporalLandmarkType.BREAKTHROUGH,
      TemporalLandmarkType.TRANSITION
    ];

    const negativeTypes = [
      TemporalLandmarkType.SETBACK
    ];

    let positiveScore = 0;
    let negativeScore = 0;

    for (const l of landmarks) {
      if (positiveTypes.includes(l.type)) {
        positiveScore += l.significance;
      }
      if (negativeTypes.includes(l.type)) {
        negativeScore += l.significance;
      }
    }

    const totalScore = positiveScore + negativeScore;
    return totalScore > 0 ? positiveScore / totalScore : 0.5;
  }

  /**
   * Generate chapter summary
   */
  private _generateChapterSummary(landmarks: TemporalLandmark[]): string {
    if (landmarks.length === 0) return '';

    const startDate = new Date(landmarks[0].timestamp);
    const endDate = new Date(landmarks[landmarks.length - 1].timestamp);

    const typeCounts = new Map<string, number>();
    for (const l of landmarks) {
      typeCounts.set(l.type, (typeCounts.get(l.type) || 0) + 1);
    }

    const descriptions = landmarks.map(l => l.description);
    const uniqueDescriptions = Array.from(new Set(descriptions)).slice(0, 3);

    return `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}, ` +
           `experienced ${landmarks.length} memorable moments including: ` +
           uniqueDescriptions.join(', ');
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Get all landmarks
   */
  getLandmarks(): TemporalLandmark[] {
    return Array.from(this._landmarks.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get landmarks by type
   */
  getLandmarksByType(type: TemporalLandmarkType): TemporalLandmark[] {
    return this.getLandmarks().filter(l => l.type === type);
  }

  /**
   * Get landmarks in time range
   */
  getLandmarksInTimeRange(startTime: number, endTime: number): TemporalLandmark[] {
    return this.getLandmarks().filter(l => l.timestamp >= startTime && l.timestamp <= endTime);
  }

  /**
   * Get most significant landmarks
   */
  getMostSignificant(limit: number = 10): TemporalLandmark[] {
    return this.getLandmarks()
      .sort((a, b) => b.significance - a.significance)
      .slice(0, limit);
  }

  /**
   * Get all chapters
   */
  getChapters(): NarrativeChapter[] {
    return Array.from(this._chapters.values()).sort((a, b) => a.startDate - b.startDate);
  }

  /**
   * Get current chapter (most recent)
   */
  getCurrentChapter(): NarrativeChapter | null {
    const chapters = this.getChapters();
    if (chapters.length === 0) return null;
    return chapters[chapters.length - 1];
  }

  /**
   * Get landmark by ID
   */
  getLandmark(id: string): TemporalLandmark | null {
    return this._landmarks.get(id) || null;
  }

  /**
   * Get chapter by ID
   */
  getChapter(id: string): NarrativeChapter | null {
    return this._chapters.get(id) || null;
  }

  /**
   * Get landmarks related to a memory
   */
  getLandmarksForMemory(memoryId: string): TemporalLandmark[] {
    return this.getLandmarks().filter(l => l.memoryId === memoryId);
  }

  /**
   * Manually add a landmark
   */
  addLandmark(landmark: TemporalLandmark): void {
    this._landmarks.set(landmark.id, landmark);
    this._formChapters();
  }

  /**
   * Update landmark significance
   */
  updateSignificance(landmarkId: string, newSignificance: number): void {
    const landmark = this._landmarks.get(landmarkId);
    if (landmark) {
      landmark.significance = Math.max(0, Math.min(1, newSignificance));
      landmark.narrativeImpact = this._calculateNarrativeImpact(landmark.type, landmark.significance);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalLandmarks: number;
    byType: Record<string, number>;
    totalChapters: number;
    avgSignificance: number;
    mostRecent?: TemporalLandmark;
  } {
    const landmarks = this.getLandmarks();
    const byType: Record<string, number> = {};
    let totalSignificance = 0;

    for (const l of landmarks) {
      const typeName = TemporalLandmarkType[l.type];
      byType[typeName] = (byType[typeName] || 0) + 1;
      totalSignificance += l.significance;
    }

    return {
      totalLandmarks: landmarks.length,
      byType,
      totalChapters: this._chapters.size,
      avgSignificance: landmarks.length > 0 ? totalSignificance / landmarks.length : 0,
      mostRecent: landmarks[landmarks.length - 1]
    };
  }

  /**
   * Clear all landmarks and chapters
   */
  clear(): void {
    this._landmarks.clear();
    this._chapters.clear();
    this._firstTimeTracker.clear();
    this._lastMilestoneTime.clear();
  }

  /**
   * Export landmarks for persistence
   */
  export(): {
    landmarks: TemporalLandmark[];
    chapters: NarrativeChapter[];
    firstTimeTracker: Array<[string, number]>;
    lastMilestoneTime: Array<[string, number]>;
  } {
    return {
      landmarks: this.getLandmarks(),
      chapters: this.getChapters(),
      firstTimeTracker: Array.from(this._firstTimeTracker.entries()),
      lastMilestoneTime: Array.from(this._lastMilestoneTime.entries())
    };
  }

  /**
   * Import landmarks from persistence
   */
  import(data: {
    landmarks: TemporalLandmark[];
    chapters: NarrativeChapter[];
    firstTimeTracker: Array<[string, number]>;
    lastMilestoneTime: Array<[string, number]>;
  }): void {
    this._landmarks.clear();
    this._chapters.clear();
    this._firstTimeTracker.clear();
    this._lastMilestoneTime.clear();

    for (const landmark of data.landmarks) {
      this._landmarks.set(landmark.id, landmark);
    }

    for (const chapter of data.chapters) {
      this._chapters.set(chapter.id, chapter);
    }

    for (const [key, value] of data.firstTimeTracker) {
      this._firstTimeTracker.set(key, value);
    }

    for (const [key, value] of data.lastMilestoneTime) {
      this._lastMilestoneTime.set(key, value);
    }
  }
}

// ============================================================================
// Landmark Timeline Visualization
// ============================================================================

/**
 * Generate timeline data for visualization
 */
export function generateTimelineData(landmarks: TemporalLandmark[]): {
  timeline: Array<{
    id: string;
    type: TemporalLandmarkType;
    timestamp: number;
    significance: number;
    position: number; // 0-1, relative position in timeline
  }>;
  clusters: Array<{
    type: TemporalLandmarkType;
    count: number;
    timeRange: [number, number];
  }>;
} {
  if (landmarks.length === 0) {
    return { timeline: [], clusters: [] };
  }

  const sorted = [...landmarks].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sorted[0].timestamp;
  const endTime = sorted[sorted.length - 1].timestamp;
  const timeRange = endTime - startTime;

  const timeline = sorted.map(l => ({
    id: l.id,
    type: l.type,
    timestamp: l.timestamp,
    significance: l.significance,
    position: timeRange > 0 ? (l.timestamp - startTime) / timeRange : 0.5
  }));

  // Find clusters of similar types
  const typeGroups = new Map<TemporalLandmarkType, TemporalLandmark[]>();
  for (const l of sorted) {
    if (!typeGroups.has(l.type)) {
      typeGroups.set(l.type, []);
    }
    typeGroups.get(l.type)!.push(l);
  }

  const clusters = Array.from(typeGroups.entries()).map(([type, items]) => ({
    type,
    count: items.length,
    timeRange: [items[0].timestamp, items[items.length - 1].timestamp] as [number, number]
  }));

  return { timeline, clusters };
}

/**
 * Generate emotional arc from landmarks
 */
export function generateEmotionalArc(landmarks: TemporalLandmark[]): Array<{
  timestamp: number;
  valence: number; // Derived from landmark type
  type: TemporalLandmarkType;
}> {
  const emotionalValues: Record<TemporalLandmarkType, number> = {
    [TemporalLandmarkType.FIRST_TIME]: 0.6,
    [TemporalLandmarkType.PEAK_EXPERIENCE]: 0.9,
    [TemporalLandmarkType.MILESTONE]: 0.8,
    [TemporalLandmarkType.TRANSITION]: 0.5,
    [TemporalLandmarkType.BREAKTHROUGH]: 1.0,
    [TemporalLandmarkType.SETBACK]: -0.5,
    [TemporalLandmarkType.SOCIAL_CONNECTION]: 0.7,
    [TemporalLandmarkType.CROSS_PRODUCT]: 0.6
  };

  return landmarks
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(l => ({
      timestamp: l.timestamp,
      valence: emotionalValues[l.type] * l.significance,
      type: l.type
    }));
}
