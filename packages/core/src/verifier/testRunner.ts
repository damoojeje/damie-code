/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  FrameworkDetector,
  FrameworkDetection,
} from './frameworkDetector.js';
import {
  TestFramework,
  createFrameworkDetector,
} from './frameworkDetector.js';
import type {
  TestResultParser,
  TestRunResult,
} from './testResultParser.js';
import {
  createTestResultParser,
} from './testResultParser.js';

const execAsync = promisify(exec);

/**
 * Test runner configuration
 */
export interface TestRunnerConfig {
  /** Test execution timeout in ms */
  timeout: number;
  /** Working directory */
  workingDir: string;
  /** Force specific framework */
  framework?: TestFramework;
  /** Additional arguments to pass to test command */
  extraArgs?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Run tests in watch mode */
  watch?: boolean;
  /** Run tests with coverage */
  coverage?: boolean;
  /** Verbose output */
  verbose?: boolean;
}

/**
 * Default test runner configuration
 */
export const DEFAULT_TEST_RUNNER_CONFIG: TestRunnerConfig = {
  timeout: 300000, // 5 minutes
  workingDir: process.cwd(),
  verbose: false,
};

/**
 * Test runner options for a single run
 */
export interface TestRunOptions {
  /** Specific files to test */
  files?: string[];
  /** Test name pattern to match */
  testPattern?: string;
  /** Override timeout for this run */
  timeout?: number;
  /** Run only failed tests */
  onlyFailed?: boolean;
}

/**
 * Test Runner
 *
 * Runs automated tests and parses results for verification.
 * Supports Vitest, Jest, Mocha, and Pytest.
 */
export class TestRunner {
  private config: TestRunnerConfig;
  private detector: FrameworkDetector;
  private parser: TestResultParser;
  private detectedFramework: FrameworkDetection | null = null;

  constructor(config: Partial<TestRunnerConfig> = {}) {
    this.config = { ...DEFAULT_TEST_RUNNER_CONFIG, ...config };
    this.detector = createFrameworkDetector(this.config.workingDir);
    this.parser = createTestResultParser();
  }

  /**
   * Detect the test framework
   */
  async detectFramework(): Promise<FrameworkDetection> {
    if (this.config.framework) {
      return {
        framework: this.config.framework,
        command: this.detector.getTestCommand(this.config.framework),
        confidence: 1,
        notes: ['Framework forced via config'],
      };
    }

    this.detectedFramework = await this.detector.detect();
    return this.detectedFramework;
  }

  /**
   * Run all tests
   */
  async runAll(options: TestRunOptions = {}): Promise<TestRunResult> {
    const detection = await this.detectFramework();

    if (detection.framework === TestFramework.UNKNOWN) {
      return this.createEmptyResult(detection.framework, 1, 'No test framework detected');
    }

    const command = this.buildCommand(detection, options);
    return this.executeTests(command, detection.framework, options);
  }

  /**
   * Run tests for specific files
   */
  async runForFiles(files: string[], options: TestRunOptions = {}): Promise<TestRunResult> {
    // Filter to only test files that exist
    const existingFiles = files.filter((f) => {
      const fullPath = path.resolve(this.config.workingDir, f);
      return fs.existsSync(fullPath);
    });

    if (existingFiles.length === 0) {
      return this.createEmptyResult(TestFramework.UNKNOWN, 0, 'No test files found');
    }

    return this.runAll({ ...options, files: existingFiles });
  }

  /**
   * Run tests for changed files (finds related test files)
   */
  async runForChangedFiles(changedFiles: string[]): Promise<TestRunResult> {
    const testFiles = await this.findRelatedTestFiles(changedFiles);

    if (testFiles.length === 0) {
      return this.createEmptyResult(TestFramework.UNKNOWN, 0, 'No related test files found');
    }

    return this.runForFiles(testFiles);
  }

  /**
   * Find test files related to source files
   */
  async findRelatedTestFiles(sourceFiles: string[]): Promise<string[]> {
    const testFiles: Set<string> = new Set();

    for (const file of sourceFiles) {
      const parsed = path.parse(file);
      const dir = parsed.dir;
      const name = parsed.name;
      const ext = parsed.ext;

      // Check if file is already a test file
      if (this.isTestFile(file)) {
        testFiles.add(file);
        continue;
      }

      // Common test file patterns
      const testPatterns = [
        // Same directory
        path.join(dir, `${name}.test${ext}`),
        path.join(dir, `${name}.spec${ext}`),
        path.join(dir, `${name}_test${ext}`),
        path.join(dir, `test_${name}${ext}`),
        // __tests__ directory
        path.join(dir, '__tests__', `${name}.test${ext}`),
        path.join(dir, '__tests__', `${name}.spec${ext}`),
        // tests directory at same level
        path.join(dir, 'tests', `${name}.test${ext}`),
        path.join(dir, 'tests', `${name}.spec${ext}`),
        // test directory at project root
        path.join('tests', `${name}.test${ext}`),
        path.join('tests', `${name}.spec${ext}`),
        path.join('test', `${name}.test${ext}`),
        path.join('test', `${name}.spec${ext}`),
      ];

      for (const pattern of testPatterns) {
        const fullPath = path.resolve(this.config.workingDir, pattern);
        if (fs.existsSync(fullPath)) {
          testFiles.add(pattern);
        }
      }

      // For Python files
      if (ext === '.py') {
        const pyTestPatterns = [
          path.join(dir, `test_${name}${ext}`),
          path.join(dir, `${name}_test${ext}`),
          path.join('tests', `test_${name}${ext}`),
          path.join('tests', `${name}_test${ext}`),
        ];

        for (const pattern of pyTestPatterns) {
          const fullPath = path.resolve(this.config.workingDir, pattern);
          if (fs.existsSync(fullPath)) {
            testFiles.add(pattern);
          }
        }
      }
    }

    return Array.from(testFiles);
  }

