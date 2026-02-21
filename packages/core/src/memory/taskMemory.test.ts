/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TaskMemoryManager, createTaskMemoryManager } from './taskMemory.js';

describe('TaskMemoryManager', () => {
  let manager: TaskMemoryManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-memory-test-'));
    manager = new TaskMemoryManager({
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

  describe('createTask', () => {
    it('should create a new task', () => {
      const task = manager.createTask('Fix bug in login');

      expect(task.id).toBeDefined();
      expect(task.description).toBe('Fix bug in login');
      expect(task.status).toBe('pending');
    });

    it('should associate with conversation', () => {
      const task = manager.createTask('Task', 'conv123');

      expect(task.conversationId).toBe('conv123');
    });
  });

  describe('startTask', () => {
    it('should create and start a task', () => {
      const task = manager.startTask('Implement feature');

      expect(task.status).toBe('in_progress');
      expect(manager.getActiveTask()).toBe(task);
    });
  });

  describe('setActiveTask', () => {
    it('should set active task', () => {
      const task = manager.createTask('Task 1');

      expect(manager.setActiveTask(task.id)).toBe(true);
      expect(manager.getActiveTask()).toBe(task);
    });

    it('should return false for non-existent task', () => {
      expect(manager.setActiveTask('nonexistent')).toBe(false);
    });

    it('should change status to in_progress', () => {
      const task = manager.createTask('Task');

      manager.setActiveTask(task.id);
      expect(task.status).toBe('in_progress');
    });
  });

  describe('recordFileModified', () => {
    it('should record file modification', () => {
      manager.startTask('Edit files');
      manager.recordFileModified('/src/app.ts');

      const task = manager.getActiveTask();
      expect(task?.filesModified).toContain('/src/app.ts');
    });

    it('should not duplicate files', () => {
      manager.startTask('Edit');
      manager.recordFileModified('/file.ts');
      manager.recordFileModified('/file.ts');

      const task = manager.getActiveTask();
      expect(task?.filesModified).toHaveLength(1);
    });
  });

  describe('recordCommand', () => {
    it('should record executed command', () => {
      manager.startTask('Run commands');
      manager.recordCommand('npm test');
      manager.recordCommand('npm build');

      const task = manager.getActiveTask();
      expect(task?.commandsExecuted).toHaveLength(2);
    });
  });

  describe('recordError', () => {
    it('should record errors', () => {
      manager.startTask('Buggy task');
      manager.recordError('Module not found');

      const task = manager.getActiveTask();
      expect(task?.errors).toContain('Module not found');
    });
  });

  describe('completeTask', () => {
    it('should mark task as completed', () => {
      const task = manager.startTask('To complete');
      manager.completeTask('Successfully done');

      expect(task.status).toBe('completed');
      expect(task.completedAt).toBeDefined();
      expect(task.outcome).toBe('Successfully done');
    });

    it('should clear active task', () => {
      manager.startTask('Task');
      manager.completeTask();

      expect(manager.getActiveTask()).toBeUndefined();
    });
  });

  describe('failTask', () => {
    it('should mark task as failed', () => {
      const task = manager.startTask('To fail');
      manager.failTask('Out of memory');

      expect(task.status).toBe('failed');
      expect(task.errors).toContain('Out of memory');
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', () => {
      manager.createTask('First');
      manager.createTask('Second');
      manager.createTask('Third');

      const all = manager.getAllTasks();
      expect(all).toHaveLength(3);
      // All three should be present
      const descriptions = all.map(t => t.description);
      expect(descriptions).toContain('First');
      expect(descriptions).toContain('Second');
      expect(descriptions).toContain('Third');
    });
  });

  describe('getTasksByStatus', () => {
    it('should filter by status', () => {
      manager.createTask('Pending 1');
      manager.createTask('Pending 2');
      manager.startTask('In Progress');

      const pending = manager.getTasksByStatus('pending');
      expect(pending).toHaveLength(2);

      const inProgress = manager.getTasksByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
    });
  });

  describe('searchTasks', () => {
    it('should search by description', () => {
      manager.createTask('Fix authentication bug');
      manager.createTask('Add new feature');

      const results = manager.searchTasks('auth');
      expect(results).toHaveLength(1);
    });

    it('should search by files modified', () => {
      manager.startTask('Edit files');
      manager.recordFileModified('/src/auth/login.ts');
      manager.completeTask();

      const results = manager.searchTasks('login.ts');
      expect(results).toHaveLength(1);
    });

    it('should search by commands', () => {
      manager.startTask('Run tests');
      manager.recordCommand('npm run test:coverage');
      manager.completeTask();

      const results = manager.searchTasks('coverage');
      expect(results).toHaveLength(1);
    });
  });

  describe('getTasksForConversation', () => {
    it('should filter by conversation ID', () => {
      manager.createTask('Task 1', 'conv1');
      manager.createTask('Task 2', 'conv1');
      manager.createTask('Task 3', 'conv2');

      const tasks = manager.getTasksForConversation('conv1');
      expect(tasks).toHaveLength(2);
    });
  });

  describe('getTasksForFile', () => {
    it('should find tasks that modified a file', () => {
      const task1 = manager.startTask('Edit 1');
      manager.recordFileModified('/shared/utils.ts');
      manager.completeTask();

      manager.startTask('Edit 2');
      manager.recordFileModified('/other/file.ts');
      manager.completeTask();

      const tasks = manager.getTasksForFile('/shared/utils.ts');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task1.id);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const task = manager.createTask('To delete');

      expect(manager.deleteTask(task.id)).toBe(true);
      expect(manager.getTask(task.id)).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove old completed tasks', () => {
      const task = manager.createTask('Old task');
      task.status = 'completed';
      task.completedAt = new Date('2020-01-01');

      const removed = manager.cleanup(1);
      expect(removed).toBe(1);
      expect(manager.getTask(task.id)).toBeUndefined();
    });

    it('should not remove recent tasks', () => {
      manager.startTask('Recent');
      manager.completeTask();

      const removedCount = manager.cleanup(30);
      expect(removedCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      manager.createTask('Pending');
      manager.startTask('In Progress');
      manager.recordFileModified('/file.ts');
      manager.recordCommand('npm test');

      const stats = manager.getStats();

      expect(stats.totalTasks).toBe(2);
      expect(stats.byStatus['pending']).toBe(1);
      expect(stats.byStatus['in_progress']).toBe(1);
      expect(stats.filesModified).toBe(1);
      expect(stats.commandsExecuted).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should save and load tasks', () => {
      const persistManager = new TaskMemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      persistManager.startTask('Persist Test');
      persistManager.recordFileModified('/test.ts');
      persistManager.save();
      persistManager.stop();

      // Create new manager and load
      const newManager = new TaskMemoryManager({
        persistEnabled: true,
        persistPath: tempDir,
        autoSaveInterval: 1000000,
      });

      const tasks = newManager.getAllTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].description).toBe('Persist Test');
      expect(tasks[0].filesModified).toContain('/test.ts');

      newManager.stop();
    });
  });
});

describe('createTaskMemoryManager', () => {
  it('should create manager with factory function', () => {
    const manager = createTaskMemoryManager({ persistEnabled: false });
    expect(manager).toBeInstanceOf(TaskMemoryManager);
    manager.stop();
  });
});
