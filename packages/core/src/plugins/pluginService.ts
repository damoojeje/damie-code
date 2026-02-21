/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { PluginManager, LoadedPlugin, PluginManifest, LogEntry } from '@damie-code/damie-code-core';
import { PluginState } from '@damie-code/damie-code-core';

/**
 * Plugin list item for UI display
 */
export interface PluginListItem {
  name: string;
  description: string;
  version: string;
  author?: string;
  enabled: boolean;
  loaded: boolean;
  state: PluginState;
  path: string;
  hooks: string[];
  commands: string[];
  hasErrors: boolean;
  error?: string;
}

/**
 * Plugin info with full details
 */
export interface PluginInfo {
  name: string;
  manifest: PluginManifest;
  state: PluginState;
  path: string;
  loadedAt?: Date;
  enabled: boolean;
  hooks: HookInfo[];
  commands: CommandInfo[];
  logs: LogEntry[];
  error?: string;
}

/**
 * Hook information
 */
export interface HookInfo {
  event: string;
  handler: string;
  priority: number;
  plugin: string;
}

/**
 * Command information
 */
export interface CommandInfo {
  name: string;
  description: string;
  handler: string;
  plugin: string;
}

/**
 * Plugin load result
 */
export interface LoadResult {
  success: boolean;
  plugin?: LoadedPlugin;
  error?: string;
  warnings?: string[];
}

/**
 * Plugin install result
 */
export interface InstallResult {
  success: boolean;
  pluginPath?: string;
  error?: string;
  warnings?: string[];
}

/**
 * PluginService - Service layer for plugin management
 * 
 * Provides a clean interface between PluginManager backend and UI components.
 * Handles:
 * - Listing plugins with UI-friendly formatting
 * - Loading/unloading plugins
 * - Enabling/disabling plugins
 * - Viewing plugin hooks and commands
 * - Viewing plugin logs
 * - Installing/uninstalling plugins
 */
export class PluginService {
  constructor(private pluginManager: PluginManager) {}

