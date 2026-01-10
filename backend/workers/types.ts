/**
 * StudyLoG.AI Backend - Type Definitions
 */

// Cloudflare bindings
export interface Env {
  // D1 Database
  STUDENT_STATE: D1Database;

  // Vectorize
  PUZZLE_INDEX: VectorizeIndex;

  // R2 Storage
  PROJECT_STORAGE: R2Bucket;
  ASSET_STORAGE: R2Bucket;

  // KV Namespaces
  SESSION_CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;

  // Workers AI
  AI: Ai;

  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  MAX_TOKENS_PER_REQUEST: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW: string;

  // Secrets
  ANTHROPIC_API_KEY?: string;
  OLLAMA_ENDPOINT?: string;
  JWT_SECRET?: string;
}

// Student types
export interface Student {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  tier: 'free' | 'forge' | 'studio' | 'lab';
}

export interface StudentProgress {
  studentId: string;
  module: 'cognitive-mill' | 'sitka-sound' | 'intelligence-ranch';
  stage: number;
  xp: number;
  achievements: string[];
  lastActivity: string;
}

export interface LearnerPhase {
  phase: 'player' | 'reader' | 'tweaker' | 'creator' | 'mentor';
  unlockedAt: string;
  completedChallenges: number;
}

// Game state types
export interface GameState {
  sessionId: string;
  studentId: string;
  module: string;
  scene: string;
  state: Record<string, unknown>;
  timestamp: string;
}

// AI types
export interface AIRequest {
  prompt: string;
  context?: string;
  maxTokens?: number;
  temperature?: number;
  preferLocal?: boolean;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: 'cloudflare' | 'ollama' | 'anthropic';
  tokens: {
    input: number;
    output: number;
  };
  latencyMs: number;
}

// API response types
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    latencyMs: number;
  };
}

// Route handler types
export type RouteHandler = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  params: Record<string, string>
) => Promise<Response>;

// Vectorize types
export interface PuzzleVector {
  id: string;
  module: string;
  difficulty: number;
  tags: string[];
  embedding: number[];
}
