/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TestRunner, createTestRunner } from './testRunner.js';
import {
  TestFramework,
  createFrameworkDetector,
} from './frameworkDetector.js';
import type { TestResultParser } from './testResultParser.js';
import { createTestResultParser } from './testResultParser.js';

describe('FrameworkDetector', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'framework-detect-'));
  });

  describe('detectVitest', () => {
    it('should detect vitest from config file', async () => {
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), 'export default {}');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.VITEST);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.command).toContain('vitest');
    });

    it('should detect vitest from package.json only', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { vitest: '^1.0.0' },
          scripts: { test: 'vitest run' },
        }),
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.VITEST);
    });
  });

  describe('detectJest', () => {
    it('should detect jest from config file', async () => {
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), 'module.exports = {}');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { jest: '^29.0.0' } }),
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.JEST);
      expect(result.command).toContain('jest');
    });

    it('should detect jest from package.json config', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          devDependencies: { jest: '^29.0.0' },
          jest: { testEnvironment: 'node' },
        }),
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.JEST);
    });
  });

  describe('detectMocha', () => {
    it('should detect mocha from config file', async () => {
      fs.writeFileSync(path.join(tempDir, '.mocharc.json'), '{}');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { mocha: '^10.0.0' } }),
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.MOCHA);
      expect(result.command).toContain('mocha');
    });
  });

  describe('detectPytest', () => {
    it('should detect pytest from pytest.ini', async () => {
      fs.writeFileSync(path.join(tempDir, 'pytest.ini'), '[pytest]');

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.PYTEST);
      expect(result.command).toBe('pytest');
    });

    it('should detect pytest from pyproject.toml', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'pyproject.toml'),
        '[tool.pytest.ini_options]\naddopts = "-v"',
      );

      const detector = createFrameworkDetector(tempDir);
      const result = await detector.detect();

      expect(result.framework).toBe(TestFramework.PYTEST);
    });
  });

  describe('detectAll', () => {
    it('should detect multiple frameworks', async () => {
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), 'export default {}');
      fs.writeFileSync(path.join(tempDir, 'pytest.ini'), '[pytest]');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      );

      const detector = createFrameworkDetector(tempDir);
      const results = await detector.detectAll();

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.map((r) => r.framework)).toContain(TestFramework.VITEST);
      expect(results.map((r) => r.framework)).toContain(TestFramework.PYTEST);
    });
  });

  describe('getTestCommand', () => {
    it('should return correct commands for each framework', () => {
      const detector = createFrameworkDetector(tempDir);

      expect(detector.getTestCommand(TestFramework.VITEST)).toBe('npx vitest run');
      expect(detector.getTestCommand(TestFramework.JEST)).toBe('npx jest');
      expect(detector.getTestCommand(TestFramework.MOCHA)).toBe('npx mocha');
      expect(detector.getTestCommand(TestFramework.PYTEST)).toBe('pytest');
    });

    it('should include files in command', () => {
      const detector = createFrameworkDetector(tempDir);
      const files = ['test1.ts', 'test2.ts'];

      expect(detector.getTestCommand(TestFramework.VITEST, files)).toBe(
        'npx vitest run test1.ts test2.ts',
      );
      expect(detector.getTestCommand(TestFramework.JEST, files)).toBe('npx jest test1.ts test2.ts');
    });
  });
});

