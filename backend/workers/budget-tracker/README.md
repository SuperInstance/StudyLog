# Budget Tracker Worker

Free-tier API budget management for StudyLoG.AI backend.

## Overview

The Budget Tracker Worker manages daily API usage budgets across multiple free-tier AI providers. It maximizes free-tier usage while preventing overage charges through intelligent provider rotation and end-of-day knowledge filling.

## Features

- **Pre-call Budget Checks**: Validates sufficient budget before API calls
- **Usage Recording**: Tracks actual token/cost usage after each call
- **Provider Rotation**: Rotates providers based on remaining free tier
- **Alert System**: Notifies when approaching budget limits
- **Fill Knowledge Tasks**: Queues end-of-day tasks to use remaining budget

## Supported Providers

| Provider | Free Tier | Daily Limit | Reset Schedule |
|----------|-----------|-------------|----------------|
| OpenAI | ~$5 for new accounts | $5.00 | Monthly |
| X.ai (Grok) | Limited free | $0.50 | Daily |
| Qwen (Alibaba) | Daily free tier | $1.00 | Daily |
| Google Cloud | $300 credit | $10.00 | Monthly |
| Anthropic | Usage credits | $5.00 | Monthly |
| DeepSeek | Minimal free | $0.50 | Daily |
| Zhipu AI | GLM-4-Flash free | $1.00 | Daily |
| NVIDIA | Free tier | $2.00 | Monthly |
| Ollama | Local (free) | Unlimited | Never |

## API Endpoints

### Configure Provider Budget

```http
POST /budget/configure
Content-Type: application/json

{
  "userId": "user-123",
  "providerId": "openai",
  "apiKey": "sk-...",
  "dailyLimit": 5.00,
  "alertThreshold": 90,
  "mode": "balanced"
}
```

### Get Budget Status

```http
GET /budget/status/:userId
```

Returns comprehensive status for all configured providers including:
- Per-provider usage and remaining budget
- Daily totals
- Alerts for providers near limits
- Recommendation for next provider to use

### Pre-Call Budget Check

```http
POST /budget/check
Content-Type: application/json

{
  "userId": "user-123",
  "providerId": "openai",
  "model": "gpt-4o",
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500
}
```

Response:
```json
{
  "allowed": true,
  "providerId": "openai",
  "remaining": 4.99,
  "remainingPercent": 99.8,
  "estimatedCost": 0.0075,
  "wouldExceed": false,
  "alert": false,
  "message": "Request allowed. Remaining: $4.9900"
}
```

### Record Usage

```http
POST /budget/record
Content-Type: application/json

{
  "userId": "user-123",
  "providerId": "openai",
  "model": "gpt-4o",
  "inputTokens": 1000,
  "outputTokens": 500,
  "cost": 0.0075,
  "latencyMs": 1250,
  "success": true
}
```

### List Providers

```http
GET /budget/providers/:userId
```

### Queue Fill Knowledge Task

```http
POST /budget/fill-knowledge
Content-Type: application/json

{
  "userId": "user-123",
  "providerId": "openai",
  "taskType": "cache-warm",
  "priority": 1,
  "estimatedCost": 0.50
}
```

## Integration with Multi-Model Router

```typescript
import { checkBudget, recordUsage, selectProvider } from './integration';

// Before making API call
const check = await checkBudget(env, {
  userId: 'user-123',
  providerId: 'openai',
  model: 'gpt-4o',
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500,
});

if (!check.allowed) {
  const alternative = await selectProvider(env, {
    userId: 'user-123',
    excludeProvider: 'openai',
  });
  // Use alternative provider
}

// After API call completes
await recordUsage(env, {
  userId: 'user-123',
  providerId: 'openai',
  model: 'gpt-4o',
  inputTokens: 1000,
  outputTokens: 500,
  cost: 0.0075,
});
```

## The Fill Knowledge Strategy

When a provider's free tier is nearly exhausted (>90% used):

1. **Switch Provider**: Route requests to next available free-tier provider
2. **Queue Tasks**: Schedule "fill knowledge" tasks for end-of-day
3. **Use Remaining**: Tasks use last 5-10% for productive work:
   - Generate embeddings for semantic search
   - Warm response cache for common queries
   - Create training data for fine-tuning
   - Summarize documents for faster retrieval
4. **Next Day**: Start fresh with renewed free tier

This ensures every bit of free tier is used productively, with knowledge base benefits carrying forward to reduce future costs.

## Deployment

```bash
# Create D1 database
wrangler d1 create studylog-students

# Create KV namespace
wrangler kv:namespace create BUDGET_CACHE

# Update wrangler.toml with IDs

# Deploy worker
wrangler publish budget-tracker

# Run migrations
wrangler d1 execute studylog-students --file=workers/budget-tracker/schema.sql
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB` | D1 database binding | Yes |
| `BUDGET_CACHE` | KV namespace for caching | Yes |
| `ENCRYPTION_KEY` | API key encryption (optional) | No |

## Database Schema

See [schema.sql](./schema.sql) for the complete database schema.

### Key Tables

- `provider_budgets`: User's API keys and daily limits
- `usage_records`: Track each API call for accurate budgeting
- `budget_alerts`: History of budget limit alerts
- `fill_knowledge_tasks`: End-of-day knowledge expansion tasks
- `provider_rotation_history`: Track provider switching decisions
- `daily_budget_summaries`: Aggregated daily usage per user

## Budget Modes

| Mode | Description | Behavior |
|------|-------------|----------|
| `conservative` | Stop at 90% | Prevents any overage |
| `balanced` | Use full free tier | Allows small overage |
| `aggressive` | Use full + buffer | Uses some paid tier |
| `unlimited` | No budget limits | Dangerous! No tracking |

## License

MIT
