# Memory Optimizer Worker

Optimizes the 6-tier memory system for StudyLoG.AI with episodic-to-semantic consolidation, fast retrieval, temporal landmark detection, narrative building, and cross-product memory sync.

## Features

### 1. Memory Consolidation (`consolidation.ts`)
- Episodic to semantic clustering
- Sleep-like consolidation cycles
- Pattern extraction across related memories
- Forgetting curve application
- Spaced repetition scheduling
- Prerequisite relationship discovery

### 2. Fast Retrieval (`retrieval.ts`)
- Vector similarity search with embedding support
- Hybrid scoring (relevance + recency + importance)
- Pedagogical retrieval mode
- Zone of Proximal Development (ZPD) matching
- Prerequisite bridging

### 3. Temporal Landmarks (`landmarks.ts`)
- First-time event detection
- Breakthrough moment recognition
- Milestone tracking
- Social learning events
- Struggle-to-success arcs (comebacks)

### 4. Narrative Builder (`narrative-builder.ts`)
- Autobiographical story generation
- Temporal chaptering
- Hero's journey narrative structure
- Growth dimension analysis
- Markdown export

### 5. Cross-Product Sync (`cross-product-sync.ts`)
- StudyLoG <-> DMLoG memory transfer
- Subject-to-character-class mapping
- Skill transformation between products
- Bidirectional sync with conflict resolution

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory Optimizer Worker                  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ Consolidation │ │   Retrieval   │ │    Landmarks     │  │
│  │   Engine      │ │    Engine     │ │    Detector      │  │
│  └───────────────┘ └──────────────┘ └──────────────────┘  │
│  ┌───────────────┐ ┌──────────────┐                        │
│  │    Narrative  │ │ Cross-Product│                        │
│  │    Builder    │ │     Sync      │                        │
│  └───────────────┘ └──────────────┘                        │
├─────────────────────────────────────────────────────────────┤
│                     API Endpoints                           │
├─────────────────────────────────────────────────────────────┤
│  POST /memory/store     - Store episodic memory             │
│  POST /consolidate      - Run consolidation cycle           │
│  POST /retrieve         - Search memories                   │
│  GET  /landmarks/:id    - Get temporal landmarks            │
│  POST /narrative        - Generate autobiography            │
│  POST /sync             - Cross-product memory sync         │
│  GET  /stats/:id        - Get student statistics            │
└─────────────────────────────────────────────────────────────┘
```

## Memory Tiers

The 6-tier memory hierarchy:

| Tier | Duration | Description |
|------|----------|-------------|
| **Working** | 0-1 hr | Current attention, active learning |
| **Mid-Term** | 1-6 hr | Session buffer, recent exercises |
| **Long-Term** | 1+ wk | Consolidated storage |
| **Episodic** | Permanent | Specific events "what-where-when" |
| **Semantic** | Permanent | Abstracted patterns and facts |
| **Procedural** | Permanent | Skills and learned behaviors |

## API Usage

### Store a Memory

```bash
curl -X POST https://your-worker.workers.dev/memory/store \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_123",
    "content": "Finally understood recursion!",
    "subject": "computer-science",
    "topic": "recursion",
    "difficulty": 7,
    "successLevel": 0.8,
    "importance": 8,
    "emotionalValence": 0.9,
    "tags": ["breakthrough", "algorithms"]
  }'
```

### Consolidate Memories

```bash
curl -X POST https://your-worker.workers.dev/consolidate \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_123"
  }'
```

### Retrieve Memories

```bash
curl -X POST https://your-worker.workers.dev/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_123",
    "query": "recursive algorithms",
    "options": {
      "topK": 10,
      "mode": "pedagogical",
      "learningContext": {
        "currentTopic": "recursion",
        "skillLevel": 0.6
      }
    }
  }'
```

### Generate Narrative

```bash
curl -X POST https://your-worker.workers.dev/narrative \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_123",
    "config": {
      "namingScheme": "journey",
      "tone": "storytelling"
    }
  }'
```

### Cross-Product Sync

```bash
curl -X POST https://your-worker.workers.dev/sync \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student_123",
    "targetProduct": "dmlog",
    "direction": "studylog_to_dmlog"
  }'
```

## Deployment

```bash
# Install dependencies
npm install

# Deploy to Cloudflare Workers
wrangler publish

# Create KV namespace
wrangler kv:namespace create "MEMORY_CACHE"

# Create D1 database
wrangler d1 create studylog_memory_db
```

## Development

```bash
# Local development
wrangler dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Configuration

Set in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "MEMORY_CACHE"
id = "your-kv-namespace-id"

[[d1_databases]]
binding = "DB"
database_name = "studylog_memory_db"
database_id = "your-database-id"
```

## Cross-Product Mappings

Default StudyLoG to DMLoG mappings:

| StudyLoG Subject | DMLoG Class |
|------------------|-------------|
| mathematics | Wizard |
| physics | Artificer |
| chemistry | Alchemist |
| biology | Druid |
| computer-science | Artificer |
| history | Bard |
| literature | Bard |

## StudyLoG.AI Optimizations

- **Learning Progression Tracking**: Mastery levels per topic
- **Prerequisite Detection**: Discovers concept dependencies
- **ZPD Matching**: Finds content at the right difficulty
- **Spaced Repetition**: Schedules reviews based on forgetting curve
- **Struggle Recovery**: Tracks comebacks after difficulty

## License

MIT
