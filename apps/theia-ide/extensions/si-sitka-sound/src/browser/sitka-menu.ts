/**
 * Sitka Sound Menu Contributions
 *
 * Adds Sitka Sound menu items to Theia.
 */

import { injectable } from '@theia/core/shared/inversify';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

@injectable()
export class SitkaMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEW, {
      commandId: 'si-sitka-sound.toggle',
      label: 'Show Sitka Sound',
    });

    // Create Sitka menu
    menus.registerSubmenu('si-sitka-menu', 'Sitka Sound');

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.togglePause',
      label: 'Play/Pause',
      order: '0',
    });

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.nextDay',
      label: 'Next Day',
      order: '1',
    });

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.reset',
      label: 'Reset',
      order: '2',
    });

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.addBoat',
      label: 'Add Boat',
      order: '3',
    });

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.broadcast',
      label: 'Fleet Broadcast',
      order: '4',
    });

    menus.registerMenuAction('si-sitka-menu', {
      commandId: 'si-sitka-sound.showAnalysis',
      label: 'Game Theory Analysis',
      order: '5',
    });
  }
}
