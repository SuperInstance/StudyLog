/**
 * Narrative Builder - Autobiographical Story Generation
 *
 * Constructs coherent autobiographical narratives from memory data.
 * Inspired by the "self-memory system" in cognitive psychology, which
 * ties autobiographical memory to the concept of self.
 *
 * Features:
 * - Temporal chaptering (periods of learning)
 * - Theme extraction and evolution
 * - Growth tracking across dimensions
 * - Hero's journey narrative structure
 * - Learning milestone highlights
 *
 * StudyLoG.AI Optimizations:
 * - Learning progression narratives
 * - Skill development storylines
 * - Struggle-to-success arcs
 * - Future learning projections
 */

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

import type { EpisodicMemory, SemanticMemory } from './consolidation.js';
import type { TemporalLandmark, LandmarkCluster } from './landmarks.js';

/**
 * Narrative chapter
 */
export interface NarrativeChapter {
  id: string;
  title: string;
  period: string;
  timeRange: { start: number; end: number };
  duration: number; // in days

  // Chapter content
  summary: string;
  highlights: string[];
  challenges: string[];
  breakthroughs: string[];

  // Learning metrics
  topicsLearned: string[];
  skillsGained: string[];
  masteryLevels: Array<{ topic: string; level: number }>;

  // Emotional arc
  emotionalTone: 'positive' | 'neutral' | 'challenged';
  emotionalProgression: number[]; // -1 to 1 over time

  // Landmarks
  landmarks: TemporalLandmark[];

  // Related chapters
  previousChapterId?: string;
  nextChapterId?: string;
}

/**
 * Autobiographical narrative
 */
export interface AutobiographicalNarrative {
  studentId: string;
  title: string;
  subtitle: string;

  // Narrative structure
  chapters: NarrativeChapter[];
  introduction: string;
  conclusion: string;

  // Overall themes
  themes: string[];
  growthDimensions: GrowthDimension[];

  // Hero's journey elements
  herosJourney: HerosJourney;

  // Metadata
  totalMemories: number;
  timeSpan: number; // in days
  generatedAt: number;
}

/**
 * Growth dimension (aspect of student development)
 */
export interface GrowthDimension {
  name: string;
  description: string;
  startLevel: number; // 0-1
  endLevel: number; // 0-1
  growth: number; // change
  evidence: string[];
}

/**
 * Hero's journey narrative structure
 */
export interface HerosJourney {
  /** The call to begin learning */
  callToAdventure: string[];
  /** Initial challenges faced */
  testsAndAllies: string[];
  /** Low point of struggle */
  ordeal: string[];
  /** Breakthrough moments */
  reward: string[];
  /** Mastery achieved */
  returnWithElixir: string[];
}

/**
 * Narrative configuration
 */
export interface NarrativeConfig {
  // Minimum memories per chapter
  minChapterSize: number;
  // Maximum chapters to generate
  maxChapters: number;
  // Chapter naming scheme
  namingScheme: 'descriptive' | 'journey' | 'thematic';
  // Include hero's journey analysis
  includeHerosJourney: boolean;
  // Tone for narrative
  tone: 'encouraging' | 'analytical' | 'storytelling';
}

/**
 * Default configuration
 */
export const DEFAULT_NARRATIVE_CONFIG: NarrativeConfig = {
  minChapterSize: 5,
  maxChapters: 10,
  namingScheme: 'journey',
  includeHerosJourney: true,
  tone: 'storytelling',
};

// ═══════════════════════════════════════════════════════════
// Chapter Templates
// ═══════════════════════════════════════════════════════════

const JOURNEY_TITLES = [
  'The Beginning',
  'First Steps',
  'Building Foundations',
  'Gaining Momentum',
  'Facing Challenges',
  'Breakthrough Moments',
  'Deepening Understanding',
  'Refining Skills',
  'Mastery Emerges',
  'Continuing the Journey',
];

const DESCRIPTIVE_TITLES = [
  'Getting Started',
  'Initial Learning',
  'Progress Update',
  'Continued Practice',
  'Skill Development',
  'Knowledge Expansion',
  'Advanced Learning',
  'Milestone Achievement',
];

