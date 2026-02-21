/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@damie-code/damie-code-core';

/**
 * Provider information for display in the setup wizard
 */
export interface ProviderInfo {
  authType: AuthType;
  name: string;
  description: string;
  requiresApiKey: boolean;
  envVar?: string;
  apiKeyHint?: string;
  docsUrl?: string;
}

/**
 * Configuration resulting from the setup wizard
 */
export interface SetupConfig {
  provider: AuthType;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Result of the setup wizard
 */
export interface SetupResult {
  success: boolean;
  configPath?: string;
  error?: string;
}

/**
 * Available providers for Damie Code
 */
export const PROVIDERS: ProviderInfo[] = [
  {
    authType: AuthType.QWEN_OAUTH,
    name: 'Qwen (OAuth)',
    description: 'Use your qwen.ai account (free tier available)',
    requiresApiKey: false,
    docsUrl: 'https://qwen.ai',
  },
  {
    authType: AuthType.USE_DEEPSEEK,
    name: 'DeepSeek',
    description: 'DeepSeek API - excellent for coding tasks',
    requiresApiKey: true,
    envVar: 'DEEPSEEK_API_KEY',
    apiKeyHint: 'sk-...',
    docsUrl: 'https://platform.deepseek.com',
  },
  {
    authType: AuthType.USE_OPENAI,
    name: 'OpenAI',
    description: 'OpenAI GPT models (GPT-4, etc.)',
    requiresApiKey: true,
    envVar: 'OPENAI_API_KEY',
    apiKeyHint: 'sk-...',
    docsUrl: 'https://platform.openai.com',
  },
  {
    authType: AuthType.USE_ANTHROPIC,
    name: 'Anthropic',
    description: 'Claude models from Anthropic',
    requiresApiKey: true,
    envVar: 'ANTHROPIC_API_KEY',
    apiKeyHint: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com',
  },
  {
    authType: AuthType.USE_OPENROUTER,
    name: 'OpenRouter',
    description: 'Access multiple models via OpenRouter',
    requiresApiKey: true,
    envVar: 'OPENROUTER_API_KEY',
    apiKeyHint: 'sk-or-...',
    docsUrl: 'https://openrouter.ai',
  },
  {
    authType: AuthType.USE_OLLAMA,
    name: 'Ollama (Local)',
    description: 'Run models locally with Ollama (no API key needed)',
    requiresApiKey: false,
    docsUrl: 'https://ollama.ai',
  },
];

/**
 * Get provider info by auth type
 */
export function getProviderInfo(authType: AuthType): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.authType === authType);
}
