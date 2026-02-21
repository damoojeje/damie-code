/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileScanner, createFileScanner } from './fileScanner.js';
import { FileCategory, Language, ProjectType } from './types.js';

describe('FileScanner', () => {
  let scanner: FileScanner;
  let tempDir: string;

  beforeEach(() => {
    scanner = new FileScanner();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('scan', () => {
    it('should scan empty directory', async () => {
      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(0);
      expect(result.totalDirectories).toBe(0);
      expect(result.projectType).toBe(ProjectType.UNKNOWN);
    });

    it('should scan directory with files', async () => {
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export default {}');
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), 'export function foo() {}');

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(2);
      expect(result.filesByLanguage[Language.TYPESCRIPT]).toBe(2);
      expect(result.primaryLanguage).toBe(Language.TYPESCRIPT);
    });

    it('should detect TypeScript project', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: {} }),
      );
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export default {}');

      const result = await scanner.scan(tempDir);

      expect(result.projectType).toBe(ProjectType.TYPESCRIPT);
    });

    it('should detect Node.js project', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-package' }),
      );
      fs.writeFileSync(path.join(tempDir, 'index.js'), 'module.exports = {}');

      const result = await scanner.scan(tempDir);

      expect(result.projectType).toBe(ProjectType.NODEJS);
      expect(result.name).toBe('test-package');
    });

    it('should detect Python project', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'pyproject.toml'),
        '[project]\nname = "my-python-app"',
      );
      fs.writeFileSync(path.join(tempDir, 'main.py'), 'print("hello")');

      const result = await scanner.scan(tempDir);

      expect(result.projectType).toBe(ProjectType.PYTHON);
    });

    it('should detect monorepo', async () => {
      fs.mkdirSync(path.join(tempDir, 'packages'));
      fs.writeFileSync(
        path.join(tempDir, 'lerna.json'),
        JSON.stringify({ packages: ['packages/*'] }),
      );

      const result = await scanner.scan(tempDir);

      expect(result.projectType).toBe(ProjectType.MONOREPO);
    });

    it('should categorize files correctly', async () => {
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'export default {}');
      fs.writeFileSync(path.join(tempDir, 'app.test.ts'), 'describe()');
      fs.writeFileSync(path.join(tempDir, 'config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');

      const result = await scanner.scan(tempDir);

      expect(result.filesByCategory[FileCategory.SOURCE]).toBe(1);
      expect(result.filesByCategory[FileCategory.TEST]).toBe(1);
      expect(result.filesByCategory[FileCategory.CONFIG]).toBe(1);
      expect(result.filesByCategory[FileCategory.DOCUMENTATION]).toBe(1);
    });

    it('should exclude node_modules', async () => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'));
      fs.writeFileSync(
        path.join(tempDir, 'node_modules', 'package.json'),
        '{}',
      );
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export {}');

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(1);
    });

    it('should find entry points', async () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src', 'index.ts'), 'export {}');

      const result = await scanner.scan(tempDir);

      // Use path.join for cross-platform compatibility
      expect(result.entryPoints).toContain(path.join('src', 'index.ts'));
    });

    it('should handle nested directories', async () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'src', 'components'));
      fs.writeFileSync(
        path.join(tempDir, 'src', 'components', 'Button.tsx'),
        'export default {}',
      );

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(1);
      expect(result.totalDirectories).toBeGreaterThanOrEqual(2);
    });

    it('should call progress callback', async () => {
      // Create many files to trigger progress
      for (let i = 0; i < 150; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.ts`), '');
      }

      let progressCalled = false;
      await scanner.scan(tempDir, (progress) => {
        progressCalled = true;
        expect(progress.filesScanned).toBeGreaterThan(0);
        expect(progress.currentPath).toBeDefined();
      });

      expect(progressCalled).toBe(true);
    });

    it('should throw for non-existent path', async () => {
      await expect(scanner.scan('/nonexistent/path')).rejects.toThrow();
    });

    it('should throw for file path', async () => {
      const filePath = path.join(tempDir, 'file.txt');
      fs.writeFileSync(filePath, 'content');

      await expect(scanner.scan(filePath)).rejects.toThrow();
    });
  });

  describe('scanFile', () => {
    it('should scan single file', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'const x = 1;\nconst y = 2;');

      const result = await scanner.scanFile(filePath, tempDir);

      expect(result).not.toBeNull();
      expect(result?.name).toBe('test.ts');
      expect(result?.extension).toBe('ts');
      expect(result?.language).toBe(Language.TYPESCRIPT);
      expect(result?.category).toBe(FileCategory.SOURCE);
      expect(result?.lineCount).toBe(2);
    });

    it('should detect test files', async () => {
      const filePath = path.join(tempDir, 'utils.test.ts');
      fs.writeFileSync(filePath, 'describe()');

      const result = await scanner.scanFile(filePath, tempDir);

      expect(result?.category).toBe(FileCategory.TEST);
    });

    it('should detect spec files', async () => {
      const filePath = path.join(tempDir, 'utils.spec.js');
      fs.writeFileSync(filePath, 'describe()');

      const result = await scanner.scanFile(filePath, tempDir);

      expect(result?.category).toBe(FileCategory.TEST);
    });

    it('should detect binary files', async () => {
      const filePath = path.join(tempDir, 'image.png');
      fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const result = await scanner.scanFile(filePath, tempDir);

      expect(result?.isBinary).toBe(true);
      expect(result?.lineCount).toBeUndefined();
    });

    it('should detect hidden files', async () => {
      const filePath = path.join(tempDir, '.hidden');
      fs.writeFileSync(filePath, 'secret');

      const result = await scanner.scanFile(filePath, tempDir);

      expect(result?.isHidden).toBe(true);
    });
  });

  describe('getSummaryString', () => {
    it('should generate summary', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'my-app' }),
      );
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export {}');

      const structure = await scanner.scan(tempDir);
      const summary = scanner.getSummaryString(structure);

      expect(summary).toContain('Project: my-app');
      expect(summary).toContain('Type: nodejs');
      expect(summary).toContain('Files:');
    });
  });

  describe('configuration', () => {
    it('should respect maxDepth', async () => {
      fs.mkdirSync(path.join(tempDir, 'a'));
      fs.mkdirSync(path.join(tempDir, 'a', 'b'));
      fs.mkdirSync(path.join(tempDir, 'a', 'b', 'c'));
      fs.writeFileSync(path.join(tempDir, 'a', 'b', 'c', 'deep.ts'), '');

      const shallowScanner = new FileScanner({ maxDepth: 2 });
      const result = await shallowScanner.scan(tempDir);

      expect(result.totalFiles).toBe(0);
    });

    it('should respect maxFiles', async () => {
      for (let i = 0; i < 20; i++) {
        fs.writeFileSync(path.join(tempDir, `file${i}.ts`), '');
      }

      const limitedScanner = new FileScanner({ maxFiles: 10 });
      const result = await limitedScanner.scan(tempDir);

      expect(result.totalFiles).toBe(10);
    });

    it('should include hidden files when configured', async () => {
      fs.writeFileSync(path.join(tempDir, '.hidden.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'visible.ts'), '');

      const withHidden = new FileScanner({ includeHidden: true });
      const result = await withHidden.scan(tempDir);

      expect(result.totalFiles).toBe(2);
    });

    it('should exclude hidden files by default', async () => {
      fs.writeFileSync(path.join(tempDir, '.hidden.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'visible.ts'), '');

      const result = await scanner.scan(tempDir);

      expect(result.totalFiles).toBe(1);
    });
  });
});

describe('createFileScanner', () => {
  it('should create scanner with factory function', () => {
    const scanner = createFileScanner();
    expect(scanner).toBeInstanceOf(FileScanner);
  });

  it('should pass config to factory', () => {
    const scanner = createFileScanner({ maxDepth: 5 });
    expect(scanner).toBeInstanceOf(FileScanner);
  });
});
