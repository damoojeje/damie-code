/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ContextManager, createContextManager } from './contextManager.js';
import type { ContextPrioritizer } from './contextPrioritizer.js';
import { createContextPrioritizer } from './contextPrioritizer.js';
import type { ContextCompressor } from './contextCompressor.js';
import { createContextCompressor, CompressionStrategy } from './contextCompressor.js';
import type { ContextPersistence } from './contextPersistence.js';
import { createContextPersistence } from './contextPersistence.js';
import { ContextItemType, ContextPriority } from './types.js';

describe('ContextManager', () => {
  let manager: ContextManager;

  beforeEach(() => {
    manager = new ContextManager({
      window: {
        maxTokens: 1000,
        reservedForResponse: 100,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
        autoCompress: false,
        compressionTarget: 0.7,
        minItemsToKeep: 2,
      },
    });
  });

  describe('add', () => {
    it('should add item to context', () => {
      const item = manager.add('Hello world', ContextItemType.USER_MESSAGE);

      expect(item.id).toMatch(/^ctx_/);
      expect(item.content).toBe('Hello world');
      expect(item.type).toBe(ContextItemType.USER_MESSAGE);
      expect(item.tokenCount).toBeGreaterThan(0);
    });

    it('should set default priority based on type', () => {
      const system = manager.add('System', ContextItemType.SYSTEM_PROMPT);
      const user = manager.add('User', ContextItemType.USER_MESSAGE);
      const memory = manager.add('Memory', ContextItemType.MEMORY);

      expect(system.priority).toBe(ContextPriority.CRITICAL);
      expect(user.priority).toBe(ContextPriority.HIGH);
      expect(memory.priority).toBe(ContextPriority.LOW);
    });

    it('should allow custom priority', () => {
      const item = manager.add('Test', ContextItemType.USER_MESSAGE, {
        priority: ContextPriority.LOW,
      });

      expect(item.priority).toBe(ContextPriority.LOW);
    });
  });

  describe('get', () => {
    it('should retrieve item by ID', () => {
      const added = manager.add('Test content', ContextItemType.USER_MESSAGE);
      const retrieved = manager.get(added.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.content).toBe('Test content');
    });

    it('should update access count on get', () => {
      const added = manager.add('Test', ContextItemType.USER_MESSAGE);
      expect(added.accessCount).toBe(1);

      manager.get(added.id);
      manager.get(added.id);

      const retrieved = manager.get(added.id);
      expect(retrieved?.accessCount).toBe(4);
    });

    it('should return undefined for missing ID', () => {
      const result = manager.get('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('should remove item by ID', () => {
      const item = manager.add('Test', ContextItemType.USER_MESSAGE);
      expect(manager.getAll().length).toBe(1);

      manager.remove(item.id);
      expect(manager.getAll().length).toBe(0);
    });

    it('should return false for missing ID', () => {
      const result = manager.remove('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return all items', () => {
      manager.add('One', ContextItemType.USER_MESSAGE);
      manager.add('Two', ContextItemType.ASSISTANT_MESSAGE);
      manager.add('Three', ContextItemType.TOOL_RESULT);

      const items = manager.getAll();
      expect(items.length).toBe(3);
    });
  });

  describe('getByType', () => {
    it('should filter items by type', () => {
      manager.add('User 1', ContextItemType.USER_MESSAGE);
      manager.add('Assistant', ContextItemType.ASSISTANT_MESSAGE);
      manager.add('User 2', ContextItemType.USER_MESSAGE);

      const userMessages = manager.getByType(ContextItemType.USER_MESSAGE);
      expect(userMessages.length).toBe(2);
    });
  });

  describe('token counting', () => {
    it('should track current tokens', () => {
      manager.add('Hello', ContextItemType.USER_MESSAGE); // ~2 tokens
      manager.add('World', ContextItemType.USER_MESSAGE); // ~2 tokens

      const tokens = manager.getCurrentTokens();
      expect(tokens).toBeGreaterThan(0);
    });

    it('should calculate available tokens', () => {
      const maxAvailable = 1000 - 100; // maxTokens - reserved
      const available = manager.getAvailableTokens();

      expect(available).toBe(maxAvailable);
    });

    it('should reduce available after adding', () => {
      const before = manager.getAvailableTokens();
      manager.add('Some content here', ContextItemType.USER_MESSAGE);
      const after = manager.getAvailableTokens();

      expect(after).toBeLessThan(before);
    });
  });

  describe('getState', () => {
    it('should return context window state', () => {
      manager.add('Test content', ContextItemType.USER_MESSAGE);

      const state = manager.getState();

      expect(state.currentTokens).toBeGreaterThan(0);
      expect(state.availableTokens).toBeGreaterThan(0);
      expect(state.usagePercent).toBeGreaterThan(0);
      expect(state.itemCount).toBe(1);
      expect(state.itemsByType[ContextItemType.USER_MESSAGE]).toBe(1);
    });

    it('should detect warning threshold', () => {
      // Fill up 80% of context (900 * 0.8 = 720 tokens needed)
      const largeContent = 'x'.repeat(3000); // ~750 tokens
      manager.add(largeContent, ContextItemType.USER_MESSAGE);

      const state = manager.getState();
      expect(state.isWarning).toBe(true);
    });
  });

  describe('getPrioritized', () => {
    it('should return items sorted by priority score', () => {
      manager.add('System prompt', ContextItemType.SYSTEM_PROMPT);
      manager.add('User message', ContextItemType.USER_MESSAGE);
      manager.add('Old memory', ContextItemType.MEMORY);

      const prioritized = manager.getPrioritized();

      // System prompt should be first (critical)
      expect(prioritized[0].type).toBe(ContextItemType.SYSTEM_PROMPT);
    });
  });

  describe('getForBudget', () => {
    it('should return items within token budget', () => {
      manager.add('Short', ContextItemType.USER_MESSAGE);
      manager.add('x'.repeat(400), ContextItemType.ASSISTANT_MESSAGE);
      manager.add('Also short', ContextItemType.USER_MESSAGE);

      const items = manager.getForBudget(50); // Very limited budget

      // Should get fewer items due to budget
      expect(items.length).toBeLessThan(3);
    });
  });

  describe('compress', () => {
    it('should compress context when over target', async () => {
      // Add enough content to exceed 50% of capacity
      // With maxTokens=1000, reserved=100, effective=900
      // Target at 0.5 = 450 tokens
      // Need to add > 450 tokens worth of content (> 1800 chars)
      manager.add('x'.repeat(1000), ContextItemType.USER_MESSAGE, {
        canSummarize: true,
        canRemove: true,
        priority: ContextPriority.LOW,
      });
      manager.add('y'.repeat(1000), ContextItemType.ASSISTANT_MESSAGE, {
        canSummarize: true,
        canRemove: true,
        priority: ContextPriority.LOW,
      });

      const beforeTokens = manager.getCurrentTokens();
      // Current tokens should be around 500 (2000 chars / 4)
      expect(beforeTokens).toBeGreaterThan(450);

      const result = await manager.compress(0.5);

      expect(result.tokensSaved).toBeGreaterThan(0);
      expect(manager.getCurrentTokens()).toBeLessThan(beforeTokens);
    });

    it('should not compress when under target', async () => {
      manager.add('Short text', ContextItemType.USER_MESSAGE);

      const beforeTokens = manager.getCurrentTokens();
      const result = await manager.compress(0.9);

      expect(result.tokensSaved).toBe(0);
      expect(manager.getCurrentTokens()).toBe(beforeTokens);
    });
  });

  describe('clear', () => {
    it('should remove all items', () => {
      manager.add('One', ContextItemType.USER_MESSAGE);
      manager.add('Two', ContextItemType.USER_MESSAGE);

      manager.clear();

      expect(manager.getAll().length).toBe(0);
      expect(manager.getCurrentTokens()).toBe(0);
    });
  });

  describe('clearByType', () => {
    it('should remove items of specific type', () => {
      manager.add('User 1', ContextItemType.USER_MESSAGE);
      manager.add('Assistant', ContextItemType.ASSISTANT_MESSAGE);
      manager.add('User 2', ContextItemType.USER_MESSAGE);

      const removed = manager.clearByType(ContextItemType.USER_MESSAGE);

      expect(removed).toBe(2);
      expect(manager.getAll().length).toBe(1);
    });
  });

  describe('setModel', () => {
    it('should update max tokens for model', () => {
      manager.setModel('gpt-4');
      expect(manager.getMaxTokens()).toBe(8192);

      manager.setModel('claude-3-opus');
      expect(manager.getMaxTokens()).toBe(200000);
    });

    it('should use default for unknown model', () => {
      manager.setModel('unknown-model');
      expect(manager.getMaxTokens()).toBe(8192);
    });
  });

  describe('buildPromptContext', () => {
    it('should build context string', () => {
      manager.add('System instructions', ContextItemType.SYSTEM_PROMPT);
      manager.add('User question', ContextItemType.USER_MESSAGE);
      manager.add('Assistant response', ContextItemType.ASSISTANT_MESSAGE);

      const context = manager.buildPromptContext();

      expect(context).toContain('System instructions');
      expect(context).toContain('User question');
      expect(context).toContain('Assistant response');
    });
  });
});

describe('ContextPrioritizer', () => {
  let prioritizer: ContextPrioritizer;

  beforeEach(() => {
    prioritizer = createContextPrioritizer();
  });

  describe('scoreItem', () => {
    it('should score items based on factors', () => {
      const now = new Date();
      const item = {
        id: 'test',
        type: ContextItemType.USER_MESSAGE,
        content: 'Test',
        priority: ContextPriority.HIGH,
        tokenCount: 10,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 5,
        canSummarize: true,
        canRemove: true,
              };

      const scored = prioritizer.scoreItem(item);

      expect(scored.score).toBeGreaterThan(0);
      expect(scored.score).toBeLessThanOrEqual(1);
      expect(scored.breakdown.recency).toBeGreaterThan(0);
      expect(scored.breakdown.priority).toBeGreaterThan(0);
    });
  });

  describe('prioritize', () => {
    it('should sort items by score', () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const items = [
        {
          id: '1',
          type: ContextItemType.MEMORY,
          content: 'Old low priority',
          priority: ContextPriority.LOW,
          tokenCount: 10,
          createdAt: oldDate,
          lastAccessedAt: oldDate,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
        {
          id: '2',
          type: ContextItemType.SYSTEM_PROMPT,
          content: 'Critical',
          priority: ContextPriority.CRITICAL,
          tokenCount: 10,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 10,
          canSummarize: false,
          canRemove: false,
                  },
      ];

      const prioritized = prioritizer.prioritize(items);

      expect(prioritized[0].item.id).toBe('2'); // Critical should be first
    });
  });

  describe('getRemovable', () => {
    it('should return removable items', () => {
      const now = new Date();
      const items = [
        {
          id: '1',
          type: ContextItemType.SYSTEM_PROMPT,
          content: 'Critical',
          priority: ContextPriority.CRITICAL,
          tokenCount: 10,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: false,
          canRemove: false,
                  },
        {
          id: '2',
          type: ContextItemType.MEMORY,
          content: 'Removable',
          priority: ContextPriority.LOW,
          tokenCount: 10,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ];

      const removable = prioritizer.getRemovable(items, 1);

      expect(removable.length).toBe(1);
      expect(removable[0].id).toBe('2');
    });
  });
});

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    compressor = createContextCompressor({
      strategy: CompressionStrategy.REMOVE,
    });
  });

  describe('compress', () => {
    it('should remove items to meet target', async () => {
      const now = new Date();
      const items = [
        {
          id: '1',
          type: ContextItemType.USER_MESSAGE,
          content: 'x'.repeat(100),
          priority: ContextPriority.HIGH,
          tokenCount: 25,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
        {
          id: '2',
          type: ContextItemType.MEMORY,
          content: 'y'.repeat(100),
          priority: ContextPriority.LOW,
          tokenCount: 25,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ];

      const { items: compressed, result } = await compressor.compress(items, 30);

      expect(compressed.length).toBeLessThan(items.length);
      expect(result.removedCount).toBeGreaterThan(0);
    });

    it('should keep items when under target', async () => {
      const now = new Date();
      const items = [
        {
          id: '1',
          type: ContextItemType.USER_MESSAGE,
          content: 'Short',
          priority: ContextPriority.HIGH,
          tokenCount: 5,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ];

      const { items: compressed, result } = await compressor.compress(items, 100);

      expect(compressed.length).toBe(1);
      expect(result.removedCount).toBe(0);
    });
  });
});

describe('ContextPersistence', () => {
  let persistence: ContextPersistence;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-persist-'));
    persistence = createContextPersistence({
      baseDir: tempDir,
      autoSaveInterval: 0, // Disable auto-save for tests
    });
  });

  describe('startSession', () => {
    it('should start a new session', () => {
      const sessionId = persistence.startSession();
      expect(sessionId).toMatch(/^session_/);
      expect(persistence.isActive()).toBe(true);
    });

    it('should use provided session ID', () => {
      const sessionId = persistence.startSession('my-session');
      expect(sessionId).toBe('my-session');
    });
  });

  describe('save and load', () => {
    it('should save and load items', async () => {
      const sessionId = persistence.startSession();
      const now = new Date();
      const items = [
        {
          id: 'item1',
          type: ContextItemType.USER_MESSAGE,
          content: 'Test content',
          priority: ContextPriority.HIGH,
          tokenCount: 10,
          createdAt: now,
          lastAccessedAt: now,
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ];

      await persistence.save(items);
      await persistence.endSession();

      const loaded = await persistence.load(sessionId);

      expect(loaded).not.toBeNull();
      expect(loaded?.items.length).toBe(1);
      expect(loaded?.items[0].content).toBe('Test content');
    });
  });

  describe('listSessions', () => {
    it('should list all sessions', async () => {
      persistence.startSession('session1');
      await persistence.save([]);
      await persistence.endSession();

      persistence.startSession('session2');
      await persistence.save([]);
      await persistence.endSession();

      const sessions = await persistence.listSessions();
      expect(sessions.length).toBe(2);
    });
  });

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sessionId = persistence.startSession();
      await persistence.save([]);
      await persistence.endSession();

      const deleted = await persistence.deleteSession(sessionId);
      expect(deleted).toBe(true);

      const sessions = await persistence.listSessions();
      expect(sessions.length).toBe(0);
    });
  });

  describe('loadLatest', () => {
    it('should load most recent session', async () => {
      persistence.startSession('old-session');
      await persistence.save([
        {
          id: 'old',
          type: ContextItemType.USER_MESSAGE,
          content: 'Old',
          priority: ContextPriority.HIGH,
          tokenCount: 3,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ]);
      await persistence.endSession();

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      persistence.startSession('new-session');
      await persistence.save([
        {
          id: 'new',
          type: ContextItemType.USER_MESSAGE,
          content: 'New',
          priority: ContextPriority.HIGH,
          tokenCount: 3,
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          accessCount: 1,
          canSummarize: true,
          canRemove: true,
                  },
      ]);
      await persistence.endSession();

      const latest = await persistence.loadLatest();
      expect(latest?.items[0].content).toBe('New');
    });
  });
});

describe('createContextManager', () => {
  it('should create manager with factory function', () => {
    const manager = createContextManager();
    expect(manager).toBeInstanceOf(ContextManager);
  });

  it('should pass config to factory', () => {
    const manager = createContextManager({
      window: { maxTokens: 5000 },
    });
    expect(manager.getMaxTokens()).toBe(5000);
  });
});
