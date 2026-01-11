/**
 * DMLoG.AI - Relationship Tracker System
 *
 * Tracks and evolves NPC-NPC and NPC-PC relationships through
 * interactions, shared experiences, debts, promises, and time.
 */

import {
  RelationshipState,
  RelationshipType,
  Debt,
  Promise,
  EmotionalValence,
  MemoryType,
  EpisodicMemory,
  CharacterMemoryState,
  MemoryTier,
} from './types.js';
import { characterMemoryStore } from './character-memory.js';

// ============================================================================
// RELATIONSHIP EVENTS
// ============================================================================

export interface RelationshipEvent {
  type: 'interaction' | 'gift' | 'betrayal' | 'help' | 'conflict' | 'alliance' | 'dialogue' | 'combat_together';
  sourceId: string;
  targetId: string;
  magnitude: number; // -1 to 1, negative = harmful, positive = beneficial
  description: string;
  timestamp?: number;
  sessionId?: string;
  campaignId?: string;
  emotionalValence?: EmotionalValence;
}

export interface RelationshipDebtEvent {
  creditorId: string;
  debtorId: string;
  type: Debt['type'];
  description: string;
  magnitude: number;
}

export interface RelationshipPromiseEvent {
  promisorId: string;
  promiseeId: string;
  content: string;
  deadline?: number;
  importance: number;
}

// ============================================================================
// RELATIONSHIP TRACKER
// ============================================================================

export class RelationshipTracker {
  /**
   * Process a relationship event and update relationship state
   */
  processEvent(event: RelationshipEvent): RelationshipState | null {
    const timestamp = event.timestamp || Date.now();
    const campaignId = event.campaignId || '';

    // Get both character states
    const sourceState = this.getOrCreateState(event.sourceId, campaignId);
    const targetState = this.getOrCreateState(event.targetId, campaignId);

    // Get or create relationship
    let relationship = sourceState.relationships.get(event.targetId);

    if (!relationship) {
      relationship = this.createInitialRelationship(event.targetId, timestamp);
      sourceState.relationships.set(event.targetId, relationship);
    }

    // Update relationship based on event
    this.updateRelationshipFromEvent(relationship, event, sourceState);

    // Create reciprocal relationship
    let reciprocal = targetState.relationships.get(event.sourceId);
    if (!reciprocal) {
      reciprocal = this.createInitialRelationship(event.sourceId, timestamp);
      targetState.relationships.set(event.sourceId, reciprocal);
    }

    // Update reciprocal (may have different impact)
    this.updateReciprocalRelationship(reciprocal, event);

    // Update relationship type
    relationship.relationshipType = this.determineRelationshipType(relationship);
    reciprocal.relationshipType = this.determineRelationshipType(reciprocal);

    // Track interaction
    relationship.lastInteraction = timestamp;
    relationship.interactionCount++;
    reciprocal.lastInteraction = timestamp;
    reciprocal.interactionCount++;

    // Add shared memory reference if session provided
    if (event.sessionId) {
      // This would link to actual memories in a full implementation
      relationship.sharedMemories.push(`session_${event.sessionId}`);
      reciprocal.sharedMemories.push(`session_${event.sessionId}`);
    }

    return relationship;
  }

  /**
   * Record a debt between characters
   */
  recordDebt(event: RelationshipDebtEvent): void {
    const creditorState = this.getOrCreateState(event.creditorId, '');
    const debtorState = this.getOrCreateState(event.debtorId, '');

    // Get debtor's relationship to creditor
    let relationship = debtorState.relationships.get(event.creditorId);
    if (!relationship) {
      relationship = this.createInitialRelationship(event.creditorId, Date.now());
      debtorState.relationships.set(event.creditorId, relationship);
    }

    const debt: Debt = {
      type: event.type,
      description: event.description,
      magnitude: event.magnitude,
      timestamp: Date.now(),
      resolved: false,
    };

    relationship.debts.push(debt);

    // Life debt or revenge significantly affects affinity
    if (event.type === 'life' || event.type === 'revenge') {
      relationship.affinity += event.magnitude * 50;
      relationship.trust += event.magnitude * 0.3;
    }
  }

