/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Context item type
 */
export enum ContextItemType {
  SYSTEM_PROMPT = 'system_prompt',
  USER_MESSAGE = 'user_message',
  ASSISTANT_MESSAGE = 'assistant_message',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
  FILE_CONTENT = 'file_content',
  CODE_SNIPPET = 'code_snippet',
  MEMORY = 'memory',
  SUMMARY = 'summary',
}

/**
 * Context item priority
 */
export enum ContextPriority {
  CRITICAL = 1,    // Must keep (system prompt, current task)
  HIGH = 2,        // Important (recent messages, active files)
  MEDIUM = 3,      // Useful (older messages, related context)
  LOW = 4,         // Optional (can be summarized/removed)
  EPHEMERAL = 5,   // Temporary (can be removed first)
}

/**
 * Single context item
 */
export interface ContextItem {
  /** Unique identifier */
  id: string;
  /** Item type */
  type: ContextItemType;
  /** Content */
  content: string;
  /** Priority for retention */
  priority: ContextPriority;
  /** Token count */
  tokenCount: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Access count */
  accessCount: number;
  /** Source file path (if applicable) */
  sourcePath?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Whether item can be summarized */
  canSummarize: boolean;
  /** Whether item can be removed */
  canRemove: boolean;
  /** Summary of this item (if summarized) */
  summary?: string;
}

/**
 * Context window configuration
 */
export interface ContextWindowConfig {
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Reserved tokens for response */
  reservedForResponse: number;
  /** Warning threshold (0-1) */
  warningThreshold: number;
  /** Critical threshold (0-1) */
  criticalThreshold: number;
  /** Enable auto-compression */
  autoCompress: boolean;
  /** Compression target (0-1 of max) */
  compressionTarget: number;
  /** Minimum items to keep */
  minItemsToKeep: number;
}

/**
 * Default context window configuration
 */
export const DEFAULT_CONTEXT_CONFIG: ContextWindowConfig = {
  maxTokens: 128000,
  reservedForResponse: 4096,
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
  autoCompress: true,
  compressionTarget: 0.7,
  minItemsToKeep: 5,
};

/**
 * Model-specific token limits
 */
export const MODEL_TOKEN_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-3.5-turbo': 16385,
  // Anthropic
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-2': 100000,
  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-coder': 64000,
  // Qwen
  'qwen-turbo': 8000,
  'qwen-plus': 32000,
  'qwen-max': 32000,
  // Local
  'llama-3': 8192,
  'codellama': 16384,
  'mistral': 32768,
  // Default
  default: 8192,
};

/**
 * Context window state
 */
export interface ContextWindowState {
  /** Current token count */
  currentTokens: number;
  /** Available tokens */
  availableTokens: number;
  /** Usage percentage (0-1) */
  usagePercent: number;
  /** Number of items */
  itemCount: number;
  /** Is at warning threshold */
  isWarning: boolean;
  /** Is at critical threshold */
  isCritical: boolean;
  /** Items by type */
  itemsByType: Record<ContextItemType, number>;
  /** Tokens by type */
  tokensByType: Record<ContextItemType, number>;
}

/**
 * Compression result
 */
export interface CompressionResult {
  /** Items removed */
  removedCount: number;
  /** Items summarized */
  summarizedCount: number;
  /** Tokens saved */
  tokensSaved: number;
  /** New token count */
  newTokenCount: number;
  /** Compression ratio */
  compressionRatio: number;
}

/**
 * Context manager configuration
 */
export interface ContextManagerConfig {
  /** Window configuration (partial, will be merged with defaults) */
  window: Partial<ContextWindowConfig>;
  /** Model name for token limits */
  model?: string;
  /** Token counter function */
  tokenCounter?: (text: string) => number;
  /** Enable persistence */
  persistenceEnabled: boolean;
  /** Persistence path */
  persistencePath?: string;
}

/**
 * Default context manager configuration
 */
export const DEFAULT_CONTEXT_MANAGER_CONFIG: ContextManagerConfig = {
  window: DEFAULT_CONTEXT_CONFIG,
  persistenceEnabled: false,
};
