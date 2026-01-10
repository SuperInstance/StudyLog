/**
 * StudyLoG.AI - Godot Widget Contribution
 *
 * Registers the Godot widget with Theia's widget system.
 */

import { injectable } from '@theia/core/shared/inversify';
import {
  AbstractViewContribution,
  FrontendApplication,
  FrontendApplicationContribution,
  WidgetFactory,
} from '@theia/core/lib/browser';
import { Command, CommandRegistry } from '@theia/core/lib/common';
import { GodotWidget } from './godot-widget';
import { GODOT_WIDGET_ID, GODOT_WIDGET_LABEL } from '../common';

export const GodotWidgetCommand: Command = {
  id: 'studylog.godot.toggle',
  label: 'Toggle Game View',
};

export const GodotReloadCommand: Command = {
  id: 'studylog.godot.reload',
  label: 'Reload Game Scene',
};

@injectable()
export class GodotWidgetContribution
  extends AbstractViewContribution<GodotWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: GODOT_WIDGET_ID,
      widgetName: GODOT_WIDGET_LABEL,
      defaultWidgetOptions: {
        area: 'right',
        rank: 100,
      },
      toggleCommandId: GodotWidgetCommand.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    await this.openView({ activate: false, reveal: false });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);

    commands.registerCommand(GodotReloadCommand, {
      execute: async () => {
        const widget = await this.widget;
        widget.reload();
      },
      isEnabled: () => true,
    });
  }
}

export const bindGodotWidgetContribution = (bind: any): void => {
  bind(GodotWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: GODOT_WIDGET_ID,
    createWidget: () => ctx.container.get(GodotWidget),
  })).inSingletonScope();
  bind(GodotWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(GodotWidgetContribution);
};
