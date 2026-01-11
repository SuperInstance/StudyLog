# DMLoG Procedural Content Generation

DMLoG Agent 3/3 - Procedural Content Generation system for DMLoG.AI campaigns.

## Overview

This system generates procedural content for TTRPG campaigns using:
- **Deterministic math** for CR calculations, XP budgets, stat blocks, treasure values
- **AI-assisted templates** for creative elements like descriptions, personalities, and plot hooks

## Modules

### encounter-gen.ts

Combat encounter generation with math-based XP budgets and creature composition.

```typescript
import { EncounterGen } from '@dmlog/procedural';

const encounter = await EncounterGen.generateEncounter({
  party: { level: 5, size: 4 },
  difficulty: 'hard',
  terrain: 'dungeon-chamber',
  creatureTypes: ['goblin', 'hobgoblin', 'bugbear'],
  includeBoss: true,
});

console.log(encounter.difficulty); // 'hard'
console.log(encounter.creatures); // Array of creatures with counts
console.log(encounter.environment); // Terrain and effects
```

### npc-gen.ts

NPC generation with personality, stats, voice, and roleplaying hooks.

```typescript
import { NPCGen } from '@dmlog/procedural';

const npc = NPCGen.generateNPC({
  race: 'Elf',
  gender: 'female',
  characterClass: 'wizard',
  level: 5,
  background: 'sage',
});

console.log(npc.name); // "Aerie Moonwhisper"
console.log(npc.personality.voice); // Voice descriptor
console.log(npc.personality.motivations); // Primary, secondary, hidden motivations
console.log(npc.roleplayHooks); // Ways to introduce the NPC
```

### loot-gen.ts

Treasure and magic item generation with value calculations.

```typescript
import { LootGen } from '@dmlog/procedural';

const hoard = LootGen.generateTreasureHoard({
  cr: 10,
  source: 'hoard',
});

console.log(hoard.currency); // { cp: 0, sp: 0, ep: 0, gp: 2500, pp: 15 }
console.log(hoard.gems); // Array of gems with values
console.log(hoard.magicItems); // Array of magic items

const potion = LootGen.generatePotion();
console.log(potion.name); // "Potion of Healing"
```

### dungeon-gen.ts

Dungeon and room generation with spatial algorithms.

```typescript
import { DungeonGen } from '@dmlog/procedural';

const dungeon = DungeonGen.generateDungeon({
  type: 'dungeon',
  levels: 3,
  roomsPerLevel: 8,
  theme: 'Ancient Ruins',
  recommendedLevel: { min: 3, max: 7 },
});

console.log(dungeon.levels[0].rooms); // Array of rooms
console.log(dungeon.levels[0].corridors); // Connections between rooms
```

### quest-gen.ts

Plot hook and quest generation with narrative structures.

```typescript
import { QuestGen } from '@dmlog/procedural';

const quest = QuestGen.generateQuest({
  questType: 'investigate',
  tier: 'regional',
  rarity: 'rare',
});

console.log(quest.name); // "The Investigation Mystery"
console.log(quest.plotHook.hook); // The plot hook text
console.log(quest.objectives); // Main and optional objectives
console.log(quest.rewards); // Gold, XP, items, reputation

const chain = QuestGen.generateQuestChain({
  tier: 'national',
  questCount: 5,
});
console.log(chain.quests.length); // 5 quests leading to finale
```

## Integration

Generate a complete adventure:

```typescript
import { generateAdventure } from '@dmlog/procedural';

const adventure = await generateAdventure({
  name: 'The Sunken Citadel',
  dungeonType: 'dungeon',
  levels: 3,
  roomsPerLevel: 10,
  partyLevel: 5,
  partySize: 4,
  theme: 'Aquatic Ruins',
});

console.log(adventure.dungeon); // Full dungeon layout
console.log(adventure.encounters); // Combat encounters per room
console.log(adventure.npcs); // NPCs to roleplay
console.log(adventure.loot); // Treasure locations
console.log(adventure.quest); // Main story arc
```

## License

MIT
