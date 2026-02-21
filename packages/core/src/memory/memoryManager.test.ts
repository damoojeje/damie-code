/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { MemoryManager, createMemoryManager } from './memoryManager.js';
import { MemoryType, MemoryImportance } from './types.js';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'));
    manager = new MemoryManager({
      persistEnabled: false,
      persistPath: tempDir,
    });
  });

  afterEach(() => {
    manager.stop();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('addMemory', () => {
    it('should add a memory entry', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'TypeScript is typed');

      expect(entry.id).toBeDefined();
      expect(entry.type).toBe(MemoryType.FACT);
      expect(entry.content).toBe('TypeScript is typed');
    });

    it('should add with options', () => {
      const entry = manager.addMemory(MemoryType.DECISION, 'Use React', {
        tags: ['frontend', 'library'],
        importance: MemoryImportance.HIGH,
        source: 'architecture review',
      });

      expect(entry.tags).toContain('frontend');
      expect(entry.importance).toBe(MemoryImportance.HIGH);
      expect(entry.source).toBe('architecture review');
    });
  });

  describe('convenience methods', () => {
    it('should remember facts', () => {
      const entry = manager.rememberFact('Jest is a testing framework');

      expect(entry.type).toBe(MemoryType.FACT);
    });

    it('should remember preferences', () => {
      const entry = manager.rememberPreference('Prefer functional components');

      expect(entry.tags).toContain('preference');
    });

    it('should remember decisions', () => {
      const entry = manager.rememberDecision(
        'Use PostgreSQL',
        'Need relational database',
        MemoryImportance.HIGH
      );

      expect(entry.type).toBe(MemoryType.DECISION);
      expect(entry.metadata['context']).toBe('Need relational database');
    });

    it('should remember errors', () => {
      const entry = manager.rememberError('Module not found', 'npm install');

      expect(entry.type).toBe(MemoryType.ERROR);
      expect(entry.metadata['solution']).toBe('npm install');
    });
  });

  describe('getMemory', () => {
    it('should retrieve memory by ID', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Test');
      const retrieved = manager.getMemory(entry.id);

      expect(retrieved).toBe(entry);
    });

    it('should update access stats', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Test');
      const originalAccess = entry.accessCount;

      manager.getMemory(entry.id);
      manager.getMemory(entry.id);

      expect(entry.accessCount).toBe(originalAccess + 2);
    });

    it('should return undefined for non-existent', () => {
      expect(manager.getMemory('nonexistent')).toBeUndefined();
    });
  });

  describe('searchMemories', () => {
    beforeEach(() => {
      manager.addMemory(MemoryType.FACT, 'React is a UI library', {
        tags: ['frontend'],
        importance: MemoryImportance.HIGH,
      });
      manager.addMemory(MemoryType.FACT, 'Node.js is a runtime', {
        tags: ['backend'],
        importance: MemoryImportance.MEDIUM,
      });
      manager.addMemory(MemoryType.ERROR, 'Memory leak in React app', {
        tags: ['frontend', 'bug'],
      });
    });

    it('should filter by type', () => {
      const results = manager.searchMemories({ types: [MemoryType.ERROR] });
      expect(results).toHaveLength(1);
    });

    it('should filter by tags', () => {
      const results = manager.searchMemories({ tags: ['frontend'] });
      expect(results).toHaveLength(2);
    });

    it('should filter by importance', () => {
      const results = manager.searchMemories({
        minImportance: MemoryImportance.HIGH,
      });
      expect(results).toHaveLength(1);
    });

    it('should search by query', () => {
      const results = manager.searchMemories({ query: 'React' });
      expect(results).toHaveLength(2);
    });

    it('should limit results', () => {
      const results = manager.searchMemories({ limit: 1 });
      expect(results).toHaveLength(1);
    });
  });

  describe('getRelevantMemories', () => {
    it('should find relevant memories', () => {
      manager.addMemory(MemoryType.FACT, 'ESLint checks code quality');
      manager.addMemory(MemoryType.FACT, 'Prettier formats code');
      manager.addMemory(MemoryType.FACT, 'TypeScript adds types');

      const results = manager.getRelevantMemories('code quality');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('ESLint');
    });
  });

  describe('updateMemory', () => {
    it('should update memory content', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Original');
      manager.updateMemory(entry.id, { content: 'Updated' });

      expect(entry.content).toBe('Updated');
    });

    it('should update tags', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Test');
      manager.updateMemory(entry.id, { tags: ['new-tag'] });

      expect(entry.tags).toContain('new-tag');
    });
  });

  describe('linkMemories', () => {
    it('should link two memories', () => {
      const entry1 = manager.addMemory(MemoryType.FACT, 'Fact 1');
      const entry2 = manager.addMemory(MemoryType.FACT, 'Fact 2');

      expect(manager.linkMemories(entry1.id, entry2.id)).toBe(true);
      expect(entry1.relatedIds).toContain(entry2.id);
      expect(entry2.relatedIds).toContain(entry1.id);
    });

    it('should return false for non-existent', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Test');
      expect(manager.linkMemories(entry.id, 'nonexistent')).toBe(false);
    });
  });

  describe('deleteMemory', () => {
    it('should delete memory', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Test');

      expect(manager.deleteMemory(entry.id)).toBe(true);
      expect(manager.getMemory(entry.id)).toBeUndefined();
    });
  });

  describe('sub-managers', () => {
    it('should access conversation manager', () => {
      expect(manager.conversations).toBeDefined();
      manager.conversations.createConversation('Test');
      expect(manager.conversations.getAllConversations()).toHaveLength(1);
    });

    it('should access task manager', () => {
      expect(manager.tasks).toBeDefined();
      manager.tasks.createTask('Test task');
      expect(manager.tasks.getAllTasks()).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('should return comprehensive stats', () => {
      manager.addMemory(MemoryType.FACT, 'Fact');
      manager.addMemory(MemoryType.ERROR, 'Error');
      manager.conversations.createConversation('Chat');
      manager.tasks.createTask('Task');

      const stats = manager.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.byType[MemoryType.FACT]).toBe(1);
      expect(stats.byType[MemoryType.ERROR]).toBe(1);
      expect(stats.totalConversations).toBe(1);
      expect(stats.totalTasks).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('should remove old low-importance memories', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Old fact', {
        importance: MemoryImportance.LOW,
      });
      // Manually set old date
      entry.lastAccessedAt = new Date('2020-01-01');

      const removed = manager.cleanup(1);
      expect(removed).toBeGreaterThanOrEqual(1);
    });

    it('should not remove high-importance memories', () => {
      const entry = manager.addMemory(MemoryType.FACT, 'Important', {
        importance: MemoryImportance.HIGH,
      });
      entry.lastAccessedAt = new Date('2020-01-01');

      manager.cleanup(1);
      expect(manager.getMemory(entry.id)).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should clear everything', () => {
      manager.addMemory(MemoryType.FACT, 'Fact');
      manager.conversations.createConversation('Chat');
      manager.tasks.createTask('Task');

      manager.clearAll();

      const stats = manager.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalConversations).toBe(0);
      expect(stats.totalTasks).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should save and load memories', () => {
      const persistManager = new MemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      persistManager.addMemory(MemoryType.FACT, 'Persisted fact', {
        tags: ['test'],
      });
      persistManager.save();
      persistManager.stop();

      // Create new manager and load
      const newManager = new MemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      const results = newManager.searchMemories({ tags: ['test'] });
      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Persisted fact');

      newManager.stop();
    });
  });
});

describe('createMemoryManager', () => {
  it('should create manager with factory function', () => {
    const manager = createMemoryManager({ persistEnabled: false });
    expect(manager).toBeInstanceOf(MemoryManager);
    manager.stop();
  });
});
