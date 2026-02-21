/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  VerificationCheck,
  VerificationReport,
  VerificationSummary,
  AcceptanceCriterion,
  VerifierConfig,
} from './types.js';

export {
  VerificationStatus,
  VerificationCheckType,
  DEFAULT_VERIFIER_CONFIG,
} from './types.js';

// Result Verifier
export {
  ResultVerifier,
  createResultVerifier,
} from './resultVerifier.js';

// Framework Detector
export type {
  FrameworkDetection,
} from './frameworkDetector.js';

export {
  FrameworkDetector,
  TestFramework,
  createFrameworkDetector,
} from './frameworkDetector.js';

// Test Result Parser
export type {
  TestResult,
  TestSuiteResult,
  TestRunResult,
  TestSummary,
} from './testResultParser.js';

export {
  TestResultParser,
  createTestResultParser,
} from './testResultParser.js';

// Test Runner
export type {
  TestRunnerConfig,
  TestRunOptions,
} from './testRunner.js';

export {
  TestRunner,
  createTestRunner,
  DEFAULT_TEST_RUNNER_CONFIG,
} from './testRunner.js';
