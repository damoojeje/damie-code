/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@damie-code/damie-code-core';
import { loadEnvironment, loadSettings } from './settings.js';

export function validateAuthMethod(authMethod: string): string | null {
  loadEnvironment(loadSettings().merged);
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env['GEMINI_API_KEY']) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env['GOOGLE_CLOUD_PROJECT'] &&
      !!process.env['GOOGLE_CLOUD_LOCATION'];
    const hasGoogleApiKey = !!process.env['GOOGLE_API_KEY'];
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENAI) {
    if (!process.env['OPENAI_API_KEY']) {
      return 'OPENAI_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.QWEN_OAUTH) {
    // Qwen OAuth doesn't require any environment variables for basic setup
    // The OAuth flow will handle authentication
    return null;
  }

  // Damie Code additions
  if (authMethod === AuthType.USE_DEEPSEEK) {
    if (!process.env['DEEPSEEK_API_KEY']) {
      return 'DEEPSEEK_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.USE_ANTHROPIC) {
    if (!process.env['ANTHROPIC_API_KEY']) {
      return 'ANTHROPIC_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENROUTER) {
    if (!process.env['OPENROUTER_API_KEY']) {
      return 'OPENROUTER_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.USE_OLLAMA) {
    // Ollama runs locally, no API key needed
    // We could check if Ollama is running here, but that would slow down startup
    return null;
  }

  return 'Invalid auth method selected.';
}

export const setOpenAIApiKey = (apiKey: string): void => {
  process.env['OPENAI_API_KEY'] = apiKey;
};

export const setOpenAIBaseUrl = (baseUrl: string): void => {
  process.env['OPENAI_BASE_URL'] = baseUrl;
};

export const setOpenAIModel = (model: string): void => {
  process.env['OPENAI_MODEL'] = model;
};

// DeepSeek helpers
export const setDeepSeekApiKey = (apiKey: string): void => {
  process.env['DEEPSEEK_API_KEY'] = apiKey;
};

// Anthropic helpers
export const setAnthropicApiKey = (apiKey: string): void => {
  process.env['ANTHROPIC_API_KEY'] = apiKey;
};

// OpenRouter helpers
export const setOpenRouterApiKey = (apiKey: string): void => {
  process.env['OPENROUTER_API_KEY'] = apiKey;
};

// Ollama helpers
export const setOllamaBaseUrl = (baseUrl: string): void => {
  process.env['OLLAMA_BASE_URL'] = baseUrl;
};

export const setOllamaModel = (model: string): void => {
  process.env['OLLAMA_MODEL'] = model;
};