describe('TestResultParser', () => {
  let parser: TestResultParser;

  beforeEach(() => {
    parser = createTestResultParser();
  });

  describe('parseVitest', () => {
    it('should parse vitest output', () => {
      const output = `
 ✓ src/utils.test.ts (5 tests) 123ms
   ✓ should work correctly 5ms
   ✓ should handle edge cases 3ms
   ✓ should validate input 2ms
   ✓ should return expected output 4ms
   ✓ should be fast 1ms

 Tests: 5 passed, 0 failed, 5 total
 Time: 150ms
      `;

      const result = parser.parse(output, TestFramework.VITEST, 0);

      expect(result.framework).toBe(TestFramework.VITEST);
      expect(result.exitCode).toBe(0);
      expect(result.suites.length).toBe(1);
      expect(result.suites[0].passed).toBe(5);
      expect(result.summary.passedTests).toBe(5);
      expect(result.summary.passRate).toBe(1);
    });

    it('should parse vitest failures', () => {
      const output = `
 ✓ src/utils.test.ts (3 tests) 100ms
   ✓ should work 5ms
   ✗ should not fail 10ms
   ○ should skip
      `;

      const result = parser.parse(output, TestFramework.VITEST, 1);

      expect(result.exitCode).toBe(1);
      expect(result.suites[0].passed).toBe(1);
      expect(result.suites[0].failed).toBe(1);
      expect(result.suites[0].skipped).toBe(1);
    });
  });

  describe('parseJest', () => {
    it('should parse jest output', () => {
      const output = `
PASS src/utils.test.ts
  ✓ should work correctly (5 ms)
  ✓ should handle errors (3 ms)
  ○ skipped test

Test Suites: 1 passed, 1 total
Tests:       2 passed, 1 skipped, 3 total
      `;

      const result = parser.parse(output, TestFramework.JEST, 0);

      expect(result.framework).toBe(TestFramework.JEST);
      expect(result.suites.length).toBe(1);
      expect(result.summary.passedTests).toBe(2);
      expect(result.summary.skippedTests).toBe(1);
    });
  });

  describe('parseMocha', () => {
    it('should parse mocha output', () => {
      const output = `
  utils
    ✓ should work correctly (5ms)
    ✓ should handle errors (3ms)
    - should be pending

  2 passing (8ms)
  1 pending
      `;

      const result = parser.parse(output, TestFramework.MOCHA, 0);

      expect(result.framework).toBe(TestFramework.MOCHA);
      expect(result.summary.passedTests).toBe(2);
      expect(result.summary.skippedTests).toBe(1);
    });
  });

  describe('parsePytest', () => {
    it('should parse pytest output', () => {
      const output = `
test_utils.py::test_function PASSED
test_utils.py::test_another PASSED
test_utils.py::test_skip SKIPPED
test_utils.py::test_fail FAILED

4 passed, 1 failed in 0.5s
      `;

      const result = parser.parse(output, TestFramework.PYTEST, 1);

      expect(result.framework).toBe(TestFramework.PYTEST);
      expect(result.summary.passedTests).toBe(2);
      expect(result.summary.failedTests).toBe(1);
      expect(result.summary.skippedTests).toBe(1);
    });

    it('should parse short pytest format', () => {
      const output = `
...Fs

5 passed, 1 failed in 1.2s
      `;

      const result = parser.parse(output, TestFramework.PYTEST, 1);

      expect(result.summary.passedTests).toBe(3);
      expect(result.summary.failedTests).toBe(1);
      expect(result.summary.skippedTests).toBe(1);
    });
  });

  describe('parseGeneric', () => {
    it('should extract basic counts from generic output', () => {
      const output = `
Running tests...
10 tests passed
2 tests failed
3 tests skipped
      `;

      const result = parser.parse(output, TestFramework.NPM_TEST, 1);

      expect(result.summary.passedTests).toBe(10);
      expect(result.summary.failedTests).toBe(2);
      expect(result.summary.skippedTests).toBe(3);
    });
  });
});

