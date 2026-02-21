/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DependencyResolver,
  createDependencyResolver,
  FailureMode,
} from './dependencyResolver.js';
import { TaskPlanner } from './taskPlanner.js';
import { SubtaskType, SubtaskStatus } from './types.js';
import type { TaskDecomposition } from './types.js';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;
  let planner: TaskPlanner;

  beforeEach(() => {
    resolver = new DependencyResolver();
    planner = new TaskPlanner();
  });

  // Helper to create decomposition
  const createDecomposition = (
    templates: Array<{
      title: string;
      deps?: string[];
    }>,
  ): TaskDecomposition =>
    planner.createDecomposition(
      { task: 'Test task' },
      templates.map((t) => ({
        title: t.title,
        description: t.title,
        type: SubtaskType.CODE,
        dependencies: t.deps,
      })),
    );

  describe('constructor', () => {
    it('should create resolver with default failure mode', () => {
      expect(resolver).toBeInstanceOf(DependencyResolver);
    });

    it('should accept custom failure mode', () => {
      const abortResolver = new DependencyResolver(FailureMode.ABORT);
      expect(abortResolver).toBeInstanceOf(DependencyResolver);
    });
  });

  describe('resolve', () => {
    it('should resolve simple linear dependencies', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
        { title: 'Third', deps: ['Second'] },
      ]);

      const result = resolver.resolve(decomposition);

      expect(result.hasUnresolvable).toBe(false);
      expect(result.cycles).toHaveLength(0);
      expect(result.order).toHaveLength(3);
    });

    it('should identify parallel groups', () => {
      const decomposition = createDecomposition([
        { title: 'A1' },
        { title: 'A2' },
        { title: 'B', deps: ['A1', 'A2'] },
      ]);

      const result = resolver.resolve(decomposition);

      expect(result.parallelGroups).toHaveLength(2);
      expect(result.parallelGroups[0]).toHaveLength(2);
      expect(result.parallelGroups[1]).toHaveLength(1);
    });

    it('should detect circular dependencies', () => {
      const decomposition = createDecomposition([
        { title: 'A' },
        { title: 'B' },
      ]);

      // Manually create circular dependency
      decomposition.subtasks[0].dependencies = [decomposition.subtasks[1].id];
      decomposition.subtasks[1].dependencies = [decomposition.subtasks[0].id];

      const result = resolver.resolve(decomposition);

      expect(result.hasUnresolvable).toBe(true);
      expect(result.cycles.length).toBeGreaterThan(0);
    });

    it('should find critical path', () => {
      const decomposition = createDecomposition([
        { title: 'Start' },
        { title: 'Short Path', deps: ['Start'] },
        { title: 'Long Path 1', deps: ['Start'] },
        { title: 'Long Path 2', deps: ['Long Path 1'] },
        { title: 'End', deps: ['Short Path', 'Long Path 2'] },
      ]);

      const result = resolver.resolve(decomposition);

      expect(result.criticalPath.length).toBeGreaterThan(0);
    });
  });

  describe('getNextExecutable', () => {
    it('should return root subtasks initially', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
      ]);

      const state = resolver.createInitialState(decomposition);
      const executable = resolver.getNextExecutable(decomposition, state);

      expect(executable).toHaveLength(1);
      expect(decomposition.subtasks.find((s) => s.id === executable[0])?.title).toBe(
        'First',
      );
    });

    it('should return next level after completion', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
      ]);

      const state = resolver.createInitialState(decomposition);
      const firstId = decomposition.subtasks.find((s) => s.title === 'First')!.id;

      state.completed.add(firstId);
      const executable = resolver.getNextExecutable(decomposition, state);

      expect(executable).toHaveLength(1);
      expect(decomposition.subtasks.find((s) => s.id === executable[0])?.title).toBe(
        'Second',
      );
    });

    it('should exclude in-progress subtasks', () => {
      const decomposition = createDecomposition([{ title: 'A' }, { title: 'B' }]);

      const state = resolver.createInitialState(decomposition);
      state.inProgress.add(decomposition.subtasks[0].id);

      const executable = resolver.getNextExecutable(decomposition, state);

      expect(executable).not.toContain(decomposition.subtasks[0].id);
    });
  });

  describe('handleFailure', () => {
    it('should skip dependents in SKIP_DEPENDENTS mode', () => {
      const skipResolver = new DependencyResolver(FailureMode.SKIP_DEPENDENTS);
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
        { title: 'Third', deps: ['Second'] },
      ]);

      const state = skipResolver.createInitialState(decomposition);
      const firstId = decomposition.subtasks.find((s) => s.title === 'First')!.id;
      state.inProgress.add(firstId);

      const result = skipResolver.handleFailure(decomposition, firstId, state);

      expect(result.canContinue).toBe(true);
      expect(result.skipped.length).toBe(2); // Second and Third
    });

    it('should not continue in ABORT mode', () => {
      const abortResolver = new DependencyResolver(FailureMode.ABORT);
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
      ]);

      const state = abortResolver.createInitialState(decomposition);
      const firstId = decomposition.subtasks[0].id;
      state.inProgress.add(firstId);

      const result = abortResolver.handleFailure(decomposition, firstId, state);

      expect(result.canContinue).toBe(false);
    });

    it('should continue without skipping in CONTINUE mode', () => {
      const continueResolver = new DependencyResolver(FailureMode.CONTINUE);
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
      ]);

      const state = continueResolver.createInitialState(decomposition);
      const firstId = decomposition.subtasks[0].id;
      state.inProgress.add(firstId);

      const result = continueResolver.handleFailure(decomposition, firstId, state);

      expect(result.canContinue).toBe(true);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('handleCompletion', () => {
    it('should move subtask to completed and return newly executable', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second', deps: ['First'] },
      ]);

      const state = resolver.createInitialState(decomposition);
      const firstId = decomposition.subtasks.find((s) => s.title === 'First')!.id;
      state.inProgress.add(firstId);

      const newExecutable = resolver.handleCompletion(decomposition, firstId, state);

      expect(state.completed.has(firstId)).toBe(true);
      expect(state.inProgress.has(firstId)).toBe(false);
      expect(newExecutable.length).toBe(1);
    });
  });

  describe('isComplete', () => {
    it('should return true when all subtasks are processed', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second' },
      ]);

      const state = resolver.createInitialState(decomposition);
      state.completed.add(decomposition.subtasks[0].id);
      state.completed.add(decomposition.subtasks[1].id);

      expect(resolver.isComplete(decomposition, state)).toBe(true);
    });

    it('should return false when work is in progress', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second' },
      ]);

      const state = resolver.createInitialState(decomposition);
      state.completed.add(decomposition.subtasks[0].id);
      state.inProgress.add(decomposition.subtasks[1].id);

      expect(resolver.isComplete(decomposition, state)).toBe(false);
    });

    it('should count failed and skipped as processed', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second' },
      ]);

      const state = resolver.createInitialState(decomposition);
      state.failed.add(decomposition.subtasks[0].id);
      state.skipped.add(decomposition.subtasks[1].id);

      expect(resolver.isComplete(decomposition, state)).toBe(true);
    });
  });

  describe('createInitialState', () => {
    it('should create empty state for pending subtasks', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second' },
      ]);

      const state = resolver.createInitialState(decomposition);

      expect(state.completed.size).toBe(0);
      expect(state.failed.size).toBe(0);
      expect(state.inProgress.size).toBe(0);
      expect(state.skipped.size).toBe(0);
    });

    it('should respect existing subtask statuses', () => {
      const decomposition = createDecomposition([
        { title: 'First' },
        { title: 'Second' },
      ]);

      decomposition.subtasks[0].status = SubtaskStatus.COMPLETED;

      const state = resolver.createInitialState(decomposition);

      expect(state.completed.has(decomposition.subtasks[0].id)).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should calculate execution statistics', () => {
      const decomposition = createDecomposition([
        { title: 'A1' },
        { title: 'A2' },
        { title: 'B', deps: ['A1', 'A2'] },
        { title: 'C', deps: ['B'] },
      ]);

      const resolution = resolver.resolve(decomposition);
      const stats = resolver.getStatistics(resolution, decomposition.subtasks);

      expect(stats.totalSubtasks).toBe(4);
      expect(stats.parallelLevels).toBe(3);
      expect(stats.maxParallelism).toBe(2);
    });
  });
});

describe('createDependencyResolver', () => {
  it('should create resolver with factory function', () => {
    const resolver = createDependencyResolver();
    expect(resolver).toBeInstanceOf(DependencyResolver);
  });

  it('should accept failure mode', () => {
    const resolver = createDependencyResolver(FailureMode.ABORT);
    expect(resolver).toBeInstanceOf(DependencyResolver);
  });
});
