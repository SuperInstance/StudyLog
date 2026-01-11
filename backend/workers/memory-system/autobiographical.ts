/**
 * StudyLoG.AI Memory System - Autobiographical Narrative
 *
 * Constructs a coherent life story from episodic memories, landmarks,
 * and identity traits. The narrative organizes learning experiences
 * into meaningful chapters with themes and growth patterns.
 *
 * Features:
 * - Chapter-based narrative organization
 * - Self-description generation
 * - Growth highlighting
 * - Challenge identification
 * - Aspiration tracking
 * - Cross-product narrative integration (StudyLoG <-> DMLoG)
 */

import {
  AutobiographicalNarrative,
  NarrativeChapter,
  NarrativeArc,
  TemporalLandmark,
  EpisodicMemory,
  SemanticMemory,
  ProceduralMemory,
  ReflectionMemory,
  IdentityMemory,
  EmotionalValence,
  MemoryCluster,
  EmotionalDataPoint
} from './types.js';
import { TemporalLandmarkManager } from './temporal-landmarks.js';
import { HierarchicalMemory } from './memory-hierarchy.js';

// ============================================================================
// Narrative Configuration
// ============================================================================

export interface NarrativeConfig {
  // Chapter formation
  minChapterEvents: number;
  chapterTimeWindow: number; // milliseconds
  chapterGapThreshold: number; // milliseconds between chapters

  // Narrative style
  voice: 'first_person' | 'third_person' | 'reflective';
  detailLevel: 'brief' | 'standard' | 'detailed';
  tone: 'formal' | 'casual' | 'encouraging';

  // Content generation
  includeEmotionalArc: boolean;
  includeSkillProgression: boolean;
  includeSocialConnections: boolean;
  includeChallenges: boolean;
}

export const DEFAULT_NARRATIVE_CONFIG: NarrativeConfig = {
  minChapterEvents: 5,
  chapterTimeWindow: 30 * 24 * 60 * 60 * 1000, // 30 days
  chapterGapThreshold: 7 * 24 * 60 * 60 * 1000, // 7 days
  voice: 'first_person',
  detailLevel: 'standard',
  tone: 'encouraging',
  includeEmotionalArc: true,
  includeSkillProgression: true,
  includeSocialConnections: true,
  includeChallenges: true
};

// ============================================================================
// Narrative Generator
// ============================================================================

/**
 * Generates autobiographical narratives from memory data
 */
export class NarrativeGenerator {
  private _memory: HierarchicalMemory;
  private _landmarks: TemporalLandmarkManager;
  private _config: NarrativeConfig;
  private _studentId: string;

  constructor(
    studentId: string,
    memory: HierarchicalMemory,
    landmarks: TemporalLandmarkManager,
    config: Partial<NarrativeConfig> = {}
  ) {
    this._studentId = studentId;
    this._memory = memory;
    this._landmarks = landmarks;
    this._config = { ...DEFAULT_NARRATIVE_CONFIG, ...config };
  }

  /**
   * Generate the full autobiographical narrative
   */
  async generateNarrative(): Promise<AutobiographicalNarrative> {
    const chapters = this._generateNarrativeChapters();
    const currentChapter = chapters[chapters.length - 1]?.id || '';
    const overallArc = this._determineOverallArc(chapters);

    const narrative: AutobiographicalNarrative = {
      studentId: this._studentId,
      version: 1,
      lastUpdated: Date.now(),
      chapters: chapters.map(c => c.id),
      currentChapter,
      overallArc,
      selfDescription: await this._generateSelfDescription(chapters),
      growthHighlights: this._extractGrowthHighlights(chapters),
      challenges: this._identifyChallenges(chapters),
      aspirations: this._extractAspirations()
    };

    return narrative;
  }

  /**
   * Update existing narrative with new memories
   */
  async updateNarrative(existing: AutobiographicalNarrative): Promise<AutobiographicalNarrative> {
    const updated = await this.generateNarrative();
    updated.version = existing.version + 1;

    // Preserve some existing data if desired
    // For now, we regenerate everything

    return updated;
  }

