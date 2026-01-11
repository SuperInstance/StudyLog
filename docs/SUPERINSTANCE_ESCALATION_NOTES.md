# SuperInstance Escalation Engine - Research Notes

**Research Agent:** Agent 2/8
**Date:** 2026-01-10
**Repository:** https://github.com/SuperInstance/escalation-engine
**Status:** Complete

---

## Executive Summary

The Escalation Engine is a Python package that delivers **40x cost reduction** through intelligent decision routing across three tiers: Bot (free, rule-based), Brain (local LLM, low cost), and Human (API LLM, higher cost). The system uses confidence-based escalation, context-aware routing, novelty detection, and adaptive learning to optimize when to use expensive cloud LLMs versus cheaper alternatives.

This research extracts actionable patterns for StudyLoG.AI, particularly for the multi-model router, agent orchestration, and cost optimization systems.

---

## Repository Overview

```
escalation-engine/
|-- escalation_engine/
|   |-- __init__.py              # Public API exports
|   |-- core.py                  # Core EscalationEngine (656 lines)
|   |-- config.py                # Configuration management (268 lines)
|   |-- providers.py             # LLM provider implementations (414 lines)
|   |-- metrics.py               # Cost tracking & metrics (288 lines)
|   |-- server.py                # FastAPI REST server (328 lines)
|   |-- cli.py                   # Command-line interface
|
|-- examples/                    # Usage examples
|   |-- basic_usage.py           # Getting started
|   |-- customer_support.py      # Support automation
|   |-- game_ai.py               # D&D character AI demo
|   |-- cost_tracking.py         # Cost monitoring
|   |-- learning_system.py       # Adaptive learning demo
|
|-- tests/                       # Test suite (26 tests, all passing)
    |-- test_core.py             # Core functionality tests
    |-- test_providers.py        # Provider tests
```

**Total:** ~3,200 lines of production code + ~800 lines of examples

---

## Core Architecture

### The Three-Tier Model

```
                    Decision Request
                           |
                    Escalation Engine
                    - Analyze stakes
                    - Check novelty
                    - Evaluate urgency
                    - Review history
                           |
           +---------------+---------------+
           |               |               |
        CRITICAL?       ROUTINE?      NOVEL?
     Time < 100ms    Seen before    Medium stakes
           |               |               |
        HUMAN            BOT            BRAIN
      (API LLM)       (Rules)     (Local LLM)
       $0.01-0.10        $0           ~$0
      500-2000ms       <10ms        100-500ms
```

### Decision Source Enum

```python
class DecisionSource(Enum):
    BOT = "bot"           # Fast, deterministic, rule-based (free)
    BRAIN = "brain"       # Local LLM for nuanced decisions (low cost)
    HUMAN = "human"       # API LLM for critical decisions (higher cost)
    OVERRIDE = "override" # Manual override
```

### Escalation Reasons

```python
class EscalationReason(Enum):
    LOW_CONFIDENCE = "low_confidence"
    HIGH_STAKES = "high_stakes"
    NOVEL_SITUATION = "novel_situation"
    TIME_CRITICAL = "time_critical"
    CONFLICTING_BOTS = "conflicting_bots"
    SAFETY_CONCERN = "safety_concern"
    CHARACTER_GROWTH = "character_growth"
    PLAYER_REQUEST = "player_request"
    COST_LIMIT = "cost_limit"
```

---

## Key Patterns Extracted

### Pattern 1: Confidence-Based Escalation

The core innovation: escalate only when confidence drops below threshold.

```python
@dataclass
class EscalationThresholds:
    bot_min_confidence: float = 0.7        # Below this, escalate to brain
    brain_min_confidence: float = 0.5      # Below this, escalate to human
    high_stakes_threshold: float = 0.7     # Above this = high stakes
    critical_stakes_threshold: float = 0.9 # Above this = critical
```

**Routing Logic:**

1. Check critical overrides first (HP, resources, recent failures)
2. Check if situation is novel (unseen patterns)
3. Check stakes level
4. Check urgency
5. Route accordingly

**For StudyLoG.AI:** This could optimize when to use cloud models vs local Ollama based on task complexity.

---

### Pattern 2: Adaptive Threshold Learning

The system learns from outcomes and adjusts thresholds per character/entity.

