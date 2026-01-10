/**
 * si-bazaar Backend Module
 * Handles server-side bazaar functionality
 */

import { ContainerModule } from '@theia/core/shared/inversify';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // Backend services can be added here
  // For now, all bazaar functionality is client-side + API calls to Cloudflare Workers
});
