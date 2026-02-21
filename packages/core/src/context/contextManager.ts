/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ContextItem,
  ContextWindowState,
  ContextManagerConfig,
  ContextWindowConfig,
  CompressionResult,
} from './types.js';
import {
  ContextItemType,
  ContextPriority,
  MODEL_TOKEN_LIMITS,
  DEFAULT_CONTEXT_MANAGER_CONFIG,
  DEFAULT_CONTEXT_CONFIG,
} from './types.js';
import type { ContextPrioritizer } from './contextPrioritizer.js';
import { createContextPrioritizer } from './contextPrioritizer.js';
import type { ContextCompressor, CompressionStrategy } from './contextCompressor.js';
import { createContextCompressor } from './contextCompressor.js';
import type { ContextPersistence } from './contextPersistence.js';
import { createContextPersistence } from './contextPersistence.js';

/**
 * Internal resolved config with all required fields
 */
interface ResolvedConfig {
  window: ContextWindowConfig;
  model?: string;
  tokenCounter?: (text: string) => number;
  persistenceEnabled: boolean;
  persistencePath?: string;
}

/**
 * Context Manager
 *
 * Manages the context window for AI conversations, handling
 * token limits, prioritization, compression, and persistence.
 */
export class ContextManager {
  private config: ResolvedConfig;
  private items: Map<string, ContextItem>;
  private prioritizer: ContextPrioritizer;
  private compressor: ContextCompressor;
  private persistence: ContextPersistence | null;
  private tokenCounter: (text: string) => number;
  private maxTokens: number;

  constructor(config: Partial<ContextManagerConfig> = {}) {
    // Resolve config with defaults
    this.config = {
      window: { ...DEFAULT_CONTEXT_CONFIG, ...config.window },
      model: config.model,
      tokenCounter: config.tokenCounter,
      persistenceEnabled: config.persistenceEnabled ?? DEFAULT_CONTEXT_MANAGER_CONFIG.persistenceEnabled,
      persistencePath: config.persistencePath,
    };

    this.items = new Map();
    this.prioritizer = createContextPrioritizer();
    this.compressor = createContextCompressor();
    this.tokenCounter = config.tokenCounter ?? this.defaultTokenCounter;

    // Set up persistence if enabled
    if (this.config.persistenceEnabled && this.config.persistencePath) {
      this.persistence = createContextPersistence({
        baseDir: this.config.persistencePath,
      });
    } else {
      this.persistence = null;
    }

    // Set max tokens based on model
    this.maxTokens = this.getMaxTokensForModel(config.model);
  }

