/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionEngine, createDecisionEngine } from './decisionEngine.js';
import { DecisionOutcome } from './decisionConfig.js';
import { SupervisorState } from './types.js';
import type { ExecutionResult, VerificationResult } from './types.js';

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine({ enableLogging: false });
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      const defaultEngine = new DecisionEngine();
      expect(defaultEngine).toBeInstanceOf(DecisionEngine);
    });

    it('should accept custom config', () => {
      const custom = new DecisionEngine({
        thresholds: { minSuccessRate: 0.8 },
      });
      expect(custom).toBeInstanceOf(DecisionEngine);
    });
  });

  describe('evaluatePlan', () => {
    it('should return CONTINUE for successful plan', () => {
      const result = engine.evaluatePlan(true, 5);

      expect(result.outcome).toBe(DecisionOutcome.CONTINUE);
      expect(result.evaluation.success).toBe(true);
      expect(result.evaluation.successRate).toBe(1);
    });

    it('should return ABORT for failed plan', () => {
      const result = engine.evaluatePlan(false, 0);

      expect(result.outcome).toBe(DecisionOutcome.ABORT);
      expect(result.evaluation.success).toBe(false);
      expect(result.evaluation.criticalFailures).toContain('Failed to generate plan');
    });

    it('should fail when plan has no steps', () => {
      const result = engine.evaluatePlan(true, 0);

      // A plan with no steps is a failure but not necessarily abort-worthy
      // The decision engine will try to iterate
      expect(result.evaluation.success).toBe(false);
      expect([DecisionOutcome.ITERATE, DecisionOutcome.ABORT]).toContain(result.outcome);
    });
  });

  describe('evaluateExecution', () => {
    it('should return CONTINUE for all successful steps', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 1, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 2, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(decision.outcome).toBe(DecisionOutcome.CONTINUE);
      expect(decision.evaluation.successRate).toBe(1);
      expect(decision.evaluation.successCount).toBe(3);
    });

    it('should return RETRY for recoverable failures', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 1, success: false, error: 'Timeout error', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(decision.outcome).toBe(DecisionOutcome.RETRY);
      expect(decision.shouldRetry).toBe(true);
      expect(decision.retryAttempt).toBe(1);
    });

    it('should return ABORT for critical failures', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Syntax error: unexpected token', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(decision.outcome).toBe(DecisionOutcome.ABORT);
      expect(decision.evaluation.criticalFailures.length).toBeGreaterThan(0);
    });

    it('should identify type errors as critical', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Type Error: undefined is not a function', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(decision.outcome).toBe(DecisionOutcome.ABORT);
    });

    it('should handle empty results', () => {
      const decision = engine.evaluateExecution([]);

      expect(decision.evaluation.totalCount).toBe(0);
      expect(decision.evaluation.successRate).toBe(0);
    });

    it('should track partial success', () => {
      const engine = new DecisionEngine({
        enableLogging: false,
        thresholds: {
          minSuccessRate: 0.9,
          partialSuccessRate: 0.5,
          maxCriticalFailures: 0,
          maxRetries: 2,
          confidenceThreshold: 0.8,
        },
      });

      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 1, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 2, success: false, error: 'Network timeout', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      // 66% success rate is partial success (between 50% and 90%)
      expect(decision.evaluation.partialSuccess).toBe(true);
      expect(decision.evaluation.successRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('evaluateVerification', () => {
    it('should return COMPLETE for all criteria passed', () => {
      const result: VerificationResult = {
        passed: true,
        criteriaResults: [
          { criterion: 'Tests pass', passed: true },
          { criterion: 'Lint clean', passed: true },
        ],
        timestamp: new Date(),
      };

      const decision = engine.evaluateVerification(result);

      expect(decision.outcome).toBe(DecisionOutcome.COMPLETE);
      expect(decision.suggestedState).toBe(SupervisorState.COMPLETE);
    });

    it('should return ITERATE for failed criteria', () => {
      const result: VerificationResult = {
        passed: false,
        criteriaResults: [
          { criterion: 'Tests pass', passed: true },
          { criterion: 'Code coverage', passed: false, details: 'Below 80%' },
        ],
        suggestions: ['Increase test coverage'],
        timestamp: new Date(),
      };

      const decision = engine.evaluateVerification(result);

      expect(decision.outcome).toBe(DecisionOutcome.ITERATE);
      expect(decision.suggestedState).toBe(SupervisorState.ITERATE);
    });

    it('should identify critical criteria', () => {
      const result: VerificationResult = {
        passed: false,
        criteriaResults: [
          { criterion: 'Build compiles', passed: false, details: 'Build failed' },
        ],
        timestamp: new Date(),
      };

      const decision = engine.evaluateVerification(result);

      expect(decision.evaluation.criticalFailures.length).toBeGreaterThan(0);
    });

    it('should include suggestions from verification', () => {
      const result: VerificationResult = {
        passed: false,
        criteriaResults: [
          { criterion: 'Tests pass', passed: false },
        ],
        suggestions: ['Fix failing test in user.test.ts'],
        timestamp: new Date(),
      };

      const decision = engine.evaluateVerification(result);

      expect(decision.evaluation.suggestions).toContain('Fix failing test in user.test.ts');
    });
  });

  describe('retry logic', () => {
    it('should track retry attempts', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Network error', duration: 100, timestamp: new Date() },
      ];

      const decision1 = engine.evaluateExecution(results);
      expect(decision1.retryAttempt).toBe(1);

      const decision2 = engine.evaluateExecution(results);
      expect(decision2.retryAttempt).toBe(2);
    });

    it('should abort after max retries', () => {
      const engine = new DecisionEngine({
        enableLogging: false,
        thresholds: { maxRetries: 2 },
      });

      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Network error', duration: 100, timestamp: new Date() },
      ];

      engine.evaluateExecution(results); // retry 1
      engine.evaluateExecution(results); // retry 2
      const decision = engine.evaluateExecution(results); // max reached

      expect(decision.outcome).toBe(DecisionOutcome.ABORT);
      expect(decision.reason).toContain('Max retries');
    });

    it('should reset retries', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Network error', duration: 100, timestamp: new Date() },
      ];

      engine.evaluateExecution(results);
      expect(engine.getRetryCount(SupervisorState.EXECUTE)).toBe(1);

      engine.resetRetries();
      expect(engine.getRetryCount(SupervisorState.EXECUTE)).toBe(0);
    });
  });

  describe('decision logging', () => {
    it('should log decisions when enabled', () => {
      const loggingEngine = new DecisionEngine({ enableLogging: true, logLevel: 'error' });
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ];

      loggingEngine.evaluateExecution(results);

      const logs = loggingEngine.getLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].phase).toBe(SupervisorState.EXECUTE);
    });

    it('should not log when disabled', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ];

      engine.evaluateExecution(results);

      expect(engine.getLogs().length).toBe(0);
    });

    it('should clear logs', () => {
      const loggingEngine = new DecisionEngine({ enableLogging: true, logLevel: 'error' });
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ];

      loggingEngine.evaluateExecution(results);
      loggingEngine.clearLogs();

      expect(loggingEngine.getLogs().length).toBe(0);
    });
  });

  describe('user confirmation', () => {
    it('should require confirmation for abort', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Syntax error', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(engine.requiresConfirmation(decision)).toBe(true);
    });

    it('should not require confirmation for continue', () => {
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ];

      const decision = engine.evaluateExecution(results);

      expect(engine.requiresConfirmation(decision)).toBe(false);
    });

    it('should allow decision override', () => {
      const loggingEngine = new DecisionEngine({ enableLogging: true, logLevel: 'error' });
      const results: ExecutionResult[] = [
        { stepIndex: 0, success: false, error: 'Syntax error', duration: 100, timestamp: new Date() },
      ];

      loggingEngine.evaluateExecution(results);
      const logs = loggingEngine.getLogs();
      const logId = logs[0].id;

      const overridden = loggingEngine.overrideDecision(
        logId,
        DecisionOutcome.CONTINUE,
        'User says it is fine',
      );

      expect(overridden).not.toBeNull();
      expect(overridden!.outcome).toBe(DecisionOutcome.CONTINUE);
      expect(overridden!.confidence).toBe(1.0);
    });

    it('should return null for invalid log id', () => {
      const result = engine.overrideDecision('invalid', DecisionOutcome.CONTINUE, 'test');
      expect(result).toBeNull();
    });
  });

  describe('statistics', () => {
    it('should calculate statistics', () => {
      const loggingEngine = new DecisionEngine({ enableLogging: true, logLevel: 'error' });

      // Add some decisions
      loggingEngine.evaluateExecution([
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
      ]);

      loggingEngine.evaluatePlan(true, 3);

      const stats = loggingEngine.getStatistics();

      expect(stats.totalDecisions).toBe(2);
      expect(stats.outcomeDistribution[DecisionOutcome.CONTINUE]).toBe(2);
      expect(stats.averageConfidence).toBeGreaterThan(0);
    });

    it('should handle empty statistics', () => {
      const stats = engine.getStatistics();

      expect(stats.totalDecisions).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  describe('partial success handling', () => {
    it('should accept partial success when configured', () => {
      const partialEngine = new DecisionEngine({
        enableLogging: false,
        allowPartialSuccess: true,
        thresholds: {
          minSuccessRate: 1.0,
          partialSuccessRate: 0.5,
          maxCriticalFailures: 0,
          maxRetries: 2,
          confidenceThreshold: 0.8,
        },
      });

      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 1, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 2, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 3, success: false, error: 'Minor issue', duration: 100, timestamp: new Date() },
      ];

      const decision = partialEngine.evaluateExecution(results);

      // 75% success rate should be accepted with partial success
      expect(decision.outcome).toBe(DecisionOutcome.CONTINUE);
    });

    it('should reject when partial success is disabled', () => {
      const strictEngine = new DecisionEngine({
        enableLogging: false,
        allowPartialSuccess: false,
        autoRetry: false,
        thresholds: {
          minSuccessRate: 1.0,
          partialSuccessRate: 0.5,
          maxCriticalFailures: 0,
          maxRetries: 0,
          confidenceThreshold: 0.8,
        },
      });

      const results: ExecutionResult[] = [
        { stepIndex: 0, success: true, output: 'done', duration: 100, timestamp: new Date() },
        { stepIndex: 1, success: false, error: 'Minor issue', duration: 100, timestamp: new Date() },
      ];

      const decision = strictEngine.evaluateExecution(results);

      // Should not accept 50% success
      expect(decision.outcome).not.toBe(DecisionOutcome.CONTINUE);
    });
  });
});

describe('createDecisionEngine', () => {
  it('should create engine with factory function', () => {
    const engine = createDecisionEngine();
    expect(engine).toBeInstanceOf(DecisionEngine);
  });

  it('should pass config to factory', () => {
    const engine = createDecisionEngine({
      thresholds: { maxRetries: 5 },
    });
    expect(engine).toBeInstanceOf(DecisionEngine);
  });
});
