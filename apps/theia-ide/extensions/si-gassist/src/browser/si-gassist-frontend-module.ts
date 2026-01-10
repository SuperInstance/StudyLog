/**
 * StudyLoG.AI - G-Assist Frontend Module
 *
 * Registers the G-Assist widget and services with Theia's IoC container.
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
import { GAssistWidget } from './gassist-widget';
import { GAssistFrontendService } from './gassist-frontend-service';

const GAssistWidgetCommand: Command = {
  id: 'studylog.gassist.toggle',
  label: 'Toggle G-Assist',
};

class GAssistWidgetContribution
  extends AbstractViewContribution<GAssistWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: GAssistWidget.ID,
      widgetName: GAssistWidget.LABEL,
      defaultWidgetOptions: {
        area: 'right',
        rank: 100,
      },
      toggleCommandId: GAssistWidgetCommand.id,
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
  bind(GAssistFrontendService).toSelf().inSingletonScope();
  bind(MessageService).toSelf().inSingletonScope();

  // Bind widget
  bind(GAssistWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: GAssistWidget.ID,
    createWidget: () => ctx.container.get(GAssistWidget),
  })).inSingletonScope();

  // Bind contribution
  bind(GAssistWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(GAssistWidgetContribution);
});
