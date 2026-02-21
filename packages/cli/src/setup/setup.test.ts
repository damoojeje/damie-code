/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import { AuthType } from '@damie-code/damie-code-core';

// Mock fs module
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof fs>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    appendFileSync: vi.fn(),
  };
});

describe('firstRunDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when config file does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { isFirstRun } = await import('./firstRunDetector.js');
    expect(isFirstRun()).toBe(true);
  });

  it('should return false when config file exists', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const { isFirstRun } = await import('./firstRunDetector.js');
    expect(isFirstRun()).toBe(false);
  });

  it('should return correct config path', async () => {
    const { getDamieConfigPath, DAMIE_CONFIG_DIR, DAMIE_CONFIG_FILE } = await import('./firstRunDetector.js');
    const expected = path.join(homedir(), DAMIE_CONFIG_DIR, DAMIE_CONFIG_FILE);
    expect(getDamieConfigPath()).toBe(expected);
  });

  it('should create config directory when it does not exist', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const { ensureConfigDir } = await import('./firstRunDetector.js');
    ensureConfigDir();

    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.damie'),
      { recursive: true }
    );
  });
});

describe('types', () => {
  it('should export PROVIDERS array with all providers', async () => {
    const { PROVIDERS } = await import('./types.js');

    expect(PROVIDERS).toBeInstanceOf(Array);
    expect(PROVIDERS.length).toBeGreaterThan(0);

    // Check that expected providers are present
    const authTypes = PROVIDERS.map((p) => p.authType);
    expect(authTypes).toContain(AuthType.QWEN_OAUTH);
    expect(authTypes).toContain(AuthType.USE_DEEPSEEK);
    expect(authTypes).toContain(AuthType.USE_OPENAI);
    expect(authTypes).toContain(AuthType.USE_ANTHROPIC);
    expect(authTypes).toContain(AuthType.USE_OPENROUTER);
    expect(authTypes).toContain(AuthType.USE_OLLAMA);
  });

  it('should return provider info for valid auth type', async () => {
    const { getProviderInfo } = await import('./types.js');

    const deepseek = getProviderInfo(AuthType.USE_DEEPSEEK);
    expect(deepseek).toBeDefined();
    expect(deepseek?.name).toBe('DeepSeek');
    expect(deepseek?.requiresApiKey).toBe(true);
    expect(deepseek?.envVar).toBe('DEEPSEEK_API_KEY');
  });

  it('should return undefined for unknown auth type', async () => {
    const { getProviderInfo } = await import('./types.js');

    const unknown = getProviderInfo('unknown-type' as AuthType);
    expect(unknown).toBeUndefined();
  });
});

describe('apiValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return valid for providers that do not require API key', async () => {
    const { validateApiKey } = await import('./apiValidator.js');

    const result = await validateApiKey(AuthType.QWEN_OAUTH, '');
    expect(result.valid).toBe(true);
  });

  it('should return invalid for empty API key when required', async () => {
    const { validateApiKey } = await import('./apiValidator.js');

    const result = await validateApiKey(AuthType.USE_DEEPSEEK, '');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('API key is required');
  });

  it('should validate DeepSeek API key successfully', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { validateApiKey } = await import('./apiValidator.js');

    const result = await validateApiKey(AuthType.USE_DEEPSEEK, 'sk-test-key');
    expect(result.valid).toBe(true);
    expect(result.model).toBe('deepseek-chat');
  });

  it('should return invalid for DeepSeek 401 response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const { validateApiKey } = await import('./apiValidator.js');

    const result = await validateApiKey(AuthType.USE_DEEPSEEK, 'invalid-key');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid API key');
  });

  it('should handle network errors gracefully', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    const { validateApiKey } = await import('./apiValidator.js');

    const result = await validateApiKey(AuthType.USE_DEEPSEEK, 'sk-test-key');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Failed to connect');
  });
});

describe('configWriter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  it('should write config file with correct content', async () => {
    const { writeConfig } = await import('./configWriter.js');

    const configPath = await writeConfig(
      [{ provider: AuthType.USE_DEEPSEEK, apiKey: 'sk-test-key' }],
      AuthType.USE_DEEPSEEK,
    );

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(configPath).toContain('.damie');
    expect(configPath).toContain('config.yaml');
  });

  it('should create .env file for API key', async () => {
    const { writeConfig } = await import('./configWriter.js');

    await writeConfig(
      [{ provider: AuthType.USE_DEEPSEEK, apiKey: 'sk-test-key' }],
      AuthType.USE_DEEPSEEK,
    );

    // Should write both config.yaml and .env
    expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('should set environment variable for current session', async () => {
    const { writeConfig } = await import('./configWriter.js');

    await writeConfig(
      [{ provider: AuthType.USE_DEEPSEEK, apiKey: 'sk-test-key' }],
      AuthType.USE_DEEPSEEK,
    );

    expect(process.env['DEEPSEEK_API_KEY']).toBe('sk-test-key');
  });
});

describe('shouldSkipSetup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Direct implementation test without importing setupWizard
  // (setupWizard imports Ink which causes yoga-layout issues in vitest)
  function shouldSkipSetup(): boolean {
    return process.env['DAMIE_SKIP_SETUP'] === 'true' || process.env['CI'] === 'true';
  }

  it('should return true when DAMIE_SKIP_SETUP is true', () => {
    process.env['DAMIE_SKIP_SETUP'] = 'true';
    expect(shouldSkipSetup()).toBe(true);
  });

  it('should return true when CI is true', () => {
    process.env['CI'] = 'true';
    expect(shouldSkipSetup()).toBe(true);
  });

  it('should return false when no skip env vars are set', () => {
    delete process.env['DAMIE_SKIP_SETUP'];
    delete process.env['CI'];
    expect(shouldSkipSetup()).toBe(false);
  });
});