  /**
   * Resolve a debt
   */
  resolveDebt(debtorId: string, creditorId: string, debtIndex: number): void {
    const state = this.getOrCreateState(debtorId, '');
    const relationship = state.relationships.get(creditorId);

    if (!relationship || !relationship.debts[debtIndex]) return;

    const debt = relationship.debts[debtIndex];
    debt.resolved = true;

    // Resolving debts improves relationship
    relationship.affinity += debt.magnitude * 10;
    relationship.trust += debt.magnitude * 0.1;
  }

  /**
   * Record a promise between characters
   */
  recordPromise(event: RelationshipPromiseEvent): void {
    const promisorState = this.getOrCreateState(event.promisorId, '');
    const promiseeState = this.getOrCreateState(event.promiseeId, '');

    const promise: Promise = {
      content: event.content,
      madeAt: Date.now(),
      deadline: event.deadline,
      kept: false,
      broken: false,
      importance: event.importance,
    };

    // Add to promisor's relationships
    let relationship = promisorState.relationships.get(event.promiseeId);
    if (!relationship) {
      relationship = this.createInitialRelationship(event.promiseeId, Date.now());
      promisorState.relationships.set(event.promiseeId, relationship);
    }

    relationship.promises.push(promise);
  }

  /**
   * Mark a promise as kept or broken
   */
  updatePromise(
    promisorId: string,
    promiseeId: string,
    promiseIndex: number,
    status: 'kept' | 'broken'
  ): void {
    const state = this.getOrCreateState(promisorId, '');
    const relationship = state.relationships.get(promiseeId);

    if (!relationship || !relationship.promises[promiseIndex]) return;

    const promise = relationship.promises[promiseIndex];

    if (status === 'kept') {
      promise.kept = true;
      // Keeping promises improves trust
      relationship.trust = Math.min(1, relationship.trust + promise.importance * 0.2);
      relationship.affinity += promise.importance * 5;
    } else {
      promise.broken = true;
      // Breaking promises damages trust significantly
      relationship.trust = Math.max(0, relationship.trust - promise.importance * 0.4);
      relationship.affinity -= promise.importance * 15;
      relationship.tension = Math.min(1, relationship.tension + promise.importance * 0.3);
    }
  }

  // ========================================================================
  // RELATIONSHIP QUERIES
  // ========================================================================

  /**
   * Get relationship between two characters
   */
  getRelationship(sourceId: string, targetId: string): RelationshipState | null {
    try {
      const state = this.getOrCreateState(sourceId, '');
      return state.relationships.get(targetId) || null;
    } catch {
      return null;
    }
  }

  /**
   * Get all relationships for a character
   */
  getAllRelationships(characterId: string): Map<string, RelationshipState> {
    try {
      const state = this.getOrCreateState(characterId, '');
      return state.relationships;
    } catch {
      return new Map();
    }
  }

  /**
   * Get relationships by type
   */
  getRelationshipsByType(
    characterId: string,
    type: RelationshipType
  ): RelationshipState[] {
    const relationships = this.getAllRelationships(characterId);
    return Array.from(relationships.values()).filter(r => r.relationshipType === type);
  }

  /**
   * Get strongest relationships (by affinity)
   */
  getStrongestRelationships(characterId: string, limit: number = 5): Array<{
    targetId: string;
    relationship: RelationshipState;
  }> {
    const relationships = this.getAllRelationships(characterId);

    return Array.from(relationships.entries())
      .map(([targetId, rel]) => ({ targetId, relationship: rel }))
      .sort((a, b) => b.relationship.affinity - a.relationship.affinity)
      .slice(0, limit);
  }

