# IDE Automation Worker

Cursor-class IDE automation features for StudyLoG.AI.

## Features

### 1. Chat Interface System (`chat/`)
- **Message History**: Persistent conversations with branching support
- **Streaming Responses**: SSE streaming for real-time AI responses
- **Context Window Management**: Token budget management for large contexts
- **Chat Modes**:
  - Vibe Mode: Conversational coding assistance
  - Spec Mode: Structured requirements and specifications

### 2. Code Action System (`actions/`)
- **File Editing**: Apply diffs with unified diff format
- **Multi-file Operations**: Batch edits across multiple files
- **Symbol Search**: Extract and navigate code symbols
- **Refactoring**: AI-powered code refactoring
- **Code Explanation**: Detailed explanations with complexity analysis

### 3. Agent Orchestration (`agents/`)
- **Task Decomposition**: Automatic planning with dependency tracking
- **Planning & Execution**: Multi-step task execution with tool use
- **Error Recovery**: Automatic retry and fallback strategies
- **Progress Reporting**: Real-time progress updates

### 4. Testing Integration (`testing/`)
- **Test Generation**: Generate tests from code (Vitest, Jest, Pytest)
- **Validation**: Code quality checks with rule-based validation
- **Coverage**: Estimate and calculate test coverage
- **Regression Detection**: Compare versions for regressions

### 5. Background Execution (`background/`)
- **Job Queue**: Priority-based async job processing
- **Progress Notifications**: Real-time progress updates
- **Cancellation & Pausing**: Control long-running tasks
- **Retry Logic**: Exponential backoff for failed jobs

### 6. Context Builder (`context/`)
- **File Reading**: Multiple strategies (full, partial, semantic, diff)
- **Symbol Extraction**: Parse functions, classes, interfaces
- **Dependency Mapping**: Track imports and exports
- **RAG Integration**: Vector search for semantic context

### 7. Theia Integration (`theia/`)
- **WebSocket Bridge**: Bidirectional real-time communication
- **Command Palette**: Register IDE commands
- **Panel Widgets**: Dynamic panel management
- **Inline Diff Rendering**: Visual diff display

## API Endpoints

### Chat
- `POST /api/v1/chat/sessions` - Start new session
- `POST /api/v1/chat/sessions/:id/message` - Send message
- `GET /api/v1/chat/sessions/:id` - Get history
- `GET /api/v1/chat/sessions` - List sessions

### Code Actions
- `POST /api/v1/files/edit` - Edit file
- `POST /api/v1/files/create` - Create file
- `GET /api/v1/files/symbols` - Extract symbols
- `POST /api/v1/code/explain` - Explain code

### Agents
- `POST /api/v1/agents/execute` - Execute task
- `GET /api/v1/agents/tasks/:id` - Get status
- `POST /api/v1/agents/tasks/:id/cancel` - Cancel task

### Testing
- `POST /api/v1/tests/generate` - Generate tests
- `POST /api/v1/tests/validate` - Validate code
- `POST /api/v1/tests/quality` - Quality check

### Background Jobs
- `POST /api/v1/jobs` - Enqueue job
- `GET /api/v1/jobs/:id` - Get status
- `GET /api/v1/jobs` - List jobs
- `POST /api/v1/jobs/:id/cancel` - Cancel job

### Context
- `POST /api/v1/context/build` - Build context
- `GET /api/v1/context/symbols` - Extract symbols
- `GET /api/v1/context/dependencies` - Get dependencies

### Theia
- `GET /ws` - WebSocket upgrade
- `POST /api/v1/theia/commands/:id/execute` - Execute command
- `GET /api/v1/theia/commands` - List commands

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Deploy to Cloudflare
npm run deploy
```

## Environment Variables

See `wrangler.toml` for required bindings and secrets.

## Database Schema

See `schema.sql` for the complete database schema.
