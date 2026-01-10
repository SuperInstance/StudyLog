/**
 * Sitka Sound Commands
 *
 * Commands for the ecological simulation.
 */

import { injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';

export const SitkaCommands = {
  NEXT_DAY: 'si-sitka-sound.nextDay',
  TOGGLE_PAUSE: 'si-sitka-sound.togglePause',
  RESET: 'si-sitka-sound.reset',
  ADD_BOAT: 'si-sitka-sound.addBoat',
  BROADCAST: 'si-sitka-sound.broadcast',
  SHOW_ANALYSIS: 'si-sitka-sound.showAnalysis',
};

@injectable()
export class SitkaCommandContribution implements CommandContribution {
  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(
      {
        id: SitkaCommands.NEXT_DAY,
        label: 'Sitka: Next Day',
      },
      {
        execute: () => {
          console.log('[Sitka] Next day');
        },
      }
    );

    registry.registerCommand(
      {
        id: SitkaCommands.TOGGLE_PAUSE,
        label: 'Sitka: Toggle Pause',
      },
      {
        execute: () => {
          console.log('[Sitka] Toggle pause');
        },
      }
    );

    registry.registerCommand(
      {
        id: SitkaCommands.RESET,
        label: 'Sitka: Reset Simulation',
      },
      {
        execute: () => {
          console.log('[Sitka] Reset');
        },
      }
    );

    registry.registerCommand(
      {
        id: SitkaCommands.ADD_BOAT,
        label: 'Sitka: Add Boat',
      },
      {
        execute: () => {
          console.log('[Sitka] Add boat');
        },
      }
    );

    registry.registerCommand(
      {
        id: SitkaCommands.BROADCAST,
        label: 'Sitka: Fleet Broadcast',
      },
      {
        execute: () => {
          console.log('[Sitka] Broadcast');
        },
      }
    );

    registry.registerCommand(
      {
        id: SitkaCommands.SHOW_ANALYSIS,
        label: 'Sitka: Show Game Theory Analysis',
      },
      {
        execute: () => {
          console.log('[Sitka] Show analysis');
        },
      }
    );
  }
}
