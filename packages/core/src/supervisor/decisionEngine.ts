/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ExecutionResult,
  VerificationResult,
  CriterionResult,
} from './types.js';
import { SupervisorState } from './types.js';
import type {
  DecisionConfig,
  DecisionResult,
  PhaseEvaluation,
  DecisionLogEntry,
  DecisionThresholds,
} from './decisionConfig.js';
import {
  DecisionOutcome,
  DEFAULT_DECISION_CONFIG,
  DEFAULT_THRESHOLDS,
} from './decisionConfig.js';

/**
 * Resolved config with full thresholds
 */
interface ResolvedDecisionConfig extends Omit<DecisionConfig, 'thresholds'> {
  thresholds: DecisionThresholds;
}

/**
 * Decision Engine
 *
 * Evaluates phase outcomes and determines the appropriate next action.
 * Supports configurable thresholds, partial success handling, and retry logic.
 */
export class DecisionEngine {
  private config: ResolvedDecisionConfig;
  private logs: DecisionLogEntry[] = [];
  private retryCounters: Map<SupervisorState, number> = new Map();

  constructor(config: Partial<DecisionConfig> = {}) {
    this.config = {
      ...DEFAULT_DECISION_CONFIG,
      ...config,
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        ...config.thresholds,
      },
    };
  }

  /**
   * Evaluate execution results and make a decision
   */
  evaluateExecution(results: ExecutionResult[]): DecisionResult {
    const evaluation = this.evaluateExecutionResults(results);
    const decision = this.makeDecision(evaluation, SupervisorState.EXECUTE);

    this.logDecision(evaluation, decision);
    return decision;
  }

  /**
   * Evaluate verification results and make a decision
   */
  evaluateVerification(result: VerificationResult): DecisionResult {
    const evaluation = this.evaluateVerificationResult(result);
    const decision = this.makeDecision(evaluation, SupervisorState.VERIFY);

    this.logDecision(evaluation, decision);
    return decision;
  }

  /**
   * Evaluate plan phase (simple success/failure)
   */
  evaluatePlan(planGenerated: boolean, stepsCount: number): DecisionResult {
    const evaluation: PhaseEvaluation = {
      phase: SupervisorState.PLAN,
      success: planGenerated && stepsCount > 0,
      successRate: planGenerated && stepsCount > 0 ? 1 : 0,
      successCount: planGenerated ? 1 : 0,
      failureCount: planGenerated ? 0 : 1,
      skippedCount: 0,
      totalCount: 1,
      partialSuccess: false,
      criticalFailures: planGenerated ? [] : ['Failed to generate plan'],
      recoverableFailures: [],
      suggestions: planGenerated ? [] : ['Retry plan generation with simpler prompt'],
    };

    const decision = this.makeDecision(evaluation, SupervisorState.PLAN);
    this.logDecision(evaluation, decision);
    return decision;
  }

  /**
   * Evaluate execution results
   */
  private evaluateExecutionResults(results: ExecutionResult[]): PhaseEvaluation {
    const totalCount = results.length;
    const successCount = results.filter((r) => r.success).length;
    const failureCount = totalCount - successCount;
    const successRate = totalCount > 0 ? successCount / totalCount : 0;

    // Identify critical and recoverable failures
    const criticalFailures: string[] = [];
    const recoverableFailures: string[] = [];
    const suggestions: string[] = [];

    for (const result of results) {
      if (!result.success && result.error) {
        // Critical: compilation errors, syntax errors, type errors
        if (this.isCriticalError(result.error)) {
          criticalFailures.push(`Step ${result.stepIndex}: ${result.error}`);
        } else {
          recoverableFailures.push(`Step ${result.stepIndex}: ${result.error}`);
          suggestions.push(`Retry step ${result.stepIndex}`);
        }
      }
    }

    const partialSuccess =
      successRate >= this.config.thresholds.partialSuccessRate &&
      successRate < this.config.thresholds.minSuccessRate;

    return {
      phase: SupervisorState.EXECUTE,
      success: successRate >= this.config.thresholds.minSuccessRate,
      successRate,
      successCount,
      failureCount,
      skippedCount: 0,
      totalCount,
      partialSuccess,
      criticalFailures,
      recoverableFailures,
      suggestions,
    };
  }

  /**
   * Evaluate verification result
   */
  private evaluateVerificationResult(result: VerificationResult): PhaseEvaluation {
    const totalCount = result.criteriaResults.length;
    const successCount = result.criteriaResults.filter((c) => c.passed).length;
    const failureCount = totalCount - successCount;
    const successRate = totalCount > 0 ? successCount / totalCount : 0;

    // Identify critical and recoverable failures
    const criticalFailures: string[] = [];
    const recoverableFailures: string[] = [];

    for (const criterion of result.criteriaResults) {
      if (!criterion.passed) {
        if (this.isCriticalCriterion(criterion)) {
          criticalFailures.push(criterion.criterion);
        } else {
          recoverableFailures.push(criterion.criterion);
        }
      }
    }

    const partialSuccess =
      successRate >= this.config.thresholds.partialSuccessRate &&
      successRate < this.config.thresholds.minSuccessRate;

    return {
      phase: SupervisorState.VERIFY,
      success: result.passed,
      successRate,
      successCount,
      failureCount,
      skippedCount: 0,
      totalCount,
      partialSuccess,
      criticalFailures,
      recoverableFailures,
      suggestions: result.suggestions ?? [],
    };
  }

  /**
   * Make a decision based on evaluation
   */
  private makeDecision(
    evaluation: PhaseEvaluation,
    phase: SupervisorState,
  ): DecisionResult {
    const retryAttempt = this.retryCounters.get(phase) ?? 0;
    const maxRetries = this.config.thresholds.maxRetries;

    // Check for critical failures first
    if (evaluation.criticalFailures.length > this.config.thresholds.maxCriticalFailures) {
      return this.createDecision(
        DecisionOutcome.ABORT,
        `Critical failures exceeded threshold: ${evaluation.criticalFailures.join(', ')}`,
        evaluation,
        0.95,
        retryAttempt,
        maxRetries,
      );
    }

    // Full success - continue to next phase
    if (evaluation.success) {
      const suggestedState = this.getNextState(phase);
      return this.createDecision(
        phase === SupervisorState.VERIFY ? DecisionOutcome.COMPLETE : DecisionOutcome.CONTINUE,
        'All criteria met',
        evaluation,
        0.95,
        retryAttempt,
        maxRetries,
        suggestedState,
      );
    }

    // Partial success - check if acceptable
    if (evaluation.partialSuccess && this.config.allowPartialSuccess) {
      // For verification phase, partial success means iterate
      if (phase === SupervisorState.VERIFY) {
        return this.createDecision(
          DecisionOutcome.ITERATE,
          `Partial success (${Math.round(evaluation.successRate * 100)}%), needs improvement`,
          evaluation,
          0.7,
          retryAttempt,
          maxRetries,
          SupervisorState.ITERATE,
        );
      }

      // For execution phase, might continue if enough passed
      if (evaluation.successRate >= 0.7) {
        return this.createDecision(
          DecisionOutcome.CONTINUE,
          `Partial success accepted (${Math.round(evaluation.successRate * 100)}%)`,
          evaluation,
          0.6,
          retryAttempt,
          maxRetries,
          this.getNextState(phase),
        );
      }
    }

    // Check if retry is appropriate
    if (this.config.autoRetry && retryAttempt < maxRetries) {
      if (evaluation.recoverableFailures.length > 0 && evaluation.criticalFailures.length === 0) {
        this.retryCounters.set(phase, retryAttempt + 1);
        return this.createDecision(
          DecisionOutcome.RETRY,
          `Retrying due to recoverable failures (attempt ${retryAttempt + 1}/${maxRetries})`,
          evaluation,
          0.7,
          retryAttempt + 1,
          maxRetries,
        );
      }
    }

    // Verification failure - iterate
    if (phase === SupervisorState.VERIFY) {
      return this.createDecision(
        DecisionOutcome.ITERATE,
        `Verification failed: ${evaluation.recoverableFailures.join(', ')}`,
        evaluation,
        0.8,
        retryAttempt,
        maxRetries,
        SupervisorState.ITERATE,
      );
    }

    // Execution failure - could retry or abort
    if (retryAttempt >= maxRetries) {
      return this.createDecision(
        DecisionOutcome.ABORT,
        `Max retries (${maxRetries}) exceeded`,
        evaluation,
        0.9,
        retryAttempt,
        maxRetries,
      );
    }

    // Default to iterate for unknown scenarios
    return this.createDecision(
      DecisionOutcome.ITERATE,
      'Phase needs improvement',
      evaluation,
      0.5,
      retryAttempt,
      maxRetries,
      SupervisorState.ITERATE,
    );
  }

  /**
   * Create a decision result
   */
  private createDecision(
    outcome: DecisionOutcome,
    reason: string,
    evaluation: PhaseEvaluation,
    confidence: number,
    retryAttempt: number,
    maxRetries: number,
    suggestedState?: SupervisorState,
  ): DecisionResult {
    return {
      outcome,
      reason,
      evaluation,
      confidence,
      suggestedState,
      shouldRetry: outcome === DecisionOutcome.RETRY,
      retryAttempt,
      maxRetries,
      timestamp: new Date(),
    };
  }

  /**
   * Check if an error is critical
   */
  private isCriticalError(error: string): boolean {
    const criticalPatterns = [
      /syntax\s*error/i,
      /type\s*error/i,
      /compilation\s*failed/i,
      /cannot\s*find\s*module/i,
      /undefined\s*is\s*not/i,
      /null\s*reference/i,
      /permission\s*denied/i,
      /out\s*of\s*memory/i,
      /stack\s*overflow/i,
      /segmentation\s*fault/i,
    ];

    return criticalPatterns.some((pattern) => pattern.test(error));
  }

  /**
   * Check if a criterion is critical
   */
  private isCriticalCriterion(criterion: CriterionResult): boolean {
    const criticalKeywords = [
      'build',
      'compile',
      'type check',
      'typecheck',
      'syntax',
      'parse',
      'security',
      'critical',
    ];

    const criterionLower = criterion.criterion.toLowerCase();
    return criticalKeywords.some((keyword) => criterionLower.includes(keyword));
  }

  /**
   * Get the next state for a given phase
   */
  private getNextState(phase: SupervisorState): SupervisorState {
    const nextStateMap: Partial<Record<SupervisorState, SupervisorState>> = {
      [SupervisorState.PLAN]: SupervisorState.EXECUTE,
      [SupervisorState.EXECUTE]: SupervisorState.VERIFY,
      [SupervisorState.VERIFY]: SupervisorState.COMPLETE,
      [SupervisorState.ITERATE]: SupervisorState.EXECUTE,
    };

    return nextStateMap[phase] ?? SupervisorState.IDLE;
  }

  /**
   * Log a decision
   */
  private logDecision(evaluation: PhaseEvaluation, decision: DecisionResult): void {
    if (!this.config.enableLogging) return;

    const entry: DecisionLogEntry = {
      id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      phase: evaluation.phase,
      evaluation,
      decision,
      userConfirmed: false,
    };

    this.logs.push(entry);

    // Console logging based on level
    if (this.shouldLog('info')) {
      const status = decision.outcome === DecisionOutcome.COMPLETE ? '✓' :
                     decision.outcome === DecisionOutcome.ABORT ? '✗' : '→';
      console.log(
        `[Decision] ${status} ${evaluation.phase}: ${decision.outcome} - ${decision.reason}`
      );
    }

    if (this.shouldLog('debug')) {
      console.log(`[Decision Debug] Success rate: ${Math.round(evaluation.successRate * 100)}%`);
      console.log(`[Decision Debug] Confidence: ${Math.round(decision.confidence * 100)}%`);
    }
  }

  /**
   * Check if should log at level
   */
  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.config.logLevel);
  }

  /**
   * Get decision logs
   */
  getLogs(): DecisionLogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear decision logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Reset retry counters
   */
  resetRetries(): void {
    this.retryCounters.clear();
  }

  /**
   * Get retry count for a phase
   */
  getRetryCount(phase: SupervisorState): number {
    return this.retryCounters.get(phase) ?? 0;
  }

  /**
   * Check if decision requires user confirmation
   */
  requiresConfirmation(decision: DecisionResult): boolean {
    return this.config.requireConfirmation.includes(decision.outcome);
  }

  /**
   * Override a decision with user input
   */
  overrideDecision(
    logId: string,
    newOutcome: DecisionOutcome,
    reason: string,
  ): DecisionResult | null {
    const logEntry = this.logs.find((l) => l.id === logId);
    if (!logEntry) return null;

    logEntry.userConfirmed = true;
    logEntry.userOverride = newOutcome;

    return {
      ...logEntry.decision,
      outcome: newOutcome,
      reason: `User override: ${reason}`,
      confidence: 1.0,
    };
  }

  /**
   * Get summary statistics
   */
  getStatistics(): {
    totalDecisions: number;
    outcomeDistribution: Record<DecisionOutcome, number>;
    averageConfidence: number;
    totalRetries: number;
    abortCount: number;
    completeCount: number;
  } {
    const distribution: Record<DecisionOutcome, number> = {
      [DecisionOutcome.CONTINUE]: 0,
      [DecisionOutcome.RETRY]: 0,
      [DecisionOutcome.ITERATE]: 0,
      [DecisionOutcome.COMPLETE]: 0,
      [DecisionOutcome.ABORT]: 0,
      [DecisionOutcome.PAUSE]: 0,
    };

    let totalConfidence = 0;
    let totalRetries = 0;

    for (const log of this.logs) {
      distribution[log.decision.outcome]++;
      totalConfidence += log.decision.confidence;
      if (log.decision.shouldRetry) {
        totalRetries++;
      }
    }

    return {
      totalDecisions: this.logs.length,
      outcomeDistribution: distribution,
      averageConfidence: this.logs.length > 0 ? totalConfidence / this.logs.length : 0,
      totalRetries,
      abortCount: distribution[DecisionOutcome.ABORT],
      completeCount: distribution[DecisionOutcome.COMPLETE],
    };
  }
}

/**
 * Create a decision engine with configuration
 */
export function createDecisionEngine(config?: Partial<DecisionConfig>): DecisionEngine {
  return new DecisionEngine(config);
}