/**
 * Period descriptions based on progress
 */
function getPeriodDescription(progress: number, tone: 'encouraging' | 'analytical' | 'storytelling'): string {
  const descriptions: Record<string, Record<number, string>> = {
    encouraging: {
      0: 'Beginning an exciting learning journey',
      1: 'Taking first steps and discovering new interests',
      2: 'Building confidence through practice',
      3: 'Overcoming challenges and growing stronger',
      4: 'Making real progress and seeing results',
    },
    analytical: {
      0: 'Initial knowledge acquisition phase',
      1: 'Foundational skill development',
      2: 'Competence building through repetition',
      3: 'Advanced concept integration',
      4: 'Mastery and expertise development',
    },
    storytelling: {
      0: 'Where the journey begins',
      1: 'Venturing into unknown territory',
      2: 'Finding the path forward',
      3: 'Conquering the mountain',
      4: 'The view from the summit',
    },
  };

  const index = Math.min(4, Math.floor(progress * 5));
  return descriptions[tone]?.[index] ?? descriptions.storytelling[index] ?? 'Learning in progress';
}

// ═══════════════════════════════════════════════════════════
// Narrative Builder
// ═══════════════════════════════════════════════════════════

export class NarrativeBuilder {
  private readonly config: NarrativeConfig;

  constructor(config?: Partial<NarrativeConfig>) {
    this.config = { ...DEFAULT_NARRATIVE_CONFIG, ...config };
  }

  /**
   * Build a complete autobiographical narrative
   */
  buildNarrative(params: {
    studentId: string;
    memories: EpisodicMemory[];
    semanticMemories: SemanticMemory[];
    landmarks: TemporalLandmark[];
    landmarkClusters?: LandmarkCluster[];
  }): AutobiographicalNarrative {
    const { studentId, memories, semanticMemories, landmarks, landmarkClusters } = params;

    // Sort memories by time
    const sortedMemories = [...memories].sort((a, b) => a.timestamp - b.timestamp);
    const sortedLandmarks = [...landmarks].sort((a, b) => a.timestamp - b.timestamp);

    if (sortedMemories.length === 0) {
      return this.emptyNarrative(studentId);
    }

    // Calculate time span
    const startTime = sortedMemories[0].timestamp;
    const endTime = sortedMemories[sortedMemories.length - 1].timestamp;
    const timeSpan = (endTime - startTime) / (24 * 60 * 60 * 1000);

    // Create chapters
    const chapters = this.createChapters(sortedMemories, sortedLandmarks);

    // Link chapters
    this.linkChapters(chapters);

    // Extract themes
    const themes = this.extractThemes(sortedMemories, semanticMemories);

    // Analyze growth dimensions
    const growthDimensions = this.analyzeGrowth(sortedMemories, semanticMemories);

    // Build hero's journey
    const herosJourney = this.config.includeHerosJourney
      ? this.buildHerosJourney(sortedMemories, sortedLandmarks)
      : {
          callToAdventure: [],
          testsAndAllies: [],
          ordeal: [],
          reward: [],
          returnWithElixir: [],
        };

    // Generate introduction and conclusion
    const introduction = this.generateIntroduction(chapters, themes);
    const conclusion = this.generateConclusion(chapters, growthDimensions);

    // Generate title
    const title = this.generateTitle(studentId, themes, timeSpan);
    const subtitle = this.generateSubtitle(themes, timeSpan);

    return {
      studentId,
      title,
      subtitle,
      chapters,
      introduction,
      conclusion,
      themes,
      growthDimensions,
      herosJourney,
      totalMemories: memories.length,
      timeSpan,
      generatedAt: Date.now(),
    };
  }

