/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

// Types
export type {
  ContextItem,
  ContextWindowConfig,
  ContextWindowState,
  CompressionResult,
  ContextManagerConfig,
} from './types.js';

export {
  ContextItemType,
  ContextPriority,
  MODEL_TOKEN_LIMITS,
  DEFAULT_CONTEXT_CONFIG,
  DEFAULT_CONTEXT_MANAGER_CONFIG,
} from './types.js';

// Context Manager
export {
  ContextManager,
  createContextManager,
} from './contextManager.js';

// Context Prioritizer
export type {
  PrioritizationFactors,
  ScoredItem,
} from './contextPrioritizer.js';

export {
  ContextPrioritizer,
  createContextPrioritizer,
  DEFAULT_PRIORITIZATION_FACTORS,
} from './contextPrioritizer.js';

// Context Compressor
export type {
  CompressionConfig,
} from './contextCompressor.js';

export {
  ContextCompressor,
  createContextCompressor,
  CompressionStrategy,
  DEFAULT_COMPRESSION_CONFIG,
} from './contextCompressor.js';

// Context Persistence
export type {
  PersistenceConfig,
  SavedSession,
} from './contextPersistence.js';

export {
  ContextPersistence,
  createContextPersistence,
  DEFAULT_PERSISTENCE_CONFIG,
} from './contextPersistence.js';

// Relevance Scorer
export type {
  ScoringConfig,
  ScoreBreakdown,
  ScoredContextItem,
} from './relevanceScorer.js';

export {
  RelevanceScorer,
  createRelevanceScorer,
  DEFAULT_SCORING_CONFIG,
} from './relevanceScorer.js';
