/**
 * DMLoG.AI - Player Memory System
 *
 * Tracks player preferences, playstyle, growth, and patterns
 * across campaigns. Enables personalized DMing and adaptation.
 */

import {
  PlayerMemoryState,
  PlayerCampaignMemory,
  PlayStyleProfile,
  PlayerPreferences,
  PlayerGrowth,
  CombatStyle,
  RoleplayStyle,
  ProblemSolvingStyle,
  Milestone,
  BehaviorPattern,
  FeedbackEntry,
} from './types.js';

// ============================================================================
// PLAYER MEMORY STORE
// ============================================================================

export class PlayerMemoryStore {
  private players: Map<string, PlayerMemoryState> = new Map();

  // ========================================================================
  // INITIALIZATION
  // ========================================================================

  /**
   * Initialize a new player memory
   */
  initializePlayer(
    playerId: string,
    initialPreferences?: Partial<PlayerPreferences>
  ): PlayerMemoryState {
    const state: PlayerMemoryState = {
      playerId,
      campaigns: new Map(),
      playStyle: {
        combatPreference: CombatStyle.TACTICAL,
        roleplayPreference: RoleplayStyle.CASUAL,
        problemSolving: ProblemSolvingStyle.DIPLOMATIC,
        riskTolerance: 0.5,
        leadershipTendency: 0.5,
        humorLevel: 0.5,
        agencyPreference: 0.5,
        updateFrequency: 0.1,
      },
      preferences: {
        preferredContent: [],
        avoidedContent: [],
        pacing: 'medium',
        tone: 'balanced',
        complexity: 'moderate',
        agency: 'balanced',
        lastUpdate: Date.now(),
        ...initialPreferences,
      },
      growth: {
        skillsLearned: [],
        milestones: [],
        patterns: [],
        feedbackHistory: [],
        overallTrajectory: 'stable',
      },
    };

    this.players.set(playerId, state);
    return state;
  }

  /**
   * Get or create player state
   */
  getOrCreatePlayer(playerId: string): PlayerMemoryState {
    try {
      return this.getPlayerState(playerId);
    } catch {
      return this.initializePlayer(playerId);
    }
  }

  // ========================================================================
  // CAMPAIGN TRACKING
  // ========================================================================

  /**
   * Add player to a campaign
   */
  joinCampaign(
    playerId: string,
    campaignId: string,
    characterId: string
  ): PlayerCampaignMemory {
    const state = this.getOrCreatePlayer(playerId);

    const campaignMem: PlayerCampaignMemory = {
      campaignId,
      characters: [characterId],
      joinedAt: Date.now(),
      sessions: 0,
      totalPlaytime: 0,
      achievements: [],
      notes: [],
      relationships: new Map(),
    };

    state.campaigns.set(campaignId, campaignMem);
    return campaignMem;
  }

  /**
   * Get player's memory for a specific campaign
   */
  getCampaignMemory(playerId: string, campaignId: string): PlayerCampaignMemory | null {
    const state = this.players.get(playerId);
    return state?.campaigns.get(campaignId) || null;
  }

  /**
   * Record a session for the player
   */
  recordSession(
    playerId: string,
    campaignId: string,
    duration: number, // minutes
    characterId?: string
  ): void {
    const state = this.getPlayerState(playerId);
    const campaignMem = state.campaigns.get(campaignId);

    if (!campaignMem) {
      throw new Error(`Player ${playerId} not in campaign ${campaignId}`);
    }

    campaignMem.sessions++;
    campaignMem.totalPlaytime += duration;

    if (characterId && !campaignMem.characters.includes(characterId)) {
      campaignMem.characters.push(characterId);
    }
  }

  /**
   * Add achievement for player
   */
  addAchievement(
    playerId: string,
    campaignId: string,
    achievement: string
  ): void {
    const state = this.getPlayerState(playerId);
    const campaignMem = state.campaigns.get(campaignId);

    if (campaignMem && !campaignMem.achievements.includes(achievement)) {
      campaignMem.achievements.push(achievement);
    }
  }

  /**
   * Add player note
   */
  addNote(
    playerId: string,
    campaignId: string,
    note: string
  ): void {
    const state = this.getPlayerState(playerId);
    const campaignMem = state.campaigns.get(campaignId);

    if (campaignMem) {
      campaignMem.notes.push(`[${new Date().toISOString()}] ${note}`);
    }
  }

