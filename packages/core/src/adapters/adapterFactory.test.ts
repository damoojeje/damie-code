/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAdapter,
  getAdapterFromConfig,
  getDefaultAdapter,
  getAvailableAdapters,
  clearAdapterCache,
  getProviderStatuses,
  getRegisteredProviders,
} from './adapterFactory.js';
import { AuthType } from '../core/contentGenerator.js';
import type { DamieConfig } from '../config/damieConfig.js';

// Mock the config loader
vi.mock('../config/damieConfigLoader.js', () => ({
  loadDamieConfig: vi.fn(),
}));

import { loadDamieConfig } from '../config/damieConfigLoader.js';

const mockLoadDamieConfig = vi.mocked(loadDamieConfig);

// Helper to create minimal valid config
function createMockConfig(overrides: Partial<DamieConfig> = {}): DamieConfig {
  return {
    security: {
      auth: { selectedType: AuthType.USE_OPENAI },
    },
    ...overrides,
  };
}

describe('adapterFactory', () => {
  beforeEach(() => {
    clearAdapterCache();
    vi.clearAllMocks();
  });

  describe('getAdapter', () => {
    it('should create an adapter for a registered provider', () => {
      const adapter = getAdapter('openai', { apiKey: 'test-key' });
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe('openai');
    });

    it('should cache adapter instances', () => {
      const adapter1 = getAdapter('openai', { apiKey: 'test-key' });
      const adapter2 = getAdapter('openai', { apiKey: 'test-key' });
      expect(adapter1).toBe(adapter2);
    });

    it('should create different instances for different configs', () => {
      const adapter1 = getAdapter('openai', { apiKey: 'key1' });
      const adapter2 = getAdapter('openai', { apiKey: 'key2' });
      expect(adapter1).not.toBe(adapter2);
    });

    it('should force new instance when forceNew is true', () => {
      const adapter1 = getAdapter('openai', { apiKey: 'test-key' });
      const adapter2 = getAdapter('openai', { apiKey: 'test-key' }, true);
      expect(adapter1).not.toBe(adapter2);
    });

    it('should throw for unregistered provider', () => {
      expect(() => getAdapter('unknown-provider')).toThrow();
    });

    it('should create adapters for all registered providers', () => {
      const providers = ['deepseek', 'openai', 'anthropic', 'openrouter', 'ollama'];
      for (const provider of providers) {
        const adapter = getAdapter(provider, { apiKey: 'test-key' });
        expect(adapter).toBeDefined();
        expect(adapter.provider).toBe(provider);
      }
    });
  });

  describe('getAdapterFromConfig', () => {
    it('should throw when no config exists', () => {
      mockLoadDamieConfig.mockReturnValue(null);
      expect(() => getAdapterFromConfig('openai')).toThrow('No Damie configuration found');
    });

    it('should create adapter with config apiKey', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: {
            enabled: true,
            apiKey: 'config-api-key',
          },
        },
      }));

      const adapter = getAdapterFromConfig('openai');
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe('openai');
    });

    it('should use env var when config apiKey is not set', () => {
      const originalEnv = process.env['OPENAI_API_KEY'];
      process.env['OPENAI_API_KEY'] = 'env-api-key';

      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: { enabled: true },
        },
      }));

      const adapter = getAdapterFromConfig('openai');
      expect(adapter).toBeDefined();

      process.env['OPENAI_API_KEY'] = originalEnv;
    });

    it('should apply baseUrl from config', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: {
            enabled: true,
            apiKey: 'test-key',
            baseUrl: 'https://custom.openai.com',
          },
        },
      }));

      const adapter = getAdapterFromConfig('openai');
      expect(adapter).toBeDefined();
    });
  });

  describe('getDefaultAdapter', () => {
    it('should throw when no config exists', () => {
      mockLoadDamieConfig.mockReturnValue(null);
      expect(() => getDefaultAdapter()).toThrow('No Damie configuration found');
    });

    it('should return adapter for selected auth type', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        security: {
          auth: { selectedType: AuthType.USE_DEEPSEEK },
        },
        providers: {
          deepseek: {
            enabled: true,
            apiKey: 'test-key',
          },
        },
      }));

      const adapter = getDefaultAdapter();
      expect(adapter).toBeDefined();
      expect(adapter.provider).toBe('deepseek');
    });

    it('should throw for unknown auth type', () => {
      mockLoadDamieConfig.mockReturnValue({
        security: {
          auth: { selectedType: 'unknown-type' as AuthType },
        },
      });

      expect(() => getDefaultAdapter()).toThrow('Unknown auth type');
    });

    it('should handle ollama auth type', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        security: {
          auth: { selectedType: AuthType.USE_OLLAMA },
        },
        providers: {
          ollama: { enabled: true },
        },
      }));

      const adapter = getDefaultAdapter();
      expect(adapter.provider).toBe('ollama');
    });
  });

  describe('getAvailableAdapters', () => {
    it('should return empty array when no config exists', () => {
      mockLoadDamieConfig.mockReturnValue(null);
      const adapters = getAvailableAdapters();
      expect(adapters).toEqual([]);
    });

    it('should return configured and enabled adapters', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: { enabled: true, apiKey: 'key1' },
          anthropic: { enabled: true, apiKey: 'key2' },
          deepseek: { enabled: false, apiKey: 'key3' },
        },
      }));

      const adapters = getAvailableAdapters();
      const providers = adapters.map((a) => a.provider);
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).not.toContain('deepseek');
    });

    it('should skip adapters that fail validation', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: { enabled: true }, // No API key - will fail validation
          ollama: { enabled: true }, // Ollama doesn't need API key
        },
      }));

      const adapters = getAvailableAdapters();
      const providers = adapters.map((a) => a.provider);
      // Ollama should be included as it doesn't require API key
      expect(providers).toContain('ollama');
    });
  });

  describe('clearAdapterCache', () => {
    it('should clear cached adapters', () => {
      const adapter1 = getAdapter('openai', { apiKey: 'test-key' });
      clearAdapterCache();
      const adapter2 = getAdapter('openai', { apiKey: 'test-key' });
      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe('getProviderStatuses', () => {
    it('should return status for all registered providers', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        providers: {
          openai: { enabled: true, apiKey: 'key1' },
          anthropic: { enabled: false },
        },
      }));

      const statuses = getProviderStatuses();
      expect(statuses.length).toBeGreaterThan(0);

      const openaiStatus = statuses.find((s) => s.name === 'openai');
      expect(openaiStatus).toBeDefined();
      expect(openaiStatus?.registered).toBe(true);
      expect(openaiStatus?.configured).toBe(true);
      expect(openaiStatus?.enabled).toBe(true);
      expect(openaiStatus?.hasApiKey).toBe(true);

      const anthropicStatus = statuses.find((s) => s.name === 'anthropic');
      expect(anthropicStatus).toBeDefined();
      expect(anthropicStatus?.configured).toBe(true);
      expect(anthropicStatus?.enabled).toBe(false);
    });

    it('should accept config parameter', () => {
      const config = createMockConfig({
        security: {
          auth: { selectedType: AuthType.USE_DEEPSEEK },
        },
        providers: {
          deepseek: { enabled: true, apiKey: 'key' },
        },
      });

      const statuses = getProviderStatuses(config);
      const deepseekStatus = statuses.find((s) => s.name === 'deepseek');
      expect(deepseekStatus?.hasApiKey).toBe(true);
    });

    it('should detect API keys from environment', () => {
      const originalEnv = process.env['ANTHROPIC_API_KEY'];
      process.env['ANTHROPIC_API_KEY'] = 'env-key';

      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        security: {
          auth: { selectedType: AuthType.USE_ANTHROPIC },
        },
        providers: {
          anthropic: { enabled: true },
        },
      }));

      const statuses = getProviderStatuses();
      const anthropicStatus = statuses.find((s) => s.name === 'anthropic');
      expect(anthropicStatus?.hasApiKey).toBe(true);

      process.env['ANTHROPIC_API_KEY'] = originalEnv;
    });

    it('should mark ollama as having API key (not required)', () => {
      mockLoadDamieConfig.mockReturnValue(createMockConfig({
        security: {
          auth: { selectedType: AuthType.USE_OLLAMA },
        },
        providers: {
          ollama: { enabled: true },
        },
      }));

      const statuses = getProviderStatuses();
      const ollamaStatus = statuses.find((s) => s.name === 'ollama');
      expect(ollamaStatus?.hasApiKey).toBe(true);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return all registered provider names', () => {
      const providers = getRegisteredProviders();
      expect(providers).toContain('deepseek');
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).toContain('openrouter');
      expect(providers).toContain('ollama');
    });
  });
});
