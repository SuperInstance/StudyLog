/**
 * StudyLoG.AI - Godot Embed Frontend Module
 *
 * Theia dependency injection configuration.
 */

import { ContainerModule } from '@theia/core/shared/inversify';
import { bindGodotWidgetContribution } from './godot-widget-contribution';

export default new ContainerModule((bind) => {
  bindGodotWidgetContribution(bind);
});
