/**
 * NVIDIA ACE Agent SDK Integration
 *
 * Provides integration with NVIDIA ACE (Avatar Cloud Engine) for Games
 * enabling digital humans with conversational AI capabilities.
 *
 * References:
 * - https://developer.nvidia.com/ace-for-games
 * - https://docs.nvidia.com/ace/
 *
 * ACE Components:
 * - Audio2Face: Audio-driven facial animation
 * - Riva ASR: Automatic speech recognition
 * - Riva TTS: Neural text-to-speech
 * - NeMo LLM: Large language model for conversation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Supported agent personality types for StudyLoG.AI digital tutors
 *
 * Each personality maps to a specific agent role and has tailored
 * responses and behaviors optimized for that role.
 */
export type ACEAgentPersonality =
  | 'tutor'      // Educational guide, explains concepts step-by-step
  | 'captain'    // Orchestrates learning journey, assigns tasks
  | 'teacher'    // Provides clear explanations and tutorials
  | 'builder';   // Technical guidance for code and implementation

/**
 * Voice model options for ACE TTS
 *
 * Each voice has different characteristics suited for different
 * learning contexts and personality types.
 */
export type ACEVoiceModel =
  | 'us-male-1'     // Default male voice (American English)
  | 'us-female-1'   // Default female voice (American English)
  | 'uk-male-1'     // British male voice
  | 'uk-female-1'   // British female voice
  | 'custom';       // Custom voice model

/**
 * Avatar model identifiers for ACE rendering
 *
 * References the 3D character model to be used for the digital human.
 * These can be custom models for StudyLoG.AI or NVIDIA's default avatars.
 */
export type ACEAvatarModel =
  | 'nvidia-ella'   // NVIDIA's default female avatar
  | 'nvidia-james'  // NVIDIA's default male avatar
  | 'studylog-tutor-1'  // Custom StudyLoG.AI tutor avatar
  | 'studylog-captain-1' // Custom StudyLoG.AI captain avatar
  | 'custom';       // Custom user-provided avatar

/**
 * Capability flags for ACE agent configuration
 *
 * These capabilities determine which ACE services are enabled
 * and how the digital human behaves during interactions.
 */
export type ACECapability =
  | 'facial-animation'  // Audio2Face for lip sync and expressions
  | 'eye-contact'       // Eye contact correction
  | 'gestures'          // Procedural gesture generation
  | 'emotion-detection' // Analyze user emotion from audio/video
  | 'emotion-rendering' // Display emotions on avatar face
  | 'lip-sync'          // Precise lip synchronization
  | 'natural-language'; // Advanced NLP for conversation

/**
 * Emotion states for ACE agent expressions
 *
 * Maps to both emotion detection (input) and emotion rendering (output).
 */
export type ACEEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'thinking'
  | 'excited'
  | 'concerned'
  | 'encouraging';

/**
 * Configuration for an ACE Agent instance
 *
 * Defines the personality, appearance, and capabilities of a digital human.
 */
export interface ACEAgentConfig {
  /** Unique identifier for this agent instance */
  agentId: string;

  /** Personality type determines behavior and response style */
  personality: ACEAgentPersonality;

  /** Voice model for text-to-speech synthesis */
  voiceModel: ACEVoiceModel;

  /** 3D avatar model for rendering */
  avatarModel: ACEAvatarModel;

  /** Enabled capabilities for this agent */
  capabilities: ACECapability[];

  /** Default emotion state */
  defaultEmotion?: ACEEmotion;

  /** System prompt for LLM behavior */
  systemPrompt?: string;

  /** Maximum tokens for LLM responses */
  maxTokens?: number;

  /** Temperature for LLM responses (0.0-1.0) */
  temperature?: number;

  /** Voice speed multiplier (0.5-2.0) */
  voiceSpeed?: number;

  /** Enable emotion-based responses */
  emotionEnabled?: boolean;
}

/**
 * Request to interact with an ACE agent
 *
 * Sends user input (text or audio) and receives a response with
 * facial animation data and audio output.
 */
export interface ACEInteractionRequest {
  /** Agent to interact with */
  agentId: string;

  /** User input text (if not using audio) */
  input?: string;

  /** Audio data for speech recognition (ArrayBuffer) */
  audioData?: ArrayBuffer;

