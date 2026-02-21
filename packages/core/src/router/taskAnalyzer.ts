/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  TaskAnalysis,
  TaskCapabilities,
  TaskAnalyzerConfig,
} from './types.js';
import {
  TaskType,
  DEFAULT_TASK_ANALYZER_CONFIG,
  TASK_TYPE_KEYWORDS,
  COMPLEXITY_INDICATORS,
  CAPABILITY_INDICATORS,
} from './types.js';

/**
 * Task Analyzer
 *
 * Analyzes task descriptions to determine:
 * - Task type (coding, reasoning, creative, visual, general)
 * - Complexity (1-10 scale)
 * - Required capabilities
 * - Estimated token requirements
 * - Classification confidence
 */
export class TaskAnalyzer {
  private config: TaskAnalyzerConfig;
  private keywords: Record<TaskType, string[]>;

  constructor(config: Partial<TaskAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_TASK_ANALYZER_CONFIG, ...config };
    this.keywords = this.buildKeywordMap();
  }

  /**
   * Build keyword map with custom keywords merged
   */
  private buildKeywordMap(): Record<TaskType, string[]> {
    const keywords = { ...TASK_TYPE_KEYWORDS };

    if (this.config.customKeywords) {
      for (const [type, customWords] of Object.entries(this.config.customKeywords)) {
        const taskType = type as TaskType;
        if (customWords && keywords[taskType]) {
          keywords[taskType] = [...keywords[taskType], ...customWords];
        }
      }
    }

    return keywords;
  }

  /**
   * Analyze a task description
   */
  analyze(task: string): TaskAnalysis {
    const normalizedTask = task.toLowerCase();
    const words = this.tokenize(normalizedTask);

    // Classify task type
    const typeScores = this.classifyType(normalizedTask, words);
    const { type, secondaryTypes, confidence, matchedKeywords } = this.selectBestType(typeScores);

    // Estimate complexity
    const complexity = this.estimateComplexity(normalizedTask, words);

    // Detect required capabilities
    const capabilities = this.detectCapabilities(normalizedTask, words);

    // Estimate tokens
    const { inputTokens, outputTokens } = this.estimateTokens(task, type, complexity);

    return {
      type,
      secondaryTypes,
      complexity,
      capabilities,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      confidence,
      matchedKeywords,
      originalTask: task,
    };
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  /**
   * Calculate type scores based on keyword matches
   */
  private classifyType(
    task: string,
    words: string[],
  ): Map<TaskType, { score: number; matches: string[] }> {
    const scores = new Map<TaskType, { score: number; matches: string[] }>();

    for (const type of Object.values(TaskType)) {
      scores.set(type, { score: 0, matches: [] });
    }

    // Score each type based on keyword matches
    for (const [type, keywords] of Object.entries(this.keywords)) {
      const taskType = type as TaskType;
      const typeScore = scores.get(taskType)!;

      for (const keyword of keywords) {
        // Check for exact word match
        if (words.includes(keyword)) {
          typeScore.score += 2;
          if (!typeScore.matches.includes(keyword)) {
            typeScore.matches.push(keyword);
          }
        }
        // Check for phrase match in full text
        else if (keyword.includes(' ') && task.includes(keyword)) {
          typeScore.score += 3; // Multi-word phrases are more specific
          if (!typeScore.matches.includes(keyword)) {
            typeScore.matches.push(keyword);
          }
        }
        // Check for partial match (keyword is substring of a word)
        else if (words.some((w) => w.includes(keyword) || keyword.includes(w))) {
          typeScore.score += 1;
          if (!typeScore.matches.includes(keyword)) {
            typeScore.matches.push(keyword);
          }
        }
      }
    }

    return scores;
  }

  /**
   * Select the best task type from scores
   */
  private selectBestType(scores: Map<TaskType, { score: number; matches: string[] }>): {
    type: TaskType;
    secondaryTypes: TaskType[];
    confidence: number;
    matchedKeywords: string[];
  } {
    // Convert to array and sort by score
    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);

    const best = sorted[0];
    const totalScore = sorted.reduce((sum, [, { score }]) => sum + score, 0);

    // Calculate confidence based on how dominant the best type is
    const confidence = totalScore > 0 ? best[1].score / totalScore : 0;

    // If confidence is too low, use default type
    if (confidence < this.config.minConfidence || best[1].score === 0) {
      return {
        type: this.config.defaultType,
        secondaryTypes: [],
        confidence: 0,
        matchedKeywords: [],
      };
    }

    // Find secondary types (types with at least 50% of best score)
    const secondaryTypes = sorted
      .slice(1)
      .filter(([, { score }]) => score >= best[1].score * 0.5)
      .map(([type]) => type);

    return {
      type: best[0],
      secondaryTypes,
      confidence: Math.min(confidence * 1.5, 1), // Scale up slightly, cap at 1
      matchedKeywords: best[1].matches,
    };
  }

  /**
   * Estimate task complexity (1-10)
   */
  private estimateComplexity(task: string, words: string[]): number {
    let complexity = 5; // Default to medium
    let indicatorCount = 0;

    // Check complexity indicators
    for (const [indicator, value] of Object.entries(COMPLEXITY_INDICATORS)) {
      if (indicator.includes(' ')) {
        // Multi-word indicator
        if (task.includes(indicator)) {
          complexity = (complexity * indicatorCount + value) / (indicatorCount + 1);
          indicatorCount++;
        }
      } else {
        // Single word indicator
        if (words.includes(indicator)) {
          complexity = (complexity * indicatorCount + value) / (indicatorCount + 1);
          indicatorCount++;
        }
      }
    }

    // Adjust based on task length (longer tasks tend to be more complex)
    const wordCount = words.length;
    if (wordCount > 50) {
      complexity = Math.min(complexity + 2, 10);
    } else if (wordCount > 30) {
      complexity = Math.min(complexity + 1, 10);
    } else if (wordCount < 10) {
      complexity = Math.max(complexity - 1, 1);
    }

    // Check for multiple requirements (often indicates complexity)
    const requirementIndicators = ['and', 'also', 'additionally', 'plus', 'with', 'including'];
    const requirementCount = requirementIndicators.filter((r) => words.includes(r)).length;
    if (requirementCount >= 3) {
      complexity = Math.min(complexity + 2, 10);
    } else if (requirementCount >= 1) {
      complexity = Math.min(complexity + 1, 10);
    }

    return Math.round(complexity);
  }

  /**
   * Detect required capabilities
   */
  private detectCapabilities(task: string, words: string[]): TaskCapabilities {
    const capabilities: TaskCapabilities = {
      codeGeneration: false,
      codeExecution: false,
      fileOperations: false,
      shellExecution: false,
      vision: false,
      longContext: false,
      toolCalling: false,
    };

    for (const [capability, indicators] of Object.entries(CAPABILITY_INDICATORS)) {
      const cap = capability as keyof TaskCapabilities;
      capabilities[cap] = indicators.some(
        (indicator) =>
          words.includes(indicator) ||
          (indicator.includes(' ') && task.includes(indicator)),
      );
    }

    return capabilities;
  }

  /**
   * Estimate token requirements
   */
  private estimateTokens(
    task: string,
    type: TaskType,
    complexity: number,
  ): { inputTokens: number; outputTokens: number } {
    // Base input tokens from task length
    // Rough estimate: ~4 characters per token
    const taskTokens = Math.ceil(task.length / 4);

    // Base context tokens (system prompt, etc.)
    const baseContextTokens = 500;

    // Estimate input tokens
    const inputTokens = taskTokens + baseContextTokens;

    // Estimate output tokens based on task type and complexity
    const typeMultipliers: Record<TaskType, number> = {
      [TaskType.CODING]: 3.0, // Code tends to be verbose
      [TaskType.REASONING]: 2.5, // Explanations can be long
      [TaskType.CREATIVE]: 2.0, // Variable but generally medium
      [TaskType.VISUAL]: 1.5, // Often descriptive responses
      [TaskType.GENERAL]: 1.5, // Q&A tends to be concise
    };

    const complexityMultiplier = 1 + (complexity - 5) * 0.2; // 0.2 - 2.0
    const typeMultiplier = typeMultipliers[type] || 1.5;

    // Base output estimation
    const baseOutput = 200;
    const outputTokens = Math.round(baseOutput * typeMultiplier * complexityMultiplier);

    return {
      inputTokens: Math.max(inputTokens, 100),
      outputTokens: Math.min(Math.max(outputTokens, 100), 8000),
    };
  }

  /**
   * Get a summary of the analysis
   */
  summarize(analysis: TaskAnalysis): string {
    const parts = [
      `Type: ${analysis.type}`,
      `Complexity: ${analysis.complexity}/10`,
      `Confidence: ${(analysis.confidence * 100).toFixed(0)}%`,
    ];

    if (analysis.secondaryTypes.length > 0) {
      parts.push(`Secondary: ${analysis.secondaryTypes.join(', ')}`);
    }

    const activeCapabilities = Object.entries(analysis.capabilities)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (activeCapabilities.length > 0) {
      parts.push(`Capabilities: ${activeCapabilities.join(', ')}`);
    }

    parts.push(`Est. tokens: ${analysis.estimatedInputTokens}/${analysis.estimatedOutputTokens}`);

    return parts.join(' | ');
  }
}

/**
 * Create a task analyzer with optional configuration
 */
export function createTaskAnalyzer(config?: Partial<TaskAnalyzerConfig>): TaskAnalyzer {
  return new TaskAnalyzer(config);
}

/**
 * Analyze a task with default configuration
 */
export function analyzeTask(task: string): TaskAnalysis {
  const analyzer = new TaskAnalyzer();
  return analyzer.analyze(task);
}
