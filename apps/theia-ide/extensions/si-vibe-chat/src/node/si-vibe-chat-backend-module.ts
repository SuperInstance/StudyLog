/**
 * StudyLoG.AI - Vibe Chat Backend Module
 *
 * Registers the backend service with Theia's IoC container.
 * Provides WebSocket and API endpoints for Vibe Chat functionality.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { ConnectionHandler, JsonRpcConnectionHandler } from '@theia/core/lib/common/messaging/proxy-factory';
import { WebSocketConnectionProvider } from '@theia/core/lib/browser/messaging/ws-connection-provider';
import { VibeChatBackendService } from './vibe-backend';

// ============================================================================
// Backend Service
// ============================================================================

export const VibeChatBackendServicePath = '/services/vibe-chat';
export const VibeChatServiceSymbol = Symbol('VibeChatService');

// ============================================================================
// Backend Module
// ============================================================================

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
  // Bind the backend service
  bind(VibeChatBackendService).toSelf().inSingletonScope();
  bind(VibeChatServiceSymbol).toService(VibeChatBackendService);

  // Export the service as a WebSocket connection handler
  bind(ConnectionHandler)
    .toDynamicValue((ctx) => {
      const service = ctx.container.get<VibeChatBackendService>(VibeChatBackendService);
      return JsonRpcConnectionHandler.create<VibeChatBackendService>(
        VibeChatBackendServicePath,
        service
      );
    })
    .inSingletonScope();
});