  /**
   * Get most strained relationships
   */
  getStrainedRelationships(characterId: string, limit: number = 5): Array<{
    targetId: string;
    relationship: RelationshipState;
    strain: number;
  }> {
    const relationships = this.getAllRelationships(characterId);

    return Array.from(relationships.entries())
      .map(([targetId, rel]) => ({
        targetId,
        relationship: rel,
        strain: rel.tension || 0 + (100 - rel.affinity) / 100,
      }))
      .sort((a, b) => b.strain - a.strain)
      .slice(0, limit);
  }

  /**
   * Check for outstanding debts
   */
  getOutstandingDebts(characterId: string): Array<{
    creditor: string;
    debt: Debt;
  }> {
    const state = this.getOrCreateState(characterId, '');
    const debts: Array<{ creditor: string; debt: Debt }> = [];

    for (const [creditorId, relationship] of state.relationships) {
      for (const debt of relationship.debts) {
        if (!debt.resolved) {
          debts.push({ creditor: creditorId, debt });
        }
      }
    }

    return debts.sort((a, b) => b.debt.magnitude - a.debt.magnitude);
  }

  /**
   * Check for unfulfilled promises
   */
  getUnfulfilledPromises(characterId: string): Array<{
    promisee: string;
    promise: Promise;
    overdue: boolean;
  }> {
    const state = this.getOrCreateState(characterId, '');
    const promises: Array<{ promisee: string; promise: Promise; overdue: boolean }> = [];
    const now = Date.now();

    for (const [promiseeId, relationship] of state.relationships) {
      for (const promise of relationship.promises) {
        if (!promise.kept && !promise.broken) {
          promises.push({
            promisee: promiseeId,
            promise,
            overdue: promise.deadline ? now > promise.deadline : false,
          });
        }
      }
    }

    return promises.sort((a, b) => b.promise.importance - a.promise.importance);
  }

  // ========================================================================
  // RELATIONSHIP DECAY & EVOLUTION
  // ========================================================================

  /**
   * Apply time-based decay to relationships
   */
  applyDecay(characterId: string, daysPassed: number): void {
    const state = this.getOrCreateState(characterId, '');
    const now = Date.now();
    const dayMs = 86400000;

    for (const [targetId, relationship] of state.relationships) {
      const daysSinceContact = (now - relationship.lastInteraction) / dayMs;

      // Trust decays without contact
      if (daysSinceContact > 30) {
        relationship.trust = Math.max(0, relationship.trust - 0.01 * daysPassed);
      }

      // Familiarity decays slowly
      if (daysSinceContact > 90) {
        relationship.familiarity = Math.max(0, relationship.familiarity - 0.005 * daysPassed);
      }

      // Tension fades over time
      if (relationship.tension && daysSinceContact > 14) {
        relationship.tension = Math.max(0, relationship.tension - 0.02 * daysPassed);
      }

      // Check for broken promises (overdue)
      for (const promise of relationship.promises) {
        if (!promise.kept && !promise.broken && promise.deadline && now > promise.deadline) {
          const daysOverdue = (now - promise.deadline) / dayMs;
          if (daysOverdue > 7) {
            // Promise significantly broken
            relationship.trust = Math.max(0, relationship.trust - 0.05 * daysPassed);
            relationship.affinity -= promise.importance * 2;
          }
        }
      }

      // Recalculate relationship type
      relationship.relationshipType = this.determineRelationshipType(relationship);
    }
  }

  /**
   * Get relationship evolution history
   */
  getRelationshipHistory(
    sourceId: string,
    targetId: string
  ): {
    current: RelationshipState | null;
    trajectory: 'improving' | 'declining' | 'stable' | 'volatile';
    keyMoments: string[];
  } {
    const relationship = this.getRelationship(sourceId, targetId);
    const sourceState = this.getOrCreateState(sourceId, '');

    const keyMoments: string[] = [];

    // Check shared memories for relationship moments
    for (const memoryId of relationship?.sharedMemories || []) {
      // This would expand to full memory lookup
      keyMoments.push(memoryId);
    }

    // Determine trajectory from debts and promises
    let trajectory: 'improving' | 'declining' | 'stable' | 'volatile' = 'stable';

    if (relationship) {
      const recentPositive = (relationship.promises.filter(p => p.kept).length);
      const recentNegative = (relationship.promises.filter(p => p.broken).length);
      const outstandingDebts = relationship.debts.filter(d => !d.resolved).length;

      if (recentPositive > recentNegative + 2) {
        trajectory = 'improving';
      } else if (recentNegative > recentPositive + 1 || outstandingDebts > 2) {
        trajectory = 'declining';
      } else if (relationship.tension && relationship.tension > 0.5 && relationship.affinity > 20) {
        trajectory = 'volatile';
      }
    }

    return {
      current: relationship,
      trajectory,
      keyMoments,
    };
  }

