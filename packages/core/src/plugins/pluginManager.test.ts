/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PluginManager, createPluginManager } from './pluginManager.js';
import { PluginState, PluginEvent } from './types.js';

describe('PluginManager', () => {
  let manager: PluginManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-manager-test-'));
    manager = new PluginManager({ pluginsPath: tempDir, autoLoad: false });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a plugin directory with manifest
   */
  function createPluginDir(
    name: string,
    manifest?: Record<string, unknown>
  ): string {
    const pluginDir = path.join(tempDir, name);
    fs.mkdirSync(pluginDir, { recursive: true });

    const defaultManifest = {
      name,
      version: '1.0.0',
      description: `Test plugin: ${name}`,
      ...manifest,
    };

    fs.writeFileSync(
      path.join(pluginDir, 'manifest.json'),
      JSON.stringify(defaultManifest, null, 2)
    );

    return pluginDir;
  }

  describe('initialization', () => {
    it('should create plugins directory', () => {
      expect(fs.existsSync(tempDir)).toBe(true);
    });

    it('should start with no plugins when autoLoad is false', () => {
      expect(manager.listPlugins()).toHaveLength(0);
    });
  });

  describe('discoverPlugins', () => {
    it('should discover plugins in directory', () => {
      createPluginDir('plugin1');
      createPluginDir('plugin2');

      manager.discoverPlugins();

      expect(manager.listPlugins()).toHaveLength(2);
    });

    it('should read manifest correctly', () => {
      createPluginDir('my-plugin', {
        name: 'my-plugin',
        version: '2.0.0',
        description: 'My test plugin',
      });

      manager.discoverPlugins();

      const plugin = manager.getPlugin('my-plugin');
      expect(plugin?.manifest.version).toBe('2.0.0');
    });
  });

  describe('listPlugins', () => {
    beforeEach(() => {
      createPluginDir('alpha');
      createPluginDir('beta');
      createPluginDir('gamma');
      manager.discoverPlugins();
    });

    it('should return sorted list', () => {
      const plugins = manager.listPlugins();
      const names = plugins.map((p) => p.name);

      expect(names).toEqual(['alpha', 'beta', 'gamma']);
    });
  });

  describe('getPlugin', () => {
    beforeEach(() => {
      createPluginDir('test-plugin');
      manager.discoverPlugins();
    });

    it('should return plugin by name', () => {
      const plugin = manager.getPlugin('test-plugin');

      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe('test-plugin');
    });

    it('should return undefined for non-existent', () => {
      expect(manager.getPlugin('nonexistent')).toBeUndefined();
    });
  });

  describe('loadPlugin', () => {
    beforeEach(() => {
      createPluginDir('loadable');
      manager.discoverPlugins();
    });

    it('should load plugin', async () => {
      const result = await manager.loadPlugin('loadable');

      expect(result).toBe(true);
      expect(manager.isLoaded('loadable')).toBe(true);
    });

    it('should set loadedAt timestamp', async () => {
      await manager.loadPlugin('loadable');

      const plugin = manager.getPlugin('loadable');
      expect(plugin?.loadedAt).toBeDefined();
    });

    it('should throw for non-existent plugin', async () => {
      await expect(manager.loadPlugin('nonexistent')).rejects.toThrow(
        'not found'
      );
    });

    it('should emit plugin:loaded event', async () => {
      let emitted = false;
      manager.on('plugin:loaded', () => {
        emitted = true;
      });

      await manager.loadPlugin('loadable');
      expect(emitted).toBe(true);
    });
  });

  describe('unloadPlugin', () => {
    beforeEach(async () => {
      createPluginDir('unloadable');
      manager.discoverPlugins();
      await manager.loadPlugin('unloadable');
    });

    it('should unload plugin', async () => {
      const result = await manager.unloadPlugin('unloadable');

      expect(result).toBe(true);
      expect(manager.isLoaded('unloadable')).toBe(false);
    });

    it('should emit plugin:unloaded event', async () => {
      let emitted = false;
      manager.on('plugin:unloaded', () => {
        emitted = true;
      });

      await manager.unloadPlugin('unloadable');
      expect(emitted).toBe(true);
    });

    it('should return false for non-existent', async () => {
      expect(await manager.unloadPlugin('nonexistent')).toBe(false);
    });
  });

  describe('enablePlugin', () => {
    beforeEach(() => {
      createPluginDir('enableable');
      manager.discoverPlugins();
    });

    it('should enable plugin', async () => {
      await manager.enablePlugin('enableable');

      expect(manager.isEnabled('enableable')).toBe(true);
    });

    it('should load plugin if not loaded', async () => {
      await manager.enablePlugin('enableable');

      expect(manager.isLoaded('enableable')).toBe(true);
    });

    it('should set enabledAt timestamp', async () => {
      await manager.enablePlugin('enableable');

      const plugin = manager.getPlugin('enableable');
      expect(plugin?.enabledAt).toBeDefined();
    });

    it('should emit plugin:enabled event', async () => {
      let emitted = false;
      manager.on('plugin:enabled', () => {
        emitted = true;
      });

      await manager.enablePlugin('enableable');
      expect(emitted).toBe(true);
    });
  });

  describe('disablePlugin', () => {
    beforeEach(async () => {
      createPluginDir('disableable');
      manager.discoverPlugins();
      await manager.enablePlugin('disableable');
    });

    it('should disable plugin', async () => {
      const result = await manager.disablePlugin('disableable');

      expect(result).toBe(true);
      expect(manager.isEnabled('disableable')).toBe(false);
    });

    it('should emit plugin:disabled event', async () => {
      let emitted = false;
      manager.on('plugin:disabled', () => {
        emitted = true;
      });

      await manager.disablePlugin('disableable');
      expect(emitted).toBe(true);
    });
  });

  describe('executeHooks', () => {
    it('should return empty array when no hooks', async () => {
      const results = await manager.executeHooks(PluginEvent.BEFORE_GENERATE);

      expect(results).toHaveLength(0);
    });
  });

  describe('installPlugin', () => {
    let sourceDir: string;

    beforeEach(() => {
      sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'source-plugin-'));

      const manifest = {
        name: 'installable',
        version: '1.0.0',
        description: 'Test installable plugin',
      };
      fs.writeFileSync(
        path.join(sourceDir, 'manifest.json'),
        JSON.stringify(manifest)
      );
      fs.writeFileSync(path.join(sourceDir, 'index.js'), 'module.exports = {}');
    });

    afterEach(() => {
      try {
        fs.rmSync(sourceDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should install plugin from path', async () => {
      const plugin = await manager.installPlugin(sourceDir);

      expect(plugin.name).toBe('installable');
      expect(manager.getPlugin('installable')).toBeDefined();
    });

    it('should copy files to plugins directory', async () => {
      await manager.installPlugin(sourceDir);

      const installedPath = path.join(tempDir, 'installable');
      expect(fs.existsSync(installedPath)).toBe(true);
      expect(fs.existsSync(path.join(installedPath, 'index.js'))).toBe(true);
    });

    it('should throw if no manifest', async () => {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-'));

      await expect(manager.installPlugin(emptyDir)).rejects.toThrow(
        'No manifest.json found'
      );

      fs.rmSync(emptyDir, { recursive: true, force: true });
    });
  });

  describe('removePlugin', () => {
    beforeEach(() => {
      createPluginDir('removable');
      manager.discoverPlugins();
    });

    it('should remove plugin', async () => {
      const result = await manager.removePlugin('removable');

      expect(result).toBe(true);
      expect(manager.getPlugin('removable')).toBeUndefined();
    });

    it('should delete plugin directory', async () => {
      const pluginPath = path.join(tempDir, 'removable');
      expect(fs.existsSync(pluginPath)).toBe(true);

      await manager.removePlugin('removable');

      expect(fs.existsSync(pluginPath)).toBe(false);
    });

    it('should emit plugin:removed event', async () => {
      let emitted = false;
      manager.on('plugin:removed', () => {
        emitted = true;
      });

      await manager.removePlugin('removable');
      expect(emitted).toBe(true);
    });

    it('should return false for non-existent', async () => {
      expect(await manager.removePlugin('nonexistent')).toBe(false);
    });
  });

  describe('getPluginSettings/setPluginSettings', () => {
    beforeEach(() => {
      createPluginDir('settings-plugin');
      manager.discoverPlugins();
    });

    it('should set and get settings', () => {
      manager.setPluginSettings('settings-plugin', { key: 'value' });

      const settings = manager.getPluginSettings('settings-plugin');
      expect(settings?.['key']).toBe('value');
    });

    it('should merge settings', () => {
      manager.setPluginSettings('settings-plugin', { key1: 'value1' });
      manager.setPluginSettings('settings-plugin', { key2: 'value2' });

      const settings = manager.getPluginSettings('settings-plugin');
      expect(settings?.['key1']).toBe('value1');
      expect(settings?.['key2']).toBe('value2');
    });

    it('should return undefined for non-existent plugin', () => {
      expect(manager.getPluginSettings('nonexistent')).toBeUndefined();
    });
  });

  describe('getEnabledPlugins', () => {
    beforeEach(async () => {
      createPluginDir('enabled1');
      createPluginDir('enabled2');
      createPluginDir('disabled1');
      manager.discoverPlugins();
      await manager.enablePlugin('enabled1');
      await manager.enablePlugin('enabled2');
    });

    it('should return only enabled plugins', () => {
      const enabled = manager.getEnabledPlugins();

      expect(enabled).toHaveLength(2);
      expect(enabled.every((p) => p.state === PluginState.ENABLED)).toBe(true);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      createPluginDir('stat1');
      createPluginDir('stat2');
      createPluginDir('stat3');
      manager.discoverPlugins();
      await manager.enablePlugin('stat1');
      await manager.loadPlugin('stat2');
    });

    it('should return correct statistics', () => {
      const stats = manager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(1);
      expect(stats.loaded).toBe(2); // enabled + loaded
    });
  });

  describe('createPluginContext', () => {
    beforeEach(() => {
      createPluginDir('context-plugin');
      manager.discoverPlugins();
    });

    it('should create valid context', () => {
      const context = manager.createPluginContext('context-plugin');

      expect(context.workingDirectory).toBeDefined();
      expect(context.logger).toBeDefined();
      expect(context.api).toBeDefined();
    });

    it('should have working logger', () => {
      const context = manager.createPluginContext('context-plugin');

      // Should not throw
      context.logger.debug('test');
      context.logger.info('test');
      context.logger.warn('test');
      context.logger.error('test');
    });
  });
});

describe('createPluginManager', () => {
  it('should create manager with factory function', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-factory-'));
    const manager = createPluginManager({
      pluginsPath: tempDir,
      autoLoad: false,
    });

    expect(manager).toBeInstanceOf(PluginManager);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
