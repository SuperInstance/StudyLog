/**
 * @studylog/godot-integration
 *
 * Godot integration worker for StudyLoG.AI
 *
 * This package provides:
 * - Theia-Godot bridge client with RPC and event streaming
 * - Plugin system for extending Godot functionality
 * - GDScript patterns for state machines, events, save/load, and tutorials
 * - Custom nodes for AI visualization and gamification
 * - Shader library for visual effects
 * - Educational content framework
 *
 * @example
 * ```typescript
 * import { createBridge } from '@studylog/godot-integration';
 * import { PluginLoader } from '@studylog/godot-integration/plugins';
 * import { LessonManager } from '@studylog/godot-integration/content';
 *
 * // Connect to Godot
 * const bridge = await createBridge({ port: 9876 });
 *
 * // Load plugins
 * const loader = new PluginLoader(logger);
 * await loader.loadPlugins([MyPlugin]);
 *
 * // Manage lessons
 * const lessons = new LessonManager();
 * lessons.registerLesson(myLesson);
 * ```
 *
 * @packageDocumentation
 */

// Public API exports
export * from "./types/index.js";
export * from "./plugins/index.js";
export * from "./theia-bridge/index.js";
export * from "./content/index.js";

// Re-export commonly used items at top level
export { TheiaBridgeClient, createBridge } from "./theia-bridge/TheiaBridgeClient.js";
export { BasePlugin, PluginLoader } from "./plugins/index.js";
export { LessonManager, createLessonManager } from "./content/LessonManager.js";

// Version
export const VERSION = "0.1.0";

/**
 * Initialize the Godot integration system
 *
 * @param config - Configuration options
 * @returns The bridge client
 *
 * @example
 * ```typescript
 * const { bridge, pluginLoader, lessonManager } = await initGodotIntegration({
 *   bridge: { port: 9876 },
 *   plugins: { autoLoad: ['cognitive-mill'] }
 * });
 * ```
 */
export async function initGodotIntegration(config: {
  bridge?: {
    port?: number;
    host?: string;
    debugLog?: boolean;
  };
  plugins?: {
    autoLoad?: string[];
    hotReload?: boolean;
  };
  content?: {
    locale?: string;
  };
}) {
  const {
    createBridge,
  } = await import("./theia-bridge/TheiaBridgeClient.js");

  const bridge = await createBridge({
    port: config.bridge?.port ?? 9876,
    host: config.bridge?.host ?? "127.0.0.1",
    debugLog: config.bridge?.debugLog ?? false,
  });

  // TheiaBridgeInterface for plugin context
  const bridgeInterface = {
    send: (message) => bridge.send(message),
    on: (event, callback) => bridge.on(event, callback),
    off: (event, callback) => bridge.off(event, callback),
    rpc: async (method, ...params) => bridge.rpc(method, ...params),
  };

  const { PluginLoader } = await import("./plugins/index.js");
  const pluginLoader = new PluginLoader({
    debug: console,
    hotReload: config.plugins?.hotReload ?? true,
  });
  pluginLoader.setBridge(bridgeInterface);

  const { LessonManager } = await import("./content/LessonManager.js");
  const lessonManager = new LessonManager();

  return {
    bridge,
    pluginLoader,
    lessonManager,
  };
}
