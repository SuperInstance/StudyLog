# G-Assist API Worker

Voice-enabled AI assistant for StudyLoG.AI.

## Features

- **Intent routing** via first-mile-router or local keyword classification
- **Multi-agent support** - captain, teacher, builder, tester, director
- **Chat completions** with agent-specific models and system prompts
- **STT/TTS stubs** - placeholder endpoints for future audio implementation

## Agents

| Agent | Model | Role |
|-------|-------|------|
| `captain` | claude-3-5-sonnet | Orchestration and decision-making |
| `teacher` | gpt-4o | Learning and explanations |
| `builder` | claude-3-5-sonnet | Code and implementation |
| `tester` | gpt-4o-mini | Testing and QA |
| `director` | claude-opus-4-5 | High-level architecture guidance |

## API Endpoints

### POST /route
Intent classification and agent routing.

```json
{
  "message": "How do I create a Godot scene?",
  "context": {
    "module": "cognitive-mill",
    "studentId": "student_123"
  }
}
```

Response:
```json
{
  "agent": "teacher",
  "confidence": 0.9,
  "reasoning": "Learning keywords detected, routing to Teacher agent",
  "suggestedModel": "gpt-4o"
}
```

### POST /chat
Send message to an agent.

```json
{
  "agent": "builder",
  "messages": [
    { "role": "user", "content": "Create a basic GDScript node" }
  ],
  "temperature": 0.7
}
```

Response:
```json
{
  "content": "Here's a basic GDScript node template...",
  "agent": "builder",
  "model": "claude-3-5-sonnet",
  "provider": "anthropic"
}
```

### POST /stt
Speech-to-text (stub - not yet implemented).

### POST /tts
Text-to-speech (stub - not yet implemented).

### GET /agents
List all available agents and their configurations.

## Development

```bash
# Local development
wrangler dev

# Deploy
wrangler publish

# View logs
wrangler tail
```

## Configuration

Set environment variables or secrets:

```bash
# Optional: External services
wrangler put variable MULTI_MODEL_ROUTER_URL https://...
wrangler put variable FIRST_MILE_ROUTER_URL https://...

# API keys (for direct provider calls)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY
```
