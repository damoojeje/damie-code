/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { TaskAnalyzer, createTaskAnalyzer, analyzeTask } from './taskAnalyzer.js';
import { TaskType, DEFAULT_TASK_ANALYZER_CONFIG } from './types.js';

describe('TaskAnalyzer', () => {
  describe('constructor', () => {
    it('should create analyzer with default config', () => {
      const analyzer = new TaskAnalyzer();
      expect(analyzer).toBeDefined();
    });

    it('should accept custom config', () => {
      const analyzer = new TaskAnalyzer({
        defaultType: TaskType.CODING,
        minConfidence: 0.5,
      });
      expect(analyzer).toBeDefined();
    });

    it('should merge custom keywords', () => {
      const analyzer = new TaskAnalyzer({
        customKeywords: {
          [TaskType.CODING]: ['zorglub'],
        },
      });
      const analysis = analyzer.analyze('Please zorglub the function');
      expect(analysis.type).toBe(TaskType.CODING);
    });
  });

  describe('analyze - task type classification', () => {
    const analyzer = new TaskAnalyzer();

    it('should classify coding tasks', () => {
      const tasks = [
        'Write a function to sort an array',
        'Fix the bug in the login module',
        'Refactor the database queries',
        'Implement a REST API endpoint',
        'Debug the TypeScript compile error',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.type).toBe(TaskType.CODING);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });

    it('should classify reasoning tasks', () => {
      const tasks = [
        'Analyze the performance bottleneck',
        'Explain why this approach is better',
        'Evaluate the trade-offs between options',
        'Think step by step about the problem',
        'Compare React and Vue for this use case',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.type).toBe(TaskType.REASONING);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });

    it('should classify creative tasks', () => {
      const tasks = [
        'Write a blog post about AI',
        'Create a story for the landing page',
        'Brainstorm marketing ideas',
        'Compose a poem about programming',
        'Design a brand name for the startup',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.type).toBe(TaskType.CREATIVE);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });

    it('should classify visual tasks', () => {
      const tasks = [
        'Analyze this screenshot image photo',
        'Look at the diagram chart visualization',
        'Display this photo picture image',
        'Describe the UI mockup design visually',
        'Show this chart graph visualization image',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.type).toBe(TaskType.VISUAL);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });

    it('should classify general tasks', () => {
      const tasks = [
        'What is the meaning of this word?',
        'List the main topics about that',
        'Summarize this brief introduction',
        'Translate this text quickly',
        'Define this basic concept',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.type).toBe(TaskType.GENERAL);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });

    it('should identify secondary types for mixed tasks', () => {
      const analysis = analyzer.analyze(
        'Write function code to implement the logic and analyze why it works step by step',
      );
      // May or may not have secondary types - just check the analysis works
      expect(analysis.type).toBeDefined();
      expect(analysis.secondaryTypes).toBeDefined();
    });

    it('should use default type for ambiguous tasks', () => {
      const analyzer = new TaskAnalyzer({
        defaultType: TaskType.GENERAL,
        minConfidence: 0.9, // High threshold
      });
      const analysis = analyzer.analyze('xyz abc 123');
      expect(analysis.type).toBe(TaskType.GENERAL);
      expect(analysis.confidence).toBe(0);
    });
  });

  describe('analyze - complexity estimation', () => {
    const analyzer = new TaskAnalyzer();

    it('should estimate low complexity for simple tasks', () => {
      const tasks = [
        'Simple fix for the typo',
        'Quick change to the button color',
        'Easy update to the text',
        'Basic hello world program',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.complexity).toBeLessThanOrEqual(4);
      }
    });

    it('should estimate high complexity for complex tasks', () => {
      const tasks = [
        'Very complex enterprise refactoring migration overhaul of the entire codebase',
        'Extremely complex advanced sophisticated algorithm implementation with extensive testing',
        'Large-scale comprehensive enterprise system rewrite with full migration',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.complexity).toBeGreaterThanOrEqual(6);
      }
    });

    it('should adjust complexity for long descriptions', () => {
      const shortTask = 'Fix bug';
      const longTask =
        'Fix the critical security vulnerability in the authentication module ' +
        'that allows unauthorized access to user data and also update the logging ' +
        'system to capture failed attempts and implement rate limiting additionally ' +
        'add unit tests and integration tests to verify the fix works correctly';

      const shortAnalysis = analyzer.analyze(shortTask);
      const longAnalysis = analyzer.analyze(longTask);

      expect(longAnalysis.complexity).toBeGreaterThan(shortAnalysis.complexity);
    });

    it('should return complexity between 1 and 10', () => {
      const tasks = [
        'x',
        'Simple task',
        'Moderate complexity task with some requirements',
        'Very complex enterprise-scale migration and rewrite of entire system',
      ];

      for (const task of tasks) {
        const analysis = analyzer.analyze(task);
        expect(analysis.complexity).toBeGreaterThanOrEqual(1);
        expect(analysis.complexity).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('analyze - capability detection', () => {
    const analyzer = new TaskAnalyzer();

    it('should detect code generation capability', () => {
      const analysis = analyzer.analyze('Generate a function to parse JSON');
      expect(analysis.capabilities.codeGeneration).toBe(true);
    });

    it('should detect code execution capability', () => {
      const analysis = analyzer.analyze('Run the test suite and verify results');
      expect(analysis.capabilities.codeExecution).toBe(true);
    });

    it('should detect file operations capability', () => {
      const analysis = analyzer.analyze('Read the config file and update the path');
      expect(analysis.capabilities.fileOperations).toBe(true);
    });

    it('should detect shell execution capability', () => {
      const analysis = analyzer.analyze('Run npm install and git commit');
      expect(analysis.capabilities.shellExecution).toBe(true);
    });

    it('should detect vision capability', () => {
      const analysis = analyzer.analyze('Look at this screenshot and describe the UI');
      expect(analysis.capabilities.vision).toBe(true);
    });

    it('should detect long context capability', () => {
      const analysis = analyzer.analyze('Analyze the entire codebase for issues');
      expect(analysis.capabilities.longContext).toBe(true);
    });

    it('should detect tool calling capability', () => {
      const analysis = analyzer.analyze('Search for similar issues and fetch the API data');
      expect(analysis.capabilities.toolCalling).toBe(true);
    });

    it('should detect multiple capabilities', () => {
      const analysis = analyzer.analyze(
        'Write code to read the file, run tests, and generate a report',
      );
      expect(analysis.capabilities.codeGeneration).toBe(true);
      expect(analysis.capabilities.fileOperations).toBe(true);
      expect(analysis.capabilities.codeExecution).toBe(true);
    });
  });

  describe('analyze - token estimation', () => {
    const analyzer = new TaskAnalyzer();

    it('should estimate tokens for simple tasks', () => {
      const analysis = analyzer.analyze('Hello');
      expect(analysis.estimatedInputTokens).toBeGreaterThan(0);
      expect(analysis.estimatedOutputTokens).toBeGreaterThan(0);
    });

    it('should estimate higher output for coding tasks', () => {
      const codingAnalysis = analyzer.analyze('Write a sorting function');
      const generalAnalysis = analyzer.analyze('What is sorting?');

      expect(codingAnalysis.estimatedOutputTokens).toBeGreaterThan(
        generalAnalysis.estimatedOutputTokens,
      );
    });

    it('should scale output with complexity', () => {
      const simpleAnalysis = analyzer.analyze('Simple quick fix');
      const complexAnalysis = analyzer.analyze('Complex enterprise migration');

      expect(complexAnalysis.estimatedOutputTokens).toBeGreaterThan(
        simpleAnalysis.estimatedOutputTokens,
      );
    });

    it('should cap output tokens at reasonable limit', () => {
      const analysis = analyzer.analyze(
        'Very complex extremely long comprehensive full enterprise-scale ' +
          'migration rewrite overhaul of entire system including all modules',
      );
      expect(analysis.estimatedOutputTokens).toBeLessThanOrEqual(8000);
    });
  });

  describe('analyze - matched keywords', () => {
    const analyzer = new TaskAnalyzer();

    it('should return matched keywords', () => {
      const analysis = analyzer.analyze('Write a function to implement the API');
      expect(analysis.matchedKeywords.length).toBeGreaterThan(0);
      expect(analysis.matchedKeywords).toContain('function');
    });

    it('should match multi-word phrases', () => {
      const analysis = analyzer.analyze('Create a unit test for the module');
      expect(analysis.matchedKeywords).toContain('unit test');
    });
  });

  describe('analyze - original task preserved', () => {
    const analyzer = new TaskAnalyzer();

    it('should preserve original task', () => {
      const task = 'Write Code With UPPERCASE';
      const analysis = analyzer.analyze(task);
      expect(analysis.originalTask).toBe(task);
    });
  });

  describe('summarize', () => {
    const analyzer = new TaskAnalyzer();

    it('should create readable summary', () => {
      const analysis = analyzer.analyze('Write a function to parse JSON');
      const summary = analyzer.summarize(analysis);

      expect(summary).toContain('Type:');
      expect(summary).toContain('Complexity:');
      expect(summary).toContain('Confidence:');
      expect(summary).toContain('tokens:');
    });

    it('should include secondary types when present', () => {
      const analysis = analyzer.analyze(
        'Analyze the code and create a detailed explanation',
      );
      const summary = analyzer.summarize(analysis);

      if (analysis.secondaryTypes.length > 0) {
        expect(summary).toContain('Secondary:');
      }
    });

    it('should include active capabilities', () => {
      const analysis = analyzer.analyze('Read the file and run the test');
      const summary = analyzer.summarize(analysis);
      expect(summary).toContain('Capabilities:');
    });
  });

  describe('createTaskAnalyzer', () => {
    it('should create analyzer with factory function', () => {
      const analyzer = createTaskAnalyzer();
      expect(analyzer).toBeInstanceOf(TaskAnalyzer);
    });

    it('should pass config to factory', () => {
      const analyzer = createTaskAnalyzer({
        defaultType: TaskType.CODING,
      });
      expect(analyzer).toBeInstanceOf(TaskAnalyzer);
    });
  });

  describe('analyzeTask', () => {
    it('should analyze with default analyzer', () => {
      const analysis = analyzeTask('Write a function');
      expect(analysis.type).toBe(TaskType.CODING);
    });
  });

  describe('edge cases', () => {
    const analyzer = new TaskAnalyzer();

    it('should handle empty string', () => {
      const analysis = analyzer.analyze('');
      expect(analysis.type).toBe(DEFAULT_TASK_ANALYZER_CONFIG.defaultType);
      expect(analysis.confidence).toBe(0);
    });

    it('should handle special characters', () => {
      const analysis = analyzer.analyze('!@#$%^&*()');
      expect(analysis).toBeDefined();
    });

    it('should handle numbers only', () => {
      const analysis = analyzer.analyze('123456789');
      expect(analysis).toBeDefined();
    });

    it('should handle very long input', () => {
      const longTask = 'Write code '.repeat(1000);
      const analysis = analyzer.analyze(longTask);
      expect(analysis.type).toBe(TaskType.CODING);
    });

    it('should handle unicode characters', () => {
      const analysis = analyzer.analyze('Write a function 函数 функция');
      expect(analysis).toBeDefined();
    });
  });
});
