/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Task types for routing
 */
export enum TaskType {
  /** Coding tasks - code generation, debugging, refactoring */
  CODING = 'coding',
  /** Reasoning tasks - analysis, problem-solving, planning */
  REASONING = 'reasoning',
  /** Creative tasks - writing, brainstorming, design */
  CREATIVE = 'creative',
  /** Visual tasks - image analysis, charts, diagrams */
  VISUAL = 'visual',
  /** General tasks - Q&A, summarization, translation */
  GENERAL = 'general',
}

/**
 * Required capabilities for a task
 */
export interface TaskCapabilities {
  /** Needs code generation/understanding */
  codeGeneration: boolean;
  /** Needs code execution/testing */
  codeExecution: boolean;
  /** Needs file operations */
  fileOperations: boolean;
  /** Needs shell command execution */
  shellExecution: boolean;
  /** Needs vision/image understanding */
  vision: boolean;
  /** Needs long context window */
  longContext: boolean;
  /** Needs function/tool calling */
  toolCalling: boolean;
}

/**
 * Task analysis result
 */
export interface TaskAnalysis {
  /** Primary task type */
  type: TaskType;
  /** Secondary task types (if applicable) */
  secondaryTypes: TaskType[];
  /** Complexity score 1-10 */
  complexity: number;
  /** Required capabilities */
  capabilities: TaskCapabilities;
  /** Estimated input tokens */
  estimatedInputTokens: number;
  /** Estimated output tokens */
  estimatedOutputTokens: number;
  /** Confidence score 0-1 */
  confidence: number;
  /** Keywords that influenced classification */
  matchedKeywords: string[];
  /** Original task description */
  originalTask: string;
}

/**
 * Task analyzer configuration
 */
export interface TaskAnalyzerConfig {
  /** Default task type when classification fails */
  defaultType: TaskType;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Custom keyword mappings */
  customKeywords?: Partial<Record<TaskType, string[]>>;
}

/**
 * Default task analyzer configuration
 */
export const DEFAULT_TASK_ANALYZER_CONFIG: TaskAnalyzerConfig = {
  defaultType: TaskType.GENERAL,
  minConfidence: 0.3,
};

/**
 * Keyword patterns for each task type
 */
export const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  [TaskType.CODING]: [
    'code', 'function', 'implement', 'debug', 'fix', 'refactor', 'write',
    'class', 'method', 'variable', 'bug', 'error', 'compile', 'build',
    'test', 'unit test', 'integration', 'api', 'endpoint', 'database',
    'query', 'sql', 'typescript', 'javascript', 'python', 'java', 'rust',
    'go', 'module', 'import', 'export', 'package', 'dependency', 'npm',
    'yarn', 'pnpm', 'git', 'commit', 'merge', 'branch', 'pull request',
    'syntax', 'type', 'interface', 'async', 'await', 'promise', 'callback',
    'algorithm', 'data structure', 'array', 'object', 'loop', 'condition',
  ],
  [TaskType.REASONING]: [
    'analyze', 'explain', 'why', 'how', 'reason', 'logic', 'think',
    'evaluate', 'compare', 'contrast', 'pros', 'cons', 'trade-off',
    'decision', 'strategy', 'plan', 'design', 'architecture', 'pattern',
    'optimize', 'improve', 'best practice', 'review', 'assess', 'consider',
    'implications', 'consequences', 'cause', 'effect', 'root cause',
    'debug', 'troubleshoot', 'investigate', 'diagnose', 'understand',
    'step by step', 'walkthrough', 'breakdown', 'systematically',
  ],
  [TaskType.CREATIVE]: [
    'create', 'write', 'compose', 'story', 'poem', 'essay', 'article',
    'blog', 'content', 'copy', 'creative', 'imagine', 'brainstorm',
    'idea', 'concept', 'design', 'brand', 'name', 'slogan', 'tagline',
    'marketing', 'narrative', 'character', 'plot', 'script', 'dialogue',
    'fiction', 'non-fiction', 'style', 'tone', 'voice', 'engaging',
    'compelling', 'unique', 'original', 'innovative', 'artistic',
  ],
  [TaskType.VISUAL]: [
    'image', 'picture', 'photo', 'screenshot', 'diagram', 'chart',
    'graph', 'visualization', 'visual', 'ui', 'ux', 'design', 'layout',
    'mockup', 'wireframe', 'prototype', 'color', 'icon', 'logo',
    'infographic', 'illustration', 'render', 'display', 'show', 'see',
    'look', 'appear', 'visible', 'view', 'canvas', 'svg', 'png', 'jpg',
  ],
  [TaskType.GENERAL]: [
    'what', 'who', 'when', 'where', 'which', 'define', 'describe',
    'list', 'summarize', 'translate', 'convert', 'format', 'help',
    'question', 'answer', 'information', 'tell', 'about', 'explain',
    'meaning', 'definition', 'example', 'overview', 'introduction',
    'basic', 'simple', 'quick', 'brief', 'short',
  ],
};

/**
 * Complexity indicators
 */
export const COMPLEXITY_INDICATORS: Record<string, number> = {
  // Low complexity (1-3)
  'simple': 1,
  'basic': 1,
  'quick': 1,
  'easy': 2,
  'small': 2,
  'minor': 2,
  'trivial': 1,
  'straightforward': 2,

  // Medium complexity (4-6)
  'moderate': 5,
  'standard': 5,
  'typical': 5,
  'regular': 4,
  'normal': 4,

  // High complexity (7-9)
  'complex': 7,
  'advanced': 7,
  'sophisticated': 8,
  'intricate': 8,
  'comprehensive': 7,
  'extensive': 7,
  'detailed': 6,

  // Very high complexity (10)
  'very complex': 9,
  'extremely complex': 10,
  'highly complex': 9,
  'enterprise': 8,
  'large-scale': 9,
  'full': 6,
  'complete': 6,
  'entire': 7,
  'whole': 6,
  'refactor': 7,
  'rewrite': 8,
  'migration': 8,
  'overhaul': 9,
};

/**
 * Capability indicators
 */
export const CAPABILITY_INDICATORS: Record<keyof TaskCapabilities, string[]> = {
  codeGeneration: [
    'code', 'function', 'class', 'implement', 'write', 'create', 'generate',
    'build', 'develop', 'program', 'script', 'module',
  ],
  codeExecution: [
    'run', 'execute', 'test', 'verify', 'validate', 'check', 'compile',
    'build', 'deploy', 'start', 'launch',
  ],
  fileOperations: [
    'file', 'read', 'write', 'save', 'load', 'open', 'close', 'create',
    'delete', 'move', 'copy', 'rename', 'path', 'directory', 'folder',
  ],
  shellExecution: [
    'command', 'terminal', 'shell', 'bash', 'cmd', 'powershell', 'cli',
    'run', 'execute', 'npm', 'yarn', 'pip', 'git', 'docker',
  ],
  vision: [
    'image', 'picture', 'photo', 'screenshot', 'visual', 'see', 'look',
    'diagram', 'chart', 'ui', 'design', 'mockup', 'icon', 'logo',
  ],
  longContext: [
    'entire', 'whole', 'complete', 'full', 'all', 'comprehensive',
    'codebase', 'project', 'repository', 'large', 'long', 'extensive',
  ],
  toolCalling: [
    'search', 'fetch', 'api', 'call', 'request', 'query', 'browse',
    'find', 'lookup', 'retrieve', 'external', 'service', 'database',
  ],
};