```python
def _update_thresholds(self, character_id: str, result: DecisionResult, success: bool):
    thresholds = self.get_thresholds(character_id)

    if result.source == DecisionSource.BOT:
        if success:
            # Success: Lower threshold (trust bot more)
            thresholds.bot_min_confidence = max(
                0.5,
                thresholds.bot_min_confidence - 0.05
            )
        else:
            # Failure: Raise threshold (trust bot less)
            thresholds.bot_min_confidence = min(
                0.9,
                thresholds.bot_min_confidence + 0.1
            )
```

**Result:** Reliable entities can automate more (lower thresholds), while struggling ones get more oversight (higher thresholds).

**For StudyLoG.AI:** Students who consistently succeed could get more autonomous AI assistance, while struggling students get more human/expert oversight.

---

### Pattern 3: Novelty Detection

Simple but effective pattern matching to detect novel situations.

```python
def _is_novel_situation(self, context: DecisionContext, thresholds: EscalationThresholds) -> bool:
    situation_key = f"{context.character_id}:{context.situation_type}"

    if situation_key not in self.situation_patterns:
        self.situation_patterns[situation_key] = []

    patterns = self.situation_patterns[situation_key]

    # If we haven't seen many similar situations, it's novel
    if len(patterns) < 5:
        return True

    # Check similarity using word overlap
    description_words = set(context.situation_description.lower().split())
    max_similarity = 0.0

    for pattern in patterns:
        pattern_words = set(pattern.lower().split())
        common_words = description_words & pattern_words
        similarity = len(common_words) / len(pattern_words)
        max_similarity = max(max_similarity, similarity)

    # If max similarity is low, situation is novel
    is_novel = max_similarity < (1.0 - thresholds.novelty_threshold)

    # Store pattern if novel
    if is_novel or len(patterns) < 20:
        patterns.append(context.situation_description[:100])

    return is_novel
```

**For StudyLoG.AI:** Detect when a student is attempting something new vs. practicing familiar concepts. New concepts get more expensive/smart models.

---

### Pattern 4: Critical Override System

Safety first: critical situations bypass normal routing.

```python
def _check_critical_override(self, context: DecisionContext, thresholds: EscalationThresholds):
    # Critical HP -> Human
    if context.character_hp_ratio <= thresholds.hp_critical_threshold:
        return EscalationDecision(
            source=DecisionSource.HUMAN,
            reason=EscalationReason.SAFETY_CONCERN,
            confidence_required=0.95,
            allow_fallback=False,  # No fallback from critical
        )

    # Critical resources -> Human
    for resource, amount in context.available_resources.items():
        if resource in ["spell_slots", "hp_potions", "resurrection", "credits"]:
            if amount <= 1:
                return EscalationDecision(
                    source=DecisionSource.HUMAN,
                    reason=EscalationReason.SAFETY_CONCERN,
                    confidence_required=0.95,
                    allow_fallback=False,
                )

    # Recent failures -> Brain or Human
    if context.recent_failures >= 3:
        return EscalationDecision(
            source=DecisionSource.BRAIN,
            reason=EscalationReason.LOW_CONFIDENCE,
            confidence_required=0.8,
        )
```

**For StudyLoG.AI:** Detect when a student is stuck (repeated failures) and escalate to better models or human help.

---

### Pattern 5: Cost Tracking with Budgets

Comprehensive cost tracking with daily budgets and alerts.

```python
@dataclass
class CostTracker:
    total_cost: float = 0.0
    daily_cost: float = 0.0
    daily_budget: float = 10.0
    alert_threshold: float = 8.0
    cost_by_source: Dict[str, float] = field(default_factory=dict)
    cost_by_day: Dict[str, float] = field(default_factory=dict)

    def record_cost(self, source: DecisionSource, cost: float) -> None:
        self.total_cost += cost
        self.daily_cost += cost
        self.cost_by_source[source.value] = self.cost_by_source.get(source.value, 0.0) + cost

        # Track by day
        today = datetime.now().strftime("%Y-%m-%d")
        self.cost_by_day[today] = self.cost_by_day.get(today, 0.0) + cost

        # Alert if over threshold
        if self.daily_cost >= self.alert_threshold:
            logger.warning(f"Cost alert: ${self.daily_cost:.2f} exceeds ${self.alert_threshold:.2f}")

    def check_budget(self, estimated_cost: float) -> bool:
        return (self.daily_cost + estimated_cost) <= self.daily_budget
```

**For StudyLoG.AI:** Track per-student AI costs, implement budget limits, show cost transparency to students.

---