  // ========================================================================
  // RELATIONSHIP-FOCUSED MEMORY RETRIEVAL
  // ========================================================================

  /**
   * Get memories about a specific character
   */
  getMemoriesAbout(characterId: string, aboutId: string): EpisodicMemory[] {
    const query = {
      participants: [aboutId],
      includeWorking: false,
    };

    const result = characterMemoryStore.queryMemories(characterId, query);
    return result.memories.filter((m): m is EpisodicMemory => m.tier === MemoryTier.EPISODIC);
  }

  /**
   * Generate relationship reflection for AI prompt
   */
  generateRelationshipPrompt(
    characterId: string,
    targetId: string
  ): string {
    const relationship = this.getRelationship(characterId, targetId);
    const memories = this.getMemoriesAbout(characterId, targetId);

    if (!relationship) {
      return `I don't believe I've met ${targetId} before.`;
    }

    let prompt = `Relationship with ${targetId}: `;

    // Describe relationship type
    switch (relationship.relationshipType) {
      case RelationshipType.STRANGER:
        prompt += 'A stranger.';
        break;
      case RelationshipType.ACQUAINTANCE:
        prompt += 'Someone I know slightly.';
        break;
      case RelationshipType.FRIEND:
        prompt += 'A friend.';
        break;
      case RelationshipType.CLOSE_FRIEND:
        prompt += 'A close friend.';
        break;
      case RelationshipType.RIVAL:
        prompt += 'A rival.';
        break;
      case RelationshipType.ENEMY:
        prompt += 'An enemy.';
        break;
      case RelationshipType.ALLY:
        prompt += 'An ally in our endeavors.';
        break;
      case RelationshipType.FAMILY:
        prompt += 'Family.';
        break;
      case RelationshipType.ROMANTIC:
        prompt += 'My beloved.';
        break;
      case RelationshipType.MENTOR:
        prompt += 'My mentor.';
        break;
      case RelationshipType.STUDENT:
        prompt += 'My student.';
        break;
      default:
        prompt += 'Someone I know.';
    }

    // Describe feelings
    if (relationship.affinity > 70) {
      prompt += ' I feel warmly toward them.';
    } else if (relationship.affinity > 30) {
      prompt += ' I have positive feelings.';
    } else if (relationship.affinity < -30) {
      prompt += ' I dislike them.';
    } else if (relationship.affinity < -70) {
      prompt += ' I harbor ill will.';
    }

    // Describe trust
    if (relationship.trust > 0.7) {
      prompt += ' I trust them deeply.';
    } else if (relationship.trust < 0.3) {
      prompt += ' I am wary of them.';
    }

    // Mention debts
    const outstandingDebts = relationship.debts.filter(d => !d.resolved);
    if (outstandingDebts.length > 0) {
      prompt += ` I owe them ${outstandingDebts.length} debt(s).`;
    }

    // Mention tension
    if (relationship.tension && relationship.tension > 0.3) {
      prompt += ' There is tension between us.';
    }

    // Add shared history
    if (memories.length > 0) {
      prompt += '\n\nShared history:\n';
      const recentMemories = memories
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);

      for (const memory of recentMemories) {
        const emotion = this.getEmotionAdjective(memory.emotionalValence);
        prompt += `- ${emotion}: ${memory.description}\n`;
      }
    }

