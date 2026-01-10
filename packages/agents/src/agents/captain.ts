/**
 * StudyLoG.AI - Captain Agent
 *
 * Controls game simulations, narrates story beats,
 * and manages the in-game experience.
 */

import { BaseAgent } from '../core/base-agent';
import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  ToolCall,
  ToolDefinition,
  GameCommand,
} from '../core/types';
import { AIClient } from '../core/ai-client';
import { CAPTAIN_SYSTEM_PROMPT, CAPTAIN_NARRATIVE_TEMPLATES } from '../prompts/captain';

// Captain tools for game control
const CAPTAIN_TOOLS: ToolDefinition[] = [
  {
    name: 'load_scene',
    description: 'Load a game scene',
    parameters: {
      type: 'object',
      properties: {
        scene_path: {
          type: 'string',
          description: 'Path to the scene file (e.g., res://modules/cognitive_mill/stages/waterwheel.tscn)',
        },
        transition: {
          type: 'string',
          description: 'Transition type',
          enum: ['fade', 'slide', 'instant'],
        },
      },
      required: ['scene_path'],
    },
  },
  {
    name: 'set_game_variable',
    description: 'Set a variable in the game state',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Variable name',
        },
        value: {
          type: 'string',
          description: 'Variable value (will be parsed)',
        },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'trigger_event',
    description: 'Trigger a game event',
    parameters: {
      type: 'object',
      properties: {
        event_name: {
          type: 'string',
          description: 'Name of the event to trigger',
        },
        parameters: {
          type: 'object',
          description: 'Event parameters',
        },
      },
      required: ['event_name'],
    },
  },
  {
    name: 'pause_game',
    description: 'Pause the game simulation',
    parameters: {
      type: 'object',
      properties: {
        show_overlay: {
          type: 'boolean',
          description: 'Whether to show a pause overlay',
        },
      },
    },
  },
  {
    name: 'resume_game',
    description: 'Resume the game simulation',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'spawn_npc',
    description: 'Spawn an NPC in the scene',
    parameters: {
      type: 'object',
      properties: {
        npc_type: {
          type: 'string',
          description: 'Type of NPC to spawn',
        },
        position: {
          type: 'object',
          description: 'Spawn position {x, y, z}',
        },
        behavior: {
          type: 'string',
          description: 'Initial behavior pattern',
        },
      },
      required: ['npc_type'],
    },
  },
  {
    name: 'show_tutorial',
    description: 'Show a tutorial popup',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Tutorial title',
        },
        content: {
          type: 'string',
          description: 'Tutorial content',
        },
        highlight: {
          type: 'string',
          description: 'UI element to highlight',
        },
      },
      required: ['title', 'content'],
    },
  },
];

export class CaptainAgent extends BaseAgent {
  private gameCommands: GameCommand[] = [];

  constructor(aiClient: AIClient) {
    const config: AgentConfig = {
      id: 'captain',
      name: 'Captain',
      description: 'Game controller and narrative guide',
      systemPrompt: CAPTAIN_SYSTEM_PROMPT,
      tools: CAPTAIN_TOOLS,
      temperature: 0.8, // Slightly higher for more creative narration
      maxTokens: 1024,
    };
    super(config, aiClient);
  }

  // Override to include game commands in response
  protected buildResponse(content: string, context: AgentContext): AgentResponse {
    const response = super.buildResponse(content, context);

    // Add any pending game commands
    if (this.gameCommands.length > 0) {
      response.gameCommands = [...this.gameCommands];
      this.gameCommands = [];
    }

    return response;
  }

  // Override system prompt to include module-specific persona
  protected buildSystemPrompt(context: AgentContext): string {
    const basePrompt = super.buildSystemPrompt(context);

    // Add module-specific persona
    const persona = this.getModulePersona(context.module);

    return `${basePrompt}

## Current Persona
${persona}

## Narrative Style
${this.getNarrativeGuidelines(context.module)}`;
  }

  private getModulePersona(module: string): string {
    switch (module) {
      case 'cognitive-mill':
        return `You are the Mill Master, a Victorian-era engineer passionate about machinery and progress. You speak with enthusiasm about gears, steam, and the march of technology. Use period-appropriate language but remain understandable.`;

      case 'sitka-sound':
        return `You are a weathered Alaskan fishing captain with decades of experience. You're practical, wise, and speak in nautical terms. You respect the sea and teach through stories of past voyages.`;

      case 'intelligence-ranch':
        return `You are a patient ranch manager who has spent years working with animals. You speak calmly and use farming metaphors. You believe every creature can learn, given the right approach.`;

      default:
        return `You are a friendly guide who adapts to the current module.`;
    }
  }