  /**
   * Update NPC relationship affinity
   */
  updateNPCRelationship(
    playerId: string,
    campaignId: string,
    npcId: string,
    affinityDelta: number
  ): void {
    const state = this.getPlayerState(playerId);
    const campaignMem = state.campaigns.get(campaignId);

    if (campaignMem) {
      const current = campaignMem.relationships.get(npcId) || 0;
      campaignMem.relationships.set(npcId, Math.max(-100, Math.min(100, current + affinityDelta)));
    }
  }

  // ========================================================================
  // PLAYSTYLE TRACKING
  // ========================================================================

  /**
   * Update playstyle based on observed behavior
   */
  updatePlaystyle(
    playerId: string,
    observations: Partial<PlayStyleProfile>
  ): void {
    const state = this.getPlayerState(playerId);
    const ps = state.playStyle;
    const rate = ps.updateFrequency;

    // Gradual adjustment based on update frequency
    if (observations.combatPreference !== undefined) {
      ps.combatPreference = this.blendEnum(
        ps.combatPreference,
        observations.combatPreference,
        rate
      ) as CombatStyle;
    }

    if (observations.roleplayPreference !== undefined) {
      ps.roleplayPreference = this.blendEnum(
        ps.roleplayPreference,
        observations.roleplayPreference,
        rate
      ) as RoleplayStyle;
    }

    if (observations.problemSolving !== undefined) {
      ps.problemSolving = this.blendEnum(
        ps.problemSolving,
        observations.problemSolving,
        rate
      ) as ProblemSolvingStyle;
    }

    // Numeric values blend directly
    if (observations.riskTolerance !== undefined) {
      ps.riskTolerance = this.blend(ps.riskTolerance, observations.riskTolerance, rate);
    }

    if (observations.leadershipTendency !== undefined) {
      ps.leadershipTendency = this.blend(ps.leadershipTendency, observations.leadershipTendency, rate);
    }

    if (observations.humorLevel !== undefined) {
      ps.humorLevel = this.blend(ps.humorLevel, observations.humorLevel, rate);
    }

    if (observations.agencyPreference !== undefined) {
      ps.agencyPreference = this.blend(ps.agencyPreference, observations.agencyPreference, rate);
    }
  }

  /**
   * Get playstyle summary for AI prompting
   */
  getPlaystylePrompt(playerId: string): string {
    const state = this.getPlayerState(playerId);
    const ps = state.playStyle;
    const prefs = state.preferences;

    let prompt = 'Player Playstyle Profile:\n';

    // Combat
    prompt += `Combat: ${this.describeEnum(ps.combatPreference)}. `;
    if (ps.combatPreference === CombatStyle.DIPLOMATIC) {
      prompt += 'Prefers avoiding combat when possible.';
    } else if (ps.combatPreference === CombatStyle.AGGRESSIVE) {
      prompt += 'Leans into conflict headfirst.';
    } else if (ps.combatPreference === CombatStyle.TACTICAL) {
      prompt += 'Enjoys strategic combat encounters.';
    } else if (ps.combatPreference === CombatStyle.CREATIVE) {
      prompt += 'Uses creative solutions in combat.';
    }

    // Roleplay
    prompt += `\nRoleplay: ${this.describeEnum(ps.roleplayPreference)}. `;

    // Problem solving
    prompt += `\nProblem Solving: ${this.describeEnum(ps.problemSolving)}. `;

    // Risk
    prompt += `\nRisk Tolerance: ${ps.riskTolerance < 0.3 ? 'Cautious' : ps.riskTolerance > 0.7 ? 'Bold' : 'Balanced'}. `;

    // Leadership
    prompt += `\nLeadership: ${ps.leadershipTendency < 0.3 ? 'Follower' : ps.leadershipTendency > 0.7 ? 'Leader' : 'Flexible'}. `;

    // Preferences
    prompt += `\n\nPreferences:\n`;
    prompt += `- Pacing: ${prefs.pacing}\n`;
    prompt += `- Tone: ${prefs.tone}\n`;
    prompt += `- Complexity: ${prefs.complexity}\n`;
    prompt += `- Agency: ${prefs.agency}\n`;

    if (prefs.preferredContent.length > 0) {
      prompt += `- Enjoys: ${prefs.preferredContent.join(', ')}\n`;
    }

    if (prefs.avoidedContent.length > 0) {
      prompt += `- Avoids: ${prefs.avoidedContent.join(', ')}\n`;
    }

    return prompt;
  }

  // ========================================================================
  // PLAYER PREFERENCES
  // ========================================================================

