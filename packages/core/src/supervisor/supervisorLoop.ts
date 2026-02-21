/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskPlan,
  PlanStep,
  ExecutionResult,
  VerificationResult,
  CriterionResult,
  StateMachineConfig,
} from './types.js';
import { SupervisorState } from './types.js';
import { StateMachine } from './stateMachine.js';
import { StatePersistence } from './statePersistence.js';

/**
 * Phase handler function type
 */
export type PhaseHandler<T> = (context: PhaseContext) => Promise<T>;

/**
 * Progress callback
 */
export type ProgressCallback = (progress: ProgressReport) => void;

/**
 * Phase context passed to handlers
 */
export interface PhaseContext {
  /** Task description */
  task: string;
  /** Current iteration */
  iteration: number;
  /** Max iterations */
  maxIterations: number;
  /** Previous plan (for iterations) */
  previousPlan?: TaskPlan;
  /** Previous execution results (for iterations) */
  previousResults?: ExecutionResult[];
  /** Verification result (for iterations) */
  verificationResult?: VerificationResult;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Progress report
 */
export interface ProgressReport {
  /** Current state */
  state: SupervisorState;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current step description */
  message: string;
  /** Time elapsed in ms */
  elapsed: number;
  /** Iteration number */
  iteration: number;
  /** Details */
  details?: Record<string, unknown>;
}

/**
 * Supervisor loop configuration
 */
export interface SupervisorLoopConfig extends StateMachineConfig {
  /** Enable auto-persistence */
  autoPersist: boolean;
  /** Persistence interval in ms (0 = on state change only) */
  persistInterval: number;
  /** Enable progress reporting */
  enableProgress: boolean;
  /** Progress report interval in ms */
  progressInterval: number;
}

/**
 * Default loop configuration
 */
export const DEFAULT_LOOP_CONFIG: SupervisorLoopConfig = {
  maxIterations: 3,
  stateTimeouts: {
    [SupervisorState.PLAN]: 60000,
    [SupervisorState.EXECUTE]: 300000,
    [SupervisorState.VERIFY]: 60000,
    [SupervisorState.ITERATE]: 300000,
  },
  enablePersistence: true,
  autoPersist: true,
  persistInterval: 5000,
  enableProgress: true,
  progressInterval: 1000,
};

/**
 * Loop execution result
 */
export interface LoopResult {
  /** Success status */
  success: boolean;
  /** Final state */
  finalState: SupervisorState;
  /** Task plan */
  plan?: TaskPlan;
  /** Execution results */
  executionResults?: ExecutionResult[];
  /** Verification result */
  verificationResult?: VerificationResult;
  /** Iterations performed */
  iterations: number;
  /** Total duration in ms */
  duration: number;
  /** Error if failed */
  error?: Error;
}

/**
 * Supervisor Loop
 *
 * Orchestrates the Ralph Loop workflow:
 * IDLE → PLAN → EXECUTE → VERIFY → COMPLETE (or ITERATE → EXECUTE loop)
 */
export class SupervisorLoop {
  private machine: StateMachine;
  private config: SupervisorLoopConfig;
  private persistence: StatePersistence | null = null;

  // Phase handlers
  private planHandler: PhaseHandler<TaskPlan> | null = null;
  private executeHandler: PhaseHandler<ExecutionResult[]> | null = null;
  private verifyHandler: PhaseHandler<VerificationResult> | null = null;

  // Progress
  private progressCallbacks: ProgressCallback[] = [];
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private startTime: number = 0;

  // Persistence
  private persistInterval: ReturnType<typeof setInterval> | null = null;

  // Pause/resume state
  private isPaused: boolean = false;
  private pauseResolver: (() => void) | null = null;

  constructor(config: Partial<SupervisorLoopConfig> = {}) {
    this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
    this.machine = new StateMachine(this.config);

    if (this.config.enablePersistence) {
      this.persistence = new StatePersistence(this.config.persistencePath);
    }
  }

  /**
   * Set the plan phase handler
   */
  setPlanHandler(handler: PhaseHandler<TaskPlan>): void {
    this.planHandler = handler;
  }

  /**
   * Set the execute phase handler
   */
  setExecuteHandler(handler: PhaseHandler<ExecutionResult[]>): void {
    this.executeHandler = handler;
  }

