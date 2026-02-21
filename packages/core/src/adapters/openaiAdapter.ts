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
 * OpenAI API message format
 */
interface OpenAIMessage {
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
 * OpenAI API request format
 */
interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
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
 * OpenAI API response format
 */
interface OpenAIResponse {
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
 * OpenAI streaming chunk format
 */
interface OpenAIStreamChunk {
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
 * OpenAI model definitions
 */
const OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    provider: 'openai',
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 2.5,
    outputCostPer1M: 10,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 0.15,
    outputCostPer1M: 0.6,
  },
  {
    id: 'gpt-4-turbo',
    provider: 'openai',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 10,
    outputCostPer1M: 30,
  },
  {
    id: 'gpt-4',
    provider: 'openai',
    displayName: 'GPT-4',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
    inputCostPer1M: 30,
    outputCostPer1M: 60,
  },
  {
    id: 'gpt-3.5-turbo',
    provider: 'openai',
    displayName: 'GPT-3.5 Turbo',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: false,
    inputCostPer1M: 0.5,
    outputCostPer1M: 1.5,
  },
];

/**
 * OpenAI API adapter
 */
export class OpenAIAdapter extends AbstractAdapter {
  readonly provider: string = 'openai';

  constructor(config: Partial<AdapterConfig> = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.openai.com',
    });
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'https://api.openai.com';
  }

  protected override getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.getApiKey()}`,
    };
    if (this.config.organizationId) {
      headers['OpenAI-Organization'] = this.config.organizationId;
    }
    return headers;
  }

  private toOpenAIMessage(message: Message): OpenAIMessage {
    const content = typeof message.content === 'string'
      ? message.content
      : message.content.map((p) => p.type === 'text' ? p.text : '').join('');

    const oaiMessage: OpenAIMessage = {
      role: message.role as OpenAIMessage['role'],
      content,
    };

    if (message.toolCalls && message.toolCalls.length > 0) {
      oaiMessage.tool_calls = message.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
      oaiMessage.content = null;
    }

    if (message.role === 'tool' && message.toolResults && message.toolResults.length > 0) {
      oaiMessage.tool_call_id = message.toolResults[0].toolCallId;
      oaiMessage.content = message.toolResults[0].content;
    }

    return oaiMessage;
  }

  private toOpenAITools(tools: ToolDefinition[]): OpenAIRequest['tools'] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  private parseFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }

  private parseUsage(usage?: OpenAIResponse['usage']): TokenUsage | undefined {
    if (!usage) return undefined;
    return {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }

  private parseToolCalls(
    toolCalls?: OpenAIResponse['choices'][0]['message']['tool_calls'],
  ): AdapterToolCall[] | undefined {
    if (!toolCalls || toolCalls.length === 0) return undefined;
    return toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  protected async doGenerateContent(request: AdapterRequest): Promise<AdapterResponse> {
    const messages = request.messages.map((m) => this.toOpenAIMessage(m));

    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const body: OpenAIRequest = {
      model: request.model,
      messages,
      stream: false,
    };

    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toOpenAITools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/chat/completions`,
      { method: 'POST', body: JSON.stringify(body) },
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(this.provider, 'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined);
      }
      const errorBody = await response.json().catch(() => ({}));
      throw parseHttpError(this.provider, response.status, errorBody);
    }

    const data: OpenAIResponse = await response.json();
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

  protected async doStreamContent(request: AdapterRequest): Promise<AsyncGenerator<StreamChunk>> {
    const messages = request.messages.map((m) => this.toOpenAIMessage(m));

    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const body: OpenAIRequest = {
      model: request.model,
      messages,
      stream: true,
    };

    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toOpenAITools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/chat/completions`,
      { method: 'POST', body: JSON.stringify(body) },
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        throw new RateLimitError(this.provider, 'Rate limit exceeded',
          retryAfter ? parseInt(retryAfter, 10) : undefined);
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
        const chunk = parseSSEData<OpenAIStreamChunk>(sseMessage.data);
        if (!chunk) continue;

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        let toolCalls: Array<Partial<AdapterToolCall>> | undefined;

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
          finishReason: choice.finish_reason ? parseFinishReason(choice.finish_reason) : undefined,
          usage: parseUsage(chunk.usage),
          done: choice.finish_reason !== null,
        };
      }
    }

    return parseStream();
  }

  getModelInfo(model: string): ModelInfo {
    const found = OPENAI_MODELS.find((m) => m.id === model);
    if (found) return found;

    return {
      id: model,
      provider: this.provider,
      contextWindow: 8192,
      supportsTools: true,
      supportsStreaming: true,
    };
  }

  listModels(): ModelInfo[] {
    return [...OPENAI_MODELS];
  }

  override async countTokens(text: string, _model?: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

registerAdapter('openai', (config) => new OpenAIAdapter(config));

export default OpenAIAdapter;
