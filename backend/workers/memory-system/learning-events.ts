/**
 * StudyLoG.AI Memory System - Learning Events & Milestones
 *
 * Tracks educational milestones and learning events for progress tracking,
 * achievement systems, and analytics.
 *
 * Features:
 * - Milestone detection and tracking
 * - XP/reward calculation
 * - Badge eligibility checking
 * - Learning analytics aggregation
 * - Session analytics
 * - Cross-product learning event tracking
 */

import {
  LearningMilestone,
  MilestoneCategory,
  SessionAnalytics,
  LearningAnalytics,
  EmotionalDataPoint,
  EpisodicMemory,
  ProceduralMemory,
  SemanticMemory,
  MemoryTier
} from './types.js';
import { HierarchicalMemory } from './memory-hierarchy.js';
import { TemporalLandmarkManager } from './temporal-landmarks.js';

// ============================================================================
// Milestone Definitions
// ============================================================================

export interface MilestoneDefinition {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  xpReward: number;
  badgeId?: string;
  checkCondition: (context: MilestoneCheckContext) => boolean;
  shareable: boolean;
}

export interface MilestoneCheckContext {
  memory: HierarchicalMemory;
  landmarks: TemporalLandmarkManager;
  studentId: string;
  currentTime: number;
}

// Built-in milestone definitions
export const BUILT_IN_MILESTONES: MilestoneDefinition[] = [
  // First exposure milestones
  {
    id: 'first_cognitive_mill',
    title: 'First Steps in the Mill',
    description: 'Complete your first Cognitive Mill lesson',
    category: MilestoneCategory.FIRST_EXPOSURE,
    xpReward: 10,
    badgeId: 'mill_explorer',
    shareable: true,
    checkCondition: (ctx) => {
      const memories = ctx.memory.episodic.searchByContext('module', 'cognitive-mill');
      return memories.length >= 1;
    }
  },
  {
    id: 'first_intelligence_ranch',
    title: 'Ranch Hand Rookie',
    description: 'Visit the Intelligence Ranch for the first time',
    category: MilestoneCategory.FIRST_EXPOSURE,
    xpReward: 10,
    badgeId: 'ranch_rookie',
    shareable: true,
    checkCondition: (ctx) => {
      const memories = ctx.memory.episodic.searchByContext('module', 'intelligence-ranch');
      return memories.length >= 1;
    }
  },
  {
    id: 'first_sitka_sound',
    title: 'Sitka Sound Explorer',
    description: 'Experience your first multi-agent simulation',
    category: MilestoneCategory.FIRST_EXPOSURE,
    xpReward: 15,
    badgeId: 'sitka_explorer',
    shareable: true,
    checkCondition: (ctx) => {
      const memories = ctx.memory.episodic.searchByContext('module', 'sitka-sound');
      return memories.length >= 1;
    }
  },

  // Skill acquisition milestones
  {
    id: 'first_skill',
    title: 'Skill Novice',
    description: 'Learn your first skill',
    category: MilestoneCategory.SKILL_ACQUIRED,
    xpReward: 25,
    badgeId: 'skill_novice',
    shareable: true,
    checkCondition: (ctx) => {
      return ctx.memory.procedural.getAll().length >= 1;
    }
  },
  {
    id: 'five_skills',
    title: 'Skill Collector',
    description: 'Learn 5 different skills',
    category: MilestoneCategory.SKILL_ACQUIRED,
    xpReward: 50,
    badgeId: 'skill_collector',
    shareable: true,
    checkCondition: (ctx) => {
      return ctx.memory.procedural.getAll().length >= 5;
    }
  },
  {
    id: 'competent_skill',
    title: 'Getting Competent',
    description: 'Reach Competent level in any skill',
    category: MilestoneCategory.SKILL_ACQUIRED,
    xpReward: 75,
    badgeId: 'competent_learner',
    shareable: true,
    checkCondition: (ctx) => {
      const skills = ctx.memory.procedural.getAll();
      return skills.some(s => s.masteryLevel >= 3); // Competent
    }
  },
  {
    id: 'expert_skill',
    title: 'Expert Status',
    description: 'Reach Expert level in any skill',
    category: MilestoneCategory.SKILL_ACQUIRED,
    xpReward: 200,
    badgeId: 'expert_badge',
    shareable: true,
    checkCondition: (ctx) => {
      const skills = ctx.memory.procedural.getAll();
      return skills.some(s => s.masteryLevel >= 5); // Expert
    }
  },

  // Concept mastery milestones
  {
    id: 'first_concept',
    title: 'Concept Learner',
    description: 'Master your first concept',
    category: MilestoneCategory.CONCEPT_MASTERY,
    xpReward: 20,
    badgeId: 'concept_learner',
    shareable: true,
    checkCondition: (ctx) => {
      const concepts = ctx.memory.semantic.getAll();
      return concepts.length >= 1 && concepts.some(c => c.confidence >= 0.8);
    }
  },
  {
    id: 'concept_connections',
    title: 'Making Connections',
    description: 'Form 10 concept associations',
    category: MilestoneCategory.CONCEPT_MASTERY,
    xpReward: 50,
    badgeId: 'connector',
    shareable: true,
    checkCondition: (ctx) => {
      const concepts = ctx.memory.semantic.getAll();
      let totalAssociations = 0;
      for (const c of concepts) {
        totalAssociations += c.associations.size;
      }
      return totalAssociations >= 10;
    }
  },

  // Breakthrough milestones
  {
    id: 'first_breakthrough',
    title: 'Lightbulb Moment',
    description: 'Experience your first learning breakthrough',
    category: MilestoneCategory.BREAKTHROUGH,
    xpReward: 100,
    badgeId: 'breakthrough_badge',
    shareable: true,
    checkCondition: (ctx) => {
      const breakthroughs = ctx.landmarks.getLandmarksByType('breakthrough' as any);
      return breakthroughs.length >= 1;
    }
  },
  {
    id: 'five_breakthroughs',
    title: 'Insightful Learner',
    description: 'Experience 5 learning breakthroughs',
    category: MilestoneCategory.BREAKTHROUGH,
    xpReward: 200,
    badgeId: 'insightful',
    shareable: true,
    checkCondition: (ctx) => {
      const breakthroughs = ctx.landmarks.getLandmarksByType('breakthrough' as any);
      return breakthroughs.length >= 5;
    }
  },

  // Persistence milestones
  {
    id: 'ten_sessions',
    title: 'Dedicated Learner',
    description: 'Complete 10 learning sessions',
    category: MilestoneCategory.PERSISTENCE,
    xpReward: 50,
    badgeId: 'dedicated',
    shareable: true,
    checkCondition: (ctx) => {
      const memories = ctx.memory.episodic.getAll();
      return memories.length >= 10;
    }
  },
  {
    id: 'hundred_sessions',
    title: 'Committed Scholar',
    description: 'Complete 100 learning sessions',
    category: MilestoneCategory.PERSISTENCE,
    xpReward: 500,
    badgeId: 'scholar',
    shareable: true,
    checkCondition: (ctx) => {
      const memories = ctx.memory.episodic.getAll();
      return memories.length >= 100;
    }
  },
  {
    id: 'streak_week',
    title: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    category: MilestoneCategory.PERSISTENCE,
    xpReward: 100,
    badgeId: 'week_warrior',
    shareable: true,
    checkCondition: (ctx) => {
      return calculateStreak(ctx.memory, ctx.currentTime) >= 7;
    }
  },

  // Exploration milestones
  {
    id: 'all_modules',
    title: 'Renaissance Learner',
    description: 'Try all learning modules',
    category: MilestoneCategory.EXPLORATION,
    xpReward: 150,
    badgeId: 'renaissance',
    shareable: true,
    checkCondition: (ctx) => {
      const modules = ['cognitive-mill', 'intelligence-ranch', 'sitka-sound'];
      return modules.every(module => {
        const memories = ctx.memory.episodic.searchByContext('module', module);
        return memories.length >= 1;
      });
    }
  },

  // Creation milestones
  {
    id: 'first_creation',
    title: 'Creator',
    description: 'Create your first simulation or puzzle',
    category: MilestoneCategory.CREATION,
    xpReward: 100,
    badgeId: 'creator_badge',
    shareable: true,
    checkCondition: (ctx) => {
      // Check for creation-related episodic memories
      const memories = ctx.memory.episodic.getAll();
      return memories.some(m =>
        m.context.topic?.includes('create') ||
        m.content.toLowerCase().includes('created')
      );
    }
  },

  // Cross-domain milestones
  {
    id: 'cross_product',
    title: 'Domain Crosser',
    description: 'Apply learning across different products',
    category: MilestoneCategory.CROSS_DOMAIN,
    xpReward: 150,
    badgeId: 'cross_domain',
    shareable: true,
    checkCondition: (ctx) => {
      const crossProduct = ctx.landmarks.getLandmarksByType('cross_product' as any);
      return crossProduct.length >= 1;
    }
  }
];

