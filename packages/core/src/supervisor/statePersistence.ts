/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type { PersistedState } from './types.js';

/**
 * State Persistence Manager
 *
 * Handles saving and restoring supervisor state for crash recovery.
 */
export class StatePersistence {
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath ?? this.getDefaultPath();
  }

  /**
   * Get default persistence file path
   */
  private getDefaultPath(): string {
    return path.join(homedir(), '.damie', 'supervisor-state.json');
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save state to file
   */
  save(state: PersistedState): void {
    this.ensureDirectory();
    const data = JSON.stringify(state, null, 2);
    fs.writeFileSync(this.filePath, data, 'utf-8');
  }

  /**
   * Load state from file
   */
  load(): PersistedState | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as PersistedState;

      // Restore Date objects
      parsed.persistedAt = new Date(parsed.persistedAt);
      parsed.taskContext.startedAt = new Date(parsed.taskContext.startedAt);
      parsed.taskContext.updatedAt = new Date(parsed.taskContext.updatedAt);

      for (const transition of parsed.stateHistory) {
        transition.timestamp = new Date(transition.timestamp);
      }

      if (parsed.taskContext.plan) {
        parsed.taskContext.plan.createdAt = new Date(parsed.taskContext.plan.createdAt);
      }

      if (parsed.taskContext.executionResults) {
        for (const result of parsed.taskContext.executionResults) {
          result.timestamp = new Date(result.timestamp);
        }
      }

      if (parsed.taskContext.verificationResult) {
        parsed.taskContext.verificationResult.timestamp = new Date(
          parsed.taskContext.verificationResult.timestamp,
        );
      }

      return parsed;
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      return null;
    }
  }

  /**
   * Check if persisted state exists
   */
  exists(): boolean {
    return fs.existsSync(this.filePath);
  }

  /**
   * Clear persisted state
   */
  clear(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }

  /**
   * Get age of persisted state in milliseconds
   */
  getAge(): number | null {
    if (!this.exists()) return null;

    try {
      const stats = fs.statSync(this.filePath);
      return Date.now() - stats.mtime.getTime();
    } catch {
      return null;
    }
  }

  /**
   * Check if persisted state is stale (older than maxAge)
   */
  isStale(maxAgeMs: number): boolean {
    const age = this.getAge();
    if (age === null) return false;
    return age > maxAgeMs;
  }

  /**
   * Get file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

/**
 * Create a state persistence manager
 */
export function createStatePersistence(customPath?: string): StatePersistence {
  return new StatePersistence(customPath);
}

/**
 * Default state persistence instance
 */
let defaultPersistence: StatePersistence | null = null;

/**
 * Get default state persistence instance
 */
export function getDefaultStatePersistence(): StatePersistence {
  if (!defaultPersistence) {
    defaultPersistence = new StatePersistence();
  }
  return defaultPersistence;
}
