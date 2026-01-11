# SuperInstance.AI - Unified API Reference

**Version:** 1.0.0
**Last Updated:** 2026-01-10
**Base URL:** `https://api.studylog.ai` (production) / `https://dev-api.studylog.ai` (development)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Response Format](#common-response-format)
3. [Error Codes](#error-codes)
4. [Rate Limits](#rate-limits)
5. [Asset Generation APIs](#asset-generation-apis)
   - [3D Asset API](#3d-asset-api)
   - [Audio & Voice API](#audio--voice-api)
   - [2D Asset API](#2d-asset-api)
   - [Asset Regeneration API](#asset-regeneration-api)
   - [Image Cascade API](#image-cascade-api)
6. [AI & Agent APIs](#ai--agent-apis)
   - [Multi-Model Router API](#multi-model-router-api)
   - [First-Mile Router API](#first-mile-router-api)
   - [G-Assist API](#g-assist-api)
   - [DMLog Agents API](#dmlog-agents-api)
   - [Memory System API](#memory-system-api)
   - [Escalation Engine API](#escalation-engine-api)
7. [Quality & Engine APIs](#quality--engine-apis)
   - [Quality Scaling API](#quality-scaling-api)
   - [Engine Abstraction API](#engine-abstraction-api)
   - [OpenRTS Integration API](#openrts-integration-api)
   - [Godot Physics API](#godot-physics-api)
   - [Godot Integration API](#godot-integration-api)
8. [Simulation APIs](#simulation-apis)
   - [Ranch Simulation API](#ranch-simulation-api)
   - [Fishing Simulation API](#fishing-simulation-api)
   - [Being State API](#being-state-api)
   - [Voxel AI API](#voxel-ai-api)
9. [Collaboration APIs](#collaboration-apis)
   - [CRDT Sync API](#crdt-sync-api)
   - [Cross-Product Memory API](#cross-product-memory-api)
   - [Realtime API](#realtime-api)
   - [Vibe Chat API](#vibe-chat-api)
10. [Core Backend APIs](#core-backend-apis)
    - [Authentication API](#authentication-api)
    - [Student API](#student-api)
    - [Game State API](#game-state-api)
    - [Asset Management API](#asset-management-api)
    - [Bazaar API](#bazaar-api)
11. [WebSocket Protocols](#websocket-protocols)
12. [Common Patterns](#common-patterns)
13. [SDK Examples](#sdk-examples)
14. [Data Models](#data-models)
15. [Webhooks](#webhooks)
16. [Testing & Mocking](#testing--mocking)

---

## Authentication

All API endpoints (except authentication endpoints) require a valid JWT token.

### Header Format

```
Authorization: Bearer <token>
```

### Token Structure

Tokens are JSON Web Tokens (JWT) with the following claims:

```typescript
interface JWTClaims {
  user_id: string;      // Student/user unique identifier
  jti: string;          // Token unique identifier (for revocation)
  roles: string[];      // Array of user roles (e.g., ['student', 'premium'])
  tier: string;         // User tier: 'free' | 'forge' | 'studio' | 'lab'
  exp: number;          // Expiration timestamp (Unix timestamp)
  nbf: number;          // Not-before timestamp (Unix timestamp)
  iat: number;          // Issued at timestamp
}
```

### Token Creation Flow

1. User registers or logs in via `/auth/register` or `/auth/login`
2. Server validates credentials
3. Server creates JWT with HMAC-SHA256 signing
4. Token is returned in response body
5. Client includes token in `Authorization` header for subsequent requests

### Token Verification

The server verifies tokens using the following checks:

1. **Signature Verification**: HMAC-SHA256 with JWT_SECRET
2. **Expiration Check**: Current time must be before `exp` (60-second clock skew tolerance)
3. **Not-Before Check**: Current time must be after `nbf`
4. **Revocation Check**: Token ID (`jti`) checked against KV cache for revocation
5. **Claims Validation**: Required claims present and valid

### Token Revocation

Tokens can be revoked:
- User-initiated logout
- Security incidents (password compromise)
- Admin actions (account suspension)

Revoked tokens are stored in KV with TTL matching token expiration.

### Example Request

```bash
curl -X GET https://api.studylog.ai/student/progress \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTIzIiwianRpIjoiNDU2IiwidGllciI6ImZyZWUiLCJleHAiOjE3MDQ5NjAwMDAsIm5iZiI6MTcwNDg3MzYwMH0.signature"
```

### Token Lifecycle

```
Registration/Login → Token Created → Token Used → Token Expires
                      ↓                           ↓
                 Token Stored               Refresh Token
                 in KV Cache              (Optional)
                      ↓
                 Token Revoked
                 (Logout/Admin)
```

---

## Common Response Format

All API responses follow a consistent structure for easy parsing.

### Standard Response Interface

```typescript
interface APIResponse<T = unknown> {
  success: boolean;           // Whether the request succeeded
  data?: T;                   // Response payload (on success)
  error?: {
    code: string;             // Machine-readable error code
    message: string;          // Human-readable error message
    details?: unknown;        // Additional error details
  };
  meta?: {
    requestId: string;        // Unique request identifier for debugging
    timestamp: string;        // ISO 8601 timestamp of response
    latencyMs: number;        // Request processing time in milliseconds
  };
}
```

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Example Model",
    "provider": "meshy",
    "status": "completed"
  },
  "meta": {
    "requestId": "req_1234567890",
    "timestamp": "2026-01-10T12:00:00.000Z",
    "latencyMs": 45
  }
}
```

### Error Response Example

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token has expired. Please log in again.",
    "details": {
      "expiredAt": "2026-01-10T11:59:00.000Z",
      "currentTime": "2026-01-10T12:00:30.000Z"
    }
  },
  "meta": {
    "requestId": "req_0987654321",
    "timestamp": "2026-01-10T12:00:30.000Z",
    "latencyMs": 12
  }
}
```

### Streaming Response Format

For streaming endpoints (SSE), each event is formatted as:

```
data: {"type": "chunk", "content": "Hello"}
data: {"type": "chunk", "content": " world"}
data: {"type": "done", "usage": {"tokens": 5}}
```

---

## Error Codes

All errors return a machine-readable code and human-readable message.

### Standard Error Codes

| Code | HTTP Status | Description | Retry |
|------|-------------|-------------|-------|
| `NO_TOKEN` | 401 | Authorization header missing | No |
| `INVALID_TOKEN` | 401 | Token malformed, signature invalid, or expired | No |
| `REVOKED_TOKEN` | 401 | Token has been revoked | No |
| `MISSING_SECRET` | 500 | Server configuration error (JWT_SECRET not set) | No |
| `INVALID_INPUT` | 400 | Request body validation failed | No |
| `MISSING_FIELD` | 400 | Required field missing from request | No |
| `NOT_FOUND` | 404 | Resource not found | No |
| `ALREADY_EXISTS` | 409 | Resource already exists | No |
| `RATE_LIMITED` | 429 | Too many requests | Yes |
| `INTERNAL_ERROR` | 500 | Internal server error | Yes |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Yes |
| `TIMEOUT` | 504 | Request timeout | Yes |

### Auth-Specific Errors

| Code | Description |
|------|-------------|
| `INVALID_EMAIL` | Email format is invalid |
| `WEAK_PASSWORD` | Password does not meet requirements (min 8 characters) |
| `EMAIL_EXISTS` | Email already registered |
| `INVALID_CREDENTIALS` | Email or password is incorrect |
| `ACCOUNT_LOCKED` | Account has been locked due to suspicious activity |
| `EMAIL_NOT_VERIFIED` | Email address has not been verified |

### Asset Generation Errors

| Code | Description |
|------|-------------|
| `PROVIDER_UNAVAILABLE` | Selected provider is currently unavailable |
| `GENERATION_FAILED` | Asset generation failed |
| `INSUFFICIENT_CREDITS` | Not enough credits for this operation |
| `UNSUPPORTED_FORMAT` | Requested format is not supported |
| `CONTENT_POLICY_VIOLATION` | Content violates policy guidelines |

### Rate Limit Errors

| Code | Description | Headers |
|------|-------------|---------|
| `RATE_LIMITED` | Rate limit exceeded | `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` |

### Error Response Handling

```typescript
async function handleResponse(response: Response) {
  const data = await response.json();

  if (!response.ok) {
    switch (data.error?.code) {
      case 'INVALID_TOKEN':
        // Redirect to login
        break;
      case 'RATE_LIMITED':
        // Wait and retry
        const retryAfter = response.headers.get('Retry-After');
        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
        break;
      case 'INSUFFICIENT_CREDITS':
        // Show upgrade prompt
        break;
      default:
        // Show error message
        console.error(data.error.message);
    }
  }

  return data;
}
```

---

## Rate Limits

Rate limits are enforced per-user using KV storage.

### Rate Limit Tiers

| User Tier | Requests | Window | Burst Allowance |
|-----------|----------|--------|-----------------|
| Free | 100 | 60 seconds | 10 |
| Forge | 500 | 60 seconds | 50 |
| Studio | 2000 | 60 seconds | 200 |
| Lab | 10000 | 60 seconds | 1000 |

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704883200
X-RateLimit-Reset-After: 45
Retry-After: 30
```

### Rate Limit Algorithm

Token bucket algorithm is used:
- Each user has a bucket of tokens
- Tokens refill at a constant rate
- Requests consume tokens
- When bucket is empty, requests are rejected

### Handling Rate Limits

```typescript
async function makeRequestWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000 * (i + 1);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

### Endpoint-Specific Limits

Some endpoints have additional rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/v1/chat/completions` | 20 | 60 seconds |
| `/asset-3d/generate/model` | 10 | 3600 seconds |
| `/asset-audio/tts/generate` | 50 | 60 seconds |
| `/images/generate` | 30 | 60 seconds |

---

## Asset Generation APIs

### 3D Asset API

**Base Path:** `/asset-3d`

Generate 3D models, environments, and scenes with intelligent provider routing.

#### Overview

The 3D Asset API provides a unified interface for generating 3D content across multiple providers. It automatically selects the optimal provider based on your request parameters and budget constraints.

#### Supported Providers

| Provider | Models Supported | Cost | Best For |
|----------|------------------|------|----------|
| `hunyuan` | Hunyuan3D-1.0 | $0.05-0.20 | Fast, cost-effective |
| `sloyd` | Sloyd CLI | $0.03-0.10 | Simple props |
| `masterpiece_x` | MasterPiece X | $0.08-0.30 | High-quality characters |
| `tripo` | Tripo SR | $0.10-0.40 | Single-image to 3D |
| `rodin` | Rodin Gen-1 | $0.15-0.50 | Photorealistic |
| `meshy` | Meshy V3 | $0.07-0.25 | Organic forms |

#### POST /asset-3d/generate/model

Generate a 3D model from text prompt.

**Authentication:** Required

**Request Body:**

```typescript
interface GenerateModelRequest {
  prompt: string;                    // Required: Text description of model
  style?: string;                    // Art style (e.g., "realistic", "cartoon", "low-poly")
  category?: string;                 // Model category: "character", "prop", "vehicle", "architecture"
  quality?: 'low' | 'medium' | 'high'; // Quality tier
  maxCostUsd?: number;               // Maximum cost in USD (default: 0.50)
  maxTimeSeconds?: number;           // Maximum generation time in seconds (default: 300)
  includeRigging?: boolean;          // Include skeletal rig for animation (default: false)
  includeAnimation?: boolean;        // Include animation data (default: false)
  textureResolution?: '512' | '1024' | '2048'; // Texture resolution
  polygonBudget?: number;            // Target polygon count
  preferredProviders?: AssetProvider[]; // Preferred providers (in order)
}
```

**Response:**

```typescript
interface GenerationResponse {
  success: boolean;
  assetId?: string;                  // Unique asset identifier
  provider?: AssetProvider;          // Provider used
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  modelUrl?: string;                 // Download URL (when completed)
  thumbnailUrl?: string;             // Thumbnail preview URL
  format?: string;                   // Model format (glb, obj, fbx)
  estimatedTime?: number;            // Estimated completion time in seconds
  progress?: number;                 // Progress percentage (0-100)
  costUsd?: number;                  // Actual cost in USD
  polygonCount?: number;             // Final polygon count
  metadata?: {
    vertices: number;
    triangles: number;
    materials: number;
    textures: number;
    animations: number;
  };
  error?: string;                    // Error message if failed
}
```

**Status Flow:**

```
pending → processing → completed
                  ↘ failed
```

**Example Request:**

```bash
curl -X POST https://api.studylog.ai/asset-3d/generate/model \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A medieval knight in shining armor holding a sword",
    "style": "realistic",
    "category": "character",
    "quality": "high",
    "includeRigging": true,
    "maxCostUsd": 0.50
  }'
```

**Example Response:**

```json
{
  "success": true,
  "assetId": "asset_abc123xyz",
  "provider": "masterpiece_x",
  "status": "processing",
  "estimatedTime": 120,
  "costUsd": 0.25,
  "meta": {
    "requestId": "req_123",
    "timestamp": "2026-01-10T12:00:00Z",
    "latencyMs": 45
  }
}
```

#### POST /asset-3d/generate/environment

Generate a complete 3D environment/scene.

**Authentication:** Required

**Request Body:**

```typescript
interface GenerateEnvironmentRequest {
  prompt: string;
  sceneType: 'interior' | 'exterior' | 'landscape' | 'dungeon' | 'cityscape';
  style?: string;
  quality?: 'low' | 'medium' | 'high';
  includeLighting?: boolean;        // Include pre-baked lighting (default: true)
  includeCollision?: boolean;       // Include collision meshes (default: true)
  gridSize?: number;                // Grid size for tile-based generation
  maxCostUsd?: number;
}
```

**Response:** Similar to model generation with additional scene-specific fields.

#### POST /asset-3d/generate/batch

Generate multiple models in batch.

**Authentication:** Required

**Request Body:**

```typescript
interface BatchGenerateRequest {
  requests: GenerateModelRequest[];
  parallel?: boolean;               // Execute in parallel (default: false)
  maxConcurrent?: number;           // Max parallel requests (default: 3)
  stopOnError?: boolean;            // Stop on first error (default: true)
}
```

**Response:**

```typescript
interface BatchGenerateResponse {
  success: boolean;
  data: {
    batchId: string;
    results: Array<GenerationResponse & { index: number }>;
    total: number;
    successful: number;
    failed: number;
    totalCostUsd: number;
    totalProcessingTimeMs: number;
  };
}
```

#### GET /asset-3d/status/:assetId/:provider

Check generation status for a specific asset.

**Authentication:** Not Required

**Parameters:**
- `assetId`: Asset identifier from generation response
- `provider`: Provider name

**Response:**

```typescript
interface StatusResponse {
  assetId: string;
  provider: AssetProvider;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;                // 0-100
  modelUrl?: string;                // Available when completed
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}
```

#### GET /asset-3d/asset/:assetId

Get full asset details including metadata.

**Authentication:** Required

**Response:**

```typescript
interface AssetDetails {
  id: string;
  provider: AssetProvider;
  prompt: string;
  status: string;
  modelUrl: string;
  thumbnailUrl: string;
  format: string;
  metadata: {
    vertices: number;
    triangles: number;
    materials: number;
    textures: string[];
    animations: string[];
    rig: boolean;
  };
  costUsd: number;
  createdAt: string;
}
```

#### POST /asset-3d/import/godot

Convert asset to Godot-compatible format.

**Authentication:** Required

**Request Body:**

```typescript
interface ImportToGodotRequest {
  assetId: string;
  importPath?: string;              // Custom Godot import path (default: res://assets/imported/{assetId}/)
  scale?: number;                   // Scale factor (default: 1.0)
  generateCollider?: boolean;       // Generate collision shapes (default: true)
  generateImportFiles?: boolean;    // Generate .import files (default: true)
  createScene?: boolean;            // Create scene file (default: true)
}
```

**Response:**

```typescript
interface GodotImportResponse {
  success: boolean;
  data: {
    assetId: string;
    importPath: string;
    scenePath: string;
    files: Array<{
      path: string;
      type: 'scene' | 'import' | 'script' | 'texture';
      size: number;
      content?: string;             // For text files
    }>;
    godotVersion: string;
    estimatedImportTimeMs: number;
  };
}
```

#### GET /asset-3d/assets

List user's generated assets.

**Authentication:** Required

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)
- `provider`: Filter by provider
- `status`: Filter by status
- `sortBy`: Sort field (created, cost, provider)
- `sortOrder`: asc or desc (default: desc)

**Response:**

```typescript
interface AssetListResponse {
  success: boolean;
  data: {
    assets: AssetDetails[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
  };
}
```

#### GET /asset-3d/providers/status

Check availability and status of all providers.

**Authentication:** Not Required

**Response:**

```typescript
interface ProviderStatusResponse {
  provider: AssetProvider;
  healthy: boolean;
  avgLatency: number;              // Average latency in ms
  errorRate: number;               // Error rate (0-1)
  queueSize: number;               // Current queue size
  capabilities: string[];          // Supported capabilities
  pricing: {
    minCost: number;
    maxCost: number;
    currency: string;
  };
}
```

#### GET /asset-3d/providers/capabilities

Get detailed capabilities for all providers.

**Authentication:** Not Required

**Response:**

```typescript
interface ProviderCapabilities {
  provider: AssetProvider;
  models: string[];
  supportedFormats: string[];       // glb, obj, fbx, etc.
  maxTextureResolution: number;
  maxPolygonCount: number;
  supportsRigging: boolean;
  supportsAnimation: boolean;
  supportsLighting: boolean;
  estimatedTimes: {
    low: number;                   // seconds
    medium: number;
    high: number;
  };
}
```

#### POST /asset-3d/costs/estimate

Estimate generation cost before committing.

**Authentication:** Not Required

**Request Body:**

```typescript
interface CostEstimateRequest {
  prompt: string;
  quality?: 'low' | 'medium' | 'high';
  includeRigging?: boolean;
  includeAnimation?: boolean;
  category?: string;
}
```

**Response:**

```typescript
interface CostEstimateResponse {
  success: true;
  data: {
    request: CostEstimateRequest;
    estimates: Array<{
      provider: AssetProvider;
      estimatedCost: number;
      estimatedTime: number;
      confidence: number;           // 0-1
      reasoning: string;
    }>;
    recommendedProvider: AssetProvider;
    currency: string;
  };
}
```

#### POST /asset-3d/validate

Validate a generation request without executing.

**Authentication:** Not Required

**Request Body:** Same as GenerateModelRequest

**Response:**

```typescript
interface ValidationResult {
  success: true;
  data: {
    valid: boolean;
    errors: string[];              // Validation errors
    warnings: string[];            // Validation warnings
    recommendedProvider: AssetProvider;
    costEstimates: Array<{
      provider: AssetProvider;
      cost: number;
    }>;
    capabilities: ProviderCapabilities[];
  };
}
```

---

### Audio & Voice API

**Base Path:** `/asset-audio`

Comprehensive audio/voice API with provider routing for TTS, STT, voice cloning, and Audio2Face.

#### Supported Providers

| Provider | Services | Quality | Cost/1k chars |
|----------|----------|---------|---------------|
| `elevenlabs` | TTS, Voice Clone, SFX | Premium | $0.30 |
| `ace` | Audio2Face | Premium | $0.50 |
| `whisper` | STT | High | $0.006 |
| `piper` | TTS | Good | Free |
| `coqui` | TTS, Voice Clone | Medium | $0.05 |

#### POST /asset-audio/tts/generate

Generate speech from text.

**Authentication:** Required

**Request Body:**

```typescript
interface TTSRequest {
  text: string;                    // Required: Text to synthesize
  voice?: string;                  // Voice ID or name (default: "Rachel")
  language?: Locale;               // Language code (default: "en-US")
  quality?: QualityTier;           // low, medium, high
  outputFormat?: 'mp3' | 'wav' | 'ogg' | 'pcm';
  speed?: number;                  // Playback speed 0.5-2.0 (default: 1.0)
  pitch?: number;                  // Pitch shift -12 to +12 semitones (default: 0)
  useCase?: AudioUseCase;          // dialogue, narration, assistant
  preferredProvider?: AudioProvider;
  enablePhonemes?: boolean;        // Return phoneme data (default: false)
  sampleRate?: number;             // Audio sample rate (default: 24000)
}
```

**Response:**

```typescript
interface TTSResponse {
  success: boolean;
  audioId?: string;
  audioUrl?: string;               // Presigned URL (valid for 1 hour)
  duration?: number;               // Audio duration in seconds
  sizeBytes?: number;
  provider?: AudioProvider;
  model?: string;
  costUsd?: number;
  processingTimeMs?: number;
  phonemes?: PhonemeData[];        // If enablePhonemes: true
  format?: string;
  sampleRate?: number;
  error?: string;
}

interface PhonemeData {
  phoneme: string;
  startTime: number;
  endTime: number;
}
```

**Example Request:**

```bash
curl -X POST https://api.studylog.ai/asset-audio/tts/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to StudyLoG.AI, your AI-powered learning companion. Let us explore the fascinating world of neural networks together.",
    "voice": "Rachel",
    "quality": "high",
    "speed": 1.0
  }'
```

#### POST /asset-audio/tts/generate/lipsync

Generate speech with lip-sync animation data for digital avatars.

**Authentication:** Required

**Request Body:** Same as TTSRequest (automatically sets enablePhonemes: true)

**Response:** TTSResponse with additional `animation` field:

```typescript
interface LipsyncResponse extends TTSResponse {
  animation?: {
    frames: Array<{
      timestamp: number;
      visemes: Record<string, number>;  // viseme weights
      blendShapes?: Record<string, number>;  // ARKit blend shapes
    }>;
    frameRate: number;            // Default: 60
    duration: number;
    visemeStandard: 'ovr' | 'oculus' | 'apple';
  };
}
```

**Viseme Standards:**

| Standard | Description | Visemes |
|----------|-------------|---------|
| `ovr` | Oculus LipSync | 15 visemes (sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, uh) |
| `oculus` | Oculus VR | Same as OVR |
| `apple` | ARKit Face Tracking | 52 blend shapes |

#### POST /asset-audio/tts/batch

Generate multiple speeches efficiently.

**Authentication:** Required

**Request Body:**

```typescript
interface BatchTTSRequest {
  requests: Array<{
    text: string;
    voice?: string;
    language?: Locale;
    speed?: number;
  }>;
  quality?: QualityTier;
  outputFormat?: 'mp3' | 'wav' | 'ogg';
  parallel?: boolean;             // Process in parallel (default: false)
}
```

**Response:**

```typescript
interface BatchTTSResponse {
  success: boolean;
  results: Array<TTSResponse & { index: number }>;
  successful: number;
  failed: number;
  totalCostUsd: number;
  totalProcessingTimeMs: number;
  totalDuration: number;
}
```

#### POST /asset-audio/stt/transcribe

Transcribe audio to text.

**Authentication:** Required

**Request Body:**

```typescript
interface STTRequest {
  audioUrl?: string;              // Public URL to audio file
  audioData?: string;             // Base64 encoded audio
  format?: 'wav' | 'mp3' | 'webm' | 'ogg' | 'flac';
  language?: Locale;              // Auto-detect if not specified
  enableTimestamps?: boolean;     // Include word-level timestamps
  enableDiarization?: boolean;    // Speaker identification
  numSpeakers?: number;           // Expected number of speakers (for diarization)
  enhanceAudio?: boolean;         // Apply audio enhancement
  preferredProvider?: AudioProvider;
}
```

**Response:**

```typescript
interface STTResponse {
  success: boolean;
  text?: string;                  // Full transcription
  segments?: Array<{
    text: string;
    startTime: number;
    endTime: number;
    speaker?: string;             // "SPEAKER_00", "SPEAKER_01", etc.
    confidence: number;           // 0-1
    words?: Array<{
      word: string;
      startTime: number;
      endTime: number;
      confidence: number;
    }>;
  }>;
  language?: string;              // Detected language
  duration?: number;              // Audio duration in seconds
  provider?: AudioProvider;
  model?: string;
  costUsd?: number;
  processingTimeMs?: number;
  error?: string;
}
```

**Language Codes:**

| Code | Language |
|------|----------|
| `en-US` | English (US) |
| `en-GB` | English (UK) |
| `es-ES` | Spanish |
| `fr-FR` | French |
| `de-DE` | German |
| `it-IT` | Italian |
| `pt-BR` | Portuguese (Brazil) |
| `ja-JP` | Japanese |
| `ko-KR` | Korean |
| `zh-CN` | Chinese (Simplified) |

#### POST /asset-audio/audio2face

Generate facial animation from audio for digital avatars.

**Authentication:** Required

**Request Body:**

```typescript
interface Audio2FaceRequest {
  audioUrl: string;
  visemeStandard?: 'ovr' | 'oculus' | 'apple';
  includeEyes?: boolean;          // Include eye blend shapes (default: true)
  includeHead?: boolean;          // Include head rotation (default: true)
  frameRate?: number;             // Target frame rate (default: 60)
  smoothing?: number;             // Smoothing factor 0-1 (default: 0.5)
}
```

**Response:**

```typescript
interface Audio2FaceResponse {
  success: boolean;
  animationId?: string;
  animationData?: {
    frames: Array<{
      timestamp: number;
      visemes: Record<string, number>;
      blendShapes?: Record<string, number>;
      headRotation?: [number, number, number];  // Euler angles
    }>;
    frameRate: number;
    duration: number;
    visemeStandard: string;
  };
  duration?: number;
  frameCount?: number;
  provider?: string;
  costUsd?: number;
  processingTimeMs?: number;
  error?: string;
}
```

#### POST /asset-audio/lipsync/text

Generate lip-sync animation from text (no audio output).

**Authentication:** Required

**Request Body:**

```typescript
interface LipsyncFromTextRequest {
  text: string;
  language?: Locale;              // Default: "en-US"
  visemeStandard?: 'ovr' | 'oculus' | 'apple';
  frameRate?: number;             // Default: 60
}
```

**Response:** Same as Audio2FaceResponse

#### POST /asset-audio/voice/clone

Clone a voice from audio sample.

**Authentication:** Required

**Request Body:**

```typescript
interface VoiceCloneRequest {
  name: string;
  description?: string;
  sampleUrl: string;              // Reference audio sample (10-60 seconds)
  sampleData?: string;            // Base64 encoded
  language?: Locale;
  enhanceQuality?: boolean;       // Enhance sample quality
  stability?: number;             // Stability 0-1 (default: 0.5)
  similarity?: number;            // Similarity to original 0-1 (default: 0.75)
}
```

**Response:**

```typescript
interface VoiceCloneResponse {
  success: boolean;
  voiceId?: string;
  voiceName?: string;
  status?: 'training' | 'ready' | 'failed';
  estimatedTime?: number;          // Training time in seconds
  samplesRequired?: number;        // Additional samples needed
  error?: string;
}
```

**Voice Cloning Requirements:**

| Provider | Min Duration | Max Duration | Format | Training Time |
|----------|--------------|--------------|--------|---------------|
| ElevenLabs | 10 seconds | 5 minutes | mp3, wav | ~2 minutes |
| Coqui | 30 seconds | 10 minutes | wav | ~5 minutes |

#### GET /asset-audio/voice/:voiceId

Get voice details.

**Authentication:** Required

**Response:**

```typescript
interface VoiceDetails {
  id: string;
  name: string;
  description?: string;
  language: Locale;
  gender: 'male' | 'female' | 'neutral';
  age?: 'young' | 'middle' | 'old';
  style?: string;
  provider: AudioProvider;
  previewUrl?: string;
  isCustom: boolean;
  createdAt: string;
}
```

#### GET /asset-audio/voices/list

List available voices.

**Authentication:** Not Required

**Query Parameters:**
- `language`: Filter by language (e.g., `en-US`)
- `provider`: Filter by provider
- `gender`: Filter by gender
- `custom`: Include custom voices (default: false)
- `limit`: Results per page (default: 50)

**Response:**

```typescript
interface VoiceListResponse {
  success: boolean;
  voices: VoiceDetails[];
  total: number;
  provider?: AudioProvider;
}
```

#### POST /asset-audio/sfx/generate

Generate sound effects.

**Authentication:** Required

**Request Body:**

```typescript
interface SoundEffectRequest {
  prompt: string;
  category?: 'ambient' | 'impact' | 'whoosh' | 'explosion' | 'footstep' | 'magic' | 'ui';
  duration?: number;               // Duration in seconds (default: 2)
  fadeIn?: number;                 // Fade in duration (default: 0.1)
  fadeOut?: number;                // Fade out duration (default: 0.1)
  format?: 'mp3' | 'wav';
}
```

**Response:**

```typescript
interface SoundEffectResponse {
  success: boolean;
  audioId?: string;
  audioUrl?: string;
  duration?: number;
  category?: string;
  costUsd?: number;
  error?: string;
}
```

#### POST /asset-audio/sfx/preset

Generate sound from preset.

**Authentication:** Required

**Request Body:**

```typescript
interface PresetSoundRequest {
  preset: string;                  // Preset name
  variations?: number;             // Number of variations (default: 1, max: 5)
}
```

**Available Presets:**

Ambient:
- `forest_ambient`, `ocean_waves`, `rain`, `wind`, `city_ambient`

Impact:
- `punch`, `sword_hit`, `arrow_impact`, `body_fall`

UI:
- `click`, `hover`, `notification`, `success`, `error`

Magic:
- `fireball`, `lightning`, `heal`, `teleport`

#### GET /asset-audio/sfx/library

Get sound effects library.

**Authentication:** Not Required

**Response:**

```typescript
interface SoundLibraryResponse {
  success: boolean;
  presets: Array<{
    name: string;
    category: string;
    description: string;
    duration: number;
    tags: string[];
  }>;
  byCategory: Record<string, string[]>;
  byTag: Record<string, string[]>;
}
```

#### GET /asset-audio/costs/estimate

Estimate audio generation cost.

**Authentication:** Not Required

**Request Body:**

```typescript
interface AudioCostEstimateRequest {
  operation: 'tts' | 'stt' | 'voice_clone' | 'audio2face';
  text?: string;                   // For TTS
  duration?: number;               // For STT/Audio2Face
  quality?: QualityTier;
  provider?: AudioProvider;
}
```

#### GET /asset-audio/providers/status

Get audio provider status.

**Authentication:** Not Required

**Response:**

```typescript
interface AudioProviderStatus {
  provider: AudioProvider;
  healthy: boolean;
  avgLatency: number;
  services: {
    tts: boolean;
    stt: boolean;
    voiceCloning: boolean;
    audio2face: boolean;
    soundEffects: boolean;
  };
}
```

#### GET /asset-audio/providers/capabilities

Get audio provider capabilities.

**Authentication:** Not Required

**Response:**

```typescript
interface AudioProviderCapabilities {
  provider: AudioProvider;
  languages: Locale[];
  formats: {
    input: string[];
    output: string[];
  };
  maxDuration: number;             // Maximum audio duration in seconds
  features: string[];
  pricing: {
    tts: number;                   // Cost per 1k characters
    stt: number;                   // Cost per minute
    voiceClone: number;            // One-time cost
    audio2face: number;            // Cost per minute
  };
}
```

---

### 2D Asset API

**Base Path:** `/asset-2d`

Generate 2D art, sprites, and textures.

#### POST /asset-2d/generate/sprite

Generate a 2D sprite with animation frames.

**Authentication:** Required

**Request Body:**

```typescript
interface SpriteGenerationRequest {
  prompt: string;
  style?: 'pixel' | 'vector' | 'hand-drawn' | 'painted' | 'flat';
  size?: '64x64' | '128x128' | '256x256' | '512x512' | '1024x1024';
  transparent?: boolean;           // Default: true
  animations?: string[];           // e.g., ['idle', 'walk', 'attack', 'death']
  frameCount?: number;             // Frames per animation (default: 4)
  frameRate?: number;              // FPS (default: 12)
  palette?: string[];              // Color palette (hex codes)
  side?: 'front' | 'side' | 'top' | 'isometric';
}
```

**Response:**

```typescript
interface SpriteGenerationResponse {
  success: boolean;
  spriteId?: string;
  spriteSheetUrl?: string;         // Combined sprite sheet
  frames?: Array<{
    animation: string;
    frame: number;
    url: string;
  }>;
  width: number;
  height: number;
  costUsd?: number;
}
```

#### POST /asset-2d/generate/texture

Generate a seamless texture.

**Authentication:** Required

**Request Body:**

```typescript
interface TextureGenerationRequest {
  prompt: string;
  type?: 'diffuse' | 'normal' | 'roughness' | 'metallic' | 'height' | 'ao';
  resolution?: '512x512' | '1024x1024' | '2048x2048' | '4096x4096';
  seamless?: boolean;              // Default: true
  tileable?: boolean;              // Default: true
  format?: 'png' | 'jpg' | 'exr';
}
```

#### POST /asset-2d/generate/icon

Generate UI icons.

**Authentication:** Required

**Request Body:**

```typescript
interface IconGenerationRequest {
  prompt: string;
  size?: '16x16' | '32x32' | '64x64' | '128x128' | '256x256';
  style?: 'flat' | 'outline' | 'filled' | 'gradient';
  color?: string;                  // Primary color (hex)
  background?: 'transparent' | 'solid' | 'gradient';
}
```

---

### Asset Regeneration API

**Base Path:** `/asset-regeneration`

Convert and upgrade assets between formats and quality levels.

#### POST /asset-regeneration/convert/voxel-to-mesh

Convert voxel model to mesh format.

**Authentication:** Required

**Request Body:**

```typescript
interface VoxelToMeshRequest {
  voxelData: {
    voxels: Array<{              // Voxel positions
      x: number;
      y: number;
      z: number;
      color?: string;            // RGB hex
    }>;
    size: {                      // Bounding box
      width: number;
      height: number;
      depth: number;
    };
  };
  meshFormat?: 'obj' | 'gltf' | 'glb' | 'fbx';
  optimization?: 'none' | 'basic' | 'simplify' | 'decimate';
  voxelSize?: number;             // Voxel to mesh scale factor
  generateUVs?: boolean;          // Generate UV coordinates
  generateNormals?: boolean;      // Generate normal maps
}
```

**Response:**

```typescript
interface VoxelToMeshResponse {
  success: boolean;
  meshUrl?: string;
  format?: string;
  vertexCount?: number;
  triangleCount?: number;
  originalVoxelCount?: number;
  reduction?: number;             // Percentage reduction
  error?: string;
}
```

#### POST /asset-regeneration/convert/mesh-to-voxel

Convert mesh model to voxel format.

**Authentication:** Required

**Request Body:**

```typescript
interface MeshToVoxelRequest {
  meshUrl: string;
  voxelSize?: number;             // Voxel grid resolution
  voxelFormat?: 'qubicle' | 'magica' | 'voxl';
  interiorVoxels?: boolean;       // Include interior voxels
}
```

#### POST /asset-regeneration/upscale

Upscale an asset to higher quality.

**Authentication:** Required

**Request Body:**

```typescript
interface UpscaleRequest {
  assetId: string;
  targetQuality: 'low' | 'medium' | 'high' | 'ultra';
  preserveDetails?: boolean;      // Preserve fine details
  sharpening?: number;            // Sharpening amount 0-1
}
```

#### POST /asset-regeneration/optimize

Optimize asset for real-time rendering.

**Authentication:** Required

**Request Body:**

```typescript
interface OptimizeRequest {
  assetId: string;
  targetPolygonCount?: number;
  targetTextureSize?: number;
  LOD?: number;                   // LOD level 0-3
}
```

---

### Image Cascade API

**Base Path:** `/images`

Cascade routing for image generation with quality tiers and prompt optimization.

#### POST /images/generate

Generate images with intelligent cascade routing.

**Authentication:** Required

**Request Body:**

```typescript
interface ImageGenerateAPIRequest {
  prompt: string;
  negativePrompt?: string;
  tier?: ImageQuality;            // 'draft' | 'preview' | 'final'
  resolution?: ImageResolution;
  count?: number;                 // Number of images (default: 1, max: 4)
  useCase?: UseCase;              // For auto-tier selection
  useAgent?: boolean;             // Use agent for prompt crafting
  agentType?: AgentType;          // Agent type for prompt refinement
  seed?: number;
  provider?: string;
  steps?: number;                 // Generation steps
  guidance?: number;              // CFG scale (default: 7.5)
}
```

**Response:**

```typescript
interface ImageGenerateAPIResponse {
  id: string;
  images: Array<{
    url: string;
    width: number;
    height: number;
    seed?: number;
  }>;
  tier: ImageQuality;
  provider: string;
  model: string;
  cost: number;
  latencyMs: number;
  promptUsed: string;
  negativePromptUsed?: string;
  agentUsed: boolean;
  revisedPrompt?: string;
}
```

**Quality Tiers:**

| Tier | Resolution | Cost | Use Case | Provider |
|------|------------|------|----------|----------|
| `draft` | 512x512 | $0.001 | Concept exploration | CF Workers AI |
| `preview` | 1024x1024 | $0.01 | Iteration | Zhipu FLUX |
| `final` | 1920x1080 | $0.04 | Production | FLUX Pro |

#### POST /images/craft-prompt

Craft an optimized prompt using an AI agent (without generating).

**Authentication:** Required

**Request Body:**

```typescript
interface PromptCraftRequest {
  prompt: string;
  useCase?: UseCase;
  tier?: ImageQuality;
  agent?: AgentType;
  style?: string;
  medium?: string;
}
```

**Response:**

```typescript
interface AgentPrompt {
  prompt: string;
  negativePrompt?: string;
  style?: string;
  parameters?: {
    steps?: number;
    guidance?: number;
    sampler?: string;
  };
  reasoning?: string;
}
```

#### POST /images/upscale

Upscale a draft image to higher quality.

**Authentication:** Required

**Request Body:**

```typescript
interface ImageUpscaleRequest {
  generationId: string;
  targetTier: ImageQuality;
  upscaleFactor?: 2 | 4;         // Upscale multiplier
  enhanceDetails?: boolean;
  denoise?: boolean;
}
```

#### GET /images/history

Get generation history for user.

**Authentication:** Required

**Query Parameters:**
- `limit`: Number of results (default: 20)
- `offset`: Pagination offset
- `tier`: Filter by tier

**Response:**

```typescript
interface GenerationHistoryResponse {
  generations: ImageGenerateAPIResponse[];
  total: number;
  totalCost: number;
}
```

#### POST /images/costs/estimate

Estimate generation cost.

**Authentication:** Required

**Request Body:** Same as ImageGenerateAPIRequest

**Response:**

```typescript
interface ImageCostEstimateResponse {
  tier: ImageQuality;
  estimatedCost: number;
  estimatedTime: number;
  provider: string;
  currency: string;
}
```

---

## AI & Agent APIs

### Multi-Model Router API

**Base Path:** `/`

Routes LLM requests to optimal providers with intelligent fallback and cost optimization.

#### Overview

The Multi-Model Router implements a cascade routing strategy that:
1. Routes requests to the most cost-effective provider for the task
2. Falls back to more expensive providers if needed
3. Tracks costs and usage for each user
4. Caches responses to reduce redundant requests

#### Provider Configuration

| Provider | Models | Input Cost | Output Cost | Best For |
|----------|--------|------------|-------------|----------|
| `zhipu` | GLM-4.7, GLM-4V | $0.50/M | $0.50/M | General purpose, low cost |
| `deepseek` | DeepSeek-V3, DeepSeek-R1 | $0.14/M | $0.28/M | Reasoning, code |
| `nvidia` | Llama Nemotron | $0.40/M | $0.40/M | Local deployment |
| `google` | Gemini 1.5 Pro, Flash | $1.25/M | $5.00/M | Vision, large context |
| `anthropic` | Claude 3.5 Sonnet, Opus 4.5 | $3.00/M | $15.00/M | Code, technical |
| `openai` | GPT-4o, GPT-4o-mini | $5.00/M | $15.00/M | General, creative |
| `ollama` | Various | Free | Free | Local only |

#### POST /v1/chat/completions

Main chat completions endpoint with cascade routing.

**Authentication:** Required

**Request Body:**

```typescript
interface ChatRequest {
  model: string;                  // Target model (or provider prefix)
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
    cacheControl?: { type: string };
  }>;
  temperature?: number;           // Default: 0.7
  max_tokens?: number;            // Default: 1024
  top_p?: number;                 // Default: 1.0
  stream?: boolean;               // Enable streaming
  provider?: string;              // Override provider selection
  userId?: string;                // For cost tracking
  cacheReads?: number;            // Prompt cache reads (Anthropic)
}
```

**Response:**

```typescript
interface ChatResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  cost: number;                   // Total cost in USD
  tokens: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
    total: number;
  };
  finish_reason: string;
  cached: boolean;
  latencyMs: number;
}
```

**Streaming Response:**

```
data: {"type": "chunk", "delta": {"content": "Hello"}}
data: {"type": "chunk", "delta": {"content": "!"}}
data: {"type": "done", "usage": {"tokens": {"input": 10, "output": 2}}}
```

#### POST /v1/completions

Legacy completions endpoint.

**Authentication:** Required

**Request Body:**

```typescript
interface CompletionRequest {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}
```

#### POST /v1/embeddings

Generate embeddings for text.

**Authentication:** Required

**Request Body:**

```typescript
interface EmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
  dimensions?: number;
}
```

**Response:**

```typescript
interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}
```

#### GET /providers

Get available providers and models.

**Authentication:** Not Required

**Response:**

```typescript
interface ProvidersResponse {
  providers: Array<{
    name: string;
    type: string;
    models: Array<{
      id: string;
      name: string;
      context: number;
      supportsCache: boolean;
      supportsStreaming: boolean;
    }>;
    costPerMillion: {
      input: number;
      output: number;
    };
    capabilities: string[];
  }>;
}
```

#### GET /costs/:userId

Get cost breakdown for user.

**Authentication:** Required

**Response:**

```typescript
interface CostBreakdown {
  totalCost: number;
  currency: string;
  period: {
    start: string;
    end: string;
  };
  breakdown: Array<{
    provider: string;
    model: string;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    total: number;
    percentage: number;
  }>;
  summary: {
    totalRequests: number;
    totalTokens: number;
    avgCostPerRequest: number;
    avgCostPerToken: number;
  };
}
```

#### GET /costs/cascade

Get cascade routing savings summary.

**Authentication:** Required

**Query Parameters:**
- `userId`: User ID (default: 'default')
- `period`: Time period (default: '24h')

**Response:**

```typescript
interface CascadeSummary {
  period: string;
  totalRequests: number;
  totalCost: number;
  estimatedCostWithoutCascade: number;
  cascadeSavings: number;
  savingsPercentage: number;
  providerBreakdown: Array<{
    name: string;
    requestCount: number;
    costTotal: number;
    percentage: number;
  }>;
  intentBreakdown: Array<{
    intent: string;
    count: number;
    percentage: number;
    avgCost: number;
  }>;
  modelBreakdown: Array<{
    model: string;
    provider: string;
    count: number;
    cost: number;
  }>;
}
```

#### POST /costs/reset

Reset cost tracking for user.

**Authentication:** Required

**Request Body:**

```typescript
interface ResetCostsRequest {
  userId: string;
  confirm: boolean;
}
```

---

### First-Mile Router API

**Base Path:** `/first-mile`

Fast intent classification before expensive LLM calls using keyword heuristics and Workers AI.

#### Overview

The First-Mile Router provides:
1. Sub-millisecond keyword-based classification
2. AI-powered fallback for ambiguous queries
3. KV caching for repeated queries
4. Provider/model recommendations

#### POST /first-mile/classify

Classify user intent and recommend optimal provider.

**Authentication:** Not Required

**Request Body:**

```typescript
interface ClassificationRequest {
  message: string;
  context?: {
    module?: string;              // 'cognitive-mill', 'sitka-sound', etc.
    studentId?: string;
    previousIntents?: Intent[];   // For pattern detection
  };
}
```

**Response:**

```typescript
interface ClassificationResponse {
  intent: Intent;
  recommendedProvider: string;
  recommendedModel: string;
  confidence: number;             // 0-1
  reasoning: string;
  bypassRouter: boolean;          // If true, handle directly
  suggestedCacheTtl?: number;     // Seconds to cache result
  cached?: boolean;               // If result was from cache
  usedAI?: boolean;              // If AI was used vs keywords
}
```

**Intent Types:**

| Intent | Description | Provider | Model |
|--------|-------------|----------|-------|
| `code-help` | Code generation, debugging, refactoring | anthropic | claude-3-5-sonnet |
| `explanation` | Concept explanation, tutorials | openai | gpt-4o |
| `simulation` | Godot/scene work, physics, game logic | anthropic | claude-3-5-sonnet |
| `bazaar` | Community features, sharing, forking | fast | gpt-4o-mini |
| `creative` | Creative writing, storytelling | openai | gpt-4o |
| `analysis` | Data analysis, comparisons | google | gemini-1.5-pro |
| `general` | Fallback | openai | gpt-4o-mini |

**Keyword Patterns:**

The classifier uses these keyword patterns (in order):

```typescript
const KEYWORD_PATTERNS = {
  'code-help': [
    /\b(function|class|const|let|var|import|export|debug|error|bug|refactor)\b/i,
    /\b(code|typescript|javascript|python|gdscript|compile|build)\b/i
  ],
  'simulation': [
    /\b(scene|node|sprite|rigidbody|collision|physics|game|simulation|godot)\b/i,
    /\b(velocity|acceleration|force|torque|mesh|texture|shader)\b/i
  ],
  'bazaar': [
    /\b(share|publish|fork|merge|bazaar|community|marketplace|rating|comment)\b/i,
    /\b(millfile|download|upload|remix)\b/i
  ],
  'explanation': [
    /\b(explain|what is|how does|mean|definition|concept|tutorial|learn)\b/i,
    /\b(understand|clarify|describe|overview)\b/i
  ],
  'creative': [
    /\b(write|create|story|character|dialogue|narrative|creative|imagine)\b/i,
    /\b(generate|design|invent)\b/i
  ],
  'analysis': [
    /\b(analyze|compare|difference|pattern|trend|statistics|data)\b/i,
    /\b(evaluate|assess|measure)\b/i
  ]
};
```

#### POST /first-mile/classify-batch

Classify multiple messages efficiently.

**Authentication:** Not Required

**Request Body:**

```typescript
interface BatchClassificationRequest {
  messages: string[];
  context?: ClassificationRequest['context'];
}
```

**Response:**

```typescript
interface BatchClassificationResponse {
  results: Array<ClassificationResponse & { message: string }>;
  total: number;
  fromCache: number;
  fromAI: number;
  fromKeywords: number;
}
```

#### GET /first-mile/intents

List all available intents with descriptions.

**Authentication:** Not Required

**Response:**

```typescript
interface IntentsResponse {
  intents: Array<{
    value: Intent;
    description: string;
    examples: string[];
    recommendedProvider: string;
    recommendedModel: string;
  }>;
}
```

#### GET /first-mile/recommendations

Get provider recommendations by intent.

**Authentication:** Not Required

**Response:**

```typescript
interface RecommendationsResponse {
  recommendations: Array<{
    intent: Intent;
    provider: string;
    model: string;
    reason: string;
  }>;
}
```

---

### G-Assist API

**Base Path:** `/g-assist-api`

Voice-enabled AI assistant with intelligent agent routing and conversation management.

#### Overview

G-Assist provides:
1. Intent classification and agent routing
2. Multi-agent conversations with context
3. Voice input/output integration
4. MCP tool execution
5. Conversation history management

#### Agent Types

| Agent | Role | Model | Description |
|-------|------|-------|-------------|
| `captain` | Orchestration | claude-3-5-sonnet | Coordinates other agents, handles meta-questions |
| `teacher` | Learning | gpt-4o | Provides explanations and tutorials |
| `builder` | Code | claude-3-5-sonnet | Generates and reviews code |
| `tester` | QA | gpt-4o-mini | Tests and verifies implementations |
| `director` | Architecture | claude-opus-4-5 | Handles complex architectural decisions |

#### POST /g-assist-api/route

Classify intent and route to appropriate agent.

**Authentication:** Required

**Request Body:**

```typescript
interface RouteRequest {
  message: string;
  context?: {
    module?: string;
    studentId?: string;
    scene?: string;
  };
}
```

**Response:**

```typescript
interface RouteResponse {
  agent: StudyLogAgent;
  confidence: number;
  reasoning: string;
  suggestedModel: string;
  canHandleDirectly: boolean;
  tools?: string[];               // Available tools for this agent
}
```

#### POST /g-assist-api/chat

Send message to specific agent.

**Authentication:** Required

**Request Body:**

```typescript
interface GAssistChatRequest {
  agent: StudyLogAgent;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  context?: {
    module?: string;
    studentId?: string;
    scene?: string;
    openFiles?: string[];
    currentSelection?: {
      file: string;
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}
```

**Response:**

```typescript
interface GAssistChatResponse {
  id: string;
  content: string;
  agent: StudyLogAgent;
  model: string;
  provider: string;
  tokens?: {
    input: number;
    output: number;
  };
  cost?: number;
  latencyMs?: number;
  suggestedActions?: Array<{
    type: string;
    label: string;
    params?: Record<string, unknown>;
  }>;
}
```

#### POST /g-assist-api/stt

Speech-to-text conversion.

**Authentication:** Required

**Request Body:**

```typescript
interface GAssistSTTRequest {
  audio?: string;                 // Base64 encoded audio
  format?: 'wav' | 'mp3' | 'webm' | 'ogg';
  language?: string;              // Default: 'en-US'
}
```

#### POST /g-assist-api/tts

Text-to-speech conversion.

**Authentication:** Required

**Request Body:**

```typescript
interface GAssistTTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}
```

#### GET /g-assist-api/agents

List available agents.

**Authentication:** Not Required

**Response:**

```typescript
interface AgentsResponse {
  agents: Array<{
    id: StudyLogAgent;
    name: string;
    icon: string;
    description: string;
    capabilities: string[];
    model: string;
  }>;
}
```

#### POST /g-assist-api/conversations

Create or update a conversation.

**Authentication:** Required

**Request Body:**

```typescript
interface ConversationUpsertRequest {
  id?: string;                    // Omit for new conversation
  userId: string;
  agent: StudyLogAgent;
  title?: string;                 // Auto-generated from first message if omitted
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
  }>;
  context?: {
    module?: string;
    scene?: string;
    openFiles?: string[];
    currentSelection?: {
      file: string;
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
  };
  metadata?: Record<string, unknown>;
}
```

**Response:**

```typescript
interface ConversationResponse {
  id: string;
  userId: string;
  agent: StudyLogAgent;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
```

#### GET /g-assist-api/conversations/:userId

List user's conversations.

**Authentication:** Required

**Query Parameters:**
- `agent`: Filter by agent
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset

**Response:**

```typescript
interface ConversationsListResponse {
  conversations: ConversationResponse[];
  total: number;
}
```

#### GET /g-assist-api/conversations/:userId/:id

Get conversation details with messages.

**Authentication:** Required

**Response:**

```typescript
interface ConversationDetailsResponse extends ConversationResponse {
  messages: Array<{
    role: string;
    content: string;
    timestamp: number;
  }>;
  context: ConversationUpsertRequest['context'];
  metadata?: Record<string, unknown>;
}
```

#### DELETE /g-assist-api/conversations/:userId/:id

Delete a conversation.

**Authentication:** Required

**Response:** Success confirmation

#### POST /g-assist-api/mcp/tools/call

Execute an MCP tool call.

**Authentication:** Required

**Request Body:**

```typescript
interface MCPToolRequest {
  query: string;
  agentId: StudyLogAgent;
  userId?: string;
  userTier?: 'free' | 'forge' | 'studio' | 'lab';
  preferredServerId?: string;
  preferredToolName?: string;
  maxCostCategory?: 'free' | 'low' | 'medium' | 'high';
}
```

**Response:**

```typescript
interface MCPToolResponse {
  success: boolean;
  toolName: string;
  serverId: string;
  result: unknown;
  cost: number;
  executionTimeMs: number;
  error?: string;
}
```

#### GET /g-assist-api/mcp/tools

List available MCP tools.

**Authentication:** Not Required

**Query Parameters:**
- `category`: Filter by category
- `cost`: Filter by cost category

**Response:**

```typescript
interface MCPToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    serverId: string;
    category: string;
    costCategory: string;
    parameters: Record<string, {
      type: string;
      description: string;
      required: boolean;
    }>;
  }>;
}
```

#### GET /g-assist-api/mcp/servers

Get MCP server status.

**Authentication:** Not Required

**Response:**

```typescript
interface MCPServersResponse {
  servers: Array<{
    id: string;
    name: string;
    healthy: boolean;
    toolCount: number;
    avgLatency: number;
  }>;
}
```

#### GET /g-assist-api/mcp/costs/:userId

Get MCP tool usage costs for user.

**Authentication:** Required

**Response:**

```typescript
interface MCPCostsResponse {
  totalCost: number;
  period: string;
  breakdown: Array<{
    toolName: string;
    serverId: string;
    callCount: number;
    totalCost: number;
  }>;
}
```

---

### DMLog Agents API

**Base Path:** `/dmlog-agents`

AI agent coordination for DMLoG.AI TTRPG system.

#### POST /dmlog-agents/agents/create

Create a new AI agent.

**Authentication:** Required

**Request Body:**

```typescript
interface CreateAgentRequest {
  name: string;
  type: 'player' | 'npc' | 'dm' | 'monster';
  personality?: string;
  backstory?: string;
  stats?: Record<string, number>;
  abilities?: string[];
  goals?: string[];
  relationships?: Record<string, string>;
}
```

**Response:**

```typescript
interface CreateAgentResponse {
  id: string;
  name: string;
  type: string;
  createdAt: string;
}
```

#### POST /dmlog-agents/agents/:agentId/chat

Chat with an agent.

**Authentication:** Required

#### POST /dmlog-agents/agents/:agentId/action

Perform action with agent.

**Authentication:** Required

#### GET /dmlog-agents/agents/:agentId/state

Get agent state.

**Authentication:** Required

---

### Memory System API

**Base Path:** `/memory-system`

6-tier hierarchical memory for AI agents and student learning.

#### Memory Tiers

| Tier | Retention | Description |
|------|-----------|-------------|
| Working | 0-1 hour | Current context, LLM context window |
| Episodic | 1-6 hours | "What/When/Where" learning events |
| Semantic | 1+ weeks | Patterns, facts, concepts learned |
| Procedural | Permanent | Skills: coding, problem-solving |
| Reflection | Permanent | Metacognition, learning strategies |
| Identity | Permanent | Core traits, persistent self-model |

#### POST /memory-system/episodic

Add an episodic memory.

**Authentication:** Required

**Request Body:**

```typescript
interface EpisodicMemoryRequest {
  studentId: string;
  content: string;
  context?: {
    module?: string;
    topic?: string;
    importance?: number;        // 1-10
    emotionalValence?: number;   // -1 to 1
    location?: string;
    participants?: string[];
    tags?: string[];
    metadata?: Record<string, unknown>;
  };
}
```

**Response:**

```typescript
interface MemoryResponse {
  id: string;
  tier: 'episodic';
  createdAt: string;
}
```

#### POST /memory-system/semantic

Add a semantic concept.

**Authentication:** Required

**Request Body:**

```typescript
interface SemanticMemoryRequest {
  studentId: string;
  conceptName: string;
  attributes: Record<string, unknown>;
  confidence?: number;           // 0-1
  abstractionLevel?: number;     // 0-1
  sourceEventIds?: string[];     // Related episodic memories
}
```

#### POST /memory-system/procedural

Add a procedural skill.

**Authentication:** Required

**Request Body:**

```typescript
interface ProceduralMemoryRequest {
  studentId: string;
  skillName: string;
  category: string;
  prerequisites?: string[];
  masteryLevel?: number;         // 1-6 (novice to master)
}
```

#### POST /memory-system/consolidate

Trigger memory consolidation.

**Authentication:** Required

**Request Body:**

```typescript
interface ConsolidateRequest {
  studentId: string;
  tier?: 'episodic' | 'semantic';
}
```

#### GET /memory-system/narrative/:studentId

Get autobiographical narrative.

**Authentication:** Required

**Response:**

```typescript
interface NarrativeResponse {
  studentId: string;
  narrative: {
    opening: string;
    chapters: Array<{
      title: string;
      content: string;
      period: { start: string; end: string };
    }>;
    closing: string;
  };
}
```

#### GET /memory-system/landmarks/:studentId

Get temporal landmarks.

**Authentication:** Required

**Response:**

```typescript
interface LandmarksResponse {
  landmarks: Array<{
    id: string;
    type: 'first' | 'peak' | 'transition';
    description: string;
    timestamp: string;
    importance: number;
  }>;
}
```

#### GET /memory-system/reviews/:studentId

Get spaced repetition schedule.

**Authentication:** Required

**Response:**

```typescript
interface ReviewsResponse {
  due: Array<{
    memoryId: string;
    content: string;
    dueAt: string;
    priority: number;
  }>;
  scheduled: Array<{
    memoryId: string;
    scheduledFor: string;
  }>;
}
```

---

### Escalation Engine API

**Base Path:** `/escalation`

Decision routing for BOT/BRAIN/HUMAN escalation.

#### Escalation Levels

| Level | Description | Response Time | Cost |
|-------|-------------|---------------|------|
| BOT | Automated responses | Instant | Free |
| BRAIN | AI-assisted | <30s | $0.001 |
| HUMAN | Human agent | <5min | $0.01 |

#### POST /escalation/escalate

Escalate a decision/query.

**Authentication:** Required

**Request Body:**

```typescript
interface EscalateRequest {
  query: string;
  context?: Record<string, unknown>;
  userTier?: string;
  urgency?: 'low' | 'medium' | 'high';
}
```

**Response:**

```typescript
interface EscalateResponse {
  level: 'BOT' | 'BRAIN' | 'HUMAN';
  reasoning: string;
  response?: string;
  requiresHuman: boolean;
  estimatedWaitTime?: number;
  escalationId: string;
}
```

---

## Quality & Engine APIs

### Quality Scaling API

**Base Path:** `/quality-scaling`

Adaptive quality system that scales from low-end voxels to high-end 3D based on hardware.

#### Quality Tiers

| Tier | Name | Description |
|------|------|-------------|
| 0 | Potato | Voxel only, 64x64 |
| 1 | Low | Sprites, 128x128 |
| 2 | Medium | Low-poly 3D, 512 textures |
| 3 | High | Standard 3D, 1024 textures |
| 4 | Ultra | High-poly 3D, 2048+ textures, effects |

#### POST /quality-scaling/detect

Detect hardware capabilities.

**Authentication:** Not Required

**Request Body:**

```typescript
interface HardwareDetectionRequest {
  userAgent?: string;
  gpuInfo?: {
    vendor?: string;
    model?: string;
    vramGb?: number;
  };
  systemRamGb?: number;
  cpuCores?: number;
  screenResolution?: {
    width: number;
    height: number;
  };
}
```

**Response:**

```typescript
interface HardwareDetectionResponse {
  tier: number;                  // 0-4
  canRunRaytracing: boolean;
  drawDistance: number;
  maxParticles: number;
  maxTextureSize: number;
  recommendedQuality: string;
  supportsVolumetricFog: boolean;
  supportsSSR: boolean;
}
```

#### GET /quality-scaling/presets

Get quality presets.

**Authentication:** Not Required

**Response:**

```typescript
interface QualityPresetsResponse {
  presets: Record<number, {
    name: string;
    settings: {
      renderScale: number;
      textureQuality: number;
      shadowQuality: number;
      particleQuality: number;
      effectsQuality: number;
    };
  }>;
}
```

#### GET /quality-scaling/budget/:userId

Get user quality budget.

**Authentication:** Required

**Response:**

```typescript
interface UserBudgetResponse {
  userId: string;
  tier: number;                  // 0-3
  dailyBudget: number;
  monthlyBudget: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  grainTokens: number;
}
```

#### POST /quality-scaling/budget/:userId/spend

Spend budget on upgrade.

**Authentication:** Required

**Request Body:**

```typescript
interface SpendBudgetRequest {
  amount: number;
  reason: string;
}
```

---

### Engine Abstraction API

**Base Path:** `/engine`

Unified engine management for Godot, OpenRTS, and custom engines.

#### GET /engine/status

Get engine status.

**Authentication:** Required

**Response:**

```typescript
interface EngineStatusResponse {
  engine: string;
  running: boolean;
  version: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
  sessions: number;
}
```

#### POST /engine/start

Start engine instance.

**Authentication:** Required

**Request Body:**

```typescript
interface StartEngineRequest {
  engine: 'godot' | 'openrts' | 'custom';
  config?: Record<string, unknown>;
}
```

#### POST /engine/stop

Stop engine instance.

**Authentication:** Required

---

### OpenRTS Integration API

**Base Path:** `/openrts`

OpenRTS game engine bridge.

#### POST /openrts/sync

Sync state with OpenRTS.

**Authentication:** Required

**Request Body:**

```typescript
interface OpenRTSyncRequest {
  entities: Array<{
    id: string;
    position: [number, number];
    type: string;
    properties?: Record<string, unknown>;
  }>;
}
```

#### GET /openrts/entities

List entities.

**Authentication:** Required

---

### Godot Physics API

**Base Path:** `/godot-physics`

Physics simulation running in Godot engine.

#### POST /godot-physics/simulate

Run physics simulation.

**Authentication:** Required

**Request Body:**

```typescript
interface PhysicsSimulationRequest {
  scene: {
    bodies: Array<{
      id: string;
      position: [number, number, number];
      velocity?: [number, number, number];
      mass: number;
      shape: 'box' | 'sphere' | 'cylinder';
      size?: [number, number, number];
    }>;
  };
  duration: number;              // seconds to simulate
  timestep?: number;             // physics timestep (default: 1/60)
  gravity?: [number, number, number];
}
```

**Response:**

```typescript
interface PhysicsSimulationResponse {
  results: Array<{
    id: string;
    position: [number, number, number];
    rotation: [number, number, number, number];
    velocity: [number, number, number];
  }>;
  collisions: Array<{
    body1: string;
    body2: string;
    point: [number, number, number];
    normal: [number, number, number];
    impulse: number;
  }>;
}
```

---

### Godot Integration API

**Base Path:** `/godot-integration`

Godot Engine integration for lessons and scenes.

#### POST /godot-integration/scene/load

Load a Godot scene.

**Authentication:** Required

**Request Body:**

```typescript
interface LoadSceneRequest {
  scenePath: string;
  lessonId?: string;
}
```

#### POST /godot-integration/scene/save

Save a Godot scene.

**Authentication:** Required

#### POST /godot-integration/lesson/load

Load lesson content.

**Authentication:** Required

#### POST /godot-integration/plugin/execute

Execute plugin command.

**Authentication:** Required

---

## Simulation APIs

### Ranch Simulation API

**Base Path:** `/ranch-simulation`

Intelligence Ranch agent breeding and training.

#### POST /ranch-simulation/agent/breed

Breed new agents.

**Authentication:** Required

**Request Body:**

```typescript
interface BreedAgentRequest {
  parent1Id: string;
  parent2Id: string;
  traits?: string[];
  mutationRate?: number;          // 0-1
}
```

#### POST /ranch-simulation/agent/train

Train agent.

**Authentication:** Required

#### GET /ranch-simulation/herd

List agents.

**Authentication:** Required

---

### Fishing Simulation API

**Base Path:** `/fishing-simulation`

Sitka Sound ecosystem simulation.

#### POST /fishing-simulation/cast

Cast fishing line.

**Authentication:** Required

**Request Body:**

```typescript
interface CastRequest {
  location: [number, number];
  bait?: string;
}
```

**Response:**

```typescript
interface CastResponse {
  castId: string;
  location: [number, number];
  estimatedWaitTime: number;
}
```

#### GET /fishing-simulation/catch/:castId

Get catch results.

**Authentication:** Required

**Response:**

```typescript
interface CatchResponse {
  castId: string;
  caught: boolean;
  fish?: {
    species: string;
    size: number;
    rarity: string;
  };
  xp: number;
}
```

#### GET /fishing-simulation/ecosystem

Get ecosystem state.

**Authentication:** Required

---

### Being State API

**Base Path:** `/being-state`

Agent state transformations.

#### POST /being-state/transform

Transform being state.

**Authentication:** Required

**Request Body:**

```typescript
interface TransformRequest {
  beingId: string;
  targetState: string;
  parameters?: Record<string, unknown>;
}
```

#### GET /being-state/state/:beingId

Get being state.

**Authentication:** Required

---

### Voxel AI API

**Base Path:** `/voxel-ai`

Voxel generation and AI optimization.

#### POST /voxel-ai/generate

Generate voxel structure.

**Authentication:** Required

**Request Body:**

```typescript
interface VoxelGenerateRequest {
  prompt: string;
  size: [number, number, number];
  style?: 'minecraft' | 'realistic' | 'artistic';
}
```

#### POST /voxel-ai/optimize

Optimize voxel data.

**Authentication:** Required

---

## Collaboration APIs

### CRDT Sync API

**Base Path:** `/crdt-sync`

Real-time CRDT synchronization for collaborative editing.

#### POST /crdt-sync/doc

Create or update document.

**Authentication:** Required

**Request Body:**

```typescript
interface CRDTDocRequest {
  docId: string;
  updates: Array<{
    type: 'insert' | 'delete';
    position: number;
    length?: number;
    content?: string;
  }>;
}
```

#### GET /crdt-sync/doc/:docId

Get document state.

**Authentication:** Required

#### POST /crdt-sync/sync

Sync updates.

**Authentication:** Required

---

### Cross-Product Memory API

**Base Path:** `/cross-product-memory`

Share memory across StudyLoG, DMLoG, and other products.

#### GET /cross-product-memory/memory/:userId

Get all product memories.

**Authentication:** Required

**Response:**

```typescript
interface CrossProductMemoryResponse {
  studylog: MemoryData;
  dmlog: MemoryData;
  shared: MemoryData;
}
```

#### POST /cross-product-memory/import

Import memory from other product.

**Authentication:** Required

---

### Realtime API

**Base Path:** `/realtime`

Real-time collaboration rooms.

#### POST /realtime/room/create

Create room.

**Authentication:** Required

**Request Body:**

```typescript
interface CreateRoomRequest {
  name?: string;
  maxParticipants?: number;
}
```

#### POST /realtime/room/:roomId/join

Join room.

**Authentication:** Required

#### GET /realtime/room/:roomId/state

Get room state.

**Authentication:** Required

---

### Vibe Chat API

**Base Path:** `/vibe-chat`

IDE chat with AI agents.

#### POST /vibe-chat/chat

Send message.

**Authentication:** Required

#### GET /vibe-chat/history

Get chat history.

**Authentication:** Required

---

## Core Backend APIs

### Authentication API

**Base Path:** `/auth`

User authentication and session management.

#### POST /auth/register

Create new account.

**Authentication:** Not Required

**Request Body:**

```typescript
interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  tier?: 'free' | 'forge' | 'studio' | 'lab';
}
```

**Response:**

```typescript
interface RegisterResponse {
  success: boolean;
  data: {
    token: string;
    student: {
      id: string;
      email: string;
      displayName: string;
      tier: string;
    };
  };
}
```

**Validation:**
- Email: Valid email format
- Password: Min 8 characters

**Error Codes:**
- `INVALID_EMAIL` - Invalid email format
- `WEAK_PASSWORD` - Password too short
- `EMAIL_EXISTS` - Email already registered

#### POST /auth/login

Authenticate user.

**Authentication:** Not Required

**Request Body:**

```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response:**

```typescript
interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    student: {
      id: string;
      email: string;
      displayName: string;
      tier: string;
    };
  };
}
```

#### POST /auth/logout

End session.

**Authentication:** Required

#### POST /auth/refresh

Refresh token.

**Authentication:** Required

#### GET /auth/me

Get current user.

**Authentication:** Required

---

### Student API

**Base Path:** `/student`

Student progress and learning management.

#### GET /student/progress

Get all module progress.

**Authentication:** Required

**Response:**

```typescript
interface ProgressResponse {
  success: boolean;
  data: {
    modules: Array<{
      module: string;
      currentStage: number;
      xp: number;
      timeSpentMinutes: number;
      startedAt: string;
      lastActivityAt: string;
      completedAt: string;
    }>;
    phases: Array<{
      phase: string;
      unlockedAt: string;
      challengesCompleted: number;
    }>;
    currentPhase: string;
  };
}
```

#### POST /student/progress/:module/start

Start a module.

**Authentication:** Required

#### POST /student/progress/:module/advance

Advance to next stage.

**Authentication:** Required

#### GET /student/achievements

Get earned achievements.

**Authentication:** Required

**Response:**

```typescript
interface AchievementsResponse {
  success: boolean;
  data: {
    earned: Array<{
      code: string;
      name: string;
      description: string;
      iconUrl: string;
      xpReward: number;
      rarity: string;
      earnedAt: string;
    }>;
    available: Array<{
      code: string;
      name: string;
      description: string;
      rarity: string;
    }>;
  };
}
```

#### POST /student/hardware

Report hardware profile.

**Authentication:** Required

---

### Game State API

**Base Path:** `/game`

Game session and state management.

#### POST /game/session/start

Start new game session.

**Authentication:** Required

**Request Body:**

```typescript
interface StartSessionRequest {
  module: string;
  scene: string;
}
```

**Response:**

```typescript
interface SessionStartResponse {
  success: boolean;
  data: {
    sessionId: string;
    module: string;
    scene: string;
  };
}
```

#### POST /game/session/:id/save

Save game state.

**Authentication:** Required

#### GET /game/session/:id

Get game session.

**Authentication:** Required

#### POST /game/session/:id/end

End game session.

**Authentication:** Required

#### GET /game/session/active

Get active session.

**Authentication:** Required

#### POST /game/puzzle/:id/attempt

Submit puzzle attempt.

**Authentication:** Required

---

### Asset Management API

**Base Path:** `/assets`

R2 storage for project files and game assets.

#### POST /assets/project/upload

Upload project file.

**Authentication:** Required

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: File (max 10MB)
- `path`: Storage path

**Response:**

```typescript
interface UploadResponse {
  success: boolean;
  data: {
    key: string;
    size: number;
  };
}
```

#### GET /assets/project/download/:path+

Download project file.

**Authentication:** Required

#### GET /assets/project/list

List project files.

**Authentication:** Required

**Query Parameters:**
- `prefix`: Filter by prefix
- `cursor`: Pagination cursor

**Response:**

```typescript
interface ProjectListResponse {
  success: boolean;
  data: {
    files: Array<{
      path: string;
      size: number;
      uploaded: string;
      etag: string;
    }>;
    cursor: string | null;
  };
}
```

#### DELETE /assets/project/delete/:path+

Delete project file.

**Authentication:** Required

#### GET /assets/asset/:path+

Get public game asset.

**Authentication:** Not Required

**Cache:** 1 year

#### POST /assets/asset/upload

Upload game asset (admin).

**Authentication:** Required

**Max Size:** 50MB

---

### Bazaar API

**Base Path:** `/bazaar`

Community marketplace for creations.

#### GET /bazaar/creations

Browse creations.

**Authentication:** Not Required

**Query Parameters:**
- `type`: Filter by type (`simulation`, `puzzle`, `agent`, `extension`, `godot-scene`)
- `quality`: Minimum quality (1-4)
- `author_id`: Filter by author
- `limit`: Results per page (default: 20)
- `offset`: Pagination offset
- `sort`: Sort by (`created`, `likes`, `downloads`, `quality`)

**Response:**

```typescript
interface CreationsResponse {
  creations: Creation[];
  total: number;
}
```

**Creation Type:**

```typescript
interface Creation {
  id: string;
  author_id: string;
  title: string;
  description?: string;
  type: 'simulation' | 'puzzle' | 'agent' | 'extension' | 'godot-scene';
  millfile?: string;
  content_hash?: string;
  storage_path?: string;
  quality: number;              // 1-4 Fuse Grade
  is_public: boolean;
  forks_count: number;
  likes_count: number;
  comments_count: number;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}
```

#### GET /bazaar/creations/:id

Get single creation.

**Authentication:** Not Required

#### POST /bazaar/creations

Create creation.

**Authentication:** Required

**Request Body:**

```typescript
interface CreateCreationRequest {
  title: string;
  description?: string;
  type: Creation['type'];
  millfile?: string;
  storage_path?: string;
}
```

#### POST /bazaar/creations/:id/fork

Fork creation.

**Authentication:** Required

**Request Body:**

```typescript
interface ForkRequest {
  title?: string;
}
```

#### POST /bazaar/creations/:id/feedback

Add feedback (like/comment).

**Authentication:** Required

**Request Body:**

```typescript
interface FeedbackRequest {
  type: 'like' | 'comment' | 'verification' | 'fork';
  content?: string;
}
```

#### GET /bazaar/profile/:id

Get user profile.

**Authentication:** Not Required

**Response:**

```typescript
interface UserProfile {
  id: string;
  student_id: string;
  bio?: string;
  reputation: number;
  grain_tokens: number;
  creations_shared: number;
  forks_made: number;
  quality_verifications: number;
  created_at: string;
  updated_at: string;
}
```

#### POST /bazaar/merge-requests

Create merge request.

**Authentication:** Required

**Request Body:**

```typescript
interface MergeRequest {
  fork_id: string;
  title?: string;
  description?: string;
}
```

---

## WebSocket Protocols

### Connection

**WebSocket URL:** `wss://api.studylog.ai/ws`

**Connection Parameters:**
- `token`: JWT auth token
- `room`: Room identifier

### Message Format

```typescript
interface WSMessage {
  type: string;
  payload?: unknown;
  id?: string;
}
```

### Message Types

#### Client → Server

| Type | Payload | Description |
|------|---------|-------------|
| `subscribe` | `{ channel: string }` | Subscribe to channel |
| `unsubscribe` | `{ channel: string }` | Unsubscribe |
| `chat` | `{ message: string }` | Send chat message |
| `cursor` | `{ position: [number, number] }` | Update cursor |
| `presence` | `{ status: 'online' | 'away' }` | Update presence |

#### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `subscribed` | `{ channel: string }` | Subscription confirmed |
| `error` | `{ message: string }` | Error occurred |
| `chat` | `{ userId, message, timestamp }` | Chat message |
| `presence` | `{ userId, status, timestamp }` | Presence update |
| `typing` | `{ userId, isTyping }` | Typing indicator |

### Example

```javascript
const ws = new WebSocket('wss://api.studylog.ai/ws?token=xxx');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    payload: { channel: 'room:abc123' }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message.type, message.payload);
};
```

---

## Common Patterns

### Pagination

All list endpoints support pagination:

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20, max: 100)

**Response:**

```typescript
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

### Filtering

Use query parameters for filtering:

```
GET /creations?type=simulation&quality>=2&sort=likes
```

### Batch Operations

Batch endpoints accept arrays:

```typescript
interface BatchRequest<T> {
  requests: T[];
  parallel?: boolean;              // Execute in parallel
}
```

### Streaming

Some endpoints support streaming responses:

**Request Header:**
```
Accept: text/event-stream
```

**Response:** Server-Sent Events (SSE) format

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { StudyLogClient } from '@studylog/sdk';

const client = new StudyLogClient({
  baseUrl: 'https://api.studylog.ai',
  token: 'your-jwt-token'
});

// Generate 3D model
const model = await client.assets3d.generateModel({
  prompt: 'A medieval knight',
  quality: 'high'
});

// Chat with AI
const response = await client.ai.chat({
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Python

```python
from studylog import StudyLogClient

client = StudyLogClient(
    base_url='https://api.studylog.ai',
    token='your-jwt-token'
)

# Generate speech
audio = client.audio.generate_speech(
    text='Hello, world!',
    voice='Rachel'
)
```

---

## Data Models

### User

```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  tier: 'free' | 'forge' | 'studio' | 'lab';
  createdAt: string;
  updatedAt: string;
}
```

### Asset

```typescript
interface Asset {
  id: string;
  type: '3d' | '2d' | 'audio' | 'image';
  provider: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  thumbnailUrl?: string;
  costUsd: number;
  createdAt: string;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  userId: string;
  agent: StudyLogAgent;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
```

---

## Webhooks

Webhooks allow your application to receive real-time notifications.

### Creating Webhooks

```bash
curl -X POST https://api.studylog.ai/webhooks \
  -H "Authorization: Bearer <token>" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["asset.completed", "generation.failed"]
  }'
```

### Webhook Events

| Event | Description |
|-------|-------------|
| `asset.completed` | Asset generation completed |
| `generation.failed` | Asset generation failed |
| `user.tier_changed` | User tier changed |
| `payment.processed` | Payment processed |

### Webhook Payload

```json
{
  "id": "evt_123",
  "event": "asset.completed",
  "data": {
    "assetId": "asset_abc",
    "url": "https://..."
  },
  "timestamp": "2026-01-10T12:00:00Z"
}
```

---

## Testing & Mocking

### Mock Server

For testing without making real API calls:

```typescript
import { createMockServer } from '@studylog/sdk/mock';

const mock = createMockServer();

mock.assets3d.generateModel.mockResolvedValue({
  success: true,
  assetId: 'mock_asset',
  modelUrl: 'https://mock.url/model.glb'
});
```

---

## Changelog

### v1.0.0 (2026-01-10)
- Initial unified API documentation
- Asset Generation APIs
- AI & Agent APIs
- Quality & Engine APIs
- Simulation APIs
- Collaboration APIs
- Core Backend APIs

---

## Support

For questions or issues:
- Documentation: https://docs.studylog.ai
- GitHub: https://github.com/SuperInstance/studylog-github
- Discord: https://discord.gg/studylog
