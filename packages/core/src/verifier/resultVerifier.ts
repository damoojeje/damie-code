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
  VerificationReport,
  VerificationCheck,
  VerificationSummary,
  AcceptanceCriterion,
  VerifierConfig,
} from './types.js';
import {
  VerificationStatus,
  VerificationCheckType,
  DEFAULT_VERIFIER_CONFIG,
} from './types.js';

const execAsync = promisify(exec);

/**
 * Result Verifier
 *
 * Verifies task results against acceptance criteria, runs tests,
 * checks syntax, and generates verification reports.
 */
export class ResultVerifier {
  private config: VerifierConfig;

  constructor(config: Partial<VerifierConfig> = {}) {
    this.config = { ...DEFAULT_VERIFIER_CONFIG, ...config };
  }

  /**
   * Verify task results
   */
  async verify(
    taskDescription: string,
    criteria: AcceptanceCriterion[],
    filesChanged: string[] = [],
    workingDir: string = process.cwd(),
  ): Promise<VerificationReport> {
    const startTime = Date.now();
    const checks: VerificationCheck[] = [];
    const reportId = this.generateId('report');

    // Verify acceptance criteria
    for (const criterion of criteria) {
      const check = await this.verifyCriterion(criterion, workingDir);
      checks.push(check);

      if (check.status === VerificationStatus.FAILED && !this.config.continueOnFailure) {
        break;
      }
    }

    // Check syntax of changed files
    if (this.config.checkSyntax && filesChanged.length > 0) {
      const syntaxChecks = await this.checkSyntax(filesChanged, workingDir);
      checks.push(...syntaxChecks);
    }

    // Verify file changes
    if (this.config.verifyFileChanges && filesChanged.length > 0) {
      const fileChecks = await this.verifyFileChanges(filesChanged, workingDir);
      checks.push(...fileChecks);
    }

    // Run type check
    if (this.config.runTypeCheck) {
      const typeCheck = await this.runCommand(
        'type_check',
        'Type Check',
        this.config.typeCheckCommand,
        workingDir,
        VerificationCheckType.TYPE_CHECK,
      );
      checks.push(typeCheck);
    }

    // Run lint
    if (this.config.runLint) {
      const lintCheck = await this.runCommand(
        'lint_check',
        'Lint Check',
        this.config.lintCommand,
        workingDir,
        VerificationCheckType.LINT_CHECK,
      );
      checks.push(lintCheck);
    }

    // Run tests
    if (this.config.runTests) {
      const testCheck = await this.runCommand(
        'test_run',
        'Test Run',
        this.config.testCommand,
        workingDir,
        VerificationCheckType.TEST_RUN,
      );
      checks.push(testCheck);
    }

    // Generate summary
    const summary = this.generateSummary(checks);

    // Determine overall status
    const status = this.determineOverallStatus(summary);
    const passed = status === VerificationStatus.PASSED || status === VerificationStatus.WARNING;

    // Generate recommendations
    const recommendations = this.generateRecommendations(checks, passed);

    return {
      id: reportId,
      taskDescription,
      status,
      checks,
      summary,
      passed,
      timestamp: new Date(),
      totalDuration: Date.now() - startTime,
      filesChanged,
      recommendations,
    };
  }

