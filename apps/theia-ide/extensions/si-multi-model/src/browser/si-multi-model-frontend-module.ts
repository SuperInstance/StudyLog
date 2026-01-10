/**
 * SI Multi-Model - Frontend Module
 *
 * Frontend for multi-model router with model switching UI and cost tracking.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { MultiModelChatWidget } from './multi-model-chat-widget';
import { MultiModelCommandContribution } from './multi-model-commands';
import { MultiModelMenuContribution } from './multi-model-menu';
import { MultiModelFrontendService } from './multi-model-frontend-service';

export default new ContainerModule((bind) => {
  // Bind the multi-model chat widget
  bind(MultiModelChatWidget).toSelf();

  // Register as widget factory
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: MultiModelChatWidget.ID,
    createWidget: () => ctx.container.get(MultiModelChatWidget),
  }));

  // Bind frontend service
  bind(MultiModelFrontendService).toSelf().inSingletonScope();

  // Bind commands
  bind(MultiModelCommandContribution).toSelf();
  bind(CommandContribution).toService(MultiModelCommandContribution);

  // Bind menu contributions
  bind(MenuContribution).toService(MultiModelMenuContribution);
});
