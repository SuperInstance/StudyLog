/**
 * Temporal Landmark Detection
 *
 * Identifies significant events in a student's learning journey that serve
 * as reference points for autobiographical memory. Inspired by cognitive
 * neuroscience research on temporal landmarks.
 *
 * Landmark Types:
 * - FIRST_TIME: First attempt at something new
 * - BREAKTHROUGH: "Aha!" moment when understanding clicks
 * - MILESTONE: Significant achievement (completion, mastery)
 * - TRANSITION: Moving between topics/levels
 * - EMOTIONAL_PEAK: High emotional impact events
 * - SOCIAL: Collaborative learning events
 * - FAILURE_POINT: Important learning from mistakes
 * - COMEBACK: Recovery after struggle
 *
 * StudyLoG.AI Optimizations:
 * - Learning milestone detection
 * - Concept breakthrough recognition
 * - Struggle-to-success tracking
 * - Temporal clustering for narrative building
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

import type { EpisodicMemory } from './consolidation.js';

/**
 * Temporal landmark types
 */
export enum LandmarkType {
  /** First time attempting something */
  FIRST_TIME = 'first_time',
  /** Understanding breakthrough ("clicked") */
  BREAKTHROUGH = 'breakthrough',
  /** Significant achievement */
  MILESTONE = 'milestone',
  /** Topic/module transition */
  TRANSITION = 'transition',
  /** High emotional impact */
  EMOTIONAL_PEAK = 'emotional_peak',
  /** Collaborative learning */
  SOCIAL = 'social',
  /** Learning from failure */
  FAILURE_POINT = 'failure_point',
  /** Recovery after struggle */
  COMEBACK = 'comeback',
}

/**
 * Temporal landmark
 */
export interface TemporalLandmark {
  id: string;
  studentId: string;
  memoryId: string;
  type: LandmarkType;
  title: string;
  description: string;
  timestamp: number;

  // Significance metrics
  significance: number; // 0-1, how impactful this landmark is
  uniqueness: number; // 0-1, how unique this event is

  // Context
  subject?: string;
  topic?: string;
  relatedTopics: string[];

  // Emotional valence
  emotionalValence: number; // -1 to 1

  // Narrative data
  keywords: string[];
  themes: string[];

  // Cluster data (for narrative building)
  clusterId?: string;
  nearbyLandmarks?: string[]; // IDs of nearby landmarks
}

/**
 * Landmark detection result
 */
export interface LandmarkDetection {
  isLandmark: boolean;
  type?: LandmarkType;
  confidence: number; // 0-1
  reason: string;
  significance: number; // 0-1
}

/**
 * Landmark cluster (group of related landmarks in time)
 */
export interface LandmarkCluster {
  id: string;
  studentId: string;
  landmarks: TemporalLandmark[];
  timeRange: { start: number; end: number };
  theme: string;
  narrative: string;
}

/**
 * Temporal profile for a student
 */
export interface TemporalProfile {
  studentId: string;
  landmarks: Map<string, TemporalLandmark>;
  firstEncounters: Map<string, number>; // topic -> timestamp
  breakthroughs: Map<string, number>; // topic -> timestamp
  struggles: Map<string, number[]>; // topic -> [struggle timestamps]
  milestones: Map<string, number>; // topic -> timestamp

  // Temporal patterns
  learningVelocity: number; // memories per day
  breakthroughFrequency: number; // breakthroughs per week
  struggleRecoveryRate: number; // avg days from struggle to success
}

/**
 * Landmark detection configuration
 */
export interface LandmarkConfig {
  // Minimum confidence for landmark detection
  minConfidence: number;
  // Time window for clustering (ms)
  clusterWindow: number;
  // Minimum landmarks for a cluster
  minClusterSize: number;
  // Pattern detection thresholds
  breakthroughKeywords: string[];
  firstTimeKeywords: string[];
  emotionalKeywords: Array<{ word: string; valence: number }>;
}

/**
 * Default configuration
 */
