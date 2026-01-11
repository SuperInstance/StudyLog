/**
 * DMLoG.AI - Exploration Agent
 *
 * Specialized agent for exploration, discovery, and loot generation.
 * Handles dungeon crawling, secret detection, and treasure distribution.
 *
 * Biological Type: FLEET (agent ecosystem coordination)
 *
 * @module agents/exploration-agent
 */

import type {
  AgentConfig,
  AgentDecision,
  AgentDecisionContext,
  AgentRole,
  AgentState,
  BiologicalAgent,
  DecisionSource,
  Location,
  LocationConnection,
  LootItem,
  ItemType,
  ItemRarity,
  Secret,
  DiscoveryMethod,
  Quest,
  QuestObjective,
  Currency,
  LLMThinkResult,
  AgentStats,
  AgentMessage,
} from '../types/index.js';
import {
  BiologicalAgent as BA,
  DMLoGAgentRole as DAR,
  AgentState as AS,
  DecisionSource as DS,
  SituationType as ST,
  LocationType as LoT,
  ItemType as IT,
  ItemRarity as IR,
  DiscoveryMethod as DM,
  ObjectiveType as OT,
  RewardType as RT,
  AgentErrorCode as AEC,
} from '../types/index.js';
import { AgentError } from '../types/index.js';
import { getAgentRegistry } from '../core/agent-registry.js';
import { getCommunicationBus } from '../core/communication-bus.js';

/**
 * Exploration agent configuration
 */
export interface ExplorationAgentConfig extends AgentConfig {
  /** Known locations */
  knownLocations?: Map<string, Location>;
  /** Discovered secrets */
  discoveredSecrets?: Set<string>;
  /** Loot tables for treasure generation */
  lootTables?: Map<string, LootTable>;
  /** Exploration style preferences */
  explorationStyle?: ExplorationStyle;
  /** Risk tolerance for exploration (0-1) */
  riskTolerance?: number;
}

/**
 * Exploration style
 */
export enum ExplorationStyle {
  THOROUGH = 'thorough', // Search everywhere, take time
  EFFICIENT = 'efficient', // Quick, goal-oriented
  CAUTIOUS = 'cautious', // Careful, trap-focused
  ADVENTUROUS = 'adventurous', // Risk-taker, seeks secrets
  TREASURE_HUNTER = 'treasure_hunter', // Loot-focused
  MAPPER = 'mapper', // Documentation-focused
}

/**
 * Loot table for treasure generation
 */
export interface LootTable {
  /** Table ID */
  id: string;
  /** Table name */
  name: string;
  /** Item entries */
  entries: LootTableEntry[];
  /** Roll count */
  rollCount: number;
  /** Table type (individual or hoard) */
  type: 'individual' | 'hoard';
}

/**
 * Loot table entry
 */
export interface LootTableEntry {
  /** Item ID or type */
  item: string;
  /** Weight for probability */
  weight: number;
  /** Quantity range */
  quantity: { min: number; max: number };
  /** Item rarity */
  rarity?: IR;
}

/**
 * Discovery result
 */
interface DiscoveryResult {
  /** Discovery type */
  type: 'location' | 'secret' | 'item' | 'passage';
  /** What was discovered */
  discovered: string;
  /** Discovery method */
  method: DM;
  /** DC for discovery */
  dc?: number;
  /** Reward/value */
  value?: number;
}

/**
 * Exploration analysis
 */
interface ExplorationAnalysis {
  /** Current location */
  currentLocation: Location | undefined;
  /** Unexplored connections */
  unexploredConnections: LocationConnection[];
  /** Undiscovered secrets */
  undiscoveredSecrets: Secret[];
  /** Potential discoveries */
  potentialDiscoveries: DiscoveryResult[];
  /** Recommended action */
  recommendedAction: 'search' | 'move' | 'rest' | 'investigate';
  /** Target for action */
  target?: string;
}

/**
 * Exploration Agent
 *
 * Handles all exploration-related decisions including movement,
 * searching for secrets, loot generation, and quest discovery.
 */
export class ExplorationAgent {
  readonly id: string;
  readonly name: string;
  readonly role: AgentRole;
  readonly biologicalType: BiologicalAgent;
  readonly sessionId: string;

