/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskPlanner, createTaskPlanner } from './taskPlanner.js';
import type { SubtaskTemplate, DecompositionRequest } from './taskPlanner.js';
import { SubtaskType, PlanStatus } from './types.js';

describe('TaskPlanner', () => {
  let planner: TaskPlanner;

  beforeEach(() => {
    planner = new TaskPlanner();
  });

  describe('constructor', () => {
    it('should create planner with default config', () => {
      const defaultPlanner = new TaskPlanner();
      expect(defaultPlanner).toBeInstanceOf(TaskPlanner);
    });

    it('should accept custom config', () => {
      const custom = new TaskPlanner({ maxSubtasks: 10 });
      expect(custom).toBeInstanceOf(TaskPlanner);
    });
  });

  describe('createDecomposition', () => {
    const simpleRequest: DecompositionRequest = {
      task: 'Add user authentication to the app',
    };

    const simpleTemplates: SubtaskTemplate[] = [
      {
        title: 'Create auth module',
        description: 'Set up authentication module structure',
        type: SubtaskType.CODE,
        affectedFiles: ['src/auth/index.ts'],
        acceptanceCriteria: ['Auth module exists'],
      },
      {
        title: 'Add login endpoint',
        description: 'Create POST /api/login endpoint',
        type: SubtaskType.CODE,
        dependencies: ['Create auth module'],
        affectedFiles: ['src/auth/login.ts'],
        acceptanceCriteria: ['Login endpoint works'],
      },
      {
        title: 'Write auth tests',
        description: 'Add unit tests for authentication',
        type: SubtaskType.TEST,
        dependencies: ['Add login endpoint'],
        affectedFiles: ['tests/auth.test.ts'],
        acceptanceCriteria: ['Tests pass'],
      },
    ];

    it('should create decomposition from templates', () => {
      const decomposition = planner.createDecomposition(simpleRequest, simpleTemplates);

      expect(decomposition.id).toMatch(/^plan_/);
      expect(decomposition.originalTask).toBe(simpleRequest.task);
      expect(decomposition.subtasks).toHaveLength(3);
      expect(decomposition.status).toBe(PlanStatus.DRAFT);
    });

    it('should set root subtasks correctly', () => {
      const decomposition = planner.createDecomposition(simpleRequest, simpleTemplates);

      // First subtask has no dependencies
      expect(decomposition.rootSubtasks.length).toBeGreaterThan(0);
      const rootSubtask = decomposition.subtasks.find(
        (s) => s.id === decomposition.rootSubtasks[0],
      );
      expect(rootSubtask?.dependencies).toHaveLength(0);
    });

    it('should calculate total effort', () => {
      const decomposition = planner.createDecomposition(simpleRequest, simpleTemplates);

      expect(decomposition.totalEffort.minutes).toBeGreaterThan(0);
      expect(decomposition.totalEffort.confidence).toBeGreaterThan(0);
    });

    it('should generate success criteria', () => {
      const decomposition = planner.createDecomposition(simpleRequest, simpleTemplates);

      expect(decomposition.successCriteria.length).toBeGreaterThan(0);
    });

    it('should handle empty templates', () => {
      const decomposition = planner.createDecomposition(simpleRequest, []);

      expect(decomposition.subtasks).toHaveLength(0);
      expect(decomposition.rootSubtasks).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('should validate a valid decomposition', () => {
      const request: DecompositionRequest = {
        task: 'Build a simple feature',
      };
      const templates: SubtaskTemplate[] = [
        {
          title: 'Create feature',
          description: 'Implement the feature',
          type: SubtaskType.CODE,
          acceptanceCriteria: ['Feature works'],
        },
      ];

      const decomposition = planner.createDecomposition(request, templates);
      const validation = planner.validate(decomposition);

      expect(validation.errors).toHaveLength(0);
      expect(validation.isValid).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const request: DecompositionRequest = { task: 'Test circular' };

      // Create decomposition first, then manually add circular dependency
      const decomposition = planner.createDecomposition(request, [
        {
          title: 'Task A',
          description: 'First task',
          type: SubtaskType.CODE,
          acceptanceCriteria: ['Done'],
        },
        {
          title: 'Task B',
          description: 'Second task',
          type: SubtaskType.CODE,
          acceptanceCriteria: ['Done'],
        },
      ]);

      // Manually create circular dependency
      decomposition.subtasks[0].dependencies = [decomposition.subtasks[1].id];
      decomposition.subtasks[1].dependencies = [decomposition.subtasks[0].id];

      const validation = planner.validate(decomposition);

      expect(validation.errors.some((e) => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });

    it('should warn about missing tests', () => {
      const request: DecompositionRequest = { task: 'Build feature' };
      const templates: SubtaskTemplate[] = [
        {
          title: 'Implement code',
          description: 'Write the code',
          type: SubtaskType.CODE,
          acceptanceCriteria: ['Works'],
        },
      ];

      const decomposition = planner.createDecomposition(request, templates);
      const validation = planner.validate(decomposition);

      expect(validation.warnings.some((w) => w.code === 'NO_TESTS')).toBe(true);
    });
  });

  describe('addSubtask', () => {
    it('should add a subtask to decomposition', () => {
      const request: DecompositionRequest = { task: 'Test add' };
      const decomposition = planner.createDecomposition(request, []);

      const subtask = planner.addSubtask(decomposition, {
        title: 'New subtask',
        description: 'A new subtask',
        type: SubtaskType.CODE,
        acceptanceCriteria: ['Works'],
      });

      expect(decomposition.subtasks).toHaveLength(1);
      expect(decomposition.subtasks[0].id).toBe(subtask.id);
      expect(decomposition.version).toBe(2);
    });

    it('should update effort after adding', () => {
      const request: DecompositionRequest = { task: 'Test effort' };
      const decomposition = planner.createDecomposition(request, []);
      const initialEffort = decomposition.totalEffort.minutes;

      planner.addSubtask(decomposition, {
        title: 'Complex task',
        description: 'A complex refactoring task',
        type: SubtaskType.CODE,
      });

      expect(decomposition.totalEffort.minutes).toBeGreaterThan(initialEffort);
    });
  });

  describe('removeSubtask', () => {
    it('should remove a subtask from decomposition', () => {
      const request: DecompositionRequest = { task: 'Test remove' };
      const decomposition = planner.createDecomposition(request, [
        {
          title: 'Task to remove',
          description: 'Will be removed',
          type: SubtaskType.CODE,
        },
      ]);

      const subtaskId = decomposition.subtasks[0].id;
      const result = planner.removeSubtask(decomposition, subtaskId);

      expect(result).toBe(true);
      expect(decomposition.subtasks).toHaveLength(0);
    });

    it('should return false for non-existent subtask', () => {
      const request: DecompositionRequest = { task: 'Test remove' };
      const decomposition = planner.createDecomposition(request, []);

      const result = planner.removeSubtask(decomposition, 'non-existent');

      expect(result).toBe(false);
    });

    it('should remove dependencies when subtask is removed', () => {
      const request: DecompositionRequest = { task: 'Test deps' };
      const decomposition = planner.createDecomposition(request, [
        {
          title: 'First',
          description: 'First task',
          type: SubtaskType.CODE,
        },
        {
          title: 'Second',
          description: 'Second task',
          type: SubtaskType.CODE,
          dependencies: ['First'],
        },
      ]);

      const firstId = decomposition.subtasks[0].id;
      planner.removeSubtask(decomposition, firstId);

      expect(decomposition.subtasks[0].dependencies).not.toContain(firstId);
    });
  });

  describe('getExecutionOrder', () => {
    it('should return topologically sorted order', () => {
      const request: DecompositionRequest = { task: 'Test order' };
      const templates: SubtaskTemplate[] = [
        { title: 'Third', description: 'Last', type: SubtaskType.CODE, dependencies: ['Second'] },
        { title: 'First', description: 'First', type: SubtaskType.CODE },
        { title: 'Second', description: 'Middle', type: SubtaskType.CODE, dependencies: ['First'] },
      ];

      const decomposition = planner.createDecomposition(request, templates);
      const order = planner.getExecutionOrder(decomposition);

      // First should come before Second, Second before Third
      const firstIdx = order.indexOf(decomposition.subtasks.find((s) => s.title === 'First')!.id);
      const secondIdx = order.indexOf(decomposition.subtasks.find((s) => s.title === 'Second')!.id);
      const thirdIdx = order.indexOf(decomposition.subtasks.find((s) => s.title === 'Third')!.id);

      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('should throw on circular dependencies', () => {
      const request: DecompositionRequest = { task: 'Test circular' };
      const decomposition = planner.createDecomposition(request, [
        { title: 'A', description: 'A', type: SubtaskType.CODE },
        { title: 'B', description: 'B', type: SubtaskType.CODE },
      ]);

      // Create circular dependency
      decomposition.subtasks[0].dependencies = [decomposition.subtasks[1].id];
      decomposition.subtasks[1].dependencies = [decomposition.subtasks[0].id];

      expect(() => planner.getExecutionOrder(decomposition)).toThrow('circular');
    });
  });

  describe('getParallelGroups', () => {
    it('should group parallelizable subtasks', () => {
      const request: DecompositionRequest = { task: 'Test parallel' };
      const templates: SubtaskTemplate[] = [
        { title: 'A1', description: 'Parallel 1', type: SubtaskType.CODE },
        { title: 'A2', description: 'Parallel 2', type: SubtaskType.CODE },
        { title: 'B', description: 'After A1 and A2', type: SubtaskType.CODE, dependencies: ['A1', 'A2'] },
      ];

      const decomposition = planner.createDecomposition(request, templates);
      const groups = planner.getParallelGroups(decomposition);

      // A1 and A2 should be in the same group (level 0)
      // B should be in the next group (level 1)
      expect(groups.length).toBe(2);
      expect(groups[0]).toHaveLength(2);
      expect(groups[1]).toHaveLength(1);
    });
  });

  describe('completeSubtask', () => {
    it('should mark subtask as complete', () => {
      const request: DecompositionRequest = { task: 'Test complete' };
      const decomposition = planner.createDecomposition(request, [
        { title: 'Task', description: 'Task', type: SubtaskType.CODE },
      ]);

      const subtaskId = decomposition.subtasks[0].id;
      planner.completeSubtask(decomposition, subtaskId, {
        success: true,
        output: 'Done',
      });

      expect(decomposition.subtasks[0].status).toBe('completed');
      expect(decomposition.subtasks[0].result?.success).toBe(true);
    });

    it('should mark plan as complete when all subtasks done', () => {
      const request: DecompositionRequest = { task: 'Test complete all' };
      const decomposition = planner.createDecomposition(request, [
        { title: 'Task 1', description: 'Task 1', type: SubtaskType.CODE },
        { title: 'Task 2', description: 'Task 2', type: SubtaskType.CODE },
      ]);

      for (const subtask of decomposition.subtasks) {
        planner.completeSubtask(decomposition, subtask.id, { success: true });
      }

      expect(decomposition.status).toBe(PlanStatus.COMPLETED);
    });

    it('should mark subtask as failed on failure', () => {
      const request: DecompositionRequest = { task: 'Test fail' };
      const decomposition = planner.createDecomposition(request, [
        { title: 'Task', description: 'Task', type: SubtaskType.CODE },
      ]);

      const subtaskId = decomposition.subtasks[0].id;
      planner.completeSubtask(decomposition, subtaskId, {
        success: false,
        error: 'Something went wrong',
      });

      expect(decomposition.subtasks[0].status).toBe('failed');
      expect(decomposition.subtasks[0].result?.error).toBe('Something went wrong');
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency graph', () => {
      const request: DecompositionRequest = { task: 'Test graph' };
      const templates: SubtaskTemplate[] = [
        { title: 'A', description: 'A', type: SubtaskType.CODE },
        { title: 'B', description: 'B', type: SubtaskType.CODE, dependencies: ['A'] },
      ];

      const decomposition = planner.createDecomposition(request, templates);
      const graph = planner.getDependencyGraph(decomposition);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.hasCycles).toBe(false);
    });
  });
});

describe('createTaskPlanner', () => {
  it('should create planner with factory function', () => {
    const planner = createTaskPlanner();
    expect(planner).toBeInstanceOf(TaskPlanner);
  });

  it('should pass config to factory', () => {
    const planner = createTaskPlanner({ maxSubtasks: 5 });
    expect(planner).toBeInstanceOf(TaskPlanner);
  });
});

describe('EffortEstimation integration', () => {
  it('should estimate higher effort for complex tasks', () => {
    const planner = new TaskPlanner();

    const simpleDecomp = planner.createDecomposition(
      { task: 'Fix typo' },
      [{ title: 'Fix typo', description: 'Simple typo fix', type: SubtaskType.CODE }],
    );

    const complexDecomp = planner.createDecomposition(
      { task: 'Refactor architecture' },
      [
        {
          title: 'Refactor database layer',
          description: 'Complex migration and refactoring of database architecture',
          type: SubtaskType.CODE,
          affectedFiles: ['db/a.ts', 'db/b.ts', 'db/c.ts', 'db/d.ts'],
        },
      ],
    );

    expect(complexDecomp.totalEffort.minutes).toBeGreaterThan(simpleDecomp.totalEffort.minutes);
  });
});
