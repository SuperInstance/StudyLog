# Code Comment Standards for StudyLoG.AI

## Overview

This document defines the commenting and documentation standards for the StudyLoG.AI codebase. Following these standards ensures code is maintainable, understandable, and accessible to all contributors.

## Table of Contents

1. [General Principles](#general-principles)
2. [When to Use JSDoc vs Inline Comments](#when-to-use-jsdoc-vs-inline-comments)
3. [JSDoc Standards](#jsdoc-standards)
4. [Inline Comment Standards](#inline-comment-standards)
5. [Documenting Async Functions](#documenting-async-functions)
6. [Documenting Error Cases](#documenting-error-cases)
7. [TypeScript-Specific Guidelines](#typescript-specific-guidelines)
8. [Examples: Good vs Bad Comments](#examples-good-vs-bad-comments)

---

## General Principles

### 1. Comment "Why", Not Just "What"

**Good**: Explains the reasoning behind a decision
```typescript
// Use HTMLAudioElement instead of SpeechSynthesis for better quality TTS
// and to support custom voices (Piper, ElevenLabs) with precise position tracking
private audioElement: HTMLAudioElement | null = null;
```

**Bad**: Simply restates what the code already says
```typescript
// Audio element variable
private audioElement: HTMLAudioElement | null = null;
```

### 2. Keep Comments Close to the Code They Describe

Comments should be immediately before the code they describe, not separated by other statements.

### 3. Maintain Comment Accuracy

When changing code, update related comments immediately. Outdated comments are worse than no comments.

### 4. Use Proper Grammar and Spelling

Comments are part of the codebase quality. Use complete sentences with proper capitalization and punctuation.

---

## When to Use JSDoc vs Inline Comments

### Use JSDoc for:

- **Public API methods** - Any function/class that is exported or used by other modules
- **Complex functions** - Functions with non-obvious behavior or multiple steps
- **Functions with important side effects** - Functions that modify state, make API calls, etc.
- **Configuration types** - Interfaces and types that define data structures
- **Event handlers** - Functions that respond to events

### Use Inline Comments for:

- **Implementation details** - Brief explanations within a function
- **TODO/FIXME markers** - Temporary notes for future work
- **Complex logic explanations** - Clarifying tricky algorithms or calculations
- **Non-obvious reasons** - Explaining why code is written a certain way
- **Section headers** - Organizing large files into logical sections

---

## JSDoc Standards

### Basic JSDoc Template

```typescript
/**
 * One-line summary of the function's purpose.
 *
 * Additional paragraph(s) providing context if needed.
 * Explain the approach, algorithms, or any important considerations.
 *
 * @param param1 - Description of parameter 1
 * @param param2 - Description of parameter 2 (include units if applicable)
 * @returns Description of the return value and its structure
 * @throws {ErrorType} When and why this error is thrown
 *
 * @example
 * ```ts
 * const result = await myFunction('input', { option: true });
 * console.log(result);
 * ```
 */
async function myFunction(param1: string, param2: Options): Promise<Result> {
  // ...
}
```

### JSDoc Tag Guidelines

| Tag | Usage | Required When |
|-----|-------|---------------|
| `@param` | Document parameters | Always for functions with parameters |
| `@returns` | Document return value | Always for non-void functions |
| `@throws` | Document thrown errors | Always for functions that can throw |
| `@example` | Provide usage example | For public APIs, complex functions |
| `@deprecated` | Mark as deprecated | When deprecating functionality |
| `@see` | Reference related code | When useful context exists elsewhere |
| `@private` | Mark internal API | For internal-but-exported members |

### JSDoc for Classes

```typescript
/**
 * Main chat interface for voice-enabled AI assistant with first-mile routing.
 *
 * This widget handles:
 * - Voice input via MediaRecorder API
 * - Text-to-speech playback
 * - Agent routing and chat interactions
 * - Audio visualization during recording
 *
 * @remarks
 * Recording and playback are mutually exclusive operations to prevent
 * audio feedback loops and ensure clean UX.
 *
 * @example
 * ```tsx
 * <GAssistWidget />
 * ```
 */
@injectable()
export class GAssistWidget extends ReactWidget {
  // ...
}
```

---

## Inline Comment Standards

### Section Headers

Use consistent section headers with equal-length borders:

```typescript
// ============================================================================
// Environment Types
// ============================================================================

// ============================================================================
// Routing Logic
// ============================================================================
```

### Inline Explanations

Keep inline comments concise and focused:

```typescript
// For updates, preserve original created_at
let createdAt = now;
if (id) {
  const existing = await env.CONVERSATIONS.prepare(
    'SELECT created_at FROM conversations WHERE id = ?'
  ).bind(id).first<{ created_at: number }>();
  if (existing) {
    createdAt = existing.created_at;
  }
}
```

### TODO Comments

Format TODOs with context and owner (if known):

```typescript
// TODO: Implement in Task 1.2.4 (context extractor)
// TODO(casey): Add rate limiting for production
// FIXME: This fails when message contains null bytes
```

### Warning Comments

Use WARNING for critical issues:

```typescript
// WARNING: Never call this method from within the audio context
// WARNING: This operation is not atomic - race conditions possible
```

---

## Documenting Async Functions

Async functions require additional documentation for their asynchronous behavior.

### Template for Async Functions

```typescript
/**
 * Transcribe audio buffer to text using the specified STT provider.
 *
 * This method sends the audio data to the backend STT endpoint which
 * uses the configured provider (browser-based or API) to perform
 * speech recognition.
 *
 * @param audioBuffer - Raw audio data from MediaRecorder (WebM format)
 * @param provider - STT provider identifier ('local', 'whisper', etc.)
 * @returns Transcription result containing:
 *   - `text`: The transcribed text
 *   - `confidence`: Confidence score (0-1)
 *   - `language`: Detected language code
 * @throws {Error} If the STT API returns an error or times out
 * @throws {NetworkError} If the request fails due to network issues
 *
 * @remarks
 * Audio buffer should be in WebM format for best compatibility.
 * For long audio (>60s), consider chunking the input.
 *
 * @example
 * ```ts
 * const audioBlob = await recorder.getAudioData();
 * const result = await service.transcribe(audioBlob, 'local');
 * console.log(`Transcribed: ${result.text} (${result.confidence}% confidence)`);
 * ```
 */
async function transcribe(audioBuffer: ArrayBuffer, provider: string): Promise<STTResult> {
  // ...
}
```

### Key Points for Async Documentation

1. **Always specify the return type as `Promise<T>`**
2. **Document any timeout behavior** (how long before it fails)
3. **Describe retry behavior** (if any)
4. **Note any side effects** (caching, state changes)
5. **Document cancellation behavior** (if cancellable)

---

## Documenting Error Cases

Error handling documentation should answer: what can go wrong, and how should callers respond?

### Error Documentation Template

```typescript
/**
 * Save or update a conversation.
 *
 * Uses the upsert pattern - creates new conversation if no ID is provided,
 * otherwise updates the existing one.
 *
 * @param request - The conversation upsert request
 * @returns The saved conversation ID and metadata
 * @throws {ValidationError} If required fields (userId, agent, messages) are missing
 * @throws {DatabaseError} If the database operation fails (e.g., connection lost)
 * @throws {RateLimitError} If too many save operations in quick succession
 *
 * @remarks
 * Error handling strategy:
 * - ValidationError: Return 400, prompt user for missing data
 * - DatabaseError: Retry with exponential backoff up to 3 times
 * - RateLimitError: Queue the save for later
 *
 * @example
 * ```ts
 * try {
 *   const result = await saveConversation({ userId: '123', agent: 'teacher', messages: [] });
 *   console.log('Saved:', result.conversationId);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     showErrorMessage('Please fill in all required fields');
 *   } else if (error instanceof DatabaseError) {
 *     showErrorMessage('Unable to save. Please check your connection.');
 *   }
 * }
 * ```
 */
async function saveConversation(request: ConversationUpsertRequest): Promise<ConversationUpsertResponse> {
  // ...
}
```

### Error Documentation Checklist

- [ ] Document each type of error that can be thrown
- [ ] Explain when each error occurs
- [ ] Provide guidance on how to handle each error
- [ ] Note any automatic retry behavior
- [ ] Document any error state that requires cleanup

---

## TypeScript-Specific Guidelines

### Type Comments

```typescript
/**
 * In-memory state for the active conversation.
 *
 * This allows the service to auto-save after each message without requiring
 * the widget to track conversation state. The widget can focus on UI while
 * the service handles persistence.
 */
interface ActiveConversationState {
  /** Database ID (undefined for new conversations) */
  id?: string;
  /** User identifier from auth system */
  userId: string;
  /** The agent currently handling this conversation */
  agent: GAssistAgent;
  /** Full message history, oldest first */
  messages: ChatMessage[];
  /** Optional IDE context at time of conversation */
  context?: IDEContext;
}
```

### Enum/Union Type Documentation

```typescript
/**
 * Intent classification result
 *
 * Determines which type of model/service is appropriate for a given query.
 * This classification happens in the first-mile-router before expensive LLM calls.
 *
 * @remarks
 * Intent classification uses a two-tier approach:
 * 1. Keyword heuristics (fast, free)
 * 2. AI classification (if keywords inconclusive)
 */
export type Intent =
  | 'code-help'      // Code generation, debugging, refactoring
  | 'explanation'    // Concept explanation, tutorials
  | 'simulation'     // Godot scene work, physics, game logic
  | 'bazaar'         // Community features, sharing, forking
  | 'creative'       // Creative writing, storytelling
  | 'analysis'       // Data analysis, pattern recognition
  | 'general';       // Fallback to default provider
```

### Generic Type Documentation

```typescript
/**
 * A generic result type for API responses
 *
 * @template T - The success data type
 * @template E - The error type (defaults to Error)
 */
type ApiResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };
```

---

## Examples: Good vs Bad Comments

### Example 1: Function Documentation

**Bad:**
```typescript
// Send message
async function handleSend() {
  // Add message
  this.messages.push(msg);
  // Get response
  const response = await this.service.chat(...);
  // Return
  return response;
}
```

**Good:**
```typescript
/**
 * Handle sending a message to the AI assistant.
 *
 * Flow:
 * 1. Stop any ongoing TTS playback (prevents audio overlap)
 * 2. Add user message to history
 * 3. Route to appropriate agent via first-mile-router
 * 4. Get response from agent
 * 5. Add assistant message and optionally speak
 *
 * @throws {NetworkError} If routing or chat API calls fail
 * @throws {ValidationError} If message content is empty
 */
private async handleSend(): Promise<void> {
  // Stop any ongoing TTS playback when user sends a new message
  // This prevents audio overlap and provides better UX
  this.stopTTS();

  const userMessage: ChatMessage = {
    id: this.generateId(),
    role: 'user',
    content: this.inputText.trim(),
    timestamp: Date.now(),
  };

  this.messages = [...this.messages, userMessage];
  // ... rest of implementation
}
```

### Example 2: Explaining Non-Obvious Behavior

**Bad:**
```typescript
const provider = PROVIDERS[providerName];
// Check if provider exists
if (!provider) {
  throw new Error(`Provider not found: ${providerName}`);
}
```

**Good:**
```typescript
const provider = PROVIDERS[providerName];
// Provider lookup may fail if:
// 1. Provider name is misspelled
// 2. Provider is not yet configured in PROVIDERS
// 3. Provider was removed but still referenced in fallback chain
if (!provider) {
  throw new Error(`Provider not found: ${providerName}`);
}
```

### Example 3: Type Documentation

**Bad:**
```typescript
interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  provider?: string;
  stream?: boolean;
}
```

**Good:**
```typescript
/**
 * Request payload for LLM chat completion.
 *
 * @remarks
 * The `messages` array should contain the conversation history:
 * - System message (optional): Sets assistant behavior
 * - User/assistant alternation: The actual conversation
 *
 * Temperature controls randomness (0=deterministic, 1=creative).
 * Most responses use 0.7 as a balanced default.
 */
interface ChatRequest {
  /** Model identifier (e.g., 'gpt-4o', 'claude-3-5-sonnet') */
  model: string;
  /** Conversation history, oldest first */
  messages: Array<{ role: string; content: string }>;
  /** Sampling temperature: 0 (focused) to 1 (creative). Default: 0.7 */
  temperature?: number;
  /** Maximum tokens to generate. Default: 1024 */
  max_tokens?: number;
  /** Optional provider override (bypasses auto-selection) */
  provider?: string;
  /** Enable Server-Sent Events streaming (not yet implemented) */
  stream?: boolean;
}
```

### Example 4: Algorithm Documentation

**Bad:**
```typescript
function getCacheKey(body: ChatRequest): string {
  const key = JSON.stringify({
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });
  return `chat:${btoa(key).slice(0, 64)}`;
}
```

**Good:**
```typescript
/**
 * Generate a deterministic cache key for a chat request.
 *
 * The cache key includes all parameters that affect the response:
 * - Model: Different models produce different outputs
 * - Messages: The conversation context directly affects output
 * - Temperature: Affects randomness/creativity
 * - Max tokens: Affects response length
 *
 * Excluded parameters:
 * - Provider: Response should be cacheable regardless of which provider handled it
 * - Stream: Doesn't affect the content, only delivery method
 *
 * @returns A base64-encoded cache key, truncated to 64 chars for KV storage limits
 */
function getCacheKey(body: ChatRequest): string {
  const key = JSON.stringify({
    model: body.model,
    messages: body.messages,
    temperature: body.temperature,
    max_tokens: body.max_tokens,
  });
  return `chat:${btoa(key).slice(0, 64)}`;
}
```

### Example 5: State Management Documentation

**Bad:**
```typescript
// Audio state
private isRecording = false;
private isPlaying = false;
private audioElement = null;
```

**Good:**
```typescript
/**
 * Recording and playback state management
 *
 * Mutually exclusive operations:
 * - Cannot record while playing (prevents feedback loops)
 * - Cannot play while recording (ensures clean audio input)
 *
 * State transitions:
 * - IDLE -> RECORDING -> IDLE
 * - IDLE -> PLAYING -> IDLE
 * - Any state -> IDLE (via stop methods)
 */
private isRecording = false;
private isPlaying = false;

/**
 * Audio element for TTS playback.
 *
 * We use HTMLAudioElement instead of SpeechSynthesis for several reasons:
 * 1. Supports custom TTS voices (Piper, ElevenLabs) with better quality
 * 2. Can handle longer audio content without browser limitations
 * 3. Allows pause/resume with precise position tracking
 * 4. Audio can be cached and replayed without re-synthesizing
 * 5. Better integration with our backend TTS API
 */
private audioElement: HTMLAudioElement | null = null;
```

---

## Priority Checklist for Code Review

When reviewing code, check documentation in this order:

### Priority 1: Critical (Must Have)

- [ ] All public APIs have JSDoc with @param and @returns
- [ ] Error cases are documented with @throws
- [ ] Complex algorithms have explanatory comments
- [ ] Non-obvious behavior is explained ("why" comments)

### Priority 2: Important (Should Have)

- [ ] Private helper functions have brief JSDoc if complex
- [ ] Types and interfaces have descriptive comments
- [ ] Section headers organize large files
- [ ] Examples provided for non-trivial public APIs

### Priority 3: Nice-to-Have (Can Have)

- [ ] Inline comments for simple, obvious code
- [ ] Usage examples in comments (vs in separate docs)
- [ ] Historical notes (why something was done a certain way)

---

## Quick Reference Card

```
JSDoc Template:
/**
 * Summary sentence.
 *
 * Optional additional context.
 *
 * @param name - Description
 * @returns Description of return value
 * @throws {Error} When this error occurs
 */

Async Function:
// Add: timeout behavior, retry policy, cancellation
// @remarks: side effects, state changes

Error Handling:
// Document: each error type, when it occurs, how to handle

Types:
// Inline comment for each property
// Block comment for the type explaining its purpose

Inline Comments:
// "Why" not "what"
// Keep near the code
// Maintain accuracy
```

---

## Related Documents

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [API_REFERENCE.md](./API_REFERENCE.md) - Public API documentation
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
