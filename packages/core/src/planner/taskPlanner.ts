/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Subtask,
  TaskDecomposition,
  PlannerConfig,
  PlanValidation,
  PlanRisk,
  DependencyGraph,
  SubtaskType,
} from './types.js';
import {
  SubtaskPriority,
  SubtaskStatus,
  PlanStatus,
  EffortLevel,
  DEFAULT_PLANNER_CONFIG,
} from './types.js';
import { EffortEstimator } from './effortEstimator.js';
import { DependencyGraphBuilder } from './dependencyGraph.js';
import { PlanValidator } from './planValidator.js';

/**
 * Task decomposition request
 */
export interface DecompositionRequest {
  /** The task to decompose */
  task: string;
  /** Additional context */
  context?: string;
  /** Hints for decomposition */
  hints?: string[];
  /** Constraints to consider */
  constraints?: string[];
  /** Target file patterns */
  targetFiles?: string[];
  /** Maximum subtasks */
  maxSubtasks?: number;
}

/**
 * Subtask template for creating subtasks
 */
export interface SubtaskTemplate {
  title: string;
  description: string;
  type: SubtaskType;
  priority?: SubtaskPriority;
  dependencies?: string[];
  affectedFiles?: string[];
  commands?: string[];
  expectedOutputs?: string[];
  acceptanceCriteria?: string[];
  tags?: string[];
}

/**
 * Task Planner
 *
 * Decomposes complex tasks into manageable subtasks with
 * dependencies, effort estimates, and validation.
 */
