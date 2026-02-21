/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateMachine, createStateMachine } from './stateMachine.js';
import { SupervisorState } from './types.js';

describe('StateMachine', () => {
  let machine: StateMachine;

  beforeEach(() => {
    machine = new StateMachine();
  });

  describe('constructor', () => {
    it('should create machine with default config', () => {
      expect(machine.getState()).toBe(SupervisorState.IDLE);
    });

    it('should accept custom config', () => {
      const custom = new StateMachine({ maxIterations: 5 });
      expect(custom.getState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      expect(machine.getState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('getStateDisplayName', () => {
    it('should return display name for current state', () => {
      expect(machine.getStateDisplayName()).toBe('Idle');
    });
  });

  describe('canTransitionTo', () => {
    it('should allow valid transitions', () => {
      expect(machine.canTransitionTo(SupervisorState.PLAN)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(machine.canTransitionTo(SupervisorState.EXECUTE)).toBe(false);
      expect(machine.canTransitionTo(SupervisorState.VERIFY)).toBe(false);
      expect(machine.canTransitionTo(SupervisorState.COMPLETE)).toBe(false);
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions from IDLE', () => {
      const valid = machine.getValidTransitions();
      expect(valid).toContain(SupervisorState.PLAN);
      expect(valid).toContain(SupervisorState.FAILED);
    });
  });

  describe('transition', () => {
    it('should transition to valid state', async () => {
      await machine.transition(SupervisorState.PLAN, 'Starting plan');
      expect(machine.getState()).toBe(SupervisorState.PLAN);
    });

    it('should reject invalid transition', async () => {
      await expect(
        machine.transition(SupervisorState.COMPLETE, 'Invalid'),
      ).rejects.toThrow('Invalid transition');
    });

    it('should record state history', async () => {
      await machine.transition(SupervisorState.PLAN, 'Test');
      const history = machine.getStateHistory();
      expect(history.length).toBe(1);
      expect(history[0].from).toBe(SupervisorState.IDLE);
      expect(history[0].to).toBe(SupervisorState.PLAN);
    });

    it('should set previous state', async () => {
      await machine.transition(SupervisorState.PLAN, 'Test');
      expect(machine.getPreviousState()).toBe(SupervisorState.IDLE);
    });
  });

  describe('initialize', () => {
    it('should initialize with task and transition to PLAN', async () => {
      await machine.initialize('Test task');
      expect(machine.getState()).toBe(SupervisorState.PLAN);
      expect(machine.getTaskContext()?.description).toBe('Test task');
    });

    it('should fail if not in IDLE state', async () => {
      await machine.initialize('First task');
      await expect(machine.initialize('Second task')).rejects.toThrow('Must be IDLE');
    });

    it('should set iteration to 0', async () => {
      await machine.initialize('Test');
      expect(machine.getTaskContext()?.iteration).toBe(0);
    });
  });

  describe('startExecution', () => {
    it('should transition from PLAN to EXECUTE', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      expect(machine.getState()).toBe(SupervisorState.EXECUTE);
    });

    it('should fail if not in PLAN or ITERATE', async () => {
      await expect(machine.startExecution()).rejects.toThrow();
    });
  });

  describe('startVerification', () => {
    it('should transition from EXECUTE to VERIFY', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.startVerification();
      expect(machine.getState()).toBe(SupervisorState.VERIFY);
    });

    it('should fail if not in EXECUTE', async () => {
      await machine.initialize('Test');
      await expect(machine.startVerification()).rejects.toThrow();
    });
  });

  describe('complete', () => {
    it('should transition from VERIFY to COMPLETE', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.startVerification();
      await machine.complete();
      expect(machine.getState()).toBe(SupervisorState.COMPLETE);
    });

    it('should fail if not in VERIFY', async () => {
      await machine.initialize('Test');
      await expect(machine.complete()).rejects.toThrow();
    });
  });

  describe('iterate', () => {
    it('should transition from VERIFY to ITERATE', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.startVerification();
      await machine.iterate('Test failed');
      expect(machine.getState()).toBe(SupervisorState.ITERATE);
    });

    it('should increment iteration counter', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.startVerification();
      await machine.iterate('Test failed');
      expect(machine.getTaskContext()?.iteration).toBe(1);
    });

    it('should fail when max iterations reached', async () => {
      const limitedMachine = new StateMachine({ maxIterations: 1 });
      await limitedMachine.initialize('Test');
      await limitedMachine.startExecution();
      await limitedMachine.startVerification();
      await limitedMachine.iterate('First iteration');
      // After max iterations, should transition to FAILED
      expect(limitedMachine.getState()).toBe(SupervisorState.FAILED);
    });
  });

  describe('fail', () => {
    it('should transition to FAILED', async () => {
      await machine.initialize('Test');
      await machine.fail('Critical error');
      expect(machine.getState()).toBe(SupervisorState.FAILED);
    });

    it('should set error in context', async () => {
      await machine.initialize('Test');
      await machine.fail('Critical error');
      expect(machine.getTaskContext()?.error?.message).toBe('Critical error');
    });

    it('should not fail from terminal state', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.startVerification();
      await machine.complete();
      await expect(machine.fail('Cannot fail')).rejects.toThrow('terminal state');
    });
  });

  describe('pause and resume', () => {
    it('should pause from active state', async () => {
      await machine.initialize('Test');
      await machine.pause('User paused');
      expect(machine.getState()).toBe(SupervisorState.PAUSED);
    });

    it('should not pause from IDLE', async () => {
      await expect(machine.pause()).rejects.toThrow('Cannot pause');
    });

    it('should resume to previous state', async () => {
      await machine.initialize('Test');
      await machine.pause('User paused');
      await machine.resume();
      expect(machine.getState()).toBe(SupervisorState.PLAN);
    });

    it('should not resume if not paused', async () => {
      await machine.initialize('Test');
      await expect(machine.resume()).rejects.toThrow('Cannot resume');
    });
  });

  describe('reset', () => {
    it('should reset to IDLE', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      await machine.reset();
      expect(machine.getState()).toBe(SupervisorState.IDLE);
      expect(machine.getTaskContext()).toBeNull();
      expect(machine.getStateHistory().length).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should call transition callbacks', async () => {
      const callback = vi.fn();
      machine.onTransition(callback);
      await machine.initialize('Test');
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].to).toBe(SupervisorState.PLAN);
    });

    it('should call entry callbacks', async () => {
      const callback = vi.fn();
      machine.onStateEntry(SupervisorState.PLAN, callback);
      await machine.initialize('Test');
      expect(callback).toHaveBeenCalledWith(SupervisorState.PLAN, undefined);
    });

    it('should call exit callbacks', async () => {
      const callback = vi.fn();
      machine.onStateExit(SupervisorState.IDLE, callback);
      await machine.initialize('Test');
      expect(callback).toHaveBeenCalledWith(SupervisorState.IDLE, SupervisorState.PLAN);
    });

    it('should unregister callbacks', async () => {
      const callback = vi.fn();
      const unregister = machine.onTransition(callback);
      unregister();
      await machine.initialize('Test');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('getTimeInCurrentState', () => {
    it('should return time in current state', async () => {
      await machine.initialize('Test');
      // Wait a bit
      await new Promise((r) => setTimeout(r, 10));
      const time = machine.getTimeInCurrentState();
      expect(time).toBeGreaterThan(0);
    });
  });

  describe('getPersistedState', () => {
    it('should return persisted state', async () => {
      await machine.initialize('Test');
      const persisted = machine.getPersistedState();
      expect(persisted).not.toBeNull();
      expect(persisted?.currentState).toBe(SupervisorState.PLAN);
      expect(persisted?.taskContext.description).toBe('Test');
    });

    it('should return null if no task', () => {
      expect(machine.getPersistedState()).toBeNull();
    });
  });

  describe('restoreFromPersistedState', () => {
    it('should restore state from persisted', async () => {
      await machine.initialize('Test');
      await machine.startExecution();
      const persisted = machine.getPersistedState()!;

      const newMachine = new StateMachine();
      await newMachine.restoreFromPersistedState(persisted);

      expect(newMachine.getState()).toBe(SupervisorState.EXECUTE);
      expect(newMachine.getTaskContext()?.description).toBe('Test');
    });
  });

  describe('full workflow', () => {
    it('should complete PLAN → EXECUTE → VERIFY → COMPLETE flow', async () => {
      await machine.initialize('Test task');
      expect(machine.getState()).toBe(SupervisorState.PLAN);

      await machine.startExecution();
      expect(machine.getState()).toBe(SupervisorState.EXECUTE);

      await machine.startVerification();
      expect(machine.getState()).toBe(SupervisorState.VERIFY);

      await machine.complete();
      expect(machine.getState()).toBe(SupervisorState.COMPLETE);

      const history = machine.getStateHistory();
      expect(history.length).toBe(4);
    });

    it('should handle iteration loop', async () => {
      await machine.initialize('Test task');
      await machine.startExecution();
      await machine.startVerification();
      await machine.iterate('Test failed');
      expect(machine.getState()).toBe(SupervisorState.ITERATE);

      await machine.startExecution();
      expect(machine.getState()).toBe(SupervisorState.EXECUTE);

      await machine.startVerification();
      await machine.complete();
      expect(machine.getState()).toBe(SupervisorState.COMPLETE);
    });
  });

  describe('createStateMachine', () => {
    it('should create machine with factory function', () => {
      const m = createStateMachine();
      expect(m).toBeInstanceOf(StateMachine);
    });

    it('should pass config to factory', () => {
      const m = createStateMachine({ maxIterations: 5 });
      expect(m).toBeInstanceOf(StateMachine);
    });
  });
});
