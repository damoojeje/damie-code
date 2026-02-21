/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { AbstractAdapter, registerAdapter } from './baseAdapter.js';
import type {
  AdapterConfig,
  AdapterRequest,
  AdapterResponse,
  StreamChunk,
  ModelInfo,
  AdapterToolCall,
  Message,
  ToolDefinition,
  TokenUsage,
  FinishReason,
} from './types.js';
import { parseHttpError, RateLimitError } from './errors.js';
import { parseSSEStream, parseSSEData } from './streaming.js';

/**
 * DeepSeek API message format
 */
interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * DeepSeek API request format
 */
interface DeepSeekRequest {
  model: string;
  messages: DeepSeekMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

/**
 * DeepSeek API response format
 */
interface DeepSeekResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * DeepSeek streaming chunk format
 */
interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * DeepSeek model definitions
 */
const DEEPSEEK_MODELS: ModelInfo[] = [
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    displayName: 'DeepSeek Chat',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  {
    id: 'deepseek-coder',
    provider: 'deepseek',
    displayName: 'DeepSeek Coder',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
    inputCostPer1M: 0.14,
    outputCostPer1M: 0.28,
  },
  {
    id: 'deepseek-reasoner',
    provider: 'deepseek',
    displayName: 'DeepSeek Reasoner',
    contextWindow: 64000,
    maxOutputTokens: 8192,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
  },
];

/**
 * DeepSeek API adapter
 */
export class DeepSeekAdapter extends AbstractAdapter {
  readonly provider = 'deepseek';

  constructor(config: Partial<AdapterConfig> = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com',
    });
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'https://api.deepseek.com';
  }

  /**
   * Convert internal message format to DeepSeek format
   */
  private toDeepSeekMessage(message: Message): DeepSeekMessage {
    const content = typeof message.content === 'string'
      ? message.content
      : message.content.map((p) => p.type === 'text' ? p.text : '').join('');

    const dsMessage: DeepSeekMessage = {
      role: message.role as DeepSeekMessage['role'],
      content,
    };

    if (message.toolCalls && message.toolCalls.length > 0) {
      dsMessage.tool_calls = message.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
      dsMessage.content = null;
    }

    if (message.role === 'tool' && message.toolResults && message.toolResults.length > 0) {
      dsMessage.tool_call_id = message.toolResults[0].toolCallId;
      dsMessage.content = message.toolResults[0].content;
    }

    return dsMessage;
  }

  /**
   * Convert tool definitions to DeepSeek format
   */
  private toDeepSeekTools(tools: ToolDefinition[]): DeepSeekRequest['tools'] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Parse finish reason from DeepSeek format
   */
  private parseFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  /**
   * Parse usage from DeepSeek format
   */
  private parseUsage(usage?: DeepSeekResponse['usage']): TokenUsage | undefined {
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  /**
   * Parse tool calls from DeepSeek format
   */
  private parseToolCalls(
    toolCalls?: DeepSeekResponse['choices'][0]['message']['tool_calls'],
  ): AdapterToolCall[] | undefined {
    if (!toolCalls || toolCalls.length === 0) return undefined;
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  protected async doGenerateContent(
    request: AdapterRequest,
  ): Promise<AdapterResponse> {
    const messages = request.messages.map((m) => this.toDeepSeekMessage(m));

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    const body: DeepSeekRequest = {
      model: request.model,
      messages,
      stream: false,
    };

    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toDeepSeekTools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/chat/completions`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      // Check for rate limit
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(
          this.provider,
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
        );
      }
      const errorBody = await response.json().catch(() => ({}));
      throw parseHttpError(this.provider, response.status, errorBody);
    }

    const data: DeepSeekResponse = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content ?? '',
      model: data.model,
      id: data.id,
      finishReason: this.parseFinishReason(choice.finish_reason),
      usage: this.parseUsage(data.usage),
      toolCalls: this.parseToolCalls(choice.message.tool_calls),
    };
  }

  protected async doStreamContent(
    request: AdapterRequest,
  ): Promise<AsyncGenerator<StreamChunk>> {
    const messages = request.messages.map((m) => this.toDeepSeekMessage(m));

    if (request.systemPrompt) {
      messages.unshift({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    const body: DeepSeekRequest = {
      model: request.model,
      messages,
      stream: true,
    };

    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toDeepSeekTools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/chat/completions`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(
          this.provider,
          'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined,
        );
      }
      const errorBody = await response.json().catch(() => ({}));
      throw parseHttpError(this.provider, response.status, errorBody);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const parseFinishReason = this.parseFinishReason.bind(this);
    const parseUsage = this.parseUsage.bind(this);
    const responseBody = response.body;

    async function* parseStream(): AsyncGenerator<StreamChunk> {
      const sseStream = parseSSEStream(responseBody);
      const toolCallsAccum: Map<number, Partial<AdapterToolCall>> = new Map();

      for await (const sseMessage of sseStream) {
        const chunk = parseSSEData<DeepSeekStreamChunk>(sseMessage.data);
        if (!chunk) continue;

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        let toolCalls: Array<Partial<AdapterToolCall>> | undefined;

        // Accumulate tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCallsAccum.get(tc.index) || {};
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments) {
              existing.arguments = (existing.arguments || '') + tc.function.arguments;
            }
            toolCallsAccum.set(tc.index, existing);
          }
          toolCalls = Array.from(toolCallsAccum.values());
        }

        yield {
          delta: delta.content || '',
          toolCalls,
          finishReason: choice.finish_reason
            ? parseFinishReason(choice.finish_reason)
            : undefined,
          usage: parseUsage(chunk.usage),
          done: choice.finish_reason !== null,
        };
      }
    }

    return parseStream();
  }

  getModelInfo(model: string): ModelInfo {
    const found = DEEPSEEK_MODELS.find((m) => m.id === model);
    if (found) return found;

    // Return default info for unknown models
    return {
      id: model,
      provider: this.provider,
      contextWindow: 64000,
      supportsTools: true,
      supportsStreaming: true,
    };
  }

  listModels(): ModelInfo[] {
    return [...DEEPSEEK_MODELS];
  }

  /**
   * Count tokens using rough estimation
   * DeepSeek uses a tokenizer similar to GPT, ~4 chars per token
   */
  override async countTokens(text: string, _model?: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

// Register the adapter
registerAdapter('deepseek', (config) => new DeepSeekAdapter(config));

export default DeepSeekAdapter;