  /**
   * Check if file is a test file
   */
  isTestFile(file: string): boolean {
    const name = path.basename(file);
    return (
      name.includes('.test.') ||
      name.includes('.spec.') ||
      name.includes('_test.') ||
      name.startsWith('test_') ||
      file.includes('/__tests__/') ||
      file.includes('/tests/')
    );
  }

  /**
   * Build test command
   */
  private buildCommand(detection: FrameworkDetection, options: TestRunOptions): string {
    let command = detection.command;
    const args: string[] = [];

    // Add file arguments
    if (options.files && options.files.length > 0) {
      switch (detection.framework) {
        case TestFramework.VITEST:
          args.push(...options.files);
          break;

        case TestFramework.JEST:
          args.push(...options.files);
          break;

        case TestFramework.MOCHA:
          args.push(...options.files);
          break;

        case TestFramework.PYTEST:
          args.push(...options.files);
          break;

        default:
          // For npm test, we can't pass files directly
          break;
      }
    }

    // Add test pattern
    if (options.testPattern) {
      switch (detection.framework) {
        case TestFramework.VITEST:
          args.push('-t', `"${options.testPattern}"`);
          break;

        case TestFramework.JEST:
          args.push('-t', `"${options.testPattern}"`);
          break;

        case TestFramework.MOCHA:
          args.push('-g', `"${options.testPattern}"`);
          break;

        case TestFramework.PYTEST:
          args.push('-k', `"${options.testPattern}"`);
          break;

        default:
          break;
      }
    }

    // Add coverage
    if (this.config.coverage) {
      switch (detection.framework) {
        case TestFramework.VITEST:
          args.push('--coverage');
          break;

        case TestFramework.JEST:
          args.push('--coverage');
          break;

        case TestFramework.PYTEST:
          args.push('--cov');
          break;

        default:
          break;
      }
    }

    // Add verbose
    if (this.config.verbose) {
      switch (detection.framework) {
        case TestFramework.VITEST:
          args.push('--reporter=verbose');
          break;

        case TestFramework.JEST:
          args.push('--verbose');
          break;

        case TestFramework.PYTEST:
          args.push('-v');
          break;

        default:
          break;
      }
    }

    // Add only failed
    if (options.onlyFailed) {
      switch (detection.framework) {
        case TestFramework.VITEST:
          args.push('--changed');
          break;

        case TestFramework.JEST:
          args.push('--onlyFailures');
          break;

        case TestFramework.PYTEST:
          args.push('--lf');
          break;

        default:
          break;
      }
    }

    // Add extra args from config
    if (this.config.extraArgs) {
      args.push(...this.config.extraArgs);
    }

    if (args.length > 0) {
      command = `${command} ${args.join(' ')}`;
    }

    return command;
  }

  /**
   * Execute tests
   */
  private async executeTests(
    command: string,
    framework: TestFramework,
    options: TestRunOptions,
  ): Promise<TestRunResult> {
    const timeout = options.timeout ?? this.config.timeout;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.workingDir,
        timeout,
        maxBuffer: 50 * 1024 * 1024, // 50MB
        env: {
          ...process.env,
          ...this.config.env,
          // Force color output for better parsing
          FORCE_COLOR: '1',
        },
      });

      const output = stdout + '\n' + stderr;
      return this.parser.parse(output, framework, 0);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        const output = (execError.stdout ?? '') + '\n' + (execError.stderr ?? '');
        return this.parser.parse(output, framework, execError.code ?? 1);
      }

      return this.createEmptyResult(
        framework,
        1,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Create empty result
   */
  private createEmptyResult(
    framework: TestFramework,
    exitCode: number,
    message: string,
  ): TestRunResult {
    return {
      framework,
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
      exitCode,
      rawOutput: message,
      timestamp: new Date(),
    };
  }

  /**
   * Get test summary string
   */
  getSummaryString(result: TestRunResult): string {
    const { summary } = result;

    if (summary.totalTests === 0) {
      return 'No tests found';
    }

    const parts: string[] = [];

    if (summary.passedTests > 0) {
      parts.push(`${summary.passedTests} passed`);
    }
    if (summary.failedTests > 0) {
      parts.push(`${summary.failedTests} failed`);
    }
    if (summary.skippedTests > 0) {
      parts.push(`${summary.skippedTests} skipped`);
    }

    const duration = summary.duration > 0 ? ` (${summary.duration}ms)` : '';
    const passRate = Math.round(summary.passRate * 100);

    return `${parts.join(', ')}${duration} - ${passRate}% pass rate`;
  }

  /**
   * Check if tests passed
   */
  passed(result: TestRunResult): boolean {
    return result.exitCode === 0 && result.summary.failedTests === 0;
  }

  /**
   * Get failed test names
   */
  getFailedTests(result: TestRunResult): string[] {
    const failed: string[] = [];

    for (const suite of result.suites) {
      for (const test of suite.tests) {
        if (!test.passed && !test.skipped) {
          failed.push(suite.file ? `${suite.file}: ${test.name}` : test.name);
        }
      }
    }

    return failed;
  }
}

/**
 * Create a test runner
 */
export function createTestRunner(config?: Partial<TestRunnerConfig>): TestRunner {
  return new TestRunner(config);
}

// Re-export types from parser
export type { TestRunResult, TestSummary, TestResult, TestSuiteResult } from './testResultParser.js';