  /**
   * Generate narrative chapters
   */
  private _generateNarrativeChapters(): NarrativeChapter[] {
    const landmarks = this._landmarks.getLandmarks();
    const memories = this._memory.episodic.getAll();

    if (landmarks.length === 0 && memories.length === 0) {
      return [this._createDefaultChapter()];
    }

    // Get landmark-based chapters if available
    const landmarkChapters = this._landmarks.getChapters();
    if (landmarkChapters.length > 0) {
      return this._enhanceLandmarkChapters(landmarkChapters);
    }

    // Otherwise, create time-based chapters
    return this._createTimeBasedChapters();
  }

  /**
   * Create a default chapter for new students
   */
  private _createDefaultChapter(): NarrativeChapter {
    const now = Date.now();

    return {
      id: `chapter_default_${now}`,
      title: 'Beginning Your Journey',
      startDate: now,
      endDate: now,
      landmarks: [],
      theme: 'exploration',
      growth: 0,
      summary: 'Your learning adventure is just beginning. Every moment is a chance to discover something new.'
    };
  }

  /**
   * Enhance landmark chapters with additional narrative data
   */
  private _enhanceLandmarkChapters(chapters: NarrativeChapter[]): NarrativeChapter[] {
    return chapters.map(chapter => {
      // Enhance summary with memories from the time period
      const memories = this._memory.episodic.searchByTime(
        chapter.startDate,
        chapter.endDate
      );

      const enhancedSummary = this._enhanceChapterSummary(chapter, memories);
      const enhancedGrowth = this._calculateDetailedGrowth(chapter, memories);

      return {
        ...chapter,
        summary: enhancedSummary,
        growth: enhancedGrowth
      };
    });
  }

  /**
   * Create time-based chapters when landmarks aren't available
   */
  private _createTimeBasedChapters(): NarrativeChapter[] {
    const memories = this._memory.episodic.getAll().sort((a, b) => a.timestamp - b.timestamp);
    const chapters: NarrativeChapter[] = [];

    if (memories.length === 0) {
      return [this._createDefaultChapter()];
    }

    let currentChapter: NarrativeChapter[] | null = null;
    let chapterMemories: EpisodicMemory[] = [];

    for (const memory of memories) {
      if (!currentChapter) {
        currentChapter = [{
          id: `chapter_${chapters.length}_${Date.now()}`,
          title: this._generateChapterTitleFromMemory(memory),
          startDate: memory.timestamp,
          endDate: memory.timestamp,
          landmarks: [],
          theme: this._inferChapterTheme(memory),
          growth: 0,
          summary: ''
        }];
        chapterMemories = [memory];
      } else {
        const timeSinceStart = memory.timestamp - currentChapter[0].startDate;

        // Check if we should start a new chapter
        if (timeSinceStart > this._config.chapterTimeWindow) {
          // Finalize current chapter
          currentChapter[0].endDate = chapterMemories[chapterMemories.length - 1].timestamp;
          currentChapter[0].summary = this._generateChapterSummaryFromMemories(chapterMemories);
          currentChapter[0].growth = this._calculateGrowthFromMemories(chapterMemories);
          chapters.push(...currentChapter);

          // Start new chapter
          currentChapter = [{
            id: `chapter_${chapters.length}_${Date.now()}`,
            title: this._generateChapterTitleFromMemory(memory),
            startDate: memory.timestamp,
            endDate: memory.timestamp,
            landmarks: [],
            theme: this._inferChapterTheme(memory),
            growth: 0,
            summary: ''
          }];
          chapterMemories = [memory];
        } else {
          chapterMemories.push(memory);
          currentChapter[0].endDate = memory.timestamp;
        }
      }
    }

    // Don't forget the last chapter
    if (currentChapter) {
      currentChapter[0].endDate = chapterMemories[chapterMemories.length - 1].timestamp;
      currentChapter[0].summary = this._generateChapterSummaryFromMemories(chapterMemories);
      currentChapter[0].growth = this._calculateGrowthFromMemories(chapterMemories);
      chapters.push(...currentChapter);
    }

    return chapters;
  }

