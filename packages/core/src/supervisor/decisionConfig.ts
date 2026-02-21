/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { SupervisorState } from './types.js';

/**
 * Decision outcome types
 */
export enum DecisionOutcome {
  /** Continue to next phase */
  CONTINUE = 'continue',
  /** Retry current phase */
  RETRY = 'retry',
  /** Iterate (re-plan based on failures) */
  ITERATE = 'iterate',
  /** Mark as complete */
  COMPLETE = 'complete',
  /** Abort with failure */
  ABORT = 'abort',
  /** Pause for user intervention */
  PAUSE = 'pause',
}

/**
 * Phase evaluation result
 */
export interface PhaseEvaluation {
  /** Phase that was evaluated */
  phase: SupervisorState;
  /** Whether the phase succeeded */
  success: boolean;
  /** Success rate (0-1) */
  successRate: number;
  /** Number of successful items */
  successCount: number;
  /** Number of failed items */
  failureCount: number;
  /** Number of skipped items */
  skippedCount: number;
  /** Total items */
  totalCount: number;
  /** Whether this is a partial success */
  partialSuccess: boolean;
  /** Critical failures that should cause abort */
  criticalFailures: string[];
  /** Recoverable failures that can be retried */
  recoverableFailures: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}

/**
 * Decision result
 */
export interface DecisionResult {
  /** The decision made */
  outcome: DecisionOutcome;
  /** Reason for the decision */
  reason: string;
  /** Phase evaluation that led to decision */
  evaluation: PhaseEvaluation;
  /** Confidence in decision (0-1) */
  confidence: number;
  /** Suggested next state if applicable */
  suggestedState?: SupervisorState;
  /** Whether retry is recommended */
  shouldRetry: boolean;
  /** Current retry attempt */
  retryAttempt: number;
  /** Max retries allowed */
  maxRetries: number;
  /** Timestamp */
  timestamp: Date;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Decision thresholds configuration
 */
export interface DecisionThresholds {
  /** Minimum success rate to consider phase successful (0-1) */
  minSuccessRate: number;
  /** Minimum success rate for partial success (0-1) */
  partialSuccessRate: number;
  /** Maximum critical failures before abort */
  maxCriticalFailures: number;
  /** Maximum retries per phase */
  maxRetries: number;
  /** Confidence threshold for automatic decisions */
  confidenceThreshold: number;
}

/**
 * Decision engine configuration
 */
export interface DecisionConfig {
  /** Thresholds for decision making */
  thresholds: Partial<DecisionThresholds>;
  /** Enable automatic retry on recoverable failures */
  autoRetry: boolean;
  /** Enable partial success handling */
  allowPartialSuccess: boolean;
  /** Require human confirmation for certain decisions */
  requireConfirmation: DecisionOutcome[];
  /** Enable decision logging */
  enableLogging: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: DecisionThresholds = {
  minSuccessRate: 0.9,
  partialSuccessRate: 0.5,
  maxCriticalFailures: 0,
  maxRetries: 2,
  confidenceThreshold: 0.8,
};

/**
 * Default decision configuration
 */
export const DEFAULT_DECISION_CONFIG: DecisionConfig = {
  thresholds: DEFAULT_THRESHOLDS,
  autoRetry: true,
  allowPartialSuccess: true,
  requireConfirmation: [DecisionOutcome.ABORT],
  enableLogging: true,
  logLevel: 'info',
};

/**
 * Decision log entry
 */
export interface DecisionLogEntry {
  /** Decision ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Phase evaluated */
  phase: SupervisorState;
  /** Evaluation summary */
  evaluation: PhaseEvaluation;
  /** Decision made */
  decision: DecisionResult;
  /** Whether user was consulted */
  userConfirmed: boolean;
  /** Override if user changed decision */
  userOverride?: DecisionOutcome;
}