export const DEFAULT_LANDMARK_CONFIG: LandmarkConfig = {
  minConfidence: 0.5,
  clusterWindow: 7 * 24 * 60 * 60 * 1000, // 7 days
  minClusterSize: 2,
  breakthroughKeywords: [
    'clicked', 'understood', 'finally got it', 'breakthrough',
    'realized', 'figured out', 'solved', 'accomplished',
    'mastered', 'conquered', 'overcame', 'achieved',
  ],
  firstTimeKeywords: [
    'first time', 'first attempt', 'first try', 'never done before',
    'started learning', 'beginning', 'introduced to',
  ],
  emotionalKeywords: [
    { word: 'excited', valence: 0.8 },
    { word: 'proud', valence: 0.9 },
    { word: 'amazing', valence: 0.8 },
    { word: 'frustrated', valence: -0.7 },
    { word: 'stuck', valence: -0.6 },
    { word: 'confused', valence: -0.5 },
    { word: 'struggling', valence: -0.6 },
    { word: 'finally', valence: 0.7 },
    { word: 'relieved', valence: 0.6 },
  ],
};

// ═══════════════════════════════════════════════════════════
// Temporal Landmark Detector
// ═══════════════════════════════════════════════════════════

export class LandmarkDetector {
  private readonly config: LandmarkConfig;
  private profiles: Map<string, TemporalProfile>;

  constructor(config?: Partial<LandmarkConfig>) {
    this.config = { ...DEFAULT_LANDMARK_CONFIG, ...config };
    this.profiles = new Map();
  }

  /**
   * Get or create a temporal profile
   */
  private getProfile(studentId: string): TemporalProfile {
    if (!this.profiles.has(studentId)) {
      this.profiles.set(studentId, {
        studentId,
        landmarks: new Map(),
        firstEncounters: new Map(),
        breakthroughs: new Map(),
        struggles: new Map(),
        milestones: new Map(),
        learningVelocity: 0,
        breakthroughFrequency: 0,
        struggleRecoveryRate: 0,
      });
    }
    return this.profiles.get(studentId)!;
  }

  /**
   * Detect if a memory is a temporal landmark
   */
  detectLandmark(memory: EpisodicMemory, allMemories?: EpisodicMemory[]): LandmarkDetection {
    const profile = this.getProfile(memory.studentId);
    const contentLower = memory.content.toLowerCase();

    // Check for high importance milestone
    if (memory.importance >= 8) {
      return {
        isLandmark: true,
        type: LandmarkType.MILESTONE,
        confidence: 0.9,
        reason: 'High importance event',
        significance: memory.importance / 10,
      };
    }

    // Check for breakthrough keywords
    for (const keyword of this.config.breakthroughKeywords) {
      if (contentLower.includes(keyword)) {
        return {
          isLandmark: true,
          type: LandmarkType.BREAKTHROUGH,
          confidence: 0.85,
          reason: `Breakthrough keyword: "${keyword}"`,
          significance: 0.8,
        };
      }
    }

    // Check for first-time keywords
    for (const keyword of this.config.firstTimeKeywords) {
      if (contentLower.includes(keyword)) {
        return {
          isLandmark: true,
          type: LandmarkType.FIRST_TIME,
          confidence: 0.8,
          reason: `First-time keyword: "${keyword}"`,
          significance: 0.7,
        };
      }
    }

    // Check for emotional peaks
    for (const { word, valence } of this.config.emotionalKeywords) {
      if (contentLower.includes(word)) {
        return {
          isLandmark: true,
          type: LandmarkType.EMOTIONAL_PEAK,
          confidence: 0.75,
          reason: `Emotional keyword: "${word}"`,
          significance: Math.abs(valence),
        };
      }
    }

    // Check for social learning
    if (contentLower.includes('together') || contentLower.includes('helped') ||
        contentLower.includes('partner') || contentLower.includes('group')) {
      return {
        isLandmark: true,
        type: LandmarkType.SOCIAL,
        confidence: 0.7,
        reason: 'Collaborative learning event',
        significance: 0.6,
      };
    }

    // Check for first encounter with topic
    if (memory.topic && !profile.firstEncounters.has(memory.topic)) {
      return {
        isLandmark: true,
        type: LandmarkType.FIRST_TIME,
        confidence: 0.8,
        reason: `First encounter with topic: ${memory.topic}`,
        significance: 0.7,
      };
    }

    // Check for comeback (struggle -> success pattern)
    if (this.isComeback(memory, profile)) {
      return {
        isLandmark: true,
        type: LandmarkType.COMEBACK,
        confidence: 0.85,
        reason: 'Recovery after struggle',
        significance: 0.85,
      };
    }

    // Check for transition (topic change)
    if (this.isTopicTransition(memory, allMemories ?? [])) {
      return {
        isLandmark: true,
        type: LandmarkType.TRANSITION,
        confidence: 0.6,
        reason: 'Transition to new topic',
        significance: 0.5,
      };
    }

    // Not a landmark
    return {
      isLandmark: false,
      confidence: 0,
      reason: 'No landmark patterns detected',
      significance: 0,
    };
  }

