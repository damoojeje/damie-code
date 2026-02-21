/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EffortEstimate, Subtask, TaskDecomposition } from './types.js';
import { EffortLevel, SubtaskType } from './types.js';

/**
 * Effort estimation configuration
 */
export interface EffortEstimationConfig {
  /** Base minutes per effort level */
  baseMinutes: Record<EffortLevel, number>;
  /** Type multipliers */
  typeMultipliers: Partial<Record<SubtaskType, number>>;
  /** Complexity keywords that increase effort */
  complexityKeywords: string[];
  /** Simple keywords that decrease effort */
  simpleKeywords: string[];
}

/**
 * Default effort estimation configuration
 */
export const DEFAULT_EFFORT_CONFIG: EffortEstimationConfig = {
  baseMinutes: {
    [EffortLevel.TRIVIAL]: 5,
    [EffortLevel.SMALL]: 15,
    [EffortLevel.MEDIUM]: 45,
    [EffortLevel.LARGE]: 120,
    [EffortLevel.COMPLEX]: 300,
  },
  typeMultipliers: {
    [SubtaskType.CODE]: 1.0,
    [SubtaskType.TEST]: 0.8,
    [SubtaskType.FILE]: 0.3,
    [SubtaskType.COMMAND]: 0.2,
    [SubtaskType.DOCUMENTATION]: 0.5,
    [SubtaskType.CONFIGURATION]: 0.4,
    [SubtaskType.RESEARCH]: 1.2,
    [SubtaskType.REVIEW]: 0.6,
    [SubtaskType.OTHER]: 1.0,
  },
  complexityKeywords: [
    'refactor',
    'rewrite',
    'migrate',
    'integrate',
    'architecture',
    'security',
    'performance',
    'optimization',
    'complex',
    'database',
    'authentication',
    'authorization',
    'encryption',
    'async',
    'concurrent',
    'distributed',
    'scale',
    'legacy',
  ],
  simpleKeywords: [
    'rename',
    'typo',
    'comment',
    'format',
    'lint',
    'simple',
    'basic',
    'minor',
    'trivial',
    'update',
    'fix',
    'small',
  ],
};

/**
 * Effort Estimator
 *
 * Estimates effort for subtasks based on their description,
 * type, and various heuristics.
 */
export class EffortEstimator {
  private config: EffortEstimationConfig;

  constructor(config: Partial<EffortEstimationConfig> = {}) {
    this.config = {
      ...DEFAULT_EFFORT_CONFIG,
      ...config,
      baseMinutes: {
        ...DEFAULT_EFFORT_CONFIG.baseMinutes,
        ...config.baseMinutes,
      },
      typeMultipliers: {
        ...DEFAULT_EFFORT_CONFIG.typeMultipliers,
        ...config.typeMultipliers,
      },
    };
  }

  /**
   * Estimate effort for a single subtask
   */
  estimate(subtask: Partial<Subtask>): EffortEstimate {
    const factors: string[] = [];
    let confidence = 0.7; // Base confidence

    // Analyze description and title
    const text = `${subtask.title ?? ''} ${subtask.description ?? ''}`.toLowerCase();

    // Determine base effort level from text analysis
    let level = this.determineEffortLevel(text, factors);

    // Apply type multiplier
    const typeMultiplier = this.config.typeMultipliers[subtask.type ?? SubtaskType.OTHER] ?? 1.0;
    if (typeMultiplier !== 1.0) {
      factors.push(`Type multiplier: ${typeMultiplier}x`);
    }

    // Adjust for file count
    const fileCount = subtask.affectedFiles?.length ?? 0;
    if (fileCount > 3) {
      level = this.increaseEffort(level);
      factors.push(`Multiple files (${fileCount})`);
      confidence -= 0.05;
    }

    // Adjust for dependency count
    const depCount = subtask.dependencies?.length ?? 0;
    if (depCount > 2) {
      factors.push(`Multiple dependencies (${depCount})`);
      confidence -= 0.05;
    }

    // Adjust for acceptance criteria count
    const criteriaCount = subtask.acceptanceCriteria?.length ?? 0;
    if (criteriaCount > 3) {
      level = this.increaseEffort(level);
      factors.push(`Many acceptance criteria (${criteriaCount})`);
    }

    // Calculate minutes
    const baseMinutes = this.config.baseMinutes[level];
    const minutes = Math.round(baseMinutes * typeMultiplier);

    // Adjust confidence based on description length
    if (text.length < 20) {
      confidence -= 0.1;
      factors.push('Short description (low confidence)');
    } else if (text.length > 200) {
      confidence += 0.05;
      factors.push('Detailed description');
    }

    // Clamp confidence
    confidence = Math.max(0.3, Math.min(0.95, confidence));

    return {
      level,
      minutes,
      confidence,
      factors,
    };
  }

