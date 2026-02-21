/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type {
  DamieConfig,
  ProviderConfig,
  ProvidersConfig,
} from './damieConfig.js';
import {
  DEFAULT_DAMIE_CONFIG,
  PROVIDER_ENV_VARS,
  validateDamieConfig,
} from './damieConfig.js';

/**
 * Directory name for Damie Code configuration
 */
export const DAMIE_CONFIG_DIR = '.damie';

/**
 * Config file name
 */
export const DAMIE_CONFIG_FILE = 'config.yaml';

/**
 * Environment variable to override config path
 */
export const DAMIE_CONFIG_ENV = 'DAMIE_CONFIG';

/**
 * Get the path to the Damie config directory
 */
export function getDamieConfigDir(): string {
  return path.join(homedir(), DAMIE_CONFIG_DIR);
}

/**
 * Get the path to the Damie config file
 */
export function getDamieConfigPath(): string {
  // Check for environment variable override
  const envPath = process.env[DAMIE_CONFIG_ENV];
  if (envPath) {
    return envPath;
  }
  return path.join(getDamieConfigDir(), DAMIE_CONFIG_FILE);
}

/**
 * Check if config file exists
 */
export function configExists(): boolean {
  return fs.existsSync(getDamieConfigPath());
}

/**
 * Simple YAML parser for config files
 * Handles basic YAML structure without external dependencies
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');
  const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
    { indent: -1, obj: result },
  ];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') {
      continue;
    }

    // Calculate indentation
    const indent = line.search(/\S/);
    if (indent === -1) continue;

    // Parse key-value
    const match = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!match) continue;

    const [, , key, rawValue] = match;
    const cleanKey = key.trim();

    // Pop stack to find parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].obj;

    // Parse value
    let value: unknown;
    const trimmedValue = rawValue.trim();

    if (trimmedValue === '' || trimmedValue === '~' || trimmedValue === 'null') {
      // Nested object or null
      value = {};
      stack.push({ indent, obj: value as Record<string, unknown> });
    } else if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
      // Quoted string
      value = trimmedValue.slice(1, -1);
    } else if (trimmedValue === 'true') {
      value = true;
    } else if (trimmedValue === 'false') {
      value = false;
    } else if (!isNaN(Number(trimmedValue))) {
      value = Number(trimmedValue);
    } else {
      // Unquoted string
      value = trimmedValue;
    }

    if (typeof value !== 'object' || value === null) {
      parent[cleanKey] = value;
    } else {
      parent[cleanKey] = value;
    }
  }

  return result;
}

/**
 * Load and parse the Damie config file
 */
export function loadDamieConfig(): DamieConfig | null {
  const configPath = getDamieConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const parsed = parseSimpleYaml(content);

    if (validateDamieConfig(parsed)) {
      return mergeWithDefaults(parsed);
    }

    console.warn('Invalid Damie config file, using defaults');
    return null;
  } catch (error) {
    console.warn('Failed to load Damie config:', error);
    return null;
  }
}

/**
 * Merge config with defaults
 */
function mergeWithDefaults(config: DamieConfig): DamieConfig {
  return {
    ...DEFAULT_DAMIE_CONFIG,
    ...config,
    model: {
      ...DEFAULT_DAMIE_CONFIG.model,
      ...config.model,
    },
    ui: {
      ...DEFAULT_DAMIE_CONFIG.ui,
      ...config.ui,
    },
  };
}

/**
 * Load API keys from environment variables into provider config
 */
export function loadProviderKeysFromEnv(
  providers?: ProvidersConfig,
): ProvidersConfig {
  const result: ProvidersConfig = { ...providers };

  for (const [provider, envVar] of Object.entries(PROVIDER_ENV_VARS)) {
    const apiKey = process.env[envVar];
    if (apiKey) {
      const providerKey = provider as keyof ProvidersConfig;
      result[providerKey] = {
        ...(result[providerKey] as ProviderConfig | undefined),
        apiKey,
      };
    }
  }

  return result;
}

