/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supported message roles
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Tool/function call from the model
 */
export interface AdapterToolCall {
  /** Unique identifier for this tool call */
  id: string;
  /** Name of the tool/function to call */
  name: string;
  /** JSON-encoded arguments for the tool */
  arguments: string;
}

/**
 * Result from a tool/function execution
 */
export interface AdapterToolResult {
  /** ID of the tool call this is a result for */
  toolCallId: string;
  /** Content/output from the tool execution */
  content: string;
  /** Whether the tool execution failed */
  isError?: boolean;
}

/**
 * Content block types for multi-modal support
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; imageUrl: string; mimeType?: string }
  | { type: 'tool_use'; toolCall: AdapterToolCall }
  | { type: 'tool_result'; toolResult: AdapterToolResult };

/**
 * Message in a conversation
 */
export interface Message {
  /** Role of the message sender */
  role: MessageRole;
  /** Message content - string or array of content parts */
  content: string | ContentPart[];
  /** Tool calls made by the assistant (only for assistant messages) */
  toolCalls?: AdapterToolCall[];
  /** Tool results (only for tool messages) */
  toolResults?: AdapterToolResult[];
  /** Optional name for the message sender */
  name?: string;
}

/**
 * Tool/function definition for the model
 */
export interface ToolDefinition {
  /** Tool name */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the tool parameters */
  parameters: Record<string, unknown>;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
  /** Tokens in the prompt/input */
  promptTokens: number;
  /** Tokens in the completion/output */
  completionTokens: number;
  /** Total tokens used */
  totalTokens: number;
  /** Cached tokens (if supported) */
  cachedTokens?: number;
}

/**
 * Reason why generation stopped
 */
export type FinishReason =
  | 'stop'           // Natural stop (end token)
  | 'length'         // Max tokens reached
  | 'tool_calls'     // Model wants to call tools
  | 'content_filter' // Content was filtered
  | 'error';         // Error occurred

/**
 * Request to generate content
 */
export interface AdapterRequest {
  /** Conversation messages */
  messages: Message[];
  /** Model identifier */
  model: string;
  /** Available tools for the model to use */
  tools?: ToolDefinition[];
  /** Whether to stream the response */
  stream?: boolean;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Top-p sampling */
  topP?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** System prompt (alternative to system message) */
  systemPrompt?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** User identifier for tracking */
  userId?: string;
}

/**
 * Response from content generation
 */
export interface AdapterResponse {
  /** Generated text content */
  content: string;
  /** Tool calls requested by the model */
  toolCalls?: AdapterToolCall[];
  /** Token usage statistics */
  usage?: TokenUsage;
  /** Reason generation stopped */
  finishReason: FinishReason;
  /** Model that generated the response */
  model: string;
  /** Response ID (if provided by API) */
  id?: string;
}

/**
 * Chunk from a streaming response
 */
export interface StreamChunk {
  /** Incremental text content */
  delta: string;
  /** Tool calls (may be partial) */
  toolCalls?: Array<Partial<AdapterToolCall>>;
  /** Finish reason (only on last chunk) */
  finishReason?: FinishReason;
  /** Token usage (only on last chunk, if supported) */
  usage?: TokenUsage;
  /** Whether this is the final chunk */
  done?: boolean;
}

/**
 * Information about a model
 */
export interface ModelInfo {
  /** Model identifier */
  id: string;
  /** Provider name */
  provider: string;
  /** Display name */
  displayName?: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutputTokens?: number;
  /** Whether the model supports tool/function calling */
  supportsTools: boolean;
  /** Whether the model supports streaming */
  supportsStreaming: boolean;
  /** Whether the model supports vision/images */
  supportsVision?: boolean;
  /** Cost per 1M input tokens (USD) */
  inputCostPer1M?: number;
  /** Cost per 1M output tokens (USD) */
  outputCostPer1M?: number;
}

/**
 * Configuration for an adapter
 */
export interface AdapterConfig {
  /** API key for authentication */
  apiKey?: string;
  /** Base URL override */
  baseUrl?: string;
  /** Default model to use */
  defaultModel?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Organization ID (for OpenAI) */
  organizationId?: string;
  /** Custom headers to include */
  customHeaders?: Record<string, string>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Add jitter to delays */
  jitter: boolean;
  /** Error types to retry on */
  retryableErrors: string[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: ['RateLimitError', 'TimeoutError', 'NetworkError'],
};

/**
 * Default adapter configuration
 */
export const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  timeout: 60000,
  maxRetries: 3,
};
