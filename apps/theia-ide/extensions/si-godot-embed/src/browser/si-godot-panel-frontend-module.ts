/**
 * SI Godot Panel - Frontend Module
 *
 * Embeds Godot 4.3 as a living panel in Theia IDE.
 * Supports WebSocket bidirectional communication and hot-reload.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { GodotPanelWidget } from './godot-panel-widget';
import { GodotCommandContribution } from './godot-commands';
import { GodotMenuContribution } from './godot-menu';
import { GodotWebSocketService } from './godot-websocket';

export default new ContainerModule((bind) => {
  // Bind the Godot panel widget
  bind(GodotPanelWidget).toSelf();

  // Register as widget factory
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: GodotPanelWidget.ID,
    createWidget: () => ctx.container.get(GodotPanelWidget),
  }));

  // Bind WebSocket service for Godot communication
  bind(GodotWebSocketService).toSelf().inSingletonScope();

  // Bind commands
  bind(GodotCommandContribution).toSelf();
  bind(CommandContribution).toService(GodotCommandContribution);

  // Bind menu contributions
  bind(MenuContribution).toService(GodotMenuContribution);
});
