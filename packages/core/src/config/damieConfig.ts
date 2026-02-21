/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuthType } from '../core/contentGenerator.js';

/**
 * Provider-specific configuration
 */
export interface ProviderConfig {
  /** API key (can also be set via environment variable) */
  apiKey?: string;
  /** Base URL override for the API */
  baseUrl?: string;
  /** Default model to use with this provider */
  model?: string;
  /** Model for coding tasks */
  codingModel?: string;
  /** Model for reasoning tasks */
  reasoningModel?: string;
  /** Model for general tasks */
  generalModel?: string;
  /** Model for vision tasks */
  visionModel?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Whether this provider is enabled (default: true if configured) */
  enabled?: boolean;
  /** Priority for fallback ordering (lower = higher priority, default: 100) */
  priority?: number;
}

/**
 * Ollama-specific configuration
 */
export interface OllamaConfig extends ProviderConfig {
  /** Ollama server URL (default: http://localhost:11434) */
  baseUrl?: string;
  /** Keep model loaded in memory */
  keepAlive?: string;
}

/**
 * Model routing configuration
 */
export interface RoutingConfig {
  /** Provider for coding tasks */
  coding?: AuthType;
  /** Provider for reasoning tasks */
  reasoning?: AuthType;
  /** Provider for general tasks */
  general?: AuthType;
  /** Provider for vision tasks */
  vision?: AuthType;
}

/**
 * Security and authentication settings
 */
export interface SecurityConfig {
  auth: {
    /** Selected authentication type */
    selectedType: AuthType;
    /** Use external auth (e.g., from IDE) */
    useExternal?: boolean;
  };
}

/**
 * Provider configurations
 */
export interface ProvidersConfig {
  deepseek?: ProviderConfig;
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  openrouter?: ProviderConfig;
  ollama?: OllamaConfig;
  qwen?: ProviderConfig;
}

/**
 * Model settings
 */
export interface DamieModelConfig {
  /** Default model name */
  default?: string;
  /** Task-based routing configuration */
  routing?: RoutingConfig;
  /** Enable chat compression for long conversations */
  chatCompression?: boolean;
  /** Maximum tokens per response */
  maxTokens?: number;
}

/**
 * UI settings
 */
export interface UIConfig {
  /** Theme name */
  theme?: string;
  /** Hide tips */
  hideTips?: boolean;
  /** Hide startup banner */
  hideBanner?: boolean;
  /** Show line numbers in code */
  showLineNumbers?: boolean;
}

/**
 * Main Damie Code configuration
 */
export interface DamieConfig {
  /** Security and authentication */
  security: SecurityConfig;
  /** Provider-specific configurations */
  providers?: ProvidersConfig;
  /** Model settings */
  model?: DamieModelConfig;
  /** UI settings */
  ui?: UIConfig;
}

/**
 * Default configuration values
 */
export const DEFAULT_DAMIE_CONFIG: Partial<DamieConfig> = {
  model: {
    chatCompression: true,
    maxTokens: 4096,
  },
  ui: {
    hideTips: false,
    hideBanner: false,
    showLineNumbers: true,
  },
};

/**
 * Environment variable names for each provider
 */
export const PROVIDER_ENV_VARS: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  qwen: 'QWEN_API_KEY',
};

/**
 * Default models for each provider
 */
export const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4',
  anthropic: 'claude-3-5-sonnet-20241022',
  openrouter: 'anthropic/claude-3.5-sonnet',
  ollama: 'llama3.1',
  qwen: 'qwen-max',
};

/**
 * Validate a Damie configuration object
 */
export function validateDamieConfig(config: unknown): config is DamieConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  // security.auth.selectedType is required
  if (!cfg['security'] || typeof cfg['security'] !== 'object') {
    return false;
  }

  const security = cfg['security'] as Record<string, unknown>;
  if (!security['auth'] || typeof security['auth'] !== 'object') {
    return false;
  }

  const auth = security['auth'] as Record<string, unknown>;
  if (typeof auth['selectedType'] !== 'string') {
    return false;
  }

  return true;
}

/**
 * Provider name type for type safety
 */
export type ProviderName = keyof ProvidersConfig;

/**
 * All valid provider names
 */
export const PROVIDER_NAMES: ProviderName[] = [
  'deepseek',
  'openai',
  'anthropic',
  'openrouter',
  'ollama',
  'qwen',
];

/**
 * Get list of configured provider names from a config
 */
export function getConfiguredProviders(config: DamieConfig): ProviderName[] {
  if (!config.providers) {
    return [];
  }
  return PROVIDER_NAMES.filter(
    (name) => config.providers?.[name] !== undefined,
  );
}

/**
 * Check if a provider is enabled
 * A provider is enabled if:
 * 1. It's configured in providers
 * 2. Its enabled field is not explicitly false
 */
export function isProviderEnabled(
  config: DamieConfig,
  provider: ProviderName,
): boolean {
  const providerConfig = config.providers?.[provider];
  if (!providerConfig) {
    return false;
  }
  // Default to enabled if not explicitly disabled
  return providerConfig.enabled !== false;
}

/**
 * Get priority of a provider (lower = higher priority)
 * Returns Infinity if provider not configured
 */
export function getProviderPriority(
  config: DamieConfig,
  provider: ProviderName,
): number {
  const providerConfig = config.providers?.[provider];
  if (!providerConfig) {
    return Infinity;
  }
  // Default priority is 100
  return providerConfig.priority ?? 100;
}

/**
 * Get configured providers sorted by priority (lowest first = highest priority)
 */
export function getProvidersByPriority(config: DamieConfig): ProviderName[] {
  const configured = getConfiguredProviders(config);
  return configured
    .filter((name) => isProviderEnabled(config, name))
    .sort((a, b) => getProviderPriority(config, a) - getProviderPriority(config, b));
}

/**
 * Get the default provider from config
 * Returns the provider set in security.auth.selectedType, mapped to provider name
 */
export function getDefaultProviderName(config: DamieConfig): ProviderName | undefined {
  const authType = config.security.auth.selectedType;
  // Map AuthType to ProviderName
  const mapping: Record<string, ProviderName> = {
    'deepseek': 'deepseek',
    'openai': 'openai',
    'anthropic': 'anthropic',
    'openrouter': 'openrouter',
    'ollama': 'ollama',
    'qwen-oauth': 'qwen',
  };
  return mapping[authType];
}

/**
 * Check if a provider has an API key configured (either in config or env)
 */
export function hasProviderApiKey(
  config: DamieConfig,
  provider: ProviderName,
): boolean {
  // Check config first
  const providerConfig = config.providers?.[provider];
  if (providerConfig?.apiKey) {
    return true;
  }
  // Check environment variable
  const envVar = PROVIDER_ENV_VARS[provider];
  if (envVar && process.env[envVar]) {
    return true;
  }
  // Ollama doesn't require API key
  if (provider === 'ollama') {
    return true;
  }
  return false;
}