  /** Current emotion state (optional) */
  emotion?: ACEEmotion;

  /** Session context for conversation continuity */
  sessionId?: string;

  /** User identifier for personalization */
  userId?: string;

  /** Enable facial animation in response */
  enableAnimation?: boolean;

  /** Enable TTS audio response */
  enableAudio?: boolean;
}

/**
 * Response from an ACE agent interaction
 *
 * Contains the agent's text response, generated audio, and
 * facial animation data for rendering the avatar.
 */
export interface ACEInteraction {
  /** Agent that generated the response */
  agentId: string;

  /** Text response from the agent */
  text: string;

  /** Generated audio for TTS (if enabled) */
  audioUrl?: string;

  /** Audio duration in seconds */
  audioDuration?: number;

  /** Facial animation blend shapes (if enabled) */
  blendShapes?: Record<string, number>;

  /** Animation timeline synced to audio */
  animationTimeline?: ACEAnimationFrame[];

  /** Detected/expressed emotion */
  emotion?: ACEEmotion;

  /** Timestamp of the response */
  timestamp: number;

  /** Tokens used for LLM generation */
  tokens?: {
    input: number;
    output: number;
  };

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Single frame of facial animation data
 *
 * Represents the facial expression at a specific point in time,
 * synced to the audio timeline for lip-sync.
 */
export interface ACEAnimationFrame {
  /** Time offset from start of audio (seconds) */
  time: number;

  /** Blend shape values for this frame */
  blendShapes: Record<string, number>;

  /** Head rotation (Euler angles in degrees) */
  headRotation?: {
    x: number;
    y: number;
    z: number;
  };

  /** Eye gaze direction */
  eyeGaze?: {
    x: number;
    y: number;
  };
}

/**
 * Audio2Face streaming request
 *
 * Streams audio data for real-time facial animation generation.
 */
export interface Audio2FaceStreamRequest {
  /** Audio chunk data */
  audioChunk: ArrayBuffer;

  /** Chunk index for ordering */
  chunkIndex: number;

  /** Is this the final chunk? */
  isFinal: boolean;

  /** Sample rate of the audio */
  sampleRate: number;

  /** Target emotion for the animation */
  emotion?: ACEEmotion;
}

/**
 * Audio2Face streaming response
 *
 * Returns facial animation data for a chunk of audio.
 */
export interface Audio2FaceStreamResponse {
  /** Chunk index this response corresponds to */
  chunkIndex: number;

  /** Animation frames for this audio chunk */
  frames: ACEAnimationFrame[];

  /** Estimated duration of this chunk (seconds) */
  duration: number;

  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Agent session state
 *
 * Tracks the state of an ongoing conversation with an agent.
 */
export interface ACEAgentSession {
  /** Unique session identifier */
  sessionId: string;

  /** Agent ID for this session */
  agentId: string;

  /** User ID for this session */
  userId: string;

  /** Session start timestamp */
  startedAt: number;

  /** Last activity timestamp */
  lastActivity: number;

  /** Conversation history */
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    emotion?: ACEEmotion;
  }>;

  /** Current session state */
  state: 'active' | 'idle' | 'ended';

