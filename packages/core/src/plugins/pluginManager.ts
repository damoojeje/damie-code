/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import {
  type PluginManifest,
  type LoadedPlugin,
  type DamiePlugin,
  type PluginContext,
  type PluginManagerConfig,
  type HookResult,
  type PluginCommand,
  type PluginEvent,
  PluginState,
} from './types.js';

/**
 * PluginManager - Manages plugin lifecycle and execution
 *
 * Provides:
 * - Plugin discovery and loading
 * - Plugin lifecycle management (load, enable, disable, unload)
 * - Hook system for plugin events
 * - Plugin configuration
 */
export class PluginManager extends EventEmitter {
  private config: PluginManagerConfig;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private pluginInstances: Map<string, DamiePlugin> = new Map();
  private hooks: Map<PluginEvent, Array<{ plugin: string; handler: () => unknown; priority: number }>> = new Map();
  private commands: Map<string, { plugin: string; handler: (...args: unknown[]) => unknown }> = new Map();
  constructor(config?: Partial<PluginManagerConfig>) {
    super();

    const defaultPluginsPath = path.join(os.homedir(), '.damie', 'plugins');

    this.config = {
      pluginsPath: config?.pluginsPath ?? defaultPluginsPath,
      autoLoad: config?.autoLoad ?? true,
      enabledPlugins: config?.enabledPlugins ?? [],
      disabledPlugins: config?.disabledPlugins ?? [],
    };

    this.ensurePluginsDirectory();

    if (this.config.autoLoad) {
      this.discoverPlugins();
    }
  }

  /**
   * Ensure plugins directory exists
   */
  private ensurePluginsDirectory(): void {
    if (!fs.existsSync(this.config.pluginsPath)) {
      fs.mkdirSync(this.config.pluginsPath, { recursive: true });
    }
  }

