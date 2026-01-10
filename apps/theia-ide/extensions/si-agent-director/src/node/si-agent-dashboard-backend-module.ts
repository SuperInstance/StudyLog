/**
 * SI Agent Dashboard - Backend Module
 *
 * Backend service for agent management, progress tracking,
 * and stage unlocking based on completed puzzles.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/node/messaging/proxy-factory';
import { AgentBackendService, AGENT_SERVICE_PATH } from './agent-backend-service';
import { ProgressTracker } from './progress-tracker';

export default new ContainerModule((bind) => {
  // Bind progress tracker
  bind(ProgressTracker).toSelf().inSingletonScope();

  // Bind backend service
  bind(AgentBackendService).toSelf().inSingletonScope();

  // Export the service to frontend
  bind(ConnectionHandler).toDynamicValue(
    (ctx) =>
      new JsonRpcConnectionHandler(AGENT_SERVICE_PATH, () => {
        return ctx.container.get(AgentBackendService);
      })
  );
});
