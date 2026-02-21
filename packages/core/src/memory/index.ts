/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  MemoryEntry,
  ConversationMemory,
  ConversationMessage,
  TaskMemory,
  MemorySearchOptions,
  MemoryStats,
  MemoryConfig,
} from './types.js';

export {
  MemoryType,
  MemoryImportance,
  DEFAULT_MEMORY_CONFIG,
} from './types.js';

// Conversation Memory
export {
  ConversationMemoryManager,
  createConversationMemoryManager,
} from './conversationMemory.js';

// Task Memory
export {
  TaskMemoryManager,
  createTaskMemoryManager,
} from './taskMemory.js';

// Unified Memory Manager
export {
  MemoryManager,
  createMemoryManager,
} from './memoryManager.js';
