/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  Subtask,
  EffortEstimate,
  SubtaskResult,
  TaskDecomposition,
  PlanRisk,
  PlanValidation,
  ValidationError,
  ValidationWarning,
  CoverageAnalysis,
  DependencyGraph,
  DependencyEdge,
  PlannerConfig,
} from './types.js';

export {
  SubtaskPriority,
  SubtaskStatus,
  SubtaskType,
  EffortLevel,
  PlanStatus,
  DependencyType,
  DEFAULT_PLANNER_CONFIG,
} from './types.js';

// Task Planner
export type {
  DecompositionRequest,
  SubtaskTemplate,
} from './taskPlanner.js';

export {
  TaskPlanner,
  createTaskPlanner,
} from './taskPlanner.js';

// Effort Estimator
export type {
  EffortEstimationConfig,
} from './effortEstimator.js';

export {
  EffortEstimator,
  createEffortEstimator,
  DEFAULT_EFFORT_CONFIG,
} from './effortEstimator.js';

// Dependency Graph
export {
  DependencyGraphBuilder,
  createDependencyGraphBuilder,
} from './dependencyGraph.js';

// Plan Validator
export {
  PlanValidator,
  createPlanValidator,
} from './planValidator.js';

// Dependency Resolver
export type {
  ResolutionResult,
  ExecutionState,
} from './dependencyResolver.js';

export {
  DependencyResolver,
  createDependencyResolver,
  FailureMode,
} from './dependencyResolver.js';

// Parallel Executor
export type {
  SubtaskExecutor,
  PlannerProgressCallback,
  ExecutionProgress,
  ParallelExecutionResult,
  ParallelExecutorConfig,
} from './parallelExecutor.js';

export {
  ParallelExecutor,
  createParallelExecutor,
  DEFAULT_EXECUTOR_CONFIG,
} from './parallelExecutor.js';
