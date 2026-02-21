/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AbstractAdapter,
  registerAdapter,
  createAdapter,
  getRegisteredProviders,
  isProviderRegistered,
} from './baseAdapter.js';
import type {
  AdapterRequest,
  AdapterResponse,
  StreamChunk,
  ModelInfo,
  AdapterConfig,
} from './types.js';
import {
  AdapterError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  NetworkError,
} from './errors.js';
import { withRetry, createRetryableFunction } from './retry.js';
import {
  parseSSEMessage,
  parseSSEData,
  aggregateStreamChunks,
} from './streaming.js';

// Mock implementation of AbstractAdapter for testing
class MockAdapter extends AbstractAdapter {
  readonly provider = 'mock';
  private shouldFail = false;
  private failureType: 'auth' | 'rate' | 'timeout' | 'network' | null = null;
  private callCount = 0;
  private failUntilAttempt = 0;

  constructor(config: Partial<AdapterConfig> = {}) {
    super(config);
  }

  setFailure(type: 'auth' | 'rate' | 'timeout' | 'network' | null, failUntilAttempt = 0): void {
    this.failureType = type;
    this.shouldFail = type !== null;
    this.failUntilAttempt = failUntilAttempt;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  getCallCount(): number {
    return this.callCount;
  }

  protected getBaseUrl(): string {
    return 'https://api.mock.com';
  }

  protected async doGenerateContent(request: AdapterRequest): Promise<AdapterResponse> {
    this.callCount++;

    if (this.shouldFail && this.callCount <= this.failUntilAttempt) {
      switch (this.failureType) {
        case 'auth':
          throw new AuthenticationError(this.provider);
        case 'rate':
          throw new RateLimitError(this.provider);
        case 'timeout':
          throw new TimeoutError(this.provider, 5000);
        case 'network':
          throw new NetworkError(this.provider);
        default:
          break;
      }
    }

    return {
      content: `Response to: ${request.messages[0]?.content || 'empty'}`,
      model: request.model,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  protected async doStreamContent(
    _request: AdapterRequest,
  ): Promise<AsyncGenerator<StreamChunk>> {
    this.callCount++;
    const shouldFail = this.shouldFail;
    const provider = this.provider;

    async function* generator(): AsyncGenerator<StreamChunk> {
      if (shouldFail) {
        throw new NetworkError(provider);
      }

      const words = ['Hello', ' ', 'world', '!'];
      for (const word of words) {
        yield { delta: word };
      }
      yield {
        delta: '',
        finishReason: 'stop',
        done: true,
        usage: {
          promptTokens: 5,
          completionTokens: 4,
          totalTokens: 9,
        },
      };
    }

    return generator();
  }

  getModelInfo(model: string): ModelInfo {
    return {
      id: model,
      provider: this.provider,
      contextWindow: 4096,
      supportsTools: true,
      supportsStreaming: true,
    };
  }

  listModels(): ModelInfo[] {
    return [
      this.getModelInfo('mock-small'),
      this.getModelInfo('mock-large'),
    ];
  }
}

describe('AbstractAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(() => {
    adapter = new MockAdapter({ apiKey: 'test-key' });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const response = await adapter.generateContent({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'mock-model',
      });

      expect(response.content).toBe('Response to: Hello');
      expect(response.model).toBe('mock-model');
      expect(response.finishReason).toBe('stop');
    });

    it('should include usage statistics', async () => {
      const response = await adapter.generateContent({
        messages: [{ role: 'user', content: 'Test' }],
        model: 'mock-model',
      });

      expect(response.usage).toBeDefined();
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(20);
      expect(response.usage?.totalTokens).toBe(30);
    });
  });

  describe('streamContent', () => {
    it('should stream content as chunks', async () => {
      const chunks: StreamChunk[] = [];
      for await (const chunk of adapter.streamContent({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'mock-model',
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(5);
      expect(chunks.map((c) => c.delta).join('')).toBe('Hello world!');
      expect(chunks[chunks.length - 1].done).toBe(true);
    });

    it('should include finish reason on last chunk', async () => {
      const chunks: StreamChunk[] = [];
      for await (const chunk of adapter.streamContent({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'mock-model',
      })) {
        chunks.push(chunk);
      }

      const lastChunk = chunks[chunks.length - 1];
      expect(lastChunk.finishReason).toBe('stop');
    });
  });

  describe('countTokens', () => {
    it('should estimate token count', async () => {
      const count = await adapter.countTokens('Hello world');
      // Default implementation: ~4 chars per token
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('getModelInfo', () => {
    it('should return model information', () => {
      const info = adapter.getModelInfo('mock-model');

      expect(info.id).toBe('mock-model');
      expect(info.provider).toBe('mock');
      expect(info.contextWindow).toBe(4096);
      expect(info.supportsTools).toBe(true);
      expect(info.supportsStreaming).toBe(true);
    });
  });

  describe('listModels', () => {
    it('should list available models', () => {
      const models = adapter.listModels();

      expect(models.length).toBe(2);
      expect(models.map((m) => m.id)).toContain('mock-small');
      expect(models.map((m) => m.id)).toContain('mock-large');
    });
  });

  describe('validateConfig', () => {
    it('should return true when API key is set', () => {
      expect(adapter.validateConfig()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      const noKeyAdapter = new MockAdapter({});
      expect(noKeyAdapter.validateConfig()).toBe(false);
    });
  });
});

describe('Error handling', () => {
  it('should throw AuthenticationError for auth failures', () => {
    const error = new AuthenticationError('test', 'Invalid API key');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.provider).toBe('test');
    expect(error.retryable).toBe(false);
    expect(error.statusCode).toBe(401);
  });

  it('should throw RateLimitError with retry info', () => {
    const error = new RateLimitError('test', 'Too many requests', 60);
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(60);
  });

  it('should throw TimeoutError with duration', () => {
    const error = new TimeoutError('test', 5000);
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.retryable).toBe(true);
    expect(error.timeoutMs).toBe(5000);
  });

  it('should throw NetworkError as retryable', () => {
    const error = new NetworkError('test', 'Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.retryable).toBe(true);
  });
});

describe('Retry logic', () => {
  it('should retry on retryable errors', async () => {
    let attempts = 0;
    const fn = async (): Promise<string> => {
      attempts++;
      if (attempts < 3) {
        throw new RateLimitError('test');
      }
      return 'success';
    };

    const result = await withRetry(fn, {
      config: { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, jitter: false, retryableErrors: [] },
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should not retry on non-retryable errors', async () => {
    let attempts = 0;
    const fn = async (): Promise<string> => {
      attempts++;
      throw new AuthenticationError('test');
    };

    await expect(withRetry(fn, {
      config: { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, jitter: false, retryableErrors: [] },
    })).rejects.toThrow(AuthenticationError);

    expect(attempts).toBe(1);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    let attempts = 0;
    const fn = async (): Promise<string> => {
      attempts++;
      if (attempts < 2) {
        throw new NetworkError('test');
      }
      return 'success';
    };

    await withRetry(fn, {
      config: { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, jitter: false, retryableErrors: [] },
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should create retryable function', async () => {
    let attempts = 0;
    const originalFn = async (x: number): Promise<number> => {
      attempts++;
      if (attempts < 2) {
        throw new NetworkError('test');
      }
      return x * 2;
    };

    const retryableFn = createRetryableFunction(originalFn, {
      config: { maxRetries: 3, initialDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2, jitter: false, retryableErrors: [] },
    });

    const result = await retryableFn(5);
    expect(result).toBe(10);
    expect(attempts).toBe(2);
  });
});

describe('SSE parsing', () => {
  it('should parse SSE message', () => {
    const message = parseSSEMessage('event: message\ndata: {"text": "hello"}\nid: 123');

    expect(message).not.toBeNull();
    expect(message?.event).toBe('message');
    expect(message?.data).toBe('{"text": "hello"}');
    expect(message?.id).toBe('123');
  });

  it('should parse SSE data as JSON', () => {
    const data = parseSSEData<{ text: string }>('{"text": "hello"}');

    expect(data).toEqual({ text: 'hello' });
  });

  it('should handle [DONE] signal', () => {
    const data = parseSSEData('[DONE]');

    expect(data).toBeNull();
  });

  it('should return null for invalid JSON', () => {
    const data = parseSSEData('not json');

    expect(data).toBeNull();
  });
});

describe('Stream aggregation', () => {
  it('should aggregate stream chunks', async () => {
    async function* mockStream(): AsyncGenerator<StreamChunk> {
      yield { delta: 'Hello' };
      yield { delta: ' ' };
      yield { delta: 'world' };
      yield { delta: '', finishReason: 'stop', done: true };
    }

    const response = await aggregateStreamChunks(mockStream());

    expect(response.content).toBe('Hello world');
    expect(response.finishReason).toBe('stop');
  });
});

describe('Adapter registry', () => {
  beforeEach(() => {
    // Clear any registered adapters from previous tests
    // Note: The registry is module-scoped, so we work with what's there
  });

  it('should register and create adapters', () => {
    registerAdapter('test-provider', (config) => new MockAdapter(config));

    expect(isProviderRegistered('test-provider')).toBe(true);

    const adapter = createAdapter('test-provider', { apiKey: 'key' });
    expect(adapter.provider).toBe('mock');
  });

  it('should list registered providers', () => {
    registerAdapter('another-provider', (config) => new MockAdapter(config));

    const providers = getRegisteredProviders();
    expect(providers).toContain('another-provider');
  });

  it('should throw for unknown provider', () => {
    expect(() => createAdapter('unknown-provider')).toThrow(AdapterError);
  });
});
