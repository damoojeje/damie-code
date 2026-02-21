/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskDecomposition,
  PlanValidation,
  ValidationError,
  ValidationWarning,
  CoverageAnalysis,
  DependencyGraph,
  PlannerConfig,
} from './types.js';
import { DEFAULT_PLANNER_CONFIG } from './types.js';
import { DependencyGraphBuilder } from './dependencyGraph.js';

/**
 * Plan Validator
 *
 * Validates task decomposition plans for completeness, correctness,
 * and feasibility.
 */
export class PlanValidator {
  private config: PlannerConfig;
  private graphBuilder: DependencyGraphBuilder;

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
    this.graphBuilder = new DependencyGraphBuilder();
  }

  /**
   * Validate a task decomposition
   */
  validate(decomposition: TaskDecomposition): PlanValidation {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Build dependency graph
    const graph = this.graphBuilder.build(decomposition.subtasks);

    // Run validation checks
    this.validateBasicStructure(decomposition, errors, warnings);
    this.validateDependencies(decomposition, graph, errors, warnings);
    this.validateSubtasks(decomposition, errors, warnings);
    this.validateCompleteness(decomposition, errors, warnings);

    // Calculate coverage
    const coverage = this.analyzeCoverage(decomposition);

    // Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(
      decomposition,
      errors,
      warnings,
      coverage,
    );

    return {
      isValid: errors.length === 0 && completenessScore >= this.config.minCompletenessScore,
      errors,
      warnings,
      completenessScore,
      coverage,
      timestamp: new Date(),
    };
  }

  /**
   * Validate basic structure
   */
  private validateBasicStructure(
    decomposition: TaskDecomposition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check for empty plan
    if (decomposition.subtasks.length === 0) {
      errors.push({
        code: 'EMPTY_PLAN',
        message: 'Plan has no subtasks',
        subtaskIds: [],
        suggestion: 'Add at least one subtask to the plan',
      });
      return;
    }

    // Check for too many subtasks
    if (decomposition.subtasks.length > this.config.maxSubtasks) {
      warnings.push({
        code: 'TOO_MANY_SUBTASKS',
        message: `Plan has ${decomposition.subtasks.length} subtasks (max: ${this.config.maxSubtasks})`,
        subtaskIds: [],
        recommendation: 'Consider grouping related subtasks',
      });
    }

    // Check for missing title
    if (!decomposition.title?.trim()) {
      errors.push({
        code: 'MISSING_TITLE',
        message: 'Plan is missing a title',
        subtaskIds: [],
        suggestion: 'Add a descriptive title',
      });
    }

    // Check for missing success criteria
    if (decomposition.successCriteria.length === 0) {
      errors.push({
        code: 'NO_SUCCESS_CRITERIA',
        message: 'Plan has no success criteria',
        subtaskIds: [],
        suggestion: 'Define clear success criteria',
      });
    }

    // Check root and leaf subtasks
    if (decomposition.rootSubtasks.length === 0) {
      warnings.push({
        code: 'NO_ROOT_SUBTASKS',
        message: 'No root subtasks identified (subtasks without dependencies)',
        subtaskIds: [],
        recommendation: 'Check dependency configuration',
      });
    }
  }

  /**
   * Validate dependencies
   */
  private validateDependencies(
    decomposition: TaskDecomposition,
    graph: DependencyGraph,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check for circular dependencies
    if (graph.hasCycles) {
      for (const cycle of graph.cycles) {
        errors.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected: ${cycle.join(' -> ')}`,
          subtaskIds: cycle,
          suggestion: 'Remove one of the dependencies in the cycle',
        });
      }
    }

    // Check for missing dependencies
    const subtaskIds = new Set(decomposition.subtasks.map((s) => s.id));
    for (const subtask of decomposition.subtasks) {
      for (const depId of subtask.dependencies) {
        if (!subtaskIds.has(depId)) {
          errors.push({
            code: 'MISSING_DEPENDENCY',
            message: `Subtask "${subtask.title}" depends on non-existent subtask "${depId}"`,
            subtaskIds: [subtask.id],
            suggestion: `Remove or correct the dependency on "${depId}"`,
          });
        }
      }
    }

    // Check dependency depth
    if (graph.levels.length > this.config.maxDependencyDepth) {
      warnings.push({
        code: 'DEEP_DEPENDENCIES',
        message: `Dependency chain is ${graph.levels.length} levels deep (max: ${this.config.maxDependencyDepth})`,
        subtaskIds: [],
        recommendation: 'Consider parallelizing some subtasks',
      });
    }
  }

  /**
   * Validate individual subtasks
   */
  private validateSubtasks(
    decomposition: TaskDecomposition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const seenIds = new Set<string>();

    for (const subtask of decomposition.subtasks) {
      // Check for duplicate IDs
      if (seenIds.has(subtask.id)) {
        errors.push({
          code: 'DUPLICATE_ID',
          message: `Duplicate subtask ID: "${subtask.id}"`,
          subtaskIds: [subtask.id],
          suggestion: 'Assign unique IDs to each subtask',
        });
      }
      seenIds.add(subtask.id);

      // Check for missing title
      if (!subtask.title?.trim()) {
        errors.push({
          code: 'SUBTASK_MISSING_TITLE',
          message: `Subtask "${subtask.id}" has no title`,
          subtaskIds: [subtask.id],
          suggestion: 'Add a descriptive title',
        });
      }

      // Check for missing description
      if (!subtask.description?.trim()) {
        warnings.push({
          code: 'SUBTASK_MISSING_DESCRIPTION',
          message: `Subtask "${subtask.title}" has no description`,
          subtaskIds: [subtask.id],
          recommendation: 'Add a detailed description',
        });
      }

      // Check for missing acceptance criteria
      if (subtask.acceptanceCriteria.length === 0) {
        warnings.push({
          code: 'SUBTASK_NO_CRITERIA',
          message: `Subtask "${subtask.title}" has no acceptance criteria`,
          subtaskIds: [subtask.id],
          recommendation: 'Define acceptance criteria for verification',
        });
      }

      // Check for low confidence effort estimate
      if (subtask.effort && subtask.effort.confidence < 0.5) {
        warnings.push({
          code: 'LOW_EFFORT_CONFIDENCE',
          message: `Subtask "${subtask.title}" has low effort estimation confidence (${Math.round(subtask.effort.confidence * 100)}%)`,
          subtaskIds: [subtask.id],
          recommendation: 'Provide more details to improve estimation',
        });
      }

      // Validate self-dependency
      if (subtask.dependencies.includes(subtask.id)) {
        errors.push({
          code: 'SELF_DEPENDENCY',
          message: `Subtask "${subtask.title}" depends on itself`,
          subtaskIds: [subtask.id],
          suggestion: 'Remove the self-dependency',
        });
      }
    }
  }

  /**
   * Validate plan completeness
   */
  private validateCompleteness(
    decomposition: TaskDecomposition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    // Check if original task is addressed
    const taskWords = decomposition.originalTask.toLowerCase().split(/\s+/);
    const subtaskText = decomposition.subtasks
      .map((s) => `${s.title} ${s.description}`.toLowerCase())
      .join(' ');

    const keywordsMissing: string[] = [];
    const importantKeywords = taskWords.filter(
      (w) => w.length > 4 && !['should', 'could', 'would', 'please', 'needs'].includes(w),
    );

    for (const keyword of importantKeywords) {
      if (!subtaskText.includes(keyword)) {
        keywordsMissing.push(keyword);
      }
    }

    if (keywordsMissing.length > importantKeywords.length * 0.3) {
      warnings.push({
        code: 'INCOMPLETE_COVERAGE',
        message: `Plan may not fully address the task. Missing keywords: ${keywordsMissing.slice(0, 5).join(', ')}`,
        subtaskIds: [],
        recommendation: 'Review if all aspects of the task are covered',
      });
    }

    // Check for test coverage
    const hasTests = decomposition.subtasks.some(
      (s) => s.type === 'test' || s.title.toLowerCase().includes('test'),
    );
    if (!hasTests) {
      warnings.push({
        code: 'NO_TESTS',
        message: 'Plan does not include any testing subtasks',
        subtaskIds: [],
        recommendation: 'Consider adding test subtasks for verification',
      });
    }
  }

  /**
   * Analyze coverage
   */
  private analyzeCoverage(decomposition: TaskDecomposition): CoverageAnalysis {
    const filesToModify = new Set<string>();
    const testsRequired: string[] = [];
    const docsToUpdate: string[] = [];

    for (const subtask of decomposition.subtasks) {
      // Collect files
      for (const file of subtask.affectedFiles) {
        filesToModify.add(file);
      }

      // Identify tests
      if (subtask.type === 'test' || subtask.title.toLowerCase().includes('test')) {
        testsRequired.push(subtask.title);
      }

      // Identify documentation
      if (
        subtask.type === 'documentation' ||
        subtask.title.toLowerCase().includes('doc') ||
        subtask.title.toLowerCase().includes('readme')
      ) {
        docsToUpdate.push(subtask.title);
      }
    }

    return {
      requirementsCovered: decomposition.successCriteria,
      requirementsNotCovered: [],
      filesToModify: Array.from(filesToModify),
      testsRequired,
      docsToUpdate,
    };
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(
    decomposition: TaskDecomposition,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    coverage: CoverageAnalysis,
  ): number {
    let score = 1.0;

    // Deduct for errors
    score -= errors.length * 0.15;

    // Deduct for warnings
    score -= warnings.length * 0.05;

    // Bonus for success criteria
    const criteriaPerSubtask =
      decomposition.subtasks.reduce(
        (sum, s) => sum + s.acceptanceCriteria.length,
        0,
      ) / Math.max(decomposition.subtasks.length, 1);
    if (criteriaPerSubtask >= 2) {
      score += 0.05;
    }

    // Bonus for tests
    if (coverage.testsRequired.length > 0) {
      score += 0.05;
    }

    // Bonus for documentation
    if (coverage.docsToUpdate.length > 0) {
      score += 0.02;
    }

    // Penalty for no files specified
    if (coverage.filesToModify.length === 0) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Quick validation check
   */
  isValid(decomposition: TaskDecomposition): boolean {
    const validation = this.validate(decomposition);
    return validation.isValid;
  }

  /**
   * Get validation errors only
   */
  getErrors(decomposition: TaskDecomposition): ValidationError[] {
    return this.validate(decomposition).errors;
  }

  /**
   * Get validation warnings only
   */
  getWarnings(decomposition: TaskDecomposition): ValidationWarning[] {
    return this.validate(decomposition).warnings;
  }
}

/**
 * Create a plan validator
 */
export function createPlanValidator(
  config?: Partial<PlannerConfig>,
): PlanValidator {
  return new PlanValidator(config);
}