describe('TestRunner', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-runner-'));
  });

  describe('constructor', () => {
    it('should create runner with default config', () => {
      const runner = new TestRunner();
      expect(runner).toBeInstanceOf(TestRunner);
    });

    it('should accept custom config', () => {
      const runner = new TestRunner({
        timeout: 60000,
        workingDir: tempDir,
        verbose: true,
      });
      expect(runner).toBeInstanceOf(TestRunner);
    });
  });

  describe('detectFramework', () => {
    it('should detect framework in project', async () => {
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), 'export default {}');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
      );

      const runner = createTestRunner({ workingDir: tempDir });
      const detection = await runner.detectFramework();

      expect(detection.framework).toBe(TestFramework.VITEST);
    });

    it('should use forced framework from config', async () => {
      const runner = createTestRunner({
        workingDir: tempDir,
        framework: TestFramework.JEST,
      });
      const detection = await runner.detectFramework();

      expect(detection.framework).toBe(TestFramework.JEST);
      expect(detection.confidence).toBe(1);
    });
  });

  describe('isTestFile', () => {
    it('should identify test files', () => {
      const runner = createTestRunner();

      expect(runner.isTestFile('utils.test.ts')).toBe(true);
      expect(runner.isTestFile('utils.spec.ts')).toBe(true);
      expect(runner.isTestFile('test_utils.py')).toBe(true);
      expect(runner.isTestFile('src/__tests__/utils.ts')).toBe(true);
      expect(runner.isTestFile('src/tests/utils.ts')).toBe(true);
    });

    it('should not identify non-test files', () => {
      const runner = createTestRunner();

      expect(runner.isTestFile('utils.ts')).toBe(false);
      expect(runner.isTestFile('index.js')).toBe(false);
    });
  });

  describe('findRelatedTestFiles', () => {
    it('should find test file for source file', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'utils.test.ts'), '');

      const runner = createTestRunner({ workingDir: tempDir });
      const testFiles = await runner.findRelatedTestFiles(['utils.ts']);

      expect(testFiles).toContain('utils.test.ts');
    });

    it('should find test in __tests__ directory', async () => {
      fs.mkdirSync(path.join(tempDir, '__tests__'));
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), '');
      fs.writeFileSync(path.join(tempDir, '__tests__', 'utils.test.ts'), '');

      const runner = createTestRunner({ workingDir: tempDir });
      const testFiles = await runner.findRelatedTestFiles(['utils.ts']);

      // Use path.join for cross-platform compatibility
      expect(testFiles).toContain(path.join('__tests__', 'utils.test.ts'));
    });

    it('should include test files directly', async () => {
      fs.writeFileSync(path.join(tempDir, 'utils.test.ts'), '');

      const runner = createTestRunner({ workingDir: tempDir });
      const testFiles = await runner.findRelatedTestFiles(['utils.test.ts']);

      expect(testFiles).toContain('utils.test.ts');
    });
  });

  describe('getSummaryString', () => {
    it('should format summary string', () => {
      const runner = createTestRunner();
      const result = {
        framework: TestFramework.VITEST,
        suites: [],
        summary: {
          totalSuites: 1,
          passedSuites: 1,
          failedSuites: 0,
          totalTests: 10,
          passedTests: 8,
          failedTests: 1,
          skippedTests: 1,
          duration: 150,
          passRate: 0.8,
        },
        exitCode: 0,
        rawOutput: '',
        timestamp: new Date(),
      };

      const summary = runner.getSummaryString(result);

      expect(summary).toContain('8 passed');
      expect(summary).toContain('1 failed');
      expect(summary).toContain('1 skipped');
      expect(summary).toContain('150ms');
      expect(summary).toContain('80%');
    });

    it('should handle no tests', () => {
      const runner = createTestRunner();
      const result = {
        framework: TestFramework.VITEST,
        suites: [],
        summary: {
          totalSuites: 0,
          passedSuites: 0,
          failedSuites: 0,
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          skippedTests: 0,
          duration: 0,
          passRate: 0,
        },
        exitCode: 0,
        rawOutput: '',
        timestamp: new Date(),
      };

      const summary = runner.getSummaryString(result);
      expect(summary).toBe('No tests found');
    });
  });

  describe('passed', () => {
    it('should return true for passing tests', () => {
      const runner = createTestRunner();
      const result = {
        framework: TestFramework.VITEST,
        suites: [],
        summary: {
          totalSuites: 1,
          passedSuites: 1,
          failedSuites: 0,
          totalTests: 5,
          passedTests: 5,
          failedTests: 0,
          skippedTests: 0,
          duration: 100,
          passRate: 1,
        },
        exitCode: 0,
        rawOutput: '',
        timestamp: new Date(),
      };

      expect(runner.passed(result)).toBe(true);
    });

    it('should return false for failing tests', () => {
      const runner = createTestRunner();
      const result = {
        framework: TestFramework.VITEST,
        suites: [],
        summary: {
          totalSuites: 1,
          passedSuites: 0,
          failedSuites: 1,
          totalTests: 5,
          passedTests: 4,
          failedTests: 1,
          skippedTests: 0,
          duration: 100,
          passRate: 0.8,
        },
        exitCode: 1,
        rawOutput: '',
        timestamp: new Date(),
      };

      expect(runner.passed(result)).toBe(false);
    });
  });

  describe('getFailedTests', () => {
    it('should return list of failed test names', () => {
      const runner = createTestRunner();
      const result = {
        framework: TestFramework.VITEST,
        suites: [
          {
            name: 'test.ts',
            file: 'test.ts',
            tests: [
              { name: 'should pass', passed: true, skipped: false },
              { name: 'should fail', passed: false, skipped: false },
              { name: 'should skip', passed: false, skipped: true },
            ],
            total: 3,
            passed: 1,
            failed: 1,
            skipped: 1,
          },
        ],
        summary: {
          totalSuites: 1,
          passedSuites: 0,
          failedSuites: 1,
          totalTests: 3,
          passedTests: 1,
          failedTests: 1,
          skippedTests: 1,
          duration: 100,
          passRate: 0.33,
        },
        exitCode: 1,
        rawOutput: '',
        timestamp: new Date(),
      };

      const failed = runner.getFailedTests(result);

      expect(failed).toContain('test.ts: should fail');
      expect(failed).not.toContain('test.ts: should pass');
      expect(failed).not.toContain('test.ts: should skip');
    });
  });
});

describe('createTestRunner', () => {
  it('should create runner with factory function', () => {
    const runner = createTestRunner();
    expect(runner).toBeInstanceOf(TestRunner);
  });

  it('should pass config to factory', () => {
    const runner = createTestRunner({
      timeout: 60000,
      verbose: true,
    });
    expect(runner).toBeInstanceOf(TestRunner);
  });
});