/**
 * Get effective config by merging file config with env vars
 */
export function getEffectiveConfig(): DamieConfig | null {
  const fileConfig = loadDamieConfig();

  if (!fileConfig) {
    return null;
  }

  // Merge environment variables into provider config
  fileConfig.providers = loadProviderKeysFromEnv(fileConfig.providers);

  return fileConfig;
}

/**
 * Get API key for a specific provider
 */
export function getProviderApiKey(
  provider: keyof ProvidersConfig,
  config?: DamieConfig | null,
): string | undefined {
  // Check environment variable first
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar];
  }

  // Fall back to config file
  return config?.providers?.[provider]?.apiKey;
}

/**
 * Convert a config object to YAML string
 */
function configToYaml(config: DamieConfig, indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  // Security section
  lines.push(`${prefix}security:`);
  lines.push(`${prefix}  auth:`);
  lines.push(`${prefix}    selectedType: "${config.security.auth.selectedType}"`);
  if (config.security.auth.useExternal !== undefined) {
    lines.push(`${prefix}    useExternal: ${config.security.auth.useExternal}`);
  }

  // Providers section
  if (config.providers && Object.keys(config.providers).length > 0) {
    lines.push('');
    lines.push(`${prefix}providers:`);
    for (const [name, provider] of Object.entries(config.providers)) {
      if (provider) {
        lines.push(`${prefix}  ${name}:`);
        if (provider.apiKey) {
          lines.push(`${prefix}    apiKey: "${provider.apiKey}"`);
        }
        if (provider.model) {
          lines.push(`${prefix}    model: "${provider.model}"`);
        }
        if (provider.baseUrl) {
          lines.push(`${prefix}    baseUrl: "${provider.baseUrl}"`);
        }
        if (provider.timeout !== undefined) {
          lines.push(`${prefix}    timeout: ${provider.timeout}`);
        }
        if (provider.maxRetries !== undefined) {
          lines.push(`${prefix}    maxRetries: ${provider.maxRetries}`);
        }
        if (provider.enabled !== undefined) {
          lines.push(`${prefix}    enabled: ${provider.enabled}`);
        }
        if (provider.priority !== undefined) {
          lines.push(`${prefix}    priority: ${provider.priority}`);
        }
      }
    }
  }

  // Model section
  if (config.model) {
    lines.push('');
    lines.push(`${prefix}model:`);
    if (config.model.default) {
      lines.push(`${prefix}  default: "${config.model.default}"`);
    }
    if (config.model.chatCompression !== undefined) {
      lines.push(`${prefix}  chatCompression: ${config.model.chatCompression}`);
    }
    if (config.model.maxTokens !== undefined) {
      lines.push(`${prefix}  maxTokens: ${config.model.maxTokens}`);
    }
  }

  // UI section
  if (config.ui) {
    lines.push('');
    lines.push(`${prefix}ui:`);
    if (config.ui.theme) {
      lines.push(`${prefix}  theme: "${config.ui.theme}"`);
    }
    if (config.ui.hideTips !== undefined) {
      lines.push(`${prefix}  hideTips: ${config.ui.hideTips}`);
    }
    if (config.ui.hideBanner !== undefined) {
      lines.push(`${prefix}  hideBanner: ${config.ui.hideBanner}`);
    }
    if (config.ui.showLineNumbers !== undefined) {
      lines.push(`${prefix}  showLineNumbers: ${config.ui.showLineNumbers}`);
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Save configuration to file
 */
export async function saveDamieConfig(config: DamieConfig): Promise<void> {
  const configDir = getDamieConfigDir();
  const configPath = getDamieConfigPath();

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Convert to YAML and write
  const yamlContent = configToYaml(config);
  fs.writeFileSync(configPath, yamlContent, 'utf8');
}