// ============================================================================
// Milestone Manager
// ============================================================================

/**
 * Manages learning milestones and achievements
 */
export class MilestoneManager {
  private _memory: HierarchicalMemory;
  private _landmarks: TemporalLandmarkManager;
  private _studentId: string;
  private _customMilestones: Map<string, MilestoneDefinition>;
  private _achievedMilestones: Set<string>;
  private _milestoneHistory: Array<{ milestoneId: string; achievedAt: number }>;

  constructor(
    studentId: string,
    memory: HierarchicalMemory,
    landmarks: TemporalLandmarkManager
  ) {
    this._memory = memory;
    this._landmarks = landmarks;
    this._studentId = studentId;
    this._customMilestones = new Map();
    this._achievedMilestones = new Set();
    this._milestoneHistory = [];
  }

  /**
   * Check for milestone achievements
   */
  checkMilestones(): LearningMilestone[] {
    const newAchievements: LearningMilestone[] = [];
    const now = Date.now();

    const allMilestones = [
      ...BUILT_IN_MILESTONES,
      ...Array.from(this._customMilestones.values())
    ];

    const context: MilestoneCheckContext = {
      memory: this._memory,
      landmarks: this._landmarks,
      studentId: this._studentId,
      currentTime: now
    };

    for (const definition of allMilestones) {
      // Skip if already achieved
      if (this._achievedMilestones.has(definition.id)) {
        continue;
      }

      // Check condition
      if (definition.checkCondition(context)) {
        const milestone: LearningMilestone = {
          id: definition.id,
          studentId: this._studentId,
          title: definition.title,
          description: definition.description,
          category: definition.category,
          achievedAt: now,
          relatedMemories: this._findRelatedMemories(definition),
          xpReward: definition.xpReward,
          badgeId: definition.badgeId,
          shareable: definition.shareable
        };

        this._achievedMilestones.add(definition.id);
        this._milestoneHistory.push({ milestoneId: definition.id, achievedAt: now });
        newAchievements.push(milestone);
      }
    }

    return newAchievements;
  }