  /**
   * Create narrative chapters from memories
   */
  private createChapters(
    memories: EpisodicMemory[],
    landmarks: TemporalLandmark[]
  ): NarrativeChapter[] {
    const chapters: NarrativeChapter[] = [];

    // Determine chapter size
    const totalMemories = memories.length;
    const chapterSize = Math.max(
      this.config.minChapterSize,
      Math.ceil(totalMemories / this.config.maxChapters)
    );

    // Group memories into chapters
    for (let i = 0; i < totalMemories; i += chapterSize) {
      const chapterMemories = memories.slice(i, i + chapterSize);
      const chapterLandmarks = this.getLandmarksInTimeRange(
        landmarks,
        chapterMemories[0].timestamp,
        chapterMemories[chapterMemories.length - 1].timestamp
      );

      const chapter = this.createChapter(
        chapterMemories,
        chapterLandmarks,
        i / totalMemories,
        chapters.length
      );

      chapters.push(chapter);
    }

    return chapters;
  }

  /**
   * Create a single chapter
   */
  private createChapter(
    memories: EpisodicMemory[],
    landmarks: TemporalLandmark[],
    progress: number,
    chapterIndex: number
  ): NarrativeChapter {
    const startTime = memories[0].timestamp;
    const endTime = memories[memories.length - 1].timestamp;
    const duration = (endTime - startTime) / (24 * 60 * 60 * 1000);

    // Determine title
    const title = this.getChapterTitle(progress, chapterIndex);

    // Determine period name
    const period = getPeriodDescription(progress, this.config.tone);

    // Extract topics learned
    const topicsLearned = [...new Set(memories.map(m => m.topic).filter(Boolean) as string[])];

    // Extract skills gained
    const skillsGained = this.extractSkills(memories);

    // Calculate mastery levels
    const masteryLevels = this.calculateMasteryLevels(memories);

    // Identify highlights
    const highlights = this.extractHighlights(memories, landmarks);

    // Identify challenges
    const challenges = this.extractChallenges(memories);

    // Identify breakthroughs
    const breakthroughs = this.extractBreakthroughs(landmarks);

    // Calculate emotional tone
    const emotionalTone = this.calculateEmotionalTone(memories);

    // Calculate emotional progression
    const emotionalProgression = memories.map(m => m.emotionalValence);

    // Generate summary
    const summary = this.generateChapterSummary(
      memories,
      landmarks,
      topicsLearned,
      emotionalTone
    );

    return {
      id: `chapter_${Date.now()}_${chapterIndex}`,
      title,
      period,
      timeRange: { start: startTime, end: endTime },
      duration,
      summary,
      highlights,
      challenges,
      breakthroughs,
      topicsLearned,
      skillsGained,
      masteryLevels,
      emotionalTone,
      emotionalProgression,
      landmarks,
    };
  }

  /**
   * Get chapter title based on naming scheme
   */
  private getChapterTitle(progress: number, index: number): string {
    switch (this.config.namingScheme) {
      case 'journey':
        return JOURNEY_TITLES[Math.min(index, JOURNEY_TITLES.length - 1)];
      case 'descriptive':
        return DESCRIPTIVE_TITLES[Math.min(index, DESCRIPTIVE_TITLES.length - 1)];
      case 'thematic':
        // Will be set based on chapter content
        return `Chapter ${index + 1}`;
    }
  }

  /**
   * Link chapters together
   */
  private linkChapters(chapters: NarrativeChapter[]): void {
    for (let i = 0; i < chapters.length; i++) {
      if (i > 0) {
        chapters[i].previousChapterId = chapters[i - 1].id;
      }
      if (i < chapters.length - 1) {
        chapters[i].nextChapterId = chapters[i + 1].id;
      }
    }
  }

  /**
   * Get landmarks in a time range
   */
  private getLandmarksInTimeRange(
    landmarks: TemporalLandmark[],
    start: number,
    end: number
  ): TemporalLandmark[] {
    return landmarks.filter(l => l.timestamp >= start && l.timestamp <= end);
  }

  /**
   * Extract skills from memories
   */
  private extractSkills(memories: EpisodicMemory[]): string[] {
    const skills = new Set<string>();

    for (const memory of memories) {
      // Look for "learned/ practiced/ used X" patterns
      const skillPatterns = [
        /learned\s+(\w+)/i,
        /practiced\s+(\w+)/i,
        /mastered\s+(\w+)/i,
        /used\s+(\w+)/i,
        /applied\s+(\w+)/i,
      ];

      for (const pattern of skillPatterns) {
        const match = memory.content.match(pattern);
        if (match) {
          skills.add(match[1]);
        }
      }
    }

    return Array.from(skills);
  }

