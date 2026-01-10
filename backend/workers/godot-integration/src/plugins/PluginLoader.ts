/**
 * PluginLoader.ts
 *
 * Handles loading, initialization, and lifecycle management of plugins
 */

import type {
  Plugin,
  PluginMetadata,
  PluginContext,
  PluginLogger,
  PluginLoadResult,
  PluginPermission,
  EventCallback,
} from "../types/index.js";
import { BasePlugin } from "./BasePlugin.js";
import { GodotIntegrationError, ErrorCode } from "../types/index.js";

export interface PluginLoadOptions {
  hotReload?: boolean;
  checkPermissions?: boolean;
  skipDependencies?: boolean;
}

export interface PluginManifest {
  plugins: PluginMetadata[];
}

/**
 * Plugin loader and manager
 */
export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();
  private pluginStatus: Map<string, "loaded" | "active" | "error"> = new Map();
  private pluginErrors: Map<string, string[]> = new Map();
  private registeredNodes: Map<string, string> = new Map();
  private registeredShaders: Map<string, string> = new Map();
  private eventSubscriptions: Map<string, Set<EventCallback>> = new Map();
  private sharedState: Map<string, unknown> = new Map();
  private bridge?: import("../types/index.js").TheiaBridgeInterface;

  constructor(
    private logger: PluginLogger,
    private options: PluginLoadOptions = {}
  ) {}

  /**
   * Set the bridge interface for plugin communication
   */
  setBridge(bridge: import("../types/index.js").TheiaBridgeInterface): void {
    this.bridge = bridge;
  }

  /**
   * Load a plugin from a class or object
   */
  async loadPlugin(
    pluginClass: new (...args: unknown[]) => BasePlugin | Plugin
  ): Promise<PluginLoadResult> {
    const errors: string[] = [];

    try {
      // Instantiate the plugin
      const plugin = this.instantiatePlugin(pluginClass);
      const metadata = plugin.metadata;

      // Check if plugin already loaded
      if (this.plugins.has(metadata.id)) {
        errors.push(`Plugin ${metadata.id} is already loaded`);
        return { plugin, errors };
      }

      // Check permissions if enabled
      if (this.options.checkPermissions && metadata.permissions) {
        const permissionErrors = this.checkPermissions(metadata.permissions);
        errors.push(...permissionErrors);
      }

      // Check dependencies
      if (!this.options.skipDependencies && metadata.dependencies) {
        const depErrors = this.checkDependencies(metadata.dependencies);
        errors.push(...depErrors);
      }

      // Store plugin
      this.plugins.set(metadata.id, plugin);
      this.pluginStatus.set(metadata.id, "loaded");

      this.logger.info(`Plugin loaded: ${metadata.name} (${metadata.id})`);

      return { plugin, errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to load plugin: ${message}`);
      return { plugin: null as unknown as Plugin, errors };
    }
  }

  /**
   * Load multiple plugins
   */
  async loadPlugins(
    pluginClasses: Array<new (...args: unknown[]) => BasePlugin | Plugin>
  ): Promise<Map<string, PluginLoadResult>> {
    const results = new Map<string, PluginLoadResult>();

    // Sort by dependency order
    const sorted = this.sortPluginsByDependency(pluginClasses);

    for (const pluginClass of sorted) {
      const result = await this.loadPlugin(pluginClass);
      const metadata = this.getMetadataFromClass(pluginClass);
      if (metadata) {
        results.set(metadata.id, result);
      }
    }

    return results;
  }

  /**
   * Activate a loaded plugin
   */
  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new GodotIntegrationError(
        ErrorCode.PLUGIN_LOAD_FAILED,
        `Plugin not found: ${pluginId}`
      );
    }

    if (this.pluginStatus.get(pluginId) === "active") {
      this.logger.warn(`Plugin already active: ${pluginId}`);
      return;
    }

    try {
      const context = this.createContext();
      await plugin.activate(context);
      this.pluginStatus.set(pluginId, "active");
    } catch (error) {
      this.pluginStatus.set(pluginId, "error");
      const message = error instanceof Error ? error.message : String(error);
      this.pluginErrors.set(
        pluginId,
        this.pluginErrors.get(pluginId) || []
      ).concat([`Activation failed: ${message}`]);
      throw error;
    }
  }

  /**
   * Deactivate an active plugin
   */
  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new GodotIntegrationError(
        ErrorCode.PLUGIN_LOAD_FAILED,
        `Plugin not found: ${pluginId}`
      );
    }

    if (this.pluginStatus.get(pluginId) !== "active") {
      this.logger.warn(`Plugin not active: ${pluginId}`);
      return;
    }

    try {
      if (plugin.deactivate) {
        await plugin.deactivate();
      }
      this.pluginStatus.set(pluginId, "loaded");
    } catch (error) {
      this.logger.error(`Error deactivating plugin ${pluginId}:`, error);
    }
  }

  /**
   * Reload a plugin (hot-reload)
   */
  async reloadPlugin(
    pluginId: string,
    pluginClass: new (...args: unknown[]) => BasePlugin | Plugin
  ): Promise<void> {
    const wasActive = this.pluginStatus.get(pluginId) === "active";

    // Deactivate if active
    if (wasActive) {
      await this.deactivatePlugin(pluginId);
    }

    // Unload existing
    this.plugins.delete(pluginId);
    this.pluginStatus.delete(pluginId);

    // Load new version
    const result = await this.loadPlugin(pluginClass);
    if (result.errors.length > 0) {
      this.logger.warn(`Plugin reloaded with errors:`, result.errors);
    }

    // Call hot reload callback
    if (result.plugin.onHotReload) {
      await result.plugin.onHotReload();
    }

    // Reactivate if it was active
    if (wasActive) {
      await this.activatePlugin(pluginId);
    }

    this.logger.info(`Plugin reloaded: ${pluginId}`);
  }

  /**
   * Unload a plugin completely
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    await this.deactivatePlugin(pluginId);
    this.plugins.delete(pluginId);
    this.pluginStatus.delete(pluginId);
    this.pluginErrors.delete(pluginId);
    this.logger.info(`Plugin unloaded: ${pluginId}`);
  }

  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): "loaded" | "active" | "error" | undefined {
    return this.pluginStatus.get(pluginId);
  }

  /**
   * Get plugin errors
   */
  getPluginErrors(pluginId: string): string[] {
    return this.pluginErrors.get(pluginId) || [];
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): Plugin[] {
    return Array.from(this.plugins.entries())
      .filter(([id]) => this.pluginStatus.get(id) === "active")
      .map(([, plugin]) => plugin);
  }

  /**
   * Check if a plugin is active
   */
  isPluginActive(pluginId: string): boolean {
    return this.pluginStatus.get(pluginId) === "active";
  }

  /**
   * Get all registered nodes
   */
  getRegisteredNodes(): Map<string, string> {
    return new Map(this.registeredNodes);
  }

  /**
   * Get all registered shaders
   */
  getRegisteredShaders(): Map<string, string> {
    return new Map(this.registeredShaders);
  }

  /**
   * Clear all plugins (for shutdown)
   */
  async clearAll(): Promise<void> {
    const activeIds = Array.from(this.plugins.entries())
      .filter(([id]) => this.pluginStatus.get(id) === "active")
      .map(([id]) => id);

    for (const id of activeIds) {
      await this.deactivatePlugin(id);
    }

    this.plugins.clear();
    this.pluginStatus.clear();
    this.pluginErrors.clear();
    this.registeredNodes.clear();
    this.registeredShaders.clear();
    this.eventSubscriptions.clear();
    this.sharedState.clear();
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private instantiatePlugin(
    pluginClass: new (...args: unknown[]) => BasePlugin | Plugin
  ): Plugin {
    return new pluginClass();
  }

  private getMetadataFromClass(
    pluginClass: new (...args: unknown[]) => BasePlugin | Plugin
  ): PluginMetadata | null {
    // Try to get from decorator
    if ((pluginClass as any)._pluginMetadata) {
      return (pluginClass as any)._pluginMetadata;
    }

    // Try to instantiate and get metadata
    try {
      const instance = new pluginClass();
      return instance.metadata;
    } catch {
      return null;
    }
  }

  private checkPermissions(permissions: PluginPermission[]): string[] {
    const errors: string[] = [];
    // In a real implementation, check against actual permissions
    return errors;
  }

  private checkDependencies(dependencies: string[]): string[] {
    const errors: string[] = [];

    for (const dep of dependencies) {
      if (!this.plugins.has(dep)) {
        errors.push(`Missing dependency: ${dep}`);
      }
    }

    return errors;
  }

  private sortPluginsByDependency(
    pluginClasses: Array<new (...args: unknown[]) => BasePlugin | Plugin>
  ): Array<new (...args: unknown[]) => BasePlugin | Plugin> {
    // Topological sort by dependencies
    const sorted: typeof pluginClasses = [];
    const visited = new Set<typeof pluginClass>();
    const visiting = new Set<typeof pluginClass>();

    const visit = (pluginClass: typeof pluginClasses[0]) => {
      if (visited.has(pluginClass)) return;
      if (visiting.has(pluginClass)) {
        throw new Error("Circular dependency detected");
      }

      visiting.add(pluginClass);

      const metadata = this.getMetadataFromClass(pluginClass);
      if (metadata?.dependencies) {
        for (const dep of metadata.dependencies) {
          const depClass = pluginClasses.find(
            (pc) => this.getMetadataFromClass(pc)?.id === dep
          );
          if (depClass) {
            visit(depClass);
          }
        }
      }

      visiting.delete(pluginClass);
      visited.add(pluginClass);
      sorted.push(pluginClass);
    };

    for (const pluginClass of pluginClasses) {
      visit(pluginClass);
    }

    return sorted;
  }

  private createContext(): PluginContext {
    if (!this.bridge) {
      throw new Error("Bridge not set");
    }

    return {
      bridge: this.bridge,
      registerNode: (nodeType, nodeClass) => {
        this.registeredNodes.set(nodeType, nodeClass);
      },
      registerShader: (shaderName, shaderPath) => {
        this.registeredShaders.set(shaderName, shaderPath);
      },
      subscribeEvent: (eventName, callback) => {
        if (!this.eventSubscriptions.has(eventName)) {
          this.eventSubscriptions.set(eventName, new Set());
        }
        this.eventSubscriptions.get(eventName)!.add(callback);
        this.bridge?.on(eventName, callback);
      },
      getState: (key) => {
        return this.sharedState.get(key);
      },
      setState: (key, value) => {
        this.sharedState.set(key, value);
        // Notify Godot of state change
        this.bridge?.send({
          type: "update_shared_state",
          key,
          value,
        });
      },
      getLogger: (pluginId) => {
        return this.createChildLogger(pluginId);
      },
    };
  }

  private createChildLogger(pluginId: string): PluginLogger {
    return {
      debug: (...args) => this.logger.debug(`[${pluginId}]`, ...args),
      info: (...args) => this.logger.info(`[${pluginId}]`, ...args),
      warn: (...args) => this.logger.warn(`[${pluginId}]`, ...args),
      error: (...args) => this.logger.error(`[${pluginId}]`, ...args),
    };
  }
}
