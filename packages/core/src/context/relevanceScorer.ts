/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextItem } from './types.js';

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  /** Weight for recency score (0-1) */
  recencyWeight: number;
  /** Weight for proximity score (0-1) */
  proximityWeight: number;
  /** Weight for semantic score (0-1) */
  semanticWeight: number;
  /** Weight for usage frequency score (0-1) */
  frequencyWeight: number;
  /** Weight for type score (0-1) */
  typeWeight: number;
  /** Half-life for recency decay (hours) */
  recencyHalfLife: number;
  /** Max depth for proximity scoring */
  proximityMaxDepth: number;
}

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  recencyWeight: 0.25,
  proximityWeight: 0.2,
  semanticWeight: 0.25,
  frequencyWeight: 0.15,
  typeWeight: 0.15,
  recencyHalfLife: 2, // 2 hours
  proximityMaxDepth: 5,
};

/**
 * Score breakdown for debugging/analysis
 */
export interface ScoreBreakdown {
  recency: number;
  proximity: number;
  semantic: number;
  frequency: number;
  type: number;
  total: number;
}

/**
 * Scored context item
 */
export interface ScoredContextItem {
  item: ContextItem;
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Relevance Scorer
 *
 * Scores context items based on multiple factors:
 * - Recency: How recently the item was used
 * - Proximity: How close the item is to current context (file paths)
 * - Semantic: Content similarity to current query
 * - Frequency: How often the item has been accessed
 * - Type: Priority based on item type
 */
export class RelevanceScorer {
  private config: ScoringConfig;
  private currentFile: string | null = null;
  private currentQuery: string | null = null;

  constructor(config: Partial<ScoringConfig> = {}) {
    this.config = { ...DEFAULT_SCORING_CONFIG, ...config };
  }

  /**
   * Set current file context for proximity scoring
   */
  setCurrentFile(filePath: string): void {
    this.currentFile = filePath;
  }

  /**
   * Set current query for semantic scoring
   */
  setCurrentQuery(query: string): void {
    this.currentQuery = query;
  }

  /**
   * Score a single item
   */
  score(item: ContextItem): ScoredContextItem {
    const now = new Date();

    const recencyScore = this.scoreRecency(item, now);
    const proximityScore = this.scoreProximity(item);
    const semanticScore = this.scoreSemantic(item);
    const frequencyScore = this.scoreFrequency(item);
    const typeScore = this.scoreType(item);

    const total =
      recencyScore * this.config.recencyWeight +
      proximityScore * this.config.proximityWeight +
      semanticScore * this.config.semanticWeight +
      frequencyScore * this.config.frequencyWeight +
      typeScore * this.config.typeWeight;

    return {
      item,
      score: total,
      breakdown: {
        recency: recencyScore,
        proximity: proximityScore,
        semantic: semanticScore,
        frequency: frequencyScore,
        type: typeScore,
        total,
      },
    };
  }

