/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ResultVerifier, createResultVerifier } from './resultVerifier.js';
import { VerificationStatus, VerificationCheckType } from './types.js';
import type { AcceptanceCriterion } from './types.js';

describe('ResultVerifier', () => {
  let verifier: ResultVerifier;
  let tempDir: string;

  beforeEach(() => {
    verifier = new ResultVerifier({
      runTests: false,
      runTypeCheck: false,
      runLint: false,
      continueOnFailure: true,
    });

    // Create temp directory for file tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verifier-test-'));
  });

  describe('constructor', () => {
    it('should create verifier with default config', () => {
      const defaultVerifier = new ResultVerifier();
      expect(defaultVerifier).toBeInstanceOf(ResultVerifier);
    });

    it('should accept custom config', () => {
      const custom = new ResultVerifier({
        runTests: false,
        commandTimeout: 60000,
      });
      expect(custom).toBeInstanceOf(ResultVerifier);
    });
  });

  describe('verify', () => {
    it('should verify task with criteria', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'crit-1',
          description: 'Manual check',
          verificationMethod: 'manual',
          required: false,
        },
      ];

      const report = await verifier.verify('Test task', criteria);

      expect(report.id).toMatch(/^report_/);
      expect(report.taskDescription).toBe('Test task');
      expect(report.checks.length).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
    });

    it('should pass when file exists for automated check', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      const criteria: AcceptanceCriterion[] = [
        {
          id: 'file-exists',
          description: 'Test file exists',
          verificationMethod: 'automated',
          file: testFile,
          required: true,
        },
      ];

      const report = await verifier.verify('File check', criteria, [], tempDir);

      const fileCheck = report.checks.find((c) => c.id === 'file-exists');
      expect(fileCheck?.status).toBe(VerificationStatus.PASSED);
    });

    it('should fail when file does not exist', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'missing-file',
          description: 'Missing file',
          verificationMethod: 'automated',
          file: '/nonexistent/file.txt',
          required: true,
        },
      ];

      const report = await verifier.verify('Missing file check', criteria);

      const fileCheck = report.checks.find((c) => c.id === 'missing-file');
      expect(fileCheck?.status).toBe(VerificationStatus.FAILED);
    });

    it('should verify file content with pattern', async () => {
      const testFile = path.join(tempDir, 'content.txt');
      fs.writeFileSync(testFile, 'Hello World');

      const criteria: AcceptanceCriterion[] = [
        {
          id: 'content-match',
          description: 'File contains Hello',
          verificationMethod: 'automated',
          file: testFile,
          expectedPattern: 'Hello',
          required: true,
        },
      ];

      const report = await verifier.verify('Content check', criteria, [], tempDir);

      const contentCheck = report.checks.find((c) => c.id === 'content-match');
      expect(contentCheck?.status).toBe(VerificationStatus.PASSED);
    });

    it('should fail when content does not match pattern', async () => {
      const testFile = path.join(tempDir, 'wrong.txt');
      fs.writeFileSync(testFile, 'Goodbye World');

      const criteria: AcceptanceCriterion[] = [
        {
          id: 'wrong-content',
          description: 'File contains Hello',
          verificationMethod: 'automated',
          file: testFile,
          expectedPattern: 'Hello',
          required: true,
        },
      ];

      const report = await verifier.verify('Wrong content', criteria, [], tempDir);

      const contentCheck = report.checks.find((c) => c.id === 'wrong-content');
      expect(contentCheck?.status).toBe(VerificationStatus.FAILED);
    });
  });

  describe('verify file changes', () => {
    it('should verify existing files', async () => {
      const testFile = 'existing.txt';
      fs.writeFileSync(path.join(tempDir, testFile), 'content');

      const report = await verifier.verify(
        'File changes',
        [],
        [testFile],
        tempDir,
      );

      const fileCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.FILE_CHANGE,
      );
      expect(fileCheck?.status).toBe(VerificationStatus.PASSED);
    });

    it('should warn on empty files', async () => {
      const testFile = 'empty.txt';
      fs.writeFileSync(path.join(tempDir, testFile), '');

      const report = await verifier.verify(
        'Empty file',
        [],
        [testFile],
        tempDir,
      );

      const fileCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.FILE_CHANGE,
      );
      expect(fileCheck?.status).toBe(VerificationStatus.WARNING);
    });

    it('should fail on missing files', async () => {
      const report = await verifier.verify(
        'Missing file',
        [],
        ['nonexistent.txt'],
        tempDir,
      );

      const fileCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.FILE_CHANGE,
      );
      expect(fileCheck?.status).toBe(VerificationStatus.FAILED);
    });
  });

  describe('syntax checking', () => {
    it('should pass valid JSON', async () => {
      const jsonFile = 'valid.json';
      fs.writeFileSync(path.join(tempDir, jsonFile), '{"key": "value"}');

      const report = await verifier.verify('JSON check', [], [jsonFile], tempDir);

      const syntaxCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.SYNTAX_CHECK,
      );
      expect(syntaxCheck?.status).toBe(VerificationStatus.PASSED);
    });

    it('should fail invalid JSON', async () => {
      const jsonFile = 'invalid.json';
      fs.writeFileSync(path.join(tempDir, jsonFile), '{invalid json}');

      const report = await verifier.verify('Invalid JSON', [], [jsonFile], tempDir);

      const syntaxCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.SYNTAX_CHECK,
      );
      expect(syntaxCheck?.status).toBe(VerificationStatus.FAILED);
    });

    it('should detect unbalanced braces in JS', async () => {
      const jsFile = 'unbalanced.js';
      fs.writeFileSync(path.join(tempDir, jsFile), 'function test() { return true;');

      const report = await verifier.verify('JS check', [], [jsFile], tempDir);

      const syntaxCheck = report.checks.find(
        (c) => c.type === VerificationCheckType.SYNTAX_CHECK,
      );
      expect(syntaxCheck?.status).toBe(VerificationStatus.WARNING);
      expect(syntaxCheck?.message).toContain('Unbalanced');
    });
  });

  describe('command verification', () => {
    it('should run command and check exit code', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'echo-test',
          description: 'Echo command works',
          verificationMethod: 'command',
          command: 'echo "hello"',
          required: true,
        },
      ];

      const report = await verifier.verify('Command test', criteria);

      const cmdCheck = report.checks.find((c) => c.id === 'echo-test');
      expect(cmdCheck?.status).toBe(VerificationStatus.PASSED);
    });

    it('should fail on command failure', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'fail-cmd',
          description: 'Failing command',
          verificationMethod: 'command',
          command: 'exit 1',
          required: true,
        },
      ];

      const report = await verifier.verify('Failing command', criteria);

      const cmdCheck = report.checks.find((c) => c.id === 'fail-cmd');
      expect(cmdCheck?.status).toBe(VerificationStatus.FAILED);
    });
  });

  describe('quickVerify', () => {
    it('should return true when required criteria pass', async () => {
      const testFile = path.join(tempDir, 'quick.txt');
      fs.writeFileSync(testFile, 'content');

      const criteria: AcceptanceCriterion[] = [
        {
          id: 'required',
          description: 'Required check',
          verificationMethod: 'automated',
          file: testFile,
          required: true,
        },
        {
          id: 'optional',
          description: 'Optional check',
          verificationMethod: 'manual',
          required: false,
        },
      ];

      const result = await verifier.quickVerify(criteria, tempDir);
      expect(result).toBe(true);
    });

    it('should return false when required criteria fail', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'required-fail',
          description: 'Required failing check',
          verificationMethod: 'automated',
          file: '/nonexistent.txt',
          required: true,
        },
      ];

      const result = await verifier.quickVerify(criteria);
      expect(result).toBe(false);
    });
  });

  describe('summary and recommendations', () => {
    it('should generate correct summary', async () => {
      const report = await verifier.verify('Summary test', [
        {
          id: 'pass',
          description: 'Passing',
          verificationMethod: 'manual',
          required: false,
        },
      ]);

      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.passRate).toBeGreaterThanOrEqual(0);
      expect(report.summary.passRate).toBeLessThanOrEqual(1);
    });

    it('should generate recommendations for failures', async () => {
      const criteria: AcceptanceCriterion[] = [
        {
          id: 'failing',
          description: 'Failing check',
          verificationMethod: 'automated',
          file: '/nonexistent.txt',
          required: true,
        },
      ];

      const report = await verifier.verify('Recommendation test', criteria);

      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe('createResultVerifier', () => {
  it('should create verifier with factory function', () => {
    const verifier = createResultVerifier();
    expect(verifier).toBeInstanceOf(ResultVerifier);
  });

  it('should pass config to factory', () => {
    const verifier = createResultVerifier({
      runTests: false,
      commandTimeout: 60000,
    });
    expect(verifier).toBeInstanceOf(ResultVerifier);
  });
});
