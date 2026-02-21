/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@damie-code/damie-code-core';
import { getProviderInfo } from './types.js';

/**
 * Result of API key validation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  model?: string;
}

/**
 * Validate an API key by making a test request
 */
export async function validateApiKey(
  provider: AuthType,
  apiKey: string,
): Promise<ValidationResult> {
  const providerInfo = getProviderInfo(provider);

  if (!providerInfo) {
    return { valid: false, error: 'Unknown provider' };
  }

  // Providers that don't require API keys
  if (!providerInfo.requiresApiKey) {
    return { valid: true };
  }

  // Basic format validation
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  try {
    switch (provider) {
      case AuthType.USE_DEEPSEEK:
        return await validateDeepSeekKey(apiKey);
      case AuthType.USE_OPENAI:
        return await validateOpenAIKey(apiKey);
      case AuthType.USE_ANTHROPIC:
        return await validateAnthropicKey(apiKey);
      case AuthType.USE_OPENROUTER:
        return await validateOpenRouterKey(apiKey);
      default:
        // For other providers, just check if key is non-empty
        return { valid: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { valid: false, error: message };
  }
}

/**
 * Validate DeepSeek API key
 */
async function validateDeepSeekKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true, model: 'deepseek-chat' };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (_error) {
    return { valid: false, error: 'Failed to connect to DeepSeek API' };
  }
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAIKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true, model: 'gpt-4' };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (_error) {
    return { valid: false, error: 'Failed to connect to OpenAI API' };
  }
}

/**
 * Validate Anthropic API key
 */
async function validateAnthropicKey(apiKey: string): Promise<ValidationResult> {
  try {
    // Anthropic doesn't have a /models endpoint, so we make a minimal request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    // A 400 (bad request) still means the key is valid
    // Only 401 means invalid key
    if (response.ok || response.status === 400) {
      return { valid: true, model: 'claude-3-5-sonnet-20241022' };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (_error) {
    return { valid: false, error: 'Failed to connect to Anthropic API' };
  }
}

/**
 * Validate OpenRouter API key
 */
async function validateOpenRouterKey(apiKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { valid: true, model: 'anthropic/claude-3.5-sonnet' };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: `API error: ${response.status}` };
  } catch (_error) {
    return { valid: false, error: 'Failed to connect to OpenRouter API' };
  }
}

/**
 * Check if Ollama is running locally
 */
export async function validateOllama(): Promise<ValidationResult> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');

    if (response.ok) {
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];
      if (models.length > 0) {
        return { valid: true, model: models[0].name };
      }
      return {
        valid: true,
        error: 'Ollama is running but no models are installed. Run: ollama pull llama3.1',
      };
    }

    return { valid: false, error: 'Ollama is not responding' };
  } catch (_error) {
    return {
      valid: false,
      error: 'Ollama is not running. Start it with: ollama serve',
    };
  }
}
