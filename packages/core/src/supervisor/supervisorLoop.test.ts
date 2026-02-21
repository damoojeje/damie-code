/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  SupervisorLoop,
  createSupervisorLoop,
  createSimplePlan,
  createExecutionResults,
  createVerificationResult,
} from './supervisorLoop.js';
import type { PhaseContext } from './supervisorLoop.js';
import { SupervisorState } from './types.js';
import type { TaskPlan, ExecutionResult, VerificationResult } from './types.js';

describe('SupervisorLoop', () => {
  let loop: SupervisorLoop;

  // Test handlers
  const createMockPlanHandler = (plan: TaskPlan) =>
    vi.fn().mockResolvedValue(plan);

  const createMockExecuteHandler = (results: ExecutionResult[]) =>
    vi.fn().mockResolvedValue(results);

  const createMockVerifyHandler = (result: VerificationResult) =>
    vi.fn().mockResolvedValue(result);

  // Default successful handlers
  const successPlan = createSimplePlan(
    ['Code compiles', 'Tests pass'],
    [
      { description: 'Write code', type: 'code' },
      { description: 'Run tests', type: 'test' },
    ],
  );

  const successResults = createExecutionResults([
    { success: true, output: 'Code written' },
    { success: true, output: 'Tests passed' },
  ]);

  const successVerification = createVerificationResult([
    { criterion: 'Code compiles', passed: true },
    { criterion: 'Tests pass', passed: true },
  ]);

  beforeEach(() => {
    loop = new SupervisorLoop({ enablePersistence: false, enableProgress: false });
  });

  afterEach(async () => {
    await loop.reset();
  });

  describe('constructor', () => {
    it('should create loop with default config', () => {
      const defaultLoop = new SupervisorLoop();
      expect(defaultLoop.getState()).toBe(SupervisorState.IDLE);
    });

    it('should accept custom config', () => {
      const custom = new SupervisorLoop({ maxIterations: 5 });
      expect(custom.getState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('handler registration', () => {
    it('should set plan handler', () => {
      const handler = createMockPlanHandler(successPlan);
      loop.setPlanHandler(handler);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should set execute handler', () => {
      const handler = createMockExecuteHandler(successResults);
      loop.setExecuteHandler(handler);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should set verify handler', () => {
      const handler = createMockVerifyHandler(successVerification);
      loop.setVerifyHandler(handler);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('should fail if handlers not set', async () => {
      await expect(loop.run('test task')).rejects.toThrow('handlers must be set');
    });

    it('should complete successfully with passing verification', async () => {
      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const result = await loop.run('test task');

      expect(result.success).toBe(true);
      expect(result.finalState).toBe(SupervisorState.COMPLETE);
      expect(result.plan).toBeDefined();
      expect(result.executionResults).toBeDefined();
      expect(result.verificationResult).toBeDefined();
      expect(result.iterations).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should call handlers with correct context', async () => {
      const planHandler = createMockPlanHandler(successPlan);
      const executeHandler = createMockExecuteHandler(successResults);
      const verifyHandler = createMockVerifyHandler(successVerification);

      loop.setPlanHandler(planHandler);
      loop.setExecuteHandler(executeHandler);
      loop.setVerifyHandler(verifyHandler);

      await loop.run('test task', { custom: 'data' });

      expect(planHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'test task',
          iteration: 0,
          metadata: { custom: 'data' },
        }),
      );

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'test task',
          iteration: 0,
        }),
      );

      expect(verifyHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'test task',
          iteration: 0,
        }),
      );
    });

    it('should iterate when verification fails', async () => {
      const failVerification = createVerificationResult(
        [{ criterion: 'Tests pass', passed: false, details: 'Test failed' }],
        ['Fix the failing test'],
      );

      const passVerification = createVerificationResult([
        { criterion: 'Tests pass', passed: true },
      ]);

      let verifyCallCount = 0;
      const verifyHandler = vi.fn().mockImplementation(() => {
        verifyCallCount++;
        return Promise.resolve(verifyCallCount === 1 ? failVerification : passVerification);
      });

      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(verifyHandler);

      const result = await loop.run('test task');

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
      expect(verifyHandler).toHaveBeenCalledTimes(2);
    });

    it('should fail after max iterations', async () => {
      const failVerification = createVerificationResult(
        [{ criterion: 'Tests pass', passed: false }],
        ['Fix tests'],
      );

      loop = new SupervisorLoop({
        maxIterations: 2,
        enablePersistence: false,
        enableProgress: false,
      });

      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(failVerification));

      const result = await loop.run('test task');

      expect(result.success).toBe(false);
      expect(result.finalState).toBe(SupervisorState.FAILED);
    });

    it('should fail if plan handler throws', async () => {
      loop.setPlanHandler(vi.fn().mockRejectedValue(new Error('Plan failed')));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const result = await loop.run('test task');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Plan failed');
    });

    it('should fail if execute handler throws', async () => {
      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(vi.fn().mockRejectedValue(new Error('Execute failed')));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const result = await loop.run('test task');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Execute failed');
    });

    it('should fail if verify handler throws', async () => {
      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(vi.fn().mockRejectedValue(new Error('Verify failed')));

      const result = await loop.run('test task');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Verify failed');
    });
  });

  describe('pause and resume', () => {
    it('should pause the loop', async () => {
      let planResolve: () => void;
      const planPromise = new Promise<void>((resolve) => {
        planResolve = resolve;
      });

      // Slow plan handler that waits to be resolved
      loop.setPlanHandler(async () => {
        await planPromise;
        return successPlan;
      });
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      // Start run in background
      const runPromise = loop.run('test task');

      // Wait for initialization and transition to PLAN
      await new Promise((r) => setTimeout(r, 10));

      // Pause during PLAN phase
      await loop.pause('Test pause');
      expect(loop.getState()).toBe(SupervisorState.PAUSED);

      // Resume
      await loop.resume();
      expect(loop.getState()).not.toBe(SupervisorState.PAUSED);

      // Let plan complete
      planResolve!();
      await runPromise;
    });

    it('should not pause if already paused', async () => {
      let planResolve: () => void;
      const planPromise = new Promise<void>((resolve) => {
        planResolve = resolve;
      });

      loop.setPlanHandler(async () => {
        await planPromise;
        return successPlan;
      });
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const runPromise = loop.run('test task');
      await new Promise((r) => setTimeout(r, 10));

      await loop.pause();
      const firstState = loop.getState();

      await loop.pause(); // Second pause should be no-op
      expect(loop.getState()).toBe(firstState);

      await loop.resume();
      planResolve!();
      await runPromise;
    });

    it('should not resume if not paused', async () => {
      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const runPromise = loop.run('test task');
      await new Promise((r) => setTimeout(r, 10));

      const state = loop.getState();
      await loop.resume(); // Should be no-op
      expect(loop.getState()).toBe(state);

      await runPromise;
    });
  });

  describe('progress reporting', () => {
    it('should call progress callback', async () => {
      const progressLoop = new SupervisorLoop({
        enablePersistence: false,
        enableProgress: true,
        progressInterval: 0, // Disable interval
      });

      progressLoop.setPlanHandler(createMockPlanHandler(successPlan));
      progressLoop.setExecuteHandler(createMockExecuteHandler(successResults));
      progressLoop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const progressCallback = vi.fn();
      progressLoop.onProgress(progressCallback);

      await progressLoop.run('test task');

      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('state');
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('percentage');
      expect(progressCallback.mock.calls[0][0]).toHaveProperty('message');
    });

    it('should unregister progress callback', async () => {
      const progressLoop = new SupervisorLoop({
        enablePersistence: false,
        enableProgress: true,
        progressInterval: 0,
      });

      progressLoop.setPlanHandler(createMockPlanHandler(successPlan));
      progressLoop.setExecuteHandler(createMockExecuteHandler(successResults));
      progressLoop.setVerifyHandler(createMockVerifyHandler(successVerification));

      const progressCallback = vi.fn();
      const unregister = progressLoop.onProgress(progressCallback);
      unregister();

      await progressLoop.run('test task');

      expect(progressCallback).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      loop.setPlanHandler(createMockPlanHandler(successPlan));
      loop.setExecuteHandler(createMockExecuteHandler(successResults));
      loop.setVerifyHandler(createMockVerifyHandler(successVerification));

      await loop.run('test task');
      await loop.reset();

      expect(loop.getState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('getStateMachine', () => {
    it('should return the state machine', () => {
      const machine = loop.getStateMachine();
      expect(machine).toBeDefined();
      expect(machine.getState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('recovery', () => {
    it('should report no recoverable state when persistence disabled', () => {
      expect(loop.hasRecoverableState()).toBe(false);
    });

    it('should return null recovery info when persistence disabled', () => {
      expect(loop.getRecoveryInfo()).toBeNull();
    });
  });
});

describe('createSupervisorLoop', () => {
  it('should create loop with factory function', () => {
    const loop = createSupervisorLoop();
    expect(loop).toBeInstanceOf(SupervisorLoop);
  });

  it('should pass config to factory', () => {
    const loop = createSupervisorLoop({ maxIterations: 5 });
    expect(loop).toBeInstanceOf(SupervisorLoop);
  });
});

describe('createSimplePlan', () => {
  it('should create plan with steps', () => {
    const plan = createSimplePlan(
      ['Criterion 1', 'Criterion 2'],
      [
        { description: 'Step 1', type: 'code' },
        { description: 'Step 2', type: 'test' },
      ],
    );

    expect(plan.id).toMatch(/^plan_/);
    expect(plan.successCriteria).toEqual(['Criterion 1', 'Criterion 2']);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].description).toBe('Step 1');
    expect(plan.steps[0].type).toBe('code');
    expect(plan.steps[0].status).toBe('pending');
    expect(plan.steps[1].index).toBe(1);
  });
});

describe('createExecutionResults', () => {
  it('should create execution results', () => {
    const results = createExecutionResults([
      { success: true, output: 'Done' },
      { success: false, error: 'Failed' },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].stepIndex).toBe(0);
    expect(results[0].success).toBe(true);
    expect(results[0].output).toBe('Done');
    expect(results[1].stepIndex).toBe(1);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('Failed');
  });
});

describe('createVerificationResult', () => {
  it('should create passing verification result', () => {
    const result = createVerificationResult([
      { criterion: 'Test 1', passed: true },
      { criterion: 'Test 2', passed: true },
    ]);

    expect(result.passed).toBe(true);
    expect(result.criteriaResults).toHaveLength(2);
  });

  it('should create failing verification result', () => {
    const result = createVerificationResult(
      [
        { criterion: 'Test 1', passed: true },
        { criterion: 'Test 2', passed: false, details: 'Failed check' },
      ],
      ['Fix test 2'],
    );

    expect(result.passed).toBe(false);
    expect(result.suggestions).toEqual(['Fix test 2']);
  });
});

describe('PhaseContext', () => {
  it('should provide previous context on iteration', async () => {
    const failVerification = createVerificationResult(
      [{ criterion: 'Test', passed: false }],
      ['Fix it'],
    );
    const passVerification = createVerificationResult([{ criterion: 'Test', passed: true }]);

    let verifyCount = 0;
    const contexts: PhaseContext[] = [];

    const loop = new SupervisorLoop({
      enablePersistence: false,
      enableProgress: false,
    });

    loop.setPlanHandler(async (ctx) => {
      contexts.push({ ...ctx });
      return createSimplePlan(['Test'], [{ description: 'Do it', type: 'code' }]);
    });

    loop.setExecuteHandler(async (ctx) => {
      contexts.push({ ...ctx });
      return createExecutionResults([{ success: true }]);
    });

    loop.setVerifyHandler(async (ctx) => {
      contexts.push({ ...ctx });
      verifyCount++;
      return verifyCount === 1 ? failVerification : passVerification;
    });

    await loop.run('test task');

    // Should have contexts from both iterations
    // First iteration: plan, execute, verify
    // Second iteration: execute, verify (plan handler not called again after ITERATE)
    expect(contexts.length).toBeGreaterThanOrEqual(3);

    // Second iteration should have iteration = 1
    const secondIterationContexts = contexts.filter((c) => c.iteration === 1);
    expect(secondIterationContexts.length).toBeGreaterThan(0);
  });
});