  /**
   * Update player preferences
   */
  updatePreferences(
    playerId: string,
    updates: Partial<PlayerPreferences>
  ): void {
    const state = this.getPlayerState(playerId);
    Object.assign(state.preferences, updates);
    state.preferences.lastUpdate = Date.now();
  }

  /**
   * Add preferred content type
   */
  addPreferredContent(playerId: string, contentType: string): void {
    const state = this.getPlayerState(playerId);
    if (!state.preferences.preferredContent.includes(contentType)) {
      state.preferences.preferredContent.push(contentType);
    }

    // Remove from avoided if present
    const avoidedIndex = state.preferences.avoidedContent.indexOf(contentType);
    if (avoidedIndex >= 0) {
      state.preferences.avoidedContent.splice(avoidedIndex, 1);
    }
  }

  /**
   * Add avoided content type
   */
  addAvoidedContent(playerId: string, contentType: string): void {
    const state = this.getPlayerState(playerId);
    if (!state.preferences.avoidedContent.includes(contentType)) {
      state.preferences.avoidedContent.push(contentType);
    }

    // Remove from preferred if present
    const preferredIndex = state.preferences.preferredContent.indexOf(contentType);
    if (preferredIndex >= 0) {
      state.preferences.preferredContent.splice(preferredIndex, 1);
    }
  }

  /**
   * Check if player would like content
   */
  isContentPreferred(playerId: string, contentType: string): boolean {
    const state = this.getPlayerState(playerId);

    if (state.preferences.avoidedContent.includes(contentType)) {
      return false;
    }

    if (state.preferences.preferredContent.includes(contentType)) {
      return true;
    }

    return true; // Neutral by default
  }

  // ========================================================================
  // PLAYER GROWTH
  // ========================================================================

  /**
   * Record a milestone
   */
  recordMilestone(
    playerId: string,
    title: string,
    description: string,
    category: Milestone['category'],
    importance: number = 0.7
  ): Milestone {
    const state = this.getPlayerState(playerId);

    const milestone: Milestone = {
      id: `milestone_${Date.now()}`,
      timestamp: Date.now(),
      title,
      description,
      category,
      importance,
    };

    state.growth.milestones.push(milestone);
    this.updateTrajectory(playerId);
    return milestone;
  }

  /**
   * Record a skill learned
   */
  recordSkillLearned(playerId: string, skill: string): void {
    const state = this.getPlayerState(playerId);

    if (!state.growth.skillsLearned.includes(skill)) {
      state.growth.skillsLearned.push(skill);
    }
  }

  /**
   * Record a behavior pattern
   */
  recordBehaviorPattern(
    playerId: string,
    pattern: Omit<BehaviorPattern, 'firstObserved' | 'lastObserved'>
  ): void {
    const state = this.getPlayerState(playerId);

    // Check if pattern already exists
    const existing = state.growth.patterns.find(
      p => p.description === pattern.description
    );

    if (existing) {
      existing.lastObserved = Date.now();
      existing.frequency = pattern.frequency;
      existing.reliability = (existing.reliability + pattern.reliability) / 2;
    } else {
      const newPattern: BehaviorPattern = {
        ...pattern,
        firstObserved: Date.now(),
        lastObserved: Date.now(),
      };
      state.growth.patterns.push(newPattern);
    }
  }

  /**
   * Add feedback entry
   */
  addFeedback(
    playerId: string,
    sessionId: string,
    positiveAspects: string[],
    negativeAspects: string[],
    rating?: number
  ): void {
    const state = this.getPlayerState(playerId);

    const feedback: FeedbackEntry = {
      timestamp: Date.now(),
      sessionId,
      positiveAspects,
      negativeAspects,
      rating,
    };

    state.growth.feedbackHistory.push(feedback);

    // Update preferences based on feedback
    for (const positive of positiveAspects) {
      this.addPreferredContent(playerId, positive.toLowerCase());
    }

    for (const negative of negativeAspects) {
      this.addAvoidedContent(playerId, negative.toLowerCase());
    }

    this.updateTrajectory(playerId);
  }

