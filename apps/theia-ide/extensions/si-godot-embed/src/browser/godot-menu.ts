/**
 * Godot Panel Menu Contributions
 *
 * Adds Godot-related menu items to Theia.
 */

import { injectable } from '@theia/core/shared/inversify';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

@injectable()
export class GodotMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    // Add Godot submenu to View menu
    menus.registerMenuAction(CommonMenus.VIEW_VIEW, {
      commandId: 'si-godot-panel.toggle',
      label: 'Show Godot Panel',
    });

    // Create Godot menu
    menus.registerSubmenu('si-godot-menu', 'Godot');

    menus.registerMenuAction('si-godot-menu', {
      commandId: 'si-godot-panel.play',
      label: 'Play',
      order: '0',
    });

    menus.registerMenuAction('si-godot-menu', {
      commandId: 'si-godot-panel.pause',
      label: 'Pause',
      order: '1',
    });

    menus.registerMenuAction('si-godot-menu', {
      commandId: 'si-godot-panel.reload',
      label: 'Reload Scene',
      order: '2',
    });

    menus.registerMenuAction('si-godot-menu', {
      commandId: 'si-godot-panel.hotReload',
      label: 'Hot Reload Assets',
      order: '3',
    });
  }
}