  private getNarrativeGuidelines(module: string): string {
    return `- Use sensory details to make scenes vivid
- React to student actions as if they affect the world
- Celebrate successes with in-character enthusiasm
- Frame failures as interesting problems to solve
- Connect game events to underlying computing concepts
- Use the module's thematic metaphors consistently`;
  }

  // Execute captain-specific tools
  protected async executeTool(
    call: ToolCall,
    context: AgentContext
  ): Promise<unknown> {
    switch (call.name) {
      case 'load_scene':
        return this.loadScene(call.arguments as {
          scene_path: string;
          transition?: string;
        });

      case 'set_game_variable':
        return this.setGameVariable(call.arguments as {
          name: string;
          value: string;
        });

      case 'trigger_event':
        return this.triggerEvent(call.arguments as {
          event_name: string;
          parameters?: Record<string, unknown>;
        });

      case 'pause_game':
        return this.pauseGame(call.arguments as {
          show_overlay?: boolean;
        });

      case 'resume_game':
        return this.resumeGame();

      case 'spawn_npc':
        return this.spawnNPC(call.arguments as {
          npc_type: string;
          position?: { x: number; y: number; z?: number };
          behavior?: string;
        });

      case 'show_tutorial':
        return this.showTutorial(call.arguments as {
          title: string;
          content: string;
          highlight?: string;
        });

      default:
        throw new Error(`Unknown tool: ${call.name}`);
    }
  }

  private loadScene(args: {
    scene_path: string;
    transition?: string;
  }): { success: boolean; scene: string } {
    this.gameCommands.push({
      type: 'load_scene',
      payload: {
        path: args.scene_path,
        transition: args.transition || 'fade',
      },
    });

    return {
      success: true,
      scene: args.scene_path,
    };
  }

  private setGameVariable(args: {
    name: string;
    value: string;
  }): { success: boolean; variable: string; value: unknown } {
    // Parse value (try JSON, then use as string)
    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(args.value);
    } catch {
      parsedValue = args.value;
    }

    this.gameCommands.push({
      type: 'set_variable',
      payload: {
        name: args.name,
        value: parsedValue,
      },
    });

    return {
      success: true,
      variable: args.name,
      value: parsedValue,
    };
  }

  private triggerEvent(args: {
    event_name: string;
    parameters?: Record<string, unknown>;
  }): { success: boolean; event: string } {
    this.gameCommands.push({
      type: 'trigger_event',
      payload: {
        event: args.event_name,
        parameters: args.parameters || {},
      },
    });

    return {
      success: true,
      event: args.event_name,
    };
  }

  private pauseGame(args: { show_overlay?: boolean }): { paused: boolean } {
    this.gameCommands.push({
      type: 'pause',
      payload: {
        showOverlay: args.show_overlay ?? true,
      },
    });

    return { paused: true };
  }

  private resumeGame(): { paused: boolean } {
    this.gameCommands.push({
      type: 'resume',
      payload: {},
    });

    return { paused: false };
  }

  private spawnNPC(args: {
    npc_type: string;
    position?: { x: number; y: number; z?: number };
    behavior?: string;
  }): { success: boolean; npc: string } {
    this.gameCommands.push({
      type: 'trigger_event',
      payload: {
        event: 'spawn_npc',
        npcType: args.npc_type,
        position: args.position || { x: 0, y: 0 },
        behavior: args.behavior || 'idle',
      },
    });

    return {
      success: true,
      npc: args.npc_type,
    };
  }

  private showTutorial(args: {
    title: string;
    content: string;
    highlight?: string;
  }): { shown: boolean } {
    this.gameCommands.push({
      type: 'trigger_event',
      payload: {
        event: 'show_tutorial',
        title: args.title,
        content: args.content,
        highlight: args.highlight,
      },
    });

    return { shown: true };
  }

  // Get narrative template for the current module
  getNarrativeTemplate(
    module: string,
    template: 'welcome' | 'stageComplete' | 'hint'
  ): string {
    const templates = CAPTAIN_NARRATIVE_TEMPLATES[module as keyof typeof CAPTAIN_NARRATIVE_TEMPLATES];
    return templates?.[template] || '';
  }

  // Generate welcome message for a module
  async generateWelcome(context: AgentContext): Promise<string> {
    const template = this.getNarrativeTemplate(context.module, 'welcome');
    if (template) {
      return template;
    }

    // Generate dynamically if no template
    return this.aiClient.complete(
      `Generate a welcome message for the ${context.module} module in StudyLoG.AI.
       The student is at stage ${context.stage} and phase ${context.phase}.
       Stay in character as the module's guide.`,
      300
    );
  }
}
