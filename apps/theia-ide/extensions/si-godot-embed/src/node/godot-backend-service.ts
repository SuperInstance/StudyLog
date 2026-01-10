/**
 * Godot Backend Service
 *
 * RPC service exposed to frontend for managing Godot process.
 */

import { injectable, inject } from '@theia/core/shared/inversify';
import { GodotProcessManager } from './godot-process-manager';

export const GODOT_SERVICE_PATH = '/services/godot';

export interface GodotService {
  isRunning(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  getPort(): Promise<number>;
  getVersion(): Promise<string>;
}

@injectable()
export class GodotBackendService implements GodotService {
  @inject(GodotProcessManager)
  protected readonly processManager: GodotProcessManager;

  async isRunning(): Promise<boolean> {
    return this.processManager.isRunning();
  }

  async start(): Promise<void> {
    return this.processManager.start();
  }

  async stop(): Promise<void> {
    return this.processManager.stop();
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async getPort(): Promise<number> {
    return this.processManager.getPort();
  }

  async getVersion(): Promise<string> {
    return this.processManager.getVersion();
  }

  dispose(): void {
    // Cleanup if needed
  }
}