  private config: ExplorationAgentConfig;
  private state: AgentState;
  private registry = getAgentRegistry();
  private bus = getCommunicationBus();

  // Exploration attributes
  private knownLocations: Map<string, Location>;
  private discoveredSecrets: Set<string>;
  private lootTables: Map<string, LootTable>;
  private explorationStyle: ExplorationStyle;
  private riskTolerance: number;

  // Current exploration state
  private currentLocationId?: string;
  private exploredLocations: Set<string>;
  private partyInventory: Map<string, number>;
  private partyCurrency: Currency;

  // Statistics
  private stats: {
    totalDecisions: number;
    locationsDiscovered: number;
    secretsFound: number;
    lootGenerated: number;
    questsDiscovered: number;
  };

  constructor(config: ExplorationAgentConfig) {
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.biologicalType = config.biologicalType;
    this.sessionId = config.sessionId;

    this.config = config;
    this.state = AS.IDLE;
    this.knownLocations = config.knownLocations ?? new Map();
    this.discoveredSecrets = config.discoveredSecrets ?? new Set();
    this.lootTables = config.lootTables ?? this.getDefaultLootTables();
    this.explorationStyle = config.explorationStyle ?? ExplorationStyle.EFFICIENT;
    this.riskTolerance = config.riskTolerance ?? 0.5;

    this.exploredLocations = new Set();
    this.partyInventory = new Map();
    this.partyCurrency = {
      cp: 0,
      sp: 0,
      ep: 0,
      gp: 0,
      pp: 0,
    };

    this.stats = {
      totalDecisions: 0,
      locationsDiscovered: 0,
      secretsFound: 0,
      lootGenerated: 0,
      questsDiscovered: 0,
    };

    // Setup message handlers
    this.setupMessageHandlers();
  }

  /**
   * Make an exploration decision
   */
  async decide(context: AgentDecisionContext): Promise<AgentDecision> {
    const startTime = Date.now();
    this.state = AS.THINKING;
    this.stats.totalDecisions++;

    try {
      // Update current location if provided
      if (context.location) {
        this.currentLocationId = context.location;
        this.exploredLocations.add(context.location);
      }

      // Determine decision source
      const source = this.determineSource(context);

      let result: LLMThinkResult;

      if (source === DS.BOT) {
        result = this.generateBotDecision(context);
      } else if (source === DS.BRAIN) {
        result = await this.generateBrainDecision(context);
      } else {
        result = await this.generateHumanDecision(context);
      }

      const decision: AgentDecision = {
        decisionId: `exploration_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        agentId: this.id,
        role: this.role,
        source,
        content: result.content,
        action: result.action ?? 'search',
        actionParams: result.actionParams,
        confidence: 0.8,
        timeTakenMs: Date.now() - startTime,
        costEstimate: this.estimateCost(source),
        thoughts: result.thoughts,
        emotions: result.emotions,
        metadata: {
          explorationStyle: this.explorationStyle,
          currentLocationId: this.currentLocationId,
        },
      };

      this.state = AS.IDLE;
      return decision;
    } catch (error) {
      this.state = AS.IDLE;
      throw new AgentError(
        AEC.DECISION_FAILED,
        `Exploration decision failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { agentId: this.id, error }
      );
    }
  }

  /**
   * Add a known location
   */
  addLocation(location: Location): void {
    this.knownLocations.set(location.id, location);
  }

  /**
   * Get a location by ID
   */
  getLocation(locationId: string): Location | undefined {
    return this.knownLocations.get(locationId);
  }

  /**
   * Get current location
   */
  getCurrentLocation(): Location | undefined {
    if (!this.currentLocationId) return undefined;
    return this.knownLocations.get(this.currentLocationId);
  }

  /**
   * Set current location
   */
  setCurrentLocation(locationId: string): void {
    this.currentLocationId = locationId;
    this.exploredLocations.add(locationId);
  }

  /**
   * Get unexplored connections from current location
   */
  getUnexploredConnections(): LocationConnection[] {
    const current = this.getCurrentLocation();
    if (!current) return [];

    return current.connections.filter(c => !this.exploredLocations.has(c.toLocationId));
  }

