/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginService, createPluginService } from './pluginService.js';
import type { PluginManager, LoadedPlugin, PluginManifest } from '@damie-code/damie-code-core';
import { PluginState } from '@damie-code/damie-code-core';

// Mock PluginManager
const mockPluginManager = {
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

describe('PluginService', () => {
  let service: PluginService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createPluginService(mockPluginManager);
  });

  describe('listPlugins', () => {
    it('should return empty array when no plugins found', async () => {
      vi.mocked(mockPluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(mockPluginManager.getPlugins).mockReturnValue([]);

      const result = await service.listPlugins();

      expect(result).toEqual([]);
      expect(mockPluginManager.discoverPlugins).toHaveBeenCalled();
    });

    it('should return list of plugins with UI-friendly formatting', async () => {
      const mockPlugins: LoadedPlugin[] = [
        {
          name: 'test-plugin',
          manifest: {
            name: 'test-plugin',
            version: '1.0.0',
            description: 'Test plugin',
            author: 'Test Author',
          } as PluginManifest,
          state: PluginState.LOADED,
          path: '/path/to/plugin',
        },
      ];

      vi.mocked(mockPluginManager.discoverPlugins).mockImplementation(() => {});
      vi.mocked(mockPluginManager.getPlugins).mockReturnValue(mockPlugins);
      vi.mocked(mockPluginManager.isPluginEnabled).mockReturnValue(true);
      vi.mocked(mockPluginManager.getPluginHooks).mockReturnValue([]);
      vi.mocked(mockPluginManager.getPluginCommands).mockReturnValue([]);

      const result = await service.listPlugins();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        name: 'test-plugin',
        description: 'Test plugin',
        version: '1.0.0',
        author: 'Test Author',
        enabled: true,
        loaded: true,
        state: PluginState.LOADED,
        path: '/path/to/plugin',
        hooks: [],
        commands: [],
        hasErrors: false,
        error: undefined,
      });
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockPluginManager.discoverPlugins).mockImplementation(() => {
        throw new Error('Failed to discover plugins');
      });

      const result = await service.listPlugins();

      expect(result).toEqual([]);
    });
  });

  describe('getPluginInfo', () => {
    it('should return plugin info with hooks and commands', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path/to/plugin',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.getPluginHooks).mockReturnValue([
        { event: 'onStartup', handler: vi.fn(), priority: 10, plugin: 'test-plugin' },
      ]);
      vi.mocked(mockPluginManager.getPluginCommands).mockReturnValue([
        { name: 'test-cmd', description: 'Test command', handler: vi.fn(), plugin: 'test-plugin' },
      ]);
      vi.mocked(mockPluginManager.getPluginLogs).mockReturnValue([]);
      vi.mocked(mockPluginManager.isPluginEnabled).mockReturnValue(true);

      const result = await service.getPluginInfo('test-plugin');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test-plugin');
      expect(result?.hooks).toHaveLength(1);
      expect(result?.commands).toHaveLength(1);
    });

    it('should return null if plugin not found', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(undefined);

      const result = await service.getPluginInfo('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockImplementation(() => {
        throw new Error('Failed to get plugin');
      });

      const result = await service.getPluginInfo('test');

      expect(result).toBeNull();
    });
  });

  describe('loadPlugin', () => {
    it('should load plugin successfully', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.UNLOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.loadPlugin).mockResolvedValue(true);
      vi.mocked(mockPluginManager.getPlugin).mockReturnValueOnce(mockPlugin);

      const result = await service.loadPlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockPluginManager.loadPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should return warning if plugin already loaded', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);

      const result = await service.loadPlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Plugin already loaded');
    });

    it('should fail if plugin not found', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(undefined);

      const result = await service.loadPlugin('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('unloadPlugin', () => {
    it('should unload plugin successfully', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.unloadPlugin).mockResolvedValue();

      const result = await service.unloadPlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockPluginManager.unloadPlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should fail if plugin not loaded', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.UNLOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);

      const result = await service.unloadPlugin('test-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not loaded');
    });
  });

  describe('enablePlugin', () => {
    it('should enable plugin successfully', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.enablePlugin).mockResolvedValue();

      const result = await service.enablePlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockPluginManager.enablePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should fail if plugin not found', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(undefined);

      const result = await service.enablePlugin('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('disablePlugin', () => {
    it('should disable plugin successfully', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.LOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.disablePlugin).mockResolvedValue();

      const result = await service.disablePlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockPluginManager.disablePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should fail if plugin not found', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(undefined);

      const result = await service.disablePlugin('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getPluginHooks', () => {
    it('should return plugin hooks', async () => {
      const mockHooks = [
        { event: 'onStartup', handler: vi.fn(), priority: 10, plugin: 'test-plugin' },
        { event: 'onShutdown', handler: vi.fn(), priority: 5, plugin: 'test-plugin' },
      ];

      vi.mocked(mockPluginManager.getPluginHooks).mockReturnValue(mockHooks);

      const result = await service.getPluginHooks('test-plugin');

      expect(result).toHaveLength(2);
      expect(result[0].event).toBe('onStartup');
    });

    it('should return empty array on error', async () => {
      vi.mocked(mockPluginManager.getPluginHooks).mockImplementation(() => {
        throw new Error('Failed to get hooks');
      });

      const result = await service.getPluginHooks('test');

      expect(result).toEqual([]);
    });
  });

  describe('getPluginCommands', () => {
    it('should return plugin commands', async () => {
      const mockCommands = [
        { name: 'cmd1', description: 'Command 1', handler: vi.fn(), plugin: 'test-plugin' },
        { name: 'cmd2', description: 'Command 2', handler: vi.fn(), plugin: 'test-plugin' },
      ];

      vi.mocked(mockPluginManager.getPluginCommands).mockReturnValue(mockCommands);

      const result = await service.getPluginCommands('test-plugin');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('cmd1');
    });

    it('should return empty array on error', async () => {
      vi.mocked(mockPluginManager.getPluginCommands).mockImplementation(() => {
        throw new Error('Failed to get commands');
      });

      const result = await service.getPluginCommands('test');

      expect(result).toEqual([]);
    });
  });

  describe('getPluginLogs', () => {
    it('should return plugin logs', async () => {
      const mockLogs = [
        { level: 'info', message: 'Plugin loaded', timestamp: new Date() },
      ];

      vi.mocked(mockPluginManager.getPluginLogs).mockReturnValue(mockLogs);

      const result = await service.getPluginLogs('test-plugin');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Plugin loaded');
    });

    it('should return empty array on error', async () => {
      vi.mocked(mockPluginManager.getPluginLogs).mockImplementation(() => {
        throw new Error('Failed to get logs');
      });

      const result = await service.getPluginLogs('test');

      expect(result).toEqual([]);
    });
  });

  describe('installPlugin', () => {
    it('should install plugin successfully', async () => {
      const result = await service.installPlugin('/path/to/plugin');

      expect(result.success).toBe(true);
      expect(result.pluginPath).toBe('/path/to/plugin');
    });

    it('should fail with empty path', async () => {
      const result = await service.installPlugin('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('uninstallPlugin', () => {
    it('should uninstall plugin successfully', async () => {
      const mockPlugin: LoadedPlugin = {
        name: 'test-plugin',
        manifest: {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test',
        } as PluginManifest,
        state: PluginState.UNLOADED,
        path: '/path',
      };

      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(mockPlugin);
      vi.mocked(mockPluginManager.removePlugin).mockImplementation(() => {});

      const result = await service.uninstallPlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockPluginManager.removePlugin).toHaveBeenCalledWith('test-plugin');
    });

    it('should fail if plugin not found', async () => {
      vi.mocked(mockPluginManager.getPlugin).mockReturnValue(undefined);

      const result = await service.uninstallPlugin('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});

describe('createPluginService', () => {
  it('should create PluginService instance', () => {
    const service = createPluginService(mockPluginManager);

    expect(service).toBeInstanceOf(PluginService);
  });

  it('should create same instance type with same manager', () => {
    const service1 = createPluginService(mockPluginManager);
    const service2 = createPluginService(mockPluginManager);

    expect(service1).toEqual(service2);
  });
});
