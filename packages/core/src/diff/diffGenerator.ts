/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  DiffResult,
  DiffHunk,
  LineChange,
  DiffStats,
  DiffOptions,
  UnifiedDiff,
  SideBySideDiff,
  SideBySideLine,
} from './types.js';
import {
  ChangeType,
  DEFAULT_DIFF_OPTIONS,
} from './types.js';

/**
 * Diff Generator
 *
 * Generates diffs between text content using Myers diff algorithm.
 */
export class DiffGenerator {
  private options: Required<DiffOptions>;

  constructor(options: DiffOptions = {}) {
    this.options = { ...DEFAULT_DIFF_OPTIONS, ...options };
  }

  /**
   * Generate a diff between two strings
   */
  diff(oldContent: string, newContent: string, oldPath = 'a', newPath = 'b'): DiffResult {
    const oldLines = this.splitLines(oldContent);
    const newLines = this.splitLines(newContent);

    // Apply preprocessing based on options
    const processedOld = this.preprocessLines(oldLines);
    const processedNew = this.preprocessLines(newLines);

    // Compute LCS-based diff
    const changes = this.computeDiff(processedOld, processedNew, oldLines, newLines);

    // Group into hunks
    const hunks = this.groupIntoHunks(changes, oldLines, newLines);

    // Calculate stats
    const stats = this.calculateStats(changes);

    return {
      oldPath,
      newPath,
      isNew: oldContent === '',
      isDeleted: newContent === '',
      isRenamed: oldPath !== newPath && oldContent === newContent,
      isBinary: false,
      hunks,
      stats,
    };
  }

  /**
   * Generate unified diff format
   */
  toUnifiedDiff(fileDiff: DiffResult): UnifiedDiff {
    const lines: string[] = [];

    // Header
    lines.push(`--- ${fileDiff.oldPath}`);
    lines.push(`+++ ${fileDiff.newPath}`);

    // Hunks
    for (const hunk of fileDiff.hunks) {
      // Hunk header
      const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
      lines.push(hunk.header ? `${header} ${hunk.header}` : header);

      // Hunk lines
      for (const line of hunk.lines) {
        switch (line.type) {
          case ChangeType.ADD:
            lines.push(`+${line.content}`);
            break;
          case ChangeType.DELETE:
            lines.push(`-${line.content}`);
            break;
          case ChangeType.UNCHANGED:
            lines.push(` ${line.content}`);
            break;
          default:
            break;
        }
      }
    }

    return {
      header: lines.slice(0, 2),
      content: lines.join('\n'),
      lines,
    };
  }

  /**
   * Generate side-by-side diff
   */
  toSideBySide(fileDiff: DiffResult): SideBySideDiff {
    const lines: SideBySideLine[] = [];

    for (const hunk of fileDiff.hunks) {
      let leftBuffer: LineChange[] = [];
      let rightBuffer: LineChange[] = [];

      for (const line of hunk.lines) {
        if (line.type === ChangeType.DELETE) {
          leftBuffer.push(line);
        } else if (line.type === ChangeType.ADD) {
          rightBuffer.push(line);
        } else {
          // Flush buffers first
          this.flushSideBySideBuffers(lines, leftBuffer, rightBuffer);
          leftBuffer = [];
          rightBuffer = [];

          // Add unchanged line
          lines.push({
            left: {
              lineNumber: line.oldLineNumber,
              content: line.content,
              type: ChangeType.UNCHANGED,
            },
            right: {
              lineNumber: line.newLineNumber,
              content: line.content,
              type: ChangeType.UNCHANGED,
            },
          });
        }
      }

      // Flush remaining
      this.flushSideBySideBuffers(lines, leftBuffer, rightBuffer);
    }

    return {
      oldPath: fileDiff.oldPath,
      newPath: fileDiff.newPath,
      lines,
      stats: fileDiff.stats,
    };
  }

  /**
   * Generate inline diff with word-level changes highlighted
   */
  toInlineDiff(oldContent: string, newContent: string): string[] {
    const oldLines = this.splitLines(oldContent);
    const newLines = this.splitLines(newContent);
    const result: string[] = [];

    const changes = this.computeDiff(
      this.preprocessLines(oldLines),
      this.preprocessLines(newLines),
      oldLines,
      newLines
    );

    for (const change of changes) {
      switch (change.type) {
        case ChangeType.DELETE:
          result.push(`[-${change.content}-]`);
          break;
        case ChangeType.ADD:
          result.push(`{+${change.content}+}`);
          break;
        case ChangeType.UNCHANGED:
          result.push(change.content);
          break;
        default:
          break;
      }
    }

    return result;
  }

  /**
   * Split content into lines, preserving line endings
   */
  private splitLines(content: string): string[] {
    if (content === '') return [];
    return content.split(/\r?\n/);
  }

  /**
   * Preprocess lines based on options
   */
  private preprocessLines(lines: string[]): string[] {
    return lines.map(line => {
      let processed = line;
      if (this.options.ignoreWhitespace) {
        processed = processed.replace(/\s+/g, ' ').trim();
      }
      if (this.options.ignoreCase) {
        processed = processed.toLowerCase();
      }
      return processed;
    });
  }