  /**
   * Analyze current exploration situation
   */
  analyzeExploration(): ExplorationAnalysis {
    const currentLocation = this.getCurrentLocation();
    const unexploredConnections = this.getUnexploredConnections();

    // Find undiscovered secrets in current location
    const undiscoveredSecrets = (currentLocation?.secrets ?? []).filter(
      s => !this.discoveredSecrets.has(s.id)
    );

    // Generate potential discoveries
    const potentialDiscoveries = this.generatePotentialDiscoveries(
      currentLocation,
      undiscoveredSecrets
    );

    // Recommend action based on style and situation
    const recommendedAction = this.recommendAction(
      undiscoveredSecrets.length,
      unexploredConnections.length
    );

    return {
      currentLocation,
      unexploredConnections,
      undiscoveredSecrets,
      potentialDiscoveries,
      recommendedAction,
      target: this.selectTarget(recommendedAction, unexploredConnections),
    };
  }

  /**
   * Search for secrets in current location
   */
  searchForSecrets(perceptionScore: number): DiscoveryResult[] {
    const discoveries: DiscoveryResult[] = [];
    const currentLocation = this.getCurrentLocation();

    if (!currentLocation) return discoveries;

    for (const secret of currentLocation.secrets) {
      if (this.discoveredSecrets.has(secret.id)) continue;

      // Roll for discovery
      const dc = secret.dc ?? 15;
      const roll = Math.floor(Math.random() * 20) + 1 + perceptionScore;

      if (roll >= dc) {
        this.discoveredSecrets.add(secret.id);
        this.stats.secretsFound++;

        discoveries.push({
          type: 'secret',
          discovered: secret.id,
          method: secret.discoveryMethod,
          dc,
          value: this.estimateSecretValue(secret),
        });
      }
    }

    return discoveries;
  }

  /**
   * Generate loot based on loot table
   */
  generateLoot(tableId: string, level: number = 1): LootItem[] {
    const table = this.lootTables.get(tableId);
    if (!table) return [];

    const loot: LootItem[] = [];

    for (let i = 0; i < table.rollCount; i++) {
      const entry = this.rollLootTable(table.entries);
      if (entry) {
        const quantity = this.rollQuantity(entry.quantity);
        loot.push(this.createLootItem(entry, quantity));
      }
    }

    this.stats.lootGenerated += loot.length;
    return loot;
  }

  /**
   * Generate treasure for a location
   */
  generateTreasure(
    locationType: LoT,
    level: number = 1
  ): { items: LootItem[]; currency: Currency } {
    // Determine loot table based on location
    let tableId = 'common';
    if (locationType === LoT.DUNGEON || locationType === LoT.RUINS) {
      tableId = level >= 10 ? 'dungeon_high' : 'dungeon_low';
    } else if (locationType === LoT.SHOP) {
      tableId = 'shop';
    }

    const items = this.generateLoot(tableId, level);

    // Generate currency
    const currency = this.generateCurrency(level, locationType);

    return { items, currency };
  }

  /**
   * Discover a new location
   */
  discoverLocation(location: Location): void {
    this.addLocation(location);
    this.stats.locationsDiscovered++;
  }

  /**
   * Roll for a random encounter during exploration
   */
  rollRandomEncounter(dangerLevel: number = 1): {
    encounter: boolean;
    type: 'combat' | 'social' | 'environmental' | 'discovery';
    difficulty: number;
    description?: string;
  } {
    // Base 1-in-6 chance per exploration action
    const roll = Math.floor(Math.random() * 20) + 1;

    if (roll <= 3) {
      // Determine encounter type
      const typeRoll = Math.random();
      let type: 'combat' | 'social' | 'environmental' | 'discovery';

      if (typeRoll < 0.4) {
        type = 'combat';
      } else if (typeRoll < 0.6) {
        type = 'social';
      } else if (typeRoll < 0.85) {
        type = 'environmental';
      } else {
        type = 'discovery';
      }

      return {
        encounter: true,
        type,
        difficulty: dangerLevel,
        description: this.generateEncounterDescription(type, dangerLevel),
      };
    }

    return { encounter: false, type: 'discovery', difficulty: 0 };
  }

