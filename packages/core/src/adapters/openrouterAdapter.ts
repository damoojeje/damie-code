/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { OpenAIAdapter } from './openaiAdapter.js';
import { registerAdapter } from './baseAdapter.js';
import type { AdapterConfig, ModelInfo } from './types.js';

/**
 * OpenRouter model definitions (commonly used)
 */
const OPENROUTER_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    provider: 'openrouter',
    displayName: 'Claude 3.5 Sonnet (OpenRouter)',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'openai/gpt-4o',
    provider: 'openrouter',
    displayName: 'GPT-4o (OpenRouter)',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'google/gemini-pro-1.5',
    provider: 'openrouter',
    displayName: 'Gemini Pro 1.5 (OpenRouter)',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct',
    provider: 'openrouter',
    displayName: 'Llama 3.1 405B (OpenRouter)',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'deepseek/deepseek-chat',
    provider: 'openrouter',
    displayName: 'DeepSeek Chat (OpenRouter)',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
  },
];

/**
 * OpenRouter API adapter
 *
 * OpenRouter provides a unified API for multiple LLM providers.
 * It uses an OpenAI-compatible format, so we extend the OpenAI adapter.
 */
export class OpenRouterAdapter extends OpenAIAdapter {
  override readonly provider = 'openrouter';

  constructor(config: Partial<AdapterConfig> = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://openrouter.ai/api',
    });
  }

  protected override getBaseUrl(): string {
    return this.config.baseUrl ?? 'https://openrouter.ai/api';
  }

  protected override getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
      'HTTP-Referer': 'https://github.com/damie-code/damie-code',
      'X-Title': 'Damie Code',
    };
  }

  override getModelInfo(model: string): ModelInfo {
    const found = OPENROUTER_MODELS.find((m) => m.id === model);
    if (found) return found;

    return {
      id: model,
      provider: this.provider,
      contextWindow: 8192,
      supportsTools: true,
      supportsStreaming: true,
    };
  }

  override listModels(): ModelInfo[] {
    return [...OPENROUTER_MODELS];
  }
}

registerAdapter('openrouter', (config) => new OpenRouterAdapter(config));

export default OpenRouterAdapter;