  /**
   * Create a landmark from a memory
   */
  createLandmark(memory: EpisodicMemory, detection: LandmarkDetection): TemporalLandmark {
    const profile = this.getProfile(memory.studentId);
    const now = Date.now();

    const landmark: TemporalLandmark = {
      id: `landmark_${memory.id}`,
      studentId: memory.studentId,
      memoryId: memory.id,
      type: detection.type ?? LandmarkType.MILESTONE,
      title: this.generateLandmarkTitle(memory, detection),
      description: memory.content,
      timestamp: memory.timestamp,
      significance: detection.significance,
      uniqueness: this.calculateUniqueness(memory, profile),
      subject: memory.subject,
      topic: memory.topic,
      relatedTopics: this.findRelatedTopics(memory),
      emotionalValence: memory.emotionalValence,
      keywords: this.extractKeywords(memory),
      themes: this.extractThemes(memory),
    };

    // Update profile
    profile.landmarks.set(landmark.id, landmark);

    if (memory.topic) {
      if (detection.type === LandmarkType.FIRST_TIME) {
        profile.firstEncounters.set(memory.topic, memory.timestamp);
      }
      if (detection.type === LandmarkType.BREAKTHROUGH) {
        profile.breakthroughs.set(memory.topic, memory.timestamp);
      }
      if (detection.type === LandmarkType.MILESTONE) {
        profile.milestones.set(memory.topic, memory.timestamp);
      }
      if (memory.emotionalValence < -0.3) {
        if (!profile.struggles.has(memory.topic)) {
          profile.struggles.set(memory.topic, []);
        }
        profile.struggles.get(memory.topic)!.push(memory.timestamp);
      }
    }

    return landmark;
  }