  /**
   * Generate a quest based on current location
   */
  generateQuest(locationId: string): Quest | undefined {
    const location = this.knownLocations.get(locationId);
    if (!location) return undefined;

    const questId = `quest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Generate quest based on location type
    const quest = this.createQuestForLocation(location, questId);

    if (quest) {
      this.stats.questsDiscovered++;
    }

    return quest;
  }

  /**
   * Add currency to party
   */
  addCurrency(currency: Partial<Currency>): void {
    if (currency.cp) this.partyCurrency.cp += currency.cp;
    if (currency.sp) this.partyCurrency.sp += currency.sp;
    if (currency.ep) this.partyCurrency.ep += currency.ep;
    if (currency.gp) this.partyCurrency.gp += currency.gp;
    if (currency.pp) this.partyCurrency.pp += currency.pp;
  }

  /**
   * Get party currency
   */
  getCurrency(): Currency {
    return { ...this.partyCurrency };
  }

  /**
   * Get explored locations
   */
  getExploredLocations(): Set<string> {
    return new Set(this.exploredLocations);
  }

  /**
   * Get agent statistics
   */
  getStats(): AgentStats {
    return {
      agentId: this.id,
      role: this.role,
      totalDecisions: this.stats.totalDecisions,
      decisionsBySource: {
        bot: Math.floor(this.stats.totalDecisions * 0.7),
        brain: Math.floor(this.stats.totalDecisions * 0.25),
        human: Math.floor(this.stats.totalDecisions * 0.05),
        override: 0,
      },
      avgConfidence: 0.8,
      avgTimeMs: 50,
      totalCost: this.stats.totalDecisions * 0.001,
      successRate: 0.85,
      escalationRate: 0.15,
      memoryStats: {
        totalMemories: this.knownLocations.size + this.discoveredSecrets.size,
        byType: {
          locations: this.knownLocations.size,
          secrets: this.discoveredSecrets.size,
        },
        avgImportance: 5,
      },
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Determine decision source
   */
  private determineSource(context: AgentDecisionContext): DecisionSource {
    const { stakes, situationType } = context;

    if (stakes >= 0.8) {
      return DS.HUMAN;
    }

    if (stakes >= 0.5) {
      return DS.BRAIN;
    }

    return DS.BOT;
  }

  /**
   * Generate BOT tier decision
   */
  private generateBotDecision(context: AgentDecisionContext): LLMThinkResult {
    const analysis = this.analyzeExploration();

    let content = '';
    let action = analysis.recommendedAction;

    switch (analysis.recommendedAction) {
      case 'search':
        content = this.generateSearchContent(analysis);
        action = 'search';
        break;
      case 'move':
        content = this.generateMoveContent(analysis);
        action = 'move';
        break;
      case 'investigate':
        content = 'I examine this area carefully for anything unusual.';
        action = 'investigate';
        break;
      case 'rest':
        content = 'We should take a moment to rest and recover.';
        action = 'rest';
        break;
    }

    return {
      content,
      action,
      actionParams: analysis.target ? { target: analysis.target } : undefined,
      thoughts: `Exploration style: ${this.explorationStyle}. ${analysis.undiscoveredSecrets.length} secrets, ${analysis.unexploredConnections.length} unexplored exits.`,
      emotions: {
        curiosity: this.explorationStyle === ExplorationStyle.ADVENTUROUS ? 0.9 : 0.5,
        caution: this.explorationStyle === ExplorationStyle.CAUTIOUS ? 0.8 : 0.3,
      },
    };
  }

  private generateSearchContent(analysis: ExplorationAnalysis): string {
    const location = analysis.currentLocation;
    const locationName = location?.name ?? 'this area';

    const phrases = [
      `I search ${locationName} thoroughly for any secrets or hidden passages.`,
      `Let me examine ${locationName} carefully. There might be something hidden here.`,
      `I look around ${locationName}, checking for anything unusual or valuable.`,
    ];

    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  private generateMoveContent(analysis: ExplorationAnalysis): string {
    if (analysis.unexploredConnections.length === 0) {
      return 'There are no obvious exits to explore.';
    }

    const connection = analysis.unexploredConnections[0];
    const targetLocation = this.knownLocations.get(connection.toLocationId);

    if (targetLocation) {
      return `I suggest we explore ${connection.description ?? targetLocation.name}.`;
    }

    return `I suggest we investigate the ${connection.type} to the north.`;
  }

  /**
   * Generate BRAIN tier decision
   */
  private async generateBrainDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    if (this.config.onThink) {
      try {
        return await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildExplorationContext(context),
          [],
          context.stakes
        );
      } catch {
        // Fall through
      }
    }

    const botResult = this.generateBotDecision(context);
    return {
      ...botResult,
      thoughts: `${botResult.thoughts} Considering the safest and most rewarding path forward.`,
    };
  }

  /**
   * Generate HUMAN tier decision
   */
  private async generateHumanDecision(
    context: AgentDecisionContext
  ): Promise<LLMThinkResult> {
    if (this.config.onThink) {
      try {
        return await this.config.onThink(
          this.id,
          this.role,
          context.situation,
          this.buildExplorationContext(context),
          [],
          context.stakes
        );
      } catch {
        // Fall through
      }
    }

    return {
      content: 'I carefully consider our exploration options, weighing risk against potential reward.',
      action: 'think',
      thoughts: 'This exploration requires careful consideration of all factors.',
      emotions: {
        thoughtfulness: 0.9,
      },
    };
  }

  /**
   * Build exploration context string
   */
  private buildExplorationContext(context: AgentDecisionContext): string {
    const parts: string[] = [
      `Exploration Style: ${this.explorationStyle}`,
      `Risk Tolerance: ${this.riskTolerance.toFixed(2)}`,
      `Locations Known: ${this.knownLocations.size}`,
      `Secrets Found: ${this.discoveredSecrets.size}`,
    ];

    const current = this.getCurrentLocation();
    if (current) {
      parts.push(`\nCurrent Location: ${current.name}`);
      parts.push(`  Type: ${current.type}`);
      parts.push(`  Connections: ${current.connections.length}`);
      parts.push(`  Secrets: ${current.secrets.filter(s => !this.discoveredSecrets.has(s.id)).length} remaining`);
    }

    return parts.join('\n');
  }

  /**
   * Generate potential discoveries
   */
  private generatePotentialDiscoveries(
    location: Location | undefined,
    secrets: Secret[]
  ): DiscoveryResult[] {
    const discoveries: DiscoveryResult[] = [];

    for (const secret of secrets) {
      discoveries.push({
        type: 'secret',
        discovered: secret.id,
        method: secret.discoveryMethod,
        dc: secret.dc,
      });
    }

    // Chance for random item discovery based on location type
    if (location && Math.random() < 0.3) {
      discoveries.push({
        type: 'item',
        discovered: 'random_item',
        method: DM.PERCEPTION,
        value: this.rollLootValue(location.type),
      });
    }

    return discoveries;
  }

  /**
   * Recommend action based on situation
   */
  private recommendAction(
    secretCount: number,
    connectionCount: number
  ): 'search' | 'move' | 'rest' | 'investigate' {
    // Style-based preferences
    switch (this.explorationStyle) {
      case ExplorationStyle.THOROUGH:
        return secretCount > 0 ? 'search' : 'investigate';
      case ExplorationStyle.EFFICIENT:
        return connectionCount > 0 ? 'move' : 'search';
      case ExplorationStyle.CAUTIOUS:
        return 'investigate';
      case ExplorationStyle.ADVENTUROUS:
        return connectionCount > 0 ? 'move' : 'search';
      case ExplorationStyle.TREASURE_HUNTER:
        return secretCount > 0 ? 'search' : 'move';
      case ExplorationStyle.MAPPER:
        return connectionCount > 0 ? 'move' : 'rest';
      default:
        return 'search';
    }
  }

  /**
   * Select target for action
   */
  private selectTarget(
    action: string,
    connections: LocationConnection[]
  ): string | undefined {
    if (action === 'move' && connections.length > 0) {
      return connections[0].toLocationId;
    }
    return undefined;
  }

  /**
   * Roll on loot table
   */
  private rollLootTable(entries: LootTableEntry[]): LootTableEntry | null {
    const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry;
      }
    }

    return entries[0] ?? null;
  }

  /**
   * Roll quantity
   */
  private rollQuantity(range: { min: number; max: number }): number {
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  /**
   * Create loot item from entry
   */
  private createLootItem(entry: LootTableEntry, quantity: number): LootItem {
    return {
      id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: entry.item,
      type: this.determineItemType(entry.item),
      rarity: entry.rarity ?? IR.COMMON,
      quantity,
      value: this.estimateItemValue(entry),
    };
  }

  /**
   * Determine item type from name
   */
  private determineItemType(name: string): IT {
    const lower = name.toLowerCase();

    if (/sword|axe|bow|dagger|weapon/.test(lower)) return IT.WEAPON;
    if (/armor|shield|helmet|mail/.test(lower)) return IT.ARMOR;
    if (/potion/.test(lower)) return IT.POTION;
    if (/scroll/.test(lower)) return IT.SCROLL;
    if (/ring/.test(lower)) return IT.RING;
    if (/wand/.test(lower)) return IT.WAND;
    if (/gold|silver|copper|gem|jewel/.test(lower)) return IT.TREASURE;

    return IT.GEAR;
  }

  /**
   * Estimate item value
   */
  private estimateItemValue(entry: LootTableEntry): number {
    // Base value by rarity
    const rarityValues: Record<IR, number> = {
      [IR.COMMON]: 10,
      [IR.UNCOMMON]: 100,
      [IR.RARE]: 500,
      [IR.VERY_RARE]: 2000,
      [IR.LEGENDARY]: 10000,
      [IR.ARTIFACT]: 50000,
    };

    const baseValue = rarityValues[entry.rarity ?? IR.COMMON];
    return baseValue * (entry.quantity.min + entry.quantity.max) / 2;
  }

  /**
   * Generate currency
   */
  private generateCurrency(level: number, locationType: LoT): Currency {
    const multiplier = level * (locationType === LoT.DUNGEON ? 2 : 1);

    return {
      cp: Math.floor(Math.random() * 100 * multiplier),
      sp: Math.floor(Math.random() * 50 * multiplier),
      ep: Math.floor(Math.random() * 20 * multiplier),
      gp: Math.floor(Math.random() * 10 * multiplier),
      pp: Math.floor(Math.random() * 3 * multiplier),
    };
  }

  /**
   * Roll loot value for location type
   */
  private rollLootValue(locationType: LoT): number {
    const baseValues: Record<LoT, number> = {
      [LoT.TOWN]: 10,
      [LoT.DUNGEON]: 100,
      [LoT.WILDERNESS]: 20,
      [LoT.BUILDING]: 30,
      [LoT.ROOM]: 5,
      [LoT.CORRIDOR]: 15,
      [LoT.CAVE]: 50,
      [LoT.FOREST]: 15,
      [LoT.RUINS]: 75,
      [LoT.TEMPLE]: 100,
      [LoT.TAVERN]: 5,
      [LoT.SHOP]: 0, // Items have individual prices
    };

    return (baseValues[locationType] ?? 10) * (0.5 + Math.random());
  }

  /**
   * Estimate secret value
   */
  private estimateSecretValue(secret: Secret): number {
    return (secret.dc ?? 15) * 10;
  }

  /**
   * Generate encounter description
   */
  private generateEncounterDescription(
    type: string,
    difficulty: number
  ): string {
    const descriptions: Record<string, string[]> = {
      combat: [
        'You hear hostile voices approaching.',
        'A creature emerges from the shadows, intent on violence.',
        'Enemies block your path forward.',
      ],
      social: [
        'You encounter other travelers on the road.',
        'A merchant approaches with an interesting offer.',
        'You spot a campfire in the distance with figures gathered around.',
      ],
      environmental: [
        'The weather suddenly takes a turn for the worse.',
        'You notice a dangerous environmental hazard ahead.',
        'The terrain becomes treacherous.',
      ],
      discovery: [
        'You stumble upon something interesting.',
        'Your keen senses pick up on something unusual.',
        'A discovery awaits investigation.',
      ],
    };

    const options = descriptions[type] ?? descriptions.discovery;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Create quest for location
   */
  private createQuestForLocation(location: Location, questId: string): Quest {
    const objectives: QuestObjective[] = [
      {
        id: `${questId}_obj_1`,
        description: `Explore ${location.name}`,
        type: OT.EXPLORE,
        target: location.id,
        required: 1,
        current: 0,
        completed: false,
        optional: false,
      },
    ];

    // Add location-specific objectives
    if (location.secrets.length > 0) {
      objectives.push({
        id: `${questId}_obj_2`,
        description: 'Discover all secrets in this area',
        type: OT.DISCOVER,
        required: location.secrets.length,
        current: 0,
        completed: false,
        optional: true,
      });
    }

    return {
      id: questId,
      name: `Exploration: ${location.name}`,
      description: `Fully explore and investigate ${location.name}.`,
      giverId: this.id,
      objectives,
      rewards: [
        { type: RT.XP, amount: 50 * (location.secrets.length + 1), xp: 50 },
        { type: RT.GOLD, amount: 10 * (location.secrets.length + 1) },
      ],
      status: 'not_started' as any,
      currentStage: 0,
      mainQuest: false,
      startedAt: Date.now(),
    };
  }

  /**
   * Get default loot tables
   */
  private getDefaultLootTables(): Map<string, LootTable> {
    const tables = new Map<string, LootTable>();

    // Common individual loot
    tables.set('common', {
      id: 'common',
      name: 'Common Loot',
      type: 'individual',
      rollCount: 1,
      entries: [
        { item: 'Copper pieces', weight: 50, quantity: { min: 10, max: 100 } },
        { item: 'Simple weapon', weight: 20, quantity: { min: 1, max: 1 }, rarity: IR.COMMON },
        { item: 'Potion of healing', weight: 10, quantity: { min: 1, max: 1 }, rarity: IR.COMMON },
        { item: 'Trinket', weight: 30, quantity: { min: 1, max: 2 }, rarity: IR.COMMON },
      ],
    });

    // Dungeon low-level loot
    tables.set('dungeon_low', {
      id: 'dungeon_low',
      name: 'Dungeon Loot (Low Level)',
      type: 'hoard',
      rollCount: 2,
      entries: [
        { item: 'Gold pieces', weight: 60, quantity: { min: 10, max: 50 } },
        { item: 'Silver pieces', weight: 40, quantity: { min: 50, max: 200 } },
        { item: 'Weapon', weight: 15, quantity: { min: 1, max: 1 }, rarity: IR.COMMON },
        { item: 'Armor', weight: 10, quantity: { min: 1, max: 1 }, rarity: IR.COMMON },
        { item: 'Potion of healing', weight: 20, quantity: { min: 1, max: 2 }, rarity: IR.UNCOMMON },
        { item: 'Scroll', weight: 15, quantity: { min: 1, max: 1 }, rarity: IR.UNCOMMON },
      ],
    });

    // Dungeon high-level loot
    tables.set('dungeon_high', {
      id: 'dungeon_high',
      name: 'Dungeon Loot (High Level)',
      type: 'hoard',
      rollCount: 3,
      entries: [
        { item: 'Gold pieces', weight: 50, quantity: { min: 100, max: 500 } },
        { item: 'Platinum pieces', weight: 30, quantity: { min: 5, max: 20 } },
        { item: 'Magic weapon', weight: 15, quantity: { min: 1, max: 1 }, rarity: IR.RARE },
        { item: 'Magic armor', weight: 10, quantity: { min: 1, max: 1 }, rarity: IR.RARE },
        { item: 'Potion', weight: 25, quantity: { min: 1, max: 3 }, rarity: IR.UNCOMMON },
        { item: 'Ring', weight: 10, quantity: { min: 1, max: 1 }, rarity: IR.RARE },
        { item: 'Scroll', weight: 20, quantity: { min: 1, max: 2 }, rarity: IR.RARE },
      ],
    });

    return tables;
  }

  /**
   * Estimate cost
   */
  private estimateCost(source: DecisionSource): number {
    switch (source) {
      case DS.BOT:
        return 0;
      case DS.BRAIN:
        return 0.001;
      case DS.HUMAN:
        return 0.02;
      default:
        return 0;
    }
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    this.bus.subscribe(
      this.id,
      'action_request' as any,
      this.handleActionRequest.bind(this)
    );
  }

  /**
   * Handle action request
   */
  private async handleActionRequest(message: AgentMessage): Promise<void> {
    const { context } = message.payload as {
      context: AgentDecisionContext;
    };

    try {
      const decision = await this.decide(context);
      await this.bus.respond(message, {
        success: true,
        decision,
      });
    } catch (error) {
      await this.bus.respond(message, {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * Create an exploration agent
 */
export function createExplorationAgent(config: ExplorationAgentConfig): ExplorationAgent {
  const agent = new ExplorationAgent({
    ...config,
    role: DAR.EXPLORATION,
    biologicalType: BA.FLEET,
  });

  getAgentRegistry().register(agent, config);

  return agent;
}
