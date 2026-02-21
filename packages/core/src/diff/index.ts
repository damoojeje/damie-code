/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  LineChange,
  DiffHunk,
  DiffResult,
  DiffStats,
  DiffOptions,
  UnifiedDiff,
  SideBySideLine,
  SideBySideDiff,
  PatchResult,
  PatchOptions,
} from './types.js';

export {
  ChangeType,
  PatchOperation,
  DEFAULT_DIFF_OPTIONS,
  DEFAULT_PATCH_OPTIONS,
} from './types.js';

// Diff Generator
export {
  DiffGenerator,
  createDiffGenerator,
} from './diffGenerator.js';

// Patch Applicator
export {
  PatchApplicator,
  createPatchApplicator,
} from './patchApplicator.js';
