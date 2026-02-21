/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupervisorState } from './types.js';

/**
 * Valid state transitions map
 *
 * Defines which states can transition to which other states.
 * This enforces the Ralph Loop methodology:
 *
 * Normal flow: IDLE → PLAN → EXECUTE → VERIFY → COMPLETE
 * Iteration:   VERIFY → ITERATE → EXECUTE → VERIFY
 * Failure:     Any → FAILED
 * Pause:       Any (except COMPLETE/FAILED) → PAUSED
 * Resume:      PAUSED → Previous state
 */
export const VALID_TRANSITIONS: Record<SupervisorState, SupervisorState[]> = {
  [SupervisorState.IDLE]: [
    SupervisorState.PLAN,
    SupervisorState.FAILED,
  ],

  [SupervisorState.PLAN]: [
    SupervisorState.EXECUTE,
    SupervisorState.FAILED,
    SupervisorState.PAUSED,
  ],

  [SupervisorState.EXECUTE]: [
    SupervisorState.VERIFY,
    SupervisorState.FAILED,
    SupervisorState.PAUSED,
  ],

  [SupervisorState.VERIFY]: [
    SupervisorState.COMPLETE,
    SupervisorState.ITERATE,
    SupervisorState.FAILED,
    SupervisorState.PAUSED,
  ],

  [SupervisorState.ITERATE]: [
    SupervisorState.EXECUTE,
    SupervisorState.FAILED,
    SupervisorState.PAUSED,
  ],

  [SupervisorState.COMPLETE]: [
    // Terminal state - can only go back to IDLE for new task
    SupervisorState.IDLE,
  ],

  [SupervisorState.FAILED]: [
    // Terminal state - can only go back to IDLE for new task
    SupervisorState.IDLE,
  ],

  [SupervisorState.PAUSED]: [
    // Can resume to any working state
    SupervisorState.PLAN,
    SupervisorState.EXECUTE,
    SupervisorState.VERIFY,
    SupervisorState.ITERATE,
    // Or fail/complete from paused
    SupervisorState.FAILED,
    SupervisorState.IDLE,
  ],
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: SupervisorState, to: SupervisorState): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets?.includes(to) ?? false;
}

/**
 * Get all valid transitions from a state
 */
export function getValidTransitions(from: SupervisorState): SupervisorState[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/**
 * Check if state is terminal (COMPLETE or FAILED)
 */
export function isTerminalState(state: SupervisorState): boolean {
  return state === SupervisorState.COMPLETE || state === SupervisorState.FAILED;
}

/**
 * Check if state is active (can be worked on)
 */
export function isActiveState(state: SupervisorState): boolean {
  return [
    SupervisorState.PLAN,
    SupervisorState.EXECUTE,
    SupervisorState.VERIFY,
    SupervisorState.ITERATE,
  ].includes(state);
}

/**
 * Check if state can be paused
 */
export function canPause(state: SupervisorState): boolean {
  return isActiveState(state);
}

/**
 * Get the expected next state in normal flow
 */
export function getNextState(current: SupervisorState): SupervisorState | null {
  const normalFlow: Record<SupervisorState, SupervisorState | null> = {
    [SupervisorState.IDLE]: SupervisorState.PLAN,
    [SupervisorState.PLAN]: SupervisorState.EXECUTE,
    [SupervisorState.EXECUTE]: SupervisorState.VERIFY,
    [SupervisorState.VERIFY]: SupervisorState.COMPLETE,
    [SupervisorState.ITERATE]: SupervisorState.EXECUTE,
    [SupervisorState.COMPLETE]: null,
    [SupervisorState.FAILED]: null,
    [SupervisorState.PAUSED]: null,
  };
  return normalFlow[current];
}

/**
 * State display names
 */
export const STATE_DISPLAY_NAMES: Record<SupervisorState, string> = {
  [SupervisorState.IDLE]: 'Idle',
  [SupervisorState.PLAN]: 'Planning',
  [SupervisorState.EXECUTE]: 'Executing',
  [SupervisorState.VERIFY]: 'Verifying',
  [SupervisorState.ITERATE]: 'Iterating',
  [SupervisorState.COMPLETE]: 'Complete',
  [SupervisorState.FAILED]: 'Failed',
  [SupervisorState.PAUSED]: 'Paused',
};

/**
 * State descriptions
 */
export const STATE_DESCRIPTIONS: Record<SupervisorState, string> = {
  [SupervisorState.IDLE]: 'Waiting for a task to begin',
  [SupervisorState.PLAN]: 'Generating implementation plan',
  [SupervisorState.EXECUTE]: 'Executing plan steps',
  [SupervisorState.VERIFY]: 'Verifying results against criteria',
  [SupervisorState.ITERATE]: 'Fixing issues and preparing for re-execution',
  [SupervisorState.COMPLETE]: 'Task completed successfully',
  [SupervisorState.FAILED]: 'Task failed after maximum iterations',
  [SupervisorState.PAUSED]: 'Task paused by user or system',
};