### Pattern 6: Multi-Provider Support

Abstract provider interface with factory pattern.

```python
class LLMProvider(ABC):
    @abstractmethod
    async def decide(self, context: DecisionContext, **kwargs) -> LLMResponse:
        pass

    @abstractmethod
    def estimate_cost(self, tokens: int) -> float:
        pass

class BotProvider(LLMProvider):
    """Rule-based, free, fast"""

class BrainProvider(LLMProvider):
    """Local LLM via Ollama, low cost"""

class HumanProvider(LLMProvider):
    """Cloud LLMs via OpenAI/Anthropic, higher cost"""

def create_provider(source: DecisionSource, config: Optional[LLMProviderConfig] = None) -> LLMProvider:
    if source == DecisionSource.BOT:
        return BotProvider(config)
    elif source == DecisionSource.BRAIN:
        return BrainProvider(config)
    elif source == DecisionSource.HUMAN:
        return HumanProvider(config)
```

**For StudyLoG.AI:** Already partially implemented in multi-model-router, but could benefit from the abstract provider pattern.

---

### Pattern 7: Character/Entity-Specific Thresholds

Different entities can have different escalation behaviors.

```python
# From game_ai.py example
class DnDCharacter:
    def _setup_thresholds(self):
        if self.character_class == "Fighter":
            # Fighters are confident in combat, use bot more
            self.engine.set_thresholds(
                self.name,
                EscalationThresholds(
                    bot_min_confidence=0.6,  # Lower threshold
                    brain_min_confidence=0.4,
                    high_stakes_threshold=0.8,
                )
            )
        elif self.character_class == "Wizard":
            # Wizards are more cautious, escalate earlier
            self.engine.set_thresholds(
                self.name,
                EscalationThresholds(
                    bot_min_confidence=0.8,  # Higher threshold
                    brain_min_confidence=0.6,
                    high_stakes_threshold=0.6,
                )
            )
```

**For StudyLoG.AI:** Different learning phases (Cognitive Mill vs Intelligence Ranch vs Sitka Sound) could have different escalation profiles.

---

### Pattern 8: Decision Context Enrichment

Rich context for better routing decisions.

```python
@dataclass
class DecisionContext:
    # Core context
    character_id: str
    situation_type: str
    situation_description: str

    # Importance
    stakes: float = 0.5              # 0=trivial, 1=critical
    urgency_ms: Optional[int] = None # Time available

    # State
    character_hp_ratio: float = 1.0
    available_resources: Dict[str, int] = field(default_factory=dict)

    # History
    similar_decisions_count: int = 0  # How many times seen similar
    recent_failures: int = 0          # Recent failed decisions

    # Metadata
    timestamp: float = field(default_factory=time.time)
    custom_data: Dict[str, Any] = field(default_factory=dict)
```

**For StudyLoG.AI:** Context could include current puzzle difficulty, student skill level, time spent on current problem, etc.

---

## Cost Savings Analysis

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

### For StudyLoG.AI
If StudyLoG.AI has 10,000 students each making 100 AI decisions/day:
- Traditional: 1,000,000 decisions x $0.02 = **$20,000/day**
- Escalation: $20,000 / 40 = **$500/day**
- **Annual savings: ~$7 million**

---

## Implementation Recommendations for StudyLoG.AI

### High Priority Implementations

1. **Escalation-Aware Multi-Model Router**
   - Add confidence scoring to model responses
   - Route based on task complexity, not just cost
   - Implement adaptive learning per student

2. **Per-Student Cost Tracking**
   - Track costs per student/session
   - Show cost transparency in UI
   - Implement daily/weekly budgets

3. **Novelty Detection for Learning**
   - Detect when student is attempting new concepts
   - Escalate to better models for new concepts
   - Use cheaper models for practice/reinforcement

4. **Stuck Student Detection**
   - Track recent failures per concept
   - Auto-escalate when student is stuck
   - Offer hints or human help

### Medium Priority

5. **Phase-Specific Thresholds**
   - Cognitive Mill: Higher escalation (learning phase)
   - Intelligence Ranch: Lower escalation (practice phase)
   - Sitka Sound: Variable (depends on scenario complexity)

6. **Configuration File Support**
   - Allow teachers to customize escalation thresholds
   - Per-class or per-lesson configurations

7. **Metrics Dashboard**
   - Show escalation rates per student
   - Cost breakdown by source
   - Learning progress vs cost correlation

