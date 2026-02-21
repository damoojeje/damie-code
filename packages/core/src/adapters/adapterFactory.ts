/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BaseAdapter } from './baseAdapter.js';
import { createAdapter, getRegisteredProviders, isProviderRegistered } from './baseAdapter.js';
import type { AdapterConfig } from './types.js';
import { loadDamieConfig } from '../config/damieConfigLoader.js';
import type { DamieConfig, ProviderName } from '../config/damieConfig.js';
import { PROVIDER_ENV_VARS } from '../config/damieConfig.js';

// Import adapters to ensure they register themselves
import './deepseekAdapter.js';
import './openaiAdapter.js';
import './anthropicAdapter.js';
import './openrouterAdapter.js';
import './ollamaAdapter.js';

/**
 * Singleton cache for adapter instances
 */
const adapterInstances: Map<string, BaseAdapter> = new Map();

/**
 * Get or create an adapter instance for a provider
 *
 * @param provider - Provider name
 * @param config - Optional adapter configuration override
 * @param forceNew - Force creation of a new instance (don't use cache)
 * @returns The adapter instance
 */
export function getAdapter(
  provider: string,
  config?: Partial<AdapterConfig>,
  forceNew = false,
): BaseAdapter {
  const cacheKey = `${provider}:${JSON.stringify(config || {})}`;

  if (!forceNew && adapterInstances.has(cacheKey)) {
    return adapterInstances.get(cacheKey)!;
  }

  const adapter = createAdapter(provider, config);
  adapterInstances.set(cacheKey, adapter);
  return adapter;
}

/**
 * Get adapter from Damie configuration
 *
 * Loads the configuration and creates an adapter with the appropriate settings.
 *
 * @param provider - Provider name
 * @returns The configured adapter
 */
export function getAdapterFromConfig(provider: ProviderName): BaseAdapter {
  const config = loadDamieConfig();
  if (!config) {
    throw new Error('No Damie configuration found. Run setup first.');
  }

  const providerConfig = config.providers?.[provider];
  const adapterConfig: Partial<AdapterConfig> = {};

  // Get API key from config or environment
  if (providerConfig?.apiKey) {
    adapterConfig.apiKey = providerConfig.apiKey;
  } else {
    const envVar = PROVIDER_ENV_VARS[provider];
    if (envVar && process.env[envVar]) {
      adapterConfig.apiKey = process.env[envVar];
    }
  }

  // Get other config options
  if (providerConfig?.baseUrl) {
    adapterConfig.baseUrl = providerConfig.baseUrl;
  }
  if (providerConfig?.timeout) {
    adapterConfig.timeout = providerConfig.timeout;
  }
  if (providerConfig?.maxRetries) {
    adapterConfig.maxRetries = providerConfig.maxRetries;
  }

  return getAdapter(provider, adapterConfig);
}

/**
 * Get the default adapter based on configuration
 *
 * @returns The default adapter
 */
export function getDefaultAdapter(): BaseAdapter {
  const config = loadDamieConfig();
  if (!config) {
    throw new Error('No Damie configuration found. Run setup first.');
  }

  // Map auth type to provider name
  const authType = config.security.auth.selectedType;
  const providerMap: Record<string, ProviderName> = {
    'deepseek': 'deepseek',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'openrouter': 'openrouter',
    'ollama': 'ollama',
    'qwen-oauth': 'qwen',
  };

  const provider = providerMap[authType];
  if (!provider) {
    throw new Error(`Unknown auth type: ${authType}`);
  }

  return getAdapterFromConfig(provider);
}

/**
 * Get all available adapters based on configuration
 *
 * Returns adapters that are configured and enabled.
 *
 * @returns Array of available adapters
 */
export function getAvailableAdapters(): BaseAdapter[] {
  const config = loadDamieConfig();
  if (!config) {
    return [];
  }

  const adapters: BaseAdapter[] = [];

  for (const provider of getRegisteredProviders()) {
    const providerConfig = config.providers?.[provider as ProviderName];

    // Skip if not configured or disabled
    if (!providerConfig || providerConfig.enabled === false) {
      continue;
    }

    try {
      const adapter = getAdapterFromConfig(provider as ProviderName);
      if (adapter.validateConfig()) {
        adapters.push(adapter);
      }
    } catch {
      // Skip adapters that fail to initialize
    }
  }

  return adapters;
}

/**
 * Clear the adapter cache
 *
 * Useful for testing or when configuration changes.
 */
export function clearAdapterCache(): void {
  adapterInstances.clear();
}

/**
 * Get list of all registered provider names
 */
export { getRegisteredProviders, isProviderRegistered };

/**
 * Provider information with availability status
 */
export interface ProviderStatus {
  name: string;
  registered: boolean;
  configured: boolean;
  enabled: boolean;
  hasApiKey: boolean;
}

/**
 * Get status of all providers
 */
export function getProviderStatuses(config?: DamieConfig | null): ProviderStatus[] {
  const damieConfig = config ?? loadDamieConfig();
  const registeredProviders = getRegisteredProviders();

  return registeredProviders.map((provider) => {
    const providerConfig = damieConfig?.providers?.[provider as ProviderName];
    const envVar = PROVIDER_ENV_VARS[provider];
    const hasEnvKey = envVar ? !!process.env[envVar] : false;

    return {
      name: provider,
      registered: true,
      configured: !!providerConfig,
      enabled: providerConfig?.enabled !== false,
      hasApiKey: !!(providerConfig?.apiKey || hasEnvKey || provider === 'ollama'),
    };
  });
}
