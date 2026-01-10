import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { SuperInstanceSimulatorWidget } from './simulator-widget';
import { SimulatorCommands, SimulatorCommandContribution } from './simulator-commands';
import { SimulatorMenuContribution } from './simulator-menu';

export default new ContainerModule(bind => {
  // Bind the widget itself
  bind(SuperInstanceSimulatorWidget).toSelf();
  
  // Register it as a widget factory
  bind(WidgetFactory).toDynamicValue(ctx => ({
    id: SuperInstanceSimulatorWidget.ID,
    createWidget: () => ctx.container.get(SuperInstanceSimulatorWidget)
  }));

  // Bind commands (Play, Export, etc.)
  bind(SimulatorCommandContribution).toSelf();
  bind(CommandContribution).toService(SimulatorCommandContribution);
  
  // Bind menu contributions
  bind(MenuContribution).toService(SimulatorMenuContribution);
});