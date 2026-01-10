/**
 * BasePlugin.ts
 *
 * Base class for StudyLoG.AI Godot plugins.
 * All plugins should extend this class to ensure compatibility.
 */

import type {
  Plugin,
  PluginMetadata,
  PluginContext,
  PluginLogger,
  EventCallback,
} from "../types/index.js";

/**
 * Abstract base class for all plugins
 */
export abstract class BasePlugin implements Plugin {
  abstract readonly metadata: PluginMetadata;

  protected context?: PluginContext;
  protected logger?: PluginLogger;
  protected eventCallbacks: Map<string, EventCallback[]> = new Map();
  protected _isActive: boolean = false;

  /**
   * Called when plugin is activated
   */
  activate(context: PluginContext): void | Promise<void> {
    this.context = context;
    this.logger = context.getLogger(this.metadata.id);
    this._isActive = true;

    this.logger.info(`Plugin "${this.metadata.name}" activated`);
  }

  /**
   * Called when plugin is deactivated
   */
  deactivate(): void | Promise<void> {
    this._isActive = false;

    // Unregister all event callbacks
    for (const [event, callbacks] of this.eventCallbacks) {
      for (const callback of callbacks) {
        this.context?.bridge.off(event, callback);
      }
    }
    this.eventCallbacks.clear();

    this.logger?.info(`Plugin "${this.metadata.name}" deactivated`);
  }

  /**
   * Called when plugin is hot-reloaded during development
   */
  onHotReload(): void | Promise<void> {
    this.logger?.info(`Plugin "${this.metadata.name}" hot-reloaded`);
  }

  /**
   * Check if plugin is currently active
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Register a custom node type with Godot
   */
  protected registerNode(nodeType: string, nodeClass: string): void {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    this.context.registerNode(nodeType, nodeClass);
    this.logger?.debug(`Registered node: ${nodeType} -> ${nodeClass}`);
  }

  /**
   * Register a custom shader with Godot
   */
  protected registerShader(shaderName: string, shaderPath: string): void {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    this.context.registerShader(shaderName, shaderPath);
    this.logger?.debug(`Registered shader: ${shaderName} -> ${shaderPath}`);
  }

  /**
   * Subscribe to a Godot event
   */
  protected subscribeEvent(eventName: string, callback: EventCallback): void {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }

    if (!this.eventCallbacks.has(eventName)) {
      this.eventCallbacks.set(eventName, []);
    }

    this.eventCallbacks.get(eventName)!.push(callback);
    this.context.subscribeEvent(eventName, callback);

    this.logger?.debug(`Subscribed to event: ${eventName}`);
  }

  /**
   * Send a message to Godot
   */
  protected send(message: import("../types/index.js").TheiaToGodotMessage): void {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    this.context.bridge.send(message);
  }

  /**
   * Call an RPC method on Godot
   */
  protected async rpc(method: string, ...params: unknown[]): Promise<unknown> {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    return this.context.bridge.rpc(method, ...params);
  }

  /**
   * Get a value from shared state
   */
  protected getState(key: string): unknown {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    return this.context.getState(key);
  }

  /**
   * Set a value in shared state
   */
  protected setState(key: string, value: unknown): void {
    if (!this.context) {
      throw new Error("Plugin not activated");
    }
    this.context.setState(key, value);
  }

  /**
   * Check if another plugin is loaded
   */
  protected hasDependency(pluginId: string): boolean {
    // This would be checked against the plugin manager
    return true;
  }
}

/**
 * Decorator to define plugin metadata
 */
export function PluginMetadata(metadata: PluginMetadata) {
  return function <T extends { new (...args: unknown[]): BasePlugin }>(
    constructor: T
  ) {
    // Store metadata for later retrieval
    (constructor as any)._pluginMetadata = metadata;
    return constructor;
  };
}

/**
 * Get plugin metadata from a plugin class
 */
export function getPluginMetadata(
  pluginClass: new (...args: unknown[]) => BasePlugin
): PluginMetadata | null {
  return (pluginClass as any)._pluginMetadata || null;
}
