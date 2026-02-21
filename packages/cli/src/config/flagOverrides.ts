/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DamieConfig, ProvidersConfig } from '../../../core/src/config/damieConfig.js';
import { AuthType } from '@damie-code/damie-code-core';

/**
 * CLI flags that can override config values
 */
export interface CliOverrideFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Map CLI provider names to AuthType
 */
const PROVIDER_MAP: Record<string, AuthType> = {
  deepseek: AuthType.USE_DEEPSEEK,
  openai: AuthType.USE_OPENAI,
  anthropic: AuthType.USE_ANTHROPIC,
  openrouter: AuthType.USE_OPENROUTER,
  ollama: AuthType.USE_OLLAMA,
  qwen: AuthType.QWEN_OAUTH,
};

/**
 * Parse provider name from CLI flag
 */
export function parseProviderFlag(provider: string): AuthType | null {
  const normalized = provider.toLowerCase().trim();
  return PROVIDER_MAP[normalized] || null;
}

/**
 * Apply CLI flags to config
 * CLI flags take precedence over config file values
 */
export function applyCliOverrides(
  config: DamieConfig,
  flags: CliOverrideFlags,
): DamieConfig {
  const result = { ...config };

  // Override provider
  if (flags.provider) {
    const authType = parseProviderFlag(flags.provider);
    if (authType) {
      result.security = {
        ...result.security,
        auth: {
          ...result.security.auth,
          selectedType: authType,
        },
      };
    }
  }

  // Override model
  if (flags.model) {
    result.model = {
      ...result.model,
      default: flags.model,
    };
  }

  // Override API key for current provider
  if (flags.apiKey) {
    const currentProvider = getProviderKey(result.security.auth.selectedType);
    if (currentProvider) {
      result.providers = {
        ...result.providers,
        [currentProvider]: {
          ...(result.providers?.[currentProvider] || {}),
          apiKey: flags.apiKey,
        },
      };
    }
  }

  // Override base URL for current provider
  if (flags.baseUrl) {
    const currentProvider = getProviderKey(result.security.auth.selectedType);
    if (currentProvider) {
      result.providers = {
        ...result.providers,
        [currentProvider]: {
          ...(result.providers?.[currentProvider] || {}),
          baseUrl: flags.baseUrl,
        },
      };
    }
  }

  return result;
}

/**
 * Get provider key from AuthType
 */
function getProviderKey(authType: AuthType): keyof ProvidersConfig | null {
  switch (authType) {
    case AuthType.USE_DEEPSEEK:
      return 'deepseek';
    case AuthType.USE_OPENAI:
      return 'openai';
    case AuthType.USE_ANTHROPIC:
      return 'anthropic';
    case AuthType.USE_OPENROUTER:
      return 'openrouter';
    case AuthType.USE_OLLAMA:
      return 'ollama';
    case AuthType.QWEN_OAUTH:
      return 'qwen';
    default:
      return null;
  }
}

/**
 * Extract override flags from yargs argv
 */
export function extractOverrideFlags(
  argv: Record<string, unknown>,
): CliOverrideFlags {
  return {
    provider: argv['provider'] as string | undefined,
    model: argv['model'] as string | undefined,
    apiKey: argv['apiKey'] as string | undefined,
    baseUrl: argv['baseUrl'] as string | undefined,
  };
}
