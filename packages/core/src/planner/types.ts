/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Subtask priority levels
 */
export enum SubtaskPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * Subtask status
 */
export enum SubtaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  BLOCKED = 'blocked',
}

/**
 * Subtask type
 */
export enum SubtaskType {
  CODE = 'code',
  FILE = 'file',
  COMMAND = 'command',
  TEST = 'test',
  DOCUMENTATION = 'documentation',
  CONFIGURATION = 'configuration',
  RESEARCH = 'research',
  REVIEW = 'review',
  OTHER = 'other',
}

/**
 * Effort level
 */
export enum EffortLevel {
  TRIVIAL = 'trivial',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
  COMPLEX = 'complex',
}

/**
 * Individual subtask
 */
export interface Subtask {
  /** Unique subtask ID */
  id: string;
  /** Parent task ID */
  parentId: string;
  /** Human-readable title */
  title: string;
  /** Detailed description */
  description: string;
  /** Subtask type */
  type: SubtaskType;
  /** Priority level */
  priority: SubtaskPriority;
  /** Current status */
  status: SubtaskStatus;
  /** IDs of subtasks this depends on */
  dependencies: string[];
  /** IDs of subtasks that depend on this */
  dependents: string[];
  /** Estimated effort */
  effort: EffortEstimate;
  /** File paths this subtask affects */
  affectedFiles: string[];
  /** Commands to execute */
  commands: string[];
  /** Expected outputs/deliverables */
  expectedOutputs: string[];
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Tags for categorization */
  tags: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Completion timestamp */
  completedAt?: Date;
  /** Result/output from execution */
  result?: SubtaskResult;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Effort estimate
 */
export interface EffortEstimate {
  /** Effort level */
  level: EffortLevel;
  /** Estimated minutes */
  minutes: number;
  /** Confidence (0-1) */
  confidence: number;
  /** Factors affecting estimate */
  factors: string[];
}

/**
 * Subtask result
 */
export interface SubtaskResult {
  /** Success status */
  success: boolean;
  /** Output/result text */
  output?: string;
  /** Files created/modified */
  filesAffected: string[];
  /** Error if failed */
  error?: string;
  /** Duration in ms */
  duration: number;
  /** Retry count */
  retries: number;
}

/**
 * Task plan containing subtasks
 */
export interface TaskDecomposition {
  /** Unique plan ID */
  id: string;
  /** Original task description */
  originalTask: string;
  /** Plan title */
  title: string;
  /** Plan summary */
  summary: string;
  /** All subtasks */
  subtasks: Subtask[];
  /** Root subtask IDs (no dependencies) */
  rootSubtasks: string[];
  /** Leaf subtask IDs (no dependents) */
  leafSubtasks: string[];
  /** Total estimated effort */
  totalEffort: EffortEstimate;
  /** Success criteria for the whole plan */
  successCriteria: string[];
  /** Assumptions made during planning */
  assumptions: string[];
  /** Risks identified */
  risks: PlanRisk[];
  /** Plan version */
  version: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Plan status */
  status: PlanStatus;
  /** Validation result */
  validation?: PlanValidation;
}

/**
 * Plan status
 */
export enum PlanStatus {
  DRAFT = 'draft',
  VALIDATED = 'validated',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Plan risk
 */
export interface PlanRisk {
  /** Risk description */
  description: string;
  /** Severity (1-5) */
  severity: number;
  /** Probability (0-1) */
  probability: number;
  /** Mitigation strategy */
  mitigation: string;
  /** Affected subtask IDs */
  affectedSubtasks: string[];
}

/**
 * Plan validation result
 */
export interface PlanValidation {
  /** Is plan valid */
  isValid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Completeness score (0-1) */
  completenessScore: number;
  /** Coverage analysis */
  coverage: CoverageAnalysis;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Affected subtask IDs */
  subtaskIds: string[];
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Affected subtask IDs */
  subtaskIds: string[];
  /** Recommendation */
  recommendation?: string;
}

/**
 * Coverage analysis
 */
export interface CoverageAnalysis {
  /** Requirements covered */
  requirementsCovered: string[];
  /** Requirements not covered */
  requirementsNotCovered: string[];
  /** Files to be modified */
  filesToModify: string[];
  /** Tests to be added/updated */
  testsRequired: string[];
  /** Documentation to update */
  docsToUpdate: string[];
}

/**
 * Dependency graph
 */
export interface DependencyGraph {
  /** All nodes (subtask IDs) */
  nodes: string[];
  /** Edges (from -> to) */
  edges: DependencyEdge[];
  /** Adjacency list */
  adjacencyList: Map<string, string[]>;
  /** Reverse adjacency list */
  reverseAdjacencyList: Map<string, string[]>;
  /** Execution levels (parallel groups) */
  levels: string[][];
  /** Has circular dependencies */
  hasCycles: boolean;
  /** Cycle details if any */
  cycles: string[][];
}

/**
 * Dependency edge
 */
export interface DependencyEdge {
  /** From subtask ID */
  from: string;
  /** To subtask ID */
  to: string;
  /** Edge type */
  type: DependencyType;
  /** Is critical path */
  isCritical: boolean;
}

/**
 * Dependency type
 */
export enum DependencyType {
  /** Must complete before */
  FINISH_TO_START = 'finish_to_start',
  /** Can start together but must finish before */
  START_TO_START = 'start_to_start',
  /** Must finish together */
  FINISH_TO_FINISH = 'finish_to_finish',
  /** Soft dependency (preferred but not required) */
  SOFT = 'soft',
}

/**
 * Planner configuration
 */
export interface PlannerConfig {
  /** Maximum subtasks per plan */
  maxSubtasks: number;
  /** Maximum depth of dependencies */
  maxDependencyDepth: number;
  /** Default effort estimation */
  defaultEffort: EffortLevel;
  /** Enable parallel execution analysis */
  enableParallelAnalysis: boolean;
  /** Enable risk assessment */
  enableRiskAssessment: boolean;
  /** Minimum completeness score to pass validation */
  minCompletenessScore: number;
  /** Enable auto-fixing of validation errors */
  enableAutoFix: boolean;
}

/**
 * Default planner configuration
 */
export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  maxSubtasks: 20,
  maxDependencyDepth: 5,
  defaultEffort: EffortLevel.MEDIUM,
  enableParallelAnalysis: true,
  enableRiskAssessment: true,
  minCompletenessScore: 0.8,
  enableAutoFix: false,
};
