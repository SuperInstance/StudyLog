# Agents Documentation Index

**SuperInstance.AI Agent and Character System Documentation**

This directory contains comprehensive documentation for AI agents and characters across all SuperInstance products.

---

## Core Documentation

### [AI_CHARACTER_INTEGRATION_GUIDE.md](./AI_CHARACTER_INTEGRATION_GUIDE.md)
**Master integration document for the unified character system**

Contents:
- Integration overview and architecture
- Component connections (Memory, Personality, Decision, Learning)
- Unified Agent API specifications
- Integration patterns (memory sharing, coordination, state sync)
- Deployment guide and scaling considerations
- Code examples for all use cases
- DMLog & StudyLoG.AI bridge patterns
- Implementation roadmap (14 weeks)

**Who should read:** Developers implementing characters, system architects

---

## Product-Specific Guides

### StudyLoG.AI
Character applications for educational scenarios:

- **Tutor Characters** - AI teaching assistants with Socratic questioning
- **Learning Trackers** - Student progress and memory systems
- **Mentor NPCs** - In-world guides for Godot simulations

### DMLoG.AI
Character applications for TTRPG scenarios:

- **Combat Bots** - Intelligent NPCs for tactical combat
- **Social Bots** - Conversational NPCs with memory
- **DM Assistants** - Campaign management and pacing

---

## Related Documentation

### Research Notes
- [`../SUPERINSTANCE_CHARACTER_NOTES.md`](../SUPERINSTANCE_CHARACTER_NOTES.md) - Character SDK research
- [`../SUPERINSTANCE_MEMORY_NOTES.md`](../SUPERINSTANCE_MEMORY_NOTES.md) - Memory system research
- [`../SUPERINSTANCE_COORDINATOR_NOTES.md`](../SUPERINSTANCE_COORDINATOR_NOTES.md) - Agent coordination research

### Architecture
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) - Overall system architecture
- [`../GODOT_INTEGRATION.md`](../GODOT_INTEGRATION.md) - Godot engine integration

---

## Quick Reference

### Creating a Character

```typescript
import { Character } from '@superinstance/character-sdk';

const hero = new Character({
  name: 'Luna',
  characterClass: 'ranger',
  personality: { bravery: 0.8, curiosity: 0.9 },
  backstory: 'A wanderer from the northern forests.',
  goals: ['Protect the forest', 'Help those in need'],
});

// Use the character
const response = await hero.think('A merchant needs help');
hero.remember('Helped the merchant', 7.0);
hero.learn('Made a new ally', true, 10);
```

### Character Lifecycle

```
Creation -> Memory Development -> Decision Making -> Learning -> Persistence
    ^              |                    |              |              |
    |              v                    v              v              v
Identity         Experience            Response        Adaptation      Save
```

---

## Contribute

To add or update documentation:

1. Edit the relevant markdown file
2. Ensure code examples are tested
3. Update the table of contents if needed
4. Run `pnpm typecheck` and `pnpm lint`

---

**Last Updated:** 2026-01-10
**Version:** 1.0.0
