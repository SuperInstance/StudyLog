/**
 * Multi-Model Commands
 *
 * Commands for the multi-model chat interface.
 */

import { injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';

export const MultiModelCommands = {
  NEW_CHAT: 'si-multi-model.newChat',
  CLEAR_HISTORY: 'si-multi-model.clearHistory',
  EXPORT_CHAT: 'si-multi-model.exportChat',
  TOGGLE_PROVIDER: 'si-multi-model.toggleProvider',
  SHOW_COSTS: 'si-multi-model.showCosts',
};

@injectable()
export class MultiModelCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(
      {
        id: MultiModelCommands.NEW_CHAT,
        label: 'Multi-Model: New Chat',
      },
      {
        execute: () => {
          console.log('[MultiModel] New chat');
        },
      }
    );

    registry.registerCommand(
      {
        id: MultiModelCommands.CLEAR_HISTORY,
        label: 'Multi-Model: Clear History',
      },
      {
        execute: () => {
          console.log('[MultiModel] Clear history');
        },
      }
    );

    registry.registerCommand(
      {
        id: MultiModelCommands.EXPORT_CHAT,
        label: 'Multi-Model: Export Chat',
      },
      {
        execute: () => {
          console.log('[MultiModel] Export chat');
        },
      }
    );

    registry.registerCommand(
      {
        id: MultiModelCommands.SHOW_COSTS,
        label: 'Multi-Model: Show Cost Breakdown',
      },
      {
        execute: () => {
          console.log('[MultiModel] Show costs');
        },
      }
    );
  }
}
