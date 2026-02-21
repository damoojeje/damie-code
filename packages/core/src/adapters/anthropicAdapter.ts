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
 * Anthropic content block types
 */
type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

/**
 * Anthropic API message format
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

/**
 * Anthropic API request format
 */
interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  tools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
}

/**
 * Anthropic API response format
 */
interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic streaming event types
 */
interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: {
    type: string;
    text?: string;
    partial_json?: string;
  };
  message?: AnthropicResponse;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic model definitions
 */
const ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 0.8,
    outputCostPer1M: 4,
  },
  {
    id: 'claude-3-opus-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 15,
    outputCostPer1M: 75,
  },
  {
    id: 'claude-3-sonnet-20240229',
    provider: 'anthropic',
    displayName: 'Claude 3 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 3,
    outputCostPer1M: 15,
  },
  {
    id: 'claude-3-haiku-20240307',
    provider: 'anthropic',
    displayName: 'Claude 3 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsTools: true,
    supportsStreaming: true,
    supportsVision: true,
    inputCostPer1M: 0.25,
    outputCostPer1M: 1.25,
  },
];

/**
 * Anthropic API adapter
 */
export class AnthropicAdapter extends AbstractAdapter {
  readonly provider = 'anthropic';

  constructor(config: Partial<AdapterConfig> = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.anthropic.com',
    });
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'https://api.anthropic.com';
  }

  protected override getAuthHeaders(): Record<string, string> {
    return {
      'x-api-key': this.getApiKey(),
      'anthropic-version': '2023-06-01',
    };
  }

  private toAnthropicMessage(message: Message): AnthropicMessage {
    // Anthropic only supports user and assistant roles
    const role = message.role === 'user' || message.role === 'system' ? 'user' : 'assistant';

    // Handle tool results
    if (message.role === 'tool' && message.toolResults && message.toolResults.length > 0) {
      const toolResults: AnthropicContentBlock[] = message.toolResults.map((tr) => ({
        type: 'tool_result' as const,
        tool_use_id: tr.toolCallId,
        content: tr.content,
      }));
      return { role: 'user', content: toolResults };
    }

    // Handle assistant messages with tool calls
    if (message.toolCalls && message.toolCalls.length > 0) {
      const content: AnthropicContentBlock[] = [];

      // Add text content if present
      const textContent = typeof message.content === 'string'
        ? message.content
        : message.content.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text).join('');

      if (textContent) {
        content.push({ type: 'text', text: textContent });
      }

      // Add tool uses
      for (const tc of message.toolCalls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments),
        });
      }

      return { role: 'assistant', content };
    }

    // Regular text message
    const textContent = typeof message.content === 'string'
      ? message.content
      : message.content.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text).join('');

    return { role, content: textContent };
  }

  private toAnthropicTools(tools: ToolDefinition[]): AnthropicRequest['tools'] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  private parseFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'stop_sequence': return 'stop';
      case 'max_tokens': return 'length';
      case 'tool_use': return 'tool_calls';
      default: return 'stop';
    }
  }

  private parseUsage(usage: AnthropicResponse['usage']): TokenUsage {
    return {
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }

  private parseToolCalls(content: AnthropicContentBlock[]): AdapterToolCall[] | undefined {
    const toolUses = content.filter((c): c is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      c.type === 'tool_use');

    if (toolUses.length === 0) return undefined;

    return toolUses.map((tu) => ({
      id: tu.id,
      name: tu.name,
      arguments: JSON.stringify(tu.input),
    }));
  }

  private extractTextContent(content: AnthropicContentBlock[]): string {
    return content
      .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }

  protected async doGenerateContent(request: AdapterRequest): Promise<AdapterResponse> {
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toAnthropicMessage(m));

    // Extract system message
    const systemMessage = request.messages.find((m) => m.role === 'system');
    const system = request.systemPrompt ||
      (systemMessage ? (typeof systemMessage.content === 'string' ? systemMessage.content : '') : undefined);

    const body: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      stream: false,
    };

    if (system) body.system = system;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop_sequences = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toAnthropicTools(request.tools);
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/messages`,
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

    const data: AnthropicResponse = await response.json();

    return {
      content: this.extractTextContent(data.content),
      model: data.model,
      id: data.id,
      finishReason: this.parseFinishReason(data.stop_reason),
      usage: this.parseUsage(data.usage),
      toolCalls: this.parseToolCalls(data.content),
    };
  }

  protected async doStreamContent(request: AdapterRequest): Promise<AsyncGenerator<StreamChunk>> {
    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toAnthropicMessage(m));

    const systemMessage = request.messages.find((m) => m.role === 'system');
    const system = request.systemPrompt ||
      (systemMessage ? (typeof systemMessage.content === 'string' ? systemMessage.content : '') : undefined);

    const body: AnthropicRequest = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? 4096,
      stream: true,
    };

    if (system) body.system = system;
    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.topP !== undefined) body.top_p = request.topP;
    if (request.stopSequences) body.stop_sequences = request.stopSequences;
    if (request.tools && request.tools.length > 0) {
      body.tools = this.toAnthropicTools(request.tools);
    }

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/v1/messages`,
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
    const responseBody = response.body;

    async function* parseStream(): AsyncGenerator<StreamChunk> {
      const sseStream = parseSSEStream(responseBody);
      const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
      let usage: TokenUsage | undefined;

      for await (const sseMessage of sseStream) {
        const event = parseSSEData<AnthropicStreamEvent>(sseMessage.data);
        if (!event) continue;

        switch (event.type) {
          case 'content_block_start':
            if (event.content_block?.type === 'tool_use') {
              const idx = event.index ?? 0;
              toolCalls.set(idx, {
                id: event.content_block.id,
                name: event.content_block.name,
                arguments: '',
              });
            }
            break;

          case 'content_block_delta':
            if (event.delta?.type === 'text_delta' && event.delta.text) {
              yield { delta: event.delta.text };
            } else if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
              const idx = event.index ?? 0;
              const tc = toolCalls.get(idx);
              if (tc) {
                tc.arguments += event.delta.partial_json;
              }
            }
            break;

          case 'message_delta':
            if (event.usage) {
              usage = {
                promptTokens: event.usage.input_tokens,
                completionTokens: event.usage.output_tokens,
                totalTokens: event.usage.input_tokens + event.usage.output_tokens,
              };
            }
            break;

          case 'message_stop':
            yield {
              delta: '',
              finishReason: parseFinishReason(event.message?.stop_reason ?? null),
              usage,
              toolCalls: toolCalls.size > 0 ? Array.from(toolCalls.values()) : undefined,
              done: true,
            };
            break;

          default:
            // Ignore other event types
            break;
        }
      }
    }

    return parseStream();
  }

  getModelInfo(model: string): ModelInfo {
    const found = ANTHROPIC_MODELS.find((m) => m.id === model);
    if (found) return found;

    return {
      id: model,
      provider: this.provider,
      contextWindow: 200000,
      supportsTools: true,
      supportsStreaming: true,
    };
  }

  listModels(): ModelInfo[] {
    return [...ANTHROPIC_MODELS];
  }

  override async countTokens(text: string, _model?: string): Promise<number> {
    // Anthropic uses ~3.5 chars per token on average
    return Math.ceil(text.length / 3.5);
  }
}

registerAdapter('anthropic', (config) => new AnthropicAdapter(config));

export default AnthropicAdapter;
