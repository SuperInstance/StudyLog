# StudyLoG.AI Roadmap

## Vision

Build **the Minecraft of generative AI** — a self-generating ecosystem where AI creates simulations, the community shares and improves them, and good educators earn reputation.

---

## Phase 1: Foundation ✅ (Mostly Complete)

### Theia IDE Shell
- [x] Basic Theia setup
- [x] Turborepo build system
- [x] Multi-model router backend
- [x] Agent dashboard extension
- [x] Godot WebSocket bridge (bi-directional messaging)
- [x] Godot panel embedding (iframe + process manager)
- [x] Test framework setup (vitest)
- [ ] Sitka Sound simulation (In Progress)

### Technical Debt
- [x] Complete Godot panel embedding
- [x] Test framework setup
- [x] Error handling patterns (WebSocket, middleware)
- [ ] Logging infrastructure (Partially done)

---

## Phase 2: Agentic Code Generation ✅ (Complete)

### Code Generator Worker
```
backend/workers/code-generator/
├── index.ts                 # Main generation logic
├── __tests__/               # Tests
│   └── code-generator.test.ts
└── (templates inline)
```

### Features
| Feature | Description | Status |
|---------|-------------|---------|
| Quality Selector | Fast/cheap → Slow/premium models | ✅ Done |
| Theia Extension Gen | AI generates new extensions | ✅ Done |
| Godot Scene Gen | AI generates .tscn files | ✅ Done |
| Work Ratio | Track AI vs human contribution | ✅ Done |
| Verification | Auto-test generated code | ✅ Done |
| Rollback | Revert bad generations | ✅ Done |
| History | Track all generations | ✅ Done |

### API Endpoints
- ✅ `POST /api/v1/generate` - Generate code
- ✅ `GET /api/v1/generate/history` - Get generation history
- ✅ `POST /api/v1/generate/verify/:id` - Verify generation
- ✅ `POST /api/v1/generate/rollback/:id` - Rollback generation

---

## Phase 3: Bazaar Community Platform ✅ (Complete)

### Database Schema (D1)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  reputation INTEGER DEFAULT 0,
  grain_tokens INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Creations (simulations, puzzles, agents)