  /**
   * Estimate total effort for a task decomposition
   */
  estimateTotal(decomposition: TaskDecomposition): EffortEstimate {
    const factors: string[] = [];
    let totalMinutes = 0;
    let totalConfidence = 0;

    for (const subtask of decomposition.subtasks) {
      const estimate = subtask.effort ?? this.estimate(subtask);
      totalMinutes += estimate.minutes;
      totalConfidence += estimate.confidence;
    }

    const avgConfidence =
      decomposition.subtasks.length > 0
        ? totalConfidence / decomposition.subtasks.length
        : 0.5;

    // Add coordination overhead
    if (decomposition.subtasks.length > 5) {
      const overhead = Math.round(decomposition.subtasks.length * 2);
      totalMinutes += overhead;
      factors.push(`Coordination overhead: ${overhead} min`);
    }

    // Determine overall effort level
    const level = this.minutesToEffortLevel(totalMinutes);

    factors.push(`${decomposition.subtasks.length} subtasks`);
    factors.push(`Total: ${totalMinutes} minutes`);

    return {
      level,
      minutes: totalMinutes,
      confidence: avgConfidence,
      factors,
    };
  }

  /**
   * Determine effort level from text analysis
   */
  private determineEffortLevel(text: string, factors: string[]): EffortLevel {
    let score = 0;

    // Check for complexity keywords
    const complexMatches = this.config.complexityKeywords.filter((kw) =>
      text.includes(kw),
    );
    if (complexMatches.length > 0) {
      score += complexMatches.length * 2;
      factors.push(`Complexity: ${complexMatches.join(', ')}`);
    }

    // Check for simple keywords
    const simpleMatches = this.config.simpleKeywords.filter((kw) =>
      text.includes(kw),
    );
    if (simpleMatches.length > 0) {
      score -= simpleMatches.length;
      factors.push(`Simplicity: ${simpleMatches.join(', ')}`);
    }

    // Check for size indicators
    if (text.includes('multiple') || text.includes('several') || text.includes('all')) {
      score += 1;
      factors.push('Scope indicator');
    }

    // Map score to effort level
    if (score <= -2) return EffortLevel.TRIVIAL;
    if (score <= 0) return EffortLevel.SMALL;
    if (score <= 2) return EffortLevel.MEDIUM;
    if (score <= 4) return EffortLevel.LARGE;
    return EffortLevel.COMPLEX;
  }

  /**
   * Increase effort level by one step
   */
  private increaseEffort(level: EffortLevel): EffortLevel {
    const levels = [
      EffortLevel.TRIVIAL,
      EffortLevel.SMALL,
      EffortLevel.MEDIUM,
      EffortLevel.LARGE,
      EffortLevel.COMPLEX,
    ];
    const index = levels.indexOf(level);
    return levels[Math.min(index + 1, levels.length - 1)];
  }

  /**
   * Convert minutes to effort level
   */
  private minutesToEffortLevel(minutes: number): EffortLevel {
    if (minutes <= 10) return EffortLevel.TRIVIAL;
    if (minutes <= 30) return EffortLevel.SMALL;
    if (minutes <= 90) return EffortLevel.MEDIUM;
    if (minutes <= 240) return EffortLevel.LARGE;
    return EffortLevel.COMPLEX;
  }
}

/**
 * Create an effort estimator
 */
export function createEffortEstimator(
  config?: Partial<EffortEstimationConfig>,
): EffortEstimator {
  return new EffortEstimator(config);
}