  /**
   * Calculate mastery levels for topics
   */
  private calculateMasteryLevels(memories: EpisodicMemory[]): Array<{ topic: string; level: number }> {
    const byTopic = new Map<string, EpisodicMemory[]>();

    for (const memory of memories) {
      if (!memory.topic) continue;
      if (!byTopic.has(memory.topic)) {
        byTopic.set(memory.topic, []);
      }
      byTopic.get(memory.topic)!.push(memory);
    }

    const masteryLevels: Array<{ topic: string; level: number }> = [];

    for (const [topic, topicMemories] of byTopic.entries()) {
      // Calculate average success level
      const successLevels = topicMemories.map(m => m.successLevel ?? 0.5).filter(s => s > 0);
      const avgSuccess = successLevels.length > 0
        ? successLevels.reduce((a, b) => a + b, 0) / successLevels.length
        : 0.5;

      // Boost based on number of practices
      const practiceBonus = Math.min(0.2, topicMemories.length * 0.02);

      masteryLevels.push({
        topic,
        level: Math.min(1, avgSuccess + practiceBonus),
      });
    }

    // Sort by level descending
    return masteryLevels.sort((a, b) => b.level - a.level);
  }

  /**
   * Extract chapter highlights
   */
  private extractHighlights(memories: EpisodicMemory[], landmarks: TemporalLandmark[]): string[] {
    const highlights: string[] = [];

    // Add landmark highlights
    for (const landmark of landmarks) {
      if (landmark.significance > 0.7) {
        highlights.push(landmark.title);
      }
    }

    // Add high-importance memories
    for (const memory of memories) {
      if (memory.importance >= 8) {
        const snippet = memory.content.slice(0, 50);
        if (!highlights.includes(snippet)) {
          highlights.push(snippet);
        }
      }
    }

    return highlights.slice(0, 5);
  }

  /**
   * Extract challenges from memories
   */
  private extractChallenges(memories: EpisodicMemory[]): string[] {
    return memories
      .filter(m => m.emotionalValence < -0.3 || (m.successLevel ?? 1) < 0.4)
      .map(m => m.content.slice(0, 60))
      .slice(0, 3);
  }

  /**
   * Extract breakthroughs from landmarks
   */
  private extractBreakthroughs(landmarks: TemporalLandmark[]): string[] {
    return landmarks
      .filter(l => l.type === 'breakthrough' || l.type === 'milestone')
      .map(l => l.title);
  }

  /**
   * Calculate emotional tone for a chapter
   */
  private calculateEmotionalTone(memories: EpisodicMemory[]): 'positive' | 'neutral' | 'challenged' {
    const avgEmotion = memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;

    if (avgEmotion > 0.3) return 'positive';
    if (avgEmotion < -0.2) return 'challenged';
    return 'neutral';
  }

  /**
   * Generate chapter summary
   */
  private generateChapterSummary(
    memories: EpisodicMemory[],
    landmarks: TemporalLandmark[],
    topics: string[],
    emotionalTone: 'positive' | 'neutral' | 'challenged'
  ): string {
    const parts: string[] = [];

    // Opening
    const duration = (memories[memories.length - 1].timestamp - memories[0].timestamp) / (24 * 60 * 60 * 1000);
    const dayText = duration < 1 ? 'less than a day' : duration === 1 ? 'a day' : `${Math.round(duration)} days`;

    // Learning activity
    if (topics.length > 0) {
      parts.push(`Explored ${topics.slice(0, 3).join(', ')}`);
    }

    // Landmark mentions
    const breakthroughCount = landmarks.filter(l => l.type === 'breakthrough').length;
    const milestoneCount = landmarks.filter(l => l.type === 'milestone').length;

    if (breakthroughCount > 0) {
      parts.push(`Had ${breakthroughCount} breakthrough moment${breakthroughCount > 1 ? 's' : ''}`);
    }
    if (milestoneCount > 0) {
      parts.push(`Achieved ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''}`);
    }

    // Emotional tone
    if (emotionalTone === 'positive') {
      parts.push('Overall positive experience');
    } else if (emotionalTone === 'challenged') {
      parts.push('Faced challenges that led to growth');
    }

    return parts.length > 0
      ? parts.join('. ') + '.'
      : 'A period of learning and exploration.';
  }

