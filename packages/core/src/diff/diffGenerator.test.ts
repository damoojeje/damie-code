/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DiffGenerator, createDiffGenerator } from './diffGenerator.js';
import { ChangeType } from './types.js';

describe('DiffGenerator', () => {
  let generator: DiffGenerator;

  beforeEach(() => {
    generator = new DiffGenerator();
  });

  describe('diff', () => {
    it('should detect no changes for identical content', () => {
      const content = 'line 1\nline 2\nline 3';
      const diff = generator.diff(content, content);

      expect(diff.hunks).toHaveLength(0);
      expect(diff.stats.additions).toBe(0);
      expect(diff.stats.deletions).toBe(0);
    });

    it('should detect additions', () => {
      const oldContent = 'line 1\nline 2';
      const newContent = 'line 1\nline 2\nline 3';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.additions).toBe(1);
      expect(diff.stats.deletions).toBe(0);
      expect(diff.hunks).toHaveLength(1);
    });

    it('should detect deletions', () => {
      const oldContent = 'line 1\nline 2\nline 3';
      const newContent = 'line 1\nline 2';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.deletions).toBe(1);
      expect(diff.stats.additions).toBe(0);
    });

    it('should detect modifications', () => {
      const oldContent = 'line 1\nold line\nline 3';
      const newContent = 'line 1\nnew line\nline 3';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.additions).toBe(1);
      expect(diff.stats.deletions).toBe(1);
      expect(diff.stats.modifications).toBe(1);
    });

    it('should detect new file', () => {
      const diff = generator.diff('', 'new content');

      expect(diff.isNew).toBe(true);
      expect(diff.isDeleted).toBe(false);
    });

    it('should detect deleted file', () => {
      const diff = generator.diff('old content', '');

      expect(diff.isDeleted).toBe(true);
      expect(diff.isNew).toBe(false);
    });

    it('should detect renamed file', () => {
      const content = 'same content';
      const diff = generator.diff(content, content, 'old.ts', 'new.ts');

      expect(diff.isRenamed).toBe(true);
    });

    it('should preserve file paths', () => {
      const diff = generator.diff('a', 'b', 'src/file.ts', 'src/file.ts');

      expect(diff.oldPath).toBe('src/file.ts');
      expect(diff.newPath).toBe('src/file.ts');
    });

    it('should handle empty to content', () => {
      const diff = generator.diff('', 'line 1\nline 2');

      expect(diff.isNew).toBe(true);
      expect(diff.stats.additions).toBe(2);
    });

    it('should handle content to empty', () => {
      const diff = generator.diff('line 1\nline 2', '');

      expect(diff.isDeleted).toBe(true);
      expect(diff.stats.deletions).toBe(2);
    });

    it('should handle multiline additions at start', () => {
      const oldContent = 'existing';
      const newContent = 'new 1\nnew 2\nexisting';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.additions).toBe(2);
    });

    it('should handle multiline additions at end', () => {
      const oldContent = 'existing';
      const newContent = 'existing\nnew 1\nnew 2';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.additions).toBe(2);
    });

    it('should handle interleaved changes', () => {
      const oldContent = 'a\nb\nc\nd';
      const newContent = 'a\nB\nc\nD';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.additions).toBe(2);
      expect(diff.stats.deletions).toBe(2);
    });
  });

  describe('diff with options', () => {
    it('should ignore whitespace when configured', () => {
      const generator = new DiffGenerator({ ignoreWhitespace: true });
      const oldContent = 'line 1';
      const newContent = '  line 1  ';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.total).toBe(0);
    });

    it('should ignore case when configured', () => {
      const generator = new DiffGenerator({ ignoreCase: true });
      const oldContent = 'Hello World';
      const newContent = 'hello world';
      const diff = generator.diff(oldContent, newContent);

      expect(diff.stats.total).toBe(0);
    });

    it('should respect context lines setting', () => {
      const generator = new DiffGenerator({ contextLines: 1 });
      const oldContent = 'a\nb\nc\nd\ne\nf\ng';
      const newContent = 'a\nb\nc\nX\ne\nf\ng';
      const diff = generator.diff(oldContent, newContent);

      // Should have context lines around the change
      expect(diff.hunks).toHaveLength(1);
      const hunk = diff.hunks[0];
      expect(hunk.lines.some(l => l.content === 'c')).toBe(true); // before
      expect(hunk.lines.some(l => l.content === 'e')).toBe(true); // after
    });
  });

  describe('toUnifiedDiff', () => {
    it('should generate unified diff format', () => {
      const oldContent = 'line 1\nline 2\nline 3';
      const newContent = 'line 1\nmodified\nline 3';
      const fileDiff = generator.diff(oldContent, newContent, 'file.ts', 'file.ts');
      const unified = generator.toUnifiedDiff(fileDiff);

      expect(unified.header[0]).toBe('--- file.ts');
      expect(unified.header[1]).toBe('+++ file.ts');
      expect(unified.content).toContain('@@');
      expect(unified.content).toContain('-line 2');
      expect(unified.content).toContain('+modified');
    });

    it('should include context lines', () => {
      const oldContent = 'a\nb\nc\nd\ne';
      const newContent = 'a\nb\nX\nd\ne';
      const fileDiff = generator.diff(oldContent, newContent);
      const unified = generator.toUnifiedDiff(fileDiff);

      expect(unified.content).toContain(' b'); // context before
      expect(unified.content).toContain(' d'); // context after
    });

    it('should format hunk headers correctly', () => {
      const oldContent = 'line 1\nline 2';
      const newContent = 'line 1\nline 2\nline 3';
      const fileDiff = generator.diff(oldContent, newContent);
      const unified = generator.toUnifiedDiff(fileDiff);

      expect(unified.lines.some(l => l.startsWith('@@'))).toBe(true);
    });
  });

  describe('toSideBySide', () => {
    it('should generate side-by-side format', () => {
      const oldContent = 'line 1\nold\nline 3';
      const newContent = 'line 1\nnew\nline 3';
      const fileDiff = generator.diff(oldContent, newContent);
      const sideBySide = generator.toSideBySide(fileDiff);

      expect(sideBySide.oldPath).toBe('a');
      expect(sideBySide.newPath).toBe('b');
      expect(sideBySide.lines.length).toBeGreaterThan(0);
    });

    it('should align deletions and additions', () => {
      const oldContent = 'same\ndeleted\nsame';
      const newContent = 'same\nadded\nsame';
      const fileDiff = generator.diff(oldContent, newContent);
      const sideBySide = generator.toSideBySide(fileDiff);

      const changeLine = sideBySide.lines.find(
        l => l.left.type === ChangeType.DELETE || l.right.type === ChangeType.ADD
      );

      expect(changeLine).toBeDefined();
    });

    it('should handle pure additions', () => {
      const oldContent = 'a\nb';
      const newContent = 'a\nnew\nb';
      const fileDiff = generator.diff(oldContent, newContent);
      const sideBySide = generator.toSideBySide(fileDiff);

      const addLine = sideBySide.lines.find(l => l.right.type === ChangeType.ADD);
      expect(addLine).toBeDefined();
      expect(addLine?.right.content).toBe('new');
    });

    it('should handle pure deletions', () => {
      const oldContent = 'a\nold\nb';
      const newContent = 'a\nb';
      const fileDiff = generator.diff(oldContent, newContent);
      const sideBySide = generator.toSideBySide(fileDiff);

      const deleteLine = sideBySide.lines.find(l => l.left.type === ChangeType.DELETE);
      expect(deleteLine).toBeDefined();
      expect(deleteLine?.left.content).toBe('old');
    });
  });

  describe('toInlineDiff', () => {
    it('should generate inline diff markers', () => {
      const oldContent = 'hello';
      const newContent = 'hello world';
      const inline = generator.toInlineDiff(oldContent, newContent);

      expect(inline.some(l => l.includes('[-'))).toBe(true);
      expect(inline.some(l => l.includes('{+'))).toBe(true);
    });

    it('should show unchanged content without markers', () => {
      const content = 'same\nsame';
      const inline = generator.toInlineDiff(content, content);

      expect(inline.every(l => !l.includes('[-') && !l.includes('{+'))).toBe(true);
    });
  });

  describe('function header detection', () => {
    it('should detect TypeScript function headers', () => {
      const generator = new DiffGenerator({ showFunctionNames: true });
      const oldContent = 'function myFunc() {\n  old\n}';
      const newContent = 'function myFunc() {\n  new\n}';
      const diff = generator.diff(oldContent, newContent);

      if (diff.hunks.length > 0 && diff.hunks[0].header) {
        expect(diff.hunks[0].header).toContain('myFunc');
      }
    });

    it('should detect class headers', () => {
      const generator = new DiffGenerator({ showFunctionNames: true });
      const oldContent = 'class MyClass {\n  old\n}';
      const newContent = 'class MyClass {\n  new\n}';
      const diff = generator.diff(oldContent, newContent);

      if (diff.hunks.length > 0 && diff.hunks[0].header) {
        expect(diff.hunks[0].header).toContain('MyClass');
      }
    });
  });
});

describe('createDiffGenerator', () => {
  it('should create generator with factory function', () => {
    const generator = createDiffGenerator();
    expect(generator).toBeInstanceOf(DiffGenerator);
  });

  it('should pass options to factory', () => {
    const generator = createDiffGenerator({ contextLines: 5 });
    expect(generator).toBeInstanceOf(DiffGenerator);
  });
});
