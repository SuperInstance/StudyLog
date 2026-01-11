# StudyLoG.AI Outcome Tracker

Multi-domain reward tracking system for gamified learning analytics, adapted from [SuperInstance/outcome-tracker](https://github.com/SuperInstance/outcome-tracker).

## Overview

The Outcome Tracker provides sophisticated tracking of learning outcomes across multiple domains, with temporal correlation analysis and causal chain tracking.

### Features

- **Multi-Domain Reward Tracking** - Track outcomes across cognitive, collaborative, discovery, efficiency, mastery, and creative domains
- **Temporal Correlation** - Support for immediate, short-term, long-term, and reflective outcomes
- **Causal Chain Tracking** - Trace how learning activities lead to outcomes over time
- **Flexible Aggregation** - Analyze outcomes by time windows, domains, students, or custom criteria
- **Export and Visualization** - JSON export and dashboard widget for progress visualization

## Architecture

```
si-outcome-tracker/
├── src/
│   ├── common/           # Shared types and core logic
│   │   ├── outcome-types.ts       # Type definitions
│   │   ├── outcome-tracker.ts     # Core OutcomeTracker class
│   │   └── outcome-aggregators.ts # Aggregation strategies
│   ├── browser/          # Frontend components
│   │   ├── outcome-dashboard-widget.tsx    # React widget
│   │   ├── outcome-tracker-frontend-service.ts
│   │   └── outcome-dashboard-styles.css
│   └── node/             # Backend service
│       ├── outcome-tracker-service.ts
│       └── si-outcome-tracker-backend-module.ts
```

## Learning Domains

| Domain | Description | Metrics |
|--------|-------------|---------|
| COGNITIVE | Problem-solving, reasoning | Correct answers, attempts, hints used |
| COLLABORATIVE | Peer interaction | Forum posts, helping others, sharing |
| DISCOVERY | Exploration, experimentation | New techniques discovered, experiments |
| EFFICIENCY | Time, resource optimization | Completion time, hints needed |
| MASTERY | Long-term retention | Skill transfer, prerequisites met |
| CREATIVE | Novel solutions | Remixes, innovations, unique approaches |

## Usage Examples

### Tracking Puzzle Completion

```typescript
import { OutcomeTrackerHelpers } from './outcome-tracker-frontend-service';

const helpers = new OutcomeTrackerHelpers(outcomeService);

await helpers.trackPuzzleCompletion(
  'circuit_puzzle_001',  // puzzle ID
  true,                   // success
  2,                      // attempts
  180,                    // time in seconds
  0                       // hints used
);
```

### Tracking Peer Help

```typescript
await helpers.trackPeerHelp(
  'student_123',
  'Circuit design basics'
);
```

### Tracking Discovery

```typescript
await helpers.trackDiscovery(
  'technique',
  'New method for transistor optimization'
);
```

### Domain Mastery Query

```typescript
const mastery = await outcomeService.getDomainMastery();
// Returns: { cognitive: 0.75, collaborative: 0.60, ... }
```

## Outcome Types

- **IMMEDIATE** - Happens right after an action (quiz answers, puzzle completion)
- **SHORT_TERM** - Within the same session (related puzzles, progressive learning)
- **LONG_TERM** - Across multiple sessions (retention, skill transfer)
- **REFLECTIVE** - Self-assessment and journal entries

## Aggregation Examples

```typescript
import { DomainAggregator, TimeWindowAggregator } from './outcome-aggregators';

// Get domain performance summary
const domainAgg = new DomainAggregator(tracker);
const summary = domainAgg.getDomainSummary();

// Get recent activity
const timeAgg = new TimeWindowAggregator(tracker);
const recent = timeAgg.aggregateLastNMinutes(60);
console.log(`Last hour: ${recent.count} activities, ${recent.successRate:.1%} success`);
```

## Integration with ProgressTracker

The OutcomeTracker enhances the existing `ProgressTracker` by providing:

1. **Granular Feedback** - Component-based rewards show exactly what contributed to success
2. **Learning Analytics** - Temporal correlation identifies learning patterns
3. **Progressive Disclosure** - Causal chains inform unlock criteria
4. **Engagement Metrics** - Multi-domain rewards measure different engagement types

### Enhanced Progress Structure

```typescript
interface StudentOutcomeProgress {
  // Existing fields
  currentStage: number;
  completedPuzzles: string[];
  unlockedFeatures: string[];

  // New outcome tracking
  outcomeHistory: OutcomeRecord[];
  domainMastery: Record<StudyLogRewardDomain, number>;
  learningVelocity: number;  // Outcomes per hour
  streakData: {
    current: number;
    longest: number;
    lastActivity: number;
  };
}
```

## Data Storage

Outcomes are persisted to `data/outcomes/outcomes.json` with the following structure:

```json
{
  "outcomes": [
    {
      "decisionId": "puzzle_circuit_001",
      "outcomeType": "immediate",
      "timestamp": 1736524800,
      "description": "Completed circuit puzzle in 2 attempts",
      "success": true,
      "rewards": [
        {
          "domain": "cognitive",
          "value": 0.8,
          "confidence": 0.85,
          "components": {
            "problem_solved": 0.5,
            "few_attempts": 0.3
          },
          "reasoning": "Cognitive outcome: Completed circuit puzzle..."
        }
      ],
      "relatedDecisions": [],
      "causalChain": [],
      "metadata": {
        "context": {
          "decisionType": "cognitive",
          "puzzleId": "circuit_001",
          "attempts": 2
        }
      }
    }
  ],
  "statistics": {
    "totalOutcomes": 42,
    "immediateOutcomes": 35,
    "shortTermOutcomes": 5,
    "longTermOutcomes": 2,
    "avgRewardSignal": 0.65,
    "successRateOverall": 0.83
  }
}
```

## License

MIT
