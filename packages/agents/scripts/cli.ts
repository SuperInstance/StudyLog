#!/usr/bin/env npx tsx
/**
 * StudyLoG.AI - Agent CLI
 *
 * Interactive CLI for testing agents.
 *
 * Usage: npx tsx scripts/cli.ts
 */

import * as readline from 'readline';
import { AgentOrchestrator } from '../src/core/orchestrator';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function color(text: string, ...codes: string[]): string {
  return codes.join('') + text + COLORS.reset;
}

function printBanner(): void {
  console.log(color('\n╔════════════════════════════════════════╗', COLORS.blue));
  console.log(color('║      StudyLoG.AI Agent CLI             ║', COLORS.blue));
  console.log(color('╚════════════════════════════════════════╝', COLORS.blue));
  console.log();
}

function printHelp(): void {
  console.log(color('Commands:', COLORS.bright));
  console.log('  /module <name>  - Switch module (cognitive-mill, sitka-sound, intelligence-ranch)');
  console.log('  /stage          - Advance to next stage');
  console.log('  /phase <name>   - Set phase (player, reader, tweaker, creator, mentor)');
  console.log('  /status         - Show current status');
  console.log('  /history        - Show conversation history');
  console.log('  /clear          - Clear conversation history');
  console.log('  /help           - Show this help');
  console.log('  /quit           - Exit');
  console.log();
  console.log(color('Or just type a message to chat with the agents.', COLORS.dim));
  console.log();
}

function printStatus(orchestrator: AgentOrchestrator): void {
  const ctx = orchestrator.getContext();
  console.log(color('\nCurrent Status:', COLORS.bright));
  console.log(`  Module: ${color(ctx.module, COLORS.cyan)}`);
  console.log(`  Stage:  ${color(String(ctx.stage), COLORS.yellow)}`);
  console.log(`  Phase:  ${color(ctx.phase, COLORS.green)}`);

  const agents = orchestrator.getAllAgents();
  console.log(`  Agents: ${color(String(agents.size), COLORS.magenta)} active`);
  for (const [id, agent] of agents) {
    console.log(`    - ${id}: ${agent.getStatus()}`);
  }
  console.log();
}

function printHistory(orchestrator: AgentOrchestrator): void {
  const history = orchestrator.getHistory();
  if (history.length === 0) {
    console.log(color('\nNo conversation history.\n', COLORS.dim));
    return;
  }

  console.log(color('\nConversation History:', COLORS.bright));
  for (const msg of history) {
    const prefix = msg.role === 'user' ? color('You:', COLORS.green) : color(`${msg.agentId || 'Agent'}:`, COLORS.cyan);
    console.log(`${prefix} ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
  }
  console.log();
}

async function main(): Promise<void> {
  printBanner();

  console.log(color('Initializing agents...', COLORS.dim));

  const orchestrator = new AgentOrchestrator({
    preferLocalAI: true, // Try local Ollama first
    initialModule: 'cognitive-mill',
  });

  // Check AI availability
  const aiAvailable = await orchestrator.isAIAvailable();
  if (aiAvailable) {
    console.log(color('✓ AI backend connected', COLORS.green));
  } else {
    console.log(color('⚠ AI backend not available, responses will be limited', COLORS.yellow));
  }

  printHelp();
  printStatus(orchestrator);

  // Set up event listener
  orchestrator.on((event) => {
    if (event.type === 'delegation') {
      const e = event as any;
      console.log(color(`\n[Delegating to ${e.to}...]`, COLORS.dim));
    }
  });

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question(color('You: ', COLORS.green), async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith('/')) {
        const [cmd, ...args] = trimmed.slice(1).split(' ');

        switch (cmd.toLowerCase()) {
          case 'quit':
          case 'exit':
          case 'q':
            console.log(color('\nGoodbye!\n', COLORS.dim));
            rl.close();
            process.exit(0);
            break;

          case 'help':
          case 'h':
            printHelp();
            break;

          case 'status':
          case 's':
            printStatus(orchestrator);
            break;

          case 'history':
            printHistory(orchestrator);
            break;

          case 'clear':
            orchestrator.clearHistory();
            console.log(color('\nHistory cleared.\n', COLORS.dim));
            break;

          case 'module':
          case 'm':
            const module = args[0];
            if (['cognitive-mill', 'sitka-sound', 'intelligence-ranch'].includes(module)) {
              orchestrator.setModule(module as any);
              console.log(color(`\nSwitched to ${module}\n`, COLORS.cyan));
            } else {
              console.log(color('\nInvalid module. Use: cognitive-mill, sitka-sound, intelligence-ranch\n', COLORS.yellow));
            }
            break;

          case 'stage':
            const newStage = orchestrator.advanceStage();
            console.log(color(`\nAdvanced to stage ${newStage}\n`, COLORS.cyan));
            break;

          case 'phase':
          case 'p':
            const phase = args[0];
            if (['player', 'reader', 'tweaker', 'creator', 'mentor'].includes(phase)) {
              orchestrator.setPhase(phase as any);
              console.log(color(`\nPhase set to ${phase}\n`, COLORS.cyan));
            } else {
              console.log(color('\nInvalid phase. Use: player, reader, tweaker, creator, mentor\n', COLORS.yellow));
            }
            break;

          default:
            console.log(color(`\nUnknown command: /${cmd}\n`, COLORS.yellow));
        }

        prompt();
        return;
      }

      // Chat with agents
      try {
        console.log(color('\nThinking...', COLORS.dim));
        const response = await orchestrator.chat(trimmed);

        const agentName = response.agentId.charAt(0).toUpperCase() + response.agentId.slice(1);
        console.log(`\n${color(agentName + ':', COLORS.cyan)} ${response.content}\n`);

        // Show game commands if any
        if (response.gameCommands && response.gameCommands.length > 0) {
          console.log(color('Game Commands:', COLORS.dim));
          for (const cmd of response.gameCommands) {
            console.log(`  ${cmd.type}: ${JSON.stringify(cmd.payload)}`);
          }
          console.log();
        }
      } catch (error) {
        console.log(color(`\nError: ${error}\n`, COLORS.yellow));
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
