# @studylog/escalation

Intelligent decision routing for cost-optimized AI usage in StudyLoG.AI.

Based on the [Escalation Engine](https://github.com/SuperInstance/escalation-engine) pattern, this package provides a three-tier routing system that can reduce AI costs by up to 40x through intelligent decision routing.

## Features

- **Three-Tier Routing**: Bot (free), Brain (local LLM), Human (cloud API)
- **Confidence-Based Escalation**: Route based on decision confidence
- **Novelty Detection**: Detect when students encounter new concepts
- **Adaptive Learning**: Adjust thresholds based on outcomes
- **Stuck Student Detection**: Auto-escalate when students are struggling
- **Phase-Specific Thresholds**: Different behavior per learning phase
- **Cost Tracking**: Monitor and optimize spending

## Installation

```bash
pnpm add @studylog/escalation
```

## Quick Start

```typescript
import { EscalationEngine, createContext } from '@studylog/escalation';

// Initialize the engine
const engine = new EscalationEngine();

// Create a decision context
const context = createContext('student-123', 'coding', 'How do I write a loop?', {
  stakes: 0.3,          // Low stakes
  similarDecisionsCount: 10,  // Seen before
  currentPhase: 'cognitive-mill',
});

// Route the decision
const decision = engine.routeDecision(context);

console.log(`Route to: ${decision.source}`); // BOT, BRAIN, or HUMAN
console.log(`Reason: ${decision.reason}`);
console.log(`Confidence required: ${decision.confidenceRequired}`);
```

## Decision Sources

| Source | Description | Cost | Speed | Use When |
|--------|-------------|------|-------|----------|
| **BOT** | Rule-based, deterministic | Free | <10ms | Routine decisions, FAQ, familiar concepts |
| **BRAIN** | Local LLM (Ollama) | ~$0 | 100-500ms | Novel situations, medium stakes |
| **HUMAN** | Cloud API (Anthropic/OpenAI) | $0.01-0.10 | 500-2000ms | Critical stakes, stuck students, safety concerns |

## Usage Examples

### Basic Routing

```typescript
import { EscalationEngine, createContext, createDecisionResult, estimateCost } from '@studylog/escalation';

const engine = new EscalationEngine();

// Route a decision
const context = createContext('student-123', 'quiz', 'Help with question 5', {
  stakes: 0.5,
  progressRatio: 0.6,
  recentFailures: 0,
});

const decision = engine.routeDecision(context);

// Record the decision
const result = createDecisionResult(decision.source, 'Provided hint', 0.85, {
  timeTakenMs: 50,
  costEstimate: estimateCost(decision.source),
  metadata: { studentId: context.studentId },
});

engine.recordDecision(result);

// Later, record outcome
engine.recordOutcome(result.decisionId, true);
```

### Custom Thresholds per Student

```typescript
// Advanced students get more bot usage
engine.setThresholds('advanced-student', {
  botMinConfidence: 0.5,  // Lower threshold = more bot usage
  brainMinConfidence: 0.3,
});

// Beginners get more oversight
engine.setThresholds('beginner-student', {
  botMinConfidence: 0.85,  // Higher threshold = more brain/human
  brainMinConfidence: 0.7,
});
```

### Phase-Specific Thresholds

```typescript
// Cognitive Mill - Learning phase, escalate more
engine.setPhaseThresholds('cognitive-mill', {
  botMinConfidence: 0.8,
  brainMinConfidence: 0.6,
  noveltyThreshold: 0.5,  // Sensitive to new concepts
});

// Intelligence Ranch - Practice phase, use cheaper models
engine.setPhaseThresholds('intelligence-ranch', {
  botMinConfidence: 0.6,
  brainMinConfidence: 0.4,
  noveltyThreshold: 0.7,  // Less sensitive
});
```

### Tracking Statistics

```typescript
// Global statistics
const globalStats = engine.getGlobalStats();
console.log(`
  Total decisions: ${globalStats.totalDecisions}
  Bot: ${globalStats.botDecisions}
  Brain: ${globalStats.brainDecisions}
  Human: ${globalStats.humanDecisions}
  Total cost: $${globalStats.totalCost.toFixed(4)}
  Cost savings: $${globalStats.costSavings.toFixed(2)}
  Reduction ratio: ${globalStats.costReductionRatio.toFixed(1)}x
`);

// Per-student statistics
const studentStats = engine.getStudentStats('student-123');
console.log(`
  Student: ${studentStats.studentId}
  Success rate: ${(studentStats.successRate * 100).toFixed(1)}%
  Avg confidence: ${studentStats.avgConfidence.toFixed(2)}
  Total cost: $${studentStats.totalCost.toFixed(4)}
`);
```

## Integration with Multi-Model Router

```typescript
import { EscalationModelRouter } from '@studylog/escalation/integration';

const escalationRouter = new EscalationModelRouter(modelRouter);

const response = await escalationRouter.route({
  studentId: 'student-123',
  situationType: 'coding',
  message: 'How do I write a for loop?',
  stakes: 0.3,
  currentPhase: 'cognitive-mill',
});

console.log(response.content);
console.log(`Used: ${response.source} (${response.provider}/${response.model})`);
console.log(`Cost: $${response.cost.toFixed(4)}`);
```

### Custom Rule Handlers

```typescript
// Register a rule handler for FAQ
escalationRouter.registerRuleHandler('faq', (request) => {
  if (request.message.includes('password')) {
    return 'Go to Settings > Account > Reset Password';
  }
  return 'Check our documentation at docs.studylog.ai';
});

// Or use helper functions
import { createStaticRuleHandler, createKeywordRuleHandler } from '@studylog/escalation/integration';

escalationRouter.registerRuleHandler('greeting', createStaticRuleHandler(
  'Welcome to StudyLoG.AI! How can I help you learn today?'
));

escalationRouter.registerRuleHandler('quick-help', createKeywordRuleHandler({
  'loop': 'A loop repeats code. Common types: for, while, for-each.',
  'function': 'A function is a reusable block of code.',
  'variable': 'A variable stores data in memory.',
}));
```

## API Reference

### EscalationEngine

| Method | Description |
|--------|-------------|
| `routeDecision(context)` | Route a decision to appropriate source |
| `recordDecision(result)` | Record a decision for history |
| `recordOutcome(id, success)` | Record outcome for learning |
| `shouldEscalate(result, context)` | Check if should escalate |
| `getThresholds(studentId)` | Get thresholds for student |
| `setThresholds(studentId, thresholds)` | Set custom thresholds |
| `setPhaseThresholds(phase, thresholds)` | Set phase thresholds |
| `getStudentStats(studentId)` | Get student statistics |
| `getGlobalStats()` | Get global statistics |
| `resetStats()` | Reset all statistics |
| `createDecisionId()` | Create unique decision ID |

### DecisionContext

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `studentId` | string | - | Student ID |
| `situationType` | string | - | Type of situation |
| `situationDescription` | string | - | Description |
| `stakes` | number | 0.5 | Importance (0-1) |
| `urgencyMs` | number? | - | Time available |
| `progressRatio` | number | 0.5 | Student progress (0-1) |
| `availableResources` | object | {} | Resources available |
| `similarDecisionsCount` | number | 0 | Similar situations seen |
| `recentFailures` | number | 0 | Recent failures |
| `currentPhase` | LearningPhase | 'cognitive-mill' | Current phase |

### EscalationDecision

| Property | Type | Description |
|----------|------|-------------|
| `source` | DecisionSource | BOT, BRAIN, or HUMAN |
| `reason` | EscalationReason? | Why this routing was chosen |
| `confidenceRequired` | number | Minimum confidence required |
| `timeBudgetMs` | number? | Time budget for decision |
| `allowFallback` | boolean | Whether fallback is allowed |
| `metadata` | object | Additional metadata |

## Cost Savings

### Traditional Approach
```
1000 decisions/day x $0.02 = $20/day
```

### Escalation Engine Approach
```
700 Bot decisions x $0 = $0
250 Brain decisions x $0 = $0
50 Human decisions x $0.02 = $1
Total: $1/day = 40x reduction
```

## License

MIT

## Credits

Based on [escalation-engine](https://github.com/SuperInstance/escalation-engine) by SuperInstance.
