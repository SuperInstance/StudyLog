/**
 * StudyLoG.AI - Cost Dashboard Frontend Module
 *
 * Registers the cost dashboard widget with Theia's IoC container.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import {
  WidgetFactory,
  FrontendApplicationContribution,
} from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { MessageService } from '@theia/core';
import {
  AbstractViewContribution,
  FrontendApplication,
} from '@theia/core/lib/browser';
import { CostDashboardWidget } from './cost-dashboard-widget';

const CostDashboardWidgetCommand: Command = {
  id: 'studylog.costDashboard.toggle',
  label: 'Toggle Cost Dashboard',
};

class CostDashboardWidgetContribution
  extends AbstractViewContribution<CostDashboardWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: CostDashboardWidget.ID,
      widgetName: CostDashboardWidget.LABEL,
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 200,
      },
      toggleCommandId: CostDashboardWidgetCommand.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    // Auto-open on startup - can be removed if not desired
    // await this.openView({ activate: true, reveal: true });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
  }
}

export default new ContainerModule((bind) => {
  // Bind services
  bind(MessageService).toSelf().inSingletonScope();

  // Bind widget
  bind(CostDashboardWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: CostDashboardWidget.ID,
    createWidget: () => ctx.container.get(CostDashboardWidget),
  })).inSingletonScope();

  // Bind contribution
  bind(CostDashboardWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(CostDashboardWidgetContribution);
});
