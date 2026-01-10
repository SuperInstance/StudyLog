/**
 * SI Agent Dashboard - Frontend Module
 *
 * Real-time agent status, model switching UI, cost tracking,
 * and progressive unlock based on skill level.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { AgentDashboardWidget } from './agent-dashboard-widget';
import { AgentCommandContribution } from './agent-commands';
import { AgentMenuContribution } from './agent-menu';
import { AgentDashboardFrontendService } from './agent-dashboard-frontend-service';

export default new ContainerModule((bind) => {
  // Bind the agent dashboard widget
  bind(AgentDashboardWidget).toSelf();

  // Register as widget factory
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: AgentDashboardWidget.ID,
    createWidget: () => ctx.container.get(AgentDashboardWidget),
  }));

  // Bind frontend service
  bind(AgentDashboardFrontendService).toSelf().inSingletonScope();

  // Bind commands
  bind(AgentCommandContribution).toSelf();
  bind(CommandContribution).toService(AgentCommandContribution);

  // Bind menu contributions
  bind(MenuContribution).toService(AgentMenuContribution);
});
