# @studylog/training-collector

Training data collection for StudyLoG.AI - Collect learning events, track outcomes, and export training data for AI fine-tuning.

Based on research from [SuperInstance/training-data-collector](https://github.com/SuperInstance/training-data-collector), adapted for educational contexts and Theia IDE integration.

## Features

- **Learning Event Capture**: Log student interactions with full context (learning state, student state, environment)
- **Outcome Tracking**: Associate decisions with outcomes and success metrics
- **Multi-Format Export**: JSON, JSONL, CSV, and QLoRA-compatible formats
- **Quality Filtering**: Filter by quality score, confidence, and explicit teaching moments
- **Privacy Controls**: Per-student settings for data collection and retention
- **Session Management**: Track learning events across sessions
- **Storage Options**: SQLite (Node.js), IndexedDB (browser), or in-memory

## Installation

```bash
npm install @studylog/training-collector
```

## Quick Start

```typescript
import {
  TrainingDataCollector,
  LearningContext,
  LearningDecisionType,
  DecisionSource,
  LearningModule,
  QualityLabel
} from '@studylog/training-collector';

// Initialize the collector
const collector = new TrainingDataCollector();
await collector.init({ type: 'sqlite', dbPath: './data/training.db' });

// Start a learning session
const sessionId = await collector.startSession({
  studentIds: ['student-123'],
  module: 'cognitive_mill',
  notes: 'Introduction to Neural Networks'
});

// Log a learning event
const recordId = await collector.logDecision({
  studentId: 'student-123',
  context: {
    learningState: {
      module: LearningModule.COGNITIVE_MILL,
      lesson: 'Gradient Descent',
      exercise: 'Implement from scratch',
      progress: 0.3,
      lessonProgress: 0.5,
      objectives: ['Understand gradient descent', 'Implement algorithm'],
      currentDifficulty: 0.6,
      timeSpentOnLesson: 900,
      timeSpentOnExercise: 300,
    },
    studentState: {
      knowledgeLevel: 0.4,
      engagement: 0.8,
      fatigue: 0.2,
      confidence: 0.6,
      consecutiveMistakes: 1,
      consecutiveSuccesses: 0,
      streak: 0,
      skillLevels: { python: 0.7, ml: 0.3 },
    },
    perceptionData: {
      visibleHints: ['Derivative formula', 'Step size guidance'],
      availableTools: ['code-editor', 'python-interpreter'],
    },
  },
  decision: {
    decisionType: LearningDecisionType.PROBLEM_SOLVING,
    action: 'Implement gradient descent function',
    reasoning: 'Student applied lesson concepts to write the algorithm',
    confidence: 0.7,
    source: DecisionSource.STUDENT,
    stakes: 0.6,
  },
  sessionId,
});

// Update with outcome after assessment
await collector.updateOutcome({
  recordId,
  outcome: {
    success: true,
    immediate: 'Code executed correctly with test cases',
    delayed: 'Student demonstrated understanding in follow-up questions',
    rewards: [
      { type: 'xp', value: 50, description: 'Completed exercise' },
      { type: 'mastery', value: 0.1, description: 'Increased ML skill' },
    ],
    qualityScore: 0.8,
    qualityLabel: QualityLabel.GOOD,
    metrics: {
      timeTaken: 45000,
      attempts: 2,
      hintsUsed: 1,
      codeQuality: 0.85,
      correctnessScore: 0.9,
    },
  },
});

// Get statistics
const stats = await collector.getStatistics('student-123');
console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
console.log(`Average quality: ${(stats.averageQuality * 100).toFixed(1)}%`);

// Export for training
await collector.exportQLoRA('student-123', './training_data.jsonl', {
  minConfidence: 0.5,
  minQuality: QualityLabel.ACCEPTABLE,
});

// End session
await collector.endSession();
await collector.close();
```

## Data Models

### LearningContext

Full context surrounding a learning decision:

```typescript
interface LearningContext {
  learningState: LearningState;      // Current module, progress, objectives
  studentState: StudentState;        // Knowledge level, engagement, fatigue
  perceptionData?: PerceptionData;   // What student sees/has available
  additionalContext?: Record<string, unknown>;
}
```

### LearningDecision

A decision made by a student, AI tutor, or system:

```typescript
interface LearningDecision {
  decisionType: LearningDecisionType;
  action: string;
  reasoning: string;
  confidence: number;              // 0-1
  source: DecisionSource;          // STUDENT, AI_TUTOR, RULE_ENGINE, etc.
  stakes: number;                  // 0-1 importance
  metadata?: Record<string, unknown>;
}
```

### LearningOutcome

The result of a learning decision:

```typescript
interface LearningOutcome {
  success: boolean;
  immediate: string;               // Immediate result description
  delayed?: string;                // Delayed/secondary result
  rewards?: Reward[];              // XP, mastery, badges, etc.
  penalties?: Penalty[];           // Streak reset, etc.
  qualityScore: number;            // 0-1 computed quality
  qualityLabel?: QualityLabel;     // EXCELLENT, GOOD, ACCEPTABLE, etc.
  notes?: string;
  metrics?: OutcomeMetrics;        // timeTaken, attempts, hintsUsed, etc.
}
```

## Export Formats

### QLoRA Format

For instruction-tuning language models:

```json
{
  "instruction": "How should I solve this problem?",
  "input": "Module: Cognitive Mill\nLesson: Gradient Descent\nProgress: 30%\nKnowledge Level: 40%\nEngagement: 80%\nAvailable Hints: 2\nImportance: 60%",
  "output": "Action: Implement gradient descent function\nReasoning: Student applied lesson concepts to write the algorithm\nConfidence: 70%\nResult: Code executed correctly with test cases\nThis action was successful.",
  "metadata": {
    "recordId": "rec_1234567890_abc123",
    "studentId": "student-123",
    "decisionType": "problem_solving",
    "module": "cognitive_mill",
    "qualityLabel": "good",
    "success": true,
    "confidence": 0.7
  }
}
```

### JSON/JSONL Formats

Full data export with all metadata:

```json
{
  "exportTimestamp": "2026-01-10T12:00:00.000Z",
  "totalRecords": 150,
  "metadata": {
    "studentCounts": { "student-123": 150 },
    "successRate": 0.78
  },
  "records": [
    {
      "recordId": "rec_1234567890_abc123",
      "studentId": "student-123",
      "timestamp": 1704883200000,
      "context": { ... },
      "decision": { ... },
      "outcome": { ... }
    }
  ]
}
```

## Privacy Controls

Per-student data collection settings:

```typescript
import { StudentDataSettings } from '@studylog/training-collector';

await collector.updateStudentSettings({
  studentId: 'student-123',
  enabled: true,
  collectStudentDecisions: true,
  collectAITutorDecisions: true,
  collectRuleEngineDecisions: false,
  collectHumanTutorDecisions: true,
  retentionDays: 90,
  trainingEligible: true,
  anonymizeForTraining: true,
});
```

## Storage Options

### SQLite (Node.js Backend)

```typescript
const collector = new TrainingDataCollector();
await collector.init({ type: 'sqlite', dbPath: './data/training.db' });
```

### Memory (Testing/Fallback)

```typescript
const collector = new TrainingDataCollector();
await collector.init({ type: 'memory' });
```

### IndexedDB (Browser/Theia Extension)

```typescript
const collector = new TrainingDataCollector();
await collector.init({ type: 'indexeddb', dbName: 'StudyLoGTraining' });
```

## API Reference

### TrainingDataCollector

Main collector class for managing training data.

#### Methods

- `init(config?: StorageConfig): Promise<void>` - Initialize the collector
- `startSession(options): Promise<string>` - Start a new learning session
- `endSession(): Promise<SessionInfo>` - End current session
- `logDecision(options): Promise<string>` - Log a learning decision
- `updateOutcome(options): Promise<void>` - Update with outcome
- `updateQualityLabel(options): Promise<void>` - Update quality label
- `getRecord(recordId): Promise<LearningRecord>` - Get a record
- `getRecords(studentId, options?): Promise<LearningRecord[]>` - Get records for student
- `getTrainingRecords(studentId, options?): Promise<LearningRecord[]>` - Get training-eligible records
- `getStatistics(studentId?, sessionId?): Promise<CollectionStatistics>` - Get statistics
- `deleteRecord(recordId): Promise<boolean>` - Delete a record
- `cleanupOldRecords(studentId): Promise<number>` - Clean up old records
- `export(options): Promise<ExportResult>` - Export training data
- `close(): Promise<void>` - Close the collector

## StudyLoG.AI Integration

### Cognitive Mill

```typescript
// Log visualization interaction
await collector.logDecision({
  studentId: 'student-123',
  context: {
    learningState: {
      module: LearningModule.COGNITIVE_MILL,
      lesson: 'Attention Mechanisms',
      progress: 0.4,
      lessonProgress: 0.6,
      objectives: ['Understand attention', 'Visualize token relationships'],
      currentDifficulty: 0.7,
      timeSpentOnLesson: 1200,
    },
    studentState: {
      knowledgeLevel: 0.5,
      engagement: 0.9,
      fatigue: 0.1,
      confidence: 0.5,
      consecutiveMistakes: 0,
      consecutiveSuccesses: 3,
      streak: 3,
      skillLevels: { 'ml-concepts': 0.5 },
    },
    perceptionData: {
      visibleElements: ['attention-weights', 'token-flow'],
      activeTool: 'attention-visualizer',
    },
  },
  decision: {
    decisionType: LearningDecisionType.VISUALIZATION_INTERACTION,
    action: 'Adjusted attention head visualization to layer 5',
    reasoning: 'Student exploring how attention patterns change across layers',
    confidence: 0.6,
    source: DecisionSource.STUDENT,
    stakes: 0.5,
  },
});
```

### Intelligence Ranch

```typescript
// Log agent configuration decision
await collector.logDecision({
  studentId: 'student-456',
  context: {
    learningState: {
      module: LearningModule.INTELLIGENCE_RANCH,
      lesson: 'Agent Architecture',
      exercise: 'Configure task-performing agent',
      progress: 0.6,
      lessonProgress: 0.8,
    },
    studentState: {
      knowledgeLevel: 0.7,
      engagement: 0.8,
      confidence: 0.7,
      skillLevels: { 'agent-design': 0.6 },
    },
  },
  decision: {
    decisionType: LearningDecisionType.AGENT_CONFIG,
    action: 'Configured agent with temperature=0.7, maxTokens=500',
    reasoning: 'Lower temperature for more focused responses, sufficient tokens for explanations',
    confidence: 0.75,
    source: DecisionSource.STUDENT,
    stakes: 0.6,
  },
});
```

### Sitka Sound

```typescript
// Log multi-agent interaction
await collector.logDecision({
  studentId: 'student-789',
  context: {
    learningState: {
      module: LearningModule.SITKA_SOUND,
      lesson: 'Game Theory Basics',
      exercise: 'Observe Nash equilibrium formation',
      progress: 0.5,
    },
    studentState: {
      knowledgeLevel: 0.5,
      engagement: 0.85,
      skillLevels: { 'game-theory': 0.4 },
    },
    perceptionData: {
      nearbyAgents: ['agent-alpha', 'agent-beta', 'agent-gamma'],
      availableActions: ['cooperate', 'defect', 'observe'],
    },
  },
  decision: {
    decisionType: LearningDecisionType.INTERACTION,
    action: 'Formed coalition with agent-alpha',
    reasoning: 'Both agents benefit from cooperation in this payoff matrix',
    confidence: 0.8,
    source: DecisionSource.STUDENT,
    stakes: 0.7,
  },
});
```

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines.

## Links

- [StudyLoG.AI](https://github.com/SuperInstance/studylog-github)
- [Research Notes](../docs/SUPERINSTANCE_TRAINING_NOTES.md)
- [Original Research](https://github.com/SuperInstance/training-data-collector)
