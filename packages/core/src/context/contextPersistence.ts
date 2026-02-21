/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ContextItem } from './types.js';

/**
 * Persistence configuration
 */
export interface PersistenceConfig {
  /** Base directory for persistence */
  baseDir: string;
  /** Session ID */
  sessionId?: string;
  /** Auto-save interval in ms (0 = disabled) */
  autoSaveInterval: number;
  /** Maximum sessions to keep */
  maxSessions: number;
  /** Compress saved data */
  compress: boolean;
}

/**
 * Default persistence configuration
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  baseDir: '.damie/context',
  autoSaveInterval: 30000, // 30 seconds
  maxSessions: 10,
  compress: false,
};

/**
 * Saved context session
 */
export interface SavedSession {
  /** Session ID */
  id: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Items in session */
  items: ContextItem[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Context Persistence
 *
 * Saves and loads context across sessions.
 */
export class ContextPersistence {
  private config: PersistenceConfig;
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private currentSession: SavedSession | null = null;

  constructor(config: Partial<PersistenceConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
    this.ensureBaseDir();
  }

  /**
   * Ensure base directory exists
   */
  private ensureBaseDir(): void {
    const fullPath = path.resolve(this.config.baseDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session file path
   */
  private getSessionPath(sessionId: string): string {
    return path.resolve(this.config.baseDir, `${sessionId}.json`);
  }

  /**
   * Start a new session
   */
  startSession(sessionId?: string): string {
    const id = sessionId ?? this.config.sessionId ?? this.generateSessionId();

    this.currentSession = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [],
    };

    if (this.config.autoSaveInterval > 0) {
      this.startAutoSave();
    }

    return id;
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      if (this.currentSession) {
        this.save(this.currentSession.items).catch(() => {
          // Ignore auto-save errors
        });
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save timer
   */
  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Save context items
   */
  async save(items: ContextItem[], metadata?: Record<string, unknown>): Promise<void> {
    if (!this.currentSession) {
      this.startSession();
    }

    this.currentSession!.items = items;
    this.currentSession!.updatedAt = new Date();

    if (metadata) {
      this.currentSession!.metadata = {
        ...this.currentSession!.metadata,
        ...metadata,
      };
    }

    const data = this.serialize(this.currentSession!);
    const filePath = this.getSessionPath(this.currentSession!.id);

    await fs.promises.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Load context from session
   */
  async load(sessionId: string): Promise<SavedSession | null> {
    const filePath = this.getSessionPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      const session = this.deserialize(data);

      this.currentSession = session;

      if (this.config.autoSaveInterval > 0) {
        this.startAutoSave();
      }

      return session;
    } catch {
      return null;
    }
  }

  /**
   * Load most recent session
   */
  async loadLatest(): Promise<SavedSession | null> {
    const sessions = await this.listSessions();

    if (sessions.length === 0) {
      return null;
    }

    // Sort by updated time, most recent first
    sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    return this.load(sessions[0].id);
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Array<{ id: string; createdAt: Date; updatedAt: Date }>> {
    const baseDir = path.resolve(this.config.baseDir);

    if (!fs.existsSync(baseDir)) {
      return [];
    }

    const files = await fs.promises.readdir(baseDir);
    const sessions: Array<{ id: string; createdAt: Date; updatedAt: Date }> = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(baseDir, file);
          const data = await fs.promises.readFile(filePath, 'utf-8');
          const session = this.deserialize(data);

          sessions.push({
            id: session.id,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          });
        } catch {
          // Skip invalid files
        }
      }
    }

    return sessions;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    const filePath = this.getSessionPath(sessionId);

    if (!fs.existsSync(filePath)) {
      return false;
    }

    await fs.promises.unlink(filePath);
    return true;
  }

  /**
   * Clean up old sessions
   */
  async cleanup(): Promise<number> {
    const sessions = await this.listSessions();

    if (sessions.length <= this.config.maxSessions) {
      return 0;
    }

    // Sort by updated time, oldest first
    sessions.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());

    // Delete oldest sessions
    const toDelete = sessions.slice(0, sessions.length - this.config.maxSessions);
    let deletedCount = 0;

    for (const session of toDelete) {
      if (await this.deleteSession(session.id)) {
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * End current session
   */
  async endSession(): Promise<void> {
    this.stopAutoSave();

    if (this.currentSession) {
      await this.save(this.currentSession.items);
      this.currentSession = null;
    }
  }

  /**
   * Serialize session for storage
   */
  private serialize(session: SavedSession): string {
    // Convert dates to ISO strings for JSON
    const data = {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      items: session.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        lastAccessedAt: item.lastAccessedAt.toISOString(),
      })),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Deserialize session from storage
   */
  private deserialize(data: string): SavedSession {
    const parsed = JSON.parse(data);

    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      items: parsed.items.map((item: Record<string, unknown>) => ({
        ...item,
        createdAt: new Date(item['createdAt'] as string),
        lastAccessedAt: new Date(item['lastAccessedAt'] as string),
      })),
    };
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.currentSession?.id ?? null;
  }

  /**
   * Check if session is active
   */
  isActive(): boolean {
    return this.currentSession !== null;
  }
}

/**
 * Create context persistence
 */
export function createContextPersistence(
  config?: Partial<PersistenceConfig>,
): ContextPersistence {
  return new ContextPersistence(config);
}
