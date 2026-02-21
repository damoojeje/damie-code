/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextItem, CompressionResult } from './types.js';
import { ContextItemType, ContextPriority } from './types.js';

/**
 * Compression strategy
 */
export enum CompressionStrategy {
  /** Remove low priority items */
  REMOVE = 'remove',
  /** Summarize items */
  SUMMARIZE = 'summarize',
  /** Truncate long items */
  TRUNCATE = 'truncate',
  /** Combined approach */
  MIXED = 'mixed',
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Strategy to use */
  strategy: CompressionStrategy;
  /** Target token count */
  targetTokens: number;
  /** Minimum tokens to keep per item when truncating */
  minTokensPerItem: number;
  /** Maximum summary length in tokens */
  maxSummaryTokens: number;
  /** Summarization function */
  summarizer?: (content: string) => Promise<string>;
}

/**
 * Default compression configuration
 */
export const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  strategy: CompressionStrategy.MIXED,
  targetTokens: 0,
  minTokensPerItem: 50,
  maxSummaryTokens: 200,
};

/**
 * Context Compressor
 *
 * Compresses context to fit within token limits using various strategies.
 */
export class ContextCompressor {
  private config: CompressionConfig;
  private tokenCounter: (text: string) => number;

  constructor(
    config: Partial<CompressionConfig> = {},
    tokenCounter?: (text: string) => number,
  ) {
    this.config = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
    this.tokenCounter = tokenCounter ?? this.defaultTokenCounter;
  }

