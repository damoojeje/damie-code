/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  StateTransition,
  StateTransitionCallback,
  StateEntryCallback,
  StateExitCallback,
  TaskContext,
  StateMachineConfig,
  PersistedState,
} from './types.js';
import {
  SupervisorState,
  DEFAULT_STATE_MACHINE_CONFIG,
} from './types.js';
import {
  isValidTransition,
  getValidTransitions,
  isTerminalState,
  canPause,
  STATE_DISPLAY_NAMES,
} from './transitions.js';

/**
 * State Machine for Supervisor Loop
 *
 * Manages state transitions following the Ralph Loop methodology:
 * IDLE → PLAN → EXECUTE → VERIFY → COMPLETE (or ITERATE → EXECUTE loop)
 */
export class StateMachine {
  private currentState: SupervisorState = SupervisorState.IDLE;
  private previousState: SupervisorState | null = null;
  private stateHistory: StateTransition[] = [];
  private taskContext: TaskContext | null = null;
  private config: StateMachineConfig;

  // Callbacks
  private transitionCallbacks: StateTransitionCallback[] = [];
  private entryCallbacks: Map<SupervisorState, StateEntryCallback[]> = new Map();
  private exitCallbacks: Map<SupervisorState, StateExitCallback[]> = new Map();

  // Timeout handling
  private stateTimeout: ReturnType<typeof setTimeout> | null = null;
  private stateEnteredAt: Date | null = null;

  constructor(config: Partial<StateMachineConfig> = {}) {
    this.config = { ...DEFAULT_STATE_MACHINE_CONFIG, ...config };
  }

  /**
   * Get current state
   */
  getState(): SupervisorState {
    return this.currentState;
  }

  /**
   * Get previous state
   */
  getPreviousState(): SupervisorState | null {
    return this.previousState;
  }

  /**
   * Get state display name
   */
  getStateDisplayName(): string {
    return STATE_DISPLAY_NAMES[this.currentState];
  }

  /**
   * Get state history
   */
  getStateHistory(): StateTransition[] {
    return [...this.stateHistory];
  }

  /**
   * Get task context
   */
  getTaskContext(): TaskContext | null {
    return this.taskContext;
  }

  /**
   * Check if can transition to a state
   */
  canTransitionTo(targetState: SupervisorState): boolean {
    return isValidTransition(this.currentState, targetState);
  }

  /**
   * Get valid transitions from current state
   */
  getValidTransitions(): SupervisorState[] {
    return getValidTransitions(this.currentState);
  }

