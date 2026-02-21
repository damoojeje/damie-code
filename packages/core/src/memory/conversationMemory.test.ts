/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  ConversationMemoryManager,
  createConversationMemoryManager,
} from './conversationMemory.js';

describe('ConversationMemoryManager', () => {
  let manager: ConversationMemoryManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-memory-test-'));
    manager = new ConversationMemoryManager({
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

  describe('createConversation', () => {
    it('should create a new conversation', () => {
      const conv = manager.createConversation('Test Chat');

      expect(conv.id).toBeDefined();
      expect(conv.title).toBe('Test Chat');
      expect(conv.messages).toHaveLength(0);
      expect(conv.isActive).toBe(true);
    });

    it('should auto-generate title when not provided', () => {
      const conv = manager.createConversation();

      expect(conv.title).toContain('Conversation');
    });

    it('should set as active conversation', () => {
      const conv = manager.createConversation('Active');
      const active = manager.getOrCreateActive();

      expect(active.id).toBe(conv.id);
    });
  });

  describe('addMessage', () => {
    it('should add user message', () => {
      manager.createConversation();
      manager.addUserMessage('Hello');

      const conv = manager.getOrCreateActive();
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0].role).toBe('user');
      expect(conv.messages[0].content).toBe('Hello');
    });

    it('should add assistant message', () => {
      manager.createConversation();
      manager.addAssistantMessage('Hi there!');

      const conv = manager.getOrCreateActive();
      expect(conv.messages).toHaveLength(1);
      expect(conv.messages[0].role).toBe('assistant');
    });

    it('should add system message', () => {
      manager.createConversation();
      manager.addSystemMessage('System initialized');

      const conv = manager.getOrCreateActive();
      expect(conv.messages[0].role).toBe('system');
    });

    it('should add message with tool calls', () => {
      manager.createConversation();
      manager.addAssistantMessage('Running command', [
        { name: 'shell', arguments: { cmd: 'ls' }, result: 'file1.txt' },
      ]);

      const conv = manager.getOrCreateActive();
      expect(conv.messages[0].toolCalls).toHaveLength(1);
    });

    it('should update lastUpdatedAt', () => {
      const conv = manager.createConversation();
      const originalTime = conv.lastUpdatedAt;

      // Wait a bit
      const waitTime = new Promise(resolve => setTimeout(resolve, 10));
      return waitTime.then(() => {
        manager.addUserMessage('Test');
        expect(conv.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(
          originalTime.getTime()
        );
      });
    });

    it('should create conversation if none active', () => {
      manager.addUserMessage('Auto-created');

      const conv = manager.getOrCreateActive();
      expect(conv.messages).toHaveLength(1);
    });
  });

  describe('recordFileReference', () => {
    it('should record file references', () => {
      manager.createConversation();
      manager.recordFileReference('/path/to/file.ts');

      const conv = manager.getOrCreateActive();
      expect(conv.filesReferenced).toContain('/path/to/file.ts');
    });

    it('should not duplicate file references', () => {
      manager.createConversation();
      manager.recordFileReference('/path/to/file.ts');
      manager.recordFileReference('/path/to/file.ts');

      const conv = manager.getOrCreateActive();
      expect(conv.filesReferenced).toHaveLength(1);
    });
  });

  describe('endConversation', () => {
    it('should mark conversation as inactive', () => {
      const conv = manager.createConversation();
      manager.addUserMessage('Test');
      manager.endConversation();

      expect(conv.isActive).toBe(false);
    });

    it('should generate summary', () => {
      const conv = manager.createConversation();
      manager.addUserMessage('Help me fix a bug in my code');
      manager.endConversation();

      expect(conv.summary).toBeDefined();
    });
  });

  describe('getAllConversations', () => {
    it('should return all conversations', () => {
      manager.createConversation('First');
      manager.createConversation('Second');
      manager.createConversation('Third');

      const all = manager.getAllConversations();
      expect(all).toHaveLength(3);
      // All three should be present
      const titles = all.map(c => c.title);
      expect(titles).toContain('First');
      expect(titles).toContain('Second');
      expect(titles).toContain('Third');
    });
  });

  describe('getRecentConversations', () => {
    it('should return limited recent conversations', () => {
      for (let i = 0; i < 5; i++) {
        manager.createConversation(`Conv ${i}`);
      }

      const recent = manager.getRecentConversations(3);
      expect(recent).toHaveLength(3);
    });
  });

  describe('searchConversations', () => {
    it('should search by title', () => {
      manager.createConversation('Bug fix discussion');
      manager.createConversation('Feature request');

      const results = manager.searchConversations('bug');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Bug');
    });

    it('should search by message content', () => {
      manager.createConversation('Chat');
      manager.addUserMessage('How do I deploy to production?');

      const results = manager.searchConversations('deploy');
      expect(results).toHaveLength(1);
    });

    it('should search by topics', () => {
      manager.createConversation('Chat');
      manager.addUserMessage('Can you help me refactor this code?');

      const results = manager.searchConversations('refactor');
      expect(results).toHaveLength(1);
    });
  });

  describe('getConversationContext', () => {
    it('should return recent messages', () => {
      manager.createConversation();
      for (let i = 0; i < 30; i++) {
        manager.addUserMessage(`Message ${i}`);
      }

      const context = manager.getConversationContext(10);
      expect(context.length).toBeLessThanOrEqual(10);
    });

    it('should return empty if no active conversation', () => {
      const context = manager.getConversationContext();
      expect(context).toHaveLength(0);
    });
  });

  describe('deleteConversation', () => {
    it('should delete a conversation', () => {
      const conv = manager.createConversation('To Delete');

      expect(manager.deleteConversation(conv.id)).toBe(true);
      expect(manager.getConversation(conv.id)).toBeUndefined();
    });

    it('should return false for non-existent conversation', () => {
      expect(manager.deleteConversation('nonexistent')).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all conversations', () => {
      manager.createConversation('One');
      manager.createConversation('Two');
      manager.clearAll();

      expect(manager.getAllConversations()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      manager.createConversation();
      manager.addUserMessage('Test');
      manager.recordFileReference('/file.ts');

      const stats = manager.getStats();

      expect(stats.totalConversations).toBe(1);
      expect(stats.totalMessages).toBe(1);
      expect(stats.filesReferenced).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should save and load conversations', () => {
      const persistManager = new ConversationMemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      persistManager.createConversation('Persist Test');
      persistManager.addUserMessage('Hello world');
      persistManager.save();
      persistManager.stop();

      // Create new manager and load
      const newManager = new ConversationMemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      const loadedConvs = newManager.getAllConversations();
      expect(loadedConvs).toHaveLength(1);
      expect(loadedConvs[0].title).toBe('Persist Test');
      expect(loadedConvs[0].messages).toHaveLength(1);

      newManager.stop();
    });
  });
});

describe('createConversationMemoryManager', () => {
  it('should create manager with factory function', () => {
    const manager = createConversationMemoryManager({ persistEnabled: false });
    expect(manager).toBeInstanceOf(ConversationMemoryManager);
    manager.stop();
  });
});
