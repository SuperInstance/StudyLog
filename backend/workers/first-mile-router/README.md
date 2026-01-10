# First-Mile Router Worker

Fast AI routing layer before expensive LLM calls.

## Purpose

This worker is the "first mile" of request processing — it quickly classifies user intent and recommends the appropriate AI provider/model BEFORE calling the expensive multi-model-router.

## How It Works

1. **Keyword Classification (Fastest)**: First tries to match patterns using regex/keywords
2. **AI Classification (Fast)**: If keywords inconclusive, uses Cloudflare Workers AI with a fast free model
3. **Caching**: Results are cached in KV for 1-24 hours depending on intent
4. **Recommendation**: Returns provider/model recommendation to the caller

## Intent Types

| Intent | Description | Recommended Provider |
|--------|-------------|---------------------|
| `code-help` | Code generation, debugging, refactoring | Anthropic (Claude) |
| `explanation` | Concept explanation, tutorials | OpenAI (GPT-4) |
| `simulation` | Godot scenes, physics, game logic | Anthropic (Claude) |
| `bazaar` | Community features, sharing, forking | Fast (GPT-4o-mini) |
| `creative` | Creative writing, storytelling | OpenAI (GPT-4) |
| `analysis` | Data analysis, patterns | Google (Gemini) |
| `general` | Fallback | OpenAI (GPT-4o-mini) |

## API Endpoints

### POST /classify
Classify a single message.

```json
// Request
{
  "message": "How do I create a rigid body in Godot?",
  "context": {
    "module": "cognitive-mill",
    "studentId": "user_123"
  }
}

// Response
{
  "intent": "simulation",
  "recommendedProvider": "anthropic",
  "recommendedModel": "claude-3-5-sonnet",
  "confidence": 0.9,
  "reasoning": "Godot/scene work routed to Claude for technical accuracy",
  "bypassRouter": false,
  "suggestedCacheTtl": 3600,
  "cached": false,
  "usedAI": false
}
```

### POST /classify-batch
Classify multiple messages at once.

```json
// Request
{
  "messages": [
    "Explain what a vector is",
    "Fix this bug in my code",
    "Share my scene to the bazaar"
  ]
}

// Response
{
  "results": [
    { "message": "...", "intent": "explanation", ... },
    { "message": "...", "intent": "code-help", ... },
    { "message": "...", "intent": "bazaar", ... }
  ]
}
```

### GET /intents
Get all available intent types.

### GET /recommendations
Get provider/model recommendations for each intent.

### GET /
Health check endpoint.

## Development

```bash
# Local development
npm run dev

# Deploy to Cloudflare
npm run deploy

# View logs
npm run tail

# Run tests
npm test

# Type check
npm run typecheck
```

## Cost Savings

- **Keyword classification**: Free, ~1ms latency
- **Workers AI classification**: ~$0.0001 per 1K requests, ~50ms latency
- **Multi-model-router**: $0.002-$0.03 per request, ~500ms latency

By classifying first, we can:
1. Route to cheapest appropriate provider
2. Cache responses for repeat queries
3. Bypass LLM entirely for some requests (e.g., bazaar metadata)

## Integration

The caller should:

1. Call `/classify` with user message
2. Use `recommendedProvider` and `recommendedModel` in subsequent request
3. If `bypassRouter` is true, handle without calling LLM
4. Cache results based on `suggestedCacheTtl`
