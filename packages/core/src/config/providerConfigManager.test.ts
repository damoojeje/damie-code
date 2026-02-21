/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProviderConfigManager, getProviderConfigManager } from './providerConfigManager.js';
import type { ProviderConfig } from './damieConfig.js';
import * as fs from 'node:fs';

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

// Mock config paths
vi.mock('./damieConfigLoader.js', () => ({
  getDamieConfigPath: () => '/mock/.damie/config.yaml',
  getDamieConfigDir: () => '/mock/.damie',
}));

describe('ProviderConfigManager', () => {
  let manager: ProviderConfigManager;
  const mockConfigPath = '/mock/.damie/config.yaml';
  const mockConfigDir = '/mock/.damie';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ProviderConfigManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadProviderConfig', () => {
    it('should return null if config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await manager.loadProviderConfig('deepseek');

      expect(result).toBeNull();
      expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
    });

    it('should return null if provider not configured', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('security:\n  auth:\n    selectedType: "qwen-oauth"\n');

      const result = await manager.loadProviderConfig('deepseek');

      expect(result).toBeNull();
    });

    it('should load provider config from file', async () => {
      const mockYaml = `security:
  auth:
    selectedType: "deepseek"

providers:
  deepseek:
    apiKey: "sk-test-key"
    model: "deepseek-chat"
    codingModel: "deepseek-coder"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const result = await manager.loadProviderConfig('deepseek');

      expect(result).toEqual({
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
        codingModel: 'deepseek-coder',
      });
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });

      const result = await manager.loadProviderConfig('deepseek');

      expect(result).toBeNull();
    });
  });

  describe('saveProviderConfig', () => {
    it('should create config directory if it does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const config: ProviderConfig = {
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      };

      await manager.saveProviderConfig('deepseek', config);

      expect(fs.mkdirSync).toHaveBeenCalledWith(mockConfigDir, { recursive: true });
    });

    it('should save provider config to file', async () => {
      vi.mocked(fs.existsSync)
        .mockReturnValueOnce(false)  // Config doesn't exist initially
        .mockReturnValueOnce(true);   // After creating dir

      const config: ProviderConfig = {
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
        codingModel: 'deepseek-coder',
        timeout: 30000,
      };

      await manager.saveProviderConfig('deepseek', config);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('deepseek:'),
        'utf-8',
      );
    });

    it('should update existing config if file exists', async () => {
      const existingYaml = `security:
  auth:
    selectedType: "qwen-oauth"

providers:
  qwen:
    model: "qwen3-coder"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(existingYaml);

      const config: ProviderConfig = {
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      };

      await manager.saveProviderConfig('deepseek', config);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('qwen:');
      expect(writtenContent).toContain('deepseek:');
    });

    it('should throw error on write failure', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('Write error');
      });

      const config: ProviderConfig = { apiKey: 'test' };

      await expect(manager.saveProviderConfig('deepseek', config))
        .rejects.toThrow('Failed to save provider configuration');
    });
  });

  describe('updateModelMapping', () => {
    it('should update coding model mapping', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await manager.updateModelMapping('deepseek', 'coding', 'deepseek-coder');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('codingModel: deepseek-coder');
    });

    it('should update reasoning model mapping', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await manager.updateModelMapping('anthropic', 'reasoning', 'claude-3-5-sonnet-20241022');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).toContain('reasoningModel: claude-3-5-sonnet-20241022');
    });
  });

  describe('validateConfig', () => {
    it('should return valid for config with API key', async () => {
      const config: ProviderConfig = {
        apiKey: 'sk-test-key',
        model: 'deepseek-chat',
      };

      const result = await manager.validateConfig('deepseek', config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for missing API key', async () => {
      const config: ProviderConfig = {
        model: 'deepseek-chat',
      };

      // Make sure env var is not set
      delete process.env['DEEPSEEK_API_KEY'];

      const result = await manager.validateConfig('deepseek', config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('API key required'))).toBe(true);
    });

    it('should return invalid for invalid timeout', async () => {
      const config: ProviderConfig = {
        apiKey: 'test',
        timeout: 500, // Too low
      };

      const result = await manager.validateConfig('deepseek', config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be at least 1000ms');
    });

    it('should warn for high timeout', async () => {
      const config: ProviderConfig = {
        apiKey: 'test',
        timeout: 400000, // > 5 minutes
      };

      const result = await manager.validateConfig('deepseek', config);

      expect(result.valid).toBe(true);
      expect(result.warnings.some(w => w.includes('unusually high'))).toBe(true);
    });

    it('should return invalid for invalid base URL', async () => {
      const config: ProviderConfig = {
        apiKey: 'test',
        baseUrl: 'not-a-valid-url',
      };

      const result = await manager.validateConfig('deepseek', config);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid base URL'))).toBe(true);
    });

    it('should not require API key for qwen', async () => {
      const config: ProviderConfig = {
        model: 'qwen3-coder',
      };

      const result = await manager.validateConfig('qwen', config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should not require API key for ollama', async () => {
      const config: ProviderConfig = {
        model: 'llama3.1',
      };

      const result = await manager.validateConfig('ollama', config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('loadAllProviders', () => {
    it('should load all provider configurations', async () => {
      const mockYaml = `providers:
  deepseek:
    apiKey: "sk-deepseek"
  openai:
    apiKey: "sk-openai"
  anthropic:
    apiKey: "sk-anthropic"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const result = await manager.loadAllProviders();

      expect(result.deepseek).toEqual({ apiKey: 'sk-deepseek' });
      expect(result.openai).toEqual({ apiKey: 'sk-openai' });
      expect(result.anthropic).toEqual({ apiKey: 'sk-anthropic' });
    });

    it('should return undefined for providers without config', async () => {
      const mockYaml = `providers:
  deepseek:
    apiKey: "sk-deepseek"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      const result = await manager.loadAllProviders();

      expect(result.deepseek).toBeDefined();
      expect(result.openai).toBeUndefined();
    });
  });

  describe('deleteProviderConfig', () => {
    it('should delete provider config from file', async () => {
      const mockYaml = `providers:
  deepseek:
    apiKey: "sk-deepseek"
  openai:
    apiKey: "sk-openai"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockYaml);

      await manager.deleteProviderConfig('deepseek');

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1] as string;
      expect(writtenContent).not.toContain('deepseek:');
      expect(writtenContent).toContain('openai:');
    });

    it('should do nothing if config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await manager.deleteProviderConfig('deepseek');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('backup and restore', () => {
    it('should create backup of config file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const backupPath = await manager.createBackup();

      expect(fs.copyFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        expect.stringContaining('.backup-'),
      );
      expect(backupPath).toContain('.backup-');
    });

    it('should return empty string if config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const backupPath = await manager.createBackup();

      expect(backupPath).toBe('');
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });

    it('should restore from backup', async () => {
      const backupPath = '/mock/.damie/config.yaml.backup-2024';
      vi.mocked(fs.existsSync).mockReturnValue(true);

      await manager.restoreFromBackup(backupPath);

      expect(fs.copyFileSync).toHaveBeenCalledWith(backupPath, mockConfigPath);
    });

    it('should throw error if backup file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(manager.restoreFromBackup('/nonexistent'))
        .rejects.toThrow('Backup file not found');
    });
  });

  describe('getProviderConfigManager (singleton)', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getProviderConfigManager();
      const instance2 = getProviderConfigManager();

      expect(instance1).toBe(instance2);
    });
  });
});