    return prompt;
  }

  // ========================================================================
  // PRIVATE HELPERS
  // ========================================================================

  private getOrCreateState(characterId: string, campaignId: string): CharacterMemoryState {
    try {
      return characterMemoryStore.getCharacterState(characterId);
    } catch {
      // Character doesn't exist yet, initialize
      return characterMemoryStore.initializeCharacter(characterId, campaignId || '');
    }
  }

  private createInitialRelationship(targetId: string, timestamp: number): RelationshipState {
    return {
      targetId,
      affinity: 0,
      trust: 0.5,
      familiarity: 0,
      debts: [],
      promises: [],
      sharedMemories: [],
      relationshipType: RelationshipType.STRANGER,
      lastInteraction: timestamp,
      interactionCount: 0,
    };
  }

  private updateRelationshipFromEvent(
    relationship: RelationshipState,
    event: RelationshipEvent,
    state: CharacterMemoryState
  ): void {
    // Update affinity based on event magnitude
    relationship.affinity += event.magnitude * 20;

    // Clamp affinity
    relationship.affinity = Math.max(-100, Math.min(100, relationship.affinity));

    // Update trust based on event type
    switch (event.type) {
      case 'betrayal':
        relationship.trust -= 0.4;
        relationship.tension = Math.min(1, (relationship.tension || 0) + 0.5);
        break;
      case 'help':
      case 'alliance':
        relationship.trust += 0.1;
        relationship.tension = Math.max(0, (relationship.tension || 0) - 0.1);
        break;
      case 'gift':
        relationship.trust += 0.05;
        break;
      case 'conflict':
        relationship.tension = Math.min(1, (relationship.tension || 0) + 0.2);
        break;
      case 'dialogue':
        relationship.familiarity += 0.05;
        break;
      case 'combat_together':
        relationship.trust += 0.15;
        relationship.familiarity += 0.1;
        break;
    }

    // Clamp trust
    relationship.trust = Math.max(0, Math.min(1, relationship.trust));
    relationship.familiarity = Math.max(0, Math.min(1, relationship.familiarity));
  }

  private updateReciprocalRelationship(
    relationship: RelationshipState,
    event: RelationshipEvent
  ): void {
    // Reciprocal relationships may have different impacts
    // For example, someone might help without feeling the same warmth

    const magnitudeAdjustment = event.magnitude * 0.5; // Smaller impact on recipient
    relationship.affinity += magnitudeAdjustment * 10;
    relationship.affinity = Math.max(-100, Math.min(100, relationship.affinity));
  }

  private determineRelationshipType(relationship: RelationshipState): RelationshipType {
    const { affinity, trust, familiarity } = relationship;

    // High negative affinity = enemy
    if (affinity < -50) return RelationshipType.ENEMY;
    if (affinity < -20) return RelationshipType.RIVAL;

    // High positive affinity + trust = close
    if (affinity > 80 && trust > 0.8) return RelationshipType.CLOSE_FRIEND;
    if (affinity > 80 && trust > 0.7) return RelationshipType.ROMANTIC;
    if (affinity > 60) return RelationshipType.FRIEND;

    // Moderate affinity
    if (affinity > 20) return RelationshipType.ACQUAINTANCE;
    if (affinity > 0 && trust > 0.6) return RelationshipType.ALLY;

    // Based on tags or other factors would go here
    if (familiarity < 0.2) return RelationshipType.STRANGER;

    return RelationshipType.ACQUAINTANCE;
  }

  private getEmotionAdjective(valence: EmotionalValence): string {
    switch (valence) {
      case EmotionalValence.VERY_NEGATIVE:
        return 'Terribly';
      case EmotionalValence.NEGATIVE:
        return 'Unpleasantly';
      case EmotionalValence.NEUTRAL:
        return 'Matter-of-factly';
      case EmotionalValence.POSITIVE:
        return 'Happily';
      case EmotionalValence.VERY_POSITIVE:
        return 'Wonderfully';
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const relationshipTracker = new RelationshipTracker();
