/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Subtask, TaskDecomposition, DependencyGraph } from './types.js';
import { SubtaskStatus } from './types.js';
import { DependencyGraphBuilder } from './dependencyGraph.js';

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** Ordered list of subtask IDs */
  order: string[];
  /** Parallel execution groups */
  parallelGroups: string[][];
  /** Has unresolvable dependencies */
  hasUnresolvable: boolean;
  /** Unresolvable subtask IDs */
  unresolvableSubtasks: string[];
  /** Circular dependency cycles */
  cycles: string[][];
  /** Critical path subtask IDs */
  criticalPath: string[];
}

/**
 * Execution state
 */
export interface ExecutionState {
  /** Completed subtask IDs */
  completed: Set<string>;
  /** Failed subtask IDs */
  failed: Set<string>;
  /** In-progress subtask IDs */
  inProgress: Set<string>;
  /** Skipped subtask IDs (due to failed dependencies) */
  skipped: Set<string>;
  /** Blocked subtask IDs (waiting for dependencies) */
  blocked: Set<string>;
}

/**
 * Dependency failure handling mode
 */
export enum FailureMode {
  /** Skip all dependents when dependency fails */
  SKIP_DEPENDENTS = 'skip_dependents',
  /** Abort entire execution */
  ABORT = 'abort',
  /** Continue with other branches */
  CONTINUE = 'continue',
}

/**
 * Dependency Resolver
 *
 * Resolves execution order from task dependencies, handles failures,
 * and identifies parallelizable work.
 */
export class DependencyResolver {
  private graphBuilder: DependencyGraphBuilder;
  private failureMode: FailureMode;

  constructor(failureMode: FailureMode = FailureMode.SKIP_DEPENDENTS) {
    this.graphBuilder = new DependencyGraphBuilder();
    this.failureMode = failureMode;
  }

  /**
   * Resolve execution order for a decomposition
   */
  resolve(decomposition: TaskDecomposition): ResolutionResult {
    const graph = this.graphBuilder.build(decomposition.subtasks);
    return this.resolveFromGraph(graph, decomposition.subtasks);
  }

  /**
   * Resolve from a pre-built graph
   */
  resolveFromGraph(graph: DependencyGraph, subtasks: Subtask[]): ResolutionResult {
    const criticalPath = this.findCriticalPath(graph, subtasks);

    if (graph.hasCycles) {
      return {
        order: [],
        parallelGroups: [],
        hasUnresolvable: true,
        unresolvableSubtasks: graph.cycles.flat(),
        cycles: graph.cycles,
        criticalPath: [],
      };
    }

    // Topological sort
    const order = this.graphBuilder.topologicalSort(graph);

    // Find unresolvable (missing dependencies)
    const validIds = new Set(subtasks.map((s) => s.id));
    const unresolvable: string[] = [];

    for (const subtask of subtasks) {
      for (const depId of subtask.dependencies) {
        if (!validIds.has(depId)) {
          unresolvable.push(subtask.id);
          break;
        }
      }
    }

    return {
      order,
      parallelGroups: graph.levels,
      hasUnresolvable: unresolvable.length > 0,
      unresolvableSubtasks: unresolvable,
      cycles: [],
      criticalPath,
    };
  }

  /**
   * Get next executable subtasks given current state
   */
  getNextExecutable(
    decomposition: TaskDecomposition,
    state: ExecutionState,
  ): string[] {
    const graph = this.graphBuilder.build(decomposition.subtasks);
    return this.graphBuilder.getParallelExecutable(
      graph,
      state.completed,
      state.inProgress,
    ).filter((id) => !state.failed.has(id) && !state.skipped.has(id));
  }

  /**
   * Handle a failed subtask
   */
  handleFailure(
    decomposition: TaskDecomposition,
    failedSubtaskId: string,
    state: ExecutionState,
  ): {
    skipped: string[];
    canContinue: boolean;
  } {
    const graph = this.graphBuilder.build(decomposition.subtasks);

    // Move from inProgress to failed
    state.inProgress.delete(failedSubtaskId);
    state.failed.add(failedSubtaskId);

    switch (this.failureMode) {
      case FailureMode.ABORT:
        return {
          skipped: [],
          canContinue: false,
        };

      case FailureMode.SKIP_DEPENDENTS: {
        // Skip all dependents
        const dependents = this.graphBuilder.getAllDependents(graph, failedSubtaskId);
        for (const depId of dependents) {
          state.skipped.add(depId);
        }
        return {
          skipped: dependents,
          canContinue: true,
        };
      }

      case FailureMode.CONTINUE:
        return {
          skipped: [],
          canContinue: true,
        };

      default:
        return {
          skipped: [],
          canContinue: true,
        };
    }
  }

