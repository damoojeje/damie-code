/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Subtask, TaskDecomposition, SubtaskResult } from './types.js';
import type { ExecutionState } from './dependencyResolver.js';
import { DependencyResolver, FailureMode } from './dependencyResolver.js';

/**
 * Subtask executor function type
 */
export type SubtaskExecutor = (subtask: Subtask) => Promise<SubtaskResult>;

/**
 * Execution progress callback
 */
export type PlannerProgressCallback = (progress: ExecutionProgress) => void;

/**
 * Execution progress
 */
export interface ExecutionProgress {
  /** Total subtasks */
  total: number;
  /** Completed subtasks */
  completed: number;
  /** Failed subtasks */
  failed: number;
  /** In-progress subtasks */
  inProgress: number;
  /** Skipped subtasks */
  skipped: number;
  /** Currently executing subtask titles */
  currentTasks: string[];
  /** Progress percentage (0-100) */
  percentage: number;
  /** Elapsed time in ms */
  elapsed: number;
}

/**
 * Execution result
 */
export interface ParallelExecutionResult {
  /** Overall success */
  success: boolean;
  /** Completed subtask IDs */
  completed: string[];
  /** Failed subtask IDs */
  failed: string[];
  /** Skipped subtask IDs */
  skipped: string[];
  /** Total duration in ms */
  duration: number;
  /** Results per subtask */
  results: Map<string, SubtaskResult>;
}

/**
 * Parallel executor configuration
 */
export interface ParallelExecutorConfig {
  /** Maximum concurrent executions */
  maxConcurrency: number;
  /** Failure handling mode */
  failureMode: FailureMode;
  /** Continue on failure */
  continueOnFailure: boolean;
  /** Timeout per subtask in ms (0 = no timeout) */
  subtaskTimeout: number;
}

/**
 * Default executor configuration
 */
export const DEFAULT_EXECUTOR_CONFIG: ParallelExecutorConfig = {
  maxConcurrency: 3,
  failureMode: FailureMode.SKIP_DEPENDENTS,
  continueOnFailure: true,
  subtaskTimeout: 300000, // 5 minutes
};

/**
 * Parallel Executor
 *
 * Executes subtasks in parallel while respecting dependencies.
 */
export class ParallelExecutor {
  private config: ParallelExecutorConfig;
  private resolver: DependencyResolver;
  private progressCallbacks: PlannerProgressCallback[] = [];
  private startTime: number = 0;

