/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { TestFramework } from './frameworkDetector.js';

/**
 * Single test result
 */
export interface TestResult {
  /** Test name/description */
  name: string;
  /** Test file path */
  file?: string;
  /** Test passed */
  passed: boolean;
  /** Test was skipped */
  skipped: boolean;
  /** Duration in ms */
  duration?: number;
  /** Error message if failed */
  error?: string;
  /** Stack trace if failed */
  stackTrace?: string;
}

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite name */
  name: string;
  /** Suite file path */
  file?: string;
  /** Individual test results */
  tests: TestResult[];
  /** Total tests */
  total: number;
  /** Passed tests */
  passed: number;
  /** Failed tests */
  failed: number;
  /** Skipped tests */
  skipped: number;
  /** Suite duration in ms */
  duration?: number;
}

/**
 * Overall test run result
 */
export interface TestRunResult {
  /** Test framework used */
  framework: TestFramework;
  /** Individual suite results */
  suites: TestSuiteResult[];
  /** Summary */
  summary: TestSummary;
  /** Exit code */
  exitCode: number;
  /** Raw output */
  rawOutput: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Test run summary
 */
export interface TestSummary {
  /** Total test suites */
  totalSuites: number;
  /** Passed suites */
  passedSuites: number;
  /** Failed suites */
  failedSuites: number;
  /** Total tests */
  totalTests: number;
  /** Passed tests */
  passedTests: number;
  /** Failed tests */
  failedTests: number;
  /** Skipped tests */
  skippedTests: number;
  /** Total duration in ms */
  duration: number;
  /** Pass rate (0-1) */
  passRate: number;
}

/**
 * Test Result Parser
 *
 * Parses output from various test frameworks into a unified format.
 */
export class TestResultParser {
  /**
   * Parse test output based on framework
   */
  parse(output: string, framework: TestFramework, exitCode: number): TestRunResult {
    switch (framework) {
      case TestFramework.VITEST:
        return this.parseVitest(output, exitCode);

      case TestFramework.JEST:
        return this.parseJest(output, exitCode);

      case TestFramework.MOCHA:
        return this.parseMocha(output, exitCode);

      case TestFramework.PYTEST:
        return this.parsePytest(output, exitCode);

      default:
        return this.parseGeneric(output, framework, exitCode);
    }
  }

  /**
   * Parse Vitest output
   */
  private parseVitest(output: string, exitCode: number): TestRunResult {
    const suites: TestSuiteResult[] = [];
    const lines = output.split('\n');

    let currentSuite: TestSuiteResult | null = null;

    for (const line of lines) {
      // Match test file line: ✓ src/test.ts (5 tests) 123ms
      const fileMatch = line.match(
        /^[\s]*[✓✗○][\s]+(.+\.(?:test|spec)\.(?:ts|tsx|js|jsx))(?:\s+\((\d+)\s+tests?\))?(?:\s+(\d+)ms)?/,
      );
      if (fileMatch) {
        if (currentSuite) {
          suites.push(currentSuite);
        }
        currentSuite = {
          name: fileMatch[1],
          file: fileMatch[1],
          tests: [],
          total: parseInt(fileMatch[2] ?? '0', 10),
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: fileMatch[3] ? parseInt(fileMatch[3], 10) : undefined,
        };
        continue;
      }

      // Match individual test: ✓ should work correctly 5ms
      const testMatch = line.match(/^[\s]*([✓✗○])[\s]+(.+?)(?:\s+(\d+)ms)?$/);
      if (testMatch && currentSuite) {
        const status = testMatch[1];
        const test: TestResult = {
          name: testMatch[2].trim(),
          passed: status === '✓',
          skipped: status === '○',
          duration: testMatch[3] ? parseInt(testMatch[3], 10) : undefined,
        };

        if (test.passed) currentSuite.passed++;
        else if (test.skipped) currentSuite.skipped++;
        else currentSuite.failed++;

        currentSuite.tests.push(test);
      }

      // Match summary line: Tests: 5 passed, 1 failed, 6 total
      const summaryMatch = line.match(
        /Tests?:?\s*(\d+)\s*passed,?\s*(\d+)\s*failed,?\s*(\d+)\s*total/i,
      );
      if (summaryMatch) {
        // Use this for validation but don't create a suite
      }
    }

    if (currentSuite) {
      suites.push(currentSuite);
    }

    return this.buildResult(output, TestFramework.VITEST, exitCode, suites);
  }

