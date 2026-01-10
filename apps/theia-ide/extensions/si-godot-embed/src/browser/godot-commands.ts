/**
 * Godot Panel Commands
 *
 * Commands for interacting with the Godot panel.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { GodotWebSocketService } from './godot-websocket';

export const GodotCommands = {
  RELOAD: 'si-godot-panel.reload',
  HOT_RELOAD: 'si-godot-panel.hotReload',
  TOGGLE_FULLSCREEN: 'si-godot-panel.toggleFullscreen',
  PAUSE: 'si-godot-panel.pause',
  PLAY: 'si-godot-panel.play',
};

@injectable()
export class GodotCommandContribution implements CommandContribution {
  @inject(GodotWebSocketService)
  protected readonly websocket: GodotWebSocketService;

  registerCommands(registry: CommandRegistry): void {
    registry.registerCommand(
      {
        id: GodotCommands.RELOAD,
        label: 'Godot: Reload Scene',
      },
      {
        execute: () => {
          this.websocket.sendCommand('reload_scene', {});
        },
      }
    );

    registry.registerCommand(
      {
        id: GodotCommands.HOT_RELOAD,
        label: 'Godot: Hot Reload Assets',
      },
      {
        execute: () => {
          this.websocket.send('hot_reload_all', {});
        },
      }
    );

    registry.registerCommand(
      {
        id: GodotCommands.TOGGLE_FULLSCREEN,
        label: 'Godot: Toggle Fullscreen',
      },
      {
        execute: () => {
          this.websocket.sendCommand('toggle_fullscreen', {});
        },
      }
    );

    registry.registerCommand(
      {
        id: GodotCommands.PAUSE,
        label: 'Godot: Pause',
      },
      {
        execute: () => {
          this.websocket.sendCommand('pause', {});
        },
      }
    );

    registry.registerCommand(
      {
        id: GodotCommands.PLAY,
        label: 'Godot: Play',
      },
      {
        execute: () => {
          this.websocket.sendCommand('play', {});
        },
      }
    );
  }
}
