# SuperInstance Training Data Collector - Research Notes

**Research Team:** Agent 5/8
**Repository:** https://github.com/SuperInstance/training-data-collector
**Date:** 2026-01-10
**Target Application:** StudyLoG.AI (Cognitive Mill, Intelligence Ranch, Sitka Sound)

---

## Executive Summary

The training-data-collector is a standalone Python tool for capturing AI decision-making data with full context tracking, outcome association, and multi-format export capabilities. It converts AI gameplay/interaction data into training datasets suitable for QLoRA and other fine-tuning methods.

**Key Insight for StudyLoG.AI:** This system demonstrates a production-ready pattern for collecting "learning moments" - the exact data StudyLoG.AI needs to track student progress, identify teaching opportunities, and build personalized learning models.

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Collection Architecture](#2-collection-architecture)
3. [Data Models Deep Dive](#3-data-models-deep-dive)
4. [Export System](#4-export-system)
5. [Privacy & Settings](#5-privacy--settings)
6. [Key Patterns & Innovations](#6-key-patterns--innovations)
7. [Code Examples](#7-code-examples)
8. [Recommendations for StudyLoG.AI](#8-recommendations-for-studylogai)

---

## 1. Repository Overview

### 1.1 Purpose

Collect AI decision data for fine-tuning language models, specifically:
- Decision capture with full situational context
- Outcome tracking for reinforcement learning patterns
- Quality filtering for training data curation
- Multi-format export for different ML pipelines

### 1.2 Structure

```
training-data-collector/
├── src/training_data_collector/
│   ├── __init__.py          # Public API exports
│   ├── collector.py         # Main TrainingDataCollector class (1042 lines)
│   ├── models.py            # Data models (378 lines)
│   └── exporters.py         # Export handlers (504 lines)
├── examples/
│   ├── basic_usage.py       # Core functionality demo
│   └── qlora_export.py      # QLoRA-specific examples
├── tests/
│   └── test_collector.py    # Comprehensive unit tests
├── pyproject.toml           # Python packaging config
└── README.md                # Documentation
```

### 1.3 Key Technologies

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Storage | SQLite | Local, indexed, serverless persistence |
| Serialization | JSON/dataclasses | Simple, human-readable data structures |
| Export | JSON, JSONL, Parquet | Multiple format support for ML pipelines |
| Testing | pytest | Unit test coverage |
| Type Hints | Python 3.9+ | Full type annotations for IDE support |

---

## 2. Collection Architecture

### 2.1 Database Schema

The system uses SQLite with three main tables:

```sql
-- Decisions table: Core storage for AI decisions
CREATE TABLE decisions (
    decision_id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    session_id TEXT,
    timestamp TEXT NOT NULL,

    -- Situation context (JSON)
    situation_context TEXT NOT NULL,

    -- Decision details (JSON)
    decision_data TEXT NOT NULL,

    -- Outcome (JSON, filled in later)
    outcome_data TEXT,
    outcome_timestamp TEXT,

    -- Meta
    training_eligible INTEGER DEFAULT 1,
    quality_label TEXT,
    reflection_notes TEXT,

    -- Indexes for queries
    decision_type TEXT,
    decision_source TEXT,
    success INTEGER,

    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
);

-- Sessions table: Grouping decisions
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    start_timestamp TEXT NOT NULL,
    end_timestamp TEXT,
    character_ids TEXT,
    total_decisions INTEGER DEFAULT 0,
    session_notes TEXT
);

-- Character settings table: Privacy controls
CREATE TABLE character_settings (
    character_id TEXT PRIMARY KEY,
    enabled INTEGER DEFAULT 1,
    collect_bot_decisions INTEGER DEFAULT 1,
    collect_brain_decisions INTEGER DEFAULT 1,
    collect_human_overrides INTEGER DEFAULT 1,
    retention_days INTEGER DEFAULT 30,
    training_eligible INTEGER DEFAULT 1,
    updated_timestamp TEXT NOT NULL
);
```

### 2.2 Indexes for Performance

```sql
CREATE INDEX idx_character_id ON decisions(character_id);
CREATE INDEX idx_session_id ON decisions(session_id);
CREATE INDEX idx_timestamp ON decisions(timestamp);
CREATE INDEX idx_decision_source ON decisions(decision_source);
CREATE INDEX idx_training_eligible ON decisions(training_eligible);
CREATE INDEX idx_quality_label ON decisions(quality_label);
```

**Design Insight:** Heavy indexing on query columns enables fast filtering even with large datasets. Critical for StudyLoG.AI where we need to query student progress quickly.

### 2.3 Data Flow

```
┌─────────────┐
│  Decision   │
│  Event      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Privacy Filter (Character Settings)    │
│  - Should this be logged?               │
│  - What type of decisions are allowed?  │
└──────┬──────────────────────────────────┘
       │ (if allowed)
       ▼
┌─────────────────────────────────────────┐
│  TrainingDataCollector.log_decision()   │
│  - Generate decision_id                 │
│  - Serialize context to JSON            │
│  - Insert into decisions table          │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Outcome Association (Async)            │
│  - update_outcome() called later        │
│  - Links results to original decision   │
│  - Computes quality metrics             │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  Export Pipeline                        │
│  - Filter by quality/confidence         │
│  - Convert to training format           │
│  - Output to JSON/JSONL/Parquet/QLoRA   │
└─────────────────────────────────────────┘
```

---

## 3. Data Models Deep Dive

### 3.1 Decision Types

```python
class DecisionType(str, Enum):
    COMBAT_ACTION = "combat_action"
    EXPLORATION = "exploration"
    SOCIAL = "social"
    SKILL_CHECK = "skill_check"
    ROLEPLAY = "roleplay"
    INVENTORY = "inventory"
    DIALOGUE = "dialogue"
    OTHER = "other"
```

**StudyLoG.AI Mapping:**
| Game/AI Type | StudyLoG.AI Equivalent |
|-------------|------------------------|
| COMBAT_ACTION | PROBLEM_SOLVING |
| EXPLORATION | DISCOVERY |
| SOCIAL | COLLABORATION |
| SKILL_CHECK | ASSESSMENT |
| ROLEPLAY | SIMULATION |

### 3.2 Decision Sources

```python
class DecisionSource(str, Enum):
    BOT = "bot"      # Rule-based or simple AI
    BRAIN = "brain"  # Large language model
    HUMAN = "human"  # Human override/input
```

**StudyLoG.AI Mapping:**
| Original | StudyLoG.AI Equivalent |
|----------|----------------------|
| BOT | RULE_ENGINE |
| BRAIN | AI_TUTOR |
| HUMAN | STUDENT |

### 3.3 Quality Labels

```python
class QualityLabel(str, Enum):
    GOOD = "good"                    # Excellent decision, high learning value
    ACCEPTABLE = "acceptable"        # Adequate decision
    BAD = "bad"                      # Poor decision, learning opportunity
    TEACHING_MOMENT = "teaching_moment"  # Explicitly marked for teaching
```

**Key Innovation:** The TEACHING_MOMENT label allows explicit marking of decisions that should always be included in training data, regardless of quality scores. Perfect for highlighting "a-ha!" moments in learning.

### 3.4 Core Data Structures

#### SituationContext

```python
@dataclass
class SituationContext:
    """Full context surrounding a decision."""
    game_state: GameState
    character_state: CharacterState
    perception_data: Optional[PerceptionData] = None
    additional_context: Dict[str, Any] = field(default_factory=dict)
```

**StudyLoG.AI Adaptation:**
```python
@dataclass
class LearningContext:
    """Full context surrounding a learning moment."""
    learning_state: LearningState      # Current module, progress, objectives
    student_state: StudentState        # Knowledge level, engagement, fatigue
    perception_data: Optional[PerceptionData]  # What student sees/interacts with
    additional_context: Dict[str, Any]  # Hints, time constraints, etc.
```

#### Decision

```python
@dataclass
class Decision:
    """A decision made by an AI or human."""
    decision_type: DecisionType
    action: str
    reasoning: str
    confidence: float = 0.5
    source: DecisionSource = DecisionSource.BOT
    stakes: float = 0.5
    metadata: Dict[str, Any] = field(default_factory=dict)
```

**Key Fields for Learning:**
- `reasoning`: The thought process - crucial for teaching
- `confidence`: How sure was the AI/student?
- `stakes`: Importance of this decision (0-1)

#### DecisionOutcome

```python
@dataclass
class DecisionOutcome:
    """The outcome/result of a decision."""
    success: bool
    immediate: str
    delayed: Optional[str] = None
    rewards: Dict[str, Any] = field(default_factory=dict)
    penalties: Dict[str, Any] = field(default_factory=dict)
    quality_score: float = 0.5
    quality_label: Optional[QualityLabel] = None
    notes: Optional[str] = None
```

---

## 4. Export System

### 4.1 Supported Formats

| Format | Use Case | Features |
|--------|----------|----------|
| JSON | Analysis, debugging | Full metadata, human-readable |
| JSONL | Streaming, pipelines | One record per line |
| Parquet | Data science | Columnar, efficient compression |
| QLoRA | Fine-tuning | Instruction/input/output format |

### 4.2 QLoRA Format

The QLoRA exporter converts decisions into instruction-tuning format:

```json
{
  "instruction": "What combat action should I take in this situation?",
  "input": "Location: Cave entrance\nTurn: 5\nCombat is active\nHP: 35/50\nStatus: poisoned\nNearby enemies: goblin_1\nStakes: 70%",
  "output": "Action: attack with sword\nReasoning: Goblin is vulnerable and companion is at risk\nConfidence: 85%\nResult: Hit for 15 damage, goblin defeated\nThis action was successful.",
  "metadata": {
    "decision_id": "dec_abc123",
    "character_id": "hero",
    "decision_type": "combat_action",
    "quality_label": "good",
    "success": true,
    "confidence": 0.85,
    "timestamp": "2026-01-10T16:00:00"
  }
}
```

**StudyLoG.AI QLoRA Example:**
```json
{
  "instruction": "How do I implement gradient descent?",
  "input": "Module: Neural Networks\nLesson: Optimization\nStudent Level: Beginner\nTime Spent: 15 min\nPrevious Attempts: 2\nHints Available: 1",
  "output": "Action: Provide step-by-step implementation\nReasoning: Student needs concrete example after abstract explanation\nConfidence: 90%\nResult: Student successfully implemented gradient descent",
  "metadata": {
    "decision_id": "learn_xyz789",
    "student_id": "student_42",
    "decision_type": "problem_solving",
    "quality_label": "good",
    "success": true,
    "confidence": 0.9
  }
}
```

### 4.3 Filtering Strategy

The export system applies intelligent filtering:

```python
def _filter_decisions(
    self,
    decisions: List[DecisionRecord],
    min_confidence: float,
    min_quality: float,
    include_teaching_moments: bool,
) -> List[DecisionRecord]:
    """Filter decisions based on quality thresholds."""
    filtered = []

    for d in decisions:
        if not d.decision or not d.outcome:
            continue

        # Always include teaching moments
        if d.quality_label == QualityLabel.TEACHING_MOMENT and include_teaching_moments:
            filtered.append(d)
            continue

        # Apply confidence filter
        if d.decision.confidence < min_confidence:
            continue

        # Apply quality filter
        if d.outcome.quality_score < min_quality:
            continue

        filtered.append(d)

    return filtered
```

**Key Pattern:** Teaching moments bypass quality filters - they're always included. This ensures that explicitly marked learning opportunities are never excluded from training data.

---

## 5. Privacy & Settings

### 5.1 CharacterDataSettings

```python
@dataclass
class CharacterDataSettings:
    character_id: str
    enabled: bool = True
    collect_bot_decisions: bool = True
    collect_brain_decisions: bool = True
    collect_human_overrides: bool = True
    retention_days: int = 30
    training_eligible: bool = True

    def should_log_decision(self, decision_source: str) -> bool:
        """Check if this decision should be logged based on settings."""
        if not self.enabled:
            return False

        if decision_source == 'bot' and not self.collect_bot_decisions:
            return False
        if decision_source == 'brain' and not self.collect_brain_decisions:
            return False
        if decision_source == 'human' and not self.collect_human_overrides:
            return False

        return True
```

### 5.2 Privacy Features

| Feature | Implementation | StudyLoG.AI Use |
|---------|---------------|-----------------|
| Per-character opt-in | `enabled` flag | Student data collection consent |
| Source filtering | Separate flags per source | Different consent for AI vs student data |
| Retention policy | `retention_days` | Automatic data expiration |
| Training eligibility | `training_eligible` flag | Opt-out of model training |

### 5.3 Data Cleanup

```python
def cleanup_old_data(
    self,
    character_id: Optional[str] = None,
) -> int:
    """Clean up old data based on retention policies."""
    # ... implementation ...
    cutoff_date = datetime.utcnow() - timedelta(days=settings.retention_days)
    cursor.execute("""
        DELETE FROM decisions
        WHERE character_id = ?
        AND timestamp < ?
    """, (char_id, cutoff_date.isoformat()))
```

---

## 6. Key Patterns & Innovations

### 6.1 Separation of Decision and Outcome

**Pattern:** Decisions are logged immediately, outcomes updated later asynchronously.

**Benefit:**
- Captures the decision context while fresh
- Allows delayed outcome assessment
- Enables learning from long-term consequences

**StudyLoG.AI Application:**
```python
# Log the student's answer immediately
decision_id = collector.log_decision(
    student_id="student_42",
    situation=LearningContext(
        learning_state=LearningState(
            module="Neural Networks",
            lesson="Backpropagation",
            progress=0.6
        ),
        student_state=StudentState(
            knowledge_level=0.5,
            engagement=0.8
        )
    ),
    decision=LearningDecision(
        decision_type=LearningDecisionType.ANSWER,
        action="student_answer: 'backpropagation computes gradients'",
        reasoning="Student recall from previous lesson",
        confidence=0.7,
        source=DecisionSource.STUDENT
    )
)

# Update with outcome after assessment
collector.update_outcome(
    decision_id=decision_id,
    outcome=LearningOutcome(
        success=True,
        immediate="Answer correct",
        quality_score=0.8,
        quality_label=QualityLabel.GOOD,
        rewards={"xp": 10, "mastery_increase": 0.1}
    )
)
```

### 6.2 Session Management

**Pattern:** Group related decisions into sessions for analysis.

**Benefit:**
- Track performance over time
- Analyze decision patterns within context
- Generate session-level statistics

**StudyLoG.AI Application:**
```python
# Start a learning session
session_id = collector.start_session(
    student_ids=["student_42"],
    notes="Neural Networks module - first pass"
)

# All decisions during this session are grouped
# End session and get summary
session_info = collector.end_session()
print(f"Decisions: {session_info.total_decisions}")
print(f"Duration: {session_info.end_timestamp - session_info.start_timestamp}")
```

### 6.3 Quality Labels for Curation

**Pattern:** Explicit quality labels enable selective training data inclusion.

**Benefit:**
- Humans can mark teaching moments
- Automated quality scoring
- Filtered exports for different training needs

**Quality Hierarchy:**
```
TEACHING_MOMENT (always included)
    ↓
GOOD (high quality examples)
    ↓
ACCEPTABLE (adequate examples)
    ↓
BAD (learning opportunities, usually excluded)
```

### 6.4 Multi-Format Export

**Pattern:** Exporter strategy pattern with format-specific implementations.

**Benefit:**
- Same data, multiple use cases
- Easy to add new formats
- Format-specific optimizations

**Adding a New Export Format:**
```python
class CSVExporter(Exporter):
    """Export to CSV format for spreadsheet analysis."""

    def export(self, decisions, output_path, **kwargs):
        # Flatten decision data
        rows = []
        for d in decisions:
            rows.append({
                "decision_id": d.decision_id,
                "timestamp": d.timestamp.isoformat(),
                "action": d.decision.action if d.decision else "",
                "success": d.outcome.success if d.outcome else None,
                # ... more fields
            })

        # Write CSV
        import csv
        with open(output_path, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        return {"format": "csv", "output_path": output_path, "records_exported": len(rows)}
```

### 6.5 Statistics and Analytics

**Pattern:** Built-in statistics generation for data insights.

```python
def get_statistics(self, character_id: Optional[str] = None) -> Dict[str, Any]:
    # Returns:
    # - total_decisions
    # - by_source (bot/brain/human counts)
    # - by_type (decision type distribution)
    # - success_rate
    # - by_quality (quality label distribution)
    # - training_eligible (count of training-eligible records)
```

**StudyLoG.AI Dashboard Application:**
```python
def generate_student_dashboard(collector, student_id):
    stats = collector.get_statistics(character_id=student_id)

    return {
        "total_interactions": stats["total_decisions"],
        "success_rate": f"{stats['success_rate']:.1%}",
        "learning_moments": stats["by_quality"].get("teaching_moment", 0),
        "decisions_by_type": stats["by_type"],
        "improvement_trend": calculate_improvement_trend(collector, student_id)
    }
```

---

## 7. Code Examples

### 7.1 Basic Collection Loop

```python
from training_data_collector import (
    TrainingDataCollector,
    SituationContext,
    Decision,
    DecisionOutcome,
    DecisionType,
    DecisionSource,
    QualityLabel,
    GameState,
    CharacterState,
)

# Initialize
collector = TrainingDataCollector("data/decisions.db")
session_id = collector.start_session(character_ids=["hero"], notes="Dungeon crawl")

# Game loop
while game_active:
    # Get current context
    context = get_game_context()

    # Make decision
    decision = ai_agent.decide(context)

    # Log it
    decision_id = collector.log_decision(
        character_id="hero",
        situation=SituationContext(
            game_state=GameState(
                location=context.location,
                turn=context.turn,
                combat_active=context.in_combat
            ),
            character_state=CharacterState(
                hp=context.hp,
                max_hp=context.max_hp
            )
        ),
        decision=Decision(
            decision_type=DecisionType.COMBAT_ACTION if context.in_combat else DecisionType.EXPLORATION,
            action=decision.action,
            reasoning=decision.reasoning,
            confidence=decision.confidence,
            source=DecisionSource.BRAIN
        )
    )

    # Execute action and get outcome
    outcome = execute_action(decision.action)

    # Update with outcome
    collector.update_outcome(
        decision_id=decision_id,
        outcome=DecisionOutcome(
            success=outcome.success,
            immediate=outcome.description,
            quality_score=compute_quality(outcome)
        )
    )

# End session and export
collector.end_session()
collector.export_qlora("hero", "training_data.jsonl")
```

### 7.2 Quality-Based Filtering

```python
# Get high-quality combat decisions for specialized training
combat_decisions = collector.get_training_decisions(
    character_id="hero",
    min_quality=QualityLabel.GOOD,
    decision_types=[DecisionType.COMBAT_ACTION]
)

# Export only the best examples
collector.export_qlora(
    "hero",
    "elite_combat_training.jsonl",
    min_confidence=0.8,
    min_quality=0.8
)
```

### 7.3 Teaching Moments

```python
# Human expert marks a decision as a teaching moment
def expert_review_loop(collector):
    """Let experts mark important decisions."""
    pending = collector.get_decisions("hero", training_eligible_only=True)

    for decision in pending:
        if decision.quality_label is None:
            # Show to expert
            display_decision(decision)

            # Get expert input
            label = input("Quality label (good/acceptable/bad/teaching): ").upper()

            if label in QualityLabel.__members__:
                collector.update_quality_label(
                    decision_id=decision.decision_id,
                    quality_label=QualityLabel[label],
                    reflection_notes=input("Notes: ")
                )
```

### 7.4 Privacy-Respecting Collection

```python
from training_data_collector import CharacterDataSettings

# Student opts out of data collection
collector.update_character_settings(
    CharacterDataSettings(
        character_id="student_42",
        enabled=False,  # Collection disabled
        retention_days=0
    )
)

# Another student opts in but excludes certain data
collector.update_character_settings(
    CharacterDataSettings(
        character_id="student_43",
        enabled=True,
        collect_student_answers=True,
        collect_ai_tutor=True,
        collect_human_overrides=False,  # Don't log when human tutor intervenes
        retention_days=90,
        training_eligible=True
    )
)
```

---

## 8. Recommendations for StudyLoG.AI

### 8.1 Core Principles to Adopt

1. **Separate Decision from Outcome**
   - Log learning events immediately
   - Update with assessment outcomes later
   - Capture both immediate and delayed feedback

2. **Rich Context Capture**
   - Learning state (module, lesson, objectives)
   - Student state (knowledge, engagement, fatigue)
   - Environmental context (hints available, time constraints)

3. **Quality-Based Curation**
   - Mark teaching moments explicitly
   - Compute quality scores automatically
   - Allow human expert review

4. **Privacy First**
   - Per-student consent management
   - Configurable retention policies
   - Training data opt-out

### 8.2 StudyLoG.AI Data Model Adaptation

```typescript
// Learning Context (equivalent to SituationContext)
interface LearningContext {
    learning_state: LearningState;
    student_state: StudentState;
    perception_data?: PerceptionData;
    additional_context?: Record<string, any>;
}

interface LearningState {
    module: string;
    lesson: string;
    progress: number;           // 0-1
    objectives: string[];
    current_difficulty: number; // 0-1
}

interface StudentState {
    knowledge_level: number;    // 0-1
    engagement: number;         // 0-1
    fatigue: number;            // 0-1
    time_spent_on_lesson: number; // seconds
    consecutive_mistakes: number;
}

interface PerceptionData {
    visible_hints: string[];
    available_tools: string[];
    peer_presence?: string[];
}

// Learning Decision (equivalent to Decision)
interface LearningDecision {
    decision_type: LearningDecisionType;
    action: string;
    reasoning: string;
    confidence: number;
    source: DecisionSource;
    stakes: number;             // Importance for learning
    metadata?: Record<string, any>;
}

enum LearningDecisionType {
    PROBLEM_SOLVING = "problem_solving",
    DISCOVERY = "discovery",
    COLLABORATION = "collaboration",
    ASSESSMENT = "assessment",
    SIMULATION = "simulation",
    HELP_REQUEST = "help_request",
    HINT_USAGE = "hint_usage"
}

enum DecisionSource {
    RULE_ENGINE = "rule_engine",     // Automated rules
    AI_TUTOR = "ai_tutor",           // LLM-based tutor
    STUDENT = "student",             // Student input
    HUMAN_TUTOR = "human_tutor"      // Human expert
}

// Learning Outcome (equivalent to DecisionOutcome)
interface LearningOutcome {
    success: boolean;
    immediate: string;
    delayed?: string;
    rewards: Reward[];
    penalties: Penalty[];
    quality_score: number;
    quality_label?: QualityLabel;
    notes?: string;
}

interface Reward {
    type: "xp" | "mastery" | "badge" | "unlock";
    value: number | string;
}

interface Penalty {
    type: "streak_reset" | "confidence_loss";
    value: number | string;
}

enum QualityLabel {
    EXCELLENT = "excellent",           // Exceeds expectations
    GOOD = "good",                     // Meets expectations
    NEEDS_IMPROVEMENT = "needs_improvement", // Learning opportunity
    TEACHING_MOMENT = "teaching_moment"       // Explicitly marked
}

// Complete Learning Record
interface LearningRecord {
    record_id: string;
    student_id: string;
    session_id: string;
    timestamp: Date;
    context: LearningContext;
    decision: LearningDecision;
    outcome?: LearningOutcome;
    training_eligible: boolean;
    quality_label?: QualityLabel;
    reflection_notes?: string;
}
```

### 8.3 Implementation Architecture for StudyLoG.AI

```
StudyLoG.AI Training Data Collection
├── Backend (TypeScript/Node.js)
│   ├── collectors/
│   │   ├── LearningEventCollector.ts    # Main collector class
│   │   ├── SessionManager.ts            # Session tracking
│   │   └── QualityScorer.ts             # Quality metrics
│   ├── models/
│   │   ├── LearningContext.ts           # Context models
│   │   ├── LearningDecision.ts          # Decision models
│   │   ├── LearningOutcome.ts           # Outcome models
│   │   └── LearningRecord.ts            # Complete records
│   ├── exporters/
│   │   ├── JSONExporter.ts
│   │   ├── JSONLExporter.ts
│   │   ├── ParquetExporter.ts
│   │   └── QLoRAExporter.ts             # Instruction-tuning format
│   └── storage/
│       ├── SQLiteAdapter.ts             # Database operations
│       └── IndexedDBAdapter.ts          # Browser storage
├── Frontend (Theia Extension)
│   ├── DataCollectionPanel.ts           # UI for viewing collected data
│   ├── ConsentManager.ts                # Privacy settings UI
│   └── ExportDialog.ts                  # Export functionality
└── Workers (Cloudflare)
    ├── TrainingPipelineWorker.ts        # Background processing
    └── QualityReviewWorker.ts           # Expert review queue
```

### 8.4 Use Cases by StudyLoG.AI Stage

#### Cognitive Mill

**Focus:** Learning how AI models work

**Data to Collect:**
- Model explanation comprehension
- Visualization interaction patterns
- Quiz responses on AI concepts
- Debugging attempts on model behavior

**Teaching Moments:**
- When student grasps a key concept (attention mechanism, tokenization)
- When student identifies model hallucination
- When student successfully debugs a model issue

**Export Use:**
- Train AI tutor to recognize comprehension patterns
- Build models that predict when students need help

#### Intelligence Ranch

**Focus:** Training and breeding AI agents

**Data to Collect:**
- Agent configuration decisions
- Training parameter choices
- Breeding strategy selections
- Agent performance metrics

**Teaching Moments:**
- Successful agent architectures
- Effective training strategies
- Novel agent behaviors

**Export Use:**
- Train AI to recommend agent configurations
- Build models that predict agent performance

#### Sitka Sound

**Focus:** Multi-agent systems and game theory

**Data to Collect:**
- Agent interaction decisions
- Coalition formations
- Competitive strategies
- Equilibrium-seeking behaviors

**Teaching Moments:**
- Nash equilibrium discoveries
- Successful cooperation strategies
- Effective competitive tactics

**Export Use:**
- Train agents to recognize game theory patterns
- Build models that predict multi-agent outcomes

### 8.5 Privacy Considerations for StudyLoG.AI

1. **GDPR Compliance**
   - Explicit consent per student
   - Right to data deletion
   - Data export (portability)

2. **COPPA Compliance** (for minors)
   - Parental consent mechanisms
   - Stricter data retention
   - Anonymization for training

3. **Educational Privacy**
   - FERPA considerations (US)
   - Separate learning data from PII
   - Aggregated analytics only

### 8.6 Integration Points

#### Theia IDE

```typescript
// Collect code writing events
class TheiaCodeCollector {
    async logCodeAttempt(
        studentId: string,
        code: string,
        context: ExerciseContext
    ): Promise<string> {
        return collector.logDecision({
            character_id: studentId,
            situation: {
                learning_state: {
                    module: context.module,
                    lesson: context.lesson,
                    exercise: context.exercise
                },
                student_state: {
                    attempts: context.attempts,
                    hints_used: context.hintsUsed
                }
            },
            decision: {
                decision_type: LearningDecisionType.PROBLEM_SOLVING,
                action: `write_code: ${code}`,
                reasoning: "Student solution attempt",
                source: DecisionSource.STUDENT
            }
        });
    }

    async updateCodeOutcome(
        recordId: string,
        testResults: TestResults
    ): Promise<void> {
        collector.updateOutcome(recordId, {
            success: testResults.allPassed,
            immediate: testResults.summary,
            quality_score: computeCodeQuality(testResults),
            quality_label: testResults.allPassed ?
                QualityLabel.GOOD : QualityLabel.NEEDS_IMPROVEMENT
        });
    }
}
```

#### Godot Visualization

```typescript
// Collect visualization interaction events
class GodotInteractionCollector {
    async logVisualizationInteraction(
        studentId: string,
        interaction: VisualizationInteraction
    ): Promise<string> {
        return collector.logDecision({
            character_id: studentId,
            situation: {
                learning_state: {
                    module: "Cognitive Mill",
                    lesson: "Attention Mechanisms"
                },
                perception_data: {
                    visible_elements: interaction.visibleElements,
                    active_tool: interaction.activeTool
                }
            },
            decision: {
                decision_type: LearningDecisionType.DISCOVERY,
                action: `interact: ${interaction.type}`,
                reasoning: "Exploring visualization",
                source: DecisionSource.STUDENT,
                metadata: {
                    visualization_state: interaction.state
                }
            }
        });
    }
}
```

#### AI Tutor

```typescript
// Collect AI tutor decisions
class AITutorDecisionCollector {
    async logTutorDecision(
        studentId: string,
        context: TutorContext,
        decision: TutorDecision
    ): Promise<string> {
        return collector.logDecision({
            character_id: studentId,
            situation: {
                learning_state: context.learningState,
                student_state: context.studentState,
                additional_context: {
                    question: context.question,
                    available_hints: context.hints
                }
            },
            decision: {
                decision_type: this.mapDecisionType(decision.type),
                action: decision.action,
                reasoning: decision.reasoning,  // LLM's reasoning
                confidence: decision.confidence,
                source: DecisionSource.AI_TUTOR,
                metadata: {
                    model: decision.model,
                    parameters: decision.parameters
                }
            }
        });
    }
}
```

---

## 9. Next Steps

1. **Implement TypeScript Collector**
   - Port core patterns to TypeScript
   - Use SQLite for Node.js or IndexedDB for browser

2. **Create StudyLoG.AI Specific Models**
   - Adapt data models for learning context
   - Define StudyLoG.AI decision types

3. **Build Privacy Controls**
   - Student consent UI
   - Data collection settings
   - Export/deletion tools

4. **Integrate with Theia**
   - Background data collection
   - Dashboard for viewing collected data
   - Export functionality

5. **Implement Quality Scoring**
   - Automatic quality metrics
   - Expert review interface
   - Teaching moment marking

---

## 10. References

- Repository: https://github.com/SuperInstance/training-data-collector
- QLoRA Paper: "QLoRA: Efficient Finetuning of Quantized LLMs"
- SQLite Documentation: https://www.sqlite.org/docs.html
- Instruction Tuning: "Fine-tuned Language Models Are Zero-Shot Learners"

---

**Document End**
*Generated by Agent 5/8 - SuperInstance Research Team*
