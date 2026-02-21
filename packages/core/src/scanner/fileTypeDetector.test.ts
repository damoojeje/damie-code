/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileTypeDetector, createFileTypeDetector } from './fileTypeDetector.js';
import { FileCategory, Language } from './types.js';

describe('FileTypeDetector', () => {
  let detector: FileTypeDetector;
  let tempDir: string;

  beforeEach(() => {
    detector = new FileTypeDetector();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'detector-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('detect', () => {
    it('should detect TypeScript files', () => {
      const result = detector.detect('src/index.ts');

      expect(result.language).toBe(Language.TYPESCRIPT);
      expect(result.category).toBe(FileCategory.SOURCE);
      expect(result.isBinary).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect JavaScript files', () => {
      const result = detector.detect('app.js');

      expect(result.language).toBe(Language.JAVASCRIPT);
      expect(result.category).toBe(FileCategory.SOURCE);
    });

    it('should detect Python files', () => {
      const result = detector.detect('main.py');

      expect(result.language).toBe(Language.PYTHON);
      expect(result.category).toBe(FileCategory.SOURCE);
    });

    it('should detect Rust files', () => {
      const result = detector.detect('lib.rs');

      expect(result.language).toBe(Language.RUST);
      expect(result.category).toBe(FileCategory.SOURCE);
    });

    it('should detect Go files', () => {
      const result = detector.detect('main.go');

      expect(result.language).toBe(Language.GO);
      expect(result.category).toBe(FileCategory.SOURCE);
    });

    it('should detect binary files', () => {
      expect(detector.detect('image.png').isBinary).toBe(true);
      expect(detector.detect('video.mp4').isBinary).toBe(true);
      expect(detector.detect('archive.zip').isBinary).toBe(true);
      expect(detector.detect('font.woff2').isBinary).toBe(true);
    });
  });

  describe('test file detection', () => {
    it('should detect .test.ts files', () => {
      const result = detector.detect('utils.test.ts');

      expect(result.isTest).toBe(true);
      expect(result.category).toBe(FileCategory.TEST);
    });

    it('should detect .spec.ts files', () => {
      const result = detector.detect('component.spec.tsx');

      expect(result.isTest).toBe(true);
      expect(result.category).toBe(FileCategory.TEST);
    });

    it('should detect _test.ts files', () => {
      const result = detector.detect('utils_test.ts');

      expect(result.isTest).toBe(true);
    });

    it('should detect test_*.py files', () => {
      const result = detector.detect('test_utils.py');

      expect(result.isTest).toBe(true);
    });

    it('should detect *_test.py files', () => {
      const result = detector.detect('utils_test.py');

      expect(result.isTest).toBe(true);
    });

    it('should detect _test.go files', () => {
      const result = detector.detect('handler_test.go');

      expect(result.isTest).toBe(true);
    });
  });

  describe('config file detection', () => {
    it('should detect package.json', () => {
      const result = detector.detect('package.json');

      expect(result.isConfig).toBe(true);
      expect(result.category).toBe(FileCategory.CONFIG);
    });

    it('should detect tsconfig.json', () => {
      const result = detector.detect('tsconfig.json');

      expect(result.isConfig).toBe(true);
    });

    it('should detect .eslintrc files', () => {
      expect(detector.detect('.eslintrc').isConfig).toBe(true);
      expect(detector.detect('.eslintrc.js').isConfig).toBe(true);
      expect(detector.detect('.eslintrc.json').isConfig).toBe(true);
    });

    it('should detect vite.config.ts', () => {
      const result = detector.detect('vite.config.ts');

      expect(result.isConfig).toBe(true);
    });

    it('should detect Dockerfile', () => {
      const result = detector.detect('Dockerfile');

      expect(result.isConfig).toBe(true);
    });

    it('should detect .env files', () => {
      expect(detector.detect('.env').isConfig).toBe(true);
      expect(detector.detect('.env.local').isConfig).toBe(true);
      expect(detector.detect('.env.production').isConfig).toBe(true);
    });

    it('should detect pyproject.toml', () => {
      const result = detector.detect('pyproject.toml');

      expect(result.isConfig).toBe(true);
    });

    it('should detect Cargo.toml', () => {
      const result = detector.detect('Cargo.toml');

      expect(result.isConfig).toBe(true);
    });

    it('should detect go.mod', () => {
      const result = detector.detect('go.mod');

      expect(result.isConfig).toBe(true);
    });
  });

  describe('build artifact detection', () => {
    it('should detect node_modules', () => {
      const result = detector.detect('node_modules/package/index.js');

      expect(result.isBuildArtifact).toBe(true);
    });

    it('should detect dist folder', () => {
      const result = detector.detect('dist/bundle.js');

      expect(result.isBuildArtifact).toBe(true);
    });

    it('should detect build folder', () => {
      const result = detector.detect('build/output.js');

      expect(result.isBuildArtifact).toBe(true);
    });

    it('should detect __pycache__', () => {
      const result = detector.detect('__pycache__/module.pyc');

      expect(result.isBuildArtifact).toBe(true);
    });

    it('should detect target folder (Rust)', () => {
      const result = detector.detect('target/debug/binary');

      expect(result.isBuildArtifact).toBe(true);
    });
  });

  describe('documentation detection', () => {
    it('should detect markdown files', () => {
      const result = detector.detect('README.md');

      expect(result.isDocumentation).toBe(true);
      expect(result.category).toBe(FileCategory.DOCUMENTATION);
    });

    it('should detect txt files', () => {
      const result = detector.detect('notes.txt');

      expect(result.isDocumentation).toBe(true);
    });
  });

  describe('detectWithContent', () => {
    it('should detect Python from shebang', () => {
      const filePath = path.join(tempDir, 'script');
      fs.writeFileSync(filePath, '#!/usr/bin/env python3\nprint("hello")');

      const result = detector.detectWithContent(filePath);

      expect(result.language).toBe(Language.PYTHON);
      expect(result.detectionMethod).toBe('content');
    });

    it('should detect bash from shebang', () => {
      const filePath = path.join(tempDir, 'script');
      fs.writeFileSync(filePath, '#!/bin/bash\necho "hello"');

      const result = detector.detectWithContent(filePath);

      expect(result.language).toBe(Language.SHELL);
    });

    it('should detect node from shebang', () => {
      const filePath = path.join(tempDir, 'script');
      fs.writeFileSync(filePath, '#!/usr/bin/env node\nconsole.log("hello")');

      const result = detector.detectWithContent(filePath);

      expect(result.language).toBe(Language.JAVASCRIPT);
    });

    it('should prefer extension over content', () => {
      const filePath = path.join(tempDir, 'script.ts');
      fs.writeFileSync(filePath, '#!/usr/bin/env python3\n// TypeScript');

      const result = detector.detectWithContent(filePath);

      // Extension takes precedence
      expect(result.language).toBe(Language.TYPESCRIPT);
    });
  });

  describe('utility methods', () => {
    it('should check test files', () => {
      expect(detector.isTestFile('utils.test.ts')).toBe(true);
      expect(detector.isTestFile('utils.ts')).toBe(false);
    });

    it('should check config files', () => {
      expect(detector.isConfigFile('package.json')).toBe(true);
      expect(detector.isConfigFile('index.ts')).toBe(false);
    });

    it('should check build artifacts', () => {
      expect(detector.isBuildArtifact('node_modules/pkg/index.js')).toBe(true);
      expect(detector.isBuildArtifact('src/index.ts')).toBe(false);
    });

    it('should check binary files', () => {
      expect(detector.isBinaryFile('image.png')).toBe(true);
      expect(detector.isBinaryFile('code.ts')).toBe(false);
    });

    it('should get language for extension', () => {
      expect(detector.getLanguageForExtension('ts')).toBe(Language.TYPESCRIPT);
      expect(detector.getLanguageForExtension('.js')).toBe(Language.JAVASCRIPT);
      expect(detector.getLanguageForExtension('unknown')).toBe(Language.OTHER);
    });

    it('should get supported extensions', () => {
      const extensions = detector.getSupportedExtensions();

      expect(extensions).toContain('ts');
      expect(extensions).toContain('js');
      expect(extensions).toContain('py');
      expect(extensions.length).toBeGreaterThan(20);
    });

    it('should get extensions for language', () => {
      const tsExtensions = detector.getExtensionsForLanguage(Language.TYPESCRIPT);

      expect(tsExtensions).toContain('ts');
      expect(tsExtensions).toContain('tsx');
    });
  });
});

describe('createFileTypeDetector', () => {
  it('should create detector with factory function', () => {
    const detector = createFileTypeDetector();
    expect(detector).toBeInstanceOf(FileTypeDetector);
  });
});
