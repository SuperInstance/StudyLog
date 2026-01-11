# Vibe-Coding Chat Interface

Cursor/Windsurf style streaming chat for StudyLoG.AI with real-time code generation, diff visualization, and context awareness.

## Features

- **Streaming Responses**: Server-Sent Events (SSE) for real-time AI responses
- **Code Context**: Workspace file awareness with smart context building
- **Diff Generation**: Apply-able unified diffs for code changes
- **Conversation Memory**: Persistent chat history with branching support
- **WebSocket Support**: Real-time bidirectional communication
- **Multi-Model Routing**: Integration with StudyLoG's multi-model router

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Vibe-Coding Worker                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────┐ │
│  │ Chat Service│ │Context Builder│ │Diff Generator│ │WebSocket │ │
│  │             │ │              │ │             │ │ Handler  │ │
│  └──────┬──────┘ └──────┬───────┘ └──────┬──────┘ └────┬─────┘ │
│         │               │                │             │         │
│         └───────────────┴────────────────┴─────────────┘         │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │Conversation Memory│                          │
│                   │  (KV + D1)       │                          │
│                   └────────┬─────────┘                          │
└────────────────────────────┼─────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
    Multi-Model            KV Storage            D1 Database
    Router API          (Chat History)        (Persistence)
```

## File Structure

```
src/
├── index.ts              # Main entry point, API routes
├── types.ts              # TypeScript type definitions
├── utils.ts              # Utility functions (ID generation, etc.)
├── chat-service.ts       # Main chat service with streaming
├── context-builder.ts    # Workspace context gathering
├── diff-generator.ts     # Apply-able diff generation
├── conversation-memory.ts# Session persistence (KV + D1)
├── streaming.ts          # SSE stream processing
└── websocket-handler.ts  # WebSocket connection handling
```

## API Endpoints

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | Send chat message (streaming) |
| POST | `/v1/chat/completions?stream=false` | Send chat message (non-streaming) |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/sessions` | List user's sessions |
| POST | `/v1/sessions` | Create new session |
| GET | `/v1/sessions/:id` | Get session details |
| DELETE | `/v1/sessions/:id` | Delete session |
| PUT | `/v1/sessions/:id/context` | Update context files |
| POST | `/v1/sessions/:id/branches` | Create branch |
| PUT | `/v1/sessions/:id/branches/:branchId` | Switch branch |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws` | WebSocket connection for real-time chat |

## Usage

### Streaming Chat Request

```typescript
const response = await fetch('https://vibe-coding.studylog.ai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({
    userId: 'user_123',
    workspaceId: 'workspace_456',
    message: 'How do I create a React component?',
    mode: 'vibe',
    model: 'deepseek-chat',
    stream: true,
    contextFiles: [
      {
        path: 'src/App.tsx',
        content: 'export default function App() { ... }',
        language: 'typescript',
      }
    ]
  }),
});

// Read SSE stream
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  // Parse: data: {"type":"content","content":"..."}
}
```

### WebSocket Connection

```typescript
const ws = new WebSocket('wss://vibe-coding.studylog.ai/ws?userId=user_123');

ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'stream':
      // Stream chunk
      console.log(message.data.content);
      break;
    case 'done':
      // Complete
      break;
  }
});

// Send chat message
ws.send(JSON.stringify({
  type: 'chat',
  data: {
    userId: 'user_123',
    workspaceId: 'workspace_456',
    message: 'Explain this code...',
  }
}));
```

## Chat Modes

| Mode | Description |
|------|-------------|
| `vibe` | General coding assistance (default) |
| `spec` | Technical specification generation |
| `refactor` | Code refactoring suggestions |
| `debug` | Bug identification and fixes |

## Stream Chunk Types

| Type | Description |
|------|-------------|
| `content` | Text content delta |
| `diff` | Code diff for preview |
| `file` | New file creation |
| `metadata` | Token usage, cost |
| `status` | Status update (thinking, etc.) |
| `error` | Error message |
| `done` | Stream complete |

## Deployment

```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Deploy to Cloudflare
pnpm deploy

# Set secrets
wrangler secret put DEEPSEEK_API_KEY
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `ZHIPU_API_KEY` | Zhipu AI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google API key |
| `NVIDIA_API_KEY` | NVIDIA API key |
| `MULTI_MODEL_ROUTER_URL` | Router URL (default: studylog.ai) |

## Schema

The database schema is defined in `schema.sql`:

- `chat_sessions`: Session persistence
- `context_files`: Workspace file cache
- `code_symbols`: Symbol/index cache
- `chat_usage`: Token usage tracking
- `file_edits`: Edit history
- `feedback`: User feedback

## Integration

The vibe-coding worker integrates with:

- **Multi-Model Router**: LLM routing with fallbacks
- **Context Builder**: Workspace file analysis
- **Conversation Memory**: KV + D1 persistence
- **WebSocket Handler**: Real-time communication