  /**
   * Generate chapter title from first memory
   */
  private _generateChapterTitleFromMemory(memory: EpisodicMemory): string {
    const topic = memory.context.topic || memory.context.module || 'learning';
    const titles = [
      `Exploring ${topic}`,
      `Discovering ${topic}`,
      `The ${topic} Journey`,
      `${topic} Adventures`,
      `Learning ${topic}`
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }

  /**
   * Infer chapter theme from memory
   */
  private _inferChapterTheme(memory: EpisodicMemory): string {
    const emotion = memory.emotionalValence;
    if (emotion > 0.5) return 'joy';
    if (emotion < -0.3) return 'resilience';
    if (memory.context.topic) return 'exploration';
    return 'growth';
  }

  /**
   * Generate chapter summary from memories
   */
  private _generateChapterSummaryFromMemories(memories: EpisodicMemory[]): string {
    if (memories.length === 0) return '';

    const topics = memories.map(m => m.context.topic).filter(Boolean);
    const uniqueTopics = Array.from(new Set(topics));

    const startDate = new Date(memories[0].timestamp);
    const endDate = new Date(memories[memories.length - 1].timestamp);

    let summary = `From ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;

    if (uniqueTopics.length > 0) {
      summary += `, explored ${uniqueTopics.join(', ')}`;
    }

    summary += `. Experienced ${memories.length} significant learning moments.`;

    // Add emotional summary
    const avgEmotion = memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgEmotion > 0.3) {
      summary += ' Overall positive experience.';
    } else if (avgEmotion < -0.2) {
      summary += ' Faced challenges but persisted.';
    }

    return summary;
  }

  /**
   * Calculate growth from memories
   */
  private _calculateGrowthFromMemories(memories: EpisodicMemory[]): number {
    if (memories.length === 0) return 0;

    // Growth = ratio of successful to total attempts
    const successful = memories.filter(m => m.context.success === true).length;
    const total = memories.filter(m => m.context.success !== undefined).length;

    if (total === 0) return 0.5;

    return successful / total;
  }

  /**
   * Enhance chapter summary with memory details
   */
  private _enhanceChapterSummary(chapter: NarrativeChapter, memories: EpisodicMemory[]): string {
    if (memories.length === 0) return chapter.summary;

    const topics = memories
      .map(m => m.context.topic)
      .filter((t): t is string => Boolean(t));

    const uniqueTopics = Array.from(new Set(topics));
    if (uniqueTopics.length > 0) {
      return `${chapter.summary} Key topics: ${uniqueTopics.join(', ')}.`;
    }

    return chapter.summary;
  }

  /**
   * Calculate detailed growth for a chapter
   */
  private _calculateDetailedGrowth(chapter: NarrativeChapter, memories: EpisodicMemory[]): number {
    // Combine landmark significance with memory success
    let growthScore = chapter.growth;

    const successfulMemories = memories.filter(m => m.context.success === true).length;
    const totalMemories = memories.length;

    if (totalMemories > 0) {
      const successRate = successfulMemories / totalMemories;
      growthScore = (growthScore + successRate) / 2;
    }

    return Math.max(0, Math.min(1, growthScore));
  }

  /**
   * Determine the overall narrative arc
   */
  private _determineOverallArc(chapters: NarrativeChapter[]): NarrativeArc {
    if (chapters.length === 0) return NarrativeArc.EXPLORATION;

    // Count themes
    const themeCounts = new Map<string, number>();
    for (const c of chapters) {
      themeCounts.set(c.theme, (themeCounts.get(c.theme) || 0) + 1);
    }

    const dominantTheme = Array.from(themeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];

    const themeToArc: Record<string, NarrativeArc> = {
      'exploration': NarrativeArc.EXPLORATION,
      'breakthrough': NarrativeArc.TRANSFORMATION,
      'achievement': NarrativeArc.MASTERY,
      'resilience': NarrativeArc.HERO_JOURNEY,
      'collaboration': NarrativeArc.COMMUNITY_BUILDING,
      'growth': NarrativeArc.MASTERY,
      'joy': NarrativeArc.CREATIVE_EXPRESSION
    };

    return themeToArc[dominantTheme] || NarrativeArc.EXPLORATION;
  }

  /**
   * Generate self-description based on narrative
   */
  private async _generateSelfDescription(chapters: NarrativeChapter[]): Promise<string> {
    const skills = this._memory.procedural.getTopSkills(5);
    const identity = this._memory.identity.getSelfModel();
    const reflections = this._memory.reflection.getMostEffective(3);

    const pronoun = this._config.voice === 'first_person' ? 'I' : 'They';
    const possessive = this._config.voice === 'first_person' ? 'my' : 'their';

    let description = '';

    // Learning style
    const learningStyle = Object.entries(identity.learningStyle)[0];
    if (learningStyle) {
      description += `${pronoun} learn best through ${learningStyle[0]}. `;
    }

    // Top skills
    if (skills.length > 0) {
      const skillNames = skills.map(s => s.name).slice(0, 3).join(', ');
      description += `${pronoun} ${pronoun === 'I' ? 'have' : 'has'} developed skills in ${skillNames}. `;
    }

    // Persistence
    if (identity.persistence > 0.7) {
      description += `${pronoun} ${pronoun === 'I' ? 'demonstrate' : 'demonstrates'} strong persistence when facing challenges. `;
    }

    // Curiosity
    if (Object.keys(identity.curiosity).length > 0) {
      const curiosityAreas = Object.keys(identity.curiosity).slice(0, 2).join(' and ');
      description += `${pronoun} ${pronoun === 'I' ? 'am' : 'is'} particularly curious about ${curiosityAreas}. `;
    }

    // Recent growth
    if (chapters.length > 0) {
      const recentChapter = chapters[chapters.length - 1];
      description += `Lately, ${pronoun} ${pronoun === 'I' ? 'have' : 'has'} been focusing on ${recentChapter.theme}. `;
    }

    return description.trim();
  }

  /**
   * Extract growth highlights from chapters
   */
  private _extractGrowthHighlights(chapters: NarrativeChapter[]): string[] {
    const highlights: string[] = [];

    for (const chapter of chapters) {
      if (chapter.growth > 0.7) {
        highlights.push(`Significant progress during "${chapter.title}"`);
      }

      // Get landmarks for this chapter
      for (const landmarkId of chapter.landmarks) {
        const landmark = this._landmarks.getLandmark(landmarkId);
        if (landmark && landmark.significance > 0.7) {
          highlights.push(landmark.description);
        }
      }
    }

    // Add skill mastery highlights
    const masteredSkills = this._memory.procedural.getAll()
      .filter(s => s.masteryLevel >= 4) // Proficient or above
      .map(s => `Mastered ${s.skillName}`);

    highlights.push(...masteredSkills.slice(0, 5));

    return highlights.slice(0, 10);
  }

  /**
   * Identify challenges from memories
   */
  private _identifyChallenges(chapters: NarrativeChapter[]): string[] {
    const challenges: string[] = [];

    // Find setbacks in landmarks
    const setbacks = this._landmarks.getLandmarksByType('setback' as any);
    for (const setback of setbacks) {
      challenges.push(setback.description);
    }

    // Find failed attempts in episodic memories
    const failedMemories = this._memory.episodic.getAll()
      .filter(m => m.context.success === false)
      .sort((a, b) => a.emotionalValence - b.emotionalValence) // Most negative first
      .slice(0, 5);

    for (const memory of failedMemories) {
      const topic = memory.context.topic || 'a challenge';
      challenges.push(`Struggled with ${topic}`);
    }

    // Find blockers from reflections
    const blockers = this._memory.reflection.getByType('blocker' as any);
    for (const blocker of blockers.slice(0, 3)) {
      challenges.push(blocker.insight);
    }

    return Array.from(new Set(challenges)).slice(0, 10);
  }

  /**
   * Extract aspirations from various sources
   */
  private _extractAspirations(): string[] {
    const aspirations: string[] = [];

    // From reflection memories
    const reflections = this._memory.reflection.getByType('motivation' as any);
    for (const ref of reflections) {
      if (ref.insight) {
        aspirations.push(ref.insight);
      }
    }

    // From identity traits (goal orientation)
    const goalTraits = this._memory.identity.getByType('goal' as any);
    for (const trait of goalTraits) {
      if (typeof trait.value === 'string') {
        aspirations.push(`Values: ${trait.value}`);
      }
    }

    // From high-importance episodic memories (future-looking)
    const futureMemories = this._memory.episodic.getAll()
      .filter(m => m.importance >= 8 && m.content.toLowerCase().match(/want|hope|plan|goal|dream|aspire/));

    for (const memory of futureMemories.slice(0, 3)) {
      aspirations.push(memory.content.slice(0, 100));
    }

    return Array.from(new Set(aspirations)).slice(0, 10);
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Generate a narrative summary
   */
  generateSummary(): string {
    const chapters = this._generateNarrativeChapters();
    const arc = this._determineOverallArc(chapters);

    const arcDescriptions: Record<NarrativeArc, string> = {
      [NarrativeArc.HERO_JOURNEY]: 'a hero\'s journey of overcoming challenges',
      [NarrativeArc.EXPLORATION]: 'an exploration of new territories',
      [NarrativeArc.MASTERY]: 'a path toward mastery',
      [NarrativeArc.TRANSFORMATION]: 'a transformative experience',
      [NarrativeArc.COMMUNITY_BUILDING]: 'a journey of building connections',
      [NarrativeArc.CREATIVE_EXPRESSION]: 'a creative adventure'
    };

    const totalMemories = this._memory.episodic.getAll().length;
    const skillsLearned = this._memory.procedural.getAll().length;
    const currentChapter = chapters[chapters.length - 1];

    let summary = `This learner is on ${arcDescriptions[arc]}. `;

    if (totalMemories > 0) {
      summary += `With ${totalMemories} learning experiences recorded, `;
    }

    if (skillsLearned > 0) {
      summary += `having developed ${skillsLearned} skills, `;
    }

    if (currentChapter) {
      summary += `currently focused on ${currentChapter.theme}. `;
    }

    return summary.trim();
  }

  /**
   * Generate chapter detail
   */
  generateChapterDetail(chapterId: string): {
    chapter: NarrativeChapter | null;
    memories: EpisodicMemory[];
    landmarks: TemporalLandmark[];
    skillsLearned: string[];
    emotionalArc: EmotionalDataPoint[];
  } {
    const chapter = this._landmarks.getChapter(chapterId) ||
                   this._generateNarrativeChapters().find(c => c.id === chapterId);

    if (!chapter) {
      return {
        chapter: null,
        memories: [],
        landmarks: [],
        skillsLearned: [],
        emotionalArc: []
      };
    }

    const memories = this._memory.episodic.searchByTime(
      chapter.startDate,
      chapter.endDate
    );

    const landmarks = this._landmarks.getLandmarksInTimeRange(
      chapter.startDate,
      chapter.endDate
    );

    // Find skills practiced during this chapter
    const skillsLearned: string[] = [];
    for (const memory of memories) {
      const topic = memory.context.topic;
      if (topic && !skillsLearned.includes(topic)) {
        skillsLearned.push(topic);
      }
    }

    // Generate emotional arc
    const emotionalArc = memories.map(m => ({
      timestamp: m.timestamp,
      valence: m.emotionalValence,
      arousal: Math.abs(m.emotionalValence),
      context: m.context.topic || 'learning'
    }));

    return {
      chapter,
      memories,
      landmarks,
      skillsLearned,
      emotionalArc
    };
  }

  /**
   * Get narrative statistics
   */
  getStats(): {
    totalChapters: number;
    currentChapter: string | null;
    totalMemories: number;
    totalLandmarks: number;
    overallGrowth: number;
    dominantThemes: string[];
  } {
    const chapters = this._generateNarrativeChapters();

    const themeCounts = new Map<string, number>();
    let totalGrowth = 0;

    for (const c of chapters) {
      themeCounts.set(c.theme, (themeCounts.get(c.theme) || 0) + 1);
      totalGrowth += c.growth;
    }

    const dominantThemes = Array.from(themeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme]) => theme);

    return {
      totalChapters: chapters.length,
      currentChapter: chapters[chapters.length - 1]?.id || null,
      totalMemories: this._memory.episodic.getAll().length,
      totalLandmarks: this._landmarks.getLandmarks().length,
      overallGrowth: chapters.length > 0 ? totalGrowth / chapters.length : 0,
      dominantThemes
    };
  }
}

// ============================================================================
// Narrative Templates
// ============================================================================

/**
 * Generate a narrative opening statement
 */
export function generateNarrativeOpening(narrative: AutobiographicalNarrative): string {
  const arcNames: Record<NarrativeArc, string> = {
    [NarrativeArc.HERO_JOURNEY]: 'A Hero\'s Journey',
    [NarrativeArc.EXPLORATION]: 'An Explorer\'s Tale',
    [NarrativeArc.MASTERY]: 'The Path to Mastery',
    [NarrativeArc.TRANSFORMATION]: 'A Story of Transformation',
    [NarrativeArc.COMMUNITY_BUILDING]: 'Building Together',
    [NarrativeArc.CREATIVE_EXPRESSION]: 'A Creative Adventure'
  };

  return `${arcNames[narrative.overallArc]}\n\n${narrative.selfDescription}`;
}

/**
 * Generate a chapter narrative
 */
export function generateChapterNarrative(
  chapter: NarrativeChapter,
  memories: EpisodicMemory[],
  landmarks: TemporalLandmark[]
): string {
  let narrative = `# ${chapter.title}\n\n`;

  const startDate = new Date(chapter.startDate);
  const endDate = new Date(chapter.endDate);
  narrative += `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n\n`;

  narrative += `**Theme:** ${chapter.theme}\n`;
  narrative += `**Growth:** ${Math.round(chapter.growth * 100)}%\n\n`;

  if (chapter.summary) {
    narrative += `## Summary\n\n${chapter.summary}\n\n`;
  }

  if (landmarks.length > 0) {
    narrative += `## Key Moments\n\n`;
    for (const landmark of landmarks) {
      narrative += `- ${landmark.description}\n`;
    }
    narrative += '\n';
  }

  if (memories.length > 0) {
    narrative += `## Learning Experiences\n\n`;
    const groupedMemories = groupMemoriesByTopic(memories);
    for (const [topic, topicMemories] of Object.entries(groupedMemories)) {
      narrative += `### ${topic}\n`;
      for (const memory of topicMemories.slice(0, 3)) {
        const date = new Date(memory.timestamp);
        narrative += `- ${date.toLocaleDateString()}: ${memory.content.slice(0, 100)}...\n`;
      }
      narrative += '\n';
    }
  }

  return narrative;
}

/**
 * Group memories by topic
 */
function groupMemoriesByTopic(memories: EpisodicMemory[]): Record<string, EpisodicMemory[]> {
  const grouped: Record<string, EpisodicMemory[]> = {};

  for (const memory of memories) {
    const topic = memory.context.topic || 'general';
    if (!grouped[topic]) {
      grouped[topic] = [];
    }
    grouped[topic].push(memory);
  }

  return grouped;
}

/**
 * Generate a full narrative document
 */
export function generateFullNarrativeDocument(
  narrative: AutobiographicalNarrative,
  chapters: NarrativeChapter[],
  memoriesMap: Map<string, EpisodicMemory[]>,
  landmarksMap: Map<string, TemporalLandmark[]>
): string {
  let document = `# Learning Autobiography\n\n`;
  document += `**Student ID:** ${narrative.studentId}\n`;
  document += `**Last Updated:** ${new Date(narrative.lastUpdated).toLocaleDateString()}\n\n`;

  document += `## About Me\n\n`;
  document += `${narrative.selfDescription}\n\n`;

  if (narrative.growthHighlights.length > 0) {
    document += `## Growth Highlights\n\n`;
    for (const highlight of narrative.growthHighlights) {
      document += `- ${highlight}\n`;
    }
    document += '\n';
  }

  if (narrative.challenges.length > 0) {
    document += `## Challenges Overcome\n\n`;
    for (const challenge of narrative.challenges) {
      document += `- ${challenge}\n`;
    }
    document += '\n';
  }

  if (narrative.aspirations.length > 0) {
    document += `## Aspirations\n\n`;
    for (const aspiration of narrative.aspirations) {
      document += `- ${aspiration}\n`;
    }
    document += '\n';
  }

  document += `## Learning Journey\n\n`;

  for (const chapterId of narrative.chapters) {
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) continue;

    const chapterMemories = memoriesMap.get(chapterId) || [];
    const chapterLandmarks = landmarksMap.get(chapterId) || [];

    document += generateChapterNarrative(chapter, chapterMemories, chapterLandmarks);
  }

  return document;
}