export class TaskPlanner {
  private config: PlannerConfig;
  private effortEstimator: EffortEstimator;
  private graphBuilder: DependencyGraphBuilder;
  private validator: PlanValidator;

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
    this.effortEstimator = new EffortEstimator();
    this.graphBuilder = new DependencyGraphBuilder();
    this.validator = new PlanValidator(this.config);
  }

  /**
   * Create a task decomposition from templates
   */
  createDecomposition(
    request: DecompositionRequest,
    subtaskTemplates: SubtaskTemplate[],
  ): TaskDecomposition {
    const planId = this.generateId('plan');
    const subtasks = this.createSubtasks(planId, subtaskTemplates);

    // Build dependency graph to identify roots and leaves
    const graph = this.graphBuilder.build(subtasks);

    // Identify root and leaf subtasks
    const rootSubtasks = subtasks
      .filter((s) => s.dependencies.length === 0)
      .map((s) => s.id);

    const leafSubtasks = subtasks
      .filter((s) => s.dependents.length === 0)
      .map((s) => s.id);

    // Estimate total effort
    const decomposition: TaskDecomposition = {
      id: planId,
      originalTask: request.task,
      title: this.generateTitle(request.task),
      summary: this.generateSummary(request.task, subtasks.length),
      subtasks,
      rootSubtasks,
      leafSubtasks,
      totalEffort: {
        level: EffortLevel.MEDIUM,
        minutes: 0,
        confidence: 0.5,
        factors: [],
      },
      successCriteria: this.extractSuccessCriteria(request, subtasks),
      assumptions: request.context ? [request.context] : [],
      risks: this.assessRisks(subtasks, graph),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: PlanStatus.DRAFT,
    };

    // Calculate total effort
    decomposition.totalEffort = this.effortEstimator.estimateTotal(decomposition);

    return decomposition;
  }

  /**
   * Create subtasks from templates
   */
  private createSubtasks(
    planId: string,
    templates: SubtaskTemplate[],
  ): Subtask[] {
    const idMap = new Map<string, string>();

    // First pass: generate IDs
    for (let i = 0; i < templates.length; i++) {
      const templateId = templates[i].title.toLowerCase().replace(/\s+/g, '-');
      const subtaskId = this.generateId(`subtask-${i}`);
      idMap.set(templateId, subtaskId);
      idMap.set(templates[i].title, subtaskId);
      idMap.set(String(i), subtaskId);
    }

    // Second pass: create subtasks
    return templates.map((template, index) => {
      const id = idMap.get(String(index))!;

      // Resolve dependency references
      const dependencies = (template.dependencies ?? [])
        .map((dep) => idMap.get(dep) ?? dep)
        .filter((dep) => dep !== id);

      const subtask: Subtask = {
        id,
        parentId: planId,
        title: template.title,
        description: template.description,
        type: template.type,
        priority: template.priority ?? SubtaskPriority.MEDIUM,
        status: SubtaskStatus.PENDING,
        dependencies,
        dependents: [],
        effort: { level: EffortLevel.MEDIUM, minutes: 30, confidence: 0.5, factors: [] },
        affectedFiles: template.affectedFiles ?? [],
        commands: template.commands ?? [],
        expectedOutputs: template.expectedOutputs ?? [],
        acceptanceCriteria: template.acceptanceCriteria ?? [],
        tags: template.tags ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Estimate effort
      subtask.effort = this.effortEstimator.estimate(subtask);

      return subtask;
    });
  }

  /**
   * Validate a decomposition
   */
  validate(decomposition: TaskDecomposition): PlanValidation {
    return this.validator.validate(decomposition);
  }

  /**
   * Update subtask dependents based on dependencies
   */
  updateDependents(decomposition: TaskDecomposition): void {
    // Clear existing dependents
    for (const subtask of decomposition.subtasks) {
      subtask.dependents = [];
    }

    // Build dependents from dependencies
    const subtaskMap = new Map(decomposition.subtasks.map((s) => [s.id, s]));
    for (const subtask of decomposition.subtasks) {
      for (const depId of subtask.dependencies) {
        const dep = subtaskMap.get(depId);
        if (dep) {
          dep.dependents.push(subtask.id);
        }
      }
    }

    decomposition.updatedAt = new Date();
  }

  /**
   * Add a subtask to a decomposition
   */
  addSubtask(
    decomposition: TaskDecomposition,
    template: SubtaskTemplate,
  ): Subtask {
    const id = this.generateId('subtask');
    const subtask: Subtask = {
      id,
      parentId: decomposition.id,
      title: template.title,
      description: template.description,
      type: template.type,
      priority: template.priority ?? SubtaskPriority.MEDIUM,
      status: SubtaskStatus.PENDING,
      dependencies: template.dependencies ?? [],
      dependents: [],
      effort: { level: EffortLevel.MEDIUM, minutes: 30, confidence: 0.5, factors: [] },
      affectedFiles: template.affectedFiles ?? [],
      commands: template.commands ?? [],
      expectedOutputs: template.expectedOutputs ?? [],
      acceptanceCriteria: template.acceptanceCriteria ?? [],
      tags: template.tags ?? [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    subtask.effort = this.effortEstimator.estimate(subtask);
    decomposition.subtasks.push(subtask);

    // Update dependents
    this.updateDependents(decomposition);

    // Update roots and leaves
    this.updateRootsAndLeaves(decomposition);

    // Update total effort
    decomposition.totalEffort = this.effortEstimator.estimateTotal(decomposition);
    decomposition.version++;
    decomposition.updatedAt = new Date();

    return subtask;
  }

  /**
   * Remove a subtask from a decomposition
   */
  removeSubtask(decomposition: TaskDecomposition, subtaskId: string): boolean {
    const index = decomposition.subtasks.findIndex((s) => s.id === subtaskId);
    if (index === -1) return false;

    // Remove from subtasks array
    decomposition.subtasks.splice(index, 1);

    // Remove from dependencies
    for (const subtask of decomposition.subtasks) {
      subtask.dependencies = subtask.dependencies.filter((d) => d !== subtaskId);
    }

    // Update dependents
    this.updateDependents(decomposition);

    // Update roots and leaves
    this.updateRootsAndLeaves(decomposition);

    // Update total effort
    decomposition.totalEffort = this.effortEstimator.estimateTotal(decomposition);
    decomposition.version++;
    decomposition.updatedAt = new Date();

    return true;
  }

  /**
   * Update roots and leaves
   */
  private updateRootsAndLeaves(decomposition: TaskDecomposition): void {
    decomposition.rootSubtasks = decomposition.subtasks
      .filter((s) => s.dependencies.length === 0)
      .map((s) => s.id);

    decomposition.leafSubtasks = decomposition.subtasks
      .filter((s) => s.dependents.length === 0)
      .map((s) => s.id);
  }

  /**
   * Get execution order (topologically sorted)
   */
  getExecutionOrder(decomposition: TaskDecomposition): string[] {
    const graph = this.graphBuilder.build(decomposition.subtasks);
    if (graph.hasCycles) {
      throw new Error('Cannot determine execution order: circular dependencies exist');
    }
    return this.graphBuilder.topologicalSort(graph);
  }

  /**
   * Get parallel execution groups
   */
  getParallelGroups(decomposition: TaskDecomposition): string[][] {
    const graph = this.graphBuilder.build(decomposition.subtasks);
    if (graph.hasCycles) {
      throw new Error('Cannot determine parallel groups: circular dependencies exist');
    }
    return graph.levels;
  }

  /**
   * Get dependency graph
   */
  getDependencyGraph(decomposition: TaskDecomposition): DependencyGraph {
    return this.graphBuilder.build(decomposition.subtasks);
  }

  /**
   * Mark a subtask as complete
   */
  completeSubtask(
    decomposition: TaskDecomposition,
    subtaskId: string,
    result?: { success: boolean; output?: string; error?: string },
  ): void {
    const subtask = decomposition.subtasks.find((s) => s.id === subtaskId);
    if (!subtask) return;

    subtask.status = result?.success !== false ? SubtaskStatus.COMPLETED : SubtaskStatus.FAILED;
    subtask.completedAt = new Date();
    subtask.updatedAt = new Date();

    if (result) {
      subtask.result = {
        success: result.success,
        output: result.output,
        error: result.error,
        filesAffected: subtask.affectedFiles,
        duration: 0,
        retries: 0,
      };
    }

    decomposition.updatedAt = new Date();

    // Check if all subtasks are complete
    const allComplete = decomposition.subtasks.every(
      (s) => s.status === SubtaskStatus.COMPLETED || s.status === SubtaskStatus.SKIPPED,
    );
    if (allComplete) {
      decomposition.status = PlanStatus.COMPLETED;
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a plan title from task
   */
  private generateTitle(task: string): string {
    // Take first sentence or first 50 chars
    const firstSentence = task.split(/[.!?]/)[0];
    if (firstSentence.length <= 60) {
      return `Plan: ${firstSentence}`;
    }
    return `Plan: ${task.substring(0, 57)}...`;
  }

  /**
   * Generate a plan summary
   */
  private generateSummary(task: string, subtaskCount: number): string {
    return `Decomposition of "${task.substring(0, 100)}${task.length > 100 ? '...' : ''}" into ${subtaskCount} subtask(s)`;
  }

  /**
   * Extract success criteria from request and subtasks
   */
  private extractSuccessCriteria(
    request: DecompositionRequest,
    subtasks: Subtask[],
  ): string[] {
    const criteria: string[] = [];

    // Add criteria from subtask acceptance criteria
    for (const subtask of subtasks) {
      if (subtask.acceptanceCriteria.length > 0) {
        criteria.push(`[${subtask.title}] ${subtask.acceptanceCriteria[0]}`);
      }
    }

    // Add general criteria
    criteria.push('All subtasks completed successfully');
    criteria.push('No critical errors during execution');

    return criteria.slice(0, 10); // Limit to 10 criteria
  }

  /**
   * Assess risks
   */
  private assessRisks(subtasks: Subtask[], graph: DependencyGraph): PlanRisk[] {
    const risks: PlanRisk[] = [];

    if (!this.config.enableRiskAssessment) {
      return risks;
    }

    // Risk: Circular dependencies
    if (graph.hasCycles) {
      risks.push({
        description: 'Circular dependencies detected in the plan',
        severity: 5,
        probability: 1.0,
        mitigation: 'Review and remove circular dependencies',
        affectedSubtasks: graph.cycles.flat(),
      });
    }

    // Risk: Long dependency chains
    if (graph.levels.length > 5) {
      risks.push({
        description: `Long dependency chain (${graph.levels.length} levels)`,
        severity: 3,
        probability: 0.6,
        mitigation: 'Consider parallelizing some subtasks',
        affectedSubtasks: graph.levels.flat(),
      });
    }

    // Risk: Single point of failure
    for (const subtask of subtasks) {
      if (subtask.dependents.length > 3) {
        risks.push({
          description: `Subtask "${subtask.title}" is a dependency for ${subtask.dependents.length} other subtasks`,
          severity: 4,
          probability: 0.4,
          mitigation: 'Ensure this subtask has high reliability and is well-tested',
          affectedSubtasks: [subtask.id, ...subtask.dependents],
        });
      }
    }

    // Risk: Complex subtasks
    for (const subtask of subtasks) {
      if (subtask.effort.level === EffortLevel.COMPLEX) {
        risks.push({
          description: `Subtask "${subtask.title}" is marked as complex`,
          severity: 3,
          probability: 0.5,
          mitigation: 'Consider breaking into smaller subtasks',
          affectedSubtasks: [subtask.id],
        });
      }
    }

    return risks;
  }
}

/**
 * Create a task planner
 */
export function createTaskPlanner(config?: Partial<PlannerConfig>): TaskPlanner {
  return new TaskPlanner(config);
}