  /**
   * Find memories related to a milestone
   */
  private _findRelatedMemories(definition: MilestoneDefinition): string[] {
    // This is a simplified implementation
    // In production, would use more sophisticated matching
    const memories = this._memory.episodic.getAll().slice(-10);
    return memories.map(m => m.id);
  }

  /**
   * Add a custom milestone
   */
  addCustomMilestone(definition: MilestoneDefinition): void {
    this._customMilestones.set(definition.id, definition);
  }

  /**
   * Get all available milestones
   */
  getAvailableMilestones(): Array<Definition & { achieved: boolean }> {
    const allMilestones = [
      ...BUILT_IN_MILESTONES,
      ...Array.from(this._customMilestones.values())
    ];

    return allMilestones.map(m => ({
      ...m,
      achieved: this._achievedMilestones.has(m.id)
    }));
  }

  /**
   * Get achieved milestones
   */
  getAchievedMilestones(): LearningMilestone[] {
    const achievements: LearningMilestone[] = [];
    const allMilestones = [
      ...BUILT_IN_MILESTONES,
      ...Array.from(this._customMilestones.values())
    ];

    for (const definition of allMilestones) {
      if (this._achievedMilestones.has(definition.id)) {
        const historyEntry = this._milestoneHistory.find(h => h.milestoneId === definition.id);
        if (historyEntry) {
          achievements.push({
            id: definition.id,
            studentId: this._studentId,
            title: definition.title,
            description: definition.description,
            category: definition.category,
            achievedAt: historyEntry.achievedAt,
            relatedMemories: [],
            xpReward: definition.xpReward,
            badgeId: definition.badgeId,
            shareable: definition.shareable
          });
        }
      }
    }

    return achievements.sort((a, b) => a.achievedAt - b.achievedAt);
  }

