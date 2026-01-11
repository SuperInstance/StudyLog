# DMLoG.AI Memory System

A sophisticated 6-tier hierarchical memory system for DMLoG.AI (TTRPG with AI agents). Implements character memory with temporal consciousness, relationship tracking, campaign state management, and player preference learning.

## Architecture

### 6-Tier Memory Hierarchy

1. **Working Memory** - Current context, recent events, present characters
2. **Episodic Memory** - Specific events with temporal context, sensory details
3. **Semantic Memory** - Facts, concepts, world knowledge
4. **Procedural Memory** - Skills, behaviors, learned patterns
5. **Reflection Memory** - Meta-cognition, insights, self-assessment
6. **Identity Memory** - Core traits, values, stable personality

### Core Systems

- **CharacterMemory** - Per-NPC/PC memory with decay, reinforcement, consolidation
- **TemporalConsciousness** - Time perception, anticipation, life periodization
- **RelationshipTracker** - NPC-NPC, NPC-PC bonds with debts and promises
- **CampaignMemory** - World state, locations, plot threads, factions
- **PlayerMemory** - Playstyle tracking, preferences, growth patterns
- **PlotThreadManager** - Plot discovery, weaving, dramatic irony, foreshadowing
- **MemoryConsolidation** - Transfer between tiers, session processing

## Installation

```bash
pnpm install
```

## Quick Start

```typescript
import { dmlogMemorySystem, MemoryType, EmotionalValence } from '@dmlog/memory';

// Initialize a character
const character = dmlogMemorySystem.initializeCharacter('npc_goblin_1', 'campaign_1', [
  { trait: 'aggressive', value: true, stability: 0.8 },
  { trait: 'territorial', value: true, stability: 0.9 },
]);

// Add an episodic memory
dmlogMemorySystem.addEpisodicMemory('npc_goblin_1', {
  type: MemoryType.COMBAT,
  sessionId: 'session_1',
  campaignId: 'campaign_1',
  importance: 0.8,
  tags: ['combat', 'first_encounter', 'party'],
  eventId: 'evt_001',
  participants: ['npc_goblin_1', 'pc_fighter', 'pc_cleric'],
  location: 'goblin_cave_entrance',
  description: 'First encounter with adventurers. They attacked without warning.',
  emotionalValence: EmotionalValence.NEGATIVE,
  outcome: 'Fled to warn the tribe',
});

// Query memories
const memories = dmlogMemorySystem.queryMemories('npc_goblin_1', {
  tiers: ['episodic'],
  emotionalValence: [EmotionalValence.NEGATIVE],
  limit: 5,
});

// Get character prompt for AI
const prompt = dmlogMemorySystem.getCharacterPrompt('npc_goblin_1', {
  includeTemporal: true,
  includeRelationships: true,
});
```

## API Reference

### Character Memory

```typescript
// Initialize character
initializeCharacter(characterId, campaignId, identityTraits?)

// Add memories
addEpisodicMemory(characterId, memory)
addSemanticMemory(characterId, memory)
addProceduralMemory(characterId, memory)

// Query memories
queryMemories(characterId, query)
getRelatedMemories(characterId, memoryId, maxResults?)
getMemoriesByEmotion(characterId, valence, tier?)
```

### Temporal Consciousness

```typescript
// Time perception
generateAnticipation(characterId, upcomingEvent)
getTemporalPerspective(characterId)

// Life events
getTemporalLandmarks(characterId)
updateLifePeriods(characterId)
```

### Relationships

```typescript
// Process interaction
processRelationshipEvent({
  type: 'help',
  sourceId: 'npc_merchant',
  targetId: 'pc_rogue',
  magnitude: 0.5,
  description: 'Gave discount on supplies',
})

// Debts and promises
recordDebt({ creditorId, debtorId, type, description, magnitude })
recordPromise({ promisorId, promiseeId, content, importance })
resolveDebt(debtorId, creditorId, debtIndex)
```

### Campaign Memory

```typescript
// Locations
addLocation(campaignId, location)
visitLocation(campaignId, locationId, characterIds)
discoverSecret(campaignId, locationId, secret)

// Plot threads
createPlotThread(campaignId, thread)
advancePlotThread(campaignId, threadId, eventMemoryId)
resolvePlotThread(campaignId, threadId, resolutionMemoryId, satisfaction)

// Factions
addFaction(campaignId, faction)
updateFactionRelationship(campaignId, factionId, targetId, relation, tension?)
```

### Player Memory

```typescript
// Tracking
recordPlayerSession(playerId, campaignId, duration, characterId)
updatePlayerPlaystyle(playerId, observations)
addFeedback(playerId, sessionId, positive, negative, rating?)

// Insights
getPlaystylePrompt(playerId)
getPlayerRecommendations(playerId)
getGrowthInsights(playerId)
```

### Consolidation

```typescript
// Process session
await dmlogMemorySystem.endSession(
  campaignId,
  sessionId,
  participants,
  cliffhangers,
  nextSessionHooks
)

// Manual consolidation
await memoryConsolidationEngine.consolidateSession(characterId, sessionId, campaignId)

// Transfer between tiers
memoryConsolidationEngine.promoteMemory(characterId, memoryId, targetTier)
memoryConsolidationEngine.batchTransfer(characterId, sourceTier, targetTier)
```

## File Structure

```
dmlog-memory/
├── index.ts                 # Main API, exports everything
├── types.ts                 # All TypeScript types and enums
├── character-memory.ts      # Character memory store
├── campaign-memory.ts       # Campaign/world state
├── player-memory.ts         # Player preferences & growth
├── relationship-tracker.ts  # NPC relationships
├── temporal-consciousness.ts # Time perception
├── plot-threads.ts          # Plot management
├── memory-consolidation.ts  # Tier transfer & processing
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
