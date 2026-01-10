/**
 * StudyLoG.AI - NVIDIA ACE Client
 *
 * Client for connecting to NVIDIA ACE microservices for NPC
 * speech synthesis, audio processing, and cognitive responses.
 */

import type {
  ACEConfig,
  ACERequest,
  ACEResponse,
  ACEInput,
  ACEContext,
  ACEOutput,
  NPCState,
  NPCAction,
  NPCMemory,
  MemoryEntry,
} from './types';

// ACE Microservice endpoints
interface ACEEndpoints {
  nim: string; // NVIDIA Inference Microservice
  riva: string; // Speech AI
  audio2face: string; // Facial animation
  omniverse: string; // 3D rendering (optional)
}

export class ACEClient {
  private config: ACEConfig;
  private endpoints: ACEEndpoints;
  private sessions: Map<string, ACESession> = new Map();
  private memoryStore: Map<string, NPCMemory> = new Map();

  constructor(config: ACEConfig) {
    this.config = config;
    this.endpoints = this.resolveEndpoints(config.endpoint);
  }

  private resolveEndpoints(baseEndpoint: string): ACEEndpoints {
    const base = baseEndpoint.replace(/\/$/, '');
    return {
      nim: `${base}/nim/v1`,
      riva: `${base}/riva/v1`,
      audio2face: `${base}/a2f/v1`,
      omniverse: `${base}/omniverse/v1`,
    };
  }

  /**
   * Initialize a conversation session with an NPC
   */
  async createSession(npcId: string, playerId: string): Promise<string> {
    const sessionId = `${npcId}-${playerId}-${Date.now()}`;

    const session: ACESession = {
      id: sessionId,
      npcId,
      playerId,
      createdAt: new Date(),
      lastActivity: new Date(),
      conversationHistory: [],
      emotionalState: {
        valence: 0,
        arousal: 0.3,
        dominance: 0.5,
      },
    };

    this.sessions.set(sessionId, session);

    // Initialize memory if not exists
    if (!this.memoryStore.has(`${npcId}-${playerId}`)) {
      this.memoryStore.set(`${npcId}-${playerId}`, {
        npcId,
        playerId,
        shortTerm: [],
        longTerm: [],
        relationships: [],
        sharedExperiences: [],
      });
    }

    return sessionId;
  }

  /**
   * Send input to an NPC and get a response
   */
  async chat(request: ACERequest): Promise<ACEResponse> {
    const session = this.sessions.get(request.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }

    // Update session activity
    session.lastActivity = new Date();

    // Process input based on type
    let processedInput = request.input;
    if (request.input.type === 'audio' && this.config.enableAudio) {
      processedInput = await this.processAudioInput(request.input);
    }

    // Build prompt for NIM
    const prompt = this.buildNPCPrompt(request, session);

    // Call NIM for cognitive response
    const nimResponse = await this.callNIM(prompt, request.context);

    // Generate audio if enabled
    let audioUrl: string | undefined;
    if (this.config.enableAudio) {
      audioUrl = await this.generateSpeech(nimResponse.text, request.npcId);
    }

    // Generate animation if enabled
    let animationId: string | undefined;
    let facialExpression: string | undefined;
    if (this.config.enableAnimation) {
      const animation = await this.generateAnimation(nimResponse.emotion);
      animationId = animation.animationId;
      facialExpression = animation.expression;
    }

    // Update conversation history
    session.conversationHistory.push({
      role: 'user',
      content: processedInput.content,
      timestamp: new Date(),
    });
    session.conversationHistory.push({
      role: 'npc',
      content: nimResponse.text,
      timestamp: new Date(),
      emotion: nimResponse.emotion,
    });

    // Update memory
    await this.updateMemory(request.sessionId, processedInput.content, nimResponse.text);

    // Parse actions from response
    const actions = this.parseActions(nimResponse.text, nimResponse.metadata);

    // Build response
    const response: ACEResponse = {
      sessionId: request.sessionId,
      npcId: request.npcId,
      output: {
        text: nimResponse.text,
        audioUrl,
        animationId,
        emotion: nimResponse.emotion,
        facialExpression,
      },
      stateUpdate: {
        mood: this.emotionToMood(nimResponse.emotion),
        lastInteraction: new Date(),
      },
      actions,
    };

    return response;
  }

