/**
 * @license
 * Copyright 2025 Damie Code
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  showRouteDecision,
  listRoutingConfig,
  showTaskTypes,
  handleRouteCommand,
} from './routeCommand.js';

// Mock dependencies
vi.mock('../../../core/src/router/index.js', () => ({
  ModelRouter: vi.fn().mockImplementation(() => ({
    route: vi.fn().mockReturnValue({
      provider: 'deepseek',
      model: 'deepseek-chat',
      analysis: {
        type: 'coding',
        complexity: 5,
        confidence: 0.8,
        matchedKeywords: ['function', 'write'],
        estimatedInputTokens: 500,
        estimatedOutputTokens: 1000,
        capabilities: {
          codeGeneration: true,
          codeExecution: false,
          fileOperations: false,
          shellExecution: false,
          vision: false,
          longContext: false,
          toolCalling: false,
        },
      },
      reason: 'Task type coding routes to deepseek',
      alternatives: ['openai', 'anthropic'],
      isFallback: false,
      isOverride: false,
    }),
    formatDecision: vi.fn().mockReturnValue(
      'Provider: deepseek\nModel: deepseek-chat\nTask Type: coding',
    ),
    applyDamieConfig: vi.fn(),
  })),
  createModelRouter: vi.fn().mockImplementation(() => ({
    route: vi.fn().mockReturnValue({
      provider: 'deepseek',
      model: 'deepseek-chat',
      analysis: {
        type: 'coding',
        complexity: 5,
        confidence: 0.8,
        matchedKeywords: ['function', 'write'],
        estimatedInputTokens: 500,
        estimatedOutputTokens: 1000,
        capabilities: {
          codeGeneration: true,
          codeExecution: false,
          fileOperations: false,
          shellExecution: false,
          vision: false,
          longContext: false,
          toolCalling: false,
        },
      },
      reason: 'Task type coding routes to deepseek',
      alternatives: ['openai', 'anthropic'],
      isFallback: false,
      isOverride: false,
    }),
    formatDecision: vi.fn().mockReturnValue(
      'Provider: deepseek\nModel: deepseek-chat\nTask Type: coding',
    ),
    applyDamieConfig: vi.fn(),
  })),
  TaskType: {
    CODING: 'coding',
    REASONING: 'reasoning',
    CREATIVE: 'creative',
    VISUAL: 'visual',
    GENERAL: 'general',
  },
}));

vi.mock('../../../core/src/config/damieConfigLoader.js', () => ({
  loadDamieConfig: vi.fn().mockReturnValue({
    security: { auth: { selectedType: 'deepseek' } },
    model: {
      routing: {
        coding: 'deepseek',
        reasoning: 'anthropic',
      },
    },
  }),
}));

describe('routeCommand', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('showRouteDecision', () => {
    it('should show routing decision for a task', () => {
      showRouteDecision('Write a function');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Routing Decision');
    });

    it('should accept provider override', () => {
      showRouteDecision('Write a function', 'openai');
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should accept model override', () => {
      showRouteDecision('Write a function', 'openai', 'gpt-4-turbo');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('listRoutingConfig', () => {
    it('should display routing configuration', () => {
      listRoutingConfig();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Routing Configuration');
    });
  });

  describe('showTaskTypes', () => {
    it('should display task type examples', () => {
      showTaskTypes();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Task Types');
      expect(output).toContain('Coding');
      expect(output).toContain('Reasoning');
      expect(output).toContain('Creative');
    });
  });

  describe('handleRouteCommand', () => {
    it('should show usage when no args', () => {
      handleRouteCommand([]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage:');
    });

    it('should handle --config flag', () => {
      handleRouteCommand(['--config']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Routing Configuration');
    });

    it('should handle --types flag', () => {
      handleRouteCommand(['--types']);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Task Types');
    });

    it('should route task with arguments', () => {
      handleRouteCommand(['Write', 'a', 'function']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle --provider option', () => {
      handleRouteCommand(['Write', 'code', '--provider', 'openai']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should handle --model option', () => {
      handleRouteCommand(['Write', 'code', '--model', 'gpt-4-turbo']);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
