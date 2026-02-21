/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types - renamed to avoid conflicts with tools/tools.ts
export type {
  MessageRole,
  AdapterToolCall,
  AdapterToolResult,
  ContentPart,
  Message,
  ToolDefinition,
  TokenUsage,
  FinishReason,
  AdapterRequest,
  AdapterResponse,
  StreamChunk,
  ModelInfo,
  AdapterConfig,
  RetryConfig,
} from './types.js';

export { DEFAULT_RETRY_CONFIG, DEFAULT_ADAPTER_CONFIG } from './types.js';

// Base adapter
export type { BaseAdapter, AdapterFactory } from './baseAdapter.js';
export {
  AbstractAdapter,
  registerAdapter,
  createAdapter,
  getRegisteredProviders,
  isProviderRegistered,
} from './baseAdapter.js';

// Errors
export {
  AdapterError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ModelNotFoundError,
  ContextLengthExceededError,
  TimeoutError,
  NetworkError,
  ContentFilterError,
  ServerError,
  QuotaExceededError,
  isAdapterError,
  isRetryableError,
  parseHttpError,
} from './errors.js';

// Retry utilities - renamed to avoid conflicts
export type { RetryContext, RetryOptions as AdapterRetryOptions } from './retry.js';
export {
  withRetry,
  createRetryableFunction,
  retry,
  withRetryAll,
  withRetryAllSettled,
} from './retry.js';

// Streaming utilities
export type { SSEMessage } from './streaming.js';
export {
  parseSSEMessage,
  parseSSEStream,
  parseSSEData,
  streamToAsyncIterator,
  aggregateStreamChunks,
  mapAsyncIterator,
  filterAsyncIterator,
  takeAsyncIterator,
  collectAsyncIterator,
  teeAsyncIterator,
  asyncGeneratorToStream,
} from './streaming.js';

// Provider adapters
export { DeepSeekAdapter } from './deepseekAdapter.js';
export { OpenAIAdapter } from './openaiAdapter.js';
export { AnthropicAdapter } from './anthropicAdapter.js';
export { OpenRouterAdapter } from './openrouterAdapter.js';
export { OllamaAdapter } from './ollamaAdapter.js';

// Adapter factory
export type { ProviderStatus } from './adapterFactory.js';
export {
  getAdapter,
  getAdapterFromConfig,
  getDefaultAdapter,
  getAvailableAdapters,
  clearAdapterCache,
  getProviderStatuses,
} from './adapterFactory.js';
