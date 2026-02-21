/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthType } from '../core/contentGenerator.js';
import type { DamieConfig, ProviderConfig, ProviderName } from '../config/damieConfig.js';
import {
  PROVIDER_NAMES,
  PROVIDER_DEFAULT_MODELS,
  isProviderEnabled,
  getProviderPriority,
  getProvidersByPriority,
  getDefaultProviderName,
  hasProviderApiKey,
} from '../config/damieConfig.js';
import { loadDamieConfig, saveDamieConfig, getProviderApiKey } from '../config/damieConfigLoader.js';

/**
 * Provider information with status
 */
export interface ProviderInfo {
  name: ProviderName;
  displayName: string;
  configured: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  isDefault: boolean;
  priority: number;
  model?: string;
}

/**
 * AuthType to ProviderName mapping
 */
const AUTH_TYPE_TO_PROVIDER: Record<string, ProviderName> = {
  'deepseek': 'deepseek',
  'openai': 'openai',
  'anthropic': 'anthropic',
  'openrouter': 'openrouter',
  'ollama': 'ollama',
  'qwen-oauth': 'qwen',
};

/**
 * ProviderName to AuthType mapping
 */
const PROVIDER_TO_AUTH_TYPE: Record<ProviderName, AuthType> = {
  deepseek: 'deepseek' as AuthType,
  openai: 'openai' as AuthType,
  anthropic: 'anthropic' as AuthType,
  openrouter: 'openrouter' as AuthType,
  ollama: 'ollama' as AuthType,
  qwen: 'qwen-oauth' as AuthType,
};

/**
 * Display names for providers
 */
const PROVIDER_DISPLAY_NAMES: Record<ProviderName, string> = {
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
  qwen: 'Qwen',
};

/**
 * Provider Manager - handles all provider operations
 */
export class ProviderManager {
  private config: DamieConfig | null = null;

  constructor(config?: DamieConfig) {
    this.config = config ?? null;
  }

  /**
   * Load configuration from file
   */
  loadConfig(): DamieConfig | null {
    this.config = loadDamieConfig();
    return this.config;
  }

  /**
   * Get current configuration
   */
  getConfig(): DamieConfig | null {
    if (!this.config) {
      this.loadConfig();
    }
    return this.config;
  }

  /**
   * Get all provider information with status
   */
  getConfiguredProviders(): ProviderInfo[] {
    const config = this.getConfig();
    if (!config) {
      return [];
    }

    const defaultProvider = getDefaultProviderName(config);

    return PROVIDER_NAMES.map((name) => {
      const providerConfig = config.providers?.[name];
      const configured = providerConfig !== undefined;

      return {
        name,
        displayName: PROVIDER_DISPLAY_NAMES[name],
        configured,
        enabled: configured ? isProviderEnabled(config, name) : false,
        hasApiKey: hasProviderApiKey(config, name),
        isDefault: name === defaultProvider,
        priority: configured ? getProviderPriority(config, name) : Infinity,
        model: providerConfig?.model ?? PROVIDER_DEFAULT_MODELS[name],
      };
    });
  }

  /**
   * Get only providers that are configured
   */
  getActiveProviders(): ProviderInfo[] {
    return this.getConfiguredProviders().filter((p) => p.configured);
  }

  /**
   * Get only providers that are enabled and have API keys
   */
  getAvailableProviders(): ProviderInfo[] {
    return this.getConfiguredProviders().filter(
      (p) => p.configured && p.enabled && p.hasApiKey,
    );
  }

  /**
   * Get the default provider's AuthType
   */
  getDefaultProvider(): AuthType | undefined {
    const config = this.getConfig();
    if (!config) {
      return undefined;
    }
    return config.security.auth.selectedType as AuthType;
  }

  /**
   * Set the default provider
   */
  async setDefaultProvider(provider: ProviderName): Promise<void> {
    const config = this.getConfig();
    if (!config) {
      throw new Error('No configuration loaded');
    }

    // Verify provider is configured
    if (!this.isProviderConfigured(provider)) {
      throw new Error(`Provider '${provider}' is not configured. Add it first with 'damie provider add ${provider}'`);
    }

    const authType = PROVIDER_TO_AUTH_TYPE[provider];
    config.security.auth.selectedType = authType;

    await saveDamieConfig(config);
    this.config = config;
  }

  /**
   * Check if a provider is configured
   */
  isProviderConfigured(provider: ProviderName): boolean {
    const config = this.getConfig();
    if (!config) {
      return false;
    }
    return config.providers?.[provider] !== undefined;
  }

