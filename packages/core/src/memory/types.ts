/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Memory entry type
 */
export enum MemoryType {
  CONVERSATION = 'conversation',
  TASK = 'task',
  FILE = 'file',
  ERROR = 'error',
  DECISION = 'decision',
  FACT = 'fact',
  PREFERENCE = 'preference',
}

/**
 * Memory importance level
 */
export enum MemoryImportance {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

/**
 * A single memory entry
 */
export interface MemoryEntry {
  /** Unique identifier */
  id: string;
  /** Memory type */
  type: MemoryType;
  /** Content of the memory */
  content: string;
  /** Summary (for long content) */
  summary?: string;
  /** Associated tags */
  tags: string[];
  /** Importance level */
  importance: MemoryImportance;
  /** Creation timestamp */
  createdAt: Date;
  /** Last accessed timestamp */
  lastAccessedAt: Date;
  /** Access count */
  accessCount: number;
  /** Related memory IDs */
  relatedIds: string[];
  /** Source of the memory (file, conversation, etc.) */
  source?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

/**
 * Conversation message
 */
export interface ConversationMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Associated tool calls */
  toolCalls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result?: unknown;
  }>;
}

/**
 * Conversation memory entry
 */
export interface ConversationMemory {
  /** Conversation ID */
  id: string;
  /** Conversation title */
  title: string;
  /** Messages */
  messages: ConversationMessage[];
  /** Start time */
  startedAt: Date;
  /** Last update time */
  lastUpdatedAt: Date;
  /** Summary of the conversation */
  summary?: string;
  /** Key topics discussed */
  topics: string[];
  /** Files referenced */
  filesReferenced: string[];
  /** Is this conversation active */
  isActive: boolean;
}

/**
 * Task memory entry
 */
export interface TaskMemory {
  /** Task ID */
  id: string;
  /** Task description */
  description: string;
  /** Task status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Associated conversation ID */
  conversationId?: string;
  /** Files modified */
  filesModified: string[];
  /** Commands executed */
  commandsExecuted: string[];
  /** Errors encountered */
  errors: string[];
  /** Start time */
  startedAt: Date;
  /** Completion time */
  completedAt?: Date;
  /** Outcome/result summary */
  outcome?: string;
}

/**
 * Memory search options
 */
export interface MemorySearchOptions {
  /** Filter by type */
  types?: MemoryType[];
  /** Filter by tags */
  tags?: string[];
  /** Minimum importance */
  minImportance?: MemoryImportance;
  /** Search text */
  query?: string;
  /** Maximum results */
  limit?: number;
  /** Only recent (within hours) */
  withinHours?: number;
  /** Include related memories */
  includeRelated?: boolean;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
  /** Total entries */
  totalEntries: number;
  /** Entries by type */
  byType: Record<MemoryType, number>;
  /** Total conversations */
  totalConversations: number;
  /** Total tasks */
  totalTasks: number;
  /** Memory age (oldest entry) */
  oldestEntry?: Date;
  /** Most recent entry */
  newestEntry?: Date;
  /** Storage size estimate (bytes) */
  storageSize: number;
}

/**
 * Memory configuration
 */
export interface MemoryConfig {
  /** Maximum entries to keep */
  maxEntries?: number;
  /** Auto-cleanup threshold (days) */
  cleanupThresholdDays?: number;
  /** Enable persistence */
  persistEnabled?: boolean;
  /** Persistence path */
  persistPath?: string;
  /** Auto-save interval (ms) */
  autoSaveInterval?: number;
  /** Enable conversation summarization */
  summarizeConversations?: boolean;
  /** Maximum conversation length before summarization */
  maxConversationLength?: number;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: Required<MemoryConfig> = {
  maxEntries: 10000,
  cleanupThresholdDays: 30,
  persistEnabled: true,
  persistPath: '.damie/memory',
  autoSaveInterval: 60000,
  summarizeConversations: true,
  maxConversationLength: 100,
};
