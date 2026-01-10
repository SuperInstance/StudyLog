/**
 * Bazaar Menu Contribution
 * Adds Bazaar menu item to Theia's menu bar
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { MenuModelRegistry, MenuPath } from '@theia/core/lib/common/menu';
import { CommonMenus } from '@theia/core/lib/browser/common-frontend-contribution';
import { BazaarWidget } from './bazaar-widget';
import { WidgetOpenHandler } from '@theia/core/lib/browser/widget-open-handler';
import { CommandHandler } from '@theia/core/lib/common/command';

export const BAZAAR_MENU: MenuPath = ['bazaa_menu'];

@injectable()
export class BazaarMenuContribution {
  @inject(MenuModelRegistry)
  protected readonly menuRegistry: MenuModelRegistry;

  @inject(BazaarWidget)
  protected readonly bazaarWidget: BazaarWidget;

  registerMenus(): void {
    // Register Bazaar command
    this.menuRegistry.registerCommandAction({
      id: 'bazaar.open',
      label: 'Open Bazaar',
      iconClass: 'fa fa-globe'
    });

    // Add to View menu
    this.menuRegistry.registerMenuAction(CommonMenus.VIEW, {
      commandId: 'bazaar.open',
      label: 'Bazaar',
      order: '5'
    });
  }

  registerHandlers(): void {
    // Register command handler for opening the Bazaar widget
    CommandHandler.register({
      id: 'bazaar.open',
      handler: () => {
        this.bazaarWidget.activate();
        return true;
      }
    });
  }
}

@injectable()
export class BazaarOpenHandler extends WidgetOpenHandler {
  readonly id = 'bazaar.open';
  readonly label = 'Open Bazaar';

  canHandle(uri: string): boolean {
    return uri === 'bazaar://';
  }

  open(uri: string): BazaarWidget {
    return this.widget!;
  }

  @inject(BazaarWidget)
  protected readonly widget?: BazaarWidget;
}
