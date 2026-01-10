/**
 * Multi-Model Menu Contributions
 *
 * Adds multi-model menu items to Theia.
 */

import { injectable } from '@theia/core/shared/inversify';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

@injectable()
export class MultiModelMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEW, {
      commandId: 'si-multi-model.toggle',
      label: 'Show AI Chat',
    });

    // Create AI menu
    menus.registerSubmenu('si-ai-menu', 'AI');

    menus.registerMenuAction('si-ai-menu', {
      commandId: 'si-multi-model.newChat',
      label: 'New Chat',
      order: '0',
    });

    menus.registerMenuAction('si-ai-menu', {
      commandId: 'si-multi-model.clearHistory',
      label: 'Clear History',
      order: '1',
    });

    menus.registerMenuAction('si-ai-menu', {
      commandId: 'si-multi-model.exportChat',
      label: 'Export Chat',
      order: '2',
    });

    menus.registerMenuAction('si-ai-menu', {
      commandId: 'si-multi-model.showCosts',
      label: 'Show Cost Breakdown',
      order: '3',
    });
  }
}