  /**
   * Extract overall themes
   */
  private extractThemes(
    memories: EpisodicMemory[],
    semanticMemories: SemanticMemory[]
  ): string[] {
    const themes = new Set<string>();

    // Add topics from memories
    for (const memory of memories) {
      if (memory.topic) themes.add(memory.topic);
      if (memory.subject) themes.add(memory.subject);
    }

    // Add concepts from semantic memories
    for (const semantic of semanticMemories) {
      themes.add(semantic.concept);
    }

    // Add process themes
    const successRate = memories.filter(m => (m.successLevel ?? 0) > 0.6).length / memories.length;
    if (successRate > 0.7) themes.add('Consistent progress');
    if (successRate < 0.4) themes.add('Perseverance through challenges');

    const avgEmotion = memories.reduce((sum, m) => sum + m.emotionalValence, 0) / memories.length;
    if (avgEmotion > 0.4) themes.add('Positive engagement');
    if (avgEmotion < -0.2) themes.add('Overcoming difficulties');

    return Array.from(themes).slice(0, 8);
  }

  /**
   * Analyze growth across dimensions
   */
  private analyzeGrowth(
    memories: EpisodicMemory[],
    semanticMemories: SemanticMemory[]
  ): GrowthDimension[] {
    const dimensions: GrowthDimension[] = [];

    // Split memories into early and late
    const midPoint = memories.length / 2;
    const earlyMemories = memories.slice(0, midPoint);
    const lateMemories = memories.slice(midPoint);

    // Analyze topic mastery growth
    const topics = new Set([
      ...earlyMemories.map(m => m.topic).filter(Boolean) as string[],
      ...lateMemories.map(m => m.topic).filter(Boolean) as string[],
    ]);

    for (const topic of topics) {
      const earlyTopicMemories = earlyMemories.filter(m => m.topic === topic);
      const lateTopicMemories = lateMemories.filter(m => m.topic === topic);

      const startLevel = earlyTopicMemories.length > 0
        ? earlyTopicMemories.reduce((sum, m) => sum + (m.successLevel ?? 0.5), 0) / earlyTopicMemories.length
        : 0;
      const endLevel = lateTopicMemories.length > 0
        ? lateTopicMemories.reduce((sum, m) => sum + (m.successLevel ?? 0.5), 0) / lateTopicMemories.length
        : startLevel;

      if (lateTopicMemories.length > 0) {
        dimensions.push({
          name: topic,
          description: `Understanding and skill in ${topic}`,
          startLevel,
          endLevel,
          growth: endLevel - startLevel,
          evidence: lateTopicMemories.slice(-3).map(m => m.content.slice(0, 50)),
        });
      }
    }

    // Overall emotional growth
    const earlyEmotion = earlyMemories.reduce((sum, m) => sum + m.emotionalValence, 0) / earlyMemories.length;
    const lateEmotion = lateMemories.reduce((sum, m) => sum + m.emotionalValence, 0) / lateMemories.length;

    dimensions.push({
      name: 'Emotional Engagement',
      description: 'Positive emotional connection to learning',
      startLevel: (earlyEmotion + 1) / 2,
      endLevel: (lateEmotion + 1) / 2,
      growth: ((lateEmotion - earlyEmotion) / 2),
      evidence: [
        `Early average emotion: ${earlyEmotion.toFixed(2)}`,
        `Late average emotion: ${lateEmotion.toFixed(2)}`,
      ],
    });

    return dimensions.sort((a, b) => b.growth - a.growth);
  }

