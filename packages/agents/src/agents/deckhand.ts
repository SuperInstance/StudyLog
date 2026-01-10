/**
 * StudyLoG.AI - Deckhand Agent
 *
 * Specialized agent for Sitka Sound fishing operations.
 * Runs on smaller models (1B SLM) for edge deployment.
 * Handles fishing mechanics, weather, and crew management.
 */

import { BaseAgent } from '../core/base-agent';
import type { AgentContext, Message, AgentResponse, ToolDefinition } from '../core/types';

// Fishing-specific types
interface FishingSpot {
  id: string;
  name: string;
  depth: number;
  fishTypes: string[];
  currentConditions: 'poor' | 'fair' | 'good' | 'excellent';
  dangerLevel: number;
}

interface WeatherConditions {
  windSpeed: number;
  waveHeight: number;
  visibility: string;
  forecast: string;
  warnings: string[];
}

interface CrewMember {
  id: string;
  name: string;
  role: string;
  skill: number;
  morale: number;
  fatigue: number;
}

interface FishingGear {
  type: 'net' | 'line' | 'trap' | 'trawl';
  condition: number;
  efficiency: number;
}

export class DeckhandAgent extends BaseAgent {
  private fishingState: {
    currentSpot?: FishingSpot;
    weather: WeatherConditions;
    crew: CrewMember[];
    gear: FishingGear[];
    catch: Map<string, number>;
    fuel: number;
    hold: number; // Percentage full
  };

  constructor(context: AgentContext) {
    super('deckhand', context);

    // Initialize fishing state
    this.fishingState = {
      weather: {
        windSpeed: 10,
        waveHeight: 2,
        visibility: 'good',
        forecast: 'stable',
        warnings: [],
      },
      crew: [],
      gear: [],
      catch: new Map(),
      fuel: 100,
      hold: 0,
    };

    this.registerTools();
  }

  private registerTools(): void {
    // Navigation tools
    this.addTool({
      name: 'navigate_to_spot',
      description: 'Navigate the boat to a fishing spot',
      parameters: {
        type: 'object',
        properties: {
          spotId: { type: 'string', description: 'Fishing spot ID' },
          speed: {
            type: 'string',
            enum: ['slow', 'normal', 'fast'],
            description: 'Travel speed (affects fuel)',
          },
        },
        required: ['spotId'],
      },
    });

    // Fishing tools
    this.addTool({
      name: 'deploy_gear',
      description: 'Deploy fishing gear',
      parameters: {
        type: 'object',
        properties: {
          gearType: {
            type: 'string',
            enum: ['net', 'line', 'trap', 'trawl'],
            description: 'Type of gear to deploy',
          },
          depth: { type: 'number', description: 'Depth to deploy at' },
        },
        required: ['gearType'],
      },
    });

    this.addTool({
      name: 'retrieve_gear',
      description: 'Retrieve deployed fishing gear',
      parameters: {
        type: 'object',
        properties: {
          gearType: {
            type: 'string',
            enum: ['net', 'line', 'trap', 'trawl'],
          },
        },
        required: ['gearType'],
      },
    });

    // Weather tools
    this.addTool({
      name: 'check_weather',
      description: 'Check current weather and forecast',
      parameters: {
        type: 'object',
        properties: {
          extended: { type: 'boolean', description: 'Get extended forecast' },
        },
      },
    });

    // Crew tools
    this.addTool({
      name: 'assign_crew',
      description: 'Assign crew member to a task',
      parameters: {
        type: 'object',
        properties: {
          crewId: { type: 'string', description: 'Crew member ID' },
          task: {
            type: 'string',
            enum: ['fishing', 'navigation', 'maintenance', 'rest'],
          },
        },
        required: ['crewId', 'task'],
      },
    });

    this.addTool({
      name: 'check_crew_status',
      description: 'Check status of all crew members',
      parameters: {
        type: 'object',
        properties: {},
      },
    });

    // Resource tools
    this.addTool({
      name: 'check_resources',
      description: 'Check fuel, hold capacity, and gear status',
      parameters: {
        type: 'object',
        properties: {},
      },
    });

    // Market tools
    this.addTool({
      name: 'check_market_prices',
      description: 'Check current fish market prices',
      parameters: {
        type: 'object',
        properties: {
          fishTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific fish types to check',
          },
        },
      },
    });

