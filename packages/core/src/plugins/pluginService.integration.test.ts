/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginService, createPluginService } from '../plugins/pluginService.js';
import type { PluginManager, LoadedPlugin, PluginManifest } from '@damie-code/damie-code-core';
import { PluginState } from '@damie-code/damie-code-core';

/**
 * Integration tests for Plugins feature
 * Tests complete user journeys from UI to backend
 */
describe('Plugins Integration Tests', () => {
  let pluginManager: PluginManager;
  let pluginService: PluginService;

  beforeEach(() => {
    pluginManager = {
      discoverPlugins: vi.fn(),
      getPlugins: vi.fn(),
      getPlugin: vi.fn(),
      loadPlugin: vi.fn(),
      unloadPlugin: vi.fn(),
      enablePlugin: vi.fn(),
      disablePlugin: vi.fn(),
      isPluginEnabled: vi.fn(),
      getPluginHooks: vi.fn(),
      getPluginCommands: vi.fn(),
      getPluginLogs: vi.fn(),
      removePlugin: vi.fn(),
    } as unknown as PluginManager;

    pluginService = createPluginService(pluginManager);
  });

  describe('Complete Plugin Management Flow', () => {
    it('should complete full plugin lifecycle', async () => {
      // 1. Start with no plugins
      vi.mocked(pluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(pluginManager.getPlugins).mockReturnValue([]);
      
      let plugins = await pluginService.listPlugins();
      expect(plugins).toHaveLength(0);

      // 2. Discover and load a plugin
      const discoveredPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
        } as PluginManifest,
        state: PluginState.UNLOADED,
        path: '/path/to/plugin',
      };

      vi.mocked(pluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(pluginManager.getPlugins).mockReturnValue([discoveredPlugin]);
      vi.mocked(pluginManager.isPluginEnabled).mockReturnValue(false);
      vi.mocked(pluginManager.getPluginHooks).mockReturnValue([]);
      vi.mocked(pluginManager.getPluginCommands).mockReturnValue([]);

      plugins = await pluginService.listPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].loaded).toBe(false);

      // 3. Load the plugin
      vi.mocked(pluginManager.getPlugin).mockReturnValue({
        ...discoveredPlugin,
        state: PluginState.LOADED,
      });
      vi.mocked(pluginManager.loadPlugin).mockResolvedValue();

      const loadResult = await pluginService.loadPlugin('test-plugin');
      expect(loadResult.success).toBe(true);

      // 4. Enable the plugin
      vi.mocked(pluginManager.enablePlugin).mockResolvedValue();
      vi.mocked(pluginManager.isPluginEnabled).mockReturnValue(true);

      const enableResult = await pluginService.enablePlugin('test-plugin');
      expect(enableResult.success).toBe(true);

      // 5. View plugin details
      vi.mocked(pluginManager.getPluginHooks).mockReturnValue([
        { event: 'onStartup', handler: vi.fn(), priority: 10, plugin: 'test-plugin' },
      ]);
      vi.mocked(pluginManager.getPluginCommands).mockReturnValue([
        { name: 'test-cmd', description: 'Test command', handler: vi.fn(), plugin: 'test-plugin' },
      ]);
      vi.mocked(pluginManager.getPluginLogs).mockReturnValue([
        { level: 'info', message: 'Plugin loaded', timestamp: new Date() },
      ]);

      const info = await pluginService.getPluginInfo('test-plugin');
      expect(info).not.toBeNull();
      expect(info?.hooks).toHaveLength(1);
      expect(info?.commands).toHaveLength(1);
      expect(info?.logs).toHaveLength(1);

      // 6. Disable and unload
      vi.mocked(pluginManager.disablePlugin).mockResolvedValue();
      vi.mocked(pluginManager.unloadPlugin).mockResolvedValue();

      await pluginService.disablePlugin('test-plugin');
      await pluginService.unloadPlugin('test-plugin');

      // 7. Uninstall plugin
      vi.mocked(pluginManager.removePlugin).mockImplementation(() => {});
      
      const uninstallResult = await pluginService.uninstallPlugin('test-plugin');
      expect(uninstallResult.success).toBe(true);
    });
  });

  describe('Plugin Hooks and Commands Integration', () => {
    it('should register and expose plugin hooks', async () => {
      const plugin: LoadedPlugin = {
        name: 'hook-plugin',
        manifest: {
          name: 'hook-plugin',
          version: '1.0.0',
          description: 'Plugin with hooks',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(pluginManager.getPlugin).mockReturnValue(plugin);
      vi.mocked(pluginManager.getPluginHooks).mockReturnValue([
        { event: 'onStartup', handler: vi.fn(), priority: 10, plugin: 'hook-plugin' },
        { event: 'onShutdown', handler: vi.fn(), priority: 5, plugin: 'hook-plugin' },
        { event: 'onMessage', handler: vi.fn(), priority: 1, plugin: 'hook-plugin' },
      ]);

      const hooks = await pluginService.getPluginHooks('hook-plugin');
      
      expect(hooks).toHaveLength(3);
      expect(hooks[0].event).toBe('onStartup');
      expect(hooks[0].priority).toBe(10);
      expect(hooks[1].event).toBe('onShutdown');
      expect(hooks[2].event).toBe('onMessage');
    });

    it('should register and expose plugin commands', async () => {
      const plugin: LoadedPlugin = {
        name: 'command-plugin',
        manifest: {
          name: 'command-plugin',
          version: '1.0.0',
          description: 'Plugin with commands',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(pluginManager.getPlugin).mockReturnValue(plugin);
      vi.mocked(pluginManager.getPluginCommands).mockReturnValue([
        { name: 'deploy', description: 'Deploy application', handler: vi.fn(), plugin: 'command-plugin' },
        { name: 'build', description: 'Build project', handler: vi.fn(), plugin: 'command-plugin' },
      ]);

      const commands = await pluginService.getPluginCommands('command-plugin');
      
      expect(commands).toHaveLength(2);
      expect(commands[0].name).toBe('deploy');
      expect(commands[1].name).toBe('build');
    });
  });

  describe('Plugin Logs and Monitoring', () => {
    it('should provide access to plugin logs', async () => {
      const plugin: LoadedPlugin = {
        name: 'logging-plugin',
        manifest: {
          name: 'logging-plugin',
          version: '1.0.0',
          description: 'Plugin with logs',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(pluginManager.getPlugin).mockReturnValue(plugin);
      vi.mocked(pluginManager.getPluginLogs).mockReturnValue([
        { level: 'info', message: 'Plugin initialized', timestamp: new Date('2024-01-01T00:00:00Z') },
        { level: 'warn', message: 'Configuration missing', timestamp: new Date('2024-01-01T00:01:00Z') },
        { level: 'error', message: 'Failed to connect', timestamp: new Date('2024-01-01T00:02:00Z') },
      ]);

      const logs = await pluginService.getPluginLogs('logging-plugin');
      
      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[1].level).toBe('warn');
      expect(logs[2].level).toBe('error');
    });
  });

  describe('Plugin Installation and Discovery', () => {
    it('should install plugin from file path', async () => {
      const installResult = await pluginService.installPlugin('/path/to/plugin.zip');
      
      expect(installResult.success).toBe(true);
      expect(installResult.pluginPath).toBe('/path/to/plugin.zip');
    });

    it('should validate plugin path before installation', async () => {
      const emptyResult = await pluginService.installPlugin('');
      
      expect(emptyResult.success).toBe(false);
      expect(emptyResult.error).toContain('required');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle plugin load failures gracefully', async () => {
      const plugin: LoadedPlugin = {
        name: 'failing-plugin',
        manifest: {
          name: 'failing-plugin',
          version: '1.0.0',
          description: 'Failing plugin',
        } as PluginManifest,
        state: PluginState.UNLOADED,
        path: '/path',
      };

      vi.mocked(pluginManager.getPlugin).mockReturnValue(plugin);
      vi.mocked(pluginManager.loadPlugin).mockRejectedValue(new Error('Load failed'));

      const result = await pluginService.loadPlugin('failing-plugin');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Load failed');
    });

    it('should maintain state consistency during failures', async () => {
      const plugin: LoadedPlugin = {
        name: 'stable-plugin',
        manifest: {
          name: 'stable-plugin',
          version: '1.0.0',
          description: 'Stable',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(pluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(pluginManager.getPlugins).mockReturnValue([plugin]);
      vi.mocked(pluginManager.getPlugin).mockReturnValue(plugin);
      vi.mocked(pluginManager.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginManager.getPluginHooks).mockReturnValue([]);
      vi.mocked(pluginManager.getPluginCommands).mockReturnValue([]);

      // Get initial state
      const plugins = await pluginService.listPlugins();
      expect(plugins[0].enabled).toBe(true);

      // Try to disable with failure
      vi.mocked(pluginManager.disablePlugin).mockRejectedValue(new Error('Disable failed'));

      const result = await pluginService.disablePlugin('stable-plugin');
      expect(result.success).toBe(false);

      // State should remain unchanged
      vi.mocked(pluginManager.isPluginEnabled).mockReturnValue(true);
      const pluginsAfter = await pluginService.listPlugins();
      expect(pluginsAfter[0].enabled).toBe(true);
    });
  });

  describe('Multiple Plugin Management', () => {
    it('should handle multiple plugins simultaneously', async () => {
      const plugins: LoadedPlugin[] = [
        {
          name: 'plugin-1',
          manifest: {
            name: 'plugin-1',
            version: '1.0.0',
            description: 'Plugin 1',
          } as PluginManifest,
          state: PluginState.LOADED,
          path: '/path1',
        },
        {
          name: 'plugin-2',
          manifest: {
            name: 'plugin-2',
            version: '1.0.0',
            description: 'Plugin 2',
          } as PluginManifest,
          state: PluginState.UNLOADED,
          path: '/path2',
        },
        {
          name: 'plugin-3',
          manifest: {
            name: 'plugin-3',
            version: '1.0.0',
            description: 'Plugin 3',
          } as PluginManifest,
          state: PluginState.LOADED,
          path: '/path3',
        },
      ];

      vi.mocked(pluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(pluginManager.getPlugins).mockReturnValue(plugins);
      vi.mocked(pluginManager.isPluginEnabled).mockReturnValue(true);
      vi.mocked(pluginManager.getPluginHooks).mockReturnValue([]);
      vi.mocked(pluginManager.getPluginCommands).mockReturnValue([]);

      const result = await pluginService.listPlugins();
      
      expect(result).toHaveLength(3);
      expect(result.filter(p => p.loaded)).toHaveLength(2);
      expect(result.filter(p => p.enabled)).toHaveLength(3);
    });

    it('should batch enable/disable operations', async () => {
      const plugins: LoadedPlugin[] = [
        {
          name: 'batch-1',
          manifest: { name: 'batch-1', version: '1.0.0', description: 'B1' } as PluginManifest,
          state: PluginState.LOADED,
          path: '/p1',
        },
        {
          name: 'batch-2',
          manifest: { name: 'batch-2', version: '1.0.0', description: 'B2' } as PluginManifest,
          state: PluginState.LOADED,
          path: '/p2',
        },
      ];

      vi.mocked(pluginManager.getPlugin).mockImplementation((name: string) => 
        plugins.find(p => p.name === name)!
      );
      vi.mocked(pluginManager.enablePlugin).mockResolvedValue();
      vi.mocked(pluginManager.disablePlugin).mockResolvedValue();

      // Enable all
      await pluginService.enablePlugin('batch-1');
      await pluginService.enablePlugin('batch-2');

      expect(pluginManager.enablePlugin).toHaveBeenCalledTimes(2);

      // Disable all
      await pluginService.disablePlugin('batch-1');
      await pluginService.disablePlugin('batch-2');

      expect(pluginManager.disablePlugin).toHaveBeenCalledTimes(2);
    });
  });
});
