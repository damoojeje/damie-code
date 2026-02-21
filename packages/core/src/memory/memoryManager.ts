/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  MemoryEntry,
  MemoryType,
  MemoryImportance,
  MemorySearchOptions,
  MemoryStats,
  MemoryConfig,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import { ConversationMemoryManager } from './conversationMemory.js';
import { TaskMemoryManager } from './taskMemory.js';

/**
 * Unified Memory Manager
 *
 * Provides a unified interface for all memory types including
 * conversations, tasks, facts, and general memories.
 */
export class MemoryManager {
  private config: Required<MemoryConfig>;
  private entries: Map<string, MemoryEntry>;
  private conversationManager: ConversationMemoryManager;
  private taskManager: TaskMemoryManager;
  private autoSaveTimer: ReturnType<typeof setInterval> | null;

  constructor(config: MemoryConfig = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.entries = new Map();
    this.conversationManager = new ConversationMemoryManager(config);
    this.taskManager = new TaskMemoryManager(config);
    this.autoSaveTimer = null;

    if (this.config.persistEnabled) {
      this.load();
      this.startAutoSave();
    }
  }

  /**
   * Get conversation manager
   */
  get conversations(): ConversationMemoryManager {
    return this.conversationManager;
  }

  /**
   * Get task manager
   */
  get tasks(): TaskMemoryManager {
    return this.taskManager;
  }

  /**
   * Add a memory entry
   */
  addMemory(
    type: MemoryType,
    content: string,
    options: {
      tags?: string[];
      importance?: MemoryImportance;
      summary?: string;
      source?: string;
      relatedIds?: string[];
      metadata?: Record<string, unknown>;
    } = {}
  ): MemoryEntry {
    const id = this.generateId();
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      type,
      content,
      summary: options.summary,
      tags: options.tags ?? [],
      importance: options.importance ?? 2,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
      relatedIds: options.relatedIds ?? [],
      source: options.source,
      metadata: options.metadata ?? {},
    };

    this.entries.set(id, entry);

    // Enforce max entries
    this.enforceMaxEntries();

