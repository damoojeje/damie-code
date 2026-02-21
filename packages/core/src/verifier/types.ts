/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Verification result status
 */
export enum VerificationStatus {
  PASSED = 'passed',
  FAILED = 'failed',
  WARNING = 'warning',
  SKIPPED = 'skipped',
  ERROR = 'error',
}

/**
 * Verification check type
 */
export enum VerificationCheckType {
  ACCEPTANCE_CRITERIA = 'acceptance_criteria',
  SYNTAX_CHECK = 'syntax_check',
  TEST_RUN = 'test_run',
  FILE_CHANGE = 'file_change',
  TYPE_CHECK = 'type_check',
  LINT_CHECK = 'lint_check',
  CUSTOM = 'custom',
}

/**
 * Single verification check result
 */
export interface VerificationCheck {
  /** Check ID */
  id: string;
  /** Check type */
  type: VerificationCheckType;
  /** Check name/description */
  name: string;
  /** Status */
  status: VerificationStatus;
  /** Detailed message */
  message: string;
  /** Duration in ms */
  duration: number;
  /** Related file paths */
  files: string[];
  /** Command run (if applicable) */
  command?: string;
  /** Command output (if applicable) */
  output?: string;
  /** Expected value (for comparison checks) */
  expected?: string;
  /** Actual value (for comparison checks) */
  actual?: string;
  /** Suggestions for fixing failures */
  suggestions: string[];
  /** Child checks (for grouped checks) */
  children?: VerificationCheck[];
}

/**
 * Full verification report
 */
export interface VerificationReport {
  /** Report ID */
  id: string;
  /** Task that was verified */
  taskDescription: string;
  /** Overall status */
  status: VerificationStatus;
  /** All checks performed */
  checks: VerificationCheck[];
  /** Summary counts */
  summary: VerificationSummary;
  /** Overall verification passed */
  passed: boolean;
  /** Timestamp */
  timestamp: Date;
  /** Duration in ms */
  totalDuration: number;
  /** Files that were changed */
  filesChanged: string[];
  /** Recommendations for next steps */
  recommendations: string[];
}

/**
 * Verification summary
 */
export interface VerificationSummary {
  /** Total checks */
  total: number;
  /** Passed checks */
  passed: number;
  /** Failed checks */
  failed: number;
  /** Warning checks */
  warnings: number;
  /** Skipped checks */
  skipped: number;
  /** Error checks */
  errors: number;
  /** Pass rate (0-1) */
  passRate: number;
}

/**
 * Acceptance criterion for verification
 */
export interface AcceptanceCriterion {
  /** Criterion ID */
  id: string;
  /** Description of the criterion */
  description: string;
  /** How to verify (manual, automated, command) */
  verificationMethod: 'manual' | 'automated' | 'command';
  /** Command to run for verification (if applicable) */
  command?: string;
  /** Expected result pattern (regex or exact) */
  expectedPattern?: string;
  /** File to check (if applicable) */
  file?: string;
  /** Is this criterion required */
  required: boolean;
}

/**
 * Verifier configuration
 */
export interface VerifierConfig {
  /** Run tests as part of verification */
  runTests: boolean;
  /** Run type checking */
  runTypeCheck: boolean;
  /** Run linting */
  runLint: boolean;
  /** Check syntax of modified files */
  checkSyntax: boolean;
  /** Verify file changes */
  verifyFileChanges: boolean;
  /** Test command */
  testCommand: string;
  /** Type check command */
  typeCheckCommand: string;
  /** Lint command */
  lintCommand: string;
  /** Timeout for commands (ms) */
  commandTimeout: number;
  /** Continue on check failure */
  continueOnFailure: boolean;
  /** Verbose output */
  verbose: boolean;
}

/**
 * Default verifier configuration
 */
export const DEFAULT_VERIFIER_CONFIG: VerifierConfig = {
  runTests: true,
  runTypeCheck: true,
  runLint: true,
  checkSyntax: true,
  verifyFileChanges: true,
  testCommand: 'npm test',
  typeCheckCommand: 'npm run typecheck',
  lintCommand: 'npm run lint',
  commandTimeout: 120000, // 2 minutes
  continueOnFailure: true,
  verbose: false,
};
