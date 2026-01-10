/**
 * SI Godot Panel - Backend Module
 *
 * Manages Godot headless process on the backend.
 * Downloads Godot 4.3 if not present, launches headless server,
 * and proxies WebSocket connections.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/node/messaging/proxy-factory';
import { GodotBackendService, GODOT_SERVICE_PATH } from './godot-backend-service';
import { GodotProcessManager } from './godot-process-manager';

export default new ContainerModule((bind) => {
  // Bind Godot process manager
  bind(GodotProcessManager).toSelf().inSingletonScope();

  // Bind backend service
  bind(GodotBackendService).toSelf().inSingletonScope();

  // Export the service to frontend
  bind(ConnectionHandler).toDynamicValue(
    (ctx) =>
      new JsonRpcConnectionHandler(GODOT_SERVICE_PATH, () => {
        return ctx.container.get(GodotBackendService);
      })
  );
});
