/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Type of change in a diff
 */
export enum ChangeType {
  ADD = 'add',
  DELETE = 'delete',
  MODIFY = 'modify',
  UNCHANGED = 'unchanged',
}

/**
 * A single line change in a diff
 */
export interface LineChange {
  /** Type of change */
  type: ChangeType;
  /** Original line number (null for additions) */
  oldLineNumber: number | null;
  /** New line number (null for deletions) */
  newLineNumber: number | null;
  /** Line content */
  content: string;
}

/**
 * A hunk (chunk) of changes
 */
export interface DiffHunk {
  /** Starting line in original file */
  oldStart: number;
  /** Number of lines in original file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Lines in this hunk */
  lines: LineChange[];
  /** Hunk header (e.g., function name) */
  header?: string;
}

/**
 * A complete file diff
 */
export interface DiffResult {
  /** Original file path */
  oldPath: string;
  /** New file path */
  newPath: string;
  /** Whether this is a new file */
  isNew: boolean;
  /** Whether this is a deleted file */
  isDeleted: boolean;
  /** Whether this is a renamed file */
  isRenamed: boolean;
  /** Whether this is a binary file */
  isBinary: boolean;
  /** Hunks of changes */
  hunks: DiffHunk[];
  /** Statistics */
  stats: DiffStats;
}

/**
 * Statistics for a diff
 */
export interface DiffStats {
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Number of lines modified */
  modifications: number;
  /** Total lines changed */
  total: number;
}

/**
 * Options for diff generation
 */
export interface DiffOptions {
  /** Number of context lines around changes */
  contextLines?: number;
  /** Ignore whitespace changes */
  ignoreWhitespace?: boolean;
  /** Ignore case differences */
  ignoreCase?: boolean;
  /** Show word-level diff */
  wordDiff?: boolean;
  /** Include function/class headers in hunk headers */
  showFunctionNames?: boolean;
}

/**
 * Default diff options
 */
export const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  contextLines: 3,
  ignoreWhitespace: false,
  ignoreCase: false,
  wordDiff: false,
  showFunctionNames: true,
};

/**
 * Patch operation type
 */
export enum PatchOperation {
  APPLY = 'apply',
  REVERSE = 'reverse',
}

/**
 * Result of applying a patch
 */
export interface PatchResult {
  /** Whether the patch was applied successfully */
  success: boolean;
  /** Path to the patched file */
  filePath: string;
  /** Error message if failed */
  error?: string;
  /** Number of hunks applied */
  hunksApplied: number;
  /** Number of hunks failed */
  hunksFailed: number;
  /** Rejected hunks (if any) */
  rejectedHunks?: DiffHunk[];
  /** Backup path if created */
  backupPath?: string;
}

/**
 * Options for applying patches
 */
export interface PatchOptions {
  /** Create backup before patching */
  createBackup?: boolean;
  /** Backup file suffix */
  backupSuffix?: string;
  /** Allow fuzzy matching */
  fuzzyMatch?: boolean;
  /** Fuzz factor (lines of tolerance) */
  fuzzFactor?: number;
  /** Dry run (don't actually apply) */
  dryRun?: boolean;
  /** Reverse the patch */
  reverse?: boolean;
}

/**
 * Default patch options
 */
export const DEFAULT_PATCH_OPTIONS: Required<PatchOptions> = {
  createBackup: true,
  backupSuffix: '.orig',
  fuzzyMatch: true,
  fuzzFactor: 2,
  dryRun: false,
  reverse: false,
};

/**
 * Unified diff format output
 */
export interface UnifiedDiff {
  /** Header lines */
  header: string[];
  /** Diff content */
  content: string;
  /** Raw lines */
  lines: string[];
}

/**
 * Side-by-side diff line
 */
export interface SideBySideLine {
  /** Left side (original) */
  left: {
    lineNumber: number | null;
    content: string;
    type: ChangeType;
  };
  /** Right side (new) */
  right: {
    lineNumber: number | null;
    content: string;
    type: ChangeType;
  };
}

/**
 * Side-by-side diff output
 */
export interface SideBySideDiff {
  /** File paths */
  oldPath: string;
  newPath: string;
  /** Lines for display */
  lines: SideBySideLine[];
  /** Statistics */
  stats: DiffStats;
}