  /**
   * List all plugins (discovered + loaded)
   */
  async listPlugins(): Promise<PluginListItem[]> {
    try {
      // Discover plugins first
      this.pluginManager.discoverPlugins();
      
      // Get all discovered plugins
      const plugins = this.pluginManager.getPlugins();
      
      return plugins.map((plugin) => this.toPluginListItem(plugin));
    } catch (error) {
      console.error('Failed to list plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin info by name
   */
  async getPluginInfo(name: string): Promise<PluginInfo | null> {
    try {
      const plugin = this.pluginManager.getPlugin(name);
      if (!plugin) {
        return null;
      }

      const hooks = this.pluginManager.getPluginHooks(name);
      const commands = this.pluginManager.getPluginCommands(name);
      const logs = this.pluginManager.getPluginLogs(name);

      return {
        name: plugin.name,
        manifest: plugin.manifest,
        state: plugin.state,
        path: plugin.path,
        loadedAt: plugin.state === PluginState.LOADED ? new Date() : undefined,
        enabled: this.pluginManager.isPluginEnabled(name),
        hooks: hooks.map((h) => ({
          event: h.event,
          handler: h.handler.name,
          priority: h.priority,
          plugin: h.plugin,
        })),
        commands: commands.map((c) => ({
          name: c.name,
          description: c.description || '',
          handler: c.handler.name,
          plugin: c.plugin,
        })),
        logs,
        error: plugin.manifest.error,
      };
    } catch (error) {
      console.error(`Failed to get plugin info for ${name}:`, error);
      return null;
    }
  }

  /**
   * Load a plugin
   */
  async loadPlugin(name: string): Promise<LoadResult> {
    try {
      const plugin = this.pluginManager.getPlugin(name);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin "${name}" not found`,
        };
      }

      if (plugin.state === PluginState.LOADED) {
        return {
          success: true,
          plugin,
          warnings: ['Plugin already loaded'],
        };
      }

      const loaded = await this.pluginManager.loadPlugin(name);
      
      if (!loaded) {
        return {
          success: false,
          error: `Failed to load plugin "${name}"`,
        };
      }

      return {
        success: true,
        plugin: this.pluginManager.getPlugin(name) || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = this.pluginManager.getPlugin(name);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin "${name}" not found`,
        };
      }

      if (plugin.state !== PluginState.LOADED) {
        return {
          success: false,
          error: `Plugin "${name}" is not loaded`,
        };
      }

      await this.pluginManager.unloadPlugin(name);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.pluginManager.getPlugin(name)) {
        return {
          success: false,
          error: `Plugin "${name}" not found`,
        };
      }

      await this.pluginManager.enablePlugin(name);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.pluginManager.getPlugin(name)) {
        return {
          success: false,
          error: `Plugin "${name}" not found`,
        };
      }

      await this.pluginManager.disablePlugin(name);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get plugin hooks
   */
  async getPluginHooks(name: string): Promise<HookInfo[]> {
    try {
      const hooks = this.pluginManager.getPluginHooks(name);
      return hooks.map((h) => ({
        event: h.event,
        handler: h.handler.name,
        priority: h.priority,
        plugin: h.plugin,
      }));
    } catch (error) {
      console.error(`Failed to get hooks for plugin ${name}:`, error);
      return [];
    }
  }

  /**
   * Get plugin commands
   */
  async getPluginCommands(name: string): Promise<CommandInfo[]> {
    try {
      const commands = this.pluginManager.getPluginCommands(name);
      return commands.map((c) => ({
        name: c.name,
        description: c.description || '',
        handler: c.handler.name,
        plugin: c.plugin,
      }));
    } catch (error) {
      console.error(`Failed to get commands for plugin ${name}:`, error);
      return [];
    }
  }

  /**
   * Get plugin logs
   */
  async getPluginLogs(name: string): Promise<LogEntry[]> {
    try {
      return this.pluginManager.getPluginLogs(name);
    } catch (error) {
      console.error(`Failed to get logs for plugin ${name}:`, error);
      return [];
    }
  }

  /**
   * Install plugin from file path
   */
  async installPlugin(pluginPath: string): Promise<InstallResult> {
    try {
      // Validate path
      if (!pluginPath || pluginPath.trim().length === 0) {
        return {
          success: false,
          error: 'Plugin path is required',
        };
      }

      // In production, this would:
      // 1. Validate plugin structure
      // 2. Copy to plugins directory
      // 3. Load manifest
      // 4. Register hooks and commands
      
      // For now, return placeholder result
      return {
        success: true,
        pluginPath,
        warnings: ['Plugin installation is in development'],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(name: string): Promise<{ success: boolean; error?: string }> {
    try {
      const plugin = this.pluginManager.getPlugin(name);
      if (!plugin) {
        return {
          success: false,
          error: `Plugin "${name}" not found`,
        };
      }

      // Unload if loaded
      if (plugin.state === PluginState.LOADED) {
        await this.pluginManager.unloadPlugin(name);
      }

      // In production, this would remove plugin files
      // For now, just remove from registry
      this.pluginManager.removePlugin(name);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert LoadedPlugin to PluginListItem
   */
  private toPluginListItem(plugin: LoadedPlugin): PluginListItem {
    const hooks = this.pluginManager.getPluginHooks(plugin.name);
    const commands = this.pluginManager.getPluginCommands(plugin.name);
    
    return {
      name: plugin.name,
      description: plugin.manifest.description,
      version: plugin.manifest.version,
      author: plugin.manifest.author,
      enabled: this.pluginManager.isPluginEnabled(plugin.name),
      loaded: plugin.state === PluginState.LOADED,
      state: plugin.state,
      path: plugin.path,
      hooks: hooks.map((h) => h.event),
      commands: commands.map((c) => c.name),
      hasErrors: !!plugin.manifest.error,
      error: plugin.manifest.error,
    };
  }
}

/**
 * Factory function to create PluginService instance
 */
export function createPluginService(pluginManager: PluginManager): PluginService {
  return new PluginService(pluginManager);
}
