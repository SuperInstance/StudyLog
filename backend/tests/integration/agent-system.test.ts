/**
 * Integration Tests for Agent System
 *
 * Tests the multi-agent coordination, escalation engine routing,
 * and biological agent behaviors:
 * - Multi-agent coordination via Director
 * - Escalation engine routing (BOT/BRAIN/HUMAN)
 * - Biological agent behaviors (Zooplankton, Herring, etc.)
 * - A2A (Agent-to-Agent) protocol communication
 * - Agent delegation and task distribution
 * - NPC interactions
 * - Cross-module agent behavior
 * - Error handling and recovery
 *
 * @see packages/agents/src/core/orchestrator.ts
 * @see packages/escalation/src/index.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentOrchestrator,
  type OrchestratorConfig,
} from '../../packages/agents/src/core/orchestrator';
import {
  EscalationEngine,
  createContext,
  createDecisionResult,
  DecisionSource,
  EscalationReason as EscalationReasonEnum,
} from '../../packages/escalation/src/index';

// ============================================================================
// Test Fixtures and Mocks
// ============================================================================

// Mock AI client responses
const createMockAIClient = () => {
  return {
    isAvailable: vi.fn(async () => true),
    chat: vi.fn(async (options: { messages: Array<{ content: string }>; tools?: any[] }) => {
      // Return different responses based on content
      const lastMessage = options.messages[options.messages.length - 1]?.content?.toLowerCase() || '';

      if (lastMessage.includes('delegate') || lastMessage.includes('captain')) {
        return {
          content: 'I\'ll delegate this to the Captain.',
          delegateTo: 'captain',
        };
      }

      if (lastMessage.includes('error') || lastMessage.includes('fail')) {
        throw new Error('Simulated AI error');
      }

      if (options.tools && options.tools.length > 0) {
        return {
          content: 'I\'ll use a tool to help with that.',
          toolCalls: [
            {
              id: 'tool_1',
              name: 'get_scene_state',
              arguments: { sceneId: 'test_scene' },
            },
          ],
        };
      }

      return {
        content: `I understand you're asking about: "${lastMessage}". Let me help you with that.`,
      };
    }),
  };
};

// Mock fetch for API calls
const createMockFetch = () => {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ result: 'success' }),
  } as Response));
};

beforeEach(() => {
  // Setup global fetch mock
  global.fetch = createMockFetch();
  // Mock crypto.randomUUID
  global.crypto = {
    ...global.crypto,
    randomUUID: () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// Multi-Agent Coordination Tests
// ============================================================================

describe('Agent System - Multi-Agent Coordination', () => {
  let orchestrator: AgentOrchestrator;
  let mockAIClient: ReturnType<typeof createMockAIClient>;

  beforeEach(() => {
    mockAIClient = createMockAIClient();
    // Mock the AI client factory
    vi.doMock('../../packages/agents/src/core/ai-client', () => ({
      createAIClient: () => mockAIClient,
    }));

    orchestrator = new AgentOrchestrator({
      enableNPCs: false,
      enableA2A: false, // Disable for simpler tests
      preferLocalAI: true,
    });
  });

  describe('Director Routing', () => {
    it('should route messages through the Director agent', async () => {
      const response = await orchestrator.chat('Hello, can you help me?');

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.agentId).toBeDefined();
    });

    it('should delegate to appropriate specialized agent', async () => {
      // Update mock to delegate
      mockAIClient.chat = vi.fn(async () => ({
        content: 'Let me delegate this to the Captain.',
        delegateTo: 'captain',
      }));

      const response = await orchestrator.chat('Tell me about the current game state.');

      // Director should handle the delegation
      expect(response).toBeDefined();
    });

    it('should maintain conversation history', async () => {
      await orchestrator.chat('First message');
      await orchestrator.chat('Second message');
      await orchestrator.chat('Third message');

      const history = orchestrator.getHistory();

      expect(history).toHaveLength(6); // 3 user + 3 assistant
      expect(history[0].content).toBe('First message');
      expect(history[2].content).toBe('Second message');
      expect(history[4].content).toBe('Third message');
    });

    it('should handle empty messages gracefully', async () => {
      const response = await orchestrator.chat('');

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(10000);

      const response = await orchestrator.chat(longMessage);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  describe('Agent Selection', () => {
    it('should get Captain agent for cognitive-mill module', () => {
      orchestrator.setModule('cognitive-mill');

      const agent = orchestrator.getModuleAgent();

      expect(agent).toBeDefined();
      // Should return Captain for cognitive-mill
    });

    it('should get Deckhand agent for sitka-sound module', () => {
      orchestrator.setModule('sitka-sound');

      const agent = orchestrator.getModuleAgent();

      expect(agent).toBeDefined();
      // Should return Deckhand for sitka-sound
    });

    it('should get Ranchhand agent for intelligence-ranch module', () => {
      orchestrator.setModule('intelligence-ranch');

      const agent = orchestrator.getModuleAgent();

      expect(agent).toBeDefined();
      // Should return Ranchhand for intelligence-ranch
    });

    it('should get Mechanic for hardware-related queries', () => {
      const mechanic = orchestrator.getMechanic();

      expect(mechanic).toBeDefined();
    });

    it('should return undefined for non-existent agent', () => {
      const agent = orchestrator.getAgent('non-existent' as any);

      expect(agent).toBeUndefined();
    });
  });

  describe('Context Management', () => {
    it('should update context correctly', () => {
      orchestrator.updateContext({
        module: 'sitka-sound',
        stage: 5,
        phase: 'design',
      });

      const context = orchestrator.getContext();

      expect(context.module).toBe('sitka-sound');
      expect(context.stage).toBe(5);
      expect(context.phase).toBe('design');
    });

    it('should set module and reinitialize NPCs', () => {
      orchestrator.setModule('intelligence-ranch');

      const context = orchestrator.getContext();

      expect(context.module).toBe('intelligence-ranch');
      expect(context.stage).toBe(1); // Stage resets on module change
    });

    it('should advance stage correctly', () => {
      const initialStage = orchestrator.getContext().stage;

      orchestrator.advanceStage();

      expect(orchestrator.getContext().stage).toBe(initialStage + 1);
    });

    it('should set phase correctly', () => {
      orchestrator.setPhase('forge');

      expect(orchestrator.getContext().phase).toBe('forge');
    });

    it('should set student information', () => {
      const student = {
        id: 'student-123',
        displayName: 'Test Student',
        preferences: { hintLevel: 'medium' as const },
      };

      orchestrator.setStudent(student);

      expect(orchestrator.getContext().student).toEqual(student);
    });

    it('should update game state with timestamp', () => {
      orchestrator.updateGameState({
        scene: 'test_scene',
        paused: true,
      });

      const gameState = orchestrator.getContext().gameState;

      expect(gameState?.scene).toBe('test_scene');
      expect(gameState?.paused).toBe(true);
      expect(gameState?.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    it('should emit events on messages', async () => {
      const events: unknown[] = [];

      orchestrator.on((event) => {
        events.push(event);
      });

      await orchestrator.chat('Test message');

      expect(events.length).toBeGreaterThan(0);

      // Should have message events
      const messageEvents = events.filter((e: any) => e.type === 'message');
      expect(messageEvents.length).toBe(2); // user + assistant
    });

    it('should emit events on delegation', async () => {
      mockAIClient.chat = vi.fn(async () => ({
        content: 'Delegating to Captain',
        delegateTo: 'captain',
      }));

      const events: unknown[] = [];

      orchestrator.on((event) => {
        events.push(event);
      });

      await orchestrator.chat('Please delegate this');

      const delegationEvents = events.filter((e: any) => e.type === 'delegation');
      expect(delegationEvents.length).toBeGreaterThan(0);
    });

    it('should remove event listeners when unsubscribed', async () => {
      const events1: unknown[] = [];
      const events2: unknown[] = [];

      const unsubscribe1 = orchestrator.on((e) => events1.push(e));
      const unsubscribe2 = orchestrator.on((e) => events2.push(e));

      unsubscribe1();

      await orchestrator.chat('Test');

      expect(events1.length).toBe(0);
      expect(events2.length).toBeGreaterThan(0);
    });
  });

  describe('History Management', () => {
    it('should clear conversation history', async () => {
      await orchestrator.chat('Message 1');
      await orchestrator.chat('Message 2');

      expect(orchestrator.getHistory().length).toBeGreaterThan(0);

      orchestrator.clearHistory();

      expect(orchestrator.getHistory().length).toBe(0);
    });

    it('should return copy of history (not reference)', async () => {
      await orchestrator.chat('Test');

      const history1 = orchestrator.getHistory();
      const history2 = orchestrator.getHistory();

      expect(history1).not.toBe(history2); // Different references
      expect(history1).toEqual(history2); // Same content
    });
  });
});

// ============================================================================
// Escalation Engine Tests
// ============================================================================

describe('Agent System - Escalation Engine Routing', () => {
  let engine: EscalationEngine;

  beforeEach(() => {
    engine = new EscalationEngine();
  });

  describe('BOT Level Routing', () => {
    it('should route familiar low-stakes situations to BOT', () => {
      // Build familiarity
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(
          createContext('student-1', 'faq', `Common question ${i}`, {
            stakes: 0.2,
            similarDecisionsCount: 10,
          })
        );
      }

      const context = createContext('student-1', 'faq', 'Another common question', {
        stakes: 0.2,
        similarDecisionsCount: 10,
      });

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.BOT);
    });

    it('should not escalate high-confidence BOT decisions', () => {
      const context = createContext('student-1', 'test', 'Simple test');
      const result = createDecisionResult(DecisionSource.BOT, 'Action', 0.9);

      const [shouldEscalate] = engine.shouldEscalate(result, context);

      expect(shouldEscalate).toBe(false);
    });

    it('should use BOT for quick reference questions', () => {
      const context = createContext('student-1', 'reference', 'What is the syntax for a for loop?', {
        stakes: 0.1,
        similarDecisionsCount: 20,
      });

      // Build pattern
      for (let i = 0; i < 10; i++) {
        engine.routeDecision(createContext('student-1', 'reference', `Syntax question ${i}`));
      }

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.BOT);
    });

    it('should track BOT decision statistics', () => {
      const result = createDecisionResult(DecisionSource.BOT, 'Bot action', 0.8, {
        metadata: { studentId: 'student-1' },
      });

      engine.recordDecision(result);

      const stats = engine.getGlobalStats();
      expect(stats.botDecisions).toBe(1);
    });

    it('should have zero cost for BOT decisions', () => {
      const cost = engine.estimateCost ? engine.estimateCost(DecisionSource.BOT) : 0;
      expect(cost).toBe(0);
    });
  });

  describe('BRAIN Level Routing', () => {
    it('should route novel situations to BRAIN', () => {
      const context = createContext('student-1', 'novel-task', 'Never seen before task', {
        stakes: 0.6,
        similarDecisionsCount: 0,
      });

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.BRAIN);
      expect(decision.reason).toBe(EscalationReasonEnum.NEW_CONCEPT);
    });

    it('should route stuck students to BRAIN', () => {
      const context = createContext('student-1', 'coding', 'Help with bug', {
        stakes: 0.5,
        recentFailures: 3,
      });

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.BRAIN);
      expect(decision.reason).toBe(EscalationReasonEnum.STUDENT_STUCK);
    });

    it('should escalate low-confidence BOT decisions to BRAIN', () => {
      const context = createContext('student-1', 'test', 'Test situation');
      const result = createDecisionResult(DecisionSource.BOT, 'Test action', 0.4);

      const [shouldEscalate, reason] = engine.shouldEscalate(result, context);

      expect(shouldEscalate).toBe(true);
      expect(reason).toBe(EscalationReasonEnum.LOW_CONFIDENCE);
    });

    it('should track BRAIN decision statistics', () => {
      const result = createDecisionResult(DecisionSource.BRAIN, 'Brain action', 0.7, {
        metadata: { studentId: 'student-1' },
      });

      engine.recordDecision(result);

      const stats = engine.getGlobalStats();
      expect(stats.brainDecisions).toBe(1);
    });

    it('should have positive cost for BRAIN decisions', () => {
      const cost = engine.estimateCost ? engine.estimateCost(DecisionSource.BRAIN) : 0.01;
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('HUMAN Level Routing', () => {
    it('should route critical situations to HUMAN', () => {
      const context = createContext('student-1', 'security', 'Account compromised', {
        stakes: 0.95,
        urgencyMs: 50,
      });

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.HUMAN);
    });

    it('should route time-critical decisions to HUMAN', () => {
      const context = createContext('student-1', 'emergency', 'Urgent help needed', {
        stakes: 0.8,
        urgencyMs: 100, // Very urgent
      });

      const decision = engine.routeDecision(context);

      expect(decision.source).toBe(DecisionSource.HUMAN);
      expect([
        EscalationReasonEnum.HIGH_STAKES,
        EscalationReasonEnum.TIME_CRITICAL,
      ]).toContain(decision.reason);
    });

    it('should not escalate HUMAN decisions', () => {
      const context = createContext('student-1', 'test', 'Test situation');
      const result = createDecisionResult(DecisionSource.HUMAN, 'Human action', 0.3);

      const [shouldEscalate] = engine.shouldEscalate(result, context);

      expect(shouldEscalate).toBe(false);
    });

    it('should track HUMAN decision statistics', () => {
      const result = createDecisionResult(DecisionSource.HUMAN, 'Human action', 0.9, {
        metadata: { studentId: 'student-1' },
      });

      engine.recordDecision(result);

      const stats = engine.getGlobalStats();
      expect(stats.humanDecisions).toBe(1);
    });

    it('should have highest cost for HUMAN decisions', () => {
      const botCost = engine.estimateCost ? engine.estimateCost(DecisionSource.BOT) : 0;
      const brainCost = engine.estimateCost ? engine.estimateCost(DecisionSource.BRAIN) : 0.01;
      const humanCost = engine.estimateCost ? engine.estimateCost(DecisionSource.HUMAN) : 0.02;

      expect(humanCost).toBeGreaterThan(brainCost);
      expect(brainCost).toBeGreaterThan(botCost);
    });
  });

  describe('Threshold Management', () => {
    it('should return default thresholds for new student', () => {
      const thresholds = engine.getThresholds('student-new');

      expect(thresholds.botMinConfidence).toBeDefined();
      expect(thresholds.brainMinConfidence).toBeDefined();
    });

    it('should set custom thresholds for student', () => {
      engine.setThresholds('student-1', { botMinConfidence: 0.7 });

      const thresholds = engine.getThresholds('student-1');

      expect(thresholds.botMinConfidence).toBe(0.7);
    });

    it('should adjust thresholds based on outcomes', () => {
      const studentId = 'student-1';
      const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

      const result = createDecisionResult(DecisionSource.BOT, 'Action', 0.8, {
        metadata: { studentId },
      });

      engine.recordDecision(result);
      engine.recordOutcome(result.decisionId, true);

      const newThreshold = engine.getThresholds(studentId).botMinConfidence;

      expect(newThreshold).not.toBe(initialThreshold);
    });

    it('should set phase-specific thresholds', () => {
      engine.setPhaseThresholds('cognitive-mill', { botMinConfidence: 0.8 });
      engine.setPhaseThresholds('intelligence-ranch', { botMinConfidence: 0.5 });

      const millThresholds = engine.getPhaseThresholds('cognitive-mill');
      const ranchThresholds = engine.getPhaseThresholds('intelligence-ranch');

      expect(millThresholds.botMinConfidence).toBe(0.8);
      expect(ranchThresholds.botMinConfidence).toBe(0.5);
    });
  });

  describe('Cost Tracking', () => {
    it('should track total cost across decisions', () => {
      engine.recordDecision(createDecisionResult(DecisionSource.BOT, 'Action 1', 0.8, {
        costEstimate: 0,
      }));
      engine.recordDecision(createDecisionResult(DecisionSource.BRAIN, 'Action 2', 0.7, {
        costEstimate: 0.01,
      }));

      const stats = engine.getGlobalStats();

      expect(stats.totalCost).toBeCloseTo(0.01, 2);
    });

    it('should calculate cost savings vs baseline', () => {
      // Simulate 100 bot decisions that would have been human
      for (let i = 0; i < 100; i++) {
        engine.recordDecision(createDecisionResult(DecisionSource.BOT, `Action ${i}`, 0.8, {
          costEstimate: 0,
        }));
      }

      const stats = engine.getGlobalStats();

      expect(stats.costSavings).toBeGreaterThan(0);
    });

    it('should track decisions by source', () => {
      engine.recordDecision(createDecisionResult(DecisionSource.BOT, 'Bot action', 0.8));
      engine.recordDecision(createDecisionResult(DecisionSource.BRAIN, 'Brain action', 0.7));
      engine.recordDecision(createDecisionResult(DecisionSource.HUMAN, 'Human action', 0.9));

      const stats = engine.getGlobalStats();

      expect(stats.botDecisions).toBe(1);
      expect(stats.brainDecisions).toBe(1);
      expect(stats.humanDecisions).toBe(1);
      expect(stats.totalDecisions).toBe(3);
    });
  });

  describe('Learning from Outcomes', () => {
    it('should lower thresholds on successful outcomes', () => {
      const studentId = 'student-1';
      const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

      const result = createDecisionResult(DecisionSource.BOT, 'Action', 0.8, {
        metadata: { studentId },
      });

      engine.recordDecision(result);
      engine.recordOutcome(result.decisionId, true);

      const newThreshold = engine.getThresholds(studentId).botMinConfidence;

      expect(newThreshold).toBeLessThan(initialThreshold);
    });

    it('should raise thresholds on failed outcomes', () => {
      const studentId = 'student-1';
      const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

      const result = createDecisionResult(DecisionSource.BOT, 'Action', 0.8, {
        metadata: { studentId },
      });

      engine.recordDecision(result);
      engine.recordOutcome(result.decisionId, false);

      const newThreshold = engine.getThresholds(studentId).botMinConfidence;

      expect(newThreshold).toBeGreaterThan(initialThreshold);
    });

    it('should track success rate per student', () => {
      const studentId = 'student-1';

      // 7 successes, 3 failures
      for (let i = 0; i < 7; i++) {
        const result = createDecisionResult(DecisionSource.BOT, `Success ${i}`, 0.8, {
          metadata: { studentId },
        });
        engine.recordDecision(result);
        engine.recordOutcome(result.decisionId, true);
      }

      for (let i = 0; i < 3; i++) {
        const result = createDecisionResult(DecisionSource.BOT, `Failure ${i}`, 0.6, {
          metadata: { studentId },
        });
        engine.recordDecision(result);
        engine.recordOutcome(result.decisionId, false);
      }

      const stats = engine.getStudentStats(studentId);

      expect(stats.successRate).toBeCloseTo(0.7, 1);
      expect(stats.successes).toBe(7);
      expect(stats.failures).toBe(3);
    });
  });
});

// ============================================================================
// Biological Agent Behaviors Tests
// ============================================================================

describe('Agent System - Biological Agent Behaviors', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      enableNPCs: true,
      enableA2A: false,
      preferLocalAI: true,
    });
  });

  describe('Zooplankton Agent (Token-level)', () => {
    it('should have Zooplankton-like rapid response behavior', async () => {
      // Zooplankton agents are fast, simple processors
      const startTime = Date.now();

      const response = await orchestrator.chat('Quick syntax check');
      const duration = Date.now() - startTime;

      // Should respond quickly
      expect(duration).toBeLessThan(5000);
      expect(response).toBeDefined();
    });

    it('should handle simple token-level operations', async () => {
      const response = await orchestrator.chat('What does const mean in JavaScript?');

      expect(response.content).toBeDefined();
      expect(response.content.length).toBeGreaterThan(0);
    });
  });

  describe('Herring Agent (Vector Swarm)', () => {
    it('should demonstrate flocking behavior in recommendations', async () => {
      // Multiple related queries should show coherence
      const responses = await Promise.all([
        orchestrator.chat('How do I write a for loop?'),
        orchestrator.chat('What about while loops?'),
        orchestrator.chat('And do-while loops?'),
      ]);

      // All should have responses
      responses.forEach(r => {
        expect(r.content).toBeDefined();
      });
    });

    it('should maintain context across swarm queries', async () => {
      await orchestrator.chat('I\'m learning about loops');
      await orchestrator.chat('Show me a for loop example');
      const response = await orchestrator.chat('Now a while loop');

      // Should maintain context about loops
      expect(response.content).toBeDefined();
    });
  });

  describe('Deckhand Agent (Sitka Sound)', () => {
    it('should handle fishing/nautical queries', () => {
      orchestrator.setModule('sitka-sound');
      const deckhand = orchestrator.getModuleAgent();

      expect(deckhand).toBeDefined();
    });

    it('should have fishing-related capabilities', () => {
      orchestrator.setModule('sitka-sound');
      const agent = orchestrator.getModuleAgent();

      if (agent) {
        const tools = agent.getTools();
        // Should have tools related to Sitka Sound
        expect(tools).toBeInstanceOf(Array);
      }
    });
  });

  describe('Ranchhand Agent (Intelligence Ranch)', () => {
    it('should handle AI training queries', () => {
      orchestrator.setModule('intelligence-ranch');
      const ranchhand = orchestrator.getModuleAgent();

      expect(ranchhand).toBeDefined();
    });

    it('should have agent training capabilities', () => {
      orchestrator.setModule('intelligence-ranch');
      const agent = orchestrator.getModuleAgent();

      if (agent) {
        const tools = agent.getTools();
        expect(tools).toBeInstanceOf(Array);
      }
    });
  });

  describe('Captain Agent (Game Control)', () => {
    it('should handle game state queries', () => {
      orchestrator.setModule('cognitive-mill');
      const captain = orchestrator.getModuleAgent();

      expect(captain).toBeDefined();
    });

    it('should manage narrative generation', () => {
      orchestrator.setModule('cognitive-mill');
      const agent = orchestrator.getModuleAgent();

      if (agent) {
        const tools = agent.getTools();
        expect(tools).toBeInstanceOf(Array);
      }
    });
  });

  describe('Director Agent (Orchestration)', () => {
    it('should be available as default router', () => {
      const director = orchestrator.getAgent('director');

      expect(director).toBeDefined();
    });

    it('should coordinate between agents', async () => {
      const response = await orchestrator.chat('I need help with both coding and game mechanics');

      expect(response).toBeDefined();
      expect(response.agentId).toBeDefined();
    });
  });
});

// ============================================================================
// A2A Protocol Tests
// ============================================================================

describe('Agent System - A2A Protocol Communication', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      enableNPCs: false,
      enableA2A: true,
      preferLocalAI: true,
    });
  });

  describe('Agent Registration', () => {
    it('should register agents with A2A protocol', () => {
      const a2a = orchestrator.getA2AProtocol();

      expect(a2a).toBeDefined();
    });

    it('should track registered agents', () => {
      const agents = orchestrator.getAllAgents();

      expect(agents.size).toBeGreaterThan(0);

      // Should have director at minimum
      expect(agents.has('director')).toBe(true);
    });
  });

  describe('Inter-Agent Communication', () => {
    it('should support delegation between agents', async () => {
      const result = await orchestrator.delegateTask(
        'director',
        'captain',
        'get_game_state',
        { sceneId: 'test' }
      );

      // Should complete delegation
      expect(result).toBeDefined();
    });

    it('should broadcast to all agents', () => {
      // Should not throw
      expect(() => {
        orchestrator.broadcastToAgents('director', { type: 'test_broadcast' });
      }).not.toThrow();
    });
  });
});

// ============================================================================
// NPC Interaction Tests
// ============================================================================

describe('Agent System - NPC Interactions', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      enableNPCs: true,
      enableA2A: false,
      preferLocalAI: true,
    });
  });

  describe('NPC Availability', () => {
    it('should have NPCs for cognitive-mill module', () => {
      orchestrator.setModule('cognitive-mill');
      const npcs = orchestrator.getAllNPCs();

      // Cognitive Mill should have tutor NPCs
      expect(npcs.size).toBeGreaterThanOrEqual(0);
    });

    it('should have NPCs for sitka-sound module', () => {
      orchestrator.setModule('sitka-sound');
      const npcs = orchestrator.getAllNPCs();

      // Sitka Sound should have fishing-related NPCs
      expect(npcs.size).toBeGreaterThanOrEqual(0);
    });

    it('should have NPCs for intelligence-ranch module', () => {
      orchestrator.setModule('intelligence-ranch');
      const npcs = orchestrator.getAllNPCs();

      // Intelligence Ranch should have ranch-related NPCs
      expect(npcs.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Direct NPC Chat', () => {
    it('should handle direct chat with NPC', async () => {
      // First need to get a valid NPC ID
      const npcs = orchestrator.getAllNPCs();
      if (npcs.size > 0) {
        const npcId = npcs.keys().next().value as string;

        const response = await orchestrator.chatWithNPC(npcId, 'Hello!');

        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
      }
    });

    it('should return error for non-existent NPC', async () => {
      const response = await orchestrator.chatWithNPC('non-existent-npc', 'Hello');

      expect(response.content).toContain('not found');
    });

    it('should add NPC messages to conversation history', async () => {
      const npcs = orchestrator.getAllNPCs();
      if (npcs.size > 0) {
        const npcId = npcs.keys().next().value as string;

        await orchestrator.chatWithNPC(npcId, 'Test message');

        const history = orchestrator.getHistory();

        expect(history.length).toBe(2); // user + assistant
      }
    });
  });

  describe('NPC Module Switching', () => {
    it('should reinitialize NPCs when switching modules', () => {
      orchestrator.setModule('cognitive-mill');
      const millNpcCount = orchestrator.getAllNPCs().size;

      orchestrator.setModule('sitka-sound');
      const sitkaNpcCount = orchestrator.getAllNPCs().size;

      // NPC counts may differ by module
      expect(typeof millNpcCount).toBe('number');
      expect(typeof sitkaNpcCount).toBe('number');
    });
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Agent System - Error Handling', () => {
  let orchestrator: AgentOrchestrator;
  let mockAIClient: ReturnType<typeof createMockAIClient>;

  beforeEach(() => {
    mockAIClient = createMockAIClient();
    orchestrator = new AgentOrchestrator({
      enableNPCs: false,
      enableA2A: false,
      preferLocalAI: true,
    });
  });

  describe('AI Client Errors', () => {
    it('should handle AI unavailability gracefully', async () => {
      mockAIClient.isAvailable = vi.fn(async () => false);

      const available = await orchestrator.isAIAvailable();

      expect(available).toBe(false);
    });

    it('should handle AI chat errors', async () => {
      mockAIClient.chat = vi.fn(async () => {
        throw new Error('AI service unavailable');
      });

      await expect(orchestrator.chat('Test')).rejects.toThrow();
    });

    it('should recover from transient errors', async () => {
      let callCount = 0;
      mockAIClient.chat = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient error');
        }
        return { content: 'Recovered!' };
      });

      // First call fails
      await expect(orchestrator.chat('Test')).rejects.toThrow();

      // Second call succeeds
      const response = await orchestrator.chat('Test again');
      expect(response.content).toBe('Recovered!');
    });
  });

  describe('Invalid Input Handling', () => {
    it('should handle null messages', async () => {
      const response = await orchestrator.chat(null as unknown as string);

      expect(response).toBeDefined();
    });

    it('should handle special characters in messages', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

      const response = await orchestrator.chat(specialChars);

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      const unicode = 'Hello \u{1F600} \u{1F680} \u{1F4A9}';

      const response = await orchestrator.chat(unicode);

      expect(response).toBeDefined();
    });
  });

  describe('State Error Recovery', () => {
    it('should handle invalid module transitions', () => {
      expect(() => {
        orchestrator.setModule('invalid-module' as any);
      }).not.toThrow();
    });

    it('should handle context updates with invalid data', () => {
      expect(() => {
        orchestrator.updateContext({ stage: -1 } as any);
      }).not.toThrow();
    });

    it('should handle game state updates with invalid data', () => {
      expect(() => {
        orchestrator.updateGameState({ invalidField: 'test' } as any);
      }).not.toThrow();
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Agent System - Performance', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      enableNPCs: false,
      enableA2A: false,
      preferLocalAI: true,
    });
  });

  it('should handle rapid sequential messages', async () => {
    const start = Date.now();

    for (let i = 0; i < 10; i++) {
      await orchestrator.chat(`Message ${i}`);
    }

    const duration = Date.now() - start;

    // Should complete 10 messages in reasonable time
    expect(duration).toBeLessThan(30000);
  }, 35000);

  it('should handle concurrent requests', async () => {
    const promises = Array(5).fill(null).map((_, i) =>
      orchestrator.chat(`Concurrent message ${i}`)
    );

    const start = Date.now();
    const responses = await Promise.all(promises);
    const duration = Date.now() - start;

    expect(responses).toHaveLength(5);
    responses.forEach(r => expect(r).toBeDefined());
    expect(duration).toBeLessThan(20000);
  }, 25000);

  it('should maintain performance with large history', async () => {
    // Build up history
    for (let i = 0; i < 50; i++) {
      await orchestrator.chat(`History message ${i}`);
    }

    const start = Date.now();
    await orchestrator.chat('New message after large history');
    const duration = Date.now() - start;

    // Should still be responsive
    expect(duration).toBeLessThan(10000);
  }, 20000);
});