  /**
   * Parse Jest output
   */
  private parseJest(output: string, exitCode: number): TestRunResult {
    const suites: TestSuiteResult[] = [];
    const lines = output.split('\n');

    let currentSuite: TestSuiteResult | null = null;
    let inFailure = false;
    let _currentError = '';

    for (const line of lines) {
      // Match test file: PASS src/test.ts
      const fileMatch = line.match(/^(PASS|FAIL)\s+(.+\.(?:test|spec)\.(?:ts|tsx|js|jsx))$/);
      if (fileMatch) {
        if (currentSuite) {
          suites.push(currentSuite);
        }
        currentSuite = {
          name: fileMatch[2],
          file: fileMatch[2],
          tests: [],
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
        };
        inFailure = false;
        continue;
      }

      // Match individual test: ✓ should work (5 ms)
      const testMatch = line.match(/^[\s]*(✓|✕|○)[\s]+(.+?)(?:\s+\((\d+)\s*(?:ms)?\))?$/);
      if (testMatch && currentSuite) {
        const status = testMatch[1];
        const test: TestResult = {
          name: testMatch[2].trim(),
          passed: status === '✓',
          skipped: status === '○',
          duration: testMatch[3] ? parseInt(testMatch[3], 10) : undefined,
        };

        if (test.passed) currentSuite.passed++;
        else if (test.skipped) currentSuite.skipped++;
        else currentSuite.failed++;

        currentSuite.total++;
        currentSuite.tests.push(test);
      }

      // Track failure details
      if (line.includes('● ') && currentSuite) {
        inFailure = true;
        _currentError = line;
      } else if (inFailure && line.trim()) {
        _currentError += '\n' + line;
      }
    }

    if (currentSuite) {
      suites.push(currentSuite);
    }

    return this.buildResult(output, TestFramework.JEST, exitCode, suites);
  }

  /**
   * Parse Mocha output
   */
  private parseMocha(output: string, exitCode: number): TestRunResult {
    const suites: TestSuiteResult[] = [];
    const lines = output.split('\n');

    let currentSuite: TestSuiteResult | null = null;

    for (const line of lines) {
      // Match describe block
      const describeMatch = line.match(/^[\s]*(.+)$/);
      if (describeMatch && !line.match(/[✓✗-]/) && line.trim() && !line.includes('passing')) {
        // This might be a describe block
      }

      // Match individual test: ✓ should work (5ms)
      const testMatch = line.match(/^[\s]*(✓|✗|-)[\s]+(.+?)(?:\s+\((\d+)ms\))?$/);
      if (testMatch) {
        if (!currentSuite) {
          currentSuite = {
            name: 'Default Suite',
            tests: [],
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
          };
        }

        const status = testMatch[1];
        const test: TestResult = {
          name: testMatch[2].trim(),
          passed: status === '✓',
          skipped: status === '-',
          duration: testMatch[3] ? parseInt(testMatch[3], 10) : undefined,
        };

        if (test.passed) currentSuite.passed++;
        else if (test.skipped) currentSuite.skipped++;
        else currentSuite.failed++;

        currentSuite.total++;
        currentSuite.tests.push(test);
      }

      // Match summary: X passing (Xms)
      const summaryMatch = line.match(/(\d+)\s+passing\s+\((\d+)(?:ms|s)\)/);
      if (summaryMatch && currentSuite) {
        const unit = line.includes('s)') && !line.includes('ms)') ? 1000 : 1;
        currentSuite.duration = parseInt(summaryMatch[2], 10) * unit;
      }
    }

    if (currentSuite) {
      suites.push(currentSuite);
    }

    return this.buildResult(output, TestFramework.MOCHA, exitCode, suites);
  }