  /**
   * Build hero's journey narrative
   */
  private buildHerosJourney(
    memories: EpisodicMemory[],
    landmarks: TemporalLandmark[]
  ): HerosJourney {
    const journey: HerosJourney = {
      callToAdventure: [],
      testsAndAllies: [],
      ordeal: [],
      reward: [],
      returnWithElixir: [],
    };

    // Call to adventure: first-time landmarks
    journey.callToAdventure = landmarks
      .filter(l => l.type === 'first_time')
      .map(l => l.title);

    // Tests and allies: social landmarks, struggles
    journey.testsAndAllies = landmarks
      .filter(l => l.type === 'social' || l.emotionalValence < -0.2)
      .map(l => l.title);

    // Ordeal: lowest emotional points
    const lowPoints = memories.filter(m => m.emotionalValence < -0.4);
    journey.ordeal = lowPoints.slice(0, 3).map(m => m.content.slice(0, 50));

    // Reward: breakthroughs and milestones
    journey.reward = landmarks
      .filter(l => l.type === 'breakthrough' || l.type === 'milestone')
      .map(l => l.title);

    // Return with elixir: comebacks and high mastery
    journey.returnWithElixir = landmarks
      .filter(l => l.type === 'comeback')
      .map(l => l.title);

    return journey;
  }

  /**
   * Generate introduction
   */
  private generateIntroduction(
    chapters: NarrativeChapter[],
    themes: string[]
  ): string {
    if (chapters.length === 0) {
      return 'No learning journey to narrate yet.';
    }

    const firstChapter = chapters[0];
    const lastChapter = chapters[chapters.length - 1];

    const parts: string[] = [];

    // Opening
    parts.push('This is the story of a learning journey');

    // Themes
    if (themes.length > 0) {
      parts.push(`exploring ${themes.slice(0, 3).join(', ')}`);
    }

    // Duration
    const totalDuration = lastChapter.timeRange.end - firstChapter.timeRange.start;
    const days = Math.round(totalDuration / (24 * 60 * 60 * 1000));
    if (days > 0) {
      parts.push(`spanning ${days} days of growth and discovery`);
    }

    // Chapters
    parts.push(`across ${chapters.length} chapters of experience`);

    return parts.join(' ') + '.';
  }

  /**
   * Generate conclusion
   */
  private generateConclusion(
    chapters: NarrativeChapter[],
    growthDimensions: GrowthDimension[]
  ): string {
    const parts: string[] = [];

    // Overall journey
    parts.push('This learning journey demonstrates');

    // Key growth
    if (growthDimensions.length > 0) {
      const topGrowth = growthDimensions.slice(0, 3);
      const growthDescriptions = topGrowth.map(d => `${d.name} (${Math.round(d.growth * 100)}% growth)`);
      parts.push(`significant growth in ${growthDescriptions.join(', ')}`);
    }

    // Forward looking
    parts.push('The foundation has been built for continued learning and exploration');

    return parts.join('. ') + '.';
  }

  /**
   * Generate title
   */
  private generateTitle(studentId: string, themes: string[], timeSpan: number): string {
    const primaryTheme = themes[0] ?? 'Learning';

    if (timeSpan < 7) {
      return `${primaryTheme} - A Week of Growth`;
    } else if (timeSpan < 30) {
      return `${primaryTheme} - A Month of Discovery`;
    } else if (timeSpan < 90) {
      return `${primaryTheme} - A Quarter of Learning`;
    } else {
      return `${primaryTheme} - A Learning Journey`;
    }
  }

  /**
   * Generate subtitle
   */
  private generateSubtitle(themes: string[], timeSpan: number): string {
    const days = Math.round(timeSpan);
    const themeText = themes.slice(0, 3).join(', ');

    return `${days} days exploring ${themeText}`;
  }

  /**
   * Create empty narrative
   */
  private emptyNarrative(studentId: string): AutobiographicalNarrative {
    return {
      studentId,
      title: 'Learning Journey Awaits',
      subtitle: 'Your story is yet to be written',
      chapters: [],
      introduction: 'No memories recorded yet. The learning journey is about to begin.',
      conclusion: 'Start learning to build your narrative.',
      themes: [],
      growthDimensions: [],
      herosJourney: {
        callToAdventure: [],
        testsAndAllies: [],
        ordeal: [],
        reward: [],
        returnWithElixir: [],
      },
      totalMemories: 0,
      timeSpan: 0,
      generatedAt: Date.now(),
    };
  }

