/**
 * si-bazaar Frontend Module
 * Registers the bazaar widget and menu contributions
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { FrontendApplicationContribution, WidgetOpenHandler } from '@theia/core/lib/browser/frontend-application';
import { MenuContribution } from '@theia/core/lib/common/menu';
import { BazaarWidget, BazaarService } from './bazaar-widget';
import { BazaarMenuContribution, BazaarOpenHandler } from './bazaar-menu-contribution';
import { BAZAAR_WIDGET_ID, BAZAAR_WIDGET_LABEL, BAZAAR_ICON_CLASS } from '../common/index';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // Bind BazaarService
  bind(BazaarService).toSelf().inSingletonScope();

  // Bind BazaarWidget
  bind(BazaarWidget).toSelf();
  bind(FrontendApplicationContribution).toService(BazaarWidget);

  // Register widget factory
  bind(WidgetFactory).toDynamicValue(ctx => ({
    id: BAZAAR_WIDGET_ID,
    createWidget: () => ctx.container.get<BazaarWidget>(BazaarWidget),
  })).inSingletonScope();

  // Bind menu contribution
  bind(BazaarMenuContribution).toSelf().inSingletonScope();
  bind(MenuContribution).toService(BazaarMenuContribution);

  // Bind open handler
  bind(BazaarOpenHandler).toSelf().inSingletonScope();
  bind(WidgetOpenHandler).toService(BazaarOpenHandler);
});
