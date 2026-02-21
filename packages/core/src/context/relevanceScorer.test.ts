/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelevanceScorer, createRelevanceScorer, DEFAULT_SCORING_CONFIG } from './relevanceScorer.js';
import { ContextItemType, ContextPriority } from './types.js';
import type { ContextItem } from './types.js';

describe('RelevanceScorer', () => {
  let scorer: RelevanceScorer;

  const createItem = (overrides: Partial<ContextItem> = {}): ContextItem => {
    const now = new Date();
    return {
      id: 'test-id',
      type: ContextItemType.USER_MESSAGE,
      content: 'Test content',
      priority: ContextPriority.MEDIUM,
      tokenCount: 10,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 1,
      canSummarize: true,
      canRemove: true,
      ...overrides,
    };
  };

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  describe('constructor', () => {
    it('should create scorer with default config', () => {
      const scorer = new RelevanceScorer();
      expect(scorer.getConfig()).toEqual(DEFAULT_SCORING_CONFIG);
    });

    it('should accept custom config', () => {
      const scorer = new RelevanceScorer({ recencyWeight: 0.5 });
      expect(scorer.getConfig().recencyWeight).toBe(0.5);
    });
  });

  describe('score', () => {
    it('should return score between 0 and 1', () => {
      const item = createItem();
      const result = scorer.score(item);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should include score breakdown', () => {
      const item = createItem();
      const result = scorer.score(item);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.recency).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.proximity).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.semantic).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.frequency).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.type).toBeGreaterThanOrEqual(0);
    });
  });

  describe('recency scoring', () => {
    it('should give higher score to recent items', () => {
      const now = new Date();
      const recentItem = createItem({ lastAccessedAt: now });
      const oldItem = createItem({
        lastAccessedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000), // 24 hours ago
      });

      const recentScore = scorer.score(recentItem);
      const oldScore = scorer.score(oldItem);

      expect(recentScore.breakdown.recency).toBeGreaterThan(oldScore.breakdown.recency);
    });

    it('should use exponential decay', () => {
      const now = new Date();
      const halfLifeAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago (default half-life)

      const item = createItem({ lastAccessedAt: halfLifeAgo });
      const result = scorer.score(item);

      // At half-life, score should be around 0.5
      expect(result.breakdown.recency).toBeCloseTo(0.5, 1);
    });
  });

  describe('proximity scoring', () => {
    it('should give highest score to same file', () => {
      scorer.setCurrentFile('/src/components/Button.tsx');
      const item = createItem({ sourcePath: '/src/components/Button.tsx' });

      const result = scorer.score(item);
      expect(result.breakdown.proximity).toBe(1.0);
    });

    it('should give high score to same directory', () => {
      scorer.setCurrentFile('/src/components/Button.tsx');
      const item = createItem({ sourcePath: '/src/components/Input.tsx' });

      const result = scorer.score(item);
      expect(result.breakdown.proximity).toBeGreaterThan(0.8);
    });

    it('should give lower score to distant files', () => {
      scorer.setCurrentFile('/src/components/Button.tsx');
      const nearItem = createItem({ sourcePath: '/src/components/Input.tsx' });
      const farItem = createItem({ sourcePath: '/tests/utils/helpers.ts' });

      const nearResult = scorer.score(nearItem);
      const farResult = scorer.score(farItem);

      expect(nearResult.breakdown.proximity).toBeGreaterThan(farResult.breakdown.proximity);
    });

    it('should handle no current file', () => {
      const item = createItem({ sourcePath: '/src/file.ts' });
      const result = scorer.score(item);

      // Should give neutral score
      expect(result.breakdown.proximity).toBe(0.5);
    });
  });

  describe('semantic scoring', () => {
    it('should give higher score to matching content', () => {
      scorer.setCurrentQuery('button component styling');

      const matchingItem = createItem({
        content: 'This is a button component with custom styling',
      });
      const nonMatchingItem = createItem({
        content: 'Database connection utilities',
      });

      const matchResult = scorer.score(matchingItem);
      const noMatchResult = scorer.score(nonMatchingItem);

      expect(matchResult.breakdown.semantic).toBeGreaterThan(noMatchResult.breakdown.semantic);
    });

    it('should handle no query', () => {
      const item = createItem();
      const result = scorer.score(item);

      // Should give neutral score
      expect(result.breakdown.semantic).toBe(0.5);
    });

    it('should ignore stop words', () => {
      scorer.setCurrentQuery('the a an');
      const item = createItem({ content: 'button styling' });

      const result = scorer.score(item);
      // No meaningful matches
      expect(result.breakdown.semantic).toBe(0.5);
    });
  });

  describe('frequency scoring', () => {
    it('should give higher score to frequently accessed items', () => {
      const frequentItem = createItem({ accessCount: 50 });
      const rareItem = createItem({ accessCount: 1 });

      const frequentResult = scorer.score(frequentItem);
      const rareResult = scorer.score(rareItem);

      expect(frequentResult.breakdown.frequency).toBeGreaterThan(rareResult.breakdown.frequency);
    });

    it('should use logarithmic scaling', () => {
      // Use smaller values to avoid hitting the cap at 1.0
      const items = [
        createItem({ accessCount: 1 }),
        createItem({ accessCount: 3 }),
        createItem({ accessCount: 9 }),
      ];

      const scores = items.map((item) => scorer.score(item).breakdown.frequency);

      // Logarithmic: log10(1+1)=0.30, log10(3+1)=0.60, log10(9+1)=1.0
      // All values should increase but the increments can vary based on log curve
      expect(scores[0]).toBeLessThan(scores[1]);
      expect(scores[1]).toBeLessThan(scores[2]);

      // The ratio of each step should be similar (multiplicative growth = additive in log scale)
      // For perfect log scaling: each tripling gives same log increment
      const ratio1 = scores[1] / scores[0];
      const ratio2 = scores[2] / scores[1];
      // These ratios should be roughly similar
      expect(Math.abs(ratio1 - ratio2)).toBeLessThan(ratio1 * 0.5);
    });
  });

  describe('type scoring', () => {
    it('should give higher score to critical items', () => {
      const criticalItem = createItem({ priority: ContextPriority.CRITICAL });
      const lowItem = createItem({ priority: ContextPriority.LOW });

      const criticalResult = scorer.score(criticalItem);
      const lowResult = scorer.score(lowItem);

      expect(criticalResult.breakdown.type).toBeGreaterThan(lowResult.breakdown.type);
    });
  });

  describe('scoreAll', () => {
    it('should score and sort items', () => {
      const now = new Date();
      const items = [
        createItem({
          id: 'old',
          lastAccessedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        }),
        createItem({ id: 'recent', lastAccessedAt: now }),
      ];

      const results = scorer.scoreAll(items);

      expect(results[0].item.id).toBe('recent');
      expect(results[1].item.id).toBe('old');
    });
  });

  describe('getTopN', () => {
    it('should return top N items', () => {
      const items = [
        createItem({ id: '1', accessCount: 1 }),
        createItem({ id: '2', accessCount: 50 }),
        createItem({ id: '3', accessCount: 100 }),
        createItem({ id: '4', accessCount: 5 }),
      ];

      const top2 = scorer.getTopN(items, 2);

      expect(top2.length).toBe(2);
      // Higher access count should be first
      expect(top2.map((i) => i.id)).toContain('3');
      expect(top2.map((i) => i.id)).toContain('2');
    });
  });

  describe('filterByThreshold', () => {
    it('should filter items below threshold', () => {
      const now = new Date();
      const items = [
        createItem({
          id: 'high',
          priority: ContextPriority.CRITICAL,
          accessCount: 100,
        }),
        createItem({
          id: 'low',
          priority: ContextPriority.EPHEMERAL,
          accessCount: 1,
          lastAccessedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
        }),
      ];

      const filtered = scorer.filterByThreshold(items, 0.5);

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('high');
    });
  });

  describe('similarity functions', () => {
    describe('calculateJaccardSimilarity', () => {
      it('should return 1 for identical texts', () => {
        const similarity = scorer.calculateJaccardSimilarity(
          'hello world programming',
          'hello world programming',
        );
        expect(similarity).toBe(1);
      });

      it('should return 0 for completely different texts', () => {
        const similarity = scorer.calculateJaccardSimilarity(
          'apple banana orange',
          'car truck bus',
        );
        expect(similarity).toBe(0);
      });

      it('should return partial match for overlapping texts', () => {
        const similarity = scorer.calculateJaccardSimilarity(
          'hello world programming',
          'hello programming today',
        );
        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThan(1);
      });
    });

    describe('calculateCosineSimilarity', () => {
      it('should return 1 for identical texts', () => {
        const similarity = scorer.calculateCosineSimilarity(
          'hello world programming',
          'hello world programming',
        );
        expect(similarity).toBeCloseTo(1, 5);
      });

      it('should return 0 for completely different texts', () => {
        const similarity = scorer.calculateCosineSimilarity(
          'apple banana orange',
          'car truck bus',
        );
        expect(similarity).toBe(0);
      });

      it('should handle repeated words', () => {
        const similarity = scorer.calculateCosineSimilarity(
          'hello hello hello',
          'hello world',
        );
        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThan(1);
      });
    });
  });

  describe('configuration', () => {
    it('should allow updating config', () => {
      scorer.setConfig({ recencyWeight: 0.8 });
      expect(scorer.getConfig().recencyWeight).toBe(0.8);
    });

    it('should preserve other config values', () => {
      const originalConfig = scorer.getConfig();
      scorer.setConfig({ recencyWeight: 0.8 });

      expect(scorer.getConfig().proximityWeight).toBe(originalConfig.proximityWeight);
    });
  });
});

describe('createRelevanceScorer', () => {
  it('should create scorer with factory function', () => {
    const scorer = createRelevanceScorer();
    expect(scorer).toBeInstanceOf(RelevanceScorer);
  });

  it('should pass config to factory', () => {
    const scorer = createRelevanceScorer({ recencyWeight: 0.9 });
    expect(scorer.getConfig().recencyWeight).toBe(0.9);
  });
});