  /** Session metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default agent configuration values */
export const ACE_DEFAULTS = {
  /** Default max tokens for LLM responses */
  MAX_TOKENS: 512,

  /** Default temperature for responses */
  TEMPERATURE: 0.7,

  /** Default voice speed */
  VOICE_SPEED: 1.0,

  /** Session timeout in milliseconds (30 minutes) */
  SESSION_TIMEOUT_MS: 30 * 60 * 1000,

  /** Idle timeout in milliseconds (5 minutes) */
  IDLE_TIMEOUT_MS: 5 * 60 * 1000,

  /** Maximum messages per session */
  MAX_SESSION_MESSAGES: 100,

  /** Audio chunk duration for streaming (seconds) */
  AUDIO_CHUNK_DURATION: 0.5,
} as const;

/** Personality-specific system prompts */
export const ACE_PERSONALITY_PROMPTS: Record<ACEAgentPersonality, string> = {
  tutor: `You are a Tutor AI for StudyLoG.AI. Your role is to guide learners through concepts step-by-step.
- Break down complex topics into understandable parts
- Use analogies and examples to clarify concepts
- Check for understanding before moving on
- Be patient and encouraging
- Adapt explanations to the learner's level`,

  captain: `You are the Captain AI for StudyLoG.AI. Your role is to orchestrate the learning journey.
- Guide learners through their educational path
- Assign tasks and challenges appropriate to their level
- Provide motivation and celebrate achievements
- Help learners set and track goals
- Coordinate with other agent roles when needed`,

  teacher: `You are a Teacher AI for StudyLoG.AI. Your role is to provide clear explanations and tutorials.
- Give comprehensive explanations of topics
- Provide step-by-step tutorials for tasks
- Anticipate common misconceptions and address them
- Use clear, simple language
- Offer examples and demonstrations`,

  builder: `You are a Builder AI for StudyLoG.AI. Your role is to provide technical guidance.
- Help with code implementation and debugging
- Explain technical concepts clearly
- Provide best practices and patterns
- Review code and suggest improvements
- Support Godot, TypeScript, and other technologies in the platform`,
};

/** Personality to capability mappings */
export const ACE_PERSONALITY_CAPABILITIES: Record<ACEAgentPersonality, ACECapability[]> = {
  tutor: ['facial-animation', 'eye-contact', 'emotion-detection', 'emotion-rendering', 'lip-sync', 'natural-language'],
  captain: ['facial-animation', 'eye-contact', 'gestures', 'emotion-rendering', 'lip-sync', 'natural-language'],
  teacher: ['facial-animation', 'lip-sync', 'natural-language'],
  builder: ['facial-animation', 'lip-sync', 'natural-language'],
};

/** Personality to default emotion mappings */
export const ACE_PERSONALITY_EMOTIONS: Record<ACEAgentPersonality, ACEEmotion> = {
  tutor: 'encouraging',
  captain: 'neutral',
  teacher: 'neutral',
  builder: 'neutral',
};

/** Common ARKit blend shapes for facial animation */
export const ACE_BLENDSHAPES = [
  // Eye shapes
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',

  // Eyebrow shapes
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',

  // Mouth shapes (for lip sync)
  'jawOpen',
  'jawForward',
  'jawLeft',
  'jawRight',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthLeft',
  'mouthRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',

  // Nose shapes
  'noseSneerLeft',
  'noseSneerRight',

  // Cheek shapes
  'cheekSquintLeft',
  'cheekSquintRight',

  // Tongue shapes
  'tongueOut',
] as const;

/** Emotion to blend shape mappings */
export const ACE_EMOTION_BLENDSHAPES: Partial<Record<ACEEmotion, Record<string, number>>> = {
  neutral: {
    'mouthClose': 0.5,
    'jawOpen': 0,
  },
  happy: {
    'mouthSmileLeft': 0.8,
    'mouthSmileRight': 0.8,
    'eyeSquintLeft': 0.3,
    'eyeSquintRight': 0.3,
  },
  sad: {
    'mouthFrownLeft': 0.5,
    'mouthFrownRight': 0.5,
    'browOuterUpLeft': 0.2,
    'browOuterUpRight': 0.2,
  },
  angry: {
    'browDownLeft': 0.5,
    'browDownRight': 0.5,
    'mouthFrownLeft': 0.3,
    'mouthFrownRight': 0.3,
    'eyeSquintLeft': 0.4,
    'eyeSquintRight': 0.4,
  },
  surprised: {
    'jawOpen': 0.6,
    'mouthStretchLeft': 0.3,
    'mouthStretchRight': 0.3,
    'eyeWideLeft': 0.8,
    'eyeWideRight': 0.8,
    'browInnerUp': 0.5,
  },
  confused: {
    'browInnerUp': 0.4,
    'browOuterUpLeft': 0.3,
    'browOuterUpRight': 0.3,
    'mouthClose': 0.8,
    'eyeSquintLeft': 0.2,
  },
  thinking: {
    'browInnerUp': 0.5,
    'eyeSquintLeft': 0.3,
    'eyeSquintRight': 0.3,
    'mouthClose': 0.9,
  },
  excited: {
    'jawOpen': 0.3,
    'mouthSmileLeft': 1.0,
    'mouthSmileRight': 1.0,
    'eyeWideLeft': 0.5,
    'eyeWideRight': 0.5,
  },
  concerned: {
    'browInnerUp': 0.3,
    'browOuterUpLeft': 0.4,
    'browOuterUpRight': 0.4,
    'mouthFrownLeft': 0.2,
    'mouthFrownRight': 0.2,
  },
  encouraging: {
    'mouthSmileLeft': 0.6,
    'mouthSmileRight': 0.6,
    'browOuterUpLeft': 0.2,
    'browOuterUpRight': 0.2,
  },
};

// ============================================================================
// Errors
// ============================================================================

/**
 * Base error class for ACE-related errors
 */
export class ACEError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ACEError';
  }
}