  /**
   * Generate a summary paragraph for the entire narrative
   */
  generateNarrativeSummary(narrative: AutobiographicalNarrative): string {
    const parts: string[] = [];

    parts.push(`A learning journey of ${Math.round(narrative.timeSpan)} days`);

    if (narrative.themes.length > 0) {
      parts.push(`exploring ${narrative.themes.slice(0, 3).join(', ')}`);
    }

    parts.push(`across ${narrative.chapters.length} chapters`);

    if (narrative.growthDimensions.length > 0) {
      const topGrowth = narrative.growthDimensions[0];
      parts.push(`with strongest growth in ${topGrowth.name}`);
    }

    return parts.join(', ') + '.';
  }

  /**
   * Export narrative as markdown
   */
  toMarkdown(narrative: AutobiographicalNarrative): string {
    const lines: string[] = [];

    lines.push(`# ${narrative.title}`);
    lines.push(`*${narrative.subtitle}*\n`);
    lines.push(`**Student ID:** ${narrative.studentId}`);
    lines.push(`**Generated:** ${new Date(narrative.generatedAt).toLocaleDateString()}`);
    lines.push(`**Duration:** ${Math.round(narrative.timeSpan)} days\n`);

    // Introduction
    lines.push('## Introduction');
    lines.push(narrative.introduction + '\n');

    // Themes
    if (narrative.themes.length > 0) {
      lines.push('## Themes');
      for (const theme of narrative.themes) {
        lines.push(`- ${theme}`);
      }
      lines.push('');
    }

    // Growth dimensions
    if (narrative.growthDimensions.length > 0) {
      lines.push('## Growth');
      for (const dim of narrative.growthDimensions) {
        const growthPercent = Math.round(dim.growth * 100);
        lines.push(`### ${dim.name}`);
        lines.push(`**Growth:** ${growthPercent}% (${(dim.startLevel * 100).toFixed(0)}% -> ${(dim.endLevel * 100).toFixed(0)}%)`);
        if (dim.evidence.length > 0) {
          lines.push('**Evidence:**');
          for (const ev of dim.evidence) {
            lines.push(`  - ${ev}`);
          }
        }
        lines.push('');
      }
    }

    // Chapters
    lines.push('## Chapters\n');
    for (const chapter of narrative.chapters) {
      lines.push(`### ${chapter.title}`);
      lines.push(`*${chapter.period}*`);
      lines.push(`**Duration:** ${Math.round(chapter.duration)} days`);
      lines.push(`**Tone:** ${chapter.emotionalTone}\n`);
      lines.push(chapter.summary + '\n');

      if (chapter.topicsLearned.length > 0) {
        lines.push('**Topics:** ' + chapter.topicsLearned.join(', '));
      }
      if (chapter.highlights.length > 0) {
        lines.push('**Highlights:**');
        for (const h of chapter.highlights) {
          lines.push(`  - ${h}`);
        }
      }
      lines.push('');
    }

    // Conclusion
    lines.push('## Conclusion');
    lines.push(narrative.conclusion + '\n');

    // Hero's journey
    if (narrative.herosJourney.callToAdventure.length > 0) {
      lines.push('## Hero\'s Journey');
      lines.push('**Call to Adventure:**');
      for (const item of narrative.herosJourney.callToAdventure) {
        lines.push(`  - ${item}`);
      }
      lines.push('');
      lines.push('**Tests and Allies:**');
      for (const item of narrative.herosJourney.testsAndAllies) {
        lines.push(`  - ${item}`);
      }
      lines.push('');
      lines.push('**Ordeal:**');
      for (const item of narrative.herosJourney.ordeal) {
        lines.push(`  - ${item}`);
      }
      lines.push('');
      lines.push('**Reward:**');
      for (const item of narrative.herosJourney.reward) {
        lines.push(`  - ${item}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Factory function
 */
export function createNarrativeBuilder(config?: Partial<NarrativeConfig>): NarrativeBuilder {
  return new NarrativeBuilder(config);
}