  /**
   * Default token counter (approximation)
   */
  private defaultTokenCounter(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Get max tokens for a model
   */
  private getMaxTokensForModel(model?: string): number {
    if (!model) {
      return this.config.window.maxTokens;
    }

    // Check for exact match
    if (model in MODEL_TOKEN_LIMITS) {
      return MODEL_TOKEN_LIMITS[model];
    }

    // Check for partial match
    for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
      if (model.toLowerCase().includes(key.toLowerCase())) {
        return limit;
      }
    }

    return MODEL_TOKEN_LIMITS['default'];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add an item to context
   */
  add(
    content: string,
    type: ContextItemType,
    options: Partial<Omit<ContextItem, 'id' | 'content' | 'type' | 'tokenCount'>> = {},
  ): ContextItem {
    const now = new Date();
    const tokenCount = this.tokenCounter(content);

    const item: ContextItem = {
      id: this.generateId(),
      type,
      content,
      tokenCount,
      priority: options.priority ?? this.getDefaultPriority(type),
      createdAt: options.createdAt ?? now,
      lastAccessedAt: options.lastAccessedAt ?? now,
      accessCount: options.accessCount ?? 1,
      sourcePath: options.sourcePath,
      metadata: options.metadata,
      canSummarize: options.canSummarize ?? this.canTypeBeSummarized(type),
      canRemove: options.canRemove ?? this.canTypeBeRemoved(type),
      summary: options.summary,
    };

    this.items.set(item.id, item);

    // Auto-compress if needed
    if (this.config.window.autoCompress && this.isOverThreshold()) {
      this.compress().catch(() => {
        // Ignore compression errors
      });
    }

    return item;
  }

  /**
   * Get default priority for type
   */
  private getDefaultPriority(type: ContextItemType): ContextPriority {
    switch (type) {
      case ContextItemType.SYSTEM_PROMPT:
        return ContextPriority.CRITICAL;
      case ContextItemType.USER_MESSAGE:
        return ContextPriority.HIGH;
      case ContextItemType.ASSISTANT_MESSAGE:
        return ContextPriority.HIGH;
      case ContextItemType.TOOL_CALL:
        return ContextPriority.MEDIUM;
      case ContextItemType.TOOL_RESULT:
        return ContextPriority.MEDIUM;
      case ContextItemType.FILE_CONTENT:
        return ContextPriority.MEDIUM;
      case ContextItemType.CODE_SNIPPET:
        return ContextPriority.MEDIUM;
      case ContextItemType.MEMORY:
        return ContextPriority.LOW;
      case ContextItemType.SUMMARY:
        return ContextPriority.LOW;
      default:
        return ContextPriority.MEDIUM;
    }
  }

  /**
   * Check if type can be summarized
   */
  private canTypeBeSummarized(type: ContextItemType): boolean {
    return type !== ContextItemType.SYSTEM_PROMPT;
  }

  /**
   * Check if type can be removed
   */
  private canTypeBeRemoved(type: ContextItemType): boolean {
    return type !== ContextItemType.SYSTEM_PROMPT;
  }

  /**
   * Get an item by ID
   */
  get(id: string): ContextItem | undefined {
    const item = this.items.get(id);
    if (item) {
      // Update access info
      item.lastAccessedAt = new Date();
      item.accessCount++;
    }
    return item;
  }

  /**
   * Remove an item by ID
   */
  remove(id: string): boolean {
    return this.items.delete(id);
  }

  /**
   * Get all items
   */
  getAll(): ContextItem[] {
    return Array.from(this.items.values());
  }

  /**
   * Get items by type
   */
  getByType(type: ContextItemType): ContextItem[] {
    return Array.from(this.items.values()).filter((item) => item.type === type);
  }

  /**
   * Get prioritized items
   */
  getPrioritized(): ContextItem[] {
    const items = this.getAll();
    const scored = this.prioritizer.prioritize(items);
    return scored.map((s) => s.item);
  }

  /**
   * Get items that fit within budget
   */
  getForBudget(tokenBudget?: number): ContextItem[] {
    const budget = tokenBudget ?? this.getAvailableTokens();
    return this.prioritizer.selectForBudget(this.getAll(), budget);
  }

  /**
   * Get current token count
   */
  getCurrentTokens(): number {
    let total = 0;
    for (const item of this.items.values()) {
      total += item.tokenCount;
    }
    return total;
  }

  /**
   * Get available tokens
   */
  getAvailableTokens(): number {
    return Math.max(
      0,
      this.maxTokens - this.config.window.reservedForResponse - this.getCurrentTokens(),
    );
  }

  /**
   * Get context window state
   */
  getState(): ContextWindowState {
    const currentTokens = this.getCurrentTokens();
    const effectiveMax = this.maxTokens - this.config.window.reservedForResponse;
    const usagePercent = currentTokens / effectiveMax;

    const itemsByType: Record<ContextItemType, number> = {} as Record<ContextItemType, number>;
    const tokensByType: Record<ContextItemType, number> = {} as Record<ContextItemType, number>;

    // Initialize counts
    for (const type of Object.values(ContextItemType)) {
      itemsByType[type] = 0;
      tokensByType[type] = 0;
    }

    // Count items and tokens by type
    for (const item of this.items.values()) {
      itemsByType[item.type]++;
      tokensByType[item.type] += item.tokenCount;
    }

    return {
      currentTokens,
      availableTokens: this.getAvailableTokens(),
      usagePercent,
      itemCount: this.items.size,
      isWarning: usagePercent >= this.config.window.warningThreshold,
      isCritical: usagePercent >= this.config.window.criticalThreshold,
      itemsByType,
      tokensByType,
    };
  }

  /**
   * Check if over warning threshold
   */
  isOverThreshold(): boolean {
    const state = this.getState();
    return state.isWarning;
  }

  /**
   * Compress context to fit
   */
  async compress(targetPercent?: number): Promise<CompressionResult> {
    const target = targetPercent ?? this.config.window.compressionTarget;
    const effectiveMax = this.maxTokens - this.config.window.reservedForResponse;
    const targetTokens = Math.floor(effectiveMax * target);

    const items = this.getAll();
    const { items: compressed, result } = await this.compressor.compress(items, targetTokens);

    // Update items
    this.items.clear();
    for (const item of compressed) {
      this.items.set(item.id, item);
    }

    return result;
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.items.clear();
  }

  /**
   * Clear items by type
   */
  clearByType(type: ContextItemType): number {
    let removed = 0;
    for (const [id, item] of this.items.entries()) {
      if (item.type === type) {
        this.items.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Set model (updates token limits)
   */
  setModel(model: string): void {
    this.config.model = model;
    this.maxTokens = this.getMaxTokensForModel(model);
  }

  /**
   * Get max tokens
   */
  getMaxTokens(): number {
    return this.maxTokens;
  }

  /**
   * Save context to persistence
   */
  async save(): Promise<void> {
    if (!this.persistence) {
      throw new Error('Persistence not enabled');
    }

    if (!this.persistence.isActive()) {
      this.persistence.startSession();
    }

    await this.persistence.save(this.getAll());
  }

  /**
   * Load context from persistence
   */
  async load(sessionId?: string): Promise<boolean> {
    if (!this.persistence) {
      throw new Error('Persistence not enabled');
    }

    const session = sessionId
      ? await this.persistence.load(sessionId)
      : await this.persistence.loadLatest();

    if (!session) {
      return false;
    }

    this.items.clear();
    for (const item of session.items) {
      this.items.set(item.id, item);
    }

    return true;
  }

  /**
   * Build context for prompt
   */
  buildPromptContext(maxTokens?: number): string {
    const budget = maxTokens ?? this.getAvailableTokens();
    const items = this.getForBudget(budget);

    // Sort by creation time for conversation order
    items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Build context string
    const parts: string[] = [];

    for (const item of items) {
      parts.push(item.summary ?? item.content);
    }

    return parts.join('\n\n');
  }

  /**
   * Set custom token counter
   */
  setTokenCounter(counter: (text: string) => number): void {
    this.tokenCounter = counter;

    // Recalculate token counts
    for (const item of this.items.values()) {
      item.tokenCount = counter(item.content);
    }
  }

  /**
   * Set compression strategy
   */
  setCompressionStrategy(strategy: CompressionStrategy): void {
    this.compressor.setConfig({ strategy });
  }
}

/**
 * Create a context manager
 */
export function createContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  return new ContextManager(config);
}