  /**
   * Compute diff using LCS algorithm
   */
  private computeDiff(
    processedOld: string[],
    processedNew: string[],
    originalOld: string[],
    originalNew: string[]
  ): LineChange[] {
    const m = processedOld.length;
    const n = processedNew.length;

    // Build LCS matrix
    const lcs: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (processedOld[i - 1] === processedNew[j - 1]) {
          lcs[i][j] = lcs[i - 1][j - 1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1]);
        }
      }
    }

    // Backtrack to find changes
    const changes: LineChange[] = [];
    let i = m;
    let j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && processedOld[i - 1] === processedNew[j - 1]) {
        changes.unshift({
          type: ChangeType.UNCHANGED,
          oldLineNumber: i,
          newLineNumber: j,
          content: originalOld[i - 1],
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        changes.unshift({
          type: ChangeType.ADD,
          oldLineNumber: null,
          newLineNumber: j,
          content: originalNew[j - 1],
        });
        j--;
      } else if (i > 0) {
        changes.unshift({
          type: ChangeType.DELETE,
          oldLineNumber: i,
          newLineNumber: null,
          content: originalOld[i - 1],
        });
        i--;
      }
    }

    return changes;
  }

  /**
   * Group changes into hunks with context
   */
  private groupIntoHunks(
    changes: LineChange[],
    oldLines: string[],
    _newLines: string[]
  ): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const contextLines = this.options.contextLines;

    let currentHunk: DiffHunk | null = null;
    let lastChangeIndex = -contextLines - 1;

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const isChange = change.type !== ChangeType.UNCHANGED;

      if (isChange) {
        // Start new hunk or extend current
        if (currentHunk === null || i - lastChangeIndex > contextLines * 2) {
          // Start new hunk
          if (currentHunk !== null) {
            hunks.push(currentHunk);
          }

          // Add leading context
          const contextStart = Math.max(0, i - contextLines);
          const leadingContext = changes.slice(contextStart, i);

          currentHunk = {
            oldStart: (leadingContext[0]?.oldLineNumber ?? change.oldLineNumber ?? 1),
            oldLines: 0,
            newStart: (leadingContext[0]?.newLineNumber ?? change.newLineNumber ?? 1),
            newLines: 0,
            lines: [...leadingContext],
            header: this.findFunctionHeader(oldLines, change.oldLineNumber ?? 1),
          };

          // Update line counts for leading context
          for (const ctx of leadingContext) {
            if (ctx.oldLineNumber !== null) currentHunk.oldLines++;
            if (ctx.newLineNumber !== null) currentHunk.newLines++;
          }
        }

        // Add the change
        currentHunk.lines.push(change);
        if (change.oldLineNumber !== null) currentHunk.oldLines++;
        if (change.newLineNumber !== null) currentHunk.newLines++;
        lastChangeIndex = i;
      } else if (currentHunk !== null) {
        // Add trailing context
        const distanceToLast = i - lastChangeIndex;
        if (distanceToLast <= contextLines) {
          currentHunk.lines.push(change);
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }
    }

    // Push final hunk
    if (currentHunk !== null) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Find function/class header for hunk context
   */
  private findFunctionHeader(lines: string[], lineNumber: number): string | undefined {
    if (!this.options.showFunctionNames) return undefined;

    // Look backwards for function/class definition
    const patterns = [
      /^\s*(async\s+)?function\s+(\w+)/,
      /^\s*(export\s+)?(async\s+)?(\w+)\s*\(/,
      /^\s*class\s+(\w+)/,
      /^\s*(public|private|protected)?\s*(async\s+)?(\w+)\s*\(/,
      /^\s*def\s+(\w+)/,
      /^\s*fn\s+(\w+)/,
    ];

    for (let i = lineNumber - 1; i >= 0 && i >= lineNumber - 50; i--) {
      const line = lines[i];
      if (!line) continue;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          return line.trim().substring(0, 60);
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate diff statistics
   */
  private calculateStats(changes: LineChange[]): DiffStats {
    let additions = 0;
    let deletions = 0;

    for (const change of changes) {
      if (change.type === ChangeType.ADD) additions++;
      else if (change.type === ChangeType.DELETE) deletions++;
    }

    return {
      additions,
      deletions,
      modifications: Math.min(additions, deletions),
      total: additions + deletions,
    };
  }

  /**
   * Flush side-by-side buffers
   */
  private flushSideBySideBuffers(
    lines: SideBySideLine[],
    leftBuffer: LineChange[],
    rightBuffer: LineChange[]
  ): void {
    const maxLen = Math.max(leftBuffer.length, rightBuffer.length);

    for (let i = 0; i < maxLen; i++) {
      const left = leftBuffer[i];
      const right = rightBuffer[i];

      lines.push({
        left: left ? {
          lineNumber: left.oldLineNumber,
          content: left.content,
          type: ChangeType.DELETE,
        } : {
          lineNumber: null,
          content: '',
          type: ChangeType.UNCHANGED,
        },
        right: right ? {
          lineNumber: right.newLineNumber,
          content: right.content,
          type: ChangeType.ADD,
        } : {
          lineNumber: null,
          content: '',
          type: ChangeType.UNCHANGED,
        },
      });
    }
  }
}

/**
 * Create a diff generator
 */
export function createDiffGenerator(options?: DiffOptions): DiffGenerator {
  return new DiffGenerator(options);
}