  /**
   * Get growth insights
   */
  getGrowthInsights(playerId: string): string {
    const state = this.getPlayerState(playerId);
    const growth = state.growth;

    let insights = 'Player Growth Journey:\n\n';

    // Milestones
    if (growth.milestones.length > 0) {
      insights += 'Key Milestones:\n';
      const recentMilestones = growth.milestones
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      for (const milestone of recentMilestones) {
        insights += `- ${milestone.title}: ${milestone.description}\n`;
      }
      insights += '\n';
    }

    // Skills
    if (growth.skillsLearned.length > 0) {
      insights += `Skills Learned (${growth.skillsLearned.length}): `;
      insights += growth.skillsLearned.slice(0, 5).join(', ');
      if (growth.skillsLearned.length > 5) {
        insights += `, and ${growth.skillsLearned.length - 5} more`;
      }
      insights += '\n\n';
    }

    // Patterns
    if (growth.patterns.length > 0) {
      insights += 'Observed Patterns:\n';
      const reliablePatterns = growth.patterns
        .filter(p => p.reliability > 0.6)
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 3);

      for (const pattern of reliablePatterns) {
        insights += `- ${pattern.description} (frequency: ${pattern.frequency.toFixed(2)})\n`;
      }
      insights += '\n';
    }

    // Trajectory
    insights += `Overall Trajectory: ${growth.overallTrajectory.toUpperCase()}\n`;

    return insights;
  }

  /**
   * Get recommendations based on player profile
   */
  getRecommendations(playerId: string): string[] {
    const state = this.getPlayerState(playerId);
    const recommendations: string[] = [];

    // Based on playstyle
    if (state.playStyle.riskTolerance < 0.3) {
      recommendations.push('Offer safe alternatives to dangerous options');
    }

    if (state.playStyle.roleplayPreference === RoleplayStyle.METHOD) {
      recommendations.push('Provide deep roleplay opportunities');
    }

    if (state.playStyle.combatPreference === CombatStyle.TACTICAL) {
      recommendations.push('Include complex combat scenarios');
    }

    if (state.playStyle.agencyPreference > 0.7) {
      recommendations.push('Allow player-driven narrative direction');
    }

    // Based on growth trajectory
    if (state.growth.overallTrajectory === 'growing') {
      recommendations.push('Introduce new challenges to match growth');
    } else if (state.growth.overallTrajectory === 'plateaued') {
      recommendations.push('Try something different to renew engagement');
    }

    // Based on avoided content
    for (const avoided of state.preferences.avoidedContent) {
      recommendations.push(`Avoid or minimize: ${avoided}`);
    }

    return recommendations;
  }

  // ========================================================================
  // SERIALIZATION
  // ========================================================================

  /**
   * Serialize player state
   */
  serialize(playerId: string): any | null {
    const state = this.players.get(playerId);
    if (!state) return null;

    return {
      playerId: state.playerId,
      campaigns: Object.fromEntries(state.campaigns),
      playStyle: state.playStyle,
      preferences: state.preferences,
      growth: state.growth,
    };
  }

  /**
   * Deserialize player state
   */
  deserialize(data: any): PlayerMemoryState {
    const state: PlayerMemoryState = {
      playerId: data.playerId,
      campaigns: new Map(Object.entries(data.campaigns)),
      playStyle: data.playStyle,
      preferences: data.preferences,
      growth: data.growth,
    };

    this.players.set(data.playerId, state);
    return state;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getPlayerState(playerId: string): PlayerMemoryState {
    const state = this.players.get(playerId);
    if (!state) {
      throw new Error(`Player ${playerId} not found in memory store`);
    }
    return state;
  }

  private blend(current: number, target: number, rate: number): number {
    return current + (target - current) * rate;
  }

  private blendEnum<T extends string>(current: T, target: T, rate: number): T {
    // For enums, switch if rate threshold is crossed
    return Math.random() < rate ? target : current;
  }

  private describeEnum(value: string): string {
    return value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private updateTrajectory(playerId: string): void {
    const state = this.getPlayerState(playerId);
    const growth = state.growth;

    // Calculate trajectory based on recent feedback and milestones
    const recentFeedback = growth.feedbackHistory.slice(-5);
    const recentMilestones = growth.milestones.filter(
      m => Date.now() - m.timestamp < 90 * 86400000 // Last 90 days
    );

    if (recentFeedback.length === 0) {
      growth.overallTrajectory = 'stable';
      return;
    }

    const avgRating = recentFeedback
      .filter(f => f.rating !== undefined)
      .reduce((sum, f) => sum + (f.rating || 0), 0) / recentFeedback.length;

    const milestoneRate = recentMilestones.length / 3; // Per quarter

    if (avgRating > 0.7 && milestoneRate > 1) {
      growth.overallTrajectory = 'growing';
    } else if (avgRating < 0.4) {
      growth.overallTrajectory = 'declining';
    } else if (milestoneRate < 0.5 && avgRating < 0.6) {
      growth.overallTrajectory = 'plateaued';
    } else {
      growth.overallTrajectory = 'stable';
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const playerMemoryStore = new PlayerMemoryStore();
