/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextItem } from './types.js';
import { ContextItemType, ContextPriority } from './types.js';

/**
 * Prioritization factors
 */
export interface PrioritizationFactors {
  /** Weight for recency (0-1) */
  recencyWeight: number;
  /** Weight for access frequency (0-1) */
  frequencyWeight: number;
  /** Weight for type priority (0-1) */
  typeWeight: number;
  /** Weight for explicit priority (0-1) */
  priorityWeight: number;
  /** Decay factor for old items */
  decayFactor: number;
}

/**
 * Default prioritization factors
 */
export const DEFAULT_PRIORITIZATION_FACTORS: PrioritizationFactors = {
  recencyWeight: 0.3,
  frequencyWeight: 0.2,
  typeWeight: 0.2,
  priorityWeight: 0.3,
  decayFactor: 0.95,
};

/**
 * Scored context item
 */
export interface ScoredItem {
  /** Original item */
  item: ContextItem;
  /** Calculated score (higher = more important) */
  score: number;
  /** Score breakdown */
  breakdown: {
    recency: number;
    frequency: number;
    type: number;
    priority: number;
  };
}

/**
 * Context Prioritizer
 *
 * Calculates importance scores for context items to determine
 * which items to keep, summarize, or remove when space is limited.
 */
export class ContextPrioritizer {
  private factors: PrioritizationFactors;
  private typeScores: Map<ContextItemType, number>;

  constructor(factors: Partial<PrioritizationFactors> = {}) {
    this.factors = { ...DEFAULT_PRIORITIZATION_FACTORS, ...factors };
    this.typeScores = this.initTypeScores();
  }

  /**
   * Initialize type-based scores
   */
  private initTypeScores(): Map<ContextItemType, number> {
    return new Map([
      [ContextItemType.SYSTEM_PROMPT, 1.0],
      [ContextItemType.USER_MESSAGE, 0.9],
      [ContextItemType.ASSISTANT_MESSAGE, 0.85],
      [ContextItemType.TOOL_CALL, 0.7],
      [ContextItemType.TOOL_RESULT, 0.6],
      [ContextItemType.FILE_CONTENT, 0.75],
      [ContextItemType.CODE_SNIPPET, 0.8],
      [ContextItemType.MEMORY, 0.65],
      [ContextItemType.SUMMARY, 0.5],
    ]);
  }

  /**
   * Score a single item
   */
  scoreItem(item: ContextItem, now: Date = new Date()): ScoredItem {
    const recencyScore = this.calculateRecencyScore(item, now);
    const frequencyScore = this.calculateFrequencyScore(item);
    const typeScore = this.calculateTypeScore(item);
    const priorityScore = this.calculatePriorityScore(item);

    const totalScore =
      recencyScore * this.factors.recencyWeight +
      frequencyScore * this.factors.frequencyWeight +
      typeScore * this.factors.typeWeight +
      priorityScore * this.factors.priorityWeight;

    return {
      item,
      score: totalScore,
      breakdown: {
        recency: recencyScore,
        frequency: frequencyScore,
        type: typeScore,
        priority: priorityScore,
      },
    };
  }

  /**
   * Score and sort items by importance
   */
  prioritize(items: ContextItem[]): ScoredItem[] {
    const now = new Date();
    const scored = items.map((item) => this.scoreItem(item, now));
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Get items to keep within token budget
   */
  selectForBudget(items: ContextItem[], tokenBudget: number): ContextItem[] {
    const prioritized = this.prioritize(items);
    const selected: ContextItem[] = [];
    let usedTokens = 0;

    for (const { item } of prioritized) {
      // Always include critical items
      if (item.priority === ContextPriority.CRITICAL) {
        selected.push(item);
        usedTokens += item.tokenCount;
        continue;
      }

      // Check if we can fit this item
      if (usedTokens + item.tokenCount <= tokenBudget) {
        selected.push(item);
        usedTokens += item.tokenCount;
      }
    }

    return selected;
  }

  /**
   * Get items that can be removed
   */
  getRemovable(items: ContextItem[], minToKeep: number = 5): ContextItem[] {
    const prioritized = this.prioritize(items);

    // Keep the top items, return the rest that can be removed
    const removable: ContextItem[] = [];

    for (let i = minToKeep; i < prioritized.length; i++) {
      const { item } = prioritized[i];
      if (item.canRemove && item.priority !== ContextPriority.CRITICAL) {
        removable.push(item);
      }
    }

    return removable;
  }

  /**
   * Get items that can be summarized
   */
  getSummarizable(items: ContextItem[], minToKeep: number = 5): ContextItem[] {
    const prioritized = this.prioritize(items);

    // Keep the top items, return summarizable from the rest
    const summarizable: ContextItem[] = [];

    for (let i = minToKeep; i < prioritized.length; i++) {
      const { item } = prioritized[i];
      if (item.canSummarize && !item.summary) {
        summarizable.push(item);
      }
    }

    return summarizable;
  }

  /**
   * Calculate recency score (0-1)
   */
  private calculateRecencyScore(item: ContextItem, now: Date): number {
    const ageMs = now.getTime() - item.lastAccessedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Exponential decay based on age
    return Math.pow(this.factors.decayFactor, ageHours);
  }

  /**
   * Calculate frequency score (0-1)
   */
  private calculateFrequencyScore(item: ContextItem): number {
    // Logarithmic scaling of access count
    return Math.min(1, Math.log10(item.accessCount + 1) / 2);
  }

  /**
   * Calculate type score (0-1)
   */
  private calculateTypeScore(item: ContextItem): number {
    return this.typeScores.get(item.type) ?? 0.5;
  }

  /**
   * Calculate priority score (0-1)
   */
  private calculatePriorityScore(item: ContextItem): number {
    // Convert priority enum (1-5) to score (1-0)
    return 1 - (item.priority - 1) / 4;
  }

  /**
   * Update factors
   */
  setFactors(factors: Partial<PrioritizationFactors>): void {
    this.factors = { ...this.factors, ...factors };
  }

  /**
   * Get current factors
   */
  getFactors(): PrioritizationFactors {
    return { ...this.factors };
  }
}

/**
 * Create a context prioritizer
 */
export function createContextPrioritizer(
  factors?: Partial<PrioritizationFactors>,
): ContextPrioritizer {
  return new ContextPrioritizer(factors);
}