  /**
   * Discover plugins in the plugins directory
   */
  discoverPlugins(): void {
    if (!fs.existsSync(this.config.pluginsPath)) {
      return;
    }

    const entries = fs.readdirSync(this.config.pluginsPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(this.config.pluginsPath, entry.name);
        const manifestPath = path.join(pluginPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifestData = fs.readFileSync(manifestPath, 'utf-8');
            const manifest: PluginManifest = JSON.parse(manifestData);

            const plugin: LoadedPlugin = {
              name: manifest.name,
              manifest,
              state: PluginState.UNLOADED,
              path: pluginPath,
            };

            this.plugins.set(manifest.name, plugin);
          } catch (error) {
            console.error(`Failed to discover plugin at ${pluginPath}:`, error);
          }
        }
      }
    }
  }

  /**
   * List all discovered plugins
   */
  listPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get a specific plugin
   */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if a plugin is loaded
   */
  isLoaded(name: string): boolean {
    const plugin = this.plugins.get(name);
    return plugin?.state === PluginState.LOADED || plugin?.state === PluginState.ENABLED;
  }

  /**
   * Check if a plugin is enabled
   */
  isEnabled(name: string): boolean {
    return this.plugins.get(name)?.state === PluginState.ENABLED;
  }

  /**
   * Load a plugin
   */
  async loadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin "${name}" not found`);
    }

    if (plugin.state === PluginState.LOADED || plugin.state === PluginState.ENABLED) {
      return true;
    }

    plugin.state = PluginState.LOADING;

    try {
      // In a real implementation, we would dynamically import the plugin
      // For now, we simulate loading
      const instance: DamiePlugin = {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
      };

      this.pluginInstances.set(name, instance);

      // Register hooks
      if (plugin.manifest.hooks) {
        for (const hook of plugin.manifest.hooks) {
          this.registerHook(name, hook.event, () => {}, hook.priority ?? 0);
        }
      }

      // Register commands
      if (plugin.manifest.commands) {
        for (const command of plugin.manifest.commands) {
          this.registerCommand(name, command, () => {});
        }
      }

      plugin.state = PluginState.LOADED;
      plugin.loadedAt = new Date();

      this.emit('plugin:loaded', { plugin: name });
      return true;
    } catch (error) {
      plugin.state = PluginState.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('plugin:error', { plugin: name, error: plugin.error });
      return false;
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      return false;
    }

    if (plugin.state === PluginState.ENABLED) {
      await this.disablePlugin(name);
    }

    try {
      const instance = this.pluginInstances.get(name);
      if (instance?.destroy) {
        await instance.destroy();
      }

      this.pluginInstances.delete(name);

      // Remove hooks
      for (const [event, handlers] of this.hooks.entries()) {
        this.hooks.set(
          event,
          handlers.filter((h) => h.plugin !== name)
        );
      }

      // Remove commands
      for (const [cmdName, cmd] of this.commands.entries()) {
        if (cmd.plugin === name) {
          this.commands.delete(cmdName);
        }
      }

      plugin.state = PluginState.UNLOADED;
      plugin.loadedAt = undefined;

      this.emit('plugin:unloaded', { plugin: name });
      return true;
    } catch (error) {
      plugin.state = PluginState.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      throw new Error(`Plugin "${name}" not found`);
    }

    if (plugin.state === PluginState.UNLOADED) {
      await this.loadPlugin(name);
    }

    if (plugin.state === PluginState.ENABLED) {
      return true;
    }

    try {
      const instance = this.pluginInstances.get(name);
      if (instance?.enable) {
        await instance.enable();
      }

      plugin.state = PluginState.ENABLED;
      plugin.enabledAt = new Date();

      this.emit('plugin:enabled', { plugin: name });
      return true;
    } catch (error) {
      plugin.state = PluginState.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      return false;
    }

    if (plugin.state !== PluginState.ENABLED) {
      return true;
    }

    try {
      const instance = this.pluginInstances.get(name);
      if (instance?.disable) {
        await instance.disable();
      }

      plugin.state = PluginState.DISABLED;
      plugin.enabledAt = undefined;

      this.emit('plugin:disabled', { plugin: name });
      return true;
    } catch (error) {
      plugin.state = PluginState.ERROR;
      plugin.error = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  /**
   * Register a hook handler
   */
  private registerHook(
    plugin: string,
    event: PluginEvent,
    handler: () => unknown,
    priority: number
  ): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const handlers = this.hooks.get(event)!;
    handlers.push({ plugin, handler, priority });
    handlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Register a command handler
   */
  private registerCommand(
    plugin: string,
    command: PluginCommand,
    handler: (...args: unknown[]) => unknown
  ): void {
    this.commands.set(command.name, { plugin, handler });
  }

  /**
   * Execute all hooks for an event
   */
  async executeHooks(event: PluginEvent, _data?: unknown): Promise<HookResult[]> {
    const handlers = this.hooks.get(event) || [];
    const results: HookResult[] = [];

    for (const { plugin, handler } of handlers) {
      const startTime = Date.now();

      try {
        const result = await handler();
        results.push({
          plugin,
          hook: event,
          success: true,
          result,
          duration: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          plugin,
          hook: event,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Execute a command
   */
  async executeCommand(name: string, ...args: unknown[]): Promise<unknown> {
    const command = this.commands.get(name);

    if (!command) {
      throw new Error(`Command "${name}" not found`);
    }

    const plugin = this.plugins.get(command.plugin);
    if (plugin?.state !== PluginState.ENABLED) {
      throw new Error(`Plugin "${command.plugin}" is not enabled`);
    }

    return command.handler(...args);
  }

  /**
   * Get list of registered commands
   */
  getCommands(): Array<{ name: string; plugin: string }> {
    return Array.from(this.commands.entries()).map(([name, cmd]) => ({
      name,
      plugin: cmd.plugin,
    }));
  }

  /**
   * Install a plugin from a path
   */
  async installPlugin(sourcePath: string): Promise<LoadedPlugin> {
    const manifestPath = path.join(sourcePath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error('No manifest.json found in plugin directory');
    }

    const manifestData = fs.readFileSync(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestData);

    const destPath = path.join(this.config.pluginsPath, manifest.name);

    // Copy plugin to plugins directory
    if (fs.existsSync(destPath)) {
      fs.rmSync(destPath, { recursive: true, force: true });
    }

    this.copyDirectory(sourcePath, destPath);

    const plugin: LoadedPlugin = {
      name: manifest.name,
      manifest,
      state: PluginState.UNLOADED,
      path: destPath,
    };

    this.plugins.set(manifest.name, plugin);
    return plugin;
  }

  /**
   * Copy directory recursively
   */
  private copyDirectory(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Remove a plugin
   */
  async removePlugin(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      return false;
    }

    await this.unloadPlugin(name);

    try {
      fs.rmSync(plugin.path, { recursive: true, force: true });
      this.plugins.delete(name);
      this.emit('plugin:removed', { plugin: name });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get plugin settings
   */
  getPluginSettings(name: string): Record<string, unknown> | undefined {
    return this.plugins.get(name)?.settings;
  }

  /**
   * Set plugin settings
   */
  setPluginSettings(name: string, settings: Record<string, unknown>): boolean {
    const plugin = this.plugins.get(name);

    if (!plugin) {
      return false;
    }

    plugin.settings = { ...plugin.settings, ...settings };
    return true;
  }

  /**
   * Get enabled plugins
   */
  getEnabledPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter(
      (p) => p.state === PluginState.ENABLED
    );
  }

  /**
   * Get plugin statistics
   */
  getStats(): {
    total: number;
    loaded: number;
    enabled: number;
    disabled: number;
    error: number;
  } {
    const plugins = Array.from(this.plugins.values());
    return {
      total: plugins.length,
      loaded: plugins.filter(
        (p) => p.state === PluginState.LOADED || p.state === PluginState.ENABLED
      ).length,
      enabled: plugins.filter((p) => p.state === PluginState.ENABLED).length,
      disabled: plugins.filter((p) => p.state === PluginState.DISABLED).length,
      error: plugins.filter((p) => p.state === PluginState.ERROR).length,
    };
  }

  /**
   * Create plugin context
   */
  createPluginContext(plugin: string): PluginContext {
    return {
      workingDirectory: process.cwd(),
      config: this.plugins.get(plugin)?.settings || {},
      logger: {
        debug: (msg, ...args) => console.debug(`[${plugin}]`, msg, ...args),
        info: (msg, ...args) => console.info(`[${plugin}]`, msg, ...args),
        warn: (msg, ...args) => console.warn(`[${plugin}]`, msg, ...args),
        error: (msg, ...args) => console.error(`[${plugin}]`, msg, ...args),
      },
      api: {
        getConfig: (key) => this.plugins.get(plugin)?.settings?.[key],
        setConfig: (key, value) => {
          const p = this.plugins.get(plugin);
          if (p) {
            p.settings = p.settings || {};
            p.settings[key] = value;
          }
        },
        registerTool: () => {},
        registerCommand: (cmd, handler) => this.registerCommand(plugin, cmd, handler),
        emit: (event, data) => this.emit(event, data),
        on: (event, handler) => this.on(event, handler),
      },
    };
  }
}

/**
 * Factory function to create PluginManager
 */
export function createPluginManager(
  config?: Partial<PluginManagerConfig>
): PluginManager {
  return new PluginManager(config);
}
