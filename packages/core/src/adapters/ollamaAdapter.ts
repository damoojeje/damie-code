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
  Message,
  TokenUsage,
  FinishReason,
} from './types.js';
import { NetworkError } from './errors.js';

/**
 * Ollama API message format
 */
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Ollama API request format
 */
interface OllamaRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  options?: {
    num_predict?: number;
    temperature?: number;
    top_p?: number;
    stop?: string[];
  };
}

/**
 * Ollama API response format
 */
interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/**
 * Common Ollama model definitions
 */
const OLLAMA_MODELS: ModelInfo[] = [
  {
    id: 'llama3.1',
    provider: 'ollama',
    displayName: 'Llama 3.1',
    contextWindow: 131072,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'llama3.1:70b',
    provider: 'ollama',
    displayName: 'Llama 3.1 70B',
    contextWindow: 131072,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'qwen2.5-coder:32b',
    provider: 'ollama',
    displayName: 'Qwen 2.5 Coder 32B',
    contextWindow: 32768,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'codellama',
    provider: 'ollama',
    displayName: 'Code Llama',
    contextWindow: 16384,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'mistral',
    provider: 'ollama',
    displayName: 'Mistral',
    contextWindow: 32768,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
  {
    id: 'deepseek-coder-v2',
    provider: 'ollama',
    displayName: 'DeepSeek Coder V2',
    contextWindow: 128000,
    supportsTools: false,
    supportsStreaming: true,
    supportsVision: false,
  },
];

/**
 * Ollama API adapter for local LLM inference
 */
export class OllamaAdapter extends AbstractAdapter {
  readonly provider = 'ollama';

  constructor(config: Partial<AdapterConfig> = {}) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'http://localhost:11434',
    });
  }

  protected getBaseUrl(): string {
    return this.config.baseUrl ?? 'http://localhost:11434';
  }

  /**
   * Ollama doesn't require authentication
   */
  protected override getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Ollama doesn't require API key validation
   */
  override validateConfig(): boolean {
    return true;
  }

  private toOllamaMessage(message: Message): OllamaMessage {
    const content = typeof message.content === 'string'
      ? message.content
      : message.content.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text).join('');

    // Ollama only supports system, user, assistant
    let role: OllamaMessage['role'] = 'user';
    if (message.role === 'assistant') role = 'assistant';
    else if (message.role === 'system') role = 'system';

    return { role, content };
  }

  private parseUsage(response: OllamaResponse): TokenUsage | undefined {
    if (!response.prompt_eval_count && !response.eval_count) return undefined;

    return {
      promptTokens: response.prompt_eval_count ?? 0,
      completionTokens: response.eval_count ?? 0,
      totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
    };
  }

  protected async doGenerateContent(request: AdapterRequest): Promise<AdapterResponse> {
    const messages = request.messages.map((m) => this.toOllamaMessage(m));

    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const body: OllamaRequest = {
      model: request.model,
      messages,
      stream: false,
      options: {},
    };

    if (request.maxTokens) body.options!.num_predict = request.maxTokens;
    if (request.temperature !== undefined) body.options!.temperature = request.temperature;
    if (request.topP !== undefined) body.options!.top_p = request.topP;
    if (request.stopSequences) body.options!.stop = request.stopSequences;

    try {
      const response = await this.makeRequest(
        `${this.getBaseUrl()}/api/chat`,
        { method: 'POST', body: JSON.stringify(body) },
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new NetworkError(this.provider, `Ollama error: ${errorText}`);
      }

      const data: OllamaResponse = await response.json();

      return {
        content: data.message.content,
        model: data.model,
        finishReason: 'stop' as FinishReason,
        usage: this.parseUsage(data),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
        throw new NetworkError(
          this.provider,
          'Cannot connect to Ollama. Is it running? Start with: ollama serve',
        );
      }
      throw error;
    }
  }

  protected async doStreamContent(request: AdapterRequest): Promise<AsyncGenerator<StreamChunk>> {
    const messages = request.messages.map((m) => this.toOllamaMessage(m));

    if (request.systemPrompt) {
      messages.unshift({ role: 'system', content: request.systemPrompt });
    }

    const body: OllamaRequest = {
      model: request.model,
      messages,
      stream: true,
      options: {},
    };

    if (request.maxTokens) body.options!.num_predict = request.maxTokens;
    if (request.temperature !== undefined) body.options!.temperature = request.temperature;
    if (request.topP !== undefined) body.options!.top_p = request.topP;
    if (request.stopSequences) body.options!.stop = request.stopSequences;

    const response = await this.makeRequest(
      `${this.getBaseUrl()}/api/chat`,
      { method: 'POST', body: JSON.stringify(body) },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new NetworkError(this.provider, `Ollama error: ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const parseUsage = this.parseUsage.bind(this);
    const responseBody = response.body;

    async function* parseStream(): AsyncGenerator<StreamChunk> {
      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const chunk: OllamaResponse = JSON.parse(line);

              yield {
                delta: chunk.message?.content || '',
                finishReason: chunk.done ? 'stop' as FinishReason : undefined,
                usage: chunk.done ? parseUsage(chunk) : undefined,
                done: chunk.done,
              };
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return parseStream();
  }

  getModelInfo(model: string): ModelInfo {
    const found = OLLAMA_MODELS.find((m) => m.id === model);
    if (found) return found;

    return {
      id: model,
      provider: this.provider,
      contextWindow: 8192,
      supportsTools: false,
      supportsStreaming: true,
    };
  }

  listModels(): ModelInfo[] {
    return [...OLLAMA_MODELS];
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List models available on the Ollama server
   */
  async listLocalModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      return (data.models || []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  override async countTokens(text: string, _model?: string): Promise<number> {
    // Rough estimation for most models
    return Math.ceil(text.length / 4);
  }
}

registerAdapter('ollama', (config) => new OllamaAdapter(config));

export default OllamaAdapter;
