/**
 * StudyLoG.AI - G-Assist Common Types
 *
 * G-Assist provides voice-enabled AI chatbot with first-mile routing
 * to direct queries to the appropriate AI agent.
 */

// Widget constants
export const GAssistWidget = {
  ID: 'si-gassist:widget',
  LABEL: 'G-Assist',
  ICON_CLASS: 'fa fa-microphone',
} as const;

// Agent types that G-Assist can route to
export type GAssistAgent = 'captain' | 'teacher' | 'builder' | 'tester' | 'director';

// Speech-to-Text result
export interface STTResult {
  text: string;
  confidence: number;
  alternatives: string[];
  processingTime: number;
  provider: 'local' | 'cloudflare' | 'google';
}

// Text-to-Speech result
export interface TTSResult {
  audioUrl: string;
  duration: number;
  provider: 'web-speech' | 'piper' | 'elevenlabs';
}

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  agent?: GAssistAgent;
}

// Route decision from first-mile router
export interface RouteDecision {
  agent: GAssistAgent;
  confidence: number;
  reasoning: string;
  suggestedPrompt?: string;
}

// G-Assist configuration
export interface GAssistConfig {
  sttProvider: 'local' | 'cloudflare' | 'google';
  ttsProvider: 'web-speech' | 'piper' | 'elevenlabs' | 'none';
  autoRoute: boolean;
  voiceActivation: boolean;
}

// IDE context for routing decisions
export interface IDEContext {
  activeModule?: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  activePanel?: string;
  openFiles: string[];
  currentSelection?: {
    file: string;
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

// Agent information for display
export const AGENT_INFO: Record<GAssistAgent, {
  name: string;
  description: string;
  icon: string;
}> = {
  captain: {
    name: 'Captain',
    description: 'Game simulation and NPC behavior',
    icon: 'fa fa-anchor',
  },
  teacher: {
    name: 'Teacher',
    description: 'Explanations, hints, and tutoring',
    icon: 'fa fa-graduation-cap',
  },
  builder: {
    name: 'Builder',
    description: 'Code generation and review',
    icon: 'fa fa-hammer',
  },
  tester: {
    name: 'Tester',
    description: 'Verification and error analysis',
    icon: 'fa fa-check-circle',
  },
  director: {
    name: 'Director',
    description: 'Orchestration and meta-questions',
    icon: 'fa fa-sitemap',
  },
};

// API endpoints
export const API_ENDPOINTS = {
  STT: '/api/v1/g-assist/stt',
  TTS: '/api/v1/g-assist/tts',
  ROUTE: '/api/v1/g-assist/route',
  CHAT: '/api/v1/g-assist/chat',
  CONVERSATIONS: '/api/v1/g-assist/conversations',
} as const;

// ============================================================================
// Conversation Persistence Types
// ============================================================================

/**
 * Summary representation of a conversation for list views.
 * Excludes the full messages array for lighter payloads.
 */
export interface ConversationSummary {
  id: string;
  title: string;
  agent: GAssistAgent;
  messageCount: number;
  updatedAt: number;
  createdAt: number;
}

/**
 * Full conversation details with all messages.
 */
export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
  context?: IDEContext;
}

/**
 * Request to create or update a conversation.
 *
 * The upsert pattern allows a single API call to handle both:
 * - Creating new conversations (when id is omitted)
 * - Updating existing conversations (when id is provided)
 *
 * Auto-save happens after each message is sent/received.
 */
export interface ConversationUpsertRequest {
  id?: string;                    // Omit for auto-generated UUID
  userId: string;                 // User identifier (student_id or OAuth ID)
  agent: GAssistAgent;            // Agent handling this conversation
  title?: string;                 // Optional title (auto-generated if omitted)
  messages: ChatMessage[];        // Full message history
  context?: IDEContext;           // IDE context when conversation started
}

/**
 * Response from conversation upsert operation.
 */
export interface ConversationUpsertResponse {
  conversationId: string;
  updatedAt: number;
  title?: string;  // Returns generated title if not provided
}

/**
 * Response for listing user's conversations.
 */
export interface ConversationsListResponse {
  conversations: ConversationSummary[];
}

// Audio configuration
export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channelCount: 1,
  bitDepth: 16,
  mimeTypes: [
    'audio/webm',
    'audio/ogg',
    'audio/wav',
  ],
} as const;