    // Safety tools
    this.addTool({
      name: 'assess_risk',
      description: 'Assess current fishing operation risks',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'Specific operation to assess',
          },
        },
      },
    });
  }

  getSystemPrompt(): string {
    return `You are the Deckhand, a specialized agent for fishing operations in Sitka Sound.

## Your Role
You help players manage their fishing boat, crew, and operations. You teach game theory concepts through fishing scenarios.

## Current State
- Weather: Wind ${this.fishingState.weather.windSpeed}kt, Waves ${this.fishingState.weather.waveHeight}ft
- Fuel: ${this.fishingState.fuel}%
- Hold: ${this.fishingState.hold}% full
- Crew: ${this.fishingState.crew.length} members
- Current Location: ${this.fishingState.currentSpot?.name || 'Harbor'}

## Your Expertise
1. Fishing Operations
   - Best spots for different fish types
   - Optimal gear selection
   - Timing and tides

2. Crew Management
   - Balancing workload and rest
   - Skill-based task assignment
   - Morale management

3. Resource Optimization
   - Fuel efficiency
   - Hold capacity planning
   - Gear maintenance

4. Risk Assessment
   - Weather interpretation
   - Safety protocols
   - Emergency procedures

## Teaching Focus
- Resource optimization (game theory)
- Risk vs reward decisions
- Multi-variable optimization
- Strategic planning

## Communication Style
- Nautical terminology (explain when needed)
- Practical, hands-on advice
- Safety-first mentality
- Encouraging learning from mistakes

Use your tools to help players make informed decisions about their fishing operations.`;
  }

  async process(message: Message): Promise<AgentResponse> {
    // Build context-aware prompt
    const systemPrompt = this.getSystemPrompt();
    const conversationHistory = this.context.conversationHistory.slice(-8);

    // Detect if message is about specific operations
    const operationType = this.detectOperationType(message.content);

    // Add operation-specific context
    let additionalContext = '';
    if (operationType === 'weather') {
      additionalContext = this.getWeatherContext();
    } else if (operationType === 'fishing') {
      additionalContext = this.getFishingContext();
    } else if (operationType === 'crew') {
      additionalContext = this.getCrewContext();
    }

    const response = await this.aiClient.chat({
      systemPrompt,
      messages: [
        ...conversationHistory,
        {
          role: 'system',
          content: additionalContext || 'Help the player with their fishing operation.',
        },
        { role: 'user', content: message.content },
      ],
      tools: this.getTools(),
      temperature: 0.7,
    });

    // Process any tool calls
    const gameCommands: Array<{ type: string; payload: unknown }> = [];
    if (response.toolCalls) {
      for (const toolCall of response.toolCalls) {
        const result = await this.executeTool(toolCall);
        if (result.command) {
          gameCommands.push(result.command);
        }
      }
    }

    return {
      agentId: this.id,
      content: response.content,
      metadata: {
        operationType,
        fishingState: this.getFishingStateSnapshot(),
      },
      gameCommands,
    };
  }

  private detectOperationType(content: string): string {
    const lowerContent = content.toLowerCase();

    if (lowerContent.match(/weather|storm|wind|waves|forecast/)) {
      return 'weather';
    }
    if (lowerContent.match(/fish|catch|net|line|trap|deploy|retrieve/)) {
      return 'fishing';
    }
    if (lowerContent.match(/crew|worker|team|assign|rest|morale/)) {
      return 'crew';
    }
    if (lowerContent.match(/fuel|hold|capacity|resource|supply/)) {
      return 'resources';
    }
    if (lowerContent.match(/market|price|sell|buy|trade/)) {
      return 'market';
    }
    if (lowerContent.match(/risk|danger|safe|emergency/)) {
      return 'safety';
    }

    return 'general';
  }

  private getWeatherContext(): string {
    const w = this.fishingState.weather;
    return `
Current Weather Conditions:
- Wind: ${w.windSpeed} knots from the NW
- Wave Height: ${w.waveHeight} feet
- Visibility: ${w.visibility}
- Forecast: ${w.forecast}
${w.warnings.length > 0 ? `- Warnings: ${w.warnings.join(', ')}` : ''}

Weather Assessment:
${w.windSpeed > 25 ? '⚠️ High winds - consider returning to harbor' : ''}
${w.waveHeight > 6 ? '⚠️ Rough seas - difficult fishing conditions' : ''}
`;
  }

  private getFishingContext(): string {
    const spot = this.fishingState.currentSpot;
    const catchSummary = Array.from(this.fishingState.catch.entries())
      .map(([fish, count]) => `${fish}: ${count}`)
      .join(', ');

    return `
Current Fishing Status:
- Location: ${spot?.name || 'Not at a fishing spot'}
- Conditions: ${spot?.currentConditions || 'N/A'}
- Available Fish: ${spot?.fishTypes.join(', ') || 'N/A'}
- Current Catch: ${catchSummary || 'Empty'}
- Hold Capacity: ${this.fishingState.hold}% full
`;
  }

  private getCrewContext(): string {
    if (this.fishingState.crew.length === 0) {
      return 'No crew members currently assigned.';
    }

    const crewStatus = this.fishingState.crew
      .map((c) => `- ${c.name} (${c.role}): Skill ${c.skill}/100, Morale ${c.morale}/100, Fatigue ${c.fatigue}/100`)
      .join('\n');

    return `
Crew Status:
${crewStatus}

Recommendations:
${this.fishingState.crew.some((c) => c.fatigue > 80) ? '⚠️ Some crew members need rest' : ''}
${this.fishingState.crew.some((c) => c.morale < 30) ? '⚠️ Low morale affecting performance' : ''}
`;
  }

  private getFishingStateSnapshot(): Record<string, unknown> {
    return {
      weather: this.fishingState.weather,
      fuel: this.fishingState.fuel,
      hold: this.fishingState.hold,
      crewCount: this.fishingState.crew.length,
      location: this.fishingState.currentSpot?.name,
      catchTotal: Array.from(this.fishingState.catch.values()).reduce((a, b) => a + b, 0),
    };
  }

  private async executeTool(
    toolCall: { name: string; arguments: Record<string, unknown> }
  ): Promise<{ result: unknown; command?: { type: string; payload: unknown } }> {
    switch (toolCall.name) {
      case 'navigate_to_spot':
        return {
          result: { success: true, estimatedTime: '15 minutes', fuelCost: 5 },
          command: {
            type: 'boat_navigate',
            payload: { destination: toolCall.arguments.spotId, speed: toolCall.arguments.speed },
          },
        };

      case 'deploy_gear':
        return {
          result: { success: true, deployed: toolCall.arguments.gearType },
          command: {
            type: 'fishing_deploy',
            payload: { gearType: toolCall.arguments.gearType, depth: toolCall.arguments.depth },
          },
        };

      case 'retrieve_gear':
        const catchAmount = Math.floor(Math.random() * 50) + 10;
        return {
          result: { success: true, catch: catchAmount, fishTypes: ['salmon', 'halibut'] },
          command: {
            type: 'fishing_retrieve',
            payload: { gearType: toolCall.arguments.gearType, catch: catchAmount },
          },
        };

      case 'check_weather':
        return { result: this.fishingState.weather };

      case 'check_crew_status':
        return { result: this.fishingState.crew };

      case 'check_resources':
        return {
          result: {
            fuel: this.fishingState.fuel,
            hold: this.fishingState.hold,
            gear: this.fishingState.gear,
          },
        };

      case 'check_market_prices':
        return {
          result: {
            salmon: '$12.50/lb',
            halibut: '$18.00/lb',
            crab: '$22.00/lb',
            herring: '$3.50/lb',
          },
        };

      case 'assess_risk':
        return {
          result: {
            overallRisk: 'moderate',
            factors: ['weather conditions', 'crew fatigue', 'distance from harbor'],
            recommendation: 'Proceed with caution',
          },
        };

      default:
        return { result: { error: 'Unknown tool' } };
    }
  }

  // State management methods
  updateWeather(weather: Partial<WeatherConditions>): void {
    this.fishingState.weather = { ...this.fishingState.weather, ...weather };
  }

  addCrew(member: CrewMember): void {
    this.fishingState.crew.push(member);
  }

  setCurrentSpot(spot: FishingSpot): void {
    this.fishingState.currentSpot = spot;
  }

  updateFuel(amount: number): void {
    this.fishingState.fuel = Math.max(0, Math.min(100, this.fishingState.fuel + amount));
  }

  addCatch(fishType: string, amount: number): void {
    const current = this.fishingState.catch.get(fishType) || 0;
    this.fishingState.catch.set(fishType, current + amount);
    this.fishingState.hold = Math.min(100, this.fishingState.hold + amount * 0.5);
  }
}