  /**
   * Get configuration for a specific provider
   */
  getProviderConfig(provider: ProviderName): ProviderConfig | undefined {
    const config = this.getConfig();
    if (!config) {
      return undefined;
    }
    return config.providers?.[provider];
  }

  /**
   * Get API key for a provider (from config or environment)
   */
  getApiKey(provider: ProviderName): string | undefined {
    return getProviderApiKey(provider);
  }

  /**
   * Add a new provider to configuration
   */
  async addProvider(
    provider: ProviderName,
    options: {
      apiKey?: string;
      model?: string;
      baseUrl?: string;
      priority?: number;
      enabled?: boolean;
    } = {},
  ): Promise<void> {
    let config = this.getConfig();
    if (!config) {
      // Create minimal config if none exists
      config = {
        security: {
          auth: {
            selectedType: PROVIDER_TO_AUTH_TYPE[provider],
          },
        },
        providers: {},
      };
    }

    // Initialize providers object if needed
    if (!config.providers) {
      config.providers = {};
    }

    // Create provider config
    const providerConfig: ProviderConfig = {
      enabled: options.enabled ?? true,
      priority: options.priority ?? 100,
    };

    if (options.apiKey) {
      providerConfig.apiKey = options.apiKey;
    }
    if (options.model) {
      providerConfig.model = options.model;
    }
    if (options.baseUrl) {
      providerConfig.baseUrl = options.baseUrl;
    }

    // Add to config
    config.providers[provider] = providerConfig;

    await saveDamieConfig(config);
    this.config = config;
  }

  /**
   * Remove a provider from configuration
   */
  async removeProvider(provider: ProviderName): Promise<void> {
    const config = this.getConfig();
    if (!config || !config.providers) {
      throw new Error('No configuration loaded');
    }

    if (!config.providers[provider]) {
      throw new Error(`Provider '${provider}' is not configured`);
    }

    // Check if this is the default provider
    const defaultProvider = getDefaultProviderName(config);
    if (provider === defaultProvider) {
      // Find another provider to set as default
      const remaining = getProvidersByPriority(config).filter((p) => p !== provider);
      if (remaining.length > 0) {
        config.security.auth.selectedType = PROVIDER_TO_AUTH_TYPE[remaining[0]];
      } else {
        throw new Error('Cannot remove the last configured provider');
      }
    }

    delete config.providers[provider];

    await saveDamieConfig(config);
    this.config = config;
  }

  /**
   * Update a provider's configuration
   */
  async updateProvider(
    provider: ProviderName,
    updates: Partial<ProviderConfig>,
  ): Promise<void> {
    const config = this.getConfig();
    if (!config || !config.providers) {
      throw new Error('No configuration loaded');
    }

    const existing = config.providers[provider];
    if (!existing) {
      throw new Error(`Provider '${provider}' is not configured`);
    }

    // Merge updates
    config.providers[provider] = { ...existing, ...updates };

    await saveDamieConfig(config);
    this.config = config;
  }

  /**
   * Enable a provider
   */
  async enableProvider(provider: ProviderName): Promise<void> {
    await this.updateProvider(provider, { enabled: true });
  }

  /**
   * Disable a provider
   */
  async disableProvider(provider: ProviderName): Promise<void> {
    await this.updateProvider(provider, { enabled: false });
  }

  /**
   * Set provider priority
   */
  async setProviderPriority(provider: ProviderName, priority: number): Promise<void> {
    await this.updateProvider(provider, { priority });
  }

  /**
   * Get providers sorted by priority (for fallback)
   */
  getProvidersByPriority(): ProviderInfo[] {
    return this.getAvailableProviders().sort((a, b) => a.priority - b.priority);
  }

  /**
   * Convert AuthType to ProviderName
   */
  static authTypeToProvider(authType: AuthType): ProviderName | undefined {
    return AUTH_TYPE_TO_PROVIDER[authType as string];
  }

  /**
   * Convert ProviderName to AuthType
   */
  static providerToAuthType(provider: ProviderName): AuthType {
    return PROVIDER_TO_AUTH_TYPE[provider];
  }

  /**
   * Get display name for a provider
   */
  static getDisplayName(provider: ProviderName): string {
    return PROVIDER_DISPLAY_NAMES[provider];
  }

  /**
   * Get all valid provider names
   */
  static getValidProviderNames(): ProviderName[] {
    return [...PROVIDER_NAMES];
  }

  /**
   * Check if a string is a valid provider name
   */
  static isValidProvider(name: string): name is ProviderName {
    return PROVIDER_NAMES.includes(name as ProviderName);
  }
}
