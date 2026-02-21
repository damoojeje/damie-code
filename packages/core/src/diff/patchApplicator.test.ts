/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { PatchApplicator, createPatchApplicator } from './patchApplicator.js';
import { DiffGenerator } from './diffGenerator.js';

describe('PatchApplicator', () => {
  let applicator: PatchApplicator;
  let tempDir: string;
  let generator: DiffGenerator;

  beforeEach(() => {
    applicator = new PatchApplicator();
    generator = new DiffGenerator();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patch-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('applyDiff', () => {
    it('should apply a simple change', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'line 1\nline 2\nline 3');

      const oldContent = 'line 1\nline 2\nline 3';
      const newContent = 'line 1\nmodified\nline 3';
      const diff = generator.diff(oldContent, newContent);

      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(result.hunksApplied).toBe(1);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(newContent);
    });

    it('should apply additions', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'line 1\nline 2');

      const diff = generator.diff('line 1\nline 2', 'line 1\nline 2\nline 3');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('line 1\nline 2\nline 3');
    });

    it('should apply deletions', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'line 1\nline 2\nline 3');

      const diff = generator.diff('line 1\nline 2\nline 3', 'line 1\nline 3');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('line 1\nline 3');
    });

    it('should create backup when configured', () => {
      const filePath = path.join(tempDir, 'test.txt');
      const originalContent = 'original';
      fs.writeFileSync(filePath, originalContent);

      const applicator = new PatchApplicator({ createBackup: true });
      const diff = generator.diff('original', 'modified');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);
      expect(fs.readFileSync(result.backupPath!, 'utf-8')).toBe(originalContent);
    });

    it('should not create backup when disabled', () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'original');

      const applicator = new PatchApplicator({ createBackup: false });
      const diff = generator.diff('original', 'modified');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });

    it('should handle file not found', () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      const diff = generator.diff('old', 'new');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should create new file when diff is for new file', () => {
      const filePath = path.join(tempDir, 'newfile.txt');
      const diff = generator.diff('', 'new content\nline 2');

      expect(diff.isNew).toBe(true);
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('new content\nline 2');
    });

    it('should delete file when diff is for deleted file', () => {
      const filePath = path.join(tempDir, 'todelete.txt');
      fs.writeFileSync(filePath, 'content to delete');

      const diff = generator.diff('content to delete', '');

      expect(diff.isDeleted).toBe(true);
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should handle multiple changes in one hunk', () => {
      const filePath = path.join(tempDir, 'multi.txt');
      const oldContent = 'a\nb\nc';
      const newContent = 'A\nb\nC';
      fs.writeFileSync(filePath, oldContent);

      const diff = generator.diff(oldContent, newContent);
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(newContent);
    });
  });

  describe('dry run', () => {
    it('should not modify file in dry run mode', () => {
      const filePath = path.join(tempDir, 'test.txt');
      const originalContent = 'original';
      fs.writeFileSync(filePath, originalContent);

      const applicator = new PatchApplicator({ dryRun: true });
      const diff = generator.diff('original', 'modified');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(originalContent);
    });
  });

  describe('fuzzy matching', () => {
    it('should apply patch with fuzzy matching', () => {
      const filePath = path.join(tempDir, 'fuzzy.txt');
      // Content has extra line at top
      fs.writeFileSync(filePath, 'extra\nline 1\nline 2\nline 3');

      const applicator = new PatchApplicator({ fuzzyMatch: true, fuzzFactor: 2 });
      const diff = generator.diff('line 1\nline 2\nline 3', 'line 1\nmodified\nline 3');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toContain('modified');
    });
  });

  describe('reversePatch', () => {
    it('should reverse a patch', () => {
      const filePath = path.join(tempDir, 'reverse.txt');
      const originalContent = 'line 1\noriginal\nline 3';
      const modifiedContent = 'line 1\nmodified\nline 3';

      // Apply forward
      fs.writeFileSync(filePath, originalContent);
      const diff = generator.diff(originalContent, modifiedContent);
      applicator.applyDiff(filePath, diff);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(modifiedContent);

      // Reverse
      const result = applicator.reversePatch(filePath, diff);
      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(originalContent);
    });
  });

  describe('canApply', () => {
    it('should return true when patch can be applied', () => {
      const filePath = path.join(tempDir, 'check.txt');
      fs.writeFileSync(filePath, 'line 1\nline 2\nline 3');

      const diff = generator.diff('line 1\nline 2\nline 3', 'line 1\nmodified\nline 3');
      const check = applicator.canApply(filePath, diff);

      expect(check.canApply).toBe(true);
      expect(check.issues).toHaveLength(0);
    });

    it('should return false when patch cannot be applied', () => {
      const filePath = path.join(tempDir, 'check.txt');
      fs.writeFileSync(filePath, 'completely different content');

      const diff = generator.diff('line 1\nline 2\nline 3', 'line 1\nmodified\nline 3');
      const check = applicator.canApply(filePath, diff);

      expect(check.canApply).toBe(false);
      expect(check.issues.length).toBeGreaterThan(0);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore file from backup', () => {
      const filePath = path.join(tempDir, 'restore.txt');
      const originalContent = 'original';
      fs.writeFileSync(filePath, originalContent);

      const applicator = new PatchApplicator({ createBackup: true });
      const diff = generator.diff('original', 'modified');
      applicator.applyDiff(filePath, diff);

      expect(fs.readFileSync(filePath, 'utf-8')).toBe('modified');

      const restored = applicator.restoreFromBackup(filePath);
      expect(restored).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(originalContent);
    });

    it('should return false when no backup exists', () => {
      const filePath = path.join(tempDir, 'nobackup.txt');
      fs.writeFileSync(filePath, 'content');

      const restored = applicator.restoreFromBackup(filePath);
      expect(restored).toBe(false);
    });
  });

  describe('applyUnifiedDiff', () => {
    it('should apply unified diff string', () => {
      const filePath = path.join(tempDir, 'unified.txt');
      fs.writeFileSync(filePath, 'line 1\nline 2\nline 3');

      const unifiedDiff = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line 1
-line 2
+modified
 line 3`;

      const result = applicator.applyUnifiedDiff(filePath, unifiedDiff);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('line 1\nmodified\nline 3');
    });
  });

  describe('applyMultiple', () => {
    it('should apply multiple diffs', () => {
      const file1 = path.join(tempDir, 'file1.txt');
      const file2 = path.join(tempDir, 'file2.txt');
      fs.writeFileSync(file1, 'content 1');
      fs.writeFileSync(file2, 'content 2');

      const diff1 = generator.diff('content 1', 'modified 1');
      const diff2 = generator.diff('content 2', 'modified 2');

      const results = applicator.applyMultiple([
        { path: file1, diff: diff1 },
        { path: file2, diff: diff2 },
      ]);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(fs.readFileSync(file1, 'utf-8')).toBe('modified 1');
      expect(fs.readFileSync(file2, 'utf-8')).toBe('modified 2');
    });
  });

  describe('parseUnifiedDiff', () => {
    it('should parse unified diff format', () => {
      const unifiedDiff = `--- old.txt
+++ new.txt
@@ -1,3 +1,3 @@
 unchanged
-old line
+new line
 unchanged`;

      const diff = applicator.parseUnifiedDiff(unifiedDiff);

      expect(diff.oldPath).toBe('old.txt');
      expect(diff.newPath).toBe('new.txt');
      expect(diff.hunks).toHaveLength(1);
      expect(diff.stats.additions).toBe(1);
      expect(diff.stats.deletions).toBe(1);
    });

    it('should parse new file diff', () => {
      const unifiedDiff = `--- /dev/null
+++ new.txt
@@ -0,0 +1,2 @@
+line 1
+line 2`;

      const diff = applicator.parseUnifiedDiff(unifiedDiff);

      expect(diff.isNew).toBe(true);
      expect(diff.stats.additions).toBe(2);
    });

    it('should parse deleted file diff', () => {
      const unifiedDiff = `--- old.txt
+++ /dev/null
@@ -1,2 +0,0 @@
-line 1
-line 2`;

      const diff = applicator.parseUnifiedDiff(unifiedDiff);

      expect(diff.isDeleted).toBe(true);
      expect(diff.stats.deletions).toBe(2);
    });

    it('should parse function header in hunk', () => {
      const unifiedDiff = `--- file.ts
+++ file.ts
@@ -1,3 +1,3 @@ function test()
 unchanged
-old
+new
 unchanged`;

      const diff = applicator.parseUnifiedDiff(unifiedDiff);

      expect(diff.hunks[0].header).toBe('function test()');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const filePath = path.join(tempDir, 'empty.txt');
      fs.writeFileSync(filePath, '');

      const diff = generator.diff('', 'new content');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
    });

    it('should handle file with only newlines', () => {
      const filePath = path.join(tempDir, 'newlines.txt');
      fs.writeFileSync(filePath, '\n\n\n');

      const diff = generator.diff('\n\n\n', 'content\n\n\n');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
    });

    it('should create parent directories for new file', () => {
      const filePath = path.join(tempDir, 'nested', 'dir', 'newfile.txt');

      const diff = generator.diff('', 'new content');
      const result = applicator.applyDiff(filePath, diff);

      expect(result.success).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });
});

describe('createPatchApplicator', () => {
  it('should create applicator with factory function', () => {
    const applicator = createPatchApplicator();
    expect(applicator).toBeInstanceOf(PatchApplicator);
  });

  it('should pass options to factory', () => {
    const applicator = createPatchApplicator({ dryRun: true });
    expect(applicator).toBeInstanceOf(PatchApplicator);
  });
});