  /**
   * Get next milestones (closest to being achieved)
   */
  getNextMilestones(limit: number = 3): Array<Definition & { progress: number }> {
    // Calculate progress for each unachieved milestone
    const progress: Array<Definition & { progress: number }> = [];

    // Simplified progress calculation
    // In production, would use more sophisticated estimation

    const allMilestones = [
      ...BUILT_IN_MILESTONES,
      ...Array.from(this._customMilestones.values())
    ];

    for (const definition of allMilestones) {
      if (this._achievedMilestones.has(definition.id)) continue;

      // Estimate progress based on related memory counts
      let estimatedProgress = 0;

      switch (definition.category) {
        case MilestoneCategory.FIRST_EXPOSURE:
          estimatedProgress = Math.random() * 0.5; // Placeholder
          break;
        case MilestoneCategory.SKILL_ACQUIRED:
          const skillCount = this._memory.procedural.getAll().length;
          estimatedProgress = Math.min(0.95, skillCount / 10);
          break;
        case MilestoneCategory.PERSISTENCE:
          const sessionCount = this._memory.episodic.getAll().length;
          estimatedProgress = Math.min(0.95, sessionCount / 100);
          break;
        default:
          estimatedProgress = Math.random() * 0.3;
      }

      progress.push({ ...definition, progress: estimatedProgress });
    }

    return progress.sort((a, b) => b.progress - a.progress).slice(0, limit);
  }

  /**
   * Get total XP earned
   */
  getTotalXp(): number {
    let total = 0;
    const achieved = this.getAchievedMilestones();

    for (const milestone of achieved) {
      total += milestone.xpReward;
    }

    return total;
  }

  /**
   * Get progress toward next level
   */
  getLevelProgress(): { currentLevel: number; currentXp: number; xpToNext: number; progress: number } {
    const totalXp = this.getTotalXp();
    const currentLevel = Math.floor(totalXp / 1000) + 1;
    const currentXp = totalXp % 1000;
    const xpToNext = 1000;

    return {
      currentLevel,
      currentXp,
      xpToNext,
      progress: currentXp / xpToNext
    };
  }
}

// ============================================================================
// Session Analytics
// ============================================================================

/**
 * Tracks analytics for individual learning sessions
 */
export class SessionTracker {
  private _memory: HierarchicalMemory;
  private _sessions: Map<string, SessionAnalytics>;
  private _currentSession: SessionAnalytics | null;

  constructor(memory: HierarchicalMemory) {
    this._memory = memory;
    this._sessions = new Map();
    this._currentSession = null;
  }

  /**
   * Start a new learning session
   */
  startSession(
    sessionId: string,
    studentId: string,
    module: string
  ): SessionAnalytics {
    const session: SessionAnalytics = {
      sessionId,
      studentId,
      startTime: Date.now(),
      endTime: 0,
      module,
      memoriesCreated: 0,
      memoriesConsolidated: 0,
      skillsPracticed: [],
      conceptsLearned: [],
      emotionalCurve: [],
      focusScore: 1,
      progressMade: 0
    };

    this._currentSession = session;
    this._sessions.set(sessionId, session);

    return session;
  }

  /**
   * Record an event in the current session
   */
  recordEvent(event: SessionEvent): void {
    if (!this._currentSession) return;

    switch (event.type) {
      case 'memory_created':
        this._currentSession.memoriesCreated++;
        break;

      case 'memory_consolidated':
        this._currentSession.memoriesConsolidated++;
        break;

      case 'skill_practiced':
        if (!this._currentSession.skillsPracticed.includes(event.skillName)) {
          this._currentSession.skillsPracticed.push(event.skillName);
        }
        break;

      case 'concept_learned':
        if (!this._currentSession.conceptsLearned.includes(event.conceptName)) {
          this._currentSession.conceptsLearned.push(event.conceptName);
        }
        break;

      case 'emotional_state':
        this._currentSession.emotionalCurve.push({
          timestamp: event.timestamp,
          valence: event.valence,
          arousal: event.arousal || 0.5,
          context: event.context || 'learning'
        });
        break;
    }
  }

