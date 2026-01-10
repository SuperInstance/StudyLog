# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the StudyLoG.AI project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that describes an important architectural decision in a software project. Each ADR:

- **Context**: Why are we making this decision?
- **Decision**: What did we decide?
- **Alternatives**: What else did we consider?
- **Consequences**: What are the results of this decision?

## Template

```markdown
# ADR XXXX: [Title]

**Status**: [Proposed | Accepted | Deprecated | Superseded]
**Date**: YYYY-MM-DD
**Deciders**: StudyLoG.AI Team
**Related**: [Links to related ADRs]

---

## Context

[Background and problem statement]

## Decision

[What we decided and why]

## Alternatives Considered

### Alternative 1: [Name]
**Description**: [Summary]
**Pros**: [List]
**Cons**: [List]
**Decision**: [ACCEPTED/REJECTED] - [Reason]

## Consequences

### Positive
[Benefits of this decision]

### Negative
[Drawbacks of this decision]

### Risks
[Potential issues and mitigations]

## Implementation Plan

[How we will implement this decision]

## Related Decisions

- [ADR-XXXX]: [Related decision]

## References

[Links to external resources]
```

## Index

### Active Architecture Decisions

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-cascade-routing-architecture.md) | Cascade Routing Architecture | Accepted | 2026-01-10 |
| [ADR-002](ADR-002-theia-extension-architecture.md) | Theia Extension Architecture | Accepted | 2026-01-10 |
| [ADR-003](ADR-003-cloudflare-workers-backend.md) | Cloudflare Workers Backend | Accepted | 2026-01-10 |
| [ADR-004](ADR-004-agent-based-voice-assistant.md) | Agent-Based Voice Assistant | Accepted | 2026-01-10 |

### Legacy ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-0001](0001-g-assist-integration.md) | G-Assist Integration Approach | Superseded by ADR-004 | 2026-01-10 |
| [ADR-0002](0002-messenger-ui-pattern.md) | PersonalLog Messenger UI Pattern | Proposed | 2026-01-10 |
| [ADR-0003](0003-component-rolodex.md) | Component Rolodex Design | Superseded by COMPONENTS.md | 2026-01-10 |
| [ADR-0004](0004-multi-agent-swarm.md) | Multi-Agent Swarm Orchestration | Proposed | 2026-01-10 |

## How to Add an ADR

1. Copy the template above
2. Create a new file: `docs/adr/YYYY-MM-DD-title.md` (use descriptive slug)
3. Update this README with the new ADR
4. Follow the naming convention: `XXXX-descriptive-slug.md`

## Status Definitions

- **Proposed**: Under consideration, not yet implemented
- **Accepted**: Decision made, implementation in progress
- **Deprecated**: Decision is being phased out
- **Superseded**: Replaced by a newer decision
