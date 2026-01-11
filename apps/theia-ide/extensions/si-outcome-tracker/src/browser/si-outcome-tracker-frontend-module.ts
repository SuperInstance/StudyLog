/**
 * Outcome Tracker Frontend Module
 *
 * Theia frontend module for outcome tracking visualization
 */

import { ContainerModule, interfaces } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser/widget-manager';
import { Contribution } from '@theia/core/lib/common/contribution';
import { MenuContribution, MenuModelRegistry } from '@theia/core/lib/common/menu';
import { MenuItem } from '@theia/core/lib/common';
import { CommandRegistry, Command } from '@theia/core/lib/common/command';
import { MessageService } from '@theia/core/lib/common/message-service';
import {
  OutcomeDashboardWidget,
  OutcomeTrackerFrontendService,
  OutcomeTrackerHelpers
} from './outcome-tracker-frontend-service';

import 'reflect-metadata';
import './outcome-dashboard-styles.css';

/**
 * Command to open the outcome dashboard
 */
export const OutcomeDashboardCommand: Command = {
  id: 'outcome-dashboard.open',
  label: 'Open Learning Progress'
};

/**
 * Frontend contribution for outcome tracking
 */
@injectable()
export class OutcomeTrackerContribution extends Contribution {
  @inject(MessageService) protected readonly messageService: MessageService;
  @inject(OutcomeTrackerFrontendService)
  protected readonly outcomeService: OutcomeTrackerFrontendService;
  @inject(CommandRegistry) protected readonly commandRegistry: CommandRegistry;
  @inject(MenuModelRegistry) protected readonly menuRegistry: MenuModelRegistry;

  constructor() {
    super({ id: 'si-outcome-tracker.contribution' });
  }

  override registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(MenuItem.create({
      menuId: 'view-menu',
      command: OutcomeDashboardCommand.id
    }));
  }

  override registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OutcomeDashboardCommand, {
      execute: async () => {
        this.openDashboard();
      }
    });
  }

  protected openDashboard(): void {
    // Dashboard widget will be opened through widget factory
    this.messageService.info('Opening Learning Progress Dashboard...');
  }

  override onStartup(): void {
    // Initialize any startup tasks
    console.log('[OutcomeTracker] Frontend contribution initialized');
  }
}

/**
 * Widget factory for outcome dashboard
 */
@injectable()
export class OutcomeDashboardWidgetFactory implements WidgetFactory {
  readonly id = OutcomeDashboardWidget.ID;
  readonly label = OutcomeDashboardWidget.LABEL;

  createWidget(): OutcomeDashboardWidget {
    // This would be injected by the container
    return new OutcomeDashboardWidget(
      MessageService,
      OutcomeTrackerFrontendService
    );
  }
}

export default new ContainerModule((bind: interfaces.Bind, unbind: interfaces.Unbind) => {
  // Bind frontend service
  bind(OutcomeTrackerFrontendService).toSelf().inSingletonScope();

  // Bind helpers
  bind(OutcomeTrackerHelpers).toDynamicValue(ctx => {
    const service = ctx.container.get(OutcomeTrackerFrontendService);
    return new OutcomeTrackerHelpers(service);
  }).inSingletonScope();

  // Bind contribution
  bind(OutcomeTrackerContribution).toSelf().inSingletonScope();

  // Bind widget factory
  bind(OutcomeDashboardWidgetFactory).toSelf().inSingletonScope();
  bind(WidgetFactory).toDynamicValue(ctx => {
    return ctx.container.get(OutcomeDashboardWidgetFactory);
  }).inSingletonScope();

  // Bind widget
  bind(OutcomeDashboardWidget).toSelf().inSingletonScope();
});