  /**
   * Set the verify phase handler
   */
  setVerifyHandler(handler: PhaseHandler<VerificationResult>): void {
    this.verifyHandler = handler;
  }

  /**
   * Register a progress callback
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.push(callback);
    return () => {
      const index = this.progressCallbacks.indexOf(callback);
      if (index !== -1) {
        this.progressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get current state
   */
  getState(): SupervisorState {
    return this.machine.getState();
  }

  /**
   * Get state machine
   */
  getStateMachine(): StateMachine {
    return this.machine;
  }

  /**
   * Run the supervisor loop for a task
   */
  async run(task: string, metadata?: Record<string, unknown>): Promise<LoopResult> {
    // Validate handlers
    if (!this.planHandler || !this.executeHandler || !this.verifyHandler) {
      throw new Error('All phase handlers must be set before running');
    }

    this.startTime = Date.now();
    let plan: TaskPlan | undefined;
    let executionResults: ExecutionResult[] | undefined;
    let verificationResult: VerificationResult | undefined;

    try {
      // Start progress reporting
      this.startProgressReporting();

      // Start persistence
      this.startPersistence();

      // Initialize
      await this.machine.initialize(task, metadata);
      this.reportProgress('Starting planning phase');

      // Main loop
      while (!this.isTerminal()) {
        // Check for pause
        await this.checkPause();

        const state = this.machine.getState();

        switch (state) {
          case SupervisorState.PLAN:
            plan = await this.runPlanPhase(task, metadata);
            break;

          case SupervisorState.EXECUTE:
            executionResults = await this.runExecutePhase(task, plan!, metadata);
            break;

          case SupervisorState.VERIFY:
            verificationResult = await this.runVerifyPhase(
              task,
              plan!,
              executionResults!,
              metadata,
            );
            break;

          case SupervisorState.ITERATE:
            // Update context for iteration
            this.reportProgress(`Starting iteration ${this.machine.getTaskContext()?.iteration}`);
            await this.machine.startExecution();
            break;

          default:
            // Should not reach here for non-terminal states
            break;
        }
      }

      // Stop intervals
      this.stopProgressReporting();
      this.stopPersistence();

      // Clear persistence on success
      if (this.machine.getState() === SupervisorState.COMPLETE) {
        this.persistence?.clear();
      }

      return {
        success: this.machine.getState() === SupervisorState.COMPLETE,
        finalState: this.machine.getState(),
        plan,
        executionResults,
        verificationResult,
        iterations: this.machine.getTaskContext()?.iteration ?? 0,
        duration: Date.now() - this.startTime,
        error: this.machine.getTaskContext()?.error,
      };
    } catch (error) {
      // Stop intervals
      this.stopProgressReporting();
      this.stopPersistence();

      // Persist error state
      this.persistState();

      const err = error instanceof Error ? error : new Error(String(error));

      try {
        await this.machine.fail(err.message);
      } catch {
        // Ignore if already in terminal state
      }

      return {
        success: false,
        finalState: this.machine.getState(),
        plan,
        executionResults,
        verificationResult,
        iterations: this.machine.getTaskContext()?.iteration ?? 0,
        duration: Date.now() - this.startTime,
        error: err,
      };
    }
  }

  /**
   * Run plan phase
   */
  private async runPlanPhase(
    task: string,
    metadata?: Record<string, unknown>,
  ): Promise<TaskPlan> {
    this.reportProgress('Generating implementation plan');

    const context: PhaseContext = {
      task,
      iteration: this.machine.getTaskContext()?.iteration ?? 0,
      maxIterations: this.config.maxIterations,
      previousPlan: this.machine.getTaskContext()?.plan,
      previousResults: this.machine.getTaskContext()?.executionResults,
      verificationResult: this.machine.getTaskContext()?.verificationResult,
      metadata,
    };

    const plan = await this.planHandler!(context);

    // Store plan in task context
    const taskContext = this.machine.getTaskContext();
    if (taskContext) {
      taskContext.plan = plan;
    }

    this.reportProgress(`Plan generated with ${plan.steps.length} steps`);
    await this.machine.startExecution();

    return plan;
  }

