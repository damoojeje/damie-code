/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Supervisor states following Ralph Loop methodology
 */
export enum SupervisorState {
  /** Initial state, waiting for task */
  IDLE = 'idle',
  /** Planning phase - generating implementation plan */
  PLAN = 'plan',
  /** Execution phase - implementing the plan */
  EXECUTE = 'execute',
  /** Verification phase - validating results */
  VERIFY = 'verify',
  /** Iteration phase - fixing issues found during verification */
  ITERATE = 'iterate',
  /** Successfully completed */
  COMPLETE = 'complete',
  /** Failed after max iterations or unrecoverable error */
  FAILED = 'failed',
  /** Paused by user or system */
  PAUSED = 'paused',
}

/**
 * State transition event
 */
export interface StateTransition {
  /** Previous state */
  from: SupervisorState;
  /** New state */
  to: SupervisorState;
  /** Transition reason */
  reason: string;
  /** Timestamp of transition */
  timestamp: Date;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * State transition callback
 */
export type StateTransitionCallback = (transition: StateTransition) => void | Promise<void>;

/**
 * State entry callback
 */
export type StateEntryCallback = (state: SupervisorState, context?: Record<string, unknown>) => void | Promise<void>;

/**
 * State exit callback
 */
export type StateExitCallback = (state: SupervisorState, nextState: SupervisorState) => void | Promise<void>;

/**
 * Task context for supervisor
 */
export interface TaskContext {
  /** Unique task ID */
  id: string;
  /** Task description */
  description: string;
  /** Current iteration number */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Task started at */
  startedAt: Date;
  /** Last updated at */
  updatedAt: Date;
  /** Plan generated during PLAN phase */
  plan?: TaskPlan;
  /** Results from EXECUTE phase */
  executionResults?: ExecutionResult[];
  /** Verification results from VERIFY phase */
  verificationResult?: VerificationResult;
  /** Error if any */
  error?: Error;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task plan generated during PLAN phase
 */
export interface TaskPlan {
  /** Plan ID */
  id: string;
  /** Plan steps */
  steps: PlanStep[];
  /** Estimated duration in seconds */
  estimatedDuration?: number;
  /** Success criteria */
  successCriteria: string[];
  /** Created at */
  createdAt: Date;
}

/**
 * Individual plan step
 */
export interface PlanStep {
  /** Step number */
  index: number;
  /** Step description */
  description: string;
  /** Step type */
  type: 'code' | 'file' | 'command' | 'test' | 'other';
  /** File path if applicable */
  filePath?: string;
  /** Command if applicable */
  command?: string;
  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  /** Result if completed */
  result?: string;
}

/**
 * Execution result from a plan step
 */
export interface ExecutionResult {
  /** Step index */
  stepIndex: number;
  /** Success status */
  success: boolean;
  /** Output/result */
  output?: string;
  /** Error if failed */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Verification result from VERIFY phase
 */
export interface VerificationResult {
  /** Overall pass/fail */
  passed: boolean;
  /** Individual criteria results */
  criteriaResults: CriterionResult[];
  /** Suggestions for iteration if failed */
  suggestions?: string[];
  /** Timestamp */
  timestamp: Date;
}

/**
 * Single criterion verification result
 */
export interface CriterionResult {
  /** Criterion description */
  criterion: string;
  /** Pass/fail */
  passed: boolean;
  /** Details */
  details?: string;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig {
  /** Maximum iterations before failing */
  maxIterations: number;
  /** Timeout per state in milliseconds (0 = no timeout) */
  stateTimeouts: Partial<Record<SupervisorState, number>>;
  /** Auto-save state for recovery */
  enablePersistence: boolean;
  /** Persistence file path */
  persistencePath?: string;
}

/**
 * Default state machine configuration
 */
export const DEFAULT_STATE_MACHINE_CONFIG: StateMachineConfig = {
  maxIterations: 3,
  stateTimeouts: {
    [SupervisorState.PLAN]: 60000, // 1 minute
    [SupervisorState.EXECUTE]: 300000, // 5 minutes
    [SupervisorState.VERIFY]: 60000, // 1 minute
    [SupervisorState.ITERATE]: 300000, // 5 minutes
  },
  enablePersistence: true,
  persistencePath: '.damie/supervisor-state.json',
};

/**
 * Persisted state for recovery
 */
export interface PersistedState {
  /** Task context */
  taskContext: TaskContext;
  /** Current state */
  currentState: SupervisorState;
  /** State history */
  stateHistory: StateTransition[];
  /** Persisted at */
  persistedAt: Date;
  /** Version for compatibility */
  version: string;
}
