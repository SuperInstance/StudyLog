/**
 * Outcome Tracker Backend Module
 *
 * Theia backend module for outcome tracking service
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { OutcomeTrackerService } from './outcome-tracker-service';
import { WebSocketConnectionProvider, WebSocketChannel } from '@theia/core/lib/browser';
import { interfaces } from '@theia/core/shared/inversify';

export const reExportBackends = [
  OutcomeTrackerService
];

export default new ContainerModule((bind: interfaces.Bind) => {
  bind(OutcomeTrackerService).toSelf().inSingletonScope();
});
