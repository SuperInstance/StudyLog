# StudyLoG.AI Backend

Cloudflare Workers backend for StudyLoG.AI - free tier compatible, scales to local hardware.

## Quick Start

```bash
# Install dependencies
npm install

# Create Cloudflare resources (first time only)
npm run db:create
npm run kv:create:session
npm run kv:create:rate
npm run r2:create:projects
npm run r2:create:assets
npm run vectorize:create

# Run database migrations
npm run db:migrate:local  # For local dev
npm run db:migrate        # For production

# Start local development
npm run dev
```

## API Endpoints

### Health
```
GET /health
```

### Authentication
```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

### Student Progress
```
GET  /api/v1/student/progress
POST /api/v1/student/progress/:module/start
POST /api/v1/student/progress/:module/advance
GET  /api/v1/student/achievements
POST /api/v1/student/hardware
```

### AI Inference
```
POST /api/v1/ai/chat
POST /api/v1/ai/code
POST /api/v1/ai/embed
POST /api/v1/ai/hint
GET  /api/v1/ai/status
```

### Game State
```
POST /api/v1/game/session/start
POST /api/v1/game/session/:id/save
GET  /api/v1/game/session/:id
POST /api/v1/game/session/:id/end
GET  /api/v1/game/session/active
POST /api/v1/game/puzzle/:id/attempt
```

### Assets
```
POST   /api/v1/assets/project/upload
GET    /api/v1/assets/project/download/:path
GET    /api/v1/assets/project/list
DELETE /api/v1/assets/project/delete/:path
GET    /api/v1/assets/asset/:path
POST   /api/v1/assets/asset/upload
```

## Free Tier Limits

| Service | Limit | Usage |
|---------|-------|-------|
| Workers | 100K req/day | API calls |
| Workers AI | 10K neurons/day | ~300 Llama requests |
| D1 | 5GB storage | User data |
| R2 | 10GB storage | Projects & assets |
| KV | 100K reads/day | Sessions |
| Vectorize | 5M queries/month | Puzzle search |

## Development

```bash
# Type check
npm run typecheck

# Run tests
npm run test

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Environment Variables

Set secrets via Wrangler:
```bash
wrangler secret put JWT_SECRET
wrangler secret put ANTHROPIC_API_KEY
```

Optional (for local AI):
```bash
wrangler secret put OLLAMA_ENDPOINT
```
