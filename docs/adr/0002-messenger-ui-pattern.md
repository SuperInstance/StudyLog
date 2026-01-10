# ADR 0002: PersonalLog Messenger UI Pattern

**Status**: Proposed
**Date**: 2026-01-10
**Deciders**: StudyLoG.AI Team
**Related**: ADR-0001 (G-Assist Integration), ADR-0003 (Component Rolodex)

---

## Context

StudyLoG.AI needs a dedicated tutoring interface that provides conversational learning experiences. The interface should support:

1. **Progressive hints** - Guide without giving answers
2. **Conversation threading** - Multiple learning sessions
3. **Rich content** - Code, diagrams, simulations
4. **Learning progress** - Track student development
5. **Voice integration** - Connect to G-Assist

### User Stories

- As a **student**, I want to ask questions naturally and get helpful guidance
- As a **tutor**, I want to provide hints that guide without spoiling
- As a **learner**, I want to see my progress over time
- As a **user**, I want to speak my questions (via G-Assist)

### Constraints

1. **Theia-compatible** - Must embed in Theia IDE
2. **Responsive** - Work on different screen sizes
3. **Accessible** - Keyboard navigation, screen readers
4. **Extensible** - Support future message types

---

## Decision

We will implement a messenger-style UI pattern inspired by modern chat applications, with educational enhancements.

### UI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐  ┌─────────────────────────────────────────┐  │
│  │         │  │  PersonalLog - AI Tutor                  │  │
│  │  Chat   │  ├─────────────────────────────────────────┤  │
│  │ History │  │  [Messages Area - scrollable]            │  │
│  │         │  │                                          │  │
│  │ ┌─────┐ │  │  Student: How do I create a loop?        │  │
│  │ │Chat 1│ │  │  ─────────────────────────────────      │  │
│  │ ├─────┤ │  │  Tutor: Great question! Think about...   │  │
│  │ │Chat 2│ │  │                                          │  │
│  │ ├─────┤ │  │  [Hint: Level 1/3]                       │  │
│  │ │Chat 3│ │  │  Think about what a loop needs to...    │  │
│  │ └─────┘ │  │  [Show Hint ▼]                           │  │
│  │         │  │                                          │  │
│  │ [+ New] │  │  Typing...                               │  │
│  └─────────┘  ├─────────────────────────────────────────┤  │
│               │  [Type your message...]      [Voice] [Send]│  │
│               └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
interface MessengerWidget {
  // Sidebar with conversation list
  conversationList: ConversationListWidget;

  // Main chat area
  messageList: MessageListWidget;
  messageInput: MessageInputWidget;

  // Educational enhancements
  hintPanel: HintPanelWidget;
  progressTracker: ProgressTrackerWidget;
  tutorControls: TutorControlsWidget;
}
```

### Message Types

| Type | Purpose | Features |
|------|---------|----------|
| **text** | Plain text messages | Basic formatting |
| **code** | Code snippets | Syntax highlighting, copy button |
| **hint** | Progressive hints | Tiered reveal, spoiler protection |
| **diagram** | Visual explanations | Mermaid, SVG rendering |
| **simulation** | Godot scene embed | Interactive learning |
| **quiz** | Knowledge checks | Multiple choice, auto-verify |

### Hint Progression System

```typescript
interface Hint {
  level: number;        // 1-3, from subtle to direct
  content: string;
  revealed: boolean;
  unlocksAt: number;   // Time/difficulty threshold
}

interface HintStrategy {
  hintCount: number;           // Total hints available
  revealStrategy: 'time' | 'request' | 'struggle';
  cooldownSeconds: number;     // Minimum time between hints
  difficulty: number;          // Affects hint directness
}
```

---

## Alternatives Considered

### Alternative 1: Traditional Documentation/Help Panel

**Description**: Static documentation with search and indexing.

**Pros**:
- Familiar pattern
- Easy to implement
- SEO-friendly

**Cons**:
- Passive learning
- No personalization
- No conversational flow
- Doesn't adapt to learner

**Decision**: **REJECTED** - Not aligned with active learning philosophy.

### Alternative 2: Video-Based Tutorials

**Description**: Pre-recorded video lessons with chapters.

**Pros**:
- Engaging format
- Visual demonstrations
- Pause/rewind control

**Cons**:
- Hard to update
- Bandwidth-intensive
- Not interactive
- One-way communication

**Decision**: **REJECTED** - Doesn't allow for personalized tutoring.

### Alternative 3: Pure Voice Assistant

**Description**: G-Assist only, no chat interface.

**Pros**:
- Natural interaction
- Hands-free operation
- Simple UI

**Cons**:
- No visual history
- Reading speed controlled by TTS
- Hard to reference past answers
- Accessibility issues

**Decision**: **REJECTED** - Needs text fallback for accessibility and reference.

---

## Consequences

### Positive

1. **Familiar UX** - Users understand chat interfaces
2. **Persistent context** - Full history available
3. **Progressive disclosure** - Hints guide without spoiling
4. **Multi-modal** - Text, voice, code, diagrams
5. **Voice integration** - Seamless G-Assist connection

### Negative

1. **UI complexity** - More components to maintain
2. **State management** - Conversation threading is complex
3. **Storage costs** - Storing all message history
4. **Context limits** - LLM context window constraints

### Risks

1. **Over-hinting** - Students might rely too much on hints
2. **Privacy concerns** - Storing conversation history
3. **Escalation** - Students might demand hints too early
4. **Off-topic** - Conversations might drift

### Mitigations

1. **Hint cooldowns** - Prevent rapid hint usage
2. **Struggle detection** - Only offer hints after genuine effort
3. **Privacy mode** - Optional ephemeral conversations
4. **Context management** - Summarization and pruning

---

## Implementation Plan

See `/IMPLEMENTATION.md` Phase 2 for detailed steps.

### Key Milestones

1. **Week 1**: Basic messenger UI + message types
2. **Week 2**: Hint engine + progression system
3. **Week 3**: G-Assist integration + polish

---

## Related Decisions

- **ADR-0001**: G-Assist Integration for voice input
- **ADR-0003**: Component Rolodex for sharing hint strategies
- **ADR-0005**: Learning Progress Tracking

---

## Design Mockups

### Message Bubble Types

```
┌─────────────────────────────────────────────────┐
│ Student Message                    10:23 AM     │
│ How do I create a for loop in GDScript?        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🎓 Teacher Agent                  10:23 AM     │
│ Great question! A for loop needs a few parts   │
│ to work properly.                               │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 💡 Hint (Level 1/3)        [Show] [Skip]│   │
│ │ Think about what a loop needs to        │   │
│ │ - know when to start                    │   │
│ │ - know what to do each time             │   │
│ │ - know when to stop                     │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## References

- Messenger UI Patterns: Material Design Chat
- Progressive Hinting: Cognitive Load Theory
- Conversational Learning: Vygotsky's ZPD