  /**
   * Handle a completed subtask
   */
  handleCompletion(
    decomposition: TaskDecomposition,
    completedSubtaskId: string,
    state: ExecutionState,
  ): string[] {
    // Move from inProgress to completed
    state.inProgress.delete(completedSubtaskId);
    state.completed.add(completedSubtaskId);

    // Return newly unblocked subtasks
    return this.getNextExecutable(decomposition, state);
  }

  /**
   * Check if all work is complete
   */
  isComplete(decomposition: TaskDecomposition, state: ExecutionState): boolean {
    const totalSubtasks = decomposition.subtasks.length;
    const processedCount =
      state.completed.size + state.failed.size + state.skipped.size;
    return processedCount >= totalSubtasks && state.inProgress.size === 0;
  }

  /**
   * Create initial execution state from a decomposition
   */
  createInitialState(decomposition: TaskDecomposition): ExecutionState {
    const state: ExecutionState = {
      completed: new Set(),
      failed: new Set(),
      inProgress: new Set(),
      skipped: new Set(),
      blocked: new Set(),
    };

    // Check current subtask statuses
    for (const subtask of decomposition.subtasks) {
      switch (subtask.status) {
        case SubtaskStatus.COMPLETED:
          state.completed.add(subtask.id);
          break;
        case SubtaskStatus.FAILED:
          state.failed.add(subtask.id);
          break;
        case SubtaskStatus.IN_PROGRESS:
          state.inProgress.add(subtask.id);
          break;
        case SubtaskStatus.SKIPPED:
          state.skipped.add(subtask.id);
          break;
        case SubtaskStatus.BLOCKED:
          state.blocked.add(subtask.id);
          break;
        default:
          // PENDING - will be handled by getNextExecutable
          break;
      }
    }

    return state;
  }

  /**
   * Find the critical path (longest path through the graph)
   */
  private findCriticalPath(graph: DependencyGraph, subtasks: Subtask[]): string[] {
    if (graph.hasCycles || graph.nodes.length === 0) {
      return [];
    }

    const subtaskMap = new Map(subtasks.map((s) => [s.id, s]));

    // Calculate earliest finish time for each node
    const earliestFinish = new Map<string, number>();
    const predecessor = new Map<string, string | null>();

    // Process in topological order
    for (const level of graph.levels) {
      for (const nodeId of level) {
        const subtask = subtaskMap.get(nodeId);
        const duration = subtask?.effort?.minutes ?? 30;

        const deps = graph.reverseAdjacencyList.get(nodeId) ?? [];
        if (deps.length === 0) {
          // No dependencies - starts at 0
          earliestFinish.set(nodeId, duration);
          predecessor.set(nodeId, null);
        } else {
          // Find max finish time of dependencies
          let maxFinish = 0;
          let maxPred: string | null = null;

          for (const dep of deps) {
            const depFinish = earliestFinish.get(dep) ?? 0;
            if (depFinish > maxFinish) {
              maxFinish = depFinish;
              maxPred = dep;
            }
          }

          earliestFinish.set(nodeId, maxFinish + duration);
          predecessor.set(nodeId, maxPred);
        }
      }
    }

    // Find node with maximum finish time (end of critical path)
    let maxNode: string | null = null;
    let maxTime = 0;

    for (const [nodeId, time] of earliestFinish) {
      if (time > maxTime) {
        maxTime = time;
        maxNode = nodeId;
      }
    }

    if (!maxNode) return [];

    // Trace back to find critical path
    const criticalPath: string[] = [];
    let current: string | null = maxNode;

    while (current !== null) {
      criticalPath.unshift(current);
      current = predecessor.get(current) ?? null;
    }

    return criticalPath;
  }

  /**
   * Get statistics about the resolution
   */
  getStatistics(
    resolution: ResolutionResult,
    subtasks: Subtask[],
  ): {
    totalSubtasks: number;
    parallelLevels: number;
    maxParallelism: number;
    criticalPathLength: number;
    estimatedDuration: number;
  } {
    const subtaskMap = new Map(subtasks.map((s) => [s.id, s]));

    // Calculate critical path duration
    let criticalPathDuration = 0;
    for (const nodeId of resolution.criticalPath) {
      const subtask = subtaskMap.get(nodeId);
      criticalPathDuration += subtask?.effort?.minutes ?? 30;
    }

    return {
      totalSubtasks: subtasks.length,
      parallelLevels: resolution.parallelGroups.length,
      maxParallelism: Math.max(...resolution.parallelGroups.map((g) => g.length), 0),
      criticalPathLength: resolution.criticalPath.length,
      estimatedDuration: criticalPathDuration,
    };
  }
}

/**
 * Create a dependency resolver
 */
export function createDependencyResolver(
  failureMode?: FailureMode,
): DependencyResolver {
  return new DependencyResolver(failureMode);
}
