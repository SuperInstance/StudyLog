/**
 * StudyLoG.AI - A2UI Widget Contribution
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  AbstractViewContribution,
  FrontendApplication,
  FrontendApplicationContribution,
  WidgetFactory,
} from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { A2UIWidget } from './a2ui-widget';
import { A2UI_WIDGET_ID, A2UI_WIDGET_LABEL } from '../common';

export const A2UIWidgetCommand: Command = {
  id: 'studylog.a2ui.toggle',
  label: 'Toggle Agent UI',
};

@injectable()
export class A2UIWidgetContribution
  extends AbstractViewContribution<A2UIWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: A2UI_WIDGET_ID,
      widgetName: A2UI_WIDGET_LABEL,
      defaultWidgetOptions: {
        area: 'bottom',
        rank: 200,
      },
      toggleCommandId: A2UIWidgetCommand.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    await this.openView({ activate: false, reveal: false });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);
  }
}

export const bindA2UIWidgetContribution = (bind: any): void => {
  bind(A2UIWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: A2UI_WIDGET_ID,
    createWidget: () => ctx.container.get(A2UIWidget),
  })).inSingletonScope();
  bind(A2UIWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(A2UIWidgetContribution);
};
