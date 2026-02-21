/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  DiffResult,
  DiffHunk,
  PatchResult,
  PatchOptions,
} from './types.js';
import {
  ChangeType,
  DEFAULT_PATCH_OPTIONS,
} from './types.js';

/**
 * Patch Applicator
 *
 * Applies diffs/patches to files with conflict detection and rollback support.
 */
export class PatchApplicator {
  private options: Required<PatchOptions>;

  constructor(options: PatchOptions = {}) {
    this.options = { ...DEFAULT_PATCH_OPTIONS, ...options };
  }

  /**
   * Apply a file diff to a file
   */
  applyDiff(filePath: string, diff: DiffResult): PatchResult {
    const result: PatchResult = {
      success: false,
      filePath,
      hunksApplied: 0,
      hunksFailed: 0,
      rejectedHunks: [],
    };

    try {
      // Handle new file creation
      if (diff.isNew) {
        return this.createNewFile(filePath, diff);
      }

      // Handle file deletion
      if (diff.isDeleted) {
        return this.deleteFile(filePath);
      }

      // Read current content
      if (!fs.existsSync(filePath)) {
        result.error = `File not found: ${filePath}`;
        return result;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Create backup if requested
      if (this.options.createBackup && !this.options.dryRun) {
        result.backupPath = this.createBackup(filePath);
      }

      // Apply hunks
      const { newLines, applied, failed, rejected } = this.applyHunks(
        lines,
        diff.hunks,
        this.options.reverse
      );

      result.hunksApplied = applied;
      result.hunksFailed = failed;
      result.rejectedHunks = rejected;

      if (failed > 0) {
        result.error = `${failed} hunk(s) failed to apply`;
      }

      // Write result if not dry run
      if (!this.options.dryRun && applied > 0) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      }

      result.success = failed === 0;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Apply a unified diff string
   */
  applyUnifiedDiff(filePath: string, unifiedDiff: string): PatchResult {
    const diff = this.parseUnifiedDiff(unifiedDiff);
    return this.applyDiff(filePath, diff);
  }

  /**
   * Apply multiple diffs
   */
  applyMultiple(diffs: Array<{ path: string; diff: DiffResult }>): PatchResult[] {
    return diffs.map(({ path: filePath, diff }) => this.applyDiff(filePath, diff));
  }

  /**
   * Reverse a patch (unapply)
   */
  reversePatch(filePath: string, diff: DiffResult): PatchResult {
    const reversedOptions = { ...this.options, reverse: true };
    const reverseApplicator = new PatchApplicator(reversedOptions);
    return reverseApplicator.applyDiff(filePath, diff);
  }

  /**
   * Check if a patch can be applied (dry run)
   */
  canApply(filePath: string, diff: DiffResult): { canApply: boolean; issues: string[] } {
    const dryRunOptions = { ...this.options, dryRun: true, createBackup: false };
    const dryRunApplicator = new PatchApplicator(dryRunOptions);
    const result = dryRunApplicator.applyDiff(filePath, diff);

    return {
      canApply: result.success,
      issues: result.rejectedHunks?.map((h, i) =>
        `Hunk ${i + 1} at line ${h.oldStart} cannot be applied`
      ) ?? [],
    };
  }

  /**
   * Restore from backup
   */
  restoreFromBackup(filePath: string): boolean {
    const backupPath = filePath + this.options.backupSuffix;
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      return true;
    }
    return false;
  }

  /**
   * Apply hunks to lines
   */
  private applyHunks(
    lines: string[],
    hunks: DiffHunk[],
    reverse: boolean
  ): {
    newLines: string[];
    applied: number;
    failed: number;
    rejected: DiffHunk[];
  } {
    let newLines = [...lines];
    let applied = 0;
    let failed = 0;
    const rejected: DiffHunk[] = [];
    let offset = 0;

    // Sort hunks by line number
    const sortedHunks = [...hunks].sort((a, b) => a.oldStart - b.oldStart);

    for (const hunk of sortedHunks) {
      const result = this.applyHunk(newLines, hunk, offset, reverse);

      if (result.success) {
        newLines = result.lines;
        offset = result.offset;
        applied++;
      } else {
        // Try fuzzy matching
        if (this.options.fuzzyMatch) {
          const fuzzyResult = this.applyHunkFuzzy(newLines, hunk, offset, reverse);
          if (fuzzyResult.success) {
            newLines = fuzzyResult.lines;
            offset = fuzzyResult.offset;
            applied++;
            continue;
          }
        }

        failed++;
        rejected.push(hunk);
      }
    }

    return { newLines, applied, failed, rejected };
  }

  /**
   * Apply a single hunk
   */
  private applyHunk(
    lines: string[],
    hunk: DiffHunk,
    offset: number,
    reverse: boolean
  ): { success: boolean; lines: string[]; offset: number } {
    const startLine = (reverse ? hunk.newStart : hunk.oldStart) - 1 + offset;

    // Verify context matches
    if (!this.verifyContext(lines, hunk, startLine, reverse)) {
      return { success: false, lines, offset };
    }

    // Apply changes
    const newLines = [...lines];
    let currentLine = startLine;
    let lineOffset = 0;

    for (const change of hunk.lines) {
      const changeType = reverse ? this.reverseChangeType(change.type) : change.type;

      switch (changeType) {
        case ChangeType.UNCHANGED:
          currentLine++;
          break;
        case ChangeType.DELETE:
          newLines.splice(currentLine, 1);
          lineOffset--;
          break;
        case ChangeType.ADD:
          newLines.splice(currentLine, 0, change.content);
          currentLine++;
          lineOffset++;
          break;
        default:
          break;
      }
    }

    return {
      success: true,
      lines: newLines,
      offset: offset + lineOffset,
    };
  }

  /**
   * Apply hunk with fuzzy matching
   */
  private applyHunkFuzzy(
    lines: string[],
    hunk: DiffHunk,
    offset: number,
    reverse: boolean
  ): { success: boolean; lines: string[]; offset: number } {
    const fuzz = this.options.fuzzFactor;
    const startLine = (reverse ? hunk.newStart : hunk.oldStart) - 1 + offset;

    // Try positions around the expected line
    for (let delta = -fuzz; delta <= fuzz; delta++) {
      const tryLine = startLine + delta;
      if (tryLine < 0 || tryLine >= lines.length) continue;

      if (this.verifyContext(lines, hunk, tryLine, reverse)) {
        const result = this.applyHunk(lines, hunk, offset + delta, reverse);
        if (result.success) {
          return result;
        }
      }
    }

    return { success: false, lines, offset };
  }

  /**
   * Verify that context lines match
   */
  private verifyContext(
    lines: string[],
    hunk: DiffHunk,
    startLine: number,
    reverse: boolean
  ): boolean {
    let lineIndex = startLine;

    for (const change of hunk.lines) {
      const changeType = reverse ? this.reverseChangeType(change.type) : change.type;

      if (changeType === ChangeType.UNCHANGED || changeType === ChangeType.DELETE) {
        if (lineIndex >= lines.length) return false;

        const expectedContent = this.options.fuzzyMatch
          ? change.content.trim()
          : change.content;
        const actualContent = this.options.fuzzyMatch
          ? lines[lineIndex].trim()
          : lines[lineIndex];

        if (expectedContent !== actualContent) {
          return false;
        }
        lineIndex++;
      }
    }

    return true;
  }

  /**
   * Reverse a change type
   */
  private reverseChangeType(type: ChangeType): ChangeType {
    switch (type) {
      case ChangeType.ADD:
        return ChangeType.DELETE;
      case ChangeType.DELETE:
        return ChangeType.ADD;
      default:
        return type;
    }
  }

  /**
   * Create new file from diff
   */
  private createNewFile(filePath: string, diff: DiffResult): PatchResult {
    const result: PatchResult = {
      success: false,
      filePath,
      hunksApplied: 0,
      hunksFailed: 0,
    };

    try {
      // Extract content from ADD lines
      const content: string[] = [];
      for (const hunk of diff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === ChangeType.ADD) {
            content.push(line.content);
          }
        }
      }

      if (!this.options.dryRun) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, content.join('\n'), 'utf-8');
      }

      result.success = true;
      result.hunksApplied = diff.hunks.length;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Delete a file
   */
  private deleteFile(filePath: string): PatchResult {
    const result: PatchResult = {
      success: false,
      filePath,
      hunksApplied: 0,
      hunksFailed: 0,
    };

    try {
      if (!fs.existsSync(filePath)) {
        result.error = `File not found: ${filePath}`;
        return result;
      }

      // Create backup if requested
      if (this.options.createBackup && !this.options.dryRun) {
        result.backupPath = this.createBackup(filePath);
      }

      if (!this.options.dryRun) {
        fs.unlinkSync(filePath);
      }

      result.success = true;
      result.hunksApplied = 1;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    }
  }

  /**
   * Create backup of file
   */
  private createBackup(filePath: string): string {
    const backupPath = filePath + this.options.backupSuffix;
    fs.copyFileSync(filePath, backupPath);
    return backupPath;
  }

  /**
   * Parse unified diff format
   */
  parseUnifiedDiff(unifiedDiff: string): DiffResult {
    const lines = unifiedDiff.split('\n');
    let oldPath = '';
    let newPath = '';
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      // Header lines
      if (line.startsWith('---')) {
        oldPath = line.substring(4).trim();
        continue;
      }
      if (line.startsWith('+++')) {
        newPath = line.substring(4).trim();
        continue;
      }

      // Hunk header
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@(.*)$/);
      if (hunkMatch) {
        if (currentHunk) hunks.push(currentHunk);

        oldLineNum = parseInt(hunkMatch[1], 10);
        newLineNum = parseInt(hunkMatch[3], 10);

        currentHunk = {
          oldStart: oldLineNum,
          oldLines: parseInt(hunkMatch[2] || '1', 10),
          newStart: newLineNum,
          newLines: parseInt(hunkMatch[4] || '1', 10),
          lines: [],
          header: hunkMatch[5]?.trim() || undefined,
        };
        continue;
      }

      if (!currentHunk) continue;

      // Content lines
      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: ChangeType.ADD,
          oldLineNumber: null,
          newLineNumber: newLineNum++,
          content: line.substring(1),
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: ChangeType.DELETE,
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
          content: line.substring(1),
        });
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: ChangeType.UNCHANGED,
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line.startsWith(' ') ? line.substring(1) : line,
        });
      }
    }

    if (currentHunk) hunks.push(currentHunk);

    // Calculate stats
    let additions = 0;
    let deletions = 0;
    for (const hunk of hunks) {
      for (const change of hunk.lines) {
        if (change.type === ChangeType.ADD) additions++;
        else if (change.type === ChangeType.DELETE) deletions++;
      }
    }

    return {
      oldPath,
      newPath,
      isNew: oldPath === '/dev/null',
      isDeleted: newPath === '/dev/null',
      isRenamed: oldPath !== newPath && oldPath !== '/dev/null' && newPath !== '/dev/null',
      isBinary: false,
      hunks,
      stats: {
        additions,
        deletions,
        modifications: Math.min(additions, deletions),
        total: additions + deletions,
      },
    };
  }
}

/**
 * Create a patch applicator
 */
export function createPatchApplicator(options?: PatchOptions): PatchApplicator {
  return new PatchApplicator(options);
}