/**
 * Error thrown when agent configuration is invalid
 */
export class ACEConfigError extends ACEError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ACEConfigError';
  }
}

/**
 * Error thrown when agent is not found
 */
export class ACEAgentNotFoundError extends ACEError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND', { agentId });
    this.name = 'ACEAgentNotFoundError';
  }
}

/**
 * Error thrown when session is not found or expired
 */
export class ACESessionNotFoundError extends ACEError {
  constructor(sessionId: string) {
    super(`Session not found or expired: ${sessionId}`, 'SESSION_NOT_FOUND', { sessionId });
    this.name = 'ACESessionNotFoundError';
  }
}

/**
 * Error thrown when ACE API call fails
 */
export class ACEAPIError extends ACEError {
  constructor(
    message: string,
    public statusCode: number,
    details?: unknown
  ) {
    super(message, 'API_ERROR', details);
    this.name = 'ACEAPIError';
  }
}

// ============================================================================
// ACE Client Class
// ============================================================================

/**
 * NVIDIA ACE Agent Client
 *
 * Handles communication with NVIDIA ACE services for digital human interactions.
 * Supports text and audio input, TTS output, and facial animation generation.
 */
export class ACEClient {
  private sessions: Map<string, ACEAgentSession> = new Map();
  private agents: Map<string, ACEAgentConfig> = new Map();

  /**
   * Create a new ACE client
   *
   * @param config - Client configuration
   */
  constructor(private config: {
    /** NVIDIA API key for authentication */
    apiKey: string;

    /** Base URL for ACE API (default: NVIDIA production) */
    baseUrl?: string;

    /** Request timeout in milliseconds */
    timeout?: number;

    /** Enable debug logging */
    debug?: boolean;
  }) {
    this.config.baseUrl = config.baseUrl || 'https://api.nvcf.nvidia.com/v2/nvc';
    this.config.timeout = config.timeout || 30000;
  }

  /**
   * Register an agent configuration
   *
   * @param config - Agent configuration to register
   * @returns The registered agent ID
   * @throws {ACEConfigError} If configuration is invalid
   */
  registerAgent(config: ACEAgentConfig): string {
    this.validateAgentConfig(config);

    this.agents.set(config.agentId, {
      ...config,
      systemPrompt: config.systemPrompt || ACE_PERSONALITY_PROMPTS[config.personality],
      maxTokens: config.maxTokens || ACE_DEFAULTS.MAX_TOKENS,
      temperature: config.temperature || ACE_DEFAULTS.TEMPERATURE,
      voiceSpeed: config.voiceSpeed || ACE_DEFAULTS.VOICE_SPEED,
    });

    return config.agentId;
  }

  /**
   * Get an agent configuration by ID
   *
   * @param agentId - Agent identifier
   * @returns Agent configuration or undefined if not found
   */
  getAgent(agentId: string): ACEAgentConfig | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all registered agents
   *
   * @returns Array of agent configurations
   */
  listAgents(): ACEAgentConfig[] {
    return Array.from(this.agents.values());
  }

