/**
 * StudyLoG.AI - A2UI Renderer Frontend Module
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { bindA2UIWidgetContribution } from './a2ui-widget-contribution';

export default new ContainerModule((bind) => {
  bindA2UIWidgetContribution(bind);
});
