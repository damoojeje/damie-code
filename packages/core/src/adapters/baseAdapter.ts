/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AdapterConfig,
  AdapterRequest,
  AdapterResponse,
  ModelInfo,
  StreamChunk,
  RetryConfig,
} from './types.js';
import { DEFAULT_ADAPTER_CONFIG, DEFAULT_RETRY_CONFIG } from './types.js';
import { withRetry } from './retry.js';
import { aggregateStreamChunks } from './streaming.js';
import { AdapterError, TimeoutError, NetworkError } from './errors.js';

/**
 * Base adapter interface that all API providers must implement
 */
export interface BaseAdapter {
  /** Provider identifier (e.g., 'openai', 'anthropic', 'deepseek') */
  readonly provider: string;

  /**
   * Generate content (non-streaming)
   * @param request - The generation request
   * @returns The complete response
   */
  generateContent(request: AdapterRequest): Promise<AdapterResponse>;

  /**
   * Generate content with streaming
   * @param request - The generation request
   * @returns An async generator yielding chunks
   */
  streamContent(request: AdapterRequest): AsyncGenerator<StreamChunk>;

  /**
   * Count tokens in text
   * @param text - Text to count tokens for
   * @param model - Optional model for accurate counting
   * @returns Estimated token count
   */
  countTokens(text: string, model?: string): Promise<number>;

  /**
   * Get information about a model
   * @param model - Model identifier
   * @returns Model information
   */
  getModelInfo(model: string): ModelInfo;

  /**
   * Validate the adapter configuration
   * @returns True if configuration is valid
   */
  validateConfig(): boolean;

  /**
   * List available models for this provider
   * @returns Array of model information
   */
  listModels(): ModelInfo[];
}

/**
 * Abstract base class providing common adapter functionality
 */
export abstract class AbstractAdapter implements BaseAdapter {
  abstract readonly provider: string;

  protected config: AdapterConfig;
  protected retryConfig: RetryConfig;

  constructor(config: Partial<AdapterConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTER_CONFIG, ...config };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG };
  }

  /**
   * Generate content with automatic retries
   */
  async generateContent(request: AdapterRequest): Promise<AdapterResponse> {
    // If streaming is requested, aggregate the stream
    if (request.stream) {
      return aggregateStreamChunks(this.streamContent(request));
    }

    return withRetry(
      () => this.doGenerateContent(request),
      {
        config: this.retryConfig,
        onRetry: (ctx) => {
          console.warn(
            `[${this.provider}] Retry attempt ${ctx.attempt + 1}/${ctx.maxAttempts}: ${ctx.lastError?.message}`,
          );
        },
      },
    );
  }

  /**
   * Stream content with automatic retries on initial connection
   */
  async *streamContent(request: AdapterRequest): AsyncGenerator<StreamChunk> {
    // Retry only the initial connection, not individual chunks
    const stream = await withRetry(
      () => this.doStreamContent(request),
      {
        config: { ...this.retryConfig, maxRetries: 1 },
      },
    );

    yield* stream;
  }

  /**
   * Implementation-specific content generation
   * Subclasses must implement this
   */
  protected abstract doGenerateContent(
    request: AdapterRequest,
  ): Promise<AdapterResponse>;

  /**
   * Implementation-specific streaming
   * Subclasses must implement this
   */
  protected abstract doStreamContent(
    request: AdapterRequest,
  ): Promise<AsyncGenerator<StreamChunk>>;

  /**
   * Count tokens - default implementation uses rough estimation
   * Subclasses can override with provider-specific tokenizer
   */
  async countTokens(text: string, _model?: string): Promise<number> {
    // Rough estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  /**
   * Get model info - must be implemented by subclasses
   */
  abstract getModelInfo(model: string): ModelInfo;

  /**
   * List available models - must be implemented by subclasses
   */
  abstract listModels(): ModelInfo[];

  /**
   * Validate configuration
   */
  validateConfig(): boolean {
    // Base validation - check API key for non-local providers
    if (this.provider !== 'ollama' && !this.config.apiKey) {
      return false;
    }
    return true;
  }

  /**
   * Get the configured API key
   */
  protected getApiKey(): string {
    if (!this.config.apiKey) {
      throw new AdapterError('API key not configured', {
        code: 'CONFIGURATION_ERROR',
        provider: this.provider,
        retryable: false,
      });
    }
    return this.config.apiKey;
  }

  /**
   * Get the base URL for API requests
   */
  protected abstract getBaseUrl(): string;

  /**
   * Make an HTTP request with timeout and error handling
   */
  protected async makeRequest(
    url: string,
    options: RequestInit,
  ): Promise<Response> {
    const timeout = this.config.timeout ?? DEFAULT_ADAPTER_CONFIG.timeout!;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...this.config.customHeaders,
          ...options.headers,
        },
      });

      return response;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new TimeoutError(this.provider, timeout);
        }
        throw new NetworkError(this.provider, error.message, error);
      }
      throw new NetworkError(this.provider, String(error));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get authentication headers
   * Subclasses can override for custom auth schemes
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getApiKey()}`,
    };
  }

  /**
   * Update adapter configuration
   */
  updateConfig(config: Partial<AdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update retry configuration
   */
  updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }
}

/**
 * Factory function type for creating adapters
 */
export type AdapterFactory = (config?: Partial<AdapterConfig>) => BaseAdapter;

/**
 * Registry for adapter factories
 */
const adapterRegistry = new Map<string, AdapterFactory>();

/**
 * Register an adapter factory
 */
export function registerAdapter(provider: string, factory: AdapterFactory): void {
  adapterRegistry.set(provider, factory);
}

/**
 * Create an adapter instance
 */
export function createAdapter(
  provider: string,
  config?: Partial<AdapterConfig>,
): BaseAdapter {
  const factory = adapterRegistry.get(provider);
  if (!factory) {
    throw new AdapterError(`Unknown provider: ${provider}`, {
      code: 'UNKNOWN_PROVIDER',
      provider,
      retryable: false,
    });
  }
  return factory(config);
}

/**
 * Get list of registered providers
 */
export function getRegisteredProviders(): string[] {
  return Array.from(adapterRegistry.keys());
}

/**
 * Check if a provider is registered
 */
export function isProviderRegistered(provider: string): boolean {
  return adapterRegistry.has(provider);
}