### Low Priority (Future)

8. **Escalation as Teaching Tool**
   - Show students why certain models were chosen
   - Teach about AI costs and optimization
   - Gamify cost efficiency

---

## Code Examples for StudyLoG.AI

### Example 1: TypeScript Escalation Types

```typescript
// packages/escalation/src/types.ts

export enum DecisionSource {
  BOT = 'bot',       // Rule-based, free
  BRAIN = 'brain',   // Local Ollama, low cost
  HUMAN = 'human',   // Cloud API, higher cost
}

export enum EscalationReason {
  LOW_CONFIDENCE = 'low_confidence',
  HIGH_STAKES = 'high_stakes',
  NOVEL_SITUATION = 'novel_situation',
  TIME_CRITICAL = 'time_critical',
  SAFETY_CONCERN = 'safety_concern',
  COST_LIMIT = 'cost_limit',
}

export interface EscalationThresholds {
  botMinConfidence: number;        // Default: 0.7
  brainMinConfidence: number;      // Default: 0.5
  highStakesThreshold: number;     // Default: 0.7
  criticalStakesThreshold: number; // Default: 0.9
  noveltyThreshold: number;        // Default: 0.6
}

export interface DecisionContext {
  studentId: string;
  situationType: string;           // 'coding', 'quiz', 'tutorial', etc.
  situationDescription: string;
  stakes: number;                  // 0-1
  urgencyMs?: number;
  skillLevel: number;              // 0-1
  similarAttemptsCount: number;
  recentFailures: number;
  currentPhase: 'cognitive-mill' | 'intelligence-ranch' | 'sitka-sound';
}

export interface EscalationDecision {
  source: DecisionSource;
  reason?: EscalationReason;
  confidenceRequired: number;
  timeBudgetMs?: number;
  allowFallback: boolean;
  metadata: Record<string, unknown>;
}
```

### Example 2: Escalation Engine Class

```typescript
// packages/escalation/src/engine.ts

export class EscalationEngine {
  private thresholds: Map<string, EscalationThresholds> = new Map();
  private history: DecisionResult[] = [];
  private patterns: Map<string, string[]> = new Map();

  routeDecision(context: DecisionContext): EscalationDecision {
    const thresholds = this.getThresholds(context.studentId);

    // Check critical overrides first
    const criticalOverride = this.checkCriticalOverride(context, thresholds);
    if (criticalOverride) return criticalOverride;

    // Check novelty
    const isNovel = this.isNovelSituation(context, thresholds);
    const isHighStakes = context.stakes >= thresholds.highStakesThreshold;
    const isCritical = context.stakes >= thresholds.criticalStakesThreshold;

    // Route based on analysis
    if (isCritical) {
      return {
        source: DecisionSource.HUMAN,
        reason: EscalationReason.HIGH_STAKES,
        confidenceRequired: 0.9,
        allowFallback: true,
        metadata: { isCritical, isHighStakes, isNovel },
      };
    }

    if (isNovel && isHighStakes) {
      return {
        source: DecisionSource.BRAIN,
        reason: EscalationReason.NOVEL_SITUATION,
        confidenceRequired: thresholds.brainMinConfidence,
        allowFallback: true,
        metadata: { isCritical, isHighStakes, isNovel },
      };
    }

    // Default to BOT for routine situations
    return {
      source: DecisionSource.BOT,
      confidenceRequired: thresholds.botMinConfidence,
      allowFallback: true,
      metadata: { isCritical, isHighStakes, isNovel },
    };
  }

  recordOutcome(decisionId: string, success: boolean): void {
    const result = this.history.find(r => r.decisionId === decisionId);
    if (!result) return;

    result.success = success;
    this.updateThresholds(result.studentId, result, success);
  }

  private updateThresholds(
    studentId: string,
    result: DecisionResult,
    success: boolean
  ): void {
    const thresholds = this.getThresholds(studentId);

    if (result.source === DecisionSource.BOT) {
      if (success) {
        thresholds.botMinConfidence = Math.max(0.5, thresholds.botMinConfidence - 0.05);
      } else {
        thresholds.botMinConfidence = Math.min(0.9, thresholds.botMinConfidence + 0.1);
      }
    }
  }

  // ... additional methods
}
```

### Example 3: Integration with Multi-Model Router

