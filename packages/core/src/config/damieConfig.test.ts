/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { AuthType } from '../core/contentGenerator.js';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('damieConfig', () => {
  describe('validateDamieConfig', () => {
    it('should return true for valid config', async () => {
      const { validateDamieConfig } = await import('./damieConfig.js');

      const validConfig = {
        security: {
          auth: {
            selectedType: 'deepseek',
          },
        },
      };

      expect(validateDamieConfig(validConfig)).toBe(true);
    });

    it('should return false for missing security', async () => {
      const { validateDamieConfig } = await import('./damieConfig.js');

      expect(validateDamieConfig({})).toBe(false);
      expect(validateDamieConfig(null)).toBe(false);
      expect(validateDamieConfig(undefined)).toBe(false);
    });

    it('should return false for missing auth', async () => {
      const { validateDamieConfig } = await import('./damieConfig.js');

      expect(validateDamieConfig({ security: {} })).toBe(false);
    });

    it('should return false for missing selectedType', async () => {
      const { validateDamieConfig } = await import('./damieConfig.js');

      expect(validateDamieConfig({ security: { auth: {} } })).toBe(false);
    });
  });

  describe('PROVIDER_ENV_VARS', () => {
    it('should have entries for all providers', async () => {
      const { PROVIDER_ENV_VARS } = await import('./damieConfig.js');

      expect(PROVIDER_ENV_VARS['deepseek']).toBe('DEEPSEEK_API_KEY');
      expect(PROVIDER_ENV_VARS['openai']).toBe('OPENAI_API_KEY');
      expect(PROVIDER_ENV_VARS['anthropic']).toBe('ANTHROPIC_API_KEY');
      expect(PROVIDER_ENV_VARS['openrouter']).toBe('OPENROUTER_API_KEY');
    });
  });

  describe('PROVIDER_DEFAULT_MODELS', () => {
    it('should have default models for all providers', async () => {
      const { PROVIDER_DEFAULT_MODELS } = await import('./damieConfig.js');

      expect(PROVIDER_DEFAULT_MODELS['deepseek']).toBe('deepseek-chat');
      expect(PROVIDER_DEFAULT_MODELS['openai']).toBe('gpt-4');
      expect(PROVIDER_DEFAULT_MODELS['anthropic']).toBe('claude-3-5-sonnet-20241022');
      expect(PROVIDER_DEFAULT_MODELS['ollama']).toBe('llama3.1');
    });
  });
});

describe('damieConfigLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getDamieConfigPath', () => {
    it('should return default path when no env override', async () => {
      delete process.env['DAMIE_CONFIG'];

      const { getDamieConfigPath, DAMIE_CONFIG_DIR, DAMIE_CONFIG_FILE } =
        await import('./damieConfigLoader.js');

      const expected = path.join(homedir(), DAMIE_CONFIG_DIR, DAMIE_CONFIG_FILE);
      expect(getDamieConfigPath()).toBe(expected);
    });

    it('should return env override path when set', async () => {
      process.env['DAMIE_CONFIG'] = '/custom/path/config.yaml';

      // Re-import to get fresh module
      vi.resetModules();
      const { getDamieConfigPath } = await import('./damieConfigLoader.js');

      expect(getDamieConfigPath()).toBe('/custom/path/config.yaml');
    });
  });

  describe('configExists', () => {
    it('should return true when config file exists', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);

      const { configExists } = await import('./damieConfigLoader.js');
      expect(configExists()).toBe(true);
    });

    it('should return false when config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { configExists } = await import('./damieConfigLoader.js');
      expect(configExists()).toBe(false);
    });
  });

  describe('loadDamieConfig', () => {
    it('should return null when config file does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const { loadDamieConfig } = await import('./damieConfigLoader.js');
      expect(loadDamieConfig()).toBe(null);
    });

    it('should parse valid YAML config', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
security:
  auth:
    selectedType: "deepseek"
model:
  default: "deepseek-chat"
`);

      const { loadDamieConfig } = await import('./damieConfigLoader.js');
      const config = loadDamieConfig();

      expect(config).not.toBe(null);
      expect(config?.security.auth.selectedType).toBe('deepseek');
    });

    it('should merge with defaults', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(`
security:
  auth:
    selectedType: "openai"
`);

      const { loadDamieConfig } = await import('./damieConfigLoader.js');
      const config = loadDamieConfig();

      // Should have default values merged
      expect(config?.model?.chatCompression).toBe(true);
      expect(config?.ui?.showLineNumbers).toBe(true);
    });
  });

  describe('loadProviderKeysFromEnv', () => {
    it('should load API keys from environment', async () => {
      process.env['DEEPSEEK_API_KEY'] = 'test-deepseek-key';
      process.env['OPENAI_API_KEY'] = 'test-openai-key';

      const { loadProviderKeysFromEnv } = await import('./damieConfigLoader.js');
      const providers = loadProviderKeysFromEnv({});

      expect(providers.deepseek?.apiKey).toBe('test-deepseek-key');
      expect(providers.openai?.apiKey).toBe('test-openai-key');
    });

    it('should preserve existing provider config', async () => {
      process.env['DEEPSEEK_API_KEY'] = 'env-key';

      const { loadProviderKeysFromEnv } = await import('./damieConfigLoader.js');
      const providers = loadProviderKeysFromEnv({
        deepseek: { model: 'custom-model' },
      });

      expect(providers.deepseek?.apiKey).toBe('env-key');
      expect(providers.deepseek?.model).toBe('custom-model');
    });
  });

  describe('getProviderApiKey', () => {
    it('should prefer environment variable over config', async () => {
      process.env['DEEPSEEK_API_KEY'] = 'env-key';

      const { getProviderApiKey } = await import('./damieConfigLoader.js');
      const config = {
        security: { auth: { selectedType: AuthType.USE_DEEPSEEK } },
        providers: { deepseek: { apiKey: 'config-key' } },
      };

      expect(getProviderApiKey('deepseek', config)).toBe('env-key');
    });

    it('should fall back to config when no env var', async () => {
      delete process.env['DEEPSEEK_API_KEY'];

      const { getProviderApiKey } = await import('./damieConfigLoader.js');
      const config = {
        security: { auth: { selectedType: AuthType.USE_DEEPSEEK } },
        providers: { deepseek: { apiKey: 'config-key' } },
      };

      expect(getProviderApiKey('deepseek', config)).toBe('config-key');
    });
  });
});

describe('defaultConfig', () => {
  describe('generateDefaultConfigYaml', () => {
    it('should generate valid YAML with auth type', async () => {
      const { generateDefaultConfigYaml } = await import('./defaultConfig.js');

      const yaml = generateDefaultConfigYaml(AuthType.USE_DEEPSEEK);

      expect(yaml).toContain('selectedType: "deepseek"');
      expect(yaml).toContain('# Damie Code Configuration');
    });
  });

  describe('generateMinimalConfigYaml', () => {
    it('should generate minimal config', async () => {
      const { generateMinimalConfigYaml } = await import('./defaultConfig.js');

      const yaml = generateMinimalConfigYaml(AuthType.USE_OPENAI, 'gpt-4');

      expect(yaml).toContain('selectedType: "openai"');
      expect(yaml).toContain('default: "gpt-4"');
    });

    it('should work without model', async () => {
      const { generateMinimalConfigYaml } = await import('./defaultConfig.js');

      const yaml = generateMinimalConfigYaml(AuthType.USE_OLLAMA);

      expect(yaml).toContain('selectedType: "ollama"');
      expect(yaml).not.toContain('default:');
    });
  });
});