    return entry;
  }

  /**
   * Remember a fact
   */
  rememberFact(
    fact: string,
    importance: MemoryImportance = 2,
    tags: string[] = []
  ): MemoryEntry {
    return this.addMemory('fact' as MemoryType, fact, { importance, tags });
  }

  /**
   * Remember a preference
   */
  rememberPreference(
    preference: string,
    importance: MemoryImportance = 2
  ): MemoryEntry {
    return this.addMemory('preference' as MemoryType, preference, {
      importance,
      tags: ['preference'],
    });
  }

  /**
   * Remember a decision
   */
  rememberDecision(
    decision: string,
    context: string,
    importance: MemoryImportance = 3
  ): MemoryEntry {
    return this.addMemory('decision' as MemoryType, decision, {
      importance,
      tags: ['decision'],
      metadata: { context },
    });
  }

  /**
   * Remember an error for future reference
   */
  rememberError(error: string, solution?: string): MemoryEntry {
    return this.addMemory('error' as MemoryType, error, {
      importance: 3,
      tags: ['error'],
      metadata: { solution },
    });
  }

  /**
   * Get a memory by ID
   */
  getMemory(id: string): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      entry.lastAccessedAt = new Date();
      entry.accessCount++;
    }
    return entry;
  }

  /**
   * Search memories
   */
  searchMemories(options: MemorySearchOptions = {}): MemoryEntry[] {
    let results = Array.from(this.entries.values());

    // Filter by type
    if (options.types && options.types.length > 0) {
      results = results.filter(e => options.types!.includes(e.type));
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(e =>
        options.tags!.some(tag => e.tags.includes(tag))
      );
    }

    // Filter by importance
    if (options.minImportance !== undefined) {
      results = results.filter(e => e.importance >= options.minImportance!);
    }

    // Filter by recency
    if (options.withinHours !== undefined) {
      const threshold = new Date();
      threshold.setHours(threshold.getHours() - options.withinHours);
      results = results.filter(e => e.createdAt >= threshold);
    }

    // Text search
    if (options.query) {
      const lowerQuery = options.query.toLowerCase();
      results = results.filter(e =>
        e.content.toLowerCase().includes(lowerQuery) ||
        e.summary?.toLowerCase().includes(lowerQuery) ||
        e.tags.some(t => t.toLowerCase().includes(lowerQuery))
      );
    }

    // Sort by relevance (importance + recency)
    results.sort((a, b) => {
      const importanceScore = (b.importance - a.importance) * 1000;
      const recencyScore = b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime();
      const accessScore = (b.accessCount - a.accessCount) * 100;
      return importanceScore + recencyScore / 1000000 + accessScore;
    });

    // Include related if requested
    if (options.includeRelated) {
      const relatedIds = new Set<string>();
      for (const entry of results) {
        entry.relatedIds.forEach(id => relatedIds.add(id));
      }

      for (const id of relatedIds) {
        if (!results.some(e => e.id === id)) {
          const related = this.entries.get(id);
          if (related) {
            results.push(related);
          }
        }
      }
    }

    // Apply limit
    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get relevant memories for a query
   */
  getRelevantMemories(query: string, limit = 10): MemoryEntry[] {
    return this.searchMemories({
      query,
      limit,
      includeRelated: true,
    });
  }

  /**
   * Update memory
   */
  updateMemory(
    id: string,
    updates: Partial<Pick<MemoryEntry, 'content' | 'summary' | 'tags' | 'importance' | 'metadata'>>
  ): MemoryEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      Object.assign(entry, updates);
      entry.lastAccessedAt = new Date();
    }
    return entry;
  }

  /**
   * Link memories as related
   */
  linkMemories(id1: string, id2: string): boolean {
    const entry1 = this.entries.get(id1);
    const entry2 = this.entries.get(id2);

    if (entry1 && entry2) {
      if (!entry1.relatedIds.includes(id2)) {
        entry1.relatedIds.push(id2);
      }
      if (!entry2.relatedIds.includes(id1)) {
        entry2.relatedIds.push(id1);
      }
      return true;
    }

    return false;
  }

  /**
   * Delete memory
   */
  deleteMemory(id: string): boolean {
    return this.entries.delete(id);
  }

  /**
   * Clear all memories
   */
  clearAll(): void {
    this.entries.clear();
    this.conversationManager.clearAll();
    this.taskManager.clearAll();
  }

  /**
   * Get statistics
   */
  getStats(): MemoryStats {
    const byType: Record<MemoryType, number> = {
      conversation: 0,
      task: 0,
      file: 0,
      error: 0,
      decision: 0,
      fact: 0,
      preference: 0,
    };

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;
    let storageSize = 0;

    for (const entry of this.entries.values()) {
      byType[entry.type]++;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }

      storageSize += JSON.stringify(entry).length;
    }

    const convStats = this.conversationManager.getStats();
    const taskStats = this.taskManager.getStats();

    return {
      totalEntries: this.entries.size,
      byType,
      totalConversations: convStats.totalConversations,
      totalTasks: taskStats.totalTasks,
      oldestEntry,
      newestEntry,
      storageSize,
    };
  }

  /**
   * Save all memory to disk
   */
  save(): void {
    if (!this.config.persistEnabled) return;

    this.conversationManager.save();
    this.taskManager.save();

    const persistPath = this.config.persistPath;
    const filePath = path.join(persistPath, 'memories.json');

    try {
      if (!fs.existsSync(persistPath)) {
        fs.mkdirSync(persistPath, { recursive: true });
      }

      const data = Array.from(this.entries.entries()).map(([_id, entry]) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
        lastAccessedAt: entry.lastAccessedAt.toISOString(),
      }));

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Load memory from disk
   */
  load(): void {
    if (!this.config.persistEnabled) return;

    const filePath = path.join(this.config.persistPath, 'memories.json');

    try {
      if (!fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      this.entries.clear();

      for (const entry of data) {
        const memoryEntry: MemoryEntry = {
          ...entry,
          createdAt: new Date(entry.createdAt),
          lastAccessedAt: new Date(entry.lastAccessedAt),
        };
        this.entries.set(entry.id, memoryEntry);
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
    this.conversationManager.stop();
    this.taskManager.stop();
    this.save();
  }

  /**
   * Cleanup old memories
   */
  cleanup(thresholdDays?: number): number {
    const days = thresholdDays ?? this.config.cleanupThresholdDays;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    let removed = 0;
    for (const [id, entry] of this.entries.entries()) {
      // Don't remove high importance or frequently accessed
      if (entry.importance >= 3) continue;
      if (entry.accessCount > 10) continue;

      if (entry.lastAccessedAt < threshold) {
        this.entries.delete(id);
        removed++;
      }
    }

    removed += this.taskManager.cleanup(days);
    return removed;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enforce max entries limit
   */
  private enforceMaxEntries(): void {
    if (this.entries.size <= this.config.maxEntries) return;

    // Remove lowest importance, oldest entries first
    const entries = Array.from(this.entries.values())
      .filter(e => e.importance < 3)
      .sort((a, b) => {
        const importanceScore = a.importance - b.importance;
        const recencyScore = a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime();
        return importanceScore * 1000000 + recencyScore;
      });

    const toRemove = this.entries.size - this.config.maxEntries;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.entries.delete(entries[i].id);
    }
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
 * Create a memory manager
 */
export function createMemoryManager(config?: MemoryConfig): MemoryManager {
  return new MemoryManager(config);
}
