/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  StateTransition,
  StateTransitionCallback,
  StateEntryCallback,
  StateExitCallback,
  TaskContext,
  TaskPlan,
  PlanStep,
  ExecutionResult,
  VerificationResult,
  CriterionResult,
  StateMachineConfig,
  PersistedState,
} from './types.js';

export {
  SupervisorState,
  DEFAULT_STATE_MACHINE_CONFIG,
} from './types.js';

// Transitions
export {
  VALID_TRANSITIONS,
  isValidTransition,
  getValidTransitions,
  isTerminalState,
  isActiveState,
  canPause,
  getNextState,
  STATE_DISPLAY_NAMES,
  STATE_DESCRIPTIONS,
} from './transitions.js';

// State Machine
export {
  StateMachine,
  createStateMachine,
} from './stateMachine.js';

// State Persistence
export {
  StatePersistence,
  createStatePersistence,
  getDefaultStatePersistence,
} from './statePersistence.js';

// Supervisor Loop
export type {
  PhaseHandler,
  ProgressCallback,
  PhaseContext,
  ProgressReport,
  SupervisorLoopConfig,
  LoopResult,
} from './supervisorLoop.js';

export {
  SupervisorLoop,
  createSupervisorLoop,
  createSimplePlan,
  createExecutionResults,
  createVerificationResult,
  DEFAULT_LOOP_CONFIG,
} from './supervisorLoop.js';

// Decision Engine
export type {
  DecisionConfig,
  DecisionResult,
  PhaseEvaluation,
  DecisionLogEntry,
  DecisionThresholds,
} from './decisionConfig.js';

export {
  DecisionOutcome,
  DEFAULT_DECISION_CONFIG,
  DEFAULT_THRESHOLDS,
} from './decisionConfig.js';

export {
  DecisionEngine,
  createDecisionEngine,
} from './decisionEngine.js';
