/**
 * Agent Dashboard Commands
 *
 * Commands for managing agents and progression.
 */

import { injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';

export const AgentCommands = {
  NEW_AGENT: 'si-agent-dashboard.newAgent',
  RESTART_AGENT: 'si-agent-dashboard.restartAgent',
  REMOVE_AGENT: 'si-agent-dashboard.removeAgent',
  SHOW_PROGRESS: 'si-agent-dashboard.showProgress',
  UNLOCK_STAGE: 'si-agent-dashboard.unlockStage',
  SWITCH_MODEL: 'si-agent-dashboard.switchModel',
};

@injectable()
export class AgentCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(
      {
        id: AgentCommands.NEW_AGENT,
        label: 'Agents: New Agent',
      },
      {
        execute: () => {
          console.log('[Agents] New agent');
        },
      }
    );

    registry.registerCommand(
      {
        id: AgentCommands.RESTART_AGENT,
        label: 'Agents: Restart Agent',
      },
      {
        execute: () => {
          console.log('[Agents] Restart agent');
        },
      }
    );

    registry.registerCommand(
      {
        id: AgentCommands.REMOVE_AGENT,
        label: 'Agents: Remove Agent',
      },
      {
        execute: () => {
          console.log('[Agents] Remove agent');
        },
      }
    );

    registry.registerCommand(
      {
        id: AgentCommands.SHOW_PROGRESS,
        label: 'Agents: Show Progress',
      },
      {
        execute: () => {
          console.log('[Agents] Show progress');
        },
      }
    );

    registry.registerCommand(
      {
        id: AgentCommands.UNLOCK_STAGE,
        label: 'Agents: Unlock Stage',
      },
      {
        execute: () => {
          console.log('[Agents] Unlock stage');
        },
      }
    );

    registry.registerCommand(
      {
        id: AgentCommands.SWITCH_MODEL,
        label: 'Agents: Switch Model',
      },
      {
        execute: () => {
          console.log('[Agents] Switch model');
        },
      }
    );
  }
}