  /**
   * Run execute phase
   */
  private async runExecutePhase(
    task: string,
    plan: TaskPlan,
    metadata?: Record<string, unknown>,
  ): Promise<ExecutionResult[]> {
    this.reportProgress('Executing plan');

    const context: PhaseContext = {
      task,
      iteration: this.machine.getTaskContext()?.iteration ?? 0,
      maxIterations: this.config.maxIterations,
      previousPlan: plan,
      metadata,
    };

    const results = await this.executeHandler!(context);

    // Store results in task context
    const taskContext = this.machine.getTaskContext();
    if (taskContext) {
      taskContext.executionResults = results;
    }

    const successCount = results.filter((r) => r.success).length;
    this.reportProgress(`Execution complete: ${successCount}/${results.length} steps succeeded`);
    await this.machine.startVerification();

    return results;
  }

  /**
   * Run verify phase
   */
  private async runVerifyPhase(
    task: string,
    plan: TaskPlan,
    results: ExecutionResult[],
    metadata?: Record<string, unknown>,
  ): Promise<VerificationResult> {
    this.reportProgress('Verifying results');

    const context: PhaseContext = {
      task,
      iteration: this.machine.getTaskContext()?.iteration ?? 0,
      maxIterations: this.config.maxIterations,
      previousPlan: plan,
      previousResults: results,
      metadata,
    };

    const verificationResult = await this.verifyHandler!(context);

    // Store verification result in task context
    const taskContext = this.machine.getTaskContext();
    if (taskContext) {
      taskContext.verificationResult = verificationResult;
    }

    if (verificationResult.passed) {
      this.reportProgress('Verification passed - task complete');
      await this.machine.complete();
    } else {
      const failedCriteria = verificationResult.criteriaResults.filter((c) => !c.passed).length;
      this.reportProgress(`Verification failed: ${failedCriteria} criteria not met`);
      await this.machine.iterate(
        verificationResult.suggestions?.join(', ') ?? 'Verification failed',
      );
    }

    return verificationResult;
  }

  /**
   * Check if in terminal state
   */
  private isTerminal(): boolean {
    const state = this.machine.getState();
    return state === SupervisorState.COMPLETE || state === SupervisorState.FAILED;
  }

  /**
   * Pause the loop
   */
  async pause(reason = 'Paused by user'): Promise<void> {
    if (this.isPaused) return;

    this.isPaused = true;
    await this.machine.pause(reason);
    this.reportProgress('Loop paused');
  }

  /**
   * Resume the loop
   */
  async resume(): Promise<void> {
    if (!this.isPaused) return;

    await this.machine.resume();
    this.isPaused = false;

    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }

    this.reportProgress('Loop resumed');
  }

  /**
   * Check for pause and wait if paused
   */
  private async checkPause(): Promise<void> {
    if (!this.isPaused) return;

    return new Promise<void>((resolve) => {
      this.pauseResolver = resolve;
    });
  }

  /**
   * Reset the loop
   */
  async reset(): Promise<void> {
    this.stopProgressReporting();
    this.stopPersistence();
    await this.machine.reset();
    this.isPaused = false;
    this.pauseResolver = null;
    this.persistence?.clear();
  }

