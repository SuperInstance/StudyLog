# Cross-Product Memory Sharing System

A comprehensive system for transferring memories between StudyLoG.AI and DMLoG.AI so learnings transfer between products seamlessly.

## Overview

**Core Concept:** A student learns problem-solving in StudyLoG.AI -> Their DMLoG.AI character applies those patterns as investigation skills.

### Transfer Examples

**StudyLoG -> DMLoG:**
- `debugging` -> `investigation`
- `collaboration` -> `party coordination`
- `persistence` -> `constitution`
- `creativity` -> `improvisation`
- `communication` -> `persuasion`

**DMLoG -> StudyLoG (Inverse):**
- `tactics` -> `algorithmic thinking`
- `roleplay` -> `empathy`
- `world-building` -> `system design`
- `party coordination` -> `collaboration`

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { createCrossProductMemorySystem } from './index.js';

const system = createCrossProductMemorySystem();

// Link user identities across products
await system.linkIdentities(
  'studylog', 'user_123',
  'dmlog', 'user_456'
);

// Transfer a memory
const result = await system.transferMemory({
  sourceProduct: 'studylog',
  targetProduct: 'dmlog',
  sourceUserId: 'user_123',
  memory: {
    id: 'mem_abc',
    content: 'Successfully debugged a complex algorithm',
    tier: 'procedural',
    importance: 8,
    emotionalValence: 0.7,
    timestamp: Date.now(),
    tags: ['debugging', 'persistence'],
    metadata: {}
  }
});

console.log(result); // { success: true, transferId: 'transfer_xxx' }
```

## Module Structure

| File | Lines | Description |
|------|-------|-------------|
| `types.ts` | 903 | Complete type definitions for all cross-product operations |
| `memory-transfer.ts` | 1027 | Core engine for transferring memories between products |
| `pattern-mapper.ts` | 1066 | Maps patterns from one product context to another |
| `shared-identity.ts` | 1016 | Manages unified user identity across all products |
| `skill-synthesis.ts` | 801 | Combines skills from multiple products into unified skills |
| `learning-analytics.ts` | 960 | Tracks cross-product growth and provides insights |
| `transfer-rules.ts` | 1030 | Defines what transfers (and what doesn't) |
| `index.ts` | 690 | Main API and factory functions |

**Total:** 7,493 lines of TypeScript

## Key Features

### 1. Memory Transfer (`memory-transfer.ts`)

- Bidirectional transfer between StudyLoG and DMLoG
- Content transformation for target product context
- Confidence scoring and evidence gathering
- Conflict resolution
- Batch transfer operations

### 2. Pattern Mapping (`pattern-mapper.ts`)

- 20+ StudyLoG patterns (debugging, hypothesis testing, collaboration, etc.)
- 10+ DMLoG patterns (tactics, roleplay, investigation, etc.)
- Semantic and structural mapping algorithms
- Learning from user feedback
- Custom mapping support

### 3. Shared Identity (`shared-identity.ts`)

- Unified ID across all products
- Cross-product traits (persistence, curiosity, etc.)
- Unified skills with product-specific levels
- Preference management (sync matrix, privacy)
- Identity profile analytics

### 4. Skill Synthesis (`skill-synthesis.ts`)

- Detects similar skills across products
- Creates unified higher-level skills
- Quality validation
- Synthesis candidates and rejections
- Cross-product skill analysis

### 5. Learning Analytics (`learning-analytics.ts`)

- Cross-product growth metrics
- Synergy score calculation
- Product breakdown
- Transfer statistics
- Personalized recommendations
- Trend analysis

### 6. Transfer Rules (`transfer-rules.ts`)

- Eligibility rules (what can transfer)
- Approval rules (when user approval needed)
- Privacy rules (data protection)
- Custom user rules
- Rule builder API

## API Reference

### Main System

```typescript
const system = createCrossProductMemorySystem({
  enableTransfer: true,
  enablePatterns: true,
  enableSynthesis: true,
  enableAnalytics: true,
  enableRules: true,
  persistData: false,
});
```

### Identity Management

```typescript
// Get unified identity
const identity = await system.getIdentity('studylog', 'user_123');

// Link identities
await system.linkIdentities('studylog', 'user_123', 'dmlog', 'user_456');

// Get unified ID
const unifiedId = system.getUnifiedId('studylog', 'user_123');
```

### Memory Transfer

```typescript
// Transfer memory
const result = await system.transferMemory({
  sourceProduct: 'studylog',
  targetProduct: 'dmlog',
  sourceUserId: 'user_123',
  memory: { /* memory data */ },
  characterName: 'Hero'
});

// Approve pending transfer
await system.approveTransfer(transferId);

// Get pending transfers
const pending = await system.getPendingTransfers(unifiedId);
```

### Pattern Recognition

```typescript
// Recognize patterns in content
const patterns = system.recognizePatterns(
  'Successfully debugged the algorithm',
  'studylog',
  ['debugging', 'persistence']
);

// Map pattern to target product
const mapping = system.mapPattern('sl_debugging', 'studylog', 'dmlog');
```

### Analytics

```typescript
// Get cross-product analytics
const analytics = await system.getAnalytics(unifiedId, 'month');

// Record practice event
await system.recordPractice(unifiedId, 'studylog', 'problem_solving', 0.8, 3600000);

// Analyze trends
const trends = system.analyzeTrends(unifiedId, 'overall_growth', 'week');
```

## Transfer Categories

| Category | StudyLoG Term | DMLoG Term |
|----------|---------------|------------|
| PROBLEM_SOLVING | Debugging | Investigation |
| CRITICAL_THINKING | Analysis | Insight |
| CREATIVITY | Creative Solutions | Improvisation |
| COLLABORATION | Teamwork | Party Coordination |
| COMMUNICATION | Presentation | Persuasion |
| EMPATHY | Perspective Taking | Roleplay |
| LEADERSHIP | Group Leader | Command |
| PERSISTENCE | Productive Struggle | Constitution |
| CURIOSITY | Exploration | Perception |
| ALGORITHMIC_THINKING | Procedures | Tactics |
| SYSTEMS_THINKING | System Analysis | World Building |

## Development

```bash
# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test
```

## License

MIT

---

**SuperInstance.AI** - Building the Minecraft of generative agent-based open worlds.