```typescript
// apps/theia-ide/extensions/si-multi-model/src/node/escalation-router.ts

export class EscalationModelRouter {
  private escalationEngine: EscalationEngine;
  private modelRouter: ModelRouter;

  async route(context: DecisionContext): Promise<ModelResponse> {
    // Get escalation decision
    const decision = this.escalationEngine.routeDecision(context);

    // Map decision source to provider
    switch (decision.source) {
      case DecisionSource.BOT:
        return await this.handleWithBot(context, decision);
      case DecisionSource.BRAIN:
        return await this.handleWithBrain(context, decision);
      case DecisionSource.HUMAN:
        return await this.handleWithHuman(context, decision);
    }
  }

  private async handleWithBot(context: DecisionContext, decision: EscalationDecision) {
    // Use rule-based responses or cheap fast models
    return {
      content: this.getRuleBasedResponse(context),
      source: 'bot',
      cost: 0,
      confidence: 0.9,
    };
  }

  private async handleWithBrain(context: DecisionContext, decision: EscalationDecision) {
    // Use local Ollama
    return await this.modelRouter.route({
      provider: 'ollama',
      model: 'llama3.2',
      message: context.situationDescription,
      temperature: 0.7,
    });
  }

  private async handleWithHuman(context: DecisionContext, decision: EscalationDecision) {
    // Use best cloud model
    return await this.modelRouter.route({
      provider: 'anthropic',
      model: 'claude-opus-4-5',
      message: context.situationDescription,
      temperature: 0.7,
    });
  }
}
```

---

## Testing Approach

The escalation-engine uses a comprehensive test suite that StudyLoG.AI should emulate:

```typescript
describe('EscalationEngine', () => {
  it('should route routine decisions to bot', () => {
    const engine = new EscalationEngine();
    const context: DecisionContext = {
      studentId: 'test-student',
      situationType: 'faq',
      situationDescription: 'How do I reset password?',
      stakes: 0.2,
      similarAttemptsCount: 100,
      recentFailures: 0,
      skillLevel: 0.5,
      currentPhase: 'cognitive-mill',
    };

    const decision = engine.routeDecision(context);
    expect(decision.source).toBe(DecisionSource.BOT);
  });

  it('should route critical decisions to human', () => {
    const engine = new EscalationEngine();
    const context: DecisionContext = {
      studentId: 'test-student',
      situationType: 'security',
      situationDescription: 'Account compromised',
      stakes: 0.95,
      urgencyMs: 100,
      similarAttemptsCount: 0,
      recentFailures: 0,
      skillLevel: 0.5,
      currentPhase: 'cognitive-mill',
    };

    const decision = engine.routeDecision(context);
    expect(decision.source).toBe(DecisionSource.HUMAN);
  });

  it('should lower thresholds on success', () => {
    const engine = new EscalationEngine();
    const studentId = 'test-student';
    const initialThreshold = engine.getThresholds(studentId).botMinConfidence;

    engine.recordOutcome('decision-1', true);
    const newThreshold = engine.getThresholds(studentId).botMinConfidence;

    expect(newThreshold).toBeLessThan(initialThreshold);
  });
});
```

---

## Migration Path for StudyLoG.AI

### Phase 1: Core Escalation Engine (Week 1)
1. Create `packages/escalation/` with TypeScript types
2. Implement EscalationEngine class
3. Add basic routing logic
4. Write tests

### Phase 2: Multi-Model Integration (Week 2)
1. Extend ModelRouter with escalation support
2. Add confidence scoring to responses
3. Implement novelty detection
4. Add cost tracking per student

### Phase 3: StudyLoG.AI Specific Features (Week 3)
1. Phase-specific thresholds (Cognitive Mill, etc.)
2. Stuck student detection
3. Learning progress integration
4. Teacher configuration options

### Phase 4: UI and Monitoring (Week 4)
1. Cost dashboard per student
2. Escalation rate visualization
3. Teacher override controls
4. Student-facing cost transparency

---

## Key Takeaways

1. **40x cost reduction is achievable** through intelligent routing
2. **Confidence-based escalation** is the core pattern
3. **Adaptive learning per entity** improves over time
4. **Critical overrides** ensure safety first
5. **Novelty detection** enables smart routing
6. **Cost transparency** helps users understand value
7. **Rich context** enables better decisions
8. **Per-entity customization** supports diverse use cases

---

## References

- Repository: https://github.com/SuperInstance/escalation-engine
- PyPI: https://pypi.org/project/escalation-engine/
- License: MIT

---

**End of Research Report**
