/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepSeekAdapter } from './deepseekAdapter.js';
import { RateLimitError, AuthenticationError } from './errors.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('DeepSeekAdapter', () => {
  let adapter: DeepSeekAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new DeepSeekAdapter({ apiKey: 'test-api-key' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const a = new DeepSeekAdapter({ apiKey: 'key' });
      expect(a.provider).toBe('deepseek');
    });

    it('should allow custom base URL', () => {
      const a = new DeepSeekAdapter({
        apiKey: 'key',
        baseUrl: 'https://custom.api.com',
      });
      expect(a.provider).toBe('deepseek');
    });
  });

  describe('generateContent', () => {
    it('should generate content successfully', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await adapter.generateContent({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'deepseek-chat',
      });

      expect(response.content).toBe('Hello! How can I help you?');
      expect(response.model).toBe('deepseek-chat');
      expect(response.finishReason).toBe('stop');
      expect(response.usage?.promptTokens).toBe(10);
      expect(response.usage?.completionTokens).toBe(8);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'deepseek-chat',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location": "London"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await adapter.generateContent({
        messages: [{ role: 'user', content: 'What is the weather in London?' }],
        model: 'deepseek-chat',
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather for a location',
            parameters: { type: 'object', properties: { location: { type: 'string' } } },
          },
        ],
      });

      expect(response.finishReason).toBe('tool_calls');
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls?.[0].name).toBe('get_weather');
      expect(response.toolCalls?.[0].arguments).toBe('{"location": "London"}');
    });

    it('should include system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          model: 'deepseek-chat',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
        }),
      });

      await adapter.generateContent({
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'deepseek-chat',
        systemPrompt: 'You are a helpful assistant.',
      });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.messages[0].role).toBe('system');
      expect(requestBody.messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should handle rate limit errors', async () => {
      // Mock to always fail with rate limit
      mockFetch.mockImplementation(async () => ({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '60' }),
        json: async () => ({ error: 'Rate limit exceeded' }),
      }));

      // Create adapter with no retries to avoid timeout
      const noRetryAdapter = new DeepSeekAdapter({ apiKey: 'test-key' });
      noRetryAdapter.updateRetryConfig({ maxRetries: 0 });

      await expect(
        noRetryAdapter.generateContent({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'deepseek-chat',
        }),
      ).rejects.toThrow(RateLimitError);
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid API key' }),
      });

      await expect(
        adapter.generateContent({
          messages: [{ role: 'user', content: 'Hello' }],
          model: 'deepseek-chat',
        }),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  describe('getModelInfo', () => {
    it('should return info for known models', () => {
      const info = adapter.getModelInfo('deepseek-chat');
      expect(info.id).toBe('deepseek-chat');
      expect(info.provider).toBe('deepseek');
      expect(info.contextWindow).toBe(64000);
      expect(info.supportsTools).toBe(true);
    });

    it('should return info for deepseek-coder', () => {
      const info = adapter.getModelInfo('deepseek-coder');
      expect(info.id).toBe('deepseek-coder');
      expect(info.supportsTools).toBe(true);
    });

    it('should return info for deepseek-reasoner', () => {
      const info = adapter.getModelInfo('deepseek-reasoner');
      expect(info.id).toBe('deepseek-reasoner');
      expect(info.supportsTools).toBe(false); // Reasoner doesn't support tools
    });

    it('should return default info for unknown models', () => {
      const info = adapter.getModelInfo('unknown-model');
      expect(info.id).toBe('unknown-model');
      expect(info.provider).toBe('deepseek');
    });
  });

  describe('listModels', () => {
    it('should list all available models', () => {
      const models = adapter.listModels();
      expect(models.length).toBeGreaterThan(0);
      expect(models.map((m) => m.id)).toContain('deepseek-chat');
      expect(models.map((m) => m.id)).toContain('deepseek-coder');
      expect(models.map((m) => m.id)).toContain('deepseek-reasoner');
    });
  });

  describe('countTokens', () => {
    it('should estimate token count', async () => {
      const count = await adapter.countTokens('Hello world');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('validateConfig', () => {
    it('should return true when API key is set', () => {
      expect(adapter.validateConfig()).toBe(true);
    });

    it('should return false when API key is missing', () => {
      const noKeyAdapter = new DeepSeekAdapter({});
      expect(noKeyAdapter.validateConfig()).toBe(false);
    });
  });
});