  /**
   * Report progress
   */
  private reportProgress(message: string, details?: Record<string, unknown>): void {
    if (!this.config.enableProgress) return;

    const state = this.machine.getState();
    const iteration = this.machine.getTaskContext()?.iteration ?? 0;

    // Calculate percentage based on state
    const stateProgress: Record<SupervisorState, number> = {
      [SupervisorState.IDLE]: 0,
      [SupervisorState.PLAN]: 20,
      [SupervisorState.EXECUTE]: 50,
      [SupervisorState.VERIFY]: 80,
      [SupervisorState.ITERATE]: 40,
      [SupervisorState.COMPLETE]: 100,
      [SupervisorState.FAILED]: 100,
      [SupervisorState.PAUSED]: this.calculatePausedProgress(),
    };

    const report: ProgressReport = {
      state,
      percentage: stateProgress[state] ?? 0,
      message,
      elapsed: Date.now() - this.startTime,
      iteration,
      details,
    };

    for (const callback of this.progressCallbacks) {
      try {
        callback(report);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Calculate progress when paused
   */
  private calculatePausedProgress(): number {
    const previousState = this.machine.getPreviousState();
    if (!previousState) return 0;

    const stateProgress: Record<SupervisorState, number> = {
      [SupervisorState.IDLE]: 0,
      [SupervisorState.PLAN]: 20,
      [SupervisorState.EXECUTE]: 50,
      [SupervisorState.VERIFY]: 80,
      [SupervisorState.ITERATE]: 40,
      [SupervisorState.COMPLETE]: 100,
      [SupervisorState.FAILED]: 100,
      [SupervisorState.PAUSED]: 0,
    };

    return stateProgress[previousState] ?? 0;
  }

  /**
   * Start progress reporting interval
   */
  private startProgressReporting(): void {
    if (!this.config.enableProgress || this.config.progressInterval <= 0) return;

    this.progressInterval = setInterval(() => {
      this.reportProgress(`In ${this.machine.getStateDisplayName()} state`);
    }, this.config.progressInterval);
  }

  /**
   * Stop progress reporting
   */
  private stopProgressReporting(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Start persistence interval
   */
  private startPersistence(): void {
    if (!this.config.autoPersist || !this.persistence) return;

    // Register for state changes
    this.machine.onTransition(() => {
      this.persistState();
    });

    // Periodic persistence
    if (this.config.persistInterval > 0) {
      this.persistInterval = setInterval(() => {
        this.persistState();
      }, this.config.persistInterval);
    }
  }

  /**
   * Stop persistence
   */
  private stopPersistence(): void {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
      this.persistInterval = null;
    }
  }

  /**
   * Persist current state
   */
  private persistState(): void {
    if (!this.persistence) return;

    const persisted = this.machine.getPersistedState();
    if (persisted) {
      this.persistence.save(persisted);
    }
  }

  /**
   * Check if there's a recoverable state
   */
  hasRecoverableState(): boolean {
    if (!this.persistence) return false;
    return this.persistence.exists() && !this.persistence.isStale(24 * 60 * 60 * 1000);
  }

  /**
   * Recover from persisted state
   */
  async recover(): Promise<boolean> {
    if (!this.persistence || !this.hasRecoverableState()) return false;

    const persisted = this.persistence.load();
    if (!persisted) return false;

    await this.machine.restoreFromPersistedState(persisted);
    this.startTime = Date.now() - (Date.now() - persisted.persistedAt.getTime());

    return true;
  }

  /**
   * Get recovery info
   */
  getRecoveryInfo(): {
    exists: boolean;
    age: number | null;
    task?: string;
    state?: SupervisorState;
  } | null {
    if (!this.persistence) return null;

    if (!this.persistence.exists()) {
      return { exists: false, age: null };
    }

    const persisted = this.persistence.load();
    if (!persisted) {
      return { exists: false, age: null };
    }

    return {
      exists: true,
      age: this.persistence.getAge(),
      task: persisted.taskContext.description,
      state: persisted.currentState,
    };
  }
}

/**
 * Create a supervisor loop with default handlers for testing
 */
export function createSupervisorLoop(
  config?: Partial<SupervisorLoopConfig>,
): SupervisorLoop {
  return new SupervisorLoop(config);
}

/**
 * Create a simple plan from success criteria
 */
export function createSimplePlan(
  successCriteria: string[],
  steps: Array<{ description: string; type: PlanStep['type'] }>,
): TaskPlan {
  return {
    id: `plan_${Date.now()}`,
    steps: steps.map((step, index) => ({
      index,
      description: step.description,
      type: step.type,
      status: 'pending' as const,
    })),
    successCriteria,
    createdAt: new Date(),
  };
}

/**
 * Create execution results from step statuses
 */
export function createExecutionResults(
  stepResults: Array<{ success: boolean; output?: string; error?: string }>,
): ExecutionResult[] {
  return stepResults.map((result, index) => ({
    stepIndex: index,
    success: result.success,
    output: result.output,
    error: result.error,
    duration: 0,
    timestamp: new Date(),
  }));
}

/**
 * Create verification result from criteria checks
 */
export function createVerificationResult(
  criteriaResults: Array<{ criterion: string; passed: boolean; details?: string }>,
  suggestions?: string[],
): VerificationResult {
  return {
    passed: criteriaResults.every((c) => c.passed),
    criteriaResults: criteriaResults as CriterionResult[],
    suggestions,
    timestamp: new Date(),
  };
}
