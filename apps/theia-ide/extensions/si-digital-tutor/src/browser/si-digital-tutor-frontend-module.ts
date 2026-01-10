/**
 * StudyLoG.AI - Digital Tutor Frontend Module
 *
 * Registers the Digital Tutor widget and services with Theia's IoC container.
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
import { DigitalTutorWidget } from './digital-tutor-widget';
import { DigitalTutorFrontendService } from './digital-tutor-frontend-service';

const DigitalTutorWidgetCommand: Command = {
  id: 'studylog.digital-tutor.toggle',
  label: 'Toggle Digital Tutor',
};

class DigitalTutorWidgetContribution
  extends AbstractViewContribution<DigitalTutorWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: DigitalTutorWidget.ID,
      widgetName: DigitalTutorWidget.LABEL,
      defaultWidgetOptions: {
        area: 'right',
        rank: 90,
      },
      toggleCommandId: DigitalTutorWidgetCommand.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    // Auto-open on startup can be enabled here if desired
    // await this.openView({ activate: true, reveal: true });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
  }
}

export default new ContainerModule((bind) => {
  // Bind services
  bind(DigitalTutorFrontendService).toSelf().inSingletonScope();
  bind(MessageService).toSelf().inSingletonScope();

  // Bind widget
  bind(DigitalTutorWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: DigitalTutorWidget.ID,
    createWidget: () => ctx.container.get(DigitalTutorWidget),
  })).inSingletonScope();

  // Bind contribution
  bind(DigitalTutorWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(DigitalTutorWidgetContribution);
});