  /**
   * Score and rank multiple items
   */
  scoreAll(items: ContextItem[]): ScoredContextItem[] {
    const scored = items.map((item) => this.score(item));
    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Get top N items by relevance
   */
  getTopN(items: ContextItem[], n: number): ContextItem[] {
    const scored = this.scoreAll(items);
    return scored.slice(0, n).map((s) => s.item);
  }

  /**
   * Filter items above threshold
   */
  filterByThreshold(items: ContextItem[], threshold: number): ContextItem[] {
    const scored = this.scoreAll(items);
    return scored.filter((s) => s.score >= threshold).map((s) => s.item);
  }

  /**
   * Score based on recency (exponential decay)
   */
  private scoreRecency(item: ContextItem, now: Date): number {
    const ageMs = now.getTime() - item.lastAccessedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Exponential decay with configurable half-life
    // Score = 0.5 ^ (age / halfLife)
    const decayFactor = Math.pow(0.5, ageHours / this.config.recencyHalfLife);

    return Math.max(0, Math.min(1, decayFactor));
  }

  /**
   * Score based on file path proximity
   */
  private scoreProximity(item: ContextItem): number {
    if (!this.currentFile || !item.sourcePath) {
      return 0.5; // Neutral score when no path context
    }

    const currentParts = this.normalizePath(this.currentFile).split('/');
    const itemParts = this.normalizePath(item.sourcePath).split('/');

    // Find common prefix length
    let commonLength = 0;
    const minLength = Math.min(currentParts.length, itemParts.length);

    for (let i = 0; i < minLength; i++) {
      if (currentParts[i] === itemParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    // Same file = 1.0
    if (item.sourcePath === this.currentFile) {
      return 1.0;
    }

    // Same directory = 0.9
    if (commonLength >= currentParts.length - 1 && commonLength >= itemParts.length - 1) {
      return 0.9;
    }

    // Calculate proximity based on common path depth
    const maxDepth = Math.max(currentParts.length, itemParts.length);
    const proximity = commonLength / Math.min(maxDepth, this.config.proximityMaxDepth);

    return Math.max(0, Math.min(1, proximity));
  }

  /**
   * Score based on semantic similarity
   */
  private scoreSemantic(item: ContextItem): number {
    if (!this.currentQuery) {
      return 0.5; // Neutral score when no query
    }

    const content = item.content.toLowerCase();
    const query = this.currentQuery.toLowerCase();

    // Simple keyword matching (can be enhanced with embeddings)
    const queryWords = this.extractKeywords(query);
    const contentWords = new Set(this.extractKeywords(content));

    if (queryWords.length === 0) {
      return 0.5;
    }

    let matches = 0;
    for (const word of queryWords) {
      if (contentWords.has(word)) {
        matches++;
      }
    }

    // Also check for substring matches
    for (const word of queryWords) {
      if (word.length >= 3 && content.includes(word) && !contentWords.has(word)) {
        matches += 0.5;
      }
    }

    return Math.min(1, matches / queryWords.length);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful tokens
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
      'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
      'it', 'its', 'he', 'she', 'they', 'we', 'you', 'i', 'me', 'my',
    ]);

    return text
      .split(/[\s\W]+/)
      .filter((word) => word.length >= 2 && !stopWords.has(word))
      .map((word) => word.toLowerCase());
  }

  /**
   * Score based on access frequency
   */
  private scoreFrequency(item: ContextItem): number {
    // Logarithmic scaling: frequent items score higher
    // Score = log10(count + 1) / log10(100)
    // This gives 0 for count=0, ~0.5 for count=9, 1 for count=99
    const normalizedScore = Math.log10(item.accessCount + 1) / 2;
    return Math.max(0, Math.min(1, normalizedScore));
  }

  /**
   * Score based on item type
   */
  private scoreType(item: ContextItem): number {
    // Map priority to score (CRITICAL=1 -> 1.0, EPHEMERAL=5 -> 0.2)
    return 1 - (item.priority - 1) / 5;
  }

  /**
   * Normalize file path for comparison
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Update scoring configuration
   */
  setConfig(config: Partial<ScoringConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): ScoringConfig {
    return { ...this.config };
  }

  /**
   * Calculate semantic similarity using Jaccard index
   */
  calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1));
    const words2 = new Set(this.extractKeywords(text2));

    if (words1.size === 0 && words2.size === 0) {
      return 1;
    }

    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        intersection++;
      }
    }

    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate cosine similarity of word frequency vectors
   */
  calculateCosineSimilarity(text1: string, text2: string): number {
    const words1 = this.extractKeywords(text1);
    const words2 = this.extractKeywords(text2);

    // Build frequency maps
    const freq1 = new Map<string, number>();
    const freq2 = new Map<string, number>();

    for (const word of words1) {
      freq1.set(word, (freq1.get(word) ?? 0) + 1);
    }
    for (const word of words2) {
      freq2.set(word, (freq2.get(word) ?? 0) + 1);
    }

    // Calculate cosine similarity
    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const v1 = freq1.get(word) ?? 0;
      const v2 = freq2.get(word) ?? 0;
      dotProduct += v1 * v2;
      magnitude1 += v1 * v1;
      magnitude2 += v2 * v2;
    }

    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }
}

/**
 * Create a relevance scorer
 */
export function createRelevanceScorer(config?: Partial<ScoringConfig>): RelevanceScorer {
  return new RelevanceScorer(config);
}