  /**
   * Get all landmarks for a student
   */
  getLandmarks(studentId: string): TemporalLandmark[] {
    const profile = this.profiles.get(studentId);
    if (!profile) return [];

    return Array.from(profile.landmarks.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get landmarks by type
   */
  getLandmarksByType(studentId: string, type: LandmarkType): TemporalLandmark[] {
    return this.getLandmarks(studentId).filter(l => l.type === type);
  }

  /**
   * Get landmarks in a time range
   */
  getLandmarksInRange(
    studentId: string,
    start: number,
    end: number
  ): TemporalLandmark[] {
    return this.getLandmarks(studentId).filter(
      l => l.timestamp >= start && l.timestamp <= end
    );
  }

  /**
   * Cluster landmarks by time for narrative building
   */
  clusterLandmarks(studentId: string): LandmarkCluster[] {
    const landmarks = this.getLandmarks(studentId);
    if (landmarks.length === 0) return [];

    const clusters: LandmarkCluster[] = [];
    const currentCluster: TemporalLandmark[] = [landmarks[0]];
    let clusterStart = landmarks[0].timestamp;

    for (let i = 1; i < landmarks.length; i++) {
      const landmark = landmarks[i];
      const timeSinceStart = landmark.timestamp - clusterStart;

      if (timeSinceStart <= this.config.clusterWindow) {
        currentCluster.push(landmark);
      } else {
        // Finalize current cluster
        if (currentCluster.length >= this.config.minClusterSize) {
          clusters.push(this.createCluster(currentCluster));
        }
        // Start new cluster
        currentCluster.length = 0;
        currentCluster.push(landmark);
        clusterStart = landmark.timestamp;
      }
    }

    // Don't forget the last cluster
    if (currentCluster.length >= this.config.minClusterSize) {
      clusters.push(this.createCluster(currentCluster));
    }

    return clusters;
  }

  /**
   * Create a landmark cluster
   */
  private createCluster(landmarks: TemporalLandmark[]): LandmarkCluster {
    const studentId = landmarks[0].studentId;
    const theme = this.extractClusterTheme(landmarks);
    const narrative = this.generateClusterNarrative(landmarks);

    const cluster: LandmarkCluster = {
      id: `cluster_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      studentId,
      landmarks,
      timeRange: {
        start: landmarks[0].timestamp,
        end: landmarks[landmarks.length - 1].timestamp,
      },
      theme,
      narrative,
    };

    // Link landmarks
    for (const landmark of landmarks) {
      landmark.clusterId = cluster.id;
      landmark.nearbyLandmarks = landmarks
        .filter(l => l.id !== landmark.id)
        .map(l => l.id);
    }

    return cluster;
  }

  /**
   * Extract the dominant theme from a cluster
   */
  private extractClusterTheme(landmarks: TemporalLandmark[]): string {
    // Count topics
    const topicCounts = new Map<string, number>();
    for (const l of landmarks) {
      if (l.topic) {
        topicCounts.set(l.topic, (topicCounts.get(l.topic) ?? 0) + 1);
      }
    }

    // Get most common topic
    let maxCount = 0;
    let dominantTopic = 'General Learning';
    for (const [topic, count] of topicCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        dominantTopic = topic;
      }
    }

    return dominantTopic;
  }

  /**
   * Generate narrative for a cluster
   */
  private generateClusterNarrative(landmarks: TemporalLandmark[]): string {
    if (landmarks.length === 0) return '';

    const types = landmarks.map(l => l.type);
    const hasBreakthrough = types.includes(LandmarkType.BREAKTHROUGH);
    const hasFirstTime = types.includes(LandmarkType.FIRST_TIME);
    const hasMilestone = types.includes(LandmarkType.MILESTONE);
    const hasComeback = types.includes(LandmarkType.COMEBACK);

    const parts: string[] = [];

    if (hasFirstTime) {
      parts.push('began exploring new concepts');
    }

    if (hasBreakthrough) {
      parts.push('had key breakthroughs in understanding');
    }

    if (hasComeback) {
      parts.push('overcame challenges through persistence');
    }

    if (hasMilestone) {
      parts.push('achieved significant milestones');
    }

    if (parts.length === 0) {
      parts.push('engaged in learning activities');
    }

    return `During this period, the student ${parts.join(', ')}.`;
  }

  /**
   * Check if this memory represents a comeback
   */
  private isComeback(memory: EpisodicMemory, profile: TemporalProfile): boolean {
    if (!memory.topic) return false;
    if (memory.emotionalValence < 0.3) return false;
    if ((memory.successLevel ?? 0) < 0.6) return false;

    // Check if there were previous struggles with this topic
    const struggles = profile.struggles.get(memory.topic);
    if (!struggles || struggles.length === 0) return false;

    // Check if this success comes after a struggle
    const lastStruggle = struggles[struggles.length - 1];
    const daysSinceStruggle = (memory.timestamp - lastStruggle) / (24 * 60 * 60 * 1000);

    return daysSinceStruggle > 0 && daysSinceStruggle < 30; // Within a month
  }

  /**
   * Check if this is a topic transition
   */
  private isTopicTransition(memory: EpisodicMemory, allMemories: EpisodicMemory[]): boolean {
    if (!memory.topic) return false;

    // Get recent memories before this one
    const recent = allMemories
      .filter(m => m.timestamp < memory.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    if (recent.length === 0) return false;

    // Check if topic is different from recent memories
    const recentTopics = new Set(recent.map(m => m.topic).filter(Boolean));
    return !recentTopics.has(memory.topic);
  }

  /**
   * Generate a title for the landmark
   */
  private generateLandmarkTitle(memory: EpisodicMemory, detection: LandmarkDetection): string {
    const topic = memory.topic ?? 'Learning';
    const type = detection.type;

    switch (type) {
      case LandmarkType.FIRST_TIME:
        return `First Time: ${topic}`;
      case LandmarkType.BREAKTHROUGH:
        return `Breakthrough: ${topic}`;
      case LandmarkType.MILESTONE:
        return `Milestone: ${topic}`;
      case LandmarkType.TRANSITION:
        return `New Topic: ${topic}`;
      case LandmarkType.EMOTIONAL_PEAK:
        return memory.emotionalValence > 0
          ? `Exciting Moment: ${topic}`
          : `Challenging Moment: ${topic}`;
      case LandmarkType.SOCIAL:
        return `Collaborative Learning: ${topic}`;
      case LandmarkType.FAILURE_POINT:
        return `Learning Challenge: ${topic}`;
      case LandmarkType.COMEBACK:
        return `Comeback: ${topic}`;
      default:
        return `Memory: ${topic}`;
    }
  }

  /**
   * Calculate uniqueness of this landmark
   */
  private calculateUniqueness(memory: EpisodicMemory, profile: TemporalProfile): number {
    // More unique if it's the first of its kind
    if (memory.topic && !profile.firstEncounters.has(memory.topic)) {
      return 1.0;
    }

    // Less unique if similar landmarks exist
    const similarLandmarks = Array.from(profile.landmarks.values()).filter(
      l => l.topic === memory.topic
    );

    return Math.max(0.1, 1 - (similarLandmarks.length * 0.1));
  }

  /**
   * Find related topics
   */
  private findRelatedTopics(memory: EpisodicMemory): string[] {
    const related: string[] = [];

    if (memory.subject && memory.topic) {
      related.push(memory.subject);
    }

    if (memory.tags) {
      related.push(...memory.tags.filter(t => t !== memory.topic));
    }

    return related;
  }

  /**
   * Extract keywords from memory
   */
  private extractKeywords(memory: EpisodicMemory): string[] {
    const words = memory.content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4)
      .filter(w => /^[a-z]+$/.test(w));

    // Return unique words
    return [...new Set(words)];
  }

  /**
   * Extract themes from memory
   */
  private extractThemes(memory: EpisodicMemory): string[] {
    const themes: string[] = [];

    if (memory.topic) {
      themes.push(memory.topic);
    }

    if (memory.subject) {
      themes.push(memory.subject);
    }

    // Emotional themes
    if (memory.emotionalValence > 0.5) {
      themes.push('positive-experience');
    } else if (memory.emotionalValence < -0.3) {
      themes.push('challenging-experience');
    }

    // Success themes
    if ((memory.successLevel ?? 0) > 0.7) {
      themes.push('achievement');
    } else if ((memory.successLevel ?? 0) < 0.4) {
      themes.push('learning-opportunity');
    }

    return themes;
  }

  /**
   * Get temporal profile statistics
   */
  getProfileStats(studentId: string): {
    totalLandmarks: number;
    byType: Record<LandmarkType, number>;
    learningVelocity: number;
    breakthroughFrequency: number;
    struggleRecoveryRate: number;
  } | null {
    const profile = this.profiles.get(studentId);
    if (!profile) return null;

    const byType: Record<LandmarkType, number> = {
      [LandmarkType.FIRST_TIME]: 0,
      [LandmarkType.BREAKTHROUGH]: 0,
      [LandmarkType.MILESTONE]: 0,
      [LandmarkType.TRANSITION]: 0,
      [LandmarkType.EMOTIONAL_PEAK]: 0,
      [LandmarkType.SOCIAL]: 0,
      [LandmarkType.FAILURE_POINT]: 0,
      [LandmarkType.COMEBACK]: 0,
    };

    for (const landmark of profile.landmarks.values()) {
      byType[landmark.type]++;
    }

    return {
      totalLandmarks: profile.landmarks.size,
      byType,
      learningVelocity: profile.learningVelocity,
      breakthroughFrequency: profile.breakthroughFrequency,
      struggleRecoveryRate: profile.struggleRecoveryRate,
    };
  }

  /**
   * Calculate temporal statistics from memories
   */
  updateTemporalStats(studentId: string, memories: EpisodicMemory[]): void {
    const profile = this.getProfile(studentId);
    const studentMemories = memories.filter(m => m.studentId === studentId);

    if (studentMemories.length < 2) return;

    // Calculate learning velocity (memories per day)
    const timestamps = studentMemories.map(m => m.timestamp).sort((a, b) => a - b);
    const spanDays = (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60 * 1000);
    profile.learningVelocity = spanDays > 0 ? studentMemories.length / spanDays : 0;

    // Calculate breakthrough frequency
    const breakthroughCount = Array.from(profile.breakthroughs.values()).length;
    profile.breakthroughFrequency = spanDays > 0 ? (breakthroughCount / spanDays) * 7 : 0; // per week

    // Calculate struggle recovery rate
    let totalRecoveryTime = 0;
    let recoveryCount = 0;

    for (const [topic, struggles] of profile.struggles.entries()) {
      const breakthrough = profile.breakthroughs.get(topic);
      if (breakthrough) {
        for (const struggle of struggles) {
          if (breakthrough > struggle) {
            totalRecoveryTime += (breakthrough - struggle) / (24 * 60 * 60 * 1000);
            recoveryCount++;
          }
        }
      }
    }

    profile.struggleRecoveryRate = recoveryCount > 0 ? totalRecoveryTime / recoveryCount : 0;
  }

  /**
   * Export state
   */
  exportState(): {
    profiles: Record<string, {
      landmarks: TemporalLandmark[];
      firstEncounters: Record<string, number>;
      breakthroughs: Record<string, number>;
      struggles: Record<string, number[]>;
      milestones: Record<string, number>;
      learningVelocity: number;
      breakthroughFrequency: number;
      struggleRecoveryRate: number;
    }>;
  } {
    const profilesObj: Record<string, any> = {};

    for (const [id, profile] of this.profiles.entries()) {
      profilesObj[id] = {
        landmarks: Array.from(profile.landmarks.values()),
        firstEncounters: Object.fromEntries(profile.firstEncounters),
        breakthroughs: Object.fromEntries(profile.breakthroughs),
        struggles: Object.fromEntries(profile.struggles),
        milestones: Object.fromEntries(profile.milestones),
        learningVelocity: profile.learningVelocity,
        breakthroughFrequency: profile.breakthroughFrequency,
        struggleRecoveryRate: profile.struggleRecoveryRate,
      };
    }

    return { profiles: profilesObj };
  }

  /**
   * Import state
   */
  importState(state: {
    profiles: Record<string, any>;
  }): void {
    for (const [id, data] of Object.entries(state.profiles)) {
      const profile: TemporalProfile = {
        studentId: id,
        landmarks: new Map(data.landmarks.map((l: TemporalLandmark) => [l.id, l])),
        firstEncounters: new Map(Object.entries(data.firstEncounters)),
        breakthroughs: new Map(Object.entries(data.breakthroughs)),
        struggles: new Map(Object.entries(data.struggles)),
        milestones: new Map(Object.entries(data.milestones)),
        learningVelocity: data.learningVelocity,
        breakthroughFrequency: data.breakthroughFrequency,
        struggleRecoveryRate: data.struggleRecoveryRate,
      };
      this.profiles.set(id, profile);
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.profiles.clear();
  }
}

/**
 * Factory function
 */
export function createLandmarkDetector(config?: Partial<LandmarkConfig>): LandmarkDetector {
  return new LandmarkDetector(config);
}
