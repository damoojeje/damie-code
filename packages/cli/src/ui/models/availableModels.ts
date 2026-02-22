/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, DEFAULT_QWEN_MODEL } from '@damie-code/damie-code-core';

export type AvailableModel = {
  id: string;
  label: string;
  description?: string;
  isVision?: boolean;
};

export const MAINLINE_VLM = 'vision-model';
export const MAINLINE_CODER = DEFAULT_QWEN_MODEL;

export const AVAILABLE_MODELS_QWEN: AvailableModel[] = [
  {
    id: MAINLINE_CODER,
    label: MAINLINE_CODER,
    description: 'The default Damie Code coding model',
  },
  {
    id: MAINLINE_VLM,
    label: MAINLINE_VLM,
    description: 'The default Damie Code vision model',
    isVision: true,
  },
];

/**
 * DeepSeek models optimized for different tasks
 */
export const AVAILABLE_MODELS_DEEPSEEK: AvailableModel[] = [
  {
    id: 'deepseek-chat',
    label: 'DeepSeek Chat',
    description: 'Best for general tasks and conversation',
  },
  {
    id: 'deepseek-coder',
    label: 'DeepSeek Coder',
    description: 'Optimized for code generation and understanding',
  },
  {
    id: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner',
    description: 'Advanced reasoning and complex problem solving',
  },
];

/**
 * Anthropic Claude models with different capabilities
 */
export const AVAILABLE_MODELS_ANTHROPIC: AvailableModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    description: 'Best overall - balanced performance and speed',
  },
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    description: 'Most powerful - complex tasks and analysis',
  },
  {
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    description: 'Fast & efficient - quick responses',
  },
  {
    id: 'claude-3-sonnet-20240229',
    label: 'Claude 3 Sonnet',
    description: 'Balanced performance for most tasks',
  },
];

/**
 * OpenRouter models - access to multiple providers
 */
export const AVAILABLE_MODELS_OPENROUTER: AvailableModel[] = [
  {
    id: 'anthropic/claude-3-5-sonnet',
    label: 'Claude 3.5 Sonnet',
    description: 'Best overall via OpenRouter',
  },
  {
    id: 'openai/gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'OpenAI flagship model',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    description: 'OpenAI latest multimodal model',
  },
  {
    id: 'meta-llama/llama-3-70b-instruct',
    label: 'Llama 3 70B',
    description: 'Open source - excellent performance',
  },
  {
    id: 'google/gemini-pro-1.5',
    label: 'Gemini Pro 1.5',
    description: 'Google latest with large context',
  },
  {
    id: 'mistralai/mistral-large',
    label: 'Mistral Large',
    description: 'Mistral AI flagship model',
  },
];

/**
 * Ollama local models - runs on your machine
 */
export const AVAILABLE_MODELS_OLLAMA: AvailableModel[] = [
  {
    id: 'codellama',
    label: 'Code Llama',
    description: 'Coding focused - great for development',
  },
  {
    id: 'llama3.1',
    label: 'Llama 3.1',
    description: 'General purpose - balanced performance',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    description: 'Fast & efficient - good for quick tasks',
  },
  {
    id: 'phi3',
    label: 'Phi-3',
    description: 'Microsoft small model - very fast',
  },
  {
    id: 'gemma2',
    label: 'Gemma 2',
    description: 'Google open model - good quality',
  },
  {
    id: 'qwen2',
    label: 'Qwen 2',
    description: 'Alibaba open model - multilingual',
  },
];

/**
 * Get available Qwen models filtered by vision model preview setting
 */
export function getFilteredQwenModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_QWEN;
  }
  return AVAILABLE_MODELS_QWEN.filter((model) => !model.isVision);
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

/**
 * Get available models for a specific auth type
 * Returns comprehensive model lists for all supported providers
 */
export function getAvailableModelsForAuthType(
  authType: AuthType,
): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_QWEN;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    case AuthType.USE_DEEPSEEK:
      return AVAILABLE_MODELS_DEEPSEEK;
    case AuthType.USE_ANTHROPIC:
      return AVAILABLE_MODELS_ANTHROPIC;
    case AuthType.USE_OPENROUTER:
      return AVAILABLE_MODELS_OPENROUTER;
    case AuthType.USE_OLLAMA:
      return AVAILABLE_MODELS_OLLAMA;
    default:
      return [];
  }
}

/**
 * Get default model for a specific auth type
 * Used when no model is configured
 */
export function getDefaultModelForAuthType(authType: AuthType): string {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return MAINLINE_CODER;
    case AuthType.USE_OPENAI:
      return process.env['OPENAI_MODEL'] || 'gpt-4';
    case AuthType.USE_DEEPSEEK:
      return 'deepseek-chat';
    case AuthType.USE_ANTHROPIC:
      return 'claude-3-5-sonnet-20241022';
    case AuthType.USE_OPENROUTER:
      return 'anthropic/claude-3-5-sonnet';
    case AuthType.USE_OLLAMA:
      return 'codellama';
    default:
      return MAINLINE_CODER;
  }
}

/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_QWEN.some(
    (model) => model.id === modelId && model.isVision,
  );
}