  /**
   * Transition to a new state
   */
  async transition(
    targetState: SupervisorState,
    reason: string,
    context?: Record<string, unknown>,
  ): Promise<boolean> {
    // Validate transition
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `Invalid transition from ${this.currentState} to ${targetState}. ` +
        `Valid transitions: ${this.getValidTransitions().join(', ')}`,
      );
    }

    // Clear existing timeout
    this.clearTimeout();

    // Create transition record
    const transition: StateTransition = {
      from: this.currentState,
      to: targetState,
      reason,
      timestamp: new Date(),
      context,
    };

    // Call exit callbacks for current state
    await this.callExitCallbacks(this.currentState, targetState);

    // Update state
    this.previousState = this.currentState;
    this.currentState = targetState;
    this.stateHistory.push(transition);
    this.stateEnteredAt = new Date();

    // Call entry callbacks for new state
    await this.callEntryCallbacks(targetState, context);

    // Call transition callbacks
    await this.callTransitionCallbacks(transition);

    // Set up timeout for new state
    this.setupTimeout(targetState);

    // Update task context
    if (this.taskContext) {
      this.taskContext.updatedAt = new Date();
    }

    return true;
  }

  /**
   * Initialize with a task
   */
  async initialize(task: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.currentState !== SupervisorState.IDLE) {
      throw new Error(`Cannot initialize in state ${this.currentState}. Must be IDLE.`);
    }

    this.taskContext = {
      id: this.generateTaskId(),
      description: task,
      iteration: 0,
      maxIterations: this.config.maxIterations,
      startedAt: new Date(),
      updatedAt: new Date(),
      metadata,
    };

    await this.transition(SupervisorState.PLAN, 'Task initialized, starting planning');
  }

  /**
   * Start execution phase
   */
  async startExecution(): Promise<void> {
    if (this.currentState !== SupervisorState.PLAN && this.currentState !== SupervisorState.ITERATE) {
      throw new Error(`Cannot start execution from state ${this.currentState}`);
    }

    await this.transition(SupervisorState.EXECUTE, 'Plan ready, starting execution');
  }

  /**
   * Start verification phase
   */
  async startVerification(): Promise<void> {
    if (this.currentState !== SupervisorState.EXECUTE) {
      throw new Error(`Cannot start verification from state ${this.currentState}`);
    }

    await this.transition(SupervisorState.VERIFY, 'Execution complete, starting verification');
  }

  /**
   * Mark as complete
   */
  async complete(): Promise<void> {
    if (this.currentState !== SupervisorState.VERIFY) {
      throw new Error(`Cannot complete from state ${this.currentState}`);
    }

    await this.transition(SupervisorState.COMPLETE, 'Verification passed, task complete');
  }

  /**
   * Start iteration (when verification fails)
   */
  async iterate(reason: string): Promise<void> {
    if (this.currentState !== SupervisorState.VERIFY) {
      throw new Error(`Cannot iterate from state ${this.currentState}`);
    }

    if (this.taskContext) {
      this.taskContext.iteration++;
      if (this.taskContext.iteration >= this.taskContext.maxIterations) {
        await this.fail(`Max iterations (${this.taskContext.maxIterations}) reached`);
        return;
      }
    }

    await this.transition(SupervisorState.ITERATE, reason);
  }

  /**
   * Mark as failed
   */
  async fail(reason: string): Promise<void> {
    if (isTerminalState(this.currentState)) {
      throw new Error(`Cannot fail from terminal state ${this.currentState}`);
    }

    if (this.taskContext) {
      this.taskContext.error = new Error(reason);
    }

    await this.transition(SupervisorState.FAILED, reason);
  }

  /**
   * Pause the current task
   */
  async pause(reason = 'Paused by user'): Promise<void> {
    if (!canPause(this.currentState)) {
      throw new Error(`Cannot pause from state ${this.currentState}`);
    }

    await this.transition(SupervisorState.PAUSED, reason, {
      pausedFrom: this.currentState,
    });
  }

  /**
   * Resume from pause
   */
  async resume(): Promise<void> {
    if (this.currentState !== SupervisorState.PAUSED) {
      throw new Error(`Cannot resume from state ${this.currentState}`);
    }

    const pausedFrom = this.stateHistory
      .filter((t) => t.to === SupervisorState.PAUSED)
      .pop()?.context?.['pausedFrom'] as SupervisorState | undefined;

    if (!pausedFrom) {
      throw new Error('Cannot determine state to resume to');
    }

    await this.transition(pausedFrom, 'Resumed from pause');
  }

  /**
   * Reset to idle state
   */
  async reset(): Promise<void> {
    this.clearTimeout();
    this.currentState = SupervisorState.IDLE;
    this.previousState = null;
    this.stateHistory = [];
    this.taskContext = null;
    this.stateEnteredAt = null;
  }

  /**
   * Register a transition callback
   */
  onTransition(callback: StateTransitionCallback): () => void {
    this.transitionCallbacks.push(callback);
    return () => {
      const index = this.transitionCallbacks.indexOf(callback);
      if (index !== -1) {
        this.transitionCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Register a state entry callback
   */
  onStateEntry(state: SupervisorState, callback: StateEntryCallback): () => void {
    if (!this.entryCallbacks.has(state)) {
      this.entryCallbacks.set(state, []);
    }
    this.entryCallbacks.get(state)!.push(callback);
    return () => {
      const callbacks = this.entryCallbacks.get(state);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Register a state exit callback
   */
  onStateExit(state: SupervisorState, callback: StateExitCallback): () => void {
    if (!this.exitCallbacks.has(state)) {
      this.exitCallbacks.set(state, []);
    }
    this.exitCallbacks.get(state)!.push(callback);
    return () => {
      const callbacks = this.exitCallbacks.get(state);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get time spent in current state (ms)
   */
  getTimeInCurrentState(): number {
    if (!this.stateEnteredAt) return 0;
    return Date.now() - this.stateEnteredAt.getTime();
  }

  /**
   * Check if current state has timed out
   */
  isTimedOut(): boolean {
    const timeout = this.config.stateTimeouts[this.currentState];
    if (!timeout) return false;
    return this.getTimeInCurrentState() > timeout;
  }

  /**
   * Get persisted state for recovery
   */
  getPersistedState(): PersistedState | null {
    if (!this.taskContext) return null;

    return {
      taskContext: this.taskContext,
      currentState: this.currentState,
      stateHistory: this.stateHistory,
      persistedAt: new Date(),
      version: '1.0.0',
    };
  }

  /**
   * Restore from persisted state
   */
  async restoreFromPersistedState(persisted: PersistedState): Promise<void> {
    this.taskContext = persisted.taskContext;
    this.currentState = persisted.currentState;
    this.stateHistory = persisted.stateHistory;
    this.stateEnteredAt = new Date();

    // Set up timeout for restored state
    this.setupTimeout(this.currentState);
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Call transition callbacks
   */
  private async callTransitionCallbacks(transition: StateTransition): Promise<void> {
    for (const callback of this.transitionCallbacks) {
      await callback(transition);
    }
  }

  /**
   * Call entry callbacks for a state
   */
  private async callEntryCallbacks(
    state: SupervisorState,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const callbacks = this.entryCallbacks.get(state) ?? [];
    for (const callback of callbacks) {
      await callback(state, context);
    }
  }

  /**
   * Call exit callbacks for a state
   */
  private async callExitCallbacks(
    state: SupervisorState,
    nextState: SupervisorState,
  ): Promise<void> {
    const callbacks = this.exitCallbacks.get(state) ?? [];
    for (const callback of callbacks) {
      await callback(state, nextState);
    }
  }

  /**
   * Set up timeout for a state
   */
  private setupTimeout(state: SupervisorState): void {
    const timeout = this.config.stateTimeouts[state];
    if (!timeout || timeout <= 0) return;

    this.stateTimeout = setTimeout(async () => {
      if (this.currentState === state && !isTerminalState(state)) {
        try {
          await this.fail(`State ${state} timed out after ${timeout}ms`);
        } catch {
          // Ignore errors in timeout handler
        }
      }
    }, timeout);
  }

  /**
   * Clear current timeout
   */
  private clearTimeout(): void {
    if (this.stateTimeout) {
      clearTimeout(this.stateTimeout);
      this.stateTimeout = null;
    }
  }
}

/**
 * Create a state machine with optional configuration
 */
export function createStateMachine(config?: Partial<StateMachineConfig>): StateMachine {
  return new StateMachine(config);
}
