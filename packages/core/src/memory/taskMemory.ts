/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  TaskMemory,
  MemoryConfig,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';

/**
 * Task Memory Manager
 *
 * Manages task history with persistence and search capabilities.
 */
export class TaskMemoryManager {
  private config: Required<MemoryConfig>;
  private tasks: Map<string, TaskMemory>;
  private activeTaskId: string | null;
  private autoSaveTimer: ReturnType<typeof setInterval> | null;

  constructor(config: MemoryConfig = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.tasks = new Map();
    this.activeTaskId = null;
    this.autoSaveTimer = null;

    if (this.config.persistEnabled) {
      this.load();
      this.startAutoSave();
    }
  }

  /**
   * Create a new task
   */
  createTask(description: string, conversationId?: string): TaskMemory {
    const id = this.generateId();
    const task: TaskMemory = {
      id,
      description,
      status: 'pending',
      conversationId,
      filesModified: [],
      commandsExecuted: [],
      errors: [],
      startedAt: new Date(),
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Get task by ID
   */
  getTask(id: string): TaskMemory | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get active task
   */
  getActiveTask(): TaskMemory | undefined {
    return this.activeTaskId ? this.tasks.get(this.activeTaskId) : undefined;
  }

  /**
   * Set active task
   */
  setActiveTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task) {
      this.activeTaskId = id;
      if (task.status === 'pending') {
        task.status = 'in_progress';
      }
      return true;
    }
    return false;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskMemory[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskMemory['status']): TaskMemory[] {
    return this.getAllTasks().filter(t => t.status === status);
  }

  /**
   * Get recent tasks
   */
  getRecentTasks(limit = 10): TaskMemory[] {
    return this.getAllTasks().slice(0, limit);
  }

  /**
   * Start a task
   */
  startTask(description: string, conversationId?: string): TaskMemory {
    const task = this.createTask(description, conversationId);
    task.status = 'in_progress';
    this.activeTaskId = task.id;
    return task;
  }

  /**
   * Record file modification
   */
  recordFileModified(filePath: string, taskId?: string): void {
    const id = taskId ?? this.activeTaskId;
    if (!id) return;

    const task = this.tasks.get(id);
    if (task && !task.filesModified.includes(filePath)) {
      task.filesModified.push(filePath);
    }
  }

  /**
   * Record command executed
   */
  recordCommand(command: string, taskId?: string): void {
    const id = taskId ?? this.activeTaskId;
    if (!id) return;

    const task = this.tasks.get(id);
    if (task) {
      task.commandsExecuted.push(command);
    }
  }

  /**
   * Record error
   */
  recordError(error: string, taskId?: string): void {
    const id = taskId ?? this.activeTaskId;
    if (!id) return;

    const task = this.tasks.get(id);
    if (task) {
      task.errors.push(error);
    }
  }

  /**
   * Complete task
   */
  completeTask(outcome?: string, taskId?: string): void {
    const id = taskId ?? this.activeTaskId;
    if (!id) return;

    const task = this.tasks.get(id);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      task.outcome = outcome;
    }

    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
  }

  /**
   * Fail task
   */
  failTask(reason: string, taskId?: string): void {
    const id = taskId ?? this.activeTaskId;
    if (!id) return;

    const task = this.tasks.get(id);
    if (task) {
      task.status = 'failed';
      task.completedAt = new Date();
      task.outcome = `Failed: ${reason}`;
      task.errors.push(reason);
    }

    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
  }

  /**
   * Search tasks
   */
  searchTasks(query: string): TaskMemory[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllTasks().filter(task => {
      if (task.description.toLowerCase().includes(lowerQuery)) return true;
      if (task.outcome?.toLowerCase().includes(lowerQuery)) return true;
      if (task.filesModified.some(f => f.toLowerCase().includes(lowerQuery))) return true;
      return task.commandsExecuted.some(c => c.toLowerCase().includes(lowerQuery));
    });
  }

  /**
   * Get tasks for conversation
   */
  getTasksForConversation(conversationId: string): TaskMemory[] {
    return this.getAllTasks().filter(t => t.conversationId === conversationId);
  }

  /**
   * Get tasks that modified a file
   */
  getTasksForFile(filePath: string): TaskMemory[] {
    return this.getAllTasks().filter(t => t.filesModified.includes(filePath));
  }

  /**
   * Delete task
   */
  deleteTask(id: string): boolean {
    if (this.activeTaskId === id) {
      this.activeTaskId = null;
    }
    return this.tasks.delete(id);
  }

  /**
   * Clear all tasks
   */
  clearAll(): void {
    this.tasks.clear();
    this.activeTaskId = null;
  }

  /**
   * Cleanup old tasks
   */
  cleanup(thresholdDays?: number): number {
    const days = thresholdDays ?? this.config.cleanupThresholdDays;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    let removed = 0;
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed') {
        const date = task.completedAt ?? task.startedAt;
        if (date < threshold) {
          this.tasks.delete(id);
          removed++;
        }
      }
    }

    return removed;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTasks: number;
    activeTask: string | null;
    byStatus: Record<string, number>;
    filesModified: number;
    commandsExecuted: number;
  } {
    const byStatus: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };

    let filesModified = 0;
    let commandsExecuted = 0;

    for (const task of this.tasks.values()) {
      byStatus[task.status]++;
      filesModified += task.filesModified.length;
      commandsExecuted += task.commandsExecuted.length;
    }

    return {
      totalTasks: this.tasks.size,
      activeTask: this.activeTaskId,
      byStatus,
      filesModified,
      commandsExecuted,
    };
  }

  /**
   * Save to disk
   */
  save(): void {
    if (!this.config.persistEnabled) return;

    const persistPath = this.config.persistPath;
    const filePath = path.join(persistPath, 'tasks.json');

    try {
      if (!fs.existsSync(persistPath)) {
        fs.mkdirSync(persistPath, { recursive: true });
      }

      const data = {
        activeTaskId: this.activeTaskId,
        tasks: Array.from(this.tasks.entries()).map(([_id, task]) => ({
          ...task,
          startedAt: task.startedAt.toISOString(),
          completedAt: task.completedAt?.toISOString(),
        })),
      };

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore save errors
    }
  }

  /**
   * Load from disk
   */
  load(): void {
    if (!this.config.persistEnabled) return;

    const filePath = path.join(this.config.persistPath, 'tasks.json');

    try {
      if (!fs.existsSync(filePath)) return;

      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      this.tasks.clear();
      this.activeTaskId = data.activeTaskId;

      for (const task of data.tasks) {
        const memoryTask: TaskMemory = {
          ...task,
          startedAt: new Date(task.startedAt),
          completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
        };
        this.tasks.set(task.id, memoryTask);
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
    this.save();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
 * Create a task memory manager
 */
export function createTaskMemoryManager(config?: MemoryConfig): TaskMemoryManager {
  return new TaskMemoryManager(config);
}