CREATE TABLE creations (
  id TEXT PRIMARY KEY,
  author_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT,  -- 'simulation', 'puzzle', 'agent', 'extension'
  millfile TEXT,  -- TOML format
  content_hash TEXT,  -- For deduplication
  quality INTEGER DEFAULT 1,  -- Fuse Grade 1-4
  forks_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Forks
CREATE TABLE forks (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES creations(id),
  child_id TEXT REFERENCES creations(id),
  merged BOOLEAN DEFAULT false,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Feedback (likes, comments, verifications)
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  creation_id TEXT REFERENCES creations(id),
  user_id TEXT REFERENCES users(id),
  type TEXT,  -- 'like', 'comment', 'verification'
  content TEXT,
  grain_tokens INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Merge requests
CREATE TABLE merge_requests (
  id TEXT PRIMARY KEY,
  fork_id TEXT REFERENCES forks(id),
  status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Database Schema (D1)
- ✅ `user_profiles` - User reputation and grain tokens
- ✅ `creations` - Simulations, puzzles, agents, extensions
- ✅ `forks` - GitHub-style fork relationships
- ✅ `feedback` - Likes, comments, verifications
- ✅ `merge_requests` - Propose changes upstream
- ✅ `code_generations` - Track AI generations

### Bazaar Extension
```
apps/theia-ide/extensions/si-bazaar/
├── src/
│   ├── browser/
│   │   ├── bazaar-widget.tsx      # Main UI ✅
│   │   ├── bazaar-service.ts       # API client ✅
│   │   ├── bazaar-menu-contribution.ts  # Menu items ✅
│   │   └── si-bazaar-frontend-module.ts  # Module ✅
│   └── common/
│       └── index.ts               # Types & constants ✅
├── style/
│   └── index.css                  # Styles ✅
├── package.json                   # ✅
└── tsconfig.json                  # ✅
```

### Features
| Feature | Description | Status |
|---------|-------------|---------|
| Browse Creations | View community creations | ✅ Done |
| Share Creation | Publish to bazaar | ✅ Done |
| Like/Comment | Feedback system | ✅ Done |
| Fork Creation | Copy and modify | ✅ Done |
| Merge Request | Propose changes upstream | ✅ Done |
| User Profiles | Reputation, creations | ✅ Done |
| Fuse Grade | Community quality scoring | ✅ Done |
| Grain Tokens | Reward system | ✅ Done |
| Millfile Parser | Parse TOML metadata | ✅ Done |

### API Endpoints
- ✅ `GET /api/v1/bazaar/creations` - Browse creations
- ✅ `GET /api/v1/bazaar/creations/:id` - Get single creation
- ✅ `POST /api/v1/bazaar/creations` - Create creation
- ✅ `POST /api/v1/bazaar/creations/:id/fork` - Fork creation
- ✅ `POST /api/v1/bazaar/creations/:id/feedback` - Add feedback
- ✅ `GET /api/v1/bazaar/profile/:id` - Get user profile
- ✅ `POST /api/v1/bazaar/merge-requests` - Create merge request

### Seed Data
- ✅ `backend/d1/seed-bazaar.sql` - Sample creations, users, feedback

---

## Phase 4: Self-Generation Engine 🔮

### Features
| Feature | Description |
|---------|-------------|
| Adaptive Puzzles | AI generates new puzzles based on student progress |
| Remix Button | AI combines two creations into something new |
| Challenge System | Seasonal challenges with leaderboards |
| Quality Sorting | Best content rises to top |
| Auto-Verification | Community-verifiable test suites |

---

## Phase 5: Multi-Product Expansion 🌐

### Products to Fork
1. **DMLoG.AI** — TTRPG with AI agents as players
2. **MakerLoG.AI** — IoT/Robotics with 3D printing marketplace
3. **FishingLoG.AI** — Ecological simulation (Sitka Sound)

### Shared Infrastructure
- [ ] Unified authentication
- [ ] Cross-product asset sharing
- [ ] Shared Bazaar
- [ ] Product-agnostic agent APIs

---

## Technical Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| M1 | Godot panel fully functional | ✅ Done |
| M2 | Generate simple puzzle | ✅ Done |
| M3 | Share to bazaar | ✅ Done |
| M4 | Fork flow complete | ✅ Done |
| M5 | Quality verification | ✅ Done |
| M6 | Grain token economy | ✅ Done |
| M7 | Deploy to Cloudflare | 🚧 Pending |
| M8 | Full integration test | 🚧 Pending |
| M9 | Self-generation engine | 🔮 Phase 4 |

---

## Immediate Tasks (Next Sprint)

1. **✅ Complete Godot WebSocket Bridge**
   - ✅ Bi-directional messaging
   - ✅ Hot-reload support
   - ✅ Error handling

2. **✅ Code Generator MVP**
   - ✅ Generate simple Theia extension
   - ✅ Generate simple Godot scene
   - ✅ Work ratio tracking

3. **✅ Bazaar Foundation**
   - ✅ D1 schema migrations
   - ✅ Basic CRUD API
   - ✅ Theia extension skeleton
   - ✅ Seed data

### Remaining Tasks

1. **Build & Test**
   - Build all Theia extensions
   - Test in development mode
   - Fix remaining type errors

2. **Deployment**
   - Deploy Cloudflare Workers
   - Run D1 migrations
   - Load seed data
   - Configure R2 storage

3. **Sitka Sound Simulation** (Phase 4)
   - Multi-agent ecosystem
   - Game theory scenarios
   - Fleet communication (A2A)

---

## Working On This

```bash
# Install dependencies
pnpm install

# Start development (all services)
pnpm dev

# Work on specific package
pnpm dev --filter=@studylog/si-bazaar

# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck

# Deploy backend
cd backend && wrangler deploy

# Run database migrations
cd backend && wrangler d1 execute studylog-students --file=./d1/schema.sql

# Load seed data
cd backend && wrangler d1 execute studylog-students --file=./d1/seed-bazaar.sql
```

---

**Remember**: Every layer is a mill. Every agent is a millwright. Every user graduates to building mills.
