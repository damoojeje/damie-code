/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProviderManager } from './providerManager.js';
import type { DamieConfig } from '../config/damieConfig.js';
import { AuthType } from '../core/contentGenerator.js';

// Mock fs module
vi.mock('node:fs');
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

describe('ProviderManager', () => {
  const mockConfigDir = '/home/testuser/.damie';
  const mockConfigPath = path.join(mockConfigDir, 'config.yaml');

  const mockConfig: DamieConfig = {
    security: {
      auth: {
        selectedType: AuthType.USE_DEEPSEEK,
      },
    },
    providers: {
      deepseek: {
        apiKey: 'test-deepseek-key',
        model: 'deepseek-chat',
        enabled: true,
        priority: 1,
      },
      openai: {
        apiKey: 'test-openai-key',
        model: 'gpt-4',
        enabled: true,
        priority: 2,
      },
      ollama: {
        baseUrl: 'http://localhost:11434',
        enabled: false,
        priority: 3,
      },
    },
  };

  const mockConfigYaml = `
security:
  auth:
    selectedType: "deepseek"

providers:
  deepseek:
    apiKey: "test-deepseek-key"
    model: "deepseek-chat"
    enabled: true
    priority: 1
  openai:
    apiKey: "test-openai-key"
    model: "gpt-4"
    enabled: true
    priority: 2
  ollama:
    baseUrl: "http://localhost:11434"
    enabled: false
    priority: 3
`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fs.existsSync to return true for config path
    vi.mocked(fs.existsSync).mockImplementation((p) => p === mockConfigPath);
    // Mock fs.readFileSync to return config YAML
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      if (p === mockConfigPath) {
        return mockConfigYaml;
      }
      throw new Error(`File not found: ${p}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a ProviderManager with provided config', () => {
      const manager = new ProviderManager(mockConfig);
      expect(manager.getConfig()).toEqual(mockConfig);
    });

    it('should create a ProviderManager without config', () => {
      const manager = new ProviderManager();
      expect(manager.getConfig()).not.toBeNull();
    });
  });

  describe('getConfiguredProviders', () => {
    it('should return all providers with status', () => {
      const manager = new ProviderManager(mockConfig);
      const providers = manager.getConfiguredProviders();

      expect(providers.length).toBe(6); // All 6 providers

      const deepseek = providers.find((p) => p.name === 'deepseek');
      expect(deepseek?.configured).toBe(true);
      expect(deepseek?.enabled).toBe(true);
      expect(deepseek?.isDefault).toBe(true);
      expect(deepseek?.priority).toBe(1);

      const openai = providers.find((p) => p.name === 'openai');
      expect(openai?.configured).toBe(true);
      expect(openai?.enabled).toBe(true);
      expect(openai?.isDefault).toBe(false);

      const anthropic = providers.find((p) => p.name === 'anthropic');
      expect(anthropic?.configured).toBe(false);
    });
  });

  describe('getActiveProviders', () => {
    it('should return only configured providers', () => {
      const manager = new ProviderManager(mockConfig);
      const active = manager.getActiveProviders();

      expect(active.length).toBe(3);
      expect(active.map((p) => p.name)).toContain('deepseek');
      expect(active.map((p) => p.name)).toContain('openai');
      expect(active.map((p) => p.name)).toContain('ollama');
    });
  });

  describe('getAvailableProviders', () => {
    it('should return only enabled providers with API keys', () => {
      const manager = new ProviderManager(mockConfig);
      const available = manager.getAvailableProviders();

      // deepseek, openai have keys; ollama is disabled
      expect(available.length).toBe(2);
      expect(available.map((p) => p.name)).toContain('deepseek');
      expect(available.map((p) => p.name)).toContain('openai');
    });
  });

  describe('getDefaultProvider', () => {
    it('should return the default provider AuthType', () => {
      const manager = new ProviderManager(mockConfig);
      const defaultProvider = manager.getDefaultProvider();

      expect(defaultProvider).toBe('deepseek');
    });
  });

  describe('isProviderConfigured', () => {
    it('should return true for configured providers', () => {
      const manager = new ProviderManager(mockConfig);

      expect(manager.isProviderConfigured('deepseek')).toBe(true);
      expect(manager.isProviderConfigured('openai')).toBe(true);
      expect(manager.isProviderConfigured('ollama')).toBe(true);
    });

    it('should return false for unconfigured providers', () => {
      const manager = new ProviderManager(mockConfig);

      expect(manager.isProviderConfigured('anthropic')).toBe(false);
      expect(manager.isProviderConfigured('openrouter')).toBe(false);
    });
  });

  describe('getProviderConfig', () => {
    it('should return provider config for configured providers', () => {
      const manager = new ProviderManager(mockConfig);
      const config = manager.getProviderConfig('deepseek');

      expect(config).toBeDefined();
      expect(config?.apiKey).toBe('test-deepseek-key');
      expect(config?.model).toBe('deepseek-chat');
    });

    it('should return undefined for unconfigured providers', () => {
      const manager = new ProviderManager(mockConfig);
      const config = manager.getProviderConfig('anthropic');

      expect(config).toBeUndefined();
    });
  });

  describe('getProvidersByPriority', () => {
    it('should return providers sorted by priority', () => {
      const manager = new ProviderManager(mockConfig);
      const sorted = manager.getProvidersByPriority();

      // Only enabled providers with API keys
      expect(sorted.length).toBe(2);
      expect(sorted[0].name).toBe('deepseek'); // priority 1
      expect(sorted[1].name).toBe('openai'); // priority 2
    });
  });

  describe('static methods', () => {
    it('authTypeToProvider should map correctly', () => {
      expect(ProviderManager.authTypeToProvider(AuthType.USE_DEEPSEEK)).toBe('deepseek');
      expect(ProviderManager.authTypeToProvider(AuthType.USE_OPENAI)).toBe('openai');
      expect(ProviderManager.authTypeToProvider(AuthType.QWEN_OAUTH)).toBe('qwen');
    });

    it('providerToAuthType should map correctly', () => {
      expect(ProviderManager.providerToAuthType('deepseek')).toBe('deepseek');
      expect(ProviderManager.providerToAuthType('qwen')).toBe('qwen-oauth');
    });

    it('getDisplayName should return human-readable names', () => {
      expect(ProviderManager.getDisplayName('deepseek')).toBe('DeepSeek');
      expect(ProviderManager.getDisplayName('openai')).toBe('OpenAI');
      expect(ProviderManager.getDisplayName('ollama')).toBe('Ollama (Local)');
    });

    it('isValidProvider should validate provider names', () => {
      expect(ProviderManager.isValidProvider('deepseek')).toBe(true);
      expect(ProviderManager.isValidProvider('openai')).toBe(true);
      expect(ProviderManager.isValidProvider('invalid')).toBe(false);
    });

    it('getValidProviderNames should return all providers', () => {
      const names = ProviderManager.getValidProviderNames();
      expect(names).toContain('deepseek');
      expect(names).toContain('openai');
      expect(names).toContain('anthropic');
      expect(names).toContain('openrouter');
      expect(names).toContain('ollama');
      expect(names).toContain('qwen');
    });
  });
});

describe('Provider config helpers', () => {
  describe('getConfiguredProviders', () => {
    it('should return empty array for null config', () => {
      const manager = new ProviderManager();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const providers = manager.getConfiguredProviders();
      // Returns all providers with configured: false
      expect(providers.every((p) => !p.configured)).toBe(true);
    });
  });
});
