/**
 * StudyLoG.AI - Vibe Chat Frontend Module
 *
 * Registers the Vibe Chat widget and services with Theia's IoC container.
 * Also registers command palette commands for quick actions.
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
import { EditorService } from '@theia/editor/lib/browser/editor-service';
import { OpenerService } from '@theia/core/lib/browser/opener-service';
import { VibeChatWidget } from './vibe-chat-widget';
import { VibeChatService } from './vibe-service';
import { VIBE_CHAT_COMMANDS, QUICK_ACTIONS } from '../common';

// ============================================================================
// Command Definitions
// ============================================================================

const VIBE_CHAT_WIDGET_COMMAND: Command = {
  id: VIBE_CHAT_COMMANDS.TOGGLE,
  label: 'Toggle Vibe Chat',
  iconClass: 'fa fa-comments',
};

const VIBE_CHAT_COMMANDS_LIST: Command[] = [
  {
    id: VIBE_CHAT_COMMANDS.NEW_CONVERSATION,
    label: 'Vibe Chat: New Conversation',
    iconClass: 'fa fa-plus',
  },
  {
    id: VIBE_CHAT_COMMANDS.EXPLAIN,
    label: 'Vibe Chat: Explain Selection',
    iconClass: 'fa fa-question-circle',
  },
  {
    id: VIBE_CHAT_COMMANDS.REFACTOR,
    label: 'Vibe Chat: Refactor Selection',
    iconClass: 'fa fa-magic',
  },
  {
    id: VIBE_CHAT_COMMANDS.FIX,
    label: 'Vibe Chat: Fix Selection',
    iconClass: 'fa fa-wrench',
  },
  {
    id: VIBE_CHAT_COMMANDS.OPTIMIZE,
    label: 'Vibe Chat: Optimize Selection',
    iconClass: 'fa fa-bolt',
  },
  {
    id: VIBE_CHAT_COMMANDS.ADD_TESTS,
    label: 'Vibe Chat: Add Tests',
    iconClass: 'fa fa-flask',
  },
  {
    id: VIBE_CHAT_COMMANDS.DOCUMENT,
    label: 'Vibe Chat: Add Documentation',
    iconClass: 'fa fa-file-text-o',
  },
  {
    id: VIBE_CHAT_COMMANDS.INLINE_CHAT,
    label: 'Vibe Chat: Inline Chat',
    iconClass: 'fa fa-commenting-o',
  },
];

// ============================================================================
// View Contribution
// ============================================================================

class VibeChatWidgetContribution
  extends AbstractViewContribution<VibeChatWidget>
  implements FrontendApplicationContribution
{
  constructor() {
    super({
      widgetId: VibeChatWidget.ID,
      widgetName: VibeChatWidget.LABEL,
      defaultWidgetOptions: {
        area: 'right',
        rank: 100,
      },
      toggleCommandId: VIBE_CHAT_WIDGET_COMMAND.id,
    });
  }

  async initializeLayout(app: FrontendApplication): Promise<void> {
    // Optionally auto-open on startup
    // await this.openView({ activate: true, reveal: true });
  }

  registerCommands(commands: CommandRegistry): void {
    super.registerCommands(commands);

    // Register quick action commands
    VIBE_CHAT_COMMANDS_LIST.forEach((command) => {
      commands.registerCommand(command, {
        execute: () => {
          // Open the widget and trigger the action
          this.openView({ activate: true }).then((widget) => {
            if (widget) {
              // Trigger the quick action via a method on the widget
              // This would require adding public methods to VibeChatWidget
              console.log(`Execute quick action: ${command.id}`);
            }
          });
        },
      });
    });
  }
}

// ============================================================================
// Frontend Module
// ============================================================================

export default new ContainerModule((bind) => {
  // Bind services
  bind(VibeChatService).toSelf().inSingletonScope();
  bind(MessageService).toSelf().inSingletonScope();
  bind(EditorService).toSelf().inSingletonScope();
  bind(OpenerService).toSelf().inSingletonScope();

  // Bind widget
  bind(VibeChatWidget).toSelf();
  bind(WidgetFactory).toDynamicValue((ctx) => ({
    id: VibeChatWidget.ID,
    createWidget: () => ctx.container.get(VibeChatWidget),
  })).inSingletonScope();

  // Bind contribution
  bind(VibeChatWidgetContribution).toSelf().inSingletonScope();
  bind(FrontendApplicationContribution).toService(VibeChatWidgetContribution);
});
