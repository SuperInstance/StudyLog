/**
 * SI Multi-Model - Backend Module
 *
 * Backend service for multi-model routing to cheapest available provider.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/node/messaging/proxy-factory';
import { MultiModelBackendService, MULTI_MODEL_SERVICE_PATH } from './multi-model-backend-service';
import { ModelRouter } from './model-router';

export default new ContainerModule((bind) => {
  // Bind model router
  bind(ModelRouter).toSelf().inSingletonScope();

  // Bind backend service
  bind(MultiModelBackendService).toSelf().inSingletonScope();

  // Export the service to frontend
  bind(ConnectionHandler).toDynamicValue(
    (ctx) =>
      new JsonRpcConnectionHandler(MULTI_MODEL_SERVICE_PATH, () => {
        return ctx.container.get(MultiModelBackendService);
      })
  );
});