  /**
   * Parse Pytest output
   */
  private parsePytest(output: string, exitCode: number): TestRunResult {
    const suites: TestSuiteResult[] = [];
    const lines = output.split('\n');

    const suite: TestSuiteResult = {
      name: 'pytest',
      tests: [],
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
    };

    for (const line of lines) {
      // Match test result: test_file.py::test_name PASSED/FAILED
      const testMatch = line.match(/^(.+\.py)::(.+?)\s+(PASSED|FAILED|SKIPPED)/);
      if (testMatch) {
        const status = testMatch[3];
        const test: TestResult = {
          name: testMatch[2],
          file: testMatch[1],
          passed: status === 'PASSED',
          skipped: status === 'SKIPPED',
        };

        if (test.passed) suite.passed++;
        else if (test.skipped) suite.skipped++;
        else suite.failed++;

        suite.total++;
        suite.tests.push(test);
      }

      // Match short format: .FsE
      if (line.match(/^[.FsExX]+$/) && !suite.tests.length) {
        for (const char of line) {
          if (char === '.') suite.passed++;
          else if (char === 'F' || char === 'E' || char === 'X') suite.failed++;
          else if (char === 's' || char === 'x') suite.skipped++;
        }
        suite.total = suite.passed + suite.failed + suite.skipped;
      }

      // Match summary: X passed, X failed in Xs
      const summaryMatch = line.match(/(\d+)\s+passed.*?in\s+(\d+\.?\d*)s/);
      if (summaryMatch) {
        suite.duration = Math.round(parseFloat(summaryMatch[2]) * 1000);
      }
    }

    if (suite.total > 0) {
      suites.push(suite);
    }

    return this.buildResult(output, TestFramework.PYTEST, exitCode, suites);
  }

  /**
   * Parse generic test output
   */
  private parseGeneric(output: string, framework: TestFramework, exitCode: number): TestRunResult {
    // Try to extract basic pass/fail counts from output
    const passMatch = output.match(/(\d+)\s*(?:tests?\s*)?pass(?:ed|ing)?/i);
    const failMatch = output.match(/(\d+)\s*(?:tests?\s*)?fail(?:ed|ing|ures?)?/i);
    const skipMatch = output.match(/(\d+)\s*(?:tests?\s*)?skip(?:ped)?/i);

    const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
    const skipped = skipMatch ? parseInt(skipMatch[1], 10) : 0;
    const total = passed + failed + skipped;

    const suite: TestSuiteResult = {
      name: 'Test Suite',
      tests: [],
      total,
      passed,
      failed,
      skipped,
    };

    return this.buildResult(output, framework, exitCode, total > 0 ? [suite] : []);
  }

  /**
   * Build final test result
   */
  private buildResult(
    output: string,
    framework: TestFramework,
    exitCode: number,
    suites: TestSuiteResult[],
  ): TestRunResult {
    const summary = this.calculateSummary(suites);

    return {
      framework,
      suites,
      summary,
      exitCode,
      rawOutput: output,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate summary from suites
   */
  private calculateSummary(suites: TestSuiteResult[]): TestSummary {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let skippedTests = 0;
    let duration = 0;
    let passedSuites = 0;
    let failedSuites = 0;

    for (const suite of suites) {
      totalTests += suite.total;
      passedTests += suite.passed;
      failedTests += suite.failed;
      skippedTests += suite.skipped;
      duration += suite.duration ?? 0;

      if (suite.failed > 0) {
        failedSuites++;
      } else {
        passedSuites++;
      }
    }

    return {
      totalSuites: suites.length,
      passedSuites,
      failedSuites,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      duration,
      passRate: totalTests > 0 ? passedTests / totalTests : 0,
    };
  }
}

/**
 * Create a test result parser
 */
export function createTestResultParser(): TestResultParser {
  return new TestResultParser();
}