  /**
   * Default token counter (approximation)
   */
  private defaultTokenCounter(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Compress items to fit target
   */
  async compress(
    items: ContextItem[],
    targetTokens: number,
  ): Promise<{ items: ContextItem[]; result: CompressionResult }> {
    const currentTokens = items.reduce((sum, item) => sum + item.tokenCount, 0);

    if (currentTokens <= targetTokens) {
      return {
        items,
        result: {
          removedCount: 0,
          summarizedCount: 0,
          tokensSaved: 0,
          newTokenCount: currentTokens,
          compressionRatio: 1,
        },
      };
    }

    switch (this.config.strategy) {
      case CompressionStrategy.REMOVE:
        return this.compressByRemoval(items, targetTokens, currentTokens);

      case CompressionStrategy.SUMMARIZE:
        return this.compressBySummarization(items, targetTokens, currentTokens);

      case CompressionStrategy.TRUNCATE:
        return this.compressByTruncation(items, targetTokens, currentTokens);

      case CompressionStrategy.MIXED:
      default:
        return this.compressMixed(items, targetTokens, currentTokens);
    }
  }

  /**
   * Compress by removing low priority items
   */
  private async compressByRemoval(
    items: ContextItem[],
    targetTokens: number,
    currentTokens: number,
  ): Promise<{ items: ContextItem[]; result: CompressionResult }> {
    // Sort by priority (lowest first for removal)
    const sorted = [...items].sort((a, b) => b.priority - a.priority);

    const kept: ContextItem[] = [];
    let removedCount = 0;
    let newTokenCount = 0;

    // First pass: keep critical items
    for (const item of sorted) {
      if (item.priority === ContextPriority.CRITICAL || !item.canRemove) {
        kept.push(item);
        newTokenCount += item.tokenCount;
      }
    }

    // Second pass: add items until we hit target
    for (const item of sorted) {
      if (item.priority === ContextPriority.CRITICAL || !item.canRemove) {
        continue; // Already added
      }

      if (newTokenCount + item.tokenCount <= targetTokens) {
        kept.push(item);
        newTokenCount += item.tokenCount;
      } else {
        removedCount++;
      }
    }

    return {
      items: kept,
      result: {
        removedCount,
        summarizedCount: 0,
        tokensSaved: currentTokens - newTokenCount,
        newTokenCount,
        compressionRatio: newTokenCount / currentTokens,
      },
    };
  }

  /**
   * Compress by summarizing items
   */
  private async compressBySummarization(
    items: ContextItem[],
    targetTokens: number,
    currentTokens: number,
  ): Promise<{ items: ContextItem[]; result: CompressionResult }> {
    const processed: ContextItem[] = [];
    let summarizedCount = 0;
    let newTokenCount = 0;

    // Sort by priority (lowest first for summarization)
    const sorted = [...items].sort((a, b) => b.priority - a.priority);

    for (const item of sorted) {
      if (
        item.canSummarize &&
        !item.summary &&
        newTokenCount > targetTokens * 0.5 &&
        item.priority > ContextPriority.HIGH
      ) {
        // Summarize this item
        const summary = await this.summarizeItem(item);
        const summaryTokens = this.tokenCounter(summary);

        const summarizedItem: ContextItem = {
          ...item,
          summary,
          content: summary,
          tokenCount: summaryTokens,
        };

        processed.push(summarizedItem);
        newTokenCount += summaryTokens;
        summarizedCount++;
      } else {
        processed.push(item);
        newTokenCount += item.tokenCount;
      }
    }

    return {
      items: processed,
      result: {
        removedCount: 0,
        summarizedCount,
        tokensSaved: currentTokens - newTokenCount,
        newTokenCount,
        compressionRatio: newTokenCount / currentTokens,
      },
    };
  }

  /**
   * Compress by truncating items
   */
  private async compressByTruncation(
    items: ContextItem[],
    targetTokens: number,
    currentTokens: number,
  ): Promise<{ items: ContextItem[]; result: CompressionResult }> {
    const tokensToSave = currentTokens - targetTokens;
    const truncatableItems = items.filter(
      (item) =>
        item.canSummarize &&
        item.tokenCount > this.config.minTokensPerItem * 2 &&
        item.priority > ContextPriority.HIGH,
    );

    if (truncatableItems.length === 0) {
      return {
        items,
        result: {
          removedCount: 0,
          summarizedCount: 0,
          tokensSaved: 0,
          newTokenCount: currentTokens,
          compressionRatio: 1,
        },
      };
    }

    // Calculate how much to truncate from each item
    const tokensPerItem = Math.ceil(tokensToSave / truncatableItems.length);

    const processed: ContextItem[] = [];
    let totalSaved = 0;

    for (const item of items) {
      const truncatable = truncatableItems.find((t) => t.id === item.id);

      if (truncatable) {
        const targetItemTokens = Math.max(
          this.config.minTokensPerItem,
          item.tokenCount - tokensPerItem,
        );
        const truncated = this.truncateContent(item.content, targetItemTokens);
        const newTokenCount = this.tokenCounter(truncated);

        processed.push({
          ...item,
          content: truncated,
          tokenCount: newTokenCount,
        });
        totalSaved += item.tokenCount - newTokenCount;
      } else {
        processed.push(item);
      }
    }

    const newTokenCount = currentTokens - totalSaved;

    return {
      items: processed,
      result: {
        removedCount: 0,
        summarizedCount: truncatableItems.length,
        tokensSaved: totalSaved,
        newTokenCount,
        compressionRatio: newTokenCount / currentTokens,
      },
    };
  }

  /**
   * Mixed compression strategy
   */
  private async compressMixed(
    items: ContextItem[],
    targetTokens: number,
    currentTokens: number,
  ): Promise<{ items: ContextItem[]; result: CompressionResult }> {
    let result: { items: ContextItem[]; result: CompressionResult };

    // Step 1: Try summarization first
    result = await this.compressBySummarization(items, targetTokens, currentTokens);

    if (result.result.newTokenCount <= targetTokens) {
      return result;
    }

    // Step 2: Try truncation
    result = await this.compressByTruncation(
      result.items,
      targetTokens,
      result.result.newTokenCount,
    );

    if (result.result.newTokenCount <= targetTokens) {
      return result;
    }

    // Step 3: Remove items as last resort
    return this.compressByRemoval(result.items, targetTokens, result.result.newTokenCount);
  }

  /**
   * Summarize an item
   */
  private async summarizeItem(item: ContextItem): Promise<string> {
    if (this.config.summarizer) {
      return this.config.summarizer(item.content);
    }

    // Default: create a simple summary by extracting key lines
    return this.createSimpleSummary(item);
  }

  /**
   * Create a simple summary without AI
   */
  private createSimpleSummary(item: ContextItem): string {
    const lines = item.content.split('\n').filter((line) => line.trim());
    const maxLines = 5;

    if (lines.length <= maxLines) {
      return item.content;
    }

    // Take first and last lines, plus some from middle
    const summary: string[] = [];
    summary.push(lines[0]);

    if (lines.length > 2) {
      summary.push('...');
      const midIndex = Math.floor(lines.length / 2);
      summary.push(lines[midIndex]);
    }

    if (lines.length > 1) {
      summary.push('...');
      summary.push(lines[lines.length - 1]);
    }

    const prefix = this.getSummaryPrefix(item.type);
    return `${prefix}\n${summary.join('\n')}`;
  }

  /**
   * Get summary prefix based on type
   */
  private getSummaryPrefix(type: ContextItemType): string {
    switch (type) {
      case ContextItemType.USER_MESSAGE:
        return '[Summary of user message]';
      case ContextItemType.ASSISTANT_MESSAGE:
        return '[Summary of assistant response]';
      case ContextItemType.TOOL_RESULT:
        return '[Summary of tool output]';
      case ContextItemType.FILE_CONTENT:
        return '[Summary of file content]';
      default:
        return '[Summary]';
    }
  }

  /**
   * Truncate content to approximate token count
   */
  private truncateContent(content: string, targetTokens: number): string {
    const charLimit = targetTokens * 4; // Approximate

    if (content.length <= charLimit) {
      return content;
    }

    // Truncate and add ellipsis
    return content.substring(0, charLimit - 3) + '...';
  }

  /**
   * Set summarizer function
   */
  setSummarizer(summarizer: (content: string) => Promise<string>): void {
    this.config.summarizer = summarizer;
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a context compressor
 */
export function createContextCompressor(
  config?: Partial<CompressionConfig>,
  tokenCounter?: (text: string) => number,
): ContextCompressor {
  return new ContextCompressor(config, tokenCounter);
}
