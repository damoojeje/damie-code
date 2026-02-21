/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  TaskAnalysis,
  TaskCapabilities,
  TaskAnalyzerConfig,
} from './types.js';

export {
  TaskType,
  DEFAULT_TASK_ANALYZER_CONFIG,
  TASK_TYPE_KEYWORDS,
  COMPLEXITY_INDICATORS,
  CAPABILITY_INDICATORS,
} from './types.js';

// Task Analyzer
export {
  TaskAnalyzer,
  createTaskAnalyzer,
  analyzeTask,
} from './taskAnalyzer.js';

// Model Router
export type {
  RoutingDecision,
  ModelRouterConfig,
  RoutingLogEntry,
} from './modelRouter.js';

export {
  ModelRouter,
  createModelRouter,
  routeTask,
  DEFAULT_ROUTER_CONFIG,
} from './modelRouter.js';