  /**
   * Process audio input through Riva ASR
   */
  private async processAudioInput(input: ACEInput): Promise<ACEInput> {
    if (!input.audioData) {
      return input;
    }

    try {
      const response = await fetch(`${this.endpoints.riva}/asr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: input.audioData,
      });

      if (!response.ok) {
        console.error('Riva ASR failed, falling back to text');
        return input;
      }

      const result = await response.json();
      return {
        type: 'text',
        content: result.transcript || input.content,
        metadata: {
          ...input.metadata,
          originalAudio: true,
          confidence: result.confidence,
        },
      };
    } catch (error) {
      console.error('Audio processing error:', error);
      return input;
    }
  }

  /**
   * Build the prompt for NIM based on NPC context
   */
  private buildNPCPrompt(request: ACERequest, session: ACESession): string {
    const memory = this.getMemoryContext(request.sessionId);

    return `You are an NPC character in an educational game.

## Character Context
NPC ID: ${request.npcId}
Current Mood: ${request.context.npcState.mood}
Relationship with Player: ${request.context.npcState.relationship}/100
Current Location: ${request.context.npcState.currentLocation}

## Player Context
Player Name: ${request.context.playerInfo.name}
Skill Level: ${request.context.playerInfo.skillLevel}
Learning Phase: ${request.context.playerInfo.learningPhase}

## Game Context
Module: ${request.context.gameState.module}
Stage: ${request.context.gameState.stage}
Scene: ${request.context.gameState.currentScene}

## Memory
${memory}

## Recent Conversation
${session.conversationHistory.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')}

## Player Input
${request.input.content}

Respond in character. Include [EMOTION:name] tags for emotional state.
If you want to perform an action, include [ACTION:type:payload] tags.

Your response:`;
  }

  /**
   * Call NVIDIA NIM for cognitive response
   */
  private async callNIM(
    prompt: string,
    context: ACEContext
  ): Promise<{ text: string; emotion: string; metadata?: Record<string, unknown> }> {
    try {
      const response = await fetch(`${this.endpoints.nim}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          model: this.config.modelId || 'meta/llama-3.1-8b-instruct',
          messages: [
            {
              role: 'system',
              content: context.memoryContext || 'You are a helpful NPC character.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`NIM request failed: ${response.status}`);
      }

      const result = await response.json();
      const text = result.choices?.[0]?.message?.content || '';

      // Extract emotion from response
      const emotionMatch = text.match(/\[EMOTION:(\w+)\]/);
      const emotion = emotionMatch ? emotionMatch[1] : 'neutral';

      // Clean response text
      const cleanText = text
        .replace(/\[EMOTION:\w+\]/g, '')
        .replace(/\[ACTION:[^\]]+\]/g, '')
        .trim();

      return {
        text: cleanText,
        emotion,
        metadata: {
          rawResponse: text,
          model: result.model,
        },
      };
    } catch (error) {
      console.error('NIM call failed:', error);
      // Fallback response
      return {
        text: "I'm having trouble thinking right now. Let's try again in a moment.",
        emotion: 'confused',
      };
    }
  }

  /**
   * Generate speech using Riva TTS
   */
  private async generateSpeech(text: string, npcId: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${this.endpoints.riva}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          text,
          voice: this.getVoiceForNPC(npcId),
          sample_rate: 22050,
          language_code: 'en-US',
        }),
      });

      if (!response.ok) {
        console.error('Riva TTS failed');
        return undefined;
      }

      const audioBlob = await response.blob();
      // In production, this would upload to storage and return URL
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      console.error('Speech generation error:', error);
      return undefined;
    }
  }

  /**
   * Generate facial animation using Audio2Face
   */
  private async generateAnimation(
    emotion: string
  ): Promise<{ animationId?: string; expression?: string }> {
    try {
      const response = await fetch(`${this.endpoints.audio2face}/animate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({
          emotion,
          intensity: 0.7,
        }),
      });

      if (!response.ok) {
        return { expression: emotion };
      }

      const result = await response.json();
      return {
        animationId: result.animation_id,
        expression: result.expression || emotion,
      };
    } catch (error) {
      console.error('Animation generation error:', error);
      return { expression: emotion };
    }
  }

  /**
   * Get voice configuration for NPC
   */
  private getVoiceForNPC(npcId: string): string {
    // Map NPCs to voice IDs
    const voiceMap: Record<string, string> = {
      'miller-mae': 'female-elder',
      'cog-the-apprentice': 'male-young',
      'professor-sprocket': 'male-eccentric',
      'captain-tide': 'male-gruff',
      marina: 'female-professional',
      'old-salt': 'male-ancient',
      'rancher-ray': 'male-casual',
      'data-dana': 'female-precise',
      'shepherd-sam': 'male-calm',
    };

    return voiceMap[npcId] || 'neutral';
  }

  /**
   * Get memory context for session
   */
  private getMemoryContext(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    const memoryKey = `${session.npcId}-${session.playerId}`;
    const memory = this.memoryStore.get(memoryKey);
    if (!memory) return '';

    // Build context from memory
    const recentMemories = memory.shortTerm.slice(-5);
    const importantMemories = memory.longTerm
      .filter((m) => m.importance > 0.7)
      .slice(-3);

    const parts: string[] = [];

    if (recentMemories.length > 0) {
      parts.push('Recent memories:');
      recentMemories.forEach((m) => parts.push(`- ${m.content}`));
    }

    if (importantMemories.length > 0) {
      parts.push('Important memories:');
      importantMemories.forEach((m) => parts.push(`- ${m.content}`));
    }

    if (memory.sharedExperiences.length > 0) {
      parts.push('Shared experiences:');
      memory.sharedExperiences.slice(-3).forEach((e) => parts.push(`- ${e.summary}`));
    }

    return parts.join('\n');
  }

  /**
   * Update memory with new interaction
   */
  private async updateMemory(sessionId: string, userInput: string, npcResponse: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const memoryKey = `${session.npcId}-${session.playerId}`;
    const memory = this.memoryStore.get(memoryKey);
    if (!memory) return;

    // Add to short-term memory
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}`,
      timestamp: new Date(),
      type: 'conversation',
      content: `Player said: "${userInput.substring(0, 100)}". I responded about ${this.summarizeResponse(npcResponse)}`,
      importance: this.calculateImportance(userInput, npcResponse),
      emotionalValence: 0,
      tags: this.extractTags(userInput, npcResponse),
    };

    memory.shortTerm.push(entry);

    // Consolidate to long-term if important
    if (entry.importance > 0.7) {
      memory.longTerm.push(entry);
    }

    // Trim short-term memory
    if (memory.shortTerm.length > 20) {
      memory.shortTerm = memory.shortTerm.slice(-20);
    }
  }

  /**
   * Summarize response for memory
   */
  private summarizeResponse(response: string): string {
    const words = response.split(' ').slice(0, 10).join(' ');
    return words.length < response.length ? `${words}...` : words;
  }

  /**
   * Calculate importance of interaction
   */
  private calculateImportance(userInput: string, npcResponse: string): number {
    const importantKeywords = [
      'learn', 'teach', 'help', 'understand', 'explain',
      'problem', 'solution', 'quest', 'mission', 'discover',
    ];

    const combined = `${userInput} ${npcResponse}`.toLowerCase();
    const matches = importantKeywords.filter((kw) => combined.includes(kw)).length;

    return Math.min(0.3 + matches * 0.15, 1.0);
  }

  /**
   * Extract tags from interaction
   */
  private extractTags(userInput: string, npcResponse: string): string[] {
    const tags: string[] = [];
    const combined = `${userInput} ${npcResponse}`.toLowerCase();

    const tagPatterns: Record<string, string[]> = {
      learning: ['learn', 'teach', 'understand', 'explain'],
      quest: ['quest', 'mission', 'task', 'goal'],
      emotion: ['happy', 'sad', 'angry', 'excited', 'confused'],
      technical: ['gear', 'ratio', 'algorithm', 'code', 'function'],
    };

    for (const [tag, keywords] of Object.entries(tagPatterns)) {
      if (keywords.some((kw) => combined.includes(kw))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Parse actions from NPC response
   */
  private parseActions(text: string, metadata?: Record<string, unknown>): NPCAction[] {
    const actions: NPCAction[] = [];
    const rawResponse = (metadata?.rawResponse as string) || text;

    // Match [ACTION:type:payload] patterns
    const actionMatches = rawResponse.matchAll(/\[ACTION:(\w+):([^\]]+)\]/g);

    for (const match of actionMatches) {
      const type = match[1] as NPCAction['type'];
      let payload: Record<string, unknown> = {};

      try {
        payload = JSON.parse(match[2]);
      } catch {
        payload = { value: match[2] };
      }

      actions.push({ type, payload });
    }

    return actions;
  }

  /**
   * Convert emotion to mood
   */
  private emotionToMood(emotion: string): NPCState['mood'] {
    const moodMap: Record<string, NPCState['mood']> = {
      happy: 'happy',
      joy: 'happy',
      excited: 'excited',
      curious: 'curious',
      interested: 'curious',
      concerned: 'concerned',
      worried: 'concerned',
      frustrated: 'frustrated',
      angry: 'frustrated',
      thoughtful: 'thoughtful',
      pensive: 'thoughtful',
    };

    return moodMap[emotion.toLowerCase()] || 'neutral';
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Consolidate important memories before ending
      const memoryKey = `${session.npcId}-${session.playerId}`;
      const memory = this.memoryStore.get(memoryKey);

      if (memory) {
        // Mark session as shared experience
        memory.sharedExperiences.push({
          id: `exp-${Date.now()}`,
          participants: [session.npcId, session.playerId],
          type: 'conversation',
          summary: `Had a conversation with ${session.conversationHistory.length} exchanges`,
          timestamp: new Date(),
          outcome: 'neutral',
        });
      }

      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get NPC memory
   */
  getMemory(npcId: string, playerId: string): NPCMemory | undefined {
    return this.memoryStore.get(`${npcId}-${playerId}`);
  }

  /**
   * Check if ACE services are available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoints.nim}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Session tracking
interface ACESession {
  id: string;
  npcId: string;
  playerId: string;
  createdAt: Date;
  lastActivity: Date;
  conversationHistory: Array<{
    role: 'user' | 'npc';
    content: string;
    timestamp: Date;
    emotion?: string;
  }>;
  emotionalState: {
    valence: number;
    arousal: number;
    dominance: number;
  };
}

// Export factory function
export function createACEClient(config: Partial<ACEConfig> = {}): ACEClient {
  const fullConfig: ACEConfig = {
    endpoint: config.endpoint || process.env.NVIDIA_ACE_ENDPOINT || 'http://localhost:8080',
    apiKey: config.apiKey || process.env.NVIDIA_ACE_API_KEY,
    enableAudio: config.enableAudio ?? true,
    enableAnimation: config.enableAnimation ?? true,
    enableRag: config.enableRag ?? false,
    modelId: config.modelId,
  };

  return new ACEClient(fullConfig);
}
