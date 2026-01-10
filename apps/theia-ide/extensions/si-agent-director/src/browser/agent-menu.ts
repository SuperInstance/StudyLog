/**
 * Agent Dashboard Menu Contributions
 *
 * Adds agent-related menu items to Theia.
 */

import { injectable } from '@theia/core/shared/inversify';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';

@injectable()
export class AgentMenuContribution implements MenuContribution {
  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(CommonMenus.VIEW_VIEW, {
      commandId: 'si-agent-dashboard.toggle',
      label: 'Show Agent Dashboard',
    });

    // Create Agents menu
    menus.registerSubmenu('si-agents-menu', 'Agents');

    menus.registerMenuAction('si-agents-menu', {
      commandId: 'si-agent-dashboard.newAgent',
      label: 'New Agent',
      order: '0',
    });

    menus.registerMenuAction('si-agents-menu', {
      commandId: 'si-agent-dashboard.showProgress',
      label: 'Show Progress',
      order: '1',
    });

    menus.registerMenuAction('si-agents-menu', {
      commandId: 'si-agent-dashboard.unlockStage',
      label: 'Unlock Stage',
      order: '2',
    });
  }
}