  /**
   * Verify a single acceptance criterion
   */
  private async verifyCriterion(
    criterion: AcceptanceCriterion,
    workingDir: string,
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const check: VerificationCheck = {
      id: criterion.id,
      type: VerificationCheckType.ACCEPTANCE_CRITERIA,
      name: criterion.description,
      status: VerificationStatus.SKIPPED,
      message: '',
      duration: 0,
      files: criterion.file ? [criterion.file] : [],
      suggestions: [],
    };

    try {
      switch (criterion.verificationMethod) {
        case 'command':
          if (criterion.command) {
            const result = await this.executeCommand(
              criterion.command,
              workingDir,
            );

            if (criterion.expectedPattern) {
              const regex = new RegExp(criterion.expectedPattern);
              if (regex.test(result.stdout)) {
                check.status = VerificationStatus.PASSED;
                check.message = 'Command output matches expected pattern';
              } else {
                check.status = VerificationStatus.FAILED;
                check.message = 'Command output does not match expected pattern';
                check.expected = criterion.expectedPattern;
                check.actual = result.stdout.substring(0, 200);
                check.suggestions.push('Check command output against expected pattern');
              }
            } else if (result.exitCode === 0) {
              check.status = VerificationStatus.PASSED;
              check.message = 'Command executed successfully';
            } else {
              check.status = VerificationStatus.FAILED;
              check.message = `Command failed with exit code ${result.exitCode}`;
              check.output = result.stderr || result.stdout;
            }
            check.command = criterion.command;
          }
          break;

        case 'automated':
          if (criterion.file) {
            // Check if file exists and has expected content
            const filePath = path.resolve(workingDir, criterion.file);
            if (fs.existsSync(filePath)) {
              if (criterion.expectedPattern) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const regex = new RegExp(criterion.expectedPattern);
                if (regex.test(content)) {
                  check.status = VerificationStatus.PASSED;
                  check.message = 'File content matches expected pattern';
                } else {
                  check.status = VerificationStatus.FAILED;
                  check.message = 'File content does not match expected pattern';
                  check.suggestions.push('Review file content against expected pattern');
                }
              } else {
                check.status = VerificationStatus.PASSED;
                check.message = 'File exists';
              }
            } else {
              check.status = VerificationStatus.FAILED;
              check.message = `File not found: ${criterion.file}`;
              check.suggestions.push(`Create file: ${criterion.file}`);
            }
          } else {
            check.status = VerificationStatus.SKIPPED;
            check.message = 'No automated verification available';
          }
          break;

        case 'manual':
        default:
          check.status = VerificationStatus.SKIPPED;
          check.message = 'Manual verification required';
          check.suggestions.push('Manually verify this criterion');
          break;
      }
    } catch (error) {
      check.status = VerificationStatus.ERROR;
      check.message = error instanceof Error ? error.message : String(error);
      check.suggestions.push('Fix the error and retry verification');
    }

