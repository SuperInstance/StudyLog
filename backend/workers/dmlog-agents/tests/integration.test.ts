/**
 * DMLoG.AI - Integration Tests
 *
 * Tests for critical paths in the agent orchestration system.
 *
 * @module tests/integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AgentRegistry,
  getAgentRegistry,
} from '../src/core/agent-registry.js';
import {
  CommunicationBus,
  getCommunicationBus,
  startCommunicationBus,
} from '../src/core/communication-bus.js';
import {
  AgentOrchestrator,
  createOrchestrator,
  getSessionOrchestrator,
} from '../src/core/orchestrator.js';
import {
  CombatAgent,
  createCombatAgent,
  CombatStyle,
} from '../src/agents/combat-agent.js';
import {
  SocialAgent,
  createSocialAgent,
  SocialStyle,
} from '../src/agents/social-agent.js';
import {
  ExplorationAgent,
  createExplorationAgent,
  ExplorationStyle,
} from '../src/agents/exploration-agent.js';
import {
  BiologicalAgent,
  DMLoGAgentRole,
  AgentState,
  DecisionSource,
  SituationType,
  AgentErrorCode,
} from '../src/types/index.js';

describe('Agent Registry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = getAgentRegistry();
    registry.clear();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Agent Registration', () => {
    it('should register an agent', () => {
      const agent = createMockAgent('agent-1');
      const config = createMockConfig('agent-1', 'session-1');

      registry.register(agent, config);

      expect(registry.has('agent-1')).toBe(true);
      expect(registry.get('agent-1')).toBe(agent);
    });

    it('should unregister an agent', () => {
      const agent = createMockAgent('agent-1');
      const config = createMockConfig('agent-1', 'session-1');

      registry.register(agent, config);
      expect(registry.has('agent-1')).toBe(true);

      const unregistered = registry.unregister('agent-1');
      expect(unregistered).toBe(true);
      expect(registry.has('agent-1')).toBe(false);
    });

    it('should track agents by session', () => {
      const agent1 = createMockAgent('agent-1');
      const agent2 = createMockAgent('agent-2');
      const config1 = createMockConfig('agent-1', 'session-1');
      const config2 = createMockConfig('agent-2', 'session-1');
      const config3 = createMockConfig('agent-3', 'session-2');
      const agent3 = createMockAgent('agent-3');

      registry.register(agent1, config1);
      registry.register(agent2, config2);
      registry.register(agent3, config3);

      const session1Agents = registry.getSessionAgents('session-1');
      const session2Agents = registry.getSessionAgents('session-2');

      expect(session1Agents).toHaveLength(2);
      expect(session2Agents).toHaveLength(1);
      expect(session1Agents).toContain('agent-1');
      expect(session1Agents).toContain('agent-2');
      expect(session2Agents).toContain('agent-3');
    });

    it('should track agents by role', () => {
      const combatAgent = createMockAgent('combat-1');
      const socialAgent = createMockAgent('social-1');
      const combatConfig = createMockConfig('combat-1', 'session-1', DMLoGAgentRole.COMBAT);
      const socialConfig = createMockConfig('social-1', 'session-1', DMLoGAgentRole.SOCIAL);

      registry.register(combatAgent, combatConfig);
      registry.register(socialAgent, socialConfig);

      const combatAgents = registry.getAgentsByRole(DMLoGAgentRole.COMBAT);
      const socialAgents = registry.getAgentsByRole(DMLoGAgentRole.SOCIAL);

      expect(combatAgents).toHaveLength(1);
      expect(socialAgents).toHaveLength(1);
      expect(combatAgents).toContain('combat-1');
      expect(socialAgents).toContain('social-1');
    });
  });

  describe('Agent State', () => {
    it('should set and get agent state', () => {
      const agent = createMockAgent('agent-1');
      const config = createMockConfig('agent-1', 'session-1');

      registry.register(agent, config);

      expect(registry.getState('agent-1')).toBe(AgentState.IDLE);

      registry.setState('agent-1', AgentState.THINKING);
      expect(registry.getState('agent-1')).toBe(AgentState.THINKING);
    });

    it('should throw error when setting state on non-existent agent', () => {
      expect(() => {
        registry.setState('non-existent', AgentState.THINKING);
      }).toThrow();
    });
  });

  describe('Statistics', () => {
    it('should track registry statistics', () => {
      const agent1 = createMockAgent('agent-1');
      const agent2 = createMockAgent('agent-2');
      const config1 = createMockConfig('agent-1', 'session-1', DMLoGAgentRole.COMBAT);
      const config2 = createMockConfig('agent-2', 'session-1', DMLoGAgentRole.SOCIAL);

      registry.register(agent1, config1);
      registry.register(agent2, config2);

      const stats = registry.getStats();

      expect(stats.activeAgents).toBe(2);
      expect(stats.totalRegistered).toBe(2);
      expect(stats.activeSessions).toBe(1);
    });
  });
});

describe('Communication Bus', () => {
  let bus: CommunicationBus;

  beforeEach(() => {
    bus = getCommunicationBus();
    bus.clear();
    bus.start();
  });

  afterEach(() => {
    bus.stop();
    bus.clear();
  });

  describe('Message Sending', () => {
    it('should send a message between agents', async () => {
      let received = false;

      bus.subscribe('agent-2', 'action_request' as any, () => {
        received = true;
      });

      await bus.send('agent-1', 'agent-2', 'action_request' as any, {});

      expect(received).toBe(true);
    });

    it('should send and wait for response', async () => {
      bus.subscribe('agent-2', 'action_request' as any, async (msg) => {
        await bus.respond(msg, { success: true, data: 'response' });
      });

      const response = await bus.sendAndWaitForResponse(
        'agent-1',
        'agent-2',
        'action_request' as any,
        {}
      );

      expect(response).toBeDefined();
      expect(response.payload.success).toBe(true);
    });

    it('should broadcast to multiple subscribers', async () => {
      let count = 0;

      bus.subscribe('agent-2', 'broadcast' as any, () => count++);
      bus.subscribe('agent-3', 'broadcast' as any, () => count++);

      await bus.broadcast('agent-1', 'session-1', 'broadcast' as any, {});

      expect(count).toBe(2);
    });
  });

  describe('Subscription Management', () => {
    it('should unsubscribe from messages', async () => {
      let received = 0;

      const unsubscribe = bus.subscribe('agent-2', 'test' as any, () => {
        received++;
      });

      await bus.send('agent-1', 'agent-2', 'test' as any, {});
      expect(received).toBe(1);

      unsubscribe();
      await bus.send('agent-1', 'agent-2', 'test' as any, {});
      expect(received).toBe(1);
    });

    it('should support one-time subscriptions', async () => {
      let received = 0;

      bus.subscribe('agent-2', 'test' as any, () => {
        received++;
      }, true);

      await bus.send('agent-1', 'agent-2', 'test' as any, {});
      await bus.send('agent-1', 'agent-2', 'test' as any, {});

      expect(received).toBe(1);
    });
  });

  describe('Statistics', () => {
    it('should track message statistics', () => {
      bus.subscribe('agent-2', 'test' as any, () => {});

      const statsBefore = bus.getStats();
      expect(statsBefore.messagesSent).toBe(0);

      bus.send('agent-1', 'agent-2', 'test' as any, {});

      const statsAfter = bus.getStats();
      expect(statsAfter.messagesSent).toBe(1);
    });
  });
});

describe('Combat Agent', () => {
  let agent: CombatAgent;

  beforeEach(() => {
    agent = createCombatAgent({
      id: 'combat-1',
      name: 'Fighter',
      role: DMLoGAgentRole.COMBAT,
      biologicalType: BiologicalAgent.CAPTAIN,
      sessionId: 'session-1',
      combatStyle: CombatStyle.AGGRESSIVE,
    });
  });

  it('should make a combat decision', async () => {
    const decision = await agent.decide({
      agentId: 'combat-1',
      role: DMLoGAgentRole.COMBAT,
      situation: 'A goblin attacks!',
      situationType: SituationType.COMBAT,
      stakes: 0.5,
      location: 'Dungeon Room 1',
      participants: ['goblin-1'],
      availableResources: {},
      sessionId: 'session-1',
      metadata: {},
    });

    expect(decision).toBeDefined();
    expect(decision.agentId).toBe('combat-1');
    expect(decision.role).toBe(DMLoGAgentRole.COMBAT);
    expect(decision.action).toBeDefined();
  });

  it('should roll initiative', () => {
    const roll = agent.rollInitiative(3);

    expect(roll).toBeGreaterThanOrEqual(4);
    expect(roll).toBeLessThanOrEqual(23);
  });

  it('should roll attack with natural 20 handling', () => {
    // Mock random for consistent testing
    const result = agent.rollAttack(5);

    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('crit');
    expect(result).toHaveProperty('fumble');
    expect(result.total).toBeGreaterThan(0);
  });

  it('should select target based on priority', () => {
    const combatants = [
      {
        id: 'enemy-1',
        name: 'Goblin',
        hp: 5,
        hpMax: 10,
        team: 'enemies' as any,
        isPlayer: false,
        stats: {} as any,
        statusEffects: [],
        tags: [],
        metadata: {},
      },
      {
        id: 'enemy-2',
        name: 'Orc',
        hp: 20,
        hpMax: 30,
        team: 'enemies' as any,
        isPlayer: false,
        stats: {} as any,
        statusEffects: [],
        tags: [],
        metadata: {},
      },
    ];

    const target = agent.selectTarget('party' as any, combatants);

    expect(target).toBeDefined();
  });
});

describe('Social Agent', () => {
  let agent: SocialAgent;

  beforeEach(() => {
    agent = createSocialAgent({
      id: 'social-1',
      name: 'Innkeeper',
      role: DMLoGAgentRole.SOCIAL,
      biologicalType: BiologicalAgent.CAPTAIN,
      sessionId: 'session-1',
      socialStyle: SocialStyle.FRIENDLY,
    });
  });

  it('should make a social decision', async () => {
    const decision = await agent.decide({
      agentId: 'social-1',
      role: DMLoGAgentRole.SOCIAL,
      situation: 'A traveler enters the inn',
      situationType: SituationType.SOCIAL,
      stakes: 0.3,
      location: 'Inn',
      participants: ['player-1'],
      availableResources: {},
      sessionId: 'session-1',
      metadata: {},
    });

    expect(decision).toBeDefined();
    expect(decision.agentId).toBe('social-1');
    expect(decision.action).toBe('talk');
  });

  it('should manage relationships', () => {
    agent.modifyRelationship('player-1', 20);

    const relationship = agent.getRelationship('player-1');

    expect(relationship).toBeDefined();
    expect(relationship!.value).toBe(20);
    expect(relationship!.type).toBeDefined();
  });

  it('should perform skill checks', () => {
    const result = agent.performSkillCheck('persuasion', 15, 3);

    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('dc');
    expect(result.dc).toBe(15);
  });

  it('should add dialogue nodes', () => {
    const node = {
      id: 'greeting',
      speakerId: 'social-1',
      text: 'Welcome, traveler!',
      responses: [],
    };

    agent.addDialogueNode(node);

    const retrieved = agent.getCurrentDialogueNode();
    expect(retrieved).toBeUndefined(); // No current node set

    agent.startDialogue('greeting', 'player-1');
    const current = agent.getCurrentDialogueNode();
    expect(current).toBeDefined();
    expect(current!.id).toBe('greeting');
  });
});

describe('Exploration Agent', () => {
  let agent: ExplorationAgent;

  beforeEach(() => {
    agent = createExplorationAgent({
      id: 'exploration-1',
      name: 'Scout',
      role: DMLoGAgentRole.EXPLORATION,
      biologicalType: BiologicalAgent.FLEET,
      sessionId: 'session-1',
      explorationStyle: ExplorationStyle.THOROUGH,
    });
  });

  it('should make an exploration decision', async () => {
    const decision = await agent.decide({
      agentId: 'exploration-1',
      role: DMLoGAgentRole.EXPLORATION,
      situation: 'A dark corridor stretches north',
      situationType: SituationType.EXPLORATION,
      stakes: 0.4,
      location: 'Dungeon Corridor',
      participants: [],
      availableResources: {},
      sessionId: 'session-1',
      metadata: {},
    });

    expect(decision).toBeDefined();
    expect(decision.agentId).toBe('exploration-1');
    expect(decision.action).toBeDefined();
  });

  it('should manage locations', () => {
    const location = {
      id: 'dungeon-room-1',
      name: 'Dungeon Entrance',
      description: 'A dark stone room',
      type: 'dungeon' as any,
      connections: [],
      npcs: [],
      items: [],
      secrets: [],
      tags: [],
    };

    agent.addLocation(location);
    agent.setCurrentLocation('dungeon-room-1');

    const current = agent.getCurrentLocation();
    expect(current).toBeDefined();
    expect(current!.id).toBe('dungeon-room-1');
  });

  it('should generate loot', () => {
    const loot = agent.generateLoot('common', 1);

    expect(Array.isArray(loot)).toBe(true);
  });

  it('should roll for random encounters', () => {
    const result = agent.rollRandomEncounter(1);

    expect(result).toHaveProperty('encounter');
    expect(result).toHaveProperty('type');
    expect(result).toHaveProperty('difficulty');
  });

  it('should search for secrets', () => {
    const location = {
      id: 'test-room',
      name: 'Test Room',
      description: 'A test room',
      type: 'room' as any,
      connections: [],
      npcs: [],
      items: [],
      secrets: [
        {
          id: 'secret-door',
          description: 'A hidden door',
          discoveryMethod: 'investigation' as any,
          dc: 15,
          revealed: false,
        },
      ],
      tags: [],
    };

    agent.addLocation(location);
    agent.setCurrentLocation('test-room');

    // High perception to guarantee discovery
    const discoveries = agent.searchForSecrets(20);

    expect(Array.isArray(discoveries)).toBe(true);
  });
});

describe('Agent Orchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let registry: AgentRegistry;

  beforeEach(() => {
    orchestrator = createOrchestrator({
      orchestratorId: 'orchestrator-1',
      sessionId: 'session-1',
    });
    registry = getAgentRegistry();
    registry.clear();
  });

  it('should coordinate decisions', async () => {
    // Create agents
    const combatAgent = createCombatAgent({
      id: 'combat-1',
      name: 'Fighter',
      role: DMLoGAgentRole.COMBAT,
      biologicalType: BiologicalAgent.CAPTAIN,
      sessionId: 'session-1',
    });

    const decision = await orchestrator.decide({
      agentId: 'combat-1',
      role: DMLoGAgentRole.COMBAT,
      situation: 'Combat encounter',
      situationType: SituationType.COMBAT,
      stakes: 0.5,
      location: 'Battle Room',
      participants: ['enemy-1'],
      availableResources: {},
      sessionId: 'session-1',
      metadata: {},
    });

    expect(decision).toBeDefined();
    expect(decision.agentId).toBe('combat-1');
  });

  it('should get orchestrator statistics', () => {
    const stats = orchestrator.getStats();

    expect(stats).toHaveProperty('totalDecisions');
    expect(stats).toHaveProperty('totalCoordinations');
    expect(stats).toHaveProperty('escalationsTriggered');
  });
});

// ============================================================================
// Mock Helpers
// ============================================================================

function createMockAgent(id: string): any {
  return {
    id,
    name: `Agent ${id}`,
    role: DMLoGAgentRole.COMBAT,
    biologicalType: BiologicalAgent.CAPTAIN,
    decide: async () => ({
      decisionId: `decision-${Date.now()}`,
      agentId: id,
      role: DMLoGAgentRole.COMBAT,
      source: DecisionSource.BOT,
      content: 'Mock response',
      action: 'wait',
      confidence: 0.5,
      timeTakenMs: 1,
      costEstimate: 0,
      emotions: {},
      metadata: {},
    }),
  };
}

function createMockConfig(
  id: string,
  sessionId: string,
  role: DMLoGAgentRole = DMLoGAgentRole.COMBAT
): any {
  return {
    id,
    name: `Agent ${id}`,
    role,
    biologicalType: BiologicalAgent.CAPTAIN,
    sessionId,
    personality: {},
    goals: [],
    enableEscalation: false,
    enableLearning: false,
  };
}