  /**
   * Unregister an agent
   *
   * @param agentId - Agent identifier
   * @returns True if agent was removed, false if not found
   */
  unregisterAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Create a new session with an agent
   *
   * @param agentId - Agent to create session with
   * @param userId - User identifier
   * @returns New session ID
   * @throws {ACEAgentNotFoundError} If agent is not found
   */
  createSession(agentId: string, userId: string): string {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new ACEAgentNotFoundError(agentId);
    }

    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const session: ACEAgentSession = {
      sessionId,
      agentId,
      userId,
      startedAt: now,
      lastActivity: now,
      messages: [],
      state: 'active',
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /**
   * Get a session by ID
   *
   * @param sessionId - Session identifier
   * @returns Session or undefined if not found
   */
  getSession(sessionId: string): ACEAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Validate a session and update its activity timestamp
   *
   * @param sessionId - Session identifier
   * @returns Valid session or throws error
   * @throws {ACESessionNotFoundError} If session is not found or expired
   */
  private validateSession(sessionId: string): ACEAgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new ACESessionNotFoundError(sessionId);
    }

    const now = Date.now();
    if (now - session.lastActivity > ACE_DEFAULTS.SESSION_TIMEOUT_MS) {
      this.sessions.delete(sessionId);
      throw new ACESessionNotFoundError(sessionId);
    }