    check.duration = Date.now() - startTime;
    return check;
  }

  /**
   * Check syntax of files
   */
  private async checkSyntax(
    files: string[],
    workingDir: string,
  ): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const filePath = path.resolve(workingDir, file);

      if (!fs.existsSync(filePath)) {
        continue;
      }

      const check: VerificationCheck = {
        id: `syntax_${file.replace(/[^a-zA-Z0-9]/g, '_')}`,
        type: VerificationCheckType.SYNTAX_CHECK,
        name: `Syntax: ${file}`,
        status: VerificationStatus.PASSED,
        message: 'Syntax appears valid',
        duration: 0,
        files: [file],
        suggestions: [],
      };

      const startTime = Date.now();

      try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // TypeScript/JavaScript syntax check
        if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
          // Basic syntax validation - check for common issues
          const issues = this.checkJsSyntax(content, file);
          if (issues.length > 0) {
            check.status = VerificationStatus.WARNING;
            check.message = `Potential issues: ${issues.join(', ')}`;
            check.suggestions.push(...issues.map((i) => `Fix: ${i}`));
          }
        }

        // JSON syntax check
        if (ext === '.json') {
          try {
            JSON.parse(content);
          } catch (e) {
            check.status = VerificationStatus.FAILED;
            check.message = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
            check.suggestions.push('Fix JSON syntax errors');
          }
        }
      } catch (error) {
        check.status = VerificationStatus.ERROR;
        check.message = error instanceof Error ? error.message : String(error);
      }

      check.duration = Date.now() - startTime;
      checks.push(check);
    }

    return checks;
  }

  /**
   * Basic JS/TS syntax check
   */
  private checkJsSyntax(content: string, _file: string): string[] {
    const issues: string[] = [];

    // Check for unbalanced braces
    const braces = { '{': 0, '}': 0, '(': 0, ')': 0, '[': 0, ']': 0 };
    for (const char of content) {
      if (char in braces) {
        braces[char as keyof typeof braces]++;
      }
    }

    if (braces['{'] !== braces['}']) {
      issues.push('Unbalanced curly braces');
    }
    if (braces['('] !== braces[')']) {
      issues.push('Unbalanced parentheses');
    }
    if (braces['['] !== braces[']']) {
      issues.push('Unbalanced brackets');
    }

    // Check for common errors
    if (/\bconsole\.log\b/.test(content)) {
      issues.push('Contains console.log (may need cleanup)');
    }

    if (/\bdebugger\b/.test(content)) {
      issues.push('Contains debugger statement');
    }

    return issues;
  }

  /**
   * Verify file changes
   */
  private async verifyFileChanges(
    files: string[],
    workingDir: string,
  ): Promise<VerificationCheck[]> {
    const checks: VerificationCheck[] = [];

    for (const file of files) {
      const filePath = path.resolve(workingDir, file);
      const check: VerificationCheck = {
        id: `file_${file.replace(/[^a-zA-Z0-9]/g, '_')}`,
        type: VerificationCheckType.FILE_CHANGE,
        name: `File: ${file}`,
        status: VerificationStatus.PASSED,
        message: '',
        duration: 0,
        files: [file],
        suggestions: [],
      };

      const startTime = Date.now();

      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        check.message = `Exists (${stats.size} bytes)`;

        // Check if file is empty
        if (stats.size === 0) {
          check.status = VerificationStatus.WARNING;
          check.message = 'File is empty';
          check.suggestions.push('Verify empty file is intentional');
        }
      } else {
        check.status = VerificationStatus.FAILED;
        check.message = 'File does not exist';
        check.suggestions.push(`Create or restore file: ${file}`);
      }

      check.duration = Date.now() - startTime;
      checks.push(check);
    }

    return checks;
  }

  /**
   * Run a command as a verification check
   */
  private async runCommand(
    id: string,
    name: string,
    command: string,
    workingDir: string,
    type: VerificationCheckType,
  ): Promise<VerificationCheck> {
    const startTime = Date.now();
    const check: VerificationCheck = {
      id,
      type,
      name,
      status: VerificationStatus.PASSED,
      message: '',
      duration: 0,
      files: [],
      command,
      suggestions: [],
    };

    try {
      const result = await this.executeCommand(command, workingDir);
      check.output = result.stdout.substring(0, 1000);

      if (result.exitCode === 0) {
        check.status = VerificationStatus.PASSED;
        check.message = 'Command succeeded';
      } else {
        check.status = VerificationStatus.FAILED;
        check.message = `Command failed with exit code ${result.exitCode}`;
        check.output = (result.stderr || result.stdout).substring(0, 1000);
        check.suggestions.push(`Fix issues reported by: ${command}`);
      }
    } catch (error) {
      check.status = VerificationStatus.ERROR;
      check.message = error instanceof Error ? error.message : String(error);
      check.suggestions.push('Verify command is available and configured correctly');
    }

    check.duration = Date.now() - startTime;
    return check;
  }

  /**
   * Execute a command
   */
  private async executeCommand(
    command: string,
    cwd: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: this.config.commandTimeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.code ?? 1,
        };
      }
      throw error;
    }
  }

  /**
   * Generate summary from checks
   */
  private generateSummary(checks: VerificationCheck[]): VerificationSummary {
    const total = checks.length;
    const passed = checks.filter((c) => c.status === VerificationStatus.PASSED).length;
    const failed = checks.filter((c) => c.status === VerificationStatus.FAILED).length;
    const warnings = checks.filter((c) => c.status === VerificationStatus.WARNING).length;
    const skipped = checks.filter((c) => c.status === VerificationStatus.SKIPPED).length;
    const errors = checks.filter((c) => c.status === VerificationStatus.ERROR).length;

    return {
      total,
      passed,
      failed,
      warnings,
      skipped,
      errors,
      passRate: total > 0 ? passed / total : 0,
    };
  }

  /**
   * Determine overall status from summary
   */
  private determineOverallStatus(summary: VerificationSummary): VerificationStatus {
    if (summary.errors > 0) return VerificationStatus.ERROR;
    if (summary.failed > 0) return VerificationStatus.FAILED;
    if (summary.warnings > 0) return VerificationStatus.WARNING;
    if (summary.passed > 0) return VerificationStatus.PASSED;
    return VerificationStatus.SKIPPED;
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    checks: VerificationCheck[],
    passed: boolean,
  ): string[] {
    const recommendations: string[] = [];

    if (passed) {
      recommendations.push('All required checks passed');
    } else {
      const failedChecks = checks.filter(
        (c) => c.status === VerificationStatus.FAILED || c.status === VerificationStatus.ERROR,
      );

      for (const check of failedChecks) {
        if (check.suggestions.length > 0) {
          recommendations.push(...check.suggestions);
        }
      }

      if (recommendations.length === 0) {
        recommendations.push('Review failed checks and fix issues');
      }
    }

    return [...new Set(recommendations)]; // Deduplicate
  }

  /**
   * Generate unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Quick verification (just run required checks)
   */
  async quickVerify(
    criteria: AcceptanceCriterion[],
    workingDir: string = process.cwd(),
  ): Promise<boolean> {
    const requiredCriteria = criteria.filter((c) => c.required);

    for (const criterion of requiredCriteria) {
      const check = await this.verifyCriterion(criterion, workingDir);
      if (check.status === VerificationStatus.FAILED || check.status === VerificationStatus.ERROR) {
        return false;
      }
    }

    return true;
  }
}

/**
 * Create a result verifier
 */
export function createResultVerifier(
  config?: Partial<VerifierConfig>,
): ResultVerifier {
  return new ResultVerifier(config);
}
