/**
 * SI Sitka Sound - Backend Module
 *
 * Backend simulation engine for Sitka Sound with:
 * - Asymmetrical information simulation
 * - Murmuration logic for fish schools
 * - A2A fleet communication
 * - Game theory decision engine
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/node/messaging/proxy-factory';
import { SitkaBackendService, SITKA_SERVICE_PATH } from './sitka-backend-service';
import { SimulationEngine } from './simulation-engine';

export default new ContainerModule((bind) => {
  // Bind simulation engine
  bind(SimulationEngine).toSelf().inSingletonScope();

  // Bind backend service
  bind(SitkaBackendService).toSelf().inSingletonScope();

  // Export the service to frontend
  bind(ConnectionHandler).toDynamicValue(
    (ctx) =>
      new JsonRpcConnectionHandler(SITKA_SERVICE_PATH, () => {
        return ctx.container.get(SitkaBackendService);
      })
  );
});
