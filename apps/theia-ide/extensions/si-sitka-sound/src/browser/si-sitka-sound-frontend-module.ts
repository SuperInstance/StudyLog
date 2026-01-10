/**
 * SI Sitka Sound - Frontend Module
 *
 * Ecological simulation with asymmetrical information,
 * murmuration logic for fish schools, A2A fleet communication,
 * and game theory decision engine.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { SitkaSoundWidget } from './sitka-sound-widget';
import { SitkaCommandContribution } from './sitka-commands';
import { SitkaMenuContribution } from './sitka-menu';
import { SitkaFrontendService } from './sitka-frontend-service';

export default new ContainerModule((bind) => {
  // Bind the Sitka Sound widget
  bind(SitkaSoundWidget).toSelf();

  // Register as widget factory
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: SitkaSoundWidget.ID,
    createWidget: () => ctx.container.get(SitkaSoundWidget),
  }));

  // Bind frontend service
  bind(SitkaFrontendService).toSelf().inSingletonScope();

  // Bind commands
  bind(SitkaCommandContribution).toSelf();
  bind(CommandContribution).toService(SitkaCommandContribution);

  // Bind menu contributions
  bind(MenuContribution).toService(SitkaMenuContribution);
});
