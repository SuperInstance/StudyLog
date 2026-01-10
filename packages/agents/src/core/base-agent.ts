/**
 * StudyLoG.AI - Base Agent Class
 *
 * Abstract base class for all agents in the system.
 */

import type {
  AgentId,
  AgentStatus,
  AgentConfig,
  AgentContext,
  AgentResponse,
  Message,
  ToolCall,
  ToolResult,
  ToolDefinition,
  AgentEvent,
} from './types';
import { AIClient } from './ai-client';

export abstract class BaseAgent {
  readonly id: AgentId;
  readonly name: string;
  readonly description: string;

  protected config: AgentConfig;
  protected aiClient: AIClient;
  protected status: AgentStatus = 'idle';
  protected eventListeners: Array<(event: AgentEvent) => void> = [];

  constructor(config: AgentConfig, aiClient: AIClient) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.aiClient = aiClient;
  }

  // Get current status
  getStatus(): AgentStatus {
    return this.status;
  }

  // Add event listener
  on(listener: (event: AgentEvent) => void): () => void {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  // Emit event
  protected emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    }
  }

  // Process a user message
  async process(
    userMessage: string,
    context: AgentContext
  ): Promise<AgentResponse> {
    this.status = 'thinking';

    try {
      // Build messages for AI
      const messages = this.buildMessages(userMessage, context);

      // Get AI response
      const aiResponse = await this.aiClient.chat({
        messages,
        tools: this.config.tools,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 1024,
      });

      this.status = 'acting';

      // Handle tool calls if any
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const toolResults = await this.executeTools(aiResponse.toolCalls, context);

        // Get follow-up response with tool results
        const followUpMessages = [
          ...messages,
          {
            role: 'assistant' as const,
            content: aiResponse.content,
            toolCalls: aiResponse.toolCalls,
          },
          {
            role: 'tool' as const,
            content: JSON.stringify(toolResults),
          },
        ];

        const followUpResponse = await this.aiClient.chat({
          messages: followUpMessages,
          temperature: this.config.temperature ?? 0.7,
          maxTokens: this.config.maxTokens ?? 1024,
        });

        const response = this.buildResponse(followUpResponse.content, context);
        this.status = 'idle';
        this.emit({ type: 'response', response });
        return response;
      }

      const response = this.buildResponse(aiResponse.content, context);
      this.status = 'idle';
      this.emit({ type: 'response', response });
      return response;
    } catch (error) {
      this.status = 'error';
      this.emit({ type: 'error', error: error as Error });
      throw error;
    }
  }

  // Build messages for AI from context
  protected buildMessages(
    userMessage: string,
    context: AgentContext
  ): Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCalls?: ToolCall[] }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; toolCalls?: ToolCall[] }> = [];

    // System prompt with context
    const systemPrompt = this.buildSystemPrompt(context);
    messages.push({ role: 'system', content: systemPrompt });

    // Recent conversation history (last 10 messages)
    const recentHistory = context.conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
          toolCalls: msg.toolCalls,
        });
      }
    }

    // Current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  // Build system prompt with context
  protected buildSystemPrompt(context: AgentContext): string {
    const parts: string[] = [this.config.systemPrompt];

    // Add context info
    parts.push(`\n\n## Current Context`);
    parts.push(`- Module: ${context.module}`);
    parts.push(`- Stage: ${context.stage}`);
    parts.push(`- Student Phase: ${context.phase}`);

    if (context.student) {
      parts.push(`- Student: ${context.student.displayName}`);
      parts.push(`- Hint Preference: ${context.student.preferences.hintLevel}`);
    }

    if (context.gameState) {
      parts.push(`- Current Scene: ${context.gameState.scene}`);
      parts.push(`- Game Paused: ${context.gameState.paused}`);
    }

    return parts.join('\n');
  }

  // Execute tool calls
  protected async executeTools(
    toolCalls: ToolCall[],
    context: AgentContext
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      this.emit({ type: 'tool_call', toolCall: call });

      try {
        const result = await this.executeTool(call, context);
        const toolResult: ToolResult = {
          toolCallId: call.id,
          result,
        };
        results.push(toolResult);
        this.emit({ type: 'tool_result', result: toolResult });
      } catch (error) {
        const toolResult: ToolResult = {
          toolCallId: call.id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        results.push(toolResult);
        this.emit({ type: 'tool_result', result: toolResult });
      }
    }

    return results;
  }

  // Execute a single tool - to be overridden by subclasses
  protected abstract executeTool(
    call: ToolCall,
    context: AgentContext
  ): Promise<unknown>;

  // Build response from AI content
  protected buildResponse(content: string, context: AgentContext): AgentResponse {
    return {
      content,
      agentId: this.id,
    };
  }

  // Get available tools
  getTools(): ToolDefinition[] {
    return this.config.tools;
  }
}