  constructor(config: Partial<ParallelExecutorConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTOR_CONFIG, ...config };
    this.resolver = new DependencyResolver(this.config.failureMode);
  }

  /**
   * Execute a decomposition with parallel execution
   */
  async execute(
    decomposition: TaskDecomposition,
    executor: SubtaskExecutor,
  ): Promise<ParallelExecutionResult> {
    this.startTime = Date.now();
    const state = this.resolver.createInitialState(decomposition);
    const results = new Map<string, SubtaskResult>();
    const subtaskMap = new Map(decomposition.subtasks.map((s) => [s.id, s]));

    // Check for cycles
    const resolution = this.resolver.resolve(decomposition);
    if (resolution.hasUnresolvable && resolution.cycles.length > 0) {
      throw new Error(
        `Cannot execute: circular dependencies detected: ${resolution.cycles[0].join(' -> ')}`,
      );
    }

    // Flag to track if we should abort
    let shouldAbort = false;

    // Main execution loop
    while (!this.resolver.isComplete(decomposition, state) && !shouldAbort) {
      // Get next batch of executable subtasks
      const executable = this.resolver.getNextExecutable(decomposition, state);

      if (executable.length === 0 && state.inProgress.size === 0) {
        // No progress possible
        break;
      }

      // Limit concurrency
      const batch = executable.slice(0, this.config.maxConcurrency - state.inProgress.size);

      // Execute batch in parallel
      const executions = batch.map(async (subtaskId) => {
        const subtask = subtaskMap.get(subtaskId)!;
        state.inProgress.add(subtaskId);
        this.reportProgress(decomposition, state, subtaskMap);

        try {
          const result = await this.executeWithTimeout(subtask, executor);
          results.set(subtaskId, result);

          if (result.success) {
            this.resolver.handleCompletion(decomposition, subtaskId, state);
          } else {
            const failure = this.resolver.handleFailure(decomposition, subtaskId, state);
            for (const skippedId of failure.skipped) {
              results.set(skippedId, {
                success: false,
                error: `Skipped due to failed dependency: ${subtask.title}`,
                filesAffected: [],
                duration: 0,
                retries: 0,
              });
            }

            if (!failure.canContinue && !this.config.continueOnFailure) {
              // Mark remaining as skipped
              for (const s of decomposition.subtasks) {
                if (
                  !state.completed.has(s.id) &&
                  !state.failed.has(s.id) &&
                  !state.skipped.has(s.id)
                ) {
                  state.skipped.add(s.id);
                }
              }
              shouldAbort = true;
            }
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          results.set(subtaskId, {
            success: false,
            error: err.message,
            filesAffected: [],
            duration: 0,
            retries: 0,
          });
          this.resolver.handleFailure(decomposition, subtaskId, state);
        }

        this.reportProgress(decomposition, state, subtaskMap);
      });

      // Wait for batch to complete
      await Promise.all(executions);
    }

    return {
      success: state.failed.size === 0,
      completed: Array.from(state.completed),
      failed: Array.from(state.failed),
      skipped: Array.from(state.skipped),
      duration: Date.now() - this.startTime,
      results,
    };
  }

  /**
   * Execute a single subtask with optional timeout
   */
  private async executeWithTimeout(
    subtask: Subtask,
    executor: SubtaskExecutor,
  ): Promise<SubtaskResult> {
    if (this.config.subtaskTimeout <= 0) {
      return executor(subtask);
    }

    return Promise.race([
      executor(subtask),
      new Promise<SubtaskResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Subtask "${subtask.title}" timed out after ${this.config.subtaskTimeout}ms`));
        }, this.config.subtaskTimeout);
      }),
    ]);
  }

  /**
   * Register progress callback
   */
  onProgress(callback: PlannerProgressCallback): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index !== -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Report progress
   */
  private reportProgress(
    decomposition: TaskDecomposition,
    state: ExecutionState,
    subtaskMap: Map<string, Subtask>,
  ): void {
    const total = decomposition.subtasks.length;
    const completed = state.completed.size;
    const failed = state.failed.size;
    const skipped = state.skipped.size;
    const inProgress = state.inProgress.size;

    const currentTasks: string[] = [];
    for (const id of state.inProgress) {
      const subtask = subtaskMap.get(id);
      if (subtask) {
        currentTasks.push(subtask.title);
      }
    }

    const progress: ExecutionProgress = {
      total,
      completed,
      failed,
      inProgress,
      skipped,
      currentTasks,
      percentage: total > 0 ? Math.round(((completed + failed + skipped) / total) * 100) : 0,
      elapsed: Date.now() - this.startTime,
    };

    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Execute a single subtask (for simple use cases)
   */
  async executeOne(
    decomposition: TaskDecomposition,
    subtaskId: string,
    executor: SubtaskExecutor,
  ): Promise<SubtaskResult> {
    const subtask = decomposition.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    // Check dependencies
    const state = this.resolver.createInitialState(decomposition);
    const depsComplete = subtask.dependencies.every((d) => state.completed.has(d));

    if (!depsComplete) {
      return {
        success: false,
        error: 'Dependencies not complete',
        filesAffected: [],
        duration: 0,
        retries: 0,
      };
    }

    return executor(subtask);
  }

  /**
   * Get current resolver
   */
  getResolver(): DependencyResolver {
    return this.resolver;
  }
}

/**
 * Create a parallel executor
 */
export function createParallelExecutor(
  config?: Partial<ParallelExecutorConfig>,
): ParallelExecutor {
  return new ParallelExecutor(config);
}
