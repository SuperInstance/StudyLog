/**
 * StudyLoG.AI - Agent Orchestrator Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentOrchestrator } from '../src/core/orchestrator';
import type { AgentContext } from '../src/core/types';

// Mock AI client responses
vi.mock('../src/core/ai-client', () => ({
  AIClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Mock response from AI',
      toolCalls: undefined,
    }),
    complete: vi.fn().mockResolvedValue('DIRECTOR'),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
  createAIClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'Mock response from AI',
      toolCalls: undefined,
    }),
    complete: vi.fn().mockResolvedValue('DIRECTOR'),
    isAvailable: vi.fn().mockResolvedValue(true),
  })),
}));

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator({
      initialModule: 'cognitive-mill',
    });
  });

  describe('initialization', () => {
    it('should create with default context', () => {
      const context = orchestrator.getContext();
      expect(context.module).toBe('cognitive-mill');
      expect(context.stage).toBe(1);
      expect(context.phase).toBe('player');
    });

    it('should have director and captain agents', () => {
      expect(orchestrator.getAgent('director')).toBeDefined();
      expect(orchestrator.getAgent('captain')).toBeDefined();
    });
  });

  describe('context management', () => {
    it('should update module', () => {
      orchestrator.setModule('sitka-sound');
      const context = orchestrator.getContext();
      expect(context.module).toBe('sitka-sound');
      expect(context.stage).toBe(1); // Reset on module change
    });

    it('should advance stage', () => {
      const newStage = orchestrator.advanceStage();
      expect(newStage).toBe(2);
      expect(orchestrator.getContext().stage).toBe(2);
    });

    it('should update phase', () => {
      orchestrator.setPhase('reader');
      expect(orchestrator.getContext().phase).toBe('reader');
    });

    it('should set student info', () => {
      const student = {
        id: 'test-student',
        displayName: 'Test Student',
        skillLevels: { 'gear-ratios': 50 },
        preferences: {
          hintLevel: 'moderate' as const,
          pace: 'normal' as const,
        },
      };
      orchestrator.setStudent(student);
      expect(orchestrator.getContext().student).toEqual(student);
    });
  });

  describe('conversation', () => {
    it('should process messages and update history', async () => {
      const response = await orchestrator.chat('Hello');

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();

      const history = orchestrator.getHistory();
      expect(history.length).toBe(2); // User + assistant
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should clear history', async () => {
      await orchestrator.chat('Hello');
      orchestrator.clearHistory();
      expect(orchestrator.getHistory().length).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit events', async () => {
      const events: unknown[] = [];
      orchestrator.on((event) => events.push(event));

      await orchestrator.chat('Hello');

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e: any) => e.type === 'message')).toBe(true);
    });

    it('should allow removing event listeners', () => {
      const listener = vi.fn();
      const unsubscribe = orchestrator.on(listener);
      unsubscribe();

      // Event should not be called after unsubscribe
      orchestrator.setModule('sitka-sound');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('AgentContext', () => {
  it('should have valid default structure', () => {
    const context: AgentContext = {
      module: 'cognitive-mill',
      stage: 1,
      phase: 'player',
      conversationHistory: [],
      agentState: {},
    };

    expect(context.module).toBe('cognitive-mill');
    expect(context.conversationHistory).toEqual([]);
  });
});