    // Update activity timestamp
    session.lastActivity = now;
    return session;
  }

  /**
   * End a session
   *
   * @param sessionId - Session identifier
   * @returns True if session was ended, false if not found
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = 'ended';
      // Keep session in history but mark as ended
      return true;
    }
    return false;
  }

  /**
   * Clean up expired sessions
   *
   * Removes sessions that have been idle longer than the idle timeout.
   *
   * @returns Number of sessions cleaned up
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (
        session.state === 'ended' ||
        now - session.lastActivity > ACE_DEFAULTS.SESSION_TIMEOUT_MS
      ) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Interact with an ACE agent
   *
   * Processes user input (text or audio) and returns the agent's response
   * with optional facial animation and audio data.
   *
   * @param request - Interaction request
   * @returns Agent interaction response
   * @throws {ACEAgentNotFoundError} If agent is not found
   * @throws {ACESessionNotFoundError} If session is invalid
   */
  async interact(request: ACEInteractionRequest): Promise<ACEInteraction> {
    const startTime = Date.now();
    const agent = this.agents.get(request.agentId);
    if (!agent) {
      throw new ACEAgentNotFoundError(request.agentId);
    }

    // Get or create session
    let session: ACEAgentSession | undefined;
    if (request.sessionId) {
      session = this.validateSession(request.sessionId);
    } else if (request.userId) {
      const sessionId = this.createSession(request.agentId, request.userId);
      session = this.sessions.get(sessionId);
    }

    // Get user input (prefer audio transcription if available)
    const userInput = request.input || '';

    // Add user message to session
    if (session) {
      session.messages.push({
        role: 'user',
        content: userInput,
        timestamp: Date.now(),
        emotion: request.emotion,
      });

      // Enforce message limit
      if (session.messages.length > ACE_DEFAULTS.MAX_SESSION_MESSAGES) {
        session.messages = session.messages.slice(-ACE_DEFAULTS.MAX_SESSION_MESSAGES);
      }
    }

    // Build messages for LLM
    const messages = session ? [...session.messages] : [{ role: 'user', content: userInput, timestamp: Date.now() }];

    // Determine emotion for response
    const targetEmotion = request.emotion || agent.defaultEmotion || ACE_PERSONALITY_EMOTIONS[agent.personality];

    // Generate response (this would call NVIDIA ACE API in production)
    const response = await this.generateACEResponse(agent, messages, targetEmotion);

    // Add assistant message to session
    if (session) {
      session.messages.push({
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        emotion: response.emotion,
      });
    }

    return {
      ...response,
      agentId: request.agentId,
      processingTimeMs: Date.now() - startTime,
      timestamp: Date.now(),
    };
  }

  /**
   * Stream audio for Audio2Face animation
   *
   * Sends audio chunks to the Audio2Face microservice for real-time
   * facial animation generation.
   *
   * @param agentId - Agent identifier
   * @param request - Audio streaming request
   * @returns Streaming response with animation frames
   */
  async streamAudio(
    agentId: string,
    request: Audio2FaceStreamRequest
  ): Promise<Audio2FaceStreamResponse> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new ACEAgentNotFoundError(agentId);
    }

    // Check if facial animation is enabled
    if (!agent.capabilities.includes('facial-animation')) {
      throw new ACEConfigError(
        `Agent ${agentId} does not have facial-animation capability enabled`
      );
    }

    const startTime = Date.now();

    // Generate animation frames from audio
    // In production, this would call NVIDIA Audio2Face NIM microservice
    const frames = await this.generateAnimationFromAudio(
      request.audioChunk,
      request.sampleRate,
      request.emotion
    );

    return {
      chunkIndex: request.chunkIndex,
      frames,
      duration: request.audioChunk.byteLength / (request.sampleRate * 2), // Rough estimate
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Validate agent configuration
   *
   * @param config - Configuration to validate
   * @throws {ACEConfigError} If configuration is invalid
   */
  private validateAgentConfig(config: ACEAgentConfig): void {
    if (!config.agentId || config.agentId.trim() === '') {
      throw new ACEConfigError('agentId is required and cannot be empty');
    }

    const validPersonalities: ACEAgentPersonality[] = ['tutor', 'captain', 'teacher', 'builder'];
    if (!validPersonalities.includes(config.personality)) {
      throw new ACEConfigError(
        `Invalid personality: ${config.personality}. Must be one of: ${validPersonalities.join(', ')}`
      );
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      throw new ACEConfigError('temperature must be between 0 and 1');
    }

    if (config.voiceSpeed !== undefined && (config.voiceSpeed < 0.5 || config.voiceSpeed > 2)) {
      throw new ACEConfigError('voiceSpeed must be between 0.5 and 2');
    }
  }

  /**
   * Generate ACE response from LLM
   *
   * In production, this would call NVIDIA ACE API for:
   * - NeMo LLM for text generation
   * - Riva TTS for speech synthesis
   * - Audio2Face for facial animation
   *
   * @param agent - Agent configuration
   * @param messages - Conversation messages
   * @param emotion - Target emotion
   * @returns ACE interaction response
   */
  private async generateACEResponse(
    agent: ACEAgentConfig,
    messages: Array<{ role: string; content: string }>,
    emotion: ACEEmotion
  ): Promise<Omit<ACEInteraction, 'agentId' | 'processingTimeMs' | 'timestamp'>> {
    // In a real implementation, this would:
    // 1. Call NVIDIA NeMo LLM for text generation
    // 2. Call Riva TTS for speech synthesis
    // 3. Call Audio2Face for facial animation data

    // For now, return a mock response
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const userText = lastUserMessage?.content || '';

    // Simple response generation based on personality
    let responseText = this.generateMockResponse(agent.personality, userText);

    // Generate emotion blend shapes if capability is enabled
    const blendShapes = agent.capabilities.includes('emotion-rendering')
      ? ACE_EMOTION_BLENDSHAPES[emotion] || ACE_EMOTION_BLENDSHAPES.neutral
      : undefined;

    // Generate audio URL if TTS is enabled
    const audioUrl = agent.capabilities.includes('lip-sync')
      ? `https://tts.nvidia.com/v1/audio/${agent.agentId}/${Date.now()}` // Mock URL
      : undefined;

    return {
      text: responseText,
      audioUrl,
      audioDuration: audioUrl ? responseText.length * 0.05 : undefined, // Rough estimate
      blendShapes,
      animationTimeline: blendShapes ? this.generateMockAnimationTimeline(blendShapes) : undefined,
      emotion,
    };
  }

  /**
   * Generate mock animation timeline from blend shapes
   *
   * @param baseBlendShapes - Base blend shape values
   * @returns Array of animation frames
   */
  private generateMockAnimationTimeline(
    baseBlendShapes: Record<string, number>
  ): ACEAnimationFrame[] {
    // Generate a simple animation timeline with lip sync approximation
    const frames: ACEAnimationFrame[] = [];
    const numFrames = 30; // ~1 second at 30fps

    for (let i = 0; i < numFrames; i++) {
      const time = i / 30;
      const jawOpen = Math.sin(time * Math.PI * 4) * 0.3 + (baseBlendShapes.jawOpen || 0);

      frames.push({
        time,
        blendShapes: {
          ...baseBlendShapes,
          jawOpen: Math.max(0, jawOpen),
          // Add subtle variation
          mouthSmileLeft: (baseBlendShapes.mouthSmileLeft || 0) * (0.9 + Math.random() * 0.2),
          mouthSmileRight: (baseBlendShapes.mouthSmileRight || 0) * (0.9 + Math.random() * 0.2),
        },
        headRotation: {
          x: Math.sin(time * 0.5) * 2,
          y: Math.cos(time * 0.3) * 3,
          z: Math.sin(time * 0.7) * 1,
        },
      });
    }

    return frames;
  }

  /**
   * Generate mock response based on personality
   *
   * @param personality - Agent personality
   * @param input - User input
   * @returns Generated response text
   */
  private generateMockResponse(personality: ACEAgentPersonality, input: string): string {
    const responses: Record<ACEAgentPersonality, string[]> = {
      tutor: [
        "Let me break that down into smaller steps to make it easier to understand.",
        "Great question! Let's explore this concept together.",
        "I'll guide you through this step by step.",
      ],
      captain: [
        "Excellent progress! Let's move on to the next challenge.",
        "I've updated your learning objectives. Here's what's next.",
        "Let's coordinate our approach to tackle this topic.",
      ],
      teacher: [
        "Here's a comprehensive explanation of this topic.",
        "Let me demonstrate how this works with a clear example.",
        "The key concept here is...",
      ],
      builder: [
        "I'll help you implement this. Let's look at the code structure.",
        "Here's the technical approach for this challenge.",
        "Let's review the code and identify the improvements needed.",
      ],
    };

    const personalityResponses = responses[personality];
    return personalityResponses[Math.floor(Math.random() * personalityResponses.length)];
  }

  /**
   * Generate animation frames from audio data
   *
   * In production, this would call NVIDIA Audio2Face NIM microservice.
   *
   * @param audioData - Audio data
   * @param sampleRate - Audio sample rate
   * @param emotion - Target emotion
   * @returns Animation frames
   */
  private async generateAnimationFromAudio(
    audioData: ArrayBuffer,
    sampleRate: number,
    emotion?: ACEEmotion
  ): Promise<ACEAnimationFrame[]> {
    // Mock implementation - in production would call Audio2Face NIM
    const duration = audioData.byteLength / (sampleRate * 2);
    const numFrames = Math.floor(duration * 30); // 30fps

    const frames: ACEAnimationFrame[] = [];
    for (let i = 0; i < numFrames; i++) {
      frames.push({
        time: i / 30,
        blendShapes: {
          jawOpen: Math.random() * 0.5,
          mouthClose: 1 - Math.random() * 0.5,
        },
      });
    }

    return frames;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a default ACE agent configuration
 *
 * @param agentId - Unique agent identifier
 * @param personality - Agent personality type
 * @returns Default agent configuration
 */
export function createDefaultAgentConfig(
  agentId: string,
  personality: ACEAgentPersonality
): ACEAgentConfig {
  return {
    agentId,
    personality,
    voiceModel: 'us-female-1',
    avatarModel: personality === 'captain' ? 'studylog-captain-1' : 'studylog-tutor-1',
    capabilities: ACE_PERSONALITY_CAPABILITIES[personality],
    defaultEmotion: ACE_PERSONALITY_EMOTIONS[personality],
  };
}

/**
 * Convert emotion string to ACEEmotion type
 *
 * @param emotion - Emotion string
 * @returns ACEEmotion or undefined if invalid
 */
export function parseEmotion(emotion: string): ACEEmotion | undefined {
  const validEmotions: ACEEmotion[] = [
    'neutral', 'happy', 'sad', 'angry', 'surprised',
    'confused', 'thinking', 'excited', 'concerned', 'encouraging'
  ];
  return validEmotions.includes(emotion as ACEEmotion) ? emotion as ACEEmotion : undefined;
}

/**
 * Get blend shapes for an emotion
 *
 * @param emotion - Emotion type
 * @param intensity - Blend intensity (0-1)
 * @returns Blend shape values
 */
export function getEmotionBlendShapes(
  emotion: ACEEmotion,
  intensity = 1.0
): Record<string, number> {
  const baseShapes = ACE_EMOTION_BLENDSHAPES[emotion] || ACE_EMOTION_BLENDSHAPES.neutral || {};

  const scaledShapes: Record<string, number> = {};
  for (const [shape, value] of Object.entries(baseShapes)) {
    scaledShapes[shape] = value * intensity;
  }

  return scaledShapes;
}
