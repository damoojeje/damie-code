/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ConversationMemory,
  ConversationMessage,
  MemoryConfig,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';

/**
 * Conversation Memory Manager
 *
 * Manages conversation history with persistence and summarization.
 */
export class ConversationMemoryManager {
  private config: Required<MemoryConfig>;
  private conversations: Map<string, ConversationMemory>;
  private activeConversationId: string | null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null;

  constructor(config: MemoryConfig = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.conversations = new Map();
    this.activeConversationId = null;
    this.autoSaveTimer = null;

    if (this.config.persistEnabled) {
      this.load();
      this.startAutoSave();
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(title?: string): ConversationMemory {
    const id = this.generateId();
    const conversation: ConversationMemory = {
      id,
      title: title ?? `Conversation ${this.conversations.size + 1}`,
      messages: [],
      startedAt: new Date(),
      lastUpdatedAt: new Date(),
      topics: [],
      filesReferenced: [],
      isActive: true,
    };

    this.conversations.set(id, conversation);
    this.activeConversationId = id;
    return conversation;
  }

  /**
   * Get active conversation or create one
   */
  getOrCreateActive(): ConversationMemory {
    if (this.activeConversationId) {
      const active = this.conversations.get(this.activeConversationId);
      if (active && active.isActive) return active;
    }
    return this.createConversation();
  }

  /**
   * Get conversation by ID
   */
  getConversation(id: string): ConversationMemory | undefined {
    return this.conversations.get(id);
  }

  /**
   * Get all conversations
   */
  getAllConversations(): ConversationMemory[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());
  }

  /**
   * Get recent conversations
   */
  getRecentConversations(limit = 10): ConversationMemory[] {
    return this.getAllConversations().slice(0, limit);
  }

  /**
   * Add message to active conversation
   */
  addMessage(message: Omit<ConversationMessage, 'timestamp'>): void {
    const conversation = this.getOrCreateActive();

    const fullMessage: ConversationMessage = {
      ...message,
      timestamp: new Date(),
    };

    conversation.messages.push(fullMessage);
    conversation.lastUpdatedAt = new Date();

    // Extract topics from content
    this.extractTopics(conversation, message.content);

    // Check if summarization needed
    if (
      this.config.summarizeConversations &&
      conversation.messages.length > this.config.maxConversationLength
    ) {
      this.summarizeConversation(conversation);
    }
  }

  /**
   * Add user message
   */
  addUserMessage(content: string): void {
    this.addMessage({ role: 'user', content });
  }

  /**
   * Add assistant message
   */
  addAssistantMessage(
    content: string,
    toolCalls?: ConversationMessage['toolCalls']
  ): void {
    this.addMessage({ role: 'assistant', content, toolCalls });
  }

  /**
   * Add system message
   */
  addSystemMessage(content: string): void {
    this.addMessage({ role: 'system', content });
  }

  /**
   * Record file reference
   */
  recordFileReference(filePath: string): void {
    const conversation = this.getOrCreateActive();
    if (!conversation.filesReferenced.includes(filePath)) {
      conversation.filesReferenced.push(filePath);
    }
  }

  /**
   * End active conversation
   */
  endConversation(): void {
    if (this.activeConversationId) {
      const conversation = this.conversations.get(this.activeConversationId);
      if (conversation) {
        conversation.isActive = false;
        this.summarizeConversation(conversation);
      }
    }
    this.activeConversationId = null;
  }

  /**
   * Search conversations
   */
  searchConversations(query: string): ConversationMemory[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllConversations().filter(conv => {
      if (conv.title.toLowerCase().includes(lowerQuery)) return true;
      if (conv.summary?.toLowerCase().includes(lowerQuery)) return true;
      if (conv.topics.some(t => t.toLowerCase().includes(lowerQuery))) return true;
      return conv.messages.some(m =>
        m.content.toLowerCase().includes(lowerQuery)
      );
    });
  }

  /**
   * Get conversation context for prompts
   */
  getConversationContext(maxMessages = 20): ConversationMessage[] {
    const conversation = this.activeConversationId
      ? this.conversations.get(this.activeConversationId)
      : undefined;

    if (!conversation) return [];

    const messages = conversation.messages;
    if (messages.length <= maxMessages) return messages;

    // Return system messages + recent messages
    const systemMessages = messages.filter(m => m.role === 'system');
    const recentMessages = messages.slice(-maxMessages);

    return [...systemMessages, ...recentMessages];
  }

  /**
   * Delete conversation
   */
  deleteConversation(id: string): boolean {
    if (this.activeConversationId === id) {
      this.activeConversationId = null;
    }
    return this.conversations.delete(id);
  }

  /**
   * Clear all conversations
   */
  clearAll(): void {
    this.conversations.clear();
    this.activeConversationId = null;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalConversations: number;
    activeConversation: string | null;
    totalMessages: number;
    filesReferenced: number;
  } {
    let totalMessages = 0;
    const filesSet = new Set<string>();

    for (const conv of this.conversations.values()) {
      totalMessages += conv.messages.length;
      conv.filesReferenced.forEach(f => filesSet.add(f));
    }

    return {
      totalConversations: this.conversations.size,
      activeConversation: this.activeConversationId,
      totalMessages,
      filesReferenced: filesSet.size,
    };
  }

  /**
   * Save to disk
   */
  save(): void {
    if (!this.config.persistEnabled) return;

    const persistPath = this.config.persistPath;
    const filePath = path.join(persistPath, 'conversations.json');

    try {
      if (!fs.existsSync(persistPath)) {
        fs.mkdirSync(persistPath, { recursive: true });
      }

      const data = {
        activeConversationId: this.activeConversationId,
        conversations: Array.from(this.conversations.entries()).map(([_id, conv]) => ({
          ...conv,
          startedAt: conv.startedAt.toISOString(),
          lastUpdatedAt: conv.lastUpdatedAt.toISOString(),
          messages: conv.messages.map(m => ({
            ...m,
            timestamp: m.timestamp.toISOString(),
          })),
        })),
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Load from disk
   */
  load(): void {
    if (!this.config.persistEnabled) return;

    const filePath = path.join(this.config.persistPath, 'conversations.json');

    try {
      if (!fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      this.conversations.clear();
      this.activeConversationId = data.activeConversationId;

      for (const conv of data.conversations) {
        const conversation: ConversationMemory = {
          ...conv,
          startedAt: new Date(conv.startedAt),
          lastUpdatedAt: new Date(conv.lastUpdatedAt),
          messages: conv.messages.map((m: { timestamp: string }) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        };
        this.conversations.set(conv.id, conversation);
      }
    } catch {
      // Ignore load errors, start fresh
    }
  }

  /**
   * Stop the manager
   */
  stop(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.save();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract topics from content
   */
  private extractTopics(conversation: ConversationMemory, content: string): void {
    // Simple keyword extraction
    const keywords = [
      'refactor', 'bug', 'feature', 'test', 'deploy', 'config',
      'error', 'fix', 'implement', 'create', 'update', 'delete',
      'api', 'database', 'frontend', 'backend', 'security',
    ];

    const lowerContent = content.toLowerCase();
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword) && !conversation.topics.includes(keyword)) {
        conversation.topics.push(keyword);
      }
    }

    // Keep topics limited
    if (conversation.topics.length > 10) {
      conversation.topics = conversation.topics.slice(-10);
    }
  }

  /**
   * Summarize conversation
   */
  private summarizeConversation(conversation: ConversationMemory): void {
    const messages = conversation.messages;
    if (messages.length === 0) return;

    // Simple summarization: first user message + key topics
    const firstUserMessage = messages.find(m => m.role === 'user');
    const topics = conversation.topics.join(', ');

    conversation.summary = [
      firstUserMessage ? `Started with: "${firstUserMessage.content.slice(0, 100)}..."` : '',
      topics ? `Topics: ${topics}` : '',
      `${messages.length} messages`,
    ].filter(Boolean).join('. ');
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    if (this.autoSaveTimer) return;

    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, this.config.autoSaveInterval);
  }
}

/**
 * Create a conversation memory manager
 */
export function createConversationMemoryManager(
  config?: MemoryConfig
): ConversationMemoryManager {
  return new ConversationMemoryManager(config);
}