  /**
   * End the current session
   */
  endSession(sessionId?: string): SessionAnalytics | null {
    const session = sessionId
      ? this._sessions.get(sessionId)
      : this._currentSession;

    if (!session) return null;

    session.endTime = Date.now();

    // Calculate derived metrics
    session.focusScore = this._calculateFocusScore(session);
    session.progressMade = this._calculateProgress(session);

    if (this._currentSession === session) {
      this._currentSession = null;
    }

    return session;
  }

  /**
   * Get session analytics
   */
  getSession(sessionId: string): SessionAnalytics | null {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a student
   */
  getStudentSessions(studentId: string): SessionAnalytics[] {
    return Array.from(this._sessions.values())
      .filter(s => s.studentId === studentId)
      .sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Get recent sessions
   */
  getRecentSessions(limit: number = 10): SessionAnalytics[] {
    return Array.from(this._sessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * Calculate focus score for a session
   */
  private _calculateFocusScore(session: SessionAnalytics): number {
    if (session.emotionalCurve.length === 0) return 0.5;

    // Focus = stable, moderately positive emotional state
    const valences = session.emotionalCurve.map(e => e.valence);
    const avgValence = valences.reduce((sum, v) => sum + v, 0) / valences.length;

    const variance = valences.reduce((sum, v) => sum + Math.pow(v - avgValence, 2), 0) / valences.length;
    const stability = 1 - Math.min(1, variance);

    // Prefer moderate positive valence (engagement, not euphoria)
    const optimalValence = 0.3;
    const valenceScore = 1 - Math.abs(avgValence - optimalValence);

    return (stability * 0.6 + valenceScore * 0.4);
  }

  /**
   * Calculate progress made in a session
   */
  private _calculateProgress(session: SessionAnalytics): number {
    let progress = 0;

    // Progress from new memories
    progress += Math.min(0.3, session.memoriesCreated * 0.05);

    // Progress from skills practiced
    progress += Math.min(0.3, session.skillsPracticed.length * 0.1);

    // Progress from concepts learned
    progress += Math.min(0.2, session.conceptsLearned.length * 0.1);

    // Progress from consolidation
    progress += Math.min(0.2, session.memoriesConsolidated * 0.05);

    return Math.min(1, progress);
  }
}

// ============================================================================
// Learning Analytics
// ============================================================================

/**
 * Comprehensive learning analytics
 */
export class LearningAnalyticsEngine {
  private _memory: HierarchicalMemory;
  private _landmarks: TemporalLandmarkManager;
  private _sessionTracker: SessionTracker;

  constructor(
    memory: HierarchicalMemory,
    landmarks: TemporalLandmarkManager,
    sessionTracker: SessionTracker
  ) {
    this._memory = memory;
    this._landmarks = landmarks;
    this._sessionTracker = sessionTracker;
  }

  /**
   * Generate comprehensive analytics for a student
   */
  generateAnalytics(studentId: string): LearningAnalytics {
    const sessions = this._sessionTracker.getStudentSessions(studentId);
    const memories = this._memory.episodic.getAll();
    const skills = this._memory.procedural.getAll();
    const concepts = this._memory.semantic.getAll();

    // Calculate total study time
    const totalStudyTime = sessions.reduce((sum, s) => {
      return sum + (s.endTime - s.startTime);
    }, 0);

    // Calculate skill mastery
    const masteredSkills = skills.filter(s => s.masteryLevel >= 3).length;
    const masteredConcepts = concepts.filter(c => c.confidence >= 0.8).length;

    // Calculate average session length
    const avgSessionLength = sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / sessions.length
      : 0;

    // Calculate streak
    const streak = calculateStreak(this._memory, Date.now());

    // Find strongest skills
    const topSkills = this._memory.procedural.getTopSkills(5);
    const strongestSkills = topSkills.map(s => s.name);

    // Find growth areas (skills with low mastery)
    const growthAreas = skills
      .filter(s => s.masteryLevel < 3)
      .sort((a, b) => a.masteryLevel - b.masteryLevel)
      .slice(0, 5)
      .map(s => s.skillName);

    // Calculate retention rate
    const retentionRate = this._calculateRetentionRate();

    // Generate forgetting curve
    const forgettingCurve = this._generateForgettingCurve();

    return {
      studentId,
      totalStudyTime,
      totalMemories: memories.length,
      skillsLearned: skills.length,
      conceptsMastered: masteredConcepts,
      averageSessionLength: Math.round(avgSessionLength),
      streakDays: streak,
      strongestSkills,
      growthAreas,
      retentionRate,
      forgettingCurve
    };
  }

  /**
   * Calculate retention rate
   */
  private _calculateRetentionRate(): number {
    const skills = this._memory.procedural.getAll();
    if (skills.length === 0) return 0;

    let totalRetention = 0;
    for (const skill of skills) {
      totalRetention += this._memory.procedural.getMastery(skill.id);
    }

    return totalRetention / skills.length;
  }

  /**
   * Generate forgetting curve data
   */
  private _generateForgettingCurve(): Array<{ time: number; retention: number; strength: number }> {
    const curve: Array<{ time: number; retention: number; strength: number }> = [];
    const skills = this._memory.procedural.getAll();

    // Generate curve for next 30 days
    for (let day = 0; day <= 30; day += 3) {
      const timeMs = day * 24 * 60 * 60 * 1000;

      let avgRetention = 0;
      let avgStrength = 0;

      for (const skill of skills) {
        const skillCurve = this._memory.procedural.getForgettingCurve(skill.id, 30);
        const dayData = skillCurve.find(d => d.day === day);
        if (dayData) {
          avgRetention += dayData.mastery;
        }
        avgStrength += skill.masteryLevel / 6;
      }

      if (skills.length > 0) {
        avgRetention /= skills.length;
        avgStrength /= skills.length;
      }

      curve.push({ time: timeMs, retention: avgRetention, strength: avgStrength });
    }

    return curve;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate current learning streak
 */
export function calculateStreak(memory: HierarchicalMemory, currentTime: number): number {
  const memories = memory.episodic.getAll().sort((a, b) => b.timestamp - a.timestamp);
  if (memories.length === 0) return 0;

  let streak = 0;
  const dayMs = 24 * 60 * 60 * 1000;
  let checkTime = currentTime;

  // Group memories by day
  const daysWithActivity = new Set<number>();
  for (const m of memories) {
    const day = Math.floor(m.timestamp / dayMs);
    daysWithActivity.add(day);
  }

  const sortedDays = Array.from(daysWithActivity).sort((a, b) => b - a);
  const currentDay = Math.floor(currentTime / dayMs);

  for (let i = 0; i < sortedDays.length; i++) {
    const expectedDay = currentDay - i;
    if (sortedDays[i] === expectedDay) {
      streak++;
    } else if (sortedDays[i] < expectedDay - 1) {
      break;
    }
  }

  return streak;
}

// ============================================================================
// Event Types
// ============================================================================

export type SessionEvent =
  | MemoryCreatedEvent
  | MemoryConsolidatedEvent
  | SkillPracticedEvent
  | ConceptLearnedEvent
  | EmotionalStateEvent;

interface BaseSessionEvent {
  type: string;
  timestamp: number;
}

interface MemoryCreatedEvent extends BaseSessionEvent {
  type: 'memory_created';
}

interface MemoryConsolidatedEvent extends BaseSessionEvent {
  type: 'memory_consolidated';
}

interface SkillPracticedEvent extends BaseSessionEvent {
  type: 'skill_practiced';
  skillName: string;
}

interface ConceptLearnedEvent extends BaseSessionEvent {
  type: 'concept_learned';
  conceptName: string;
}

interface EmotionalStateEvent extends BaseSessionEvent {
  type: 'emotional_state';
  valence: number;
  arousal?: number;
  context?: string;
}

// ============================================================================
// Export Types
// ============================================================================

interface Definition {
  id: string;
  title: string;
  description: string;
  category: MilestoneCategory;
  xpReward: number;
  badgeId?: string;
  shareable: boolean;
}
