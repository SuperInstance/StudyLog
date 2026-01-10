/**
 * StudyLoG.AI - Agent Director Frontend Module
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import {
  AbstractViewContribution,
  FrontendApplication,
  FrontendApplicationContribution,
  WidgetFactory,
} from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { DirectorService } from './director-service';
import { DirectorWidget } from './director-widget';

const DirectorWidgetCommand: Command = {
  id: 'studylog.director.toggle',
  label: 'Toggle Agent Chat',
};

class DirectorWidgetContribution
  extends AbstractViewContribution<DirectorWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: DirectorWidget.ID,
      widgetName: DirectorWidget.LABEL,
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 100,
      },
      toggleCommandId: DirectorWidgetCommand.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    await this.openView({ activate: true, reveal: true });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
  }
}

export default new ContainerModule((bind) => {
  // Bind services
  bind(DirectorService).toSelf().inSingletonScope();

  // Bind widget
  bind(DirectorWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: DirectorWidget.ID,
    createWidget: () => ctx.container.get(DirectorWidget),
  })).inSingletonScope();

  // Bind contribution
  bind(DirectorWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(DirectorWidgetContribution);
});
